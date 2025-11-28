/**
 * Error Book Page JavaScript
 */

class ErrorBookManager {
    constructor() {
        this.selectedFiles = [];
        //this.currentFilter = 'all';
        this.currentFilter = {
            subject: 'all',      // 'all' 或具体科目
            difficulty: 'all',   // 'all' 或 'Easy' / 'Medium' / 'Hard'
            mastered: 'all'      // 'all' / true / false
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

    //新增函数
    // ---- 新增：从后端数据库加载错题 ----

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
                difficulty: err.difficulty,
                reviewed: err.reviewed,
                tags: Array.isArray(err.tags) ? err.tags : [],   // ✅ 确保 tags 是数组
                text: `<p>${err.question || ''}</p>`,
                created_at:err.created_at
                //tags: tags
            });
        });

        setTimeout(() => this.updateWaterfall(), 50);
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
/*
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
    */
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
                    id: uploadResult.id,  // ⚠️ 一定要使用数据库 ID,
                    subject: uploadResult.subject || 'unknown subject',
                    type: uploadResult.type || '',
                    tags: Array.isArray(uploadResult.tags) ? uploadResult.tags : [],
                    question_text: uploadResult.question_text,
                    user_answer: uploadResult.user_answer || '',
                    correct_answer: uploadResult.correct_answer || '',
                    analysis_steps: Array.isArray(uploadResult.analysis_steps) ? uploadResult.analysis_steps : [],
                    difficulty: uploadResult.difficulty,

                    created_at:uploadResult.created_at//新加的
               };

                try {
                    const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
                    raw[cardData.id] = cardData;
                    localStorage.setItem('errorbook_items', JSON.stringify(raw));
                } catch (e) {
                    console.warn('localStorage 写入失败', e);
                }

                this.addErrorCard({
                    id: cardData.id,
                    subject: cardData.subject,
                    difficulty: cardData.difficulty,
                    tags: cardData.tags,        // ✅ 添加 tags
                    text: `<p>${escapeHtml(cardData.question_text)}</p>`,
                    created_at:cardData.created_at
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

    // ✅ 如果是多题数组，逐条递归渲染
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
    switch ((data.difficulty || '').toLowerCase()) {
        case 'easy': difficultyClass = 'difficulty-easy'; break;
        case 'medium': difficultyClass = 'difficulty-medium'; break;
        case 'difficult': difficultyClass = 'difficulty-hard'; break;
    }

    // ✅ 保持你原来的 DOM 不变
    card.innerHTML = `
    <div class="mastered-ribbon ${data.reviewed ? 'mastered' : 'not-mastered'}">
        ${data.reviewed ? 'M' : 'NM'}
    </div>
        <div class="error-header">
            <span class="error-subject">${data.subject || '未知科目'}</span>
            <span class="error-difficulty ${difficultyClass}">${data.difficulty || ''}</span>
        </div>
        <div class="error-content">
            <p class="error-description">${data.text || ''}</p>
            <!-- ✅ 显示 tags 知识点 -->
        <div class="error-analysis">
  ${Array.isArray(data.tags) ? data.tags.map(tag => `<span class="analysis-tag">${tag}</span>`).join(' ') : ''}
</div>
        </div>
        <div class="error-footer">
            <span class="error-date">
  ${new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
</span>



            <div class="error-actions">
                <button class="button-outline review-btn">Review</button>
                <button class="button-outline practice-btn">Practice</button>



                <button class="button-outline delete-btn">Delete</button>
            </div>
        </div>
    `;

    errorsList.prepend(card);

    const reviewBtn = card.querySelector('.review-btn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            window.location.href = `/error-review.html?id=${data.id}`;
        });
    }

    const practiceBtn = card.querySelector('.practice-btn');
    if (practiceBtn) {
        practiceBtn.addEventListener('click', () => {
            const topic = data.subject || (data.tags && data.tags[0]) || '';
            window.location.href = `/error/practice.html?id=${data.id}`;
        });
    }
}


  /*
    addErrorCard(data) {
        const errorsList = document.querySelector('.errors-list');
        if (!errorsList) return;
        //console.log("Card ID used:", cardData.id);
        console.log("Card ID used:", data.id);

        const card = document.createElement('div');
        card.className = 'error-card';

        card.dataset.errorId = data.id;


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

            <!-- ✅ 显示掌握状态 -->
            <span class="mastered-label">
                ${data.reviewed ? '✅ 已掌握' : '❌ 未掌握'}
            </span>

            <!-- ✅ 新增删除按钮 -->
            <button class="button-outline delete-btn">Delete</button>
        </div>
    </div>
`;

        errorsList.prepend(card);

        const reviewBtn = card.querySelector('.review-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                //window.location.href = `/error-review.html?id=${encodeURIComponent(data.id)}`;


                window.location.href = `/error-review.html?id=${data.id}`;
            });
        }



        const practiceBtn = card.querySelector('.practice-btn');
        if (practiceBtn) {
            practiceBtn.addEventListener('click', () => {
                const topic = data.subject || (data.tags && data.tags[0]) || '';
                window.location.href =` /error/practice.html?id=${id}`;
            });
        }
    }
*/


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
        const subject = card.querySelector('.error-subject').textContent;
        const difficulty = card.querySelector('.error-difficulty').textContent;
        const mastered = card.querySelector('.mastered-ribbon')?.classList.contains('mastered');

        let show = true;

        if (this.currentFilter.subject !== 'all' && subject !== this.currentFilter.subject) show = false;
        if (this.currentFilter.difficulty !== 'all' && difficulty !== this.currentFilter.difficulty) show = false;
        if (this.currentFilter.mastered !== 'all') {
            const filterMastered = this.currentFilter.mastered === 'true';
            if (mastered !== filterMastered) show = false;
        }

        card.style.display = show ? '' : 'none';
    });
}

/*
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
     */
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

    bindActionButtons() {
        const errorsList = document.querySelector('.errors-list');

        // 事件委托，监听整个列表
        errorsList.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const card = btn.closest('.error-card');
            if (!card) return;

            const id = card.dataset.errorId;  // 读取卡片 ID

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
        window.location.href = `/api/error/practice?id=${id}`;
    }

    deleteError(id, card) {
    if (!id) {
        console.error("Error: missing id for delete");
        return;
    }

    if (!confirm("确定要删除这条错题吗？")) return;

    fetch(`/api/error/delete/${id}`, {
        method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            card.remove();   // ✅ 立即从页面移除
            alert("删除成功");
        } else {
            alert("删除失败：" + data.error);
        }
    })
    .catch(err => console.error("delete failed", err));
}


}

document.addEventListener('DOMContentLoaded', () => {
    const errorBookManager = new ErrorBookManager();
    errorBookManager.loadFromServer();   // 关键：页面加载时读取数据库
});
