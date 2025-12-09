"""
Track Module - 时间追踪模块
追踪用户在 Note Assistant, Error Book, Mind Map 三个模块的使用时间
"""

from flask import Blueprint, request, jsonify
import json
from datetime import datetime, timedelta
import sys
import os

# Import shared database module
import db_sqlite

track_bp = Blueprint("track_bp", __name__)

# Initialize tables
db_sqlite.init_db()

# 只追踪这三个核心模块
ALLOWED_MODULES = ['note-assistant', 'error-book', 'map-generation']


@track_bp.route('/api/track_time', methods=['POST'])
def track_time():
    """追踪学习时间（用于 Error Book 的复习和练习）"""
    try:
        data = json.loads(request.data.decode("utf-8"))
        seconds = int(data.get("seconds", 0))
        mode = data.get("mode", "unknown")
        subject = data.get("subject", "unknown")
        is_correct = int(data.get("is_correct", 0))

        if seconds <= 0 or seconds > 120 * 60:
            return jsonify({"ignored": True})

        if seconds >= 5:
            minutes = max(1, round(seconds / 60))
        else:
            return jsonify({"ignored": True})
        
        today = datetime.now().strftime("%Y-%m-%d")
        user_id = 1

        # Get or create study progress record
        row = db_sqlite.get_study_progress(user_id, today, subject)

        if row:
            row_id, reviewed, correct_review, review_time_minutes, practice_count, correct_practice, practice_time_minutes = row
        else:
            row_id = db_sqlite.insert_study_progress(user_id, today, subject)
            reviewed = correct_review = review_time_minutes = 0
            practice_count = correct_practice = practice_time_minutes = 0

        # Update based on mode
        if mode == "review":
            reviewed += 1
            correct_review += is_correct
            review_time_minutes += minutes
            db_sqlite.update_study_progress_review(row_id, reviewed, correct_review, review_time_minutes)
        elif mode == "practice":
            practice_count += 1
            correct_practice += is_correct
            practice_time_minutes += minutes
            db_sqlite.update_study_progress_practice(row_id, practice_count, correct_practice, practice_time_minutes)
        else:
            print("WARNING: Unknown mode:", mode)

        return jsonify({"success": True})

    except Exception as e:
        print("track_time error:", e)
        return jsonify({"success": False}), 500


@track_bp.route('/api/track_module', methods=['POST'])
def track_module():
    """
    追踪模块使用时间
    Expected payload: { "module": "note-assistant", "seconds": 120 }
    """
    try:
        data = json.loads(request.data.decode("utf-8"))
        module = data.get("module", "unknown")
        seconds = int(data.get("seconds", 0))
        
        # 只追踪三个核心模块
        if module not in ALLOWED_MODULES:
            return jsonify({"ignored": True, "reason": "Module not tracked"})
        
        # Validate seconds (at least 5 seconds, max 2 hours)
        if seconds < 5 or seconds > 7200:
            return jsonify({"ignored": True, "reason": "Duration out of range"})
        
        today = datetime.now().strftime("%Y-%m-%d")
        user_id = 1
        
        # Track the module usage
        db_sqlite.track_module_usage(user_id, today, module, seconds)
        
        print(f"[TRACK] Module: {module}, Duration: {seconds}s")
        return jsonify({"success": True})
        
    except Exception as e:
        print("track_module error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@track_bp.route('/api/module_stats', methods=['GET'])
def get_module_stats():
    """
    获取模块使用统计（用于当天各版面使用时间）
    Query params: period (7, 30, 90 days)
    """
    try:
        period = int(request.args.get('period', 7))
        user_id = 1
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=period)
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = end_date.strftime('%Y-%m-%d')
        
        # Get aggregated stats for the period
        stats = db_sqlite.get_module_usage_stats(user_id, start_date_str, end_date_str)
        
        # Get daily data for chart
        daily = db_sqlite.get_module_usage_daily(user_id, start_date_str, period)
        
        return jsonify({
            "success": True,
            "stats": stats,
            "daily": daily,
            "period": period
        })
        
    except Exception as e:
        print("get_module_stats error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@track_bp.route('/api/module_daily_trend', methods=['GET'])
def get_module_daily_trend():
    """
    获取最近7天每天的总学习时间（用于趋势图）
    返回格式: [{"date": "2025-12-09", "total_seconds": 3600, "modules": {...}}, ...]
    """
    try:
        user_id = 1
        days = int(request.args.get('days', 7))
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days-1)
        
        # 获取每日各模块数据
        daily_data = db_sqlite.get_module_usage_daily(user_id, start_date.strftime('%Y-%m-%d'), days)
        
        # 按日期聚合
        date_dict = {}
        for item in daily_data:
            date = item['date']
            if date not in date_dict:
                date_dict[date] = {
                    'date': date,
                    'total_seconds': 0,
                    'modules': {}
                }
            date_dict[date]['total_seconds'] += item['duration_seconds']
            date_dict[date]['modules'][item['module']] = item['duration_seconds']
        
        # 填充缺失的日期
        result = []
        for i in range(days):
            date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
            if date in date_dict:
                result.append(date_dict[date])
            else:
                result.append({
                    'date': date,
                    'total_seconds': 0,
                    'modules': {}
                })
        
        return jsonify({
            "success": True,
            "trend": result,
            "days": days
        })
        
    except Exception as e:
        print("get_module_daily_trend error:", e)
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@track_bp.route('/api/module_today', methods=['GET'])
def get_module_today():
    """
    获取当天各版面的使用时间
    返回格式: [{"module": "note-assistant", "seconds": 1200}, ...]
    """
    try:
        user_id = 1
        today = datetime.now().strftime('%Y-%m-%d')
        
        stats = db_sqlite.get_module_usage_stats(user_id, today, today)
        
        # 确保三个模块都有数据（即使是0）
        module_dict = {s['module']: s['total_seconds'] for s in stats}
        
        result = []
        for module in ALLOWED_MODULES:
            result.append({
                'module': module,
                'seconds': module_dict.get(module, 0),
                'sessions': next((s['total_sessions'] for s in stats if s['module'] == module), 0)
            })
        
        total_seconds = sum(item['seconds'] for item in result)
        
        return jsonify({
            "success": True,
            "today": today,
            "modules": result,
            "total_seconds": total_seconds
        })
        
    except Exception as e:
        print("get_module_today error:", e)
        return jsonify({"success": False, "error": str(e)}), 500