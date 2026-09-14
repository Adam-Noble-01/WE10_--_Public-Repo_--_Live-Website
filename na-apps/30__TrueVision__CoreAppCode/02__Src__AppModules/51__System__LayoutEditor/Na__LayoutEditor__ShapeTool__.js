// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHAPE TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__ShapeTool__.js
// NAMESPACE  : Na__LeShape
// MODULE     : Layout Editor - Shape Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw lines, polylines and polygons on the paper, point by point, with snapping to the linework and axis lock
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Click to add a point (it snaps to the linework; Shift holds the new
//   edge to the nearer axis, and an arrow key locks it to one outright).
//   The shape draws as it grows, with a rubber band from the last point
//   to the cursor.
// - Click the first point again to close a polygon. Enter, a double-click
//   or a right click finishes an open line or polyline. Escape abandons
//   the shape.
// - TYPED LENGTHS. With a point down, a length typed into the Measurements
//   box places the next vertex exactly that far along the band - the band's
//   direction, so a snap, Shift or an arrow key lock aims it first. A typed
//   vertex that lands exactly on the first one closes the polygon. The
//   length arrives in paper millimetres: Na__LayoutEditor__Measurements__
//   has already taken the drawing scale off.
// - The shape is created silently on the first click and announced once
//   on finishing, so a whole shape is one undo step. While it is being
//   drawn, Ctrl+Z takes the last vertex off (the first vertex abandons the
//   shape) and Ctrl+Y puts a taken-off vertex back; a new click or a typed
//   length clears what redo was holding.
// - Edge colour, edge weight (points), whether the edges draw at all and
//   the fill come from the Vectors panel's defaults; the panel edits them
//   afterwards. A shape being drawn always shows its edges, whatever the
//   default says, so there is something to see; a fill-only default is
//   applied on the last click.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and delegates here.
// - Na__LayoutEditor__Measurements__ reads the band (Measure) and places
//   typed vertices (TypeLength).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ShapeTool__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.5.0
// - While a shape is being drawn, UndoVertex takes the last vertex off
//   (one point left abandons the draft) and RedoVertex puts a taken-off
//   vertex back. A new click or a typed length clears the redo stack. The
//   sheet tools intercept Ctrl+Z / Ctrl+Y before the sheet history, so
//   undoing mid-draw no longer steps the last finished edit.
//
// 14-Sep-2026 - Version 1.4.0
// - Typed lengths: the band's end is kept (the direction a typed length runs),
//   Measure reports the segment being drawn and TypeLength places a vertex a
//   typed distance along it. Click and TypeLength add a vertex the same way.
//
// 14-Sep-2026 - Version 1.3.2
// - A new shape takes the Vectors panel's fill and edge opacity defaults.
//
// 13-Sep-2026 - Version 1.3.1
// - A new shape takes the Vectors panel's gradient default when it is on, so a
//   run of fades can be drawn straight off with nothing selected.
//
// 13-Sep-2026 - Version 1.3.0
// - The sheet's own vectors are snap candidates (Na__LayoutEditor__Snapping__),
//   including this shape's earlier vertices, so a polygon closes exactly on its
//   first point. The vertex just placed is excluded from the next pick.
//
// 12-Sep-2026 - Version 1.2.0
// - Rectangles can be drawn. The close-the-polygon test now asks where the
//   next point would LAND rather than where the cursor is, so hovering the
//   first vertex to borrow a coordinate no longer snaps the shape shut into
//   a triangle; and Shift holds its axis against a snap the way an arrow key
//   lock already did, instead of being cancelled by it.
//
// 10-Sep-2026 - Version 1.1.0
// - Arrow key axis lock (Na__LayoutEditor__AxisLock__), which beats a snap
//   by taking the snapped point's free coordinate, and releases as soon as
//   the point lands.
// - Carries the edges-on default through to the finished shape.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Snapping and the Band
    // ------------------------------------------------------------
    import { Na__LeCfg__GetShapeSetup, Na__LeCfg__GetSelectionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CreateShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape,
        Na__LeModel__SetSelection
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeAxis__Get, Na__LeAxis__Clear, Na__LeAxis__Apply, Na__LeAxis__Hold, Na__LeAxis__Constrain } from './Na__LayoutEditor__AxisLock__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typed Lengths
    // ------------------------------------------------------------
    const Na__LeShape__TYPED_MIN_MM   = 1e-4;   // <-- Shorter than this (paper mm) is no length at all, and no direction
    const Na__LeShape__TYPED_CLOSE_MM = 1e-3;   // <-- A typed vertex this close to the first one lands on it and closes the polygon
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Shape Being Drawn
    // ------------------------------------------------------------
    let Na__LeShape__Draft  = null;     // <-- { id, points : [[x, y], ...], stroked, aim : { x, y } where the band ends, or null }
    let Na__LeShape__Undone = [];       // <-- Vertices Ctrl+Z took off this draft; Ctrl+Y puts them back, a new click forgets them
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where the New Edge Ends: a Held Axis, Then a Snap
    // ------------------------------------------------------------
    // An arrow key lock wins outright, but takes the free coordinate from
    // whatever the cursor snapped to, so locking the axis and hovering a
    // vertex elsewhere on the drawing lines the edge up with that vertex.
    //
    // SHIFT NOW BEHAVES THE SAME WAY. It used to lose to a snap - "a snap
    // beats Shift, as in AutoCAD" - which reads as reasonable until you try
    // to draw a rectangle: the fourth corner is found by holding an axis and
    // hovering the first corner to borrow its other coordinate, and a snap
    // that wins puts the point ON the first corner instead. Shift now picks
    // the axis from the free cursor and lets the snap supply the distance
    // along it.
    // ------------------------------------------------------------
    function Na__LeShape__SnapOrConstrain(sheet, last, point, shift) {
        const snap = Na__LeOsnap__Snap(sheet, point, Na__LeShape__OwnExclusion());
        const at   = snap.snapped ? { x : snap.x, y : snap.y } : point;
        if (last && Na__LeAxis__Get()) return Na__LeAxis__Apply(last, at);        // <-- Arrow key lock: the axis is named outright
        if (last && shift)             return Na__LeAxis__Hold(last, point, at);  // <-- Shift: the cursor names the axis, the snap measures along it
        if (snap.snapped) return at;
        return Na__LeAxis__Constrain(last, point, shift);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Shape Being Drawn Must Not Snap To
    // ------------------------------------------------------------
    // The vertex just placed is where the rubber band starts, so it is the
    // one point the next vertex can never usefully land on - offering it
    // would park the marker under the cursor every time the pointer set off.
    // Every other vertex of the draft stays a candidate, and that is the
    // improvement: the first corner is now a real snap target, so a polygon
    // closes EXACTLY on it and a rectangle's last corner can borrow its
    // coordinate even on bare paper with no linework underneath.
    // ------------------------------------------------------------
    function Na__LeShape__OwnExclusion() {
        const draft = Na__LeShape__Draft;
        if (!draft) return null;
        return { kind : 'shape', id : draft.id, index : draft.points.length - 1 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Would the Next Point Land on the First One (a polygon closes there)
    // ------------------------------------------------------------
    // TAKES THE RESOLVED POINT, NOT THE RAW CURSOR, and that distinction is
    // the whole fix. Asking "is the cursor near the first vertex" closed the
    // shape whenever the cursor went anywhere near where it started -
    // including the one moment you most need it not to. Three sides of a
    // rectangle down, you hold the axis across from the third corner and
    // hover the first corner to pick up its x; the cursor is then right on
    // top of the first vertex, so the old test closed the shape from corner
    // three straight back to corner one and left a triangle. Every attempt
    // at a rectangle ended the same way.
    //
    // Asking instead "would the point I am about to place land on the first
    // vertex" answers correctly in both cases. Held across from corner three,
    // the point resolves to corner four - a rectangle's height away from the
    // first vertex - so nothing closes and the corner lands square. Held down
    // the page from corner four, or hovering the first vertex with no
    // constraint at all, the point resolves onto the first vertex itself and
    // the polygon closes, which is what was wanted.
    //
    // radiusMm is left out for a click (the close radius on screen) and given
    // for a typed vertex, which closes only by landing on the first one.
    // ------------------------------------------------------------
    function Na__LeShape__NearFirst(resolved, radiusMm) {
        const draft = Na__LeShape__Draft;
        if (!draft || draft.points.length < 3) return false;
        const radius = Number.isFinite(radiusMm) ? radiusMm : Na__LeCfg__GetShapeSetup().closeRadiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        return Math.hypot(resolved.x - draft.points[0][0], resolved.y - draft.points[0][1]) <= radius;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Add a Vertex to the Shape Being Drawn
    // ------------------------------------------------------------
    // The one way a vertex goes down, clicked or typed: silent, so the whole
    // shape is still one undo step, and the band starts again from it.
    // ------------------------------------------------------------
    function Na__LeShape__AddVertex(sheet, pt) {
        const draft = Na__LeShape__Draft;
        draft.points.push(pt);
        draft.aim = null;                                                    // <-- The band has no end until the cursor gives it one
        Na__LeShape__Undone = [];                                            // <-- A new vertex starts a new future
        Na__LeModel__UpdateShape(sheet, draft.id, { points : draft.points.slice() }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeAxis__Clear();                                                 // <-- Each segment locks on its own
        Na__LeGrips__ShowBand(pt, pt, null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | A Click With the Draw Tool
    // ------------------------------------------------------------
    // defaults: { strokeColour, strokePt, fillColour, filled, stroked, fillOpacity, strokeOpacity, gradientOn, gradient }
    // ------------------------------------------------------------
    function Na__LeShape__Click(sheet, pointMm, shift, defaults) {
        const draft = Na__LeShape__Draft;
        const last  = draft ? draft.points[draft.points.length - 1] : null;
        const p     = last ? Na__LeShape__SnapOrConstrain(sheet, last, pointMm, shift) : Na__LeOsnap__Snap(sheet, pointMm);
        if (draft && Na__LeShape__NearFirst(p)) return Na__LeShape__Finish(sheet, true);         // <-- The point itself lands on the first one: a polygon
        const pt = [ p.x, p.y ];
        if (!draft) {
            const d    = defaults || {};
            const item = Na__LeModel__CreateShape(sheet, [ pt ], {
                strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null,
                fillOpacity : d.fillOpacity, strokeOpacity : d.strokeOpacity,
                gradient : d.gradientOn ? d.gradient : null, closed : false, stroked : true, silent : true
            });
            if (!item) return false;
            Na__LeShape__Draft  = { id : item.Shape__Id, points : [ pt ], stroked : d.stroked !== false, aim : null };   // <-- Drawn with edges, finished as the default asks
            Na__LeShape__Undone = [];
            Na__LeAxis__Clear();                                             // <-- The point landed: the lock is spent
            Na__LeGrips__ShowBand(pt, pt, null);
            return true;
        }
        if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < Na__LeCfg__GetSelectionSetup().dragThresholdMm) return false;   // <-- A doubled point is not a vertex
        Na__LeShape__AddVertex(sheet, pt);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Draw Tool
    // ------------------------------------------------------------
    function Na__LeShape__Move(sheet, pointMm, shift) {
        const draft = Na__LeShape__Draft;
        if (!draft) { Na__LeOsnap__Snap(sheet, pointMm); return false; }   // <-- Marker before the first click
        const last = draft.points[draft.points.length - 1];
        const p    = Na__LeShape__SnapOrConstrain(sheet, last, pointMm, shift);
        if (Na__LeShape__NearFirst(p)) {
            draft.aim = { x : draft.points[0][0], y : draft.points[0][1] };  // <-- A length typed now runs towards the first point
            Na__LeOsnap__ShowMarker({ x : draft.points[0][0], y : draft.points[0][1], kind : 'end' });   // <-- Closing is on offer
            Na__LeGrips__ShowBand(last, draft.points[0], null);
            return true;
        }
        draft.aim = { x : p.x, y : p.y };                                    // <-- Where the band ends is the way a typed length runs
        Na__LeGrips__ShowBand(last, [ p.x, p.y ], Na__LeAxis__Get());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish the Shape (closed as a polygon, or open)
    // ------------------------------------------------------------
    function Na__LeShape__Finish(sheet, close) {
        const draft = Na__LeShape__Draft;
        if (!draft) return false;
        Na__LeShape__Draft  = null;
        Na__LeShape__Undone = [];
        Na__LeAxis__Clear();
        Na__LeGrips__HideBand();
        Na__LeOsnap__HideMarker();
        if (!sheet) return false;
        if (draft.points.length < 2) { Na__LeModel__DeleteShape(sheet, draft.id); return false; }   // <-- One point is not a shape
        const closed = close === true && draft.points.length > 2;
        Na__LeModel__UpdateShape(sheet, draft.id, { points : draft.points.slice(), closed : closed, stroked : draft.stroked }, false);   // <-- One announcement: one history step
        Na__LeModel__SetSelection({ kind : 'shape', id : draft.id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Shape Being Drawn
    // ------------------------------------------------------------
    function Na__LeShape__Cancel(sheet) {
        const draft = Na__LeShape__Draft;
        Na__LeShape__Draft  = null;
        Na__LeShape__Undone = [];
        Na__LeAxis__Clear();
        Na__LeGrips__HideBand();
        Na__LeOsnap__HideMarker();
        if (draft && sheet) Na__LeModel__DeleteShape(sheet, draft.id);      // <-- Never announced as created, so nothing to undo
        return !!draft;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Shape Being Drawn
    // ------------------------------------------------------------
    function Na__LeShape__IsDrawing() { return !!Na__LeShape__Draft; }
    // ------------------------------------------------------------


    // FUNCTION | Take the Last Vertex Off the Shape Being Drawn
    // ------------------------------------------------------------
    // One point left is not a shape: the draft is abandoned, the way Escape
    // does. Returns true when the key was spent, so the sheet history is
    // left alone.
    // ------------------------------------------------------------
    function Na__LeShape__UndoVertex(sheet) {
        const draft = Na__LeShape__Draft;
        if (!draft) return false;
        if (draft.points.length <= 1) return Na__LeShape__Cancel(sheet);
        const popped = draft.points.pop();
        Na__LeShape__Undone.push(popped);
        draft.aim = null;
        Na__LeModel__UpdateShape(sheet, draft.id, { points : draft.points.slice() }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeAxis__Clear();
        const last = draft.points[draft.points.length - 1];
        Na__LeGrips__ShowBand(last, last, null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Back a Vertex Ctrl+Z Took Off This Draft
    // ------------------------------------------------------------
    // Only vertices taken off this drawing: a new click or a typed length
    // empties the stack. Returns true when the key was spent, even if the
    // stack was empty, so redo mid-draw never steps the sheet history.
    // ------------------------------------------------------------
    function Na__LeShape__RedoVertex(sheet) {
        const draft = Na__LeShape__Draft;
        if (!draft) return false;
        if (!Na__LeShape__Undone.length || !sheet) return true;
        const pt = Na__LeShape__Undone.pop();
        draft.points.push(pt);
        draft.aim = null;
        Na__LeModel__UpdateShape(sheet, draft.id, { points : draft.points.slice() }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeAxis__Clear();
        Na__LeGrips__ShowBand(pt, pt, null);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typed Lengths
// -----------------------------------------------------------------------------

    // FUNCTION | The Segment Being Drawn
    // ------------------------------------------------------------
    // Returns { from : { x, y }, to : { x, y } or null, count } in paper
    // millimetres: the last vertex, where the band ends (null until the
    // cursor has moved since that vertex went down) and how many vertices
    // there are. Null while no shape is being drawn.
    // ------------------------------------------------------------
    function Na__LeShape__Measure() {
        const draft = Na__LeShape__Draft;
        if (!draft) return null;
        const last = draft.points[draft.points.length - 1];
        return {
            from  : { x : last[0], y : last[1] },
            to    : draft.aim ? { x : draft.aim.x, y : draft.aim.y } : null,
            count : draft.points.length
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Place the Next Vertex a Typed Distance Along the Band
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // Returns { ok : true, closed } or { ok : false, reason } - 'none' with no
    // shape being drawn, 'length' for no length, 'direction' when the band
    // has no end to aim along.
    // ------------------------------------------------------------
    function Na__LeShape__TypeLength(sheet, lengthMm) {
        const draft = Na__LeShape__Draft;
        if (!draft || !sheet) return { ok : false, reason : 'none' };
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeShape__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const last = draft.points[draft.points.length - 1];
        const aim  = draft.aim;
        const run  = aim ? Math.hypot(aim.x - last[0], aim.y - last[1]) : 0;
        if (!(run >= Na__LeShape__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const pt = [ last[0] + (((aim.x - last[0]) / run) * lengthMm), last[1] + (((aim.y - last[1]) / run) * lengthMm) ];
        if (Na__LeShape__NearFirst({ x : pt[0], y : pt[1] }, Na__LeShape__TYPED_CLOSE_MM)) {
            Na__LeShape__Finish(sheet, true);                                // <-- Typed back onto the first vertex: the polygon closes
            return { ok : true, closed : true };
        }
        Na__LeShape__AddVertex(sheet, pt);
        return { ok : true, closed : false };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Shape Tool API
    // ------------------------------------------------------------
    export {
        Na__LeShape__Click,
        Na__LeShape__Move,
        Na__LeShape__Finish,
        Na__LeShape__Cancel,
        Na__LeShape__IsDrawing,
        Na__LeShape__UndoVertex,
        Na__LeShape__RedoVertex,
        Na__LeShape__Measure,
        Na__LeShape__TypeLength
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
