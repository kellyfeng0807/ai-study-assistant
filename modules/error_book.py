"""
Error Book Manager Module
错题本管理模块
上传/拍照题目 → OCR识别 → 自动分类 → 生成复习计划
"""

from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import json
import re
import time
import os
import traceback
import sys
import base64
from datetime import datetime

import cv2
import numpy as np

# 导入共享模块
import db_sqlite
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from services.ai_service import ai_service
import os
from dotenv import load_dotenv
load_dotenv()

# ===== 配置 =====
error_bp = Blueprint('error_book', __name__, url_prefix='/api/error')

# 文件上传配置 - 所有文件（包括临时文件）都存在这里
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads', 'error-book')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 初始化数据库
db_sqlite.init_db()

# Debug: Print database info on module load
print(f"[ERROR_BOOK_INIT] db_sqlite.DB_PATH: {db_sqlite.DB_PATH}", file=sys.stderr)
print(f"[ERROR_BOOK_INIT] DB file exists: {os.path.exists(db_sqlite.DB_PATH)}", file=sys.stderr)


# ===== 工具函数 =====

def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def crop_images_from_image(input_path, output_dir):
    """
    裁剪图片中的图片块，保存到 output_dir，并返回每块图片的路径和坐标
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 使用 numpy 读取支持中文路径的图片
    try:
        with open(input_path, 'rb') as f:
            img_data = np.frombuffer(f.read(), np.uint8)
        img = cv2.imdecode(img_data, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"无法解码图片: {input_path}")
    except Exception as e:
        raise ValueError(f"无法读取图片: {input_path}, 错误: {str(e)}")

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
            
            # 使用 numpy 保存支持中文路径
            try:
                success, encoded_img = cv2.imencode('.png', cropped)
                if not success:
                    continue
                    
                with open(save_path, 'wb') as f:
                    f.write(encoded_img.tobytes())
                    
            except Exception as e:
                print(f"保存裁剪图片失败: {save_path}, 错误: {str(e)}")
                continue

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


def fix_latex_for_frontend(text):
    # 把公式里的 \\ 恢复成 \，保证 KaTeX/MathJax 渲染
    def repl(match):
        formula = match.group(0)
        formula = formula.replace('\\\\', '\\')
        return formula

    text = re.sub(r'\$.*?\$', repl, text, flags=re.DOTALL)
    text = re.sub(r'\$\$.*?\$\$', repl, text, flags=re.DOTALL)

    return text


# ===== 路由：上传错题图片 =====
@error_bp.route('/upload', methods=['POST'])
def upload_question():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    if not allowed_file(uploaded_file.filename):
        return jsonify({'success': False, 'error': 'Invalid file type. Only images allowed.'}), 400

    # 保存原图（使用安全文件名和时间戳）
    filename = secure_filename(uploaded_file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    unique_filename = f"{timestamp}_{filename}"
    orig_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    uploaded_file.save(orig_path)

    try:
        # 获取原图的相对路径
        orig_rel_path = os.path.relpath(orig_path, start=os.getcwd()).replace("\\", "/")
        if not orig_rel_path.startswith("/"):
            orig_rel_path = "/" + orig_rel_path

        # 裁剪图片
        cropped_results = crop_images_from_image(orig_path, output_dir=UPLOAD_FOLDER)

        cropped_results = sort_bboxes_reading_order(cropped_results, y_tolerance=15)
        # 为每张裁剪图添加索引和路径
        for idx, crop in enumerate(cropped_results):
            crop['index'] = idx
            crop['abs_path'] = os.path.abspath(crop['path'])
            crop['rel_path'] = os.path.relpath(crop['path'], start=os.getcwd())

        # 使用 AI 服务进行 OCR 识别和解析
        parsed_list = ai_service.ocr_and_parse_question(orig_path, cropped_results)

        # 在保存到数据库前，处理公式
        for parsed in parsed_list:
            parsed['question_text'] = fix_latex_for_frontend(parsed['question_text'])
            parsed["correct_answer"] = fix_latex_for_frontend(parsed["correct_answer"])
            parsed['analysis_steps'] = [fix_latex_for_frontend(step) for step in parsed.get('analysis_steps', [])]

            # 添加原图相对路径到 answer_images
            parsed['answer_images'] = [orig_rel_path]

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
            'error': str(e)
        }), 500
'''
    finally:
        # 无论成功或失败，都删除原始上传文件（保留裁剪后的图片）
        try:
            if os.path.exists(orig_path):
                os.remove(orig_path)
                print(f"Removed original upload in finally: {orig_path}")
        except Exception as e:
            print(f"Failed to remove original upload in finally: {e}")
'''
"""
@error_bp.route('/upload', methods=['POST'])
def upload_question():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    if not allowed_file(uploaded_file.filename):
        return jsonify({'success': False, 'error': 'Invalid file type. Only images allowed.'}), 400

    # 保存原图（使用安全文件名和时间戳）
    filename = secure_filename(uploaded_file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    unique_filename = f"{timestamp}_{filename}"
    orig_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    uploaded_file.save(orig_path)

    try:
        # 裁剪图片
        cropped_results = crop_images_from_image(orig_path, output_dir=UPLOAD_FOLDER)

        cropped_results = sort_bboxes_reading_order(cropped_results, y_tolerance=15)
        # 为每张裁剪图添加索引和路径
        for idx, crop in enumerate(cropped_results):
            crop['index'] = idx
            crop['abs_path'] = os.path.abspath(crop['path'])
            crop['rel_path'] = os.path.relpath(crop['path'], start=os.getcwd())

        # 使用 AI 服务进行 OCR 识别和解析
        parsed_list = ai_service.ocr_and_parse_question(orig_path, cropped_results)

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
            'error': str(e)
        }), 500

    finally:
        # 无论成功或失败，都删除原始上传文件（保留裁剪后的图片）
        try:
            if os.path.exists(orig_path):
                os.remove(orig_path)
                print(f"Removed original upload in finally: {orig_path}")
        except Exception as e:
            print(f"Failed to remove original upload in finally: {e}")
"""

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
# ===== 路由：重做错题 =====
@error_bp.route('/redo', methods=['POST'])
def redo_error():
    data = request.json
    error_id = data.get('id')
    redo_image = data.get("redo_answer", "")

    if not error_id:
        return jsonify({'success': False, 'error': 'Missing id'}), 400

    if not redo_image:
        return jsonify({"success": False, "error": "Missing image"}), 400

    # 保存用户上传的原图（这次要保留，不删！）
    timestamp = int(time.time() * 1000)
    filename = f"redo_{timestamp}.png"
    saved_image_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        b64 = redo_image.split(",")[-1]
        with open(saved_image_path, "wb") as f:
            f.write(base64.b64decode(b64))
    except Exception as e:
        return jsonify({"success": False, "error": f"Invalid image data: {str(e)}"}), 400

    try:
        error = db_sqlite.get_error_by_id(int(error_id))
        if not error:
            return jsonify({"success": False, "error": "Error record not found"}), 404

        question_text = error.get("question_text", "")
        correct_answer = error.get("correct_answer", "")
        if not question_text.strip():
            return jsonify({"success": False, "error": "empty"}), 400

        # ===== 不再裁剪！直接使用原图路径 =====
        rel_path = os.path.relpath(saved_image_path, start=os.getcwd()).replace("\\", "/")
        if not rel_path.startswith("/"):
            rel_path = "/" + rel_path
        redo_images_paths = [rel_path]  # 单图数组

        # 使用 AI 服务判断重做答案（传原图路径）
        result = ai_service.judge_redo_answer_with_image(question_text, correct_answer, saved_image_path)
        new_answer = result['user_answer']
        is_correct = result['is_correct']

        # 更新数据库：存 new_answer + redo_images=[原图路径]
        success = db_sqlite.update_error_redo(
            int(error_id),
            new_answer,
            redo_images=redo_images_paths
        )

        if not success:
            return jsonify({"success": False, "error": "Database update failed"}), 500

        if is_correct:
            db_sqlite.update_error_reviewed(int(error_id), 1)

        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "new_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("Redo failed:", e)
        traceback.print_exc()
        # 出错时删除已保存的图（可选）
        try:
            if os.path.exists(saved_image_path):
                os.remove(saved_image_path)
        except OSError:
            pass
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    # 注意：成功时不删 saved_image_path！因为要留着给前端访问
    # 所以 finally 里不再删除

"""
# ===== 路由：重做错题 =====
@error_bp.route('/redo', methods=['POST'])
def redo_error():
    data = request.json
    error_id = data.get('id')
    redo_image = data.get("redo_answer", "")

    if not error_id:
        return jsonify({'success': False, 'error': 'Missing id'}), 400

    if not redo_image:
        return jsonify({"success": False, "error": "Missing image"}), 400

    # 保存临时原图（用于裁剪）
    temp_orig_path = os.path.join(UPLOAD_FOLDER, f"redo_temp_{int(time.time() * 1000)}.png")

    try:
        b64 = redo_image.split(",")[-1]
        with open(temp_orig_path, "wb") as f:
            f.write(base64.b64decode(b64))
    except Exception as e:
        return jsonify({"success": False, "error": f"Invalid image data: {str(e)}"}), 400

    try:
        error = db_sqlite.get_error_by_id(int(error_id))
        if not error:
            return jsonify({"success": False, "error": "Error record not found"}), 404

        question_text = error.get("question_text", "")
        correct_answer = error.get("correct_answer", "")
        if not question_text.strip():
            return jsonify({"success": False, "error": "empty"}), 400

        # ===== 完全复用 /upload 的裁剪逻辑 =====
        cropped_results = crop_images_from_image(temp_orig_path, output_dir=UPLOAD_FOLDER)
        cropped_results = sort_bboxes_reading_order(cropped_results, y_tolerance=15)

        # 构建 redo_images 路径列表（和 /upload 一致）
        redo_images_paths = []
        for idx, crop in enumerate(cropped_results):
            rel_path = os.path.relpath(crop['path'], start=os.getcwd()).replace("\\", "/")
            if not rel_path.startswith("/"):
                rel_path = "/" + rel_path
            redo_images_paths.append(rel_path)

        # 使用 AI 服务判断重做答案（保持原逻辑）
        result = ai_service.judge_redo_answer_with_image(question_text, correct_answer, temp_orig_path)
        new_answer = result['user_answer']
        is_correct = result['is_correct']

        # ===== 关键：传 redo_images_paths（路径列表，不是 base64）=====
        success = db_sqlite.update_error_redo(
            int(error_id),
            new_answer,
            redo_images=redo_images_paths  # 👈 和 /upload 的 images 格式完全一致
        )

        if not success:
            return jsonify({"success": False, "error": "Database update failed"}), 500

        if is_correct:
            db_sqlite.update_error_reviewed(int(error_id), 1)

        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "new_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("Redo failed:", e)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        # 删除临时原图（裁剪图保留！和 /upload 行为一致）
        try:
            if os.path.exists(temp_orig_path):
                os.remove(temp_orig_path)
        except OSError:
            pass
"""
"""
@error_bp.route('/redo', methods=['POST'])
def redo_error():
    data = request.json
    error_id = data.get('id')
    redo_image = data.get("redo_answer", "")
    
    if not error_id:
        return jsonify({'success': False, 'error': 'Missing id'}), 400
    
    if not redo_image:
        return jsonify({"success": False, "error": "Missing image"}), 400
    
    # 保存临时图片（用完就删）
    temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{int(time.time()*1000)}.png")

    try:
        b64 = redo_image.split(",")[-1]
        with open(temp_path, "wb") as f:
            f.write(base64.b64decode(b64))
    except Exception as e:
        return jsonify({"success": False, "error": f"Invalid image data: {str(e)}"}), 400
        
    try:
        
        error = db_sqlite.get_error_by_id(int(error_id))
        if not error:
            return jsonify({"success": False, "error": "Error record not found"}), 404

       
        question_text = error.get("question_text", "")
        correct_answer = error.get("correct_answer", "")
        if not question_text.strip():
            return jsonify({"success": False, "error": "empty"}), 400



        # 使用 AI 服务判断重做答案
        result = ai_service.judge_redo_answer_with_image(question_text, correct_answer, temp_path)
        new_answer = result['user_answer']
        is_correct = result['is_correct']

        # 通过 db_sqlite 更新 redo 结果
        success = db_sqlite.update_error_redo(int(error_id), new_answer)

        if not success:
            return jsonify({"success": False, "error": "Database update failed"}), 500

        # 如果 AI 判断正确，标记 reviewed=1
        if is_correct:
            db_sqlite.update_error_reviewed(int(error_id), 1)  

        return jsonify({
            "success": True,
            "is_correct": is_correct,
            "new_answer": new_answer,
            "correct_answer": correct_answer
        })

    except Exception as e:
        print("Redo failed:", e)
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
"""
# ===== 路由：生成相似练习题 =====
@error_bp.route('/practice/generate-similar', methods=['POST'])
def generate_similar_exercises():
    data = request.json
    error_id = data.get("id")
    question_text = data.get("question_text", "").strip()
    count = int(data.get("count", 3))
    force = data.get("force", False) 
    
    if not error_id:
        return jsonify({'success': False, 'error': 'Missing error_id'}), 400

    if not question_text:
        return jsonify({"success": False, "error": "Missing question_text"}), 400
    count = max(1, min(count, 5))  # 限制 1~5 题

    try:
        # ===== 先查询数据库是否已有对应练习题 =====
        existing_practice = db_sqlite.list_practice_by_error_id(error_id=error_id)
        if existing_practice and len(existing_practice) >= count and not force:
            print(f"Found existing {len(existing_practice)} practice questions for error_id={error_id}")
            return jsonify({
                "success": True,
                "data": {"similar_problems": existing_practice[:count]}
            })

        # ===== 获取学生的 grade 信息 =====
        grade = None
        try:
            error_record = db_sqlite.get_error_by_id(error_id)
            if error_record and error_record.get('user_id'):
                user_settings = db_sqlite.get_user_settings(error_record['user_id'])
                if user_settings and user_settings.get('success'):
                    grade = user_settings.get('grade')
                    print(f"Found user grade: {grade} for user_id={error_record['user_id']}")
        except Exception as e:
            print(f"Failed to fetch user grade: {e}")
            # Continue without grade (graceful degradation)

        

        # 使用 AI 服务生成相似题目（传入 grade 信息）
        similar_list = ai_service.generate_similar_questions(question_text, count, grade=grade)

        # 统一处理 LaTeX，保证前端可渲染
        for q in similar_list:
            q['question_text'] = fix_latex_for_frontend(q.get('question_text', ''))
            q["correct_answer"] = fix_latex_for_frontend(q.get("correct_answer", ''))
            q['analysis_steps'] = [fix_latex_for_frontend(step) for step in q.get('analysis_steps', [])]

        # ===== 存入数据库 =====
        saved_list = []
        for parsed in similar_list:
            parsed["error_id"] = error_id
            new_id = db_sqlite.insert_practice(parsed)
            saved = db_sqlite.get_practice_by_id(new_id)
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
            "error": str(e)
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
        return jsonify({'success': False, 'error': 'empty'}), 400

    # 使用 AI 服务判定答案
    try:
        correct_answer = error.get("correct_answer", "")
        result = ai_service.judge_text_answer(
            question_text=question_text,
            user_answer=user_answer,
            correct_answer=correct_answer
        )
        is_correct = result['is_correct']
        ai_reason = result['reason']
    except Exception as e:
        print(f"AI judge failed: {e}")
        traceback.print_exc()
        is_correct = False
        ai_reason = "AI 判定失败，默认判错"

    # ===== 更新数据库 =====
    db_sqlite.update_error_redo(error_id, user_answer, redo_images=[])
    if is_correct:
        db_sqlite.update_error_reviewed(error_id, 1)

    # ===== 返回前端 =====
    return jsonify({
        "success": True,
        "correct": is_correct,
        "new_answer": user_answer,
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

        # 使用 AI 服务判定
        try:
            result = ai_service.judge_text_answer(
                question_text=question_text,
                user_answer=user_answer_text,
                correct_answer=correct_answer
            )
            is_correct = result['is_correct']
            ai_reason = result['reason']
        except Exception as e:
            print(f"AI judge failed: {e}")
            traceback.print_exc()
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
from flask import request, jsonify
import os
import base64
import time
import traceback

# 假设这是你的蓝图定义

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

        # 使用与redo_error相同的命名策略生成唯一的图片名
        timestamp = int(time.time() * 1000)
        filename = f"redo_{timestamp}.png"
        saved_image_path = os.path.join(UPLOAD_FOLDER, filename)

        # 解码并保存用户作答图片
        b64 = redo_image.split(",")[-1]
        with open(saved_image_path, "wb") as f:
            f.write(base64.b64decode(b64))

        # 获取相对路径
        rel_path = os.path.relpath(saved_image_path, start=os.getcwd()).replace("\\", "/")
        if not rel_path.startswith("/"):
            rel_path = "/" + rel_path

        # AI判定逻辑
        try:
            result = ai_service.judge_practice_answer_with_image(question_text, correct_answer, saved_image_path)
            new_answer = result['user_answer']
            is_correct = result['is_correct']
        except Exception as e:
            print("AI judge failed:", e)
            new_answer = ""
            is_correct = False

        # 更新数据库，保存用户作答和图片路径
        practice_images = [rel_path]  # 假设仅保存一个图片路径
        db_sqlite.update_practice_user_answer(practice_id, new_answer, practice_images)

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

    # 注意：这里没有删除图片的逻辑，因为现在我们使用的是"redo_"前缀，并且可能需要保留这些图片
'''
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

        # 保存临时图片（用完就删）
        temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{int(time.time()*1000)}.png")
        b64 = redo_image.split(",")[-1]
        with open(temp_path, "wb") as f:
            f.write(base64.b64decode(b64))

        # ===== AI 判定 =====
        try:
            result = ai_service.judge_practice_answer_with_image(question_text, correct_answer, temp_path)
            new_answer = result['user_answer']
            is_correct = result['is_correct']
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
'''


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
            "answer_images": practice.get("practice_images") or [],          # 可以根据需求传 practice 的图片
            "difficulty": practice.get("difficulty", "medium"),
            "source_practice_id": practice_id
        }

        # 插入 error_book
        new_error_id = db_sqlite.insert_error(error_data)
        # 同步更新 practice 状态字段 
        db_sqlite.mark_practice_favorited(practice_id)

        return jsonify({"success": True, "error_id": new_error_id})

    except Exception as e:
        print("favorite_practice failed:", e)
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500