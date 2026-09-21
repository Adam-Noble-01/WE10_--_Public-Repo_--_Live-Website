// =============================================================================
// TRUEVISION3D - TEST - PAINTED ON THE POINT (PLACED BY A TRANSFORM, NEVER BY LEFT AND TOP)
// =============================================================================
//
// FILE       : Na__Test__PaintedOnThePoint__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Painted on the Point Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that the snap marker, the vertex grips, the rubber band and the viewport frames are carried to their place by a transform - whose middle or end lands on the paper point to the last digit at any zoom - and never by left and top, which the browser rounds before the paper's zoom multiplies the difference
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE FAULT THIS GUARDS. Everything on the paper sits inside the paper's
//   scale(zoom). A box's left and top are rounded to a whole DEVICE pixel
//   BEFORE that scale is applied, and the zoom multiplies what the rounding
//   threw away: up to half a pixel times the zoom, a different amount for
//   every box. Measured in headless Chrome on RB05's ground floor plan at 32x
//   on a 150% display, the snap marker was painted 8.8 device pixels to the
//   RIGHT of the corner it had found and the drawing 8.3 to the LEFT of it -
//   17 pixels apart (Adam, 21-Sep-2026: "they don't seem to align with the
//   actual vector points"). A translate goes through the zoom at full
//   precision: after, 0.1 to 0.2 of a pixel at 8x, 32x and 64x.
// - NO BROWSER HERE, so what is proved is the CONTRACT that measurement
//   depends on: nothing fractional is ever written to left or top, the origin
//   is the corner the translate is measured from - both written INLINE with
//   the transform, never left to a stylesheet, so a browser holding one file
//   beside an older copy of the other still agrees - and the transform, worked
//   through as the browser works it, puts the right part of the element on
//   the paper point at every zoom - the marker's and a grip's MIDDLE, the
//   band's two ENDS along the middle of its thickness, a frame's CORNER - at
//   its own size on screen.
// - The Marker is the shipped unit, joined with the State and Glyphs units it
//   reads (Na__TestEnv__ObjectSnapBundle__) and run against a stand-in
//   document. The grips' Place and PlaceBand are cut out of the shipped Grips
//   file by name and run the same way. The sheet surface and the two
//   stylesheets are read as text.
// - MUTATION CHECKED on copies in memory, the shipped files untouched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__PaintedOnThePoint__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the fix (Marker 1.1.0, Grips 1.11.0, SheetSurface 1.11.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import bundle from './Na__TestEnv__ObjectSnapBundle__.cjs';


// -----------------------------------------------------------------------------
// REGION | A Stand-In Document, and the Transform Worked Through as the Browser Works It
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';
    const GRIPS      = LE + '30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    const SURFACE    = LE + '10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    const PAPER_CSS  = LE + '10__Core__SheetSurface/Na__LayoutEditor__Styles__Main__Paper__.css';
    const OSNAP_CSS  = LE + '28__System__ObjectSnap/Na__LayoutEditor__Styles__ObjectSnap__.css';
    const SETTLED    = 'na-layouteditor-zoom-settled';
    let   Serial     = 0;

    // A WORLD | One handles layer, elements that remember what was written to them, and the listeners asked for
    function MakeWorld() {
        const listeners = [];
        const make = () => {
            const el = { style : {}, className : '', hidden : false, innerHTML : '', textContent : '', children : [], parentNode : null };
            el.appendChild = (child) => { if (child.parentNode) child.parentNode.removeChild(child); el.children.push(child); child.parentNode = el; return child; };
            el.removeChild = (child) => { el.children = el.children.filter((c) => c !== child); child.parentNode = null; return child; };
            return el;
        };
        const layer = make();
        const world = { zoom : 1, ppm : 3.2, layer : layer, listeners : listeners, fire : (type) => listeners.filter((l) => l.type === type).forEach((l) => l.fn({ type : type })) };
        globalThis.document = { createElement : make };
        globalThis.window   = { addEventListener : (type, fn) => listeners.push({ type : type, fn : fn }), localStorage : { getItem : () => null, setItem : () => {} } };
        globalThis.__W      = world;
        return world;
    }

    // A TRANSFORM, AS A MATRIX | [a, b, c, d, e, f] mapping (x, y) to (a x + c y + e, b x + d y + f), the functions
    // multiplied in the order they are written - which is how CSS composes them. boxW and boxH are what a
    // percentage is a percentage OF. Throws on a function it does not know, so nothing is quietly skipped.
    function Matrix(transform, boxW, boxH) {
        let m = [ 1, 0, 0, 1, 0, 0 ];
        const mul = (p, q) => [ p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5] ];
        const len = (text, of) => /%$/.test(text) ? (parseFloat(text) / 100) * of : parseFloat(text);
        const rule = /(\w+)\(([^)]*)\)/g;
        let found;
        while ((found = rule.exec(transform || ''))) {
            const args = found[2].split(',').map((t) => t.trim());
            if (found[1] === 'translate')       m = mul(m, [ 1, 0, 0, 1, len(args[0], boxW), len(args[1] === undefined ? '0' : args[1], boxH) ]);
            else if (found[1] === 'translateY') m = mul(m, [ 1, 0, 0, 1, 0, len(args[0], boxH) ]);
            else if (found[1] === 'scale')      m = mul(m, [ parseFloat(args[0]), 0, 0, parseFloat(args[args.length - 1]), 0, 0 ]);
            else if (found[1] === 'rotate')     { const t = parseFloat(args[0]) * Math.PI / 180; m = mul(m, [ Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0 ]); }
            else throw new Error('A transform function this test does not know: ' + found[1]);
        }
        return m;
    }
    const At    = (m, x, y) => [ m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5] ];
    const Near  = (got, want, tol) => Math.hypot(got[0] - want[0], got[1] - want[1]) <= (tol || 1e-9);
    const Px    = (text) => parseFloat(text);
    const AtCorner = (style) => (style.left === undefined || Px(style.left) === 0) && (style.top === undefined || Px(style.top) === 0);   // <-- Nothing FRACTIONAL ever written to left or top: unset (the stylesheet's 0) or 0 itself

    // THE MARKER | The shipped State, Glyphs and Marker units, with the surface and the config stood in for
    async function loadMarker(mutate) {
        const built = bundle.Na__TestEnv__ObjectSnapBundle(SRC, [ 'State', 'Glyphs', 'Marker' ]);
        let src = built.source;
        if (mutate) { const changed = mutate(src); if (changed === src) { console.error('FAIL: a mutation changed nothing'); process.exit(1); } src = changed; }
        const stubs = [
            'const Na__LeCfg__GetSnappingSetup = () => ({ markerSizePx : 18 });',
            "const Na__LeSurface__ZOOM_SETTLED_EVENT = '" + SETTLED + "';",
            'const Na__LeSurface__GetElements = () => ({ handles : globalThis.__W.layer });',
            'const Na__LeSurface__GetPixelsPerMm = () => globalThis.__W.ppm, Na__LeSurface__GetZoom = () => globalThis.__W.zoom;'
        ].join('\n');
        const tmp = join(tmpdir(), 'Na__Test__PaintedOnThePoint__Marker__' + (Serial++) + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src + '\nexport { ' + built.names.join(', ') + ' };', 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    // THE GRIPS | Named functions cut out of the shipped file, braces counted, and run with the surface stood in for
    function cut(text, name) {
        const start = text.indexOf('function ' + name + '(');
        if (start === -1) { console.error('FAIL: ' + name + ' is not in the Grips file'); process.exit(1); }
        let depth = 0, i = text.indexOf('{', start);
        for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (depth === 0) break; } }
        return text.slice(start, i + 1);
    }
    async function loadGrips(mutate) {
        const file = readFileSync(resolve(SRC, GRIPS), 'utf8').replace(/\r\n/g, '\n');
        let src = [ 'Na__LeGrips__Place', 'Na__LeGrips__PlaceBand', 'Na__LeGrips__OnZoomSettled', 'Na__LeGrips__ShowBand', 'Na__LeGrips__HideBand' ].map((name) => cut(file, name)).join('\n\n');
        if (mutate) { const changed = mutate(src); if (changed === src) { console.error('FAIL: a mutation changed nothing'); process.exit(1); } src = changed; }
        const stubs = [
            'let Na__LeGrips__Band = null, Na__LeGrips__BandAt = null;',
            "const Na__LeSurface__ZOOM_SETTLED_EVENT = '" + SETTLED + "';",
            'const Na__LeSurface__GetElements = () => ({ handles : globalThis.__W.layer });',
            'const Na__LeSurface__GetPixelsPerMm = () => globalThis.__W.ppm, Na__LeSurface__GetZoom = () => globalThis.__W.zoom;'
        ].join('\n');
        const tmp = join(tmpdir(), 'Na__Test__PaintedOnThePoint__Grips__' + (Serial++) + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src + '\nconst Na__Test__Band = () => Na__LeGrips__Band;\nexport { Na__LeGrips__Place, Na__LeGrips__ShowBand, Na__LeGrips__HideBand, Na__Test__Band };', 'utf8');
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

    console.log('TrueVision3D - painted on the point');

    // RB05's ground floor plan: the window corner the fault was measured on, in paper millimetres
    const CORNER = { x : 155.35956283949787, y : 132.07475616236093 };
    const ZOOMS  = [ 0.34, 1, 8, 32, 64 ];

    // THE SNAP MARKER
    // ------------------------------------
    async function RunMarker(mutate) {
        const world = MakeWorld();
        const M = await loadMarker(mutate);
        const want = [ CORNER.x * world.ppm, CORNER.y * world.ppm ];
        ZOOMS.forEach((zoom) => {
            world.zoom = zoom;
            M.Na__LeOsnap__ShowMarker({ x : CORNER.x, y : CORNER.y, kind : 'end', target : 'viewport' });
            const el = world.layer.children[0], size = Px(el.style.width);
            const m  = Matrix(el.style.transform, size, Px(el.style.height));
            check('marker at ' + zoom + 'x: at the layer\'s corner, its origin there, all written inline', [ el.style.left, el.style.top, el.style.transformOrigin ], [ '0px', '0px', '0 0' ]);
            check('  its MIDDLE is on the paper point', Near(At(m, size / 2, size / 2), want), true);
            check('  and it is its own size on screen (18 px)', Math.abs((Math.hypot(m[0], m[1]) * zoom * size) - 18) < 1e-9, true);
        });
        check('one marker element, however often it is shown', world.layer.children.length, 1);
        check('  and one zoom listener with it', world.listeners.filter((l) => l.type === SETTLED).length, 1);

        // A WHEEL ZOOM MOVES NO POINTER: nothing shows the marker again, so the settle must
        world.zoom = 32; M.Na__LeOsnap__ShowMarker({ x : CORNER.x, y : CORNER.y, kind : 'end', target : 'viewport' });
        const el = world.layer.children[0];
        world.zoom = 54; world.fire(SETTLED);
        let m = Matrix(el.style.transform, 18, 18);
        check('a zoom settling under the marker on show gives it its size again', Math.abs((Math.hypot(m[0], m[1]) * 54 * 18) - 18) < 1e-9, true);
        check('  still on the point', Near(At(m, 9, 9), want), true);
        check('  which it still answers for (the drawing axes cross there)', M.Na__LeOsnap__GetMarkerPoint(), { x : CORNER.x, y : CORNER.y });
        M.Na__LeOsnap__HideMarker();
        const before = el.style.transform;
        world.zoom = 8; world.fire(SETTLED);
        check('a hidden marker is left alone by a settling zoom', [ el.style.transform === before, M.Na__LeOsnap__GetMarkerPoint() ], [ true, null ]);
    }
    console.log('\n  The snap marker (the shipped State, Glyphs and Marker units)');
    await RunMarker(null);

    // THE GRIPS AND THE RUBBER BAND
    // ------------------------------------
    async function RunGrips(mutate) {
        const world = MakeWorld();
        const G = await loadGrips(mutate);
        const want = [ CORNER.x * world.ppm, CORNER.y * world.ppm ];
        ZOOMS.forEach((zoom) => {
            [ 0, 45 ].forEach((turn) => {
                const grip = document.createElement('div');
                grip.style.width = '9px'; grip.style.height = '9px';
                G.Na__LeGrips__Place(grip, want[0], want[1], zoom, turn);
                const m = Matrix(grip.style.transform, 9, 9);
                check('grip at ' + zoom + 'x' + (turn ? ', turned ' + turn + ' (the insert diamond)' : '') + ': at the layer\'s corner, its origin there', [ AtCorner(grip.style), grip.style.transformOrigin ], [ true, '0 0' ]);
                check('  its MIDDLE is on the vertex', Near(At(m, 4.5, 4.5), want), true);
                check('  and it is 9 px across on screen', Math.abs((Math.hypot(m[0], m[1]) * zoom * 9) - 9) < 1e-9, true);
            });
        });

        // THE BAND: from the corner to the next one along the wall (220 mm real, 2.2 mm of paper), and on a slant
        [ [ { x : CORNER.x + 2.2, y : CORNER.y }, 'level' ], [ [ CORNER.x - 1.7, CORNER.y + 0.9 ], 'on a slant, the end given as [x, y]' ] ].forEach((one) => {
            const to = Array.isArray(one[0]) ? { x : one[0][0], y : one[0][1] } : one[0];
            ZOOMS.forEach((zoom) => {
                world.zoom = zoom;
                G.Na__LeGrips__ShowBand(CORNER, one[0], null);
                const band = G.Na__Test__Band(), w = Px(band.style.width), T = 1;      // <-- T: its one-pixel dashed edge is all the thickness it has
                const m = Matrix(band.style.transform, w, T);
                check('band ' + one[1] + ' at ' + zoom + 'x: at the layer\'s corner', AtCorner(band.style), true);
                check('  the MIDDLE of its thickness starts on the first point', Near(At(m, 0, T / 2), want), true);
                check('  and ends on the point it runs to', Near(At(m, w, T / 2), [ to.x * world.ppm, to.y * world.ppm ], 1e-7), true);
                check('  one pixel thick on screen, whatever the zoom', Math.abs((Math.hypot(m[2], m[3]) * zoom * T) - T) < 1e-9, true);
            });
        });
        check('one band element, and one zoom listener with it', [ world.layer.children.length, world.listeners.filter((l) => l.type === SETTLED).length ], [ 1, 1 ]);
        world.zoom = 32; G.Na__LeGrips__ShowBand(CORNER, { x : CORNER.x + 2.2, y : CORNER.y }, 'x');
        const band = G.Na__Test__Band();
        world.zoom = 54; world.fire(SETTLED);
        const m = Matrix(band.style.transform, Px(band.style.width), 1);
        check('a zoom settling under the band on show lays it again: one pixel thick', Math.abs((Math.hypot(m[2], m[3]) * 54) - 1) < 1e-9, true);
        check('  between the same two points', [ Near(At(m, 0, 0.5), want), Near(At(m, Px(band.style.width), 0.5), [ (CORNER.x + 2.2) * world.ppm, CORNER.y * world.ppm ], 1e-7) ], [ true, true ]);
        G.Na__LeGrips__HideBand();
        const before = band.style.transform;
        world.zoom = 8; world.fire(SETTLED);
        check('a band taken away is left alone by a settling zoom', band.style.transform === before, true);
    }
    console.log('\n  The vertex grips and the rubber band (Place, PlaceBand and ShowBand, cut from the shipped Grips file)');
    await RunGrips(null);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Viewport Frames and the Stylesheets (read as text)
// -----------------------------------------------------------------------------

    function RunText(surface, paperCss, osnapCss) {
        const refresh = surface.slice(surface.indexOf('function Na__LeSurface__RefreshFrames('), surface.indexOf('function Na__LeSurface__SwapSvg(')).replace(/\/\/[^\n]*/g, '');
        check('RefreshFrames carries each frame to its place by a translate of its corner', /frame\.style\.transform\s*=\s*'translate\('\s*\+\s*\(rect\.X \* ppm\)\s*\+\s*'px, '\s*\+\s*\(rect\.Y \* ppm\)\s*\+\s*'px\)'/.test(refresh), true);
        check('  from the paper\'s corner: left 0 and top 0, written with it', [ /frame\.style\.left\s*=\s*'0px';/.test(refresh), /frame\.style\.top\s*=\s*'0px';/.test(refresh) ], [ true, true ]);
        check('  and nothing else is ever written to its left or top', (refresh.match(/frame\.style\.(left|top)\s*=/g) || []).length, 2);
        const rules = (css, selector) => {
            const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
            const hit  = bare.match(new RegExp('(?:^|\\})\\s*' + selector.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}'));
            return hit ? hit[1] : '';
        };
        const has = (body, property, value) => new RegExp('(?:^|;|\\s)' + property + '\\s*:\\s*' + value + '\\s*;').test(body);
        // NEITHER STYLESHEET PLACES A FRAME OR THE MARKER: the corner and the origin are written inline with the
        // transform that needs them, so a browser holding one file beside an older copy of the other still agrees.
        [ [ paperCss, '.na-le-frame', 'a viewport frame' ], [ osnapCss, '.na-le-osnap', 'the snap marker' ] ].forEach((one) => {
            const body = rules(one[0], one[1]);
            check('the stylesheet says nothing of where ' + one[2] + ' sits', [ /(?:^|;|\s)(left|top|transform|transform-origin)\s*:/.test(body), /position\s*:\s*absolute\s*;/.test(body) ], [ false, true ]);
        });
        check('the rubber band\'s origin is its own corner (the one thing its stylesheet does say)', has(rules(paperCss, '.na-le-rubber-band'), 'transform-origin', '0 0'), true);
    }
    console.log('\n  The viewport frames and the stylesheets');
    const SURFACE_TEXT = readFileSync(resolve(SRC, SURFACE), 'utf8').replace(/\r\n/g, '\n');
    const PAPER_TEXT   = readFileSync(resolve(SRC, PAPER_CSS), 'utf8');
    const OSNAP_TEXT   = readFileSync(resolve(SRC, OSNAP_CSS), 'utf8');
    RunText(SURFACE_TEXT, PAPER_TEXT, OSNAP_TEXT);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mutation Checks
// -----------------------------------------------------------------------------

    console.log('\n  Mutations');
    async function caught(name, run) {
        quiet = true; quietFailures = 0;
        await run();
        quiet = false;
        check('MUTATION caught: ' + name, quietFailures > 0, true);
    }
    const MARKER_PLACE = "Na__LeOsnap__Marker.style.transform = 'translate(' + (xMm * ppm) + 'px, ' + (yMm * ppm) + 'px) scale(' + (1 / zoom) + ') translate(-50%, -50%)';";
    await caught('the marker is placed by left and top again',
        () => RunMarker((src) => src.replace(MARKER_PLACE, "Na__LeOsnap__Marker.style.left = (xMm * ppm) + 'px'; Na__LeOsnap__Marker.style.top = (yMm * ppm) + 'px'; Na__LeOsnap__Marker.style.transform = 'translate(-50%, -50%) scale(' + (1 / zoom) + ')';")));
    await caught('the marker is scaled before it is carried (it lands at the point divided by the zoom)',
        () => RunMarker((src) => src.replace(MARKER_PLACE, "Na__LeOsnap__Marker.style.transform = 'scale(' + (1 / zoom) + ') translate(' + (xMm * ppm) + 'px, ' + (yMm * ppm) + 'px) translate(-50%, -50%)';")));
    await caught('the marker hangs from its corner, not its middle',
        () => RunMarker((src) => src.replace(MARKER_PLACE, "Na__LeOsnap__Marker.style.transform = 'translate(' + (xMm * ppm) + 'px, ' + (yMm * ppm) + 'px) scale(' + (1 / zoom) + ')';")));
    await caught('the marker never hears a zoom settle',
        () => RunMarker((src) => src.replace('window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeOsnap__OnZoomSettled);', '')));
    await caught('a settling zoom places a marker that is not on show',
        () => RunMarker((src) => src.replace('if (Na__LeOsnap__Marker && !Na__LeOsnap__Marker.hidden && Na__LeOsnap__MarkerAt) Na__LeOsnap__PlaceMarker(', "if (Na__LeOsnap__Marker) Na__LeOsnap__PlaceMarker((Na__LeOsnap__MarkerAt || { x : 0, y : 0 }).x, (Na__LeOsnap__MarkerAt || { x : 0, y : 0 }).y); if (false) Na__LeOsnap__PlaceMarker(")));
    await caught('a grip is placed by left and top again',
        () => RunGrips((src) => src.replace("grip.style.left            = '0px';", "grip.style.left            = xPx + 'px';").replace("'translate(' + xPx + 'px, ' + yPx + 'px) scale('", "'translate(0px, ' + yPx + 'px) scale('")));
    await caught('a grip is turned about its corner, not its middle',
        () => RunGrips((src) => src.replace(" + (turnDeg ? ' rotate(' + turnDeg + 'deg)' : '') + ' translate(-50%, -50%)';", " + ' translate(-50%, -50%)' + (turnDeg ? ' rotate(' + turnDeg + 'deg)' : '');")));
    await caught('the band is laid out in paper pixels again (its edge grows with the zoom)',
        () => RunGrips((src) => src.replace("band.style.width     = (len * ppm * zoom) + 'px';", "band.style.width     = (len * ppm) + 'px';").replace(" + 'deg) scale(' + (1 / zoom) + ') translateY(-50%)';", " + 'deg) translateY(-50%)';")));
    await caught('the band hangs to one side of its line',
        () => RunGrips((src) => src.replace(" + ') translateY(-50%)';", " + ')';")));
    await caught('the band never hears a zoom settle',
        () => RunGrips((src) => src.replace('window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeGrips__OnZoomSettled);', '')));
    await caught('a frame is placed by left and top again',
        () => RunText(SURFACE_TEXT.replace("frame.style.transform = 'translate(' + (rect.X * ppm) + 'px, ' + (rect.Y * ppm) + 'px)';", "frame.style.left = (rect.X * ppm) + 'px'; frame.style.top = (rect.Y * ppm) + 'px';"), PAPER_TEXT, OSNAP_TEXT));
    await caught('a frame\'s corner is left to the stylesheet',
        () => RunText(SURFACE_TEXT.replace("            frame.style.left      = '0px';\n", ''), PAPER_TEXT, OSNAP_TEXT));
    await caught('the marker\'s origin is left to the stylesheet',
        () => RunMarker((src) => src.replace("Na__LeOsnap__Marker.style.transformOrigin = '0 0';", '')));
    await caught('a stylesheet takes to placing the marker',
        () => RunText(SURFACE_TEXT, PAPER_TEXT, OSNAP_TEXT.replace(/(\.na-le-osnap \{)/, '$1 left : 0;')));
    await caught('the rubber band\'s stylesheet rule loses its origin',
        () => RunText(SURFACE_TEXT, PAPER_TEXT.replace(/(\.na-le-rubber-band \{[^}]*?)transform-origin\s*:\s*0 0;/, '$1'), OSNAP_TEXT));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log(failures === 0 ? '\nEvery check passed.' : '\n' + failures + ' check(s) FAILED.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
