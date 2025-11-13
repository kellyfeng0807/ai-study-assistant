/**
 * Custom Message Modal System
 * Replaces browser's alert, confirm, and prompt with custom styled modals
 */

class MessageModal {
    constructor() {
        this.toastContainer = null;
        this.init();
    }
    
    init() {
        // Create toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }
    
    /**
     * Show an alert modal
     * @param {string} message - The message to display
     * @param {string} title - The title of the modal
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     */
    alert(message, title = 'Notice', type = 'info') {
        return new Promise((resolve) => {
            const modal = this.createModal({
                type,
                title,
                message,
                showClose: true,
                buttons: [
                    {
                        text: 'OK',
                        className: 'message-modal-btn-confirm',
                        onClick: () => {
                            this.closeModal(modal);
                            resolve(true);
                        }
                    }
                ]
            });
            
            document.body.appendChild(modal);
        });
    }
    
    /**
     * Show a confirm modal
     * @param {string} message - The message to display
     * @param {string} title - The title of the modal
     * @param {object} options - Additional options
     */
    confirm(message, title = 'Confirm', options = {}) {
        return new Promise((resolve) => {
            const {
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                type = 'confirm',
                danger = false
            } = options;
            
            const modal = this.createModal({
                type,
                title,
                message,
                showClose: true,
                buttons: [
                    {
                        text: cancelText,
                        className: 'message-modal-btn-cancel',
                        onClick: () => {
                            this.closeModal(modal);
                            resolve(false);
                        }
                    },
                    {
                        text: confirmText,
                        className: `message-modal-btn-confirm ${danger ? 'danger' : ''}`,
                        onClick: () => {
                            this.closeModal(modal);
                            resolve(true);
                        }
                    }
                ]
            });
            
            document.body.appendChild(modal);
            
            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                    resolve(false);
                }
            });
        });
    }
    
    /**
     * Show a prompt modal
     * @param {string} message - The message to display
     * @param {string} title - The title of the modal
     * @param {string} defaultValue - Default input value
     */
    prompt(message, title = 'Input', defaultValue = '') {
        return new Promise((resolve) => {
            let inputValue = defaultValue;
            
            const modal = this.createModal({
                type: 'info',
                title,
                message,
                showClose: true,
                input: {
                    type: 'text',
                    value: defaultValue,
                    placeholder: 'Enter value...',
                    onChange: (value) => {
                        inputValue = value;
                    }
                },
                buttons: [
                    {
                        text: 'Cancel',
                        className: 'message-modal-btn-cancel',
                        onClick: () => {
                            this.closeModal(modal);
                            resolve(null);
                        }
                    },
                    {
                        text: 'OK',
                        className: 'message-modal-btn-confirm',
                        onClick: () => {
                            this.closeModal(modal);
                            resolve(inputValue);
                        }
                    }
                ]
            });
            
            document.body.appendChild(modal);
            
            // Focus input
            setTimeout(() => {
                const input = modal.querySelector('.message-modal-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 100);
            
            // Handle Enter key
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.closeModal(modal);
                    resolve(inputValue);
                } else if (e.key === 'Escape') {
                    this.closeModal(modal);
                    resolve(null);
                }
            });
            
            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                    resolve(null);
                }
            });
        });
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    toast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="toast-icon fas ${icons[type]}"></i>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `;
        
        this.toastContainer.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.closeToast(toast);
        });
        
        if (duration > 0) {
            setTimeout(() => {
                this.closeToast(toast);
            }, duration);
        }
        
        return toast;
    }
    
    /**
     * Create a modal element
     */
    createModal(config) {
        const overlay = document.createElement('div');
        overlay.className = 'message-modal-overlay';
        
        const icons = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-exclamation-circle',
            confirm: 'fa-question-circle'
        };
        
        const modal = document.createElement('div');
        modal.className = 'message-modal';
        
        let modalHTML = `
            <div class="message-modal-header">
                <div class="message-modal-icon ${config.type}">
                    <i class="fas ${icons[config.type]}"></i>
                </div>
                <div class="message-modal-title">
                    <h3>${this.escapeHtml(config.title)}</h3>
                </div>
                ${config.showClose ? '<button class="message-modal-close">&times;</button>' : ''}
            </div>
            <div class="message-modal-body">
                <p class="message-modal-text">${this.escapeHtml(config.message)}</p>
                ${config.input ? `<input type="${config.input.type}" class="message-modal-input" placeholder="${config.input.placeholder}" value="${this.escapeHtml(config.input.value)}">` : ''}
            </div>
        `;
        
        if (config.buttons && config.buttons.length > 0) {
            modalHTML += '<div class="message-modal-footer">';
            config.buttons.forEach(btn => {
                modalHTML += `<button class="message-modal-btn ${btn.className}">${this.escapeHtml(btn.text)}</button>`;
            });
            modalHTML += '</div>';
        }
        
        modal.innerHTML = modalHTML;
        overlay.appendChild(modal);
        
        // Bind button events
        if (config.buttons) {
            config.buttons.forEach((btn, index) => {
                const btnElement = modal.querySelectorAll('.message-modal-btn')[index];
                if (btnElement) {
                    btnElement.addEventListener('click', btn.onClick);
                }
            });
        }
        
        // Bind close button
        if (config.showClose) {
            const closeBtn = modal.querySelector('.message-modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeModal(overlay);
                    if (config.buttons && config.buttons[0]) {
                        config.buttons[0].onClick();
                    }
                });
            }
        }
        
        // Bind input change
        if (config.input) {
            const input = modal.querySelector('.message-modal-input');
            if (input) {
                input.addEventListener('input', (e) => {
                    config.input.onChange(e.target.value);
                });
            }
        }
        
        return overlay;
    }
    
    closeModal(modal) {
        modal.style.animation = 'fadeOut 200ms ease';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 200);
    }
    
    closeToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
window.messageModal = new MessageModal();

// Optional: Override native methods
// window.alert = (msg) => window.messageModal.alert(msg);
// window.confirm = (msg) => window.messageModal.confirm(msg);
