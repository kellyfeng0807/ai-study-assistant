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
import requests
# 导入共享数据库模块（参照 map_generation.py 的方式）
import db_sqlite
import datetime
import base64

import cv2
import numpy as np

from backend.db_sqlite import insert_practice, get_practice_by_id, list_practice, list_practice_by_error_id

# ===== 配置 =====
error_bp = Blueprint('error_book', __name__, url_prefix='/api/error')
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")
# 假设你已在模块顶部定义了：
DEEPSEEK_API_KEY = "sk-44838ffc3bb645e6a82dc24e55183bec"
DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
# 初始化错题表
db_sqlite.init_db()

# Debug: Print database info on module load
print(f"[ERROR_BOOK_INIT] db_sqlite.DB_PATH: {db_sqlite.DB_PATH}", file=sys.stderr)
print(f"[ERROR_BOOK_INIT] DB file exists: {os.path.exists(db_sqlite.DB_PATH)}", file=sys.stderr)


# ===== 工具函数 =====
import cv2
import os


def crop_images_from_image(input_path, output_dir="crops"):
    """
    裁剪图片中的图片块，保存到 output_dir，并返回每块图片的路径和坐标
    """
    os.makedirs(output_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"无法读取图片: {input_path}")

    height, width = img.shape[:2]
    img_area = height * width
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 11, 2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    results = []
    padding_ratio = 0.2

    for count, cnt in enumerate(contours):
        x, y, w, h = cv2.boundingRect(cnt)
        area_ratio = (w * h) / img_area
        if area_ratio > 0.01 and 0.3 < w / h < 5:
            pad_w = int(w * padding_ratio)
            pad_h = int(h * padding_ratio)
            x1 = max(x - pad_w, 0)
            y1 = max(y - pad_h, 0)
            x2 = min(x + w + pad_w, width)
            y2 = min(y + h + pad_h, height)

            cropped = img[y1:y2, x1:x2]
            save_path = os.path.join(output_dir, f"crop_{count}.png")
            cv2.imwrite(save_path, cropped)

            results.append({
                "path": save_path,
                "bbox": [x1, y1, x2, y2]
            })

    return results


def sort_bboxes_reading_order(bboxes_with_data, y_tolerance=20):
    """
    按阅读顺序（从上到下，每行从左到右）排序 bbox 列表。

    Args:
        bboxes_with_data: List of dict, each has 'bbox': [x1, y1, x2, y2]
        y_tolerance: y1 差值小于该值的认为在同一行（单位：像素）

    Returns:
        Sorted list
    """
    if not bboxes_with_data:
        return bboxes_with_data

    # Step 1: 按 y1 排序（初步）
    items = sorted(bboxes_with_data, key=lambda c: c['bbox'][1])

    # Step 2: 分行
    lines = []
    current_line = []
    current_y = items[0]['bbox'][1]

    for item in items:
        y1 = item['bbox'][1]
        if abs(y1 - current_y) <= y_tolerance:
            # 属于当前行
            current_line.append(item)
        else:
            # 新起一行
            lines.append(current_line)
            current_line = [item]
            current_y = y1
    if current_line:
        lines.append(current_line)

    # Step 3: 每行内部按 x1 排序
    for line in lines:
        line.sort(key=lambda c: c['bbox'][0])

    # Step 4: 扁平化
    result = []
    for line in lines:
        result.extend(line)

    return result


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


import re
import re
import json


import re
import json


import re
def fix_latex_for_frontend(text):
    # 把公式里的 \\ 恢复成 \，保证 KaTeX/MathJax 渲染
    def repl(match):
        formula = match.group(0)
        formula = formula.replace('\\\\', '\\')
        return formula

    text = re.sub(r'\$.*?\$', repl, text, flags=re.DOTALL)
    text = re.sub(r'\$\$.*?\$\$', repl, text, flags=re.DOTALL)
    return text


def clean_json_for_array(text: str) -> str:
    """
    从文本中提取第一个 JSON 数组 [...]，
    并自动修复所有 \ 为合法 JSON 转义
    """
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end <= start:
        raise ValueError("No valid JSON array found")

    s = text[start:end + 1]

    # 对所有 \ 做转义，确保 json.loads 不报错
    s = s.replace('\\', '\\\\')

    # 然后再对 LaTeX 公式做修复（\left...\right）
    def fix_formula(match):
        formula = match.group(0)
        # 在这里不再处理 \，只处理 \left 和 \right
        left_count = formula.count(r'\left')
        right_count = formula.count(r'\right')
        if left_count > right_count:
            formula += r'\right'
        elif right_count > left_count:
            formula = r'\left' + formula
        return formula

    s = re.sub(r'\$\$?.+?\$\$?', fix_formula, s, flags=re.DOTALL)

    return s




'''
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
'''
@error_bp.route('/upload', methods=['POST'])
def upload_question():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    # 上传文件和裁剪图统一保存
    upload_dir = "./uploads/error-crop"
    os.makedirs(upload_dir, exist_ok=True)

    # 保存原图
    timestamp = int(time.time() * 1000)
    orig_path = os.path.join(upload_dir, f"{timestamp}_{uploaded_file.filename}")
    uploaded_file.save(orig_path)

    try:
        # 裁剪图片到 upload_dir
        cropped_results = crop_images_from_image(orig_path, output_dir=upload_dir)

        cropped_results = sort_bboxes_reading_order(cropped_results, y_tolerance=15)
        # 为每张裁剪图添加索引和路径
        for idx, crop in enumerate(cropped_results):
            crop['index'] = idx
            crop['abs_path'] = os.path.abspath(crop['path'])
            crop['rel_path'] = os.path.relpath(crop['path'], start=os.getcwd())

        # 构建 prompt
        prompt = (
            "你是一位严谨的中学教师，请根据第一张图片识别题目内容、答案和解析。\n"
            "【图像说明】\n"
    "- 图像0：完整原题图片（包含题干、选项、答案等全部内容）\n"
    "- 图像1, 2, 3, ...：系统自动裁剪的局部图（如选项图、实验图、坐标系等）\n"
    "- 注意：**裁剪图的索引从 0 开始**，即：\n"
    "    • 图像1 → 裁剪图索引 0\n"
    "    • 图像2 → 裁剪图索引 1\n"
    "    • 图像3 → 裁剪图索引 2\n"
    "    • 以此类推\n"
    "\n"
             "**关键：为每道题指定它所依赖的裁剪图索引（crop_index）**\n"
    "   - crop_index 是一个整数列表，例如 [0], [1,2], [0,1,2,3,4,5] 或 []。\n"
    "   - **如果整张原图只包含一道题（无论多少小问），则该题必须包含所有裁剪图索引。**\n"
    "   - 仅当原图明确包含多道独立题目时，才可将裁剪图分配给不同题。\n"
    "   - 一道裁剪图只能属于一道题。\n"
    "\n"
            "1. 'question_text' 必须完整包含题目原文及所有选项。\n"
            "2. 只输出合法 JSON 数组，不要解释、Markdown 或额外文字。\n"
            "请严格输出 JSON 数组，只允许使用以下转义： \\, \", \n, \t, \r,所有 LaTeX 公式中的反斜杠必须使用双反斜杠 \\，不要生成单反斜杠。"
            "3. 科目（subject）从 Chinese, Mathematics, English, Physics, Chemistry, Politics, History, Geography, Biology 中选择。\n"
            "4. 题型（type）、知识点（tags）使用英文描述。\n"
            "5. 'correct_answer' 和 'analysis_steps' 必须基于题目推导，与用户答案无关。\n"
            "6.  'user_answer' 为图片上的答案。\n"
            "请按以下格式输出示例：\n"
            "[\n"
            "  {\n"
            "    \"subject\": \"Chinese\",\n"
            "    \"type\": \"Constructed-response question\",\n"
            "    \"tags\": [\"Trigonometric Functions\",\"Induction Formulas\"],\n"
            "    \"question_text\": \"题目原文\",\n"
            "    \"analysis_steps\": [\"正确步骤1\",\"正确步骤2\"],\n"
            "    \"correct_answer\": \"正确答案\",\n"
            "    \"user_answer\": \"学生答案\",\n"
            "    \"crop_index\": []\n"
            "  },\n"
            "  {... 第二题 ...}\n"
            "]"
        )

        # 构建消息列表
        messages = [{
            "role": "user",
            "content": (
                [{"image": f"file://{os.path.abspath(orig_path)}"}] +  # 第一张图
                [{"image": f"file://{crop['abs_path']}"} for crop in cropped_results] +
                [{"text": prompt}]
            )
        }]

        # 调用 Qwen-VL
        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=DASHSCOPE_API_KEY,
            result_format='message'
        )

        if response.status_code != 200:
            raise Exception(f"Qwen-VL API Error {response.code}: {response.message}")

        raw_output = response.output.choices[0].message.content[0]['text']
        cleaned_json = clean_json_for_array(raw_output)
        print("=== CLEANED JSON (repr) ===")
        print(repr(cleaned_json))
        print("=== END ===")

        try:
            parsed_list = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            print("JSON 解析失败，启动修复模式…")
            print(e)

            repaired = cleaned_json

            # 尝试二次修复：去掉孤立反斜杠
            repaired = repaired.replace("\\'", "'")
            repaired = repaired.replace('\\"', '"')

            # 再试
            parsed_list = json.loads(repaired)

        #parsed_list = json.loads(cleaned_json)

        if not isinstance(parsed_list, list):
            raise ValueError("模型返回的不是 JSON 数组，请检查输出格式。")

        # 在保存到数据库前，处理公式
        for parsed in parsed_list:
            parsed['question_text'] = fix_latex_for_frontend(parsed['question_text'])
            parsed["correct_answer"] = fix_latex_for_frontend(parsed["correct_answer"])
            parsed['analysis_steps'] = [fix_latex_for_frontend(step) for step in parsed.get('analysis_steps', [])]

        # 保存到数据库，同时附加对应裁剪图相对路径
        saved_list = []
        for parsed in parsed_list:
            # 初始化 images 列表
            parsed['images'] = []

            # 获取 crop_indices, 可能是一个列表或单个值
            crop_indices = parsed.get('crop_index', [])
            if isinstance(crop_indices, int):  # 如果是单个值，则转换为列表
                crop_indices = [crop_indices]

            for crop_idx in crop_indices:
                if 0 <= crop_idx < len(cropped_results):
                    relative_path = cropped_results[crop_idx]['rel_path'].replace("\\", "/")
                    if not relative_path.startswith("/"):
                        relative_path = "/" + relative_path
                    parsed['images'].append(relative_path)


            # 插入数据到数据库
            new_id = db_sqlite.insert_error(parsed)
            saved = db_sqlite.get_error_by_id(new_id)
            if isinstance(saved, dict) and 'success' in saved:
                del saved['success']
            saved['id'] = new_id
            saved_list.append(saved)

        return jsonify({
            'success': True,
            'questions': saved_list
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'raw_output': raw_output if 'raw_output' in locals() else None
        }), 500



@error_bp.route('/list', methods=['GET'])
def list_errors_route():
    subject = request.args.get('subject', '')
    user_id = request.args.get('user_id')
    
    errors = db_sqlite.list_errors(subject=subject if subject else None, user_id=user_id)
    total = db_sqlite.count_errors(subject=subject if subject else None, user_id=user_id)
    print(errors)
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
def redo_question():
    data = request.json

    error_id = data.get("id")
    redo_image = data.get("redo_answer", "")

    if not error_id:
        return jsonify({"success": False, "error": "Missing id"}), 400

    if not redo_image:
        return jsonify({"success": False, "error": "Missing image"}), 400

    import base64
    from datetime import datetime

    temp_dir = "./temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{int(time.time()*1000)}.png")

    b64 = redo_image.split(",")[-1]
    with open(temp_path, "wb") as f:
        f.write(base64.b64decode(b64))


    try:
        # ✅ 改：通过 db_sqlite 获取错题
        error = db_sqlite.get_error_by_id(int(error_id))
        if not error:
            return jsonify({"success": False, "error": "Error record not found"}), 404

        # ✅ 统一字段名
        question_text = error.get("question_text", "")
        correct_answer = error.get("correct_answer", "")
        if not question_text.strip():
            return jsonify({"success": False, "error": "题目为空"}), 400

        print("上传文件路径:", temp_path)
        print("文件大小:", os.path.getsize(temp_path) if os.path.exists(temp_path) else 0)

        # ✅ AI Prompt（完全保留你原来的逻辑）
        prompt = f"""
        已知题目如下（文字形式提供，不需要识别图片中的题目）：
        {question_text}

        请严格完成以下任务：

        1. **仅识别用户上传图片中的答案部分**（不要包含题目、解析、草稿等）。
        2. **判断该答案是否与上述题目的学科和内容相关**：
           - 如果题目是生物/化学/历史等非数学题，但答案包含大量数学公式、方程、符号（如 x=, ∫, ∑, Δ 等），视为**无效答案**，判错。
           - 如果答案明显与题目主题无关（如题目问细胞结构，答案写“E=mc²”），判错。
        3. **仅当图片中答案内容合理且与题目匹配时**，才进行正确性判断。
        4. 输出必须是严格 JSON 格式，不要任何额外文字。

        输出格式：
        {{
          "user_answer": "识别出的图片中的答案原文，不是原题目的答案（保留原始格式，包括 LaTeX）",
          "is_correct": true 或 false
        }}
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

        raw_output = response.output.choices[0].message.content[0]['text']
        print("🔍 Redo raw output:", repr(raw_output))

        parsed = json.loads(clean_json_for_object(raw_output))
        new_answer = parsed.get("user_answer", "").strip()
        is_correct = parsed.get("is_correct", False)

        # ✅ 改：通过 db_sqlite 更新 redo 结果
        success = db_sqlite.update_error_redo(int(error_id), new_answer)

        if not success:
            return jsonify({"success": False, "error": "Database update failed"}), 500

        # ✅ 如果 AI 判断正确，标记 reviewed=1
        if is_correct:
            db_sqlite.update_error_reviewed(int(error_id), 1)  # 需要你在 db_sqlite 中实现这个方法

        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "new_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("❌ Redo failed:", e)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "raw_output": raw_output if 'raw_output' in locals() else None
        }), 500

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

# ===== 路由：生成相似练习题 =====
@error_bp.route('/practice/generate-similar', methods=['POST'])
def generate_similar_exercises():
    data = request.json
    error_id = data.get("id")  # ✅ 获取 error_id
    question_text = data.get("question_text", "").strip()
    count = int(data.get("count", 3))
    force = data.get("force", False)  # 新增：是否强制生成新题

    if not error_id:
        return jsonify({'success': False, 'error': 'Missing error_id'}), 400

    if not question_text:
        return jsonify({"success": False, "error": "Missing question_text"}), 400
    count = max(1, min(count, 5))  # 限制 1~5 题

    try:
        # ===== 1️⃣ 先查询数据库是否已有对应练习题 =====
        existing_practice = list_practice_by_error_id(error_id=error_id)
        if existing_practice and len(existing_practice) >= count and not force:
            print(f"Found existing {len(existing_practice)} practice questions for error_id={error_id}")
            return jsonify({
                "success": True,
                "data": {"similar_problems": existing_practice[:count]}
            })

        # ===== 2️⃣ 如果没有，或者强制生成，则生成新题 =====
        prompt = f"""
        你是一位资深中学教师，任务是根据以下原题生成 {count} 道“相似知识点、相似难度”的相似练习题，并为每道题提供标准答案。

        ⚠️ 严格要求：
        - 题目必须相似但不重复（改变数字、情境、表达方式、求解内容）
        - 保持相似题型、科目、知识点
        - 每道题包含：题目（question_text）和标准答案（correct_answer），科目，题目类型，知识点，分析步骤
        - 科目（subject）从 Chinese, Mathematics, English, Physics, Chemistry, Politics, History, Geography, Biology 中选择。
        - 不要出有图片的题目
        - 只输出一个 JSON 数组，不要任何解释、注释或 Markdown
        - 数组长度必须等于 {count}
        - subject，type，tags用英语
        - **原题题目是英语的就全部用英语**
        - **输出的 JSON 必须是严格合法的，所有反斜杠必须双写（如 \\\\frac），确保能被 Python json.loads 直接解析。**

        输出格式示例：
        [
          [
      {{
        "subject": "Mathematics",
        "type": "Single choice",
        "tags": ["Quadratic Equation", "Discriminant"],
        "question_text": "题目原文",
        "analysis_steps": ["步骤1", "步骤2"],
        "correct_answer": "标准答案"
        
      }}
        ]
        ]

        原题如下：
        =====================
        {question_text}
        =====================
        """

        if not DEEPSEEK_API_KEY:
            raise Exception("DEEPSEEK_API_KEY not set")

        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0
        }
        r = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )
        if r.status_code != 200:
            raise Exception(f"DeepSeek API Error {r.status_code}: {r.text}")

        # ⚠️ 关键：保持 raw 的赋值方式与原来完全一致
        raw = r.json()['choices'][0]['message']['content'].strip()
        print("Raw Qwen output:", repr(raw))

        cleaned = clean_json_for_array(raw)
        #similar_list = json.loads(cleaned)
        try:
            similar_list = json.loads(cleaned)
        except json.JSONDecodeError as e:
            print("JSON decode error:", e)
            print("Problematic string snippet:", cleaned[max(0, e.pos - 50): e.pos + 50])
            raise

        # 补齐或截断到指定数量
        similar_list = similar_list[:count]
        while len(similar_list) < count:
            similar_list.append({
                "question_text": "（生成失败）",
                "correct_answer": "",
                "subject": "",
                "type": "",
                "tags": [],
                "analysis_steps": []
            })

        # 统一处理 LaTeX，保证前端可渲染
        for q in similar_list:
            q['question_text'] = fix_latex_for_frontend(q.get('question_text', ''))
            q["correct_answer"] = fix_latex_for_frontend(q.get("correct_answer", ''))
            q['analysis_steps'] = [fix_latex_for_frontend(step) for step in q.get('analysis_steps', [])]

        # ===== 3️⃣ 存入数据库 =====
        saved_list = []
        for parsed in similar_list:
            parsed["error_id"] = error_id
            new_id = insert_practice(parsed)
            saved = get_practice_by_id(new_id)
            saved_list.append(saved)

        return jsonify({
            "success": True,
            "data": {"similar_problems": saved_list}
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




@error_bp.route('/redo_text', methods=['POST'])
def redo_text():
    data = request.json
    error_id = data.get('id')
    user_answer = (data.get('user_answer') or '').strip()

    if not error_id or not user_answer:
        return jsonify({'success': False, 'error': 'Missing id or answer'}), 400

    try:
        error_id = int(error_id)
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid id format'}), 400

    # 取原题
    error = db_sqlite.get_error_by_id(error_id)
    if not error:
        return jsonify({'success': False, 'error': 'Error not found'}), 404

    question_text = error.get("question_text", "")
    if not question_text.strip():
        return jsonify({'success': False, 'error': '题目为空'}), 400

    # ===== AI 判定逻辑（改用 DeepSeek）=====
    new_answer = user_answer


    try:
        if not DEEPSEEK_API_KEY:
            raise Exception("DEEPSEEK_API_KEY not set")

        prompt = f"""You are a strict middle school teacher. Please judge whether the student's answer is correct.

        Question:
        {question_text}

        Accept simplified answers, such as numerical values or option letters.

        [Requirements]
        1. First, solve the problem completely by yourself to obtain the correct answer.
        2. Compare the student's answer with your correct answer, and use "is_correct" to indicate whether it is correct.
        3. Output only pure JSON:
        {{
            "reason": "Give me the step-by-step derivation process of the correct answer, one point per line",
            "is_correct": true or false
        }}

        Student's submitted answer:
        {user_answer}
        """

        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0  # 更确定性输出
        }

        response = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=20
        )

        if response.status_code != 200:
            raise Exception(f"HTTP {response.status_code}: {response.text}")

        raw_text = response.json()['choices'][0]['message']['content'].strip()

        # 清理可能的 Markdown 包裹
        if raw_text.startswith("```json"):
            raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0]
        elif raw_text.startswith("```"):
            raw_text = raw_text.split("```", 1)[1].split("```", 1)[0]

        parsed = json.loads(raw_text)

        is_correct = bool(parsed.get("is_correct", False))
        ai_reason = str(parsed.get("reason", "")).strip()

    except Exception as e:
        print("DeepSeek AI judge failed:", repr(e))
        is_correct = False
        ai_reason = "AI 判定失败，默认判错"

    # ===== 更新数据库 =====
    db_sqlite.update_error_redo(error_id, new_answer)
    if is_correct:
        db_sqlite.update_error_reviewed(error_id, 1)

    # ===== 返回前端 =====
    return jsonify({
        "success": True,
        "correct": is_correct,
        "new_answer": new_answer,
        "ai_reason": ai_reason
    })

# ===== 文本作答接口 =====
@error_bp.route('/practice/do_text', methods=['POST'])
def do_text_practice():
    data = request.json
    practice_id = data.get("practice_id")
    user_answer_text = (data.get("user_answer_text") or "").strip()
    correct_answer=data.get("correct_answer")

    if not practice_id or not user_answer_text:
        return jsonify({"success": False, "error": "Missing practice_id or answer"}), 400

    try:
        practice_id = int(practice_id)
        practice = db_sqlite.get_practice_by_id(practice_id)
        if not practice:
            return jsonify({"success": False, "error": "Practice question not found"}), 404

        question_text = practice.get("question_text", "").strip()
        if not question_text:
            return jsonify({"success": False, "error": "Original question is empty"}), 400

        # ===== AI 判定 =====
        is_correct, ai_reason = False, ""
        try:
            if not DEEPSEEK_API_KEY:
                raise Exception("DEEPSEEK_API_KEY not set")

            prompt = f"""
You are a middle school teacher. Judge whether the student's answer is correct.
Accept numerical answers without units; slightly imprecise but correct final answers are acceptable.
Question:
{question_text}
correct answer:
{correct_answer}
Student's submitted answer:
{user_answer_text}

Output JSON only:
{{
    "reason": "Step-by-step derivation",
    "is_correct": true or false
}}
"""
            headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
            payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "temperature": 0.0}
            r = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            raw_text = r.json()['choices'][0]['message']['content'].strip()

            # 清理 Markdown
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json", 1)[1].split("```", 1)[0]
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```", 1)[1].split("```", 1)[0]

            parsed = json.loads(raw_text)
            is_correct = bool(parsed.get("is_correct", False))
            ai_reason = str(parsed.get("reason", "")).strip()
            print(ai_reason)
        except Exception as e:
            print("AI judge failed:", repr(e))
            is_correct = False
            ai_reason = "AI 判定失败，默认判错"

        # ===== 更新用户作答 =====
        db_sqlite.update_practice_user_answer(practice_id, user_answer_text)

        return jsonify({
            "success": True,
            "practice_id": practice_id,
            "correct": is_correct,
            "user_answer": user_answer_text,
            "ai_reason": ai_reason
        })

    except Exception as e:
        print(f"do_text_practice failed: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ===== 图片作答接口 =====
@error_bp.route('/practice/do_image', methods=['POST'])
def do_image_practice():
    data = request.json
    practice_id = data.get("practice_id")
    redo_image = data.get("redo_answer", "")

    if not practice_id or not redo_image:
        return jsonify({"success": False, "error": "Missing practice_id or image"}), 400

    try:
        practice_id = int(practice_id)
        practice = db_sqlite.get_practice_by_id(practice_id)
        if not practice:
            return jsonify({"success": False, "error": "Practice question not found"}), 404

        question_text = practice.get("question_text", "").strip()
        correct_answer = practice.get("correct_answer", "")

        temp_dir = "./temp_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{int(time.time()*1000)}.png")

        # 保存 base64 图片
        b64 = redo_image.split(",")[-1]
        with open(temp_path, "wb") as f:
            f.write(base64.b64decode(b64))

        # ===== AI 判定 =====
        new_answer = ""
        is_correct = False
        try:
            prompt = f"""
已知题目如下：
{question_text}

请识别用户上传图片中的答案，并判断是否正确。

输出 JSON:
{{
    "user_answer": "...",
    "is_correct": true 或 false
}}
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

            raw_output = response.output.choices[0].message.content[0]['text']
            parsed = json.loads(clean_json_for_object(raw_output))
            new_answer = parsed.get("user_answer", "").strip()
            is_correct = parsed.get("is_correct", False)
        except Exception as e:
            print("AI judge failed:", e)
            new_answer = ""
            is_correct = False

        # ===== 更新数据库，只保存用户作答 =====
        db_sqlite.update_practice_user_answer(practice_id, new_answer or temp_path)

        return jsonify({
            "success": True,
            "practice_id": practice_id,
            "is_correct": is_correct,
            "user_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("do_image_practice failed:", e)
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass



@error_bp.route('/practice/favorite', methods=['POST'])
def favorite_practice():
    """
    将指定练习记录收藏进错题本
    请求 JSON:
    {
        "practice_id": 123
    }
    """
    data = request.json
    practice_id = data.get("practice_id")
    if not practice_id:
        return jsonify({"success": False, "error": "Missing practice_id"}), 400

    try:
        practice_id = int(practice_id)
        # 获取 practice 记录
        practice = db_sqlite.get_practice_by_id(practice_id)
        if not practice:
            return jsonify({"success": False, "error": "Practice record not found"}), 404

        # 准备插入 error_book 的数据
        error_data = {
            "user_id": practice.get("user_id", 1),
            "subject": practice.get("subject", ""),
            "type": practice.get("type", ""),
            "tags": practice.get("tags") or [],
            "question_text": practice.get("question") or practice.get("question_text", ""),
            "user_answer": practice.get("user_answer", ""),
            "correct_answer": practice.get("correct_answer", ""),
            "analysis_steps": practice.get("analysis_steps") or [],
            "images": [],          # 可以根据需求传 practice 的图片
            "difficulty": practice.get("difficulty", "medium")
        }

        # 插入 error_book
        new_error_id = db_sqlite.insert_error(error_data)
        # 4️⃣ 同步更新 practice 状态字段 ✅✅✅
        db_sqlite.mark_practice_favorited(practice_id)

        return jsonify({"success": True, "error_id": new_error_id})

    except Exception as e:
        print("favorite_practice failed:", e)
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
