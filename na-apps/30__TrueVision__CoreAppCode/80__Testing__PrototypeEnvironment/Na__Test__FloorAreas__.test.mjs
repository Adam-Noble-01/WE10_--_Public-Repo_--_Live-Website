// =============================================================================
// TRUEVISION3D - TEST - FLOOR AREAS - THE MEASUREMENT
// =============================================================================
//
// FILE       : Na__Test__FloorAreas__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Floor Areas Geometry Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that a room measures what it is drawn as - against figures worked out by hand, not read off the screen
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The geometry module imports NOTHING, so the one file is copied into a
//   scratch folder beside a package.json that tells Node it is an ES module
//   and run exactly as the editor runs it.
// - THE CHECK THAT MATTERS MOST IS THE SQUARE. A scale is squared when paper
//   becomes floor, so a room read at 1:100 that was drawn at 1:50 reports FOUR
//   times its size, not twice. Every figure below is worked out by hand in the
//   check's own name so a wrong answer cannot look plausible.
// - The second is that a self-crossing outline is REPORTED rather than
//   measured: the shoelace subtracts one lobe from the other and would answer
//   a number that looks like an area and is not one.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__FloorAreas__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Floor Areas system.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test and Its Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const FEATURE    = join(APP, '51__System__LayoutEditor', '59__Feature__FloorAreas');
    const MODULE     = 'Na__LayoutEditor__FloorAreas__Geometry__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-floorareas-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');
    copyFileSync(join(FEATURE, MODULE), join(SCRATCH, MODULE));
    const geo    = await import(pathToFileURL(join(SCRATCH, MODULE)).href);
    const config = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__FloorAreas__Config__.json'), 'utf8'));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  ->  ' + JSON.stringify(detail) : ''));
    }
    const near = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-9 : tolerance);

    console.log('TrueVision3D - floor areas, the measurement');

    // THE SHAPES USED THROUGHOUT
    // A 100 x 60 mm rectangle on the paper. At 1:50 that is 5000 x 3000 mm of
    // floor: 15 square metres, and 16 metres round.
    const room = [ [ 10, 10 ], [ 110, 10 ], [ 110, 70 ], [ 10, 70 ] ];
    // An L: a 100 mm square with a 60 x 60 mm bite out of one corner.
    const ell  = [ [ 0, 0 ], [ 40, 0 ], [ 40, 60 ], [ 100, 60 ], [ 100, 100 ], [ 0, 100 ] ];

    // -- WHAT IT ENCLOSES ---------------------------------------------------
    check('a rectangle 100 x 60 mm encloses 6000 square millimetres of paper', near(geo.Na__LeAreaGeo__PaperMm2(room), 6000), geo.Na__LeAreaGeo__PaperMm2(room));
    check('at 1:50 that is 15.00 m2 of floor', near(geo.Na__LeAreaGeo__RealM2(room, 50), 15), geo.Na__LeAreaGeo__RealM2(room, 50));
    check('at 1:100 it is 60.00 m2 - FOUR times, because the scale is squared', near(geo.Na__LeAreaGeo__RealM2(room, 100), 60), geo.Na__LeAreaGeo__RealM2(room, 100));
    check('at 1:20 it is 2.40 m2', near(geo.Na__LeAreaGeo__RealM2(room, 20), 2.4), geo.Na__LeAreaGeo__RealM2(room, 20));
    check('at 1:1 it is 0.006 m2 - the paper itself', near(geo.Na__LeAreaGeo__RealM2(room, 1), 0.006), geo.Na__LeAreaGeo__RealM2(room, 1));
    check('which way round it was drawn makes no difference', near(geo.Na__LeAreaGeo__RealM2(room.slice().reverse(), 50), 15));
    check('the L encloses 10000 - 3600 = 6400 square millimetres', near(geo.Na__LeAreaGeo__PaperMm2(ell), 6400), geo.Na__LeAreaGeo__PaperMm2(ell));

    // -- HOW FAR ROUND IT ---------------------------------------------------
    check('16.00 m round the rectangle at 1:50 (the closing wall counted)', near(geo.Na__LeAreaGeo__PerimeterM(room, 50), 16), geo.Na__LeAreaGeo__PerimeterM(room, 50));
    check('the L is 400 mm of paper round, so 20.00 m at 1:50', near(geo.Na__LeAreaGeo__PerimeterM(ell, 50), 20), geo.Na__LeAreaGeo__PerimeterM(ell, 50));

    // -- WHAT IS NOT A ROOM -------------------------------------------------
    check('two points enclose nothing', geo.Na__LeAreaGeo__Encloses([ [ 0, 0 ], [ 10, 10 ] ]) === false);
    check('three do', geo.Na__LeAreaGeo__Encloses([ [ 0, 0 ], [ 10, 0 ], [ 0, 10 ] ]) === true);
    check('a run that encloses nothing measures nothing', geo.Na__LeAreaGeo__RealM2([ [ 0, 0 ], [ 10, 10 ] ], 50) === 0);

    // -- AN OUTLINE THAT CROSSES ITSELF -------------------------------------
    const eight = [ [ 0, 0 ], [ 100, 0 ], [ 0, 100 ], [ 100, 100 ] ];
    check('a figure of eight is reported as crossing itself', geo.Na__LeAreaGeo__SelfCrossing(eight) === true);
    check('...and its shoelace really would have answered zero, which is why it is reported', near(geo.Na__LeAreaGeo__SignedPaperMm2(eight), 0), geo.Na__LeAreaGeo__SignedPaperMm2(eight));
    check('a plain rectangle does not cross itself', geo.Na__LeAreaGeo__SelfCrossing(room) === false);
    check('nor does an L, whose walls meet only at their corners', geo.Na__LeAreaGeo__SelfCrossing(ell) === false);
    check('nor does a triangle', geo.Na__LeAreaGeo__SelfCrossing([ [ 0, 0 ], [ 50, 0 ], [ 25, 40 ] ]) === false);

    // -- WHERE THE NAME GOES ------------------------------------------------
    const middle = geo.Na__LeAreaGeo__VisualCentre(room);
    check('a rectangle is labelled at its centre', near(middle.x, 60) && near(middle.y, 40), middle);
    check('...and knows it has 30 mm of clear paper round that point', near(middle.clearMm, 30), middle.clearMm);
    const inside = geo.Na__LeAreaGeo__VisualCentre(ell);
    check('an L is labelled INSIDE the L, not in the bite out of it', geo.Na__LeAreaGeo__Contains(ell, inside.x, inside.y) === true, inside);
    check('...and that point is further from every wall than the centroid is',
        geo.Na__LeAreaGeo__Contains(ell, inside.x, inside.y) && inside.clearMm >= 15, { centre : inside, centroid : geo.Na__LeAreaGeo__Centroid(ell) });
    // A U-shape is the case a centroid gets wrong outright: its middle is in
    // the gap between the two legs, outside the room.
    const u = [ [ 0, 0 ], [ 30, 0 ], [ 30, 70 ], [ 70, 70 ], [ 70, 0 ], [ 100, 0 ], [ 100, 100 ], [ 0, 100 ] ];
    const uCentroid = geo.Na__LeAreaGeo__Centroid(u);
    const uCentre   = geo.Na__LeAreaGeo__VisualCentre(u);
    check('a U-shaped room: its centroid falls OUTSIDE it', geo.Na__LeAreaGeo__Contains(u, uCentroid.x, uCentroid.y) === false, uCentroid);
    check('...and the visual centre falls inside it', geo.Na__LeAreaGeo__Contains(u, uCentre.x, uCentre.y) === true, uCentre);
    check('a run with no area is still given a point to label', Number.isFinite(geo.Na__LeAreaGeo__VisualCentre([ [ 0, 0 ], [ 10, 0 ] ]).x));

    // -- WHERE THE LABEL SITS BEFORE IT IS DRAGGED --------------------------
    // Adam, 21-Sep-2026: "by default, centering it on the centre of the
    // bounding box, which should be the standard behaviour".
    const home = geo.Na__LeAreaGeo__LabelHome(room, 'box');
    check('a rectangle\'s label sits in the middle of its box (60, 40)', near(home.x, 60) && near(home.y, 40) && home.placement === 'box', home);
    // RB05's Area 2 as Adam's screenshot drew it (a tenth of a pixel to the
    // millimetre): a window bay out of the top wall, a chimney breast into
    // the left wall, a jog in the right wall and a recess out of the bottom.
    // Its box runs 0-70.8 across and 0-88.4 down, so the middle of the box is
    // (35.4, 44.2); its label was painted up and to the right of that.
    const recessed = [ [ 0, 3.3 ], [ 17.4, 3.3 ], [ 17.4, 0 ], [ 50.9, 0 ], [ 50.9, 3.3 ], [ 70.8, 3.3 ], [ 70.8, 54.8 ], [ 68.6, 54.8 ], [ 68.6, 83 ],
                       [ 49.6, 83 ], [ 49.6, 88.4 ], [ 19.1, 88.4 ], [ 19.1, 83 ], [ 0, 83 ], [ 0, 56.4 ], [ 5.3, 56.4 ], [ 5.3, 28.9 ], [ 0, 28.9 ] ];
    const recessedHome   = geo.Na__LeAreaGeo__LabelHome(recessed, 'box');
    const recessedVisual = geo.Na__LeAreaGeo__VisualCentre(recessed);
    check('a room with a bay and recesses is labelled in the middle of its box, (35.4, 44.2)', near(recessedHome.x, 35.4) && near(recessedHome.y, 44.2) && recessedHome.placement === 'box', recessedHome);
    check('...which is NOT where its visual centre is - the fault Adam saw', Math.hypot(recessedVisual.x - recessedHome.x, recessedVisual.y - recessedHome.y) > 3, { visual : recessedVisual, home : recessedHome });
    const ellHome = geo.Na__LeAreaGeo__LabelHome(ell, 'box');
    check('an L has the middle of its box (50, 50) in the bite out of it...', geo.Na__LeAreaGeo__Contains(ell, 50, 50) === false);
    check('...so its label falls back to the visual centre, inside the L', ellHome.placement === 'visual' && geo.Na__LeAreaGeo__Contains(ell, ellHome.x, ellHome.y) === true, ellHome);
    const uHome = geo.Na__LeAreaGeo__LabelHome(u, 'box');
    check('a U does the same: never labelled in the gap between its legs', uHome.placement === 'visual' && geo.Na__LeAreaGeo__Contains(u, uHome.x, uHome.y) === true, uHome);
    const visualHome = geo.Na__LeAreaGeo__LabelHome(recessed, 'visual');
    check('\'visual\' puts every room\'s label at its visual centre', visualHome.placement === 'visual' && near(visualHome.x, recessedVisual.x) && near(visualHome.y, recessedVisual.y), visualHome);
    check('a visual centre handed in is used rather than worked out again', geo.Na__LeAreaGeo__LabelHome(ell, 'box', { x : 1, y : 2 }).x === 1);
    check('an unknown placement reads as the box', geo.Na__LeAreaGeo__LabelHome(room, 'nonsense').placement === 'box');
    check('a run that encloses nothing is still given a home', Number.isFinite(geo.Na__LeAreaGeo__LabelHome([ [ 0, 0 ], [ 10, 0 ] ], 'box').x));

    // -- HOW THE FIGURES ARE WRITTEN ----------------------------------------
    check('two decimals and a square metre sign', geo.Na__LeAreaGeo__FormatArea(18.4499, { decimals : 2 }) === '18.45 m²', geo.Na__LeAreaGeo__FormatArea(18.4499, { decimals : 2 }));
    check('square feet convert at 10.7639 to the square metre', geo.Na__LeAreaGeo__FormatArea(15, { units : 'ft2', decimals : 2 }) === '161 ft²', geo.Na__LeAreaGeo__FormatArea(15, { units : 'ft2' }));
    check('both, metres first and feet in brackets', geo.Na__LeAreaGeo__FormatArea(15, { units : 'both', decimals : 2 }) === '15.00 m² (161 ft²)', geo.Na__LeAreaGeo__FormatArea(15, { units : 'both', decimals : 2 }));
    check('a site measured in thousands keeps its separator', geo.Na__LeAreaGeo__FormatArea(2500.5, { decimals : 1, separator : ',' }) === '2,500.5 m²', geo.Na__LeAreaGeo__FormatArea(2500.5, { decimals : 1, separator : ',' }));
    check('a length is written the same way', geo.Na__LeAreaGeo__FormatLength(16, { decimals : 2 }) === '16.00 m');
    check('zero decimals rounds rather than truncates', geo.Na__LeAreaGeo__FormatArea(18.6, { decimals : 0 }) === '19 m²', geo.Na__LeAreaGeo__FormatArea(18.6, { decimals : 0 }));

    // -- WHAT THE CONFIG SHIPS ----------------------------------------------
    const measurement = config['LayoutEditor__FloorAreas__Measurement'];
    const label       = config['LayoutEditor__FloorAreas__Label'];
    const layer       = config['LayoutEditor__FloorAreas__Layer'];
    const groups      = config['LayoutEditor__FloorAreas__Groups'];
    check('the config ships square metres to two decimals', measurement['Measurement__Units'] === 'm2' && measurement['Measurement__Decimals'] === 2);
    check('the shipped suffixes are the real signs, not "m2"', measurement['Measurement__SuffixM2'] === ' m²' && measurement['Measurement__SuffixFt2'] === ' ft²');
    check('the layer is called Floor Areas', layer['Layer__Name'] === 'Floor Areas');
    check('a label shrinks to fit rather than running into the next room', label['Label__ShrinkToFit'] === true && label['Label__MinTextSizeMm'] > 0);
    check('the group palette has a colour for every floor of a house and more', Array.isArray(groups['Groups__Palette']) && groups['Groups__Palette'].length >= 6);
    check('every palette colour is a real hex colour', groups['Groups__Palette'].every((colour) => /^#[0-9a-f]{6}$/i.test(colour)), groups['Groups__Palette']);
    check('the config formats exactly as the module does',
        geo.Na__LeAreaGeo__FormatArea(15, { units : measurement['Measurement__Units'], decimals : measurement['Measurement__Decimals'], separator : measurement['Measurement__Separator'], suffixM2 : measurement['Measurement__SuffixM2'] }) === '15.00 m²');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
