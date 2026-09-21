// =============================================================================
// TRUEVISION3D - TEST - HOW FAR THE SHEET ZOOMS IN, FOR AN AUTHOR AND FOR A READER
// =============================================================================
//
// FILE       : Na__Test__AuthoringZoomMax__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Authoring Zoom Ceiling Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a session that may author zooms in to AuthoringZoomMax, and a reader stops at ZoomMax
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE CONFIG. The real config readers load the SHIPPED
//   Na__LayoutEditor__AppConfig__.json, and the real editor setup unit
//   answers the navigation block from it: ZoomMax 8 for a reader,
//   AuthoringZoomMax 64 for an author. An author's ceiling is 64 when the key
//   is missing, never below the reader's, and whatever the config says above
//   that.
// - THE CLAMP. The real navigation module is loaded with its imports swapped
//   for stubs - the authoring gate a switch, the sheet surface a recorder -
//   and nothing else touched. With the gate open a zoom passes 8 and stops
//   at 64; with it shut it stops at 8, and a wheel step turned against that
//   limit settles nothing. A setup with no authoring ceiling (a navigation
//   module newer than the config unit it runs beside) falls back to the
//   reader's ceiling rather than losing the ceiling altogether. The floor is
//   the same for both.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__AuthoringZoomMax__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the authoring zoom ceiling (TrueVision3D v2.135.0).
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
    const CONFIG     = resolve(SRC, '51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__AppConfig__.json');

    // CRLF files are read as LF first: the import pattern ends a line at ';'.
    async function load(relative, stubs, tag) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const had = /^\s*import\s/m.test(src);
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = join(tmpdir(), 'Na__Test__AuthoringZoomMax__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    // The readers fetch their JSON beside themselves; the copy is not beside
    // it, so the one fetch they make is answered with the shipped file.
    globalThis.fetch = async () => ({ ok : true, status : 200, json : async () => JSON.parse(readFileSync(CONFIG, 'utf8')) });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Real Config Units and the Real Navigation Module
// -----------------------------------------------------------------------------

    const Readers = await load('51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__ConfigState__Readers__.js', '', 'Readers');
    if (!(await Readers.Na__LeCfg__Fetch())) { console.error('FAIL: the shipped config did not load'); process.exit(1); }
    globalThis.__Readers = Readers;

    const Setup = await load('51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__ConfigState__EditorSetup__.js', [
        'const Na__LeCfg__Val = (...a) => globalThis.__Readers.Na__LeCfg__Val(...a);',
        'const Na__LeCfg__Num = (...a) => globalThis.__Readers.Na__LeCfg__Num(...a);'
    ].join('\n'), 'EditorSetup');

    // THE SHEET SURFACE, AS LITTLE OF IT AS NAVIGATION READS. The paper sits
    // at the stage's top left; ZoomAbout only needs rectangles and offsets.
    const S = {
        zoom     : 1,
        gestures : 0,
        setup    : () => Setup.Na__LeCfg__GetNavigationSetup(),
        gate     : true,
        layout   : { Page : { WidthMm : 594, HeightMm : 420 } },
        els      : {
            stage  : { getBoundingClientRect : () => ({ left : 0, top : 0, width : 800, height : 600 }), clientWidth : 800, clientHeight : 600, scrollLeft : 0, scrollTop : 0 },
            paper  : { getBoundingClientRect : () => ({ left : 0, top : 0 }) },
            scaler : { offsetLeft : 0, offsetTop : 0, offsetWidth : 0, offsetHeight : 0 }
        }
    };
    globalThis.__S = S;

    const Nav = await load('51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js', [
        'const S = globalThis.__S;',
        'const Na__LeCfg__GetNavigationSetup = () => S.setup();',
        'const Na__DevGate__IsAuthoringEnabled = () => S.gate;',
        'const Na__LeSurface__SetZoom = (z) => { if (Number.isFinite(z) && z > 0) S.zoom = z; return S.zoom; };',
        'const Na__LeSurface__GetZoom = () => S.zoom;',
        'const Na__LeSurface__GetPixelsPerMm = () => 3.2;',
        'const Na__LeSurface__GetLayout = () => S.layout;',
        'const Na__LeSurface__GetElements = () => S.els;',
        'const Na__LeSurface__NoteZoomGesture = () => { S.gestures++; };'
    ].join('\n'), 'Navigation');

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

    // Zoom from a given level, as a single zoom (ZoomTo) or a wheel step (ZoomAbout, gesture true)
    const zoomTo    = (from, to) => { S.zoom = from; Nav.Na__LeNav__ZoomTo(to); return S.zoom; };
    const wheelStep = (from, to) => { S.zoom = from; S.gestures = 0; Nav.Na__LeNav__ZoomAbout(to, 400, 300, true); return { zoom : S.zoom, gestures : S.gestures }; };

    // THE CONFIG
    // ------------------------------------------------------------
    console.log('\n  The navigation block, read from the shipped config');
    const nav   = Readers.Na__LeCfg__Config.LayoutEditor__Navigation__Config;
    const kept  = nav.LayoutEditor__Navigation__AuthoringZoomMax;
    const both  = () => { const s = Setup.Na__LeCfg__GetNavigationSetup(); return { zoomMax : s.zoomMax, authoringZoomMax : s.authoringZoomMax }; };
    check('Shipped: a reader stops at 8, an author at 64',            both(), { zoomMax : 8, authoringZoomMax : 64 });
    delete nav.LayoutEditor__Navigation__AuthoringZoomMax;
    check('No AuthoringZoomMax in the config: an author still gets 64', both(), { zoomMax : 8, authoringZoomMax : 64 });
    nav.LayoutEditor__Navigation__AuthoringZoomMax = 4;
    check('An author is never held closer than a reader',             both(), { zoomMax : 8, authoringZoomMax : 8 });
    nav.LayoutEditor__Navigation__AuthoringZoomMax = 128;
    check('A higher AuthoringZoomMax is honoured as written',         both(), { zoomMax : 8, authoringZoomMax : 128 });
    nav.LayoutEditor__Navigation__AuthoringZoomMax = kept;

    // AN AUTHOR (localhost, or a device unlocked for authoring)
    // ------------------------------------------------------------
    console.log('\n  A session that may author');
    S.gate = true;
    check('Zoom to 100x stops at 64x',                                zoomTo(1, 100), 64);
    check('A wheel step from 8x goes on past it',                     wheelStep(8, 9.4), { zoom : 9.4, gestures : 1 });
    check('A wheel step at 64x settles nothing',                      wheelStep(64, 75), { zoom : 64, gestures : 0 });
    check('The floor is unchanged',                                   zoomTo(1, 0.01), 0.15);

    // A READER (the web document viewer, or any read-only session)
    // ------------------------------------------------------------
    console.log('\n  A reader');
    S.gate = false;
    check('Zoom to 100x stops at 8x, as it always has',               zoomTo(1, 100), 8);
    check('A wheel step at 8x settles nothing',                       wheelStep(8, 9.4), { zoom : 8, gestures : 0 });
    check('The floor is unchanged',                                   zoomTo(1, 0.01), 0.15);

    // A HALF-UPDATED BUILD
    // ------------------------------------------------------------
    console.log('\n  A setup with no authoring ceiling (a config unit older than the navigation module)');
    S.gate  = true;
    S.setup = () => { const s = Setup.Na__LeCfg__GetNavigationSetup(); delete s.authoringZoomMax; return s; };
    check('An author falls back to the reader\'s 8x, never to no ceiling', zoomTo(1, 100), 8);
    S.setup = () => Setup.Na__LeCfg__GetNavigationSetup();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    if (failures) { console.log('  ' + failures + ' check(s) FAILED'); process.exit(1); }
    console.log('  Every check passed.');
    process.exit(0);

// endregion -------------------------------------------------------------------
