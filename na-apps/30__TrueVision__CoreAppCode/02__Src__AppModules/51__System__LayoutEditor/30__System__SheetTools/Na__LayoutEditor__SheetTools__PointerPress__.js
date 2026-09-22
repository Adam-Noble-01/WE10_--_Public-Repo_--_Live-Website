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
// - The tool follows the press. On text, a vector, a leader's bubble, note or
//   curve, or a group, Select picks the Move tool up and the press carries on
//   into the drag; on anything else a Move that came up by itself goes back
//   down. A press that picks, and the second press of a double click, travel
//   further before they move anything (drag.pick).
// - OnDoubleClick: drops a door toggle still waiting, then finishes a
//   polyline being drawn, steps inside a group, a vector or a dimension, edits
//   the text, the dimension value or the leader text under the pointer, or
//   enters or leaves a viewport's content. Never after a press that travelled.
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
// 22-Sep-2026 - Version 1.9.0
// - Shift-click inserting a vertex on a vector with holes (the vector tools'
//   Boolean section) sends the hole starts that move up with it
//   (Na__LeShapeGeo__HolesAfterInsert). A plain vector's patch is unchanged.
//
// 22-Sep-2026 - Version 1.8.0
// - THE MOVE ANCHOR (Na__LayoutEditor__MoveAnchor__). A Ctrl+click that leaves
//   ONE item or group selected puts the red cross in the middle of its box and
//   picks the Move tool up (ArmAnchor, run on the release, so a Ctrl-drag is
//   still only a copy; Anchorable refuses a locked item and anything inside an
//   open vector or dimension). A press on the cross, with Select or Move,
//   comes before everything else and re-places it (a 'moveanchor' drag); a
//   whole-object move, a set move or a frame move of the item with the cross
//   is carried by it (drag.anchorMm, and a frame's baseMm, so the viewport
//   snap move carries the frame by the cross). A double click on the cross
//   puts it back in the middle.
//
// 22-Sep-2026 - Version 1.7.0
// - TOOL_REGION: a press hands the point to Na__LeRegionTool__Press (an
//   overspill note region, drawn through the Rectangle tool) and captures
//   the pointer, as the Rectangle tool's press does.
//
// 21-Sep-2026 - Version 1.6.0
// - A press on the selected viewport's rotate grip starts a turn: a viewport
//   drag with hit mode 'rotate', held by Na__LeHandles__RotateStart. It is a
//   grip, so the Select tool keeps it, as it keeps the text rotate grip.
//
// 21-Sep-2026 - Version 1.5.0
// - A press with a vector tool up (37__System__VectorTools: Circle, Arc, Trim,
//   Extend, Join, Split, Offset, Fillet, Chamfer) goes to their adapter, the
//   pointer captured as it is for a rectangle. One branch for all nine.
//
// 21-Sep-2026 - Version 1.4.0
// - CTRL-DRAG COPIES (Na__LayoutEditor__SheetTools__CopyDrag__). A press that
//   starts a whole-object move or a frame move marks the drag copyable, and
//   with the key map's CopyDragModifier held (Ctrl) marks it a copy, taking
//   the pick threshold so a Ctrl+click that wobbles never copies. It records
//   the roots a copy would clone. The copy itself is made by the pointer drag
//   unit once the press becomes a drag. Ctrl still adds an unselected item at
//   the press, as before. Nothing is copyable while a vector or a dimension
//   is open.
//
// 21-Sep-2026 - Version 1.3.0
// - A double click on a picture (Sheet Images) opens its crop
//   (Na__LeImgCrop__Open) instead of stepping inside it: a picture's points are
//   its box, and its corners are scaled by grips that are always there.
//
// 19-Sep-2026 - Version 1.2.0
// - SELECT PICKS MOVE UP FOR WHAT IS USUALLY MOVED NEXT. A press on text, a
//   vector, a leader by anything but its endpoint, or a group picks the Move
//   tool up (PicksUpMove, PickUpMove) and the same press carries on into the
//   drag; a press on anything else - a viewport, a dimension, a leader's
//   endpoint, the open vector - puts a Move that came up by itself back down.
//   DragFor is unchanged: it still only asks whether Move is up.
// - SettleAutoMove puts that Move down when the selection stops warranting it
//   without a press (Delete, a cut, an undo, stepping out of or into a
//   container); the sheet tools run it on every model and container change.
// - A PRESS THAT PICKS IS A PICK FIRST (drag.pick): the press that selects
//   something, and the second press of a double click (IsRepeatPress, since a
//   pointerdown has no click count), travel PickDragPx before they move
//   anything. A fast double click always steps inside.
// - OnDoubleClick ignores a double click whose second press travelled - the
//   browser reports one at the end of "click, then at once drag" - and puts a
//   Move that came up by itself down before it opens a text, a leader or a
//   viewport's content. EnterScope does the same for a container.
//
//
// 17-Sep-2026 - Version 1.1.0
// - CONTAINER EDITING. EnterScope steps inside a group, a vector or a dimension
//   (the double click, and Enter from the keys); a leaf container is selected as
//   it opens so its grips are on screen at once, a group is not. A press outside
//   the open container starts a box that, if it never stretches, steps back out
//   (LeaveScope, in the pointer drag unit, from the box release).
// - A press inside a vector that is not on one of its points drops the picked
//   points; a press on a dimension grip marks that grip (it draws red).
// - THE MOVE TOOL IS WHAT MOVES THINGS. DragFor returns null for every
//   whole-object translation unless CanMoveWhole allows it, so with Select up a
//   press picks and a drag does nothing. Grips, crop handles, the drawing inside
//   a viewport being repositioned and the points of an open container are
//   unchanged - they edit an object rather than relocate it. A door on the
//   selected plan still toggles on a click with no Move tool, through a
//   click-only drag record.
// - Several selected items travel together under the Move tool alone.
// - No tool (Escape's resting state) makes a press on the sheet do nothing.
// - A dimension's VALUE keeps its double click (the override box); the line,
//   the ticks and the extension lines step inside to the grips.
//
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Grips, Tools, Plan Doors, Viewport Snap Move, Selection, Menu
    // ------------------------------------------------------------
    import { Na__LeCfg__MatchSelectionModifier, Na__LeCfg__GetGuards, Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
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
    import { Na__LeHandles__CaptureStart, Na__LeHandles__RotateStart } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__HitTest } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab, Na__LeGrips__LeaderGrab, Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__InsertPoint, Na__LeShapeGeo__HolesAfterInsert } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__Place, Na__LeText__BeginEdit, Na__LeText__Commit, Na__LeText__IsEditing, Na__LeText__RotateStart } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Click, Na__LeDim__BeginTextEdit } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Click, Na__LeShape__Finish, Na__LeShape__IsDrawing } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Press } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeVec__IsTool, Na__LeVec__Press } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__.js';   // <-- The vector tools' one door: whichever of the nine is up
    import { Na__LeAreaTool__Press, Na__LeAreaTool__Finish, Na__LeAreaTool__IsDrawing } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__Tool__.js';   // <-- The Area tool: the two above, drawing a measured room
    import { Na__LeRegionTool__Press } from '../50__Feature__Specification/Na__LayoutEditor__NoteRegions__Tool__.js';   // <-- The Region tool: the Rectangle tool, drawing an overspill note region
    import { Na__LeMeasure__Refresh, Na__LeMeasure__Clear } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Press, Na__LeLeader__IsPlacing, Na__LeLeader__BeginEdit } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Click, Na__LeDrop__Hover, Na__LeDrop__MODE_PALETTE, Na__LeDrop__GetMode } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeDoors__ToggleSoon, Na__LeDoors__CancelPending } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeVpMove__GrabAt } from '../28__System__ObjectSnap/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeAnchor__Arm, Na__LeAnchor__Grab, Na__LeAnchor__ForDrag, Na__LeAnchor__HitAt, Na__LeAnchor__Recentre } from '../28__System__ObjectSnap/Na__LayoutEditor__MoveAnchor__.js';   // <-- Ctrl+click: the red cross an item is moved by
    import { Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import {
        Na__LeScope__IsActive,
        Na__LeScope__IsLeafOpen,
        Na__LeScope__GetVectorId,
        Na__LeScope__Enter,
        Na__LeScope__ClearVertices,
        Na__LeScope__VerticesForDrag,
        Na__LeScope__SetGrip
    } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeSelBox__COMBINE_ADD, Na__LeSelBox__COMBINE_REMOVE, Na__LeSelBox__Press, Na__LeSelBox__Combine, Na__LeSelBox__IsActive } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeSelSet__Capture } from './Na__LayoutEditor__SelectionSet__.js';
    import { Na__LeMenu__Close } from './Na__LayoutEditor__ContextMenu__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOL_AREA,
        Na__LeTools__TOOL_REGION,
        Na__LeTools__PICK_TOOLS,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Drag,
        Na__LeTools__Suppressed,
        Na__LeTools__LastPress,
        Na__LeTools__PressTravelled,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteRightPress,
        Na__LeTools__WriteLastPress,
        Na__LeTools__WritePressTravelled
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import {
        Na__LeTools__Tool,
        Na__LeTools__GetTextDefaults,
        Na__LeTools__GetDimensionDefaults,
        Na__LeTools__GetShapeDefaults,
        Na__LeTools__GetLeaderDefaults,
        Na__LeTools__SyncPaletteFrom,
        Na__LeTools__PickUpMove,
        Na__LeTools__PutDownMove,
        Na__LeTools__IsMoveAuto
    } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import {
        Na__LeTools__Tolerance,
        Na__LeTools__ShapeGrabPoint,
        Na__LeTools__CanMoveWhole,
        Na__LeTools__PicksUpMove,
        Na__LeTools__SelectionPicksUpMove,
        Na__LeTools__ShapeGrabFor,
        Na__LeTools__DimensionGrabFor,
        Na__LeTools__ShapeInsertHit,
        Na__LeTools__Resolve,
        Na__LeTools__Record,
        Na__LeTools__IsViewportLocked,
        Na__LeTools__DoorAt,
        Na__LeTools__CarryTarget
    } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    import { Na__LeTools__SetEditingViewport } from './Na__LayoutEditor__SheetTools__ContentEditing__.js';
    import { Na__LeTools__IsViewportMoveDrag, Na__LeTools__IsMoveDrag } from './Na__LayoutEditor__SheetTools__PointerDrag__.js';
    import { Na__LeImgCrop__Open } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Crop__.js';   // <-- A double click on a picture opens its crop
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
    // MOVING A WHOLE ITEM IS THE MOVE TOOL'S JOB AND NOBODY ELSE'S. With Select
    // up, a press picks what is under it and a drag does nothing at all, so a
    // stray drag can no longer shift a viewport or a dimension by a millimetre
    // without anyone noticing. Press M, and the four-way cursor says the next
    // drag will move something. For text, vectors, leaders and groups the press
    // has ALREADY picked Move up by the time this runs (OnDown, PicksUpMove), so
    // the rule below is unchanged and still the only rule: it simply finds the
    // Move tool up more often than it used to.
    //
    // What Select keeps is everything that edits an item rather than relocating
    // it: the crop handles, a dimension's grips, a leader's tip and head, the
    // rotate grip, the drawing inside a viewport being repositioned, and the
    // points of the vector that is open for editing. Those are small, deliberate
    // targets - they are not what gets nudged by accident.
    // ------------------------------------------------------------
    function Na__LeTools__DragFor(sheet, found, pointMm) {
        const record = Na__LeTools__Record(sheet, found);
        if (!record) return null;
        const tol    = Na__LeTools__Tolerance();
        const moving = Na__LeTools__CanMoveWhole();                          // <-- The Move tool, unless the config has turned the catch off
        if (found.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return null;
            if (found.hit && found.hit.mode === 'rotate') return { kind : 'annotation', id : found.id, mode : 'rotate', rotate : Na__LeText__RotateStart(record, pointMm) };   // <-- The rotate grip turns it
            if (!moving) return null;
            return { kind : 'annotation', id : found.id, start : { x : record.Annotation__PosXMm, y : record.Annotation__PosYMm } };
        }
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return null;
            const mode = Na__LeTools__DimensionGrabFor(sheet, record, pointMm, tol);   // <-- A grip only inside the open dimension
            Na__LeScope__SetGrip(mode);                                      // <-- The grip being held reads red, as a picked vertex does
            if (mode === 'whole' && !moving) return null;
            return { kind : 'dimension', id : found.id, mode : mode,
                     start : { sx : record.Dimension__StartXMm, sy : record.Dimension__StartYMm, ex : record.Dimension__EndXMm, ey : record.Dimension__EndYMm,
                               offset : record.Dimension__OffsetMm, tdx : record.Dimension__TextDXMm || 0, tdy : record.Dimension__TextDYMm || 0 } };
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return null;
            const grab = Na__LeTools__ShapeGrabFor(record, pointMm, tol);     // <-- A vertex only inside the open vector
            if (grab.mode === 'whole' && !moving) return null;
            const drag = { kind : 'shape', id : found.id, mode : grab.mode, index : grab.index, start : Na__LeShapeGeo__Points(record).map((p) => [ p[0], p[1] ]) };
            if (grab.mode === 'vertex') drag.indices = Na__LeScope__VerticesForDrag(grab.index);   // <-- A press on one of several picked points carries them all
            if (grab.mode === 'whole')  drag.baseMm  = Na__LeTools__ShapeGrabPoint(record, pointMm);
            return drag;
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return null;
            const mode = Na__LeGrips__LeaderGrab(record, pointMm, tol);
            if (mode === 'whole' && !moving) return null;
            return { kind : 'leader', id : found.id, mode : mode,
                     start : { tx : record.Leader__TipXMm, ty : record.Leader__TipYMm, ax : record.Leader__AnchorXMm, ay : record.Leader__AnchorYMm } };
        }
        // VIEWPORT | The Move tool moves it, a handle crops it, and while its
        // content is being edited (double-click) a drag inside moves the drawing
        // instead - which is an edit inside an open container, so Select keeps it.
        if (Na__LeTools__IsViewportLocked(sheet, record)) return null;
        if (found.hit && found.hit.mode === 'rotate') {                      // <-- The rotate grip turns it about the middle of its frame: a grip, so Select keeps it
            return { kind : 'viewport', id : found.id, hit : { mode : 'rotate' }, start : Na__LeHandles__CaptureStart(record), rotate : Na__LeHandles__RotateStart(record, pointMm), baseMm : null };
        }
        const editing = Na__LeSurface__GetEditingViewport() === found.id;
        const hit     = editing ? { mode : 'body' } : ((found.hit && found.hit.mode === 'handle') ? found.hit : { mode : 'border' });
        if (hit.mode === 'border' && !moving) return null;                   // <-- The frame travels under the Move tool alone
        // A press on a point of its own linework carries the viewport by that
        // point (Na__LayoutEditor__ViewportSnapMove__); anywhere else moves the
        // frame the plain way.
        const carry   = Na__LeTools__CarryTarget(sheet, found);
        const grab    = carry ? Na__LeVpMove__GrabAt(sheet, carry, pointMm) : null;
        return { kind : 'viewport', id : found.id, hit : hit, start : Na__LeHandles__CaptureStart(record), baseMm : grab ? { x : grab.x, y : grab.y } : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Inside a Container (a group, or one vector)
    // ------------------------------------------------------------
    // Entering a vector selects it, so its highlight and its points are on
    // screen straight away. Entering a group selects nothing: the point of
    // being inside is to pick its members, and arriving with the group still
    // selected would mean the first thing done inside it moved the lot.
    // Repositioning a viewport's content is a container of its own and cannot
    // be open at the same time.
    //
    // A Move that came up by itself is put down on the way in. It came up for
    // the object as a whole, and stepping inside is the opposite of moving it:
    // inside a vector a press is about its points, and inside a group nothing
    // is selected yet. A Move that was asked for stays up, as it always has.
    // ------------------------------------------------------------
    function Na__LeTools__EnterScope(sheet, found) {
        if (!Na__LeTools__Editable || !sheet || !found) return false;
        if (!Na__LeScope__Enter(sheet, found)) return false;
        Na__LeTools__PutDownMove();
        Na__LeSurface__SetEditingViewport(null);
        Na__LeModel__SetSelection(found.kind === 'group' ? null : { kind : found.kind, id : found.id });   // <-- A leaf container is selected, so its grips and highlight are on screen at once
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Down a Move That Came Up by Itself, Once What It Came Up For Has Gone
    // ------------------------------------------------------------
    // The press keeps the tool in step with what is pressed. This keeps it in
    // step with everything that changes the selection WITHOUT a press: Delete,
    // a cut, an undo that takes the item away, stepping out of a container, a
    // vector or a dimension being opened from the keys or the menu. It only
    // ever puts Move down - picking it up takes a press or a box, so the tool
    // never changes under a hand that is nowhere near the sheet. Never in the
    // middle of a drag or a box, which finish under the tool they began with.
    // Run by the sheet tools on every model and container change.
    // ------------------------------------------------------------
    function Na__LeTools__SettleAutoMove() {
        if (!Na__LeTools__IsMoveAuto() || Na__LeTools__Drag || Na__LeSelBox__IsActive()) return false;
        if (Na__LeTools__SelectionPicksUpMove(Na__LeModel__GetSelectionItems())) return false;
        return Na__LeTools__PutDownMove();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This the Second Press of a Double Click
    // ------------------------------------------------------------
    // A pointerdown carries no click count - only the click that follows it
    // does - so the second press is known the way the browser knows it: the
    // same item, within DoubleClickSlopPx on screen and DoubleClickMs of the
    // press before. It matters because that press must not move what it lands
    // on (see DragFor's pick below): the double click is about to step inside.
    // ------------------------------------------------------------
    function Na__LeTools__IsRepeatPress(event, pressed) {
        const last = Na__LeTools__LastPress;
        if (!last || !pressed || last.key !== pressed.kind + ':' + pressed.id) return false;
        const setup = Na__LeCfg__GetSelectionSetup();
        if ((event.timeStamp - last.time) > setup.doubleClickMs) return false;
        return Math.hypot(event.clientX - last.x, event.clientY - last.y) <= setup.doubleClickSlopPx;
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


    // HELPER FUNCTION | May the Move Anchor Go on This Item
    // ------------------------------------------------------------
    // Only on something that could then be moved: nothing on a locked layer,
    // no locked viewport, and nothing while a vector or a dimension is open -
    // in there a click is about its points. A group answers for its members
    // when a move captures them, as it does for every set move.
    // ------------------------------------------------------------
    function Na__LeTools__Anchorable(sheet, item) {
        if (!sheet || !item || Na__LeScope__IsLeafOpen()) return false;
        if (item.kind === 'group') return true;
        const record = Na__LeTools__Record(sheet, item);
        if (!record) return false;
        if (item.kind === 'viewport') return !Na__LeTools__IsViewportLocked(sheet, record);
        const layerId = record.Annotation__LayerId || record.Shape__LayerId || record.Leader__LayerId || record.Dimension__LayerId || null;
        return !Na__LeModel__IsLayerLocked(sheet, layerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Move Anchor on What a Ctrl+Click Left Selected
    // ------------------------------------------------------------
    // Run when the button comes up without the press having moved. Only a
    // selection of ONE - the item pressed, alone - takes the cross: Ctrl on an
    // item added to others makes a set, and there Ctrl has only ever added.
    // The Move tool comes up with it, whatever the kind: asking for the cross
    // is asking to move the thing, so a viewport or a dimension needs no M.
    // ------------------------------------------------------------
    function Na__LeTools__ArmAnchor(sheet, pressed) {
        const items = Na__LeModel__GetSelectionItems();
        if (!pressed || items.length !== 1 || items[0].kind !== pressed.kind || items[0].id !== pressed.id) return false;
        if (!Na__LeTools__Anchorable(sheet, pressed) || !Na__LeAnchor__Arm(sheet, pressed)) return false;
        Na__LeTools__PickUpMove();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Down
    // ------------------------------------------------------------
    function Na__LeTools__OnDown(event) {
        Na__LeMenu__Close();
        if (event.button === 2) { Na__LeTools__WriteRightPress({ x : event.clientX, y : event.clientY }); return; }   // <-- Remembered so a right click that did not pan opens the menu
        if (Na__LeTools__Suppressed) return;                                 // <-- A pan or a pinch owns this pointer
        if (!Na__LeTools__IsLeft(event)) return;
        Na__LeTools__WritePressTravelled(false);                             // <-- A new press has not travelled yet: the drag and the box say when it has
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

            // FLOOR AREA | The same two ways of drawing, on the Floor Areas
            // layer and carrying a name: point by point it is the Draw tool,
            // corner to corner the Rectangle tool. The pointer is captured for
            // both, because either may be dragged out past the stage's edge.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_AREA) {
                Na__LeAreaTool__Press(sheet, point, event.shiftKey, Na__LeTools__GetShapeDefaults(), event.pointerId);
                Na__LeMeasure__Refresh();
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

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

            // NOTE REGION | The Rectangle tool's press, with a region to make
            // instead of a vector - captured for the same reason.
            // ------------------------------------
            if (Na__LeTools__Tool === Na__LeTools__TOOL_REGION) {
                Na__LeRegionTool__Press(sheet, point, event.shiftKey, event.pointerId);
                Na__LeMeasure__Refresh();
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                return;
            }

            // A VECTOR TOOL | Circle, Arc, Trim, Extend, Join, Split, Offset,
            // Fillet or Chamfer (37__System__VectorTools): the adapter knows
            // which unit answers. The pointer is captured because a circle and
            // a fence can both be dragged out past the stage's edge. The press
            // is always the sheet's, whether or not it landed on anything.
            // ------------------------------------
            if (Na__LeVec__IsTool(Na__LeTools__Tool)) {
                Na__LeVec__Press(Na__LeTools__Tool, sheet, point, { shift : event.shiftKey, ctrl : event.ctrlKey, alt : event.altKey, pointerId : event.pointerId, pressed : true }, Na__LeTools__GetShapeDefaults());
                Na__LeMeasure__Refresh();
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                event.preventDefault();
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

        // THE MOVE ANCHOR'S CROSS IS A GRIP (Na__LayoutEditor__MoveAnchor__).
        // A press on it re-places it, whatever lies under it: it sits in the
        // middle of the item, where a press would otherwise move the item. It
        // selects nothing and opens nothing; the release keeps the new place.
        // ------------------------------------
        if (Na__LeTools__Editable && Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) !== -1) {
            const grab = Na__LeAnchor__Grab(sheet, point);
            if (grab) {
                Na__LeTools__WriteLastPress(null);
                Na__LeTools__WriteDrag(Object.assign(grab, { startMm : point, moved : false, pointerId : event.pointerId, click : null }));
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                event.preventDefault();
                return;
            }
        }

        const found     = Na__LeTools__Resolve(sheet, point);                // <-- Inside an open container this is null for everything outside it
        const editingId = Na__LeSurface__GetEditingViewport();
        if (editingId && (!found || found.kind !== 'viewport' || found.id !== editingId)) Na__LeSurface__SetEditingViewport(null);   // <-- A press anywhere else finishes content editing
        const intent  = Na__LeCfg__MatchSelectionModifier({ Ctrl : !!event.ctrlKey, Shift : !!event.shiftKey, Alt : !!event.altKey, Meta : !!event.metaKey });
        const pressed = found ? { kind : found.kind, id : found.id } : null;
        const again   = Na__LeTools__IsRepeatPress(event, pressed);           // <-- The second press of a double click, read before this press becomes the last one
        const picking = !!pressed && !Na__LeModel__IsSelected(pressed.kind, pressed.id);   // <-- Read before the press changes the selection: this press is what picks it
        Na__LeTools__WriteLastPress(pressed ? { time : event.timeStamp, x : event.clientX, y : event.clientY, key : pressed.kind + ':' + pressed.id } : null);

        // OUTSIDE THE OPEN CONTAINER | One press, two meanings, told apart by
        // whether it moves. A CLICK steps back out - that is the way out of a
        // vector, and the reason Escape need not be. A DRAG draws a box inside
        // the container instead, which is how several vertices are picked at
        // once without sweeping up half the sheet with them. The box knows it
        // is the leaving press (escape), and runs it on release if it never
        // stretched.
        // ------------------------------------
        if (Na__LeScope__IsActive() && !found) {
            Na__LeSelBox__Press(point, event.clientX, event.clientY, event.pointerId, { combine : intent.combine, pending : null, escape : true });
            try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
            event.preventDefault();
            return;
        }

        // INSIDE A VECTOR | A press anywhere but on one of its points drops the
        // points that were picked, the way a press on bare paper drops a
        // selection.
        // ------------------------------------
        if (Na__LeTools__Editable && found && found.kind === 'shape' && !intent.combine && Na__LeScope__GetVectorId() === found.id) {
            const open = Na__LeTools__Record(sheet, found);
            if (open && Na__LeGrips__ShapeGrab(open, point, Na__LeTools__Tolerance()).mode !== 'vertex') Na__LeScope__ClearVertices();
        }
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
        if (!found) { if (!intent.combine) Na__LeModel__SetSelection(null); event.preventDefault(); return; }   // <-- Taken from the browser even when it changes nothing

        // SHIFT-CLICK AN EDGE | Insert a vertex on the OPEN vector, then the
        // same press can drag it. Adding points is editing the inside of a
        // vector, so it is offered where the points are: inside the container,
        // and nowhere else. Shift on a vertex or the fill still toggles the
        // selection, as it always did.
        // ------------------------------------
        if (Na__LeTools__Editable && Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) !== -1 && event.shiftKey && !event.ctrlKey && !event.altKey && found.kind === 'shape') {
            const shape = (Na__LeScope__GetVectorId() === found.id) ? Na__LeTools__Record(sheet, found) : null;
            const hit   = shape && !Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId) ? Na__LeTools__ShapeInsertHit(sheet, shape, point) : null;
            if (hit) {
                Na__LeGrips__HideInsert();
                const start = Na__LeShapeGeo__InsertPoint(Na__LeShapeGeo__Points(shape), hit.index, hit.point);
                Na__LeModel__UpdateShape(sheet, found.id, { points : start, holes : Na__LeShapeGeo__HolesAfterInsert(shape, hit.index) }, true);   // <-- A holed shape's later holes start one further on; undefined leaves a plain one's record as it was
                Na__LeSurface__Refresh('markup');
                Na__LeScope__ClearVertices();                                // <-- The new point is the one being held, on its own
                Na__LeTools__WriteDrag({ kind : 'shape', id : found.id, mode : 'vertex', index : hit.index + 1, indices : [ hit.index + 1 ], start : start, inserted : true,
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
        // EVERY PRESS IN THIS PATH IS THE SHEET'S, and is taken from the browser
        // whether it moves anything or not. A plain pick that fell through
        // without preventDefault left the click to the page, which then offered
        // its own text selection, copy and search menus over the paper.
        // ------------------------------------
        const click = Na__LeTools__PressSelection(pressed, intent.combine);
        event.preventDefault();
        if (!Na__LeModel__IsSelected(pressed.kind, pressed.id)) return;         // <-- Ctrl+Shift on an unselected item: nothing to change, nothing to drag
        if (!Na__LeTools__Editable) { if (click) click(); return; }

        // CTRL+CLICK PUTS THE MOVE ANCHOR ON IT (Na__LayoutEditor__MoveAnchor__).
        // On the release, and only if the press never became a drag: a
        // Ctrl-DRAG is still a copy. ArmAnchor then asks whether the click left
        // this one item selected. A second Ctrl+click puts a moved cross back
        // in the middle.
        // ------------------------------------
        const arm = intent.anchor === true ? () => Na__LeTools__ArmAnchor(sheet, pressed) : null;

        // THE TOOL FOLLOWS WHAT WAS PRESSED | Text, a vector, a leader's bubble
        // or a group is nearly always moved next, so Select picks Move up for it
        // here and THIS press carries straight on into the drag - select and
        // move are one gesture again, without giving up the safety catch. A
        // press on anything else (a viewport, a dimension, a leader's endpoint,
        // the vector that is open) puts a Move that came up by itself back
        // down, so none of those can travel on a Move nobody asked for. Decided
        // after the selection has changed, because one of several selected
        // items answers for the whole selection. A Move that was asked for is
        // not touched by either call.
        // ------------------------------------
        if (Na__LeTools__PicksUpMove(sheet, found, point)) Na__LeTools__PickUpMove();
        else Na__LeTools__PutDownMove();
        const items  = Na__LeModel__GetSelectionItems();
        const asSet  = items.length > 1 || items.some((item) => item && item.kind === 'group');
        const moving = Na__LeTools__CanMoveWhole();
        const drag   = asSet
            ? (moving ? { kind : 'group', group : Na__LeSelSet__Capture(sheet, Na__LeGroup__Expand(sheet, items)) } : null)   // <-- Several selected travel together, under the Move tool
            : Na__LeTools__DragFor(sheet, found, point);

        // NOTHING TO DRAG | The press is a plain pick. A door on the selected
        // plan still closes or opens on a click that does not move, which is a
        // change to the drawing rather than a move of anything, so it never
        // needed the Move tool.
        // ------------------------------------
        if (!drag) {
            if (door && items.length === 1) {
                const doorViewportId = found.id;
                Na__LeTools__WriteDrag({ kind : 'door', id : doorViewportId, startMm : point, moved : false, pointerId : event.pointerId,
                                         click : () => { if (click) click(); Na__LeDoors__ToggleSoon(sheet, doorViewportId, door); } });
                try { Na__LeTools__Stage.setPointerCapture(event.pointerId); } catch (e) { /* capture refused */ }
                event.preventDefault();
                return;
            }
            if (click) click();
            if (arm) arm();                                                  // <-- Nothing can drag from here, so the click is already a click
            return;
        }
        drag.startMm   = point;
        drag.moved     = false;
        drag.pointerId = event.pointerId;
        drag.click     = click;                                              // <-- Run if the button comes up without a move
        // A PRESS THAT PICKS IS A PICK FIRST. The press that selects something,
        // and the second press of a double click, must travel PickDragPx on
        // screen before it moves anything (the pointer drag unit reads this),
        // so a pick with a wobble in it never nudges a note and a fast double
        // click always steps inside instead of shifting what it landed on. A
        // press on something already selected moves at the ordinary threshold.
        drag.pick      = again || picking;
        // CTRL CARRIES A COPY (Na__LayoutEditor__SheetTools__CopyDrag__, SketchUp
        // LayOut's Ctrl-drag). Only what a move carries whole can be copied - a
        // whole-object move, or a frame moved by its border - and nothing while
        // a vector or a dimension is open. The press only marks it: the copy is
        // made once the press becomes a drag, so a Ctrl+click never leaves one
        // behind, and a press that starts as a copy is a pick first, travelling
        // PickDragPx before it copies anything. roots are what a copy clones:
        // the item pressed, or the whole selection a set drag carries.
        drag.copyable  = (Na__LeTools__IsMoveDrag(drag) || Na__LeTools__IsViewportMoveDrag(drag)) && !Na__LeScope__IsLeafOpen();
        drag.copy      = drag.copyable && intent.copy === true;
        drag.roots     = asSet ? items.map((item) => ({ kind : item.kind, id : item.id })) : [ { kind : found.kind, id : found.id } ];
        if (drag.copy) drag.pick = true;
        if (door && items.length === 1) {
            const viewportId = found.id;
            drag.click = () => { if (click) click(); Na__LeDoors__ToggleSoon(sheet, viewportId, door); };   // <-- A click on a door, not a move: close or open it
        }
        if (arm) { const then = drag.click; drag.click = () => { if (typeof then === 'function') then(); arm(); }; }   // <-- The Ctrl+click that sets the move anchor

        // CARRIED BY THE MOVE ANCHOR. A move of the one item that has the red
        // cross on it - moved whole, as a set, or a frame - is carried by the
        // cross: the pointer drag unit lands the cross, and only the cross, on
        // what it snaps to. A frame is handed the cross as the point it is
        // carried by, so the viewport snap move carries it, tracking and all.
        // The place on the box goes with it, for a copy made on the way.
        // ------------------------------------
        const anchor = (Na__LeTools__IsMoveDrag(drag) || Na__LeTools__IsViewportMoveDrag(drag)) ? Na__LeAnchor__ForDrag(sheet, items) : null;
        if (anchor) {
            drag.anchorMm    = { x : anchor.x, y : anchor.y };
            drag.anchorPlace = { fx : anchor.fx, fy : anchor.fy, ox : anchor.ox, oy : anchor.oy };
            if (drag.kind === 'viewport') drag.baseMm = { x : anchor.x, y : anchor.y };
        }
        Na__LeTools__WriteDrag(drag);
        Na__LeGrips__HideInsert();
        Na__LeTools__Stage.setPointerCapture(event.pointerId);
        if ((drag.kind === 'shape' && drag.mode === 'vertex') || Na__LeTools__IsViewportMoveDrag(drag) || Na__LeTools__IsMoveDrag(drag)) Na__LeMeasure__Refresh();   // <-- The box reads a vertex, a viewport or a whole-object move while it is held
        event.preventDefault();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Click: Finish a Shape, Edit Text or a Value, or Enter a Viewport's Content
    // ------------------------------------------------------------
    function Na__LeTools__OnDoubleClick(event) {
        Na__LeDoors__CancelPending();                                         // <-- The two clicks of a double click never toggle a door
        if (!Na__LeTools__Editable || event.button !== 0) return;

        // A PRESS THAT TRAVELLED WAS A DRAG, NOT THE SECOND CLICK. The browser
        // counts clicks when the button goes DOWN - near the last press, soon
        // after it - and never looks at how far the pointer went before it came
        // up. So "click to pick, then straight away drag it across the sheet"
        // ends in a double click as far as the browser is concerned, and would
        // open the text or step inside the vector that had just been moved. Now
        // that a pick and a move are one gesture that is an everyday sequence,
        // and it means a move and nothing else.
        // ------------------------------------
        if (Na__LeTools__PressTravelled) return;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeTools__Tool === Na__LeTools__TOOL_AREA) { if (Na__LeAreaTool__IsDrawing()) { event.preventDefault(); Na__LeAreaTool__Finish(sheet); } return; }   // <-- A double click closes the room, where it would leave a polyline open
        if (Na__LeTools__Tool === Na__LeTools__TOOL_DRAW) { if (Na__LeShape__IsDrawing()) { event.preventDefault(); Na__LeShape__Finish(sheet, false); } return; }
        if (Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) === -1) return;

        // THE MOVE ANCHOR'S CROSS GOES BACK IN THE MIDDLE of its item's box, and
        // the double click is spent on that: it lies over the item, which a
        // double click would otherwise step inside or open.
        // ------------------------------------
        if (Na__LeAnchor__HitAt(sheet, point)) { event.preventDefault(); Na__LeAnchor__Recentre(sheet); return; }
        const found = Na__LeTools__Resolve(sheet, point);

        // A PICTURE OPENS ITS CROP (Sheet Images). It has no points to step
        // inside to - its points are its box - and the crop is the one edit a
        // picture has beyond its corner grips. Open returns false for any
        // shape that is not a picture, which goes on as it always did.
        // ------------------------------------
        if (found && found.kind === 'shape' && Na__LeImgCrop__Open(sheet, found.id)) { event.preventDefault(); return; }

        // STEP INSIDE | A group opens as a group, so the next double click can
        // open something inside it; a vector or a dimension opens as itself, and
        // from there the sheet is faded out and only its own points answer a
        // press. This is tested BEFORE the text editors below, so a grouped note
        // is opened up to rather than typed into - the group is what a single
        // click selected, so it is what a double click should step into.
        //
        // A DIMENSION'S VALUE IS THE EXCEPTION. Double-clicking the number has
        // always opened the override box and still does, whether the dimension
        // is open or not; double-clicking the line, the ticks or the extension
        // lines is what steps inside to the grips. Both readings of "double
        // click a dimension" are true, and this is which is which.
        // ------------------------------------
        const onValue = !!(found && found.kind === 'dimension'
            && Na__LeGrips__DimensionGrab(Na__LeTools__Record(sheet, found), point, Na__LeTools__Tolerance(), sheet) === 'text');
        if (!onValue && Na__LeTools__EnterScope(sheet, found)) { event.preventDefault(); return; }

        // TYPING INTO IT IS STEPPING INSIDE IT TOO. The first click of this
        // double click picked the text or the leader and brought Move up with
        // it; the double click says the words were wanted, not a move, so the
        // Move that came up by itself goes back down before the field opens
        // (EnterScope above does the same for a group, a vector, a dimension).
        // ------------------------------------
        const markup = Na__LeMarkup__HitTest(sheet, point, Na__LeTools__Tolerance());
        if (markup && found && markup.kind === found.kind && markup.id === found.id) {
            Na__LeTools__PutDownMove();
            if (markup.kind === 'annotation')     Na__LeText__BeginEdit(markup.id);
            else if (markup.kind === 'dimension') Na__LeDim__BeginTextEdit(markup.id);
            else if (markup.kind === 'leader')    Na__LeLeader__BeginEdit(markup.id);
            return;
        }
        if (!found || found.kind !== 'viewport') return;
        event.preventDefault();
        Na__LeTools__PutDownMove();
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
        Na__LeTools__OnDoubleClick,
        Na__LeTools__EnterScope,
        Na__LeTools__SettleAutoMove
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
