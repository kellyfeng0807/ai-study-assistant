# AI Study Assistant

智能学习助手 - 中学生个性化学习伴侣

## 项目简介

AI Study Assistant 是一个基于人工智能的学习辅助系统，专为中学生设计。系统提供笔记生成、错题管理、思维导图、学习数据分析等功能。

## 核心功能

### 笔记助手 (Note Assistant)
- **录音转写**：使用 Whisper 或其他语音识别 API
- **智能笔记生成**：提取关键点和示例
- **LLM 总结**：自动生成结构化笔记

### 思维导图生成 (Map Generation - Optional)
- **层次化内容转换**：将笔记转换为可视化导图
- **交互式编辑**：使用 Mermaid.js 等图形库
- **多格式导出**：PNG、SVG、PDF

### 错题本管理 (Error Book Manager)
- **拍照上传**：智能识别题目
- **OCR 识别**：自动提取文字
- **智能分类**：LLM 自动分类题目类型
- **生成练习**：基于错题生成相似练习

### 学习数据分析 (Learning Dashboard)
- **学习时长统计**
- **技能水平追踪**
- **进度可视化**
- **数据图表展示**

### 设置 (Settings)
- 账户设置
- AI 功能配置
- 通知设置
- 主题切换
- 数据管理

## 技术栈

### 后端
- **Python 3.8+**
- **Flask** - Web 框架
- **Flask-CORS** - 跨域支持
- **Pillow** - 图像处理
- **OpenAI API** - LLM 功能（可选）
- **Azure Cognitive Services** - 语音识别和 OCR（可选）

### 前端
- **HTML5 + CSS3 + JavaScript**
- **Font Awesome** - 图标库
- **现代化设计风格** - 参考在线课程仪表板

## 项目结构

```
ai-study-assistant/
├── backend/
│   ├── app.py                    # 主应用（废弃，使用run.py）
│   ├── run.py                    # 应用启动文件
│   ├── config.py                 # 配置管理
│   ├── ui_controller.py          # UI控制器 - 管理页面路由和交互
│   ├── modules/                  # 功能模块
│   │   ├── __init__.py
│   │   ├── note_assistant.py     # 笔记助手
│   │   ├── map_generation.py     # 思维导图
│   │   ├── error_book.py         # 错题本
│   │   └── learning_dashboard.py # 学习分析
│   ├── requirements.txt          # Python依赖
│   └── .env.example             # 环境变量示例
├── frontend/
│   ├── index.html               # Dashboard 主页
│   ├── settings.html            # 设置页面
│   ├── note-assistant.html      # 笔记助手（待创建）
│   ├── map-generation.html      # 思维导图（待创建）
│   ├── error-book.html          # 错题本（待创建）
│   ├── learning-dashboard.html  # 学习分析（待创建）
│   └── static/
│       ├── css/
│       │   ├── main.css         # 全局样式
│       │   ├── dashboard.css    # Dashboard样式
│       │   └── settings.css     # 设置页面样式
│       ├── js/
│       │   ├── main.js          # 全局JavaScript
│       │   ├── dashboard.js     # Dashboard逻辑
│       │   └── settings.js      # 设置页面逻辑
│       └── assets/              # 图片等资源
└── README.md
```

## 安装和运行

### 1. 安装后端依赖

```powershell
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 API 密钥：

```powershell
copy .env.example .env
```

编辑 `.env` 文件，填入必要的 API 密钥。

### 3. 启动后端服务

```powershell
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 4. 访问前端

在浏览器中打开：
- Dashboard: `http://localhost:5000/`
- 设置: `http://localhost:5000/settings`

## API 文档

### UI 控制 API

- `POST /api/ui/navigate` - 页面跳转控制
- `POST /api/ui/animate` - 触发动画
- `POST /api/ui/notify` - 发送通知
- `GET/POST /api/ui/theme` - 主题管理

### 笔记助手 API

- `POST /api/note/transcribe` - 转写音频
- `POST /api/note/generate` - 生成笔记
- `GET /api/note/list` - 获取笔记列表

### 错题本 API

- `POST /api/errorbook/upload` - 上传错题图片
- `POST /api/errorbook/categorize` - 分类错题
- `POST /api/errorbook/generate-exercises` - 生成练习
- `GET /api/errorbook/list` - 获取错题列表

### 学习分析 API

- `GET /api/dashboard/stats` - 获取学习统计
- `GET /api/dashboard/progress` - 获取学习进度
- `GET /api/dashboard/chart-data` - 获取图表数据

## 开发计划

- [x] 后端基础架构
- [x] UI 控制器
- [x] Dashboard 页面
- [x] 设置页面
- [ ] 笔记助手页面
- [ ] 错题本页面
- [ ] 思维导图页面
- [ ] 学习分析页面
- [ ] API 集成（Whisper、OCR、LLM）
- [ ] 数据持久化（数据库）
- [ ] 用户认证系统

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
