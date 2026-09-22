// =============================================================================
// TRUEVISION3D - TEST - CTRL-DRAG COPY (DUPLICATE AND MOVE IN ONE)
// =============================================================================
//
// FILE       : Na__Test__CopyDrag__.test.cjs
// NAMESPACE  : Na__Test
// MODULE     : Copy Drag Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a Ctrl-drag carries a clone and leaves the original where it started, silently, for every kind a move carries whole
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Runs the shipped Copy Drag unit, the item clipboard, the selection set,
//   the group helpers and the model's own DeleteItems / PruneGroups in one vm
//   context, with only the record store, the surface and the snap-move
//   boundary stubbed - the Na__Test__CrossSheetClipboard__ harness.
// - A copy made at the threshold, a copy made and taken away mid-move (the
//   original goes home first, and nothing is left behind), every whole-object
//   kind, several items with a group and a locked member, a copy made inside
//   an open group, and nothing announced until the drag's own release.
// - The key map: Ctrl is the copy modifier in the shipped file and in the
//   fallback, it is reported without being set aside, and Control is its key.
// - ARRAYS (SketchUp's 3x and /3): the parser's six spellings and its
//   refusals; an array of a text, a vector, a leader and a whole selection
//   made from the ORIGINALS, at 2..N times or 1/N..(N-1)/N of the copy's
//   distance, a minus sign kept; a new count replacing the old one without a
//   trace; a new distance spacing them out again; copies inside an open group
//   joining it; nothing announced. The landing handed in is the pointer
//   drag's exact landing, written out for the kinds tested.
//
// USAGE:
//     node --test 80__Testing__PrototypeEnvironment/Na__Test__CopyDrag__.test.cjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.1
// - MatchSelectionModifier answers anchor too (KeyMap 1.10.0): the move
//   anchor's key, Ctrl, held on its own. The key map test expects it, and
//   that Ctrl+Shift and Ctrl+Alt never carry it.
//
// 21-Sep-2026 - Version 1.1.0
// - Arrays: the parser, the build, a replaced count, a retyped distance.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with the Ctrl-drag copy (Na__LayoutEditor__SheetTools__CopyDrag__).
//
// =============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../02__Src__AppModules/51__System__LayoutEditor');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const strip = (text) => text.replace(/\bimport\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '').replace(/\bexport\s*\{[^}]*\};?/g, '');

function loadFunctions(ctx, file, names) {
    const text = read(file);
    for (const name of names) {
        const start = text.indexOf('    function ' + name + '(');
        assert.ok(start >= 0, name);
        vm.runInContext(text.slice(start, text.indexOf('\n    // ------------------------------------------------------------', start)), ctx);
    }
}

const ROWS = {
    shape      : [ 'Shapes',      'Shape'      ],
    annotation : [ 'Annotations', 'Annotation' ],
    dimension  : [ 'Dimensions',  'Dimension'  ],
    viewport   : [ 'Viewports',   'Viewport'   ],
    leader     : [ 'Leaders',     'Leader'     ],
    group      : [ 'Groups',      'Group'      ]
};

// What each Update* patch key writes, as the sheet model maps them.
const PATCH = {
    annotation : { posXMm : 'Annotation__PosXMm', posYMm : 'Annotation__PosYMm', leaderXMm : 'Annotation__LeaderXMm', leaderYMm : 'Annotation__LeaderYMm' },
    shape      : { points : 'Shape__Points' },
    leader     : { tipXMm : 'Leader__TipXMm', tipYMm : 'Leader__TipYMm', anchorXMm : 'Leader__AnchorXMm', anchorYMm : 'Leader__AnchorYMm' },
    dimension  : { startXMm : 'Dimension__StartXMm', startYMm : 'Dimension__StartYMm', endXMm : 'Dimension__EndXMm', endYMm : 'Dimension__EndYMm' }
};

function fixture() {
    const sheet = { Sheet__Id : 'Sheet_901', ...Object.fromEntries(Object.values(ROWS).map(([ list ]) => [ 'Sheet__' + list, [] ])) };
    const stage = { style : { cursor : 'move' } };
    const state = { selection : [], serial : 0, openGroup : null, touches : [], refreshed : [], retargets : [] };
    const ctx = vm.createContext({
        console,
        Na__LeCfg__GetClipboardSetup : () => ({ pasteOffsetMm : 5, copySnapshot : true }),
        Na__LeCfg__GetLabel : (_, fallback) => fallback,
        Na__LeCfg__FormatLabel : (_, fallback) => fallback,
        Na__LePanels__GetContext : () => null,
        Na__LeModel__GetActiveSheet : () => sheet,
        Na__LeModel__GetSelectionItems : () => state.selection,
        Na__LeModel__SetSelection : (item) => { state.selection = item ? [ plain(item) ] : []; },
        Na__LeModel__SetSelectionItems : (items) => { state.selection = plain(items || []); return state.selection; },
        Na__LeModel__AssignSelectionItems : (items) => { state.selection = items; },
        Na__LeModel__Unselect : (id) => { state.selection = state.selection.filter((item) => item.id !== id); },
        Na__LeModel__AssignDirty () {},
        Na__LeModel__Touch : (reason) => { state.touches.push(reason); },
        Na__LeModel__GetLayerById : (_, id) => id ? { Layer__Id : id, Layer__Type : id, Layer__Visible : true, Layer__Locked : id === 'locked' } : null,
        Na__LeModel__IsLayerLocked : (_, id) => id === 'locked',
        Na__LeModel__ShapeLayerType : () => 'vector',
        Na__LeModel__GetGroups : (s) => s.Sheet__Groups || [],
        Na__LeModel__GetLeaders : (s) => s.Sheet__Leaders || [],
        Na__LeLayout__Solve : () => ({ Page : { WidthMm : 420, HeightMm : 297 } }),
        Na__LeDrawScale__DimensionAtScale : () => false,
        Na__LeShapeGeo__Points : (record) => record.Shape__Points,
        Na__LeShapeGeo__Translated : (points, x, y) => points.map((p) => [ p[0] + x, p[1] + y ]),
        Na__LeGroup__ItemsBounds : () => ({ X : 0, Y : 0, WidthMm : 10, HeightMm : 10 }),
        Na__LeSurface__Refresh : (reason) => { state.refreshed.push(reason); },
        Na__LeSurface__RefreshNow : (reason) => { state.refreshed.push('now:' + reason); },
        Na__LeVpMove__Retarget : (drag, fromId) => { state.retargets.push({ fromId : fromId, toId : drag.id }); return true; },
        Na__LeScope__GetGroupId : () => state.openGroup,
        Na__AppUtils__ConfirmDialog__Show : async () => true,
        Na__LeTools__Stage : stage,
        Na__LeTools__Editable : true,
        Na__LeTools__Drag : null
    });
    Object.defineProperty(ctx, 'Na__LeModel__SelectionItems', { get : () => state.selection });
    for (const [ kind, [ list, prefix ] ] of Object.entries(ROWS)) {
        ctx['Na__LeModel__Get' + prefix + 'ById'] = (s, id) => s['Sheet__' + list].find((r) => r[prefix + '__Id'] === id) || null;
        ctx['Na__LeModel__Insert' + prefix] = (s, record, silent) => {
            const copy = plain(record);
            copy[prefix + '__Id'] = prefix + '_' + (900 + (++state.serial));
            if (!copy[prefix + '__LayerId'] && kind !== 'group') copy[prefix + '__LayerId'] = 'default';
            s['Sheet__' + list].push(copy);
            if (!silent) state.touches.push(list.toLowerCase());
            return copy;
        };
        ctx['Na__LeModel__Update' + prefix] = (s, id, patch, silent) => {
            const record = s['Sheet__' + list].find((r) => r[prefix + '__Id'] === id);
            if (!record) return false;
            if (kind === 'viewport' && patch.rect) { record.Viewport__FrameMm.X = patch.rect.X; record.Viewport__FrameMm.Y = patch.rect.Y; }
            Object.entries(PATCH[kind] || {}).forEach(([ key, field ]) => { if (key in patch) record[field] = plain(patch[key]); });
            if (!silent) state.touches.push(list.toLowerCase());
            return true;
        };
    }
    // The model's own delete and prune: what a copy taken back out really leaves.
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__Groups__.js', [ 'Na__LeModel__PruneGroups', 'Na__LeModel__DeleteItems' ]);
    loadFunctions(ctx, '15__Core__Markup/Na__LayoutEditor__Groups__.js', [ 'Na__LeGroup__Descendants', 'Na__LeGroup__Expand', 'Na__LeGroup__ParentOf' ]);
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js')), ctx);
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__SelectionSet__.js')), ctx);
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__SheetTools__CopyDrag__.js')), ctx);
    const add = (kind, id, data) => {
        const [ list, prefix ] = ROWS[kind];
        sheet['Sheet__' + list].push({ [prefix + '__Id'] : id, ...plain(data || {}) });
        return { kind : kind, id : id };
    };
    const find = (kind, id) => { const [ list, prefix ] = ROWS[kind]; return sheet['Sheet__' + list].find((r) => r[prefix + '__Id'] === id) || null; };
    const count = (kind) => sheet['Sheet__' + ROWS[kind][0]].length;
    const toggle = (drag) => { ctx.Na__LeTools__Drag = drag; return ctx.Na__LeTools__ToggleCopyDrag(); };
    return { sheet, stage, state, ctx, add, find, count, toggle, sync : (drag) => ctx.Na__LeTools__SyncCopyDrag(sheet, drag) };
}

function textDrag(f, extra) {
    return Object.assign({ kind : 'annotation', id : 'T1', start : { x : 10, y : 20 }, startMm : { x : 11, y : 21 },
                           copyable : true, copy : true, roots : [ { kind : 'annotation', id : 'T1' } ], moved : true, pointerId : 1 }, extra || {});
}


test('a Ctrl press that becomes a drag clones the text in place, silently, and the drag carries the clone', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation', Annotation__Text : 'Note', Annotation__RotationDeg : 30 });
    const drag = textDrag(f);
    assert.equal(f.sync(drag), true);
    assert.equal(f.count('annotation'), 2);
    const clone = f.sheet.Sheet__Annotations[1];
    assert.notEqual(clone.Annotation__Id, 'T1');
    assert.equal(drag.id, clone.Annotation__Id, 'the drag now carries the clone');
    assert.equal(drag.original.id, 'T1');
    assert.deepEqual([ clone.Annotation__PosXMm, clone.Annotation__PosYMm ], [ 10, 20 ], 'the clone sits exactly where the original started');
    assert.equal(clone.Annotation__Text, 'Note');
    assert.equal(clone.Annotation__RotationDeg, 30);
    assert.deepEqual(f.state.selection, [ { kind : 'annotation', id : clone.Annotation__Id } ], 'the copy is what is selected');
    assert.deepEqual(f.state.touches, [], 'nothing announced: the drag release is the one undo step');
    assert.equal(f.stage.style.cursor, 'copy');
    assert.equal(f.sync(drag), false, 'already in line: nothing more to do');
    assert.equal(f.count('annotation'), 2);
});


test('no copy without the key, and a drag that is not a whole move never takes it', () => {
    const f = fixture();
    const t = f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation' });
    assert.equal(f.sync(textDrag(f, { copy : false })), false);
    assert.equal(f.count('annotation'), 1);
    const rotate = { kind : 'annotation', id : 'T1', mode : 'rotate', copyable : false, copy : false, roots : [ t ], moved : true };
    assert.equal(f.toggle(rotate), false, 'the rotate grip is not a move: the key is not taken');
    assert.equal(rotate.copy, false);
    assert.equal(f.sync(Object.assign({}, rotate, { copy : true })), false, 'and nothing is ever cloned for it');
    assert.equal(f.count('annotation'), 1);
    f.ctx.Na__LeTools__Editable = false;
    assert.equal(f.toggle(textDrag(f, { copy : false })), false, 'a read-only session copies nothing');
});


test('Ctrl mid-move: the original goes home and a clone takes its place; Ctrl again takes the clone away, leaving nothing behind', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 40, Annotation__PosYMm : 26, Annotation__LayerId : 'annotation' });   // <-- the move has already carried it here
    const drag = textDrag(f, { copy : false });
    assert.equal(f.toggle(drag), true);
    assert.equal(drag.copy, true);
    const original = f.find('annotation', 'T1');
    assert.deepEqual([ original.Annotation__PosXMm, original.Annotation__PosYMm ], [ 10, 20 ], 'the original is back where it started');
    const cloneId = drag.id;
    assert.notEqual(cloneId, 'T1');
    const clone = f.find('annotation', cloneId);
    assert.deepEqual([ clone.Annotation__PosXMm, clone.Annotation__PosYMm ], [ 10, 20 ], 'the clone starts where the original started, for the rerun to carry');
    assert.deepEqual(f.state.selection, [ { kind : 'annotation', id : cloneId } ]);

    assert.equal(f.toggle(drag), true, 'Ctrl again');
    assert.equal(drag.copy, false);
    assert.equal(f.count('annotation'), 1, 'the clone is gone');
    assert.equal(f.find('annotation', cloneId), null);
    assert.equal(drag.id, 'T1', 'the drag carries the original again');
    assert.deepEqual(f.state.selection, [ { kind : 'annotation', id : 'T1' } ]);
    assert.equal(f.stage.style.cursor, 'move', 'the cursor it had before');
    assert.deepEqual(f.state.touches, [], 'still nothing announced');

    assert.equal(f.toggle(drag), true, 'and a third time copies again');
    assert.equal(f.count('annotation'), 2);
    assert.notEqual(drag.id, 'T1');
});


test('under the drag threshold the key only changes what the drag will do', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation' });
    const drag = textDrag(f, { copy : false, moved : false });
    assert.equal(f.toggle(drag), true);
    assert.equal(drag.copy, true);
    assert.equal(f.count('annotation'), 1, 'a Ctrl+click that never moves leaves no copy');
    drag.moved = true;                                                       // <-- what OnMove does at the threshold
    assert.equal(f.sync(drag), true);
    assert.equal(f.count('annotation'), 2);
});


test('every whole-object kind goes home and clones exactly: a vector, a leader, a dimension and a viewport frame', () => {
    const f = fixture();
    const start = [ [ 0, 0 ], [ 10, 0 ], [ 10, 5 ] ];
    f.add('shape', 'S1', { Shape__Points : start.map((p) => [ p[0] + 7, p[1] + 3 ]), Shape__LayerId : 'vector', Shape__Closed : true, Shape__FillColour : '#abc' });
    const shapeDrag = { kind : 'shape', id : 'S1', mode : 'whole', start : plain(start), startMm : { x : 1, y : 1 }, copyable : true, copy : false, roots : [ { kind : 'shape', id : 'S1' } ], moved : true };
    assert.equal(f.toggle(shapeDrag), true);
    assert.deepEqual(f.find('shape', 'S1').Shape__Points, start, 'vector home');
    assert.deepEqual(f.find('shape', shapeDrag.id).Shape__Points, start, 'vector clone at the start');
    assert.equal(f.find('shape', shapeDrag.id).Shape__FillColour, '#abc');

    f.add('leader', 'L1', { Leader__TipXMm : 6, Leader__TipYMm : 7, Leader__AnchorXMm : 35, Leader__AnchorYMm : 45, Leader__LayerId : 'annotation', Leader__Text : 'EX01' });
    const leaderDrag = { kind : 'leader', id : 'L1', mode : 'whole', start : { tx : 1, ty : 2, ax : 30, ay : 40 }, startMm : { x : 30, y : 40 }, copyable : true, copy : false, roots : [ { kind : 'leader', id : 'L1' } ], moved : true };
    assert.equal(f.toggle(leaderDrag), true);
    const leader = f.find('leader', 'L1'), leaderClone = f.find('leader', leaderDrag.id);
    assert.deepEqual([ leader.Leader__TipXMm, leader.Leader__TipYMm, leader.Leader__AnchorXMm, leader.Leader__AnchorYMm ], [ 1, 2, 30, 40 ]);
    assert.deepEqual([ leaderClone.Leader__TipXMm, leaderClone.Leader__TipYMm, leaderClone.Leader__AnchorXMm, leaderClone.Leader__AnchorYMm ], [ 1, 2, 30, 40 ]);
    assert.equal(leaderClone.Leader__Text, 'EX01');

    f.add('viewport', 'V1', { Viewport__FrameMm : { X : 130, Y : 50, WidthMm : 80, HeightMm : 60 }, Viewport__Kind : '2d', Viewport__Locked : false, Viewport__LayerId : 'viewports' });
    f.add('dimension', 'D1', { Dimension__StartXMm : 5, Dimension__StartYMm : 0, Dimension__EndXMm : 55, Dimension__EndYMm : 0, Dimension__OffsetMm : 8, Dimension__ViewportId : 'V1', Dimension__LayerId : 'dimension' });
    const dimDrag = { kind : 'dimension', id : 'D1', mode : 'whole', start : { sx : 0, sy : 0, ex : 50, ey : 0, offset : 8, tdx : 0, tdy : 0 }, startMm : { x : 25, y : 0 }, copyable : true, copy : false, roots : [ { kind : 'dimension', id : 'D1' } ], moved : true };
    assert.equal(f.toggle(dimDrag), true);
    const dim = f.find('dimension', 'D1'), dimClone = f.find('dimension', dimDrag.id);
    assert.deepEqual([ dim.Dimension__StartXMm, dim.Dimension__EndXMm ], [ 0, 50 ]);
    assert.deepEqual([ dimClone.Dimension__StartXMm, dimClone.Dimension__EndXMm, dimClone.Dimension__OffsetMm ], [ 0, 50, 8 ]);
    assert.equal(dimClone.Dimension__ViewportId, 'V1', 'a dimension copied without its viewport keeps measuring through it');

    const vpDrag = { kind : 'viewport', id : 'V1', hit : { mode : 'border' }, start : { rect : { X : 100, Y : 50, WidthMm : 80, HeightMm : 60 } }, startMm : { x : 100, y : 50 }, baseMm : { x : 120, y : 70 },
                     copyable : true, copy : false, roots : [ { kind : 'viewport', id : 'V1' } ], moved : true };
    f.state.refreshed.length = 0;
    assert.equal(f.toggle(vpDrag), true);
    assert.equal(f.find('viewport', 'V1').Viewport__FrameMm.X, 100, 'frame home');
    const vpClone = f.find('viewport', vpDrag.id);
    assert.deepEqual([ vpClone.Viewport__FrameMm.X, vpClone.Viewport__FrameMm.Y ], [ 100, 50 ], 'frame clone at the start');
    assert.equal(vpClone.Viewport__Locked, false);
    assert.deepEqual(vpDrag.baseMm, { x : 120, y : 70 }, 'the grab point is the original\'s: the clone is carried by the same point');
    assert.ok(f.state.refreshed.includes('now:frames'), 'the clone\'s frame is drawn at once, so the carry can mark it');
    assert.deepEqual(f.state.retargets.at(-1), { fromId : 'V1', toId : vpDrag.id });
    assert.equal(f.count('dimension'), 2, 'copying a viewport alone does not copy the dimension measuring through it');
    assert.deepEqual(f.state.touches, []);
});


test('several items: a group copies whole with its members remapped, a locked item is neither moved nor copied, and the clones are carried from the start', () => {
    const f = fixture();
    f.add('shape', 'S1', { Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__LayerId : 'vector' });
    f.add('shape', 'S2', { Shape__Points : [ [ 0, 5 ], [ 10, 5 ] ], Shape__LayerId : 'vector' });
    f.add('group', 'G1', { Group__Members : [ { kind : 'shape', id : 'S1' }, { kind : 'shape', id : 'S2' } ], Group__Name : 'Kit' });
    f.add('annotation', 'T9', { Annotation__PosXMm : 90, Annotation__PosYMm : 90, Annotation__LayerId : 'locked' });
    f.add('annotation', 'A1', { Annotation__PosXMm : 50, Annotation__PosYMm : 60, Annotation__LayerId : 'annotation' });
    const roots = [ { kind : 'group', id : 'G1' }, { kind : 'annotation', id : 'T9' }, { kind : 'annotation', id : 'A1' } ];
    const group = f.ctx.Na__LeSelSet__Capture(f.sheet, f.ctx.Na__LeGroup__Expand(f.sheet, roots));
    assert.deepEqual(plain(group.map((g) => g.id).sort()), [ 'A1', 'S1', 'S2' ], 'the move leaves the locked text out');   // <-- plain(): arrays made in the vm carry its own prototype
    const drag = { kind : 'group', group : group, startMm : { x : 5, y : 5 }, copyable : true, copy : true, roots : roots, moved : true };
    assert.equal(f.sync(drag), true);
    assert.equal(f.count('shape'), 4);
    assert.equal(f.count('group'), 2);
    assert.equal(f.count('annotation'), 3, 'A1 is copied, T9 is not');
    const groupClone = f.sheet.Sheet__Groups[1];
    assert.equal(groupClone.Group__Name, 'Kit');
    const members = groupClone.Group__Members.map((m) => m.id);
    assert.equal(members.length, 2);
    assert.ok(members.every((id) => id !== 'S1' && id !== 'S2'), 'the clone group holds the clone vectors');
    assert.deepEqual(plain(drag.group.map((g) => g.id).sort()), members.concat([ f.sheet.Sheet__Annotations[2].Annotation__Id ]).sort(), 'the drag carries the clones');
    const s1Clone = drag.group.find((g) => g.id === members[0]);
    assert.deepEqual(plain(s1Clone.start.points), [ [ 0, 0 ], [ 10, 0 ] ], 'captured at the start');
    assert.deepEqual(f.state.selection.map((i) => i.kind + ':' + i.id), [ 'group:' + groupClone.Group__Id, 'annotation:' + f.sheet.Sheet__Annotations[2].Annotation__Id ]);
    assert.equal(drag.original.group, group);
    assert.deepEqual(f.state.touches, []);

    drag.copy = false;
    assert.equal(f.sync(drag), true, 'called off');
    assert.equal(f.count('shape'), 2);
    assert.equal(f.count('group'), 1);
    assert.equal(f.count('annotation'), 2);
    assert.equal(drag.group, group, 'the drag carries the originals again');
    assert.deepEqual(f.state.selection, roots, 'the selection is the one the press made');
    assert.deepEqual(f.state.touches, []);
});


test('several items already moved go home before they are cloned', () => {
    const f = fixture();
    f.add('shape', 'S1', { Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__LayerId : 'vector' });
    f.add('annotation', 'A1', { Annotation__PosXMm : 50, Annotation__PosYMm : 60, Annotation__LayerId : 'annotation' });
    const roots = [ { kind : 'shape', id : 'S1' }, { kind : 'annotation', id : 'A1' } ];
    const group = f.ctx.Na__LeSelSet__Capture(f.sheet, roots);
    f.ctx.Na__LeSelSet__Apply(f.sheet, group, 20, 0);                     // <-- the move so far
    const drag = { kind : 'group', group : group, startMm : { x : 5, y : 5 }, copyable : true, copy : false, roots : roots, moved : true };
    assert.equal(f.toggle(drag), true);
    assert.deepEqual(f.find('shape', 'S1').Shape__Points, [ [ 0, 0 ], [ 10, 0 ] ]);
    assert.equal(f.find('annotation', 'A1').Annotation__PosXMm, 50);
    assert.deepEqual(f.sheet.Sheet__Shapes[1].Shape__Points, [ [ 0, 0 ], [ 10, 0 ] ]);
    assert.equal(f.sheet.Sheet__Annotations[1].Annotation__PosXMm, 50);
});


test('inside an open group the copy joins it, and taken back out it leaves it again', () => {
    const f = fixture();
    f.add('shape', 'S1', { Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__LayerId : 'vector' });
    f.add('shape', 'S2', { Shape__Points : [ [ 0, 5 ], [ 10, 5 ] ], Shape__LayerId : 'vector' });
    f.add('group', 'G1', { Group__Members : [ { kind : 'shape', id : 'S1' }, { kind : 'shape', id : 'S2' } ] });
    f.state.openGroup = 'G1';
    const drag = { kind : 'shape', id : 'S1', mode : 'whole', start : [ [ 0, 0 ], [ 10, 0 ] ], startMm : { x : 1, y : 0 }, copyable : true, copy : true, roots : [ { kind : 'shape', id : 'S1' } ], moved : true };
    assert.equal(f.sync(drag), true);
    const g1 = f.find('group', 'G1');
    assert.deepEqual(g1.Group__Members.map((m) => m.id), [ 'S1', 'S2', drag.id ], 'the copy sits in the open group beside its original');
    drag.copy = false;
    assert.equal(f.sync(drag), true);
    assert.deepEqual(g1.Group__Members.map((m) => m.id), [ 'S1', 'S2' ], 'and leaves it with the copy');
    assert.equal(f.count('group'), 1);
});


test('nothing copyable leaves the drag a plain move', () => {
    const f = fixture();
    const drag = textDrag(f, { roots : [] });
    assert.equal(f.sync(drag), false);
    assert.equal(drag.copy, false, 'the key is spent, the drag stays a move');
    assert.equal(drag.copied, undefined);
    assert.deepEqual(f.state.touches, []);
});


test('the key map: Ctrl is the copy modifier in the shipped file and the fallback, reported without being set aside', async () => {
    // The app's .js files are ES modules without a package.json to say so:
    // the shipped key map unit goes into a temporary .mjs, its one import (the
    // shared key prefix) written in, as Na__Test__DrawingTabKeys__ does.
    const source = read('03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js')
        .replace(/import\s*\{\s*Na__LeCfg__PREFIX\s*\}\s*from\s*'[^']+';/, "const Na__LeCfg__PREFIX = 'LayoutEditor__';");
    assert.ok(!/^\s*import\s/m.test(source), 'the key map unit has no other import');
    const temp = path.join(require('node:os').tmpdir(), 'Na__Test__CopyDrag__KeyMap__' + process.pid + '.mjs');
    fs.writeFileSync(temp, source);
    const KeyMap = await import(pathToFileURL(temp).href);
    fs.unlinkSync(temp);
    const shipped = JSON.parse(read('03__Core__Config/Na__Hotkeys__DrawingTabs__.json'));
    const held = (names) => ({ Ctrl : names.includes('Ctrl'), Shift : names.includes('Shift'), Alt : names.includes('Alt'), Meta : false });
    for (const map of [ shipped, null ]) {
        KeyMap.Na__LeCfg__SetKeyMap(map);
        const which = map ? 'shipped' : 'fallback';
        assert.equal(KeyMap.Na__LeCfg__GetCopyDragModifier(), 'Ctrl', which);
        assert.equal(KeyMap.Na__LeCfg__IsCopyDragKey('Control'), true, which);
        assert.equal(KeyMap.Na__LeCfg__IsCopyDragKey('Shift'), false, which);
        assert.deepEqual(KeyMap.Na__LeCfg__MatchSelectionModifier(held([ 'Ctrl' ])), { combine : 'add', anywhere : false, copy : true, anchor : true }, which + ': Ctrl still adds at the press (and held alone it is the move anchor key)');
        assert.deepEqual(KeyMap.Na__LeCfg__MatchSelectionModifier(held([ 'Ctrl', 'Shift' ])), { combine : 'remove', anywhere : false, copy : true, anchor : false }, which);
        assert.deepEqual(KeyMap.Na__LeCfg__MatchSelectionModifier(held([])), { combine : null, anywhere : false, copy : false, anchor : false }, which);
        assert.deepEqual(KeyMap.Na__LeCfg__MatchSelectionModifier(held([ 'Alt', 'Ctrl' ])), { combine : 'add', anywhere : true, copy : true, anchor : false }, which);
    }
    const off = plain(shipped);
    off.LayoutEditor__SelectionBindings__Config.LayoutEditor__SelectionBindings__CopyDragModifier = '';
    KeyMap.Na__LeCfg__SetKeyMap(off);
    assert.equal(KeyMap.Na__LeCfg__GetCopyDragModifier(), null, 'an empty value switches copying by drag off');
    assert.equal(KeyMap.Na__LeCfg__MatchSelectionModifier(held([ 'Ctrl' ])).copy, false);
    assert.equal(KeyMap.Na__LeCfg__IsCopyDragKey('Control'), false);
    KeyMap.Na__LeCfg__SetKeyMap(null);
    assert.equal(KeyMap.Na__LeCfg__GetMeasureKeys().array, 'xX*/', 'the fallback lets x, X, * and / begin an array');
    KeyMap.Na__LeCfg__SetKeyMap(shipped);
    assert.equal(KeyMap.Na__LeCfg__GetMeasureKeys().array, 'xX*/', 'and so does the shipped file');
    KeyMap.Na__LeCfg__SetKeyMap(null);
});


// -----------------------------------------------------------------------------
// ARRAYS - SketchUp's 3x and /3 after a copy
// -----------------------------------------------------------------------------

// The pointer drag's exact landing (LandExact), written out for the kinds
// tested: every item from its own start, nothing snapped.
const landFor = (f) => (sheet, drag, delta) => {
    const s = drag.start;
    if (drag.kind === 'group')      return f.ctx.Na__LeSelSet__Apply(sheet, drag.group, delta.x, delta.y);
    if (drag.kind === 'annotation') return f.ctx.Na__LeModel__UpdateAnnotation(sheet, drag.id, { posXMm : s.x + delta.x, posYMm : s.y + delta.y }, true);
    if (drag.kind === 'shape')      return f.ctx.Na__LeModel__UpdateShape(sheet, drag.id, { points : s.map((p) => [ p[0] + delta.x, p[1] + delta.y ]) }, true);
    if (drag.kind === 'leader')     return f.ctx.Na__LeModel__UpdateLeader(sheet, drag.id, { tipXMm : s.tx + delta.x, tipYMm : s.ty + delta.y, anchorXMm : s.ax + delta.x, anchorYMm : s.ay + delta.y }, true);
    throw new Error('landFor: ' + drag.kind);
};

// A Ctrl-drag copy made and let go lengthMm along dir: the retype record the
// pointer drag keeps for it.
function landedCopy(f, drag, dir, lengthMm) {
    assert.equal(f.sync(drag), true, 'the copy is made');
    landFor(f)(f.sheet, drag, { x : dir.x * lengthMm, y : dir.y * lengthMm });
    return { drag : drag, dir : dir, lengthMm : lengthMm, sheetId : f.sheet.Sheet__Id };
}

const textsAt = (f) => plain(f.sheet.Sheet__Annotations.map((a) => [ a.Annotation__Id, a.Annotation__PosXMm, a.Annotation__PosYMm ]));

function parser() {
    const ctx = vm.createContext({});
    vm.runInContext(strip(read('15__Core__Markup/Na__LayoutEditor__MeasureParse__.js')), ctx);
    return ctx;
}


test('the array parser: SketchUp\'s six spellings, and what it refuses', () => {
    const p = parser();
    const read1 = (text) => plain(p.Na__LeMParse__Array(text));
    for (const text of [ '3x', 'x3', '3X', 'X3', '*3', '3*', ' 3 x ', '* 3' ]) assert.deepEqual(read1(text), { ok : true, mode : 'times', count : 3 }, text);
    for (const text of [ '/3', '3/', ' / 3 ', '3 /' ]) assert.deepEqual(read1(text), { ok : true, mode : 'divide', count : 3 }, text);
    assert.deepEqual(read1('12x'), { ok : true, mode : 'times', count : 12 });
    for (const text of [ '0x', '/0', '2.5x', '/1.5', '1,000x' ]) assert.equal(read1(text).reason, 'count', text + ' is an array with a bad count');
    for (const text of [ '1000', '2.5m', '3000 x 2000', 'x', '/', '3x3', '-3x', 'abc', '3//' ]) assert.equal(read1(text).ok, false, text + ' is not an array');
    assert.equal(read1('1000').reason, 'number', 'a length is left for the length reader');
    assert.equal(read1('').reason, 'empty');
});


test('3x after a copy: copies at two and three times the distance, cloned from the ORIGINAL, nothing announced', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation', Annotation__Text : 'Post', Annotation__RotationDeg : 15 });
    const drag   = textDrag(f, { start : { x : 10, y : 20 } });
    const record = landedCopy(f, drag, { x : 1, y : 0 }, 20);
    const copyId = drag.id;
    assert.equal(f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 3 }, landFor(f)), true);
    const at = textsAt(f);
    assert.equal(at.length, 4, 'the original, the copy and two more');
    assert.deepEqual(at.find((t) => t[0] === 'T1').slice(1), [ 10, 20 ], 'the original never moves');
    assert.deepEqual(at.find((t) => t[0] === copyId).slice(1), [ 30, 20 ], 'the copy stays at the distance');
    const extras = record.array.extras.map((e) => e.drag.id);
    assert.equal(extras.length, 2);
    assert.deepEqual(plain(extras.map((id) => at.find((t) => t[0] === id).slice(1))), [ [ 50, 20 ], [ 70, 20 ] ], 'twice and three times the distance');
    extras.forEach((id) => { const t = f.find('annotation', id); assert.equal(t.Annotation__Text, 'Post'); assert.equal(t.Annotation__RotationDeg, 15); });
    assert.deepEqual(plain(record.array.extras.map((e) => e.factor)), [ 2, 3 ]);
    assert.equal(drag.id, copyId, 'the record still carries the copy itself');
    assert.deepEqual(plain(f.ctx.Na__LeTools__CopyArraySelection(record)), [ { kind : 'annotation', id : copyId } ], 'what the array leaves selected');
    assert.deepEqual(f.state.touches, [], 'nothing announced: the pointer drag announces once');
});


test('a new count replaces the old one without a trace, /N divides the distance, and a new length spaces them out again', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation' });
    const drag   = textDrag(f, { start : { x : 10, y : 20 } });
    const record = landedCopy(f, drag, { x : 1, y : 0 }, 20);
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 5 }, landFor(f));
    const five = record.array.extras.map((e) => e.drag.id);
    assert.equal(five.length, 4);
    assert.equal(f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'divide', count : 4 }, landFor(f)), true, '/4 after 5x');
    const at = textsAt(f);
    assert.equal(at.length, 5, 'the original, the copy and three between');
    five.forEach((id) => assert.equal(f.find('annotation', id), null, 'the 5x copies are gone'));
    const quarters = plain(record.array.extras.map((e) => at.find((t) => t[0] === e.drag.id)[1]));
    assert.deepEqual(quarters, [ 15, 20, 25 ], 'a quarter, a half and three quarters of the way');
    assert.equal(f.find('annotation', drag.id).Annotation__PosXMm, 30, 'the copy is the last of the four');

    record.lengthMm = 40;                                                    // <-- RetypeMove: the copy lands again, then the array follows
    landFor(f)(f.sheet, drag, { x : 40, y : 0 });
    assert.equal(f.ctx.Na__LeTools__FollowCopyArray(f.sheet, record, landFor(f)), true);
    assert.deepEqual(plain(record.array.extras.map((e) => f.find('annotation', e.drag.id).Annotation__PosXMm)), [ 20, 30, 40 ], 'stretched over the new distance');
    assert.equal(f.find('annotation', drag.id).Annotation__PosXMm, 50);

    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 1 }, landFor(f));
    assert.equal(f.count('annotation'), 2, '1x leaves the copy on its own');
    assert.deepEqual(plain(record.array.extras), []);
    assert.deepEqual(f.state.touches, []);
});


test('a minus sign runs the array back the other way, and a vector goes along a vertical line', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation' });
    const drag   = textDrag(f, { start : { x : 10, y : 20 } });
    const record = landedCopy(f, drag, { x : 1, y : 0 }, -12);
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 3 }, landFor(f));
    assert.deepEqual(plain(record.array.extras.map((e) => f.find('annotation', e.drag.id).Annotation__PosXMm)), [ -14, -26 ]);

    const g = fixture();
    const start = [ [ 0, 0 ], [ 10, 0 ], [ 10, 5 ] ];
    g.add('shape', 'S1', { Shape__Points : plain(start), Shape__LayerId : 'vector', Shape__Closed : true });
    const vDrag = { kind : 'shape', id : 'S1', mode : 'whole', start : plain(start), startMm : { x : 1, y : 1 }, copyable : true, copy : true, roots : [ { kind : 'shape', id : 'S1' } ], moved : true };
    const vRecord = landedCopy(g, vDrag, { x : 0, y : 1 }, 7);
    g.ctx.Na__LeTools__BuildCopyArray(g.sheet, vRecord, { mode : 'divide', count : 2 }, landFor(g));
    assert.equal(vRecord.array.extras.length, 1);
    assert.deepEqual(plain(g.find('shape', vRecord.array.extras[0].drag.id).Shape__Points), start.map((p) => [ p[0], p[1] + 3.5 ]), 'half way down');
    assert.deepEqual(plain(g.find('shape', 'S1').Shape__Points), start, 'the original never moves');
    assert.deepEqual(plain(g.find('shape', vDrag.id).Shape__Points), start.map((p) => [ p[0], p[1] + 7 ]));
});


test('a leader arrays whole, tip and head together, as its copy moved', () => {
    const f = fixture();
    f.add('leader', 'L1', { Leader__TipXMm : 1, Leader__TipYMm : 2, Leader__AnchorXMm : 30, Leader__AnchorYMm : 40, Leader__LayerId : 'annotation', Leader__Text : 'WF01' });
    const drag   = { kind : 'leader', id : 'L1', mode : 'whole', start : { tx : 1, ty : 2, ax : 30, ay : 40 }, startMm : { x : 30, y : 40 }, copyable : true, copy : true, roots : [ { kind : 'leader', id : 'L1' } ], moved : true };
    const record = landedCopy(f, drag, { x : 0.6, y : 0.8 }, 10);
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 2 }, landFor(f));
    const extra = f.find('leader', record.array.extras[0].drag.id);
    assert.deepEqual([ extra.Leader__TipXMm, extra.Leader__TipYMm, extra.Leader__AnchorXMm, extra.Leader__AnchorYMm ].map((v) => Math.round(v * 1000) / 1000), [ 13, 18, 42, 56 ]);
    assert.equal(extra.Leader__Text, 'WF01');
});


test('several items with a group: each array copy is a fresh group with fresh members, and the locked item stays out', () => {
    const f = fixture();
    f.add('shape', 'S1', { Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__LayerId : 'vector' });
    f.add('shape', 'S2', { Shape__Points : [ [ 0, 5 ], [ 10, 5 ] ], Shape__LayerId : 'vector' });
    f.add('group', 'G1', { Group__Members : [ { kind : 'shape', id : 'S1' }, { kind : 'shape', id : 'S2' } ], Group__Name : 'Kit' });
    f.add('annotation', 'T9', { Annotation__PosXMm : 90, Annotation__PosYMm : 90, Annotation__LayerId : 'locked' });
    f.add('annotation', 'A1', { Annotation__PosXMm : 50, Annotation__PosYMm : 60, Annotation__LayerId : 'annotation' });
    const roots  = [ { kind : 'group', id : 'G1' }, { kind : 'annotation', id : 'T9' }, { kind : 'annotation', id : 'A1' } ];
    const group  = f.ctx.Na__LeSelSet__Capture(f.sheet, f.ctx.Na__LeGroup__Expand(f.sheet, roots));
    const drag   = { kind : 'group', group : group, startMm : { x : 5, y : 5 }, copyable : true, copy : true, roots : roots, moved : true };
    const record = landedCopy(f, drag, { x : 1, y : 0 }, 100);
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 3 }, landFor(f));
    assert.equal(f.count('group'), 4, 'the original group, the copy\'s and two more');
    assert.equal(f.count('shape'), 8);
    assert.equal(f.count('annotation'), 5, 'A1 three times over; the locked T9 never');
    const third = record.array.extras.find((e) => e.factor === 3);
    const thirdGroup = third.roots.find((r) => r.kind === 'group');
    const members = f.find('group', thirdGroup.id).Group__Members;
    assert.equal(members.length, 2);
    members.forEach((m) => assert.deepEqual(plain(f.find('shape', m.id).Shape__Points.map((p) => p[0])), [ 300, 310 ], 'three times the distance'));
    const note = third.roots.find((r) => r.kind === 'annotation');
    assert.equal(f.find('annotation', note.id).Annotation__PosXMm, 350);
    assert.deepEqual(f.state.touches, []);
});


test('inside an open group the array copies join it, and a replaced count leaves it again', () => {
    const f = fixture();
    f.add('shape', 'S1', { Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__LayerId : 'vector' });
    f.add('shape', 'S2', { Shape__Points : [ [ 0, 5 ], [ 10, 5 ] ], Shape__LayerId : 'vector' });
    f.add('group', 'G1', { Group__Members : [ { kind : 'shape', id : 'S1' }, { kind : 'shape', id : 'S2' } ] });
    f.state.openGroup = 'G1';
    const drag   = { kind : 'shape', id : 'S1', mode : 'whole', start : [ [ 0, 0 ], [ 10, 0 ] ], startMm : { x : 1, y : 0 }, copyable : true, copy : true, roots : [ { kind : 'shape', id : 'S1' } ], moved : true };
    const record = landedCopy(f, drag, { x : 0, y : 1 }, 10);
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 3 }, landFor(f));
    const g1 = f.find('group', 'G1');
    assert.equal(g1.Group__Members.length, 5, 'S1, S2, the copy and two array copies');
    f.ctx.Na__LeTools__BuildCopyArray(f.sheet, record, { mode : 'times', count : 1 }, landFor(f));
    assert.deepEqual(g1.Group__Members.map((m) => m.id), [ 'S1', 'S2', drag.id ], 'the array copies leave with the count');
});


test('an array needs a landed copy, and names no copy it did not make', () => {
    const f = fixture();
    f.add('annotation', 'T1', { Annotation__PosXMm : 10, Annotation__PosYMm : 20, Annotation__LayerId : 'annotation' });
    const plainMove = { drag : { kind : 'annotation', id : 'T1', start : { x : 10, y : 20 }, roots : [ { kind : 'annotation', id : 'T1' } ] }, dir : { x : 1, y : 0 }, lengthMm : 20 };
    assert.equal(f.ctx.Na__LeTools__BuildCopyArray(f.sheet, plainMove, { mode : 'times', count : 3 }, landFor(f)), false, 'a plain move is not a copy');
    assert.equal(f.count('annotation'), 1);
    assert.equal(f.ctx.Na__LeTools__FollowCopyArray(f.sheet, plainMove, landFor(f)), false);
    assert.deepEqual(plain(f.ctx.Na__LeTools__CopyArraySelection(plainMove)), []);
});
