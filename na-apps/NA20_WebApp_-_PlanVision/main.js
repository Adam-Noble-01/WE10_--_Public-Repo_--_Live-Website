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
// NOTES TO FUTURE ADAM!
//  - Continue on switching sketch geometry logic out
//    - Finished and tested Rectangle
//    - Finished and tested Arc
//    - Next Complete . . .  Circle
//    - Next Complete . . .  Line
//    - Next Complete . . .  Polygon
//    - Next Complete . . .  Open Polygon
//    - Next Complete . . .  Text
//    - Next Complete . . .  Handle
//
//
//
//
// ============================================================================




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
    // 238:  `initPlanVisionApp()
    // 340:  `handleInitialTutorialFlow()
    // 360:  `isMobileOrTabletPortrait()
    // 365:  `isPortrait()
    // 375:  `renderLoop()
    // 454:  `drawLine()
    // 485:  `drawMarkers()
    // 509:  `drawRectangle()
    // 535:  `drawRectLabel()
    // 569:  `drawPolygon()
    // 593:  `drawOpenPolygon()
    // 614:  `drawLineLabel()
    // 621:  `drawAreaLabel()
    // 626:  `drawEdgeLabels()
    // 650:  `drawTextLabel()
    // 689:  `canvasToPlanCoords()
    // 701:  `finalizeMeasurement()
    // 787:  `attachEventListeners()
    // 967:  `toggleToolbar()
    // 983:  `onMouseMove()
    // 1182: `onMouseDown()
    // 1453: `onWheel()
    // 1477: `drawSketchyArc()
    // 1487: `handlePointerDownArc()
    // 1526: `drawArc()
    // 1551: `drawGeomMathDistanceToQuadraticCurve()
    // 1570: `onTouchStart()
    // 1593: `onTouchMove()
    // 1623: `onTouchEnd()
    // 1650: `applyZoom()
    // 1655: `setZoom()
    // 1670: `resizeCanvas()
    // 1680: `resetView()
    // 1750: `setTool()
    // 1780: `cancelTool()
    // 1798: `clearMeasurements()
    // 1805: `showCancelTool()
    // 1809: `hideCancelTool()
    // 1813: `updateMeasureInfo()
    // 1831: `adjustConfirmButtonPosition()
    // 1862: `showToolInstructions()
    // 1899: `displayInstructionsOverlay()
    // 1901: `dismissOverlay()
    // 1917: `touchDistance()
    // 1921: `touchMidpoint()
    // 1931: `onResize()
    // 1943: `toggleMarkupToolset()
    // 2027: `returnToMeasuringTools()
    // 2071: `setMarkupTool()
    // 2144: `clearMarkup()
    // 2154: `saveMarkupImage()
    // 2182: `showTextDialog()
    // 2198: `cancelTextEntry()
    // 2215: `drawAllMarkupPaths()
    // 2248: `drawArc()
    // 2291: `drawSketchyText()
    // 2328: `showTextDialog()
    // 2355: `cancelTextEntry()
    // 2368: `confirmTextEntry()
    // 2412: `editTextElement()
    // 2428: `clearArrowControls()
    // 2440: `createControlPoint()
    // 2459: `createHandleLine()
    // 2479: `updateControlPointPositions()
    // 2507: `drawAllMarkupPaths()
    // 2675: `drawSketchyPath()
    // 2765: `drawArrow()
    // 2909: `drawSketchyArrowLine()
    // 2953: `calculateCurveEndDirection()
    // 2962: `drawSketchyText()
    // 2997: `drawSketchyRectangle()
    // 3109: `drawSketchyCircle()
    // 3208: `drawArrow()
    // 3321: `drawSketchyArrowLine()
    // 3384: `drawSketchySegment()
    // 3483: `saveMarkupState()
    // 3501: `undoMarkupAction()
    // 3523: `redoMarkupAction()
    // 3545: `updateUndoRedoButtons()
    // 3562: `onKeyDown()
    // 3621: `showMarkupInstructions()
    // 3686: `dismissInstructions()
    // 3702: `detectAndEraseElements()
    // 3946: `findTextElementAt()
    // 3980: `findElementAt()
    // 4140: `selectElement()
    // 4170: `clearSelection()
    // 4186: `createSelectionHandles()
    // 4269: `clearSelectionHandles()
    // 4287: `moveElement()
    // 4362: `deleteSelectedElement()
    // 4393: `updateAllHandlePositions()
    // 4411: `copySelectedElement()
    // 4425: `pasteElement()
    // 4565: `showCopyFeedback()
    // 4592: `drawSketchyPolygon()
    // 4649: `drawSketchyLine()
    // 4678: `showArrowControls()
    // 4719: `createHandle()
    // 4744: `updateAllHandlePositions()
    // 4768: `onMouseUp()
    // 4991: `sampleBezierCurve()
    // 5005: `cancelMarkupTool()
    // 5041: `showMarkupInstructions()
    // 5106: `dismissInstructions()
    // 5126: `drawSketchyLine()
    // 5159: `detectAndEraseElements()
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





import {
    drawPenSketchArcMath,
    drawPenSketchArc,
    drawPenSketchStrokeSegment,
    drawPenSketchReinforcementStroke,
    drawPenSketchRectangleMath,
    drawPenSketchRectangle,
} from './markupSketchDrawingToolsLogicLibrary.js';


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

const planCanvas                       =     document.getElementById("planCanvas");
const ctx                              =     planCanvas.getContext("2d");
const measureInfo                      =     document.getElementById("measureInfo");
const cancelToolBtn                    =     document.getElementById("cancelToolBtn");
const toolInstructionsOverlay          =     document.getElementById("tool-instructions-overlay");
const toolInstructionsText             =     document.getElementById("tool-instructions-text");
const finishBtn                        =     document.getElementById("finishMeasurementBtn");
const menuTutorialOverlay              =     document.getElementById("menu-tutorial-overlay");
const toolbar                          =     document.getElementById("toolbar");

let isToolbarOpen                      =     true;
const isTouchDevice                    =     ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
const markerRadius                     =     isTouchDevice ? 36 : 24;
const baseLineWidth                    =     isTouchDevice ? 3 : 2;

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

            resizeCanvas();
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
        if (!isImageLoaded) return;
        requestAnimationFrame(renderLoop);

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
            drawAllMarkupPaths(ctx);
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
            else if (currentMarkupTool === 'toolmapMarkupSketchArc') {handlePointerDownArc(pos);
            }

        });

        // ========================================================================
        // MARKUP SKETCH FEATURE TOOLSET - EVENT LISTENERS
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
        
        // Add new toolmapMarkupSketchArc tool event listener
        const arcBtn = document.getElementById("markupArcBtn");
        if (arcBtn) {
            arcBtn.addEventListener("click", () => setMarkupTool("toolmapMarkupSketchArc"));
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
            // - Processes toolmapMarkupSketchArc drawing operations
            // ----------------------------------------------------
            else if (currentMarkupTool === 'toolmapMarkupSketchArc' && isArcDrawing && currentArc) {
                // Real-time feedback: if controlPoint or endPoint not yet set, update a temp variable
                // so that your renderPenSketchArc function can display it while dragging.
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

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
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
            else if (currentMarkupTool === 'toolmapMarkupSketchArc') {
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



    //-------------------------------------------
    // 1) ARC TOOL - Handle Pointer Down
    //-------------------------------------------
    function handlePointerDownArc(pos) {
        // If we're not currently drawing an toolmapMarkupSketchArc, start a new one
        if (!isArcDrawing) {
            isArcDrawing = true;
            currentArc = {
                tool: 'toolmapMarkupSketchArc',
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
        // and finalise the toolmapMarkupSketchArc
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



    // = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ?
    // = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ?
    //-------------------------------------------
    // 3) ARC TOOL - Eraser/Hit-Testing Function
    //-------------------------------------------
    // Finds approximate min distance between a point and a quadratic curve
    // so your eraser and selection can detect arcs
    function calcDistanceToQuadraticCurve(x1, y1, cx, cy, x2, y2, px, py, steps = 50) {
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
    // = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ?
    // = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ? = = ?

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


    // ========================================================================
    // KEY NOTES |  Markup Sketch Feature Toolset 
    // ========================================================================
    //
    // MARKUP SKETCH OBJECT NAMING NOTES
    // - Each Sketch Element Rendered on screen uses a layered naming approach.
    // - 'Arc' Used as a basic example element, this may be interchanged with other sketch elements.
    // 
    //    drawPenSketchArcMath  =  The core immutable underlying logic.
    //    drawPenSketchArc      =  The geometric math with some variables applied adjusting its properties.
    //    renderPenSketchArc	=  A container wrapping the underlying logic for the rendering pipeline.
    //    calcDistanceToArc     =  A additional  layer over the top as a further helper for other elements.
    //
    //  PIPELINE OUTLINE
    //  Math (drawPenSketchArcMath)  →  Stylised Output (drawPenSketchArc) 
    //  → Canvas-Render Container (renderPenSketchArc) → Interactive Logic (calcDistanceToArc)
    //


    /*************************************************************************
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
        } else if (tool === 'toolmapMarkupSketchArc') {
            planCanvas.classList.add('markup-toolmapMarkupSketchArc');
            showMarkupInstructions('toolmapMarkupSketchArc');
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
        
        // Draw all markup paths (includes arcs if renderPenSketchArc is handled in drawAllMarkupPaths)
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
        if (!textObj.text || !textObj.position) {
            console.log("Invalid text object:", textObj);
            return;
        }
        
        console.log("Drawing standard text:", textObj.text);  // Debug log
        
        // Save the current transformation
        context.save();
        
        // Apply canvas transformations (critical for correct positioning)
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Set text properties
        context.fillStyle = textObj.color || markupColor;
        const fontSize = textObj.fontSize || 24; // Default size if none specified
        
        // Use more fallbacks like in CSS to ensure sketchy style even if Caveat fails
        context.font = `${fontSize}px 'Caveat', 'Comic Sans MS', cursive, sans-serif`;
        context.textBaseline = 'top';
        
        // Draw the text
        context.fillText(textObj.text, textObj.position.x, textObj.position.y);
        
        // Debug: Check if font actually applied
        if (!document.fonts.check(`${fontSize}px 'Caveat'`)) {
            console.warn("Caveat font not loaded or available, using fallback font for text");
        }
        
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
    function drawAllMarkupPaths(context) {
        // First draw the non-selected elements
        markupPaths.forEach(path => {
            const isSelected = path === selectedElement;
            
            if (!isSelected) {
                if (path.tool === 'arrow') {
                    drawArrow(context, path);
                } else if (path.tool === 'text') {
                    drawSketchyText(context, path);
                } else if (path.tool === 'rectangle') {
                    renderPenSketchRectangle(context, path);
                } else if (path.tool === 'circle') {
                    drawSketchyCircle(context, path);
                } else if (path.tool === 'line') {  
                    drawSketchyLine(context, path);
                } else if (path.tool === 'toolmapMarkupSketchArc') {  
                    renderPenSketchArc(context, path);
                } else {
                    drawSketchyPath(context, path);
                }
            }
        });
        
        // Then draw the selected element with highlight
        if (selectedElement) {
            // Save context to restore after drawing
            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            
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
                // ????
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
            } else if (selectedElement.tool === 'arrow') {
                // Draw a highlight around the arrow
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';
                
                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                context.bezierCurveTo(
                    selectedElement.control1.x, selectedElement.control1.y,
                    selectedElement.control2.x, selectedElement.control2.y,
                    selectedElement.endPoint.x, selectedElement.endPoint.y
                );
                context.stroke();
            } else if (selectedElement.tool === 'line') {  // Added in v1.8.5 for straight line tool
                // Draw a highlight around the line
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';
                
                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                context.lineTo(selectedElement.endPoint.x, selectedElement.endPoint.y);
                context.stroke();
            }
            
            context.restore();
            
            // Draw the actual element on top
            if (selectedElement.tool === 'arrow') {
                drawArrow(context, selectedElement);
            } else if (selectedElement.tool === 'text') {
                drawSketchyText(context, selectedElement);
            } else if (selectedElement.tool === 'rectangle') {
                renderPenSketchRectangle(context, selectedElement);
            } else if (selectedElement.tool === 'circle') {
                drawSketchyCircle(context, selectedElement);
            } else if (selectedElement.tool === 'line') {  // Added in v1.8.5 for straight line tool
                drawSketchyLine(context, selectedElement);
            } else if (selectedElement.tool === 'polygon') {
                drawSketchyPolygon(context, selectedElement);
            } else {
                drawSketchyPath(context, selectedElement);
            }
        }
        
        // Draw current path if in progress
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
                renderPenSketchRectangle(context, currentShape);
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
    }
    
    // Draw a sketchy-looking path (for pencil and eraser)
    function drawSketchyPath(context, path) {
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.lineWidth = path.lineWidth;
        context.strokeStyle = path.color;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // Ensure path has a seed for deterministic randomness
        if (!path.seed) {
            path.seed = Math.floor(Math.random() * 10000);
        }

        // First pass - main line
        context.beginPath();
        context.moveTo(path.points[0].x, path.points[0].y);
        
        // Use a more natural hand-drawn approach with variable pressure
        let prevX = path.points[0].x;
        let prevY = path.points[0].y;
        
        for (let i = 1; i < path.points.length; i++) {
            const point = path.points[i];
            
            // Add some controlled jitter to mimic hand movement
            const jitterAmount = path.lineWidth * 0.1;
            const jitterX = jitterAmount * (coreMathPseudoRandomValueGen(path.seed + i * 7) - 0.5);
            const jitterY = jitterAmount * (coreMathPseudoRandomValueGen(path.seed + i * 13) - 0.5);
            
            // Create control points for a smoother curve
            if (i < path.points.length - 1) {
                // Calculate midpoints for quadratic curves
                const mid1X = (prevX + point.x) / 2 + jitterX;
                const mid1Y = (prevY + point.y) / 2 + jitterY;
                
                // Vary line width slightly for more natural appearance
                if (i % 5 === 0) {
                    // Occasionally change line width for pressure variation
                    const pressureVariation = 0.2;
                    const pressureFactor = 1 + pressureVariation * (coreMathPseudoRandomValueGen(path.seed + i * 19) - 0.5);
                    context.lineWidth = path.lineWidth * pressureFactor;
                }
                
                // Draw segment
                context.quadraticCurveTo(
                    mid1X, mid1Y,
                    point.x, point.y
                );
            } else {
                // Last point - simple line to final position
                context.lineTo(point.x + jitterX, point.y + jitterY);
            }
            
            prevX = point.x;
            prevY = point.y;
        }
        context.stroke();

        // Second pass - add subtle reinforcement lines in some areas
        if (path.points.length > 5) {
            context.globalAlpha = 0.3;
            context.lineWidth = path.lineWidth * 0.6;
            
            // Choose a random segment to reinforce
            const startIndex = Math.floor(coreMathPseudoRandomValueGen(path.seed + 100) * (path.points.length / 3));
            const endIndex = Math.min(
                startIndex + Math.floor(coreMathPseudoRandomValueGen(path.seed + 200) * (path.points.length / 2)), 
                path.points.length - 1
            );
            
            context.beginPath();
            context.moveTo(
                path.points[startIndex].x + path.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(path.seed + 300) - 0.5), 
                path.points[startIndex].y + path.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(path.seed + 400) - 0.5)
            );
            
            for (let i = startIndex + 1; i <= endIndex; i++) {
                const point = path.points[i];
                const jitterX = path.lineWidth * 0.15 * (coreMathPseudoRandomValueGen(path.seed + i * 23) - 0.5);
                const jitterY = path.lineWidth * 0.15 * (coreMathPseudoRandomValueGen(path.seed + i * 29) - 0.5);
                context.lineTo(point.x + jitterX, point.y + jitterY);
            }
            context.stroke();
        }
        
        context.restore();
    }
    
    // Draw an arrow on the context
    function drawArrow(context, arrow) {
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.strokeStyle = arrow.color;
        context.lineWidth = arrow.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        // Add deterministic seed for consistent randomness
        if (!arrow.seed) {
            arrow.seed = {
                shaft: Math.floor(Math.random() * 10000),
                head1: Math.floor(Math.random() * 10000),
                head2: Math.floor(Math.random() * 10000)
            };
        }
        
        // Sample points along the bezier curve for a sketchy line
        const steps = 40;  // More steps for smoother curve with better details
        
        // Create segments with varied line thickness - main shaft of arrow
        const points = [];
        for (let t = 0; t <= 1; t += 1/steps) {
            const point = coreMathGeomBezierPoint(
                arrow.startPoint, 
                arrow.control1, 
                arrow.control2, 
                arrow.endPoint, 
                t
            );
            
            // Apply deterministic jitter to create sketchy look
            const jitter = arrow.lineWidth * 0.18 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + Math.floor(t * 100)) - 0.5);
            point.x += jitter;
            point.y += jitter;
            
            points.push(point);
        }
        
        // Draw the sketchy main curve with multiple segments
        for (let i = 0; i < points.length - 1; i++) {
            // Vary line width slightly for more natural appearance
            const pressureFactor = 0.9 + (coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 25) * 0.2);
            context.lineWidth = arrow.lineWidth * pressureFactor;
            
            context.beginPath();
            
            // Start point with slight jitter
            const p1 = points[i];
            const p2 = points[i+1];
            
            context.moveTo(p1.x, p1.y);
            
            // Calculate control point for curved segment
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            
            // Add small random deviation to control point
            const cpVariation = arrow.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 33) - 0.5);
            midX += cpVariation;
            midY += cpVariation;
            
            // Draw with slight curve for each segment
            context.quadraticCurveTo(midX, midY, p2.x, p2.y);
            context.stroke();
        }
        
        // Draw the reinforcements with second stroke for technical pen effect
        context.globalAlpha = 0.6; // More visible than before (was 0.3)
        context.lineWidth = arrow.lineWidth * 0.7;
        
        for (let i = 0; i < 2; i++) { // Draw 2 reinforcement lines
            const startIdx = Math.floor(coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 100) * (points.length / 3));
            const endIdx = Math.min(
                startIdx + Math.floor(coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 150) * (points.length / 2)), 
                points.length - 1
            );
            
            context.beginPath();
            context.moveTo(
                points[startIdx].x, 
                points[startIdx].y
            );
            
            for (let j = startIdx + 1; j <= endIdx; j++) {
                const offsetX = arrow.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 200 + j) - 0.4);
                const offsetY = arrow.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + i * 250 + j) - 0.4);
                context.lineTo(
                    points[j].x + offsetX, 
                    points[j].y + offsetY
                );
            }
            context.stroke();
        }
        
        // Reset opacity for arrowhead - no transparency
        context.globalAlpha = 1.0;
        context.lineWidth = arrow.lineWidth;
        
        // Calculate vector at arrow end for correct arrowhead direction
        const endDir = calculateCurveEndDirection(
            arrow.control2,
            arrow.endPoint
        );
        
        // Draw the arrow head with sketchy technical pen style
        const endX = arrow.endPoint.x;
        const endY = arrow.endPoint.y;
        const angle = Math.atan2(endDir.y, endDir.x);
        
        // Arrow head size based on line width
        const arrowSize = arrow.lineWidth * 9; // Slightly larger than before
        
        // Add consistent variation to arrowhead angles
        const angleVar1 = (coreMathPseudoRandomValueGen(arrow.seed.head1) * 0.25) - 0.125; // More variation
        const angleVar2 = (coreMathPseudoRandomValueGen(arrow.seed.head2) * 0.25) - 0.125; // More variation
        
        // Draw first arrowhead line
        drawSketchyArrowLine(
            context, 
            endX, endY,
            endX - arrowSize * Math.cos(angle - Math.PI/6 + angleVar1), 
            endY - arrowSize * Math.sin(angle - Math.PI/6 + angleVar1),
            arrow.lineWidth * 1.1, // Slightly thicker arrowhead
            arrow.color,
            arrow.seed.head1
        );
        
        // Draw second arrowhead line
        drawSketchyArrowLine(
            context, 
            endX, endY,
            endX - arrowSize * Math.cos(angle + Math.PI/6 + angleVar2), 
            endY - arrowSize * Math.sin(angle + Math.PI/6 + angleVar2),
            arrow.lineWidth * 1.1, // Slightly thicker arrowhead
            arrow.color,
            arrow.seed.head2
        );
        
        context.restore();
    }
    
    // Helper function to draw sketchy arrowhead lines
    function drawSketchyArrowLine(context, x1, y1, x2, y2, lineWidth, color) {
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        
        // Start point with slight jitter
        const jitter = lineWidth * 0.1;
        const startX = x1 + jitter * (Math.random() - 0.5);
        const startY = y1 + jitter * (Math.random() - 0.5);
        
        context.moveTo(startX, startY);
        
        // Add a control point for slight curve
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const ctrlJitter = lineWidth * 0.3;
        
        // Normal vector to the line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        // Control point with perpendicular offset
        const ctrlX = midX + nx * ctrlJitter * (Math.random() - 0.3); // Bias for natural curve
        const ctrlY = midY + ny * ctrlJitter * (Math.random() - 0.3);
        
        // Draw a quadratic curve for the arrowhead line
        context.quadraticCurveTo(ctrlX, ctrlY, x2, y2);
        context.stroke();
        
        // Sometimes add a reinforcement stroke
        if (Math.random() > 0.5) {
            context.beginPath();
            context.globalAlpha = 0.2;
            context.lineWidth = lineWidth * 0.7;
            context.moveTo(startX + jitter * 0.5, startY + jitter * 0.5);
            context.lineTo(x2 + jitter * 0.5, y2 + jitter * 0.5);
            context.stroke();
        }
    }
    
    // Helper function to calculate direction at the end of curve
    function calculateCurveEndDirection(controlPoint, endPoint) {
        // Vector from control point to end point gives us tangent direction
        return {
            x: endPoint.x - controlPoint.x,
            y: endPoint.y - controlPoint.y
        };
    }
    
    // Draw text
    function drawSketchyText(context, textObj) {
        if (!textObj.text || !textObj.position) {
            console.log("Invalid text object:", textObj);
            return;
        }
        
        console.log("Drawing sketchy text:", textObj.text);  // Debug log
        
        // Save the current transformation
        context.save();
        
        // Apply canvas transformations (critical for correct positioning)
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Set text properties
        context.fillStyle = textObj.color || markupColor;
        const fontSize = textObj.fontSize || 24; // Default size if none specified
        
        // Use more fallbacks like in CSS to ensure sketchy style even if Caveat fails
        context.font = `${fontSize}px 'Caveat', 'Comic Sans MS', cursive, sans-serif`;
        context.textBaseline = 'top';
        
        // Draw the text
        context.fillText(textObj.text, textObj.position.x, textObj.position.y);
        
        // Debug: Check if font actually applied
        if (!document.fonts.check(`${fontSize}px 'Caveat'`)) {
            console.warn("Caveat font not loaded or available, using fallback font for text");
        }
        
        context.restore();
    }



    // MARKUP SKETCHING TOOLS WRAPPER CONTAINER CONFIGURATION SECTION

    // WRAPPER FUNC  |  Markup Sketch Tools - Rectangle Sketching Tool Wrapper
    // -------------------------------------------------------------------------
    // - Renders the drawPenSketchRectangle on the canvas
    // - Takes `drawPenSketchRectangle` logic containing it within `drawPenSketchRectangle` 
    function renderPenSketchRectangle(context, rect) {
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        // Handle fill if needed
        if (rect.filled) {
            context.fillStyle = rect.color + '33';
            context.fillRect(rect.startPoint.x, rect.startPoint.y, 
                rect.endPoint.x - rect.startPoint.x, 
                rect.endPoint.y - rect.startPoint.y);
        }
        
        // FUNCTION CALL |  Call the offloaded Rectangle Sketch Tool drawing function
        drawPenSketchRectangle(context, rect);
        
        context.restore();
    }


    // WRAPPER FUNC  |  Markup Sketch Tools - Arc Sketching Tool Wrapper
    // -------------------------------------------------------------------------
    // - Renders the toolmapMarkupSketchArc on the canvas
    // - Takes `drawPenSketchArc` logic containing it within `drawPenSketchArc` 


    function renderPenSketchArc(context, arcPath) {
        if (!arcPath.startPoint || !arcPath.controlPoint || !arcPath.endPoint) return;

        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        
        context.lineWidth = arcPath.lineWidth;
        context.strokeStyle = arcPath.color;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // Call drawPenSketchArc directly with all needed parameters including seed
        drawPenSketchArc(
            context, 
            arcPath.startPoint, 
            arcPath.controlPoint, 
            arcPath.endPoint,
            arcPath.lineWidth,
            arcPath.color,
            arcPath.seed || Math.floor(Math.random() * 10000)
        );

        context.restore();
    }


    // =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  = 
    
    

    // #!! WORKING ABOVE HERE #!!
    // =========================================================================================================


    // = = CONTAINER-IZE THIS - SORT THE HARD MATH INTO A  VERSION DFO @markupSketchDrawingToolslogiic
    // Draw a sketchy circle
    function drawSketchyCircle(context, circle) {
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.strokeStyle = circle.color;
        context.lineWidth = circle.lineWidth;
        
        // Handle both old and new circle format
        let centerX, centerY, radius;
        
        if (circle.centerPoint && circle.radius !== undefined) {
            // New format with centerPoint and radius
            centerX = circle.centerPoint.x;
            centerY = circle.centerPoint.y;
            radius = circle.radius;
        } else {
            // Old format with startPoint and endPoint
            centerX = (circle.startPoint.x + circle.endPoint.x) / 2;
            centerY = (circle.startPoint.y + circle.endPoint.y) / 2;
            
            // Calculate radius from width and height
            const dx = circle.endPoint.x - circle.startPoint.x;
            const dy = circle.endPoint.y - circle.startPoint.y;
            radius = Math.sqrt(dx*dx + dy*dy) / 2;
        }
        
        // Add deterministic seed for consistent randomness
        if (!circle.seed) {
            circle.seed = Math.floor(Math.random() * 10000);
        }
        
        // Draw a more imperfect circle with variable segments
        const segments = Math.max(24, Math.min(48, Math.floor(radius * 2)));
        
        // First path - main outline
        context.beginPath();
        
        for (let i = 0; i <= segments; i++) {
            const angle = (Math.PI * 2 * i) / segments;
            
            // Use deterministic noise based on segment and seed
            const noise = coreMathPseudoRandomValueGen(circle.seed + i) * 0.3 - 0.15; // Reduced from 0.4-0.2 to 0.3-0.15 for less variation
            const radiusNoise = 1 + (noise * 0.08);
            
            const x = centerX + radius * radiusNoise * Math.cos(angle);
            const y = centerY + radius * radiusNoise * Math.sin(angle);
            
            if (i === 0) {
                context.moveTo(x, y);
            } else {
                // Use quadratic curves for smoother irregularity
                const prevAngle = (Math.PI * 2 * (i-1)) / segments;
                const midAngle = (prevAngle + angle) / 2;
                
                const controlNoise = coreMathPseudoRandomValueGen(circle.seed + i + 100) * 0.15 - 0.075; // Reduced from 0.2-0.1 to 0.15-0.075
                const ctrlDistance = radius * 0.4 * (1 + controlNoise);
                
                const ctrlX = centerX + (radius + circle.lineWidth * (controlNoise + 0.2)) * Math.cos(midAngle);
                const ctrlY = centerY + (radius + circle.lineWidth * (controlNoise + 0.2)) * Math.sin(midAngle);
                
                context.quadraticCurveTo(ctrlX, ctrlY, x, y);
            }
        }
        context.stroke();
        
        // Add some reinforcement arcs with lower opacity
        context.globalAlpha = 0.8; // Increased from 0.5 to 0.8 for better visibility and less transparency
        context.lineWidth = circle.lineWidth * 0.6;
        
        for (let i = 0; i < 3; i++) {
            const startSegment = Math.floor(coreMathPseudoRandomValueGen(circle.seed + i * 50) * segments);
            const arcLength = Math.floor(segments * (0.25 + coreMathPseudoRandomValueGen(circle.seed + i * 100) * 0.25));
            
            context.beginPath();
            
            for (let j = 0; j <= arcLength; j++) {
                const segmentIndex = (startSegment + j) % segments;
                const angle = (Math.PI * 2 * segmentIndex) / segments;
                
                // Different noise pattern for the reinforcement
                const noise = coreMathPseudoRandomValueGen(circle.seed + segmentIndex + i * 200) * 0.2 - 0.1; // Reduced from 0.3-0.15 to 0.2-0.1
                const reinforceRadius = 0.98 + (noise * 0.04);
                
                const x = centerX + radius * reinforceRadius * Math.cos(angle);
                const y = centerY + radius * reinforceRadius * Math.sin(angle);
                
                if (j === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
            }
            context.stroke();
        }
        
        context.restore();
    }
    // =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  = 
    
    // = = CONTAINER-IZE THIS - SORT THE HARD MATH INTO A  VERSION DFO @markupSketchDrawingToolslogiic
    // Draw an arrow on the context
    function drawArrow(context, arrow) {
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.strokeStyle = arrow.color;
        context.lineWidth = arrow.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        // Add deterministic seed for consistent randomness
        if (!arrow.seed) {
            arrow.seed = {
                shaft: Math.floor(Math.random() * 10000),
                head1: Math.floor(Math.random() * 10000),
                head2: Math.floor(Math.random() * 10000)
            };
        }
        
        // Sample points along the bezier curve for a more sketchy line
        const steps = 30;  // More steps for smoother curve
        
        // Main arrow shaft with dual-stroke technique
        context.beginPath();
        
        // First main stroke with consistent jitter
        const points = [];
        for (let t = 0; t <= 1; t += 1/steps) {
            const point = coreMathGeomBezierPoint(
                arrow.startPoint, 
                arrow.control1, 
                arrow.control2, 
                arrow.endPoint, 
                t
            );
            
            // Apply deterministic jitter
            const jitter = arrow.lineWidth * 0.15 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + Math.floor(t * 100)) - 0.5);
            point.x += jitter;
            point.y += jitter;
            
            points.push(point);
        }
        
        // Draw the main curve through all points
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        
        // Draw with smoother segments for natural hand appearance
        for (let i = 1; i < points.length; i++) {
            context.lineTo(points[i].x, points[i].y);
        }
        context.stroke();
        
        // Add second stroke with slight offset for technical pen appearance
        context.globalAlpha = 0.7; // Increased from 0.3 to 0.7 to reduce transparency
        context.lineWidth = arrow.lineWidth * 0.7;
        context.beginPath();
        context.moveTo(points[0].x + arrow.lineWidth * 0.1, points[0].y + arrow.lineWidth * 0.1);
        
        for (let i = 1; i < points.length; i++) {
            const offset = arrow.lineWidth * 0.1 * (coreMathPseudoRandomValueGen(arrow.seed.shaft + i) - 0.3);
            context.lineTo(points[i].x + offset, points[i].y + offset);
        }
        context.stroke();
        
        // Reset alpha for arrowhead
        context.globalAlpha = 1.0;
        context.lineWidth = arrow.lineWidth;
        
        // Calculate vector at arrow end for correct arrowhead direction
        const endDir = calculateCurveEndDirection(
            arrow.control2,
            arrow.endPoint
        );
        
        // Draw the arrow head with hand-drawn technical pen style
        const endX = arrow.endPoint.x;
        const endY = arrow.endPoint.y;
        const angle = Math.atan2(endDir.y, endDir.x);
        
        // Arrow head size based on line width
        const arrowSize = arrow.lineWidth * 8;
        
        // Add consistent variation to arrowhead angles
        const angleVar1 = (coreMathPseudoRandomValueGen(arrow.seed.head1) * 0.2) - 0.1;
        const angleVar2 = (coreMathPseudoRandomValueGen(arrow.seed.head2) * 0.2) - 0.1;
        
        // Draw first arrowhead line
        drawSketchyArrowLine(
            context, 
            endX, endY,
            endX - arrowSize * Math.cos(angle - Math.PI/6 + angleVar1), 
            endY - arrowSize * Math.sin(angle - Math.PI/6 + angleVar1),
            arrow.lineWidth,
            arrow.color,
            arrow.seed.head1
        );
        
        // Draw second arrowhead line
        drawSketchyArrowLine(
            context, 
            endX, endY,
            endX - arrowSize * Math.cos(angle + Math.PI/6 + angleVar2), 
            endY - arrowSize * Math.sin(angle + Math.PI/6 + angleVar2),
            arrow.lineWidth,
            arrow.color,
            arrow.seed.head2
        );
        
        context.restore();
    }
    
    // =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  = 
    // Helper function to draw sketchy arrowhead lines with deterministic randomness
    function drawSketchyArrowLine(context, x1, y1, x2, y2, lineWidth, color, seed) {
        // Ensure we're at full opacity for arrowheads
        context.globalAlpha = 1.0;
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        
        // Start point with slight jitter based on seed
        const jitter = lineWidth * 0.2;
        const startX = x1 + jitter * (coreMathPseudoRandomValueGen(seed) - 0.5);
        const startY = y1 + jitter * (coreMathPseudoRandomValueGen(seed + 1) - 0.5);
        
        // End point with slight jitter
        const endX = x2 + jitter * (coreMathPseudoRandomValueGen(seed + 2) - 0.5);
        const endY = y2 + jitter * (coreMathPseudoRandomValueGen(seed + 3) - 0.5);
        
        context.moveTo(startX, startY);
        
        // Add a control point for slight curve
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const ctrlJitter = lineWidth * 0.7; // Increased from 0.5 for more curve
        
        // Normal vector to the line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx*dx + dy*dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        // Control point with perpendicular offset
        const ctrlX = midX + nx * ctrlJitter * (coreMathPseudoRandomValueGen(seed + 4) - 0.4); // Biased for natural curve
        const ctrlY = midY + ny * ctrlJitter * (coreMathPseudoRandomValueGen(seed + 5) - 0.4);
        
        // Draw a quadratic curve for the arrowhead line
        context.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
        context.stroke();
        
        // Add a second reinforcement stroke with slight offset but no transparency
        context.beginPath();
        context.lineWidth = lineWidth * 0.6;
        
        // Slight offset for the reinforcement
        const offsetX = jitter * 0.5 * (coreMathPseudoRandomValueGen(seed + 7) - 0.5);
        const offsetY = jitter * 0.5 * (coreMathPseudoRandomValueGen(seed + 8) - 0.5);
        
        // Draw a slightly offset path for technical pen effect
        context.moveTo(startX + offsetX, startY + offsetY);
        
        // Add some wobble to the reinforcement line
        const wobblePts = 8;
        for (let i = 1; i <= wobblePts; i++) {
            const t = i / (wobblePts + 1);
            const wobbleX = startX + dx * t + offsetX + jitter * (coreMathPseudoRandomValueGen(seed + 10 + i) - 0.5);
            const wobbleY = startY + dy * t + offsetY + jitter * (coreMathPseudoRandomValueGen(seed + 20 + i) - 0.5);
            context.lineTo(wobbleX, wobbleY);
        }
        
        context.lineTo(endX + offsetX, endY + offsetY);
        context.stroke();
    }
    // =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  =  = 


    


    // ========================================================================
    // MARKUP TOOLSET MODULE - GLOBAL VARIABLES
    // ========================================================================
    // Undo/Redo history management
    let markupHistory = [];
    let markupRedoStack = [];
    let maxHistoryLength = 20; // Limit history size

    

    // ========================================================================
    // MARKUP TOOLSET MODULE - FUNCTIONS
    // ========================================================================
    // Save current state to history
    function saveMarkupState() {
        // Deep clone the markup paths array
        const currentState = JSON.parse(JSON.stringify(markupPaths));
        
        // Add to history, keep history at manageable size
        markupHistory.push(currentState);
        if (markupHistory.length > maxHistoryLength) {
            markupHistory.shift(); // Remove oldest item
        }
        
        // Clear redo stack when a new action is performed
        markupRedoStack = [];
        
        // Update button states
        updateUndoRedoButtons();
    }
    
    // Undo the last markup action
    function undoMarkupAction() {
        if (markupHistory.length > 0) {
            // Save current state to redo stack
            const currentState = JSON.parse(JSON.stringify(markupPaths));
            markupRedoStack.push(currentState);
            
            // Get previous state
            const previousState = markupHistory.pop();
            
            // Apply previous state
            markupPaths = previousState;
            
            // Update button states
            updateUndoRedoButtons();
            
            // Redraw
            clearArrowControls();
            renderLoop();
        }
    }
    
    // Redo a previously undone action
    function redoMarkupAction() {
        if (markupRedoStack.length > 0) {
            // Save current state to history
            const currentState = JSON.parse(JSON.stringify(markupPaths));
            markupHistory.push(currentState);
            
            // Get redo state
            const redoState = markupRedoStack.pop();
            
            // Apply redo state
            markupPaths = redoState;
            
            // Update button states
            updateUndoRedoButtons();
            
            // Redraw
            clearArrowControls();
            renderLoop();
        }
    }
    
    // Update undo/redo button states (enable/disable)
    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById("markupUndoBtn");
        const redoBtn = document.getElementById("markupRedoBtn");
        
        // Set opacity to indicate if button is usable
        undoBtn.style.opacity = markupHistory.length > 0 ? 1 : 0.5;
        redoBtn.style.opacity = markupRedoStack.length > 0 ? 1 : 0.5;
    }

    // Start the app
    initPlanVisionApp();

    // ----------------------------------------------------
    // FUNCTION |  KEYBOARD EVENT HANDLER
    // - This section introduced in v1.6.6
    // Handles keyboard shortcuts for markup tools including Escape, Enter, Delete, and Copy/Paste
    // ----------------------------------------------------
    function onKeyDown(e) {
        // Only handle keys when markup tools are active
        if (!isMarkupToolsetActive) return;
        
        if (e.key === 'Escape') {
            // Cancel current operation
            if (currentMarkupPath) {
                currentMarkupPath = null;
            }
            else if (currentMarkupTool === 'arrow' && arrowState !== 'idle') {
                clearArrowControls();
                arrowState = 'idle';
                planCanvas.className = '';
                planCanvas.classList.add('markup-arrow-start');
            }
            else if (isShapeDrawing) {
                isShapeDrawing = false;
                currentShape = null;
            }
            else if (isTextPlacing) {
                cancelTextEntry();
            }
            else {
                // No specific operation in progress, cancel the whole tool
                cancelMarkupTool();
            }
        }
        else if (e.key === 'Enter') {
            // Complete polygon if drawing one
            if (currentMarkupTool === 'polygon' && isShapeDrawing && currentShape && currentShape.points.length >= 3) {
                markupPaths.push(currentShape);
                isShapeDrawing = false;
                currentShape = null;
            }
            else if (isTextPlacing) {
                confirmTextEntry();
            }
        }
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            // Delete the selected element if selection tool is active
            if (currentMarkupTool === 'selection' && selectedElement) {
                deleteSelectedElement();
                e.preventDefault(); // Prevent browser back navigation on backspace
                return;
            }
        }
        // Copy functionality - Ctrl+C
        else if (e.key === 'c' && e.ctrlKey && selectedElement) {
            copySelectedElement();
            e.preventDefault(); // Prevent default browser copy
        }
        // Paste functionality - Ctrl+V
        else if (e.key === 'v' && e.ctrlKey && clipboardElement) {
            pasteElement(e);
            e.preventDefault(); // Prevent default browser paste
        }
    }

    // Show instructions for markup tools
    function showMarkupInstructions(tool) {
        const instructionsDiv = document.getElementById('markup-instructions');
        if (!instructionsDiv) {
            // Create the instructions div if it doesn't exist
            const newInstructionsDiv = document.createElement('div');
            newInstructionsDiv.id = 'markup-instructions';
            newInstructionsDiv.style.position = 'absolute';
            newInstructionsDiv.style.top = '60px';
            newInstructionsDiv.style.left = '50%';
            newInstructionsDiv.style.transform = 'translateX(-50%)';
            newInstructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            newInstructionsDiv.style.color = 'white';
            newInstructionsDiv.style.padding = '8px 12px';
            newInstructionsDiv.style.borderRadius = '4px';
            newInstructionsDiv.style.zIndex = '10000';
            newInstructionsDiv.style.display = 'none';
            document.body.appendChild(newInstructionsDiv);
            
            // Use the newly created div
            showMarkupInstructions(tool);
            return;
        }
        
        let instructions = '';
        
        switch (tool) {
            case 'selection':
                instructions = 'Click to select objects. Click and drag to move selected objects.';
                break;
            case 'pencil':
                instructions = 'Click and drag to draw freehand.';
                break;
            case 'eraser':
                instructions = 'Click and drag over elements to erase them.';
                break;
            case 'arrow':
                instructions = 'Click to set arrow start point, then click or drag to set end point.';
                break;
            case 'text':
                instructions = 'Click to place text. Type your text in the dialog that appears.';
                break;
            case 'line':  // Added in v1.8.5 for straight line tool
                instructions = 'Click and drag to draw a straight line.';
                break;
            case 'rectangle':
                instructions = 'Click and drag to draw a rectangle.';
                break;
            case 'filled-rectangle':
                instructions = 'Click and drag to draw a filled rectangle.';
                break;
            case 'circle':
                instructions = 'Click to set center, then drag to set radius.';
                break;
            case 'toolmapMarkupSketchArc': // <<< Added Arc Tool Logic
                instructions = 'Click to set start point, then click to set control point, then click to set end point.'; // <<< Added Arc Tool Logic
                break; // <<< Added Arc Tool Logic
            default:
                instructions = '';
        }
        
        if (instructions) {
            instructionsDiv.innerHTML = instructions;
            instructionsDiv.style.display = 'block';
            
            // Add click-to-dismiss functionality
            function dismissInstructions() {
                clearTimeout(timeoutId);
                instructionsDiv.style.display = 'none';
                instructionsDiv.removeEventListener('click', dismissInstructions);
            }
            
            instructionsDiv.addEventListener('click', dismissInstructions);
            
            // Auto-dismiss after 2 seconds
            var timeoutId = setTimeout(dismissInstructions, 2000);
        } else {
            instructionsDiv.style.display = 'none';
        }
    }

    // Add this new function for detecting and erasing elements
    function detectAndEraseElements(position, radius) {
        // ----------------------------------------------------
        // HANDLER SECTION |  ERASER INITIALIZATION
        // - Sets up eraser parameters and tracking variables
        // ----------------------------------------------------
        const eraserRadiusSquared = radius * radius;
        let erasedAny = false;
        const originalLength = markupPaths.length;
        
        // ----------------------------------------------------
        // HANDLER SECTION |  MARKUP ELEMENT DETECTION
        // - Filters markup paths to remove those that intersect with eraser
        // ----------------------------------------------------
        markupPaths = markupPaths.filter(path => {
            // ----------------------------------------------------
            // DETECTION HANDLER |  PENCIL PATH DETECTION
            // - Checks if any point in a freehand path is within eraser radius
            // ----------------------------------------------------
            if (path.tool === 'pencil') {
                // For freehand paths, check if any point is within eraser radius
                for (let i = 0; i < path.points.length; i++) {
                    const dx = path.points[i].x - position.x;
                    const dy = path.points[i].y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            } 
            // ----------------------------------------------------
            // DETECTION HANDLER |  ARROW DETECTION
            // - Checks if any control point of an arrow is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'arrow') {
                // For arrows, check start and end points and control points
                const pointsToCheck = [
                    path.startPoint,
                    path.endPoint,
                    path.control1,
                    path.control2
                ];
                
                for (const point of pointsToCheck) {
                    const dx = point.x - position.x;
                    const dy = point.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  RECTANGLE DETECTION
            // - Checks if any corner or edge of a rectangle is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'rectangle') {
                // Check if eraser is near any corner or edge
                const corners = [
                    { x: path.startPoint.x, y: path.startPoint.y },
                    { x: path.endPoint.x, y: path.startPoint.y },
                    { x: path.startPoint.x, y: path.endPoint.y },
                    { x: path.endPoint.x, y: path.endPoint.y }
                ];
                
                for (const corner of corners) {
                    const dx = corner.x - position.x;
                    const dy = corner.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
                
                // Check if eraser is on edges
                const edges = [
                    {p1: {x: path.startPoint.x, y: path.startPoint.y}, p2: {x: path.endPoint.x, y: path.startPoint.y}},
                    {p1: {x: path.endPoint.x, y: path.startPoint.y}, p2: {x: path.endPoint.x, y: path.endPoint.y}},
                    {p1: {x: path.endPoint.x, y: path.endPoint.y}, p2: {x: path.startPoint.x, y: path.endPoint.y}},
                    {p1: {x: path.startPoint.x, y: path.endPoint.y}, p2: {x: path.startPoint.x, y: path.startPoint.y}}
                ];
                
                for (const edge of edges) {
                    if (distToSegment(position, edge.p1, edge.p2) <= radius) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  CIRCLE DETECTION
            // - Checks if eraser intersects with circle boundary or interior
            // ----------------------------------------------------
            else if (path.tool === 'circle') {
                // Check if eraser is near circle boundary or inside
                const centerX = (path.startPoint.x + path.endPoint.x) / 2;
                const centerY = (path.startPoint.y + path.endPoint.y) / 2;
                const radiusX = Math.abs(path.endPoint.x - path.startPoint.x) / 2;
                const radiusY = Math.abs(path.endPoint.y - path.startPoint.y) / 2;
                
                // Simple approximation for ellipse - use average radius
                const avgRadius = (radiusX + radiusY) / 2;
                const dx = centerX - position.x;
                const dy = centerY - position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (Math.abs(distance - avgRadius) <= radius || distance <= avgRadius) {
                    erasedAny = true;
                    return false;
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  POLYGON DETECTION
            // - Checks if any vertex or edge of a polygon is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'polygon' && path.points) {
                // Check if eraser is near any vertex or edge of polygon
                for (let i = 0; i < path.points.length; i++) {
                    const p1 = path.points[i];
                    const p2 = path.points[(i + 1) % path.points.length];
                    
                    // Check vertices
                    const dx = p1.x - position.x;
                    const dy = p1.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                    
                    // Check edges
                    if (distToSegment(position, p1, p2) <= radius) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  TEXT DETECTION
            // - Checks if eraser is near text element with larger hit area
            // ----------------------------------------------------
            else if (path.tool === 'text') {
                // Check if eraser is near text position
                const dx = path.position.x - position.x;
                const dy = path.position.y - position.y;
                
                // Use a larger hit area for text to make selection easier
                // Estimate width based on text length
                const textWidth = path.text.length * (path.lineWidth * 5);
                const textHeight = path.lineWidth * 20;
                
                // Check if position is within text bounding box
                // Note: Text is positioned at bottom-left, so mostly extends upward from the position point
                if (position.x >= path.position.x - 5 && 
                    position.x <= path.position.x + textWidth + 5 &&
                    position.y >= path.position.y - textHeight - 5 && 
                    position.y <= path.position.y + 5) {
                    erasedAny = true;
                    return false; // Remove this path
                }
                
                // Also include a radius check for clicking near the text position point
                const hitRadius = Math.max(30, path.lineWidth * 10);
                if (dx*dx + dy*dy <= hitRadius*hitRadius) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  LINE DETECTION
            // - Checks if eraser is near a straight line
            // ----------------------------------------------------
            else if (path.tool === 'line') {
                // Check if eraser is near the line
                const distance = coreMathDistanceToLineSegment(
                    path.startPoint.x, path.startPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    position.x, position.y
                );
                
                if (distance < radius) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  ARC DETECTION
            // - Checks if eraser is near a quadratic Bezier toolmapMarkupSketchArc
            // ----------------------------------------------------
            else if (path.tool === 'toolmapMarkupSketchArc') {
                // Check if eraser is near the toolmapMarkupSketchArc
                const distance = calcDistanceToQuadraticCurve(
                    path.startPoint.x, path.startPoint.y,
                    path.controlPoint.x, path.controlPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    position.x, position.y
                );
                
                if (distance < radius) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            
            return true; // Keep this path
        });
        
        // ----------------------------------------------------
        // HANDLER SECTION |  RESULT PROCESSING
        // - Handles UI updates and returns erasure status
        // ----------------------------------------------------
        if (erasedAny) {
            // Redraw if we erased anything
            renderLoop();
        }
        
        return erasedAny && originalLength > markupPaths.length;
    }

    // ----------------------------------------------------
    // FUNCTION |  POINT-TO-LINE DISTANCE CALCULATION
    // - Calculates the shortest distance from a point to a line segment
    // - Offloaded to coreMathLibrary.js
    // function coreMathDistanceToLineSegment
    // ----------------------------------------------------


    // Add function to find text element at a specific position
    function findTextElementAt(position) {
        // Search through markup paths for text elements near the position
        for (let i = markupPaths.length - 1; i >= 0; i--) {  // Start from newest elements
            const path = markupPaths[i];
            if (path.tool === 'text') {
                // Calculate distance from click to text position
                const dx = path.position.x - position.x;
                const dy = path.position.y - position.y;
                
                // Use a larger hit area for text to make selection easier
                // Estimate width based on text length
                const textWidth = path.text.length * (path.lineWidth * 5);
                const textHeight = path.lineWidth * 20;
                
                // Check if position is within text bounding box
                // Note: Text is positioned at bottom-left, so mostly extends upward from the position point
                if (position.x >= path.position.x - 5 && 
                    position.x <= path.position.x + textWidth + 5 &&
                    position.y >= path.position.y - textHeight - 5 && 
                    position.y <= path.position.y + 5) {
                    return path;
                }
                
                // Also include a radius check for clicking near the text position point
                const hitRadius = Math.max(30, path.lineWidth * 10);
                if (dx*dx + dy*dy <= hitRadius*hitRadius) {
                    return path;
                }
            }
        }
        return null;
    }

    // Find any element at the given position
    function findElementAt(pos) {
        const hitRadius = 10 / zoomFactor; // Hit radius in plan coordinates
        
        // Search through paths in reverse order (most recently added first)
        for (let i = markupPaths.length - 1; i >= 0; i--) {
            const path = markupPaths[i];
            
            if (path.tool === 'pencil') {
                // For pencil paths, check distance to each line segment
                for (let j = 1; j < path.points.length; j++) {
                    const p1 = path.points[j-1];
                    const p2 = path.points[j];
                    
                    if (coreMathDistanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }
                }
            } else if (path.tool === 'rectangle') {
                // Check if point is near rectangle outline
                const x = path.startPoint.x;
                const y = path.startPoint.y;
                const width = path.endPoint.x - path.startPoint.x;
                const height = path.endPoint.y - path.startPoint.y;
                
                // Check each edge of the rectangle
                if (coreMathDistanceToLineSegment(x, y, x + width, y, pos.x, pos.y) < hitRadius ||
                    coreMathDistanceToLineSegment(x + width, y, x + width, y + height, pos.x, pos.y) < hitRadius ||
                    coreMathDistanceToLineSegment(x + width, y + height, x, y + height, pos.x, pos.y) < hitRadius ||
                    coreMathDistanceToLineSegment(x, y + height, x, y, pos.x, pos.y) < hitRadius) {
                    return path;
                }
            } else if (path.tool === 'circle') {
                // Get circle parameters based on format
                let centerX, centerY, radius;
                
                if (path.centerPoint && path.radius !== undefined) {
                    // New format
                    centerX = path.centerPoint.x;
                    centerY = path.centerPoint.y;
                    radius = path.radius;
                } else {
                    // Old format
                    centerX = (path.startPoint.x + path.endPoint.x) / 2;
                    centerY = (path.startPoint.y + path.endPoint.y) / 2;
                    const dx = path.endPoint.x - path.startPoint.x;
                    const dy = path.endPoint.y - path.startPoint.y;
                    radius = Math.sqrt(dx*dx + dy*dy) / 2;
                }
                
                // Calculate distance from point to center
                const dx = pos.x - centerX;
                const dy = pos.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Check if point is near circle outline
                if (Math.abs(distance - radius) < hitRadius) {
                    return path;
                }
            } else if (path.tool === 'polygon') {
                // Check if point is near any edge of the polygon
                for (let j = 0; j < path.points.length; j++) {
                    const p1 = path.points[j];
                    const p2 = path.points[(j + 1) % path.points.length];
                    
                    if (coreMathDistanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }
                }
            } else if (path.tool === 'arrow') {
                // For arrow, check distance to the bezier curve
                const points = sampleBezierCurve(
                    path.startPoint, 
                    path.control1, 
                    path.control2, 
                    path.endPoint, 
                    20
                );
                
                // Check each segment of sampled curve
                for (let j = 1; j < points.length; j++) {
                    const p1 = points[j-1];
                    const p2 = points[j];
                    
                    if (coreMathDistanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }
                }
                
                // Also check arrow head
                // Get direction at end point
                const endDir = calculateCurveEndDirection(path.control2, path.endPoint);
                const angle = Math.atan2(endDir.y, endDir.x);
                
                // Arrow head size
                const arrowSize = path.lineWidth * 8;
                
                // Check arrow head lines
                const endX = path.endPoint.x;
                const endY = path.endPoint.y;
                
                // First arrow head line
                const head1X = endX - arrowSize * Math.cos(angle - Math.PI/6);
                const head1Y = endY - arrowSize * Math.sin(angle - Math.PI/6);
                
                if (coreMathDistanceToLineSegment(endX, endY, head1X, head1Y, pos.x, pos.y) < hitRadius) {
                    return path;
                }
                
                // Second arrow head line
                const head2X = endX - arrowSize * Math.cos(angle + Math.PI/6);
                const head2Y = endY - arrowSize * Math.sin(angle + Math.PI/6);
                
                if (coreMathDistanceToLineSegment(endX, endY, head2X, head2Y, pos.x, pos.y) < hitRadius) {
                    return path;
                }
            } else if (path.tool === 'text') {
                // For text, use a rectangular hit area
                const textWidth = path.text.length * (path.lineWidth * 10);
                const textHeight = path.lineWidth * 20;
                
                if (pos.x >= path.position.x - 5 && 
                    pos.x <= path.position.x + textWidth + 5 &&
                    pos.y >= path.position.y - textHeight - 5 &&
                    pos.y <= path.position.y + 5) {
                    return path;
                }
            } else if (path.tool === 'line') {  // Added in v1.8.5 for straight line tool
                // Check if point is near the line
                const distance = coreMathDistanceToLineSegment(
                    path.startPoint.x, path.startPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    pos.x, pos.y
                );
                
                if (distance < hitRadius) {
                    return path;
                }
            } else if (path.tool === 'toolmapMarkupSketchArc') { // <<< Added Arc Tool Logic
                // Check if point is near the toolmapMarkupSketchArc
                const distance = calcDistanceToQuadraticCurve(
                    path.startPoint.x, path.startPoint.y,
                    path.controlPoint.x, path.controlPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    pos.x, pos.y
                );
                
                if (distance < hitRadius) {
                    return path;
                }
            }
        }
        
        return null; // No element found at the position
    }

    // ----------------------------------------------------
    // FUNCTION |  ELEMENT SELECTION
    // - This section introduced in v1.6.6
    // Handles selection of markup elements and shows appropriate handles
    // ----------------------------------------------------
    function selectElement(element) {
        selectedElement = element;
        
        // If it's a text element and we're in selection mode, open the text editor
        if (element.tool === 'text' && currentMarkupTool === 'selection') {
            editingTextElement = element;
            textPlacementPoint = element.position;
            isTextPlacing = true;
            
            // Calculate screen position for the dialog - position it above and to the right 
            // to avoid covering the text when editing
            const screenX = Math.max(20, element.position.x * zoomFactor + offsetX + 30); // Offset to the right
            const screenY = Math.max(20, element.position.y * zoomFactor + offsetY - 180); // Position well above the text
            
            // Make sure the dialog is visible and correctly positioned
            showTextDialog(screenX, screenY, element.text || '');
            
            // Ensure the dialog button says "Update Text" instead of "Add Text"
            document.getElementById('markup-text-confirm').textContent = 'Update Text';
        }
        
        // Create selection handles based on the element type
        createSelectionHandles(element);
    }

    // ----------------------------------------------------
    // FUNCTION |  SELECTION CLEARING
    // - This section introduced in v1.6.6
    // Clears the current selection and removes any handles
    // ----------------------------------------------------
    function clearSelection() {
        selectedElement = null;
        clearSelectionHandles();
        
        // Remove any selection handles container
        const handleContainer = document.getElementById('selection-handles');
        if (handleContainer) {
            handleContainer.remove();
        }
    }

    // ----------------------------------------------------
    // FUNCTION |  SELECTION HANDLE CREATION
    // - This section introduced in v1.6.6
    // Creates visual handles for manipulating selected elements
    // ----------------------------------------------------
    function createSelectionHandles(element) {
        if (!element) return;
        
        // Clear previous selection handles
        const handleContainer = document.getElementById('selection-handles');
        if (handleContainer) {
            handleContainer.remove();
        }
        
        // Create a container for handles
        const container = document.createElement('div');
        container.id = 'selection-handles';
        container.style.position = 'absolute';
        container.style.left = '0';
        container.style.top = '0';
        container.style.pointerEvents = 'none';
        document.getElementById('app').appendChild(container);
        
        if (element.tool === 'pencil') {
            // Create handles for each point in the path
            for (let i = 0; i < element.points.length; i += Math.max(1, Math.floor(element.points.length / 8))) {
                createHandle(element.points[i], 'point-' + i, container);
            }
        } else if (element.tool === 'rectangle') {
            // Create handles for the corners of the rectangle
            createHandle(element.startPoint, 'start', container);
            createHandle({x: element.endPoint.x, y: element.startPoint.y}, 'top-right', container);
            createHandle(element.endPoint, 'end', container);
            createHandle({x: element.startPoint.x, y: element.endPoint.y}, 'bottom-left', container);
        } else if (element.tool === 'circle') {
            // Get circle parameters
            let centerX, centerY, radius;
            
            if (element.centerPoint && element.radius !== undefined) {
                // New format
                centerX = element.centerPoint.x;
                centerY = element.centerPoint.y;
                radius = element.radius;
                
                // Create handle for center
                createHandle({x: centerX, y: centerY}, 'center', container);
                
                // Create handles for cardinal points
                createHandle({x: centerX + radius, y: centerY}, 'right', container);
                createHandle({x: centerX, y: centerY - radius}, 'top', container);
                createHandle({x: centerX - radius, y: centerY}, 'left', container);
                createHandle({x: centerX, y: centerY + radius}, 'bottom', container);
            } else {
                // Old format
                const centerX = (element.startPoint.x + element.endPoint.x) / 2;
                const centerY = (element.startPoint.y + element.endPoint.y) / 2;
                const radiusX = Math.abs(element.endPoint.x - element.startPoint.x) / 2;
                const radiusY = Math.abs(element.endPoint.y - element.startPoint.y) / 2;
                
                // Create handles for corners and center
                createHandle(element.startPoint, 'start', container);
                createHandle(element.endPoint, 'end', container);
                createHandle({x: element.startPoint.x, y: element.endPoint.y}, 'bottom-left', container);
                createHandle({x: element.endPoint.x, y: element.startPoint.y}, 'top-right', container);
                createHandle({x: centerX, y: centerY}, 'center', container);
            }
        } else if (element.tool === 'text') {
            // For text, create a handle at the position
            createHandle(element.position, 'start', container);
        } else if (element.tool === 'arrow') {
            // For arrows, create handles for each control point
            createHandle(element.startPoint, 'start', container);
            createHandle(element.endPoint, 'end', container);
            createHandle(element.control1, 'control1', container);
            createHandle(element.control2, 'control2', container);
        } else if (element.tool === 'polygon') {
            // Create handles for each point of the polygon
            for (let i = 0; i < element.points.length; i++) {
                createHandle(element.points[i], 'point-' + i, container);
            }
        }
    }

    // ----------------------------------------------------
    // FUNCTION |  SELECTION HANDLE REMOVAL
    // - This section introduced in v1.7.3
    // Removes all selection handles from the DOM
    // ----------------------------------------------------
    function clearSelectionHandles() {
        // Remove any existing selection handles from DOM
        document.querySelectorAll('.selection-handle').forEach(handle => {
            if (handle && handle.parentNode) {
                handle.parentNode.removeChild(handle);
            }
        });
        selectionHandles = [];
        
        // Clear arrow controls if they're visible
        clearArrowControls();
    }

    // ----------------------------------------------------
    // FUNCTION |  ELEMENT MOVEMENT
    // - This section introduced in v1.6.6
    // Handles moving selected elements to new positions
    // ----------------------------------------------------
    function moveElement(element, newPosition) {
        if (!element) return;
        
        // Apply the movement offset to the new position
        newPosition = {
            x: newPosition.x + moveOffset.x,
            y: newPosition.y + moveOffset.y
        };
        
        if (element.tool === 'pencil') {
            // For pencil paths, move all points
            const dx = newPosition.x - element.points[0].x;
            const dy = newPosition.y - element.points[0].y;
            
            for (let i = 0; i < element.points.length; i++) {
                element.points[i].x += dx;
                element.points[i].y += dy;
            }
        } else if (element.tool === 'text') {
            // For text, move the position
            element.position.x = newPosition.x;
            element.position.y = newPosition.y;
        } else if (element.tool === 'arrow') {
            // For arrows, move all points
            const dx = newPosition.x - element.startPoint.x;
            const dy = newPosition.y - element.startPoint.y;
            
            element.startPoint.x += dx;
            element.startPoint.y += dy;
            element.endPoint.x += dx;
            element.endPoint.y += dy;
            element.control1.x += dx;
            element.control1.y += dy;
            element.control2.x += dx;
            element.control2.y += dy;
        } else if (element.tool === 'rectangle') {
            // For rectangles, move both corners
            const dx = newPosition.x - element.startPoint.x;
            const dy = newPosition.y - element.startPoint.y;
            
            element.startPoint.x += dx;
            element.startPoint.y += dy;
            element.endPoint.x += dx;
            element.endPoint.y += dy;
        } else if (element.tool === 'circle') {
            if (element.centerPoint && element.radius !== undefined) {
                // New format - move the center point
                element.centerPoint.x = newPosition.x;
                element.centerPoint.y = newPosition.y;
            } else {
                // Old format - move both points
                const dx = newPosition.x - ((element.startPoint.x + element.endPoint.x) / 2);
                const dy = newPosition.y - ((element.startPoint.y + element.endPoint.y) / 2);
                
                element.startPoint.x += dx;
                element.startPoint.y += dy;
                element.endPoint.x += dx;
                element.endPoint.y += dy;
            }
        } else if (element.tool === 'polygon') {
            // For polygons, move all points
            const dx = newPosition.x - element.points[0].x;
            const dy = newPosition.y - element.points[0].y;
            
            for (let i = 0; i < element.points.length; i++) {
                element.points[i].x += dx;
                element.points[i].y += dy;
            }
        }
        
        // Update selection handles
        updateAllHandlePositions();
    }

    // Delete the currently selected element
    function deleteSelectedElement() {
        if (!selectedElement) return;
        
        // Save state before deletion
        saveMarkupState();
        
        // Find and remove the selected element from markupPaths
        const index = markupPaths.indexOf(selectedElement);
        if (index !== -1) {
            markupPaths.splice(index, 1);
        }
        
        // Clear selection
        clearSelection();
    }



    // First, let's add a new function to update handle positions whenever the canvas transform changes
    function updateAllHandlePositions() {
        // Update selection handles
        if (selectedElement) {
            createSelectionHandles(selectedElement);
        }
        
        // Update arrow control points
        if (currentMarkupTool === 'arrow' && arrowState === 'edit' && currentArrow) {
            updateControlPointPositions();
        }
    }

    // Add clipboard variables to the existing markup toolset variables section
    let clipboardElement = null; // Stores the copied element
    let pasteOffset = { x: 20, y: 20 }; // Default offset for pasted elements
    let consecutivePastes = 0; // Counter for consecutive pastes to offset multiple pastes

    // Function to copy the selected element
    function copySelectedElement() {
        if (!selectedElement) return;
        
        // Deep clone the selected element
        clipboardElement = JSON.parse(JSON.stringify(selectedElement));
        
        // Reset consecutive pastes counter
        consecutivePastes = 0;
        
        // Visual feedback (optional)
        showCopyFeedback();
    }

    // Function to paste the copied element
    function pasteElement(e) {
        if (!clipboardElement) return;
        
        // Save state before pasting
        saveMarkupState();
        
        // Create a deep clone of the clipboard element
        const newElement = JSON.parse(JSON.stringify(clipboardElement));
        
        // Get mouse position if available, otherwise use view center
        let targetPos;
        if (e.clientX !== undefined && e.clientY !== undefined) {
            const rect = planCanvas.getBoundingClientRect();
            targetPos = canvasToPlanCoords(e.clientX - rect.left, e.clientY - rect.top);
        } else {
            // Default to center of visible area if no mouse position
            targetPos = {
                x: (planCanvas.width / 2 - offsetX) / zoomFactor,
                y: (planCanvas.height / 2 - offsetY) / zoomFactor
            };
        }
        
        // Calculate incremental offset for consecutive pastes
        const currentOffset = {
            x: pasteOffset.x + (consecutivePastes * 10),
            y: pasteOffset.y + (consecutivePastes * 10)
        };
        
        // Increment counter for next paste
        consecutivePastes++;
        
        // Depending on the type of element, adjust position
        if (newElement.tool === 'pencil' && newElement.points) {
            // Calculate original bounding box
            let minX = Infinity, minY = Infinity;
            for (const point of clipboardElement.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
            }
            
            // Offset all points
            for (let i = 0; i < newElement.points.length; i++) {
                // Move to target position + offset
                newElement.points[i].x = newElement.points[i].x - minX + targetPos.x + currentOffset.x / zoomFactor;
                newElement.points[i].y = newElement.points[i].y - minY + targetPos.y + currentOffset.y / zoomFactor;
            }
        } 
        else if (newElement.tool === 'text') {
            // Move text to new position
            newElement.position = {
                x: targetPos.x + currentOffset.x / zoomFactor,
                y: targetPos.y + currentOffset.y / zoomFactor
            };
        }
        else if (newElement.tool === 'arrow') {
            // Calculate the original arrow's bounding box center
            const originalCenterX = (clipboardElement.startPoint.x + clipboardElement.endPoint.x) / 2;
            const originalCenterY = (clipboardElement.startPoint.y + clipboardElement.endPoint.y) / 2;
            
            // Calculate vector from original center to each point
            const vectors = {
                startPoint: {
                    x: clipboardElement.startPoint.x - originalCenterX,
                    y: clipboardElement.startPoint.y - originalCenterY
                },
                endPoint: {
                    x: clipboardElement.endPoint.x - originalCenterX,
                    y: clipboardElement.endPoint.y - originalCenterY
                },
                control1: {
                    x: clipboardElement.control1.x - originalCenterX,
                    y: clipboardElement.control1.y - originalCenterY
                },
                control2: {
                    x: clipboardElement.control2.x - originalCenterX,
                    y: clipboardElement.control2.y - originalCenterY
                }
            };
            
            // Apply vectors to new position
            newElement.startPoint = {
                x: targetPos.x + vectors.startPoint.x + currentOffset.x / zoomFactor,
                y: targetPos.y + vectors.startPoint.y + currentOffset.y / zoomFactor
            };
            newElement.endPoint = {
                x: targetPos.x + vectors.endPoint.x + currentOffset.x / zoomFactor,
                y: targetPos.y + vectors.endPoint.y + currentOffset.y / zoomFactor
            };
            newElement.control1 = {
                x: targetPos.x + vectors.control1.x + currentOffset.x / zoomFactor,
                y: targetPos.y + vectors.control1.y + currentOffset.y / zoomFactor
            };
            newElement.control2 = {
                x: targetPos.x + vectors.control2.x + currentOffset.x / zoomFactor,
                y: targetPos.y + vectors.control2.y + currentOffset.y / zoomFactor
            };
        }
        else if (newElement.tool === 'rectangle' || newElement.tool === 'circle') {
            // Calculate width and height of the original shape
            const width = clipboardElement.endPoint.x - clipboardElement.startPoint.x;
            const height = clipboardElement.endPoint.y - clipboardElement.startPoint.y;
            
            // Position the new shape at the target position
            newElement.startPoint = {
                x: targetPos.x + currentOffset.x / zoomFactor,
                y: targetPos.y + currentOffset.y / zoomFactor
            };
            newElement.endPoint = {
                x: targetPos.x + width + currentOffset.x / zoomFactor,
                y: targetPos.y + height + currentOffset.y / zoomFactor
            };
        }
        else if (newElement.tool === 'polygon' && newElement.points) {
            // Calculate original bounding box
            let minX = Infinity, minY = Infinity;
            for (const point of clipboardElement.points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
            }
            
            // Offset all points
            for (let i = 0; i < newElement.points.length; i++) {
                // Move to target position + offset
                newElement.points[i].x = newElement.points[i].x - minX + targetPos.x + currentOffset.x / zoomFactor;
                newElement.points[i].y = newElement.points[i].y - minY + targetPos.y + currentOffset.y / zoomFactor;
            }
        }
        
        // Add the new element to the markup paths
        markupPaths.push(newElement);
        
        // Select the newly pasted element
        selectedElement = newElement;
        createSelectionHandles(newElement);
        
        // Update the canvas
        renderLoop();
    }
    
    // Function to show visual feedback when copying
    function showCopyFeedback() {
        // Create a temporary message element
        const feedback = document.createElement('div');
        feedback.textContent = 'Element copied';
        feedback.style.position = 'absolute';
        feedback.style.top = '60px';
        feedback.style.left = '50%';
        feedback.style.transform = 'translateX(-50%)';
        feedback.style.background = 'rgba(0, 0, 0, 0.7)';
        feedback.style.color = 'white';
        feedback.style.padding = '10px 20px';
        feedback.style.borderRadius = '5px';
        feedback.style.zIndex = '10000';
        feedback.style.pointerEvents = 'none';
        
        // Add to DOM
        document.body.appendChild(feedback);
        
        // Remove after a short delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transition = 'opacity 0.5s';
            setTimeout(() => document.body.removeChild(feedback), 500);
        }, 1500);
    }

    // Draw a sketchy polygon
    function drawSketchyPolygon(context, polygon) {
        if (polygon.points.length < 2) return;
        
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.strokeStyle = polygon.color;
        context.lineWidth = polygon.lineWidth;
        
        // Add deterministic seed for consistent randomness
        if (!polygon.seed) {
            polygon.seed = Math.floor(Math.random() * 10000);
        }
        
        // Draw each line segment with enhanced sketchiness
        for (let i = 0; i < polygon.points.length; i++) {
            const p1 = polygon.points[i];
            const p2 = polygon.points[(i + 1) % polygon.points.length];
            
            // Use our new sketchy segment function with deterministic randomness
            drawPenSketchStrokeSegment(context, p1.x, p1.y, p2.x, p2.y, 
                polygon.lineWidth, polygon.color, polygon.seed + i * 100);
        }
        
        // Add some reinforcement marks at vertices for technical pen effect
        context.globalAlpha = 0.3;
        for (let i = 0; i < polygon.points.length; i++) {
            const p = polygon.points[i];
            // Small mark at vertex
            const jitter = polygon.lineWidth * 0.2;
            
            context.beginPath();
            context.lineWidth = polygon.lineWidth * 0.7;
            
            // Use deterministic random offsets
            const jitterX = jitter * (coreMathPseudoRandomValueGen(polygon.seed + i * 200) - 0.5);
            const jitterY = jitter * (coreMathPseudoRandomValueGen(polygon.seed + i * 200 + 10) - 0.5);
            context.moveTo(p.x + jitterX, p.y + jitterY);
            
            // Draw a short line in a consistent random direction
            const angle = coreMathPseudoRandomValueGen(polygon.seed + i * 300) * Math.PI * 2;
            const length = polygon.lineWidth * (1 + coreMathPseudoRandomValueGen(polygon.seed + i * 400));
            context.lineTo(
                p.x + Math.cos(angle) * length,
                p.y + Math.sin(angle) * length
            );
            context.stroke();
        }
        
        context.restore();
    }

    // ----------------------------------------------------
    // FUNCTION |  DRAW SKETCHY LINE
    // - Added in v1.8.5 (02-Apr-2025)
    // - Draws a sketchy straight line with handdrawn appearance
    // ----------------------------------------------------
    function drawSketchyLine(context, line) {
        if (!line.startPoint || !line.endPoint) return;
        
        context.save();
        context.translate(offsetX, offsetY);
        context.scale(zoomFactor, zoomFactor);
        context.strokeStyle = line.color;
        context.lineWidth = line.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        
        // Ensure line has a seed for deterministic randomness
        if (!line.seed) {
            line.seed = Math.floor(Math.random() * 10000);
        }
        
        // Calculate line properties
        const x1 = line.startPoint.x;
        const y1 = line.startPoint.y;
        const x2 = line.endPoint.x;
        const y2 = line.endPoint.y;
        
        // Use the sketchy segment function for consistent style with rectangle edges
        drawPenSketchStrokeSegment(context, x1, y1, x2, y2, line.lineWidth, line.color, line.seed);
        
        context.restore();
    }

    // Show the control points for editing an arrow
    function showArrowControls(arrow) {
        // Set current arrow and state
        currentArrow = arrow;
        arrowState = 'edit';
        
        // Update UI
        planCanvas.classList.remove('markup-arrow-end');
        planCanvas.classList.add('markup-arrow-edit');
        
        // Create control points if they don't exist
        if (!controlPoints.length) {
            // Create control points for arrow
            const startPoint = document.createElement('div');
            startPoint.className = 'control-point start-point';
            startPoint.type = 'start';
            document.getElementById('canvas-container').appendChild(startPoint);
            
            const endPoint = document.createElement('div');
            endPoint.className = 'control-point end-point';
            endPoint.type = 'end';
            document.getElementById('canvas-container').appendChild(endPoint);
            
            const control1 = document.createElement('div');
            control1.className = 'control-point control1';
            control1.type = 'control1';
            document.getElementById('canvas-container').appendChild(control1);
            
            const control2 = document.createElement('div');
            control2.className = 'control-point control2';
            control2.type = 'control2';
            document.getElementById('canvas-container').appendChild(control2);
            
            // Add to control points array
            controlPoints = [startPoint, endPoint, control1, control2];
        }
        
        // Update positions
        updateControlPointPositions();
    }

    // Create a handle element for selection
    function createHandle(position, type, container) {
        const handle = document.createElement('div');
        handle.className = 'selection-handle';
        handle.dataset.type = type;
        handle.style.position = 'absolute';
        handle.style.width = '10px';
        handle.style.height = '10px';
        handle.style.borderRadius = '50%';
        handle.style.backgroundColor = 'yellow';
        handle.style.border = '1px solid #333';
        handle.style.transform = 'translate(-50%, -50%)';
        handle.style.pointerEvents = 'none'; // Don't interfere with canvas events
        
        // Calculate the position in screen coordinates
        const screenX = position.x * zoomFactor + offsetX;
        const screenY = position.y * zoomFactor + offsetY;
        
        handle.style.left = screenX + 'px';
        handle.style.top = screenY + 'px';
        
        container.appendChild(handle);
        return handle;
    }
    
    // Update positions of all selection handles
    function updateAllHandlePositions() {
        // If there's no selected element, there's nothing to update
        if (!selectedElement) return;
        
        // Update the handles by recreating them
        createSelectionHandles(selectedElement);
        
        // Also update arrow control points if we're editing an arrow
        if (currentArrow && arrowState === 'edit') {
            updateControlPointPositions();
        }
    }


    // ============================================================
    // PRIMARY FUNCTION |  MOUSE RELEASE HANDLER
    // - This section introduced in v1.5.0
    // Processes mouse up events for measurements and markup elements
    // ============================================================

    // ----------------------------------------------------
    // HANDLER SECTION |  MARKUP TOOLS RELEASE HANDLING
    // - Processes release events for markup tool interactions
    // ----------------------------------------------------
    function onMouseUp(e) {
        // Handle markup tools if active
        if (isMarkupToolsetActive && currentMarkupTool) {
            const pos = canvasToPlanCoords(e.offsetX, e.offsetY);
            
            // ----------------------------------------------------
            // EVENT HANDLER |  SELECTION TOOL FINALIZATION
            // - Completes element movement and saves state
            // ----------------------------------------------------
            if (currentMarkupTool === 'selection' && isMovingElement) {
                // Finalize the move
                isMovingElement = false;
                moveStartPosition = null;
                
                // Save state after moving an element
                if (selectedElement) {
                    saveMarkupState();
                }
                return;
            }

            // ----------------------------------------------------
            // EVENT HANDLER |  DRAWING TOOLS FINALISATION
            // - Completes pencil strokes and eraser actions
            // ----------------------------------------------------
            else if ((currentMarkupTool === 'pencil' || currentMarkupTool === 'eraser') && currentMarkupPath) {
                // Finalize the current path
                if (currentMarkupPath.points.length > 1) {
                    markupPaths.push(currentMarkupPath);
                    saveMarkupState();
                }
                currentMarkupPath = null;
                return;
            }
            
            // ----------------------------------------------------
            // EVENT HANDLER |  STRAIGHT LINE TOOL FINALISATION
            // - Added in v1.8.5 (02-Apr-2025)
            // - Completes straight line drawing operations
            // ----------------------------------------------------
            else if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
                // Update final end point
                currentLine.endPoint = pos;
                
                // Finalize the current line if it has a valid length
                const dx = currentLine.endPoint.x - currentLine.startPoint.x;
                const dy = currentLine.endPoint.y - currentLine.startPoint.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                
                if (length > 5) { // Only save if line has a meaningful length
                    markupPaths.push(currentLine);
                    saveMarkupState();
                }
                
                // Reset line drawing state
                isLineDrawing = false;
                currentLine = null;
                return;
            }
            
            // ----------------------------------------------------
            // EVENT HANDLER |  ARROW TOOL FINALISATION
            // - Handles arrow creation and control point editing
            // ----------------------------------------------------
            else if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
                // Add arrow to paths when released
                markupPaths.push(currentArrow);
                
                // Set up for editing the arrow control points
                showArrowControls(currentArrow);
                
                // Save state after creating an arrow
                saveMarkupState();
                
                return;
            }
            else if (currentMarkupTool === 'arrow' && arrowState === 'edit' && activeControlPoint) {
                // Calculate the position in plan coordinates
                const planPos = {
                    x: (activeControlPoint.x - offsetX) / zoomFactor,
                    y: (activeControlPoint.y - offsetY) / zoomFactor
                };
                
                // Update arrow accordingly
                if (activeControlPoint.type === 'start') {
                    currentArrow.startPoint = planPos;
                } else if (activeControlPoint.type === 'end') {
                    currentArrow.endPoint = planPos;
                } else if (activeControlPoint.type === 'control1') {
                    currentArrow.control1 = planPos;
                } else if (activeControlPoint.type === 'control2') {
                    currentArrow.control2 = planPos;
                }
                
                activeControlPoint = null;
                
                // Save state after editing an arrow
                saveMarkupState();
                return;
            }

            // ----------------------------------------------------
            // EVENT HANDLER |  SHAPE TOOL FINALISATION
            // - Completes rectangle and circle creation
            // ----------------------------------------------------
            else if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
                // Finalize rectangle
                if (Math.abs(currentShape.endPoint.x - currentShape.startPoint.x) > 5 && 
                    Math.abs(currentShape.endPoint.y - currentShape.startPoint.y) > 5) {
                    // Only add if rectangle has meaningful size
                    markupPaths.push(currentShape);
                    
                    // Save state after creating a shape
                    saveMarkupState();
                }
                
                currentShape = null;
                isShapeDrawing = false;
                return;
            }
            else if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
                // Finalize circle - add it if the radius is meaningful
                if (currentShape.radius > 5) {
                    markupPaths.push(currentShape);
                    
                    // Save state after creating a shape
                    saveMarkupState();
                }
                
                currentShape = null;
                isShapeDrawing = false;
                return;
            }
            
            return;
        }
        
        // ----------------------------------------------------
        // HANDLER SECTION |  MEASUREMENT TOOLS RELEASE
        // - Processes release events for measurement tools
        // ----------------------------------------------------
        
        // ----------------------------------------------------
        // EVENT HANDLER |  LINEAR MEASUREMENT COMPLETION
        // - Finalizes linear measurements and shows confirm button
        // ----------------------------------------------------
        if (currentTool === "linear" && isLinearMeasuring) {
            if (measuringPoints.length === 2 && !linearMeasurementLocked) {
                // Lock the second point in place when mouse is released
                linearMeasurementLocked = true;
                
                // Position the confirm button correctly
                adjustConfirmButtonPosition();
                finishBtn.style.display = "block";
            }
            return;
        }
        
        // ----------------------------------------------------
        // EVENT HANDLER |  AREA MEASUREMENT COMPLETION
        // - Handles polygon area tool completion on double-click
        // ----------------------------------------------------
        if (currentTool === "area" && e.detail === 2) {
            // Double-click completes the polygon area tool
            isAreaComplete = true;
            renderLoop();
            return;
        }
        
        // ----------------------------------------------------
        // EVENT HANDLER |  RECTANGLE MEASUREMENT COMPLETION
        // - Finalizes rectangle measurements and shows confirm button
        // ----------------------------------------------------
        if (currentTool === "rectangle" && isRectMeasuring) {
            if (isRectDragging) {
                isRectDragging = false; // Stop dragging on mouse up
                
                // Show the confirm button
                adjustConfirmButtonPosition();
                finishBtn.style.display = "block";
            }
            return;
        }
        
        isDragging = false;
    }

    // ========================================================================
    // PRIMARY FUNCTION |  DISTANCE CALCULATION UTILITIES
    // - This section introduced in v1.6.0
    // Contains utility functions for calculating distances and curves
    // ======================================================================== 

    // ----------------------------------------------------
    // HELPER FUNCTION |  POINT TO LINE DISTANCE
    // - Calculates shortest distance from point to line segment
    // ----------------------------------------------------
    function coreMathDistanceToLineSegment(x1, y1, x2, y2, px, py) {
        // Calculate squared length of line segment
        const lengthSq = (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1);
        
        // If segment is a point, return distance to that point
        if (lengthSq === 0) return Math.sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1));
        
        // Calculate projection of point onto line, parametrized from 0 to 1
        const t = ((px-x1)*(x2-x1) + (py-y1)*(y2-y1)) / lengthSq;
        
        // If projection is outside segment, return distance to closest endpoint
        if (t < 0) return Math.sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1));
        if (t > 1) return Math.sqrt((px-x2)*(px-x2) + (py-y2)*(py-y2));
        
        // Calculate closest point on line
        const closestX = x1 + t * (x2-x1);
        const closestY = y1 + t * (y2-y1);
        
        // Return distance from point to closest point on line
        return Math.sqrt((px-closestX)*(px-closestX) + (py-closestY)*(py-closestY));
    }
    


    // ========================================================================
    // PRIMARY FUNCTION |  MARKUP TOOL CANCELLATION
    // - This section introduced in v1.7.3
    // Handles cancellation and reset of markup tool states
    // ======================================================================== 
    function cancelMarkupTool() {
        currentMarkupTool = null;
        
        // Reset cursor
        planCanvas.className = "";
        
        // Hide cancel button
        document.getElementById('cancelMarkupToolBtn').style.display = 'none';
        
        // Reset all state variables
        currentMarkupPath = null;
        clearSelection();
        clearArrowControls();
        arrowState = 'idle';
        isShapeDrawing = false;
        shapeStartPoint = null;
        currentShape = null;
        
        // Reset line drawing state - Added in v1.8.5
        isLineDrawing = false;
        currentLine = null;

        // Hide any instruction text
        const instructionsDiv = document.getElementById('markup-instructions');
        if (instructionsDiv) {
            instructionsDiv.innerHTML = '';
            instructionsDiv.style.display = 'none';
        }
    }

    // ======================================================================== 
    // FUNCTION |  MARKUP INSTRUCTIONS DISPLAY
    // - This section introduced in v1.6.0
    // Shows tool-specific instructions to guide users on using markup tools
    // ========================================================================

    function showMarkupInstructions(tool) {
        const instructionsDiv = document.getElementById('markup-instructions');
        if (!instructionsDiv) {
            // Create the instructions div if it doesn't exist
            const newInstructionsDiv = document.createElement('div');
            newInstructionsDiv.id = 'markup-instructions';
            newInstructionsDiv.style.position = 'absolute';
            newInstructionsDiv.style.top = '60px';
            newInstructionsDiv.style.left = '50%';
            newInstructionsDiv.style.transform = 'translateX(-50%)';
            newInstructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            newInstructionsDiv.style.color = 'white';
            newInstructionsDiv.style.padding = '8px 12px';
            newInstructionsDiv.style.borderRadius = '4px';
            newInstructionsDiv.style.zIndex = '10000';
            newInstructionsDiv.style.display = 'none';
            document.body.appendChild(newInstructionsDiv);
            
            // Use the newly created div
            showMarkupInstructions(tool);
            return;
        }
        
        let instructions = '';
        
        switch (tool) {
            case 'selection':
                instructions = 'Click to select objects. Click and drag to move selected objects.';
                break;
            case 'pencil':
                instructions = 'Click and drag to draw freehand.';
                break;
            case 'eraser':
                instructions = 'Click and drag over elements to erase them.';
                break;
            case 'arrow':
                instructions = 'Click to set arrow start point, then click or drag to set end point.';
                break;
            case 'text':
                instructions = 'Click to place text. Type your text in the dialog that appears.';
                break;
            case 'line':  // Added in v1.8.5 for straight line tool
                instructions = 'Click and drag to draw a straight line.';
                break;
            case 'rectangle':
                instructions = 'Click and drag to draw a rectangle.';
                break;
            case 'filled-rectangle':
                instructions = 'Click and drag to draw a filled rectangle.';
                break;
            case 'circle':
                instructions = 'Click to set center, then drag to set radius.';
                break;
            case 'toolmapMarkupSketchArc': // <<< Added Arc Tool Logic
                instructions = 'Click to set start point, then click to set control point, then click to set end point.'; // <<< Added Arc Tool Logic
                break; // <<< Added Arc Tool Logic
            default:
                instructions = '';
        }
        
        if (instructions) {
            instructionsDiv.innerHTML = instructions;
            instructionsDiv.style.display = 'block';
            
            // Add click-to-dismiss functionality
            function dismissInstructions() {
                clearTimeout(timeoutId);
                instructionsDiv.style.display = 'none';
                instructionsDiv.removeEventListener('click', dismissInstructions);
            }
            
            instructionsDiv.addEventListener('click', dismissInstructions);
            
            // Auto-dismiss after 2 seconds
            var timeoutId = setTimeout(dismissInstructions, 2000);
        } else {
            instructionsDiv.style.display = 'none';
        }
    }



    // ----------------------------------------------------
    // FUNCTION |  ERASER TOOL IMPLEMENTATION
    // - This section introduced in v1.6.0
    // Detects and removes markup elements that intersect with the eraser tool
    // ========================================================================
    function detectAndEraseElements(position, radius) {
        // ----------------------------------------------------
        // HANDLER SECTION |  ERASER INITIALIZATION
        // - Sets up eraser parameters and tracking variables
        // ----------------------------------------------------
        const eraserRadiusSquared = radius * radius;
        let erasedAny = false;
        const originalLength = markupPaths.length;
        
        // ----------------------------------------------------
        // HANDLER SECTION |  MARKUP ELEMENT DETECTION
        // - Filters markup paths to remove those that intersect with eraser
        // ----------------------------------------------------
        markupPaths = markupPaths.filter(path => {
            // ----------------------------------------------------
            // DETECTION HANDLER |  PENCIL PATH DETECTION
            // - Checks if any point in a freehand path is within eraser radius
            // ----------------------------------------------------
            if (path.tool === 'pencil') {
                // For freehand paths, check if any point is within eraser radius
                for (let i = 0; i < path.points.length; i++) {
                    const dx = path.points[i].x - position.x;
                    const dy = path.points[i].y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            } 
            // ----------------------------------------------------
            // DETECTION HANDLER |  ARROW DETECTION
            // - Checks if any control point of an arrow is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'arrow') {
                // For arrows, check start and end points and control points
                const pointsToCheck = [
                    path.startPoint,
                    path.endPoint,
                    path.control1,
                    path.control2
                ];
                
                for (const point of pointsToCheck) {
                    const dx = point.x - position.x;
                    const dy = point.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  RECTANGLE DETECTION
            // - Checks if any corner or edge of a rectangle is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'rectangle') {
                // Check if eraser is near any corner or edge
                const corners = [
                    { x: path.startPoint.x, y: path.startPoint.y },
                    { x: path.endPoint.x, y: path.startPoint.y },
                    { x: path.startPoint.x, y: path.endPoint.y },
                    { x: path.endPoint.x, y: path.endPoint.y }
                ];
                
                for (const corner of corners) {
                    const dx = corner.x - position.x;
                    const dy = corner.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
                
                // Check if eraser is on edges
                const edges = [
                    {p1: {x: path.startPoint.x, y: path.startPoint.y}, p2: {x: path.endPoint.x, y: path.startPoint.y}},
                    {p1: {x: path.endPoint.x, y: path.startPoint.y}, p2: {x: path.endPoint.x, y: path.endPoint.y}},
                    {p1: {x: path.endPoint.x, y: path.endPoint.y}, p2: {x: path.startPoint.x, y: path.endPoint.y}},
                    {p1: {x: path.startPoint.x, y: path.endPoint.y}, p2: {x: path.startPoint.x, y: path.startPoint.y}}
                ];
                
                for (const edge of edges) {
                    if (distToSegment(position, edge.p1, edge.p2) <= radius) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  CIRCLE DETECTION
            // - Checks if eraser intersects with circle boundary or interior
            // ----------------------------------------------------
            else if (path.tool === 'circle') {
                // Check if eraser is near circle boundary or inside
                const centerX = (path.startPoint.x + path.endPoint.x) / 2;
                const centerY = (path.startPoint.y + path.endPoint.y) / 2;
                const radiusX = Math.abs(path.endPoint.x - path.startPoint.x) / 2;
                const radiusY = Math.abs(path.endPoint.y - path.startPoint.y) / 2;
                
                // Simple approximation for ellipse - use average radius
                const avgRadius = (radiusX + radiusY) / 2;
                const dx = centerX - position.x;
                const dy = centerY - position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (Math.abs(distance - avgRadius) <= radius || distance <= avgRadius) {
                    erasedAny = true;
                    return false;
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  POLYGON DETECTION
            // - Checks if any vertex or edge of a polygon is within eraser radius
            // ----------------------------------------------------
            else if (path.tool === 'polygon' && path.points) {
                // Check if eraser is near any vertex or edge of polygon
                for (let i = 0; i < path.points.length; i++) {
                    const p1 = path.points[i];
                    const p2 = path.points[(i + 1) % path.points.length];
                    
                    // Check vertices
                    const dx = p1.x - position.x;
                    const dy = p1.y - position.y;
                    const distanceSquared = dx * dx + dy * dy;
                    
                    if (distanceSquared <= eraserRadiusSquared) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                    
                    // Check edges
                    if (distToSegment(position, p1, p2) <= radius) {
                        erasedAny = true;
                        return false; // Remove this path
                    }
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  TEXT DETECTION
            // - Checks if eraser is near text element with larger hit area
            // ----------------------------------------------------
            else if (path.tool === 'text') {
                // Check if eraser is near text position
                const dx = path.position.x - position.x;
                const dy = path.position.y - position.y;
                const distanceSquared = dx * dx + dy * dy;
                
                // Make text easier to select by using a larger hit area
                if (distanceSquared <= eraserRadiusSquared * 4) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  LINE DETECTION
            // - Checks if eraser is near a straight line
            // ----------------------------------------------------
            else if (path.tool === 'line') {
                // Check if eraser is near the line
                const distance = coreMathDistanceToLineSegment(
                    path.startPoint.x, path.startPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    position.x, position.y
                );
                
                if (distance < radius) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            // ----------------------------------------------------
            // DETECTION HANDLER |  ARC DETECTION
            // - Checks if eraser is near a quadratic Bezier toolmapMarkupSketchArc
            // ----------------------------------------------------
            else if (path.tool === 'toolmapMarkupSketchArc') {
                // Check if eraser is near the toolmapMarkupSketchArc
                const distance = calcDistanceToQuadraticCurve(
                    path.startPoint.x, path.startPoint.y,
                    path.controlPoint.x, path.controlPoint.y,
                    path.endPoint.x, path.endPoint.y,
                    position.x, position.y
                );
                
                if (distance < radius) {
                    erasedAny = true;
                    return false; // Remove this path
                }
            }
            
            return true; // Keep this path
        });
        
        // ----------------------------------------------------
        // HANDLER SECTION |  RESULT PROCESSING
        // - Handles UI updates and returns erasure status
        // ----------------------------------------------------
        if (erasedAny) {
            // Redraw if we erased anything
            renderLoop();
        }
        
        return erasedAny && originalLength > markupPaths.length;
    }



})();        // <---- This is where the function is immediately executed