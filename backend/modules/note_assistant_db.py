"""Clean, minimal note assistant module using local sqlite via db_sqlite.
This is a safe replacement for the previously corrupted `note_assistant.py`.
"""

from flask import Blueprint, request, jsonify
import os
import json
import tempfile
import traceback
from datetime import datetime
import requests
import db_sqlite
from werkzeug.utils import secure_filename

import logging



bp = Blueprint('note_assistant', __name__, url_prefix='/api/note')

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
BAIDU_APP_ID = '7227061'
BAIDU_API_KEY = 'MuZYealXv5pwVZsK3tFkWTwe'
BAIDU_SECRET_KEY = 'zdAvuWkk4aLtefGiILuQb35gcqK7fvz7'
baidu_client = None

ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'pcm', 'webm', 'm4a', 'ogg'}

db_sqlite.init_db()

# Added debug logging to trace execution flow
logging.basicConfig(level=logging.DEBUG)

def allowed_audio_file(filename):
    """Check if the audio file format is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_AUDIO_EXTENSIONS


def _fallback_notes(text, subject):
    sentences = [s.strip() for s in text.split('。') if s.strip()]
    key_points = sentences[:min(3, len(sentences))]
    title = sentences[0][:15] + "..." if sentences else "note"
    summary = text[:100] + "..." if len(text) > 100 else text

    fallback_notes = {
        'title': title,
        'subject': subject,
        'key_points': key_points,
        'examples': [],
        'summary': summary,
        'tags': [subject, 'study note']
    }
    return fallback_notes


def get_baidu_client():
    """Get Baidu Speech Recognition client."""
    global baidu_client
    if baidu_client is None:
        try:
            from aip import AipSpeech
            baidu_client = AipSpeech(BAIDU_APP_ID, BAIDU_API_KEY, BAIDU_SECRET_KEY)
        except ImportError:
            print("Please install Baidu SDK: pip install baidu-aip")
            return None
        except Exception as e:
            print(f"Failed to initialize Baidu client: {e}")
            return None
    return baidu_client


@bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    
    try:
        logging.debug("start transcribing audio")
        
        # 获取百度客户端
        client = get_baidu_client()
        if not client:
            return jsonify({
                'success': False,
                'error': 'baidu SDK uninstall, run: pip install baidu-aip chardet'
            }), 503
        
        # 检查文件
        if 'audio' not in request.files:
            logging.error("no audio file uploaded")
            return jsonify({
                'success': False,
                'error': 'no audio file uploaded'
            }), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            logging.error("file name is empty")
            return jsonify({
                'success': False,
                'error': 'file name is empty'
            }), 400
        
        # 保存临时文件
        filename = secure_filename(audio_file.filename)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        audio_file.save(temp_path)
        
        file_size = os.path.getsize(temp_path)
        logging.debug(f'audio file saved: {temp_path}, file size: {file_size} bytes')

        # 确定音频格式
        file_format = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'webm'
        logging.debug(f'detected file format: {file_format}')

        # 转换为 PCM 格式
        if file_format in ['webm', 'm4a']:
            try:
                from pydub import AudioSegment
                audio = AudioSegment.from_file(temp_path, format=file_format)
                audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
                audio_data = audio.raw_data
                format_param = 'pcm'
                os.remove(temp_path)
                temp_path = None
            except ImportError:
                logging.error('pydub not installed, unable to convert audio format')
                return jsonify({
                    'success': False,
                    'error': 'audio format conversion failed, please install pydub'
                }), 500
        else:
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
            format_param = 'wav' if file_format == 'wav' else 'pcm'

        logging.debug(f'audio data size: {len(audio_data)} bytes, using format param: {format_param}')

        # 调用百度语音识别 API
        result = client.asr(audio_data, format_param, 16000, {'dev_pid': 1537})
        logging.debug(f'baidu api return results: {json.dumps(result, ensure_ascii=False)}')
        
        if result.get('err_no') == 0:
            transcribed_text = ''.join(result.get('result', []))
            logging.info(f'recognition success: {transcribed_text}')
            return jsonify({'success': True, 'text': transcribed_text, 'length': len(transcribed_text)})
        else:
            error_code = result.get('err_no')
            error_msg = result.get('err_msg', 'unknown error')
            logging.error(f'recognition failed: error code {error_code}, error message {error_msg}')
            return jsonify({'success': False, 'error': f'recognition failed: {error_msg}', 'error_code': error_code}), 500

    except Exception as e:
        logging.exception("failed to recognize")
        return jsonify({'success': False, 'error': f'recognition failed: {str(e)}'}), 500


@bp.route('/generate', methods=['POST'])
def generate_note():
    try:
        payload = request.get_json() or {}
        text = payload.get('text', '').strip()
        subject = payload.get('subject', 'General')
        if not text:
            return jsonify({'success': False, 'error': 'text is required'}), 400

        # Construct the prompt
        prompt = f"""请将以下内容整理成结构化的学习笔记。

原始内容：
{text}

请按照以下格式输出JSON：
{{
    "title": "笔记标题",
    "subject": "{subject}",
    "key_points": ["关键点1", "关键点2", "关键点3"],
    "examples": ["示例1", "示例2"],
    "summary": "内容总结（50-100字）",
    "tags": ["标签1", "标签2"]
}}

要求：
1. 提取3-5个关键知识点
2. 如果有例子，提取1-3个代表性示例
3. 生成简洁的总结
4. 添加2-3个相关标签
5. 只返回JSON，不要其他文字"""

        notes_data = None
        if DEEPSEEK_API_KEY:
            try:
                headers = {'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'}
                req = {'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': prompt}]}
                r = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions", headers=headers, json=req, timeout=30)
                if r.status_code == 200:
                    raw = r.json()['choices'][0]['message']['content']
                    if '```json' in raw:
                        raw = raw.split('```json')[1].split('```')[0].strip()
                    elif '```' in raw:
                        raw = raw.split('```')[1].split('```')[0].strip()
                    try:
                        notes_data = json.loads(raw)
                    except Exception:
                        notes_data = None
            except Exception:
                notes_data = None

        if not notes_data:
            notes_data = _fallback_notes(text, subject)

        rec = {
            'title': notes_data.get('title', 'Untitled'),
            'subject': notes_data.get('subject', subject),
            'content': notes_data,
            'original_text': text,
            'user_id': 1,
            'source': 'generated',
            'prompt': prompt  # Store the prompt in the database
        }
        nid = db_sqlite.insert_note(rec)
        saved = db_sqlite.get_note_by_id(nid)
        return jsonify({'success': True, 'note_id': nid, 'note': saved})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/list', methods=['GET'])
def list_notes():
    subject = request.args.get('subject')
    limit = int(request.args.get('limit', 10))
    try:
        notes = db_sqlite.list_notes(subject=subject, limit=limit)
        result = [
            {'id': n['id'], 'title': n['title'], 'subject': n['subject'], 'date': n['date'], 'preview': n['content'].get('summary', '')[:100], 'key_points_count': len(n['content'].get('key_points', []))}
            for n in notes
        ]
        total = db_sqlite.count_notes(subject=subject)
        return jsonify({'success': True, 'notes': result, 'total': total})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/<int:note_id>', methods=['GET'])
def get_note(note_id):
    try:
        n = db_sqlite.get_note_by_id(note_id)
        if not n:
            return jsonify({'success': False, 'error': 'Note not found'}), 404
        return jsonify({'success': True, 'note': n})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    try:
        ok = db_sqlite.delete_note(note_id)
        if not ok:
            return jsonify({'success': False, 'error': 'Note not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    try:
        payload = request.get_json() or {}
        updated = {
            'title': payload.get('title'),
            'subject': payload.get('subject'),
            'content': payload.get('content', {}),
            'original_text': payload.get('original_text', None),
            'source': payload.get('source', 'manual')
        }
        db_sqlite.update_note(note_id, updated)
        saved = db_sqlite.get_note_by_id(note_id)
        return jsonify({'success': True, 'note': saved})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/health', methods=['GET'])
def health_check():
    try:
        cnt = db_sqlite.count_notes()
        return jsonify({'status': 'healthy', 'total_notes': cnt})
    except Exception:
        return jsonify({'status': 'degraded', 'total_notes': 0})
