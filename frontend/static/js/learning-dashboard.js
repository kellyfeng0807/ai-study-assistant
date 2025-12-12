/**
 * Learning Dashboard - Frontend Logic
 * 学习数据分析和可视化
 */

class LearningDashboard {
    constructor() {
        this.apiBase = '/api/dashboard';
        this.currentPeriod = 7;  // 固定为 7 天
        this.init();
    }

    init() {
        console.log('Learning Dashboard initializing...');
        this.bindEvents();
        this.loadAllData();
    }

    // ============ 事件绑定 ============

    bindEvents() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refreshing...');
                this.loadAllData();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
        
        // 通知由 notifications.js 统一处理
    }

    // ============ 数据加载 ============

    async loadAllData() {
        try {
            console.log('Loading dashboard data...');
            
            // 并行加载所有数据
            const [stats, subjects, chartData, reviewData, analysis, schedule, heatmap, aiSuggestions, todayModules] = await Promise.all([
                this.fetchData('/stats', { period: this.currentPeriod }),
                this.fetchData('/subjects'),
                this.fetchData('/chart-data', { type: 'time', period: this.currentPeriod }),
                this.fetchData('/chart-data', { type: 'review' }),
                this.fetchData('/analysis'),
                this.fetchData('/schedule'),
                this.fetchData('/heatmap'),
                this.fetchData('/ai-suggestions'),
                this.fetchData('/today-modules')
            ]);

            // 更新UI
            if (stats.success) this.updateMetrics(stats.stats);
            if (subjects.success) {
                this.renderSubjectPieChart(subjects.subjects);
                this.renderMasteryLevel(subjects.subjects);
            }
            if (chartData.success) this.renderTimeChart(chartData.chartData);
            if (reviewData.success) this.renderReviewStats(reviewData.chartData);
            if (analysis.success) {
                this.renderAnalysis(analysis);
                // Store goal stats for metric card
                if (analysis.goal_stats) {
                    this.currentGoalStats = analysis.goal_stats;
                    this.updateGoalProgress(analysis.goal_stats);
                }
            }
            if (schedule.success) this.renderSchedule(schedule.schedule);
            if (heatmap.success) this.renderHeatmap(heatmap.heatmap, heatmap.stats);
            if (aiSuggestions.success) this.renderAISuggestions(aiSuggestions);
            if (todayModules.success) this.renderTodayModules(todayModules.modules);

            console.log('✓ Dashboard loaded successfully');

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

    // ============ 更新指标卡片 ============

    updateMetrics(stats) {
        // 学习时长
        const metricCards = document.querySelectorAll('.metric-card');
        if (metricCards.length >= 4) {
            // Study Time with Goal Progress (in minutes)
            const studyTimeValue = metricCards[0].querySelector('.metric-value');
            const studyTimeTrend = metricCards[0].querySelector('.metric-trend');
            if (studyTimeValue) {
                const totalMinutes = stats.study_time.total_minutes || Math.round(stats.study_time.total_hours * 60);
                studyTimeValue.textContent = `${totalMinutes} min`;
            }
            if (studyTimeTrend) {
                this.updateTrendElement(studyTimeTrend, stats.study_time.trend, stats.study_time.trend_value, true);
            }
            
            // Update goal progress if goal_stats exists
            if (this.currentGoalStats) {
                this.updateGoalProgress(this.currentGoalStats, stats.study_time.total_minutes);
            }

            // Notes Created
            const notesValue = metricCards[1].querySelector('.metric-value');
            const notesTrend = metricCards[1].querySelector('.metric-trend');
            if (notesValue) {
                notesValue.textContent = stats.notes_created.count;
            }
            if (notesTrend) {
                this.updateTrendElement(notesTrend, stats.notes_created.trend, stats.notes_created.trend_value, true);
            }

            // Accuracy Rate
            const accuracyValue = metricCards[2].querySelector('.metric-value');
            const accuracyTrend = metricCards[2].querySelector('.metric-trend');
            if (accuracyValue) {
                accuracyValue.textContent = `${stats.accuracy_rate.percentage}%`;
            }
            if (accuracyTrend) {
                this.updateTrendElement(accuracyTrend, stats.accuracy_rate.trend, stats.accuracy_rate.trend_value, true);
            }

            // Day Streak
            const streakValue = metricCards[3].querySelector('.metric-value');
            const streakTrend = metricCards[3].querySelector('.metric-trend');
            if (streakValue) {
                streakValue.textContent = stats.day_streak.days;
            }
            if (streakTrend) {
                this.updateTrendElement(streakTrend, stats.day_streak.trend, stats.day_streak.trend_value, false);
            }
        }
    }

    updateTrendElement(element, trend, value, isPercent = true) {
        const isPositive = trend === 'up';
        element.className = `metric-trend ${isPositive ? 'positive' : 'negative'}`;
        
        const prefix = isPositive ? '+' : '-';
        const suffix = isPercent ? '%' : '';
        
        element.innerHTML = `
            <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
            ${prefix}${Math.abs(value)}${suffix}
        `;
    }
    
    updateGoalProgress(goalStats, currentMinutes) {
        const goalProgress = document.getElementById('goalProgress');
        const goalValue = document.getElementById('goalValue');
        const goalBar = document.getElementById('goalBar');
        
        if (!goalProgress || !goalStats) return;
        
        const todayMinutes = currentMinutes || Math.round(goalStats.week_minutes / 7);
        const dailyGoal = goalStats.daily_goal;
        const percentage = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));
        
        // Show the progress section
        goalProgress.style.display = 'block';
        
        // Update goal value: "Current / Goal min (percentage%)"
        goalValue.innerHTML = `Goal: <strong>${todayMinutes} / ${dailyGoal} min</strong> (${percentage}%)`;
        
        // Update progress bar
        goalBar.style.width = `${percentage}%`;
        
        // Change color based on progress
        if (percentage >= 100) {
            goalBar.style.background = 'hsl(142.1, 76.2%, 36.3%)'; // green
        } else if (percentage >= 70) {
            goalBar.style.background = 'hsl(45, 93%, 47%)'; // yellow
        } else {
            goalBar.style.background = 'hsl(0, 84.2%, 60.2%)'; // red
        }
    }

    // ============ 渲染图表 ============

    renderTimeChart(chartData) {
        const container = document.querySelector('.bar-chart');
        if (!container) return;

        console.log('[DEBUG] renderTimeChart received:', chartData);

        const { labels, data } = chartData;
        
        // 数据验证和清理
        if (!Array.isArray(labels) || !Array.isArray(data) || labels.length !== data.length) {
            console.error('[ERROR] Invalid chart data structure', { labels, data });
            return;
        }
        
        const maxValue = Math.max(...data);
        const sum = data.reduce((a, b) => a + b, 0);
        const dayCount = data.length;
        
        console.log(`[DEBUG] Chart: labels=${labels.length}, maxValue=${maxValue}, sum=${sum}, dayCount=${dayCount}`);
        
        // 清空容器，确保不会重复渲染
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.gap = '4px';
        container.style.alignItems = 'flex-end';
        container.style.justifyContent = 'center';
        container.style.height = '220px';
        container.style.padding = '20px 10px';
        
        // 如果所有数据都是0，显示提示
        if (sum === 0) {
            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--muted-foreground);">
                    <div style="text-align: center;">
                        <i class="fas fa-chart-bar" style="font-size: 32px; opacity: 0.5; margin-bottom: 8px;"></i>
                        <p>No study data yet</p>
                        <p style="font-size: 12px;">Create notes or add errors to see your study trend</p>
                    </div>
                </div>
            `;
            return;
        }

        // 根据天数动态调整柱子宽度和标签显示
        let barWidth, showLabel, fontSize;
        if (dayCount <= 7) {
            barWidth = 50;
            showLabel = true;
            fontSize = 12;
        } else if (dayCount <= 14) {
            barWidth = 35;
            showLabel = true;
            fontSize = 10;
        } else if (dayCount <= 30) {
            barWidth = 20;
            showLabel = (index) => index % 3 === 0;  // 每3天显示一个标签
            fontSize = 9;
        } else {
            barWidth = 12;
            showLabel = (index) => index % 7 === 0;  // 每7天显示一个标签
            fontSize = 8;
        }

        data.forEach((value, index) => {
            const barGroup = document.createElement('div');
            barGroup.className = 'bar-group';
            barGroup.style.position = 'relative';
            barGroup.style.minWidth = `${barWidth}px`;

            const bar = document.createElement('div');
            bar.className = 'bar';
            // Don't set data-value to avoid duplicate labels from CSS ::after
            
            if (value === 0) {
                // 0分钟：完全透明，不显示任何东西
                bar.style.height = '0';
                bar.style.opacity = '0';
            } else {
                // 有数据：直接用绝对高度
                const height = Math.max(30, (value / maxValue) * 160);
                bar.style.position = 'absolute';
                bar.style.bottom = '25px';
                bar.style.left = '50%';
                bar.style.transform = 'translateX(-50%)';
                bar.style.width = `${Math.max(barWidth - 8, 8)}px`;
                bar.style.height = '0px';
                bar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
                bar.style.borderRadius = dayCount > 14 ? '3px 3px 2px 2px' : '8px 8px 4px 4px';
                bar.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                
                // 只在天数较少时显示数值标签
                if (dayCount <= 14) {
                    const valueLabel = document.createElement('div');
                    valueLabel.style.cssText = `
                        position: absolute;
                        top: -22px;
                        left: 50%;
                        transform: translateX(-50%);
                        font-size: ${fontSize}px;
                        font-weight: 700;
                        color: #3b82f6;
                        white-space: nowrap;
                    `;
                    valueLabel.textContent = `${value}m`;
                    bar.appendChild(valueLabel);
                }
                
                // 动画
                setTimeout(() => {
                    bar.style.height = `${height}px`;
                }, 30 * index);
            }

            const label = document.createElement('span');
            label.className = 'bar-label';
            label.style.position = 'absolute';
            label.style.bottom = '0';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.fontSize = `${fontSize}px`;
            label.style.whiteSpace = 'nowrap';
            
            // 根据天数决定是否显示标签
            const shouldShowLabel = typeof showLabel === 'function' ? showLabel(index) : showLabel;
            
            if (shouldShowLabel) {
                label.textContent = labels[index];
                if (value > 0) {
                    label.style.fontWeight = '700';
                    label.style.color = '#3b82f6';
                } else {
                    label.style.color = '#9ca3af';
                }
            } else {
                label.textContent = '';
            }

            barGroup.appendChild(bar);
            barGroup.appendChild(label);
            container.appendChild(barGroup);
        });
    }

    renderSubjectPieChart(subjects) {
        const container = document.getElementById('subjectDistribution');
        if (!container) return;

        // 如果没有数据
        if (!subjects || subjects.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--muted-foreground);">
                    <i class="fas fa-chart-pie" style="font-size: 32px; opacity: 0.5;"></i>
                    <p>No subject data</p>
                </div>
            `;
            return;
        }

        // 生成饼状图的 conic-gradient
        let gradientParts = [];
        let currentAngle = 0;
        
        subjects.forEach((subject, index) => {
            const startAngle = currentAngle;
            const endAngle = currentAngle + (subject.percentage * 3.6); // 百分比转角度
            gradientParts.push(`${subject.color} ${startAngle}deg ${endAngle}deg`);
            currentAngle = endAngle;
        });
        
        const gradient = gradientParts.join(', ');

        // 生成图例
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

    renderMasteryLevel(subjects) {
        const container = document.getElementById('masteryGrid');
        if (!container) return;

        container.innerHTML = '';

        subjects.slice(0, 4).forEach((subject, index) => {
            const radius = 36;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (subject.mastery_level / 100) * circumference;

            const item = document.createElement('div');
            item.className = 'mastery-item';

            item.innerHTML = `
                <div class="mastery-circle">
                    <svg width="80" height="80">
                        <circle class="mastery-circle-bg" cx="40" cy="40" r="${radius}"></circle>
                        <circle class="mastery-circle-progress" cx="40" cy="40" r="${radius}"
                                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${circumference}; stroke: ${subject.color};">
                        </circle>
                    </svg>
                    <div class="mastery-percentage">${subject.mastery_level}%</div>
                </div>
                <div class="mastery-subject">${subject.name}</div>
            `;

            container.appendChild(item);

            // 动画
            setTimeout(() => {
                const circle = item.querySelector('.mastery-circle-progress');
                circle.style.strokeDashoffset = offset;
            }, 100 * index);
        });
    }

    renderReviewStats(chartData) {
        const container = document.getElementById('reviewStats');
        if (!container) return;

        const { completed, total, percentage } = chartData;

        container.innerHTML = `
            <div class="review-stat-item">
                <div class="review-stat-label">This Week</div>
                <div class="review-stat-value">
                    <span class="completed">${completed}</span> / ${total}
                </div>
                <div class="review-stat-bar">
                    <div class="review-stat-fill" style="width: 0%"></div>
                </div>
            </div>
        `;

        // 动画
        setTimeout(() => {
            const fill = container.querySelector('.review-stat-fill');
            if (fill) fill.style.width = `${percentage}%`;
        }, 300);
    }

    // ============ 渲染分析 ============

    renderAnalysis(data) {
        // 强项
        const strengthsList = document.querySelector('.performance-card:first-child .performance-list');
        if (strengthsList) {
            if (data.strengths && data.strengths.length > 0) {
                strengthsList.innerHTML = data.strengths.map(item => `
                    <li class="performance-item positive">
                        <i class="fas fa-check-circle"></i>
                        <span>${item.title} (${item.accuracy}% mastery)</span>
                    </li>
                `).join('');
            } else {
                strengthsList.innerHTML = `
                    <li class="performance-item" style="color: var(--muted-foreground); justify-content: center;">
                        <i class="fas fa-info-circle"></i>
                        <span>No data yet. Add notes or errors first.</span>
                    </li>
                `;
            }
        }

        // 需改进
        const improvementsList = document.querySelector('.performance-card:last-child .performance-list');
        if (improvementsList) {
            if (data.improvements && data.improvements.length > 0) {
                improvementsList.innerHTML = data.improvements.map(item => `
                    <li class="performance-item warning">
                        <i class="fas fa-exclamation-circle"></i>
                        <span>${item.title} (${item.accuracy}% → ${item.target}%)</span>
                    </li>
                `).join('');
            } else {
                improvementsList.innerHTML = `
                    <li class="performance-item" style="color: var(--muted-foreground); justify-content: center;">
                        <i class="fas fa-info-circle"></i>
                        <span>No data</span>
                    </li>
                `;
            }
        }

        // 学习习惯
        const habitsInfo = document.getElementById('habitsInfo');
        if (habitsInfo && data.habits) {
            const h = data.habits;
            habitsInfo.innerHTML = `
                <div class="habit-item">
                    <span class="habit-label">Most Active Time</span>
                    <span class="habit-value">${h.most_active_time}</span>
                </div>
                <div class="habit-item">
                    <span class="habit-label">Avg Session</span>
                    <span class="habit-value">${typeof h.average_session === 'number' ? h.average_session + ' min' : h.average_session}</span>
                </div>
                <div class="habit-item">
                    <span class="habit-label">Consistency</span>
                    <span class="habit-value">${typeof h.consistency_score === 'number' ? h.consistency_score + '%' : h.consistency_score}</span>
                </div>
                <div class="habit-item">
                    <span class="habit-label">Best Day</span>
                    <span class="habit-value">${h.best_day}</span>
                </div>
                <div class="habit-item">
                    <span class="habit-label">Review Rate</span>
                    <span class="habit-value">${typeof h.review_compliance === 'number' ? h.review_compliance + '%' : h.review_compliance}</span>
                </div>
            `;
        }
    }

    // ============ 渲染复习计划 ============

    renderSchedule(schedule) {
        const container = document.getElementById('reviewSchedule');
        if (!container) return;

        container.innerHTML = schedule.map(day => `
            <div class="schedule-day ${day.is_today ? 'today' : ''}">
                <div class="schedule-date">${day.date}</div>
                <div class="schedule-day-name">${day.day}</div>
                <div class="schedule-count">${day.count}</div>
                <div class="schedule-label">reviews</div>
            </div>
        `).join('');
    }

    // ============ 渲染学习热力图 ============

    renderHeatmap(heatmapData, stats) {
        const container = document.getElementById('heatmapContainer');
        if (!container) return;

        // 按周分组（每7天一行）
        const weeks = [];
        for (let i = 0; i < heatmapData.length; i += 7) {
            weeks.push(heatmapData.slice(i, i + 7));
        }

        // 颜色等级
        const colors = [
            '#ebedf0',  // level 0 - 无活动
            '#9be9a8',  // level 1 - 少量
            '#40c463',  // level 2 - 中等
            '#30a14e',  // level 3 - 较多
            '#216e39'   // level 4 - 很多
        ];

        // 生成热力图HTML
        const weeksHtml = weeks.map(week => {
            const daysHtml = week.map(day => `
                <div class="heatmap-day" 
                     style="background-color: ${colors[day.level]};"
                     title="${day.date}: ${day.count} activities (${day.notes} notes, ${day.errors} errors)">
                </div>
            `).join('');
            return `<div class="heatmap-week">${daysHtml}</div>`;
        }).join('');

        // 星期标签
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
                    <span>${stats.active_days} days active</span>
                    <span>${stats.total_activities} activities</span>
                </div>
                <div class="heatmap-legend">
                    <span>Less</span>
                    ${colors.map(c => `<div class="heatmap-legend-item" style="background-color: ${c};"></div>`).join('')}
                    <span>More</span>
                </div>
            </div>
        `;
    }

    // ============ 渲染AI学习建议 ============

    renderAISuggestions(data) {
        const container = document.getElementById('aiSuggestionsContainer');
        if (!container) return;

        const { encouragements, suggestions, stats } = data;

        // 生成表扬卡片
        const encouragementsHtml = encouragements.map(item => `
            <div class="suggestion-card encouragement">
                <div class="suggestion-icon">${item.icon}</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">${item.title}</div>
                    <div class="suggestion-message">${item.message}</div>
                </div>
            </div>
        `).join('');

        // 生成建议卡片
        const suggestionsHtml = suggestions.map(item => `
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

    // ============ Today's Module Usage (Pie Chart) ============

    renderTodayModules(modules) {
        const container = document.getElementById('moduleTodayContainer');
        if (!container) {
            console.error('[ERROR] Module today container not found');
            return;
        }

        console.log('[DEBUG] renderTodayModules called with:', modules);

        if (!modules || modules.length === 0) {
            console.log('[INFO] No module data, showing empty state');
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                    <i class="fas fa-clock" style="font-size: 32px; opacity: 0.5;"></i>
                    <p style="margin-top: 10px;">No module usage today</p>
                </div>
            `;
            return;
        }

        // Calculate total time and prepare data
        const totalMinutes = modules.reduce((sum, m) => sum + m.minutes, 0);
        
        // Assign colors (red, yellow, green cycle)
        const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
        
        // Generate pie chart segments
        let currentAngle = 0;
        const segments = modules.map((module, index) => {
            const percentage = (module.minutes / totalMinutes) * 100;
            const angle = (module.minutes / totalMinutes) * 360;
            const segment = {
                ...module,
                percentage: percentage,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                color: colors[index % colors.length]
            };
            currentAngle += angle;
            return segment;
        });

        // Build conic-gradient
        let gradientStops = [];
        let angle = 0;
        segments.forEach(seg => {
            const endAngle = angle + (seg.minutes / totalMinutes) * 360;
            gradientStops.push(`${seg.color} ${angle}deg ${endAngle}deg`);
            angle = endAngle;
        });
        const gradientString = `conic-gradient(${gradientStops.join(', ')})`;

        // Render pie chart with legend (vertical layout for compact width)
        const legendHTML = segments.map(seg => `
            <div class="progress-item">
                <div class="progress-label" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <span class="pie-legend-dot" style="background: ${seg.color};"></span>
                        ${seg.display_name}
                    </span>
                    <span class="pie-legend-value" style="padding-left: 20px; font-size: 0.85em; opacity: 0.8;">${Math.round(seg.minutes)}min (${seg.percentage.toFixed(0)}%)</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="pie-chart-container">
                <div class="pie-chart" style="background: ${gradientString};">
                    <div class="pie-chart-center">
                        <div class="pie-total">${Math.round(totalMinutes)}</div>
                        <div class="pie-label">minutes</div>
                    </div>
                </div>
                <div class="pie-legend">
                    ${legendHTML}
                </div>
            </div>
        `;
        
        console.log('[SUCCESS] Today\'s modules pie chart rendered:', modules.length, 'modules');
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
                if (window.Utils) {
                    Utils.showNotification('Report generated successfully!', 'success');
                } else {
                    alert('Report generated successfully!');
                }
                console.log('Report URL:', data.download_url);
            } else {
                if (window.Utils) {
                    Utils.showNotification('Failed to generate report', 'error');
                } else {
                    alert('Failed to generate report');
                }
            }

        } catch (error) {
            console.error('Export error:', error);
            if (window.Utils) {
                Utils.showNotification('Export failed: ' + error.message, 'error');
            } else {
                alert('Export failed: ' + error.message);
            }
        }
    }
}

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new LearningDashboard();
    console.log('Learning Dashboard initialized');
});