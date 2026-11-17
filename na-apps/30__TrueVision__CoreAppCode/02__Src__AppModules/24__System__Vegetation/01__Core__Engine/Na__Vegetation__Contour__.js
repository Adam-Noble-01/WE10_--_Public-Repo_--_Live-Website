// =============================================================================
// TRUEVISION3D - VEGETATION - CONTOUR DRAWER
// =============================================================================
//
// FILE       : Na__Vegetation__Contour__.js
// NAMESPACE  : Na__VegContour
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a built bush from one camera: the outline a draughtsman would
//              draw round its balls, with T-junctions, hook tails and a few inner
//              arcs, all as clean vector lines in world space
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - WHY THE LINES DEPEND ON THE VIEW. A bush has no edges. What is drawn is where
//   its surface turns away from the eye, and that moves with the camera. So the
//   model holds balls, and the lines are worked out for each view, which is also
//   what keeps the assets light: nothing here is ever saved.
// - WHAT IS DRAWN, for every ball, walking its outline as seen from the eye:
//     HIDDEN   another ball is in front of this point. Not drawn.
//     OUTER    nothing lies beyond this point: it is the bush's outline. Always drawn.
//     INNER    this ball passes in front of another. A real line, but a bush drawn
//              with all of them looks like a bunch of grapes, so nearly all go:
//              only the hook tails and a chosen few arcs stay.
// - T-JUNCTIONS ARE WHAT MAKE IT LOOK DRAWN. Where two balls meet, the one in front
//   carries on, the one behind stops dead against it. Walking the states gives this
//   for free, and each change of state is bisected so the two lines truly touch.
// - THE HOOK TAIL. At a junction the front line may run on past the outline, into
//   the bush, and sometimes curl round: the small hooks all over the hand drawn
//   shrubs (Adam's reference, 04-Nov-2026). Here it is a measured curve at a
//   constant weight, which is what makes it CAD rather than sketch.
// - THE CUSP HOOK. Where two arcs of one chain meet, the line may also overshoot
//   into the bush and curl: same idea as the tail, but from a cusp, and never
//   following the chain's own bumps.
// - NOTHING GOES BELOW THE PLOP'S GROUND. The balls of a foot do, or the base would
//   float. A segment is cut where it meets the ground and its fill flattened there,
//   so a bush stands cleanly on anything, however thin.
// - LINES SAY LESS AS THEY SHRINK. Inner arcs, tails and curls drop out by screen
//   size, each at its own threshold, so a far bush is a clean outline and not a
//   dark smudge, and they go one by one rather than all together as you zoom.
// - WHY A FLAT DISC FOR THE FILL. Each ball's white fill is a polygon in the plane
//   of its outline, square to the eye, rather than a sphere mesh. It covers exactly
//   the same pixels at a tenth of the triangles. A clump's or a nub's disc can never
//   hide a line this module chose to draw: a line is only kept if no such ball's near
//   surface is in front of it, and a ball's centre plane is always behind its near
//   surface. A mass's disc can: masses are not asked (see IsHidden), and about one
//   inner point in twenty lands behind one and is simply not seen. Harmless.
// - A BALL ON A FACE LOOKING AWAY IS NOT WORKED OUT. A clipped form's bush carries facing,
//   the way each ball's face looks, and those turned from the eye are left out: nothing of
//   them could show, and a shell of balls is half of them. Nothing else carries it.
// - A CLIPPED BOX'S CORE. Its bush carries bush.core, twelve triangles of fill behind the whole
//   shell, written as they are: see BushBuilder's header.
// - A CLIPPED FORM'S MARKS. Its bush also carries marks, an arc inside a ball's outline on its
//   near surface, where it is the highest thing there: see BushBuilder's header. They leave one
//   by one with distance as inner arcs do, and the Inner Arcs slider thins them out. A flower
//   head carries one too (v1.3.0).
// - INKED BALLS (v1.3.0). A bush may carry ink, its balls whose outline is drawn whole (a flower
//   head, a lavender whorl). A fourth state, INNER_INK, is an inner line kept whole at the inner
//   weight: the ball's own, or where what the eye sees just past the line is an inked ball, so a
//   leaf crossing in front of a head shows its edge there. An inked ball smaller on screen than
//   INK_MIN_PX, judged by its lodR, drops out, fill and all. A bush without ink takes the old
//   path unchanged, by the engine hash.
//
// FRAMES:
// - World metres, +Y up, in and out. Angles run round each ball from its own right
//   towards its own up, as seen by the eye, so pi/2 is the top of the ball on the page.
//
// INTEGRATION:
// - Fed by Na__Vegetation__BushBuilder__.js. Its buffers are uploaded by the scene
//   layer (Stage 2 brings it in; the prototype holds it until then); the asset cards
//   stroke them on a 2D canvas.
// - Imports nothing from three.js: a worker could run it, and the same lines could
//   feed an SVG, a drawing sheet or a projected linework view.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/01__Core__Engine/Na__Vegetation__Contour__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Nov-2026 - Version 1.3.0 (ValeVision3D v2.99.0, TrueVision3D v2.189.0)
// - Inked balls (see the header): INNER_INK, ClassifyInked, INK_MIN_PX. Only a bush carrying
//   ink takes any of it: every line of the eleven assets before it is unchanged, by the engine
//   hash (39fd60a48826a363a509bfa9158494a0).
//
// 04-Nov-2026 - Version 1.2.0 (ValeVision3D v2.86.0)
// - A bush's facing and marks, for clipped forms, and a stem. Without them every line it draws
//   is unchanged.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.84.0)
// - PageRadiusPx, and the style's minK and bisectSteps, for the frame budget. With
//   those two left out, every line it draws is unchanged.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
// - Moved in from the prototype 85__EarlyStage__VegetationLinework, where the look
//   was agreed. Every line it draws is unchanged.
//
// 04-Nov-2026 - Version 0.1.0
// - Initial build for the isolated aesthetic demo.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Table Sizes from the Builder
    // ------------------------------------------------------------
    import {
        Na__VegBuild__STYLE_N,
        Na__VegBuild__CUSP_U_N,
        Na__VegBuild__TIER_MASS,
        Na__VegBuild__TIER_NUB
    } from './Na__Vegetation__BushBuilder__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Point States and Numerics
    // ------------------------------------------------------------
    const Na__VegContour__TAU          = Math.PI * 2;
    const Na__VegContour__HIDDEN       = 0;
    const Na__VegContour__OUTER        = 1;
    const Na__VegContour__INNER        = 2;
    const Na__VegContour__INNER_INK    = 3;                                    // <-- v1.3.0: an inner line kept whole, as an inked ball's (see the header)
    const Na__VegContour__BISECT_STEPS = 7;                                    // <-- 15 degrees down to a tenth of one: the two lines touch
    const Na__VegContour__EPS_M        = 0.0004;                               // <-- A point on a ball's own surface is not behind it
    const Na__VegContour__MIN_K        = 18;
    const Na__VegContour__MAX_K        = 520;                                  // <-- A mass in a close up: its cusps must land near a sample
    const Na__VegContour__MAX_RUNS     = 64;
    const Na__VegContour__BREAK_RAD    = 0.20;                                 // <-- Width of a pen lift in a line
    const Na__VegContour__FACING_AWAY  = 0.22;                                 // <-- Past this a ball's face looks away. Not 0: a face seen edge on still makes the outline
    const Na__VegContour__MARK_LOD     = 0.60;                                 // <-- Of the inner arcs' size on screen: a mark is drawn smaller, so it stays longer
    const Na__VegContour__MARK_MIN_PX  = 7;                                    // <-- A shorter mark is a speck
    const Na__VegContour__MARK_SPAN    = 1.5;                                  // <-- Times the asset's inner arc: a mark is nearer the middle, so it needs more turn to read
    const Na__VegContour__INK_MIN_PX   = 1.6;                                  // <-- v1.3.0: an inked ball smaller than this on screen drops out, fill and all: a far spike's whorls would be dark beads, or white specks on the ground
    const Na__VegContour__STEM_FOOT    = 0.05;                                 // <-- Of a stem's length: the foot flares this far up
    const Na__VegContour__STEM_FLARE   = 0.5;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | What Each Stored Random Number Decides
    // ------------------------------------------------------------
    const Na__VegContour__U_TAIL_A     = 0;                                    // <-- Has a tail going forwards round the ball
    const Na__VegContour__U_LEN_A      = 1;
    const Na__VegContour__U_CURL_A     = 2;
    const Na__VegContour__U_TAIL_B     = 3;                                    // <-- Has a tail going backwards
    const Na__VegContour__U_LEN_B      = 4;
    const Na__VegContour__U_CURL_B     = 5;
    const Na__VegContour__U_ARC        = 6;                                    // <-- Draws an inner arc
    const Na__VegContour__U_ARC_ANGLE  = 7;
    const Na__VegContour__U_ARC_SPAN   = 8;
    const Na__VegContour__U_ARC_HOOK   = 9;
    const Na__VegContour__U_LOD        = 10;                                   // <-- Its own threshold, so details leave one by one
    const Na__VegContour__U_BREAK      = 11;
    const Na__VegContour__U_BREAK_AT   = 12;
    const Na__VegContour__U_PHASE      = 13;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Bush and the Eye in Hand
    // ------------------------------------------------------------
    // One bush at a time, on one thread: plain module slots keep the walking
    // functions free of a dozen arguments and of per-call allocation. These run
    // several hundred thousand times per view.
    // ------------------------------------------------------------
    let Cx = null, Cy = null, Cz = null, Ra = null, RMax = null, RMin = null, Pol = null, PolStart = null, PolN = null, Sty = null, Tier = null;
    let Ink = null;                                                            // <-- v1.3.0: the bush's inked balls, or null on every plant without one
    let Ex = 0, Ey = 0, Ez = 0, Fx = 0, Fy = 0, Fz = 0, IsOrtho = false;
    let Tx = 0, Ty = 0, Tz = 0;
    let GroundY = 0;

    let Na__VegContour__Capacity = 0;
    let RxA = null, RyA = null, RzA = null;                                    // <-- Each ball's own right on the page
    let UxA = null, UyA = null, UzA = null;                                    // <-- Each ball's own up on the page
    let NxA = null, NyA = null, NzA = null;                                    // <-- Each ball's own line of sight
    let ImgU = null, ImgV = null, ImgR = null, PxR = null, Delta = null;
    let Active = null, NbrStart = null, NbrList = new Int32Array(4096);

    const St        = new Uint8Array(Na__VegContour__MAX_K + 2);
    const BoundA    = new Float64Array(Na__VegContour__MAX_RUNS);
    const BoundFrom = new Uint8Array(Na__VegContour__MAX_RUNS);
    const BoundTo   = new Uint8Array(Na__VegContour__MAX_RUNS);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Output Buffers
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Output Buffers
    // ------------------------------------------------------------
    function Na__VegContour__CreateOut(outerSegs, innerSegs, fillVerts) {
        return {
            outer      : new Float32Array(outerSegs * 6),
            outerCap   : outerSegs,
            outerCount : 0,
            inner      : new Float32Array(innerSegs * 6),
            innerCap   : innerSegs,
            innerCount : 0,
            fill       : new Float32Array(fillVerts * 3),
            fillCap    : fillVerts,
            fillCount  : 0,
            drawnBushes: 0,
            drawnLobes : 0
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Empty the Output Buffers Before a View
    // ------------------------------------------------------------
    function Na__VegContour__ResetOut(out) {
        out.outerCount  = 0;
        out.innerCount  = 0;
        out.fillCount   = 0;
        out.drawnBushes = 0;
        out.drawnLobes  = 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One Line Segment
    // ------------------------------------------------------------
    function Na__VegContour__WriteSegment(out, isInner, x0, y0, z0, x1, y1, z1) {
        // CUT AT THE GROUND | Wholly under it, nothing; part under it, only what stands above
        if (y0 < GroundY && y1 < GroundY) return;
        if (y0 < GroundY) {
            const t = (GroundY - y0) / (y1 - y0);
            x0 += (x1 - x0) * t; z0 += (z1 - z0) * t; y0 = GroundY;
        } else if (y1 < GroundY) {
            const t = (GroundY - y1) / (y0 - y1);
            x1 += (x0 - x1) * t; z1 += (z0 - z1) * t; y1 = GroundY;
        }
        if (isInner) {
            if (out.innerCount >= out.innerCap) return;
            const b = out.innerCount * 6, s = out.inner;
            s[b] = x0; s[b + 1] = y0; s[b + 2] = z0; s[b + 3] = x1; s[b + 4] = y1; s[b + 5] = z1;
            out.innerCount++;
        } else {
            if (out.outerCount >= out.outerCap) return;
            const b = out.outerCount * 6, s = out.outer;
            s[b] = x0; s[b + 1] = y0; s[b + 2] = z0; s[b + 3] = x1; s[b + 4] = y1; s[b + 5] = z1;
            out.outerCount++;
        }
    }
    function Na__VegContour__WriteOuter(out, x0, y0, z0, x1, y1, z1) {
        Na__VegContour__WriteSegment(out, false, x0, y0, z0, x1, y1, z1);
    }
    function Na__VegContour__WriteInner(out, x0, y0, z0, x1, y1, z1) {
        Na__VegContour__WriteSegment(out, true, x0, y0, z0, x1, y1, z1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One Fill Triangle
    // ------------------------------------------------------------
    function Na__VegContour__WriteTri(out, ax, ay, az, bx, by, bz, cx, cy, cz) {
        if (out.fillCount + 3 > out.fillCap) return;
        const b = out.fillCount * 3, s = out.fill;
        s[b] = ax;     s[b + 1] = ay < GroundY ? GroundY : ay; s[b + 2] = az;  // <-- Flattened at the ground: three points move, no triangle is added
        s[b + 3] = bx; s[b + 4] = by < GroundY ? GroundY : by; s[b + 5] = bz;
        s[b + 6] = cx; s[b + 7] = cy < GroundY ? GroundY : cy; s[b + 8] = cz;
        out.fillCount += 3;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Walking Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Radius Factor of a Ball at an Angle on the Page
    // ------------------------------------------------------------
    function Na__VegContour__PolarAt(i, angle) {
        const N = PolN[i];
        let t = (angle / Na__VegContour__TAU) * N;
        t -= Math.floor(t / N) * N;
        const k = t | 0, f = t - k, base = PolStart[i];
        const k1 = (k + 1 === N) ? 0 : k + 1;
        return Pol[base + k] * (1 - f) + Pol[base + k1] * f;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Eye's Ray Inside a Ball's Outline at This Offset?
    // ------------------------------------------------------------
    // wx, wy, wz run from the ball's centre to the ray's nearest point to it. The
    // inner and outer radii settle almost every test before an atan2 is needed.
    // ------------------------------------------------------------
    function Na__VegContour__InsideOutline(j, d2, wx, wy, wz) {
        const rMax = RMax[j];
        if (d2 >= rMax * rMax) return false;
        const rMin = RMin[j];
        if (d2 <= rMin * rMin) return true;
        const x = wx * RxA[j] + wy * RyA[j] + wz * RzA[j];
        const y = wx * UxA[j] + wy * UyA[j] + wz * UzA[j];
        const rr = Ra[j] * Na__VegContour__PolarAt(j, Math.atan2(y, x));
        return d2 < rr * rr;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is Any Other Ball's Near Surface in Front of This Point?
    // ------------------------------------------------------------
    function Na__VegContour__IsHidden(i, px, py, pz) {
        let vx = Fx, vy = Fy, vz = Fz;
        if (!IsOrtho) {
            vx = px - Ex; vy = py - Ey; vz = pz - Ez;
            const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
            vx /= len; vy /= len; vz /= len;
        }
        const onMass = Tier[i] !== Na__VegBuild__TIER_MASS;
        for (let n = NbrStart[i], end = NbrStart[i + 1]; n < end; n++) {
            const j   = NbrList[n];

            // A MASS NEVER HIDES WHAT GROWS ON IT | A narrow bed pulls the clumps in while a
            // mass keeps its radius, which buried the whole face of the bush inside it: every
            // inner line was hidden and only the outline was left
            if (onMass && Tier[j] === Na__VegBuild__TIER_MASS) continue;

            const ox  = Cx[j] - px, oy = Cy[j] - py, oz = Cz[j] - pz;
            const tca = ox * vx + oy * vy + oz * vz;                           // <-- Along the ray; zero at the point, negative towards the eye
            const oo  = ox * ox + oy * oy + oz * oz;
            const d2  = oo - tca * tca;
            if (!Na__VegContour__InsideOutline(j, d2, vx * tca - ox, vy * tca - oy, vz * tca - oz)) continue;
            const rr  = Ra[j];
            const thc = (d2 < rr * rr) ? Math.sqrt(rr * rr - d2) : 0;
            if (tca - thc < -Na__VegContour__EPS_M) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The State of One Point on a Ball's Outline
    // ------------------------------------------------------------
    function Na__VegContour__Classify(i, angle) {
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const dx = ca * RxA[i] + sa * UxA[i];
        const dy = ca * RyA[i] + sa * UyA[i];
        const dz = ca * RzA[i] + sa * UzA[i];
        const rho = Ra[i] * Na__VegContour__PolarAt(i, angle);
        const px = Cx[i] + dx * rho, py = Cy[i] + dy * rho, pz = Cz[i] + dz * rho;

        if (Na__VegContour__IsHidden(i, px, py, pz)) return Na__VegContour__HIDDEN;

        // A STEP BEYOND THE LINE | If another ball is there, this is an inner line
        const rhoOut = rho + Delta[i];
        const qx = Cx[i] + dx * rhoOut, qy = Cy[i] + dy * rhoOut, qz = Cz[i] + dz * rhoOut;
        let vx = Fx, vy = Fy, vz = Fz;
        if (!IsOrtho) {
            vx = qx - Ex; vy = qy - Ey; vz = qz - Ez;
            const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
            vx /= len; vy /= len; vz /= len;
        }
        if (Ink !== null) return Na__VegContour__ClassifyInked(i, qx, qy, qz, vx, vy, vz);
        for (let n = NbrStart[i], end = NbrStart[i + 1]; n < end; n++) {
            const j   = NbrList[n];
            const ox  = Cx[j] - qx, oy = Cy[j] - qy, oz = Cz[j] - qz;
            const tca = ox * vx + oy * vy + oz * vz;
            const oo  = ox * ox + oy * oy + oz * oz;
            const d2  = oo - tca * tca;
            if (Na__VegContour__InsideOutline(j, d2, vx * tca - ox, vy * tca - oy, vz * tca - oz)) {
                return Na__VegContour__INNER;
            }
        }
        return Na__VegContour__OUTER;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Beyond a Point, on a Bush with Inked Balls (v1.3.0)
    // ------------------------------------------------------------
    // An inner line is kept whole when its own ball is inked, or when what the eye sees just past
    // it is an inked ball: the nearest surface along the ray, not merely any ball behind. So a
    // flower head shows its whole round over the leaves, and a leaf crossing in front of a head
    // shows its edge there. Anything else is a plain inner line, thinned as always.
    // ------------------------------------------------------------
    function Na__VegContour__ClassifyInked(i, qx, qy, qz, vx, vy, vz) {
        let found = false, nearest = Infinity, nearestInked = false;
        for (let n = NbrStart[i], end = NbrStart[i + 1]; n < end; n++) {
            const j   = NbrList[n];
            const ox  = Cx[j] - qx, oy = Cy[j] - qy, oz = Cz[j] - qz;
            const tca = ox * vx + oy * vy + oz * vz;
            const oo  = ox * ox + oy * oy + oz * oz;
            const d2  = oo - tca * tca;
            if (!Na__VegContour__InsideOutline(j, d2, vx * tca - ox, vy * tca - oy, vz * tca - oz)) continue;
            if (Ink[i] === 1) return Na__VegContour__INNER_INK;
            found = true;
            const rr  = Ra[j];
            const at  = tca - ((d2 < rr * rr) ? Math.sqrt(rr * rr - d2) : 0);  // <-- Where the ray meets its near surface
            if (at < nearest) {
                nearest      = at;
                nearestInked = Ink[j] === 1;
            }
        }
        if (!found) return Na__VegContour__OUTER;
        return nearestInked ? Na__VegContour__INNER_INK : Na__VegContour__INNER;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point on a Ball, Shrunk Inwards from Its Outline (into Tx, Ty, Tz)
    // ------------------------------------------------------------
    // Off the outline the point must lie on the ball's near surface, or its own
    // fill and every ball near it would hide it.
    // ------------------------------------------------------------
    function Na__VegContour__Point(i, angle, shrink) {
        const ca  = Math.cos(angle), sa = Math.sin(angle);
        const rr  = Ra[i];
        const rho = rr * Na__VegContour__PolarAt(i, angle) * (1 - shrink);
        Tx = Cx[i] + (ca * RxA[i] + sa * UxA[i]) * rho;
        Ty = Cy[i] + (ca * RyA[i] + sa * UyA[i]) * rho;
        Tz = Cz[i] + (ca * RzA[i] + sa * UzA[i]) * rho;
        if (shrink > 0 && rho < rr) {
            const lift = Math.sqrt(rr * rr - rho * rho);
            Tx -= NxA[i] * lift;
            Ty -= NyA[i] * lift;
            Tz -= NzA[i] * lift;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stroke a Plain Arc of a Ball's Outline
    // ------------------------------------------------------------
    function Na__VegContour__EmitArc(out, i, a0, a1, stepRad, toInner) {
        const span = a1 - a0;
        if (span <= 0) return;
        const steps = Math.max(1, Math.ceil(span / stepRad));
        Na__VegContour__Point(i, a0, 0);
        let px = Tx, py = Ty, pz = Tz;
        for (let s = 1; s <= steps; s++) {
            Na__VegContour__Point(i, a0 + (span * s) / steps, 0);
            if (toInner) Na__VegContour__WriteInner(out, px, py, pz, Tx, Ty, Tz);
            else         Na__VegContour__WriteOuter(out, px, py, pz, Tx, Ty, Tz);
            px = Tx; py = Ty; pz = Tz;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stroke a Hook Tail from a Junction into the Bush
    // ------------------------------------------------------------
    function Na__VegContour__EmitTail(out, i, a0, direction, length, curl, stepRad, toInner) {
        const steps = Math.max(3, Math.ceil(length / stepRad));
        Na__VegContour__Point(i, a0, 0);
        let px = Tx, py = Ty, pz = Tz;
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const a = a0 + direction * length * t;
            Na__VegContour__Point(i, a, curl > 0 ? curl * Math.pow(t, 2.1) : 0);
            if (Na__VegContour__IsHidden(i, Tx, Ty, Tz)) return;               // <-- Runs under a nearer ball: stops there, as a pen would
            if (toInner) Na__VegContour__WriteInner(out, px, py, pz, Tx, Ty, Tz);
            else         Na__VegContour__WriteOuter(out, px, py, pz, Tx, Ty, Tz);
            px = Tx; py = Ty; pz = Tz;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stroke a Hook or a Spur from a Cusp
    // ------------------------------------------------------------
    // Walked as a pen would be, on the page, by a heading that keeps turning: a true
    // curl at one weight, where following the ball's own radius only ever gave a
    // straight tick.
    //   HOOK  An arc reaches its cusp already heading in, so the stroke carries on in
    //         and turns back under the arc it came from: the pen overshooting the
    //         corner, in the same sense of turn as the arc itself.
    //   SPUR  Rarer and shorter: it leaves the outline instead, a leaf tip on the edge.
    // Heading is measured from the way round the ball, towards the side it curls to.
    // ------------------------------------------------------------
    function Na__VegContour__EmitCuspHook(out, i, a0, direction, lengthM, turnRad, isSpur, stepPx, scale) {
        const rr   = Ra[i];
        const rho0 = rr * Na__VegContour__PolarAt(i, a0);
        const ca   = Math.cos(a0), sa = Math.sin(a0);
        const tx   = -sa * direction, ty = ca * direction;                     // <-- Along the outline, the way the pen came
        const nx   = isSpur ? ca : -ca, ny = isSpur ? sa : -sa;                // <-- Out of the bush for a spur, into it for a hook
        const start = isSpur ? 0.55 : 1.15;

        const steps = Math.min(28, Math.max(5, Math.ceil((lengthM * scale) / (stepPx * 0.6))));
        const ds    = lengthM / steps;
        let x = ca * rho0, y = sa * rho0;

        let px = Cx[i] + x * RxA[i] + y * UxA[i];
        let py = Cy[i] + x * RyA[i] + y * UyA[i];
        let pz = Cz[i] + x * RzA[i] + y * UzA[i];

        for (let s = 1; s <= steps; s++) {
            const t   = s / steps;
            const phi = start + turnRad * t * t;
            const cp  = Math.cos(phi), sp = Math.sin(phi);
            x += (cp * tx + sp * nx) * ds;
            y += (cp * ty + sp * ny) * ds;

            let wx = Cx[i] + x * RxA[i] + y * UxA[i];
            let wy = Cy[i] + x * RyA[i] + y * UyA[i];
            let wz = Cz[i] + x * RzA[i] + y * UzA[i];

            // INSIDE THE BALL | On its near surface, or its own fill and its neighbours would hide it
            const rho2 = x * x + y * y;
            if (rho2 < rr * rr) {
                const lift = Math.sqrt(rr * rr - rho2);
                wx -= NxA[i] * lift; wy -= NyA[i] * lift; wz -= NzA[i] * lift;
            }
            if (Na__VegContour__IsHidden(i, wx, wy, wz)) return;
            Na__VegContour__WriteOuter(out, px, py, pz, wx, wy, wz);
            px = wx; py = wy; pz = wz;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing One Bush
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Set Up Every Ball's Frame, Screen Size and Neighbours
    // ------------------------------------------------------------
    function Na__VegContour__SetUpBalls(bush, view, style) {
        const n = bush.count;
        if (n + 1 > Na__VegContour__Capacity) {
            const c = Math.max(n + 1, Na__VegContour__Capacity * 2, 256);
            RxA = new Float64Array(c); RyA = new Float64Array(c); RzA = new Float64Array(c);
            UxA = new Float64Array(c); UyA = new Float64Array(c); UzA = new Float64Array(c);
            NxA = new Float64Array(c); NyA = new Float64Array(c); NzA = new Float64Array(c);
            ImgU = new Float64Array(c); ImgV = new Float64Array(c); ImgR = new Float64Array(c);
            PxR = new Float64Array(c); Delta = new Float64Array(c);
            Active = new Uint8Array(c); NbrStart = new Int32Array(c + 1);
            Na__VegContour__Capacity = c;
        }

        const camUx = view.upX, camUy = view.upY, camUz = view.upZ;
        const camRx = view.rightX, camRy = view.rightY, camRz = view.rightZ;
        const facing = bush.facing;

        for (let i = 0; i < n; i++) {
            const vx = Cx[i] - Ex, vy = Cy[i] - Ey, vz = Cz[i] - Ez;
            const depth = Math.max(vx * Fx + vy * Fy + vz * Fz, 0.01);

            let nx = Fx, ny = Fy, nz = Fz;
            if (!IsOrtho) {
                const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
                nx = vx / len; ny = vy / len; nz = vz / len;
            }
            NxA[i] = nx; NyA[i] = ny; NzA[i] = nz;

            // THE BALL'S OWN FRAME | Square to its own line of sight, so its outline is true off axis
            let rx = ny * camUz - nz * camUy, ry = nz * camUx - nx * camUz, rz = nx * camUy - ny * camUx;
            const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
            rx /= rl; ry /= rl; rz /= rl;
            RxA[i] = rx; RyA[i] = ry; RzA[i] = rz;
            UxA[i] = ry * nz - rz * ny;
            UyA[i] = rz * nx - rx * nz;
            UzA[i] = rx * ny - ry * nx;

            const scale = IsOrtho ? view.focalPx : view.focalPx / depth;       // <-- Pixels per metre at this ball
            const page  = IsOrtho ? 1 : 1 / depth;
            ImgU[i]  = (vx * camRx + vy * camRy + vz * camRz) * page;
            ImgV[i]  = (vx * camUx + vy * camUy + vz * camUz) * page;
            ImgR[i]  = RMax[i] * page;
            PxR[i]   = Ra[i] * scale;
            Delta[i] = Math.max(0.9 / scale, Ra[i] * 0.012);                   // <-- About a pixel beyond the line

            Active[i] = (bush.tier[i] === Na__VegBuild__TIER_MASS || PxR[i] >= style.lodSkipPx) ? 1 : 0;
            if (facing && (facing[i * 3] * nx + facing[i * 3 + 1] * ny + facing[i * 3 + 2] * nz) > Na__VegContour__FACING_AWAY) Active[i] = 0;
            if (Ink !== null && Ink[i] === 1 && bush.inkLodR[i] * scale < Na__VegContour__INK_MIN_PX) Active[i] = 0;   // <-- v1.3.0: see INK_MIN_PX
        }

        // NEIGHBOURS | Only balls whose outlines can touch on the page: an eighth of the work
        let cursor = 0;
        for (let i = 0; i < n; i++) {
            NbrStart[i] = cursor;
            if (!Active[i]) continue;
            const ui = ImgU[i], vi = ImgV[i], ri = ImgR[i] * 1.04;
            for (let j = 0; j < n; j++) {
                if (j === i || !Active[j]) continue;
                const du = ui - ImgU[j], dv = vi - ImgV[j], rs = ri + ImgR[j];
                if (du * du + dv * dv < rs * rs) {
                    if (cursor >= NbrList.length) {
                        const grown = new Int32Array(NbrList.length * 2);
                        grown.set(NbrList);
                        NbrList = grown;
                    }
                    NbrList[cursor++] = j;
                }
            }
        }
        NbrStart[n] = cursor;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Draw One Ball's Fill and Lines
    // ------------------------------------------------------------
    function Na__VegContour__DrawBall(bush, i, style, out) {
        const u      = i * Na__VegBuild__STYLE_N;
        const pxR    = PxR[i];
        const line   = bush.line;
        const lodRoll = 1 + Sty[u + Na__VegContour__U_LOD];
        const stepPx = style.segmentPx;

        const k = Math.min(Na__VegContour__MAX_K, Math.max(style.minK || Na__VegContour__MIN_K,
            Math.round((Na__VegContour__TAU * pxR) / stepPx)));
        const stepRad = Na__VegContour__TAU / k;
        const phase   = Sty[u + Na__VegContour__U_PHASE] * stepRad;

        // FILL | A fan at the ball's own centre plane
        const ringK = Math.min(40, Math.max(12, k >> 1));
        let fx0 = 0, fy0 = 0, fz0 = 0;
        for (let s = 0; s <= ringK; s++) {
            Na__VegContour__Point(i, phase + (Na__VegContour__TAU * s) / ringK, 0);
            if (s > 0) Na__VegContour__WriteTri(out, Cx[i], Cy[i], Cz[i], fx0, fy0, fz0, Tx, Ty, Tz);
            fx0 = Tx; fy0 = Ty; fz0 = Tz;
        }

        // A VERY SMALL BALL ONLY FILLS | Its lines would be a dot
        if (pxR < 1.1) return;

        // WALK THE OUTLINE
        for (let s = 0; s < k; s++) St[s] = Na__VegContour__Classify(i, phase + stepRad * s);

        let m = 0;
        for (let s = 0; s < k; s++) {
            const s0 = St[s], s1 = St[s + 1 === k ? 0 : s + 1];
            if (s0 === s1 || m >= Na__VegContour__MAX_RUNS) continue;
            let lo = phase + stepRad * s, hi = lo + stepRad;
            const bisectSteps = style.bisectSteps || Na__VegContour__BISECT_STEPS;
            for (let b = 0; b < bisectSteps; b++) {
                const mid = (lo + hi) * 0.5;
                if (Na__VegContour__Classify(i, mid) === s0) lo = mid; else hi = mid;
            }
            BoundA[m]    = (lo + hi) * 0.5;
            BoundFrom[m] = s0;
            BoundTo[m]   = s1;
            m++;
        }

        const isMass = bush.tier[i] === Na__VegBuild__TIER_MASS;
        const isNub  = bush.tier[i] === Na__VegBuild__TIER_NUB;

        // WHAT THIS BALL IS ALLOWED, from its own numbers and its size on screen
        const allowTail  = pxR >= style.lodTailPx * lodRoll;
        const allowCurl  = pxR >= style.lodCurlPx * lodRoll;
        const allowArc   = pxR >= style.lodInteriorPx * lodRoll && !isMass;
        const hasArc     = allowArc && Sty[u + Na__VegContour__U_ARC] < line.Line__InteriorChance * style.interiorFactor * (isNub ? 0.6 : 1);
        const tailChance = line.Line__TailChance * style.tailFactor;
        const curlChance = line.Line__CurlChance * style.curlFactor;
        const tailLen    = (uLen) => line.Line__TailMinRad + (line.Line__TailMaxRad - line.Line__TailMinRad) * uLen;

        // THE CUSP HOOKS | Only on what is truly the bush's outline, and never on a nub
        if (allowTail && !isNub) {
            const scale  = pxR / Ra[i];
            const chance = line.Line__CuspHookChance * style.tailFactor;
            for (let c = bush.cuspFrom[i], end = bush.cuspFrom[i + 1]; c < end; c++) {
                const cu = c * Na__VegBuild__CUSP_U_N;
                if (bush.cuspU[cu] >= chance) continue;
                const angle = bush.cuspA[c];
                if (Na__VegContour__Classify(i, angle) !== Na__VegContour__OUTER) continue;
                const isSpur  = bush.cuspU[cu + 3] < line.Line__SpurShare;
                const lengthM = (line.Line__CuspHookMinMm / 1000
                    + ((line.Line__CuspHookMaxMm - line.Line__CuspHookMinMm) / 1000) * bush.cuspU[cu + 1]) * (isSpur ? 0.55 : 1);
                if (lengthM * scale < 4) continue;                             // <-- Under four pixels it would only thicken the cusp

                // HOW FAR IT TURNS | From a gentle bend to a full curl, by its own number and the Curls slider
                const curlU = bush.cuspU[cu + 2];
                const turn  = allowCurl
                    ? (0.5 + 3.3 * curlU * curlU) * Math.min(1.5, style.curlFactor)
                    : 0.4;
                Na__VegContour__EmitCuspHook(out, i, angle, (c & 1) ? -1 : 1, lengthM, turn, isSpur, stepPx, scale);
            }
        }

        // A CLIPPED FORM'S MARK | On the ball's own surface, so it needs nothing of the walk above
        if (bush.marks && bush.marks[i] > 0
            && pxR >= style.lodInteriorPx * Na__VegContour__MARK_LOD * lodRoll
            && Sty[u + Na__VegContour__U_ARC] < style.interiorFactor) {
            Na__VegContour__DrawMark(out, bush, i, u, stepRad);
        }

        // THE WHOLE OUTLINE IS ONE STATE
        if (m === 0) {
            if (St[0] === Na__VegContour__OUTER) {
                Na__VegContour__EmitArc(out, i, phase, phase + Na__VegContour__TAU, stepRad, false);
            } else if (St[0] === Na__VegContour__INNER && hasArc) {
                Na__VegContour__DrawInnerArc(out, bush, i, u, phase, phase + Na__VegContour__TAU, stepRad, allowCurl);
            } else if (St[0] === Na__VegContour__INNER_INK) {
                Na__VegContour__EmitArc(out, i, phase, phase + Na__VegContour__TAU, stepRad, true);
            }
            return;
        }

        for (let b = 0; b < m; b++) {
            const a0    = BoundA[b];
            let   a1    = BoundA[b + 1 === m ? 0 : b + 1];
            if (a1 <= a0) a1 += Na__VegContour__TAU;
            const state = BoundTo[b];

            if (state === Na__VegContour__OUTER) {
                // THE OUTLINE | With now and then a pen lift
                const breaks = pxR >= style.lodTailPx * 2.5
                    && Sty[u + Na__VegContour__U_BREAK] < line.Line__BreakChance * style.breakFactor;
                if (breaks) {
                    let at = Sty[u + Na__VegContour__U_BREAK_AT] * Na__VegContour__TAU;
                    at += Math.ceil((a0 - at) / Na__VegContour__TAU) * Na__VegContour__TAU;
                    if (at - Na__VegContour__BREAK_RAD > a0 && at + Na__VegContour__BREAK_RAD < a1) {
                        Na__VegContour__EmitArc(out, i, a0, at - Na__VegContour__BREAK_RAD, stepRad, false);
                        Na__VegContour__EmitArc(out, i, at + Na__VegContour__BREAK_RAD, a1, stepRad, false);
                    } else {
                        Na__VegContour__EmitArc(out, i, a0, a1, stepRad, false);
                    }
                } else {
                    Na__VegContour__EmitArc(out, i, a0, a1, stepRad, false);
                }

                // THE TAILS | Only where this ball goes on in front of another
                if (allowTail && !isMass) {
                    if (BoundFrom[b] === Na__VegContour__INNER && Sty[u + Na__VegContour__U_TAIL_B] < tailChance) {
                        const prev = BoundA[(b + m - 1) % m];
                        let room = a0 - prev;
                        if (room <= 0) room += Na__VegContour__TAU;
                        const curl = (allowCurl && Sty[u + Na__VegContour__U_CURL_B] < curlChance) ? line.Line__CurlAmount : 0;
                        const len  = Math.min(tailLen(Sty[u + Na__VegContour__U_LEN_B]) * (curl > 0 ? 1.5 : 1), room);
                        Na__VegContour__EmitTail(out, i, a0, -1, len, curl, stepRad, false);
                    }
                    const nextState = BoundTo[b + 1 === m ? 0 : b + 1];
                    if (nextState === Na__VegContour__INNER && Sty[u + Na__VegContour__U_TAIL_A] < tailChance) {
                        let next = BoundA[(b + 2) % m];
                        if (next <= a1) next += Na__VegContour__TAU;
                        const room = next - a1;
                        const curl = (allowCurl && Sty[u + Na__VegContour__U_CURL_A] < curlChance) ? line.Line__CurlAmount : 0;
                        const len  = Math.min(tailLen(Sty[u + Na__VegContour__U_LEN_A]) * (curl > 0 ? 1.5 : 1), room);
                        Na__VegContour__EmitTail(out, i, a1, 1, len, curl, stepRad, false);
                    }
                }
            } else if (state === Na__VegContour__INNER && hasArc) {
                Na__VegContour__DrawInnerArc(out, bush, i, u, a0, a1, stepRad, allowCurl);
            } else if (state === Na__VegContour__INNER_INK) {
                Na__VegContour__EmitArc(out, i, a0, a1, stepRad, true);        // <-- Kept whole, at the inner weight
            }
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Draw the Few Inner Arcs That Are Kept
    // ------------------------------------------------------------
    // Near the top of its ball, where a hand would draw the upper edge of a clump
    // of leaves and leave the rest to the eye.
    // ------------------------------------------------------------
    function Na__VegContour__DrawInnerArc(out, bush, i, u, a0, a1, stepRad, allowCurl) {
        const line  = bush.line;
        const isNub = bush.tier[i] === Na__VegBuild__TIER_NUB;

        // A NUB DRAWS A SMALL OPEN LOOP OR NOTHING | A short arc on a small ball is a
        // speck of dust on the page; three quarters of a circle is a curled leaf
        if (isNub && PxR[i] < 11) return;
        const span = isNub
            ? 3.4 + 1.6 * Sty[u + Na__VegContour__U_ARC_SPAN]
            : (line.Line__InteriorSpanDeg * Math.PI / 180) * (0.55 + 0.75 * Sty[u + Na__VegContour__U_ARC_SPAN]);
        // SLIDE TO WHAT IS SHOWING | A ball's top is usually under its neighbour, and an
        // arc pinned there would mostly never be drawn (measured: under three a bush for
        // every eight asked for). It prefers the top, and moves along the part it can see.
        const length = a1 - a0;
        const use    = Math.min(span, length * 0.92);
        if (use < 0.30 || use * PxR[i] < 11) return;                           // <-- A short nick says nothing: it reads as a speck on the page

        let centre = Math.PI * 0.5 + (Sty[u + Na__VegContour__U_ARC_ANGLE] - 0.5) * 2.4;  // <-- Top of the ball, give or take 70 degrees
        centre += Math.round(((a0 + a1) * 0.5 - centre) / Na__VegContour__TAU) * Na__VegContour__TAU;
        centre = Math.min(a1 - use * 0.5, Math.max(a0 + use * 0.5, centre));

        const start = centre - use * 0.5;
        const end   = centre + use * 0.5;

        Na__VegContour__EmitArc(out, i, start, end, stepRad, true);

        // A HOOKED END | One in three, always continuing the arc's own direction
        const hook = Sty[u + Na__VegContour__U_ARC_HOOK];
        if (allowCurl && hook < 0.34 && end + 0.08 < a1) {
            Na__VegContour__EmitTail(out, i, end, 1, Math.min(0.75, a1 - end), line.Line__CurlAmount, stepRad, true);
        } else if (allowCurl && hook > 0.72 && start - 0.08 > a0) {
            Na__VegContour__EmitTail(out, i, start, -1, Math.min(0.75, start - a0), line.Line__CurlAmount, stepRad, true);
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Draw the Mark on a Clipped Form's Ball
    // ------------------------------------------------------------
    // Point lifts a point inside the outline onto the ball's near surface. A stretch under a
    // neighbour's dome is left out, so the pen lifts there and carries on.
    // ------------------------------------------------------------
    function Na__VegContour__DrawMark(out, bush, i, u, stepRad) {
        const shrink = bush.marks[i];
        const use    = (bush.line.Line__InteriorSpanDeg * Math.PI / 180) * (0.55 + 0.75 * Sty[u + Na__VegContour__U_ARC_SPAN]) * Na__VegContour__MARK_SPAN;
        if (use * (1 - shrink) * PxR[i] < Na__VegContour__MARK_MIN_PX) return;

        const centre = Math.PI * 0.5 + (Sty[u + Na__VegContour__U_ARC_ANGLE] - 0.5) * 2.4;
        const steps  = Math.max(3, Math.ceil(use / stepRad));
        let down = false, px = 0, py = 0, pz = 0;
        for (let s = 0; s <= steps; s++) {
            Na__VegContour__Point(i, centre - use * 0.5 + (use * s) / steps, shrink);
            if (Na__VegContour__IsHidden(i, Tx, Ty, Tz)) {
                down = false;
                continue;
            }
            if (down) Na__VegContour__WriteInner(out, px, py, pz, Tx, Ty, Tz);
            px = Tx; py = Ty; pz = Tz;
            down = true;
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Draw One Strap Leaf
    // ------------------------------------------------------------
    // A true 3D centre line with its width turned square to the eye: narrow at the
    // foot, widest a fifth of the way up, closing to a point. A stem instead keeps one
    // width, a little wider at the foot, and is open at the top, up inside its head.
    // ------------------------------------------------------------
    function Na__VegContour__DrawBlade(blade, view, style, out) {
        const p = blade.p;
        const midX = p[6] - Ex, midY = p[7] - Ey, midZ = p[8] - Ez;
        const depth = Math.max(midX * Fx + midY * Fy + midZ * Fz, 0.01);
        const scale = IsOrtho ? view.focalPx : view.focalPx / depth;
        const tall  = Math.abs(p[10] - p[1]) * scale;
        if (tall < style.lodBladePx) return;

        const steps = Math.min(18, Math.max(6, Math.ceil(tall / 7)));
        const halfW = blade.w * 0.5;
        const single = (halfW * scale) < 2.2;                                  // <-- Two lines this close only read as one dark one

        let lx0 = 0, ly0 = 0, lz0 = 0, rx0 = 0, ry0 = 0, rz0 = 0;
        for (let s = 0; s <= steps; s++) {
            const t  = s / steps, m = 1 - t;
            const c0 = m * m * m, c1 = 3 * m * m * t, c2 = 3 * m * t * t, c3 = t * t * t;
            const x  = c0 * p[0] + c1 * p[3] + c2 * p[6] + c3 * p[9];
            const y  = c0 * p[1] + c1 * p[4] + c2 * p[7] + c3 * p[10];
            const z  = c0 * p[2] + c1 * p[5] + c2 * p[8] + c3 * p[11];
            const d0 = m * m, d1 = 2 * m * t, d2 = t * t;
            const tx = d0 * (p[3] - p[0]) + d1 * (p[6] - p[3]) + d2 * (p[9] - p[6]);
            const ty = d0 * (p[4] - p[1]) + d1 * (p[7] - p[4]) + d2 * (p[10] - p[7]);
            const tz = d0 * (p[5] - p[2]) + d1 * (p[8] - p[5]) + d2 * (p[11] - p[8]);

            let vx = Fx, vy = Fy, vz = Fz;
            if (!IsOrtho) { vx = x - Ex; vy = y - Ey; vz = z - Ez; }
            let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
            const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
            sx /= sl; sy /= sl; sz /= sl;

            const w = blade.stem
                ? halfW * (t < Na__VegContour__STEM_FOOT ? 1 + Na__VegContour__STEM_FLARE * (1 - t / Na__VegContour__STEM_FOOT) : 1)
                : halfW * (t < 0.22 ? 0.45 + 0.55 * (t / 0.22) : Math.pow((1 - t) / 0.78, 0.85));
            const lx = x + sx * w, ly = y + sy * w, lz = z + sz * w;
            const rx = x - sx * w, ry = y - sy * w, rz = z - sz * w;

            if (s > 0) {
                if (single) {
                    Na__VegContour__WriteInner(out, (lx0 + rx0) * 0.5, (ly0 + ry0) * 0.5, (lz0 + rz0) * 0.5, x, y, z);
                } else {
                    Na__VegContour__WriteOuter(out, lx0, ly0, lz0, lx, ly, lz);
                    Na__VegContour__WriteOuter(out, rx0, ry0, rz0, rx, ry, rz);
                }
                Na__VegContour__WriteTri(out, lx0, ly0, lz0, rx0, ry0, rz0, lx, ly, lz);
                Na__VegContour__WriteTri(out, rx0, ry0, rz0, rx, ry, rz, lx, ly, lz);
            }
            lx0 = lx; ly0 = ly; lz0 = lz; rx0 = rx; ry0 = ry; rz0 = rz;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Bush's Radius in Pixels, or -1 When It Is Off the Page
    // ------------------------------------------------------------
    // The same test DrawBush opens with, for a caller deciding what is worth
    // redrawing this frame. Drawing is never asked of a bush this says is off.
    // ------------------------------------------------------------
    function Na__VegContour__PageRadiusPx(bush, view) {
        const bx = bush.boundsCx - view.eyeX, by = bush.boundsCy - view.eyeY, bz = bush.boundsCz - view.eyeZ;
        const depth = bx * view.fwdX + by * view.fwdY + bz * view.fwdZ;
        if (!view.isOrtho && depth + bush.boundsR < 0.05) return -1;
        const scale = view.isOrtho ? view.focalPx : view.focalPx / Math.max(depth, 0.05);
        const sx = (bx * view.rightX + by * view.rightY + bz * view.rightZ) * scale;
        const sy = (bx * view.upX + by * view.upY + bz * view.upZ) * scale;
        const sr = bush.boundsR * scale;
        if (Math.abs(sx) - sr > view.halfWidthPx || Math.abs(sy) - sr > view.halfHeightPx) return -1;
        return sr;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw One Bush from One View into the Output Buffers
    // ------------------------------------------------------------
    // view : { eyeX.., fwdX.., upX.., rightX.., isOrtho, focalPx, halfWidthPx, halfHeightPx }
    //        focalPx is pixels per metre at one metre, or pixels per metre flat on an ortho.
    // style: { segmentPx, lodSkipPx, lodInteriorPx, lodTailPx, lodCurlPx, lodBladePx,
    //          interiorFactor, tailFactor, curlFactor, breakFactor }
    //        and, for a frame nobody studies, minK and bisectSteps: fewer samples round a
    //        small ball, and T-junctions found less exactly. Left out, it is the full drawing.
    // ------------------------------------------------------------
    function Na__VegContour__DrawBush(bush, view, style, out) {
        Ex = view.eyeX; Ey = view.eyeY; Ez = view.eyeZ;
        Fx = view.fwdX; Fy = view.fwdY; Fz = view.fwdZ;
        IsOrtho = view.isOrtho;
        GroundY = bush.groundY;

        // OFF THE PAGE, OR BEHIND THE EYE | Costs nothing but this test
        const bx = bush.boundsCx - Ex, by = bush.boundsCy - Ey, bz = bush.boundsCz - Ez;
        const depth = bx * Fx + by * Fy + bz * Fz;
        if (!IsOrtho && depth + bush.boundsR < 0.05) return;
        const scale = IsOrtho ? view.focalPx : view.focalPx / Math.max(depth, 0.05);
        const sx = (bx * view.rightX + by * view.rightY + bz * view.rightZ) * scale;
        const sy = (bx * view.upX + by * view.upY + bz * view.upZ) * scale;
        const sr = bush.boundsR * scale;
        if (Math.abs(sx) - sr > view.halfWidthPx || Math.abs(sy) - sr > view.halfHeightPx) return;

        Cx = bush.cx; Cy = bush.cy; Cz = bush.cz;
        Ra = bush.r; RMax = bush.rMax; RMin = bush.rMin;
        Pol = bush.polar; PolStart = bush.polStart; PolN = bush.polN; Sty = bush.style; Tier = bush.tier;
        Ink = bush.ink || null;

        Na__VegContour__SetUpBalls(bush, view, style);

        if (bush.core) {
            const c = bush.core;
            for (let t = 0; t < c.length; t += 9) {
                Na__VegContour__WriteTri(out, c[t], c[t + 1], c[t + 2], c[t + 3], c[t + 4], c[t + 5], c[t + 6], c[t + 7], c[t + 8]);
            }
        }

        for (let i = 0; i < bush.count; i++) {
            if (!Active[i]) continue;
            Na__VegContour__DrawBall(bush, i, style, out);
            out.drawnLobes++;
        }
        // A FAR TUFT KEEPS FEWER BLADES | Each blade costs the same ink at any size
        const bladeStep = sr < 30 ? 2 : 1;
        for (let b = 0; b < bush.blades.length; b += bladeStep) {
            Na__VegContour__DrawBlade(bush.blades[b], view, style, out);
        }
        out.drawnBushes++;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Contour Drawer API
    // ------------------------------------------------------------
    export {
        Na__VegContour__CreateOut,
        Na__VegContour__ResetOut,
        Na__VegContour__PageRadiusPx,
        Na__VegContour__DrawBush
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
