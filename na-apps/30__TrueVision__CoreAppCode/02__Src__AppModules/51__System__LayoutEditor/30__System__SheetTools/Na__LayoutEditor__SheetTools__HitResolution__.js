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
//   (RefreshShapeInsert), and the snap that moves a whole shape by its
//   nearest vertex or its grab point (SnapShapeTranslation).
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
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Grips, Shape Geometry, Viewports, Plan Doors, Snapping, Groups
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom, Na__LeSurface__GetEditingViewport } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeHandles__HitTest,
        Na__LeHandles__Contains,
        Na__LeHandles__CursorFor,
        Na__LeHandles__FrontToBack
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__HitTest } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGrips__DimensionGrab, Na__LeGrips__ShapeGrab, Na__LeGrips__LeaderGrab, Na__LeGrips__AnnotationGrab, Na__LeGrips__ROTATE_CURSOR, Na__LeGrips__ShowInsert, Na__LeGrips__HideInsert } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__VertexAt, Na__LeShapeGeo__ClosestOnEdge } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeVp2d__Describe } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeDoors__ClickToggles, Na__LeDoors__At } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeOsnap__Find, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGroup__Resolve } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools State and Tool State
    // ------------------------------------------------------------
    import { Na__LeTools__TOOL_SELECT, Na__LeTools__Editable, Na__LeTools__Drag } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__Tool } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Tolerance and Vector Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Hit Tolerance in Paper Millimetres at the Current Zoom
    // ------------------------------------------------------------
    function Na__LeTools__Tolerance() { return Na__LeCfg__GetSelectionSetup().hitToleranceMm / Na__LeSurface__GetZoom(); }
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


    // HELPER FUNCTION | Where a Shift-Click Would Insert a Vertex, or Null
    // ------------------------------------------------------------
    // On an edge of the shape, not on a vertex grip, and not so close to
    // either end that the new point would sit on top of one already there.
    // A nearby snap (the linework) wins over the foot on the edge.
    // ------------------------------------------------------------
    function Na__LeTools__ShapeInsertHit(sheet, shape, pointMm) {
        if (!sheet || !shape || !pointMm) return null;
        const tol = Na__LeTools__Tolerance();
        if (Na__LeShapeGeo__VertexAt(shape, pointMm, tol * 2) >= 0) return null;
        const edge = Na__LeShapeGeo__ClosestOnEdge(shape, pointMm);
        if (!edge || edge.distance > tol) return null;
        const pts = Na__LeShapeGeo__Points(shape);
        const a = pts[edge.index], b = pts[(edge.index + 1) % pts.length];
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
        if (!shift || !sheet || !pointMm || Na__LeTools__Drag || !Na__LeTools__Editable || Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT) {
            if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker();
            return false;
        }
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape') { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const shape = Na__LeTools__Record(sheet, selection);
        if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        const hit = Na__LeTools__ShapeInsertHit(sheet, shape, pointMm);
        if (!hit) { if (Na__LeGrips__HideInsert()) Na__LeOsnap__HideMarker(); return false; }
        Na__LeGrips__ShowInsert(hit.point[0], hit.point[1]);
        if (hit.snap) Na__LeOsnap__ShowMarker(hit.snap); else Na__LeOsnap__HideMarker();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Translate a Whole Shape So a Vertex or the Grab Point Snaps
    // ------------------------------------------------------------
    // Every vertex and the press's grab point are offered at the axis-locked
    // delta; the nearest snap wins, and the translation puts THAT point on it.
    // The shape being moved is excluded, so a corner never snaps to itself.
    // ------------------------------------------------------------
    function Na__LeTools__SnapShapeTranslation(sheet, drag, dMm, shift) {
        const axis = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? { x : dMm.x, y : 0 } : { x : 0, y : dMm.y }) : dMm;
        const exclude = { kind : 'shape', id : drag.id };
        let best = null;
        const offer = (ox, oy) => {
            const hit = Na__LeOsnap__Find(sheet, { x : ox + axis.x, y : oy + axis.y }, exclude);
            if (hit && (!best || hit.score < best.score)) best = { hit : hit, ox : ox, oy : oy };
        };
        if (drag.baseMm) offer(drag.baseMm.x, drag.baseMm.y);
        (drag.start || []).forEach((p) => offer(p[0], p[1]));
        if (!best) { Na__LeOsnap__HideMarker(); return axis; }
        Na__LeOsnap__ShowMarker(best.hit);
        return { x : best.hit.x - best.ox, y : best.hit.y - best.oy };
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
        if (!Na__LeTools__Editable || Na__LeTools__Tool !== Na__LeTools__TOOL_SELECT || !sheet || !pointMm) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'annotation') return null;
        const item = Na__LeTools__Record(sheet, selection);
        if (!item || !Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId) || Na__LeModel__IsLayerLocked(sheet, item.Annotation__LayerId)) return null;
        const grab = Na__LeGrips__AnnotationGrab(item, pointMm, Na__LeTools__Tolerance(), Na__LeSurface__GetPixelsPerMm(), Na__LeSurface__GetZoom());
        return grab === 'rotate' ? { kind : 'annotation', id : selection.id, hit : { mode : 'rotate' } } : null;
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
        const markup = Na__LeMarkup__HitTest(sheet, pointMm, Na__LeTools__Tolerance(), includeLocked === true);   // <-- The eyedropper reads locked markup; nothing else touches it
        if (markup) return keepMember === true ? { kind : markup.kind, id : markup.id, hit : null } : Na__LeGroup__Resolve(sheet, { kind : markup.kind, id : markup.id, hit : null });
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom();
        const selection = Na__LeModel__GetSelection();
        const selected  = (selection && selection.kind === 'viewport') ? Na__LeModel__GetViewportById(sheet, selection.id) : null;
        if (selected && Na__LeModel__IsLayerVisible(sheet, selected.Viewport__LayerId)
                && !(skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, selected))) {
            const hit = Na__LeHandles__HitTest(selected, pointMm, ppm, zoom, true);
            if (hit) return { kind : 'viewport', id : selected.Viewport__Id, hit : hit };
        }
        const ordered = Na__LeHandles__FrontToBack(sheet);
        for (let i = 0; i < ordered.length; i++) {
            if (skipLockedViewports && Na__LeTools__IsViewportLocked(sheet, ordered[i])) continue;   // <-- Look through a locked frame
            if (Na__LeHandles__Contains(ordered[i], pointMm)) return { kind : 'viewport', id : ordered[i].Viewport__Id, hit : null };
        }
        return null;
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
        if (found.hit && found.hit.mode === 'handle') return null;
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
        if (!found) return '';
        if (found.kind === 'group') return Na__LeTools__Editable ? 'move' : 'default';
        const record = Na__LeTools__Record(sheet, found);
        if (!record || !Na__LeTools__Editable) return 'default';
        const tol = Na__LeTools__Tolerance();
        if (found.kind === 'annotation') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId)) return 'default';
            return (found.hit && found.hit.mode === 'rotate') ? Na__LeGrips__ROTATE_CURSOR : 'move';
        }
        if (found.kind === 'dimension') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Dimension__LayerId)) return 'default';
            const grab = Na__LeGrips__DimensionGrab(record, pointMm, tol, sheet);
            return (grab === 'whole' || grab === 'text') ? 'move' : 'crosshair';
        }
        if (found.kind === 'shape') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId)) return 'default';
            return Na__LeGrips__ShapeGrab(record, pointMm, tol).mode === 'whole' ? 'move' : 'crosshair';
        }
        if (found.kind === 'leader') {
            if (Na__LeModel__IsLayerLocked(sheet, record.Leader__LayerId)) return 'default';
            return Na__LeGrips__LeaderGrab(record, pointMm, tol) === 'tip' ? 'crosshair' : 'move';
        }
        if (Na__LeTools__DoorAt(sheet, found, pointMm)) return 'pointer';     // <-- A click here closes or opens that door, locked or not
        if (Na__LeTools__IsViewportLocked(sheet, record)) return 'default';
        if (Na__LeSurface__GetEditingViewport() === found.id) return 'grab';
        if (found.hit && found.hit.mode === 'handle') return Na__LeHandles__CursorFor(found.hit);
        return 'move';
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
        if (found.hit && found.hit.mode === 'handle') return null;
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
        Na__LeTools__ShapeGrabPoint,
        Na__LeTools__ShapeInsertHit,
        Na__LeTools__RefreshShapeInsert,
        Na__LeTools__SnapShapeTranslation,
        Na__LeTools__Resolve,
        Na__LeTools__Record,
        Na__LeTools__IsViewportLocked,
        Na__LeTools__DoorAt,
        Na__LeTools__HoverCursor,
        Na__LeTools__CarryTarget
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
