/*
================================================================================
JAVASCRIPT | DEBUG HELPERS SCRIPT
- Debug script to help diagnose image loading issues
================================================================================
*/

console.log("🛠️ DEBUG HELPERS SCRIPT LOADED");

/**
 * Initialize debug button handlers
 */
function initDebugHelpers() {
    console.log("🛠️ Initializing debug helpers");
    
    // Add click handlers for debug buttons
    const loadBtn = document.getElementById("BTTN__Debug-Load-Drawing");
    if (loadBtn) {
        loadBtn.addEventListener("click", debugForceLoadDrawing);
    }
    
    const statusBtn = document.getElementById("BTTN__Debug-Check-Status");
    if (statusBtn) {
        statusBtn.addEventListener("click", debugCheckModuleStatus);
    }
}

/**
 * Force load the first available drawing for debugging
 */
function debugForceLoadDrawing() {
    console.log("🛠️ DEBUG: Force loading drawing");
    
    try {
        // Try to load JSON data first if needed
        if (!window.drawingsData) {
            console.log("🛠️ DEBUG: No drawings data found, trying to fetch it now");
            
            // Find the path to the project data
            const dataPath = "../NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";
            
            fetch(dataPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("🛠️ DEBUG: Successfully fetched JSON data");
                    
                    // Find drawings data
                    let drawings = null;
                    
                    if (data["Project_Documentation"] && data["Project_Documentation"]["project-drawings"]) {
                        drawings = data["Project_Documentation"]["project-drawings"];
                        console.log("🛠️ DEBUG: Found drawings data", drawings);
                        
                        // Force load the first drawing
                        tryLoadFirstDrawing(drawings);
                    } else {
                        console.error("🛠️ DEBUG: Could not find drawings in data", data);
                    }
                })
                .catch(error => {
                    console.error("🛠️ DEBUG: Error fetching data:", error);
                });
            
            return;
        }
        
        // If we have drawing data from previous loads, use it
        console.log("🛠️ DEBUG: Using existing drawing data");
        tryLoadFirstDrawing(window.drawingsData);
    } catch (error) {
        console.error("🛠️ DEBUG: Error in debugForceLoadDrawing:", error);
    }
}

/**
 * Try to load the first drawing from the data
 */
function tryLoadFirstDrawing(drawings) {
    try {
        // Find the first valid drawing
        const firstDrawingKey = Object.keys(drawings).find(
            key => key.startsWith("drawing-") && 
                   drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
        );
        
        if (firstDrawingKey) {
            const drawing = drawings[firstDrawingKey];
            console.log("🛠️ DEBUG: Found first drawing:", drawing);
            
            // Check if we have projectAssets to load it
            if (window.projectAssets && typeof window.projectAssets.loadDrawing === "function") {
                console.log("🛠️ DEBUG: Using projectAssets.loadDrawing");
                window.projectAssets.loadDrawing(drawing);
            } else {
                // Try manual loading
                console.log("🛠️ DEBUG: No projectAssets found, trying manual load");
                manualLoadDrawing(drawing);
            }
        } else {
            console.error("🛠️ DEBUG: No valid drawings found in data");
        }
    } catch (error) {
        console.error("🛠️ DEBUG: Error in tryLoadFirstDrawing:", error);
    }
}

/**
 * Manually load a drawing as a fallback
 */
function manualLoadDrawing(drawing) {
    try {
        console.log("🛠️ DEBUG: Manual loading of drawing:", drawing);
        
        // Extract PNG URL
        let pngUrl = null;
        
        if (drawing["document-links"] && drawing["document-links"]["png--github-link-url"]) {
            pngUrl = drawing["document-links"]["png--github-link-url"];
        } else if (drawing["png-url"]) {
            pngUrl = drawing["png-url"];
        }
        
        if (!pngUrl) {
            console.error("🛠️ DEBUG: No PNG URL found in drawing data");
            return;
        }
        
        console.log("🛠️ DEBUG: Loading image from URL:", pngUrl);
        
        // Create a new image
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = function() {
            console.log("🛠️ DEBUG: Image loaded successfully:", this.width, "x", this.height);
            
            // Try updating the canvas renderer
            if (window.canvasRenderer && typeof window.canvasRenderer.setCurrentImage === "function") {
                console.log("🛠️ DEBUG: Updating canvas renderer with image");
                window.canvasRenderer.setCurrentImage(img);
            } else {
                console.log("🛠️ DEBUG: Canvas renderer not available");
            }
        };
        
        img.onerror = function(error) {
            console.error("🛠️ DEBUG: Error loading image:", error);
        };
        
        // Start loading the image
        img.src = pngUrl;
    } catch (error) {
        console.error("🛠️ DEBUG: Error in manualLoadDrawing:", error);
    }
}

/**
 * Check the status of all modules and log to console
 */
function debugCheckModuleStatus() {
    console.log("🛠️ DEBUG: Checking module status");
    
    // Log the global moduleStatus if available
    if (window.moduleStatus) {
        console.log("🛠️ DEBUG: Module status from window.moduleStatus:", window.moduleStatus);
    } else {
        console.log("🛠️ DEBUG: window.moduleStatus not available");
    }
    
    // Check projectAssets
    if (window.projectAssets) {
        console.log("🛠️ DEBUG: projectAssets is available");
        
        // Check if image is loaded
        if (typeof window.projectAssets.isImageLoaded === "function") {
            const imgLoaded = window.projectAssets.isImageLoaded();
            console.log("🛠️ DEBUG: Image loaded status:", imgLoaded);
        }
        
        // List available functions
        console.log("🛠️ DEBUG: projectAssets methods:", Object.keys(window.projectAssets));
    } else {
        console.log("🛠️ DEBUG: projectAssets not available");
    }
    
    // Check canvasRenderer
    if (window.canvasRenderer) {
        console.log("🛠️ DEBUG: canvasRenderer is available");
    } else {
        console.log("🛠️ DEBUG: canvasRenderer not available");
    }
    
    // Check moduleIntegration
    if (window.moduleIntegration) {
        console.log("🛠️ DEBUG: moduleIntegration is available");
    } else {
        console.log("🛠️ DEBUG: moduleIntegration not available");
    }
    
    // Show a success message on the canvas
    if (window.canvasRenderer && typeof window.canvasRenderer.drawCanvas === "function") {
        console.log("🛠️ DEBUG: Requesting canvas redraw");
        window.canvasRenderer.requestRedraw();
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initDebugHelpers);

// Make debug helpers available globally
window.debugHelpers = {
    forceLoadDrawing: debugForceLoadDrawing,
    checkModuleStatus: debugCheckModuleStatus
}; 