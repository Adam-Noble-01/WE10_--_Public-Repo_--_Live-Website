/*
================================================================================
JAVASCRIPT |  MEASUREMENT SCALING
- Introduced in v2.0.0
DESCRIPTION
- Handles scale conversion from pixels to real-world measurements
- Ensures measurements remain accurate regardless of zoom level or drawing scale
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  SCALE CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for measurement scaling
IMPORTANT NOTES
- These values are critical for accurate measurements
--------------------------------------------
*/

// Measurement scaling variables
let scaleMetresPerPixel = 0.001;  // Default scale (will be calculated based on drawing info)
let currentDrawingScale = "1:50"; // Default drawing scale (e.g., "1:50", "1:100")
let currentDrawingSize = "A1";    // Default drawing size (e.g., "A1", "A0")

// Standard drawing sizes in mm (width x height)
const STANDARD_SIZES = {
    "A0": { width: 841, height: 1189 },
    "A1": { width: 594, height: 841 },
    "A2": { width: 420, height: 594 },
    "A3": { width: 297, height: 420 },
    "A4": { width: 210, height: 297 }
};

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up the measurement scaling system
--------------------------------------------
*/

/**
 * Initialize the measurement scaling system
 */
function initMeasurementScaling() {
    console.log("Initializing measurement scaling...");
    
    // Listen for drawing loaded events to recalculate scale
    document.addEventListener('drawingLoaded', onDrawingLoaded);
    
    // Try to calculate scale based on any already-loaded drawing
    calculateScaleRatio();
    
    console.log("Measurement scaling initialized");
}

/**
 * Handle drawing loaded events
 * @param {CustomEvent} event - Drawing loaded event
 */
function onDrawingLoaded(event) {
    // Update drawing information from the event
    if (event.detail) {
        currentDrawingScale = event.detail.scale || currentDrawingScale;
        currentDrawingSize = event.detail.size || currentDrawingSize;
    }
    
    // Recalculate the scale ratio
    calculateScaleRatio();
}

/*
--------------------------------------------
JAVASCRIPT |  SCALE CALCULATIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for calculating measurement scale ratios
--------------------------------------------
*/

/**
 * Calculate the scale ratio (metres per pixel)
 */
function calculateScaleRatio() {
    // Get natural image dimensions from project assets if available
    let naturalImageWidth = 0;
    let naturalImageHeight = 0;
    
    if (window.projectAssets) {
        naturalImageWidth = window.projectAssets.getNaturalImageWidth();
        naturalImageHeight = window.projectAssets.getNaturalImageHeight();
    }
    
    // Extract the scale ratio from the drawing scale (e.g., "1:50" => 50)
    const scaleRatio = parseScaleRatio(currentDrawingScale);
    
    // Get the standard size dimensions
    const standardSize = STANDARD_SIZES[currentDrawingSize] || STANDARD_SIZES["A1"];
    
    // If we have image dimensions, use them for a more accurate calculation
    if (naturalImageWidth > 0 && naturalImageHeight > 0) {
        // Find the dimension (width or height) that matches the standard size orientation
        const isPortrait = naturalImageHeight > naturalImageWidth;
        const standardSizeWidth = isPortrait ? standardSize.height : standardSize.width;
        
        // Calculate the scale in metres per pixel
        // Formula: (standard size in mm) * (scale ratio) / (image width in pixels) / 1000
        scaleMetresPerPixel = (standardSizeWidth * scaleRatio) / (naturalImageWidth * 1000);
    } else {
        // Fallback to a default reasonable value if no dimensions available
        scaleMetresPerPixel = 0.001; // 1mm per pixel as a safe default
    }
    
    console.log(`Scale calculated: ${scaleMetresPerPixel} metres per pixel (Drawing scale: ${currentDrawingScale}, Size: ${currentDrawingSize})`);
}

/**
 * Parse a scale ratio string (e.g., "1:50" => 50)
 * @param {string} scaleString - Scale string in format "1:X"
 * @returns {number} - Scale ratio (e.g., 50 for "1:50")
 */
function parseScaleRatio(scaleString) {
    if (!scaleString) return 50; // Default to 1:50 if no scale provided
    
    // Try to extract the scale ratio (the number after the colon)
    const match = scaleString.match(/1:(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    
    return 50; // Default to 1:50 if format doesn't match
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
window.measurementScaling = {
    // Initialization
    init: initMeasurementScaling,
    
    // Core functions
    getMetresPerPixel: () => scaleMetresPerPixel,
    getDrawingScale: () => currentDrawingScale,
    getDrawingSize: () => currentDrawingSize,
    
    // Additional functions
    calculateScaleRatio: calculateScaleRatio
};

/*
--------------------------------------------
JAVASCRIPT |  AUTO-INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Auto-initializes the module if in standalone mode
--------------------------------------------
*/

// This will be called by the Application Controller instead of auto-initializing
// When being used standalone (outside of the Application Controller framework),
// this code will self-initialize
if (!window.applicationController && document.readyState === 'complete') {
    console.log('Document already loaded, initializing measurement scaling directly...');
    initMeasurementScaling();
} 