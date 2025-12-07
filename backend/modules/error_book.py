"""
Error Book Manager Module
错题本管理模块
上传/拍照题目 → OCR识别 → 自动分类 → 生成复习计划
"""

from flask import Blueprint, request, jsonify, send_from_directory
import json
import re
import time
import os
import traceback
import sys
from dashscope import MultiModalConversation, Generation

# 导入共享数据库模块（参照 map_generation.py 的方式）
import db_sqlite

# ===== 配置 =====
error_bp = Blueprint('error_book', __name__, url_prefix='/api/error')
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")

# 初始化错题表
db_sqlite.init_db()


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
    print("=== Error Upload Request Received ===")
    
    if 'file' not in request.files:
        print("ERROR: No file in request")
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        print("ERROR: Empty filename")
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    print(f"File received: {uploaded_file.filename}, size: {uploaded_file.content_length}")
    
    temp_dir = "./temp_uploads"
    try:
        os.makedirs(temp_dir, exist_ok=True)
        print(f"Temp directory ensured: {os.path.abspath(temp_dir)}")
    except Exception as e:
        print(f"ERROR: Failed to create temp directory: {e}")
        return jsonify({'success': False, 'error': f'Failed to create temp directory: {str(e)}'}), 500
    
    temp_path = os.path.join(temp_dir, f"{int(time.time() * 1000)}_{uploaded_file.filename}")
    
    try:
        uploaded_file.save(temp_path)
        print(f"File saved to: {temp_path}")
    except Exception as e:
        print(f"ERROR: Failed to save file: {e}")
        return jsonify({'success': False, 'error': f'Failed to save file: {str(e)}'}), 500

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

        print("Calling Qwen-VL API...")
        if not DASHSCOPE_API_KEY or DASHSCOPE_API_KEY == "sk-52e14360ea034580a43eee057212de78":
            print("WARNING: Using default API key, may not work in production!")
        
        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=DASHSCOPE_API_KEY,
            result_format='message'
        )

        print(f"API Response status: {response.status_code}")
        
        if response.status_code != 200:
            error_msg = f"Qwen-VL API Error {response.code}: {response.message}"
            print(f"ERROR: {error_msg}")
            raise Exception(error_msg)

        raw_output = response.output.choices[0].message.content[0]['text']
        print(f"API Response (first 200 chars): {raw_output[:200]}...")
        
        cleaned_json = clean_json_for_object(raw_output)
        parsed = json.loads(cleaned_json)
        print(f"Parsed successfully: subject={parsed.get('subject')}, type={parsed.get('type')}")

        # 保存到数据库（按 Note 模块的模式：保存后立即读取，确保数据一致）
        new_id = db_sqlite.insert_error(parsed)
        print(f"Saved to database with ID: {new_id}")
        saved = db_sqlite.get_error_by_id(new_id)
        
        print("=== Upload Success ===")
        return jsonify({
            'success': True,
            **saved  # Changed from 'error': saved to unpack the dict
        })

    except Exception as e:
        print(f"=== Upload Failed ===")
        print(f"Exception: {type(e).__name__}: {str(e)}")
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
def list_errors_route():
    subject = request.args.get('subject', '')
    user_id = request.args.get('user_id')
    
    errors = db_sqlite.list_errors(subject=subject if subject else None, user_id=user_id)
    total = db_sqlite.count_errors(subject=subject if subject else None, user_id=user_id)
    
    return jsonify({
        'success': True,
        'errors': errors,
        'total': total
    })


# ===== 路由：获取单个错题 =====
@error_bp.route('/get', methods=['GET'])
def get_error():
    error_id = request.args.get('id')
    if not error_id:
        return jsonify({'success': False, 'error': 'Missing id parameter'}), 400
    
    try:
        error_id = int(error_id)
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid id format'}), 400
    
    error = db_sqlite.get_error_by_id(error_id)
    if not error:
        return jsonify({'success': False, 'error': 'Error not found'}), 404
    
    return jsonify({
        'success': True,
        'error': error
    })


# ===== 路由：删除错题 =====
@error_bp.route('/delete/<int:error_id>', methods=['DELETE'])
def delete_error_route(error_id):
    success = db_sqlite.delete_error(error_id)
    if success:
        return jsonify({'success': True, 'message': 'Error deleted successfully'})
    else:
        return jsonify({'success': False, 'error': 'Error not found'}), 404


# ===== 路由：重做错题 =====
@error_bp.route('/redo', methods=['POST'])
def redo_error():
    data = request.json
    error_id = data.get('id')
    redo_answer = data.get('redo_answer', '')
    
    if not error_id:
        return jsonify({'success': False, 'error': 'Missing id'}), 400
    
    try:
        error_id = int(error_id)
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid id format'}), 400
    
    # 获取原错题信息
    error = db_sqlite.get_error_by_id(error_id)
    if not error:
        return jsonify({'success': False, 'error': 'Error not found'}), 404
    
    # 更新重做记录
    success = db_sqlite.update_error_redo(error_id, redo_answer)
    if success:
        return jsonify({
            'success': True,
            'message': 'Redo recorded successfully',
            'correct_answer': error.get('correct_answer', '')
        })
    else:
        return jsonify({'success': False, 'error': 'Failed to update redo'}), 500

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
        print("Raw Qwen output:", repr(raw))

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
        print(f"Generate similar failed: {e}")
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