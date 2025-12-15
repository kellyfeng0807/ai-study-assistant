/**
 * Login Page JavaScript
 */

class LoginManager {
    constructor() {
        this.currentStep = 1;
        this.email = '';
        this.accounts = [];
        this.selectedAccount = null;
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.checkExistingSession();
    }
    
    async checkExistingSession() {
        try {
            const response = await fetch(window.getApiUrl('/auth/session'));
            const data = await response.json();
            
            if (data.success && data.logged_in) {
                // Already logged in, redirect based on account type
                if (data.account_type === 'parent') {
                    window.location.href = '/parent-view';
                } else {
                    window.location.href = '/learning-dashboard';
                }
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }
    
    bindEventListeners() {
        // Step 1: Email form
        const emailForm = document.getElementById('emailForm');
        emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
        
        // Step 2: Back to email
        const backToEmail = document.getElementById('backToEmail');
        backToEmail.addEventListener('click', () => this.goToStep(1));
        
        // Step 3: Back to accounts
        const backToAccounts = document.getElementById('backToAccounts');
        backToAccounts.addEventListener('click', () => this.goToStep(2));
        
        // Step 3: Password form
        const passwordForm = document.getElementById('passwordForm');
        passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        
        // Toggle password visibility
        const togglePassword = document.getElementById('togglePassword');
        togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
    }
    
    async handleEmailSubmit(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim().toLowerCase();
        
        if (!email || !email.includes('@')) {
            Utils.showNotification('Please enter a valid email address', 'warning');
            return;
        }
        
        const emailBtn = document.getElementById('emailBtn');
        Utils.showLoadingState(emailBtn, 'Checking...');
        
        try {
            const response = await fetch(window.getApiUrl('/auth/login/check-email'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.email = email;
                this.accounts = [data.parent, ...data.students];
                this.renderAccountList();
                this.goToStep(2);
            } else {
                Utils.showNotification(data.error || 'Email not found', 'error');
            }
        } catch (error) {
            console.error('Email check failed:', error);
            Utils.showNotification('An error occurred, please try again', 'error');
        } finally {
            Utils.hideLoadingState(emailBtn);
        }
    }
    
    renderAccountList() {
        const accountList = document.getElementById('accountList');
        const displayEmail = document.getElementById('displayEmail');
        
        displayEmail.textContent = this.email;
        accountList.innerHTML = '';
        
        this.accounts.forEach(account => {
            const accountItem = document.createElement('div');
            accountItem.className = 'account-item';
            accountItem.onclick = () => this.selectAccount(account);
            
            const avatarColor = this.getAvatarColor(account.username);
            const avatarText = account.username.charAt(0).toUpperCase();
            
            accountItem.innerHTML = `
                <div class="account-avatar" style="background: ${avatarColor}">
                    ${account.avatar_url ? 
                        `<img src="${account.avatar_url}" alt="${account.username}">` :
                        `<span>${avatarText}</span>`
                    }
                </div>
                <div class="account-details">
                    <p class="account-name">${account.username}</p>
                    <p class="account-type">${account.account_type === 'parent' ? 'Parent Account' : 'Student Account'}</p>
                </div>
                <i class="fas fa-arrow-right account-arrow"></i>
            `;
            
            accountList.appendChild(accountItem);
        });
    }
    
    selectAccount(account) {
        this.selectedAccount = account;
        
        // Update selected account display
        const selectedName = document.getElementById('selectedName');
        const selectedType = document.getElementById('selectedType');
        const selectedAvatar = document.getElementById('selectedAvatar');
        const selectedAvatarText = document.getElementById('selectedAvatarText');
        
        selectedName.textContent = account.username;
        selectedType.textContent = account.account_type === 'parent' ? 'Parent Account' : 'Student Account';
        
        const avatarColor = this.getAvatarColor(account.username);
        selectedAvatar.style.background = avatarColor;
        
        if (account.avatar_url) {
            selectedAvatar.innerHTML = `<img src="${account.avatar_url}" alt="${account.username}">`;
        } else {
            selectedAvatarText.textContent = account.username.charAt(0).toUpperCase();
        }
        
        this.goToStep(3);
        
        // Focus password input
        setTimeout(() => {
            document.getElementById('password').focus();
        }, 300);
    }
    
    async handlePasswordSubmit(e) {
        e.preventDefault();
        
        const passwordInput = document.getElementById('password');
        const password = passwordInput.value;
        
        if (!password) {
            Utils.showNotification('Please enter your password', 'warning');
            return;
        }
        
        const loginBtn = document.getElementById('loginBtn');
        Utils.showLoadingState(loginBtn, 'Signing in...');
        
        try {
            const response = await fetch(window.getApiUrl('/auth/login/verify'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.selectedAccount.user_id,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                Utils.showNotification('Login successful!', 'success');
                
                // Store user info in localStorage for quick access
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // Redirect based on account type
                setTimeout(async () => {
                    if (data.user.account_type === 'parent') {
                        // For parent accounts, redirect to first student's report
                        try {
                            const childrenResponse = await fetch(window.getApiUrl('/auth/children'));
                            const childrenData = await childrenResponse.json();
                            
                            if (childrenData.success && childrenData.children && childrenData.children.length > 0) {
                                // Find first student account
                                const firstStudent = childrenData.children.find(child => child.account_type === 'student');
                                if (firstStudent) {
                                    window.location.href = `/parent-view?user_id=${firstStudent.user_id}`;
                                } else {
                                    // No students, go to parent-view without user_id
                                    window.location.href = '/parent-view';
                                }
                            } else {
                                window.location.href = '/parent-view';
                            }
                        } catch (error) {
                            console.error('Failed to load children:', error);
                            window.location.href = '/parent-view';
                        }
                    } else {
                        window.location.href = '/learning-dashboard';
                    }
                }, 500);
            } else {
                Utils.showNotification(data.error || 'Invalid password', 'error');
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Login failed:', error);
            Utils.showNotification('An error occurred, please try again', 'error');
        } finally {
            Utils.hideLoadingState(loginBtn);
        }
    }
    
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('togglePassword');
        const icon = toggleBtn.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
    
    goToStep(step) {
        // Hide all steps
        document.querySelectorAll('.auth-step').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show target step
        document.getElementById(`step${step}`).classList.add('active');
        this.currentStep = step;
    }
    
    getAvatarColor(username) {
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});
