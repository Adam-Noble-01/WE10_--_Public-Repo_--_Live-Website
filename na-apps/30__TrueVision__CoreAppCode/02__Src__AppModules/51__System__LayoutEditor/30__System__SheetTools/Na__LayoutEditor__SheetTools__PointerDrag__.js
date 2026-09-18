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
    import { Na__LeCfg__GetDimensionSetup, Na__LeCfg__GetSelectionSetup, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
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
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeHandles__DragPatch } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeGrips__HideInsert, Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeLeadGeo__IsBroken, Na__LeLeadGeo__Lines } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeHoverTip__Show, Na__LeHoverTip__Hide } from './Na__LayoutEditor__SheetTools__HoverTooltip__.js';
    import { Na__LeText__RotateTo } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Move, Na__LeDim__OffsetFor, Na__LeDim__ShowInference } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeDimGeo__OffsetKeepingLine, Na__LeDimGeo__SpanMm, Na__LeDimGeo__HORIZONTAL, Na__LeDimGeo__VERTICAL } from '../15__Core__Markup/Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShape__Move } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Move, Na__LeRect__Release, Na__LeRect__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeMeasure__Refresh } from './Na__LayoutEditor__Measurements__.js';
    import { Na__LeLeader__Move, Na__LeLeader__Release, Na__LeLeader__Cancel } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Hover } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeVp2d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__SetInteracting } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeOsnap__TONE_DIMENSION, Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeAxis__Get, Na__LeAxis__Apply, Na__LeAxis__Hold, Na__LeAxis__Clear } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeVpMove__Hover, Na__LeVpMove__Solve, Na__LeVpMove__Finish } from '../20__System__Viewports/Na__LayoutEditor__ViewportSnapMove__.js';
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
        Na__LeTools__WriteDimEndRetype
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tool, Na__LeTools__CancelPlacement } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import {
        Na__LeTools__RefreshShapeInsert,
        Na__LeTools__SnapShapeTranslation,
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
            if (Math.hypot(dMm.x, dMm.y) < Na__LeCfg__GetSelectionSetup().dragThresholdMm / Na__LeSurface__GetZoom()) return;
            drag.moved = true;
            Na__LeVp2d__SetInteracting(true);
            Na__LeVp3d__SetInteracting(true);
            document.body.classList.add('na-le-dragging');
        }
        Na__LeTools__ApplyDrag(sheet, drag, dMm, event.shiftKey);
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


    // HELPER FUNCTION | Apply a Drag Delta Through the Model (silent)
    // ------------------------------------------------------------
    function Na__LeTools__ApplyDrag(sheet, drag, dMm, shift, exact) {
        if (drag.kind === 'door') return;                                    // <-- A press on a door of a locked plan moves nothing
        const cursor = { x : drag.startMm.x + dMm.x, y : drag.startMm.y + dMm.y };

        // THE DISTANCE A WHOLE-OBJECT MOVE TRAVELS. An arrow key naming the axis
        // beats Shift's guess, exactly as it does for a vertex, and `exact` is a
        // typed length: the value is the answer, so nothing may massage it.
        // `appliedMm` is what actually landed, which is what the Measurements
        // box reads back and what a typed length aims along.
        // ------------------------------------
        const axis  = Na__LeAxis__Get();
        const held  = (!exact && axis && Na__LeTools__IsMoveDrag(drag))
            ? (() => { const at = Na__LeAxis__Apply(drag.startMm, cursor); return { x : at.x - drag.startMm.x, y : at.y - drag.startMm.y }; })()
            : null;
        const d = exact ? dMm
                : (held ? held
                : (shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm));
        if (Na__LeTools__IsMoveDrag(drag)) {
            drag.appliedMm = { x : d.x, y : d.y };
            if (!exact && axis) Na__LeGrips__ShowBand(drag.startMm, { x : drag.startMm.x + d.x, y : drag.startMm.y + d.y }, axis);   // <-- The band's colour is the lock, so it reads without Shift being held
            else if (!exact) Na__LeGrips__HideBand();
        }
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
                const held  = axis ? Na__LeAxis__Apply(p0, raw) : (shift ? Na__LeAxis__Hold(p0, aim, raw) : raw);
                const moved = [ held.x, held.y ];
                if (axis || shift) Na__LeGrips__ShowBand(p0, moved, axis);   // <-- Coloured by the locked axis; Shift's band is the plain one, because its axis can still change
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
                    : Na__LeTools__SnapShapeTranslation(sheet, drag, dMm, shift);   // <-- Any vertex, or the grab, onto the linework; Shift still holds the axis
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
            const snap = Na__LeOsnap__Snap(sheet, cursor, { kind : 'dimension', id : drag.id, index : drag.mode }, Na__LeOsnap__TONE_DIMENSION);   // <-- The grip jumps to a corner or a midpoint, never its own
            // A MEASURED POINT CONSTRAINS LIKE A VERTEX. Same arrow keys, same
            // Shift, same rule that a snap supplies the coordinate along the
            // held axis rather than cancelling it - a dimension end is dragged
            // across other geometry more than anything else on the sheet, so a
            // snap that broke the constraint would break it constantly.
            const p0    = drag.mode === 'start' ? [ s.sx, s.sy ] : [ s.ex, s.ey ];
            const axis  = Na__LeAxis__Get();
            const aim   = { x : p0[0] + dMm.x, y : p0[1] + dMm.y };
            const raw   = snap.snapped ? { x : snap.x, y : snap.y } : { x : p0[0] + (axis ? dMm : d).x, y : p0[1] + (axis ? dMm : d).y };
            const held  = axis ? Na__LeAxis__Apply(p0, raw) : (shift ? Na__LeAxis__Hold(p0, aim, raw) : raw);
            if (axis || shift) Na__LeGrips__ShowBand(p0, [ held.x, held.y ], axis);
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
        Na__LeModel__SetSelectionItems(Na__LeSelBox__Combine(Na__LeModel__GetSelectionItems(), items, result.combine));
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
        if ((drag.kind === 'shape' && drag.mode === 'vertex') || Na__LeTools__IsDimEndDrag() || Na__LeTools__IsMoveDrag(drag)) { Na__LeGrips__HideBand(); Na__LeAxis__Clear(); }
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
        const cursor  = Na__LeTools__LastPointMm;
        const to      = (run >= Na__LeTools__TYPED_MIN_MM)
            ? { x : from.x + applied.x, y : from.y + applied.y }
            : (cursor ? { x : cursor.x, y : cursor.y } : from);
        return { from : from, to : to };
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Whole Object a Typed Distance Along the Move
    // ------------------------------------------------------------
    // lengthMm is PAPER millimetres; a negative one runs back the other way.
    // The landing is exact - no snap, no Shift, no rounding to the cursor -
    // because the typed value IS the answer. The drag is then finished so a
    // still-down pointer cannot pull the object back. Returns { ok : true } or
    // { ok : false, reason } - 'none' with no move in flight, 'length' for no
    // length, 'direction' when the move has no run to aim along yet.
    // ------------------------------------------------------------
    function Na__LeTools__TypeMoveLength(lengthMm) {
        const drag = Na__LeTools__Drag;
        if (!Na__LeTools__IsMoveDrag(drag)) return { ok : false, reason : 'none' };
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
        Na__LeTools__IsMoveDrag,
        Na__LeTools__GetMoveDrag,
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
        Na__LeTools__GetViewportDrag,
        Na__LeTools__TypeViewportLength,
        Na__LeTools__SetSuppressed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
