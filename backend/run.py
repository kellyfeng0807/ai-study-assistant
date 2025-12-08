"""
AI Study Assistant - 启动文件
整合所有模块和UI控制器
"""

from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv()

from config import config
from ui_controller import ui_bp
from modules.note_assistant_db import bp as note_bp
from modules.map_generation import map_bp
from modules.error_book import error_bp
from modules.learning_dashboard import dashboard_bp
from modules.chat import chat_bp
from modules.settings import settings_bp
from modules.notifications import notifications_bp

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
    app.register_blueprint(chat_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(notifications_bp)
    
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
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--init-db', action='store_true', help='Initialize sqlite DB tables and migrate JSON notes')
    args = parser.parse_args()

    # 检测运行环境
    is_render = os.getenv('RENDER') == 'true'
    port = int(os.getenv('PORT', 5000))
    
    # 根据环境选择配置
    config_name = 'production' if is_render else 'development'
    app = create_app(config_name)
    
    print("=" * 50)
    print("AI Study Assistant Backend Starting...")
    print("=" * 50)
    if is_render:
        print(f"Environment: Render Production")
        print(f"Listening at: http://0.0.0.0:{port}")
    else:
        print(f"Environment: Local Development")
        print(f"Server: http://localhost:{port}")
        print(f"Mind Map: http://localhost:{port}/map-generation")
        print(f"Health Check: http://localhost:{port}/api/health")
    
    # 如果请求，初始化 DB 并迁移 JSON notes
    if args.init_db:
        try:
            import db_sqlite
            print('Initializing sqlite DB (all tables)...')
            db_sqlite.init_db()  # Now initializes all tables: note, mindmap, error_book, study_progress
            # run migration script if available
            
            print('sqlite DB initialized')
        except Exception as e:
            print('DB init failed:', e)

    # 检查DeepSeek API Key
    if not os.environ.get('DEEPSEEK_API_KEY'):
        print("\nWARNING: DEEPSEEK_API_KEY not set!")
        print("   AI features will use fallback mode.")
        print("   Set your API key in backend/.env file")
    else:
        print("DeepSeek API Key loaded")
    
    print("=" * 50)
    
    # Render 环境使用生产模式，本地使用调试模式
    app.run(debug=not is_render, host='0.0.0.0', port=port)