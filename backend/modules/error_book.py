"""
Error Book Manager Module
错题本管理模块
上传/拍照题目 → OCR识别 → 自动分类 → 生成复习计划
"""



from flask import Blueprint, request, jsonify
import json
import re
#from paddleocr import PPStructureV3
from openai import OpenAI
import time
import os
import json
import re
import time
from flask import request, jsonify, send_from_directory
from flask import Blueprint
from dashscope import MultiModalConversation, Generation
import traceback
import html
import sqlite3
from datetime import datetime
# ===== 临时内存存储（开发用）=====
#_ERROR_DB = []
# ===== 配置 =====
error_bp = Blueprint('error_book', __name__, url_prefix='/api/error')
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")
BASE_DIR = os.path.dirname(__file__)   # modules 文件夹路径
DB_PATH = os.path.join(BASE_DIR, "study.db")

def get_conn():
    return sqlite3.connect(DB_PATH)
# ===== 工具函数 =====
def clean_json_for_object(text: str) -> str:
    """从文本中提取第一个 JSON 对象 {...}"""
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        return text[start:end + 1]
    raise ValueError("No valid JSON object found")


def clean_json_for_array(text: str) -> str:
    """从文本中提取第一个 JSON 数组 [...]"""
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end > start:
        return text[start:end + 1]
    raise ValueError("No valid JSON array found")



@error_bp.route('/get', methods=['GET'])
def get_error():
    """
    根据错题 ID 返回单条错题数据
    GET 参数：
        id: 错题 ID
    返回：
        { success: true, error: {...} } 或 { success: false, error: "..." }
    """
    error_id = request.args.get('id')
    if not error_id:
        return jsonify({"success": False, "error": "Missing id"}), 400

    try:
        # 转为整数，防止 SQL 注入
        error_id = int(error_id)
    except ValueError:
        return jsonify({"success": False, "error": "Invalid id"}), 400

    try:
        conn = get_conn()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM errorbook WHERE id = ?", (error_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"success": False, "error": "Not found"}), 404

        result = {
            "id": row["id"],
            "user_id": row["user_id"],
            "subject": row["subject"],
            "type": row["type"],
            "tags": json.loads(row["tags"] or "[]"),
            "question_text": row["question"],
            "user_answer": row["user_answer"],
            "correct_answer": row["correct_answer"],
            "analysis_steps": json.loads(row["analysis_steps"] or "[]"),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }

        return jsonify({"success": True, "error": result})

    except Exception as e:
        print("❌ get_error exception:", e)
        return jsonify({"success": False, "error": str(e)}), 500

#删除
@error_bp.route('/delete/<int:error_id>', methods=['POST', 'DELETE'])
def delete_error(error_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM errorbook WHERE id=?", (error_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "deleted_id": error_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ===== 路由：上传错题图片 =====
@error_bp.route('/upload', methods=['POST'])
def upload_question():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    temp_dir = "./temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{int(time.time() * 1000)}_{uploaded_file.filename}")
    uploaded_file.save(temp_path)

    try:
        prompt = (
            "You are a meticulous high school teacher. Please extract information from the uploaded image according to the following rules:\n"
            "1. You may detect MULTIPLE questions in the image.\n"
            "2. Output ONLY ONE valid JSON ARRAY.\n"
            "3. Each element in the array represents ONE question.\n"
            "4. Do not include explanations, markdown or extra text.\n"
            "5. If a field cannot be recognized, leave it empty.\n"
            "6. All fields must be in English.\n\n"

            "Each question object must contain:\n"
            "subject, type, tags, difficulty (choose from: easy, medium, difficult), question_text(includes its options), user_answer, correct_answer, analysis_steps\n\n"

            "The output format must be:\n"
            "[\n"
            "  {\n"
            "    \"subject\": \"Mathematics\",\n"
            "    \"type\": \"Multiple Choice\",\n"
            "    \"tags\": [\"Probability\"],\n"
            "    \"difficulty\": \"easy\",\n"
            "    \"question_text\": \"Full question text with options\",\n"
            "    \"user_answer\": \"...\",\n"
            "    \"correct_answer\": \"...\",\n"
            "    \"analysis_steps\": [\"step1\", \"step2\"]\n"
            "  }\n"
            "]"
        )

        messages = [{
            "role": "user",
            "content": [
                {"image": f"file://{os.path.abspath(temp_path)}"},
                {"text": prompt}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=DASHSCOPE_API_KEY,
            result_format='message'
        )

        if response.status_code != 200:
            raise Exception(f"Qwen-VL API Error {response.code}: {response.message}")

        raw_output = response.output.choices[0].message.content[0]['text']
        print("🔍 Raw Qwen-VL output:", repr(raw_output))
        # ✅ 去掉 Markdown 代码块包裹
        cleaned_json = raw_output.strip()

        if cleaned_json.startswith("```"):
            cleaned_json = cleaned_json.replace("```json", "").replace("```", "").strip()
        #cleaned_json = clean_json_for_object(raw_output)
        #新修改的支持多题
        parsed_list = json.loads(cleaned_json)

        if isinstance(parsed_list, dict):
            parsed_list = [parsed_list]  # 兜底：兼容老模型返回单条



        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        results = []

        for parsed in parsed_list:
            cursor.execute("""
                INSERT INTO errorbook (
                    user_id, subject, type, tags, question,
                    user_answer, correct_answer, analysis_steps,
                    created_at, updated_at, difficulty
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                parsed.get("user_id", 1),
                parsed.get("subject", ""),
                parsed.get("type", ""),
                json.dumps(parsed.get("tags", []), ensure_ascii=False),
                parsed.get("question_text", ""),
                parsed.get("user_answer", ""),
                parsed.get("correct_answer", ""),
                json.dumps(parsed.get("analysis_steps", []), ensure_ascii=False),
                datetime.now().isoformat(),
                datetime.now().isoformat(),
                parsed.get("difficulty", ""),
            ))

            last_id = cursor.lastrowid

            result = {
                "id": last_id,
                "success": True,
                **parsed
            }
            results.append(result)

        conn.commit()
        conn.close()

        return jsonify(results)

        #_ERROR_DB.append(result)
        #return jsonify(result)

    except Exception as e:
        print(f"❌ Processing failed: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'raw_output': raw_output if 'raw_output' in locals() else None
        }), 500

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


@error_bp.route('/list', methods=['GET'])
def list_errors():
    subject = request.args.get('subject', '')
    import os
    print("Current working dir:", os.getcwd())
    print("DB absolute path:", os.path.abspath(DB_PATH))

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if subject:
        cursor.execute("SELECT * FROM errorbook WHERE lower(subject) = lower(?)", (subject,))
    else:
        cursor.execute("SELECT * FROM errorbook")

    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "subject": r["subject"],
            "type": r["type"],
            "tags": json.loads(r["tags"] or "[]"),
            "question": r["question"],
            "user_answer": r["user_answer"],
            "correct_answer": r["correct_answer"],
            "analysis_steps": json.loads(r["analysis_steps"] or "[]"),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "difficulty":r["difficulty"],
            "reviewed": r["reviewed"]

        })

    return jsonify({"success": True, "errors": result, "total": len(result)})


# ===== 路由：生成相似练习题 =====
@error_bp.route('/practice/generate-similar', methods=['POST'])
def generate_similar_exercises():
    data = request.json
    question_text = data.get("question_text", "").strip()
    count = int(data.get("count", 3))
    if not question_text:
        return jsonify({"success": False, "error": "Missing question_text"}), 400
    count = max(1, min(count, 5))  # 限制 1~5 题

    prompt = f"""
你是一位资深中学教师，任务是根据以下原题生成 {count} 道“同类型、相似知识点、相似难度”的相似练习题，实际的问题和答案应该完全不一样，并为每道题提供标准答案。

⚠️ 严格要求：
- 知识点必须相似但不重复（改变数字、情境）
- 保持相同题型、科目、相似知识点
- 每道题包含：题目（question）和标准答案（answer）
- 只输出一个 JSON 数组，不要任何解释、注释或 Markdown
- 数组长度必须等于 {count}
返回的题目和答案都用英文！
输出格式示例：
[
  {{"question": "题1内容", "answer": "题1答案"}},
  {{"question": "题2内容", "answer": "题2答案"}}
]

原题如下：
=====================
{question_text}
=====================
"""

    try:
        response = Generation.call(
            model="qwen-max",
            api_key=DASHSCOPE_API_KEY,
            prompt=prompt,
            result_format="message"
        )

        if response.status_code != 200:
            raise Exception(f"Qwen API Error {response.code}: {response.message}")

        raw = response.output.choices[0].message.content.strip()
        print("🔍 Raw Qwen output:", repr(raw))

        cleaned = clean_json_for_array(raw)
        similar_list = json.loads(cleaned)

        # 补齐或截断到指定数量
        similar_list = similar_list[:count]
        while len(similar_list) < count:
            similar_list.append({"question": "（生成失败）", "answer": ""})

        return jsonify({
            "success": True,
            "data": {"similar_problems": similar_list}
        })

    except Exception as e:
        print(f"❌ Generate similar failed: {e}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": "LLM generation or JSON parsing failed",
            "raw_output": raw if 'raw' in locals() else str(e)
        }), 500


# ===== 路由：返回前端练习页面 =====
@error_bp.route('/practice', methods=['GET'])
def practice_page():
    backend_dir = os.path.dirname(__file__)
    frontend_dir = os.path.abspath(os.path.join(backend_dir, '../../frontend'))
    html_path = os.path.join(frontend_dir, 'error-practice.html')
    if not os.path.exists(html_path):
        return jsonify({"error": "Frontend file not found"}), 404
    return send_from_directory(frontend_dir, 'error-practice.html')

@error_bp.route('/redo', methods=['POST'])
def redo_question():
    error_id = request.form.get('error_id')
    if not error_id:
        return jsonify({"success": False, "error": "Missing error_id"}), 400

    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({"success": False, "error": "Empty filename"}), 400

    temp_dir = "./temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{int(time.time()*1000)}_{uploaded_file.filename}")
    uploaded_file.save(temp_path)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    #conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    #cursor.row_factory = sqlite3.Row

    try:
        # 取原题题目和正确答案
        cursor.execute("SELECT question, correct_answer FROM errorbook WHERE id=?", (error_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "error": "Error record not found"}), 404

        # 转成 dict 打印完整信息，方便调试
        row_dict = dict(row)
        print("row 类型:", type(row))
        print("row 内容 (完整字段):", row_dict)

        # 获取题目文本
        question_text = row_dict.get("question") or ""  # 空值转空字符串
        if not question_text.strip():
            return jsonify({"success": False, "error": "题目文本为空"}), 400

        # 获取正确答案
        correct_answer = row_dict.get("correct_answer") or ""
        print("上传文件路径:", temp_path)
        print("文件存在吗:", os.path.exists(temp_path))
        print("文件大小:", os.path.getsize(temp_path) if os.path.exists(temp_path) else 0)



        # 调用 Qwen-VL / OCR API 识别用户提交的新答案，并判断是否正确
        prompt = f"""
        已知题目如下（文字形式提供，不需要识别图片中的题目）：
        {row['question']}

        请严格只识别用户上传图片中的**答案部分**，不要识别图片中出现的题目文字。
        不要重复题目内容，也不要生成解析，只输出答案。
        判断图片答案与文字题目（非图片中题目）的答案是否一致。
        要求输出 JSON：
        {{
          "user_answer": "xxx",
          "is_correct": true 或 false
        }}
        不要添加任何其他文字或说明。
        """

        messages = [{
            "role": "user",
            "content": [
                {"image": f"file://{os.path.abspath(temp_path)}"},
                {"text": prompt}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=DASHSCOPE_API_KEY,
            result_format='message'
        )
        print("Qwen-VL 原始返回:", response)

        #if response.status_code != 200:
        #    raise Exception(f"Qwen-VL API Error {response.code}: {response.message}")


        raw_output = response.output.choices[0].message.content[0]['text']
        print("🔍 Redo raw output:", repr(raw_output))


        # 解析 JSON
        parsed = json.loads(clean_json_for_object(raw_output))
        new_answer = parsed.get("user_answer", "").strip()
        is_correct = parsed.get("is_correct", False)  # 由模型判断
        '''
        # 调用 Qwen-VL / OCR API 识别用户提交的新答案
        prompt = f'请识别图片中的答案，只输出 JSON，格式：{{"user_answer": "xxx"}}，不要额外文字。'
        messages = [{
            "role": "user",
            "content": [
                {"image": f"file://{os.path.abspath(temp_path)}"},
                {"text": prompt}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=DASHSCOPE_API_KEY,
            result_format='message'
        )

        if response.status_code != 200:
            raise Exception(f"Qwen-VL API Error {response.code}: {response.message}")

        raw_output = response.output.choices[0].message.content[0]['text']
        print("🔍 Redo raw output:", repr(raw_output))
        parsed = json.loads(clean_json_for_object(raw_output))
        new_answer = parsed.get("user_answer", "").strip()

        # 简单对比判断是否正确
        is_correct = new_answer == correct_answer
        '''

        # 更新 errorbook 表
        cursor.execute("""
            UPDATE errorbook
            SET reviewed=1, redo_answer=?, redo_time=?
            WHERE id=?
        """, (new_answer, datetime.now().isoformat(), error_id))
        conn.commit()

        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "new_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("❌ Redo failed:", e)
        return jsonify({"success": False, "error": str(e), "raw_output": raw_output if 'raw_output' in locals() else None}), 500

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        conn.close()

