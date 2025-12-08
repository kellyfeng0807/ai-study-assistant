from flask import Blueprint, request, jsonify
import json
from datetime import datetime
import sys
import os

# Import shared database module
import db_sqlite

track_bp = Blueprint("track_bp", __name__)

# Initialize study_progress table
db_sqlite.init_db()
@track_bp.route('/api/track_time', methods=['POST'])
def track_time():
    try:
        data = json.loads(request.data.decode("utf-8"))
        seconds = int(data.get("seconds", 0))
        mode = data.get("mode", "unknown")
        subject = data.get("subject", "unknown")
        is_correct = int(data.get("is_correct", 0))

        if seconds <= 0 or seconds > 120 * 60:
            return jsonify({"ignored": True})

        # 最小 1 分钟，否则四舍五入
        if seconds >= 5:  # 至少 5 秒才记录
            minutes = max(1, round(seconds / 60))  # 最小 1 分钟
        else:
            return jsonify({"ignored": True})
            
        today = datetime.now().strftime("%Y-%m-%d")
        user_id = 1  # Test user, replace with login user in production

        print(f"📊 Track: {seconds}s -> {minutes}min for {subject} ({mode})")

        # Get or create study progress record
        row = db_sqlite.get_study_progress(user_id, today, subject)

        if row:
            row_id, reviewed, correct_review, review_time, practice_count, correct_practice, practice_time = row
        else:
            # Insert new record if not exists
            row_id = db_sqlite.insert_study_progress(user_id, today, subject)
            reviewed = correct_review = review_time = 0
            practice_count = correct_practice = practice_time = 0

        # Update based on mode
        if mode == "review":
            reviewed += 1
            correct_review += is_correct
            review_time += minutes
            db_sqlite.update_study_progress_review(row_id, reviewed, correct_review, review_time)
        elif mode == "practice":
            practice_count += 1
            correct_practice += is_correct
            practice_time += minutes
            db_sqlite.update_study_progress_practice(row_id, practice_count, correct_practice, practice_time)
        else:
            print("⚠ Unknown mode:", mode)

        return jsonify({"success": True, "minutes": minutes})

    except Exception as e:
        print("track_time error:", e)
        return jsonify({"success": False}), 500