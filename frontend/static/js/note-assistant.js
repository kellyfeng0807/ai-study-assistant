/**
 * Note Assistant - 基于原版修改，添加百度语音识别
 * 保留原有的文字生成笔记功能
 * 修改：录音后上传到后端使用百度API进行语音识别
 * 新增：View All 显示所有笔记
 * Time tracking now handled by module-tracker.js
 */

class NoteAssistantManager {
    constructor() {
        // 录音相关
        this.isRecording = false;
        this.recordingTime = 0;
        this.timerInterval = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.audioFileName = null;  
        this.currentEditingNoteId = null;
        this.allNotesData = null;  // 存储所有笔记数据，用于筛选
        this.uploadedFile = null;
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.bindTabSwitching();
        this.loadRecentNotes();
        console.log('Note Assistant initialized successfully');
    }
    
    bindTabSwitching() {
        // Tab switching logic (aligned with map-generation)
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }
    
    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }
    
    bindEventListeners() {
        const recordBtn = document.getElementById('recordBtn');
        const audioGenerateBtn = document.getElementById('audioGenerateBtn');
        const manualGenerateBtn = document.getElementById('manualGenerateBtn');
        
        // Upload area interaction
        const audioUploadArea = document.getElementById('audioUploadArea');
        const audioInput = document.getElementById('audioInput');
        const removeAudioBtn = document.getElementById('removeAudioBtn');
        const recordingControls = document.getElementById('recordingControls');
        const stopRecordBtn = document.getElementById('stopRecordBtn');
        
        // Upload area click to browse or record
        if (audioUploadArea) {
            // Upload area now only opens file browser (recording is handled by separate recording component)
            audioUploadArea.addEventListener('click', (e) => {
                if (e.target.closest('.remove-file-btn')) return;
                audioInput?.click();
            });
            
            // Drag and drop
            audioUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                audioUploadArea.classList.add('drag-over');
            });
            
            audioUploadArea.addEventListener('dragleave', () => {
                audioUploadArea.classList.remove('drag-over');
            });
            
            audioUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                audioUploadArea.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files).filter(file => 
                    file.type.startsWith('audio/')
                );
                
                if (files.length > 0) {
                    this.handleAudioFile(files[0]);
                }
            });
        }
        
        // File input change
        if (audioInput) {
            audioInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleAudioFile(file);
                }
            });
        }
        
        // Remove audio button
        if (removeAudioBtn) {
            removeAudioBtn.addEventListener('click', () => {
                this.clearAudioFile();
            });
        }
        
        // Recording controls
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording());
        }
        
        if (stopRecordBtn) {
            stopRecordBtn.addEventListener('click', () => {
                this.stopRecording();
                // Recording component stays visible - no hiding
            });
        }
        
        // Generate button (unified for transcribe + generate)
        if (audioGenerateBtn) {
            audioGenerateBtn.addEventListener('click', () => this.handleAudioGenerate());
        }
        
        // Text input generate button
        if (manualGenerateBtn) {
            manualGenerateBtn.addEventListener('click', () => this.generateNoteFromManualInput());
        }
        
        const viewAllBtn = document.querySelector('.section-header .link-button');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAllNotesModal();
            });
        }

        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        const removeFileBtn = document.getElementById('removeFileBtn');
        const fileGenerateBtn = document.getElementById('fileGenerateBtn');
        
        // 文件上传区域点击
        if (fileUploadArea) {
            fileUploadArea.addEventListener('click', (e) => {
                if (e.target.closest('.remove-file-btn')) return;
                fileInput?.click();
            });
            
            // 拖拽上传
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('drag-over');
            });
            
            fileUploadArea.addEventListener('dragleave', () => {
                fileUploadArea.classList.remove('drag-over');
            });
            
            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });
        }
        
        // 文件选择
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileUpload(file);
                }
            });
        }
        
        // 移除文件
        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', () => {
                this.clearUploadedFile();
            });
        }
        
        // 生成笔记按钮
        if (fileGenerateBtn) {
            fileGenerateBtn.addEventListener('click', () => this.generateNoteFromFile());
        }
    }
    
    // ========== 文件上传相关方法 (NEW) ==========
    handleFileUpload(file) {
        // 验证文件类型
        const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'txt', 'md'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExt)) {
            window.messageModal?.toast(`Unsupported file type: ${fileExt}. Allowed: ${allowedTypes.join(', ')}`, 'error', 3000);
            return;
        }
        
        // 验证文件大小 (最大 10MB)
        if (file.size > 10 * 1024 * 1024) {
            window.messageModal?.toast('File too large. Maximum size is 10MB.', 'error', 3000);
            return;
        }
        
        this.uploadedFile = file;
        
        // 更新UI显示
        const filePlaceholder = document.getElementById('filePlaceholder');
        const filePreview = document.getElementById('filePreview');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const fileTypeIcon = document.getElementById('fileTypeIcon');
        const fileGenerateBtn = document.getElementById('fileGenerateBtn');
        
        if (filePlaceholder) filePlaceholder.style.display = 'none';
        if (filePreview) filePreview.style.display = 'flex';
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
        
        // 根据文件类型设置图标
        if (fileTypeIcon) {
            const iconMap = {
                'pdf': 'fa-file-pdf',
                'png': 'fa-file-image',
                'jpg': 'fa-file-image',
                'jpeg': 'fa-file-image',
                'gif': 'fa-file-image',
                'bmp': 'fa-file-image',
                'txt': 'fa-file-alt',
                'md': 'fa-file-alt'
            };
            fileTypeIcon.className = `fas ${iconMap[fileExt] || 'fa-file'}`;
        }
        
        // 启用生成按钮
        if (fileGenerateBtn) {
            fileGenerateBtn.disabled = false;
        }
        
        console.log(`File selected: ${file.name} (${this.formatFileSize(file.size)})`);
    }
    
    clearUploadedFile() {
        this.uploadedFile = null;
        
        // 重置UI
        const filePlaceholder = document.getElementById('filePlaceholder');
        const filePreview = document.getElementById('filePreview');
        const fileInput = document.getElementById('fileInput');
        const fileGenerateBtn = document.getElementById('fileGenerateBtn');
        
        if (filePlaceholder) filePlaceholder.style.display = 'flex';
        if (filePreview) filePreview.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (fileGenerateBtn) fileGenerateBtn.disabled = true;
        
        console.log('Uploaded file cleared');
    }
    
    async generateNoteFromFile() {
        if (!this.uploadedFile) {
            window.messageModal?.toast('Please upload a file first', 'warning', 3000);
            return;
        }
        
        const fileGenerateBtn = document.getElementById('fileGenerateBtn');
        const subject = document.getElementById('fileSubjectSelect')?.value || '';
        
        try {
            // 显示加载状态
            if (fileGenerateBtn) {
                fileGenerateBtn.disabled = true;
                fileGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }
            
            window.messageModal?.toast('Extracting text and generating notes...', 'info', 5000);
            
            // 准备表单数据
            const formData = new FormData();
            formData.append('file', this.uploadedFile);
            if (subject) {
                formData.append('subject', subject);
            }
            
            // 发送请求
            const response = await fetch(window.getApiUrl('/api/note/upload-file'), {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.messageModal?.toast('Note generated successfully!', 'success', 3000);
                
                // 显示生成的笔记
                if (result.note) {
                    this.showNoteDetailModal(result.note);
                }
                
                // 刷新笔记列表
                this.loadRecentNotes();
                
                // 清除上传的文件
                this.clearUploadedFile();
            } else {
                throw new Error(result.error || 'Failed to generate note');
            }
            
        } catch (error) {
            console.error('File upload note generation failed:', error);
            window.messageModal?.toast('Generation failed: ' + error.message, 'error', 4000);
        } finally {
            // 恢复按钮状态
            if (fileGenerateBtn) {
                fileGenerateBtn.disabled = !this.uploadedFile;
                fileGenerateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Note from File';
            }
        }
    }
    
    
    handleAudioFile(file = null) {
        if (file) {
            this.audioBlob = file;
            this.audioFileName = file.name;
        } else {
            this.audioBlob = null;
            this.audioFileName = null;
        }
        
        // Show file preview
        const audioPreview = document.getElementById('audioPreview');
        const audioFilesList = document.getElementById('audioFilesList');
        const audioUploadArea = document.getElementById('audioUploadArea');
        const uploadPlaceholder = audioUploadArea?.querySelector('.upload-placeholder');
        
        if (audioFilesList) {
            audioFilesList.innerHTML = `
                <div class="file-item">
                    <i class="fas fa-file-audio file-icon"></i>
                    <div class="file-info">
                        <div class="file-name">${this.audioFileName || '录音文件'}</div>
                        <div class="file-size">${this.formatFileSize(this.audioBlob?.size || 0)}</div>
                    </div>
                </div>
            `;
        }
        
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (audioPreview) audioPreview.style.display = 'block';
        
        // Enable generate button
        const audioGenerateBtn = document.getElementById('audioGenerateBtn');
        if (audioGenerateBtn) {
            audioGenerateBtn.disabled = false;
            audioGenerateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Note with AI';
        }
    }
    
    clearAudioFile() {
        this.handleAudioFile();
        
        // Reset file input
        const audioInput = document.getElementById('audioInput');
        if (audioInput) audioInput.value = '';
        
        // Disable generate button
        const audioGenerateBtn = document.getElementById('audioGenerateBtn');
        if (audioGenerateBtn) {
            audioGenerateBtn.disabled = true;
            audioGenerateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Note with AI';
        }
    }
    
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    async handleAudioGenerate() {
        if (!this.audioBlob) return;
        
        const audioGenerateBtn = document.getElementById('audioGenerateBtn');
        
        try {
            // Step 1: Transcribe audio
            Utils.showLoadingState(audioGenerateBtn, 'Transcribing audio...');
            
            const formData = new FormData();
            formData.append('audio', this.audioBlob, this.audioFileName || 'recording.webm');
            
            const transcribeResponse = await fetch('/api/note/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!transcribeResponse.ok) {
                throw new Error('Transcription failed');
            }
            
            const transcribeResult = await transcribeResponse.json();
            
            if (!transcribeResult.success) {
                throw new Error(transcribeResult.message || 'Transcription failed');
            }
            
            const recognizedText = transcribeResult.text;
            
            // Step 2: Generate note
            Utils.showLoadingState(audioGenerateBtn, 'Generating note...');
            
            const generateResponse = await fetch('/api/note/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    context: recognizedText
                })
            });
            
            if (!generateResponse.ok) {
                throw new Error('Note generation failed');
            }
            
            const generateResult = await generateResponse.json();
            
            if (!generateResult.success) {
                throw new Error(generateResult.message || 'Note generation failed');
            }
            
            Utils.showNotification('Note generated successfully!', 'success');
            
            // Display note (backend already persisted it)
            this.displayGeneratedNote(generateResult.note.content);
            this.loadRecentNotes();
            
            // Clear audio
            this.clearAudioFile();
            
        } catch (error) {
            console.error('Audio generation error:', error);
            Utils.showNotification(error.message || 'Failed to generate note from audio', 'error');
        } finally {
            Utils.hideLoadingState(audioGenerateBtn);
        }
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.audioFileName = 'recording.webm'; 
                console.log('record complete, size:', this.audioBlob.size, 'bytes');
                
                // Show file preview using same logic as uploaded files
                this.handleAudioFile(this.audioBlob);
                
                Utils.showNotification('Recording complete!', 'success');
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingTime = 0;
            
            this.updateRecordingUI();
            this.startTimer();
            
            Utils.showNotification('Start recording...', 'success');
            
        } catch (error) {
            console.error('Recording failed:', error);
            Utils.showNotification('Unable to access microphone: ' + error.message, 'error');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.isRecording = false;
        this.stopTimer();
        this.updateRecordingUI();
    }
    
    async handleTranscribeOrGenerate() {
        if (this.audioBlob) {
            await this.transcribeAudio();
        } else {
            const textarea = document.getElementById('manualTextInput');
            if (textarea && textarea.value.trim()) {
                await this.generateNoteFromManualInput();
            } else {
                Utils.showNotification('Please record or enter text first', 'warning');
            }
        }
    }
    
    async transcribeAudio() {
        if (!this.audioBlob) {
            Utils.showNotification('Please record audio first', 'warning');
            return;
        }
        
        try {
            console.log('Start uploading audio...');
            Utils.showNotification('Uploading audio...', 'info');

            const formData = new FormData();
            
            const fileName = this.audioFileName || 'recording.webm';
            formData.append('audio', this.audioBlob, fileName);
            
            console.log('Uploading file:', fileName);
            
            const transcribeBtn = document.getElementById('transcribeBtn');
            Utils.showLoadingState(transcribeBtn, 'recognizing...');
            
            const response = await fetch(window.getApiUrl('/api/note/transcribe'), {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('Recognition successful:', data.text);

                this.fillTextToInputBox(data.text);

                Utils.showNotification(`Recognition successful! Total ${data.length} characters`, 'success');

                this.audioBlob = null;
                this.audioChunks = [];

                Utils.hideLoadingState(transcribeBtn);
                
            } else {
                throw new Error(data.error || 'Recognition failed');
            }
            
        } catch (error) {
            console.error('Recognition failed:', error);
            Utils.showNotification('Recognition failed: ' + error.message, 'error');
            
            const transcribeBtn = document.getElementById('transcribeBtn');
            Utils.hideLoadingState(transcribeBtn);
        }
    }
    
    fillTextToInputBox(text) {
        if (!text) return;
        
        const textarea = document.getElementById('manualTextInput');
        if (textarea) {
            textarea.value = text;
            
            const counter = document.getElementById('textCounter');
            if (counter) {
                const count = text.trim().length;
                counter.textContent = count + ' characters';

                if (count < 10) {
                    counter.style.color = 'hsl(var(--muted-foreground))';
                } else if (count < 50) {
                    counter.style.color = 'hsl(45 93% 47%)';
                } else {
                    counter.style.color = 'hsl(142 76% 36%)';
                }
            }
            
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            textarea.style.transition = 'background-color 0.3s';
            textarea.style.backgroundColor = '#d4edda';
            setTimeout(() => {
                textarea.style.backgroundColor = '';
            }, 800);
            
            console.log('Text has been filled into the input box');
        }
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            this.recordingTime++;
            this.updateTimeDisplay();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimeDisplay() {
        const minutes = Math.floor(this.recordingTime / 60);
        const seconds = this.recordingTime % 60;
        const timeDisplay = document.querySelector('.recording-time');
        if (timeDisplay) {
            timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }
    
    updateRecordingUI() {
        const recordBtn = document.getElementById('recordBtn');
        const statusDisplay = document.querySelector('.recording-status');
        
        if (this.isRecording) {
            recordBtn.classList.add('recording');
            if (statusDisplay) {
                statusDisplay.textContent = 'Recording...';
            }
        } else {
            recordBtn.classList.remove('recording');
            if (statusDisplay) {
                statusDisplay.textContent = this.audioBlob ? 'Recording complete' : 'Ready to record';
            }
        }
        
        const transcribeBtn = document.getElementById('transcribeBtn');
        if (transcribeBtn) {
            transcribeBtn.disabled = this.isRecording || !this.audioBlob;
        }
    }
    
    uploadAudio() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            console.log('Selected audio file:', file.name);

            this.audioBlob = file;
            this.audioFileName = file.name;  
            
            const transcribeBtn = document.getElementById('transcribeBtn');
            if (transcribeBtn) {
                transcribeBtn.disabled = false;
                transcribeBtn.innerHTML = '<i class="fas fa-file-alt"></i> Convert to Text';
            }

            Utils.showNotification(`File selected: ${file.name}`, 'success');
        };
        
        input.click();
    }
    
    async generateNoteFromManualInput() {
        const textarea = document.getElementById('manualTextInput');
        
        if (!textarea) {
            console.error('Text input box not found');
            return;
        }
        
        const text = textarea.value.trim();
        
        if (!text) {
            window.messageModal.alert('Please enter some content', 'Input Required', 'warning');
            textarea.focus();
            return;
        }
        
        if (text.length < 10) {
            window.messageModal.alert('Entered content is too short, please input at least 10 characters', 'Input Too Short', 'warning');
            textarea.focus();
            return;
        }
        
        try {
            console.log('Start generating note');
            const manualGenerateBtn = document.getElementById('manualGenerateBtn');
            Utils.showLoadingState(manualGenerateBtn, 'Generating...');

            const result = await this.callGenerateAPI(text);

            if (result && result.success) {
                console.log('Note generated successfully');
                Utils.showNotification('Note generated successfully!', 'success');

                // Backend returns 'note' (with 'content' field), displayGeneratedNote expects the content
                this.displayGeneratedNote(result.note.content);

                textarea.value = '';
                const counter = document.getElementById('textCounter');
                if (counter) {
                    counter.textContent = '0 character';
                    counter.style.color = 'hsl(var(--muted-foreground))';
                }

                setTimeout(() => this.loadRecentNotes(), 500);
                Utils.hideLoadingState(manualGenerateBtn);
            } else {
                Utils.hideLoadingState(manualGenerateBtn);
                throw new Error(result?.error || 'Note generation failed');
            }

        } catch (error) {
            console.error('Note generation failed:', error);
            Utils.hideLoadingState(document.getElementById('manualGenerateBtn'));
            Utils.showNotification('Note generation failed: ' + error.message, 'error');
        }
    }

    async callGenerateAPI(text, subject = 'General') {
        try {
            const response = await fetch(window.getApiUrl('/api/note/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    subject: subject
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }
    
    displayGeneratedNote(noteData) {
        const modal = document.createElement('div');
        modal.className = 'note-modal';
        modal.innerHTML = `
            <div class="note-modal-content">
                <div class="note-modal-header">
                    <h3>${noteData.title || 'Generated Note'}</h3>
                    <button class="close-button" onclick="this.closest('.note-modal').remove()">×</button>
                </div>
                <div class="note-modal-body">
                    <div class="note-section">
                        <h4>Subject</h4>
                        <p>${noteData.subject}</p>
                    </div>
                    
                    <div class="note-section">
                        <h4>Key Points</h4>
                        <ul>
                            ${noteData.key_points.map(point => `<li>${point}</li>`).join('')}
                        </ul>
                    </div>
                    
                    ${noteData.examples && noteData.examples.length > 0 ? `
                    <div class="note-section">
                        <h4>Example</h4>
                        <ul>
                            ${noteData.examples.map(example => `<li>${example}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <div class="note-section">
                        <h4>Summary</h4>
                        <p>${noteData.summary}</p>
                    </div>
                    
                    ${noteData.tags && noteData.tags.length > 0 ? `
                    <div class="note-section">
                        <h4>Labels</h4>
                        <div class="note-tags">
                            ${noteData.tags.map(tag => `<span class="note-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Render MathJax formulas: if MathJax not present, inject it then typeset
        const typesetMathIn = async (el) => {
            try {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    await window.MathJax.typesetPromise([el]);
                }
            } catch (err) {
                console.warn('MathJax rendering error:', err);
            }
        };

        if (!window.MathJax) {
            // Inject MathJax config + script then typeset
            const scriptConfig = document.createElement('script');
            scriptConfig.type = 'text/javascript';
            scriptConfig.text = `MathJax = { tex: { inlineMath: [['$','$'], ['\\(','\\)']], displayMath: [['$$','$$'], ['\\[','\\]']], processEscapes: true }, options: { skipHtmlTags: ['script','noscript','style','textarea','pre'] } };`;
            document.head.appendChild(scriptConfig);

            const mjScript = document.createElement('script');
            mjScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
            mjScript.async = true;
            mjScript.onload = () => typesetMathIn(modal);
            mjScript.onerror = (e) => console.warn('Failed to load MathJax', e);
            document.head.appendChild(mjScript);
        } else {
            // MathJax already present
            typesetMathIn(modal);
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    showNoteDetailModal(note) {
        const noteData = note.content || note;
        this.displayGeneratedNote(noteData);
    }

    async loadRecentNotes() {
        try {
            const response = await fetch(window.getApiUrl('/api/note/list?limit=10'));
            const data = await response.json();
            
            if (data.success && data.notes && data.notes.length > 0) {
                console.log('Already loaded', data.notes.length, 'notes');
                this.renderNoteCards(data.notes);
            } else {
                console.log('no notes found');
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Failed to load the notes:', error);
        }
    }
    
    renderNoteCards(notes) {
        const notesGrid = document.querySelector('.notes-grid');
        if (!notesGrid) return;

        notesGrid.innerHTML = '';

        const displayNotes = notes.slice(0, 3);

        displayNotes.forEach(note => {
            const card = this.createNoteCard(note);
            notesGrid.appendChild(card);
        });

        console.log(`Already rendered ${displayNotes.length} note cards`);
    }
    
    createNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card';

        const date = note.date || new Date().toISOString().split('T')[0];
        const formattedDate = this.formatDate(date);

        const keyPointsCount = note.key_points_count || 0;

        card.innerHTML = `
            <div class="note-header">
                <span class="note-subject">${note.subject || 'General'}</span>
                <span class="note-date">${formattedDate}</span>
            </div>
            <h4 class="note-title">${note.title || 'Untitled Note'}</h4>
            <p class="note-excerpt">${note.preview || 'No preview available'}</p>
            <div class="note-footer">
                <span class="note-meta">${keyPointsCount} Key Points</span>
                <div class="note-actions">
                    <button class="button-outline" onclick="noteManager.viewNoteDetail(${note.id})">View</button>
                    <button class="button-outline edit-button" onclick="noteManager.editNote(${note.id})">Edit</button>
                    <button class="button-outline delete-button" onclick="noteManager.deleteNote(${note.id})">Delete</button>
                </div>
            </div>
        `;

        return card;
    }
    
    async deleteNote(noteId) {
        const confirmed = await window.messageModal.confirm(
            'Are you sure you want to delete this note?',
            'Delete Confirmation',
            { confirmText: 'Delete', cancelText: 'Cancel', danger: true }
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/note/${noteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                Utils.showNotification('Note deleted successfully', 'success');
                this.loadRecentNotes(); // Refresh notes
            } else {
                const error = await response.json();
                Utils.showNotification(`Failed to delete note: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            Utils.showNotification('Error deleting note', 'error');
        }
    }
    
    // Ensure notifications use the same logic as map-generation.js
    showNotification(message, type) {
        Utils.showNotification(message, type);
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    }
    
    showEmptyState() {
        const notesGrid = document.querySelector('.notes-grid');
        if (notesGrid) {
            notesGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
                    <i class="fas fa-file-alt" style="font-size: 48px; color: hsl(var(--muted-foreground)); margin-bottom: 16px;"></i>
                    <h3 style="color: hsl(var(--foreground)); margin-bottom: 8px;">No Notes Yet</h3>
                    <p style="color: hsl(var(--muted-foreground));">Start by recording audio or entering text to generate your first note!</p>
                </div>
            `;
        }
    }
    

    async viewNoteDetail(noteId) {
        try {
            const response = await fetch(window.getApiUrl(`/api/note/${noteId}`));
            const data = await response.json();
            
            if (data.success && data.note) {
                this.displayGeneratedNote(data.note.content);
            } else {
                Utils.showNotification('Failed to load note', 'error');
            }
        } catch (error) {
            console.error('Failed to load note:', error);
            Utils.showNotification('Failed to load note: ' + error.message, 'error');
        }
    }
    

    // 显示所有笔记的模态框（带学科筛选）
    async showAllNotesModal() {
        try {
            // Fetch all notes
            const response = await fetch(window.getApiUrl('/api/note/list?limit=100'));
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch notes');
            }
            
            this.allNotesData = data.notes || [];
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'note-modal all-notes-modal';
            modal.innerHTML = `
                <div class="note-modal-content" style="max-width: 900px; max-height: 85vh;">
                    <div class="note-modal-header">
                        <h3>All Notes (${this.allNotesData.length})</h3>
                        <button class="close-button" onclick="this.closest('.note-modal').remove()">×</button>
                    </div>
                    <div class="notes-filter" style="padding: 16px 24px; border-bottom: 1px solid hsl(var(--border)); display: flex; gap: 12px; flex-wrap: wrap;">
                        <select id="subjectFilter" style="padding: 8px 12px; border-radius: 6px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--foreground));">
                            <option value="">All Subjects</option>
                        </select>
                        <input type="text" id="searchFilter" placeholder="Search notes..." style="flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 6px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--foreground));">
                    </div>
                    <div class="note-modal-body" style="max-height: 60vh; overflow-y: auto; padding: 16px 24px;">
                        <div class="all-notes-grid" id="allNotesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                            <!-- Notes will be rendered here -->
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Populate subject filter
            const subjects = [...new Set(this.allNotesData.map(n => n.subject).filter(Boolean))];
            const subjectFilter = modal.querySelector('#subjectFilter');
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                subjectFilter.appendChild(option);
            });
            
            // Render notes
            this.renderAllNotesInModal(this.allNotesData, modal);
            
            // Add filter event listeners
            subjectFilter.addEventListener('change', () => this.filterNotes(modal));
            modal.querySelector('#searchFilter').addEventListener('input', () => this.filterNotes(modal));
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
        } catch (error) {
            console.error('Failed to show all notes:', error);
            Utils.showNotification('Failed to load notes: ' + error.message, 'error');
        }
    }
    
    filterNotes(modal) {
        const subjectFilter = modal.querySelector('#subjectFilter').value;
        const searchFilter = modal.querySelector('#searchFilter').value.toLowerCase();
        
        let filtered = this.allNotesData;
        
        if (subjectFilter) {
            filtered = filtered.filter(n => n.subject === subjectFilter);
        }
        
        if (searchFilter) {
            filtered = filtered.filter(n => 
                (n.title || '').toLowerCase().includes(searchFilter) ||
                (n.preview || '').toLowerCase().includes(searchFilter)
            );
        }
        
        this.renderAllNotesInModal(filtered, modal);
    }
    
    renderAllNotesInModal(notes, modal) {
        const grid = modal.querySelector('#allNotesGrid');
        
        if (notes.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                    <i class="fas fa-search" style="font-size: 32px; margin-bottom: 12px;"></i>
                    <p>No notes found</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = notes.map(note => this.createAllNotesCardHTML(note)).join('');
        
        // Add click events
        grid.querySelectorAll('.view-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const noteId = btn.dataset.id;
                modal.remove();
                this.viewNoteDetail(noteId);
            });
        });
        
        grid.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const noteId = btn.dataset.id;
                modal.remove();
                this.editNote(noteId);
            });
        });
        
        grid.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const noteId = btn.dataset.id;
                await this.deleteNote(noteId);
                // Refresh modal
                modal.remove();
                this.showAllNotesModal();
            });
        });
    }
    
    createAllNotesCardHTML(note) {
        const date = note.date || new Date().toISOString().split('T')[0];
        const formattedDate = this.formatDate(date);
        const keyPointsCount = note.key_points_count || 0;

        return `
            <div class="note-card" style="background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 12px; color: hsl(var(--primary)); font-weight: 500;">${note.subject || 'General'}</span>
                    <span style="font-size: 12px; color: hsl(var(--muted-foreground));">${formattedDate}</span>
                </div>
                <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: hsl(var(--foreground));">${note.title || 'Untitled Note'}</h4>
                <p style="font-size: 13px; color: hsl(var(--muted-foreground)); margin: 8px 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${note.preview || 'No preview available'}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid hsl(var(--border));">
                    <span style="font-size: 12px; color: hsl(var(--muted-foreground));">
                        ${keyPointsCount} Key Points
                    </span>
                    <div style="display: flex; gap: 8px;">
                        <button class="view-note-btn" data-id="${note.id}" style="
                            background: transparent;
                            border: 1px solid hsl(var(--border));
                            color: hsl(var(--foreground));
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">View</button>
                        <button class="edit-note-btn" data-id="${note.id}" style="
                            background: transparent;
                            border: 1px solid hsl(var(--border));
                            color: hsl(var(--foreground));
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">Edit</button>
                        <button class="delete-note-btn" data-id="${note.id}" style="
                            background: hsl(var(--primary));
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                            transition: all 0.2s;
                        ">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render all notes in the grid (without limit) - 保留原有方法以防其他地方调用
    renderAllNoteCards(notes) {
        const notesGrid = document.querySelector('.notes-grid');
        if (!notesGrid) return;

        notesGrid.innerHTML = '';

        notes.forEach(note => {
            const card = this.createNoteCard(note);
            notesGrid.appendChild(card);
        });

        console.log(`Rendered all ${notes.length} note cards`);
    }
    
    // Open note in edit mode
    async editNote(noteId) {
        try {
            const response = await fetch(window.getApiUrl(`/api/note/${noteId}`));
            const data = await response.json();
            
            if (data.success && data.note) {
                this.showEditNoteModal(data.note);
            } else {
                Utils.showNotification('Failed to load note for editing', 'error');
            }
        } catch (error) {
            console.error('Failed to load note for editing:', error);
            Utils.showNotification('Load failed: ' + error.message, 'error');
        }
    }
    
    // Show edit modal for a note
    showEditNoteModal(note) {
        this.currentEditingNoteId = note.id;
        const noteData = note.content || {};
        
        const modal = document.createElement('div');
        modal.className = 'note-modal edit-note-modal';
        modal.innerHTML = `
            <div class="note-modal-content" style="max-width: 700px;">
                <div class="note-modal-header">
                    <h3>Edit Note</h3>
                    <button class="close-button" onclick="this.closest('.note-modal').remove()">×</button>
                </div>
                <div class="note-modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <div class="edit-field">
                        <label>Title</label>
                        <input type="text" id="editNoteTitle" value="${noteData.title || ''}" class="edit-input">
                    </div>
                    
                    <div class="edit-field">
                        <label>Subject</label>
                        <input type="text" id="editNoteSubject" value="${noteData.subject || ''}" class="edit-input">
                    </div>
                    
                    <div class="edit-field">
                        <label>Key Points (one per line)</label>
                        <textarea id="editNoteKeyPoints" class="edit-textarea" rows="5">${(noteData.key_points || []).join('\n')}</textarea>
                    </div>
                    
                    <div class="edit-field">
                        <label>Examples (one per line)</label>
                        <textarea id="editNoteExamples" class="edit-textarea" rows="3">${(noteData.examples || []).join('\n')}</textarea>
                    </div>
                    
                    <div class="edit-field">
                        <label>Summary</label>
                        <textarea id="editNoteSummary" class="edit-textarea" rows="3">${noteData.summary || ''}</textarea>
                    </div>
                    
                    <div class="edit-field">
                        <label>Tags (comma separated)</label>
                        <input type="text" id="editNoteTags" value="${(noteData.tags || []).join(', ')}" class="edit-input">
                    </div>
                </div>
                <div class="note-modal-footer" style="display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid hsl(var(--border));">
                    <button class="button-outline" onclick="this.closest('.note-modal').remove()">Cancel</button>
                    <button class="button-primary" id="saveNoteBtn">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add save button event listener
        modal.querySelector('#saveNoteBtn').addEventListener('click', () => {
            this.saveNoteChanges(note.id, modal);
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // Save note changes to backend
    async saveNoteChanges(noteId, modal) {
        const title = modal.querySelector('#editNoteTitle').value.trim();
        const subject = modal.querySelector('#editNoteSubject').value.trim();
        const keyPoints = modal.querySelector('#editNoteKeyPoints').value.split('\n').filter(line => line.trim());
        const examples = modal.querySelector('#editNoteExamples').value.split('\n').filter(line => line.trim());
        const summary = modal.querySelector('#editNoteSummary').value.trim();
        const tags = modal.querySelector('#editNoteTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        const updatedContent = {
            title,
            subject,
            key_points: keyPoints,
            examples,
            summary,
            tags
        };
        
        const saveBtn = modal.querySelector('#saveNoteBtn');
        
        try {
            Utils.showLoadingState(saveBtn, 'Saving...');
            window.messageModal.toast('Saving changes...', 'info', 2000);
            
            const response = await fetch(window.getApiUrl(`/api/note/${noteId}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    subject,
                    content: updatedContent
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.messageModal.toast('Note saved successfully!', 'success', 2000);
                modal.remove();
                this.loadRecentNotes();
            } else {
                throw new Error(result.error || 'Failed to save note');
            }
        } catch (error) {
            console.error('Failed to save note:', error);
            window.messageModal.toast('Save failed: ' + error.message, 'error', 3000);
        } finally {
            Utils.hideLoadingState(saveBtn);
        }
    }
}

let noteManager;

document.addEventListener('DOMContentLoaded', () => {
    noteManager = new NoteAssistantManager();
    console.log('Note Assistant initialized');
});