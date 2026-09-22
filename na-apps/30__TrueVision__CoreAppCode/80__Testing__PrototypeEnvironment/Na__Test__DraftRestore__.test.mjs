// =============================================================================
// TRUEVISION3D - TEST - BROWSER DRAFT RESTORE ON A PROJECT LOAD
// =============================================================================
//
// FILE       : Na__Test__DraftRestore__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Browser Draft Restore Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Layout Editor puts an unsaved browser draft back whichever arrives first, the project's drawings or the editor
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE SHIPPED MODULES, wired the way the app wires them: the drawings data
//   (Na__DrawView__ProjectData__), the sheet model's State and Sheets units,
//   the sheet model and the auto save, on one window with a working event
//   bus and a localStorage. Only their leaves are stubbed: records, config,
//   the R2 client.
// - THE DRAWINGS FIRST (the order a real load takes, RB05 on 22-Sep-2026:
//   drawings at 2.0 s, the editor ready at 2.2 s): the draft comes back once
//   the editor is up, the model is dirty, one toast, one console line, the
//   draft itself untouched, and the pack's common fields are seeded.
// - THE EDITOR FIRST: the same, and the restored model STAYS dirty - the load
//   is announced once, not a second time over the restore.
// - NOTHING TO RESTORE: no draft, or a draft the project already matches -
//   the load is announced exactly once and nothing is marked dirty.
// - BEFORE THE PROJECT ARRIVES: the address bar names the project, but its
//   sheets are not there yet, so nothing is restored into the empty block and
//   a change announced meanwhile writes no draft over the one waiting.
// - AFTER THE RESTORE: the first edit keeps the unsaved work in the draft (it
//   used to write the server's sheets plus that edit over it); a save is not
//   a load; a second load landing before the late announcement is announced
//   once.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DraftRestore__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the late start draft restore fix (TrueVision3D v2.145.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough (one per world)
// -----------------------------------------------------------------------------

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };

    // A WORLD is a fresh window: its own listeners, in the order they were
    // added, and its own localStorage. The modules read `window` when they
    // run, so every world's modules talk only to that world.
    function newWorld() {
        const listeners = new Map();
        const store     = new Map();
        globalThis.window = {
            addEventListener    : (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
            removeEventListener : (type, fn) => { const list = listeners.get(type) || []; const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); },
            dispatchEvent       : (event) => { (listeners.get(event.type) || []).slice().forEach((fn) => fn(event)); return true; },
            localStorage        : { getItem : (k) => (store.has(k) ? store.get(k) : null), setItem : (k, v) => { store.set(k, String(v)); }, removeItem : (k) => { store.delete(k); } },
            setTimeout, clearTimeout
        };
        globalThis.document = { visibilityState : 'visible', addEventListener : () => {} };
        return { store };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed, or Linked
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const DATA       = '40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    const SHEETDATA  = '51__System__LayoutEditor/07__Core__SheetData/';
    const STATE_FILE = 'Na__LayoutEditor__SheetModel__State__.js';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'([^']+)';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // The Note Regions test's loader, with one addition. An import from a file
    // named in `links` is KEPT, pointed at that file's loaded copy, because the
    // State unit's exports are live bindings (the dirty flag, the active sheet)
    // and a stub would freeze them. Every other import is stripped, and each
    // name it brought gets the test's stub, else a function returning undefined.
    let Serial = 0;
    async function load(relative, stubs, links) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const names = [];
        src = src.replace(IMPORT, (whole, list, from) => {
            const file = from.split('/').pop();
            if (links && links[file]) return 'import ' + list.trim() + " from '" + links[file] + "';";
            const body = list.trim();
            if (body.charAt(0) === '{') body.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
            return '';
        });
        const survivors = [ ...src.matchAll(IMPORT) ].filter((m) => !m[2].startsWith('file:'));
        if (survivors.length || /^[ \t]*import\s+'/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const key = '__DraftRestoreStubs' + (++Serial);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__DraftRestore__' + Serial + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        const url = pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2);
        return { ns : await import(url), url };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks and the Records
// -----------------------------------------------------------------------------

    const out = console.log.bind(console);
    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        out((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) out('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }

    const DRAFT_MS  = 40;                                                        // <-- The config's DraftDebounceMs, shortened
    const DRAFT_KEY = 'Na__LayoutEditor__Draft__RB05';
    const wait      = (ms) => new Promise((done) => setTimeout(done, ms));
    const settle    = () => wait(0);                                             // <-- Every queued microtask has run

    // COMPLETE RECORDS, so the stub normaliser has nothing to add and a draft
    // compares with the model exactly as the shipped one does.
    const SHEET = (id, order, name, texts) => ({
        Sheet__Id : id, Sheet__Name : name, Sheet__Order : order,
        Sheet__Layers : [], Sheet__Viewports : [],
        Sheet__Annotations : texts.map((text, i) => ({ Annotation__Id : 'Text_' + String(i + 1).padStart(3, '0'), Annotation__Text : text })),
        Sheet__Dimensions : [], Sheet__Shapes : [], Sheet__Leaders : [], Sheet__Groups : []
    });
    const SERVER  = () => [ SHEET('Sheet_001', 1, 'Front Elevation', [ 'Existing note' ]), SHEET('Sheet_002', 2, 'Ground Floor Plan', []) ];
    const UNSAVED = () => [ SHEET('Sheet_001', 1, 'Front Elevation', [ 'Existing note', 'Unsaved note' ]), SHEET('Sheet_002', 2, 'Ground Floor Plan', []) ];
    const texts   = (sheets, id) => { const sheet = (sheets || []).find((s) => s.Sheet__Id === id); return sheet ? sheet.Sheet__Annotations.map((a) => a.Annotation__Text) : null; };
    const stored  = (world) => { const raw = world.store.get(DRAFT_KEY); return raw ? JSON.parse(raw) : null; };

    const RECORD_STUBS = {
        Na__LeRec__KIND_2D : '2d', Na__LeRec__KIND_3D : '3d', Na__LeRec__LAYER_TYPES : [], Na__LeRec__STYLE_KEYS : [],
        Na__LeRec__DRAWING_ARCHITECTURAL : 'architectural', Na__LeRec__DRAWING_SITEPLAN : 'siteplan',
        Na__LeRec__IsSitePlanSheet : (sheet) => !!sheet && sheet.Sheet__DrawingType === 'siteplan',
        Na__LeRec__Find : (list, key, id) => (Array.isArray(list) ? list.find((item) => item && item[key] === id) : null) || null,
        Na__LeRec__NormaliseSheet : (sheet, index) => {
            if (!Number.isFinite(sheet.Sheet__Order)) sheet.Sheet__Order = index + 1;
            [ 'Sheet__Layers', 'Sheet__Viewports', 'Sheet__Annotations', 'Sheet__Dimensions', 'Sheet__Shapes', 'Sheet__Leaders', 'Sheet__Groups' ].forEach((key) => { if (!Array.isArray(sheet[key])) sheet[key] = []; });
            return sheet;
        },
        Na__LeCfg__GetLabel : (key, fallback) => fallback, Na__LeCfg__FormatLabel : (key, fallback) => fallback
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The App's Start-Up, One Piece at a Time
// -----------------------------------------------------------------------------

    // A fresh copy of every module, wired as the app wires them. `draft` is
    // put in this world's browser first, as a reload finds it.
    async function boot(draft) {
        const world = newWorld();
        if (draft) world.store.set(DRAFT_KEY, JSON.stringify({ savedAt : 1, base : null, sheets : draft }));   // <-- base null: grown from these drawings, which carry no saved stamp (AutoSave 1.5.0 judges a draft by it)
        const seen = { toasts : [], lines : [], announced : [], seeds : 0 };

        const Data   = (await load(DATA, {
            Na__PresentationMode__ProjectJson__GetActiveConfig : () => null,
            Na__AppUtils__GetProjectCodeFromUrl : () => 'RB05',                   // <-- The address bar names the project from the first moment
            Na__CfApi__IsConfigured : () => false
        })).ns;
        const State  = await load(SHEETDATA + STATE_FILE, Object.assign({}, RECORD_STUBS, Data));
        const links  = { [STATE_FILE] : State.url };
        const Sheets = (await load(SHEETDATA + 'Na__LayoutEditor__SheetModel__Sheets__.js', Object.assign({}, RECORD_STUBS, {
            Na__LeCommon__Seed : () => { seen.seeds++; return Promise.resolve(false); }
        }), links)).ns;
        const Model  = (await load(SHEETDATA + 'Na__LayoutEditor__SheetModel__.js', Object.assign({}, RECORD_STUBS, Data, Sheets), links)).ns;
        const Auto   = (await load(SHEETDATA + 'Na__LayoutEditor__AutoSave__.js', Object.assign({}, RECORD_STUBS, Data, Model, {
            Na__LeCfg__GetAutoSaveSetup : () => ({ enabled : true, draftEnabled : true, closeGuardEnabled : true, debounceMs : 60000, draftDebounceMs : DRAFT_MS }),
            Na__LeSpec__IsDirty : () => false
        }))).ns;

        // WHAT EVERY LOAD AND SAVE ANNOUNCES, with the dirty flag as it stood.
        window.addEventListener(Model.Na__LeModel__CHANGED_EVENT, (event) => {
            const reason = event.detail && event.detail.reason;
            if (reason === 'loaded' || reason === 'saved') seen.announced.push(reason + (Model.Na__LeModel__IsDirty() ? ' dirty' : ' clean'));
        });
        Data.Na__DrawView__ProjectData__Initialize();                            // <-- Index.html arms it before the loading sequence

        const app = {
            world, seen, Data, State : State.ns, Model, Auto,
            // THE LOADING SEQUENCE hands the project's block over.
            load : (sheets) => window.dispatchEvent(new CustomEvent(Data.Na__DrawData__LOADED_EVENT, {
                detail : { block : { [Data.Na__DrawData__SHEETS_KEY] : sheets || SERVER() }, sceneConfig : null, projectCode : 'RB05' }
            })),
            // THE MODE CONTROLLER, once its configs are in: the model, then the
            // auto save, then everything else that listens, in one pass.
            editor : () => {
                Model.Na__LeModel__Initialize();
                Auto.Na__LeAuto__Initialize({ showToast : (message, isError) => seen.toasts.push([ message, isError ]), editable : true });
            },
            sheets : () => Model.Na__LeModel__GetSheets()
        };
        return app;
    }

    // The draft restore's console line is counted, not printed.
    console.log = (...args) => {
        const line = String(args[0]);
        if (line.indexOf('draft restored') >= 0 && Current) { Current.seen.lines.push(line); return; }
        if (line.indexOf('[TrueVision3D]') === 0) return;
        out(...args);
    };
    let Current = null;
    async function start(draft) { Current = await boot(draft); return Current; }

    const TOAST = [ 'Unsaved sheet changes from this browser were restored. Save Sheets keeps them.', false ];

    out('TrueVision3D - the browser draft comes back whichever arrives first');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drawings First (the order a real load takes)
// -----------------------------------------------------------------------------

    out('\nThe drawings load first, the editor starts after:');
    {
        const app = await start(UNSAVED());
        const before = app.world.store.get(DRAFT_KEY);
        app.load();
        app.editor();
        await settle();
        check('the unsaved note is back on its sheet', texts(app.sheets(), 'Sheet_001'), [ 'Existing note', 'Unsaved note' ]);
        check('the model is marked dirty', app.Model.Na__LeModel__IsDirty(), true);
        check('one toast says so, and it is not an error', app.seen.toasts, [ TOAST ]);
        check('the console says so once', app.seen.lines.length, 1);
        check('the draft itself is untouched', app.world.store.get(DRAFT_KEY) === before, true);
        check('the load is announced once, then the restore', app.seen.announced, [ 'loaded clean', 'loaded dirty' ]);
        check('the pack\'s common fields are seeded for the project', app.seen.seeds, 1);

        // THE FIRST EDIT AFTER THE RELOAD - the change that used to overwrite
        // the draft with the server's sheets plus itself.
        const plan = app.Model.Na__LeModel__GetSheetById('Sheet_002');
        plan.Sheet__Annotations.push({ Annotation__Id : 'Text_001', Annotation__Text : 'Edit after the reload' });
        app.State.Na__LeModel__Touch('annotations', 'Sheet_002');
        await wait(DRAFT_MS + 40);
        const draft = stored(app.world);
        check('the first edit after the restore keeps the unsaved note in the draft', texts(draft && draft.sheets, 'Sheet_001'), [ 'Existing note', 'Unsaved note' ]);
        check('...with the edit beside it', texts(draft && draft.sheets, 'Sheet_002'), [ 'Edit after the reload' ]);

        // A SAVE IS NOT A LOAD: the same records, now on disk.
        window.dispatchEvent(new CustomEvent(app.Data.Na__DrawData__CHANGED_EVENT, { detail : { reason : 'saved', projectCode : 'RB05' } }));
        check('a save is announced as a save, and the model is clean', app.seen.announced.slice(2), [ 'saved clean' ]);
        check('...the draft it wrote is cleared', app.world.store.has(DRAFT_KEY), false);
        check('...and nothing is restored again', app.seen.toasts.length, 1);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Editor First
// -----------------------------------------------------------------------------

    out('\nThe editor starts first, the drawings load after:');
    {
        const app = await start(UNSAVED());
        const before = app.world.store.get(DRAFT_KEY);
        app.editor();
        await settle();
        check('before the drawings: no load is announced', app.seen.announced, []);
        check('...nothing is restored into the empty block, though the address names the project', [ app.sheets().length, app.seen.toasts.length, app.Model.Na__LeModel__IsDirty() ], [ 0, 0, false ]);

        // A CHANGE ANNOUNCED BEFORE THE SHEETS ARRIVE must not write the empty
        // block over the draft waiting to be restored.
        app.State.Na__LeModel__Touch('annotations', null);
        await wait(DRAFT_MS + 40);
        check('...and a change announced meanwhile writes no draft over the waiting one', app.world.store.get(DRAFT_KEY) === before, true);

        app.load();
        await settle();
        check('the unsaved note is back on its sheet', texts(app.sheets(), 'Sheet_001'), [ 'Existing note', 'Unsaved note' ]);
        check('the model stays dirty (the load is not announced a second time over the restore)', app.Model.Na__LeModel__IsDirty(), true);
        check('the load is announced once, then the restore', app.seen.announced, [ 'loaded clean', 'loaded dirty' ]);
        check('one toast, one console line', [ app.seen.toasts, app.seen.lines.length ], [ [ TOAST ], 1 ]);
        check('the pack\'s common fields are seeded once', app.seen.seeds, 1);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Nothing to Restore
// -----------------------------------------------------------------------------

    out('\nNothing to restore:');
    {
        const app = await start(null);
        app.load();
        app.editor();
        await settle();
        check('no draft, drawings first: the load is announced exactly once, clean', app.seen.announced, [ 'loaded clean' ]);
        check('...the project\'s own sheets, no toast, not dirty', [ texts(app.sheets(), 'Sheet_001'), app.seen.toasts.length, app.Model.Na__LeModel__IsDirty() ], [ [ 'Existing note' ], 0, false ]);
    }
    {
        const app = await start(null);
        app.editor();
        app.load();
        await settle();
        check('no draft, editor first: the load is announced exactly once, clean', app.seen.announced, [ 'loaded clean' ]);
    }
    {
        const app = await start(SERVER());
        app.load();
        app.editor();
        await settle();
        check('a draft the project already matches restores nothing', [ app.seen.toasts.length, app.seen.lines.length, app.Model.Na__LeModel__IsDirty() ], [ 0, 0, false ]);
    }
    {
        const app = await start(UNSAVED());
        app.editor();
        await wait(DRAFT_MS + 40);
        check('an editor with no project yet announces no load, however long it waits', app.seen.announced, []);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Second Load Before the Late Announcement
// -----------------------------------------------------------------------------

    out('\nA second load lands before the late announcement runs:');
    {
        const app = await start(null);
        app.load();
        app.editor();                                                           // <-- The drawings were already in: the announcement waits for the rest of the start-up
        app.load();                                                             // <-- ...and another load lands first
        await settle();
        check('the model announces it once, not twice', app.seen.announced, [ 'loaded clean' ]);
        check('...and seeds once', app.seen.seeds, 1);
    }

// endregion -------------------------------------------------------------------


console.log = out;
out('\n' + (failures ? failures + ' check(s) FAILED' : 'Every check passed'));
process.exit(failures ? 1 : 0);
