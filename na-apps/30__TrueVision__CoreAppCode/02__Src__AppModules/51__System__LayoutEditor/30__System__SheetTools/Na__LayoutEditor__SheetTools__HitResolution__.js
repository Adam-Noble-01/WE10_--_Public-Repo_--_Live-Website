// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - HIT RESOLUTION
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__HitResolution__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Hit Resolution
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What is under the pointer: the item a point resolves to, its record, lock and cursor, the door under it and the viewport a press may carry, with the hit tolerance and the vector grab, insert and snap helpers
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Resolve: what the Select tool finds under a point. The selected text's
//   rotate grip comes first (RotateGripAt), because it stands off the text
//   where no hit test would find it; then markup, which the markup bridge
//   orders dimensions, text, shapes, leaders (a grouped member resolves to
//   its group); then the selected viewport's handles and border; then any
//   viewport, front to back. The eyedropper asks it to read locked markup and
//   to look through locked viewports.
// - Record is the sheet record behind a resolved hit, IsViewportLocked a
//   viewport's lock by its own flag or by its layer, and HoverCursor the
//   cursor for what is under the pointer (a pointer over a door).
// - DoorAt (TrueVision only): the door under the pointer in the one selected
//   2D plan viewport, through Na__LayoutEditor__PlanDoors__, locked or not,
//   since a lock holds the frame and not the doors. Never on a handle.
// - CarryTarget (TrueVision only): the viewport a press may carry by a point
//   of its own linework (Na__LayoutEditor__ViewportSnapMove__), or null when
//   a handle, content editing, a lock or a multi-selection owns the press.
// - Tolerance is the hit tolerance in paper millimetres at the current zoom.
// - The vector helpers: the outline point a whole-shape drag is carried by
//   (ShapeGrabPoint), where a Shift-click would insert a vertex
//   (ShapeInsertHit) and the diamond that shows it while Shift is held
//   (RefreshShapeInsert). The snap that moves a whole shape, or a whole
//   selection, by whichever of its points comes nearest is the Object Snap
//   folder's now (28__System__ObjectSnap, __Moves__).
//
// INTEGRATION:
// - Called by the pointer, content editing, keyboard and context menu units.
//   The press asks DoorAt and CarryTarget, and the hover CarryTarget.
// - Reads the editable flag and the drag from
//   Na__LayoutEditor__SheetTools__State__ and the active tool from
//   Na__LayoutEditor__SheetTools__ToolState__, and changes neither.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : DoorAt and CarryTarget, and the door cursor in HoverCursor, are TrueVision's own.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.11.0
// - ShapeInsertHit reads the far end of an edge from the shape geometry
//   (Na__LeShapeGeo__EdgeEnd): on a vector with holes a ring's closing edge
//   runs back to its own first point, not on to the next ring's. A plain
//   vector's is the same point as before.
//
// 22-Sep-2026 - Version 1.10.0
// - AN ITEM WITH THE MOVE ANCHOR ON IT PICKS MOVE UP, whatever its kind
//   (Na__LayoutEditor__MoveAnchor__). The red cross is only ever put on by a
//   Ctrl+click, which is asking to move the thing, so a viewport or a dimension
//   carrying one keeps the Move tool up like a note does: PicksUpMove answers
//   true for a press on it (not on a crop handle or the rotate grip), and
//   SelectionPicksUpMove for a selection of it alone, so SettleAutoMove leaves
//   the Move up after the first move and the next one needs no M either.
//
// 22-Sep-2026 - Version 1.9.0
// - VIEWPORTS GROUP (Na__LayoutEditor__Groups__ 1.4.0). Resolve sends a
//   viewport's frame through the scope as it sends markup: at the sheet a
//   grouped frame answers as its outermost group; inside an open GROUP a
//   member frame answers as itself and one outside it is looked through.
//   Only an open vector or dimension still ends the search at the markup. A
//   LOCKED frame at the sheet stays background - a press on it still starts
//   a box. The selected viewport's handles and its rotate grip answer inside
//   an open group when it is a member (ViewportRotateGripAt asked no
//   container at all). RawHit finds a frame when no markup is under the
//   pointer, so a click outside an inner group steps back out to the outer
//   group holding that frame.
// - GroupAutoMoves: a group that holds a viewport or a dimension waits for M,
//   as each does on its own; PicksUpMove and SelectionPicksUpMove ask it.
//
// 21-Sep-2026 - Version 1.8.0
// - Rotatable viewports. ViewportRotateGripAt finds the selected viewport's
//   rotate grip before anything else, as the text rotate grip is found, and
//   Resolve hands it on as { kind : 'viewport', hit : { mode : 'rotate' } }.
//   HoverCursor gives it the rotate cursor and turns a crop handle's arrow
//   with the frame; PicksUpMove leaves Move down for it, as for a handle.
//   Contains and HitTest (Na__LayoutEditor__ViewportHandles__) answer for the
//   turned frame, so every other press on a turned viewport is unchanged.
//
// 21-Sep-2026 - Version 1.7.0
// - SnapShapeTranslation and SnapGroupTranslation have LEFT: all the editor's
//   snapping now lives in 28__System__ObjectSnap, and they are its
//   Na__LeOsnap__ShapeTranslation and Na__LeOsnap__GroupTranslation (__Moves__),
//   code unchanged. What is left here is about what is UNDER the pointer. The
//   insert-vertex diamond still asks the snap where its point would land, from
//   the folder's Search unit.
//
// 21-Sep-2026 - Version 1.6.0
// - Resolve looks straight through a viewport on a REFERENCE layer (the
//   Layers panel's Ref): its frame is not there to the pointer at all, its
//   handles included, so a press on it finds the paper or what lies beneath.
//   The markup hit test already passes through a reference layer's markup.
//   The drawing-scale lookups (a dimension's host, a room's scale) still read
//   a viewport under a point whatever its layer: they are measurements, not
//   picks.
//
// 21-Sep-2026 - Version 1.5.0
// - SnapShapeTranslation keeps a held axis through a snap. With Shift held, or
//   Ortho on (F8), a vector moved whole took the snap outright and left its
//   axis - 2.9 mm off it on PS01's plan the moment a corner reached the
//   linework. The snap now supplies only the coordinate along the held axis,
//   as it already did for a vertex, a dimension end and a selection moved as
//   one, and the grid fallback is handed the same axis.
//
// 21-Sep-2026 - Version 1.4.0
// - SnapShapeTranslation and SnapGroupTranslation fall back to the drawing
//   grid when no object snap is in reach (Na__LeTools__GridTranslation): with
//   Grid Snap on (F7) the move is carried by the point it was picked up from
//   - a corner, a midpoint or a filled vector's centre near the press, else
//   the point pressed - and that point lands on the grid, held to any axis
//   the move is held to. With Grid Snap off they return the move as before.
//
// 19-Sep-2026 - Version 1.3.0
// - PicksUpMove: would a Select press here pick the Move tool up. Text, a
//   vector, a leader by anything but its endpoint, and a group do; a viewport,
//   a dimension, a rotate grip, the open vector and anything locked do not. One
//   of several selected items answers for the whole selection
//   (SelectionPicksUpMove: every item a listed kind, and no vector or dimension
//   open). The kinds are the config's EditScope AutoMoveKinds.
// - HoverCursor shows the four-way arrow under Select wherever PicksUpMove is
//   true, because the press there now moves; and a Move that came up by itself
//   shows it in those places ONLY, where a Move that was asked for still wears
//   it everywhere. The cursor never promises a move the press will not make.
//
//
// 17-Sep-2026 - Version 1.2.0
// - A PRESS NEAR A POINT OF THE OPEN CONTAINER BELONGS TO THE CONTAINER.
//   Resolve asked the markup hit test first, and that answers for the LINE
//   only - so a press two pixels off the line but dead on a corner found
//   nothing, was read as "outside the container", and started a selection box
//   exactly where the hand was trying to grab the corner. ScopeGrabAt now
//   answers before the line test, measured against the GRIPS at GrabRadiusPx -
//   a fixed reach ON SCREEN at any zoom, because the grip is what the hand is
//   aiming at. ShapeGrabFor and DimensionGrabFor read at the same radius, so
//   the press that found the container also takes the point.
//
//
// 17-Sep-2026 - Version 1.1.0
// - Resolve answers for the OPEN CONTAINER (Na__LayoutEditor__EditScope__):
//   inside one, a hit is remapped to what is selectable at that level and
//   everything outside it - viewports included - comes back null, which the
//   press unit reads as "step back out". RawHit is the unscoped answer, what is
//   really under the pointer, and it decides how far out to step.
// - ShapeGrabFor and DimensionGrabFor: a vertex is only a vertex, and a
//   dimension grip only a grip, inside its own container (OpenDimensionGripAt
//   finds those wherever they stand, since a measured point is nowhere near the
//   dimension line); outside, every press
//   is 'whole'. Inside, both read at GripToleranceFactor times the tolerance,
//   because nothing else is competing for the press.
// - CanMoveWhole: whether a drag may translate a whole object - the Move tool,
//   unless EditScope MoveToolRequired is turned off. The press and the hover
//   cursor both read it, so they cannot disagree.
// - HoverCursor: the four-way arrow under Move, the plain arrow under Select
//   where a drag would do nothing, and the grip cursors unchanged.
//
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Grips, Shape Geometry, Viewports, Plan Doors, Snapping, Groups
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup, Na__LeCfg__GetEditScopeSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__IsLayerSelectable,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom, Na__LeSurface__GetEditingViewport } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeHandles__HitTest,
        Na__LeHandles__Contains,
        Na__LeHandles__CursorFor,
        Na__LeHandles__FrontToBack,
        Na__LeHandles__OnRotateGrip
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__HitTest } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab, Na__LeGrips__LeaderGrab, Na__LeGrips__AnnotationGrab, Na__LeGrips__ROTATE_CURSOR, Na__LeGrips__MOVE_CURSOR, Na__LeGrips__ShowInsert, Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__VertexAt, Na__LeShapeGeo__ClosestOnEdge, Na__LeShapeGeo__EdgeEnd } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeVp2d__Describe } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeDoors__ClickToggles, Na__LeDoors__At } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeOsnap__Find, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeGroup__Descendants } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';   // <-- What a group holds, for whether it picks Move up
    import { Na__LeAnchor__Holds, Na__LeAnchor__HoldsItems } from '../28__System__ObjectSnap/Na__LayoutEditor__MoveAnchor__.js';   // <-- An item with the red cross on it was Ctrl+clicked to be moved
    import {
        Na__LeScope__IsActive,
        Na__LeScope__IsLeafOpen,
        Na__LeScope__GetVectorId,
        Na__LeScope__GetDimensionId,
        Na__LeScope__Resolve,
        Na__LeScope__Allows
    } from './Na__LayoutEditor__EditScope__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools State and Tool State
    // ------------------------------------------------------------
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__TOOL_MOVE, Na__LeTools__PICK_TOOLS, Na__LeTools__Editable, Na__LeTools__Drag } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tool, Na__LeTools__IsMoveAuto } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Tolerance and Vector Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Hit Tolerance in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeTools__Tolerance() { return Na__LeCfg__GetSelectionSetup().hitToleranceMm / Na__LeSurface__GetZoom(); }
    // ------------------------------------------------------------


    // FUNCTION | May a Drag Move a Whole Object Right Now
    // ------------------------------------------------------------
    // The Move tool, and nothing else - unless EditScope MoveToolRequired is
    // turned off in the config, which puts the old behaviour back and lets
    // Select drag things about again. One answer, read by the press when it
    // decides whether there is a drag at all and by the hover when it decides
    // which cursor to show, so the two can never disagree.
    // ------------------------------------------------------------
    function Na__LeTools__CanMoveWhole() {
        if (Na__LeTools__Tool === Na__LeTools__TOOL_MOVE) return true;
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) return false;
        return Na__LeCfg__GetEditScopeSetup().moveToolRequired === false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Would Every Item of a Selection Pick the Move Tool Up
    // ------------------------------------------------------------
    // The SELECTION's half of the question, asked of kinds alone: a selection
    // keeps a Move that came up by itself only while everything in it is a kind
    // that picks Move up. One viewport or one dimension among them and the lot
    // waits for M, because a set moves as one and a drawing must never travel
    // on a Move nobody asked for. Nothing selected keeps nothing up, and
    // neither does an open vector or dimension: in there a press edits points,
    // and the whole object sliding out from under a missed grip is exactly what
    // the container was built to stop.
    // ------------------------------------------------------------
    function Na__LeTools__SelectionPicksUpMove(items) {
        const setup = Na__LeCfg__GetEditScopeSetup();
        if (!setup.autoMoveOnSelect || !setup.moveToolRequired) return false;
        if (!Array.isArray(items) || !items.length || Na__LeScope__IsLeafOpen()) return false;
        const sheet = Na__LeModel__GetActiveSheet();
        if (Na__LeAnchor__HoldsItems(sheet, items)) return true;             // <-- The move anchor is on it: it was asked to move, whatever its kind
        return items.every((item) => !!item && setup.autoMoveKinds.indexOf(item.kind) !== -1
            && (item.kind !== 'group' || Na__LeTools__GroupAutoMoves(sheet, item.id, setup.autoMoveKinds)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Would Everything Inside a Group Pick the Move Tool Up
    // ------------------------------------------------------------
    // A GROUP HOLDING A DRAWING IS A DRAWING. A group is one of the
    // AutoMoveKinds, but one that holds a viewport or a dimension - kinds the
    // config leaves out so a drawing or a measurement never travels on a Move
    // nobody asked for - waits for M, exactly as that viewport or dimension
    // does on its own. Nested groups are looked through.
    // ------------------------------------------------------------
    function Na__LeTools__GroupAutoMoves(sheet, groupId, kinds) {
        if (!sheet) return true;
        return Na__LeGroup__Descendants(sheet, groupId).every((member) => member.kind === 'group' || kinds.indexOf(member.kind) !== -1);
    }
    // ------------------------------------------------------------


    // FUNCTION | Would a Select Press Here Pick the Move Tool Up
    // ------------------------------------------------------------
    // ONE ANSWER, READ BY THE PRESS AND BY THE HOVER CURSOR, for the same
    // reason CanMoveWhole is one answer: the cursor promises what the press
    // then does. It is only ever true under Select, or under a Move that came
    // up by itself - a Move that was asked for already moves everything and
    // has nothing to pick up.
    //
    // WHAT PICKS MOVE UP is what is usually moved next: text, a vector, a
    // leader by its bubble, its note or its curve, a group (a parametric one
    // is a group). WHAT DOES NOT is what is usually NOT moved next, or must
    // never move by accident:
    //   a viewport, a dimension   the kinds the config leaves out
    //   a leader's endpoint       it re-points the leader: a grip, not a move
    //   a text item's rotate grip it turns the text
    //   the open vector           a press in there is about its points
    //   anything on a locked layer
    // One of SEVERAL selected items carries them all, so it answers for the
    // whole selection rather than for itself.
    // ------------------------------------------------------------
    function Na__LeTools__PicksUpMove(sheet, found, pointMm) {
        if (!Na__LeTools__Editable || !sheet || !found) return false;
        if (Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT && !Na__LeTools__IsMoveAuto()) return false;
        const setup = Na__LeCfg__GetEditScopeSetup();
        if (!setup.autoMoveOnSelect || !setup.moveToolRequired) return false;   // <-- With the catch off Select drags everything itself, and there is nothing to pick up
        const items = Na__LeModel__GetSelectionItems();
        if (items.length > 1 && Na__LeModel__IsSelected(found.kind, found.id)) return Na__LeTools__SelectionPicksUpMove(items);
        if (Na__LeAnchor__Holds(sheet, found) && !(found.hit && (found.hit.mode === 'handle' || found.hit.mode === 'rotate'))) return true;   // <-- The move anchor is on it; a crop handle and the rotate grip are still grips
        if (setup.autoMoveKinds.indexOf(found.kind) === -1) return false;
        if (found.kind === 'group') return Na__LeTools__GroupAutoMoves(sheet, found.id, setup.autoMoveKinds);   // <-- Its members answer for their own locks when the set is captured; one holding a viewport or a dimension waits for M
        const record = Na__LeTools__Record(sheet, found);
        if (!record) return false;
        if (found.kind === 'annotation') return !Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId) && !(found.hit && found.hit.mode === 'rotate');
        if (found.kind === 'shape')      return !Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId) && Na__LeScope__GetVectorId() !== found.id;
        if (found.kind === 'leader')     return !Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId) && Na__LeGrips__LeaderGrab(record, pointMm, Na__LeTools__Tolerance()) !== 'tip';
        if (found.kind === 'dimension')  return !Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId) && Na__LeScope__GetDimensionId() !== found.id;   // <-- Only if the config lists it
        return !Na__LeTools__IsViewportLocked(sheet, record) && !(found.hit && (found.hit.mode === 'handle' || found.hit.mode === 'rotate')) && Na__LeSurface__GetEditingViewport() !== found.id;   // <-- A viewport, likewise; its crop handles and its rotate grip are grips
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Outline Point a Whole-Shape Drag Is Carried By
    // ------------------------------------------------------------
    // The nearest vertex, or a point on an edge if that is closer, so grabbing
    // a corner snaps that corner and grabbing along a side snaps that side.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeGrabPoint(shape, pointMm) {
        const pts = Na__LeShapeGeo__Points(shape);
        if (!pts.length || !pointMm) return pointMm;
        let best = { x : pts[0][0], y : pts[0][1] };
        let bestD = Math.hypot(pointMm.x - best.x, pointMm.y - best.y);
        pts.forEach((p) => {
            const d = Math.hypot(pointMm.x - p[0], pointMm.y - p[1]);
            if (d < bestD) { best = { x : p[0], y : p[1] }; bestD = d; }
        });
        const edge = Na__LeShapeGeo__ClosestOnEdge(shape, pointMm);
        if (edge && edge.distance < bestD) return { x : edge.x, y : edge.y };
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Point of the Open Container Reaches, in Paper Millimetres
    // ------------------------------------------------------------
    // A FIXED REACH ON SCREEN AT ANY ZOOM. GrabRadiusPx is what the hand is
    // actually aiming at - the grip it can see - so the radius is converted
    // from screen pixels rather than measured in paper millimetres: zoomed
    // right in on a corner, the grab stays exactly as forgiving as it looks.
    // ------------------------------------------------------------
    function Na__LeTools__ScopeGrabMm() {
        const px = Na__LeCfg__GetEditScopeSetup().grabRadiusPx;
        return px / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // FUNCTION | The Open Container, When the Press Is Near One of Its Points
    // ------------------------------------------------------------
    // INSIDE A CONTAINER A PRESS HAS TO FIND THE CONTAINER BEFORE IT CAN FIND A
    // POINT OF IT, and the markup hit test only answers for the LINE. So a press
    // two pixels off the line but dead on a corner found nothing at all, was
    // read as "outside", and started a selection box - right where the hand was
    // trying to grab the corner. It is the GRIPS that are being aimed at, so the
    // grips are what the press is measured against: within the grab radius of a
    // vertex, or of a dimension's grips, the press belongs to the container,
    // line or no line.
    // ------------------------------------------------------------
    function Na__LeTools__ScopeGrabAt(sheet, pointMm) {
        if (!sheet || !pointMm) return null;
        const reach = Na__LeTools__ScopeGrabMm();
        const shapeId = Na__LeScope__GetVectorId();
        if (shapeId) {
            const shape = Na__LeTools__Record(sheet, { kind : 'shape', id : shapeId });
            if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return null;
            return Na__LeShapeGeo__VertexAt(shape, pointMm, reach) >= 0 ? { kind : 'shape', id : shapeId, hit : null } : null;
        }
        const dimId = Na__LeScope__GetDimensionId();
        if (dimId) {
            const dim = Na__LeTools__Record(sheet, { kind : 'dimension', id : dimId });
            if (!dim || Na__LeModel__IsLayerLocked(sheet, dim.Dimension__LayerId)) return null;
            return Na__LeGrips__DimensionGrab(dim, pointMm, reach / 2, sheet) !== 'whole' ? { kind : 'dimension', id : dimId, hit : null } : null;   // <-- DimensionGrab doubles what it is given for the point grips
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Part of a Vector a Press Takes Hold Of
    // ------------------------------------------------------------
    // A VERTEX IS ONLY A VERTEX INSIDE ITS OWN VECTOR. Outside the open
    // container the points are not drawn and cannot be grabbed, so a press
    // anywhere on the vector - corner or not - is a press on the whole thing,
    // and the whole thing only moves under the Move tool. This is the rule
    // that stops a corner being dragged out of shape by a stray click.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeGrabFor(shape, pointMm, toleranceMm) {
        if (!shape || Na__LeScope__GetVectorId() !== shape.Shape__Id) return { mode : 'whole', index : -1 };
        return Na__LeGrips__ShapeGrab(shape, pointMm, Math.max(toleranceMm * Na__LeTools__ScopeGripFactor(), Na__LeTools__ScopeGrabMm()) / 2);   // <-- ShapeGrab doubles it: the effective reach is the grab radius
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Part of a Dimension a Press Takes Hold Of
    // ------------------------------------------------------------
    // THE SAME RULE AS A VECTOR'S POINTS. Outside its container a dimension is
    // one object: every press on it is 'whole', so it selects, and only the
    // Move tool relocates it. Open it and the grips answer - 'start' and 'end'
    // re-pick what is being measured (they snap to the linework), 'offset'
    // slides the line, 'text' moves the value - which is what makes a
    // dimension editable at all rather than something to delete and redraw.
    //
    // Inside the container the grips are found at a wider tolerance, because
    // nothing else on the sheet is competing for the press: missing a corner
    // grip by a pixel and dragging the whole dimension instead was exactly the
    // failure that made them feel untouchable.
    // ------------------------------------------------------------
    function Na__LeTools__DimensionGrabFor(sheet, dim, pointMm, toleranceMm) {
        if (!dim || Na__LeScope__GetDimensionId() !== dim.Dimension__Id) return 'whole';
        return Na__LeGrips__DimensionGrab(dim, pointMm, Math.max(toleranceMm * Na__LeTools__ScopeGripFactor(), Na__LeTools__ScopeGrabMm()) / 2, sheet);   // <-- DimensionGrab doubles it too
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Much Wider a Grip Reads Inside Its Own Container
    // ------------------------------------------------------------
    function Na__LeTools__ScopeGripFactor() {
        return Math.max(1, Na__LeCfg__GetEditScopeSetup().gripToleranceFactor);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Shift-Click Would Insert a Vertex, or Null
    // ------------------------------------------------------------
    // On an edge of the shape, not on a vertex grip, and not so close to
    // either end that the new point would sit on top of one already there.
    // A nearby snap (the linework) wins over the foot on the edge. Only ever
    // on the vector that is open for editing.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeInsertHit(sheet, shape, pointMm) {
        if (!sheet || !shape || !pointMm) return null;
        if (Na__LeScope__GetVectorId() !== shape.Shape__Id) return null;
        const tol = Na__LeTools__Tolerance();
        if (Na__LeShapeGeo__VertexAt(shape, pointMm, tol * 2) >= 0) return null;
        const edge = Na__LeShapeGeo__ClosestOnEdge(shape, pointMm);
        if (!edge || edge.distance > tol) return null;
        const pts = Na__LeShapeGeo__Points(shape);
        const a = pts[edge.index], b = pts[Na__LeShapeGeo__EdgeEnd(shape, edge.index)];   // <-- On a holed shape a ring's closing edge runs back to ITS first point, not on to the next ring's
        const minMm = Na__LeCfg__GetSelectionSetup().dragThresholdMm;
        if (Math.hypot(edge.x - a[0], edge.y - a[1]) < minMm) return null;
        if (Math.hypot(edge.x - b[0], edge.y - b[1]) < minMm) return null;
        const snap = Na__LeOsnap__Find(sheet, { x : edge.x, y : edge.y }, { kind : 'shape', id : shape.Shape__Id });
        return { index : edge.index, point : snap ? [ snap.x, snap.y ] : [ edge.x, edge.y ], snap : snap };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Insert-Vertex Diamond While Shift Is Held Over an Edge
    // ------------------------------------------------------------
    function Na__LeTools__RefreshShapeInsert(sheet, pointMm, shift) {
        if (!shift || !sheet || !pointMm || Na__LeTools__Drag || !Na__LeTools__Editable || Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) === -1) {
            if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker();
            return false;
        }
        const openId = Na__LeScope__GetVectorId();                           // <-- A point is added inside the vector, where the points are
        if (!openId) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const shape = Na__LeTools__Record(sheet, { kind : 'shape', id : openId });
        if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const hit = Na__LeTools__ShapeInsertHit(sheet, shape, pointMm);
        if (!hit) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        Na__LeGrips__ShowInsert(hit.point[0], hit.point[1]);
        if (hit.snap) Na__LeOsnap__ShowMarker(hit.snap); else Na__LeOsnap__HideMarker();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Selected Text Item's Rotate Grip Under a Point, or Null
    // ------------------------------------------------------------
    // Only while the Select tool is up in an editable session, with one text
    // item selected on a visible, unlocked layer. Returns the hit Resolve hands
    // on: { kind : 'annotation', id, hit : { mode : 'rotate' } }.
    // ------------------------------------------------------------
    function Na__LeTools__RotateGripAt(sheet, pointMm) {
        if (!Na__LeTools__Editable || Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) === -1 || !sheet || !pointMm) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'annotation') return null;
        if (!Na__LeScope__Allows(sheet, selection.kind, selection.id)) return null;   // <-- Nothing outside the open container answers a press
        const item = Na__LeTools__Record(sheet, selection);
        if (!item || !Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId) || Na__LeModel__IsLayerLocked(sheet, item.Annotation__LayerId)) return null;
        const grab = Na__LeGrips__AnnotationGrab(item, pointMm, Na__LeTools__Tolerance(), Na__LeSurface__GetPixelsPerMm(), Na__LeSurface__GetZoom());
        return grab === 'rotate' ? { kind : 'annotation', id : selection.id, hit : { mode : 'rotate' } } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Viewport's Rotate Grip Under a Point, or Null
    // ------------------------------------------------------------
    // Asked where the text rotate grip is asked, and for the same reason: the
    // grip stands OFF the frame, over whatever lies beyond its top edge - a
    // note, a title, another drawing - which would otherwise answer first.
    // Only where the grip is drawn (Na__LeHandles__Render): the Select tool
    // up in an editable session, one viewport selected on a visible, pickable
    // layer, not locked, not being edited inside, and no vector or dimension
    // open - a GROUP may be open, with the viewport one of its members.
    // Returns { kind : 'viewport', id, hit : { mode : 'rotate' } }.
    // ------------------------------------------------------------
    function Na__LeTools__ViewportRotateGripAt(sheet, pointMm) {
        if (!Na__LeTools__Editable || Na__LeTools__PICK_TOOLS.indexOf(Na__LeTools__Tool) === -1 || !sheet || !pointMm) return null;
        if (Na__LeScope__IsLeafOpen() || Na__LeModel__GetSelectionItems().length !== 1) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'viewport') return null;
        if (!Na__LeScope__Allows(sheet, 'viewport', selection.id)) return null;   // <-- Inside an open group, only a member turns
        const viewport = Na__LeModel__GetViewportById(sheet, selection.id);
        if (!viewport || !Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId) || !Na__LeModel__IsLayerSelectable(sheet, viewport.Viewport__LayerId)) return null;
        if (Na__LeTools__IsViewportLocked(sheet, viewport) || Na__LeSurface__GetEditingViewport() === viewport.Viewport__Id) return null;
        return Na__LeHandles__OnRotateGrip(viewport, pointMm, Na__LeSurface__GetPixelsPerMm(), Na__LeSurface__GetZoom())
            ? { kind : 'viewport', id : viewport.Viewport__Id, hit : { mode : 'rotate' } }
            : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Grip of the Open Dimension, Wherever It Stands
    // ------------------------------------------------------------
    // A DIMENSION'S MEASURED POINTS ARE NOWHERE NEAR THE DIMENSION. They sit at
    // the far end of the extension lines - the whole point of an offset is to
    // put the line clear of what it measures - so on PS01's D01 they are some
    // 45 mm of paper from the line that would answer a hit test. The markup hit
    // test only knows the line and the value, so a press on a measured point
    // found nothing at all; and with a container open, finding nothing means
    // "the press landed outside, step back out". The grips were drawn, and
    // clicking one closed the dimension instead of taking hold of it.
    //
    // So the open dimension's grips are looked for first, the way the rotate
    // grip above is: both stand off the object they belong to, and neither can
    // be found by asking what lies under the pointer. Only while that dimension
    // is the open container, and never for 'whole', so a press on the line
    // itself still resolves normally.
    // ------------------------------------------------------------
    function Na__LeTools__OpenDimensionGripAt(sheet, pointMm) {
        const id = Na__LeScope__GetDimensionId();
        if (!id || !sheet || !pointMm) return null;
        const dim = (sheet.Sheet__Dimensions || []).find((d) => d.Dimension__Id === id);
        if (!dim) return null;
        const mode = Na__LeGrips__DimensionGrab(dim, pointMm, Na__LeTools__Tolerance() * Na__LeTools__ScopeGripFactor(), sheet);
        return (mode && mode !== 'whole') ? { kind : 'dimension', id : id, hit : null } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Select Tool Finds Under a Point
    // ------------------------------------------------------------
    // Returns { kind : 'dimension'|'annotation'|'shape'|'leader'|'viewport', id, hit }
    // or null. Markup wins over viewports, and the markup bridge orders it
    // dimensions, text, shapes, leaders.
    //
    // includeLocked: the eyedropper may READ locked markup (a locked scrapbook
    // is still a source). skipLockedViewports: a locked viewport is not there
    // at all - it covers the sheet, and detecting it over everything else is
    // not useful once the frame is locked.
    // ------------------------------------------------------------
    function Na__LeTools__Resolve(sheet, pointMm, includeLocked, skipLockedViewports, keepMember) {
        const turning = includeLocked === true ? null : Na__LeTools__RotateGripAt(sheet, pointMm);   // <-- The rotate grip first: it stands off its text, over whatever lies beneath
        if (turning) return turning;
        const spinning = includeLocked === true ? null : Na__LeTools__ViewportRotateGripAt(sheet, pointMm);   // <-- A viewport's rotate grip likewise stands off its frame
        if (spinning) return spinning;
        const measured = includeLocked === true ? null : Na__LeTools__OpenDimensionGripAt(sheet, pointMm);   // <-- And the open dimension's grips, which stand off it further still
        if (measured) return measured;
        // A POINT OF THE OPEN CONTAINER COMES FIRST | Before the line, because a
        // grip stands proud of the line and is the thing being aimed at.
        const grabbed = (includeLocked === true || keepMember === true) ? null : Na__LeTools__ScopeGrabAt(sheet, pointMm);
        if (grabbed) return grabbed;

        const markup = Na__LeMarkup__HitTest(sheet, pointMm, Na__LeTools__Tolerance(), includeLocked === true);   // <-- The eyedropper reads locked markup; nothing else touches it
        if (markup) return keepMember === true ? { kind : markup.kind, id : markup.id, hit : null } : Na__LeScope__Resolve(sheet, { kind : markup.kind, id : markup.id, hit : null });

        // A VECTOR OR A DIMENSION IS OPEN | It holds points, and no viewport is
        // ever inside one, so there is nothing left below the markup to find:
        // the press has landed outside, and the press handler reads that null
        // as "step back out". An open GROUP may hold viewports, so the frames
        // below are still asked - each through the scope, which answers null
        // for one outside the group. The eyedropper (keepMember) still reads
        // the whole sheet, because matching a style changes nothing and
        // refusing it would be a puzzle.
        // ------------------------------------
        const scoped = keepMember !== true && Na__LeScope__IsActive();
        if (scoped && Na__LeScope__IsLeafOpen()) return null;

        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom();
        const selection = Na__LeModel__GetSelection();
        const selected  = (selection && selection.kind === 'viewport') ? Na__LeModel__GetViewportById(sheet, selection.id) : null;
        if (selected && Na__LeModel__IsLayerVisible(sheet, selected.Viewport__LayerId) && Na__LeModel__IsLayerSelectable(sheet, selected.Viewport__LayerId)
                && !(skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, selected))
                && (!scoped || Na__LeScope__Allows(sheet, 'viewport', selected.Viewport__Id))) {
            const hit = Na__LeHandles__HitTest(selected, pointMm, ppm, zoom, true);
            if (hit) return { kind : 'viewport', id : selected.Viewport__Id, hit : hit };
        }
        const ordered = Na__LeHandles__FrontToBack(sheet);
        for (let i = 0; i < ordered.length; i++) {
            if (!Na__LeModel__IsLayerSelectable(sheet, ordered[i].Viewport__LayerId)) continue;   // <-- A reference layer's frame is not there to the pointer at all
            if (skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, ordered[i])) continue;   // <-- Look through a locked frame
            if (!Na__LeHandles__Contains(ordered[i], pointMm)) continue;
            const frame = { kind : 'viewport', id : ordered[i].Viewport__Id, hit : null };
            // A GROUPED FRAME ANSWERS AS ITS GROUP, the way a grouped note or
            // vector does (Na__LeScope__Resolve): at the sheet the outermost
            // group, inside an open group the member, outside it nothing - and
            // then the frames behind are asked, since a frame outside the group
            // is faded and inert. A LOCKED frame at the sheet stays background:
            // a press on it still starts a box, grouped or not.
            if (keepMember === true || (!scoped && Na__LeTools__IsViewportLocked(sheet, ordered[i]))) return frame;
            const resolved = Na__LeScope__Resolve(sheet, frame);
            if (resolved) return resolved;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Item Really Under a Point, Containers Ignored
    // ------------------------------------------------------------
    // Resolve answers for where we ARE - inside an open container it refuses
    // everything outside it. This answers for where the PAPER is: the markup
    // item itself, group or no group. It is what decides how far a press
    // outside an open container steps back out (Na__LayoutEditor__EditScope__
    // ExitTo), because that question is about the sheet, not about the level.
    // With no markup there, the frontmost pickable viewport frame: a viewport
    // can be a group's member, so a click on one inside an outer group steps
    // back out to that group rather than out of everything.
    // ------------------------------------------------------------
    function Na__LeTools__RawHit(sheet, pointMm) {
        if (!sheet || !pointMm) return null;
        const markup = Na__LeMarkup__HitTest(sheet, pointMm, Na__LeTools__Tolerance(), false);
        if (markup) return { kind : markup.kind, id : markup.id };
        const frame = Na__LeHandles__FrontToBack(sheet).find((viewport) => Na__LeModel__IsLayerSelectable(sheet, viewport.Viewport__LayerId) && Na__LeHandles__Contains(viewport, pointMm));
        return frame ? { kind : 'viewport', id : frame.Viewport__Id } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Records Behind a Resolved Hit
    // ------------------------------------------------------------
    function Na__LeTools__Record(sheet, found) {
        if (!found) return null;
        if (found.kind === 'annotation') return sheet.Sheet__Annotations.find((a) => a.Annotation__Id === found.id) || null;
        if (found.kind === 'dimension')  return sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === found.id) || null;
        if (found.kind === 'shape')      return sheet.Sheet__Shapes.find((s) => s.Shape__Id === found.id) || null;
        if (found.kind === 'leader')     return (sheet.Sheet__Leaders || []).find((l) => l.Leader__Id === found.id) || null;
        return Na__LeModel__GetViewportById(sheet, found.id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Viewport Is Locked by Its Own Flag or by Its Layer
    // ------------------------------------------------------------
    function Na__LeTools__IsViewportLocked(sheet, viewport) {
        return !!viewport && (viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Door Under the Pointer in the Selected Plan Viewport, or Null
    // ------------------------------------------------------------
    // Only the ONE selected 2D viewport answers, and only while it can be
    // edited: the first click on a plan selects it as it always did, and once
    // it is selected a click on a door closes or opens that door. A handle is a
    // crop, never a door.
    // ------------------------------------------------------------
    function Na__LeTools__DoorAt(sheet, found, pointMm) {
        if (!Na__LeTools__Editable || !found || found.kind !== 'viewport' || !Na__LeDoors__ClickToggles()) return null;
        if (found.hit && (found.hit.mode === 'handle' || found.hit.mode === 'rotate')) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'viewport' || selection.id !== found.id) return null;
        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_2D) return null;          // <-- Locked or not: a lock holds the frame, not the doors
        return Na__LeDoors__At(viewport, Na__LeVp2d__Describe(viewport), pointMm, Na__LeTools__Tolerance());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor for What Is Under the Pointer
    // ------------------------------------------------------------
    function Na__LeTools__HoverCursor(sheet, found, pointMm) {
        // THE CURSOR SAYS WHICH TOOL IS UP. Under Move everything movable wears
        // the four-way arrow, so there is never a doubt that the next drag will
        // relocate something. Under Select the same things wear the plain arrow,
        // because a drag on them does nothing at all; only the grips - which
        // Select does work - sharpen to a crosshair.
        //
        // A MOVE THAT CAME UP BY ITSELF PROMISES NO MORE THAN SELECT DOES. It
        // will go back to Select on a press on a viewport, a dimension or bare
        // paper, so it shows the four-way arrow only where a press really would
        // move something (PicksUpMove) - and Select shows it in exactly the same
        // places, because a Select press there picks Move up and the drag
        // carries on. Only a Move that was asked for wears the arrow everywhere.
        const moving = Na__LeTools__CanMoveWhole() && !Na__LeTools__IsMoveAuto();
        const rest   = moving ? (Na__LeTools__Tool === Na__LeTools__TOOL_MOVE ? Na__LeGrips__MOVE_CURSOR : 'move')
                              : (Na__LeTools__PicksUpMove(sheet, found, pointMm) ? Na__LeGrips__MOVE_CURSOR : '');
        if (!found) return rest;
        if (found.kind === 'group') return Na__LeTools__Editable ? rest : 'default';
        const record = Na__LeTools__Record(sheet, found);
        if (!record || !Na__LeTools__Editable) return 'default';
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return 'default';
            return (found.hit && found.hit.mode === 'rotate') ? Na__LeGrips__ROTATE_CURSOR : rest;
        }
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return 'default';
            const grab = Na__LeTools__DimensionGrabFor(sheet, record, pointMm, tol);
            if (grab === 'whole') return rest;
            return grab === 'text' ? 'move' : 'crosshair';                   // <-- The value is dragged by either tool: a grip, not a relocation
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return 'default';
            return Na__LeTools__ShapeGrabFor(record, pointMm, tol).mode === 'whole' ? rest : 'crosshair';
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return 'default';
            const grab = Na__LeGrips__LeaderGrab(record, pointMm, tol);
            if (grab === 'whole') return rest;
            return grab === 'tip' ? 'crosshair' : (rest || 'move');          // <-- The head wears the Move tool's own arrow wherever a press there brings Move up; with that turned off it is still a grip Select drags
        }
        if (Na__LeTools__DoorAt(sheet, found, pointMm)) return 'pointer';     // <-- A click here closes or opens that door, locked or not
        if (Na__LeTools__IsViewportLocked(sheet, record)) return 'default';
        if (Na__LeSurface__GetEditingViewport() === found.id) return 'grab';
        if (found.hit && found.hit.mode === 'rotate') return Na__LeGrips__ROTATE_CURSOR;   // <-- The text rotate grip's own cursor: this one turns a viewport
        if (found.hit && found.hit.mode === 'handle') return Na__LeHandles__CursorFor(found.hit, record);   // <-- The arrow turns with a turned frame
        return rest;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Viewport a Press Here May Carry by a Point, or Null
    // ------------------------------------------------------------
    // Everything that already owns a press on a viewport wins over the carry:
    // a handle crops, content editing pans the drawing, a lock refuses, and one
    // of several selected items moves with the rest. Only a press that would
    // otherwise have moved the frame the plain way is offered to the snap move.
    // ------------------------------------------------------------
    function Na__LeTools__CarryTarget(sheet, found) {
        if (!Na__LeTools__Editable || !found || found.kind !== 'viewport') return null;
        if (found.hit && (found.hit.mode === 'handle' || found.hit.mode === 'rotate')) return null;   // <-- A crop handle crops and the rotate grip turns
        if (Na__LeModel__GetSelectionItems().length > 1 && Na__LeModel__IsSelected(found.kind, found.id)) return null;
        if (Na__LeSurface__GetEditingViewport() === found.id) return null;
        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        return (viewport && !Na__LeTools__IsViewportLocked(sheet, viewport)) ? viewport : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Hit Resolution
    // ------------------------------------------------------------
    export {
        Na__LeTools__Tolerance,
        Na__LeTools__ScopeGrabMm,
        Na__LeTools__ScopeGrabAt,
        Na__LeTools__CanMoveWhole,
        Na__LeTools__SelectionPicksUpMove,
        Na__LeTools__PicksUpMove,
        Na__LeTools__ShapeGrabPoint,
        Na__LeTools__ShapeGrabFor,
        Na__LeTools__DimensionGrabFor,
        Na__LeTools__ShapeInsertHit,
        Na__LeTools__RefreshShapeInsert,
        Na__LeTools__Resolve,
        Na__LeTools__RawHit,
        Na__LeTools__Record,
        Na__LeTools__IsViewportLocked,
        Na__LeTools__DoorAt,
        Na__LeTools__HoverCursor,
        Na__LeTools__CarryTarget
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
