import sqlite3

conn = sqlite3.connect('study_assistant.db')
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()

print("="*50)
print("ALL TABLES IN DATABASE")
print("="*50)

for table in tables:
    name = table[0]
    print(f"\n[TABLE] {name}")
    cur.execute(f"PRAGMA table_info({name})")
    for col in cur.fetchall():
        print(f"    - {col[1]} ({col[2]})")
    cur.execute(f"SELECT COUNT(*) FROM {name}")
    print(f"    > Rows: {cur.fetchone()[0]}")

conn.close()