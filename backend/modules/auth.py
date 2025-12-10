"""
Authentication Module - 用户登录注册
"""

from flask import Blueprint, request, jsonify, session
import os
import sys

# Add parent directory to path so we can import db_sqlite
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from db_sqlite import (
    create_user, 
    get_user_by_email, 
    verify_password,
    get_students_by_parent,
    get_user_settings
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    注册新用户（家长 + 可选的学生账号）
    
    Request body:
    {
        "parent": {
            "email": "parent@example.com",
            "username": "Parent Name",
            "password": "password123"
        },
        "students": [  # 可选
            {
                "username": "Student Name",
                "password": "password123",
                "grade_level": "9",
                "daily_goal": 60
            }
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'parent' not in data:
            return jsonify({
                'success': False,
                'error': 'Parent information is required'
            }), 400
        
        parent_data = data['parent']
        
        # 验证家长数据
        if not parent_data.get('email') or not parent_data.get('username') or not parent_data.get('password'):
            return jsonify({
                'success': False,
                'error': 'Email, username and password are required for parent account'
            }), 400
        
        # 验证邮箱格式
        email = parent_data['email'].strip().lower()
        if '@' not in email or '.' not in email.split('@')[1]:
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 400
        
        # 验证密码长度
        if len(parent_data['password']) < 6:
            return jsonify({
                'success': False,
                'error': 'Password must be at least 6 characters'
            }), 400
        
        # 检查邮箱是否已存在
        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({
                'success': False,
                'error': 'Email already registered'
            }), 400
        
        # 创建家长账号
        parent_id = create_user(
            email=email,
            username=parent_data['username'].strip(),
            password=parent_data['password'],
            account_type='parent',
            parent_id=None,
            grade_level='',
            daily_goal=60,
            avatar_url=parent_data.get('avatar_url')
        )
        
        if not parent_id:
            return jsonify({
                'success': False,
                'error': 'Failed to create parent account'
            }), 500
        
        # 创建学生账号（如果提供）
        students_created = []
        if 'students' in data and data['students']:
            for student_data in data['students']:
                if not student_data.get('username') or not student_data.get('password'):
                    continue
                
                if len(student_data['password']) < 6:
                    continue
                
                student_id = create_user(
                    email='',  # 学生账号不需要邮箱
                    username=student_data['username'].strip(),
                    password=student_data['password'],
                    account_type='student',
                    parent_id=parent_id,
                    grade_level=student_data.get('grade_level', ''),
                    daily_goal=student_data.get('daily_goal', 60),
                    avatar_url=student_data.get('avatar_url')
                )
                
                if student_id:
                    students_created.append({
                        'user_id': student_id,
                        'username': student_data['username']
                    })
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'parent_id': parent_id,
            'students': students_created
        })
        
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/login/check-email', methods=['POST'])
def check_email():
    """
    第一步：检查邮箱并返回关联的账户
    
    Request body:
    {
        "email": "parent@example.com"
    }
    
    Response:
    {
        "success": true,
        "parent": {...},
        "students": [...]
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('email'):
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        email = data['email'].strip().lower()
        
        # 查找家长账号
        parent = get_user_by_email(email)
        if not parent:
            return jsonify({
                'success': False,
                'error': 'Email not found'
            }), 404
        
        # 获取该家长下的所有学生账号
        students = get_students_by_parent(parent['user_id'])
        
        return jsonify({
            'success': True,
            'parent': {
                'user_id': parent['user_id'],
                'username': parent['username'],
                'account_type': 'parent',
                'avatar_url': parent.get('avatar_url')
            },
            'students': students
        })
        
    except Exception as e:
        print(f"Check email error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/login/verify', methods=['POST'])
def login_verify():
    """
    第二步：验证密码并登录
    
    Request body:
    {
        "user_id": "abc123",
        "password": "password123"
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('user_id') or not data.get('password'):
            return jsonify({
                'success': False,
                'error': 'User ID and password are required'
            }), 400
        
        user_id = data['user_id']
        password = data['password']
        
        # 获取用户信息
        user = get_user_settings(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        # 获取完整用户信息（包括密码哈希）
        from db_sqlite import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT password_hash FROM user_settings WHERE user_id=?', (user_id,))
        row = cur.fetchone()
        conn.close()
        
        if not row or not row['password_hash']:
            return jsonify({
                'success': False,
                'error': 'Invalid credentials'
            }), 401
        
        # 验证密码
        if not verify_password(password, row['password_hash']):
            return jsonify({
                'success': False,
                'error': 'Invalid password'
            }), 401
        
        # 登录成功，设置会话
        session['user_id'] = user_id
        session['username'] = user['username']
        session['account_type'] = user['account_type']
        session['logged_in'] = True
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'email': user['email'],
                'account_type': user['account_type'],
                'avatar_url': user.get('avatar_url'),
                'grade_level': user['grade_level'],
                'daily_goal': user['daily_goal']
            }
        })
        
    except Exception as e:
        print(f"Login verify error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """登出"""
    session.clear()
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    })


@auth_bp.route('/session', methods=['GET'])
def get_session():
    """获取当前会话信息"""
    if session.get('logged_in'):
        return jsonify({
            'success': True,
            'logged_in': True,
            'user_id': session.get('user_id'),
            'username': session.get('username'),
            'account_type': session.get('account_type')
        })
    else:
        return jsonify({
            'success': True,
            'logged_in': False
        })
