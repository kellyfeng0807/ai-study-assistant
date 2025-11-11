"""
Error Book Manager Module
错题本管理模块
上传/拍照题目 → OCR识别 → 自动分类 → 生成复习计划
"""

from flask import Blueprint, request, jsonify

error_bp = Blueprint('error_book', __name__, url_prefix='/api/errorbook')

@error_bp.route('/upload', methods=['POST'])
def upload_question():
    """
    上传或拍照错题
    使用OCR识别文字
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    image = request.files['image']
    
    # TODO: 集成OCR API (Azure Vision, Tesseract, etc.)
    
    return jsonify({
        'success': True,
        'question': {
            'id': 1,
            'text': '识别出的题目文字...',
            'subject': 'Mathematics',
            'difficulty': 'Medium'
        }
    })

@error_bp.route('/categorize', methods=['POST'])
def categorize_question():
    """
    使用LLM自动分类错题
    """
    data = request.json
    question_text = data.get('text', '')
    
    # TODO: 使用LLM分析题目类型和知识点
    
    return jsonify({
        'success': True,
        'category': {
            'subject': 'Mathematics',
            'topic': 'Algebra',
            'difficulty': 'Medium',
            'tags': ['equations', 'linear algebra']
        }
    })

@error_bp.route('/generate-exercises', methods=['POST'])
def generate_exercises():
    """
    基于错题生成相似练习题
    """
    data = request.json
    question_id = data.get('question_id')
    
    # TODO: 使用LLM生成相似题目
    
    return jsonify({
        'success': True,
        'exercises': [
            {
                'id': 101,
                'text': '练习题1...',
                'difficulty': 'Medium'
            },
            {
                'id': 102,
                'text': '练习题2...',
                'difficulty': 'Hard'
            }
        ]
    })

@error_bp.route('/list', methods=['GET'])
def list_errors():
    """获取错题列表"""
    subject = request.args.get('subject', '')
    
    return jsonify({
        'success': True,
        'errors': [
            {
                'id': 1,
                'text': '错题内容...',
                'subject': 'Mathematics',
                'date': '2025-11-10',
                'reviewed': False
            }
        ],
        'total': 1
    })
