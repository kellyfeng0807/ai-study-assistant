"""Clean, minimal note assistant module using local sqlite via db_sqlite.
This is a safe replacement for the previously corrupted `note_assistant.py`.
新增：文件上传生成笔记功能
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
import base64
import threading
import time
import websocket
import hmac
import hashlib
from urllib.parse import urlencode



bp = Blueprint('note_assistant', __name__, url_prefix='/api/note')

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
XFYUN_APPID = 'f047ebc8'
XFYUN_API_SECRET = 'M2MxZmM2MDdiYmYwNjlhYzFkNDdmOWZi'
XFYUN_API_KEY = '014159c78a774f99e8e49946b4757daa'

# DashScope (Qwen-VL) for file OCR
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")

SEGMENT_DURATION_SECONDS = 55
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2

ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'pcm', 'webm', 'm4a', 'ogg'}
ALLOWED_FILE_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'txt', 'md'}

db_sqlite.init_db()

# Debug: Print database info on module load
import sys
print(f"[NOTE_INIT] db_sqlite.DB_PATH: {db_sqlite.DB_PATH}", file=sys.stderr)
print(f"[NOTE_INIT] DB file exists: {os.path.exists(db_sqlite.DB_PATH)}", file=sys.stderr)

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

    if not subject:
        subject = 'General'
        
    fallback_notes = {
        'title': title,
        'subject': subject,
        'key_points': key_points,
        'examples': [],
        'summary': summary,
        'tags': [subject, 'study note']
    }
    return fallback_notes


def recognize_audio_xfyun(audio_data, language='zh_cn'):
    asr = XfyunASR(audio_data, language)
    return asr.recognize()


def recognize_audio_segment(audio_data, format_param='pcm'):
    logging.debug('Attempting Chinese recognition...')
    text_zh, error_zh = recognize_audio_xfyun(audio_data, 'zh_cn')
    zh_len = len(text_zh) if text_zh else 0
    logging.debug(f'Chinese result: {zh_len} characters')

    logging.debug('Attempting English recognition...')
    text_en, error_en = recognize_audio_xfyun(audio_data, 'en_us')
    en_len = len(text_en) if text_en else 0
    logging.debug(f'English result: {en_len} characters')

    if text_zh and text_en:
        en_letter_count = sum(1 for c in text_en if c.isalpha())
        en_ratio = en_letter_count / len(text_en) if text_en else 0
        zh_char_count = sum(1 for c in text_zh if '\u4e00' <= c <= '\u9fff')
        zh_ratio = zh_char_count / len(text_zh) if text_zh else 0
        logging.debug(f'Chinese ratio: {zh_ratio*100:.1f}%, English ratio: {en_ratio*100:.1f}%')
        if en_ratio > 0.6 and en_len > zh_len * 0.5:
            logging.debug('Selecting English result')
            return text_en, None
        else:
            logging.debug('Selecting Chinese result')
            return text_zh, None
    elif text_en:
        return text_en, None
    elif text_zh:
        return text_zh, None
    else:
        return None, error_zh or error_en or "Recognition failed"


def split_audio_to_segments(audio_data, segment_duration_seconds=55):
    bytes_per_second = SAMPLE_RATE * SAMPLE_WIDTH * 1
    segment_size = segment_duration_seconds * bytes_per_second
    segments = []
    total_size = len(audio_data)
    for start in range(0, total_size, segment_size):
        end = min(start + segment_size, total_size)
        segment = audio_data[start:end]
        min_segment_size = int(0.5 * bytes_per_second)
        if len(segment) >= min_segment_size:
            segments.append(segment)
    return segments


@bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        logging.debug("Starting transcription request")
        if 'audio' not in request.files:
            logging.error("No audio file uploaded")
            return jsonify({'success': False, 'error': 'No audio file uploaded'}), 400
        audio_file = request.files['audio']
        if audio_file.filename == '':
            logging.error("File name is empty")
            return jsonify({'success': False, 'error': 'File name is empty'}), 400
        filename = secure_filename(audio_file.filename)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        audio_file.save(temp_path)
        file_size = os.path.getsize(temp_path)
        logging.debug(f'Audio file saved: {temp_path}, size: {file_size} bytes')
        audio_data = None
        file_format = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'webm'
        if file_format in ['webm', 'm4a', 'mp3', 'ogg']:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(temp_path, format=file_format)
            audio = audio.set_frame_rate(SAMPLE_RATE).set_channels(1).set_sample_width(SAMPLE_WIDTH)
            audio_data = audio.raw_data
        else:
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
        if not audio_data:
            return jsonify({'success': False, 'error': 'Unable to read audio data'}), 500
        transcribed_text, error = recognize_audio_segment(audio_data)
        if error:
            return jsonify({'success': False, 'error': f'Recognition failed: {error}'}), 500
        return jsonify({'success': True, 'text': transcribed_text, 'length': len(transcribed_text)})
    except Exception as e:
        logging.exception("Transcription failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/list', methods=['GET'])
def list_notes():
    """获取笔记列表"""
    subject = request.args.get('subject')
    limit = int(request.args.get('limit', 10))
    try:
        notes = db_sqlite.list_notes(subject=subject, limit=limit)
        result = [
            {
                'id': n['id'], 
                'title': n['title'], 
                'subject': n['subject'], 
                'date': n['date'], 
                'preview': n['content'].get('summary', '')[:100] if n.get('content') else '', 
                'key_points_count': len(n['content'].get('key_points', [])) if n.get('content') else 0
            }
            for n in notes
        ]
        total = db_sqlite.count_notes(subject=subject)
        return jsonify({'success': True, 'notes': result, 'total': total})
    except Exception as e:
        logging.exception("Failed to list notes")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/generate', methods=['POST'])
def generate_note():
    try:
        payload = request.get_json() or {}
        text = payload.get('text', '').strip()
        subject = payload.get('subject', '')
        if not text:
            return jsonify({'success': False, 'error': 'text is required'}), 400
        if subject:
            subject_instruction = f'Subject is specified as: {subject}'
        else:
            subject_instruction = 'Please identify the subject based on content. Use English subject names only (e.g., Mathematics, Physics, Chemistry, Biology, English, Chinese, History, Geography, Computer Science, Economics, Politics, Art, Music, etc.)'
        prompt = f"""请将以下内容整理成结构化的学习笔记。

原始内容：
{text}

{subject_instruction}

请按照以下格式输出JSON：
{{
    "title": "笔记标题",
    "subject": "Subject name in English",
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
5. subject 字段必须使用英文学科名称（如 Mathematics, Physics, Chemistry, Biology, Chinese, English, History, Geography, Computer Science 等）
6. 只返回JSON，不要其他文字"""

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
            except Exception as e:
                logging.exception("DeepSeek API call failed")
                notes_data = None
        if not notes_data:
            notes_data = _fallback_notes(text, subject)
        rec = {
            'title': notes_data.get('title', 'Untitled'),
            'subject': notes_data.get('subject', subject or 'General'),
            'content': notes_data,
            'original_text': text,
            'user_id': 1,
            'source': 'manual',
            'prompt': prompt
        }
        nid = db_sqlite.insert_note(rec)
        saved = db_sqlite.get_note_by_id(nid)
        return jsonify({'success': True, 'note_id': nid, 'note': saved})
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


class XfyunASR:
    def __init__(self, audio_data, language='zh_cn'):
        self.audio_data = audio_data
        self.language = language
        self.result = []
        self.is_finished = False
        self.error = None

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            code = data.get("code")
            if code != 0:
                self.error = f"Xfyun Error {code}: {data.get('message', 'Unknown error')}"
                self.is_finished = True
                ws.close()
                return
            result_data = data.get("data", {})
            result = result_data.get("result", {})
            pgs = result.get("pgs", "")
            rg = result.get("rg", [])
            ws_list = result.get("ws", [])
            current_text = ""
            for ws_item in ws_list:
                cw_list = ws_item.get("cw", [])
                for cw in cw_list:
                    word = cw.get("w", "")
                    if word:
                        current_text += word
            if pgs == "rpl" and len(rg) == 2:
                start_idx = rg[0]
                if start_idx < len(self.result):
                    self.result = self.result[:start_idx]
                if current_text:
                    self.result.append(current_text)
            elif pgs == "apd" or not pgs:
                if current_text:
                    self.result.append(current_text)
            status = result_data.get("status")
            if status == 2:
                self.is_finished = True
                ws.close()
        except Exception as e:
            self.error = str(e)
            self.is_finished = True
            ws.close()

    def on_error(self, ws, error):
        self.error = str(error)
        self.is_finished = True

    def on_close(self, ws, close_status_code, close_msg):
        self.is_finished = True

    def on_open(self, ws):
        def send_audio():
            try:
                frame_size = 1280
                interval = 0.04
                status = 0
                offset = 0
                total_len = len(self.audio_data)
                while offset < total_len:
                    end = min(offset + frame_size, total_len)
                    chunk = self.audio_data[offset:end]
                    if offset == 0:
                        status = 0
                    elif end >= total_len:
                        status = 2
                    else:
                        status = 1
                    audio_base64 = base64.b64encode(chunk).decode('utf-8')
                    if status == 0:
                        message = {
                            "common": {"app_id": XFYUN_APPID},
                            "business": {
                                "language": self.language,
                                "domain": "iat",
                                "accent": "mandarin",
                                "vad_eos": 3000,
                                "ptt": 1
                            },
                            "data": {
                                "status": status,
                                "format": "audio/L16;rate=16000",
                                "encoding": "raw",
                                "audio": audio_base64
                            }
                        }
                    else:
                        message = {
                            "data": {
                                "status": status,
                                "format": "audio/L16;rate=16000",
                                "encoding": "raw",
                                "audio": audio_base64
                            }
                        }
                    ws.send(json.dumps(message))
                    offset = end
                    if status != 2:
                        time.sleep(interval)
            except Exception as e:
                self.error = str(e)
                ws.close()
        threading.Thread(target=send_audio).start()

    def recognize(self):
        try:
            url = create_xfyun_auth_url()
            ws = websocket.WebSocketApp(
                url,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close,
                on_open=self.on_open
            )
            ws.run_forever()
            timeout = 60
            start_time = time.time()
            while not self.is_finished and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            if self.error:
                return None, self.error
            return ''.join(self.result), None
        except Exception as e:
            return None, str(e)


def create_xfyun_auth_url():
    from datetime import datetime
    from time import mktime
    from wsgiref.handlers import format_date_time
    now = datetime.now()
    date = format_date_time(mktime(now.timetuple()))
    signature_origin = f"host: ws-api.xfyun.cn\ndate: {date}\nGET /v2/iat HTTP/1.1"
    signature_sha = hmac.new(
        XFYUN_API_SECRET.encode('utf-8'),
        signature_origin.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    signature_sha_base64 = base64.b64encode(signature_sha).decode('utf-8')
    authorization_origin = f'api_key="{XFYUN_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha_base64}"'
    authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')
    params = {
        "authorization": authorization,
        "date": date,
        "host": "ws-api.xfyun.cn"
    }
    url = f"wss://ws-api.xfyun.cn/v2/iat?{urlencode(params)}"
    return url


# ========== 文件上传生成笔记 (NEW) ==========
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_FILE_EXTENSIONS


def extract_text_from_file(file_path, file_ext):
    try:
        if file_ext in ['txt', 'md']:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read(), None
        if file_ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'pdf']:
            return extract_text_with_ocr(file_path, file_ext)
        return None, f"Unsupported file type: {file_ext}"
    except Exception as e:
        return None, str(e)


def extract_text_with_ocr(file_path, file_ext):
    """提取文本 - PDF用PyPDF2，图片用Qwen-VL OCR"""
    try:
        # PDF 文件：使用 PyPDF2 提取文本（Qwen-VL 不支持 PDF）
        if file_ext == 'pdf':
            try:
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    if text.strip() and len(text.strip()) > 20:
                        logging.info(f"PyPDF2 extracted {len(text)} characters from PDF")
                        return text.strip(), None
                    else:
                        return None, "PDF文本提取失败或内容太少。该PDF可能是扫描版，暂不支持OCR。"
            except ImportError:
                return None, "需要安装PyPDF2来处理PDF文件。请运行: pip install PyPDF2 --break-system-packages"
            except Exception as pdf_error:
                logging.warning(f"PyPDF2 extraction failed: {pdf_error}")
                return None, f"PDF处理失败: {str(pdf_error)}"
        
        # 图片文件：使用 Qwen-VL OCR
        if file_ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp']:
            try:
                from dashscope import MultiModalConversation
                prompt = (
                    "请仔细识别这张图片中的所有文字内容。\n"
                    "要求：\n"
                    "1. 完整提取所有可见文字\n"
                    "2. 保持原有的段落结构\n"
                    "3. 如果有标题、列表等，请保留格式\n"
                    "4. 只输出识别到的文字内容，不要添加任何解释\n"
                )
                messages = [{
                    "role": "user",
                    "content": [
                        {"image": f"file://{os.path.abspath(file_path)}"},
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
                    return None, f"OCR API Error {response.code}: {response.message}"
                text = response.output.choices[0].message.content[0]['text']
                logging.info(f"Qwen-VL OCR extracted {len(text)} characters from image")
                return text.strip(), None
            except ImportError:
                return None, "OCR功能需要安装dashscope库。请运行: pip install dashscope --break-system-packages"
            except Exception as ocr_error:
                logging.exception("Qwen-VL OCR failed")
                return None, f"图片OCR失败: {str(ocr_error)}"
        
        return None, f"不支持的文件类型: {file_ext}"
    except Exception as e:
        logging.exception("Text extraction failed")
        return None, str(e)


@bp.route('/upload-file', methods=['POST'])
def upload_file_generate_note():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    uploaded_file = request.files['file']
    if uploaded_file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400
    filename = secure_filename(uploaded_file.filename)
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if not allowed_file(filename):
        return jsonify({
            'success': False, 
            'error': f'File type not supported. Allowed: {", ".join(ALLOWED_FILE_EXTENSIONS)}'
        }), 400
    subject = request.form.get('subject', '')
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"{int(time.time() * 1000)}_{filename}")
    try:
        uploaded_file.save(temp_path)
        logging.info(f"File saved to: {temp_path}")
        extracted_text, error = extract_text_from_file(temp_path, file_ext)
        if error:
            return jsonify({'success': False, 'error': f'Text extraction failed: {error}'}), 500
        if not extracted_text or len(extracted_text.strip()) < 10:
            return jsonify({'success': False, 'error': 'Could not extract enough text from file'}), 400
        if subject:
            subject_instruction = f'Subject is specified as: {subject}'
        else:
            subject_instruction = 'Please identify the subject based on content. Use English subject names only.'
        prompt = f"""请将以下内容整理成结构化的学习笔记。

原始内容：
{extracted_text}

{subject_instruction}

请按照以下格式输出JSON：
{{
    "title": "笔记标题",
    "subject": "Subject name in English",
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
5. subject 字段必须使用英文学科名称
6. 只返回JSON，不要其他文字"""

        notes_data = None
        if DEEPSEEK_API_KEY:
            try:
                headers = {'Authorization': f'Bearer {DEEPSEEK_API_KEY}', 'Content-Type': 'application/json'}
                req = {'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': prompt}]}
                r = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions", headers=headers, json=req, timeout=60)
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
            except Exception as e:
                logging.exception("DeepSeek API call failed")
                notes_data = None
        if not notes_data:
            notes_data = _fallback_notes(extracted_text, subject)
        rec = {
            'title': notes_data.get('title', 'Untitled'),
            'subject': notes_data.get('subject', subject or 'General'),
            'content': notes_data,
            'original_text': extracted_text,
            'user_id': 1,
            'source': 'file_upload',
            'prompt': prompt
        }
        nid = db_sqlite.insert_note(rec)
        saved = db_sqlite.get_note_by_id(nid)
        return jsonify({
            'success': True,
            'note_id': nid,
            'note': saved,
            'extracted_text': extracted_text[:500] + '...' if len(extracted_text) > 500 else extracted_text
        })
    except Exception as e:
        logging.exception("File upload and note generation failed")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except OSError:
            pass