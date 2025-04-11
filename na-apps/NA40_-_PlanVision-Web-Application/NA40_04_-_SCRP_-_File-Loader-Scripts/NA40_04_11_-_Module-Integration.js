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
JAVASCRIPT |  MODULE TRACKING
- Introduced in v2.0.0
DESCRIPTION
- Keep track of which modules are loaded/ready
--------------------------------------------
*/

// Track the status of each module
window.moduleStatus = {
    fontLoader: false,
    assetLoader: false,
    projectAssets: false,
    canvasRenderer: false,
    canvasController: false,
    measurementScaling: false,
    measurementTools: false,
    uiNavigation: false
};

/**
 * Register a module as loaded and ready for use
 * @param {string} moduleName - The name of the module being registered
 */
function registerModuleReady(moduleName) {
    if (!window.moduleStatus.hasOwnProperty(moduleName)) {
        console.warn(`Unknown module '${moduleName}' being registered`);
    }
    
    console.log(`Module registered as ready: ${moduleName}`);
    window.moduleStatus[moduleName] = true;
    
    // Dispatch an event to notify other components
    document.dispatchEvent(new CustomEvent('moduleLoaded', {
        detail: { moduleName: moduleName }
    }));
    
    // Check if all critical modules are loaded
    checkAllModulesReady();
}

/**
 * Check if all critical modules are loaded and notify the application
 */
function checkAllModulesReady() {
    // Define which modules are critical for the application to function
    const criticalModules = ['assetLoader', 'projectAssets', 'canvasRenderer'];
    
    // Check if all critical modules are ready
    const allCriticalReady = criticalModules.every(module => window.moduleStatus[module]);
    
    // Log the current module status
    console.log("Current module status:", window.moduleStatus);
    
    if (allCriticalReady) {
        console.log("✅ All critical modules are ready!");
        document.dispatchEvent(new CustomEvent('applicationReady'));
    }
}

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
    
    // Listen for the fontDataLoaded event from the FontAssetLoader (new event name)
    document.addEventListener('fontDataLoaded', (event) => {
        console.log("⚡ Font data loaded event received in Module Integration");
        registerModuleReady('fontLoader');
        
        // Notify other components that fonts are ready
        notifyFontsReady();
    });
    
    // For backward compatibility, also listen for the old event name
    document.addEventListener('fontsLoaded', () => {
        console.log("⚡ Legacy fonts loaded event received in Module Integration");
        registerModuleReady('fontLoader');
        notifyFontsReady();
    });
}

/**
 * Connect the Project Assets Loader with the Canvas Renderer
 * This ensures that when assets are loaded, the renderer is updated
 */
function connectProjectAssetsToRenderer() {
    console.log("Connecting Project Assets to Canvas Renderer");
    
    // Listen for the assets loaded event
    document.addEventListener('assetsLoaded', () => {
        console.log("⚡ Assets loaded event received in Module Integration");
        registerModuleReady('assetLoader');
    });
    
    // Listen for project assets ready
    document.addEventListener('projectAssetsReady', () => {
        console.log("⚡ Project assets ready event received in Module Integration");
        registerModuleReady('projectAssets');
    });
    
    // Listen for the new imageLoaded event
    document.addEventListener('imageLoaded', (event) => {
        console.log("⚡ Image loaded event received in Module Integration");
        
        // Try to initialize canvas renderer if it exists
        initializeCanvasRenderer(event);
    });
    
    // Listen for drawing loaded events
    document.addEventListener('drawingLoaded', (event) => {
        console.log("Drawing loaded event received, updating renderer");
        initializeCanvasRenderer(event);
    });
    
    // Also check periodically for modules that may not announce themselves
    checkForUnannouncedModules();
}

/**
 * Attempt to initialize the Canvas Renderer
 * @param {Event} event - The event that triggered the initialization attempt
 */
function initializeCanvasRenderer(event) {
    // Ensure the canvas renderer exists
    if (window.canvasRenderer) {
        if (!window.moduleStatus.canvasRenderer) {
            console.log("🚀 Registering and initializing Canvas Renderer");
            registerModuleReady('canvasRenderer');
        }
        
        if (typeof window.canvasRenderer.initializeCanvasRenderer === "function") {
            console.log("🚀 Initializing Canvas Renderer");
            window.canvasRenderer.initializeCanvasRenderer()
                .then(() => {
                    console.log("✅ Canvas Renderer initialized");
                    
                    // Set image if available in event
                    if (event && event.detail && event.detail.image) {
                        console.log("🖼️ Setting image directly from event data");
                        window.canvasRenderer.setCurrentImage(event.detail.image);
                    } else {
                        updateRendererWithCurrentImage();
                    }
                })
                .catch(error => console.error("❌ Failed to initialize Canvas Renderer:", error));
        } else if (typeof window.canvasRenderer.setCurrentImage === "function") {
            // If no initialization method, try to directly set the image
            console.log("⚠️ No initialization method for Canvas Renderer, trying direct image set");
            
            if (event && event.detail && event.detail.image) {
                window.canvasRenderer.setCurrentImage(event.detail.image);
            } else {
                updateRendererWithCurrentImage();
            }
        }
    } 
    // Fallback to Canvas Controller if Canvas Renderer not available
    else if (window.canvasController) {
        if (!window.moduleStatus.canvasController) {
            console.log("🚀 Registering Canvas Controller as ready");
            registerModuleReady('canvasController');
        }
        
        updateCanvasControllerWithCurrentImage();
    } 
    // Neither available - log a warning
    else {
        console.warn("⚠️ Neither Canvas Renderer nor Canvas Controller found");
    }
}

/**
 * Periodically check for modules that exist but haven't announced themselves
 */
function checkForUnannouncedModules() {
    console.log("Setting up checks for unannounced modules");
    
    const moduleCheckInterval = setInterval(() => {
        // Check for Canvas Renderer
        if (window.canvasRenderer && !window.moduleStatus.canvasRenderer) {
            console.log("Found unannounced Canvas Renderer module");
            registerModuleReady('canvasRenderer');
        }
        
        // Check for Canvas Controller
        if (window.canvasController && !window.moduleStatus.canvasController) {
            console.log("Found unannounced Canvas Controller module");
            registerModuleReady('canvasController');
        }
        
        // Check for Measurement Scaling
        if (window.measurementScaling && !window.moduleStatus.measurementScaling) {
            console.log("Found unannounced Measurement Scaling module");
            registerModuleReady('measurementScaling');
        }
        
        // Check for Measurement Tools
        if (window.measurementTools && !window.moduleStatus.measurementTools) {
            console.log("Found unannounced Measurement Tools module");
            registerModuleReady('measurementTools');
        }
        
        // Check if a plan image has been loaded
        if (window.projectAssets && 
            typeof window.projectAssets.isImageLoaded === "function" && 
            window.projectAssets.isImageLoaded()) {
            
            // Ensure renderers are updated with the loaded image
            updateRendererWithCurrentImage();
            updateCanvasControllerWithCurrentImage();
        }
    }, 1000); // Check every second
    
    // Clear the interval after 30 seconds to avoid infinite checking
    setTimeout(() => {
        clearInterval(moduleCheckInterval);
        console.log("Stopping unannounced module checks");
        
        // Final report of module status
        console.log("Final module status report:", window.moduleStatus);
        
        // Log warning for any critical modules not detected
        ['canvasRenderer', 'canvasController', 'measurementScaling', 'measurementTools'].forEach(module => {
            if (!window.moduleStatus[module]) {
                console.warn(`⚠️ Critical module not loaded: ${module}`);
            }
        });
    }, 30000);
}

/**
 * Update the Canvas Renderer with the current image from Project Assets
 * This is a critical function that ensures the image is properly passed to the renderer
 */
function updateRendererWithCurrentImage() {
    console.log("Attempting to update renderer with current image");
    
    // First check if we have project assets with an image
    if (window.projectAssets) {
        if (typeof window.projectAssets.isImageLoaded === "function" && 
            window.projectAssets.isImageLoaded()) {
            
            console.log("Loaded image found in project assets, getting image reference");
            
            // Try to get the image reference - multiple methods depending on implementation
            let imageRef = null;
            
            // Method 1: Direct image field
            if (window.projectAssets.planImage) {
                imageRef = window.projectAssets.planImage;
                console.log("Got image from projectAssets.planImage");
            }
            // Method 2: Getter function
            else if (typeof window.projectAssets.getLoadedImage === "function") {
                imageRef = window.projectAssets.getLoadedImage();
                console.log("Got image from projectAssets.getLoadedImage()");
            }
            // Method 3: As a global variable
            else if (window.planImage) {
                imageRef = window.planImage;
                console.log("Got image from window.planImage");
            }
            
            if (imageRef) {
                console.log("Image reference found, dimensions:", 
                           imageRef.width, "x", imageRef.height,
                           ", complete:", imageRef.complete);
                
                // First, try direct canvas renderer update
                if (window.canvasRenderer && typeof window.canvasRenderer.setCurrentImage === "function") {
                    console.log("Updating canvas renderer directly with image");
                    setTimeout(() => window.canvasRenderer.setCurrentImage(imageRef), 10);
                    return true;
                } 
                // Second, try canvas controller
                else if (window.canvasController && typeof window.canvasController.setImage === "function") {
                    console.log("Updating canvas controller with image");
                    setTimeout(() => window.canvasController.setImage(imageRef), 10);
                    return true;
                }
                // If we couldn't update immediately, try dispatching an event
                else {
                    console.log("No direct renderer functions found, dispatching imageReady event");
                    document.dispatchEvent(new CustomEvent('imageReady', { 
                        detail: { image: imageRef }
                    }));
                    return true;
                }
            } else {
                console.warn("Image is reported loaded but no reference available");
            }
        } else {
            console.warn("No loaded image found in projectAssets");
        }
    } else {
        console.warn("projectAssets not found");
    }
    
    return false;
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

// Make public API available for module registration
window.moduleIntegration = {
    registerModuleReady: registerModuleReady,
    getModuleStatus: () => window.moduleStatus,
    updateRenderer: updateRendererWithCurrentImage
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Setting up module integration");
    connectFontLoaderToModules();
    connectProjectAssetsToRenderer();
    
    // Register this module as ready
    registerModuleReady('moduleIntegration');
});

// Export our module status
window.getModuleStatus = () => window.moduleStatus;

/**
 * Global function to force load a drawing
 * This can be called from the console for debugging
 */
window.debugForceLoadDrawing = function(drawingIndex = 0) {
    try {
        console.log("Debug: Attempting to force load drawing with index:", drawingIndex);
        
        // Access the project assets to get drawings
        if (window.projectAssets && typeof window.projectAssets.getAvailableDrawings === "function") {
            const drawings = window.projectAssets.getAvailableDrawings();
            
            if (drawings && drawings.length > 0) {
                const drawing = drawings[drawingIndex] || drawings[0];
                console.log("Debug: Force loading drawing:", drawing);
                
                if (typeof window.projectAssets.loadDrawing === "function") {
                    window.projectAssets.loadDrawing(drawing);
                    return true;
                }
            } else {
                console.warn("Debug: No drawings available");
            }
        } else {
            console.warn("Debug: projectAssets or getAvailableDrawings not available");
        }
    } catch (error) {
        console.error("Error in debugForceLoadDrawing:", error);
    }
    
    return false;
}; 