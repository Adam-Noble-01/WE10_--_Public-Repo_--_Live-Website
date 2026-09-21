// =============================================================================
// TRUEVISION3D - TEST - TITLE BLOCK CELLS
// =============================================================================
//
// FILE       : Na__Test__TitleBlockCells__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Title Block Cells Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the modern title block's cell widths: fixed cells stay fixed, the title takes the rest, nothing is cut while a cell has room to give, and A4 degrades in order
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The cells module imports nothing, so it runs here exactly as the app runs
//   it, against the app's own config rows. Node 20 reads the app's .js modules
//   as CommonJS, so the module is copied to a temporary .mjs first.
// - THE FIXTURE IS PS01. NEEDS below is what each cell of PS01 D02's title
//   block asks for - the wider of its label and its value, with the 1.4 mm
//   padding either side - measured on 19-Sep-2026 with the vendored jsPDF and
//   the real Open Sans Regular cut at 2.2 mm. Written out rather than measured
//   here, so the test needs no font and does not change when a drawing does.
// - Strip widths are the paper's width, less the 5 mm margins, less the 40 mm
//   logo cell: A1 791, A2 544, A3 370, A4 landscape 247, A4 portrait 160.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__TitleBlockCells__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Written with the cells module, for the title block re-proportioning.
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
    const EDITOR     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-titlecells-'));
    copyFileSync(join(EDITOR, '10__Core__SheetSurface', 'Na__LayoutEditor__TitleBlock__Cells__.js'), join(SCRATCH, 'Cells.mjs'));
    const cells  = await import(pathToFileURL(join(SCRATCH, 'Cells.mjs')).href);
    const config = JSON.parse(readFileSync(join(EDITOR, '03__Core__Config', 'Na__LayoutEditor__AppConfig__.json'), 'utf8'))['LayoutEditor__TitleBlock__Config'];
    const ROWS   = config['LayoutEditor__TitleBlock__Rows'];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fixture: What PS01 D02's Cells Ask For
// -----------------------------------------------------------------------------

    const STRIP = { A1 : 791, A2 : 544, A3 : 370, A4 : 247, A4P : 160 };

    // Text width + 2.8 mm of padding, Open Sans Regular at 2.2 mm (labels at 1.6 mm tracked 0.05).
    const NEEDS = {
        Client      : 15.31,     // Mr P. Samra
        SiteAddress : 67.01,     // 255 Musters Road, West Bridgford, Nottinghamshire, NG2 7DD
        Title       : 91.61,     // Permitted Development Compliance - Existing Conditions & Design Proposal Elevations
        DocumentId  : 17.61,     // PS01_T01_D02
        Revision    : 5.78,      // B - the label REV is wider than the value. "Revision B" (14.24) since 21-Sep-2026 on paper with room; on a strip too narrow for every value (A4) the builder drops the word and asks for this again
        Scale       : 17.02,     // 1:50 @ ISO A2
        Date        : 15.28,     // 19 Sep 2026
        DrawnBy     : 11.46,     // A. Noble
        Status      : 18.62      // FOR PLANNING
    };

    // The label alone + 2.8 mm of padding: the least a Flex cell may be cut to.
    const FLOORS = { Client : 8.36, SiteAddress : 13.88, Title : 15.25, DocumentId : 14.37, Revision : 5.78, Scale : 7.67, Date : 6.94, DrawnBy : 11.39, Status : 8.80 };

    function solve(stripMm, needs) {
        const asked  = Object.assign({}, NEEDS, needs || {});
        const widths = cells.Na__LeTitleCells__Solve(stripMm, ROWS.map((row) => cells.Na__LeTitleCells__Cell(row, asked[row.Key], FLOORS[row.Key])));
        const byKey  = {};
        ROWS.forEach((row, index) => { byKey[row.Key] = widths[index]; });
        return { widths : widths, byKey : byKey, asked : asked, total : widths.reduce((sum, mm) => sum + mm, 0) };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failed = 0;
    function check(name, ok, detail) {
        if (!ok) failed++;
        console.log((ok ? '  pass  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
    }
    const near   = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-6 : tolerance);
    const fixed  = ROWS.filter((row) => !(row.Flex > 0));
    const cutOff = (result) => ROWS.filter((row) => result.byKey[row.Key] + 1e-6 < result.asked[row.Key]).map((row) => row.Key);

    console.log('THE CONFIG');
    check('Status is the last row, at the right-hand end of the strip', ROWS[ROWS.length - 1].Key === 'Status');
    check('the Drawing Title is the one Flex row', ROWS.filter((row) => row.Flex > 0).map((row) => row.Key).join() === 'Title');
    const module28 = [ 'Revision', 'Scale', 'Date', 'DrawnBy' ].map((key) => ROWS.find((row) => row.Key === key).WidthMm);
    check('Rev, Scale, Date and Drawn By are one size', module28.every((mm) => mm === module28[0]), module28.join(' / '));
    const STATUSES = config['LayoutEditor__TitleBlock__Statuses'];
    check('the config lists the statuses, none blank and none twice', Array.isArray(STATUSES) && STATUSES.length > 0 && STATUSES.every((status) => typeof status === 'string' && status.trim() !== '') && new Set(STATUSES).size === STATUSES.length, STATUSES.length + ' listed');
    check('the four Adam named are among them', [ 'FOR APPROVAL', 'FOR TENDER', 'FOR CONSTRUCTION', 'AS BUILT' ].every((status) => STATUSES.indexOf(status) !== -1));
    // Measured 19-Sep-2026, Open Sans Regular at 2.2 mm plus 2.8 mm of padding. A status added to the config since is not in this table and is not judged.
    const STATUS_NEEDS = { 'PRELIMINARY' : 16.70, 'FOR INFORMATION' : 22.62, 'FOR COMMENT' : 18.72, 'FOR COORDINATION' : 24.19, 'FOR APPROVAL' : 18.53, 'FOR PLANNING' : 18.62,
                           'FOR BUILDING CONTROL' : 28.58, 'FOR PRICING' : 16.13, 'FOR TENDER' : 15.84, 'FOR CONSTRUCTION' : 24.29, 'AS BUILT' : 11.97, 'SUPERSEDED' : 16.36 };
    const statusMm = ROWS.find((row) => row.Key === 'Status').WidthMm;
    const tooWide  = STATUSES.filter((status) => STATUS_NEEDS[status] !== undefined && STATUS_NEEDS[status] > statusMm);
    check('every measured status fits the Status cell without borrowing', tooWide.length === 0, tooWide.join() || (statusMm + ' mm cell'));

    console.log('A2, THE SHEET ADAM MARKED UP');
    const a2 = solve(STRIP.A2);
    check('the strip is filled exactly', near(a2.total, STRIP.A2));
    check('every fixed cell is its configured width', fixed.every((row) => near(a2.byKey[row.Key], row.WidthMm)));
    check('the Client cell is less than half the 76 mm it was', a2.byKey.Client < 38, a2.byKey.Client.toFixed(1) + ' mm');
    check('the Document ID cell is about a third of the 71 mm it was', a2.byKey.DocumentId < 25, a2.byKey.DocumentId.toFixed(1) + ' mm');
    check('the Drawing Title has the rest, and far more than the 92 mm that cut it off', a2.byKey.Title > 250, a2.byKey.Title.toFixed(1) + ' mm');
    check('nothing is cut off', cutOff(a2).length === 0, cutOff(a2).join());

    console.log('THE SAME DIVIDERS ON EVERY SHEET OF A PACK');
    const a2short = solve(STRIP.A2, { Title : 24.52 });
    check('a short title and a long one give identical cells on roomy paper', a2.widths.every((mm, index) => near(mm, a2short.widths[index])));

    console.log('A3, WHERE THE ROOM IS TIGHT');
    const a3 = solve(STRIP.A3);
    check('the strip is filled exactly', near(a3.total, STRIP.A3));
    check('PS01\'s 84 character title still fits', a3.byKey.Title >= NEEDS.Title, a3.byKey.Title.toFixed(1) + ' mm against ' + NEEDS.Title);
    check('and no fixed cell moved to make it fit', fixed.every((row) => near(a3.byKey[row.Key], row.WidthMm)));

    console.log('GROW IF ABSOLUTELY REQUIRED');
    const longTitle = solve(STRIP.A3, { Title : 120 });
    check('a title longer than its share borrows from cells with room, and fits', near(longTitle.byKey.Title, 120, 1e-6), longTitle.byKey.Title.toFixed(2));
    check('the strip is still filled exactly', near(longTitle.total, STRIP.A3));
    check('no cell gave up room its own text needs', cutOff(longTitle).length === 0, cutOff(longTitle).join());
    check('the Site Address, with 3 mm to spare, gave less than the Rev cell with 22', (70 - longTitle.byKey.SiteAddress) < (28 - longTitle.byKey.Revision));

    const longAddress = solve(STRIP.A2, { SiteAddress : 108 });
    check('a long address grows on A2 out of the paper\'s spare room alone', near(longAddress.byKey.SiteAddress, 108) && fixed.filter((row) => row.Key !== 'SiteAddress').every((row) => near(longAddress.byKey[row.Key], row.WidthMm)));

    const threeScales = solve(STRIP.A2, { Scale : 32.47 });
    check('a three-scale label is never cut: the Scale cell grows to hold it', near(threeScales.byKey.Scale, 32.47), threeScales.byKey.Scale.toFixed(2));

    console.log('A4 LANDSCAPE, NARROWER THAN THE STRIP');
    const a4 = solve(STRIP.A4);
    check('the strip is filled exactly', near(a4.total, STRIP.A4));
    check('only the title is cut: every other cell kept its text', cutOff(a4).join() === 'Title', cutOff(a4).join());
    check('no cell is wider than it was configured', ROWS.every((row) => a4.byKey[row.Key] <= row.WidthMm + 1e-6 || row.Key === 'Title'));

    console.log('A STRIP TOO NARROW EVEN FOR THE TEXT: THE TITLE GIVES WAY FIRST');
    // 192 mm is A4 landscape with a 55 mm cell off the right-hand end, where the QR cell's
    // session found every value being cut together (Cells 1.0.0 scaled the lot at this point).
    const narrow = solve(192);
    check('the strip is filled exactly', near(narrow.total, 192));
    check('only the title is cut: the date, the scale and the number keep their text', cutOff(narrow).join() === 'Title', cutOff(narrow).join());
    check('the title is cut below its configured width, but not below its own label', narrow.byKey.Title < 60 && narrow.byKey.Title >= FLOORS.Title - 1e-6, narrow.byKey.Title.toFixed(2) + ' mm, floor ' + FLOORS.Title);

    console.log('A4 PORTRAIT, WHERE NOTHING FITS');
    const a4p = solve(STRIP.A4P);
    check('the strip is filled exactly', near(a4p.total, STRIP.A4P));
    check('every cell has some width', a4p.widths.every((mm) => mm > 0));
    check('the title is down to its label before anything else is scaled', near(a4p.byKey.Title / FLOORS.Title, a4p.byKey.Date / NEEDS.Date, 1e-6) && a4p.byKey.Title < FLOORS.Title, 'title ' + a4p.byKey.Title.toFixed(2) + ' of a ' + FLOORS.Title + ' floor');
    check('so every other value loses an eighth of its cell, where it used to lose a third', a4p.byKey.Date / NEEDS.Date > 0.85, (100 * (1 - a4p.byKey.Date / NEEDS.Date)).toFixed(1) + ' percent');

    console.log('A2 AND A1 GIVE THE FIXED CELLS A FIFTH MORE (21-Sep-2026)');
    // Adam: on A2 and A1, "20% more space" for the address and each box on the
    // right, the drawing title excepted. These strips have the QR cell off the
    // end, as the app draws them: A2 544 - 56, A1 791 - 56, A2 portrait 370 - 56.
    const WIDE    = { A1 : 735, A2 : 488, A2P : 314 };
    const FACTORS = config['LayoutEditor__TitleBlock__RowWidthFactorByPaper'] || {};
    function solveWide(stripMm, factor, needs) {
        const asked  = Object.assign({}, NEEDS, needs || {});
        const given  = ROWS.map((row) => cells.Na__LeTitleCells__Cell(row, asked[row.Key], FLOORS[row.Key]));
        const before = JSON.stringify(given);
        const wider  = cells.Na__LeTitleCells__Widen(stripMm, given, factor);
        const widths = cells.Na__LeTitleCells__Solve(stripMm, wider);
        const byKey  = {};
        ROWS.forEach((row, index) => { byKey[row.Key] = widths[index]; });
        return { widths : widths, byKey : byKey, asked : asked, total : widths.reduce((sum, mm) => sum + mm, 0), untouched : JSON.stringify(given) === before };
    }
    check('the config asks a fifth more on A2 and A1, and on nothing smaller', FACTORS.A2 === 1.2 && FACTORS.A1 === 1.2 && !FACTORS.A3 && !FACTORS.A4, JSON.stringify(FACTORS));
    const wideA2 = solveWide(WIDE.A2, FACTORS.A2);
    check('A2: every fixed cell is a fifth wider', fixed.every((row) => near(wideA2.byKey[row.Key], row.WidthMm * 1.2)), fixed.map((row) => row.Key + ' ' + wideA2.byKey[row.Key].toFixed(1)).join(', '));
    check('A2: the Site Address is 84 mm', near(wideA2.byKey.SiteAddress, 84), wideA2.byKey.SiteAddress.toFixed(2));
    check('A2: the Drawing Title has the rest, 161.6 mm, and nothing is cut', near(wideA2.byKey.Title, WIDE.A2 - 326.4) && cutOff(wideA2).length === 0, wideA2.byKey.Title.toFixed(2) + ' mm');
    check('A2: the strip is filled exactly', near(wideA2.total, WIDE.A2));
    check('Widen leaves the cells it is handed alone', wideA2.untouched);
    // RB05's address is 84 mm of text in a 70 mm base: it had already grown to
    // fit, and 70 x 1.2 is 84 again - so a fifth on the BASE gave the one cell
    // Adam pointed at no air at all. The fifth is on what the cell prints at.
    const rb05 = solveWide(WIDE.A2, FACTORS.A2, { SiteAddress : 84 });
    check('RB05: an address that had grown to 84 mm to fit gets a fifth on top of that, 100.8 mm', near(rb05.byKey.SiteAddress, 100.8) && cutOff(rb05).length === 0, rb05.byKey.SiteAddress.toFixed(2) + ' mm');
    const wideA1 = solveWide(WIDE.A1, FACTORS.A1);
    check('A1: every fixed cell is a fifth wider too', fixed.every((row) => near(wideA1.byKey[row.Key], row.WidthMm * 1.2)));
    const longOnA2 = solveWide(WIDE.A2, 1.2, { Title : 200 });
    const fraction = (longOnA2.byKey.Client / 36) - 1;
    check('a 200 mm title keeps every millimetre: the fifth shrinks instead', near(longOnA2.byKey.Title, 200) && cutOff(longOnA2).length === 0, longOnA2.byKey.Title.toFixed(2) + ' mm');
    check('and every fixed cell gets the SAME share of its fifth', fraction > 0 && fraction < 0.2 && fixed.every((row) => near(longOnA2.byKey[row.Key], row.WidthMm * (1 + fraction))), (fraction * 100).toFixed(1) + ' percent');
    const portrait = solveWide(WIDE.A2P, 1.2);
    const plain    = solve(WIDE.A2P);
    check('A2 portrait cannot afford it, and draws exactly the strip it drew before', portrait.widths.every((mm, index) => near(mm, plain.widths[index])));
    check('a factor of 1 changes nothing', solveWide(WIDE.A2, 1).widths.every((mm, index) => near(mm, solve(WIDE.A2).widths[index])));

    console.log('A CALLER THAT GIVES NO FLOOR');
    const noFloor = cells.Na__LeTitleCells__Solve(192, ROWS.map((row) => cells.Na__LeTitleCells__Cell(row, NEEDS[row.Key])));
    check('still fills the strip, and still cuts only the title', near(noFloor.reduce((sum, mm) => sum + mm, 0), 192) && ROWS.every((row, index) => row.Key === 'Title' || noFloor[index] + 1e-6 >= NEEDS[row.Key]));

    console.log('AN OLD CONFIG STILL DRAWS THE OLD STRIP');
    const OLD    = [ 28, 40, 34, 26, 8, 30, 16, 20 ];
    const shares = cells.Na__LeTitleCells__Solve(510, OLD.map((mm) => cells.Na__LeTitleCells__Cell({ WidthMm : mm }, 0)));
    check('with no Flex row the spare room is shared in proportion, as it always was', shares.every((mm, index) => near(mm, 510 * OLD[index] / 202)));

    console.log('DEGENERATE INPUT');
    check('no cells, no widths', cells.Na__LeTitleCells__Solve(500, []).length === 0);
    check('no strip, all zero', cells.Na__LeTitleCells__Solve(0, [ cells.Na__LeTitleCells__Cell({ WidthMm : 20 }, 5) ]).join() === '0');
    check('a row with no WidthMm takes the module default', cells.Na__LeTitleCells__Cell({ Key : 'X' }, 0).base === 28);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('');
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : failed + ' CHECK(S) FAILED');
    process.exit(failed === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
