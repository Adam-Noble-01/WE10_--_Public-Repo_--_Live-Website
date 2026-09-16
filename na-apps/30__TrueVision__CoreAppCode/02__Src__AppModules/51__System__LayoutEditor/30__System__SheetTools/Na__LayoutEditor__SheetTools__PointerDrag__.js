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
// - For the Measurements box: GetVertexDrag and GetViewportDrag read a vertex
//   or a viewport frame drag, TypeVertexLength and TypeViewportLength put it
//   a typed distance along the drag and finish it, and IsViewportMoveDrag
//   says whether a drag is moving a frame.
// - SetSuppressed hands the pointer to a navigation gesture: a drag in flight
//   is finished and a half-done placement abandoned.
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
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Grips, Tools, Viewports, Snapping, Viewport Snap Move, Selection
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDimensionSetup, Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
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
        Na__LeModel__GetSelectionItems
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeHandles__DragPatch } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__RotateTo } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Move, Na__LeDim__OffsetFor, Na__LeDim__ShowInference } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeDimGeo__OffsetKeepingLine } from '../15__Core__Markup/Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShape__Move } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeMeasure__Refresh } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Move, Na__LeLeader__Release, Na__LeLeader__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Hover } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeVp2d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeOsnap__TONE_DIMENSION, Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeVpMove__Hover, Na__LeVpMove__Solve, Na__LeVpMove__Finish } from '../20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js';
    import { Na__LeGroup__ResolveItems } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeSelBox__Move, Na__LeSelBox__Release, Na__LeSelBox__Cancel, Na__LeSelBox__IsActive, Na__LeSelBox__Combine } from './Na__LayoutEditor__SelectionBox__.js';
    import { Na__LeSelSet__Apply, Na__LeSelSet__Commit } from './Na__LayoutEditor__SelectionSet__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__TYPED_MIN_MM,
        Na__LeTools__Stage,
        Na__LeTools__Editable,
        Na__LeTools__Drag,
        Na__LeTools__Suppressed,
        Na__LeTools__LastPointMm,
        Na__LeTools__WriteDrag,
        Na__LeTools__WriteSuppressed,
        Na__LeTools__WriteLastPointMm,
        Na__LeTools__WriteShiftHeld
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tool, Na__LeTools__CancelPlacement } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import {
        Na__LeTools__RefreshShapeInsert,
        Na__LeTools__SnapShapeTranslation,
        Na__LeTools__Resolve,
        Na__LeTools__Record,
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
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        Na__LeTools__WriteLastPointMm(point);                                // <-- An arrow key restretches the band from here
        Na__LeTools__WriteShiftHeld(!!event.shiftKey);

        const drag = Na__LeTools__Drag;
        if (!drag || event.pointerId !== drag.pointerId) {
            if (Na__LeSelBox__Move(sheet, point, event.clientX, event.clientY, event.pointerId)) return;   // <-- A selection box is being dragged out
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DIMENSION) { Na__LeDim__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_DRAW)      { Na__LeShape__Move(sheet, point, event.shiftKey); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_RECT)      { Na__LeRect__Move(sheet, point, event.shiftKey, (event.buttons & 1) === 1 || event.pointerType === 'touch'); Na__LeMeasure__Refresh(); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_LEADER)    { Na__LeLeader__Move(sheet, point, (event.buttons & 1) === 1 || event.pointerType === 'touch'); return; }
            if (Na__LeTools__Editable && Na__LeTools__Tool === Na__LeTools__TOOL_EYEDROP)   { Na__LeTools__Stage.style.cursor = Na__LeDrop__Hover(sheet, Na__LeTools__Resolve(sheet, point, true, true, true)); return; }
            if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return;
            const found     = Na__LeTools__Resolve(sheet, point);
            const grab      = Na__LeVpMove__Hover(sheet, Na__LeTools__CarryTarget(sheet, found), point);   // <-- Marks the point a press would carry the viewport by
            const inserting = Na__LeTools__RefreshShapeInsert(sheet, point, event.shiftKey);
            Na__LeTools__Stage.style.cursor = (inserting || grab) ? 'crosshair' : Na__LeTools__HoverCursor(sheet, found, point);
            return;
        }
        const dMm = { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y };
        if (!drag.moved) {
            if (Math.hypot(dMm.x, dMm.y) < Na__LeCfg__GetSelectionSetup().dragThresholdMm / Na__LeSurface__GetZoom()) return;
            drag.moved = true;
            Na__LeVp2d__SetInteracting(true);
            Na__LeVp3d__SetInteracting(true);
            document.body.classList.add('na-le-dragging');
        }
        Na__LeTools__ApplyDrag(sheet, drag, dMm, event.shiftKey);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Drag Delta Through the Model (silent)
    // ------------------------------------------------------------
    function Na__LeTools__ApplyDrag(sheet, drag, dMm, shift) {
        if (drag.kind === 'door') return;                                    // <-- A press on a door of a locked plan moves nothing
        const cursor = { x : drag.startMm.x + dMm.x, y : drag.startMm.y + dMm.y };
        const d = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm;
        if (drag.kind === 'group') { Na__LeSelSet__Apply(sheet, drag.group, d.x, d.y); return; }   // <-- Several selected items: one distance for all, Shift holding the axis
        if (drag.kind === 'viewport') {
            const viewport = Na__LeModel__GetViewportById(sheet, drag.id);
            if (!viewport) return;
            // CARRIED BY A POINT | The snap move says where the grabbed point
            // goes; the frame moves by however far that is from where it began.
            const carried = drag.baseMm ? Na__LeVpMove__Solve(sheet, drag, cursor, shift) : null;
            const moveBy  = carried ? { x : carried.x - drag.baseMm.x, y : carried.y - drag.baseMm.y } : dMm;
            const patch = Na__LeHandles__DragPatch(viewport, drag.hit, drag.start, moveBy, { shift : shift });
            if (!patch) return;
            Na__LeModel__UpdateViewport(sheet, drag.id, patch, true);
            Na__LeSurface__Refresh('frames');
            if (Na__LeTools__IsViewportMoveDrag(drag)) Na__LeMeasure__Refresh();   // <-- The box reads the drag length as the frame moves
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
                const snap  = Na__LeOsnap__Snap(sheet, cursor, { kind : 'shape', id : drag.id, index : drag.index });   // <-- A vertex jumps to a corner or a midpoint, never its own
                const p0    = drag.start[drag.index];
                const moved = snap.snapped ? [ snap.x, snap.y ] : [ p0[0] + d.x, p0[1] + d.y ];
                points = drag.start.map((p, i) => (i === drag.index ? moved : [ p[0], p[1] ]));
                Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
                Na__LeSurface__Refresh('markup');
                Na__LeMeasure__Refresh();                                    // <-- The box reads the drag length as the vertex moves
                return;
            } else {
                const t = Na__LeTools__SnapShapeTranslation(sheet, drag, dMm, shift);   // <-- Any vertex, or the grab, onto the linework; Shift still holds the axis
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
            const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'dimension', id : drag.id, index : drag.mode }, Na__LeOsnap__TONE_DIMENSION);   // <-- The grip jumps to a corner or a midpoint, never its own
            const px = snap.snapped ? snap.x : (drag.mode === 'start' ? s.sx : s.ex) + d.x;
            const py = snap.snapped ? snap.y : (drag.mode === 'start' ? s.sy : s.ey) + d.y;
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
        if (Na__LeTools__Stage) { try { Na__LeTools__Stage.releasePointerCapture(event.pointerId); } catch (e) { /* already released */ } }
        const taken = result.dragged ? result.items : (result.pending ? [ result.pending ] : null);
        if (taken) Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), Na__LeGroup__ResolveItems(sheet, taken), result.combine));
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
        if (pointerId !== null && pointerId !== undefined && Na__LeTools__Stage) {
            try { Na__LeTools__Stage.releasePointerCapture(pointerId); } catch (e) { /* already released */ }
        }
        Na__LeTools__WriteDrag(null);
        document.body.classList.remove('na-le-dragging');
        Na__LeMeasure__Refresh();                                            // <-- A finished vertex drag puts the Measurements box back to rest
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
        const cursor = Na__LeTools__LastPointMm;
        const to     = (run >= Na__LeTools__TYPED_MIN_MM) ? livePt : (cursor || livePt);
        return { from : fromPt, to : to };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Dragged Vertex a Typed Distance Along the Drag
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact (no snap). The drag is then finished so a still-
    // down pointer cannot pull the vertex back to the cursor. Returns
    // { ok : true } or { ok : false, reason } - 'none' with no vertex held,
    // 'length' for no length, 'direction' when the drag has no run to aim
    // along.
    // ------------------------------------------------------------
    function Na__LeTools__TypeVertexLength(lengthMm) {
        const drag = Na__LeTools__Drag;
        if (!drag || drag.kind !== 'shape' || drag.mode !== 'vertex') return { ok : false, reason : 'none' };
        if (!Number.isFinite(lengthMm) || Math.abs(lengthMm) < Na__LeTools__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const reading = Na__LeTools__GetVertexDrag();
        if (!reading || !reading.to) return { ok : false, reason : 'direction' };
        const dx  = reading.to.x - reading.from.x;
        const dy  = reading.to.y - reading.from.y;
        const run = Math.hypot(dx, dy);
        if (!(run >= Na__LeTools__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const sheet = Na__LeModel__GetActiveSheet();
        const from  = drag.start[drag.index];
        if (!sheet || !from) return { ok : false, reason : 'none' };
        const moved  = [ from[0] + ((dx / run) * lengthMm), from[1] + ((dy / run) * lengthMm) ];
        const points = drag.start.map((p, i) => (i === drag.index ? moved : [ p[0], p[1] ]));
        Na__LeModel__UpdateShape(sheet, drag.id, { points : points }, true);
        Na__LeSurface__Refresh('markup');
        drag.moved = true;
        Na__LeTools__FinishDrag(drag.pointerId, false);                      // <-- Announce once; the pointer no longer owns the vertex
        return { ok : true };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Drag Moving a Viewport's Frame on the Paper
    // ------------------------------------------------------------
    // A handle crops the frame; a body drag pans the drawing inside. Only a
    // grab on the border (the move cursor) is a frame translation the
    // Measurements box can take a length for.
    // ------------------------------------------------------------
    function Na__LeTools__IsViewportMoveDrag(drag) {
        return !!(drag && drag.kind === 'viewport' && drag.hit && drag.hit.mode === 'border');
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
        const cursor = Na__LeTools__LastPointMm;
        const to     = (run >= Na__LeTools__TYPED_MIN_MM) ? livePt : (cursor && drag.startMm
            ? { x : from.x + (cursor.x - drag.startMm.x), y : from.y + (cursor.y - drag.startMm.y) }
            : livePt);
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
        if (!Na__LeTools__IsViewportMoveDrag(drag)) return { ok : false, reason : 'none' };
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
        Na__LeTools__GetVertexDrag,
        Na__LeTools__TypeVertexLength,
        Na__LeTools__IsViewportMoveDrag,
        Na__LeTools__GetViewportDrag,
        Na__LeTools__TypeViewportLength,
        Na__LeTools__SetSuppressed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
