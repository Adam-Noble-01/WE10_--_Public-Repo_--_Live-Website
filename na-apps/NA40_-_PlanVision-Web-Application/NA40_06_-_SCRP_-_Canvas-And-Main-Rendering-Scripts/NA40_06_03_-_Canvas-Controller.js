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
let isInitialized = false;            // Flag to track if controller is initialized
let currentImage = null;              // Current image being displayed

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
    if (isInitialized) {
        console.log("Canvas controller already initialized");
        return;
    }
    
    console.log("Initializing canvas controller...");
    
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
    
    // Mark as initialized
    isInitialized = true;
    
    console.log("Canvas controller initialized successfully");
    
    // Register with module system if available
    if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === "function") {
        window.moduleIntegration.registerModuleReady("canvasController");
    }
    
    // Listen for image loaded events
    document.addEventListener('imageLoaded', (event) => {
        console.log("Image loaded event received in Canvas Controller");
        if (event.detail && event.detail.image) {
            setCurrentImage(event.detail.image);
        }
    });
    
    return true;
}

/**
 * Set the current image for rendering
 * @param {HTMLImageElement} image - The image to render
 */
function setCurrentImage(image) {
    if (!image) {
        console.warn("Attempted to set null image");
        return;
    }
    
    console.log("Setting current image in Canvas Controller:", 
        `${image.width}x${image.height} (natural: ${image.naturalWidth}x${image.naturalHeight})`);
    
    currentImage = image;
    
    // Reset view to show the full image
    resetView();
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
 * Reset the view to show the entire image centered
 */
function resetView() {
    // Cancel any ongoing animation
    isAnimating = false;
    
    // Reset zoom factor
    zoomFactor = DEFAULT_ZOOM_FACTOR;
    
    // Center the image
    if (currentImage && currentImage.naturalWidth && currentImage.naturalHeight) {
        // Calculate the position to center the image
        offsetX = (canvasWidth - currentImage.naturalWidth * zoomFactor) / 2;
        offsetY = (canvasHeight - currentImage.naturalHeight * zoomFactor) / 2;
    } else {
        // If no image is available, just center at origin
        offsetX = canvasWidth / 2;
        offsetY = canvasHeight / 2;
    }
    
    // Force a re-render
    requestAnimationFrame(renderLoop);
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
    // Clear the canvas
    if (ctx) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    
    // Handle zoom animation if active
    if (isAnimating) {
        updateZoomAnimation(timestamp);
    }
    
    // Render the current plan image
    if (ctx && currentImage) {
        try {
            ctx.save();
            
            // Apply transformations for pan and zoom
            ctx.translate(offsetX, offsetY);
            ctx.scale(zoomFactor, zoomFactor);
            
            // Draw the image
            ctx.drawImage(currentImage, 0, 0);
            
            ctx.restore();
        } catch (error) {
            console.error("Error rendering image:", error);
        }
    } else if (ctx) {
        // Display a message if no image is loaded
        ctx.save();
        ctx.fillStyle = "#777";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No image loaded", canvasWidth / 2, canvasHeight / 2);
        ctx.restore();
    }
    
    // Render measurements if available
    if (window.measurementTools && typeof window.measurementTools.renderMeasurements === "function") {
        try {
            ctx.save();
            window.measurementTools.renderMeasurements(ctx, offsetX, offsetY, zoomFactor);
            ctx.restore();
        } catch (error) {
            console.error("Error rendering measurements:", error);
        }
    }
    
    // Continue the render loop
    requestAnimationFrame(renderLoop);
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
    finalOffsetY: 0,
    
    // Additional methods
    setCurrentImage: setCurrentImage,
    isInitialized: () => isInitialized
};

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for DOM content and drawing data
--------------------------------------------
*/

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Don't auto-initialize - let the module system handle it
    console.log("Canvas Controller ready for initialization");
}); 