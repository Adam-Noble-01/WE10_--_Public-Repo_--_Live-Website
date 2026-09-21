// =============================================================================
// TRUEVISION3D - TEST - THE MEASUREMENTS BOX DURING A MOVE, AND THE RETYPE
// =============================================================================
//
// FILE       : Na__Test__MoveRetype__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Move Readout and Retype Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Measurements box reads a whole-object move live, a held axis survives a snap, and the last move can be retyped the way SketchUp allows
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE LIVE READOUT. The pointer drag unit is loaded as shipped, its imports
//   stubbed: every step of a vector, a note, a leader or a dimension moved
//   whole must refresh the box (it never did - the box froze on its first
//   reading), and a press that has not yet become a drag must not read the
//   distance to wherever the pointer last hovered.
// - THE HELD AXIS. The hit resolution unit's SnapShapeTranslation: with Shift
//   (or Ortho) holding the axis, a snap may supply only the coordinate along
//   it - a vector moved "along the inferred lock" used to jump off it the
//   moment a corner came near the linework. Free, the snap still wins outright.
// - THE RETYPE. When a drag lets go, the move it made stays on offer: a value
//   typed next lands it again exactly that far along the same line, measured
//   from where it STARTED, and so does every value after it - for a vector, a
//   selection moved as one and a viewport frame; a vertex and a dimension end
//   let go by the mouse get the record a typed value writes. A first value
//   typed while the drag is held keeps its own line and sign. The record
//   lapses with another selection, any change to what was moved, another
//   sheet, or a drag in flight. Every typed landing is exact: the grid is
//   never asked.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched (the Ortho test's loader).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__MoveRetype__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the live move readout, the held axis through a snap and the
//   retype of the last move (Na__LayoutEditor__SheetTools__PointerDrag__ 1.12.0,
//   Na__LayoutEditor__SheetTools__HitResolution__ 1.5.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener    : () => {},
        removeEventListener : () => {},
        dispatchEvent       : () => true,
        localStorage        : { getItem : () => null, setItem : () => {}, removeItem : () => {} },
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
        const key = '__Stubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const liveNames = live || [];
        const head = names.filter((n) => liveNames.indexOf(n) === -1).map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__MoveRetype__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    function defineLive(name, getter) {
        Object.defineProperty(globalThis, name, { get : getter, configurable : true });
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
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const pt = (p) => (p ? { x : r3(p.x), y : r3(p.y) } : p);
    const pts = (list) => list.map((p) => [ r3(p[0]), r3(p[1]) ]);
    const dist = (reading) => (reading ? r3(Math.hypot(reading.to.x - reading.from.x, reading.to.y - reading.from.y)) : null);

    console.log('TrueVision3D - the Measurements box during a move, and the retype');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet, the Shared State and the Pointer Drag Unit
// -----------------------------------------------------------------------------

    const SHEET = {
        Sheet__Id : 'Sheet_T1',
        Sheet__Shapes : [], Sheet__Annotations : [], Sheet__Leaders : [], Sheet__Dimensions : [], Sheet__Viewports : []
    };
    const find = (list, key, id) => list.find((r) => r[key] === id) || null;
    const record = (sheet, found) => {
        if (!found) return null;
        if (found.kind === 'annotation') return find(sheet.Sheet__Annotations, 'Annotation__Id', found.id);
        if (found.kind === 'dimension')  return find(sheet.Sheet__Dimensions, 'Dimension__Id', found.id);
        if (found.kind === 'shape')      return find(sheet.Sheet__Shapes, 'Shape__Id', found.id);
        if (found.kind === 'leader')     return find(sheet.Sheet__Leaders, 'Leader__Id', found.id);
        return find(sheet.Sheet__Viewports, 'Viewport__Id', found.id);
    };

    // The sheet tools' shared state, read live by the unit and written through its Write accessors
    const st = { drag : null, lastPoint : null, shift : false, vertexRetype : null, dimEndRetype : null, moveRetype : null, selection : [], sheet : SHEET,
                 stage : { classList : { contains : () => false }, releasePointerCapture : () => {}, style : {} } };
    defineLive('Na__LeTools__Drag',         () => st.drag);
    defineLive('Na__LeTools__LastPointMm',  () => st.lastPoint);
    defineLive('Na__LeTools__ShiftHeld',    () => st.shift);
    defineLive('Na__LeTools__VertexRetype', () => st.vertexRetype);
    defineLive('Na__LeTools__DimEndRetype', () => st.dimEndRetype);
    defineLive('Na__LeTools__MoveRetype',   () => st.moveRetype);
    defineLive('Na__LeTools__Stage',        () => st.stage);
    defineLive('Na__LeTools__Editable',     () => true);
    defineLive('Na__LeTools__Suppressed',   () => false);
    defineLive('Na__LeTools__Tool',         () => 'move');

    const Axis = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__AxisLock__.js');

    const seen = { refresh : 0, announce : [], grid : 0 };
    let gridStep = 0;                                                        // <-- 0 = Grid Snap off; else the step GridDragDelta rounds a drag to
    const Drag = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__PointerDrag__.js', {
        Na__LeTools__TOOL_SELECT : 'select', Na__LeTools__TOOL_DIMENSION : 'dimension', Na__LeTools__TOOL_DRAW : 'draw', Na__LeTools__TOOL_RECT : 'rectangle',
        Na__LeTools__TOOL_EYEDROP : 'eyedropper', Na__LeTools__TOOL_LEADER : 'leader', Na__LeTools__TOOL_AREA : 'area',
        Na__LeTools__PICK_TOOLS : [ 'select', 'move' ], Na__LeTools__TYPED_MIN_MM : 1e-4, Na__LeTools__SAME_MM : 1e-9,
        Na__LeTools__WriteDrag          : (d) => { st.drag = d; },
        Na__LeTools__WriteLastPointMm   : (p) => { st.lastPoint = p; },
        Na__LeTools__WriteShiftHeld     : (s) => { st.shift = s; },
        Na__LeTools__WriteVertexRetype  : (r) => { st.vertexRetype = r; },
        Na__LeTools__WriteDimEndRetype  : (r) => { st.dimEndRetype = r; },
        Na__LeTools__WriteMoveRetype    : (r) => { st.moveRetype = r; },
        Na__LeCfg__GetSelectionSetup    : () => ({ dragThresholdMm : 0.5, pickDragPx : 4 }),
        Na__LeCfg__GetDimensionSetup    : () => ({ textLeaderMinMm : 1 }),
        Na__LeModel__GetActiveSheet     : () => st.sheet,
        Na__LeModel__GetSelectionItems  : () => st.selection.map((i) => ({ kind : i.kind, id : i.id })),
        Na__LeModel__GetSelection       : () => (st.selection.length === 1 ? st.selection[0] : null),
        Na__LeModel__GetShapeById       : (sheet, id) => find(sheet.Sheet__Shapes, 'Shape__Id', id),
        Na__LeModel__GetViewportById    : (sheet, id) => find(sheet.Sheet__Viewports, 'Viewport__Id', id),
        Na__LeModel__UpdateShape        : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Shapes, 'Shape__Id', id); if (r && patch.points) r.Shape__Points = patch.points.map((p) => [ p[0], p[1] ]); if (!silent) seen.announce.push('shape:' + id); return true; },
        Na__LeModel__UpdateAnnotation   : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Annotations, 'Annotation__Id', id); if (r && Number.isFinite(patch.posXMm)) { r.Annotation__PosXMm = patch.posXMm; r.Annotation__PosYMm = patch.posYMm; } if (!silent) seen.announce.push('annotation:' + id); return true; },
        Na__LeModel__UpdateLeader       : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Leaders, 'Leader__Id', id); if (r) { if (Number.isFinite(patch.tipXMm)) { r.Leader__TipXMm = patch.tipXMm; r.Leader__TipYMm = patch.tipYMm; } if (Number.isFinite(patch.anchorXMm)) { r.Leader__AnchorXMm = patch.anchorXMm; r.Leader__AnchorYMm = patch.anchorYMm; } } if (!silent) seen.announce.push('leader:' + id); return true; },
        Na__LeModel__UpdateDimension    : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Dimensions, 'Dimension__Id', id); if (r) { if (Number.isFinite(patch.startXMm)) { r.Dimension__StartXMm = patch.startXMm; r.Dimension__StartYMm = patch.startYMm; } if (Number.isFinite(patch.endXMm)) { r.Dimension__EndXMm = patch.endXMm; r.Dimension__EndYMm = patch.endYMm; } if (Number.isFinite(patch.offsetMm)) r.Dimension__OffsetMm = patch.offsetMm; } if (!silent) seen.announce.push('dimension:' + id); return true; },
        Na__LeModel__UpdateViewport     : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Viewports, 'Viewport__Id', id); if (r && patch.rect) Object.assign(r.Viewport__FrameMm, patch.rect); if (!silent) seen.announce.push('viewport:' + id); return true; },
        Na__LeSurface__ClientToPaperMm  : (x, y) => ({ x : x, y : y }),
        Na__LeSurface__GetZoom          : () => 1,
        Na__LeSurface__GetPixelsPerMm   : () => 1,
        Na__LeHandles__DragPatch        : (viewport, hit, start, moveBy) => ({ rect : { X : start.rect.X + moveBy.x, Y : start.rect.Y + moveBy.y } }),
        Na__LeShapeGeo__Points          : (shape) => shape.Shape__Points,
        Na__LeShapeGeo__Translated      : (points, dx, dy) => points.map((p) => [ p[0] + dx, p[1] + dy ]),
        Na__LeDimGeo__OffsetKeepingLine : (a, b, offset) => offset,
        Na__LeDimGeo__SpanMm            : (a, b) => Math.hypot(b.x - a.x, b.y - a.y),
        Na__LeMeasure__Refresh          : () => { seen.refresh++; },
        Na__LeOsnap__Snap               : (sheet, p) => ({ snapped : false, x : p.x, y : p.y }),
        Na__LeTools__GridDragDelta      : (sheet, drag, dMm) => { seen.grid++; return gridStep ? { x : Math.round(dMm.x / gridStep) * gridStep, y : Math.round(dMm.y / gridStep) * gridStep } : dMm; },
        Na__LeAxis__Get : Axis.Na__LeAxis__Get, Na__LeAxis__Apply : Axis.Na__LeAxis__Apply, Na__LeAxis__Hold : Axis.Na__LeAxis__Hold, Na__LeAxis__Clear : Axis.Na__LeAxis__Clear,
        Na__LeOrtho__Resolve            : (shift) => shift === true,         // <-- Ortho off: Shift alone holds the axis
        Na__LeTools__SnapShapeTranslation : (sheet, drag, dMm) => dMm,       // <-- No object snap in reach
        Na__LeTools__SnapGroupTranslation : (sheet, drag, d) => d,
        Na__LeTools__Record             : record,
        Na__LeSelSet__Apply             : (sheet, group, dx, dy) => { group.forEach((e) => {
            const r = record(sheet, e);
            if (e.kind === 'shape') r.Shape__Points = e.start.points.map((p) => [ p[0] + dx, p[1] + dy ]);
            else if (e.kind === 'annotation') { r.Annotation__PosXMm = e.start.x + dx; r.Annotation__PosYMm = e.start.y + dy; }
        }); return true; },
        Na__LeSelSet__Commit            : (sheet, group) => { seen.announce.push('group:' + group.length); return true; },
        Na__LeSelBox__Move              : () => false,
        Na__LeSelBox__IsActive          : () => false
    }, [ 'Na__LeTools__Drag', 'Na__LeTools__LastPointMm', 'Na__LeTools__ShiftHeld', 'Na__LeTools__VertexRetype', 'Na__LeTools__DimEndRetype',
         'Na__LeTools__MoveRetype', 'Na__LeTools__Stage', 'Na__LeTools__Editable', 'Na__LeTools__Suppressed', 'Na__LeTools__Tool' ]);

    const move = (x, y, shift) => Drag.Na__LeTools__OnMove({ clientX : x, clientY : y, pointerId : 1, shiftKey : !!shift, buttons : 1, pointerType : 'mouse' });
    const up   = (x, y) => Drag.Na__LeTools__OnUp({ clientX : x, clientY : y, pointerId : 1, type : 'pointerup' });
    const press = (drag) => { st.drag = Object.assign({ moved : false, pointerId : 1 }, drag); return st.drag; };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Live Readout
// -----------------------------------------------------------------------------

    console.log('\n  The box reads a whole-object move on every step');
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S1', Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ] });
    SHEET.Sheet__Annotations.push({ Annotation__Id : 'T1', Annotation__PosXMm : 50, Annotation__PosYMm : 50 });
    SHEET.Sheet__Leaders.push({ Leader__Id : 'L1', Leader__TipXMm : 0, Leader__TipYMm : 80, Leader__AnchorXMm : 10, Leader__AnchorYMm : 70 });
    SHEET.Sheet__Dimensions.push({ Dimension__Id : 'D1', Dimension__StartXMm : 0, Dimension__StartYMm : 100, Dimension__EndXMm : 20, Dimension__EndYMm : 100, Dimension__OffsetMm : 5, Dimension__Orientation : 'aligned' });
    const steps = (drag, from) => {
        press(drag);
        seen.refresh = 0;
        const readings = [];
        [ [ 3, 4 ], [ 6, 8 ], [ 9, 12 ] ].forEach(([ dx, dy ]) => { move(from.x + dx, from.y + dy); readings.push(dist(Drag.Na__LeTools__GetMoveDrag())); });
        const refreshes = seen.refresh;
        up(from.x + 9, from.y + 12);
        return { refreshes : refreshes, readings : readings };
    };
    check('a vector moved whole: refreshed at every step, reading 5, 10, 15',
          steps({ kind : 'shape', mode : 'whole', id : 'S1', start : [ [ 0, 0 ], [ 10, 0 ] ], startMm : { x : 5, y : 0 } }, { x : 5, y : 0 }), { refreshes : 3, readings : [ 5, 10, 15 ] });
    check('a note moved: refreshed at every step',
          steps({ kind : 'annotation', id : 'T1', start : { x : 50, y : 50 }, startMm : { x : 51, y : 49 } }, { x : 51, y : 49 }), { refreshes : 3, readings : [ 5, 10, 15 ] });
    check('a leader moved whole: refreshed at every step',
          steps({ kind : 'leader', mode : 'whole', id : 'L1', start : { tx : 0, ty : 80, ax : 10, ay : 70 }, startMm : { x : 5, y : 75 } }, { x : 5, y : 75 }), { refreshes : 3, readings : [ 5, 10, 15 ] });
    check('a dimension moved whole: refreshed at every step',
          steps({ kind : 'dimension', mode : 'whole', id : 'D1', start : { sx : 0, sy : 100, ex : 20, ey : 100, offset : 5 }, startMm : { x : 10, y : 100 } }, { x : 10, y : 100 }), { refreshes : 3, readings : [ 5, 10, 15 ] });
    st.lastPoint = { x : 400, y : 300 };                                     // <-- Where the pointer last hovered, far from the press
    press({ kind : 'shape', mode : 'whole', id : 'S1', start : [ [ 9, 12 ], [ 19, 12 ] ], startMm : { x : 14, y : 12 } });
    check('a press that is not yet a drag reads nothing, not the distance to the last hover', dist(Drag.Na__LeTools__GetMoveDrag()), 0);
    st.drag = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Held Axis Through a Snap
// -----------------------------------------------------------------------------

    console.log('\n  A vector moved whole along a held axis stays on it through a snap');
    const markers = [], gridLocks = [];
    let snapAt = null;                                                       // <-- { x, y } the one snap point on the sheet, 2 mm reach
    const Hit = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__HitResolution__.js', {
        Na__LeOsnap__Find          : (sheet, p) => { if (!snapAt) return null; const d = Math.hypot(p.x - snapAt.x, p.y - snapAt.y); return d <= 2 ? { x : snapAt.x, y : snapAt.y, kind : 'end', score : d } : null; },
        Na__LeOsnap__ShowMarker    : (m) => { markers.push({ x : r3(m.x), y : r3(m.y) }); },
        Na__LeTools__GridTranslation : (sheet, drag, delta, lock) => { gridLocks.push(lock); return delta; }
    });
    const vector = { kind : 'shape', id : 'S9', start : [ [ 0, 0 ], [ 10, 0 ] ], baseMm : null };
    snapAt = { x : 20.3, y : 1.2 };
    check('Shift held across: the snap gives x, y stays on the axis (it went 1.2 mm off)', pt(Hit.Na__LeTools__SnapShapeTranslation(SHEET, vector, { x : 10.5, y : 0.8 }, true)), { x : 10.3, y : 0 });
    check('...and the ring sits where the corner lands on the line',                     markers[markers.length - 1], { x : 20.3, y : 0 });
    check('free (no Shift, no Ortho): the snap still wins outright',                      pt(Hit.Na__LeTools__SnapShapeTranslation(SHEET, vector, { x : 10.5, y : 0.8 }, false)), { x : 10.3, y : 1.2 });
    snapAt = { x : 11.1, y : 9.4 };
    check('Shift held down the paper: the snap gives y, x stays',                         pt(Hit.Na__LeTools__SnapShapeTranslation(SHEET, vector, { x : 0.6, y : 9 }, true)), { x : 0, y : 9.4 });
    snapAt = null;
    Hit.Na__LeTools__SnapShapeTranslation(SHEET, vector, { x : 30, y : 0.8 }, true);
    Hit.Na__LeTools__SnapShapeTranslation(SHEET, vector, { x : 30, y : 0.8 }, false);
    check('no snap in reach: the grid is handed the held axis, or none',                  gridLocks, [ 'x', null ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Retype
// -----------------------------------------------------------------------------

    console.log('\n  The last move stays on offer to a typed value');
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S2', Shape__Points : [ [ 0, 0 ], [ 10, 0 ], [ 10, 10 ] ] });
    const S2 = () => find(SHEET.Sheet__Shapes, 'Shape__Id', 'S2').Shape__Points;
    const S2_START = [ [ 0, 0 ], [ 10, 0 ], [ 10, 10 ] ];
    st.selection = [ { kind : 'shape', id : 'S2' } ];
    press({ kind : 'shape', mode : 'whole', id : 'S2', start : S2_START.map((p) => p.slice()), startMm : { x : 5, y : 5 } });
    move(11, 5); move(17, 10);                                               // <-- 12 across, 5 down: 13 mm
    seen.announce.length = 0;
    up(17, 10);
    check('let go by the mouse: the release announces once',              seen.announce, [ 'shape:S2' ]);
    check('...and the move stays in the box, reading 13',                 dist(Drag.Na__LeTools__GetMoveRetype()), 13);
    check('a value typed next lands it that far from where it STARTED',  [ Drag.Na__LeTools__TypeMoveLength(26), pts(S2()) ], [ { ok : true, retyped : true }, [ [ 24, 10 ], [ 34, 10 ], [ 34, 20 ] ] ]);
    check('another value replaces it (not added to it)',                  [ Drag.Na__LeTools__TypeMoveLength(6.5).ok, pts(S2()) ], [ true, [ [ 6, 2.5 ], [ 16, 2.5 ], [ 16, 12.5 ] ] ]);
    check('a minus sign runs back the other way from the start',          [ Drag.Na__LeTools__TypeMoveLength(-13).ok, pts(S2()) ], [ true, [ [ -12, -5 ], [ -2, -5 ], [ -2, 5 ] ] ]);
    check('the box reads the distance alone',                             dist(Drag.Na__LeTools__GetMoveRetype()), 13);
    check('every value was its own announcement (its own undo step)',     seen.announce, [ 'shape:S2', 'shape:S2', 'shape:S2', 'shape:S2' ]);
    gridStep = 5; seen.grid = 0;
    Drag.Na__LeTools__TypeMoveLength(13.3);
    check('Grid Snap on: a typed value is exact, the grid is never asked', [ seen.grid, pts(S2())[0] ], [ 0, [ 12.277, 5.115 ] ]);
    gridStep = 0;
    st.selection = [ { kind : 'shape', id : 'S1' } ];
    check('another selection: the move is no longer on offer',            [ Drag.Na__LeTools__GetMoveRetype(), Drag.Na__LeTools__TypeMoveLength(10).reason ], [ null, 'none' ]);
    st.selection = [ { kind : 'shape', id : 'S2' } ];
    check('...back to the same one, untouched: on offer again',           dist(Drag.Na__LeTools__GetMoveRetype()), 13.3);
    find(SHEET.Sheet__Shapes, 'Shape__Id', 'S2').Shape__Points[0][0] += 1;   // <-- A nudge, an undo, anything that moves it
    check('anything that moves it since ends the run',                     Drag.Na__LeTools__GetMoveRetype(), null);
    find(SHEET.Sheet__Shapes, 'Shape__Id', 'S2').Shape__Points[0][0] -= 1;
    st.sheet = Object.assign({}, SHEET, { Sheet__Id : 'Sheet_T2' });
    check('another sheet ends it',                                         Drag.Na__LeTools__GetMoveRetype(), null);
    st.sheet = SHEET;
    press({ kind : 'shape', mode : 'whole', id : 'S1', start : [ [ 0, 0 ], [ 10, 0 ] ], startMm : { x : 5, y : 0 } });
    check('a drag in flight puts it to sleep',                             Drag.Na__LeTools__GetMoveRetype(), null);
    st.drag = null;
    check('...and it wakes once the drag is gone, if it moved nothing',   dist(Drag.Na__LeTools__GetMoveRetype()), 13.3);

    console.log('\n  A first value typed while the drag is held, then more');
    st.moveRetype = null;
    SHEET.Sheet__Annotations.push({ Annotation__Id : 'T2', Annotation__PosXMm : 100, Annotation__PosYMm : 100 });
    st.selection = [ { kind : 'annotation', id : 'T2' } ];
    press({ kind : 'annotation', id : 'T2', start : { x : 100, y : 100 }, startMm : { x : 101, y : 101 } });
    move(102, 101); move(104, 105);                                          // <-- 3 across, 4 down
    const T2 = () => { const a = find(SHEET.Sheet__Annotations, 'Annotation__Id', 'T2'); return [ r3(a.Annotation__PosXMm), r3(a.Annotation__PosYMm) ]; };
    check('the first value, mouse still down: exact along the drag',      [ Drag.Na__LeTools__TypeMoveLength(20), T2(), st.drag ], [ { ok : true }, [ 112, 116 ], null ]);
    check('the second: from where it started, along the same line',       [ Drag.Na__LeTools__TypeMoveLength(10).retyped, T2() ], [ true, [ 106, 108 ] ]);
    move(150, 150);
    check('the pointer wandering after the value moves nothing',          T2(), [ 106, 108 ]);
    press({ kind : 'annotation', id : 'T2', start : { x : 106, y : 108 }, startMm : { x : 107, y : 109 } });
    move(107, 109.2); up(107, 109.2);                                        // <-- A press that never became a drag
    check('a click on it that moves nothing keeps the offer',             dist(Drag.Na__LeTools__GetMoveRetype()), 10);
    st.moveRetype = null;
    press({ kind : 'annotation', id : 'T2', start : { x : 106, y : 108 }, startMm : { x : 107, y : 109 } });
    move(107, 110); move(107, 115);
    Drag.Na__LeTools__TypeMoveLength(-5);
    check('a minus first value: 5 back up the drag',                      T2(), [ 106, 103 ]);
    Drag.Na__LeTools__TypeMoveLength(8);
    check('...and a value after it runs the way the drag went',           T2(), [ 106, 116 ]);

    console.log('\n  A selection moved as one, and a viewport frame');
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S3', Shape__Points : [ [ 0, 200 ], [ 10, 200 ] ] });
    SHEET.Sheet__Annotations.push({ Annotation__Id : 'T3', Annotation__PosXMm : 20, Annotation__PosYMm : 210 });
    st.selection = [ { kind : 'shape', id : 'S3' }, { kind : 'annotation', id : 'T3' } ];
    press({ kind : 'group', group : [ { kind : 'shape', id : 'S3', start : { points : [ [ 0, 200 ], [ 10, 200 ] ] } }, { kind : 'annotation', id : 'T3', start : { x : 20, y : 210 } } ], startMm : { x : 5, y : 200 } });
    move(5, 202); move(5, 208);
    seen.announce.length = 0;
    up(5, 208);
    Drag.Na__LeTools__TypeMoveLength(20);
    const groupNow = [ pts(find(SHEET.Sheet__Shapes, 'Shape__Id', 'S3').Shape__Points), T2 && [ r3(find(SHEET.Sheet__Annotations, 'Annotation__Id', 'T3').Annotation__PosXMm), r3(find(SHEET.Sheet__Annotations, 'Annotation__Id', 'T3').Annotation__PosYMm) ] ];
    check('every member lands again from its own start',                  groupNow, [ [ [ 0, 220 ], [ 10, 220 ] ], [ 20, 230 ] ]);
    check('...announced once for the lot, each time',                     seen.announce, [ 'group:2', 'group:2' ]);
    SHEET.Sheet__Viewports.push({ Viewport__Id : 'V1', Viewport__FrameMm : { X : 300, Y : 40, WidthMm : 100, HeightMm : 80 } });
    st.selection = [ { kind : 'viewport', id : 'V1' } ];
    press({ kind : 'viewport', id : 'V1', hit : { mode : 'border' }, start : { rect : { X : 300, Y : 40, WidthMm : 100, HeightMm : 80 } }, startMm : { x : 300, y : 60 }, baseMm : null });
    move(304, 60); move(308, 66);                                            // <-- 8 across, 6 down: 10 mm
    up(308, 66);
    const frame = () => { const f = find(SHEET.Sheet__Viewports, 'Viewport__Id', 'V1').Viewport__FrameMm; return [ r3(f.X), r3(f.Y), f.WidthMm, f.HeightMm ]; };
    check('a frame let go: reads 10, and is no move of the whole-object kind', [ dist(Drag.Na__LeTools__GetViewportRetype()), Drag.Na__LeTools__GetMoveRetype(), Drag.Na__LeTools__TypeMoveLength(5).reason ], [ 10, null, 'none' ]);
    check('a value lands the frame that far from where it started, same size', [ Drag.Na__LeTools__TypeViewportLength(25).retyped, frame() ], [ true, [ 320, 55, 100, 80 ] ]);

    console.log('\n  A vertex and a dimension end let go by the mouse');
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S4', Shape__Points : [ [ 0, 300 ], [ 10, 300 ] ] });
    st.selection = [ { kind : 'shape', id : 'S4' } ];
    press({ kind : 'shape', mode : 'vertex', id : 'S4', index : 1, indices : [ 1 ], start : [ [ 0, 300 ], [ 10, 300 ] ], startMm : { x : 10, y : 300 } });
    move(13, 304); up(13, 304);
    const vr = st.vertexRetype;
    check('the vertex gets the record a typed value writes',              vr && { from : vr.from, dir : pt(vr.dir), origin : vr.origin, index : vr.index }, { from : [ 10, 300 ], dir : { x : 0.6, y : 0.8 }, origin : [ [ 0, 300 ], [ 10, 300 ] ], index : 1 });
    check('...and the last whole move is forgotten: one record at a time', st.moveRetype, null);
    check('a typed length then moves it from where it started',          [ Drag.Na__LeTools__TypeVertexLength(20).retyped, pts(find(SHEET.Sheet__Shapes, 'Shape__Id', 'S4').Shape__Points) ], [ true, [ [ 0, 300 ], [ 22, 316 ] ] ]);
    press({ kind : 'shape', mode : 'vertex', id : 'S4', index : 1, indices : [ 1 ], start : [ [ 0, 300 ], [ 22, 316 ] ], startMm : { x : 22, y : 316 } });
    move(25, 316);
    Drag.Na__LeTools__TypeVertexLength(-4);                                  // <-- A value finishes the drag: its own record, sign and all
    check('a vertex a minus value finished keeps its typed line',         [ pt(st.vertexRetype.dir), st.vertexRetype.from ], [ { x : 1, y : 0 }, [ 22, 316 ] ]);
    SHEET.Sheet__Dimensions.push({ Dimension__Id : 'D2', Dimension__StartXMm : 0, Dimension__StartYMm : 400, Dimension__EndXMm : 10, Dimension__EndYMm : 400, Dimension__OffsetMm : 5, Dimension__Orientation : 'aligned' });
    st.selection = [ { kind : 'dimension', id : 'D2' } ];
    press({ kind : 'dimension', mode : 'end', id : 'D2', start : { sx : 0, sy : 400, ex : 10, ey : 400, offset : 5 }, startMm : { x : 10, y : 400 } });
    move(14, 400); up(14, 400);
    const de = st.dimEndRetype;
    check('a dimension end gets its record: the fixed end, the end let go', de && { mode : de.mode, fixed : de.fixed, point : de.point }, { mode : 'end', fixed : { x : 0, y : 400 }, point : { x : 14, y : 400 } });
    check('the box reads the span it was let go at',                       r3(Drag.Na__LeTools__GetDimEndRetype().spanMm), 14);
    Drag.Na__LeTools__TypeDimensionSpan(30);
    const D2 = find(SHEET.Sheet__Dimensions, 'Dimension__Id', 'D2');
    check('a typed span then sets it, the other end fixed',               [ D2.Dimension__StartXMm, r3(D2.Dimension__EndXMm), D2.Dimension__EndYMm ], [ 0, 30, 400 ]);

// endregion -------------------------------------------------------------------


    console.log(failures ? '\n  ' + failures + ' check(s) FAILED.' : '\n  Every check passed.');
    process.exit(failures ? 1 : 0);
