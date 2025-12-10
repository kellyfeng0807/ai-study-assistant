# 一、合并时需修改的文件

## 可直接替换的文件

1、error_book.py

2、error-book.js, error-practice.js, error-review.js

3、error-book.html, error-practice.html, error-review.html

4、error-book.css, error-practice.css, error-review.css


## 需要单独修改的文件
### 1、app.py

在create_app函数中添加：
~~~~
@app.route('/uploads/error-crop/<path:path>')
def uploaded_image( path):
    return send_from_directory('../backend/uploads/error-crop',  path)
~~~~

### 2、db_sqlite.py

（1）替换了初始化error_book表和所有相关的处理函数


（2）新建了一个表practice_record，及其所有相关函数

# 二、新增的功能

1、在review界面可文字提交redo
 
2、在review界面可查看最近一次提交时间及提交的答案（即使提交的是图片显示的也是识别出来的答案）

3、在practice界面可以提交文字和图片进行做题

4、在practice界面可点击add to errorbook将practice题目添加到错题本

5、第一次进入practice界面时调用ai生成3道新题，后续进入直接从数据库读取，点击下方regenerate按钮可以重新生成3道题

6、可以显示出题目中的图片，但一道题有多张图和多题有多张图的情况下不太能分清那张图属于哪一道题