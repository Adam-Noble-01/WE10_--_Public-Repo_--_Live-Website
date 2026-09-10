// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHAPE GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__ShapeGeometry__.js
// NAMESPACE  : Na__LeShapeGeo
// MODULE     : Layout Editor - Shape Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths of a vector shape on the paper: bounds, hit testing, vertex lookup, translation and its primitive
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - A shape is a run of paper points (millimetres, y down) with an edge
//   colour, an edge weight in points, a flag saying whether the edges draw
//   at all, and an optional fill. Closed shapes are polygons; open ones
//   are lines and polylines.
// - A fill treats the run as if the last point joined the first, which is
//   what SVG and PDF both do, so Closed only decides whether the closing
//   edge is drawn. With the edges off the shape is its fill alone; the
//   record never allows both to be off at once.
// - Nothing here touches the model or the DOM: the markup bridge draws
//   through Push, the tools hit test through Hit and VertexAt, and the
//   grips read Points.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ (primitives and hit test),
//   Na__LayoutEditor__ShapeTool__, Na__LayoutEditor__Grips__,
//   Na__LayoutEditor__SheetTools__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ShapeGeometry__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Shape__Stroked: the edges can be switched off, leaving the fill.
// - A fill no longer needs the shape to be closed, on the paper or in the
//   PDF, and hit testing follows it.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Chrome Primitives
    // ------------------------------------------------------------
    import { Na__LeCfg__PtToMm } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__PushPolyline } from './Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Points, Segments and Bounds
// -----------------------------------------------------------------------------

    // FUNCTION | The Shape's Points as [x, y] Pairs (only the well-formed ones)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Points(shape) {
        const raw = (shape && Array.isArray(shape.Shape__Points)) ? shape.Shape__Points : [];
        return raw.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge, Including the Closing One of a Polygon
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Segments(shape) {
        const pts = Na__LeShapeGeo__Points(shape);
        const out = [];
        for (let i = 1; i < pts.length; i++) out.push([ pts[i - 1], pts[i] ]);
        if (shape.Shape__Closed === true && pts.length > 2) out.push([ pts[pts.length - 1], pts[0] ]);
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Shape Occupies
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Bounds(shape) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (pts.length === 0) return { X : 0, Y : 0, WidthMm : 0, HeightMm : 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Same Shape's Points Moved by a Delta
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Translated(points, dx, dy) {
        return points.map((p) => [ p[0] + dx, p[1] + dy ]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Testing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Distance From a Point to a Segment
    // ------------------------------------------------------------
    function Na__LeShapeGeo__DistanceToSegment(point, a, b) {
        const abx = b[0] - a[0], aby = b[1] - a[1];
        const len2 = (abx * abx) + (aby * aby);
        let t = len2 > 0 ? (((point.x - a[0]) * abx) + ((point.y - a[1]) * aby)) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(point.x - (a[0] + (abx * t)), point.y - (a[1] + (aby * t)));
    }
    // ------------------------------------------------------------


    // FUNCTION | Distance From a Point to the Nearest Edge
    // ------------------------------------------------------------
    function Na__LeShapeGeo__DistanceToEdge(shape, point) {
        const segments = Na__LeShapeGeo__Segments(shape);
        if (segments.length === 0) {
            const pts = Na__LeShapeGeo__Points(shape);
            return pts.length ? Math.hypot(point.x - pts[0][0], point.y - pts[0][1]) : Infinity;
        }
        let best = Infinity;
        segments.forEach((s) => { best = Math.min(best, Na__LeShapeGeo__DistanceToSegment(point, s[0], s[1])); });
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Point Inside a Shape (ray casting, the run treated as closed)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Contains(shape, point) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (pts.length < 3) return false;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
            const crosses = ((yi > point.y) !== (yj > point.y)) && (point.x < (((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9)) + xi);
            if (crosses) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Point Hit the Shape (an edge within tolerance, or the fill)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Hit(shape, point, toleranceMm) {
        if (Na__LeShapeGeo__DistanceToEdge(shape, point) <= toleranceMm) return true;
        return !!shape.Shape__FillColour && Na__LeShapeGeo__Contains(shape, point);
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Vertex Sits Under a Point (index, or -1)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__VertexAt(shape, point, toleranceMm) {
        const pts = Na__LeShapeGeo__Points(shape);
        let best = -1, bestD = toleranceMm;
        pts.forEach((p, i) => { const d = Math.hypot(point.x - p[0], point.y - p[1]); if (d <= bestD) { best = i; bestD = d; } });
        return best;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitive
// -----------------------------------------------------------------------------

    // FUNCTION | The Edge Weight in Paper Millimetres (nothing when the edges are off)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__StrokeMm(shape) {
        if (shape.Shape__Stroked === false) return 0;
        return Math.max(0.02, Na__LeCfg__PtToMm(shape.Shape__StrokePt));
    }
    // ------------------------------------------------------------


    // FUNCTION | Push the Shape as One Polyline Primitive (edges, fill, or both)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Push(list, shape) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (pts.length < 2) return false;
        const closed  = shape.Shape__Closed === true && pts.length > 2;
        const stroked = shape.Shape__Stroked !== false;
        const fill    = (pts.length > 2 && typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillColour : null;
        if (!stroked && !fill) return false;                                 // <-- Nothing to paint
        Na__LeChrome__PushPolyline(list, pts.map((p) => [ p[0], p[1] ]), stroked ? shape.Shape__StrokeColour : null, Na__LeShapeGeo__StrokeMm(shape), fill, closed);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Shape Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeShapeGeo__Points,
        Na__LeShapeGeo__Segments,
        Na__LeShapeGeo__Bounds,
        Na__LeShapeGeo__Translated,
        Na__LeShapeGeo__DistanceToEdge,
        Na__LeShapeGeo__Contains,
        Na__LeShapeGeo__Hit,
        Na__LeShapeGeo__VertexAt,
        Na__LeShapeGeo__StrokeMm,
        Na__LeShapeGeo__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
