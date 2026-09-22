// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - OFFSET, FILLET AND CHAMFER
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__OffsetTool__.js
// NAMESPACE  : Na__LeVecSize
// MODULE     : Layout Editor - Vector Tools - Offset, Fillet and Chamfer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The three tools that work to a SIZE: a parallel copy a distance off, a corner rounded to a radius, a corner cut back a distance
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - OFFSET (F, Adam's key for it in LayOut), as LayOut's: click a line or a
//   shape - it is held, drawn heavy blue - move to the side the copy goes and
//   it follows the pointer, click and it lands. Or type how far and press
//   Enter, and it lands that far off on the side the pointer is. The copy has
//   the original's style, layer and group and sits straight after it in the
//   paint order. A circle offsets to a circle and an arc to an arc, about the
//   same centre, with as many edges as the new size needs.
// - FILLET (Shift+F) AND CHAMFER (Shift+C), LayOut 2026's keys:
//     one corner   hover a corner of a line or a shape and what it will
//                  become shows; click and it is rounded, or cut off.
//     two lines    click the END edge of one line, then the end edge of
//                  another: the two are carried to where they would meet, the
//                  corner there is rounded or cut, and they become ONE vector
//                  with the first line's style. The clicked side of each line
//                  is the side kept, as in AutoCAD, so lines that overshoot
//                  are cut back. A size of 0 makes them simply meet.
//   A fillet's arc is given as many edges as its radius needs to print as a
//   curve. A chamfer is LayOut's: one distance, cut back equally along both
//   edges - 45 degrees across a right angle.
// - THE SIZE is the panel's, and whatever is typed into the Measurements box
//   while the tool is up becomes the panel's: it is remembered for the next
//   corner, the way AutoCAD remembers a fillet radius. It is kept as typed -
//   real millimetres while Draw at scale is on - and turned into paper
//   millimetres AT THE PLACE IT IS USED (ctx.denominatorAt), so 150 is 150 mm
//   on a 1:50 detail and on a 1:100 plan alike.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands them the press and the
//   move, says which of the three is up, and passes typed sizes in.
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
// 22-Sep-2026 - Version 1.1.0
// - A refusal is said in the targets' own words (Na__LeVecAim__RefusalText),
//   which now include a vector with holes from the Boolean tools: Offset,
//   Fillet and Chamfer work on one run of points, and refuse one with a reason.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Snapping, Geometry, Curves, Offsets, Targets, Preview and Settings
    // ------------------------------------------------------------
    import { Na__LeModel__SetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeVecGeo__Path } from './Na__LayoutEditor__VectorTools__Geometry__.js';
    import { Na__LeVecCurve__KIND_CIRCLE, Na__LeVecCurve__SegmentsFor, Na__LeVecCurve__ArcSegmentsFor, Na__LeVecCurve__CirclePoints, Na__LeVecCurve__ArcPoints, Na__LeVecCurve__Describe } from './Na__LayoutEditor__VectorTools__Curves__.js';
    import { Na__LeVecOff__Offset, Na__LeVecOff__SideOf, Na__LeVecOff__NearestCorner, Na__LeVecOff__AtVertex, Na__LeVecOff__BetweenEnds } from './Na__LayoutEditor__VectorTools__Offset__.js';
    import {
        Na__LeVecAim__ReachMm,
        Na__LeVecAim__Refusal,
        Na__LeVecAim__RefusalText,
        Na__LeVecAim__At,
        Na__LeVecAim__Replace,
        Na__LeVecAim__AddBeside,
        Na__LeVecAim__Absorb,
        Na__LeVecAim__Shape
    } from './Na__LayoutEditor__VectorTools__Targets__.js';
    import { Na__LeVecPrev__TONE_REMOVE, Na__LeVecPrev__TONE_ADD, Na__LeVecPrev__TONE_HELD, Na__LeVecPrev__Show, Na__LeVecPrev__Clear } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVec__TOOL_OFFSET, Na__LeVec__TOOL_FILLET, Na__LeVec__GetSetting, Na__LeVec__Say, Na__LeVec__SetHint } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What Offset Is Holding, and the First of a Fillet's Two Lines
    // ------------------------------------------------------------
    let Na__LeVecSize__OffsetId = null;    // <-- The vector being offset, between its click and the click that lands the copy
    let Na__LeVecSize__OffsetAt = null;    // <-- { x, y } where the pointer last was, so a typed distance knows which side
    let Na__LeVecSize__First    = null;    // <-- { id, station } the first line of two, waiting for the second
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shared Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Why a Vector Was Refused, in Words
    // ------------------------------------------------------------
    function Na__LeVecSize__SayRefusal(refusal) {
        Na__LeVec__Say(Na__LeVecAim__RefusalText(refusal));                   // <-- A locked layer, a picture or a room, or a shape with holes: the targets' own words
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Many Edges a Curve of This Size Is Drawn With
    // ------------------------------------------------------------
    function Na__LeVecSize__WholeSides(radiusMm) {
        const asked = Na__LeVec__GetSetting('circleSegments');
        if (asked >= 3) return asked;
        return Na__LeVecCurve__SegmentsFor(radiusMm, Na__LeVecCfg__Value('Behaviour', 'ChordToleranceMm', 0.01), Na__LeVecCfg__Value('Behaviour', 'MinCircleSegments', 24), Na__LeVecCfg__Value('Behaviour', 'MaxCircleSegments', 360));
    }
    function Na__LeVecSize__ArcSides(radiusMm, sweepRad) {
        const asked = Na__LeVec__GetSetting('circleSegments');
        if (asked >= 3) return Math.max(2, Math.round(asked * (Math.abs(sweepRad) / (Math.PI * 2))));
        return Na__LeVecCurve__ArcSegmentsFor(radiusMm, sweepRad, Na__LeVecCfg__Value('Behaviour', 'ChordToleranceMm', 0.01), Na__LeVecCfg__Value('Behaviour', 'MinCircleSegments', 24), Na__LeVecCfg__Value('Behaviour', 'MaxCircleSegments', 360));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Tool's Size in Paper Millimetres at a Place on the Sheet
    // ------------------------------------------------------------
    // ctx.denominatorAt(point) is the drawing's scale there while Draw at scale
    // is on, and 1 while it is off.
    // ------------------------------------------------------------
    function Na__LeVecSize__PaperSize(tool, ctx, point) {
        const key   = tool === Na__LeVec__TOOL_OFFSET ? 'offsetDistance' : (tool === Na__LeVec__TOOL_FILLET ? 'filletRadius' : 'chamferDistance');
        const typed = Na__LeVec__GetSetting(key);
        const denominator = (ctx && typeof ctx.denominatorAt === 'function') ? ctx.denominatorAt(point) : 1;
        return (Number.isFinite(typed) && typed >= 0) ? typed / Math.max(1e-9, denominator) : 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Offset
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Copy a Distance Off a Vector, on the Side a Point Is
    // ------------------------------------------------------------
    // distanceMm null follows the pointer: the copy passes through it. A curve
    // is offset as a curve, about its own centre. Returns { points, closed,
    // distance } or null when nothing would be left.
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetOf(shape, pointMm, distanceMm) {
        const path = Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed);
        const read = shape.Shape__Curve ? Na__LeVecCurve__Describe(path.points, path.closed) : null;
        if (read) {
            const out     = Math.hypot(pointMm.x - read.cx, pointMm.y - read.cy);
            const outside = out >= read.r;
            const radius  = distanceMm === null ? out : read.r + ((outside ? 1 : -1) * distanceMm);
            if (!(radius >= 1e-3)) return null;
            if (read.kind === Na__LeVecCurve__KIND_CIRCLE) return { points : Na__LeVecCurve__CirclePoints(read.cx, read.cy, radius, Na__LeVecSize__WholeSides(radius), read.start), closed : true, distance : Math.abs(radius - read.r) };
            return { points : Na__LeVecCurve__ArcPoints(read.cx, read.cy, radius, read.start, read.sweep, Na__LeVecSize__ArcSides(radius, read.sweep)), closed : false, distance : Math.abs(radius - read.r) };
        }
        const side = Na__LeVecOff__SideOf(path, pointMm);
        const far  = distanceMm === null ? Math.abs(side) : distanceMm;
        if (!(far >= 1e-4)) return null;
        const made = Na__LeVecOff__Offset(path, (side < 0 ? -1 : 1) * far);
        return made ? { points : made.points, closed : made.closed, distance : far } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Held Vector, or Null Once It Has Gone
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetHeld(sheet) {
        const shape = Na__LeVecSize__OffsetId ? Na__LeVecAim__Shape(sheet, Na__LeVecSize__OffsetId) : null;
        if (!shape || Na__LeVecAim__Refusal(sheet, shape)) { Na__LeVecSize__OffsetId = null; return null; }
        return shape;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With Offset Up
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetMove(ctx) {
        Na__LeOsnap__HideMarker();
        Na__LeVecSize__OffsetAt = { x : ctx.pointMm.x, y : ctx.pointMm.y };
        const held = Na__LeVecSize__OffsetHeld(ctx.sheet);
        Na__LeVec__SetHint(held ? Na__LeVecCfg__Label('HintOffsetPlace', 'Offset: click the side, or type how far.') : Na__LeVecCfg__Label('HintOffsetPick', 'Offset: click a line or a shape.'));
        if (!held) {
            const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
            if (!aim) { Na__LeVecPrev__Clear(); return 'crosshair'; }
            if (aim.refusal) { Na__LeVecPrev__Clear(); return 'not-allowed'; }
            Na__LeVecPrev__Show([ { points : aim.path.points, closed : aim.path.closed, tone : Na__LeVecPrev__TONE_ADD, dashed : true } ], []);
            return 'crosshair';
        }
        const parts = [ { points : held.Shape__Points, closed : held.Shape__Closed === true, tone : Na__LeVecPrev__TONE_HELD, dashed : false } ];
        const copy  = Na__LeVecSize__OffsetOf(held, ctx.pointMm, null);
        if (copy) parts.push({ points : copy.points, closed : copy.closed, tone : Na__LeVecPrev__TONE_ADD, dashed : true });
        Na__LeVecPrev__Show(parts, []);
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Copy and Let Go
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetLand(sheet, held, copy) {
        if (!copy) { Na__LeVec__Say(Na__LeVecCfg__Label('SayOffsetGone', 'Offset that far, nothing of the shape is left.')); return false; }
        const made = Na__LeVecAim__AddBeside(sheet, held, copy);
        Na__LeVecSize__OffsetId = null;
        Na__LeVecPrev__Clear();
        if (made) Na__LeModel__SetSelection({ kind : 'shape', id : made.Shape__Id });
        return !!made;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Click With Offset Up
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetPress(ctx) {
        const held = Na__LeVecSize__OffsetHeld(ctx.sheet);
        if (held) return Na__LeVecSize__OffsetLand(ctx.sheet, held, Na__LeVecSize__OffsetOf(held, ctx.pointMm, null));
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) return false;
        if (aim.refusal) { Na__LeVecSize__SayRefusal(aim.refusal); return false; }
        Na__LeVecSize__OffsetId = aim.shape.Shape__Id;
        Na__LeVecSize__OffsetMove(ctx);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Measurements Box Reads With Offset Up, and a Typed Distance
    // ------------------------------------------------------------
    function Na__LeVecSize__OffsetMeasure(sheet, ctx) {
        const held = Na__LeVecSize__OffsetHeld(sheet);
        const at   = Na__LeVecSize__OffsetAt || (ctx ? ctx.pointMm : null);   // <-- Where the pointer is: the SAME place the box reads the scale at, or the figure shown would be at one scale and the figure used at another
        const copy = (held && at) ? Na__LeVecSize__OffsetOf(held, at, null) : null;
        const anchor = held ? { x : held.Shape__Points[0][0], y : held.Shape__Points[0][1] } : (at || null);
        return { label : Na__LeVecCfg__Label('MeasureDistance', 'Distance'), title : Na__LeVecCfg__Label('MeasureTitleSize', 'Type the size and press Enter - 150, or 0.15m. It is remembered for the next one.'),
                 anchor : anchor, valueMm : copy ? copy.distance : (held ? null : Na__LeVecSize__PaperSize(Na__LeVec__TOOL_OFFSET, ctx, anchor)) };
    }
    function Na__LeVecSize__OffsetType(sheet, paperMm) {
        const held = Na__LeVecSize__OffsetHeld(sheet);
        if (!held) return { ok : true, stored : true };                      // <-- Nothing held: the size is simply the panel's for next time
        if (!(paperMm >= 1e-4)) return { ok : false, reason : 'size' };
        const at = Na__LeVecSize__OffsetAt || { x : held.Shape__Points[0][0], y : held.Shape__Points[0][1] };
        return Na__LeVecSize__OffsetLand(sheet, held, Na__LeVecSize__OffsetOf(held, at, paperMm)) ? { ok : true } : { ok : false, reason : 'gone' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fillet and Chamfer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Corner's Refusal, in Words
    // ------------------------------------------------------------
    function Na__LeVecSize__SayCorner(reason) {
        if (reason === 'long')     return Na__LeVec__Say(Na__LeVecCfg__Label('SayCornerLong', 'That size is too big for the edges at that corner.'));
        if (reason === 'parallel') return Na__LeVec__Say(Na__LeVecCfg__Label('SayCornerParallel', 'Those two lines are parallel: they make no corner.'));
        if (reason === 'ends')     return Na__LeVec__Say(Na__LeVecCfg__Label('SayCornerEnds', 'Click the END edge of each line - the corner is made where those two would meet.'));
        return Na__LeVec__Say(Na__LeVecCfg__Label('SayCornerStraight', 'There is no corner there to work on.'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Corner of This Vector the Pointer Is On (index, or -1)
    // ------------------------------------------------------------
    function Na__LeVecSize__CornerUnder(aim, pointMm) {
        return Na__LeVecOff__NearestCorner(aim.path, pointMm, Na__LeVecAim__ReachMm() * 2);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With Fillet or Chamfer Up
    // ------------------------------------------------------------
    function Na__LeVecSize__CornerMove(ctx) {
        Na__LeOsnap__HideMarker();
        const first = Na__LeVecSize__First ? Na__LeVecAim__Shape(ctx.sheet, Na__LeVecSize__First.id) : null;
        if (Na__LeVecSize__First && !first) Na__LeVecSize__First = null;
        Na__LeVec__SetHint(first ? Na__LeVecCfg__Label('HintCornerSecond', 'Click the second line.') : Na__LeVecCfg__Label('HintCornerFirst', 'Click a corner, or the first of two lines.'));
        const parts = first ? [ { points : first.Shape__Points, closed : false, tone : Na__LeVecPrev__TONE_HELD, dashed : false } ] : [];
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecPrev__Show(parts, []); return 'crosshair'; }
        if (aim.refusal) { Na__LeVecPrev__Show(parts, []); return 'not-allowed'; }
        const kind = ctx.tool === Na__LeVec__TOOL_FILLET ? 'fillet' : 'chamfer';
        if (!first) {
            const index = Na__LeVecSize__CornerUnder(aim, ctx.pointMm);
            if (index >= 0) {
                const size = Na__LeVecSize__PaperSize(ctx.tool, ctx, { x : aim.path.points[index][0], y : aim.path.points[index][1] });
                const made = Na__LeVecOff__AtVertex(kind, aim.path, index, size, Na__LeVecSize__ArcSides);
                if (made.ok) {
                    const n = aim.path.points.length;
                    parts.push({ points : [ made.replaced[0], aim.path.points[index], made.replaced[made.replaced.length - 1] ], closed : false, tone : Na__LeVecPrev__TONE_REMOVE, dashed : true });
                    parts.push({ points : made.replaced, closed : false, tone : Na__LeVecPrev__TONE_ADD, dashed : false });
                    Na__LeVecPrev__Show(parts, []);
                    return n ? 'crosshair' : 'crosshair';
                }
            }
            if (!aim.path.closed) parts.push({ points : aim.path.points, closed : false, tone : Na__LeVecPrev__TONE_ADD, dashed : true });
            Na__LeVecPrev__Show(parts, []);
            return 'crosshair';
        }
        const same = first.Shape__Id === aim.shape.Shape__Id;
        const size = Na__LeVecSize__PaperSize(ctx.tool, ctx, ctx.pointMm);
        const made = Na__LeVecOff__BetweenEnds(kind, Na__LeVecGeo__Path(first.Shape__Points, first.Shape__Closed), Na__LeVecSize__First.station, aim.path, aim.at.station, size, Na__LeVecSize__ArcSides, same);
        if (made.ok) parts.unshift({ points : made.points, closed : made.closed, tone : Na__LeVecPrev__TONE_ADD, dashed : true });
        Na__LeVecPrev__Show(parts, []);
        return made.ok ? 'crosshair' : 'not-allowed';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Click With Fillet or Chamfer Up
    // ------------------------------------------------------------
    function Na__LeVecSize__CornerPress(ctx) {
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecSize__First = null; Na__LeVecPrev__Clear(); return false; }   // <-- Bare paper lets go of the first line
        if (aim.refusal) { Na__LeVecSize__SayRefusal(aim.refusal); return false; }
        const kind  = ctx.tool === Na__LeVec__TOOL_FILLET ? 'fillet' : 'chamfer';
        const first = Na__LeVecSize__First ? Na__LeVecAim__Shape(ctx.sheet, Na__LeVecSize__First.id) : null;
        if (!first) {
            Na__LeVecSize__First = null;
            const index = Na__LeVecSize__CornerUnder(aim, ctx.pointMm);
            if (index >= 0) {
                const size = Na__LeVecSize__PaperSize(ctx.tool, ctx, { x : aim.path.points[index][0], y : aim.path.points[index][1] });
                const made = Na__LeVecOff__AtVertex(kind, aim.path, index, size, Na__LeVecSize__ArcSides);
                if (!made.ok) { Na__LeVecSize__SayCorner(made.reason === 'radius' ? 'straight' : made.reason); return false; }
                Na__LeVecAim__Replace(ctx.sheet, aim.shape, [ { points : made.points, closed : made.closed } ]);
                Na__LeVecPrev__Clear();
                return true;
            }
            if (aim.path.closed) { Na__LeVecSize__SayCorner('straight'); return false; }
            Na__LeVecSize__First = { id : aim.shape.Shape__Id, station : aim.at.station };
            Na__LeVecSize__CornerMove(ctx);
            return true;
        }
        const same = first.Shape__Id === aim.shape.Shape__Id;
        const size = Na__LeVecSize__PaperSize(ctx.tool, ctx, ctx.pointMm);
        const made = Na__LeVecOff__BetweenEnds(kind, Na__LeVecGeo__Path(first.Shape__Points, first.Shape__Closed), Na__LeVecSize__First.station, aim.path, aim.at.station, size, Na__LeVecSize__ArcSides, same);
        if (!made.ok) { Na__LeVecSize__SayCorner(made.reason); return false; }
        Na__LeVecAim__Absorb(ctx.sheet, first.Shape__Id, { points : made.points, closed : made.closed }, same ? [] : [ aim.shape.Shape__Id ]);
        Na__LeModel__SetSelection({ kind : 'shape', id : first.Shape__Id });
        Na__LeVecSize__First = null;
        Na__LeVecPrev__Clear();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Measurements Box Reads With Fillet or Chamfer Up
    // ------------------------------------------------------------
    function Na__LeVecSize__CornerMeasure(tool, ctx, cursorMm) {
        return { label : tool === Na__LeVec__TOOL_FILLET ? Na__LeVecCfg__Label('MeasureRadius', 'Radius') : Na__LeVecCfg__Label('MeasureDistance', 'Distance'),
                 title : Na__LeVecCfg__Label('MeasureTitleSize', 'Type the size and press Enter - 150, or 0.15m. It is remembered for the next one.'),
                 anchor : cursorMm || null, valueMm : Na__LeVecSize__PaperSize(tool, ctx, cursorMm) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Putting the Tools Down
// -----------------------------------------------------------------------------

    // FUNCTION | Let Go of Whatever Is Held, and Is Anything
    // ------------------------------------------------------------
    function Na__LeVecSize__Cancel() {
        const had = !!(Na__LeVecSize__OffsetId || Na__LeVecSize__First);
        Na__LeVecSize__OffsetId = null;
        Na__LeVecSize__First    = null;
        Na__LeVecPrev__Clear();
        return had;
    }
    function Na__LeVecSize__IsBusy() { return !!(Na__LeVecSize__OffsetId || Na__LeVecSize__First); }
    function Na__LeVecSize__Arm(tool) {
        Na__LeVecSize__Cancel();
        Na__LeVec__SetHint(tool === Na__LeVec__TOOL_OFFSET ? Na__LeVecCfg__Label('HintOffsetPick', 'Offset: click a line or a shape.') : Na__LeVecCfg__Label('HintCornerFirst', 'Click a corner, or the first of two lines.'));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Offset, Fillet and Chamfer API
    // ------------------------------------------------------------
    export {
        Na__LeVecSize__WholeSides,
        Na__LeVecSize__ArcSides,
        Na__LeVecSize__PaperSize,
        Na__LeVecSize__Arm,
        Na__LeVecSize__Cancel,
        Na__LeVecSize__IsBusy,
        Na__LeVecSize__OffsetPress,
        Na__LeVecSize__OffsetMove,
        Na__LeVecSize__OffsetMeasure,
        Na__LeVecSize__OffsetType,
        Na__LeVecSize__CornerPress,
        Na__LeVecSize__CornerMove,
        Na__LeVecSize__CornerMeasure
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
