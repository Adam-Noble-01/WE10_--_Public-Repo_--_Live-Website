// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - JOIN AND SPLIT
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__JoinTool__.js
// NAMESPACE  : Na__LeVecJoin
// MODULE     : Layout Editor - Vector Tools - Join and Split
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Make one vector of several whose ends meet, and cut one vector in two - LayOut's Join and Split, which are each other's undoing
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - JOIN, AS LAYOUT'S DOES (J, Adam's key for it there):
//     by clicking    click one line - it is held, drawn heavy blue - then each
//                    line that meets its end. They become ONE vector with the
//                    FIRST line's style, in its group, at its place in the
//                    paint order, and the vectors swallowed go. The result
//                    stays held, so a whole outline is joined by clicking round
//                    it; when the last end meets the first it CLOSES, which is
//                    what lets it take a fill or a hatch, and the tool lets go.
//                    Clicking the held line again closes it when its own two
//                    ends meet. Bare paper lets go of it.
//     all at once    with several vectors selected, picking the tool up joins
//                    everything in the selection that meets end to end, in one
//                    undo step (LayOut 2025's Join on a selection).
//   ENDS MUST MEET - within JoinToleranceMm, half a pen's width, so ends that
//   were snapped together always do. With Bridge ends that do not meet ticked
//   the two nearest ends are linked by a straight edge instead, as
//   Illustrator's Join does. A joint whose two edges run on in one straight
//   line is taken out: a line split and joined again is the line it was.
// - SPLIT (U, Adam's key for it in LayOut): click a line and it is cut in two
//   where it was clicked - at the crossing under the pointer when there is
//   one, marked with LayOut's red X, and then BOTH lines are cut there, which
//   is what building a shape out of overlapping ones needs. A closed shape cut
//   once opens at the cut.
// - Two tools in one module because they share everything but the verb: the
//   same targets, the same preview, the same one-step writing back.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands them the press and the
//   move, and runs Weld when Join is picked up over a selection.
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
//   which now include a vector with holes from the Boolean tools: Join and
//   Split work on one run of points, and refuse one with a reason.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Snapping, Geometry, Targets, Preview and Settings
    // ------------------------------------------------------------
    import { Na__LeModel__GetSelectionItems, Na__LeModel__SetSelection, Na__LeModel__SetSelectionItems } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import {
        Na__LeVecGeo__Path,
        Na__LeVecGeo__NearestStation,
        Na__LeVecGeo__Crossings,
        Na__LeVecGeo__SplitAt,
        Na__LeVecGeo__Join,
        Na__LeVecGeo__CloseEnds,
        Na__LeVecGeo__JoinMany
    } from './Na__LayoutEditor__VectorTools__Geometry__.js';
    import {
        Na__LeVecAim__ReachMm,
        Na__LeVecAim__Refusal,
        Na__LeVecAim__RefusalText,
        Na__LeVecAim__At,
        Na__LeVecAim__All,
        Na__LeVecAim__CuttersFor,
        Na__LeVecAim__BoxOf,
        Na__LeVecAim__Replace,
        Na__LeVecAim__Absorb,
        Na__LeVecAim__Announce,
        Na__LeVecAim__Shape
    } from './Na__LayoutEditor__VectorTools__Targets__.js';
    import {
        Na__LeVecPrev__TONE_REMOVE,
        Na__LeVecPrev__TONE_ADD,
        Na__LeVecPrev__TONE_HELD,
        Na__LeVecPrev__MARK_CROSS,
        Na__LeVecPrev__MARK_DOT,
        Na__LeVecPrev__Show,
        Na__LeVecPrev__Clear
    } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label, Na__LeVecCfg__Format } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVec__GetSetting, Na__LeVec__Say, Na__LeVec__SetHint } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Vector Join Is Holding
    // ------------------------------------------------------------
    let Na__LeVecJoin__HeldId = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Join
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Close Two Ends Must Be, and Whether a Gap May Be Bridged
    // ------------------------------------------------------------
    function Na__LeVecJoin__Tolerance() { return Na__LeVecCfg__Value('Behaviour', 'JoinToleranceMm', 0.05); }
    function Na__LeVecJoin__Bridges()   { return Na__LeVec__GetSetting('joinBridges') === true; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Why a Vector Was Refused, in Words
    // ------------------------------------------------------------
    function Na__LeVecJoin__SayRefusal(refusal) {
        Na__LeVec__Say(Na__LeVecAim__RefusalText(refusal));                   // <-- A locked layer, a picture or a room, or a shape with holes: the targets' own words
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Held Vector's Record and Path, or Null Once It Has Gone
    // ------------------------------------------------------------
    function Na__LeVecJoin__Held(sheet) {
        const shape = Na__LeVecJoin__HeldId ? Na__LeVecAim__Shape(sheet, Na__LeVecJoin__HeldId) : null;
        if (!shape || Na__LeVecAim__Refusal(sheet, shape)) { Na__LeVecJoin__HeldId = null; return null; }   // <-- Deleted, undone away, or its layer locked since
        return { shape : shape, path : Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Joining the Held Vector to Another Would Make (null when they cannot be)
    // ------------------------------------------------------------
    function Na__LeVecJoin__Plan(held, other) {
        if (!held || !other) return null;
        if (held.shape.Shape__Id === other.shape.Shape__Id) return Na__LeVecGeo__CloseEnds(held.path, Na__LeVecJoin__Tolerance(), { bridge : Na__LeVecJoin__Bridges() });
        return Na__LeVecGeo__Join(held.path, other.path, Na__LeVecJoin__Tolerance(), { bridge : Na__LeVecJoin__Bridges() });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say What Join Wants Next
    // ------------------------------------------------------------
    function Na__LeVecJoin__Hint() {
        return Na__LeVec__SetHint(Na__LeVecJoin__HeldId
            ? Na__LeVecCfg__Label('HintJoinNext', 'Join: click a line that meets its end. Esc finishes.')
            : Na__LeVecCfg__Label('HintJoinFirst', 'Join: click the first line.'));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With Join Up
    // ------------------------------------------------------------
    function Na__LeVecJoin__Move(ctx) {
        Na__LeOsnap__HideMarker();
        const held  = Na__LeVecJoin__Held(ctx.sheet);
        const aim   = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        const parts = [];
        if (held) parts.push({ points : held.path.points, closed : held.path.closed, tone : Na__LeVecPrev__TONE_HELD, dashed : false });
        Na__LeVecJoin__Hint();
        if (!aim) { Na__LeVecPrev__Show(parts, []); return 'crosshair'; }
        if (aim.refusal) { Na__LeVecPrev__Show(parts, []); return 'not-allowed'; }
        if (!held) {
            if (!aim.path.closed) parts.push({ points : aim.path.points, closed : false, tone : Na__LeVecPrev__TONE_ADD, dashed : true });
            Na__LeVecPrev__Show(parts, []);
            return aim.path.closed ? 'not-allowed' : 'crosshair';
        }
        const plan = Na__LeVecJoin__Plan(held, aim);
        if (!plan) { Na__LeVecPrev__Show(parts, []); return 'not-allowed'; }
        Na__LeVecPrev__Show([ { points : plan.points, closed : plan.closed, tone : Na__LeVecPrev__TONE_ADD, dashed : true } ].concat(parts), []);
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Click With Join Up
    // ------------------------------------------------------------
    function Na__LeVecJoin__Press(ctx) {
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecJoin__HeldId = null; Na__LeVecPrev__Clear(); Na__LeVecJoin__Hint(); return false; }   // <-- Bare paper lets go
        if (aim.refusal) { Na__LeVecJoin__SayRefusal(aim.refusal); return false; }
        const held = Na__LeVecJoin__Held(ctx.sheet);
        if (!held) {
            if (aim.path.closed) { Na__LeVec__Say(Na__LeVecCfg__Label('SayClosedNoJoin', 'A closed shape has no free end to join.')); return false; }
            Na__LeVecJoin__HeldId = aim.shape.Shape__Id;
            Na__LeModel__SetSelection({ kind : 'shape', id : aim.shape.Shape__Id });   // <-- Its style is the one the result keeps: the Vectors panel shows it
            Na__LeVecJoin__Hint();
            Na__LeVecJoin__Move(ctx);
            return true;
        }
        const plan = Na__LeVecJoin__Plan(held, aim);
        if (!plan) {
            Na__LeVec__Say(aim.path.closed
                ? Na__LeVecCfg__Label('SayClosedNoJoin', 'A closed shape has no free end to join.')
                : Na__LeVecCfg__Label('SayEndsApart', 'Those ends do not meet. Snap them together, or tick Bridge ends that do not meet.'));
            return false;
        }
        const same = held.shape.Shape__Id === aim.shape.Shape__Id;
        Na__LeVecAim__Absorb(ctx.sheet, held.shape.Shape__Id, plan, same ? [] : [ aim.shape.Shape__Id ]);
        Na__LeModel__SetSelection({ kind : 'shape', id : held.shape.Shape__Id });
        if (plan.closed) {
            Na__LeVecJoin__HeldId = null;                                    // <-- A closed shape has no end left to join to: done
            Na__LeVec__Say(Na__LeVecCfg__Label('SayJoinedClosed', 'Joined and closed: it can now take a fill.'));
        }
        Na__LeVecJoin__Hint();
        Na__LeVecJoin__Move(ctx);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Join Everything in the Selection That Meets End to End (one undo step)
    // ------------------------------------------------------------
    // Run when the tool is picked up over a selection of two or more vectors.
    // The order they were selected in is kept, so the FIRST one selected gives
    // each joined run its style. Returns true when anything was joined.
    // ------------------------------------------------------------
    function Na__LeVecJoin__Weld(sheet) {
        if (!sheet) return false;
        const reachable = new Set(Na__LeVecAim__All(sheet).map((entry) => entry.shape.Shape__Id));
        const chosen = (Na__LeModel__GetSelectionItems() || []).filter((item) => item && item.kind === 'shape' && reachable.has(item.id));
        if (chosen.length < 2) return false;
        const paths = chosen.map((item) => { const shape = Na__LeVecAim__Shape(sheet, item.id); return { key : item.id, points : shape.Shape__Points, closed : shape.Shape__Closed === true }; });
        let pool = Na__LeVecGeo__JoinMany(paths, Na__LeVecJoin__Tolerance());
        if (pool.every((entry) => entry.keys.length === 1) && Na__LeVecJoin__Bridges() && paths.length === 2) {   // <-- Nothing meets, bridging is on and there are just two: link them
            const bridged = Na__LeVecGeo__Join(Na__LeVecGeo__Path(paths[0].points, paths[0].closed), Na__LeVecGeo__Path(paths[1].points, paths[1].closed), Na__LeVecJoin__Tolerance(), { bridge : true });
            if (bridged) pool = [ { keys : [ paths[0].key, paths[1].key ], points : bridged.points, closed : bridged.closed } ];
        }
        const before = paths.reduce((map, p) => { map[p.key] = p; return map; }, {});
        const merged = pool.filter((entry) => entry.keys.length > 1 || entry.closed !== (before[entry.keys[0]].closed === true));
        if (!merged.length) { Na__LeVec__Say(Na__LeVecCfg__Label('SayNothingJoins', 'None of the selected vectors meet end to end.')); return false; }
        merged.forEach((entry) => Na__LeVecAim__Absorb(sheet, entry.keys[0], { points : entry.points, closed : entry.closed }, entry.keys.slice(1), { silent : true }));
        Na__LeVecAim__Announce(sheet, null);
        Na__LeModel__SetSelectionItems(pool.map((entry) => ({ kind : 'shape', id : entry.keys[0] })));
        Na__LeVec__Say(Na__LeVecCfg__Format('SayJoined', 'Joined {count} vectors into {left}.', { count : chosen.length, left : pool.length }));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let Go, Is a Vector Held, and the Tool Being Picked Up
    // ------------------------------------------------------------
    function Na__LeVecJoin__Cancel() { const had = !!Na__LeVecJoin__HeldId; Na__LeVecJoin__HeldId = null; Na__LeVecPrev__Clear(); return had; }
    function Na__LeVecJoin__IsBusy() { return !!Na__LeVecJoin__HeldId; }
    function Na__LeVecJoin__Arm(sheet) { Na__LeVecJoin__Cancel(); Na__LeVecJoin__Weld(sheet); Na__LeVecJoin__Hint(); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Split
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where a Click Near This Path Would Cut It
    // ------------------------------------------------------------
    // A crossing within reach of the pointer wins - that is nearly always what
    // is being aimed at, and it is the one place a hand cannot hit by eye.
    // Then one of the path's own corners; else the place clicked. Returns
    // { station, x, y, crossing }.
    // ------------------------------------------------------------
    function Na__LeVecJoin__CutAt(sheet, aim, pointMm) {
        const reach   = Na__LeVecAim__ReachMm() * 1.5;
        const cutters = Na__LeVecAim__CuttersFor(sheet, aim.shape.Shape__Id, Na__LeVecAim__BoxOf([ [ pointMm.x - reach, pointMm.y - reach ], [ pointMm.x + reach, pointMm.y + reach ] ], 0));
        let best = null;
        Na__LeVecGeo__Crossings(aim.path, cutters, { self : Na__LeVecCfg__Value('Behaviour', 'CutToOwnCrossings', true) }).forEach((hit) => {
            const d = Math.hypot(hit.x - pointMm.x, hit.y - pointMm.y);
            if (d <= reach && (!best || d < best.d)) best = { d : d, station : hit.station, x : hit.x, y : hit.y, crossing : true };
        });
        if (best) return best;
        aim.path.points.forEach((p, index) => {
            const d = Math.hypot(p[0] - pointMm.x, p[1] - pointMm.y);
            if (d <= reach && (!best || d < best.d)) best = { d : d, station : index, x : p[0], y : p[1], crossing : false };
        });
        return best || { station : aim.at.station, x : aim.at.x, y : aim.at.y, crossing : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With Split Up
    // ------------------------------------------------------------
    function Na__LeVecJoin__SplitMove(ctx) {
        Na__LeOsnap__HideMarker();
        Na__LeVec__SetHint(Na__LeVecCfg__Label('HintSplit', 'Split: click where to cut.'));
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecPrev__Clear(); return 'crosshair'; }
        if (aim.refusal) { Na__LeVecPrev__Clear(); return 'not-allowed'; }
        const cut = Na__LeVecJoin__CutAt(ctx.sheet, aim, ctx.pointMm);
        Na__LeVecPrev__Show([], [ { x : cut.x, y : cut.y, kind : cut.crossing ? Na__LeVecPrev__MARK_CROSS : Na__LeVecPrev__MARK_DOT, tone : Na__LeVecPrev__TONE_REMOVE } ]);
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Click With Split Up
    // ------------------------------------------------------------
    // At a crossing every vector within reach that passes through it is cut
    // there, as one undo step.
    // ------------------------------------------------------------
    function Na__LeVecJoin__SplitPress(ctx) {
        const aim = Na__LeVecAim__At(ctx.sheet, ctx.pointMm);
        if (!aim) return false;
        if (aim.refusal) { Na__LeVecJoin__SayRefusal(aim.refusal); return false; }
        const cut   = Na__LeVecJoin__CutAt(ctx.sheet, aim, ctx.pointMm);
        const jobs  = [ { shape : aim.shape, path : aim.path, station : cut.station } ];
        if (cut.crossing) {
            Na__LeVecAim__All(ctx.sheet).forEach((entry) => {
                if (entry.shape.Shape__Id === aim.shape.Shape__Id) return;
                const at = Na__LeVecGeo__NearestStation(entry.path, { x : cut.x, y : cut.y });
                if (at && at.distance <= 1e-4) jobs.push({ shape : entry.shape, path : entry.path, station : at.station });   // <-- It passes through the very same place
            });
        }
        let done = 0;
        jobs.forEach((job) => {
            const pieces = Na__LeVecGeo__SplitAt(job.path, job.station);
            if (!pieces) return;
            Na__LeVecAim__Replace(ctx.sheet, job.shape, pieces, { silent : true });
            done++;
        });
        if (!done) { Na__LeVec__Say(Na__LeVecCfg__Label('SaySplitEnd', 'That is the end of the line: there is nothing to part.')); return false; }
        Na__LeVecAim__Announce(ctx.sheet, null);
        Na__LeVecPrev__Clear();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cut One Vector at a Paper Point (the right-click menu's Split here)
    // ------------------------------------------------------------
    function Na__LeVecJoin__SplitShapeAt(sheet, shapeId, pointMm) {
        const shape = Na__LeVecAim__Shape(sheet, shapeId);
        if (!shape || Na__LeVecAim__Refusal(sheet, shape)) return false;
        const path = Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed);
        const at   = Na__LeVecGeo__NearestStation(path, pointMm);
        const pieces = at ? Na__LeVecGeo__SplitAt(path, at.station) : null;
        if (!pieces) return false;
        Na__LeVecAim__Replace(sheet, shape, pieces);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Join and Split API
    // ------------------------------------------------------------
    export {
        Na__LeVecJoin__Arm,
        Na__LeVecJoin__Press,
        Na__LeVecJoin__Move,
        Na__LeVecJoin__Weld,
        Na__LeVecJoin__Cancel,
        Na__LeVecJoin__IsBusy,
        Na__LeVecJoin__SplitPress,
        Na__LeVecJoin__SplitMove,
        Na__LeVecJoin__SplitShapeAt
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
