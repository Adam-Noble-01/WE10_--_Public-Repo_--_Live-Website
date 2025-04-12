/*
================================================================================
JAVASCRIPT |  BACKWARD COMPATIBILITY MODULE
- Introduced in v2.0.0
DESCRIPTION
- Provides backward compatibility for older versions of the application
- Ensures smooth transition from v1.8.8 to v2.0.0
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  COMPATIBILITY FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions to maintain compatibility with older code
--------------------------------------------
*/

// Initialize backward compatibility
function initBackwardCompatibility() {
    console.log("BACKWARD_COMPATIBILITY: Initializing backward compatibility");
    
    // Create aliases for old function names
    if (window.masterAssetLoader) {
        // Alias for projectAssets
        window.projectAssets = window.masterAssetLoader;
        
        // Alias for old function names
        if (typeof window.masterAssetLoader.loadImage === 'function') {
            window.loadImage = window.masterAssetLoader.loadImage;
        }
        
        if (typeof window.masterAssetLoader.loadDrawing === 'function') {
            window.loadDrawing = window.masterAssetLoader.loadDrawing;
        }
        
        if (typeof window.masterAssetLoader.isImageLoaded === 'function') {
            window.isImageLoaded = window.masterAssetLoader.isImageLoaded;
        }
        
        if (typeof window.masterAssetLoader.getImageDimensions === 'function') {
            window.getImageDimensions = window.masterAssetLoader.getImageDimensions;
        }
    }
    
    // Alias for measurement scaling
    if (window.measurementScaling) {
        if (typeof window.measurementScaling.calculateScale === 'function') {
            window.calculateScale = window.measurementScaling.calculateScale;
        }
        
        if (typeof window.measurementScaling.getScaleMetresPerPixel === 'function') {
            window.getScaleMetresPerPixel = window.measurementScaling.getScaleMetresPerPixel;
        }
    }
    
    // Alias for canvas controller
    if (window.canvasController) {
        if (typeof window.canvasController.resetView === 'function') {
            window.resetView = window.canvasController.resetView;
        }
        
        if (typeof window.canvasController.toggleFullscreen === 'function') {
            window.toggleFullscreen = window.canvasController.toggleFullscreen;
        }
    }
    
    console.log("BACKWARD_COMPATIBILITY: Backward compatibility initialized");
}

// Export the API
window.backwardCompatibility = {
    initBackwardCompatibility
};

// Initialize when the module loads
initBackwardCompatibility();

// Log that the module has loaded
console.log("BACKWARD_COMPATIBILITY: Module loaded"); 