/*
================================================================================
JAVASCRIPT |  CANVAS RENDERER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Manages canvas rendering and view transformations
- Handles drawing, zooming, panning, and view reset
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  CANVAS STATE
- Introduced in v2.0.0
DESCRIPTION
- State variables for the canvas and viewport
--------------------------------------------
*/

// Canvas and view state variables
let canvas = null;
let ctx = null;
let offsetX = 0;
let offsetY = 0;
let zoomFactor = 1.0;
let isDragging = false;
let lastX = 0;
let lastY = 0;

// Create namespace for this module
window.canvasRenderer = {};

// FUNCTION |  Initialize the canvas renderer
// --------------------------------------------------------- //
window.canvasRenderer.init = function() {
    // Get the canvas element
    canvas = document.getElementById("CNVS__Plan");
    if (!canvas) {
        console.error("CANVAS_RENDERER: Canvas element not found");
        return;
    }
    
    // Get the rendering context
    ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("CANVAS_RENDERER: Could not get canvas context");
        return;
    }
    
    // Set up canvas dimensions
    window.canvasRenderer.resizeCanvas();
    
    // Attach event listeners for canvas interactions
    window.canvasRenderer.attachEventListeners();
    
    // Start render loop
    window.canvasRenderer.startRenderLoop();
    
    console.log("CANVAS_RENDERER: Initialized");
    
    // Listen for image loaded events
    document.addEventListener('imageLoaded', (event) => {
        console.log("CANVAS_RENDERER: Image loaded event received");
        // Request a redraw when an image is loaded
        requestAnimationFrame(window.canvasRenderer.drawCanvas);
    });
};

// FUNCTION |  Resize the canvas to match its container
// --------------------------------------------------------- //
window.canvasRenderer.resizeCanvas = function() {
    if (!canvas) return;
    
    // Get the container element
    const container = canvas.parentElement;
    if (!container) return;
    
    // Set canvas dimensions to match container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    console.log("CANVAS_RENDERER: Canvas resized to", canvas.width, "x", canvas.height);
    
    // Request a redraw
    requestAnimationFrame(window.canvasRenderer.drawCanvas);
};

// FUNCTION |  Set up event listeners for canvas interactions
// --------------------------------------------------------- //
window.canvasRenderer.attachEventListeners = function() {
    if (!canvas) return;
    
    // Mouse events for panning and zooming
    canvas.addEventListener('mousedown', window.canvasRenderer.onMouseDown);
    document.addEventListener('mousemove', window.canvasRenderer.onMouseMove);
    document.addEventListener('mouseup', window.canvasRenderer.onMouseUp);
    canvas.addEventListener('wheel', window.canvasRenderer.onMouseWheel);
    
    // Window resize event
    window.addEventListener('resize', window.canvasRenderer.resizeCanvas);
    
    console.log("CANVAS_RENDERER: Event listeners attached");
};

// FUNCTION |  Start the rendering loop
// --------------------------------------------------------- //
window.canvasRenderer.startRenderLoop = function() {
    // Request first animation frame
    requestAnimationFrame(window.canvasRenderer.renderLoop);
    console.log("CANVAS_RENDERER: Render loop started");
};

// FUNCTION |  Main render loop
// --------------------------------------------------------- //
window.canvasRenderer.renderLoop = function() {
    // Draw canvas
    window.canvasRenderer.drawCanvas();
    
    // Request next animation frame
    requestAnimationFrame(window.canvasRenderer.renderLoop);
};

// FUNCTION |  Draw the canvas
// --------------------------------------------------------- //
window.canvasRenderer.drawCanvas = function() {
    if (!ctx || !canvas) {
        console.error("CANVAS_RENDERER: Missing context or canvas");
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Check sources for the plan image
    let planImage = null;
    let imageSource = "";
    
    // Try from projectAssets first (compatibility layer)
    if (window.projectAssets && typeof window.projectAssets.isImageLoaded === 'function' && 
        window.projectAssets.isImageLoaded() && 
        typeof window.projectAssets.getPlanImage === 'function') {
        
        planImage = window.projectAssets.getPlanImage();
        imageSource = "projectAssets";
        console.log("CANVAS_RENDERER: Using image from projectAssets");
    }
    // Try from drawingManager directly as fallback
    else if (window.drawingManager && typeof window.drawingManager.isImageLoaded === 'function' && 
             window.drawingManager.isImageLoaded() && 
             typeof window.drawingManager.getPlanImage === 'function') {
        
        planImage = window.drawingManager.getPlanImage();
        imageSource = "drawingManager";
        console.log("CANVAS_RENDERER: Using image from drawingManager");
    }
    
    // If we have a valid image, render it
    if (planImage && planImage.complete) {
        try {
            console.log(`CANVAS_RENDERER: Rendering image from ${imageSource}`);
            console.log(`CANVAS_RENDERER: Image dimensions: ${planImage.naturalWidth}x${planImage.naturalHeight}, Complete: ${planImage.complete}`);
            
            // Save canvas state
            ctx.save();
            
            // Apply transformations
            ctx.translate(offsetX, offsetY);
            ctx.scale(zoomFactor, zoomFactor);
            
            // Apply drop shadow
            ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            // Draw the image
            try {
                ctx.drawImage(planImage, 0, 0);
                console.log("CANVAS_RENDERER: Successfully rendered image");
            } catch (error) {
                console.error("CANVAS_RENDERER: Error rendering image:", error);
                
                // Additional diagnostics if drawing fails
                console.error(`CANVAS_RENDERER: Image state - Width: ${planImage.width}, Height: ${planImage.height}, Complete: ${planImage.complete}, Failed: ${planImage.failedToLoad}`);
                
                // Try an alternative approach
                if (planImage.src) {
                    console.log("CANVAS_RENDERER: Attempting to draw using alternative method");
                    const tempImage = new Image();
                    tempImage.crossOrigin = "anonymous";
                    tempImage.onload = () => {
                        ctx.drawImage(tempImage, 0, 0);
                        console.log("CANVAS_RENDERER: Alternative drawing method succeeded");
                    };
                    tempImage.onerror = (err) => {
                        console.error("CANVAS_RENDERER: Alternative drawing method failed:", err);
                    };
                    tempImage.src = planImage.src;
                }
            }
            
            // Restore canvas state
            ctx.restore();
            
            // Draw measurements if available
            if (window.measurementTools && typeof window.measurementTools.drawAllMeasurements === "function") {
                window.measurementTools.drawAllMeasurements(ctx, offsetX, offsetY, zoomFactor);
            }
            
            // Draw markups if available and active
            if (window.markupTools && typeof window.markupTools.drawAllMarkupPaths === "function") {
                window.markupTools.drawAllMarkupPaths(ctx, offsetX, offsetY, zoomFactor);
            }
        } catch (e) {
            console.error("CANVAS_RENDERER: Top level rendering error:", e);
        }
    } else {
        // No image loaded, draw message
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "20px Arial";
        ctx.fillStyle = "#666666";
        ctx.textAlign = "center";
        ctx.fillText("No image loaded. Select a drawing to view.", canvas.width / 2, canvas.height / 2);
        
        // Log diagnostic info
        console.log("CANVAS_RENDERER: No valid image found to render");
        console.log("CANVAS_RENDERER: projectAssets available:", !!window.projectAssets);
        console.log("CANVAS_RENDERER: drawingManager available:", !!window.drawingManager);
        
        if (window.projectAssets && typeof window.projectAssets.isImageLoaded === 'function') {
            console.log("CANVAS_RENDERER: projectAssets.isImageLoaded():", window.projectAssets.isImageLoaded());
        }
        
        if (window.drawingManager && typeof window.drawingManager.isImageLoaded === 'function') {
            console.log("CANVAS_RENDERER: drawingManager.isImageLoaded():", window.drawingManager.isImageLoaded());
        }
    }
};

// FUNCTION |  Handle mouse wheel event for zooming
// --------------------------------------------------------- //
window.canvasRenderer.onMouseWheel = function(e) {
    e.preventDefault();
    
    // Determine zoom direction
    const zoomIn = e.deltaY < 0;
    
    // Calculate zoom center (mouse position)
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom factor
    const factor = zoomIn ? 1.1 : 0.9;
    
    // Perform zoom
    window.canvasRenderer.zoom(factor, mouseX, mouseY);
};

// FUNCTION |  Handle mouse down event for panning
// --------------------------------------------------------- //
window.canvasRenderer.onMouseDown = function(e) {
    // Only start dragging on middle button or left button without active tool
    if (e.button === 1 || (e.button === 0 && (!window.measurementTools || !window.measurementTools.isToolActive()))) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.style.cursor = "grabbing";
        e.preventDefault();
    }
};

// FUNCTION |  Handle mouse move event for panning
// --------------------------------------------------------- //
window.canvasRenderer.onMouseMove = function(e) {
    if (isDragging) {
        // Calculate the distance moved
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        // Update the offset
        offsetX += dx;
        offsetY += dy;
        
        // Update last position
        lastX = e.clientX;
        lastY = e.clientY;
        
        // Request redraw
        requestAnimationFrame(window.canvasRenderer.drawCanvas);
    }
};

// FUNCTION |  Handle mouse up event for panning
// --------------------------------------------------------- //
window.canvasRenderer.onMouseUp = function(e) {
    if (isDragging) {
        isDragging = false;
        canvas.style.cursor = "default";
    }
};

// FUNCTION |  Perform zoom operation
// --------------------------------------------------------- //
window.canvasRenderer.zoom = function(factor, centerX, centerY) {
    // Calculate points before zoom
    const beforeX = (centerX - offsetX) / zoomFactor;
    const beforeY = (centerY - offsetY) / zoomFactor;
    
    // Apply zoom factor
    zoomFactor *= factor;
    
    // Limit zoom factor to reasonable range
    zoomFactor = Math.max(0.1, Math.min(10, zoomFactor));
    
    // Calculate points after zoom
    const afterX = (centerX - offsetX) / zoomFactor;
    const afterY = (centerY - offsetY) / zoomFactor;
    
    // Adjust offset to keep the point under the mouse fixed
    offsetX += (afterX - beforeX) * zoomFactor;
    offsetY += (afterY - beforeY) * zoomFactor;
    
    // Request redraw
    requestAnimationFrame(window.canvasRenderer.drawCanvas);
};

// FUNCTION |  Reset the view to fit the image
// --------------------------------------------------------- //
window.canvasRenderer.resetView = function() {
    if (!canvas) return;
    
    console.log("CANVAS_RENDERER: Resetting view");
    
    // Get image dimensions - try both potential sources
    let width = 0;
    let height = 0;
    
    // Try projectAssets first
    if (window.projectAssets && 
        typeof window.projectAssets.getNaturalImageWidth === 'function' && 
        typeof window.projectAssets.getNaturalImageHeight === 'function') {
        
        width = window.projectAssets.getNaturalImageWidth();
        height = window.projectAssets.getNaturalImageHeight();
        console.log("CANVAS_RENDERER: Got dimensions from projectAssets:", width, "x", height);
    }
    // Try drawingManager as fallback
    else if (window.drawingManager && 
             typeof window.drawingManager.getNaturalImageWidth === 'function' && 
             typeof window.drawingManager.getNaturalImageHeight === 'function') {
        
        width = window.drawingManager.getNaturalImageWidth();
        height = window.drawingManager.getNaturalImageHeight();
        console.log("CANVAS_RENDERER: Got dimensions from drawingManager:", width, "x", height);
    }
    
    // If no dimensions, can't reset view
    if (!width || !height) {
        console.warn("CANVAS_RENDERER: Cannot reset view, no image dimensions available");
        return;
    }
    
    // Calculate scale to fit image within canvas
    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave a margin
    
    // Set zoom factor
    zoomFactor = scale;
    
    // Center the image
    offsetX = (canvas.width - width * zoomFactor) / 2;
    offsetY = (canvas.height - height * zoomFactor) / 2;
    
    console.log("CANVAS_RENDERER: View reset, scale:", zoomFactor, "offset:", offsetX, offsetY);
    
    // Request redraw
    requestAnimationFrame(window.canvasRenderer.drawCanvas);
};

// FUNCTION |  Set current image to render
// --------------------------------------------------------- //
window.canvasRenderer.setCurrentImage = function(image) {
    // This function is included for backward compatibility
    // The image is now managed by the projectAssets module
    console.log("CANVAS_RENDERER: setCurrentImage called (compatibility method)");
    requestAnimationFrame(window.canvasRenderer.drawCanvas);
};

// FUNCTION |  Get the current canvas
// --------------------------------------------------------- //
window.canvasRenderer.getCanvas = function() {
    return canvas;
};

// FUNCTION |  Get the current context
// --------------------------------------------------------- //
window.canvasRenderer.getContext = function() {
    return ctx;
};

// FUNCTION |  Get the current zoom factor
// --------------------------------------------------------- //
window.canvasRenderer.getZoomFactor = function() {
    return zoomFactor;
};

// FUNCTION |  Get the current X offset
// --------------------------------------------------------- //
window.canvasRenderer.getOffsetX = function() {
    return offsetX;
};

// FUNCTION |  Get the current Y offset
// --------------------------------------------------------- //
window.canvasRenderer.getOffsetY = function() {
    return offsetY;
};

// FUNCTION |  Convert screen coordinates to plan coordinates
// --------------------------------------------------------- //
window.canvasRenderer.toPlanCoords = function(screenX, screenY) {
    return {
        x: (screenX - offsetX) / zoomFactor,
        y: (screenY - offsetY) / zoomFactor
    };
};

// LOG |  Module loaded
// --------------------------------------------------------- //
console.log("CANVAS_RENDERER: Module loaded");

// REGISTRATION |  Register with module integration system
// --------------------------------------------------------- //
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("canvasRenderer");
} 