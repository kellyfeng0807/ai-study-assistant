/**
 * Error Book Page JavaScript
 */

class ErrorBookManager {
    constructor() {
        this.selectedFiles = [];
        this.currentFilter = 'all';
        this.init();
    }
    
    init() {
        this.initUploadArea();
        this.bindEventListeners();
        this.bindActionButtons();   // ⭐ 新增
    }
    
    initUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        
        if (!uploadArea || !imageInput) return;
        
        uploadArea.addEventListener('click', () => {
            imageInput.click();
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragging');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragging');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragging');
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            this.handleFiles(files);
        });
        
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
        });
    }
    
    bindEventListeners() {
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processErrors());
        }
        
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        const sortSelect = document.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortErrors(e.target.value);
            });
        }
    }
    
    handleFiles(files) {
        if (files.length === 0) return;
        
        this.selectedFiles = files;
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.disabled = false;
        }
        
        const uploadTitle = document.querySelector('.upload-title');
        if (uploadTitle) {
            uploadTitle.textContent = `${files.length} image${files.length > 1 ? 's' : ''} selected`;
        }
        
        Utils.showNotification(`${files.length} image(s) selected`, 'success');
    }

// ----------------------
// processErrors
// ----------------------
async processErrors() {
    if (this.selectedFiles.length === 0) return;

    Utils.showNotification('Processing images...', 'info');
    const errorsList = document.querySelector('.errors-list');

    for (const file of this.selectedFiles) {
        try {
            // 🟢 直接上传并获取完整结构化结果（来自 Qwen-VL）
            const uploadResult = await fileUploader.uploadFile(file, '/error/upload');

            // 🔴 检查是否成功且包含 question_text
            if (!uploadResult?.success || !uploadResult.question_text) {
                Utils.showNotification(`题目解析失败，跳过 ${file.name}`, 'warning');
                continue;
            }

            // 🟢 直接使用后端返回的数据（已包含所有字段）
            const cardData = {
                id: uploadResult.id || ("err_" + Date.now() + "_" + Math.floor(Math.random() * 999)),
                subject: uploadResult.subject || '未知科目',
                type: uploadResult.type || '',
                tags: Array.isArray(uploadResult.tags) ? uploadResult.tags : [],
                question_text: uploadResult.question_text,
                user_answer: uploadResult.user_answer || '',
                correct_answer: uploadResult.correct_answer || '',
                analysis_steps: Array.isArray(uploadResult.analysis_steps) ? uploadResult.analysis_steps : [],
                difficulty: 'Medium' // 可选：后续可从后端返回
            };

            // 🟢 保存到 localStorage（供 Review 页面使用）
            try {
                const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
                raw[cardData.id] = cardData;
                localStorage.setItem('errorbook_items', JSON.stringify(raw));
            } catch (e) {
                console.warn('localStorage 写入失败', e);
            }

            // 🟢 渲染卡片（只显示题目）
            this.addErrorCard({
                id: cardData.id,
                subject: cardData.subject,
                difficulty: cardData.difficulty,
                text: `<p>${escapeHtml(cardData.question_text)}</p>`
            });

            // 🟢 触发 MathJax 渲染
            if (typeof MathJax !== 'undefined') {
                MathJax.typesetPromise([errorsList]).catch(console.warn);
            }

            Utils.showNotification(`题目处理完成：${file.name}`, 'success');

        } catch (err) {
            console.error('处理图片出错:', file.name, err);
            Utils.showNotification(`处理图片出错：${file.name}`, 'error');
        }
    }

    Utils.showNotification('所有图片处理完成 ✅', 'success');
    this.resetUploadArea();

    // -------------------------
    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br/>');
    }
}
/*
async processErrors() {
    if (this.selectedFiles.length === 0) return;

    Utils.showNotification('Processing images...', 'info');

    const errorsList = document.querySelector('.errors-list');

    for (const file of this.selectedFiles) {
        try {
            // 1️⃣ 上传图片获取 OCR
            const uploadResult = await fileUploader.uploadFile(file, '/error/upload');

            if (!uploadResult?.success || !uploadResult.question?.text) {
                Utils.showNotification(`OCR 提取失败，跳过 ${file.name}`, 'warning');
                continue;
            }

            const ocrFullText = uploadResult.question.text; // OCR 全文

            // 2️⃣ 调用后端 /categorize 拆分题目/答案
            let parsed = {};
            try {
                const resp = await fetch(`${API_BASE}/error/categorize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: ocrFullText })
                });
                const json = await resp.json().catch(() => null);
                parsed = (json && json.data) || {};
            } catch (err) {
                console.warn('分类/分析请求错误:', err);
                parsed = {};
            }

            // 3️⃣ 构建完整 cardData
            const cardId = "err_" + Date.now() + "_" + Math.floor(Math.random() * 999);
            const cardData = {
                id: cardId,
                subject: parsed.subject || '',
                difficulty: 'Medium',
                tags: parsed.tags || [],
                question_text: parsed.question_text || ocrFullText,
                user_answer: parsed.user_answer || uploadResult.question.raw_answer || '',
                correct_answer: parsed.correct_answer || '',
                analysis_steps: parsed.analysis_steps || [],
                type: parsed.type || '',
                ocr_raw: uploadResult.question,
                backend_raw: parsed
            };

            // 4️⃣ 保存完整对象到 localStorage（用于 Review 页面）
            try {
                const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
                raw[cardData.id] = cardData;
                localStorage.setItem('errorbook_items', JSON.stringify(raw));
            } catch (e) {
                console.warn('localStorage 写入失败', e);
            }

            // 5️⃣ 渲染卡片列表页，只显示题目
            this.addErrorCard({
                id: cardData.id,
                subject: cardData.subject,
                difficulty: cardData.difficulty,
                text: `<p>${escapeHtml(cardData.question_text)}</p>` // 只显示题目
            });

            // 6️⃣ MathJax 渲染公式
            MathJax.typesetPromise([errorsList]);

            Utils.showNotification(`题目处理完成：${file.name}`, 'success');

        } catch (err) {
            console.error('处理图片出错:', file.name, err);
            Utils.showNotification(`处理图片出错：${file.name}`, 'error');
        }
    }

    Utils.showNotification('所有图片处理完成 ✅', 'success');
    this.resetUploadArea();

    // -------------------------
    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;')
            .replace(/\n/g,'<br/>');
    }
}
*/
// ----------------------
// addErrorCard
// ----------------------
addErrorCard(data) {
    const errorsList = document.querySelector('.errors-list');
    if (!errorsList) return;

    const card = document.createElement('div');
    card.className = 'error-card';

    // ⭐ 加上唯一 ID
    card.dataset.errorId = data.id;

    // 处理难度的样式
    let difficultyClass = '';
    switch ((data.difficulty || '').toLowerCase()) {
        case 'easy': difficultyClass = 'difficulty-easy'; break;
        case 'medium': difficultyClass = 'difficulty-medium'; break;
        case 'hard': difficultyClass = 'difficulty-hard'; break;
    }

    // 渲染卡片 DOM（列表页只显示题目）
    card.innerHTML = `
        <div class="error-header">
            <span class="error-subject">${data.subject || '未知科目'}</span>
            <span class="error-difficulty ${difficultyClass}">${data.difficulty || ''}</span>
        </div>
        <div class="error-content">
            <p class="error-description">${data.text || ''}</p>
        </div>
        <div class="error-footer">
            <span class="error-date">${new Date().toLocaleDateString()}</span>
            <div class="error-actions">
                <button class="button-outline review-btn">Review</button>
                <button class="button-outline practice-btn">Practice</button>
            </div>
        </div>
    `;

    errorsList.prepend(card);

    // ⭐ Review 按钮跳转到 review 页面，Review 页面从 localStorage 读取完整对象
    const reviewBtn = card.querySelector('.review-btn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            window.location.href = `/error-review.html?id=${encodeURIComponent(data.id)}`;
        });
    }

    // ⭐ Practice 按钮
    const practiceBtn = card.querySelector('.practice-btn');
    if (practiceBtn) {
        practiceBtn.addEventListener('click', () => {
            const topic = data.subject || (data.tags && data.tags[0]) || '';
            window.location.href = `/error/practice?id=${encodeURIComponent(data.id)}&topic=${encodeURIComponent(topic)}`;
        });
    }
}


    resetUploadArea() {
        this.selectedFiles = [];
        const uploadTitle = document.querySelector('.upload-title');
        const processBtn = document.getElementById('processBtn');
        const imageInput = document.getElementById('imageInput');
        
        if (uploadTitle) {
            uploadTitle.textContent = 'Upload Error Question';
        }
        if (processBtn) {
            processBtn.disabled = true;
        }
        if (imageInput) {
            imageInput.value = '';
        }
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.filter === filter);
        });
        
        this.applyFilter();
    }
    
    applyFilter() {
        const errorCards = document.querySelectorAll('.error-card');
        
        errorCards.forEach(card => {
            const subject = card.querySelector('.error-subject').textContent.toLowerCase();
            const shouldShow = this.currentFilter === 'all' || subject === this.currentFilter;
            
            if (shouldShow) {
                card.style.display = '';
                card.style.animation = 'slideUp 400ms ease-out';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    sortErrors(sortBy) {
        const errorsList = document.querySelector('.errors-list');
        const errorCards = Array.from(document.querySelectorAll('.error-card'));
        
        errorCards.sort((a, b) => {
            if (sortBy === 'date') {
                const dateA = new Date(a.querySelector('.error-date').textContent);
                const dateB = new Date(b.querySelector('.error-date').textContent);
                return dateB - dateA;
            } else if (sortBy === 'subject') {
                const subjectA = a.querySelector('.error-subject').textContent;
                const subjectB = b.querySelector('.error-subject').textContent;
                return subjectA.localeCompare(subjectB);
            } else if (sortBy === 'difficulty') {
                const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                const diffA = difficultyOrder[a.querySelector('.error-difficulty').textContent] || 0;
                const diffB = difficultyOrder[b.querySelector('.error-difficulty').textContent] || 0;
                return diffB - diffA;
            }
            return 0;
        });
        
        errorCards.forEach(card => errorsList.appendChild(card));
    }

//新增函数
bindActionButtons() {
    const errorsList = document.querySelector('.errors-list');

    // 事件委托，监听整个列表
    errorsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const card = btn.closest('.error-card');
        if (!card) return;

        const id = card.dataset.errorId;  // ⭐ 读取卡片 ID

        if (btn.classList.contains('review-btn')) {
            this.goToReview(id);
        }
        else if (btn.classList.contains('practice-btn')) {
            this.goToPractice(id);
        }
    });
}

goToReview(id) {
    if (!id) {
        console.error("Error: missing question ID for review");
        return;
    }
    // ⭐ 使用 localStorage 中的实际 key
    window.location.href = `/error-review.html?id=${encodeURIComponent(id)}`;
}


goToPractice(id) {
    if (!id) {
        console.error("Error: missing question ID for practice");
        return;
    }
    window.location.href = `/api/error/practice?id=${id}`;
}

}


document.addEventListener('DOMContentLoaded', () => {
    const errorBookManager = new ErrorBookManager();
    console.log('Error Book initialized');
});
