/**
 * Learning Dashboard - Frontend Logic
 * 学习数据分析和可视化
 * 
 * 功能：
 * 1. 最近7天每天的总学习时间（趋势图）
 * 2. 当天各版面的使用时间（分布图）
 * 3. 学科分布（按假定时间计算）
 */

class LearningDashboard {
    constructor() {
        this.apiBase = '/api/dashboard';
        this.currentPeriod = 7;
        this.init();
    }

    init() {
        console.log('Learning Dashboard initializing...');
        this.bindEvents();
        this.loadAllData();
        this.setTodayDate();
    }

    setTodayDate() {
        const todayEl = document.getElementById('todayDate');
        if (todayEl) {
            const today = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            todayEl.textContent = today.toLocaleDateString('en-US', options);
        }
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refreshing...');
                this.loadAllData();
            });
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
    }

    async loadAllData() {
        try {
            console.log('Loading dashboard data...');
            
            // 并行加载所有数据
            const [stats, subjects, dailyTrend, moduleToday, heatmap, aiSuggestions] = await Promise.all([
                this.fetchData('/stats', { period: this.currentPeriod }),
                this.fetchData('/subjects'),
                this.fetchDailyTrend(),
                this.fetchModuleToday(),
                this.fetchData('/heatmap'),
                this.fetchData('/ai-suggestions')
            ]);

            // 更新UI
            if (stats.success) this.updateMetrics(stats.stats);
            if (subjects.success) this.renderSubjectPieChart(subjects.subjects);
            if (dailyTrend.success) this.renderDailyTrend(dailyTrend.trend);
            if (moduleToday.success) this.renderModuleToday(moduleToday);
            if (heatmap.success) this.renderHeatmap(heatmap.heatmap, heatmap.stats);
            if (aiSuggestions.success) this.renderAISuggestions(aiSuggestions);

            console.log('Dashboard loaded successfully');

        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    async fetchData(endpoint, params = {}) {
        try {
            const url = new URL(this.apiBase + endpoint, window.location.origin);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            return { success: false };
        }
    }

    async fetchDailyTrend() {
        try {
            const response = await fetch(`/api/module_daily_trend?days=7`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching daily trend:', error);
            return { success: false };
        }
    }

    async fetchModuleToday() {
        try {
            const response = await fetch('/api/module_today');
            return await response.json();
        } catch (error) {
            console.error('Error fetching module today:', error);
            return { success: false };
        }
    }

    // ============ 格式化工具函数 ============

    formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
    }

    formatMinutes(minutes) {
        if (minutes < 60) {
            return `${minutes}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        }
    }

    // ============ 更新指标卡片 ============

    updateMetrics(stats) {
        // Study Time
        const studyTimeEl = document.getElementById('totalStudyTime');
        if (studyTimeEl && stats.study_time) {
            studyTimeEl.textContent = `${stats.study_time.total_hours}h`;
        }

        // Notes Created
        const notesEl = document.getElementById('notesCount');
        if (notesEl && stats.notes_created) {
            notesEl.textContent = stats.notes_created.count;
        }

        // Accuracy Rate
        const accuracyEl = document.getElementById('accuracyRate');
        if (accuracyEl && stats.accuracy_rate) {
            accuracyEl.textContent = `${stats.accuracy_rate.percentage}%`;
        }

        // Day Streak
        const streakEl = document.getElementById('dayStreak');
        if (streakEl && stats.day_streak) {
            streakEl.textContent = stats.day_streak.days;
        }
    }

    // ============ 渲染7天学习时间趋势图 ============

    renderDailyTrend(trendData) {
        const container = document.getElementById('dailyTrendChart');
        if (!container) return;

        console.log('[DEBUG] renderDailyTrend:', trendData);

        if (!trendData || trendData.length === 0) {
            container.innerHTML = `
                <div class="empty-chart-message">
                    <i class="fas fa-chart-bar"></i>
                    <p>No study data yet</p>
                    <p class="hint">Start using Note Assistant, Error Book, or Mind Map to track your study time</p>
                </div>
            `;
            return;
        }

        // 转换秒为分钟
        const data = trendData.map(item => ({
            date: item.date,
            minutes: Math.round(item.total_seconds / 60),
            modules: item.modules
        }));

        const maxMinutes = Math.max(...data.map(d => d.minutes), 1);
        const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);

        // 如果总数为0，显示提示
        if (totalMinutes === 0) {
            container.innerHTML = `
                <div class="empty-chart-message">
                    <i class="fas fa-chart-bar"></i>
                    <p>No study data yet</p>
                    <p class="hint">Start using Note Assistant, Error Book, or Mind Map to track your study time</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        data.forEach((item, index) => {
            const barGroup = document.createElement('div');
            barGroup.className = 'bar-group';

            const bar = document.createElement('div');
            bar.className = 'bar';
            
            if (item.minutes > 0) {
                const height = Math.max(20, (item.minutes / maxMinutes) * 150);
                bar.style.height = '0';
                bar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
                bar.style.borderRadius = '8px 8px 4px 4px';
                bar.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                bar.setAttribute('data-value', this.formatMinutes(item.minutes));
                bar.title = `${this.formatMinutes(item.minutes)}`;
                
                // 动画
                setTimeout(() => {
                    bar.style.height = `${height}px`;
                }, 50 * index);
            } else {
                bar.style.height = '4px';
                bar.style.background = '#e5e7eb';
                bar.style.borderRadius = '2px';
            }

            const label = document.createElement('span');
            label.className = 'bar-label';
            // 获取星期几
            const date = new Date(item.date);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            label.textContent = dayNames[date.getDay()];

            barGroup.appendChild(bar);
            barGroup.appendChild(label);
            container.appendChild(barGroup);
        });
    }

    // ============ 渲染当天各版面使用时间 ============

    renderModuleToday(data) {
        const container = document.getElementById('moduleTodayContainer');
        if (!container) return;

        const modules = data.modules || [];
        const totalSeconds = data.total_seconds || 0;

        // 模块配置
        const moduleConfig = {
            'note-assistant': { 
                icon: 'fa-file-alt', 
                color: '#3b82f6', 
                name: 'Note Assistant',
                description: 'Create and manage notes'
            },
            'error-book': { 
                icon: 'fa-book-open', 
                color: '#ef4444', 
                name: 'Error Book',
                description: 'Track and review mistakes'
            },
            'map-generation': { 
                icon: 'fa-sitemap', 
                color: '#10b981', 
                name: 'Mind Map',
                description: 'Create visual mind maps'
            }
        };

        if (totalSeconds === 0) {
            container.innerHTML = `
                <div class="empty-module-today">
                    <i class="fas fa-clock"></i>
                    <h4>No Activity Today</h4>
                    <p>Start studying to see your time distribution here</p>
                </div>
            `;
            return;
        }

        // 生成模块卡片
        const cardsHtml = modules.map(item => {
            const config = moduleConfig[item.module] || {
                icon: 'fa-puzzle-piece',
                color: '#64748b',
                name: item.module,
                description: ''
            };
            
            const percentage = totalSeconds > 0 ? Math.round((item.seconds / totalSeconds) * 100) : 0;
            const timeStr = this.formatDuration(item.seconds);
            
            return `
                <div class="module-today-item" style="--module-color: ${config.color};">
                    <div class="module-today-icon" style="background: ${config.color}15; color: ${config.color};">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div class="module-today-info">
                        <div class="module-today-name">${config.name}</div>
                        <div class="module-today-time">${item.seconds > 0 ? timeStr : 'Not used'}</div>
                    </div>
                    <div class="module-today-bar-container">
                        <div class="module-today-bar" style="width: ${percentage}%; background: ${config.color};"></div>
                    </div>
                    <div class="module-today-percentage" style="color: ${config.color};">
                        ${item.seconds > 0 ? percentage + '%' : '-'}
                    </div>
                </div>
            `;
        }).join('');

        // 总时间摘要
        const summaryHtml = `
            <div class="module-today-summary">
                <div class="summary-total">
                    <i class="fas fa-clock"></i>
                    <span class="summary-label">Total Today:</span>
                    <span class="summary-value">${this.formatDuration(totalSeconds)}</span>
                </div>
            </div>
        `;

        container.innerHTML = cardsHtml + summaryHtml;
    }

    // ============ 渲染学科分布（饼状图） ============

    renderSubjectPieChart(subjects) {
        const container = document.getElementById('subjectDistribution');
        if (!container) return;

        if (!subjects || subjects.length === 0) {
            container.innerHTML = `
                <div class="empty-chart-message">
                    <i class="fas fa-chart-pie"></i>
                    <p>No subject data</p>
                </div>
            `;
            return;
        }

        // 生成饼状图的 conic-gradient
        let gradientParts = [];
        let currentAngle = 0;
        
        subjects.forEach((subject) => {
            const startAngle = currentAngle;
            const endAngle = currentAngle + (subject.percentage * 3.6);
            gradientParts.push(`${subject.color} ${startAngle}deg ${endAngle}deg`);
            currentAngle = endAngle;
        });
        
        const gradient = gradientParts.join(', ');

        // 生成图例（显示时间而不只是百分比）
        const legendItems = subjects.map(subject => `
            <div class="pie-legend-item">
                <span class="pie-legend-dot" style="background: ${subject.color};"></span>
                <span class="pie-legend-label">${subject.name}</span>
                <span class="pie-legend-value">${subject.percentage}%</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="pie-chart-container">
                <div class="pie-chart" style="background: conic-gradient(${gradient});">
                    <div class="pie-chart-center">
                        <span class="pie-total">${subjects.length}</span>
                        <span class="pie-label">Subjects</span>
                    </div>
                </div>
                <div class="pie-legend">
                    ${legendItems}
                </div>
            </div>
        `;
    }

    // ============ 渲染学习热力图 ============

    renderHeatmap(heatmapData, stats) {
        const container = document.getElementById('heatmapContainer');
        if (!container) return;

        if (!heatmapData || heatmapData.length === 0) {
            container.innerHTML = `
                <div class="empty-chart-message">
                    <i class="fas fa-fire"></i>
                    <p>No activity data</p>
                </div>
            `;
            return;
        }

        // 按周分组
        const weeks = [];
        for (let i = 0; i < heatmapData.length; i += 7) {
            weeks.push(heatmapData.slice(i, i + 7));
        }

        // 颜色等级
        const colors = [
            '#ebedf0',
            '#9be9a8',
            '#40c463',
            '#30a14e',
            '#216e39'
        ];

        // 等级时间标准
        const levelLabels = ['0m', '≤10m', '10-30m', '30-60m', '>60m'];

        const weeksHtml = weeks.map(week => {
            const daysHtml = week.map(day => `
                <div class="heatmap-day" 
                     style="background-color: ${colors[day.level]};"
                     title="${day.date}: ${day.minutes}min, ${day.count} activities">
                </div>
            `).join('');
            return `<div class="heatmap-week">${daysHtml}</div>`;
        }).join('');

        const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

        container.innerHTML = `
            <div class="heatmap-wrapper">
                <div class="heatmap-labels">
                    ${dayLabels.map(d => `<span>${d}</span>`).join('')}
                </div>
                <div class="heatmap-grid">
                    ${weeksHtml}
                </div>
            </div>
            <div class="heatmap-footer">
                <div class="heatmap-stats">
                    <span>${stats?.active_days || 0} days active</span>
                    <span>${stats?.total_activities || 0} activities</span>
                    <span>${stats?.total_minutes || 0} min total</span>
                </div>
                <div class="heatmap-legend">
                    <span>Less</span>
                    ${colors.map((c, i) => `
                        <div class="heatmap-legend-item" style="background-color: ${c};" title="${levelLabels[i]}"></div>
                    `).join('')}
                    <span>More</span>
                </div>
            </div>
            <div class="heatmap-scale">
                <span class="scale-title">Scale:</span>
                ${colors.map((c, i) => `
                    <span class="scale-item">
                        <span class="scale-color" style="background-color: ${c};"></span>
                        <span class="scale-label">${levelLabels[i]}</span>
                    </span>
                `).join('')}
            </div>
        `;
    }

    // ============ 渲染AI学习建议 ============

    renderAISuggestions(data) {
        const container = document.getElementById('aiSuggestionsContainer');
        if (!container) return;

        const { encouragements, suggestions } = data;

        if ((!encouragements || encouragements.length === 0) && (!suggestions || suggestions.length === 0)) {
            container.innerHTML = `
                <div class="empty-chart-message">
                    <i class="fas fa-robot"></i>
                    <p>No suggestions yet</p>
                    <p class="hint">Study more to get personalized suggestions</p>
                </div>
            `;
            return;
        }

        const encouragementsHtml = (encouragements || []).map(item => `
            <div class="suggestion-card encouragement">
                <div class="suggestion-icon">${item.icon}</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">${item.title}</div>
                    <div class="suggestion-message">${item.message}</div>
                </div>
            </div>
        `).join('');

        const suggestionsHtml = (suggestions || []).map(item => `
            <div class="suggestion-card suggestion">
                <div class="suggestion-icon">${item.icon}</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">${item.title}</div>
                    <div class="suggestion-message">${item.message}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="ai-suggestions-grid">
                ${encouragementsHtml}
                ${suggestionsHtml}
            </div>
        `;
    }

    // ============ 导出报告 ============

    async exportReport() {
        try {
            const response = await fetch(`${this.apiBase}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period: this.currentPeriod,
                    format: 'pdf'
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Report generated successfully!');
            } else {
                alert('Failed to generate report');
            }

        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed: ' + error.message);
        }
    }
}

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new LearningDashboard();
    console.log('Learning Dashboard initialized');
});