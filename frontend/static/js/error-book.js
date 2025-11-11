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
    
    async processErrors() {
        if (this.selectedFiles.length === 0) return;
        
        Utils.showNotification('Processing images...', 'info');
        
        for (const file of this.selectedFiles) {
            const result = await fileUploader.uploadFile(file, '/error/upload');
            if (result && result.success) {
                console.log('Image processed:', result);
            }
        }
        
        Utils.showNotification('All images processed successfully', 'success');
        this.resetUploadArea();
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
}

document.addEventListener('DOMContentLoaded', () => {
    const errorBookManager = new ErrorBookManager();
    console.log('Error Book initialized');
});
