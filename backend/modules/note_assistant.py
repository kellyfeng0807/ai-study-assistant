"""
Note Assistant Module - 完整实现（添加百度语音识别）
录音转写、生成笔记、语音识别
"""

from flask import Blueprint, request, jsonify
import os
import json
from datetime import datetime
import requests
import tempfile
from werkzeug.utils import secure_filename

note_bp = Blueprint('note_assistant', __name__, url_prefix='/api/note')

# ============== 百度语音识别配置 ==============
BAIDU_APP_ID = '7227061'
BAIDU_API_KEY = 'MuZYealXv5pwVZsK3tFkWTwe'
BAIDU_SECRET_KEY = 'zdAvuWkk4aLtefGiILuQb35gcqK7fvz7'

print("=" * 60)
print("百度语音识别配置")
print(f"BAIDU_APP_ID: {BAIDU_APP_ID}")
print(f"BAIDU_API_KEY: {BAIDU_API_KEY[:10]}...{BAIDU_API_KEY[-4:]}")
print("=" * 60)

# 百度语音识别客户端
baidu_client = None

def get_baidu_client():
    """获取百度语音识别客户端"""
    global baidu_client
    if baidu_client is None:
        try:
            from aip import AipSpeech
            baidu_client = AipSpeech(BAIDU_APP_ID, BAIDU_API_KEY, BAIDU_SECRET_KEY)
            print("百度语音识别客户端初始化成功")
        except ImportError:
            print("请安装百度 SDK: pip install baidu-aip chardet")
            return None
        except Exception as e:
            print(f"百度客户端初始化失败: {e}")
            return None
    return baidu_client

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

# 允许的音频格式
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'pcm', 'webm', 'm4a', 'ogg'}

# 笔记存储（实际项目应该用数据库）
notes_storage = []


def allowed_audio_file(filename):
    """检查音频文件格式"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_AUDIO_EXTENSIONS


@note_bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    ✨ 新增：使用百度语音识别转写音频为文字
    """
    try:
        print("\n" + "=" * 60)
        print("语音识别请求开始")
        print("=" * 60)
        
        # 获取百度客户端
        client = get_baidu_client()
        if not client:
            return jsonify({
                'success': False,
                'error': '百度 SDK 未安装。请运行: pip install baidu-aip chardet'
            }), 503
        
        # 检查文件
        if 'audio' not in request.files:
            print("没有上传音频文件")
            return jsonify({
                'success': False,
                'error': '没有上传音频文件'
            }), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            print("文件名为空")
            return jsonify({
                'success': False,
                'error': '文件名为空'
            }), 400
        
        # 保存临时文件
        filename = secure_filename(audio_file.filename)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        audio_file.save(temp_path)
        
        file_size = os.path.getsize(temp_path)
        print(f'音频文件已保存: {temp_path}')
        print(f'文件大小: {file_size} bytes ({file_size / 1024:.2f} KB)')
        
        # 确定音频格式
        file_format = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'webm'
        
        print(f'检测到文件格式: {file_format}')
        
        # 对 webm 和 m4a 格式都进行转换为 PCM
        if file_format in ['webm', 'm4a']:
            print(f'检测到 {file_format} 格式，需要转换为 PCM...')
            try:
                # 尝试使用 pydub 转换
                from pydub import AudioSegment
                
                # 读取音频文件
                if file_format == 'webm':
                    audio = AudioSegment.from_file(temp_path, format="webm")
                elif file_format == 'm4a':
                    audio = AudioSegment.from_file(temp_path, format="m4a")
                
                print(f'原始音频: {len(audio)}ms, {audio.frame_rate}Hz, {audio.channels}声道')
                
                # 转换为 PCM 要求的格式：16000Hz 采样率，单声道，16bit
                audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
                
                print(f'转换后: {len(audio)}ms, {audio.frame_rate}Hz, {audio.channels}声道, {audio.sample_width*8}bit')
                
                # 直接获取 PCM 数据（raw_data 就是 PCM 格式）
                audio_data = audio.raw_data
                
                print(f'已转换为 PCM，数据大小: {len(audio_data)} bytes')
                
                format_param = 'pcm'
                
                # 删除临时文件
                os.remove(temp_path)
                temp_path = None  # 已经获取数据，不需要文件了
                
            except ImportError:
                print('pydub 未安装，尝试使用 ffmpeg...')
                try:
                    import subprocess
                    
                    # 使用 ffmpeg 转换
                    wav_path = temp_path.replace('.webm', '.wav')
                    
                    cmd = [
                        'ffmpeg', '-i', temp_path,
                        '-ar', '16000',  # 采样率 16000
                        '-ac', '1',      # 单声道
                        '-y',            # 覆盖输出文件
                        wav_path
                    ]
                    
                    result_cmd = subprocess.run(cmd, capture_output=True, check=True)
                    print(f'使用 ffmpeg 转换完成: {wav_path}')
                    
                    # 读取转换后的音频
                    with open(wav_path, 'rb') as f:
                        audio_data = f.read()
                    
                    format_param = 'wav'
                    
                    # 删除临时 webm 文件
                    os.remove(temp_path)
                    temp_path = wav_path
                    
                except FileNotFoundError:
                    print('ffmpeg 未安装，无法转换 webm')
                    return jsonify({
                        'success': False,
                        'error': '百度不支持 webm 格式。请安装 ffmpeg 或 pydub：\npip install pydub\n或安装 ffmpeg'
                    }), 500
                except Exception as e:
                    print(f'ffmpeg 转换失败: {e}')
                    return jsonify({
                        'success': False,
                        'error': f'音频格式转换失败: {str(e)}'
                    }), 500
        else:
            # 其他格式直接读取
            with open(temp_path, 'rb') as f:
                audio_data = f.read()
            
            format_map = {
                'wav': 'wav',
                'pcm': 'pcm',
                'amr': 'amr',
                'm4a': 'm4a'
            }
            format_param = format_map.get(file_format, 'wav')
        
        print(f'音频数据大小: {len(audio_data)} bytes')
        print(f'使用格式参数: {format_param}')
        
        # 调用百度语音识别 API
        print('开始调用百度语音识别 API...')
        result = client.asr(
            audio_data,
            format_param,  # 格式
            16000,         # 采样率
            {
                'dev_pid': 1537  # 1537 = 普通话
            }
        )
        
        print(f'百度 API 返回结果:')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
        # 处理结果
        if result.get('err_no') == 0:
            # 识别成功
            transcribed_text = ''.join(result.get('result', []))
            print(f'识别成功!')
            print(f'识别文本: {transcribed_text}')
            print(f'文本长度: {len(transcribed_text)} 字符')
            
            # 清理临时文件
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
                print('临时文件已删除')
            
            return jsonify({
                'success': True,
                'text': transcribed_text,
                'length': len(transcribed_text)
            })
        else:
            # 识别失败
            error_code = result.get('err_no')
            error_msg = result.get('err_msg', '未知错误')
            print(f'百度识别失败')
            print(f'错误代码: {error_code}')
            print(f'错误信息: {error_msg}')
            
            # 清理临时文件
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
            
            return jsonify({
                'success': False,
                'error': f'语音识别失败 (错误代码: {error_code}): {error_msg}',
                'error_code': error_code,
                'error_msg': error_msg
            }), 500
        
    except Exception as e:
        print(f'语音转文字异常: {str(e)}')
        import traceback
        print("详细错误信息:")
        traceback.print_exc()
        
        # 清理临时文件
        if 'temp_path' in locals() and temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print('临时文件已清理')
            except:
                pass
        
        return jsonify({
            'success': False,
            'error': f'语音转文字失败: {str(e)}'
        }), 500


@note_bp.route('/generate', methods=['POST'])
def generate_notes():
    """
    生成结构化笔记
    使用 DeepSeek LLM 提取关键点和示例
    """
    try:
        print("\n" + "=" * 60)
        print("笔记生成请求开始")
        print("=" * 60)
        
        data = request.json
        text = data.get('text', '')
        subject = data.get('subject', '通用')
        
        print(f'科目: {subject}')
        print(f'文本长度: {len(text)} 字符')
        print(f'文本预览: {text[:200]}...')
        
        if not text or len(text.strip()) < 10:
            print("文本太短")
            return jsonify({'error': 'Text too short for note generation'}), 400
        
        # 构建 Prompt
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

        # 调用 DeepSeek API
        if DEEPSEEK_API_KEY:
            print("准备调用 DeepSeek API...")
            print(f"🔑 API Key: {DEEPSEEK_API_KEY[:20]}...")
            
            headers = {
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "你是一个专业的学习笔记助手，擅长提取关键信息并生成结构化笔记。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 2000
            }
            
            try:
                print("发送请求到 DeepSeek API...")
                response = requests.post(
                    f"{DEEPSEEK_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                print(f"DeepSeek 响应状态码: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    content = result['choices'][0]['message']['content']
                    
                    print(f"DeepSeek 返回内容长度: {len(content)} 字符")
                    print(f"内容预览: {content[:300]}...")
                    
                    # 解析 JSON
                    try:
                        if '```json' in content:
                            content = content.split('```json')[1].split('```')[0].strip()
                        elif '```' in content:
                            content = content.split('```')[1].split('```')[0].strip()
                        
                        notes_data = json.loads(content)
                        print("JSON 解析成功")
                        print(f"笔记标题: {notes_data.get('title', 'N/A')}")
                        
                    except json.JSONDecodeError as e:
                        print(f"JSON 解析失败: {e}")
                        print("使用备用方案生成笔记")
                        notes_data = create_fallback_notes(text, subject)
                else:
                    print(f"DeepSeek API 错误: {response.status_code}")
                    print(f"响应内容: {response.text}")
                    notes_data = create_fallback_notes(text, subject)
                    
            except requests.exceptions.Timeout:
                print("DeepSeek API 请求超时")
                notes_data = create_fallback_notes(text, subject)
            except Exception as e:
                print(f"DeepSeek API 请求失败: {e}")
                import traceback
                traceback.print_exc()
                notes_data = create_fallback_notes(text, subject)
        else:
            print("未配置 DeepSeek API Key，使用备用方案")
            notes_data = create_fallback_notes(text, subject)
        
        # 保存笔记
        note_id = len(notes_storage) + 1
        note_record = {
            'id': note_id,
            'title': notes_data.get('title', '未命名笔记'),
            'subject': notes_data.get('subject', subject),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'content': notes_data,
            'original_text': text
        }
        notes_storage.append(note_record)
        
        print(f"笔记已保存 (ID: {note_id})")
        print("=" * 60)
        
        return jsonify({
            'success': True,
            'note_id': note_id,
            'notes': notes_data  # 字段名是 'notes'
        })
    
    except Exception as e:
        print(f"笔记生成异常: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@note_bp.route('/list', methods=['GET'])
def list_notes():
    """获取笔记列表"""
    try:
        subject = request.args.get('subject', None)
        limit = int(request.args.get('limit', 10))
        
        filtered_notes = notes_storage
        if subject:
            filtered_notes = [n for n in notes_storage if n['subject'] == subject]
        
        notes_list = [
            {
                'id': note['id'],
                'title': note['title'],
                'subject': note['subject'],
                'date': note['date'],
                'preview': note['content'].get('summary', '')[:100]
            }
            for note in filtered_notes[-limit:]
        ]
        
        return jsonify({
            'success': True,
            'total': len(filtered_notes),
            'notes': notes_list[::-1]
        })
    
    except Exception as e:
        print(f"获取笔记列表失败: {e}")
        return jsonify({'error': str(e)}), 500


@note_bp.route('/<int:note_id>', methods=['GET'])
def get_note_detail(note_id):
    """获取笔记详情"""
    try:
        note = next((n for n in notes_storage if n['id'] == note_id), None)
        
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        return jsonify({
            'success': True,
            'note': note
        })
    
    except Exception as e:
        print(f"获取笔记详情失败: {e}")
        return jsonify({'error': str(e)}), 500


@note_bp.route('/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    """删除笔记"""
    try:
        global notes_storage
        original_length = len(notes_storage)
        notes_storage = [n for n in notes_storage if n['id'] != note_id]
        
        if len(notes_storage) == original_length:
            return jsonify({'error': 'Note not found'}), 404
        
        print(f"笔记已删除 (ID: {note_id})")
        
        return jsonify({
            'success': True,
            'message': 'Note deleted successfully'
        })
    
    except Exception as e:
        print(f" 删除笔记失败: {e}")
        return jsonify({'error': str(e)}), 500


def create_fallback_notes(text, subject):
    """Fallback 笔记生成（当 API 不可用时）"""
    print("使用备用方案生成笔记")
    
    sentences = [s.strip() for s in text.split('。') if s.strip()]
    key_points = sentences[:min(3, len(sentences))]
    title = sentences[0][:15] + "..." if sentences else "笔记"
    summary = text[:100] + "..." if len(text) > 100 else text
    
    fallback_notes = {
        'title': title,
        'subject': subject,
        'key_points': key_points,
        'examples': [],
        'summary': summary,
        'tags': [subject, '学习笔记']
    }
    
    print(f"备用笔记标题: {title}")
    return fallback_notes


@note_bp.route('/health', methods=['GET'])
def health_check():
    """API 健康检查"""
    baidu_available = False
    try:
        client = get_baidu_client()
        baidu_available = client is not None
    except:
        pass
    
    health_info = {
        'status': 'healthy',
        'module': 'note_assistant',
        'baidu_speech_available': baidu_available,
        'deepseek_available': bool(DEEPSEEK_API_KEY),
        'total_notes': len(notes_storage)
    }
    
    print(f"健康检查: {json.dumps(health_info, ensure_ascii=False)}")
    
    return jsonify(health_info)