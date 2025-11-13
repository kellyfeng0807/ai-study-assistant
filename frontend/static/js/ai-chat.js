/**
 * AI Chat Float Window with Session Management
 * A collapsible floating chat window for AI assistant interactions
 */

class AIChatFloat {
    constructor() {
        this.isExpanded = false;
        this.sessions = [];
        this.currentSessionId = null;
        this.isTyping = false;
        this.init();
    }
    
    init() {
        this.createFloatWindow();
        this.bindEvents();
        this.loadSessions();
        
        if (this.sessions.length === 0 || !this.currentSessionId) {
            this.createNewSession();
        } else {
            this.renderMessages();
        }
    }
    
    get currentSession() {
        return this.sessions.find(s => s.id === this.currentSessionId);
    }
    
    get messages() {
        return this.currentSession ? this.currentSession.messages : [];
    }
    
    createFloatWindow() {
        const floatHTML = `
            <div class="ai-chat-float collapsed" id="aiChatFloat">
                <!-- Toggle Button (visible when collapsed) -->
                <button class="chat-toggle-btn" id="chatToggleBtn">
                    <i class="fas fa-comment-dots"></i>
                    <span class="notification-badge" id="chatNotificationBadge" style="display: none;"></span>
                </button>
                
                <!-- Chat Window (visible when expanded) -->
                <div class="chat-window">
                    <!-- Header -->
                    <div class="chat-header">
                        <div class="chat-header-left">
                            <div class="chat-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="chat-header-info">
                                <h3>AI Assistant</h3>
                                <p>Online</p>
                            </div>
                        </div>
                        <div class="chat-header-actions">
                            <button class="chat-action-btn" id="chatSessionsBtn" title="Manage Sessions">
                                <i class="fas fa-folder-open"></i>
                            </button>
                            <button class="chat-action-btn" id="chatNewSessionBtn" title="New Conversation">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="chat-action-btn" id="chatMinimizeBtn" title="Minimize">
                                <i class="fas fa-minus"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Messages -->
                    <div class="chat-messages" id="chatMessages">
                        <!-- Messages will be dynamically added here -->
                    </div>
                    
                    <!-- Input Area -->
                    <div class="chat-input-area">
                        <div class="chat-quick-actions" id="chatQuickActions">
                            <button class="quick-action-btn" data-action="explain">Explain this</button>
                            <button class="quick-action-btn" data-action="summarize">Summarize</button>
                            <button class="quick-action-btn" data-action="practice">Generate practice</button>
                        </div>
                        <div class="chat-input-wrapper">
                            <textarea 
                                class="chat-input" 
                                id="chatInput" 
                                placeholder="Ask me anything..."
                                rows="1"
                            ></textarea>
                            <button class="chat-send-btn" id="chatSendBtn">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', floatHTML);
    }
    
    bindEvents() {
        const toggleBtn = document.getElementById('chatToggleBtn');
        const minimizeBtn = document.getElementById('chatMinimizeBtn');
        const sessionsBtn = document.getElementById('chatSessionsBtn');
        const newSessionBtn = document.getElementById('chatNewSessionBtn');
        const sendBtn = document.getElementById('chatSendBtn');
        const input = document.getElementById('chatInput');
        const quickActions = document.querySelectorAll('.quick-action-btn');
        
        toggleBtn?.addEventListener('click', () => this.toggleChat());
        minimizeBtn?.addEventListener('click', () => this.toggleChat());
        sessionsBtn?.addEventListener('click', () => this.showSessionManager());
        newSessionBtn?.addEventListener('click', () => this.confirmNewSession());
        sendBtn?.addEventListener('click', () => this.sendMessage());
        
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        input?.addEventListener('input', () => this.autoResizeInput());
        
        quickActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });
    }
    
    toggleChat() {
        const chatFloat = document.getElementById('aiChatFloat');
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            chatFloat.classList.remove('collapsed');
            chatFloat.classList.add('expanded');
            document.getElementById('chatInput')?.focus();
            this.hideNotificationBadge();
        } else {
            chatFloat.classList.remove('expanded');
            chatFloat.classList.add('collapsed');
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addMessage(message, 'user');
        input.value = '';
        this.autoResizeInput();
        
        // Get AI response from backend
        this.showTyping();
        try {
            const conversationHistory = this.messages
                .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
                .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));

            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    history: conversationHistory
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            this.hideTyping();
            
            if (data.success) {
                this.addMessage(data.response, 'ai');
            } else {
                this.addMessage('Sorry, I encountered an error. Please try again.', 'ai');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTyping();
            this.addMessage('Sorry, I could not connect to the server. Please check your connection.', 'ai');
        }
    }
    
    addMessage(text, sender = 'ai') {
        if (!this.currentSession) return;
        
        const messagesContainer = document.getElementById('chatMessages');
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const formattedText = this.formatMessage(text);
        
        const messageHTML = `
            <div class="chat-message ${sender}">
                <div class="chat-message-avatar">
                    <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="chat-message-content">
                    <div class="chat-message-bubble">${formattedText}</div>
                    <div class="chat-message-time">${time}</div>
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.renderMath();
        this.scrollToBottom();
        
        this.currentSession.messages.push({ text, sender, time: new Date().toISOString() });
        this.currentSession.updatedAt = new Date().toISOString();
        this.saveSessions();
        
        // Show notification if window is collapsed
        if (!this.isExpanded && sender === 'ai') {
            this.showNotificationBadge();
        }
    }
    

    
    handleQuickAction(action) {
        const actions = {
            explain: "Can you explain this concept to me?",
            summarize: "Please summarize this for me.",
            practice: "Generate some practice questions for me."
        };
        
        const message = actions[action];
        if (message) {
            document.getElementById('chatInput').value = message;
            document.getElementById('chatInput').focus();
        }
    }
    
    showTyping() {
        const messagesContainer = document.getElementById('chatMessages');
        const typingHTML = `
            <div class="chat-message" id="typingIndicator">
                <div class="chat-message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="chat-message-content">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
        this.scrollToBottom();
        this.isTyping = true;
    }
    
    hideTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }
    
    loadWelcomeMessage() {
        setTimeout(() => {
            this.addMessage(
                "Hi! I'm your AI study assistant. I can help you understand concepts, create summaries, and generate practice questions. How can I help you today?",
                'ai'
            );
        }, 500);
    }
    
    autoResizeInput() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
    
    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    showNotificationBadge() {
        const badge = document.getElementById('chatNotificationBadge');
        if (badge) {
            badge.style.display = 'block';
        }
    }
    
    hideNotificationBadge() {
        const badge = document.getElementById('chatNotificationBadge');
        if (badge) {
            badge.style.display = 'none';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatMessage(text) {
        let formatted = this.escapeHtml(text);
        
        // Convert markdown-style bold
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // Convert markdown-style italic
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Convert code blocks
        formatted = formatted.replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>');
        formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Convert line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }
    
    renderMath() {
        if (window.MathJax) {
            MathJax.typesetPromise().catch((err) => console.log('MathJax error:', err));
        }
    }
    
    // Session Management Methods
    createNewSession() {
        const session = {
            id: Date.now().toString(),
            title: `Conversation ${this.sessions.length + 1}`,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.sessions.push(session);
        this.currentSessionId = session.id;
        this.saveSessions();
        this.renderMessages();
        this.loadWelcomeMessage();
        
        return session;
    }
    
    async confirmNewSession() {
        if (this.currentSession && this.currentSession.messages.length > 0) {
            const confirmed = await window.messageModal.confirm(
                'Start a new conversation? Current conversation will be saved.',
                'New Conversation',
                { confirmText: 'Start New', type: 'info' }
            );
            
            if (!confirmed) return;
        }
        
        this.createNewSession();
        window.messageModal.toast('New conversation started', 'success', 2000);
    }
    
    switchSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        this.currentSessionId = sessionId;
        this.renderMessages();
    }
    
    async deleteSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const confirmed = await window.messageModal.confirm(
            `Delete "${session.title}"? This cannot be undone.`,
            'Delete Conversation',
            { confirmText: 'Delete', danger: true }
        );
        
        if (!confirmed) return;
        
        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        
        if (this.currentSessionId === sessionId) {
            if (this.sessions.length === 0) {
                this.createNewSession();
            } else {
                this.currentSessionId = this.sessions[0].id;
                this.renderMessages();
            }
        }
        
        this.saveSessions();
        window.messageModal.toast('Conversation deleted', 'success', 2000);
    }
    
    async renameSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const newTitle = await window.messageModal.prompt(
            'Enter a new title for this conversation:',
            'Rename Conversation',
            session.title
        );
        
        if (newTitle && newTitle.trim()) {
            session.title = newTitle.trim();
            session.updatedAt = new Date().toISOString();
            this.saveSessions();
            window.messageModal.toast('Conversation renamed', 'success', 2000);
        }
    }
    
    async exportSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const content = this.formatSessionForExport(session);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.messageModal.toast('Conversation exported', 'success', 2000);
    }
    
    formatSessionForExport(session) {
        let content = `${session.title}\n`;
        content += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
        content += `Updated: ${new Date(session.updatedAt).toLocaleString()}\n`;
        content += `${'='.repeat(60)}\n\n`;
        
        session.messages.forEach(msg => {
            const timestamp = new Date(msg.time).toLocaleTimeString();
            const sender = msg.sender === 'user' ? 'You' : 'AI Assistant';
            content += `[${timestamp}] ${sender}:\n${msg.text}\n\n`;
        });
        
        return content;
    }
    
    showSessionManager() {
        const modal = document.createElement('div');
        modal.className = 'message-modal-overlay';
        
        const sessionsHTML = this.sessions
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .map(session => {
                const messageCount = session.messages.filter(m => m.sender !== 'system').length;
                const lastUpdate = new Date(session.updatedAt).toLocaleDateString();
                const isActive = session.id === this.currentSessionId;
                
                return `
                    <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                        <div class="session-info">
                            <div class="session-title">${this.escapeHtml(session.title)}</div>
                            <div class="session-meta">
                                <span><i class="fas fa-message"></i> ${messageCount} messages</span>
                                <span><i class="fas fa-clock"></i> ${lastUpdate}</span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="session-action-btn" data-action="switch" title="Open">
                                <i class="fas fa-folder-open"></i>
                            </button>
                            <button class="session-action-btn" data-action="rename" title="Rename">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="session-action-btn" data-action="export" title="Export">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="session-action-btn danger" data-action="delete" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        
        modal.innerHTML = `
            <div class="message-modal session-manager-modal">
                <div class="message-modal-header">
                    <div class="message-modal-icon info">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <div class="message-modal-title">
                        <h3>Manage Conversations</h3>
                    </div>
                    <button class="message-modal-close">&times;</button>
                </div>
                <div class="message-modal-body session-manager-body">
                    <div class="sessions-list">
                        ${sessionsHTML || '<p class="no-sessions">No conversations yet</p>'}
                    </div>
                </div>
                <div class="message-modal-footer">
                    <button class="message-modal-btn message-modal-btn-confirm" id="newSessionFromManager">
                        <i class="fas fa-plus"></i> New Conversation
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Bind events
        modal.querySelector('.message-modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.getElementById('newSessionFromManager')?.addEventListener('click', () => {
            modal.remove();
            this.confirmNewSession();
        });
        
        // Session item actions
        modal.querySelectorAll('.session-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const sessionId = btn.closest('.session-item').dataset.sessionId;
                
                if (action === 'switch') {
                    this.switchSession(sessionId);
                    modal.remove();
                    window.messageModal.toast('Conversation loaded', 'success', 2000);
                } else if (action === 'rename') {
                    await this.renameSession(sessionId);
                    modal.remove();
                    this.showSessionManager();
                } else if (action === 'export') {
                    await this.exportSession(sessionId);
                } else if (action === 'delete') {
                    await this.deleteSession(sessionId);
                    if (this.sessions.length === 0) {
                        modal.remove();
                    } else {
                        modal.remove();
                        this.showSessionManager();
                    }
                }
            });
        });
        
        // Click on session item to switch
        modal.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.session-action-btn')) {
                    const sessionId = item.dataset.sessionId;
                    this.switchSession(sessionId);
                    modal.remove();
                    window.messageModal.toast('Conversation loaded', 'success', 2000);
                }
            });
        });
    }
    
    renderMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = '';
        
        if (this.currentSession && this.currentSession.messages.length > 0) {
            this.currentSession.messages.forEach(msg => {
                const formattedText = this.formatMessage(msg.text);
                const time = new Date(msg.time).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const messageHTML = `
                    <div class="chat-message ${msg.sender}">
                        <div class="chat-message-avatar">
                            <i class="fas fa-${msg.sender === 'user' ? 'user' : 'robot'}"></i>
                        </div>
                        <div class="chat-message-content">
                            <div class="chat-message-bubble">${formattedText}</div>
                            <div class="chat-message-time">${time}</div>
                        </div>
                    </div>
                `;
                messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
            });
            
            this.renderMath();
        }
        
        this.scrollToBottom();
    }
    
    saveSessions() {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(this.sessions));
            localStorage.setItem('currentSessionId', this.currentSessionId);
        } catch (e) {
            console.log('Failed to save sessions:', e);
        }
    }
    
    loadSessions() {
        try {
            const saved = localStorage.getItem('chatSessions');
            const savedSessionId = localStorage.getItem('currentSessionId');
            
            if (saved) {
                this.sessions = JSON.parse(saved);
                
                if (savedSessionId && this.sessions.find(s => s.id === savedSessionId)) {
                    this.currentSessionId = savedSessionId;
                } else if (this.sessions.length > 0) {
                    this.currentSessionId = this.sessions[0].id;
                }
            }
        } catch (e) {
            console.log('Failed to load sessions:', e);
        }
    }
    
    showHistory() {
        this.showSessionManager();
    }
    
    confirmClearHistory() {
        this.showSessionManager();
    }
    
    saveHistory() {
        this.saveSessions();
    }
    
    loadHistory() {
        this.loadSessions();
    }
    
    clearChat() {
        if (this.currentSession) {
            this.currentSession.messages = [];
            this.currentSession.updatedAt = new Date().toISOString();
            this.saveSessions();
            this.renderMessages();
            this.loadWelcomeMessage();
        }
    }
    // Public API for external use
    sendAIMessage(message) {
        this.addMessage(message, 'ai');
    }
}

// Initialize AI Chat Float when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChatFloat();
    console.log('AI Chat Float initialized');
});
