// =============================================================================
// TRUEVISION3D - TEST - VECTOR QUALITY (THE TOOLBAR'S VECTOR CONTROL)
// =============================================================================
//
// FILE       : Na__Test__VectorQuality__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Vector Quality Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove when a drawing is held as a layer of its own at each of Low, Medium and High, that the level is remembered, and that the one stylesheet rule holds by opacity and never in the web viewer
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Na__LayoutEditor__VectorQuality__ is the shipped file with its one import
//   (the config reader) swapped for a stub, run against a stand-in document
//   body, localStorage and timers whose clock the test turns by hand.
// - High never holds. Low holds from Ready and through everything. Medium
//   takes the hold on a redraw, keeps it while redraws keep coming, and lets
//   go ReleaseAfterMs after the LAST of them - not the first.
// - The paper stylesheet is read as text: the rule must key on the body class
//   the module sets, hold the FRAME by will-change: opacity (the transform
//   hint is what made a held drawing a blown-up picture), and stand down in
//   the web viewer.
// - MUTATION CHECKED on copies in memory, the shipped file untouched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__VectorQuality__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.1
// - A checkout with core.autocrlf=true gives the module CRLF line ends, and
//   two of the mutations span lines joined by '\n', so they matched nothing
//   and the file stopped at the first of them. load() now reads the module
//   as LF, as Na__TestEnv__ObjectSnapBundle__ does.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with the Vector control (TrueVision3D v2.136.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Stand-In Browser: Body Class, Storage, Events and a Clock Turned by Hand
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const MODULE     = '51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__VectorQuality__.js';
    const STYLES     = '51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__Styles__Main__Paper__.css';
    let   Serial     = 0;

    function MakeWorld(stored) {
        const classes = new Set(), store = new Map(), timers = new Map(), events = [];
        if (stored !== undefined) store.set('Na__LayoutEditor__VectorLevel', stored);
        let now = 0, nextId = 1;
        globalThis.document = { body : { classList : {
            contains : (name) => classes.has(name),
            toggle   : (name, on) => { if (on) classes.add(name); else classes.delete(name); return on; }
        } } };
        globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : null; } };
        globalThis.window = {
            localStorage  : { getItem : (key) => (store.has(key) ? store.get(key) : null), setItem : (key, value) => store.set(key, String(value)) },
            setTimeout    : (fn, ms) => { const id = nextId++; timers.set(id, { at : now + ms, fn : fn }); return id; },
            clearTimeout  : (id) => { timers.delete(id); },
            dispatchEvent : (event) => { events.push(event.type + ':' + event.detail.level); return true; }
        };
        return {
            held   : () => classes.has('na-le-vector-hold'),
            store  : store, events : events,
            // Turn the clock on, running whatever falls due, in order
            turn   : (ms) => { const until = now + ms; for (;;) { let due = null; timers.forEach((t, id) => { if (t.at <= until && (!due || t.at < due.t.at)) due = { id : id, t : t }; }); if (!due) break; now = due.t.at; timers.delete(due.id); due.t.fn(); } now = until; },
            timers : () => timers.size
        };
    }

    async function load(defaults, mutate) {
        let src = readFileSync(resolve(SRC, MODULE), 'utf8').replace(/\r\n/g, '\n');     // <-- CRLF files are read as LF first: a mutation that spans lines joins them with '\n'
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (/^\s*import\s/m.test(src)) { console.error('FAIL: an import survived'); process.exit(1); }
        if (mutate) { const changed = mutate(src); if (changed === src) { console.error('FAIL: a mutation changed nothing'); process.exit(1); } src = changed; }
        const stubs = 'const Na__LeCfg__GetVectorQualitySetup = () => (' + JSON.stringify(defaults) + ');';
        const tmp = join(tmpdir(), 'Na__Test__VectorQuality__' + (Serial++) + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

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

    console.log('TrueVision3D - vector quality');

    const SETUP = { defaultLevel : 'medium', releaseAfterMs : 1200 };

    async function RunRule(mutate) {
        // A BROWSER THAT HAS NEVER CHOSEN starts on the config's level, let go
        let world = MakeWorld(undefined);
        let M = await load(SETUP, mutate);
        check('a browser that has never chosen starts on the config default', M.Na__LeVectorQ__Ready(), 'medium');
        check('  and Medium rests let go', world.held(), false);

        // MEDIUM: held from a redraw until ReleaseAfterMs after the LAST redraw
        M.Na__LeVectorQ__NoteRedraw();
        check('Medium takes the hold on a redraw', world.held(), true);
        world.turn(1000); M.Na__LeVectorQ__NoteRedraw(); world.turn(1000);
        check('Medium keeps it while redraws keep coming (2 s in, the last one 1 s ago)', world.held(), true);
        world.turn(199);
        check('  still held 1199 ms after the last redraw', world.held(), true);
        world.turn(2);
        check('  let go 1201 ms after the last redraw', world.held(), false);
        check('  with no timer left running', world.timers(), 0);
        M.Na__LeVectorQ__NoteRedraw();
        check('  and taken again by the next redraw', world.held(), true);

        // HIGH: never
        check('choosing High answers High', M.Na__LeVectorQ__Set('HIGH'), 'high');
        check('  lets go at once', world.held(), false);
        M.Na__LeVectorQ__NoteRedraw(); world.turn(50);
        check('  and a redraw at High takes nothing', [ world.held(), world.timers() ], [ false, 0 ]);
        check('  is remembered in this browser', world.store.get('Na__LayoutEditor__VectorLevel'), 'high');
        check('  and announced once', world.events, [ 'na-layouteditor-vector-quality-changed:high' ]);

        // LOW: always
        M.Na__LeVectorQ__Set('low');
        check('choosing Low holds at once', world.held(), true);
        M.Na__LeVectorQ__NoteRedraw(); world.turn(60000);
        check('  and a minute of quiet after a redraw does not let go', world.held(), true);
        check('choosing the level already chosen announces nothing', (M.Na__LeVectorQ__Set('low'), world.events.length), 2);
        check('a level that is no level changes nothing', [ M.Na__LeVectorQ__Set('ultra'), M.Na__LeVectorQ__Get(), world.events.length ], [ 'low', 'low', 2 ]);

        // A MEDIUM HOLD IN FLIGHT when the level changes: its timer must not let go of Low's hold
        M.Na__LeVectorQ__Set('medium'); M.Na__LeVectorQ__NoteRedraw(); world.turn(600);
        M.Na__LeVectorQ__Set('low'); world.turn(5000);
        check('Medium\'s timer, overtaken by Low, does not let go of Low\'s hold', world.held(), true);
        M.Na__LeVectorQ__Set('medium'); M.Na__LeVectorQ__NoteRedraw(); world.turn(600);
        M.Na__LeVectorQ__Set('high'); M.Na__LeVectorQ__NoteRedraw(); world.turn(5000);
        check('  and overtaken by High, leaves nothing held', world.held(), false);

        // A BROWSER THAT CHOSE LOW LAST TIME opens held
        world = MakeWorld('low');
        M = await load(SETUP, mutate);
        check('a browser that chose Low last time is held from Ready', [ M.Na__LeVectorQ__Ready(), world.held() ], [ 'low', true ]);
        world = MakeWorld('nonsense');
        M = await load({ defaultLevel : 'high', releaseAfterMs : 1200 }, mutate);
        check('a stored level that is no level falls back to the config\'s', M.Na__LeVectorQ__Get(), 'high');
    }

    await RunRule(null);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The One Stylesheet Rule
// -----------------------------------------------------------------------------

    {
        const css  = readFileSync(resolve(SRC, STYLES), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const rule = (css.match(/([^{}]*\.na-le-frame--2d[^{}]*)\{([^}]*)\}/g) || []).filter((r) => /will-change/.test(r));
        check('one rule holds the 2D frame', rule.length, 1);
        const text = rule[0] || '';
        check('  keyed on the body class the module sets', /body\.na-le-vector-hold/.test(text), true);
        check('  standing down in the web viewer', /:not\(\.na-le-viewer--active\)/.test(text), true);
        check('  by will-change: opacity', /will-change\s*:\s*opacity\s*;/.test(text), true);
        check('  and NOT by the transform hint, which keeps the layer at the scale it was first drawn at', /will-change\s*:[^;]*transform/.test(text), false);
        check('  on the frame, not the linework inside it', /na-le-frame__linework/.test(text), false);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mutation Checks
// -----------------------------------------------------------------------------

    const MUTATIONS = [
        [ 'Medium never lets go (no timer)',
          (src) => src.replace('if (Na__LeVectorQ__Get() === Na__LeVectorQ__MEDIUM) Na__LeVectorQ__SetHeld(false);', '') ],
        [ 'Medium lets go from the FIRST redraw, not the last (timer not restarted)',
          (src) => src.replace('        Na__LeVectorQ__SetHeld(true);\n        Na__LeVectorQ__ClearTimer();\n', '        Na__LeVectorQ__SetHeld(true);\n        if (Na__LeVectorQ__Timer) return;\n') ],
        [ 'High holds on a redraw (the level is not asked)',
          (src) => src.replace('if (Na__LeVectorQ__Get() !== Na__LeVectorQ__MEDIUM) return;', '') ],
        [ 'Low rests let go',
          (src) => src.replace('Na__LeVectorQ__SetHeld(Na__LeVectorQ__Get() === Na__LeVectorQ__LOW);', 'Na__LeVectorQ__SetHeld(false);') ],
        [ 'a change of level leaves Medium\'s timer running',
          (src) => src.replace('    function Na__LeVectorQ__Rest() {\n        Na__LeVectorQ__ClearTimer();', '    function Na__LeVectorQ__Rest() {').replace('if (Na__LeVectorQ__Get() === Na__LeVectorQ__MEDIUM) Na__LeVectorQ__SetHeld(false);', 'Na__LeVectorQ__SetHeld(false);') ],
        [ 'the level is not remembered',
          (src) => src.replace("try { window.localStorage.setItem(Na__LeVectorQ__STORAGE_KEY, next); } catch (e) { /* private mode: the session keeps it */ }", '') ]
    ];
    for (let i = 0; i < MUTATIONS.length; i++) {
        quiet = true; quietFailures = 0;
        await RunRule(MUTATIONS[i][1]);
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
