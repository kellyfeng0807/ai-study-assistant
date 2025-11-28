from flask import Blueprint, request, jsonify
import sqlite3, json, os
from datetime import datetime

track_bp = Blueprint("track_bp", __name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "study.db")
@track_bp.route('/api/track_time', methods=['POST'])
def track_time():
    try:
        data = json.loads(request.data.decode("utf-8"))
        seconds = int(data.get("seconds", 0))
        mode = data.get("mode", "unknown")
        subject = data.get("subject", "unknown")
        is_correct = int(data.get("is_correct", 0))  # 新增

        if seconds <= 0 or seconds > 120 * 60:
            return jsonify({"ignored": True})

        minutes = max(0, round(seconds / 60))
        today = datetime.now().strftime("%Y-%m-%d")
        user_id = 1  # 测试用，正式要替换成登录用户

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 检查当天 + 科目记录是否存在
        cursor.execute("""
            SELECT id, reviewed_questions, review_correct_questions,
                   review_time_minutes,
                   practice_questions, practice_correct_questions,
                   practice_time_minutes
            FROM study_progress
            WHERE user_id = ? AND date = ? AND subject = ?
        """, (user_id, today, subject))
        row = cursor.fetchone()

        if row:
            row_id, reviewed, correct_review, review_time, practice_count, correct_practice, practice_time = row
        else:
            # 不存在就插入一条
            cursor.execute("""
                INSERT INTO study_progress(
                    user_id, date, subject,
                    reviewed_questions, review_correct_questions, review_time_minutes,
                    practice_questions, practice_correct_questions, practice_time_minutes
                ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
            """, (user_id, today, subject))
            row_id = cursor.lastrowid
            reviewed = correct_review = review_time = 0
            practice_count = correct_practice = practice_time = 0

        # 根据 mode 更新对应字段
        if mode == "review":
            reviewed += 1
            correct_review += is_correct
            review_time += minutes
            cursor.execute("""
                UPDATE study_progress
                SET reviewed_questions=?, review_correct_questions=?, review_time_minutes=?
                WHERE id=?
            """, (reviewed, correct_review, review_time, row_id))
        elif mode == "practice":
            practice_count += 1
            correct_practice += is_correct
            practice_time += minutes
            cursor.execute("""
                UPDATE study_progress
                SET practice_questions=?, practice_correct_questions=?, practice_time_minutes=?
                WHERE id=?
            """, (practice_count, correct_practice, practice_time, row_id))
        else:
            print("⚠ 未知 mode:", mode)

        conn.commit()
        conn.close()
        return jsonify({"success": True})

    except Exception as e:
        print("track_time error:", e)
        return jsonify({"success": False}), 500
