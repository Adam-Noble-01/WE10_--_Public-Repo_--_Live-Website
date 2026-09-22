// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - TRIM AND EXTEND
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__TrimTool__.js
// NAMESPACE  : Na__LeVecTrim
// MODULE     : Layout Editor - Vector Tools - Trim and Extend
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Trim a line back to what crosses it, or run its end on to what is in its way - one at a hover and a click, or several at once with a fence
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ONE MODULE, BECAUSE THEY ARE ONE GESTURE. Trim and Extend are the same
//   hover, the same click and the same fence, asking opposite questions of the
//   same cutting edges - and AutoCAD lets Shift swap one for the other while
//   it is held, which only works if they share everything else.
// - NO "PICK THE CUTTING EDGE FIRST". LayOut 2026's Trim and Extend work as
//   AutoCAD's Quick mode does: every vector that can be seen is a cutting
//   edge, so there is nothing to choose but the piece.
//     TRIM     hover a line and the span that will go is drawn red, from the
//              crossing before the pointer to the crossing after it (or to the
//              line's own end). Click and it goes. What is left is one piece
//              or two, each with the line's style, in the line's group, where
//              the line was in the paint order. A closed shape opens.
//     EXTEND   hover nearer one end of an open line and the run it will gain
//              is drawn blue, out to the first line in its way. Click and the
//              end moves there; the line stays a line.
// - THE FENCE, LayOut's and AutoCAD's: click on bare paper, draw a line across
//   as many lines as wanted, click again (or press, drag and let go). Every
//   line the fence crosses is trimmed where it crosses - or, extending, has the
//   end nearer the fence run on. The whole fence is ONE undo step.
// - NOTHING HAPPENS TO A LINE THAT NOTHING CROSSES. AutoCAD's Quick mode
//   deletes it; here the line is left alone and a line of words says why,
//   because a stray click should never cost a line.
// - The work is done again on the press from the sheet as it then is, never
//   from what the hover worked out, so a preview can never be acted on stale.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands it the press, the move
//   and the release, and says which of the two is up.
// - Na__LayoutEditor__VectorTools__Targets__ says what may be edited and what
//   cuts; Na__LayoutEditor__VectorTools__Geometry__ does the maths.
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
//   which now include a vector with holes from the Boolean tools: it is never
//   trimmed or extended, and still CUTS along every one of its rings.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: hover previews, click, the fence (click-click and
//   press-drag), Shift's swap, and the refusals.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Surface, Geometry, Targets, Preview and Settings
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import {
        Na__LeVecGeo__Path,
        Na__LeVecGeo__PointAt,
        Na__LeVecGeo__Crossings,
        Na__LeVecGeo__Trim,
        Na__LeVecGeo__Extend,
        Na__LeVecGeo__NearerEnd
    } from './Na__LayoutEditor__VectorTools__Geometry__.js';
    import {
        Na__LeVecAim__RefusalText,
        Na__LeVecAim__At,
        Na__LeVecAim__All,
        Na__LeVecAim__CuttersFor,
        Na__LeVecAim__BoxOf,
        Na__LeVecAim__Replace,
        Na__LeVecAim__Announce,
        Na__LeVecAim__Shape
    } from './Na__LayoutEditor__VectorTools__Targets__.js';
    import {
        Na__LeVecPrev__TONE_REMOVE,
        Na__LeVecPrev__TONE_ADD,
        Na__LeVecPrev__TONE_FENCE,
        Na__LeVecPrev__MARK_CROSS,
        Na__LeVecPrev__MARK_DOT,
        Na__LeVecPrev__Show,
        Na__LeVecPrev__Clear
    } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVec__TOOL_TRIM, Na__LeVec__TOOL_EXTEND, Na__LeVec__Say, Na__LeVec__SetHint } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Fence Being Drawn
    // ------------------------------------------------------------
    let Na__LeVecTrim__Fence = null;   // <-- { from : { x, y }, to : { x, y }, press : { pointerId, x, y } or null, dragged }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Working Out One Trim or One Extend
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Which of the Two the Click Means (Shift swaps them while it is held)
    // ------------------------------------------------------------
    function Na__LeVecTrim__Effective(tool, shift) {
        if (!shift || !Na__LeVecCfg__Value('Behaviour', 'ShiftSwapsTrimAndExtend', true)) return tool;
        return tool === Na__LeVec__TOOL_TRIM ? Na__LeVec__TOOL_EXTEND : Na__LeVec__TOOL_TRIM;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Trimming This Vector at This Station Would Do
    // ------------------------------------------------------------
    // Returns { ok : true, result } - the geometry's { removed, kept } - or
    // { ok : false, say }.
    // ------------------------------------------------------------
    function Na__LeVecTrim__PlanTrim(sheet, shape, path, station) {
        const cutters   = Na__LeVecAim__CuttersFor(sheet, shape.Shape__Id, Na__LeVecAim__BoxOf(path.points, 1));
        const crossings = Na__LeVecGeo__Crossings(path, cutters, { self : Na__LeVecCfg__Value('Behaviour', 'CutToOwnCrossings', true) });
        const result    = Na__LeVecGeo__Trim(path, station, crossings);
        if (!result) return { ok : false, say : crossings.length ? '' : Na__LeVecCfg__Label('SayNothingCrosses', 'Nothing crosses that line, so there is nothing to trim it back to.') };   // <-- On a crossing, or a loop cut once: say nothing, the next move will show something
        return { ok : true, result : result, crossings : crossings };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Extending This Vector From the End Nearer This Station Would Do
    // ------------------------------------------------------------
    function Na__LeVecTrim__PlanExtend(sheet, shape, path, station) {
        if (path.closed) return { ok : false, say : Na__LeVecCfg__Label('SayClosedNoEnd', 'A closed shape has no end to extend. Split it first.') };
        const end   = Na__LeVecGeo__NearerEnd(path, station);
        const n     = path.points.length;
        const tip   = end === 'start' ? path.points[0] : path.points[n - 1];
        const back  = end === 'start' ? path.points[1] : path.points[n - 2];
        const len   = Math.hypot(tip[0] - back[0], tip[1] - back[1]);
        const maxMm = Na__LeVecCfg__Value('Behaviour', 'MaxExtendMm', 2000);
        if (!(len > 0)) return { ok : false, say : '' };
        const far   = [ tip[0] + (((tip[0] - back[0]) / len) * maxMm), tip[1] + (((tip[1] - back[1]) / len) * maxMm) ];
        const cutters = Na__LeVecAim__CuttersFor(sheet, shape.Shape__Id, Na__LeVecAim__BoxOf([ tip, far ], 1));   // <-- Only what lies along the way ahead can stop it
        const result  = Na__LeVecGeo__Extend(path, end, cutters, { self : Na__LeVecCfg__Value('Behaviour', 'CutToOwnCrossings', true), maxMm : maxMm });
        if (!result) return { ok : false, say : Na__LeVecCfg__Label('SayNothingAhead', 'There is no line ahead of that end to extend it to.') };
        return { ok : true, result : result };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Carry Out a Plan on the Sheet
    // ------------------------------------------------------------
    function Na__LeVecTrim__Apply(sheet, shape, tool, plan, silent) {
        if (tool === Na__LeVec__TOOL_TRIM) return Na__LeVecAim__Replace(sheet, shape, plan.result.kept, { silent : silent === true });
        return Na__LeVecAim__Replace(sheet, shape, [ { points : plan.result.points, closed : false } ], { silent : silent === true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hover and Click
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say What the Tool Wants
    // ------------------------------------------------------------
    function Na__LeVecTrim__Hint(tool) {
        if (Na__LeVecTrim__Fence) return Na__LeVec__SetHint(Na__LeVecCfg__Label('HintFence', 'Draw across the lines, then click again.'));
        return Na__LeVec__SetHint(tool === Na__LeVec__TOOL_TRIM
            ? Na__LeVecCfg__Label('HintTrim', 'Trim: click the piece to remove. Shift extends.')
            : Na__LeVecCfg__Label('HintExtend', 'Extend: click near the end to run on. Shift trims.'));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With Trim or Extend Up
    // ------------------------------------------------------------
    // ctx: { tool, sheet, pointMm, shift, pressed, pointerId }. Returns the
    // cursor the stage should carry: 'not-allowed' over a vector that cannot be
    // edited, else 'crosshair'.
    // ------------------------------------------------------------
    function Na__LeVecTrim__Move(ctx) {
        const tool = Na__LeVecTrim__Effective(ctx.tool, ctx.shift);
        Na__LeVecTrim__Hint(tool);
        Na__LeOsnap__HideMarker();
        const fence = Na__LeVecTrim__Fence;
        if (fence) {
            if (fence.press && !ctx.pressed) { fence.press = null; fence.dragged = false; }
            const slop = Na__LeCfg__GetSelectionSetup().dragThresholdMm / Math.max(1e-6, Na__LeSurface__GetZoom());
            if (fence.press && !fence.dragged && Math.hypot(ctx.pointMm.x - fence.press.x, ctx.pointMm.y - fence.press.y) >= slop) fence.dragged = true;
            fence.to = { x : ctx.pointMm.x, y : ctx.pointMm.y };
            Na__LeVecPrev__Show([ { points : [ [ fence.from.x, fence.from.y ], [ fence.to.x, fence.to.y ] ], closed : false, tone : Na__LeVecPrev__TONE_FENCE, dashed : true } ], []);
            return 'crosshair';
        }
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecPrev__Clear(); return 'crosshair'; }
        if (aim.refusal) { Na__LeVecPrev__Clear(); return 'not-allowed'; }
        if (tool === Na__LeVec__TOOL_TRIM) {
            const plan = Na__LeVecTrim__PlanTrim(ctx.sheet, aim.shape, aim.path, aim.at.station);
            if (!plan.ok) { Na__LeVecPrev__Clear(); return 'crosshair'; }
            const ends  = [ Na__LeVecGeo__PointAt(aim.path, plan.result.from), Na__LeVecGeo__PointAt(aim.path, plan.result.to) ];
            const marks = ends.filter((p, i) => plan.crossings.some((hit) => Math.abs(hit.station - (i === 0 ? plan.result.from : plan.result.to)) < 1e-9))
                .map((p) => ({ x : p[0], y : p[1], kind : Na__LeVecPrev__MARK_CROSS, tone : Na__LeVecPrev__TONE_REMOVE }));   // <-- LayOut's red X, where a crossing does the cutting; a line's own end gets none
            Na__LeVecPrev__Show([ { points : plan.result.removed.points, closed : false, tone : Na__LeVecPrev__TONE_REMOVE, dashed : true } ], marks);
            return 'crosshair';
        }
        const plan = Na__LeVecTrim__PlanExtend(ctx.sheet, aim.shape, aim.path, aim.at.station);
        if (!plan.ok) { Na__LeVecPrev__Clear(); return 'crosshair'; }
        const landed = plan.result.added[1];
        Na__LeVecPrev__Show([ { points : plan.result.added, closed : false, tone : Na__LeVecPrev__TONE_ADD, dashed : true } ],
                            [ { x : landed[0], y : landed[1], kind : Na__LeVecPrev__MARK_DOT, tone : Na__LeVecPrev__TONE_ADD } ]);
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Left Press With Trim or Extend Up
    // ------------------------------------------------------------
    // On a line: do it. On bare paper: start a fence, or finish the one that
    // is waiting for its second click.
    // ------------------------------------------------------------
    function Na__LeVecTrim__Press(ctx) {
        const tool = Na__LeVecTrim__Effective(ctx.tool, ctx.shift);
        if (Na__LeVecTrim__Fence) {
            Na__LeVecTrim__Fence.to = { x : ctx.pointMm.x, y : ctx.pointMm.y };
            return Na__LeVecTrim__RunFence(ctx.sheet, tool);
        }
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) {
            Na__LeVecTrim__Fence = { from : { x : ctx.pointMm.x, y : ctx.pointMm.y }, to : { x : ctx.pointMm.x, y : ctx.pointMm.y },
                                     press : { pointerId : ctx.pointerId, x : ctx.pointMm.x, y : ctx.pointMm.y }, dragged : false };
            Na__LeVecTrim__Hint(tool);
            return true;
        }
        if (aim.refusal) {
            Na__LeVec__Say(Na__LeVecAim__RefusalText(aim.refusal));           // <-- A locked layer, a picture or a room, or a shape with holes: the targets' own words
            return false;
        }
        const plan = tool === Na__LeVec__TOOL_TRIM
            ? Na__LeVecTrim__PlanTrim(ctx.sheet, aim.shape, aim.path, aim.at.station)
            : Na__LeVecTrim__PlanExtend(ctx.sheet, aim.shape, aim.path, aim.at.station);
        if (!plan.ok) { if (plan.say) Na__LeVec__Say(plan.say); return false; }
        Na__LeVecPrev__Clear();
        Na__LeVecTrim__Apply(ctx.sheet, aim.shape, tool, plan, false);       // <-- The selection is left alone: the first piece keeps the record, so whatever was selected still is, and a vector open for editing stays open
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Comes Up With Trim or Extend Up
    // ------------------------------------------------------------
    // A fence that was DRAGGED out ends where the button lets go; one that was
    // clicked waits for its second click.
    // ------------------------------------------------------------
    function Na__LeVecTrim__Release(ctx) {
        const fence = Na__LeVecTrim__Fence;
        if (!fence || !fence.press || fence.press.pointerId !== ctx.pointerId) return false;
        const dragged = fence.dragged;
        fence.press   = null;
        fence.dragged = false;
        if (ctx.cancelled === true) { Na__LeVecTrim__Cancel(); return false; }
        if (!dragged) return false;
        fence.to = { x : ctx.pointMm.x, y : ctx.pointMm.y };
        return Na__LeVecTrim__RunFence(ctx.sheet, Na__LeVecTrim__Effective(ctx.tool, ctx.shift));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fence
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Trim or Extend Everything the Fence Crosses (one undo step)
    // ------------------------------------------------------------
    // Worked through one crossing at a time, each from the sheet as the last
    // one left it: trimming a line in two makes a new line, and a fence that
    // crossed the old one twice still has the other crossing to deal with. A
    // crossing that cannot be acted on is remembered and passed over, so the
    // loop always ends. Every write is silent and ONE announcement follows.
    // ------------------------------------------------------------
    function Na__LeVecTrim__RunFence(sheet, tool) {
        const fence = Na__LeVecTrim__Fence;
        Na__LeVecTrim__Fence = null;
        Na__LeVecPrev__Clear();
        Na__LeVecTrim__Hint(tool);
        if (!fence || !sheet || Math.hypot(fence.to.x - fence.from.x, fence.to.y - fence.from.y) < 1e-6) return false;
        const line    = [ [ fence.from.x, fence.from.y, fence.to.x, fence.to.y ] ];
        const passed  = new Set();
        const done    = new Set();                                           // <-- Extending: each line once, or a line run on to the fence's far side would be run on again
        let changed = 0;
        for (let guard = 0; guard < 500; guard++) {
            let acted = false;
            const targets = Na__LeVecAim__All(sheet);
            for (let i = 0; i < targets.length && !acted; i++) {
                const target = targets[i];
                if (tool === Na__LeVec__TOOL_EXTEND && done.has(target.shape.Shape__Id)) continue;
                const hits = Na__LeVecGeo__Crossings(target.path, line);
                for (let k = 0; k < hits.length && !acted; k++) {
                    const key = target.shape.Shape__Id + ':' + Math.round(hits[k].x * 1000) + ':' + Math.round(hits[k].y * 1000);
                    if (passed.has(key)) continue;
                    passed.add(key);
                    const shape = Na__LeVecAim__Shape(sheet, target.shape.Shape__Id);
                    if (!shape) continue;
                    const path = Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed);
                    const plan = tool === Na__LeVec__TOOL_TRIM
                        ? Na__LeVecTrim__PlanTrim(sheet, shape, path, hits[k].station)
                        : Na__LeVecTrim__PlanExtend(sheet, shape, path, hits[k].station);
                    if (!plan.ok) continue;
                    Na__LeVecTrim__Apply(sheet, shape, tool, plan, true);
                    done.add(shape.Shape__Id);
                    changed++;
                    acted = true;
                }
            }
            if (!acted) break;
        }
        if (changed) Na__LeVecAim__Announce(sheet, null);
        return changed > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Putting the Tool Down
// -----------------------------------------------------------------------------

    // FUNCTION | Abandon a Fence, Is One Being Drawn, and the Tool Being Picked Up
    // ------------------------------------------------------------
    function Na__LeVecTrim__Cancel() {
        const had = !!Na__LeVecTrim__Fence;
        Na__LeVecTrim__Fence = null;
        Na__LeVecPrev__Clear();
        return had;
    }
    function Na__LeVecTrim__IsBusy() { return !!Na__LeVecTrim__Fence; }
    function Na__LeVecTrim__Arm(tool) { Na__LeVecTrim__Cancel(); Na__LeVecTrim__Hint(tool); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Trim and Extend API
    // ------------------------------------------------------------
    export {
        Na__LeVecTrim__Arm,
        Na__LeVecTrim__Press,
        Na__LeVecTrim__Move,
        Na__LeVecTrim__Release,
        Na__LeVecTrim__Cancel,
        Na__LeVecTrim__IsBusy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
