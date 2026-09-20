// =============================================================================
// TRUEVISION3D - TEST - ELEVATION DEPTH FOG - MATHS
// =============================================================================
//
// FILE       : Na__Test__ElevationDepthFog__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Elevation Depth Fog Maths Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the block settles whatever it is given, the fall-off means what the row says it means, depth is measured behind the plane and not from the camera, and the four-sample solve reads a real drawing camera exactly
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The maths module imports nothing, so it runs here exactly as the app runs
//   it. Node reads the app's .js modules as CommonJS, so the module is copied
//   to a temporary .mjs first.
// - THE FIXTURE IS RB05'S SOUTH WEST ELEVATION: azimuth 270, plane through
//   (2 200, -20 250), the drawing camera 150 m back from it with near 10 mm
//   and far 500 m - the numbers the Dev menu showed when the fog was asked for
//   ("cut -2200 mm into the model").
// - The camera here is built by hand from the same formulas three.js uses for
//   an orthographic projection, so the solve is tested against matrices it
//   will really meet without loading three.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ElevationDepthFog__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the Elevation Depth Fog build.
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
    const SYSTEM     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '49__System__ElevationDepthFog');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-depthfog-'));
    copyFileSync(join(SYSTEM, 'Na__ElevationDepthFog__Maths__.js'), join(SCRATCH, 'Maths.mjs'));
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

    const block = (enabled, start, end, falloff) => ({
        DepthFog__Enabled : enabled, DepthFog__StartDepthMm : start, DepthFog__EndDepthMm : end, DepthFog__FalloffPercent : falloff
    });


    // THE BLOCK
    // ------------------------------------------------------------
    console.log('\nThe block');
    {
        const fresh = maths.Na__ElevFogMath__NormaliseSettings(undefined);
        check('a record with no block starts OFF',                         fresh.enabled === false);
        check('...with a metre of clear air behind the plane',             fresh.startDepthMm === 1000);
        check('...full at fifteen metres',                                 fresh.endDepthMm === 15000);
        check('...and an even fade',                                       fresh.falloffPercent === 50);

        const kept = maths.Na__ElevFogMath__NormaliseSettings(block(true, 2500, 9000, 72.5));
        check('a whole block is kept as it stands',                        kept.enabled === true && kept.startDepthMm === 2500 && kept.endDepthMm === 9000 && kept.falloffPercent === 72.5, kept);

        check('only an explicit true switches it on (1 does not)',         maths.Na__ElevFogMath__NormaliseSettings(block(1, 0, 1000, 50)).enabled === false);
        check('...nor does the word',                                      maths.Na__ElevFogMath__NormaliseSettings(block('true', 0, 1000, 50)).enabled === false);

        const swapped = maths.Na__ElevFogMath__NormaliseSettings(block(true, 8000, 3000, 50));
        check('End typed short of Depth: Depth stands, End gives way',     swapped.startDepthMm === 8000 && swapped.endDepthMm === 8100, swapped);

        const negative = maths.Na__ElevFogMath__NormaliseSettings(block(true, -500, 4000, 50));
        check('the fog never starts in front of the plane',                negative.startDepthMm === 0, negative);

        const huge = maths.Na__ElevFogMath__NormaliseSettings(block(true, 900000, 950000, 50));
        check('both depths stop at the far limit, a band apart',           huge.startDepthMm === 199900 && huge.endDepthMm === 200000, huge);

        check('fall-off stops at 100',                                     maths.Na__ElevFogMath__NormaliseSettings(block(true, 0, 1000, 250)).falloffPercent === 100);
        check('...and at 0',                                               maths.Na__ElevFogMath__NormaliseSettings(block(true, 0, 1000, -3)).falloffPercent === 0);

        const half = maths.Na__ElevFogMath__NormaliseSettings({ DepthFog__Enabled : true, DepthFog__EndDepthMm : 6000 });
        check('half a block is filled in from the defaults',               half.enabled === true && half.startDepthMm === 1000 && half.endDepthMm === 6000 && half.falloffPercent === 50, half);

        const junk = maths.Na__ElevFogMath__NormaliseSettings('fog please');
        check('a block that is not a block reads as the defaults',         junk.enabled === false && junk.startDepthMm === 1000);

        const own = maths.Na__ElevFogMath__NormaliseSettings(block(false, 1200.4, 7999.6, 50), { startDepthMm : 1, endDepthMm : 2, falloffPercent : 3 }, { minBandMm : 500 });
        check('depths are whole millimetres',                              own.startDepthMm === 1200 && own.endDepthMm === 8000, own);

        const held    = { Other : 'kept' };
        const written = maths.Na__ElevFogMath__WriteBlock(held, kept);
        check('writing keeps the SAME block object',                       written === held && held.Other === 'kept');
        check('...and what it wrote reads back identical',                 maths.Na__ElevFogMath__BlockMatches(held, kept));
        check('...in a fixed key order',                                   JSON.stringify(Object.keys(maths.Na__ElevFogMath__WriteBlock({}, kept))) === JSON.stringify([ 'DepthFog__Enabled', 'DepthFog__StartDepthMm', 'DepthFog__EndDepthMm', 'DepthFog__FalloffPercent' ]));
        check('a block one value out does not match',                      maths.Na__ElevFogMath__BlockMatches(block(true, 2500, 9000, 72), kept) === false);
        check('no block matches nothing',                                  maths.Na__ElevFogMath__BlockMatches(undefined, kept) === false);
    }


    // THE FALL-OFF
    // ------------------------------------------------------------
    console.log('\nThe fall-off');
    {
        const fog  = (falloff) => ({ enabled : true, startDepthMm : 1000, endDepthMm : 11000, falloffPercent : falloff });
        const at   = (mm, falloff) => maths.Na__ElevFogMath__DensityAtDepth(mm, fog(falloff));
        const mid  = 6000;                                                       // <-- Half way from 1 000 to 11 000

        check('50 typed, half way there: half fogged',                     near(at(mid, 50), 0.5));
        check('80 typed, half way there: 80% fogged',                      near(at(mid, 80), 0.8));
        check('20 typed, half way there: 20% fogged',                      near(at(mid, 20), 0.2));
        check('50 is a straight ramp (a quarter of the way: a quarter)',   near(at(3500, 50), 0.25));
        check('...and three quarters: three quarters',                     near(at(8500, 50), 0.75));

        check('nothing in front of Depth is touched',                      at(999, 50) === 0 && at(0, 50) === 0);
        check('nothing in front of the PLANE is touched',                  at(-4000, 95) === 0);
        check('at Depth itself the fog is still nothing',                  at(1000, 95) === 0);
        check('at End it is full',                                         near(at(11000, 50), 1));
        check('beyond End it stays full',                                  near(at(90000, 5), 1));

        let rising = true;
        [ 5, 20, 50, 80, 95 ].forEach((falloff) => {
            let last = -1;
            for (let mm = 1000; mm <= 11000; mm += 250) { const d = at(mm, falloff); if (d < last - 1e-12) rising = false; last = d; }
        });
        check('whatever is typed, the fog only ever thickens with depth',   rising);

        let denser = true;
        for (let mm = 1250; mm < 11000; mm += 250) { if (!(at(mm, 80) > at(mm, 50) && at(mm, 50) > at(mm, 20))) denser = false; }
        check('a higher fall-off is denser at EVERY depth in the band',     denser);

        check('100 is a wall at Depth (a millimetre in: all but full)',    at(1100, 100) > 0.6 && at(2000, 100) > 0.95, [ at(1100, 100), at(2000, 100) ]);
        check('0 is a wall at End (a metre short of it: all but clear)',   at(10000, 0) < 0.05 && near(at(11000, 0), 1), at(10000, 0));
        check('neither wall is a division by zero',                        Number.isFinite(at(6000, 0)) && Number.isFinite(at(6000, 100)));

        check('the ceiling scales the lot',                                near(maths.Na__ElevFogMath__DensityAtDepth(mid, fog(50), 0.5, 0.8), 0.4));
        check('the curve is its own mirror (b against 1 - b)',             near(maths.Na__ElevFogMath__Bias(0.3, 0.7) + maths.Na__ElevFogMath__Bias(0.7, 0.3), 1));
        check('a fall-off that is not a number is the even fade',          near(maths.Na__ElevFogMath__FalloffToBias(NaN), 0.5));
    }


    // BEHIND THE PLANE
    // ------------------------------------------------------------
    // RB05 South West Elevation. Azimuth 270: the viewer stands to the WEST
    // (world north is -Z, so the normal is (sin 270, 0, -cos 270) = (-1, 0, 0))
    // and looks east. The plane passes through x = 2 200, so its distance along
    // that normal is -2 200 - the very number the row reads out.
    // ------------------------------------------------------------
    console.log('\nBehind the plane');
    const azimuth = 270 * (Math.PI / 180);
    const planeMm = { normalX : Math.sin(azimuth), normalY : 0, normalZ : -Math.cos(azimuth), distance : 0 };
    planeMm.distance = (2200 * planeMm.normalX) + (-20250 * planeMm.normalZ);
    {
        check('the fixture is the one on screen (cut -2200 mm)',           near(planeMm.distance, -2200, 1e-6), planeMm.distance);
        check('a point on the plane is 0 behind it',                       near(maths.Na__ElevFogMath__DepthBehindPlane(2200, 3000, -20250, planeMm), 0, 1e-6));
        check('a metre further east is a metre behind',                    near(maths.Na__ElevFogMath__DepthBehindPlane(3200, 3000, -20250, planeMm), 1000, 1e-6));
        check('a metre nearer the viewer is a metre in FRONT',             near(maths.Na__ElevFogMath__DepthBehindPlane(1200, 3000, -20250, planeMm), -1000, 1e-6));
        check('sliding along the facade changes nothing',                  near(maths.Na__ElevFogMath__DepthBehindPlane(3200, 3000, 55000, planeMm), 1000, 1e-6));
        check('nor does height',                                           near(maths.Na__ElevFogMath__DepthBehindPlane(3200, -9000, -20250, planeMm), 1000, 1e-6));
    }


    // THE DEPTH SOLVE
    // ------------------------------------------------------------
    // A drawing camera by hand, in scene units (metres): standing 150 m out
    // along the normal from the plane, looking back down it, near 0.01 and far
    // 500, its frame 40 m by 22.5 m about a point 3.4 m up. unproject is three's
    // own arithmetic for a parallel projection with the camera's axes written
    // out, so a view offset or a jitter is just a different frame rectangle.
    // ------------------------------------------------------------
    console.log('\nThe depth solve');
    {
        const plane   = { normalX : planeMm.normalX, normalY : 0, normalZ : planeMm.normalZ, distance : planeMm.distance / 1000 };
        const right   = { x : plane.normalZ, y : 0, z : -plane.normalX };                // <-- Na__ElevData__GetAxes' own right axis
        const forward = { x : -plane.normalX, y : 0, z : -plane.normalZ };               // <-- The camera looks back down the normal
        const standOff = 150, nearU = 0.01, farU = 500;
        const eye = { x : plane.normalX * (plane.distance + standOff), y : 3.4, z : plane.normalZ * (plane.distance + standOff) + (right.z * -20.25) };

        const camera = (left, rightEdge, bottom, top) => (u, v, s) => {
            const across = left   + (u * (rightEdge - left));
            const up     = bottom + (v * (top - bottom));
            const along  = nearU  + (s * (farU - nearU));                                // <-- Linear window depth: what a parallel camera stores
            const px = eye.x + (right.x * across) + (forward.x * along);
            const py = eye.y + up;
            const pz = eye.z + (right.z * across) + (forward.z * along);
            return maths.Na__ElevFogMath__DepthBehindPlane(px, py, pz, plane);
        };

        const whole  = maths.Na__ElevFogMath__SolveAffineDepth(camera(-20, 20, -11.25, 11.25));
        check('a drawing camera solves',                                   whole !== null);
        check('...square on, so screen position changes nothing',          whole && near(whole.b, 0, 1e-9) && near(whole.c, 0, 1e-9), whole);
        check('...the near plane is a stand-off in FRONT of the plane',    whole && near(whole.a, nearU - standOff, 1e-9), whole && whole.a);
        check('...and depth runs the whole near-to-far range',             whole && near(whole.d, farU - nearU, 1e-9));

        const sAtPlane = (standOff - nearU) / (farU - nearU);
        check('the depth stored AT the plane reads 0 behind it',           near(maths.Na__ElevFogMath__AffineDepthAt(whole, 0.3, 0.8, sAtPlane), 0, 1e-9));
        const sOneMetre = (standOff + 1 - nearU) / (farU - nearU);
        check('...and a metre further reads a metre, anywhere on screen',  near(maths.Na__ElevFogMath__AffineDepthAt(whole, 0.91, 0.07, sOneMetre), 1, 1e-9));

        const tile = maths.Na__ElevFogMath__SolveAffineDepth(camera(3.125, 8.25, -2.5, 1.75));
        check('one tile of a big export solves to the same numbers',       tile && near(tile.a, whole.a, 1e-9) && near(tile.d, whole.d, 1e-9) && near(tile.b, 0, 1e-9));

        // A camera that is NOT square to the plane: swung 20 degrees about the
        // vertical. Still parallel, so still affine - and now screen position
        // matters, which is what b is for.
        const swing  = 20 * (Math.PI / 180);
        const skewed = (u, v, s) => {
            const fx = (forward.x * Math.cos(swing)) + (right.x * Math.sin(swing));
            const fz = (forward.z * Math.cos(swing)) + (right.z * Math.sin(swing));
            const rx = (right.x * Math.cos(swing)) - (forward.x * Math.sin(swing));
            const rz = (right.z * Math.cos(swing)) - (forward.z * Math.sin(swing));
            const across = -20 + (u * 40), up = -11.25 + (v * 22.5), along = nearU + (s * (farU - nearU));
            return maths.Na__ElevFogMath__DepthBehindPlane(eye.x + (rx * across) + (fx * along), eye.y + up, eye.z + (rz * across) + (fz * along), plane);
        };
        const swung = maths.Na__ElevFogMath__SolveAffineDepth(skewed);
        check('a parallel camera swung off square still solves',           swung !== null && Math.abs(swung.b) > 1);
        check('...and reads any pixel back exactly',                       swung && near(maths.Na__ElevFogMath__AffineDepthAt(swung, 0.37, 0.62, 0.41), skewed(0.37, 0.62, 0.41), 1e-7));

        // A perspective camera: the frame widens with depth, so across is
        // multiplied by along and nothing affine fits it.
        const perspective = (u, v, s) => {
            const along = nearU + (s * (farU - nearU));
            const across = (-0.5 + u) * along, up = (-0.3 + v) * along;
            const fx = (forward.x * Math.cos(swing)) + (right.x * Math.sin(swing));
            const fz = (forward.z * Math.cos(swing)) + (right.z * Math.sin(swing));
            const rx = (right.x * Math.cos(swing)) - (forward.x * Math.sin(swing));
            const rz = (right.z * Math.cos(swing)) - (forward.z * Math.sin(swing));
            return maths.Na__ElevFogMath__DepthBehindPlane(eye.x + (rx * across) + (fx * along), eye.y + up, eye.z + (rz * across) + (fz * along), plane);
        };
        check('a perspective camera is refused, not fogged wrongly',       maths.Na__ElevFogMath__SolveAffineDepth(perspective) === null);
        check('a solve with nothing to sample is refused',                 maths.Na__ElevFogMath__SolveAffineDepth(null) === null);
        check('...as is one that answers nonsense',                        maths.Na__ElevFogMath__SolveAffineDepth(() => NaN) === null);
    }


    // COLOUR AND THE TOKEN
    // ------------------------------------------------------------
    console.log('\nColour and the token');
    {
        const white = maths.Na__ElevFogMath__ParseColour('#ffffff');
        check('paper white reads as three ones',                           white.r === 1 && white.g === 1 && white.b === 1);
        const warm = maths.Na__ElevFogMath__ParseColour('F4EFE6');
        check('a colour without its hash still reads',                     near(warm.r, 244 / 255) && near(warm.b, 230 / 255));
        const bad = maths.Na__ElevFogMath__ParseColour('fog');
        check('anything unreadable is paper white',                        bad.r === 1 && bad.g === 1 && bad.b === 1);

        const encode = (linear) => (linear <= 0.0031308) ? (linear * 12.92) : ((Math.pow(linear, 0.41666) * 1.055) - 0.055);   // <-- The supersampler's present shader, verbatim
        let roundTrip = true;
        for (let value = 0; value <= 1.0001; value += 0.05) {
            if (!near(encode(maths.Na__ElevFogMath__SrgbToLinear(value)), Math.min(1, value), 2e-4)) roundTrip = false;
        }
        check('a display value survives the bake\'s own encode',            roundTrip);

        const on  = { enabled : true,  startDepthMm : 1000, endDepthMm : 15000, falloffPercent : 50 };
        const off = { enabled : false, startDepthMm : 1000, endDepthMm : 15000, falloffPercent : 50 };
        check('fog off keys as nothing at all',                            maths.Na__ElevFogMath__Token(off, { colour : '#ffffff' }) === '');
        check('no settings keys as nothing at all',                        maths.Na__ElevFogMath__Token(null) === '');
        check('fog on has a key',                                          maths.Na__ElevFogMath__Token(on, { colour : '#FFFFFF', maxOpacity : 1 }) === 'fog:1000:15000:50:#ffffff:1:1:12');
        check('...that moves with how far open paper looks',               maths.Na__ElevFogMath__Token(on, { emptyReachPx : 5 }) !== maths.Na__ElevFogMath__Token(on));
        check('...that moves with Depth',                                  maths.Na__ElevFogMath__Token(Object.assign({}, on, { startDepthMm : 1250 })) !== maths.Na__ElevFogMath__Token(on));
        check('...with End',                                               maths.Na__ElevFogMath__Token(Object.assign({}, on, { endDepthMm : 14000 })) !== maths.Na__ElevFogMath__Token(on));
        check('...with the fall-off',                                      maths.Na__ElevFogMath__Token(Object.assign({}, on, { falloffPercent : 55 })) !== maths.Na__ElevFogMath__Token(on));
        check('...and with the colour',                                    maths.Na__ElevFogMath__Token(on, { colour : '#f4efe6' }) !== maths.Na__ElevFogMath__Token(on, { colour : '#ffffff' }));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('\n' + (failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'));
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
