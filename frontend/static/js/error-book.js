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
        this.initMessageListener(); 

        // 检查 sessionStorage 标记（用于从 practice 返回时自动刷新）
        try {
            const flag = sessionStorage.getItem('refreshErrorList');
            if (flag) {
                sessionStorage.removeItem('refreshErrorList');
                console.log('sessionStorage 标记存在，重新加载错题列表');
                this.reloadErrorsFromServer();
            }
        } catch (e) {
            // sessionStorage 访问失败，忽略
        }

        // 检查 localStorage 标记（用于从 review 页面做对题目后自动刷新）
        try {
            const refreshFlag = localStorage.getItem('errorBookNeedsRefresh');
            if (refreshFlag === 'true') {
                localStorage.removeItem('errorBookNeedsRefresh');
                console.log('localStorage 刷新标记存在，重新加载错题列表');
                this.reloadErrorsFromServer();
            }
        } catch (e) {
            // localStorage 访问失败，忽略
        }

        // 当页面可见性发生变化（比如从另一个标签页或返回历史），再次检查标记
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                try {
                    const flag = sessionStorage.getItem('refreshErrorList');
                    if (flag) {
                        sessionStorage.removeItem('refreshErrorList');
                        console.log('页面可见，sessionStorage 标记触发刷新');
                        this.reloadErrorsFromServer();
                    }
                    // 同时检查 localStorage 标记
                    const refreshFlag = localStorage.getItem('errorBookNeedsRefresh');
                    if (refreshFlag === 'true') {
                        localStorage.removeItem('errorBookNeedsRefresh');
                        console.log('页面可见，localStorage 刷新标记触发刷新');
                        this.reloadErrorsFromServer();
                    }
                } catch (e) {}
            }
        });
    }
    
    initMessageListener() {
        // 监听来自 practice 页面的刷新消息
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'refreshErrorList') {
                console.log('收到刷新请求，重新加载错题列表');
                this.loadErrors();
            }
        });
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
            const res = await fetch(window.getApiUrl('/api/error/list'));
            console.log('Fetch error list status:', res.status);

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
                    text: `<p>${(err.question_text || '').replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</p>`,
                    images: Array.isArray(err.images) ? err.images : [],
                    created_at: err.created_at
                });
            });

            // 优化的 MathJax 渲染：批量渲染整个容器
            if (window.MathJax && window.MathJax.typesetPromise) {
                setTimeout(() => {
                    const container = document.querySelector('.errors-list');
                    if (container) {
                        MathJax.typesetPromise([container]).catch(console.warn);
                    }
                }, 100);
            }

            console.log(`Loaded ${data.total} errors from DB.`);

        } catch (e) {
            console.error("Failed to load error list:", e);
        }
    }

    // 重新从服务器加载错题（清空后重新加载，类似 map/note 的做法）
    async reloadErrorsFromServer() {
        const errorsList = document.querySelector('.errors-list');
        if (errorsList) {
            errorsList.innerHTML = ''; // Clear existing cards
        }
        await this.loadFromServer();
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

        let successCount = 0;
        let failCount = 0;

        for (const file of this.selectedFiles) {
            try {
                // 使用相对路径直接调用 fetch（像 map 一样）
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch(window.getApiUrl('/api/error/upload'), {
                    method: 'POST',
                    body: formData
                });
                
                const uploadResult = await response.json();

                if (!uploadResult?.success || !Array.isArray(uploadResult.questions) || uploadResult.questions.length === 0) {
                console.error(`Failed to parse questions from ${file.name}`, uploadResult);
                failCount++;
                continue;
                }

                this.addErrorCard(uploadResult.questions);

                successCount += uploadResult.questions.length;


            } catch (err) {
                console.error('Error processing image:', file.name, err);
                failCount++;
            }
        }

        // Reload all errors from server (like map/note do)
        await this.reloadErrorsFromServer();

        // Show unified notification (like delete operation)
        if (successCount > 0 && failCount === 0) {
            Utils.showNotification(`Successfully processed ${successCount} question(s)`, 'success');
        } else if (successCount > 0 && failCount > 0) {
            Utils.showNotification(`Processed ${successCount} question(s), ${failCount} failed`, 'warning');
        } else {
            Utils.showNotification('Failed to process questions', 'error');
        }

        this.resetUploadArea();
        try { Utils.hideLoadingState(processBtn); } catch(e) { /* ignore */ }
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
                <div class="error-images">
                    ${Array.isArray(data.images) ? data.images.map(img => `<img src="${img}" alt="题目图片" class="error-image">`).join('') : ''}
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
                // 用 errorId 排倒序
                return parseInt(b.dataset.errorId) - parseInt(a.dataset.errorId);
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

    async deleteError(id, card) {
        if (!id) {
            console.error("Error: missing id for delete");
            return;
        }

        const confirmed = await window.messageModal.confirm(
            'Are you sure you want to delete this error? This action cannot be undone.',
            'Confirm Delete',
            { danger: true, confirmText: 'Delete', cancelText: 'Cancel' }
        );

        if (!confirmed) return;

        try {
            const response = await fetch(window.getApiUrl(`/api/error/delete/${id}`), {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    card.remove();
                    Utils.showNotification('Error deleted successfully', 'success');
                    // Notify practice page to reset button for this error
                    sessionStorage.setItem('resetPracticeButton', id);
                } else {
                    Utils.showNotification('Failed to delete error: ' + data.error, 'error');
                }
            } else {
                Utils.showNotification('Failed to delete error', 'error');
            }
        } catch (err) {
            console.error("delete failed", err);
            Utils.showNotification('Error deleting error', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const errorBookManager = new ErrorBookManager();
    errorBookManager.loadFromServer();  // 页面加载时读取数据库
    console.log('Error Book initialized');
});