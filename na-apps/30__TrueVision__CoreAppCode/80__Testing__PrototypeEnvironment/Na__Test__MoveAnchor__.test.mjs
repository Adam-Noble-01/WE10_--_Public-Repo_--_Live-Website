// =============================================================================
// TRUEVISION3D - TEST - THE MOVE ANCHOR (CTRL+CLICK: MOVE FROM THIS POINT TO THAT POINT)
// =============================================================================
//
// FILE       : Na__Test__MoveAnchor__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Move Anchor Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove Ctrl+click's red cross: where it comes up, how it is re-placed and kept, and that a move of its item is carried by it alone
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE CROSS ITSELF (Na__LayoutEditor__MoveAnchor__, as shipped): it comes up
//   in the middle of the item's box; it is there only while that one item is
//   the selection, in the same container, on the same sheet; a press within
//   GrabRadiusPx on screen takes it; dragged, it snaps to object snap, to the
//   item's own box and to the grid, and an arrow key or Shift holds it to an
//   axis; let go, it is kept as a place ON the box, so it rides with the item
//   and stays on its corner when the item is resized; a move carried by it
//   lands the cross, and only the cross, on the snap, nothing that moves with
//   it being a target; a copy made on the way keeps a cross of its own.
// - THE DRAG (Na__LayoutEditor__SheetTools__PointerDrag__, as shipped, its
//   imports stubbed and the real cross wired in): a whole-object move and a
//   set move whose press found the cross are carried by it - the snap the
//   move would otherwise make is never asked - the Measurements box reads the
//   cross's travel, and the release announces once; the cross's own drag
//   moves nothing and announces nothing.
// - THE PRESS (Na__LayoutEditor__SheetTools__PointerPress__, as shipped): a
//   Ctrl+click on one item puts the cross on it and picks the Move tool up; a
//   Ctrl+click added to another selection, a plain click and a Ctrl-DRAG (a
//   copy) do not; a press on the cross takes the cross and leaves the
//   selection alone; a double click on it puts it back in the middle.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched (the Ortho and Move Retype tests' loader).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__MoveAnchor__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the move anchor (Na__LayoutEditor__MoveAnchor__ 1.0.0,
//   PointerPress 1.8.0, PointerDrag 1.19.0, KeyMap 1.10.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const CONFIG     = JSON.parse(readFileSync(resolve(SRC, '51__System__LayoutEditor/28__System__ObjectSnap/Na__LayoutEditor__MoveAnchor__Config__.json'), 'utf8'));

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
    // One element kind is enough: the cross's div, and the layer it sits in.
    const element = () => {
        const classes = new Set();
        return {
            className : '', innerHTML : '', hidden : false, parentNode : null, style : {}, children : [],
            classList : { add : (c) => classes.add(c), remove : (c) => classes.delete(c), contains : (c) => classes.has(c), toggle : (c, on) => { if (on) classes.add(c); else classes.delete(c); return !!on; } },
            appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
        };
    };
    globalThis.document = { body : { classList : { add : () => {}, remove : () => {}, toggle : () => {} } }, createElement : () => element() };
    globalThis.fetch = async () => ({ ok : true, json : async () => CONFIG });   // <-- The shipped config, whatever URL the loaded copy asks for

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const IMPORT = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

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
        const tmp = join(tmpdir(), 'Na__Test__MoveAnchor__' + process.pid + '__' + loadCount + '__.mjs');
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
    const r3  = (v) => Math.round(v * 1000) / 1000;
    const pt  = (p) => (p ? { x : r3(p.x), y : r3(p.y) } : p);
    const pts = (list) => list.map((p) => [ r3(p[0]), r3(p[1]) ]);

    console.log('TrueVision3D - the move anchor: Ctrl+click, then move from this point to that point');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet, the Shared State and the Cross
// -----------------------------------------------------------------------------

    const SHEET = { Sheet__Id : 'Sheet_T1', Sheet__Shapes : [], Sheet__Annotations : [], Sheet__Leaders : [], Sheet__Dimensions : [], Sheet__Viewports : [] };
    const find  = (list, key, id) => list.find((r) => r[key] === id) || null;
    const boxOf = (points) => {
        const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
        return { X : Math.min(...xs), Y : Math.min(...ys), WidthMm : Math.max(...xs) - Math.min(...xs), HeightMm : Math.max(...ys) - Math.min(...ys) };
    };
    const record = (sheet, found) => {
        if (!found) return null;
        if (found.kind === 'annotation') return find(sheet.Sheet__Annotations, 'Annotation__Id', found.id);
        if (found.kind === 'shape')      return find(sheet.Sheet__Shapes, 'Shape__Id', found.id);
        if (found.kind === 'viewport')   return find(sheet.Sheet__Viewports, 'Viewport__Id', found.id);
        return null;
    };

    const st = {
        sheet : SHEET, selection : [], scope : [], axis : null, zoom : 1, snap : null, grid : 0, tool : 'select',
        drag : null, lastPoint : null, shift : false, moveRetype : null, lastPress : null, travelled : false,
        stage : { classList : { contains : () => false }, releasePointerCapture : () => {}, setPointerCapture : () => {}, style : {} }
    };
    const seen = { markers : [], bands : [], said : [], finds : [], announce : [], picks : 0, hides : 0 };
    const LAYER = element();

    // The object snap: one point on the sheet (st.snap), found within 2 mm of where it is looked for
    const find2 = (sheet, p, exclude) => {
        seen.finds.push({ at : pt(p), exclude : exclude });
        if (!st.snap) return null;
        const d = Math.hypot(p.x - st.snap.x, p.y - st.snap.y);
        return d <= 2 ? { x : st.snap.x, y : st.snap.y, kind : 'end', target : 'shape', score : d } : null;
    };
    const grid = (p) => (st.grid ? { x : Math.round(p.x / st.grid) * st.grid, y : Math.round(p.y / st.grid) * st.grid, kind : 'grid', target : 'grid', score : 0 } : null);

    const Anchor = await load('51__System__LayoutEditor/28__System__ObjectSnap/Na__LayoutEditor__MoveAnchor__.js', {
        Na__LeModel__GetSelectionItems : () => st.selection.map((i) => ({ kind : i.kind, id : i.id })),
        Na__LeSurface__GetElements     : () => ({ handles : LAYER }),
        Na__LeSurface__GetPixelsPerMm  : () => 1,
        Na__LeSurface__GetZoom         : () => st.zoom,
        Na__LeGroup__ItemsBounds       : (sheet, items) => { const r = record(sheet, items[0]); return r && r.Shape__Points ? boxOf(r.Shape__Points) : (r && r.Viewport__FrameMm ? Object.assign({}, r.Viewport__FrameMm) : null); },
        Na__LeOsnap__KIND_END : 'end', Na__LeOsnap__KIND_MID : 'mid', Na__LeOsnap__KIND_CEN : 'cen',
        Na__LeOsnap__TARGET_VIEWPORT : 'viewport', Na__LeOsnap__TARGET_SHAPE : 'shape', Na__LeOsnap__TARGET_TEXT : 'text', Na__LeOsnap__TARGET_DIMENSION : 'dimension',
        Na__LeOsnap__IsEnabled   : () => true,
        Na__LeOsnap__RadiusMm    : () => 2,
        Na__LeOsnap__Find        : find2,
        Na__LeOsnap__FindGrid    : grid,
        Na__LeOsnap__ShowMarker  : (hit) => { seen.markers.push({ x : r3(hit.x), y : r3(hit.y), kind : hit.kind }); },
        Na__LeOsnap__HideMarker  : () => { seen.hides++; },
        Na__LeOsnap__IsModeOn    : () => true,
        Na__LeAxis__AXIS_X : 'x', Na__LeAxis__AXIS_Y : 'y',
        Na__LeAxis__Get          : () => st.axis,
        Na__LeGrips__ShowBand    : (a, b, axis) => { seen.bands.push({ from : pt(a), to : pt(b), axis : axis || null }); return true; },
        Na__LeGrips__HideBand    : () => {},
        Na__LeScope__Path        : () => st.scope.slice(),
        Na__LeMeasure__Say       : (text) => { seen.said.push(text); return true; }
    });
    await Anchor.Na__LeAnchor__Ready();
    const cross = () => LAYER.children[0] || null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Cross Itself
// -----------------------------------------------------------------------------

    console.log('\n  It comes up in the middle, and only while its one item is the selection');
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S1', Shape__LayerId : 'L', Shape__Points : [ [ 10, 20 ], [ 50, 20 ], [ 50, 50 ], [ 10, 50 ] ] });
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S2', Shape__LayerId : 'L', Shape__Points : [ [ 200, 0 ], [ 240, 0 ], [ 240, 30 ], [ 200, 30 ] ] });
    const S1 = { kind : 'shape', id : 'S1' };
    st.selection = [ S1 ];
    check('Arm: the middle of the box (10..50 across, 20..50 down)',      pt(Anchor.Na__LeAnchor__Arm(SHEET, S1)), { x : 30, y : 35 });
    check('...drawn there: one transform, counter-scaled, a 26 px cross', [ cross().hidden, cross().style.transform, cross().style.width ], [ false, 'translate(30px, 35px) scale(1) translate(-50%, -50%)', '26px' ]);
    check('...and it says what to do (the config\'s words)',               seen.said[seen.said.length - 1], CONFIG.LayoutEditor__MoveAnchor__Labels.Labels__Armed);
    check('it holds that item and that selection of one',                 [ Anchor.Na__LeAnchor__Holds(SHEET, S1), Anchor.Na__LeAnchor__HoldsItems(SHEET, [ S1 ]), Anchor.Na__LeAnchor__Holds(SHEET, { kind : 'shape', id : 'S2' }) ], [ true, true, false ]);
    st.selection = [ S1, { kind : 'shape', id : 'S2' } ];
    check('another item added: no cross (Ctrl only ever adds)',           [ Anchor.Na__LeAnchor__Point(SHEET), Anchor.Na__LeAnchor__HoldsItems(SHEET, st.selection) ], [ null, false ]);
    Anchor.Na__LeAnchor__Refresh(SHEET);
    check('...and the repaint drops it for good',                         [ cross().hidden, (st.selection = [ S1 ], Anchor.Na__LeAnchor__Point(SHEET)) ], [ true, null ]);
    Anchor.Na__LeAnchor__Arm(SHEET, S1);
    st.scope = [ { kind : 'group', id : 'G1' } ];
    check('a container opened since: gone',                               Anchor.Na__LeAnchor__Point(SHEET), null);
    st.scope = [];
    check('...closed again: the same container as when it was set',       pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 30, y : 35 });
    check('another sheet: gone',                                          Anchor.Na__LeAnchor__Point(Object.assign({}, SHEET, { Sheet__Id : 'Sheet_T2' })), null);

    console.log('\n  A press takes it within GrabRadiusPx on screen');
    check('9 px off at 100%: on it; 11 px: not',                          [ Anchor.Na__LeAnchor__HitAt(SHEET, { x : 39, y : 35 }), Anchor.Na__LeAnchor__HitAt(SHEET, { x : 41, y : 35 }) ], [ true, false ]);
    st.zoom = 2;
    check('zoomed to 200%: 6 mm is 12 px, off it; 4 mm is on it',         [ Anchor.Na__LeAnchor__HitAt(SHEET, { x : 36, y : 35 }), Anchor.Na__LeAnchor__HitAt(SHEET, { x : 34, y : 35 }) ], [ false, true ]);
    st.zoom = 1;
    check('Grab: the cross\'s drag record, from where the cross is',       Anchor.Na__LeAnchor__Grab(SHEET, { x : 31, y : 36 }), { kind : 'moveanchor', fromMm : { x : 30, y : 35 } });
    check('...and nothing off it',                                        Anchor.Na__LeAnchor__Grab(SHEET, { x : 60, y : 35 }), null);

    console.log('\n  Dragged, it snaps - its own box included - and is kept ON the box');
    const reloc = (press, to) => {                                           // <-- One re-placing drag, let go as a click so the cross stays where it was
        const at = Anchor.Na__LeAnchor__Relocate(SHEET, Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, press), { startMm : press, moved : true }), to, false);
        Anchor.Na__LeAnchor__Finish(SHEET, { kind : 'moveanchor', moved : false });
        return at;
    };
    let drag = Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, { x : 31, y : 36 }), { startMm : { x : 31, y : 36 }, moved : true });
    check('near the box\'s top-right corner, nothing else about: the corner', pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 50.5, y : 21.4 }, false)), { x : 50, y : 20 });
    check('...the marker says an endpoint, the band runs from the middle', [ seen.markers[seen.markers.length - 1], seen.bands[seen.bands.length - 1] ], [ { x : 50, y : 20, kind : 'end' }, { from : { x : 30, y : 35 }, to : { x : 50, y : 20 }, axis : null } ]);
    check('...the search excluded nothing: its own vertices count',       seen.finds[seen.finds.length - 1].exclude, null);
    check('...the cross is drawn where it is going',                      cross().style.transform, 'translate(50px, 20px) scale(1) translate(-50%, -50%)');
    check('near the middle of the right-hand side: the midpoint',          pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 50.6, y : 35.9 }, false)), { x : 50, y : 35 });
    st.snap = { x : 49.2, y : 21.3 };
    check('a point of the drawing nearer than the corner wins',           pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 49.5, y : 21.4 }, false)), { x : 49.2, y : 21.3 });
    st.snap = null;
    Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 50.5, y : 21.4 }, false);
    Anchor.Na__LeAnchor__Finish(SHEET, drag);
    check('let go on the corner: kept there',                             pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 50, y : 20 });
    check('...and says so',                                               seen.said[seen.said.length - 1], CONFIG.LayoutEditor__MoveAnchor__Labels.Labels__Placed);
    find(SHEET.Sheet__Shapes, 'Shape__Id', 'S1').Shape__Points = [ [ 110, 70 ], [ 150, 70 ], [ 150, 100 ], [ 110, 100 ] ];
    check('the item moved (a nudge, an undo, a typed move): the cross rode with it', pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 150, y : 70 });
    find(SHEET.Sheet__Shapes, 'Shape__Id', 'S1').Shape__Points = [ [ 110, 70 ], [ 190, 70 ], [ 190, 100 ], [ 110, 100 ] ];
    check('the item made wider: still on its top-right corner',            pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 190, y : 70 });
    find(SHEET.Sheet__Shapes, 'Shape__Id', 'S1').Shape__Points = [ [ 10, 20 ], [ 50, 20 ], [ 50, 50 ], [ 10, 50 ] ];
    const noMove = Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, { x : 50, y : 20 }), { startMm : { x : 50, y : 20 }, moved : false });
    Anchor.Na__LeAnchor__Finish(SHEET, noMove);
    check('a click on the cross that never moved leaves it where it was',  pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 50, y : 20 });

    console.log('\n  An arrow key, Shift or the grid hold it while it is re-placed');
    Anchor.Na__LeAnchor__Recentre(SHEET);
    check('Recentre: back in the middle',                                 pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 30, y : 35 });
    st.axis = 'x';
    check('left/right arrow: held level with where it was',               pt(reloc({ x : 30, y : 35 }, { x : 44.3, y : 61 })), { x : 44.3, y : 35 });
    check('...the band takes the axis colour',                            seen.bands[seen.bands.length - 1].axis, 'x');
    st.snap = { x : 70, y : 90 };
    check('...a corner across the sheet gives only x',                    pt(reloc({ x : 30, y : 35 }, { x : 70.5, y : 90.5 })), { x : 70, y : 35 });
    st.snap = null; st.axis = null;
    drag = Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, { x : 30, y : 35 }), { startMm : { x : 30, y : 35 }, moved : true });
    check('Shift (or Ortho): the nearer axis',                            pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 30.7, y : 70 }, true)), { x : 30, y : 70 });
    st.grid = 5;
    check('Grid Snap, nothing else in reach: a grid point',               pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 76.2, y : 83.1 }, false)), { x : 75, y : 85 });
    check('...held down the paper, the grid gives only y',                pt(Anchor.Na__LeAnchor__Relocate(SHEET, drag, { x : 31.2, y : 83.1 }, true)), { x : 30, y : 85 });
    st.grid = 0;
    Anchor.Na__LeAnchor__Finish(SHEET, Object.assign(drag, { moved : false }));
    Anchor.Na__LeAnchor__Recentre(SHEET);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Move Carried by the Cross
// -----------------------------------------------------------------------------

    console.log('\n  A move is carried by the cross alone');
    const carryDrag = { kind : 'shape', id : 'S1', mode : 'whole', anchorMm : { x : 50, y : 20 }, anchorPlace : { fx : 1, fy : 0, ox : 40, oy : 0 } };
    st.snap = { x : 240, y : 0 };                                            // <-- S2's top-right corner
    check('dragged near S2\'s corner: the move puts the cross EXACTLY on it', pt(Anchor.Na__LeAnchor__Carry(SHEET, carryDrag, { x : 189.2, y : -18.7 }, false)), { x : 190, y : -20 });
    check('...looking from where the cross would be, the item left out',  seen.finds[seen.finds.length - 1], { at : { x : 239.2, y : 1.3 }, exclude : { kind : 'shape', id : 'S1' } });
    check('...the band: from this point to that point',                   seen.bands[seen.bands.length - 1], { from : { x : 50, y : 20 }, to : { x : 240, y : 0 }, axis : null });
    check('...and the cross drawn on the corner, carrying',                [ cross().style.transform, cross().classList.contains('na-le-move-anchor--carrying') ], [ 'translate(240px, 0px) scale(1) translate(-50%, -50%)', true ]);
    check('the corner out of reach: the move is the cursor\'s, as it was',  pt(Anchor.Na__LeAnchor__Carry(SHEET, carryDrag, { x : 150, y : -18.7 }, false)), { x : 150, y : -18.7 });
    st.axis = 'x';
    check('an arrow lock: along it only, the snap giving x',              pt(Anchor.Na__LeAnchor__Carry(SHEET, carryDrag, { x : 189.2, y : -18.7 }, false)), { x : 190, y : 0 });
    st.axis = null; st.snap = null;
    const groupDrag = { kind : 'group', group : [ { kind : 'shape', id : 'S1' }, { kind : 'annotation', id : 'T9' } ], anchorMm : { x : 30, y : 35 } };
    Anchor.Na__LeAnchor__Carry(SHEET, groupDrag, { x : 5, y : 5 }, false);
    check('a set moved as one: every member of it left out of the search', seen.finds[seen.finds.length - 1].exclude, groupDrag.group);
    st.selection = [ { kind : 'shape', id : 'S1_Copy' } ];                   // <-- A Ctrl-drag copy is selected as it lands
    SHEET.Sheet__Shapes.push({ Shape__Id : 'S1_Copy', Shape__LayerId : 'L', Shape__Points : [ [ 200, -20 ], [ 240, -20 ], [ 240, 10 ], [ 200, 10 ] ] });
    Anchor.Na__LeAnchor__Finish(SHEET, carryDrag);
    check('a copy carried by the cross keeps a cross of its own, on the same corner', [ Anchor.Na__LeAnchor__Holds(SHEET, { kind : 'shape', id : 'S1_Copy' }), pt(Anchor.Na__LeAnchor__Point(SHEET)) ], [ true, { x : 240, y : -20 } ]);
    check('...no longer drawn as carrying',                                cross().classList.contains('na-le-move-anchor--carrying'), false);
    check('Clear forgets it',                                              [ Anchor.Na__LeAnchor__Clear(), Anchor.Na__LeAnchor__Point(SHEET), cross().hidden ], [ true, null, true ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Pointer Drag Unit, With the Real Cross Wired In
// -----------------------------------------------------------------------------

    defineLive('Na__LeTools__Drag',         () => st.drag);
    defineLive('Na__LeTools__LastPointMm',  () => st.lastPoint);
    defineLive('Na__LeTools__ShiftHeld',    () => st.shift);
    defineLive('Na__LeTools__VertexRetype', () => null);
    defineLive('Na__LeTools__DimEndRetype', () => null);
    defineLive('Na__LeTools__MoveRetype',   () => st.moveRetype);
    defineLive('Na__LeTools__Stage',        () => st.stage);
    defineLive('Na__LeTools__Editable',     () => true);
    defineLive('Na__LeTools__Suppressed',   () => false);
    defineLive('Na__LeTools__Tool',         () => st.tool);
    defineLive('Na__LeTools__LastPress',    () => st.lastPress);
    defineLive('Na__LeTools__PressTravelled', () => st.travelled);

    const AnchorStubs = {};
    Object.keys(Anchor).forEach((name) => { AnchorStubs[name] = Anchor[name]; });
    const Drag = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__PointerDrag__.js', Object.assign({
        Na__LeTools__TOOL_SELECT : 'select', Na__LeTools__TOOL_DIMENSION : 'dimension', Na__LeTools__TOOL_DRAW : 'draw', Na__LeTools__TOOL_RECT : 'rectangle',
        Na__LeTools__TOOL_EYEDROP : 'eyedropper', Na__LeTools__TOOL_LEADER : 'leader', Na__LeTools__TOOL_AREA : 'area', Na__LeTools__TOOL_REGION : 'region',
        Na__LeTools__PICK_TOOLS : [ 'select', 'move' ], Na__LeTools__TYPED_MIN_MM : 1e-4, Na__LeTools__SAME_MM : 1e-9,
        Na__LeTools__WriteDrag        : (d) => { st.drag = d; },
        Na__LeTools__WriteLastPointMm : (p) => { st.lastPoint = p; },
        Na__LeTools__WriteShiftHeld   : (s) => { st.shift = s; },
        Na__LeTools__WriteMoveRetype  : (r) => { st.moveRetype = r; },
        Na__LeTools__WritePressTravelled : (t) => { st.travelled = t; },
        Na__LeCfg__GetSelectionSetup  : () => ({ dragThresholdMm : 0.5, pickDragPx : 4 }),
        Na__LeModel__GetActiveSheet   : () => st.sheet,
        Na__LeModel__GetSelectionItems : () => st.selection.map((i) => ({ kind : i.kind, id : i.id })),
        Na__LeModel__GetSelection     : () => (st.selection.length === 1 ? st.selection[0] : null),
        Na__LeModel__GetShapeById     : (sheet, id) => find(sheet.Sheet__Shapes, 'Shape__Id', id),
        Na__LeModel__UpdateShape      : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Shapes, 'Shape__Id', id); if (r && patch.points) r.Shape__Points = patch.points.map((p) => [ p[0], p[1] ]); if (!silent) seen.announce.push('shape:' + id); return true; },
        Na__LeModel__UpdateAnnotation : (sheet, id, patch, silent) => { const r = find(sheet.Sheet__Annotations, 'Annotation__Id', id); if (r && Number.isFinite(patch.posXMm)) { r.Annotation__PosXMm = patch.posXMm; r.Annotation__PosYMm = patch.posYMm; } if (!silent) seen.announce.push('annotation:' + id); return true; },
        Na__LeSurface__ClientToPaperMm : (x, y) => ({ x : x, y : y }),
        Na__LeSurface__GetZoom        : () => 1,
        Na__LeSurface__GetPixelsPerMm : () => 1,
        Na__LeShapeGeo__Points        : (shape) => shape.Shape__Points,
        Na__LeShapeGeo__Translated    : (points, dx, dy) => points.map((p) => [ p[0] + dx, p[1] + dy ]),
        Na__LeOrtho__Resolve          : (shift) => shift === true,
        Na__LeOsnap__GridDragDelta    : (sheet, d, dMm) => { seen.gridAsked = true; return dMm; },
        Na__LeOsnap__ShapeTranslation : () => { seen.shapeSnapAsked = true; return { x : 999, y : 999 }; },   // <-- Never asked of a move carried by the cross
        Na__LeOsnap__GroupTranslation : () => { seen.groupSnapAsked = true; return { x : 999, y : 999 }; },
        Na__LeAxis__Get               : () => st.axis,
        Na__LeTools__Record           : record,
        Na__LeSelSet__Apply           : (sheet, group, dx, dy) => { group.forEach((e) => { const r = record(sheet, e); if (e.kind === 'shape') r.Shape__Points = e.start.points.map((p) => [ p[0] + dx, p[1] + dy ]); }); return true; },
        Na__LeSelSet__Commit          : (sheet, group) => { seen.announce.push('group:' + group.length); return true; },
        Na__LeSelBox__Move            : () => false,
        Na__LeSelBox__IsActive        : () => false
    }, AnchorStubs), [ 'Na__LeTools__Drag', 'Na__LeTools__LastPointMm', 'Na__LeTools__ShiftHeld', 'Na__LeTools__VertexRetype', 'Na__LeTools__DimEndRetype',
                       'Na__LeTools__MoveRetype', 'Na__LeTools__Stage', 'Na__LeTools__Editable', 'Na__LeTools__Suppressed', 'Na__LeTools__Tool' ]);

    const move  = (x, y, shift) => Drag.Na__LeTools__OnMove({ clientX : x, clientY : y, pointerId : 1, shiftKey : !!shift, buttons : 1, pointerType : 'mouse' });
    const up    = (x, y) => Drag.Na__LeTools__OnUp({ clientX : x, clientY : y, pointerId : 1, type : 'pointerup' });
    const press = (d) => { st.drag = Object.assign({ moved : false, pointerId : 1 }, d); return st.drag; };

    console.log('\n  The drag unit: a whole-object move by the cross');
    const S1_AT = [ [ 10, 20 ], [ 50, 20 ], [ 50, 50 ], [ 10, 50 ] ];
    const s1 = () => find(SHEET.Sheet__Shapes, 'Shape__Id', 'S1');
    s1().Shape__Points = S1_AT.map((p) => p.slice());
    st.selection = [ S1 ];
    Anchor.Na__LeAnchor__Arm(SHEET, S1);
    Anchor.Na__LeAnchor__Relocate(SHEET, Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, { x : 30, y : 35 }), { startMm : { x : 30, y : 35 } }), { x : 50.4, y : 20.6 }, false);
    Anchor.Na__LeAnchor__Finish(SHEET, { kind : 'moveanchor', moved : true });
    check('the cross put on S1\'s top-right corner first',                pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 50, y : 20 });
    const held = Anchor.Na__LeAnchor__ForDrag(SHEET, [ S1 ]);
    check('ForDrag: the cross, and its place on the box, for the drag',    held, { x : 50, y : 20, fx : 1, fy : 0, ox : 40, oy : 0 });
    check('...and nothing for a selection it is not on',                   Anchor.Na__LeAnchor__ForDrag(SHEET, [ { kind : 'shape', id : 'S2' } ]), null);
    seen.shapeSnapAsked = false; seen.gridAsked = false; seen.announce.length = 0;
    st.snap = { x : 240, y : 0 };
    press({ kind : 'shape', mode : 'whole', id : 'S1', start : S1_AT.map((p) => p.slice()), startMm : { x : 20, y : 40 }, anchorMm : { x : 50, y : 20 }, anchorPlace : { fx : 1, fy : 0, ox : 40, oy : 0 } });
    move(100, 30); move(209.3, 21.1);                                        // <-- Pressed in the item, far from the cross; the cross comes to 239.3, 1.1
    check('grabbed anywhere on it: the cross lands on S2\'s corner, the rest follows', pts(s1().Shape__Points), [ [ 200, 0 ], [ 240, 0 ], [ 240, 30 ], [ 200, 30 ] ]);
    check('...the move\'s own snap and the grid step were never asked',    [ seen.shapeSnapAsked, seen.gridAsked ], [ false, false ]);
    check('...the box reads the cross\'s travel: from 50,20 to 240,0',      (() => { const r = Drag.Na__LeTools__GetMoveDrag(); return r ? r3(Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y)) : null; })(), r3(Math.hypot(190, 20)));
    up(209.3, 21.1);
    check('let go: announced once, one undo step',                          seen.announce, [ 'shape:S1' ]);
    check('...and the cross is read off the item again, on its corner',     pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 240, y : 0 });
    st.snap = null;

    console.log('\n  The drag unit: a set moved as one by the cross');
    s1().Shape__Points = S1_AT.map((p) => p.slice());
    seen.groupSnapAsked = false; seen.announce.length = 0;
    st.snap = { x : 100, y : 100 };
    press({ kind : 'group', group : [ { kind : 'shape', id : 'S1', start : { points : S1_AT.map((p) => p.slice()) } } ], startMm : { x : 20, y : 40 }, anchorMm : { x : 30, y : 35 }, anchorPlace : { fx : 0.5, fy : 0.5, ox : 20, oy : 15 } });
    move(89.1, 104.6);                                                       // <-- The cross comes to 99.1, 99.6
    check('the middle of the set lands on the point',                      pts(s1().Shape__Points)[0], [ 80, 85 ]);
    check('...the set\'s own snap never asked',                             seen.groupSnapAsked, false);
    up(89.1, 104.6);
    check('...announced once for the set',                                  seen.announce, [ 'group:1' ]);
    st.snap = null;

    console.log('\n  The drag unit: the cross\'s own drag');
    s1().Shape__Points = S1_AT.map((p) => p.slice());
    st.selection = [ S1 ];
    Anchor.Na__LeAnchor__Arm(SHEET, S1);
    seen.announce.length = 0;
    press(Object.assign(Anchor.Na__LeAnchor__Grab(SHEET, { x : 30, y : 35 }), { startMm : { x : 30, y : 35 }, click : null }));
    check('IsAnchorDrag names it; it is no move of the item',              [ Drag.Na__LeTools__IsAnchorDrag(), Drag.Na__LeTools__IsMoveDrag() ], [ true, false ]);
    move(20, 40); move(10.8, 49.3);
    check('re-placed on the bottom-left corner; the item did not move',    [ pt(Anchor.Na__LeAnchor__Point(SHEET)), pts(s1().Shape__Points) ], [ { x : 10, y : 50 }, S1_AT ]);
    st.axis = 'y';
    check('an arrow key mid-drag holds it at once, plumb below the middle, the corner giving y', [ Drag.Na__LeTools__RerunAnchorDrag(), pt(Anchor.Na__LeAnchor__Point(SHEET)) ], [ true, { x : 30, y : 50 } ]);
    st.axis = null;
    move(10.8, 49.3);
    up(10.8, 49.3);
    check('let go: nothing announced - the cross is not part of the drawing', seen.announce, []);
    check('...kept on that corner',                                         pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 10, y : 50 });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Pointer Press Unit: the Ctrl+Click
// -----------------------------------------------------------------------------

    console.log('\n  The press unit: Ctrl+click puts the cross on one item');
    const combine = (had, items, how) => {
        const out = had.map((i) => ({ kind : i.kind, id : i.id }));
        items.forEach((i) => { const at = out.findIndex((o) => o.kind === i.kind && o.id === i.id); if (how === 'add' && at === -1) out.push({ kind : i.kind, id : i.id }); if (how === 'remove' && at !== -1) out.splice(at, 1); });
        return out;
    };
    // A selection change is announced, and the sheet tools' repaint puts the cross right on it (DropperDraw)
    const select = (items) => { st.selection = items.map((i) => ({ kind : i.kind, id : i.id })); Anchor.Na__LeAnchor__Refresh(st.sheet); return st.selection; };
    const Press = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SheetTools__PointerPress__.js', Object.assign({
        Na__LeTools__TOOL_MOVE : 'move', Na__LeTools__PICK_TOOLS : [ 'select', 'move' ],
        Na__LeTools__WriteDrag          : (d) => { st.drag = d; },
        Na__LeTools__WriteLastPress     : (p) => { st.lastPress = p; },
        Na__LeTools__WritePressTravelled : (t) => { st.travelled = t; },
        Na__LeCfg__MatchSelectionModifier : (held) => ({ combine : held.Ctrl ? (held.Shift ? 'remove' : 'add') : (held.Shift ? 'toggle' : null), anywhere : false, copy : !!held.Ctrl, anchor : !!held.Ctrl && !held.Shift && !held.Alt }),
        Na__LeCfg__GetSelectionSetup    : () => ({ doubleClickMs : 500, doubleClickSlopPx : 4 }),
        Na__LeCfg__GetGuards            : () => ({ paperSelector : '.paper' }),
        Na__LeModel__GetActiveSheet     : () => st.sheet,
        Na__LeModel__IsLayerLocked      : () => false,
        Na__LeModel__IsSelected         : (kind, id) => st.selection.some((i) => i.kind === kind && i.id === id),
        Na__LeModel__GetSelectionItems  : () => st.selection.map((i) => ({ kind : i.kind, id : i.id })),
        Na__LeModel__SetSelection       : (item) => select(item ? [ item ] : []),
        Na__LeModel__SetSelectionItems  : (items) => select(items),
        Na__LeSurface__ClientToPaperMm  : (x, y) => ({ x : x, y : y }),
        Na__LeSelBox__COMBINE_ADD : 'add', Na__LeSelBox__COMBINE_REMOVE : 'remove',
        Na__LeSelBox__Combine           : combine,
        Na__LeTools__Resolve            : (sheet, p) => { const hit = SHEET.Sheet__Shapes.find((s) => { const b = boxOf(s.Shape__Points); return p.x >= b.X && p.x <= b.X + b.WidthMm && p.y >= b.Y && p.y <= b.Y + b.HeightMm; }); return hit ? { kind : 'shape', id : hit.Shape__Id } : null; },
        Na__LeTools__Record             : record,
        Na__LeTools__Tolerance          : () => 1,
        Na__LeTools__CanMoveWhole       : () => st.tool === 'move',
        Na__LeTools__PicksUpMove        : () => true,
        Na__LeTools__PickUpMove         : () => { seen.picks++; if (st.tool === 'select') st.tool = 'move'; return true; },
        Na__LeTools__PutDownMove        : () => false,
        Na__LeTools__ShapeGrabFor       : () => ({ mode : 'whole', index : -1 }),
        Na__LeTools__ShapeGrabPoint     : (shape, p) => p,
        Na__LeShapeGeo__Points          : (shape) => shape.Shape__Points,
        Na__LeTools__IsMoveDrag         : Drag.Na__LeTools__IsMoveDrag,
        Na__LeTools__IsViewportMoveDrag : Drag.Na__LeTools__IsViewportMoveDrag
    }, AnchorStubs), [ 'Na__LeTools__Drag', 'Na__LeTools__Stage', 'Na__LeTools__Editable', 'Na__LeTools__Suppressed', 'Na__LeTools__Tool', 'Na__LeTools__LastPress', 'Na__LeTools__PressTravelled' ]);

    let clock = 1000;
    const down = (x, y, keys) => Press.Na__LeTools__OnDown(Object.assign({ button : 0, pointerType : 'mouse', pointerId : 1, clientX : x, clientY : y, timeStamp : (clock += 900), target : null, preventDefault : () => {} }, keys || {}));
    const click = (x, y, keys) => { down(x, y, keys); up(x, y); };
    const S2 = { kind : 'shape', id : 'S2' };
    s1().Shape__Points = S1_AT.map((p) => p.slice());
    Anchor.Na__LeAnchor__Clear();
    select([]); st.tool = 'select'; seen.picks = 0;
    click(15, 45, { ctrlKey : true });
    check('Ctrl+click on S1, nothing selected: S1 alone, the cross in its middle', [ st.selection, pt(Anchor.Na__LeAnchor__Point(SHEET)) ], [ [ S1 ], { x : 30, y : 35 } ]);
    check('...and the Move tool came up with it',                           [ seen.picks > 0, st.tool ], [ true, 'move' ]);
    click(220, 10, { ctrlKey : true });
    check('Ctrl+click on S2 with S1 selected: added, as Ctrl always has - no cross', [ st.selection, Anchor.Na__LeAnchor__Point(SHEET) ], [ [ S1, S2 ], null ]);
    select([ S1 ]); st.tool = 'select';
    click(15, 45);
    check('a plain click on S1: no cross',                                   Anchor.Na__LeAnchor__Point(SHEET), null);
    click(15, 45, { ctrlKey : true });
    check('Ctrl+click on S1, the one thing selected: the cross',             pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 30, y : 35 });
    down(30, 35);
    check('a press on the cross: the cross\'s drag, the selection untouched', [ st.drag && st.drag.kind, st.selection ], [ 'moveanchor', [ S1 ] ]);
    move(40, 45); move(50.3, 50.4); up(50.3, 50.4);
    check('...dragged to the bottom-right corner and let go: kept there',     pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 50, y : 50 });
    click(15, 45, { ctrlKey : true });
    check('Ctrl+click S1 again: the cross back in the middle',               pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 30, y : 35 });
    down(30, 35); move(50.3, 50.4); up(50.3, 50.4);
    st.travelled = false;
    Press.Na__LeTools__OnDoubleClick({ button : 0, clientX : 50, clientY : 50, preventDefault : () => {} });
    check('a double click on the cross: back in the middle',                 pt(Anchor.Na__LeAnchor__Point(SHEET)), { x : 30, y : 35 });
    Anchor.Na__LeAnchor__Clear();
    select([]); st.tool = 'move';
    down(15, 45, { ctrlKey : true });
    check('a Ctrl press that starts a move marks it a copy',                  !!(st.drag && st.drag.copy), true);
    move(25, 45); up(25, 45);
    check('...dragged: a copy, never a cross',                               Anchor.Na__LeAnchor__Point(SHEET), null);
    s1().Shape__Points = S1_AT.map((p) => p.slice());
    select([]); st.tool = 'move';
    click(15, 45, { ctrlKey : true, shiftKey : true });
    check('Ctrl+Shift+click: never a cross (it removes)',                    Anchor.Na__LeAnchor__Point(SHEET), null);
    select([ S1 ]);
    click(15, 45, { ctrlKey : true });
    down(20, 45);                                                            // <-- A press on S1 away from the cross, under the Move tool
    check('a press on the item with the cross: a move carried by it',         [ st.drag && st.drag.kind, st.drag && pt(st.drag.anchorMm), st.drag && st.drag.anchorPlace ], [ 'shape', { x : 30, y : 35 }, { fx : 0.5, fy : 0.5, ox : 20, oy : 15 } ]);
    up(20, 45);

// endregion -------------------------------------------------------------------


    console.log(failures ? '\n  ' + failures + ' check(s) FAILED.' : '\n  Every check passed.');
    process.exit(failures ? 1 : 0);
