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
// - TYPED SIZES. With the first corner down, a width and height typed into
//   the Measurements box land the opposite corner that far away, towards the
//   side of the first corner the cursor is on (a negative size goes the other
//   way; a side left out keeps what the cursor gives). As in SketchUp, typing
//   a size straight after a rectangle lands resizes that rectangle instead,
//   for as long as it is still selected and nothing has moved its corners -
//   its own undo step. Sizes arrive in paper millimetres:
//   Na__LayoutEditor__Measurements__ has already taken the drawing scale off.
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
// - Na__LayoutEditor__Measurements__ reads the box (Measure) and lands or
//   resizes a rectangle from typed sizes (TypeSize).
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
// 14-Sep-2026 - Version 1.1.0
// - Typed sizes: the box's opposite corner is kept, Measure reports the box
//   (or the rectangle that has just landed), and TypeSize lands a rectangle
//   from a typed width and height - or resizes the one that just landed, while
//   it is selected and untouched. Land and TypeSize write the shape the same way.
//
// 14-Sep-2026 - Version 1.0.2
// - A rectangle takes the Vectors panel's fill and edge opacity defaults, as a
//   drawn shape does.
//
// 13-Sep-2026 - Version 1.0.1
// - A rectangle takes the Vectors panel's gradient default as well as its fill,
//   exactly as a drawn shape does (Na__LayoutEditor__GradientTool__). Without it
//   a rectangle drawn with Gradient switched on came out with no fill at all.
//   Found while porting the gradient to ValeVision.
//
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
    import { Na__LeModel__CreateShape, Na__LeModel__UpdateShape, Na__LeModel__SetSelection, Na__LeModel__GetSelection } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrips__ShowBox, Na__LeGrips__HideBox } from './Na__LayoutEditor__Grips__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typed Sizes
    // ------------------------------------------------------------
    const Na__LeRect__TYPED_MIN_MM = 1e-4;         // <-- A typed side shorter than this (paper mm) is no side at all
    const Na__LeRect__SAME_MM      = 1e-9;         // <-- Corners this close still count as untouched
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Rectangle Being Drawn, and the One That Just Landed
    // ------------------------------------------------------------
    let Na__LeRect__Draft  = null;     // <-- { anchor : [x, y], defaults, press : { pointerId, x, y } or null, dragged, corner : { x, y } }
    let Na__LeRect__Landed = null;     // <-- { id, anchor : [x, y], points : [[x, y] x 4] } until another rectangle starts or the tool is put down
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


    // HELPER FUNCTION | Write the Finished Rectangle, Select It and Remember It
    // ------------------------------------------------------------
    // Clicked, dragged or typed, a rectangle is written here. It is remembered
    // so a size typed straight afterwards can resize it.
    // ------------------------------------------------------------
    function Na__LeRect__Write(sheet, points, defaults) {
        const d    = defaults || {};
        const item = Na__LeModel__CreateShape(sheet, points, {
            strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null,
            fillOpacity : d.fillOpacity, strokeOpacity : d.strokeOpacity,     // <-- The opacity defaults too, as for a drawn shape
            gradient : d.gradientOn ? d.gradient : null, closed : true, stroked : d.stroked !== false   // <-- The gradient default reaches a rectangle exactly as it reaches a drawn shape
        });                                                                  // <-- Not silent: created and announced at once, so one undo step
        if (!item) return null;
        Na__LeRect__Landed = { id : item.Shape__Id, anchor : [ points[0][0], points[0][1] ], points : points.map((p) => [ p[0], p[1] ]) };
        Na__LeModel__SetSelection({ kind : 'shape', id : item.Shape__Id });
        return item;
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
        return !!Na__LeRect__Write(sheet, Na__LeRect__Corners(draft.anchor, corner), d);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rectangle That Just Landed, While a Typed Size May Still Resize It
    // ------------------------------------------------------------
    // Only while nothing is being drawn, the shape is still selected on its own,
    // and its four corners are exactly where they landed. A restyle leaves it
    // resizable; a grip drag, a move or a nudge does not.
    // ------------------------------------------------------------
    function Na__LeRect__Retypable(sheet) {
        const landed = Na__LeRect__Landed;
        if (!landed || !sheet || Na__LeRect__Draft) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape' || selection.id !== landed.id) return null;
        const shape = (sheet.Sheet__Shapes || []).find((s) => s.Shape__Id === landed.id);
        if (!shape || shape.Shape__Closed !== true || !Array.isArray(shape.Shape__Points) || shape.Shape__Points.length !== 4) return null;
        const untouched = shape.Shape__Points.every((p, i) => Math.abs(p[0] - landed.points[i][0]) <= Na__LeRect__SAME_MM && Math.abs(p[1] - landed.points[i][1]) <= Na__LeRect__SAME_MM);
        return untouched ? landed : null;
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
        Na__LeRect__Landed = null;                                           // <-- A new rectangle: the last one can no longer be retyped
        Na__LeRect__Draft  = { anchor : anchor, defaults : defaults || {}, press : press, dragged : false, corner : { x : anchor[0], y : anchor[1] } };
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
        draft.corner = corner;                                               // <-- Which side of the first corner a typed size goes
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
    // Putting the tool down also ends the chance to retype the last one.
    // ------------------------------------------------------------
    function Na__LeRect__Cancel() {
        const had = !!Na__LeRect__Draft;
        Na__LeRect__Clear();
        Na__LeRect__Landed = null;
        return had;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Rectangle Being Drawn
    // ------------------------------------------------------------
    function Na__LeRect__IsDrawing() { return !!Na__LeRect__Draft; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typed Sizes
// -----------------------------------------------------------------------------

    // FUNCTION | The Box Being Drawn, or the Rectangle That Just Landed
    // ------------------------------------------------------------
    // Returns { anchor : { x, y }, corner : { x, y }, landed } in paper
    // millimetres - landed is true for a rectangle a typed size would resize -
    // or null when there is neither.
    // ------------------------------------------------------------
    function Na__LeRect__Measure(sheet) {
        const draft = Na__LeRect__Draft;
        if (draft) return { anchor : { x : draft.anchor[0], y : draft.anchor[1] }, corner : { x : draft.corner.x, y : draft.corner.y }, landed : false };
        const landed = Na__LeRect__Retypable(sheet);
        if (landed) return { anchor : { x : landed.anchor[0], y : landed.anchor[1] }, corner : { x : landed.points[2][0], y : landed.points[2][1] }, landed : true };
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Land a Rectangle From a Typed Width and Height, or Resize the Last
    // ------------------------------------------------------------
    // widthMm and heightMm are PAPER millimetres, or null to keep what the
    // cursor gives (for a resize, what the rectangle has). Each runs towards
    // the side of the first corner the box is on, and a negative one the other
    // way. Returns { ok : true, resized } or { ok : false, reason } - 'none'
    // with nothing to size, 'flat' for no width or no height.
    // ------------------------------------------------------------
    function Na__LeRect__TypeSize(sheet, widthMm, heightMm) {
        if (!sheet) return { ok : false, reason : 'none' };
        const draft  = Na__LeRect__Draft;
        const landed = draft ? null : Na__LeRect__Retypable(sheet);
        if (!draft && !landed) return { ok : false, reason : 'none' };
        const anchor = draft ? draft.anchor : landed.anchor;
        const corner = draft ? draft.corner : { x : landed.points[2][0], y : landed.points[2][1] };
        const sx = (corner.x - anchor[0]) < 0 ? -1 : 1;                      // <-- Towards the cursor's side; straight away from the corner, right and down
        const sy = (corner.y - anchor[1]) < 0 ? -1 : 1;
        const x  = Number.isFinite(widthMm)  ? anchor[0] + (sx * widthMm)  : corner.x;
        const y  = Number.isFinite(heightMm) ? anchor[1] + (sy * heightMm) : corner.y;
        if (Math.abs(x - anchor[0]) < Na__LeRect__TYPED_MIN_MM || Math.abs(y - anchor[1]) < Na__LeRect__TYPED_MIN_MM) return { ok : false, reason : 'flat' };
        const points = Na__LeRect__Corners(anchor, { x : x, y : y });
        if (landed) {
            Na__LeModel__UpdateShape(sheet, landed.id, { points : points });        // <-- Announced: the resize is an undo step of its own
            Na__LeRect__Landed = { id : landed.id, anchor : [ anchor[0], anchor[1] ], points : points.map((p) => [ p[0], p[1] ]) };
            return { ok : true, resized : true };
        }
        const d = draft.defaults;
        Na__LeRect__Clear();
        return Na__LeRect__Write(sheet, points, d) ? { ok : true, resized : false } : { ok : false, reason : 'none' };
    }
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
        Na__LeRect__IsDrawing,
        Na__LeRect__Measure,
        Na__LeRect__TypeSize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
