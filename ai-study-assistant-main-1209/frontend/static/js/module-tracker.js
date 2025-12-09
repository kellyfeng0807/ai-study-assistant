/**
 * Module Time Tracker
 * 追踪用户在 Note Assistant, Error Book, Mind Map 三个模块的使用时间
 */

class ModuleTracker {
    constructor(moduleName) {
        this.moduleName = moduleName;
        this.startTime = null;
        this.isActive = true;
        this.totalSeconds = 0;
        this.lastActiveTime = Date.now();
        this.idleThreshold = 60000; // 60秒无活动视为空闲
        
        this.init();
    }
    
    init() {
        // 开始追踪
        this.startTime = Date.now();
        console.log(`[ModuleTracker] Started tracking: ${this.moduleName}`);
        
        // 监听用户活动
        this.bindActivityListeners();
        
        // 页面离开时发送数据
        this.bindUnloadListeners();
        
        // 每30秒检查一次空闲状态
        this.idleCheckInterval = setInterval(() => this.checkIdle(), 30000);
    }
    
    bindActivityListeners() {
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        
        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActiveTime = Date.now();
                if (!this.isActive) {
                    this.isActive = true;
                    this.startTime = Date.now();
                    console.log(`[ModuleTracker] User returned to ${this.moduleName}`);
                }
            }, { passive: true });
        });
    }
    
    bindUnloadListeners() {
        // 页面卸载前发送数据
        window.addEventListener('beforeunload', () => this.sendTrackingData());
        window.addEventListener('pagehide', () => this.sendTrackingData());
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏，暂停追踪
                this.pauseTracking();
            } else {
                // 页面显示，恢复追踪
                this.resumeTracking();
            }
        });
    }
    
    checkIdle() {
        const idleTime = Date.now() - this.lastActiveTime;
        if (idleTime > this.idleThreshold && this.isActive) {
            this.pauseTracking();
        }
    }
    
    pauseTracking() {
        if (this.isActive && this.startTime) {
            const sessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.totalSeconds += sessionSeconds;
            this.isActive = false;
            console.log(`[ModuleTracker] Paused ${this.moduleName}, session: ${sessionSeconds}s, total: ${this.totalSeconds}s`);
        }
    }
    
    resumeTracking() {
        if (!this.isActive) {
            this.isActive = true;
            this.startTime = Date.now();
            this.lastActiveTime = Date.now();
            console.log(`[ModuleTracker] Resumed ${this.moduleName}`);
        }
    }
    
    sendTrackingData() {
        // 计算当前会话时间
        if (this.isActive && this.startTime) {
            const sessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            this.totalSeconds += sessionSeconds;
        }
        
        // 清除定时器
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
        }
        
        // 至少5秒才发送
        if (this.totalSeconds < 5) {
            console.log(`[ModuleTracker] Skipped ${this.moduleName}, too short: ${this.totalSeconds}s`);
            return;
        }
        
        // 最多2小时
        const seconds = Math.min(this.totalSeconds, 7200);
        
        console.log(`[ModuleTracker] Sending ${this.moduleName}: ${seconds}s`);
        
        // 使用 sendBeacon 确保数据发送
        const data = JSON.stringify({
            module: this.moduleName,
            seconds: seconds
        });
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/track_module', data);
        } else {
            // 降级方案：同步请求
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/track_module', false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
        }
        
        // 重置计数器（防止重复发送）
        this.totalSeconds = 0;
        this.startTime = null;
    }
    
    // 手动获取当前追踪时间
    getCurrentDuration() {
        let total = this.totalSeconds;
        if (this.isActive && this.startTime) {
            total += Math.floor((Date.now() - this.startTime) / 1000);
        }
        return total;
    }
}

// 模块名称映射（只追踪这三个核心模块）
const MODULE_NAMES = {
    'note-assistant': 'Note Assistant',
    'error-book': 'Error Book',
    'map-generation': 'Mind Map'
};

// 根据当前页面路径获取模块名称
function getCurrentModuleName() {
    const path = window.location.pathname;
    
    // 只追踪三个核心学习模块
    if (path.includes('note-assistant')) return 'note-assistant';
    if (path.includes('error-book') || path.includes('error-review') || path.includes('error-practice')) return 'error-book';
    if (path.includes('map-generation')) return 'map-generation';
    
    // 其他页面不追踪（包括 learning-dashboard, parent-view, settings）
    return null;
}

// 自动初始化追踪器
let moduleTracker = null;

document.addEventListener('DOMContentLoaded', () => {
    const moduleName = getCurrentModuleName();
    if (moduleName) {
        moduleTracker = new ModuleTracker(moduleName);
        window.moduleTracker = moduleTracker; // 暴露到全局，方便调试
        console.log(`[ModuleTracker] Initialized for: ${moduleName}`);
    } else {
        console.log('[ModuleTracker] Current page not tracked');
    }
});