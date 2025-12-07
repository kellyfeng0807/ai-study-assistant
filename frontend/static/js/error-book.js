/**
 * Error Book Page JavaScript
 */

class ErrorBookManager {
    constructor() {
        this.selectedFiles = [];
        // 多维度筛选状态
        this.currentFilter = {
            subject: 'all',      // 'all' 或具体科目
            difficulty: 'all',   // 'all' 或 'easy' / 'medium' / 'difficult'
            mastered: 'all'      // 'all' / 'true' / 'false'
        };
        this.init();
    }
    
    init() {
        this.initUploadArea();
        this.bindEventListeners();
        this.bindActionButtons(); 
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

    // 从后端数据库加载错题
    async loadFromServer() {
        try {
            const res = await fetch('/api/error/list');
            console.log('Fetch /api/error/list status:', res.status);

            if (!res.ok) {
                console.error('Failed to fetch error list:', await res.text());
                return;
            }

            const data = await res.json();
            console.log('Loaded errors from server:', data);

            if (!data.success) {
                console.warn("Server list load failed:", data);
                return;
            }

            data.errors.forEach(err => {
                this.addErrorCard({
                    id: err.id,
                    subject: err.subject || '未分类',
                    difficulty: err.difficulty || 'medium',
                    reviewed: err.reviewed,
                    tags: Array.isArray(err.tags) ? err.tags : [],
                    text: `<p>${err.question_text || ''}</p>`,
                    created_at: err.created_at
                });
            });

            // 渲染 MathJax
            if (typeof MathJax !== 'undefined') {
                setTimeout(() => {
                    MathJax.typesetPromise().catch(console.warn);
                }, 100);
            }

            console.log(`Loaded ${data.total} errors from DB.`);

        } catch (e) {
            console.error("Failed to load error list:", e);
        }
    }
    
    bindEventListeners() {
        // 处理图片上传按钮
        const processBtn = document.getElementById('processBtn');
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processErrors());
        }
        
        // 多维度筛选按钮绑定
        const filterButtons = document.querySelectorAll('.filter-button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const dim = e.target.dataset.dim;       // subject / difficulty / mastered
                const value = e.target.dataset.filter;  // 对应的值
                if (!dim || !value) return;
                this.setFilter(dim, value);
            });
        });
        
        // 排序下拉框
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
    
    async processErrors() {
        if (this.selectedFiles.length === 0) return;

        const processBtn = document.getElementById('processBtn');
        Utils.showLoadingState(processBtn, 'Processing images...');
        const errorsList = document.querySelector('.errors-list');

        for (const file of this.selectedFiles) {
            try {
                const uploadResult = await fileUploader.uploadFile(file, '/error/upload');

                if (!uploadResult?.success || !uploadResult.question_text) {
                    Utils.showNotification(`题目解析失败，跳过 ${file.name}`, 'warning');
                    continue;
                }

                const cardData = {
                    id: uploadResult.id,
                    subject: uploadResult.subject || '未知科目',
                    type: uploadResult.type || '',
                    tags: Array.isArray(uploadResult.tags) ? uploadResult.tags : [],
                    question_text: uploadResult.question_text,
                    user_answer: uploadResult.user_answer || '',
                    correct_answer: uploadResult.correct_answer || '',
                    analysis_steps: Array.isArray(uploadResult.analysis_steps) ? uploadResult.analysis_steps : [],
                    difficulty: uploadResult.difficulty || 'medium',
                    created_at: uploadResult.created_at || new Date().toISOString()
                };

                // 数据已在后端保存到数据库，不需要保存到 localStorage
                // 直接渲染新卡片
                this.addErrorCard({
                    id: cardData.id,
                    subject: cardData.subject,
                    difficulty: cardData.difficulty,
                    tags: cardData.tags,
                    text: `<p>${escapeHtml(cardData.question_text)}</p>`,
                    created_at: cardData.created_at,
                    reviewed: false
                });

                if (typeof MathJax !== 'undefined') {
                    MathJax.typesetPromise([errorsList]).catch(console.warn);
                }

                Utils.showNotification(`题目处理完成：${file.name}`, 'success');

            } catch (err) {
                console.error('处理图片出错:', file.name, err);
                Utils.showNotification(`处理图片出错：${file.name}`, 'error');
            }
        }

        Utils.showNotification('所有图片处理完成 ', 'success');
        this.resetUploadArea();
        try { Utils.hideLoadingState(processBtn); } catch(e) { /* ignore */ }

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
    
    addErrorCard(data) {
        // 如果是多题数组，逐条递归渲染
        if (Array.isArray(data)) {
            data.forEach(item => this.addErrorCard(item));
            return;
        }

        const errorsList = document.querySelector('.errors-list');
        if (!errorsList) return;

        console.log("Card ID used:", data.id);

        const card = document.createElement('div');
        card.className = 'error-card';
        card.dataset.errorId = data.id;

        let difficultyClass = '';
        const difficultyText = (data.difficulty || 'medium').toLowerCase();
        switch (difficultyText) {
            case 'easy': difficultyClass = 'difficulty-easy'; break;
            case 'medium': difficultyClass = 'difficulty-medium'; break;
            case 'difficult': 
            case 'hard': difficultyClass = 'difficulty-hard'; break;
        }

        // 格式化日期
        let dateStr = 'Today';
        if (data.created_at) {
            try {
                dateStr = new Date(data.created_at).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                });
            } catch(e) {
                dateStr = new Date().toLocaleDateString();
            }
        }

        // 渲染卡片 DOM
        card.innerHTML = `
            <div class="mastered-ribbon ${data.reviewed ? 'mastered' : 'not-mastered'}">
                ${data.reviewed ? 'M' : 'NM'}
            </div>
            <div class="error-header">
                <span class="error-subject">${data.subject || '未知科目'}</span>
                <span class="error-difficulty ${difficultyClass}">${data.difficulty || 'medium'}</span>
            </div>
            <div class="error-content">
                <p class="error-description">${data.text || ''}</p>
                <div class="error-analysis">
                    ${Array.isArray(data.tags) ? data.tags.map(tag => `<span class="analysis-tag">${tag}</span>`).join(' ') : ''}
                </div>
            </div>
            <div class="error-footer">
                <span class="error-date">${dateStr}</span>
                <div class="error-actions">
                    <button class="button-outline review-btn">Review</button>
                    <button class="button-outline practice-btn">Practice</button>
                    <button class="button-outline delete-btn">Delete</button>
                </div>
            </div>
        `;

        errorsList.prepend(card);

        // 绑定 Review 按钮
        const reviewBtn = card.querySelector('.review-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                window.location.href = `/error-review.html?id=${data.id}`;
            });
        }

        // 绑定 Practice 按钮
        const practiceBtn = card.querySelector('.practice-btn');
        if (practiceBtn) {
            practiceBtn.addEventListener('click', () => {
                window.location.href = `/error-practice.html?id=${data.id}`;
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
    
    setFilter(dim, value) {
        // 更新当前筛选条件
        this.currentFilter[dim] = value;

        // 更新按钮激活状态
        document.querySelectorAll(`.filter-button[data-dim="${dim}"]`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === value);
        });

        // 应用筛选
        this.applyFilter();
    }

    applyFilter() {
        const errorCards = document.querySelectorAll('.error-card');

        errorCards.forEach(card => {
            const subject = card.querySelector('.error-subject')?.textContent || '';
            const difficulty = (card.querySelector('.error-difficulty')?.textContent || '').toLowerCase();
            const mastered = card.querySelector('.mastered-ribbon')?.classList.contains('mastered');

            let show = true;

            // 科目筛选
            if (this.currentFilter.subject !== 'all' && subject !== this.currentFilter.subject) {
                show = false;
            }
            // 难度筛选
            if (this.currentFilter.difficulty !== 'all' && difficulty !== this.currentFilter.difficulty) {
                show = false;
            }
            // 掌握状态筛选
            if (this.currentFilter.mastered !== 'all') {
                const filterMastered = this.currentFilter.mastered === 'true';
                if (mastered !== filterMastered) show = false;
            }

            card.style.display = show ? '' : 'none';
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
                const difficultyOrder = { 'easy': 1, 'medium': 2, 'difficult': 3, 'hard': 3 };
                const diffA = difficultyOrder[a.querySelector('.error-difficulty').textContent.toLowerCase()] || 0;
                const diffB = difficultyOrder[b.querySelector('.error-difficulty').textContent.toLowerCase()] || 0;
                return diffB - diffA;
            }
            return 0;
        });
        
        errorCards.forEach(card => errorsList.appendChild(card));
    }

    bindActionButtons() {
        const errorsList = document.querySelector('.errors-list');
        if (!errorsList) return;

        // 事件委托，监听整个列表
        errorsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const card = btn.closest('.error-card');
            if (!card) return;

            const id = card.dataset.errorId;

            if (btn.classList.contains('review-btn')) {
                this.goToReview(id);
            }
            else if (btn.classList.contains('practice-btn')) {
                this.goToPractice(id);
            }
            else if (btn.classList.contains('delete-btn')) {
                this.deleteError(id, card);
            }
        });
    }

    goToReview(id) {
        if (!id) {
            console.error("Error: missing question ID for review");
            return;
        }
        window.location.href = `/error-review.html?id=${encodeURIComponent(id)}`;
    }

    goToPractice(id) {
        if (!id) {
            console.error("Error: missing question ID for practice");
            return;
        }
        window.location.href = `/error-practice.html?id=${id}`;
    }

    deleteError(id, card) {
        if (!id) {
            console.error("Error: missing id for delete");
            return;
        }

        if (!confirm("确定要删除这条错题吗？")) return;

        fetch(`/api/error/delete/${id}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                card.remove();
                Utils.showNotification("删除成功", 'success');
            } else {
                Utils.showNotification("删除失败：" + data.error, 'error');
            }
        })
        .catch(err => {
            console.error("delete failed", err);
            Utils.showNotification("删除失败", 'error');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const errorBookManager = new ErrorBookManager();
    errorBookManager.loadFromServer();  // 页面加载时读取数据库
    console.log('Error Book initialized');
});
