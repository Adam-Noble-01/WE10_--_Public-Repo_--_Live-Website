/*
================================================================================
JAVASCRIPT |  PROJECT ASSETS MODULE
- Introduced in v2.0.1
DESCRIPTION
- Handles loading and managing project-specific assets
- Manages drawing loading and configuration
================================================================================
*/

// Create namespace for this module
window.projectAssets = {};

// Module state
let currentDrawing = null;
let drawingConfig = null;

/**
 * Initialize the project assets module
 */
window.projectAssets.init = function() {
    console.log("PROJECT_ASSETS: Initializing");
    
    // Get the app config from the master asset loader
    const appConfig = window.masterAssetLoader.getAppConfig();
    if (!appConfig) {
        console.error("PROJECT_ASSETS: No app configuration found");
        return false;
    }
    
    // Store drawing configuration
    drawingConfig = appConfig.Project_Documentation.project_drawings;
    
    // Create drawing buttons in UI if available
    if (window.uiNavigation && typeof window.uiNavigation.createDrawingButtons === 'function') {
        window.uiNavigation.createDrawingButtons(drawingConfig);
    }
    
    console.log("PROJECT_ASSETS: Initialized successfully");
    return true;
};

/**
 * Load a specific drawing
 * @param {Object} drawing - Drawing configuration object
 */
window.projectAssets.loadDrawing = async function(drawing) {
    console.log("PROJECT_ASSETS: Loading drawing:", drawing);
    
    try {
        // Store current drawing
        currentDrawing = drawing;
        
        // Use master asset loader to load the drawing
        const success = await window.masterAssetLoader.loadDrawing(drawing);
        
        if (!success) {
            throw new Error("Failed to load drawing");
        }
        
        return true;
    } catch (error) {
        console.error("PROJECT_ASSETS: Error loading drawing:", error);
        if (window.masterAssetLoader) {
            window.masterAssetLoader.showErrorMessage("Failed to load the selected drawing.");
        }
        return false;
    }
};

/**
 * Get the natural width of the current image
 */
window.projectAssets.getNaturalImageWidth = function() {
    if (window.masterAssetLoader) {
        return window.masterAssetLoader.getNaturalImageWidth();
    }
    return 0;
};

/**
 * Get the natural height of the current image
 */
window.projectAssets.getNaturalImageHeight = function() {
    if (window.masterAssetLoader) {
        return window.masterAssetLoader.getNaturalImageHeight();
    }
    return 0;
};

/**
 * Get the current drawing configuration
 */
window.projectAssets.getCurrentDrawing = function() {
    return currentDrawing;
};

// Register with module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("projectAssets");
}

// Log that this module has loaded
console.log("PROJECT_ASSETS: Module loaded"); 