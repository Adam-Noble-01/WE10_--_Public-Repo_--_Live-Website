// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - RECTANGLE TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__RectangleTool__.js
// NAMESPACE  : Na__LeRect
// MODULE     : Layout Editor - Rectangle Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a rectangle corner to corner, snapping like the Draw tool, and hand it over as an ordinary closed vector shape
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - Two ways to draw it, both corner to corner: click one corner and then the
//   opposite one, or press on one corner and drag to the other. Both corners
//   snap to the linework and the sheet's own vectors exactly as the Draw
//   tool's points do. Shift holds it square, on the longer of the two sides.
// - WHAT IT MAKES IS NOT A NEW KIND OF THING. The finished rectangle is a
//   closed four-point shape in Sheet__Shapes, written through the same
//   CreateShape call the Draw tool uses, with the same Vectors panel defaults
//   (edge colour, edge weight, edges on or off, fill). From then on it IS a
//   polygon: the Select tool drags its corners by their grips, the Vectors
//   panel restyles it, the eyedropper matches it and the PDF draws it, none of
//   them knowing a rectangle was involved. There is no rectangle flag on the
//   record, so no reader has to learn one and ValeVision reads it unchanged.
// - WHILE IT IS BEING DRAWN IT IS NOT A RECORD. The preview is a dashed rubber
//   box on the handles layer, and nothing reaches the model until the second
//   corner lands. The Draw tool has to create its shape on the first click,
//   because a polyline is built up one vertex at a time; a rectangle is known
//   whole the moment its second corner is, so this tool does not. An abandoned
//   rectangle therefore leaves nothing behind, the browser draft never catches
//   a half-drawn one, and the box can never snap to its own corners.
// - The shape is created and announced in one call, so a rectangle is one undo
//   step. It is selected as it lands, so its grips show and the Vectors panel
//   edits it at once; the tool stays up for the next rectangle.
// - A second corner that would give no width or no height is not a corner: the
//   tool keeps waiting rather than writing a flat shape, so a double click or a
//   press that never moved cannot leave a sliver on the sheet.
// - Escape, Space, a right click, a second finger or another tool abandons the
//   rectangle being drawn.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and the keys and delegates
//   here: Press on a left press, Move on every move, Release when the button
//   comes up, Cancel with the other placing tools.
// - Na__LayoutEditor__Grips__ draws the rubber box, beside the rubber band the
//   Draw and Dimension tools stretch.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported to      : ValeVision3D 51__System__LayoutEditor, 13-Sep-2026 (ValeVision3D v2.25.0)
// - Parity         : verbatim (header only)
// - Divergences    : none - it writes an ordinary Sheet__Shapes record
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.0.0
// - Initial implementation: click and click, or press and drag; Shift keeps it
//   square; both corners snap; the result is a plain closed vector shape.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Snapping and the Box
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CreateShape, Na__LeModel__SetSelection } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrips__ShowBox, Na__LeGrips__HideBox } from './Na__LayoutEditor__Grips__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Rectangle Being Drawn
    // ------------------------------------------------------------
    let Na__LeRect__Draft = null;      // <-- { anchor : [x, y], defaults, press : { pointerId, x, y } or null, dragged }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Shortest Side a Rectangle May Have (paper millimetres at this zoom)
    // ------------------------------------------------------------
    // The select tool's drag threshold, scaled the way the select tool scales
    // it, so "that press moved" and "that rectangle has a size" are one
    // distance on screen whatever the zoom.
    // ------------------------------------------------------------
    function Na__LeRect__MinSideMm() {
        return Na__LeCfg__GetSelectionSetup().dragThresholdMm / Na__LeSurface__GetZoom();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Opposite Corner Lands: a Snap, Then Shift's Square
    // ------------------------------------------------------------
    // The snap supplies the corner. Shift then squares the rectangle on the
    // longer of its two sides, keeping the quarter the cursor is in, so a
    // snapped vertex still sets how far the square reaches. When squaring
    // pulls the corner off the point that snapped, the marker is taken away:
    // a marker left where the corner is not would say something untrue.
    // ------------------------------------------------------------
    function Na__LeRect__Corner(sheet, anchor, pointMm, shift) {
        const snap = Na__LeOsnap__Snap(sheet, pointMm);
        const at   = snap.snapped ? { x : snap.x, y : snap.y } : { x : pointMm.x, y : pointMm.y };
        if (!shift) return at;
        const dx   = at.x - anchor[0];
        const dy   = at.y - anchor[1];
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        const sq   = { x : anchor[0] + (dx < 0 ? -side : side), y : anchor[1] + (dy < 0 ? -side : side) };
        if (snap.snapped && Math.hypot(sq.x - at.x, sq.y - at.y) > 1e-6) Na__LeOsnap__HideMarker();   // <-- The square left the snapped point behind
        return sq;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Four Corners, Going Round From the First One
    // ------------------------------------------------------------
    // The corner pressed first stays vertex 0, so the rectangle's first grip
    // is where it was started. Which way round the rest go follows the drag;
    // the renderer, the PDF and the hit test are all indifferent to winding.
    // ------------------------------------------------------------
    function Na__LeRect__Corners(anchor, corner) {
        return [ [ anchor[0], anchor[1] ], [ corner.x, anchor[1] ], [ corner.x, corner.y ], [ anchor[0], corner.y ] ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Rectangle Being Drawn and Everything Shown for It
    // ------------------------------------------------------------
    function Na__LeRect__Clear() {
        Na__LeRect__Draft = null;
        Na__LeGrips__HideBox();
        Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Opposite Corner and Write the Shape
    // ------------------------------------------------------------
    // Returns false, and leaves the first corner waiting, when the corner
    // would give the rectangle no width or no height.
    // ------------------------------------------------------------
    function Na__LeRect__Land(sheet, pointMm, shift) {
        const draft = Na__LeRect__Draft;
        if (!draft || !sheet) return false;
        const corner = Na__LeRect__Corner(sheet, draft.anchor, pointMm, shift);
        const min    = Na__LeRect__MinSideMm();
        if (Math.abs(corner.x - draft.anchor[0]) < min || Math.abs(corner.y - draft.anchor[1]) < min) return false;   // <-- A flat rectangle is not a rectangle
        const d = draft.defaults;
        Na__LeRect__Clear();
        const item = Na__LeModel__CreateShape(sheet, Na__LeRect__Corners(draft.anchor, corner), {
            strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null, closed : true, stroked : d.stroked !== false
        });                                                                  // <-- Not silent: created and announced at once, so one undo step
        if (!item) return false;
        Na__LeModel__SetSelection({ kind : 'shape', id : item.Shape__Id });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | A Left Press With the Rectangle Tool
    // ------------------------------------------------------------
    // defaults: { strokeColour, strokePt, fillColour, filled, stroked } - the
    // Vectors panel's, the same object the Draw tool is handed.
    // The first press sets the first corner. A press while a first corner is
    // waiting lands the opposite one; when it cannot (it is on top of the
    // first) it is remembered as the first press was, so dragging away from
    // there still draws the rectangle.
    // ------------------------------------------------------------
    function Na__LeRect__Press(sheet, pointMm, shift, defaults, pointerId) {
        if (Na__LeRect__Draft && Na__LeRect__Land(sheet, pointMm, shift)) return true;
        const press = { pointerId : pointerId, x : pointMm.x, y : pointMm.y };
        if (Na__LeRect__Draft) { Na__LeRect__Draft.press = press; Na__LeRect__Draft.dragged = false; return true; }
        const snap   = Na__LeOsnap__Snap(sheet, pointMm);
        const anchor = snap.snapped ? [ snap.x, snap.y ] : [ pointMm.x, pointMm.y ];
        Na__LeRect__Draft = { anchor : anchor, defaults : defaults || {}, press : press, dragged : false };
        Na__LeGrips__ShowBox(anchor, anchor, false);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Rectangle Tool
    // ------------------------------------------------------------
    // pressed: whether the button or finger is down. A press that travels
    // past the drag threshold becomes a drag, which lands the corner on
    // release. A move with nothing down means the release happened where the
    // stage never heard it, so the press is forgotten and the rectangle
    // waits for a click instead.
    // ------------------------------------------------------------
    function Na__LeRect__Move(sheet, pointMm, shift, pressed) {
        const draft = Na__LeRect__Draft;
        if (!draft) { Na__LeOsnap__Snap(sheet, pointMm); return false; }    // <-- Marker before the first corner
        if (draft.press && !pressed) { draft.press = null; draft.dragged = false; }
        if (draft.press && !draft.dragged && Math.hypot(pointMm.x - draft.press.x, pointMm.y - draft.press.y) >= Na__LeRect__MinSideMm()) draft.dragged = true;
        const corner = Na__LeRect__Corner(sheet, draft.anchor, pointMm, shift);
        Na__LeGrips__ShowBox(draft.anchor, corner, shift);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Comes Up With the Rectangle Tool
    // ------------------------------------------------------------
    // A press that dragged lands the opposite corner where it lets go. A
    // press that stayed put leaves the first corner waiting for a click on
    // the second, which is the click-and-click way of drawing it.
    // ------------------------------------------------------------
    function Na__LeRect__Release(sheet, pointMm, shift, pointerId) {
        const draft = Na__LeRect__Draft;
        if (!draft || !draft.press || draft.press.pointerId !== pointerId) return false;
        const dragged = draft.dragged;
        draft.press   = null;
        draft.dragged = false;
        return dragged ? Na__LeRect__Land(sheet, pointMm, shift) : false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Rectangle Being Drawn
    // ------------------------------------------------------------
    // Nothing was written, so there is nothing to delete and nothing to undo.
    // ------------------------------------------------------------
    function Na__LeRect__Cancel() {
        const had = !!Na__LeRect__Draft;
        Na__LeRect__Clear();
        return had;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Rectangle Being Drawn
    // ------------------------------------------------------------
    function Na__LeRect__IsDrawing() { return !!Na__LeRect__Draft; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Rectangle Tool API
    // ------------------------------------------------------------
    export {
        Na__LeRect__Press,
        Na__LeRect__Move,
        Na__LeRect__Release,
        Na__LeRect__Cancel,
        Na__LeRect__IsDrawing
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
