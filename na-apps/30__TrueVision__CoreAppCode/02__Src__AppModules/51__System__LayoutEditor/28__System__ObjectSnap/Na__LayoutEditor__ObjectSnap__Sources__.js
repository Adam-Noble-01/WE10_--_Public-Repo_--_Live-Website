// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - SHEET SOURCES
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Sources__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Sheet Sources
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What the sheet's own objects offer a snap: the points and the lines of its vectors, its text, its dimensions and its own paper
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A viewport's linework is filed on a grid (Na__LayoutEditor__ObjectSnap__
//   Index__). Everything else a point can snap to is drawn ON the sheet, and
//   is read here, LIVE, every time:
//     * VECTORS (target 'shape', blue): every vertex an endpoint, the middle
//       of every edge a midpoint, the centre of area of a closed one a centre,
//       and every edge a LINE for Perpendicular, Intersection and Nearest. A
//       circle or an arc (a vector carrying Shape__Curve, from the Vector
//       Tools) is a run of tiny edges, so it offers what a draughtsman aims
//       at instead: its centre, a circle's four quadrant points, an arc's two
//       ends and its middle - never a point every millimetre round it.
//     * TEXT (target 'text', orange): the four corners of a text item's box,
//       the middle of each side and the middle of the box, turned with it.
//     * DIMENSIONS (target 'dimension', red): the two points each one
//       measures, so dimensions chain.
//     * THE PAPER ITSELF (target 'paper', slate): the border's, the title
//       block's and the notes margin's corners, ends and midpoints, and their
//       lines - read off the chrome primitives the screen and the PDF are
//       drawn from, so a cell that grows to fit a long title moves its snap
//       points with it.
// - A LINEAR SCAN, NOT AN INDEX, and deliberately. A sheet carries tens to a
//   few hundred vertices, which is microseconds to walk per pointer move. An
//   index would have to be invalidated by every change - including the SILENT
//   ones the draw tool makes as each vertex lands and a drag makes on every
//   move - and a stale index is exactly the bug that makes a snap feel
//   haunted. Walking the live records means the corner placed a moment ago is
//   a candidate the moment it exists. Anything whose box is nowhere near the
//   cursor is passed over before its points are looked at.
// - WHAT A LAYER OFFERS. A hidden layer offers nothing, and neither does a
//   REFERENCE layer (the Layers panel's Ref): shown, but nothing snaps, tracks
//   or lines up to it. A LOCKED layer still offers every point: a lock stops
//   an edit, not an alignment.
// - WHAT IS LEFT OUT. exclude names what is being moved, so it never snaps to
//   itself: { kind : 'shape', id, index } is one vertex of a vector - it, and
//   the two edges it drags along, are skipped; with no index the whole vector
//   is. { kind : 'dimension', id, index : 'start' | 'end' } likewise, and
//   { kind : 'annotation', id } a text item. A selection moved as one passes
//   an array of them.
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__Search__ walks EachSheetPoint and
//   EachSheetSegment for every search.
// - Na__Test__DrawingGrid__ reads ChromePoints (the title block's snap points).
// - Na__LayoutEditor__VectorTools__Curves__ (37__System__VectorTools) says
//   what curve a Shape__Curve vector is.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). Offers, ChromeFrom,
//                   ChromePoints and the vector and dimension walks came across
//                   from 30__System__SheetTools/Na__LayoutEditor__Snapping__.js 1.5.0.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Moved here from the Snapping module. New: text is a snap source; a closed
//   vector offers its centre; circles and arcs offer their centre and their
//   quadrant points; every source offers its LINES as well as its points, and
//   says which kind of object it is (the marker's colour).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Surface, Layout, Geometry, Text and Curves
    // ------------------------------------------------------------
    import { Na__LeModel__IsLayerVisible, Na__LeModel__IsLayerSelectable } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetSheet, Na__LeSurface__GetLayout, Na__LeSurface__GetSheetChrome } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeLayout__MarginRect } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeShapeGeo__Points } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeMarkup__AnnotationCorners } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeVecCurve__KIND_CIRCLE, Na__LeVecCurve__Describe } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__Curves__.js';   // <-- A leaf: what curve a Shape__Curve vector's points are
    import { Na__LeOsnapGeo__Centroid } from './Na__LayoutEditor__ObjectSnap__Geometry__.js';
    import {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_MID,
        Na__LeOsnap__KIND_CEN,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_TEXT,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__TARGET_PAPER
    } from './Na__LayoutEditor__ObjectSnap__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Paper's Own Snap Points, and What Curve Each Curved Vector Is
    // ------------------------------------------------------------
    let   Na__LeOsnap__Chrome = { primitives : null, marginKey : '', points : [], segs : [] };   // <-- Worked out once per chrome build
    const Na__LeOsnap__Curves = new WeakMap();                                                    // <-- Shape__Points array -> what Describe said (UpdateShape replaces the array, so a moved circle is asked again)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet's Own Paper: Border, Title Block and Notes Margin
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Every Corner, End, Midpoint and Line the Sheet's Own Lines Offer
    // ------------------------------------------------------------
    // THE TITLE BLOCK IS WHERE CONSTRUCTION LINES START. Adam, over a marked-up
    // D11: the corners of the border, the ends of the notes margin's divider
    // and the corners of the title block strip should be "inferencible and
    // snappable", so a line can be set out from them. They were drawn and
    // could not be picked, because the only candidates were the viewports'
    // linework and the sheet's own markup.
    //
    // READ OFF WHAT IS DRAWN, NOT WORKED OUT AGAIN. The chrome primitives are
    // the very list the screen and the PDF paint the border and title block
    // from, so every stroked rectangle gives its four corners and the middle
    // of each side, and every line - each cell divider, the logo's, the QR
    // cell's - its two ends and its middle. A cell that grows to fit a long
    // drawing title moves its divider, and the snap point moves with it. Text,
    // pictures and the QR symbol give nothing. The notes margin's divider is
    // drawn with the markup rather than the chrome, so its rectangle is asked
    // of the layout: its two ends are where it meets the border and the title
    // block. Returns { points : flat [x, y, kind (0 end, 1 mid), ...],
    // segs : flat [ax, ay, bx, by, ...] }.
    // ------------------------------------------------------------
    function Na__LeOsnap__ChromeFrom(primitives, margin) {
        const points = [], segs = [];
        const seen = new Set();
        const push = (x, y, kind) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const id = kind + ':' + Math.round(x * 100) + ':' + Math.round(y * 100);
            if (seen.has(id)) return;                                            // <-- The strip's foot is the border's foot: one point, not two
            seen.add(id);
            points.push(x, y, kind);
        };
        const side = (x1, y1, x2, y2) => {
            if (![ x1, y1, x2, y2 ].every(Number.isFinite)) return;
            push(x1, y1, 0); push(x2, y2, 0); push((x1 + x2) / 2, (y1 + y2) / 2, 1);
            segs.push(x1, y1, x2, y2);
        };
        (primitives || []).forEach((p) => {
            if (!p) return;
            if (p.Kind === 'rect' && p.StrokeColour && p.StrokeMm > 0) {        // <-- A drawn outline; a paper-coloured fill alone is not a line
                const x0 = p.X, y0 = p.Y, x1 = p.X + p.WidthMm, y1 = p.Y + p.HeightMm;
                side(x0, y0, x1, y0); side(x1, y0, x1, y1); side(x1, y1, x0, y1); side(x0, y1, x0, y0);
            } else if (p.Kind === 'line') {
                side(p.X1, p.Y1, p.X2, p.Y2);
            }
        });
        if (margin) side(margin.X, margin.Y, margin.X, margin.Y + margin.HeightMm);
        return { points : points, segs : segs };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Paper's Snap Points and Lines, for the Sheet on Screen
    // ------------------------------------------------------------
    // Worked out once per chrome build (the surface keeps the primitives until
    // the chrome changes) and once per notes margin width, so a pointer move
    // only reads a list. A sheet that is not the one on screen has no chrome
    // built, and offers nothing.
    // ------------------------------------------------------------
    function Na__LeOsnap__ChromeFor(sheet) {
        const onScreen = Na__LeSurface__GetSheet();
        if (!sheet || !onScreen || onScreen.Sheet__Id !== sheet.Sheet__Id) return { points : [], segs : [] };
        const primitives = Na__LeSurface__GetSheetChrome();
        const layout     = Na__LeSurface__GetLayout();
        const margin     = layout ? Na__LeLayout__MarginRect(sheet, layout.Content, layout.TitleBlock) : null;
        const marginKey  = margin ? [ margin.X, margin.Y, margin.WidthMm, margin.HeightMm ].join('|') : '';
        const cache      = Na__LeOsnap__Chrome;
        if (cache.primitives === primitives && cache.marginKey === marginKey) return cache;
        const built = Na__LeOsnap__ChromeFrom(primitives, margin);
        Na__LeOsnap__Chrome = { primitives : primitives, marginKey : marginKey, points : built.points, segs : built.segs };
        return Na__LeOsnap__Chrome;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet Paper's Snap Points (flat [x, y, kind (0 end, 1 mid), ...])
    // ------------------------------------------------------------
    function Na__LeOsnap__ChromePoints(sheet) { return Na__LeOsnap__ChromeFor(sheet).points; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What May Be Snapped To, and What Is Left Out
// -----------------------------------------------------------------------------

    // FUNCTION | Does a Layer Offer Snap Points
    // ------------------------------------------------------------
    // Not a hidden one, and not a REFERENCE one - shown, but out of the
    // pointer's reach and the snaps' alike. A LOCKED layer still offers every
    // point it has: a lock stops an edit, not an alignment.
    // ------------------------------------------------------------
    function Na__LeOsnap__Offers(sheet, layerId) {
        return Na__LeModel__IsLayerVisible(sheet, layerId) && Na__LeModel__IsLayerSelectable(sheet, layerId);
    }
    // ------------------------------------------------------------


    // FUNCTION | An Exclusion, However It Was Handed In, as a List
    // ------------------------------------------------------------
    function Na__LeOsnap__Exclusions(exclude) {
        return Array.isArray(exclude) ? exclude.filter(Boolean) : (exclude ? [ exclude ] : []);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Box Out of Reach of the Cursor
    // ------------------------------------------------------------
    // near is { x, y, r } - the cursor and how far round it matters - or null
    // for "everything". A cheap test on a box, before any point is looked at.
    // ------------------------------------------------------------
    function Na__LeOsnap__FarFrom(near, minX, minY, maxX, maxY) {
        if (!near) return false;
        return near.x < minX - near.r || near.x > maxX + near.r || near.y < minY - near.r || near.y > maxY + near.r;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Curve a Vector Is, or Null (asked once per points array)
    // ------------------------------------------------------------
    // ONLY A VECTOR THAT SAYS IT IS A CURVE IS ASKED. The Vector Tools' circle
    // is a closed run of 24 to 360 points with a one-word hint on the record
    // (Shape__Curve); Describe reads the centre back from the live points, so
    // it survives a move or a copy, and answers null once a vertex has been
    // dragged off the circle - after which the vector is a polygon like any
    // other. Without the hint a plain square would read as a four-sided
    // circle, which it is not.
    // ------------------------------------------------------------
    function Na__LeOsnap__CurveOf(shape, points) {
        if (!shape || !shape.Shape__Curve || !Array.isArray(shape.Shape__Points)) return null;
        const key = shape.Shape__Points;
        if (Na__LeOsnap__Curves.has(key)) return Na__LeOsnap__Curves.get(key);
        let curve = null;
        try { curve = Na__LeVecCurve__Describe(points, shape.Shape__Closed === true) || null; } catch (error) { curve = null; }
        Na__LeOsnap__Curves.set(key, curve);
        return curve;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Points
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Points One Vector Offers
    // ------------------------------------------------------------
    // moving is the index of the vertex in motion, or -1: it, and the middles
    // of the two edges it drags along, are skipped - otherwise the point would
    // snap to itself and chase the cursor.
    // ------------------------------------------------------------
    function Na__LeOsnap__ShapePoints(shape, pts, moving, visit) {
        const n = pts.length, id = shape.Shape__Id;
        const curve = moving === -1 ? Na__LeOsnap__CurveOf(shape, pts) : null;   // <-- A circle with a vertex in motion is already not a circle
        if (curve) {
            visit(curve.cx, curve.cy, Na__LeOsnap__KIND_CEN, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
            if (curve.kind === Na__LeVecCurve__KIND_CIRCLE) {
                [ [ 1, 0 ], [ 0, 1 ], [ -1, 0 ], [ 0, -1 ] ].forEach((q) => visit(curve.cx + (q[0] * curve.r), curve.cy + (q[1] * curve.r), Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_SHAPE, 'shape', id));   // <-- The four quadrant points
            } else {
                const mid = curve.start + (curve.sweep / 2);
                visit(pts[0][0], pts[0][1], Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
                visit(pts[n - 1][0], pts[n - 1][1], Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
                visit(curve.cx + (Math.cos(mid) * curve.r), curve.cy + (Math.sin(mid) * curve.r), Na__LeOsnap__KIND_MID, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
            }
            return;
        }
        for (let i = 0; i < n; i++) {
            if (i !== moving) visit(pts[i][0], pts[i][1], Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
        }
        const closed = shape.Shape__Closed === true && n > 2;
        if (n > 1) {
            const edges = closed ? n : n - 1;
            for (let i = 0; i < edges; i++) {
                const j = (i + 1) % n;
                if (i === moving || j === moving) continue;                      // <-- That edge is being dragged; its middle moves with the cursor
                visit((pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2, Na__LeOsnap__KIND_MID, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
            }
        }
        if (closed && moving === -1) {
            const centre = Na__LeOsnapGeo__Centroid(pts);
            if (centre) visit(centre.x, centre.y, Na__LeOsnap__KIND_CEN, Na__LeOsnap__TARGET_SHAPE, 'shape', id);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Text Item Could Possibly Reach From Where It Is Placed
    // ------------------------------------------------------------
    // Generous on purpose: it only decides whether the text is worth
    // MEASURING, which costs a text measure per line. Anything nearer than
    // this is measured properly and its real box is what snaps.
    // ------------------------------------------------------------
    function Na__LeOsnap__TextReachMm(item) {
        const size  = Number.isFinite(item.Annotation__SizeMm) ? item.Annotation__SizeMm : 3;
        const lines = String(item.Annotation__Text || '').split('\n');
        let longest = 1;
        lines.forEach((line) => { longest = Math.max(longest, line.length); });
        return (longest * size * 1.2) + (lines.length * size * 2);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Point the Sheet's Own Objects Offer
    // ------------------------------------------------------------
    // visit(x, y, kind, target, source, sourceId). near is { x, y, r } or
    // null; wanted is { shape, text, dimension, paper } - which targets to
    // walk at all (a switched-off target is never measured).
    // ------------------------------------------------------------
    function Na__LeOsnap__EachSheetPoint(sheet, exclude, near, wanted, visit) {
        if (!sheet || typeof visit !== 'function') return;
        const exclusions = Na__LeOsnap__Exclusions(exclude);
        const want = wanted || {};

        // VECTORS | Every vertex, the midpoint of every edge, a closed one's centre
        // ------------------------------------
        const shapes = want.shape === false ? [] : (sheet.Sheet__Shapes || []);
        for (let s = 0; s < shapes.length; s++) {
            const shape = shapes[s];
            if (!Na__LeOsnap__Offers(sheet, shape.Shape__LayerId)) continue;     // <-- A hidden or a reference layer offers nothing; a LOCKED one still does
            const skip = exclusions.find((item) => item.kind === 'shape' && item.id === shape.Shape__Id);
            if (skip && !Number.isInteger(skip.index)) continue;                 // <-- The whole vector is in motion
            const pts = Na__LeShapeGeo__Points(shape);
            if (!pts.length) continue;
            if (near) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
                if (Na__LeOsnap__FarFrom(near, minX, minY, maxX, maxY)) continue;
            }
            Na__LeOsnap__ShapePoints(shape, pts, skip ? skip.index : -1, visit);
        }

        // TEXT | The corners of its box, the middle of each side and its middle, turned with it
        // ------------------------------------
        const texts = want.text === false ? [] : (sheet.Sheet__Annotations || []);
        for (let t = 0; t < texts.length; t++) {
            const item = texts[t];
            if (!Na__LeOsnap__Offers(sheet, item.Annotation__LayerId)) continue;
            if (exclusions.some((one) => one.kind === 'annotation' && one.id === item.Annotation__Id)) continue;
            if (near) {
                const reach = Na__LeOsnap__TextReachMm(item) + near.r;
                if (Math.abs(item.Annotation__PosXMm - near.x) > reach || Math.abs(item.Annotation__PosYMm - near.y) > reach) continue;
            }
            const c = Na__LeMarkup__AnnotationCorners(item, 0);
            if (!c || c.length !== 4) continue;
            const id = item.Annotation__Id;
            for (let i = 0; i < 4; i++) {
                const a = c[i], b = c[(i + 1) % 4];
                visit(a[0], a[1], Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_TEXT, 'annotation', id);
                visit((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Na__LeOsnap__KIND_MID, Na__LeOsnap__TARGET_TEXT, 'annotation', id);
            }
            visit((c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, Na__LeOsnap__KIND_CEN, Na__LeOsnap__TARGET_TEXT, 'annotation', id);
        }

        // DIMENSIONS | The two points each one measures, so dimensions chain
        // ------------------------------------
        const dims = want.dimension === false ? [] : (sheet.Sheet__Dimensions || []);
        for (let k = 0; k < dims.length; k++) {
            const dim = dims[k];
            if (!Na__LeOsnap__Offers(sheet, dim.Dimension__LayerId)) continue;
            const skip = exclusions.find((item) => item.kind === 'dimension' && item.id === dim.Dimension__Id);
            if (skip && !skip.index) continue;
            if (!(skip && skip.index === 'start')) visit(dim.Dimension__StartXMm, dim.Dimension__StartYMm, Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_DIMENSION, 'dimension', dim.Dimension__Id);
            if (!(skip && skip.index === 'end'))   visit(dim.Dimension__EndXMm,   dim.Dimension__EndYMm,   Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_DIMENSION, 'dimension', dim.Dimension__Id);
        }

        // THE PAPER ITSELF | Nothing drags it, so nothing is ever excluded, and
        // no layer hides it.
        // ------------------------------------
        if (want.paper !== false) {
            const chrome = Na__LeOsnap__ChromeFor(sheet).points;
            for (let k = 0; k + 2 < chrome.length; k += 3) {
                visit(chrome[k], chrome[k + 1], chrome[k + 2] === 1 ? Na__LeOsnap__KIND_MID : Na__LeOsnap__KIND_END, Na__LeOsnap__TARGET_PAPER, 'chrome', null);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lines
// -----------------------------------------------------------------------------

    // FUNCTION | Every Line the Sheet's Own Objects Offer
    // ------------------------------------------------------------
    // visit(ax, ay, bx, by, target, source, sourceId). The edges of every
    // vector, and the paper's own lines. Text has a box but no drawn line, and
    // a dimension's lines are not things to draw to, so neither offers any.
    // A vertex in motion takes the two edges it drags with it out.
    // ------------------------------------------------------------
    function Na__LeOsnap__EachSheetSegment(sheet, exclude, near, wanted, visit) {
        if (!sheet || typeof visit !== 'function') return;
        const exclusions = Na__LeOsnap__Exclusions(exclude);
        const want = wanted || {};

        const shapes = want.shape === false ? [] : (sheet.Sheet__Shapes || []);
        for (let s = 0; s < shapes.length; s++) {
            const shape = shapes[s];
            if (!Na__LeOsnap__Offers(sheet, shape.Shape__LayerId)) continue;
            const skip = exclusions.find((item) => item.kind === 'shape' && item.id === shape.Shape__Id);
            if (skip && !Number.isInteger(skip.index)) continue;
            const moving = skip ? skip.index : -1;
            const pts = Na__LeShapeGeo__Points(shape);
            const n   = pts.length;
            if (n < 2) continue;
            const edges = (shape.Shape__Closed === true && n > 2) ? n : n - 1;
            for (let i = 0; i < edges; i++) {
                const j = (i + 1) % n;
                if (i === moving || j === moving) continue;
                const a = pts[i], b = pts[j];
                if (Na__LeOsnap__FarFrom(near, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]))) continue;
                visit(a[0], a[1], b[0], b[1], Na__LeOsnap__TARGET_SHAPE, 'shape', shape.Shape__Id);
            }
        }

        if (want.paper !== false) {
            const segs = Na__LeOsnap__ChromeFor(sheet).segs;
            for (let k = 0; k + 3 < segs.length; k += 4) {
                if (Na__LeOsnap__FarFrom(near, Math.min(segs[k], segs[k + 2]), Math.min(segs[k + 1], segs[k + 3]), Math.max(segs[k], segs[k + 2]), Math.max(segs[k + 1], segs[k + 3]))) continue;
                visit(segs[k], segs[k + 1], segs[k + 2], segs[k + 3], Na__LeOsnap__TARGET_PAPER, 'chrome', null);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Sheet Sources
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__Offers,
        Na__LeOsnap__Exclusions,
        Na__LeOsnap__ChromeFrom,
        Na__LeOsnap__ChromePoints,
        Na__LeOsnap__EachSheetPoint,
        Na__LeOsnap__EachSheetSegment
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
