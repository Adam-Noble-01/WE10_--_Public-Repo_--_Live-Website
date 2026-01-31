// ===================================================================================
// JAVASCRIPT | CANVAS UTILITIES
// ===================================================================================
// OFFLOADED | 12-Apr-2025
// Tested - NEED TO TEST STILL
//
// Description:
// - This module handles all canvas-related utility functions
// - Manages canvas resizing and view transformations
// - Handles zoom and pan operations
// - Manages canvas state and view reset functionality
// - Provides scale calibration for measurements
// ----------------------------------------------------------------------------------



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------
// Canvas state variables
let offsetX = 0;
let offsetY = 0;
let zoomFactor = 1;

// Constants for zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

// Canvas element references
let planCanvas;
let ctx;

// Drawing state
let planImage;
let isImageLoaded = false;
let naturalImageWidth = 0;
let naturalImageHeight = 0;
let currentDrawingScale = "1:50"; // Default scale if none provided
let currentDrawingSize = "A1"; // Default size if none provided
let scaleMetresPerPixel = 0;



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Initialize Canvas
// ----------------------------------------------------------------------------------
// - Sets up the canvas and its context
// - Should be called when the module is first loaded

function initializeCanvas(canvas, context, image) {
    planCanvas = canvas;
    ctx = context;
    planImage = image;
    
    // Set up resize listener
    window.addEventListener("resize", onResize);
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Canvas Management
// ----------------------------------------------------------------------------------
// - Handles canvas resizing to maintain appropriate display dimensions

function resizeCanvas() {
    if (!planCanvas) return;
    planCanvas.width = window.innerWidth;
    planCanvas.height = window.innerHeight + 10;    // ← Updated To Top Cropping At Bottom
}

// Handle window resize event
function onResize() {
    resizeCanvas();
    resetView();
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Zoom Controls
// ----------------------------------------------------------------------------------
// - Handles zoom operations including setting zoom level and maintaining focus point

function applyZoom(delta, cx, cy) {
    let newZoom = zoomFactor + delta;
    setZoom(newZoom, cx, cy);
}

function setZoom(z, cx, cy) {
    if (z < MIN_ZOOM) z = MIN_ZOOM;
    if (z > MAX_ZOOM) z = MAX_ZOOM;
    const wx = (cx - offsetX) / zoomFactor;
    const wy = (cy - offsetY) / zoomFactor;
    zoomFactor = z;
    offsetX = cx - wx * zoomFactor;
    offsetY = cy - wy * zoomFactor;
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  View Reset & Scale Calibration
// ----------------------------------------------------------------------------------
// - Handles resetting view position and calculating measurement scale based on drawing metadata

function resetView() {
    if (!planCanvas || !planImage) return;
    
    const cw = planCanvas.width;
    const ch = planCanvas.height;
    const iw = planImage.width;
    const ih = planImage.height;

    zoomFactor = Math.min(cw / iw, ch / ih) * 0.85;    // ← Updated To Show Whole Drawing When Loaded
    offsetX = (cw - iw * zoomFactor) / 2;
    offsetY = (ch - ih * zoomFactor) / 2;

    calculateScale();
}

function calculateScale() {
    // Get paper size dimensions based on the current drawing's size
    let realWidthMM;
    switch(currentDrawingSize) {
        case "A0": realWidthMM = 1189; break;
        case "A1": realWidthMM = 841; break;
        case "A2": realWidthMM = 594; break;
        case "A3": realWidthMM = 420; break;
        case "A4": realWidthMM = 297; break;
        default: realWidthMM = 841; // Default to A1 if not specified
    }

    // Parse scale from format like "1:50" to get the scale factor
    let scaleRatio = 50; // Default scale ratio
    if (currentDrawingScale && currentDrawingScale.includes(":")) {
        const scaleParts = currentDrawingScale.split(":");
        if (scaleParts.length === 2 && !isNaN(scaleParts[1])) {
            scaleRatio = parseInt(scaleParts[1], 10);
        }
    }

    // Calculate scale metres per pixel using the drawing-specific values
    const drawnWidthPx = naturalImageWidth;
    const mmPerPixel = realWidthMM / drawnWidthPx;
    scaleMetresPerPixel = (mmPerPixel * scaleRatio) / 1000;

    console.log(`Drawing set to ${currentDrawingSize} at scale ${currentDrawingScale} (1:${scaleRatio})`);
    console.log(`Scale calculation: ${realWidthMM}mm paper width / ${drawnWidthPx}px image width * ${scaleRatio} scale ratio / 1000 = ${scaleMetresPerPixel} metres per pixel`);
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  State Management
// ----------------------------------------------------------------------------------
// - Functions to update the module's state

function updateDrawingMetadata(drawingScale, drawingSize, width, height) {
    currentDrawingScale = drawingScale;
    currentDrawingSize = drawingSize;
    naturalImageWidth = width;
    naturalImageHeight = height;
    calculateScale();
}

function getCanvasState() {
    return {
        offsetX,
        offsetY,
        zoomFactor,
        scaleMetresPerPixel
    };
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// MODULE EXPORTS
// ----------------------------------------------------------------------------------
export {
    initializeCanvas,
    resizeCanvas,
    resetView,
    applyZoom,
    setZoom,
    updateDrawingMetadata,
    getCanvasState,
    onResize
};

