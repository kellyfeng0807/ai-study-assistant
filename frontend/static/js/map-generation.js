/**
 * Mind Map Generation Page JavaScript
 * Enhanced with Mermaid rendering, file upload, and editing capabilities
 */

// Initialize Mermaid
mermaid.initialize({ 
    startOnLoad: false,
    theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    }
});

class MapGenerationManager {
    constructor() {
        this.currentMapId = null;
        this.currentMermaidCode = '';
        this.isEditMode = false;
        this.uploadedFile = null;
        this.zoomLevel = 1.0;
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
        const customDepthGroup = document.getElementById('customDepthGroup');
        const fileCustomDepthGroup = document.getElementById('fileCustomDepthGroup');

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

        // Text input generation
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateFromText());
        }

        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const removeFileBtn = document.getElementById('removeFileBtn');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (removeFileBtn) {
            removeFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearFile();
            });
        }

        if (uploadGenerateBtn) {
            uploadGenerateBtn.addEventListener('click', () => this.generateFromFile());
        }

        // Edit mode controls
        const editModeBtn = document.getElementById('editModeBtn');
        const saveBtn = document.getElementById('saveBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const exportBtn = document.getElementById('exportBtn');
        const formatCodeBtn = document.getElementById('formatCodeBtn');
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

        if (refreshPreviewBtn) {
            refreshPreviewBtn.addEventListener('click', () => this.refreshPreview());
        }

        // Code editor auto-update
        const codeEditor = document.getElementById('mermaidCodeEditor');
        if (codeEditor) {
            let timeout;
            codeEditor.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.refreshPreview(), 500);
            });
        }

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
                    mermaid.initialize({ 
                        startOnLoad: false,
                        theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default'
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
        const file = e.target.files[0];
        if (!file) return;

        this.uploadedFile = file;

        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const uploadGenerateBtn = document.getElementById('uploadGenerateBtn');

        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (uploadPreview) uploadPreview.style.display = 'flex';
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
        if (uploadGenerateBtn) uploadGenerateBtn.disabled = false;
    }

    clearFile() {
        this.uploadedFile = null;
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
        if (!this.uploadedFile) {
            Utils.showNotification('Please select a file first', 'error');
            return;
        }

        const fileTopicInput = document.getElementById('fileTopicInput');
        const fileDepthSelect = document.getElementById('fileDepthSelect');
        const fileCustomDepthInput = document.getElementById('fileCustomDepthInput');
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
        formData.append('file', this.uploadedFile);
        formData.append('topic', fileTopicInput?.value.trim() || '');
        formData.append('depth', depth);

        // Show loading state
        this.showLoadingState(uploadGenerateBtn, 'Processing file...');

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

        const previewSection = document.getElementById('previewSection');
        const mapTitle = document.getElementById('mapTitle');

        if (previewSection) {
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
        }

        if (mapTitle) {
            mapTitle.textContent = mindmapData.title;
        }

        this.renderMermaid(this.currentMermaidCode);
    }

    async renderMermaid(code) {
        const container = document.getElementById('mermaidContainer');
        if (!container) return;

        try {
            container.innerHTML = `<div class="mermaid">${code}</div>`;
            await mermaid.run({
                querySelector: '#mermaidContainer .mermaid'
            });
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

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;

        const viewMode = document.getElementById('viewMode');
        const editMode = document.getElementById('editMode');
        const editModeBtn = document.getElementById('editModeBtn');
        const codeEditor = document.getElementById('mermaidCodeEditor');

        if (viewMode) viewMode.style.display = this.isEditMode ? 'none' : 'block';
        if (editMode) editMode.style.display = this.isEditMode ? 'flex' : 'none';
        
        if (editModeBtn) {
            const icon = editModeBtn.querySelector('i');
            if (icon) {
                icon.className = this.isEditMode ? 'fas fa-eye' : 'fas fa-edit';
            }
        }

        if (this.isEditMode && codeEditor) {
            codeEditor.value = this.currentMermaidCode;
            this.refreshPreview();
        }
    }

    async refreshPreview() {
        const codeEditor = document.getElementById('mermaidCodeEditor');
        const previewContainer = document.getElementById('mermaidPreview');

        if (!codeEditor || !previewContainer) return;

        const code = codeEditor.value;

        try {
            const tempId = 'mermaid-preview-' + Date.now();
            previewContainer.innerHTML = `<div class="mermaid" id="${tempId}">${code}</div>`;
            await mermaid.run({
                querySelector: `#${tempId}`
            });
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

    formatCode() {
        const codeEditor = document.getElementById('mermaidCodeEditor');
        if (!codeEditor) return;

        // Basic code formatting
        let code = codeEditor.value;
        code = code.split('\n').map(line => line.trim()).join('\n');
        codeEditor.value = code;
        this.refreshPreview();
    }

    async saveChanges() {
        if (!this.currentMapId) {
            Utils.showNotification('No mind map to save', 'error');
            return;
        }

        const codeEditor = document.getElementById('mermaidCodeEditor');
        const mapTitle = document.getElementById('mapTitle');

        if (!codeEditor) return;

        const data = {
            mermaid_code: codeEditor.value,
            title: mapTitle?.textContent || 'Untitled'
        };

        Utils.showNotification('Saving changes...', 'info');

        try {
            const result = await Utils.apiCall(`/map/${this.currentMapId}`, 'PUT', data);

            if (result && result.success) {
                Utils.showNotification('Changes saved successfully!', 'success');
                this.currentMermaidCode = codeEditor.value;
                this.renderMermaid(this.currentMermaidCode);
                this.loadRecentMaps();
            } else {
                Utils.showNotification(result?.error || 'Failed to save changes', 'error');
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            Utils.showNotification('Error saving changes', 'error');
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
        if (!confirm('Are you sure you want to delete this mind map?')) {
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

        // Create a download link for the Mermaid code
        const blob = new Blob([this.currentMermaidCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindmap-${this.currentMapId}.mmd`;
        a.click();
        URL.revokeObjectURL(url);

        Utils.showNotification('Mind map code exported!', 'success');
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
