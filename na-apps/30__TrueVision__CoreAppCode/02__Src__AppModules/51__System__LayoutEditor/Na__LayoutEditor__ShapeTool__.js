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
// - The shape is created silently on the first click and announced once
//   on finishing, so a whole shape is one undo step.
// - Edge colour, edge weight (points), whether the edges draw at all and
//   the fill come from the Vectors panel's defaults; the panel edits them
//   afterwards. A shape being drawn always shows its edges, whatever the
//   default says, so there is something to see; a fill-only default is
//   applied on the last click.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and delegates here.
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
    import { Na__LeAxis__Get, Na__LeAxis__Clear, Na__LeAxis__Apply, Na__LeAxis__Constrain } from './Na__LayoutEditor__AxisLock__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Shape Being Drawn
    // ------------------------------------------------------------
    let Na__LeShape__Draft = null;     // <-- { id, points : [[x, y], ...], stroked }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where the New Edge Ends: a Lock, Then a Snap, Then Shift
    // ------------------------------------------------------------
    // An arrow key lock wins outright, but takes the free coordinate from
    // whatever the cursor snapped to, so locking the axis and hovering a
    // vertex elsewhere on the drawing lines the edge up with that vertex.
    // With no lock a snap beats Shift, as in AutoCAD.
    // ------------------------------------------------------------
    function Na__LeShape__SnapOrConstrain(sheet, last, point, shift) {
        const snap = Na__LeOsnap__Snap(sheet, point);
        const at   = snap.snapped ? { x : snap.x, y : snap.y } : point;
        if (Na__LeAxis__Get() && last) return Na__LeAxis__Apply(last, at);
        if (snap.snapped) return at;
        return Na__LeAxis__Constrain(last, point, shift);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Cursor Back on the First Point (a polygon closes there)
    // ------------------------------------------------------------
    function Na__LeShape__NearFirst(pointMm) {
        const draft = Na__LeShape__Draft;
        if (!draft || draft.points.length < 3) return false;
        const radiusMm = Na__LeCfg__GetShapeSetup().closeRadiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        return Math.hypot(pointMm.x - draft.points[0][0], pointMm.y - draft.points[0][1]) <= radiusMm;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | A Click With the Draw Tool
    // ------------------------------------------------------------
    // defaults: { strokeColour, strokePt, fillColour, filled, stroked }
    // ------------------------------------------------------------
    function Na__LeShape__Click(sheet, pointMm, shift, defaults) {
        const draft = Na__LeShape__Draft;
        if (draft && Na__LeShape__NearFirst(pointMm)) return Na__LeShape__Finish(sheet, true);   // <-- Back on the first point: a polygon
        const last = draft ? draft.points[draft.points.length - 1] : null;
        const p    = last ? Na__LeShape__SnapOrConstrain(sheet, last, pointMm, shift) : Na__LeOsnap__Snap(sheet, pointMm);
        const pt   = [ p.x, p.y ];
        if (!draft) {
            const d    = defaults || {};
            const item = Na__LeModel__CreateShape(sheet, [ pt ], {
                strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null, closed : false, stroked : true, silent : true
            });
            if (!item) return false;
            Na__LeShape__Draft = { id : item.Shape__Id, points : [ pt ], stroked : d.stroked !== false };   // <-- Drawn with edges, finished as the default asks
            Na__LeAxis__Clear();                                             // <-- The point landed: the lock is spent
            Na__LeGrips__ShowBand(pt, pt, null);
            return true;
        }
        if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < Na__LeCfg__GetSelectionSetup().dragThresholdMm) return false;   // <-- A doubled point is not a vertex
        draft.points.push(pt);
        Na__LeModel__UpdateShape(sheet, draft.id, { points : draft.points.slice() }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeAxis__Clear();                                                 // <-- Each segment locks on its own
        Na__LeGrips__ShowBand(pt, pt, null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Draw Tool
    // ------------------------------------------------------------
    function Na__LeShape__Move(sheet, pointMm, shift) {
        const draft = Na__LeShape__Draft;
        if (!draft) { Na__LeOsnap__Snap(sheet, pointMm); return false; }   // <-- Marker before the first click
        const last = draft.points[draft.points.length - 1];
        if (Na__LeShape__NearFirst(pointMm)) {
            Na__LeOsnap__ShowMarker({ x : draft.points[0][0], y : draft.points[0][1], kind : 'end' });   // <-- Closing is on offer
            Na__LeGrips__ShowBand(last, draft.points[0], null);
            return true;
        }
        const p = Na__LeShape__SnapOrConstrain(sheet, last, pointMm, shift);
        Na__LeGrips__ShowBand(last, [ p.x, p.y ], Na__LeAxis__Get());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish the Shape (closed as a polygon, or open)
    // ------------------------------------------------------------
    function Na__LeShape__Finish(sheet, close) {
        const draft = Na__LeShape__Draft;
        if (!draft) return false;
        Na__LeShape__Draft = null;
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
        Na__LeShape__Draft = null;
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
        Na__LeShape__IsDrawing
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
