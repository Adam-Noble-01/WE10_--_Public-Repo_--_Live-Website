/*
================================================================================
JAVASCRIPT |  CANVAS RENDERER
- Introduced in v2.0.0
DESCRIPTION
- Manages the rendering of drawings to the canvas
- Handles canvas setup, draw loop, and view transformations
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

// Canvas and context references
let canvas = null;
let ctx = null;

// View state for transformations
let viewState = {
    scale: 1.0,              // Current zoom level
    offsetX: 0,              // Current horizontal offset
    offsetY: 0,              // Current vertical offset
    isDragging: false,       // Whether view is being dragged
    dragStartX: 0,           // Starting X position for drag
    dragStartY: 0,           // Starting Y position for drag
    lastFrameTime: 0,        // Last frame timestamp for animation
    needsRedraw: true,       // Whether canvas needs to be redrawn
    currentImage: null,      // Current image being displayed
    renderLoopActive: false  // Whether render loop is active
};

// Module initialization state
let initialized = false;

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Functions for setting up the canvas
--------------------------------------------
*/

/**
 * Initialize the canvas renderer
 * @returns {Promise} Promise that resolves when initialization is complete
 */
function initializeCanvasRenderer() {
    return new Promise((resolve, reject) => {
        try {
            console.log('🏁 Initializing Canvas Renderer');
            
            // Get the canvas element using the proper ID from the stylesheet
            canvas = document.getElementById('CNVS__Plan');
            if (!canvas) {
                console.warn('⚠️ Canvas element not found, will create it');
                // Create canvas if it doesn't exist
                canvas = document.createElement('canvas');
                canvas.id = 'CNVS__Plan';
                
                // Apply styles to canvas
                Object.assign(canvas.style, {
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    zIndex: '10'
                });
                
                // Add canvas to container using the proper ID from the stylesheet
                const container = document.getElementById('CNVS__Container');
                if (!container) {
                    const errorMsg = 'Canvas container not found (CNVS__Container)';
                    console.error('❌ ' + errorMsg);
                    reject(new Error(errorMsg));
                    return;
                }
                container.appendChild(canvas);
                console.log('✅ Created new canvas element');
            } else {
                console.log('✅ Found existing canvas element', canvas);
            }
            
            // Get drawing context
            ctx = canvas.getContext('2d');
            if (!ctx) {
                const errorMsg = 'Failed to get canvas context';
                console.error('❌ ' + errorMsg);
                reject(new Error(errorMsg));
                return;
            }
            
            // Ensure canvas has size
            if (canvas.width === 0 || canvas.height === 0) {
                console.warn('⚠️ Canvas has zero dimensions, forcing resize');
                const container = canvas.parentElement;
                if (container) {
                    canvas.width = container.clientWidth || 800;
                    canvas.height = container.clientHeight || 600;
                } else {
                    canvas.width = 800;
                    canvas.height = 600;
                }
            }
            
            console.log('📊 Canvas dimensions:', { 
                width: canvas.width, 
                height: canvas.height,
                style: {
                    width: canvas.style.width,
                    height: canvas.style.height
                },
                offsetWidth: canvas.offsetWidth,
                offsetHeight: canvas.offsetHeight
            });
            
            // Set up event listeners for interactions
            setupEventListeners();
            
            // Start render loop
            startRenderLoop();
            
            // Set initialized flag
            initialized = true;
            
            // Log success
            console.log('🎉 Canvas Renderer initialization complete');
            
            // Resolve promise
            resolve();
        } catch (error) {
            console.error('❌ Failed to initialize Canvas Renderer:', error);
            reject(error);
        }
    });
}

/**
 * Set up event listeners for canvas interactions
 */
function setupEventListeners() {
    if (!canvas) return;
    
    // Mouse wheel for zooming
    canvas.addEventListener('wheel', handleMouseWheel);
    
    // Mouse events for panning
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Window resize handler
    window.addEventListener('resize', handleResize);
    
    // Initial resize to set canvas dimensions
    handleResize();
}

/**
 * Handle window resize event
 */
function handleResize() {
    if (!canvas) return;
    
    // Get the container dimensions
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Set canvas dimensions to match container
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Request redraw
    viewState.needsRedraw = true;
}

/*
--------------------------------------------
JAVASCRIPT |  RENDERING
- Introduced in v2.0.0
DESCRIPTION
- Functions for rendering to the canvas
--------------------------------------------
*/

/**
 * Start the render loop
 */
function startRenderLoop() {
    if (viewState.renderLoopActive) return;
    
    viewState.renderLoopActive = true;
    viewState.lastFrameTime = performance.now();
    requestAnimationFrame(renderLoop);
    console.log('Canvas render loop started');
}

/**
 * Stop the render loop
 */
function stopRenderLoop() {
    viewState.renderLoopActive = false;
    console.log('Canvas render loop stopped');
}

/**
 * Main render loop
 * @param {number} timestamp - Current frame timestamp
 */
function renderLoop(timestamp) {
    // Calculate delta time
    const deltaTime = timestamp - viewState.lastFrameTime;
    viewState.lastFrameTime = timestamp;
    
    // Only redraw if necessary
    if (viewState.needsRedraw) {
        drawCanvas();
        viewState.needsRedraw = false;
    }
    
    // Continue loop if active
    if (viewState.renderLoopActive) {
        requestAnimationFrame(renderLoop);
    }
}

/**
 * Draw the canvas with current state
 */
function drawCanvas() {
    if (!ctx || !canvas) {
        console.error('❌ Cannot draw - missing canvas or context');
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw debug border for visibility
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.restore();
    
    // Save context state
    ctx.save();
    
    // Apply transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(viewState.scale, viewState.scale);
    ctx.translate(-canvas.width / 2 + viewState.offsetX, -canvas.height / 2 + viewState.offsetY);
    
    // Draw the current image if available
    if (viewState.currentImage) {
        try {
            // Check if image is loaded
            if (!viewState.currentImage.complete) {
                console.warn('⚠️ Drawing image that is not yet complete');
            }
            
            // Log image dimensions for debugging
            console.log('🖼️ Drawing image:', {
                src: viewState.currentImage.src.substring(0, 100) + '...',
                width: viewState.currentImage.width || viewState.currentImage.naturalWidth,
                height: viewState.currentImage.height || viewState.currentImage.naturalHeight,
                complete: viewState.currentImage.complete
            });
            
            // Add drop shadow effect to match the CSS styling
            ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            // Draw the image
            ctx.drawImage(viewState.currentImage, 0, 0);
            console.log('✅ Image drawn to canvas');
        } catch (error) {
            console.error('❌ Error drawing image:', error);
            
            // Draw error message
            ctx.font = '16px Arial';
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.fillText('Error drawing image: ' + error.message, canvas.width / 2, canvas.height / 2);
            
            // Draw a box around the image area for visibility
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            if (viewState.currentImage.width && viewState.currentImage.height) {
                ctx.strokeRect(0, 0, 
                    viewState.currentImage.width || viewState.currentImage.naturalWidth || 800,
                    viewState.currentImage.height || viewState.currentImage.naturalHeight || 600);
            }
        }
    } else {
        // Draw placeholder text if no image
        ctx.font = '20px Arial';
        ctx.fillStyle = '#ff5500';
        ctx.textAlign = 'center';
        ctx.fillText('No image loaded', canvas.width / 2, canvas.height / 2);
        console.warn('⚠️ No image available to draw');
    }
    
    // Restore context state
    ctx.restore();
    
    // Draw measurements if available
    if (window.measurementTools && typeof window.measurementTools.drawAllMeasurements === "function") {
        // Update the measurement tools with current transform
        window.measurementTools.offsetX = viewState.offsetX;
        window.measurementTools.offsetY = viewState.offsetY;
        window.measurementTools.zoomFactor = viewState.scale;
        
        // Draw all measurements
        window.measurementTools.drawAllMeasurements(ctx);
    }
}

/*
--------------------------------------------
JAVASCRIPT |  USER INTERACTIONS
- Introduced in v2.0.0
DESCRIPTION
- Event handlers for canvas interactions
--------------------------------------------
*/

/**
 * Handle mouse wheel event for zooming
 * @param {WheelEvent} event - Mouse wheel event
 */
function handleMouseWheel(event) {
    // Prevent default scrolling
    event.preventDefault();
    
    // Calculate zoom factor based on wheel delta
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    
    // Apply zoom, keeping the point under the cursor fixed
    zoom(zoomFactor, event.clientX, event.clientY);
}

/**
 * Handle mouse down event for panning
 * @param {MouseEvent} event - Mouse down event
 */
function handleMouseDown(event) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    // Start dragging
    viewState.isDragging = true;
    viewState.dragStartX = event.clientX;
    viewState.dragStartY = event.clientY;
    
    // Change cursor to indicate dragging
    canvas.style.cursor = 'grabbing';
}

/**
 * Handle mouse move event for panning
 * @param {MouseEvent} event - Mouse move event
 */
function handleMouseMove(event) {
    if (!viewState.isDragging) return;
    
    // Calculate the drag distance
    const dx = event.clientX - viewState.dragStartX;
    const dy = event.clientY - viewState.dragStartY;
    
    // Update drag start position
    viewState.dragStartX = event.clientX;
    viewState.dragStartY = event.clientY;
    
    // Apply pan
    pan(dx / viewState.scale, dy / viewState.scale);
}

/**
 * Handle mouse up event for panning
 * @param {MouseEvent} event - Mouse up event
 */
function handleMouseUp() {
    // Stop dragging
    viewState.isDragging = false;
    
    // Restore cursor
    if (canvas) {
        canvas.style.cursor = 'grab';
    }
}

/*
--------------------------------------------
JAVASCRIPT |  VIEW TRANSFORMATIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for manipulating the canvas view
--------------------------------------------
*/

/**
 * Apply zoom transformation
 * @param {number} factor - Zoom factor (> 1 zooms in, < 1 zooms out)
 * @param {number} centerX - X coordinate of zoom center
 * @param {number} centerY - Y coordinate of zoom center
 */
function zoom(factor, centerX, centerY) {
    // Get the position in canvas coordinates
    const rect = canvas.getBoundingClientRect();
    const canvasX = centerX - rect.left;
    const canvasY = centerY - rect.top;
    
    // Convert to world coordinates before zoom
    const worldX = (canvasX - canvas.width / 2) / viewState.scale - viewState.offsetX;
    const worldY = (canvasY - canvas.height / 2) / viewState.scale - viewState.offsetY;
    
    // Apply zoom, clamping scale to reasonable values
    const oldScale = viewState.scale;
    viewState.scale = Math.max(0.1, Math.min(10, viewState.scale * factor));
    
    // Adjust offset to keep the point under cursor fixed
    if (oldScale !== viewState.scale) {
        // Calculate the new world coordinates after zoom
        const newWorldX = (canvasX - canvas.width / 2) / viewState.scale - viewState.offsetX;
        const newWorldY = (canvasY - canvas.height / 2) / viewState.scale - viewState.offsetY;
        
        // Adjust offset to compensate for the difference
        viewState.offsetX += (newWorldX - worldX);
        viewState.offsetY += (newWorldY - worldY);
        
        // Request redraw
        viewState.needsRedraw = true;
    }
}

/**
 * Apply pan transformation
 * @param {number} dx - X distance to pan
 * @param {number} dy - Y distance to pan
 */
function pan(dx, dy) {
    // Apply panning offset
    viewState.offsetX += dx;
    viewState.offsetY += dy;
    
    // Request redraw
    viewState.needsRedraw = true;
}

/**
 * Reset view to default state
 */
function resetView() {
    // Reset view state
    viewState.scale = 1.0;
    viewState.offsetX = 0;
    viewState.offsetY = 0;
    
    // Request redraw
    viewState.needsRedraw = true;
}

/**
 * Fit image to canvas view
 */
function fitImageToView() {
    if (!viewState.currentImage || !canvas) return;
    
    // Calculate scale to fit image in canvas
    const scaleX = canvas.width / viewState.currentImage.width;
    const scaleY = canvas.height / viewState.currentImage.height;
    
    // Use the smaller scale to ensure the entire image fits
    viewState.scale = Math.min(scaleX, scaleY) * 0.95; // 5% margin
    
    // Center the image
    viewState.offsetX = 0;
    viewState.offsetY = 0;
    
    // Request redraw
    viewState.needsRedraw = true;
}

/*
--------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Functions exposed to other modules
--------------------------------------------
*/

/**
 * Set the current image to be displayed on the canvas
 * @param {HTMLImageElement} image - The image to display
 * @returns {boolean} - Whether the image was successfully set
 */
function setCurrentImage(image) {
    if (!image) {
        console.warn('Attempted to set null image in Canvas Renderer');
        return false;
    }
    
    console.log('Setting current image in Canvas Renderer:', image.src);
    console.log('Image dimensions:', {
        width: image.width || image.naturalWidth,
        height: image.height || image.naturalHeight,
        complete: image.complete,
        src: image.src
    });
    
    try {
        // Update the view state with the new image
        viewState.currentImage = image;
        
        // Request a redraw
        viewState.needsRedraw = true;
        
        // If render loop is not active, start it
        if (!viewState.renderLoopActive) {
            startRenderLoop();
        }
        
        // Attempt to fit the image to view, if possible
        if (typeof fitImageToView === 'function') {
            setTimeout(fitImageToView, 100); // Small delay to ensure image is loaded
        }
        
        // Add a check to ensure the image is loaded
        if (!image.complete) {
            console.log('Image not yet loaded, setting onload handler');
            image.onload = () => {
                console.log('Image has now loaded in Canvas Renderer:', {
                    width: image.width || image.naturalWidth,
                    height: image.height || image.naturalHeight
                });
                
                // Request another redraw when image actually loads
                viewState.needsRedraw = true;
                
                // Try to fit again after loading
                setTimeout(fitImageToView, 50);
            };
        }
        
        // Dispatch an event indicating the renderer has been updated
        document.dispatchEvent(new CustomEvent('rendererUpdated', {
            detail: { 
                imageWidth: image.width || image.naturalWidth, 
                imageHeight: image.height || image.naturalHeight 
            }
        }));
        
        return true;
    } catch (error) {
        console.error('Error setting current image:', error);
        return false;
    }
}

/**
 * Fit the current image to the view, maintaining aspect ratio
 */
function fitImageToView() {
    if (!viewState.currentImage || !canvas) return;
    
    // Get dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imageWidth = viewState.currentImage.width || viewState.currentImage.naturalWidth;
    const imageHeight = viewState.currentImage.height || viewState.currentImage.naturalHeight;
    
    if (!imageWidth || !imageHeight) {
        console.warn('Image dimensions not available yet');
        return;
    }
    
    // Calculate scale to fit image within canvas
    const scaleX = canvasWidth / imageWidth;
    const scaleY = canvasHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 90% of the calculated scale for a margin
    
    // Update view state
    viewState.scale = scale;
    viewState.offsetX = (canvasWidth - imageWidth * scale) / 2;
    viewState.offsetY = (canvasHeight - imageHeight * scale) / 2;
    
    // Request redraw
    viewState.needsRedraw = true;
    
    console.log('Image fitted to view:', {
        scale: viewState.scale,
        offsetX: viewState.offsetX,
        offsetY: viewState.offsetY
    });
}

/**
 * Request a redraw of the canvas
 */
function requestRedraw() {
    viewState.needsRedraw = true;
}

/**
 * Check if the Canvas Renderer is initialized
 * @returns {boolean} - Whether the Canvas Renderer is initialized
 */
function isInitialized() {
    return initialized;
}

// Export the module's public API
window.canvasRenderer = {
    initializeCanvasRenderer,
    setCurrentImage,
    startRenderLoop,
    stopRenderLoop,
    fitImageToView,
    requestRedraw,
    isInitialized,
    viewState // Expose view state for debugging and direct manipulation
};

/*
--------------------------------------------
JAVASCRIPT |  EVENT LISTENERS
- Introduced in v2.0.0
DESCRIPTION
- Event listeners for integration with other modules
--------------------------------------------
*/

// Listen for refresh rendering events
document.addEventListener('refreshRendering', () => {
    console.log('Refresh rendering event received');
    requestRedraw();
});

// Listen for when a drawing is loaded
document.addEventListener('drawingLoaded', () => {
    console.log('Drawing loaded event received in Canvas Renderer');
    
    // Initialize if not already
    if (!initialized) {
        initializeCanvasRenderer();
    } else {
        // Ensure render loop is active
        startRenderLoop();
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Canvas Renderer');
    initializeCanvasRenderer();
}); 