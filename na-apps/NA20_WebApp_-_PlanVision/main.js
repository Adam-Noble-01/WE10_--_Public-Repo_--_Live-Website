// JAVASCRIPT |  PLANVISION APP
// ----------------------------------------------------------------------------
// - This script is the main entry point for the PlanVision application
// - It initialises the application and loads the necessary assets and drawings
// - It also contains the core functionality for the application
//   - !!!CURRENT TASK IS BREAKING DOWN THE LOADING OF DRAWINGS INTO A SEPARATE MODULES!!!
//   - // OFFLOADED   =  ← The date the script was offloaded to a separate module
// ----------------------------------------------------------------------------

// MINOR RELEASE - Math Functions Offloaded into new Script `coreMathLibrary.js` file
// Version | 2.0.3.
// Date    | 13-Apr-2025
// Summary | Core mathematical functions have been offloaded from main.js to coreMathLibrary.js to improve code organisation and maintainability.
// 
// Key Changes:
//  - Offloaded functions include:
//      coreMathDistanceCalc
//      coreMathDistanceToLineSegment
//      coreMathGeomPolygonArea
//      coreMathGeomPolygonCentroid
//      coreMathGeomGenerateQuadraticCurvePoints
//      coreMathGeomBezierPoint
//      coreMathPseudoRandomValueGen
// This change enhances modularity, making updates and testing easier.
//
// Benefits:
// - Improved code organization and maintainability.
// - Easier updates to mathematical logic without affecting main application logic.


// ============================================================================
// INDEX / CONTENTS
// ============================================================================
// Note : WARNING! This list may not be up to date!
// Note : The following functions are currently being worked on and offloaded to new separate modules
// Note : The functions are listed in the order they appear in the main.js file
// ----------------------------------------------------------------------------
    //
    // ----------------------------------------------------------------------------
    // FUNCTIONS IMPORTED FROM OTHER MODULES
    // ----------------------------------------------------------------------------
    // From './app-asset-loader.js':
    // - fetchAssetLibrary
    // - loadFontsFromAssetLibrary
    // - updateImagesFromAssetLibrary
    // - preloadFonts
    // - checkFontAvailability
    //
    // From './drawing-loader.js':
    // - fetchDrawings
    // - loadDrawing
    // - loadPlanImage
    // - createDrawingButtons
    // - updateDownloadLink
    //
    // From './loading-screen.js':
    // - initLoadingScreen
    // - showLoadingScreen
    // - hideLoadingScreen
    // - showErrorMessage
    // - hideErrorMessage
    //
    // From './coreMathLibrary.js':
    // - coreMathDistanceCalc
    // - coreMathDistanceToLineSegment
    // - coreMathGeomPolygonArea
    // - coreMathGeomPolygonCentroid
    // - coreMathGeomGenerateQuadraticCurvePoints
    // - coreMathGeomBezierPoint
    // - coreMathPseudoRandomValueGen
    // ----------------------------------------------------------------------------
    // LOCAL FUNCTIONS
    // ----------------------------------------------------------------------------
    // 238: initPlanVisionApp()
    // 340: handleInitialTutorialFlow()
    // 360: isMobileOrTabletPortrait()
    // 365: isPortrait()
    // 375: renderLoop()
    // 454: drawLine()
    // 485: drawMarkers()
    // 509: drawRectangle()
    // 535: drawRectLabel()
    // 569: drawPolygon()
    // 593: drawOpenPolygon()
    // 614: drawLineLabel()
    // 621: drawAreaLabel()
    // 626: drawEdgeLabels()
    // 650: drawTextLabel()
    // 689: canvasToPlanCoords()
    // 701: finalizeMeasurement()
    // 787: attachEventListeners()
    // 967: toggleToolbar()
    // 983: onMouseMove()
    // 1182: onMouseDown()
    // 1453: onWheel()
    // 1477: drawSketchyArc()
    // 1487: handlePointerDownArc()
    // 1526: drawArc()
    // 1551: drawGeomMathDistanceToQuadraticCurve()
    // 1570: onTouchStart()
    // 1593: onTouchMove()
    // 1623: onTouchEnd()
    // 1650: applyZoom()
    // 1655: setZoom()
    // 1670: resizeCanvas()
    // 1680: resetView()
    // 1750: setTool()
    // 1780: cancelTool()
    // 1798: clearMeasurements()
    // 1805: showCancelTool()
    // 1809: hideCancelTool()
    // 1813: updateMeasureInfo()
    // 1831: adjustConfirmButtonPosition()
    // 1862: showToolInstructions()
    // 1899: displayInstructionsOverlay()
    // 1901: dismissOverlay()
    // 1917: touchDistance()
    // 1921: touchMidpoint()
    // 1931: onResize()
    // 1943: toggleMarkupToolset()
    // 2027: returnToMeasuringTools()
    // 2071: setMarkupTool()
    // 2144: clearMarkup()
    // 2154: saveMarkupImage()
    // 2182: showTextDialog()
    // 2198: cancelTextEntry()
    // 2215: drawAllMarkupPaths()
    // 2248: drawArc()
    // 2291: drawSketchyText()
    // 2328: showTextDialog()
    // 2355: cancelTextEntry()
    // 2368: confirmTextEntry()
    // 2412: editTextElement()
    // 2428: clearArrowControls()
    // 2440: createControlPoint()
    // 2459: createHandleLine()
    // 2479: updateControlPointPositions()
    // 2507: drawAllMarkupPaths()
    // 2675: drawSketchyPath()
    // 2765: drawArrow()
    // 2909: drawSketchyArrowLine()
    // 2953: calculateCurveEndDirection()
    // 2962: drawSketchyText()
    // 2997: drawSketchyRectangle()
    // 3109: drawSketchyCircle()
    // 3208: drawArrow()
    // 3321: drawSketchyArrowLine()
    // 3384: drawSketchySegment()
    // 3483: saveMarkupState()
    // 3501: undoMarkupAction()
    // 3523: redoMarkupAction()
    // 3545: updateUndoRedoButtons()
    // 3562: onKeyDown()
    // 3621: showMarkupInstructions()
    // 3686: dismissInstructions()
    // 3702: detectAndEraseElements()
    // 3946: findTextElementAt()
    // 3980: findElementAt()
    // 4140: selectElement()
    // 4170: clearSelection()
    // 4186: createSelectionHandles()
    // 4269: clearSelectionHandles()
    // 4287: moveElement()
    // 4362: deleteSelectedElement()
    // 4393: updateAllHandlePositions()
    // 4411: copySelectedElement()
    // 4425: pasteElement()
    // 4565: showCopyFeedback()
    // 4592: drawSketchyPolygon()
    // 4649: drawSketchyLine()
    // 4678: showArrowControls()
    // 4719: createHandle()
    // 4744: updateAllHandlePositions()
    // 4768: onMouseUp()
    // 4991: sampleBezierCurve()
    // 5005: cancelMarkupTool()
    // 5041: showMarkupInstructions()
    // 5106: dismissInstructions()
    // 5126: drawSketchyLine()
    // 5159: detectAndEraseElements()
// ----------------------------------------------------------------------------



// .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .

// LOW PRIORITY TASKS
// ----------------------------------------------------------------------------
// - Remove The Cdn Font Backup And Instead Use The Asset Library Fonts
// - Update Asset loader script to pull from new asset library json file
// - Remove CSS From the main HTML file and Instead Use The Asset Library CSS
//  - Refactor CSS to be in line with my CSS  conventions 
// ----------------------------------------------------------------------------



// .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .



// ITEMS SUCCESSFULLY OFFLOADED
// ----------------------------------------------------------------------------
// - Asset Loader Module        =   `./app-asset-loader.js`
// - Drawing Loader Module      =   `./drawing-loader.js`
// - Loading Screen Module      =   `./loading-screen.js`
// ----------------------------------------------------------------------------

// ITEMS CURRENTLY BEING WORKED ON & OFFLOADED / TESTED 
// ----------------------------------------------------------------------------
// - Canvas Utilities Module    =   `./canvas-utilities.js`
// - Canvas Utilities Module    =   `./canvas-utilities.js`
// - 
// ----------------------------------------------------------------------------


// .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .



// ============================================================================
// MODULE IMPORT STATEMENTS
// ============================================================================


// LOAD & PARSE |  Asset Loader Module
// ---------------------------------------------------------------------------
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
// ---------------------------------------------------------------------------

import {
    fetchAssetLibrary,
    loadFontsFromAssetLibrary,
    updateImagesFromAssetLibrary,
    preloadFonts,
    checkFontAvailability
} from './app-asset-loader.js';



// LOAD & PARSE |  Drawing Loader Module
// ----------------------------------------------------------------------------
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
// ----------------------------------------------------------------------------

import {
    fetchDrawings,
    loadDrawing,
    loadPlanImage,
    createDrawingButtons,
    updateDownloadLink
} from './drawing-loader.js';



// LOAD |  Loading Screen Module
// ----------------------------------------------------------------------------
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
// ----------------------------------------------------------------------------

import {
    initLoadingScreen,
    showLoadingScreen,
    hideLoadingScreen,
    showErrorMessage,
    hideErrorMessage
} from './loading-screen.js';



// LOAD |  Core Math Functions Library
// ----------------------------------------------------------------------------
// OFFLOADED | 13-Apr-2025
// Tested - Confirmed module is working as expected ✔
//
// Description:
// - This module contains core mathematical functions that serve as a library for the whole app.
// - These functions are used throughout the app and are essential for the app to function.
// ----------------------------------------------------------------------------

import {
    coreMathDistanceCalc,
    coreMathDistanceToLineSegment,
    coreMathGeomPolygonArea,
    coreMathGeomPolygonCentroid,
    coreMathGeomGenerateQuadraticCurvePoints,
    coreMathGeomBezierPoint,
    coreMathPseudoRandomValueGen
} from './coreMathLibrary.js';



// LOAD |  Markup Sketch Drawing Tools
// ----------------------------------------------------------------------------
// OFFLOADED | 13-Apr-2025
// Status: Initial Implementation
//
// Description:
// - This module contains functions for drawing sketchy markup elements
// - These functions handle rendering of markup with a hand-drawn appearance
// - Uses the core math library for calculations and randomization
// ----------------------------------------------------------------------------

import {
    initDrawingModule,
    updateDrawingConfig,
    getDrawingState,
    drawSketchyPath,
    drawSketchyRectangle,
    drawSketchyCircle,
    drawSketchyLine,
    drawSketchyPolygon,
    drawSketchySegment,
    drawSketchyArrowLine,
    drawArrow as importedDrawArrow,
    drawArc as importedDrawArc,
    drawSketchyText as importedDrawSketchyText,
    drawAllMarkupPaths as importedDrawAllMarkupPaths,
    calculateCurveEndDirection
} from './toolsMarkupSketchDrawingTools.js';



// .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .



// =============================================================================================
// JAVASCRIPT |  GLOBAL CONSTANTS
// Contains all global immutable CONSTANTS definitions for the application
// =============================================================================================
const MIN_ZOOM                         =     0.1;
const MAX_ZOOM                         =       2;
const ROUND_DIMENSIONS_ENABLED         =    true;
const ROUNDING_INTERVAL                =       5;
const CONFIRM_BUTTON_OFFSET_X_PC       =      10;
const CONFIRM_BUTTON_OFFSET_Y_PC       =     -10;
const CONFIRM_BUTTON_OFFSET_X_TOUCH    =      10;
const CONFIRM_BUTTON_OFFSET_Y_TOUCH    =     -25;


// =============================================================================================
// JAVASCRIPT |  GLOBAL VARIABLES 
// Contains all global variables definitions for the application
// =============================================================================================

const planCanvas                       = document.getElementById("planCanvas");
const ctx                              = planCanvas.getContext("2d");
const measureInfo                      = document.getElementById("measureInfo");
const cancelToolBtn                    = document.getElementById("cancelToolBtn");
const toolInstructionsOverlay          = document.getElementById("tool-instructions-overlay");
const toolInstructionsText             = document.getElementById("tool-instructions-text");
const finishBtn                        = document.getElementById("finishMeasurementBtn");
const menuTutorialOverlay              = document.getElementById("menu-tutorial-overlay");
const toolbar                          = document.getElementById("toolbar");

let isToolbarOpen                      = true;
const isTouchDevice                    = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
const markerRadius                     = isTouchDevice ? 36 : 24;
const baseLineWidth                    = isTouchDevice ? 3 : 2;

// GLOBAL VARIABLES |  Drawing Variables
// ----------------------------------------------------------------------------
let offsetX                            =     0, 
    offsetY                            =     0, 
    zoomFactor                         =     1;
let isDragging                         = false, 
    lastX                              =     0, 
    lastY                              =     0;
let isPinching                         = false, 
    pinchStartDist                     =     0, 
    pinchStartZoom                     =     1, 
    pinchMidpoint                      = { x: 0, y: 0 };

// GLOBAL VARIABLES |  Measuring Variables
// ----------------------------------------------------------------------------
let currentTool                        =  null;
let measuringPoints                    =    [];
let measurements                       =    [];
let isLinearMeasuring                  = false;
let linearMeasurementLocked            = false;
let isRectMeasuring                    = false;
let isRectDragging                     = false;
let rectStartPoint                     =  null;

// GLOBAL VARIABLES |  Plan Image Variables
// ----------------------------------------------------------------------------
let planImage                          = new Image();
planImage.crossOrigin                  = "anonymous";
let isImageLoaded                      =  false;
let naturalImageWidth                  =      0;
let naturalImageHeight                 =      0;
let scaleMetresPerPixel                =      0;
let currentDrawingScale                = "1:50";      //  ← Default scale if none provided
let currentDrawingSize                 =   "A1";      //  ← Default size if none provided

let hasShownLinearInstructions         = false;
let hasShownAreaInstructions           = false;

// -----------------------------------------
// ARC - STATE VARIABLES
// Added |  02-Apr-2025 - 1.8.5.
let isArcDrawing = false;
let currentArc = null;


// ============================================================================
// MARKUP TOOLSET MODULE - GLOBAL VARIABLES
// ============================================================================
// Technical pen properties for sketchy look
const sketchiness                      = 0.5;       //  ← 0 = clean, 1 = very sketchy
const pressureVariation                = 0.2;       //  ← Line width variation

// This variable is needed to interface with toolsMarkupSketchDrawingTools.js
let drawingState                       = {
    ctx: null,
    initialized: false
};

let isMarkupToolsetActive              = false;
let currentMarkupTool                  = 'pencil';
let markupColor                        = '#960000';  //  ← Changed default color to #960000
let markupLineWidth                    = 4;
let markupPaths                        = [];
let currentMarkupPath                  = null;

// Selection tool specific variables
let selectedElement                    = null;
let isMovingElement                    = false;
let moveStartPosition                  = null;
let selectionHandles                   = [];
let moveOffset                         = { x: 0, y: 0 };

// Arrow tool specific variables
let arrowState                         = 'idle';    //  ← idle, start, end, edit
let currentArrow                       = null;
let activeControlPoint                 = null;
let controlPoints                      = [];
let handlePoints                       = [];

// Shape tool variables
let isShapeDrawing                     = false;
let shapeStartPoint                    = null;
let currentShape                       = null;

// Text tool variables
let isTextPlacing                      = false;
let textPlacementPoint                 = null;
let editingTextElement                 = null;      //  ← Track the text element being edited

// Straight line tool variables
// Added in v1.8.5 - 02-Apr-2025
let isLineDrawing                      = false;
let currentLine                        = null;







(function() {


    // ========================================================================
    // STAGE 01 |  INITIALISATION SEQUENCE
    // ========================================================================
    async function initPlanVisionApp() {
        const appRoot = document.getElementById("app");
        if (!appRoot) {
            console.error("Root element #app is missing from the DOM. App cannot initialise.");
            return;
        }

        // Initialize loading screen
        initLoadingScreen();
        showLoadingScreen();

        try {
            // Load assets from centralized library
            const assetLibrary = await fetchAssetLibrary();
            if (assetLibrary) {
                loadFontsFromAssetLibrary(assetLibrary);
                updateImagesFromAssetLibrary(assetLibrary);
            } else {
                console.warn("Asset library failed to load. Using fallback assets.");
            }

            // Resize canvas before initializing drawing module
            resizeCanvas();

            // Initialize the markup drawing module with the canvas context
            const drawingModuleState = initDrawingModule(ctx, {
                sketchiness: sketchiness,
                pressureVariation: pressureVariation,
                markupColor: markupColor,
                markupLineWidth: markupLineWidth
            });
            
            if (!drawingModuleState.success) {
                console.warn("Markup drawing module failed to initialize properly:", drawingModuleState.message);
            } else {
                console.log("Markup drawing module initialized successfully");
                // Store initialized state locally
                drawingState.initialized = true;
                drawingState.ctx = ctx;
            }

            const drawings = await fetchDrawings();
            if (drawings) {
                // Pass the toolbar element and a callback function to handle drawing selection
                createDrawingButtons(drawings, toolbar, async (drawing) => {
                    try {
                        showLoadingScreen();

                        const drawingData = await loadDrawing(drawing);
                        const imageData = await loadPlanImage(drawingData.pngUrl);
                        
                        // Update the planImage
                        planImage = imageData.image;
                        naturalImageWidth = imageData.naturalWidth;
                        naturalImageHeight = imageData.naturalHeight;
                        
                        // Update drawing metadata
                        currentDrawingScale = drawingData.documentScale;
                        currentDrawingSize = drawingData.documentSize;
                        
                        // Update download link
                        updateDownloadLink(drawingData.pdfUrl, drawingData.documentName);
                        
                        // Set image loaded flag and reset view
                        isImageLoaded = true;
                        resetView();

                        hideLoadingScreen();
                    } catch (error) {
                        console.error("Error loading drawing:", error);
                        showErrorMessage("Failed to load drawing. Please try again.");
                        hideLoadingScreen();
                    }
                });
                
                const firstDrawingKey = Object.keys(drawings).find(
                    key => key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
                );
                if (firstDrawingKey) {
                    try {
                        const drawingData = await loadDrawing(drawings[firstDrawingKey]);
                        const imageData = await loadPlanImage(drawingData.pngUrl);
                        
                        // Update the planImage
                        planImage = imageData.image;
                        naturalImageWidth = imageData.naturalWidth;
                        naturalImageHeight = imageData.naturalHeight;
                        
                        // Update drawing metadata
                        currentDrawingScale = drawingData.documentScale;
                        currentDrawingSize = drawingData.documentSize;
                        
                        // Update download link
                        updateDownloadLink(drawingData.pdfUrl, drawingData.documentName);
                        
                        // Set image loaded flag and reset view
                        isImageLoaded = true;
                        resetView();
                    } catch (error) {
                        console.error("Error loading initial drawing:", error);
                        showErrorMessage("Failed to load initial drawing. Please try again.");
                    }
                }
            }

            attachEventListeners();
            handleInitialTutorialFlow();
            renderLoop();

            hideLoadingScreen();
        } catch (error) {
            console.error("Error during initialization:", error);
            showErrorMessage("Failed to initialize application. Please refresh the page.");
            hideLoadingScreen();
        }
    }
    

    // ========================================================================
    // FIRST-LOAD TUTORIAL FLOW
    // ========================================================================
    function handleInitialTutorialFlow() {
        if (isMobileOrTabletPortrait()) {
            // STEP 1: Show menu open immediately
            toolbar.classList.remove("collapsed");
            isToolbarOpen = true;

            // STEP 2: After 1 second, retract the menu
            setTimeout(() => {
                toolbar.classList.add("collapsed");
                isToolbarOpen = false;

                // STEP 3: Show the tooltip after a small delay
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
        if (window.screen.orientation && window.screen.orientation.type) {
            return window.screen.orientation.type.startsWith("portrait");
        }
        return window.innerHeight > window.innerWidth;
    }

    // ========================================================================
    // RENDER LOOP
    // ========================================================================
    function renderLoop() {
        // Request next frame first to ensure the loop continues
        requestAnimationFrame(renderLoop);
        
        // Skip rendering if image isn't loaded yet
        if (!isImageLoaded) return;

        ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);

        // - - - -  RENDER EFFECT |  Drop Shadow Effect Under Drawing  - - - -
            // Added v1.5.7. - 16-Mar-2025
            //   -  Sets drop shadow properties for the drawing
            //   -  Creates a subtle shadow effect creating the illusion of paper plan
            ctx.shadowColor            =     "rgba(\
                                            0,0,0, \
                                            0.2\)" ;
                ctx.shadowBlur         =         10;
                ctx.shadowOffsetX      =          5;
                ctx.shadowOffsetY      =          5;
        // - - - - - - - - - - - - - - - - -- - - - - - - - - - - - - - - - - -

        ctx.drawImage(planImage, 0, 0);
        ctx.restore();

        // Draw markup paths if any
        if (isMarkupToolsetActive || markupPaths.length > 0) {
            drawAllMarkupPathsInternal(ctx);
        }

        // Draw measurement tools and results
        measurements.forEach(m => {
            if (m.type === "linear") {
                drawLine(m.points, "blue");
                drawMarkers(m.points, "blue");
                drawLineLabel(m.points, m.distanceMM, "blue");
            } else if (m.type === "area") {
                drawPolygon(m.points, "rgba(255,0,0,0.2)", "red");
                drawMarkers(m.points, "red");
                drawAreaLabel(m);
                drawEdgeLabels(m.points, "red");
            } else if (m.type === "rectangle") {
                drawRectangle(m.points[0], m.points[1], "blue", "rgba(0,0,255,0.2)");
                drawMarkers(m.points, "blue");
                drawRectLabel(m.points[0], m.points[1]);
            }
        });

        if (currentTool === "linear" && isLinearMeasuring) {
            if (measuringPoints.length === 2) {
                drawLine(measuringPoints, "green");
                drawMarkers(measuringPoints, "green");
            } else if (measuringPoints.length === 1) {
                drawMarkers(measuringPoints, "green");
            }
        }

        if (currentTool === "area" && measuringPoints.length > 0) {
            drawOpenPolygon(measuringPoints, "red");
            drawMarkers(measuringPoints, "red");
        }

        if (currentTool === "rectangle" && isRectMeasuring && measuringPoints.length === 2) {
            drawRectangle(measuringPoints[0], measuringPoints[1], "blue");
            drawMarkers(measuringPoints, "blue");
        } else if (currentTool === "rectangle" && measuringPoints.length === 1) {
            drawMarkers(measuringPoints, "blue");
        }

        adjustConfirmButtonPosition();
    }

    // ========================================================================
    // DRAWING TOOLS FUNCTIONS
    // ========================================================================
    // ----------------------------------------------------
    // FUNCTION |  MEASUREMENT LINE DRAWING
    // - This section introduced in v1.8.3
    // Contains functions for drawing measurement lines and indicators on canvas
    // ----------------------------------------------------
    function drawLine(points, strokeStyle) {                                        // ← Draws measurement lines on canvas
        if (points.length < 2) return;                                              // ← Ensure two points exist before drawing
        ctx.save();                                                                  
        ctx.translate(offsetX, offsetY);                                            
        ctx.scale(zoomFactor, zoomFactor);                                          
        ctx.strokeStyle = strokeStyle;                                              
        ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;                        
        
        ctx.beginPath();                                                            
        ctx.moveTo(points[0].x, points[0].y);                                       
        ctx.lineTo(points[1].x, points[1].y);                                       
        ctx.stroke();                                                               
        
        const dx = points[1].x - points[0].x;                                       // ← Calculate horizontal difference
        const dy = points[1].y - points[0].y;                                       // ← Calculate vertical difference
        
        if (dy === 0 || dx === 0) {                                                 // ← If line is perfectly horizontal/vertical
            const indicatorSize = 5 / zoomFactor;                                   
            ctx.fillStyle = strokeStyle;                                            
            ctx.fillRect(points[0].x - indicatorSize/2, points[0].y - indicatorSize/2, indicatorSize, indicatorSize); // ← Add square marker
            ctx.fillRect(points[1].x - indicatorSize/2, points[1].y - indicatorSize/2, indicatorSize, indicatorSize); // ← Add square marker
        }
        
        ctx.restore();                                                              
    }

    // ----------------------------------------------------
    // FUNCTION |  MARKER DRAWING
    // - This section introduced in v1.7.0
    // Contains functions for drawing measurement markers and points
    // ----------------------------------------------------
    function drawMarkers(points, colour) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.strokeStyle = colour;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1 / zoomFactor;
        let doubleRadius = markerRadius * 2;
        points.forEach(pt => {
            ctx.beginPath();
            ctx.moveTo(pt.x - doubleRadius, pt.y);
            ctx.lineTo(pt.x + doubleRadius, pt.y);
            ctx.moveTo(pt.x, pt.y - doubleRadius);
            ctx.lineTo(pt.x, pt.y + doubleRadius);
            ctx.stroke();
        });
        ctx.restore();
    }

    // ----------------------------------------------------
    // FUNCTION |  RECTANGLE MEASUREMENT TOOL
    // - This section introduced in v1.6.0
    // Contains functions for drawing rectangle measurements and labels
    // ----------------------------------------------------
    function drawRectangle(start, end, strokeStyle, fillStyle = null) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;
        
        const width = end.x - start.x;
        const height = end.y - start.y;
        
        ctx.beginPath();
        ctx.rect(start.x, start.y, width, height);
        
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        ctx.stroke();
        ctx.restore();
    }

    // ----------------------------------------------------
    // FUNCTION |  RECTANGLE MEASUREMENT LABELS
    // - This section introduced in v1.6.3
    // Contains functions for drawing rectangle dimension labels and area calculations
    // ----------------------------------------------------
    function drawRectLabel(start, end) {
        const widthPx = Math.abs(end.x - start.x);
        const heightPx = Math.abs(end.y - start.y);
        const widthMm = Math.round(widthPx * scaleMetresPerPixel * 1000);
        const heightMm = Math.round(heightPx * scaleMetresPerPixel * 1000);
        const areaM2 = (widthPx * heightPx * scaleMetresPerPixel * scaleMetresPerPixel).toFixed(2);
        const mid = { 
            x: (start.x + end.x) / 2, 
            y: (start.y + end.y) / 2 
        };
        drawTextLabel(mid, `${areaM2} m²`, "blue");
        
        // Draw width label
        const widthMid = {
            x: (start.x + end.x) / 2,
            y: Math.min(start.y, end.y) - 10 / zoomFactor
        };
        drawTextLabel(widthMid, `${widthMm} mm`, "blue");
        
        // Draw height label
        const heightMid = {
            x: Math.max(start.x, end.x) + 10 / zoomFactor,
            y: (start.y + end.y) / 2
        };
        drawTextLabel(heightMid, `${heightMm} mm`, "blue");
    }


    // ----------------------------------------------------
    // FUNCTION |  DRAW POLIGONAL MEASUREMENT TOOL
    // - This section introduced in v1.3.0
    // Contains functions for drawing rectangle dimension labels and area calculations
    // ----------------------------------------------------

    function drawPolygon(points, fillStyle, strokeStyle) {
        if (points.length < 3) return;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // ----------------------------------------------------
    // FUNCTION |  OPEN POLYGON DRAWING
    // - This section introduced in v1.8.3
    // Contains function for drawing open polygon paths during measurement creation
    // ----------------------------------------------------
    function drawOpenPolygon(points, strokeStyle) {
        if (points.length < 2) return;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ----------------------------------------------------
    // FUNCTION |  APPLY LINE LABEL
    // - This section introduced in v1.2.0
    // Contains function for drawing line labels on canvas
    // ----------------------------------------------------
    function drawLineLabel(points, distMM, colour) {
        if (points.length < 2) return;
        const [A, B] = points;
        const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        drawTextLabel(mid, distMM + " mm", colour);
    }

    function drawAreaLabel(areaObj) {
        const c = coreMathGeomPolygonCentroid(areaObj.points);
        drawTextLabel(c, areaObj.areaM2 + " m²", "red");
    }

    function drawEdgeLabels(points, colour) {
        if (points.length < 2) return;
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.fillStyle = colour;
        ctx.font = (14 / zoomFactor) + "px sans-serif";
        const offsetVal = 10 / zoomFactor;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            let lengthPx = coreMathDistanceCalc(p1, p2);
            let lengthMm = lengthPx * scaleMetresPerPixel * 1000;
            if (ROUND_DIMENSIONS_ENABLED) {
                lengthMm = Math.round(lengthMm / ROUNDING_INTERVAL) * ROUNDING_INTERVAL;
            } else {
                lengthMm = Math.round(lengthMm);
            }
            ctx.fillText(lengthMm + " mm", mid.x + offsetVal, mid.y - offsetVal);
        }
        ctx.restore();
    }

    function drawTextLabel(pos, text, colour) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.fillStyle = colour;
        ctx.font = (18 / zoomFactor) + "px sans-serif";
        const offsetVal = 10 / zoomFactor;
        ctx.fillText(text, pos.x + offsetVal, pos.y - offsetVal);
        ctx.restore();
    }

    // ========================================================================
    // MEASUREMENT CALCULATIONS
    // ========================================================================
    // This section contains functions related to measurement calculations
    // used in the application. These functions help in converting canvas
    // coordinates to plan coordinates and finalizing measurements.


    // DEV NOTICE BASIC GEOMETRY CALCULATIONS
    // ------------------------------------------------------------------------
    // - All primary basic Math Functions moved to coreMathLibrary.js in v2.0.4


    // ----------------------------------------------------
    // FUNCTION |  CANVAS TO PLAN COORDINATES
    // - This section introduced in v1.1.0
    // - Converts canvas coordinates to plan coordinates
    // - Takes into account the current zoom factor and offsets
    // ----------------------------------------------------
    function canvasToPlanCoords(x, y) {
        return {
            x: (x - offsetX) / zoomFactor,
            y: (y - offsetY) / zoomFactor
        };
    }

    
    // ----------------------------------------------------
    // FUNCTION |  MEASUREMENT FINALIZATION
    // - This section introduced in v1.2.0
    // Handles finalizing different measurement types and storing their results
    // ----------------------------------------------------
    function finalizeMeasurement(type) {
        if (type === "linear" && measuringPoints.length === 2) {
            const [start, end] = measuringPoints;
            const pxDist = coreMathDistanceCalc(start, end);
            const rawMm = pxDist * scaleMetresPerPixel * 1000;
            let mmDist = ROUND_DIMENSIONS_ENABLED
                ? Math.round(rawMm / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
                : Math.round(rawMm);

            measurements.push({
                type: "linear",
                points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
                distanceMM: mmDist
            });
            
            // Reset all state variables
            measuringPoints = [];
            isLinearMeasuring = false;
            linearMeasurementLocked = false;
            updateMeasureInfo();
            hideCancelTool();
            currentTool = null;
            planCanvas.style.cursor = "default";
            
            // Hide confirm button after finalizing
            finishBtn.style.display = "none";
        } else if (type === "area" && measuringPoints.length > 2) {
            const areaPx2 = coreMathGeomPolygonArea(measuringPoints);
            const areaM2 = (areaPx2 * scaleMetresPerPixel * scaleMetresPerPixel).toFixed(2);

            measurements.push({
                type: "area",
                points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
                areaM2: areaM2
            });
            
            // Reset state
            measuringPoints = [];
            updateMeasureInfo();
            hideCancelTool();
            currentTool = null;
            planCanvas.style.cursor = "default";
            
            // Hide confirm button
            finishBtn.style.display = "none";
        } else if (type === "rectangle" && measuringPoints.length === 2) {
            const widthPx = Math.abs(measuringPoints[1].x - measuringPoints[0].x);
            const heightPx = Math.abs(measuringPoints[1].y - measuringPoints[0].y);
            const widthMm = ROUND_DIMENSIONS_ENABLED
                ? Math.round((widthPx * scaleMetresPerPixel * 1000) / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
                : Math.round(widthPx * scaleMetresPerPixel * 1000);
            const heightMm = ROUND_DIMENSIONS_ENABLED
                ? Math.round((heightPx * scaleMetresPerPixel * 1000) / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
                : Math.round(heightPx * scaleMetresPerPixel * 1000);
            const areaPx2 = widthPx * heightPx;
            const areaM2 = (areaPx2 * scaleMetresPerPixel * scaleMetresPerPixel).toFixed(2);

            measurements.push({
                type: "rectangle",
                points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
                widthMm: widthMm,
                heightMm: heightMm,
                areaM2: areaM2
            });
            
            // Reset state
            measuringPoints = [];
            isRectMeasuring = false;
            isRectDragging = false;
            updateMeasureInfo();
            hideCancelTool();
            currentTool = null;
            planCanvas.style.cursor = "default";
            
            // Hide confirm button
            finishBtn.style.display = "none";
        }
    }  


    // ========================================================================
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
    // EVENT LISTENERS & INTERACTION
    // ========================================================================


    function attachEventListeners() {
        document.getElementById("toggleToolbarBtn").addEventListener("click", toggleToolbar);

        const fullscreenBtn = document.getElementById("fullscreenBtn");
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener("click", () => {
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

        planCanvas.addEventListener("mousedown", onMouseDown);
        planCanvas.addEventListener("mousemove", onMouseMove);
        planCanvas.addEventListener("mouseup", onMouseUp);
        planCanvas.addEventListener("wheel", onWheel, { passive: false });
        planCanvas.addEventListener("touchstart", onTouchStart, { passive: false });
        planCanvas.addEventListener("touchmove", onTouchMove, { passive: false });
        planCanvas.addEventListener("touchend", onTouchEnd);
        planCanvas.addEventListener("touchcancel", onTouchEnd);

        // Add keyboard event listener for markup tools
        window.addEventListener("keydown", onKeyDown);

        window.addEventListener("resize", onResize);

        document.getElementById("resetViewBtn").addEventListener("click", resetView);
        document.getElementById("linearMeasureBtn").addEventListener("click", () => setTool("linear"));
        document.getElementById("rectMeasureBtn").addEventListener("click", () => setTool("rectangle"));
        document.getElementById("areaMeasureBtn").addEventListener("click", () => setTool("area"));
        document.getElementById("clearMeasurementsBtn").addEventListener("click", clearMeasurements);
        cancelToolBtn.addEventListener("click", cancelTool);

        finishBtn.addEventListener("click", () => {
            if (currentTool === "linear") finalizeMeasurement("linear");
            else if (currentTool === "area") finalizeMeasurement("area");
            else if (currentTool === "rectangle") finalizeMeasurement("rectangle");
            else if (currentMarkupTool === 'arc') {handlePointerDownArc(pos);
            }

        });

        // ========================================================================
        // MARKUP TOOLSET MODULE - EVENT LISTENERS
        // ========================================================================
        // Toggle between standard and markup toolsets
        const toggleMarkupBtn = document.getElementById("toggleMarkupToolsetBtn");
        if (toggleMarkupBtn) {
            toggleMarkupBtn.addEventListener("click", toggleMarkupToolset);
        }
        
        const returnToMeasuringBtn = document.getElementById("returnToMeasuringBtn");
        if (returnToMeasuringBtn) {
            returnToMeasuringBtn.addEventListener("click", returnToMeasuringTools);
        }
        
        // Markup tool buttons - add null checks for each element
        const selectionBtn = document.getElementById("markupSelectionBtn");
        if (selectionBtn) {
            selectionBtn.addEventListener("click", () => setMarkupTool("selection"));
        }
        
        const pencilBtn = document.getElementById("markupPencilBtn");
        if (pencilBtn) {
            pencilBtn.addEventListener("click", () => setMarkupTool("pencil"));
        }
        
        const eraserBtn = document.getElementById("markupEraserBtn");
        if (eraserBtn) {
            eraserBtn.addEventListener("click", () => setMarkupTool("eraser"));
        }
        
        // Add new straight line tool event listener
        const lineBtn = document.getElementById("markupLineBtn");
        if (lineBtn) {
            lineBtn.addEventListener("click", () => setMarkupTool("line"));
        }
        
        // Add new arc tool event listener
        const arcBtn = document.getElementById("markupArcBtn");
        if (arcBtn) {
            arcBtn.addEventListener("click", () => setMarkupTool("arc"));
        }
        
        const textBtn = document.getElementById("markupTextBtn");
        if (textBtn) {
            textBtn.addEventListener("click", () => setMarkupTool("text"));
        }
        
        const rectBtn = document.getElementById("markupRectBtn");
        if (rectBtn) {
            rectBtn.addEventListener("click", () => setMarkupTool("rectangle"));
        }
        
        const filledRectBtn = document.getElementById("markupFilledRectBtn");
        if (filledRectBtn) {
            filledRectBtn.addEventListener("click", () => setMarkupTool("filled-rectangle"));
        }
        
        const circleBtn = document.getElementById("markupCircleBtn");
        if (circleBtn) {
            circleBtn.addEventListener("click", () => setMarkupTool("circle"));
        }
        
        const arrowBtn = document.getElementById("markupArrowBtn");
        if (arrowBtn) {
            arrowBtn.addEventListener("click", () => setMarkupTool("arrow"));
        }
        
        const cancelMarkupBtn = document.getElementById("cancelMarkupToolBtn");
        if (cancelMarkupBtn) {
            cancelMarkupBtn.addEventListener("click", cancelMarkupTool);
        }
        
        // Color palette selection
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                markupColor = e.target.dataset.color;
            });
        });
        
        const lineWidthSlider = document.getElementById("markupLineWidthSlider");
        if (lineWidthSlider) {
            lineWidthSlider.addEventListener("input", (e) => {
                markupLineWidth = parseInt(e.target.value);
            });
        }
        
        // Action buttons
        const clearBtn = document.getElementById("markupClearBtn");
        if (clearBtn) {
            clearBtn.addEventListener("click", clearMarkup);
        }
        
        const saveBtn = document.getElementById("markupSaveBtn");
        if (saveBtn) {
            saveBtn.addEventListener("click", saveMarkupImage);
        }
        
        // Text dialog buttons
        const textCancelBtn = document.getElementById("markup-text-cancel");
        const textConfirmBtn = document.getElementById("markup-text-confirm");
        
        if (textCancelBtn) {
            textCancelBtn.addEventListener("click", cancelTextEntry);
        } else {
            console.error("Error: markup-text-cancel element not found in DOM");
        }
        
        if (textConfirmBtn) {
            textConfirmBtn.addEventListener("click", confirmTextEntry);
        } else {
            console.error("Error: markup-text-confirm element not found in DOM");
        }
        // End of Markup Toolset Module Event Listeners

        // Undo/Redo buttons
        const undoBtn = document.getElementById("markupUndoBtn");
        if (undoBtn) {
            undoBtn.addEventListener("click", undoMarkupAction);
        }
        
        const redoBtn = document.getElementById("markupRedoBtn");
        if (redoBtn) {
            redoBtn.addEventListener("click", redoMarkupAction);
        }
    }

    
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // FUNCTION |  Toggles Visibility Of The Tools Menu (Toolbar)

    function toggleToolbar() {
        if (menuTutorialOverlay.style.display === "block") {
            menuTutorialOverlay.style.display = "none";
        }
        if (currentTool) return;
        isToolbarOpen = !isToolbarOpen;
        toolbar.classList.toggle("collapsed", !isToolbarOpen);
    }



    // ----------------------------------------------------
    // FUNCTION |  MOUSE MOVEMENT HANDLER
    // - This section introduced in v1.8.3
    // Handles mouse movement for measurement tools, panning, and markup tools
    // ----------------------------------------------------
    function onMouseMove(e) {
        // Handle markup tools if active
        if (isMarkupToolsetActive) {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);

            // ----------------------------------------------------
            // EVENT HANDLER |  SELECTION TOOL MOVEMENT
            // - Processes movement events for selected elements
            // ----------------------------------------------------
            if (currentMarkupTool === 'selection' && isMovingElement && selectedElement) {
                // Move the selected element
                moveElement(selectedElement, pos);
                return;
            } 

            // ----------------------------------------------------
            // EVENT HANDLER |  FREEHAND DRAWING TOOLS
            // - Processes pencil strokes and eraser movements
            // ----------------------------------------------------
            else if (currentMarkupTool === 'pencil' && currentMarkupPath) {
                // Add point to the current path
                currentMarkupPath.points.push(pos);
                return;
            }
            else if (currentMarkupTool === 'eraser') {
                // For eraser, check if any element is under the cursor and erase
                const eraserRadius = markupLineWidth / 2;
                detectAndEraseElements(pos, eraserRadius);
                return;
            }

            // ----------------------------------------------------
            // EVENT HANDLER |  STRAIGHT LINE TOOL MOVEMENT
            // - Added in v1.8.5 (02-Apr-2025)
            // - Processes straight line drawing operations
            // ----------------------------------------------------
            else if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
                // Update the end point of the line
                currentLine.endPoint = pos;
                return;
            }

            // ----------------------------------------------------
            // EVENT HANDLER |  ARROW TOOL INTERACTIONS
            // - Manages arrow creation and control point manipulation
            // ----------------------------------------------------
            else if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
                // Update end point of the arrow
                currentArrow.endPoint = pos;
                
                // Calculate the distance and angle between start and end
                const dx = currentArrow.endPoint.x - currentArrow.startPoint.x;
                const dy = currentArrow.endPoint.y - currentArrow.startPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Calculate perpendicular offset for control points to create an S-curve
                const perpX = -Math.sin(angle);
                const perpY = Math.cos(angle);
                
                // Set control points with perpendicular offset to create S-curve
                const controlOffset = distance * 0.25; // Control point distance along the line
                
                // First control point - offset to one side
                currentArrow.control1 = {
                    x: currentArrow.startPoint.x + dx * 0.33 + perpX * controlOffset,
                    y: currentArrow.startPoint.y + dy * 0.33 + perpY * controlOffset
                };
                
                // Second control point - offset to the opposite side
                currentArrow.control2 = {
                    x: currentArrow.startPoint.x + dx * 0.66 - perpX * controlOffset,
                    y: currentArrow.startPoint.y + dy * 0.66 - perpY * controlOffset
                };
                
                return;
            }
            else if (currentMarkupTool === 'arrow' && arrowState === 'edit' && activeControlPoint) {
                // Move the active control point
                activeControlPoint.x = pos.x * zoomFactor + offsetX;
                activeControlPoint.y = pos.y * zoomFactor + offsetY;
                
                return;
            }

            // ----------------------------------------------------
            // EVENT HANDLER |  GEOMETRIC SHAPE CREATION
            // - Handles rectangle and circle drawing operations
            // ----------------------------------------------------
            else if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
                // Update the end point of the rectangle
                currentShape.endPoint = pos;
                return;
            }
            else if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
                // For circle, calculate radius based on distance from center
                const dx = pos.x - currentShape.centerPoint.x;
                const dy = pos.y - currentShape.centerPoint.y;
                const radius = Math.sqrt(dx * dx + dy * dy);
                
                // Update the radius of the circle
                currentShape.radius = radius;
                return;
            }
            
            // ----------------------------------------------------
            // EVENT HANDLER |  ARC TOOL MOVEMENT
            // - Processes arc drawing operations
            // ----------------------------------------------------
            else if (currentMarkupTool === 'arc' && isArcDrawing && currentArc) {
                // Real-time feedback: if controlPoint or endPoint not yet set, update a temp variable
                // so that your drawArc function can display it while dragging.
                if (!currentArc.controlPoint) {
                    // user is moving mouse to place control point
                    // you can store a 'hoverControl' property for preview
                    currentArc.hoverControl = pos;
                }
                else if (!currentArc.endPoint) {
                    // user has set controlPoint, is now moving to place endPoint
                    currentArc.hoverEnd = pos;
                }
            }
            
            return;
        }
        
        // ----------------------------------------------------
        // HANDLER SECTION |  STANDARD TOOLS MOVEMENT
        // - Processes pan and measurement tool interactions
        // ----------------------------------------------------
        
        // ----------------------------------------------------
        // EVENT HANDLER |  VIEW PANNING
        // - Manages canvas view position updates
        // ----------------------------------------------------
        if (isDragging) {
            offsetX += e.clientX - lastX;
            offsetY += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            return;
        }
        
        // ----------------------------------------------------
        // EVENT HANDLER |  LINEAR MEASUREMENT TOOL
        // - Manages point placement and angle snapping logic
        // ----------------------------------------------------
        if (currentTool === "linear" && isLinearMeasuring && measuringPoints.length > 0 && !linearMeasurementLocked) {
            const start = measuringPoints[0];
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);
            
            // Create a new object for the snapped position to avoid reference issues
            const snappedPos = {
                x: pos.x,
                y: pos.y
            };
            
            // Snap to horizontal or vertical within 15 degrees
            const dx = pos.x - start.x;
            const dy = pos.y - start.y;
            const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
            
            // Apply snapping logic
            if (angleDeg < 15 || angleDeg > 165) {
                snappedPos.y = start.y; // Horizontal snap
            } else if (Math.abs(angleDeg - 90) < 15) {
                snappedPos.x = start.x; // Vertical snap
            }
            
            // Add or update the second point
            if (measuringPoints.length === 1) {
                measuringPoints.push(snappedPos);
            } else {
                measuringPoints[1] = snappedPos;
            }
            
            // Update confirm button position
            adjustConfirmButtonPosition();
            return;
        }
        
        // ----------------------------------------------------
        // EVENT HANDLER |  RECTANGLE MEASUREMENT TOOL
        // - Manages corner placement and dimension updates
        // ----------------------------------------------------
        if (isRectMeasuring && isRectDragging) {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);
            if (measuringPoints.length === 1) {
                measuringPoints.push(pos); // Add second corner
            } else {
                measuringPoints[1] = pos; // Update second corner
            }
            return;
        }
    }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // FUNCTION |  Handles Mouse Click Events For Measurement Tools & Dragging
        
    function onMouseDown(e) {
        // Handle markup tools if active
        if (isMarkupToolsetActive) {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);

            if (currentMarkupTool === 'selection') {
                // Clear any previous selection
                if (!e.shiftKey) {
                    clearSelection();
                }
                
                // Try to select an element at the clicked position
                const element = findElementAt(pos);
                if (element) {
                    selectElement(element);
                    
                    // Prepare for moving if the element is clicked (not a handle)
                    isMovingElement = true;
                    moveStartPosition = pos;
                    
                    // Calculate offset from element position for smoother dragging
                    if (element.tool === 'pencil') {
                        // For paths, use the first point as reference
                        moveOffset = {
                            x: element.points[0].x - pos.x,
                            y: element.points[0].y - pos.y
                        };
                    } else if (element.tool === 'text') {
                        moveOffset = {
                            x: element.position.x - pos.x,
                            y: element.position.y - pos.y
                        };
                    }
                }
                
                // If no element is clicked, start a selection rectangle
                if (!isMovingElement) {
                    // Clear existing selection if shift key is not pressed
                    if (!e.shiftKey) {
                        clearSelection();
                    }
                }
                
                if (arrowState !== 'idle') {
                    clearArrowControls();
                    arrowState = 'idle';
                }
                
                return;
            }
            
            // If any other tool is selected, clear the selection
            if (currentMarkupTool !== 'selection') {
                clearSelection();
            }
            
            // Continue with existing tool handling...
            if (currentMarkupTool === 'pencil') {
                currentMarkupPath = {
                    tool: 'pencil',
                    color: markupColor,
                    lineWidth: markupLineWidth,
                    points: [pos]
                };
                return;
            }
            else if (currentMarkupTool === 'eraser') {
                // Start erasing from this position
                const eraserRadius = markupLineWidth / 2;
                detectAndEraseElements(pos, eraserRadius);
                return;
            }
            else if (currentMarkupTool === 'arrow') {
                if (arrowState === 'idle') {
                    // Start a new arrow
                    currentArrow = {
                        tool: 'arrow',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        control1: pos,
                        control2: pos
                    };
                    arrowState = 'end';
                    planCanvas.classList.remove('markup-arrow-start');
                    planCanvas.classList.add('markup-arrow-end');
                    return;
                } 
                else if (arrowState === 'edit') {
                    // Check if a control point was clicked
                    for (const point of controlPoints) {
                        // Get the screen position of this control point
                        const screenX = point.x;
                        const screenY = point.y;
                        
                        // Convert cursor position to screen coordinates
                        const cursorScreenX = pos.x * zoomFactor + offsetX;
                        const cursorScreenY = pos.y * zoomFactor + offsetY;
                        
                        // Calculate distance in screen pixels
                        const dx = screenX - cursorScreenX;
                        const dy = screenY - cursorScreenY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        // Use a fixed pixel distance for easier selection regardless of zoom
                        if (distance < 20) { // 20 pixel hit radius
                            activeControlPoint = point;
                            return;
                        }
                    }
                    
                    // If no control point was clicked, start a new arrow
                    clearArrowControls();
                    currentArrow = {
                        tool: 'arrow',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        control1: pos,
                        control2: pos
                    };
                    arrowState = 'end';
                    planCanvas.classList.remove('markup-arrow-edit');
                    planCanvas.classList.add('markup-arrow-end');
                    return;
                }
            }
            else if (currentMarkupTool === 'arc') {
                handlePointerDownArc(pos);
            }
            else if (currentMarkupTool === 'text') {
                // Check if we clicked on an existing text element first
                const existingTextElement = findTextElementAt(pos);
                if (existingTextElement) {
                    // Start editing the existing text
                    editingTextElement = existingTextElement;
                    textPlacementPoint = existingTextElement.position;
                    isTextPlacing = true;
                    showTextDialog(e.clientX, e.clientY, existingTextElement.text);
                } else {
                    // Create a new text element
                    isTextPlacing = true;
                    textPlacementPoint = pos;
                    editingTextElement = null;
                    showTextDialog(e.clientX, e.clientY);
                }
                return;
            }
            
            // ----------------------------------------------------
            // EVENT HANDLER | STRAIGHT LINE TOOL
            // - Added in v1.8.5 (02-Apr-2025)
            // - Handles start of straight line drawing
            // ----------------------------------------------------
            else if (currentMarkupTool === 'line') {
                if (!isLineDrawing) {
                    // Start drawing a new straight line
                    isLineDrawing = true;
                    currentLine = {
                        tool: 'line',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        // Store seed for consistent randomness when redrawing
                        seed: Math.floor(Math.random() * 10000)
                    };
                    return;
                }
            }
            else if (currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') {
                if (!isShapeDrawing) {
                    // Start drawing a new rectangle
                    isShapeDrawing = true;
                    currentShape = {
                        tool: 'rectangle',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        filled: currentMarkupTool === 'filled-rectangle'
                    };
                    return;
                }
            }
            else if (currentMarkupTool === 'circle') {
                if (!isShapeDrawing) {
                    // Start drawing a new circle with center point approach
                    isShapeDrawing = true;
                    currentShape = {
                        tool: 'circle',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        centerPoint: pos,
                        radius: 0 // Will be updated during mouse move
                    };
                    // Store the seed for consistent randomness when redrawing
                    currentShape.seed = Math.floor(Math.random() * 10000);
                    return;
                }
            }
            
            return;
        }
        
        // Standard measurement tools handling
        if (currentTool === "linear") {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);
            
            if (!measuringPoints.length) {
                // Starting a new measurement - set the first point
                measuringPoints = [pos]; // Reset array with just first point
                isLinearMeasuring = true;
                linearMeasurementLocked = false;
                finishBtn.style.display = "none"; // Hide confirm button until second point is placed
            } 
            else if (measuringPoints.length === 1 && !linearMeasurementLocked) {
                // Setting the second point of measurement
                const start = measuringPoints[0];
                
                // Create a new point object to avoid reference issues
                const secondPoint = {
                    x: pos.x,
                    y: pos.y
                };
                
                // Apply snapping to horizontal or vertical
                const dx = secondPoint.x - start.x;
                const dy = secondPoint.y - start.y;
                const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
                
                if (angleDeg < 15 || angleDeg > 165) {
                    secondPoint.y = start.y; // Horizontal snap
                } else if (Math.abs(angleDeg - 90) < 15) {
                    secondPoint.x = start.x; // Vertical snap
                }
                
                // Add the second point
                measuringPoints.push(secondPoint);
                linearMeasurementLocked = true;
                
                // Show the confirm button immediately after second point is set
                adjustConfirmButtonPosition();
                finishBtn.style.display = "block";
            }
            return;
        }
        
        if (currentTool === "area") {
            measuringPoints.push(canvasToPlanCoords(e.offsetX, e.offsetY));
            return;
        }
        
        if (currentTool === "rectangle") {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);
            if (!isRectMeasuring) {
                measuringPoints = [pos];
                isRectMeasuring = true;
                isRectDragging = true; // Start dragging immediately
            }
            return;
        }
        
        // Default drag behavior (pan)
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }

    function onWheel(e) {
        e.preventDefault();
        const zoomChange = e.deltaY * -0.001;
        applyZoom(zoomChange, e.offsetX, e.offsetY);
        
        // Update handle positions after zooming
        updateAllHandlePositions();
    }

    // ========================================================================
    // FUNCTION |  DRAW SKETCHY ARC
    // Added in v1.8.7 - 02-Apr-2025
    // ========================================================================

    function drawSketchyArc(start, control, end) {
        const points = coreMathGeomGenerateQuadraticCurvePoints(start, control, end);
        for (let i = 0; i < points.length - 1; i++) {
            drawSketchyLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        }
    }

    //-------------------------------------------
    // 1) ARC TOOL - Handle Pointer Down
    //-------------------------------------------
    function handlePointerDownArc(pos) {
        // If we're not currently drawing an arc, start a new one
        if (!isArcDrawing) {
            isArcDrawing = true;
            currentArc = {
                tool: 'arc',
                color: markupColor,
                lineWidth: markupLineWidth,
                startPoint: pos,       // first click
                controlPoint: null,    // second click
                endPoint: null,        // third click
                seed: Math.floor(Math.random() * 10000)
            };
        } 
        // If we have a start point but no control point yet, set it now
        else if (currentArc && !currentArc.controlPoint) {
            currentArc.controlPoint = pos;
        } 
        // If we have both start point and control point, set the end point
        // and finalise the arc
        else if (currentArc && !currentArc.endPoint) {
            currentArc.endPoint = pos;
            
            // Arc is complete; add to markup paths
            markupPaths.push(currentArc);
            
            // Optionally save state for undo/redo
            saveMarkupState();
            
            // Reset
            currentArc = null;
            isArcDrawing = false;
        }
    }

    //-------------------------------------------
    // 2) ARC TOOL - Drawing Function
    //-------------------------------------------
    // Renders the arc on the canvas
    function drawArc(context, arcPath) {
        // Check that we have all three points
        if (!arcPath.startPoint || !arcPath.controlPoint || !arcPath.endPoint) return;

        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Set stroke style
        context.lineWidth = arcPath.lineWidth;
        context.strokeStyle = arcPath.color;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // Call your existing "drawSketchyArc"
        drawSketchyArc(arcPath.startPoint, arcPath.controlPoint, arcPath.endPoint);

        context.restore();
    }

    //-------------------------------------------
    // 3) ARC TOOL - Eraser/Hit-Testing Function
    //-------------------------------------------
    // Finds approximate min distance between a point and a quadratic curve
    // so your eraser and selection can detect arcs
    function drawGeomMathDistanceToQuadraticCurve(x1, y1, cx, cy, x2, y2, px, py, steps = 50) {
        let minDist = Infinity;
        for (let i = 0; i <= steps; i++) {
            let t = i / steps;
            // Quadratic bezier param
            let qx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
            let qy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
            let dx = px - qx;
            let dy = py - qy;
            let coreMathDistanceCalc = Math.sqrt(dx * dx + dy * dy);
            if (coreMathDistanceCalc < minDist) minDist = coreMathDistanceCalc;
        }
        return minDist;
    }

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // FUNCTION |  Touch Interactions Tool Controls & Behaviour Functions

    // Replace the incomplete touch section with this complete version
    function onTouchStart(e) {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            const rect = planCanvas.getBoundingClientRect();
            const touchEvent = {
                offsetX: t.clientX - rect.left,
                offsetY: t.clientY - rect.top,
                clientX: t.clientX,
                clientY: t.clientY,
                // Add standard mouse event properties
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false
            };
            onMouseDown(touchEvent);
        } else if (e.touches.length === 2) {
            isPinching = true;
            pinchStartDist = touchDistance(e.touches[0], e.touches[1]);
            pinchMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
            pinchStartZoom = zoomFactor;
        }
    }

    function onTouchMove(e) {
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();
            const newDist = touchDistance(e.touches[0], e.touches[1]);
            const zoomDiff = (newDist - pinchStartDist) * 0.005;
            const newZoom = pinchStartZoom + zoomDiff;
            const rect = planCanvas.getBoundingClientRect();
            const midX = pinchMidpoint.x - rect.left;
            const midY = pinchMidpoint.y - rect.top;
            setZoom(newZoom, midX, midY);
            
            // Update handle positions after zooming
            updateAllHandlePositions();
        } else if (e.touches.length === 1 && !isPinching) {
            const t = e.touches[0];
            const rect = planCanvas.getBoundingClientRect();
            const touchEvent = {
                clientX: t.clientX,
                clientY: t.clientY,
                offsetX: t.clientX - rect.left,
                offsetY: t.clientY - rect.top,
                // Add standard mouse event properties
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false
            };
            onMouseMove(touchEvent);
        }
    }

    function onTouchEnd(e) {
        if (e.touches.length === 0) {
            // Create a touch end event
            const touchEvent = {
                clientX: lastX, // Use the last known position
                clientY: lastY,
                offsetX: lastX - planCanvas.getBoundingClientRect().left,
                offsetY: lastY - planCanvas.getBoundingClientRect().top,
                // Add standard mouse event properties
                preventDefault: () => e.preventDefault(),
                stopPropagation: () => e.stopPropagation(),
                ctrlKey: e.ctrlKey || false
            };
            onMouseUp(touchEvent);
        }
        if (e.touches.length < 2) isPinching = false;
        isDragging = false;
    }

    // ========================================================================
    // VIEW & SCALE CONTROLS
    // ========================================================================
    // ----------------------------------------------------
    // FUNCTION |  ZOOM CONTROLS
    // - This section introduced in v1.8.3
    // Handles zoom operations including setting zoom level and maintaining focus point
    // ----------------------------------------------------
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

    // ----------------------------------------------------
    // FUNCTION |  CANVAS MANAGEMENT
    // - This section introduced in v1.8.3
    // Handles canvas resizing to maintain appropriate display dimensions
    // ----------------------------------------------------
    function resizeCanvas() {
        planCanvas.width = window.innerWidth;
        planCanvas.height = window.innerHeight + 10;    // ← Updated To Top Cropping At Bottom
    }

    // ----------------------------------------------------
    // FUNCTION |  VIEW RESET & SCALE CALIBRATION
    // - This section introduced in v1.8.3
    // Handles resetting view position and calculating measurement scale based on drawing metadata
    // ----------------------------------------------------
    function resetView() {
        const cw = planCanvas.width;
        const ch = planCanvas.height;
        const iw = planImage.width;
        const ih = planImage.height;

        zoomFactor = Math.min(cw / iw, ch / ih) * 0.85;    // ← Updated To Show Whole Drawing When Loaded
        offsetX = (cw - iw * zoomFactor) / 2;
        offsetY = (ch - ih * zoomFactor) / 2;

        // ---------------------------------------------------------------------------------------------------------
        // MEASUREMENT SCALE & ACCURACY
        // ---------------------------------------------------------------------------------------------------------
        // - Defines The Scale Conversion From Pixels To Real-World Millimetres.  
        // - Ensures All Measurements Remain Accurate Regardless Of Zoom Level.  
        // - Critical To The Correct Functioning Of The Measuring Tools.  
        // ---------------------------------------------------------------------------------------------------------
            // -----------------------------------------------------------------------------------------------------
            // A-SERIES PAPER SIZES (MM)
            // -----------------------------------------------------------------------------------------------------
            // A0 Paper | 1189 × 841 mm
            // A1 Paper | 841 × 594 mm
            // A2 Paper | 594 × 420 mm
            // A3 Paper | 420 × 297 mm
            // A4 Paper | 297 × 210 mm

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

        // ---------------------------------------------------------------------------------------------------------

        clearMeasurements();
        
        // Update handle positions after resetting view
        updateAllHandlePositions();
    }

    // ========================================================================
    // TOOL & MEASUREMENT HANDLING
    // ========================================================================
    // ----------------------------------------------------
    // FUNCTION |  TOOL SELECTION
    // - This section introduced in v1.8.3
    // Handles tool activation and initial setup for different measurement tools
    // ----------------------------------------------------
    function setTool(toolName) {
        currentTool = toolName;
        measuringPoints = [];

        if (toolName === "linear") {
            planCanvas.style.cursor = "crosshair";
            isLinearMeasuring = false;
            linearMeasurementLocked = false;
            showCancelTool();
            showToolInstructions("linear");
        } else if (toolName === "area") {
            planCanvas.style.cursor = "default";
            showCancelTool();
            showToolInstructions("area");
        } else if (toolName === "rectangle") {
            planCanvas.style.cursor = "crosshair";
            isRectMeasuring = false;
            showCancelTool();
            showToolInstructions("rectangle");
        } else {
            planCanvas.style.cursor = "default";
            hideCancelTool();
        }
    }

    // ----------------------------------------------------
    // FUNCTION |  TOOL CANCELLATION
    // - This section introduced in v1.8.3
    // Handles cancellation of active tools and resetting tool state
    // ----------------------------------------------------
    function cancelTool() {
        currentTool = null;
        measuringPoints = [];
        isLinearMeasuring = false;
        linearMeasurementLocked = false;
        isRectMeasuring = false;
        isRectDragging = false;
        hideCancelTool();
        planCanvas.style.cursor = "default";
        // Hide confirm button
        finishBtn.style.display = "none";
    }

    // ----------------------------------------------------
    // FUNCTION |  MEASUREMENT MANAGEMENT
    // - This section introduced in v1.8.3
    // Handles clearing measurements and updating measurement information display
    // ----------------------------------------------------
    function clearMeasurements() {
        measurements = [];
        measuringPoints = [];
        updateMeasureInfo();
        cancelTool();
    }

    function showCancelTool() {
        cancelToolBtn.style.display = "block";
    }

    function hideCancelTool() {
        cancelToolBtn.style.display = "none";
    }

    function updateMeasureInfo() {
        if (!measurements.length) {
            measureInfo.innerHTML = "No measurements yet.";
            return;
        }
        let txt = "";
        measurements.forEach((m, i) => {
            if (m.type === "linear") {
                txt += `Measurement ${i + 1} (Line): ${m.distanceMM} mm<br/>`;
            } else if (m.type === "area") {
                txt += `Measurement ${i + 1} (Area): ${m.areaM2} m²<br/>`;
            } else if (m.type === "rectangle") {
                txt += `Measurement ${i + 1} (Rectangle): ${m.widthMm} mm × ${m.heightMm} mm = ${m.areaM2} m²<br/>`;
            }
        });
        measureInfo.innerHTML = txt;
    }

    function adjustConfirmButtonPosition() {
        if (!finishBtn || !currentTool) {
            finishBtn.style.display = "none";
            return;
        }
        if ((currentTool === "linear" || currentTool === "area" || currentTool === "rectangle") && measuringPoints.length > 0) {
            finishBtn.style.display = "block";
            const lastPt = measuringPoints[measuringPoints.length - 1];
            const sx = (lastPt.x * zoomFactor) + offsetX;
            const sy = (lastPt.y * zoomFactor) + offsetY;

            if (isTouchDevice) {
                finishBtn.style.left = (sx + CONFIRM_BUTTON_OFFSET_X_TOUCH) + "px";
                finishBtn.style.top = (sy + CONFIRM_BUTTON_OFFSET_Y_TOUCH) + "px";
            } else {
                finishBtn.style.left = (sx + CONFIRM_BUTTON_OFFSET_X_PC) + "px";
                finishBtn.style.top = (sy + CONFIRM_BUTTON_OFFSET_Y_PC) + "px";
            }
        } else {
            finishBtn.style.display = "none";
        }
    }

    // ========================================================================
    // TOOL INSTRUCTIONS
    // ========================================================================
    // ----------------------------------------------------
    // FUNCTION |  INSTRUCTION DISPLAY
    // - This section introduced in v1.8.3
    // Handles displaying appropriate instructions for each measurement tool
    // ----------------------------------------------------
    function showToolInstructions(tool) {
        if (tool === "linear" && !hasShownLinearInstructions) {
            hasShownLinearInstructions = true;
            toolInstructionsText.innerText =
                "LINEAR TOOL:\n\n" +
                "This Tool Functions As A Tape Measure\n" +
                " \n" +
                "1. Click to set the starting point.\n" +
                "2. Click and drag the dimension line\n" +
                "3. Press 'Confirm' to finalise or 'Cancel Tool' to exit.";
            displayInstructionsOverlay();
        }
        if (tool === "area" && !hasShownAreaInstructions) {
            hasShownAreaInstructions = true;
            toolInstructionsText.innerText =
                "AREA TOOL:\n\n" +
                "1. Click each corner in turn.\n" +
                "2. Press 'Confirm' to close the shape.\n" +
                "3. Use 'Cancel Tool' to exit without finishing.";
            displayInstructionsOverlay();
        }
        if (tool === "rectangle" && !hasShownAreaInstructions) { // Moved outside
            hasShownAreaInstructions = true; // Using same flag for simplicity
            toolInstructionsText.innerText =
                "RECTANGLE TOOL:\n\n" +
                "1. Click and drag diagonally to draw a rectangle.\n" +
                "2. Release to set the size.\n" +
                "3. Press 'Confirm' to finalise or 'Cancel Tool' to exit.";
            displayInstructionsOverlay();
        }
    }

    // ----------------------------------------------------
    // FUNCTION |  OVERLAY DISPLAY
    // - This section introduced in v1.3.0
    // Handles showing and hiding instruction overlays with appropriate animations
    // ----------------------------------------------------
    function displayInstructionsOverlay() {
        toolInstructionsOverlay.style.display = "flex";
        function dismissOverlay() {
            clearTimeout(timeoutId);
            toolInstructionsOverlay.classList.add("fade-out");
            setTimeout(() => {
                toolInstructionsOverlay.style.display = "none";
                toolInstructionsOverlay.classList.remove("fade-out");
                toolInstructionsOverlay.removeEventListener("click", dismissOverlay);
            }, 1000);
        }
        toolInstructionsOverlay.addEventListener("click", dismissOverlay);
        var timeoutId = setTimeout(dismissOverlay, 3000);
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

    // ========================================================================
    // RESIZE
    // ========================================================================
    function onResize() {
        resizeCanvas();
        
        // Update handle positions after resize
        updateAllHandlePositions();
    }

    /*************************************************************************
     MARKUP TOOLSET MODULE - FUNCTIONS
    *************************************************************************/

    // Toggle between standard measurement tools and markup tools
    function toggleMarkupToolset() {
        isMarkupToolsetActive = true;
        
        // Reset any inline styles on the color palette and swatches to ensure proper layout
        const colorPalette = document.querySelector('.color-palette');
        if (colorPalette) {
            // Reset flex layout on the container
            colorPalette.style.display = 'flex';
            colorPalette.style.flexWrap = 'wrap';
            
            // Reset any inline styles on individual swatches
            colorPalette.querySelectorAll('.color-swatch').forEach(swatch => {
                // Preserve only the background-color inline style
                const bgColor = swatch.style.backgroundColor;
                const isActive = swatch.classList.contains('active');
                const border = swatch.style.border; // Preserve border for white color
                
                // Clear all inline styles
                swatch.removeAttribute('style');
                
                // Re-apply only what's needed
                swatch.style.backgroundColor = bgColor;
                if (border && bgColor === 'rgb(255, 255, 255)') {
                    swatch.style.border = '1px solid #CCCCCC';
                }
            });
        }
        
        // Reset all markup tool buttons to their default style
        document.querySelectorAll("#markup-toolset .tool-button").forEach(btn => {
            if (btn.id !== 'cancelMarkupToolBtn') {
                // Remove any inline styles that might override the CSS
                btn.style.opacity = '';
                btn.style.backgroundColor = '';
            }
        });
        
        // Show markup tools container
        document.getElementById("markup-toolset").style.display = "block";
        
        // Set default line width to 50% of slider range
        const slider = document.getElementById("markupLineWidthSlider");
        markupLineWidth = parseInt(slider.value);
        
        // Hide sections of the main menu
        const drawingButtonContainer = document.querySelector(".drawing-button-container");
        if (drawingButtonContainer) {
            drawingButtonContainer.style.display = "none";
        }
        
        // Hide all section headers/buttons except those in the markup toolset
        document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
            if (!header.closest("#markup-toolset")) {
                header.style.display = "none";
                
                // Hide all elements after this header until next header
                let nextElem = header.nextElementSibling;
                while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                    if (nextElem.id !== "markup-toolset") {
                        nextElem.style.display = "none";
                    }
                    nextElem = nextElem.nextElementSibling;
                }
            }
        });
        
        // Hide toggle button itself
        document.getElementById("toggleMarkupToolsetBtn").style.display = "none";
        
        // Reset any active measuring tools
        cancelTool();
        
        // Reset any active markup tool to ensure no tool is selected by default
        cancelMarkupTool();
        
        // Reset cursor to default hand so user can pan around first
        planCanvas.className = "";
        currentMarkupTool = null;
        
        // Hide the cancel markup tool button since no tool is active
        document.getElementById('cancelMarkupToolBtn').style.display = 'none';
    }

    // Return to standard measuring tools
    function returnToMeasuringTools() {
        // Cancel any active markup tool first
        cancelMarkupTool();
        
        isMarkupToolsetActive = false;
        
        // Hide markup tools container
        document.getElementById("markup-toolset").style.display = "none";
        
        // Show all previously hidden sections
        const drawingButtonContainer = document.querySelector(".drawing-button-container");
        if (drawingButtonContainer) {
            drawingButtonContainer.style.display = "block";
        }
        
        // Show all section headers and their content
        document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
            header.style.display = "block";
            
            // Only unhide elements if they're not within the markup toolset
            if (!header.closest("#markup-toolset")) {
                // Show all elements after this header until next header
                let nextElem = header.nextElementSibling;
                while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                    if (nextElem.id !== "markup-toolset") {
                        nextElem.style.display = "block";
                    }
                    nextElem = nextElem.nextElementSibling;
                }
            }
        });
        
        // Show markup toggle button
        document.getElementById("toggleMarkupToolsetBtn").style.display = "block";
        
        // Reset cursor
        planCanvas.className = "";
        
        // Ensure any active tools are cleared to allow toolbar toggling
        currentTool = null;
        currentMarkupTool = null;
    }

    // Set the active markup tool
    function setMarkupTool(tool) {
        // If no tool is selected (null), cancel the tool
        if (tool === null) {
            cancelMarkupTool();
            return;
        }
        
        // Show the cancel button only when a tool is selected
        document.getElementById('cancelMarkupToolBtn').style.display = 'block';
        document.getElementById('cancelMarkupToolBtn').style.backgroundColor = '#d9534f'; // Keep the cancel button red
        
        currentMarkupTool = tool;
        
        // Reset state variables
        currentMarkupPath = null;
        isShapeDrawing = false;
        shapeStartPoint = null;
        currentShape = null;
        isTextPlacing = false;
        textPlacementPoint = null;
        isLineDrawing = false; // For straight line tool
        currentLine = null;    // For straight line tool
        
        // Reset arrow-specific variables if changing from arrow tool
        if (currentMarkupTool !== 'arrow') {
            clearArrowControls();
            arrowState = 'idle';
        }
        
        // Clear any selection if not switching to selection tool
        if (tool !== 'selection') {
            clearSelection();
        }
        
        // Update cursor based on selected tool
        planCanvas.className = "";
        if (tool === 'selection') {
            planCanvas.classList.add('markup-selection');
            showMarkupInstructions('selection');
        } else if (tool === 'pencil') {
            planCanvas.classList.add('markup-pencil');
            showMarkupInstructions('pencil');
        } else if (tool === 'eraser') {
            planCanvas.classList.add('markup-eraser');
            showMarkupInstructions('eraser');
        } else if (tool === 'arrow') {
            planCanvas.classList.add('markup-arrow-start');
            showMarkupInstructions('arrow');
        } else if (tool === 'text') {
            planCanvas.classList.add('markup-text');
            showMarkupInstructions('text');
        } else if (tool === 'line') {
            planCanvas.classList.add('markup-line');
            showMarkupInstructions('line');
        } else if (tool === 'rectangle') {
            planCanvas.classList.add('markup-rectangle');
            showMarkupInstructions('rectangle');
        } else if (tool === 'filled-rectangle') {
            planCanvas.classList.add('markup-filled-rectangle');
            showMarkupInstructions('filled-rectangle');
        } else if (tool === 'circle') {
            planCanvas.classList.add('markup-circle');
            showMarkupInstructions('circle');
        } else if (tool === 'arc') {
            planCanvas.classList.add('markup-arc');
            showMarkupInstructions('arc');
        }
        
        // Update active tool button styles
        updateToolButtonStyles(tool);
    }

    // Clear all markup drawings
    function clearMarkup() {
        if (confirm('Are you sure you want to clear all markup drawings?')) {
            saveMarkupState(); // Save state before clearing
            markupPaths = [];
            clearArrowControls();
            updateUndoRedoButtons(); // Update button states
        }
    }

    // Save markup image with drawings
    function saveMarkupImage() {
        // Hide control points for clean download
        clearArrowControls();
        
        // Create a temporary canvas to save the image with drawings
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = planCanvas.width;
        tempCanvas.height = planCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the plan image
        tempCtx.save();
        tempCtx.translate(offsetX, offsetY);
        tempCtx.scale(zoomFactor, zoomFactor);
        tempCtx.drawImage(planImage, 0, 0);
        tempCtx.restore();
        
        // Draw all markup paths (includes arcs if drawArc is handled in drawAllMarkupPaths)
        drawAllMarkupPaths(tempCtx);
        
        // Create a download link
        const link = document.createElement('a');
        link.download = 'planvision-markup.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }

    // Text entry functions
    function showTextDialog(x, y, initialText = '') {
        const dialog = document.getElementById('markup-text-dialog');
        // Position the dialog above the text so it does not cover the text
        dialog.style.left = x + 'px';
        dialog.style.top = (y - 160) + 'px';
        dialog.style.display = 'block';
        const textInput = document.getElementById('markup-text-input');
        textInput.value = initialText;
        textInput.focus();
        
        // Select all text when editing
        if (initialText) {
            textInput.select();
        }
    }

    function cancelTextEntry() {
        document.getElementById('markup-text-dialog').style.display = 'none';
        isTextPlacing = false;
        textPlacementPoint = null;
        editingTextElement = null;
        
        // Reset button text back to "Add Text" for next time
        document.getElementById('markup-text-confirm').textContent = 'Add Text';
    }


    /*************************************************************************
     ADDITIONAL: DRAWING ALL MARKUP PATHS (INCL. ARC)
    - Place this function wherever you keep your rendering code. 
    - It ensures arcs are drawn in the same pass as other shapes.
    *************************************************************************/

    function drawAllMarkupPathsInternal(context) {
        // Instead of duplicating all the drawing logic, use the imported function via the wrapper
        drawAllMarkupPaths(context);
    }

    /*************************************************************************
     ADDITIONAL: ARC DRAWING EXAMPLE
    - If you haven't defined drawArc yet, here's a simple version.
    *************************************************************************/

    function drawArc(context, arcPath) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawArc function is now used instead
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context 
        updateDrawingConfig({ ctx: context });
        
        // Call the imported function (with different name to prevent recursion)
        importedDrawArc(arcPath);
        
        // Restore canvas state
        context.restore();
    }


    // ========================================================================
    // - - - - - - - - - - - - - - - - - - - -  - - - - - - - - - - 
    // MARKUP FEATURE | MARKUP HANDWRITTEN STYLE TEXT EDITING AND RENDERING SYSTEM
    // Comprehensive system for adding, editing, and rendering text annotations on the canvas
    // - Text Creacted in a handwritten sketchy style to ensure its easy to differenciate from the plan printed text
    // - Text can be edited and positioned anywhere on the plan and edited after creation
    // - Text size can be adjusted after creation using the editor
    // - Text can be edited and positioned anywhere on the plan
    // - Text can be deleted


    // ============================================================
    // PRIMARY FUNCTION | TEXT RENDERING
    // Draws text elements on the canvas with proper styling and positioning
    function drawSketchyText(context, textObj) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyText function is now used instead
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context and create options
        updateDrawingConfig({ ctx: context });
        const options = {
            color: textObj.color,
            sketchiness: 0.5
        };
        
        // Call the imported function
        importedDrawSketchyText(textObj, options);
        
        // Restore canvas state
        context.restore();
    }

    // ============================================================
    // PRIMARY FUNCTION | TEXT PLACEMENT INITIALIZATION
    // Displays the text input dialog at the specified position for adding new text
    function showTextDialog(x, y, initialText = '') {
        isTextPlacing = true;
        
        // Calculate actual canvas position based on zoom and offset
        const canvasX = (x - offsetX) / zoomFactor;
        const canvasY = (y - offsetY) / zoomFactor;
        
        textPlacementPoint = { x: canvasX, y: canvasY };
        
        // Position and show the text entry dialog
        const dialog = document.getElementById('markup-text-dialog');
        dialog.style.left = x + 'px';
        dialog.style.top = (y - 160) + 'px'; // Position higher above the text
        dialog.style.display = 'block';
        const textInput = document.getElementById('markup-text-input');
        textInput.value = initialText;
        textInput.focus();
        
        // Select all text when editing
        if (initialText) {
            textInput.select();
        }
    }

    // ============================================================
    // EVENT HANDLER | TEXT ENTRY CANCELLATION
    // Handles the user cancelling text entry and resets the text placement state
    function cancelTextEntry() {
        document.getElementById('markup-text-dialog').style.display = 'none';
        isTextPlacing = false;
        textPlacementPoint = null;
        editingTextElement = null;
        
        // Reset button text back to "Add Text" for next time
        document.getElementById('markup-text-confirm').textContent = 'Add Text';
    }

    // ============================================================
    // EVENT HANDLER | TEXT ENTRY CONFIRMATION
    // Processes the entered text and creates or updates a text element on the canvas
    function confirmTextEntry() {
        const text = document.getElementById('markup-text-input').value.trim();
        const fontSize = parseInt(document.getElementById('markup-text-size').value, 10);
        
        if (text && textPlacementPoint) {
            saveMarkupState();
            
            if (editingTextElement) {
                // HANDLER SECTION | TEXT ELEMENT UPDATING
                // Updates properties of an existing text element
                editingTextElement.text = text;
                editingTextElement.fontSize = fontSize;
                editingTextElement.color = markupColor;
            } else {
                // HANDLER SECTION | NEW TEXT ELEMENT CREATION
                // Creates and adds a new text element to the markup paths
                markupPaths.push({
                    tool: 'text',
                    text: text,
                    position: { 
                        x: textPlacementPoint.x,
                        y: textPlacementPoint.y
                    },
                    color: markupColor,
                    fontSize: fontSize,
                    lineWidth: markupLineWidth
                });
            }
            
            document.getElementById('markup-text-dialog').style.display = 'none';
            isTextPlacing = false;
            textPlacementPoint = null;
            editingTextElement = null;
            
            document.getElementById('markup-text-confirm').textContent = 'Add Text';
            
            // Force a redraw after adding/editing text
            renderLoop(); // Call the actual rendering function
        }
    }

    // ============================================================
    // EVENT HANDLER | TEXT ELEMENT EDITING
    // Allows editing of an existing text element by showing the text dialog with current values
    function editTextElement(element) {
        editingTextElement = element;
        document.getElementById('markup-text-confirm').textContent = 'Update Text';
        
        // Get element position in screen coordinates
        const screenX = element.position.x * zoomFactor + offsetX;
        const screenY = element.position.y * zoomFactor + offsetY;
        
        // Show dialog with current text
        showTextDialog(screenX, screenY, element.text);
        
        // Set font size in dropdown
        document.getElementById('markup-text-size').value = element.fontSize || 24;
    }
    
    // Arrow control points management
    function clearArrowControls() {
        // Remove any existing control points from DOM
        document.querySelectorAll('.control-point, .handle-point, .handle-line').forEach(element => {
            element.remove();
        });
        
        controlPoints = [];
        handlePoints = [];
        activeControlPoint = null;
        currentArrow = null;
    }
    
    function createControlPoint(x, y, type) {
        const point = document.createElement('div');
        point.className = type.includes('control') ? 'handle-point' : 'control-point';
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.dataset.type = type;
        
        document.getElementById('canvas-container').appendChild(point);
        
        const pointObj = { element: point, x, y, type };
        controlPoints.push(pointObj);
        
        if (type.includes('control')) {
            handlePoints.push(pointObj);
        }
        
        return pointObj;
    }
    
    function createHandleLine(x1, y1, x2, y2) {
        const line = document.createElement('div');
        line.className = 'handle-line';
        
        // Calculate line properties
        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        // Position and rotate the line
        line.style.width = `${length}px`;
        line.style.left = `${x1}px`;
        line.style.top = `${y1}px`;
        line.style.transformOrigin = '0 0';
        line.style.transform = `rotate(${angle}deg)`;
        
        document.getElementById('canvas-container').appendChild(line);
        
        return line;
    }
    
    function updateControlPointPositions() {
        if (!currentArrow || arrowState !== 'edit') return;
        
        // Clear existing control points
        clearArrowControls();
        
        // Apply canvas transform to arrow points to get screen positions
        const startX = currentArrow.startPoint.x * zoomFactor + offsetX;
        const startY = currentArrow.startPoint.y * zoomFactor + offsetY;
        const endX = currentArrow.endPoint.x * zoomFactor + offsetX;
        const endY = currentArrow.endPoint.y * zoomFactor + offsetY;
        const control1X = currentArrow.control1.x * zoomFactor + offsetX;
        const control1Y = currentArrow.control1.y * zoomFactor + offsetY;
        const control2X = currentArrow.control2.x * zoomFactor + offsetX;
        const control2Y = currentArrow.control2.y * zoomFactor + offsetY;
        
        // Create control points for editing
        createControlPoint(startX, startY, 'start');
        createControlPoint(endX, endY, 'end');
        createControlPoint(control1X, control1Y, 'control1');
        createControlPoint(control2X, control2Y, 'control2');
        
        // Create handle lines
        createHandleLine(startX, startY, control1X, control1Y);
        createHandleLine(endX, endY, control2X, control2Y);
    }
    
    // Draw all markup paths on the given context
    function importedDrawAllMarkupPaths(context) {
        // First draw the non-selected elements
        markupPaths.forEach(path => {
            const isSelected = path === selectedElement;
            
            if (!isSelected) {
                if (path.tool === 'arrow') {
                    drawArrow(context, path);
                } else if (path.tool === 'text') {
                    drawSketchyText(context, path);
                } else if (path.tool === 'rectangle') {
                    drawSketchyRectangle(context, path);
                } else if (path.tool === 'circle') {
                    drawSketchyCircle(context, path);
                } else if (path.tool === 'line') {  // Added in v1.8.5 for straight line tool
                    drawSketchyLine(context, path);
                } else if (path.tool === 'arc') {  // Added in v1.8.6 for arc tool
                    drawArc(context, path);
                } else {
                    drawSketchyPath(context, path);
                }
            }
        });
        
        // Then draw the selected element to ensure it's on top
        if (selectedElement) {
            // Save context to restore after drawing
            context.save();
            
            // Draw highlight/outline around the selected element
            if (selectedElement.tool === 'pencil') {
                // Draw a wider stroke behind the path
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';
                
                context.beginPath();
                context.moveTo(selectedElement.points[0].x, selectedElement.points[0].y);
                for (let i = 1; i < selectedElement.points.length; i++) {
                    context.lineTo(selectedElement.points[i].x, selectedElement.points[i].y);
                }
                context.stroke();
            } else if (selectedElement.tool === 'rectangle') {
                // Draw a highlight around the rectangle
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                
                const x = selectedElement.startPoint.x;
                const y = selectedElement.startPoint.y;
                const width = selectedElement.endPoint.x - selectedElement.startPoint.x;
                const height = selectedElement.endPoint.y - selectedElement.startPoint.y;
                
                context.strokeRect(x, y, width, height);
            } else if (selectedElement.tool === 'circle') {
                // Draw a highlight around the circle
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                
                // Handle both old and new formats for circles
                let centerX, centerY, radius;
                
                if (selectedElement.centerPoint && selectedElement.radius !== undefined) {
                    // New format with centerPoint and radius
                    centerX = selectedElement.centerPoint.x;
                    centerY = selectedElement.centerPoint.y;
                    radius = selectedElement.radius;
                } else {
                    // Old format
                    centerX = (selectedElement.startPoint.x + selectedElement.endPoint.x) / 2;
                    centerY = (selectedElement.startPoint.y + selectedElement.endPoint.y) / 2;
                    const radiusX = Math.abs(selectedElement.endPoint.x - selectedElement.startPoint.x) / 2;
                    const radiusY = Math.abs(selectedElement.endPoint.y - selectedElement.startPoint.y) / 2;
                    radius = (radiusX + radiusY) / 2; // Average radius for highlighting
                }
                
                context.beginPath();
                context.arc(centerX, centerY, radius, 0, Math.PI * 2);
                context.stroke();
            } else if (selectedElement.tool === 'text') {
                // Draw a highlight rectangle around text
                const textWidth = selectedElement.text.length * (selectedElement.lineWidth * 10);
                const textHeight = selectedElement.lineWidth * 20;
                
                context.fillStyle = 'rgba(255, 255, 100, 0.2)';
                context.fillRect(
                    selectedElement.position.x - 5,
                    selectedElement.position.y - textHeight,
                    textWidth + 10,
                    textHeight + 10
                );
            } else if (selectedElement.tool === 'line') {
                // Draw a highlight around the line
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                
                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                context.lineTo(selectedElement.endPoint.x, selectedElement.endPoint.y);
                context.stroke();
            } else if (selectedElement.tool === 'arrow') {
                // Draw a highlight around the arrow
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                
                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                // Use quadratic curve for simpler arrow highlights
                context.quadraticCurveTo(
                    selectedElement.control.x, 
                    selectedElement.control.y,
                    selectedElement.endPoint.x, 
                    selectedElement.endPoint.y
                );
                context.stroke();
            }
            
            context.restore();
            
            // Draw the actual element on top
            if (selectedElement.tool === 'arrow') {
                drawArrow(context, selectedElement);
            } else if (selectedElement.tool === 'text') {
                drawSketchyText(context, selectedElement);
            } else if (selectedElement.tool === 'rectangle') {
                drawSketchyRectangle(context, selectedElement);
            } else if (selectedElement.tool === 'circle') {
                drawSketchyCircle(context, selectedElement);
            } else if (selectedElement.tool === 'line') {
                drawSketchyLine(context, selectedElement);
            } else if (selectedElement.tool === 'arc') {
                drawArc(context, selectedElement);
            } else {
                drawSketchyPath(context, selectedElement);
            }
        }
        
        // Draw current markup path if drawing
        if (currentMarkupPath) {
            if (currentMarkupPath.tool === 'arrow') {
                drawArrow(context, currentMarkupPath);
            } else {
                drawSketchyPath(context, currentMarkupPath);
            }
        }
        
        // Draw current shape if in progress
        if (isShapeDrawing && currentShape) {
            if (currentShape.tool === 'rectangle') {
                drawSketchyRectangle(context, currentShape);
            } else if (currentShape.tool === 'circle') {
                drawSketchyCircle(context, currentShape);
            } else if (currentShape.tool === 'polygon') {
                drawSketchyPolygon(context, currentShape);
            }
        }
        
        // Draw current line if in progress - Added in v1.8.5
        if (isLineDrawing && currentLine) {
            drawSketchyLine(context, currentLine);
        }
        
        // Draw current arc if in progress - Added in v1.8.6
        if (isArcDrawing && currentArc) {
            drawArc(context, currentArc);
        }
    }

    // Draw a sketchy-looking path (for pencil and eraser)
    function drawSketchyPath(context, path) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyPath function is now used instead
        
        // Save canvas transformations 
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Create a compatible parameter object
        const options = {
            color: path.color,
            lineWidth: path.lineWidth,
            seed: path.seed
        };
        
        // Call the imported function with correct context
        // The drawSketchyPath function from the imported module will use its internal context
        updateDrawingConfig({ ctx: context });
        drawSketchyPath(path, options);
        
        // Restore canvas state
        context.restore();
    }

    // Draw an arrow on the context
    function importedDrawArrow(context, arrow) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawArrow function is now used instead
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Convert the arrow format to match the imported function's expectations
        // (startPoint, control1, control2, endPoint) -> (start, control, end)
        const arrowObj = {
            start: arrow.startPoint,
            control: arrow.control1,
            end: arrow.endPoint
        };
        
        // Create compatible options object
        const options = {
            color: arrow.color,
            lineWidth: arrow.lineWidth,
            sketchiness: 0.5 // Default sketchiness value
        };
        
        // Update the drawing context and call the imported function
        updateDrawingConfig({ ctx: context });
        importedDrawArrow(arrowObj, options);
        
        // Restore canvas state
        context.restore();
    }

    // Wrapper for imported drawAllMarkupPaths 
    function drawAllMarkupPaths(context) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported importedDrawAllMarkupPaths function is now used
        
        // Save the canvas transformation state
        context.save();
        
        // Apply transformations to make the imported function work with our coordinate system  
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context in the drawing module
        updateDrawingConfig({ ctx: context });
        
        // Call the imported function with the markup paths array
        importedDrawAllMarkupPaths(markupPaths);
        
        // Restore the canvas state
        context.restore();
    }

    // Draw an arrow on the context
    function drawArrow(context, arrow) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawArrow function is now used instead
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: arrow.color,
            lineWidth: arrow.lineWidth,
            sketchiness: 0.5
        };
        
        // Call the imported function from the drawing module
        importedDrawArrow(arrow, options);
        
        // Restore canvas state
        context.restore();
    }

    // ========================================================================
    // WRAPPER FUNCTIONS FOR DRAWING MODULE 
    // ========================================================================

    // Wrapper function for drawing sketchy rectangle
    function drawSketchyRectangle(context, rect) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyRectangle function is now used
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: rect.color,
            lineWidth: rect.lineWidth,
            sketchiness: 0.5,
            fillStyle: rect.fill ? rect.fillColor : null
        };
        
        // Call the imported function
        drawSketchyRectangle(rect, options);
        
        // Restore canvas state
        context.restore();
    }

    // Wrapper function for drawing sketchy circle
    function drawSketchyCircle(context, circle) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyCircle function is now used
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: circle.color,
            lineWidth: circle.lineWidth,
            sketchiness: 0.5,
            fillStyle: circle.fill ? circle.fillColor : null
        };
        
        // Call the imported function
        drawSketchyCircle(circle, options);
        
        // Restore canvas state
        context.restore();
    }

    // Wrapper function for drawing sketchy line
    function drawSketchyLine(context, line) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyLine function is now used
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: line.color,
            lineWidth: line.lineWidth,
            sketchiness: 0.5
        };
        
        // Prepare line data in the format expected by the imported function
        const lineData = {
            x1: line.startPoint.x,
            y1: line.startPoint.y,
            x2: line.endPoint.x,
            y2: line.endPoint.y
        };
        
        // Call the imported function
        drawSketchyLine(lineData, options);
        
        // Restore canvas state
        context.restore();
    }

    // Wrapper function for drawing sketchy path
    function drawSketchyPath(context, path) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyPath function is now used
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: path.color || markupColor,
            lineWidth: path.lineWidth || markupLineWidth,
            sketchiness: 0.5
        };
        
        // Call the imported function
        drawSketchyPath(path, options);
        
        // Restore canvas state
        context.restore();
    }

    // Wrapper function for drawing sketchy polygon
    function drawSketchyPolygon(context, polygon) {
        // OFFLOADED: This function has been moved to toolsMarkupSketchDrawingTools.js
        // The imported drawSketchyPolygon function is now used
        
        // Save canvas transformations
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Update the drawing context
        updateDrawingConfig({ ctx: context });
        
        // Create options
        const options = {
            color: polygon.color,
            lineWidth: polygon.lineWidth,
            sketchiness: 0.5,
            fillStyle: polygon.fill ? polygon.fillColor : null
        };
        
        // Call the imported function
        drawSketchyPolygon(polygon.points, options);
        
        // Restore canvas state
        context.restore();
    }

})();        // <---- This is where the function is immediately executed