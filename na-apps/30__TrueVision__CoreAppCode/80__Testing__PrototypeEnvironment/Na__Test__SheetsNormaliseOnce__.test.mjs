// =============================================================================
// TRUEVISION3D - TEST - SHEETS ARE NORMALISED ONCE PER ANNOUNCEMENT
// =============================================================================
//
// FILE       : Na__Test__SheetsNormaliseOnce__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Sheets Normalise Once Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove GetSheets runs the normaliser over a sheet once per announcement and not once per read, and that nothing which could have changed a sheet is missed
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHY. Every tool asks for the active sheet on every pointer move, and
//   GetSheets used to normalise every record of every sheet in the pack each
//   time: 1.3 ms a read on RB05, eight reads a move with the Dimension tool
//   up. It now passes over a sheet it has normalised since anything could have
//   changed it. This suite is what says "anything".
// - THE SHEETS UNIT is the shipped file with its import lines swapped for
//   stubs and nothing else touched. The stub normaliser COUNTS its calls and
//   does the one thing the real one does that matters here: it replaces the
//   groups list with a filtered copy, every pass.
// - THE STATE UNIT is loaded the same way, to prove the Revision has already
//   moved when the first listener of an announcement runs.
// - MUTATION CHECKED on copies held in memory, the shipped file untouched:
//   each way of getting the rule wrong fails at least one check.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SheetsNormaliseOnce__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.1
// - A checkout with core.autocrlf=true gives the units CRLF line ends, and
//   two of the mutations span lines joined by '\n', so they matched nothing
//   and the file stopped at the first of them. load() now reads a unit as
//   LF, as Na__TestEnv__ObjectSnapBundle__ does.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with the pointer-move and repaint fixes (TrueVision3D v2.136.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const SHEETS     = '51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetModel__Sheets__.js';
    const STATE      = '51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetModel__State__.js';
    let   Serial     = 0;

    // mutate(source) -> source, optional: a deliberate fault for the mutation checks
    async function load(relative, stubs, tag, mutate) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');   // <-- CRLF files are read as LF first: a mutation that spans lines joins them with '\n'
        const had = /^\s*import\s/m.test(src);
        // The trailing `// <-- ...` note some imports carry is part of the line.
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        if (mutate) {
            const changed = mutate(src);
            if (changed === src) { console.error('FAIL: a mutation changed nothing in ' + relative + ' (' + tag + ')'); process.exit(1); }
            src = changed;
        }
        const tmp = join(tmpdir(), 'Na__Test__SheetsNormaliseOnce__' + tag + '__' + (Serial++) + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    // WHAT THE SHEETS UNIT IMPORTS, as stubs. The state is a plain let here (the
    // import lines are gone, so the unit reads these), with doors for the test.
    const SHEETS_STUBS = `
        const Na__LeRegNum__Plan = () => [], Na__LeRegNum__Apply = () => {};
        const Na__LeCfg__GetDrawingRegisterSetup = () => ({ prefix : 'D', start : 1, digits : 2 }), Na__LeCfg__FormatLabel = (key, fallback) => fallback;
        const Na__CfApi__GetLoadedProjectData = () => ({});
        const Na__LeCommon__Uses = () => false, Na__LeCommon__SetUses = () => {}, Na__LeCommon__Set = () => {}, Na__LeCommon__Seed = () => {};
        const Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural', Na__LeRec__DRAWING_SITEPLAN = 'siteplan';
        const Na__LeRec__IsSitePlanSheet = (sheet) => !!sheet && sheet.Sheet__DrawingType === 'siteplan';
        const Na__LeRec__NextId = (list, prefix) => prefix + String(list.length + 1).padStart(3, '0');
        const Na__LeRec__Find = (list, key, id) => (Array.isArray(list) ? list.find((item) => item && item[key] === id) : null) || null;
        const Na__LeRec__BuildFields = () => ({}), Na__LeRec__DrawingNumber = () => '', Na__LeRec__Phase = () => '', Na__LeRec__DocumentId = () => '';
        const Na__LeRec__ComposeDocumentId = () => '', Na__LeRec__ShortCode = () => '', Na__LeRec__StripSheetCode = (name) => name, Na__LeRec__NormaliseMarginNotes = () => {};
        export const Test__Passes = [];                                          // <-- [ sheetId, index ] per call of the normaliser
        const Na__LeRec__NormaliseSheet = (sheet, index) => {
            Test__Passes.push([ sheet.Sheet__Id, index ]);
            if (!Number.isFinite(sheet.Sheet__Order)) sheet.Sheet__Order = index + 1;
            [ 'Sheet__Layers', 'Sheet__Viewports', 'Sheet__Annotations', 'Sheet__Dimensions', 'Sheet__Shapes', 'Sheet__Leaders' ].forEach((key) => { if (!Array.isArray(sheet[key])) sheet[key] = []; });
            sheet.Sheet__Groups = (Array.isArray(sheet.Sheet__Groups) ? sheet.Sheet__Groups : []).filter((g) => g && typeof g === 'object');   // <-- A NEW list every pass, as the real one makes
            return sheet;
        };
        let Na__LeModel__ActiveSheetId = null, Na__LeModel__Revision = 0, Test__Array = [];
        const Na__LeModel__Dispatch = () => { Na__LeModel__Revision += 1; }, Na__LeModel__Touch = () => { Na__LeModel__Revision += 1; };
        const Na__LeModel__Array = () => Test__Array;
        const Na__LeModel__AssignActiveSheetId = (id) => { Na__LeModel__ActiveSheetId = id; }, Na__LeModel__AssignSelectionItems = () => {}, Na__LeModel__AssignDirty = () => {};
        export const Test__SetArray = (list) => { Test__Array = list; };
        export const Test__Announce = () => { Na__LeModel__Revision += 1; };
        export const Test__SetActive = (id) => { Na__LeModel__ActiveSheetId = id; };
    `;

    const STATE_STUBS = `
        const Na__DrawData__SHEETS_KEY = 'Sheets', Na__DrawData__GetBlock = () => null;
        const Na__LeRec__KIND_2D = '2d', Na__LeRec__KIND_3D = '3d', Na__LeRec__LAYER_TYPES = [], Na__LeRec__STYLE_KEYS = [];
        const Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural', Na__LeRec__DRAWING_SITEPLAN = 'siteplan';
    `;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0, quiet = false, quietFailures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (quiet) { if (!passed) quietFailures++; return; }
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }

    const sheet = (id, order, extra) => Object.assign({
        Sheet__Id : id, Sheet__Order : order, Sheet__Layers : [], Sheet__Viewports : [], Sheet__Annotations : [],
        Sheet__Dimensions : [], Sheet__Shapes : [], Sheet__Leaders : [], Sheet__Groups : []
    }, extra || {});

    console.log('TrueVision3D - sheets are normalised once per announcement');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Rule, Run Against One Loaded Copy of the Sheets Unit
// -----------------------------------------------------------------------------

    async function RunRule(tag, mutate) {
        const M = await load(SHEETS, SHEETS_STUBS, tag, mutate);
        const passes = M.Test__Passes;
        const since  = () => { const out = passes.map((p) => p[0]); passes.length = 0; return out; };

        const a = sheet('Sheet_A', 2), b = sheet('Sheet_B', 1), c = sheet('Sheet_C', 3);
        const list = [ a, 'not a sheet', b, null, { Sheet__Name : 'no id' }, c ];
        M.Test__SetArray(list);

        // THE FIRST READ normalises every sheet, once, and hands each its place among the sheets (not in the raw array)
        const first = M.Na__LeModel__GetSheets();
        check('the first read normalises every sheet once', passes.map((p) => p[0]), [ 'Sheet_A', 'Sheet_B', 'Sheet_C' ]);
        check('  and hands the normaliser each sheet\'s place among the sheets, as before', passes.map((p) => p[1]), [ 0, 1, 2 ]);
        check('  and answers in tab order, leaving out what is not a sheet', first.map((s) => s.Sheet__Id), [ 'Sheet_B', 'Sheet_A', 'Sheet_C' ]);
        since();

        // READS AFTER THAT cost no pass at all
        M.Na__LeModel__GetSheets(); M.Na__LeModel__GetSheets();
        check('a second and a third read normalise nothing', since(), []);
        check('one sheet by id normalises nothing, and finds it', [ M.Na__LeModel__GetSheetById('Sheet_C') === c, since() ], [ true, [] ]);
        M.Test__SetActive('Sheet_A');
        check('the active sheet normalises nothing, and is the live record', [ M.Na__LeModel__GetActiveSheet() === a, since() ], [ true, [] ]);
        for (let i = 0; i < 8; i++) M.Na__LeModel__GetActiveSheet();            // <-- A pointer move with the Dimension tool up
        check('eight reads in a row (one pointer move) normalise nothing', since(), []);

        // A SILENT EDIT of a record already there is not a reason: its Update normalised it
        a.Sheet__Dimensions.push({ Dimension__Id : 'Dim_001' }); M.Na__LeModel__GetSheets(); since();
        a.Sheet__Dimensions[0].Dimension__OffsetMm = 12;
        check('a field written on a record already there brings no pass', (M.Na__LeModel__GetSheets(), since()), []);

        // AN ANNOUNCEMENT brings every sheet back, once
        M.Test__Announce();
        check('an announcement normalises every sheet again, once', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_A', 'Sheet_B', 'Sheet_C' ]);
        check('  and the read after it normalises nothing', (M.Na__LeModel__GetSheets(), since()), []);

        // A RECORD PUSHED BEHIND THE MODEL'S BACK, no announcement: that sheet, and only that sheet
        b.Sheet__Shapes.push({ Shape__Id : 'Shape_Raw' });
        check('a record pushed with no announcement normalises its sheet alone', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_B' ]);
        b.Sheet__Shapes.splice(0, 1);
        check('a record spliced out with no announcement does the same', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_B' ]);

        // A LIST REPLACED by one of the same length (an undo swaps every list for the snapshot's)
        c.Sheet__Annotations = [];
        check('a list replaced by one the same length normalises its sheet alone', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_C' ]);

        // THE PASS REPLACES THE GROUPS LIST ITSELF, every time: that must not read as a change
        check('the list the pass itself replaces does not bring the sheet back', (M.Na__LeModel__GetSheets(), M.Na__LeModel__GetSheets(), since()), []);

        // A SHEET NOT MET BEFORE: a duplicate, a create
        const d = sheet('Sheet_D', 4);
        list.push(d);
        check('a sheet added to the array is normalised, and the others are not', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_D' ]);

        // A WHOLE LOAD: new objects in the same array (RestoreSheets empties and refills it)
        list.length = 0;
        [ sheet('Sheet_A', 1), sheet('Sheet_B', 2) ].forEach((s) => list.push(s));
        check('new objects under the old ids (a restore) are all normalised', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_A', 'Sheet_B' ]);
        M.Test__SetArray([ sheet('Sheet_Z', 1) ]);
        check('a different array (a project load) is normalised', (M.Na__LeModel__GetSheets(), since()), [ 'Sheet_Z' ]);
        check('  and then left alone', (M.Na__LeModel__GetSheets(), since()), []);
    }

    await RunRule('Shipped', null);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Revision Has Moved Before the First Listener Runs
// -----------------------------------------------------------------------------

    {
        globalThis.window = new EventTarget();
        const S = await load(STATE, STATE_STUBS, 'State', null);
        const seen = [];
        window.addEventListener(S.Na__LeModel__CHANGED_EVENT, () => seen.push(S.Na__LeModel__Revision));
        const before = S.Na__LeModel__Revision;
        S.Na__LeModel__Dispatch('annotation', 'Sheet_A', 'Note_001');
        S.Na__LeModel__Touch('dimension', 'Sheet_A', 'Dim_001');
        check('Dispatch moves the Revision on BEFORE its listeners run (and Touch goes through it)', seen, [ before + 1, before + 2 ]);
        check('  the Revision reads live from outside the unit', S.Na__LeModel__Revision, before + 2);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mutation Checks: Each Way of Getting the Rule Wrong Is Caught
// -----------------------------------------------------------------------------

    const MUTATIONS = [
        [ 'never normalises (IsNormalised always true)',
          (src) => src.replace('const seen = Na__LeModel__Normalised.get(sheet);\n        if (!seen || seen.revision !== Na__LeModel__Revision) return false;', 'return true;\n        const seen = null;') ],
        [ 'always normalises (the old behaviour)',
          (src) => src.replace('if (Na__LeModel__IsNormalised(sheet)) return;', '') ],
        [ 'ignores announcements (no Revision test)',
          (src) => src.replace('if (!seen || seen.revision !== Na__LeModel__Revision) return false;', 'if (!seen) return false;') ],
        [ 'ignores a list\'s length',
          (src) => src.replace(' || seen.lengths[i] !== (Array.isArray(list) ? list.length : -1)) return false;', ') return false;') ],
        [ 'ignores a list being replaced',
          (src) => src.replace('if (seen.lists[i] !== list || ', 'if (') ],
        [ 'notes the sheet BEFORE its pass',
          (src) => src.replace('Na__LeRec__NormaliseSheet(sheet, index);\n            Na__LeModel__NoteNormalised(sheet);', 'Na__LeModel__NoteNormalised(sheet);\n            Na__LeRec__NormaliseSheet(sheet, index);') ]
    ];
    for (let i = 0; i < MUTATIONS.length; i++) {
        quiet = true; quietFailures = 0;
        await RunRule('Mutant' + i, MUTATIONS[i][1]);
        quiet = false;
        check('MUTATION caught: ' + MUTATIONS[i][0], quietFailures > 0, true);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log(failures === 0 ? '\nEvery check passed.' : '\n' + failures + ' check(s) FAILED.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
