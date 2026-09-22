// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - POINTER DRAG
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__PointerDrag__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Pointer Drag
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The pointer after the press: previews and hover, the drag through the model, the release, a typed length along a drag, and the hand-over to navigation
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - OnMove: remembers the last point and Shift. With no drag of its own in
//   flight it drives a selection box being dragged out, the preview of the
//   Dimension, Draw, Rectangle or Leader tool, the eyedropper's hover, or the
//   Select tool's hover: the point a press would carry a viewport by
//   (CarryTarget, through Na__LayoutEditor__ViewportSnapMove__), the insert
//   diamond and the cursor.
// - A drag starts once it passes the drag threshold, and ApplyDrag moves the
//   item through the model in silent updates: several items together, a
//   viewport (moved, carried by a point of its linework, cropped or its
//   drawing panned), text (moved or turned), a shape (a vertex, or the whole
//   shape snapped by a vertex or its grab point), a leader (the tip, the head
//   or the whole) or a dimension (an end, the line's offset, the value or the
//   whole). The drag of a press on a door of a locked plan moves nothing.
// - OnUp: a selection box (BoxUp), a rectangle (RectangleUp) or a leader
//   (LeaderUp) being dragged out hears the release first. FinishDrag then
//   puts the snap move's frame and guides away, closes the drag and announces
//   the change once, or runs the press's click (a door toggle among them)
//   when the pointer never moved.
// - A VERTEX BEING DRAGGED TAKES THE ARROW-KEY AXIS LOCK, the same one the
//   placing tools draw against: the lock beats the snap (the snapped point
//   still gives the coordinate along the axis) and the rubber band takes the
//   locked axis's colour, so the constraint holds with nothing held down and
//   the length can be typed. IsVertexDrag and RerunVertexDrag let the keys
//   take the lock without waiting for the next mouse move.
// - For the Measurements box: GetVertexDrag and GetViewportDrag read a vertex
//   or a viewport frame drag, TypeVertexLength and TypeViewportLength put it
//   a typed distance along the drag and finish it, and IsViewportMoveDrag
//   says whether a drag is moving a frame.
// - A TYPED VERTEX LENGTH STAYS LIVE AFTER ENTER. VertexRetypable and
//   GetVertexRetype keep the move on offer - same vertex, same direction,
//   measured from where it started - so a figure that came out wrong is
//   corrected by typing the right one rather than undone, the way a landed
//   rectangle's size can still be retyped. The run ends when the tool changes
//   or when anything else touches the shape.
// - SO DOES EVERY OTHER MOVE, AND A MOUSE-MADE ONE TOO (RememberRetype, run by
//   FinishDrag): a whole-object move and a frame move (MoveRetype, read by
//   GetMoveRetype and GetViewportRetype, landed again by TypeMoveLength and
//   TypeViewportLength), a vertex, a dimension end and a dimension line.
// - SetSuppressed hands the pointer to a navigation gesture: a drag in flight
//   is finished and a half-done placement abandoned.
// - ORTHO MODE (F8) HOLDS EVERY DRAG A HELD SHIFT HOLDS, and a held Shift then
//   frees it: ApplyDrag asks Na__LeOrtho__Resolve wherever it asked Shift for
//   the nearer axis (Na__LayoutEditor__OrthoMode__State__).
// - GRID SNAP (F7) MOVES A DRAG IN WHOLE GRID STEPS by the point it was
//   picked up from, before any axis holds it (GridDragDelta, for the drags
//   with no snap of their own; a vertex, an end or a tip snaps to the grid
//   through Na__LeOsnap__Snap).
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ listens on the stage with OnMove and OnUp
//   (pointerup and pointercancel), hands the Measurements box the drag
//   readings and typed lengths, and re-exports SetSuppressed for the PC and
//   touchscreen control modules.
// - Na__LayoutEditor__SheetTools__PointerPress__ asks IsViewportMoveDrag.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : The carry by a point (Na__LayoutEditor__ViewportSnapMove__) and the door drag are TrueVision's own.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.17.0
// - TOOL_REGION: the move stretches a note region's rubber box
//   (Na__LeRegionTool__Move) and the release lands it (RegionUp), exactly as
//   for the Rectangle tool it draws through.
//
// 21-Sep-2026 - Version 1.16.0
// - A viewport drag on its rotate grip turns the viewport about the middle of
//   its frame (Na__LeHandles__RotateTo), Shift holding quarter turns; it
//   announces once on release, one undo step, like every other drag. It has
//   no dead zone (DragStartMm): nothing opens on a double click there.
//
// 21-Sep-2026 - Version 1.15.0
// - A move and a release with a vector tool up (37__System__VectorTools) go to
//   their adapter: the move draws the tool's preview and says which cursor the
//   stage carries, and the release lands a circle or a fence that was dragged
//   out (VectorUp). One branch each for all nine tools; ApplyDrag is untouched.
//
// 21-Sep-2026 - Version 1.14.0
// - ALL THE SNAPPING IS IN ITS OWN FOLDER NOW (28__System__ObjectSnap), and
//   ApplyDrag calls into it: Na__LeOsnap__Snap from its Search unit, the
//   whole-vector and whole-selection snaps from its Moves unit
//   (Na__LeOsnap__ShapeTranslation and GroupTranslation, which were this
//   folder's SnapShapeTranslation and SnapGroupTranslation) and the grid step
//   from its GridMoves unit (Na__LeOsnap__GridDragDelta). The code they run is
//   the code that was here.
// - The marker's colour is no longer this module's to choose: the dimension
//   end's orange tone is gone, and the marker says what the point belongs to.
// - A PERPENDICULAR NEEDS A POINT TO BE SQUARE FROM. A dragged vertex hands the
//   snap the vertices either side of it (VertexNeighbours) and a dragged
//   dimension end its other end, so the new Perpendicular mode can put an edge,
//   or a measured span, square on to a line of the drawing.
//
// 21-Sep-2026 - Version 1.13.0
// - SKETCHUP'S COPY ARRAYS (Na__LayoutEditor__SheetTools__CopyDrag__).
//   TypeMoveArray takes 3x or /3 for a Ctrl-drag copy that is still on offer:
//   the copies are built silently, the record told where everything landed and
//   what the selection will be BEFORE anything is announced, then announced
//   once - one undo step, and the copy stays on offer. CanMoveArray tells the
//   Measurements box when x, * and / may begin a value. A count typed while
//   the copy is still on the pointer lands it where it is first, as a typed
//   length does, then arrays it.
// - RetypeMove lands through LandExact (its two landings, lifted out and shared
//   with the array) and, with an array, spaces its copies out again from the
//   new distance before the one announce. LandExact's group landing leaves out
//   ApplyDrag's refresh of the box, which found the move half landed mid-commit.
// - The record's landed signature takes in the array's copies (RecordLanded):
//   moving, deleting or undoing one of them ends the run.
//
// 21-Sep-2026 - Version 1.12.0
// - THE MEASUREMENTS BOX READS A WHOLE-OBJECT MOVE LIVE. ApplyDrag refreshed
//   the box for a vertex, a dimension end, a viewport frame and a selection
//   moved as one, never for a vector, a note, a leader or a dimension moved
//   whole - so it woke on the press and sat on its first reading, or on the
//   one an arrow key or Shift last forced, for the rest of the drag (proved on
//   PS01: locked at 1,000 mm while the vector went on to 2,250). OnMove now
//   refreshes it after every step of such a drag.
// - A PRESS IS NOT YET A DRAG. GetMoveDrag, GetVertexDrag and GetViewportDrag
//   fell back to the last pointer point before anything had moved, which can
//   be anywhere - the box read 14,618.5 mm at a press. The fallback now waits
//   for the drag threshold.
// - THE LAST MOVE STAYS ON OFFER TO A TYPED VALUE - SketchUp's rule. When a
//   drag lets go, RememberRetype keeps what it moved: a whole-object move or a
//   frame move in the new MoveRetype record, a vertex, a dimension end or a
//   dimension line in the records a typed value already wrote. So a value
//   typed after the mouse lets go lands the thing exactly that far along the
//   line it went, and every value after a typed one lands it again from where
//   it STARTED (1000, then 1200, is 1200) - TypeMoveLength and
//   TypeViewportLength take a value with no drag in hand (RetypeMove), as
//   TypeVertexLength always has. MoveRetypable ends the run when anything else
//   happens: another selection, another move, another tool, Escape, an undo or
//   any other change to what was moved. GetMoveRetype and GetViewportRetype
//   read it for the box. Every value is exact - no snap, grid, Shift or Ortho.
//
// 21-Sep-2026 - Version 1.11.0
// - CTRL-DRAG CARRIES A COPY (Na__LayoutEditor__SheetTools__CopyDrag__, SketchUp
//   LayOut's gesture). The moment a press crosses the drag threshold, OnMove
//   runs SyncCopyDrag: when the press held Ctrl, or Ctrl has gone down since,
//   the original goes back where it started, a clone is made in its place and
//   the drag is pointed at the clone. ApplyDrag is untouched and carries the
//   copy exactly as it carries a move - lock, Shift, Ortho, the grid, the snap,
//   a viewport's carry by a point and a typed length included - and the
//   release announces it once, as one undo step. A press that never crosses
//   the threshold makes no copy.
//
// 21-Sep-2026 - Version 1.10.0
// - The drawing grid (Na__LayoutEditor__DrawingGrid__): ApplyDrag hands the
//   drag to Na__LeTools__GridDragDelta before anything else. While Grid Snap
//   is on (F7), a text item, a leader moved whole or by its head, a dimension
//   moved whole, a viewport frame moved plain or by a crop handle, and a
//   vector moved under an arrow-key lock travel so the point they were picked
//   up from lands on the nearest grid point - LayOut's rule. The lock, Shift
//   and Ortho then hold it to their axis, so a held move still moves in whole
//   grid steps along it. A typed length is exact and never touched; with Grid
//   Snap off the delta comes back untouched.
//
// 21-Sep-2026 - Version 1.9.0
// - Ortho mode (F8, Na__LayoutEditor__OrthoMode__): ApplyDrag works out
//   `ortho` once - Na__LeOrtho__Resolve(shift), Ortho XOR Shift, and nothing
//   for a typed (exact) length - and every line that asked Shift to hold the
//   nearer axis asks that instead: a whole-object or group move, a plain or
//   carried viewport frame, a vertex, a vector's grab snap, a dimension end.
//   Shift itself still reaches DragPatch (a viewport handle) and the text
//   rotate grip, where it means something else. With Ortho off every drag is
//   exactly as it was; with it on each is held as a held Shift held it, and a
//   held Shift frees it.
//
// 21-Sep-2026 - Version 1.8.0
// - OnMove does nothing while a pan is in flight (the stage carries
//   na-le-stage--panning) and no drag is under way: a pan carries the paper
//   with the pointer, so the hover, the snapped rubber band and the hit test
//   were being worked out again on every move for a point that never changed.
//
// 20-Sep-2026 - Version 1.7.0
// - A VIEWPORT FRAME TAKES THE ARROW-KEY AXIS LOCK, which it never had.
//   IsMoveDrag deliberately excludes a viewport - it has its own reading and
//   its own typed length - and that exclusion was also, silently, the gate the
//   arrow keys tested, so an arrow pressed mid-move fell through to the nudge
//   and walked the very frame being dragged. RerunViewportDrag is the frame's
//   own way back in, and IsViewportMoveDrag now defaults to the drag in flight
//   the way IsMoveDrag does, so it can be asked with nothing.
// - ApplyDrag hands the CONSTRAINED delta to a plain border move (no grabbed
//   point: a 3D or raster viewport, snapping off, or a press away from the
//   linework), which is also the first time Shift has held such a frame to an
//   axis at all - DragPatch's border branch ignores the flag. A handle and a
//   body pan still get the raw delta, because Shift means something else to
//   each of them. A carried frame is held inside Na__LeVpMove__Solve instead,
//   where the snap and the tracking lines are.
// - GetViewportDrag reads along the locked axis, so the Measurements box is
//   right from the moment the key is pressed rather than on the next move.
//
// 19-Sep-2026 - Version 1.6.0
// - DragStartMm: a press marked `pick` - the press that selects something, or
//   the second press of a double click - travels PickDragPx on screen before it
//   moves anything, where a double click means something (a whole-object move,
//   a viewport's frame or content, a leader, a dimension's value). Everything
//   else keeps DragThresholdMm. A pick never nudges; a double click never
//   shifts what it lands on.
// - FinishDrag and BoxUp mark a press that travelled (PressTravelled), so the
//   press unit can ignore the double click the browser reports at the end of
//   "click, then at once drag".
// - A box that leaves only text, vectors, leaders and groups selected picks
//   the Move tool up, as a press on one of them does.
//
// 18-Sep-2026 - Version 1.5.0
// - RefreshBrokenTooltip: the Select/Move hover pass explains a broken
//   specification bubble (Na__LeLeadGeo__IsBroken) next to the pointer,
//   through Na__LayoutEditor__SheetTools__HoverTooltip__, in the same words
//   the Leaders panel already uses (LeaderSpecBroken). Hidden by default
//   every move and while a drag is in flight, shown only while the pointer
//   sits over one.
//
// 17-Sep-2026 - Version 1.4.0
// - A WHOLE-OBJECT MOVE IS A MEASURABLE, LOCKABLE DRAG AGAIN, at the top level
//   where it always was. IsMoveDrag names it (one item by its body, or a whole
//   multi-item selection - never a grip, and never a viewport frame, which has
//   its own pair), GetMoveDrag reads the distance ACTUALLY applied so a snapped
//   or locked move reads back what it did, TypeMoveLength lands it a typed
//   distance along that direction exactly, and RerunMoveDrag redraws it when an
//   arrow key takes or releases the axis. ApplyDrag honours the lock over
//   Shift's guess, records appliedMm, draws the band in the axis's colour, and
//   takes an `exact` flag that keeps a typed value clear of the snap.
//
//
// 17-Sep-2026 - Version 1.3.0
// - A TYPED LENGTH CARRIES EVERY PICKED POINT. WriteVertexAlong took only the
//   grabbed index, so a value typed over a boxed run of corners moved that one
//   and wrote every other picked corner BACK to where it started - the run
//   previewed moving together and landed one. It now carries the whole picked
//   set by the same distance, and the retype record keeps the ORIGINAL run of
//   points (origin) beside the run it just wrote, so a correction measures from
//   where the points began rather than stacking on the value before it.
//
//
// 17-Sep-2026 - Version 1.2.0
// - Several picked vertices travel together: the point under the pointer snaps
//   and reads the axis lock, the rest move by exactly however far it went, so a
//   boxed run of corners keeps its shape (drag.indices, from the edit scope).
// - LeaveScope: the way out of a container, run by the box release when a press
//   outside one never stretched into a box. The press is spent on leaving.
// - BoxUp routes by container: inside a vector the box takes VERTICES and hands
//   them to the edit scope, inside a group it takes members as they are (no
//   remap to the outermost group), and a box that caught nothing leaves the
//   container exactly as it was.
// - The hover pass runs for Move as well as Select.
//
//
// 17-Sep-2026 - Version 1.1.0
// - A vertex drag takes the arrow-key axis lock, and shows it on the band.
// - A typed vertex length can be retyped until the tool changes
//   (VertexRetypable, GetVertexRetype, WriteVertexAlong).
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Grips, Tools, Viewports, Snapping, Viewport Snap Move, Selection
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDimensionSetup, Na__LeCfg__GetSelectionSetup, Na__LeCfg__FormatLabel, Na__LeCfg__GetMeasureSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__GetShapeById,
        Na__LeModel__UpdateLeader,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__GetZoom, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeHandles__DragPatch, Na__LeHandles__RotateTo } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeGrips__HideInsert, Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeLeadGeo__IsBroken, Na__LeLeadGeo__Lines } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeHoverTip__Show, Na__LeHoverTip__Hide } from './Na__LayoutEditor__SheetTools__HoverTooltip__.js';
    import { Na__LeText__RotateTo } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Move, Na__LeDim__OffsetFor, Na__LeDim__ShowInference } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeDimGeo__OffsetKeepingLine, Na__LeDimGeo__SpanMm, Na__LeDimGeo__HORIZONTAL, Na__LeDimGeo__VERTICAL } from '../15__Core__Markup/Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShape__Move } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeAreaTool__Move, Na__LeAreaTool__Release, Na__LeAreaTool__Cancel, Na__LeAreaTool__IsRectangle } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__Tool__.js';
    import { Na__LeRegionTool__Move, Na__LeRegionTool__Release, Na__LeRegionTool__Cancel } from '../50__Feature__Specification/Na__LayoutEditor__NoteRegions__Tool__.js';   // <-- An overspill note region, drawn through the Rectangle tool
    import { Na__LeMeasure__Refresh } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Move, Na__LeLeader__Release, Na__LeLeader__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Hover } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeVp2d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeOsnap__ShapeTranslation, Na__LeOsnap__GroupTranslation } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Moves__.js';   // <-- A vector, or a selection, moved whole: whichever of its points comes nearest a snap lands on it
    import { Na__LeOsnap__GridDragDelta } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__GridMoves__.js';   // <-- Grid Snap (F7): a drag with no snap of its own moves in whole grid steps
    import { Na__LeTools__SyncCopyDrag, Na__LeTools__BuildCopyArray, Na__LeTools__FollowCopyArray, Na__LeTools__CopyArraySelection } from './Na__LayoutEditor__SheetTools__CopyDrag__.js';   // <-- Ctrl-drag: the copy is made once a press becomes a drag, and arrayed once it lands (3x, /3)
    import { Na__LeAxis__Get, Na__LeAxis__Apply, Na__LeAxis__Hold, Na__LeAxis__Clear } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeOrtho__Resolve } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js';
    import { Na__LeVpMove__Hover, Na__LeVpMove__Solve, Na__LeVpMove__Finish } from '../28__System__ObjectSnap/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeGroup__ResolveItems } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import {
        Na__LeScope__KIND_VERTEX,
        Na__LeScope__IsActive,
        Na__LeScope__IsVectorEdit,
        Na__LeScope__ExitTo,
        Na__LeScope__GetVertices,
        Na__LeScope__SetVertices
    } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeSelBox__Move, Na__LeSelBox__Release, Na__LeSelBox__Cancel, Na__LeSelBox__IsActive, Na__LeSelBox__Combine } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeSelSet__Apply, Na__LeSelSet__Commit } from './Na__LayoutEditor__SelectionSet__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__PICK_TOOLS,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOL_AREA,
        Na__LeTools__TOOL_REGION,
        Na__LeTools__TYPED_MIN_MM,
        Na__LeTools__SAME_MM,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Drag,
        Na__LeTools__Suppressed,
        Na__LeTools__LastPointMm,
        Na__LeTools__ShiftHeld,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteSuppressed,
        Na__LeTools__WriteLastPointMm,
        Na__LeTools__WriteShiftHeld,
        Na__LeTools__VertexRetype,
        Na__LeTools__WriteVertexRetype,
        Na__LeTools__DimEndRetype,
        Na__LeTools__WriteDimEndRetype,
        Na__LeTools__MoveRetype,
        Na__LeTools__WriteMoveRetype,
        Na__LeTools__WritePressTravelled
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tool, Na__LeTools__CancelPlacement, Na__LeTools__PickUpMove, Na__LeTools__GetShapeDefaults } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import { Na__LeVec__IsTool, Na__LeVec__Move, Na__LeVec__Release } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__.js';   // <-- The vector tools' one door
    import {
        Na__LeTools__SelectionPicksUpMove,
        Na__LeTools__RefreshShapeInsert,
        Na__LeTools__Resolve,
        Na__LeTools__Record,
        Na__LeTools__RawHit,
        Na__LeTools__HoverCursor,
        Na__LeTools__CarryTarget
    } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Move, Drag and Release
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pointer Move: Placement Preview, Drag, or Hover Cursor
    // ------------------------------------------------------------
    function Na__LeTools__OnMove(event) {
        // A PAN MOVES THE PAPER WITH THE POINTER, so the paper point under it
        // never changes and a tool's hover or rubber band has nothing new to
        // show. They used to be worked out again on every move all the same -
        // a hit test with Select, a snapped rubber band with Draw or Floor Area
        // (5 ms a move, 41 ms at worst, on RB05) - for the length of the pan.
        // The PC controls mark the stage while a pan is in flight
        // (Na__LePc__PANNING_CLASS); a drag already under way still runs.
        if (!Na__LeTools__Drag && Na__LeTools__Stage && Na__LeTools__Stage.classList.contains('na-le-stage--panning')) return;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        Na__LeTools__WriteLastPointMm(point);                                // <-- An arrow key restretches the band from here
        Na__LeTools__WriteShiftHeld(!!event.shiftKey);

        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            Na__LeHoverTip__Hide();                                          // <-- Shown again below, only over a broken specification bubble
            if (Na__LeSelBox__Move(sheet, point, event.clientX, event.clientY, event.pointerId)) return;   // <-- A selection box is being dragged out
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      { Na__LeRect__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_AREA)      { Na__LeAreaTool__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); Na__LeMeasure__Refresh(); return; }   // <-- Whichever of the two is drawing the room
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_REGION)    { Na__LeRegionTool__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); Na__LeMeasure__Refresh(); return; }   // <-- A note region's rubber box, snapping as a rectangle's does
            if (Na__LeTools__Editable && Na__LeVec__IsTool(Na__LeTools__Tool)) {   // <-- A vector tool: its preview follows the pointer, and it says which cursor to carry (not-allowed over what it cannot edit)
                const carry = Na__LeVec__Move(Na__LeTools__Tool, sheet, point, { shift : event.shiftKey, pointerId : event.pointerId, pressed : (event.buttons & 1) === 1 || event.pointerType === 'touch' }, Na__LeTools__GetShapeDefaults());
                if (carry && Na__LeTools__Stage) Na__LeTools__Stage.style.cursor = carry;
                Na__LeMeasure__Refresh();
                return;
            }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_LEADER)    { Na__LeLeader__Move(sheet, point, (event.buttons & 1) === 1 || event.pointerType === 'touch'); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP)   { Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, Na__LeTools__Resolve(sheet, point, true, true, true)); return; }
            if (Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) === -1) return;   // <-- Move hovers too: its cursor sharpens on a grip like Select's
            const found     = Na__LeTools__Resolve(sheet, point);
            Na__LeTools__RefreshBrokenTooltip(sheet, found, event);          // <-- A red-haloed bubble explains itself on hover
            const grab      = Na__LeVpMove__Hover(sheet, Na__LeTools__CarryTarget(sheet, found), point);   // <-- Marks the point a press would carry the viewport by
            const inserting = Na__LeTools__RefreshShapeInsert(sheet, point, event.shiftKey);
            Na__LeTools__Stage.style.cursor = (inserting || grab) ? 'crosshair' : Na__LeTools__HoverCursor(sheet, found, point);
            return;
        }
        Na__LeHoverTip__Hide();                                              // <-- A drag in flight never shows the hover tip
        const dMm = { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y };
        if (!drag.moved) {
            if (Math.hypot(dMm.x, dMm.y) < Na__LeTools__DragStartMm(drag)) return;
            drag.moved = true;
            Na__LeVp2d__SetInteracting(true);
            Na__LeVp3d__SetInteracting(true);
            document.body.classList.add('na-le-dragging');
            Na__LeTools__SyncCopyDrag(sheet, drag);                          // <-- Ctrl on the press (or since): the copy is made now that it really moves, and the drag carries it instead
        }
        Na__LeTools__ApplyDrag(sheet, drag, dMm, event.shiftKey);
        // A WHOLE-OBJECT MOVE READS LIVE. ApplyDrag refreshes the Measurements
        // box for a vertex, a dimension end, a viewport frame and a selection
        // moved as one, but never did for a vector, a note, a leader or a
        // dimension moved whole: the box woke on the press and then sat on its
        // first reading - or on the one an arrow key or Shift last forced -
        // for the rest of the drag. One refresh here, after every move of
        // every such drag, whatever branch carried it.
        if (Na__LeTools__IsMoveDrag(drag)) Na__LeMeasure__Refresh();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Press Travels Before It Becomes a Drag, in Paper Millimetres
    // ------------------------------------------------------------
    // The ordinary threshold is DragThresholdMm, which works out at barely two
    // pixels on screen at any zoom: right for a press on something already in
    // hand, and far too eager for a press that is really a PICK. Now that
    // Select picks Move up, the press that selects a note is also the start of
    // a possible move, and two pixels of wobble would nudge it; the second
    // press of a double click lands on something Move is already up for, and
    // two pixels of wobble would shift it on the way in. So a press marked
    // `pick` (the press unit marks it) travels PickDragPx ON SCREEN first.
    //
    // ONLY WHERE A DOUBLE CLICK MEANS SOMETHING, which is where the wobble
    // does harm: a whole-object move, a viewport's frame or its content, a
    // leader by any part (its text opens on a double click, tip included) and
    // a dimension's value (its override box does). A vertex, a dimension's
    // measured points, a crop handle and the rotate grip stay as eager as
    // they were - nothing opens there, and precise work wants no dead zone.
    // ------------------------------------------------------------
    function Na__LeTools__DragStartMm(drag) {
        const setup = Na__LeCfg__GetSelectionSetup();
        const plain = setup.dragThresholdMm / Na__LeSurface__GetZoom();
        if (!drag || drag.pick !== true) return plain;
        const opens = Na__LeTools__IsMoveDrag(drag)
            || (drag.kind === 'viewport' && !!drag.hit && drag.hit.mode !== 'handle' && drag.hit.mode !== 'rotate')
            || drag.kind === 'leader'
            || (drag.kind === 'dimension' && drag.mode === 'text');
        if (!opens) return plain;
        return Math.max(plain, setup.pickDragPx / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom()));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Hover Tooltip Over a Broken Specification Bubble, or Hide It
    // ------------------------------------------------------------
    // A leader whose Leader__SpecNoteId points at a note that no longer
    // exists (Na__LeLeadGeo__IsBroken) explains itself next to the pointer,
    // reusing the same wording the Leaders panel shows for a broken link.
    // Anything else under the pointer leaves the tooltip hidden.
    // ------------------------------------------------------------
    function Na__LeTools__RefreshBrokenTooltip(sheet, found, event) {
        if (!found || found.kind !== 'leader') return;
        const record = Na__LeTools__Record(sheet, found);
        if (!record || !Na__LeLeadGeo__IsBroken(record)) return;
        const shown = Na__LeLeadGeo__Lines(record)[0] || '';
        Na__LeHoverTip__Show(Na__LeCfg__FormatLabel('LeaderSpecBroken', 'Its specification note was deleted. The bubble keeps its last code, {code}.', { code : shown }), event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Vertices Either Side of the One Being Dragged
    // ------------------------------------------------------------
    // WHAT A PERPENDICULAR SNAP IS SQUARE TO. A vertex is the end of the edge
    // that arrives from the vertex before it and of the one that leaves for the
    // vertex after it, so while it is dragged either edge may be the one being
    // squared up to a line. Read from where the vector stood at the press: the
    // neighbours of ONE dragged vertex never move. A run of picked vertices
    // carries its neighbours with it, so it offers none - and an open line's
    // end has a neighbour on one side only.
    // ------------------------------------------------------------
    function Na__LeTools__VertexNeighbours(sheet, drag) {
        const pts = Array.isArray(drag.start) ? drag.start : [];
        const n   = pts.length;
        if (n < 2 || !Number.isInteger(drag.index) || (Array.isArray(drag.indices) && drag.indices.length > 1)) return [];
        const shape  = Na__LeModel__GetShapeById(sheet, drag.id);
        const closed = !!shape && shape.Shape__Closed === true && n > 2;
        const out = [];
        [ drag.index - 1, drag.index + 1 ].forEach((i) => {
            const at = closed ? ((i % n) + n) % n : i;
            if (at >= 0 && at < n && at !== drag.index && pts[at]) out.push({ x : pts[at][0], y : pts[at][1] });
        });
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Drag Delta Through the Model (silent)
    // ------------------------------------------------------------
    function Na__LeTools__ApplyDrag(sheet, drag, dMm, shift, exact) {
        if (drag.kind === 'door') return;                                    // <-- A press on a door of a locked plan moves nothing
        // GRID SNAP (F7) FIRST, THEN ANY AXIS. A drag with no snap of its own -
        // a text item, a leader moved whole or by its head, a dimension moved
        // whole, a viewport frame moved plain or cropped, a vector held to an
        // axis by an arrow key - is carried by the point it was picked up from,
        // and that point lands on the grid (Na__LayoutEditor__SheetTools__
        // GridDrag__, LayOut's rule). A lock, Shift or Ortho below then holds the
        // grid step to its axis. A typed length is exact and never touched.
        if (!exact) dMm = Na__LeOsnap__GridDragDelta(sheet, drag, dMm);
        const cursor = { x : drag.startMm.x + dMm.x, y : drag.startMm.y + dMm.y };
        // ORTHO MODE (F8) IS A LATCHED SHIFT. ortho is what every line below
        // that means "hold the nearer axis" asks: Ortho XOR Shift, AutoCAD's rule
        // with its Shift override (Na__LayoutEditor__OrthoMode__State__). shift
        // stays the key itself for the two places it means something else - a
        // viewport handle (DragPatch) and the text rotate grip. A typed length is
        // exact, so it holds nothing.
        const ortho  = !exact && Na__LeOrtho__Resolve(shift);

        // THE DISTANCE A WHOLE-OBJECT MOVE TRAVELS. An arrow key naming the axis
        // beats Shift's guess, exactly as it does for a vertex, and `exact` is a
        // typed length: the value is the answer, so nothing may massage it.
        // `appliedMm` is what actually landed, which is what the Measurements
        // box reads back and what a typed length aims along.
        // ------------------------------------
        //
        // A VIEWPORT FRAME MOVED WITHOUT A GRABBED POINT TAKES THE LOCK HERE.
        // A carried frame gets it inside Na__LeVpMove__Solve, which has the snap
        // and the tracking lines to hold it against; a plain border drag - a 3D
        // or raster viewport, snapping off, or a press away from any linework -
        // has neither, so the lock (and Shift, which this frame never honoured
        // at all) is applied to the delta the same way a whole-object move's is.
        // ------------------------------------
        const axis  = Na__LeAxis__Get();
        const plain = Na__LeTools__IsViewportMoveDrag(drag) && !drag.baseMm;
        const held  = (!exact && axis && (Na__LeTools__IsMoveDrag(drag) || plain))
            ? (() => { const at = Na__LeAxis__Apply(drag.startMm, cursor); return { x : at.x - drag.startMm.x, y : at.y - drag.startMm.y }; })()
            : null;
        const d = exact ? dMm
                : (held ? held
                : (ortho ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm));
        if (Na__LeTools__IsMoveDrag(drag)) {
            drag.appliedMm = { x : d.x, y : d.y };
            if (!exact && axis) Na__LeGrips__ShowBand(drag.startMm, { x : drag.startMm.x + d.x, y : drag.startMm.y + d.y }, axis);   // <-- The band's colour is the lock, so it reads without Shift being held
            else if (!exact) Na__LeGrips__HideBand();
        }
        if (drag.kind === 'group') {
            const lock = axis || (ortho ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? 'x' : 'y') : null);
            const move = exact ? d : Na__LeOsnap__GroupTranslation(sheet, drag, d, lock);
            drag.appliedMm = { x : move.x, y : move.y };
            if (!exact && axis) Na__LeGrips__ShowBand(drag.startMm, { x : drag.startMm.x + move.x, y : drag.startMm.y + move.y }, axis);
            Na__LeSelSet__Apply(sheet, drag.group, move.x, move.y);
            Na__LeMeasure__Refresh();
            return;
        }
        if (drag.kind === 'viewport') {
            const viewport = Na__LeModel__GetViewportById(sheet, drag.id);
            if (!viewport) return;
            // TURNED BY ITS ROTATE GRIP | About the middle of its frame, by as
            // much as the pointer has swung round that middle since the press.
            // Shift is the key itself here, as on the text rotate grip: it holds
            // the turn to quarter turns (Viewport RotateStepDeg), not to an axis.
            // Nothing inside the frame is rendered again - the frame element is
            // turned on the paper - so this is as cheap as a move.
            if (drag.hit && drag.hit.mode === 'rotate') {
                const turn = Na__LeHandles__RotateTo(drag.rotate, cursor, shift);
                if (!turn) return;
                Na__LeModel__UpdateViewport(sheet, drag.id, turn, true);
                Na__LeSurface__Refresh('frames');
                return;
            }
            // CARRIED BY A POINT | The snap move says where the grabbed point
            // goes; the frame moves by however far that is from where it began.
            // A PLAIN BORDER MOVE READS THE CONSTRAINED DELTA, so the arrow lock
            // and Shift reach it; a handle and a body pan keep the raw one,
            // because Shift means something else to each of them inside DragPatch.
            const carried = drag.baseMm ? Na__LeVpMove__Solve(sheet, drag, cursor, ortho) : null;
            const moveBy  = carried ? { x : carried.x - drag.baseMm.x, y : carried.y - drag.baseMm.y }
                          : (Na__LeTools__IsViewportMoveDrag(drag) ? d : dMm);
            const patch = Na__LeHandles__DragPatch(viewport, drag.hit, drag.start, moveBy, { shift : shift });
            if (!patch) return;
            Na__LeModel__UpdateViewport(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('frames');
            if (Na__LeTools__IsViewportMoveDrag(drag)) {
                if (!carried && !exact && axis) Na__LeGrips__ShowBand(drag.startMm, { x : drag.startMm.x + moveBy.x, y : drag.startMm.y + moveBy.y }, axis);   // <-- A carried frame has the tracking guides instead
                else if (!carried) Na__LeGrips__HideBand();
                Na__LeMeasure__Refresh();                                    // <-- The box reads the drag length as the frame moves
            }
            return;
        }
        if (drag.kind === 'annotation') {
            // TURN OR MOVE | The rotate grip turns the text about the middle of
            // its box, Shift holding the steps; anywhere else on the text moves
            // it, Shift holding the axis.
            const patch = drag.mode === 'rotate'
                ? Na__LeText__RotateTo(Na__LeTools__Record(sheet, drag), drag.rotate, cursor, shift)
                : { posXMm : drag.start.x + d.x, posYMm : drag.start.y + d.y };
            if (patch) Na__LeModel__UpdateAnnotation(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        if (drag.kind === 'shape') {
            let points;
            if (drag.mode === 'vertex') {
                const p0    = drag.start[drag.index];
                const snap  = Na__LeOsnap__Snap(sheet, cursor, { kind : 'shape', id : drag.id, index : drag.index }, { from : Na__LeTools__VertexNeighbours(sheet, drag) });   // <-- A vertex jumps to a corner, a midpoint or a crossing, never its own; square to a line FROM either neighbour (Perpendicular)
                // A CONSTRAINT A STRAY SNAP CAN CANCEL IS NOT A CONSTRAINT. Both
                // an arrow lock and a held Shift keep their axis through a snap;
                // the snapped point still supplies the coordinate ALONG that axis,
                // so hovering a corner across the drawing lines the two up without
                // pulling the point off its axis. An arrow names the axis outright
                // (Apply); Shift lets the free cursor pick the nearer one and the
                // snap say how far along it (Hold) - the same pair the tools that
                // place points are drawn with (Na__LayoutEditor__AxisLock__).
                //
                // THIS IS WHY SHIFT LOOKED BROKEN ONCE SEVERAL POINTS WERE PICKED:
                // the snapped point used to win outright, and a run of vertices is
                // dragged across far more geometry than one, so something was
                // nearly always snapping and the axis was nearly always lost.
                const axis  = Na__LeAxis__Get();
                const aim   = { x : p0[0] + dMm.x, y : p0[1] + dMm.y };      // <-- The free cursor: it only chooses WHICH axis Shift holds
                const raw   = snap.snapped ? { x : snap.x, y : snap.y } : { x : p0[0] + (axis ? dMm : d).x, y : p0[1] + (axis ? dMm : d).y };
                const held  = axis ? Na__LeAxis__Apply(p0, raw) : (ortho ? Na__LeAxis__Hold(p0, aim, raw) : raw);
                const moved = [ held.x, held.y ];
                if (axis || ortho) Na__LeGrips__ShowBand(p0, moved, axis);   // <-- Coloured by the locked axis; Shift's band is the plain one, because its axis can still change
                else Na__LeGrips__HideBand();
                // SEVERAL PICKED POINTS TRAVEL TOGETHER. The point under the
                // pointer is the one that snaps and the one the lock is read
                // from; the rest move by exactly however far it went, so a
                // boxed run of corners keeps its shape. On its own it is the
                // single-vertex drag that has always been here.
                const carry  = [ moved[0] - p0[0], moved[1] - p0[1] ];
                const others = Array.isArray(drag.indices) ? drag.indices : [ drag.index ];
                points = drag.start.map((p, i) => {
                    if (i === drag.index) return moved;
                    return others.indexOf(i) === -1 ? [ p[0], p[1] ] : [ p[0] + carry[0], p[1] + carry[1] ];
                });
                Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
                Na__LeSurface__Refresh('markup');
                Na__LeMeasure__Refresh();                                    // <-- The box reads the drag length as the vertex moves
                return;
            } else {
                // A TYPED LENGTH, OR A HELD AXIS, IS THE ANSWER ALREADY: the snap
                // would pull the shape off the distance that was asked for.
                const t = (exact || (Na__LeAxis__Get() && drag.appliedMm))
                    ? { x : d.x, y : d.y }
                    : Na__LeOsnap__ShapeTranslation(sheet, drag, dMm, ortho);   // <-- Any vertex, or the grab, onto the linework; Shift still holds the axis
                if (!exact && !Na__LeAxis__Get()) drag.appliedMm = { x : t.x, y : t.y };   // <-- The snap moved it further than the cursor did: read THAT back
                points  = Na__LeShapeGeo__Translated(drag.start, t.x, t.y);
            }
            Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        if (drag.kind === 'leader') {
            // TIP, HEAD OR WHOLE | The tip re-points and snaps like a vertex; the
            // head moves alone and leaves the tip on what it points at; a grab on
            // the curve carries both.
            const st = drag.start;
            let patch;
            if (drag.mode === 'tip') {
                const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'leader', id : drag.id, index : 'tip' });
                patch = { tipXMm : snap.snapped ? snap.x : st.tx + d.x, tipYMm : snap.snapped ? snap.y : st.ty + d.y };
            } else if (drag.mode === 'anchor') {
                patch = { anchorXMm : st.ax + d.x, anchorYMm : st.ay + d.y };
            } else {
                patch = { tipXMm : st.tx + d.x, tipYMm : st.ty + d.y, anchorXMm : st.ax + d.x, anchorYMm : st.ay + d.y };
            }
            Na__LeModel__UpdateLeader(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('markup');
            return;
        }
        const s = drag.start;
        let patch = null;
        if (drag.mode === 'start' || drag.mode === 'end') {
            const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'dimension', id : drag.id, index : drag.mode }, { from : drag.mode === 'start' ? { x : s.ex, y : s.ey } : { x : s.sx, y : s.sy } });   // <-- The grip jumps to a corner or a midpoint, never its own; square to a line FROM the dimension's other end (Perpendicular)
            // A MEASURED POINT CONSTRAINS LIKE A VERTEX. Same arrow keys, same
            // Shift, same rule that a snap supplies the coordinate along the
            // held axis rather than cancelling it - a dimension end is dragged
            // across other geometry more than anything else on the sheet, so a
            // snap that broke the constraint would break it constantly.
            const p0    = drag.mode === 'start' ? [ s.sx, s.sy ] : [ s.ex, s.ey ];
            const axis  = Na__LeAxis__Get();
            const aim   = { x : p0[0] + dMm.x, y : p0[1] + dMm.y };
            const raw   = snap.snapped ? { x : snap.x, y : snap.y } : { x : p0[0] + (axis ? dMm : d).x, y : p0[1] + (axis ? dMm : d).y };
            const held  = axis ? Na__LeAxis__Apply(p0, raw) : (ortho ? Na__LeAxis__Hold(p0, aim, raw) : raw);
            if (axis || ortho) Na__LeGrips__ShowBand(p0, [ held.x, held.y ], axis);
            else Na__LeGrips__HideBand();
            const px = held.x;
            const py = held.y;
            patch = drag.mode === 'start' ? { startXMm : px, startYMm : py } : { endXMm : px, endYMm : py };
            // AN ORTHO LINE STAYS WHERE IT WAS PUT. Its offset is measured from the
            // start, so re-picking the start would otherwise carry the line with it;
            // an aligned dimension keeps its offset exactly as before.
            const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === drag.id);
            if (dim) {
                const fromStart = { x : s.sx, y : s.sy }, fromEnd = { x : s.ex, y : s.ey };
                patch.offsetMm = Na__LeDimGeo__OffsetKeepingLine(fromStart, fromEnd, s.offset,
                    drag.mode === 'start' ? { x : px, y : py } : fromStart, drag.mode === 'end' ? { x : px, y : py } : fromEnd, dim.Dimension__Orientation);
            }
        } else if (drag.mode === 'offset') {
            const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === drag.id);
            if (!dim) return;
            const result = Na__LeDim__OffsetFor(sheet, dim, cursor);                  // <-- The line lands on a parallel dimension's line when near it
            Na__LeDim__ShowInference(result);
            patch = { offsetMm : result.offsetMm };
        } else if (drag.mode === 'text') {
            let tdx = (s.tdx || 0) + d.x, tdy = (s.tdy || 0) + d.y;
            const minMm = Na__LeCfg__GetDimensionSetup().textLeaderMinMm;
            if (Math.hypot(tdx, tdy) < minMm) { tdx = 0; tdy = 0; }                 // <-- Close enough to home: drop the arc
            patch = { textDXMm : tdx, textDYMm : tdy };
        } else patch = { startXMm : s.sx + d.x, startYMm : s.sy + d.y, endXMm : s.ex + d.x, endYMm : s.ey + d.y };
        Na__LeModel__UpdateDimension(sheet, drag.id, patch, true);
        Na__LeSurface__Refresh('markup');
        if (Na__LeTools__IsDimEndDrag() || Na__LeTools__IsDimOffsetDrag()) Na__LeMeasure__Refresh();   // <-- The box reads the span as an end moves, and the distance off as the line slides
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up: Announce the Change Once
    // ------------------------------------------------------------
    // The rectangle tool hears the release before any drag is closed. The
    // two never overlap in practice, but a key that swaps tools mid-drag
    // must still leave that drag finished rather than stranded.
    // ------------------------------------------------------------
    function Na__LeTools__OnUp(event) {
        if (Na__LeSelBox__IsActive()) Na__LeTools__BoxUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT) Na__LeTools__RectangleUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_AREA) Na__LeTools__AreaUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_REGION) Na__LeTools__RegionUp(event);
        if (Na__LeTools__Editable && Na__LeVec__IsTool(Na__LeTools__Tool)) Na__LeTools__VectorUp(event);
        if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_LEADER) Na__LeTools__LeaderUp(event);
        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        Na__LeTools__FinishDrag(event.pointerId, event.type === 'pointerup');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Rectangle Being Drawn
    // ------------------------------------------------------------
    // A rectangle dragged out from its first corner lands the opposite one
    // where the button lets go. A cancelled pointer - the browser or another
    // gesture took it - lands nothing and abandons the rectangle.
    // ------------------------------------------------------------
    function Na__LeTools__RectangleUp(event) {
        if (event.type === 'pointercancel') { Na__LeRect__Cancel(); return; }
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeRect__Release(sheet, point, event.shiftKey, event.pointerId);
        Na__LeMeasure__Refresh();                                            // <-- A rectangle dragged out has landed: the box reads it
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up With a Vector Tool Up
    // ------------------------------------------------------------
    // A circle dragged out from its centre and a fence dragged across several
    // lines both land where the button lets go; everything else a vector tool
    // does lands on a press, and the adapter simply answers false. A cancelled
    // pointer abandons what was being dragged out.
    // ------------------------------------------------------------
    function Na__LeTools__VectorUp(event) {
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        Na__LeVec__Release(Na__LeTools__Tool, sheet, point, { shift : event.shiftKey, pointerId : event.pointerId, cancelled : event.type === 'pointercancel' }, Na__LeTools__GetShapeDefaults());
        Na__LeMeasure__Refresh();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up While a Room Is Being Drawn
    // ------------------------------------------------------------
    // Only a rectangular room has anything to land on a release; a room drawn
    // point by point lands on a click, as a polyline does, and the adapter
    // simply answers false. A cancelled pointer abandons whichever was in
    // hand - there is no half a room worth keeping.
    // ------------------------------------------------------------
    function Na__LeTools__AreaUp(event) {
        if (event.type === 'pointercancel') { if (Na__LeAreaTool__IsRectangle()) Na__LeAreaTool__Cancel(Na__LeModel__GetActiveSheet()); return; }
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeAreaTool__Release(sheet, point, event.shiftKey, event.pointerId);
        Na__LeMeasure__Refresh();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up While a Note Region Is Being Drawn
    // ------------------------------------------------------------
    // Exactly the rectangle's release: a box dragged out lands where the
    // button lets go, one that never moved waits for a second click, and a
    // cancelled pointer abandons it.
    // ------------------------------------------------------------
    function Na__LeTools__RegionUp(event) {
        if (event.type === 'pointercancel') { Na__LeRegionTool__Cancel(); return; }
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeRegionTool__Release(sheet, point, event.shiftKey, event.pointerId);
        Na__LeMeasure__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Back Out of the Containers a Press Landed Outside Of
    // ------------------------------------------------------------
    // The way out of a vector, and out of a group: click off it. The press is
    // spent on leaving - it does not also select whatever it landed on, which
    // is the SketchUp rule and the one that stops a click outside pulling
    // something else into play. The selection goes with the container, because
    // what was picked inside it is no longer reachable.
    //
    // It lives here, beside the box release that calls it on a press that never
    // stretched into a box, and the keys and the press unit read it from here.
    // ------------------------------------------------------------
    function Na__LeTools__LeaveScope(sheet, pointMm) {
        const raw = Na__LeTools__RawHit(sheet, pointMm);                      // <-- What is really under the pointer, containers ignored
        if (!Na__LeScope__ExitTo(sheet, raw)) return false;
        Na__LeModel__SetSelection(null);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Selection Box
    // ------------------------------------------------------------
    // A box that was dragged out folds what it took into the selection. A press
    // that never became one was a click: on an item that cannot move (a locked
    // viewport, or anything in a read-only session) it selects that item, or
    // flips it with a modifier; on bare paper the press has already cleared the
    // selection. A cancelled pointer takes nothing.
    // ------------------------------------------------------------
    function Na__LeTools__BoxUp(event) {
        if (event.type === 'pointercancel') { Na__LeSelBox__Cancel(); return; }
        const sheet  = Na__LeModel__GetActiveSheet();
        const point  = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        const result = Na__LeSelBox__Release(sheet, point, event.pointerId);
        if (!result) return;
        if (result.dragged) Na__LeTools__WritePressTravelled(true);           // <-- A box that was dragged out is no second click either
        if (Na__LeTools__Stage) { try { Na__LeTools__Stage.releasePointerCapture(event.pointerId); } catch (e) { /* already released */ } }

        // THE PRESS THAT NEVER STRETCHED, OUTSIDE AN OPEN CONTAINER, IS THE WAY
        // OUT OF IT. The box was only ever going to be one of the two, and this
        // is where that is settled.
        // ------------------------------------
        if (!result.dragged && result.escape) { Na__LeTools__LeaveScope(sheet, point); return; }

        // INSIDE A VECTOR the box took points, not items: they go to the edit
        // scope, which owns the vertex selection, and the sheet selection is
        // left exactly as it is (the vector itself stays selected).
        // ------------------------------------
        if (result.dragged && Na__LeScope__IsVectorEdit()) {
            const held  = Na__LeScope__GetVertices().map((index) => ({ kind : Na__LeScope__KIND_VERTEX, id : index }));
            const taken = result.items.filter((item) => item && item.kind === Na__LeScope__KIND_VERTEX);
            Na__LeScope__SetVertices(Na__LeSelBox__Combine(held, taken, result.combine).map((item) => item.id));
            return;
        }

        const taken = result.dragged ? result.items : (result.pending ? [ result.pending ] : null);
        if (!taken) return;
        if (Na__LeScope__IsActive() && !taken.length) return;                 // <-- A box inside a container that caught nothing leaves the container exactly as it was
        const items = Na__LeScope__IsActive() ? taken : Na__LeGroup__ResolveItems(sheet, taken);   // <-- Inside a group the members ARE the answer: no remap to the outermost group
        const chosen = Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), items, result.combine));

        // A BOX PICKS MOVE UP THE WAY A PRESS DOES. What a box takes is as
        // likely to be moved next as what a click takes, so when everything it
        // left selected is text, vectors, leaders or groups the Move tool comes
        // up here too. One viewport or one dimension among them and the tool
        // stays Select: a set moves as one, and those wait for M.
        // ------------------------------------
        if (result.dragged && Na__LeTools__SelectionPicksUpMove(chosen)) Na__LeTools__PickUpMove();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Button Comes Up Over a Leader Being Placed
    // ------------------------------------------------------------
    // A leader dragged out from its point lands its head where the button
    // lets go. A cancelled pointer lands nothing and abandons the leader.
    // ------------------------------------------------------------
    function Na__LeTools__LeaderUp(event) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (event.type === 'pointercancel') { Na__LeLeader__Cancel(sheet); return; }
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (sheet && point) Na__LeLeader__Release(sheet, point, event.pointerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close a Drag Down and Commit What It Moved
    // ------------------------------------------------------------
    // Shared by the pointer release and by the suppression flag, so a
    // navigation gesture that interrupts a drag still leaves the record
    // committed rather than half moved. released is true only for a real
    // pointer up: a press that never moved then runs its click (narrowing or
    // trimming a multi-selection), which a pan taking the pointer never does.
    function Na__LeTools__FinishDrag(pointerId, released) {
        Na__LeOsnap__HideMarker();
        Na__LeGrips__HideInsert();
        Na__LeVpMove__Finish();                                              // <-- Frame back to normal, guides away; used-up tracking points go too
        const drag = Na__LeTools__Drag;
        if (!drag) return;
        // ONLY A VERTEX DRAG'S OWN BAND AND LOCK GO HERE. The band and the axis
        // lock are shared with the tools that are placing points, and a drag
        // finishing is no reason to take a half-drawn polyline's band away.
        if ((drag.kind === 'shape' && drag.mode === 'vertex') || Na__LeTools__IsDimEndDrag() || Na__LeTools__IsMoveDrag(drag) || Na__LeTools__IsViewportMoveDrag(drag)) { Na__LeGrips__HideBand(); Na__LeAxis__Clear(); }
        if (pointerId !== null && pointerId !== undefined && Na__LeTools__Stage) {
            try { Na__LeTools__Stage.releasePointerCapture(pointerId); } catch (e) { /* already released */ }
        }
        Na__LeTools__RememberRetype(drag);                                   // <-- What this drag moved stays on offer to a typed value until something else is done (SketchUp's rule)
        Na__LeTools__WriteDrag(null);
        document.body.classList.remove('na-le-dragging');
        Na__LeMeasure__Refresh();                                            // <-- The box goes on reading what was just moved, for a retype, or back to rest
        if (drag.moved) Na__LeTools__WritePressTravelled(true);              // <-- The double click the browser may still report for this press is not one
        if (!drag.moved) {
            if (drag.inserted) {                                             // <-- Shift-click on an edge: the vertex is in, even if it did not drag
                const sheet = Na__LeModel__GetActiveSheet();
                if (sheet) Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
                return;
            }
            if (released === true && typeof drag.click === 'function') drag.click();
            return;
        }
        Na__LeVp2d__SetInteracting(false);
        Na__LeVp3d__SetInteracting(false);
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return;
        if (drag.kind === 'door')            return;                                                // <-- A door press that moved changed nothing
        if (drag.kind === 'group')           { Na__LeSelSet__Commit(sheet, drag.group); return; }   // <-- Once per kind: one undo step for the lot
        if (drag.kind === 'viewport')        Na__LeModel__UpdateViewport(sheet, drag.id, {}, false);
        else if (drag.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, drag.id, {}, false);
        else if (drag.kind === 'shape')      Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
        else if (drag.kind === 'leader')     Na__LeModel__UpdateLeader(sheet, drag.id, {}, false);
        else                                 Na__LeModel__UpdateDimension(sheet, drag.id, {}, false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drag for the Measurements Box
// -----------------------------------------------------------------------------

    // FUNCTION | The Vertex Being Dragged, for the Measurements Box
    // ------------------------------------------------------------
    // Returns { from, to } in paper millimetres: the vertex where the drag
    // began, and where it is headed (the live point, or the cursor when that
    // has not moved yet). Null while no vertex is held.
    // ------------------------------------------------------------
    function Na__LeTools__GetVertexDrag() {
        const drag = Na__LeTools__Drag;
        if (!drag || drag.kind !== 'shape' || drag.mode !== 'vertex') return null;
        const from = drag.start && drag.start[drag.index];
        if (!from) return null;
        const sheet = Na__LeModel__GetActiveSheet();
        const shape = sheet ? Na__LeModel__GetShapeById(sheet, drag.id) : null;
        const live  = shape ? Na__LeShapeGeo__Points(shape)[drag.index] : null;
        const fromPt = { x : from[0], y : from[1] };
        const livePt = live ? { x : live[0], y : live[1] } : null;
        const run    = livePt ? Math.hypot(livePt.x - fromPt.x, livePt.y - fromPt.y) : 0;
        const cursor = drag.moved ? Na__LeTools__LastPointMm : null;         // <-- Only once the press is a drag: before that the last pointer point can be anywhere (a touch, a hover elsewhere)
        const aim    = (run >= Na__LeTools__TYPED_MIN_MM) ? livePt : (cursor || livePt);
        const to     = (aim && Na__LeAxis__Get()) ? Na__LeAxis__Apply(fromPt, aim) : aim;   // <-- A locked drag reads along its axis, cursor fallback included
        return { from : fromPt, to : to };
    }


    // HELPER FUNCTION | The Vertex a Typed Length Has Just Moved, While Another May Still Move It
    // ------------------------------------------------------------
    // The vertex move stays live after Enter, the way a rectangle's size does
    // (Na__LayoutEditor__RectangleTool__ Retypable): type 2500, see it is too
    // far, type 2000 and the vertex goes there instead - measured from where
    // it started, not from where the last value put it. The record is only
    // good while its shape is still the selection and its points are exactly
    // where that typed value left them, so a nudge, a drag, an undo or
    // anything else touching the shape quietly ends the run.
    // ------------------------------------------------------------
    function Na__LeTools__VertexRetypable(sheet) {
        const record = Na__LeTools__VertexRetype;
        if (!record || !sheet || Na__LeTools__Drag) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape' || selection.id !== record.id) return null;
        const shape = Na__LeModel__GetShapeById(sheet, record.id);
        if (!shape) return null;
        const points = Na__LeShapeGeo__Points(shape);
        if (!Array.isArray(points) || points.length !== record.points.length) return null;
        const untouched = points.every((p, i) => Math.abs(p[0] - record.points[i][0]) <= Na__LeTools__SAME_MM && Math.abs(p[1] - record.points[i][1]) <= Na__LeTools__SAME_MM);
        return untouched ? record : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Retypable Vertex Move, for the Measurements Box
    // ------------------------------------------------------------
    // Reads { from, to } like a live drag, so the box keeps the same reading
    // and stays awake for the next value instead of going grey the moment
    // Enter is pressed. Null once the run has ended.
    // ------------------------------------------------------------
    function Na__LeTools__GetVertexRetype() {
        const record = Na__LeTools__VertexRetypable(Na__LeModel__GetActiveSheet());
        if (!record) return null;
        const moved = record.points[record.index];
        return { from : { x : record.from[0], y : record.from[1] }, to : { x : moved[0], y : moved[1] } };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Vertex a Measured Distance Along a Direction
    // ------------------------------------------------------------
    // Shared by the first typed value and every one after it: the same start,
    // the same direction, a new length. announce is false for the drag's own
    // first landing (FinishDrag announces that one) and true for a retype,
    // which is an undo step of its own.
    // ------------------------------------------------------------
    // EVERY PICKED POINT GOES THE SAME DISTANCE. `origin` is always the
    // ORIGINAL run of points - the drag's start, or the retype record's own
    // copy of it - never the run a previous typed value left behind, so a
    // correction measures from where the points began and the carried ones do
    // not double-count the value before it. Without this a typed length wrote
    // the grabbed point and put every other picked point BACK, which is what
    // made a boxed run of corners preview together and then land one.
    // ------------------------------------------------------------
    function Na__LeTools__WriteVertexAlong(sheet, id, index, origin, from, dir, lengthMm, announce, indices) {
        const moved  = [ from[0] + (dir.x * lengthMm), from[1] + (dir.y * lengthMm) ];
        const carry  = [ moved[0] - from[0], moved[1] - from[1] ];
        const others = (Array.isArray(indices) && indices.length) ? indices : [ index ];
        const points = origin.map((p, i) => {
            if (i === index) return moved;
            return others.indexOf(i) === -1 ? [ p[0], p[1] ] : [ p[0] + carry[0], p[1] + carry[1] ];
        });
        Na__LeModel__UpdateShape(sheet, id, { points : points }, !announce);
        Na__LeSurface__Refresh('markup');
        Na__LeTools__WriteVertexRetype({ id : id, index : index, from : [ from[0], from[1] ], dir : { x : dir.x, y : dir.y },
                                         indices : others.slice(), origin : origin.map((p) => [ p[0], p[1] ]),
                                         points : points.map((p) => [ p[0], p[1] ]) });
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Vertex a Typed Distance Along Its Direction
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact (no snap).
    //
    // FIRST VALUE | A vertex is being dragged: the direction is the drag's
    // own - along the locked axis when an arrow key holds one - and the drag
    // is finished afterwards so a still-down pointer cannot pull the vertex
    // back to the cursor.
    //
    // AND EVERY VALUE AFTER IT | The move stays live: another value moves the
    // same vertex the same way, measured from where it started rather than
    // from where the last value put it, so a wrong figure is corrected by
    // typing the right one rather than undone. The run ends when the tool
    // changes, or when anything else touches the shape (VertexRetypable).
    //
    // Returns { ok : true } or { ok : false, reason } - 'none' with no vertex
    // to move, 'length' for no length, 'direction' when there is no run to
    // aim along.
    // ------------------------------------------------------------
    function Na__LeTools__TypeVertexLength(lengthMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { ok : false, reason : 'none' };
        const drag = Na__LeTools__Drag;
        if (!drag || drag.kind !== 'shape' || drag.mode !== 'vertex') {
            const record = Na__LeTools__VertexRetypable(sheet);              // <-- No drag: the value that just landed may still be retyped
            if (!record) return { ok : false, reason : 'none' };
            if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
            Na__LeTools__WriteVertexAlong(sheet, record.id, record.index, record.origin || record.points, record.from, record.dir, lengthMm, true, record.indices);   // <-- Announced: each correction is an undo step of its own, measured from where the points began
            return { ok : true, retyped : true };
        }
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const reading = Na__LeTools__GetVertexDrag();
        if (!reading || !reading.to) return { ok : false, reason : 'direction' };
        const dx  = reading.to.x - reading.from.x;
        const dy  = reading.to.y - reading.from.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const from = drag.start[drag.index];
        if (!from) return { ok : false, reason : 'none' };
        Na__LeTools__WriteVertexAlong(sheet, drag.id, drag.index, drag.start, from, { x : dx / run, y : dy / run }, lengthMm, false, drag.indices);
        drag.moved = true;
        drag.typed = true;                                                   // <-- Its retype record is the one WriteVertexAlong just wrote: FinishDrag leaves it be
        Na__LeTools__FinishDrag(drag.pointerId, false);                      // <-- Announce once; the pointer no longer owns the vertex
        return { ok : true };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dimension Record by Id
    // ------------------------------------------------------------
    function Na__LeTools__DimById(sheet, id) {
        return sheet ? (sheet.Sheet__Dimensions || []).find((x) => x.Dimension__Id === id) || null : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is One of a Dimension's Measured Points Being Dragged
    // ------------------------------------------------------------
    function Na__LeTools__IsDimEndDrag() {
        const drag = Na__LeTools__Drag;
        return !!(drag && drag.kind === 'dimension' && (drag.mode === 'start' || drag.mode === 'end'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Dragged End Goes to Make the Dimension Read a Span
    // ------------------------------------------------------------
    // WHAT A DIMENSION READS IS NOT ALWAYS HOW FAR ITS END MOVED. A horizontal
    // dimension measures the x between its points and a vertical one the y, so a
    // typed value sets that coordinate alone and leaves the other exactly where
    // the drag put it. That is why this composes with an axis lock rather than
    // fighting it: locking X on a horizontal dimension holds the very coordinate
    // the typed value sets, and the lock decides the other one. An aligned
    // dimension measures the straight distance, so its end runs along the line
    // between the two points.
    //
    // fixed is the end that is not moving and point is where the moving end sits
    // now, already constrained. Null when the two share the governing coordinate:
    // there is then no side to put the span on.
    // ------------------------------------------------------------
    function Na__LeTools__DimEndAtSpan(fixed, point, orientation, spanMm) {
        if (orientation === Na__LeDimGeo__HORIZONTAL) {
            const run = point.x - fixed.x;
            if (Math.abs(run) < Na__LeTools__TYPED_MIN_MM) return null;
            return { x : fixed.x + ((run < 0 ? -1 : 1) * spanMm), y : point.y };
        }
        if (orientation === Na__LeDimGeo__VERTICAL) {
            const run = point.y - fixed.y;
            if (Math.abs(run) < Na__LeTools__TYPED_MIN_MM) return null;
            return { x : point.x, y : fixed.y + ((run < 0 ? -1 : 1) * spanMm) };
        }
        const dx = point.x - fixed.x, dy = point.y - fixed.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return null;
        return { x : fixed.x + ((dx / run) * spanMm), y : fixed.y + ((dy / run) * spanMm) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dimension End Being Dragged, for the Measurements Box
    // ------------------------------------------------------------
    // The reading is the SPAN - what the dimension actually reads - rather than
    // how far the grip has travelled, because the span is the number in your
    // head when you reach for the keyboard over a dimension.
    // ------------------------------------------------------------
    function Na__LeTools__GetDimEndDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsDimEndDrag()) return null;
        const sheet = Na__LeModel__GetActiveSheet();
        const dim   = Na__LeTools__DimById(sheet, drag.id);
        if (!dim) return null;
        const st    = drag.start;
        const fixed = drag.mode === 'start' ? { x : st.ex, y : st.ey } : { x : st.sx, y : st.sy };
        const live  = drag.mode === 'start'
            ? { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm }
            : { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm };
        return { dim : dim, mode : drag.mode, fixed : fixed, point : live, orientation : dim.Dimension__Orientation,
                 spanMm : Na__LeDimGeo__SpanMm(fixed, live, dim.Dimension__Orientation) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dimension a Typed Span Has Just Set, While Another May Still Set It
    // ------------------------------------------------------------
    function Na__LeTools__DimEndRetypable(sheet) {
        const record = Na__LeTools__DimEndRetype;
        if (!record || !sheet || Na__LeTools__Drag) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'dimension' || selection.id !== record.id) return null;
        const dim = Na__LeTools__DimById(sheet, record.id);
        if (!dim) return null;
        const l = record.landed;
        const same = Math.abs(dim.Dimension__StartXMm - l.sx) <= Na__LeTools__SAME_MM
                  && Math.abs(dim.Dimension__StartYMm - l.sy) <= Na__LeTools__SAME_MM
                  && Math.abs(dim.Dimension__EndXMm   - l.ex) <= Na__LeTools__SAME_MM
                  && Math.abs(dim.Dimension__EndYMm   - l.ey) <= Na__LeTools__SAME_MM
                  && Math.abs((dim.Dimension__OffsetMm || 0) - l.offset) <= Na__LeTools__SAME_MM;
        return same ? record : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Retypable Dimension Span, for the Measurements Box
    // ------------------------------------------------------------
    function Na__LeTools__GetDimEndRetype() {
        const sheet  = Na__LeModel__GetActiveSheet();
        const record = Na__LeTools__DimEndRetypable(sheet);
        if (!record || record.mode === 'offset') return null;                // <-- A slid line is not a moved end: its record belongs to GetDimOffsetRetype
        const dim = Na__LeTools__DimById(sheet, record.id);
        if (!dim) return null;
        return { dim : dim, mode : record.mode, fixed : record.fixed, point : record.point, orientation : record.orientation,
                 spanMm : Na__LeDimGeo__SpanMm(record.fixed, record.point, record.orientation) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Dimension's Dragged End and Remember It for a Retype
    // ------------------------------------------------------------
    // The line stays where it was put: the offset is measured from the start, so
    // moving either point would otherwise carry the line along with it.
    // ------------------------------------------------------------
    function Na__LeTools__WriteDimEnd(sheet, dim, mode, fixed, at, orientation, announce) {
        const s0 = { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm };
        const e0 = { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm };
        const nextStart = mode === 'start' ? at : s0;
        const nextEnd   = mode === 'end'   ? at : e0;
        const patch = mode === 'start' ? { startXMm : at.x, startYMm : at.y } : { endXMm : at.x, endYMm : at.y };
        patch.offsetMm = Na__LeDimGeo__OffsetKeepingLine(s0, e0, dim.Dimension__OffsetMm || 0, nextStart, nextEnd, orientation);
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, patch, !announce);
        Na__LeSurface__Refresh('markup');
        Na__LeTools__WriteDimEndRetype({
            id : dim.Dimension__Id, mode : mode, orientation : orientation,
            fixed : { x : fixed.x, y : fixed.y }, point : { x : at.x, y : at.y },
            landed : { sx : nextStart.x, sy : nextStart.y, ex : nextEnd.x, ey : nextEnd.y, offset : patch.offsetMm }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Dimension Read a Typed Span
    // ------------------------------------------------------------
    // spanMm is PAPER millimetres. The end being dragged moves so the dimension
    // reads that; the other end, and the line, stay where they are. As with a
    // vertex the offer stays open once Enter is pressed - type 2500, see it
    // should have been 2000, type that - and every value is measured from the
    // fixed end rather than from the last answer. Returns { ok : true } or
    // { ok : false, reason } - 'none', 'length' or 'direction'.
    // ------------------------------------------------------------
    function Na__LeTools__TypeDimensionSpan(spanMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { ok : false, reason : 'none' };
        const live    = Na__LeTools__GetDimEndDrag();
        const reading = live || Na__LeTools__GetDimEndRetype();
        if (!reading) return { ok : false, reason : 'none' };
        if (!Number.isFinite(spanMm) || Math.abs(spanMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const at = Na__LeTools__DimEndAtSpan(reading.fixed, reading.point, reading.orientation, Math.abs(spanMm));
        if (!at) return { ok : false, reason : 'direction' };
        Na__LeTools__WriteDimEnd(sheet, reading.dim, reading.mode, reading.fixed, at, reading.orientation, !live);   // <-- The drag's own landing is announced by FinishDrag; a retype announces itself
        if (!live) return { ok : true, retyped : true };
        const drag = Na__LeTools__Drag;
        drag.moved = true;
        drag.typed = true;                                                   // <-- WriteDimEnd has written its retype record already
        Na__LeTools__FinishDrag(drag.pointerId, false);
        return { ok : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | An Arrow Key Locked or Released the Axis While an End Is Held
    // ------------------------------------------------------------
    function Na__LeTools__RerunDimEndDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsDimEndDrag()) return false;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!sheet || !point) return true;
        Na__LeTools__ApplyDrag(sheet, drag, { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y }, Na__LeTools__ShiftHeld);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Dimension's Line Being Slid Off What It Measures
    // ------------------------------------------------------------
    function Na__LeTools__IsDimOffsetDrag() {
        const drag = Na__LeTools__Drag;
        return !!(drag && drag.kind === 'dimension' && drag.mode === 'offset');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dimension Line Being Slid, for the Measurements Box
    // ------------------------------------------------------------
    // The reading is how far the line sits off the points it measures. Its sign
    // is which side of them it is on, and the box shows the distance alone.
    // ------------------------------------------------------------
    function Na__LeTools__GetDimOffsetDrag() {
        if (!Na__LeTools__IsDimOffsetDrag()) return null;
        const sheet = Na__LeModel__GetActiveSheet();
        const dim   = Na__LeTools__DimById(sheet, Na__LeTools__Drag.id);
        return dim ? { dim : dim, offsetMm : dim.Dimension__OffsetMm || 0 } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Retypable Dimension Offset, for the Measurements Box
    // ------------------------------------------------------------
    function Na__LeTools__GetDimOffsetRetype() {
        const sheet  = Na__LeModel__GetActiveSheet();
        const record = Na__LeTools__DimEndRetypable(sheet);
        if (!record || record.mode !== 'offset') return null;
        const dim = Na__LeTools__DimById(sheet, record.id);
        return dim ? { dim : dim, offsetMm : dim.Dimension__OffsetMm || 0 } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Dimension's Offset and Remember It for a Retype
    // ------------------------------------------------------------
    function Na__LeTools__WriteDimOffset(sheet, dim, offsetMm, announce) {
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { offsetMm : offsetMm }, !announce);
        Na__LeSurface__Refresh('markup');
        Na__LeTools__WriteDimEndRetype({
            id : dim.Dimension__Id, mode : 'offset', orientation : dim.Dimension__Orientation,
            fixed : { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
            point : { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
            landed : { sx : dim.Dimension__StartXMm, sy : dim.Dimension__StartYMm,
                       ex : dim.Dimension__EndXMm,   ey : dim.Dimension__EndYMm, offset : offsetMm }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Slide a Dimension's Line a Typed Distance Off What It Measures
    // ------------------------------------------------------------
    // offsetMm is PAPER millimetres, and the distance alone: the line stays on
    // the side it is already on, because that is the side the drag chose. The
    // measured points do not move - only the line and its value slide across.
    // The offer stays open after Enter, as everywhere else.
    // ------------------------------------------------------------
    function Na__LeTools__TypeDimensionOffset(offsetMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { ok : false, reason : 'none' };
        const live    = Na__LeTools__GetDimOffsetDrag();
        const reading = live || Na__LeTools__GetDimOffsetRetype();
        if (!reading) return { ok : false, reason : 'none' };
        if (!Number.isFinite(offsetMm)) return { ok : false, reason : 'length' };
        const side = (reading.offsetMm < 0) ? -1 : 1;                        // <-- Which side the drag put it on
        Na__LeTools__WriteDimOffset(sheet, reading.dim, side * Math.abs(offsetMm), !live);
        if (!live) return { ok : true, retyped : true };
        const drag = Na__LeTools__Drag;
        drag.moved = true;
        drag.typed = true;                                                   // <-- WriteDimOffset has written its retype record already
        Na__LeTools__FinishDrag(drag.pointerId, false);
        return { ok : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Vertex of a Finished Vector Being Dragged
    // ------------------------------------------------------------
    function Na__LeTools__IsVertexDrag() {
        const drag = Na__LeTools__Drag;
        return !!(drag && drag.kind === 'shape' && drag.mode === 'vertex');
    }
    // ------------------------------------------------------------


    // FUNCTION | An Arrow Key Locked or Released the Axis Mid-Drag: Redraw the Vertex
    // ------------------------------------------------------------
    // The lock is taken the moment the key is pressed rather than on the next
    // mouse move, which matters most here: the whole point of the arrow keys
    // is to constrain the drag and then take a hand off the mouse to type.
    // Returns false when no vertex is being dragged, which leaves the arrow
    // keys nudging the selection as before.
    // ------------------------------------------------------------
    function Na__LeTools__RerunVertexDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsVertexDrag()) return false;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!sheet || !point) return true;                                   // <-- The lock is taken; there is simply nowhere to redraw it from yet
        Na__LeTools__ApplyDrag(sheet, drag, { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y }, Na__LeTools__ShiftHeld);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Drag Relocating Whole Objects on the Paper
    // ------------------------------------------------------------
    // The Move tool's drag: one item by its body, or a whole multi-item
    // selection. It is NOT a grip - a vertex, a dimension end, a leader tip, a
    // crop handle and a rotate grip each edit an object rather than relocate
    // it, and each has its own reading - and not a viewport frame, which has
    // had its own reading and typed length since v2.24.0.
    // ------------------------------------------------------------
    function Na__LeTools__IsMoveDrag(drag) {
        const d = drag || Na__LeTools__Drag;
        if (!d) return false;
        if (d.kind === 'group') return true;
        if (d.kind === 'annotation') return d.mode !== 'rotate';             // <-- A plain text move has no mode at all
        if (d.kind === 'shape' || d.kind === 'dimension' || d.kind === 'leader') return d.mode === 'whole';
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Whole-Object Move Being Dragged, for the Measurements Box
    // ------------------------------------------------------------
    // Returns { from, to } in paper millimetres: where the press landed and
    // where the move has carried it - the distance actually applied, so a
    // snapped or axis-locked move reads back what it really did, not where the
    // cursor happens to be. Null while no such move is in flight.
    // ------------------------------------------------------------
    function Na__LeTools__GetMoveDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsMoveDrag(drag) || !drag.startMm) return null;
        const from    = { x : drag.startMm.x, y : drag.startMm.y };
        const applied = drag.appliedMm;
        const run     = applied ? Math.hypot(applied.x, applied.y) : 0;
        const cursor  = drag.moved ? Na__LeTools__LastPointMm : null;        // <-- Only once the press is a drag: the box read the distance to wherever the pointer last hovered, 14,618.5 mm once, at the press
        const to      = (run >= Na__LeTools__TYPED_MIN_MM)
            ? { x : from.x + applied.x, y : from.y + applied.y }
            : (cursor ? { x : cursor.x, y : cursor.y } : from);
        return { from : from, to : to };
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Whole Object a Typed Distance Along the Move
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact - no snap, no grid, no Shift, no Ortho, no rounding
    // to the cursor - because the typed value IS the answer. The drag is then
    // finished so a still-down pointer cannot pull the object back.
    //
    // AND EVERY VALUE AFTER IT, the way SketchUp takes one: with no drag in
    // hand, the move that has just landed - by a typed value or by the mouse -
    // is landed again that far along the same line, measured from where it
    // started, for as long as MoveRetypable says it is still the last thing
    // done. Returns { ok : true } ({ ok : true, retyped : true } for a value
    // after the first) or { ok : false, reason } - 'none' with no move in
    // flight or on offer, 'length' for no length, 'direction' when the move
    // has no run to aim along yet.
    // ------------------------------------------------------------
    function Na__LeTools__TypeMoveLength(lengthMm) {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsMoveDrag(drag)) {
            const record = Na__LeTools__MoveRetypable(Na__LeModel__GetActiveSheet());   // <-- No drag: the move that just landed may still be retyped
            if (!record || record.drag.kind === 'viewport') return { ok : false, reason : 'none' };
            if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
            return Na__LeTools__RetypeMove(record, lengthMm);
        }
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const reading = Na__LeTools__GetMoveDrag();
        if (!reading || !reading.to) return { ok : false, reason : 'direction' };
        const dx  = reading.to.x - reading.from.x;
        const dy  = reading.to.y - reading.from.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return { ok : false, reason : 'none' };
        Na__LeTools__ApplyDrag(sheet, drag, { x : (dx / run) * lengthMm, y : (dy / run) * lengthMm }, false, true);
        drag.moved = true;
        drag.retypeDir      = { x : dx / run, y : dy / run };                // <-- The line a value typed next runs along, and the value it replaces (RememberRetype)
        drag.retypeLengthMm = lengthMm;
        Na__LeTools__FinishDrag(drag.pointerId, false);                      // <-- Announce once; the pointer no longer owns the object
        return { ok : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | An Arrow Key Locked or Released the Axis Mid-Move: Redraw It
    // ------------------------------------------------------------
    function Na__LeTools__RerunMoveDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsMoveDrag(drag)) return false;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!sheet || !point) return true;                                   // <-- The lock is taken; there is simply nowhere to redraw it from yet
        Na__LeTools__ApplyDrag(sheet, drag, { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y }, Na__LeTools__ShiftHeld);
        Na__LeMeasure__Refresh();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Items a Finished Move Carried
    // ------------------------------------------------------------
    function Na__LeTools__RetypeItems(drag) {
        if (!drag) return [];
        if (drag.kind === 'group') return (drag.group || []).map((entry) => ({ kind : entry.kind, id : entry.id }));
        return [ { kind : drag.kind, id : drag.id } ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Move Left Everything It Carried, as One Comparable String
    // ------------------------------------------------------------
    // The geometry alone - a vector's points, a note's place and its leader's
    // end, a leader's tip and head, a dimension's points and line, a frame's
    // rectangle - so a colour or a weight changed since leaves the move on
    // offer, and anything that moves, reshapes, deletes or undoes it ends it.
    // Null when one of the items has gone.
    // ------------------------------------------------------------
    function Na__LeTools__RetypeLanded(sheet, drag) {
        if (!sheet || !drag) return null;
        const out   = [];
        const whole = Na__LeTools__RetypeItems(drag).every((item) => {
            const r = Na__LeTools__Record(sheet, item);
            if (!r) return false;
            if (item.kind === 'shape')           out.push(Na__LeShapeGeo__Points(r));
            else if (item.kind === 'annotation') out.push([ r.Annotation__PosXMm, r.Annotation__PosYMm, r.Annotation__LeaderXMm, r.Annotation__LeaderYMm ]);
            else if (item.kind === 'leader')     out.push([ r.Leader__TipXMm, r.Leader__TipYMm, r.Leader__AnchorXMm, r.Leader__AnchorYMm ]);
            else if (item.kind === 'dimension')  out.push([ r.Dimension__StartXMm, r.Dimension__StartYMm, r.Dimension__EndXMm, r.Dimension__EndYMm, r.Dimension__OffsetMm ]);
            else { const f = r.Viewport__FrameMm || {}; out.push([ f.X, f.Y, f.WidthMm, f.HeightMm ]); }
            return true;
        });
        return whole ? JSON.stringify(out) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selection, as One Comparable String
    // ------------------------------------------------------------
    function Na__LeTools__SelectionKey() {
        return Na__LeTools__KeyOf(Na__LeModel__GetSelectionItems());
    }
    function Na__LeTools__KeyOf(items) {
        return Array.from(new Set((items || []).map((item) => item.kind + ':' + item.id))).sort().join('|');   // <-- Each once, as SetSelectionItems keeps them
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Retype Record for a Whole-Object Move or a Frame Move That Has Just Landed
    // ------------------------------------------------------------
    // The drag itself goes in the record: its start is the ORIGINAL of
    // everything it carried, so every value typed after it is measured from
    // there, never from where the value before it left things. The line and
    // the distance are the typed ones when a value finished the drag
    // (retypeDir, retypeLengthMm, a minus sign included), else how far the
    // move really went - appliedMm, which is what landed after the snap, the
    // grid, a lock, Shift or Ortho had their say, or a frame's own travel.
    // Null for a move that went nowhere: there is no line to type along.
    // ------------------------------------------------------------
    function Na__LeTools__MoveRecord(sheet, drag) {
        let fromMm, travel;
        if (drag.kind === 'viewport') {
            const live = Na__LeModel__GetViewportById(sheet, drag.id);
            const rect = live && live.Viewport__FrameMm;
            if (!rect || !drag.start || !drag.start.rect) return null;
            fromMm = { x : drag.start.rect.X, y : drag.start.rect.Y };      // <-- The frame's corner, as the drag's own reading measures it
            travel = { x : rect.X - fromMm.x, y : rect.Y - fromMm.y };
        } else {
            if (!drag.startMm) return null;
            fromMm = { x : drag.startMm.x, y : drag.startMm.y };
            travel = drag.appliedMm ? { x : drag.appliedMm.x, y : drag.appliedMm.y } : { x : 0, y : 0 };
        }
        let dir = drag.retypeDir || null;
        let lengthMm = drag.retypeLengthMm;
        if (!dir) {
            const run = Math.hypot(travel.x, travel.y);
            if (!(run >= Na__LeTools__TYPED_MIN_MM)) return null;
            dir = { x : travel.x / run, y : travel.y / run };
            lengthMm = run;
        }
        return { drag : drag, sheetId : sheet.Sheet__Id, fromMm : fromMm, dir : { x : dir.x, y : dir.y }, lengthMm : lengthMm,
                 selection : Na__LeTools__SelectionKey(), landed : Na__LeTools__RetypeLanded(sheet, drag) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Retype Record for a Vertex Let Go by the Mouse
    // ------------------------------------------------------------
    // The same record a typed length writes (WriteVertexAlong): the vertex,
    // where it started, the line it went along, the run of picked points it
    // carried and where they all began. Null when the vertex ended where it
    // started.
    // ------------------------------------------------------------
    function Na__LeTools__VertexRecord(sheet, drag) {
        const shape = Na__LeModel__GetShapeById(sheet, drag.id);
        const from  = Array.isArray(drag.start) ? drag.start[drag.index] : null;
        if (!shape || !from) return null;
        const points = Na__LeShapeGeo__Points(shape);
        const live   = points[drag.index];
        if (!live) return null;
        const run = Math.hypot(live[0] - from[0], live[1] - from[1]);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return null;
        return { id : drag.id, index : drag.index, from : [ from[0], from[1] ], dir : { x : (live[0] - from[0]) / run, y : (live[1] - from[1]) / run },
                 indices : (Array.isArray(drag.indices) && drag.indices.length ? drag.indices : [ drag.index ]).slice(),
                 origin : drag.start.map((p) => [ p[0], p[1] ]), points : points.map((p) => [ p[0], p[1] ]) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Retype Record for a Dimension End or Line Let Go by the Mouse
    // ------------------------------------------------------------
    // The same record WriteDimEnd and WriteDimOffset write for a typed value.
    // ------------------------------------------------------------
    function Na__LeTools__DimEndRecord(sheet, drag) {
        const dim = Na__LeTools__DimById(sheet, drag.id);
        if (!dim || !drag.start) return null;
        const landed = { sx : dim.Dimension__StartXMm, sy : dim.Dimension__StartYMm, ex : dim.Dimension__EndXMm, ey : dim.Dimension__EndYMm, offset : dim.Dimension__OffsetMm || 0 };
        if (drag.mode === 'offset') {
            return { id : dim.Dimension__Id, mode : 'offset', orientation : dim.Dimension__Orientation,
                     fixed : { x : landed.sx, y : landed.sy }, point : { x : landed.ex, y : landed.ey }, landed : landed };
        }
        const st    = drag.start;
        const fixed = drag.mode === 'start' ? { x : st.ex, y : st.ey } : { x : st.sx, y : st.sy };
        const point = drag.mode === 'start' ? { x : landed.sx, y : landed.sy } : { x : landed.ex, y : landed.ey };
        return { id : dim.Dimension__Id, mode : drag.mode, orientation : dim.Dimension__Orientation, fixed : fixed, point : point, landed : landed };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep What a Finished Drag Moved On Offer to a Typed Value
    // ------------------------------------------------------------
    // SKETCHUP'S RULE: the last thing moved stays live in the Measurements box
    // until something else is done. Type a value and press Enter and it lands
    // again that far along the line it went, measured from where it started;
    // type another and it goes there instead - 1 m was not right, try 1.2 -
    // as often as it takes. Selecting something else, moving something else,
    // another tool, Escape, an undo or any other change to it starts afresh.
    //
    // Run by FinishDrag for every drag that moved, the mouse's and a typed
    // value's alike, while the drag is still in hand. One record at a time:
    // whichever kind this drag was writes its own and the others go.
    //   A WHOLE-OBJECT MOVE OR A FRAME MOVE - MoveRetype (MoveRecord).
    //   A VERTEX, A DIMENSION END, A DIMENSION LINE - their own records, the
    //     ones a typed value has always written, so a drag let go by the mouse
    //     is corrected by typing just as one finished by a value was. A drag a
    //     value finished (drag.typed) has written its record already.
    //   ANYTHING ELSE that moved - a crop, a pan of the drawing, a turn, a
    //     leader's tip or head - ends them all: it is the last thing done now.
    // ------------------------------------------------------------
    function Na__LeTools__RememberRetype(drag) {
        if (!drag || !drag.moved) return;                                    // <-- A click moved nothing, so nothing is forgotten either
        const sheet  = Na__LeModel__GetActiveSheet();
        const move   = Na__LeTools__IsMoveDrag(drag) || Na__LeTools__IsViewportMoveDrag(drag);
        const vertex = drag.kind === 'shape' && drag.mode === 'vertex';
        const end    = drag.kind === 'dimension' && (drag.mode === 'start' || drag.mode === 'end' || drag.mode === 'offset');
        Na__LeTools__WriteMoveRetype((move && sheet) ? Na__LeTools__MoveRecord(sheet, drag) : null);
        if (!vertex) Na__LeTools__WriteVertexRetype(null);
        else if (!drag.typed) Na__LeTools__WriteVertexRetype(sheet ? Na__LeTools__VertexRecord(sheet, drag) : null);
        if (!end) Na__LeTools__WriteDimEndRetype(null);
        else if (!drag.typed) Na__LeTools__WriteDimEndRetype(sheet ? Na__LeTools__DimEndRecord(sheet, drag) : null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Last Move, While Another Typed Value May Still Land It Again
    // ------------------------------------------------------------
    // Only while nothing is being dragged, on the sheet it was made on, with
    // the same selection it left, and with everything it carried exactly
    // where it landed. The moment one of those stops being true the move is
    // no longer the last thing done, and the record quietly lapses.
    // ------------------------------------------------------------
    function Na__LeTools__MoveRetypable(sheet) {
        const record = Na__LeTools__MoveRetype;
        if (!record || !sheet || Na__LeTools__Drag || record.sheetId !== sheet.Sheet__Id) return null;
        if (record.selection !== Na__LeTools__SelectionKey()) return null;
        const landed = Na__LeTools__RecordLanded(sheet, record);
        return (landed !== null && landed === record.landed) ? record : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Retype Record's Move Left Everything, an Array's Copies Included
    // ------------------------------------------------------------
    // With no array this is RetypeLanded of the move itself. A copy's array
    // (Na__LayoutEditor__SheetTools__CopyDrag__) adds each of its copies, so
    // moving, reshaping or deleting one of them - or an undo that takes them
    // away - ends the run as a change to the copy itself does.
    // ------------------------------------------------------------
    function Na__LeTools__RecordLanded(sheet, record) {
        const first = Na__LeTools__RetypeLanded(sheet, record.drag);
        if (first === null || !record.array) return first;
        const rest = record.array.extras.map((extra) => Na__LeTools__RetypeLanded(sheet, extra.drag));
        return rest.indexOf(null) !== -1 ? null : first + '|' + rest.join('|');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Retype Record Read Like a Live Drag
    // ------------------------------------------------------------
    function Na__LeTools__RetypeReading(record) {
        const from = record.fromMm;
        return { from : { x : from.x, y : from.y }, to : { x : from.x + (record.dir.x * record.lengthMm), y : from.y + (record.dir.y * record.lengthMm) } };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Retypable Whole-Object Move, for the Measurements Box
    // ------------------------------------------------------------
    // Reads { from, to } exactly as GetMoveDrag does while the drag is held,
    // so the box keeps its reading and its scale when the button comes up
    // and stays awake for a value. Null once the move is no longer the last
    // thing done.
    // ------------------------------------------------------------
    function Na__LeTools__GetMoveRetype() {
        const record = Na__LeTools__MoveRetypable(Na__LeModel__GetActiveSheet());
        return (record && record.drag.kind !== 'viewport') ? Na__LeTools__RetypeReading(record) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Retypable Frame Move, for the Measurements Box
    // ------------------------------------------------------------
    function Na__LeTools__GetViewportRetype() {
        const record = Na__LeTools__MoveRetypable(Na__LeModel__GetActiveSheet());
        return (record && record.drag.kind === 'viewport') ? Na__LeTools__RetypeReading(record) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This a Ctrl-Drag Copy Still on the Pointer
    // ------------------------------------------------------------
    function Na__LeTools__IsLiveCopy(drag) {
        return !!(drag && drag.copied && drag.moved === true && (Na__LeTools__IsMoveDrag(drag) || Na__LeTools__IsViewportMoveDrag(drag)));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Copy on Offer to Be Arrayed (SketchUp's 3x and /3)
    // ------------------------------------------------------------
    // True while a Ctrl-drag copy is on the pointer, or has landed - let go by
    // the mouse or by a typed value - and is still the last thing done, so the
    // Measurements box lets x, * and / begin a value.
    // ------------------------------------------------------------
    function Na__LeTools__CanMoveArray() {
        const drag = Na__LeTools__Drag;
        if (drag) return Na__LeTools__IsLiveCopy(drag);
        const record = Na__LeTools__MoveRetypable(Na__LeModel__GetActiveSheet());
        return !!(record && record.drag && record.drag.copied);
    }
    // ------------------------------------------------------------


    // FUNCTION | Array the Copy That Has Just Landed: SketchUp's Move Tool Multiplier and Divider
    // ------------------------------------------------------------
    // mode 'times' (3x, *3): copies at the copy's distance, twice it and three
    // times it, the copy itself the first of them. mode 'divide' (/3): copies
    // dividing that distance into three equal parts, the copy itself the last.
    // The distance is the copy's own, as typed or as dragged - a minus sign
    // included - so a length typed after keeps the count and moves them all
    // (RetypeMove), and a count typed after replaces the one before. The
    // copies are made silently and announced once: one undo step, and the
    // move stays on offer, for another count or another length. Returns
    // { ok : true, count, mode, lengthMm } or { ok : false, reason } - 'none'
    // with no move on offer, 'copy' when the last move was not a copy,
    // 'count' for a count that is not a whole number of at least one, 'many'
    // (with max) past the configured ArrayMaxCount.
    // ------------------------------------------------------------
    function Na__LeTools__TypeMoveArray(mode, count) {
        const live = Na__LeTools__Drag;
        if (Na__LeTools__IsLiveCopy(live) && Number.isInteger(count) && count >= 1 && count <= Na__LeCfg__GetMeasureSetup().arrayMaxCount) {
            Na__LeTools__FinishDrag(live.pointerId, false);                  // <-- A copy still on the pointer lands where it is first, as a typed length lands it; the pointer no longer owns it
        }
        const sheet  = Na__LeModel__GetActiveSheet();
        const record = Na__LeTools__MoveRetypable(sheet);
        if (!record) return { ok : false, reason : 'none' };
        if (!record.drag.copied) return { ok : false, reason : 'copy' };
        if (!Number.isInteger(count) || count < 1) return { ok : false, reason : 'count' };
        const max = Na__LeCfg__GetMeasureSetup().arrayMaxCount;
        if (count > max) return { ok : false, reason : 'many', max : max };
        if (!Na__LeTools__BuildCopyArray(sheet, record, { mode : mode, count : count }, Na__LeTools__LandExact)) return { ok : false, reason : 'none' };
        // EVERY ANNOUNCE REFRESHES THE BOX, AND THE BOX ASKS WHETHER THE MOVE
        // IS STILL ON OFFER. So the record learns where everything landed and
        // what the selection is about to be BEFORE either is announced - a
        // change of selection announces itself - or the box would find a
        // stale record half way, go idle and drop the focus.
        const pick = Na__LeTools__CopyArraySelection(record);
        record.landed    = Na__LeTools__RecordLanded(sheet, record);
        record.selection = Na__LeTools__KeyOf(pick);
        Na__LeModel__SetSelectionItems(pick);
        record.selection = Na__LeTools__SelectionKey();
        Na__LeTools__AnnounceMove(sheet, record.drag);                       // <-- One announce, one undo step, however many copies went in or came out
        record.selection = Na__LeTools__SelectionKey();
        record.landed    = Na__LeTools__RecordLanded(sheet, record);
        return { ok : true, count : count, mode : mode, lengthMm : record.lengthMm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce a Move Once, the Way the Release Does
    // ------------------------------------------------------------
    function Na__LeTools__AnnounceMove(sheet, drag) {
        if (drag.kind === 'group')           { Na__LeSelSet__Commit(sheet, drag.group); return; }   // <-- Once per kind: one undo step for the lot
        if (drag.kind === 'viewport')        Na__LeModel__UpdateViewport(sheet, drag.id, {}, false);
        else if (drag.kind === 'annotation') Na__LeModel__UpdateAnnotation(sheet, drag.id, {}, false);
        else if (drag.kind === 'shape')      Na__LeModel__UpdateShape(sheet, drag.id, {}, false);
        else if (drag.kind === 'leader')     Na__LeModel__UpdateLeader(sheet, drag.id, {}, false);
        else                                 Na__LeModel__UpdateDimension(sheet, drag.id, {}, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Last Move Again, a Typed Distance Along Its Line
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres, measured from where the move STARTED, so
    // 1000 then 1200 ends 1200 from the start, not 2200. Exact: no snap, no
    // grid, no Shift, no Ortho - a typed value is absolute whatever is
    // switched on. Each correction is an undo step of its own, as a retyped
    // vertex's is, and the record follows it so the next value can replace it.
    // ------------------------------------------------------------
    function Na__LeTools__RetypeMove(record, lengthMm) {
        const sheet = Na__LeModel__GetActiveSheet();
        const drag  = record.drag;
        if (!sheet) return { ok : false, reason : 'none' };
        const delta = { x : record.dir.x * lengthMm, y : record.dir.y * lengthMm };
        if (!Na__LeTools__LandExact(sheet, drag, delta)) return { ok : false, reason : 'none' };
        record.lengthMm = lengthMm;
        if (record.array) Na__LeTools__FollowCopyArray(sheet, record, Na__LeTools__LandExact);   // <-- A copy's array spaces itself out again from the new distance, in the same undo step
        record.landed   = Na__LeTools__RecordLanded(sheet, record);         // <-- Before the announce, so the box's refresh on it still finds the move on offer
        Na__LeTools__AnnounceMove(sheet, drag);
        record.landed   = Na__LeTools__RecordLanded(sheet, record);         // <-- And after it, should an announce hook have settled anything
        return { ok : true, retyped : true };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land What a Move Carries Exactly a Distance From Where It Started (silent)
    // ------------------------------------------------------------
    // The landing every typed value uses: no snap, no grid, no Shift, no
    // Ortho. A frame through its own patch (a frame carried by a point would
    // otherwise go through the snap move's solver); everything else through
    // ApplyDrag's exact path, every item from its own start. Returns false
    // when a frame could not be patched.
    // ------------------------------------------------------------
    function Na__LeTools__LandExact(sheet, drag, delta) {
        if (drag.kind === 'group') {                                         // <-- ApplyDrag's exact group branch, less its refresh of the box: a typed value is mid-commit, and the box would find the move half landed
            drag.appliedMm = { x : delta.x, y : delta.y };
            Na__LeSelSet__Apply(sheet, drag.group, delta.x, delta.y);
            return true;
        }
        if (drag.kind === 'viewport') {
            const viewport = Na__LeModel__GetViewportById(sheet, drag.id);
            const patch    = viewport ? Na__LeHandles__DragPatch(viewport, drag.hit, drag.start, delta, { shift : false }) : null;
            if (!patch) return false;
            Na__LeModel__UpdateViewport(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('frames');
            return true;
        }
        Na__LeTools__ApplyDrag(sheet, drag, delta, false, true);            // <-- exact: every item from its own start, nothing may massage the value
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Drag Moving a Viewport's Frame on the Paper
    // ------------------------------------------------------------
    // A handle crops the frame; a body drag pans the drawing inside. Only a
    // grab on the border (the move cursor) is a frame translation the
    // Measurements box can take a length for.
    // ------------------------------------------------------------
    function Na__LeTools__IsViewportMoveDrag(drag) {
        const d = drag || Na__LeTools__Drag;                                 // <-- Asked with nothing, it means the drag in flight, as IsMoveDrag does
        return !!(d && d.kind === 'viewport' && d.hit && d.hit.mode === 'border');
    }
    // ------------------------------------------------------------


    // FUNCTION | An Arrow Key Locked or Released the Axis Mid-Move: Redraw the Frame
    // ------------------------------------------------------------
    // The viewport twin of RerunMoveDrag. A frame is NOT a move drag as
    // IsMoveDrag counts them - it has its own reading and its own typed
    // length - so it needs its own way back in, or the arrow keys fall
    // through to the nudge and walk the very frame being dragged.
    // ------------------------------------------------------------
    function Na__LeTools__RerunViewportDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsViewportMoveDrag(drag)) return false;
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeTools__LastPointMm;
        if (!sheet || !point || !drag.startMm) return true;                  // <-- The lock is taken; there is simply nowhere to redraw it from yet
        Na__LeTools__ApplyDrag(sheet, drag, { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y }, Na__LeTools__ShiftHeld);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Viewport Frame Being Dragged, for the Measurements Box
    // ------------------------------------------------------------
    // Returns { from, to } in paper millimetres: the frame's top-left where
    // the drag began, and where it is headed (the live origin, or the cursor
    // when that has not moved yet). Null while no viewport is being moved.
    // ------------------------------------------------------------
    function Na__LeTools__GetViewportDrag() {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsViewportMoveDrag(drag) || !drag.start || !drag.start.rect) return null;
        const from   = { x : drag.start.rect.X, y : drag.start.rect.Y };
        const sheet  = Na__LeModel__GetActiveSheet();
        const live   = sheet ? Na__LeModel__GetViewportById(sheet, drag.id) : null;
        const rect   = live && live.Viewport__FrameMm;
        const livePt = rect ? { x : rect.X, y : rect.Y } : null;
        const run    = livePt ? Math.hypot(livePt.x - from.x, livePt.y - from.y) : 0;
        const cursor = drag.moved ? Na__LeTools__LastPointMm : null;         // <-- Only once the press is a drag, as for a vertex
        const aim    = (run >= Na__LeTools__TYPED_MIN_MM) ? livePt : (cursor && drag.startMm
            ? { x : from.x + (cursor.x - drag.startMm.x), y : from.y + (cursor.y - drag.startMm.y) }
            : livePt);
        const to     = (aim && Na__LeAxis__Get()) ? Na__LeAxis__Apply(from, aim) : aim;   // <-- A locked drag reads along its axis, cursor fallback included
        return { from : from, to : to };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Dragged Viewport a Typed Distance Along the Drag
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact (no snap). The drag is then finished so a still-
    // down pointer cannot pull the frame back to the cursor. Returns
    // { ok : true } or { ok : false, reason } - 'none' with no frame move,
    // 'length' for no length, 'direction' when the drag has no run to aim
    // along.
    // ------------------------------------------------------------
    function Na__LeTools__TypeViewportLength(lengthMm) {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsViewportMoveDrag(drag)) {
            const record = Na__LeTools__MoveRetypable(Na__LeModel__GetActiveSheet());   // <-- No drag: the frame that just landed may still be retyped, as a move is
            if (!record || record.drag.kind !== 'viewport') return { ok : false, reason : 'none' };
            if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
            return Na__LeTools__RetypeMove(record, lengthMm);
        }
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const reading = Na__LeTools__GetViewportDrag();
        if (!reading || !reading.to) return { ok : false, reason : 'direction' };
        const dx  = reading.to.x - reading.from.x;
        const dy  = reading.to.y - reading.from.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, drag.id) : null;
        if (!sheet || !viewport) return { ok : false, reason : 'none' };
        const dMm   = { x : (dx / run) * lengthMm, y : (dy / run) * lengthMm };
        const patch = Na__LeHandles__DragPatch(viewport, drag.hit, drag.start, dMm, { shift : false });
        if (!patch) return { ok : false, reason : 'none' };
        Na__LeModel__UpdateViewport(sheet, drag.id, patch, true);
        Na__LeSurface__Refresh('frames');
        drag.moved = true;
        drag.retypeDir      = { x : dx / run, y : dy / run };                // <-- A value typed next runs the same way (RememberRetype)
        drag.retypeLengthMm = lengthMm;
        Na__LeTools__FinishDrag(drag.pointerId, false);                      // <-- Announce once; the pointer no longer owns the frame
        return { ok : true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hand the Pointer to Navigation
// -----------------------------------------------------------------------------

    // FUNCTION | Hand the Pointer Over to a Navigation Gesture
    // ------------------------------------------------------------
    // The PC and touchscreen control modules raise this while a pan or a
    // pinch owns the pointer. Any drag in flight is finished first, so a
    // second finger landing on the stage can never leave a viewport stranded
    // half way through a move.
    function Na__LeTools__SetSuppressed(flag) {
        const next = !!flag;
        if (Na__LeTools__Suppressed === next) return;
        Na__LeTools__WriteSuppressed(next);
        if (next) {
            Na__LeTools__FinishDrag(Na__LeTools__Drag ? Na__LeTools__Drag.pointerId : null);
            Na__LeTools__CancelPlacement();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Pointer Drag
    // ------------------------------------------------------------
    export {
        Na__LeTools__OnMove,
        Na__LeTools__OnUp,
        Na__LeTools__IsMoveDrag,
        Na__LeTools__GetMoveDrag,
        Na__LeTools__GetMoveRetype,
        Na__LeTools__TypeMoveLength,
        Na__LeTools__RerunMoveDrag,
        Na__LeTools__LeaveScope,
        Na__LeTools__GetVertexDrag,
        Na__LeTools__GetVertexRetype,
        Na__LeTools__IsVertexDrag,
        Na__LeTools__IsDimEndDrag,
        Na__LeTools__GetDimEndDrag,
        Na__LeTools__GetDimEndRetype,
        Na__LeTools__TypeDimensionSpan,
        Na__LeTools__IsDimOffsetDrag,
        Na__LeTools__GetDimOffsetDrag,
        Na__LeTools__GetDimOffsetRetype,
        Na__LeTools__TypeDimensionOffset,
        Na__LeTools__RerunDimEndDrag,
        Na__LeTools__TypeVertexLength,
        Na__LeTools__RerunVertexDrag,
        Na__LeTools__IsViewportMoveDrag,
        Na__LeTools__RerunViewportDrag,
        Na__LeTools__GetViewportDrag,
        Na__LeTools__GetViewportRetype,
        Na__LeTools__TypeViewportLength,
        Na__LeTools__CanMoveArray,
        Na__LeTools__TypeMoveArray,
        Na__LeTools__SetSuppressed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
