// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - LABEL GRIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__LabelGrip__.js
// NAMESPACE  : Na__LeAreaGrip
// MODULE     : Layout Editor - Floor Areas - Label Grip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drag a room's name and figure to where they read best, in the room's edit mode, and keep them there
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Adam, 21-Sep-2026: "when you're in the edit mode for them, you can click
//   to drag the text box ... If you need to nudge it for awkward-shaped
//   rooms, etc., you should just be able to grab it and move it, and then it
//   should save that position."
// - THE WORDS ARE PART OF THE ROOM'S INSIDES, like its corners. Open the room
//   (double-click it, or Enter) and a dashed box stands round its label,
//   arriving with the corner grips; a press inside the box drags the label.
//   Outside edit mode a press on the label is a press on the room, as it
//   always was: it selects the room, and the Move tool moves the room and
//   its label together.
// - WHAT IS STORED IS HOW FAR IT WAS MOVED, NOT WHERE IT WENT:
//   Area__LabelDXMm / Area__LabelDYMm, paper millimetres from the label's
//   home (the middle of the room's box - Na__LeArea__Measure). So the label
//   goes with the room when the room is moved, and follows a corner that is
//   dragged later. Dragged back to within Label__HomeSnapPx of home, on
//   screen, it snaps there and the record's normaliser drops both keys - the
//   same thing Centre its label does from the menu and the panel.
// - A CORNER BEATS THE WORDS. The vertex grips take no presses of their own
//   (the sheet tools find them by position), so a press inside this box that
//   is within reach of a corner is passed straight on to the sheet tools, as
//   are an Alt press (a box inside the room) and a Shift press on an edge
//   (insert a corner there). Only Select and Move drag the label; any other
//   tool has its press as if the box were not there.
// - SHIFT, OR ORTHO (F8), HOLDS THE AXIS - Ortho XOR Shift
//   (Na__LeOrtho__Resolve), the rule every other drag keeps.
// - THE BOX TAKES ITS OWN PRESSES, the way a picture's corner grips and the
//   parametric grips do: the drag runs on window listeners until the button
//   comes up, and the sheet tools never hear it. One undo step per drag;
//   Escape, or a cancelled pointer, puts the label back where it was.
//
// INTEGRATION:
// - Na__LeAreaGrip__Attach registers the box with
//   Na__LeGrips__RegisterShapeProvider; the Floor Areas panel's registration
//   calls it once. The provider answers false, so the room's vertex grips
//   are still drawn - after the box, and so on top of it.
// - The box is Na__LeAreaPaint__LabelBox, the painter's own measure of the
//   words, so it stands exactly where they are painted and follows them
//   through every repaint of the drag.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Grips, Scope, Tools, Ortho and the Feature
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheetById, Na__LeModel__GetShapeById, Na__LeModel__IsLayerLocked } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__Refresh, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGrips__RegisterShapeProvider } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeScope__GetVectorId } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';
    import { Na__LeMenu__Close } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE, Na__LeTools__GetTool } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeTools__Suppressed } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tolerance, Na__LeTools__ShapeGrabFor, Na__LeTools__ShapeInsertHit } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__HitResolution__.js';   // <-- The sheet tools' own answer to "is this press on a corner", so the two can never disagree
    import { Na__LeOrtho__Resolve } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js';
    import { Na__LeArea__Is, Na__LeArea__Value, Na__LeArea__Label, Na__LeArea__LabelOffsetOf, Na__LeArea__Patch } from './Na__LayoutEditor__FloorAreas__.js';
    import { Na__LeAreaPaint__LabelBox } from './Na__LayoutEditor__FloorAreas__Paint__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes
    // ------------------------------------------------------------
    const Na__LeAreaGrip__CLASS      = 'na-le-grip na-le-grip--area-label';   // <-- na-le-grip, so whatever clears the grips clears this too
    const Na__LeAreaGrip__HELD_CLASS = 'is-dragging';
    const Na__LeAreaGrip__BODY_CLASS = 'na-le-area-label-dragging';           // <-- The whole page wears the move cursor while the label is held
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag in Flight, and the Last Press
    // ------------------------------------------------------------
    let Na__LeAreaGrip__Drag       = null;     // <-- { pointerId, sheetId, shapeId, startMm, from : { dx, dy }, at : { dx, dy }, moved }
    let Na__LeAreaGrip__Took       = false;    // <-- Whether the last press on a box was the box's own: its double click is kept from the sheet tools too
    let Na__LeAreaGrip__Registered = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Shape Grip Provider: a Dashed Box Round an Open Room's Label
    // ------------------------------------------------------------
    // Nothing unless THIS room is the one open for editing, on an unlocked
    // layer, with a label showing. Answers false every time, so the vertex
    // grips are drawn after it as they always were.
    // ------------------------------------------------------------
    function Na__LeAreaGrip__Render(layer, sheet, selection, ppm, zoom, sizePx, shape) {
        if (!Na__LeArea__Is(shape) || Na__LeScope__GetVectorId() !== shape.Shape__Id) return false;   // <-- Only inside the room's edit mode
        if (Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return false;                       // <-- A locked room shows no grips at all
        const box = Na__LeAreaPaint__LabelBox(sheet, shape);
        if (!box) return false;                                                                         // <-- Its label switched off, or an outline that encloses nothing
        const screen = Math.max(1e-6, ppm * zoom);
        const padMm  = Math.max(0, Na__LeArea__Value('Label', 'Label__GripPaddingPx', 4)) / screen;   // <-- A fixed margin on screen, so a small label is still easy to take hold of
        const held   = !!Na__LeAreaGrip__Drag && Na__LeAreaGrip__Drag.shapeId === shape.Shape__Id;
        const grip   = document.createElement('div');
        grip.className    = Na__LeAreaGrip__CLASS + (held ? ' ' + Na__LeAreaGrip__HELD_CLASS : '');
        grip.style.left   = ((box.X - padMm) * ppm) + 'px';
        grip.style.top    = ((box.Y - padMm) * ppm) + 'px';
        grip.style.width  = ((box.WidthMm  + (padMm * 2)) * ppm) + 'px';
        grip.style.height = ((box.HeightMm + (padMm * 2)) * ppm) + 'px';
        grip.style.borderWidth = (1 / (zoom > 0 ? zoom : 1)) + 'px';             // <-- One screen pixel inside the paper's scale
        grip.title = Na__LeArea__Label('LabelGripTitle', 'Drag to move the label. Drag it back to the middle, or press Centre the label, to put it back.');
        grip.setAttribute('data-na-area-label', shape.Shape__Id);
        grip.addEventListener('pointerdown', (event) => Na__LeAreaGrip__OnDown(event, sheet, shape.Shape__Id));
        grip.addEventListener('dblclick', (event) => { if (Na__LeAreaGrip__Took) event.stopPropagation(); });
        layer.appendChild(grip);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drag
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Press on the Box: the Label's, or Passed On
    // ------------------------------------------------------------
    // PASSED ON means returned from untouched, so the press carries on to the
    // stage and the sheet tools treat it exactly as they would have with no
    // box there: a corner is dragged, an edge takes a new corner, Alt draws a
    // box, and a right press opens the open room's menu (its points' menu -
    // Centre its label is on the room's own menu, outside edit mode, and on
    // the panel).
    // ------------------------------------------------------------
    function Na__LeAreaGrip__OnDown(event, drawnOn, shapeId) {
        Na__LeAreaGrip__Took = false;
        if (event.button !== 0 || Na__LeAreaGrip__Drag || Na__LeTools__Suppressed) return;   // <-- A right or middle press, a drag already held, or a pan that owns the pointer
        const tool = Na__LeTools__GetTool();
        if (tool !== Na__LeTools__TOOL_SELECT && tool !== Na__LeTools__TOOL_MOVE) return;     // <-- Any other tool's press, as if the box were not there
        if (event.altKey) return;                                                              // <-- Alt draws a box inside the room from anywhere
        const sheet = Na__LeModel__GetSheetById(drawnOn.Sheet__Id) || drawnOn;                 // <-- The sheet as it is now, not as it was when the box was drawn
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!shape || !point) return;
        if (Na__LeTools__ShapeGrabFor(shape, point, Na__LeTools__Tolerance()).mode === 'vertex') return;   // <-- A corner beats the words
        if (event.shiftKey && Na__LeTools__ShapeInsertHit(sheet, shape, point)) return;                   // <-- Shift on an edge adds a corner there
        event.preventDefault();
        event.stopPropagation();                                                 // <-- The label's press, not the sheet tools'
        Na__LeAreaGrip__Took = true;
        Na__LeAreaGrip__Begin(event, sheet, shape, point);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Begin: Remember Where the Label Was, Listen on the Window
    // ------------------------------------------------------------
    function Na__LeAreaGrip__Begin(event, sheet, shape, point) {
        Na__LeMenu__Close();
        const from = Na__LeArea__LabelOffsetOf(shape);
        Na__LeAreaGrip__Drag = {
            pointerId : event.pointerId,
            sheetId   : sheet.Sheet__Id,
            shapeId   : shape.Shape__Id,
            startMm   : { x : point.x, y : point.y },
            from      : { dx : from.dx, dy : from.dy },
            at        : { dx : from.dx, dy : from.dy },
            moved     : false
        };
        document.body.classList.add(Na__LeAreaGrip__BODY_CLASS);
        window.addEventListener('pointermove',   Na__LeAreaGrip__OnMove, true);
        window.addEventListener('pointerup',     Na__LeAreaGrip__OnUp, true);
        window.addEventListener('pointercancel', Na__LeAreaGrip__OnCancel, true);
        window.addEventListener('keydown',       Na__LeAreaGrip__OnKey, true);
        Na__LeSurface__Refresh('selection');                                     // <-- The box reads as held straight away
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: the Label Follows the Pointer, Written Silently
    // ------------------------------------------------------------
    // A press that has not yet travelled the drag threshold is still a click,
    // and moves nothing. Past it, the offset is the one the press began with
    // plus how far the pointer has gone - held to the nearer axis by Shift or
    // Ortho - and within Label__HomeSnapPx of home it is home.
    // ------------------------------------------------------------
    function Na__LeAreaGrip__OnMove(event) {
        const drag = Na__LeAreaGrip__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        const zoom = Na__LeSurface__GetZoom() > 0 ? Na__LeSurface__GetZoom() : 1;
        let d = { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y };
        if (!drag.moved) {
            if (Math.hypot(d.x, d.y) < Na__LeCfg__GetSelectionSetup().dragThresholdMm / zoom) return;
            drag.moved = true;
        }
        if (Na__LeOrtho__Resolve(event.shiftKey)) d = (Math.abs(d.x) >= Math.abs(d.y)) ? { x : d.x, y : 0 } : { x : 0, y : d.y };
        let dx = drag.from.dx + d.x;
        let dy = drag.from.dy + d.y;
        const homeMm = Math.max(0, Na__LeArea__Value('Label', 'Label__HomeSnapPx', 8)) / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * zoom);
        if (Math.hypot(dx, dy) <= homeMm) { dx = 0; dy = 0; }                   // <-- Home again: the normaliser drops both keys
        drag.at = { dx : dx, dy : dy };
        Na__LeArea__Patch(sheet, drag.shapeId, { Area__LabelDXMm : dx, Area__LabelDYMm : dy }, true);   // <-- Silent: the whole drag is one step, announced on release
        Na__LeSurface__Refresh('markup');                                        // <-- The words, the focus copy of the room and this box all follow
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End: One Undo Step, or the Label Put Back
    // ------------------------------------------------------------
    // keep is false for Escape and for a cancelled pointer. A click that
    // never travelled, and a drag that ended where it began, leave no step.
    // ------------------------------------------------------------
    function Na__LeAreaGrip__End(keep) {
        const drag = Na__LeAreaGrip__Drag;
        if (!drag) return;
        Na__LeAreaGrip__Drag = null;
        window.removeEventListener('pointermove',   Na__LeAreaGrip__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeAreaGrip__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeAreaGrip__OnCancel, true);
        window.removeEventListener('keydown',       Na__LeAreaGrip__OnKey, true);
        document.body.classList.remove(Na__LeAreaGrip__BODY_CLASS);
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        if (!sheet || !drag.moved) { Na__LeSurface__Refresh('selection'); return; }
        const changed = Math.hypot(drag.at.dx - drag.from.dx, drag.at.dy - drag.from.dy) > 1e-9;
        if (keep && changed) {
            Na__LeArea__Patch(sheet, drag.shapeId, { Area__LabelDXMm : drag.at.dx, Area__LabelDYMm : drag.at.dy }, false);   // <-- Announced once: the drag is one undo step, and the sheet saves it
            return;
        }
        Na__LeArea__Patch(sheet, drag.shapeId, { Area__LabelDXMm : drag.from.dx, Area__LabelDYMm : drag.from.dy }, true);
        Na__LeSurface__Refresh('markup');
    }
    function Na__LeAreaGrip__OnUp(event) {
        if (!Na__LeAreaGrip__Drag || event.pointerId !== Na__LeAreaGrip__Drag.pointerId) return;
        event.stopPropagation();
        Na__LeAreaGrip__End(true);
    }
    function Na__LeAreaGrip__OnCancel(event) {
        if (Na__LeAreaGrip__Drag && event.pointerId === Na__LeAreaGrip__Drag.pointerId) Na__LeAreaGrip__End(false);
    }
    function Na__LeAreaGrip__OnKey(event) {
        if (!Na__LeAreaGrip__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                                 // <-- The drag's Escape: it must not close the room as well
        Na__LeAreaGrip__End(false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Label Grip With the Grips Module (once)
    // ------------------------------------------------------------
    function Na__LeAreaGrip__Attach() {
        if (Na__LeAreaGrip__Registered) return true;
        Na__LeAreaGrip__Registered = Na__LeGrips__RegisterShapeProvider(Na__LeAreaGrip__Render);
        return Na__LeAreaGrip__Registered;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Label Being Dragged
    // ------------------------------------------------------------
    function Na__LeAreaGrip__IsDragging() { return !!Na__LeAreaGrip__Drag; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Label Grip API
    // ------------------------------------------------------------
    export {
        Na__LeAreaGrip__Attach,
        Na__LeAreaGrip__IsDragging
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
