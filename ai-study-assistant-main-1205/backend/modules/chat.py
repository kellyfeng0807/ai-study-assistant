from flask import Blueprint, request, jsonify
from services.ai_service import ai_service

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

@chat_bp.route('/send', methods=['POST'])
def send_message():
    """处理聊天消息"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        user_message = data['message']
        conversation_history = data.get('history', [])
        
        if not user_message.strip():
            return jsonify({
                'success': False,
                'error': 'Message cannot be empty'
            }), 400
        
        # 调用 AI service 获取回复
        try:
            ai_response = ai_service.chat(user_message, conversation_history)
            
            return jsonify({
                'success': True,
                'response': ai_response
            })
        
        except Exception as e:
            print(f"Error calling AI service: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to get AI response'
            }), 500
    
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@chat_bp.route('/clear', methods=['POST'])
def clear_history():
    """清除对话历史"""
    try:
        return jsonify({
            'success': True,
            'message': 'Chat history cleared'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
