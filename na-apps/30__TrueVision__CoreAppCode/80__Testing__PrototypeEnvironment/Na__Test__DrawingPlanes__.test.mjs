// =============================================================================
// TRUEVISION3D - TEST - DRAWING PLANES - MATHS
// =============================================================================
//
// FILE       : Na__Test__DrawingPlanes__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Drawing Planes Maths Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the snap is absolute, the drag only travels along the normal, the ground is found under PS01's slab and under a slope, and the two record solves land where they say
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The maths module imports nothing, so it runs here exactly as the app runs
//   it. Node 20 reads the app's .js modules as CommonJS, so the module is
//   copied to a temporary .mjs first.
// - THE FIXTURE IS PS01. Its landscape is a slab 80 m square from y = -5 to
//   y = +0.05, under a house standing between x 9.6 and 20.4; its three
//   elevations all pass through (20 000, -20 000); its two plans are floor
//   level 0 with cuts of 1 600 and 6 000.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DrawingPlanes__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the Drawing Planes build.
//
// =============================================================================

import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SYSTEM     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '47__System__DrawingPlanes');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-planes-'));
    copyFileSync(join(SYSTEM, 'Na__DrawingPlanes__Maths__.js'), join(SCRATCH, 'Maths.mjs'));
    const maths = await import(pathToFileURL(join(SCRATCH, 'Maths.mjs')).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    function near(a, b, tolerance) { return Math.abs(a - b) <= (tolerance === undefined ? 1e-9 : tolerance); }


    // THE SNAP GRID
    // ------------------------------------------------------------
    console.log('\nThe snap grid');
    check('50 mm: 20 013 lands on 20 000',            maths.Na__PlaneMath__ToIncrement(20013, 50) === 20000);
    check('50 mm: 20 026 lands on 20 050',            maths.Na__PlaneMath__ToIncrement(20026, 50) === 20050);
    check('10 mm: 1 234 lands on 1 230',              maths.Na__PlaneMath__ToIncrement(1234, 10) === 1230);
    check('500 mm: 1 249 lands on 1 000',             maths.Na__PlaneMath__ToIncrement(1249, 500) === 1000);
    check('500 mm: 1 250 lands on 1 500',             maths.Na__PlaneMath__ToIncrement(1250, 500) === 1500);
    check('negative side of the origin: -20 013 -> -20 000', maths.Na__PlaneMath__ToIncrement(-20013, 50) === -20000);
    check('never a negative zero',                    Object.is(maths.Na__PlaneMath__ToIncrement(-12, 50), 0));
    check('a bad increment rounds to the millimetre', maths.Na__PlaneMath__ToIncrement(12.6, 0) === 13);
    check('snap off still rounds to the millimetre',  maths.Na__PlaneMath__ApplySnap(1234.567, { enabled : false, incrementMm : 50 }) === 1235);
    check('snap on uses the increment',               maths.Na__PlaneMath__ApplySnap(1234.567, { enabled : true, incrementMm : 50 }) === 1250);

    // ABSOLUTE, NOT RELATIVE | The whole point. A plane off the grid, dragged
    // by exactly one increment, must land ON the grid - not one increment from
    // where it started.
    const startOffGrid = 20013;
    const draggedBy    = 50;
    check('a drag snaps the POSITION, not the distance dragged',
        maths.Na__PlaneMath__ApplySnap(startOffGrid + draggedBy, { enabled : true, incrementMm : 50 }) === 20050,
        maths.Na__PlaneMath__ApplySnap(startOffGrid + draggedBy, { enabled : true, incrementMm : 50 }));

    check('millimetres are written with their thousands grouped', maths.Na__PlaneMath__FormatMm(20000) === '20 000' && maths.Na__PlaneMath__FormatMm(-1250.4) === '-1 250' && maths.Na__PlaneMath__FormatMm(950) === '950');

    const list = [10, 25, 50, 100, 250, 500];
    check('stepper: up from 50 is 100',               maths.Na__PlaneMath__StepInList(list, 50, +1) === 100);
    check('stepper: down from 50 is 25',              maths.Na__PlaneMath__StepInList(list, 50, -1) === 25);
    check('stepper: stops at 500',                    maths.Na__PlaneMath__StepInList(list, 500, +1) === 500);
    check('stepper: stops at 10',                     maths.Na__PlaneMath__StepInList(list, 10, -1) === 10);
    check('a stored 60 comes back as 50',             maths.Na__PlaneMath__NearestInList(list, 60) === 50);
    // ------------------------------------------------------------


    // THE DRAG SOLVE
    // ------------------------------------------------------------
    console.log('\nThe drag solve');
    // An east-facing plane's normal is +X. A camera at (0, 10, 30) looking
    // down -Z at a point 3 m along the axis must report 3.
    const axisOrigin = { x : 0, y : 2, z : 0 };
    const axisDir    = { x : 1, y : 0, z : 0 };
    function rayTo(from, to) {
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const len = Math.hypot(dx, dy, dz);
        return { x : dx / len, y : dy / len, z : dz / len };
    }
    const eye   = { x : 0, y : 10, z : 30 };
    const solve = maths.Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, eye, rayTo(eye, { x : 3, y : 2, z : 0 }));
    check('a ray aimed 3 m along the axis solves to 3', solve && near(solve.param, 3, 1e-9), solve);
    const solveBack = maths.Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, eye, rayTo(eye, { x : -1.25, y : 2, z : 0 }));
    check('and -1.25 m the other way',                  solveBack && near(solveBack.param, -1.25, 1e-9), solveBack);
    // A ray that passes ABOVE the axis still resolves to the point below it:
    // sideways pointer travel never moves the plane off its normal.
    const solveHigh = maths.Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, eye, rayTo(eye, { x : 3, y : 6, z : 0 }));
    check('pointer travel across the axis does not change the answer much', solveHigh && near(solveHigh.param, 3, 0.2), solveHigh);
    check('a ray parallel to the axis has no answer',   maths.Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, eye, { x : 1, y : 0, z : 0 }) === null);

    const headOn = maths.Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, { x : 40, y : 2.5, z : 0.5 }, rayTo({ x : 40, y : 2.5, z : 0.5 }, { x : 0, y : 2, z : 0 }));
    check('a plane facing the camera is reported as too steep to drag', headOn && maths.Na__PlaneMath__IsAxisTooSteep(headOn.alignment, 6), headOn);
    check('a plane seen from the side is not',          solve && !maths.Na__PlaneMath__IsAxisTooSteep(solve.alignment, 6), solve);
    // ------------------------------------------------------------


    // THE PLANE'S OWN FRAME
    // ------------------------------------------------------------
    console.log('\nThe plane frame');
    // A north elevation in the app's convention: azimuth 0, normal (0,0,-1),
    // right (-1,0,0). Bottom-left corner at x = 5, 10 m wide, 6 m tall.
    const frame = { origin : { x : 5, y : 0.15, z : -4 }, u : { x : -1, y : 0, z : 0 }, v : { x : 0, y : 1, z : 0 }, width : 10, height : 6 };
    const n = maths.Na__PlaneMath__FrameNormal(frame);
    check('u x v points at the viewer (north of the plane)', near(n.x, 0) && near(n.y, 0) && near(n.z, -1), n);

    const viewer = { x : 0, y : 3, z : -30 };
    const onFace = maths.Na__PlaneMath__RayToFrame(frame, viewer, rayTo(viewer, { x : 3, y : 2.15, z : -4 }));
    check('a ray at the face lands in frame coordinates', onFace && near(onFace.x, 2, 1e-9) && near(onFace.y, 2, 1e-9) && onFace.inside, onFace);
    const offFace = maths.Na__PlaneMath__RayToFrame(frame, viewer, rayTo(viewer, { x : 9, y : 2, z : -4 }));
    check('a ray beside the face is outside it',          offFace && !offFace.inside, offFace);
    check('a ray pointing away never meets it',           maths.Na__PlaneMath__RayToFrame(frame, viewer, { x : 0, y : 0, z : -1 }) === null);
    check('a ray along the plane never meets it',         maths.Na__PlaneMath__RayToFrame(frame, viewer, { x : 1, y : 0, z : 0 }) === null);

    const regions = [
        { name : 'grip-tr', x0 : 9.2, y0 : 5.2, x1 : 10, y1 : 6 },
        { name : 'label',   x0 : 0,   y0 : 5.2, x1 : 4,  y1 : 6 }
    ];
    check('the top-right grip is found',                  maths.Na__PlaneMath__RegionAt(regions, 9.6, 5.6) === 'grip-tr');
    check('the label is found',                           maths.Na__PlaneMath__RegionAt(regions, 1, 5.5) === 'label');
    check('the open face is no region',                   maths.Na__PlaneMath__RegionAt(regions, 5, 3) === null);
    // ------------------------------------------------------------


    // THE GROUND | PS01's slab, then a slope
    // ------------------------------------------------------------
    console.log('\nThe ground under a vertical plane');
    // The slab's top face only: two triangles at y = 0.05, x -20..60, z -60.025..19.975.
    const slabTop = new Float32Array([
        -20, 0.05, -60.025,   60, 0.05, -60.025,   60, 0.05, 19.975,
        -20, 0.05, -60.025,   60, 0.05,  19.975,  -20, 0.05, 19.975
    ]);
    // The underside, five metres down - it must never win.
    const slabBoth = new Float32Array(Array.from(slabTop).concat([
        -20, -5, -60.025,   60, -5, 19.975,   60, -5, -60.025,
        -20, -5, -60.025,  -20, -5, 19.975,   60, -5,  19.975
    ]));
    // PS01 "North Elevation": azimuth 90, normal (1,0), right (0,-1), plane at x = 20.
    const level = maths.Na__PlaneMath__GroundLevel(slabBoth, 1, 0, 20, 0, -1, 4, 27);
    check('PS01: the plane meets the slab at +50 mm',     level !== null && near(level, 0.05, 1e-6), level);
    check('so its bottom edge is at +150 mm',             level !== null && near(level + 0.1, 0.15, 1e-6), level);
    check('a plane off the end of the slab meets nothing', maths.Na__PlaneMath__GroundLevel(slabBoth, 1, 0, 75, 0, -1, 4, 27) === null);
    check('a span beyond the slab meets nothing',          maths.Na__PlaneMath__GroundLevel(slabBoth, 1, 0, 20, 0, -1, 80, 90) === null);

    // A slope rising 1 in 10 along +Z: y = z / 10, from z = 0 to z = 40.
    const slope = new Float32Array([
        -10, 0, 0,   30, 0, 0,   30, 4, 40,
        -10, 0, 0,   30, 4, 40, -10, 4, 40
    ]);
    // A plane at x = 5 (normal +X, right = -Z so run = -z). Span z 10..20 is run -20..-10.
    const onSlope = maths.Na__PlaneMath__GroundLevel(slope, 1, 0, 5, 0, -1, -20, -10);
    check('a slope: the HIGHEST point inside the span (z = 20 -> 2 m)', onSlope !== null && near(onSlope, 2, 1e-6), onSlope);
    const wholeSlope = maths.Na__PlaneMath__GroundLevel(slope, 1, 0, 5, 0, -1, -100, 100);
    check('the whole slope tops out at 4 m',              wholeSlope !== null && near(wholeSlope, 4, 1e-6), wholeSlope);
    // A diagonal plane (azimuth 45) still reads the slab level.
    const r2 = Math.SQRT1_2;
    const diagonal = maths.Na__PlaneMath__GroundLevel(slabBoth, r2, -r2, 10, -r2, -r2, -40, 40);
    check('a plane at 45 degrees reads the same slab',    diagonal !== null && near(diagonal, 0.05, 1e-6), diagonal);
    check('no ground at all is null, not zero',           maths.Na__PlaneMath__GroundLevel(new Float32Array(0), 1, 0, 0, 0, -1, -1, 1) === null);
    // ------------------------------------------------------------


    // THE ELEVATION RECORD SOLVE
    // ------------------------------------------------------------
    console.log('\nMoving an elevation plane');
    // PS01 North Elevation: origin (20 000, -20 000), normal (1, 0). Moving the
    // plane to 12 350 must change X alone.
    const movedEast = maths.Na__PlaneMath__MoveOriginToDistance(20000, -20000, 1, 0, 12350);
    check('an east-facing plane changes X and leaves Z',  near(movedEast.xMm, 12350) && near(movedEast.zMm, -20000), movedEast);
    // South Elevation: azimuth 270, normal (-1, 0): distance -20 000. Put it at -9 600.
    const movedWest = maths.Na__PlaneMath__MoveOriginToDistance(20000, -20000, -1, 0, -9600);
    check('a west-facing plane: distance -9 600 is x = 9 600', near(movedWest.xMm, 9600) && near(movedWest.zMm, -20000), movedWest);
    // A 30 degree plane: the point slides along the normal and not across it.
    const a30 = 30 * Math.PI / 180, nx = Math.sin(a30), nz = -Math.cos(a30);
    const moved30 = maths.Na__PlaneMath__MoveOriginToDistance(1000, 2000, nx, nz, 5000);
    check('a 30 degree plane lands at the distance asked for', near((moved30.xMm * nx) + (moved30.zMm * nz), 5000, 1e-6), moved30);
    const across = ((moved30.xMm - 1000) * nz) + ((moved30.zMm - 2000) * -nx);
    check('and did not slide sideways getting there',     near(across, 0, 1e-6), across);
    // ------------------------------------------------------------


    // THE FLOOR PLAN RECORD SOLVE
    // ------------------------------------------------------------
    console.log('\nMoving a floor plan cut');
    const up = maths.Na__PlaneMath__SolvePlanCut(0, 1800, 100);
    check('PS01 Floor Plan 1 dragged to 1 800: the CUT changes, the floor level does not', up.datumMm === 0 && up.offsetMm === 1800, up);
    const firstFloor = maths.Na__PlaneMath__SolvePlanCut(2800, 4000, 100);
    check('a first floor plan keeps its floor level too',  firstFloor.datumMm === 2800 && firstFloor.offsetMm === 1200, firstFloor);
    const under = maths.Na__PlaneMath__SolvePlanCut(0, -400, 100);
    check('dragged below the floor: the floor level is carried down, the plane still goes where it was put',
        under.offsetMm === 100 && (under.datumMm + under.offsetMm) === -400, under);
    const atMin = maths.Na__PlaneMath__SolvePlanCut(0, 100, 100);
    check('exactly the minimum cut leaves the floor level alone', atMin.datumMm === 0 && atMin.offsetMm === 100, atMin);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('\n' + (failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'));
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
