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
// - A HOLED SHAPE (Shape__Holes, made by the Boolean tools) keeps its outline
//   and then each hole in the same run of points; every function here that
//   walks edges or asks what is inside reads the rings from
//   Na__LayoutEditor__ShapeRings__, and every other one - bounds, a move, a
//   vertex under the pointer - works on the run as it always did.
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
// - Divergences   : Console prefix, header and folder numbers; holed shapes (Shape__Holes), TrueVision first on 22-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.9.0
// - HOLES (islands), for the vector tools' Boolean section. A shape carrying
//   Shape__Holes holds its outline and then each hole in Shape__Points
//   (Na__LayoutEditor__ShapeRings__). Segments, ClosestOnEdge and the new
//   EdgeEnd walk each ring's own edges - none from the outline to a hole;
//   Contains is even-odd, so a hole is not inside; Push hands the holes to the
//   primitive. New: Holes, Rings, EdgePairs, EdgeEnd, and HolesAfterInsert and
//   RemoveVertices, which give inserting and deleting a vertex the hole starts
//   to send with the points. A shape without the key takes exactly the path
//   it always did, and the leaf is never asked about it.
//
// 21-Sep-2026 - Version 1.8.0
// - A Shape__Qr code is painted in the QR system's portalDarkColour
//   (#595959, hsl(0, 0%, 35%)) instead of its black: the Project Portal
//   block's code, both forms, softer on the page (Adam). The title block's
//   code is not a vector's and stays black.
//
// 21-Sep-2026 - Version 1.7.0
// - Shape__Image: a shape carrying the block is a PICTURE and is pushed as one
//   'picture' primitive (Na__LayoutEditor__SheetImages__Paint__) - shadow,
//   the kept part of the stored file, frame - instead of as a polyline. It is
//   hit anywhere inside its box, as a QR box is.
//
// 21-Sep-2026 - Version 1.6.0
// - Shape__Qr: a shape carrying the block is drawn as it always was, and the
//   PROJECT'S OWN QR SYMBOL is then painted inside its box, Qr__MarginMm in
//   from it. One record, not one per module - the chrome's 'qr' primitive
//   carries the symbol whole and each surface paints it in its own idiom, so
//   the code is one filled path on the screen and one in the PDF, with no
//   seams between its runs and nothing for the model to carry but a rectangle.
//   The symbol is asked for at painting time, so a shape pasted into another
//   project draws THAT project's code, and a project with no code draws the
//   plain shape. Its printed size is reported to the QR system's own check.
//
// 14-Sep-2026 - Version 1.5.0
// - Shape__LineStyle reaches the primitive as a dash array of paper
//   millimetres (Na__LayoutEditor__LineStyleTool__). A solid edge - null, or
//   a record from before the toggle - paints exactly as it always did.
//
// 14-Sep-2026 - Version 1.4.0
// - ClosestOnEdge: the nearest point on any edge, with which edge and how
//   far along it, so a Shift-click can insert a vertex there.
// - InsertPoint: the points array with a vertex spliced in after an edge's
//   start, used once the insert has been accepted.
//
// 14-Sep-2026 - Version 1.3.0
// - Shape__FillOpacity and Shape__StrokeOpacity reach the primitive, so a
//   fill and the edges can each be see-through. The gradient keeps its own
//   alpha.
//
// 13-Sep-2026 - Version 1.2.0
// - Shape__Gradient reaches the primitive (Na__LayoutEditor__GradientTool__). A
//   gradient counts as a fill for painting and for hit testing, over its whole
//   area, alpha end included.
//
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
    import { Na__LeCfg__PtToMm } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__PushPolyline, Na__LeChrome__PushQr } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeDash__PatternMm } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import { Na__ProjectQr__GetSymbol, Na__ProjectQr__GetSetup, Na__ProjectQr__CheckPrint } from '../../53__System__ProjectQrCode/Na__ProjectQr__Symbol__.js';
    // @delegate: ../../53__System__ProjectQrCode/Na__ProjectQr__Symbol__.js
    import { Na__LeImgDraw__Push } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Paint__.js';
    // @delegate: ../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Paint__.js
    import { Na__LeRings__Of, Na__LeRings__Edges, Na__LeRings__Next, Na__LeRings__Split, Na__LeRings__Contains, Na__LeRings__AfterInsert, Na__LeRings__Remove } from './Na__LayoutEditor__ShapeRings__.js';   // <-- A leaf: a holed vector's rings, asked only of a shape that has holes
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How a Shape Names Itself to the QR System's Print Check
    // ------------------------------------------------------------
    const Na__LeShapeGeo__QR_WHERE = 'A QR code drawn on a sheet';
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


    // FUNCTION | Where a Shape's Holes Begin in Its Points ([] for nearly every shape)
    // ------------------------------------------------------------
    // Shape__Holes (Na__LayoutEditor__ShapeRings__), cleaned. The key is
    // absent from every vector but a holed one, so the leaf is never asked
    // about any other and a plain shape takes exactly the path it always did.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Holes(shape) {
        return (shape && Array.isArray(shape.Shape__Holes) && shape.Shape__Holes.length > 0) ? Na__LeRings__Of(shape) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Shape's Rings: [ outline ] for a plain vector, the outline then each hole for a holed one
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Rings(shape) {
        const pts   = Na__LeShapeGeo__Points(shape);
        const holes = Na__LeShapeGeo__Holes(shape);
        return holes.length ? Na__LeRings__Split(pts, holes) : [ pts ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge, Including the Closing One of a Polygon
    // ------------------------------------------------------------
    // A holed shape's rings each close on themselves: no edge ever runs from
    // the outline to a hole.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Segments(shape) {
        const pts   = Na__LeShapeGeo__Points(shape);
        const holes = Na__LeShapeGeo__Holes(shape);
        if (holes.length) return Na__LeRings__Edges(pts.length, holes, true).map((e) => [ pts[e[0]], pts[e[1]] ]);
        const out = [];
        for (let i = 1; i < pts.length; i++) out.push([ pts[i - 1], pts[i] ]);
        if (shape.Shape__Closed === true && pts.length > 2) out.push([ pts[pts.length - 1], pts[0] ]);
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge as [ from, to ] Vertex Indices (what Segments walks, by index)
    // ------------------------------------------------------------
    // For a caller that has to know WHICH points an edge joins - the snaps
    // leave out the two edges a dragged vertex carries with it.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__EdgePairs(shape) {
        const n     = Na__LeShapeGeo__Points(shape).length;
        const holes = Na__LeShapeGeo__Holes(shape);
        return Na__LeRings__Edges(n, holes, shape && shape.Shape__Closed === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Point the Edge Starting at a Vertex Runs To (-1 when none does)
    // ------------------------------------------------------------
    // The next point, or the first point again from the last of a closed
    // shape; on a holed shape, the first point of that vertex's OWN ring.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__EdgeEnd(shape, index) {
        const n     = Na__LeShapeGeo__Points(shape).length;
        const holes = Na__LeShapeGeo__Holes(shape);
        if (holes.length) return Na__LeRings__Next(n, holes, index, true);
        if (index + 1 < n) return index + 1;
        return (shape.Shape__Closed === true && n > 2) ? 0 : -1;
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
    // A HOLE IS NOT INSIDE. On a holed shape a point is inside when an odd
    // number of its rings go round it - the even-odd rule both painters fill
    // it by - so a click in a hole goes through to whatever is under it.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Contains(shape, point) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (pts.length < 3) return false;
        const holes = Na__LeShapeGeo__Holes(shape);
        if (holes.length) return Na__LeRings__Contains(pts, holes, point.x, point.y);
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
            const crosses = ((yi > point.y) !== (yj > point.y)) && (point.x < (((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9)) + xi);
            if (crosses) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Point Hit the Shape (an edge within tolerance, or the fill or gradient)
    // ------------------------------------------------------------
    // A gradient hits across its whole area, alpha end included. A fade is
    // mostly see-through by design, and a shape that could only be picked up
    // by its opaque half would be hard to find again; lock its layer to click
    // through it to what is underneath.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Hit(shape, point, toleranceMm) {
        if (Na__LeShapeGeo__DistanceToEdge(shape, point) <= toleranceMm) return true;
        // A MEASURED ROOM IS ITS INSIDE. It is picked up anywhere within its
        // outline even with the wash turned off, because what it names is the
        // floor, not the line round it - and a room that could only be caught
        // by its edge would be a room nobody could click on a busy plan.
        return (!!shape.Shape__FillColour || !!shape.Shape__Gradient || !!shape.Shape__Hatch || !!shape.Shape__Qr || !!shape.Shape__Area || !!shape.Shape__Image) && Na__LeShapeGeo__Contains(shape, point);   // <-- A QR code or a picture paints its whole box, so it is picked up anywhere on it
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


    // FUNCTION | The Nearest Point on Any Edge (null when there is no edge)
    // ------------------------------------------------------------
    // Returns { index, t, x, y, distance }: index is the vertex the edge
    // starts at, t is 0 at that vertex and 1 at the next, (x, y) is the
    // foot on the edge, distance is paper millimetres from the query.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__ClosestOnEdge(shape, point) {
        const pts = Na__LeShapeGeo__Points(shape);
        const n   = pts.length;
        if (n < 2 || !point) return null;
        const holes = Na__LeShapeGeo__Holes(shape);
        const pairs = holes.length ? Na__LeRings__Edges(n, holes, true) : null;   // <-- A holed shape: each ring's own edges, the index still the vertex the edge starts at
        const edges = pairs ? pairs.length : ((shape.Shape__Closed === true && n > 2) ? n : n - 1);
        let best = null;
        for (let e = 0; e < edges; e++) {
            const i = pairs ? pairs[e][0] : e;
            const a = pts[i], b = pts[pairs ? pairs[e][1] : (i + 1) % n];
            const abx = b[0] - a[0], aby = b[1] - a[1];
            const len2 = (abx * abx) + (aby * aby);
            let t = len2 > 0 ? (((point.x - a[0]) * abx) + ((point.y - a[1]) * aby)) / len2 : 0;
            t = Math.max(0, Math.min(1, t));
            const x = a[0] + (abx * t), y = a[1] + (aby * t);
            const distance = Math.hypot(point.x - x, point.y - y);
            if (!best || distance < best.distance) best = { index : i, t : t, x : x, y : y, distance : distance };
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Points With a Vertex Spliced In After an Edge's Start
    // ------------------------------------------------------------
    function Na__LeShapeGeo__InsertPoint(points, edgeIndex, pt) {
        const next = points.map((p) => [ p[0], p[1] ]);
        const at   = Math.max(0, Math.min(next.length, Math.round(edgeIndex) + 1));
        next.splice(at, 0, [ pt[0], pt[1] ]);
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Hole Starts to Send With an Inserted Point (undefined when the shape has none)
    // ------------------------------------------------------------
    // Goes in the same UpdateShape patch as InsertPoint's points: every hole
    // that starts after the edge moves up one. undefined leaves a plain
    // shape's record without the key, exactly as before.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__HolesAfterInsert(shape, edgeIndex) {
        const holes = Na__LeShapeGeo__Holes(shape);
        return holes.length ? Na__LeRings__AfterInsert(holes, Math.round(edgeIndex)) : undefined;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch That Takes Picked Vertices Out: { points, holes? }, or Null When Too Few Would Be Left
    // ------------------------------------------------------------
    // floor is the fewest the OUTLINE may keep. On a holed shape a hole left
    // with fewer than three corners goes whole, and every later hole's start
    // follows the points out; on any other the patch is only the points.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__RemoveVertices(shape, picked, floor) {
        const pts   = Na__LeShapeGeo__Points(shape);
        const holes = Na__LeShapeGeo__Holes(shape);
        if (holes.length) {
            const kept = Na__LeRings__Remove(pts, holes, picked, floor);
            return (kept && kept.points.length < pts.length) ? { points : kept.points, holes : kept.holes } : null;
        }
        const points = pts.filter((point, index) => picked.indexOf(index) === -1).map((point) => [ point[0], point[1] ]);
        return (points.length < floor || points.length === pts.length) ? null : { points : points };
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


    // HELPER FUNCTION | Push the Project's QR Symbol Inside a Shape's Box
    // ------------------------------------------------------------
    // The symbol is squared off inside the shape's bounding box and centred
    // in it, Qr__MarginMm in on every side, so a box drawn taller than it is
    // wide still carries a square code with its margin kept.
    //
    // NO PROJECT, NO CODE, AND NOTHING IN ITS PLACE. The Project QR Code
    // system answers null with nothing on the address bar, or with codes
    // switched off; the shape is then simply the shape, which is a frame
    // waiting for a code rather than a code that opens nothing.
    //
    // The printed size goes to the QR system's own check, so a box drawn too
    // small for a phone to read - or one whose margin has been squeezed -
    // says so on the console, once, exactly as the title block's cell does.
    //
    // SOFTER THAN THE TITLE BLOCK'S CODE. A code a vector carries is the
    // Project Portal block's, and it is painted in the QR system's
    // portalDarkColour (#595959) rather than the black every document's own
    // code keeps - Adam, 21-Sep-2026: "so that they don't look so stark on the
    // page". Chosen here at painting time, so a block already on a sheet
    // changes with the config and has nothing to rebuild. A Symbol module
    // older than the key answers undefined, and the code is painted black.
    // ------------------------------------------------------------
    function Na__LeShapeGeo__PushQr(list, shape) {
        const block = shape.Shape__Qr;
        if (!block || typeof block !== 'object') return false;
        const symbol = Na__ProjectQr__GetSymbol();
        if (!symbol) return false;
        const box    = Na__LeShapeGeo__Bounds(shape);
        const margin = (Number.isFinite(block.Qr__MarginMm) && block.Qr__MarginMm > 0) ? block.Qr__MarginMm : 0;
        const sizeMm = Math.min(box.WidthMm, box.HeightMm) - (margin * 2);
        if (!(sizeMm > 0)) return false;
        Na__ProjectQr__CheckPrint(symbol, sizeMm, margin, Na__LeShapeGeo__QR_WHERE);
        const colours = Na__ProjectQr__GetSetup().symbol;
        Na__LeChrome__PushQr(list, box.X + ((box.WidthMm - sizeMm) / 2), box.Y + ((box.HeightMm - sizeMm) / 2), sizeMm, symbol,
            colours.portalDarkColour || colours.darkColour, colours.lightColour);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Push the Shape as One Polyline Primitive (edges, fill, gradient, or a mix)
    // ------------------------------------------------------------
    function Na__LeShapeGeo__Push(list, shape) {
        // A PICTURE IS PAINTED AS A PICTURE: its shadow, the kept part of the
        // stored file and its frame, as one 'picture' primitive. The record
        // keeps no edge, fill or hatch of its own for anything below to draw.
        if (shape && shape.Shape__Image && typeof shape.Shape__Image === 'object') return Na__LeImgDraw__Push(list, shape);
        const pts = Na__LeShapeGeo__Points(shape);
        if (pts.length < 2) return false;
        const closed   = shape.Shape__Closed === true && pts.length > 2;
        const stroked  = shape.Shape__Stroked !== false;
        const fill     = (pts.length > 2 && typeof shape.Shape__FillColour === 'string') ? shape.Shape__FillColour : null;
        const gradient = (pts.length > 2 && shape.Shape__Gradient && typeof shape.Shape__Gradient === 'object') ? shape.Shape__Gradient : null;
        // THE HATCH IS A DECK, NOT A FILL. Adam, on the vector editor: 'fill,
        // hatch pattern, line work - and when I say line work, it's the bounding
        // line work of the vector.' So a closed shape can carry a repeating
        // pattern that draws OVER whatever fills it and UNDER its own outline,
        // and a shape with a hatch but no fill is a perfectly good drawing.
        const hatch = (closed && shape.Shape__Hatch && typeof shape.Shape__Hatch === 'object') ? shape.Shape__Hatch : null;
        // THE QR CODE IS A DECK OF ITS OWN, ABOVE EVERYTHING ELSE THE SHAPE
        // HAS. It is drawn last so the box's own rule, fill and hatch are
        // under it, and it is enough on its own: a shape carrying a code is
        // never "nothing to paint", even with its edges off and no fill.
        const code = (shape.Shape__Qr && typeof shape.Shape__Qr === 'object') ? shape.Shape__Qr : null;
        if (!stroked && !fill && !gradient && !hatch && !code) return false;  // <-- Nothing to paint
        if (stroked || fill || gradient || hatch) {
            // A HOLED SHAPE is one primitive whose rings are each their own
            // closed subpath, filled even-odd: the fill, the gradient and the
            // hatch stop at every hole, and the edges ring each one. `holes`
            // is only handed over when there are some, so a plain shape's
            // primitive is exactly what it always was.
            const holes = Na__LeShapeGeo__Holes(shape);
            const extra = { fillOpacity : shape.Shape__FillOpacity, strokeOpacity : shape.Shape__StrokeOpacity,
                            hatch : hatch, hatchInk : shape.Shape__StrokeColour,
                            dashArray : stroked ? Na__LeDash__PatternMm(shape.Shape__LineStyle) : [] };   // <-- A record from before the toggle has no line style and paints solid
            if (holes.length) extra.holes = holes;
            Na__LeChrome__PushPolyline(list, pts.map((p) => [ p[0], p[1] ]), stroked ? shape.Shape__StrokeColour : null, Na__LeShapeGeo__StrokeMm(shape), fill, closed, gradient, extra);
        }
        if (code) Na__LeShapeGeo__PushQr(list, shape);
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
        Na__LeShapeGeo__Holes,
        Na__LeShapeGeo__Rings,
        Na__LeShapeGeo__Segments,
        Na__LeShapeGeo__EdgePairs,
        Na__LeShapeGeo__EdgeEnd,
        Na__LeShapeGeo__Bounds,
        Na__LeShapeGeo__Translated,
        Na__LeShapeGeo__DistanceToEdge,
        Na__LeShapeGeo__Contains,
        Na__LeShapeGeo__Hit,
        Na__LeShapeGeo__VertexAt,
        Na__LeShapeGeo__ClosestOnEdge,
        Na__LeShapeGeo__InsertPoint,
        Na__LeShapeGeo__HolesAfterInsert,
        Na__LeShapeGeo__RemoveVertices,
        Na__LeShapeGeo__StrokeMm,
        Na__LeShapeGeo__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
