// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - ARC TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__ArcTool__.js
// NAMESPACE  : Na__LeVecArc
// MODULE     : Layout Editor - Vector Tools - Arc Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw an arc in three clicks, any of LayOut's four ways, and hand it over as an ordinary open vector
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - LAYOUT HAS FOUR ARC TOOLS; THIS IS ALL FOUR, chosen in the Vector Tools
//   panel and remembered:
//     2 Point      start, end, then the bulge - the one on Adam's A key in
//                  LayOut, SketchUp's own arc, and the one shipped as default
//     Centre       the centre, where it starts (which sets the radius), then
//                  round to where it ends, either way and past a half turn
//     3 Point      start, a point it passes through, end
//     Pie          as Centre, closed back to the centre - a filled wedge
// - EVERY POINT SNAPS as the Draw tool's do. The end of a 2 Point chord and
//   the start of a Centre arc are held to an axis by Shift or Ortho, as a
//   line's next point is. A 2 Point bulge that comes within a few pixels of
//   half its chord lands on the exact half circle, as SketchUp's does.
// - TYPED VALUES, at the drawing's scale: the chord's length or the radius
//   while that is what the cursor is setting; then the BULGE (or a radius, as
//   750r) for a 2 Point arc, or the ANGLE in degrees for a Centre arc or a Pie,
//   which goes round the way the cursor already is. 6s sets the sides a whole
//   circle would have; an arc gets its share of them.
// - WHAT IT MAKES IS AN ORDINARY OPEN VECTOR (a Pie a closed one), its first
//   and last points EXACTLY the points that were clicked, carrying the
//   one-word Shape__Curve hint so the panel can read its radius back. Ctrl+Z
//   takes the last point back off; Escape abandons it; nothing reaches the
//   model until the third point lands.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands it the press, the move,
//   the keys and the typed values.
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
// - Initial implementation: the four ways of drawing, the half circle snap,
//   the axis hold, typed chord, radius, bulge and angle, and stepping back.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Snapping, Axis Hold, Curves and the Preview
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CreateShape, Na__LeModel__SetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom, Na__LeSurface__GetPixelsPerMm } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeAxis__Get, Na__LeAxis__Clear, Na__LeAxis__Apply, Na__LeAxis__Hold, Na__LeAxis__Constrain } from '../30__System__SheetTools/Na__LayoutEditor__AxisLock__.js';
    import { Na__LeOrtho__Resolve } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js';
    import {
        Na__LeVecCurve__KIND_ARC,
        Na__LeVecCurve__ArcSegmentsFor,
        Na__LeVecCurve__ArcPoints,
        Na__LeVecCurve__ArcThrough,
        Na__LeVecCurve__ArcFromBulge,
        Na__LeVecCurve__BulgeOf,
        Na__LeVecCurve__BulgeForRadius,
        Na__LeVecCurve__ArcAbout,
        Na__LeVecCurve__CarrySweep
    } from './Na__LayoutEditor__VectorTools__Curves__.js';
    import { Na__LeVecPrev__TONE_GHOST, Na__LeVecPrev__MARK_DOT, Na__LeVecPrev__Show, Na__LeVecPrev__Clear } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVec__ARC_TWO_POINT, Na__LeVec__ARC_CENTRE, Na__LeVec__ARC_THREE_POINT, Na__LeVec__ARC_PIE, Na__LeVec__GetSetting, Na__LeVec__SetHint } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Arc Being Drawn
    // ------------------------------------------------------------
    let Na__LeVecArc__Draft = null;    // <-- { mode, points : [[x, y], ...] (those clicked so far), defaults, cursor : { x, y } or null, sweep : the Centre arc's carried sweep }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Way of Drawing in Force, and Whether It Starts From a Centre
    // ------------------------------------------------------------
    function Na__LeVecArc__Mode()          { return Na__LeVec__GetSetting('arcMode'); }
    function Na__LeVecArc__FromCentre(mode) { return mode === Na__LeVec__ARC_CENTRE || mode === Na__LeVec__ARC_PIE; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Shortest Distance That Counts (paper millimetres at this zoom)
    // ------------------------------------------------------------
    function Na__LeVecArc__MinMm() {
        return Na__LeCfg__GetSelectionSetup().dragThresholdMm / Math.max(1e-6, Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Tool Wants Next, in Words
    // ------------------------------------------------------------
    function Na__LeVecArc__Hint() {
        const draft = Na__LeVecArc__Draft;
        const mode  = draft ? draft.mode : Na__LeVecArc__Mode();
        const have  = draft ? draft.points.length : 0;
        if (Na__LeVecArc__FromCentre(mode)) {
            if (have === 0) return Na__LeVecCfg__Label('HintArcCentre', 'Arc: click the centre.');
            if (have === 1) return Na__LeVecCfg__Label('HintArcFrom', 'Arc: click where it starts - that sets the radius.');
            return Na__LeVecCfg__Label('HintArcSweep', 'Arc: go round and click where it ends, or type the angle.');
        }
        if (have === 0) return Na__LeVecCfg__Label('HintArcStart', 'Arc: click where it starts.');
        if (mode === Na__LeVec__ARC_THREE_POINT) return have === 1 ? Na__LeVecCfg__Label('HintArcThrough', 'Arc: click a point it passes through.') : Na__LeVecCfg__Label('HintArcEnd', 'Arc: click where it ends.');
        return have === 1 ? Na__LeVecCfg__Label('HintArcEnd', 'Arc: click where it ends.') : Na__LeVecCfg__Label('HintArcBulge', 'Arc: move off the line and click, or type the bulge.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Next Point Lands: a Snap, Held to an Axis Where a Line's Would Be
    // ------------------------------------------------------------
    // held is true for the points that set a straight run - a 2 Point chord's
    // end, a Centre arc's start - which take the arrow-key lock, Shift and
    // Ortho exactly as the Draw tool's next vertex does. The bulge, the point
    // passed through and the end of a sweep are free: an axis means nothing to
    // them.
    // ------------------------------------------------------------
    function Na__LeVecArc__Resolve(sheet, pointMm, shift, held) {
        const draft = Na__LeVecArc__Draft;
        const from  = (draft && draft.points.length) ? { x : draft.points[draft.points.length - 1][0], y : draft.points[draft.points.length - 1][1] } : null;
        const snap  = from ? Na__LeOsnap__Snap(sheet, pointMm, null, { from : from }) : Na__LeOsnap__Snap(sheet, pointMm);   // <-- From the point before, so Perpendicular can square a chord - or a radius, which is a tangent arc - up to a line
        const at    = snap.snapped ? { x : snap.x, y : snap.y } : { x : pointMm.x, y : pointMm.y };
        if (!held || !draft || !draft.points.length) return at;
        const last = draft.points[draft.points.length - 1];
        const hold = Na__LeOrtho__Resolve(shift);
        if (Na__LeAxis__Get()) return Na__LeAxis__Apply(last, at);
        if (hold)              return Na__LeAxis__Hold(last, pointMm, at);
        if (snap.snapped)      return at;
        return Na__LeAxis__Constrain(last, pointMm, hold);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Arc the Points and the Cursor Make, or Null While They Make None
    // ------------------------------------------------------------
    // Returns { arc : { cx, cy, r, start, sweep }, from, to } once two points
    // are down and the cursor has somewhere to be.
    // ------------------------------------------------------------
    function Na__LeVecArc__Solve(draft, cursor) {
        if (!draft || draft.points.length < 2 || !cursor) return null;
        const a = draft.points[0], b = draft.points[1], c = [ cursor.x, cursor.y ];
        if (draft.mode === Na__LeVec__ARC_THREE_POINT) {
            const arc = Na__LeVecCurve__ArcThrough(a, b, c);
            return arc ? { arc : arc, from : a, to : c } : null;
        }
        if (Na__LeVecArc__FromCentre(draft.mode)) {
            const start = Math.atan2(b[1] - a[1], b[0] - a[0]);
            draft.sweep = Na__LeVecCurve__CarrySweep(draft.sweep, start, Math.atan2(c[1] - a[1], c[0] - a[0]));
            const arc = Na__LeVecCurve__ArcAbout(a, b, draft.sweep);
            if (!arc) return null;
            const end = arc.start + arc.sweep;
            return { arc : arc, from : b, to : [ arc.cx + (arc.r * Math.cos(end)), arc.cy + (arc.r * Math.sin(end)) ] };
        }
        let bulge = Na__LeVecCurve__BulgeOf(a, b, c);
        const half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
        const snapMm = Na__LeVecCfg__Value('Behaviour', 'HalfCircleSnapPx', 8) / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        if (Math.abs(Math.abs(bulge) - half) <= snapMm) bulge = (bulge < 0 ? -1 : 1) * half;   // <-- SketchUp's Half Circle inference
        const arc = Na__LeVecCurve__ArcFromBulge(a, b, bulge);
        return arc ? { arc : arc, from : a, to : b } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Points of a Solved Arc (a Pie's run back to its centre and close)
    // ------------------------------------------------------------
    function Na__LeVecArc__PointsOf(solved, mode) {
        const asked = Na__LeVec__GetSetting('circleSegments');
        const count = asked >= 3
            ? Math.max(1, Math.round(asked * (Math.abs(solved.arc.sweep) / (Math.PI * 2))))
            : Na__LeVecCurve__ArcSegmentsFor(solved.arc.r, solved.arc.sweep,
                Na__LeVecCfg__Value('Behaviour', 'ChordToleranceMm', 0.01),
                Na__LeVecCfg__Value('Behaviour', 'MinCircleSegments', 24),
                Na__LeVecCfg__Value('Behaviour', 'MaxCircleSegments', 360));
        const whole  = Math.abs(Math.abs(solved.arc.sweep) - (Math.PI * 2)) < 1e-9;
        const points = Na__LeVecCurve__ArcPoints(solved.arc.cx, solved.arc.cy, solved.arc.r, solved.arc.start, solved.arc.sweep, count, { from : solved.from, to : whole ? solved.from : solved.to });
        if (mode === Na__LeVec__ARC_PIE) points.push([ solved.arc.cx, solved.arc.cy ]);
        return points;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show What Is Being Drawn
    // ------------------------------------------------------------
    function Na__LeVecArc__Preview() {
        const draft = Na__LeVecArc__Draft;
        if (!draft) { Na__LeVecPrev__Clear(); return; }
        const parts = [], marks = [];
        const cursor = draft.cursor;
        draft.points.forEach((p) => marks.push({ x : p[0], y : p[1], kind : Na__LeVecPrev__MARK_DOT, tone : Na__LeVecPrev__TONE_GHOST }));
        if (draft.points.length === 1 && cursor) parts.push({ points : [ draft.points[0], [ cursor.x, cursor.y ] ], closed : false, tone : Na__LeVecPrev__TONE_GHOST, dashed : true });
        if (draft.points.length === 2) {
            const solved = Na__LeVecArc__Solve(draft, cursor);
            if (solved) {
                parts.push({ points : Na__LeVecArc__PointsOf(solved, draft.mode), closed : draft.mode === Na__LeVec__ARC_PIE, tone : Na__LeVecPrev__TONE_GHOST, dashed : false });
                if (Na__LeVecArc__FromCentre(draft.mode)) parts.push({ points : [ draft.points[0], solved.to ], closed : false, tone : Na__LeVecPrev__TONE_GHOST, dashed : true });
            }
            parts.push({ points : [ draft.points[0], draft.points[1] ], closed : false, tone : Na__LeVecPrev__TONE_GHOST, dashed : true });
        }
        Na__LeVecPrev__Show(parts, marks);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Arc Being Drawn and Everything Shown for It
    // ------------------------------------------------------------
    function Na__LeVecArc__Clear() {
        Na__LeVecArc__Draft = null;
        Na__LeAxis__Clear();
        Na__LeVecPrev__Clear();
        Na__LeOsnap__HideMarker();
        Na__LeVec__SetHint(Na__LeVecArc__Hint());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Finished Arc and Select It
    // ------------------------------------------------------------
    function Na__LeVecArc__Write(sheet, solved, mode, defaults) {
        const d    = defaults || {};
        const pie  = mode === Na__LeVec__ARC_PIE;
        const item = Na__LeModel__CreateShape(sheet, Na__LeVecArc__PointsOf(solved, mode), {
            strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null,
            fillOpacity : d.fillOpacity, strokeOpacity : d.strokeOpacity,
            gradient : d.gradientOn ? d.gradient : null, dash : d.dashOn ? d.dash : null, closed : pie, stroked : pie ? d.stroked !== false : true,   // <-- An open arc always draws its line, as a drawn polyline does
            curve : pie ? null : { Curve__Kind : Na__LeVecCurve__KIND_ARC },  // <-- A Pie's points are not all on its circle, so it is a plain shape
            layerId : d.layerId || null
        });                                                                  // <-- Not silent: one undo step
        if (!item) return null;
        Na__LeModel__SetSelection({ kind : 'shape', id : item.Shape__Id });
        return item;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Third Point
    // ------------------------------------------------------------
    function Na__LeVecArc__Land(sheet, cursor) {
        const draft = Na__LeVecArc__Draft;
        const solved = Na__LeVecArc__Solve(draft, cursor);
        if (!solved || Math.abs(solved.arc.sweep) * solved.arc.r < Na__LeVecArc__MinMm()) return false;   // <-- No arc yet: keep waiting
        const mode = draft.mode, d = draft.defaults;
        Na__LeVecArc__Clear();
        return !!Na__LeVecArc__Write(sheet, solved, mode, d);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | A Click With the Arc Tool
    // ------------------------------------------------------------
    function Na__LeVecArc__Press(ctx) {
        let draft = Na__LeVecArc__Draft;
        if (!draft) {
            const snap = Na__LeOsnap__Snap(ctx.sheet, ctx.pointMm);
            const at   = snap.snapped ? [ snap.x, snap.y ] : [ ctx.pointMm.x, ctx.pointMm.y ];
            Na__LeVecArc__Draft = { mode : Na__LeVecArc__Mode(), points : [ at ], defaults : ctx.defaults || {}, cursor : null, sweep : NaN };
            Na__LeVec__SetHint(Na__LeVecArc__Hint());
            Na__LeVecArc__Preview();
            return true;
        }
        if (draft.points.length === 1) {
            const held = draft.mode === Na__LeVec__ARC_TWO_POINT || Na__LeVecArc__FromCentre(draft.mode);
            const at   = Na__LeVecArc__Resolve(ctx.sheet, ctx.pointMm, ctx.shift, held);
            if (Math.hypot(at.x - draft.points[0][0], at.y - draft.points[0][1]) < Na__LeVecArc__MinMm()) return false;   // <-- A doubled point is not a second point
            draft.points.push([ at.x, at.y ]);
            draft.cursor = null;
            draft.sweep  = NaN;
            Na__LeAxis__Clear();                                             // <-- The point landed: the lock is spent
            Na__LeVec__SetHint(Na__LeVecArc__Hint());
            Na__LeVecArc__Preview();
            return true;
        }
        const at = Na__LeVecArc__Resolve(ctx.sheet, ctx.pointMm, ctx.shift, false);
        draft.cursor = at;
        return Na__LeVecArc__Land(ctx.sheet, at);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Arc Tool
    // ------------------------------------------------------------
    function Na__LeVecArc__Move(ctx) {
        const draft = Na__LeVecArc__Draft;
        if (!draft) { Na__LeOsnap__Snap(ctx.sheet, ctx.pointMm); return false; }   // <-- Marker before the first click
        const held = draft.points.length === 1 && (draft.mode === Na__LeVec__ARC_TWO_POINT || Na__LeVecArc__FromCentre(draft.mode));
        draft.cursor = Na__LeVecArc__Resolve(ctx.sheet, ctx.pointMm, ctx.shift, held);
        Na__LeVecArc__Preview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Last Point Back Off (Ctrl+Z while drawing)
    // ------------------------------------------------------------
    // Returns true when the key was spent, so the sheet's history is left alone.
    // ------------------------------------------------------------
    function Na__LeVecArc__StepBack() {
        const draft = Na__LeVecArc__Draft;
        if (!draft) return false;
        if (draft.points.length <= 1) { Na__LeVecArc__Clear(); return true; }
        draft.points.pop();
        draft.sweep = NaN;
        Na__LeAxis__Clear();
        Na__LeVec__SetHint(Na__LeVecArc__Hint());
        Na__LeVecArc__Preview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Arc Being Drawn, Is One Being Drawn, and Is an Axis Worth Locking
    // ------------------------------------------------------------
    function Na__LeVecArc__Cancel() { const had = !!Na__LeVecArc__Draft; Na__LeVecArc__Clear(); return had; }
    function Na__LeVecArc__IsBusy() { return !!Na__LeVecArc__Draft; }
    function Na__LeVecArc__Arm()    { Na__LeVecArc__Clear(); }
    function Na__LeVecArc__TakesAxis() {
        const draft = Na__LeVecArc__Draft;
        return !!draft && draft.points.length === 1 && (draft.mode === Na__LeVec__ARC_TWO_POINT || Na__LeVecArc__FromCentre(draft.mode));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typed Values
// -----------------------------------------------------------------------------

    // FUNCTION | What the Measurements Box Reads
    // ------------------------------------------------------------
    // Returns { label, title, anchor, valueMm } or, for a sweep, { text }.
    // ------------------------------------------------------------
    function Na__LeVecArc__Measure(sheet, cursorMm) {
        const title = Na__LeVecCfg__Label('MeasureTitleArc', 'Type the bulge and press Enter, or a radius as 750r. With the arc drawn from its centre, type the radius, then the angle in degrees.');
        const draft = Na__LeVecArc__Draft;
        if (!draft) return { label : Na__LeVecCfg__Label('MeasureRadius', 'Radius'), title : title, anchor : cursorMm || null, valueMm : null };
        const first  = draft.points[0];
        const anchor = { x : first[0], y : first[1] };
        const cursor = draft.cursor;
        if (draft.points.length === 1) {
            const run = cursor ? Math.hypot(cursor.x - first[0], cursor.y - first[1]) : 0;
            return { label : Na__LeVecArc__FromCentre(draft.mode) ? Na__LeVecCfg__Label('MeasureRadius', 'Radius') : Na__LeVecCfg__Label('MeasureDistance', 'Distance'), title : title, anchor : anchor, valueMm : run >= 1e-4 ? run : null };
        }
        const solved = Na__LeVecArc__Solve(draft, cursor);
        if (Na__LeVecArc__FromCentre(draft.mode)) {
            const degrees = solved ? Math.abs(solved.arc.sweep) * (180 / Math.PI) : 0;
            return { label : Na__LeVecCfg__Label('MeasureAngle', 'Angle'), title : title, anchor : anchor, valueMm : null, text : solved ? (Math.round(degrees * 10) / 10) + '°' : '', angle : true };
        }
        if (draft.mode === Na__LeVec__ARC_THREE_POINT) return { label : Na__LeVecCfg__Label('MeasureRadius', 'Radius'), title : title, anchor : anchor, valueMm : solved ? solved.arc.r : null, readOnly : true };
        return { label : Na__LeVecCfg__Label('MeasureBulge', 'Bulge'), title : title, anchor : anchor, valueMm : solved ? Math.abs(solved.arc.bulge) : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Use a Typed Length, Radius or Angle
    // ------------------------------------------------------------
    // typed: { lengthMm } (paper mm), { radiusMm } (the 'r' suffix) or
    // { degrees }. Returns { ok : true } or { ok : false, reason }: 'point'
    // (click first), 'direction' (point the cursor the way to go), 'radius'
    // (too small to span the chord), 'angle' (an angle was wanted), 'size'.
    // ------------------------------------------------------------
    function Na__LeVecArc__Type(sheet, typed) {
        const draft = Na__LeVecArc__Draft;
        if (!sheet || !typed) return { ok : false, reason : 'point' };
        if (Number.isFinite(typed.sides)) { if (draft) Na__LeVecArc__Preview(); return { ok : true }; }   // <-- The count is already in the settings
        if (!draft) return { ok : false, reason : 'point' };
        const first  = draft.points[0];
        const cursor = draft.cursor;

        if (draft.points.length === 1) {                                     // <-- The chord's length, or the radius: along the way the cursor points
            const size = Number.isFinite(typed.lengthMm) ? typed.lengthMm : typed.radiusMm;
            if (!(size >= 1e-4)) return { ok : false, reason : 'size' };
            const run = cursor ? Math.hypot(cursor.x - first[0], cursor.y - first[1]) : 0;
            if (!(run >= 1e-4)) return { ok : false, reason : 'direction' };
            draft.points.push([ first[0] + (((cursor.x - first[0]) / run) * size), first[1] + (((cursor.y - first[1]) / run) * size) ]);
            draft.sweep = NaN;
            Na__LeAxis__Clear();
            Na__LeVec__SetHint(Na__LeVecArc__Hint());
            Na__LeVecArc__Preview();
            return { ok : true };
        }

        if (Na__LeVecArc__FromCentre(draft.mode)) {
            const degrees = Number.isFinite(typed.degrees) ? typed.degrees : (Number.isFinite(typed.lengthRaw) ? typed.lengthRaw : NaN);
            if (!Number.isFinite(degrees) || Math.abs(degrees) < 1e-6) return { ok : false, reason : 'angle' };
            const way   = (Number.isFinite(draft.sweep) && draft.sweep < 0) ? -1 : 1;   // <-- Round the way the cursor already is
            draft.sweep = way * Math.min(360, Math.abs(degrees)) * (Math.PI / 180);
            const arc = Na__LeVecCurve__ArcAbout(first, draft.points[1], draft.sweep);
            if (!arc) return { ok : false, reason : 'angle' };
            const end = arc.start + arc.sweep;
            const solved = { arc : arc, from : draft.points[1], to : [ arc.cx + (arc.r * Math.cos(end)), arc.cy + (arc.r * Math.sin(end)) ] };
            const mode = draft.mode, d = draft.defaults;
            Na__LeVecArc__Clear();
            return Na__LeVecArc__Write(sheet, solved, mode, d) ? { ok : true } : { ok : false, reason : 'point' };
        }

        if (draft.mode !== Na__LeVec__ARC_TWO_POINT) return { ok : false, reason : 'point' };   // <-- A 3 Point arc is clicked, not typed
        const second = draft.points[1];
        const chord  = Math.hypot(second[0] - first[0], second[1] - first[1]);
        const side   = cursor ? Na__LeVecCurve__BulgeOf(first, second, [ cursor.x, cursor.y ]) : 1;
        let bulge;
        if (Number.isFinite(typed.radiusMm)) {
            bulge = Na__LeVecCurve__BulgeForRadius(chord, typed.radiusMm, side);
            if (bulge === null) return { ok : false, reason : 'radius' };
        } else {
            if (!(typed.lengthMm >= 1e-4)) return { ok : false, reason : 'size' };
            bulge = (side < 0 ? -1 : 1) * typed.lengthMm;
        }
        const arc = Na__LeVecCurve__ArcFromBulge(first, second, bulge);
        if (!arc) return { ok : false, reason : 'size' };
        const mode = draft.mode, d = draft.defaults;
        Na__LeVecArc__Clear();
        return Na__LeVecArc__Write(sheet, { arc : arc, from : first, to : second }, mode, d) ? { ok : true } : { ok : false, reason : 'point' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Arc Tool API
    // ------------------------------------------------------------
    export {
        Na__LeVecArc__Arm,
        Na__LeVecArc__Press,
        Na__LeVecArc__Move,
        Na__LeVecArc__StepBack,
        Na__LeVecArc__Cancel,
        Na__LeVecArc__IsBusy,
        Na__LeVecArc__TakesAxis,
        Na__LeVecArc__Measure,
        Na__LeVecArc__Type
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
