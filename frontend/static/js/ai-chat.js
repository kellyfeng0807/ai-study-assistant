/**
 * AI Chat Float Window
 * A collapsible floating chat window for AI assistant interactions
 */

class AIChatFloat {
    constructor() {
        this.isExpanded = false;
        this.messages = [];
        this.isTyping = false;
        this.init();
    }
    
    init() {
        this.createFloatWindow();
        this.bindEvents();
        this.loadWelcomeMessage();
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
        const sendBtn = document.getElementById('chatSendBtn');
        const input = document.getElementById('chatInput');
        const quickActions = document.querySelectorAll('.quick-action-btn');
        
        toggleBtn?.addEventListener('click', () => this.toggleChat());
        minimizeBtn?.addEventListener('click', () => this.toggleChat());
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
    
    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addMessage(message, 'user');
        input.value = '';
        this.autoResizeInput();
        
        // Simulate AI response
        this.showTyping();
        setTimeout(() => {
            this.hideTyping();
            this.addAIResponse(message);
        }, 1000 + Math.random() * 1000);
    }
    
    addMessage(text, sender = 'ai') {
        const messagesContainer = document.getElementById('chatMessages');
        const time = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const messageHTML = `
            <div class="chat-message ${sender}">
                <div class="chat-message-avatar">
                    <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="chat-message-content">
                    <div class="chat-message-bubble">${this.escapeHtml(text)}</div>
                    <div class="chat-message-time">${time}</div>
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
        
        this.messages.push({ text, sender, time });
        
        // Show notification if window is collapsed
        if (!this.isExpanded && sender === 'ai') {
            this.showNotificationBadge();
        }
    }
    
    addAIResponse(userMessage) {
        // Simulate AI response based on context
        const responses = {
            default: "I'm your AI study assistant! I can help you with notes, explain concepts, generate practice questions, and more. How can I assist you today?",
            explain: "I'd be happy to explain that concept for you. Could you provide more details about what you'd like me to explain?",
            summarize: "I can help you create a concise summary. Please share the content you'd like me to summarize.",
            practice: "Great! I can generate practice questions for you. What topic would you like to practice?",
            hello: "Hello! I'm here to help with your studies. What would you like to work on today?",
            help: "I can assist you with:\n• Explaining concepts\n• Summarizing notes\n• Generating practice questions\n• Creating mind maps\n• Analyzing your learning progress\n\nJust ask me anything!"
        };
        
        let response = responses.default;
        const lowerMessage = userMessage.toLowerCase();
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            response = responses.hello;
        } else if (lowerMessage.includes('help')) {
            response = responses.help;
        } else if (lowerMessage.includes('explain')) {
            response = responses.explain;
        } else if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
            response = responses.summarize;
        } else if (lowerMessage.includes('practice') || lowerMessage.includes('question')) {
            response = responses.practice;
        }
        
        this.addMessage(response, 'ai');
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
    
    // Public API for external use
    sendAIMessage(message) {
        this.addMessage(message, 'ai');
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        this.messages = [];
        this.loadWelcomeMessage();
    }
}

// Initialize AI Chat Float when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChatFloat();
    console.log('AI Chat Float initialized');
});
