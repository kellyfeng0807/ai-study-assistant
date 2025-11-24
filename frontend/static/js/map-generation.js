/**
 * Mind Map Generation Page JavaScript
 * Enhanced with Mermaid rendering, file upload, and editing capabilities
 */

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

        // Edit mode controls
        const editModeBtn = document.getElementById('editModeBtn');
        const saveBtn = document.getElementById('saveBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
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

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
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
                deterministicIDSeed: this.currentMapId || 'view'
            });
            
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = `mermaid-view-${this.currentMapId || 'current'}`;
            mermaidDiv.textContent = code;
            container.appendChild(mermaidDiv);
            
            await mermaid.run({
                querySelector: `#${mermaidDiv.id}`
            });
            
            // 不再应用位置，因为我们直接保存整个 SVG
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
        
        console.log('Rendering saved SVG, length:', svgContent.length);
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
        
        this.updateEditZoom();
        this.enableDragAndDrop(previewContainer);
    }

    async refreshPreview() {
        const codeEditor = document.getElementById('mermaidCodeEditor');
        const previewContainer = document.getElementById('mermaidPreview');

        if (!codeEditor || !previewContainer) return;

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
                deterministicIDSeed: this.currentMapId || 'preview'
            });
            
            const tempId = `mermaid-edit-${this.currentMapId || 'new'}`;
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.id = tempId;
            mermaidDiv.textContent = code;
            previewContainer.appendChild(mermaidDiv);
            
            await mermaid.run({
                querySelector: `#${tempId}`
            });
            
            this.updateEditZoom();
            this.enableDragAndDrop(previewContainer);
        } catch (error) {
            console.error('Preview render error:', error);
            previewContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Syntax error</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }

    applyCodeChanges() {
        // Same as refresh, but with explicit user action
        this.refreshPreview();
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
            // 克隆 SVG 并序列化
            const clonedSvg = svg.cloneNode(true);
            svgContent = new XMLSerializer().serializeToString(clonedSvg);
            console.log('Saved SVG length:', svgContent.length);
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
            this.renderThumbnail(map.id, map.mermaid_code);
        });

        // Bind action buttons
        container.querySelectorAll('.view-map-btn').forEach(btn => {
            btn.addEventListener('click', () => this.viewMap(btn.dataset.id));
        });

        container.querySelectorAll('.delete-map-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteMap(btn.dataset.id));
        });
    }

    async renderThumbnail(mapId, mermaidCode) {
        const thumbnailContainer = document.getElementById(`thumbnail-${mapId}`);
        if (!thumbnailContainer) return;

        try {
            const tempId = `mermaid-thumb-${mapId}`;
            thumbnailContainer.innerHTML = `<div class="mermaid" id="${tempId}">${mermaidCode}</div>`;
            
            await mermaid.run({
                querySelector: `#${tempId}`
            });
            
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

    toggleFullscreen() {
        const previewSection = document.getElementById('previewSection');
        if (!previewSection) return;

        if (!document.fullscreenElement) {
            previewSection.requestFullscreen().catch(err => {
                console.error('Error entering fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    exportMindMap() {
        if (!this.currentMapId) {
            Utils.showNotification('No mind map to export', 'error');
            return;
        }

        // Export as Mermaid code (.mmd)
        const codeBlob = new Blob([this.currentMermaidCode], { type: 'text/plain' });
        const codeUrl = URL.createObjectURL(codeBlob);
        const codeLink = document.createElement('a');
        codeLink.href = codeUrl;
        codeLink.download = `mindmap-${this.currentMapId}.mmd`;
        codeLink.click();
        URL.revokeObjectURL(codeUrl);

        // Export as PNG
        this.exportAsPNG();

        Utils.showNotification('Mind map exported as .mmd and .png!', 'success');
    }

    async exportAsPNG() {
        try {
            const svg = document.querySelector('#mermaidContainer svg');
            if (!svg) {
                console.error('No SVG found to export');
                return;
            }

            // Clone the SVG to avoid modifying the original
            const svgClone = svg.cloneNode(true);
            
            // Get SVG dimensions
            const bbox = svg.getBBox();
            const width = bbox.width + 40; // Add padding
            const height = bbox.height + 40;
            
            // Set viewBox and dimensions
            svgClone.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${width} ${height}`);
            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);
            
            // Serialize SVG to string
            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            
            // Create an image from SVG
            const img = new Image();
            img.onload = () => {
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
                ctx.drawImage(img, 0, 0);
                
                // Convert to PNG and download
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `mindmap-${this.currentMapId}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    URL.revokeObjectURL(svgUrl);
                });
            };
            img.src = svgUrl;
        } catch (error) {
            console.error('Error exporting PNG:', error);
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
        this.editZoomLevel = 1.0;
        this.updateEditZoom();
    }

    updateEditZoom() {
        const previewContainer = document.getElementById('mermaidPreview');
        const zoomLevelDisplay = document.getElementById('editZoomLevel');
        
        if (previewContainer) {
            previewContainer.style.transform = `scale(${this.editZoomLevel})`;
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
    console.log('Mind Map Generator initialized with Mermaid support');
});
