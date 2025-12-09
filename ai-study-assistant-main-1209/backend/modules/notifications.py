"""
Notifications Module
管理通知的创建、读取、更新和删除
"""

from flask import Blueprint, request, jsonify
import db_sqlite

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')


@notifications_bp.route('/list', methods=['GET'])
def list_notifications():
    """获取通知列表"""
    user_id = int(request.args.get('user_id', 1))
    limit = int(request.args.get('limit', 50))
    
    try:
        notifications = db_sqlite.list_notifications(user_id=user_id, limit=limit)
        return jsonify({
            'success': True,
            'notifications': notifications,
            'total': len(notifications)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@notifications_bp.route('/create', methods=['POST'])
def create_notification():
    """创建新通知"""
    data = request.get_json()
    
    if not data or 'title' not in data or 'message' not in data:
        return jsonify({'success': False, 'error': 'Title and message are required'}), 400
    
    try:
        notif_id = db_sqlite.insert_notification(
            user_id=data.get('user_id', 1),
            title=data['title'],
            message=data['message'],
            notif_type=data.get('type', 'info'),
            icon=data.get('icon', 'fa-bell'),
            link=data.get('link')
        )
        
        return jsonify({
            'success': True,
            'notification_id': notif_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@notifications_bp.route('/mark-read/<int:notification_id>', methods=['POST'])
def mark_read(notification_id):
    """标记通知为已读"""
    try:
        success = db_sqlite.mark_notification_read(notification_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@notifications_bp.route('/mark-all-read', methods=['POST'])
def mark_all_read():
    """标记所有通知为已读"""
    user_id = int(request.get_json().get('user_id', 1))
    
    try:
        count = db_sqlite.mark_all_notifications_read(user_id)
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@notifications_bp.route('/delete/<int:notification_id>', methods=['DELETE'])
def delete_notification(notification_id):
    """删除通知"""
    try:
        success = db_sqlite.delete_notification(notification_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
