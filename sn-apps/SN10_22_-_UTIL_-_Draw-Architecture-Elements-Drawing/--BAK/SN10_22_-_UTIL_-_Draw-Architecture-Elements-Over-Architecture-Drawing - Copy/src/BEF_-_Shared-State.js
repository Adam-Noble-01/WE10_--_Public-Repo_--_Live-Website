/* =============================================================================
   BEF_-_Shared-State.js | Elevation Polygon Detector Application
   - Contains shared state between Core App Logic and Detection Logic
   - Prevents circular dependencies
   ========================================================================== */

// --- Shared State Variables ---
let canvas = null;
let ctx = null;
export let pixelsPerMm = null;
export let detectionResults = [];
export let polygons = [];
export let originalImageData = null; // Changed from const to let
export let showGrid = false;
export let gridSize = 10; // Default grid size in mm (adaptive)
export let unifyIslands = true; // Default enabled for new unify islands feature

// Getters and setters for canvas and context
export function getCanvas() { return canvas; }
export function getContext() { return ctx; }
export function setCanvas(newCanvas) { canvas = newCanvas; }
export function setContext(newContext) { ctx = newContext; }
export function setOriginalImageData(newImageData) { originalImageData = newImageData; }

// Additional setters for state variables
export function setPixelsPerMm(value) { pixelsPerMm = value; }
export function setShowGrid(value) { showGrid = value; }
export function setUnifyIslands(value) { unifyIslands = value; }
export function clearDetectionResults() { detectionResults.length = 0; }
export function clearPolygons() { polygons.length = 0; }
export function setGridSize(value) { gridSize = value; }

// --- Shared UI Elements ---
export let sliders = {};
export let valueDisplays = {};

// --- Shared Functions ---
export function showStatus(message, isError = false, isWarning = false) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    message = message.replace(/window pane/gi, 'architectural element');
    message = message.replace(/pane/gi, 'element');
    statusEl.textContent = message;
    statusEl.className = isError ? 'error' : (isWarning ? 'warning' : '');
    statusEl.style.display = 'block';
    if (isError) console.error(message);
    else if (isWarning) console.warn(message);
    else console.log(message);
}

export function hideStatus() {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.style.display = 'none';
}

export function resetImage(updateStatus = true) {
    if (originalImageData && ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(originalImageData, 0, 0);

        // Redraw grid if enabled
        if (showGrid && pixelsPerMm) {
            drawGrid();
        }

        if (updateStatus) {
            hideStatus();
        }
    }
}

export function drawGrid() {
    if (!pixelsPerMm || !showGrid || !ctx || !canvas) return;

    // Adaptive grid size based on image width
    const imageWidthMm = canvas.width / pixelsPerMm;
    if (imageWidthMm < 1000) gridSize = 10;
    else if (imageWidthMm < 5000) gridSize = 100;
    else gridSize = 250;

    const gridSizePixels = gridSize * pixelsPerMm;
    if (gridSizePixels <= 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.15)';
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = gridSizePixels; x < canvas.width; x += gridSizePixels) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    // Draw horizontal lines
    for (let y = gridSizePixels; y < canvas.height; y += gridSizePixels) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Add grid size label
    ctx.fillStyle = 'rgba(0, 0, 150, 0.6)';
    ctx.font = '10px Arial';
    const label = `${gridSize}mm grid`;
    ctx.fillRect(5, 5, ctx.measureText(label).width + 10, 15);
    ctx.fillStyle = 'white';
    ctx.fillText(label, 10, 16);

    ctx.restore();
}

export function drawLayer(pointArrays, isDetectionLayer) {
    if (!pointArrays || pointArrays.length === 0 || !ctx) return;

    const fillColor = isDetectionLayer ? 'rgba(0, 180, 0, 0.15)' : 'rgba(70, 130, 180, 0.2)';
    const strokeColor = isDetectionLayer ? 'rgba(0, 180, 0, 0.8)' : 'rgba(70, 130, 180, 0.9)';
    const lineWidth = isDetectionLayer ? 1.5 : 2;
    const vertexFill = isDetectionLayer ? 'rgba(0, 100, 0, 0.8)' : 'rgba(0, 0, 200, 0.8)';
    const vertexSize = isDetectionLayer ? 1.5 : 2;

    ctx.save();
    ctx.lineWidth = lineWidth;

    for (const points of pointArrays) {
        if (points.length < 2) continue;
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        if (points.length >= 3) {
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = vertexFill;
        for (const p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, vertexSize, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    ctx.restore();
}

export function drawDetectionLayer() {
    drawLayer(detectionResults, true);
}

export function drawPolygonLayer() {
    drawLayer(polygons, false);
}

export function updateLayerVisibility() {
    if (!ctx || !canvas) return;

    const baseLayerToggle = document.getElementById('baseLayerToggle');
    const detectionLayerToggle = document.getElementById('detectionLayerToggle');
    const polygonLayerToggle = document.getElementById('polygonLayerToggle');
    
    if (!baseLayerToggle || !detectionLayerToggle || !polygonLayerToggle) return;

    const baseVisible = baseLayerToggle.checked;
    const detectionVisible = detectionLayerToggle.checked;
    const polygonsVisible = polygonLayerToggle.checked;

    // Use resetImage to redraw base and grid efficiently
    resetImage(false); // false = don't update status msg

    // Draw detection layer if visible AND results exist
    if (detectionVisible && detectionResults && detectionResults.length > 0) {
        drawDetectionLayer();
    }

    // Draw polygon layer if visible AND results exist
    if (polygonsVisible && polygons && polygons.length > 0) {
        drawPolygonLayer();
    }
} 