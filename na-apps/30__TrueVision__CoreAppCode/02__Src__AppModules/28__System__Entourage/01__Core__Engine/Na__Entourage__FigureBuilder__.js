// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE FIGURE BUILDER
// =============================================================================
//
// FILE       : Na__Entourage__FigureBuilder__.js
// NAMESPACE  : Na__EntBuild
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Asset + seed + line rules = a figure's lines and its fill's loops, flat, in
//              its own plane, ready to be turned to the camera
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - THE SAME LINE LANGUAGE AS THE PLANTS. Adam, 05-Nov-2026: "the plants on that look amazing,
//   so human entourage needs to be in the same flavour and vibe as to not distract from the
//   architecture", and his choice on the look test: line and face fading together, with pen
//   lifts and hooks. A traced silhouette is only an outline, so this makes it a drawn line:
//     1. SMOOTHED. The tracing's facets go, and its real corners stay.
//     2. PEN LIFTS. Small gaps round the outline, placed by the figure's seed, so no two
//        figures are drawn alike even from one asset.
//     3. HOOKS. At a sharp notch, an armpit or between the legs, the line carries on inward a
//        little, as a plant's line does at a cusp, at the lighter inner weight.
// - A LINE DRAWING KEEPS ITS OWN LINES. The Labrador was already drawn, so it takes pen lifts
//   on its outline and nothing else.
// - ONE SEED, ONE FIGURE, ON EVERY MACHINE. Pen lifts and hooks draw from separate streams,
//   so a Hooks slider does not move the pen lifts. A generator is never edited once a project
//   can hold its figures: the order of random draws is part of that promise (FlatFigure 1).
// - NO THREE.JS, so this runs in Node for checks, and in a worker if it ever needs to.
//
// FRAMES:
// - An asset's points are millimetres in the figure's plane, x across, y up, feet at 0. What
//   this returns is metres in that same plane, ready for the scene layer's world sum.
//
// INTEGRATION:
// - Used by ../03__System__SceneLayer/Na__Entourage__SceneLayer__.js and the asset browser's cards.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/01__Core__Engine/Na__Entourage__FigureBuilder__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build: FlatFigure version 1, proved first as the look test Adam chose from.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Second Stream, and How a Hook Is Drawn
    // ------------------------------------------------------------
    const Na__EntBuild__HOOK_STREAM   = 0x9E3779B9;                            // <-- Mixed into the seed, so hooks and pen lifts never share draws
    const Na__EntBuild__HOOK_STEPS    = 6;
    const Na__EntBuild__HOOK_LOOK_MM  = 40;                                    // <-- How far back along the line a hook takes its heading from
    const Na__EntBuild__HOOK_BEND_RAD = 0.5;
    const Na__EntBuild__MIN_STEP_MM   = 1.5;                                   // <-- Points closer than this are one point
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Sums
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Seeded Generator: mulberry32, as the Plants'
    // ------------------------------------------------------------
    function Na__EntBuild__Random(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | An Asset's String of x,y Pairs as Points in Mm
    // ------------------------------------------------------------
    function Na__EntBuild__ParsePoints(text) {
        const points = [];
        const pairs = String(text || '').trim().split(/\s+/);
        for (let k = 0; k < pairs.length; k++) {
            const comma = pairs[k].indexOf(',');
            if (comma < 0) continue;
            const x = Number(pairs[k].slice(0, comma)), y = Number(pairs[k].slice(comma + 1));
            if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
        }
        return points;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Twice a Loop's Area, Signed: Over 0 Runs Anticlockwise
    // ------------------------------------------------------------
    function Na__EntBuild__SignedArea(loop) {
        let sum = 0;
        for (let i = 0; i < loop.length; i++) {
            const a = loop[i], b = loop[(i + 1) % loop.length];
            sum += a[0] * b[1] - b[0] * a[1];
        }
        return sum;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Loop with Near Repeats Taken Out
    // ------------------------------------------------------------
    function Na__EntBuild__Dedupe(loop) {
        const out = [];
        loop.forEach((point) => {
            const last = out[out.length - 1];
            if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > Na__EntBuild__MIN_STEP_MM) out.push(point);
        });
        if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= Na__EntBuild__MIN_STEP_MM) out.pop();
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Point So Far Along a Loop from a Vertex, in One Direction
    // ------------------------------------------------------------
    function Na__EntBuild__Along(loop, index, direction, spanMm) {
        const n = loop.length;
        let walked = 0, k = index;
        for (let step = 0; step < n; step++) {
            const next = (k + direction + n) % n;
            walked += Math.hypot(loop[next][0] - loop[k][0], loop[next][1] - loop[k][1]);
            k = next;
            if (walked >= spanMm) break;
        }
        return loop[k];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Turn at Each Vertex, Measured Over a Span Either Side
    // ------------------------------------------------------------
    // Over a span, so the small steps of a tracing never count as corners. On an anticlockwise
    // loop a left turn is convex and over 0: a notch is under 0.
    // ------------------------------------------------------------
    function Na__EntBuild__Turns(loop, spanMm) {
        return loop.map((point, index) => {
            const a = Na__EntBuild__Along(loop, index, -1, spanMm);
            const b = Na__EntBuild__Along(loop, index, 1, spanMm);
            const ax = point[0] - a[0], ay = point[1] - a[1], bx = b[0] - point[0], by = b[1] - point[1];
            return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Chaikin's Corner Cutting, Keeping the Marked Corners
    // ------------------------------------------------------------
    function Na__EntBuild__Smooth(loop, corners, passes) {
        let points = loop, marks = corners;
        for (let pass = 0; pass < passes; pass++) {
            const nextPoints = [], nextMarks = [];
            const n = points.length;
            for (let i = 0; i < n; i++) {
                const a = points[i], b = points[(i + 1) % n];
                if (marks[i]) {
                    nextPoints.push(a);
                    nextMarks.push(true);
                } else {
                    nextPoints.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
                    nextMarks.push(false);
                }
                if (!marks[(i + 1) % n]) {
                    nextPoints.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
                    nextMarks.push(false);
                }
            }
            points = nextPoints;
            marks = nextMarks;
        }
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Point Inside a Loop?
    // ------------------------------------------------------------
    function Na__EntBuild__Inside(x, y, loop) {
        let inside = false;
        for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
            const a = loop[i], b = loop[j];
            if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing the Lines
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Chain of Points as Segments, Broken at Seeded Pen Lifts
    // ------------------------------------------------------------
    // Appends x1,y1,x2,y2 in metres to out. everyMm of 0 or Infinity draws it unbroken.
    // ------------------------------------------------------------
    function Na__EntBuild__Stroke(points, closed, everyMm, gapMm, rng, out) {
        const lifting = everyMm > 0 && Number.isFinite(everyMm);
        let walked = 0;
        let nextLift = lifting ? everyMm * (0.5 + rng()) : Infinity;
        let gapLeft = 0;
        const last = closed ? points.length : points.length - 1;
        for (let i = 0; i < last; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (length <= 0) continue;
            let at = 0;
            while (at < length) {
                if (gapLeft > 0) {
                    const step = Math.min(gapLeft, length - at);
                    gapLeft -= step;
                    at += step;
                    continue;
                }
                const step = Math.min(nextLift - walked, length - at);
                const t0 = at / length, t1 = (at + step) / length;
                out.push(
                    (a[0] + (b[0] - a[0]) * t0) / 1000, (a[1] + (b[1] - a[1]) * t0) / 1000,
                    (a[0] + (b[0] - a[0]) * t1) / 1000, (a[1] + (b[1] - a[1]) * t1) / 1000
                );
                at += step;
                walked += step;
                if (walked >= nextLift) {
                    gapLeft = gapMm * (0.6 + rng() * 0.8);
                    nextLift = walked + everyMm * (0.5 + rng());
                }
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Hooks: at a Sharp Notch the Line Carries On Inward
    // ------------------------------------------------------------
    // Takes its heading from the longer of the two lines arriving, and stops if it would leave
    // the figure. Every notch draws its three numbers, taken or not, so a Hooks slider never
    // changes which hook goes where.
    // ------------------------------------------------------------
    function Na__EntBuild__Hooks(loop, turns, rules, rng, out) {
        const notch = (rules.hookNotchDeg * Math.PI) / 180;
        const chance = Math.min(1, rules.hookChance * rules.hooksFactor);
        const reach = Math.sqrt(Math.max(0, rules.hooksFactor));
        const n = loop.length;
        for (let i = 0; i < n; i++) {
            const turn = turns[i];
            if (turn > -notch) continue;                                       // <-- Concave, and sharp
            if (turns[(i - 1 + n) % n] < turn || turns[(i + 1) % n] < turn) continue;   // <-- Only the sharpest of its run
            const roll = rng(), lengthRoll = rng(), bendRoll = rng();
            if (roll > chance) continue;

            const point = loop[i];
            const before = Na__EntBuild__Along(loop, i, -1, Na__EntBuild__HOOK_LOOK_MM);
            const after  = Na__EntBuild__Along(loop, i, 1, Na__EntBuild__HOOK_LOOK_MM);
            const lengthBefore = Math.hypot(point[0] - before[0], point[1] - before[1]) || 1;
            const lengthAfter  = Math.hypot(point[0] - after[0], point[1] - after[1]) || 1;
            const from = lengthBefore >= lengthAfter ? before : after;
            const length = lengthBefore >= lengthAfter ? lengthBefore : lengthAfter;
            const dx = (point[0] - from[0]) / length, dy = (point[1] - from[1]) / length;

            const hookMm = (rules.hookMinMm + lengthRoll * (rules.hookMaxMm - rules.hookMinMm)) * reach;
            const bend = (bendRoll - 0.5) * Na__EntBuild__HOOK_BEND_RAD;
            let prevX = point[0], prevY = point[1];
            for (let k = 1; k <= Na__EntBuild__HOOK_STEPS; k++) {
                const share = k / Na__EntBuild__HOOK_STEPS;
                const angle = bend * share;
                const c = Math.cos(angle), s = Math.sin(angle);
                const x = point[0] + (dx * c - dy * s) * hookMm * share;
                const y = point[1] + (dx * s + dy * c) * hookMm * share;
                if (!Na__EntBuild__Inside(x, y, loop)) break;
                out.push(prevX / 1000, prevY / 1000, x / 1000, y / 1000);
                prevX = x;
                prevY = y;
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Figure
// -----------------------------------------------------------------------------

    // FUNCTION | The Project's Line Rules, as the Builder Wants Them
    // ------------------------------------------------------------
    function Na__EntBuild__RulesFrom(lineRules) {
        const advanced = lineRules.Entourage__LineRules__Advanced;
        return {
            smoothingPasses : Math.max(0, Math.round(lineRules.Entourage__LineRules__SmoothingPasses)),
            hooksFactor     : lineRules.Entourage__LineRules__HooksFactor,
            penLiftsFactor  : lineRules.Entourage__LineRules__PenLiftsFactor,
            cornerDeg       : advanced.Entourage__LineRulesAdvanced__CornerDeg,
            cornerSpanMm    : advanced.Entourage__LineRulesAdvanced__CornerSpanMm,
            penLiftEveryMm  : advanced.Entourage__LineRulesAdvanced__PenLiftEveryMm,
            penLiftGapMm    : advanced.Entourage__LineRulesAdvanced__PenLiftGapMm,
            hookNotchDeg    : advanced.Entourage__LineRulesAdvanced__HookNotchDeg,
            hookChance      : advanced.Entourage__LineRulesAdvanced__HookChance,
            hookMinMm       : advanced.Entourage__LineRulesAdvanced__HookMinMm,
            hookMaxMm       : advanced.Entourage__LineRulesAdvanced__HookMaxMm
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Silhouette: the Outline Worked Up into a Drawn Line
    // ------------------------------------------------------------
    function Na__EntBuild__Silhouette(figure, seed, rules) {
        let loop = Na__EntBuild__Dedupe(Na__EntBuild__ParsePoints(figure.Figure__OutlineMm));
        if (loop.length < 3) return null;
        if (Na__EntBuild__SignedArea(loop) < 0) loop = loop.slice().reverse();  // <-- Anticlockwise, so a notch turns the same way on every figure

        const turns  = Na__EntBuild__Turns(loop, rules.cornerSpanMm);
        const corner = (rules.cornerDeg * Math.PI) / 180;
        const smooth = Na__EntBuild__Smooth(loop, turns.map((turn) => Math.abs(turn) >= corner), rules.smoothingPasses);

        const outer = [], inner = [];
        const every = rules.penLiftsFactor > 0 ? rules.penLiftEveryMm / rules.penLiftsFactor : 0;
        Na__EntBuild__Stroke(smooth, true, every, rules.penLiftGapMm, Na__EntBuild__Random(seed), outer);
        if (rules.hooksFactor > 0) Na__EntBuild__Hooks(loop, turns, rules, Na__EntBuild__Random((seed ^ Na__EntBuild__HOOK_STREAM) >>> 0), inner);

        return { outer, inner, faces : [{ outer : smooth, holes : [] }], outlines : [smooth] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Line Drawing: Its Own Lines, with Pen Lifts on Its Outline
    // ------------------------------------------------------------
    function Na__EntBuild__LineDrawing(figure, seed, rules) {
        const outer = [], inner = [], outlines = [];
        const every = rules.penLiftsFactor > 0 ? rules.penLiftEveryMm / rules.penLiftsFactor : 0;
        const rng = Na__EntBuild__Random(seed);
        (figure.Figure__OuterChainsMm || []).forEach((text) => {
            const points = Na__EntBuild__ParsePoints(text);
            if (points.length < 2) return;
            const first = points[0], last = points[points.length - 1];
            const closed = points.length > 2 && first[0] === last[0] && first[1] === last[1];
            Na__EntBuild__Stroke(closed ? points.slice(0, -1) : points, closed, every, rules.penLiftGapMm, rng, outer);
            outlines.push(closed ? points.slice(0, -1) : points);
        });
        (figure.Figure__InnerChainsMm || []).forEach((text) => {
            const points = Na__EntBuild__ParsePoints(text);
            if (points.length >= 2) Na__EntBuild__Stroke(points, false, 0, 0, rng, inner);
        });
        const faces = (figure.Figure__FacesMm || []).map((face) => ({
            outer : Na__EntBuild__ParsePoints(face.Face__OuterMm),
            holes : (face.Face__HolesMm || []).map(Na__EntBuild__ParsePoints)
        }));
        return { outer, inner, faces, outlines };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Figure
    // ------------------------------------------------------------
    // recipe: an asset. Returns { outer, inner, faces, outlines }, or null if it cannot be drawn:
    //   outer, inner : flat lists of x1,y1,x2,y2 in metres
    //   faces        : [{ outer : [[x,y] mm...], holes : [[[x,y] mm...]...] }], the fill's loops
    //   outlines     : [[[x,y] mm...]...], unbroken, for a tool's aid and a card's picture
    // ------------------------------------------------------------
    function Na__EntBuild__BuildFigure(recipe, seed, rules) {
        const generator = recipe && recipe.Asset__Generator;
        if (!generator || generator.Generator__Name !== 'FlatFigure' || generator.Generator__Version !== 1) return null;
        const figure = recipe.Asset__Figure;
        if (!figure) return null;
        if (figure.Figure__Kind === 'Silhouette') return Na__EntBuild__Silhouette(figure, seed, rules);
        if (figure.Figure__Kind === 'LineDrawing') return Na__EntBuild__LineDrawing(figure, seed, rules);
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Figure Builder API
    // ------------------------------------------------------------
    export {
        Na__EntBuild__ParsePoints,
        Na__EntBuild__Inside,
        Na__EntBuild__RulesFrom,
        Na__EntBuild__BuildFigure
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
