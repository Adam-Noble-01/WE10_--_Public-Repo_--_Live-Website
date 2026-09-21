// =============================================================================
// TRUEVISION3D - TEST - OBJECT SNAP
// =============================================================================
//
// FILE       : Na__Test__ObjectSnap__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Layout Editor - Object Snap (28__System__ObjectSnap)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the running snap modes, what each hit says it belongs to, and the check that colours the grips - against the folder's real units
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE MATHS (the real Geometry unit, a leaf): where a perpendicular lands
//   and whether that is on the segment, the nearest point on a segment, where
//   two segments cross (touching counts, parallel never does), a polygon's
//   centre of area, and the grid walk - which must name the corner square a
//   line only clips, the case sampling along the line misses.
// - THE SWITCHES (the real State unit): the defaults (Nearest off), a mode
//   and a target switched and remembered in the browser, and a config's
//   defaults never overriding a choice the browser has made.
// - THE SEARCH (the real State, Geometry, Index, Sources and Search units,
//   joined by Na__TestEnv__ObjectSnapBundle__): every mode on a sheet with a
//   viewport's linework, vectors, text and a dimension - Endpoint, Midpoint,
//   Intersection (two lines of the drawing that share no endpoint; a vector
//   crossing the drawing), Perpendicular (only with a point to be square
//   FROM, only when the foot is on the line), Centre, and Nearest (off by
//   default, and last even when on). Every hit's target: viewport, shape,
//   text, dimension, paper. A switched-off mode and a switched-off target find
//   nothing. A vertex in motion leaves its own edges out. A circle from the
//   Vector Tools offers its centre and quadrant points, not its 48 vertices
//   (the real Curves leaf from 37__System__VectorTools).
// - THE CHECK THE GRIPS ARE COLOURED BY (OnLinework): 'point' on an end, a
//   middle or a crossing of the linework, 'line' anywhere else along it, null
//   off it, and null again once the viewport's layer is hidden.
// - THE GLYPHS (the real Glyphs unit): every kind has a marker, and every
//   mode the menu lists has a picture.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ObjectSnap__.test.mjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Object Snap folder (TrueVision3D v2.129.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import bundle from './Na__TestEnv__ObjectSnapBundle__.cjs';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough, and the Loader
// -----------------------------------------------------------------------------

    const store = new Map();
    globalThis.window = {
        localStorage : { getItem : (k) => (store.has(k) ? store.get(k) : null), setItem : (k, v) => store.set(k, String(v)), removeItem : (k) => store.delete(k) },
        addEventListener : () => {}, removeEventListener : () => {}, dispatchEvent : () => true
    };

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');

    async function loadObjectSnap(units, stubs, tag) {
        const built = bundle.Na__TestEnv__ObjectSnapBundle(SRC, units);
        const tmp   = join(tmpdir(), 'Na__Test__ObjectSnap__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + built.source + '\nexport { ' + built.names.join(', ') + ' };\n', 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    const r3  = (n) => Math.round(n * 1000) / 1000;
    const at  = (hit) => hit ? [ r3(hit.x), r3(hit.y), hit.kind, hit.target ] : null;

// endregion -------------------------------------------------------------------


console.log('TrueVision3D - object snap: the running modes, what a hit belongs to, and the grips\' check');


// -----------------------------------------------------------------------------
// REGION | The Maths
// -----------------------------------------------------------------------------

    console.log('\n  The maths (the real Geometry unit)');
    const Geo = await loadObjectSnap([ 'Geometry' ], '', 'Geometry');
    const foot = Geo.Na__LeOsnapGeo__Foot(0, 0, 10, 0, 4, 7);
    check('a perpendicular from (4, 7) lands on the line at (4, 0), four tenths of the way along', [ foot.x, foot.y, foot.t ], [ 4, 0, 0.4 ]);
    check('...and one from beyond the end lands on the LINE, off the SEGMENT (t above 1)', r3(Geo.Na__LeOsnapGeo__Foot(0, 0, 10, 0, 14, 3).t), 1.4);
    check('a segment with no length has no perpendicular', Geo.Na__LeOsnapGeo__Foot(3, 3, 3, 3, 9, 9), null);
    const near = Geo.Na__LeOsnapGeo__Nearest(0, 0, 10, 0, 14, 3);
    check('the nearest point on a segment is its end when the foot runs off it', [ near.x, near.y, near.distance ], [ 10, 0, 5 ]);
    const cross = Geo.Na__LeOsnapGeo__Cross(0, 0, 10, 10, 0, 10, 10, 0);
    check('two diagonals cross in the middle', [ cross.x, cross.y ], [ 5, 5 ]);
    check('a line that STOPS on another touches it, and that counts (a T junction)', at(Object.assign(Geo.Na__LeOsnapGeo__Cross(0, 0, 10, 0, 6, 0, 6, 8) || {}, { kind : 'x', target : 'x' })), [ 6, 0, 'x', 'x' ]);
    check('parallel lines never cross, overlapping or not', [ Geo.Na__LeOsnapGeo__Cross(0, 0, 10, 0, 0, 2, 10, 2), Geo.Na__LeOsnapGeo__Cross(0, 0, 10, 0, 5, 0, 15, 0) ], [ null, null ]);
    check('lines that would cross beyond their ends do not', Geo.Na__LeOsnapGeo__Cross(0, 0, 4, 4, 0, 10, 10, 0), null);
    check('a rectangle\'s centre of area is its middle', Geo.Na__LeOsnapGeo__Centroid([ [ 10, 10 ], [ 30, 10 ], [ 30, 20 ], [ 10, 20 ] ]), { x : 20, y : 15 });
    const ell = Geo.Na__LeOsnapGeo__Centroid([ [ 0, 0 ], [ 20, 0 ], [ 20, 10 ], [ 10, 10 ], [ 10, 20 ], [ 0, 20 ] ]);
    check('an L-shaped room balances off the middle of its box, inside the L', [ r3(ell.x), r3(ell.y) ], [ 8.333, 8.333 ]);
    check('three points in a line have no area: the middle of the points', Geo.Na__LeOsnapGeo__Centroid([ [ 0, 0 ], [ 10, 0 ], [ 20, 0 ] ]), { x : 10, y : 0 });
    const cells = (ax, ay, bx, by) => { const out = []; Geo.Na__LeOsnapGeo__CellsOfSegment(ax, ay, bx, by, 4, (c, r) => out.push(c + ':' + r)); return out.sort(); };
    check('a level line is filed under every square it runs through', cells(1, 1, 11, 1), [ '0:0', '1:0', '2:0' ]);
    check('a plumb one likewise', cells(5, 1, 5, 9), [ '1:0', '1:1', '1:2' ]);
    check('a line that only CLIPS the corner of a square is still filed under it (sampling along it misses this)', cells(3, 0.5, 4.5, 4.5).indexOf('0:1') !== -1 || cells(3, 0.5, 4.5, 4.5).indexOf('1:0') !== -1, true);
    check('a shallow diagonal names the squares it passes through and no others', cells(1, 1, 6.5, 2), [ '0:0', '1:0' ]);
    check('a steeper one: it climbs into the next row BEFORE it leaves the first column', cells(0.5, 0.5, 7, 7.5), [ '0:0', '0:1', '1:1' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Switches
// -----------------------------------------------------------------------------

    console.log('\n  The switches (the real State unit)');
    const State = await loadObjectSnap([ 'State' ], '', 'State');
    check('object snap starts on, as it always has', State.Na__LeOsnap__IsEnabled(), true);
    check('Endpoint, Midpoint, Intersection, Perpendicular and Centre start on; Nearest starts OFF', State.Na__LeOsnap__MODES.map((k) => State.Na__LeOsnap__IsModeOn(k)), [ true, true, true, true, true, false ]);
    check('every kind of object starts in reach', State.Na__LeOsnap__TARGETS.map((t) => State.Na__LeOsnap__IsTargetOn(t)), [ true, true, true, true, true ]);
    State.Na__LeOsnap__AssignMode('near', true);
    State.Na__LeOsnap__AssignTarget('text', false);
    check('a mode and a target switched are remembered in this browser', [ JSON.parse(store.get('na-layouteditor-osnap-modes')).near, JSON.parse(store.get('na-layouteditor-osnap-targets')).text ], [ true, false ]);
    State.Na__LeOsnap__AssignDefaults({ modes : { near : false, mid : false }, targets : { text : true } });
    check('a config\'s defaults never override what the browser has chosen - only what it has not', [ State.Na__LeOsnap__IsModeOn('near'), State.Na__LeOsnap__IsModeOn('mid'), State.Na__LeOsnap__IsTargetOn('text') ], [ true, false, false ]);
    check('a name that is not a mode is refused', State.Na__LeOsnap__AssignMode('grid', true), false);
    State.Na__LeOsnap__AssignEnabled(false);
    check('F3 keeps the storage key it has always had', store.get('na-layouteditor-osnap'), '0');
    store.clear();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Search
// -----------------------------------------------------------------------------

    console.log('\n  The search (the real State, Geometry, Index, Sources and Search units)');
    // The Vector Tools' curves leaf, as it ships: it has no imports, so it only needs an .mjs name for Node to take it as a module.
    const curvesTmp = join(tmpdir(), 'Na__Test__ObjectSnap__Curves__.mjs');
    writeFileSync(curvesTmp, readFileSync(resolve(SRC, '51__System__LayoutEditor/37__System__VectorTools/Na__LayoutEditor__VectorTools__Curves__.js'), 'utf8'), 'utf8');
    globalThis.__Curves = await import(pathToFileURL(curvesTmp).href + '?v=' + Math.random().toString(36).slice(2));
    // The viewport rotation leaf, as it ships (no imports either): the search reads a frame's box through it.
    const vpRotTmp = join(tmpdir(), 'Na__Test__ObjectSnap__ViewportRotation__.mjs');
    writeFileSync(vpRotTmp, readFileSync(resolve(SRC, '51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js'), 'utf8'), 'utf8');
    globalThis.__VpRot = await import(pathToFileURL(vpRotTmp).href + '?v=' + Math.random().toString(36).slice(2));
    const stubs = [
        'const T = globalThis.__T = { setup : { enabled : true, radiusPx : 3, endpoints : true, midpoints : true, hiddenLines : false, sheetObjects : true, sheetChrome : true, markerSizePx : 18 }, marker : null, chrome : [], source : null, gridOn : false };',
        'const Na__LeCfg__GetSnappingSetup = () => T.setup;',
        "const Na__LeModel__KIND_2D = '2d';",
        'const Na__LeModel__GetLayers = (sheet) => sheet.Sheet__Layers;',
        'const Na__LeModel__IsLayerVisible = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !l || l.Layer__Visible !== false; };',
        'const Na__LeModel__IsLayerSelectable = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !l || l.Layer__Selectable !== false; };',
        'const Na__LeSurface__GetPixelsPerMm = () => 1, Na__LeSurface__GetZoom = () => 1;',                 // <-- Radius 3 px at 1 px per mm: 3 mm of paper
        'const Na__LeSurface__GetSheet = () => T.sheet, Na__LeSurface__GetLayout = () => null, Na__LeSurface__GetSheetChrome = () => T.chrome;',
        'const Na__LeLayout__MarginRect = () => null;',
        'const Na__LeVp2d__GetSnapSource = (id) => (id === "Viewport_001" ? T.source : null);',
        'const Na__LeShapeGeo__Points = (s) => s.Shape__Points || [];',
        'const Na__LeMarkup__AnnotationCorners = (item) => item.Test__Corners;',                               // <-- The text\'s box, as the markup bridge would measure it
        "const Na__LeVecCurve__KIND_CIRCLE = 'circle', Na__LeVecCurve__Describe = (...a) => globalThis.__Curves.Na__LeVecCurve__Describe(...a);",   // <-- The Vector Tools' real leaf
        'const Na__LeGrid__IsSnapping = () => T.gridOn, Na__LeGrid__Nearest = (p) => ({ x : Math.round(p.x), y : Math.round(p.y) });',
        'const Na__LeVpRot__Bounds = (...a) => globalThis.__VpRot.Na__LeVpRot__Bounds(...a);',                // <-- The viewport rotation leaf itself
        'const Na__LeOsnap__ShowMarker = (hit) => { T.marker = hit; }, Na__LeOsnap__HideMarker = () => { T.marker = null; };'
    ].join('\n');
    const O = await loadObjectSnap([ 'State', 'Geometry', 'Index', 'Sources', 'Search' ], stubs, 'Search');
    const T = globalThis.__T;

    // THE SHEET. A viewport at (100, 100), 200 by 150, whose linework is a
    // wall (level, y 150, from x 120 to 280), a jamb crossing it WITHOUT a
    // shared endpoint (plumb, x 200, y 130 to 170) and a stub past the frame.
    // On the sheet: a construction line crossing the wall, a closed room, a
    // text box and a dimension.
    const layers = () => [ { Layer__Id : 'L_vec' }, { Layer__Id : 'L_text' }, { Layer__Id : 'L_dim' }, { Layer__Id : 'L_vp' } ];
    const sheet = {
        Sheet__Id : 'Sheet_001', Sheet__Layers : layers(),
        Sheet__Viewports   : [ { Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__LayerId : 'L_vp', Viewport__FrameMm : { X : 100, Y : 100, WidthMm : 200, HeightMm : 150 } } ],
        Sheet__Shapes      : [
            { Shape__Id : 'Line_A', Shape__LayerId : 'L_vec', Shape__Points : [ [ 240, 120 ], [ 260, 180 ] ] },                                   // <-- Crosses the wall at (250, 150)
            { Shape__Id : 'Room_1', Shape__LayerId : 'L_vec', Shape__Closed : true, Shape__Points : [ [ 20, 20 ], [ 60, 20 ], [ 60, 40 ], [ 20, 40 ] ] }
        ],
        Sheet__Annotations : [ { Annotation__Id : 'Text_1', Annotation__LayerId : 'L_text', Annotation__PosXMm : 20, Annotation__PosYMm : 70, Annotation__SizeMm : 3, Annotation__Text : 'KITCHEN',
                                 Test__Corners : [ [ 20, 66 ], [ 44, 66 ], [ 44, 72 ], [ 20, 72 ] ] } ],
        Sheet__Dimensions  : [ { Dimension__Id : 'Dim_1', Dimension__LayerId : 'L_dim', Dimension__StartXMm : 20, Dimension__StartYMm : 90, Dimension__EndXMm : 60, Dimension__EndYMm : 90 } ]
    };
    T.sheet  = sheet;
    T.source = { key : 'k1', window : { Frame : sheet.Sheet__Viewports[0].Viewport__FrameMm, ToPaper : (x, y) => ({ x : x, y : y }) },
                 classes : { visible : [ 120, 150, 280, 150,   200, 130, 200, 170,   290, 240, 340, 240 ], hidden : [ 120, 200, 160, 200 ] } };
    const find = (x, y, options, exclude) => at(O.Na__LeOsnap__Find(sheet, { x : x, y : y }, exclude || null, options || null));

    console.log('\n    Endpoint and Midpoint, and what each hit belongs to');
    check('the end of a wall line of the drawing: a square, the viewports\' purple', find(121, 151), [ 120, 150, 'end', 'viewport' ]);
    check('the corner of a vector: a square, the vectors\' blue', find(21, 21), [ 20, 20, 'end', 'shape' ]);
    check('the middle of a vector\'s edge: a triangle', find(40.5, 20.8), [ 40, 20, 'mid', 'shape' ]);
    check('the corner of a text box: the text\'s orange - text could not be snapped to before', find(43.2, 66.5), [ 44, 66, 'end', 'text' ]);
    check('...and the middle of its box: a centre', find(32.4, 69.3), [ 32, 69, 'cen', 'text' ]);
    check('a point a dimension measures: the dimensions\' red', find(60.5, 90.6), [ 60, 90, 'end', 'dimension' ]);
    T.chrome = [ { Kind : 'rect', X : 5, Y : 5, WidthMm : 400, HeightMm : 280, StrokeColour : '#000000', StrokeMm : 0.5 } ];
    check('a corner of the sheet\'s border: the paper\'s slate', find(5.6, 5.4), [ 5, 5, 'end', 'paper' ]);
    check('a line hidden by the frame offers nothing: its end is past the viewport\'s edge', find(339, 240.5), null);
    check('...but where the frame CUTS it is not an endpoint either', find(300.2, 240.4), null);
    check('hidden lines stay out of it until the config asks for them', find(121, 200.5), null);

    console.log('\n    Intersection');
    check('the wall and the jamb cross at (200, 150) and share no endpoint: a cross, purple', find(200.8, 150.6), [ 200, 150, 'int', 'viewport' ]);
    check('a construction line crossing the wall: neither search alone has both lines; the crossing is the sheet\'s blue', find(250.4, 150.5), [ 250, 150, 'int', 'shape' ]);
    check('where a crossing and an endpoint coincide, the endpoint\'s written-down coordinates win', (() => {
        sheet.Sheet__Shapes.push({ Shape__Id : 'Corner_B', Shape__LayerId : 'L_vec', Shape__Points : [ [ 499, 10 ], [ 499, 40 ] ] },
                                 { Shape__Id : 'Corner_C', Shape__LayerId : 'L_vec', Shape__Points : [ [ 470.3, 10 ], [ 499, 10 ] ] });
        const hit = O.Na__LeOsnap__Find(sheet, { x : 499.4, y : 10.3 }, null, null);
        sheet.Sheet__Shapes.splice(-2, 2);
        return [ hit.x, hit.y, hit.kind ];
    })(), [ 499, 10, 'end' ]);

    console.log('\n    The drawing outranks a vector\'s copy of it');
    sheet.Sheet__Shapes.push({ Shape__Id : 'Trace_1', Shape__LayerId : 'L_vec', Shape__Points : [ [ 120, 150 ], [ 120, 110 ] ] },          // <-- Its first vertex is EXACTLY on the wall's end
                             { Shape__Id : 'Trace_2', Shape__LayerId : 'L_vec', Shape__Points : [ [ 280.03, 150.02 ], [ 280, 110 ] ] },    // <-- ...this one a hair off the other end
                             { Shape__Id : 'Trace_3', Shape__LayerId : 'L_vec', Shape__Points : [ [ 200.9, 131 ], [ 230, 131 ] ] });       // <-- ...and this one nowhere near a point of the drawing
    check('a vector\'s vertex exactly on a corner of the drawing: the DRAWING\'s point is taken, and the marker is purple', find(120.3, 150.4), [ 120, 150, 'end', 'viewport' ]);
    check('...and one a hair off it (0.04 mm): still the drawing\'s corner, so the new point lands ON the wall, not on the copy', find(280.2, 150.3), [ 280, 150, 'end', 'viewport' ]);
    check('...but a vertex the drawing has no point near is the vector\'s own, and blue says so', find(201.2, 131.3), [ 200.9, 131, 'end', 'shape' ]);
    sheet.Sheet__Shapes.splice(-3, 3);

    console.log('\n    Perpendicular');
    check('with nothing to be square FROM there is no perpendicular: the first point of a line', find(170.4, 150.6), null);
    check('a line drawn from (170, 110) meets the wall square on at (170, 150): a boxed right angle', find(170.4, 150.6, { from : { x : 170, y : 110 } }), [ 170, 150, 'perp', 'viewport' ]);
    check('...from anywhere: the foot is under the point it is drawn from, not under the cursor', find(171.5, 151, { from : { x : 172, y : 110 } }), [ 172, 150, 'perp', 'viewport' ]);
    check('a foot that would land OFF the end of the wall is refused', find(281.5, 150.5, { from : { x : 283, y : 110 } }), [ 280, 150, 'end', 'viewport' ]);
    check('a vertex dragged between two neighbours may be square from EITHER of them', find(230.6, 150.4, { from : [ { x : 90, y : 90 }, { x : 231, y : 120 } ] }), [ 231, 150, 'perp', 'viewport' ]);
    check('square on to a VECTOR works the same: the room\'s top edge, from a point above it', find(33, 20.7, { from : [ 33.4, 5 ] }), [ 33.4, 20, 'perp', 'shape' ]);
    check('a corner beside the foot still wins: an endpoint outweighs a perpendicular', find(120.9, 150.3, { from : { x : 122, y : 110 } }), [ 120, 150, 'end', 'viewport' ]);

    console.log('\n    Centre, and the Vector Tools\' circles');
    check('the centre of area of a closed vector: a circle', find(40.6, 30.5), [ 40, 30, 'cen', 'shape' ]);
    const ring = globalThis.__Curves.Na__LeVecCurve__CirclePoints(400, 60, 20, 48, 0.3);
    sheet.Sheet__Shapes.push({ Shape__Id : 'Circle_1', Shape__LayerId : 'L_vec', Shape__Closed : true, Shape__Curve : { Curve__Kind : 'circle' }, Shape__Points : ring });
    check('a circle offers its centre', find(400.7, 60.4), [ 400, 60, 'cen', 'shape' ]);
    check('...and its four quadrant points, as endpoints', [ find(420.5, 60.3), find(400.4, 39.6) ], [ [ 420, 60, 'end', 'shape' ], [ 400, 40, 'end', 'shape' ] ]);
    check('...but NOT a vertex every few millimetres round it (48 of them here)', find(ring[5][0] + 0.2, ring[5][1] + 0.2), null);
    sheet.Sheet__Shapes[sheet.Sheet__Shapes.length - 1].Shape__Curve = null;
    check('without the curve hint the same points are an ordinary polygon, and every vertex snaps', find(ring[5][0] + 0.2, ring[5][1] + 0.2), [ r3(ring[5][0]), r3(ring[5][1]), 'end', 'shape' ]);
    sheet.Sheet__Shapes.pop();

    console.log('\n    Nearest');
    check('off by default: a cursor beside the wall, away from any point, finds nothing', find(150, 151.2), null);
    O.Na__LeOsnap__AssignMode('near', true);
    check('switched on: the closest point on the wall, an hourglass', find(150, 151.2), [ 150, 150, 'near', 'viewport' ]);
    check('...but only when no other mode has a point in reach: an endpoint beside it still wins', find(121.4, 150.2), [ 120, 150, 'end', 'viewport' ]);
    O.Na__LeOsnap__AssignMode('near', false);

    console.log('\n    Switching modes and targets');
    O.Na__LeOsnap__AssignMode('mid', false);
    check('Midpoint off: the middle of an edge finds nothing', find(40.5, 20.8), null);
    O.Na__LeOsnap__AssignMode('mid', true);
    O.Na__LeOsnap__AssignTarget('text', false);
    check('Text out of reach: its corner finds nothing, while the vector beside it still snaps', [ find(43.2, 66.5), find(21, 21) ], [ null, [ 20, 20, 'end', 'shape' ] ]);
    O.Na__LeOsnap__AssignTarget('text', true);
    O.Na__LeOsnap__AssignTarget('viewport', false);
    check('Viewport linework out of reach: the wall\'s end finds nothing, and there is nothing to carry the viewport by',
        [ find(121, 151), O.Na__LeOsnap__FindOnViewport(sheet, 'Viewport_001', { x : 121, y : 151 }) ], [ null, null ]);
    O.Na__LeOsnap__AssignTarget('viewport', true);
    check('a viewport is carried by a point of its OWN linework', at(O.Na__LeOsnap__FindOnViewport(sheet, 'Viewport_001', { x : 121, y : 151 })), [ 120, 150, 'end', 'viewport' ]);
    T.setup.endpoints = false;
    check('the config\'s Endpoints switch still rules the mode out altogether, as before there was a menu', find(21, 21), null);
    T.setup.endpoints = true;
    O.Na__LeOsnap__AssignEnabled(false);
    check('F3 off: nothing at all', [ find(121, 151), find(21, 21) ], [ null, null ]);
    O.Na__LeOsnap__AssignEnabled(true);

    console.log('\n    What is left out');
    check('a vertex in motion never snaps to itself, nor to the middles of the two edges it drags', [ find(20.4, 20.3, null, { kind : 'shape', id : 'Room_1', index : 0 }), find(40.3, 20.4, null, { kind : 'shape', id : 'Room_1', index : 0 }) ], [ null, null ]);
    check('...but the rest of its own vector is still there to close onto', find(60.4, 40.3, null, { kind : 'shape', id : 'Room_1', index : 0 }), [ 60, 40, 'end', 'shape' ]);
    check('a vector moved whole leaves all of itself out', find(20.4, 20.3, null, { kind : 'shape', id : 'Room_1' }), null);
    check('a carried viewport leaves its own linework out', find(121, 151, null, { kind : 'viewport', id : 'Viewport_001' }), null);
    check('a text item in a moved selection leaves itself out', find(43.2, 66.5, null, [ { kind : 'annotation', id : 'Text_1' } ]), null);

    console.log('\n    Snap, the marker and the grid');
    const snap = O.Na__LeOsnap__Snap(sheet, { x : 121, y : 151 }, null, null);
    check('Snap hands back the point, its kind and what it belongs to, and shows that marker', [ snap, T.marker.kind, T.marker.target ], [ { x : 120, y : 150, snapped : true, kind : 'end', target : 'viewport' }, 'end', 'viewport' ]);
    check('nothing in reach: the point is its own and the marker goes', [ O.Na__LeOsnap__Snap(sheet, { x : 350.3, y : 20.6 }, null, null), T.marker ], [ { x : 350.3, y : 20.6, snapped : false, kind : null, target : null }, null ]);
    T.gridOn = true;
    check('Grid Snap on: the grid answers where no object snap reaches, in the grid\'s own colour', O.Na__LeOsnap__Snap(sheet, { x : 350.3, y : 20.6 }, null, null), { x : 350, y : 21, snapped : true, kind : 'grid', target : 'grid' });
    check('...unless the caller keeps steps of its own ({ grid : false })', O.Na__LeOsnap__Snap(sheet, { x : 350.3, y : 20.6 }, null, { grid : false }).snapped, false);
    T.gridOn = false;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Check the Grips Are Coloured By
// -----------------------------------------------------------------------------

    console.log('\n  Is a vertex ON the drawing (OnLinework): green, a green ring, or blue');
    const on = (x, y) => O.Na__LeOsnap__OnLinework(sheet, { x : x, y : y });
    check('exactly on the end of the wall: a point (solid green)', on(120, 150), 'point');
    check('exactly on its middle: a point', on(200, 150), 'point');
    check('where the wall and the jamb cross, which is no endpoint of either: still a point', (() => { T.source = Object.assign({}, T.source, { key : 'k2', classes : { visible : [ 120, 150, 280, 150, 210, 130, 210, 170 ] } }); return on(210, 150); })(), 'point');
    check('somewhere along the wall, at no particular place: a line (a green ring)', on(163.7, 150), 'line');
    check('a fraction of a millimetre off the wall - it only LOOKS as if it is on it: free (blue)', on(163.7, 150.2), null);
    check('on a vector, but not on the drawing: free. The check is about the DRAWING', on(20, 20), null);
    check('F3 and the running modes do not come into it: it is a check, not a snap', (() => { O.Na__LeOsnap__AssignEnabled(false); const got = on(120, 150); O.Na__LeOsnap__AssignEnabled(true); return got; })(), 'point');
    sheet.Sheet__Layers.find((l) => l.Layer__Id === 'L_vp').Layer__Visible = false;
    check('a hidden viewport is not there to be on', on(120, 150), null);
    sheet.Sheet__Layers.find((l) => l.Layer__Id === 'L_vp').Layer__Visible = true;
    check('SegmentsInBox hands a trim or an extend the lines of the drawing a box touches, each once', O.Na__LeOsnap__SegmentsInBox(sheet, { X : 205, Y : 125, WidthMm : 10, HeightMm : 50 }).length / 4, 2);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Glyphs
// -----------------------------------------------------------------------------

    console.log('\n  The glyphs (the real Glyphs unit)');
    const Glyphs = await loadObjectSnap([ 'Glyphs' ], '', 'Glyphs');
    const kinds  = [ 'end', 'mid', 'int', 'perp', 'cen', 'near', 'grid', 'infer' ];
    check('every kind of snap has a marker of its own', new Set(kinds.map((k) => Glyphs.Na__LeOsnap__GlyphSvg(k))).size, kinds.length);
    check('every marker is drawn in currentColor over a white casing, so the stylesheet owns its colour',
        kinds.every((k) => { const svg = Glyphs.Na__LeOsnap__GlyphSvg(k); return svg.indexOf('stroke="currentColor"') !== -1 && svg.indexOf('stroke="#ffffff"') !== -1 && svg.indexOf('</svg>') !== -1; }), true);
    check('every mode the menu lists has a picture, and the grid and the inferred line (which it does not list) have none',
        [ State.Na__LeOsnap__MODES.every((k) => (Glyphs.Na__LeOsnap__IllustrationSvg(k) || '').indexOf('na-le-osnap-menu__lines') !== -1), Glyphs.Na__LeOsnap__IllustrationSvg('grid'), Glyphs.Na__LeOsnap__IllustrationSvg('infer') ], [ true, null, null ]);

// endregion -------------------------------------------------------------------


console.log(failures === 0 ? '\n  Every check passed.' : '\n  ' + failures + ' check(s) FAILED.');
process.exit(failures === 0 ? 0 : 1);
