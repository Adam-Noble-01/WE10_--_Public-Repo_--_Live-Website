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
let drawingScale = "1:50"; // Default drawing scale (e.g., "1:50", "1:100")
let drawingSize = "A1";    // Default drawing size (e.g., "A1", "A0")

// Standard drawing sizes in mm (width x height)
const STANDARD_SIZES = {
    "A0": { width: 841, height: 1189 },
    "A1": { width: 594, height: 841 },
    "A2": { width: 420, height: 594 },
    "A3": { width: 297, height: 420 },
    "A4": { width: 210, height: 297 }
};

// Avoid redeclaring these variables later in the file
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

function initializeMeasurementScaling() {
    console.log("MEASUREMENT_SCALING: Initializing measurement scaling");
    
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("MEASUREMENT_SCALING: Image is loaded, proceeding with initialization");
        setupMeasurementScaling();
    } else {
        console.warn("MEASUREMENT_SCALING: Image not loaded yet");
        // Wait for image to be loaded
        document.addEventListener('assetsLoaded', onImageLoaded);
    }
}

function onImageLoaded(event) {
    console.log("MEASUREMENT_SCALING: Image loaded event received");
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("MEASUREMENT_SCALING: Image is loaded, proceeding with initialization");
        setupMeasurementScaling();
    } else {
        console.warn("MEASUREMENT_SCALING: Image not loaded yet");
    }
}

function setupMeasurementScaling() {
    console.log("MEASUREMENT_SCALING: Setting up measurement scaling");
    
    if (!window.masterAssetLoader || !window.masterAssetLoader.isImageLoaded()) {
        console.warn("MEASUREMENT_SCALING: Cannot setup measurement scaling - image not loaded");
        return;
    }
    
    // Get image dimensions from masterAssetLoader
    const imageDimensions = window.masterAssetLoader.getImageDimensions();
    if (!imageDimensions) {
        console.warn("MEASUREMENT_SCALING: Cannot setup measurement scaling - no image dimensions");
        return;
    }
    
    // Calculate scale based on image dimensions
    calculateScale();
}

function calculateScale() {
    if (!window.masterAssetLoader || !window.masterAssetLoader.isImageLoaded()) {
        console.warn("MEASUREMENT_SCALING: Cannot calculate scale - image not loaded");
        return null;
    }
    
    const imageDimensions = window.masterAssetLoader.getImageDimensions();
    if (!imageDimensions) {
        console.warn("MEASUREMENT_SCALING: Cannot calculate scale - no image dimensions");
        return null;
    }
    
    // Calculate scale based on image dimensions and drawing size
    const drawingSizeInfo = STANDARD_SIZES[drawingSize];
    if (!drawingSizeInfo) {
        console.warn("MEASUREMENT_SCALING: Invalid drawing size", drawingSize);
        return null;
    }
    
    const scaleFactor = parseScaleRatio(drawingScale);
    if (!scaleFactor) {
        console.warn("MEASUREMENT_SCALING: Invalid drawing scale", drawingScale);
        return null;
    }
    
    // Calculate scale in metres per pixel
    const drawingWidthMm = drawingSizeInfo.width;
    const drawingHeightMm = drawingSizeInfo.height;
    
    // Use the larger dimension to calculate scale
    const drawingDimensionMm = Math.max(drawingWidthMm, drawingHeightMm);
    const imageDimensionPx = Math.max(imageDimensions.width, imageDimensions.height);
    
    // Calculate scale in metres per pixel
    scaleMetresPerPixel = (drawingDimensionMm / 1000) / (imageDimensionPx * scaleFactor);
    
    console.log("MEASUREMENT_SCALING: Scale calculated", {
        drawingSize,
        drawingScale,
        scaleFactor,
        scaleMetresPerPixel
    });
    
    return scaleMetresPerPixel;
}

function parseScaleRatio(scaleString) {
    // Extract the denominator from the scale string (e.g., "1:50" -> 50)
    const match = scaleString.match(/1:(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    return null;
}

// Export the API
window.measurementScaling = {
    initializeMeasurementScaling,
    calculateScale,
    getScaleMetresPerPixel: () => scaleMetresPerPixel,
    setDrawingScale: (scale) => {
        drawingScale = scale;
        calculateScale();
    },
    setDrawingSize: (size) => {
        drawingSize = size;
        calculateScale();
    }
};

// Log that the module has loaded
console.log("MEASUREMENT_SCALING: Module loaded"); 