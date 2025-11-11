"""
AI Study Assistant - 启动文件
整合所有模块和UI控制器
"""

from flask import Flask, send_from_directory
from flask_cors import CORS
import os

from config import config
from ui_controller import ui_bp
from modules.note_assistant import note_bp
from modules.map_generation import map_bp
from modules.error_book import error_bp
from modules.learning_dashboard import dashboard_bp

def create_app(config_name='development'):
    """应用工厂函数"""
    app = Flask(__name__, 
                static_folder='../frontend',
                static_url_path='')
    
    # 加载配置
    app.config.from_object(config[config_name])
    
    # 启用CORS
    CORS(app)
    
    # 注册蓝图
    app.register_blueprint(ui_bp)
    app.register_blueprint(note_bp)
    app.register_blueprint(map_bp)
    app.register_blueprint(error_bp)
    app.register_blueprint(dashboard_bp)
    
    # 静态文件路由
    @app.route('/static/<path:path>')
    def send_static(path):
        return send_from_directory('../frontend/static', path)
    
    @app.route('/assets/<path:path>')
    def send_assets(path):
        return send_from_directory('../frontend/assets', path)
    
    # 健康检查
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'message': 'AI Study Assistant is running'}
    
    return app

if __name__ == '__main__':
    app = create_app('development')
    print("AI Study Assistant Backend Starting...")
    print("Server running on: http://localhost:5000")
    print("API Documentation: http://localhost:5000/api/health")
    app.run(debug=True, host='0.0.0.0', port=5000)
