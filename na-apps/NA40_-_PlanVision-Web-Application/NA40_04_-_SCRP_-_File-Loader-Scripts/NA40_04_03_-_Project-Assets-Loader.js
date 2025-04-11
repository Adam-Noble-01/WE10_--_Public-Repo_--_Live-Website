/*
================================================================================
JAVASCRIPT |  PROJECT ASSETS LOADER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Handles loading and managing drawing images
- Provides functions for loading plan images and PDF documents
================================================================================
*/

// Module-level variables
let planImage = new Image();
planImage.crossOrigin   =   "anonymous";
let imageLoadedFlag     =         false;
let naturalImageWidth   =             0;
let naturalImageHeight  =             0;
let currentDrawingScale =        "1:50";    // <-- Default scale
let currentDrawingSize  =          "A1";    // <-- Default size

// Create namespace for this module
window.projectAssets = {};

// METHOD | Initialize the project assets loader
// --------------------------------------------------------- //
window.projectAssets.init = function() {
    console.log("PROJECT_ASSETS: Initializing...");
    console.log("PROJECT_ASSETS: Initialized successfully");
};

// METHOD | Load a specific drawing
// --------------------------------------------------------- //
window.projectAssets.loadDrawing = async function(drawing) {
    if (window.uiNavigation) window.uiNavigation.showLoading();
    console.log("PROJECT_ASSETS: Loading drawing:", drawing);
    
    try {
        // Extract URLs and metadata from drawing
        const pngUrl = drawing["document-links"]["png--github-link-url"];
        const pdfUrl = drawing["document-links"]["pdf--github-link-url"];
        const documentName = drawing["document-name"];
        const documentScale = drawing["document-scale"];
        const documentSize = drawing["document-size"];
        
        // Store drawing metadata for scale calculation
        currentDrawingScale = documentScale || "1:50"; // Default to 1:50 if not specified
        currentDrawingSize = documentSize || "A1"; // Default to A1 if not specified
        
        // Load the image
        await window.projectAssets.loadPlanImage(pngUrl);
        imageLoadedFlag = true;
        
        // Update download link
        window.projectAssets.updateDownloadLink(pdfUrl, documentName);
        
        // Update title
        document.title = "PlanVision | " + documentName;
        
        // Notify other modules that drawing is loaded
        document.dispatchEvent(new CustomEvent('drawingLoaded', {
            detail: {
                name: documentName,
                scale: documentScale,
                size: documentSize
            }
        }));
        
        // Reset view to fit the image if canvas renderer is available
        if (window.canvasRenderer && typeof window.canvasRenderer.resetView === "function") {
            window.canvasRenderer.resetView();
        }
        
        return true;
    } catch (error) {
        console.error("PROJECT_ASSETS: Error loading drawing:", error);
        if (window.uiNavigation) window.uiNavigation.displayError("Failed to load the selected drawing.");
        return false;
    } finally {
        if (window.uiNavigation) window.uiNavigation.hideLoading();
    }
};

// METHOD | Load the plan image
// --------------------------------------------------------- //
window.projectAssets.loadPlanImage = function(url) {
    return new Promise((resolve, reject) => {
        console.log("PROJECT_ASSETS: Loading image from URL:", url);
        
        planImage.onload = () => {
            console.log("PROJECT_ASSETS: Image loaded successfully");
            naturalImageWidth = planImage.naturalWidth;
            naturalImageHeight = planImage.naturalHeight;
            imageLoadedFlag = true;
            
            // Notify that image is loaded
            document.dispatchEvent(new CustomEvent('imageLoaded', {
                detail: { image: planImage }
            }));
            
            resolve();
        };
        
        planImage.onerror = (e) => {
            console.error("PROJECT_ASSETS: Error loading image:", e);
            imageLoadedFlag = false;
            reject(new Error("Failed to load plan image: " + url));
        };
        
        // Start loading the image
        planImage.src = url;
    });
};

// METHOD | Update the PDF download link
// --------------------------------------------------------- //
window.projectAssets.updateDownloadLink = function(pdfUrl, documentName) {
    const downloadBtn = document.getElementById("BTTN__Download-PDF");
    if (!downloadBtn) {
        console.warn("PROJECT_ASSETS: Download button not found");
        return;
    }
    
    downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = documentName.replace(/ /g, "-") + ".pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    // Enable the button in case it was disabled
    downloadBtn.disabled = false;
};

// METHOD | Get the loaded plan image
// --------------------------------------------------------- //
window.projectAssets.getPlanImage = function() {
    return planImage;
};

// METHOD | Check if an image is loaded
// --------------------------------------------------------- //
window.projectAssets.isImageLoaded = function() {
    return imageLoadedFlag;
};

// METHOD | Get the natural width of the loaded image
// --------------------------------------------------------- //
window.projectAssets.getNaturalImageWidth = function() {
    return naturalImageWidth;
};

// METHOD | Get the natural height of the loaded image
// --------------------------------------------------------- //
window.projectAssets.getNaturalImageHeight = function() {
    return naturalImageHeight;
};

// METHOD | Get the current drawing scale
// --------------------------------------------------------- //
window.projectAssets.getCurrentDrawingScale = function() {
    return currentDrawingScale;
};

// METHOD | Get the current drawing size
// --------------------------------------------------------- //
window.projectAssets.getCurrentDrawingSize = function() {
    return currentDrawingSize;
};

// Log that this module has loaded
console.log("PROJECT_ASSETS: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("projectAssets");
} 

// Backwards compatibility with direct module approach
window.imageLoader = window.projectAssets; 