# AI Study Assistant

Intelligent Learning Companion - Personalized Study Assistant for Secondary Students

**Live Demo**: [https://ai-study-assistant-2ozw.onrender.com](https://ai-study-assistant-2ozw.onrender.com)

## Project Overview

AI Study Assistant is an AI-powered learning system designed for secondary school students. The system provides intelligent note generation, error tracking, mind map visualization, and learning analytics. It features a multi-account system (parents and students) with comprehensive user authentication and permission management.

## Key Features

### User Authentication & Account Management
- **Multi-account System**: Support for parent and student accounts
- **Account Switching**: Easily switch between different accounts with same email account
- **Parent Dashboard**: Monitor children's learning progress
- **Profile Management**: User information and avatar settings

### Note Assistant
- **Speech-to-Text**: iFLYTEK ASR with auto language detection (Chinese/English)
- **Image/PDF OCR**: Qwen-VL for text extraction
- **AI-Powered Note Generation**: DeepSeek LLM automatically generates title, summary, key points, and examples
- **Structured Output**: Markdown format with LaTeX math formula support
- **Note Management**: Save, edit, filter, and delete notes

### Mind Map Generation
- **Multiple Input Methods**: Generate from notes, uploaded files, or manual input
- **Mermaid Visualization**: Interactive mind map display
- **Auto Layout**: Intelligent layers descision
- **Multiple Type of Graph**: Sipport different type of mind map including mindmap, hierarchical topdown map, hierarchical left-right map styles
- **Export**: Export mindmap in PNG format
- **Code editting and whiteboard**: Edit the generated map by editing mermaid code to eidt the structure or drag the nodes in white board to adjust layout

### Error Book 
- **Upload**: Upload a photo of a problem.
- **AI Recognition & Solution**: Qwen-VL recognizes both the problem and handwritten user answer, and classifies it by subject, knowledge point, ect.
- **Review**:View full error details and reattempt the problem anytime to check your understanding.
- **Practice**:DeepSeek generates similar practice problems, and users can solve them by uploading an image or entering text.

### Learning Analytics Dashboard
- **Learning Statistics**: Study duration, note count, problem count
- **Knowledge Point Tracking**: Statistics organized by subject and knowledge point
- **Progress Visualization**: Charts showing learning trends
- **Daily Goals**: Set and track learning targets
- **AI Suggestions**: Provides suggetions based on the current use of the platform of the account

### Settings
- **Account Settings**: Modify username, password
- **Student Management** (Parents): Create, edit, and delete student/ parente accounts
- **Learning Goals**: Customize daily study duration targets

### Account
- **Log Out**: Log out exiting account
- **Switch Account**: Switch to the account that share the same email of the exsting login account

## Tech Stack

### Backend
- **Python 3.8+**
- **Flask 3.0.0** - Lightweight web framework
- **Flask-CORS 4.0.0** - Cross-Origin Resource Sharing
- **SQLite3** - Lightweight database
- **Deepseek & Qwen** - LLM features (note generation, problem classification, etc.)
- **Whisper/iFLYTEK ASR** - Speech recognition
- **Pillow** - Image processing library
- **PyPDF2** - PDF processing
- **OpenCV** - Computer vision

### Frontend
- **HTML5 + CSS3 + JavaScript (Vanilla)**
- **Font Awesome 6** - Icon library
- **MathJax** - Math formula rendering
- **Mermaid.js** - Mind map visualization
- **Modern Design** - Responsive layout

### Deployment
- **Render** - Cloud platform
- **Gunicorn** - WSGI application server

## Project Structure

```
ai-study-assistant/
├── backend/
│   ├── run.py                    # Application entry point
│   ├── config.py                 # Configuration management
│   ├── db_sqlite.py              # SQLite database operations
│   ├── ui_controller.py          # UI route controller
│   ├── migrate_db.py             # Database migration script
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Docker configuration
│   ├── .env.example              # Environment variables example
│   ├── modules/                  # Feature modules
│   │   ├── auth.py               # User authentication and account management
│   │   ├── note_assistant.py     # Note assistant (note generation, management)
│   │   ├── map_generation.py     # Mind map generation
│   │   ├── error_book.py         # Error book management
│   │   ├── learning_dashboard.py # Learning analytics
│   │   ├── notifications.py      # Message notifications
│   │   ├── settings.py           # User settings
│   │   ├── track.py              # Learning tracking
│   │   └── chat.py               # AI chat
│   ├── services/
│   │   └── ai_service.py         # AI service integration (LLM, speech, OCR)
│   ├── scripts/
│   │   └── migrate_notes_to_db.py # Data migration script
│   └── uploads/                  # File upload directory
│       ├── notes/
│       ├── mindmaps/
│       └── error-book/
├── frontend/
│   ├── index.html                # Home page / Login
│   ├── login.html                # Login page
│   ├── register.html             # Registration page
│   ├── dashboard.html            # Dashboard (Home)
│   ├── settings.html             # User settings page
│   ├── parent-settings.html      # Parent settings page
│   ├── parent-view.html          # Parent view of children's data
│   ├── note-assistant.html       # Note assistant page
│   ├── map-generation.html       # Mind map generation page
│   ├── error-book.html           # Error book list page
│   ├── error-practice.html       # Error practice page
│   ├── error-review.html         # Error review page
│   ├── learning-dashboard.html   # Learning analytics page
│   └── static/
│       ├── css/
│       │   ├── main.css          # Global styles
│       │   ├── auth.css          # Auth page styles
│       │   ├── dashboard.css     # Dashboard styles
│       │   ├── settings.css      # Settings page styles
│       │   ├── note-assistant.css
│       │   ├── map-generation.css
│       │   ├── error-book.css
│       │   ├── learning-dashboard.css
│       │   └── ...
│       └── js/
│           ├── main.js           # Global JavaScript
│           ├── config.js         # Configuration
│           ├── login.js          # Login logic
│           ├── dashboard.js      # Dashboard logic
│           ├── note-assistant.js
│           ├── map-generation.js
│           ├── error-book.js
│           ├── error-practice.js
│           └── ...
├── README.md
└── doccker-compse.yml             # Docker compose
```

## Installation & Running

### Prerequisites

- Python 3.8 or higher
- pip package manager
- Node.js (optional, frontend uses vanilla JS)

### Using Docker (Recommeded)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ai-study-assistant.git
cd ai-study-assistant
```
### 2. Open docker

Open Docker Destop to connect to the hub

```bash
docker-compose up -d
```

### Otherwise

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ai-study-assistant.git
cd ai-study-assistant
```

### 2. Create Python Virtual Environment 

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Main Dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 3.0.0 | Web framework |
| flask-cors | 4.0.0 | CORS support |
| openai | ≥1.0.0 | OpenAI API (LLM and Whisper) |
| baidu-aip | 2.2.13 | Baidu OCR and image processing |
| dashscope | 1.25.2 | Alibaba Qwen LLM |
| Pillow | 10.1.0 | Image processing |
| PyPDF2 | 3.0.1 | PDF processing |
| opencv-python | 4.8.0.74 | Computer vision |
| pydub | 0.25.1 | Audio processing |
| numpy | 1.26.2 | Numerical computing |
| pandas | 2.1.4 | Data analysis |

### 4. Configure Environment Variables

Copy and edit `.env.example` to `.env`:

```bash
cp .env.example .env  # macOS/Linux
copy .env.example .env  # Windows
```


### 5. Start Backend Service

```bash
# Run in backend directory
python run.py
```

**Example output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### 6. Access the Application

Open in your browser:

- **Home/Login**: [http://localhost:5000](http://localhost:5000)
- **Register**: [http://localhost:5000/register](http://localhost:5000/register)
- **Dashboard**: [http://localhost:5000/dashboard](http://localhost:5000/dashboard) (login required)

## Main Pages Guide

### 1. User Authentication
- First-time users: Click "Register" to create a new account
- Parent accounts: Can directly add student sub-accounts after creation
- Account switching: Switch between different accounts from the sidebar after login

### 2. Note Assistant
- Support three methods: voice recording, file upload, or manual input
- System automatically generates structured notes (title, summary, key points, examples)
- Support Markdown format and LaTeX math formulas

### 3. Mind Map
- Generate mind maps from notes, files, or text
- Customize depth and style
- Export to PNG or SVG format

### 4. Error Book
- Upload problem images or PDFs
- Automatic OCR recognition of problems
- Generate similar practice problems for review
- Track problem-solving records and analysis

### 5. Learning Dashboard
- View learning statistics (total notes, problems, study duration)
- Track learning progress by subject
- Monitor daily learning goal completion

## Deployment

### Local Development
See "Start Backend Service" section above

### Docker Deployment

```bash
# Build Docker image
docker build -t ai-study-assistant .

# Run container
docker run -p 5000:5000 --env-file .env ai-study-assistant
```

### Render Cloud Platform Deployment

Project is deployed on Render at:
**[https://ai-study-assistant-2ozw.onrender.com](https://ai-study-assistant-2ozw.onrender.com)**

Deployment steps (if redeploying):
1. Connect GitHub repository to Render
2. Configure environment variables
3. Set start command: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`
4. Render automatically deploys on each push

## Troubleshooting

### 1. Import Error: "ModuleNotFoundError"
```bash
# Ensure running in backend directory and virtual environment is activated
which python  # or where python (Windows)
pip list
```

### 2. Database Error
```bash
# Delete old database and reinitialize
rm backend/study_assistant.db
python backend/migrate_db.py
```

### 3. API Key Error
- Check if `.env` file exists and is correctly configured
- Ensure API keys are valid and not expired
- Check backend console logs for detailed error messages

### 4. Frontend CORS Error
- Check CORS configuration in `backend/config.py`
- Ensure `CORS(app)` is properly initialized

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login/check-email` - Check email
- `POST /api/auth/login/verify` - Verify password login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/switch` - Switch account
- `GET /api/auth/children` - Get list of sub-accounts

### Notes
- `POST /api/note/generate` - Generate note
- `GET /api/note/list` - Get notes list
- `GET /api/note/get` - Get single note
- `POST /api/note/delete` - Delete note
- `POST /api/note/update` - Update note

### Error Book
- `POST /api/error/upload` - Upload problem
- `GET /api/error/list` - Get error book list
- `POST /api/error/practice/generate-similar` - Generate similar problems
- `POST /api/error/practice/do_text` - Submit text answer
- `POST /api/error/practice/do_image` - Submit image answer
- `POST /api/error/practice/favorite` - Favorite a problem

### Mind Maps
- `POST /api/mindmap/generate` - Generate mind map
- `GET /api/mindmap/list` - Get mind maps list
- `POST /api/mindmap/update` - Update mind map
- `POST /api/mindmap/export` - Export mind map

### Learning Analytics
- `GET /api/dashboard/stats` - Get learning statistics
- `GET /api/dashboard/chart-data` - Get chart data
- `GET /api/dashboard/parent-report` - Get parent report


