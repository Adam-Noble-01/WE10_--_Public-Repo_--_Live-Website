// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - CIRCLE TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__CircleTool__.js
// NAMESPACE  : Na__LeVecCircle
// MODULE     : Layout Editor - Vector Tools - Circle Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a circle, or a polygon of any number of sides, centre then radius, and hand it over as an ordinary closed vector
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - LAYOUT'S CIRCLE, ON LAYOUT'S KEY (C): click the centre, then click the
//   radius - or press on the centre and drag out to it. Both points snap as
//   the Draw tool's do. A radius typed into the Measurements box lands it;
//   3000d is a diameter, and 6s sets the number of sides, which is how a
//   hexagon is drawn - LayOut keeps a Polygon tool for that, but it is the
//   same two clicks, so here it is the same tool.
// - AS IN SKETCHUP, a size typed straight after a circle lands resizes THAT
//   circle, for as long as it is still selected and nothing has moved it, and
//   a count typed then redraws it with that many sides. Each is its own undo
//   step.
// - WHAT IT MAKES IS NOT A NEW KIND OF THING, the rule the Rectangle tool set:
//   a closed run of points in Sheet__Shapes, written through the same
//   CreateShape call with the same Vectors panel defaults. The record also
//   carries the one-word Shape__Curve hint, which changes nothing about how it
//   is drawn and only tells the panel it is worth reading the radius back
//   (Na__LayoutEditor__VectorTools__Curves__).
// - THE FIRST POINT OF THE CIRCLE IS WHERE THE RADIUS WAS CLICKED, so the
//   point that was snapped to is a real vertex of what is drawn, and with the
//   count a multiple of four so are the three points square to it.
// - While it is being drawn it is not a record: the preview is the overlay's,
//   and nothing reaches the model until the radius lands. An abandoned circle
//   leaves nothing behind.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands it the press, the move,
//   the release, the keys and the typed values.
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Snapping, Curves and the Preview
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CreateShape, Na__LeModel__UpdateShape, Na__LeModel__SetSelection, Na__LeModel__GetSelection, Na__LeModel__GetShapeById } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeVecCurve__KIND_CIRCLE, Na__LeVecCurve__SegmentsFor, Na__LeVecCurve__CirclePoints, Na__LeVecCurve__Describe } from './Na__LayoutEditor__VectorTools__Curves__.js';
    import { Na__LeVecPrev__TONE_GHOST, Na__LeVecPrev__MARK_DOT, Na__LeVecPrev__Show, Na__LeVecPrev__Clear } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVec__GetSetting, Na__LeVec__SetHint } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Circle Being Drawn, and the One That Just Landed
    // ------------------------------------------------------------
    let Na__LeVecCircle__Draft  = null;    // <-- { centre : [x, y], defaults, press : { pointerId, x, y } or null, dragged, rim : { x, y } }
    let Na__LeVecCircle__Landed = null;    // <-- { id, points : [[x, y], ...] } until another starts or the tool is put down
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Smallest Radius That Is a Circle (paper millimetres at this zoom)
    // ------------------------------------------------------------
    // The select tool's drag threshold, as the Rectangle tool uses it, so "that
    // press moved" and "that circle has a size" are one distance on screen.
    // ------------------------------------------------------------
    function Na__LeVecCircle__MinRadiusMm() {
        return Na__LeCfg__GetSelectionSetup().dragThresholdMm / Math.max(1e-6, Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Sides a Circle of This Radius Is Drawn With
    // ------------------------------------------------------------
    // The panel's count when one is set; else as many as the radius needs.
    // ------------------------------------------------------------
    function Na__LeVecCircle__SidesFor(radiusMm) {
        const asked = Na__LeVec__GetSetting('circleSegments');
        if (asked >= 3) return asked;
        return Na__LeVecCurve__SegmentsFor(radiusMm,
            Na__LeVecCfg__Value('Behaviour', 'ChordToleranceMm', 0.01),
            Na__LeVecCfg__Value('Behaviour', 'MinCircleSegments', 24),
            Na__LeVecCfg__Value('Behaviour', 'MaxCircleSegments', 360));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Circle Being Stretched
    // ------------------------------------------------------------
    function Na__LeVecCircle__Preview() {
        const draft = Na__LeVecCircle__Draft;
        if (!draft) { Na__LeVecPrev__Clear(); return; }
        const r = Math.hypot(draft.rim.x - draft.centre[0], draft.rim.y - draft.centre[1]);
        const parts = [];
        if (r >= Na__LeVecCircle__MinRadiusMm()) {
            const start = Math.atan2(draft.rim.y - draft.centre[1], draft.rim.x - draft.centre[0]);
            parts.push({ points : Na__LeVecCurve__CirclePoints(draft.centre[0], draft.centre[1], r, Na__LeVecCircle__SidesFor(r), start), closed : true, tone : Na__LeVecPrev__TONE_GHOST, dashed : true });
            parts.push({ points : [ draft.centre, [ draft.rim.x, draft.rim.y ] ], closed : false, tone : Na__LeVecPrev__TONE_GHOST, dashed : true });
        }
        Na__LeVecPrev__Show(parts, [ { x : draft.centre[0], y : draft.centre[1], kind : Na__LeVecPrev__MARK_DOT, tone : Na__LeVecPrev__TONE_GHOST } ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Circle Being Drawn and Everything Shown for It
    // ------------------------------------------------------------
    function Na__LeVecCircle__Clear() {
        Na__LeVecCircle__Draft = null;
        Na__LeVecPrev__Clear();
        Na__LeOsnap__HideMarker();
        Na__LeVec__SetHint(Na__LeVecCfg__Label('HintCircleCentre', 'Circle: click the centre.'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Finished Circle, Select It and Remember It
    // ------------------------------------------------------------
    function Na__LeVecCircle__Write(sheet, centre, radiusMm, startRad, defaults) {
        const d      = defaults || {};
        const points = Na__LeVecCurve__CirclePoints(centre[0], centre[1], radiusMm, Na__LeVecCircle__SidesFor(radiusMm), startRad);
        const item   = Na__LeModel__CreateShape(sheet, points, {
            strokeColour : d.strokeColour, strokePt : d.strokePt, fillColour : d.filled ? d.fillColour : null,
            fillOpacity : d.fillOpacity, strokeOpacity : d.strokeOpacity,
            gradient : d.gradientOn ? d.gradient : null, dash : d.dashOn ? d.dash : null, closed : true, stroked : d.stroked !== false,
            curve : { Curve__Kind : Na__LeVecCurve__KIND_CIRCLE },
            layerId : d.layerId || null
        });                                                                  // <-- Not silent: created and announced at once, so one undo step
        if (!item) return null;
        Na__LeVecCircle__Landed = { id : item.Shape__Id, points : item.Shape__Points.map((p) => [ p[0], p[1] ]) };
        Na__LeModel__SetSelection({ kind : 'shape', id : item.Shape__Id });
        return item;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Radius and Write the Shape
    // ------------------------------------------------------------
    function Na__LeVecCircle__Land(sheet, pointMm) {
        const draft = Na__LeVecCircle__Draft;
        if (!draft || !sheet) return false;
        const snap = Na__LeOsnap__Snap(sheet, pointMm, null, { from : { x : draft.centre[0], y : draft.centre[1] } });   // <-- From the centre, so Perpendicular finds the foot on a line: the circle is then TANGENT to that line
        const rim  = snap.snapped ? { x : snap.x, y : snap.y } : { x : pointMm.x, y : pointMm.y };
        const r    = Math.hypot(rim.x - draft.centre[0], rim.y - draft.centre[1]);
        if (r < Na__LeVecCircle__MinRadiusMm()) return false;                 // <-- A circle of no size is not a circle: keep waiting
        const centre = draft.centre, d = draft.defaults;
        Na__LeVecCircle__Clear();
        return !!Na__LeVecCircle__Write(sheet, centre, r, Math.atan2(rim.y - centre[1], rim.x - centre[0]), d);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Circle That Just Landed, While a Typed Value May Still Change It
    // ------------------------------------------------------------
    // Only while nothing is being drawn, it is still selected on its own, and
    // its points are exactly where they landed and still read as a circle.
    // ------------------------------------------------------------
    function Na__LeVecCircle__Retypable(sheet) {
        const landed = Na__LeVecCircle__Landed;
        if (!landed || !sheet || Na__LeVecCircle__Draft) return null;
        const selection = Na__LeModel__GetSelection();
        if (!selection || selection.kind !== 'shape' || selection.id !== landed.id) return null;
        const shape = Na__LeModel__GetShapeById(sheet, landed.id);
        if (!shape || shape.Shape__Closed !== true || !Array.isArray(shape.Shape__Points) || shape.Shape__Points.length !== landed.points.length) return null;
        if (!shape.Shape__Points.every((p, i) => Math.abs(p[0] - landed.points[i][0]) <= 1e-9 && Math.abs(p[1] - landed.points[i][1]) <= 1e-9)) return null;
        const read = Na__LeVecCurve__Describe(shape.Shape__Points, true);
        return read ? { id : landed.id, read : read } : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | A Left Press With the Circle Tool
    // ------------------------------------------------------------
    // ctx: { sheet, pointMm, shift, pointerId, defaults }. The first press sets
    // the centre; a press while a centre is waiting lands the radius, and when
    // it cannot (it is on the centre) it is remembered as the first was, so
    // dragging away from there still draws the circle.
    // ------------------------------------------------------------
    function Na__LeVecCircle__Press(ctx) {
        if (Na__LeVecCircle__Draft && Na__LeVecCircle__Land(ctx.sheet, ctx.pointMm)) return true;
        const press = { pointerId : ctx.pointerId, x : ctx.pointMm.x, y : ctx.pointMm.y };
        if (Na__LeVecCircle__Draft) { Na__LeVecCircle__Draft.press = press; Na__LeVecCircle__Draft.dragged = false; return true; }
        const snap   = Na__LeOsnap__Snap(ctx.sheet, ctx.pointMm);
        const centre = snap.snapped ? [ snap.x, snap.y ] : [ ctx.pointMm.x, ctx.pointMm.y ];
        Na__LeVecCircle__Landed = null;                                      // <-- A new circle: the last one can no longer be retyped
        Na__LeVecCircle__Draft  = { centre : centre, defaults : ctx.defaults || {}, press : press, dragged : false, rim : { x : centre[0], y : centre[1] } };
        Na__LeVec__SetHint(Na__LeVecCfg__Label('HintCircleRadius', 'Circle: click the radius, or type it.'));
        Na__LeVecCircle__Preview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Circle Tool
    // ------------------------------------------------------------
    function Na__LeVecCircle__Move(ctx) {
        const draft = Na__LeVecCircle__Draft;
        if (!draft) { Na__LeOsnap__Snap(ctx.sheet, ctx.pointMm); return false; }   // <-- Marker before the centre
        if (draft.press && !ctx.pressed) { draft.press = null; draft.dragged = false; }
        if (draft.press && !draft.dragged && Math.hypot(ctx.pointMm.x - draft.press.x, ctx.pointMm.y - draft.press.y) >= Na__LeVecCircle__MinRadiusMm()) draft.dragged = true;
        const snap = Na__LeOsnap__Snap(ctx.sheet, ctx.pointMm, null, { from : { x : draft.centre[0], y : draft.centre[1] } });
        draft.rim = snap.snapped ? { x : snap.x, y : snap.y } : { x : ctx.pointMm.x, y : ctx.pointMm.y };
        Na__LeVecCircle__Preview();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Comes Up With the Circle Tool
    // ------------------------------------------------------------
    function Na__LeVecCircle__Release(ctx) {
        const draft = Na__LeVecCircle__Draft;
        if (!draft || !draft.press || draft.press.pointerId !== ctx.pointerId) return false;
        const dragged = draft.dragged;
        draft.press   = null;
        draft.dragged = false;
        if (ctx.cancelled === true) { Na__LeVecCircle__Cancel(); return false; }
        return dragged ? Na__LeVecCircle__Land(ctx.sheet, ctx.pointMm) : false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon the Circle Being Drawn, and Is One Being Drawn
    // ------------------------------------------------------------
    function Na__LeVecCircle__Cancel() {
        const had = !!Na__LeVecCircle__Draft;
        Na__LeVecCircle__Clear();
        Na__LeVecCircle__Landed = null;
        return had;
    }
    function Na__LeVecCircle__IsBusy() { return !!Na__LeVecCircle__Draft; }
    function Na__LeVecCircle__Arm()    { Na__LeVecCircle__Clear(); }          // <-- The tool has just been picked up: say what it wants
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typed Values
// -----------------------------------------------------------------------------

    // FUNCTION | What the Measurements Box Reads
    // ------------------------------------------------------------
    // Returns { label, anchor : { x, y }, valueMm } - the radius of the circle
    // being stretched, or of the one that just landed - or a resting reading
    // with no value, so the box is awake for a first typed count.
    // ------------------------------------------------------------
    function Na__LeVecCircle__Measure(sheet, cursorMm) {
        const label = Na__LeVecCfg__Label('MeasureRadius', 'Radius');
        const title = Na__LeVecCfg__Label('MeasureTitleCircle', 'Type a radius and press Enter - 1500, or 1.5m. 3000d is a diameter and 6s is six sides. Typed straight after a circle lands, it resizes that circle.');
        const draft = Na__LeVecCircle__Draft;
        if (draft) {
            const r = Math.hypot(draft.rim.x - draft.centre[0], draft.rim.y - draft.centre[1]);
            return { label : label, title : title, anchor : { x : draft.centre[0], y : draft.centre[1] }, valueMm : r >= 1e-4 ? r : null };
        }
        const landed = Na__LeVecCircle__Retypable(sheet);
        if (landed) return { label : label, title : title, anchor : { x : landed.read.cx, y : landed.read.cy }, valueMm : landed.read.r };
        return { label : label, title : title, anchor : cursorMm || null, valueMm : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Use a Typed Radius, Diameter or Count
    // ------------------------------------------------------------
    // typed: { sides } or { radiusMm } (paper mm, already taken off the scale).
    // Returns { ok : true, message } or { ok : false, reason } - 'point' when
    // there is no centre yet and no circle to resize.
    // ------------------------------------------------------------
    function Na__LeVecCircle__Type(sheet, typed) {
        if (!sheet || !typed) return { ok : false, reason : 'point' };
        const draft  = Na__LeVecCircle__Draft;
        const landed = draft ? null : Na__LeVecCircle__Retypable(sheet);
        if (Number.isFinite(typed.sides)) {                                   // <-- The count has already gone into the settings; a landed circle is redrawn with it
            if (landed) {
                const points = Na__LeVecCurve__CirclePoints(landed.read.cx, landed.read.cy, landed.read.r, Na__LeVecCircle__SidesFor(landed.read.r), landed.read.start);
                Na__LeModel__UpdateShape(sheet, landed.id, { points : points });
                Na__LeVecCircle__Landed = { id : landed.id, points : points.map((p) => [ p[0], p[1] ]) };
            } else if (draft) Na__LeVecCircle__Preview();
            return { ok : true };
        }
        if (!(typed.radiusMm >= 1e-4)) return { ok : false, reason : 'size' };
        if (landed) {
            const points = Na__LeVecCurve__CirclePoints(landed.read.cx, landed.read.cy, typed.radiusMm, Na__LeVecCircle__SidesFor(typed.radiusMm), landed.read.start);
            Na__LeModel__UpdateShape(sheet, landed.id, { points : points });        // <-- Announced: the resize is an undo step of its own
            Na__LeVecCircle__Landed = { id : landed.id, points : points.map((p) => [ p[0], p[1] ]) };
            return { ok : true, resized : true };
        }
        if (!draft) return { ok : false, reason : 'point' };
        const dx = draft.rim.x - draft.centre[0], dy = draft.rim.y - draft.centre[1];
        const start = Math.hypot(dx, dy) >= 1e-6 ? Math.atan2(dy, dx) : 0;    // <-- Towards the cursor, so the first vertex is where it was pointing
        const centre = draft.centre, d = draft.defaults;
        Na__LeVecCircle__Clear();
        return Na__LeVecCircle__Write(sheet, centre, typed.radiusMm, start, d) ? { ok : true } : { ok : false, reason : 'point' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Circle Tool API
    // ------------------------------------------------------------
    export {
        Na__LeVecCircle__SidesFor,
        Na__LeVecCircle__Arm,
        Na__LeVecCircle__Press,
        Na__LeVecCircle__Move,
        Na__LeVecCircle__Release,
        Na__LeVecCircle__Cancel,
        Na__LeVecCircle__IsBusy,
        Na__LeVecCircle__Measure,
        Na__LeVecCircle__Type
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
