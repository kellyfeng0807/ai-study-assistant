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
import db_sqlite

# 添加services路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from services.ai_service import ai_service


map_bp = Blueprint('map_generation', __name__, url_prefix='/api/map')

# Debug: Print database info on module load
print(f"[MAP_INIT] db_sqlite.DB_PATH: {db_sqlite.DB_PATH}", file=sys.stderr)
print(f"[MAP_INIT] DB file exists: {os.path.exists(db_sqlite.DB_PATH)}", file=sys.stderr)

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
    return db_sqlite.get_all_mindmaps()

def save_mindmaps(mindmaps):
    """保存思维导图数据"""
    for mindmap in mindmaps:
        db_sqlite.update_mindmap(mindmap)

def ensure_unique_title(title, existing_mindmaps):
    """
    确保标题唯一性
    如果标题已存在，添加时间戳或编号
    """
    # 检查标题是否已存在
    existing_titles = [m['title'] for m in existing_mindmaps]
    
    if title not in existing_titles:
        return title
    
    # 标题已存在，添加时间戳
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    new_title = f"{title} ({timestamp})"
    
    # 如果带时间戳的标题仍然存在（极少情况），添加编号
    if new_title in existing_titles:
        counter = 1
        while f"{title} ({timestamp}_{counter})" in existing_titles:
            counter += 1
        new_title = f"{title} ({timestamp}_{counter})"
    
    return new_title

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
        
        # 确保标题唯一
        mindmaps = load_mindmaps()
        unique_title = ensure_unique_title(topic, mindmaps)
        
        mindmap_id = str(uuid.uuid4())
        mindmap = {
            'id': mindmap_id,
            'title': unique_title,
            'mermaid_code': mermaid_code,
            'depth': depth,
            'style': style,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source': 'text_input',
            'context': context[:200] if context else '',
            'node_positions': '{}'
        }
        
        mindmaps.insert(0, mindmap)
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
    """上传文件并生成思维导图 - 支持多文件"""
    try:
        # Check for multiple files
        files = request.files.getlist('files')
        
        # Fallback to single file for backward compatibility
        if not files:
            if 'file' not in request.files:
                return jsonify({
                    'success': False,
                    'error': 'No file uploaded'
                }), 400
            files = [request.files['file']]
        
        topic = request.form.get('topic', '')
        context = request.form.get('context', '')
        depth_value = request.form.get('depth', 3)
        style = request.form.get('style', 'TD')
        
        # 处理depth参数（可能是'auto'或数字）
        if depth_value == 'auto':
            depth = 'auto'
        else:
            try:
                depth = int(depth_value)
            except:
                depth = 3
        
        # Validate all files
        for file in files:
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'One or more files have no name'
                }), 400
            
            if not allowed_file(file.filename):
                return jsonify({
                    'success': False,
                    'error': f'File type not allowed for {file.filename}. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
                }), 400
        
        # Process all files and extract content
        all_file_contents = []
        saved_files = []
        
        for file in files:
            # 保存文件
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
            file.save(filepath)
            saved_files.append((filepath, filename))
            
            # 提取文件内容
            file_content = extract_text_from_file(filepath)
            if file_content and not file_content.startswith('['):
                all_file_contents.append(f"=== {filename} ===\n{file_content}")
            else:
                all_file_contents.append(f"=== {filename} ===\n{file_content or '[Content extraction not yet implemented]'}")
        
        # Combine all file contents
        combined_file_content = "\n\n".join(all_file_contents)
        
        # 结合文件内容、用户输入和context生成思维导图
        try:
            # 将用户的context添加到文件内容中
            full_context = combined_file_content
            if context:
                full_context = f"{context}\n\nFiles content:\n{combined_file_content}"
            
            # Use first filename or user topic
            main_topic = topic or (files[0].filename if len(files) == 1 else f"{len(files)} Files Analysis")
            
            mermaid_code = ai_service.generate_mindmap_from_content(
                main_topic, 
                full_context, 
                depth,
                style
            )
        except Exception as e:
            print(f"Error generating mindmap from files: {e}")
            combined_context = f"Files: {', '.join([f[1] for f in saved_files])}"
            if topic:
                combined_context += f"\nTopic: {topic}"
            if context:
                combined_context += f"\nContext: {context}"
            mermaid_code = generate_mermaid_from_text(topic or main_topic, depth, combined_context, style)
        
        # 创建思维导图记录
        mindmap_id = str(uuid.uuid4())
        
        # Get main file info
        first_filename = saved_files[0][1] if saved_files else 'unknown'
        file_type = first_filename.rsplit('.', 1)[1].lower() if '.' in first_filename else 'unknown'
        
        # Store filenames for multi-file case
        if len(saved_files) > 1:
            source_file = f"{len(saved_files)} files: " + ", ".join([f[1] for f in saved_files])
        else:
            source_file = saved_files[0][0].split(os.sep)[-1] if saved_files else 'unknown'
        
        # Determine title
        base_title = topic or (first_filename.rsplit('.', 1)[0] if len(saved_files) == 1 else f"{len(saved_files)} Files Analysis")
        
        # 确保标题唯一
        mindmaps = load_mindmaps()
        unique_title = ensure_unique_title(base_title, mindmaps)
        
        mindmap = {
            'id': mindmap_id,
            'title': unique_title,
            'mermaid_code': mermaid_code,
            'depth': depth,
            'style': style,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source': 'file_upload',
            'source_file': source_file,
            'file_type': file_type,
            'context': (context or combined_file_content)[:200],
            'node_positions': '{}'
        }
        
        mindmaps.insert(0, mindmap)
        save_mindmaps(mindmaps)
        
        # Clean up uploaded files
        for filepath, _ in saved_files:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as e:
                print(f"Error deleting file {filepath}: {e}")
        
        return jsonify({
            'success': True,
            'mindmap': mindmap,
            'mermaid_code': mermaid_code,
            'file_content_preview': combined_file_content[:200]
        })
    
    except Exception as e:
        # Clean up any uploaded files in case of error
        if 'saved_files' in locals():
            for filepath, _ in saved_files:
                try:
                    if os.path.exists(filepath):
                        os.remove(filepath)
                except:
                    pass
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@map_bp.route('/list', methods=['GET'])
def list_mindmaps():
    """获取所有思维导图列表"""
    try:
        mindmaps = db_sqlite.get_all_mindmaps()
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


@map_bp.route('/generate-from-notes', methods=['POST'])
def generate_from_notes():
    """Generate mind map from selected note IDs"""
    try:
        data = request.get_json() or {}
        note_ids = data.get('note_ids', [])
        if not note_ids:
            return jsonify({'success': False, 'error': 'note_ids required'}), 400

        # Get optional parameters from request
        topic = data.get('topic', '').strip() or 'Selected Notes'
        context = data.get('context', '').strip()
        depth_input = data.get('depth', '3')
        style = data.get('style', 'TD')

        # Parse depth
        if isinstance(depth_input, str):
            if depth_input.lower() == 'auto':
                depth = 'auto'
            else:
                try:
                    depth = int(depth_input)
                except ValueError:
                    depth = 3
        else:
            depth = depth_input if depth_input else 3

        # Load notes data from DB
        notes = []
        for nid in note_ids:
            n = db_sqlite.get_note_by_id(nid)
            if n:
                notes.append(n)

        # Collect contents of selected notes
        selected_texts = []
        for nid in note_ids:
            note = next((n for n in notes if str(n.get('id')) == str(nid)), None)
            if note:
                # access 'content' dict: note['content']['summary'] & note['content']['key_points']
                content = note.get('content', {})
                content_parts = []
                if content.get('summary'):
                    content_parts.append(content.get('summary'))
                if content.get('key_points'):
                    content_parts.append('\n'.join(content.get('key_points')))
                if content_parts:
                    selected_texts.append('\n'.join(content_parts))

        if not selected_texts:
            return jsonify({'success': False, 'error': 'No note content found for provided ids'}), 400

        combined_content = '\n\n'.join(selected_texts)
        
        # Add user context if provided
        if context:
            combined_content = f"{context}\n\n{combined_content}"

        # Use AI service to generate mermaid from combined note content
        try:
            mermaid_code = ai_service.generate_mindmap_from_content(
                topic, combined_content, depth, style
            )
        except Exception as e:
            print('AI service error while generating from notes:', e)
            mermaid_code = generate_mermaid_from_text(topic, depth if depth != 'auto' else 3, combined_content, style)

        # 确保标题唯一
        mindmaps = load_mindmaps()
        unique_title = ensure_unique_title(topic, mindmaps)
        
        mindmap_id = str(uuid.uuid4())
        mindmap = {
            'id': mindmap_id,
            'title': unique_title,
            'mermaid_code': mermaid_code,
            'depth': depth,
            'style': style,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source': 'notes_selection',
            'context': combined_content[:200],
            'node_positions': '{}'
        }

        db_sqlite.insert_mindmap(mindmap)

        return jsonify({'success': True, 'mindmap': mindmap, 'mermaid_code': mermaid_code})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@map_bp.route('/<map_id>', methods=['GET'])
def get_mindmap(map_id):
    """获取特定思维导图"""
    try:
        mindmap = db_sqlite.get_mindmap_by_id(map_id)
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
        updated_mindmap = {
            'id': map_id,
            'title': data.get('title'),
            'mermaid_code': data.get('mermaid_code'),
            'updated_at': datetime.now().isoformat(),
            'node_positions': data.get('node_positions', '{}')
        }
        db_sqlite.update_mindmap(updated_mindmap)
        return jsonify({
            'success': True,
            'mindmap': updated_mindmap
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
        db_sqlite.delete_mindmap(map_id)
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