# 1. 选择一个包含 Python 和 apt 包管理器的基础镜像
# 'slim' 版本体积较小，适合部署
FROM python:3.11-slim

# 2. 设置工作目录
WORKDIR /app

# 3. 安装 FFmpeg
# FFmpeg 不是 Python 依赖，需要使用系统级的包管理器安装
# - apt-get update: 更新包列表
# - apt-get install -y ffmpeg: 安装 ffmpeg 及其所有依赖
# - rm -rf ...: 清理缓存，减小最终镜像体积
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# 4. 复制并安装 Python 依赖
# 先复制 requirements.txt 以利用 Docker 缓存
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 复制项目代码
COPY . .

# 6. 定义启动命令
# 假设您使用 Gunicorn 启动您的 Flask 或 Django 应用
# 请将 'your_app_module:app' 替换为您实际的启动入口
CMD ["gunicorn", "run:create_app()", "--bind", "0.0.0.0:$PORT", "--workers", "2"]
