"""Lightweight SQLite helper functions for the backend.

This is intentionally minimal and uses the built-in sqlite3 module
so we don't require SQLAlchemy for local sqlite usage.
"""
import os
import sqlite3
from datetime import datetime
import json
import hashlib
import secrets

_env_db = os.getenv('DATABASE_URI', '')
if _env_db and _env_db.startswith('sqlite:'):
    # Extract file path after sqlite: and handle relative paths
    path_part = _env_db.split(':', 1)[1]
    # remove leading slashes
    rel = path_part.lstrip('/').lstrip('.')
    if os.path.isabs(rel):
        DB_PATH = rel.replace('\\', '/')
    else:
        DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), rel)).replace('\\', '/')
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'study_assistant.db')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Ensure ALL necessary tables exist and migrate minimal schema.
    This will create note, mindmap, error_book, and study_progress tables if they don't exist.
    """
    # Ensure DB file is writable; attempt to chmod if not
    try:
        if os.path.exists(DB_PATH):
            # Try to open for append to test writability
            try:
                with open(DB_PATH, 'a'):
                    pass
            except IOError:
                try:
                    os.chmod(DB_PATH, 0o666)
                except Exception:
                    print('Warning: DB file not writeable:', DB_PATH)
        else:
            # Ensure the parent directory exists
            parent = os.path.dirname(DB_PATH)
            os.makedirs(parent, exist_ok=True)
    except Exception:
        pass

    conn = get_conn()
    cur = conn.cursor()
    
    # Create note table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS note (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        title TEXT,
        text_content TEXT,
        key_points TEXT,
        examples TEXT,
        summary TEXT,
        subject TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    conn.commit()
    # Ensure 'tags' column exists
    cur.execute("PRAGMA table_info(note)")
    cols = [c[1] for c in cur.fetchall()]
    if 'tags' not in cols:
        try:
            cur.execute("ALTER TABLE note ADD COLUMN tags TEXT")
            conn.commit()
        except Exception:
            pass
    
    # Create mindmap table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS mindmap (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        title TEXT,
        mermaid_code TEXT,
        depth INTEGER DEFAULT 3,
        style TEXT DEFAULT 'TD',
        source TEXT DEFAULT 'manual',
        source_file TEXT DEFAULT 'none',
        context TEXT,
        node_positions TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    conn.commit()
    
    # Create error_book table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS error_book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        subject TEXT,
        type TEXT,
        tags TEXT,
        question TEXT,
        user_answer TEXT,
        correct_answer TEXT,
        analysis_steps TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        difficulty TEXT DEFAULT 'medium',
        reviewed INTEGER DEFAULT 0,
        redo_answer TEXT,
        redo_time DATETIME
    )
    ''')
    conn.commit()
    
    # Create study_progress table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS study_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        date TEXT NOT NULL,
        subject TEXT NOT NULL,
        reviewed_questions INTEGER DEFAULT 0,
        review_correct_questions INTEGER DEFAULT 0,
        review_time_minutes INTEGER DEFAULT 0,
        practice_questions INTEGER DEFAULT 0,
        practice_correct_questions INTEGER DEFAULT 0,
        practice_time_minutes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date, subject)
    )
    ''')
    conn.commit()
    
    # Create notifications table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        icon TEXT DEFAULT 'fa-bell',
        link TEXT,
        read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    conn.commit()
    
    # Create user_settings table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        username TEXT DEFAULT 'Student',
        email TEXT DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        account_type TEXT DEFAULT 'student',
        parent_id TEXT,
        avatar_url TEXT,
        grade_level TEXT DEFAULT '',
        daily_goal INTEGER DEFAULT 60,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES user_settings(user_id)
    )
    ''')
    conn.commit()
    
    # Migrate existing user_id column if it's INTEGER
    try:
        cur.execute("PRAGMA table_info(user_settings)")
        cols = {c[1]: c[2] for c in cur.fetchall()}
        
        # Add missing columns if they don't exist
        if 'password_hash' not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
        if 'account_type' not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN account_type TEXT DEFAULT 'student'")
        if 'parent_id' not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN parent_id TEXT")
        if 'avatar_url' not in cols:
            cur.execute("ALTER TABLE user_settings ADD COLUMN avatar_url TEXT")
        conn.commit()
    except Exception as e:
        print(f"Migration note: {e}")
    
    conn.close()


def _row_to_note_dict(row):
    if not row:
        return None
    note = {
        'id': row['id'],
        'title': row['title'],
        'subject': row['subject'],
        'date': (row['created_at'][:10] if row['created_at'] else None),
        'original_text': row['text_content'],
        'content': {}
    }
    # key_points and examples might be JSON strings or ; separated lists
    def _parse_list_field(v):
        if v is None:
            return []
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            # fallback: split by ; or comma
            if ';' in v:
                return [s.strip() for s in v.split(';') if s.strip()]
            if ',' in v:
                return [s.strip() for s in v.split(',') if s.strip()]
        return []

    note['content'] = {
        'title': row['title'],
        'subject': row['subject'],
        'key_points': _parse_list_field(row['key_points']),
        'examples': _parse_list_field(row['examples']),
        'summary': row['summary'] or ''
    }
    return note


def insert_note(note):
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    key_points = json.dumps(note.get('content', {}).get('key_points', []), ensure_ascii=False)
    examples = json.dumps(note.get('content', {}).get('examples', []), ensure_ascii=False)
    tags = json.dumps(note.get('content', {}).get('tags', []), ensure_ascii=False)
    cur.execute('''
        INSERT INTO note (user_id, title, text_content, key_points, examples, summary, subject, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        note.get('user_id', 1),
        note.get('title'),
        note.get('original_text'),
        key_points,
        examples,
    note.get('content', {}).get('summary', ''),
        note.get('subject'),
        note.get('source', 'manual'),
        now,
        now
    ))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def update_note(note_id, note):
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    key_points = json.dumps(note.get('content', {}).get('key_points', []), ensure_ascii=False)
    examples = json.dumps(note.get('content', {}).get('examples', []), ensure_ascii=False)
    tags = json.dumps(note.get('content', {}).get('tags', []), ensure_ascii=False)
    cur.execute('''
    UPDATE note SET title=?, text_content=?, key_points=?, examples=?, summary=?, subject=?, source=?, tags=?, updated_at=? WHERE id=?
    ''', (
        note.get('title'),
        note.get('original_text'),
        key_points,
        examples,
        note.get('content', {}).get('summary', ''),
        note.get('subject'),
        note.get('source', 'manual'),
    tags,
        now,
        note_id
    ))
    conn.commit()
    conn.close()


def delete_note(note_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM note WHERE id=?', (note_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


def get_note_by_id(note_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT * FROM note WHERE id=?', (note_id,))
    row = cur.fetchone()
    conn.close()
    return _row_to_note_dict(row)


def list_notes(subject=None, limit=10):
    conn = get_conn()
    cur = conn.cursor()
    if subject:
        cur.execute('SELECT * FROM note WHERE subject=? ORDER BY created_at DESC LIMIT ?', (subject, limit))
    else:
        cur.execute('SELECT * FROM note ORDER BY created_at DESC LIMIT ?', (limit,))
    rows = cur.fetchall()
    conn.close()
    return [_row_to_note_dict(r) for r in rows]


def count_notes(subject=None):
    conn = get_conn()
    cur = conn.cursor()
    if subject:
        cur.execute('SELECT COUNT(*) FROM note WHERE subject=?', (subject,))
    else:
        cur.execute('SELECT COUNT(*) FROM note')
    count = cur.fetchone()[0]
    conn.close()
    return count

def _row_to_mindmap_dict(row):
    if not row:
        return None
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'title': row['title'],
        'mermaid_code': row['mermaid_code'],
        'depth': row['depth'],
        'style': row['style'],
        'source': row['source'],
        'source_file': row['source_file'],
        'context': row['context'],
        'node_positions': row['node_positions'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at']
    }

def insert_mindmap(mindmap):
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute('''
        INSERT INTO mindmap (user_id, title, mermaid_code, depth, style, source, source_file, context, node_positions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        mindmap.get('user_id', 1),
        mindmap.get('title'),
        mindmap.get('mermaid_code'),
        mindmap.get('depth', 3),
        mindmap.get('style', 'TD'),
        mindmap.get('source', 'manual'),
        mindmap.get('source_file', 'none'),
        mindmap.get('context', ''),
        mindmap.get('node_positions', '{}'),
        now,
        now
    ))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id

def update_mindmap(mindmap):
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute('''
        UPDATE mindmap SET title=?, mermaid_code=?, depth=?, style=?, source=?, source_file=?, context=?, node_positions=?, updated_at=? WHERE id=?
    ''', (
        mindmap.get('title'),
        mindmap.get('mermaid_code'),
        mindmap.get('depth', 3),
        mindmap.get('style', 'TD'),
        mindmap.get('source', 'manual'),
        mindmap.get('source_file', 'none'),
        mindmap.get('context', ''),
        mindmap.get('node_positions', '{}'),
        now,
        mindmap['id']
    ))
    conn.commit()
    conn.close()

def delete_mindmap(map_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM mindmap WHERE id=?', (map_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0

def get_mindmap_by_id(map_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT * FROM mindmap WHERE id=?', (map_id,))
    row = cur.fetchone()
    conn.close()
    return _row_to_mindmap_dict(row)

def get_all_mindmaps():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT * FROM mindmap ORDER BY created_at DESC')
    rows = cur.fetchall()
    conn.close()
    return [_row_to_mindmap_dict(row) for row in rows]


# ========== Study Progress Functions ==========

def get_study_progress(user_id, date, subject):
    """Get study progress record."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT id, reviewed_questions, review_correct_questions, review_time_minutes,
               practice_questions, practice_correct_questions, practice_time_minutes
        FROM study_progress
        WHERE user_id = ? AND date = ? AND subject = ?
    ''', (user_id, date, subject))
    row = cur.fetchone()
    conn.close()
    return row


def insert_study_progress(user_id, date, subject):
    """Insert a new study progress record."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute('''
        INSERT INTO study_progress(
            user_id, date, subject,
            reviewed_questions, review_correct_questions, review_time_minutes,
            practice_questions, practice_correct_questions, practice_time_minutes,
            created_at, updated_at
        ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    ''', (user_id, date, subject, now, now))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def update_study_progress_review(row_id, reviewed, correct_review, review_time_minutes):
    """Update review-related fields in study progress."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute('''
        UPDATE study_progress
        SET reviewed_questions=?, review_correct_questions=?, review_time_minutes=?, updated_at=?
        WHERE id=?
    ''', (reviewed, correct_review, review_time_minutes, now, row_id))
    conn.commit()
    conn.close()


def update_study_progress_practice(row_id, practice_count, correct_practice, practice_time_minutes):
    """Update practice-related fields in study progress."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute('''
        UPDATE study_progress
        SET practice_questions=?, practice_correct_questions=?, practice_time_minutes=?, updated_at=?
        WHERE id=?
    ''', (practice_count, correct_practice, practice_time_minutes, now, row_id))
    conn.commit()
    conn.close()


# ========== Error Book Functions ==========

def _row_to_error_dict(row):
    """Convert a database row to error dict."""
    if not row:
        return None
    
    # Parse tags and analysis_steps from JSON
    def _parse_json_field(v):
        if v is None:
            return []
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return []
    
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'subject': row['subject'],
        'type': row['type'],
        'tags': _parse_json_field(row['tags']),
        'question_text': row['question'],
        'user_answer': row['user_answer'],
        'correct_answer': row['correct_answer'],
        'analysis_steps': _parse_json_field(row['analysis_steps']),
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
        'difficulty': row['difficulty'],
        'reviewed': bool(row['reviewed']),
        'redo_answer': row['redo_answer'],
        'redo_time': row['redo_time'],
        'success': True
    }


def insert_error(error):
    """Insert a new error record."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    tags = json.dumps(error.get('tags', []), ensure_ascii=False)
    analysis_steps = json.dumps(error.get('analysis_steps', []), ensure_ascii=False)
    
    cur.execute('''
        INSERT INTO error_book (user_id, subject, type, tags, question, user_answer, correct_answer, analysis_steps, created_at, updated_at, difficulty, reviewed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        error.get('user_id', 1),
        error.get('subject', ''),
        error.get('type', ''),
        tags,
        error.get('question_text', ''),
        error.get('user_answer', ''),
        error.get('correct_answer', ''),
        analysis_steps,
        now,
        now,
        error.get('difficulty', 'medium'),
        0
    ))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def update_error(error_id, error):
    """Update an existing error record."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    tags = json.dumps(error.get('tags', []), ensure_ascii=False)
    analysis_steps = json.dumps(error.get('analysis_steps', []), ensure_ascii=False)
    
    cur.execute('''
        UPDATE error_book SET subject=?, type=?, tags=?, question=?, user_answer=?, correct_answer=?, analysis_steps=?, updated_at=?, difficulty=?, reviewed=?
        WHERE id=?
    ''', (
        error.get('subject', ''),
        error.get('type', ''),
        tags,
        error.get('question_text', ''),
        error.get('user_answer', ''),
        error.get('correct_answer', ''),
        analysis_steps,
        now,
        error.get('difficulty', 'medium'),
        1 if error.get('reviewed') else 0,
        error_id
    ))
    conn.commit()
    conn.close()


def delete_error(error_id):
    """Delete an error record by id."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM error_book WHERE id=?', (error_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


def get_error_by_id(error_id):
    """Get a single error by id."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT * FROM error_book WHERE id=?', (error_id,))
    row = cur.fetchone()
    conn.close()
    return _row_to_error_dict(row)


def list_errors(subject=None, user_id=None, limit=100):
    """List errors with optional filtering."""
    conn = get_conn()
    cur = conn.cursor()
    
    query = 'SELECT * FROM error_book WHERE 1=1'
    params = []
    
    if subject:
        query += ' AND subject=?'
        params.append(subject)
    if user_id:
        query += ' AND user_id=?'
        params.append(user_id)
    
    query += ' ORDER BY created_at DESC LIMIT ?'
    params.append(limit)
    
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [_row_to_error_dict(r) for r in rows]


def count_errors(subject=None, user_id=None):
    """Count errors with optional filtering."""
    conn = get_conn()
    cur = conn.cursor()
    
    query = 'SELECT COUNT(*) FROM error_book WHERE 1=1'
    params = []
    
    if subject:
        query += ' AND subject=?'
        params.append(subject)
    if user_id:
        query += ' AND user_id=?'
        params.append(user_id)
    
    cur.execute(query, params)
    count = cur.fetchone()[0]
    conn.close()
    return count


def update_error_redo(error_id, redo_answer):
    """Update error with redo answer."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    
    cur.execute('''
        UPDATE error_book SET redo_answer=?, redo_time=?, reviewed=1, updated_at=?
        WHERE id=?
    ''', (redo_answer, now, now, error_id))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


# ========== Notification Functions ==========

def _row_to_notification_dict(row):
    """Convert a database row to notification dict."""
    if not row:
        return None
    
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'title': row['title'],
        'message': row['message'],
        'type': row['type'],
        'icon': row['icon'],
        'link': row['link'],
        'read': bool(row['read']),
        'time': row['created_at']
    }


def insert_notification(user_id, title, message, notif_type='info', icon='fa-bell', link=None):
    """Insert a new notification."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    
    cur.execute('''
        INSERT INTO notifications (user_id, title, message, type, icon, link, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, message, notif_type, icon, link, now))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def list_notifications(user_id=1, limit=50):
    """List notifications for a user."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('''
        SELECT * FROM notifications 
        WHERE user_id=? 
        ORDER BY created_at DESC 
        LIMIT ?
    ''', (user_id, limit))
    
    rows = cur.fetchall()
    conn.close()
    return [_row_to_notification_dict(r) for r in rows]


def mark_notification_read(notification_id):
    """Mark a notification as read."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('UPDATE notifications SET read=1 WHERE id=?', (notification_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


def mark_all_notifications_read(user_id=1):
    """Mark all notifications as read for a user."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('UPDATE notifications SET read=1 WHERE user_id=?', (user_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes


def delete_notification(notification_id):
    """Delete a notification."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('DELETE FROM notifications WHERE id=?', (notification_id,))
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


# ============================================
# User Settings Functions
# ============================================

def generate_user_id():
    """Generate a unique user ID."""
    return secrets.token_hex(8)  # 16 character hex string


def hash_password(password):
    """Hash a password using SHA-256 with salt."""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwd_hash}"


def verify_password(password, password_hash):
    """Verify a password against its hash."""
    if not password_hash or '$' not in password_hash:
        return False
    try:
        salt, pwd_hash = password_hash.split('$', 1)
        test_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return test_hash == pwd_hash
    except Exception:
        return False


def get_user_settings(user_id='default'):
    """Get user settings from database. Creates default settings if not exists."""
    conn = get_conn()
    cur = conn.cursor()
    
    # Try to find by user_id (TEXT)
    cur.execute('SELECT * FROM user_settings WHERE user_id=?', (user_id,))
    row = cur.fetchone()
    
    # If not found and user_id is 'default', try to find the first record (migration support)
    if not row and user_id == 'default':
        cur.execute('SELECT * FROM user_settings ORDER BY id LIMIT 1')
        row = cur.fetchone()
        
        # If found an old record with INTEGER user_id or empty string, migrate it
        if row:
            current_user_id = row['user_id']
            # Only migrate if user_id is empty, '1', or looks like an integer
            needs_migration = False
            try:
                if not current_user_id or current_user_id == '' or (isinstance(current_user_id, (int, str)) and str(current_user_id).isdigit()):
                    needs_migration = True
            except:
                needs_migration = False
            
            if needs_migration:
                old_id = row['id']
                new_user_id = generate_user_id()
                try:
                    cur.execute('UPDATE user_settings SET user_id=? WHERE id=?', (new_user_id, old_id))
                    conn.commit()
                    # Re-fetch the updated row
                    cur.execute('SELECT * FROM user_settings WHERE user_id=?', (new_user_id,))
                    row = cur.fetchone()
                except Exception as e:
                    print(f"Migration update failed: {e}")
    
    if not row:
        # Create default settings with default user_id
        now = datetime.now().isoformat()
        default_user_id = user_id if user_id != 'default' else generate_user_id()
        try:
            cur.execute('''
                INSERT INTO user_settings (user_id, username, email, password_hash, account_type, grade_level, daily_goal, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (default_user_id, 'Student', '', '', 'student', '', 60, now, now))
            conn.commit()
            
            cur.execute('SELECT * FROM user_settings WHERE user_id=?', (default_user_id,))
            row = cur.fetchone()
        except Exception as e:
            print(f"Insert failed: {e}")
            conn.close()
            return {
                'user_id': 'default',
                'username': 'Student',
                'email': '',
                'password_hash': '',
                'account_type': 'student',
                'parent_id': None,
                'avatar_url': None,
                'grade_level': '',
                'daily_goal': 60,
                'updated_at': datetime.now().isoformat()
            }
    
    conn.close()
    
    if row:
        # Handle both old and new schema
        user_id_value = str(row['user_id']) if row['user_id'] else 'default'
        account_type_value = row['account_type'] if 'account_type' in row.keys() else 'student'
        parent_id_value = row['parent_id'] if 'parent_id' in row.keys() else None
        avatar_url_value = row['avatar_url'] if 'avatar_url' in row.keys() else None
        password_hash_value = row['password_hash'] if 'password_hash' in row.keys() else ''
        
        return {
            'user_id': user_id_value,
            'username': row['username'],
            'email': row['email'],
            'password_hash': password_hash_value,
            'account_type': account_type_value,
            'parent_id': parent_id_value,
            'avatar_url': avatar_url_value,
            'grade_level': row['grade_level'],
            'daily_goal': row['daily_goal'],
            'updated_at': row['updated_at']
        }
    return {
        'user_id': 'default',
        'username': 'Student',
        'email': '',
        'account_type': 'student',
        'parent_id': None,
        'avatar_url': None,
        'grade_level': '',
        'daily_goal': 60,
        'updated_at': datetime.now().isoformat()
    }


def update_user_settings(settings, user_id='default'):
    """Update user settings in database."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    
    # First, try to find by user_id
    cur.execute('SELECT id, user_id FROM user_settings WHERE user_id=?', (user_id,))
    exists = cur.fetchone()
    
    # If not found and user_id is 'default', try to find the first record
    actual_user_id = user_id
    if not exists and user_id == 'default':
        cur.execute('SELECT id, user_id FROM user_settings ORDER BY id LIMIT 1')
        exists = cur.fetchone()
        if exists:
            # Use the found user_id for update
            actual_user_id = str(exists['user_id'])
    
    if exists:
        # Build update query dynamically based on provided fields
        update_fields = []
        values = []
        
        if 'username' in settings:
            update_fields.append('username=?')
            values.append(settings['username'])
        if 'email' in settings:
            update_fields.append('email=?')
            values.append(settings['email'])
        if 'grade_level' in settings:
            update_fields.append('grade_level=?')
            values.append(settings['grade_level'])
        if 'daily_goal' in settings:
            update_fields.append('daily_goal=?')
            values.append(settings['daily_goal'])
        if 'avatar_url' in settings:
            update_fields.append('avatar_url=?')
            values.append(settings['avatar_url'])
        
        if not update_fields:
            # No fields to update
            conn.close()
            return True
        
        update_fields.append('updated_at=?')
        values.append(now)
        values.append(actual_user_id)  # Use actual_user_id instead of user_id
        
        query = f"UPDATE user_settings SET {', '.join(update_fields)} WHERE user_id=?"
        cur.execute(query, values)
    else:
        # Create new settings
        new_user_id = user_id if user_id != 'default' else generate_user_id()
        try:
            cur.execute('''
                INSERT INTO user_settings (user_id, username, email, password_hash, account_type, grade_level, daily_goal, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                new_user_id,
                settings.get('username', 'Student'),
                settings.get('email', ''),
                '',
                settings.get('account_type', 'student'),
                settings.get('grade_level', ''),
                settings.get('daily_goal', 60),
                now,
                now
            ))
        except Exception as e:
            print(f"Insert failed in update_user_settings: {e}")
            conn.close()
            return False
    
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


def update_password(user_id, new_password):
    """Update user password."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    
    # Try to find by user_id
    cur.execute('SELECT id, user_id FROM user_settings WHERE user_id=?', (user_id,))
    exists = cur.fetchone()
    
    # If not found and user_id is 'default', try to find the first record
    actual_user_id = user_id
    if not exists and user_id == 'default':
        cur.execute('SELECT id, user_id FROM user_settings ORDER BY id LIMIT 1')
        exists = cur.fetchone()
        if exists:
            actual_user_id = str(exists['user_id'])
    
    if not exists:
        conn.close()
        return False
    
    password_hash = hash_password(new_password)
    cur.execute('''
        UPDATE user_settings 
        SET password_hash=?, updated_at=?
        WHERE user_id=?
    ''', (password_hash, now, actual_user_id))  # Use actual_user_id
    
    conn.commit()
    changes = cur.rowcount
    conn.close()
    return changes > 0


def get_user_by_email(email):
    """Get user by email address."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('SELECT * FROM user_settings WHERE email=?', (email,))
    row = cur.fetchone()
    conn.close()
    
    if row:
        return {
            'user_id': row['user_id'],
            'username': row['username'],
            'email': row['email'],
            'password_hash': row['password_hash'],
            'account_type': row['account_type'],
            'parent_id': row['parent_id'] if 'parent_id' in row.keys() else None,
            'avatar_url': row['avatar_url'] if 'avatar_url' in row.keys() else None,
            'grade_level': row['grade_level'],
            'daily_goal': row['daily_goal']
        }
    return None


def create_user(email, username, password, account_type='student', parent_id=None, grade_level='', daily_goal=60, avatar_url=None):
    """Create a new user account."""
    conn = get_conn()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    
    user_id = generate_user_id()
    password_hash = hash_password(password)
    
    try:
        cur.execute('''
            INSERT INTO user_settings (user_id, username, email, password_hash, account_type, parent_id, avatar_url, grade_level, daily_goal, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, password_hash, account_type, parent_id, avatar_url, grade_level, daily_goal, now, now))
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError as e:
        conn.close()
        return None


def get_students_by_parent(parent_id):
    """Get all student accounts under a parent."""
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute('SELECT * FROM user_settings WHERE parent_id=?', (parent_id,))
    rows = cur.fetchall()
    conn.close()
    
    students = []
    for row in rows:
        students.append({
            'user_id': row['user_id'],
            'username': row['username'],
            'email': row['email'],
            'account_type': row['account_type'],
            'avatar_url': row['avatar_url'] if 'avatar_url' in row.keys() else None,
            'grade_level': row['grade_level'],
            'daily_goal': row['daily_goal']
        })
    return students

