
FROM python:3.11-slim

WORKDIR /app

# 1. 安装系统依赖
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# 2. 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. 复制项目代码（包括前后端）
COPY . .

# 4. 设置环境变量
ENV FLASK_ENV=production \
    PYTHONUNBUFFERED=1 \
    PORT=5000

# 5. 暴露端口
EXPOSE 5000

# 6. 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health').read()" || exit 1

# 7. 启动方式
CMD ["python", "run.py"]