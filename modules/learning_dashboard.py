"""
Learning Dashboard Module
学习数据分析和可视化 - 已接入数据库
"""

from flask import Blueprint, request, jsonify, send_from_directory
from datetime import datetime, timedelta
import random
import os
import sys
import traceback

# 导入数据库模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_sqlite

dashboard_bp = Blueprint('learning_dashboard', __name__, url_prefix='/api/dashboard')

# 艾宾浩斯遗忘曲线复习时间点（天）
EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15]

# 科目颜色映射 - 增强颜色多样性
SUBJECT_COLORS = {
    'Mathematics': 'hsl(221, 83%, 53%)',      # 蓝色
    '数学': 'hsl(221, 83%, 53%)',
    'Physics': 'hsl(142, 76%, 36%)',          # 绿色
    '物理': 'hsl(142, 76%, 36%)',
    'English': 'hsl(262, 83%, 58%)',          # 紫色
    '英语': 'hsl(262, 83%, 58%)',
    'History': 'hsl(45, 93%, 47%)',           # 黄色
    '历史': 'hsl(45, 93%, 47%)',
    'Chemistry': 'hsl(0, 84%, 60%)',          # 红色
    '化学': 'hsl(0, 84%, 60%)',
    'Biology': 'hsl(160, 70%, 45%)',          # 青绿色
    '生物': 'hsl(160, 70%, 45%)',
    'Geography': 'hsl(200, 80%, 50%)',        # 天蓝色
    '地理': 'hsl(200, 80%, 50%)',
    'Computer Science': 'hsl(280, 75%, 55%)', # 深紫色
    '计算机': 'hsl(280, 75%, 55%)',
    'Literature': 'hsl(340, 82%, 52%)',       # 粉红色
    '语文': 'hsl(340, 82%, 52%)',
    'Politics': 'hsl(15, 86%, 53%)',          # 橙色
    '政治': 'hsl(15, 86%, 53%)',
    'General': 'hsl(240, 60%, 65%)',          # 淡紫蓝
    '通用': 'hsl(240, 60%, 65%)',
}

# 备用颜色调色板（用于未定义科目）
FALLBACK_COLORS = [
    'hsl(221, 83%, 53%)',  # 蓝
    'hsl(0, 84%, 60%)',    # 红
    'hsl(142, 76%, 36%)',  # 绿
    'hsl(45, 93%, 47%)',   # 黄
    'hsl(262, 83%, 58%)',  # 紫
    'hsl(200, 80%, 50%)',  # 天蓝
    'hsl(15, 86%, 53%)',   # 橙
    'hsl(340, 82%, 52%)',  # 粉红
    'hsl(160, 70%, 45%)',  # 青绿
    'hsl(280, 75%, 55%)',  # 深紫
]

def get_subject_color(subject):
    """获取科目对应的颜色，使用hash确保相同科目总是相同颜色"""
    if subject in SUBJECT_COLORS:
        return SUBJECT_COLORS[subject]
    # 使用hash选择备用颜色
    color_index = hash(subject) % len(FALLBACK_COLORS)
    return FALLBACK_COLORS[color_index]


# ============ API端点 ============

@dashboard_bp.route('/stats', methods=['GET'])
def get_statistics():
    """
    获取核心统计指标 - 全部从数据库读取
    GET /api/dashboard/stats?period=30
    """
    period_param = request.args.get('period', '30')
    
    # 兼容字符串格式和数字格式
    period_map = {
        'week': 7, 'month': 30, 'all': 90,
        '7': 7, '30': 30, '90': 90
    }
    period = period_map.get(str(period_param), 30)
    
    # 计算日期范围
    end_date = datetime.now()
    start_date = end_date - timedelta(days=period)
    start_date_str = start_date.strftime('%Y-%m-%d')
    
    # 上个周期的日期范围
    prev_end = start_date
    prev_start = prev_end - timedelta(days=period)
    prev_start_str = prev_start.strftime('%Y-%m-%d')
    prev_end_str = prev_end.strftime('%Y-%m-%d')
    
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # ========== 1. 笔记数量 ==========
    # 当前周期
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ?', (start_date_str,))
    notes_count = cur.fetchone()[0]
    
    # 上个周期
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ? AND created_at < ?', 
                (prev_start_str, prev_end_str))
    prev_notes_count = cur.fetchone()[0]
    
    # 计算趋势
    if prev_notes_count > 0:
        notes_trend_value = round((notes_count - prev_notes_count) / prev_notes_count * 100)
    else:
        notes_trend_value = 100 if notes_count > 0 else 0
    notes_trend = 'up' if notes_count >= prev_notes_count else 'down'
    
    # ========== 2. 学习时间（从 module_usage 读取真实追踪数据） ==========
    # 当前周期：从 module_usage 读取（秒转分钟）
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ?
    ''', (start_date_str,))
    total_minutes = int(cur.fetchone()[0] or 0)
    
    # 如果 module_usage 没有数据，使用估算（笔记*15 + 错题*10）
    if total_minutes == 0:
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at >= ?', (start_date_str,))
        current_errors = cur.fetchone()[0]
        total_minutes = notes_count * 15 + current_errors * 10
    
    # 上个周期
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ? AND date < ?
    ''', (prev_start_str, prev_end_str))
    prev_minutes = int(cur.fetchone()[0] or 0)
    
    if prev_minutes == 0:
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at >= ? AND created_at < ?',
                    (prev_start_str, prev_end_str))
        prev_errors = cur.fetchone()[0]
        prev_minutes = prev_notes_count * 15 + prev_errors * 10
    
    # 计算趋势
    if prev_minutes > 0:
        time_trend_value = round((total_minutes - prev_minutes) / prev_minutes * 100)
    else:
        time_trend_value = 100 if total_minutes > 0 else 0
    time_trend = 'up' if total_minutes >= prev_minutes else 'down'
    
    # ========== 3. 准确率（错题复习率） ==========
    # 当前周期
    cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at >= ?', (start_date_str,))
    total_errors = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1 AND created_at >= ?', (start_date_str,))
    reviewed_errors = cur.fetchone()[0]
    
    accuracy = round((reviewed_errors / total_errors * 100) if total_errors > 0 else 0)
    
    # 上个周期准确率
    cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at >= ? AND created_at < ?',
                (prev_start_str, prev_end_str))
    prev_total_errors = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1 AND created_at >= ? AND created_at < ?',
                (prev_start_str, prev_end_str))
    prev_reviewed = cur.fetchone()[0]
    
    prev_accuracy = round((prev_reviewed / prev_total_errors * 100) if prev_total_errors > 0 else 0)
    
    accuracy_trend_value = accuracy - prev_accuracy
    accuracy_trend = 'up' if accuracy >= prev_accuracy else 'down'
    
    # ========== 4. 连续学习天数（真实计算） ==========
    streak = 0
    check_date = datetime.now().date()
    
    while True:
        date_str = check_date.strftime('%Y-%m-%d')
        date_pattern = date_str + '%'
        
        # 检查当天是否有笔记
        cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (date_pattern,))
        has_note = cur.fetchone()[0] > 0
        
        # 检查当天是否有错题活动
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at LIKE ? OR updated_at LIKE ?', 
                    (date_pattern, date_pattern))
        has_error = cur.fetchone()[0] > 0
        
        # 检查当天是否有 module_usage 记录
        cur.execute('SELECT COUNT(*) FROM module_usage WHERE date = ?', (date_str,))
        has_progress = cur.fetchone()[0] > 0
        
        if has_note or has_error or has_progress:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            # 如果今天没有活动，检查是否是今天（给一天宽限期）
            if check_date == datetime.now().date() and streak == 0:
                check_date -= timedelta(days=1)
                continue
            break
        
        # 最多检查90天
        if streak >= 90:
            break
    
    # 计算上周的 streak（简化：比较上周同期）
    prev_streak = max(0, streak - 7) if streak > 7 else 0
    streak_trend = 'up' if streak >= prev_streak else 'down'
    streak_trend_value = streak - prev_streak
    
    # ========== 5. 待复习数量 ==========
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 0')
    pending_total = cur.fetchone()[0]
    
    # 今日创建的未复习错题
    today_str = datetime.now().strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 0 AND created_at LIKE ?', (today_str + '%',))
    today_pending = cur.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'success': True,
        # Learning Dashboard 详细格式
        'stats': {
            'study_time': {
                'total_minutes': total_minutes,
                'total_hours': round(total_minutes / 60, 1),
                'daily_average': round(total_minutes / period, 1) if period > 0 else 0,
                'trend': time_trend,
                'trend_value': abs(time_trend_value)
            },
            'notes_created': {
                'count': notes_count,
                'trend': notes_trend,
                'trend_value': abs(notes_trend_value)
            },
            'accuracy_rate': {
                'percentage': accuracy,
                'trend': accuracy_trend,
                'trend_value': abs(accuracy_trend_value)
            },
            'day_streak': {
                'days': streak,
                'trend': streak_trend,
                'trend_value': abs(streak_trend_value)
            },
            'pending_reviews': {
                'total': pending_total,
                'today': today_pending
            }
        },
        # Overview 页面简化格式（兼容）
        'studyStreak': streak,
        'studyStreakChange': f'+{streak_trend_value} from last week' if streak_trend_value >= 0 else f'{streak_trend_value} from last week',
        'todayTime': round(total_minutes / period / 60, 1) if period > 0 else 0,
        'todayTimeChange': f'+{time_trend_value}% from last period' if time_trend_value >= 0 else f'{time_trend_value}% from last period',
        'notesCreated': notes_count,
        'notesChange': f'+{notes_trend_value}% from last period' if notes_trend_value >= 0 else f'{notes_trend_value}% from last period',
        'errorsReviewed': reviewed_errors,
        'totalErrors': total_errors,
        'errorCompletion': accuracy
    })


@dashboard_bp.route('/subjects', methods=['GET'])
def get_subjects():
    """
    获取科目数据（从数据库读取真实数据）
    GET /api/dashboard/subjects
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # 获取笔记和错题按科目分组（合并统计）
    cur.execute('''
        SELECT subject, SUM(count) as count FROM (
            SELECT subject, COUNT(*) as count FROM note GROUP BY subject
            UNION ALL
            SELECT subject, COUNT(*) as count FROM error_book GROUP BY subject
        )
        GROUP BY subject
        ORDER BY count DESC
    ''')
    note_subjects = cur.fetchall()
    
    # 获取错题按科目分组
    cur.execute('''
        SELECT subject, COUNT(*) as total, 
               SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed
        FROM error_book 
        GROUP BY subject
    ''')
    error_subjects = {row['subject']: {'total': row['total'], 'reviewed': row['reviewed'] or 0} 
                      for row in cur.fetchall()}
    
    conn.close()
    
    # 计算总数用于百分比
    total_notes = sum(row['count'] for row in note_subjects)
    
    subjects = []
    for row in note_subjects:
        subject_name = row['subject'] or 'General'
        note_count = row['count']
        
        # 计算百分比
        percentage = round((note_count / total_notes * 100) if total_notes > 0 else 0)
        
        # 计算掌握程度（基于错题复习率）
        error_data = error_subjects.get(subject_name, {'total': 0, 'reviewed': 0})
        if error_data['total'] > 0:
            mastery = round(error_data['reviewed'] / error_data['total'] * 100)
        else:
            mastery = 80
        
        subjects.append({
            'name': subject_name,
            'percentage': percentage,
            'time_spent': note_count * 15,
            'mastery_level': mastery,
            'color': get_subject_color(subject_name),
            'notes_count': note_count,
            'errors_count': error_data['total']
        })
    
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
        'subjects': subjects
    })


@dashboard_bp.route('/progress', methods=['GET'])
def get_progress():
    """
    获取学习进度
    GET /api/dashboard/progress
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # 本周笔记数
    week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ?', (week_start,))
    weekly_notes = cur.fetchone()[0]
    
    # 获取各科目进度
    cur.execute('''
        SELECT subject, COUNT(*) as count FROM note 
        WHERE created_at >= ?
        GROUP BY subject
    ''', (week_start,))
    subject_progress = cur.fetchall()
    
    conn.close()
    
    # 周目标
    weekly_goal = 20
    
    subjects = []
    for row in subject_progress:
        subject_name = row['subject'] or 'General'
        completed = row['count']
        target = max(5, completed + 2)
        subjects.append({
            'name': subject_name,
            'completed': completed,
            'total': target,
            'percentage': round(completed / target * 100)
        })
    
    return jsonify({
        'success': True,
        'progress': {
            'weekly_goal': weekly_goal,
            'current': weekly_notes,
            'percentage': min(100, round(weekly_notes / weekly_goal * 100)) if weekly_goal > 0 else 0,
            'subjects': subjects
        }
    })


@dashboard_bp.route('/chart-data', methods=['GET'])
def get_chart_data():
    """
    获取图表数据
    GET /api/dashboard/chart-data?type=time&period=7
    """
    chart_type = request.args.get('type', 'time')
    period = int(request.args.get('period', '7'))
    
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    if chart_type == 'time':
        labels = []
        data = []
        
        # Debug: 检查总笔记数
        cur.execute('SELECT COUNT(*) FROM note')
        total_notes = cur.fetchone()[0]
        print(f"[DEBUG] Total notes in database: {total_notes}")
        
        # Debug: 查看最近的笔记
        cur.execute('SELECT id, created_at FROM note ORDER BY id DESC LIMIT 5')
        recent = cur.fetchall()
        print(f"[DEBUG] Recent notes: {recent}")
        
        for i in range(period - 1, -1, -1):
            date = datetime.now() - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            labels.append(date.strftime('%a'))
            
            # 查询当天笔记数 - 使用 LIKE 匹配日期前缀
            cur.execute('''
                SELECT COUNT(*) FROM note 
                WHERE created_at LIKE ?
            ''', (date_str + '%',))
            note_count = cur.fetchone()[0]
            
            # 查询当天错题数
            cur.execute('''
                SELECT COUNT(*) FROM error_book 
                WHERE created_at LIKE ?
            ''', (date_str + '%',))
            error_count = cur.fetchone()[0]
            
            # 从 module_usage 获取真实追踪时间
            cur.execute('''
                SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
                FROM module_usage 
                WHERE date = ?
            ''', (date_str,))
            study_time = int(cur.fetchone()[0] or 0)
            
            # 如果没有记录，使用估算
            if study_time == 0:
                study_time = note_count * 15 + error_count * 10
            
            if note_count > 0 or error_count > 0 or study_time > 0:
                print(f"[DEBUG] {date_str}: {note_count} notes, {error_count} errors = {study_time} min")
            
            data.append(study_time)
        
        conn.close()
        
        print(f"[DEBUG] Chart data: labels={labels}, data={data}, sum={sum(data)}")
        
        return jsonify({
            'success': True,
            'chartData': {
                'labels': labels,
                'data': data
            }
        })
    
    elif chart_type == 'review':
        cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1')
        completed = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM error_book')
        total = cur.fetchone()[0]
        
        conn.close()
        
        if total == 0:
            completed, total = 20, 25
        
        return jsonify({
            'success': True,
            'chartData': {
                'completed': completed,
                'total': total,
                'percentage': round(completed / total * 100) if total > 0 else 0
            }
        })
    
    conn.close()
    return jsonify({'success': False, 'error': 'Invalid chart type'})


@dashboard_bp.route('/analysis', methods=['GET'])
def get_analysis():
    """
    获取学习分析数据 - 全部从数据库真实读取
    GET /api/dashboard/analysis
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    user_id = request.args.get('user_id', 'default')
    
    # 获取用户设置（包括daily_goal）
    user_settings = db_sqlite.get_user_settings(user_id)
    daily_goal_minutes = user_settings.get('daily_goal', 60) if user_settings else 60
    
    # ========== 从错题本分析强项和弱项 ==========
    cur.execute('''
        SELECT subject, 
               COUNT(*) as total,
               SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed
        FROM error_book 
        GROUP BY subject
        ORDER BY total DESC
    ''')
    subject_errors = cur.fetchall()
    
    strengths = []
    improvements = []
    
    for row in subject_errors:
        subject = row['subject'] or 'General'
        total = row['total']
        reviewed = row['reviewed'] or 0
        # 复习率作为掌握程度指标
        mastery = round(reviewed / total * 100) if total > 0 else 0
        
        item = {
            'title': f'{subject}',
            'subject': subject,
            'accuracy': mastery,
            'total_errors': total,
            'reviewed': reviewed
        }
        
        if mastery >= 70:
            strengths.append(item)
        else:
            item['target'] = 80
            improvements.append(item)
    
    # ========== 从笔记分析学习情况 ==========
    cur.execute('''
        SELECT subject, COUNT(*) as count 
        FROM note 
        GROUP BY subject
        ORDER BY count DESC
    ''')
    note_subjects = cur.fetchall()
    
    # 笔记多的科目也算强项
    for row in note_subjects:
        subject = row['subject'] or 'General'
        count = row['count']
        if count >= 3:  # 至少3篇笔记
            # 检查是否已在列表中
            existing = [s for s in strengths if s['subject'] == subject]
            if not existing:
                strengths.append({
                    'title': f'{subject}',
                    'subject': subject,
                    'accuracy': min(90, 70 + count * 5),  # 笔记越多掌握度越高
                    'notes_count': count
                })
    
    # ========== 计算学习习惯（从真实数据） ==========
    # 获取笔记创建时间分布
    cur.execute('''
        SELECT strftime('%H', created_at) as hour, COUNT(*) as count
        FROM note
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 1
    ''')
    most_active_hour = cur.fetchone()
    
    # 获取最活跃的星期几
    cur.execute('''
        SELECT strftime('%w', created_at) as weekday, COUNT(*) as count
        FROM note
        GROUP BY weekday
        ORDER BY count DESC
        LIMIT 1
    ''')
    best_day_row = cur.fetchone()
    
    # 总笔记数和天数
    cur.execute('SELECT COUNT(*) FROM note')
    total_notes = cur.fetchone()[0]
    
    # 使用 substr 提取日期部分来计算不同的活跃天数
    cur.execute('SELECT COUNT(DISTINCT substr(created_at, 1, 10)) FROM note')
    active_days = cur.fetchone()[0]
    
    # 错题复习率
    cur.execute('SELECT COUNT(*) FROM error_book')
    total_errors = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1')
    reviewed_errors = cur.fetchone()[0]
    
    # 获取最近7天学习时间统计
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ?
    ''', (seven_days_ago,))
    week_minutes = int(cur.fetchone()[0] or 0)
    
    # 计算目标完成度
    weekly_goal = daily_goal_minutes * 7
    goal_completion = round(week_minutes / weekly_goal * 100) if weekly_goal > 0 else 0
    
    conn.close()
    
    # 处理最活跃时间
    if most_active_hour and most_active_hour['hour']:
        hour = int(most_active_hour['hour'])
        most_active_time = f'{hour:02d}:00-{(hour+2) % 24:02d}:00'
    else:
        most_active_time = 'No data'
    
    # 处理最佳学习日
    day_names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    if best_day_row and best_day_row['weekday'] is not None:
        best_day = day_names[int(best_day_row['weekday'])]
    else:
        best_day = 'No data'
    
    # 计算平均学习时长（每篇笔记约15分钟）
    avg_session = round(total_notes * 15 / active_days) if active_days > 0 else 0
    
    # 计算复习完成率
    review_rate = round(reviewed_errors / total_errors * 100) if total_errors > 0 else 0
    
    # 一致性分数（活跃天数/总天数）
    cur_date = datetime.now()
    first_note_days = 30  # 假设最多看30天
    consistency = round(active_days / first_note_days * 100) if first_note_days > 0 else 0
    consistency = min(100, consistency)
    
    # 生成基于daily_goal的建议
    goal_recommendations = []
    if goal_completion < 50:
        goal_recommendations.append({
            'type': 'warning',
            'title': 'Weekly Goal At Risk',
            'message': f'You\'ve completed only {goal_completion}% of your weekly goal ({week_minutes}/{weekly_goal} minutes). Try to study {daily_goal_minutes} minutes daily.'
        })
    elif goal_completion >= 100:
        goal_recommendations.append({
            'type': 'success',
            'title': 'Weekly Goal Achieved!',
            'message': f'Excellent! You\'ve studied {week_minutes} minutes this week, exceeding your {weekly_goal}-minute goal.'
        })
    elif goal_completion >= 80:
        goal_recommendations.append({
            'type': 'info',
            'title': 'Almost There',
            'message': f'You\'re at {goal_completion}% of your weekly goal. Just {weekly_goal - week_minutes} more minutes to go!'
        })
    
    return jsonify({
        'success': True,
        'strengths': strengths[:5] if strengths else [],
        'improvements': improvements[:5] if improvements else [],
        'has_data': len(strengths) > 0 or len(improvements) > 0,
        'habits': {
            'most_active_time': most_active_time,
            'average_session': avg_session if avg_session > 0 else 'No data',
            'consistency_score': consistency if active_days > 0 else 'No data',
            'best_day': best_day,
            'review_compliance': review_rate if total_errors > 0 else 'No data'
        },
        'goal_stats': {
            'daily_goal': daily_goal_minutes,
            'weekly_goal': weekly_goal,
            'week_minutes': week_minutes,
            'goal_completion': goal_completion,
            'recommendations': goal_recommendations
        }
    })


@dashboard_bp.route('/parent-report', methods=['GET'])
def get_parent_report():
    """
    获取家长报告 - 更客观直接的分析
    GET /api/dashboard/parent-report
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    today = datetime.now()
    user_id = request.args.get('user_id', 'default')
    
    # 获取用户设置（包含daily_goal）
    user_settings = db_sqlite.get_user_settings(user_id)
    daily_goal_minutes = user_settings.get('daily_goal', 60) if user_settings else 60
    
    # ========== 收集所有数据 ==========
    
    # 1. 总体统计
    cur.execute('SELECT COUNT(*) FROM note')
    total_notes = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM error_book')
    total_errors = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1')
    reviewed_errors = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM mindmap')
    total_mindmaps = cur.fetchone()[0]
    
    # 2. 本周数据
    week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ?', (week_start,))
    week_notes = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM mindmap WHERE created_at >= ?', (week_start,))
    week_mindmaps = cur.fetchone()[0]
    
    # 3. 上周数据（对比用）
    last_week_start = (today - timedelta(days=today.weekday() + 7)).strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ? AND created_at < ?', 
                (last_week_start, week_start))
    last_week_notes = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM mindmap WHERE created_at >= ? AND created_at < ?', 
                (last_week_start, week_start))
    last_week_mindmaps = cur.fetchone()[0]
    
    # 时间统计（从 module_usage 读取）
    # 本周总学习时间
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ?
    ''', (week_start,))
    week_minutes = int(cur.fetchone()[0] or 0)
    
    # 上周总学习时间
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ? AND date < ?
    ''', (last_week_start, week_start))
    last_week_minutes = int(cur.fetchone()[0] or 0)
    
    # 今日学习时间
    today_str = today.strftime('%Y-%m-%d')
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date = ?
    ''', (today_str,))
    today_minutes = int(cur.fetchone()[0] or 0)
    
    # 最近30天总学习时间
    thirty_days_ago = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ?
    ''', (thirty_days_ago,))
    total_minutes_30days = int(cur.fetchone()[0] or 0)
    
    # 4. 连续学习天数
    streak = 0
    check_date = today.date()
    while True:
        date_str = check_date.strftime('%Y-%m-%d')
        date_pattern = date_str + '%'
        cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (date_pattern,))
        has_note = cur.fetchone()[0] > 0
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at LIKE ? OR updated_at LIKE ?', 
                    (date_pattern, date_pattern))
        has_error = cur.fetchone()[0] > 0
        cur.execute('SELECT COUNT(*) FROM mindmap WHERE created_at LIKE ?', (date_pattern,))
        has_mindmap = cur.fetchone()[0] > 0
        
        if has_note or has_error or has_mindmap:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date == today.date() and streak == 0:
                check_date -= timedelta(days=1)
                continue
            break
        if streak >= 30:
            break
    
    # 5. 最近30天活跃天数
    thirty_days_ago = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    cur.execute('''
        SELECT COUNT(DISTINCT date) FROM (
            SELECT substr(created_at, 1, 10) as date FROM note WHERE created_at >= ?
            UNION
            SELECT substr(created_at, 1, 10) as date FROM error_book WHERE created_at >= ?
            UNION
            SELECT substr(created_at, 1, 10) as date FROM mindmap WHERE created_at >= ?
        )
    ''', (thirty_days_ago, thirty_days_ago, thirty_days_ago))
    active_days_30 = cur.fetchone()[0]
    
    # 6. 科目分布（包含note和error_book，mindmap无subject字段）
    cur.execute('''
        SELECT subject, SUM(count) as count FROM (
            SELECT subject, COUNT(*) as count FROM note GROUP BY subject
            UNION ALL
            SELECT subject, COUNT(*) as count FROM error_book GROUP BY subject
        )
        GROUP BY subject
        ORDER BY count DESC
    ''')
    subjects = cur.fetchall()
    
    # 7. 错题各科目情况
    cur.execute('''
        SELECT subject, 
               COUNT(*) as total,
               SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed
        FROM error_book 
        GROUP BY subject
    ''')
    error_by_subject = cur.fetchall()
    
    # 8. 学习时间分布
    cur.execute('''
        SELECT strftime('%H', created_at) as hour, COUNT(*) as count
        FROM note 
        GROUP BY hour
        ORDER BY count DESC
    ''')
    time_distribution = cur.fetchall()
    
    # 9. 上次学习时间（检查所有表）
    cur.execute('''
        SELECT MAX(date) FROM (
            SELECT created_at as date FROM note
            UNION
            SELECT created_at as date FROM error_book
            UNION
            SELECT created_at as date FROM mindmap
        )
    ''')
    last_study = cur.fetchone()[0]
    days_since_last = 0
    if last_study:
        last_date = datetime.strptime(last_study[:10], '%Y-%m-%d').date()
        days_since_last = (today.date() - last_date).days
    
    conn.close()
    
    # ========== 生成家长报告 ==========
    
    concerns = []  # 需要关注的问题
    positives = []  # 做得好的方面
    recommendations = []  # 建议
    
    # --- 分析每日目标达成情况 ---
    if today_minutes >= daily_goal_minutes:
        positives.append({
            'icon': '<i class="fas fa-trophy"></i>',
            'category': 'Daily Goal',
            'title': 'Daily Goal Achieved',
            'message': f'Your child has studied {today_minutes} minutes today, exceeding the daily goal of {daily_goal_minutes} minutes. Excellent!'
        })
    elif today_minutes >= daily_goal_minutes * 0.7:
        positives.append({
            'icon': '<i class="fas fa-check"></i>',
            'category': 'Daily Goal',
            'title': 'Good Progress',
            'message': f'Your child has completed {today_minutes}/{daily_goal_minutes} minutes today ({round(today_minutes/daily_goal_minutes*100)}% of goal).'
        })
    elif today_minutes > 0:
        concerns.append({
            'icon': '<i class="fas fa-clock"></i>',
            'category': 'Daily Goal',
            'title': 'Below Daily Goal',
            'message': f'Only {today_minutes} minutes studied today, which is {daily_goal_minutes - today_minutes} minutes short of the {daily_goal_minutes}-minute goal.',
            'severity': 'medium'
        })
    
    # 周学习时间分析
    weekly_goal_minutes = daily_goal_minutes * 7
    if week_minutes < weekly_goal_minutes * 0.5:
        concerns.append({
            'icon': '<i class="fas fa-hourglass-half"></i>',
            'category': 'Weekly Time',
            'title': 'Low Weekly Study Time',
            'message': f'This week: {week_minutes} minutes (goal: {weekly_goal_minutes} minutes). Only {round(week_minutes/weekly_goal_minutes*100)}% completed. More study time is needed.',
            'severity': 'high'
        })
    elif week_minutes >= weekly_goal_minutes:
        positives.append({
            'icon': '<i class="fas fa-star"></i>',
            'category': 'Weekly Time',
            'title': 'Weekly Goal Met',
            'message': f'This week: {week_minutes} minutes, achieving the weekly goal of {weekly_goal_minutes} minutes!'
        })
    
    # --- 分析学习频率 ---
    total_activities = total_notes + total_errors + total_mindmaps
    if total_activities == 0:
        concerns.append({
            'icon': '<i class="fas fa-exclamation-triangle"></i>',
            'category': 'Activity',
            'title': 'No Learning Records',
            'message': f'Your child has not created any study materials yet ({total_notes} notes, {total_mindmaps} mind maps, {total_errors} errors logged). This may indicate they haven\'t started using the system or need encouragement to begin.',
            'severity': 'high'
        })
    elif active_days_30 < 7:
        concerns.append({
            'icon': '<i class="fas fa-chart-line"></i>',
            'category': 'Consistency',
            'title': 'Low Study Frequency',
            'message': f'In the past 30 days, your child was only active for {active_days_30} days. Regular daily study is important for retention.',
            'severity': 'high'
        })
    elif active_days_30 < 15:
        concerns.append({
            'icon': '<i class="fas fa-chart-bar"></i>',
            'category': 'Consistency',
            'title': 'Moderate Study Frequency',
            'message': f'Your child studied on {active_days_30} out of the last 30 days. There\'s room for more consistent study habits.',
            'severity': 'medium'
        })
    else:
        positives.append({
            'icon': '<i class="fas fa-check-circle"></i>',
            'category': 'Consistency',
            'title': 'Good Study Habits',
            'message': f'Your child has been active on {active_days_30} of the last 30 days. This shows good consistency.'
        })
    
    # --- 分析连续学习 ---
    if streak == 0 and total_notes > 0:
        if days_since_last >= 7:
            concerns.append({
                'icon': '<i class="fas fa-times-circle"></i>',
                'category': 'Recent Activity',
                'title': 'Extended Break',
                'message': f'Your child hasn\'t studied for {days_since_last} days. A week-long gap can lead to significant knowledge loss.',
                'severity': 'high'
            })
        elif days_since_last >= 3:
            concerns.append({
                'icon': '<i class="fas fa-exclamation-circle"></i>',
                'category': 'Recent Activity',
                'title': 'Study Gap',
                'message': f'It\'s been {days_since_last} days since the last study session. Encourage them to get back on track.',
                'severity': 'medium'
            })
    elif streak >= 7:
        positives.append({
            'icon': '<i class="fas fa-fire"></i>',
            'category': 'Streak',
            'title': 'Excellent Consistency',
            'message': f'Your child has studied for {streak} consecutive days. This is excellent discipline!'
        })
    elif streak >= 3:
        positives.append({
            'icon': '<i class="fas fa-star"></i>',
            'category': 'Streak',
            'title': 'Building Momentum',
            'message': f'Your child is on a {streak}-day study streak. Encourage them to keep going!'
        })
    
    # --- 分析周对比 ---
    week_total = week_notes + week_mindmaps
    last_week_total = last_week_notes + last_week_mindmaps
    if last_week_total > 0 and week_total < last_week_total * 0.5:
        concerns.append({
            'icon': '<i class="fas fa-chart-line"></i>',
            'category': 'Trend',
            'title': 'Declining Activity',
            'message': f'This week\'s activity ({week_notes} notes, {week_mindmaps} maps) is significantly lower than last week ({last_week_notes} notes, {last_week_mindmaps} maps). This downward trend needs attention.',
            'severity': 'medium'
        })
    elif week_total > last_week_total:
        positives.append({
            'icon': '<i class="fas fa-trending-up"></i>',
            'category': 'Trend',
            'title': 'Improving Activity',
            'message': f'This week ({week_notes} notes, {week_mindmaps} maps) shows improvement over last week ({last_week_notes} notes, {last_week_mindmaps} maps).'
        })
    
    # --- 分析错题复习 ---
    if total_errors > 0:
        review_rate = round(reviewed_errors / total_errors * 100)
        pending_reviews = total_errors - reviewed_errors
        
        if review_rate < 30:
            concerns.append({
                'icon': '<i class="fas fa-edit"></i>',
                'category': 'Review',
                'title': 'Low Review Rate',
                'message': f'Only {review_rate}% of logged errors have been reviewed. {pending_reviews} problems remain unreviewed. Reviewing mistakes is crucial for improvement.',
                'severity': 'high'
            })
        elif review_rate < 70:
            concerns.append({
                'icon': '<i class="fas fa-clipboard-list"></i>',
                'category': 'Review',
                'title': 'Incomplete Reviews',
                'message': f'{pending_reviews} error problems haven\'t been reviewed yet. Encourage completion of reviews.',
                'severity': 'medium'
            })
        else:
            positives.append({
                'icon': '<i class="fas fa-check-circle"></i>',
                'category': 'Review',
                'title': 'Good Review Habits',
                'message': f'{review_rate}% of errors have been reviewed. Your child is actively learning from mistakes.'
            })
        
        # 具体科目薄弱点
        for row in error_by_subject:
            subj = row['subject'] or 'General'
            total = row['total']
            reviewed = row['reviewed'] or 0
            if total >= 3 and reviewed / total < 0.5:
                concerns.append({
                    'icon': '<i class="fas fa-bullseye"></i>',
                    'category': 'Subject',
                    'title': f'Weak Area: {subj}',
                    'message': f'{subj} has {total} logged errors with only {reviewed} reviewed. This subject needs more attention.',
                    'severity': 'medium'
                })
    else:
        if total_notes >= 5:
            recommendations.append({
                'icon': '<i class="fas fa-lightbulb"></i>',
                'title': 'Start Error Tracking',
                'message': 'Encourage your child to log mistakes in the Error Book. Tracking and reviewing errors is one of the most effective study techniques.'
            })
    
    # --- 分析学习时间 ---
    if time_distribution:
        late_night_count = sum(row['count'] for row in time_distribution if row['hour'] and (int(row['hour']) >= 23 or int(row['hour']) < 5))
        total_sessions = sum(row['count'] for row in time_distribution)
        
        if total_sessions > 0 and late_night_count / total_sessions > 0.3:
            concerns.append({
                'icon': '<i class="fas fa-moon"></i>',
                'category': 'Schedule',
                'title': 'Late Night Studying',
                'message': f'A significant portion of study sessions occur late at night (after 11 PM). This can affect sleep quality and learning efficiency.',
                'severity': 'medium'
            })
    
    # --- 分析科目平衡 ---
    if len(subjects) == 1 and total_notes >= 10:
        recommendations.append({
            'icon': '<i class="fas fa-book"></i>',
            'title': 'Diversify Subjects',
            'message': f'All notes are in {subjects[0]["subject"]}. Encourage studying other subjects for a well-rounded education.'
        })
    elif len(subjects) >= 3:
        positives.append({
            'icon': '<i class="fas fa-palette"></i>',
            'category': 'Balance',
            'title': 'Well-Rounded Study',
            'message': f'Your child is studying {len(subjects)} different subjects, showing good academic balance.'
        })
    
    # --- 思维导图使用分析 ---
    if total_mindmaps > 0 and total_notes > 0:
        mindmap_ratio = total_mindmaps / (total_notes + total_mindmaps)
        if mindmap_ratio >= 0.3:
            positives.append({
                'icon': '<i class="fas fa-project-diagram"></i>',
                'category': 'Learning Tools',
                'title': 'Active Mind Mapping',
                'message': f'Your child has created {total_mindmaps} mind maps, showing good use of visual learning tools for organizing knowledge.'
            })
    elif total_notes >= 5 and total_mindmaps == 0:
        recommendations.append({
            'icon': '<i class="fas fa-sitemap"></i>',
            'title': 'Try Mind Mapping',
            'message': 'Encourage using the mind map feature to visualize concepts and connections. This can significantly improve understanding and recall.'
        })
    
    # --- 通用建议 ---
    if total_activities > 0 and len(recommendations) < 2:
        if active_days_30 < 20:
            recommendations.append({
                'icon': '<i class="fas fa-calendar-alt"></i>',
                'title': 'Establish Daily Routine',
                'message': 'Try setting a fixed study time each day. Even 30 minutes of consistent daily study is more effective than irregular long sessions.'
            })
        
        if total_errors == 0 or (total_errors > 0 and reviewed_errors / total_errors < 0.8):
            recommendations.append({
                'icon': '<i class="fas fa-sync"></i>',
                'title': 'Regular Review Sessions',
                'message': 'Schedule weekly review sessions to revisit notes and clear pending error reviews.'
            })
    
    # --- 生成总结 ---
    if len(concerns) == 0:
        overall_status = 'excellent'
        overall_message = 'Your child is showing excellent study habits. Keep encouraging them!'
    elif len([c for c in concerns if c['severity'] == 'high']) > 0:
        overall_status = 'needs_attention'
        overall_message = 'There are some areas that need your attention. Please review the concerns below.'
    else:
        overall_status = 'good'
        overall_message = 'Overall progress is good with some areas for improvement.'
    
    return jsonify({
        'success': True,
        'summary': {
            'status': overall_status,
            'message': overall_message,
            'total_notes': total_notes,
            'total_mindmaps': total_mindmaps,
            'total_errors': total_errors,
            'review_rate': round(reviewed_errors / total_errors * 100) if total_errors > 0 else 0,
            'active_days': active_days_30,
            'current_streak': streak,
            'days_since_last': days_since_last,
            'time_stats': {
                'today_minutes': today_minutes,
                'daily_goal': daily_goal_minutes,
                'today_progress': round(today_minutes / daily_goal_minutes * 100) if daily_goal_minutes > 0 else 0,
                'week_minutes': week_minutes,
                'last_week_minutes': last_week_minutes,
                'week_change': week_minutes - last_week_minutes,
                'total_30days_minutes': total_minutes_30days,
                'avg_daily_30days': round(total_minutes_30days / 30) if total_minutes_30days > 0 else 0
            }
        },
        'concerns': concerns,
        'positives': positives,
        'recommendations': recommendations,
        'subjects': [{'name': s['subject'] or 'General', 'count': s['count']} for s in subjects],
        'generated_at': today.strftime('%Y-%m-%d %H:%M')
    })


@dashboard_bp.route('/schedule', methods=['GET'])
def get_schedule():
    """
    获取复习计划
    GET /api/dashboard/schedule
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    today = datetime.now()
    schedule = []
    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 0')
    pending_count = cur.fetchone()[0]
    
    conn.close()
    
    for i in range(7):
        date = today + timedelta(days=i)
        daily_count = max(3, min(8, pending_count // 7 + (1 if i < pending_count % 7 else 0)))
        
        schedule.append({
            'date': date.strftime('%m/%d'),
            'day': day_names[date.weekday()],
            'is_today': i == 0,
            'count': daily_count if pending_count > 0 else random.randint(3, 6)
        })
    
    return jsonify({
        'success': True,
        'schedule': schedule
    })


@dashboard_bp.route('/export', methods=['POST'])
def export_report():
    """
    导出学习报告
    POST /api/dashboard/export
    """
    data = request.json or {}
    period = data.get('period', 30)
    format_type = data.get('format', 'pdf')
    
    return jsonify({
        'success': True,
        'message': f'Report generated for {period} days',
        'download_url': f'/downloads/report_{datetime.now().strftime("%Y%m%d")}.{format_type}'
    })


@dashboard_bp.route('/heatmap', methods=['GET'])
def get_heatmap():
    """
    获取学习热力图数据（最近12周）
    GET /api/dashboard/heatmap
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # 获取最近84天（12周）的数据
    days = 84
    heatmap_data = []
    
    for i in range(days - 1, -1, -1):
        date = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y-%m-%d')
        date_pattern = date_str + '%'
            
    
        # 1. 优先从 module_usage 表获取真实追踪时间（秒转分钟）
        try:
            cur.execute('''
                SELECT COALESCE(SUM(duration_seconds), 0) 
                FROM module_usage WHERE date = ?
            ''', (date_str,))
            module_seconds = cur.fetchone()[0] or 0
            module_minutes = module_seconds // 60
        except:
            module_minutes = 0
        
        # 2. 统计当天活动数量（用于估算和显示）
        cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (date_pattern,))
        note_count = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM mindmap WHERE created_at LIKE ?', (date_pattern,))
        mindmap_count = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at LIKE ? OR updated_at LIKE ?', 
                    (date_pattern, date_pattern))
        error_count = cur.fetchone()[0]
        
        total_activity = note_count + mindmap_count + error_count
        
        # 3. 确定最终学习时间
        # 优先级: module_usage > 估算
        if module_minutes > 0:
            study_minutes = module_minutes
        elif total_activity > 0:
            # 估算时间：笔记×5 + 导图×5 + 错题×7
            study_minutes = note_count * 5 + mindmap_count * 5 + error_count * 7
        else:
            study_minutes = 0
        
        # 5. 计算学习强度等级（0-4级）- 纯粹基于学习时间
        if study_minutes == 0:
            level = 0
        elif study_minutes <= 10:
            level = 1  # ≤10分钟
        elif study_minutes <= 30:
            level = 2  # 10-30分钟
        elif study_minutes <= 60:
            level = 3  # 30-60分钟
        else:
            level = 4  # >60分钟
        
        heatmap_data.append({
            'date': date_str,
            'day': date.strftime('%a'),
            'level': level,
            'count': total_activity,
            'minutes': study_minutes,
            'notes': note_count,
            'mindmaps': mindmap_count,
            'errors': error_count
        })
    
    conn.close()
    
    # 计算统计信息
    active_days = sum(1 for d in heatmap_data if d['level'] > 0)
    total_activities = sum(d['count'] for d in heatmap_data)
    total_minutes = sum(d['minutes'] for d in heatmap_data)
    
    return jsonify({
        'success': True,
        'heatmap': heatmap_data,
        'stats': {
            'active_days': active_days,
            'total_days': days,
            'total_activities': total_activities,
            'total_minutes': total_minutes,
            'active_rate': round(active_days / days * 100)
        }
    })


@dashboard_bp.route('/today-modules', methods=['GET'])
def get_today_modules():
    """
    获取今日各模块使用时长
    GET /api/dashboard/today-modules
    Returns: [{"module": "note-assistant", "minutes": 15, "icon": "📝"}, ...]
    """
    try:
        conn = db_sqlite.get_conn()
        cur = conn.cursor()
        
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Query module usage for today (using correct column names: module, date)
        cur.execute('''
            SELECT module, SUM(duration_seconds) as total_seconds
            FROM module_usage
            WHERE date = ?
            GROUP BY module
            ORDER BY total_seconds DESC
        ''', (today,))
        
        rows = cur.fetchall()
        
        # Module icon mapping
        module_icons = {
            'note-assistant': '📝',
            'error-book': '📕',
            'error-practice': '✏️',
            'error-review': '🔄',
            'map-generation': '🗺️'
        }
        
        # Module display name mapping
        module_names = {
            'note-assistant': 'Note Assistant',
            'error-book': 'Error Book',
            'error-practice': 'Error Practice',
            'error-review': 'Error Review',
            'map-generation': 'Mind Map'
        }
        
        modules = []
        for row in rows:
            module_name = row[0]
            total_seconds = row[1] or 0
            minutes = round(total_seconds / 60.0, 1)
            
            if minutes > 0:  # Only include modules with actual usage
                modules.append({
                    'module': module_name,
                    'display_name': module_names.get(module_name, module_name),
                    'minutes': minutes,
                    'icon': module_icons.get(module_name, '📌')
                })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'modules': modules,
            'total': len(modules)
        })
    
    except Exception as e:
        print(f"Error in get_today_modules: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'modules': []
        }), 500


@dashboard_bp.route('/ai-suggestions', methods=['GET'])
def get_ai_suggestions():
    """
    获取AI学习建议（以鼓励为主）
    GET /api/dashboard/ai-suggestions
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    # 收集学习数据
    # 1. 总笔记数
    cur.execute('SELECT COUNT(*) FROM note')
    total_notes = cur.fetchone()[0]
    
    # 2. 本周笔记数
    week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ?', (week_start,))
    week_notes = cur.fetchone()[0]
    
    # 3. 科目分布
    cur.execute('SELECT subject, COUNT(*) as count FROM note GROUP BY subject ORDER BY count DESC')
    subjects = cur.fetchall()
    top_subject = subjects[0]['subject'] if subjects else None
    subject_count = len(subjects)
    
    # 4. 错题情况
    cur.execute('SELECT COUNT(*) FROM error_book')
    total_errors = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 1')
    reviewed_errors = cur.fetchone()[0]
    
    # 5. 连续学习天数
    streak = 0
    check_date = datetime.now().date()
    while True:
        date_str = check_date.strftime('%Y-%m-%d')
        date_pattern = date_str + '%'
        cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (date_pattern,))
        has_note = cur.fetchone()[0] > 0
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at LIKE ? OR updated_at LIKE ?', 
                    (date_pattern, date_pattern))
        has_error = cur.fetchone()[0] > 0
        
        if has_note or has_error:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date == datetime.now().date() and streak == 0:
                check_date -= timedelta(days=1)
                continue
            break
        if streak >= 30:
            break
    
    # 6. 最活跃时间
    cur.execute('''
        SELECT strftime('%H', created_at) as hour, COUNT(*) as count
        FROM note GROUP BY hour ORDER BY count DESC LIMIT 1
    ''')
    active_hour = cur.fetchone()
    
    # 生成真正个性化的建议（基于学生具体数据分析）
    suggestions = []
    encouragements = []
    
    # === 分析学生的具体情况 ===
    
    # 1. 分析最强科目
    if top_subject and subject_count >= 2:
        encouragements.append({
            'icon': '<i class="fas fa-bullseye"></i>',
            'title': f'{top_subject} Expert',
            'message': f'You\'ve been focusing a lot on {top_subject}. Your dedication is paying off!'
        })
    
    # 2. 分析错题情况 - 具体到科目
    if total_errors > 0:
        cur.execute('''
            SELECT subject, COUNT(*) as total,
                   SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END) as reviewed
            FROM error_book 
            GROUP BY subject
            ORDER BY (COUNT(*) - SUM(CASE WHEN reviewed = 1 THEN 1 ELSE 0 END)) DESC
            LIMIT 1
        ''')
        worst_review_subject = cur.fetchone()
        
        if worst_review_subject:
            subj = worst_review_subject['subject'] or 'General'
            pending = worst_review_subject['total'] - (worst_review_subject['reviewed'] or 0)
            if pending > 0:
                suggestions.append({
                    'icon': '<i class="fas fa-edit"></i>',
                    'title': f'{subj} Needs Attention',
                    'message': f'You have {pending} {subj} problem{"s" if pending > 1 else ""} to review. Tackling these will strengthen your weak spots!'
                })
    else:
        # 没有错题时，建议开始记录
        if total_notes >= 3:
            suggestions.append({
                'icon': '<i class="fas fa-clipboard-list"></i>',
                'title': 'Track Your Mistakes',
                'message': 'Try logging problems you find challenging in the Error Book. It\'s a powerful way to identify and fix weak areas!'
            })
    
    # 3. 分析学习时间趋势（本周 vs 上周）
    today = datetime.now()
    this_week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
    last_week_start = (today - timedelta(days=today.weekday() + 7)).strftime('%Y-%m-%d')
    
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ?', (this_week_start,))
    this_week_notes = cur.fetchone()[0]
    
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at >= ? AND created_at < ?', 
                (last_week_start, this_week_start))
    last_week_notes = cur.fetchone()[0]
    
    if this_week_notes > last_week_notes and last_week_notes > 0:
        encouragements.append({
            'icon': '<i class="fas fa-trending-up"></i>',
            'title': 'On the Rise',
            'message': 'Your study activity is up compared to last week! Great momentum!'
        })
    elif this_week_notes < last_week_notes and last_week_notes > 0:
        suggestions.append({
            'icon': '<i class="fas fa-dumbbell"></i>',
            'title': 'Match Last Week',
            'message': f'Last week you created {last_week_notes} notes. Can you beat that this week?'
        })
    
    # 4. 分析今天的学习情况
    today_str = today.strftime('%Y-%m-%d')
    cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (today_str + '%',))
    today_notes = cur.fetchone()[0]
    
    if today_notes == 0 and total_notes > 0:
        suggestions.append({
            'icon': '<i class="fas fa-calendar-day"></i>',
            'title': 'Today\'s Goal',
            'message': 'You haven\'t studied yet today. Even one note keeps the momentum going!'
        })
    
    # 5. 分析学习时间习惯
    if active_hour:
        hour = int(active_hour['hour'])
        if 5 <= hour < 9:
            encouragements.append({
                'icon': '<i class="fas fa-sunrise"></i>',
                'title': 'Early Bird',
                'message': 'You study best in the early morning. Your brain is sharpest then!'
            })
        elif 9 <= hour < 12:
            encouragements.append({
                'icon': '<i class="fas fa-sun"></i>',
                'title': 'Morning Learner',
                'message': 'Mid-morning is your peak study time. Great for focused work!'
            })
        elif 12 <= hour < 18:
            encouragements.append({
                'icon': '<i class="fas fa-cloud-sun"></i>',
                'title': 'Afternoon Achiever',
                'message': 'You\'re most active in the afternoon. Keep riding that energy!'
            })
        elif 18 <= hour < 22:
            encouragements.append({
                'icon': '<i class="fas fa-city"></i>',
                'title': 'Evening Scholar',
                'message': 'Evenings are your power hours. Great time for deep focus!'
            })
        else:
            suggestions.append({
                'icon': '<i class="fas fa-moon"></i>',
                'title': 'Sleep Matters',
                'message': 'You often study late at night. Try shifting earlier - well-rested brains learn better!'
            })
    
    # 5. 分析连续学习情况
    if streak >= 7:
        encouragements.append({
            'icon': '<i class="fas fa-fire"></i>',
            'title': f'{streak}-Day Streak!',
            'message': 'Incredible consistency! You\'ve built a real habit. Keep the flame alive!'
        })
    elif streak >= 3:
        encouragements.append({
            'icon': '<i class="fas fa-star"></i>',
            'title': f'{streak} Days Strong',
            'message': 'You\'re building a solid routine. A few more days and it becomes a habit!'
        })
    elif streak == 0 and total_notes > 0:
        # 检查上次学习是什么时候
        cur.execute('SELECT MAX(created_at) FROM note')
        last_note = cur.fetchone()[0]
        if last_note:
            last_date = datetime.strptime(last_note[:10], '%Y-%m-%d').date()
            days_ago = (today.date() - last_date).days
            if days_ago == 1:
                suggestions.append({
                    'icon': '<i class="fas fa-calendar-check"></i>',
                    'title': 'Welcome Back',
                    'message': 'You studied yesterday! Keep the streak going today.'
                })
            elif days_ago <= 3:
                suggestions.append({
                    'icon': '<i class="fas fa-redo"></i>',
                    'title': 'Quick Return',
                    'message': f'It\'s been {days_ago} days. Jump back in - your momentum is still there!'
                })
            elif days_ago <= 7:
                suggestions.append({
                    'icon': '<i class="fas fa-hand-paper"></i>',
                    'title': 'We Missed You',
                    'message': 'It\'s been a few days. Even a short session today would help!'
                })
    
    # 6. 分析科目平衡
    if subject_count == 1 and total_notes >= 5:
        suggestions.append({
            'icon': '<i class="fas fa-palette"></i>',
            'title': 'Try Something New',
            'message': f'You\'ve focused on {top_subject}. Maybe explore another subject too?'
        })
    elif subject_count >= 3:
        encouragements.append({
            'icon': '<i class="fas fa-paint-brush"></i>',
            'title': 'Well-Rounded',
            'message': 'You\'re balancing multiple subjects nicely. That\'s a great study strategy!'
        })
    
    # 7. 分析错题复习率
    if total_errors > 0:
        review_rate = round(reviewed_errors / total_errors * 100)
        if review_rate >= 90:
            encouragements.append({
                'icon': '<i class="fas fa-trophy"></i>',
                'title': 'Review Master',
                'message': 'Almost all your errors are reviewed! That\'s how you truly master material.'
            })
        elif review_rate >= 70:
            encouragements.append({
                'icon': '<i class="fas fa-thumbs-up"></i>',
                'title': 'Solid Review Habit',
                'message': 'You\'re doing well with reviews. Keep tackling those remaining ones!'
            })
        elif review_rate < 30 and total_errors >= 3:
            suggestions.append({
                'icon': '<i class="fas fa-bullseye"></i>',
                'title': 'Review Opportunity',
                'message': 'Many of your logged errors haven\'t been reviewed yet. That\'s where the real learning happens!'
            })
    
    # 8. 新用户欢迎
    if total_notes == 0 and total_errors == 0:
        encouragements.append({
            'icon': '<i class="fas fa-hand-peace"></i>',
            'title': 'Welcome!',
            'message': 'Ready to start your learning journey? Create your first note or log an error to begin!'
        })
    elif total_notes <= 2:
        encouragements.append({
            'icon': '<i class="fas fa-seedling"></i>',
            'title': 'Just Getting Started',
            'message': 'You\'re off to a great start! Each note you take builds your knowledge base.'
        })
    
    conn.close()
    
    return jsonify({
        'success': True,
        'encouragements': encouragements[:4],  # 最多4条表扬
        'suggestions': suggestions[:2],  # 最多2条建议
        'stats': {
            'total_notes': total_notes,
            'streak': streak,
            'week_notes': week_notes,
            'review_rate': round(reviewed_errors / total_errors * 100) if total_errors > 0 else 0
        }
    })


@dashboard_bp.route('/notifications', methods=['GET'])
def get_notifications():
    """
    获取真实通知
    GET /api/dashboard/notifications
    """
    conn = db_sqlite.get_conn()
    cur = conn.cursor()
    
    today = datetime.now()
    notifications = []
    
    # 1. 检查待复习错题
    cur.execute('SELECT COUNT(*) FROM error_book WHERE reviewed = 0')
    pending_errors = cur.fetchone()[0]
    if pending_errors > 0:
        notifications.append({
            'id': 'pending_errors',
            'icon': '<i class="fas fa-edit"></i>',
            'type': 'warning',
            'title': f'{pending_errors} Errors Pending Review',
            'message': f'You have {pending_errors} error(s) in your Error Book that need review.',
            'time': 'Now',
            'link': '/error-book'
        })
    
    # 2. 检查连续学习天数
    streak = 0
    check_date = today.date()
    while True:
        date_str = check_date.strftime('%Y-%m-%d')
        date_pattern = date_str + '%'
        cur.execute('SELECT COUNT(*) FROM note WHERE created_at LIKE ?', (date_pattern,))
        has_note = cur.fetchone()[0] > 0
        cur.execute('SELECT COUNT(*) FROM error_book WHERE created_at LIKE ? OR updated_at LIKE ?', 
                    (date_pattern, date_pattern))
        has_error = cur.fetchone()[0] > 0
        cur.execute('SELECT COUNT(*) FROM study_progress WHERE date = ?', (date_str,))
        has_progress = cur.fetchone()[0] > 0
        
        if has_note or has_error or has_progress:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date == today.date() and streak == 0:
                check_date -= timedelta(days=1)
                continue
            break
        if streak >= 30:
            break
    
    if streak >= 3:
        notifications.append({
            'id': 'streak',
            'icon': '<i class="fas fa-fire"></i>',
            'type': 'success',
            'title': f'{streak} Day Streak!',
            'message': f'You\'ve been studying for {streak} consecutive days. Keep it up!',
            'time': 'Today',
            'link': None
        })
    
    # 3. 检查本周学习时间
    week_start = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')
    cur.execute('''
        SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
        FROM module_usage 
        WHERE date >= ?
    ''', (week_start,))
    week_minutes = int(cur.fetchone()[0] or 0)
    
    if week_minutes >= 60:
        hours = round(week_minutes / 60, 1)
        notifications.append({
            'id': 'weekly_time',
            'icon': '<i class="fas fa-clock"></i>',
            'type': 'info',
            'title': f'{hours}h Studied This Week',
            'message': f'You\'ve studied for {hours} hours this week.',
            'time': 'This week',
            'link': None
        })
    
    # 4. 检查最近添加的笔记
    cur.execute('''
        SELECT title, created_at FROM note 
        ORDER BY created_at DESC LIMIT 1
    ''')
    last_note = cur.fetchone()
    if last_note:
        note_title = last_note['title'] or 'Untitled'
        note_time = last_note['created_at']
        if note_time:
            # 计算时间差
            note_date = datetime.strptime(note_time[:19], '%Y-%m-%d %H:%M:%S')
            diff = today - note_date
            if diff.days == 0:
                time_str = 'Today'
            elif diff.days == 1:
                time_str = 'Yesterday'
            else:
                time_str = f'{diff.days} days ago'
            
            if diff.days <= 3:
                notifications.append({
                    'id': 'last_note',
                    'icon': '<i class="fas fa-book"></i>',
                    'type': 'info',
                    'title': 'Note Created',
                    'message': f'"{note_title[:30]}..." was created.',
                    'time': time_str,
                    'link': '/note-assistant'
                })
    
    conn.close()
    
    # 如果没有通知，添加一个默认的
    if len(notifications) == 0:
        notifications.append({
            'id': 'welcome',
            'icon': '<i class="fas fa-hand-peace"></i>',
            'type': 'info',
            'title': 'Welcome!',
            'message': 'Start studying to see your progress here.',
            'time': 'Now',
            'link': None
        })
    
    return jsonify({
        'success': True,
        'notifications': notifications,
        'count': len(notifications)
    })