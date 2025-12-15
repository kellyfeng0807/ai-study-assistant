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
            // Always use moon icon regardless of theme
            icon.className = 'fas fa-moon';
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
    
    // Load user profile for sidebar
    loadUserProfile();
    
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

/**
 * Adjust sidebar navigation based on account type
 * Only needed for parent accounts to dynamically generate children links
 */
async function adjustSidebarForAccountType(user) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    const accountType = user.account_type || 'student';
    
    // 只有家长账号需要动态生成子女链接
    if (accountType === 'parent') {
        // 家长账号：只显示 Parent View 和 Settings
        // 获取家长的所有子女账号
        try {
            const response = await fetch(window.getApiUrl('/auth/children'));
            const data = await response.json();
            
            if (data.success && data.children && data.children.length > 0) {
                // 筛选只显示学生账号，不显示父账号
                const students = data.children.filter(child => child.account_type === 'student');
                
                if (students.length > 0) {
                    // 清空现有的导航菜单
                    navMenu.innerHTML = '';
                    
                    // 为每个学生创建一个Parent View链接
                    students.forEach(child => {
                        const link = document.createElement('a');
                        link.href = `/parent-view?user_id=${child.user_id}`;
                        link.className = 'nav-item';
                        link.innerHTML = `
                            <i class="fas fa-user-graduate"></i>
                            <span>${child.username}'s Report</span>
                        `;
                        navMenu.appendChild(link);
                    });
                    
                    // 如果当前在parent-view页面，高亮对应的链接
                    const currentPath = window.location.pathname;
                    const currentUserId = new URLSearchParams(window.location.search).get('user_id');
                    if (currentPath.includes('/parent-view') && currentUserId) {
                        const activeLink = navMenu.querySelector(`a[href="/parent-view?user_id=${currentUserId}"]`);
                        if (activeLink) {
                            activeLink.classList.add('active');
                        }
                    } else if (students.length > 0) {
                        // 默认高亮第一个学生
                        navMenu.querySelector('.nav-item')?.classList.add('active');
                    }
                } else {
                    // 没有学生账号的提示
                    navMenu.innerHTML = `
                        <div class="nav-item" style="cursor: default; opacity: 0.6;">
                            <i class="fas fa-info-circle"></i>
                            <span>No students linked</span>
                        </div>
                    `;
                }
            } else {
                // 没有子女账号，显示提示
                navMenu.innerHTML = `
                    <div class="nav-item" style="cursor: default; opacity: 0.6;">
                        <i class="fas fa-info-circle"></i>
                        <span>No students linked</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load children accounts:', error);
        }
    }
}

/**
 * Load user profile from auth session and update sidebar
 * Returns true if logged in, false otherwise
 */
async function loadUserProfile() {
    // Skip auth check on login and register pages
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');
    
    console.log('loadUserProfile called, path:', currentPath, 'isAuthPage:', isAuthPage);
    
    if (isAuthPage) {
        console.log('Skipping auth check on auth page');
        return true; // Don't check auth on auth pages
    }
    
    try {
        // Check if user is logged in via session
        const sessionResponse = await fetch(window.getApiUrl('/auth/session'));
        const sessionData = await sessionResponse.json();
        
        console.log('Session data:', sessionData);
        
        if (sessionData.logged_in && sessionData.user) {
            const user = sessionData.user;
            
            // Update user name
            document.querySelectorAll('.user-name').forEach(el => {
                el.textContent = user.username || 'Student';
            });
            
            // Update user email - for student accounts, show parent's email
            document.querySelectorAll('.user-email').forEach(async (el) => {
                if (user.account_type === 'student' && (!user.email || user.email === '')) {
                    // Try to get parent's email
                    try {
                        const settingsResponse = await fetch(window.getApiUrl('/settings/'));
                        const settingsData = await settingsResponse.json();
                        
                        if (settingsData.success && settingsData.settings.parent_id) {
                            const parentResponse = await fetch(window.getApiUrl('/auth/parent-email'), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ parent_id: settingsData.settings.parent_id })
                            });
                            const parentData = await parentResponse.json();
                            
                            if (parentData.success && parentData.email) {
                                el.textContent = parentData.email;
                            } else {
                                el.textContent = 'Student Account';
                            }
                        } else {
                            el.textContent = 'Student Account';
                        }
                    } catch (error) {
                        console.error('Failed to get parent email:', error);
                        el.textContent = 'Student Account';
                    }
                } else {
                    el.textContent = user.email || '';
                }
            });
            
            // Update avatar
            document.querySelectorAll('.avatar').forEach(el => {
                const initial = (user.username || 'S')[0].toUpperCase();
                el.textContent = initial;
            });
            
            // Handle sidebar navigation based on account type
            await adjustSidebarForAccountType(user);
            
            return true;
        } else {
            // Not logged in
            console.log('Not logged in, redirecting to login');
            // Add a small delay to avoid rapid redirects
            setTimeout(() => {
                window.location.href = '/login';
            }, 100);
            return false;
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
        // On error, redirect to login after delay
        setTimeout(() => {
            window.location.href = '/login';
        }, 100);
        return false;
    }
}

// Make loadUserProfile globally accessible for Settings page
window.loadUserProfile = loadUserProfile;

/**
 * Initialize user menu dropdown for logout/switch account
 */
function initUserMenu() {
    const userProfile = document.querySelector('.user-profile');
    if (!userProfile) return;
    
    // Create dropdown menu if it doesn't exist
    let dropdown = userProfile.querySelector('.user-menu-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'user-menu-dropdown';
        dropdown.innerHTML = `
            <div class="user-menu-actions">
                <button class="user-menu-item" id="switchAccountBtn">
                    <i class="fas fa-exchange-alt"></i>
                    <span>Switch Account</span>
                </button>
                <button class="user-menu-item" id="logoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </button>
            </div>
        `;
        userProfile.appendChild(dropdown);
    }
    
    // Toggle dropdown on click
    userProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });
    
    // Handle logout
    const logoutBtn = dropdown.querySelector('#logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await fetch(window.getApiUrl('/auth/logout'), { method: 'POST' });
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }
    
    // Handle switch account
    const switchBtn = dropdown.querySelector('#switchAccountBtn');
    if (switchBtn) {
        switchBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            await showAccountSwitchModal();
        });
    }
}

/**
 * Get avatar color based on username
 */
function getAvatarColor(username) {
    const colors = [
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#f59e0b', // amber
        '#10b981', // green
        '#06b6d4', // cyan
        '#f97316', // orange
        '#6366f1'  // indigo
    ];
    
    const charCode = username.charCodeAt(0);
    return colors[charCode % colors.length];
}

/**
 * Show account switch modal with accounts under same email
 */
async function showAccountSwitchModal() {
    try {
        // Get current user info
        const sessionResponse = await fetch(window.getApiUrl('/auth/session'));
        const sessionData = await sessionResponse.json();
        
        if (!sessionData.logged_in) {
            window.location.href = '/login';
            return;
        }
        
        const currentUser = sessionData.user;
        
        // For student accounts, we need to find parent's email
        let emailToUse = currentUser.email;
        
        // If current user has no email (student account), need to get parent's email
        if (!emailToUse || emailToUse === '') {
            // Get user settings which includes parent_id
            const settingsResponse = await fetch(window.getApiUrl('/settings/'));
            const settingsData = await settingsResponse.json();
            
            if (settingsData.success && settingsData.settings.parent_id) {
                // Get parent's information to find email
                const parentResponse = await fetch(window.getApiUrl('/auth/parent-email'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parent_id: settingsData.settings.parent_id })
                });
                const parentData = await parentResponse.json();
                
                if (parentData.success && parentData.email) {
                    emailToUse = parentData.email;
                }
            }
        }
        
        if (!emailToUse) {
            alert('Cannot find associated email for account switching.');
            return;
        }
        
        // Get accounts under same email
        const accountsResponse = await fetch(window.getApiUrl('/auth/accounts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailToUse })
        });
        const accountsData = await accountsResponse.json();
        
        if (!accountsData.success || !accountsData.accounts || accountsData.accounts.length === 0) {
            alert('No other accounts found under this email.');
            return;
        }
        
        // Filter out current account if only one account total
        if (accountsData.accounts.length === 1) {
            alert('No other accounts available to switch to.');
            return;
        }
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'account-switch-modal';
        modal.innerHTML = `
            <div class="account-switch-content">
                <div class="account-switch-header">
                    <h3>Switch Account</h3>
                    <p>Select an account to switch to</p>
                </div>
                <div class="account-switch-list" id="accountSwitchList">
                    ${accountsData.accounts.map(account => {
                        const avatarColor = getAvatarColor(account.username);
                        return `
                        <div class="account-switch-item ${account.user_id === currentUser.user_id ? 'selected' : ''}" 
                             data-user-id="${account.user_id}"
                             data-username="${account.username}"
                             data-account-type="${account.account_type}">
                            <div class="account-avatar avatar" style="background: ${avatarColor};">
                                ${account.username[0].toUpperCase()}
                            </div>
                            <div class="account-details">
                                <p class="account-name">${account.username}</p>
                                <p class="account-type">${account.account_type === 'parent' ? 'Parent Account' : 'Student Account'}</p>
                            </div>
                            ${account.user_id === currentUser.user_id ? '<i class="fas fa-check" style="margin-left: auto; color: hsl(var(--primary));"></i>' : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="form-group">
                    <label for="switchPassword">
                        <i class="fas fa-lock"></i>
                        Enter Password
                    </label>
                    <div class="password-input-wrapper">
                        <input type="password" id="switchPassword" class="form-input" placeholder="Password" required>
                        <button type="button" class="toggle-password" data-target="switchPassword">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="account-switch-footer">
                    <button class="btn button-outline" id="cancelSwitchBtn">Cancel</button>
                    <button class="btn button-primary" id="confirmSwitchBtn">Switch Account</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Show modal with animation
        setTimeout(() => modal.classList.add('show'), 10);
        
        let selectedUserId = null; // Initialize as null, will be set when user clicks an account
        
        // Handle account selection
        modal.querySelectorAll('.account-switch-item').forEach(item => {
            item.addEventListener('click', function() {
                modal.querySelectorAll('.account-switch-item').forEach(i => i.classList.remove('selected'));
                this.classList.add('selected');
                selectedUserId = this.dataset.userId;
            });
        });
        
        // Handle password toggle
        const toggleBtn = modal.querySelector('.toggle-password');
        const passwordInput = modal.querySelector('#switchPassword');
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            toggleBtn.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
        
        // Handle cancel
        modal.querySelector('#cancelSwitchBtn').addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 200);
        });
        
        // Handle confirm switch
        modal.querySelector('#confirmSwitchBtn').addEventListener('click', async () => {
            if (!selectedUserId) {
                alert('Please select an account');
                return;
            }
            
            const password = passwordInput.value;
            if (!password) {
                alert('Please enter password');
                return;
            }
            
            try {
                const response = await fetch(window.getApiUrl('/auth/switch'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: selectedUserId,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 200);
                    // Redirect based on account type
                    if (data.user.account_type === 'parent') {
                        window.location.href = '/parent-view';
                    } else {
                        window.location.href = '/learning-dashboard';
                    }
                } else {
                    alert(data.error || 'Failed to switch account');
                }
            } catch (error) {
                console.error('Switch account failed:', error);
                alert('Failed to switch account');
            }
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 200);
            }
        });
        
    } catch (error) {
        console.error('Failed to show account switch modal:', error);
        alert('Failed to load accounts');
    }
}

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only load user profile and menu on non-auth pages
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');
    
    console.log('DOMContentLoaded - path:', currentPath, 'isAuthPage:', isAuthPage);
    
    if (!isAuthPage) {
        console.log('Initializing user profile and menu');
        loadUserProfile();
        initUserMenu();
    } else {
        console.log('Skipping initialization on auth page');
    }
});

window.AIStudyAssistant = {
    Utils,
    NavigationManager,
    NotificationPanel,
    ThemeManager,
    FileUploader
};
