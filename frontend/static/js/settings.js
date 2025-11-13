/**
 * Settings 页面JavaScript - 简化版
 * 仅包含账户设置功能，与后端API集成
 */

class SettingsManager {
    constructor() {
        this.settings = null;
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
            const response = await Utils.apiCall('/api/settings/', 'GET');
            
            if (response.success) {
                this.settings = response.settings;
                this.populateForm();
            } else {
                Utils.showNotification('加载设置失败', 'error');
            }
        } catch (error) {
            console.error('加载设置出错:', error);
            Utils.showNotification('加载设置时出错', 'error');
        }
    }
    
    /**
     * 填充表单
     */
    populateForm() {
        if (!this.settings) return;
        
        // 填充用户名
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.value = this.settings.username || '';
        }
        
        // 填充邮箱
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = this.settings.email || '';
        }
        
        // 填充年级
        const gradeSelect = document.getElementById('gradeLevel');
        if (gradeSelect) {
            gradeSelect.value = this.settings.grade_level || '9';
        }
        
        // 填充学习目标
        const goalInput = document.getElementById('dailyGoal');
        if (goalInput) {
            goalInput.value = this.settings.daily_goal || 120;
        }
    }
    
    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
        // 保存设置按钮
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }
        
        // 重置设置按钮
        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }
    }
    
    /**
     * 保存设置
     */
    async handleSave() {
        try {
            // 收集表单数据
            const username = document.getElementById('username')?.value || '';
            const email = document.getElementById('email')?.value || '';
            const gradeLevel = document.getElementById('gradeLevel')?.value || '9';
            const dailyGoal = parseInt(document.getElementById('dailyGoal')?.value) || 120;
            
            // 验证数据
            if (!username.trim()) {
                Utils.showNotification('请输入用户名', 'warning');
                return;
            }
            
            if (!email.trim()) {
                Utils.showNotification('请输入邮箱', 'warning');
                return;
            }
            
            if (dailyGoal < 30 || dailyGoal > 480) {
                Utils.showNotification('学习目标应在30-480分钟之间', 'warning');
                return;
            }
            
            // 准备更新数据
            const updatedSettings = {
                username: username.trim(),
                email: email.trim(),
                grade_level: gradeLevel,
                daily_goal: dailyGoal
            };
            
            // 调用后端API保存
            const response = await Utils.apiCall('/api/settings/', 'PUT', updatedSettings);
            
            if (response.success) {
                this.settings = response.settings;
                Utils.showNotification('设置已保存！', 'success');
            } else {
                Utils.showNotification(response.error || '保存设置失败', 'error');
            }
        } catch (error) {
            console.error('保存设置出错:', error);
            Utils.showNotification('保存设置时出错', 'error');
        }
    }
    
    /**
     * 重置设置
     */
    async handleReset() {
        if (!confirm('确定要重置所有设置为默认值吗？')) {
            return;
        }
        
        try {
            const response = await Utils.apiCall('/api/settings/reset', 'POST');
            
            if (response.success) {
                this.settings = response.settings;
                this.populateForm();
                Utils.showNotification('设置已重置为默认值', 'success');
            } else {
                Utils.showNotification(response.error || '重置设置失败', 'error');
            }
        } catch (error) {
            console.error('重置设置出错:', error);
            Utils.showNotification('重置设置时出错', 'error');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const settingsManager = new SettingsManager();
    console.log('⚙️ Settings页面已初始化');
});
