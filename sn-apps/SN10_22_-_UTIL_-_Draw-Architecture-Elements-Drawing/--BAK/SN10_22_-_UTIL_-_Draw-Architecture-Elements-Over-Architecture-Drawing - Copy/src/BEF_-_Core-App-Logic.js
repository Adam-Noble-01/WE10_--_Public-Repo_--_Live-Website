/* =============================================================================
BEF_-_Core-App-Logic.js | Elevation Polygon Detector Application
- Main entry point for the application.
- Handles UI, events, state management, canvas drawing, and core app flow.
- Imports detection logic from BEF_-_Detection-Logic.js
========================================================================== */


/* 
KEY LOGIC STAGE 01  -  Architecture Element Detector Stage
================================================================================

v2.1.0 - 15 Apr 2025 |  OVERHAUL - Two-Stage Pipeline

OVERHAUL DESCRIPTION
This version implements a significant overhaul, moving from a single, complex processing function to a two-stage
pipeline. This separation aims to improve performance, responsiveness, and user control.

STEP 01 |  Raw Feature Detection 
-----------------------------------------------------------

- `detectElements` function

- Focuses on rapidly identifying potential architectural element candidates from the input image using robust edge
  detection and basic filtering. 

- It prioritizes speed over perfect shape definition at this point.

STEP 02 |  Polygon Refinement 
-----------------------------------------------------------

- `generatePolygons` function

- Takes the potential candidates from Stage 1 and applies more computationally intensive refinement steps like shape
  simplification, grid snapping, and stricter filtering to produce cleaner, CAD-ready polygons.

STAGE 1: DETECTION (`detectElements` function) - PROCESS FLOW:
------------------------------------------------------------
1.  INPUT & PARAMETERS: Reads the current image from the canvas and retrieves parameters specific to detection.

2.  IMAGE PREPROCESSING (`preprocessImage` function):
    - Converts the image to Grayscale.
    - Applies Gaussian Blur to reduce noise that could interfere with edge detection.
    - Enhances Contrast using Histogram Equalization blended with the original grayscale image. This helps make faint
      architectural lines more prominent against their background, improving edge detector results.

3.  CANNY EDGE DETECTION (`cv.Canny`):
    - Identifies sharp changes in intensity (edges) in the preprocessed image. This is the core step for finding outlines
      of windows, doors, building sections, etc.
    - Controlled by:
      - `cannyThreshold1` (Edge Sensitivity Low): Lower values detect more, potentially weaker or noisier, edges.
      - `cannyThreshold2` (Edge Sensitivity High): Higher values help connect edge segments and filter initial noise.
        Edges with intensity gradient above `cannyThreshold2` are strong edges; edges between the two thresholds are kept
        only if connected to strong edges.
        
4.  MORPHOLOGICAL CLOSING (`cv.morphologyEx` - Optional):
    - A light closing operation is applied to the Canny edges using a small kernel. This helps to close small gaps in
      detected edge lines, potentially joining broken segments of window frames or outlines without significantly altering
      the overall shape or adding much processing time.

5.  CONTOUR FINDING (`cv.findContours`):
    - Traces the outlines of the detected and potentially closed edges. `cv.RETR_EXTERNAL` is typically used here to find
      only the outermost contours, simplifying the results for elements like windows.
      
6.  BASIC FILTERING & STORAGE:
    - Iterates through the raw contours found.
    - Applies a *basic* size filter based on the bounding box of each raw contour. Contours smaller than the specified
      minimum detection size are discarded early.
    - Controlled by:
      - `detectMinWidth` (Minimum Width mm): Minimum width (in real-world mm) for a raw contour's bounding box.
      - `detectMinHeight` (Minimum Height mm): Minimum height (in real-world mm) for a raw contour's bounding box.
    - Stores the *points* of the contours that pass this basic filter into the `detectionResults` array.

7.  OUTPUT & UI UPDATE:
    - The `detectionResults` array (containing lists of points for potential elements) is the primary output.
    - Draws these raw results onto the canvas (Detection Layer - green).
    - Enables the "Generate CAD Polygons" button and the Detection Layer toggle.
    - Provides status feedback to the user.

WHAT STAGE 1 *DOES NOT* DO (Compared to previous monolithic approach):
---------------------------------------------------------------------
- NO Shape Simplification (`approxPolyDP`): Raw contours are kept. Simplification happens in Stage 2.
- NO Grid Snapping: Vertex coordinates are not snapped to a grid here. Snapping happens in Stage 2.
- NO Advanced Filtering (Straightness/Solidity): Only basic size filtering is applied. Stricter shape analysis (like
  solidity checks using `straightnessThreshold`) happens in Stage 2.
- NO Complex Interpolation (Bridging/Corner Closing): Computationally heavy steps like bridging distant vertices
  (`bridgeVerticesThreshold`) or closing corners (`closeCornersThreshold`) are deferred to Stage 2, making Stage 1
  significantly faster and more responsive.

GOAL:
-----
To quickly provide the user with visual feedback on potential elements based on edge detection and minimal size
constraints, setting the stage for more detailed refinement in the next step.

================================================================================ */

// --- Imports ---
import * as SharedState from './BEF_-_Shared-State.js';

import { detectElements, generatePolygons } from './BEF_-_Detection-Logic.js';

// --- Global Variables ---
let imgElement = new Image();
let cvReady = false;
let imageLoaded = false;

// --- DOM Elements (Some Exported for Detection Logic Access) ---
const detectBtn = document.getElementById('detectBtn');
const generatePolygonsBtn = document.getElementById('generatePolygonsBtn');
const resetBtn = document.getElementById('resetBtn');
const imageInputEl = document.getElementById('imageInput');
const statusEl = document.getElementById('status');
const loadingMsgEl = document.getElementById('loadingMessage');
const imageScaleMmInput = document.getElementById('imageScaleMm');
const applyScaleBtn = document.getElementById('applyScaleBtn');
const gridToggle = document.getElementById('gridToggle');
const baseLayerToggle = document.getElementById('baseLayerToggle');
const detectionLayerToggle = document.getElementById('detectionLayerToggle');
const polygonLayerToggle = document.getElementById('polygonLayerToggle');
const unifyIslandsToggle = document.getElementById('unifyIslandsToggle');
// const advancedInterpolationToggle = document.getElementById('advancedInterpolationToggle'); // If needed

// Caching slider and value display elements (Exported)
Object.assign(SharedState.sliders, {
    // Detection Sliders
    cannyThreshold1: document.getElementById('cannyThreshold1'),
    cannyThreshold2: document.getElementById('cannyThreshold2'),
    orthogonalBias: document.getElementById('orthogonalBias'),
    detectMinWidth: document.getElementById('detectMinWidth'),
    detectMinHeight: document.getElementById('detectMinHeight'),
    detectMaxWidth: document.getElementById('detectMaxWidth'),
    detectMaxHeight: document.getElementById('detectMaxHeight'),
    mergeClosePoints: document.getElementById('mergeClosePoints'),
    // Polygon Sliders
    straightnessThreshold: document.getElementById('straightnessThreshold'),
    bridgeVerticesThreshold: document.getElementById('bridgeVerticesThreshold'),
    epsilon: document.getElementById('epsilon'),
    snapGridSize: document.getElementById('snapGridSize'),
    closeCornersThreshold: document.getElementById('closeCornersThreshold'),
    minWidth: document.getElementById('minWidth'),
    minHeight: document.getElementById('minHeight'),
    maxWidth: document.getElementById('maxWidth'),
    maxHeight: document.getElementById('maxHeight'),
});

Object.assign(SharedState.valueDisplays, {
    // Detection Value Displays
    cannyThreshold1: document.getElementById('cannyThreshold1Value'),
    cannyThreshold2: document.getElementById('cannyThreshold2Value'),
    orthogonalBias: document.getElementById('orthogonalBiasValue'),
    detectMinWidth: document.getElementById('detectMinWidthValue'),
    detectMinHeight: document.getElementById('detectMinHeightValue'),
    detectMaxWidth: document.getElementById('detectMaxWidthValue'),
    detectMaxHeight: document.getElementById('detectMaxHeightValue'),
    mergeClosePoints: document.getElementById('mergeClosePointsValue'),
    straightnessThreshold: document.getElementById('straightnessThresholdValue'),
    bridgeVerticesThreshold: document.getElementById('bridgeVerticesThresholdValue'),
    epsilon: document.getElementById('epsilonValue'),
    snapGridSize: document.getElementById('snapGridSizeValue'),
    closeCornersThreshold: document.getElementById('closeCornersThresholdValue'),
    minWidth: document.getElementById('minWidthValue'),
    minHeight: document.getElementById('minHeightValue'),
    maxWidth: document.getElementById('maxWidthValue'),
    maxHeight: document.getElementById('maxHeightValue'),
});

/* =============================================================================
   Slider and UI Helpers
   ========================================================================== */
function updateUISettings() {
    console.log("Running updateUISettings...");
    try {
        Object.keys(SharedState.sliders).forEach(id => {
            const slider = SharedState.sliders[id];
            const display = SharedState.valueDisplays[id];
            if (!slider) {
                console.warn(`Slider '${id}' not found in sliders object`);
                return;
            }
            if (!display) {
                console.warn(`Display for slider '${id}' not found in valueDisplays object`);
                return;
            }
            let value = slider.value;
            let displayValue = value;
            // Apply scaling for display purposes
            if (id === 'epsilon') displayValue = (parseFloat(value) / 1000.0).toFixed(3);
            if (id === 'straightnessThreshold') displayValue = (parseFloat(value) / 100.0).toFixed(2);
            display.textContent = displayValue;
        });
    } catch (error) {
        console.error("Error in updateUISettings:", error);
    }
}

function setupSlider(sliderId, displayId, scaleFactor = 1, isPolygonSlider = false) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (!slider || !display) return;

    const updateDisplay = () => {
        let value = parseFloat(slider.value) * scaleFactor;
        display.textContent = value.toFixed(scaleFactor === 1 ? 0 : (scaleFactor === 0.001 ? 3 : 2));
    };

    updateDisplay(); // Initial display update

    slider.addEventListener('input', function() {
        updateDisplay(); // Update display immediately

        // Debounce processing only if the relevant stage can be re-run
        if (imageLoaded && cvReady && SharedState.pixelsPerMm) {
            clearTimeout(window.sliderTimeout);
            // Re-run detection if a detection slider changes AND detection has run before
            if (!isPolygonSlider && SharedState.detectionResults.length > 0) {
                 window.sliderTimeout = setTimeout(runDetectElementsWorkflow, 300); // Debounce detection workflow
            }
            // Re-run polygon generation if a polygon slider changes AND detection results exist AND polygons have been generated before
            else if (isPolygonSlider && SharedState.detectionResults.length > 0 && SharedState.polygons.length > 0) {
                 window.sliderTimeout = setTimeout(runGeneratePolygonsWorkflow, 300); // Debounce polygon generation workflow
            }
        }
    });
}

// --- OpenCV Loading ---
function onOpenCvReady() {
    cvReady = true;
    loadingMsgEl.style.display = 'none';
    console.log('OpenCV.js is ready');
    
    // Initialize canvas first
    if (initializeCanvas()) {
        // Then set up all event listeners
        setupEventListeners();
        updateUISettings(); // Update UI based on initial slider values
        
        // Show status to inform user that OpenCV is ready
        SharedState.showStatus('OpenCV.js loaded successfully. Please upload an image.', false);
    }
}

function onOpenCvError() {
    const errorMsg = 'Failed to load OpenCV.js. Please check your internet connection and reload the page.';
    console.error(errorMsg);
    SharedState.showStatus(errorMsg, true);
    loadingMsgEl.textContent = 'Error loading OpenCV.js!';
    loadingMsgEl.style.color = 'red';
}

// --- Image Handling ---
function displayImage(imgElement) {
    const canvas = SharedState.getCanvas();
    const ctx = SharedState.getContext();
    if (!canvas || !ctx) {
        console.error("Canvas not initialized before displaying image.");
        SharedState.showStatus("Error: Canvas not ready.", true);
        return;
    }
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    SharedState.setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height)); // Use setter function
    imageLoaded = true;

    // Reset state when a new image is loaded - using setState functions
    SharedState.setShowGrid(false); // Use setter function instead of direct assignment
    gridToggle.checked = false;
    gridToggle.disabled = true; // Enable only when scale is set
    imageScaleMmInput.disabled = false;
    applyScaleBtn.disabled = false; // Enable the scale button
    imageScaleMmInput.value = '';
    SharedState.setPixelsPerMm(null); // Use setter function
    SharedState.clearDetectionResults(); // Use a function to clear array
    SharedState.clearPolygons(); // Use a function to clear array

    // Disable controls and buttons until scale is set
    Object.values(SharedState.sliders).forEach(slider => slider.disabled = true);
    detectBtn.disabled = true;
    generatePolygonsBtn.disabled = true;
    resetBtn.disabled = false; // Enable reset
    detectionLayerToggle.disabled = true;
    detectionLayerToggle.checked = false;
    polygonLayerToggle.disabled = true;
    polygonLayerToggle.checked = false;
    baseLayerToggle.disabled = false; // Base layer always available
    baseLayerToggle.checked = true;

    SharedState.hideStatus();
    SharedState.showStatus('Please set the image width in mm to enable detection controls.', false, true);
    SharedState.updateLayerVisibility(); // Show only base layer
}

// --- Scaling ---
function updateScale() {
    const canvas = SharedState.getCanvas();
    const scaleInput = imageScaleMmInput.value.trim();
    const scaleMm = parseFloat(scaleInput);
    const minScale = 10;
    const maxScale = 100000;
    const scaleStatusEl = document.getElementById('scaleStatus');
    
    console.log("updateScale called with value:", scaleInput);
    console.log("Parsed scale value:", scaleMm);
    console.log("Image loaded:", imageLoaded);
    console.log("Canvas:", canvas);

    if (!imageLoaded) {
        if (scaleStatusEl) {
            scaleStatusEl.textContent = "Please upload an image first.";
            scaleStatusEl.style.display = "block";
            scaleStatusEl.style.color = "#e74c3c";
        }
        return;
    }

    if (scaleInput === '') {
        if (scaleStatusEl) {
            scaleStatusEl.textContent = "Please enter a width value.";
            scaleStatusEl.style.display = "block";
            scaleStatusEl.style.color = "#e74c3c";
        }
        SharedState.showStatus(`Please enter a valid image width between ${minScale}mm and ${maxScale}mm.`, false, true);
        SharedState.setPixelsPerMm(null); // Use setter function
        updateControls(false);
        return;
    }

    if (isNaN(scaleMm) || scaleMm < minScale || scaleMm > maxScale) {
        if (scaleStatusEl) {
            scaleStatusEl.textContent = `Width must be between ${minScale}mm and ${maxScale}mm.`;
            scaleStatusEl.style.display = "block";
            scaleStatusEl.style.color = "#e74c3c";
        }
        SharedState.showStatus(`Please enter a valid image width between ${minScale}mm and ${maxScale}mm.`, false, true);
        console.log("Scale validation failed. isNaN:", isNaN(scaleMm), "< minScale:", scaleMm < minScale, "> maxScale:", scaleMm > maxScale);
        SharedState.setPixelsPerMm(null); // Use setter function
        updateControls(false);
        return;
    }

    // Proceed if scale is valid
    SharedState.setPixelsPerMm(canvas.width / scaleMm); // Use setter function
    console.log(`Calculated scale: ${SharedState.pixelsPerMm.toFixed(3)} pixels/mm`);

    if (scaleStatusEl) {
        scaleStatusEl.textContent = `Valid! Scale: 1mm = ${SharedState.pixelsPerMm.toFixed(3)}px`;
        scaleStatusEl.style.display = "block";
        scaleStatusEl.style.color = "#27ae60";
    }

    // Update max width/height slider limits based on current image dimensions
    const currentImageWidthMm = canvas.width / SharedState.pixelsPerMm;
    const currentImageHeightMm = canvas.height / SharedState.pixelsPerMm;
    
    // Update FINAL polygon max limits
    SharedState.sliders.maxWidth.max = Math.max(100, Math.ceil(currentImageWidthMm));
    SharedState.sliders.maxHeight.max = Math.max(100, Math.ceil(currentImageHeightMm));
    
    // Update DETECTION max limits
    SharedState.sliders.detectMaxWidth.max = Math.max(100, Math.ceil(currentImageWidthMm));
    SharedState.sliders.detectMaxHeight.max = Math.max(100, Math.ceil(currentImageHeightMm));

    // Set default max values if needed for final polygon max width/height
    if (parseFloat(SharedState.sliders.maxWidth.value) > parseFloat(SharedState.sliders.maxWidth.max) || !SharedState.valueDisplays.maxWidth.textContent || parseFloat(SharedState.valueDisplays.maxWidth.textContent) <= 0) {
        SharedState.sliders.maxWidth.value = SharedState.sliders.maxWidth.max;
        SharedState.valueDisplays.maxWidth.textContent = SharedState.sliders.maxWidth.max;
    }
    if (parseFloat(SharedState.sliders.maxHeight.value) > parseFloat(SharedState.sliders.maxHeight.max) || !SharedState.valueDisplays.maxHeight.textContent || parseFloat(SharedState.valueDisplays.maxHeight.textContent) <= 0) {
        SharedState.sliders.maxHeight.value = SharedState.sliders.maxHeight.max;
        SharedState.valueDisplays.maxHeight.textContent = SharedState.sliders.maxHeight.max;
    }
    
    // Set default max values if needed for detection max width/height
    if (parseFloat(SharedState.sliders.detectMaxWidth.value) > parseFloat(SharedState.sliders.detectMaxWidth.max)) {
        SharedState.sliders.detectMaxWidth.value = SharedState.sliders.detectMaxWidth.max;
    }
    if (parseFloat(SharedState.sliders.detectMaxHeight.value) > parseFloat(SharedState.sliders.detectMaxHeight.max)) {
        SharedState.sliders.detectMaxHeight.value = SharedState.sliders.detectMaxHeight.max;
    }
    
    // Update UI settings to reflect potential changes
    updateUISettings();
    updateControls(true);

    if (SharedState.showGrid) SharedState.resetImage(false);
    SharedState.hideStatus();
    SharedState.showStatus(`Scale set: 1mm = ${SharedState.pixelsPerMm.toFixed(3)}px. Detection controls enabled.`, false, false);
    SharedState.updateLayerVisibility();
}

// Helper function to update controls based on scale validity
function updateControls(enable) {
    console.log("updateControls called with enable =", enable);
    
    // Explicitly update each control with visual feedback
    detectBtn.disabled = !enable;
    console.log("detectBtn.disabled =", detectBtn.disabled);
    
    gridToggle.disabled = !enable;
    console.log("gridToggle.disabled =", gridToggle.disabled);
    
    // Enable/disable the unify islands toggle
    unifyIslandsToggle.disabled = !enable;
    console.log("unifyIslandsToggle.disabled =", unifyIslandsToggle.disabled);
    
    // Debug all sliders
    console.log("Updating sliders...");
    Object.keys(SharedState.sliders).forEach(id => {
        const slider = SharedState.sliders[id];
        if (slider) {
            slider.disabled = !enable;
            console.log(`Slider ${id}.disabled =`, slider.disabled);
        } else {
            console.warn(`Slider ${id} not found`);
        }
    });
    
    // Always disable stage 2 button, it gets enabled only after detection runs
    generatePolygonsBtn.disabled = true;
    console.log("generatePolygonsBtn.disabled =", generatePolygonsBtn.disabled);

    // Clear previous results if scale is invalid
    if (!enable) {
        SharedState.detectionResults.length = 0;
        SharedState.polygons.length = 0;
        detectionLayerToggle.disabled = true;
        detectionLayerToggle.checked = false;
        polygonLayerToggle.disabled = true;
        polygonLayerToggle.checked = false;
    }
    
    // Force DOM to update
    setTimeout(() => {
        console.log("Forced UI update check - detectBtn.disabled =", detectBtn.disabled);
    }, 0);
}

/* =============================================================================
   Workflow Functions (Calling Imported Detection Logic)
   ========================================================================== */

async function runDetectElementsWorkflow() {
    if (!cvReady || !imageLoaded || !SharedState.pixelsPerMm) {
        SharedState.showStatus('Image, OpenCV, or scale not ready. Please check setup.', true);
        return;
    }

    // Disable buttons during processing
    detectBtn.disabled = true;
    generatePolygonsBtn.disabled = true;
    polygonLayerToggle.checked = false; // Hide polygon layer if re-running detection
    polygonLayerToggle.disabled = true;

    try {
        // Call the imported detection function (returns a promise)
        const foundElements = await detectElements(); // Awaits the setTimeout within detectElements

        // Update UI based on results (detectionResults array is modified by detectElements)
        SharedState.drawDetectionLayer(); // Draw the results (Exported)
        detectionLayerToggle.disabled = !foundElements;
        detectionLayerToggle.checked = foundElements;
        if (foundElements) {
            generatePolygonsBtn.disabled = false; // Enable Stage 2 button
        }
        SharedState.updateLayerVisibility(); // Refresh canvas layers (Exported)

    } catch (error) {
        // Error already shown by detectElements via showStatus
        console.error("Workflow Error (Detect Elements):", error);
        // Ensure buttons are re-enabled appropriately on error
        detectBtn.disabled = !(imageLoaded && cvReady && SharedState.pixelsPerMm);
        generatePolygonsBtn.disabled = true; // Keep disabled on error
    } finally {
        // Re-enable detect button if prerequisites are met
        detectBtn.disabled = !(imageLoaded && cvReady && SharedState.pixelsPerMm);
        // Generate button state is handled based on success/results
    }
}

async function runGeneratePolygonsWorkflow() {
    if (!cvReady || !imageLoaded || !SharedState.pixelsPerMm) {
        SharedState.showStatus('Image, OpenCV, or scale not ready.', true); return;
    }
    if (!SharedState.detectionResults || SharedState.detectionResults.length === 0) {
        SharedState.showStatus('No detection results available. Run Stage 1 Detection first.', true);
        return;
    }

    generatePolygonsBtn.disabled = true; // Disable button during processing

    try {
        // Call the imported polygon generation function (returns a promise)
        const generatedPolygons = await generatePolygons(); // Awaits the setTimeout

        // Update UI based on results (polygons array is modified by generatePolygons)
        SharedState.drawPolygonLayer(); // Draw the results (Exported)
        polygonLayerToggle.disabled = !generatedPolygons;
        polygonLayerToggle.checked = generatedPolygons;
        SharedState.updateLayerVisibility(); // Refresh canvas layers (Exported)

    } catch (error) {
        // Error already shown by generatePolygons via showStatus
        console.error("Workflow Error (Generate Polygons):", error);
    } finally {
        // Re-enable the button if detection results still exist
        generatePolygonsBtn.disabled = !(SharedState.detectionResults && SharedState.detectionResults.length > 0);
    }
}


/* =============================================================================
   Event Listeners Setup
   ========================================================================== */
function setupEventListeners() {
    // Setup sliders (references imported workflows for debouncing)
    // STAGE 1: Detection Sliders (isPolygonSlider = false)
    setupSlider('cannyThreshold1', 'cannyThreshold1Value', 1, false);
    setupSlider('cannyThreshold2', 'cannyThreshold2Value', 1, false);
    setupSlider('orthogonalBias', 'orthogonalBiasValue', 1, false);
    setupSlider('detectMinWidth', 'detectMinWidthValue', 1, false);
    setupSlider('detectMinHeight', 'detectMinHeightValue', 1, false);
    setupSlider('detectMaxWidth', 'detectMaxWidthValue', 1, false);
    setupSlider('detectMaxHeight', 'detectMaxHeightValue', 1, false);
    
    // STAGE 2: Polygon Refinement Sliders (isPolygonSlider = true)
    setupSlider('straightnessThreshold', 'straightnessThresholdValue', 0.01, true);
    setupSlider('bridgeVerticesThreshold', 'bridgeVerticesThresholdValue', 1, true);
    setupSlider('epsilon', 'epsilonValue', 0.001, true);
    setupSlider('snapGridSize', 'snapGridSizeValue', 1, true);
    setupSlider('closeCornersThreshold', 'closeCornersThresholdValue', 1, true);
    setupSlider('minWidth', 'minWidthValue', 1, true);
    setupSlider('minHeight', 'minHeightValue', 1, true);
    setupSlider('maxWidth', 'maxWidthValue', 1, true);
    setupSlider('maxHeight', 'maxHeightValue', 1, true);

    // Layer visibility toggles
    baseLayerToggle.addEventListener('change', SharedState.updateLayerVisibility);
    detectionLayerToggle.addEventListener('change', SharedState.updateLayerVisibility);
    polygonLayerToggle.addEventListener('change', SharedState.updateLayerVisibility);
    baseLayerToggle.disabled = true; // Initially disabled until image loaded
    detectionLayerToggle.disabled = true;
    polygonLayerToggle.disabled = true;
    
    // Unify Islands Toggle
    unifyIslandsToggle.addEventListener('change', function() {
        SharedState.setUnifyIslands(this.checked);
        // If detection has already run, re-run it with the new setting
        if (imageLoaded && cvReady && SharedState.pixelsPerMm && SharedState.detectionResults.length > 0) {
            runDetectElementsWorkflow();
        }
    });

    // Image Upload Listener
    imageInputEl.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) { SharedState.showStatus('No file selected.', false, true); return; }
        if (!file.type.match('image.*')) { SharedState.showStatus('Please upload an image file.', true); return; }

        const reader = new FileReader();
        reader.onload = function(event) {
            imgElement = new Image(); // Create new image element to avoid cache issues
            imgElement.onload = () => {
                // NO cleanupResources needed here, handled by detection logic modules
                displayImage(imgElement); // Handles UI reset etc.
            };
            imgElement.onerror = () => { SharedState.showStatus('Error loading image file.', true); };
            imgElement.src = event.target.result;
        }
        reader.onerror = () => { SharedState.showStatus('Error reading file.', true); };
        reader.readAsDataURL(file);
    });

    // Scale Input Listener - Multiple events for better capture
    imageScaleMmInput.addEventListener('keyup', (e) => {
        // Also handle Enter key
        if (e.key === 'Enter') {
            console.log("Enter key pressed in scale input");
            imageScaleMmInput.blur(); // Trigger blur which will update
        } else {
            console.log("Key pressed in scale input:", e.key);
            updateScale();
        }
    });
    
    // Catch when input loses focus
    imageScaleMmInput.addEventListener('blur', () => {
        console.log("Scale input blur event");
        updateScale();
    });
    
    // Apply scale button
    applyScaleBtn.addEventListener('click', () => {
        console.log("Apply scale button clicked");
        updateScale();
    });
    
    // Also keep the change event as backup
    imageScaleMmInput.addEventListener('change', () => {
        console.log("Scale input change event");
        updateScale();
    });

    // Button Listeners (call workflow functions)
    detectBtn.addEventListener('click', runDetectElementsWorkflow);
    generatePolygonsBtn.addEventListener('click', runGeneratePolygonsWorkflow);
    resetBtn.addEventListener('click', () => {
        if (!imageLoaded) return;
        SharedState.resetImage(true); // Redraw original image + grid
        SharedState.clearDetectionResults(); // Use function to clear shared state
        SharedState.clearPolygons(); // Use function to clear shared state
        detectBtn.disabled = !SharedState.pixelsPerMm;
        generatePolygonsBtn.disabled = true;
        detectionLayerToggle.disabled = true;
        polygonLayerToggle.disabled = true;
        detectionLayerToggle.checked = false;
        polygonLayerToggle.checked = false;
        SharedState.hideStatus();
        SharedState.updateLayerVisibility();
    });

    // Grid Toggle Listener
    gridToggle.addEventListener('change', function() {
        SharedState.setShowGrid(this.checked); // Use setter function
        if (imageLoaded) {
            SharedState.updateLayerVisibility(); // Redraw layers
        }
    });

    // Global error listener
    window.addEventListener('unhandledrejection', event => {
         console.error('Unhandled Promise Rejection:', event.reason);
         SharedState.showStatus(`An unexpected error occurred: ${event.reason?.message || event.reason}`, true);
         // Optionally disable buttons here if the error is critical
         detectBtn.disabled = true;
         generatePolygonsBtn.disabled = true;
    });

    // NO beforeunload cleanup needed here for OpenCV resources now.

    // Initial UI Update
    updateUISettings();
}

/* =============================================================================
   Initialization
   ========================================================================== */
function initializeCanvas() {
    const canvasElement = document.getElementById('canvasOutput');
    if (!canvasElement) {
        console.error('Canvas element not found');
        SharedState.showStatus("Error: Canvas element 'canvasOutput' not found.", true);
        return false;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
        console.error('Failed to get 2D canvas context');
        SharedState.showStatus("Error: Failed to get 2D context from canvas.", true);
        return false;
    }
    
    // Update the shared state
    SharedState.setCanvas(canvasElement);
    SharedState.setContext(context);
    
    console.log('Canvas initialized successfully');
    return true;
}

function loadOpenCV() {
    const script = document.createElement('script');
    script.async = true;
    // Ensure you are using a version compatible with the detection logic
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.onload = onOpenCvReady;
    script.onerror = onOpenCvError;
    
    // Add a timeout to detect stalled loading
    const loadTimeout = setTimeout(() => {
        console.warn("OpenCV load taking longer than expected. Please be patient...");
        loadingMsgEl.textContent = 'OpenCV.js load taking longer than expected. Still loading... Please wait.';
    }, 5000);
    
    // Clear timeout once loaded
    script.addEventListener('load', () => {
        clearTimeout(loadTimeout);
    });
    
    document.body.appendChild(script);
    loadingMsgEl.textContent = 'Loading OpenCV.js (approx. 10MB)... Please wait.';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize core logic AFTER DOM is ready
    // Canvas init and event listeners are called within onOpenCvReady
    loadOpenCV(); // Start loading OpenCV
});

// --- Exports for Detection Logic and potentially other modules ---
export {
    // Re-export the entire SharedState module
    SharedState
};

// ===================================================================================
// UPDATE LOG | v2.1.0 -> v3.0.0 - Module Split
// ===================================================================================
//
// - FILE SPLIT | Monolithic script split into `BEF_-_Core-App-Logic.js` (this file) and 
//   `BEF_-_Detection-Logic.js`.
//
// - RESPONSIBILITIES:
//   - CORE: Manages DOM interactions, UI updates, event listeners, state management (image load, scale, 
//     grid), layer visibility, canvas drawing (base, grid, results), and calls detection functions.
//   - DETECTION: Manages image preprocessing (`preprocessImage`), stage 1 detection (`detectElements`), 
//     stage 2 polygon generation (`generatePolygons`), and related helpers (`snapToGrid`). Contains 
//     OpenCV-specific operations.
//
// - MODULARITY: Implemented using ES6 Modules (`import`/`export`).
//
// - INTERFACE:
//   - CORE imports `detectElements`, `generatePolygons` from DETECTION.
//   - DETECTION imports `canvas`, `ctx`, `pixelsPerMm`, `detectionResults`, `polygons`, `showStatus`, 
//     `sliders`, `valueDisplays`, `resetImage`, `drawDetectionLayer`, `drawPolygonLayer`, 
//     `updateLayerVisibility` etc. from CORE.
//   - Shared state (`detectionResults`, `polygons`) and necessary UI elements/values (`sliders`, 
//     `valueDisplays`) are exported by CORE and imported/modified by DETECTION.
//
// - WORKFLOW:
//   - Button clicks and slider changes in CORE now trigger `async` workflow functions 
//     (`runDetectElementsWorkflow`, `runGeneratePolygonsWorkflow`).
//   - These workflow functions handle disabling/enabling UI, calling the imported `detectElements`/
//     `generatePolygons` (which return Promises), awaiting their completion, and then updating the 
//     UI/layers in CORE.
//
// - OPENCV: Still loaded globally by CORE. DETECTION assumes `cv` is available.
//
// - DRAWING: Drawing functions (`drawLayer`, `drawDetectionLayer`, `drawPolygonLayer`, `drawGrid`) remain 
//   in CORE. DETECTION updates the data arrays (`detectionResults`, `polygons`), and CORE handles drawing 
//   them based on layer visibility. `updateLayerVisibility` orchestrates the redrawing.
//
// - RESOURCE MANAGEMENT: OpenCV Mat cleanup is now primarily handled within the `detectElements` and 
//   `generatePolygons` functions in DETECTION using `try...finally`. Global `cleanupResources` function 
//   removed from CORE as it's no longer needed for Mats.
//
// - DEPENDENCIES: The HTML file must now load `BEF_-_Core-App-Logic.js` using `<script type="module" ...>`.
//
// - HELPER FUNCTIONS: `snapToGrid` moved to DETECTION. Unused helpers (`angleBetweenLines`, 
//   `extractPointsFromContour`) removed for clarity but noted in DETECTION comments.
//
// - ERROR HANDLING: Promises returned by detection functions allow for better async error handling in the 
//   workflow functions. `showStatus` is used by both modules for user feedback. Global unhandled rejection 
//   listener kept in CORE.
// ===================================================================================