// =============================================================================
// TRUEVISION3D - TEST - THE DRAWING GRID AND THE TITLE BLOCK SNAP POINTS
// =============================================================================
//
// FILE       : Na__Test__DrawingGrid__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Drawing Grid Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the grid's arithmetic, that object snaps win over the grid, that the title block's points snap, that a move lands its grab point on the grid, and that F6 / F7 are bound
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE STATE. The real Na__LayoutEditor__DrawingGrid__State__ (a leaf, no
//   stubs): LayOut's settings and defaults, the limits, the nearest grid
//   point, the snap step, the browser overrides and Reset.
// - THE SNAP. The real Na__LayoutEditor__Snapping__ with its imports stubbed:
//   the grid is only ever the fallback, object snap wins inside its radius,
//   the grid works with Object Snap off, { grid : false } asks for objects
//   alone - and the sheet's own paper (border, title block, notes margin)
//   offers its corners, ends and midpoints.
// - THE MOVE. The real Na__LayoutEditor__SheetTools__GridDrag__ with its
//   imports stubbed: the point a drag is carried by (LayOut 2024's rule), the
//   grid step for the drags with no snap of their own, and the fallback that
//   keeps a held axis.
// - THE KEYS. The real key map module with the shipped JSON: F6 is Show Grid,
//   F7 Grid Snap, in the shipped map and in the built-in fallback.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DrawingGrid__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the drawing grid (SketchUp LayOut's grid, F6 / F7) and the
//   title block snap points.
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough, and the Loader
// -----------------------------------------------------------------------------

    const store = new Map();
    globalThis.window = {
        localStorage : { getItem : (k) => (store.has(k) ? store.get(k) : null), setItem : (k, v) => store.set(k, String(v)), removeItem : (k) => store.delete(k) },
        addEventListener : () => {}, removeEventListener : () => {}, dispatchEvent : () => true
    };
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';

    // CRLF files are read as LF first: the import pattern ends a line at ';'.
    async function load(relative, stubs, tag) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const had = /^\s*import\s/m.test(src);
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = join(tmpdir(), 'Na__Test__DrawingGrid__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    const r3 = (p) => p ? { x : Math.round(p.x * 1000) / 1000, y : Math.round(p.y * 1000) / 1000 } : p;

// endregion -------------------------------------------------------------------


console.log('TrueVision3D - the drawing grid and the title block snap points');


// -----------------------------------------------------------------------------
// REGION | The State
// -----------------------------------------------------------------------------

    console.log('\n  The grid\'s settings and arithmetic (the real state module)');
    const Grid = await load(LE + '27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js', '', 'State');
    globalThis.__Grid = Grid;
    const s0 = Grid.Na__LeGrid__Get();
    check('LayOut\'s settings, Adam\'s template: hidden, not snapping, points, 10 mm in 10, on top, not clipped',
        [ s0.Show, s0.Snap, s0.Type, s0.MajorSpacingMm, s0.MinorDivisions, s0.MajorColour, s0.MinorColour, s0.OnTop, s0.ClipToMargins ],
        [ false, false, 'points', 10, 10, '#969696', '#d6d5c9', true, false ]);
    check('the minor spacing and the snap step are 1 mm', [ s0.MinorSpacingMm, s0.SnapStepMm ], [ 1, 1 ]);
    check('the nearest grid point rounds each axis on its own', Grid.Na__LeGrid__Nearest({ x : 12.34, y : 7.6 }), { x : 12, y : 8 });
    check('a grid point far off is still the nearest (no radius)', Grid.Na__LeGrid__Nearest({ x : 250.49, y : -3.51 }), { x : 250, y : -4 });
    check('floating-point dust is cleaned (0.1 mm step x 3 is 0.3)', Grid.Na__LeGrid__Nearest({ x : 0.29, y : 0.31 }, 0.1), { x : 0.3, y : 0.3 });
    check('SnapPoint leaves the point alone while Grid Snap is off', Grid.Na__LeGrid__SnapPoint({ x : 1.4, y : 2.6 }), { x : 1.4, y : 2.6 });
    Grid.Na__LeGrid__Assign({ Snap : true });
    check('SnapPoint puts it on the grid while Grid Snap is on', Grid.Na__LeGrid__SnapPoint({ x : 1.4, y : 2.6 }), { x : 1, y : 3 });
    check('Show and Snap are separate switches (LayOut\'s pair)', [ Grid.Na__LeGrid__IsShowing(), Grid.Na__LeGrid__IsSnapping() ], [ false, true ]);
    Grid.Na__LeGrid__Assign({ MajorSpacingMm : 0, MinorDivisions : 'ten', MajorColour : 'blue' });
    const s1 = Grid.Na__LeGrid__Get();
    check('unusable values are dropped, not stored', [ s1.MajorSpacingMm, s1.MinorDivisions, s1.MajorColour ], [ 10, 10, '#969696' ]);
    Grid.Na__LeGrid__Assign({ MajorSpacingMm : 500, MinorDivisions : 3.6 });
    const s2 = Grid.Na__LeGrid__Get();
    check('a spacing out of range is held to it; subdivisions are whole', [ s2.MajorSpacingMm, s2.MinorDivisions ], [ 200, 4 ]);
    Grid.Na__LeGrid__Assign({ MajorSpacingMm : 10, MinorDivisions : 2, ShowMinor : false });
    check('Minor Grid unticked: points snap to the major spacing', Grid.Na__LeGrid__Get().SnapStepMm, 10);
    Grid.Na__LeGrid__Assign({ ShowMinor : true });
    check('Minor Grid ticked again: 10 in 2 snaps every 5 mm', [ Grid.Na__LeGrid__Get().SnapStepMm, Grid.Na__LeGrid__Nearest({ x : 7.4, y : 2.4 }) ], [ 5, { x : 5, y : 0 } ]);
    check('remembered in this browser', JSON.parse(store.get('na-layouteditor-drawing-grid')).MinorDivisions, 2);
    Grid.Na__LeGrid__Assign({ Show : true, MajorColour : '#112233' });
    Grid.Na__LeGrid__Reset();
    const s3 = Grid.Na__LeGrid__Get();
    check('Reset puts the settings back and keeps both switches as they were', [ s3.Show, s3.Snap, s3.MinorDivisions, s3.MajorColour ], [ true, true, 10, '#969696' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Snap
// -----------------------------------------------------------------------------

    console.log('\n  The snap: objects first, the grid everywhere else (the real snapping module)');
    const snapStubs = [
        'const G = globalThis.__Grid;',
        'const Na__LeGrid__IsSnapping = (...a) => G.Na__LeGrid__IsSnapping(...a), Na__LeGrid__Nearest = (...a) => G.Na__LeGrid__Nearest(...a);',
        'const S = globalThis.__Snap = { setup : { enabled : true, radiusPx : 10, endpoints : true, midpoints : true, hiddenLines : false, sheetObjects : true, sheetChrome : true, markerSizePx : 18 },',
        '    sheet : null, layout : null, chrome : null, margin : null, marker : null };',
        'const Na__LeCfg__GetSnappingSetup = () => S.setup;',
        "const Na__LeModel__KIND_2D = '2d', Na__LeModel__GetLayers = () => [], Na__LeModel__IsLayerVisible = () => true, Na__LeModel__IsLayerSelectable = () => true;",   // <-- No reference layers here: Na__Test__LayerMenu__ proves those
        'const Na__LeSurface__GetPixelsPerMm = () => 1, Na__LeSurface__GetZoom = () => 1;',
        'const Na__LeSurface__GetElements = () => ({ handles : null });',
        'const Na__LeSurface__GetSheet = () => S.sheet, Na__LeSurface__GetLayout = () => S.layout, Na__LeSurface__GetSheetChrome = () => S.chrome;',
        'const Na__LeLayout__MarginRect = () => S.margin;',
        'const Na__LeVp2d__GetSnapSource = () => null;',
        'const Na__LeShapeGeo__Points = (s) => s.Shape__Points;'
    ].join('\n');
    const Osnap = await load(LE + '30__System__SheetTools/Na__LayoutEditor__Snapping__.js', snapStubs, 'Snapping');
    const S = globalThis.__Snap;
    // Radius 10 px at 1 px per mm is 10 mm. A sheet with one vector: a line from (20.3, 30.7) to (60.3, 30.7).
    const sheet = { Sheet__Id : 'Sheet_001', Sheet__Shapes : [ { Shape__Id : 'Shape_1', Shape__Points : [ [ 20.3, 30.7 ], [ 60.3, 30.7 ] ], Shape__LayerId : 'Layer_V' } ],
                    Sheet__Dimensions : [], Sheet__Viewports : [] };
    S.sheet = sheet; S.layout = { Content : { X : 5, Y : 5, WidthMm : 584, HeightMm : 410 }, TitleBlock : { X : 5, Y : 399, WidthMm : 584, HeightMm : 16 } };
    Grid.Na__LeGrid__Assign({ Snap : false });
    window.localStorage.setItem('na-layouteditor-osnap', '1');
    check('Grid Snap off, nothing near: the point is its own', Osnap.Na__LeOsnap__Snap(sheet, { x : 100.4, y : 200.6 }), { x : 100.4, y : 200.6, snapped : false, kind : null });
    Grid.Na__LeGrid__Assign({ Snap : true });
    check('Grid Snap on, nothing near: the nearest grid point', Osnap.Na__LeOsnap__Snap(sheet, { x : 100.4, y : 200.6 }), { x : 100, y : 201, snapped : true, kind : 'grid' });
    check('Grid Snap on, a vector\'s end within reach: the END wins over the grid', Osnap.Na__LeOsnap__Snap(sheet, { x : 22, y : 31 }), { x : 20.3, y : 30.7, snapped : true, kind : 'end' });
    check('...and its midpoint', Osnap.Na__LeOsnap__Snap(sheet, { x : 40.1, y : 31.9 }), { x : 40.3, y : 30.7, snapped : true, kind : 'mid' });
    check('{ grid : false } asks for the objects alone', Osnap.Na__LeOsnap__Snap(sheet, { x : 100.4, y : 200.6 }, null, 'vertex', { grid : false }), { x : 100.4, y : 200.6, snapped : false, kind : null });
    Osnap.Na__LeOsnap__SetEnabled(false);
    check('Object Snap off (F3): the grid still snaps, and the vector\'s end no longer does', [ Osnap.Na__LeOsnap__Snap(sheet, { x : 100.4, y : 200.6 }).kind, r3(Osnap.Na__LeOsnap__Snap(sheet, { x : 22, y : 31 })) ], [ 'grid', { x : 22, y : 31 } ]);
    Osnap.Na__LeOsnap__SetEnabled(true);
    check('Find itself stays object-only', Osnap.Na__LeOsnap__Find(sheet, { x : 100.4, y : 200.6 }), null);

    console.log('\n  The sheet\'s own paper snaps: border, title block, notes margin');
    // THE CHROME, as the modern title block builds it on an A2: the border, the
    // strip, the logo divider, two cell dividers, the QR cell's divider; and a
    // text run and a QR symbol, which offer nothing.
    const chrome = [
        { Kind : 'rect', X : 5, Y : 5, WidthMm : 584, HeightMm : 410, StrokeColour : '#172b3a', StrokeMm : 0.5, FillColour : null },
        { Kind : 'rect', X : 5, Y : 399, WidthMm : 584, HeightMm : 16, StrokeColour : '#172b3a', StrokeMm : 0.25, FillColour : '#ffffff' },
        { Kind : 'line', X1 : 45, Y1 : 399, X2 : 45, Y2 : 415, StrokeColour : '#172b3a', StrokeMm : 0.25 },
        { Kind : 'line', X1 : 97.37, Y1 : 399, X2 : 97.37, Y2 : 415, StrokeColour : '#cccccc', StrokeMm : 0.25 },
        { Kind : 'line', X1 : 160.9, Y1 : 399, X2 : 160.9, Y2 : 415, StrokeColour : '#cccccc', StrokeMm : 0.25 },
        { Kind : 'line', X1 : 569, Y1 : 399, X2 : 569, Y2 : 415, StrokeColour : '#172b3a', StrokeMm : 0.25 },
        { Kind : 'text', X : 100, BaselineY : 405, Text : 'CLIENT' },
        { Kind : 'qr', X : 571, Y : 400, SizeMm : 14 },
        { Kind : 'rect', X : 300, Y : 300, WidthMm : 10, HeightMm : 10, StrokeColour : null, StrokeMm : 0, FillColour : '#ffffff' }
    ];
    S.chrome = chrome; S.margin = { X : 499, Y : 5, WidthMm : 90, HeightMm : 394 };
    const pts = Osnap.Na__LeOsnap__ChromePoints(sheet);
    const has = (x, y, kind) => { for (let k = 0; k + 2 < pts.length; k += 3) if (Math.abs(pts[k] - x) < 1e-9 && Math.abs(pts[k + 1] - y) < 1e-9 && pts[k + 2] === kind) return true; return false; };
    check('the border\'s four corners', [ has(5, 5, 0), has(589, 5, 0), has(589, 415, 0), has(5, 415, 0) ], [ true, true, true, true ]);
    check('the title block strip\'s top corners (Adam\'s lower circles)', [ has(5, 399, 0), has(589, 399, 0) ], [ true, true ]);
    check('the notes margin divider meets the border and the title block (his middle circles)', [ has(499, 5, 0), has(499, 399, 0), has(499, 202, 1) ], [ true, true, true ]);
    check('every cell divider\'s two ends and its middle', [ has(97.37, 399, 0), has(97.37, 415, 0), has(97.37, 407, 1), has(160.9, 399, 0) ], [ true, true, true, true ]);
    check('the middle of each side of the border', [ has(297, 5, 1), has(589, 210, 1) ], [ true, true ]);
    check('the strip\'s foot is the border\'s foot: one point, not two', (() => { let n = 0; for (let k = 0; k + 2 < pts.length; k += 3) if (pts[k] === 5 && pts[k + 1] === 415 && pts[k + 2] === 0) n++; return n; })(), 1);
    check('a fill-only rectangle, a text run and a QR symbol offer nothing', [ has(300, 300, 0), has(100, 405, 0), has(571, 400, 0) ], [ false, false, false ]);
    check('kept per chrome build: the same list, not worked out again', Osnap.Na__LeOsnap__ChromePoints(sheet) === pts, true);
    check('a line drawn from the title block\'s top-left corner starts exactly on it', Osnap.Na__LeOsnap__Snap(sheet, { x : 6.2, y : 398.1 }), { x : 5, y : 399, snapped : true, kind : 'end' });
    check('the notes margin\'s top end, over the grid point beside it', Osnap.Na__LeOsnap__Snap(sheet, { x : 500.2, y : 5.4 }), { x : 499, y : 5, snapped : true, kind : 'end' });
    check('an off-grid cell divider still snaps exactly (97.37 mm)', Osnap.Na__LeOsnap__Snap(sheet, { x : 97.9, y : 399.4 }), { x : 97.37, y : 399, snapped : true, kind : 'end' });
    S.setup.sheetChrome = false;
    check('SheetChrome false offers none of it', Osnap.Na__LeOsnap__Snap(sheet, { x : 97.9, y : 399.4 }).kind, 'grid');
    S.setup.sheetChrome = true;
    S.sheet = { Sheet__Id : 'Sheet_002' };
    check('only the sheet on screen has chrome to offer', Osnap.Na__LeOsnap__ChromePoints(sheet).length, 0);
    S.sheet = sheet;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Move
// -----------------------------------------------------------------------------

    console.log('\n  A move lands the point it was picked up from on the grid (the real grid drag unit)');
    globalThis.__Osnap = Osnap;
    const dragStubs = [
        'const G = globalThis.__Grid, O = globalThis.__Osnap, S = globalThis.__Snap;',
        'const Na__LeGrid__IsSnapping = (...a) => G.Na__LeGrid__IsSnapping(...a), Na__LeGrid__Nearest = (...a) => G.Na__LeGrid__Nearest(...a);',
        'const Na__LeCfg__GetSnappingSetup = () => S.setup;',
        'const Na__LeModel__GetViewportById = () => null;',
        'const Na__LeSurface__GetPixelsPerMm = () => 1, Na__LeSurface__GetZoom = () => 1;',
        'const Na__LeShapeGeo__Points = (s) => s.Shape__Points;',
        "const Na__LeOsnap__KIND_GRID = 'grid';",
        'const Na__LeOsnap__IsEnabled = () => O.Na__LeOsnap__IsEnabled();',
        'const Na__LeOsnap__ShowMarker = (hit) => { S.marker = hit; }, Na__LeOsnap__HideMarker = () => { S.marker = null; };',
        'const Na__LeAxis__Get = () => S.axis || null;'
    ].join('\n');
    const Drag = await load(LE + '30__System__SheetTools/Na__LayoutEditor__SheetTools__GridDrag__.js', dragStubs, 'GridDrag');
    const text = (press) => ({ kind : 'annotation', id : 'Annotation_1', start : { x : 40.3, y : 50.7 }, startMm : press });
    check('text pressed near its anchor is carried by the anchor', Drag.Na__LeTools__GridGrabPoint(sheet, text({ x : 42, y : 52 })), { x : 40.3, y : 50.7 });
    check('...pressed away from it, by the point pressed', Drag.Na__LeTools__GridGrabPoint(sheet, text({ x : 70.2, y : 50.1 })), { x : 70.2, y : 50.1 });
    check('the anchor lands on the grid: a 5.4 mm drag right becomes 5.7', r3(Drag.Na__LeTools__GridDragDelta(sheet, text({ x : 42, y : 52 }), { x : 5.4, y : 0.1 })), { x : 5.7, y : 0.3 });
    Osnap.Na__LeOsnap__SetEnabled(false);
    check('Object Snap off: no inference, the point pressed is carried', Drag.Na__LeTools__GridGrabPoint(sheet, text({ x : 42, y : 52 })), { x : 42, y : 52 });
    Osnap.Na__LeOsnap__SetEnabled(true);
    const rect = { kind : 'shape', id : 'Shape_R', mode : 'whole', start : [ [ 10, 10 ], [ 30, 10 ], [ 30, 20 ], [ 10, 20 ] ], startMm : { x : 19.6, y : 10.4 } };
    sheet.Sheet__Shapes.push({ Shape__Id : 'Shape_R', Shape__Points : rect.start, Shape__Closed : true, Shape__FillColour : '#ff0000' });
    check('a vector pressed near an edge midpoint is carried by the midpoint', Drag.Na__LeTools__GridGrabPoint(sheet, rect), { x : 20, y : 10 });
    const filled = { kind : 'shape', id : 'Shape_R', mode : 'whole', start : rect.start, startMm : { x : 20.5, y : 15.4 } };
    check('a FILLED vector pressed near its middle is carried by its centre', Drag.Na__LeTools__GridGrabPoint(sheet, filled), { x : 20, y : 15 });
    check('a whole vector drag is left to its own snap unless an arrow holds it', Drag.Na__LeTools__GridDragDelta(sheet, rect, { x : 1.3, y : 0.2 }), { x : 1.3, y : 0.2 });
    S.axis = 'x';
    const locked = { kind : 'shape', id : 'Shape_R', mode : 'whole', start : rect.start, startMm : { x : 10.2, y : 10.1 } };
    check('...held by an arrow key, it steps the grid instead (the corner lands on it)', r3(Drag.Na__LeTools__GridDragDelta(sheet, locked, { x : 3.4, y : 0 })), { x : 3, y : 0 });
    S.axis = null;
    check('a vertex, a tip and a dimension end snap elsewhere: untouched here',
        [ Drag.Na__LeTools__GridDragDelta(sheet, { kind : 'shape', mode : 'vertex', startMm : { x : 0, y : 0 } }, { x : 1.3, y : 0 }),
          Drag.Na__LeTools__GridDragDelta(sheet, { kind : 'leader', mode : 'tip', startMm : { x : 0, y : 0 } }, { x : 1.3, y : 0 }),
          Drag.Na__LeTools__GridDragDelta(sheet, { kind : 'dimension', mode : 'end', startMm : { x : 0, y : 0 } }, { x : 1.3, y : 0 }) ],
        [ { x : 1.3, y : 0 }, { x : 1.3, y : 0 }, { x : 1.3, y : 0 } ]);
    const handle = { kind : 'viewport', id : 'Viewport_1', hit : { mode : 'handle', key : 'r' }, start : { rect : { X : 20.4, Y : 30, WidthMm : 100.3, HeightMm : 50 } }, startMm : { x : 121, y : 55 } };
    check('a crop handle is carried by itself: the right edge lands on 125 mm', r3(Drag.Na__LeTools__GridDragDelta(sheet, handle, { x : 4.5, y : 0.2 })), { x : 4.3, y : 0 });
    const plain = { kind : 'viewport', id : 'Viewport_1', hit : { mode : 'border' }, start : { rect : { X : 20.4, Y : 30.3, WidthMm : 100, HeightMm : 50 } }, startMm : { x : 21, y : 31 } };
    check('a frame moved plain is carried by its corner when pressed near it', r3(Drag.Na__LeTools__GridDragDelta(sheet, plain, { x : 10, y : 10 })), { x : 9.6, y : 9.7 });
    const carried = { kind : 'viewport', id : 'Viewport_1', hit : { mode : 'border' }, baseMm : { x : 1, y : 1 }, start : { rect : { X : 0, Y : 0, WidthMm : 10, HeightMm : 10 } }, startMm : { x : 1, y : 1 } };
    check('a frame carried by a point of its linework is left to its own solver', Drag.Na__LeTools__GridDragDelta(sheet, carried, { x : 1.3, y : 0 }), { x : 1.3, y : 0 });
    // An off-grid set: its corner (10.3, 10.3) is the point it is picked up by,
    // 4.4 mm to the right puts it at 14.7, and the grid takes it on to 15 - the
    // move is 4.7, and the axis it is held to (x) keeps its y exactly.
    const offGrid = [ [ 10.3, 10.3 ], [ 30.3, 10.3 ], [ 30.3, 20.3 ], [ 10.3, 20.3 ] ];
    const group = { kind : 'group', startMm : { x : 11, y : 9.5 }, group : [ { kind : 'shape', id : 'Shape_R', start : { points : offGrid } } ] };
    check('a set with no object snap in reach: its corner lands on the grid, the held axis kept',
        [ r3(Drag.Na__LeTools__GridTranslation(sheet, group, { x : 4.4, y : 0 }, 'x')), r3(S.marker) ], [ { x : 4.7, y : 0 }, { x : 15, y : 10.3 } ]);
    const loose = { kind : 'group', startMm : { x : 50.4, y : 50.6 }, group : [ { kind : 'shape', id : 'Shape_R', start : { points : offGrid } } ] };
    check('...pressed far from any of its points, by the point pressed', r3(Drag.Na__LeTools__GridTranslation(sheet, loose, { x : 4.4, y : 2.2 }, null)), { x : 4.6, y : 2.4 });
    Grid.Na__LeGrid__Assign({ Snap : false });
    check('with Grid Snap off every move is exactly as it was', [ Drag.Na__LeTools__GridDragDelta(sheet, text({ x : 42, y : 52 }), { x : 5.4, y : 0.1 }), Drag.Na__LeTools__GridTranslation(sheet, group, { x : 4.4, y : 0 }, 'x') ],
        [ { x : 5.4, y : 0.1 }, { x : 4.4, y : 0 } ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Keys
// -----------------------------------------------------------------------------

    console.log('\n  F6 and F7 (the real key map module and the shipped JSON)');
    const KeyMap = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', "const Na__LeCfg__PREFIX = 'LayoutEditor__';", 'KeyMap');
    const SHIPPED = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__Hotkeys__DrawingTabs__.json'), 'utf8'));
    const action = (key, mods) => (KeyMap.Na__LeCfg__MatchKeyBinding(key, mods || {}) || {}).action || null;
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED);
    check('the shipped key map: F6 is Show Grid, F7 is Grid Snap (Adam\'s LayOut keys)', [ action('F6'), action('F7') ], [ 'View__GridToggle', 'Snap__GridToggle' ]);
    check('with Ctrl held they are not the binding (Exact)', [ action('F6', { Ctrl : true }), action('F7', { Ctrl : true }) ], [ null, null ]);
    check('F3 is still object snap', action('F3'), 'Snap__Toggle');
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('the built-in fallback binds them too', [ action('F6'), action('F7') ], [ 'View__GridToggle', 'Snap__GridToggle' ]);

// endregion -------------------------------------------------------------------


console.log(failures ? '\n  ' + failures + ' check(s) FAILED.' : '\n  Every check passed.');
process.exit(failures ? 1 : 0);
