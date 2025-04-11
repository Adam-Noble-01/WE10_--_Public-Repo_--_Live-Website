/*
================================================================================
JAVASCRIPT |  MODULE INTEGRATION
- Introduced in v2.0.0
DESCRIPTION
- Provides integration points between different modules
- Ensures proper communication between the asset loader and renderers
- Handles synchronization of loaded assets with rendering pipeline
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  MODULE CONNECTION
- Introduced in v2.0.0
DESCRIPTION
- Functions to connect modules together
--------------------------------------------
*/

/**
 * Connect the Font Asset Loader to other modules
 * This ensures proper font loading before other components
 */
function connectFontLoaderToModules() {
    console.log("Connecting Font Asset Loader to modules");
    
    // Listen for the fontsLoaded event from the FontAssetLoader
    document.addEventListener('fontsLoaded', () => {
        console.log("⚡ Fonts loaded event received in Module Integration");
        
        // Notify other components that fonts are ready
        notifyFontsReady();
        
        // Trigger projects assets loading if needed
        if (window.projectAssets && typeof window.projectAssets.loadProjectAssets === "function") {
            console.log("🔠 Fonts loaded, starting project assets loading");
            window.projectAssets.loadProjectAssets();
        }
    });
}

/**
 * Connect the Project Assets Loader with the Canvas Renderer
 * This ensures that when assets are loaded, the renderer is updated
 */
function connectProjectAssetsToRenderer() {
    console.log("Connecting Project Assets to Canvas Renderer");
    
    // Listen for the new imageLoaded event
    document.addEventListener('imageLoaded', (event) => {
        console.log("⚡ Image loaded event received in Module Integration");
        
        // Ensure the canvas renderer exists and is initialized
        if (window.canvasRenderer) {
            if (!window.canvasRenderer.isInitialized || !window.canvasRenderer.isInitialized()) {
                console.log("🚀 Initializing Canvas Renderer from imageLoaded event");
                window.canvasRenderer.initializeCanvasRenderer()
                    .then(() => {
                        console.log("✅ Canvas Renderer initialized on image load");
                        if (event.detail && event.detail.image) {
                            console.log("🖼️ Setting image directly from event data");
                            window.canvasRenderer.setCurrentImage(event.detail.image);
                        } else {
                            updateRendererWithCurrentImage();
                        }
                    })
                    .catch(error => console.error("❌ Failed to initialize Canvas Renderer:", error));
            } else {
                console.log("🔄 Canvas Renderer already initialized, updating image");
                if (event.detail && event.detail.image) {
                    console.log("🖼️ Setting image directly from event data");
                    window.canvasRenderer.setCurrentImage(event.detail.image);
                } else {
                    updateRendererWithCurrentImage();
                }
            }
        }
    });
    
    // Listen for drawing loaded events
    document.addEventListener('drawingLoaded', (event) => {
        console.log("Drawing loaded event received, updating renderer");
        
        // Access the canvas renderer
        if (window.canvasRenderer && typeof window.canvasRenderer.initializeCanvasRenderer === "function") {
            // Ensure the renderer is initialized
            window.canvasRenderer.initializeCanvasRenderer()
                .then(() => updateRendererWithCurrentImage())
                .catch(error => console.error("Failed to initialize canvas renderer:", error));
        } else {
            // If we're using the Canvas Controller instead
            if (window.canvasController) {
                console.log("Using Canvas Controller for rendering");
                
                // Initialize the Canvas Controller if not already initialized
                if (typeof window.canvasController.init === "function") {
                    console.log("Initializing Canvas Controller");
                    window.canvasController.init();
                } else {
                    console.warn("Canvas Controller doesn't have init method");
                }
                
                // Update the Canvas Controller with the current image
                updateCanvasControllerWithCurrentImage();
            } else {
                console.warn("Neither Canvas Renderer nor Canvas Controller found");
            }
        }
    });
    
    // Also check periodically for a loaded image that might not have triggered an event
    const checkInterval = setInterval(() => {
        if (window.projectAssets && typeof window.projectAssets.isImageLoaded === "function" && 
            window.projectAssets.isImageLoaded()) {
            
            // If image is loaded, update renderers and stop checking
            updateRendererWithCurrentImage();
            updateCanvasControllerWithCurrentImage();
            clearInterval(checkInterval);
        }
    }, 1000); // Check every second
    
    // Clear the interval after 30 seconds to avoid infinite checking
    setTimeout(() => clearInterval(checkInterval), 30000);
}

/**
 * Update the Canvas Renderer with the current image from Project Assets
 */
function updateRendererWithCurrentImage() {
    if (!window.canvasRenderer || !window.projectAssets) return;
    
    console.log("Updating Canvas Renderer with current image");
    
    // Get the current image from Project Assets
    if (typeof window.projectAssets.getPlanImage === "function") {
        const currentImage = window.projectAssets.getPlanImage();
        
        // Set the current image in the renderer
        if (typeof window.canvasRenderer.setCurrentImage === "function") {
            window.canvasRenderer.setCurrentImage(currentImage);
            
            // Force a redraw
            if (window.canvasRenderer.viewState) {
                window.canvasRenderer.viewState.needsRedraw = true;
            }
            
            console.log("Current image updated in Canvas Renderer");
            
            // Verify the canvas element exists
            const canvasElement = document.getElementById('CNVS__Plan');
            if (!canvasElement) {
                console.error("Canvas element 'CNVS__Plan' not found in DOM");
            } else {
                console.log("Canvas element found with dimensions:", 
                    `${canvasElement.width}x${canvasElement.height}`);
            }
        } else {
            console.warn("Canvas Renderer does not have setCurrentImage method");
        }
    } else {
        console.warn("Project Assets does not have getPlanImage method");
    }
}

/**
 * Update the Canvas Controller with the current image
 */
function updateCanvasControllerWithCurrentImage() {
    if (!window.canvasController || !window.projectAssets) return;
    
    console.log("Updating Canvas Controller state");
    
    // Verify the canvas element exists
    const canvasElement = document.getElementById('CNVS__Plan');
    if (!canvasElement) {
        console.error("Canvas element 'CNVS__Plan' not found in DOM");
    } else {
        console.log("Canvas element found for Controller with dimensions:", 
            `${canvasElement.width}x${canvasElement.height}`);
    }
    
    // Force a redraw on the next animation frame
    if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
            // In case the Canvas Controller has a method to signal a redraw
            if (typeof window.canvasController.requestRedraw === "function") {
                window.canvasController.requestRedraw();
            }
        });
    }
}

/*
--------------------------------------------
JAVASCRIPT |  EVENT NOTIFICATIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions to create and dispatch custom events
--------------------------------------------
*/

/**
 * Notify all modules that the renderer is ready
 */
function notifyRendererReady() {
    console.log("Notifying that renderer is ready");
    document.dispatchEvent(new CustomEvent('rendererReady'));
}

/**
 * Notify all modules to refresh their rendering
 */
function notifyRefreshRendering() {
    console.log("Requesting render refresh");
    document.dispatchEvent(new CustomEvent('refreshRendering'));
}

/**
 * Notify all modules that fonts are ready
 */
function notifyFontsReady() {
    console.log("Notifying that fonts are ready");
    document.dispatchEvent(new CustomEvent('fontsReady'));
}

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners and initializes integration
--------------------------------------------
*/

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Setting up module integration");
    connectFontLoaderToModules();
    connectProjectAssetsToRenderer();
    
    // Listen for specific events that require cross-module coordination
    document.addEventListener('projectAssetsReady', () => {
        console.log("Project assets ready, connecting to renderer");
        connectProjectAssetsToRenderer();
    });
});

// Also attach to projectAssetsReady event directly
document.addEventListener('projectAssetsReady', () => {
    console.log("Project assets ready, connecting to renderer");
    connectProjectAssetsToRenderer();
});

// Optional: Auto-initialize if the document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log("Document already loaded, setting up module integration");
    connectFontLoaderToModules();
    connectProjectAssetsToRenderer();
} 