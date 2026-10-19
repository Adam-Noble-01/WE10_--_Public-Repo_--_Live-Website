// =============================================================================
// TRUEVISION3D - TEST - THE MODEL GATE AND THE DRAWINGS WAY IN
// =============================================================================
//
// FILE       : Na__Test__ModelGate__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : App Flow Model Gate, and the Shared Link Opener That Holds It
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a reader sent to a document is never sent the 3D model until the 3D Model tab, and that nobody else ever waits for it
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - THE GATE (01__AppCore/Na__AppFlow__ModelGate__.js), run as it ships: open
//   by default, armed, kept, opened, refused once the model is loading, and an
//   undecided gate opening itself at its cap.
// - THE OPENER (66__Feature__DocumentSharing/Na__LayoutEditor__Share__Open__.js),
//   run as it ships with the real link rules and the real gate, and the mode
//   controller, the sheet model, the share link record and the documents stood
//   in for. Each case is a fresh copy of the opener (a query on its address),
//   sharing the one gate, which every case must leave open.
//     - the Project Hub's Drawings key opens the first PUBLISHED drawing for a
//       reader, and the first drawing for an author;
//     - a reader with a document on screen keeps the gate shut, with the
//       loading screen lifted, until the 3D Model tab opens it;
//     - an author, the setting off, a key that opens nothing, a project with
//       no drawings and a page with no key never hold the model.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ModelGate__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Created with TrueVision3D v2.183.0.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports and Locations
// -----------------------------------------------------------------------------

    import { readFileSync, existsSync } from 'node:fs';
    import { dirname, join, resolve } from 'node:path';
    import { fileURLToPath, pathToFileURL } from 'node:url';
    import { register } from 'node:module';

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..');
    const MODULES    = join(APP, '02__Src__AppModules');
    const GATE_FILE  = join(MODULES, '01__AppCore', 'Na__AppFlow__ModelGate__.js');
    const OPEN_FILE  = join(MODULES, '51__System__LayoutEditor', '66__Feature__DocumentSharing', 'Na__LayoutEditor__Share__Open__.js');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Check Harness
// -----------------------------------------------------------------------------

    let passed = 0;
    let failed = 0;
    function check(name, condition, detail) {
        if (condition) { passed++; console.log('  ok    ' + name); return true; }
        failed++;
        console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
        return false;
    }
    function section(title) { console.log('\n' + title); }
    const tick = (ms) => new Promise((done) => setTimeout(done, ms || 0));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading the Real Modules, With the Editor Stood In For
// -----------------------------------------------------------------------------
//
// The app's .js files are ES modules with no package.json saying so. A loader
// hook marks every .js under the app as a module - A QUERY ON THE ADDRESS
// INCLUDED, which is how each case gets a fresh opener - and swaps the
// modules that would pull in the whole editor for stand-ins reading their
// state off globalThis.Na__TestGate. The link rules, the project loader and
// the gate run for real. Each copy of the opener gets its OWN copy of the
// link rules (the case's query is carried on to them), because the rules
// read their settings once per copy and one case runs with a setting off;
// the gate is never copied, so the test watches the one the opener holds.
//
// -----------------------------------------------------------------------------

    const HOOKS = `
        let STUBS = {};
        export async function initialize(data) { STUBS = (data && data.stubs) || {}; }
        export async function resolve(specifier, context, next) {
            const parent = (context && context.parentURL) || '';
            const at     = parent.indexOf('?case=');
            const result = await next(specifier, context);
            if (at !== -1 && /Na__LayoutEditor__Share__Links__\\.js$/.test(result.url)) return Object.assign({}, result, { url : result.url + parent.slice(at) });
            return result;
        }
        export async function load(url, context, next) {
            const bare = url.split('?')[0];
            for (const tail of Object.keys(STUBS)) {
                if (bare.endsWith(tail)) return { format : 'module', source : STUBS[tail], shortCircuit : true };
            }
            if (bare.startsWith('file:') && bare.endsWith('.js') && bare.indexOf('30__TrueVision__CoreAppCode') !== -1) {
                const loaded = await next(url, Object.assign({}, context, { format : 'module' }));
                return Object.assign({}, loaded, { format : 'module' });
            }
            return next(url, context);
        }
    `;

    const STUBS = {
        '/05__Core__ModeController/Na__LayoutEditor__ModeController__.js' : `
            const S = () => globalThis.Na__TestGate;
            export const Na__LeMode__CHANGED_EVENT = 'na-layouteditor-mode-changed';
            export function Na__LeMode__Ready() { return Promise.resolve(S().enabled); }
            export function Na__LeMode__IsEditable() { return S().editable; }
            export function Na__LeMode__IsActive() { return S().active; }
            function show(id) {
                S().active = true;
                S().entered.push(id);
                S().emit(Na__LeMode__CHANGED_EVENT, { isActive : true, sheetId : id });
                return true;
            }
            export function Na__LeMode__Enter(sheetId) {
                const sheets = S().sheets;
                const sheet  = sheets.find((one) => one.Sheet__Id === sheetId) || sheets[0];
                return sheet ? show(sheet.Sheet__Id) : false;
            }
            export function Na__LeMode__OpenSpecification() { return S().sheets.length ? show('specification') : false; }
            export function Na__LeMode__OpenRegister()      { return S().sheets.length ? show('register') : false; }
            export function Na__LeMode__OpenStatements()    { return S().sheets.length ? show('statements') : false; }
            export function Na__LeMode__Leave() {
                S().active = false;
                S().emit(Na__LeMode__CHANGED_EVENT, { isActive : false, sheetId : null });
                return true;
            }
        `,
        '/07__Core__SheetData/Na__LayoutEditor__SheetModel__.js' : `
            const S = () => globalThis.Na__TestGate;
            export const Na__LeModel__CHANGED_EVENT = 'na-layouteditor-sheets-changed';
            export function Na__LeModel__GetSheets() { return S().sheets.slice(); }
            export function Na__LeModel__GetSheetById(id) { return S().sheets.find((one) => one.Sheet__Id === id) || null; }
            export function Na__LeModel__GetShortCode(sheet) { return sheet.Number; }
            export function Na__LeModel__GetDrawingNumber(sheet) { return sheet.Number; }
            export function Na__LeModel__GetDocumentId(sheet) { return 'JW02_T01_' + sheet.Number; }
        `,
        '/40__System__DrawingViewCore/Na__DrawView__ProjectData__.js' : `
            export function Na__DrawData__IsLoaded() { return globalThis.Na__TestGate.drawingsLoaded; }
        `,
        '/50__Feature__Specification/Na__LayoutEditor__SpecEditor__.js' : `
            export function Na__LeSpecEd__SetView() { return true; }
        `,
        '/50__Feature__Specification/Na__LayoutEditor__SpecEditor__State__.js' : `
            export const Na__LeSpecEd__VIEW_READ = 'read';
        `,
        '/01__Core__Data/Na__LayoutEditor__Statement__Data__.js' : `
            export async function Na__LeStmt__EnsureLoaded() { return true; }
            export function Na__LeStmt__List() { return []; }
        `,
        '/66__Feature__DocumentSharing/Na__LayoutEditor__Share__Manifest__.js' : `
            const S = () => globalThis.Na__TestGate;
            export async function Na__LeShareMf__Load() { return { Ok : false, Manifest : null, Reason : 'no record' }; }
            export function Na__LeShareMf__Find() { return null; }
            export function Na__LeShareMf__Initialize() { return true; }
            export async function Na__LeShareMf__PublishedIds() { S().askedPublished++; return S().published === null ? null : new Set(S().published); }
        `
    };

    register('data:text/javascript,' + encodeURIComponent(HOOKS), { parentURL : import.meta.url, data : { stubs : STUBS } });

    // THE PAGE | A window with an event bus, short timers and the loading screen
    const listeners = new Map();
    const overlay = {
        style     : { display : '' },
        classes   : new Set(),
        classList : {
            contains : (name) => overlay.classes.has(name),
            add      : (name) => { overlay.classes.add(name); },
            remove   : (name) => { overlay.classes.delete(name); },
            toggle   : (name, force) => { const on = (force === undefined) ? !overlay.classes.has(name) : !!force; if (on) overlay.classes.add(name); else overlay.classes.delete(name); return on; }
        }
    };
    globalThis.window = {
        location         : { search : '', hash : '', hostname : 'www.noble-architecture.com', port : '', origin : 'https://www.noble-architecture.com' },
        addEventListener : (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
        removeEventListener : (type, fn) => { const list = listeners.get(type) || []; const at = list.indexOf(fn); if (at !== -1) list.splice(at, 1); },
        dispatchEvent    : () => true,
        setTimeout       : (fn, ms) => setTimeout(fn, Math.min(Number(ms) || 0, 40)),   // <-- The opener's waits, compressed: a minute becomes forty milliseconds
        clearTimeout     : (handle) => clearTimeout(handle)
    };
    globalThis.document = { getElementById : (id) => (id === 'loadingOverlay' ? overlay : null) };

    globalThis.Na__TestGate = {
        enabled : true, editable : false, active : false, drawingsLoaded : true,
        sheets : [], published : [], askedPublished : 0, entered : [], toasts : [],
        emit(type, detail) { (listeners.get(type) || []).slice().forEach((fn) => fn({ type, detail })); }
    };

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {                                       // <-- Only the sharing config is ever asked for: read it off disk
        const href = (input && input.href) ? input.href : String(input);
        if (href.startsWith('file:')) {
            const path = fileURLToPath(href.split('?')[0]);
            if (!existsSync(path)) return { ok : false, status : 404, statusText : 'Not Found' };
            const text  = readFileSync(path, 'utf8');
            const value = () => {
                const whole = JSON.parse(text);
                if (globalThis.Na__TestGate.loadModelOnDemand === false && whole['LayoutEditor__Share__Open']) whole['LayoutEditor__Share__Open']['Open__LoadModelOnDemand'] = false;   // <-- The one case run with the setting off
                return whole;
            };
            return { ok : true, status : 200, statusText : 'OK', json : async () => value(), text : async () => text };
        }
        return { ok : false, status : 404, statusText : 'Not Found' };
    };

    const GATE_URL = pathToFileURL(GATE_FILE).href;
    const Gate     = await import(GATE_URL);                                     // <-- The very instance the opener imports
    const Mode     = await import(pathToFileURL(join(MODULES, '51__System__LayoutEditor', '05__Core__ModeController', 'Na__LayoutEditor__ModeController__.js')).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 1. The Gate Itself
// -----------------------------------------------------------------------------

    section('1. The gate: open by default, armed, kept, opened, capped');

    {
        const G = await import(GATE_URL + '?unit=1');                            // <-- A gate of its own: these cases leave it passed
        check('a gate nobody armed is open', G.Na__ModelGate__GetState() === 'open');
        check('armed, it is pending', G.Na__ModelGate__Arm('test') === true && G.Na__ModelGate__GetState() === 'pending');
        check('armed twice is refused', G.Na__ModelGate__Arm('again') === false);
        let through = null;
        const pass = G.Na__ModelGate__Pass(5000).then((result) => { through = result; });
        await tick(5);
        check('the sequence waits at a pending gate', through === null);
        check('kept, it is held', G.Na__ModelGate__Keep('reading') === true && G.Na__ModelGate__GetState() === 'held');
        check('kept twice is refused', G.Na__ModelGate__Keep('again') === false);
        await tick(5);
        check('a held gate keeps the sequence waiting', through === null);
        check('opened, it lets the sequence through', G.Na__ModelGate__Open('the 3D tab') === true);
        await pass;
        check('the sequence went through, and says it waited and why', through && through.Waited === true && through.Reason === 'the 3D tab', through);
        check('opened twice is a no-op', G.Na__ModelGate__Open('again') === false);
        check('once the model is loading, it can never be armed again', G.Na__ModelGate__Arm('late') === false && G.Na__ModelGate__HasPassed() === true && G.Na__ModelGate__GetState() === 'open');
    }
    {
        const G = await import(GATE_URL + '?unit=2');
        const result = await G.Na__ModelGate__Pass(5000);
        check('an open gate is passed at once, without waiting', result.Waited === false);
    }
    {
        const G = await import(GATE_URL + '?unit=3');
        G.Na__ModelGate__Arm('undecided');
        const began  = Date.now();
        const result = await G.Na__ModelGate__Pass(30);
        check('an undecided gate opens itself at its cap', result.Waited === true && /no decision/.test(result.Reason) && Date.now() - began < 2000, result);
        check('a decision after the cap keeps nothing: the model is already loading', G.Na__ModelGate__Keep('too late') === false && G.Na__ModelGate__GetState() === 'open');
    }
    {
        const G = await import(GATE_URL + '?unit=4');
        G.Na__ModelGate__Arm('a reader');
        G.Na__ModelGate__Keep('reading');
        let through = false;
        const pass = G.Na__ModelGate__Pass(20).then(() => { through = true; });
        await tick(80);
        check('a HELD gate has no cap: a reader may read for as long as they like', through === false && G.Na__ModelGate__GetState() === 'held');
        G.Na__ModelGate__Open('the 3D tab');
        await pass;
        check('and the 3D Model tab still opens it', through === true);
    }
    check('the cap on an undecided gate is a few seconds, not a minute', Gate.Na__ModelGate__PENDING_CAP_MS >= 5000 && Gate.Na__ModelGate__PENDING_CAP_MS <= 20000);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 2. The Opener: Who Holds the Model, and for How Long
// -----------------------------------------------------------------------------

    section('2. The opener holds the model only for a reader reading a document');

    const T = globalThis.Na__TestGate;
    const SHEETS = [
        { Sheet__Id : 'Sheet_001', Sheet__Name : 'Existing Elevations', Number : 'D01' },
        { Sheet__Id : 'Sheet_002', Sheet__Name : 'Area Plan',           Number : 'D02' },
        { Sheet__Id : 'Sheet_003', Sheet__Name : 'Site Plan',           Number : 'D03' }
    ];
    let caseNumber = 0;

    // A FRESH OPENER on a fresh page, with the gate open and the loading screen down
    async function openWith(state) {
        caseNumber++;
        Object.assign(T, { enabled : true, editable : false, active : false, drawingsLoaded : true, sheets : SHEETS.slice(), loadModelOnDemand : undefined,
                           published : [ 'JW02_T01_D01', 'JW02_T01_D02', 'JW02_T01_D03' ], askedPublished : 0, entered : [], toasts : [] }, state.page || {});
        window.location.search = state.search;
        overlay.classes.clear();
        overlay.style.display = '';
        listeners.clear();
        const Open = await import(pathToFileURL(OPEN_FILE).href + '?case=' + caseNumber);
        const run  = Open.Na__LeShareOpen__Initialize({ showToast : (message, isError) => T.toasts.push(message) });
        return { run, armedAtOnce : Gate.Na__ModelGate__GetState() };
    }

    // CASE | The Project Hub's PlanVision card, a client on the live site: D01 not yet published
    {
        const { run, armedAtOnce } = await openWith({
            search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Drawings',
            page   : { published : [ 'JW02_T01_D02', 'JW02_T01_D03' ] }
        });
        check('a key on the address arms the gate before the opener waits on anything', armedAtOnce === 'pending');
        const result = await run;
        check('the Drawings key opens the FIRST PUBLISHED drawing, not an unpublished D01', result && result.Ok && T.entered.join() === 'Sheet_002', { result, entered : T.entered });
        check('it asked the index which drawings are published', T.askedPublished === 1);
        check('the reader is reading: the gate is HELD', Gate.Na__ModelGate__GetState() === 'held');
        check('and the loading screen is lifted off the drawing', overlay.classes.has('hidden'));
        Mode.Na__LeMode__Enter('Sheet_003');
        check('moving to another drawing keeps it held', Gate.Na__ModelGate__GetState() === 'held');
        Mode.Na__LeMode__Leave();
        check('the 3D Model tab OPENS it: the model loads now', Gate.Na__ModelGate__GetState() === 'open');
        check('with the loading screen back over the model as it loads', !overlay.classes.has('hidden'));
    }

    // CASE | Everything published: the first drawing in the list
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=drawings' });
        await run;
        check('with every drawing published, "drawings" opens the first in the list', T.entered.join() === 'Sheet_001');
        Mode.Na__LeMode__Leave();
        check('(left open again by the 3D tab)', Gate.Na__ModelGate__GetState() === 'open');
    }

    // CASE | Nothing published yet: the first drawing, which says so
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Drawings', page : { published : [] } });
        await run;
        check('with nothing published, the first drawing (its grey panel says so)', T.entered.join() === 'Sheet_001');
        Mode.Na__LeMode__Leave();
    }

    // CASE | A shared drawing link holds the model the same way
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Sheet_003' });
        await run;
        check('a shared drawing link opens its drawing and holds the model too', T.entered.join() === 'Sheet_003' && Gate.Na__ModelGate__GetState() === 'held');
        Mode.Na__LeMode__Leave();
        check('until the 3D Model tab', Gate.Na__ModelGate__GetState() === 'open');
    }

    // CASE | The author on localhost: the editor draws from the model, so it never waits
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Drawings', page : { editable : true, published : [ 'JW02_T01_D03' ] } });
        await tick(0); await tick(0);
        const result = await run;
        check('an author is opened on the FIRST drawing: every sheet is drawn from the model', result && result.Ok && T.entered.join() === 'Sheet_001');
        check('an author never holds the model', Gate.Na__ModelGate__GetState() === 'open');
        check('an author never asks the published index', T.askedPublished === 0);
    }

    // CASE | A key that opens nothing
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=%3Cscript%3E' });
        check('a value that is not a key arms nothing', Gate.Na__ModelGate__GetState() === 'open');
        await run;
        check('and opens nothing', T.entered.length === 0);
    }
    {
        const { run, armedAtOnce } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Sheet_099', page : { sheets : SHEETS.slice(), published : [] } });
        check('(a key that looks right arms it)', armedAtOnce === 'pending');
        await run;
        check('a drawing that has gone opens the register, which holds the model as any document does',
            T.entered.join() === 'register' && Gate.Na__ModelGate__GetState() === 'held');
        Mode.Na__LeMode__Leave();
    }

    // CASE | A project with no drawings at all
    {
        const { run } = await openWith({ search : '?project=EB03&project-folder=EB03__TheFirs&year=26&open=Drawings', page : { sheets : [] } });
        check('(armed)', Gate.Na__ModelGate__GetState() === 'pending');
        T.emit('na-layouteditor-sheets-changed', { reason : 'loaded' });
        check('the sheet model\'s first load with no sheets opens the gate at once', Gate.Na__ModelGate__GetState() === 'open');
        const result = await run;
        check('nothing is opened, and the loading screen is left over the model it is waiting for', result && !result.Ok && T.entered.length === 0 && !overlay.classes.has('hidden'), result);
    }

    // CASE | The setting off: the model loads behind the document, as before v2.183.0
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Drawings', page : { loadModelOnDemand : false } });
        const result = await run;
        check('with Open__LoadModelOnDemand off, the drawing still opens with the loading screen lifted',
            result && result.Ok && T.entered.join() === 'Sheet_001' && overlay.classes.has('hidden'));
        check('but the model is never held: it loads behind the document', Gate.Na__ModelGate__GetState() === 'open');
        Mode.Na__LeMode__Leave();
    }

    // CASE | No key at all: an ordinary visit to the 3D model
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26' });
        check('a page with no key never arms the gate', Gate.Na__ModelGate__GetState() === 'open');
        const result = await run;
        check('and opens nothing', result === null && T.entered.length === 0);
    }

    // CASE | The layout editor switched off in its config
    {
        const { run } = await openWith({ search : '?project=JW02&project-folder=JW02__JugglesJoint&year=26&open=Drawings', page : { enabled : false } });
        await run;
        check('with no layout editor the gate opens, and nothing is opened', Gate.Na__ModelGate__GetState() === 'open' && T.entered.length === 0);
    }

    check('every case left the gate open, and the model was never started here', Gate.Na__ModelGate__GetState() === 'open' && Gate.Na__ModelGate__HasPassed() === false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    globalThis.fetch = realFetch;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
