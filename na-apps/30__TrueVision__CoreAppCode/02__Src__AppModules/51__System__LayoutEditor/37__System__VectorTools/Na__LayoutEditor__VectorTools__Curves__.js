// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - CURVES
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Curves__.js
// NAMESPACE  : Na__LeVecCurve
// MODULE     : Layout Editor - Vector Tools - Curves
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Circles and arcs as runs of paper points: how many edges one needs, where its points go, and reading one back from its points
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A CIRCLE IS A CLOSED VECTOR AND AN ARC IS AN OPEN ONE. Neither is a new
//   kind of record: the Circle and Arc tools write ordinary Shape__Points, as
//   the Rectangle tool does, so everything that already works on a vector -
//   select, move, copy, fill, hatch, dash, the eyedropper, the PDF, the web
//   viewer, a floor area drawn round a bay - works on a curve with nothing to
//   learn. SketchUp draws its circles the same way.
// - WHAT STOPS IT LOOKING FACETED is how many edges it is given. SegmentsFor
//   works that out from the radius ON PAPER, so the flat of every edge stands
//   no further off the true curve than ChordToleranceMm (a hundredth of a
//   millimetre as shipped - a fifth of the finest pen). The painters already
//   round every joint, so at that count the curve prints as a curve. A count
//   typed by hand ("6s", as in SketchUp and LayOut) is used as typed, which is
//   how a hexagon or an octagon is drawn.
// - READING ONE BACK. A record the tools wrote carries a one-word hint,
//   Shape__Curve : { Curve__Kind }, and NOTHING ELSE about the curve - no
//   centre, no radius - because a move, a nudge, a paste or a Ctrl-drag copy
//   changes the points and would leave any stored centre behind. Describe
//   works the centre, the radius, the angles and the count out again FROM THE
//   POINTS, and answers null the moment they no longer lie on one circle at
//   even steps (a vertex has been dragged, a point inserted): the shape is then
//   simply the polyline it always was. The two end steps of an arc may be
//   short, which is what a trim or an extend leaves.
// - Nothing here touches the model, the DOM or the config.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__CircleTool__ and __ArcTool__ build with it;
//   __Offset__ offsets a curve as a curve through Describe; the Vector Tools
//   panel reads a selected curve's radius and count with Describe and writes
//   them back with CirclePoints and ArcPoints.
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
// - Initial implementation: SegmentsFor, CirclePoints, ArcPoints, the arc
//   through three points, the arc from a chord and a bulge, the arc about a
//   centre, and Describe.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Kinds, Limits and Tolerances
    // ------------------------------------------------------------
    const Na__LeVecCurve__KIND_CIRCLE = 'circle';
    const Na__LeVecCurve__KIND_ARC    = 'arc';
    const Na__LeVecCurve__TAU         = Math.PI * 2;
    const Na__LeVecCurve__MIN_RADIUS  = 1e-4;   // <-- Smaller than this (paper mm) is a point, not a circle
    const Na__LeVecCurve__FIT_REL     = 1e-6;   // <-- How far a point may stand off the fitted circle, as a fraction of its radius
    const Na__LeVecCurve__STEP_TOL    = 1e-6;   // <-- How unequal two angle steps may be, in radians
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | How Many Edges
// -----------------------------------------------------------------------------

    // FUNCTION | The Edges a Whole Circle of This Radius Needs
    // ------------------------------------------------------------
    // The flat of an edge stands r * (1 - cos(pi / n)) off the true curve, so
    // n = pi / acos(1 - tolerance / r). Rounded UP to a multiple of four, so
    // the four quadrant points are always real vertices - they are what gets
    // snapped to and dimensioned from - and held between the two limits.
    // ------------------------------------------------------------
    function Na__LeVecCurve__SegmentsFor(radiusMm, toleranceMm, minimum, maximum) {
        const min = Math.max(4, Math.round(Number.isFinite(minimum) ? minimum : 24));
        const max = Math.max(min, Math.round(Number.isFinite(maximum) ? maximum : 360));
        const tol = (Number.isFinite(toleranceMm) && toleranceMm > 0) ? toleranceMm : 0.01;
        let n = min;
        if (Number.isFinite(radiusMm) && radiusMm > tol) n = Math.ceil(Math.PI / Math.acos(1 - (tol / radiusMm)));
        n = Math.max(min, Math.min(max, n));
        return Math.min(max - (max % 4), Math.ceil(n / 4) * 4) || 4;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Edges an Arc Needs: Its Share of the Whole Circle's
    // ------------------------------------------------------------
    function Na__LeVecCurve__ArcSegmentsFor(radiusMm, sweepRad, toleranceMm, minimum, maximum) {
        const whole = Na__LeVecCurve__SegmentsFor(radiusMm, toleranceMm, minimum, maximum);
        return Math.max(2, Math.ceil(whole * (Math.min(Na__LeVecCurve__TAU, Math.abs(sweepRad)) / Na__LeVecCurve__TAU)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Points
// -----------------------------------------------------------------------------

    // FUNCTION | The Points of a Circle (the first one at startRad)
    // ------------------------------------------------------------
    // The first point is put where the radius was picked, so the point that
    // was clicked - usually a snap - is a real vertex of what is drawn.
    // ------------------------------------------------------------
    function Na__LeVecCurve__CirclePoints(cx, cy, radiusMm, segments, startRad) {
        const n  = Math.max(3, Math.round(segments));
        const a0 = Number.isFinite(startRad) ? startRad : 0;
        const out = [];
        for (let i = 0; i < n; i++) {
            const a = a0 + ((Na__LeVecCurve__TAU * i) / n);
            out.push([ cx + (radiusMm * Math.cos(a)), cy + (radiusMm * Math.sin(a)) ]);
        }
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Points of an Arc, From startRad Through sweepRad (either way round)
    // ------------------------------------------------------------
    // ends: optional { from : [x, y], to : [x, y] } - the two points the arc
    // was drawn between. They replace the computed first and last points, so
    // an arc drawn from one snap to another ends EXACTLY on them rather than a
    // rounding error away.
    // ------------------------------------------------------------
    function Na__LeVecCurve__ArcPoints(cx, cy, radiusMm, startRad, sweepRad, segments, ends) {
        const n = Math.max(1, Math.round(segments));
        const out = [];
        for (let i = 0; i <= n; i++) {
            const a = startRad + ((sweepRad * i) / n);
            out.push([ cx + (radiusMm * Math.cos(a)), cy + (radiusMm * Math.sin(a)) ]);
        }
        if (ends && Array.isArray(ends.from)) out[0] = [ ends.from[0], ends.from[1] ];
        if (ends && Array.isArray(ends.to))   out[out.length - 1] = [ ends.to[0], ends.to[1] ];
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Solving an Arc
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Angle Brought Into 0 to 2 pi
    // ------------------------------------------------------------
    function Na__LeVecCurve__Turn(angle) {
        const a = angle % Na__LeVecCurve__TAU;
        return a < 0 ? a + Na__LeVecCurve__TAU : a;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Circle Through Three Points (null when they are in a line)
    // ------------------------------------------------------------
    function Na__LeVecCurve__CircleThrough(a, b, c) {
        const d = 2 * ((a[0] * (b[1] - c[1])) + (b[0] * (c[1] - a[1])) + (c[0] * (a[1] - b[1])));
        const span = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]));
        if (!(span > 0) || Math.abs(d) < 1e-10 * span * span) return null;       // <-- In a line, or as good as: the circle would be vast
        const a2 = (a[0] * a[0]) + (a[1] * a[1]), b2 = (b[0] * b[0]) + (b[1] * b[1]), c2 = (c[0] * c[0]) + (c[1] * c[1]);
        const cx = ((a2 * (b[1] - c[1])) + (b2 * (c[1] - a[1])) + (c2 * (a[1] - b[1]))) / d;
        const cy = ((a2 * (c[0] - b[0])) + (b2 * (a[0] - c[0])) + (c2 * (b[0] - a[0]))) / d;
        return { cx : cx, cy : cy, r : Math.hypot(a[0] - cx, a[1] - cy) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Arc From One Point to Another, Passing Through a Third
    // ------------------------------------------------------------
    // Returns { cx, cy, r, start, sweep } - sweep signed, the way round that
    // passes through the middle point - or null when the three are in a line.
    // ------------------------------------------------------------
    function Na__LeVecCurve__ArcThrough(from, through, to) {
        const circle = Na__LeVecCurve__CircleThrough(from, through, to);
        if (!circle || !(circle.r >= Na__LeVecCurve__MIN_RADIUS)) return null;
        const a0 = Math.atan2(from[1] - circle.cy, from[0] - circle.cx);
        const aM = Math.atan2(through[1] - circle.cy, through[0] - circle.cx);
        const a1 = Math.atan2(to[1] - circle.cy, to[0] - circle.cx);
        const round  = Na__LeVecCurve__Turn(a1 - a0);                            // <-- The way round with the angle rising
        const middle = Na__LeVecCurve__Turn(aM - a0);
        const sweep  = middle <= round ? round : round - Na__LeVecCurve__TAU;
        return { cx : circle.cx, cy : circle.cy, r : circle.r, start : a0, sweep : sweep };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Arc on a Chord, Bulging a Signed Distance Off Its Middle
    // ------------------------------------------------------------
    // SketchUp's and LayOut's 2 Point Arc: the two ends, then how far the arc
    // stands off the chord. bulgeMm is signed - positive to the left of the
    // chord looking from `from` to `to` on the paper (y down). Returns the arc
    // plus { bulge, chord }, or null for no chord or no bulge.
    // ------------------------------------------------------------
    function Na__LeVecCurve__ArcFromBulge(from, to, bulgeMm) {
        const dx = to[0] - from[0], dy = to[1] - from[1];
        const chord = Math.hypot(dx, dy);
        if (!(chord >= Na__LeVecCurve__MIN_RADIUS) || !Number.isFinite(bulgeMm) || Math.abs(bulgeMm) < Na__LeVecCurve__MIN_RADIUS) return null;
        const nx = dy / chord, ny = -dx / chord;                                 // <-- The chord's left-hand normal on a y-down page
        const through = [ ((from[0] + to[0]) / 2) + (nx * bulgeMm), ((from[1] + to[1]) / 2) + (ny * bulgeMm) ];
        const arc = Na__LeVecCurve__ArcThrough(from, through, to);
        return arc ? Object.assign(arc, { bulge : bulgeMm, chord : chord }) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far Off a Chord a Point Stands, Signed as ArcFromBulge Wants It
    // ------------------------------------------------------------
    function Na__LeVecCurve__BulgeOf(from, to, point) {
        const dx = to[0] - from[0], dy = to[1] - from[1];
        const chord = Math.hypot(dx, dy);
        if (!(chord > 0)) return 0;
        return (((point[0] - from[0]) * dy) - ((point[1] - from[1]) * dx)) / chord;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bulge That Gives an Arc on This Chord a Given Radius
    // ------------------------------------------------------------
    // The smaller of the two arcs of that radius - the one that is less than
    // a half circle - on the side `sign` names. Null when the radius is too
    // small to span the chord.
    // ------------------------------------------------------------
    function Na__LeVecCurve__BulgeForRadius(chordMm, radiusMm, sign) {
        if (!(chordMm > 0) || !(radiusMm >= chordMm / 2)) return null;
        const sagitta = radiusMm - Math.sqrt((radiusMm * radiusMm) - ((chordMm * chordMm) / 4));
        return (sign < 0 ? -1 : 1) * sagitta;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Arc About a Centre, From a Start Point Through a Signed Sweep
    // ------------------------------------------------------------
    function Na__LeVecCurve__ArcAbout(centre, from, sweepRad) {
        const r = Math.hypot(from[0] - centre[0], from[1] - centre[1]);
        if (!(r >= Na__LeVecCurve__MIN_RADIUS) || !Number.isFinite(sweepRad) || Math.abs(sweepRad) < 1e-9) return null;
        const sweep = Math.max(-Na__LeVecCurve__TAU, Math.min(Na__LeVecCurve__TAU, sweepRad));
        return { cx : centre[0], cy : centre[1], r : r, start : Math.atan2(from[1] - centre[1], from[0] - centre[0]), sweep : sweep };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sweep Carried On From the Last One, So It Can Pass a Half Turn
    // ------------------------------------------------------------
    // The angle from the start to the cursor only ever reads -pi to pi, so an
    // arc swept past a half circle would flip to the short way round. The new
    // reading is unwound to whichever whole turn puts it nearest the last, as
    // SketchUp's protractor does, and held inside one full turn either way.
    // ------------------------------------------------------------
    function Na__LeVecCurve__CarrySweep(lastSweep, startRad, cursorRad) {
        let sweep = cursorRad - startRad;
        while (sweep > Math.PI)  sweep -= Na__LeVecCurve__TAU;
        while (sweep < -Math.PI) sweep += Na__LeVecCurve__TAU;
        if (Number.isFinite(lastSweep)) {
            while (sweep - lastSweep > Math.PI)  sweep -= Na__LeVecCurve__TAU;
            while (sweep - lastSweep < -Math.PI) sweep += Na__LeVecCurve__TAU;
        }
        return Math.max(-Na__LeVecCurve__TAU, Math.min(Na__LeVecCurve__TAU, sweep));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading a Curve Back From Its Points
// -----------------------------------------------------------------------------

    // FUNCTION | What Curve These Points Are, or Null When They Are Not One
    // ------------------------------------------------------------
    // Returns { kind, cx, cy, r, start, sweep, segments }:
    //   a circle   closed, every point the same distance from the middle of
    //              them, at even steps all the way round
    //   an arc     open, every point on the circle through its first, middle
    //              and last, at even steps - the FIRST AND LAST steps may be
    //              shorter, which is what a trim or an extend leaves
    // segments is the count a whole circle (or this arc) is drawn with.
    // ------------------------------------------------------------
    function Na__LeVecCurve__Describe(points, closed) {
        const pts = Array.isArray(points) ? points : [];
        const n   = pts.length;
        if (closed === true) {
            if (n < 3) return null;
            let sx = 0, sy = 0;
            pts.forEach((p) => { sx += p[0]; sy += p[1]; });
            const cx = sx / n, cy = sy / n;
            const r  = Math.hypot(pts[0][0] - cx, pts[0][1] - cy);
            if (!(r >= Na__LeVecCurve__MIN_RADIUS)) return null;
            const fit = Math.max(1e-9, r * Na__LeVecCurve__FIT_REL);
            if (pts.some((p) => Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - r) > fit)) return null;
            const start = Math.atan2(pts[0][1] - cy, pts[0][0] - cx);
            const first = Math.atan2(pts[1][1] - cy, pts[1][0] - cx) - start;
            const way   = Na__LeVecCurve__Turn(first) <= Math.PI ? 1 : -1;
            const step  = (Na__LeVecCurve__TAU / n) * way;
            for (let i = 1; i < n; i++) {
                const want = start + (step * i);
                const have = Math.atan2(pts[i][1] - cy, pts[i][0] - cx);
                let off = Na__LeVecCurve__Turn(have - want);
                if (off > Math.PI) off -= Na__LeVecCurve__TAU;
                if (Math.abs(off) > Na__LeVecCurve__STEP_TOL * 10) return null;
            }
            return { kind : Na__LeVecCurve__KIND_CIRCLE, cx : cx, cy : cy, r : r, start : start, sweep : Na__LeVecCurve__TAU * way, segments : n };
        }

        if (n < 3) return null;
        // THE CIRCLE IS FITTED TO THE INSIDE POINTS where there are enough of
        // them, because the two END points may not be on it: a trim or an
        // extend lands an end on the FLAT of an edge, which stands inside the
        // true curve by up to that edge's sagitta. The inside points are held
        // to the circle exactly; an end may stand inside it by no more than
        // the sagitta of a full step, and never outside it.
        // ------------------------------------
        const inside = n >= 5;
        const circle = inside ? Na__LeVecCurve__CircleThrough(pts[1], pts[Math.floor(n / 2)], pts[n - 2]) : Na__LeVecCurve__CircleThrough(pts[0], pts[Math.floor(n / 2)], pts[n - 1]);
        if (!circle || !(circle.r >= Na__LeVecCurve__MIN_RADIUS)) return null;
        const fit = Math.max(1e-9, circle.r * Na__LeVecCurve__FIT_REL);
        const offCircle = (p) => Math.hypot(p[0] - circle.cx, p[1] - circle.cy) - circle.r;
        for (let i = inside ? 1 : 0; i < (inside ? n - 1 : n); i++) { if (Math.abs(offCircle(pts[i])) > fit) return null; }
        const arc = Na__LeVecCurve__ArcThrough(pts[0], pts[Math.floor(n / 2)], pts[n - 1]);
        if (!arc) return null;
        arc.cx = circle.cx; arc.cy = circle.cy; arc.r = circle.r;               // <-- The ends give the way round; the inside points give the circle
        arc.start = Math.atan2(pts[0][1] - circle.cy, pts[0][0] - circle.cx);
        const way   = arc.sweep < 0 ? -1 : 1;
        const steps = [];
        for (let i = 1; i < n; i++) {
            const a = Math.atan2(pts[i - 1][1] - arc.cy, pts[i - 1][0] - arc.cx);
            const b = Math.atan2(pts[i][1] - arc.cy, pts[i][0] - arc.cx);
            let step = Na__LeVecCurve__Turn((b - a) * way);
            if (step > Math.PI) return null;                                     // <-- A point out of order: it doubles back
            steps.push(step);
        }
        const inner = steps.length > 2 ? steps.slice(1, -1) : steps;
        const full  = Math.max.apply(null, inner);
        if (!(full > 0)) return null;
        if (inner.some((step) => Math.abs(step - full) > Na__LeVecCurve__STEP_TOL * 10)) return null;
        if (steps[0] > full + (Na__LeVecCurve__STEP_TOL * 10) || steps[steps.length - 1] > full + (Na__LeVecCurve__STEP_TOL * 10)) return null;
        if (inside) {
            const sagitta = arc.r * (1 - Math.cos(full / 2));
            const endOk   = (p) => { const off = offCircle(p); return off <= fit && off >= -(sagitta + fit); };
            if (!endOk(pts[0]) || !endOk(pts[n - 1])) return null;
        }
        const sweep = steps.reduce((sum, step) => sum + step, 0) * way;
        return { kind : Na__LeVecCurve__KIND_ARC, cx : arc.cx, cy : arc.cy, r : arc.r, start : arc.start, sweep : sweep,
                 segments : steps.length, wholeSegments : Math.max(3, Math.round(Na__LeVecCurve__TAU / full)) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Curves API
    // ------------------------------------------------------------
    export {
        Na__LeVecCurve__KIND_CIRCLE,
        Na__LeVecCurve__KIND_ARC,
        Na__LeVecCurve__SegmentsFor,
        Na__LeVecCurve__ArcSegmentsFor,
        Na__LeVecCurve__CirclePoints,
        Na__LeVecCurve__ArcPoints,
        Na__LeVecCurve__CircleThrough,
        Na__LeVecCurve__ArcThrough,
        Na__LeVecCurve__ArcFromBulge,
        Na__LeVecCurve__BulgeOf,
        Na__LeVecCurve__BulgeForRadius,
        Na__LeVecCurve__ArcAbout,
        Na__LeVecCurve__CarrySweep,
        Na__LeVecCurve__Describe
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
