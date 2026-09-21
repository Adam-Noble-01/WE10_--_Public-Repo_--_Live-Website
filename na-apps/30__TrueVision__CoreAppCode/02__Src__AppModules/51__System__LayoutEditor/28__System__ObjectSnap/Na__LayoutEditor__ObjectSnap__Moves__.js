// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - MOVES
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Moves__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Moves
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : How a vector, or a whole selection, moved as one snaps: whichever of its own points comes nearest a snap point lands on it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A POINT BEING PLACED HAS ONE PLACE TO SNAP FROM: the cursor. A thing being
//   MOVED has many - every corner of it could be the one that matters - so a
//   move tries them all. Every vertex of the vector (or every point of every
//   member of the selection) is offered at where the move would put it, the
//   nearest snap wins, and the move becomes whatever puts THAT point exactly
//   on it. What is moving is left out of the search, so a corner never snaps
//   to itself.
// - A HELD AXIS STAYS HELD THROUGH A SNAP. While Shift, Ortho (F8) or an arrow
//   key holds the move to an axis, the snap supplies only the coordinate ALONG
//   that axis: the corner lines up with what it snapped to and the move stays
//   on its line - the rule a vertex and a dimension end already keep.
// - WITH NO OBJECT SNAP IN REACH the drawing grid answers, when Grid Snap is
//   on (Na__LayoutEditor__ObjectSnap__GridMoves__).
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerDrag__ (ApplyDrag) calls
//   ShapeTranslation for a vector moved whole and GroupTranslation for a
//   selection moved as one.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : moved 21-Sep-2026 from
//                   30__System__SheetTools/Na__LayoutEditor__SheetTools__HitResolution__.js
//                   1.6.0, where they were Na__LeTools__SnapShapeTranslation and
//                   Na__LeTools__SnapGroupTranslation. The code is verbatim.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Moved here from the sheet tools' hit resolution with the rest of the
//   snapping; renamed into the Na__LeOsnap namespace.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Search, the Marker and the Grid Fallback
    // ------------------------------------------------------------
    import { Na__LeOsnap__Find, Na__LeOsnap__FindOnViewport, Na__LeOsnap__ShowMarker } from './Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeOsnap__GridTranslation } from './Na__LayoutEditor__ObjectSnap__GridMoves__.js';   // <-- No object snap in reach: the drawing grid (F7) carries the move
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Whole-Object Moves
// -----------------------------------------------------------------------------

    // FUNCTION | Translate a Whole Shape So a Vertex or the Grab Point Snaps
    // ------------------------------------------------------------
    // Every vertex and the press's grab point are offered at the axis-locked
    // delta; the nearest snap wins, and the translation puts THAT point on it.
    // The shape being moved is excluded, so a corner never snaps to itself.
    //
    // A HELD AXIS STAYS HELD THROUGH A SNAP. shift is what holds the nearer
    // axis - a held Shift, or Ortho (F8) - and while it holds one the snap
    // supplies only the coordinate ALONG that axis: the corner lines up with
    // what it snapped to and the move stays on its line, the rule a vertex, a
    // dimension end and a selection moved as one already keep. The snap used
    // to win outright, so a vector moved "along the inferred lock" jumped off
    // it the moment a corner came within reach of the linework, and the
    // Measurements box then read a distance that was not along the lock.
    // ------------------------------------------------------------
    function Na__LeOsnap__ShapeTranslation(sheet, drag, dMm, shift) {
        const lock = shift ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? 'x' : 'y') : null;   // <-- The axis the move is held TO: 'x' runs across the paper, 'y' down it
        const axis = lock === 'x' ? { x : dMm.x, y : 0 } : (lock === 'y' ? { x : 0, y : dMm.y } : dMm);
        const exclude = { kind : 'shape', id : drag.id };
        let best = null;
        const offer = (ox, oy) => {
            const hit = Na__LeOsnap__Find(sheet, { x : ox + axis.x, y : oy + axis.y }, exclude);
            if (hit && (!best || hit.score < best.score)) best = { hit : hit, ox : ox, oy : oy };
        };
        if (drag.baseMm) offer(drag.baseMm.x, drag.baseMm.y);
        (drag.start || []).forEach((p) => offer(p[0], p[1]));
        if (!best) return Na__LeOsnap__GridTranslation(sheet, drag, axis, lock);   // <-- No object snap: Grid Snap (F7) puts the grab point on the grid, else the move as it was
        const move = {
            x : lock === 'y' ? axis.x : best.hit.x - best.ox,                  // <-- Held down the paper: x stays where the lock put it
            y : lock === 'x' ? axis.y : best.hit.y - best.oy                   // <-- Held across it: y does
        };
        Na__LeOsnap__ShowMarker(lock ? { ...best.hit, x : best.ox + move.x, y : best.oy + move.y } : best.hit);   // <-- Held: the marker sits where the snapped point lands on the line
        return move;
    }
    // ------------------------------------------------------------


    // FUNCTION | Snap a Selection by Its Movable Descendants' Original Points
    // ------------------------------------------------------------
    // Capture supplies flattened, unlocked members even for nested groups.
    // Keep the source points at their original positions throughout the drag;
    // all moving members are excluded from targets, including other viewports.
    // ------------------------------------------------------------
    function Na__LeOsnap__GroupTranslation(sheet, drag, delta, lock) {
        if (!drag.snapPoints) {
            drag.snapPoints = [];
            const add = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) drag.snapPoints.push({ x, y }); };
            (drag.group || []).forEach((entry) => {
                const start = entry.start;
                if (entry.kind === 'shape') start.points.forEach((p) => add(p[0], p[1]));
                else if (entry.kind === 'dimension') { add(start.sx, start.sy); add(start.ex, start.ey); }
                else if (entry.kind === 'viewport') {
                    const grab = Na__LeOsnap__FindOnViewport(sheet, entry.id, drag.startMm);
                    if (grab) add(grab.x, grab.y);
                } else {
                    add(start.x, start.y);
                    if (start.tipFollows) add(start.tipX, start.tipY);
                }
            });
            if (drag.group.length) add(drag.startMm.x, drag.startMm.y);
        }
        let best = null;
        drag.snapPoints.forEach((point) => {
            const hit = Na__LeOsnap__Find(sheet, { x : point.x + delta.x, y : point.y + delta.y }, drag.group);
            if (hit && (!best || hit.score < best.hit.score)) best = { hit, point };
        });
        if (!best) return Na__LeOsnap__GridTranslation(sheet, drag, delta, lock);   // <-- No object snap: Grid Snap (F7) puts the grab point on the grid, else the move as it was
        const result = {
            x : lock === 'y' ? delta.x : best.hit.x - best.point.x,
            y : lock === 'x' ? delta.y : best.hit.y - best.point.y
        };
        Na__LeOsnap__ShowMarker({ ...best.hit, x : best.point.x + result.x, y : best.point.y + result.y });
        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Moves
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__ShapeTranslation,
        Na__LeOsnap__GroupTranslation
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
