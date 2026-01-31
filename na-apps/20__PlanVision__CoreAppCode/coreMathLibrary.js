// ===================================================================================
// JAVASCRIPT | CORE MATH LIBRARY
// ===================================================================================
//
// FILE NAME | coreMathLibrary.js
// FILE PATH | ./coreMathLibrary.js
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



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------

// Mathematical Constants
const PI                =         Math.PI;
const TWO_PI            =     2 * Math.PI;
const HALF_PI           =     Math.PI / 2;
const QUARTER_PI        =     Math.PI / 4;
const DEG_TO_RAD        =   Math.PI / 180;
const RAD_TO_DEG        =   180 / Math.PI;

// Tolerance values for floating-point comparisons
const EPSILON           =           1e-10;
const ZERO_TOLERANCE    =            1e-6;



// Placeholder For Future Variable
let PlaceholderVariable       =      0;




//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MATH FUNCTION |  Basic Distance Calculation
// ----------------------------------------------------------------------------------
// - Calculates the distance between two points

function coreMathDistanceCalc(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MATH FUNCTION |  Deterministic Pseudo-Random Value Generator
// ----------------------------------------------------------------------------------
// - Generates a deterministic pseudo-random value between 0 and 1 based on a given seed
function coreMathPseudoRandomValueGen(seed) {
    // Simple but effective deterministic random number generator
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MATH FUNCTION |  Point-To-Line Distance Calculation
// ----------------------------------------------------------------------------------
// - This section introduced in v1.6.0
// - Calculates the shortest distance from a point to a line segment


function coreMathDistanceToLineSegment(x1, y1, x2, y2, px, py) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    const t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
    if (t < 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    if (t > 1) return Math.sqrt((px - x2) * (px - x2) + (py - y2) * (py - y2));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .
// ===================================================================================
// STANDARD CORE GEOMETRIC MATH FUNCTIONS
// ===================================================================================

// MATH FUNCTION |  Polygon Area Calculation
// ----------------------------------------------------------------------------------
// - Calculates the area of a polygon

function coreMathGeomPolygonArea(pts) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += (pts[i].x * pts[j].y) - (pts[j].x * pts[i].y);
    }
    return Math.abs(area / 2);
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MATH FUNCTION |  Polygon Centroid Calculation
// ----------------------------------------------------------------------------------
// - Calculates the centroid (geometric center) of a polygon

function coreMathGeomPolygonCentroid(pts) {
    let xSum = 0, ySum = 0;
    pts.forEach(p => { xSum += p.x; ySum += p.y; });
    return { x: xSum / pts.length, y: ySum / pts.length };
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// MATH FUNCTION | Quadratic Bézier Curve Points Generation
// ----------------------------------------------------------------------------------
// - Generates a set of points along a quadratic Bézier curve
// - start: the starting point of the curve
// - control: the control point that influences the curve's shape
// - end: the ending point of the curve
// - numPoints: the number of points to generate along the curve (default is 100)

function coreMathGeomGenerateQuadraticCurvePoints(start, control, end, numPoints = 100) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = Math.pow(1 - t, 2) * start.x + 2 * (1 - t) * t * control.x + Math.pow(t, 2) * end.x;
        const y = Math.pow(1 - t, 2) * start.y + 2 * (1 - t) * t * control.y + Math.pow(t, 2) * end.y;
        points.push({ x, y });
    }
    return points;
}


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// MATH FUNCTION | Cubic Bézier Point Calculation
// ----------------------------------------------------------------------------------
// - Computes the coordinates of a point on a cubic Bézier curve for a given parameter t
// - p0: the starting point of the curve
// - p1: the first control point that influences the curve's shape
// - p2: the second control point that influences the curve's shape
// - p3: the ending point of the curve
// - t: a parameter value between 0 and 1, where 0 corresponds to the start point and 1 corresponds to the end point

function coreMathGeomBezierPoint(p0, p1, p2, p3, t) {
    const oneMinusT = 1 - t;
    const oneMinusTSquared = oneMinusT * oneMinusT;
    const oneMinusTCubed = oneMinusTSquared * oneMinusT;
    const tSquared = t * t;
    const tCubed = tSquared * t;
    
    return {
        x: oneMinusTCubed * p0.x + 3 * oneMinusTSquared * t * p1.x + 3 * oneMinusT * tSquared * p2.x + tCubed * p3.x,
        y: oneMinusTCubed * p0.y + 3 * oneMinusTSquared * t * p1.y + 3 * oneMinusT * tSquared * p2.y + tCubed * p3.y
    };
}



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .






// ===================================================================================
// MODULE EXPORTS
// ===================================================================================

export {
    coreMathDistanceCalc,
    coreMathDistanceToLineSegment,
    coreMathGeomPolygonArea,
    coreMathGeomPolygonCentroid,
    coreMathGeomGenerateQuadraticCurvePoints,
    coreMathGeomBezierPoint,
    coreMathPseudoRandomValueGen
};