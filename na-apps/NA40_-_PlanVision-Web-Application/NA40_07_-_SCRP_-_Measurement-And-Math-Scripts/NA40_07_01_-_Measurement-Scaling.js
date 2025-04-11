/*
================================================================================
JAVASCRIPT |  MEASUREMENT SCALING MODULE
- Based on the reference implementation v1.8.8
DESCRIPTION
- Handles conversions between pixels and real-world measurements
- Provides functions to convert between pixels, millimeters, and square meters
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

// Drawing scale reference data
const SCALE_FACTORS = {
    "1:1": 1,
    "1:2": 2,
    "1:5": 5,
    "1:10": 10,
    "1:20": 20,
    "1:50": 50,
    "1:100": 100,
    "1:200": 200,
    "1:500": 500,
    "1:1000": 1000,
    "1:1250": 1250,
    "1:2500": 2500
};

// Drawing size reference data (in mm)
const PAPER_SIZES = {
    "A0": { width: 841, height: 1189 },
    "A1": { width: 594, height: 841 },
    "A2": { width: 420, height: 594 },
    "A3": { width: 297, height: 420 },
    "A4": { width: 210, height: 297 }
};

// Default pixels per mm at 96 DPI
const DEFAULT_PIXELS_PER_MM = 96 / 25.4;

/**
 * Convert pixels to millimeters
 * @param {number} pixels - Number of pixels to convert
 * @param {string} scale - Drawing scale (e.g. "1:50")
 * @param {string} paperSize - Drawing paper size (e.g. "A1")
 * @returns {number} Equivalent length in millimeters
 */
window.measurementScaling.pixelsToMillimeters = function(pixels, scale, paperSize) {
    // Get scale factor
    const scaleFactor = SCALE_FACTORS[scale] || 50; // Default to 1:50 if scale not found
    
    // Calculate pixels per mm based on image dimensions and paper size
    let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    
    if (window.projectAssets) {
        const imgWidth = window.projectAssets.getNaturalImageWidth();
        const imgHeight = window.projectAssets.getNaturalImageHeight();
        
        if (imgWidth > 0 && imgHeight > 0 && paperSize && PAPER_SIZES[paperSize]) {
            const paperWidth = PAPER_SIZES[paperSize].width;
            const paperHeight = PAPER_SIZES[paperSize].height;
            
            // Calculate pixels per mm based on image and paper dimensions
            const widthPixelsPerMm = imgWidth / paperWidth;
            const heightPixelsPerMm = imgHeight / paperHeight;
            
            // Use the average for better accuracy
            pixelsPerMm = (widthPixelsPerMm + heightPixelsPerMm) / 2;
        }
    }
    
    // Convert pixels to mm using scale factor
    return (pixels / pixelsPerMm) * scaleFactor;
};

/**
 * Convert pixels to square meters
 * @param {number} pixelArea - Area in pixels
 * @param {string} scale - Drawing scale (e.g. "1:50")
 * @param {string} paperSize - Drawing paper size (e.g. "A1")
 * @returns {number} Equivalent area in square meters
 */
window.measurementScaling.pixelsToSquareMeters = function(pixelArea, scale, paperSize) {
    // Get scale factor
    const scaleFactor = SCALE_FACTORS[scale] || 50; // Default to 1:50 if scale not found
    
    // Calculate pixels per mm based on image dimensions and paper size
    let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    
    if (window.projectAssets) {
        const imgWidth = window.projectAssets.getNaturalImageWidth();
        const imgHeight = window.projectAssets.getNaturalImageHeight();
        
        if (imgWidth > 0 && imgHeight > 0 && paperSize && PAPER_SIZES[paperSize]) {
            const paperWidth = PAPER_SIZES[paperSize].width;
            const paperHeight = PAPER_SIZES[paperSize].height;
            
            // Calculate pixels per mm based on image and paper dimensions
            const widthPixelsPerMm = imgWidth / paperWidth;
            const heightPixelsPerMm = imgHeight / paperHeight;
            
            // Use the average for better accuracy
            pixelsPerMm = (widthPixelsPerMm + heightPixelsPerMm) / 2;
        }
    }
    
    // Convert pixel area to mm²
    const areaMm2 = pixelArea / (pixelsPerMm * pixelsPerMm);
    
    // Apply scale factor to get real-world area in mm²
    const realAreaMm2 = areaMm2 * scaleFactor * scaleFactor;
    
    // Convert mm² to m²
    return realAreaMm2 / 1000000;
};

/**
 * Get scale factor from scale string
 * @param {string} scale - Drawing scale (e.g. "1:50")
 * @returns {number} Scale factor number
 */
window.measurementScaling.getScaleFactor = function(scale) {
    return SCALE_FACTORS[scale] || 50; // Default to 1:50 if scale not found
};

/**
 * Get paper dimensions for a given paper size
 * @param {string} paperSize - Drawing paper size (e.g. "A1")
 * @returns {Object} Object with width and height in millimeters
 */
window.measurementScaling.getPaperDimensions = function(paperSize) {
    return PAPER_SIZES[paperSize] || PAPER_SIZES["A1"]; // Default to A1 if paper size not found
};

/**
 * Calculate pixels per millimeter based on image and paper dimensions
 * @param {string} paperSize - Drawing paper size (e.g. "A1")
 * @returns {number} Pixels per millimeter
 */
window.measurementScaling.calculatePixelsPerMm = function(paperSize) {
    let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
    
    if (window.projectAssets) {
        const imgWidth = window.projectAssets.getNaturalImageWidth();
        const imgHeight = window.projectAssets.getNaturalImageHeight();
        
        if (imgWidth > 0 && imgHeight > 0 && paperSize && PAPER_SIZES[paperSize]) {
            const paperWidth = PAPER_SIZES[paperSize].width;
            const paperHeight = PAPER_SIZES[paperSize].height;
            
            // Calculate pixels per mm based on image and paper dimensions
            const widthPixelsPerMm = imgWidth / paperWidth;
            const heightPixelsPerMm = imgHeight / paperHeight;
            
            // Use the average for better accuracy
            pixelsPerMm = (widthPixelsPerMm + heightPixelsPerMm) / 2;
        }
    }
    
    return pixelsPerMm;
};

// Log that this module has loaded
console.log("MEASUREMENT_SCALING: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("measurementScaling");
}

// Backwards compatibility with direct module approach
window.scaleCalculator = window.measurementScaling; 