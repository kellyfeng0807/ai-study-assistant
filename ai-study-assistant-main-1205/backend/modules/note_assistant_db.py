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

SEGMENT_DURATION_SECONDS = 55
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2

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
    
    # 如果没有科目，默认使用 General
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
    """Recognize audio using Xfyun ASR."""
    asr = XfyunASR(audio_data, language)
    return asr.recognize()


def recognize_audio_segment(audio_data, format_param='pcm'):
    """Segment audio and recognize using Xfyun."""
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
    """Split audio into smaller segments."""
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

# Updating transcribe_audio to use Xfyun logic
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

        # Convert audio to PCM if necessary
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

        # Transcribe audio
        transcribed_text, error = recognize_audio_segment(audio_data)
        if error:
            return jsonify({'success': False, 'error': f'Recognition failed: {error}'}), 500

        return jsonify({'success': True, 'text': transcribed_text, 'length': len(transcribed_text)})

    except Exception as e:
        logging.exception("Transcription failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/generate', methods=['POST'])
def generate_note():
    try:
        payload = request.get_json() or {}
        text = payload.get('text', '').strip()
        subject = payload.get('subject', '')  # 可选，如果不传则让 AI 自动识别
        if not text:
            return jsonify({'success': False, 'error': 'text is required'}), 400

        # Construct the prompt - 让 AI 自动识别学科（使用英文）
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


# Adding XfyunASR class from note version
class XfyunASR:
    """Xfyun WebSocket ASR Client."""

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
                end_idx = rg[1]
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


# Adding create_xfyun_auth_url function from note version
def create_xfyun_auth_url():
    """Create Xfyun WebSocket authentication URL."""
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