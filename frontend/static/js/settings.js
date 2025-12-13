/**
 * Settings 页面JavaScript - 简化版
 * 仅包含账户设置功能，与后端API集成
 */

class SettingsManager {
    constructor() {
        this.settings = null;
        this.isEditMode = false;
        this.init();
    }
    
    async init() {
        this.bindEventListeners();
        await this.loadSettings();
    }
    
    /**
     * 从后端加载设置
     */
    async loadSettings() {
        try {
            const response = await fetch(window.getApiUrl('/settings/'));
            const data = await response.json();
            
            if (data.success) {
                this.settings = data.settings;
                this.populateForm();
            } else {
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('Failed to load settings', 'error');
                } else if (window.messageModal) {
                    window.messageModal.alert('Failed to load settings', 'Error', 'error');
                }
            }
        } catch (error) {
            console.error('加载设置出错:', error);
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification('Error loading settings', 'error');
            } else if (window.messageModal) {
                window.messageModal.alert('Error loading settings', 'Error', 'error');
            }
        }
    }
    
    /**
     * 填充表单
     */
    populateForm() {
        if (!this.settings) return;
        
        // 填充显示文本（只读字段）
        const userIdDisplay = document.getElementById('userIdDisplay');
        if (userIdDisplay) {
            userIdDisplay.textContent = `#${this.settings.user_id || '00000'}`;
        }
        
        const usernameDisplay = document.getElementById('usernameDisplay');
        if (usernameDisplay) {
            usernameDisplay.textContent = this.settings.username || 'Student';
        }
        
        const emailDisplay = document.getElementById('emailDisplay');
        if (emailDisplay) {
            // 如果是学生账号且没有email，尝试显示家长email
            if (this.settings.account_type === 'student' && (!this.settings.email || this.settings.email === '')) {
                this.loadParentEmail(emailDisplay);
            } else {
                emailDisplay.textContent = this.settings.email || '';
            }
        }
        
        const accountTypeDisplay = document.getElementById('accountTypeDisplay');
        if (accountTypeDisplay) {
            const type = this.settings.account_type || 'student';
            accountTypeDisplay.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        }
        
        const passwordDisplay = document.getElementById('passwordDisplay');
        if (passwordDisplay) {
            passwordDisplay.textContent = '••••••••';
        }
        
        const gradeLevelDisplay = document.getElementById('gradeLevelDisplay');
        if (gradeLevelDisplay) {
            gradeLevelDisplay.textContent = `Grade ${this.settings.grade_level || '9'}`;
        }
        
        const dailyGoalDisplay = document.getElementById('dailyGoalDisplay');
        if (dailyGoalDisplay) {
            dailyGoalDisplay.textContent = `${this.settings.daily_goal || 60} minutes`;
        }
        
        // 填充输入框（编辑模式使用）
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.value = this.settings.username || '';
        }
        
        const gradeSelect = document.getElementById('gradeLevel');
        if (gradeSelect) {
            gradeSelect.value = this.settings.grade_level || '9';
        }
        
        const goalInput = document.getElementById('dailyGoal');
        if (goalInput) {
            goalInput.value = this.settings.daily_goal || 60;
        }
        
        // 清空密码输入框
        const newPasswordInput = document.getElementById('newPassword');
        if (newPasswordInput) {
            newPasswordInput.value = '';
        }
        
        const confirmPasswordInput = document.getElementById('confirmPassword');
        if (confirmPasswordInput) {
            confirmPasswordInput.value = '';
        }
    }
    
    /**
     * 加载家长邮箱（用于学生账号）
     */
    async loadParentEmail(emailElement) {
        try {
            if (!this.settings.parent_id) {
                emailElement.textContent = 'No email set';
                return;
            }
            
            const response = await fetch(window.getApiUrl('/auth/parent-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parent_id: this.settings.parent_id })
            });
            const data = await response.json();
            
            if (data.success && data.email) {
                emailElement.textContent = `${data.email} (Parent)`;
            } else {
                emailElement.textContent = 'No email set';
            }
        } catch (error) {
            console.error('Error loading parent email:', error);
            emailElement.textContent = 'Error loading email';
        }
    }
    
    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 编辑按钮
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.enterEditMode());
        }
        
        // 保存设置按钮
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }
        
        // 取消编辑按钮
        const cancelBtn = document.getElementById('cancelEdit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.exitEditMode());
        }
    }
    
    /**
     * 进入编辑模式
     */
    enterEditMode() {
        this.isEditMode = true;
        
        // 隐藏显示文本，显示输入框（只针对可编辑字段）
        document.getElementById('usernameDisplay').style.display = 'none';
        document.getElementById('username').style.display = 'block';
        
        document.getElementById('passwordDisplay').style.display = 'none';
        document.getElementById('newPassword').style.display = 'block';
        document.getElementById('confirmPasswordItem').style.display = 'flex';
        
        document.getElementById('gradeLevelDisplay').style.display = 'none';
        document.getElementById('gradeLevel').style.display = 'block';
        
        document.getElementById('dailyGoalDisplay').style.display = 'none';
        document.getElementById('dailyGoal').style.display = 'block';
        
        // 隐藏编辑按钮，显示保存/取消按钮
        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('editActions').style.display = 'flex';
    }
    
    /**
     * 退出编辑模式
     */
    exitEditMode() {
        this.isEditMode = false;
        
        // 恢复原始值
        this.populateForm();
        
        // 显示文本，隐藏输入框
        document.getElementById('usernameDisplay').style.display = 'block';
        document.getElementById('username').style.display = 'none';
        
        document.getElementById('passwordDisplay').style.display = 'block';
        document.getElementById('newPassword').style.display = 'none';
        document.getElementById('confirmPasswordItem').style.display = 'none';
        
        document.getElementById('gradeLevelDisplay').style.display = 'block';
        document.getElementById('gradeLevel').style.display = 'none';
        
        document.getElementById('dailyGoalDisplay').style.display = 'block';
        document.getElementById('dailyGoal').style.display = 'none';
        
        // 显示编辑按钮，隐藏保存/取消按钮
        document.getElementById('editBtn').style.display = 'flex';
        document.getElementById('editActions').style.display = 'none';
    }
    
    /**
     * 保存设置
     */
    async handleSave() {
        const saveBtn = document.getElementById('saveSettings');
        
        try {
            // 收集表单数据
            const username = document.getElementById('username')?.value || '';
            const gradeLevel = document.getElementById('gradeLevel')?.value || '9';
            const dailyGoal = parseInt(document.getElementById('dailyGoal')?.value) || 60;
            const newPassword = document.getElementById('newPassword')?.value || '';
            const confirmPassword = document.getElementById('confirmPassword')?.value || '';
            
            // 验证数据
            if (!username.trim()) {
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('Please enter a username', 'warning');
                } else if (window.messageModal) {
                    window.messageModal.alert('Please enter a username', 'Validation Error', 'warning');
                }
                return;
            }
            
            if (dailyGoal < 30 || dailyGoal > 480) {
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('Daily goal should be between 30-480 minutes', 'warning');
                } else if (window.messageModal) {
                    window.messageModal.alert('Daily goal should be between 30-480 minutes', 'Validation Error', 'warning');
                }
                return;
            }
            
            // 验证密码
            if (newPassword) {
                if (newPassword.length < 6) {
                    if (typeof Utils !== 'undefined' && Utils.showNotification) {
                        Utils.showNotification('Password must be at least 6 characters', 'warning');
                    } else if (window.messageModal) {
                        window.messageModal.alert('Password must be at least 6 characters', 'Validation Error', 'warning');
                    }
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    if (typeof Utils !== 'undefined' && Utils.showNotification) {
                        Utils.showNotification('Passwords do not match', 'warning');
                    } else if (window.messageModal) {
                        window.messageModal.alert('Passwords do not match', 'Validation Error', 'warning');
                    }
                    return;
                }
            }
            
            // 显示加载状态
            this.showLoadingState(saveBtn, 'Saving...');
            
            // 准备更新数据
            const updatedSettings = {
                username: username.trim(),
                grade_level: gradeLevel,
                daily_goal: dailyGoal
            };
            
            // 如果修改了密码，添加到请求中
            if (newPassword) {
                updatedSettings.password = newPassword;
            }
            
            // 调用后端API保存
            const response = await fetch(window.getApiUrl('/settings/'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedSettings)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.settings = data.settings;
                this.hideLoadingState(saveBtn);
                
                // 更新侧边栏用户信息
                this.updateUserProfile();
                
                // 退出编辑模式
                this.exitEditMode();
                
                // 显示成功提示
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification('Settings saved successfully!', 'success');
                } else {
                    console.log('Settings saved successfully');
                }
            } else {
                this.hideLoadingState(saveBtn);
                // 显示错误提示
                if (typeof Utils !== 'undefined' && Utils.showNotification) {
                    Utils.showNotification(data.error || 'Failed to save settings', 'error');
                } else if (window.messageModal) {
                    window.messageModal.alert(data.error || 'Failed to save settings', 'Error', 'error');
                }
            }
        } catch (error) {
            console.error('保存设置出错:', error);
            this.hideLoadingState(saveBtn);
            // 显示错误提示
            if (typeof Utils !== 'undefined' && Utils.showNotification) {
                Utils.showNotification('An error occurred while saving settings', 'error');
            } else if (window.messageModal) {
                window.messageModal.alert('An error occurred while saving settings', 'Error', 'error');
            }
        }
    }
    
    /**
     * 更新侧边栏用户信息
     */
    updateUserProfile() {
        if (!this.settings) return;
        
        // 更新用户名
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(el => {
            el.textContent = this.settings.username || 'Student';
        });
        
        // 更新头像
        const avatarElements = document.querySelectorAll('.avatar');
        avatarElements.forEach(el => {
            const initial = (this.settings.username || 'S')[0].toUpperCase();
            el.textContent = initial;
        });
    }
    
    /**
     * 显示按钮加载状态
     */
    showLoadingState(button, message = 'Loading...') {
        if (!button) return;
        
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>${message}</span>
        `;
        button.classList.add('loading');
    }
    
    /**
     * 隐藏按钮加载状态
     */
    hideLoadingState(button) {
        if (!button) return;
        
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
        button.classList.remove('loading');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const settingsManager = new SettingsManager();
    console.log('⚙️ Settings页面已初始化');
});
