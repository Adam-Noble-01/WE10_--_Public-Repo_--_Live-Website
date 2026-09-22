// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - KEYBOARD
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__Keyboard__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Keyboard
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The keys while the editor is on screen: back out, delete, nudge or lock the axis, pick a tool, step the history, run the clipboard and groups, switch Ortho, and redraw on Shift
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - OnKey: the key map's binding, not the key, decides. A text field keeps
//   every key (IsTextEntry); a select, a checkbox or a number box keeps only
//   the bare keys it uses (Na__KeyScope__ControlKeepsKey) - any other bound
//   key is the sheet's, the focus with it (TakeKeyFromControl) - and a Ctrl
//   chord (SHEET_CHORDS) always reaches the sheet.
//   Escape backs out one step at a time (and clears the viewport snap move's
//   tracking points), Space puts Select up and then down again
//   (Tool__Select, which the space bar and V both run), Enter finishes a polyline or content
//   editing, Delete removes, the arrows nudge the selection or lock the axis
//   a point is being placed on or a vertex dragged along (AxisKey), the tool
//   keys pick a tool or arm the eyedropper,
//   the snap key toggles snapping, F8 toggles Ortho mode (AutoCAD's key),
//   F6 shows the drawing grid and F7 snaps to it (Adam's LayOut keys),
//   K toggles Draft mode, Ctrl+Z and Ctrl+Y step the history (or a
//   polyline's vertices), and Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+G and
//   Ctrl+Shift+G run the clipboard and groups.
// - DeleteSelection removes the selection (a viewport asks first) and Nudge
//   moves it by the nudge step; several items, or a group, go together.
// - RedrawHeld runs whatever is being placed or dragged again from the last
//   pointer position, so F8 and Shift re-aim a band, a dimension line or a
//   drag at once. ShiftRedraw uses it, and redraws the insert diamond, as
//   Shift goes down or up, without waiting for the mouse. Rerun runs the
//   placing tool's move again once the Measurements box has placed a point.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ listens on the window with OnKey and
//   ShiftRedraw (keydown and keyup), hands Rerun to the Measurements box and
//   re-exports DeleteSelection.
// - Na__LayoutEditor__SheetTools__ContextMenu__ calls DeleteSelection.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : Escape also clears Na__LayoutEditor__ViewportSnapMove__, which only TrueVision has.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.14.0
// - Rerun restretches a note region's rubber box (TOOL_REGION) from the last
//   pointer point, as it does a rectangle's. The rest - the arrows swallowed,
//   Ctrl+Z and Escape abandoning the box - already keyed on the Rectangle
//   tool's box being drawn, which is what a region is drawn with.
//
// 21-Sep-2026 - Version 1.13.0
// - F9 (View__AxesToggle) shows or hides the Drawing Axes Overlay
//   (Na__LayoutEditor__DrawingAxes__): a view, like F6, so the tool, the
//   selection and a point half placed are left alone, the browser's own use
//   of the key is kept from it, and a held key only counts once.
//
// 21-Sep-2026 - Version 1.12.0
// - THE VECTOR TOOLS' KEYS (37__System__VectorTools). The switch's default asks
//   their adapter which tool an action picks up, so C, Shift+A, T, Shift+T, J,
//   U, F, Shift+F and Shift+C are rows in the key file and one branch here.
// - The key map is told the SITUATION the key was pressed in
//   ({ InContainer }), so a binding may name When it applies: T is Trim while a
//   group or a vector is open and the Text tool out on the sheet.
// - Ctrl+Z with a vector tool half way through something steps THAT back (an
//   arc's last point; a circle, a fence or a held line let go) and Ctrl+Y is
//   swallowed, as for a rubber rectangle. An arrow locks the axis of an arc's
//   chord or radius and never nudges under a tool with something in hand. F8
//   and Shift re-aim a vector tool's preview at once (RedrawHeld, Rerun).
//
// 21-Sep-2026 - Version 1.11.0
// - CopyKey: the copy key (Ctrl, the key map's CopyDragModifier) going down
//   during a whole-object or frame move turns it into a copy - the original
//   back where it started, a copy on the pointer - and pressed again back
//   into a move (Na__LayoutEditor__SheetTools__CopyDrag__), redrawn at once
//   (RedrawHeld). A held key counts once; letting go changes nothing.
// - An arrow with the copy key still held mid-move is still the axis lock
//   (MatchUnderCopy): Ctrl+Right matched no binding, so the lock failed while
//   Ctrl was down. Only the four axis actions are looked up without it.
//
// 21-Sep-2026 - Version 1.10.0
// - A FOCUSED CONTROL KEEPS ONLY THE KEYS IT USES. OnKey stood down for every
//   bare key while a select, a tick box or a number box had the focus, and a
//   panel control keeps the focus after it is clicked - so after ticking a
//   box or picking from a list, M, V, Escape and Delete went nowhere until
//   something else was clicked, and a list took the letter for itself (M
//   chose "Medium" in the Raster list). Only the keys the control really uses
//   stay with it now (Na__KeyScope__ControlKeepsKey: an arrow in a list,
//   Space on a tick box, a figure in a number box); any other bound key is
//   the sheet's, taken from the control with the focus (TakeKeyFromControl),
//   so the keys after it are the sheet's too. A text field still keeps every
//   key, and the chords still reach the sheet from any control.
// - ENTER IN A ONE-LINE PANEL FIELD GIVES THE KEYS BACK (EnterLeavesField). A
//   panel's text box kept the focus after Enter, so the next M, V or Escape
//   went on into it - M straight after naming a room in Floor Areas was typed
//   onto the end of the name. Once the field has answered its Enter, the stage
//   takes the focus, which blurs the field and commits it.
//
// 21-Sep-2026 - Version 1.9.0
// - View__GridToggle (F6) shows or hides the drawing grid and
//   Snap__GridToggle (F7) switches Grid Snap (Na__LayoutEditor__DrawingGrid__):
//   SketchUp LayOut's View > Show Grid and Arrange > Grid Snap, on the keys
//   Adam's own LayOut has them on. Views, not tools; F7 re-aims what is in
//   flight at once (RedrawHeld). A held key counts once.
//
// 21-Sep-2026 - Version 1.8.0
// - Ortho__Toggle (F8) switches Ortho mode (Na__LayoutEditor__OrthoMode__),
//   AutoCAD's: new lines, dimensions and moves held horizontal or vertical,
//   Shift its temporary override. A way of drawing, not a tool - the tool, the
//   selection and a point half placed are left alone - and a held F8 counts
//   once. F8 still reaches the sheet from a focused select, checkbox or number
//   box (SHEET_CHORDS), because it types nothing.
// - RedrawHeld: F8 and Shift re-aim what is in flight at once - a drag that
//   has really moved (vertex, whole-object move, dimension end, viewport
//   frame), else the Draw or Area tool's band or the Dimension tool's span or
//   line. ShiftRedraw now runs it, so a held Shift re-aims the Draw band and a
//   drag as well as the dimension line it always redrew.
//
// 21-Sep-2026 - Version 1.7.0
// - View__DraftToggle (K) switches Draft mode (Na__LayoutEditor__DraftMode__):
//   only the viewports' vector linework, hairlines, no fills, no raster
//   pictures. A view, not a tool: the tool, the selection and any point half
//   placed are left alone. A held K counts once.
//
// 17-Sep-2026 - Version 1.6.0
// - AxisKey also locks the axis of a WHOLE-OBJECT MOVE, so the Move tool's drag
//   constrains to X or Y on the arrow keys exactly as a vertex drag does - and
//   the Measurements box takes a typed distance for it.
//
//
// 17-Sep-2026 - Version 1.5.0
// - INSIDE A CONTAINER THE ARROW KEYS NEVER MOVE ANYTHING. The nudge reached
//   the whole open vector or dimension, so an arrow pressed between drags
//   walked the object being edited - and the axis lock, which is what the
//   arrows mean in there, then read as broken because the shape had already
//   shifted. The key is swallowed in a container instead: the lock still takes
//   it mid-drag, nothing moves otherwise, and the page cannot scroll.
//
//
// 17-Sep-2026 - Version 1.4.0
// - ESCAPE IS ONE KEY WITH ONE MEANING: STOP. It was a ladder - a press to
//   abandon the placement, another to clear the selection, another to put the
//   tool down - so the number of presses needed depended on state nobody was
//   tracking. One press now abandons whatever is half done, closes every open
//   container, drops the selection and leaves NO TOOL armed, from anywhere.
// - Enter finishes, or steps inside: with one vector, dimension or group
//   selected and nothing in flight it opens it, the keyboard's double click.
// - Delete inside a vector deletes the picked points (DeleteVertices), never
//   cutting it below the two that still draw.
// - Tool__Move (M) picks up the Move tool.
// - SELECT IS THE ONE RESTING STATE. Escape comes back to it, and the space bar
//   (Tool__SelectToggle, 1.2.0) simply arms it rather than toggling it off: a
//   tool-less state meant a press did nothing and the browser took the click.
//   Both keys are taken from the browser, and a held key only counts once.
//
//
// 17-Sep-2026 - Version 1.3.0
// - AxisKey also locks the axis of a dimension end being dragged.
//
// 17-Sep-2026 - Version 1.2.0
// - Tool__SelectToggle: the space bar picks Select up and, pressed again, puts
//   it down, and is always taken from the browser so the page cannot scroll or
//   zoom under the sheet.
//
// 17-Sep-2026 - Version 1.1.0
// - AxisKey also locks the axis of a vertex drag, so a vector's vertex is
//   constrained with a key rather than a held Shift and the length can then
//   be typed into the Measurements box.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Tools, Eyedropper, Axis Lock, Snapping, Viewport Snap Move, Clipboard, Groups, Selection, History, Confirm Dialog
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetKeyboardSetup, Na__LeCfg__MatchKeyBinding, Na__LeCfg__GetCopyDragModifier, Na__LeCfg__IsCopyDragKey } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetEditingViewport } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeDim__Move, Na__LeDim__IsPlacing, Na__LeDim__IsSpanning } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Move, Na__LeShape__Finish, Na__LeShape__IsDrawing, Na__LeShape__UndoVertex, Na__LeShape__RedoVertex } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Move, Na__LeRect__Cancel, Na__LeRect__IsDrawing } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeVec__IsTool, Na__LeVec__IsDrawing, Na__LeVec__Move, Na__LeVec__ToolForAction, Na__LeVec__StepBack, Na__LeVec__TakesAxis, Na__LeVec__SwallowsArrows } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__.js';   // <-- The vector tools' one door
    import { Na__LeAreaTool__Rerun, Na__LeAreaTool__Finish, Na__LeAreaTool__IsDrawing } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__Tool__.js';
    import { Na__LeRegionTool__Rerun } from '../50__Feature__Specification/Na__LayoutEditor__NoteRegions__Tool__.js';
    import { Na__LeMeasure__Refresh } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__IsPlacing } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeLeadGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeDrop__Clear, Na__LeDrop__HasSource } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y, Na__LeAxis__Toggle } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeOsnap__Toggle } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__.js';   // <-- F3: object snap's own folder now (the controller - the switch and its echo)
    import { Na__LeOrtho__Toggle } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__.js';
    import { Na__LeDraft__Toggle } from '../26__System__DraftMode/Na__LayoutEditor__DraftMode__.js';
    import { Na__LeGrid__ToggleShow, Na__LeGrid__ToggleSnap } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__.js';
    import { Na__LeAxes__Toggle } from '../33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__.js';   // <-- F9: the Drawing Axes Overlay
    import { Na__LeVpMove__Clear } from '../28__System__ObjectSnap/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeClip__RunKeyAction } from './Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeGroup__Expand, Na__LeGroup__Group, Na__LeGroup__Ungroup } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    // @delegate: ../15__Core__Markup/Na__LayoutEditor__Groups__.js
    // @delegate: ./Na__LayoutEditor__ItemClipboard__.js
    import { Na__LeSelBox__Cancel, Na__LeSelBox__IsActive } from './Na__LayoutEditor__SelectionBox__.js';
    import {
        Na__LeScope__IsActive,
        Na__LeScope__IsLeafOpen,
        Na__LeScope__IsVectorEdit,
        Na__LeScope__GetVectorId,
        Na__LeScope__GetVertices,
        Na__LeScope__ClearVertices,
        Na__LeScope__Clear
    } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeTools__EnterScope } from './Na__LayoutEditor__SheetTools__PointerPress__.js';
    import { Na__LeSelSet__Nudge, Na__LeSelSet__Delete } from './Na__LayoutEditor__SelectionSet__.js';
    import { Na__LeHist__Undo, Na__LeHist__Redo } from '../07__Core__SheetData/Na__LayoutEditor__History__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import { Na__KeyScope__ControlKeepsKey } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOL_AREA,
        Na__LeTools__TOOL_REGION,
        Na__LeTools__SHEET_CHORDS,
        Na__LeTools__NON_TEXT_INPUTS,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Drag,
        Na__LeTools__LastPointMm,
        Na__LeTools__ShiftHeld,
        Na__LeTools__WriteShiftHeld
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import {
        Na__LeTools__Tool,
        Na__LeTools__CancelPlacement,
        Na__LeTools__SetTool,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__ArmPalette,
        Na__LeTools__GetShapeDefaults
    } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import { Na__LeTools__RefreshShapeInsert, Na__LeTools__Record, Na__LeTools__IsViewportLocked } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    import { Na__LeTools__IsVertexDrag, Na__LeTools__RerunVertexDrag, Na__LeTools__IsDimEndDrag, Na__LeTools__RerunDimEndDrag, Na__LeTools__IsMoveDrag, Na__LeTools__RerunMoveDrag, Na__LeTools__IsViewportMoveDrag, Na__LeTools__RerunViewportDrag } from './Na__LayoutEditor__SheetTools__PointerDrag__.js';
    import { Na__LeTools__SetEditingViewport } from './Na__LayoutEditor__SheetTools__ContentEditing__.js';
    import { Na__LeTools__ToggleCopyDrag } from './Na__LayoutEditor__SheetTools__CopyDrag__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard
// -----------------------------------------------------------------------------

    // FUNCTION | Delete Whatever Is Selected (a viewport asks first)
    // ------------------------------------------------------------
    async function Na__LeTools__DeleteSelection() {
        const sheet = Na__LeModel__GetActiveSheet();
        const items = Na__LeModel__GetSelectionItems();
        if (sheet && Na__LeTools__Editable && (items.length > 1 || items.some((item) => item && item.kind === 'group'))) return Na__LeSelSet__Delete(sheet, Na__LeGroup__Expand(sheet, items));   // <-- Several, or a group: one undo step
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || !Na__LeTools__Editable) return false;
        if (selection.kind === 'annotation') return Na__LeModel__DeleteAnnotation(sheet, selection.id);
        if (selection.kind === 'dimension')  return Na__LeModel__DeleteDimension(sheet, selection.id);
        if (selection.kind === 'shape')      return Na__LeModel__DeleteShape(sheet, selection.id);
        if (selection.kind === 'leader')     return Na__LeModel__DeleteLeader(sheet, selection.id);
        const viewport = Na__LeModel__GetViewportById(sheet, selection.id);
        if (!viewport || Na__LeTools__IsViewportLocked(sheet, viewport)) return false;   // <-- Unlock first
        const ok = await Na__AppUtils__ConfirmDialog__Show({
            title : Na__LeCfg__GetLabel('DeleteViewportTitle', 'Delete viewport'),
            message : Na__LeCfg__GetLabel('DeleteViewportPrompt', 'Remove this viewport from the sheet? Sheet dimensions attached to it keep their paper length.'),
            confirmLabel : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'), isDestructive : true
        });
        return ok ? Na__LeModel__DeleteViewport(sheet, selection.id) : false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Points Picked Inside the Open Vector
    // ------------------------------------------------------------
    // Inside a vector, Delete means the points - the only thing in there to
    // delete. A vector is never cut below two points, which is the least that
    // still draws; taking the last points out is deleting the vector itself,
    // and that is done from outside it.
    // ------------------------------------------------------------
    function Na__LeTools__DeleteVertices() {
        const sheet   = Na__LeModel__GetActiveSheet();
        const shapeId = Na__LeScope__GetVectorId();
        const picked  = Na__LeScope__GetVertices();
        if (!sheet || !shapeId || !picked.length || !Na__LeTools__Editable) return false;
        const shape = Na__LeTools__Record(sheet, { kind : 'shape', id : shapeId });
        if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return false;
        const points = Na__LeShapeGeo__Points(shape);
        const kept   = points.filter((point, index) => picked.indexOf(index) === -1).map((point) => [ point[0], point[1] ]);
        const floor  = shape.Shape__Area ? 3 : 2;                             // <-- A measured room needs three corners to enclose anything; a plain vector needs two to draw
        if (kept.length < floor || kept.length === points.length) return false;
        Na__LeScope__ClearVertices();
        return Na__LeModel__UpdateShape(sheet, shapeId, { points : kept }, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Nudge the Selection by a Millimetre Step
    // ------------------------------------------------------------
    function Na__LeTools__Nudge(dx, dy) {
        const sheet = Na__LeModel__GetActiveSheet();
        const items = Na__LeModel__GetSelectionItems();
        if (sheet && (items.length > 1 || items.some((item) => item && item.kind === 'group'))) return Na__LeSelSet__Nudge(sheet, Na__LeGroup__Expand(sheet, items), dx, dy);   // <-- Several, or a group: every movable member by the same step
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection) return false;
        const record = Na__LeTools__Record(sheet, selection);
        if (!record) return false;
        if (selection.kind === 'viewport') {
            if (Na__LeTools__IsViewportLocked(sheet, record)) return false;
            return Na__LeModel__UpdateViewport(sheet, selection.id, { rect : { X : record.Viewport__FrameMm.X + dx, Y : record.Viewport__FrameMm.Y + dy } }, false);
        }
        if (selection.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return false;
            return Na__LeModel__UpdateAnnotation(sheet, selection.id, { posXMm : record.Annotation__PosXMm + dx, posYMm : record.Annotation__PosYMm + dy }, false);
        }
        if (selection.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return false;
            return Na__LeModel__UpdateShape(sheet, selection.id, { points : Na__LeShapeGeo__Translated(Na__LeShapeGeo__Points(record), dx, dy) }, false);
        }
        if (selection.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return false;
            return Na__LeModel__UpdateLeader(sheet, selection.id, Na__LeLeadGeo__Translated(record, dx, dy), false);   // <-- A nudge moves the whole leader
        }
        if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return false;
        return Na__LeModel__UpdateDimension(sheet, selection.id, { startXMm : record.Dimension__StartXMm + dx, startYMm : record.Dimension__StartYMm + dy, endXMm : record.Dimension__EndXMm + dx, endYMm : record.Dimension__EndYMm + dy }, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Arrow Key Locks the Axis While a Point Is Being Placed or a Vertex Dragged
    // ------------------------------------------------------------
    // Left and right lock the X axis, up and down the Y, as in SketchUp
    // LayOut; the same key again releases it. The lock belongs to the
    // segment being drawn and the tool spends it the moment the point
    // lands. Returns false when nothing is being placed or dragged, which
    // leaves the arrow keys nudging the selection as before. A rectangle
    // being drawn swallows them instead: its edges are square to the paper
    // already, and nudging the previous selection out from under it would be
    // a surprise.
    //
    // A VERTEX OF A FINISHED VECTOR TAKES THE SAME KEYS, for the same reason
    // the keys exist at all. Shift holds a vertex drag to an axis too, but it
    // has to be let go of to reach the number keys, and the constraint goes
    // with it - so the length lands along whatever direction the raw cursor
    // happened to be pointing. An arrow key holds the axis with nothing held
    // down, which is what makes typing the dimension afterwards worth doing.
    // ------------------------------------------------------------
    function Na__LeTools__AxisKey(axis, shift) {
        if (!Na__LeTools__Editable) return false;
        if (Na__LeTools__IsVertexDrag()) { Na__LeAxis__Toggle(axis); Na__LeTools__RerunVertexDrag(); return true; }   // <-- Redrawn at once: the band takes the axis's colour and the box the axis's length
        if (Na__LeTools__IsMoveDrag())   { Na__LeAxis__Toggle(axis); Na__LeTools__RerunMoveDrag();   return true; }   // <-- A whole object held by the Move tool locks to an axis the same way
        if (Na__LeTools__IsDimEndDrag()) { Na__LeAxis__Toggle(axis); Na__LeTools__RerunDimEndDrag(); return true; }   // <-- A measured point holds an axis the same way a vertex does
        if (Na__LeTools__IsViewportMoveDrag()) { Na__LeAxis__Toggle(axis); Na__LeTools__RerunViewportDrag(); return true; }   // <-- And so does a viewport frame, carried by a point or moved plain
        if (Na__LeVec__TakesAxis(Na__LeTools__Tool)) {                       // <-- An arc's chord, or its radius from the centre: a straight run, locked as a line's is
            Na__LeAxis__Toggle(axis);
            const at = Na__LeTools__LastPointMm, on = Na__LeModel__GetActiveSheet();
            if (on && at) { Na__LeVec__Move(Na__LeTools__Tool, on, at, { shift : shift }, Na__LeTools__GetShapeDefaults()); Na__LeMeasure__Refresh(); }
            return true;
        }
        if (Na__LeVec__SwallowsArrows(Na__LeTools__Tool)) return true;       // <-- A vector tool with something in hand: no axis to lock, and no nudging the old selection from under it
        if (Na__LeRect__IsDrawing() || Na__LeLeader__IsPlacing()) return true;   // <-- Nothing to lock, and nudging the old selection mid-placement would surprise
        const drawing  = Na__LeShape__IsDrawing();
        const spanning = Na__LeDim__IsSpanning();                            // <-- Only the span phase: the offset phase has no axis to lock
        if (!drawing && !spanning) return false;
        Na__LeAxis__Toggle(axis);
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (sheet && point) {                                                // <-- Show the lock at once rather than on the next move
            if (drawing) Na__LeShape__Move(sheet, point, shift);
            else Na__LeDim__Move(sheet, point, shift);
            Na__LeMeasure__Refresh();
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ortho or Shift Changed: Redraw Whatever Is Being Placed or Dragged
    // ------------------------------------------------------------
    // The pointer only reports Shift when it moves, and F8 not at all, so
    // without this a rubber band, a dimension line or a dragged vertex kept
    // its old aim until the mouse was nudged. Runs the same move again from
    // the last pointer position with the Shift last seen: a drag in flight
    // first - a vertex, a whole-object move, a dimension end or a viewport
    // frame, and only once it has really moved, so a press still under the
    // drag threshold is never shifted by a key - else the Draw tool's band
    // (the Area tool's too, while it draws corner by corner) or the Dimension
    // tool's span or line. A rectangle is left alone: Ortho has no say there,
    // and Shift's square follows the next move as it always has. Returns true
    // when something was redrawn.
    // ------------------------------------------------------------
    function Na__LeTools__RedrawHeld() {
        if (!Na__LeTools__Editable) return false;
        const drag = Na__LeTools__Drag;
        if (drag && drag.moved === true) {
            if (Na__LeTools__RerunVertexDrag() || Na__LeTools__RerunMoveDrag() || Na__LeTools__RerunDimEndDrag() || Na__LeTools__RerunViewportDrag()) return true;
        }
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!sheet || !point) return false;
        const tool = Na__LeTools__Tool;
        if ((tool === Na__LeTools__TOOL_DRAW || tool === Na__LeTools__TOOL_AREA) && Na__LeShape__IsDrawing()) Na__LeShape__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (tool === Na__LeTools__TOOL_DIMENSION && Na__LeDim__IsPlacing()) Na__LeDim__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeVec__IsTool(tool)) Na__LeVec__Move(tool, sheet, point, { shift : Na__LeTools__ShiftHeld }, Na__LeTools__GetShapeDefaults());   // <-- Shift swaps Trim and Extend, and holds an arc's chord: shown at once, not on the next move
        else return false;
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Shift Went Down or Up: Redraw Whatever Shift Holds
    // ------------------------------------------------------------
    // Shift turns the dimension whose line is following the cursor ortho, holds
    // a band or a drag to the nearer axis - and, with Ortho on, frees them -
    // but the pointer only reports Shift when it moves: without this, pressing
    // Shift over a still mouse showed nothing until the mouse was nudged. It
    // used to redraw the dimension line alone; since Ortho (F8) made Shift its
    // temporary override it redraws the band and the drag as well
    // (RedrawHeld). Returns true when something was redrawn.
    // ------------------------------------------------------------
    function Na__LeTools__ShiftRedraw(shift) {
        Na__LeTools__WriteShiftHeld(!!shift);                                // <-- Remembered for a value typed into the Measurements box
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        Na__LeTools__RefreshShapeInsert(sheet, point, shift);                 // <-- The insert diamond appears as soon as Shift goes down, without a mouse nudge
        return Na__LeTools__RedrawHeld();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Copy Key Went Down: a Move in Flight Carries a Copy, or the Original Again
    // ------------------------------------------------------------
    // SketchUp's and LayOut's Move: Ctrl pressed during a move turns it into a
    // copy - the original goes back where it started and a copy follows the
    // pointer - and pressed again turns it back into a move. A tap is enough;
    // letting go changes nothing, so the hand can go to an arrow key or type a
    // length. A held key repeats and only the first press counts. The drag is
    // redrawn at once from the last pointer position (Na__LayoutEditor__
    // SheetTools__CopyDrag__ makes or removes the copy). Returns true when a
    // move took the key.
    // ------------------------------------------------------------
    function Na__LeTools__CopyKey(event) {
        if (!event || event.repeat || !Na__LeCfg__IsCopyDragKey(event.key)) return false;
        if (!Na__LeTools__ToggleCopyDrag()) return false;
        Na__LeTools__RedrawHeld();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Arrow With the Copy Key Still Held Is Still the Axis Lock
    // ------------------------------------------------------------
    // Ctrl held through a copy drag belongs to the drag, not to a chord, but the
    // key map reads it as one: Ctrl+Right matches no binding, so without this
    // the arrow lock would fail for as long as Ctrl was down. While a move is
    // in flight the arrows are looked up again without the copy key, and only
    // the axis lock may answer - no other Ctrl chord changes meaning.
    // ------------------------------------------------------------
    const Na__LeTools__AXIS_ACTIONS = Object.freeze([ 'Edit__NudgeLeft', 'Edit__NudgeRight', 'Edit__NudgeUp', 'Edit__NudgeDown' ]);

    function Na__LeTools__MatchUnderCopy(key, held) {
        const drag = Na__LeTools__Drag;
        const name = Na__LeCfg__GetCopyDragModifier();
        if (!drag || drag.copyable !== true || !name || !held[name]) return null;
        const bare = Na__LeCfg__MatchKeyBinding(key, Object.assign({}, held, { [name] : false }));
        return (bare && Na__LeTools__AXIS_ACTIONS.indexOf(bare.action) !== -1) ? bare : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run the Placing Tool's Move Again From the Last Pointer Position
    // ------------------------------------------------------------
    // Once the Measurements box has placed a point, the band sets off again
    // from it towards wherever the cursor is, without waiting for the mouse
    // to move. Returns true when a placing tool was up to run.
    // ------------------------------------------------------------
    function Na__LeTools__Rerun() {
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!Na__LeTools__Editable || !sheet || !point) return false;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_AREA)           Na__LeAreaTool__Rerun(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      Na__LeShape__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) Na__LeDim__Move(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      Na__LeRect__Move(sheet, point, Na__LeTools__ShiftHeld, false);
        else if (Na__LeTools__Tool === Na__LeTools__TOOL_REGION)    Na__LeRegionTool__Rerun(sheet, point, Na__LeTools__ShiftHeld);
        else if (Na__LeVec__IsTool(Na__LeTools__Tool))              Na__LeVec__Move(Na__LeTools__Tool, sheet, point, { shift : Na__LeTools__ShiftHeld }, Na__LeTools__GetShapeDefaults());
        else return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Focus in a Field That Takes Typed Text
    // ------------------------------------------------------------
    // A text box, a text area or an editable region: somewhere Ctrl+Z and
    // Ctrl+V already mean something to the field itself. A number box is not
    // one of those - once Edge pt has been applied it has no undo of its own -
    // so it is treated like a checkbox and the sheet chords still reach here.
    // ------------------------------------------------------------
    function Na__LeTools__IsTextEntry(target) {
        if (!target) return false;
        if (target.isContentEditable || target.tagName === 'TEXTAREA') return true;
        if (target.tagName !== 'INPUT') return false;
        return Na__LeTools__NON_TEXT_INPUTS.indexOf(String(target.type || 'text').toLowerCase()) === -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Enter in a One-Line Panel Field: the Typing Is Done, the Keys Go Back to the Sheet
    // ------------------------------------------------------------
    // A panel's text box keeps every key while it is typed in - the letters
    // are the name being written. It used to keep the focus after Enter too,
    // so the next M, V or Escape went on into it (M straight after naming a
    // room in Floor Areas was typed onto the end of the name) and the sheet's
    // keys stayed dead until the paper was clicked. Enter is where the typing
    // ends: once the field has answered it, the stage takes the focus, which
    // blurs the field and commits it. Left alone: a text area and anything
    // contenteditable (Enter is a new line there), text typed on the paper
    // (its tool commits it), a field already put away by its own Enter, and
    // an Enter that is finishing an input method's composition.
    // ------------------------------------------------------------
    function Na__LeTools__EnterLeavesField(event) {
        const target = event.target;
        const stage  = Na__LeTools__Stage;
        if (!stage || !target || target.tagName !== 'INPUT' || event.isComposing || typeof document === 'undefined') return false;
        if (typeof stage.contains === 'function' && stage.contains(target)) return false;   // <-- Text on the paper: its tool commits it
        if (document.activeElement !== target) return false;                              // <-- Already put away by its own Enter
        try { stage.focus({ preventScroll : true }); } catch (error) { return false; }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Bound Key the Focused Control Has No Use For: the Sheet's, and the Focus With It
    // ------------------------------------------------------------
    // The control must not act on the key as well - a list would jump to the
    // option starting with that letter - and the keys after it are the
    // sheet's, so the stage takes the focus. The control blurs on the way,
    // which commits what was typed into it exactly as clicking away does.
    // ------------------------------------------------------------
    function Na__LeTools__TakeKeyFromControl(event) {
        event.preventDefault();
        const stage = Na__LeTools__Stage;
        if (stage && typeof stage.focus === 'function') {
            try { stage.focus({ preventScroll : true }); return; } catch (error) { /* not focusable: blur below */ }
        }
        const target = event.target;
        if (target && typeof target.blur === 'function') target.blur();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Key Handling While the Editor Is on Screen
    // ------------------------------------------------------------
    function Na__LeTools__OnKey(event) {
        const target = event.target;
        const typing = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable));
        const keys   = Na__LeCfg__GetKeyboardSetup();
        const guard  = typing && keys.ignoreWhenTyping;
        if (guard && Na__LeTools__IsTextEntry(target)) {                     // <-- A text field keeps every key, its own undo and paste included
            if (event.key === 'Enter') Na__LeTools__EnterLeavesField(event); // <-- ...and once it has had its Enter, the keys go back to the sheet
            return;
        }

        // The binding, not the key, decides what happens. Navigation actions
        // are left alone here: the PC controls module owns those. An arrow with
        // the copy key still held mid-move is the axis lock all the same.
        const held  = { Ctrl : !!event.ctrlKey, Shift : !!event.shiftKey, Alt : !!event.altKey, Meta : !!event.metaKey, Space : false };
        const match = Na__LeCfg__MatchKeyBinding(event.key, held, { InContainer : Na__LeScope__IsActive() }) || Na__LeTools__MatchUnderCopy(event.key, held);   // <-- The situation goes with the key: a binding may name When it applies (T is Trim inside a container, Text outside)
        if (!match || !match.action) return;
        // A SELECT, A CHECKBOX OR A NUMBER BOX HAS NO UNDO OR PASTE OF ITS OWN,
        // so a Ctrl chord always belongs to the sheet. Without this, Ctrl+Z
        // straight after choosing a scene in the Viewport panel, or after
        // changing Edge pt on a vector, went nowhere: the control still had
        // the focus.
        //
        // AND IT KEEPS ONLY THE BARE KEYS IT USES (Na__KeyScope__ControlKeepsKey):
        // an arrow in a list, Space on a tick box, a figure in a number box.
        // This used to stand down for every bare key, so after ticking a box or
        // picking from a list M, V, Escape and Delete went nowhere, and a list
        // took the letter for itself (M chose "Medium" in the Raster list). Any
        // other bound key is the sheet's: taken from the control, focus and all,
        // so the key after it is the sheet's too.
        if (guard && Na__LeTools__SHEET_CHORDS.indexOf(match.action) === -1) {
            if (Na__KeyScope__ControlKeepsKey(target, event.key)) return;
            Na__LeTools__TakeKeyFromControl(event);
        }
        const step  = match.coarse ? keys.nudgeCoarseStepMm : keys.nudgeStepMm;
        const sheet = Na__LeModel__GetActiveSheet();

        switch (match.action) {
            // ESCAPE IS ONE KEY WITH ONE MEANING: STOP, AND GO BACK TO SELECT.
            // It used to be a ladder
            // - a press to abandon the placement, another to clear the
            // selection, another to put the tool down - which meant the number
            // of presses needed depended on state nobody was tracking, and the
            // press after the last one did something else again. Now a single
            // press abandons whatever is half done, closes any container that
            // is open, drops the selection and leaves NO TOOL armed, from
            // anywhere, every time. V or the space bar picks Select back up.
            // Clicking outside a container is the gentle way out of one; this
            // is the one that always works.
            // ------------------------------------
            case 'Edit__Cancel':
                Na__LeVpMove__Clear();                                                    // <-- Tracking points go, whatever else Esc backs out of
                Na__LeSelBox__Cancel();
                Na__LeTools__CancelPlacement();                                           // <-- Placement, eyedropper, axis lock and a half-typed value
                Na__LeDrop__Clear();
                if (Na__LeSurface__GetEditingViewport()) Na__LeTools__SetEditingViewport(null);
                Na__LeScope__Clear();                                                     // <-- Out of every container, however deep
                Na__LeModel__SetSelection(null);
                Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);          // <-- Select is the resting state: never leave the sheet with nothing armed
                event.preventDefault(); return;
            case 'Edit__Deselect':                                                   // <-- A clean slate, whatever was going on (unbound by default since the space bar became Select)
                event.preventDefault();
                Na__LeScope__Clear();
                Na__LeTools__CancelPlacement();
                if (Na__LeSurface__GetEditingViewport()) Na__LeTools__SetEditingViewport(null);
                Na__LeModel__SetSelection(null);
                return;
            // ENTER FINISHES, OR STEPS INSIDE. A polyline being drawn finishes,
            // a viewport's content editing finishes - and with one vector or one
            // group selected and nothing in flight, Enter opens it, which is the
            // keyboard's way to do what a double click does.
            // ------------------------------------
            case 'Edit__Finish': {
                if (Na__LeTools__Tool === Na__LeTools__TOOL_AREA && Na__LeAreaTool__IsDrawing() && sheet) { event.preventDefault(); Na__LeAreaTool__Finish(sheet); return; }   // <-- A room is finished CLOSED, whatever finished it
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__Finish(sheet, false); return; }
                if (Na__LeSurface__GetEditingViewport()) { event.preventDefault(); Na__LeTools__SetEditingViewport(null); return; }   // <-- A 3D picture keeps the zoom it was left at
                const one = Na__LeModel__GetSelectionItems();
                if (sheet && one.length === 1 && Na__LeTools__EnterScope(sheet, one[0])) event.preventDefault();
                return;
            }
            case 'Edit__Delete':
                if (Na__LeScope__IsVectorEdit()) { if (Na__LeTools__DeleteVertices()) event.preventDefault(); return; }   // <-- Inside a vector, Delete is about its points
                if (Na__LeModel__GetSelectionItems().length) { event.preventDefault(); void Na__LeTools__DeleteSelection(); }
                return;
            // AN ARROW KEY IS THE AXIS LOCK FIRST, AND A NUDGE ONLY OUT ON THE
            // SHEET. Inside an open vector or dimension it NEVER moves anything:
            // the nudge used to reach the whole open object, so an arrow pressed
            // between drags walked the very thing being edited, and the lock -
            // which is what the arrows mean in there - then read as broken
            // because the shape had already shifted. In a container the key is
            // swallowed instead, so nothing moves and the page does not scroll.
            // ------------------------------------
            case 'Edit__NudgeLeft':
            case 'Edit__NudgeRight': {
                const dx = match.action === 'Edit__NudgeLeft' ? -step : step;
                if (Na__LeTools__AxisKey(Na__LeAxis__AXIS_X, !!event.shiftKey)) { event.preventDefault(); return; }
                if (Na__LeScope__IsLeafOpen()) { event.preventDefault(); return; }
                if (Na__LeTools__Editable && Na__LeTools__Nudge(dx, 0)) event.preventDefault();
                return;
            }
            case 'Edit__NudgeUp':
            case 'Edit__NudgeDown': {
                const dy = match.action === 'Edit__NudgeUp' ? -step : step;
                if (Na__LeTools__AxisKey(Na__LeAxis__AXIS_Y, !!event.shiftKey)) { event.preventDefault(); return; }
                if (Na__LeScope__IsLeafOpen()) { event.preventDefault(); return; }
                if (Na__LeTools__Editable && Na__LeTools__Nudge(0, dy)) event.preventDefault();
                return;
            }
            // THE SPACE BAR PUTS SELECT UP, THEN PUTS IT DOWN AGAIN. One press
            // drops whatever tool is up and picks Select up (SetTool abandons
            // the old tool's half-done work on the way); the next press puts
            // Select down too, leaving nothing armed - the resting state
            // Escape leaves. The key is ALWAYS taken from the browser, even
            // when nothing changes: left to it, the space bar scrolls the page
            // out from under the sheet, which is what it was doing before.
            // A held space repeats, and only the first press counts.
            // ------------------------------------
            // SELECT IS ALWAYS THE ANSWER, never a toggle. V and the space bar
            // both simply arm it, and the key is ALWAYS taken from the browser -
            // the space bar would otherwise scroll the sheet out from under the
            // cursor. A held key repeats; only the first press counts.
            // ------------------------------------
            case 'Tool__SelectToggle':
            case 'Tool__Select':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeTools__SetTool(Na__LeTools__TOOL_SELECT);
                return;
            case 'Tool__Move':       Na__LeTools__SetTool(Na__LeTools__TOOL_MOVE);      return;
            case 'Tool__Text':       Na__LeTools__SetTool(Na__LeTools__TOOL_TEXT);      return;
            case 'Tool__Dimension':  Na__LeTools__SetTool(Na__LeTools__TOOL_DIMENSION); return;
            case 'Tool__Draw':       Na__LeTools__SetTool(Na__LeTools__TOOL_DRAW);      return;
            case 'Tool__Rectangle':  Na__LeTools__SetTool(Na__LeTools__TOOL_RECT);      return;
            case 'Tool__FloorArea':  Na__LeTools__SetTool(Na__LeTools__TOOL_AREA);      return;
            case 'Tool__Leader':     Na__LeTools__SetTool(Na__LeTools__TOOL_LEADER);    return;
            case 'Tool__Eyedropper': Na__LeTools__ArmEyedropper();                      return;
            case 'Tool__EyedropperPalette': Na__LeTools__ArmPalette();                  return;
            case 'Snap__Toggle':     Na__LeOsnap__Toggle(); event.preventDefault(); return;
            // ORTHO MODE IS A WAY OF DRAWING, NOT A TOOL. F8, AutoCAD's key,
            // switches it without touching the tool, the selection or a point
            // half placed, and a band, a dimension line or a drag in flight is
            // re-aimed at once, as AutoCAD re-aims its rubber band. A held F8
            // repeats; only the first press counts, or Ortho would flicker.
            // ------------------------------------
            case 'Ortho__Toggle':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeOrtho__Toggle();
                Na__LeTools__RedrawHeld();
                return;
            // DRAFT MODE IS A VIEW, NOT A TOOL. K switches it (SketchUp LayOut's
            // key) without touching the tool, the selection or a point half
            // placed, so it can be pressed in the middle of drawing a room to
            // get round a heavy sheet and pressed again to see it whole. A held
            // K repeats; only the first press counts, or the sheet would flicker.
            // ------------------------------------
            case 'View__DraftToggle':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeDraft__Toggle();
                return;
            // THE DRAWING GRID IS LAYOUT'S PAIR OF SWITCHES, on the keys Adam's
            // own LayOut has them on: F6 shows or hides the grid (View > Show
            // Grid) and F7 snaps to it or not (Arrange > Grid Snap). Views, not
            // tools: the tool, the selection and a point half placed are left
            // alone, and a band or a drag in flight is re-aimed at once when the
            // snap changes. The browser's own F6 (the address bar) and F7 (caret
            // browsing) are kept from it. A held key only counts once.
            // ------------------------------------
            case 'View__GridToggle':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeGrid__ToggleShow();
                return;
            case 'Snap__GridToggle':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeGrid__ToggleSnap();
                Na__LeTools__RedrawHeld();
                return;
            // THE DRAWING AXES ARE A VIEW, NOT A TOOL. F9, the key after
            // Ortho's, shows or hides SketchUp's red and green axes carried by
            // the cursor out to the edges of the sheet: the tool, the selection
            // and a point half placed are left alone, so it can be pressed in
            // the middle of a line. The browser's own use of the key (Edge's
            // Immersive Reader) is kept from it. A held key only counts once.
            // ------------------------------------
            case 'View__AxesToggle':
                event.preventDefault();
                if (event.repeat) return;
                Na__LeAxes__Toggle();
                return;
            case 'Edit__Undo':
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__UndoVertex(sheet); Na__LeMeasure__Refresh(); return; }
                if (Na__LeRect__IsDrawing()) { event.preventDefault(); Na__LeRect__Cancel(); Na__LeMeasure__Refresh(); return; }   // <-- A rubber box is not a record yet: undo it the way Escape does
                if (Na__LeVec__StepBack(Na__LeTools__Tool)) { event.preventDefault(); Na__LeMeasure__Refresh(); return; }   // <-- An arc gives its last point back; a circle, a fence or a held line is let go of. Nothing in hand: the sheet's history steps, below
                if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Undo(); }
                return;
            case 'Edit__Redo':
                if (Na__LeShape__IsDrawing() && sheet) { event.preventDefault(); Na__LeShape__RedoVertex(sheet); Na__LeMeasure__Refresh(); return; }
                if (Na__LeRect__IsDrawing()) { event.preventDefault(); return; }   // <-- Nothing to redo on a rubber box; do not step the sheet either
                if (Na__LeVec__IsDrawing(Na__LeTools__Tool)) { event.preventDefault(); return; }   // <-- Nor with a circle, an arc or a fence half drawn. A line Join or Offset is only HOLDING does not stop a redo
                if (Na__LeTools__Editable) { event.preventDefault(); Na__LeHist__Redo(); }
                return;
            case 'Edit__Copy':
            case 'Edit__Cut':
            case 'Edit__Paste':      if (Na__LeClip__RunKeyAction(match.action, Na__LeTools__Editable)) event.preventDefault(); return;   // <-- Nothing to copy or paste: the browser keeps the key
            case 'Edit__Duplicate':  if (Na__LeTools__Editable) { event.preventDefault(); Na__LeClip__RunKeyAction(match.action, true); } return;   // <-- Never the bookmark dialog while a sheet is open
            case 'Edit__Group':      if (Na__LeTools__Editable && sheet && Na__LeGroup__Group(sheet)) event.preventDefault(); return;
            case 'Edit__Ungroup':    if (Na__LeTools__Editable && sheet && Na__LeGroup__Ungroup(sheet)) event.preventDefault(); return;
            // THE VECTOR TOOLS' KEYS (37__System__VectorTools) - Tool__Circle,
            // Tool__Arc, Tool__Trim, Tool__Extend, Tool__Join, Tool__Split,
            // Tool__Offset, Tool__Fillet, Tool__Chamfer. Their adapter names the
            // tool for the action, so a tenth tool is a row in the key file and
            // nothing here. A held key counts once: picking Join up again would
            // let go of the line it is holding.
            // ------------------------------------
            default: {
                const vectorTool = Na__LeVec__ToolForAction(match.action);
                if (!vectorTool) return;
                event.preventDefault();
                if (!event.repeat) Na__LeTools__SetTool(vectorTool);
                return;
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Keyboard
    // ------------------------------------------------------------
    export {
        Na__LeTools__DeleteSelection,
        Na__LeTools__DeleteVertices,
        Na__LeTools__ShiftRedraw,
        Na__LeTools__CopyKey,
        Na__LeTools__Rerun,
        Na__LeTools__OnKey
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
