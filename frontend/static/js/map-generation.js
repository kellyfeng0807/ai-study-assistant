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
        this.isEditMode = false;
        this.uploadedFile = null;
        this.zoomLevel = 1.0;
        this.editZoomLevel = 1.0;  // Separate zoom for edit mode
        this.nodePositions = new Map();  // Store custom node positions
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
        formData.append('file', this.uploadedFile);
        formData.append('topic', fileTopicInput?.value.trim() || '');
        formData.append('context', fileContextInput?.value.trim() || '');
        formData.append('depth', depth);
        formData.append('style', fileStyleSelect?.value || 'TD');

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
        this.savedMermaidCode = mindmapData.mermaid_code;  // Store as saved version

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
            // Exiting edit mode - check if there are unsaved changes
            const currentCode = codeEditor ? codeEditor.value : this.currentMermaidCode;
            if (currentCode !== this.savedMermaidCode) {
                // Restore to last saved version
                this.currentMermaidCode = this.savedMermaidCode;
                
                // Clear temporary node positions
                this.nodePositions.clear();
                
                // Re-render view mode with saved version
                this.renderMermaidDiagram(this.currentMermaidCode);
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
            // Entering edit mode - use current saved version
            codeEditor.value = this.savedMermaidCode;
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
            
            // Apply stored node positions after rendering
            this.applyStoredPositions(previewContainer);
            
            // Enable drag and drop on preview nodes after rendering
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

    applyStoredPositions(container) {
        if (this.nodePositions.size === 0) return;
        
        const svg = container.querySelector('svg');
        if (!svg) return;
        
        // Apply stored positions to nodes
        this.nodePositions.forEach((position, nodeId) => {
            const node = svg.querySelector(`#${nodeId}, [id="${nodeId}"]`);
            if (node) {
                const currentTransform = node.getAttribute('transform') || '';
                let newTransform;
                
                if (currentTransform.includes('translate')) {
                    newTransform = currentTransform.replace(
                        /translate\([^)]+\)/,
                        `translate(${position.x},${position.y})`
                    );
                } else {
                    newTransform = `translate(${position.x},${position.y}) ${currentTransform}`;
                }
                
                node.setAttribute('transform', newTransform);
            }
        });
        
        // After repositioning nodes, we need to update edges
        // This is complex, so we'll rely on Mermaid's layout and just offset nodes
    }

    applyCodeChanges() {
        // Same as refresh, but with explicit user action
        this.refreshPreview();
    }

    enableDragAndDrop(container) {
        const svg = container.querySelector('svg');
        if (!svg) return;

        // Detect if this is a mindmap
        const isMindmap = this.currentMermaidCode && this.currentMermaidCode.trim().startsWith('mindmap');
        console.log('Is Mindmap:', isMindmap);

        let draggedElement = null;
        let draggedNodeId = null;
        let startX = 0;
        let startY = 0;
        let initialX = 0;
        let initialY = 0;
        let connectedEdges = [];

        // Find all node elements
        const nodes = svg.querySelectorAll('g.node, g[class*="node"], g[id*="flowchart"], g.nodeLabel');
        
        nodes.forEach(node => {
            // Make sure the node has visible content
            const hasContent = node.querySelector('rect, circle, path, polygon, text');
            if (!hasContent) return;
            
            node.style.cursor = 'move';
            
            const mouseDownHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                draggedElement = node;
                draggedElement.classList.add('dragging');
                
                // Get node ID - extract the actual node identifier
                const rawId = node.id || node.getAttribute('id') || '';
                draggedNodeId = this.extractNodeId(rawId);
                
                console.log('=== Drag Started ===');
                console.log('Node element:', node);
                console.log('Raw node ID:', rawId);
                console.log('Extracted node ID:', draggedNodeId);
                
                // Get current transform
                const transform = node.getAttribute('transform') || '';
                const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                initialX = match ? parseFloat(match[1]) : 0;
                initialY = match ? parseFloat(match[2]) : 0;
                
                // Store starting mouse position in SVG coordinates
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                startX = svgP.x;
                startY = svgP.y;
                
                // For mindmap, find connected edges differently
                if (isMindmap) {
                    connectedEdges = this.findMindmapConnectedEdges(svg, draggedElement);
                } else {
                    // For flowchart, use ID-based matching
                    connectedEdges = this.findConnectedEdgesByNodeId(svg, draggedNodeId, false);
                }
                
                console.log('Found', connectedEdges.length, 'connected edges');
                connectedEdges.forEach((e, i) => {
                    console.log(`Edge ${i}:`, e.sourceNode, '->', e.targetNode, 
                               'isSource:', e.isSource, 'isTarget:', e.isTarget);
                });
                console.log('===================');
                
                // Add document-level listeners
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            };
            
            const mouseMoveHandler = (e) => {
                if (!draggedElement) return;
                
                // Get current mouse position in SVG coordinates
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                
                const deltaX = svgP.x - startX;
                const deltaY = svgP.y - startY;
                
                const newX = initialX + deltaX;
                const newY = initialY + deltaY;
                
                // Update node transform
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
                
                // Update all connected edges
                connectedEdges.forEach((edgeInfo, index) => {
                    const oldD = edgeInfo.path.getAttribute('d');
                    this.updateEdgeConnectionById(edgeInfo, deltaX, deltaY);
                    const newD = edgeInfo.path.getAttribute('d');
                    if (index === 0) {  // Log first edge only to avoid spam
                        console.log('Edge update - Old d:', oldD);
                        console.log('Edge update - New d:', newD);
                        console.log('Changed:', oldD !== newD);
                    }
                });
            };
            
            const mouseUpHandler = () => {
                if (draggedElement && draggedNodeId) {
                    // Store final position
                    const transform = draggedElement.getAttribute('transform');
                    const match = transform ? transform.match(/translate\(([^,]+),([^)]+)\)/) : null;
                    if (match) {
                        this.nodePositions.set(draggedNodeId, {
                            x: parseFloat(match[1]),
                            y: parseFloat(match[2])
                        });
                    }
                    
                    draggedElement.classList.remove('dragging');
                    draggedElement = null;
                    draggedNodeId = null;
                    connectedEdges = [];
                }
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            node.addEventListener('mousedown', mouseDownHandler);
        });
    }

    // Find connected edges for mindmap by geometric proximity
    findMindmapConnectedEdges(svg, nodeElement) {
        const edges = [];
        
        try {
            // Get node center position
            const nodeBBox = nodeElement.getBBox();
            const transform = nodeElement.getAttribute('transform') || '';
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            const tx = match ? parseFloat(match[1]) : 0;
            const ty = match ? parseFloat(match[2]) : 0;
            
            const nodeCenterX = tx + nodeBBox.x + nodeBBox.width / 2;
            const nodeCenterY = ty + nodeBBox.y + nodeBBox.height / 2;
            
            // Find all path elements (mindmap uses simple paths for connections)
            const allPaths = svg.querySelectorAll('path');
            console.log('Checking', allPaths.length, 'paths for mindmap connections');
            
            allPaths.forEach(path => {
                const d = path.getAttribute('d');
                if (!d) return;
                
                // Parse path to get start and end points
                const pathPoints = this.parsePathData(d);
                if (!pathPoints || pathPoints.length < 2) return;
                
                const startPoint = pathPoints[0];
                const endPoint = pathPoints[pathPoints.length - 1];
                
                // Get actual end coordinates (handle different point types)
                const endX = endPoint.x3 || endPoint.x2 || endPoint.x;
                const endY = endPoint.y3 || endPoint.y2 || endPoint.y;
                
                // Check if path starts or ends near this node (within 50px)
                const threshold = 50;
                const startDist = Math.sqrt(Math.pow(startPoint.x - nodeCenterX, 2) + Math.pow(startPoint.y - nodeCenterY, 2));
                const endDist = Math.sqrt(Math.pow(endX - nodeCenterX, 2) + Math.pow(endY - nodeCenterY, 2));
                
                const isSource = startDist < threshold;
                const isTarget = endDist < threshold;
                
                if (isSource || isTarget) {
                    console.log('Found connected path, isSource:', isSource, 'isTarget:', isTarget);
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

    // Extract clean node ID from Mermaid's generated ID
    extractNodeId(rawId) {
        // Mermaid generates IDs like "flowchart-A-123" or just "A"
        // Mindmap uses IDs like "mindmap-section-0", "mindmap-section-0-0", etc.
        // We need to extract the actual node identifier
        if (!rawId) return '';
        
        // If it's a simple ID without prefixes, return as is
        if (!rawId.includes('-')) {
            return rawId;
        }
        
        // For mindmap sections, keep the full ID as it's meaningful
        if (rawId.startsWith('mindmap-')) {
            return rawId;
        }
        
        // Remove common prefixes and trailing numbers
        let cleanId = rawId;
        
        // Pattern: flowchart-NodeName-123 -> NodeName
        const flowchartMatch = cleanId.match(/^flowchart-([^-]+)-\d+$/);
        if (flowchartMatch) {
            return flowchartMatch[1];
        }
        
        // Pattern: node-NodeName-123 -> NodeName
        const nodeMatch = cleanId.match(/^node-([^-]+)-\d+$/);
        if (nodeMatch) {
            return nodeMatch[1];
        }
        
        // Pattern: NodeName-123 -> NodeName (remove trailing numbers only)
        cleanId = cleanId.replace(/-\d+$/, '');
        
        // Remove common prefixes as last resort (but not mindmap)
        cleanId = cleanId.replace(/^(?:flowchart|node)-/i, '');
        
        return cleanId;
    }

    // Find edges by parsing their IDs which contain node references
    findConnectedEdgesByNodeId(svg, nodeId, isMindmap = false) {
        if (!nodeId) return [];
        
        const edges = [];
        
        // For mindmap, use different selectors - mindmap uses path elements with specific classes
        let allPaths;
        if (isMindmap) {
            // Mindmap edges are typically path elements, often without specific classes
            // They connect section nodes directly
            allPaths = svg.querySelectorAll('path');
            console.log('Mindmap mode: found', allPaths.length, 'path elements');
        } else {
            // Flowchart uses more specific edge classes
            allPaths = svg.querySelectorAll([
                'path.flowchart-link',
                'path[class*="edge"]',
                'path[id*="L-"]',
                'path[marker-end]',
                'path.edge',
                'line.edge',
                'polyline.edge',
                'path[class*="link"]'
            ].join(', '));
        }
        
        allPaths.forEach(path => {
            const pathId = path.getAttribute('id') || '';
            const pathClass = path.getAttribute('class') || '';
            const d = path.getAttribute('d');
            
            if (!d) return;
            
            // For mindmap, always use geometric detection since mindmap paths don't have meaningful IDs
            if (isMindmap) {
                console.log('Mindmap path - using geometric detection');
                const geometricConnection = this.detectEdgeConnectionGeometric(svg, path, nodeId, d, true);
                if (geometricConnection) {
                    console.log('Found mindmap edge connection');
                    edges.push(geometricConnection);
                }
                return;
            }
            
            console.log('Checking path:', pathId, 'class:', pathClass);
            
            // Parse edge ID to determine connection (for flowchart)
            const edgeConnection = this.parseEdgeConnection(pathId, pathClass);
            
            if (!edgeConnection) {
                // If we can't parse the connection from ID/class, fall back to geometric detection
                const geometricConnection = this.detectEdgeConnectionGeometric(svg, path, nodeId, d, false);
                if (geometricConnection) {
                    edges.push(geometricConnection);
                }
                return;
            }
            
            const { sourceNode, targetNode } = edgeConnection;
            
            // Check if this edge connects to our node
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
                    isSource: isSource,  // True if dragged node is the source
                    isTarget: isTarget   // True if dragged node is the target
                });
                
                console.log('Edge found:', sourceNode, '->', targetNode, 
                           'Node is source:', isSource, 'Node is target:', isTarget);
            }
        });
        
        return edges;
    }

    // Geometric detection as fallback for edges that don't have clear IDs
    detectEdgeConnectionGeometric(svg, path, nodeId, pathData, isMindmap = false) {
        console.log('Using geometric detection for nodeId:', nodeId, 'isMindmap:', isMindmap);
        
        // Find the dragged node element
        let nodeElement = null;
        
        if (isMindmap) {
            // For mindmap, nodes are typically in section groups
            // Try to find by matching text content or by proximity
            const allNodes = svg.querySelectorAll('g.section, g[class*="section"], g');
            for (const node of allNodes) {
                const textElements = node.querySelectorAll('text');
                if (textElements.length > 0) {
                    // Check if this might be our node by comparing positions or content
                    // For now, just check by ID extraction
                    const rawId = node.id || node.getAttribute('id') || '';
                    if (rawId && this.extractNodeId(rawId) === nodeId) {
                        nodeElement = node;
                        break;
                    }
                }
            }
        } else {
            // For flowchart, use standard selectors
            nodeElement = svg.querySelector(`[id*="${nodeId}"]`);
            
            if (!nodeElement) {
                nodeElement = svg.querySelector(`[id*="flowchart-${nodeId}"]`);
            }
            
            if (!nodeElement) {
                const allNodes = svg.querySelectorAll('g.node, g[class*="node"], g[id*="flowchart"]');
                for (const node of allNodes) {
                    const rawId = node.id || node.getAttribute('id') || '';
                    if (this.extractNodeId(rawId) === nodeId) {
                        nodeElement = node;
                        break;
                    }
                }
            }
        }
        
        if (!nodeElement) {
            console.log('Node element not found for geometric detection');
            return null;
        }
        
        console.log('Found node element:', nodeElement.id || 'no-id');
        
        try {
            const nodeBBox = nodeElement.getBBox();
            const transform = nodeElement.getAttribute('transform') || '';
            const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
            const tx = match ? parseFloat(match[1]) : 0;
            const ty = match ? parseFloat(match[2]) : 0;
            
            // For mindmap, use a larger threshold since connections might be further
            const threshold = isMindmap ? 30 : 10;
            
            const nodeBounds = {
                left: tx + nodeBBox.x - threshold,
                right: tx + nodeBBox.x + nodeBBox.width + threshold,
                top: ty + nodeBBox.y - threshold,
                bottom: ty + nodeBBox.y + nodeBBox.height + threshold
            };
            
            console.log('Node bounds:', nodeBounds);
            
            const pathPoints = this.parsePathData(pathData);
            if (!pathPoints || pathPoints.length === 0) return null;
            
            const startPoint = pathPoints[0];
            const endPoint = pathPoints[pathPoints.length - 1];
            
            console.log('Path start:', startPoint, 'end:', endPoint);
            
            const startNear = startPoint.x >= nodeBounds.left && startPoint.x <= nodeBounds.right &&
                            startPoint.y >= nodeBounds.top && startPoint.y <= nodeBounds.bottom;
            const endNear = (endPoint.x || endPoint.x3 || endPoint.x2) >= nodeBounds.left && 
                          (endPoint.x || endPoint.x3 || endPoint.x2) <= nodeBounds.right &&
                          (endPoint.y || endPoint.y3 || endPoint.y2) >= nodeBounds.top && 
                          (endPoint.y || endPoint.y3 || endPoint.y2) <= nodeBounds.bottom;
            
            console.log('Start near:', startNear, 'End near:', endNear);
            
            if (startNear || endNear) {
                const initialPoints = pathPoints.map(p => ({
                    x: p.x,
                    y: p.y,
                    command: p.command,
                    x2: p.x2,
                    y2: p.y2,
                    x3: p.x3,
                    y3: p.y3
                }));
                
                return {
                    path: path,
                    pathData: pathData,
                    initialPoints: initialPoints,
                    sourceNode: nodeId,
                    targetNode: 'unknown',
                    isSource: startNear,
                    isTarget: endNear
                };
            }
        } catch (e) {
            console.error('Error in geometric detection:', e);
        }
        
        return null;
    }

    // Parse edge ID/class to extract source and target node IDs
    parseEdgeConnection(pathId, pathClass) {
        console.log('Parsing edge connection from ID:', pathId, 'class:', pathClass);
        
        // Try to parse from ID first
        // Common formats: "L-A-B", "flowchart-A-B-0", "edge-A-B"
        let match;
        
        // Format: L-nodeA-nodeB or L-nodeA-nodeB-number
        match = pathId.match(/^L-([^-]+)-([^-]+?)(?:-\d+)?$/);
        if (match) {
            console.log('Matched L- format:', match[1], '->', match[2]);
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        // Format: flowchart-nodeA-nodeB-number
        match = pathId.match(/^flowchart-([^-]+)-([^-]+)-\d+$/);
        if (match) {
            console.log('Matched flowchart format:', match[1], '->', match[2]);
            return {
                sourceNode: match[1],
                targetNode: match[2]
            };
        }
        
        // Format: edge-nodeA-nodeB
        match = pathId.match(/^(?:edge|link)-([^-]+)-([^-]+)/);
        if (match) {
            console.log('Matched edge/link format:', match[1], '->', match[2]);
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        // Try class attribute
        match = pathClass.match(/(?:edge|link)-from-([^\s-]+)-to-([^\s-]+)/);
        if (match) {
            console.log('Matched class format:', match[1], '->', match[2]);
            return {
                sourceNode: this.extractNodeId(match[1]),
                targetNode: this.extractNodeId(match[2])
            };
        }
        
        console.log('No match found for edge connection');
        return null;
    }

    // Parse SVG path data to extract all coordinate points
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
                    // Smooth cubic bezier
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
                    // Quadratic bezier
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

    // Update edge connection based on node role (source or target)
    // Simplified: Use straight lines instead of curves
    updateEdgeConnectionById(edgeInfo, deltaX, deltaY) {
        const { path, initialPoints, isSource, isTarget } = edgeInfo;
        
        if (!initialPoints || initialPoints.length === 0) return;
        
        // Get the first and last points (start and end of the edge)
        const firstPoint = initialPoints[0];
        const lastPoint = initialPoints[initialPoints.length - 1];
        
        // Calculate new positions
        let startX = firstPoint.x;
        let startY = firstPoint.y;
        let endX = lastPoint.x || lastPoint.x3 || lastPoint.x2;  // Handle different point types
        let endY = lastPoint.y || lastPoint.y3 || lastPoint.y2;
        
        // Move the appropriate end based on node role
        if (isSource) {
            startX += deltaX;
            startY += deltaY;
        }
        if (isTarget) {
            endX += deltaX;
            endY += deltaY;
        }
        
        // Create a simple straight line path
        const newPathData = `M${startX},${startY} L${endX},${endY}`;
        path.setAttribute('d', newPathData);
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
                this.savedMermaidCode = codeEditor.value;  // Update saved version
                this.renderMermaid(this.currentMermaidCode);
                this.loadRecentMaps();
                
                // Clear node positions after successful save
                this.nodePositions.clear();
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
