// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - GRID DRAG
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__GridDrag__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Grid Drag
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A moved item lands on the drawing grid by the point it was picked up from, as in SketchUp LayOut
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE RULE IS LAYOUT'S (2024 onwards): a moved entity is "inferenced by the
//   point it was picked up from". Pressed near one of its corners, one of its
//   midpoints or - a filled shape - its centre, that point is what it is
//   carried by; pressed anywhere else, the point pressed. While Grid Snap is
//   on (F7) that point lands on the nearest grid point, and the item moves by
//   however far that is. Adam: "the point you select and drag from will then
//   snap to the nearest point". The inference needs Object Snap on (F3), as
//   LayOut's does; with it off, the point pressed is the point carried.
// - GridGrabPoint works the point out once per drag, from where the item was
//   when it was pressed, and keeps it on the drag record.
// - GridDragDelta is for the drags that have no snap of their own: a text
//   item, a leader moved whole or by its head, a dimension moved whole, a
//   viewport frame moved the plain way, and a crop handle (carried by the
//   handle itself). It runs FIRST in ApplyDrag, so an arrow-key lock, Shift
//   and Ortho then hold the grid step to their axis. Grid first, then the
//   constraint, is a choice made here - neither LayOut nor AutoCAD documents
//   an order - and it keeps a held move in whole grid steps along its axis.
//   A vector moved whole under an arrow-key lock takes it too, because that
//   path snaps to nothing else.
// - GridTranslation is the fallback for the drags that DO snap to objects - a
//   vector and a selection set moved whole (Na__LayoutEditor__SheetTools__
//   HitResolution__) - when no object snap is in reach. The object snap always
//   wins; the grid answers everywhere else.
// - Everything else is left alone here: a vertex, a dimension's end and a
//   leader's tip snap through Na__LeOsnap__Snap, which now falls back to the
//   grid itself; a dimension line's offset through the Dimension tool; a
//   viewport carried by a point of its linework through its own solver.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerDrag__ calls GridDragDelta at the top
//   of ApplyDrag; HitResolution's SnapShapeTranslation and
//   SnapGroupTranslation call GridTranslation when they find no object snap.
// - Reads the grid from Na__LayoutEditor__DrawingGrid__State__ (a leaf) and
//   imports nothing from the other sheet tools units, so none of them can
//   close a cycle through it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the point a drag is carried by, the grid step for
//   the drags with no snap of their own, and the grid fallback for the drags
//   with one.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Shape Geometry, Snapping, Axis Lock and the Grid
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetViewportById } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeShapeGeo__Points } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeOsnap__KIND_GRID, Na__LeOsnap__IsEnabled, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeAxis__Get } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeGrid__IsSnapping, Na__LeGrid__Nearest } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Candidate Kinds
    // ------------------------------------------------------------
    const Na__LeGridDrag__CORNER    = 0;         // <-- A corner, an end, an anchor: wins a near tie
    const Na__LeGridDrag__MIDDLE    = 1;         // <-- A midpoint or a centre
    const Na__LeGridDrag__MID_WEIGHT = 1.25;     // <-- The snapping module's own endpoint preference
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Point a Drag Is Carried By
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Rectangle's Four Corners, the Middle of Each Side and Its Centre
    // ------------------------------------------------------------
    function Na__LeGridDrag__RectPoints(add, x, y, w, h) {
        add(x, y, Na__LeGridDrag__CORNER);         add(x + w, y, Na__LeGridDrag__CORNER);
        add(x + w, y + h, Na__LeGridDrag__CORNER); add(x, y + h, Na__LeGridDrag__CORNER);
        add(x + (w / 2), y, Na__LeGridDrag__MIDDLE);     add(x + w, y + (h / 2), Na__LeGridDrag__MIDDLE);
        add(x + (w / 2), y + h, Na__LeGridDrag__MIDDLE); add(x, y + (h / 2), Na__LeGridDrag__MIDDLE);
        add(x + (w / 2), y + (h / 2), Na__LeGridDrag__MIDDLE);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Vector's Corners and Edge Midpoints, and Its Centre When It Is Filled
    // ------------------------------------------------------------
    // LayOut offers a shape's centre only when the shape has a fill: there is
    // nothing at the middle of an outline to aim at.
    // ------------------------------------------------------------
    function Na__LeGridDrag__ShapePoints(add, points, closed, filled) {
        const n = points.length;
        points.forEach((p) => add(p[0], p[1], Na__LeGridDrag__CORNER));
        const edges = (closed && n > 2) ? n : n - 1;
        for (let i = 0; i < edges; i++) {
            const a = points[i], b = points[(i + 1) % n];
            add((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Na__LeGridDrag__MIDDLE);
        }
        if (filled && closed && n > 2) {
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            points.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
            add((x0 + x1) / 2, (y0 + y1) / 2, Na__LeGridDrag__MIDDLE);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Point an Item Can Be Picked Up By, Where It Was at the Press
    // ------------------------------------------------------------
    // From the drag record's own snapshot, never the live record: by the first
    // move the item may already have been moved once.
    // ------------------------------------------------------------
    function Na__LeGridDrag__Candidates(sheet, drag) {
        const out = [];
        const add = (x, y, kind) => { if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x : x, y : y, kind : kind }); };
        const s   = drag.start;
        if (drag.kind === 'annotation' && s) add(s.x, s.y, Na__LeGridDrag__CORNER);
        else if (drag.kind === 'leader' && s) {
            if (drag.mode !== 'anchor') add(s.tx, s.ty, Na__LeGridDrag__CORNER);   // <-- The head moved alone is carried by the head
            add(s.ax, s.ay, Na__LeGridDrag__CORNER);
        } else if (drag.kind === 'dimension' && s) {
            add(s.sx, s.sy, Na__LeGridDrag__CORNER); add(s.ex, s.ey, Na__LeGridDrag__CORNER);
            add((s.sx + s.ex) / 2, (s.sy + s.ey) / 2, Na__LeGridDrag__MIDDLE);
        } else if (drag.kind === 'shape' && Array.isArray(s)) {
            const shape  = (sheet && sheet.Sheet__Shapes || []).find((item) => item.Shape__Id === drag.id) || null;
            const closed = !!shape && shape.Shape__Closed === true;
            Na__LeGridDrag__ShapePoints(add, s, closed, closed && !!shape.Shape__FillColour);
        } else if (drag.kind === 'viewport' && s && s.rect) {
            Na__LeGridDrag__RectPoints(add, s.rect.X, s.rect.Y, s.rect.WidthMm, s.rect.HeightMm);
        } else if (drag.kind === 'group') {
            (drag.group || []).forEach((entry) => {
                const g = entry.start || {};
                if (entry.kind === 'shape' && Array.isArray(g.points)) g.points.forEach((p) => add(p[0], p[1], Na__LeGridDrag__CORNER));
                else if (entry.kind === 'dimension') { add(g.sx, g.sy, Na__LeGridDrag__CORNER); add(g.ex, g.ey, Na__LeGridDrag__CORNER); }
                else if (entry.kind === 'viewport') {
                    const record = sheet ? Na__LeModel__GetViewportById(sheet, entry.id) : null;
                    if (record) Na__LeGridDrag__RectPoints(add, g.x, g.y, record.Viewport__FrameMm.WidthMm, record.Viewport__FrameMm.HeightMm);
                } else {
                    add(g.x, g.y, Na__LeGridDrag__CORNER);
                    if (g.tipFollows) add(g.tipX, g.tipY, Na__LeGridDrag__CORNER);
                }
            });
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Crop Handle Sits on Its Frame
    // ------------------------------------------------------------
    // A handle is carried by itself: an edge handle by the middle of its edge,
    // a corner by its corner. The axis a handle does not move is ignored by the
    // crop, so rounding it to the grid as well changes nothing.
    // ------------------------------------------------------------
    function Na__LeGridDrag__HandlePoint(rect, key) {
        const k = String(key || '');
        return {
            x : k.indexOf('l') >= 0 ? rect.X : (k.indexOf('r') >= 0 ? rect.X + rect.WidthMm  : rect.X + (rect.WidthMm  / 2)),
            y : k.indexOf('t') >= 0 ? rect.Y : (k.indexOf('b') >= 0 ? rect.Y + rect.HeightMm : rect.Y + (rect.HeightMm / 2))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Point This Drag Is Carried By (worked out once, kept on the drag)
    // ------------------------------------------------------------
    // The nearest of the item's own points inside the snap radius of the
    // press - a corner beating a midpoint at a near tie - while Object Snap is
    // on; otherwise, or with none in reach, the point pressed. A crop handle is
    // always carried by the handle.
    // ------------------------------------------------------------
    function Na__LeTools__GridGrabPoint(sheet, drag) {
        if (!drag || !drag.startMm) return null;
        if (drag.gridGrabMm) return drag.gridGrabMm;
        let grab = { x : drag.startMm.x, y : drag.startMm.y };
        if (drag.kind === 'viewport' && drag.hit && drag.hit.mode === 'handle' && drag.start && drag.start.rect) {
            grab = Na__LeGridDrag__HandlePoint(drag.start.rect, drag.hit.key);
        } else if (Na__LeOsnap__IsEnabled()) {
            const radius = Na__LeCfg__GetSnappingSetup().radiusPx / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
            let best = null;
            Na__LeGridDrag__Candidates(sheet, drag).forEach((c) => {
                const d = Math.hypot(c.x - drag.startMm.x, c.y - drag.startMm.y);
                if (d > radius) return;
                const score = d * (c.kind === Na__LeGridDrag__MIDDLE ? Na__LeGridDrag__MID_WEIGHT : 1);
                if (!best || score < best.score) best = { x : c.x, y : c.y, score : score };
            });
            if (best) grab = { x : best.x, y : best.y };
        }
        drag.gridGrabMm = grab;
        return grab;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Grid Step
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This a Drag With No Snap of Its Own, That the Grid Moves
    // ------------------------------------------------------------
    function Na__LeGridDrag__Plain(drag) {
        if (!drag) return false;
        if (drag.kind === 'annotation') return drag.mode !== 'rotate';
        if (drag.kind === 'leader')     return drag.mode === 'whole' || drag.mode === 'anchor';   // <-- The tip snaps through the snapping module
        if (drag.kind === 'dimension')  return drag.mode === 'whole';                              // <-- Its ends snap there too; its line offset in the Dimension tool
        if (drag.kind === 'viewport')   return !!drag.hit && ((drag.hit.mode === 'border' && !drag.baseMm) || drag.hit.mode === 'handle');   // <-- A carried frame has its own solver
        if (drag.kind === 'shape')      return drag.mode === 'whole' && !!Na__LeAxis__Get();       // <-- Under an arrow lock a whole vector snaps to nothing else
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drag, Put in Whole Grid Steps by the Point It Is Carried By
    // ------------------------------------------------------------
    // dMm is the pointer's travel from the press, in paper millimetres. While
    // Grid Snap is on, and for the drags that have no snap of their own, it
    // comes back as the travel that puts the carried point on the grid point
    // nearest where the pointer has taken it. Everything else, and everything
    // with Grid Snap off, gets dMm back untouched.
    // ------------------------------------------------------------
    function Na__LeTools__GridDragDelta(sheet, drag, dMm) {
        if (!dMm || !Na__LeGrid__IsSnapping() || !Na__LeGridDrag__Plain(drag)) return dMm;
        const grab = Na__LeTools__GridGrabPoint(sheet, drag);
        if (!grab) return dMm;
        const at = Na__LeGrid__Nearest({ x : grab.x + dMm.x, y : grab.y + dMm.y });
        return { x : at.x - grab.x, y : at.y - grab.y };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Move No Object Snap Reached, Put on the Grid by the Point It Is Carried By
    // ------------------------------------------------------------
    // delta is the translation the move would otherwise take (already held to
    // an axis when one is locked); lock is 'x', 'y' or null, the axis the move
    // is held TO - its other coordinate is kept exactly as delta has it, so a
    // held move stays on its line. The ring marks where the carried point
    // lands. With Grid Snap off, delta comes back as it was and the marker
    // goes, which is what the callers did before the grid existed.
    // ------------------------------------------------------------
    function Na__LeTools__GridTranslation(sheet, drag, delta, lock) {
        if (!Na__LeGrid__IsSnapping()) { Na__LeOsnap__HideMarker(); return delta; }
        const grab = Na__LeTools__GridGrabPoint(sheet, drag);
        if (!grab) { Na__LeOsnap__HideMarker(); return delta; }
        const at   = Na__LeGrid__Nearest({ x : grab.x + delta.x, y : grab.y + delta.y });
        const move = { x : lock === 'y' ? delta.x : at.x - grab.x, y : lock === 'x' ? delta.y : at.y - grab.y };
        Na__LeOsnap__ShowMarker({ x : grab.x + move.x, y : grab.y + move.y, kind : Na__LeOsnap__KIND_GRID });
        return move;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Grid Drag
    // ------------------------------------------------------------
    export {
        Na__LeTools__GridGrabPoint,
        Na__LeTools__GridDragDelta,
        Na__LeTools__GridTranslation
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
