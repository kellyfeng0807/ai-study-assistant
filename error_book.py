"""
Error Book Manager Module
错题本管理模块
上传/拍照题目 → OCR识别 → 自动分类 → 生成复习计划
"""



from flask import Blueprint, request, jsonify
import json
import re
from paddleocr import PPStructureV3
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
# ===== 临时内存存储（开发用）=====
_ERROR_DB = []
# ===== 配置 =====
error_bp = Blueprint('error_book', __name__, url_prefix='/api/error')
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")


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
            "你是一位严谨的中学教师，请根据图片内容严格按以下规则输出：\n"
            "1. 只输出一个合法 JSON 对象；\n"
            "2. 不要任何解释、不要 markdown、不要额外文字；\n"
            "3. 如果某字段无法识别，留空字符串或空数组。\n\n"
            "请提取：题目、用户解答、正确答案、错误分析步骤、题型、科目、知识点。\n"
            "输出格式必须是：\n"
            "{"
            "\"subject\": \"数学\","
            "\"type\": \"解答题\","
            "\"tags\": [\"三角函数\",\"诱导公式\"],"
            "\"question_text\": \"题目原文\","
            "\"user_answer\": \"学生写的解答过程和答案\","
            "\"correct_answer\": \"正确答案\","
            "\"analysis_steps\": [\"错误步骤1\",\"错误步骤2\"]"
            "}"
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

        cleaned_json = clean_json_for_object(raw_output)
        parsed = json.loads(cleaned_json)

        result = {
            "id": f"err_{int(time.time() * 1000)}",
            "success": True,
            **parsed
        }

        print("✅ Final parsed result:", result)
        _ERROR_DB.append(result)
        return jsonify(result)

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
    filtered = _ERROR_DB
    if subject:
        filtered = [e for e in filtered if e.get('subject', '').lower() == subject.lower()]
    return jsonify({
        'success': True,
        'errors': filtered,
        'total': len(filtered)
    })

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
你是一位资深中学教师，任务是根据以下原题生成 {count} 道“同类型、同知识点、同难度”的相似练习题，并为每道题提供标准答案。

⚠️ 严格要求：
- 题目必须相似但不重复（改变数字、情境、表达方式）
- 保持相同题型、科目、知识点
- 每道题包含：题目（question）和标准答案（answer）
- 只输出一个 JSON 数组，不要任何解释、注释或 Markdown
- 数组长度必须等于 {count}

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