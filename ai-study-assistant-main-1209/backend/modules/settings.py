"""
User Settings Module
"""

from flask import Blueprint, request, jsonify
import os
import json
from datetime import datetime

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

DATA_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'data')
SETTINGS_FILE = os.path.join(DATA_FOLDER, 'user_settings.json')

# 确保目录存在
os.makedirs(DATA_FOLDER, exist_ok=True)

def load_settings():
    """加载用户设置"""
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    # 默认设置
    return {
        'username': 'Student',
        'email': 'student@example.com',
        'grade_level': '9',
        'daily_goal': 120,
        'updated_at': datetime.now().isoformat()
    }

def save_settings(settings):
    """保存用户设置"""
    settings['updated_at'] = datetime.now().isoformat()
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)

@settings_bp.route('/', methods=['GET'])
def get_settings():
    """获取用户设置"""
    try:
        settings = load_settings()
        return jsonify({
            'success': True,
            'settings': settings
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@settings_bp.route('/', methods=['PUT'])
def update_settings():
    """更新用户设置"""
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # 加载当前设置
        settings = load_settings()
        
        # 更新字段
        if 'username' in data:
            settings['username'] = data['username']
        if 'email' in data:
            settings['email'] = data['email']
        if 'grade_level' in data:
            settings['grade_level'] = str(data['grade_level'])
        if 'daily_goal' in data:
            daily_goal = int(data['daily_goal'])
            if daily_goal < 30 or daily_goal > 480:
                return jsonify({
                    'success': False,
                    'error': 'Daily goal must be between 30 and 480 minutes'
                }), 400
            settings['daily_goal'] = daily_goal
        
        # 保存设置
        save_settings(settings)
        
        return jsonify({
            'success': True,
            'settings': settings,
            'message': 'Settings updated successfully'
        })
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid data format'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@settings_bp.route('/reset', methods=['POST'])
def reset_settings():
    """重置为默认设置"""
    try:
        default_settings = {
            'username': 'Student',
            'email': 'student@example.com',
            'grade_level': '9',
            'daily_goal': 120,
            'updated_at': datetime.now().isoformat()
        }
        
        save_settings(default_settings)
        
        return jsonify({
            'success': True,
            'settings': default_settings,
            'message': 'Settings reset to default'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
