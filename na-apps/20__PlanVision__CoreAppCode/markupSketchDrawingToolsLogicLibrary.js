// ===================================================================================
// JAVASCRIPT | Markup Sketching Drawing Tools Logic Library
// ===================================================================================
//
// FILE NAME | markupSketchDrawingToolsLogicLibrary.js
// FILE PATH | ./markupSketchDrawingToolsLogicLibrary.js
//
// OFFLOADED | 13-Apr-2025
// Tested - NEED TO TEST STILL
//
// Description:
// - This file contains core mathematical functions that serve as a library for the whole app.
// - These functions are used throughout the app and are essential for the app to function.
// - The functions are designed to be used in conjunction with all other modules.
// - These functions offload the mathematical calculations from the main script to this file.
// ----------------------------------------------------------------------------------




// ===================================================================================
// MODULE IMPORTS
// ===================================================================================

import { 
    coreMathGeomGenerateQuadraticCurvePoints,
    coreMathPseudoRandomValueGen,
    //coreMathGeomCircleFromPoints,
} from './coreMathLibrary.js';



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------

// Placeholder For Future Constants
const PLACEHOLDER_CONSTANT    =    0.1;



// Placeholder For Future Variable
let PlaceholderVariable       =      0;






//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .







// FUNCTION |  Placeholder
// ----------------------------------------------------------------------------------
// - Placeholder for future functions

function coreMathFunction2() {
    // Implementation here
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// ----------------------------------------------------------------------------------
// HELPER FUNCTION |  Draw Pen Sketch Stroke Line Segment Logic
// ----------------------------------------------------------------------------------
// Add a technical pen reinforcement stroke effect to a line


function drawPenSketchReinforcementStroke(context, x1, y1, dx, dy, length, perpX, perpY, lineWidth, color, seed) {
    // Add a lighter reinforcement stroke along the line
    context.beginPath();
    context.globalAlpha = 0.5; // Increased from 0.3 to 0.5 for less transparency
    context.lineWidth = lineWidth * 0.6;
    context.strokeStyle = color;
    
    // Pick random section of the line to reinforce
    const startPct = coreMathPseudoRandomValueGen(seed + 100) * 0.3; // Start in first 30%
    const endPct = 0.7 + coreMathPseudoRandomValueGen(seed + 200) * 0.3; // End in last 30%
    
    const startX = x1 + dx * startPct + perpX * lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed + 300) - 0.5);
    const startY = y1 + dy * startPct + perpY * lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed + 400) - 0.5);
    const endX = x1 + dx * endPct + perpX * lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed + 500) - 0.5);
    const endY = y1 + dy * endPct + perpY * lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed + 600) - 0.5);
    
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    
    // Reset alpha
    context.globalAlpha = 1.0;
}


// ----------------------------------------------------------------------------------
// FUNCTION |  Draw Pen Sketch Stroke Line Segment Logic
// ----------------------------------------------------------------------------------
// - It is used to draw the line segments in the markup toolset.
// - It applies a Pen Sketch Effect differentiating marked up elements from elements printed on the plan.
// - It aims to emulate an "Engineers Tech Pen" effect.


// Draw a sketchy line segment with controlled randomness
function drawPenSketchStrokeSegment(context, x1, y1, x2, y2, lineWidth, color, seed) {
    // Calculate length and direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / length;
    const unitY = dy / length;
    
    // Number of segments increases with line length
    const segmentCount = Math.max(3, Math.min(12, Math.ceil(length / (lineWidth * 4))));
    const segmentLength = length / segmentCount;
    
    // Normal vector for perpendicular deviations
    const perpX = -unitY;
    const perpY = unitX;
    
    // Draw main line with multiple segments and deliberate imperfections
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    
    // Start slightly off from exact corner for natural look
    let currentX = x1 + lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed) - 0.5);
    let currentY = y1 + lineWidth * 0.1 * (coreMathPseudoRandomValueGen(seed + 1) - 0.5);
    context.moveTo(currentX, currentY);
    
    // Create segments with controlled randomness
    for (let i = 1; i <= segmentCount; i++) {
        // Target point along the line
        const t = i / segmentCount;
        let targetX = x1 + dx * t;
        let targetY = y1 + dy * t;
        
        // Add perpendicular deviations for hand-drawn effect
        const jitterScale = lineWidth * 0.8;
        const perpOffset = jitterScale * (coreMathPseudoRandomValueGen(seed + i * 10) - 0.5);
        targetX += perpX * perpOffset;
        targetY += perpY * perpOffset;
        
        // For longer lines, use curves for more natural look
        if (segmentCount > 3) {
            // Control point between current and target
            const controlT = (i - 0.5) / segmentCount;
            const controlX = x1 + dx * controlT + perpX * jitterScale * (coreMathPseudoRandomValueGen(seed + i * 20) - 0.5);
            const controlY = y1 + dy * controlT + perpY * jitterScale * (coreMathPseudoRandomValueGen(seed + i * 30) - 0.5);
            
            context.quadraticCurveTo(controlX, controlY, targetX, targetY);
        } else {
            // For shorter lines, simple lines with jitter work better
            context.lineTo(targetX, targetY);
        }
        
        currentX = targetX;
        currentY = targetY;
    }
    
    context.stroke();
    
    // Add reinforcement strokes for longer lines
    if (length > lineWidth * 8) {
        drawPenSketchReinforcementStroke(context, x1, y1, dx, dy, length, perpX, perpY, lineWidth, color, seed);
    }
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .




// ----------------------------------------------------------------------------------
// FUNCTION |  Rectangle Drawing Tools - Core Math & Logic
// ----------------------------------------------------------------------------------


// Main rectangle drawing function with technical pen style
function drawPenSketchRectangle(context, rect) {
    const x = rect.startPoint.x;
    const y = rect.startPoint.y;
    const width = rect.endPoint.x - rect.startPoint.x;
    const height = rect.endPoint.y - rect.startPoint.y;
    
    // Initialize deterministic seeds if not present
    if (!rect.seed) {
        rect.seed = {
            top: Math.floor(Math.random() * 10000),
            right: Math.floor(Math.random() * 10000),
            bottom: Math.floor(Math.random() * 10000),
            left: Math.floor(Math.random() * 10000)
        };
    }
    
    const overshootAmount = rect.lineWidth * 1.2;
    
    // Draw main edges
    drawPenSketchStrokeSegment(context, 
        x - overshootAmount * 0.2, y,
        x + width + overshootAmount * 0.2, y,
        rect.lineWidth, rect.color, rect.seed.top);
    
    drawPenSketchStrokeSegment(context, 
        x + width, y - overshootAmount * 0.2,
        x + width, y + height + overshootAmount * 0.2,
        rect.lineWidth, rect.color, rect.seed.right);
    
    drawPenSketchStrokeSegment(context, 
        x + width + overshootAmount * 0.2, y + height,
        x - overshootAmount * 0.2, y + height,
        rect.lineWidth, rect.color, rect.seed.bottom);
    
    drawPenSketchStrokeSegment(context, 
        x, y + height + overshootAmount * 0.2,
        x, y - overshootAmount * 0.2,
        rect.lineWidth, rect.color, rect.seed.left);
    
    // Draw corner reinforcements
    drawPenSketchRectangleCorners(context, x, y, width, height, rect.lineWidth, rect.seed);
}

    // MATH FUNCTION |  Core Math Function for drawing sketchy rectangle sketch
    // ------------------------------------------------------------------------

    function drawPenSketchRectangleMath(x, y, cornerLength, seed) {
        return {
            x2: x + cornerLength * coreMathPseudoRandomValueGen(seed),
            y2: y + cornerLength * coreMathPseudoRandomValueGen(seed + 1)
        };
    }

    // HELPER FUNCTION |  Corner Reinforcements
    // ------------------------------------------------------------------------
    // Core math function for rectangle corner reinforcements

    function drawPenSketchRectangleCorners(context, x, y, width, height, lineWidth, seed) {
        context.globalAlpha = 0.9;
        context.lineWidth = lineWidth * 0.7;
        const cornerLength = lineWidth * 2.5;
        
        // Top-left corner
        const topLeft1 = drawPenSketchRectangleMath(x, y, cornerLength, seed.top + 1);
        const topLeft2 = drawPenSketchRectangleMath(x, y, cornerLength, seed.left + 1);
        drawPenSketchRectangleCornerLines(context, x, y, topLeft1, topLeft2);
        
        // Top-right corner
        const topRight1 = drawPenSketchRectangleMath(x + width, y, -cornerLength, seed.top + 2);
        const topRight2 = drawPenSketchRectangleMath(x + width, y, cornerLength, seed.right + 2);
        drawPenSketchRectangleCornerLines(context, x + width, y, topRight1, topRight2);
        
        // Bottom-right corner
        const bottomRight1 = drawPenSketchRectangleMath(x + width, y + height, -cornerLength, seed.bottom + 3);
        const bottomRight2 = drawPenSketchRectangleMath(x + width, y + height, -cornerLength, seed.right + 3);
        drawPenSketchRectangleCornerLines(context, x + width, y + height, bottomRight1, bottomRight2);
        
        // Bottom-left corner
        const bottomLeft1 = drawPenSketchRectangleMath(x, y + height, cornerLength, seed.bottom + 4);
        const bottomLeft2 = drawPenSketchRectangleMath(x, y + height, -cornerLength, seed.left + 4);
        drawPenSketchRectangleCornerLines(context, x, y + height, bottomLeft1, bottomLeft2);
    }

    // HELPER FUNCTION |  Corner Reinforcement Lines
    // ------------------------------------------------------------------------
    // Helper for drawing corner reinforcement lines
    function drawPenSketchRectangleCornerLines(context, x, y, point1, point2) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(point1.x2, point1.y2);
        context.stroke();
        
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(point2.x2, point2.y2);
        context.stroke();
    }



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .




// FUNCTION |  Markup Drawing Tools - Draw Sketchy Arc Geometry Math
// ----------------------------------------------------------------------------------
// - Placeholder for future functions


// HELPER FUNCTION |  Arch Math
// Generate points along a quadratic bezier curve for arc drawing
function drawPenSketchArcMath(start, control, end, numPoints = 10) {
    return coreMathGeomGenerateQuadraticCurvePoints(start, control, end, numPoints);
}

// Draw a sketchy arc using pen sketch style
function drawPenSketchArc(context, start, control, end, lineWidth, color, seed) {
    // Generate points along the curve
    const points = coreMathGeomGenerateQuadraticCurvePoints(start, control, end);
    
    // Draw each segment with a sketchy style
    for (let i = 0; i < points.length - 1; i++) {
        drawPenSketchStrokeSegment(
            context, 
            points[i].x, points[i].y, 
            points[i+1].x, points[i+1].y, 
            lineWidth, 
            color, 
            seed + i // Add i to create variation between segments
        );
    }
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .





//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .




// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

export {
    drawPenSketchArcMath,
    drawPenSketchArc,
    drawPenSketchStrokeSegment,
    drawPenSketchReinforcementStroke,
    drawPenSketchRectangleMath,
    drawPenSketchRectangle,
    //drawPenSketchCircle,
};