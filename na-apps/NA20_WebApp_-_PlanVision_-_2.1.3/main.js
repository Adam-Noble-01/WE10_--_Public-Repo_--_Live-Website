// JAVASCRIPT |  PLANVISION APP
// ----------------------------------------------------------------------------
// - This script is the main entry point for the PlanVision application
// - It initialises the application and loads the necessary assets and drawings
// - It orchestrates interactions between modules (canvas, drawing, assets, tools).
// ----------------------------------------------------------------------------


// LOW PRIORITY TASKS
// ----------------------------------------------------------------------------
// - Remove The Cdn Font Backup And Instead Use The Asset Library Fonts
// - Update Asset loader script to pull from new asset library json file
// - Add panView function to canvas-utilities.js
// - Test canvas-utilities module thoroughly
// ----------------------------------------------------------------------------


// ITEMS SUCCESSFULLY OFFLOADED
// ----------------------------------------------------------------------------
// - Asset Loader Module        =   `./asset-loader.js`      | 12-Apr-2025 ✔
// - Drawing Loader Module      =   `./drawing-loader.js`    | 12-Apr-2025 ✔
// - Loading Screen Module      =   `./loading-screen.js`    | 12-Apr-2025 ✔
// - Canvas Utilities Module    =   `./canvas-utilities.js`  | 13-Apr-2025 (Pending Test)
// - Measurement Tools Module   =   `./measurement-tools.js` | 13-Apr-2025 (Pending Test)
// ----------------------------------------------------------------------------


// ----------------------------------------------------------------------------
// MODULE IMPORTS
// ----------------------------------------------------------------------------

import {
    fetchAssetLibrary,
    loadFontsFromAssetLibrary,
    updateImagesFromAssetLibrary,
    preloadFonts,
    checkFontAvailability
} from './asset-loader.js';

import {
    fetchDrawings,
    loadDrawing,
    loadPlanImage,
    createDrawingButtons,
    updateDownloadLink
} from './drawing-loader.js';

import {
    initLoadingScreen,
    showLoadingScreen,
    hideLoadingScreen,
    showErrorMessage,
    hideErrorMessage
} from './loading-screen.js';

import * as canvasUtilities from './canvas-utilities.js';
import * as measurementTools from './measurement-tools.js';

// =============================================================================================
// JAVASCRIPT |  GLOBAL VARIABLES & CONSTANTS (Main Orchestration)
// =============================================================================================

// --- DOM Elements (Core UI / Containers) ---
const planCanvas = document.getElementById("planCanvas");
const ctx = planCanvas.getContext("2d");
const menuTutorialOverlay = document.getElementById("menu-tutorial-overlay");
const toolbar = document.getElementById("toolbar");
// Note: Measurement-specific UI elements (measureInfo, cancel/finish buttons) are passed to measurementTools during init.

// --- Application State ---
let isToolbarOpen = true;
const isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

// --- Interaction State ---
let isDragging = false, lastX = 0, lastY = 0; // Panning state
let isPinching = false, pinchStartDist = 0, pinchStartZoom = 1, pinchMidpoint = { x: 0, y: 0 }; // Pinch zoom state

// --- Drawing Data State ---
let planImage = new Image(); // Current drawing image object
planImage.crossOrigin = "anonymous";
let isImageLoaded = false;
// Note: naturalImageWidth, naturalImageHeight, currentDrawingScale, currentDrawingSize, scaleMetresPerPixel are now managed/accessed via canvasUtilities

// ========================================================================
// MARKUP TOOLSET MODULE - GLOBAL VARIABLES (Remains in main.js for now)
// ========================================================================
let isMarkupToolsetActive = false;
let currentMarkupTool = null; // Default to null, set explicitly
let markupColor = '#960000';
let markupLineWidth = 4;
let markupPaths = [];
let currentMarkupPath = null; // For pencil/eraser path in progress

// Selection tool specific variables
let selectedElement = null;
let isMovingElement = false;
let moveStartPosition = null;
let selectionHandles = [];
let moveOffset = { x: 0, y: 0 };

// Arrow tool specific variables
let arrowState = 'idle'; // idle, start, end, edit
let currentArrow = null;
let activeControlPoint = null; // Reference to the DOM element being dragged
let controlPoints = []; // DOM elements for control points
let handlePoints = []; // DOM elements for handles (subset of controlPoints)

// Shape tool variables
let isShapeDrawing = false;
let shapeStartPoint = null;
let currentShape = null;

// Text tool variables
let isTextPlacing = false;
let textPlacementPoint = null;
let editingTextElement = null;

// Straight line tool variables
let isLineDrawing = false;
let currentLine = null;

// Arc tool variables
let isArcDrawing = false;
let currentArc = null;

// Undo/Redo history management
let markupHistory = [];
let markupRedoStack = [];
let maxHistoryLength = 20;

// Clipboard
let clipboardElement = null;
let pasteOffset = { x: 20, y: 20 };
let consecutivePastes = 0;

// Technical pen properties for sketchy look (Used by markup drawing functions)
const sketchiness = 0.5;
const pressureVariation = 0.2;

(function() {

    // ========================================================================
    // INITIALISATION
    // ========================================================================
    async function init() {
        const appRoot = document.getElementById("app");
        if (!appRoot) {
            console.error("Root element #app is missing from the DOM. App cannot initialise.");
            return;
        }

        // Initialize loading screen
        initLoadingScreen();
        showLoadingScreen();

        try {
            // Load assets
            const assetLibrary = await fetchAssetLibrary();
            if (assetLibrary) {
                loadFontsFromAssetLibrary(assetLibrary);
                updateImagesFromAssetLibrary(assetLibrary);
            } else {
                console.warn("Asset library failed to load. Using fallback assets.");
            }

            // Initialize Canvas Utilities (Needs canvas, context, image obj)
            // Note: resizeCanvas is called internally by initializeCanvas via listener
            canvasUtilities.initializeCanvas(planCanvas, ctx, planImage);

            // Load drawings definitions
            const drawings = await fetchDrawings();
            if (drawings) {
                // Create drawing selection buttons
                createDrawingButtons(drawings, toolbar, handleDrawingSelection);

                // Load the first available drawing
                const firstDrawingKey = Object.keys(drawings).find(
                    key => key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
                );
                if (firstDrawingKey) {
                    await handleDrawingSelection(drawings[firstDrawingKey], true); // Load silently initially
                } else {
                     showErrorMessage("No valid drawings found in the configuration.");
                }
            } else {
                 showErrorMessage("Failed to load drawing definitions.");
            }

            // Initialize Measurement Tools Module
             const measurementToolConfig = {
                context: ctx,
                getCanvasState: canvasUtilities.getCanvasState, // Pass the getter function
                getPlanCoords: toPlanCoords, // Pass coordinate conversion function
                triggerRender: renderLoop, // Pass render function reference
                uiElements: {
                    cancelToolBtn: document.getElementById("cancelToolBtn"),
                    finishMeasurementBtn: document.getElementById("finishMeasurementBtn"),
                    measureInfo: document.getElementById("measureInfo"),
                    toolInstructionsOverlay: document.getElementById("tool-instructions-overlay"),
                    toolInstructionsText: document.getElementById("tool-instructions-text")
                },
                settings: {
                    ROUND_DIMENSIONS_ENABLED: true, // Keep these settings for now
                    ROUNDING_INTERVAL: 5,
                    CONFIRM_BUTTON_OFFSET_X_PC: 10,
                    CONFIRM_BUTTON_OFFSET_Y_PC: -10,
                    CONFIRM_BUTTON_OFFSET_X_TOUCH: 10,
                    CONFIRM_BUTTON_OFFSET_Y_TOUCH: -25,
                    isTouchDevice: isTouchDevice
                }
            };
            measurementTools.initializeMeasurementTools(measurementToolConfig);


            // Attach core event listeners
            attachEventListeners();
            handleInitialTutorialFlow();
            renderLoop(); // Start render loop *after* initial drawing load attempt

            // Initial hide, might be hidden again if drawing load takes time
            if(isImageLoaded) { // Only hide if initial image loaded successfully
                        hideLoadingScreen();
            }

                    } catch (error) {
            console.error("Error during initialization:", error);
            showErrorMessage("Failed to initialize application. Please refresh the page.");
            hideLoadingScreen(); // Ensure loading screen is hidden on error
        }
    }

    // ========================================================================
    // DRAWING SELECTION HANDLER
    // ========================================================================
    async function handleDrawingSelection(drawing, initialLoad = false) {
        if (!initialLoad) {
            showLoadingScreen();
        }
        try {
            // Ensure any active tool is cancelled before loading new drawing
            if (measurementTools.isMeasurementActive()) {
                measurementTools.cancelActiveMeasurement(planCanvas);
                planCanvas.style.cursor = 'default';
            }
            if (isMarkupToolsetActive) {
                 cancelMarkupTool(); // Includes cursor reset
            }

            const drawingData = await loadDrawing(drawing); // from drawing-loader
            const imageData = await loadPlanImage(drawingData.pngUrl); // from drawing-loader

            // Update main image object and loaded flag
            planImage = imageData.image; // planImage is still used directly for drawing
            isImageLoaded = true;

            // Update canvas utilities with new image dimensions and metadata
            canvasUtilities.updateDrawingMetadata(
                drawingData.documentScale,
                drawingData.documentSize,
                imageData.naturalWidth,
                imageData.naturalHeight
            );
                        
                        // Update download link
            updateDownloadLink(drawingData.pdfUrl, drawingData.documentName); // from drawing-loader

            // Reset view uses canvas-utilities now, which includes scale recalc
            canvasUtilities.resetView();

            // Clear measurements from previous drawing
            measurementTools.clearAllMeasurements(planCanvas); // Clear measurement state/UI

            // Clear markup from previous drawing
            clearMarkup(); // Still managed in main.js

            if (!initialLoad) {
            hideLoadingScreen();
            }
            renderLoop(); // Trigger immediate render with new drawing

        } catch (error) {
            console.error("Error loading drawing:", error);
            showErrorMessage("Failed to load drawing. Please try again.");
            if (!initialLoad) {
            hideLoadingScreen();
            }
            isImageLoaded = false; // Ensure flag is false on error
        }
    }

    // ========================================================================
    // FIRST-LOAD TUTORIAL FLOW
    // ========================================================================
    function handleInitialTutorialFlow() {
        if (isMobileOrTabletPortrait()) {
            toolbar.classList.remove("collapsed");
            isToolbarOpen = true;
            setTimeout(() => {
                toolbar.classList.add("collapsed");
                isToolbarOpen = false;
                setTimeout(() => {
                    menuTutorialOverlay.style.display = "block";
                }, 300);
            }, 1000);
        }
    }

    function isMobileOrTabletPortrait() {
        const maxTabletWidth = 1024;
        return (window.innerWidth <= maxTabletWidth) && isPortrait();
    }

    function isPortrait() {
        // Use screen.orientation if available
        if (window.screen?.orientation?.type) {
            return window.screen.orientation.type.startsWith("portrait");
        }
        // Fallback for older browsers
        return window.innerHeight > window.innerWidth;
    }

    // ========================================================================
    // RENDER LOOP
    // ========================================================================
    function renderLoop() {
        if (!isImageLoaded) {
             // Optional: Maybe draw a "No image loaded" message?
             // requestAnimationFrame(renderLoop); // Keep checking? Or stop until loaded? Let's keep checking.
             return;
        };

        requestAnimationFrame(renderLoop); // Request next frame

        const canvasState = canvasUtilities.getCanvasState(); // Get current view state

        // Clear canvas
        ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);

        // --- Draw Plan Image with Transform ---
        ctx.save();                                                                  
        ctx.translate(canvasState.offsetX, canvasState.offsetY);
        ctx.scale(canvasState.zoomFactor, canvasState.zoomFactor);

        // Apply drop shadow
        ctx.shadowColor = "rgba(0,0,0, 0.2)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;

        // Draw the plan image
        if (planImage.complete && planImage.naturalWidth > 0) { // Ensure image is ready
             ctx.drawImage(planImage, 0, 0);
        } else {
             console.warn("RenderLoop: planImage not ready or invalid.");
             // Optionally draw placeholder?
        }
         ctx.shadowColor = "transparent"; // Reset shadow for overlays
         ctx.shadowBlur = 0;
         ctx.shadowOffsetX = 0;
         ctx.shadowOffsetY = 0;
         // NOTE: We restore the context *after* drawing overlays now, so overlays inherit transform

        // --- Draw Overlays (Measurements & Markup) ---

        // Draw completed measurements (delegated)
        measurementTools.drawCompletedMeasurements();

        // Draw measurement currently in progress (delegated)
        measurementTools.drawCurrentMeasurement();

        // Draw markup paths (managed here)
        // Pass canvasState in case zoomFactor is needed inside drawing functions
        if (isMarkupToolsetActive || markupPaths.length > 0) {
            drawAllMarkupPaths(ctx, canvasState);
        }

        ctx.restore(); // Restore context AFTER drawing all transformed elements

        // --- Non-Transformed UI Elements ---
        // Note: Confirm button positioning is handled internally by measurementTools module
        // Selection handles positioning is handled by updateAllHandlePositions/createSelectionHandles
    }


    // ========================================================================
    // COORDINATE CONVERSION (Uses Canvas Utilities)
    // ========================================================================
    function toPlanCoords(screenX, screenY) {
        // Get current state directly from canvas utilities
        const { offsetX, offsetY, zoomFactor } = canvasUtilities.getCanvasState();
        // Prevent division by zero or invalid zoom
        if (zoomFactor === 0) {
            console.warn("Zoom factor is zero, returning default coordinates.");
            return { x: 0, y: 0 };
        }
        return {
            x: (screenX - offsetX) / zoomFactor,
            y: (screenY - offsetY) / zoomFactor
        };
    }  


    // ========================================================================
    // EVENT LISTENERS & INTERACTION
    // ========================================================================
    function attachEventListeners() {
        // --- Core Canvas Interaction ---
        planCanvas.addEventListener("mousedown", onMouseDown);
        planCanvas.addEventListener("mousemove", onMouseMove);
        planCanvas.addEventListener("mouseup", onMouseUp);
        planCanvas.addEventListener("wheel", onWheel, { passive: false });
        planCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
        planCanvas.addEventListener("touchmove", onTouchMove, { passive: false });
        planCanvas.addEventListener("touchend", onTouchEnd);
        planCanvas.addEventListener("touchcancel", onTouchEnd);

        // --- Window Level ---
        window.addEventListener("resize", onResize); // Use wrapper for canvas utilities
        window.addEventListener("keydown", onKeyDown); // Markup tool shortcuts

        // --- Toolbar Buttons (General) ---
        document.getElementById("toggleToolbarBtn").addEventListener("click", toggleToolbar);
        document.getElementById("resetViewBtn").addEventListener("click", resetView); // Use wrapper for canvas utilities

        const fullscreenBtn = document.getElementById("fullscreenBtn");
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", () => {
                // Fullscreen logic remains here
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen()
                        .then(() => fullscreenBtn.textContent = "Exit Full Screen")
                        .catch(err => console.warn("Fullscreen request failed:", err));
                } else {
                    document.exitFullscreen()
                        .then(() => fullscreenBtn.textContent = "Enter Full Screen")
                        .catch(err => console.warn("Exit Fullscreen failed:", err));
                }
            });
        }

        // --- Measurement Tool Buttons (Delegate Activation) ---
        document.getElementById("linearMeasureBtn").addEventListener("click", () => {
            if (isMarkupToolsetActive) cancelMarkupTool(); // Deactivate markup if active
            measurementTools.activateLinearMeasure(planCanvas); // Activate measurement tool
        });
        document.getElementById("rectMeasureBtn").addEventListener("click", () => {
            if (isMarkupToolsetActive) cancelMarkupTool();
            measurementTools.activateRectangleMeasure(planCanvas);
        });
        document.getElementById("areaMeasureBtn").addEventListener("click", () => {
            if (isMarkupToolsetActive) cancelMarkupTool();
            measurementTools.activateAreaMeasure(planCanvas);
        });
        document.getElementById("clearMeasurementsBtn").addEventListener("click", () => {
             measurementTools.clearAllMeasurements(planCanvas); // Clear measurements
        });

        // --- Measurement Control Buttons (Delegate Actions) ---
         document.getElementById("cancelToolBtn")?.addEventListener("click", () => { // Add null check
             measurementTools.cancelActiveMeasurement(planCanvas);
             planCanvas.style.cursor = "default"; // Reset cursor in main
         });
         document.getElementById("finishMeasurementBtn")?.addEventListener("click", () => { // Add null check
              measurementTools.finalizeCurrentMeasurement();
              planCanvas.style.cursor = "default"; // Reset cursor in main
         });


        // ========================================================================
        // MARKUP TOOLSET MODULE - EVENT LISTENERS (Remain here)
        // ========================================================================
        const toggleMarkupBtn = document.getElementById("toggleMarkupToolsetBtn");
        if (toggleMarkupBtn) {
            toggleMarkupBtn.addEventListener("click", toggleMarkupToolset); // Calls function below
        }
        
        const returnToMeasuringBtn = document.getElementById("returnToMeasuringBtn");
        if (returnToMeasuringBtn) {
            returnToMeasuringBtn.addEventListener("click", returnToMeasuringTools); // Calls function below
        }

        // Tool Selection Buttons
        document.getElementById("markupSelectionBtn")?.addEventListener("click", () => setMarkupTool("selection"));
        document.getElementById("markupPencilBtn")?.addEventListener("click", () => setMarkupTool("pencil"));
        document.getElementById("markupEraserBtn")?.addEventListener("click", () => setMarkupTool("eraser"));
        document.getElementById("markupLineBtn")?.addEventListener("click", () => setMarkupTool("line"));
        document.getElementById("markupArcBtn")?.addEventListener("click", () => setMarkupTool("arc"));
        document.getElementById("markupTextBtn")?.addEventListener("click", () => setMarkupTool("text"));
        document.getElementById("markupRectBtn")?.addEventListener("click", () => setMarkupTool("rectangle"));
        document.getElementById("markupFilledRectBtn")?.addEventListener("click", () => setMarkupTool("filled-rectangle"));
        document.getElementById("markupCircleBtn")?.addEventListener("click", () => setMarkupTool("circle"));
        document.getElementById("markupArrowBtn")?.addEventListener("click", () => setMarkupTool("arrow"));

        // Markup Controls
        document.getElementById("cancelMarkupToolBtn")?.addEventListener("click", cancelMarkupTool);
        document.getElementById("markupClearBtn")?.addEventListener("click", clearMarkup);
        document.getElementById("markupSaveBtn")?.addEventListener("click", saveMarkupImage);
        document.getElementById("markupUndoBtn")?.addEventListener("click", undoMarkupAction);
        document.getElementById("markupRedoBtn")?.addEventListener("click", redoMarkupAction);

        // Color Palette
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                markupColor = e.target.dataset.color;
            });
        });
        
        // Line Width Slider
        const lineWidthSlider = document.getElementById("markupLineWidthSlider");
        if (lineWidthSlider) {
            lineWidthSlider.addEventListener("input", (e) => {
                markupLineWidth = parseInt(e.target.value);
            });
        }
        
        // Text Dialog Buttons
        const textCancelBtn = document.getElementById("markup-text-cancel");
        const textConfirmBtn = document.getElementById("markup-text-confirm");
        if (textCancelBtn) {
            textCancelBtn.addEventListener("click", cancelTextEntry);
        }
        if (textConfirmBtn) {
            textConfirmBtn.addEventListener("click", confirmTextEntry);
        }
    }

    // ========================================================================
    // EVENT HANDLERS (Pointer Events)
    // ========================================================================

    function onMouseDown(e) {
        // Handle markup tools first if active
        if (isMarkupToolsetActive) {
            handleMarkupPointerDown(e); // Separate function for markup logic
            return; // Stop processing if handled by markup
        }

        // Handle measurement tools if active
        if (measurementTools.isMeasurementActive()) {
            measurementTools.handleMeasurementPointerDown(e); // Pass event object directly
            return; // Stop processing if handled by measurement
        }

        // Default drag behavior (pan) if no tool is active
        isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        planCanvas.style.cursor = 'grabbing'; // Indicate panning
    }

    function onMouseMove(e) {
        // Handle markup tools if active
        if (isMarkupToolsetActive) {
            handleMarkupPointerMove(e);
             // Markup move might prevent panning, return if handled
             if(currentMarkupTool === 'pencil' || (currentMarkupTool === 'selection' && isMovingElement) || isShapeDrawing || isLineDrawing || isArcDrawing || (currentMarkupTool === 'arrow' && (arrowState === 'end' || arrowState === 'edit'))) {
                  renderLoop(); // Redraw markup changes
                return;
            }
        }

        // Handle measurement tools if active
        if (measurementTools.isMeasurementActive()) {
            measurementTools.handleMeasurementPointerMove(e);
            // Measurement move should prevent panning
            renderLoop(); // Redraw measurement changes
            return;
        }
        
        // Default drag behavior (pan)
        if (isDragging) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            canvasUtilities.panView(dx, dy); // Use utility for panning
            lastX = e.clientX;
            lastY = e.clientY;
            renderLoop(); // Panning requires redraw
            return;
        }
    }

    function onMouseUp(e) {
         const wasDragging = isDragging; // Remember if we were panning

         // Stop panning regardless of tool state
         isDragging = false;
         planCanvas.style.cursor = measurementTools.isMeasurementActive() ? planCanvas.style.cursor : (isMarkupToolsetActive ? planCanvas.className.includes('markup') ? planCanvas.style.cursor : 'default' : 'default'); // Reset cursor unless a tool dictates otherwise

         // Handle markup tools release if active
         if (isMarkupToolsetActive) {
             handleMarkupPointerUp(e); // Separate function for markup logic
             renderLoop(); // Redraw potential markup finalization
             return; // Stop processing if handled by markup
         }

         // Handle measurement tools release if active
         if (measurementTools.isMeasurementActive()) {
             measurementTools.handleMeasurementPointerUp(e); // Pass event object directly
             renderLoop(); // Redraw potential measurement finalization
             return; // Stop processing if handled by measurement
         }

         // If we were only panning, no specific action needed on mouse up,
         // but a redraw might be needed if the last move caused one.
         // The render loop runs anyway, so it should be fine.
    }

    // --- Touch Event Wrappers ---
    function onTouchStart(e) {
        if (e.touches.length === 1) {
            isPinching = false; // Ensure pinching is reset
            const t = e.touches[0];
            const rect = planCanvas.getBoundingClientRect();
            const touchEvent = {
                offsetX: t.clientX - rect.left,
                offsetY: t.clientY - rect.top,
                clientX: t.clientX,
                clientY: t.clientY,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false,
                detail: 1 // Simulate single click detail
            };
            onMouseDown(touchEvent);
        } else if (e.touches.length === 2) {
            isDragging = false; // Stop panning if starting pinch
             if (measurementTools.isMeasurementActive()) { // Cancel measurement on pinch
                  measurementTools.cancelActiveMeasurement(planCanvas);
             }
             if (isMarkupToolsetActive) { // Cancel markup on pinch
                  cancelMarkupTool();
             }
            isPinching = true;
            pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
            pinchMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
            const canvasState = canvasUtilities.getCanvasState();
            pinchStartZoom = canvasState.zoomFactor;
             e.preventDefault(); // Prevent default pinch zoom/scroll
        }
    }

    function onTouchMove(e) {
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            const newDist = touchDistance(e.touches[0], e.touches[1]);
            const zoomDiff = (newDist / pinchStartDist); // Calculate zoom ratio
            const newZoom = pinchStartZoom * zoomDiff;

            const rect = planCanvas.getBoundingClientRect();
            const midX = pinchMidpoint.x - rect.left;
            const midY = pinchMidpoint.y - rect.top;

            // Use canvas utilities to set zoom
            canvasUtilities.setZoom(newZoom, midX, midY);
            updateAllHandlePositions(); // Update handles after zooming
            renderLoop(); // Redraw after zoom

        } else if (!isPinching && e.touches.length === 1) {
             // Only process move if NOT pinching
            const t = e.touches[0];
            const rect = planCanvas.getBoundingClientRect();
            const touchEvent = {
                clientX: t.clientX,
                clientY: t.clientY,
                offsetX: t.clientX - rect.left,
                offsetY: t.clientY - rect.top,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false
            };
            onMouseMove(touchEvent);
              e.preventDefault(); // Prevent scrolling while dragging
        }
    }

    function onTouchEnd(e) {
         // Use changedTouches to get the touch that was lifted
         if (e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            const rect = planCanvas.getBoundingClientRect();
            const touchEvent = {
                clientX: t.clientX, // Use the ended touch's last position
                clientY: t.clientY,
                offsetX: t.clientX - rect.left,
                offsetY: t.clientY - rect.top,
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false,
                detail: 1 // Simulate single click detail
            };
            onMouseUp(touchEvent);
        }

        // Reset pinching state if less than 2 touches remain
        if (e.touches.length < 2) {
            isPinching = false;
        }
        // isDragging is reset within onMouseUp
    }

    // Handle mouse wheel events for zooming
    function onWheel(e) {
        e.preventDefault();
        const zoomChange = e.deltaY * -0.001;
        applyZoom(zoomChange, e.offsetX, e.offsetY);
    }

    // ========================================================================
    // VIEW & CANVAS CONTROL (Wrappers for Canvas Utilities)
    // ========================================================================

    function resetView() {
        canvasUtilities.resetView(); // Delegate to canvas utilities
        // Clearing measurements is now part of drawing selection or specific button
        // measurementTools.clearAllMeasurements(planCanvas); // Optionally clear on manual reset too?
        updateAllHandlePositions(); // Update handles after resetting view
        renderLoop(); // Trigger redraw
    }

    function applyZoom(delta, cx, cy) {
        canvasUtilities.applyZoom(delta, cx, cy); // Delegate
        updateAllHandlePositions();
        renderLoop();
    }

    function setZoom(z, cx, cy) {
        canvasUtilities.setZoom(z, cx, cy); // Delegate
        updateAllHandlePositions();
        renderLoop();
    }

     // Wrapper for resize event
     function onResize() {
         // canvasUtilities handles the actual resize and view adjustment via its own listener now.
         // We might only need this if main.js needs to react directly to resize *after* canvas is resized.
         // For now, we only need to update handles.
         updateAllHandlePositions();
         renderLoop(); // Redraw needed after resize
    }

    // ========================================================================
    // UI & TOOLBAR
    // ========================================================================
    function toggleToolbar() {
        if (menuTutorialOverlay.style.display === "block") {
            menuTutorialOverlay.style.display = "none";
        }
        // Allow toggling only if no measurement tool is active
        if (measurementTools.isMeasurementActive()) return;
        // Also prevent toggle if a markup tool is active? (Optional, depends on desired UX)
        // if (isMarkupToolsetActive && currentMarkupTool) return;

        isToolbarOpen = !isToolbarOpen;
        toolbar.classList.toggle("collapsed", !isToolbarOpen);
    }

    // ========================================================================
    // TOUCH HELPERS
    // ========================================================================
    function touchDistance(t1, t2) {
        return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    function touchMidpoint(t1, t2) {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }

    /*************************************************************************
     MARKUP TOOLSET MODULE - FUNCTIONS (Keep in main.js for now)
    *************************************************************************/

    // --- Markup Tool Activation & Deactivation ---

    function toggleMarkupToolset() {
        // Cancel measurement tool if active
        if (measurementTools.isMeasurementActive()) {
            measurementTools.cancelActiveMeasurement(planCanvas);
            planCanvas.style.cursor = 'default';
        }

        isMarkupToolsetActive = true;
        // Reset and show markup UI elements (logic remains here)
        // ... (Keep the existing logic for showing/hiding UI sections) ...
        const colorPalette = document.querySelector('.color-palette');
        if (colorPalette) {
            colorPalette.style.display = 'flex';
            colorPalette.style.flexWrap = 'wrap';
            colorPalette.querySelectorAll('.color-swatch').forEach(swatch => {
                const bgColor = swatch.style.backgroundColor;
                const isActive = swatch.classList.contains('active');
                 const border = swatch.style.border;
                swatch.removeAttribute('style');
                swatch.style.backgroundColor = bgColor;
                if (border && bgColor === 'rgb(255, 255, 255)') {
                    swatch.style.border = '1px solid #CCCCCC';
                }
            });
        }
        document.querySelectorAll("#markup-toolset .tool-button").forEach(btn => {
            if (btn.id !== 'cancelMarkupToolBtn') {
                btn.style.opacity = '';
                btn.style.backgroundColor = '';
            }
        });
        document.getElementById("markup-toolset").style.display = "block";
        const slider = document.getElementById("markupLineWidthSlider");
         if (slider) markupLineWidth = parseInt(slider.value); // Ensure slider exists
        
        const drawingButtonContainer = document.querySelector(".drawing-button-container");
         if (drawingButtonContainer) drawingButtonContainer.style.display = "none";
        
        document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
            if (!header.closest("#markup-toolset")) {
                header.style.display = "none";
                let nextElem = header.nextElementSibling;
                while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                     if (nextElem.id !== "markup-toolset") nextElem.style.display = "none";
                    nextElem = nextElem.nextElementSibling;
                }
            }
        });
        document.getElementById("toggleMarkupToolsetBtn").style.display = "none";
        cancelMarkupTool(); // Reset tool selection
        planCanvas.className = ""; // Reset cursor class
        currentMarkupTool = null;
        document.getElementById('cancelMarkupToolBtn').style.display = 'none';
         updateUndoRedoButtons(); // Ensure correct initial state
    }

    function returnToMeasuringTools() {
        cancelMarkupTool(); // Cancel active markup tool
        isMarkupToolsetActive = false;
        
        // Hide/Show UI elements (logic remains here)
        // ... (Keep the existing logic for showing/hiding UI sections) ...
        document.getElementById("markup-toolset").style.display = "none";
        const drawingButtonContainer = document.querySelector(".drawing-button-container");
         if (drawingButtonContainer) drawingButtonContainer.style.display = "block";
        
        document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
            header.style.display = "block";
            if (!header.closest("#markup-toolset")) {
                let nextElem = header.nextElementSibling;
                while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                     if (nextElem.id !== "markup-toolset") nextElem.style.display = "block";
                    nextElem = nextElem.nextElementSibling;
                }
            }
        });
        document.getElementById("toggleMarkupToolsetBtn").style.display = "block";
        planCanvas.className = ""; // Reset cursor class
        currentMarkupTool = null; // Ensure tool is null
    }

    function setMarkupTool(tool) {
         // Cancel measurement tool if active
         if (measurementTools.isMeasurementActive()) {
            measurementTools.cancelActiveMeasurement(planCanvas);
         }

        if (tool === null) {
            cancelMarkupTool();
            return;
        }
        
        document.getElementById('cancelMarkupToolBtn').style.display = 'block';
        document.getElementById('cancelMarkupToolBtn').style.backgroundColor = '#d9534f';
        
        currentMarkupTool = tool;
        
        // Reset specific markup states (logic remains here)
        // ... (Keep state resets: currentMarkupPath, isShapeDrawing, etc.) ...
        currentMarkupPath = null;
        isShapeDrawing = false;
        shapeStartPoint = null;
        currentShape = null;
        isTextPlacing = false;
        textPlacementPoint = null;
         isLineDrawing = false;
         currentLine = null;
         isArcDrawing = false; // Added reset
         currentArc = null;   // Added reset

        if (currentMarkupTool !== 'arrow') {
            clearArrowControls();
            arrowState = 'idle';
        }
        if (tool !== 'selection') {
            clearSelection();
        }
        
        // Update cursor and show instructions (logic remains here)
        // ... (Keep cursor updates and showMarkupInstructions calls) ...
         planCanvas.className = ""; // Clear previous cursors
         let instructionKey = tool;
         switch(tool) {
             case 'selection': planCanvas.classList.add('markup-selection'); break;
             case 'pencil': planCanvas.classList.add('markup-pencil'); break;
             case 'eraser': planCanvas.classList.add('markup-eraser'); break;
             case 'arrow': planCanvas.classList.add('markup-arrow-start'); break;
             case 'text': planCanvas.classList.add('markup-text'); break;
             case 'line': planCanvas.classList.add('markup-line'); break;
             case 'rectangle': planCanvas.classList.add('markup-rectangle'); break;
             case 'filled-rectangle': planCanvas.classList.add('markup-filled-rectangle'); instructionKey = 'rectangle'; break; // Reuse instruction
             case 'circle': planCanvas.classList.add('markup-circle'); break;
             case 'arc': planCanvas.classList.add('markup-arc'); break;
             default: planCanvas.style.cursor = 'default'; break; // Fallback
         }
         showMarkupInstructions(instructionKey); // Use key for instructions


        updateToolButtonStyles(tool);
    }

    function cancelMarkupTool() {
        currentMarkupTool = null;
        planCanvas.className = ""; // Reset cursor fully
        planCanvas.style.cursor = 'default'; // Explicitly set default

        document.getElementById('cancelMarkupToolBtn').style.display = 'none';

        // Reset all markup-specific states (logic remains here)
        // ... (Keep state resets) ...
         currentMarkupPath = null;
         clearSelection();
         clearArrowControls();
         arrowState = 'idle';
         isShapeDrawing = false;
         shapeStartPoint = null;
         currentShape = null;
        isTextPlacing = false;
        textPlacementPoint = null;
        editingTextElement = null;
         isLineDrawing = false;
         currentLine = null;
         isArcDrawing = false;
         currentArc = null;

        // Hide instructions
        const instructionsDiv = document.getElementById('markup-instructions');
        if (instructionsDiv) {
            instructionsDiv.style.display = 'none';
        }
         updateToolButtonStyles(null); // Clear active button style
         renderLoop(); // Redraw to remove temporary elements
    }

    // --- Markup Drawing & Interaction Logic (Keep these functions in main.js) ---
    // handleMarkupPointerDown, handleMarkupPointerMove, handleMarkupPointerUp (New functions to contain the markup logic from original handlers)
    // drawAllMarkupPaths (Pass canvasState)
    // drawSketchyPath, drawArrow, drawSketchyText, drawSketchyRectangle, drawSketchyCircle, drawSketchyLine, drawArc, drawSketchySegment, drawSketchyArrowLine
    // pseudoRandom
    // calculateCurveEndDirection, sampleBezierPoint, sampleBezierCurve
    // clearMarkup, saveMarkupImage
    // showTextDialog, cancelTextEntry, confirmTextEntry, editTextElement
    // clearArrowControls, createControlPoint, createHandleLine, updateControlPointPositions, showArrowControls
    // findElementAt, findTextElementAt, distanceToLineSegment, distanceToQuadraticCurve
    // selectElement, clearSelection, createSelectionHandles, clearSelectionHandles, createHandle, updateAllHandlePositions
    // moveElement, deleteSelectedElement
    // copySelectedElement, pasteElement, showCopyFeedback
    // detectAndEraseElements
    // saveMarkupState, undoMarkupAction, redoMarkupAction, updateUndoRedoButtons
    // showMarkupInstructions
    // updateToolButtonStyles
    // onKeyDown (keep for markup shortcuts)

    // --- Placeholder for separated markup handlers ---
    function handleMarkupPointerDown(e) {
        const pos = toPlanCoords(e.offsetX, e.offsetY);

        if (currentMarkupTool === 'selection') {
            if (!e.shiftKey) clearSelection();
            const element = findElementAt(pos);
            if (element) {
                selectElement(element);
                isMovingElement = true;
                moveStartPosition = pos;
                // Calculate move offset
                if (element.tool === 'pencil' && element.points.length > 0) {
                    moveOffset = { x: element.points[0].x - pos.x, y: element.points[0].y - pos.y };
                } else if (element.tool === 'text') {
                    moveOffset = { x: element.position.x - pos.x, y: element.position.y - pos.y };
                } else { // Default for shapes, arrows, etc.
                    moveOffset = { x: 0, y: 0}; // Adjust if needed based on shape origin
                }
            } else {
                if (!e.shiftKey) clearSelection(); // Deselect if clicking empty space without shift
                isMovingElement = false; // Ensure moving is false if nothing is selected
            }
            if (arrowState !== 'idle') {
                clearArrowControls();
                arrowState = 'idle';
            }
            return;
        }
        
        // If any other tool is active, clear selection
        if (selectedElement) clearSelection();

        // Specific tool actions...
         if (currentMarkupTool === 'pencil') {
            currentMarkupPath = { tool: 'pencil', color: markupColor, lineWidth: markupLineWidth, points: [pos] };
            isDragging = true; // Indicate drawing
        } else if (currentMarkupTool === 'eraser') {
            detectAndEraseElements(pos, markupLineWidth / 2);
            isDragging = true; // Indicate erasing
        } else if (currentMarkupTool === 'line') {
             if (!isLineDrawing) {
                 isLineDrawing = true;
                 currentLine = { tool: 'line', color: markupColor, lineWidth: markupLineWidth, startPoint: pos, endPoint: pos, seed: Math.floor(Math.random() * 10000) };
                 isDragging = true; // Indicate drawing line
             }
        } else if (currentMarkupTool === 'arc') {
             handlePointerDownArc(pos); // Uses its own state logic
        } else if (currentMarkupTool === 'arrow') {
             if (arrowState === 'idle') {
                currentArrow = { tool: 'arrow', color: markupColor, lineWidth: markupLineWidth, startPoint: pos, endPoint: pos, control1: pos, control2: pos };
                arrowState = 'end';
                planCanvas.classList.remove('markup-arrow-start');
                planCanvas.classList.add('markup-arrow-end');
                isDragging = true; // Indicate drawing arrow end
             } else if (arrowState === 'edit') {
                 // Check for control point click
                 const canvasState = canvasUtilities.getCanvasState();
                 for (const pointInfo of controlPoints) { // Iterate through DOM elements stored
                     const pointElement = pointInfo.element;
                     const screenX = parseFloat(pointElement.style.left);
                     const screenY = parseFloat(pointElement.style.top);
                     const cursorScreenX = e.clientX; // Use clientX for screen comparison
                     const cursorScreenY = e.clientY;
                     const dx = screenX - cursorScreenX;
                     const dy = screenY - cursorScreenY;
                     if (Math.sqrt(dx * dx + dy * dy) < 20) { // Screen pixel hit radius
                         activeControlPoint = pointInfo; // Store the *object* containing the element
                         isDragging = true; // Indicate dragging control point
                         return;
                     }
                 }
                 // If no control point hit, maybe start a new arrow? Or deselect?
                 clearArrowControls();
                 arrowState = 'idle';
                 currentMarkupTool = null; // Deselect arrow tool? Or allow starting new? For now deselect.
                 planCanvas.className = "";
                 planCanvas.style.cursor = 'default';
             }
        } else if (currentMarkupTool === 'text') {
            const existingTextElement = findTextElementAt(pos);
             if (existingTextElement) {
                 editTextElement(existingTextElement); // Opens dialog
             } else {
                 isTextPlacing = true;
                 textPlacementPoint = pos;
        editingTextElement = null;
                 showTextDialog(e.clientX, e.clientY); // Use screen coords for dialog
             }
        } else if (currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') {
             if (!isShapeDrawing) {
                 isShapeDrawing = true;
                 shapeStartPoint = pos; // Store start point separately
                 currentShape = { tool: 'rectangle', color: markupColor, lineWidth: markupLineWidth, startPoint: pos, endPoint: pos, filled: currentMarkupTool === 'filled-rectangle', seed: { /* seeds */ }}; // Init seed obj
                 isDragging = true; // Indicate drawing shape
             }
        } else if (currentMarkupTool === 'circle') {
             if (!isShapeDrawing) {
                 isShapeDrawing = true;
                 shapeStartPoint = pos; // Store center point
                 currentShape = { tool: 'circle', color: markupColor, lineWidth: markupLineWidth, centerPoint: pos, radius: 0, seed: Math.floor(Math.random() * 10000) };
                 isDragging = true; // Indicate drawing shape
             }
        }
    }

    function handleMarkupPointerMove(e) {
         if (!isDragging && !(currentMarkupTool === 'arc' && isArcDrawing)) return; // Only proceed if actively dragging/drawing for most tools

        const pos = toPlanCoords(e.offsetX, e.offsetY);
        const canvasState = canvasUtilities.getCanvasState(); // Needed for zoomFactor in some cases

        if (currentMarkupTool === 'selection' && isMovingElement && selectedElement) {
            moveElement(selectedElement, pos);
        } else if (currentMarkupTool === 'pencil' && currentMarkupPath) {
            currentMarkupPath.points.push(pos);
        } else if (currentMarkupTool === 'eraser') {
            detectAndEraseElements(pos, markupLineWidth / 2 / canvasState.zoomFactor); // Scale eraser radius
        } else if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
            currentLine.endPoint = pos;
        } else if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
            currentArrow.endPoint = pos;
            // Recalculate control points for S-curve preview
            const dx = currentArrow.endPoint.x - currentArrow.startPoint.x;
            const dy = currentArrow.endPoint.y - currentArrow.startPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const perpX = -Math.sin(angle);
            const perpY = Math.cos(angle);
            const controlOffset = distance * 0.25;
            currentArrow.control1 = { x: currentArrow.startPoint.x + dx * 0.33 + perpX * controlOffset, y: currentArrow.startPoint.y + dy * 0.33 + perpY * controlOffset };
            currentArrow.control2 = { x: currentArrow.startPoint.x + dx * 0.66 - perpX * controlOffset, y: currentArrow.startPoint.y + dy * 0.66 - perpY * controlOffset };
        } else if (currentMarkupTool === 'arrow' && arrowState === 'edit' && activeControlPoint) {
             // Move the DOM element visually during drag
             activeControlPoint.element.style.left = `${e.clientX}px`;
             activeControlPoint.element.style.top = `${e.clientY}px`;
             // Actual arrow data update happens on mouse up
        } else if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
            currentShape.endPoint = pos;
        } else if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
             const dx = pos.x - currentShape.centerPoint.x;
             const dy = pos.y - currentShape.centerPoint.y;
             currentShape.radius = Math.sqrt(dx * dx + dy * dy);
        } else if (currentMarkupTool === 'arc' && isArcDrawing && currentArc) {
             if (!currentArc.controlPoint) currentArc.hoverControl = pos;
             else if (!currentArc.endPoint) currentArc.hoverEnd = pos;
        }
    }

    function handleMarkupPointerUp(e) {
        isDragging = false; // Stop drawing/dragging state for most tools

        const pos = toPlanCoords(e.offsetX, e.offsetY); // Final position
        const canvasState = canvasUtilities.getCanvasState();

        if (currentMarkupTool === 'selection' && isMovingElement) {
            isMovingElement = false;
            moveStartPosition = null;
            if (selectedElement) saveMarkupState(); // Save state after move
        } else if (currentMarkupTool === 'pencil' && currentMarkupPath) {
            if (currentMarkupPath.points.length > 1) {
                markupPaths.push(currentMarkupPath);
                saveMarkupState();
            }
            currentMarkupPath = null;
        } else if (currentMarkupTool === 'eraser') {
             // Erasure happens on move, maybe save state here if needed after drag
             // saveMarkupState(); // Uncomment if eraser action should be undoable as one stroke
             currentMarkupPath = null; // Reset path used for eraser tracking if any
        } else if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
            currentLine.endPoint = pos; // Set final point
            const dx = currentLine.endPoint.x - currentLine.startPoint.x;
            const dy = currentLine.endPoint.y - currentLine.startPoint.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) { // Minimum length
                markupPaths.push(currentLine);
                saveMarkupState();
            }
            isLineDrawing = false;
            currentLine = null;
        } else if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
            currentArrow.endPoint = pos; // Set final point
            // Finalize control points
             const dx = currentArrow.endPoint.x - currentArrow.startPoint.x;
             const dy = currentArrow.endPoint.y - currentArrow.startPoint.y;
             const distance = Math.sqrt(dx*dx+dy*dy);
             if (distance > 5) { // Min length
                 const angle = Math.atan2(dy, dx);
                 const perpX = -Math.sin(angle);
                 const perpY = Math.cos(angle);
                 const controlOffset = distance * 0.25;
                 currentArrow.control1 = { x: currentArrow.startPoint.x + dx*0.33 + perpX*controlOffset, y: currentArrow.startPoint.y + dy*0.33 + perpY*controlOffset };
                 currentArrow.control2 = { x: currentArrow.startPoint.x + dx*0.66 - perpX*controlOffset, y: currentArrow.startPoint.y + dy*0.66 - perpY*controlOffset };

                 markupPaths.push(currentArrow);
                 saveMarkupState();
                 showArrowControls(currentArrow); // Switch to edit mode
             } else {
                 // Arrow too short, cancel it
        currentArrow = null;
                 arrowState = 'idle';
                 planCanvas.classList.remove('markup-arrow-end');
                 planCanvas.classList.add('markup-arrow-start');
             }
        } else if (currentMarkupTool === 'arrow' && arrowState === 'edit' && activeControlPoint) {
            // Finalize control point move - update underlying arrow data
            const finalPlanPos = toPlanCoords(e.clientX, e.clientY); // Convert final screen pos

            if (activeControlPoint.type === 'start') currentArrow.startPoint = finalPlanPos;
            else if (activeControlPoint.type === 'end') currentArrow.endPoint = finalPlanPos;
            else if (activeControlPoint.type === 'control1') currentArrow.control1 = finalPlanPos;
            else if (activeControlPoint.type === 'control2') currentArrow.control2 = finalPlanPos;

            activeControlPoint = null; // Release the dragged point
            saveMarkupState(); // Save state after edit
            updateControlPointPositions(); // Update visuals based on new data
        } else if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
            currentShape.endPoint = pos; // Set final point
            // Ensure start is top-left and end is bottom-right for consistency
            const startX = Math.min(currentShape.startPoint.x, currentShape.endPoint.x);
            const startY = Math.min(currentShape.startPoint.y, currentShape.endPoint.y);
            const endX = Math.max(currentShape.startPoint.x, currentShape.endPoint.x);
            const endY = Math.max(currentShape.startPoint.y, currentShape.endPoint.y);
            currentShape.startPoint = {x: startX, y: startY};
            currentShape.endPoint = {x: endX, y: endY};

            if (Math.abs(endX - startX) > 5 && Math.abs(endY - startY) > 5) { // Min size
                markupPaths.push(currentShape);
                saveMarkupState();
            }
            isShapeDrawing = false;
            currentShape = null;
            shapeStartPoint = null;
        } else if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
             const dx = pos.x - currentShape.centerPoint.x;
             const dy = pos.y - currentShape.centerPoint.y;
             currentShape.radius = Math.sqrt(dx * dx + dy * dy); // Set final radius
            if (currentShape.radius > 5) { // Min size
                markupPaths.push(currentShape);
                saveMarkupState();
            }
            isShapeDrawing = false;
            currentShape = null;
            shapeStartPoint = null;
        }
         // Arc logic is handled in handlePointerDownArc on the third click
    }

    // --- Markup Drawing Primitives (Keep all drawSketchy... functions here) ---
    // drawAllMarkupPaths(context, canvasState) - Modify to accept canvasState
    function drawAllMarkupPaths(context, canvasState) {
        // Go through each item in markupPaths and draw it
        markupPaths.forEach(path => {
            // Pass context and canvasState if needed by individual draw functions
            const isSelected = path === selectedElement;
            if (!isSelected) {
                 drawMarkupElement(context, path, canvasState);
             }
        });

         // Draw selected element highlight and element itself
        if (selectedElement) {
             drawSelectionHighlight(context, selectedElement, canvasState);
             drawMarkupElement(context, selectedElement, canvasState); // Draw element on top of highlight
         }

        // Draw current temporary path/shape/line/arc
        if (currentMarkupPath) drawMarkupElement(context, currentMarkupPath, canvasState);
        if (isShapeDrawing && currentShape) drawMarkupElement(context, currentShape, canvasState);
        if (isLineDrawing && currentLine) drawMarkupElement(context, currentLine, canvasState);
        if (isArcDrawing && currentArc) {
             // Draw arc in progress, potentially using hover points
             drawArcInProgress(context, currentArc, canvasState);
        }
    }

    // Helper to call the correct drawing function based on tool type
    function drawMarkupElement(context, element, canvasState) {
        // Need offsetX, offsetY, zoomFactor from canvasState for transforms
        const { offsetX, offsetY, zoomFactor } = canvasState;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            
        switch(element.tool) {
            case 'pencil': drawSketchyPathInternal(context, element); break;
            case 'rectangle':
            case 'filled-rectangle': drawSketchyRectangleInternal(context, element); break;
            case 'circle': drawSketchyCircleInternal(context, element); break;
            case 'line': drawSketchyLineInternal(context, element); break;
            case 'arrow': drawArrowInternal(context, element); break;
            case 'arc': drawArcInternal(context, element); break;
            case 'text': drawSketchyTextInternal(context, element); break;
            case 'polygon': drawSketchyPolygonInternal(context, element); break;
            // case 'eraser': // Eraser paths aren't typically drawn
        }

        context.restore();
    }

    // Draw highlight for selected element
     function drawSelectionHighlight(context, element, canvasState) {
         const { offsetX, offsetY, zoomFactor } = canvasState;
         context.save();
         context.translate(offsetX, offsetY);
         context.scale(zoomFactor, zoomFactor);
         context.lineWidth = (element.lineWidth || 2) + 6 / zoomFactor; // Make highlight width scale less aggressively
         context.strokeStyle = 'rgba(255, 255, 0, 0.6)'; // Yellowish highlight
                context.lineCap = 'round';
                context.lineJoin = 'round';
         context.fillStyle = 'rgba(255, 255, 0, 0.1)'; // Slight fill for shapes
                
         switch (element.tool) {
             case 'pencil':
                 if (element.points.length > 1) {
                context.beginPath();
                     context.moveTo(element.points[0].x, element.points[0].y);
                     for (let i = 1; i < element.points.length; i++) {
                         context.lineTo(element.points[i].x, element.points[i].y);
                }
                context.stroke();
                 }
                 break;
             case 'rectangle':
             case 'filled-rectangle':
                 const x = element.startPoint.x;
                 const y = element.startPoint.y;
                 const width = element.endPoint.x - x;
                 const height = element.endPoint.y - y;
                context.strokeRect(x, y, width, height);
                 context.fillRect(x,y,width, height); // Add fill highlight
                 break;
             case 'circle':
                let centerX, centerY, radius;
                 if (element.centerPoint && element.radius !== undefined) {
                     centerX = element.centerPoint.x; centerY = element.centerPoint.y; radius = element.radius;
                 } else { /* old format calc */
                     centerX = (element.startPoint.x + element.endPoint.x) / 2;
                     centerY = (element.startPoint.y + element.endPoint.y) / 2;
                     radius = Math.hypot(element.endPoint.x - element.startPoint.x, element.endPoint.y - element.startPoint.y) / 2;
                 }
                  if (radius > 0) {
                context.beginPath();
                context.arc(centerX, centerY, radius, 0, Math.PI * 2);
                context.stroke();
                      context.fill(); // Add fill highlight
                  }
                 break;
              case 'line':
                context.beginPath();
                  context.moveTo(element.startPoint.x, element.startPoint.y);
                  context.lineTo(element.endPoint.x, element.endPoint.y);
                context.stroke();
                  break;
              case 'arrow':
                context.beginPath();
                  context.moveTo(element.startPoint.x, element.startPoint.y);
                  context.bezierCurveTo(element.control1.x, element.control1.y, element.control2.x, element.control2.y, element.endPoint.x, element.endPoint.y);
                  context.stroke();
                  break;
              case 'arc':
                   if (element.startPoint && element.controlPoint && element.endPoint) {
                       context.beginPath();
                       context.moveTo(element.startPoint.x, element.startPoint.y);
                       context.quadraticCurveTo(element.controlPoint.x, element.controlPoint.y, element.endPoint.x, element.endPoint.y);
                context.stroke();
            }
                   break;
              case 'text':
                  // Approximate bounding box for highlight
                  const fontSize = (element.fontSize || 24); // Use font size
                  const approxCharWidth = fontSize * 0.6; // Rough estimate
                  const textWidth = element.text.length * approxCharWidth;
                  const textHeight = fontSize * 1.2; // Include ascenders/descenders
                  context.fillStyle = 'rgba(255, 255, 100, 0.2)';
                  context.fillRect(element.position.x - 5 / zoomFactor, element.position.y - textHeight * 0.1, textWidth + 10 / zoomFactor, textHeight);
                  break;
              case 'polygon':
                   if(element.points.length > 2) {
                        context.beginPath();
                        context.moveTo(element.points[0].x, element.points[0].y);
                        for(let i = 1; i < element.points.length; i++) {
                             context.lineTo(element.points[i].x, element.points[i].y);
                        }
                        context.closePath();
                        context.stroke();
                        context.fill(); // Add fill highlight
                   }
                   break;

         }
         context.restore();
     }

    // Rename internal drawing functions to avoid name clashes if helper needed globally
    function drawSketchyPathInternal(context, path) { /* ... Keep original logic ... */
         context.lineWidth = path.lineWidth / context.getTransform().a; // Correct line width for zoom
        context.strokeStyle = path.color;
         context.lineCap = 'round'; context.lineJoin = 'round';
         if (!path.seed) path.seed = Math.floor(Math.random() * 10000);
         if (path.points.length < 2) return;
         context.beginPath(); context.moveTo(path.points[0].x, path.points[0].y);
         let prevX = path.points[0].x, prevY = path.points[0].y;
         const zoomFactor = context.getTransform().a; // Get current zoom for scaling jitter
        for (let i = 1; i < path.points.length; i++) {
            const point = path.points[i];
             const jitterAmount = path.lineWidth * 0.1 / zoomFactor; // Scale jitter
            const jitterX = jitterAmount * (pseudoRandom(path.seed + i * 7) - 0.5);
            const jitterY = jitterAmount * (pseudoRandom(path.seed + i * 13) - 0.5);
            if (i < path.points.length - 1) {
                const mid1X = (prevX + point.x) / 2 + jitterX;
                const mid1Y = (prevY + point.y) / 2 + jitterY;
                 // Pressure variation (less critical now with zoom correction)
                 // if (i % 5 === 0) {
                 //     const pressureFactor = 1 + pressureVariation * (pseudoRandom(path.seed + i * 19) - 0.5);
                 //     context.lineWidth = path.lineWidth * pressureFactor / zoomFactor;
                 // } else {
                 //     context.lineWidth = path.lineWidth / zoomFactor;
                 // }
                 context.quadraticCurveTo(mid1X, mid1Y, point.x, point.y);
            } else {
                context.lineTo(point.x + jitterX, point.y + jitterY);
            }
             prevX = point.x; prevY = point.y;
        }
        context.stroke();
         // Reinforcement (optional, less noticeable with zoom correction)
         // ... (keep if desired) ...
    }
    function drawArrowInternal(context, arrow) { /* ... Keep original logic ... */
        context.strokeStyle = arrow.color;
         context.lineWidth = arrow.lineWidth / context.getTransform().a; // Correct line width
         context.lineCap = 'round'; context.lineJoin = 'round';
         if (!arrow.seed) arrow.seed = { shaft: Math.random()*10000, head1: Math.random()*10000, head2: Math.random()*10000 };
         const steps = 30; const points = [];
        for (let t = 0; t <= 1; t += 1/steps) {
             const point = sampleBezierPoint(arrow.startPoint, arrow.control1, arrow.control2, arrow.endPoint, t);
             const jitter = context.lineWidth * 0.15 * (pseudoRandom(arrow.seed.shaft + t * 100) - 0.5); // Use corrected line width
             point.x += jitter; point.y += jitter;
            points.push(point);
        }
         context.beginPath(); context.moveTo(points[0].x, points[0].y);
         for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
            context.stroke();
         // Second stroke
         context.globalAlpha = 0.7; context.lineWidth *= 0.7;
         context.beginPath(); context.moveTo(points[0].x + context.lineWidth * 0.1, points[0].y + context.lineWidth * 0.1);
         for (let i = 1; i < points.length; i++) {
             const offset = context.lineWidth * 0.1 * (pseudoRandom(arrow.seed.shaft + i) - 0.3);
             context.lineTo(points[i].x + offset, points[i].y + offset);
            }
            context.stroke();
         // Arrow head
         context.globalAlpha = 1.0; context.lineWidth = arrow.lineWidth / context.getTransform().a; // Reset width
         const endDir = calculateCurveEndDirection(arrow.control2, arrow.endPoint);
        const angle = Math.atan2(endDir.y, endDir.x);
         const arrowSize = context.lineWidth * 8; // Use corrected width
         const angleVar1 = (pseudoRandom(arrow.seed.head1) * 0.2) - 0.1;
         const angleVar2 = (pseudoRandom(arrow.seed.head2) * 0.2) - 0.1;
         drawSketchyArrowLineInternal(context, arrow.endPoint.x, arrow.endPoint.y, arrow.endPoint.x - arrowSize * Math.cos(angle - Math.PI/6 + angleVar1), arrow.endPoint.y - arrowSize * Math.sin(angle - Math.PI/6 + angleVar1), context.lineWidth, arrow.color, arrow.seed.head1);
         drawSketchyArrowLineInternal(context, arrow.endPoint.x, arrow.endPoint.y, arrow.endPoint.x - arrowSize * Math.cos(angle + Math.PI/6 + angleVar2), arrow.endPoint.y - arrowSize * Math.sin(angle + Math.PI/6 + angleVar2), context.lineWidth, arrow.color, arrow.seed.head2);
    }
    function drawSketchyTextInternal(context, textObj) { /* ... Keep original logic ... */
         if (!textObj.text || !textObj.position) return;
        context.fillStyle = textObj.color || markupColor;
         const fontSize = (textObj.fontSize || 24) / context.getTransform().a; // Scale font size
        context.font = `${fontSize}px 'Caveat', 'Comic Sans MS', cursive, sans-serif`;
        context.textBaseline = 'top';
        context.fillText(textObj.text, textObj.position.x, textObj.position.y);
         // No need to check font here, check happens once at init
    }
    function drawSketchyRectangleInternal(context, rect) { /* ... Keep original logic ... */
        context.strokeStyle = rect.color;
         context.lineWidth = rect.lineWidth / context.getTransform().a;
         const x = rect.startPoint.x; const y = rect.startPoint.y;
         const width = rect.endPoint.x - x; const height = rect.endPoint.y - y;
         if (rect.filled) { context.fillStyle = rect.color + '33'; context.fillRect(x, y, width, height); }
         if (!rect.seed) rect.seed = { top: Math.random()*10000, right: Math.random()*10000, bottom: Math.random()*10000, left: Math.random()*10000 };
         const overshootAmount = context.lineWidth * 1.2;
         drawSketchySegmentInternal(context, x - overshootAmount * 0.2, y, x + width + overshootAmount * 0.2, y, context.lineWidth, rect.color, rect.seed.top);
         drawSketchySegmentInternal(context, x + width, y - overshootAmount * 0.2, x + width, y + height + overshootAmount * 0.2, context.lineWidth, rect.color, rect.seed.right);
         drawSketchySegmentInternal(context, x + width + overshootAmount * 0.2, y + height, x - overshootAmount * 0.2, y + height, context.lineWidth, rect.color, rect.seed.bottom);
         drawSketchySegmentInternal(context, x, y + height + overshootAmount * 0.2, x, y - overshootAmount * 0.2, context.lineWidth, rect.color, rect.seed.left);
         // Reinforcement corners
         context.globalAlpha = 0.9; const cornerLength = context.lineWidth * 2.5; context.lineWidth *= 0.7;
         // TL
         context.beginPath(); context.moveTo(x, y); context.lineTo(x + cornerLength * pseudoRandom(rect.seed.top + 1), y); context.stroke();
         context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + cornerLength * pseudoRandom(rect.seed.left + 1)); context.stroke();
         // TR
         context.beginPath(); context.moveTo(x + width, y); context.lineTo(x + width - cornerLength * pseudoRandom(rect.seed.top + 2), y); context.stroke();
         context.beginPath(); context.moveTo(x + width, y); context.lineTo(x + width, y + cornerLength * pseudoRandom(rect.seed.right + 2)); context.stroke();
         // BR
         context.beginPath(); context.moveTo(x + width, y + height); context.lineTo(x + width - cornerLength * pseudoRandom(rect.seed.bottom + 3), y + height); context.stroke();
         context.beginPath(); context.moveTo(x + width, y + height); context.lineTo(x + width, y + height - cornerLength * pseudoRandom(rect.seed.right + 3)); context.stroke();
         // BL
         context.beginPath(); context.moveTo(x, y + height); context.lineTo(x + cornerLength * pseudoRandom(rect.seed.bottom + 4), y + height); context.stroke();
         context.beginPath(); context.moveTo(x, y + height); context.lineTo(x, y + height - cornerLength * pseudoRandom(rect.seed.left + 4)); context.stroke();
    }
     function drawSketchyCircleInternal(context, circle) { /* ... Keep original logic ... */
        context.strokeStyle = circle.color;
         context.lineWidth = circle.lineWidth / context.getTransform().a;
        let centerX, centerY, radius;
         if (circle.centerPoint && circle.radius !== undefined) { centerX = circle.centerPoint.x; centerY = circle.centerPoint.y; radius = circle.radius; }
         else { centerX = (circle.startPoint.x + circle.endPoint.x)/2; centerY = (circle.startPoint.y + circle.endPoint.y)/2; radius = Math.hypot(circle.endPoint.x-circle.startPoint.x, circle.endPoint.y-circle.startPoint.y)/2;}
         if (!circle.seed) circle.seed = Math.floor(Math.random() * 10000);
        const segments = Math.max(24, Math.min(48, Math.floor(radius * 2)));
        context.beginPath();
        for (let i = 0; i <= segments; i++) {
            const angle = (Math.PI * 2 * i) / segments;
             const noise = pseudoRandom(circle.seed + i) * 0.3 - 0.15;
            const radiusNoise = 1 + (noise * 0.08);
            const x = centerX + radius * radiusNoise * Math.cos(angle);
            const y = centerY + radius * radiusNoise * Math.sin(angle);
             if (i === 0) context.moveTo(x, y);
             else {
                 const prevAngle = (Math.PI * 2 * (i-1)) / segments; const midAngle = (prevAngle + angle) / 2;
                 const controlNoise = pseudoRandom(circle.seed + i + 100) * 0.15 - 0.075;
                 const ctrlX = centerX + (radius + context.lineWidth * (controlNoise + 0.2)) * Math.cos(midAngle); // Use corrected line width
                 const ctrlY = centerY + (radius + context.lineWidth * (controlNoise + 0.2)) * Math.sin(midAngle);
                context.quadraticCurveTo(ctrlX, ctrlY, x, y);
            }
        }
        context.stroke();
         // Reinforcement
         context.globalAlpha = 0.8; context.lineWidth *= 0.6;
        for (let i = 0; i < 3; i++) {
            const startSegment = Math.floor(pseudoRandom(circle.seed + i * 50) * segments);
            const arcLength = Math.floor(segments * (0.25 + pseudoRandom(circle.seed + i * 100) * 0.25));
            context.beginPath();
            for (let j = 0; j <= arcLength; j++) {
                const segmentIndex = (startSegment + j) % segments;
                const angle = (Math.PI * 2 * segmentIndex) / segments;
                 const noise = pseudoRandom(circle.seed + segmentIndex + i * 200) * 0.2 - 0.1;
                const reinforceRadius = 0.98 + (noise * 0.04);
                const x = centerX + radius * reinforceRadius * Math.cos(angle);
                const y = centerY + radius * reinforceRadius * Math.sin(angle);
                 if (j === 0) context.moveTo(x, y); else context.lineTo(x, y);
             }
             context.stroke();
         }
     }
    function drawSketchyLineInternal(context, line) { /* ... Keep original logic ... */
         if (!line.startPoint || !line.endPoint) return;
         context.strokeStyle = line.color;
         context.lineWidth = line.lineWidth / context.getTransform().a;
         context.lineCap = 'round'; context.lineJoin = 'round';
         if (!line.seed) line.seed = Math.floor(Math.random() * 10000);
         drawSketchySegmentInternal(context, line.startPoint.x, line.startPoint.y, line.endPoint.x, line.endPoint.y, context.lineWidth, line.color, line.seed);
    }
    function drawArcInternal(context, arcPath) { /* ... Keep original logic ... */
         if (!arcPath.startPoint || !arcPath.controlPoint || !arcPath.endPoint) return;
         context.strokeStyle = arcPath.color || 'black';
         context.lineWidth = arcPath.lineWidth / context.getTransform().a;
         context.lineCap = 'round'; context.lineJoin = 'round';
         // Simple quadratic curve for now, enhance with drawSketchySegment if needed
         context.beginPath();
         context.moveTo(arcPath.startPoint.x, arcPath.startPoint.y);
         context.quadraticCurveTo(arcPath.controlPoint.x, arcPath.controlPoint.y, arcPath.endPoint.x, arcPath.endPoint.y);
            context.stroke();
        }
     function drawArcInProgress(context, arcPath, canvasState) {
         if (!arcPath || !arcPath.startPoint) return;
         const { offsetX, offsetY, zoomFactor } = canvasState;
        
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
         context.strokeStyle = arcPath.color || 'grey';
         context.lineWidth = (arcPath.lineWidth || 2) / zoomFactor;
         context.setLineDash([5 / zoomFactor, 5 / zoomFactor]); // Dashed line for preview

        context.beginPath();
         context.moveTo(arcPath.startPoint.x, arcPath.startPoint.y);

         if (arcPath.controlPoint) {
             // We have start and control, previewing end
             const endPreview = arcPath.hoverEnd || arcPath.endPoint || arcPath.controlPoint; // Use hover, then final, fallback to control
             context.quadraticCurveTo(arcPath.controlPoint.x, arcPath.controlPoint.y, endPreview.x, endPreview.y);
         } else {
             // We only have start, previewing control and end implicitly straight
             const controlPreview = arcPath.hoverControl || arcPath.startPoint; // Use hover or start
             context.lineTo(controlPreview.x, controlPreview.y);
        }
        context.stroke();
         context.restore();
     }
     function drawSketchyPolygonInternal(context, polygon) { /* ... Keep original logic ... */
          if (!polygon.points || polygon.points.length < 2) return;
          context.strokeStyle = polygon.color;
          context.lineWidth = polygon.lineWidth / context.getTransform().a;
          if (!polygon.seed) polygon.seed = Math.floor(Math.random() * 10000);
          for (let i = 0; i < polygon.points.length; i++) {
              const p1 = polygon.points[i];
              const p2 = polygon.points[(i + 1) % polygon.points.length];
              drawSketchySegmentInternal(context, p1.x, p1.y, p2.x, p2.y, context.lineWidth, polygon.color, polygon.seed + i * 100);
          }
          // Reinforcement marks (optional)
          // ...
     }

    // drawSketchySegmentInternal (Internal helper, takes context assumed to be transformed)
    function drawSketchySegmentInternal(context, x1, y1, x2, y2, lineWidth, color, seed) { /* ... Keep original logic ... */
         const dx = x2 - x1; const dy = y2 - y1; const length = Math.hypot(dx, dy);
         if (length < 1e-6) return; // Avoid division by zero
         const unitX = dx / length; const unitY = dy / length;
         const segmentCount = Math.max(3, Math.min(12, Math.ceil(length / (lineWidth * 4))));
         const perpX = -unitY; const perpY = unitX;
         context.beginPath(); context.strokeStyle = color; context.lineWidth = lineWidth;
         let currentX = x1 + lineWidth * 0.1 * (pseudoRandom(seed) - 0.5);
         let currentY = y1 + lineWidth * 0.1 * (pseudoRandom(seed + 1) - 0.5);
         context.moveTo(currentX, currentY);
         for (let i = 1; i <= segmentCount; i++) {
             const t = i / segmentCount; let targetX = x1 + dx * t; let targetY = y1 + dy * t;
             const jitterScale = lineWidth * 0.8;
             const perpOffset = jitterScale * (pseudoRandom(seed + i * 10) - 0.5);
             targetX += perpX * perpOffset; targetY += perpY * perpOffset;
             if (segmentCount > 3) {
                 const controlT = (i - 0.5) / segmentCount;
                 const controlX = x1 + dx * controlT + perpX * jitterScale * (pseudoRandom(seed + i * 20) - 0.5);
                 const controlY = y1 + dy * controlT + perpY * jitterScale * (pseudoRandom(seed + i * 30) - 0.5);
                 context.quadraticCurveTo(controlX, controlY, targetX, targetY);
             } else {
                 context.lineTo(targetX, targetY);
             }
             currentX = targetX; currentY = targetY;
        }
        context.stroke();
         // Reinforcement stroke (optional)
         // if (length > lineWidth * 8) { ... }
    }
     function drawSketchyArrowLineInternal(context, x1, y1, x2, y2, lineWidth, color, seed) { /* ... Keep original logic ... */
          context.globalAlpha = 1.0; context.beginPath(); context.strokeStyle = color; context.lineWidth = lineWidth;
        const jitter = lineWidth * 0.2;
        const startX = x1 + jitter * (pseudoRandom(seed) - 0.5);
        const startY = y1 + jitter * (pseudoRandom(seed + 1) - 0.5);
        const endX = x2 + jitter * (pseudoRandom(seed + 2) - 0.5);
        const endY = y2 + jitter * (pseudoRandom(seed + 3) - 0.5);
        context.moveTo(startX, startY);
          const midX = (x1 + x2) / 2; const midY = (y1 + y2) / 2; const ctrlJitter = lineWidth * 0.7;
          const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len; const ny = dx / len;
          const ctrlX = midX + nx * ctrlJitter * (pseudoRandom(seed + 4) - 0.4);
        const ctrlY = midY + ny * ctrlJitter * (pseudoRandom(seed + 5) - 0.4);
        context.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        context.stroke();
          // Reinforcement stroke
           context.beginPath(); context.lineWidth = lineWidth * 0.6;
        const offsetX = jitter * 0.5 * (pseudoRandom(seed + 7) - 0.5);
        const offsetY = jitter * 0.5 * (pseudoRandom(seed + 8) - 0.5);
        context.moveTo(startX + offsetX, startY + offsetY);
        const wobblePts = 8;
        for (let i = 1; i <= wobblePts; i++) {
            const t = i / (wobblePts + 1);
            const wobbleX = startX + dx * t + offsetX + jitter * (pseudoRandom(seed + 10 + i) - 0.5);
            const wobbleY = startY + dy * t + offsetY + jitter * (pseudoRandom(seed + 20 + i) - 0.5);
            context.lineTo(wobbleX, wobbleY);
        }
        context.lineTo(endX + offsetX, endY + offsetY);
        context.stroke();
    }
    
    // --- Other Markup Functions (Keep here) ---
    function pseudoRandom(seed) { /* ... Keep original logic ... */
        const x = Math.sin(seed) * 10000; return x - Math.floor(x);
    }
    function calculateCurveEndDirection(controlPoint, endPoint) { /* ... Keep original logic ... */
        return { x: endPoint.x - controlPoint.x, y: endPoint.y - controlPoint.y };
    }
    function sampleBezierPoint(p0, p1, p2, p3, t) { /* ... Keep original logic ... */
        const omt = 1 - t, omt2 = omt * omt, omt3 = omt2 * omt; const t2 = t * t, t3 = t2 * t;
        return { x: omt3*p0.x + 3*omt2*t*p1.x + 3*omt*t2*p2.x + t3*p3.x, y: omt3*p0.y + 3*omt2*t*p1.y + 3*omt*t2*p2.y + t3*p3.y };
    }
    function sampleBezierCurve(p0, p1, p2, p3, samples) { /* ... Keep original logic ... */
        const points = []; for (let i=0; i<=samples; i++) points.push(sampleBezierPoint(p0, p1, p2, p3, i/samples)); return points;
    }
    function clearMarkup() { /* ... Keep original logic ... */
        if (confirm('Are you sure you want to clear all markup drawings?')) {
             saveMarkupState(); markupPaths = []; clearArrowControls(); updateUndoRedoButtons(); renderLoop();}
    }
    function saveMarkupImage() { /* ... Keep original logic, ensure drawAllMarkupPaths gets context */
         clearArrowControls(); // Hide controls for saving
         const tempCanvas = document.createElement('canvas'); tempCanvas.width = planCanvas.width; tempCanvas.height = planCanvas.height;
         const tempCtx = tempCanvas.getContext('2d');
         const canvasState = canvasUtilities.getCanvasState();
         tempCtx.save(); tempCtx.translate(canvasState.offsetX, canvasState.offsetY); tempCtx.scale(canvasState.zoomFactor, canvasState.zoomFactor);
         tempCtx.drawImage(planImage, 0, 0); // Draw base image
         tempCtx.restore(); // Restore before drawing markup overlay without transform? Or apply transform? Apply transform for consistency.
         drawAllMarkupPaths(tempCtx, canvasState); // Draw markup respecting current view
         const link = document.createElement('a'); link.download = 'planvision-markup.png'; link.href = tempCanvas.toDataURL('image/png'); link.click();
    }
    function showTextDialog(x, y, initialText = '') { /* ... Keep original logic ... */
         isTextPlacing = true;
         const canvasState = canvasUtilities.getCanvasState();
         textPlacementPoint = toPlanCoords(x, y); // Store plan coords

         const dialog = document.getElementById('markup-text-dialog');
         dialog.style.left = x + 'px'; // Use screen coords for dialog position
         dialog.style.top = (y - 160) + 'px';
         dialog.style.display = 'block';
         const textInput = document.getElementById('markup-text-input');
         textInput.value = initialText;
         textInput.focus();
         if (initialText) textInput.select();
         // Adjust font size dropdown if editing
         const sizeDropdown = document.getElementById('markup-text-size');
         if(editingTextElement) {
             sizeDropdown.value = editingTextElement.fontSize || 24;
         } else {
             sizeDropdown.value = 24; // Default size for new text
         }
    }
    function cancelTextEntry() { /* ... Keep original logic ... */
        document.getElementById('markup-text-dialog').style.display = 'none'; isTextPlacing = false; textPlacementPoint = null; editingTextElement = null;
        document.getElementById('markup-text-confirm').textContent = 'Add Text';
    }
    function confirmTextEntry() { /* ... Keep original logic ... */
         const text = document.getElementById('markup-text-input').value.trim();
         const fontSize = parseInt(document.getElementById('markup-text-size').value, 10);
         if (text && textPlacementPoint) {
             saveMarkupState();
             if (editingTextElement) {
                 editingTextElement.text = text; editingTextElement.fontSize = fontSize; editingTextElement.color = markupColor;
        } else {
                 markupPaths.push({ tool: 'text', text: text, position: { x: textPlacementPoint.x, y: textPlacementPoint.y }, color: markupColor, fontSize: fontSize, lineWidth: markupLineWidth });
             }
             document.getElementById('markup-text-dialog').style.display = 'none'; isTextPlacing = false; textPlacementPoint = null; editingTextElement = null;
             document.getElementById('markup-text-confirm').textContent = 'Add Text';
            renderLoop();
         } else if (!text) { // Handle empty text case
              cancelTextEntry(); // Just close dialog if no text entered
         }
    }
     function editTextElement(element) { /* ... Keep original logic ... */
         editingTextElement = element;
         document.getElementById('markup-text-confirm').textContent = 'Update Text';
         const canvasState = canvasUtilities.getCanvasState();
         const screenX = element.position.x * canvasState.zoomFactor + canvasState.offsetX;
         const screenY = element.position.y * canvasState.zoomFactor + canvasState.offsetY;
         showTextDialog(screenX, screenY, element.text);
         // Font size is set within showTextDialog now
     }
    function clearArrowControls() { /* ... Keep original logic ... */
        document.querySelectorAll('.control-point, .handle-point, .handle-line').forEach(el => el.remove());
        controlPoints = []; handlePoints = []; activeControlPoint = null;
        // Don't nullify currentArrow here, only activeControlPoint
    }
    function createControlPoint(x, y, type) { /* ... Keep original logic ... */
         const point = document.createElement('div');
         point.className = type.includes('control') ? 'handle-point' : 'control-point'; // Adjusted class names slightly
         point.style.position = 'absolute'; // Ensure positioning context
         point.style.left = `${x - 5}px`; // Center the handle
         point.style.top = `${y - 5}px`;
         point.dataset.type = type;
         point.style.width = '10px'; point.style.height = '10px'; point.style.background = 'yellow'; point.style.border = '1px solid black'; point.style.borderRadius = '50%'; point.style.zIndex = '1001';
         document.getElementById('canvas-container').appendChild(point); // Ensure container exists
         const pointObj = { element: point, type: type }; // Store element and type
         controlPoints.push(pointObj);
         if (type.includes('control')) handlePoints.push(pointObj); // Add handle points if it's a control type
         return pointObj;
    }
    function createHandleLine(x1, y1, x2, y2) { /* ... Keep original logic ... */
         const line = document.createElement('div'); line.className = 'handle-line';
         const length = Math.hypot(x2 - x1, y2 - y1);
         const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
         line.style.position = 'absolute'; line.style.width = `${length}px`; line.style.height = '1px'; line.style.background = 'yellow'; line.style.left = `${x1}px`; line.style.top = `${y1}px`; line.style.transformOrigin = '0 0'; line.style.transform = `rotate(${angle}deg)`; line.style.zIndex = '1000';
         document.getElementById('canvas-container').appendChild(line); // Ensure container exists
         return line;
    }
     function updateControlPointPositions() { /* ... Keep original logic ... */
          if (!currentArrow || arrowState !== 'edit') return;
          clearArrowControls(); // Clear old DOM elements first
          const canvasState = canvasUtilities.getCanvasState();
          const { offsetX, offsetY, zoomFactor } = canvasState;
          const startX = currentArrow.startPoint.x * zoomFactor + offsetX, startY = currentArrow.startPoint.y * zoomFactor + offsetY;
          const endX = currentArrow.endPoint.x * zoomFactor + offsetX, endY = currentArrow.endPoint.y * zoomFactor + offsetY;
          const control1X = currentArrow.control1.x * zoomFactor + offsetX, control1Y = currentArrow.control1.y * zoomFactor + offsetY;
          const control2X = currentArrow.control2.x * zoomFactor + offsetX, control2Y = currentArrow.control2.y * zoomFactor + offsetY;
          createControlPoint(startX, startY, 'start'); createControlPoint(endX, endY, 'end');
          createControlPoint(control1X, control1Y, 'control1'); createControlPoint(control2X, control2Y, 'control2');
          createHandleLine(startX, startY, control1X, control1Y); createHandleLine(endX, endY, control2X, control2Y);
     }
     function showArrowControls(arrow) { /* ... Keep original logic ... */
          currentArrow = arrow; arrowState = 'edit';
          planCanvas.classList.remove('markup-arrow-start', 'markup-arrow-end');
          planCanvas.classList.add('markup-arrow-edit');
          updateControlPointPositions(); // Create/Update the DOM elements
     }
    function findElementAt(pos) { /* ... Keep original logic, ensure zoomFactor comes from canvasState */
         const { zoomFactor } = canvasUtilities.getCanvasState();
         const hitRadius = 10 / zoomFactor; // Use dynamic hit radius
        for (let i = markupPaths.length - 1; i >= 0; i--) {
            const path = markupPaths[i];
             // Reuse existing hit detection logic for each tool type...
            if (path.tool === 'pencil') {
                  for (let j = 1; j < path.points.length; j++) { if (distanceToLineSegment(path.points[j-1].x, path.points[j-1].y, path.points[j].x, path.points[j].y, pos.x, pos.y) < hitRadius) return path; }
            } else if (path.tool === 'rectangle') {
                  const x = path.startPoint.x, y = path.startPoint.y, w = path.endPoint.x - x, h = path.endPoint.y - y;
                  if (distanceToLineSegment(x, y, x+w, y, pos.x, pos.y) < hitRadius || distanceToLineSegment(x+w, y, x+w, y+h, pos.x, pos.y) < hitRadius || distanceToLineSegment(x+w, y+h, x, y+h, pos.x, pos.y) < hitRadius || distanceToLineSegment(x, y+h, x, y, pos.x, pos.y) < hitRadius) return path;
            } else if (path.tool === 'circle') {
                  let cX, cY, r; if(path.centerPoint){ cX=path.centerPoint.x; cY=path.centerPoint.y; r=path.radius; } else { cX=(path.startPoint.x+path.endPoint.x)/2; cY=(path.startPoint.y+path.endPoint.y)/2; r=Math.hypot(path.endPoint.x-path.startPoint.x, path.endPoint.y-path.startPoint.y)/2;}
                  if (Math.abs(Math.hypot(pos.x - cX, pos.y - cY) - r) < hitRadius) return path;
            } else if (path.tool === 'polygon') {
                  for (let j = 0; j < path.points.length; j++) { if (distanceToLineSegment(path.points[j].x, path.points[j].y, path.points[(j+1)%path.points.length].x, path.points[(j+1)%path.points.length].y, pos.x, pos.y) < hitRadius) return path; }
            } else if (path.tool === 'arrow') {
                  const points = sampleBezierCurve(path.startPoint, path.control1, path.control2, path.endPoint, 20);
                  for (let j = 1; j < points.length; j++) { if (distanceToLineSegment(points[j-1].x, points[j-1].y, points[j].x, points[j].y, pos.x, pos.y) < hitRadius * 1.5) return path; } // Slightly larger hit radius for curves
                   // Check arrowhead lines... (simplified check)
                   if (distanceToLineSegment(path.control2.x, path.control2.y, path.endPoint.x, path.endPoint.y, pos.x, pos.y) < hitRadius * 2) return path; // Check near end segment
            } else if (path.tool === 'text') {
                   const fontSize = (path.fontSize || 24) / zoomFactor; // Use scaled font size for hit test
                   const approxCharWidth = fontSize * 0.6; const textWidth = path.text.length * approxCharWidth; const textHeight = fontSize * 1.2;
                   const hitPad = 5 / zoomFactor; // Scaled padding
                   if (pos.x >= path.position.x - hitPad && pos.x <= path.position.x + textWidth + hitPad && pos.y >= path.position.y - textHeight * 0.1 - hitPad && pos.y <= path.position.y + textHeight * 0.9 + hitPad) return path; // Adjusted Y check
              } else if (path.tool === 'line') {
                  if (distanceToLineSegment(path.startPoint.x, path.startPoint.y, path.endPoint.x, path.endPoint.y, pos.x, pos.y) < hitRadius) return path;
              } else if (path.tool === 'arc') {
                   if (distanceToQuadraticCurve(path.startPoint.x, path.startPoint.y, path.controlPoint.x, path.controlPoint.y, path.endPoint.x, path.endPoint.y, pos.x, pos.y, 20) < hitRadius * 1.5) return path; // Larger hit radius for curves
              }
         }
         return null;
    }
     function findTextElementAt(position) { /* ... Keep original logic, use zoomFactor for hit test */
          const { zoomFactor } = canvasUtilities.getCanvasState();
          for (let i = markupPaths.length - 1; i >= 0; i--) {
              const path = markupPaths[i];
              if (path.tool === 'text') {
                   const fontSize = (path.fontSize || 24) / zoomFactor; const approxCharWidth = fontSize * 0.6; const textWidth = path.text.length * approxCharWidth; const textHeight = fontSize * 1.2;
                   const hitPad = 5 / zoomFactor; // Scaled padding
                   if (position.x >= path.position.x - hitPad && position.x <= path.position.x + textWidth + hitPad && position.y >= path.position.y - textHeight * 0.1 - hitPad && position.y <= path.position.y + textHeight * 0.9 + hitPad) return path;
                   // Check radius around origin point as fallback
                   const dx = path.position.x - position.x; const dy = path.position.y - position.y;
                   const hitRadius = Math.max(15 / zoomFactor, 10); // Scaled radius, min 10px
                   if (dx*dx + dy*dy <= hitRadius*hitRadius) return path;
              }
          }
          return null;
     }
    function selectElement(element) { /* ... Keep original logic, ensure screen coords used for dialog */
        selectedElement = element;
        if (element.tool === 'text' && currentMarkupTool === 'selection') {
            editingTextElement = element;
              textPlacementPoint = element.position; // This is plan coords
            isTextPlacing = true;
              const canvasState = canvasUtilities.getCanvasState();
              const screenX = element.position.x * canvasState.zoomFactor + canvasState.offsetX;
              const screenY = element.position.y * canvasState.zoomFactor + canvasState.offsetY;
              // Position dialog relative to screen coords
            showTextDialog(screenX, screenY, element.text || '');
            document.getElementById('markup-text-confirm').textContent = 'Update Text';
        }
          createSelectionHandles(element); // Update handles
          renderLoop(); // Redraw with highlight
    }
    function clearSelection() { /* ... Keep original logic ... */
        selectedElement = null; clearSelectionHandles(); renderLoop(); // Redraw without highlight
    }
    function createSelectionHandles(element) { /* ... Keep original logic ... */
        if (!element) return;
         clearSelectionHandles(); // Clear previous first
         const handleContainer = document.getElementById('selection-handles') || createHandleContainer();
         const canvasState = canvasUtilities.getCanvasState();
         // Function to create a single handle (now internal)
         function createHandle(position, type, container) {
             const handle = document.createElement('div'); handle.className = 'selection-handle'; handle.dataset.type = type; handle.style.position = 'absolute'; handle.style.width = '10px'; handle.style.height = '10px'; handle.style.borderRadius = '50%'; handle.style.backgroundColor = 'yellow'; handle.style.border = '1px solid #333'; handle.style.transform = 'translate(-50%, -50%)'; handle.style.pointerEvents = 'none'; handle.style.zIndex = '1002';
             const screenX = position.x * canvasState.zoomFactor + canvasState.offsetX; const screenY = position.y * canvasState.zoomFactor + canvasState.offsetY;
             handle.style.left = screenX + 'px'; handle.style.top = screenY + 'px';
             container.appendChild(handle); return handle;
         }
         // Logic to create handles based on element type
          if (element.tool === 'pencil' && element.points.length > 0) {
              createHandle(element.points[0], 'start', handleContainer);
              createHandle(element.points[element.points.length - 1], 'end', handleContainer);
              // Optional: add midpoint handles
        } else if (element.tool === 'rectangle') {
              createHandle(element.startPoint, 'tl', handleContainer); createHandle({x: element.endPoint.x, y: element.startPoint.y}, 'tr', handleContainer); createHandle(element.endPoint, 'br', handleContainer); createHandle({x: element.startPoint.x, y: element.endPoint.y}, 'bl', handleContainer);
        } else if (element.tool === 'circle') {
               let cX, cY, r; if(element.centerPoint){ cX=element.centerPoint.x; cY=element.centerPoint.y; r=element.radius; } else { /* old format */ cX=(element.startPoint.x+element.endPoint.x)/2; cY=(element.startPoint.y+element.endPoint.y)/2; r=Math.hypot(element.endPoint.x-element.startPoint.x, element.endPoint.y-element.startPoint.y)/2;}
               createHandle({x: cX, y: cY}, 'center', handleContainer); createHandle({x: cX + r, y: cY}, 'right', handleContainer); createHandle({x: cX, y: cY - r}, 'top', handleContainer); createHandle({x: cX - r, y: cY}, 'left', handleContainer); createHandle({x: cX, y: cY + r}, 'bottom', handleContainer);
        } else if (element.tool === 'text') {
              createHandle(element.position, 'pos', handleContainer);
        } else if (element.tool === 'arrow') {
              createHandle(element.startPoint, 'start', handleContainer); createHandle(element.endPoint, 'end', handleContainer); createHandle(element.control1, 'ctrl1', handleContainer); createHandle(element.control2, 'ctrl2', handleContainer);
          } else if (element.tool === 'line') {
               createHandle(element.startPoint, 'start', handleContainer); createHandle(element.endPoint, 'end', handleContainer);
          } else if (element.tool === 'arc') {
               createHandle(element.startPoint, 'start', handleContainer); createHandle(element.controlPoint, 'ctrl', handleContainer); createHandle(element.endPoint, 'end', handleContainer);
        } else if (element.tool === 'polygon') {
               element.points.forEach((p, i) => createHandle(p, `p${i}`, handleContainer));
          }
    }
     function createHandleContainer() {
         let container = document.getElementById('selection-handles');
         if (!container) {
             container = document.createElement('div'); container.id = 'selection-handles';
             container.style.position = 'absolute'; container.style.left = '0'; container.style.top = '0'; container.style.width = '100%'; container.style.height = '100%'; container.style.pointerEvents = 'none'; container.style.zIndex = '1001';
             document.getElementById('app').appendChild(container); // Append to app root
         }
         return container;
     }
    function clearSelectionHandles() { /* ... Keep original logic ... */
        const handleContainer = document.getElementById('selection-handles');
        if (handleContainer) handleContainer.innerHTML = ''; // Clear content instead of removing container
        selectionHandles = []; // Keep array for potential future use
        // Clear arrow control point DOM elements if they exist
        clearArrowControls();
    }
    function moveElement(element, newPosition) { /* ... Keep original logic ... */
        if (!element) return;
         const moveX = newPosition.x + moveOffset.x; const moveY = newPosition.y + moveOffset.y;
         let dx = 0, dy = 0;
         if (element.tool === 'pencil' && element.points?.length > 0) {
             dx = moveX - element.points[0].x; dy = moveY - element.points[0].y;
             element.points.forEach(p => { p.x += dx; p.y += dy; });
        } else if (element.tool === 'text') {
             dx = moveX - element.position.x; dy = moveY - element.position.y;
             element.position.x += dx; element.position.y += dy;
        } else if (element.tool === 'arrow') {
             dx = moveX - element.startPoint.x; dy = moveY - element.startPoint.y; // Use start point as reference
             element.startPoint.x += dx; element.startPoint.y += dy; element.endPoint.x += dx; element.endPoint.y += dy; element.control1.x += dx; element.control1.y += dy; element.control2.x += dx; element.control2.y += dy;
        } else if (element.tool === 'rectangle') {
             dx = moveX - element.startPoint.x; dy = moveY - element.startPoint.y;
             element.startPoint.x += dx; element.startPoint.y += dy; element.endPoint.x += dx; element.endPoint.y += dy;
        } else if (element.tool === 'circle') {
             if (element.centerPoint) { dx = moveX - element.centerPoint.x; dy = moveY - element.centerPoint.y; element.centerPoint.x += dx; element.centerPoint.y += dy; }
             else { /* old format */ dx = moveX - (element.startPoint.x+element.endPoint.x)/2; dy = moveY - (element.startPoint.y+element.endPoint.y)/2; element.startPoint.x += dx; element.startPoint.y += dy; element.endPoint.x += dx; element.endPoint.y += dy;}
         } else if (element.tool === 'polygon' && element.points?.length > 0) {
             dx = moveX - element.points[0].x; dy = moveY - element.points[0].y;
             element.points.forEach(p => { p.x += dx; p.y += dy; });
         } else if (element.tool === 'line' || element.tool === 'arc') {
              dx = moveX - element.startPoint.x; dy = moveY - element.startPoint.y;
              element.startPoint.x += dx; element.startPoint.y += dy;
              if(element.endPoint) { element.endPoint.x += dx; element.endPoint.y += dy; }
              if(element.controlPoint) { element.controlPoint.x += dx; element.controlPoint.y += dy; } // For arc
         }
         updateAllHandlePositions(); // Update handles after moving
    }
    function deleteSelectedElement() { /* ... Keep original logic ... */
        if (!selectedElement) return; saveMarkupState();
        const index = markupPaths.indexOf(selectedElement);
        if (index !== -1) markupPaths.splice(index, 1);
        clearSelection(); updateUndoRedoButtons(); renderLoop();
    }
    function copySelectedElement() { /* ... Keep original logic ... */
        if (!selectedElement) return;
        clipboardElement = JSON.parse(JSON.stringify(selectedElement));
        consecutivePastes = 0; showCopyFeedback();
    }
    function pasteElement(e) { /* ... Keep original logic, use canvasUtilities */
        if (!clipboardElement) return; saveMarkupState();
        const newElement = JSON.parse(JSON.stringify(clipboardElement));
        const canvasState = canvasUtilities.getCanvasState();
        let targetPos;
        if (e.clientX !== undefined) { const rect = planCanvas.getBoundingClientRect(); targetPos = toPlanCoords(e.clientX - rect.left, e.clientY - rect.top); }
        else { targetPos = toPlanCoords(planCanvas.width / 2, planCanvas.height / 2); } // Center if no coords
        const currentOffset = { x: pasteOffset.x + (consecutivePastes * 10), y: pasteOffset.y + (consecutivePastes * 10) };
        consecutivePastes++;
        const offsetXPlan = currentOffset.x / canvasState.zoomFactor; const offsetYPlan = currentOffset.y / canvasState.zoomFactor;
        // Apply offset based on element type
        if (newElement.points) { // pencil, polygon
             let minX = Infinity, minY = Infinity; clipboardElement.points.forEach(p => { minX=Math.min(minX, p.x); minY=Math.min(minY, p.y); });
             newElement.points.forEach(p => { p.x = p.x - minX + targetPos.x + offsetXPlan; p.y = p.y - minY + targetPos.y + offsetYPlan; });
        } else if (newElement.position) { // text
             newElement.position = { x: targetPos.x + offsetXPlan, y: targetPos.y + offsetYPlan };
        } else if (newElement.tool === 'arrow') {
             const origCX = (clipboardElement.startPoint.x+clipboardElement.endPoint.x)/2, origCY = (clipboardElement.startPoint.y+clipboardElement.endPoint.y)/2;
             const vectors = { start: {x:clipboardElement.startPoint.x-origCX, y:clipboardElement.startPoint.y-origCY}, end: {x:clipboardElement.endPoint.x-origCX, y:clipboardElement.endPoint.y-origCY}, c1: {x:clipboardElement.control1.x-origCX, y:clipboardElement.control1.y-origCY}, c2: {x:clipboardElement.control2.x-origCX, y:clipboardElement.control2.y-origCY} };
             newElement.startPoint = { x: targetPos.x + vectors.start.x + offsetXPlan, y: targetPos.y + vectors.start.y + offsetYPlan };
             newElement.endPoint = { x: targetPos.x + vectors.end.x + offsetXPlan, y: targetPos.y + vectors.end.y + offsetYPlan };
             newElement.control1 = { x: targetPos.x + vectors.c1.x + offsetXPlan, y: targetPos.y + vectors.c1.y + offsetYPlan };
             newElement.control2 = { x: targetPos.x + vectors.c2.x + offsetXPlan, y: targetPos.y + vectors.c2.y + offsetYPlan };
        } else if (newElement.startPoint && newElement.endPoint) { // rectangle, line, old circle, arc
             const dx = newElement.endPoint.x - newElement.startPoint.x; const dy = newElement.endPoint.y - newElement.startPoint.y;
             newElement.startPoint = { x: targetPos.x + offsetXPlan, y: targetPos.y + offsetYPlan };
             newElement.endPoint = { x: newElement.startPoint.x + dx, y: newElement.startPoint.y + dy };
              if (newElement.controlPoint) { // arc control point relative move
                  const cdx = clipboardElement.controlPoint.x - clipboardElement.startPoint.x;
                  const cdy = clipboardElement.controlPoint.y - clipboardElement.startPoint.y;
                  newElement.controlPoint = {x: newElement.startPoint.x + cdx, y: newElement.startPoint.y + cdy};
              }
        } else if (newElement.centerPoint) { // new circle
             newElement.centerPoint = { x: targetPos.x + offsetXPlan, y: targetPos.y + offsetYPlan };
        }
        markupPaths.push(newElement);
        selectElement(newElement); // Select the pasted element
        updateUndoRedoButtons(); renderLoop();
    }
    function showCopyFeedback() { /* ... Keep original logic ... */
        const fb = document.createElement('div'); fb.textContent='Element copied'; fb.style.cssText="position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:10px 20px;border-radius:5px;z-index:10000;pointer-events:none;opacity:1;transition:opacity 0.5s;"; document.body.appendChild(fb); setTimeout(()=>{fb.style.opacity='0'; setTimeout(()=>fb.remove(), 500);}, 1500);
    }
    function updateAllHandlePositions() { /* ... Keep original logic ... */
        if (selectedElement) createSelectionHandles(selectedElement);
        if (currentArrow && arrowState === 'edit') updateControlPointPositions();
    }
    function saveMarkupState() { /* ... Keep original logic ... */
        const state = JSON.parse(JSON.stringify(markupPaths)); markupHistory.push(state);
        if(markupHistory.length > maxHistoryLength) markupHistory.shift();
        markupRedoStack = []; updateUndoRedoButtons();
    }
    function undoMarkupAction() { /* ... Keep original logic ... */
        if (markupHistory.length > 0) { markupRedoStack.push(JSON.parse(JSON.stringify(markupPaths))); markupPaths = markupHistory.pop(); updateUndoRedoButtons(); clearSelection(); clearArrowControls(); renderLoop(); }
    }
    function redoMarkupAction() { /* ... Keep original logic ... */
        if (markupRedoStack.length > 0) { markupHistory.push(JSON.parse(JSON.stringify(markupPaths))); markupPaths = markupRedoStack.pop(); updateUndoRedoButtons(); clearSelection(); clearArrowControls(); renderLoop(); }
    }
    function updateUndoRedoButtons() { /* ... Keep original logic ... */
        document.getElementById("markupUndoBtn").style.opacity = markupHistory.length > 0 ? 1 : 0.5;
        document.getElementById("markupRedoBtn").style.opacity = markupRedoStack.length > 0 ? 1 : 0.5;
    }
    function updateToolButtonStyles(activeTool) {
         document.querySelectorAll('#markup-toolset .tool-button').forEach(btn => {
              // Exclude cancel button and non-tool buttons
              if (btn.id && !btn.id.toLowerCase().includes('cancel') && !btn.id.toLowerCase().includes('clear') && !btn.id.toLowerCase().includes('save') && !btn.id.toLowerCase().includes('undo') && !btn.id.toLowerCase().includes('redo')) {
                   const toolName = btn.id.replace('markup', '').replace('Btn', '').toLowerCase();
                    // Handle combined rect/filled-rect logic if needed
                   const isActive = activeTool && (
                       toolName === activeTool ||
                       (activeTool === 'filled-rectangle' && toolName === 'rectangle') || // Highlight rect for filled-rect
                       (activeTool === 'rectangle' && toolName === 'filledrectangle') // Highlight filled-rect for rect? Maybe not needed.
                   );

                   if (isActive) {
                       btn.style.backgroundColor = '#e0e0e0'; // Active style
                       btn.style.opacity = '1';
                   } else {
                       btn.style.backgroundColor = ''; // Reset to default CSS
                       btn.style.opacity = '0.7'; // Inactive style
                   }
              }
         });
          // Ensure cancel button always looks the same when visible
          const cancelBtn = document.getElementById('cancelMarkupToolBtn');
          if (cancelBtn && cancelBtn.style.display !== 'none') {
              cancelBtn.style.backgroundColor = '#d9534f';
              cancelBtn.style.opacity = '1';
          }
     }
    function onKeyDown(e) { /* ... Keep original logic ... */
        if (!isMarkupToolsetActive && !isTextPlacing) return; // Allow escape from text dialog even if markup inactive

         if (e.key === 'Escape') {
              if (isTextPlacing) { cancelTextEntry(); e.preventDefault(); return; } // Prioritize closing dialog
              if (!isMarkupToolsetActive) return; // Only handle below if markup IS active

              if (currentMarkupPath || isShapeDrawing || isLineDrawing || isArcDrawing) { // Cancel drawing in progress
                  currentMarkupPath = null; isShapeDrawing = false; currentShape = null; shapeStartPoint = null; isLineDrawing = false; currentLine = null; isArcDrawing = false; currentArc = null;
              } else if (currentMarkupTool === 'arrow' && arrowState !== 'idle') { // Cancel arrow edit/placement
                  clearArrowControls(); arrowState = 'idle'; planCanvas.className = ''; planCanvas.classList.add('markup-arrow-start');
              } else if (selectedElement) { // Deselect
                   clearSelection();
              } else { // Cancel the tool entirely
                  cancelMarkupTool();
              }
              renderLoop(); // Redraw after state change
              e.preventDefault();
         }
         else if (e.key === 'Enter') {
              if (isTextPlacing) { confirmTextEntry(); e.preventDefault(); return; } // Prioritize text confirm
              if (!isMarkupToolsetActive) return;
              // Future: Complete polygon?
              e.preventDefault();
         }
         else if (e.key === 'Delete' || e.key === 'Backspace') {
              if (isTextPlacing) return; // Don't delete while typing
              if (!isMarkupToolsetActive || currentMarkupTool !== 'selection' || !selectedElement) return; // Only delete selected in selection mode
              deleteSelectedElement();
              e.preventDefault(); // Prevent browser back navigation
         }
         else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) { // Ctrl+C or Cmd+C
              if (!isMarkupToolsetActive || !selectedElement) return;
              copySelectedElement(); e.preventDefault();
         }
         else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) { // Ctrl+V or Cmd+V
              if (!isMarkupToolsetActive || !clipboardElement) return;
              pasteElement(e); e.preventDefault();
         }
         else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { // Ctrl+Z or Cmd+Z
             if (!isMarkupToolsetActive) return;
             undoMarkupAction(); e.preventDefault();
         }
          else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { // Ctrl+Y or Cmd+Y
             if (!isMarkupToolsetActive) return;
             redoMarkupAction(); e.preventDefault();
         }
    }
    function showMarkupInstructions(tool) { /* ... Keep original logic ... */
        const instructionsDiv = document.getElementById('markup-instructions');
        if (!instructionsDiv) { /* Create if needed */
            const newDiv = document.createElement('div'); newDiv.id='markup-instructions'; newDiv.style.cssText="position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 12px;border-radius:4px;z-index:10000;display:none;"; document.body.appendChild(newDiv);
            showMarkupInstructions(tool); return; // Recurse
        }
        let instructions = '';
        switch (tool) {
             case 'selection': instructions = 'Click/Tap: Select | Drag: Move | Shift+Click: Multi-Select (Not Impl.) | Del/Backspace: Delete'; break;
             case 'pencil': instructions = 'Click/Tap and Drag: Draw Freehand'; break;
             case 'eraser': instructions = 'Click/Tap and Drag: Erase Markup'; break;
             case 'arrow': instructions = 'Click/Tap: Start | Click/Tap or Drag: End | Drag Handles: Adjust Curve'; break;
             case 'text': instructions = 'Click/Tap: Place Text | Enter: Confirm | Esc: Cancel'; break;
             case 'line': instructions = 'Click/Tap and Drag: Draw Straight Line'; break;
             case 'rectangle': instructions = 'Click/Tap and Drag: Draw Rectangle'; break;
             // case 'filled-rectangle': // Uses rectangle instructions
             case 'circle': instructions = 'Click/Tap: Set Center | Drag: Set Radius'; break;
             case 'arc': instructions = 'Click/Tap: Start | Click/Tap: Control Point | Click/Tap: End'; break;
         }
        if (instructions) {
             instructionsDiv.innerHTML = instructions; instructionsDiv.style.display = 'block';
             let timeoutId;
             function dismiss() { if(timeoutId) clearTimeout(timeoutId); instructionsDiv.style.display = 'none'; instructionsDiv.removeEventListener('click', dismiss); }
             instructionsDiv.removeEventListener('click', dismiss); instructionsDiv.addEventListener('click', dismiss);
             timeoutId = setTimeout(dismiss, 3000); // Auto-dismiss after 3s
        } else {
            instructionsDiv.style.display = 'none';
        }
    }
     function detectAndEraseElements(position, radius) { /* ... Keep original logic, ensure distToSegment exists */
          const eraserRadiusSquared = radius * radius; let erasedAny = false; const originalLength = markupPaths.length;
        markupPaths = markupPaths.filter(path => {
               if (path.tool === 'pencil') { for (let p of path.points) { if (Math.hypot(p.x - position.x, p.y - position.y) <= radius) { erasedAny = true; return false; } } }
               else if (path.tool === 'arrow') { const pts=[path.startPoint, path.endPoint, path.control1, path.control2]; for(let p of pts){ if(Math.hypot(p.x-position.x, p.y-position.y) <= radius){ erasedAny=true; return false; } } }
               else if (path.tool === 'rectangle') { const corners=[{x:path.startPoint.x,y:path.startPoint.y},{x:path.endPoint.x,y:path.startPoint.y},{x:path.startPoint.x,y:path.endPoint.y},{x:path.endPoint.x,y:path.endPoint.y}]; for(let c of corners){ if(Math.hypot(c.x-position.x, c.y-position.y) <= radius){ erasedAny=true; return false; } } const edges=[{p1:corners[0],p2:corners[1]},{p1:corners[1],p2:corners[3]},{p1:corners[3],p2:corners[2]},{p1:corners[2],p2:corners[0]}]; for(let e of edges){ if(distToSegment(position, e.p1, e.p2) <= radius){ erasedAny=true; return false; } } }
               else if (path.tool === 'circle') { let cX, cY, r; if(path.centerPoint){ cX=path.centerPoint.x; cY=path.centerPoint.y; r=path.radius; } else { cX=(path.startPoint.x+path.endPoint.x)/2; cY=(path.startPoint.y+path.endPoint.y)/2; r=Math.hypot(path.endPoint.x-path.startPoint.x, path.endPoint.y-path.startPoint.y)/2;} const distCenter = Math.hypot(cX-position.x, cY-position.y); if(Math.abs(distCenter - r) <= radius || distCenter <= radius){ erasedAny=true; return false; } }
               else if (path.tool === 'polygon' && path.points) { for (let i = 0; i < path.points.length; i++) { const p1 = path.points[i], p2 = path.points[(i+1)%path.points.length]; if(Math.hypot(p1.x-position.x, p1.y-position.y) <= radius || distToSegment(position, p1, p2) <= radius){ erasedAny=true; return false; } } }
               else if (path.tool === 'text') { if (Math.hypot(path.position.x - position.x, path.position.y - position.y) <= radius * 2) { erasedAny = true; return false; } } // Simpler radius check for text
               else if (path.tool === 'line') { if (distanceToLineSegment(path.startPoint.x, path.startPoint.y, path.endPoint.x, path.endPoint.y, position.x, position.y) <= radius) { erasedAny = true; return false; } }
               else if (path.tool === 'arc') { if (distanceToQuadraticCurve(path.startPoint.x, path.startPoint.y, path.controlPoint.x, path.controlPoint.y, path.endPoint.x, path.endPoint.y, position.x, position.y, 20) <= radius) { erasedAny = true; return false; } }
               return true; // Keep path if no condition met
          });
          if (erasedAny && originalLength > markupPaths.length) {
               saveMarkupState(); // Save *after* filtering if something was removed
               renderLoop();
               return true;
          }
                    return false;
                }
     // distToSegment helper (needed by eraser/hit detection)
     function distToSegment(p, v, w) {
       const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
       if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
       let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
       t = Math.max(0, Math.min(1, t));
       return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
     }
    function handlePointerDownArc(pos) { /* ... Keep original logic ... */
        if (!isArcDrawing) {
            isArcDrawing = true;
            currentArc = { tool: 'arc', color: markupColor, lineWidth: markupLineWidth, startPoint: pos, controlPoint: null, endPoint: null, seed: Math.random()*10000 };
        } else if (currentArc && !currentArc.controlPoint) {
            currentArc.controlPoint = pos;
        } else if (currentArc && !currentArc.endPoint) {
            currentArc.endPoint = pos;
            if (currentArc.startPoint && currentArc.controlPoint && currentArc.endPoint) { // Ensure all points valid
                 markupPaths.push(currentArc);
                 saveMarkupState();
            }
            currentArc = null; isArcDrawing = false; // Reset
        }
        renderLoop(); // Redraw preview
    }
    // --- Arc Drawing (kept with markup for now) ---
    function getQuadraticCurvePoints(start, control, end, numPoints = 30) { /* ... Keep original logic ... */
        const pts=[]; for(let i=0; i<=numPoints; i++){ const t=i/numPoints; const x=Math.pow(1-t,2)*start.x + 2*(1-t)*t*control.x + Math.pow(t,2)*end.x; const y=Math.pow(1-t,2)*start.y + 2*(1-t)*t*control.y + Math.pow(t,2)*end.y; pts.push({x,y});} return pts;
    }
    function drawSketchyArc(start, control, end) { /* ... Keep original logic ... */
         // This function seems to call drawSketchyLine, ensure it's the internal version or pass context
         const points = getQuadraticCurvePoints(start, control, end);
         for (let i = 0; i < points.length - 1; i++) {
             // Need to call the internal version that expects transformed context
             // Or pass context down if this is called directly
             drawSketchyLineInternal(ctx, { startPoint: points[i], endPoint: points[i+1], color: markupColor, lineWidth: markupLineWidth, seed: Math.random() * 10000 }); // Assuming context is already transformed
         }
    }
     function distanceToQuadraticCurve(x1, y1, cx, cy, x2, y2, px, py, steps = 20) { /* ... Keep original logic ... */
          let minDist=Infinity; for(let i=0; i<=steps; i++){ let t=i/steps; let qx=(1-t)*(1-t)*x1 + 2*(1-t)*t*cx + t*t*x2; let qy=(1-t)*(1-t)*y1 + 2*(1-t)*t*cy + t*t*y2; let d=Math.hypot(px-qx, py-qy); if(d<minDist) minDist=d; } return minDist;
     }


    // Start the application
    init();

})();
