"""
数据库迁移脚本 - 创建模块使用时间追踪表
运行方式: cd backend && python db_migration.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'study_assistant.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("开始数据库迁移...")
    
    # 1. 创建 module_usage 表（如果不存在）
    print("1. 创建 module_usage 表...")
    cur.execute('''
    CREATE TABLE IF NOT EXISTS module_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        date TEXT NOT NULL,
        module TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        session_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date, module)
    )
    ''')
    conn.commit()
    print("   ✓ module_usage 表已创建")
    
    # 2. 验证表结构
    print("\n=== 验证表结构 ===")
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in cur.fetchall()]
    
    required_tables = ['module_usage', 'note', 'mindmap', 'error_book']
    for table in required_tables:
        if table in tables:
            print(f"   ✓ {table}")
        else:
            print(f"   ✗ {table} (缺失)")
    
    # 3. 显示module_usage表当前数据
    print("\n=== module_usage 表数据 ===")
    cur.execute("SELECT * FROM module_usage ORDER BY date DESC LIMIT 5")
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"   {r}")
    else:
        print("   (空表)")
    
    conn.close()
    print("\n迁移完成!")

if __name__ == '__main__':
    migrate()
