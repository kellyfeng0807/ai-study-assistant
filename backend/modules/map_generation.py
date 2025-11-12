"""
Mind Map Generation Module - Enhanced with AI and File Upload
"""

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
import uuid
import sys

# 添加services路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from services.ai_service import ai_service

map_bp = Blueprint('map_generation', __name__, url_prefix='/api/map')

# 配置上传路径
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads', 'mindmaps')
ALLOWED_EXTENSIONS = {'pdf', 'ppt', 'pptx', 'doc', 'docx', 'txt', 'mp3', 'wav', 'mp4', 'm4a'}
DATA_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'data')

# 确保目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_mindmaps():
    """加载所有思维导图数据"""
    mindmaps_file = os.path.join(DATA_FOLDER, 'mindmaps.json')
    if os.path.exists(mindmaps_file):
        with open(mindmaps_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_mindmaps(mindmaps):
    """保存思维导图数据"""
    mindmaps_file = os.path.join(DATA_FOLDER, 'mindmaps.json')
    with open(mindmaps_file, 'w', encoding='utf-8') as f:
        json.dump(mindmaps, f, ensure_ascii=False, indent=2)

def generate_mermaid_from_text(topic, depth=3, context='', style='TD'):
    """
    根据主题和深度生成Mermaid思维导图代码
    使用DeepSeek API
    """
    try:
        mermaid_code = ai_service.generate_mindmap_mermaid(topic, depth, context, style)
        return mermaid_code
    except Exception as e:
        print(f"Error generating mindmap with AI: {e}")
        # 后备方案
        return _generate_fallback_mindmap(topic, depth, style)

def _generate_fallback_mindmap(topic, depth, style='TD'):
    """后备方案：生成基础思维导图"""
    if style == 'radial':
        # 发散型
        mermaid_code = f"""graph TD
    A[{topic}]
    A --> B1[Concept 1]
    A --> B2[Concept 2]
    A --> B3[Concept 3]
    A --> B4[Concept 4]
    """
        if depth >= 2:
            mermaid_code += """    B1 --> C1[Detail 1.1]
    B2 --> C2[Detail 2.1]
    B3 --> C3[Detail 3.1]
    B4 --> C4[Detail 4.1]
    """
    else:
        # 层级型
        graph_dir = style if style in ['TD', 'LR'] else 'TD'
        mermaid_code = f"""graph {graph_dir}
    A[{topic}]
    """
        
        if depth >= 1:
            mermaid_code += """    A --> B1[Core Concept 1]
    A --> B2[Core Concept 2]
    A --> B3[Core Concept 3]
    """
        
        if depth >= 2:
            mermaid_code += """    B1 --> C1[Subtopic 1.1]
    B1 --> C2[Subtopic 1.2]
    B2 --> C3[Subtopic 2.1]
    B2 --> C4[Subtopic 2.2]
    B3 --> C5[Subtopic 3.1]
    """
        
        if depth >= 3:
            mermaid_code += """    C1 --> D1[Detail 1.1.1]
    C2 --> D2[Detail 1.2.1]
    C3 --> D3[Detail 2.1.1]
    """
        
        if depth >= 4:
            mermaid_code += """    D1 --> E1[Example 1]
    D2 --> E2[Example 2]
    """
    
    return mermaid_code.strip()

def extract_text_from_file(filepath):
    """
    从上传的文件中提取文本
    TODO: 实现PDF、Word、PPT的文本提取
    TODO: 实现音频的语音转文字
    """
    ext = filepath.rsplit('.', 1)[1].lower()
    
    if ext == 'txt':
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    
    elif ext in ['pdf']:
        # TODO: 使用PyPDF2或pdfplumber提取PDF文本
        return f"[PDF文件内容提取功能待实现] 文件: {os.path.basename(filepath)}"
    
    elif ext in ['doc', 'docx']:
        # TODO: 使用python-docx提取Word文本
        return f"[Word文件内容提取功能待实现] 文件: {os.path.basename(filepath)}"
    
    elif ext in ['ppt', 'pptx']:
        # TODO: 使用python-pptx提取PPT文本
        return f"[PPT文件内容提取功能待实现] 文件: {os.path.basename(filepath)}"
    
    elif ext in ['mp3', 'wav', 'mp4', 'm4a']:
        # TODO: 使用Whisper或其他语音识别API
        return f"[音频转文字功能待实现] 文件: {os.path.basename(filepath)}"
    
    return ""

@map_bp.route('/generate', methods=['POST'])
def generate_mindmap():
    """生成思维导图"""
    try:
        data = request.json
        topic = data.get('topic', '')
        depth_value = data.get('depth', 3)
        style = data.get('style', 'hierarchical')
        context = data.get('context', '')
        
        if not topic:
            return jsonify({
                'success': False,
                'error': 'Topic is required'
            }), 400
        
        # 处理depth参数（可能是'auto'或数字）
        if depth_value == 'auto':
            depth = 'auto'
        else:
            try:
                depth = int(depth_value)
            except:
                depth = 3
        
        # 生成Mermaid代码
        mermaid_code = generate_mermaid_from_text(topic, depth, context, style)
        
        # 创建思维导图记录
        mindmap_id = str(uuid.uuid4())
        mindmap = {
            'id': mindmap_id,
            'title': topic,
            'mermaid_code': mermaid_code,
            'depth': depth,
            'style': style,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source': 'text_input',
            'context': context[:200] if context else ''
        }
        
        # 保存到数据库
        mindmaps = load_mindmaps()
        mindmaps.insert(0, mindmap)  # 最新的在前面
        save_mindmaps(mindmaps)
        
        return jsonify({
            'success': True,
            'mindmap': mindmap,
            'mermaid_code': mermaid_code
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/upload', methods=['POST'])
def upload_file_for_mindmap():
    """上传文件并生成思维导图"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file uploaded'
            }), 400
        
        file = request.files['file']
        topic = request.form.get('topic', '')
        depth_value = request.form.get('depth', 3)
        
        # 处理depth参数（可能是'auto'或数字）
        if depth_value == 'auto':
            depth = 'auto'
        else:
            try:
                depth = int(depth_value)
            except:
                depth = 3
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # 保存文件
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(filepath)
        
        # 提取文件内容
        file_content = extract_text_from_file(filepath)
        
        # 结合文件内容和用户输入生成思维导图（使用AI）
        style = 'TD'  # 文件上传默认使用top-down样式
        try:
            if file_content and not file_content.startswith('['):
                # 如果成功提取了文本，使用AI基于内容生成
                mermaid_code = ai_service.generate_mindmap_from_content(
                    topic or filename, 
                    file_content, 
                    depth,
                    style
                )
            else:
                # 如果是待实现的文件类型，使用基于主题的生成
                mermaid_code = ai_service.generate_mindmap_mermaid(
                    topic or filename,
                    depth,
                    file_content,
                    style
                )
        except Exception as e:
            print(f"Error generating mindmap from file: {e}")
            context = f"File: {filename}\nUser input: {topic}"
            mermaid_code = generate_mermaid_from_text(topic or filename, depth, context, style)
        
        # 创建思维导图记录
        mindmap_id = str(uuid.uuid4())
        mindmap = {
            'id': mindmap_id,
            'title': topic or filename.rsplit('.', 1)[0],
            'mermaid_code': mermaid_code,
            'depth': depth,
            'style': 'hierarchical',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source': 'file_upload',
            'source_file': unique_filename,
            'file_type': filename.rsplit('.', 1)[1].lower(),
            'context': file_content[:200]
        }
        
        # 保存到数据库
        mindmaps = load_mindmaps()
        mindmaps.insert(0, mindmap)
        save_mindmaps(mindmaps)
        
        return jsonify({
            'success': True,
            'mindmap': mindmap,
            'mermaid_code': mermaid_code,
            'file_content_preview': file_content[:200]
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/list', methods=['GET'])
def list_mindmaps():
    """获取所有思维导图列表"""
    try:
        mindmaps = load_mindmaps()
        return jsonify({
            'success': True,
            'mindmaps': mindmaps,
            'total': len(mindmaps)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/<map_id>', methods=['GET'])
def get_mindmap(map_id):
    """获取特定思维导图"""
    try:
        mindmaps = load_mindmaps()
        mindmap = next((m for m in mindmaps if m['id'] == map_id), None)
        
        if not mindmap:
            return jsonify({
                'success': False,
                'error': 'Mind map not found'
            }), 404
        
        return jsonify({
            'success': True,
            'mindmap': mindmap
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/<map_id>', methods=['PUT'])
def update_mindmap(map_id):
    """更新思维导图（用户手动编辑）"""
    try:
        data = request.json
        mindmaps = load_mindmaps()
        
        mindmap_index = next((i for i, m in enumerate(mindmaps) if m['id'] == map_id), None)
        
        if mindmap_index is None:
            return jsonify({
                'success': False,
                'error': 'Mind map not found'
            }), 404
        
        # 更新思维导图
        mindmaps[mindmap_index]['mermaid_code'] = data.get('mermaid_code', mindmaps[mindmap_index]['mermaid_code'])
        mindmaps[mindmap_index]['title'] = data.get('title', mindmaps[mindmap_index]['title'])
        mindmaps[mindmap_index]['updated_at'] = datetime.now().isoformat()
        
        save_mindmaps(mindmaps)
        
        return jsonify({
            'success': True,
            'mindmap': mindmaps[mindmap_index]
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/<map_id>', methods=['DELETE'])
def delete_mindmap(map_id):
    """删除思维导图"""
    try:
        mindmaps = load_mindmaps()
        mindmaps = [m for m in mindmaps if m['id'] != map_id]
        save_mindmaps(mindmaps)
        
        return jsonify({
            'success': True,
            'message': 'Mind map deleted'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/export', methods=['POST'])
def export_mindmap():
    """导出思维导图为PNG或SVG"""
    try:
        data = request.json
        map_id = data.get('map_id')
        export_format = data.get('format', 'png')
        
        mindmaps = load_mindmaps()
        mindmap = next((m for m in mindmaps if m['id'] == map_id), None)
        
        if not mindmap:
            return jsonify({
                'success': False,
                'error': 'Mind map not found'
            }), 404
        
        # TODO: 实现Mermaid到图片的转换
        # 可以使用mermaid-cli或puppeteer
        
        return jsonify({
            'success': True,
            'message': 'Export feature coming soon',
            'mermaid_code': mindmap['mermaid_code']
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
