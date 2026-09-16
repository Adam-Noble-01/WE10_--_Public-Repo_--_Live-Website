// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - POINTER PRESS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__PointerPress__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Pointer Press
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a press on the stage does (place, pick a style, toggle a door, start a box, change the selection, start a drag), and the double click
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - OnDown: a right press is only remembered, so the context menu can tell a
//   click from a pan, and while a navigation gesture owns the pointer a press
//   does nothing. A left press drops a half-typed Measurements value and
//   commits text being typed.
// - With a placing tool up the press is that tool's: Text places, Dimension
//   and Draw take a point, Rectangle and Leader take a point and capture the
//   pointer so their release still reaches the sheet tools, and the
//   eyedropper picks or paints (or loads the palette) without ever selecting.
// - Otherwise the press resolves what is under it, and a press anywhere else
//   finishes content editing. A door in the selected plan viewport (DoorAt,
//   read before the press changes the selection) closes or opens on a click
//   (Na__LayoutEditor__PlanDoors__); on a locked plan the press is a door
//   press alone, whose drag does nothing. Where nothing can move it starts a
//   selection box (StartsBox); a Shift-click on an edge of the one selected
//   vector inserts a vertex and drags it; otherwise the selection modifiers
//   apply (PressSelection) and the drag for what was pressed begins
//   (DragFor, which carries a viewport by a point of its linework where
//   CarryTarget allows, through Na__LayoutEditor__ViewportSnapMove__), or a
//   group drag for several selected items. A change that waits for a click
//   runs on the release, only if the pointer never moved.
// - OnDoubleClick: drops a door toggle still waiting, then finishes a
//   polyline being drawn, edits the text, the dimension value or the leader
//   text under the pointer, or enters or leaves a viewport's content.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ listens on the stage with OnDown and
//   OnDoubleClick.
// - The drag it starts is written to Na__LayoutEditor__SheetTools__State__
//   and carried on by Na__LayoutEditor__SheetTools__PointerDrag__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : The door press (Na__LayoutEditor__PlanDoors__) and the carry by a point in DragFor are TrueVision's own.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Grips, Tools, Plan Doors, Viewport Snap Move, Selection, Menu
    // ------------------------------------------------------------
    import { Na__LeCfg__MatchSelectionModifier, Na__LeCfg__GetGuards } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateShape,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__Refresh,
        Na__LeSurface__GetEditingViewport,
        Na__LeSurface__SetEditingViewport
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeHandles__CaptureStart } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__HitTest } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab, Na__LeGrips__LeaderGrab, Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__InsertPoint } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__Place, Na__LeText__BeginEdit, Na__LeText__Commit, Na__LeText__IsEditing, Na__LeText__RotateStart } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Click, Na__LeDim__BeginTextEdit } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Click, Na__LeShape__Finish, Na__LeShape__IsDrawing } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Press } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeMeasure__Refresh, Na__LeMeasure__Clear } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Press, Na__LeLeader__IsPlacing, Na__LeLeader__BeginEdit } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Click, Na__LeDrop__Hover, Na__LeDrop__MODE_PALETTE, Na__LeDrop__GetMode } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeDoors__ToggleSoon, Na__LeDoors__CancelPending } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeVpMove__GrabAt } from '../20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeSelBox__COMBINE_ADD, Na__LeSelBox__COMBINE_REMOVE, Na__LeSelBox__Press, Na__LeSelBox__Combine } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeSelSet__Capture } from './Na__LayoutEditor__SelectionSet__.js';
    import { Na__LeMenu__Close } from './Na__LayoutEditor__ContextMenu__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Suppressed,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteRightPress
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import {
        Na__LeTools__Tool,
        Na__LeTools__GetTextDefaults,
        Na__LeTools__GetDimensionDefaults,
        Na__LeTools__GetShapeDefaults,
        Na__LeTools__GetLeaderDefaults,
        Na__LeTools__SyncPaletteFrom
    } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import {
        Na__LeTools__Tolerance,
        Na__LeTools__ShapeGrabPoint,
        Na__LeTools__ShapeInsertHit,
        Na__LeTools__Resolve,
        Na__LeTools__Record,
        Na__LeTools__IsViewportLocked,
        Na__LeTools__DoorAt,
        Na__LeTools__CarryTarget
    } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    import { Na__LeTools__SetEditingViewport } from './Na__LayoutEditor__SheetTools__ContentEditing__.js';
    import { Na__LeTools__IsViewportMoveDrag } from './Na__LayoutEditor__SheetTools__PointerDrag__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Press and the Double Click
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Event a Left Press on the Paper Area
    // ------------------------------------------------------------
    function Na__LeTools__IsLeft(event) { return event.button === 0 || (event.pointerType === 'touch'); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Drag a Press on a Resolved Item Starts (null when it cannot move)
    // ------------------------------------------------------------
    function Na__LeTools__DragFor(sheet, found, pointMm) {
        const record = Na__LeTools__Record(sheet, found);
        if (!record) return null;
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return null;
            if (found.hit && found.hit.mode === 'rotate') return { kind : 'annotation', id : found.id, mode : 'rotate', rotate : Na__LeText__RotateStart(record, pointMm) };   // <-- The rotate grip turns it
            return { kind : 'annotation', id : found.id, start : { x : record.Annotation__PosXMm, y : record.Annotation__PosYMm } };
        }
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return null;
            return { kind : 'dimension', id : found.id, mode : Na__LeGrips__DimensionGrab(record, pointMm, tol, sheet),
                     start : { sx : record.Dimension__StartXMm, sy : record.Dimension__StartYMm, ex : record.Dimension__EndXMm, ey : record.Dimension__EndYMm,
                               offset : record.Dimension__OffsetMm, tdx : record.Dimension__TextDXMm || 0, tdy : record.Dimension__TextDYMm || 0 } };
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return null;
            const grab = Na__LeGrips__ShapeGrab(record, pointMm, tol);
            const drag = { kind : 'shape', id : found.id, mode : grab.mode, index : grab.index, start : Na__LeShapeGeo__Points(record).map((p) => [ p[0], p[1] ]) };
            if (grab.mode === 'whole') drag.baseMm = Na__LeTools__ShapeGrabPoint(record, pointMm);
            return drag;
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return null;
            return { kind : 'leader', id : found.id, mode : Na__LeGrips__LeaderGrab(record, pointMm, tol),
                     start : { tx : record.Leader__TipXMm, ty : record.Leader__TipYMm, ax : record.Leader__AnchorXMm, ay : record.Leader__AnchorYMm } };
        }
        // VIEWPORT | A drag moves it, a handle crops it, and while its content
        // is being edited (double-click) a drag inside moves the drawing instead.
        if (Na__LeTools__IsViewportLocked(sheet, record)) return null;
        const editing = Na__LeSurface__GetEditingViewport() === found.id;
        const hit     = editing ? { mode : 'body' } : ((found.hit && found.hit.mode === 'handle') ? found.hit : { mode : 'border' });
        // A press on a point of its own linework carries the viewport by that
        // point (Na__LayoutEditor__ViewportSnapMove__); anywhere else moves the
        // frame the plain way.
        const carry   = Na__LeTools__CarryTarget(sheet, found);
        const grab    = carry ? Na__LeVpMove__GrabAt(sheet, carry, pointMm) : null;
        return { kind : 'viewport', id : found.id, hit : hit, start : Na__LeHandles__CaptureStart(record), baseMm : grab ? { x : grab.x, y : grab.y } : null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Select Press Start a Selection Box
    // ------------------------------------------------------------
    // It does where there is nothing to move: bare paper or the grey stage, a
    // locked viewport, anything at all in a read-only session - or anywhere
    // with the box modifier (Alt) held. A touch that lands off the paper is the
    // one-finger pan's, so a box never fights the pan for the finger.
    // ------------------------------------------------------------
    function Na__LeTools__StartsBox(sheet, found, intent, event) {
        const target = event.target;
        if (event.pointerType === 'touch' && !(target && target.closest && target.closest(Na__LeCfg__GetGuards().paperSelector))) return false;
        if (!found || intent.anywhere || !Na__LeTools__Editable) return true;
        return found.kind === 'viewport' && Na__LeTools__IsViewportLocked(sheet, Na__LeModel__GetViewportById(sheet, found.id));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Select Press on an Item Does to the Selection
    // ------------------------------------------------------------
    // What adds happens at the press, so a drag straight after carries the new
    // member. What removes or narrows waits for the button to come up without
    // a move, so a drag can carry the whole selection first; that change comes
    // back as a function for the release to run, or null.
    //   no modifier    an unselected item replaces the selection; one of several
    //                  selected keeps them all, and a click narrows to it
    //   Ctrl           an unselected item joins
    //   Shift          an unselected item joins; a selected one leaves on a click
    //   Ctrl+Shift     a selected item leaves on a click
    // ------------------------------------------------------------
    function Na__LeTools__PressSelection(pressed, combine) {
        const member = Na__LeModel__IsSelected(pressed.kind, pressed.id);
        if (!combine) {
            if (!member) { Na__LeModel__SetSelection(pressed); return null; }
            return Na__LeModel__GetSelectionItems().length > 1 ? () => Na__LeModel__SetSelection(pressed) : null;
        }
        if (!member) {
            if (combine !== Na__LeSelBox__COMBINE_REMOVE) Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), [ pressed ], Na__LeSelBox__COMBINE_ADD));
            return null;
        }
        if (combine === Na__LeSelBox__COMBINE_ADD) return null;
        return () => Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), [ pressed ], Na__LeSelBox__COMBINE_REMOVE));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Down
    // ------------------------------------------------------------
    function Na__LeTools__OnDown(event) {
        Na__LeMenu__Close();
        if (event.button === 2) { Na__LeTools__WriteRightPress({ x : event.clientX, y : event.clientY }); return; }   // <-- Remembered so a right click that did not pan opens the menu
        if (Na__LeTools__Suppressed) return;                                 // <-- A pan or a pinch owns this pointer
        if (!Na__LeTools__IsLeft(event)) return;
        Na__LeMeasure__Clear();                                              // <-- A press on the sheet drops a half-typed value, as in SketchUp
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        const wasEditing = Na__LeText__IsEditing();
        if (wasEditing) Na__LeText__Commit();

        if (Na__LeTools__Editable) {
            if (Na__LeTools__Tool === Na__LeTools__TOOL_TEXT)      { Na__LeText__Place(sheet, point, Na__LeTools__GetTextDefaults()); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Click(sheet, point, event.shiftKey, Na__LeTools__GetDimensionDefaults()); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Click(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults()); Na__LeMeasure__Refresh(); return; }

            // RECTANGLE | The press sets or lands a corner. The pointer is
            // captured so a rectangle dragged out past the edge of the stage
            // still delivers its release here, where it lands the far corner.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_RECT) {
                Na__LeRect__Press(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults(), event.pointerId);
                Na__LeMeasure__Refresh();
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

            // LEADER | The first press marks the point, a second lands the head;
            // or drag from one to the other, which is why the release is handed
            // on too. A press that only finishes typing into a leader's text is
            // spent on that, rather than starting the next leader.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_LEADER) {
                if (wasEditing && !Na__LeLeader__IsPlacing()) return;
                Na__LeLeader__Press(sheet, point, Na__LeTools__GetLeaderDefaults(), event.pointerId);
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

            // EYEDROPPER | Pick the style, then paint it, without ever selecting
            // or dragging. Selection is left untouched on purpose: the dropper's
            // own boxes say what it is holding and what it is over, and moving
            // the selection under a run of style clicks would keep swapping the
            // right-hand panel out from under the user.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP) {
                event.preventDefault();
                const picked = Na__LeTools__Resolve(sheet, point, true, true, true);   // <-- Locked markup is still a source; a locked viewport is not even there; grouped members keep their own style
                if (Na__LeDrop__GetMode() === Na__LeDrop__MODE_PALETTE) Na__LeTools__SyncPaletteFrom(sheet, picked);
                else Na__LeDrop__Click(sheet, picked, !!event.altKey);
                if (Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP) Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, picked);   // <-- Unless a palette sync has already handed over to a drawing tool
                return;
            }
        }

        const found     = Na__LeTools__Resolve(sheet, point);
        const editingId = Na__LeSurface__GetEditingViewport();
        if (editingId && (!found || found.kind !== 'viewport' || found.id !== editingId)) Na__LeSurface__SetEditingViewport(null);   // <-- A press anywhere else finishes content editing
        const intent  = Na__LeCfg__MatchSelectionModifier({ Ctrl : !!event.ctrlKey, Shift : !!event.shiftKey, Alt : !!event.altKey, Meta : !!event.metaKey });
        const pressed = found ? { kind : found.kind, id : found.id } : null;
        const door    = intent.combine ? null : Na__LeTools__DoorAt(sheet, found, point);   // <-- Read before the press changes the selection: only a plan already selected answers

        // A DOOR ON A LOCKED PLAN | The lock holds the frame, not what it draws,
        // so the press is a door press rather than the start of a box: the click
        // closes or opens the door, and a drag does nothing at all.
        // ------------------------------------
        if (door && !intent.anywhere && Na__LeTools__IsViewportLocked(sheet, Na__LeModel__GetViewportById(sheet, found.id))) {
            const viewportId = found.id;
            Na__LeTools__WriteDrag({ kind : 'door', id : viewportId, startMm : point, moved : false, pointerId : event.pointerId, click : () => Na__LeDoors__ToggleSoon(sheet, viewportId, door) });
            try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
            event.preventDefault();
            return;
        }

        // BOX | Nothing here can move, or Alt asks for a box regardless. A plain
        // press on bare paper still clears the selection at once; what a box
        // takes - or, for a click that never became one, the item it landed
        // on - goes into the selection when the button comes up (BoxUp).
        // ------------------------------------
        if (Na__LeTools__StartsBox(sheet, found, intent, event)) {
            if (!found && !intent.combine) Na__LeModel__SetSelection(null);
            Na__LeSelBox__Press(point, event.clientX, event.clientY, event.pointerId, { combine : intent.combine, pending : pressed });
            try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
            event.preventDefault();
            return;
        }
        if (!found) { if (!intent.combine) Na__LeModel__SetSelection(null); return; }

        // SHIFT-CLICK AN EDGE | Insert a vertex on the selected vector, then
        // the same press can drag it. Shift on a vertex or the fill still
        // toggles the selection, as it always did.
        // ------------------------------------
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_SELECT && event.shiftKey && !event.ctrlKey && !event.altKey && found.kind === 'shape') {
            const items = Na__LeModel__GetSelectionItems();
            const shape = (items.length === 1 && items[0].kind === 'shape' && items[0].id === found.id) ? Na__LeTools__Record(sheet, found) : null;
            const hit   = shape && !Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId) ? Na__LeTools__ShapeInsertHit(sheet, shape, point) : null;
            if (hit) {
                Na__LeGrips__HideInsert();
                const start = Na__LeShapeGeo__InsertPoint(Na__LeShapeGeo__Points(shape), hit.index, hit.point);
                Na__LeModel__UpdateShape(sheet, found.id, { points : start }, true);
                Na__LeSurface__Refresh('markup');
                Na__LeTools__WriteDrag({ kind : 'shape', id : found.id, mode : 'vertex', index : hit.index + 1, start : start, inserted : true,
                                         startMm : point, moved : false, pointerId : event.pointerId, click : null });
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                Na__LeMeasure__Refresh();                                    // <-- The Measurements box wakes for a vertex drag
                event.preventDefault();
                return;
            }
        }

        // SELECTION, THEN THE DRAG | Several selected move together; one
        // selected is dragged its own way, grips and handles included.
        // ------------------------------------
        const click = Na__LeTools__PressSelection(pressed, intent.combine);
        if (!Na__LeModel__IsSelected(pressed.kind, pressed.id)) return;         // <-- Ctrl+Shift on an unselected item: nothing to change, nothing to drag
        if (!Na__LeTools__Editable) { if (click) click(); return; }
        const items = Na__LeModel__GetSelectionItems();
        const asSet = items.length > 1 || items.some((item) => item && item.kind === 'group');
        const drag  = asSet ? { kind : 'group', group : Na__LeSelSet__Capture(sheet, Na__LeGroup__Expand(sheet, items)) } : Na__LeTools__DragFor(sheet, found, point);
        if (!drag) { if (click) click(); return; }
        drag.startMm   = point;
        drag.moved     = false;
        drag.pointerId = event.pointerId;
        drag.click     = click;                                              // <-- Run if the button comes up without a move
        if (door && items.length === 1) {
            const viewportId = found.id;
            drag.click = () => { if (click) click(); Na__LeDoors__ToggleSoon(sheet, viewportId, door); };   // <-- A click on a door, not a move: close or open it
        }
        Na__LeTools__WriteDrag(drag);
        Na__LeGrips__HideInsert();
        Na__LeTools__Stage.setPointerCapture(event.pointerId);
        if ((drag.kind === 'shape' && drag.mode === 'vertex') || Na__LeTools__IsViewportMoveDrag(drag)) Na__LeMeasure__Refresh();   // <-- The box reads a vertex or a viewport while it is held
        event.preventDefault();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Click: Finish a Shape, Edit Text or a Value, or Enter a Viewport's Content
    // ------------------------------------------------------------
    function Na__LeTools__OnDoubleClick(event) {
        Na__LeDoors__CancelPending();                                         // <-- The two clicks of a double click never toggle a door
        if (!Na__LeTools__Editable || event.button !== 0) return;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW) { if (Na__LeShape__IsDrawing()) { event.preventDefault(); Na__LeShape__Finish(sheet, false); } return; }
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return;
        const markup = Na__LeMarkup__HitTest(sheet, point, Na__LeTools__Tolerance());
        if (markup) {
            if (markup.kind === 'annotation')     Na__LeText__BeginEdit(markup.id);
            else if (markup.kind === 'dimension') Na__LeDim__BeginTextEdit(markup.id);
            else if (markup.kind === 'leader')    Na__LeLeader__BeginEdit(markup.id);
            return;
        }
        const found = Na__LeTools__Resolve(sheet, point);
        if (!found || found.kind !== 'viewport') return;
        event.preventDefault();
        Na__LeTools__SetEditingViewport(Na__LeSurface__GetEditingViewport() === found.id ? null : found.id);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Pointer Press
    // ------------------------------------------------------------
    export {
        Na__LeTools__OnDown,
        Na__LeTools__OnDoubleClick
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
