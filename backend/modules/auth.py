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
        
        # 获取该家长下的所有子账号（包括学生和其他父账号）
        from db_sqlite import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT * FROM user_settings WHERE parent_id=?', (parent['user_id'],))
        children_rows = cur.fetchall()
        conn.close()
        
        students = []
        for child in children_rows:
            students.append({
                'user_id': child['user_id'],
                'username': child['username'],
                'account_type': child['account_type'],
                'email': child['email'] if child['email'] else '',
                'avatar_url': child['avatar_url'] if child['avatar_url'] else None
            })
        
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
        user_id = session.get('user_id')
        
        # 获取完整的用户信息
        try:
            from db_sqlite import get_user_settings
            user_settings = get_user_settings(user_id)
            
            return jsonify({
                'success': True,
                'logged_in': True,
                'user': {
                    'user_id': user_id,
                    'username': user_settings.get('username', session.get('username')),
                    'email': user_settings.get('email', ''),
                    'account_type': user_settings.get('account_type', session.get('account_type')),
                    'avatar_url': user_settings.get('avatar_url')
                }
            })
        except Exception as e:
            # 如果获取设置失败，返回 session 中的基本信息
            return jsonify({
                'success': True,
                'logged_in': True,
                'user': {
                    'user_id': user_id,
                    'username': session.get('username'),
                    'email': '',
                    'account_type': session.get('account_type')
                }
            })
    else:
        return jsonify({
            'success': True,
            'logged_in': False
        })


@auth_bp.route('/accounts', methods=['POST'])
def get_accounts_by_email():
    """获取同一邮箱下的所有账号"""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        # 获取父账号
        parent_user = get_user_by_email(email)
        if not parent_user:
            return jsonify({
                'success': False,
                'error': 'No account found with this email'
            }), 404
        
        accounts = []
        
        # 添加父账号
        accounts.append({
            'user_id': parent_user['user_id'],
            'username': parent_user['username'],
            'account_type': parent_user['account_type'],
            'email': parent_user['email']
        })
        
        # 获取所有子账号（包括学生和其他父账号）用于账号切换
        from db_sqlite import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT * FROM user_settings WHERE parent_id=?', (parent_user['user_id'],))
        children = cur.fetchall()
        conn.close()
        
        for child in children:
            accounts.append({
                'user_id': child['user_id'],
                'username': child['username'],
                'account_type': child['account_type'],
                'email': child['email'] if child['email'] else ''
            })
        
        return jsonify({
            'success': True,
            'accounts': accounts
        })
        
    except Exception as e:
        print(f"Get accounts error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/parent-email', methods=['POST'])
def get_parent_email():
    """获取父账号的邮箱（用于学生账号切换）"""
    try:
        data = request.get_json()
        parent_id = data.get('parent_id')
        
        if not parent_id:
            return jsonify({
                'success': False,
                'error': 'Parent ID is required'
            }), 400
        
        # 获取父账号信息
        parent_settings = get_user_settings(parent_id)
        
        if not parent_settings:
            return jsonify({
                'success': False,
                'error': 'Parent account not found'
            }), 404
        
        return jsonify({
            'success': True,
            'email': parent_settings.get('email', '')
        })
        
    except Exception as e:
        print(f"Get parent email error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/children', methods=['GET'])
def get_children():
    """获取当前登录家长的所有子女账号"""
    try:
        # 从session获取当前登录用户的user_id
        user_id = session.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        # 获取当前用户信息，确认是家长账号
        current_user = get_user_settings(user_id)
        
        if not current_user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        # 只有家长账号才能查询子女列表
        if current_user.get('account_type') != 'parent':
            return jsonify({
                'success': False,
                'error': 'Only parent accounts can access this endpoint'
            }), 403
        
        # 找到根父账号 - 如果当前用户是子父账号，向上查找直到根父账号
        root_parent_id = user_id
        finding_parent = current_user
        
        while finding_parent and finding_parent.get('parent_id'):
            root_parent_id = finding_parent.get('parent_id')
            finding_parent = get_user_settings(root_parent_id)
        
        # 获取根父账号下的所有子账号（包括学生和其他父账号）
        from db_sqlite import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('SELECT * FROM user_settings WHERE parent_id=?', (root_parent_id,))
        rows = cur.fetchall()
        conn.close()
        
        children = []
        for row in rows:
            children.append({
                'user_id': row['user_id'],
                'username': row['username'],
                'email': row['email'],
                'account_type': row['account_type'],
                'avatar_url': row['avatar_url'] if 'avatar_url' in row.keys() else None,
                'grade_level': row['grade_level'],
                'daily_goal': row['daily_goal']
            })
        
        return jsonify({
            'success': True,
            'children': children
        })
        
    except Exception as e:
        print(f"Get children error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/update-profile', methods=['POST'])
def update_profile():
    """更新当前用户的个人信息"""
    try:
        user_id = session.get('user_id')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # 导入数据库函数
        from db_sqlite import get_conn, hash_password
        
        conn = get_conn()
        cursor = conn.cursor()
        
        # 构建更新语句
        updates = []
        params = []
        
        if 'username' in data:
            updates.append('username = ?')
            params.append(data['username'])
        
        if 'password' in data:
            password_hash = hash_password(data['password'])
            updates.append('password_hash = ?')
            params.append(password_hash)
        
        if not updates:
            return jsonify({
                'success': False,
                'error': 'No valid fields to update'
            }), 400
        
        # 执行更新
        params.append(user_id)
        query = f"UPDATE user_settings SET {', '.join(updates)} WHERE user_id = ?"
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        # 更新session中的username
        if 'username' in data:
            session['username'] = data['username']
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully'
        })
        
    except Exception as e:
        print(f"Update profile error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/update-student', methods=['POST'])
def update_student():
    """家长更新学生账号信息"""
    try:
        parent_id = session.get('user_id')
        account_type = session.get('account_type')
        
        if not parent_id or account_type != 'parent':
            return jsonify({
                'success': False,
                'error': 'Only parent accounts can update student information'
            }), 403
        
        data = request.get_json()
        
        if not data or 'user_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Student user_id is required'
            }), 400
        
        student_id = data['user_id']
        
        # 导入数据库函数
        from db_sqlite import get_conn, hash_password
        
        conn = get_conn()
        cursor = conn.cursor()
        
        # 验证该学生是否属于当前家长
        cursor.execute('SELECT parent_id FROM user_settings WHERE user_id = ?', (student_id,))
        result = cursor.fetchone()
        
        if not result or result[0] != parent_id:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'You can only update your own student accounts'
            }), 403
        
        # 构建更新语句
        updates = []
        params = []
        
        if 'username' in data:
            updates.append('username = ?')
            params.append(data['username'])
        
        if 'password' in data:
            password_hash = hash_password(data['password'])
            updates.append('password_hash = ?')
            params.append(password_hash)
        
        if 'grade_level' in data:
            updates.append('grade_level = ?')
            params.append(str(data['grade_level']))
        
        if 'daily_goal' in data:
            updates.append('daily_goal = ?')
            params.append(int(data['daily_goal']))
        
        if not updates:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'No valid fields to update'
            }), 400
        
        # 执行更新
        params.append(student_id)
        query = f"UPDATE user_settings SET {', '.join(updates)} WHERE user_id = ?"
        cursor.execute(query, params)
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Student information updated successfully'
        })
        
    except Exception as e:
        print(f"Update student error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/create-child', methods=['POST'])
def create_child():
    """家长创建子账号（学生或其他家长）"""
    try:
        parent_id = session.get('user_id')
        account_type = session.get('account_type')
        
        if not parent_id or account_type != 'parent':
            return jsonify({
                'success': False,
                'error': 'Only parent accounts can create child accounts'
            }), 403
        
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({
                'success': False,
                'error': 'Username and password are required'
            }), 400
        
        if len(data['password']) < 6:
            return jsonify({
                'success': False,
                'error': 'Password must be at least 6 characters'
            }), 400
        
        child_account_type = data.get('account_type', 'student')
        
        if child_account_type not in ['student', 'parent']:
            return jsonify({
                'success': False,
                'error': 'Invalid account type'
            }), 400
        
        # 获取邮箱，家长账号使用母账号邮箱
        email = data.get('email', '').strip().lower()
        if child_account_type == 'parent' and not email:
            # 自动使用母账号的邮箱
            parent_user = get_user_settings(parent_id)
            if parent_user and parent_user.get('email'):
                email = parent_user.get('email')
            else:
                return jsonify({
                    'success': False,
                    'error': 'Cannot determine email for parent account'
                }), 400
        
        # 创建账号 - all accounts link to root parent
        # 找到真实的根父账。如果筛选者是歐号。浮加程序的下级账号，不断向上黎查找直到找到parent_id为NULL的账号
        from db_sqlite import get_conn
        finding_parent = get_user_settings(parent_id)
        root_parent_id = parent_id
        
        # Keep going up the hierarchy until we find the root parent (one with no parent_id)
        while finding_parent and finding_parent.get('parent_id'):
            root_parent_id = finding_parent.get('parent_id')
            finding_parent = get_user_settings(root_parent_id)
        
        child_id = create_user(
            email=email,
            username=data['username'].strip(),
            password=data['password'],
            account_type=child_account_type,
            parent_id=root_parent_id,  # Links to root parent so all accounts share same family
            grade_level=str(data.get('grade_level', '')) if child_account_type == 'student' else '',
            daily_goal=int(data.get('daily_goal', 60)) if child_account_type == 'student' else 60,
            avatar_url=data.get('avatar_url')
        )
        
        if not child_id:
            return jsonify({
                'success': False,
                'error': 'Failed to create account'
            }), 500
        
        return jsonify({
            'success': True,
            'message': f'{child_account_type.capitalize()} account created successfully',
            'user_id': child_id
        })
        
    except Exception as e:
        print(f"Create child error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/delete-child', methods=['POST'])
def delete_child():
    """家长删除子账号"""
    try:
        parent_id = session.get('user_id')
        account_type = session.get('account_type')
        
        if not parent_id or account_type != 'parent':
            return jsonify({
                'success': False,
                'error': 'Only parent accounts can delete child accounts'
            }), 403
        
        data = request.get_json()
        user_id_to_delete = data.get('user_id')
        
        if not user_id_to_delete:
            return jsonify({
                'success': False,
                'error': 'User ID is required'
            }), 400
        
        # 验证该账号确实是当前家长的子账号
        from db_sqlite import get_conn
        conn = get_conn()
        cur = conn.cursor()
        
        cur.execute('SELECT parent_id FROM user_settings WHERE user_id=?', (user_id_to_delete,))
        row = cur.fetchone()
        
        if not row:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        if row['parent_id'] != parent_id:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'You do not have permission to delete this account'
            }), 403
        
        # 删除账号及其所有相关数据
        cur.execute('DELETE FROM user_settings WHERE user_id=?', (user_id_to_delete,))
        # Delete from tables that exist
        cur.execute('DELETE FROM module_usage WHERE user_id=?', (user_id_to_delete,))
        cur.execute('DELETE FROM error_book WHERE user_id=?', (user_id_to_delete,))
        cur.execute('DELETE FROM practice_record WHERE user_id=?', (user_id_to_delete,))
        cur.execute('DELETE FROM note WHERE user_id=?', (user_id_to_delete,))
        cur.execute('DELETE FROM mindmap WHERE user_id=?', (user_id_to_delete,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        })
        
    except Exception as e:
        print(f"Delete child error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@auth_bp.route('/switch', methods=['POST'])
def switch_account():
    """切换账号（需要密码验证）"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        password = data.get('password')
        
        print(f"Switch account request - user_id: {user_id}")
        
        if not user_id or not password:
            return jsonify({
                'success': False,
                'error': 'User ID and password are required'
            }), 400
        
        # 获取目标用户信息
        from db_sqlite import get_user_settings
        target_user = get_user_settings(user_id)
        
        if not target_user:
            print(f"User not found: {user_id}")
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404
        
        # 验证密码
        password_hash = target_user.get('password_hash', '')
        print(f"Password hash exists: {bool(password_hash)}")
        
        if not password_hash:
            print(f"No password hash found for user: {user_id}")
            return jsonify({
                'success': False,
                'error': 'Account has no password set'
            }), 401
        
        password_valid = verify_password(password, password_hash)
        print(f"Password valid: {password_valid}")
        
        if not password_valid:
            return jsonify({
                'success': False,
                'error': 'Invalid password'
            }), 401
        
        # 更新 session
        session['user_id'] = target_user['user_id']
        session['username'] = target_user['username']
        session['account_type'] = target_user['account_type']
        session['logged_in'] = True
        
        print(f"Account switched successfully to: {target_user['username']}")
        
        return jsonify({
            'success': True,
            'message': 'Account switched successfully',
            'user': {
                'user_id': target_user['user_id'],
                'username': target_user['username'],
                'account_type': target_user['account_type']
            }
        })
        
    except Exception as e:
        print(f"Switch account error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
