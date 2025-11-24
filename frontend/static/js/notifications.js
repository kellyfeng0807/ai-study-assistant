/**
 * 统一通知系统
 * 管理所有页面的通知，支持已读/未读状态和详情查看
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.panel = null;
        this.button = null;
        this.badge = null;
        this.listContainer = null;
        this.init();
    }

    init() {
        this.panel = document.getElementById('notificationPanel');
        this.button = document.getElementById('notificationBtn');
        this.badge = this.button?.querySelector('.badge');
        this.listContainer = this.panel?.querySelector('.notification-list');

        if (!this.panel || !this.button) return;

        // 加载通知
        this.loadNotifications();

        // 绑定事件
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 打开/关闭通知面板
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });

        // 关闭按钮
        const closeBtn = this.panel.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closePanel();
            });
        }

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && !this.button.contains(e.target)) {
                this.closePanel();
            }
        });

        // 标记所有为已读按钮（可选）
        const markAllBtn = this.panel.querySelector('#markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
    }

    async loadNotifications() {
        try {
            // 从 localStorage 读取通知
            const stored = localStorage.getItem('notifications');
            if (stored) {
                this.notifications = JSON.parse(stored);
            } else {
                // 初始化默认通知
                this.notifications = this.getDefaultNotifications();
                this.saveNotifications();
            }

            this.renderNotifications();
            this.updateBadge();
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.notifications = this.getDefaultNotifications();
            this.renderNotifications();
        }
    }

    getDefaultNotifications() {
        return [
            {
                id: 'notif-1',
                title: 'Note Generation Complete',
                message: 'Your note "Machine Learning Basics" has been successfully generated with 5 key points.',
                time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                read: false,
                type: 'success',
                icon: 'fa-file-alt',
                link: '/note-assistant'
            },
            {
                id: 'notif-2',
                title: 'Daily Goal Achieved',
                message: 'Congratulations! You\'ve completed your daily study goal of 2 hours.',
                time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                read: false,
                type: 'success',
                icon: 'fa-trophy',
                link: '/dashboard'
            },
            {
                id: 'notif-3',
                title: '3 Errors Pending Review',
                message: 'You have 3 errors in your Error Book that need review. Don\'t forget to practice!',
                time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                read: false,
                type: 'warning',
                icon: 'fa-exclamation-circle',
                link: '/error-book'
            }
        ];
    }

    renderNotifications() {
        if (!this.listContainer) return;

        if (this.notifications.length === 0) {
            this.listContainer.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }

        this.listContainer.innerHTML = this.notifications
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .map(notif => this.renderNotificationItem(notif))
            .join('');

        // 绑定点击事件
        this.listContainer.querySelectorAll('.notification-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                const notifId = item.dataset.id;
                this.markAsRead(notifId);
                const notification = this.notifications.find(n => n.id === notifId);
                if (notification) {
                    this.showNotificationDetail(notification);
                }
            });
        });
    }

    renderNotificationItem(notif) {
        const timeAgo = this.getTimeAgo(notif.time);
        const unreadClass = notif.read ? '' : 'unread';
        const typeClass = notif.type || 'info';

        return `
            <div class="notification-item ${unreadClass}" data-id="${notif.id}">
                <div class="notification-icon ${typeClass}">
                    <i class="fas ${notif.icon}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${this.escapeHtml(notif.title)}</div>
                    <div class="notification-message">${this.escapeHtml(notif.message)}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                ${!notif.read ? '<div class="notification-dot"></div>' : ''}
            </div>
        `;
    }

    showNotificationDetail(notification) {
        // 使用 MessageModal 显示详情
        if (window.messageModal) {
            const iconMap = {
                'success': 'success',
                'warning': 'warning',
                'error': 'error',
                'info': 'info'
            };
            
            window.messageModal.alert(
                notification.message,
                notification.title,
                iconMap[notification.type] || 'info'
            );

            // 如果有链接，询问是否跳转
            if (notification.link) {
                setTimeout(async () => {
                    const goToLink = await window.messageModal.confirm(
                        `Do you want to go to ${notification.link.replace('/', '')}?`,
                        'Navigate',
                        { confirmText: 'Go', cancelText: 'Stay' }
                    );
                    if (goToLink) {
                        window.location.href = notification.link;
                    }
                }, 500);
            }
        }
    }

    markAsRead(notificationId) {
        const notif = this.notifications.find(n => n.id === notificationId);
        if (notif && !notif.read) {
            notif.read = true;
            this.saveNotifications();
            this.renderNotifications();
            this.updateBadge();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();
        if (window.messageModal) {
            window.messageModal.toast('All notifications marked as read', 'success', 2000);
        }
    }

    updateBadge() {
        if (!this.badge) return;
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            this.badge.textContent = unreadCount;
            this.badge.style.display = 'flex';
        } else {
            this.badge.style.display = 'none';
        }
    }

    addNotification(notification) {
        const newNotif = {
            id: `notif-${Date.now()}`,
            time: new Date().toISOString(),
            read: false,
            type: 'info',
            icon: 'fa-bell',
            ...notification
        };

        this.notifications.unshift(newNotif);
        this.saveNotifications();
        this.renderNotifications();
        this.updateBadge();

        // 显示 toast
        if (window.messageModal) {
            window.messageModal.toast(notification.title, notification.type || 'info', 3000);
        }
    }

    saveNotifications() {
        try {
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('Error saving notifications:', error);
        }
    }

    togglePanel() {
        if (this.panel.classList.contains('hidden')) {
            this.openPanel();
        } else {
            this.closePanel();
        }
    }

    openPanel() {
        this.panel.classList.remove('hidden');
    }

    closePanel() {
        this.panel.classList.add('hidden');
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000); // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
        return time.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化通知管理器
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager = new NotificationManager();
});
