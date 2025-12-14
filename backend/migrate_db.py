"""数据库迁移脚本 - 添加user_settings表并更新user_id字段类型"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'study_assistant.db')

def migrate_database():
    """执行数据库迁移"""
    print(f"连接数据库: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    try:
        # 1. 检查user_settings表是否存在
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'")
        if not cur.fetchone():
            print("创建user_settings表...")
            cur.execute('''
            CREATE TABLE user_settings (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'student',
                parent_id TEXT,
                daily_goal INTEGER DEFAULT 60,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            conn.commit()
            print("✓ user_settings表创建成功")
        else:
            print("✓ user_settings表已存在")
        
        # 2. 检查其他表的user_id列类型
        tables_to_check = ['note', 'error_book', 'mindmap', 'practice_record', 'module_usage']
        
        for table in tables_to_check:
            # 检查表是否存在
            cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not cur.fetchone():
                print(f"警告: {table}表不存在，跳过")
                continue
            
            # 获取表结构
            cur.execute(f"PRAGMA table_info({table})")
            columns = cur.fetchall()
            
            # 检查user_id列
            user_id_col = None
            for col in columns:
                if col[1] == 'user_id':
                    user_id_col = col
                    break
            
            if user_id_col:
                col_type = user_id_col[2]  # 类型在索引2
                if col_type == 'INTEGER':
                    print(f"需要迁移 {table}.user_id 从INTEGER到TEXT")
                    # SQLite不支持直接ALTER COLUMN，需要重建表
                    migrate_table_user_id(conn, table)
                else:
                    print(f"✓ {table}.user_id已是TEXT类型")
            else:
                print(f"警告: {table}表没有user_id列")
        
        print("\n数据库迁移完成！")
        print("建议：重启Flask应用以使用新的数据库结构")
        
    except Exception as e:
        print(f"迁移失败: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        conn.close()


def migrate_table_user_id(conn, table_name):
    """迁移表的user_id列从INTEGER到TEXT"""
    cur = conn.cursor()
    
    print(f"  开始迁移{table_name}表...")
    
    # 1. 获取表结构
    cur.execute(f"PRAGMA table_info({table_name})")
    columns = cur.fetchall()
    
    # 2. 创建临时表（user_id为TEXT）
    temp_table = f"{table_name}_temp"
    
    # 构建CREATE TABLE语句
    col_defs = []
    for col in columns:
        col_name = col[1]
        col_type = col[2]
        
        # 将user_id的类型改为TEXT
        if col_name == 'user_id':
            col_type = 'TEXT'
            col_def = f"{col_name} {col_type} DEFAULT 'default'"
        else:
            col_def = f"{col_name} {col_type}"
            
            # 处理主键
            if col[5] == 1:  # pk标志
                col_def += " PRIMARY KEY"
                if 'AUTOINCREMENT' in col_type.upper() or col_name == 'id':
                    col_def += " AUTOINCREMENT"
            
            # 处理默认值
            if col[4] is not None:
                col_def += f" DEFAULT {col[4]}"
        
        col_defs.append(col_def)
    
    create_stmt = f"CREATE TABLE {temp_table} ({', '.join(col_defs)})"
    print(f"  创建临时表: {create_stmt[:100]}...")
    cur.execute(create_stmt)
    
    # 3. 复制数据（将INTEGER的user_id转为TEXT）
    col_names = [col[1] for col in columns]
    cols_str = ', '.join(col_names)
    
    # 特殊处理user_id：将1转为'default'，其他数字转为字符串
    select_cols = []
    for col_name in col_names:
        if col_name == 'user_id':
            select_cols.append("CASE WHEN user_id = 1 THEN 'default' ELSE CAST(user_id AS TEXT) END")
        else:
            select_cols.append(col_name)
    
    copy_stmt = f"INSERT INTO {temp_table} SELECT {', '.join(select_cols)} FROM {table_name}"
    print(f"  复制数据...")
    cur.execute(copy_stmt)
    
    # 4. 删除原表
    print(f"  删除原表...")
    cur.execute(f"DROP TABLE {table_name}")
    
    # 5. 重命名临时表
    print(f"  重命名临时表...")
    cur.execute(f"ALTER TABLE {temp_table} RENAME TO {table_name}")
    
    conn.commit()
    print(f"✓ {table_name}表迁移完成")


if __name__ == '__main__':
    migrate_database()
