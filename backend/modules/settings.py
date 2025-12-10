"""
User Settings Module
"""

from flask import Blueprint, request, jsonify, session
import os
import json
from datetime import datetime
import sys

# Add parent directory to path so we can import db_sqlite
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from db_sqlite import get_user_settings, update_user_settings, update_password, verify_password

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@settings_bp.route('/', methods=['GET'])
def get_settings():
    """获取用户设置"""
    try:
        # Get user_id from session
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        settings = get_user_settings(user_id=user_id)
        return jsonify({
            'success': True,
            'settings': settings
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@settings_bp.route('/', methods=['PUT'])
def update_settings():
    """更新用户设置"""
    try:
        # Get user_id from session
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        data = request.get_json()
        
        # 验证必需字段
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # 准备更新的设置（不包括密码）
        settings = {}
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
        
        # 处理密码修改（单独处理）
        password_updated = False
        if 'password' in data and data['password']:
            password = data['password']
            if len(password) < 6:
                return jsonify({
                    'success': False,
                    'error': 'Password must be at least 6 characters'
                }), 400
            if update_password(user_id, password):
                password_updated = True
        
        # 保存其他设置到数据库
        settings_updated = False
        if settings:
            settings_updated = update_user_settings(settings, user_id=user_id)
        
        if settings_updated or password_updated or not settings:
            updated_settings = get_user_settings(user_id=user_id)
            return jsonify({
                'success': True,
                'settings': updated_settings,
                'message': 'Settings updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update settings'
            }), 500
    
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
        # TODO: Get user_id from session after auth system is implemented
        user_id = 'default'
        
        default_settings = {
            'username': 'Student',
            'email': '',
            'grade_level': '',
            'daily_goal': 60
        }
        
        if update_user_settings(default_settings, user_id=user_id):
            settings = get_user_settings(user_id=user_id)
            return jsonify({
                'success': True,
                'settings': settings,
                'message': 'Settings reset to default'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to reset settings'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
