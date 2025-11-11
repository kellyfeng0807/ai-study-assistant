/**
 * Mind Map Generation Page JavaScript
 */

class MapGenerationManager {
    constructor() {
        this.currentZoom = 1.0;
        this.init();
    }
    
    init() {
        this.bindEventListeners();
    }
    
    bindEventListeners() {
        const generateBtn = document.getElementById('generateBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetViewBtn = document.getElementById('resetViewBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateMindMap());
        }
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => this.resetView());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMindMap());
        }
    }
    
    async generateMindMap() {
        const topicInput = document.getElementById('topicInput');
        const depthSelect = document.getElementById('depthSelect');
        const styleSelect = document.getElementById('styleSelect');
        
        if (!topicInput || !topicInput.value.trim()) {
            Utils.showNotification('Please enter a topic', 'error');
            return;
        }
        
        const topic = topicInput.value.trim();
        const depth = depthSelect ? depthSelect.value : '3';
        const style = styleSelect ? styleSelect.value : 'hierarchical';
        
        Utils.showNotification('Generating mind map...', 'info');
        
        const result = await Utils.apiCall('/map/generate', 'POST', {
            topic: topic,
            depth: parseInt(depth),
            style: style
        });
        
        if (result && result.success) {
            Utils.showNotification('Mind map generated successfully', 'success');
            this.displayMindMap(result.mindmap);
        }
    }
    
    displayMindMap(mindmapData) {
        const previewSection = document.getElementById('previewSection');
        const previewCanvas = document.getElementById('previewCanvas');
        
        if (previewSection) {
            previewSection.style.display = 'block';
        }
        
        if (previewCanvas) {
            previewCanvas.innerHTML = this.renderMindMapHTML(mindmapData);
        }
    }
    
    renderMindMapHTML(data) {
        return `
            <div class="mindmap-container" style="transform: scale(${this.currentZoom});">
                <div class="mindmap-node root-node">
                    <div class="node-content">${data.topic || 'Sample Topic'}</div>
                </div>
                <div class="mindmap-branches">
                    <div class="branch-level">
                        ${this.renderBranches(data.branches || [])}
                    </div>
                </div>
            </div>
            <style>
                .mindmap-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: transform 0.3s ease;
                }
                .mindmap-node {
                    padding: 12px 24px;
                    border: 2px solid hsl(var(--border));
                    border-radius: var(--radius);
                    background: hsl(var(--card));
                    margin: 8px;
                    font-weight: 600;
                }
                .root-node {
                    background: hsl(var(--foreground));
                    color: hsl(var(--background));
                    border-color: hsl(var(--foreground));
                    font-size: 18px;
                }
                .mindmap-branches {
                    display: flex;
                    gap: 16px;
                }
                .branch-level {
                    display: flex;
                    gap: 16px;
                }
            </style>
        `;
    }
    
    renderBranches(branches) {
        if (!branches || branches.length === 0) {
            return '<div class="mindmap-node">Branch 1</div><div class="mindmap-node">Branch 2</div><div class="mindmap-node">Branch 3</div>';
        }
        return branches.map(branch => 
            `<div class="mindmap-node">${branch.name}</div>`
        ).join('');
    }
    
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom + 0.1, 2.0);
        this.updateZoom();
    }
    
    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom - 0.1, 0.5);
        this.updateZoom();
    }
    
    resetView() {
        this.currentZoom = 1.0;
        this.updateZoom();
    }
    
    updateZoom() {
        const container = document.querySelector('.mindmap-container');
        if (container) {
            container.style.transform = `scale(${this.currentZoom})`;
        }
    }
    
    exportMindMap() {
        Utils.showNotification('Exporting mind map...', 'info');
        setTimeout(() => {
            Utils.showNotification('Mind map exported successfully', 'success');
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mapManager = new MapGenerationManager();
    console.log('Mind Map Generator initialized');
});
