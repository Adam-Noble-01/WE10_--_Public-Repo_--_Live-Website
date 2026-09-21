// =============================================================================
// TRUEVISION3D - TEST - THE DRAWING TABS' KEYS: M, THE FOCUS AND THE FALLBACK
// =============================================================================
//
// FILE       : Na__Test__DrawingTabKeys__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Drawing Tab Keys Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Move key (and every other drawing-tab key) cannot get stuck behind a focused control, a missing fallback binding or a key file that failed to load
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE FALLBACK. The built-in key map must resolve every key exactly as the
//   shipped file does - every binding's own keys and modifiers, and each key
//   bare, with Shift, Ctrl, Ctrl+Shift and Alt - with the pointer, wheel,
//   selection, guard, keyboard, touch and Measurements blocks alike. It had
//   lost Move (M), the space bar's Select and Ctrl+S, so a key file that
//   failed to load left M dead for the whole session.
// - RE-READING THE KEY FILE. A read that lands replaces the map; a read that
//   fails, or a file that does not parse, keeps the map in force; a map handed
//   in (SetKeyMap) is never replaced; two calls at once share one read.
// - WHICH KEYS A FOCUSED CONTROL KEEPS (Na__KeyScope__ControlKeepsKey).
// - THE SHEET'S KEYBOARD. The real SheetTools__Keyboard__ module: M, Escape
//   and the arrows reach the sheet from a focused tick box or list - taken
//   from the control, focus and all - while a text box keeps every key, a
//   list keeps its arrows and a number box its figures. Chords still reach
//   the sheet from any control without moving the focus.
// - A PRESS ON THE STAGE TAKES THE KEYBOARD. The real Controls__Pc__ module:
//   a press on the paper moves the focus from a panel control to the stage;
//   a field on the paper, a control pressed on the stage and a stage that
//   already has it are left alone; the listener is a capture listener, added
//   on Attach and taken off on Detach.
// - Each module is the shipped file with its import lines swapped for stubs
//   (any name not handed in reads as a function returning undefined).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DrawingTabKeys__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the fix for M getting stuck on the drawing tabs.
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
    const DRAWING_KEYS_FILE = '51__System__LayoutEditor/03__Core__Config/Na__Hotkeys__DrawingTabs__.json';   // <-- The drawing tabs' key file

    const IMPORT = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;
    let loadCount = 0;

    // CRLF files are read as LF first: the import pattern ends a line at ';'.
    async function load(relative, stubs) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const names = [];
        let m;
        IMPORT.lastIndex = 0;
        while ((m = IMPORT.exec(src)) !== null) {
            const list = m[1].trim();
            if (list.charAt(0) !== '{') continue;
            list.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
        }
        const had = /^\s*import\s/m.test(src);
        src = src.replace(IMPORT, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const key = '__DtkStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__DrawingTabKeys__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    const SHIPPED = JSON.parse(readFileSync(resolve(SRC, DRAWING_KEYS_FILE), 'utf8'));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    const windowListeners = [];
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener      : (type, fn, capture) => windowListeners.push({ type, fn, capture : !!capture }),
        removeEventListener   : (type, fn) => { const at = windowListeners.findIndex((l) => l.type === type && l.fn === fn); if (at !== -1) windowListeners.splice(at, 1); },
        dispatchEvent         : () => true,
        requestAnimationFrame : () => 0,
        cancelAnimationFrame  : () => {}
    };
    const BODY = { tagName : 'BODY', isContentEditable : false };
    globalThis.document = { activeElement : BODY, body : BODY };

    // An element: its tag, its type, whether it sits on the stage, and whether
    // it is a real control (what the press guard's selector would match).
    function el(tagName, o) {
        const opts = o || {};
        return {
            tagName, type : opts.type, isContentEditable : !!opts.editable, onStage : !!opts.onStage, control : !!opts.control,
            blurred : 0, blur() { this.blurred++; if (document.activeElement === this) document.activeElement = BODY; },
            closest() { return this.control ? this : null; }
        };
    }

    const stageListeners = [];
    const STAGE = {
        tagName : 'DIV', isContentEditable : false, focusCalls : 0,
        addEventListener    : (type, fn, capture) => stageListeners.push({ type, fn, capture : !!capture }),
        removeEventListener : (type, fn, capture) => { const at = stageListeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture); if (at !== -1) stageListeners.splice(at, 1); },
        classList : { add : () => {}, remove : () => {} },
        contains(node) { return !!node && (node === STAGE || node.onStage === true); },
        focus() { this.focusCalls++; document.activeElement = STAGE; },
        closest() { return null; }
    };

    function keyEvent(name, target, o) {
        const opts = o || {};
        return {
            key : name, code : '', target : target || BODY,
            ctrlKey : !!opts.ctrl, shiftKey : !!opts.shift, altKey : !!opts.alt, metaKey : false, repeat : false,
            prevented : false, preventDefault() { this.prevented = true; }
        };
    }

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

    console.log('TrueVision3D - the drawing tabs\' keys: M, the focus and the fallback');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fallback Resolves Every Key as the Shipped File Does
// -----------------------------------------------------------------------------

    console.log('\n  The built-in key map against the shipped file');
    const KeyMap = await load('51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', { Na__LeCfg__PREFIX : 'LayoutEditor__' });

    const list = (block) => (SHIPPED['LayoutEditor__' + block + '__Config'] || {})['LayoutEditor__' + block + '__List'] || [];
    const MODS = [ 'Ctrl', 'Shift', 'Alt', 'Meta', 'Space' ];
    const held = (names) => { const h = {}; MODS.forEach((n) => { h[n] = names.indexOf(n) !== -1; }); return h; };
    const COMBOS = [ [], [ 'Shift' ], [ 'Ctrl' ], [ 'Ctrl', 'Shift' ], [ 'Alt' ] ];

    // Every key named anywhere in the shipped keyboard list, pressed with its
    // binding's modifiers and with each of the common combinations.
    const presses = [];
    list('KeyboardBindings').forEach((b) => (b.Keys || []).forEach((k) => {
        presses.push([ k, b.Modifiers || [] ]);
        COMBOS.forEach((c) => presses.push([ k, c ]));
    }));
    const resolveAll = () => presses.map(([ k, c ]) => {
        const m = KeyMap.Na__LeCfg__MatchKeyBinding(k, held(c));
        return (m ? m.action + (m.coarse ? '+coarse' : '') : '-') ;
    });
    const buttons = [ 'Left', 'Middle', 'Right' ];
    const resolvePointer = () => {
        const out = [];
        buttons.forEach((button) => COMBOS.concat([ [ 'Space' ] ]).forEach((c) => [ true, false ].forEach((emptyStage) => out.push(KeyMap.Na__LeCfg__MatchPointerBinding({ button, modifiers : held(c), emptyStage })))));
        return out;
    };
    const resolveRest = () => ({
        wheel     : COMBOS.map((c) => KeyMap.Na__LeCfg__MatchWheelBinding(held(c))),
        selection : COMBOS.concat([ [ 'Alt', 'Shift' ] ]).map((c) => KeyMap.Na__LeCfg__MatchSelectionModifier(held(c))),
        guards    : KeyMap.Na__LeCfg__GetGuards(),
        keyboard  : KeyMap.Na__LeCfg__GetKeyboardSetup(),
        touch     : KeyMap.Na__LeCfg__GetTouchSetup(),
        measure   : KeyMap.Na__LeCfg__GetMeasureKeys(),
        space     : KeyMap.Na__LeCfg__IsPointerModifierBound('Space')
    });

    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED);
    const shippedKeys = resolveAll(), shippedPointer = resolvePointer(), shippedRest = resolveRest();
    KeyMap.Na__LeCfg__SetKeyMap(null);
    const fallbackKeys = resolveAll(), fallbackPointer = resolvePointer(), fallbackRest = resolveRest();

    const differing = presses.map((p, i) => (shippedKeys[i] !== fallbackKeys[i] ? p[0] + '[' + p[1].join('+') + '] shipped ' + shippedKeys[i] + ', fallback ' + fallbackKeys[i] : null)).filter(Boolean);
    check('every key resolves the same through both (' + presses.length + ' presses)', differing, []);
    check('M is Move in the fallback too',                         fallbackKeys[presses.findIndex((p) => p[0] === 'm' && p[1].length === 0)], 'Tool__Move');
    check('the space bar arms Select in the fallback, not Deselect', (KeyMap.Na__LeCfg__MatchKeyBinding(' ', held([])) || {}).action, 'Tool__SelectToggle');
    check('Ctrl+S is the editor\'s save in the fallback',          (KeyMap.Na__LeCfg__MatchKeyBinding('s', held([ 'Ctrl' ])) || {}).action, 'Edit__Save');
    check('every press on the stage means the same',               fallbackPointer, shippedPointer);
    check('the wheel, the selection keys, the guards, the setups and the Measurements keys match', fallbackRest, shippedRest);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Key File Again
// -----------------------------------------------------------------------------

    console.log('\n  Reading the drawing tabs\' key file again');
    const withKey = (key, action) => {
        const map = JSON.parse(JSON.stringify(SHIPPED));
        map.LayoutEditor__KeyboardBindings__Config.LayoutEditor__KeyboardBindings__List.push({ Id : 'Test__' + key, Action : action, Enabled : true, Keys : [ key ], Modifiers : [], ModifierMatch : 'Exact' });
        return map;
    };
    let reads = 0;
    let answer = null;
    globalThis.fetch = async () => { reads++; return answer(); };
    const actionOf = (key) => (KeyMap.Na__LeCfg__MatchKeyBinding(key, held([])) || {}).action || null;
    const warn = console.warn; console.warn = () => {};

    KeyMap.Na__LeCfg__SetKeyMap(null);
    answer = () => ({ ok : true, json : async () => withKey('q', 'Tool__Move') });
    check('a read that lands replaces the map',                    [ await KeyMap.Na__LeCfg__ReloadKeyMap(), actionOf('q') ], [ true, 'Tool__Move' ]);
    answer = () => { throw new Error('offline'); };
    check('a read that fails keeps the map in force',              [ await KeyMap.Na__LeCfg__ReloadKeyMap(), actionOf('q'), actionOf('m') ], [ false, 'Tool__Move', 'Tool__Move' ]);
    answer = () => ({ ok : true, json : async () => { throw new SyntaxError('half written'); } });
    check('a file caught half written keeps it too',               [ await KeyMap.Na__LeCfg__ReloadKeyMap(), actionOf('q') ], [ false, 'Tool__Move' ]);
    answer = () => ({ ok : false, status : 404 });
    check('so does a file that is not there',                      [ await KeyMap.Na__LeCfg__ReloadKeyMap(), actionOf('q') ], [ false, 'Tool__Move' ]);
    answer = () => ({ ok : true, json : async () => SHIPPED });
    const before = reads;
    const one = KeyMap.Na__LeCfg__ReloadKeyMap(), two = KeyMap.Na__LeCfg__ReloadKeyMap();
    check('two calls at once share one read',                      [ one === two, await one, reads - before ], [ true, true, 1 ]);
    KeyMap.Na__LeCfg__SetKeyMap(withKey('w', 'Tool__Move'));
    const handedReads = reads;
    check('a map handed in is never replaced by the file',         [ await KeyMap.Na__LeCfg__ReloadKeyMap(), reads - handedReads, actionOf('w') ], [ false, 0, 'Tool__Move' ]);
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('handed back (null), the file is read again',            [ await KeyMap.Na__LeCfg__ReloadKeyMap(), actionOf('w') ], [ true, null ]);
    console.warn = warn;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Keys a Focused Control Keeps
// -----------------------------------------------------------------------------

    console.log('\n  Which keys a focused control keeps');
    const Scope = await load('03__AppUtils/Na__AppUtils__KeyScope__.js');
    const keeps = (element, keys) => keys.map((k) => Scope.Na__KeyScope__ControlKeepsKey(element, k));
    const TEXT = el('INPUT', { type : 'text' }), AREA = el('TEXTAREA'), PAGE = el('DIV', { editable : true });
    const TICK = el('INPUT', { type : 'checkbox' }), LIST = el('SELECT'), NUMBER = el('INPUT', { type : 'number' });
    const SLIDER = el('INPUT', { type : 'range' }), BUTTON = el('BUTTON'), COLOUR = el('INPUT', { type : 'color' });
    check('a text box, a text area and a page being written keep every key', [ keeps(TEXT, [ 'm', 'Escape', 'F3' ]), keeps(AREA, [ 'm' ]), keeps(PAGE, [ 'm', 'Delete' ]) ], [ [ true, true, true ], [ true ], [ true, true ] ]);
    check('a tick box keeps Space and Enter, and no letter, Escape, Delete or arrow', keeps(TICK, [ ' ', 'Enter', 'm', 'v', 'Escape', 'Delete', 'ArrowLeft' ]), [ true, true, false, false, false, false, false ]);
    check('a list keeps its arrows, Home, End, the page keys, Space and Enter', keeps(LIST, [ 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', ' ', 'Enter' ]), [ true, true, true, true, true, true, true ]);
    check('but no letter and no Escape: M is not "Medium"',        keeps(LIST, [ 'm', 'M', 'Escape', 'Delete', 'F3' ]), [ false, false, false, false, false ]);
    check('a number box keeps its figures and the keys that edit them', keeps(NUMBER, [ '5', '.', '-', 'e', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'Enter' ]), [ true, true, true, true, true, true, true, true, true ]);
    check('but not a tool letter',                                 keeps(NUMBER, [ 'm', 'v', 'k', 'F8' ]), [ false, false, false, false ]);
    check('a slider keeps its arrows; a button and a colour picker only Space and Enter', [ keeps(SLIDER, [ 'ArrowLeft', 'm' ]), keeps(BUTTON, [ 'Enter', ' ', 'm' ]), keeps(COLOUR, [ ' ', 'm' ]) ], [ [ true, false ], [ true, true, false ], [ true, false ] ]);
    check('nothing focused, or the stage, keeps nothing',          [ Scope.Na__KeyScope__ControlKeepsKey(null, 'm'), Scope.Na__KeyScope__ControlKeepsKey(BODY, 'm'), Scope.Na__KeyScope__ControlKeepsKey(STAGE, 'ArrowLeft') ], [ false, false, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet's Keyboard
// -----------------------------------------------------------------------------

    console.log('\n  The sheet\'s keyboard with a control focused');
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED);
    const ToolsState = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js');
    const kb = { tools : [], undo : 0, cancelled : 0 };
    const Keys = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__Keyboard__.js', {
        Na__LeCfg__GetKeyboardSetup    : KeyMap.Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchKeyBinding     : KeyMap.Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__GetLabel            : (k, f) => f,
        Na__KeyScope__ControlKeepsKey  : Scope.Na__KeyScope__ControlKeepsKey,
        Na__LeModel__GetActiveSheet    : () => ({ Sheet__Id : 'Sheet_Test' }),
        Na__LeModel__GetSelectionItems : () => [],
        Na__LeModel__SetSelection      : () => { kb.cancelled++; },
        Na__LeTools__TOOL_SELECT       : ToolsState.Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_MOVE         : ToolsState.Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT         : ToolsState.Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION    : ToolsState.Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW         : ToolsState.Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT         : ToolsState.Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_LEADER       : ToolsState.Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOL_AREA         : ToolsState.Na__LeTools__TOOL_AREA,
        Na__LeTools__SHEET_CHORDS      : ToolsState.Na__LeTools__SHEET_CHORDS,
        Na__LeTools__NON_TEXT_INPUTS   : ToolsState.Na__LeTools__NON_TEXT_INPUTS,
        Na__LeTools__Stage             : STAGE,
        Na__LeTools__Editable          : true,
        Na__LeTools__Tool              : ToolsState.Na__LeTools__TOOL_SELECT,
        Na__LeTools__SetTool           : (tool) => { kb.tools.push(tool); return tool; },
        Na__LeHist__Undo               : () => { kb.undo++; return true; }
    });
    // Press a key with a control focused. Returns [ the tools picked, whether
    // the key was taken from the browser, whether the stage got the focus ].
    const press = (name, target, o) => {
        kb.tools = []; STAGE.focusCalls = 0; document.activeElement = target || BODY;
        const event = keyEvent(name, target, o);
        Keys.Na__LeTools__OnKey(event);
        return [ kb.tools.slice(), event.prevented, STAGE.focusCalls > 0 ];
    };
    const MOVE = ToolsState.Na__LeTools__TOOL_MOVE, SELECT = ToolsState.Na__LeTools__TOOL_SELECT;
    check('M with nothing focused picks Move (as ever)',                         press('m', BODY), [ [ MOVE ], false, false ]);
    check('M from a ticked box picks Move, takes the key and the focus',         press('m', el('INPUT', { type : 'checkbox' })), [ [ MOVE ], true, true ]);
    check('M from a list picks Move and the list never sees it (no "Medium")',   press('m', el('SELECT')), [ [ MOVE ], true, true ]);
    check('a capital M (Caps Lock) from a list, the same',                       press('M', el('SELECT')), [ [ MOVE ], true, true ]);
    check('M from a number box picks Move (a figure cannot hold an M)',          press('m', el('INPUT', { type : 'number' })), [ [ MOVE ], true, true ]);
    check('V from a toolbar list picks Select',                                   press('v', el('SELECT')), [ [ SELECT ], true, true ]);
    check('M typed into a text box stays the text box\'s',                       press('m', el('INPUT', { type : 'text' })), [ [], false, false ]);
    check('M typed into a page being written stays the page\'s',                 press('m', el('DIV', { editable : true })), [ [], false, false ]);
    check('an arrow in a list stays the list\'s',                                 press('ArrowDown', el('SELECT')), [ [], false, false ]);
    check('a figure in a number box stays the number box\'s (nothing bound)',    press('5', el('INPUT', { type : 'number' })), [ [], false, false ]);
    check('Space on a tick box stays the tick box\'s',                            press(' ', el('INPUT', { type : 'checkbox' })), [ [], false, false ]);
    check('Escape in a number box stays the number box\'s',                       press('Escape', el('INPUT', { type : 'number' })), [ [], false, false ]);
    kb.cancelled = 0;
    const escaped = press('Escape', el('SELECT'));
    check('Escape from a list is the sheet\'s: back to Select, the key and the focus taken', [ escaped, kb.cancelled ], [ [ [ SELECT ], true, true ], 1 ]);
    kb.undo = 0;
    const undone = press('z', el('SELECT'), { ctrl : true });
    check('Ctrl+Z from a list is the sheet\'s undo, and the list keeps the focus (as before)', [ kb.undo, undone[2] ], [ 1, false ]);

    console.log('\n  Enter in a one-line panel field gives the keys back');
    // Returns [ the stage took the focus, the stage has it, the key was taken ].
    const enterIn = (target, o) => {
        const opts = o || {};
        STAGE.focusCalls = 0; document.activeElement = opts.focused || target;
        const event = keyEvent('Enter', target);
        if (opts.composing) event.isComposing = true;
        Keys.Na__LeTools__OnKey(event);
        return [ STAGE.focusCalls > 0, document.activeElement === STAGE, event.prevented ];
    };
    check('Enter in a panel text box (a room\'s name): the stage takes the keys, the field blurs and commits', enterIn(el('INPUT', { type : 'text' })), [ true, true, false ]);
    check('a text area keeps its Enter - it is a new line there',                 enterIn(el('TEXTAREA')), [ false, false, false ]);
    check('a page being written keeps its Enter',                                  enterIn(el('DIV', { editable : true })), [ false, false, false ]);
    check('text typed on the paper is left to its tool',                           enterIn(el('INPUT', { type : 'text', onStage : true })), [ false, false, false ]);
    check('a field its own Enter already put away is left alone',                  enterIn(el('INPUT', { type : 'text' }), { focused : BODY }), [ false, false, false ]);
    check('an Enter finishing an input method\'s composition stays with the field', enterIn(el('INPUT', { type : 'text' }), { composing : true }), [ false, false, false ]);
    check('M typed into that panel text box is still a letter, not Move',          press('m', el('INPUT', { type : 'text' })), [ [], false, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Press on the Stage Takes the Keyboard
// -----------------------------------------------------------------------------

    console.log('\n  A press on the stage takes the keyboard');
    const Pc = await load('51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js', {
        Na__LeCfg__GetGuards               : KeyMap.Na__LeCfg__GetGuards,
        Na__LeCfg__GetKeyboardSetup        : KeyMap.Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchPointerBinding     : KeyMap.Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding       : KeyMap.Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding         : KeyMap.Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__IsPointerModifierBound  : KeyMap.Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetNavigationSetup      : () => ({ zoomWheelStep : 0.001 }),
        Na__LeSurface__GetElements         : () => ({ stage : STAGE }),
        Na__LeSurface__GetZoom             : () => 1,
        Na__KeyScope__ControlKeepsKey      : Scope.Na__KeyScope__ControlKeepsKey
    });
    stageListeners.length = 0;
    Pc.Na__LePc__Attach();
    const taker = stageListeners.find((l) => l.type === 'pointerdown' && l.capture);
    check('Attach listens for presses on the stage in the capture phase', !!taker, true);
    const pressStage = (focused, target) => {
        STAGE.focusCalls = 0; document.activeElement = focused;
        taker.fn({ target : target || el('DIV', { onStage : true }), button : 0, pointerType : 'mouse' });
        return [ STAGE.focusCalls, document.activeElement === STAGE ];
    };
    const panelTick = el('INPUT', { type : 'checkbox' });
    check('a press on the paper takes the focus from a panel tick box',   pressStage(panelTick), [ 1, true ]);
    check('and from the toolbar\'s Raster list',                          pressStage(el('SELECT')), [ 1, true ]);
    check('and from a panel text box (its change is committed by the blur)', pressStage(el('INPUT', { type : 'text' })), [ 1, true ]);
    check('with nothing focused the stage takes it',                      pressStage(BODY), [ 1, true ]);
    check('a stage that already has it is left alone',                    pressStage(STAGE), [ 0, true ]);
    check('text being typed on the paper is left to its tool',            pressStage(el('INPUT', { type : 'text', onStage : true })), [ 0, false ]);
    check('a control pressed on the stage keeps its own focus',           pressStage(panelTick, el('INPUT', { type : 'text', onStage : true, control : true })), [ 0, false ]);
    check('TakeKeyboard with no press (a drawing tab opened) takes it',   (() => { STAGE.focusCalls = 0; document.activeElement = panelTick; return [ Pc.Na__LePc__TakeKeyboard(), document.activeElement === STAGE ]; })(), [ true, true ]);
    Pc.Na__LePc__Detach();
    check('Detach takes the press listener off',                          stageListeners.some((l) => l.type === 'pointerdown' && l.capture), false);
    check('and with nothing attached, TakeKeyboard does nothing',         (() => { document.activeElement = panelTick; return [ Pc.Na__LePc__TakeKeyboard(), document.activeElement === panelTick ]; })(), [ false, true ]);

// endregion -------------------------------------------------------------------


    console.log('\n' + (failures === 0 ? '  Every check passed.' : '  ' + failures + ' FAILED'));
    process.exit(failures === 0 ? 0 : 1);
