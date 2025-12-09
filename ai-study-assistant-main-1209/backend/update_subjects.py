"""
更新脚本 - 修改 learning_dashboard.py 中的 get_subjects 函数
运行方式: cd backend && python update_subjects.py

这个脚本会将 get_subjects 函数改为按假定时间计算学科分布：
学科学习时间 = 笔记数×5 + 错题数×3 + 错题回顾数×7 + 思维导图数×5 (分钟)
"""

import os
import re

# 新的 get_subjects 函数代码
NEW_GET_SUBJECTS = '''@dashboard_bp.route('/subjects', methods=['GET'])
def get_subjects():
    """
    获取科目数据（按假定时间计算）
    学科学习时间 = 笔记数×5 + 错题数×3 + 错题回顾数×7 + 思维导图数×5 (分钟)
    GET /api/dashboard/subjects
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # 时间权重（分钟）
    NOTE_TIME = 5
    ERROR_TIME = 3
    ERROR_REVIEW_TIME = 7
    MINDMAP_TIME = 5
    
    # 获取笔记按科目分组
    cur.execute(\\'\\'\\'
        SELECT subject, COUNT(*) as count FROM note 
        GROUP BY subject
    \\'\\'\\')
    note_data = {row['subject'] or 'General': row['count'] for row in cur.fetchall()}
    
    # 获取错题按科目分组（区分已复习和未复习）
    cur.execute(\\'\\'\\'
        SELECT subject, 
               COUNT(*) as total, 
               SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed
        FROM error_book 
        GROUP BY subject
    \\'\\'\\')
    error_data = {row['subject'] or 'General': {
        'total': row['total'], 
        'reviewed': row['reviewed'] or 0
    } for row in cur.fetchall()}
    
    # 获取思维导图按科目分组
    try:
        cur.execute(\\'\\'\\'
            SELECT subject, COUNT(*) as count FROM mindmap 
            WHERE subject IS NOT NULL
            GROUP BY subject
        \\'\\'\\')
        mindmap_data = {row['subject'] or 'General': row['count'] for row in cur.fetchall()}
    except:
        # mindmap 表可能没有 subject 字段，统计总数算作 General
        cur.execute('SELECT COUNT(*) as count FROM mindmap')
        result = cur.fetchone()
        mindmap_count = result['count'] if result else 0
        mindmap_data = {'General': mindmap_count} if mindmap_count > 0 else {}
    
    conn.close()
    
    # 合并所有学科
    all_subjects = set(note_data.keys()) | set(error_data.keys()) | set(mindmap_data.keys())
    
    # 计算每个学科的学习时间
    subjects = []
    total_time = 0
    
    for subject_name in all_subjects:
        note_count = note_data.get(subject_name, 0)
        error_info = error_data.get(subject_name, {'total': 0, 'reviewed': 0})
        mindmap_count = mindmap_data.get(subject_name, 0)
        
        # 计算学习时间（分钟）
        time_spent = (
            note_count * NOTE_TIME +
            error_info['total'] * ERROR_TIME +
            error_info['reviewed'] * ERROR_REVIEW_TIME +
            mindmap_count * MINDMAP_TIME
        )
        
        total_time += time_spent
        
        # 计算掌握程度（基于错题复习率）
        if error_info['total'] > 0:
            mastery = round(error_info['reviewed'] / error_info['total'] * 100)
        else:
            mastery = 80  # 默认值
        
        subjects.append({
            'name': subject_name,
            'time_spent': time_spent,
            'mastery_level': mastery,
            'color': get_subject_color(subject_name),
            'notes_count': note_count,
            'errors_count': error_info['total'],
            'errors_reviewed': error_info['reviewed'],
            'mindmaps_count': mindmap_count
        })
    
    # 计算百分比
    for subject in subjects:
        subject['percentage'] = round((subject['time_spent'] / total_time * 100) if total_time > 0 else 0)
    
    # 按时间排序
    subjects.sort(key=lambda x: x['time_spent'], reverse=True)
    
    # 如果没有数据，返回默认科目
    if not subjects:
        subjects = [
            {'name': 'Mathematics', 'percentage': 35, 'time_spent': 420, 'mastery_level': 75, 'color': get_subject_color('Mathematics')},
            {'name': 'Physics', 'percentage': 28, 'time_spent': 360, 'mastery_level': 68, 'color': get_subject_color('Physics')},
            {'name': 'English', 'percentage': 22, 'time_spent': 280, 'mastery_level': 82, 'color': get_subject_color('English')},
            {'name': 'History', 'percentage': 15, 'time_spent': 180, 'mastery_level': 71, 'color': get_subject_color('History')}
        ]
    
    return jsonify({
        'success': True,
        'subjects': subjects,
        'total_time_minutes': total_time
    })'''


def update_learning_dashboard():
    file_path = os.path.join(os.path.dirname(__file__), 'modules', 'learning_dashboard.py')
    
    if not os.path.exists(file_path):
        print(f"错误: 找不到文件 {file_path}")
        return False
    
    print(f"正在更新 {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找原有的 get_subjects 函数
    # 匹配从 @dashboard_bp.route('/subjects' 开始到下一个 @dashboard_bp.route 或文件末尾
    pattern = r"@dashboard_bp\.route\('/subjects'.*?def get_subjects\(\):.*?(?=@dashboard_bp\.route|# ============|$)"
    
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("警告: 找不到原有的 get_subjects 函数，尝试添加到文件末尾")
        # 在文件末尾添加
        content += "\n\n" + NEW_GET_SUBJECTS.replace("\\'", "'")
    else:
        # 替换原有函数
        old_func = match.group(0)
        print(f"找到原有函数，长度: {len(old_func)} 字符")
        content = content[:match.start()] + NEW_GET_SUBJECTS.replace("\\'", "'") + "\n\n\n" + content[match.end():]
    
    # 备份原文件
    backup_path = file_path + '.bak'
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(open(file_path, 'r', encoding='utf-8').read())
    print(f"已备份原文件到 {backup_path}")
    
    # 写入更新后的内容
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ 更新完成!")
    print("\n新的学科分布计算方式:")
    print("  学科学习时间 = 笔记数×5 + 错题数×3 + 错题回顾数×7 + 思维导图数×5 (分钟)")
    
    return True


if __name__ == '__main__':
    update_learning_dashboard()
