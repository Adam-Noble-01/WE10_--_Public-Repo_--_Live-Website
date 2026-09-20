// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - SCALE BAR
// =============================================================================
//
// FILE       : Na__Test__ScrapbookScaleBar__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Parametric Scrapbook Scale Bar Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the parametric scale bar draws the house bar, that every standard scale reads sensibly, and that its split, stretch and limits hold
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The scale bar module imports nothing, so it runs here exactly as the app
//   runs it, against the app's own config file. Node 20 reads the app's .js
//   modules as CommonJS, so the module is copied to a temporary .mjs first.
// - THE FIXTURE IS ADAM'S BAR. HOUSE_BAR below is the bar he drew by hand on
//   PS02 D21 Floor Plans under "EXISTING GROUND FLOOR PLAN" (A2, 1:50), read
//   on 19-Sep-2026 and rebased to its own top left corner. It is written out
//   here rather than read from the project, so the test does not change when
//   that drawing does. Eleven other bars on PS02's sheets agree with it.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookScaleBar__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Written with the scale bar, TrueVision3D v2.76.0.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test and Its Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const FEATURE    = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor', '57__Feature__ScrapbookParametric');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-scalebar-'));
    copyFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js'), join(SCRATCH, 'ScaleBar.mjs'));
    const bar    = await import(pathToFileURL(join(SCRATCH, 'ScaleBar.mjs')).href);
    const config = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'))['LayoutEditor__ScrapbookParametric__ScaleBar'];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fixture: the Bar Adam Drew by Hand
// -----------------------------------------------------------------------------

    // Ten cells, left to right, the top row before the bottom in each: [ x0, x1, y0, y1, fill ].
    const HOUSE_BAR = {
        stroke : '#172b3a', strokePt : 0.2,
        cells  : [
            [  0,  20, 0, 1, null      ], [  0,  20, 1, 2, '#858585' ],
            [ 20,  40, 0, 1, '#858585' ], [ 20,  40, 1, 2, null      ],
            [ 40,  60, 0, 1, null      ], [ 40,  60, 1, 2, '#858585' ],
            [ 60,  80, 0, 1, '#858585' ], [ 60,  80, 1, 2, null      ],
            [ 80, 100, 0, 1, null      ], [ 80, 100, 1, 2, '#858585' ]
        ],
        // [ text, size mm ] - centred on each division, baseline 7.314 mm under the bar's top, weight 400. His are hand placed within 0.6 mm of the divisions.
        numerals : [ [ '0', 2.5 ], [ '1', 2 ], [ '2', 2 ], [ '3', 2 ], [ '4', 2 ], [ '5', 2.5 ] ],
        baselineMm : 7.314, colour : '#172b3a', weight : 400
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failed = 0;
    const check = (name, pass, detail) => { if (!pass) failed++; console.log((pass ? '  PASS  ' : '  FAIL  ') + name + ((!pass && detail !== undefined) ? '   ' + JSON.stringify(detail) : '')); };
    const near  = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-6 : tolerance);
    const cellsOf    = (built) => built.records.filter((r) => r.kind === 'shape').map((r) => r.record);
    const numeralsOf = (built) => built.records.filter((r) => r.kind === 'annotation').map((r) => r.record);
    const alternates = (cells) => { for (let i = 0; i + 2 < cells.length; i += 2) if ((cells[i].Shape__FillColour === null) === (cells[i + 2].Shape__FillColour === null)) return false; return true; };

    console.log('\nTrueVision3D - parametric scale bar\n');

    // THE HOUSE BAR | 1:50 must be the bar Adam draws, point for point
    const house = bar.Na__LeParamBar__Build(config, bar.Na__LeParamBar__Standard(config, 50));
    const cells = cellsOf(house), numerals = numeralsOf(house);
    check('1:50 is ten cells and six numerals', cells.length === 10 && numerals.length === 6, [ cells.length, numerals.length ]);
    check('the first record is a vector whose first point is the origin (how the engine finds a moved bar)', house.records[0].kind === 'shape' && cells[0].Shape__Points[0][0] === 0 && cells[0].Shape__Points[0][1] === 0);
    check('every cell matches the hand-drawn cell: corners, fill, edge', cells.every((cell, i) => {
        const [ x0, x1, y0, y1, fill ] = HOUSE_BAR.cells[i];
        const want = [ [ x0, y0 ], [ x1, y0 ], [ x1, y1 ], [ x0, y1 ] ];
        return cell.Shape__Points.every((p, k) => near(p[0], want[k][0]) && near(p[1], want[k][1]))
            && (cell.Shape__FillColour || null) === fill && cell.Shape__StrokeColour === HOUSE_BAR.stroke && cell.Shape__StrokePt === HOUSE_BAR.strokePt && cell.Shape__Closed === true;
    }));
    check('every numeral matches: text, size, weight, colour, centred on its division, on his baseline', numerals.every((n, i) =>
        n.Annotation__Text === HOUSE_BAR.numerals[i][0] && n.Annotation__SizeMm === HOUSE_BAR.numerals[i][1] && n.Annotation__FontWeight === HOUSE_BAR.weight
        && n.Annotation__Colour === HOUSE_BAR.colour && n.Annotation__Align === 'center' && near(n.Annotation__PosXMm, i * 20) && near(n.Annotation__PosYMm, HOUSE_BAR.baselineMm, 0.001)));

    // STANDARDS | every listed scale is a 100 mm bar
    config.ScaleBar__Standards.forEach((row) => {
        const built = bar.Na__LeParamBar__Build(config, bar.Na__LeParamBar__Standard(config, row.Scale));
        check('1:' + row.Scale + ' is 100 mm on the paper and reads ' + numeralsOf(built).map((n) => n.Annotation__Text).join(' '), near(built.sizeMm.WidthMm, 100));
    });

    // THE SOLVER | a scale with no row still lands near 20 mm divisions and a 100 mm bar
    [ 30, 75, 125, 400, 5000 ].forEach((scale) => {
        const params = bar.Na__LeParamBar__Standard(config, scale);
        const built  = bar.Na__LeParamBar__Build(config, params);
        const onPaper = params.DivisionMm / scale;
        check('1:' + scale + ' is solved: ' + params.DivisionMm + ' mm x ' + params.Divisions, onPaper >= 10 && onPaper <= 40 && built.sizeMm.WidthMm >= 70 && built.sizeMm.WidthMm <= 130, [ onPaper, built.sizeMm.WidthMm ]);
    });

    // SPLIT FIRST DIVISION | sub-cells, ending exactly on the first numeral, checker unbroken
    const split = cellsOf(bar.Na__LeParamBar__Build(config, Object.assign(bar.Na__LeParamBar__Standard(config, 50), { SubdivideFirst : true })));
    check('split at 1:50: five 4 mm sub-cells then four 20 mm cells', split.length === 18 && near(split[0].Shape__Points[1][0], 4) && near(split[8].Shape__Points[1][0], 20), split.length);
    check('an odd split (five) keeps the checker alternating end to end', alternates(split));
    const even = cellsOf(bar.Na__LeParamBar__Build(config, Object.assign(bar.Na__LeParamBar__Standard(config, 100), { SubdivideFirst : true })));
    check('an even split (1:100, four) keeps the checker alternating end to end', even.length === 16 && alternates(even), even.length);
    check('a split adds no numerals', numeralsOf(bar.Na__LeParamBar__Build(config, Object.assign(bar.Na__LeParamBar__Standard(config, 50), { SubdivideFirst : true }))).length === 6);

    // STRETCH AND LIMITS
    const standard = bar.Na__LeParamBar__Standard(config, 50);
    check('stretch to 138 mm is seven divisions', bar.Na__LeParamBar__StretchTo(config, standard, 138).Divisions === 7);
    check('stretch behind the origin holds at one', bar.Na__LeParamBar__StretchTo(config, standard, -40).Divisions === 1);
    check('stretch far off the paper holds at the maximum', bar.Na__LeParamBar__StretchTo(config, standard, 5000).Divisions === config.ScaleBar__MaxDivisions);

    // NORMALISE | junk in, the default standard out
    const junk = bar.Na__LeParamBar__Normalise(config, { ScaleDenominator : 'fifty', Divisions : -3, SubdivisionMm : 333, Units : 'furlongs' });
    check('junk parameters become the default standard', junk.ScaleDenominator === 50 && junk.Divisions === 5 && junk.SubdivisionMm === 200 && junk.Units === 'm', junk);
    check('an empty config still draws the house bar', cellsOf(bar.Na__LeParamBar__Build({}, { ScaleDenominator : 50 })).length === 10);

    // NUMERALS | a crowded bar thins them and keeps both ends; units go on the last one only
    const crowded = numeralsOf(bar.Na__LeParamBar__Build(config, { ScaleDenominator : 1, DivisionMm : 5, Divisions : 23 })).map((n) => n.Annotation__Text);
    check('divisions 5 mm apart are numbered every second one, ends kept, no collision at the end', crowded[0] === '0' && crowded[crowded.length - 1] === '115' && crowded.indexOf('5') === -1 && crowded.indexOf('110') === -1, crowded);
    check('Show units writes them on the last numeral only', numeralsOf(bar.Na__LeParamBar__Build(config, Object.assign({}, standard, { ShowUnits : true }))).map((n) => n.Annotation__Text).join('|') === '0|1|2|3|4|5 m');
    check('describe reads the length both ways', JSON.stringify(bar.Na__LeParamBar__Describe(config, standard)) === '{"real":"5 m","paper":"100"}');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('\n  ' + (failed ? 'FAIL - ' + failed + ' check(s) did not pass.' : 'PASS - the scale bar draws the house bar and holds its rules.') + '\n');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
