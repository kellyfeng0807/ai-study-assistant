"""
UI Controller - Controls web page navigation, animations, and interactions
"""

from flask import Blueprint, request, jsonify, send_from_directory
import os

ui_bp = Blueprint('ui', __name__)

FRONTEND_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')

@ui_bp.route('/')
def index():
    return send_from_directory(FRONTEND_PATH, 'index.html')

@ui_bp.route('/dashboard')
def dashboard():
    # Dashboard is the same as index page
    return send_from_directory(FRONTEND_PATH, 'index.html')

@ui_bp.route('/note-assistant')
def note_assistant():
    return send_from_directory(FRONTEND_PATH, 'note-assistant.html')

@ui_bp.route('/map-generation')
def map_generation():
    return send_from_directory(FRONTEND_PATH, 'map-generation.html')

@ui_bp.route('/error-book')
def error_book():
    return send_from_directory(FRONTEND_PATH, 'error-book.html')

@ui_bp.route('/learning-dashboard')
def learning_dashboard():
    return send_from_directory(FRONTEND_PATH, 'learning-dashboard.html')

@ui_bp.route('/settings')
def settings():
    return send_from_directory(FRONTEND_PATH, 'settings.html')

@ui_bp.route('/api/ui/animate', methods=['POST'])
def trigger_animation():
    data = request.json
    animation_type = data.get('type', 'fade')
    target = data.get('target', '')
    
    return jsonify({
        'success': True,
        'animation': animation_type,
        'target': target
    })

@ui_bp.route('/api/ui/notify', methods=['POST'])
def send_notification():
    data = request.json
    message = data.get('message', '')
    notify_type = data.get('type', 'info')
    
    return jsonify({
        'success': True,
        'message': message,
        'type': notify_type
    })

@ui_bp.route('/api/ui/theme', methods=['GET', 'POST'])
def manage_theme():
    if request.method == 'POST':
        data = request.json
        theme = data.get('theme', 'light')
        return jsonify({
            'success': True,
            'theme': theme
        })
    else:
        return jsonify({
            'theme': 'light'
        })

@ui_bp.route('/api/ui/navigate', methods=['POST'])
def navigate():
    data = request.json
    target_page = data.get('page', 'dashboard')
    animation = data.get('animation', 'slide')
    
    return jsonify({
        'success': True,
        'redirect': f'/{target_page}',
        'animation': animation
    })
