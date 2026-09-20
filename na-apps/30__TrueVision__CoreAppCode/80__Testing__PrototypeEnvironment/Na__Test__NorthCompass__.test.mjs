// =============================================================================
// TRUEVISION3D - TEST - NORTH DIRECTION - COMPASS MATHS
// =============================================================================
//
// FILE       : Na__Test__NorthCompass__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : North Direction Compass Maths Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a bearing is measured the way an elevation's azimuth is, that true north turns an azimuth into the right compass word, and that PS02's hand-typed elevation names fall out of one north bearing
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The compass module imports nothing, so it runs here exactly as the app
//   runs it. Node 20 reads the app's .js modules as CommonJS, so the module is
//   copied to a temporary .mjs first.
// - THE FIXTURE IS PS02. Its elevations were seeded by the app, which called
//   them after the model's axes, and renamed by hand to what they truly face:
//   "North Elevation" is stored at azimuth 90, "East Elevation" at 180,
//   "South Elevation" at 270. One north bearing has to give all three back.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__NorthCompass__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Written with the north direction tool.
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
    const SYSTEM     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '46__System__NorthDirection');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-north-'));
    copyFileSync(join(SYSTEM, 'Na__North__Compass__.js'), join(SCRATCH, 'Compass.mjs'));
    const compass = await import(pathToFileURL(join(SCRATCH, 'Compass.mjs')).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const near = (a, b) => Math.abs(a - b) < 1e-9;

    console.log('TrueVision3D - north direction compass maths');

    // BEARINGS | Clockwise seen from above, from the model's -Z axis
    check('north is -Z: bearing 0',            near(compass.Na__NorthMath__BearingOfVector(0, -1), 0));
    check('east is +X: bearing 90',            near(compass.Na__NorthMath__BearingOfVector(1, 0), 90));
    check('south is +Z: bearing 180',          near(compass.Na__NorthMath__BearingOfVector(0, 1), 180));
    check('west is -X: bearing 270',           near(compass.Na__NorthMath__BearingOfVector(-1, 0), 270));
    check('a vector of no length has no bearing', compass.Na__NorthMath__BearingOfVector(0, 0) === null);
    check('wrap: -90 is 270, 360 is 0, 725 is 5', near(compass.Na__NorthMath__Wrap(-90), 270) && compass.Na__NorthMath__Wrap(360) === 0 && near(compass.Na__NorthMath__Wrap(725), 5));
    check('round: 359.97 to one place is 0, not 360', compass.Na__NorthMath__Round(359.97, 1) === 0, compass.Na__NorthMath__Round(359.97, 1));
    check('round: what is stored is the tidy number - 155.9, never 155.89999999999998', compass.Na__NorthMath__Round(155.8999, 1) === 155.9 && String(compass.Na__NorthMath__Round(155.93, 1)) === '155.9' && compass.Na__NorthMath__Wrap(155.9) === 155.9 && String(compass.Na__NorthMath__Round(515.9, 1)) === '155.9', [ compass.Na__NorthMath__Round(155.93, 1), compass.Na__NorthMath__Round(515.9, 1) ]);

    // THE SAME MEASURE AS AN ELEVATION'S AZIMUTH | Na__ElevData__GetAxes: normalX = sin(az), normalZ = -cos(az)
    let agrees = true;
    for (let az = 0; az < 360; az += 5) {
        const v = compass.Na__NorthMath__VectorOfBearing(az);
        const elevationNormal = { x : Math.sin(az * Math.PI / 180), z : -Math.cos(az * Math.PI / 180) };
        if (!near(v.x, elevationNormal.x) || !near(v.z, elevationNormal.z)) agrees = false;
        if (!near(compass.Na__NorthMath__BearingOfVector(v.x, v.z), az)) agrees = false;
    }
    check('a bearing and an elevation azimuth are one measure, and vector <-> bearing round-trips', agrees);

    // A NORTH-UP MODEL | North bearing 0: the app's presets were right all along
    const word = (azimuth, north, half) => compass.Na__NorthMath__FacingWord(azimuth, north, half, null);
    check('north-up model: azimuths 0/90/180/270 are North/East/South/West',
        word(0, 0) === 'North' && word(90, 0) === 'East' && word(180, 0) === 'South' && word(270, 0) === 'West');

    // PS02 | One north bearing gives back every name Adam typed by hand
    const PS02 = [ [ 'North', 90 ], [ 'East', 180 ], [ 'South', 270 ] ];
    check('PS02: a north bearing of 90 names azimuth 90 North, 180 East, 270 South', PS02.every(([ name, azimuth ]) => word(azimuth, 90) === name), PS02.map(([ , azimuth ]) => word(azimuth, 90)));
    check('PS02: the fourth side, azimuth 0, is West', word(0, 90) === 'West', word(0, 90));

    // NOT SET IS NOT ZERO | No north: no word, so the caller shows a placeholder
    check('north not set: no word (null, undefined, NaN)', word(90, null) === '' && word(90, undefined) === '' && word(90, NaN) === '');
    check('north set to 0 is a real answer', word(90, 0) === 'East');

    // THE INTERCARDINALS | As wide as they are told to be
    check('house default (15): 30 degrees off north is still North', word(30, 0) === 'North', word(30, 0));
    check('house default (15): 31 to 59 off north is North East', word(31, 0) === 'North East' && word(45, 0) === 'North East' && word(59, 0) === 'North East');
    check('house default (15): the boundaries themselves, 30 and 60, belong to the cardinals', word(30, 0) === 'North' && word(60, 0) === 'East' && word(61, 0) === 'East');
    check('half width 22.5 is the ordinary eight-point compass', word(23, 0, 22.5) === 'North East' && word(22, 0, 22.5) === 'North' && word(68, 0, 22.5) === 'East');
    check('half width 0 is the four-point compass', word(44, 0, 0) === 'North' && word(46, 0, 0) === 'East' && word(45, 0, 0) === 'East');
    check('near 360 wraps to North, not to a ninth point', word(350, 0) === 'North' && word(359.9, 0) === 'North' && word(330, 0) === 'North' && word(329, 0) === 'North West');
    const skewed = [ 0, 90, 180, 270 ].map((side) => word(side + 25, 0));
    check('a building skewed 25 degrees still gets four different names', new Set(skewed).size === 4, skewed);
    const diagonal = [ 0, 90, 180, 270 ].map((side) => word(side + 45, 0));
    check('a building at 45 degrees gets the four intercardinals', diagonal.join() === 'North East,South East,South West,North West', diagonal);

    // WORDS FROM CONFIG | Whatever it leaves out is the plain English
    check('configured words are used, missing ones fall back', compass.Na__NorthMath__CompassWord(90, 15, { East : 'Oost' }) === 'Oost' && compass.Na__NorthMath__CompassWord(0, 15, { East : 'Oost' }) === 'North');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
