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
export let originalImage = null; // Store the original image element reference
export let showGrid = false;
export let gridSize = 10; // Default grid size in mm (adaptive)
export let unifyIslands = true; // Default enabled for new unify islands feature
// Zoom and pan variables
export let zoomLevel = 1.0;
export let offsetX = 0;
export let offsetY = 0;
// Dragging state (modified to be private)
let _isDragging = false;
let _lastMouseX = 0;
let _lastMouseY = 0;
// Pinch zoom variables
let _pinchPivotX = undefined;
let _pinchPivotY = undefined;

// Getters and setters for canvas and context
export function getCanvas() { return canvas; }
export function getContext() { return ctx; }
export function setCanvas(newCanvas) { canvas = newCanvas; }
export function setContext(newContext) { ctx = newContext; }
export function setOriginalImageData(newImageData) { originalImageData = newImageData; }
export function setOriginalImage(image) { originalImage = image; }

// Additional setters for state variables
export function setPixelsPerMm(value) { pixelsPerMm = value; }
export function setShowGrid(value) { showGrid = value; }
export function setUnifyIslands(value) { unifyIslands = value; }
export function clearDetectionResults() { detectionResults.length = 0; }
export function clearPolygons() { polygons.length = 0; }
export function setGridSize(value) { gridSize = value; }
// Zoom and pan setters
export function setZoomLevel(value) { 
    zoomLevel = Math.min(Math.max(value, 0.1), 10.0); // Limit zoom level between 0.1x and 10x
}
export function setOffset(x, y) { 
    offsetX = x; 
    offsetY = y; 
}
export function resetView() {
    zoomLevel = 1.0;
    offsetX = 0;
    offsetY = 0;
}

// Dragging state getters and setters
export function isDragging() { return _isDragging; }
export function setIsDragging(value) { _isDragging = value; }
export function getLastMouseX() { return _lastMouseX; }
export function getLastMouseY() { return _lastMouseY; }
export function setLastMousePos(x, y) { _lastMouseX = x; _lastMouseY = y; }
// Pinch zoom getters and setters
export function setPinchPivot(x, y) { _pinchPivotX = x; _pinchPivotY = y; }
export function clearPinchPivot() { _pinchPivotX = undefined; _pinchPivotY = undefined; }
export function getPinchPivot() { 
    return { 
        x: _pinchPivotX, 
        y: _pinchPivotY,
        isDefined: _pinchPivotX !== undefined && _pinchPivotY !== undefined
    }; 
}

// --- Shared UI Elements ---
export let sliders = {};
export let valueDisplays = {};

// --- Shared Functions ---
const MAX_STATUS_MESSAGES = 5; // Maximum number of messages to show in the status panel
let statusMessages = []; // Array to store recent status messages

export function showStatus(message, isError = false, isWarning = false, autoHideDelay = 3000) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    message = message.replace(/window pane/gi, 'architectural element');
    message = message.replace(/pane/gi, 'element');
    
    // Format date-time stamp for the message
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    
    // Add the new message to our array
    const newMessage = {
        text: formattedMessage,
        isError: isError, 
        isWarning: isWarning,
        timestamp: now
    };
    
    statusMessages.unshift(newMessage); // Add to beginning of array
    
    // Keep only the most recent messages
    if (statusMessages.length > MAX_STATUS_MESSAGES) {
        statusMessages = statusMessages.slice(0, MAX_STATUS_MESSAGES);
    }
    
    // Update the status display with all recent messages
    updateStatusDisplay();
    
    // Log to console for debugging
    if (isError) console.error(message);
    else if (isWarning) console.warn(message);
    else console.log(message);
    
    // We don't auto-hide the panel anymore, just keep showing the messages
}

function updateStatusDisplay() {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    // Make sure the panel is visible
    statusEl.style.display = 'block';
    statusEl.className = 'APPL__Status-Panel';
    
    // Set message count for the badge
    const messageCount = statusMessages.length;
    statusEl.setAttribute('data-count', messageCount > 0 ? messageCount : '0');
    
    // Clear current content
    statusEl.innerHTML = '';
    
    // Create a container for messages to ensure proper spacing
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'status-messages-container';
    statusEl.appendChild(messagesContainer);
    
    // Add each message with proper styling
    statusMessages.forEach((msg, index) => {
        const msgElement = document.createElement('div');
        
        // Wrap message text in a span for better styling control
        const textSpan = document.createElement('span');
        textSpan.textContent = msg.text;
        textSpan.style.display = 'inline-block';
        textSpan.style.width = '100%';
        
        msgElement.appendChild(textSpan);
        msgElement.className = 'status-message';
        
        if (msg.isError) msgElement.classList.add('error');
        if (msg.isWarning) msgElement.classList.add('warning');
        
        // Add a separator between messages except for the last one
        if (index < statusMessages.length - 1) {
            msgElement.style.borderBottom = '1px dotted #ccc';
            msgElement.style.marginBottom = '0.5rem';
            msgElement.style.paddingBottom = '0.5rem';
        }
        
        messagesContainer.appendChild(msgElement);
    });
    
    // If no messages, show an empty placeholder
    if (statusMessages.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.textContent = 'No recent messages';
        placeholder.className = 'status-placeholder';
        placeholder.style.fontStyle = 'italic';
        placeholder.style.color = '#999';
        placeholder.style.padding = '1rem 0';
        placeholder.style.textAlign = 'center';
        messagesContainer.appendChild(placeholder);
    }
    
    // Ensure first message is fully visible if there are messages
    if (statusMessages.length > 0) {
        statusEl.scrollTop = 0;
    }
}

export function hideStatus() {
    // We don't actually hide the panel anymore, just clear the messages
    statusMessages = [];
    updateStatusDisplay();
}

export function resetImage(updateStatus = true) {
    if (ctx && canvas) {
        // Clear entire canvas first with reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply zoom and pan transformations
        ctx.setTransform(zoomLevel, 0, 0, zoomLevel, offsetX, offsetY);
        
        // Preferred: Use the original image element when available (better quality with transforms)
        if (originalImage) {
            // Draw directly from the image element - this properly handles transforms
            ctx.drawImage(originalImage, 0, 0, originalImage.width, originalImage.height);
        }
        // Fallback: Use the image data if image element isn't available
        else if (originalImageData) {
            // We need to use a temporary canvas to convert ImageData to an image
            // putImageData doesn't respect transformations
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImageData.width;
            tempCanvas.height = originalImageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(originalImageData, 0, 0);
            
            // Now draw the temp canvas onto the main canvas - this will respect transformations
            ctx.drawImage(tempCanvas, 0, 0);
        }
        
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

    // Save the current context state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.setTransform(zoomLevel, 0, 0, zoomLevel, offsetX, offsetY);
    
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.15)';
    ctx.lineWidth = 0.5 / zoomLevel; // Adjust line width for zoom level

    // Calculate visible area in the original image coordinates
    const visibleLeft = -offsetX / zoomLevel;
    const visibleTop = -offsetY / zoomLevel;
    const visibleRight = (canvas.width - offsetX) / zoomLevel;
    const visibleBottom = (canvas.height - offsetY) / zoomLevel;

    // Adjust grid line start to align with grid
    const startX = Math.floor(visibleLeft / gridSizePixels) * gridSizePixels;
    const startY = Math.floor(visibleTop / gridSizePixels) * gridSizePixels;

    // Draw vertical lines
    for (let x = startX; x <= visibleRight; x += gridSizePixels) {
        ctx.beginPath();
        ctx.moveTo(x, visibleTop);
        ctx.lineTo(x, visibleBottom);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = startY; y <= visibleBottom; y += gridSizePixels) {
        ctx.beginPath();
        ctx.moveTo(visibleLeft, y);
        ctx.lineTo(visibleRight, y);
        ctx.stroke();
    }
    
    // Add grid size label in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for UI elements
    ctx.fillStyle = 'rgba(0, 0, 150, 0.6)';
    ctx.font = '10px Arial';
    const label = `${gridSize}mm grid (${zoomLevel.toFixed(1)}x zoom)`;
    ctx.fillRect(5, 5, ctx.measureText(label).width + 10, 15);
    ctx.fillStyle = 'white';
    ctx.fillText(label, 10, 16);

    // Restore the original context state
    ctx.restore();
}

export function drawLayer(pointArrays, isDetectionLayer) {
    if (!pointArrays || pointArrays.length === 0 || !ctx) return;

    const fillColor = isDetectionLayer ? 'rgba(0, 180, 0, 0.15)' : 'rgba(70, 130, 180, 0.2)';
    const strokeColor = isDetectionLayer ? 'rgba(0, 180, 0, 0.8)' : 'rgba(70, 130, 180, 0.9)';
    const lineWidth = isDetectionLayer ? 1.5 : 2;
    const vertexFill = isDetectionLayer ? 'rgba(0, 100, 0, 0.8)' : 'rgba(0, 0, 200, 0.8)';
    const vertexSize = isDetectionLayer ? 1.5 : 2;

    // Save the current context state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.setTransform(zoomLevel, 0, 0, zoomLevel, offsetX, offsetY);
    
    // Adjust line width for zoom level
    ctx.lineWidth = lineWidth / zoomLevel;

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
        
        // Draw vertices
        ctx.fillStyle = vertexFill;
        for (const p of points) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, vertexSize / zoomLevel, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    // Restore the context state
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

    // Clear the entire canvas with no transformations applied
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw base layer if visible
    if (baseVisible) {
        if (originalImage) {
            // Set zoom transformation
            ctx.setTransform(zoomLevel, 0, 0, zoomLevel, offsetX, offsetY);
            // Draw the original image with proper transformation
            ctx.drawImage(originalImage, 0, 0, originalImage.width, originalImage.height);
        } else if (originalImageData) {
            // Create a temporary canvas for the image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = originalImageData.width;
            tempCanvas.height = originalImageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(originalImageData, 0, 0);
            
            // Set zoom transformation
            ctx.setTransform(zoomLevel, 0, 0, zoomLevel, offsetX, offsetY);
            // Draw with proper transformation
            ctx.drawImage(tempCanvas, 0, 0);
        }
        
        // Draw grid if enabled
        if (showGrid && pixelsPerMm) {
            drawGrid();
        }
    }

    // Draw detection layer if visible AND results exist
    if (detectionVisible && detectionResults && detectionResults.length > 0) {
        drawDetectionLayer();
    }

    // Draw polygon layer if visible AND results exist
    if (polygonsVisible && polygons && polygons.length > 0) {
        drawPolygonLayer();
    }
    
    // Update zoom level indicator in UI - reset transform for UI elements
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const zoomIndicator = document.getElementById('zoomIndicator');
    if (zoomIndicator) {
        zoomIndicator.textContent = `Zoom: ${zoomLevel.toFixed(1)}x`;
    }
}

// Helper function to convert screen coordinates to image coordinates
export function screenToImageCoords(screenX, screenY) {
    return {
        x: (screenX - offsetX) / zoomLevel,
        y: (screenY - offsetY) / zoomLevel
    };
}

// Helper function to convert image coordinates to screen coordinates
export function imageToScreenCoords(imageX, imageY) {
    return {
        x: imageX * zoomLevel + offsetX,
        y: imageY * zoomLevel + offsetY
    };
} 