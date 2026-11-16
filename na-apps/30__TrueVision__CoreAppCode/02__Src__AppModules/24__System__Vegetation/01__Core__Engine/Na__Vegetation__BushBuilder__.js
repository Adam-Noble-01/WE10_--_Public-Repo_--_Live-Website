// =============================================================================
// TRUEVISION3D - VEGETATION - BUSH BUILDER
// =============================================================================
//
// FILE       : Na__Vegetation__BushBuilder__.js
// NAMESPACE  : Na__VegBuild
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn one asset's rules, one seed and one size into a bush: a set of
//              3D balls and strap leaves in world metres, ready for the contour
//              drawer to outline from any camera
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - RULES FIRST, THEN RANDOMNESS (Adam, 04-Nov-2026: "there should be rules for
//   shape etc but then radnomisation to create convincing vegetation effect thats
//   not repetative"). The recipe fixes the habit of the plant; the seed only picks
//   within its ranges.
// - THREE SCALES OF BALL, because one scale reads as a sheep or a cloud:
//     MASSES  the big shape: which humps the outline has, and where it dips.
//     CLUMPS  scattered over the masses: these are the scallops of the outline.
//     NUBS    small balls on the clumps: the irregular little bumps between them.
// - EVERY CLUMP IS DRAWN BY DART THROWING, largest first, so big billows get first
//   choice of the surface and small ones fill the gaps. That gives the uneven
//   rhythm of a hand drawn edge, where an even scatter would give a beaded one.
// - THE PROXY IS THE RULE. Once built, the balls are pulled in to fit the size the
//   plop asked for, so what an artist places as a proxy is what gets drawn.
// - A BALL'S OUTLINE IS NOT A CIRCLE. Each carries a table of radius against the
//   angle round it on the page. A mass's table is a chain of arcs of random length
//   meeting at sharp inward cusps, which is how AutoCAD draws a revision cloud: it
//   means no part of the outline can ever be a long plain curve, from any view. A
//   clump's chain is shallow, so it reads as a cluster of leaves and not a marble.
// - RANDOM NUMBERS PER LOBE ARE KEPT, NOT SPENT. Sixteen numbers per lobe are
//   stored, and the Line Rules sliders compare against them at draw time, so a
//   slider never reshuffles the bush.
//
// - GENERATORS ARE NEVER EDITED (plan, D15). A saved seed must draw the same bush for
//   ever, so what follows is BallCluster version 1, and a new look is a new function
//   beside it, listed in the app's config. THE ORDER OF THE RANDOM DRAWS IS PART OF
//   THAT PROMISE: one rng call added, removed or moved changes every plant it has ever
//   made, with no error anywhere.
// - A PLANT'S SCALE IS THE WHOLE PLANT (Adam, 04-Nov-2026: "I would set a scale of 0.5").
//   Every ball, radius, blade and hook is multiplied after the build, so no random number
//   moves: the same bush, smaller, and a slider never reshuffles it. Its size (sizeMm) is
//   the other control: it fits the bush to a space, and its clumps keep their own size.
// - CLIPPED FORMS (Adam: "a more managed hedge-looking plant"). The same balls and the same
//   line language, on a different habit: a generator of its own, so BallCluster is left
//   alone. Small even clumps sit on the faces of a form, a box, a ball, a cone or a ball on
//   a stem, so the outline is that form with a fine scalloped edge. A clump knows which
//   way its face looks, and the drawer leaves out those facing away (Contour's facing), or
//   a shell of hundreds would cost hundreds. Inside, larger balls lie close behind the faces:
//   any ball at all behind an outline makes it an inner line, so they stop the gaps in the
//   shell from drawing as holes. Being clumps to the drawer, they cost a clump's table.
// - A BOX HAS A SOLID CORE. Fill is a disc for each ball, and there are always gaps between the
//   discs of a flat shell, where a line far behind the hedge would show through. So a box also
//   carries bush.core, twelve triangles of fill just behind its faces, that the drawer writes
//   as they are. It stops short of a lapped end, so it never covers what the next run's lap needs.
// - A LONG HEDGE HAS NO JOINTS. A plop's ends say what a run meets, behind and ahead along its
//   path (Lap, Corner or End). A lapped end has no end face, and over its last Form__LapMm its
//   clumps sink further and further into the body. The path laps the next run by twice that, so
//   wherever one has started to sink the other is full out: each one's end lies behind the
//   other's fill, and the depth test takes it out from any side. A ramp, because a clump left
//   at full depth at the very end would lie in the other's plane and show. At a corner the end
//   face is the other run's long face, so it is left off too.
// - A FLAT FACE IS MARKED, NOT OUTLINED. In a flat shell every ball's outline lies under its
//   neighbours, so no inner arc could ever show. So a share of the clumps carry a mark, an arc
//   drawn inside the outline on the ball's own near surface (bush.marks: how far in), and every
//   clump along a box's edge does, so the top of a hedge reads as a top.
//
// FRAMES:
// - Everything here is three.js world: metres, +Y up. Recipes and plops are integer
//   mm, Y-up, converted once on the way in, as every ValeVision saved value is.
//
// INTEGRATION:
// - A recipe is one asset of 53__Vegetation__AssetLibrary, or a project's pinned copy.
// - Its product is read by Na__Vegetation__Contour__.js. Imports nothing from
//   three.js, so the whole build can move to a worker.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/01__Core__Engine/Na__Vegetation__BushBuilder__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - A plop's scale, and the ClippedForm generator. Assemble is what the two share, moved
//   out of Bush with every draw in the same order: BallCluster's plants are unchanged, by
//   the engine hash.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
// - Moved in from the prototype 85__EarlyStage__VegetationLinework, where the look
//   was agreed. Every draw is unchanged. Added BuildPlant, which picks the generator an
//   asset names.
//
// 04-Nov-2026 - Version 0.1.0
// - Initial build for the isolated aesthetic demo.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Seeded Random
    // ------------------------------------------------------------
    import { Na__VegRand__Create } from './Na__Vegetation__Random__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Table Sizes and Tiers
    // ------------------------------------------------------------
    const Na__VegBuild__TAU         = Math.PI * 2;
    const Na__VegBuild__POLAR_MASS  = 720;                                     // <-- Half a degree: a mass's cusps stay sharp in a close up
    const Na__VegBuild__POLAR_CLUMP = 180;
    const Na__VegBuild__POLAR_NUB   = 48;
    const Na__VegBuild__STYLE_N     = 16;                                      // <-- Stored random numbers per lobe (see Contour's U_ indices)
    const Na__VegBuild__CUSP_U_N    = 4;                                       // <-- Stored random numbers per cusp
    const Na__VegBuild__TIER_MASS   = 0;
    const Na__VegBuild__TIER_CLUMP  = 1;
    const Na__VegBuild__TIER_NUB    = 2;
    const Na__VegBuild__MAX_LOBES   = 900;                                     // <-- A very long drift stops here rather than freezing the page
    const Na__VegBuild__U_ARC_ANGLE = 7;                                       // <-- Contour's own number: where round the ball an arc goes
    const Na__VegBuild__ARC_TOP     = 0.5;                                     // <-- Contour reads 0.5 as the top of the ball, and 0 or 1 as well round to a side
    const Na__VegBuild__ARC_SIDE_A  = 0.02;
    const Na__VegBuild__ARC_SIDE_B  = 0.98;
    const Na__VegBuild__MARK_EDGE   = 0.16;                                    // <-- How far in from the outline a mark is, as a share of the radius: an edge's runs along it
    const Na__VegBuild__MARK_FACE   = 0.34;
    const Na__VegBuild__END_REAL    = 'End';                                   // <-- What a clipped run's end may meet: Plop__Ends in the record
    const Na__VegBuild__END_LAP     = 'Lap';
    const Na__VegBuild__END_FACE_NX = 0.7;                                     // <-- A spot whose normal is this much along the run is on an end face
    const Na__VegBuild__LAP_SINK    = 1.6;                                     // <-- How deep the very end of a lap goes, in clump radii
    const Na__VegBuild__LAP_MARKS   = 0.2;                                     // <-- Of the lap's ramp: a clump sunk further than this has no mark
    const Na__VegBuild__CORE_BACK_M = 0.03;                                    // <-- How far behind the deepest clump's outline a box's core lies
    const Na__VegBuild__FORM_FALLBACK = { Form__Shape : 'Ball', Form__Inset : 0.55, Form__Waver : 0.12, Form__EdgeShare : 0, Form__MarkShare : 0.2 };   // <-- An asset with no Asset__Form still draws something
    const Na__VegBuild__CORE_FACES  = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
    const Na__VegBuild__SHELL_TRIES = 14;                                      // <-- A clump gives up after this many spots on a crowded form
    const Na__VegBuild__SHELL_THROWS = 1800;                                   // <-- Clumps tried, of which about two in five land: enough for the longest clipped run
    const Na__VegBuild__GRID_SPAN   = 1024;                                    // <-- Cells a side in the crowding grid's key: far more than a plant has
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Masses: the Big Shape
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Masses of a Rounded Mound (a crown, and shoulders round it)
    // ------------------------------------------------------------
    function Na__VegBuild__MassesMound(rng, a, b, h, rules) {
        const masses = [];
        const count  = rng.int(rules.Masses__CountMin, rules.Masses__CountMax);

        // THE CROWN SITS OFF CENTRE, or every mound has its peak in the middle
        const crownR = Math.min(h, a * 1.6) * rng.range(0.36, 0.44);
        masses.push({
            x : rng.range(-0.30, 0.30) * a,
            y : h - crownR * rng.range(0.98, 1.06),
            z : rng.range(-0.18, 0.18) * b,
            r : crownR
        });

        const start = rng.angle();
        for (let k = 1; k < count; k++) {
            const az     = start + (Na__VegBuild__TAU * (k - 1)) / (count - 1) + rng.range(-0.42, 0.42);
            const spread = rng.range(0.42, 0.72);
            const r      = Math.min(h, a * 1.6) * rng.range(0.26, 0.42);
            masses.push({
                x : Math.cos(az) * a * spread,
                y : r * rng.range(0.72, 1.45),                                 // <-- Shoulders at different heights make the humps and notches
                z : Math.sin(az) * b * spread,
                r
            });
        }
        return masses;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Masses of an Upright Shrub (a loose stack, and side shoots)
    // ------------------------------------------------------------
    function Na__VegBuild__MassesUpright(rng, a, b, h, rules) {
        const masses = [];
        const count  = rng.int(rules.Masses__CountMin, rules.Masses__CountMax);

        for (let k = 0; k < count; k++) {
            const t = (k + 0.5) / count;
            const w = Math.pow(Math.sin(Math.PI * (0.20 + 0.72 * t)), 0.8);    // <-- Fullest a little below the middle, narrowing to the top
            const r = a * rng.range(0.56, 0.78) * w;
            masses.push({
                x : rng.range(-0.34, 0.34) * a,
                y : h * (0.14 + 0.72 * t) + rng.range(-0.05, 0.05) * h,
                z : rng.range(-0.28, 0.28) * b,
                r : Math.max(r, a * 0.26)
            });
        }

        // SIDE SHOOTS | What breaks the outline: without them it is a smooth egg
        const shoots = rng.int(1, 2);
        for (let k = 0; k < shoots; k++) {
            const az = rng.angle();
            masses.push({
                x : Math.cos(az) * a * rng.range(0.55, 0.80),
                y : h * rng.range(0.42, 0.86),
                z : Math.sin(az) * b * rng.range(0.40, 0.70),
                r : a * rng.range(0.20, 0.32)
            });
        }
        return masses;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Masses of a Low Drift (the count follows the length)
    // ------------------------------------------------------------
    function Na__VegBuild__MassesRun(rng, a, b, h, rules) {
        const masses = [];
        const length = a * 2;
        const pitch  = h * rng.range(0.95, 1.25);
        const count  = Math.max(rules.Masses__CountMin, Math.round(length / pitch));

        for (let k = 0; k < count; k++) {
            const t = (k + 0.5) / count;
            const r = h * rng.range(0.42, 0.66);
            masses.push({
                x : (-a + length * t) * 0.84 + rng.range(-0.30, 0.30) * (length / count),
                y : r * rng.range(0.62, 0.98),
                z : rng.range(-0.34, 0.34) * b,
                r
            });
        }
        return masses;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clumps and Nubs: the Scallops
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Uniformly Random Direction, Kept Off the Underside
    // ------------------------------------------------------------
    function Na__VegBuild__RandomDirection(rng, out) {
        const y  = rng.range(-0.30, 1.0);                                      // <-- Nothing grows on the underside of a mass
        const az = rng.angle();
        const s  = Math.sqrt(Math.max(0, 1 - y * y));
        out.x = Math.cos(az) * s;
        out.y = y;
        out.z = Math.sin(az) * s;
        return out;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Scatter Clumps Over the Masses, Largest First
    // ------------------------------------------------------------
    function Na__VegBuild__ScatterClumps(rng, masses, recipe, factors) {
        const rules   = recipe.Asset__Clumps;
        const scallop = factors.scallop;
        const minR    = (rules.Clumps__RadiusMinMm / 1000) * scallop;
        const maxR    = (rules.Clumps__RadiusMaxMm / 1000) * scallop;
        const clumps  = [];
        const dir     = { x : 0, y : 0, z : 0 };

        // HOW MANY | A saturated throw: try far more than will fit and stop on crowding
        let area = 0;
        masses.forEach((m) => { area += 4 * Math.PI * m.r * m.r; });
        const meanR  = (minR + maxR) * 0.5;
        const target = Math.min(Na__VegBuild__MAX_LOBES, Math.ceil(area / (Math.PI * meanR * meanR * 0.7)));

        const radii = [];
        for (let k = 0; k < target; k++) radii.push(rng.skew(minR, maxR, rules.Clumps__Skew));
        radii.sort((p, q) => q - p);                                           // <-- Biggest billows choose first

        for (let k = 0; k < radii.length; k++) {
            const rc = radii[k];
            for (let tries = 0; tries < 26; tries++) {
                const m = masses[Math.floor(rng.next() * masses.length)];
                Na__VegBuild__RandomDirection(rng, dir);
                const reach = m.r * rng.range(rules.Clumps__ReachMin, rules.Clumps__ReachMax);
                const cx = m.x + dir.x * reach;
                const cy = m.y + dir.y * reach;
                const cz = m.z + dir.z * reach;
                if (cy < rc * 0.10) continue;                                  // <-- Foot clumps sit on the ground, not under it

                // BURIED IN ANOTHER MASS | It could never be seen
                let buried = false;
                for (let j = 0; j < masses.length; j++) {
                    const o = masses[j];
                    if (o === m) continue;
                    const dx = cx - o.x, dy = cy - o.y, dz = cz - o.z;
                    if (dx * dx + dy * dy + dz * dz < (o.r * 0.84) * (o.r * 0.84)) { buried = true; break; }
                }
                if (buried) continue;

                // CROWDING | Overlapping is the point; sitting on top of another is not
                let crowded = false;
                for (let j = 0; j < clumps.length; j++) {
                    const o = clumps[j];
                    const gap = (rc + o.r) * rules.Clumps__Spacing;
                    const dx = cx - o.x, dy = cy - o.y, dz = cz - o.z;
                    if (dx * dx + dy * dy + dz * dz < gap * gap) { crowded = true; break; }
                }
                if (crowded) continue;

                clumps.push({ x : cx, y : cy, z : cz, r : rc, mx : m.x, my : m.y, mz : m.z });
                break;
            }
        }
        return clumps;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Set Nubs on the Clumps
    // ------------------------------------------------------------
    function Na__VegBuild__ScatterNubs(rng, clumps, recipe, factors) {
        const rules = recipe.Asset__Nubs;
        const nubs  = [];
        const count = Math.round(clumps.length * rules.Nubs__Share * factors.nubs);

        for (let k = 0; k < count && clumps.length > 0; k++) {
            const c  = clumps[Math.floor(rng.next() * clumps.length)];
            const rn = rng.range(rules.Nubs__RadiusMinMm, rules.Nubs__RadiusMaxMm) / 1000;

            // OUTWARD FROM THE MASS, with scatter, so nubs break the edge and do not pile in the middle
            let ox = c.x - c.mx, oy = c.y - c.my, oz = c.z - c.mz;
            const len = Math.hypot(ox, oy, oz) || 1;
            ox = ox / len + rng.range(-0.9, 0.9);
            oy = oy / len + rng.range(-0.9, 0.9);
            oz = oz / len + rng.range(-0.9, 0.9);
            const lenB  = Math.hypot(ox, oy, oz) || 1;
            const reach = c.r * rng.range(0.88, 1.04);

            const x = c.x + (ox / lenB) * reach;
            const y = c.y + (oy / lenB) * reach;
            const z = c.z + (oz / lenB) * reach;
            if (y < rn * 0.10) continue;
            nubs.push({ x, y, z, r : rn });
        }
        return nubs;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Strap Leaves
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Tufts of Strap Leaves Round the Foot
    // ------------------------------------------------------------
    // Each blade is a true 3D curve from the foot, so a tuft stands correctly from
    // above as well as from the side. Its width is only given at draw time, turned
    // square to the eye, so a blade never collapses to a sliver when seen edge on.
    // ------------------------------------------------------------
    function Na__VegBuild__BuildTufts(rng, recipe, a, b) {
        const rules  = recipe.Asset__Tufts;
        const blades = [];
        const count  = rng.int(rules.Tufts__CountMin, rules.Tufts__CountMax);

        for (let t = 0; t < count; t++) {
            const az    = rng.angle();
            const ring  = rng.range(0.74, 1.02);
            const baseX = Math.cos(az) * a * ring;
            const baseZ = Math.sin(az) * b * ring;
            const tall  = rng.range(rules.Tufts__HeightMinMm, rules.Tufts__HeightMaxMm) / 1000;
            const n     = rng.int(rules.Tufts__BladesMin, rules.Tufts__BladesMax);

            for (let k = 0; k < n; k++) {
                const bladeAz = rng.angle();
                const h       = tall * rng.range(0.58, 1.0);
                const lean    = h * rng.range(0.12, 0.52);                     // <-- More than this and a blade reads as a croquet hoop
                const dx      = Math.cos(bladeAz), dz = Math.sin(bladeAz);
                const ox      = baseX + dx * rng.range(0.0, 0.05);             // <-- The foot opens out, or the base of a tuft is a black knot
                const oz      = baseZ + dz * rng.range(0.0, 0.05);
                const droop   = rng.range(0.84, 1.0);
                blades.push({
                    p : [
                        ox, 0, oz,
                        ox + dx * lean * 0.15, h * 0.55, oz + dz * lean * 0.15,
                        ox + dx * lean * 0.68, h * 0.98, oz + dz * lean * 0.68,
                        ox + dx * lean * 1.25, h * droop, oz + dz * lean * 1.25
                    ],
                    w : (rules.Tufts__BladeWidthMm / 1000) * rng.range(0.75, 1.2)
                });
            }
        }
        return blades;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building a Bush
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fill One Ball's Radius Table with a Chain of Arcs
    // ------------------------------------------------------------
    // rules : { chordMinM, chordMaxM, depth, skew, tipShare, ellipse, wobble }
    // Each arc gets its own length, height and lean, so no two runs of the chain
    // repeat. A tipped arc comes to a soft point: a leaf rather than a billow.
    // ------------------------------------------------------------
    function Na__VegBuild__FillPolar(rng, table, base, N, radiusM, rules) {
        const TAU = Na__VegBuild__TAU;

        // THE ARC LENGTHS | Thrown until they go round, then scaled to close exactly
        const widths = [];
        let total = 0;
        while (total < TAU && widths.length < 128) {
            const chord = rng.skew(rules.chordMinM, rules.chordMaxM, rules.skew);
            const w = Math.max(chord / radiusM, 0.16);
            widths.push(w);
            total += w;
        }
        const closeUp = TAU / total;

        const arcs = [];
        let at = 0;
        let meanHeight = 0;
        for (let k = 0; k < widths.length; k++) {
            const w = widths[k] * closeUp;
            const height = w * rules.depth * rng.range(0.58, 1.32);
            arcs.push({
                start  : at,
                width  : w,
                height,
                lean   : rng.range(0.72, 1.36),                                // <-- The top of the arc sits off centre, as a pen stroke does
                tipped : rng.chance(rules.tipShare)
            });
            at += w;
            meanHeight += height * w;
        }
        meanHeight /= TAU;

        const offset  = rng.angle();                                           // <-- Where the chain starts round the ball
        const ellipse = rng.range(-rules.ellipse, rules.ellipse);
        const tilt    = rng.angle();
        const w3      = rules.wobble * rng.range(0.4, 1.0);
        const p3      = rng.angle();

        // SAMPLE THE CHAIN | Walking the arcs in step with the table
        let min = Infinity, max = -Infinity;
        for (let k = 0; k < N; k++) {
            const raw = (TAU * k) / N;
            let angle = raw - offset;
            angle -= Math.floor(angle / TAU) * TAU;

            let index = 0;
            while (index < arcs.length - 1 && angle >= arcs[index + 1].start) index++;

            const arc = arcs[index];
            const t   = Math.min(1, Math.max(0, (angle - arc.start) / arc.width));
            const x   = 2 * Math.pow(t, arc.lean) - 1;
            const bump = arc.tipped
                ? Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x), 1.25)), 1.12)
                : Math.sqrt(Math.max(0, 1 - x * x));

            const f = 1 - meanHeight * 0.5
                + arc.height * bump
                + ellipse * Math.cos(2 * (raw - tilt))
                + w3 * Math.cos(3 * raw + p3);
            table[base + k] = f;
            if (f < min) min = f;
            if (f > max) max = f;
        }
        // THE CUSPS | Where one arc meets the next: the hooks are drawn from these
        const cusps = [];
        for (let k = 0; k < arcs.length; k++) {
            cusps.push((arcs[k].start + offset) % TAU);
        }
        return { min, max, cusps };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build One Bush from Its Recipe and Its Plop
    // ------------------------------------------------------------
    // plop   : { seed, positionMm:[x,y,z], yawDeg, sizeMm:[w,d,h] | null, scale, ends }
    // factors: { scallop, nubs }, the panel's two structural sliders
    // ------------------------------------------------------------
    function Na__VegBuild__Bush(recipe, plop, factors) {
        const rng    = Na__VegRand__Create(plop.seed);
        const size   = recipe.Asset__Size;
        const jitter = 1 + rng.range(-size.Size__JitterShare, size.Size__JitterShare);
        const widthM = ((plop.sizeMm ? plop.sizeMm[0] : size.Size__WidthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const depthM = ((plop.sizeMm ? plop.sizeMm[1] : size.Size__DepthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const highM  = ((plop.sizeMm ? plop.sizeMm[2] : size.Size__HeightMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const a = widthM / 2, b = depthM / 2, h = highM;

        // THE BIG SHAPE
        const layout = recipe.Asset__Masses.Masses__Layout;
        let masses;
        if (layout === 'Upright')  masses = Na__VegBuild__MassesUpright(rng, a, b, h, recipe.Asset__Masses);
        else if (layout === 'Run') masses = Na__VegBuild__MassesRun(rng, a, b, h, recipe.Asset__Masses);
        else                       masses = Na__VegBuild__MassesMound(rng, a, b, h, recipe.Asset__Masses);

        // THE SCALLOPS
        const clumps = Na__VegBuild__ScatterClumps(rng, masses, recipe, factors);
        const nubs   = Na__VegBuild__ScatterNubs(rng, clumps, recipe, factors);
        const blades = Na__VegBuild__BuildTufts(rng, recipe, a, b);

        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses, clumps, nubs, blades, a, b, h, widthM, depthM, highM });
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit a Plant's Balls to Its Size, and Set Them in the World
    // ------------------------------------------------------------
    // parts: { masses, clumps, nubs, blades, a, b, h, widthM, depthM, highM, faces, core }. What
    // every generator ends with, and from here on it draws random numbers for each ball in turn,
    // so nothing may be added above a draw. A ball may carry nx, ny, nz, the way its face
    // looks, and mark and markAt, how far in its mark is and where round the ball.
    // ------------------------------------------------------------
    function Na__VegBuild__Assemble(rng, recipe, plop, factors, parts) {
        const { masses, clumps, nubs, blades, a, b, h, widthM, depthM, highM } = parts;

        // THE PLANT'S SCALE | See the header. Applied below, after every draw is decided
        const zoom = plop.scale > 0 ? plop.scale : 1;

        // FIT TO THE PROXY | Centres only: radii stay as the recipe says, so a stretched
        // proxy never stretches a scallop
        let maxX = 0.001, maxZ = 0.001, maxY = 0.001;
        const all = [];
        masses.forEach((m) => all.push({ tier : Na__VegBuild__TIER_MASS, x : m.x, y : m.y, z : m.z, r : m.r }));
        clumps.forEach((m) => all.push({ tier : Na__VegBuild__TIER_CLUMP, x : m.x, y : m.y, z : m.z, r : m.r, nx : m.nx, ny : m.ny, nz : m.nz, mark : m.mark, markAt : m.markAt }));
        nubs.forEach((m) => all.push({ tier : Na__VegBuild__TIER_NUB, x : m.x, y : m.y, z : m.z, r : m.r, nx : m.nx, ny : m.ny, nz : m.nz }));
        all.forEach((m) => {
            maxX = Math.max(maxX, Math.abs(m.x) + m.r);
            maxZ = Math.max(maxZ, Math.abs(m.z) + m.r);
            maxY = Math.max(maxY, m.y + m.r);
        });
        const fitX = a / maxX, fitZ = b / maxZ, fitY = h / maxY;

        // INTO THE WORLD | Yaw about +Y, then the plop's place. Mm to metres once, here.
        const yaw  = ((plop.yawDeg || 0) * Math.PI) / 180;
        const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        const ox   = plop.positionMm[0] / 1000;
        const oy   = plop.positionMm[1] / 1000;
        const oz   = plop.positionMm[2] / 1000;

        const n     = all.length;
        const bush  = {
            count    : n,
            cx       : new Float32Array(n),
            cy       : new Float32Array(n),
            cz       : new Float32Array(n),
            r        : new Float32Array(n),
            rMax     : new Float32Array(n),
            rMin     : new Float32Array(n),
            tier     : new Uint8Array(n),
            polar    : null,
            polStart : new Int32Array(n),
            polN     : new Int32Array(n),
            cuspFrom : new Int32Array(n + 1),
            cuspA    : null,
            cuspU    : null,
            style    : new Float32Array(n * Na__VegBuild__STYLE_N),
            blades   : [],
            facing   : parts.faces ? new Float32Array(n * 3) : null,
            marks    : parts.faces ? new Float32Array(n) : null,
            line     : (zoom === 1) ? recipe.Asset__Line : Object.assign({}, recipe.Asset__Line, {
                Line__CuspHookMinMm : recipe.Asset__Line.Line__CuspHookMinMm * zoom,
                Line__CuspHookMaxMm : recipe.Asset__Line.Line__CuspHookMaxMm * zoom
            }),
            sizeM    : [widthM * zoom, depthM * zoom, highM * zoom],
            groundY  : oy,
            boundsCx : ox,
            boundsCy : oy + h * 0.5 * zoom,
            boundsCz : oz,
            boundsR  : Math.hypot(a, h * 0.5, b) * 1.15 * zoom
        };

        // THE RADIUS TABLES | One shared array, each ball taking what its size needs
        let tableSize = 0;
        for (let i = 0; i < n; i++) {
            const tier = all[i].tier;
            const size = tier === Na__VegBuild__TIER_MASS ? Na__VegBuild__POLAR_MASS
                : (tier === Na__VegBuild__TIER_CLUMP ? Na__VegBuild__POLAR_CLUMP : Na__VegBuild__POLAR_NUB);
            bush.polStart[i] = tableSize;
            bush.polN[i]     = size;
            tableSize += size;
        }
        bush.polar = new Float32Array(tableSize);

        const massRules = {
            chordMinM : (recipe.Asset__Masses.Masses__ScallopChordMinMm / 1000) * factors.scallop,
            chordMaxM : (recipe.Asset__Masses.Masses__ScallopChordMaxMm / 1000) * factors.scallop,
            depth     : recipe.Asset__Masses.Masses__ScallopDepth,
            skew      : recipe.Asset__Masses.Masses__ScallopSkew,
            tipShare  : recipe.Asset__Masses.Masses__TipShare,
            ellipse   : 0.03,
            wobble    : 0.015
        };
        const clumpDepth = recipe.Asset__Clumps.Clumps__ScallopDepth;
        const clumpTips  = recipe.Asset__Clumps.Clumps__TipShare;
        const clumpEll   = recipe.Asset__Clumps.Clumps__Ellipse;
        const clumpWob   = recipe.Asset__Clumps.Clumps__Wobble;
        const cuspList   = [];

        for (let i = 0; i < n; i++) {
            const m  = all[i];
            const lx = m.x * fitX * zoom, lz = m.z * fitZ * zoom;
            bush.cx[i]   = ox + lx * cosY + lz * sinY;
            bush.cy[i]   = oy + m.y * fitY * zoom;
            bush.cz[i]   = oz - lx * sinY + lz * cosY;
            bush.r[i]    = m.r * zoom;
            bush.tier[i] = m.tier;

            // A CLUMP'S CHAIN IS SHORT AND SHALLOW; A NUB IS PLAIN | Sizes are per ball, not per bush
            const rules = (m.tier === Na__VegBuild__TIER_MASS) ? massRules : (m.tier === Na__VegBuild__TIER_CLUMP
                ? { chordMinM : m.r * 0.85, chordMaxM : m.r * 1.9, depth : clumpDepth, skew : 1.0, tipShare : clumpTips, ellipse : clumpEll, wobble : clumpWob }
                : { chordMinM : m.r * 2.4, chordMaxM : m.r * 4.0, depth : 0.02, skew : 1.0, tipShare : 0, ellipse : clumpEll, wobble : clumpWob });
            const span = Na__VegBuild__FillPolar(rng, bush.polar, bush.polStart[i], bush.polN[i], m.r, rules);
            bush.rMax[i] = m.r * zoom * span.max;
            bush.rMin[i] = m.r * zoom * span.min;

            bush.cuspFrom[i] = cuspList.length;
            if (m.tier !== Na__VegBuild__TIER_NUB) {
                span.cusps.forEach((angle) => cuspList.push(angle));
            }

            for (let u = 0; u < Na__VegBuild__STYLE_N; u++) {
                bush.style[i * Na__VegBuild__STYLE_N + u] = rng.next();
            }

            // WHICH WAY IT LOOKS, AND WHETHER IT DRAWS ITS ARC | Clipped forms only: see the header
            if (bush.facing && m.nx !== undefined) {
                bush.facing[i * 3]     = m.nx * cosY + m.nz * sinY;
                bush.facing[i * 3 + 1] = m.ny;
                bush.facing[i * 3 + 2] = -m.nx * sinY + m.nz * cosY;
            }
            if (m.mark > 0) {
                bush.marks[i] = m.mark;
                bush.style[i * Na__VegBuild__STYLE_N + Na__VegBuild__U_ARC_ANGLE] = m.markAt;
            }
        }

        // A BOX'S CORE | Its eight corners, set in the world as the balls are, as twelve triangles
        if (parts.core) {
            const c = parts.core;
            const corners = [
                [c.x0, 0, -c.zFoot], [c.x1, 0, -c.zFoot], [c.x1, 0, c.zFoot], [c.x0, 0, c.zFoot],
                [c.x0, c.y1, -c.zTop], [c.x1, c.y1, -c.zTop], [c.x1, c.y1, c.zTop], [c.x0, c.y1, c.zTop]
            ].map(([x, y, z]) => {
                const lx = x * fitX * zoom, lz = z * fitZ * zoom;
                return [ox + lx * cosY + lz * sinY, oy + y * fitY * zoom, oz - lx * sinY + lz * cosY];
            });
            bush.core = new Float32Array(Na__VegBuild__CORE_FACES.length * 18);
            let at = 0;
            Na__VegBuild__CORE_FACES.forEach((face) => {
                [face[0], face[1], face[2], face[0], face[2], face[3]].forEach((corner) => {
                    bush.core.set(corners[corner], at);
                    at += 3;
                });
            });
        }

        // A CUSP'S OWN NUMBERS | Kept like a lobe's, so a slider never reshuffles the hooks
        bush.cuspFrom[n] = cuspList.length;
        bush.cuspA = new Float32Array(cuspList);
        bush.cuspU = new Float32Array(cuspList.length * Na__VegBuild__CUSP_U_N);
        for (let k = 0; k < bush.cuspU.length; k++) bush.cuspU[k] = rng.next();

        blades.forEach((blade) => {
            const p = new Float32Array(12);
            for (let k = 0; k < 4; k++) {
                const lx = blade.p[k * 3] * zoom, ly = blade.p[k * 3 + 1] * zoom, lz = blade.p[k * 3 + 2] * zoom;
                p[k * 3]     = ox + lx * cosY + lz * sinY;
                p[k * 3 + 1] = oy + ly;
                p[k * 3 + 2] = oz - lx * sinY + lz * cosY;
            }
            bush.blades.push(blade.stem ? { p, w : blade.w * zoom, stem : true } : { p, w : blade.w * zoom });
        });

        return bush;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipped Forms: the Faces a Clump Sits On
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Vector Made a Unit Long, Into an Object
    // ------------------------------------------------------------
    function Na__VegBuild__SetNormal(out, x, y, z) {
        const length = Math.hypot(x, y, z) || 1;
        out.nx = x / length;
        out.ny = y / length;
        out.nz = z / length;
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Each Form: How Much Face It Has, a Spot on It, What Fills It
    // ------------------------------------------------------------
    // All in local metres, standing on the origin. spot writes x, y, z, nx, ny, nz, edge (how
    // far the spot is from one of the form's edges, in metres, or Infinity), edgeAt (where
    // round the ball that edge draws) and fit (a share of the clump's radius that fits here).
    // look says which way a point looks, for a nub. body is the balls inside, kept just under
    // the shell, so its gaps show no holes and a far plant whose clumps have dropped out still
    // has its shape.
    // ------------------------------------------------------------
    const Na__VegBuild__FORMS = {

        Box : {
            sharp : true,
            area : (a, b, h) => 4 * a * b + 4 * a * h + 4 * b * h,
            spot(rng, a, b, h, form, out) {
                const batter = form.Form__Batter || 0;
                const faces  = 4 * a * b + 4 * a * h + 4 * b * h;
                let pick = rng.next() * faces;
                const u = rng.next(), v = rng.next();
                const inAt = (y) => 1 - batter * (y / h);                      // <-- A clipped hedge leans in a little to its top
                if (pick < 4 * a * b) {
                    out.x = (2 * u - 1) * a * inAt(h); out.y = h; out.z = (2 * v - 1) * b * inAt(h);
                    Na__VegBuild__SetNormal(out, 0, 1, 0);
                    out.edge = Math.min(a * inAt(h) - Math.abs(out.x), b * inAt(h) - Math.abs(out.z));
                    out.edgeAt = Na__VegBuild__ARC_TOP;
                    return;
                }
                pick -= 4 * a * b;
                if (pick < 4 * a * h) {
                    const side = v < 0.5 ? 1 : -1;
                    out.y = rng.next() * h;
                    out.x = (2 * u - 1) * a * inAt(out.y);
                    out.z = side * b * inAt(out.y);
                    Na__VegBuild__SetNormal(out, 0, batter * b / h, side);
                    const toTop = h - out.y, toEnd = a * inAt(out.y) - Math.abs(out.x);
                    out.edge = Math.min(toTop, toEnd);
                    out.edgeAt = toTop <= toEnd ? Na__VegBuild__ARC_TOP : (rng.chance(0.5) ? Na__VegBuild__ARC_SIDE_A : Na__VegBuild__ARC_SIDE_B);
                    return;
                }
                const side = v < 0.5 ? 1 : -1;
                out.y = rng.next() * h;
                out.z = (2 * u - 1) * b * inAt(out.y);
                out.x = side * a * inAt(out.y);
                Na__VegBuild__SetNormal(out, side, batter * a / h, 0);
                const toTop = h - out.y, toEnd = b * inAt(out.y) - Math.abs(out.z);
                out.edge = Math.min(toTop, toEnd);
                out.edgeAt = toTop <= toEnd ? Na__VegBuild__ARC_TOP : (rng.chance(0.5) ? Na__VegBuild__ARC_SIDE_A : Na__VegBuild__ARC_SIDE_B);
            },
            look(x, y, z, a, b, h, out) {
                const dx = a - Math.abs(x), dy = h - y, dz = b - Math.abs(z);
                if (dy <= dx && dy <= dz) Na__VegBuild__SetNormal(out, 0, 1, 0);
                else if (dz <= dx) Na__VegBuild__SetNormal(out, 0, 0, z < 0 ? -1 : 1);
                else Na__VegBuild__SetNormal(out, x < 0 ? -1 : 1, 0, 0);
            },
            body(rng, a, b, h) {
                // A GRID A BALL'S REACH APART | Close enough that the circles leave no gap, and
                // its outer ones just inside the faces. Only a mid plane: a face seen from
                // any side has it behind it, and a far end has the end balls'.
                const r      = Math.max(0.03, Math.min(b * 0.9, h * 0.48, a * 0.9));
                const pitch  = r * 1.35;
                const across = Math.max(1, Math.ceil((2 * a - 2 * r) / pitch));
                const levels = Math.max(1, Math.ceil((h - 2 * r) / pitch));
                const balls  = [];
                for (let l = 0; l <= levels; l++) {
                    const y = r + ((h - 2 * r) * l) / levels;
                    for (let k = 0; k <= across; k++) {
                        balls.push({
                            x : -a + r + ((2 * a - 2 * r) * k) / across,
                            y,
                            z : 0,
                            r : r * rng.range(0.98, 1.0),
                            mx : 0, my : y, mz : 0
                        });
                    }
                }
                return balls;
            }
        },

        Ball : {
            area : (a, b, h) => 4 * Math.PI * Math.pow((Math.pow(a * b, 1.6) + 2 * Math.pow(a * h * 0.5, 1.6)) / 3, 1 / 1.6),
            spot(rng, a, b, h, form, out) {
                const up = rng.range(form.Form__StemHeightShare > 0 ? -1.0 : -0.72, 1.0), az = rng.angle();   // <-- A ball on the ground has no underside to see
                const s  = Math.sqrt(Math.max(0, 1 - up * up));
                out.x = Math.cos(az) * s * a;
                out.y = h * 0.5 + up * h * 0.5;
                out.z = Math.sin(az) * s * b;
                Na__VegBuild__SetNormal(out, Math.cos(az) * s / a, up / (h * 0.5), Math.sin(az) * s / b);
                out.edge = Infinity;
                out.fit  = 1;
            },
            look(x, y, z, a, b, h, out) {
                Na__VegBuild__SetNormal(out, x / (a * a), (y - h * 0.5) / (h * h * 0.25), z / (b * b));
            },
            body(rng, a, b, h) {
                const y = h * 0.5;
                return [{ x : 0, y, z : 0, r : Math.min(a, b, h * 0.5) * 0.84, mx : 0, my : y, mz : 0 }];
            }
        },

        Cone : {
            area : (a, b, h) => Math.PI * (a + b) * 0.5 * Math.hypot((a + b) * 0.5, h),
            spot(rng, a, b, h, form, out) {
                const k  = Math.sqrt(rng.next());                              // <-- More round the foot than at the tip: the face is wider there
                const az = rng.angle();
                out.y = h * (1 - k);
                out.x = Math.cos(az) * a * k;
                out.z = Math.sin(az) * b * k;
                Na__VegBuild__SetNormal(out, Math.cos(az) * h, (a + b) * 0.5, Math.sin(az) * h);
                out.edge = Infinity;
                out.fit  = Math.min(1, Math.max(0.35, k * 1.7));               // <-- Fine at the tip, or it ends in a string of beads
            },
            look(x, y, z, a, b, h, out) {
                const around = Math.atan2(z, x);
                Na__VegBuild__SetNormal(out, Math.cos(around) * h, (a + b) * 0.5, Math.sin(around) * h);
            },
            body(rng, a, b, h) {
                // A STACK UP THE AXIS TO THE TIP | Each ball overlaps the last, so nothing floats
                const balls = [];
                const wide  = Math.min(a, b);
                let y = wide * 0.72;
                while (y < h) {
                    const r = (1 - y / h) * wide * 0.92;
                    if (r < 0.014) break;
                    balls.push({ x : 0, y, z : 0, r, mx : 0, my : y, mz : 0 });
                    y += Math.max(0.012, r * 0.62);
                }
                return balls;
            }
        }
    };
    // ------------------------------------------------------------


    // SUB FUNCTION | Clumps Over a Form's Faces, Largest First
    // ------------------------------------------------------------
    // A grid answers "is anything too close?", or a shell of hundreds would ask everything
    // about everything. Each clump sits a share of itself in from its spot, so the faces stay
    // flat and only its top shows as a scallop.
    // ------------------------------------------------------------
    function Na__VegBuild__ShellClumps(rng, shape, form, a, b, h, recipe, factors, ends) {
        const rules   = recipe.Asset__Clumps;
        const scallop = factors.scallop;
        const minR    = (rules.Clumps__RadiusMinMm / 1000) * scallop;
        const maxR    = (rules.Clumps__RadiusMaxMm / 1000) * scallop;
        const lapM    = (form.Form__LapMm || 0) / 1000;
        const meanR   = (minR + maxR) * 0.5;
        const target  = Math.min(Na__VegBuild__SHELL_THROWS, Math.ceil(shape.area(a, b, h) / (Math.PI * meanR * meanR * 0.7)));

        const radii = [];
        for (let k = 0; k < target; k++) radii.push(rng.skew(minR, maxR, rules.Clumps__Skew));
        radii.sort((p, q) => q - p);

        const cell  = Math.max(0.001, 2 * maxR * rules.Clumps__Spacing);
        const span  = Na__VegBuild__GRID_SPAN;
        const half  = span / 2;
        const grid  = new Map();
        const keyOf = (ix, iy, iz) => ((ix + half) * span + (iy + half)) * span + (iz + half);
        const edgeReach = form.Form__EdgeShare || 0;
        const markShare = form.Form__MarkShare || 0;
        const clumps = [];
        const spot   = { x : 0, y : 0, z : 0, nx : 0, ny : 0, nz : 0, edge : Infinity, edgeAt : 0, fit : 1 };

        for (let k = 0; k < radii.length; k++) {
            for (let tries = 0; tries < Na__VegBuild__SHELL_TRIES; tries++) {
                spot.fit = 1;
                shape.spot(rng, a, b, h, form, spot);
                const rc   = radii[k] * spot.fit;

                // WHAT THIS END MEETS | See the header
                const meets  = ends ? ends[spot.x < 0 ? 0 : 1] : Na__VegBuild__END_REAL;
                const onEnd  = Math.abs(spot.nx) > Na__VegBuild__END_FACE_NX;
                if (onEnd && meets !== Na__VegBuild__END_REAL) continue;
                const fromEnd = a - Math.abs(spot.x);
                const ramp    = (meets === Na__VegBuild__END_LAP && fromEnd < lapM) ? 1 - fromEnd / lapM : 0;

                const sink = rc * (form.Form__Inset + rng.range(-form.Form__Waver, form.Form__Waver) + ramp * Na__VegBuild__LAP_SINK);
                let cx = spot.x - spot.nx * sink;
                let cy = spot.y - spot.ny * sink;
                let cz = spot.z - spot.nz * sink;

                // A BOX'S CORNERS | A clump on one face stays within the faces next to it, or the corners bulge
                if (shape.sharp) {
                    const within = rc * form.Form__Inset;
                    cx = Math.max(within - a, Math.min(a - within, cx));
                    cy = Math.min(h - within, cy);
                    cz = Math.max(within - b, Math.min(b - within, cz));
                }
                if (cy < rc * 0.10) continue;

                const ix = Math.floor(cx / cell), iy = Math.floor(cy / cell), iz = Math.floor(cz / cell);
                let crowded = false;
                for (let dx = -1; dx <= 1 && !crowded; dx++) {
                    for (let dy = -1; dy <= 1 && !crowded; dy++) {
                        for (let dz = -1; dz <= 1 && !crowded; dz++) {
                            const list = grid.get(keyOf(ix + dx, iy + dy, iz + dz));
                            if (!list) continue;
                            for (let j = 0; j < list.length; j++) {
                                const o = list[j];
                                const gap = (rc + o.r) * rules.Clumps__Spacing;
                                const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z;
                                if (ox * ox + oy * oy + oz * oz < gap * gap) { crowded = true; break; }
                            }
                        }
                    }
                }
                if (crowded) continue;

                const onEdge = spot.edge < rc * edgeReach;
                const clump  = {
                    x : cx, y : cy, z : cz, r : rc,
                    mx : cx - spot.nx, my : cy - spot.ny, mz : cz - spot.nz,   // <-- Where a nub's "out from the mass" starts from
                    nx : spot.nx, ny : spot.ny, nz : spot.nz,
                    mark   : ramp > Na__VegBuild__LAP_MARKS ? 0 : (onEdge ? Na__VegBuild__MARK_EDGE : (rng.chance(markShare) ? Na__VegBuild__MARK_FACE : 0)),
                    markAt : onEdge ? spot.edgeAt : rng.next()
                };
                const key = keyOf(ix, iy, iz);
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(clump);
                clumps.push(clump);
                break;
            }
        }
        return clumps;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build One Clipped Plant: a Form Whose Faces Are Clumps
    // ------------------------------------------------------------
    // recipe.Asset__Form: Form__Shape (Box, Ball, Cone), Form__Inset, Form__Waver,
    // Form__EdgeShare, Form__MarkShare, and for a box Form__Batter and Form__LapMm. With
    // Form__StemHeightShare the form is a head on a clear stem, a standard: that share of the
    // height is stem.
    // ------------------------------------------------------------
    function Na__VegBuild__ClippedForm(recipe, plop, factors) {
        const rng    = Na__VegRand__Create(plop.seed);
        const size   = recipe.Asset__Size;
        const form   = Object.assign({}, Na__VegBuild__FORM_FALLBACK, recipe.Asset__Form);
        const shape  = Na__VegBuild__FORMS[form.Form__Shape] || Na__VegBuild__FORMS.Ball;
        const jitter = 1 + rng.range(-size.Size__JitterShare, size.Size__JitterShare);
        const widthM = ((plop.sizeMm ? plop.sizeMm[0] : size.Size__WidthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const depthM = ((plop.sizeMm ? plop.sizeMm[1] : size.Size__DepthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const highM  = ((plop.sizeMm ? plop.sizeMm[2] : size.Size__HeightMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const a = widthM / 2, b = depthM / 2, h = highM;

        // A HEAD ON A STEM | The form is built low and lifted, so its faces are the same sums
        const stemShare = form.Form__StemHeightShare || 0;
        const lift  = h * stemShare;
        const formH = h - lift;

        const body   = shape.body(rng, a, b, formH);
        const shell  = Na__VegBuild__ShellClumps(rng, shape, form, a, b, formH, recipe, factors, plop.ends);
        const nubs   = Na__VegBuild__ScatterNubs(rng, shell, recipe, factors);
        const facing = { nx : 0, ny : 0, nz : 0 };
        nubs.forEach((nub) => {
            shape.look(nub.x, nub.y, nub.z, a, b, formH, facing);
            nub.nx = facing.nx; nub.ny = facing.ny; nub.nz = facing.nz;
        });
        const blades = Na__VegBuild__BuildTufts(rng, recipe, a, b);
        const clumps = body.concat(shell);                                     // <-- See the header: a clump to the drawer

        if (lift > 0) {
            [clumps, nubs].forEach((list) => list.forEach((ball) => { ball.y += lift; }));
            const top   = lift + formH * 0.12;                                 // <-- Just into the head: nothing of it can be seen beyond that
            const leanX = rng.range(-0.010, 0.010), leanZ = rng.range(-0.010, 0.010);
            blades.push({
                p     : [0, 0, 0, leanX, top * 0.33, leanZ, leanX, top * 0.66, leanZ, 0, top, 0],
                w     : (form.Form__StemWidthMm || 40) / 1000,
                stem  : true
            });
        }

        // A BOX'S CORE | See the header
        let core = null;
        if (shape.sharp) {
            const back = form.Form__Inset * (recipe.Asset__Clumps.Clumps__RadiusMaxMm / 1000) + Na__VegBuild__CORE_BACK_M;
            const lapM = (form.Form__LapMm || 0) / 1000;
            const ends = plop.ends;
            core = {
                x0    : -(a - (ends && ends[0] === Na__VegBuild__END_LAP ? lapM : back)),
                x1    : a - (ends && ends[1] === Na__VegBuild__END_LAP ? lapM : back),
                y1    : Math.max(0.01, h - back),
                zFoot : Math.max(0.01, b - back),
                zTop  : Math.max(0.01, b * (1 - (form.Form__Batter || 0)) - back)
            };
        }

        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses : [], clumps, nubs, blades, a, b, h, widthM, depthM, highM, faces : true, core });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Generator
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Generators, by Name and Version
    // ------------------------------------------------------------
    // Kept in step with Vegetation__Generators__Config in Na__Vegetation__AppConfig__.json,
    // which is what the library's build util checks an asset against.
    // ------------------------------------------------------------
    const Na__VegBuild__GENERATORS = {
        BallCluster : { 1 : Na__VegBuild__Bush },
        ClippedForm : { 1 : Na__VegBuild__ClippedForm }
    };
    // ------------------------------------------------------------


    // FUNCTION | Build a Plant by the Generator Its Recipe Names
    // ------------------------------------------------------------
    // Returns null for a generator this version of the app does not have, and says
    // so: a plant saved by a newer page is left out rather than drawn wrongly.
    // ------------------------------------------------------------
    function Na__VegBuild__BuildPlant(recipe, plop, factors) {
        const named   = recipe.Asset__Generator;
        const family  = named ? Na__VegBuild__GENERATORS[named.Generator__Name] : null;
        const builder = family ? family[named.Generator__Version] : null;
        if (!builder) {
            console.warn('[TrueVision3D Vegetation] No generator for ' + recipe.Asset__Id + ': a plant was left out.');
            return null;
        }
        return builder(recipe, plop, factors);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Bush Builder API
    // ------------------------------------------------------------
    export {
        Na__VegBuild__STYLE_N,
        Na__VegBuild__CUSP_U_N,
        Na__VegBuild__TIER_MASS,
        Na__VegBuild__TIER_CLUMP,
        Na__VegBuild__TIER_NUB,
        Na__VegBuild__BuildPlant
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
