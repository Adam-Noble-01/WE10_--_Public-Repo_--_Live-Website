// =============================================================================
// TRUEVISION3D - VEGETATION - PATH MODEL
// =============================================================================
//
// FILE       : Na__Vegetation__PathModel__.js
// NAMESPACE  : Na__VegPath
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a path's rules and seed into its plants: the Linear Tool's sums
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "a quick array tool allowing for drawing and editing paths thaty
//   create vegetation like your demo, ensure each asset gets a sligtly random rot and
//   scale". So a path saves its points, its rules and one seed, and its plants are worked
//   out from those every time. They are never written to the record (plan, D16).
// - THE SAME PATH AND SEED ALWAYS DRAW THE SAME PLANTS, with no surface read: each plant
//   sits at the height the path has at that spot, and the points took their height from
//   the model when they were clicked.
// - ONE GENERATOR A PLANT, SEEDED FROM THE PATH'S SEED AND THE PLANT'S NUMBER. Plant 7 is
//   the same plant whatever plant 8 turned out to be, so dragging the end of a path leaves
//   the plants before the change exactly where they were, and only the new ones are built.
// - FITTING THE PATH. With Fit Last Plant the length is shared into whole cells close to
//   the asked-for spacing, and each plant takes the middle of its cell, so a row fills a
//   bed from end to end without hanging over either end.
// - A LONG PLANT IS A RUN, NOT A ROW OF BLOBS. An asset marked StretchAlongPath takes two
//   or three cells at a go and stretches to fit them: the length changes how many clumps
//   it has, never how big they are.
// - A ROUND PLANT TURNS FREELY, A LONG ONE KEEPS ITS LONG SIDE ALONG THE PATH. So does any
//   plant fitted to a narrow bed with Depth Across, or it would stick out of the bed.
// - A PATH'S PLANT SCALE IS THE WHOLE PLANT (Adam, 04-Nov-2026: "I would set a scale of 0.5"),
//   each palette item's own on top of it. It changes no draw, so the same plants stand in
//   the same places, smaller. Spacing is the path's own number and is what follows the
//   slider (SetPlantScale). A run still fills its cells and Depth Across and Height are
//   still real millimetres: what is smaller is the scallops.
// - A CLIPPED PLANT IS KEPT. An asset marked Clipped is a managed one, so size, height,
//   spacing, turn and side variation pass it by: every draw is still made, and left unused.
//   A clipped run stops at each corner of the path, and the two sides meet square. Between
//   corners each run laps the next, by the asset's Form__LapMm at each end. It says what its
//   two ends meet (Plop__Ends, behind and ahead along the path), and the builder sinks a lapped
//   end into the next run's fill, so the hedge has no joints.
// - ONE PLANT OF A PATH CAN BE CHANGED BY HAND (Adam, 05-Nov-2026: "Add the same right click swap for
//   vegetation too"). Vegetation__Path__PlantChanges is keyed by the plant's number, the one its uid
//   ends in: a different asset, a scale, or removed. It is laid over the plant after every draw is made,
//   so no other plant moves. A path with none draws what it drew, number for number. New Seed clears it.
//
// FRAMES:
// - Points and results are integer mm in three.js axes, as every saved value is. A turn of
//   yaw about +Y carries a plant's local x to (cos, 0, -sin), so a plant lies along a
//   heading of (dx, dz) at atan2(-dz, dx).
//
// INTEGRATION:
// - Called by ../03__System__SceneLayer/Na__Vegetation__Runtime__.js, and by
//   ../20__System__Tools/Na__Vegetation__LinearTool__.js for the proxies shown mid-drag.
// - Imports no three.js and needs no page, so it runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/01__Core__Engine/Na__Vegetation__PathModel__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.89.0)
// - A single plant of a path can be swapped, scaled or removed, with no other plant moving. Cloud
//   Sync's Python is a port of this: change both.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - Plant scale, Height, clipped plants and their corners. A path with none of them draws what
//   it drew, number for number. Cloud Sync's Python is a port of this: change both.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 5 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Seeded Numbers and Palette Draws
    // ------------------------------------------------------------
    import { Na__VegRand__Create } from './Na__Vegetation__Random__.js';
    import { Na__VegBrush__DrawItem } from './Na__Vegetation__BrushModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sampling, Limits and Runs
    // ------------------------------------------------------------
    const Na__VegPath__CURVE_STEP_MM    = 120;                                 // <-- A curve is sampled this finely before anything is laid along it
    const Na__VegPath__CURVE_MAX_STEPS  = 64;
    const Na__VegPath__MIN_SPACING_MM   = 200;                                 // <-- Below this a slip of the slider would make thousands of plants
    const Na__VegPath__MAX_PLANTS       = 1500;
    const Na__VegPath__END_SLACK        = 0.000001;                            // <-- Of a cell: a clipped run can end anywhere along one
    const Na__VegPath__CORNER_TURN_RAD  = 0.26;                                // <-- A turn of at least this (15 degrees) is a corner. A curve's samples are not
    const Na__VegPath__CORNER_SLACK_MM  = 1;
    const Na__VegPath__CORNER_MAX_TAN   = 2;                                   // <-- A very sharp point stops overshooting here
    const Na__VegPath__CLIPPED_SLIVER   = 0.5;                                 // <-- Of a cell: less than this before a corner joins the run before it
    const Na__VegPath__CLIPPED_MAX_MM   = 4000;                                // <-- A clipped run's longest, before its scale: a shell of balls costs by the square of them
    const Na__VegPath__RUN_MIN_CELLS    = 2;
    const Na__VegPath__RUN_MAX_CELLS    = 3;
    const Na__VegPath__RUN_FILL_SHARE   = 0.94;                                // <-- Runs nearly touch: a hair of gap reads as two plants, not a fence
    const Na__VegPath__RUN_MIN_WIDTH    = 0.6;                                 // <-- Of the asset's own width, when a path is too short for a whole run
    const Na__VegPath__DEG              = 180 / Math.PI;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Line Plants Are Laid Along
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Point of a Centripetal Catmull-Rom Span
    // ------------------------------------------------------------
    // Centripetal, because the plain kind overshoots and can loop where points come
    // close together, and a planter's corner is exactly that.
    // ------------------------------------------------------------
    function Na__VegPath__CurvePoint(p0, p1, p2, p3, t) {
        const knot = (a, b, last) => last + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-6, 0.5);
        const t0 = 0;
        const t1 = knot(p0, p1, t0);
        const t2 = knot(p1, p2, t1);
        const t3 = knot(p2, p3, t2);
        const at = t1 + (t2 - t1) * t;
        const out = [0, 0, 0];
        for (let k = 0; k < 3; k++) {
            const a1 = ((t1 - at) * p0[k] + (at - t0) * p1[k]) / (t1 - t0);
            const a2 = ((t2 - at) * p1[k] + (at - t1) * p2[k]) / (t2 - t1);
            const a3 = ((t3 - at) * p2[k] + (at - t2) * p3[k]) / (t3 - t2);
            const b1 = ((t2 - at) * a1 + (at - t0) * a2) / (t2 - t0);
            const b2 = ((t3 - at) * a2 + (at - t1) * a3) / (t3 - t1);
            out[k] = ((t2 - at) * b1 + (at - t1) * b2) / (t2 - t1);
        }
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Line a Path Follows, and How Far Along Each Point Is
    // ------------------------------------------------------------
    // Returns { points : [[x, y, z]...], lengths : [0, ...], total }. Straight is
    // the points themselves. Curved passes through them.
    // ------------------------------------------------------------
    function Na__VegPath__Line(pointsMm, curved) {
        const given = (pointsMm || []).filter((p) => Array.isArray(p) && p.length >= 3);
        let points = given;
        if (curved && given.length > 2) {
            points = [];
            for (let i = 0; i < given.length - 1; i++) {
                const p1 = given[i], p2 = given[i + 1];
                const p0 = i > 0 ? given[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1], 2 * p1[2] - p2[2]];
                const p3 = i + 2 < given.length ? given[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1], 2 * p2[2] - p1[2]];
                const chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
                const steps = Math.max(2, Math.min(Na__VegPath__CURVE_MAX_STEPS, Math.ceil(chord / Na__VegPath__CURVE_STEP_MM)));
                for (let s = 0; s < steps; s++) points.push(Na__VegPath__CurvePoint(p0, p1, p2, p3, s / steps));
            }
            points.push(given[given.length - 1]);
        }
        const lengths = [0];
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]);
            lengths.push(total);
        }
        return { points, lengths, total };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Line Is at a Distance Along It, and Which Way It Runs
    // ------------------------------------------------------------
    // Returns { x, y, z, dx, dz } with (dx, dz) a level unit direction. A stretch of
    // line going straight up keeps the direction of the last one that went anywhere.
    // ------------------------------------------------------------
    function Na__VegPath__AtDistance(line, distance) {
        const { points, lengths, total } = line;
        const d = Math.max(0, Math.min(total, distance));
        let i = 1;
        while (i < lengths.length - 1 && lengths[i] < d) i++;
        const a = points[i - 1], b = points[i];
        const span = lengths[i] - lengths[i - 1];
        const t = span > 0 ? (d - lengths[i - 1]) / span : 0;

        let dx = 0, dz = 0;
        for (let k = i; k >= 1 && dx === 0 && dz === 0; k--) {
            const ex = points[k][0] - points[k - 1][0], ez = points[k][2] - points[k - 1][2];
            const level = Math.hypot(ex, ez);
            if (level > 1e-6) { dx = ex / level; dz = ez / level; }
        }
        if (dx === 0 && dz === 0) dx = 1;
        return { x : a[0] + (b[0] - a[0]) * t, y : a[1] + (b[1] - a[1]) * t, z : a[2] + (b[2] - a[2]) * t, dx, dz };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plants
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Seed for One Plant, from the Path's Seed and Its Number
    // ------------------------------------------------------------
    function Na__VegPath__PlantSeed(pathSeed, number) {
        return (Math.imul((pathSeed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) + Math.imul(number + 1, 0xC2B2AE35)) >>> 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Turn in the Range -180 to 180, to a Tenth of a Degree
    // ------------------------------------------------------------
    function Na__VegPath__NeatYaw(deg) {
        let turn = deg % 360;
        if (turn > 180) turn -= 360;
        if (turn <= -180) turn += 360;
        return Math.round(turn * 10) / 10;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Next Real Corner of a Line Past a Distance
    // ------------------------------------------------------------
    // Returns { at, tan } with tan that of half the turn, which says how far past the corner a
    // run must go to close the outside of it. With none, the end of the line and no turn.
    // ------------------------------------------------------------
    function Na__VegPath__NextCorner(line, distance) {
        const { points, lengths, total } = line;
        for (let i = 1; i < points.length - 1; i++) {
            if (lengths[i] <= distance + Na__VegPath__CORNER_SLACK_MM) continue;
            const ax = points[i][0] - points[i - 1][0], az = points[i][2] - points[i - 1][2];
            const bx = points[i + 1][0] - points[i][0], bz = points[i + 1][2] - points[i][2];
            const turn = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
            if (turn >= Na__VegPath__CORNER_TURN_RAD) {
                return { at : lengths[i], tan : Math.min(Na__VegPath__CORNER_MAX_TAN, Math.tan(turn / 2)) };
            }
        }
        return { at : total, tan : 0 };
    }
    // ------------------------------------------------------------


    // FUNCTION | Set a Path's Plant Scale, or a New Path's, with Its Spacing Following
    // ------------------------------------------------------------
    // By the ratio, so half size is the same planting, smaller, and the bed stays full. Not
    // held at the minimum: PlantsFor does that, and scaling back then returns to where it was.
    // ------------------------------------------------------------
    function Na__VegPath__SetPlantScale(path, scale) {
        const was = path.Vegetation__Path__PlantScale > 0 ? path.Vegetation__Path__PlantScale : 1;
        path.Vegetation__Path__PlantScale = scale;
        path.Vegetation__Path__SpacingMm  = Math.round((path.Vegetation__Path__SpacingMm * scale) / was);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Plant of a Path
    // ------------------------------------------------------------
    // items: [{ assetId, weight, scale, recipe }], the palette's assets with their recipes
    // read. recipeOf(assetId): a swapped plant's recipe, optional, and a plant whose swap it cannot
    // find stays as drawn. Returns records in the shape of a saved plop, with the path's uid on each,
    // and an empty list for a path too short or with nothing to plant.
    // ------------------------------------------------------------
    function Na__VegPath__PlantsFor(path, items, recipeOf) {
        const usable = (items || []).filter((item) => item.recipe && (item.weight || 0) > 0);
        const line   = Na__VegPath__Line(path.Vegetation__Path__PointsMm, path.Vegetation__Path__Curved === true);
        if (usable.length === 0 || line.total <= 0) return [];

        const rules      = path.Vegetation__Path__Advanced || {};
        const pathSeed   = path.Vegetation__Path__Seed || 1;
        const spacing    = Math.max(Na__VegPath__MIN_SPACING_MM, path.Vegetation__Path__SpacingMm || Na__VegPath__MIN_SPACING_MM);
        const fit        = rules.Vegetation__PathAdvanced__FitLastPlant !== false;
        const alignAny   = rules.Vegetation__PathAdvanced__AlignToPath !== false;
        const rotVar     = rules.Vegetation__PathAdvanced__RotationVariationDeg || 0;
        const scaleVar   = (rules.Vegetation__PathAdvanced__ScaleVariationPercent || 0) / 100;
        const heightVar  = (rules.Vegetation__PathAdvanced__HeightVariationPercent || 0) / 100;
        const spaceVar   = (rules.Vegetation__PathAdvanced__SpacingVariationPercent || 0) / 100;
        const sideOffset = rules.Vegetation__PathAdvanced__SideOffsetMm || 0;
        const depthFit   = rules.Vegetation__PathAdvanced__DepthAcrossMm || 0;
        const heightFit  = rules.Vegetation__PathAdvanced__HeightFitMm || 0;
        const pathZoom   = path.Vegetation__Path__PlantScale > 0 ? path.Vegetation__Path__PlantScale : 1;
        const changes    = path.Vegetation__Path__PlantChanges || null;

        const wanted = fit ? Math.round(line.total / spacing) : Math.ceil(line.total / spacing);
        const cells  = Math.max(1, Math.min(Na__VegPath__MAX_PLANTS, wanted));
        const cell   = fit ? line.total / cells : spacing;

        const plants = [];
        let at = 0, number = 0, tanBehind = 0;
        while (at < cells - Na__VegPath__END_SLACK && number < Na__VegPath__MAX_PLANTS) {
            const rng    = Na__VegRand__Create(Na__VegPath__PlantSeed(pathSeed, number));
            const item   = Na__VegBrush__DrawItem(usable, rng.next());
            const recipe = item.recipe;
            const place  = recipe.Asset__Placement || {};
            const size   = recipe.Asset__Size;
            const isRun  = place.Placement__StretchAlongPath === true;
            const kept   = place.Placement__Clipped === true;
            const zoom   = pathZoom * (item.scale > 0 ? item.scale : 1);

            // HOW MANY CELLS IT TAKES | Drawn even when it cannot use them, so the numbers
            // that follow do not depend on how close to the end of the path this plant is
            const runWanted = rng.int(Na__VegPath__RUN_MIN_CELLS, Na__VegPath__RUN_MAX_CELLS);
            let span        = isRun ? Math.min(runWanted, cells - at) : 1;

            // A CLIPPED RUN STOPS AT A CORNER | And leaves no sliver before one
            const keptRun = kept && isRun;
            const corner  = keptRun ? Na__VegPath__NextCorner(line, at * cell) : null;
            if (keptRun) {
                const from = at * cell;
                let to = Math.min(from + span * cell, from + Na__VegPath__CLIPPED_MAX_MM * zoom, corner.at);
                if (corner.at - to < cell * Na__VegPath__CLIPPED_SLIVER) to = corner.at;
                span = Math.max((to - from) / cell, Na__VegPath__END_SLACK);
            }

            const slip = rng.range(-spaceVar, spaceVar) * cell;
            const mid  = (at + span / 2) * cell + ((isRun || kept) ? 0 : slip);
            const spot = Na__VegPath__AtDistance(line, mid);

            const drawnScale  = 1 + rng.range(-scaleVar, scaleVar);
            const drawnHigher = 1 + rng.range(-heightVar, heightVar);
            const scale  = kept ? 1 : drawnScale;                              // <-- Drawn and left, so what follows does not depend on this
            const higher = kept ? 1 : drawnHigher;
            const depthMm  = depthFit > 0 ? depthFit / zoom : size.Size__DepthMm * scale;
            const heightMm = (heightFit > 0 ? heightFit / zoom : size.Size__HeightMm) * scale * higher;

            // THE ENDS OF A CLIPPED RUN | Square round a corner, lapped along a straight, and
            // exact at the two ends of the path. A longer end moves the run's middle.
            let endBehind = 0, endAhead = 0, ends = null;
            if (keptRun) {
                const lap      = (recipe.Asset__Form ? recipe.Asset__Form.Form__LapMm || 0 : 0) * zoom;
                const halfDep  = (depthMm * zoom) / 2;
                const from     = at * cell, to = from + span * cell;
                const isStart  = from <= Na__VegPath__CORNER_SLACK_MM;
                const isFinish = to >= line.total - Na__VegPath__CORNER_SLACK_MM;
                const atCorner = !isFinish && corner.tan > 0 && to >= corner.at - Na__VegPath__CORNER_SLACK_MM;
                endBehind = isStart ? 0 : (tanBehind > 0 ? tanBehind * halfDep : lap);
                endAhead  = isFinish ? 0 : (atCorner ? corner.tan * halfDep : lap);
                ends = [
                    isStart ? 'End' : (tanBehind > 0 ? 'Corner' : 'Lap'),
                    isFinish ? 'End' : (atCorner ? 'Corner' : 'Lap')
                ];
                tanBehind = atCorner ? corner.tan : 0;
            }
            const along = (endAhead - endBehind) / 2;

            const widthMm = keptRun
                ? (span * cell + endBehind + endAhead) / zoom
                : (isRun
                    ? Math.max(size.Size__WidthMm * Na__VegPath__RUN_MIN_WIDTH, (span * cell * Na__VegPath__RUN_FILL_SHARE) / zoom)
                    : size.Size__WidthMm * scale);

            const heading = Math.atan2(-spot.dz, spot.dx) * Na__VegPath__DEG;
            const aligned = isRun || depthFit > 0 || (alignAny && place.Placement__AlignToPath === true);
            const turned  = rng.range(-rotVar, rotVar);
            const flipped = rng.chance(0.5) ? 180 : 0;                         // <-- A long plant reads the same end on, and differently from behind
            const free    = rng.range(-180, 180);
            const yawDeg  = aligned ? heading + (kept ? 0 : turned + flipped) : free;   // <-- Not flipped: a clipped run's ends are behind and ahead, in that order

            const drawnSide = rng.range(-sideOffset, sideOffset);
            const side = kept ? 0 : drawnSide;
            const x = spot.x - spot.dz * side + spot.dx * along;
            const z = spot.z + spot.dx * side + spot.dz * along;

            const plant = {
                Vegetation__Plop__Uid        : path.Vegetation__Path__Uid + '-' + String(number + 1).padStart(3, '0'),
                Vegetation__Plop__AssetId    : item.assetId,
                Vegetation__Plop__Seed       : Math.floor(rng.next() * 1000000000),
                Vegetation__Plop__PositionMm : [Math.round(x), Math.round(spot.y), Math.round(z)],
                Vegetation__Plop__YawDeg     : Na__VegPath__NeatYaw(yawDeg),
                Vegetation__Plop__SizeMm     : [Math.round(widthMm), Math.round(depthMm), Math.round(heightMm)],
                Vegetation__Plop__PathUid    : path.Vegetation__Path__Uid
            };
            if (zoom !== 1) plant.Vegetation__Plop__Scale = Math.round(zoom * 1000) / 1000;
            if (ends) plant.Vegetation__Plop__Ends = ends;

            // CHANGED BY HAND | After every draw, so what follows does not depend on this
            const change = changes ? changes[String(number + 1)] : null;
            if (change) {
                const other = change.Vegetation__PlantChange__AssetId && recipeOf ? recipeOf(change.Vegetation__PlantChange__AssetId) : null;
                if (other) {
                    const clipped = other.Asset__Placement && other.Asset__Placement.Placement__Clipped === true;
                    const otherScale  = clipped ? 1 : drawnScale;
                    const otherHigher = clipped ? 1 : drawnHigher;
                    const otherSize   = other.Asset__Size;
                    plant.Vegetation__Plop__AssetId = change.Vegetation__PlantChange__AssetId;
                    plant.Vegetation__Plop__SizeMm  = [
                        Math.round(otherSize.Size__WidthMm * otherScale),
                        Math.round(depthFit > 0 ? depthFit / zoom : otherSize.Size__DepthMm * otherScale),
                        Math.round((heightFit > 0 ? heightFit / zoom : otherSize.Size__HeightMm) * otherScale * otherHigher)
                    ];
                    delete plant.Vegetation__Plop__Ends;
                }
                if (change.Vegetation__PlantChange__Scale > 0) {
                    const hand = Math.round(zoom * change.Vegetation__PlantChange__Scale * 1000) / 1000;
                    if (hand !== 1) plant.Vegetation__Plop__Scale = hand;
                    else delete plant.Vegetation__Plop__Scale;
                }
            }
            if (!(change && change.Vegetation__PlantChange__Removed === true)) plants.push(plant);

            at += span;
            number++;
        }
        return plants;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Screen-Free Point Is from a Line, and Where the Nearest Is
    // ------------------------------------------------------------
    // Which of a path's given points does a new point belong between? Measured in
    // plan, since that is what the click was about. Returns the index to insert at.
    // ------------------------------------------------------------
    function Na__VegPath__InsertIndex(pointsMm, point) {
        let best = 1, bestSq = Infinity;
        for (let i = 1; i < pointsMm.length; i++) {
            const a = pointsMm[i - 1], b = pointsMm[i];
            const ex = b[0] - a[0], ez = b[2] - a[2];
            const lengthSq = ex * ex + ez * ez;
            const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * ex + (point[2] - a[2]) * ez) / lengthSq)) : 0;
            const nx = a[0] + ex * t - point[0], nz = a[2] + ez * t - point[2];
            const distanceSq = nx * nx + nz * nz;
            if (distanceSq < bestSq) { bestSq = distanceSq; best = i; }
        }
        return best;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Path Model API
    // ------------------------------------------------------------
    export {
        Na__VegPath__Line,
        Na__VegPath__AtDistance,
        Na__VegPath__SetPlantScale,
        Na__VegPath__PlantsFor,
        Na__VegPath__InsertIndex
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
