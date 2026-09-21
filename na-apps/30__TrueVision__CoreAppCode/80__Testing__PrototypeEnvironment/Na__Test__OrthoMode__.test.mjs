// =============================================================================
// TRUEVISION3D - TEST - ORTHO MODE (F8)
// =============================================================================
//
// FILE       : Na__Test__OrthoMode__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Ortho Mode Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove AutoCAD's Ortho on F8: the Ortho XOR Shift rule, and that the Draw tool, the Dimension tool, every drag and the keyboard obey it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE RULE. The leaf (Na__LayoutEditor__OrthoMode__State__) is loaded as
//   shipped: Resolve must answer AutoCAD's truth table, Shift override on and
//   off, and the flag must come back from the browser's storage.
// - THE SWITCH. The controller is loaded over the SAME leaf instance, with the
//   real config JSON: Toggle must remember, announce and echo "<Ortho on>" /
//   "<Ortho off>" exactly once per real change.
// - THE DRAW TOOL, THE DIMENSION TOOL AND THE DRAG (ApplyDrag) are loaded with
//   the real axis lock and the real leaf, everything else stubbed: with Ortho
//   off each must do exactly what it did before; with it on each point must be
//   held the way a held Shift held it; with Shift held as well each must be
//   free again; an arrow lock must still win; a snap must supply only the
//   coordinate along the held axis; a typed length must be exact; and the two
//   places Shift means something else (a viewport handle, the rotate grip)
//   must still hear the raw key.
// - THE KEYBOARD. The real key map module with the SHIPPED JSON, and the real
//   sheet tools state: F8 must switch Ortho once per press (not on repeat),
//   from a panel checkbox too but never from a text box, never with Ctrl, and
//   from the built-in fallback key map as well; Ctrl+L must ship off; and F8
//   or Shift must re-aim the band or a drag that has really moved.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__OrthoMode__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with Ortho mode (Na__LayoutEditor__OrthoMode__, F8).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    const announced = [];
    const storage   = new Map();
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener    : () => {},
        removeEventListener : () => {},
        dispatchEvent       : (event) => { announced.push({ type : event.type, detail : event.detail }); return true; },
        localStorage        : {
            getItem    : (k) => (storage.has(k) ? storage.get(k) : null),
            setItem    : (k, v) => { storage.set(k, String(v)); },
            removeItem : (k) => { storage.delete(k); }
        },
        setTimeout, clearTimeout,
        requestAnimationFrame : () => 0,
        cancelAnimationFrame  : () => {}
    };
    globalThis.document = { body : { classList : { add : () => {}, remove : () => {}, toggle : () => {} } } };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // Every name a module imports gets a stub: the test's own when it gives one
    // (stubs), a live global getter when the module reads a let that changes
    // under it (live), else a function that does nothing and returns undefined.
    // tail is appended to the temporary copy only - an extra export of an
    // internal function the test drives - and never touches the shipped file.
    let loadCount = 0;
    async function load(relative, stubs, live, tail) {
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
        const key = '__Stubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const liveNames = live || [];
        const head = names.filter((n) => liveNames.indexOf(n) === -1).map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__OrthoMode__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src + (tail ? '\n' + tail + '\n' : ''), 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    function defineLive(name, getter) {
        Object.defineProperty(globalThis, name, { get : getter, configurable : true });
    }

    const ORTHO_CONFIG = JSON.parse(readFileSync(resolve(SRC, '51__System__LayoutEditor/32__System__OrthoMode/Na__LayoutEditor__OrthoMode__Config__.json'), 'utf8'));
    const SHIPPED_KEY_MAP = JSON.parse(readFileSync(resolve(SRC, '51__System__LayoutEditor/03__Core__Config/Na__Hotkeys__DrawingTabs__.json'), 'utf8'));
    globalThis.fetch = async () => ({ ok : true, json : async () => ORTHO_CONFIG });

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
    const round = (p) => (p ? { x : Math.round(p.x * 1000) / 1000, y : Math.round(p.y * 1000) / 1000 } : p);

    console.log('TrueVision3D - Ortho mode (F8)');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Rule
// -----------------------------------------------------------------------------

    console.log('\n  The rule: Ortho XOR Shift');
    const State = await load('51__System__LayoutEditor/32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js');
    const table = () => [ [ false, false ], [ false, true ], [ true, false ], [ true, true ] ].map(([ on, shift ]) => { State.Na__LeOrtho__AssignOn(on); return State.Na__LeOrtho__Resolve(shift); });
    check('off on a fresh browser (AutoCAD ORTHOMODE 0)', State.Na__LeOrtho__IsOn(), false);
    check('off+up free, off+Shift held, on+up held, on+Shift free', table(), [ false, true, true, false ]);
    State.Na__LeOrtho__AssignShiftOverride(false);
    check('with the Shift override off, Shift only ever holds', table(), [ false, true, true, true ]);
    State.Na__LeOrtho__AssignShiftOverride(true);
    check('an undefined Shift counts as up', (() => { State.Na__LeOrtho__AssignOn(true); return State.Na__LeOrtho__Resolve(undefined); })(), true);
    State.Na__LeOrtho__AssignOn(false);
    storage.set('na-layouteditor-ortho', '1');
    const Remembered = await load('51__System__LayoutEditor/32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js');
    check('a new page comes back on when this browser left it on', Remembered.Na__LeOrtho__IsOn(), true);
    storage.delete('na-layouteditor-ortho');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Switch
// -----------------------------------------------------------------------------

    console.log('\n  The switch: remembered, announced and echoed as AutoCAD echoes it');
    const said = [];
    const Ortho = await load('51__System__LayoutEditor/32__System__OrthoMode/Na__LayoutEditor__OrthoMode__.js', {
        Na__LeOrtho__CHANGED_EVENT       : State.Na__LeOrtho__CHANGED_EVENT,
        Na__LeOrtho__IsOn                : State.Na__LeOrtho__IsOn,
        Na__LeOrtho__AssignOn            : State.Na__LeOrtho__AssignOn,
        Na__LeOrtho__Store               : State.Na__LeOrtho__Store,
        Na__LeOrtho__AssignShiftOverride : State.Na__LeOrtho__AssignShiftOverride,
        Na__LeMeasure__Say               : (text) => { said.push(text); return true; }
    });
    const originalLog = console.log;
    console.log = (...a) => { if (!(typeof a[0] === 'string' && a[0].indexOf('[TrueVision3D LayoutEditor] Ortho') === 0)) originalLog(...a); };
    await Ortho.Na__LeOrtho__Ready();
    State.Na__LeOrtho__AssignOn(false);
    announced.length = 0;
    const on  = Ortho.Na__LeOrtho__Toggle();
    const onState = [ on, storage.get('na-layouteditor-ortho'), announced.map((a) => a.type + ':' + a.detail.enabled), said.slice() ];
    const off = Ortho.Na__LeOrtho__Toggle();
    const offState = [ off, storage.get('na-layouteditor-ortho'), announced.length, said.slice() ];
    announced.length = 0; said.length = 0;
    const same = Ortho.Na__LeOrtho__Set(false);
    console.log = originalLog;
    check('F8 on: on, remembered, announced, "<Ortho on>"', onState, [ true, '1', [ 'na-layouteditor-ortho-changed:true' ], [ '<Ortho on>' ] ]);
    check('F8 off: off, remembered, "<Ortho off>"',       offState, [ false, '0', 2, [ '<Ortho on>', '<Ortho off>' ] ]);
    check('switching to what it already is does nothing', [ same, announced.length, said.length ], [ false, 0, 0 ]);
    check('the toolbar words come from the config',        [ Ortho.Na__LeOrtho__Label('Toggle', '?'), Ortho.Na__LeOrtho__Label('EchoOn', '?') ], [ 'Ortho', '<Ortho on>' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Draw Tool
// -----------------------------------------------------------------------------

    console.log('\n  The Draw tool: the next vertex');
    const Axis = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__AxisLock__.js');
    const axisStubs = {
        Na__LeAxis__AXIS_X : Axis.Na__LeAxis__AXIS_X, Na__LeAxis__AXIS_Y : Axis.Na__LeAxis__AXIS_Y,
        Na__LeAxis__Get : Axis.Na__LeAxis__Get, Na__LeAxis__Set : Axis.Na__LeAxis__Set, Na__LeAxis__Toggle : Axis.Na__LeAxis__Toggle,
        Na__LeAxis__Clear : Axis.Na__LeAxis__Clear, Na__LeAxis__Apply : Axis.Na__LeAxis__Apply, Na__LeAxis__Nearest : Axis.Na__LeAxis__Nearest,
        Na__LeAxis__Hold : Axis.Na__LeAxis__Hold, Na__LeAxis__Constrain : Axis.Na__LeAxis__Constrain,
        Na__LeOrtho__Resolve : State.Na__LeOrtho__Resolve,
        // The drawing grid (F6 / F7, 27__System__DrawingGrid) is OFF in this test:
        // its snap hands every point and every drag delta back untouched.
        Na__LeGrid__SnapPoint        : (p) => p,
        Na__LeOsnap__GridDragDelta   : (sheet, drag, dMm) => dMm
    };
    let snapTarget = null;                                                   // <-- { x, y, radius } a snap point the cursor can land near
    const snapStub = (sheet, p) => (snapTarget && Math.hypot(p.x - snapTarget.x, p.y - snapTarget.y) <= snapTarget.radius)
        ? { x : snapTarget.x, y : snapTarget.y, snapped : true, kind : 'end' }
        : { x : p.x, y : p.y, snapped : false };
    let band = null;
    const shapeUpdates = [];
    const Shape = await load('51__System__LayoutEditor/35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js', Object.assign({}, axisStubs, {
        Na__LeCfg__GetShapeSetup     : () => ({ closeRadiusPx : 8 }),
        Na__LeCfg__GetSelectionSetup : () => ({ dragThresholdMm : 0.5 }),
        Na__LeModel__CreateShape     : () => ({ Shape__Id : 'S1' }),
        Na__LeModel__UpdateShape     : (sheet, id, patch) => { shapeUpdates.push(patch); return true; },
        Na__LeSurface__GetPixelsPerMm : () => 4,
        Na__LeSurface__GetZoom        : () => 1,
        Na__LeOsnap__Snap             : snapStub,
        Na__LeGrips__ShowBand         : (from, to) => { band = { x : to[0] !== undefined ? to[0] : to.x, y : to[1] !== undefined ? to[1] : to.y }; }
    }));
    const SHEET = { Sheet__Dimensions : [] };
    const bandAt = (x, y, shift) => { Shape.Na__LeShape__Move(SHEET, { x, y }, shift); return round(band); };
    State.Na__LeOrtho__AssignOn(false);
    Shape.Na__LeShape__Click(SHEET, { x : 10, y : 10 }, false, {});
    check('Ortho off: the band goes where the cursor is',                  bandAt(50, 12, false), { x : 50, y : 12 });
    check('Ortho off, Shift held: held across, as Shift always did',       bandAt(50, 12, true),  { x : 50, y : 10 });
    State.Na__LeOrtho__AssignOn(true);
    check('Ortho on: held across when the cursor is further across',      bandAt(50, 12, false), { x : 50, y : 10 });
    check('Ortho on: held down when the cursor is further down',           bandAt(12, 60, false), { x : 10, y : 60 });
    check('Ortho on, Shift held: free (AutoCAD\'s Shift override)',        bandAt(50, 12, true),  { x : 50, y : 12 });
    snapTarget = { x : 80, y : 30, radius : 2 };
    check('Ortho on, a snap off the axis: its x, the axis\'s y (never at an angle)', bandAt(79, 29, false), { x : 80, y : 10 });
    snapTarget = null;
    Axis.Na__LeAxis__Set('y');
    check('Ortho on, an arrow key lock still wins',                        bandAt(50, 12, false), { x : 10, y : 12 });
    Axis.Na__LeAxis__Clear();
    Shape.Na__LeShape__Click(SHEET, { x : 50, y : 13 }, false, {});
    const clicked = shapeUpdates[shapeUpdates.length - 1].points;
    check('Ortho on: the click lands the held point, not the cursor',      clicked[clicked.length - 1], [ 50, 10 ]);
    bandAt(10, 80, false);
    Shape.Na__LeShape__TypeLength(SHEET, 25);
    const typed = shapeUpdates[shapeUpdates.length - 1].points;
    check('Ortho on: a typed length runs along the held direction',        typed[typed.length - 1], [ 50, 35 ]);
    State.Na__LeOrtho__AssignOn(false);
    check('Ortho off again: free again',                                   bandAt(80, 60, false), { x : 80, y : 60 });
    Shape.Na__LeShape__Cancel(SHEET);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Dimension Tool
// -----------------------------------------------------------------------------

    console.log('\n  The Dimension tool: horizontal or vertical, as a held Shift made it');
    const DimGeo = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__DimensionGeometry__.js');
    const created = [];
    const Dim = await load('51__System__LayoutEditor/35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js', Object.assign({}, axisStubs, {
        Na__LeCfg__GetDimensionSetup : () => ({ inferenceRadiusPx : 6 }),
        Na__LeCfg__GetSelectionSetup : () => ({ dragThresholdMm : 0.5 }),
        Na__LeModel__KIND_2D         : '2d',
        Na__LeModel__IsLayerVisible  : () => true,
        Na__LeModel__CreateDimension : (sheet, start, end, opts) => {
            const dim = { Dimension__Id : 'D' + (created.length + 1), Dimension__StartXMm : start.x, Dimension__StartYMm : start.y, Dimension__EndXMm : end.x, Dimension__EndYMm : end.y, Dimension__Orientation : opts.orientation, Dimension__OffsetMm : opts.offsetMm || 0 };
            sheet.Sheet__Dimensions.push(dim);
            created.push({ end : { x : end.x, y : end.y }, orientation : opts.orientation });
            return dim;
        },
        Na__LeModel__UpdateDimension : (sheet, id, patch) => {
            const dim = sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === id);
            if (dim && patch.orientation) dim.Dimension__Orientation = patch.orientation;
            if (dim && Number.isFinite(patch.offsetMm)) dim.Dimension__OffsetMm = patch.offsetMm;
            return true;
        },
        Na__LeModel__DeleteDimension : (sheet, id) => { sheet.Sheet__Dimensions = sheet.Sheet__Dimensions.filter((d) => d.Dimension__Id !== id); return true; },
        Na__LeSurface__GetPixelsPerMm : () => 4,
        Na__LeSurface__GetZoom        : () => 1,
        Na__LeHandles__FrontToBack    : () => [],
        Na__LeHandles__Contains       : () => false,
        Na__LeMarkup__DimensionSkeleton : () => null,
        Na__LeDimGeo__ALIGNED         : DimGeo.Na__LeDimGeo__ALIGNED,
        Na__LeDimGeo__Frame           : DimGeo.Na__LeDimGeo__Frame,
        Na__LeDimGeo__OrthoToward     : DimGeo.Na__LeDimGeo__OrthoToward,
        Na__LeOsnap__TONE_DIMENSION   : 'dimension',
        Na__LeOsnap__Snap             : snapStub
    }));
    const orientationAt = (x, y, shift) => { Dim.Na__LeDim__Move(SHEET, { x, y }, shift); return SHEET.Sheet__Dimensions[SHEET.Sheet__Dimensions.length - 1].Dimension__Orientation; };
    State.Na__LeOrtho__AssignOn(false);
    Dim.Na__LeDim__Click(SHEET, { x : 10, y : 10 }, false, {});
    Dim.Na__LeDim__Click(SHEET, { x : 50, y : 30 }, false, {});
    check('Ortho off: aligned from its first frame',                        created[0].orientation, 'aligned');
    check('Ortho off: the line dragged below stays aligned',                orientationAt(30, 50, false), 'aligned');
    check('Ortho off, Shift held: horizontal below, as Shift always did',   orientationAt(30, 50, true), 'horizontal');
    Dim.Na__LeDim__Cancel(SHEET);
    State.Na__LeOrtho__AssignOn(true);
    Dim.Na__LeDim__Click(SHEET, { x : 10, y : 10 }, false, {});
    Dim.Na__LeDim__Click(SHEET, { x : 50, y : 30 }, false, {});
    check('Ortho on: ortho from its first frame',                           created[1].orientation, 'horizontal');
    check('Ortho on: its two points are the points picked (the span is never bent)', created[1].end, { x : 50, y : 30 });
    check('Ortho on: dragged below, horizontal (measures x)',               orientationAt(30, 50, false), 'horizontal');
    check('Ortho on: dragged beside, vertical (measures y)',                orientationAt(80, 20, false), 'vertical');
    check('Ortho on, Shift held: aligned (the override)',                   orientationAt(30, 50, true), 'aligned');
    Dim.Na__LeDim__Click(SHEET, { x : 30, y : 50 }, false, {});
    check('Ortho on: the third click lands it horizontal',                  SHEET.Sheet__Dimensions[SHEET.Sheet__Dimensions.length - 1].Dimension__Orientation, 'horizontal');
    State.Na__LeOrtho__AssignOn(false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Every Drag
// -----------------------------------------------------------------------------

    console.log('\n  Every drag a held Shift holds');
    const heard = { snapShape : [], groupLock : [], solve : [], patch : [], rotate : [] };
    const writes = [];
    let liveDrag = null;
    defineLive('Na__LeTools__Drag', () => liveDrag);
    const Drag = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__PointerDrag__.js', Object.assign({}, axisStubs, {
        Na__LeOsnap__Snap              : snapStub,
        Na__LeOsnap__TONE_DIMENSION    : 'dimension',
        Na__LeModel__UpdateShape       : (sheet, id, patch) => { writes.push({ kind : 'shape', patch }); return true; },
        Na__LeModel__UpdateAnnotation  : (sheet, id, patch) => { writes.push({ kind : 'annotation', patch }); return true; },
        Na__LeModel__UpdateDimension   : (sheet, id, patch) => { writes.push({ kind : 'dimension', patch }); return true; },
        Na__LeModel__UpdateViewport    : (sheet, id, patch) => { writes.push({ kind : 'viewport', patch }); return true; },
        Na__LeModel__GetViewportById   : () => ({ Viewport__Id : 'V1' }),
        Na__LeShapeGeo__Translated     : (points, dx, dy) => points.map((p) => [ p[0] + dx, p[1] + dy ]),
        Na__LeOsnap__ShapeTranslation     : (sheet, drag, dMm, shift) => { heard.snapShape.push(shift); return dMm; },
        Na__LeOsnap__GroupTranslation     : (sheet, drag, d, lock) => { heard.groupLock.push(lock); return d; },
        Na__LeTools__Record            : () => ({}),
        Na__LeVpMove__Solve            : (sheet, drag, cursor, shift) => { heard.solve.push(shift); return null; },
        Na__LeHandles__DragPatch       : (viewport, hit, start, moveBy, opts) => { heard.patch.push(opts.shift); return null; },
        Na__LeText__RotateTo           : (record, rotate, cursor, shift) => { heard.rotate.push(shift); return null; },
        Na__LeDimGeo__OffsetKeepingLine : () => 5
    }), [ 'Na__LeTools__Drag' ], 'export { Na__LeTools__ApplyDrag as Na__Test__ApplyDrag };');
    const apply = (drag, d, shift, exact) => { writes.length = 0; Drag.Na__Test__ApplyDrag(SHEET, drag, d, shift, exact); return writes.length ? writes[writes.length - 1].patch : null; };
    const vertexDrag = () => ({ kind : 'shape', mode : 'vertex', id : 'S1', index : 1, start : [ [ 0, 0 ], [ 10, 0 ], [ 10, 10 ] ], startMm : { x : 10, y : 0 } });
    const vertexAt = (shift) => apply(vertexDrag(), { x : 5, y : 1 }, shift).points[1];
    State.Na__LeOrtho__AssignOn(false);
    check('vertex, Ortho off: free',                          vertexAt(false), [ 15, 1 ]);
    check('vertex, Ortho off, Shift held: held across',       vertexAt(true),  [ 15, 0 ]);
    State.Na__LeOrtho__AssignOn(true);
    check('vertex, Ortho on: held across',                    vertexAt(false), [ 15, 0 ]);
    check('vertex, Ortho on, Shift held: free',               vertexAt(true),  [ 15, 1 ]);
    const textDrag = () => ({ kind : 'annotation', id : 'T1', start : { x : 0, y : 0 }, startMm : { x : 0, y : 0 } });
    check('text moved, Ortho on: along the nearer axis only', apply(textDrag(), { x : 5, y : 2 }, false), { posXMm : 5, posYMm : 0 });
    check('text moved a TYPED length, Ortho on: exact',       apply(textDrag(), { x : 5, y : 2 }, false, true), { posXMm : 5, posYMm : 2 });
    State.Na__LeOrtho__AssignOn(false);
    check('text moved, Ortho off: free, as before',           apply(textDrag(), { x : 5, y : 2 }, false), { posXMm : 5, posYMm : 2 });
    State.Na__LeOrtho__AssignOn(true);
    const dimEnd = { kind : 'dimension', mode : 'end', id : 'D9', start : { sx : 0, sy : 0, ex : 10, ey : 0, offset : 5 }, startMm : { x : 10, y : 0 } };
    SHEET.Sheet__Dimensions.push({ Dimension__Id : 'D9', Dimension__Orientation : 'aligned' });
    const endPatch = apply(dimEnd, { x : 5, y : 1 }, false);
    check('dimension end, Ortho on: held across',             [ endPatch.endXMm, endPatch.endYMm ], [ 15, 0 ]);
    apply({ kind : 'shape', mode : 'whole', id : 'S1', start : [ [ 0, 0 ], [ 10, 0 ] ], startMm : { x : 0, y : 0 } }, { x : 5, y : 2 }, false);
    apply({ kind : 'group', group : [], startMm : { x : 0, y : 0 } }, { x : 5, y : 2 }, false);
    apply({ kind : 'viewport', id : 'V1', hit : { mode : 'border' }, start : { rect : { X : 0, Y : 0 } }, startMm : { x : 0, y : 0 }, baseMm : { x : 1, y : 1 } }, { x : 5, y : 2 }, false);
    apply({ kind : 'annotation', mode : 'rotate', id : 'T1', rotate : {}, start : {}, startMm : { x : 0, y : 0 } }, { x : 5, y : 2 }, false);
    check('a vector moved whole, Ortho on: its snap is asked to hold the axis', heard.snapShape, [ true ]);
    check('a group moved, Ortho on: locked to the nearer axis (x)',            heard.groupLock, [ 'x' ]);
    check('a viewport carried by a point, Ortho on: the solver holds the axis', heard.solve, [ true ]);
    check('a viewport handle still hears the raw Shift (up)',                  heard.patch, [ false ]);
    check('the text rotate grip still hears the raw Shift (up)',               heard.rotate, [ false ]);
    State.Na__LeOrtho__AssignOn(false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Keyboard
// -----------------------------------------------------------------------------

    console.log('\n  The keyboard: F8');
    const KeyMap = await load('51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', { Na__LeCfg__PREFIX : 'LayoutEditor__' });
    KeyMap.Na__LeCfg__SetKeyMap(SHIPPED_KEY_MAP);
    const ToolsState = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js');
    const kb = { tool : 'draw', editable : true, drag : null, point : { x : 5, y : 5 }, shift : false, drawing : true, placing : false, toggles : 0, redrawn : [] };
    defineLive('Na__LeTools__Tool',        () => kb.tool);
    defineLive('Na__LeTools__Editable',    () => kb.editable);
    defineLive('Na__LeTools__LastPointMm', () => kb.point);
    defineLive('Na__LeTools__ShiftHeld',   () => kb.shift);
    liveDrag = null;
    const Keys = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__Keyboard__.js', {
        Na__LeCfg__GetKeyboardSetup  : KeyMap.Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__MatchKeyBinding   : KeyMap.Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__GetLabel          : (k, f) => f,
        Na__LeModel__GetActiveSheet  : () => SHEET,
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
        Na__LeTools__WriteShiftHeld  : (v) => { kb.shift = v; },
        Na__LeOrtho__Toggle          : () => { kb.toggles++; return true; },
        Na__LeShape__IsDrawing       : () => kb.drawing,
        Na__LeShape__Move            : (sheet, point, shift) => { kb.redrawn.push('band:' + shift); return true; },
        Na__LeDim__IsPlacing         : () => kb.placing,
        Na__LeDim__Move              : (sheet, point, shift) => { kb.redrawn.push('dimension:' + shift); return true; },
        Na__LeTools__RerunVertexDrag : () => { const on = !!(liveDrag && liveDrag.mode === 'vertex'); if (on) kb.redrawn.push('vertex'); return on; },
        Na__LeTools__RerunMoveDrag   : () => false,
        Na__LeTools__RerunDimEndDrag : () => false,
        Na__LeTools__RerunViewportDrag : () => false
    }, [ 'Na__LeTools__Tool', 'Na__LeTools__Editable', 'Na__LeTools__LastPointMm', 'Na__LeTools__ShiftHeld', 'Na__LeTools__Drag' ]);
    const key = (name, o) => {
        const opts = o || {};
        return {
            key : name, code : '', target : opts.target || { tagName : 'DIV', isContentEditable : false },
            ctrlKey : !!opts.ctrl, shiftKey : !!opts.shift, altKey : false, metaKey : false, repeat : !!opts.repeat,
            prevented : false, preventDefault() { this.prevented = true; }
        };
    };
    const pressF8 = (o) => { const before = kb.toggles; kb.redrawn = []; const e = key('F8', o); Keys.Na__LeTools__OnKey(e); return [ kb.toggles - before, e.prevented, kb.redrawn.slice() ]; };
    const actionFor = (name, mods) => (KeyMap.Na__LeCfg__MatchKeyBinding(name, mods || {}) || {}).action || null;
    check('the shipped key map binds F8 to Ortho, and a plain L stays Draw', [ actionFor('F8'), actionFor('l') ], [ 'Ortho__Toggle', 'Tool__Draw' ]);
    check('Ctrl+L, AutoCAD\'s second key, ships off',                       actionFor('l', { Ctrl : true }), null);
    check('F8 switches Ortho once, takes the key, and re-aims the band',    pressF8(), [ 1, true, [ 'band:false' ] ]);
    check('a held F8 is taken but switches nothing more',                   pressF8({ repeat : true }), [ 0, true, [] ]);
    check('F8 from a panel checkbox still reaches the sheet',               pressF8({ target : { tagName : 'INPUT', type : 'checkbox', isContentEditable : false } })[0], 1);
    check('F8 in a text box stays the text box\'s',                         pressF8({ target : { tagName : 'INPUT', type : 'text', isContentEditable : false } }), [ 0, false, [] ]);
    check('Ctrl+F8 is not the binding (Exact)',                             pressF8({ ctrl : true }), [ 0, false, [] ]);
    kb.tool = 'dimension'; kb.drawing = false; kb.placing = true;
    check('with a dimension being placed, F8 re-aims it',                   pressF8()[2], [ 'dimension:false' ]);
    kb.tool = 'draw'; kb.drawing = true; kb.placing = false;
    liveDrag = { kind : 'shape', mode : 'vertex', moved : true };
    check('with a vertex really being dragged, F8 re-aims the drag',        pressF8()[2], [ 'vertex' ]);
    liveDrag = { kind : 'shape', mode : 'vertex', moved : false };
    check('a press still under the drag threshold is never shifted by F8',  pressF8()[2], [ 'band:false' ]);
    liveDrag = null;
    kb.redrawn = [];
    Keys.Na__LeTools__ShiftRedraw(true);
    check('Shift down re-aims the band with Shift held (the override)',     [ kb.shift, kb.redrawn ], [ true, [ 'band:true' ] ]);
    kb.redrawn = [];
    Keys.Na__LeTools__ShiftRedraw(false);
    check('Shift up re-aims it again',                                      [ kb.shift, kb.redrawn ], [ false, [ 'band:false' ] ]);
    kb.editable = false;
    check('a read-only sheet re-aims nothing',                              pressF8()[2], []);
    kb.editable = true;
    KeyMap.Na__LeCfg__SetKeyMap(null);
    check('the built-in fallback key map switches Ortho on F8 too',         pressF8()[0], 1);

// endregion -------------------------------------------------------------------


    console.log('\n' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED'));
    process.exit(failures === 0 ? 0 : 1);
