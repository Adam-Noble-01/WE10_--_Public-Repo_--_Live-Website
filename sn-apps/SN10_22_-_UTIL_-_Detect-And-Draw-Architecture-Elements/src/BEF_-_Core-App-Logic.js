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
import { exportPNGMask, exportDXF } from './BEF_-_Export-Logic.js';

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
const exportPNGBtn = document.getElementById('exportPNGBtn');
const exportDXFBtn = document.getElementById('exportDXFBtn');
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
        
        // Initialize the status panel with a welcome message
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.className = 'APPL__Status-Panel';
            statusEl.style.display = 'block'; // Always show the panel
        }
        
        // Auto-hide the status message after 3 seconds
        setTimeout(() => {
            SharedState.hideStatus();
        }, 3000);
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
    
    // Store the original image data for reset operations
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
    SharedState.setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    
    // Store a reference to the image element itself for better zoom/pan redrawing
    SharedState.setOriginalImage(imgElement);
    
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
    const hasImage = enable;
    const canDetect = hasImage && SharedState.pixelsPerMm !== null;
    const hasDetectionResults = hasImage && canDetect && SharedState.detectionResults.length > 0;
    const hasPolygons = hasImage && canDetect && SharedState.polygons.length > 0;
    
    // File inputs and scaling controls can be enabled if an image is loaded
    imageInputEl.disabled = !hasImage && imageLoaded; // Only disable during processing
    imageScaleMmInput.disabled = !hasImage;
    applyScaleBtn.disabled = !hasImage;
    
    // Detection controls require both an image and scale
    detectBtn.disabled = !canDetect;
    SharedState.sliders.cannyThreshold1.disabled = !canDetect;
    SharedState.sliders.cannyThreshold2.disabled = !canDetect;
    SharedState.sliders.orthogonalBias.disabled = !canDetect;
    SharedState.sliders.detectMinWidth.disabled = !canDetect;
    SharedState.sliders.detectMinHeight.disabled = !canDetect;
    SharedState.sliders.detectMaxWidth.disabled = !canDetect;
    SharedState.sliders.detectMaxHeight.disabled = !canDetect;
    
    // These controls need detection results
    generatePolygonsBtn.disabled = !hasDetectionResults;
    SharedState.sliders.straightnessThreshold.disabled = !hasDetectionResults;
    SharedState.sliders.bridgeVerticesThreshold.disabled = !hasDetectionResults;
    SharedState.sliders.epsilon.disabled = !hasDetectionResults;
    SharedState.sliders.snapGridSize.disabled = !hasDetectionResults;
    SharedState.sliders.closeCornersThreshold.disabled = !hasDetectionResults;
    SharedState.sliders.minWidth.disabled = !hasDetectionResults;
    SharedState.sliders.minHeight.disabled = !hasDetectionResults;
    SharedState.sliders.maxWidth.disabled = !hasDetectionResults;
    SharedState.sliders.maxHeight.disabled = !hasDetectionResults;
    
    // Reset button
    resetBtn.disabled = !hasImage;
    
    // Layer visibility toggles
    baseLayerToggle.disabled = !hasImage;
    detectionLayerToggle.disabled = !hasDetectionResults;
    polygonLayerToggle.disabled = !hasPolygons;
    
    // Grid toggle
    gridToggle.disabled = !hasImage || SharedState.pixelsPerMm === null;
    
    // Other toggles
    unifyIslandsToggle.disabled = !canDetect;
    
    // Export buttons - require polygons to be generated
    exportPNGBtn.disabled = !hasPolygons;
    exportDXFBtn.disabled = !hasPolygons;
    
    // Update UI with current settings
    updateUISettings();
}

/* =============================================================================
   Workflow Functions (Calling Imported Detection Logic)
   ========================================================================== */

async function runDetectElementsWorkflow() {
    if (!imageLoaded || !cvReady || !SharedState.pixelsPerMm) {
        SharedState.showStatus("Please load an image and set scale first.", false, true);
        return;
    }

    try {
        // Disable UI controls during processing
        detectBtn.disabled = true;
        document.body.style.cursor = 'wait';
        
        // Clear any existing detection and polygon results
        SharedState.clearDetectionResults();
        SharedState.clearPolygons();
        
        // Run the detection logic (returns a promise)
        await detectElements();
        
        // Enable detection layer toggle and ensure it's checked
        detectionLayerToggle.disabled = false;
        detectionLayerToggle.checked = true;
        
        // Enable the generate polygons button if detection succeeded
        if (SharedState.detectionResults.length > 0) {
            generatePolygonsBtn.disabled = false;
            
            // Disable polygon layer toggle until polygons are generated
            polygonLayerToggle.disabled = true;
            polygonLayerToggle.checked = false;
            
            // Disable export buttons until polygons are generated
            exportPNGBtn.disabled = true;
            exportDXFBtn.disabled = true;
            
            // Call updateControls to enable the Stage 2 sliders
            updateControls(true);
        }
        
        // Update layer visibility
        SharedState.updateLayerVisibility();
        
        // Success message
        SharedState.showStatus(`Stage 1 Complete: Found ${SharedState.detectionResults.length} potential elements.`);
    } catch (error) {
        console.error("Error in detection:", error);
        SharedState.showStatus(`Stage 1 Error: ${error.message}`, true);
    } finally {
        // Re-enable UI controls regardless of outcome
        detectBtn.disabled = false;
        document.body.style.cursor = 'default';
    }
}

async function runGeneratePolygonsWorkflow() {
    if (!imageLoaded || !cvReady || !SharedState.pixelsPerMm) {
        SharedState.showStatus("Please load an image and set scale first.", false, true);
        return;
    }

    if (SharedState.detectionResults.length === 0) {
        SharedState.showStatus("Please run detection first.", false, true);
        return;
    }

    try {
        // Disable UI controls during processing
        generatePolygonsBtn.disabled = true;
        document.body.style.cursor = 'wait';
        
        // Generate polygons (returns a promise)
        await generatePolygons();
        
        // Enable polygon layer toggle and ensure it's checked
        polygonLayerToggle.disabled = false;
        polygonLayerToggle.checked = true;
        
        // Enable export buttons
        exportPNGBtn.disabled = false;
        exportDXFBtn.disabled = false;
        
        // Update layer visibility
        SharedState.updateLayerVisibility();
        
        // Success message
        SharedState.showStatus(`Stage 2 Complete: Generated ${SharedState.polygons.length} CAD-ready polygons.`);
    } catch (error) {
        console.error("Error in polygon generation:", error);
        SharedState.showStatus(`Stage 2 Error: ${error.message}`, true);
    } finally {
        // Re-enable UI controls regardless of outcome
        generatePolygonsBtn.disabled = false;
        document.body.style.cursor = 'default';
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
    setupSlider('epsilon', 'epsilonValue', 0.1, true);
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
                
                // Reset zoom and pan when loading a new image
                SharedState.resetView();
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
            // Don't call updateScale on every keystroke - only validate on Enter, blur, or apply button
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
        
        // Reset zoom and pan when resetting the image
        SharedState.resetView();
        
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

    // === ZOOM AND PAN FUNCTIONALITY ===
    const canvas = SharedState.getCanvas();
    if (canvas) {
        // Mouse wheel for zooming
        canvas.addEventListener('wheel', function(e) {
            if (!imageLoaded) return;
            
            e.preventDefault(); // Prevent page scrolling
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert mouse position to image coordinates before zoom
            const beforeZoomCoords = SharedState.screenToImageCoords(mouseX, mouseY);
            
            // Calculate new zoom level based on wheel delta
            const zoomFactor = 1.1; // 10% zoom per wheel tick
            if (e.deltaY < 0) {
                // Zoom in
                SharedState.setZoomLevel(SharedState.zoomLevel * zoomFactor);
            } else {
                // Zoom out
                SharedState.setZoomLevel(SharedState.zoomLevel / zoomFactor);
            }
            
            // Convert the same image point to new screen coordinates after zoom
            const afterZoomX = beforeZoomCoords.x * SharedState.zoomLevel + SharedState.offsetX;
            const afterZoomY = beforeZoomCoords.y * SharedState.zoomLevel + SharedState.offsetY;
            
            // Adjust offset to keep the point under mouse cursor
            SharedState.setOffset(
                SharedState.offsetX + (mouseX - afterZoomX),
                SharedState.offsetY + (mouseY - afterZoomY)
            );
            
            // Update the view
            SharedState.updateLayerVisibility();
            
            // Show current zoom level in status
            SharedState.showStatus(`Zoom: ${SharedState.zoomLevel.toFixed(1)}x`, false, false, 1000);
        });
        
        // Middle mouse button or right mouse button for panning
        canvas.addEventListener('mousedown', function(e) {
            if (!imageLoaded) return;
            
            // Middle mouse button (1) or right mouse button (2)
            if (e.button === 1 || e.button === 2) {
                e.preventDefault(); // Prevent default behavior
                
                // Start dragging
                SharedState.setIsDragging(true);
                SharedState.setLastMousePos(e.clientX, e.clientY);
                
                // Change cursor to indicate panning
                canvas.style.cursor = 'grabbing';
            }
        });
        
        // Handle mouse move for panning
        canvas.addEventListener('mousemove', function(e) {
            if (!imageLoaded || !SharedState.isDragging()) return;
            
            // Calculate the distance moved
            const deltaX = e.clientX - SharedState.getLastMouseX();
            const deltaY = e.clientY - SharedState.getLastMouseY();
            
            // Update last mouse position
            SharedState.setLastMousePos(e.clientX, e.clientY);
            
            // Update the offset (pan)
            SharedState.setOffset(
                SharedState.offsetX + deltaX,
                SharedState.offsetY + deltaY
            );
            
            // Update the view
            SharedState.updateLayerVisibility();
        });
        
        // Handle mouse up to stop panning
        window.addEventListener('mouseup', function(e) {
            if (SharedState.isDragging()) {
                SharedState.setIsDragging(false);
                canvas.style.cursor = 'default';
            }
        });
        
        // Prevent context menu on right-click
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Double-click to reset view
        canvas.addEventListener('dblclick', function(e) {
            if (!imageLoaded) return;
            
            SharedState.resetView();
            SharedState.updateLayerVisibility();
            SharedState.showStatus('View reset to 100%', false, false, 1000);
        });
        
        // Touch events for mobile support (if needed)
        let initialPinchDistance = 0;
        let initialZoom = 1;
        
        canvas.addEventListener('touchstart', function(e) {
            if (!imageLoaded) return;
            
            if (e.touches.length === 1) {
                // Single touch - start panning
                SharedState.setIsDragging(true);
                SharedState.setLastMousePos(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                // Two fingers - start pinch zooming
                initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialZoom = SharedState.zoomLevel;
                
                // Calculate center point between fingers (pivot point)
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                
                const rect = canvas.getBoundingClientRect();
                const mouseX = centerX - rect.left;
                const mouseY = centerY - rect.top;
                
                // Save pivot point in image coordinates
                const pivotPoint = SharedState.screenToImageCoords(mouseX, mouseY);
                SharedState.setPinchPivot(pivotPoint.x, pivotPoint.y);
            }
        });
        
        canvas.addEventListener('touchmove', function(e) {
            if (!imageLoaded) return;
            e.preventDefault(); // Prevent page scrolling
            
            if (e.touches.length === 1 && SharedState.isDragging()) {
                // Single touch - panning
                const deltaX = e.touches[0].clientX - SharedState.getLastMouseX();
                const deltaY = e.touches[0].clientY - SharedState.getLastMouseY();
                
                SharedState.setLastMousePos(e.touches[0].clientX, e.touches[0].clientY);
                
                SharedState.setOffset(
                    SharedState.offsetX + deltaX,
                    SharedState.offsetY + deltaY
                );
                
                SharedState.updateLayerVisibility();
            } else if (e.touches.length === 2) {
                // Two fingers - pinch zooming
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                if (initialPinchDistance > 0) {
                    // Calculate new zoom based on the change in distance
                    const newZoom = initialZoom * (currentDistance / initialPinchDistance);
                    
                    // Calculate center point between fingers
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = centerX - rect.left;
                    const mouseY = centerY - rect.top;
                    
                    const beforeZoom = SharedState.zoomLevel;
                    SharedState.setZoomLevel(newZoom);
                    
                    // Adjust offset to zoom around pivot point
                    const pivotPoint = SharedState.getPinchPivot();
                    if (pivotPoint.isDefined) {
                        const afterZoomX = pivotPoint.x * SharedState.zoomLevel + SharedState.offsetX;
                        const afterZoomY = pivotPoint.y * SharedState.zoomLevel + SharedState.offsetY;
                        
                        SharedState.setOffset(
                            SharedState.offsetX + (mouseX - afterZoomX),
                            SharedState.offsetY + (mouseY - afterZoomY)
                        );
                    }
                    
                    SharedState.updateLayerVisibility();
                    SharedState.showStatus(`Zoom: ${SharedState.zoomLevel.toFixed(1)}x`, false, false, 1000);
                }
            }
        });
        
        canvas.addEventListener('touchend', function(e) {
            if (SharedState.isDragging() && e.touches.length === 0) {
                SharedState.setIsDragging(false);
            }
            
            // Reset pinch variables when removing fingers
            if (e.touches.length < 2) {
                initialPinchDistance = 0;
                SharedState.clearPinchPivot();
            }
        });
    }

    // NO beforeunload cleanup needed here for OpenCV resources now.

    // Initial UI Update
    updateUISettings();

    // Export PNG Button
    exportPNGBtn.addEventListener('click', function() {
        if (SharedState.polygons.length === 0) {
            SharedState.showStatus("No polygons available to export. Generate polygons first.", false, true);
            return;
        }
        
        exportPNGBtn.disabled = true;
        exportPNGMask()
            .catch(error => {
                console.error("PNG Export error:", error);
                SharedState.showStatus(`Export failed: ${error.message}`, true);
            })
            .finally(() => {
                exportPNGBtn.disabled = false;
            });
    });
    
    // Export DXF Button
    exportDXFBtn.addEventListener('click', function() {
        if (SharedState.polygons.length === 0) {
            SharedState.showStatus("No polygons available to export. Generate polygons first.", false, true);
            return;
        }
        
        exportDXFBtn.disabled = true;
        exportDXF()
            .catch(error => {
                console.error("DXF Export error:", error);
                SharedState.showStatus(`Export failed: ${error.message}`, true);
            })
            .finally(() => {
                exportDXFBtn.disabled = false;
            });
    });
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
    // Use a more reliable URL for OpenCV.js
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.onload = function() {
        // Give time for OpenCV to initialize
        setTimeout(onOpenCvReady, 500);
    };
    script.onerror = function(e) {
        console.error("Failed to load OpenCV.js from CDN, trying local fallback", e);
        
        // Try loading from a local fallback
        const fallbackScript = document.createElement('script');
        fallbackScript.async = true;
        fallbackScript.src = './lib/opencv.js'; // Local fallback path - ensure this exists
        fallbackScript.onload = function() {
            // Give time for OpenCV to initialize
            setTimeout(onOpenCvReady, 500);
        };
        fallbackScript.onerror = function() {
            console.error("Failed to load local OpenCV.js fallback");
            onOpenCvError();
        };
        document.body.appendChild(fallbackScript);
    };
    
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
// UPDATE LOG | v1.1.0 -> v1.2.0 - Module Split
// Updated - 15 Apr 2025
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