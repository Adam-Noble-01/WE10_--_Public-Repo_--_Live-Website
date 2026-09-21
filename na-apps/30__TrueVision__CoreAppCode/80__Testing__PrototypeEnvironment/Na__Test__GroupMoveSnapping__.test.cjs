// Run with node --test 80__Testing__PrototypeEnvironment/Na__Test__GroupMoveSnapping__.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../02__Src__AppModules/51__System__LayoutEditor');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const tools = '30__System__SheetTools/Na__LayoutEditor__';
const { Na__TestEnv__ObjectSnapBundle } = require('./Na__TestEnv__ObjectSnapBundle__.cjs');   // <-- The Object Snap folder's units as one source, imports taken out

// Execute production functions with only the browser/rendering boundary stubbed.
function loadFunctions(ctx, file, names) {
    const text = source(file);
    for (const name of names) {
        const start = text.indexOf('    function ' + name + '(');
        assert.ok(start >= 0, name);
        const end = text.indexOf('\n    // ------------------------------------------------------------', start);
        vm.runInContext(text.slice(start, end), ctx);
    }
}

function fixture() {
    const shape = (id, points, layer = 'visible') => ({ Shape__Id: id, Shape__Points: points, Shape__LayerId: layer });
    const sheet = {
        Sheet__Shapes: [shape('a', [[0, 0], [10, 0]]), shape('b', [[0, 20], [10, 20]])],
        Sheet__Dimensions: [], Sheet__Annotations: [], Sheet__Viewports: [],
        Sheet__Groups: [
            { Group__Id: 'outer', Group__Members: [{ kind: 'shape', id: 'a' }, { kind: 'group', id: 'inner' }] },
            { Group__Id: 'inner', Group__Members: [{ kind: 'shape', id: 'b' }] }
        ]
    };
    const setup = { sheetObjects: true, endpoints: true, midpoints: true, radiusPx: 1 };
    let enabled = true, axis = null, marker = null;
    const sources = new Map();   // viewportId -> what Na__LeVp2d__GetSnapSource hands the real linework index
    const ctx = vm.createContext({
        Na__LeCfg__GetSnappingSetup: () => setup,
        // The real switches (the State unit) read this browser's remembered choice: F3 off is '0'.
        window: { localStorage: { getItem: key => (key === 'na-layouteditor-osnap' ? (enabled ? '1' : '0') : null), setItem() {} } },
        Na__LeSurface__GetSheet: () => null, Na__LeSurface__GetLayout: () => null, Na__LeSurface__GetSheetChrome: () => [],
        Na__LeLayout__MarginRect: () => null,
        Na__LeMarkup__AnnotationCorners: () => null,
        Na__LeVecCurve__KIND_CIRCLE: 'circle', Na__LeVecCurve__Describe: () => null,
        Na__LeVp2d__GetSnapSource: id => sources.get(id) || null,
        Na__LeGrid__IsSnapping: () => false, Na__LeGrid__Nearest: p => p,
        Na__LeSurface__GetPixelsPerMm: () => 1, Na__LeSurface__GetZoom: () => 1,
        Na__LeModel__IsLayerVisible: (_, layer) => layer !== 'hidden',
        Na__LeModel__IsLayerLocked: (_, layer) => layer === 'locked',
        Na__LeModel__IsLayerSelectable: (_, layer) => layer !== 'reference',   // A reference layer offers no snap points (Na__Test__LayerMenu__.test.mjs)
        Na__LeModel__GetLayers: () => [{ Layer__Id: 'visible' }],
        Na__LeModel__GetViewportById: (s, id) => s.Sheet__Viewports.find(v => v.Viewport__Id === id),
        Na__LeModel__GetGroupById: (s, id) => s.Sheet__Groups.find(g => g.Group__Id === id),
        Na__LeModel__GetLeaders: () => [],
        Na__LeModel__UpdateShape: (s, id, patch) => { if (patch.points) s.Sheet__Shapes.find(v => v.Shape__Id === id).Shape__Points = patch.points; return true; },
        Na__LeModel__UpdateViewport: (s, id, patch) => { Object.assign(s.Sheet__Viewports.find(v => v.Viewport__Id === id).Viewport__FrameMm, patch.rect); return true; },
        Na__LeShapeGeo__Points: s => s.Shape__Points,
        Na__LeShapeGeo__Translated: (points, dx, dy) => points.map(p => [p[0] + dx, p[1] + dy]),
        Na__LeModel__KIND_2D: '2d',
        Na__LeOsnap__ShowMarker: hit => { marker = hit; }, Na__LeOsnap__HideMarker: () => { marker = null; },
        Na__LeAxis__Get: () => axis,
        Na__LeAxis__Apply: (base, p) => axis === 'x' ? { x: p.x, y: base.y } : { x: base.x, y: p.y },
        Na__LeGrips__ShowBand() {}, Na__LeGrips__HideBand() {}, Na__LeSurface__Refresh() {}, Na__LeMeasure__Refresh() {},
        // Ortho mode (F8) off: it holds an axis exactly where Shift does.
        Na__LeOrtho__Resolve: shift => !!shift,
        // The drawing grid's Grid Snap (F7) off: a drag comes back as it went in, and a move no object snap
        // reaches hides the marker and keeps its delta - what these functions did before the grid existed.
        // Na__Test__DrawingGrid__.test.mjs proves the grid itself.
        Na__LeOsnap__GridDragDelta: (s, drag, dMm) => dMm,
        Na__LeOsnap__GridTranslation: (s, drag, delta) => { marker = null; return delta; }
    });
    // THE REAL SNAPPING, WHOLE: the switches, the maths, the linework index, the sheet's sources, the search and
    // the whole-object moves, from 28__System__ObjectSnap. Only the marker (it needs a document) and the grid
    // moves (stubbed above, Grid Snap off) are left out.
    vm.runInContext(Na__TestEnv__ObjectSnapBundle(path.resolve(__dirname, '../02__Src__AppModules'), ['State', 'Geometry', 'Index', 'Sources', 'Search', 'Moves']).source, ctx);
    loadFunctions(ctx, tools + 'SheetTools__PointerDrag__.js', ['Na__LeTools__IsMoveDrag', 'Na__LeTools__IsViewportMoveDrag', 'Na__LeTools__ApplyDrag']);
    loadFunctions(ctx, '15__Core__Markup/Na__LayoutEditor__Groups__.js', ['Na__LeGroup__Descendants', 'Na__LeGroup__Expand']);
    vm.runInContext(source(tools + 'SelectionSet__.js').replace(/\bimport\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '').replace(/\bexport\s*\{[^}]*\};?/g, ''), ctx);
    const capture = () => ({ kind: 'group', startMm: { x: 0, y: 0 }, group: ctx.Na__LeSelSet__Capture(sheet, ctx.Na__LeGroup__Expand(sheet, [{ kind: 'group', id: 'outer' }])) });
    const move = (drag, x, y, shift = false, exact = false) => ctx.Na__LeTools__ApplyDrag(sheet, drag, { x, y }, shift, exact);
    const viewport = (id, x, y) => {
        sheet.Sheet__Viewports.push({ Viewport__Id: id, Viewport__Kind: '2d', Viewport__LayerId: 'visible', Viewport__FrameMm: { X: 0, Y: 0, WidthMm: 500, HeightMm: 500 } });
        // One short line of linework ending on the point: the real index files its end from the painted segments.
        sources.set(id, { key: id, window: { Frame: { X: 0, Y: 0, WidthMm: 500, HeightMm: 500 }, ToPaper: (px, py) => ({ x: px, y: py }) }, classes: { visible: [x, y, x + 50, y + 50] } });
    };
    return { sheet, shape, ctx, capture, move, viewport, setAxis: v => { axis = v; }, disable: () => { enabled = false; }, marker: () => marker };
}

test('nested group snaps a descendant vertex to an external vector and moves every member equally', () => {
    const f = fixture();
    f.sheet.Sheet__Shapes.push(f.shape('target', [[30, 30], [40, 30]]));
    const drag = f.capture();
    f.move(drag, 19.6, 9.7);
    assert.equal(drag.appliedMm.x, 20); assert.equal(drag.appliedMm.y, 10);
    assert.equal(f.sheet.Sheet__Shapes[0].Shape__Points[0][0], 20);
    assert.equal(f.sheet.Sheet__Shapes[1].Shape__Points[1][1], 30);
    f.move(drag, 19.8, 9.9); // repeated previews stay measured from the original geometry
    assert.equal(f.sheet.Sheet__Shapes[0].Shape__Points[0][0], 20);
});

test('group snaps to a vector midpoint', () => {
    const f = fixture();
    f.sheet.Sheet__Shapes.push(f.shape('target', [[30, 25], [30, 35]]));
    const drag = f.capture(); f.move(drag, 19.7, 9.8);
    assert.equal(drag.appliedMm.x, 20); assert.equal(drag.appliedMm.y, 10);
    assert.equal(f.marker().kind, 'mid');
});

test('group snaps to viewport linework', () => {
    const f = fixture(); f.viewport('target', 30, 30);
    const drag = f.capture(); f.move(drag, 19.7, 9.8);
    assert.equal(drag.appliedMm.x, 20); assert.equal(drag.appliedMm.y, 10);
    assert.equal(f.marker().viewportId, 'target');
});

test('moving shapes, dimensions and viewports are excluded together; single-vertex exclusions still work', () => {
    const f = fixture(); f.viewport('moving', 30, 30);
    f.sheet.Sheet__Dimensions.push({ Dimension__Id: 'd', Dimension__StartXMm: 30, Dimension__StartYMm: 30, Dimension__EndXMm: 40, Dimension__EndYMm: 40 });
    assert.equal(f.ctx.Na__LeOsnap__Find(f.sheet, { x: 30, y: 30 }, [{ kind: 'viewport', id: 'moving' }, { kind: 'dimension', id: 'd' }]), null);
    const drag = f.capture(); f.move(drag, 0.4, 0.3);
    assert.equal(drag.appliedMm.x, 0.4); assert.equal(drag.appliedMm.y, 0.3);
    assert.equal(f.ctx.Na__LeOsnap__Find(f.sheet, { x: 0.4, y: 0.3 }, { kind: 'shape', id: 'a', index: 0 }), null);
    assert.equal(f.ctx.Na__LeOsnap__Find(f.sheet, { x: 10.4, y: 0.3 }, { kind: 'shape', id: 'a', index: 0 }).sourceId, 'a');
});

test('arrow and Shift constraints survive snapping; typed distances bypass it', () => {
    for (const axis of ['x', 'y', null]) {
        const f = fixture();
        f.sheet.Sheet__Shapes.push(f.shape('target', axis === 'y' ? [[0.2, 30]] : [[30, 0.2]]));
        f.setAxis(axis);
        const drag = f.capture(); f.move(drag, axis === 'y' ? 0.3 : 19.6, axis === 'y' ? 9.6 : 0.3, axis === null);
        assert.equal(drag.appliedMm.x, axis === 'y' ? 0 : 20);
        assert.equal(drag.appliedMm.y, axis === 'y' ? 10 : 0);
        f.move(drag, 19.6, 0, false, true);
        assert.equal(drag.appliedMm.x, 19.6);
    }
});

test('disabled snapping leaves movement free and locked members stay put', () => {
    const f = fixture(); f.sheet.Sheet__Shapes[1].Shape__LayerId = 'locked';
    f.sheet.Sheet__Shapes.push(f.shape('target', [[30, 0]]));
    f.disable(); const drag = f.capture(); f.move(drag, 19.7, 0);
    assert.equal(drag.appliedMm.x, 19.7);
    assert.equal(f.sheet.Sheet__Shapes[1].Shape__Points[0][0], 0);
    assert.equal(f.marker(), null);
});
