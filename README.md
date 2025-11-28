## run.py需修改的
需要在run.py中添加一句注册新的蓝图：app.register_blueprint(track_bp)

## 所需数据库相关表及其字段
📘 表名：errorbook

🧩 字段：
  - id (INTEGER)
  - user_id (INTEGER)
  - subject (TEXT)
  - type (TEXT)
  - tags (TEXT)
  - question (TEXT)
  - user_answer (TEXT)
  - correct_answer (TEXT)
  - analysis_steps (TEXT)
  - created_at (DATETIME)
  - updated_at (DATETIME)
  - reviewed (INTEGER)
  - review_count (INTEGER)
  - redo_answer (TEXT)
  - redo_time (TEXT)
  - difficulty (TEXT)
    
==================================================

📘 表名：study_progress

🧩 字段：
  - id (INTEGER)
  - user_id (INTEGER)
  - date (TEXT)
  - reviewed_questions (INTEGER)
  - review_correct_questions (INTEGER)
  - review_time_minutes (INTEGER)
  - practice_questions (INTEGER)
  - practice_correct_questions (INTEGER)
  - practice_time_minutes (INTEGER)
  - created_at (DATETIME)
  - updated_at (DATETIME)
  - subject (TEXT)
## 修改的内容
1、可拍多题

2、错题可重做（在review界面），重做对一次即为掌握

3、error-list页面的科目联动

4、可按照科目难度是否掌握进行筛选

5、可记录每天各个学科：

（1）review和practice所用时长（只计算前台的时长）

（2）review的题目数量及做对的题目数量

（3）practice的题目数量（统计的是生成的题目，不严谨）


## 后续还需修改的内容

1、模型正确率低，参数可能需要修改

2、很多小bug，我后面调
