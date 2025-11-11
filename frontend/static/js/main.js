/**
 * AI Study Assistant - Main JavaScript
 */

const API_BASE = 'http://localhost:5000/api';

const Utils = {
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showNotification('Network error, please try again', 'error');
            return null;
        }
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `toast toast-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getIconByType(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },
    
    getIconByType(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    async navigateTo(page, animation = 'fade') {
        // Direct navigation without API call for faster page switching
        window.location.href = page;
    },
    
    async triggerAnimation(target, animationType) {
        const element = document.querySelector(target);
        if (!element) return;
        
        element.classList.add(`animate-${animationType}`);
        
        await this.apiCall('/ui/animate', 'POST', {
            type: animationType,
            target
        });
        
        setTimeout(() => {
            element.classList.remove(`animate-${animationType}`);
        }, 500);
    }
};

class NavigationManager {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        return path === '/' ? 'dashboard' : path.substring(1);
    }
    
    init() {
        this.highlightCurrentNav();
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Let browser handle navigation naturally for instant loading
                // Just update active state immediately
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Optional: Add a subtle loading indicator
                document.body.style.opacity = '0.95';
            });
        });
    }
    
    highlightCurrentNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href === `/${this.currentPage}` || (href === '/dashboard' && this.currentPage === '/')) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    navigate(href) {
        const page = href.substring(1) || 'dashboard';
        Utils.navigateTo(page, 'slide');
    }
}

class NotificationPanel {
    constructor() {
        this.panel = document.getElementById('notificationPanel');
        this.button = document.getElementById('notificationBtn');
        this.closeBtn = this.panel?.querySelector('.close-button');
        this.init();
    }
    
    init() {
        if (!this.panel || !this.button) return;
        
        this.button.addEventListener('click', () => {
            this.toggle();
        });
        
        this.closeBtn?.addEventListener('click', () => {
            this.close();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && !this.button.contains(e.target)) {
                this.close();
            }
        });
    }
    
    toggle() {
        this.panel.classList.toggle('hidden');
    }
    
    close() {
        this.panel.classList.add('hidden');
    }
    
    open() {
        this.panel.classList.remove('hidden');
    }
}

class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }
    
    init() {
        this.applyTheme(this.currentTheme);
        
        const themeBtn = document.querySelector('.theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        Utils.apiCall('/ui/theme', 'POST', { theme: this.currentTheme });
    }
    
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const icon = document.querySelector('.theme-toggle .fa-moon, .theme-toggle .fa-sun');
        if (icon) {
            icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
}

class FileUploader {
    constructor() {
        this.maxSize = 16 * 1024 * 1024;
    }
    
    async uploadFile(file, endpoint) {
        if (file.size > this.maxSize) {
            Utils.showNotification('File size exceeds limit (max 16MB)', 'error');
            return null;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                Utils.showNotification('Upload successful', 'success');
            } else {
                Utils.showNotification('Upload failed: ' + result.error, 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Upload failed:', error);
            Utils.showNotification('Upload failed, please try again', 'error');
            return null;
        }
    }
    
    selectFile(accept = '*', callback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && callback) {
                callback(file);
            }
        };
        
        input.click();
    }
}

let navManager, notificationPanel, themeManager, fileUploader;

document.addEventListener('DOMContentLoaded', () => {
    navManager = new NavigationManager();
    notificationPanel = new NotificationPanel();
    themeManager = new ThemeManager();
    fileUploader = new FileUploader();
    
    initSidebarToggle();
    
    document.body.classList.add('fade-in');
    
    console.log('AI Study Assistant frontend loaded');
    
    Utils.apiCall('/health').then(result => {
        if (result && result.status === 'healthy') {
            console.log('Backend connected');
        } else {
            console.warn('Backend connection failed');
        }
    });
});

function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (!sidebar || !toggleBtn) return;
    
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
}

window.AIStudyAssistant = {
    Utils,
    NavigationManager,
    NotificationPanel,
    ThemeManager,
    FileUploader
};
