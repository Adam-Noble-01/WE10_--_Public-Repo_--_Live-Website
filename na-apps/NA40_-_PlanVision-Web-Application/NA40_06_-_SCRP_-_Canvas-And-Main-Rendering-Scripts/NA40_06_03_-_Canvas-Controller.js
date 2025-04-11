/*
================================================================================
JAVASCRIPT |  CANVAS CONTROLLER
- Introduced in v2.0.0
DESCRIPTION
- Core canvas drawing and interaction handling
- Manages pan, zoom, rendering loop, and drawing operations
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  CANVAS CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for the canvas behavior
IMPORTANT NOTES
- These settings affect the overall feel of the application
--------------------------------------------
*/

// Configuration constants
const DEFAULT_ZOOM_FACTOR = 1.0;      // Default zoom level
const MIN_ZOOM_FACTOR = 0.1;          // Minimum zoom level
const MAX_ZOOM_FACTOR = 10.0;         // Maximum zoom level
const ZOOM_STEP = 0.1;                // Zoom increment/decrement step
const DOUBLE_CLICK_ZOOM_FACTOR = 1.5; // Zoom factor for double-click
const ZOOM_ANIMATION_MS = 200;        // Duration of zoom animation in milliseconds

/*
--------------------------------------------
JAVASCRIPT |  CANVAS STATE
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
--------------------------------------------
*/

// Canvas and drawing state
let planCanvas = null;                // Reference to main canvas element
let ctx = null;                       // Canvas rendering context
let offsetX = 0;                      // Pan offset X
let offsetY = 0;                      // Pan offset Y
let zoomFactor = DEFAULT_ZOOM_FACTOR; // Current zoom level
let isDragging = false;               // Whether user is dragging the canvas
let lastX = 0;                        // Last mouse X position for dragging
let lastY = 0;                        // Last mouse Y position for dragging
let canvasWidth = 0;                  // Canvas width
let canvasHeight = 0;                 // Canvas height
let isAnimating = false;              // Whether zoom animation is in progress
let zoomAnchorX = 0;                  // X coordinate of zoom anchor point
let zoomAnchorY = 0;                  // Y coordinate of zoom anchor point
let targetZoom = DEFAULT_ZOOM_FACTOR; // Target zoom level for animation
let animationStartTime = 0;           // Start time for zoom animation
let initialZoom = DEFAULT_ZOOM_FACTOR;// Initial zoom level for animation
let initialOffsetX = 0;               // Initial X offset for animation
let initialOffsetY = 0;               // Initial Y offset for animation

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up the canvas and initializes the rendering loop
--------------------------------------------
*/

/**
 * Initialize the canvas controller
 */
function initCanvasController() {
    // Get the canvas element
    planCanvas = document.getElementById("CNVS__Plan");
    if (!planCanvas) {
        console.error("Canvas element not found");
        return;
    }
    
    // Get the rendering context
    ctx = planCanvas.getContext("2d");
    
    // Initial canvas setup
    resizeCanvas();
    
    // Set up event listeners
    planCanvas.addEventListener("mousedown", onMouseDown);
    planCanvas.addEventListener("mousemove", onMouseMove);
    planCanvas.addEventListener("mouseup", onMouseUp);
    planCanvas.addEventListener("wheel", onWheel, { passive: false });
    planCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
    planCanvas.addEventListener("touchmove", onTouchMove, { passive: false });
    planCanvas.addEventListener("touchend", onTouchEnd);
    
    // Set up window resize listener
    window.addEventListener("resize", onResize);
    
    // Set up reset view button
    const resetViewBtn = document.getElementById("BTTN__Reset-View");
    if (resetViewBtn) {
        resetViewBtn.addEventListener("click", resetView);
    }
    
    // Set up fullscreen toggle button
    const fullscreenBtn = document.getElementById("BTTN__Fullscreen-Toggle");
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", toggleFullscreen);
    }
    
    // Start render loop
    requestAnimationFrame(renderLoop);
    
    console.log("Canvas controller initialized");
}

/**
 * Resize the canvas to fit its container
 */
function resizeCanvas() {
    if (!planCanvas) return;
    
    const container = planCanvas.parentElement;
    if (!container) return;
    
    // Set canvas dimensions to match container
    canvasWidth = container.clientWidth;
    canvasHeight = container.clientHeight;
    planCanvas.width = canvasWidth;
    planCanvas.height = canvasHeight;
    
    // Force a re-render
    requestAnimationFrame(renderLoop);
}

/**
 * Handle window resize events
 */
function onResize() {
    resizeCanvas();
}

/*
--------------------------------------------
JAVASCRIPT |  EVENT HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Event handlers for mouse and touch interactions
--------------------------------------------
*/

/**
 * Handle mouse down events
 * @param {MouseEvent} event - Mouse down event
 */
function onMouseDown(event) {
    // Prevent default behavior
    event.preventDefault();
    
    // Check if we should handle this as a measurement interaction
    if (window.measurementTools && typeof window.measurementTools.handleMouseDown === "function" && 
        window.measurementTools.currentTool) {
        window.measurementTools.handleMouseDown(event);
        return;
    }
    
    // Start dragging the canvas
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    planCanvas.style.cursor = "grabbing";
}

/**
 * Handle mouse move events
 * @param {MouseEvent} event - Mouse move event
 */
function onMouseMove(event) {
    // Check if we should handle this as a measurement interaction
    if (window.measurementTools && typeof window.measurementTools.handleMouseMove === "function" && 
        window.measurementTools.currentTool) {
        window.measurementTools.handleMouseMove(event);
        return;
    }
    
    // Handle panning if dragging
    if (isDragging) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        offsetX += dx;
        offsetY += dy;
        lastX = event.clientX;
        lastY = event.clientY;
    }
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event - Mouse up event
 */
function onMouseUp(event) {
    // Check if we should handle this as a measurement interaction
    if (window.measurementTools && typeof window.measurementTools.handleMouseUp === "function" && 
        window.measurementTools.currentTool) {
        window.measurementTools.handleMouseUp(event);
        return;
    }
    
    // End dragging
    isDragging = false;
    planCanvas.style.cursor = "default";
}

/**
 * Handle mouse wheel events for zooming
 * @param {WheelEvent} event - Mouse wheel event
 */
function onWheel(event) {
    // Prevent default behavior (page scrolling)
    event.preventDefault();
    
    // Calculate the zoom point in canvas space
    const rect = planCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate point in image space
    const pointX = (mouseX - offsetX) / zoomFactor;
    const pointY = (mouseY - offsetY) / zoomFactor;
    
    // Determine zoom direction (in or out)
    const wheel = event.deltaY < 0 ? 1 : -1;
    const zoomChange = wheel * ZOOM_STEP;
    
    // Calculate new zoom factor
    let newZoom = zoomFactor + zoomChange;
    newZoom = Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, newZoom));
    
    // Animate the zoom
    animateZoom(newZoom, pointX, pointY);
}

/*
--------------------------------------------
JAVASCRIPT |  TOUCH HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Event handlers for touch interactions (mobile devices)
--------------------------------------------
*/

/**
 * Handle touch start events
 * @param {TouchEvent} event - Touch start event
 */
function onTouchStart(event) {
    // Prevent default behavior (page scrolling, etc.)
    event.preventDefault();
    
    // Single touch - handle as mouse down for panning
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        isDragging = true;
    }
}

/**
 * Handle touch move events
 * @param {TouchEvent} event - Touch move event
 */
function onTouchMove(event) {
    // Prevent default behavior
    event.preventDefault();
    
    // Single touch - handle as mouse move for panning
    if (event.touches.length === 1 && isDragging) {
        const touch = event.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        offsetX += dx;
        offsetY += dy;
        lastX = touch.clientX;
        lastY = touch.clientY;
    }
}

/**
 * Handle touch end events
 * @param {TouchEvent} event - Touch end event
 */
function onTouchEnd(event) {
    // End dragging
    isDragging = false;
}

/*
--------------------------------------------
JAVASCRIPT |  VIEW MANIPULATION
- Introduced in v2.0.0
DESCRIPTION
- Functions for manipulating the canvas view (pan, zoom, reset)
--------------------------------------------
*/

/**
 * Reset the view to fit the drawing
 */
function resetView() {
    // Get drawing dimensions from project assets
    const projectAssets = window.projectAssets;
    if (!projectAssets || typeof projectAssets.getPlanImage !== "function") {
        console.warn("Project assets not available, cannot reset view");
        return;
    }
    
    const planImage = projectAssets.getPlanImage();
    if (!planImage) {
        console.warn("Plan image not available, cannot reset view");
        return;
    }
    
    // Calculate scaling to fit the image in the canvas
    const imgWidth = planImage.naturalWidth;
    const imgHeight = planImage.naturalHeight;
    
    if (imgWidth === 0 || imgHeight === 0) {
        console.warn("Plan image dimensions are zero, cannot reset view");
        return;
    }
    
    // Calculate scaling to fit the image in the canvas
    const scaleX = canvasWidth / imgWidth;
    const scaleY = canvasHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY) * 0.95; // 5% margin
    
    // Center the image
    const newOffsetX = (canvasWidth - imgWidth * scale) / 2;
    const newOffsetY = (canvasHeight - imgHeight * scale) / 2;
    
    // Animate to the new view
    animateZoom(scale, imgWidth / 2, imgHeight / 2, newOffsetX, newOffsetY);
}

/**
 * Animate zoom to a target level
 * @param {number} targetZoomLevel - The target zoom level
 * @param {number} anchorX - X coordinate of the point to zoom around in image space
 * @param {number} anchorY - Y coordinate of the point to zoom around in image space
 * @param {number} finalOffsetX - Final offset X (optional, for resetView)
 * @param {number} finalOffsetY - Final offset Y (optional, for resetView)
 */
function animateZoom(targetZoomLevel, anchorX, anchorY, finalOffsetX = null, finalOffsetY = null) {
    // Store the animation parameters
    initialZoom = zoomFactor;
    targetZoom = targetZoomLevel;
    zoomAnchorX = anchorX;
    zoomAnchorY = anchorY;
    animationStartTime = performance.now();
    isAnimating = true;
    initialOffsetX = offsetX;
    initialOffsetY = offsetY;
    
    // For reset view, we use the provided final offsets
    if (finalOffsetX !== null && finalOffsetY !== null) {
        window.canvasController.finalOffsetX = finalOffsetX;
        window.canvasController.finalOffsetY = finalOffsetY;
        window.canvasController.useCustomOffset = true;
    } else {
        window.canvasController.useCustomOffset = false;
    }
}

/**
 * Update zoom with animation
 * @param {number} timestamp - Current animation timestamp
 */
function updateZoomAnimation(timestamp) {
    if (!isAnimating) return;
    
    // Calculate progress (0 to 1)
    const elapsed = timestamp - animationStartTime;
    const progress = Math.min(elapsed / ZOOM_ANIMATION_MS, 1);
    
    // Use easing function for smooth animation
    const easedProgress = easeInOutCubic(progress);
    
    // Interpolate between initial and target zoom
    const currentZoom = initialZoom + (targetZoom - initialZoom) * easedProgress;
    
    // Calculate new offsets
    if (window.canvasController.useCustomOffset) {
        // For resetView, interpolate to the final offset
        offsetX = initialOffsetX + (window.canvasController.finalOffsetX - initialOffsetX) * easedProgress;
        offsetY = initialOffsetY + (window.canvasController.finalOffsetY - initialOffsetY) * easedProgress;
    } else {
        // For normal zoom, keep the anchor point stable
        const mouseX = zoomAnchorX * currentZoom;
        const mouseY = zoomAnchorY * currentZoom;
        offsetX = mouseX - (mouseX - initialOffsetX) * (currentZoom / initialZoom);
        offsetY = mouseY - (mouseY - initialOffsetY) * (currentZoom / initialZoom);
    }
    
    // Update the zoom factor
    zoomFactor = currentZoom;
    
    // Check if animation is complete
    if (progress >= 1) {
        isAnimating = false;
    }
}

/**
 * Easing function for smooth animations
 * @param {number} t - Progress value (0 to 1)
 * @returns {number} - Eased value (0 to 1)
 */
function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen
        const appContainer = document.getElementById("PLAN__Container");
        if (appContainer && appContainer.requestFullscreen) {
            appContainer.requestFullscreen()
                .then(() => {
                    console.log("Entered fullscreen mode");
                    resizeCanvas();
                })
                .catch(err => {
                    console.error("Error entering fullscreen mode:", err);
                });
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen()
                .then(() => {
                    console.log("Exited fullscreen mode");
                    resizeCanvas();
                })
                .catch(err => {
                    console.error("Error exiting fullscreen mode:", err);
                });
        }
    }
}

/*
--------------------------------------------
JAVASCRIPT |  RENDERING
- Introduced in v2.0.0
DESCRIPTION
- Main rendering loop and drawing functions
--------------------------------------------
*/

/**
 * Main rendering loop
 * @param {number} timestamp - Current animation timestamp
 */
function renderLoop(timestamp) {
    // Request the next frame immediately
    requestAnimationFrame(renderLoop);
    
    // Update zoom animation if in progress
    if (isAnimating) {
        updateZoomAnimation(timestamp);
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);
    
    // Save canvas state
    ctx.save();
    
    // Apply transformations for panning and zooming
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    
    // Get the project assets
    const projectAssets = window.projectAssets;
    const isImageLoaded = projectAssets && typeof projectAssets.isImageLoaded === "function" && projectAssets.isImageLoaded();
    
    // Draw the content based on what's available
    if (isImageLoaded) {
        // Check if we're using fallback HTML content
        if (window.usingFallbackContent && window.fallbackIframe) {
            // No need to draw fallback content - the iframe is behind the canvas
            // Just draw a frame to show the drawing area
            ctx.strokeStyle = "#999";
            ctx.lineWidth = 2 / zoomFactor;
            ctx.strokeRect(0, 0, 800, 600);
        } else {
            // Draw the plan image
            const planImage = projectAssets.getPlanImage();
            
            // Add drop shadow effect
            ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            // Draw the image
            ctx.drawImage(planImage, 0, 0);
        }
    } else {
        // Draw a loading/empty state indicator
        ctx.font = (30 / zoomFactor) + "px Arial";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText("Loading drawing...", 400, 300);
    }
    
    // Restore canvas state
    ctx.restore();
    
    // Draw measurements if available
    if (window.measurementTools && typeof window.measurementTools.drawAllMeasurements === "function") {
        // Update the measurement tools with current transform
        window.measurementTools.offsetX = offsetX;
        window.measurementTools.offsetY = offsetY;
        window.measurementTools.zoomFactor = zoomFactor;
        
        // Draw all measurements
        window.measurementTools.drawAllMeasurements(ctx);
    }
}

/*
--------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Export functions for use by other modules
--------------------------------------------
*/

// Export the module's public API
window.canvasController = {
    // Initialization
    init: initCanvasController,
    
    // View manipulation
    resetView: resetView,
    toggleFullscreen: toggleFullscreen,
    
    // State
    offsetX: 0,
    offsetY: 0,
    zoomFactor: DEFAULT_ZOOM_FACTOR,
    
    // Canvas access
    getCanvas: () => planCanvas,
    getContext: () => ctx,
    
    // Animation state (internal)
    useCustomOffset: false,
    finalOffsetX: 0,
    finalOffsetY: 0
};

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for DOM content and drawing data
--------------------------------------------
*/

// Initialize when a drawing is loaded
document.addEventListener('drawingLoaded', () => {
    console.log('Drawing loaded, initializing canvas controller...');
    initCanvasController();
});

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing canvas controller...');
    initCanvasController();
});

// Optional: Auto-initialize if the document is already loaded
if (document.readyState === 'complete') {
    console.log('Document already loaded, initializing canvas controller...');
    initCanvasController();
} 