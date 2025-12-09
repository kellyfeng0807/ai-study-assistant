/**
 * Dashboard Page JavaScript
 */

class DashboardManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadDashboardData();
        this.bindActionButtons();
        this.startAutoRefresh();
    }
    
    async loadDashboardData() {
        try {
            const stats = await Utils.apiCall('/dashboard/stats?period=week');
            if (stats && stats.success) {
                this.updateStats(stats.stats);
            }
            
            const progress = await Utils.apiCall('/dashboard/progress');
            if (progress && progress.success) {
                this.updateProgress(progress.progress);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }
    
    updateStats(stats) {
        console.log('Stats updated:', stats);
    }
    
    updateProgress(progress) {
        console.log('Progress updated:', progress);
    }
    
    bindActionButtons() {
        const actionButtons = document.querySelectorAll('.action-button');
        
        actionButtons.forEach(button => {
            const module = button.dataset.module;
            
            button.addEventListener('click', () => {
                this.handleQuickAction(module);
            });
        });
    }
    
    async handleQuickAction(module) {
        console.log(`Quick action: ${module}`);
        
        switch (module) {
            case 'note-assistant':
                this.startRecording();
                break;
            case 'error-book':
                this.uploadError();
                break;
            case 'map-generation':
                this.generateMap();
                break;
            case 'learning-dashboard':
                Utils.navigateTo('learning-dashboard');
                break;
            default:
                Utils.navigateTo(module);
        }
    }
    
    async startRecording() {
        Utils.showNotification('Recording feature coming soon...', 'info');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            Utils.showNotification('Your browser does not support recording', 'error');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            Utils.showNotification('Recording started', 'success');
            
            setTimeout(() => {
                Utils.navigateTo('note-assistant');
            }, 1500);
        } catch (error) {
            console.error('Recording failed:', error);
            Utils.showNotification('Cannot access microphone', 'error');
        }
    }
    
    uploadError() {
        Utils.showNotification('Please select an error photo', 'info');
        
        fileUploader.selectFile('image/*', async (file) => {
            console.log('Selected file:', file.name);
            
            Utils.showNotification('Uploading and recognizing...', 'info');
            
            const result = await fileUploader.uploadFile(file, '/errorbook/upload');
            
            if (result && result.success) {
                Utils.showNotification('Error recognized', 'success');
                setTimeout(() => {
                    Utils.navigateTo('error-book');
                }, 1000);
            }
        });
    }
    
    async generateMap() {
        Utils.showNotification('Generating mind map...', 'info');
        
        const result = await Utils.apiCall('/map/generate', 'POST', {
            content: 'Sample content'
        });
        
        if (result && result.success) {
            Utils.showNotification('Mind map generated', 'success');
            setTimeout(() => {
                Utils.navigateTo('map-generation');
            }, 1000);
        }
    }
    
    startAutoRefresh() {
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dashboardManager = new DashboardManager();
    console.log('Dashboard initialized');
});
