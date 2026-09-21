// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Geometry__.js
// NAMESPACE  : Na__LeOsnapGeo
// MODULE     : Layout Editor - Object Snap - Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths behind the snap modes: where two lines cross, where a perpendicular lands, the nearest point on a line, a polygon's centre, and which grid cells a line passes through
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Everything is paper millimetres, y down the page, and every function is
//   given plain numbers and hands plain numbers back. NOTHING HERE TOUCHES THE
//   MODEL, THE DOM OR THE CONFIG, so the whole file runs under Node
//   (Na__Test__ObjectSnap__.test.mjs) exactly as it runs in the editor.
// - Foot is where a perpendicular dropped from a point lands on the LINE a
//   segment lies on, with how far along the segment that is (t: 0 at the
//   start, 1 at the end, outside that off the segment). Perpendicular snaps
//   ask it; so does "is this point on that line".
// - Nearest is the closest point ON the segment, its ends included.
// - Cross is where two segments cross. Lines that only touch - one stopping on
//   the other, the T of a wall meeting a wall - count as crossing, because a
//   line snapped onto another stops exactly there and floating point will not
//   promise it a hair more. Parallel lines never cross, overlapping or not.
// - Centroid is the centre of area of a closed polygon, which for a rectangle
//   is the middle of it and for an L-shaped room is where the room balances.
// - CellsOfSegment names every square of a grid a segment passes through, and
//   no others: the linework index files each segment under those squares, so
//   a search round the cursor reads a handful of them. A line is walked a
//   column at a time - for each column it crosses, the rows between where it
//   enters and where it leaves - which is exact, where sampling along the line
//   misses the corner of a square the line only clips.
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__Index__ files the linework by CellsOfSegment.
// - Na__LayoutEditor__ObjectSnap__Search__ asks Foot, Nearest and Cross;
//   Na__LayoutEditor__ObjectSnap__Sources__ asks Centroid.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: Foot, Nearest, DistanceToSegment, Cross, Centroid
//   and CellsOfSegment.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Close Is the Same
    // ------------------------------------------------------------
    const Na__LeOsnapGeo__ZERO_MM   = 1e-9;      // <-- A segment shorter than this has no direction
    const Na__LeOsnapGeo__TOUCH     = 1e-7;      // <-- How far past its own end (as a fraction of its length) a line may run and still touch another
    const Na__LeOsnapGeo__PARALLEL  = 1e-12;     // <-- The cross product of two unit directions below which they are parallel
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Point Against One Segment
// -----------------------------------------------------------------------------

    // FUNCTION | Where a Perpendicular From a Point Lands on a Segment's Line
    // ------------------------------------------------------------
    // Returns { x, y, t } - t is how far along the segment the foot is, and is
    // NOT clamped: below 0 or above 1 the foot is on the line but off the
    // segment. Null for a segment with no length.
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__Foot(ax, ay, bx, by, px, py) {
        const dx = bx - ax, dy = by - ay;
        const len2 = (dx * dx) + (dy * dy);
        if (!(len2 > Na__LeOsnapGeo__ZERO_MM * Na__LeOsnapGeo__ZERO_MM)) return null;
        const t = (((px - ax) * dx) + ((py - ay) * dy)) / len2;
        return { x : ax + (dx * t), y : ay + (dy * t), t : t };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Closest Point on a Segment, Its Ends Included
    // ------------------------------------------------------------
    // Returns { x, y, t, distance }. A segment with no length is its one point.
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__Nearest(ax, ay, bx, by, px, py) {
        const foot = Na__LeOsnapGeo__Foot(ax, ay, bx, by, px, py);
        if (!foot) return { x : ax, y : ay, t : 0, distance : Math.hypot(px - ax, py - ay) };
        const t = Math.max(0, Math.min(1, foot.t));
        const x = ax + ((bx - ax) * t), y = ay + ((by - ay) * t);
        return { x : x, y : y, t : t, distance : Math.hypot(px - x, py - y) };
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Point Is From a Segment
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__DistanceToSegment(ax, ay, bx, by, px, py) {
        return Na__LeOsnapGeo__Nearest(ax, ay, bx, by, px, py).distance;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Two Segments
// -----------------------------------------------------------------------------

    // FUNCTION | Where Two Segments Cross, or Null
    // ------------------------------------------------------------
    // Returns { x, y, t, u } - t along the first segment, u along the second.
    // Touching counts (a line that stops on another), parallel never does.
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__Cross(ax, ay, bx, by, cx, cy, dx, dy) {
        const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
        const rLen = Math.hypot(rx, ry), sLen = Math.hypot(sx, sy);
        if (!(rLen > Na__LeOsnapGeo__ZERO_MM) || !(sLen > Na__LeOsnapGeo__ZERO_MM)) return null;
        const denom = (rx * sy) - (ry * sx);
        if (Math.abs(denom) <= Na__LeOsnapGeo__PARALLEL * rLen * sLen) return null;   // <-- Parallel, or as good as: no one point to offer
        const qx = cx - ax, qy = cy - ay;
        const t = ((qx * sy) - (qy * sx)) / denom;
        const u = ((qx * ry) - (qy * rx)) / denom;
        const slack = Na__LeOsnapGeo__TOUCH;
        if (t < -slack || t > 1 + slack || u < -slack || u > 1 + slack) return null;
        return { x : ax + (rx * t), y : ay + (ry * t), t : t, u : u };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Closed Polygon
// -----------------------------------------------------------------------------

    // FUNCTION | The Centre of Area of a Closed Polygon ([[x, y], ...])
    // ------------------------------------------------------------
    // The shoelace centroid. A polygon with no area to speak of - three points
    // in a line, a shape folded back on itself - falls to the middle of its
    // points, which is still somewhere sensible to aim at. Null under three
    // points.
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__Centroid(points) {
        const n = Array.isArray(points) ? points.length : 0;
        if (n < 3) return null;
        let area2 = 0, cx = 0, cy = 0, mx = 0, my = 0, span = 0;
        for (let i = 0; i < n; i++) {
            const p = points[i], q = points[(i + 1) % n];
            const w = (p[0] * q[1]) - (q[0] * p[1]);
            area2 += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
            mx += p[0]; my += p[1];
            span = Math.max(span, Math.abs(p[0] - points[0][0]), Math.abs(p[1] - points[0][1]));
        }
        if (Math.abs(area2) <= 1e-9 * Math.max(1, span * span)) return { x : mx / n, y : my / n };
        return { x : cx / (3 * area2), y : cy / (3 * area2) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Segment on a Grid
// -----------------------------------------------------------------------------

    // FUNCTION | Every Grid Square a Segment Passes Through
    // ------------------------------------------------------------
    // visit(column, row) is called once for each square, whole numbers, the
    // square holding x, y being floor(x / cellMm), floor(y / cellMm). Walked a
    // column at a time: inside one column the line runs from where it enters
    // to where it leaves, and covers every row between the two.
    // ------------------------------------------------------------
    function Na__LeOsnapGeo__CellsOfSegment(ax, ay, bx, by, cellMm, visit) {
        if (!(cellMm > 0) || typeof visit !== 'function') return;
        if (![ ax, ay, bx, by ].every(Number.isFinite)) return;
        const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
        const c0 = Math.floor(x0 / cellMm), c1 = Math.floor(x1 / cellMm);
        const rows = (column, ya, yb) => {
            const r0 = Math.floor(Math.min(ya, yb) / cellMm), r1 = Math.floor(Math.max(ya, yb) / cellMm);
            for (let row = r0; row <= r1; row++) visit(column, row);
        };
        if (c0 === c1) { rows(c0, ay, by); return; }                         // <-- Plumb, or inside one column: every row between its ends
        const slope = (by - ay) / (bx - ax);
        for (let column = c0; column <= c1; column++) {
            const xl = Math.max(x0, column * cellMm), xr = Math.min(x1, (column + 1) * cellMm);
            rows(column, ay + ((xl - ax) * slope), ay + ((xr - ax) * slope));
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Geometry
    // ------------------------------------------------------------
    export {
        Na__LeOsnapGeo__Foot,
        Na__LeOsnapGeo__Nearest,
        Na__LeOsnapGeo__DistanceToSegment,
        Na__LeOsnapGeo__Cross,
        Na__LeOsnapGeo__Centroid,
        Na__LeOsnapGeo__CellsOfSegment
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
