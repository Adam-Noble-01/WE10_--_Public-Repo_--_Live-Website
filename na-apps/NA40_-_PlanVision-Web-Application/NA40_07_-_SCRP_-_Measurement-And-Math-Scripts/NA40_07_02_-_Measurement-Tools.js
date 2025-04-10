/*
================================================================================
JAVASCRIPT |  MEASUREMENT TOOLS
- Based on the reference implementation v1.8.8
DESCRIPTION
- Handles measurement tools for linear, area, and rectangle measurements
- Manages drawing and updating measurements on the canvas
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  MEASUREMENT CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for measurement tools
IMPORTANT NOTES
- These settings affect the behavior and appearance of measurements
--------------------------------------------
*/

// Configuration settings
const ROUND_DIMENSIONS_ENABLED = true;  // Whether to round measurements to intervals
const ROUNDING_INTERVAL = 5;            // Round to the nearest X mm (e.g., 5mm)
const BASE_LINE_WIDTH = 2;              // Base line width for drawing measurements
const MARKER_RADIUS = 4;                // Size of measurement points

/*
--------------------------------------------
JAVASCRIPT |  MEASUREMENT STATE VARIABLES
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
--------------------------------------------
*/

// State variables
let currentTool = null;                // Current active measurement tool (linear, area, rectangle)
let measurements = [];                 // Array of saved measurements
let measuringPoints = [];              // Points collected for current measurement
let isLinearMeasuring = false;         // Whether linear measurement is in progress
let linearMeasurementLocked = false;   // Whether linear measurement is locked (prevent accidental changes)
let isRectMeasuring = false;           // Whether rectangle measurement is in progress
let isRectDragging = false;            // Whether user is dragging rectangle corner
let isAreaMeasuring = false;           // Whether area measurement is in progress
let isAreaComplete = false;            // Whether area measurement is complete
let finishBtn = null;                  // Reference to the finish measurement button
let cancelToolBtn = null;              // Reference to the cancel tool button
let instructionsOverlay = null;        // Reference to the instructions overlay
let instructionsText = null;           // Reference to the instructions text element
let mainCanvas = null;                 // Reference to the main canvas
let ctx = null;                        // Canvas context
let offsetX = 0;                       // Canvas pan X offset
let offsetY = 0;                       // Canvas pan Y offset
let zoomFactor = 1;                    // Canvas zoom level

// Marker display configuration
const DISTANCE_OFFSET = 20;
const CONFIRM_BUTTON_OFFSET_X_PC = 20;
const CONFIRM_BUTTON_OFFSET_Y_PC = 20;
const CONFIRM_BUTTON_OFFSET_X_TOUCH = 40;
const CONFIRM_BUTTON_OFFSET_Y_TOUCH = 40;

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners and initializes measurement tools
--------------------------------------------
*/

// FUNCTION |  Initialize measurement tools
// --------------------------------------------------------- //
function initMeasurementTools() {
    // Get DOM references
    mainCanvas = document.getElementById("CNVS__Plan");
    if (!mainCanvas) {
        console.error("Canvas element not found");
        return;
    }
    
    ctx = mainCanvas.getContext("2d");
    finishBtn = document.getElementById("BTTN__Finish-Measurement");
    cancelToolBtn = document.getElementById("BTTN__Cancel-Tool");
    instructionsOverlay = document.getElementById("TOOL__Instructions-Overlay");
    instructionsText = document.getElementById("TOOL__Instructions-Text");
    
    // Set up event listeners for measurement tool buttons
    document.getElementById("BTTN__Linear-Measure").addEventListener("click", () => setTool("linear"));
    document.getElementById("BTTN__Rect-Measure").addEventListener("click", () => setTool("rectangle"));
    document.getElementById("BTTN__Area-Measure").addEventListener("click", () => setTool("area"));
    document.getElementById("BTTN__Clear-Measurements").addEventListener("click", clearMeasurements);
    cancelToolBtn.addEventListener("click", cancelTool);
    
    finishBtn.addEventListener("click", () => {
        if (currentTool === "linear") finalizeMeasurement("linear");
        else if (currentTool === "area") finalizeMeasurement("area");
        else if (currentTool === "rectangle") finalizeMeasurement("rectangle");
    });
    
    console.log("Measurement tools initialized");
}

// FUNCTION |  Set the current measurement tool
// --------------------------------------------------------- //
function setTool(toolName) {
    // Clear any previous measurement in progress
    resetCurrentMeasurement();
    
    // Set the new tool
    currentTool = toolName;
    
    // Update UI based on the selected tool
    if (currentTool === "linear") {
        isLinearMeasuring = true;
        showCancelTool();
        showInstructions("Click to set the start point of your measurement");
        mainCanvas.style.cursor = "crosshair";
    } else if (currentTool === "area") {
        showCancelTool();
        showInstructions("Click to add points to your area measurement.\nClose the shape to complete.");
        mainCanvas.style.cursor = "crosshair";
    } else if (currentTool === "rectangle") {
        isRectMeasuring = true;
        showCancelTool();
        showInstructions("Click and drag to create a rectangle measurement");
        mainCanvas.style.cursor = "crosshair";
    }
    
    console.log(`Measurement tool set to: ${toolName}`);
}

// FUNCTION |  Reset the current measurement in progress
// --------------------------------------------------------- //
function resetCurrentMeasurement() {
    measuringPoints = [];
    isLinearMeasuring = false;
    linearMeasurementLocked = false;
    isRectMeasuring = false;
    isRectDragging = false;
    isAreaMeasuring = false;
    isAreaComplete = false;
    currentTool = null;
    hideInstructions();
    hideCancelTool();
    finishBtn.style.display = "none";
    mainCanvas.style.cursor = "default";
}

// FUNCTION |  Clear all measurements
// --------------------------------------------------------- //
function clearMeasurements() {
    measurements = [];
    resetCurrentMeasurement();
    console.log("All measurements cleared");
}

// FUNCTION |  Cancel the current tool/measurement
// --------------------------------------------------------- //
function cancelTool() {
    resetCurrentMeasurement();
    console.log("Measurement tool canceled");
}

/*
--------------------------------------------
JAVASCRIPT |  EVENT HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Handlers for user interactions with measurement tools
--------------------------------------------
*/

// FUNCTION |  Handle mouse down event for measurements
// --------------------------------------------------------- //
function handleMeasurementMouseDown(event) {
    if (!currentTool) return;
    
    const rect = mainCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const planCoords = toPlanCoords(mouseX, mouseY);
    
    if (currentTool === "linear") {
        handleLinearMeasurementMouseDown(planCoords);
    } else if (currentTool === "area") {
        handleAreaMeasurementMouseDown(planCoords);
    } else if (currentTool === "rectangle") {
        handleRectMeasurementMouseDown(planCoords);
    }
}

// FUNCTION |  Handle mouse move event for measurements
// --------------------------------------------------------- //
function handleMeasurementMouseMove(event) {
    if (!currentTool) return;
    
    const rect = mainCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const planCoords = toPlanCoords(mouseX, mouseY);
    
    if (currentTool === "linear") {
        handleLinearMeasurementMouseMove(planCoords);
    } else if (currentTool === "rectangle" && isRectDragging) {
        handleRectMeasurementMouseMove(planCoords);
    }
}

// FUNCTION |  Handle mouse up event for measurements
// --------------------------------------------------------- //
function handleMeasurementMouseUp(event) {
    if (currentTool === "rectangle" && isRectDragging) {
        isRectDragging = false;
        
        if (measuringPoints.length === 2) {
            // Ensure the rectangle has non-zero dimensions
            if (Math.abs(measuringPoints[1].x - measuringPoints[0].x) > 1 && 
                Math.abs(measuringPoints[1].y - measuringPoints[0].y) > 1) {
                finishBtn.style.display = "block";
                adjustConfirmButtonPosition();
            } else {
                // Reset if rectangle is too small
                measuringPoints = [];
            }
        }
    }
}

// FUNCTION |  Handle linear measurement mouse down
// --------------------------------------------------------- //
function handleLinearMeasurementMouseDown(coords) {
    if (measuringPoints.length === 0) {
        // First point
        measuringPoints.push(coords);
        showInstructions("Click to set the end point of your measurement");
    } else if (measuringPoints.length === 1) {
        // Second point
        measuringPoints.push(coords);
        finishBtn.style.display = "block";
        adjustConfirmButtonPosition();
        showInstructions("Click 'Confirm Measurement' to save this measurement");
    }
}

// FUNCTION |  Handle linear measurement mouse move
// --------------------------------------------------------- //
function handleLinearMeasurementMouseMove(coords) {
    if (measuringPoints.length === 1) {
        // Show dynamic preview
        if (measuringPoints[0].x !== coords.x || measuringPoints[0].y !== coords.y) {
            // Create a temporary second point
            const tempPoints = [measuringPoints[0], coords];
            // Draw preview
            // (This will be handled by the render loop)
        }
    }
}

// FUNCTION |  Handle area measurement mouse down
// --------------------------------------------------------- //
function handleAreaMeasurementMouseDown(coords) {
    // Add a new point
    measuringPoints.push(coords);
    
    // Check if the user is closing the polygon (clicking near the first point)
    if (measuringPoints.length > 2) {
        const firstPoint = measuringPoints[0];
        const dist = Math.hypot(coords.x - firstPoint.x, coords.y - firstPoint.y);
        
        // If within a certain distance of the start point, close the polygon
        if (dist < 15 / zoomFactor) {
            // Replace the last point with the first point to ensure a perfect close
            measuringPoints.pop();
            measuringPoints.push({ x: firstPoint.x, y: firstPoint.y });
            finishBtn.style.display = "block";
            adjustConfirmButtonPosition();
            showInstructions("Click 'Confirm Measurement' to save this area measurement");
        } else {
            showInstructions(`Added point ${measuringPoints.length}. Click near the first point to close the shape.`);
        }
    } else {
        showInstructions(`Added point ${measuringPoints.length}. Continue adding points to create your area.`);
    }
}

// FUNCTION |  Handle rectangle measurement mouse down
// --------------------------------------------------------- //
function handleRectMeasurementMouseDown(coords) {
    if (measuringPoints.length === 0) {
        // First corner
        measuringPoints.push(coords);
        // Add a temporary second corner at the same position
        measuringPoints.push({ x: coords.x, y: coords.y });
        isRectDragging = true;
        showInstructions("Drag to set the size of your rectangle");
    }
}

// FUNCTION |  Handle rectangle measurement mouse move
// --------------------------------------------------------- //
function handleRectMeasurementMouseMove(coords) {
    if (isRectDragging && measuringPoints.length === 2) {
        // Update the second corner
        measuringPoints[1] = coords;
    }
}

/*
--------------------------------------------
JAVASCRIPT |  UI HELPERS
- Introduced in v2.0.0
DESCRIPTION
- Helper functions for UI interactions
--------------------------------------------
*/

// FUNCTION |  Show the cancel tool button
// --------------------------------------------------------- //
function showCancelTool() {
    if (cancelToolBtn) {
        cancelToolBtn.style.display = "block";
    }
}

// FUNCTION |  Hide the cancel tool button
// --------------------------------------------------------- //
function hideCancelTool() {
    if (cancelToolBtn) {
        cancelToolBtn.style.display = "none";
    }
}

// FUNCTION |  Show instructions overlay with text
// --------------------------------------------------------- //
function showInstructions(text) {
    if (instructionsOverlay && instructionsText) {
        instructionsText.textContent = text;
        instructionsOverlay.style.display = "flex";
        
        // Auto-hide after a delay
        setTimeout(() => {
            instructionsOverlay.classList.add("TOOL__Instructions-Overlay--fade-out");
            setTimeout(() => {
                instructionsOverlay.style.display = "none";
                instructionsOverlay.classList.remove("TOOL__Instructions-Overlay--fade-out");
            }, 1000);
        }, 3000);
    }
}

// FUNCTION |  Hide the instructions overlay
// --------------------------------------------------------- //
function hideInstructions() {
    if (instructionsOverlay) {
        instructionsOverlay.style.display = "none";
    }
}

// FUNCTION |  Position the confirm measurement button near the last point
// --------------------------------------------------------- //
function adjustConfirmButtonPosition() {
    if (!finishBtn || measuringPoints.length === 0) return;
    
    let posX, posY;
    
    if (currentTool === "linear" || currentTool === "rectangle") {
        // For linear and rectangle, position near the second point
        posX = measuringPoints[1].x * zoomFactor + offsetX;
        posY = measuringPoints[1].y * zoomFactor + offsetY;
    } else if (currentTool === "area") {
        // For area, position near the last point
        const lastPoint = measuringPoints[measuringPoints.length - 1];
        posX = lastPoint.x * zoomFactor + offsetX;
        posY = lastPoint.y * zoomFactor + offsetY;
    }
    
    // Adjust to ensure button is fully visible
    const btnWidth = finishBtn.offsetWidth;
    const btnHeight = finishBtn.offsetHeight;
    const canvasRect = mainCanvas.getBoundingClientRect();
    
    posX = Math.min(Math.max(posX, 0), canvasRect.width - btnWidth);
    posY = Math.min(Math.max(posY, 0), canvasRect.height - btnHeight);
    
    finishBtn.style.left = posX + "px";
    finishBtn.style.top = posY + "px";
}

/*
--------------------------------------------
JAVASCRIPT |  MEASUREMENT CALCULATIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for calculating measurement values
--------------------------------------------
*/

// FUNCTION |  Calculate distance between two points
// --------------------------------------------------------- //
function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

// FUNCTION |  Calculate the centroid of a polygon
// --------------------------------------------------------- //
function polygonCentroid(pts) {
    let xSum = 0, ySum = 0;
    pts.forEach(p => { xSum += p.x; ySum += p.y; });
    return { x: xSum / pts.length, y: ySum / pts.length };
}

// FUNCTION |  Calculate the area of a polygon
// --------------------------------------------------------- //
function polygonArea(pts) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += (pts[i].x * pts[j].y) - (pts[j].x * pts[i].y);
    }
    return Math.abs(area / 2);
}

// FUNCTION |  Convert screen coordinates to plan coordinates
// --------------------------------------------------------- //
function toPlanCoords(x, y) {
    return {
        x: (x - offsetX) / zoomFactor,
        y: (y - offsetY) / zoomFactor
    };
}

/*
--------------------------------------------
JAVASCRIPT |  MEASUREMENT FINALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Functions for finalizing measurements
--------------------------------------------
*/

// FUNCTION |  Finalize a measurement
// --------------------------------------------------------- //
function finalizeMeasurement(type) {
    if (type === "linear" && measuringPoints.length === 2) {
        finalizeLinearMeasurement();
    } else if (type === "area" && measuringPoints.length > 2) {
        finalizeAreaMeasurement();
    } else if (type === "rectangle" && measuringPoints.length === 2) {
        finalizeRectangleMeasurement();
    }
}

// FUNCTION |  Finalize a linear measurement
// --------------------------------------------------------- //
function finalizeLinearMeasurement() {
    const [start, end] = measuringPoints;
    const pxDist = dist(start, end);
    
    // Get the conversion rate from the measurement scaling module
    const metresPerPixel = window.measurementScaling.getMetresPerPixel();
    const rawMm = pxDist * metresPerPixel * 1000;
    
    let mmDist = ROUND_DIMENSIONS_ENABLED
        ? Math.round(rawMm / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
        : Math.round(rawMm);

    measurements.push({
        type: "linear",
        points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
        distanceMM: mmDist
    });
    
    // Reset all state variables
    resetCurrentMeasurement();
}

// FUNCTION |  Finalize an area measurement
// --------------------------------------------------------- //
function finalizeAreaMeasurement() {
    const areaPx2 = polygonArea(measuringPoints);
    
    // Get the conversion rate from the measurement scaling module
    const metresPerPixel = window.measurementScaling.getMetresPerPixel();
    const areaM2 = (areaPx2 * metresPerPixel * metresPerPixel).toFixed(2);

    measurements.push({
        type: "area",
        points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
        areaM2: areaM2
    });
    
    // Reset state
    resetCurrentMeasurement();
}

// FUNCTION |  Finalize a rectangle measurement
// --------------------------------------------------------- //
function finalizeRectangleMeasurement() {
    const widthPx = Math.abs(measuringPoints[1].x - measuringPoints[0].x);
    const heightPx = Math.abs(measuringPoints[1].y - measuringPoints[0].y);
    
    // Get the conversion rate from the measurement scaling module
    const metresPerPixel = window.measurementScaling.getMetresPerPixel();
    
    const widthMm = ROUND_DIMENSIONS_ENABLED
        ? Math.round((widthPx * metresPerPixel * 1000) / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
        : Math.round(widthPx * metresPerPixel * 1000);
        
    const heightMm = ROUND_DIMENSIONS_ENABLED
        ? Math.round((heightPx * metresPerPixel * 1000) / ROUNDING_INTERVAL) * ROUNDING_INTERVAL
        : Math.round(heightPx * metresPerPixel * 1000);
        
    const areaPx2 = widthPx * heightPx;
    const areaM2 = (areaPx2 * metresPerPixel * metresPerPixel).toFixed(2);

    measurements.push({
        type: "rectangle",
        points: JSON.parse(JSON.stringify(measuringPoints)), // Make a deep copy
        widthMm: widthMm,
        heightMm: heightMm,
        areaM2: areaM2
    });
    
    // Reset state
    resetCurrentMeasurement();
}

/*
--------------------------------------------
JAVASCRIPT |  DRAWING FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for drawing measurements on the canvas
--------------------------------------------
*/

// FUNCTION |  Draw all measurements on the canvas
// --------------------------------------------------------- //
function drawAllMeasurements(ctx) {
    if (!ctx) return;
    
    // Store these for reference by other functions
    window.measurementTools.offsetX = offsetX;
    window.measurementTools.offsetY = offsetY;
    window.measurementTools.zoomFactor = zoomFactor;
    
    // Draw saved measurements
    measurements.forEach(m => {
        if (m.type === "linear") {
            drawLine(ctx, m.points, "blue");
            drawMarkers(ctx, m.points, "blue");
            drawLineLabel(ctx, m.points, m.distanceMM, "blue");
        } else if (m.type === "area") {
            drawPolygon(ctx, m.points, "rgba(255,0,0,0.2)", "red");
            drawMarkers(ctx, m.points, "red");
            drawAreaLabel(ctx, m);
            drawEdgeLabels(ctx, m.points, "red");
        } else if (m.type === "rectangle") {
            drawRectangle(ctx, m.points[0], m.points[1], "blue", "rgba(0,0,255,0.2)");
            drawMarkers(ctx, m.points, "blue");
            drawRectLabel(ctx, m.points[0], m.points[1], m.widthMm, m.heightMm, m.areaM2);
        }
    });
    
    // Draw current measurement in progress
    if (currentTool === "linear" && isLinearMeasuring) {
        if (measuringPoints.length === 2) {
            drawLine(ctx, measuringPoints, "green");
            drawMarkers(ctx, measuringPoints, "green");
        } else if (measuringPoints.length === 1) {
            drawMarkers(ctx, measuringPoints, "green");
        }
    }
    
    if (currentTool === "area" && measuringPoints.length > 0) {
        drawOpenPolygon(ctx, measuringPoints, "red");
        drawMarkers(ctx, measuringPoints, "red");
    }
    
    if (currentTool === "rectangle" && isRectMeasuring && measuringPoints.length === 2) {
        drawRectangle(ctx, measuringPoints[0], measuringPoints[1], "green");
        drawMarkers(ctx, measuringPoints, "green");
    } else if (currentTool === "rectangle" && measuringPoints.length === 1) {
        drawMarkers(ctx, measuringPoints, "green");
    }
    
    // Position the confirm button if needed
    if (finishBtn && finishBtn.style.display === "block") {
        adjustConfirmButtonPosition();
    }
}

// FUNCTION |  Draw a line between two points
// --------------------------------------------------------- //
function drawLine(ctx, points, strokeStyle) {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = (BASE_LINE_WIDTH * 0.50) / zoomFactor;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    
    ctx.restore();
}

// FUNCTION |  Draw markers at points
// --------------------------------------------------------- //
function drawMarkers(ctx, points, color) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1 / zoomFactor;
    
    let doubleRadius = MARKER_RADIUS * 2 / zoomFactor;
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

// FUNCTION |  Draw a label for a line measurement
// --------------------------------------------------------- //
function drawLineLabel(ctx, points, distanceMM, color) {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.fillStyle = color;
    ctx.font = (18 / zoomFactor) + "px sans-serif";
    
    const mid = { 
        x: (points[0].x + points[1].x) / 2, 
        y: (points[0].y + points[1].y) / 2 
    };
    
    const offsetVal = 10 / zoomFactor;
    ctx.fillText(distanceMM + " mm", mid.x + offsetVal, mid.y - offsetVal);
    
    ctx.restore();
}

// FUNCTION |  Draw a rectangle
// --------------------------------------------------------- //
function drawRectangle(ctx, start, end, strokeStyle, fillStyle = null) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = (BASE_LINE_WIDTH * 0.50) / zoomFactor;
    
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

// FUNCTION |  Draw a label for a rectangle measurement
// --------------------------------------------------------- //
function drawRectLabel(ctx, start, end, widthMm, heightMm, areaM2) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.fillStyle = "blue";
    ctx.font = (18 / zoomFactor) + "px sans-serif";
    
    const mid = { 
        x: (start.x + end.x) / 2, 
        y: (start.y + end.y) / 2 
    };
    
    // Draw area in the middle
    ctx.fillText(areaM2 + " m²", mid.x, mid.y);
    
    // Draw width label
    const widthMid = {
        x: (start.x + end.x) / 2,
        y: Math.min(start.y, end.y) - 10 / zoomFactor
    };
    ctx.fillText(widthMm + " mm", widthMid.x, widthMid.y);
    
    // Draw height label
    const heightMid = {
        x: Math.max(start.x, end.x) + 10 / zoomFactor,
        y: (start.y + end.y) / 2
    };
    ctx.fillText(heightMm + " mm", heightMid.x, heightMid.y);
    
    ctx.restore();
}

// FUNCTION |  Draw a polygon
// --------------------------------------------------------- //
function drawPolygon(ctx, points, fillStyle, strokeStyle) {
    if (points.length < 3) return;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = (BASE_LINE_WIDTH * 0.50) / zoomFactor;
    
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

// FUNCTION |  Draw an open polygon (not closed)
// --------------------------------------------------------- //
function drawOpenPolygon(ctx, points, strokeStyle) {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = (BASE_LINE_WIDTH * 0.50) / zoomFactor;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    
    // If more than 2 points, draw a dashed line back to the first point
    if (points.length > 2) {
        ctx.setLineDash([5 / zoomFactor, 5 / zoomFactor]);
        ctx.lineTo(points[0].x, points[0].y);
        ctx.setLineDash([]);
    }
    
    ctx.stroke();
    ctx.restore();
}

// FUNCTION |  Draw a label for an area measurement
// --------------------------------------------------------- //
function drawAreaLabel(ctx, measurement) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.fillStyle = "red";
    ctx.font = (18 / zoomFactor) + "px sans-serif";
    
    const centroid = polygonCentroid(measurement.points);
    ctx.fillText(measurement.areaM2 + " m²", centroid.x, centroid.y);
    
    ctx.restore();
}

// FUNCTION |  Draw labels for each edge of a polygon
// --------------------------------------------------------- //
function drawEdgeLabels(ctx, points, color) {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);
    ctx.fillStyle = color;
    ctx.font = (14 / zoomFactor) + "px sans-serif";
    
    // Get the conversion rate from the measurement scaling module
    const metresPerPixel = window.measurementScaling.getMetresPerPixel();
    
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const p1 = points[i];
        const p2 = points[j];
        
        // Calculate midpoint
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        
        // Calculate length
        const lengthPx = dist(p1, p2);
        const lengthMm = Math.round(lengthPx * metresPerPixel * 1000);
        
        // Draw length at midpoint slightly offset
        const offsetVal = 5 / zoomFactor;
        ctx.fillText(lengthMm + " mm", mid.x + offsetVal, mid.y - offsetVal);
    }
    
    ctx.restore();
}

/*
--------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Exposes measurement tool functions for external use
--------------------------------------------
*/

// Create a namespace for measurement tools
window.MeasurementTools = {
    // Tool activation
    activateLinearMeasurementTool: () => setTool('linear'),
    activateRectangleMeasurementTool: () => setTool('rectangle'),
    activateAreaMeasurementTool: () => setTool('area'),
    
    // Tool management
    clearAllMeasurements: clearMeasurements,
    cancelActiveTool: cancelTool,
    completeMeasurement: () => {
        if (currentTool) {
            finalizeMeasurement(currentTool);
        }
    },
    
    // Initialization
    init: initMeasurementTools
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', window.MeasurementTools.init);

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for DOM content and drawing data
--------------------------------------------
*/

// EVENT |  Initialize when the DOM is fully loaded
// --------------------------------------------------------- //
document.addEventListener('DOMContentLoaded', () => {
    console.log('Measurement Tools module waiting for drawing to be loaded...');
});

// EVENT |  Initialize when a drawing is loaded
// --------------------------------------------------------- //
document.addEventListener('drawingLoaded', () => {
    initMeasurementTools();
});

// INITIALIZATION |  Auto-initialize if document is already loaded
// --------------------------------------------------------- //
if (document.readyState === 'complete') {
    console.log('Document already loaded, initializing Measurement Tools module...');
    initMeasurementTools();
} 