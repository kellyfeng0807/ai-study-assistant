/**
 * AI Study Assistant - Main JavaScript
 */

// 自动检测环境并设置 API 基础地址
const currentHost = window.location.hostname;
const isRenderProduction = currentHost.includes('onrender.com');
const isLocalDevelopment = currentHost === 'localhost' || currentHost === '127.0.0.1';

// 根据环境设置 API 基础地址
let API_BASE;
if (isRenderProduction || (!isLocalDevelopment && currentHost !== '')) {
    // Render 或其他远程环境：使用当前域名
    API_BASE = window.location.origin + '/api';
} else {
    // 本地开发环境
    API_BASE = 'http://localhost:5000/api';
}

console.log('🌐 Main.js Environment:', { currentHost, isRenderProduction, isLocalDevelopment, API_BASE });

// 全局函数：获取完整 API URL（供其他脚本使用）
window.getApiUrl = function(endpoint) {
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }
    // 如果endpoint已经包含/api，直接返回base+endpoint
    if (endpoint.startsWith('/api')) {
        return (isRenderProduction || (!isLocalDevelopment && currentHost !== '')) 
            ? window.location.origin + endpoint 
            : 'http://localhost:5000' + endpoint;
    }
    // 否则使用API_BASE
    return API_BASE + endpoint;
};

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
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const notification = document.createElement('div');
        notification.className = `toast ${type}`;  // Changed from toast-${type} to match CSS
        notification.innerHTML = `
            <i class="fas fa-${this.getIconByType(type)} toast-icon"></i>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(notification);
        
        // Trigger show animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('hiding');
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
    
    /**
     * Shared loading helpers for buttons
     */
    showLoadingState(button, message = 'Loading...') {
        if (!button) return;
        button.disabled = true;
        if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${message}</span>`;
        button.classList.add('loading');
    },

    hideLoadingState(button) {
        if (!button) return;
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
        button.classList.remove('loading');
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
        // 通知管理已移至 notifications.js
        // 保留此类以兼容旧代码
        console.log('NotificationPanel: Using new notifications.js system');
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
    
    // Initialize global AI Chat float for all pages
    try {
        // Ensure CSS for ai-chat is loaded (if not present)
        const aiChatCssHref = 'static/css/ai-chat.css';
        if (![...document.styleSheets].some(s => s.href && s.href.endsWith('ai-chat.css'))) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = aiChatCssHref;
            document.head.appendChild(link);
        }

        if (window.initGlobalAIChat) {
            window.initGlobalAIChat();
        }
    } catch (e) {
        console.warn('Failed to initialize global AI Chat:', e);
    }
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
