// ===================================================================================
// JAVASCRIPT | MARKUP SKETCH DRAWING TOOLS
// ===================================================================================
//
// FILE NAME | toolsMarkupSketchDrawingTools.js
// FILE PATH | ./toolsMarkupSketchDrawingTools.js
//
// OFFLOADED | [Current Date]
// Status: Initial Implementation
//
// Description:
// - This module contains all sketchy drawing functions for markup tools
// - These functions handle the visual rendering of markup elements with a sketchy style
// - Functions use the core math library for calculations
// - The module maintains its own internal state for drawing configuration
// ----------------------------------------------------------------------------------



// ----------------------------------------------------------------------------------
// MODULE IMPORTS
// ----------------------------------------------------------------------------------
import {
    coreMathDistanceCalc,
    coreMathDistanceToLineSegment,
    coreMathGeomPolygonArea,
    coreMathGeomPolygonCentroid,
    coreMathGeomGenerateQuadraticCurvePoints,
    coreMathGeomBezierPoint,
    coreMathPseudoRandomValueGen
} from './coreMathLibrary.js';



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------

// Drawing configuration state
let drawingState = {
    ctx: null,                    // Canvas context
    sketchiness: 0.5,             // 0 = clean, 1 = very sketchy
    pressureVariation: 0.2,       // Line width variation
    markupColor: '#960000',       // Default color
    markupLineWidth: 4,           // Default line width
    initialized: false,           // Track if module has been initialized
    lastOperation: {              // Track status of the last operation
        success: false,
        timestamp: null,
        type: null,
        message: 'No operations performed yet'
    }
};



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Initialize Drawing Module
// ----------------------------------------------------------------------------------
// - Sets up the drawing module with canvas context and configuration
// - Must be called before using any drawing functions
// - Returns status object with information about the initialization

function initDrawingModule(context, options = {}) {
    try {
        // Store the canvas context
        drawingState.ctx = context;
        
        // Apply any custom options
        Object.assign(drawingState, options);
        
        // Mark as initialized
        drawingState.initialized = true;
        
        // Update last operation info
        drawingState.lastOperation = {
            success: true,
            timestamp: new Date().toISOString(),
            type: 'initialization',
            message: 'Markup sketch drawing module initialized successfully'
        };
        
        console.log("Markup sketch drawing module initialized");
        
        return {
            success: true,
            message: "Markup sketch drawing module initialized successfully",
            state: {
                sketchiness: drawingState.sketchiness,
                markupColor: drawingState.markupColor,
                markupLineWidth: drawingState.markupLineWidth,
                pressureVariation: drawingState.pressureVariation
            }
        };
    } catch (error) {
        const errorMsg = `Failed to initialize drawing module: ${error.message}`;
        console.error(errorMsg);
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'initialization',
            message: errorMsg,
            error: error.message
        };
        
        return {
            success: false,
            message: errorMsg,
            error: error.message
        };
    }
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Get Drawing State
// ----------------------------------------------------------------------------------
// - Returns the current drawing configuration state
// - Useful for main.js to query current settings

function getDrawingState() {
    return {
        initialized: drawingState.initialized,
        sketchiness: drawingState.sketchiness,
        pressureVariation: drawingState.pressureVariation,
        markupColor: drawingState.markupColor,
        markupLineWidth: drawingState.markupLineWidth,
        lastOperation: drawingState.lastOperation
    };
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Update Drawing Configuration
// ----------------------------------------------------------------------------------
// - Updates drawing configuration settings (color, line width, sketchiness)
// - Can be called anytime to change drawing appearance
// - Returns status of the update operation

function updateDrawingConfig(options) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        const errorMsg = "Drawing module not initialized. Call initDrawingModule first.";
        console.warn(errorMsg);
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'config_update',
            message: errorMsg
        };
        
        return {
            success: false,
            message: errorMsg
        };
    }
    
    try {
        // Track which properties were updated
        const updatedProps = Object.keys(options);
        
        // Update state with new options
        Object.assign(drawingState, options);
        
        // Update last operation info
        drawingState.lastOperation = {
            success: true,
            timestamp: new Date().toISOString(),
            type: 'config_update',
            message: `Drawing configuration updated successfully`,
            updatedProperties: updatedProps
        };
        
        return {
            success: true,
            message: "Drawing configuration updated successfully",
            updatedProperties: updatedProps,
            newState: {
                sketchiness: drawingState.sketchiness,
                markupColor: drawingState.markupColor,
                markupLineWidth: drawingState.markupLineWidth,
                pressureVariation: drawingState.pressureVariation
            }
        };
    } catch (error) {
        const errorMsg = `Failed to update drawing configuration: ${error.message}`;
        console.error(errorMsg);
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'config_update',
            message: errorMsg,
            error: error.message
        };
        
        return {
            success: false,
            message: errorMsg,
            error: error.message
        };
    }
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Path
// ----------------------------------------------------------------------------------
// - Draws a freehand sketchy path based on a series of points

function drawSketchyPath(path, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness
    } = options;
    
    if (!path || !path.points || path.points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // Start a new path
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    
    // Draw each segment with slight variation for sketchiness
    for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        const prevPoint = path.points[i-1];
        
        // Add slight randomness to points based on sketchiness
        const jitterAmount = lineWidth * sketchiness * 0.3;
        const jitterX = coreMathPseudoRandomValueGen(i * 2) * jitterAmount - jitterAmount/2;
        const jitterY = coreMathPseudoRandomValueGen(i * 2 + 1) * jitterAmount - jitterAmount/2;
        
        ctx.lineTo(point.x + jitterX, point.y + jitterY);
    }
    
    ctx.stroke();
    ctx.restore();
    
    // Update last operation status
    drawingState.lastOperation = {
        success: true,
        timestamp: new Date().toISOString(),
        type: 'path_drawing',
        message: `Drew sketchy path with ${path.points.length} points`
    };
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Rectangle
// ----------------------------------------------------------------------------------
// - Draws a rectangle with a hand-drawn sketchy appearance
// - rect: { x, y, width, height }

function drawSketchyRectangle(rect, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness,
        fillStyle = null
    } = options;
    
    if (!rect) return;
    
    const { x, y, width, height } = rect;
    
    // Create points for the rectangle
    const points = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
    ];
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // If fill style is provided, fill the rectangle first
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.fill();
    }
    
    // Draw each edge with sketchiness
    const baseNoise = lineWidth * sketchiness;
    const seed = x + y + width + height; // Use rectangle dimensions for consistent randomization
    
    ctx.beginPath();
    
    // Draw each side with slight variations
    for (let i = 0; i < 4; i++) {
        const startPoint = points[i];
        const endPoint = points[(i + 1) % 4];
        
        // Create slightly curved lines for each edge
        const segmentCount = Math.max(5, Math.floor(
            coreMathDistanceCalc(startPoint, endPoint) / 15
        ));
        
        // Start from the first point
        ctx.moveTo(startPoint.x, startPoint.y);
        
        // Draw segments with variation
        for (let j = 1; j <= segmentCount; j++) {
            const t = j / segmentCount;
            const prevT = (j - 1) / segmentCount;
            
            // Calculate the "ideal" straight line point
            const idealX = startPoint.x + (endPoint.x - startPoint.x) * t;
            const idealY = startPoint.y + (endPoint.y - startPoint.y) * t;
            
            // Add noise based on sketchiness
            const noise = coreMathPseudoRandomValueGen(seed + i * 100 + j) * baseNoise * 2 - baseNoise;
            
            // Find perpendicular direction to add noise
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            let perpX = 0, perpY = 0;
            if (length > 0) {
                perpX = -dy / length;
                perpY = dx / length;
            }
            
            // Add variation perpendicular to the line
            const x = idealX + perpX * noise;
            const y = idealY + perpY * noise;
            
            // For first segment of first side, move to start
            if (i === 0 && j === 1) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    }
    
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Circle
// ----------------------------------------------------------------------------------
// - Draws a circle with a hand-drawn sketchy appearance
// - circle: { x, y, radius }

function drawSketchyCircle(circle, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness,
        fillStyle = null
    } = options;
    
    if (!circle) return;
    
    const { x, y, radius } = circle;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // If fill style is provided, fill the circle first
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw the sketchy circle
    const baseNoise = lineWidth * sketchiness;
    const seed = x + y + radius; // Use circle properties for consistent randomization
    
    // Calculate number of segments based on radius
    const segmentCount = Math.max(20, Math.floor(radius * 0.5));
    
    ctx.beginPath();
    
    // Create the first point
    let firstX = 0, firstY = 0;
    let prevX = 0, prevY = 0;
    
    // Draw segments with variation
    for (let i = 0; i <= segmentCount; i++) {
        const angle = (i / segmentCount) * Math.PI * 2;
        const idealX = x + Math.cos(angle) * radius;
        const idealY = y + Math.sin(angle) * radius;
        
        // Add noise based on sketchiness
        const noise = coreMathPseudoRandomValueGen(seed + i) * baseNoise * 2 - baseNoise;
        const radiusVariation = radius + noise;
        
        const actualX = x + Math.cos(angle) * radiusVariation;
        const actualY = y + Math.sin(angle) * radiusVariation;
        
        if (i === 0) {
            firstX = actualX;
            firstY = actualY;
            ctx.moveTo(actualX, actualY);
        } else {
            // For more sketchiness, add some control points for curves
            if (sketchiness > 0.3 && i % 2 === 0) {
                const midX = (prevX + actualX) / 2;
                const midY = (prevY + actualY) / 2;
                const ctrlX = midX + (coreMathPseudoRandomValueGen(seed + i * 10) * baseNoise * 4 - baseNoise * 2);
                const ctrlY = midY + (coreMathPseudoRandomValueGen(seed + i * 20) * baseNoise * 4 - baseNoise * 2);
                
                ctx.quadraticCurveTo(ctrlX, ctrlY, actualX, actualY);
            } else {
                ctx.lineTo(actualX, actualY);
            }
        }
        
        prevX = actualX;
        prevY = actualY;
    }
    
    // Close the path with a curve back to the first point
    if (sketchiness > 0.3) {
        const midX = (prevX + firstX) / 2;
        const midY = (prevY + firstY) / 2;
        const ctrlX = midX + (coreMathPseudoRandomValueGen(seed + 999) * baseNoise * 4 - baseNoise * 2);
        const ctrlY = midY + (coreMathPseudoRandomValueGen(seed + 1000) * baseNoise * 4 - baseNoise * 2);
        
        ctx.quadraticCurveTo(ctrlX, ctrlY, firstX, firstY);
    } else {
        ctx.closePath();
    }
    
    ctx.stroke();
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Line
// ----------------------------------------------------------------------------------
// - Draws a straight line with a hand-drawn sketchy appearance
// - line: { x1, y1, x2, y2 }

function drawSketchyLine(line, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness
    } = options;
    
    if (!line) return;
    
    const { x1, y1, x2, y2 } = line;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // Add some variation to the line
    const baseNoise = lineWidth * sketchiness;
    const seed = x1 + y1 + x2 + y2; // Use line coordinates for consistent randomization
    
    // Calculate distance to determine number of segments
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const segmentCount = Math.max(4, Math.floor(distance / 20));
    
    // Calculate perpendicular vector to add variance
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    let perpX = 0, perpY = 0;
    if (length > 0) {
        perpX = -dy / length;
        perpY = dx / length;
    }
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    // Draw segments with slight variations
    for (let i = 1; i <= segmentCount; i++) {
        const t = i / segmentCount;
        
        // Calculate ideal point on straight line
        const idealX = x1 + dx * t;
        const idealY = y1 + dy * t;
        
        // Skip middle segments for long lines to create breaks
        if (sketchiness > 0.6 && segmentCount > 5 && (i > segmentCount/3 && i < 2*segmentCount/3)) {
            const skipProbability = coreMathPseudoRandomValueGen(seed + i * 1000);
            if (skipProbability < 0.3) continue;
        }
        
        // Add noise perpendicular to the line direction
        const noise = coreMathPseudoRandomValueGen(seed + i * 100) * baseNoise * 2 - baseNoise;
        const x = idealX + perpX * noise;
        const y = idealY + perpY * noise;
        
        // Add pressure variation (line width changes)
        if (drawingState.pressureVariation > 0) {
            const pressureVariation = drawingState.pressureVariation;
            const pressureChange = coreMathPseudoRandomValueGen(seed + i * 200) * pressureVariation * 2 - pressureVariation;
            ctx.lineWidth = lineWidth * (1 + pressureChange);
        }
        
        ctx.lineTo(x, y);
    }
    
    // Ensure the line ends at the exact end point
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Polygon
// ----------------------------------------------------------------------------------
// - Draws a polygon with a hand-drawn sketchy appearance
// - points: Array of {x, y} points defining the polygon

function drawSketchyPolygon(points, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness,
        fillStyle = null
    } = options;
    
    if (!points || points.length < 3) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // If fill style is provided, fill the polygon first
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.closePath();
        ctx.fill();
    }
    
    // Draw each edge with sketchiness
    const baseNoise = lineWidth * sketchiness;
    const seed = points.reduce((acc, p) => acc + p.x + p.y, 0); // Use all points for randomization
    
    ctx.beginPath();
    
    // Draw each side with variations
    for (let i = 0; i < points.length; i++) {
        const startPoint = points[i];
        const endPoint = points[(i + 1) % points.length];
        
        // Draw a sketchy line for this segment
        drawSketchySegment(startPoint, endPoint, {
            color,
            lineWidth,
            sketchiness,
            seed: seed + i * 1000
        });
    }
    
    ctx.stroke();
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Segment
// ----------------------------------------------------------------------------------
// - Helper function to draw a sketchy line segment between two points
// - Used by drawSketchyPolygon and other functions

function drawSketchySegment(startPoint, endPoint, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness,
        seed = 0
    } = options;
    
    const distance = coreMathDistanceCalc(startPoint, endPoint);
    const segmentCount = Math.max(2, Math.floor(distance / 15));
    const baseNoise = lineWidth * sketchiness;
    
    // Find perpendicular direction to add noise
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    let perpX = 0, perpY = 0;
    if (length > 0) {
        perpX = -dy / length;
        perpY = dx / length;
    }
    
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    
    // Draw segments with variation
    for (let j = 1; j <= segmentCount; j++) {
        const t = j / segmentCount;
        
        // Calculate the "ideal" straight line point
        const idealX = startPoint.x + (endPoint.x - startPoint.x) * t;
        const idealY = startPoint.y + (endPoint.y - startPoint.y) * t;
        
        // Add noise based on sketchiness
        const noise = coreMathPseudoRandomValueGen(seed + j * 10) * baseNoise * 2 - baseNoise;
        
        // Add variation perpendicular to the line
        const x = idealX + perpX * noise;
        const y = idealY + perpY * noise;
        
        ctx.lineTo(x, y);
    }
    
    ctx.stroke();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Arrow Line
// ----------------------------------------------------------------------------------
// - Draws an arrow with a hand-drawn sketchy appearance
// - x1, y1: Start point
// - x2, y2: End point

function drawSketchyArrowLine(x1, y1, x2, y2, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness,
        seed = x1 + y1 + x2 + y2
    } = options;
    
    // Draw the line part
    drawSketchyLine({x1, y1, x2, y2}, {color, lineWidth, sketchiness});
    
    // Calculate arrow head parameters
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = Math.min(30, Math.max(15, lineWidth * 4));
    const arrowWidth = arrowLength * 0.6;
    
    // Calculate arrow head points
    const arrowAngle1 = angle + Math.PI - Math.PI/8;
    const arrowAngle2 = angle + Math.PI + Math.PI/8;
    
    const arrowX1 = x2 + Math.cos(arrowAngle1) * arrowLength;
    const arrowY1 = y2 + Math.sin(arrowAngle1) * arrowLength;
    
    const arrowX2 = x2 + Math.cos(arrowAngle2) * arrowLength;
    const arrowY2 = y2 + Math.sin(arrowAngle2) * arrowLength;
    
    // Add some sketchiness to arrow head
    const noise1X = coreMathPseudoRandomValueGen(seed + 1) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise1Y = coreMathPseudoRandomValueGen(seed + 2) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise2X = coreMathPseudoRandomValueGen(seed + 3) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise2Y = coreMathPseudoRandomValueGen(seed + 4) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    
    // Draw the arrow head
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(arrowX1 + noise1X, arrowY1 + noise1Y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(arrowX2 + noise2X, arrowY2 + noise2Y);
    ctx.stroke();
    
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Arrow
// ----------------------------------------------------------------------------------
// - Draws a complete arrow object with a sketchy appearance
// - arrow: { start: {x, y}, control: {x, y}, end: {x, y} }

function drawArrow(arrow, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        lineWidth = drawingState.markupLineWidth,
        sketchiness = drawingState.sketchiness
    } = options;
    
    if (!arrow || !arrow.start || !arrow.control || !arrow.end) return;
    
    const { start, control, end } = arrow;
    
    // Draw the curved part
    drawArc(arrow, {color, lineWidth, sketchiness});
    
    // Calculate the direction at the end of the curve
    const endDirection = calculateCurveEndDirection(control, end);
    const angle = Math.atan2(endDirection.y, endDirection.x);
    
    // Draw the arrow head
    const arrowLength = Math.min(30, Math.max(15, lineWidth * 4));
    const arrowWidth = arrowLength * 0.6;
    
    // Calculate arrow head points with slight variation
    const arrowAngle1 = angle + Math.PI - Math.PI/8;
    const arrowAngle2 = angle + Math.PI + Math.PI/8;
    
    const seed = start.x + start.y + end.x + end.y;
    const noise1X = coreMathPseudoRandomValueGen(seed + 1) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise1Y = coreMathPseudoRandomValueGen(seed + 2) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise2X = coreMathPseudoRandomValueGen(seed + 3) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    const noise2Y = coreMathPseudoRandomValueGen(seed + 4) * lineWidth * sketchiness * 2 - lineWidth * sketchiness;
    
    const arrowX1 = end.x + Math.cos(arrowAngle1) * arrowLength + noise1X;
    const arrowY1 = end.y + Math.sin(arrowAngle1) * arrowLength + noise1Y;
    
    const arrowX2 = end.x + Math.cos(arrowAngle2) * arrowLength + noise2X;
    const arrowY2 = end.y + Math.sin(arrowAngle2) * arrowLength + noise2Y;
    
    // Draw the arrow head
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX1, arrowY1);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(arrowX2, arrowY2);
    ctx.stroke();
    
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Calculate Curve End Direction
// ----------------------------------------------------------------------------------
// - Helper function to calculate the direction at the end of a quadratic curve
// - Used by drawArrow to position the arrowhead correctly

function calculateCurveEndDirection(controlPoint, endPoint) {
    // Direction is from control point to end point for a quadratic curve
    return {
        x: endPoint.x - controlPoint.x,
        y: endPoint.y - controlPoint.y
    };
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Arc
// ----------------------------------------------------------------------------------
// - Draws a quadratic bezier curve (arc) with a sketchy appearance
// - arcPath: { start: {x, y}, control: {x, y}, end: {x, y} }

function drawArc(arcPathOrContext, options = {}) {
    // Determine if first parameter is context or arcPath
    let arcPath, context;
    
    if (arcPathOrContext && arcPathOrContext.canvas) {
        // First parameter is a canvas context
        context = arcPathOrContext;
        
        // Check if options is actually an arcPath object with the expected properties
        if (options && options.start && options.control && options.end) {
            arcPath = options;
            options = arguments[2] || {}; // Get options from 3rd parameter or use default
        } else {
            console.warn("drawArc called with context but missing valid arcPath object");
            return;
        }
    } else {
        // First parameter is the arcPath object
        arcPath = arcPathOrContext;
        context = null;
    }
    
    // Use provided context or fall back to stored context
    const ctx = context || drawingState.ctx;
    
    // Check if module is initialized or we have a temporary context
    if (!drawingState.initialized && !context) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Validate the arcPath object has all required properties
    if (!arcPath || !arcPath.start || !arcPath.control || !arcPath.end) {
        console.warn("Invalid arcPath object provided to drawArc", arcPath);
        return;
    }
    
    const { start, control, end } = arcPath;
    
    ctx.save();
    ctx.strokeStyle = options.color || drawingState.markupColor;
    ctx.lineWidth = options.lineWidth || drawingState.markupLineWidth;
    const sketchiness = options.sketchiness || drawingState.sketchiness;
    
    // Generate points along the curve
    const curvePoints = coreMathGeomGenerateQuadraticCurvePoints(start, control, end, 30);
    
    // Add sketchiness by varying points
    const baseNoise = ctx.lineWidth * sketchiness;
    const seed = start.x + start.y + control.x + control.y + end.x + end.y;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    
    // Draw segments with variation
    for (let i = 1; i < curvePoints.length; i++) {
        const point = curvePoints[i];
        
        // Add noise to each point
        const noise = coreMathPseudoRandomValueGen(seed + i * 10) * baseNoise * 2 - baseNoise;
        const perpX = (curvePoints[i-1].y - point.y);
        const perpY = -(curvePoints[i-1].x - point.x);
        
        // Normalize perpendicular vector
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        const normalizedPerpX = perpLength > 0 ? perpX / perpLength : 0;
        const normalizedPerpY = perpLength > 0 ? perpY / perpLength : 0;
        
        const x = point.x + normalizedPerpX * noise;
        const y = point.y + normalizedPerpY * noise;
        
        ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw Sketchy Text
// ----------------------------------------------------------------------------------
// - Draws text with a sketchy hand-drawn appearance
// - textObj: { x, y, text, fontSize }

function drawSketchyText(textObj, options = {}) {
    // Check if module is initialized
    if (!drawingState.initialized) {
        console.warn("Drawing module not initialized. Call initDrawingModule first.");
        return;
    }
    
    // Get drawing context and merge default options with provided options
    const ctx = drawingState.ctx;
    const { 
        color = drawingState.markupColor, 
        sketchiness = drawingState.sketchiness
    } = options;
    
    if (!textObj || !textObj.text) return;
    
    const { x, y, text, fontSize = 24 } = textObj;
    
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px 'Caveat', cursive`;
    ctx.textBaseline = 'middle';
    
    // Add some rotation for a more hand-drawn look
    const baseNoise = sketchiness * 0.05;
    const seed = x + y + text.length;
    const rotation = coreMathPseudoRandomValueGen(seed) * baseNoise * 2 - baseNoise;
    
    // Translate and rotate for the sketchy effect
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Draw text with slight position variation for each character
    const characters = text.split('');
    let xOffset = 0;
    
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        
        // Calculate character width
        const charWidth = ctx.measureText(char).width;
        
        // Add some vertical variation
        const yOffset = coreMathPseudoRandomValueGen(seed + i * 10) * fontSize * 0.1 * sketchiness - fontSize * 0.05 * sketchiness;
        
        // Add some character rotation for more sketchiness
        if (sketchiness > 0.3) {
            const charRotation = coreMathPseudoRandomValueGen(seed + i * 20) * 0.1 * sketchiness - 0.05 * sketchiness;
            ctx.save();
            ctx.translate(xOffset, 0);
            ctx.rotate(charRotation);
            ctx.fillText(char, 0, yOffset);
            ctx.restore();
        } else {
            ctx.fillText(char, xOffset, yOffset);
        }
        
        // Move to next character position with slight variation
        const spacing = coreMathPseudoRandomValueGen(seed + i * 30) * charWidth * 0.1 * sketchiness - charWidth * 0.05 * sketchiness;
        xOffset += charWidth + spacing;
    }
    
    ctx.restore();
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION | Draw All Markup Paths
// ----------------------------------------------------------------------------------
// - Master function that draws all markup elements
// - markupPaths: Array of all markup elements to draw
// - Returns information about the drawing operation

function drawAllMarkupPaths(markupPathsOrContext, optionalMarkupPaths) {
    // Handle both new and old function signature:
    // - Old: drawAllMarkupPaths(context)
    // - New: drawAllMarkupPaths(markupPaths)
    
    let context = null;
    let markupPaths = null;
    
    // Determine which signature is being used
    if (optionalMarkupPaths) {
        // Old signature with context as first parameter
        context = markupPathsOrContext;
        markupPaths = optionalMarkupPaths;
    } else if (markupPathsOrContext && markupPathsOrContext.canvas) {
        // It's a canvas context without markup paths
        context = markupPathsOrContext;
        markupPaths = [];
        
        // For compatibility with main.js, just return silently
        // This matches expected behavior in main.js which renders
        // the paths from a global variable
        return;
    } else {
        // New signature with just markup paths
        markupPaths = markupPathsOrContext;
        context = null;
    }
    
    // Use provided context or fall back to stored context
    const ctx = context || drawingState.ctx;
    
    // Check if module is initialized or we have a temporary context
    if (!drawingState.initialized && !context) {
        const errorMsg = "Drawing module not initialized. Call initDrawingModule first.";
        console.warn(errorMsg);
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'draw_all',
            message: errorMsg
        };
        
        return {
            success: false,
            message: errorMsg
        };
    }
    
    if (!markupPaths || !Array.isArray(markupPaths)) {
        // When using the original main.js signature, it may be calling with just context
        // and expecting to use a global state like markupPaths
        if (context) {
            // For compatibility with main.js, just return silently
            return;
        }
        
        const errorMsg = "Invalid markup paths provided";
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'draw_all',
            message: errorMsg
        };
        
        return {
            success: false,
            message: errorMsg
        };
    }
    
    try {
        // Temporarily set context if one was provided
        const originalCtx = drawingState.ctx;
        if (context) {
            drawingState.ctx = context;
        }
        
        // Count elements by type for reporting
        const typeCounts = {};
        
        // Draw each markup element based on its type
        for (const path of markupPaths) {
            // Count element types
            typeCounts[path.type] = (typeCounts[path.type] || 0) + 1;
            
            switch (path.type) {
                case 'pencil':
                    drawSketchyPath(path);
                    break;
                case 'rectangle':
                    drawSketchyRectangle(path, {
                        color: path.color,
                        lineWidth: path.lineWidth,
                        fillStyle: path.fill ? path.fillColor : null
                    });
                    break;
                case 'circle':
                    drawSketchyCircle(path, {
                        color: path.color,
                        lineWidth: path.lineWidth,
                        fillStyle: path.fill ? path.fillColor : null
                    });
                    break;
                case 'line':
                    drawSketchyLine({
                        x1: path.start.x,
                        y1: path.start.y,
                        x2: path.end.x,
                        y2: path.end.y
                    }, {
                        color: path.color,
                        lineWidth: path.lineWidth
                    });
                    break;
                case 'polygon':
                    drawSketchyPolygon(path.points, {
                        color: path.color,
                        lineWidth: path.lineWidth,
                        fillStyle: path.fill ? path.fillColor : null
                    });
                    break;
                case 'arrow':
                    drawArrow(path, {
                        color: path.color,
                        lineWidth: path.lineWidth
                    });
                    break;
                case 'text':
                    drawSketchyText(path, {
                        color: path.color
                    });
                    break;
            }
        }
        
        // Restore original context if we temporarily changed it
        if (context) {
            drawingState.ctx = originalCtx;
        }
        
        // Update last operation info
        drawingState.lastOperation = {
            success: true,
            timestamp: new Date().toISOString(),
            type: 'draw_all',
            message: `Drew ${markupPaths.length} markup elements`,
            elementCounts: typeCounts
        };
        
        return {
            success: true,
            message: `Drew ${markupPaths.length} markup elements`,
            elementCounts: typeCounts
        };
    } catch (error) {
        // Restore original context if we temporarily changed it
        if (context) {
            drawingState.ctx = originalCtx;
        }
        
        const errorMsg = `Error drawing markup paths: ${error.message}`;
        console.error(errorMsg);
        
        drawingState.lastOperation = {
            success: false,
            timestamp: new Date().toISOString(),
            type: 'draw_all',
            message: errorMsg,
            error: error.message
        };
        
        return {
            success: false,
            message: errorMsg,
            error: error.message
        };
    }
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

export {
    // Core module setup
    initDrawingModule,
    updateDrawingConfig,
    getDrawingState,
    
    // Drawing functions
    drawSketchyPath,
    drawSketchyRectangle,
    drawSketchyCircle,
    drawSketchyLine,
    drawSketchyPolygon,
    drawSketchySegment,
    drawSketchyArrowLine,
    drawArrow,
    drawArc,
    drawSketchyText,
    drawAllMarkupPaths,
    calculateCurveEndDirection,
}
