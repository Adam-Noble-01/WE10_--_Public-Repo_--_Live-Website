// =============================================================================
// TRUEVISION3D - TEST - THE DRAWING AXES OVERLAY (F9)
// =============================================================================
//
// FILE       : Na__Test__DrawingAxes__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Drawing Axes Overlay Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove where the axes cross, that they run edge to edge of the sheet one whole device pixel wide at any zoom, when they show and hide, and that F9 and the button switch them
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE OVERLAY. The real Na__LayoutEditor__DrawingAxes__ with its imports
//   stubbed and a paper, a stage and a handles layer just real enough: the
//   switch, its echo and the remembered flag; where the two lines cross (the
//   snap marker, else the cursor, never the marker mid-pan); that each line's
//   edge lands on a device pixel and its ink is whole device pixels at zooms
//   and pixel ratios that do not divide evenly; that each line shows only
//   while it crosses the sheet; that a panel, a finger, leaving the stage and
//   Detach hide them; that the layer sits under the handles and is not moved
//   again on every pointer move.
// - THE KEYS. The real key map with the shipped JSON and the built-in
//   fallback (F9 is View__AxesToggle; F6, F7 and F8 are untouched), the real
//   SHEET_CHORDS, and the real sheet keyboard dispatching F9 once, taking the
//   key, ignoring a held repeat and a text box's F9, and taking it from a
//   panel checkbox.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DrawingAxes__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Drawing Axes Overlay (Na__LayoutEditor__DrawingAxes__, F9).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    class FakeEl {
        constructor(tag) {
            this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.hidden = false;
            this.className = ''; this.attrs = {}; this.listeners = {}; this.moves = 0;
            const props = {};
            this.style = { transform : '', setProperty : (k, v) => { props[k] = String(v); }, getPropertyValue : (k) => props[k] || '' };
        }
        get nextSibling() { if (!this.parentNode) return null; const s = this.parentNode.children; const i = s.indexOf(this); return (i >= 0 && i + 1 < s.length) ? s[i + 1] : null; }
        get classList() { const el = this; const list = () => el.className.split(/\s+/).filter(Boolean);
            return { contains : (c) => list().includes(c), add : (c) => { if (!list().includes(c)) el.className = list().concat(c).join(' '); }, remove : (c) => { el.className = list().filter((x) => x !== c).join(' '); } }; }
        setAttribute(k, v) { this.attrs[k] = String(v); }
        appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); c.moves++; return c; }
        insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); const i = this.children.indexOf(ref); c.parentNode = this; this.children.splice(i < 0 ? this.children.length : i, 0, c); c.moves++; return c; }
        removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
        contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
        addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
        removeEventListener(n, f) { const a = this.listeners[n] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }
        getBoundingClientRect() { return this.rectFn ? this.rectFn() : { left : 0, top : 0, width : 0, height : 0 }; }
        fire(n, e) { (this.listeners[n] || []).slice().forEach((f) => f(e)); }
    }

    const announced = [];
    const storage   = new Map();
    const winListeners = {};
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        devicePixelRatio    : 1,
        addEventListener    : (n, f) => { (winListeners[n] = winListeners[n] || []).push(f); },
        removeEventListener : (n, f) => { const a = winListeners[n] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); },
        dispatchEvent       : (event) => { announced.push({ type : event.type, detail : event.detail }); return true; },
        localStorage        : { getItem : (k) => (storage.has(k) ? storage.get(k) : null), setItem : (k, v) => { storage.set(k, String(v)); }, removeItem : (k) => { storage.delete(k); } },
        setTimeout, clearTimeout,
        requestAnimationFrame : () => 0,
        cancelAnimationFrame  : () => {}
    };
    globalThis.document = { createElement : (tag) => new FakeEl(tag), body : { classList : { add : () => {}, remove : () => {}, toggle : () => {} } } };
    const fireWindow = (n, e) => (winListeners[n] || []).slice().forEach((f) => f(e));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // Every name a module imports gets a stub: the test's own when it gives one
    // (stubs), a live global getter when the module reads a let that changes
    // under it (live), else a function that does nothing and returns undefined.
    let loadCount = 0;
    async function load(relative, stubs, live) {
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
        const key = '__AxesStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const liveNames = live || [];
        const head = names.filter((n) => liveNames.indexOf(n) === -1).map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__DrawingAxes__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }
    function defineLive(name, getter) {
        Object.defineProperty(globalThis, name, { get : getter, configurable : true });
    }

    const AXES_CONFIG     = JSON.parse(readFileSync(resolve(SRC, LE + '33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__Config__.json'), 'utf8'));
    const SHIPPED_KEY_MAP = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__Hotkeys__DrawingTabs__.json'), 'utf8'));
    let servedConfig = AXES_CONFIG;
    globalThis.fetch = async () => ({ ok : true, json : async () => JSON.parse(JSON.stringify(servedConfig)) });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks, and the Sheet the Axes Are Drawn On
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    const r3 = (n) => Math.round(n * 1000) / 1000;

    // An A3 landscape sheet on a stage. The paper sits at a fractional client
    // position, as it does once the stage has scrolled.
    const PAGE = { WidthMm : 420, HeightMm : 297 };
    const S    = { zoom : 1, ppm : 96 / 25.4, left : 57.6, top : 100.3, marker : null };
    const stage   = new FakeEl('div'); stage.className = 'na-le-stage';
    const paper   = new FakeEl('div'); paper.className = 'na-le-paper';
    const stack   = new FakeEl('div'); stack.className = 'na-le-paper__stack';
    const handles = new FakeEl('div'); handles.className = 'na-le-paper__handles';
    const panel   = new FakeEl('div'); panel.className = 'na-le-panels';
    stage.appendChild(paper); paper.appendChild(stack); paper.appendChild(handles);
    paper.rectFn = () => ({ left : S.left, top : S.top, width : PAGE.WidthMm * S.ppm * S.zoom, height : PAGE.HeightMm * S.ppm * S.zoom });
    const scale   = () => S.ppm * S.zoom;
    const toClient = (xMm, yMm) => ({ x : S.left + (xMm * scale()), y : S.top + (yMm * scale()) });

    const said = [];
    const surfaceStubs = {
        Na__LeSurface__ZOOM_EVENT         : 'na-le-zoom',
        Na__LeSurface__ZOOM_SETTLED_EVENT : 'na-le-zoom-settled',
        Na__LeSurface__GetElements        : () => ({ stage : stage, paper : paper, handles : handles }),
        Na__LeSurface__GetLayout          : () => ({ Page : PAGE }),
        Na__LeSurface__GetZoom            : () => S.zoom,
        Na__LeSurface__GetPixelsPerMm     : () => S.ppm,
        Na__LeSurface__ClientToPaperMm    : (x, y) => ({ x : (x - S.left) / scale(), y : (y - S.top) / scale() }),
        Na__LeModel__CHANGED_EVENT        : 'na-le-model-changed',
        Na__LeMeasure__Say                : (text) => { said.push(text); return true; },
        Na__LeOsnap__GetMarkerPoint       : () => S.marker
    };

    // A pointer event, over the sheet unless told otherwise.
    const pointer = (xMm, yMm, o) => {
        const opts = o || {};
        const c = toClient(xMm, yMm);
        return { clientX : c.x, clientY : c.y, target : opts.target || paper, pointerType : opts.type || 'mouse' };
    };
    const move = (xMm, yMm, o) => fireWindow('pointermove', pointer(xMm, yMm, o));

    // Read a line's transform back: where its near edge lands and how much ink
    // it has, in DEVICE pixels, and whether the point it marks lies within half
    // a pixel of the line's middle.
    function ink(line, axis, pointMm) {
        const nums = (line.style.transform.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []).map(Number);
        const dpr  = window.devicePixelRatio;
        const [ tx, ty, sx, sy ] = nums;
        const offsetPx = axis === 'y' ? ty : tx;
        const thickPx  = axis === 'y' ? sy : sx;
        const origin   = axis === 'y' ? S.top : S.left;
        const edge     = (origin + (offsetPx * S.zoom)) * dpr;
        const width    = thickPx * S.zoom * dpr;
        const truth    = (origin + (pointMm * scale())) * dpr;
        return {
            edgeOnPixel : Math.abs(edge - Math.round(edge)) < 1e-6,
            inkPx       : r3(width),
            centred     : Math.abs((edge + (width / 2)) - truth) <= 0.5 + 1e-9,
            other       : axis === 'y' ? [ tx, sx ] : [ ty, sy ]                // <-- The long side: never moved, never stretched
        };
    }

// endregion -------------------------------------------------------------------


console.log('TrueVision3D - the Drawing Axes Overlay (F9)');


// -----------------------------------------------------------------------------
// REGION | Switching
// -----------------------------------------------------------------------------

    console.log('\n  Switching them on and off (the real module)');
    const Axes = await load(LE + '33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__.js', surfaceStubs);
    await Axes.Na__LeAxes__Ready();
    check('off until asked for, as in a fresh browser', Axes.Na__LeAxes__IsOn(), false);
    check('the button reads Axes, and its hover text opens with the full name', [ Axes.Na__LeAxes__Label('Toggle', '?'), Axes.Na__LeAxes__Label('ToggleTitle', '?').indexOf('Drawing Axes Overlay (F9)') ], [ 'Axes', 0 ]);
    const TOOLBAR_SRC = readFileSync(resolve(SRC, LE + '40__Ui__Panels/Na__LayoutEditor__Toolbar__.js'), 'utf8');
    check('the toolbar\'s own words are the config\'s, so a config that fails to load shows the same button',
        [ ...TOOLBAR_SRC.matchAll(/Na__LeAxes__Label\('Toggle', '([^']*)'\)/g) ].map((m) => m[1]), [ 'Axes', 'Axes' ]);
    announced.length = 0;
    check('Toggle switches them on', Axes.Na__LeAxes__Toggle(), true);
    check('...remembers it in this browser, echoes it and announces it',
        [ storage.get('na-layouteditor-drawing-axes'), said.slice(-1)[0], announced.map((e) => [ e.type, e.detail.enabled ]) ],
        [ '1', '<Drawing axes on>', [ [ 'na-layouteditor-drawing-axes-changed', true ] ] ]);
    check('switched on but not attached: nothing is drawn', [ Axes.Na__LeAxes__PlaceNow(), Axes.Na__LeAxes__GetCrossing() ], [ false, null ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Following the Pointer
// -----------------------------------------------------------------------------

    console.log('\n  Following the pointer');
    Axes.Na__LeAxes__Attach();
    check('Attach listens for the pointer, the keys and the view on window, and for scroll and leave on the stage',
        [ [ 'pointermove', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'na-le-zoom', 'na-le-zoom-settled', 'na-le-model-changed', 'resize' ].every((n) => (winListeners[n] || []).length === 1),
          (stage.listeners.scroll || []).length, (stage.listeners.pointerleave || []).length ],
        [ true, 1, 1 ]);
    check('nothing shows until the pointer is seen over the sheet', Axes.Na__LeAxes__GetCrossing(), null);
    move(150.25, 88.4);
    const layer = paper.children.find((c) => c.className === 'na-le-axes');
    const lineH = layer ? layer.children[0] : null, lineV = layer ? layer.children[1] : null;
    const c1 = Axes.Na__LeAxes__GetCrossing();
    check('a move over the sheet shows both lines, crossing at the cursor',
        [ !!layer, layer && layer.hidden, r3(c1.x), r3(c1.y), c1.horizontal, c1.vertical, c1.snapped ], [ true, false, 150.25, 88.4, true, true, false ]);
    check('the layer is on the paper, straight under the handles (they draw over it)', paper.children.map((c) => c.className), [ 'na-le-paper__stack', 'na-le-axes', 'na-le-paper__handles' ]);
    check('red along the width, green down the height, from the config',
        [ lineH.className, lineV.className, layer.style.getPropertyValue('--na-le-axes-horizontal'), layer.style.getPropertyValue('--na-le-axes-vertical') ],
        [ 'na-le-axes__line na-le-axes__line--horizontal', 'na-le-axes__line na-le-axes__line--vertical', '#ff0000', '#00a000' ]);

    const crisp = (label, zoom, dpr, xMm, yMm, wantInk) => {
        S.zoom = zoom; window.devicePixelRatio = dpr;
        move(xMm, yMm);
        const h = ink(lineH, 'y', yMm), v = ink(lineV, 'x', xMm);
        check(label, [ h.edgeOnPixel, h.inkPx, h.centred, v.edgeOnPixel, v.inkPx, v.centred, h.other, v.other ], [ true, wantInk, true, true, wantInk, true, [ 0, 1 ], [ 0, 1 ] ]);
    };
    crisp('zoom 1, pixel ratio 1: each edge on a device pixel, 1 px of ink, centred on the point', 1, 1, 150.25, 88.4, 1);
    crisp('zoom 2.37, pixel ratio 1.5: still on a pixel, 2 px of ink (1.5 rounded), centred', 2.37, 1.5, 33.3, 250.07, 2);
    crisp('zoom 0.5, pixel ratio 1.25: 1 px of ink, never a half-tone', 0.5, 1.25, 401.9, 3.14, 1);
    crisp('zoom 4, pixel ratio 2: 2 px of ink (1 screen px)', 4, 2, 0.4, 296.6, 2);
    S.zoom = 1; window.devicePixelRatio = 1;

    S.marker = { x : 120, y : 60 };
    move(121.3, 61.1);
    const c2 = Axes.Na__LeAxes__GetCrossing();
    check('a snap marker on show: they cross AT the marker, where a click lands', [ c2.x, c2.y, c2.snapped ], [ 120, 60, true ]);
    stage.classList.add('na-le-stage--panning');
    move(121.3, 61.1);
    const c3 = Axes.Na__LeAxes__GetCrossing();
    check('...but not mid-pan: the marker is left over, the cursor is what the paper moves with', [ r3(c3.x), r3(c3.y), c3.snapped ], [ 121.3, 61.1, false ]);
    stage.classList.remove('na-le-stage--panning');
    S.marker = null;

    move(210, -12);
    const c4 = Axes.Na__LeAxes__GetCrossing();
    check('cursor above the sheet: only the vertical line crosses it', [ c4.horizontal, c4.vertical, lineH.hidden, lineV.hidden, layer.hidden ], [ false, true, true, false, false ]);
    move(-20, 100, { target : stage });
    const c5 = Axes.Na__LeAxes__GetCrossing();
    check('cursor on the grey desk to the left: only the horizontal line', [ c5.horizontal, c5.vertical, lineH.hidden, lineV.hidden ], [ true, false, false, true ]);
    move(-20, -20, { target : stage });
    check('cursor off both edges at once: nothing', [ Axes.Na__LeAxes__GetCrossing(), layer.hidden ], [ null, true ]);
    move(0, 297);
    check('exactly on the sheet\'s edges still counts', [ Axes.Na__LeAxes__GetCrossing().horizontal, Axes.Na__LeAxes__GetCrossing().vertical ], [ true, true ]);

    move(100, 100, { target : panel });
    check('over a panel (not the stage): hidden', [ Axes.Na__LeAxes__GetCrossing(), layer.hidden ], [ null, true ]);
    move(100, 100);
    check('back over the sheet: shown again', layer.hidden, false);
    stage.fire('pointerleave', { pointerType : 'mouse' });
    check('leaving the stage (a menu, the toolbar, out of the window): hidden', [ Axes.Na__LeAxes__GetCrossing(), layer.hidden ], [ null, true ]);
    move(100, 100, { type : 'touch' });
    check('a finger: hidden (no hover)', layer.hidden, true);
    move(100, 100, { type : 'pen' });
    check('a pen hovers, so it shows them', layer.hidden, false);

    const movesBefore = layer.moves;
    const grid = new FakeEl('canvas'); grid.className = 'na-le-grid';
    paper.insertBefore(grid, handles);
    for (let i = 0; i < 5; i++) move(100 + i, 100 + i);
    check('the grid\'s canvas between it and the handles: the layer is left where it is, not moved every move',
        [ layer.moves - movesBefore, paper.children.map((c) => c.className) ], [ 0, [ 'na-le-paper__stack', 'na-le-axes', 'na-le-grid', 'na-le-paper__handles' ] ]);
    paper.removeChild(grid);

    S.left -= 37.25;                                                          // <-- The stage scrolled under a still cursor
    const before = Axes.Na__LeAxes__GetCrossing();
    stage.fire('scroll', {});
    const after = Axes.Na__LeAxes__GetCrossing();
    check('a pan by scroll under a still cursor: the crossing follows the paper point now under it', r3(after.x - before.x), r3(37.25 / scale()));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching Off and Detaching
// -----------------------------------------------------------------------------

    console.log('\n  Off, and detached');
    announced.length = 0;
    check('Toggle switches them off', Axes.Na__LeAxes__Toggle(), false);
    check('...hides them, remembers it, echoes it and announces it',
        [ layer.hidden, Axes.Na__LeAxes__GetCrossing(), storage.get('na-layouteditor-drawing-axes'), said.slice(-1)[0], announced.map((e) => e.detail.enabled) ],
        [ true, null, '0', '<Drawing axes off>', [ false ] ]);
    move(100, 100);
    check('off: a move shows nothing', layer.hidden, true);
    Axes.Na__LeAxes__Set(true);
    move(100, 100);
    check('Set(true) and a move: back', layer.hidden, false);
    const saidBefore = said.length;
    check('Set to the state it is already in changes nothing and says nothing', [ Axes.Na__LeAxes__Set(true), said.length - saidBefore ], [ true, 0 ]);
    Axes.Na__LeAxes__Detach();
    check('Detach hides them and lets go of every listener',
        [ layer.hidden, [ 'pointermove', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'na-le-zoom', 'na-le-zoom-settled', 'na-le-model-changed', 'resize' ].every((n) => (winListeners[n] || []).length === 0),
          (stage.listeners.scroll || []).length, (stage.listeners.pointerleave || []).length ],
        [ true, true, 0, 0 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Config's Switches
// -----------------------------------------------------------------------------

    console.log('\n  The config\'s switches (a second copy of the module)');
    servedConfig = JSON.parse(JSON.stringify(AXES_CONFIG));
    servedConfig.LayoutEditor__DrawingAxes__Behaviour.Behaviour__FollowSnapMarker = false;
    servedConfig.LayoutEditor__DrawingAxes__Behaviour.Behaviour__ShowForTouch     = true;
    servedConfig.LayoutEditor__DrawingAxes__Display.Display__LineWidthPx          = 9;
    servedConfig.LayoutEditor__DrawingAxes__Display.Display__HorizontalColour     = 'red; background: url(x)';
    const Axes2 = await load(LE + '33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__.js', surfaceStubs);
    await Axes2.Na__LeAxes__Ready();
    storage.set('na-layouteditor-drawing-axes', '1');
    check('a fresh page reads the remembered flag', Axes2.Na__LeAxes__IsOn(), true);
    paper.children.filter((c) => c.className === 'na-le-axes').forEach((c) => paper.removeChild(c));
    Axes2.Na__LeAxes__Attach();
    S.marker = { x : 120, y : 60 };
    move(121.3, 61.1);
    const d1 = Axes2.Na__LeAxes__GetCrossing();
    check('FollowSnapMarker false: the cursor, marker or not (AutoCAD\'s crosshair)', [ r3(d1.x), r3(d1.y), d1.snapped ], [ 121.3, 61.1, false ]);
    S.marker = null;
    move(100, 100, { type : 'touch' });
    const layer2 = paper.children.find((c) => c.className === 'na-le-axes');
    check('ShowForTouch true: a finger shows them', layer2.hidden, false);
    move(100, 100);
    check('LineWidthPx 9 is held to its 4 px limit', ink(layer2.children[0], 'y', 100).inkPx, 4);
    check('a colour that is not a colour is refused, the fallback kept', layer2.style.getPropertyValue('--na-le-axes-horizontal'), '#ff0000');
    Axes2.Na__LeAxes__Detach();
    servedConfig = AXES_CONFIG;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Keys
// -----------------------------------------------------------------------------

    console.log('\n  F9 (the real key map, SHEET_CHORDS and the sheet keyboard)');
    const KeyMap = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', { Na__LeCfg__PREFIX : 'LayoutEditor__' });
    const action = (key, mods) => (KeyMap.Na__LeCfg__MatchKeyBinding(key, mods || {}) || {}).action || null;
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED_KEY_MAP);
    check('the shipped key map: F9 is the Drawing Axes Overlay', action('F9'), 'View__AxesToggle');
    check('Ctrl+F9 and Shift+F9 are not (Exact)', [ action('F9', { Ctrl : true }), action('F9', { Shift : true }) ], [ null, null ]);
    check('F6, F7 and F8 are what they were', [ action('F6'), action('F7'), action('F8') ], [ 'View__GridToggle', 'Snap__GridToggle', 'Ortho__Toggle' ]);
    const catalogue = (SHIPPED_KEY_MAP.LayoutEditor__Actions__Config || {}).LayoutEditor__Actions__List || [];
    check('the actions catalogue names it', catalogue.filter((a) => a.Action === 'View__AxesToggle').map((a) => a.Group), [ 'Tools' ]);
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('the built-in fallback binds F9 too', action('F9'), 'View__AxesToggle');
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED_KEY_MAP);

    const ToolsState = await load(LE + '30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js', { Na__LeVec__TOOLS : [] });
    check('SHEET_CHORDS holds it: a focused select or checkbox cannot swallow F9', ToolsState.Na__LeTools__SHEET_CHORDS.indexOf('View__AxesToggle') !== -1, true);

    const kb = { toggles : 0 };
    defineLive('Na__LeTools__Tool',        () => 'select');
    defineLive('Na__LeTools__Editable',    () => true);
    defineLive('Na__LeTools__LastPointMm', () => null);
    defineLive('Na__LeTools__ShiftHeld',   () => false);
    defineLive('Na__LeTools__Drag',        () => null);
    const Keys = await load(LE + '30__System__SheetTools/Na__LayoutEditor__SheetTools__Keyboard__.js', {
        Na__LeCfg__GetKeyboardSetup  : KeyMap.Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchKeyBinding   : KeyMap.Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__GetLabel          : (k, f) => f,
        Na__LeModel__GetActiveSheet  : () => ({ Sheet__Id : 'Sheet_T' }),
        Na__LeTools__TOOL_SELECT     : ToolsState.Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_MOVE       : ToolsState.Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT       : ToolsState.Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION  : ToolsState.Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW       : ToolsState.Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT       : ToolsState.Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_LEADER     : ToolsState.Na__LeTools__TOOL_LEADER,
        Na__LeTools__TOOL_AREA       : ToolsState.Na__LeTools__TOOL_AREA,
        Na__LeTools__SHEET_CHORDS    : ToolsState.Na__LeTools__SHEET_CHORDS,
        Na__LeTools__NON_TEXT_INPUTS : ToolsState.Na__LeTools__NON_TEXT_INPUTS,
        Na__LeAxes__Toggle           : () => { kb.toggles++; return true; }
    }, [ 'Na__LeTools__Tool', 'Na__LeTools__Editable', 'Na__LeTools__LastPointMm', 'Na__LeTools__ShiftHeld', 'Na__LeTools__Drag' ]);
    const pressF9 = (o) => {
        const opts = o || {};
        const e = { key : 'F9', code : 'F9', target : opts.target || { tagName : 'DIV', isContentEditable : false },
                    ctrlKey : !!opts.ctrl, shiftKey : false, altKey : false, metaKey : false, repeat : !!opts.repeat,
                    prevented : false, preventDefault() { this.prevented = true; } };
        const before = kb.toggles;
        Keys.Na__LeTools__OnKey(e);
        return [ kb.toggles - before, e.prevented ];
    };
    check('F9 switches the axes once and takes the key from the browser', pressF9(), [ 1, true ]);
    check('a held F9 is taken but switches nothing more',                 pressF9({ repeat : true }), [ 0, true ]);
    check('F9 from a panel checkbox still reaches the sheet',             pressF9({ target : { tagName : 'INPUT', type : 'checkbox', isContentEditable : false } })[0], 1);
    check('F9 in a text box stays the text box\'s',                       pressF9({ target : { tagName : 'INPUT', type : 'text', isContentEditable : false } }), [ 0, false ]);
    check('Ctrl+F9 is not the binding',                                   pressF9({ ctrl : true }), [ 0, false ]);
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('the built-in fallback key map switches them on F9 too',        pressF9()[0], 1);

// endregion -------------------------------------------------------------------


console.log(failures ? '\n  ' + failures + ' check(s) FAILED.' : '\n  Every check passed.');
process.exit(failures ? 1 : 0);
