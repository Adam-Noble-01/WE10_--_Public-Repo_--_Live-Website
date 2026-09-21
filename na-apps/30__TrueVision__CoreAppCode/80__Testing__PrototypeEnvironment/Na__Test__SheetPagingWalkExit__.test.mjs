// =============================================================================
// TRUEVISION3D - TEST - PAGE UP / PAGE DOWN ON A DRAWING, AND LEAVING WALK
// =============================================================================
//
// FILE       : Na__Test__SheetPagingWalkExit__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Sheet Paging and Walk Exit Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove Page Up / Page Down turn the drawings, and that the Layout Editor leaves Walk and Fly for real - and a picture render never does
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - PAGING. The real key map module is loaded with the SHIPPED JSON, and the
//   real PC controls module on top of it: a Page Down on the sheet must ask
//   for the drawing after this one, Page Up for the one before, a held key
//   must be taken without asking again, a key typed into a field must be left
//   to the field, and the built-in fallback key map must page as well.
// - LEAVING WALK AND FLY. Na__DrawView__Transitions__ is loaded with its
//   imports stubbed: SuspendThreeD({ returnToOrbit : true }) - what the Layout
//   Editor asks for - must run the real exit (the toggles the Orbit button
//   uses) and light Orbit; a bare SuspendThreeD() - what the snapshot renderer
//   does around every picture - must leave Walk running and the toolbar alone.
// - THE RENDER HOLD. The Walk and Fly controls are loaded with their imports
//   stubbed: a round trip in and out must leave no continuous-render reason
//   behind.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SheetPagingWalkExit__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - The PC controls now import Na__KeyScope__ControlKeepsKey: the real key
//   scope module is loaded and handed in. New check: Page Down from a ticked
//   box turns the drawing (a tick box has no use for it); in a list and a text
//   box it still stays theirs.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with Page Up / Page Down on drawings, the Register's Ctrl+S and
//   the Walk exit (the follow-up to TrueVision3D v2.110.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    // The PC controls add their key listener to window and ask for sheets by
    // dispatching a CustomEvent on it; both are recorded here.
    const listeners = [];
    const asked     = [];
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener    : (type, fn) => listeners.push({ type, fn }),
        removeEventListener : (type, fn) => { const at = listeners.findIndex((l) => l.type === type && l.fn === fn); if (at !== -1) listeners.splice(at, 1); },
        dispatchEvent       : (event) => { asked.push({ type : event.type, detail : event.detail }); return true; },
        requestAnimationFrame : () => 0,
        cancelAnimationFrame  : () => {}
    };
    const STAGE = { addEventListener : () => {}, removeEventListener : () => {}, classList : { add : () => {}, remove : () => {} } };

    function key(name, o) {
        const opts = o || {};
        return {
            key : name, code : '', target : opts.target || { tagName : 'DIV', isContentEditable : false },
            ctrlKey : false, shiftKey : false, altKey : false, metaKey : false, repeat : !!opts.repeat,
            prevented : false, preventDefault() { this.prevented = true; }
        };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');

    // CRLF files are read as LF first: the import pattern ends a line at ';'.
    async function load(relative, stubs, tag) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const had = /^\s*import\s/m.test(src);
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = join(tmpdir(), 'Na__Test__SheetPagingWalkExit__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    const SHIPPED_KEY_MAP = JSON.parse(readFileSync(resolve(SRC, '51__System__LayoutEditor/03__Core__Config/Na__Hotkeys__DrawingTabs__.json'), 'utf8'));

    // THE REAL KEY MAP MODULE, and the PC controls resolving keys through it
    const KeyMap = await load('51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', "const Na__LeCfg__PREFIX = 'LayoutEditor__';", 'KeyMap');
    const Scope  = await load('03__AppUtils/Na__AppUtils__KeyScope__.js', '', 'Scope');   // <-- A leaf: nothing to stub
    globalThis.__Scope = Scope;
    globalThis.__KeyMap = KeyMap;
    const Pc = await load('51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js', [
        'const K = globalThis.__KeyMap;',
        'const Na__LeCfg__GetGuards = (...a) => K.Na__LeCfg__GetGuards(...a);',
        'const Na__LeCfg__GetKeyboardSetup = (...a) => K.Na__LeCfg__GetKeyboardSetup(...a);',
        'const Na__LeCfg__MatchPointerBinding = (...a) => K.Na__LeCfg__MatchPointerBinding(...a);',
        'const Na__LeCfg__MatchWheelBinding = (...a) => K.Na__LeCfg__MatchWheelBinding(...a);',
        'const Na__LeCfg__MatchKeyBinding = (...a) => K.Na__LeCfg__MatchKeyBinding(...a);',
        'const Na__LeCfg__IsPointerModifierBound = (...a) => K.Na__LeCfg__IsPointerModifierBound(...a);',
        'const Na__LeCfg__GetNavigationSetup = () => ({ zoomWheelStep : 0.001 });',
        'const Na__LeNav__ZoomAbout = () => {}, Na__LeNav__ZoomTo = () => {}, Na__LeNav__Fit = () => {}, Na__LeNav__PanBy = () => {};',
        "const Na__LeSurface__GetElements = () => ({ stage : globalThis.__Stage }), Na__LeSurface__GetZoom = () => 1;",
        'const Na__LeTools__SetSuppressed = () => {};',
        'const Na__LeVpZoom__OnWheel = () => false;',
        'const Na__KeyScope__ControlKeepsKey = (...a) => globalThis.__Scope.Na__KeyScope__ControlKeepsKey(...a);'
    ].join('\n'), 'Pc');
    globalThis.__Stage = STAGE;

    // THE TRANSITIONS, with Walk, Fly, the toolbar and the culling stubbed
    globalThis.__T = { walk : false, fly : false, culling : true, toolbar : 'walk', calls : [] };
    const Transitions = await load('40__System__DrawingViewCore/Na__DrawView__Transitions__.js', [
        'const S = globalThis.__T;',
        "function Na__DistanceCulling__SetEnabled(v) { S.calls.push('culling:' + v); }",
        'function Na__DistanceCulling__IsEnabled() { return S.culling; }',
        'function Na__WalkMode__IsActive() { return S.walk; }',
        'function Na__FlyMode__IsActive() { return S.fly; }',
        "function Na__NavToolbar__SetActiveMode(m) { S.toolbar = m; S.calls.push('toolbar:' + m); }",
        "function Na__UiFeature__ToggleWalkMode(onA, onD) { S.calls.push('walk-exit'); if (S.walk) { S.walk = false; if (onD) onD(); } }",
        "function Na__UiFeature__ToggleFlyMode(onA, onD) { S.calls.push('fly-exit'); if (S.fly) { S.fly = false; if (onD) onD(); } }",
        'function Na__PresentationMode__Camera__AnimateToScene() {}',
        'function Na__PresentationMode__Camera__CancelCurrentTransition() {}',
        'function Na__PresentationMode__UI__AddSceneNavigationRouter() {}'
    ].join('\n'), 'Transitions');

    // THE WALK AND FLY CONTROLS, with a render loop that keeps its reasons in a set
    globalThis.__R = { reasons : new Set(), active : false };
    const loopStubs = (mode) => [
        'const R = globalThis.__R;',
        'function Na__RenderLoop__RequestActiveRender(reason) { R.reasons.add(reason); }',
        'function Na__RenderLoop__StopActiveRender(reason) { R.reasons.delete(reason); }',
        'function Na__RenderLoop__RequestRender() {}',
        'function Na__DoorProximity__Initialize() {}',
        'function Na__DoorProximity__SetEnabled() {}',
        'function Na__' + mode + 'Mode__Initialize() {}',
        'function Na__' + mode + 'Mode__IsActive() { return R.active; }',
        'function Na__' + mode + 'Mode__GetConfig() { return {}; }',
        'function Na__ModeTransition__OrbitTo' + mode + '() { R.active = true; return true; }',
        'function Na__ModeTransition__' + mode + 'ToOrbit() { R.active = false; return true; }',
        'function Na__' + mode + 'ModeDesktop__Activate() {}', 'function Na__' + mode + 'ModeDesktop__Deactivate() {}',
        'function Na__' + mode + 'ModeTouch__Activate() {}',   'function Na__' + mode + 'ModeTouch__Deactivate() {}'
    ].join('\n');
    const Walk = await load('10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js', loopStubs('Walk'), 'Walk');
    const Fly  = await load('10__NavigationAndCameras/Na__UiFeature__FlyModeControls.js',  loopStubs('Fly'),  'Fly');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }

    console.log('TrueVision3D - Page Up / Page Down on a drawing, and leaving Walk');

    // PAGING
    // ------------------------------------------------------------
    console.log('\n  Page Up and Page Down on a drawing');
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED_KEY_MAP);
    Pc.Na__LePc__Attach();
    const keydown = listeners.find((l) => l.type === 'keydown');
    const press = (name, o) => { asked.length = 0; const event = key(name, o); keydown.fn(event); return [ asked.map((a) => a.type + ':' + a.detail.direction), event.prevented ]; };
    const actionFor = (name) => (KeyMap.Na__LeCfg__MatchKeyBinding(name, {}) || {}).action || null;
    check('the shipped key map binds them',            [ actionFor('PageUp'), actionFor('PageDown') ], [ 'Nav__PreviousSheet', 'Nav__NextSheet' ]);
    check('Page Down asks for the drawing after this one, and the stage cannot scroll', press('PageDown'), [ [ Pc.Na__LePc__STEP_SHEET_EVENT + ':1' ], true ]);
    check('Page Up asks for the drawing before this one',                               press('PageUp'),   [ [ Pc.Na__LePc__STEP_SHEET_EVENT + ':-1' ], true ]);
    check('a held Page Down is taken but asks nothing more',                            press('PageDown', { repeat : true }), [ [], true ]);
    check('Page Down in a text box stays the text box\'s',                              press('PageDown', { target : { tagName : 'INPUT', isContentEditable : false } }), [ [], false ]);
    check('Page Down in a list stays the list\'s',                                      press('PageDown', { target : { tagName : 'SELECT', isContentEditable : false } }), [ [], false ]);
    check('Page Down from a ticked box turns the drawing (a tick box has no use for it)', press('PageDown', { target : { tagName : 'INPUT', type : 'checkbox', isContentEditable : false } }), [ [ Pc.Na__LePc__STEP_SHEET_EVENT + ':1' ], true ]);
    check('with Ctrl held it is not the binding (Exact)', (() => { asked.length = 0; const e = key('PageDown'); e.ctrlKey = true; keydown.fn(e); return [ asked.length, e.prevented ]; })(), [ 0, false ]);
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('the built-in fallback key map pages too',                                    press('PageDown'), [ [ Pc.Na__LePc__STEP_SHEET_EVENT + ':1' ], true ]);
    Pc.Na__LePc__Detach();
    check('detached with the drawing tab, it hears nothing', listeners.some((l) => l.type === 'keydown'), false);

    // LEAVING WALK AND FLY
    // ------------------------------------------------------------
    console.log('\n  Leaving Walk and Fly');
    const T = globalThis.__T;
    const suspend = (options, state) => {
        Object.assign(T, { walk : false, fly : false, culling : true, toolbar : 'orbit', calls : [] }, state);
        Transitions.Na__DrawView__Transitions__SuspendThreeD(options);
        const out = { walk : T.walk, fly : T.fly, toolbar : T.toolbar, calls : T.calls.slice() };
        Transitions.Na__DrawView__Transitions__ResumeThreeD();
        return out;
    };
    check('the Layout Editor opening while walking: the whole exit, and Orbit lit',
        suspend({ returnToOrbit : true }, { walk : true, toolbar : 'walk' }), { walk : false, fly : false, toolbar : 'orbit', calls : [ 'walk-exit', 'toolbar:orbit', 'culling:false' ] });
    check('the Layout Editor opening while flying: the same',
        suspend({ returnToOrbit : true }, { fly : true, toolbar : 'fly' }), { walk : false, fly : false, toolbar : 'orbit', calls : [ 'fly-exit', 'toolbar:orbit', 'culling:false' ] });
    check('the Layout Editor opening in Orbit changes no mode',
        suspend({ returnToOrbit : true }, {}).calls, [ 'culling:false' ]);
    check('a picture rendered while somebody walks: Walk kept, toolbar untouched',
        suspend(undefined, { walk : true, toolbar : 'walk' }), { walk : true, fly : false, toolbar : 'walk', calls : [ 'culling:false' ] });
    check('and the culling comes back as it was', (() => { Object.assign(T, { walk : false, fly : false, culling : true, calls : [] }); Transitions.Na__DrawView__Transitions__SuspendThreeD(); Transitions.Na__DrawView__Transitions__ResumeThreeD(); return T.calls; })(), [ 'culling:false', 'culling:true' ]);
    const returnToOrbit = () => typeof Transitions.Na__DrawView__Transitions__ReturnToOrbit === 'function' ? Transitions.Na__DrawView__Transitions__ReturnToOrbit() : 'missing';
    check('ReturnToOrbit says whether it left anything',
        [ (Object.assign(T, { walk : true }), returnToOrbit()), returnToOrbit() ], [ true, false ]);

    // THE RENDER HOLD
    // ------------------------------------------------------------
    console.log('\n  The continuous render asked for by Walk and Fly');
    const R = globalThis.__R;
    const roundTrip = (Mode, init, toggle) => {
        R.reasons.clear(); R.active = false;
        Mode[init]({}, {}, { domElement : {} }, {}, {}, false);
        Mode[toggle](null, null);
        const during = [ ...R.reasons ];
        Mode[toggle](null, null);
        return { during, after : [ ...R.reasons ] };
    };
    check('Walk asks for continuous frames, and lets them go on the way out', roundTrip(Walk, 'Na__UiFeature__InitializeWalkModeSystem', 'Na__UiFeature__ToggleWalkMode'), { during : [ 'walk-mode' ], after : [] });
    check('Fly the same',                                                    roundTrip(Fly,  'Na__UiFeature__InitializeFlyModeSystem',  'Na__UiFeature__ToggleFlyMode'),  { during : [ 'fly-mode' ],  after : [] });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    if (failures) { console.log('  ' + failures + ' check(s) FAILED'); process.exit(1); }
    console.log('  Every check passed.');
    process.exit(0);

// endregion -------------------------------------------------------------------
