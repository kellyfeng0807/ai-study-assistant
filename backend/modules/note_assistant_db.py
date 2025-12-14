"""Clean, minimal note assistant module using local sqlite via db_sqlite.
This is a safe replacement for the previously corrupted `note_assistant.py`.
"""

from flask import Blueprint, request, jsonify, session
import os
import json
import traceback
from datetime import datetime
import requests
import db_sqlite
from werkzeug.utils import secure_filename
from services.ai_service import ai_service

import logging


bp = Blueprint('note_assistant', __name__, url_prefix='/api/note')

# Audio processing constants
SEGMENT_DURATION_SECONDS = 55
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2

ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'pcm', 'webm', 'm4a', 'ogg'}
ALLOWED_FILE_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'txt', 'md'}

# Unified upload folder management (consistent with error_book and map_generation)
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads', 'notes')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
    """Wrapper for ai_service fallback method to maintain backward compatibility"""
    result = ai_service._fallback_note(text, subject or 'General')
    # Add 'subject' field for compatibility with old code
    result['subject'] = subject or 'General'
    result['examples'] = []  # Add empty examples for compatibility
    return result


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
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        unique_filename = f"{timestamp}_{filename}"
        temp_path = os.path.join(UPLOAD_FOLDER, unique_filename)
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

        # Transcribe audio using centralized AI service (auto-detect language)
        transcribed_text, error = ai_service.speech_to_text(audio_data, language='auto')
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
        subject = payload.get('subject', '')
        if not text:
            return jsonify({'success': False, 'error': 'text is required'}), 400

        # Use centralized AI service (all prompt logic is in ai_service)
        try:
            notes_data = ai_service.generate_note_from_text(text, subject or 'General')
        except Exception as e:
            logging.error(f"AI service failed: {e}")
            notes_data = _fallback_notes(text, subject)

        # Get user_id from session
        user_id = session.get('user_id', 'default')
        
        rec = {
            'title': notes_data.get('title', 'Untitled'),
            'subject': notes_data.get('subject', subject or 'General'),
            'content': notes_data,
            'original_text': text,
            'user_id': user_id,
            'source': 'generated'
        }
        nid = db_sqlite.insert_note(rec)
        saved = db_sqlite.get_note_by_id(nid, user_id)
        return jsonify({'success': True, 'note_id': nid, 'note': saved})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/list', methods=['GET'])
def list_notes():
    subject = request.args.get('subject')
    limit = int(request.args.get('limit', 10))
    try:
        # Get user_id from session
        user_id = session.get('user_id', 'default')
        
        notes = db_sqlite.list_notes(subject=subject, limit=limit, user_id=user_id)
        result = [
            {'id': n['id'], 'title': n['title'], 'subject': n['subject'], 'date': n['date'], 'preview': n['content'].get('summary', '')[:100], 'key_points_count': len(n['content'].get('key_points', []))}
            for n in notes
        ]
        total = db_sqlite.count_notes(subject=subject, user_id=user_id)
        return jsonify({'success': True, 'notes': result, 'total': total})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/<int:note_id>', methods=['GET'])
def get_note(note_id):
    try:
        # Get user_id from session
        user_id = session.get('user_id', 'default')
        
        n = db_sqlite.get_note_by_id(note_id, user_id)
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
        # Get user_id from session
        user_id = session.get('user_id', 'default')
        
        db_sqlite.update_note(note_id, payload)
        saved = db_sqlite.get_note_by_id(note_id, user_id)
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
        
        # 图片文件：使用 AI Service OCR
        if file_ext in ['png', 'jpg', 'jpeg', 'gif', 'bmp']:
            text, error = ai_service.ocr_image(file_path)
            if error:
                return None, error
            logging.info(f"OCR extracted {len(text)} characters from image")
            return text, None
        
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
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    unique_filename = f"{timestamp}_{filename}"
    temp_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    try:
        uploaded_file.save(temp_path)
        logging.info(f"File saved to: {temp_path}")
        extracted_text, error = extract_text_from_file(temp_path, file_ext)
        if error:
            return jsonify({'success': False, 'error': f'Text extraction failed: {error}'}), 500
        if not extracted_text or len(extracted_text.strip()) < 10:
            return jsonify({'success': False, 'error': 'Could not extract enough text from file'}), 400
        
        # Use centralized AI service (all prompt logic is in ai_service)
        try:
            notes_data = ai_service.generate_note_from_text(extracted_text, subject or 'General')
        except Exception as e:
            logging.error(f"AI service failed: {e}")
            notes_data = _fallback_notes(extracted_text, subject)
        # Get user_id from session
        user_id = session.get('user_id', 'default')
        
        rec = {
            'title': notes_data.get('title', 'Untitled'),
            'subject': notes_data.get('subject', subject or 'General'),
            'content': notes_data,
            'original_text': extracted_text,
            'user_id': user_id,
            'source': 'file_upload'
        }
        nid = db_sqlite.insert_note(rec)
        saved = db_sqlite.get_note_by_id(nid, user_id)
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