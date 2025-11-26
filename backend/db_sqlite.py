"""Lightweight SQLite helper functions for the backend.

This is intentionally minimal and uses the built-in sqlite3 module
so we don't require SQLAlchemy for local sqlite usage.
"""
import os
import sqlite3
from datetime import datetime
import json

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
    """Ensure the necessary tables exist and migrate minimal schema.
    This will create the note table if it does not exist.
    It will add missing columns if they don't exist.
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
    # Create user, note and mindmap tables if missing minimal fields
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
