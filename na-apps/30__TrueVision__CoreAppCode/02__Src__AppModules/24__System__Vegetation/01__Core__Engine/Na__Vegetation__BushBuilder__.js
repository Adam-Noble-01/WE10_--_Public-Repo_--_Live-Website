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
// - FOUR MORE HABITS (v1.2.0, Adam's reference photos of a border, 17-Nov-2026), each a
//   generator of its own beside BallCluster, which is left alone:
//     FloweringMound  a leafy mound carrying flower heads (a hydrangea): Asset__Heads.
//     SpikedClump     a cushion of foliage, flower spikes on stems above it (lavender): Asset__Spikes.
//     GrassFountain   blades only, arching out of a tight crown (a grass): Asset__Fountain.
//     MultiStem       clear stems from one foot into an open canopy (an amelanchier): Asset__Stems.
// - WHAT A BALL MAY CARRY FOR THEM (v1.2.0). polar: its own chain of arcs, so a flower head's
//   edge is fine florets where a leaf clump's is scallops. noCusps: no hooks from its cusps. ink:
//   its outline is drawn whole inside the plant, at the inner weight, where an ordinary clump's
//   inner lines are thinned to a few arcs: a flower head shows its round against the leaves, a
//   lavender spike shows in front of its cushion. lodR: the radius an inked ball's screen size is
//   judged by, so a spike's whorls leave the drawing together. All four are read by Assemble only
//   when present, so BallCluster's and ClippedForm's plants are unchanged, by the engine hash.
// - STEMS MOVE WITH WHAT THEY CARRY. Assemble fits ball centres to the plop's size and leaves
//   blades as they are, right for a tuft at the foot. A stem ending in a spike or a mass is fitted
//   by the same sums first (FitAhead), so it still meets it in a stretched or narrowed plant.
// - bush.bladesUnder says a flat picture with no depth test (a card) must paint the blades first
//   and the balls' fill over them: stems and a grass's blades grow from inside the plant.
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
// 17-Nov-2026 - Version 1.2.0 (ValeVision3D v2.99.0, TrueVision3D v2.189.0)
// - FloweringMound, SpikedClump, GrassFountain and MultiStem, version 1 each, and what a ball
//   may carry for them (polar, noCusps, ink, lodR), a head's mark (parts.marked) and
//   bladesUnder: see the header. Assemble reads the new fields only when present: the engine
//   hash of the eleven assets before them is unchanged (39fd60a48826a363a509bfa9158494a0).
//
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
    // parts: { masses, clumps, nubs, blades, a, b, h, widthM, depthM, highM, faces, core, bladesUnder }.
    // What every generator ends with, and from here on it draws random numbers for each ball in
    // turn, so nothing may be added above a draw. A ball may carry nx, ny, nz, the way its face
    // looks, and mark and markAt, how far in its mark is and where round the ball. From v1.2.0 a
    // clump or nub may also carry polar (its own chain of arcs, as FillPolar's rules, in place
    // of its tier's), noCusps (no hooks from its cusps) and ink (its outline is drawn inside the
    // plant too): see the header. BallCluster and ClippedForm set none of them.
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
        clumps.forEach((m) => all.push({ tier : Na__VegBuild__TIER_CLUMP, x : m.x, y : m.y, z : m.z, r : m.r, nx : m.nx, ny : m.ny, nz : m.nz, mark : m.mark, markAt : m.markAt, polar : m.polar, noCusps : m.noCusps, ink : m.ink, lodR : m.lodR }));
        nubs.forEach((m) => all.push({ tier : Na__VegBuild__TIER_NUB, x : m.x, y : m.y, z : m.z, r : m.r, nx : m.nx, ny : m.ny, nz : m.nz, polar : m.polar, ink : m.ink, lodR : m.lodR }));
        const anyInk = all.some((m) => m.ink === true);
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
            marks    : (parts.faces || parts.marked) ? new Float32Array(n) : null,   // <-- v1.2.0: marked, a flower head's mark without a clipped face
            ink      : anyInk ? new Uint8Array(n) : null,                      // <-- v1.2.0: see the header. Null on every plant before it
            inkLodR  : anyInk ? new Float32Array(n) : null,                    // <-- v1.2.0: the radius an inked ball's screen size is judged by: a spike's whorls go together
            bladesUnder : parts.bladesUnder === true,                          // <-- v1.2.0: a flat picture paints the blades first, then the balls over them
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

            // A CLUMP'S CHAIN IS SHORT AND SHALLOW; A NUB IS PLAIN | Sizes are per ball, not per bush.
            // A ball carrying its own chain (v1.2.0) takes that instead
            const rules = m.polar ? m.polar : ((m.tier === Na__VegBuild__TIER_MASS) ? massRules : (m.tier === Na__VegBuild__TIER_CLUMP
                ? { chordMinM : m.r * 0.85, chordMaxM : m.r * 1.9, depth : clumpDepth, skew : 1.0, tipShare : clumpTips, ellipse : clumpEll, wobble : clumpWob }
                : { chordMinM : m.r * 2.4, chordMaxM : m.r * 4.0, depth : 0.02, skew : 1.0, tipShare : 0, ellipse : clumpEll, wobble : clumpWob }));
            const span = Na__VegBuild__FillPolar(rng, bush.polar, bush.polStart[i], bush.polN[i], m.r, rules);
            bush.rMax[i] = m.r * zoom * span.max;
            bush.rMin[i] = m.r * zoom * span.min;

            bush.cuspFrom[i] = cuspList.length;
            if (m.tier !== Na__VegBuild__TIER_NUB && m.noCusps !== true) {
                span.cusps.forEach((angle) => cuspList.push(angle));
            }
            if (m.ink === true) {
                bush.ink[i]     = 1;
                bush.inkLodR[i] = (m.lodR > 0 ? m.lodR : m.r) * zoom;
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
// REGION | Flowering Mounds, Spiked Clumps, Grass Fountains and Multi-Stems (v1.2.0)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Four Habits Added at v1.2.0
    // ------------------------------------------------------------
    const Na__VegBuild__HEAD_TRIES    = 30;                                    // <-- A head gives up after this many spots on a crowded mound
    const Na__VegBuild__HEAD_CLEAR    = 0.35;                                  // <-- Of a leaf clump's radius: one reaching further into a head would lie across it, and goes
    const Na__VegBuild__HEAD_MARK     = 0.38;                                  // <-- How far in from a head's outline its mark lies, as a share of its radius
    const Na__VegBuild__WHORL_TIP     = 0.62;                                  // <-- A spike's top whorl, as a share of its bottom one
    const Na__VegBuild__WHORL_WANDER  = 0.12;                                  // <-- Of a whorl's radius: a spike is never ruled
    const Na__VegBuild__STEM_INTO     = 0.8;                                   // <-- Of the bottom whorl's radius: a stem ends up inside its spike
    const Na__VegBuild__BRANCH_WIDTH  = 0.55;                                  // <-- A side branch, as a share of its stem
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Plop's Size in Metres, as Bush Works It Out
    // ------------------------------------------------------------
    // One jitter draw, as BallCluster's opening, so every habit starts the same way.
    // ------------------------------------------------------------
    function Na__VegBuild__SizeOf(rng, recipe, plop) {
        const size   = recipe.Asset__Size;
        const jitter = 1 + rng.range(-size.Size__JitterShare, size.Size__JitterShare);
        const widthM = ((plop.sizeMm ? plop.sizeMm[0] : size.Size__WidthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const depthM = ((plop.sizeMm ? plop.sizeMm[1] : size.Size__DepthMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        const highM  = ((plop.sizeMm ? plop.sizeMm[2] : size.Size__HeightMm) / 1000) * (plop.sizeMm ? 1 : jitter);
        return { widthM, depthM, highM, a : widthM / 2, b : depthM / 2, h : highM };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fit Assemble Will Make, Worked Out Ahead
    // ------------------------------------------------------------
    // Assemble pulls ball centres in to the plop's size and leaves blades as they are, which is
    // right for a tuft at the foot. A stem that ends in a spike or a mass must move with it, so
    // these generators fit their stems by the same sums first. Draws nothing.
    // ------------------------------------------------------------
    function Na__VegBuild__FitAhead(lists, a, b, h) {
        let maxX = 0.001, maxZ = 0.001, maxY = 0.001;
        lists.forEach((list) => list.forEach((m) => {
            maxX = Math.max(maxX, Math.abs(m.x) + m.r);
            maxZ = Math.max(maxZ, Math.abs(m.z) + m.r);
            maxY = Math.max(maxY, m.y + m.r);
        }));
        return { x : a / maxX, y : h / maxY, z : b / maxZ };
    }
    function Na__VegBuild__FitBlades(blades, fit) {
        blades.forEach((blade) => {
            for (let k = 0; k < 4; k++) {
                blade.p[k * 3]     *= fit.x;
                blade.p[k * 3 + 1] *= fit.y;
                blade.p[k * 3 + 2] *= fit.z;
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Point on a Blade's Centre Line (cubic, t from 0 at the foot to 1)
    // ------------------------------------------------------------
    function Na__VegBuild__BladeAt(p, t) {
        const m = 1 - t;
        const c0 = m * m * m, c1 = 3 * m * m * t, c2 = 3 * m * t * t, c3 = t * t * t;
        return {
            x : c0 * p[0] + c1 * p[3] + c2 * p[6] + c3 * p[9],
            y : c0 * p[1] + c1 * p[4] + c2 * p[7] + c3 * p[10],
            z : c0 * p[2] + c1 * p[5] + c2 * p[8] + c3 * p[11]
        };
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Flower Heads Over a Mound's Masses, Kept Apart
    // ------------------------------------------------------------
    // A head is a clump with its own fine chain (florets, not leaves), no hooks, and inked: its
    // whole round shows against the leaves behind it, as a drawn flower head does. Thrown before
    // the leaves, so the leaves fill round the heads.
    // ------------------------------------------------------------
    function Na__VegBuild__ScatterHeads(rng, masses, recipe, factors, h) {
        const rules = recipe.Asset__Heads;
        const count = rng.int(rules.Heads__CountMin, rules.Heads__CountMax);
        const lowY  = h * rules.Heads__LowShare;                               // <-- Flowers are carried high: none under this
        const polar = {
            chordMinM : (rules.Heads__ScallopChordMinMm / 1000) * factors.scallop,
            chordMaxM : (rules.Heads__ScallopChordMaxMm / 1000) * factors.scallop,
            depth     : rules.Heads__ScallopDepth,
            skew      : 1.0,
            tipShare  : 0,
            ellipse   : rules.Heads__Ellipse,
            wobble    : 0.02
        };
        const heads = [];

        for (let k = 0; k < count; k++) {
            const rh = rng.range(rules.Heads__RadiusMinMm, rules.Heads__RadiusMaxMm) / 1000;
            for (let tries = 0; tries < Na__VegBuild__HEAD_TRIES; tries++) {
                const m     = masses[Math.floor(rng.next() * masses.length)];
                const up    = rng.range(rules.Heads__UpMin, 1.0);              // <-- Heads face out and up, never down into the plant
                const az    = rng.angle();
                const s     = Math.sqrt(Math.max(0, 1 - up * up));
                const reach = m.r * rng.range(rules.Heads__ReachMin, rules.Heads__ReachMax);
                const cx = m.x + Math.cos(az) * s * reach;
                const cy = m.y + up * reach;
                const cz = m.z + Math.sin(az) * s * reach;
                if (cy < Math.max(rh * 0.8, lowY)) continue;                   // <-- A head is carried, never on the ground

                let clear = true;
                for (let j = 0; j < masses.length && clear; j++) {             // <-- Buried in another mass: never seen
                    const o = masses[j];
                    if (o === m) continue;
                    const dx = cx - o.x, dy = cy - o.y, dz = cz - o.z;
                    if (dx * dx + dy * dy + dz * dz < (o.r * 0.84) * (o.r * 0.84)) clear = false;
                }
                for (let j = 0; j < heads.length && clear; j++) {              // <-- Heads touch, but never sit on one another
                    const o = heads[j];
                    const gap = (rh + o.r) * rules.Heads__Spacing;
                    const dx = cx - o.x, dy = cy - o.y, dz = cz - o.z;
                    if (dx * dx + dy * dy + dz * dz < gap * gap) clear = false;
                }
                if (!clear) continue;

                const mark = rng.chance(rules.Heads__MarkShare) ? Na__VegBuild__HEAD_MARK : 0;   // <-- An arc inside the head: the dome of its florets
                heads.push({ x : cx, y : cy, z : cz, r : rh, mx : m.x, my : m.y, mz : m.z, polar, noCusps : true, ink : true, mark, markAt : rng.next() });
                break;
            }
        }
        return heads;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Flowering Mound: Leaves, and Flower Heads Carried Over Them
    // ------------------------------------------------------------
    // FloweringMound version 1 (v1.2.0). BallCluster's masses and leaf clumps, with
    // Asset__Heads: a hydrangea, a rose, a peony. Its leaves' clumps take Asset__Clumps, so tips
    // there read as pointed leaves.
    // ------------------------------------------------------------
    function Na__VegBuild__FloweringMound(recipe, plop, factors) {
        const rng = Na__VegRand__Create(plop.seed);
        const { a, b, h, widthM, depthM, highM } = Na__VegBuild__SizeOf(rng, recipe, plop);

        const masses = recipe.Asset__Masses.Masses__Layout === 'Upright'
            ? Na__VegBuild__MassesUpright(rng, a, b, h, recipe.Asset__Masses)
            : Na__VegBuild__MassesMound(rng, a, b, h, recipe.Asset__Masses);
        const heads  = Na__VegBuild__ScatterHeads(rng, masses, recipe, factors, h);
        const clear  = Na__VegBuild__HEAD_CLEAR;
        const leaves = Na__VegBuild__ScatterClumps(rng, masses, recipe, factors).filter((c) => !heads.some((hd) => {
            const dx = c.x - hd.x, dy = c.y - hd.y, dz = c.z - hd.z, reach = hd.r + c.r * clear;
            return dx * dx + dy * dy + dz * dz < reach * reach;
        }));
        const nubs   = Na__VegBuild__ScatterNubs(rng, leaves, recipe, factors);
        const blades = Na__VegBuild__BuildTufts(rng, recipe, a, b);

        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses, clumps : leaves.concat(heads), nubs, blades, a, b, h, widthM, depthM, highM, marked : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Spiked Clump: a Cushion of Foliage, Flower Spikes on Stems Above It
    // ------------------------------------------------------------
    // SpikedClump version 1 (v1.2.0): lavender, and salvia, catmint or veronica by their own
    // numbers. The cushion is BallCluster's mound at Spikes__CushionWidthShare and
    // __CushionHeightShare of the plant. Each spike is a stem from inside the cushion and a
    // column of whorls at its top: small inked clumps, so a spike shows in front of the leaves.
    // The spikes stand tallest in the middle and lean out and lower to the edge, so together
    // they make the dome a lavender's flowers make. The stems are fitted with the balls.
    // ------------------------------------------------------------
    function Na__VegBuild__SpikedClump(recipe, plop, factors) {
        const rng   = Na__VegRand__Create(plop.seed);
        const { a, b, h, widthM, depthM, highM } = Na__VegBuild__SizeOf(rng, recipe, plop);
        const rules = recipe.Asset__Spikes;

        // THE CUSHION
        const ca = a * rules.Spikes__CushionWidthShare;
        const cb = b * rules.Spikes__CushionWidthShare;
        const ch = h * rules.Spikes__CushionHeightShare;
        const masses = Na__VegBuild__MassesMound(rng, ca, cb, ch, recipe.Asset__Masses);
        const clumps = Na__VegBuild__ScatterClumps(rng, masses, recipe, factors);
        const nubs   = Na__VegBuild__ScatterNubs(rng, clumps, recipe, factors);
        const tufts  = Na__VegBuild__BuildTufts(rng, recipe, a, b);

        // THE SPIKES
        const whorls = [], stems = [];
        const count  = rng.int(rules.Spikes__CountMin, rules.Spikes__CountMax);
        const depth  = rules.Spikes__WhorlScallopDepth;
        for (let k = 0; k < count; k++) {
            const az   = rng.angle();
            const out  = Math.sqrt(rng.next());                                // <-- 0 in the middle to 1 at the edge, even over the clump
            const turn = az + rng.range(-0.30, 0.30);

            // THE FOOT | Just under the cushion's top, so only what stands above it shows, and
            // spread over it, or the stems meet in one dark knot on a far plant
            const footR = out * 0.70;
            const fx = Math.cos(az) * ca * footR, fz = Math.sin(az) * cb * footR;
            const fy = ch * 0.88 * Math.sqrt(1 - footR * footR);

            // THE TIP | Further out and lower the further out it is
            const tipR = out * rules.Spikes__Splay * rng.range(0.85, 1.05);
            const tx = Math.cos(turn) * a * tipR, tz = Math.sin(turn) * b * tipR;
            const ty = h * (1 - (1 - rules.Spikes__TopMinShare) * Math.pow(out, 1.6) * rng.range(0.7, 1.0));

            // THE SPIKE'S AXIS | More upright than the line from the foot: a flower stands up
            let ax = (tx - fx) * 0.55, ay = ty - fy, az3 = (tz - fz) * 0.55;
            const al = Math.hypot(ax, ay, az3) || 1;
            ax /= al; ay /= al; az3 /= al;
            const length = rng.range(rules.Spikes__LengthMinMm, rules.Spikes__LengthMaxMm) / 1000;
            const rBase  = rng.range(rules.Spikes__WhorlRadiusMinMm, rules.Spikes__WhorlRadiusMaxMm) / 1000;
            const n      = Math.max(3, Math.ceil(length / (rBase * rules.Spikes__WhorlStepShare)));
            const bx = tx - ax * length, by = ty - ay * length, bz = tz - az3 * length;

            for (let j = 0; j < n; j++) {
                const t  = (j + 0.5) / n;
                const rj = rBase * (1 - (1 - Na__VegBuild__WHORL_TIP) * (j / Math.max(1, n - 1)));
                whorls.push({
                    x : bx + ax * length * t + rng.range(-Na__VegBuild__WHORL_WANDER, Na__VegBuild__WHORL_WANDER) * rj,
                    y : by + ay * length * t,
                    z : bz + az3 * length * t + rng.range(-Na__VegBuild__WHORL_WANDER, Na__VegBuild__WHORL_WANDER) * rj,
                    r : rj,
                    mx : fx, my : fy, mz : fz,
                    polar : { chordMinM : rj * 0.9, chordMaxM : rj * 1.7, depth, skew : 1.0, tipShare : 0.25, ellipse : 0.08, wobble : 0.02 },
                    noCusps : true,
                    ink : true,
                    lodR : rBase                                               // <-- The spike leaves the drawing whole, never tip first
                });
            }

            // THE STEM | Up out of the cushion, then along the spike's axis into its bottom whorl
            const ex = bx + ax * rBase * Na__VegBuild__STEM_INTO, ey = by + ay * rBase * Na__VegBuild__STEM_INTO, ez = bz + az3 * rBase * Na__VegBuild__STEM_INTO;
            const reach = Math.hypot(ex - fx, ey - fy, ez - fz);
            stems.push({
                p : [
                    fx, fy, fz,
                    fx, fy + reach * 0.40, fz,
                    ex - ax * reach * 0.30, ey - ay * reach * 0.30, ez - az3 * reach * 0.30,
                    ex, ey, ez
                ],
                w : (rules.Spikes__StemWidthMm / 1000) * rng.range(0.85, 1.15),
                stem : true
            });
        }

        const balls = clumps.concat(whorls);
        Na__VegBuild__FitBlades(stems, Na__VegBuild__FitAhead([masses, balls, nubs], a, b, h));
        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses, clumps : balls, nubs, blades : tufts.concat(stems), a, b, h, widthM, depthM, highM, bladesUnder : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Grass Fountain: Blades Arching Out of a Tight Crown
    // ------------------------------------------------------------
    // GrassFountain version 1 (v1.2.0). No balls at all: Asset__Fountain's blades, each a true
    // 3D curve, the ones in the middle near upright and tallest, the ones at the edge arching
    // out and over, their tips falling. The masses, clumps and nubs blocks are not read.
    // ------------------------------------------------------------
    function Na__VegBuild__GrassFountain(recipe, plop, factors) {
        const rng   = Na__VegRand__Create(plop.seed);
        const { a, b, h, widthM, depthM, highM } = Na__VegBuild__SizeOf(rng, recipe, plop);
        const rules = recipe.Asset__Fountain;
        const crown = rules.Fountain__CrownShare;
        const count = rng.int(rules.Fountain__BladesMin, rules.Fountain__BladesMax);
        const blades = [];

        for (let k = 0; k < count; k++) {
            const az    = rng.angle();
            const rho   = Math.sqrt(rng.next());
            const fx    = Math.cos(az) * a * crown * rho, fz = Math.sin(az) * b * crown * rho;
            const arch  = Math.min(1, Math.pow(rng.next(), 1.1) * 0.85 + rho * 0.30);    // <-- 0 upright, 1 arching right over: more of it at the crown's edge
            const tall  = h * rng.range(rules.Fountain__HeightMinShare, 1.0) * (1 - 0.22 * arch);
            const head  = az + rng.range(-0.55, 0.55);                         // <-- Out, more or less, from where it grows
            const reach = rules.Fountain__ReachMinShare + (rules.Fountain__ReachMaxShare - rules.Fountain__ReachMinShare) * arch;
            const rx    = Math.cos(head) * a * (1 - crown) * reach;
            const rz    = Math.sin(head) * b * (1 - crown) * reach;
            const droop = rules.Fountain__DroopMaxShare - (rules.Fountain__DroopMaxShare - rules.Fountain__DroopMinShare) * arch;
            const knee  = rng.range(0.25, 0.45);                               // <-- Where along it the blade tops out: nearer the crown, so the rest hangs
            blades.push({
                p : [
                    fx, 0, fz,
                    fx + rx * 0.02, tall * 0.60, fz + rz * 0.02,
                    fx + rx * knee, tall * 1.04, fz + rz * knee,
                    fx + rx, tall * droop, fz + rz
                ],
                w : (rules.Fountain__BladeWidthMm / 1000) * rng.range(0.8, 1.2)
            });
        }
        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses : [], clumps : [], nubs : [], blades, a, b, h, widthM, depthM, highM, bladesUnder : true });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Masses of a Multi-Stem's Canopy (a vase: wider the higher it goes)
    // ------------------------------------------------------------
    function Na__VegBuild__MassesVase(rng, a, b, h, base, rules) {
        const masses = [];
        const count  = rng.int(rules.Masses__CountMin, rules.Masses__CountMax);
        const span   = h - base;
        const big    = Math.min(span * 0.42, Math.max(a, b) * 0.55);

        // A CROWN OFF CENTRE | Or the top is a dome on a stick
        const crownR = big * rng.range(0.55, 0.70);
        masses.push({ x : rng.range(-0.25, 0.25) * a, y : h - crownR * rng.range(0.98, 1.04), z : rng.range(-0.20, 0.20) * b, r : crownR });

        // A HEART | Near the middle and below the crown, so no seed leaves a hole through the canopy
        const heartR = big * rng.range(0.50, 0.60);
        masses.push({ x : rng.range(-0.12, 0.12) * a, y : base + span * rng.range(0.40, 0.50), z : rng.range(-0.12, 0.12) * b, r : heartR });

        // THE REST | Round them, in two loose tiers, further out the higher they are: an open
        // canopy with gaps the stems show through, never one ball
        const start = rng.angle();
        for (let k = 2; k < count; k++) {
            const az  = start + (Na__VegBuild__TAU * (k - 1) * 1.618) + rng.range(-0.35, 0.35);   // <-- A golden turn: no two tiers line up
            const up  = (k % 2 === 1) ? rng.range(0.45, 0.95) : rng.range(0.0, 0.45);
            const r   = big * rng.range(0.34, 0.50) * (0.85 + 0.25 * up);
            const out = (0.30 + 0.65 * up) * rng.range(0.85, 1.05);            // <-- Narrow low, wide high: a vase, with no hole in its middle
            masses.push({
                x : Math.cos(az) * Math.max(0, a - r) * out,
                y : base + r * 0.7 + Math.max(0, span - r * 1.7) * up,
                z : Math.sin(az) * Math.max(0, b - r) * out,
                r
            });
        }
        return masses;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The Stems of a Multi-Stem, from a Tight Foot into the Canopy
    // ------------------------------------------------------------
    // The first goes up the middle into the heart, the rest fan out to the masses round it in
    // turn, each rising steeply and then leaning out to its mass, and some fork a side branch into
    // another. A stem ends in the lower half of its mass, where the leaves cover it.
    // ------------------------------------------------------------
    function Na__VegBuild__BuildStems(rng, masses, rules, a, b) {
        const stems  = [];
        const count  = rng.int(rules.Stems__CountMin, rules.Stems__CountMax);
        const heart  = masses.length > 1 ? masses[1] : masses[0];
        const around = masses.slice(2).sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x));
        if (around.length === 0) around.push(heart);
        const first  = rng.int(0, around.length - 1);

        for (let k = 0; k < count; k++) {
            const m     = k === 0 ? heart : around[(first + Math.floor(((k - 1) * around.length) / Math.max(1, count - 1))) % around.length];
            const az    = Math.atan2(m.z, m.x) + rng.range(-0.5, 0.5);
            const footR = rng.range(0.15, 1.0) * rules.Stems__FootSpreadShare;
            const fx    = Math.cos(az) * a * footR, fz = Math.sin(az) * b * footR;
            const tx    = m.x + rng.range(-0.3, 0.3) * m.r;
            const ty    = m.y - m.r * rng.range(0.20, 0.45);
            const tz    = m.z + rng.range(-0.3, 0.3) * m.r;
            const width = rng.range(rules.Stems__WidthMinMm, rules.Stems__WidthMaxMm) / 1000;
            const sway  = rng.range(-0.18, 0.18);
            const dx = tx - fx, dz = tz - fz;
            const p = [
                fx, 0, fz,
                fx + dx * 0.10, ty * 0.38, fz + dz * 0.10,
                fx + dx * 0.55 - dz * sway, ty * 0.72, fz + dz * 0.55 + dx * sway,
                tx, ty, tz
            ];
            stems.push({ p, w : width, stem : true });

            // A SIDE BRANCH | From part way up, into the next mass round
            if (rng.chance(rules.Stems__BranchShare) && masses.length > 1) {
                const from = Na__VegBuild__BladeAt(p, rng.range(0.45, 0.70));
                const o    = around[(around.indexOf(m) + (rng.chance(0.5) ? 1 : around.length - 1)) % around.length] || masses[0];
                const ox   = o.x + rng.range(-0.3, 0.3) * o.r, oy = o.y - o.r * rng.range(0.0, 0.3), oz = o.z + rng.range(-0.3, 0.3) * o.r;
                stems.push({
                    p : [
                        from.x, from.y, from.z,
                        from.x + (ox - from.x) * 0.30, from.y + (oy - from.y) * 0.45, from.z + (oz - from.z) * 0.30,
                        from.x + (ox - from.x) * 0.70, from.y + (oy - from.y) * 0.85, from.z + (oz - from.z) * 0.70,
                        ox, oy, oz
                    ],
                    w : width * Na__VegBuild__BRANCH_WIDTH,
                    stem : true
                });
            }
        }
        return stems;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Multi-Stem: Clear Stems from the Ground into an Open Canopy
    // ------------------------------------------------------------
    // MultiStem version 1 (v1.2.0): an amelanchier, a dogwood, a birch grown as a multi-stem.
    // The canopy is BallCluster's clumps on masses laid out as a vase from
    // Stems__CanopyBaseShare of the height (Masses__Layout 'Vase'), and Asset__Stems' stems
    // run up into it, fitted with the balls.
    // ------------------------------------------------------------
    function Na__VegBuild__MultiStem(recipe, plop, factors) {
        const rng   = Na__VegRand__Create(plop.seed);
        const { a, b, h, widthM, depthM, highM } = Na__VegBuild__SizeOf(rng, recipe, plop);
        const rules = recipe.Asset__Stems;
        const base  = h * rules.Stems__CanopyBaseShare;

        const masses = Na__VegBuild__MassesVase(rng, a, b, h, base, recipe.Asset__Masses);
        const clumps = Na__VegBuild__ScatterClumps(rng, masses, recipe, factors);
        const nubs   = Na__VegBuild__ScatterNubs(rng, clumps, recipe, factors);
        const tufts  = Na__VegBuild__BuildTufts(rng, recipe, a, b);
        const stems  = Na__VegBuild__BuildStems(rng, masses, rules, a, b);

        Na__VegBuild__FitBlades(stems, Na__VegBuild__FitAhead([masses, clumps, nubs], a, b, h));
        return Na__VegBuild__Assemble(rng, recipe, plop, factors, { masses, clumps, nubs, blades : tufts.concat(stems), a, b, h, widthM, depthM, highM, bladesUnder : true });
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
        BallCluster    : { 1 : Na__VegBuild__Bush },
        ClippedForm    : { 1 : Na__VegBuild__ClippedForm },
        FloweringMound : { 1 : Na__VegBuild__FloweringMound },
        SpikedClump    : { 1 : Na__VegBuild__SpikedClump },
        GrassFountain  : { 1 : Na__VegBuild__GrassFountain },
        MultiStem      : { 1 : Na__VegBuild__MultiStem }
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
