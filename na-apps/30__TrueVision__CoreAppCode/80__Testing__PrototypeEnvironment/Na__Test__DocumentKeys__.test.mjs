// =============================================================================
// TRUEVISION3D - TEST - THE DOCUMENT KEYS AND THE KEY SCOPE
// =============================================================================
//
// FILE       : Na__Test__DocumentKeys__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Document Keys Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a letter typed into a document is a letter, and that each of the app's three keyboards keeps to its own tab
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE REPORT. On the Statements tab, typing R (and B, T, Y and the digits)
//   into the statement did nothing: the 3D Model tab's hotkeys were still
//   listening, their typing test missed contenteditable, and they took the
//   key. Ctrl+S saved the sheets rather than the statement.
// - THE KEY SCOPE (Na__AppUtils__KeyScope__): three scopes, model until the
//   mode controller's reader is handed over, the reader asked afresh on
//   every key, model again from a reader that fails or talks nonsense, and a
//   typing test that counts contenteditable.
// - THE 3D HOTKEYS (Na__Hotkeys__Manager): R resets the view on the 3D Model
//   tab and nowhere else, and never while anything editable has the focus -
//   the statement page, or a plan annotation label on the 3D tab itself.
// - THE DOCUMENTS' KEYBOARD (Na__LayoutEditor__DocumentKeys__): the shipped
//   bindings match what the Statements tab always answered (Command as Ctrl,
//   / and ? alike) and refuse AltGr; a key is acted on only in the document
//   scope and only by the document on screen; a document with no answer, or
//   one that declines, leaves the key to go on; a held key is taken but acts
//   once; and a bare key that would type a character is never acted on while
//   the focus takes text, whatever the key map binds.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched. The key scope is ONE instance shared by the test
//   and both modules, as it is in the app.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DocumentKeys__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the documents' keyboard (TrueVision3D v2.109.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    // The modules touch window (a listener) and document (the focus). A key
    // event is a plain object that records what was done to it.
    const listeners = [];
    globalThis.window   = { addEventListener : (type, fn, capture) => listeners.push({ type, fn, capture : !!capture }) };
    globalThis.document = { activeElement : null };

    const BODY     = { tagName : 'BODY',     isContentEditable : false };
    const PAGE     = { tagName : 'ARTICLE',  isContentEditable : true  };   // <-- The statement being written
    const LABEL    = { tagName : 'DIV',      isContentEditable : true  };   // <-- A plan annotation label being edited on the 3D tab
    const FIELD    = { tagName : 'INPUT',    isContentEditable : false };
    const AREA     = { tagName : 'TEXTAREA', isContentEditable : false };
    const BUTTON   = { tagName : 'BUTTON',   isContentEditable : false };

    function key(name, options) {
        const o = options || {};
        return {
            key : name, target : o.target || BODY,
            ctrlKey : !!o.ctrl, shiftKey : !!o.shift, altKey : !!o.alt, metaKey : !!o.meta,
            repeat : !!o.repeat, isComposing : !!o.composing, defaultPrevented : !!o.prevented,
            prevented : false, stopped : false,
            preventDefault()           { this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; }
        };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');

    function strip(relative) {
        let src = readFileSync(resolve(SRC, relative), 'utf8');
        const had = /^\s*import\s/m.test(src);
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        return src;
    }

    // THE KEY SCOPE is a leaf: copied as it is, and imported by URL with no
    // query so the test and both stubbed modules share the one instance.
    const scopeFile = join(tmpdir(), 'Na__Test__DocumentKeys__Scope__.mjs');
    writeFileSync(scopeFile, strip('03__AppUtils/Na__AppUtils__KeyScope__.js'), 'utf8');
    const scopeUrl = pathToFileURL(scopeFile).href;
    const Scope    = await import(scopeUrl);

    async function load(relative, tag) {
        const stub = "import { Na__KeyScope__MODEL, Na__KeyScope__SHEET, Na__KeyScope__DOCUMENT, Na__KeyScope__Is, Na__KeyScope__IsTypingTarget } from '" + scopeUrl + "';\n";
        const tmp  = join(tmpdir(), 'Na__Test__DocumentKeys__' + tag + '__.mjs');
        writeFileSync(tmp, stub + strip(relative), 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    const Hotkeys = await load('10__NavigationAndCameras/Na__Hotkeys__Manager.js', 'Hotkeys');
    const DocKeys = await load('51__System__LayoutEditor/31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__.js', 'DocKeys');

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

    console.log('TrueVision3D - the documents\' keyboard and the key scope');

    // THE KEY SCOPE
    // ------------------------------------------------------------
    // liveScope stands in for the mode controller's state: the reader handed
    // to Follow answers from it, as Na__LeMode__KeyScope answers from Active
    // and View.
    console.log('\n  The key scope');
    let liveScope = 'model';
    let readerThrows = false;
    check('starts on the 3D model, before any reader is handed over', Scope.Na__KeyScope__Get(), 'model');
    check('the mode controller\'s reader is taken',                  Scope.Na__KeyScope__Follow(() => { if (readerThrows) throw new Error('half way through opening a tab'); return liveScope; }), true);
    liveScope = 'sheet';
    check('and asked afresh: a drawing tab is the sheet scope',       Scope.Na__KeyScope__Get(), 'sheet');
    check('anything but a function is refused, the reader kept',     [ Scope.Na__KeyScope__Follow('document'), Scope.Na__KeyScope__Get() ], [ false, 'sheet' ]);
    liveScope = 'documents';
    check('a name that is not a scope reads as the 3D model\'s',      Scope.Na__KeyScope__Get(), 'model');
    liveScope = 'document'; readerThrows = true;
    check('a reader that fails reads as the 3D model\'s, never deaf', Scope.Na__KeyScope__Get(), 'model');
    readerThrows = false;
    check('and the reader is asked again on the next key',           Scope.Na__KeyScope__Is('document'), true);
    check('the typing test: contenteditable, text box, text area, list',
        [ PAGE, LABEL, FIELD, AREA, { tagName : 'SELECT' } ].map(Scope.Na__KeyScope__IsTypingTarget), [ true, true, true, true, true ]);
    check('the typing test: the page body, a button, nothing',
        [ BODY, BUTTON, null ].map(Scope.Na__KeyScope__IsTypingTarget), [ false, false, false ]);

    // THE 3D HOTKEYS
    // ------------------------------------------------------------
    console.log('\n  The 3D Model tab\'s hotkeys');
    const ran = [];
    Hotkeys.Na__Hotkeys__Initialize(
        { TrueVision__NavMode__ResetView : () => ran.push('reset'), TrueVision__NavMode__SetWalkMode : () => ran.push('walk'), TrueVision__PresentationMode__GoToScene1 : () => ran.push('scene1') },
        JSON.parse(readFileSync(resolve(SRC, '02__AppData/Na__AppConfig__Hotkeys.json'), 'utf8'))
    );
    const hotkeyListener = listeners.find((entry) => entry.type === 'keydown' && !entry.capture);
    const press3d = (scope, focus, name) => {
        liveScope = scope;
        document.activeElement = focus;
        ran.length = 0;
        const event = key(name, { target : focus });
        hotkeyListener.fn(event);
        return [ ran.slice(), event.prevented ];
    };
    check('R on the 3D Model tab resets the view and takes the key', press3d('model', BODY, 'r'), [ [ 'reset' ], true ]);
    check('R in a plan annotation label on the 3D tab is a letter',   press3d('model', LABEL, 'r'), [ [], false ]);
    check('R in a text box on the 3D tab is a letter (as before)',    press3d('model', FIELD, 'r'), [ [], false ]);
    check('R typed into the statement is a letter',                   press3d('document', PAGE, 'r'), [ [], false ]);
    check('R on a document tab, nothing focused, does nothing',       press3d('document', BODY, 'R'), [ [], false ]);
    check('T on a drawing tab does not put the hidden model into Walk', press3d('sheet', BODY, 't'), [ [], false ]);
    check('1 on a drawing tab does not fly the hidden camera',        press3d('sheet', BODY, '1'), [ [], false ]);

    // THE DOCUMENTS' KEYBOARD - MATCHING
    // ------------------------------------------------------------
    console.log('\n  The documents\' key map');
    const list  = DocKeys.Na__LeDocKeys__GetBindings();
    const held  = (o) => DocKeys.Na__LeDocKeys__Held(key('x', o), true);
    const match = (name, o) => { const b = DocKeys.Na__LeDocKeys__Match(list, name, held(o)); return b ? b.Action : null; };
    check('Ctrl+S saves',                          match('s', { ctrl : true }), 'Doc__Save');
    check('Command+S saves on a Mac',              match('s', { meta : true }), 'Doc__Save');
    check('Ctrl+Shift+S is not save',              match('S', { ctrl : true, shift : true }), null);
    check('AltGr+S (Ctrl+Alt) is never a shortcut', match('s', { ctrl : true, alt : true }), null);
    check('a bare S is only a letter',             match('s', {}), null);
    check('Ctrl+/ shows the raw markdown',         match('/', { ctrl : true }), 'Doc__ToggleSource');
    check('Ctrl+? (Shift held) does too',          match('?', { ctrl : true, shift : true }), 'Doc__ToggleSource');
    check('Ctrl+. switches the typeface',          match('.', { ctrl : true }), 'Doc__ToggleMono');
    check('Ctrl+> (Shift held) does too',          match('>', { ctrl : true, shift : true }), 'Doc__ToggleMono');
    check('Command stays Meta when MetaIsCtrl is off',
        DocKeys.Na__LeDocKeys__Held(key('s', { meta : true }), false), { Ctrl : false, Shift : false, Alt : false, Meta : true });
    check('a character is typed by a bare key or Shift, never by a chord',
        [ [ 'r', {} ], [ 'R', { shift : true } ], [ 's', { ctrl : true } ], [ 'Enter', {} ], [ 'F3', {} ] ].map(([ name, o ]) => DocKeys.Na__LeDocKeys__TypesCharacter(name, held(o))),
        [ true, true, false, false, false ]);
    check('the key label for a tooltip', [ DocKeys.Na__LeDocKeys__KeyLabel('Doc__Save'), DocKeys.Na__LeDocKeys__KeyLabel('Doc__ToggleSource'), DocKeys.Na__LeDocKeys__KeyLabel('Doc__Nothing') ], [ 'Ctrl+S', 'Ctrl+/', '' ]);

    // THE DOCUMENTS' KEYBOARD - WHO ANSWERS
    // ------------------------------------------------------------
    console.log('\n  The documents\' keyboard');
    DocKeys.Na__LeDocKeys__Initialize();
    const docListener = listeners.find((entry) => entry.type === 'keydown' && entry.capture);
    check('it listens on the window in the capture phase', !!docListener, true);
    check('and starts only once', DocKeys.Na__LeDocKeys__Initialize(), false);

    let statementsUp = true, specUp = false, answer = true;
    const saves = [];
    DocKeys.Na__LeDocKeys__Register('statements', { isShowing : () => statementsUp, actions : { Doc__Save : () => { saves.push('statement'); return answer; }, Doc__ToggleMono : () => { throw new Error('boom'); } } });
    DocKeys.Na__LeDocKeys__Register('specification', { isShowing : () => specUp, actions : {} });
    const pressDoc = (scope, name, o) => {
        liveScope = scope;
        saves.length = 0;
        const event = key(name, o);
        docListener.fn(event);
        return [ saves.slice(), event.prevented, event.stopped ];
    };
    check('Ctrl+S on the Statements tab saves the statement, and nobody else hears it', pressDoc('document', 's', { ctrl : true, target : PAGE }), [ [ 'statement' ], true, true ]);
    check('a held Ctrl+S is taken but saves once',                     pressDoc('document', 's', { ctrl : true, target : PAGE, repeat : true }), [ [], true, true ]);
    check('Ctrl+S on a drawing tab is left to the drawing',            pressDoc('sheet', 's', { ctrl : true }), [ [], false, false ]);
    check('Ctrl+S on the 3D Model tab is left alone',                  pressDoc('model', 's', { ctrl : true }), [ [], false, false ]);
    check('an input method composing keeps its keys',                  pressDoc('document', 's', { ctrl : true, composing : true }), [ [], false, false ]);
    check('a key already answered is not answered twice',              pressDoc('document', 's', { ctrl : true, prevented : true }), [ [], false, false ]);
    check('a plain R typed into the statement is not looked at',       pressDoc('document', 'r', { target : PAGE }), [ [], false, false ]);
    answer = false;
    check('a document that declines leaves the key to go on',          pressDoc('document', 's', { ctrl : true }), [ [ 'statement' ], false, false ]);
    answer = true;
    const quiet = console.error; console.error = () => {};
    check('a document whose answer fails still keeps its key',         pressDoc('document', '.', { ctrl : true }), [ [], true, true ]);
    console.error = quiet;
    statementsUp = false; specUp = true;
    check('Ctrl+S on the Project Specification goes on to the editor\'s save', pressDoc('document', 's', { ctrl : true }), [ [], false, false ]);
    specUp = false;
    check('with no document showing, nothing is taken',                pressDoc('document', 's', { ctrl : true }), [ [], false, false ]);

    // THE TYPING RULE HOLDS WHATEVER THE KEY MAP SAYS
    // ------------------------------------------------------------
    // A key map that binds a bare Q, loaded the way the app loads it.
    console.log('\n  A bare-letter binding, if anyone ever writes one');
    globalThis.fetch = async () => ({ ok : true, json : async () => ({ LayoutEditor__DocumentKeys__Bindings : { Bindings__List : [ { Id : 'Doc__Q', Action : 'Doc__Q', Enabled : true, Keys : [ 'q' ], Modifiers : [], ModifierMatch : 'Exact' } ] } }) });
    await DocKeys.Na__LeDocKeys__Ready();
    const qs = [];
    statementsUp = true;
    DocKeys.Na__LeDocKeys__Register('statements', { isShowing : () => statementsUp, actions : { Doc__Q : () => { qs.push('q'); return true; } } });
    const pressQ = (target) => { qs.length = 0; liveScope = 'document'; const event = key('q', { target }); docListener.fn(event); return [ qs.slice(), event.prevented ]; };
    check('Q typed into the statement stays a letter',  pressQ(PAGE),   [ [], false ]);
    check('Q typed into a text area stays a letter',    pressQ(AREA),   [ [], false ]);
    check('Q with the focus on a button is the binding', pressQ(BUTTON), [ [ 'q' ], true ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    if (failures) { console.log('  ' + failures + ' check(s) FAILED'); process.exit(1); }
    console.log('  Every check passed.');
    process.exit(0);

// endregion -------------------------------------------------------------------
