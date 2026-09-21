// =============================================================================
// TRUEVISION3D - TEST - DIMENSION ROUND UP TO 5 MM
// =============================================================================
//
// FILE       : Na__Test__DimensionRoundUp__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Dimension Round Up Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a rounded dimension goes UP to the next 5 mm, is marked only when it moved, and is not fooled by floating point noise
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The rounding module imports NOTHING, so the one file is copied into a
//   scratch folder beside a package.json that tells Node it is an ES module
//   and run exactly as the editor runs it.
// - THE CHECK THAT MATTERS MOST IS THE NOISE. A dimension that reads 2,810
//   can measure 2,810.0000004 once a snapped paper point is multiplied up by
//   the scale. Rounding that raw number would print 2,815* over a size that
//   is exactly 2,810; the figure at the dimension's own decimals is what is
//   rounded, so it must stay 2,810 and unmarked.
// - Adam's case from the screenshot: 6,413 must read 6,415, marked.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DimensionRoundUp__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with Round up to 5 mm.
//
// =============================================================================

import { copyFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const MARKUP     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor', '15__Core__Markup');
    const MODULE     = 'Na__LayoutEditor__DimensionRounding__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-dimround-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');
    copyFileSync(join(MARKUP, MODULE), join(SCRATCH, MODULE));
    const round = await import(pathToFileURL(join(SCRATCH, MODULE)).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, wantMm, wantRounded) {
        const passed = got.valueMm === wantMm && got.rounded === wantRounded;
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + (passed ? '' : '  ->  ' + JSON.stringify(got)));
    }
    const up = round.Na__LeDimRound__Up;

    console.log('TrueVision3D - dimension round up to 5 mm');

    // -- ADAM'S CASE AND PLAIN ROUNDING UP ----------------------------------
    check('6,413 reads 6,415, marked (the screenshot)',            up(6413, 0, 5),           6415, true);
    check('6,416 reads 6,420: always UP, never to the nearest',     up(6416, 0, 5),           6420, true);
    check('6,411 reads 6,415, not 6,410',                           up(6411, 0, 5),           6415, true);
    check('6,412.6 prints 6,413 at 0 decimals, so reads 6,415',     up(6412.6, 0, 5),         6415, true);

    // -- ALREADY ON THE STEP: EXACT, NOT MARKED -----------------------------
    check('2,810 stays 2,810, unmarked',                            up(2810, 0, 5),           2810, false);
    check('8,320 stays 8,320, unmarked',                            up(8320, 0, 5),           8320, false);
    check('0 stays 0, unmarked',                                    up(0, 0, 5),              0,    false);

    // -- FLOATING POINT NOISE ------------------------------------------------
    check('2,810.0000004 (snap noise) stays 2,810, unmarked',       up(2810.0000004, 0, 5),   2810, false);
    check('2,809.9999996 (snap noise) stays 2,810, unmarked',       up(2809.9999996, 0, 5),   2810, false);
    check('56.2 mm of paper x 50 stays 2,810, unmarked',            up(56.2 * 50, 0, 5),      2810, false);
    check('2,810.4 prints 2,810 at 0 decimals: stays, unmarked',    up(2810.4, 0, 5),         2810, false);
    check('2,810.5 prints 2,811 at 0 decimals: reads 2,815',        up(2810.5, 0, 5),         2815, true);

    // -- DECIMALS -----------------------------------------------------------
    check('6,413.27 at 1 decimal reads 6,415, marked',              up(6413.27, 1, 5),        6415, true);
    check('2,810.04 at 1 decimal prints 2,810.0: stays',            up(2810.04, 1, 5),        2810, false);
    check('2,810.06 at 1 decimal prints 2,810.1: reads 2,815',      up(2810.06, 1, 5),        2815, true);

    // -- THE SIGN AND OTHER STEPS -------------------------------------------
    check('A negative value rounds its size: -6,413 reads 6,415',   up(-6413, 0, 5),          6415, true);
    check('A 2.5 step: 1,001 reads 1,002.5',                        up(1001, 1, 2.5),         1002.5, true);
    check('A 0.05 step at 2 decimals: 12.35 stays',                 up(12.35, 2, 0.05),       12.35, false);
    check('A 10 step: 6,413 reads 6,420',                           up(6413, 0, 10),          6420, true);

    // -- NOTHING TO ROUND TO -------------------------------------------------
    check('A step of 0 rounds nothing',                             up(6413, 0, 0),           6413, false);
    check('A missing step rounds nothing',                          up(6413, 0, undefined),   6413, false);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures ? ('\n' + failures + ' check(s) FAILED') : '\nEvery check passed.');
    process.exit(failures ? 1 : 0);

// endregion -------------------------------------------------------------------
