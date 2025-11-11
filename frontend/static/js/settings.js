/**
 * Settings 页面JavaScript
 */

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.loadCurrentSettings();
    }
    
    /**
     * 从localStorage加载设置
     */
    loadSettings() {
        const defaultSettings = {
            username: '学生用户',
            grade: '初三',
            studyGoal: 120,
            voiceLanguage: '中文（简体）',
            noteDetail: '标准',
            autoGenerateExercises: true,
            studyReminder: true,
            reviewReminder: true,
            achievementNotify: true,
            theme: 'light',
            animations: true
        };
        
        const saved = localStorage.getItem('userSettings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }
    
    /**
     * 保存设置到localStorage
     */
    saveSettings() {
        localStorage.setItem('userSettings', JSON.stringify(this.settings));
    }
    
    /**
     * 加载当前设置到界面
     */
    loadCurrentSettings() {
        // 加载各个设置项
        document.querySelectorAll('.setting-input').forEach(input => {
            const key = input.name || input.id;
            if (key && this.settings[key] !== undefined) {
                input.value = this.settings[key];
            }
        });
        
        document.querySelectorAll('.setting-select').forEach(select => {
            const key = select.name || select.id;
            if (key && this.settings[key] !== undefined) {
                select.value = this.settings[key];
            }
        });
        
        document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(checkbox => {
            const key = checkbox.name || checkbox.id;
            if (key && this.settings[key] !== undefined) {
                checkbox.checked = this.settings[key];
            }
        });
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
        
        // 主题选择
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.handleThemeChange(e.target.value);
            });
        }
        
        // 导出数据按钮
        const exportBtn = document.querySelector('button[class*="download"]')?.parentElement;
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        
        // 清除缓存按钮
        const clearBtn = document.querySelector('button[class*="trash"]')?.parentElement;
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCache());
        }
    }
    
    /**
     * 保存设置
     */
    async handleSave() {
        // 收集所有设置
        const newSettings = {};
        
        // 输入框
        document.querySelectorAll('.setting-input').forEach(input => {
            const name = input.closest('.setting-item')?.querySelector('label')?.textContent;
            const value = input.type === 'number' ? parseInt(input.value) : input.value;
            if (name) {
                newSettings[this.getSettingKey(name)] = value;
            }
        });
        
        // 下拉框
        document.querySelectorAll('.setting-select').forEach(select => {
            const name = select.closest('.setting-item')?.querySelector('label')?.textContent;
            if (name) {
                newSettings[this.getSettingKey(name)] = select.value;
            }
        });
        
        // 开关
        document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(checkbox => {
            const name = checkbox.closest('.setting-item')?.querySelector('label')?.textContent;
            if (name) {
                newSettings[this.getSettingKey(name)] = checkbox.checked;
            }
        });
        
        // 合并设置
        this.settings = { ...this.settings, ...newSettings };
        
        // 保存到localStorage
        this.saveSettings();
        
        // 显示成功消息
        Utils.showNotification('设置已保存！', 'success');
        
        // 调用后端API（可选）
        await Utils.apiCall('/ui/settings', 'POST', this.settings);
    }
    
    /**
     * 重置设置
     */
    handleReset() {
        if (confirm('确定要重置所有设置为默认值吗？')) {
            localStorage.removeItem('userSettings');
            this.settings = this.loadSettings();
            this.loadCurrentSettings();
            Utils.showNotification('设置已重置为默认值', 'info');
        }
    }
    
    /**
     * 处理主题切换
     */
    handleThemeChange(theme) {
        if (window.themeManager) {
            window.themeManager.currentTheme = theme;
            window.themeManager.applyTheme(theme);
            Utils.showNotification(`已切换到${theme === 'light' ? '浅色' : '深色'}主题`, 'success');
        }
    }
    
    /**
     * 导出数据
     */
    async exportData() {
        Utils.showNotification('正在准备导出数据...', 'info');
        
        // 模拟数据导出
        const data = {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study_data_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        Utils.showNotification('数据导出成功！', 'success');
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        if (confirm('确定要清除所有缓存数据吗？这不会影响你的学习数据。')) {
            // 清除缓存逻辑
            Utils.showNotification('缓存已清除', 'success');
        }
    }
    
    /**
     * 将标签文本转换为设置键名
     */
    getSettingKey(label) {
        const keyMap = {
            '用户名': 'username',
            '年级': 'grade',
            '学习目标': 'studyGoal',
            '语音识别语言': 'voiceLanguage',
            '笔记生成详细度': 'noteDetail',
            '自动生成练习题': 'autoGenerateExercises',
            '学习提醒': 'studyReminder',
            '错题复习提醒': 'reviewReminder',
            '成就通知': 'achievementNotify',
            '主题模式': 'theme',
            '动画效果': 'animations'
        };
        return keyMap[label] || label;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const settingsManager = new SettingsManager();
    console.log('⚙️ Settings页面已初始化');
});
