/**
 * Mind Map Generation Page JavaScript
 * Enhanced with Mermaid rendering, file upload, and editing capabilities
 */


let mapViewStartTime = null;
let mapViewSubject = "General";

function startMapViewTimer(subject = "General") {
    mapViewStartTime = Date.now();
    mapViewSubject = subject || "General";
    console.log(`Started viewing mind map: ${mapViewSubject}`);
}

async function trackMapViewTime() {
    if (!mapViewStartTime) return;
    
    const seconds = Math.floor((Date.now() - mapViewStartTime) / 1000);
    mapViewStartTime = null; // 重置
    
    if (seconds < 5 || seconds > 7200) return;
    
    try {
        await fetch('/api/track_time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seconds: seconds,
                mode: 'review',
                subject: mapViewSubject,
                is_correct: 1
            })
        });
        console.log(`Tracked ${seconds}s for viewing mind map (${mapViewSubject})`);
    } catch (err) {
        console.warn('Failed to track map view time:', err);
    }
}

// 页面离开时追踪时间
window.addEventListener('beforeunload', () => trackMapViewTime());
window.addEventListener('pagehide', () => trackMapViewTime());

// Initialize Mermaid with default theme
mermaid.initialize({ 
    startOnLoad: false,
    theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    },
    mindmap: {
        useMaxWidth: true
    }
});

class MapGenerationManager {
    constructor() {
        this.currentMapId = null;
        this.currentMermaidCode = '';
        this.savedMermaidCode = '';  // Store last saved version
        this.savedSvgContent = '';  // Store saved SVG content
        this.isEditMode = false;
        this.uploadedFiles = [];  // Changed to array for multiple files
        this.zoomLevel = 1.0;
        this.editZoomLevel = 1.0;  // Separate zoom for edit mode
        
        // ViewBox 管理
        this.originalViewBox = null;  // 原始 viewBox（最小尺寸参考）
        this.containerSize = null;    // 容器尺寸
        
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.loadRecentMaps();
        this.setupDragAndDrop();
    }
    
    bindEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Depth selection change handlers
        const depthSelect = document.getElementById('depthSelect');
        const fileDepthSelect = document.getElementById('fileDepthSelect');
        const notesDepthSelect = document.getElementById('notesDepthSelect');
        const customDepthGroup = document.getElementById('customDepthGroup');
        const fileCustomDepthGroup = document.getElementById('fileCustomDepthGroup');
        const notesCustomDepthGroup = document.getElementById('notesCustomDepthGroup');

        if (depthSelect && customDepthGroup) {
            depthSelect.addEventListener('change', (e) => {
                customDepthGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        }

        if (fileDepthSelect && fileCustomDepthGroup) {
            fileDepthSelect.addEventListener('change', (e) => {
                fileCustomDepthGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        }

        if (notesDepthSelect && notesCustomDepthGroup) {
            notesDepthSelect.addEventListener('change', (e) => {
                notesCustomDepthGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        }

        // Text input generation
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateFromText());
        }

        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const removeAllFilesBtn = document.getElementById('removeAllFilesBtn');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (removeAllFilesBtn) {
            removeAllFilesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFiles();
            });
        }

        if (uploadGenerateBtn) {
            uploadGenerateBtn.addEventListener('click', () => this.generateFromFile());
        }

        // Notes tab: bind generate button
        const generateFromNotesBtn = document.getElementById('generateFromNotesBtn');
        if (generateFromNotesBtn) {
            generateFromNotesBtn.addEventListener('click', () => this.generateFromNotes());
        }

        // Title edit controls
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');
        const cancelTitleBtn = document.getElementById('cancelTitleBtn');

        if (editTitleBtn) {
            editTitleBtn.addEventListener('click', () => this.startEditTitle());
        }

        if (saveTitleBtn) {
            saveTitleBtn.addEventListener('click', () => this.saveTitle());
        }

        if (cancelTitleBtn) {
            cancelTitleBtn.addEventListener('click', () => this.cancelEditTitle());
        }

        // Edit mode controls
        const editModeBtn = document.getElementById('editModeBtn');
        const saveBtn = document.getElementById('saveBtn');
        const exportBtn = document.getElementById('exportBtn');
        const formatCodeBtn = document.getElementById('formatCodeBtn');
        const applyCodeBtn = document.getElementById('applyCodeBtn');
        const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => this.resetZoom());
        }

        // Edit mode zoom controls
        const editZoomInBtn = document.getElementById('editZoomInBtn');
        const editZoomOutBtn = document.getElementById('editZoomOutBtn');
        const editZoomResetBtn = document.getElementById('editZoomResetBtn');

        if (editZoomInBtn) {
            editZoomInBtn.addEventListener('click', () => this.editZoomIn());
        }

        if (editZoomOutBtn) {
            editZoomOutBtn.addEventListener('click', () => this.editZoomOut());
        }

        if (editZoomResetBtn) {
            editZoomResetBtn.addEventListener('click', () => this.editZoomReset());
        }

        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => this.toggleEditMode());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveChanges());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMindMap());
        }

        if (formatCodeBtn) {
            formatCodeBtn.addEventListener('click', () => this.formatCode());
        }

        if (applyCodeBtn) {
            applyCodeBtn.addEventListener('click', () => this.applyCodeChanges());
        }

        if (refreshPreviewBtn) {
            refreshPreviewBtn.addEventListener('click', () => this.refreshPreview());
        }

        // Remove auto-update to avoid conflicts with manual dragging
        // User must click Apply or Refresh to see changes


        // Recent maps refresh
        const refreshRecentBtn = document.getElementById('refreshRecentBtn');
        if (refreshRecentBtn) {
            refreshRecentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadRecentMaps();
            });
        }

        // Theme change listener for Mermaid
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                setTimeout(() => {
                    const isDark = document.body.classList.contains('dark-theme');
                    mermaid.initialize({ 
                        startOnLoad: false,
                        theme: isDark ? 'dark' : 'default',
                        securityLevel: 'loose',
                        flowchart: {
                            useMaxWidth: true,
                            htmlLabels: true
                        },
                        mindmap: {
                            useMaxWidth: true
                        }
                    });
                    if (this.currentMermaidCode) {
                        this.renderMermaid(this.currentMermaidCode);
                    }
                }, 100);
            });
        }
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

        // Load notes when switching to notes tab
        if (tabId === 'notes-select') {
            this.loadAvailableNotes();
        }
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = document.getElementById('fileInput');
                fileInput.files = files;
                this.handleFileSelect({ target: fileInput });
            }
        });
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        this.uploadedFiles = files;

        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const filesList = document.getElementById('filesList');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        // Clear existing list
        if (filesList) filesList.innerHTML = '';

        // Add each file
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="fas fa-file"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="remove-file-btn" data-index="${index}" title="Remove this file">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Add remove handler for individual file
            const removeBtn = fileItem.querySelector('.remove-file-btn');
            removeBtn.addEventListener('click', () => this.removeFile(index));
            
            filesList.appendChild(fileItem);
        });

        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (uploadPreview) uploadPreview.style.display = 'flex';
        if (uploadGenerateBtn) uploadGenerateBtn.disabled = false;
    }

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        
        if (this.uploadedFiles.length === 0) {
            this.clearFiles();
        } else {
            // Re-render the list
            const fileInput = document.getElementById('fileInput');
            const event = { target: { files: this.uploadedFiles } };
            this.handleFileSelect(event);
        }
    }

    clearFiles() {
        this.uploadedFiles = [];
        const fileInput = document.getElementById('fileInput');
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        if (fileInput) fileInput.value = '';
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
        if (uploadGenerateBtn) uploadGenerateBtn.disabled = true;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async generateFromText() {
        const topicInput = document.getElementById('topicInput');
        const contextInput = document.getElementById('contextInput');
        const depthSelect = document.getElementById('depthSelect');
        const customDepthInput = document.getElementById('customDepthInput');
        const styleSelect = document.getElementById('styleSelect');
        const generateBtn = document.getElementById('generateBtn');
        
        if (!topicInput || !topicInput.value.trim()) {
            Utils.showNotification('Please enter a topic', 'error');
            return;
        }
        
        // 获取深度值
        let depth;
        const depthValue = depthSelect?.value;
        if (depthValue === 'auto') {
            depth = 'auto'; // 让AI决定
        } else if (depthValue === 'custom') {
            depth = parseInt(customDepthInput?.value || '3');
            if (depth < 1 || depth > 10) {
                Utils.showNotification('Custom depth must be between 1 and 10', 'error');
                return;
            }
        } else {
            depth = parseInt(depthValue || '3');
        }
        
        const data = {
            topic: topicInput.value.trim(),
            context: contextInput ? contextInput.value.trim() : '',
            depth: depth,
            style: styleSelect?.value || 'hierarchical'
        };
        
        // Show loading state
        this.showLoadingState(generateBtn, 'Generating with AI...');
        
        try {
            const result = await Utils.apiCall('/map/generate', 'POST', data);
            
            if (result && result.success) {
                Utils.showNotification('Mind map generated successfully!', 'success');
                this.displayMindMap(result.mindmap);
                this.loadRecentMaps(); // Refresh the list
            } else {
                Utils.showNotification(result?.error || 'Failed to generate mind map', 'error');
            }
        } catch (error) {
            console.error('Error generating mind map:', error);
            Utils.showNotification('Error generating mind map', 'error');
        } finally {
            this.hideLoadingState(generateBtn, 'Generate Mind Map');
        }
    }

    async generateFromFile() {
        if (this.uploadedFiles.length === 0) {
            Utils.showNotification('Please select at least one file', 'error');
            return;
        }

        const fileTopicInput = document.getElementById('fileTopicInput');
        const fileContextInput = document.getElementById('fileContextInput');
        const fileDepthSelect = document.getElementById('fileDepthSelect');
        const fileCustomDepthInput = document.getElementById('fileCustomDepthInput');
        const fileStyleSelect = document.getElementById('fileStyleSelect');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        // 获取深度值
        let depth;
        const depthValue = fileDepthSelect?.value;
        if (depthValue === 'auto') {
            depth = 'auto';
        } else if (depthValue === 'custom') {
            depth = parseInt(fileCustomDepthInput?.value || '3');
            if (depth < 1 || depth > 10) {
                Utils.showNotification('Custom depth must be between 1 and 10', 'error');
                return;
            }
        } else {
            depth = parseInt(depthValue || '3');
        }

        const formData = new FormData();
        
        // Append all files
        this.uploadedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        formData.append('topic', fileTopicInput?.value.trim() || '');
        formData.append('context', fileContextInput?.value.trim() || '');
        formData.append('depth', depth);
        formData.append('style', fileStyleSelect?.value || 'TD');

        // Show loading state
        this.showLoadingState(uploadGenerateBtn, `Processing ${this.uploadedFiles.length} file(s)...`);

        try {
            const response = await fetch('/api/map/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result && result.success) {
                Utils.showNotification('Mind map generated from file!', 'success');
                this.displayMindMap(result.mindmap);
                this.clearFile();
                this.loadRecentMaps();
            } else {
                Utils.showNotification(result?.error || 'Failed to process file', 'error');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            Utils.showNotification('Error processing file', 'error');
        } finally {
            this.hideLoadingState(uploadGenerateBtn, 'Generate from File');
        }
    }

    displayMindMap(mindmapData) {
        this.currentMapId = mindmapData.id;
        this.currentMermaidCode = mindmapData.mermaid_code;
        this.savedMermaidCode = mindmapData.mermaid_code;
        this.savedSvgContent = mindmapData.svg_content || '';

        const previewSection = document.getElementById('previewSection');
        const mapTitle = document.getElementById('mapTitle');

        if (previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

        if (mapTitle) {
            mapTitle.textContent = mindmapData.title;
        }

        if (this.isEditMode) {
            this.toggleEditMode();
        }

        // 如果有保存的 SVG，直接使用；否则重新渲染
        if (this.savedSvgContent) {
            this.renderSavedSvg(this.savedSvgContent);
        } else {
            this.renderMermaid(this.currentMermaidCode);
        }
    }

    startEditTitle() {
        const mapTitle = document.getElementById('mapTitle');
        const mapTitleInput = document.getElementById('mapTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');
        const cancelTitleBtn = document.getElementById('cancelTitleBtn');

        if (mapTitle && mapTitleInput) {
            mapTitleInput.value = mapTitle.textContent;
            mapTitle.style.display = 'none';
            mapTitleInput.style.display = 'block';
            mapTitleInput.focus();
            mapTitleInput.select();

            editTitleBtn.style.display = 'none';
            saveTitleBtn.style.display = 'inline-flex';
            cancelTitleBtn.style.display = 'inline-flex';
        }
    }

    cancelEditTitle() {
        const mapTitle = document.getElementById('mapTitle');
        const mapTitleInput = document.getElementById('mapTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');
        const cancelTitleBtn = document.getElementById('cancelTitleBtn');

        mapTitle.style.display = 'block';
        mapTitleInput.style.display = 'none';

        editTitleBtn.style.display = 'inline-flex';
        saveTitleBtn.style.display = 'none';
        cancelTitleBtn.style.display = 'none';
    }

    async saveTitle() {
        const mapTitle = document.getElementById('mapTitle');
        const mapTitleInput = document.getElementById('mapTitleInput');
        const newTitle = mapTitleInput.value.trim();

        if (!newTitle) {
            window.messageModal.alert('Title cannot be empty', 'Invalid Title', 'warning');
            mapTitleInput.focus();
            return;
        }

        if (!this.currentMapId) {
            window.messageModal.alert('No mind map selected', 'Error', 'error');
            this.cancelEditTitle();
            return;
        }

        try {
            const result = await Utils.apiCall(`/map/${this.currentMapId}`, 'PUT', {
                title: newTitle
            });

            if (result && result.success) {
                mapTitle.textContent = newTitle;
                this.cancelEditTitle();
                Utils.showNotification('Title updated successfully', 'success');
                this.loadRecentMaps(); // Refresh the list
            } else {
                window.messageModal.alert(result.error || 'Failed to update title', 'Error', 'error');
            }
        } catch (error) {
            console.error('Error updating title:', error);
            window.messageModal.alert('Error updating title', 'Error', 'error');
        }
    }

    // Load notes for the Notes panel (multi-select)
    async loadAvailableNotes() {
        const list = document.getElementById('notesSelectList');
        if (!list) {
            console.warn('notesSelectList element not found');
            return;
        }

        // Show loading state
        list.innerHTML = '<div style="text-align: center; padding: 20px; color: hsl(var(--muted-foreground));">Loading notes...</div>';

        try {
            const res = await fetch('/api/note/list?limit=50');
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            
            if (data.success && Array.isArray(data.notes) && data.notes.length > 0) {
                this.renderNotesSelectList(data.notes);
            } else {
                // No notes available
                list.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: hsl(var(--muted-foreground));">
                        <i class="fas fa-sticky-note" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                        <p style="font-size: 16px; margin: 0;">No notes found</p>
                        <p style="font-size: 14px; margin-top: 8px; opacity: 0.7;">Create notes in Note Assistant first</p>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Failed to load notes for selection:', err);
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: hsl(var(--destructive));">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p style="font-size: 16px; margin: 0;">Failed to load notes</p>
                    <p style="font-size: 14px; margin-top: 8px;">${err.message}</p>
                </div>
            `;
        }
    }

    renderNotesSelectList(notes) {
        const list = document.getElementById('notesSelectList');
        const btn = document.getElementById('generateFromNotesBtn');
        if (!list) return;
        list.innerHTML = '';

        notes.forEach(note => {
            const item = document.createElement('label');
            item.className = 'note-select-item';
            const preview = note.preview || note.summary || '';
            item.innerHTML = `
                <input type="checkbox" value="${note.id}">
                <div class="note-summary">
                    <div class="note-title">${this.escapeHtml(note.title || note.subject || 'Untitled')}</div>
                    <div class="note-excerpt">${this.escapeHtml(preview.slice(0, 120))}</div>
                </div>
            `;
            list.appendChild(item);
        });

        // Enable selection tracking
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const anyChecked = Array.from(list.querySelectorAll('input[type="checkbox"]')).some(i => i.checked);
                if (btn) btn.disabled = !anyChecked;
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async generateFromNotes() {
        const list = document.getElementById('notesSelectList');
        const btn = document.getElementById('generateFromNotesBtn');
        const notesTopicInput = document.getElementById('notesTopicInput');
        const notesContextInput = document.getElementById('notesContextInput');
        const notesDepthSelect = document.getElementById('notesDepthSelect');
        const notesCustomDepthInput = document.getElementById('notesCustomDepthInput');
        const notesStyleSelect = document.getElementById('notesStyleSelect');

        if (!list) return;
        const checked = Array.from(list.querySelectorAll('input[type="checkbox"]')).filter(i => i.checked).map(i => i.value);
        if (checked.length === 0) {
            Utils.showNotification('Please select at least one note', 'error');
            return;
        }

        // Get depth value
        const depthValue = notesDepthSelect?.value;
        let depth = depthValue === 'custom' 
            ? (notesCustomDepthInput?.value || '3') 
            : (depthValue === 'auto' ? 'auto' : depthValue);

        // Build request body
        const requestBody = {
            note_ids: checked,
            topic: notesTopicInput?.value?.trim() || '',
            context: notesContextInput?.value?.trim() || '',
            depth: depth,
            style: notesStyleSelect?.value || 'TD'
        };

        try {
            Utils.showLoadingState(btn, 'Generating map from notes...');
            const res = await fetch('/api/map/generate-from-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await res.json();
            if (data.success) {
                Utils.showNotification('Mind map generated from notes!', 'success');
                this.displayMindMap(data.mindmap);
            } else {
                Utils.showNotification(data.error || 'Failed to generate map from notes', 'error');
            }
        } catch (err) {
            console.error('Error generating map from notes', err);
            Utils.showNotification('Error generating map from notes', 'error');
        } finally {
            Utils.hideLoadingState(btn);
        }
    }

    async renderMermaid(code) {
        const container = document.getElementById('mermaidContainer');
        if (!container) return;

        if (!code || code.trim().length === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No diagram code available</p>
                </div>
            `;
            return;
        }

        try {
            // 完全清空容器
            container.innerHTML = '';
            
            mermaid.initialize({ 
                startOnLoad: false,
                theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                },
                mindmap: {
                    useMaxWidth: true
                },
                deterministicIds: true,
                deterministicIDSeed: `view-${this.currentMapId || 'current'}-${Date.now()}`
            });
            
            // 使用时间戳创建唯一 ID
            const uniqueId = `mermaid-view-${Date.now()}`;
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = uniqueId;
            mermaidDiv.textContent = code;
            container.appendChild(mermaidDiv);
            
            await mermaid.run({
                querySelector: `#${uniqueId}`
            });
            
            // Mermaid 渲染后 SVG 已经在 mermaidDiv 内，保持原样即可
        } catch (error) {
            console.error('Mermaid render error:', error);
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error rendering mind map</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    renderSavedSvg(svgContent) {
        const container = document.getElementById('mermaidContainer');
        if (!container) return;
        
        container.innerHTML = svgContent;
    }

    async renderMermaidDiagram(code) {
        // Helper method to re-render view mode
        this.currentMermaidCode = code;
        await this.renderMermaid(code);
    }

    toggleEditMode() {
        const viewMode = document.getElementById('viewMode');
        const editMode = document.getElementById('editMode');
        const editModeBtn = document.getElementById('editModeBtn');
        const codeEditor = document.getElementById('mermaidCodeEditor');

        if (this.isEditMode) {
            // 退出编辑模式，回到 view 模式
            // 如果有保存的 SVG，显示保存的 SVG；否则重新渲染
            if (this.savedSvgContent) {
                this.renderSavedSvg(this.savedSvgContent);
            } else {
                this.renderMermaid(this.savedMermaidCode);
            }
        }

        this.isEditMode = !this.isEditMode;

        if (viewMode) viewMode.style.display = this.isEditMode ? 'none' : 'block';
        if (editMode) editMode.style.display = this.isEditMode ? 'flex' : 'none';
        
        if (editModeBtn) {
            const icon = editModeBtn.querySelector('i');
            if (icon) {
                icon.className = this.isEditMode ? 'fas fa-eye' : 'fas fa-edit';
            }
        }

        if (this.isEditMode && codeEditor) {
            codeEditor.value = this.savedMermaidCode;
            
            // 编辑模式统一使用 1.0 缩放
            this.editZoomLevel = 1.0;
            
            this.copyViewToEditPreview();
        }
    }

    copyViewToEditPreview() {
        const viewContainer = document.getElementById('mermaidContainer');
        const previewContainer = document.getElementById('mermaidPreview');
        
        if (!viewContainer || !previewContainer) {
            console.warn('Could not find view or preview container');
            return;
        }
        
        const viewSvg = viewContainer.querySelector('svg');
        if (!viewSvg) {
            console.warn('No SVG found in view mode, falling back to render');
            this.refreshPreview();
            return;
        }
        
        const clonedSvg = viewSvg.cloneNode(true);
        previewContainer.innerHTML = '';
        previewContainer.appendChild(clonedSvg);
        
        // 初始化 viewBox 管理
        this.initializeViewBox(clonedSvg);
        
        this.updateEditZoom();
        this.enableDragAndDrop(previewContainer);
    }

    async refreshPreview() {
        const codeEditor = document.getElementById('mermaidCodeEditor');
        const previewContainer = document.getElementById('mermaidPreview');

        if (!codeEditor || !previewContainer) {
            console.error('Editor or preview container not found');
            return;
        }

        const code = codeEditor.value;

        if (!code || code.trim().length === 0) {
            previewContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No diagram code available</p>
                </div>
            `;
            return;
        }

        try {
            // 完全清空容器
            previewContainer.innerHTML = '';
            
            mermaid.initialize({ 
                startOnLoad: false,
                theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                },
                mindmap: {
                    useMaxWidth: true
                },
                deterministicIds: true,
                deterministicIDSeed: `edit-${this.currentMapId || 'new'}-${Date.now()}`
            });
            
            // 使用 mermaid.render() API 直接获取 SVG 字符串
            const uniqueId = `mermaid-edit-${Date.now()}`;
            const { svg } = await mermaid.render(uniqueId, code);
            
            // 直接插入 SVG
            previewContainer.innerHTML = svg;
            
            // 更新当前代码
            this.currentMermaidCode = code;
            
            // 初始化 viewBox 管理
            const svgElement = previewContainer.querySelector('svg');
            if (svgElement) {
                this.initializeViewBox(svgElement);
            }
            
            // 应用缩放和启用拖拽
            this.updateEditZoom();
            this.enableDragAndDrop(previewContainer);
            
            Utils.showNotification('Diagram rendered successfully', 'success');
        } catch (error) {
            console.error('Preview render error:', error);
            previewContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Rendering failed</p>
                    <small>${error.message || 'Unknown error'}</small>
                </div>
            `;
            Utils.showNotification('Failed to render diagram', 'error');
        }
    }

    async applyCodeChanges() {
        const applyBtn = document.getElementById('applyCodeBtn');
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
        }
        
        try {
            await this.refreshPreview();
        } finally {
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<i class="fas fa-check"></i> Apply';
            }
        }
    }

    enableDragAndDrop(container) {
        const svg = container.querySelector('svg');
        if (!svg) return;

        const isMindmap = this.currentMermaidCode && this.currentMermaidCode.trim().startsWith('mindmap');

        let draggedElement = null;
        let draggedNodeId = null;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        let connectedEdges = [];

        const nodes = svg.querySelectorAll('g.node, g[class*="node"], g[id*="flowchart"], g.nodeLabel');
        
        nodes.forEach((node, index) => {
            const hasContent = node.querySelector('rect, circle, path, polygon, text');
            if (!hasContent) return;
            
            node.style.cursor = 'move';
            
            const mouseDownHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                draggedElement = node;
                draggedElement.classList.add('dragging');
                
                // 获取节点 ID 用于查找连接的边
                const rawId = node.id || node.getAttribute('id') || '';
                draggedNodeId = rawId ? this.extractNodeId(rawId) : '';
                
                const transform = node.getAttribute('transform') || '';
                const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                initialX = match ? parseFloat(match[1]) : 0;
                initialY = match ? parseFloat(match[2]) : 0;
                
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                startX = svgP.x;
                startY = svgP.y;
                
                if (isMindmap) {
                    connectedEdges = this.findMindmapConnectedEdges(svg, draggedElement);
                } else {
                    connectedEdges = this.findConnectedEdgesByNodeId(svg, draggedNodeId);
                }
                
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            };
            
            const mouseMoveHandler = (e) => {
                if (!draggedElement) return;
                
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                
                const deltaX = svgP.x - startX;
                const deltaY = svgP.y - startY;
                
                const newX = initialX + deltaX;
                const newY = initialY + deltaY;
                
                const currentTransform = draggedElement.getAttribute('transform') || '';
                let newTransform;
                
                if (currentTransform.includes('translate')) {
                    newTransform = currentTransform.replace(
                        /translate\([^)]+\)/,
                        `translate(${newX},${newY})`
                    );
                } else {
                    newTransform = `translate(${newX},${newY})${currentTransform ? ' ' + currentTransform : ''}`;
                }
                
                draggedElement.setAttribute('transform', newTransform);
                
                // 获取元素的边界框并检查是否需要扩展 viewBox
                try {
                    const bbox = draggedElement.getBBox();
                    const transformedBBox = {
                        x: bbox.x + newX,
                        y: bbox.y + newY,
                        width: bbox.width,
                        height: bbox.height
                    };
                    this.expandViewBoxIfNeeded(svg, transformedBBox);
                } catch (e) {
                    // getBBox 可能在某些情况下失败，忽略错误
                }
                
                connectedEdges.forEach((edgeInfo) => {
                    this.updateEdgeConnectionById(edgeInfo, deltaX, deltaY);
                });
            };
            
            const mouseUpHandler = () => {
                if (draggedElement) {
                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                    draggedNodeId = null;
                }
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            node.addEventListener('mousedown', mouseDownHandler);
        });
    }

    findMindmapConnectedEdges(svg, nodeElement) {
        const edges = [];
        
        try {
            const nodeBBox = nodeElement.getBBox();
            const transform = nodeElement.getAttribute('transform') || '';
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            const tx = match ? parseFloat(match[1]) : 0;
            const ty = match ? parseFloat(match[2]) : 0;
            
            const nodeCenterX = tx + nodeBBox.x + nodeBBox.width / 2;
            const nodeCenterY = ty + nodeBBox.y + nodeBBox.height / 2;
            
            const allPaths = svg.querySelectorAll('path');
            
            allPaths.forEach(path => {
                const d = path.getAttribute('d');
                if (!d) return;
                
                const pathPoints = this.parsePathData(d);
                if (!pathPoints || pathPoints.length < 2) return;
                
                const startPoint = pathPoints[0];
                const endPoint = pathPoints[pathPoints.length - 1];
                
                const endX = endPoint.x3 || endPoint.x2 || endPoint.x;
                const endY = endPoint.y3 || endPoint.y2 || endPoint.y;
                
                const threshold = 50;
                const startDist = Math.sqrt(Math.pow(startPoint.x - nodeCenterX, 2) + Math.pow(startPoint.y - nodeCenterY, 2));
                const endDist = Math.sqrt(Math.pow(endX - nodeCenterX, 2) + Math.pow(endY - nodeCenterY, 2));
                
                const isSource = startDist < threshold;
                const isTarget = endDist < threshold;
                
                if (isSource || isTarget) {
                    edges.push({
                        path: path,
                        pathData: d,
                        initialPoints: pathPoints.map(p => ({
                            x: p.x,
                            y: p.y,
                            command: p.command,
                            x2: p.x2,
                            y2: p.y2,
                            x3: p.x3,
                            y3: p.y3
                        })),
                        sourceNode: 'mindmap-node',
                        targetNode: 'mindmap-node',
                        isSource: isSource,
                        isTarget: isTarget
                    });
                }
            });
        } catch (e) {
            console.error('Error finding mindmap edges:', e);
        }
        
        return edges;
    }

    findConnectedEdgesByNodeId(svg, nodeId) {
        if (!nodeId) return [];
        
        const edges = [];
        
        const allPaths = svg.querySelectorAll([
            'path.flowchart-link',
            'path[class*="edge"]',
            'path[id*="L-"]',
            'path[marker-end]',
            'path.edge',
            'line.edge',
            'polyline.edge',
            'path[class*="link"]'
        ].join(', '));
        
        allPaths.forEach(path => {
            const pathId = path.getAttribute('id') || '';
            const pathClass = path.getAttribute('class') || '';
            const d = path.getAttribute('d');
            
            if (!d) return;
            
            const edgeConnection = this.parseEdgeConnection(pathId, pathClass);
            
            if (!edgeConnection) return;
            
            const { sourceNode, targetNode } = edgeConnection;
            
            const isSource = sourceNode === nodeId;
            const isTarget = targetNode === nodeId;
            
            if (isSource || isTarget) {
                const pathPoints = this.parsePathData(d);
                if (!pathPoints || pathPoints.length === 0) return;
                
                const initialPoints = pathPoints.map(p => ({
                    x: p.x,
                    y: p.y,
                    command: p.command,
                    x2: p.x2,
                    y2: p.y2,
                    x3: p.x3,
                    y3: p.y3
                }));
                
                edges.push({
                    path: path,
                    pathData: d,
                    initialPoints: initialPoints,
                    sourceNode: sourceNode,
                    targetNode: targetNode,
                    isSource: isSource,
                    isTarget: isTarget
                });
            }
        });
        
        return edges;
    }

    parseEdgeConnection(pathId, pathClass) {
        let match;
        
        match = pathId.match(/^L-([^-]+)-([^-]+?)(?:-\d+)?$/);
        if (match) {
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        match = pathId.match(/^flowchart-([^-]+)-([^-]+)-\d+$/);
        if (match) {
            return {
                sourceNode: match[1],
                targetNode: match[2]
            };
        }
        
        match = pathId.match(/^(?:edge|link)-([^-]+)-([^-]+)/);
        if (match) {
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        match = pathClass.match(/(?:edge|link)-from-([^\s-]+)-to-([^\s-]+)/);
        if (match) {
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        return null;
    }

    parsePathData(d) {
        const points = [];
        const regex = /([MLHVCSQTAZ])\s*([\d.,\s-]*)/gi;
        let match;
        let currentX = 0, currentY = 0;
        
        while ((match = regex.exec(d)) !== null) {
            const command = match[1].toUpperCase();
            const rawCoords = match[2].trim();
            if (!rawCoords) continue;
            
            const coords = rawCoords.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
            
            switch (command) {
                case 'M':
                    if (coords.length >= 2) {
                        currentX = coords[0];
                        currentY = coords[1];
                        points.push({ x: currentX, y: currentY, command: 'M' });
                    }
                    break;
                case 'L':
                    if (coords.length >= 2) {
                        currentX = coords[0];
                        currentY = coords[1];
                        points.push({ x: currentX, y: currentY, command: 'L' });
                    }
                    break;
                case 'H':
                    if (coords.length >= 1) {
                        currentX = coords[0];
                        points.push({ x: currentX, y: currentY, command: 'L' });
                    }
                    break;
                case 'V':
                    if (coords.length >= 1) {
                        currentY = coords[0];
                        points.push({ x: currentX, y: currentY, command: 'L' });
                    }
                    break;
                case 'C':
                    if (coords.length >= 6) {
                        points.push({ 
                            x: coords[0], 
                            y: coords[1], 
                            command: 'C',
                            x2: coords[2],
                            y2: coords[3],
                            x3: coords[4],
                            y3: coords[5]
                        });
                        currentX = coords[4];
                        currentY = coords[5];
                    }
                    break;
                case 'S':
                    if (coords.length >= 4) {
                        points.push({
                            x: currentX,
                            y: currentY,
                            command: 'S',
                            x2: coords[0],
                            y2: coords[1],
                            x3: coords[2],
                            y3: coords[3]
                        });
                        currentX = coords[2];
                        currentY = coords[3];
                    }
                    break;
                case 'Q':
                    if (coords.length >= 4) {
                        points.push({
                            x: coords[0],
                            y: coords[1],
                            command: 'Q',
                            x2: coords[2],
                            y2: coords[3]
                        });
                        currentX = coords[2];
                        currentY = coords[3];
                    }
                    break;
            }
        }
        
        return points;
    }

    updateEdgeConnectionById(edgeInfo, deltaX, deltaY) {
        const { path, initialPoints, isSource, isTarget } = edgeInfo;
        
        if (!initialPoints || initialPoints.length === 0) return;
        
        const firstPoint = initialPoints[0];
        const lastPoint = initialPoints[initialPoints.length - 1];
        
        let startX = firstPoint.x;
        let startY = firstPoint.y;
        let endX = lastPoint.x || lastPoint.x3 || lastPoint.x2;
        let endY = lastPoint.y || lastPoint.y3 || lastPoint.y2;
        
        if (isSource) {
            startX += deltaX;
            startY += deltaY;
        }
        if (isTarget) {
            endX += deltaX;
            endY += deltaY;
        }
        
        const newPathData = `M${startX},${startY} L${endX},${endY}`;
        path.setAttribute('d', newPathData);
    }

    extractNodeId(rawId) {
        if (!rawId) return '';
        if (!rawId.includes('-')) return rawId;
        if (rawId.startsWith('mindmap-')) return rawId;
        
        let cleanId = rawId;
        const flowchartMatch = cleanId.match(/^flowchart-([^-]+)-\d+$/);
        if (flowchartMatch) return flowchartMatch[1];
        
        const nodeMatch = cleanId.match(/^node-([^-]+)-\d+$/);
        if (nodeMatch) return nodeMatch[1];
        
        cleanId = cleanId.replace(/-\d+$/, '');
        cleanId = cleanId.replace(/^(?:flowchart|node)-/i, '');
        
        return cleanId;
    }

    formatCode() {
        const codeEditor = document.getElementById('mermaidCodeEditor');
        if (!codeEditor) return;

        let code = codeEditor.value;
        code = code.split('\n').map(line => line.trim()).join('\n');
        codeEditor.value = code;
        this.refreshPreview();
    }

    async saveChanges() {
        if (!this.currentMapId) {
            window.messageModal.toast('No mind map to save', 'error');
            return;
        }

        const codeEditor = document.getElementById('mermaidCodeEditor');
        const mapTitle = document.getElementById('mapTitle');

        if (!codeEditor) return;

        const newCode = codeEditor.value.trim();
        
        // 获取编辑预览容器的 SVG
        const previewContainer = document.getElementById('mermaidPreview');
        const svg = previewContainer ? previewContainer.querySelector('svg') : null;
        let svgContent = '';
        
        if (svg) {
            // 克隆 SVG 并优化尺寸（基于实际内容边界）
            const clonedSvg = svg.cloneNode(true);
            
            // 计算实际内容边界
            const bbox = this.calculateActualBBox(svg);
            const padding = 40;
            const width = bbox.width + padding * 2;
            const height = bbox.height + padding * 2;
            
            // 设置优化的 viewBox
            clonedSvg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
            clonedSvg.setAttribute('width', width);
            clonedSvg.setAttribute('height', height);
            
            svgContent = new XMLSerializer().serializeToString(clonedSvg);
        }

        const data = {
            mermaid_code: newCode,
            title: mapTitle?.textContent || 'Untitled',
            svg_content: svgContent
        };

        window.messageModal.toast('Saving changes...', 'info', 2000);

        try {
            const result = await Utils.apiCall(`/map/${this.currentMapId}`, 'PUT', data);

            if (result && result.success) {
                window.messageModal.toast('Changes saved successfully!', 'success', 2000);
                
                this.currentMermaidCode = newCode;
                this.savedMermaidCode = newCode;
                this.savedSvgContent = svgContent;  // 保存 SVG 内容
                
                // 重新加载地图列表以更新缩略图
                this.loadRecentMaps();
            } else {
                window.messageModal.toast(result?.error || 'Failed to save changes', 'error', 3000);
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            window.messageModal.toast('Error saving changes', 'error', 3000);
        }
    }

    async loadRecentMaps() {
        try {
            const result = await Utils.apiCall('/map/list', 'GET');

            if (result && result.success) {
                this.renderRecentMaps(result.mindmaps);
            }
        } catch (error) {
            console.error('Error loading recent maps:', error);
        }
    }

    renderRecentMaps(maps) {
        const container = document.getElementById('recentMapsGrid');
        if (!container) return;

        if (!maps || maps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-project-diagram"></i>
                    <p>No mind maps yet. Generate your first one above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = maps.slice(0, 6).map(map => `
            <div class="map-card" data-id="${map.id}">
                <div class="map-thumbnail" id="thumbnail-${map.id}">
                    <div class="thumbnail-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                </div>
                <div class="map-info">
                    <h4 class="map-title">${this.escapeHtml(map.title)}</h4>
                    <p class="map-meta">${map.depth} levels • ${this.formatDate(map.created_at)}</p>
                    ${map.source_file ? `<p class="map-source"><i class="fas fa-file"></i> ${this.escapeHtml(map.source_file)}</p>` : ''}
                </div>
                <div class="map-actions">
                    <button class="button-outline view-map-btn" data-id="${map.id}">View</button>
                    <button class="button-outline delete-map-btn" data-id="${map.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Render thumbnails for each map
        maps.slice(0, 6).forEach(map => {
            // 优先使用保存的 SVG，否则使用 mermaid_code
            this.renderThumbnail(map.id, map.mermaid_code, map.svg_content);
        });

        // Bind action buttons
        container.querySelectorAll('.view-map-btn').forEach(btn => {
            btn.addEventListener('click', () => this.viewMap(btn.dataset.id));
        });

        container.querySelectorAll('.delete-map-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMap(btn.dataset.id));
        });
    }

    async renderThumbnail(mapId, mermaidCode, svgContent = null) {
        const thumbnailContainer = document.getElementById(`thumbnail-${mapId}`);
        if (!thumbnailContainer) return;

        try {
            // 优先使用保存的 SVG 内容
            if (svgContent && svgContent.trim().length > 0) {
                thumbnailContainer.innerHTML = svgContent;
                
                // 优化缩略图 SVG 的尺寸
                const svg = thumbnailContainer.querySelector('svg');
                if (svg) {
                    // 计算实际内容边界
                    const bbox = this.calculateActualBBox(svg);
                    const padding = 20;
                    const width = bbox.width + padding * 2;
                    const height = bbox.height + padding * 2;
                    
                    svg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
                    svg.setAttribute('width', '100%');
                    svg.setAttribute('height', '100%');
                }
                
                // Add click to view
                thumbnailContainer.style.cursor = 'pointer';
                thumbnailContainer.addEventListener('click', () => this.viewMap(mapId));
                return;
            }
            
            // Fallback: 使用 mermaid_code 重新渲染
            // 使用唯一 ID 和时间戳避免冲突
            const tempId = `mermaid-thumb-${mapId}-${Date.now()}`;
            
            // 清空容器
            thumbnailContainer.innerHTML = '';
            
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = tempId;
            mermaidDiv.textContent = mermaidCode;
            thumbnailContainer.appendChild(mermaidDiv);
            
            await mermaid.run({
                querySelector: `#${tempId}`
            });
            
            // 渲染成功后移除 mermaid div，只保留 SVG
            const svg = thumbnailContainer.querySelector('svg');
            if (svg && mermaidDiv.parentNode) {
                thumbnailContainer.removeChild(mermaidDiv);
                if (!thumbnailContainer.contains(svg)) {
                    thumbnailContainer.appendChild(svg);
                }
            }
            
            // Add click to view
            thumbnailContainer.style.cursor = 'pointer';
            thumbnailContainer.addEventListener('click', () => this.viewMap(mapId));
        } catch (error) {
            console.error(`Error rendering thumbnail for ${mapId}:`, error);
            thumbnailContainer.innerHTML = `
                <div class="thumbnail-error">
                    <i class="fas fa-project-diagram"></i>
                </div>
            `;
        }
    }

    async viewMap(mapId) {
        try {
            const result = await Utils.apiCall(`/map/${mapId}`, 'GET');

            if (result && result.success) {
                this.displayMindMap(result.mindmap);
            } else {
                Utils.showNotification('Failed to load mind map', 'error');
            }
        } catch (error) {
            console.error('Error loading mind map:', error);
            Utils.showNotification('Error loading mind map', 'error');
        }
    }

    async deleteMap(mapId) {
        const confirmed = await window.messageModal.confirm(
            'Are you sure you want to delete this mind map? This action cannot be undone.',
            'Confirm Delete',
            { danger: true, confirmText: 'Delete', cancelText: 'Cancel' }
        );
        
        if (!confirmed) {
            return;
        }

        try {
            const result = await Utils.apiCall(`/map/${mapId}`, 'DELETE');

            if (result && result.success) {
                Utils.showNotification('Mind map deleted', 'success');
                this.loadRecentMaps();

                if (this.currentMapId === mapId) {
                    const previewSection = document.getElementById('previewSection');
                    if (previewSection) previewSection.style.display = 'none';
                    this.currentMapId = null;
                    this.currentMermaidCode = '';
                }
            } else {
                Utils.showNotification('Failed to delete mind map', 'error');
            }
        } catch (error) {
            console.error('Error deleting mind map:', error);
            Utils.showNotification('Error deleting mind map', 'error');
        }
    }

    async exportMindMap() {
        if (!this.currentMapId) {
            Utils.showNotification('No mind map to export', 'error');
            return;
        }

        // 只导出 PNG
        await this.exportAsPNG();

        Utils.showNotification('Mind map exported as PNG!', 'success');
    }

    async exportAsPNG() {
        try {
            // 优先使用编辑模式的 SVG，如果没有则使用查看模式的
            let svg = document.querySelector('#mermaidPreview svg');
            if (!svg) {
                svg = document.querySelector('#mermaidContainer svg');
            }
            
            if (!svg) {
                console.error('No SVG found to export');
                Utils.showNotification('No diagram to export', 'error');
                return;
            }

            // Clone the SVG to avoid modifying the original
            const svgClone = svg.cloneNode(true);
            
            // 如果有 infinite canvas wrapper，临时移除 transform 以获取真实内容
            const wrapper = svgClone.querySelector('.infinite-canvas-content');
            if (wrapper) {
                wrapper.removeAttribute('transform');
            }
            
            // 计算所有内容的实际边界框
            const bbox = this.calculateActualBBox(svgClone);
            const padding = 40; // 添加 padding
            
            const width = Math.max(bbox.width, 100) + padding * 2;
            const height = Math.max(bbox.height, 100) + padding * 2;
            
            // Set viewBox and dimensions based on actual content
            svgClone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);
            svgClone.removeAttribute('data-infinite-canvas');
            
            // 移除所有 style 属性，使用固定尺寸
            svgClone.removeAttribute('style');
            
            // Serialize SVG to string
            const svgData = new XMLSerializer().serializeToString(svgClone);
            
            // 使用 data URI 而不是 blob URL 避免 CORS 问题
            const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
            
            // Create an image from SVG
            return new Promise((resolve, reject) => {
                const img = new Image();
                
                img.onload = () => {
                    try {
                        // Create canvas
                        const canvas = document.createElement('canvas');
                        canvas.width = width * 2; // 2x for better quality
                        canvas.height = height * 2;
                        const ctx = canvas.getContext('2d');
                        
                        // White background
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        // Draw image scaled 2x
                        ctx.scale(2, 2);
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Convert to PNG and download
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                console.error('Failed to create blob');
                                reject(new Error('Failed to create blob'));
                                return;
                            }
                            
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `mindmap-${this.currentMapId}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            
                            setTimeout(() => {
                                URL.revokeObjectURL(url);
                            }, 100);
                            
                            resolve();
                        }, 'image/png');
                    } catch (err) {
                        console.error('Error in image onload:', err);
                        reject(err);
                    }
                };
                
                img.onerror = (err) => {
                    console.error('Error loading image:', err);
                    reject(new Error('Failed to load SVG as image'));
                };
                
                // 使用 data URI
                img.src = svgDataUri;
            });
        } catch (error) {
            console.error('Error exporting PNG:', error);
            Utils.showNotification('Failed to export PNG', 'error');
            throw error;
        }
    }
    
    /**
     * 初始化 ViewBox 管理
     * 保存原始 viewBox 作为最小尺寸参考
     */
    initializeViewBox(svg) {
        if (!svg) return;
        
        const previewContainer = svg.closest('.mermaid-preview');
        if (!previewContainer) return;
        
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            // 保存原始 viewBox
            const [x, y, width, height] = viewBox.split(/\s+/).map(parseFloat);
            this.originalViewBox = { x, y, width, height };
            svg.dataset.originalViewBox = viewBox;
        }
        
        // 获取容器尺寸
        const containerRect = previewContainer.getBoundingClientRect();
        this.containerSize = {
            width: containerRect.width,
            height: containerRect.height
        };
    }

    /**
     * 根据当前缩放级别更新 viewBox
     * zoom = 1.0 时，viewBox 应该匹配容器可见区域
     * zoom < 1.0 (zoom out) 时，viewBox 更大（看到更多内容）
     * zoom > 1.0 (zoom in) 时，viewBox 更小（看到更少内容）
     */
    updateViewBoxForZoom(svg) {
        if (!svg || !this.originalViewBox || !this.containerSize) return;
        
        const currentViewBox = svg.getAttribute('viewBox');
        if (!currentViewBox) return;
        
        const [currentX, currentY, currentWidth, currentHeight] = currentViewBox.split(/\s+/).map(parseFloat);
        
        // 计算容器的宽高比
        const containerAspect = this.containerSize.width / this.containerSize.height;
        const originalAspect = this.originalViewBox.width / this.originalViewBox.height;
        
        
        let baseWidth, baseHeight;
        if (containerAspect > originalAspect) {
            // 容器更宽，高度对齐
            baseHeight = this.originalViewBox.height / 4;
            baseWidth = baseHeight * containerAspect;
        } else {
            // 容器更高，宽度对齐
            baseWidth = this.originalViewBox.width / 4;
            baseHeight = baseWidth / containerAspect;
        }
        
        // 根据缩放级别调整 viewBox
        // zoom = 1.0: viewBox = base size
        // zoom = 0.5: viewBox = base size * 2 (看到更多)
        // zoom = 2.0: viewBox = base size / 2 (看到更少)
        const newWidth = baseWidth / this.editZoomLevel;
        const newHeight = baseHeight / this.editZoomLevel;
        
        // 确保不小于原始尺寸
        const finalWidth = Math.max(newWidth, this.originalViewBox.width);
        const finalHeight = Math.max(newHeight, this.originalViewBox.height);
        
        // 保持中心点不变
        const centerX = currentX + currentWidth / 2;
        const centerY = currentY + currentHeight / 2;
        const newX = centerX - finalWidth / 2;
        const newY = centerY - finalHeight / 2;
        
        svg.setAttribute('viewBox', `${newX} ${newY} ${finalWidth} ${finalHeight}`);
    }

    /**
     * 根据元素位置扩展 viewBox（拖拽时调用）
     * 只在元素超出当前 viewBox 时扩展，不收缩
     */
    expandViewBoxIfNeeded(svg, elementBBox) {
        if (!svg || !elementBBox) return;
        
        const viewBoxAttr = svg.getAttribute('viewBox');
        if (!viewBoxAttr) return;
        
        let [vbX, vbY, vbWidth, vbHeight] = viewBoxAttr.split(/\s+/).map(parseFloat);
        if (!vbWidth || !vbHeight) return;
        
        // 容器可见区域的尺寸（在100%缩放时）
        const containerAspect = this.containerSize ? this.containerSize.width / this.containerSize.height : 1;
        const baseViewBoxSize = this.originalViewBox ? 
            (containerAspect > this.originalViewBox.width / this.originalViewBox.height ?
                this.originalViewBox.height * containerAspect :
                this.originalViewBox.width / containerAspect) 
            : Math.max(vbWidth, vbHeight);
        
        // padding 为容器尺寸的一部分
        const padding = baseViewBoxSize * 0.1;
        
        // 计算元素的边界
        const elemLeft = elementBBox.x;
        const elemRight = elementBBox.x + elementBBox.width;
        const elemTop = elementBBox.y;
        const elemBottom = elementBBox.y + elementBBox.height;
        
        // 当前 viewBox 的边界
        let vbRight = vbX + vbWidth;
        let vbBottom = vbY + vbHeight;
        
        let needsUpdate = false;
        
        // 只扩展，不收缩
        // 检测并扩展左边界
        if (elemLeft < vbX) {
            vbX = elemLeft - padding;
            vbWidth = vbRight - vbX;
            needsUpdate = true;
        }
        
        // 检测并扩展右边界
        if (elemRight > vbRight) {
            vbWidth = elemRight + padding - vbX;
            needsUpdate = true;
        }
        
        // 检测并扩展上边界
        if (elemTop < vbY) {
            vbY = elemTop - padding;
            vbHeight = vbBottom - vbY;
            needsUpdate = true;
        }
        
        // 检测并扩展下边界
        if (elemBottom > vbBottom) {
            vbHeight = elemBottom + padding - vbY;
            needsUpdate = true;
        }
        
        // 如果需要更新，应用新的 viewBox
        if (needsUpdate) {
            svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
        }
    }
    
    /**
     * 重置视图：计算所有内容的实际边界，居中显示
     * 用于"回到100%中心"操作
     */
    resetViewToContent(svg) {
        if (!svg) return;
        
        // 计算所有内容的实际边界（忽略当前 viewBox，强制从元素计算）
        const contentBBox = this.calculateContentBBox(svg);
        if (!contentBBox) return;
        
        const padding = Math.max(contentBBox.width, contentBBox.height) * 0.1;
        
        // 计算新的内容边界（四周都加 padding）
        const newX = contentBBox.x - padding;
        const newY = contentBBox.y - padding;
        const newWidth = contentBBox.width + padding * 2;
        const newHeight = contentBBox.height + padding * 2;
        
        // 更新原始 viewBox 参考为新的内容边界
        this.originalViewBox = { x: newX, y: newY, width: newWidth, height: newHeight };
        svg.dataset.originalViewBox = `${newX} ${newY} ${newWidth} ${newHeight}`;
        
        // 重置缩放级别为 1.0
        this.editZoomLevel = 1.0;
        
        // 重新初始化容器尺寸（可能窗口大小已改变）
        const previewContainer = svg.closest('.mermaid-preview');
        if (previewContainer) {
            const containerRect = previewContainer.getBoundingClientRect();
            this.containerSize = {
                width: containerRect.width,
                height: containerRect.height
            };
        }
        
        // 使用和初始化相同的逻辑来设置 viewBox
        // 让 viewBox 匹配容器可见区域（100% 视图）
        const containerAspect = this.containerSize.width / this.containerSize.height;
        const contentAspect = newWidth / newHeight;
        
        let finalViewBoxWidth, finalViewBoxHeight;
        if (containerAspect > contentAspect) {
            // 容器更宽，内容高度对齐
            finalViewBoxHeight = newHeight/4;
            finalViewBoxWidth = finalViewBoxHeight * containerAspect;
        } else {
            // 容器更高，内容宽度对齐
            finalViewBoxWidth = newWidth/4;
            finalViewBoxHeight = finalViewBoxWidth / containerAspect;
        }
        
        // 居中内容
        const finalX = newX + (newWidth - finalViewBoxWidth) / 2;
        const finalY = newY + (newHeight - finalViewBoxHeight) / 2;
        
        svg.setAttribute('viewBox', `${finalX} ${finalY} ${finalViewBoxWidth} ${finalViewBoxHeight}`);
        
        // 手动更新显示
        const mermaidPreview = document.getElementById('mermaidPreview');
        const zoomLevelDisplay = document.getElementById('editZoomLevel');
        
        if (mermaidPreview) {
            mermaidPreview.style.transform = `scale(${this.editZoomLevel})`;
        }
        
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(this.editZoomLevel * 100)}%`;
        }
    }
    
    /**
     * 计算实际内容边界（强制从元素计算，不使用 viewBox）
     */
    calculateContentBBox(svg) {
        if (!svg) return null;
        
        try {
            // 遍历所有可见元素的边界框
            const elements = svg.querySelectorAll('g.node, g[class*="node"], g[id*="flowchart"], g.nodeLabel, g.edgePath, g.edgeLabel');
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let foundAny = false;
            
            elements.forEach(el => {
                try {
                    const bbox = el.getBBox();
                    if (bbox.width > 0 || bbox.height > 0) {
                        // 如果元素有 transform，需要考虑 transform
                        const transform = el.getAttribute('transform');
                        let tx = 0, ty = 0;
                        if (transform) {
                            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                            if (match) {
                                tx = parseFloat(match[1]) || 0;
                                ty = parseFloat(match[2]) || 0;
                            }
                        }
                        
                        minX = Math.min(minX, bbox.x + tx);
                        minY = Math.min(minY, bbox.y + ty);
                        maxX = Math.max(maxX, bbox.x + bbox.width + tx);
                        maxY = Math.max(maxY, bbox.y + bbox.height + ty);
                        foundAny = true;
                    }
                } catch (e) {
                    // 某些元素可能没有 getBBox 方法
                }
            });
            
            if (!foundAny) {
                console.warn('No elements with valid bbox found');
                return null;
            }
            
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        } catch (error) {
            console.error('Error calculating content bbox:', error);
            return null;
        }
    }

    /**
     * 计算 SVG 中所有实际内容的边界框
     * 如果 SVG 使用了 infinite canvas wrapper，会自动处理
     */
    calculateActualBBox(svg) {
        try {
            // 如果有 infinite canvas wrapper，从 wrapper 内部获取内容
            const wrapper = svg.querySelector('.infinite-canvas-content');
            
            if (wrapper) {
                // 有 wrapper 的情况，直接获取 wrapper 的 bbox（忽略 transform）
                try {
                    const wrapperBBox = wrapper.getBBox();
                    if (wrapperBBox.width > 0 && wrapperBBox.height > 0) {
                        return wrapperBBox;
                    }
                } catch (e) {
                    console.warn('Wrapper getBBox failed:', e);
                }
            }
            
            // 尝试从 SVG 的 viewBox 获取（导出前的原始尺寸）
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(/\s+/).map(parseFloat);
                // 如果不是我们的大画布 viewBox，使用它
                if (parts.length === 4 && parts[2] < 10000 && parts[2] > 0 && parts[3] > 0) {
                    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
                }
            }
            
            // Fallback: 遍历所有可见元素的边界框
            const targetElement = wrapper || svg;
            const elements = targetElement.querySelectorAll('g, rect, circle, path, text, polygon, line, polyline');
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let foundAny = false;
            
            elements.forEach(el => {
                try {
                    const bbox = el.getBBox();
                    if (bbox.width > 0 || bbox.height > 0) {
                        // 如果元素有 transform，需要考虑 transform
                        const transform = el.getAttribute('transform');
                        let tx = 0, ty = 0;
                        if (transform) {
                            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                            if (match) {
                                tx = parseFloat(match[1]) || 0;
                                ty = parseFloat(match[2]) || 0;
                            }
                        }
                        
                        minX = Math.min(minX, bbox.x + tx);
                        minY = Math.min(minY, bbox.y + ty);
                        maxX = Math.max(maxX, bbox.x + bbox.width + tx);
                        maxY = Math.max(maxY, bbox.y + bbox.height + ty);
                        foundAny = true;
                    }
                } catch (e) {
                    // 某些元素可能没有 getBBox 方法
                }
            });
            
            if (!foundAny) {
                console.warn('No elements with valid bbox found, using fallback');
                // 使用默认尺寸
                return { x: 0, y: 0, width: 800, height: 600 };
            }
            
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        } catch (error) {
            console.error('Error calculating bbox:', error);
            // Fallback
            return { x: 0, y: 0, width: 800, height: 600 };
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;

        const month = date.toLocaleString('default', { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear();
        return `${month} ${day}, ${year}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    zoomIn() {
        this.zoomLevel = this.zoomLevel + 0.1;
        this.updateZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.1);
        this.updateZoom();
    }

    resetZoom() {
        this.zoomLevel = 1.0;
        this.updateZoom();
    }

    updateZoom() {
        const container = document.getElementById('mermaidContainer');
        const zoomLevelDisplay = document.getElementById('zoomLevel');
        
        if (container) {
            container.style.transform = `scale(${this.zoomLevel})`;
        }
        
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    // Edit mode zoom controls
    editZoomIn() {
        this.editZoomLevel = this.editZoomLevel + 0.1;
        this.updateEditZoom();
    }

    editZoomOut() {
        this.editZoomLevel = Math.max(this.editZoomLevel - 0.1, 0.1);
        this.updateEditZoom();
    }

    editZoomReset() {
        // 重置视图到内容边界并居中
        const previewContainer = document.getElementById('mermaidPreview');
        if (previewContainer) {
            const svg = previewContainer.querySelector('svg');
            if (svg) {
                this.resetViewToContent(svg);
            }
        }
    }

    updateEditZoom() {
        const previewContainer = document.getElementById('mermaidPreview');
        const zoomLevelDisplay = document.getElementById('editZoomLevel');
        
        if (previewContainer) {
            previewContainer.style.transform = `scale(${this.editZoomLevel})`;
            
            // 更新 SVG 的 viewBox 以匹配当前缩放级别
            const svg = previewContainer.querySelector('svg');
            if (svg) {
                this.updateViewBoxForZoom(svg);
            }
        }
        
        if (zoomLevelDisplay) {
            zoomLevelDisplay.textContent = `${Math.round(this.editZoomLevel * 100)}%`;
        }
    }

    showLoadingState(button, message = 'Loading...') {
        if (!button) return;
        
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>${message}</span>
        `;
        button.classList.add('loading');
    }

    hideLoadingState(button, originalText = null) {
        if (!button) return;
        
        button.disabled = false;
        if (originalText) {
            button.innerHTML = originalText;
        } else if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
        button.classList.remove('loading');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mapManager = new MapGenerationManager();
});
