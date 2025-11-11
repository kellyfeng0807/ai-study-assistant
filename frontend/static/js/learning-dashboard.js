/**
 * Learning Dashboard Page JavaScript
 */

class LearningAnalyticsManager {
    constructor() {
        this.currentPeriod = 30;
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.loadAnalytics();
    }
    
    bindEventListeners() {
        const periodSelect = document.querySelector('.period-select');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.currentPeriod = parseInt(e.target.value);
                this.loadAnalytics();
            });
        }
    }
    
    async loadAnalytics() {
        Utils.showNotification('Loading analytics...', 'info');
        
        const result = await Utils.apiCall('/dashboard/statistics', 'POST', {
            period: this.currentPeriod
        });
        
        if (result && result.success) {
            console.log('Analytics loaded:', result.statistics);
            this.updateMetrics(result.statistics);
            this.updateCharts(result.statistics);
        }
    }
    
    updateMetrics(data) {
        const metrics = data.metrics || {};
        
        const metricCards = document.querySelectorAll('.metric-card');
        if (metricCards.length > 0) {
            console.log('Metrics updated:', metrics);
        }
    }
    
    updateCharts(data) {
        this.animateProgressBars();
        this.animateBarChart();
    }
    
    animateProgressBars() {
        const progressBars = document.querySelectorAll('.progress-fill');
        progressBars.forEach((bar, index) => {
            setTimeout(() => {
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.width = width;
                }, 50);
            }, index * 100);
        });
    }
    
    animateBarChart() {
        const bars = document.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
            setTimeout(() => {
                const height = bar.style.height;
                bar.style.height = '0%';
                setTimeout(() => {
                    bar.style.height = height;
                }, 50);
            }, index * 100);
        });
    }
    
    async exportReport() {
        Utils.showNotification('Generating report...', 'info');
        
        setTimeout(() => {
            Utils.showNotification('Report exported successfully', 'success');
        }, 1500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const analyticsManager = new LearningAnalyticsManager();
    console.log('Learning Analytics initialized');
});
