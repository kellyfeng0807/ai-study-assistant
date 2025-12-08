"""
配置文件
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """基础配置"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
    # API Keys (从环境变量读取)
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    AZURE_SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY', '')
    AZURE_VISION_KEY = os.getenv('AZURE_VISION_KEY', '')
    
    # 数据库配置 (未来扩展)
    DATABASE_URI = os.getenv('DATABASE_URI', 'sqlite:///study_assistant.db')

class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    TESTING = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}