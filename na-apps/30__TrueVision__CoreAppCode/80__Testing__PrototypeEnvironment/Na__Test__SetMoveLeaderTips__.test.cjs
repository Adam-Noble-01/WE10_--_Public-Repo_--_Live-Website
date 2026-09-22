// =============================================================================
// TRUEVISION3D - TEST - LEADER TIPS IN A SET MOVE, AND LEADERS AND VIEWPORTS IN GROUPS
// =============================================================================
//
// FILE       : Na__Test__SetMoveLeaderTips__.test.cjs
// NAMESPACE  : Na__Test
// MODULE     : Set Move Leader Tips Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a leader travels with the items it is moved with, keeps pointing at what stays behind, that a group holding viewports, leaders and dimensions moves as one piece, and that what is placed inside an open group joins it
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - Runs the shipped Selection Set, Groups, Edit Scope and the viewport
//   rotation leaf whole, with the real shape geometry, group record
//   normaliser, prune, AddGroupMember and the single deletes of a shape, a
//   text, a leader, a dimension and a viewport, in one vm context; and the
//   real Resolve, RawHit, IsViewportLocked, SelectionPicksUpMove and
//   GroupAutoMoves of the hit resolution, and PLACE_KINDS and PlacesIntoGroup
//   of the tool state. Only the record store, the surface, the confirm
//   dialog, the markup bridge's three bounds and its hit test, the frame
//   order and the vector tools' config are stubbed.
// - ADAM'S CASE (RB05 Project Introduction): a CGI (a picture, which is a
//   vector carrying Shape__Image) boxed with its specification bubbles and a
//   note, then moved - every bubble and its tip, and the note and its leader,
//   travel with the picture. The same with a viewport, as before.
// - THE POINTING RULE: notes and leaders moved on their own keep their tips;
//   a tip on something staying behind stays on it, whatever else moves; a tip
//   over a moving vector's box, or on bare paper, goes with a set of drawings;
//   a hidden drawing pins nothing; a locked one does; a turned frame is read
//   as it stands.
// - GROUPS: leaders and dimensions group (Ctrl+G), stay in the record, survive
//   and leave the prune, resolve a click and a box to their group, are drawn
//   by an open group, and a group moves as one piece - tips pinned elsewhere
//   included, nested or not. Inside an open group, members picked loose take
//   the pointing rule. A copy (options.rigid) carries every tip.
// - VIEWPORTS IN GROUPS (v2.142.0): a viewport groups with its notes; a
//   click on its frame takes the outermost group, a locked frame stays a
//   background, a frame behind a member does not hide it, and a step out
//   lands on the outer group; a group moves its frame with it (a locked one
//   stays) and is framed by a turned viewport's true bounds; a group holding
//   a viewport or a dimension waits for M. Deleting a grouped leader,
//   dimension or viewport on its own leaves the group naming nothing gone.
// - PLACED INSIDE AN OPEN GROUP (v2.142.0): with a group open the Text,
//   Leader and Dimension tools keep it open and what they place joins it -
//   and only that: nothing already on the sheet, nothing after the tool is
//   put down, nothing with a leaf open or the config switched off. A
//   viewport or a picture added while it is open joins it, the window before
//   it restored; a paste joins it.
//
// USAGE:
//     node --test 80__Testing__PrototypeEnvironment/Na__Test__SetMoveLeaderTips__.test.cjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.2
// - Loads Na__LeShapeGeo__Holes with the shape geometry it runs: Segments and
//   Contains ask it (ShapeGeometry 1.9.0, holed vectors from the Boolean
//   tools). It answers [] for every shape here, which carry no Shape__Holes.
//
// 22-Sep-2026 - Version 1.1.1
// - The context stubs the move anchor's Holds and HoldsItems (no cross on
//   anything): HitResolution 1.10.0 asks them first in PicksUpMove and
//   SelectionPicksUpMove. Na__Test__MoveAnchor__ proves the cross itself.
//
// 22-Sep-2026 - Version 1.1.0
// - Tests 18-28 for viewports in groups and for placing inside an open group
//   (Groups 1.4.0, EditScope 1.4.0, HitResolution 1.9.0, ToolState 1.6.0);
//   test 9 now expects Ctrl+G to take the viewport.
//
// 22-Sep-2026 - Version 1.0.0
// - Written with SelectionSet 1.2.0 and Groups 1.3.0.
//
// =============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root  = path.resolve(__dirname, '../02__Src__AppModules/51__System__LayoutEditor');
const read  = (file) => fs.readFileSync(path.join(root, file), 'utf8');
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

function loadConst(ctx, file, name) {
    const match = read(file).match(new RegExp('const ' + name + '\\s*=\\s*[^;]+;'));
    assert.ok(match, name);
    vm.runInContext(match[0].replace('const ', 'var '), ctx);
}

const ROWS = {
    viewport   : [ 'Viewports',   'Viewport'   ],
    shape      : [ 'Shapes',      'Shape'      ],
    annotation : [ 'Annotations', 'Annotation' ],
    dimension  : [ 'Dimensions',  'Dimension'  ],
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
    const sheet = { Sheet__Id : 'Sheet_RB05_T01', ...Object.fromEntries(Object.values(ROWS).map(([ list ]) => [ 'Sheet__' + list, [] ])) };
    const state = { selection : [], touches : [], hidden : new Set(), locked : new Set(), serial : 0, events : 0, markupHit : null, vectorsOn : true };
    const box   = (xs, ys) => ({ X : Math.min(...xs), Y : Math.min(...ys), WidthMm : Math.max(...xs) - Math.min(...xs), HeightMm : Math.max(...ys) - Math.min(...ys) });
    const hooks = [];                                                        // <-- The model's before-announce hooks, run by Touch as the real one runs them
    const ctx = vm.createContext({
        console,
        window : { dispatchEvent : () => { state.events++; } },
        CustomEvent : class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        Na__LeCfg__GetLabel : (_, fallback) => fallback,
        Na__LeCfg__FormatLabel : (_, fallback) => fallback,
        Na__LeCfg__GetSelectionSetup : () => ({ hitToleranceMm : 1.5 }),
        Na__LeRec__Find : (list, key, id) => (list || []).find((r) => r && r[key] === id) || null,
        Na__LeRec__NextId : (list, prefix) => prefix + String(900 + (++state.serial)),
        Na__LeModel__GetLeaders : (s) => s.Sheet__Leaders || [],
        Na__LeModel__IsLayerLocked : (_, id) => state.locked.has(id),
        Na__LeModel__IsLayerVisible : (_, id) => !state.hidden.has(id),
        Na__LeModel__IsLayerSelectable : () => true,
        Na__LeModel__GetSelectionItems : () => state.selection,
        Na__LeModel__SetSelection : (item) => { state.selection = item ? [ plain(item) ] : []; },
        Na__LeModel__SetSelectionItems : (items) => { state.selection = plain(items || []); return state.selection; },
        Na__LeModel__AssignSelectionItems : (items) => { state.selection = items; },
        Na__LeModel__Unselect : (id) => { state.selection = state.selection.filter((item) => item.id !== id); },
        Na__LeModel__AssignDirty () {},
        Na__LeModel__GetActiveSheet : () => sheet,
        Na__LeModel__GetSelection : () => (state.selection.length === 1 ? state.selection[0] : null),
        Na__LeAnchor__Holds : () => false,                                   // <-- No move anchor's cross on anything here (Na__Test__MoveAnchor__ proves it)
        Na__LeAnchor__HoldsItems : () => false,
        // THE HOOK CONTRACT (Na__LayoutEditor__SheetModel__State__): registered once each, run in order ahead of the
        // announcement with (reason, sheetId, itemId).
        Na__LeModel__RegisterBeforeAnnounce : (hook) => { if (typeof hook !== 'function' || hooks.indexOf(hook) !== -1) return false; hooks.push(hook); return true; },
        Na__LeModel__Touch : (reason, sheetId, itemId) => { hooks.forEach((hook) => hook(reason, sheetId || sheet.Sheet__Id, itemId || null)); state.touches.push(reason); },
        Na__LeSurface__Refresh () {},
        // The hit resolution's own boundary: no markup, no grips, one paper millimetre a pixel.
        Na__LeCfg__GetEditScopeSetup : () => ({ autoMoveOnSelect : true, moveToolRequired : true, autoMoveKinds : [ 'annotation', 'shape', 'leader', 'group' ] }),
        Na__LeTools__RotateGripAt : () => null, Na__LeTools__ViewportRotateGripAt : () => null,
        Na__LeTools__OpenDimensionGripAt : () => null, Na__LeTools__ScopeGrabAt : () => null,
        Na__LeTools__Tolerance : () => 1,
        Na__LeMarkup__HitTest : () => state.markupHit,
        Na__LeSurface__GetPixelsPerMm : () => 1, Na__LeSurface__GetZoom : () => 1,
        Na__LeHandles__HitTest : () => null,
        Na__LeHandles__FrontToBack : (s) => s.Sheet__Viewports.filter((v) => !state.hidden.has(v.Viewport__LayerId)).slice().reverse(),
        Na__LeHandles__Contains : (v, p) => ctx.Na__LeVpRot__Contains(v, p, 0),
        Na__LeVecCfg__Value : () => state.vectorsOn,                         // <-- DrawInsideOpenGroup
        Na__LeTools__TOOL_TEXT : 'text', Na__LeTools__TOOL_LEADER : 'leader', Na__LeTools__TOOL_DIMENSION : 'dimension',
        Na__AppUtils__ConfirmDialog__Show : async () => true,
        // The markup bridge's boxes: what they frame is proven where they live; here only that a group asks for each kind.
        Na__LeMarkup__AnnotationBounds : (a) => ({ X : a.Annotation__PosXMm, Y : a.Annotation__PosYMm - 3, WidthMm : 20, HeightMm : 4 }),
        Na__LeMarkup__LeaderBounds : (l) => box([ l.Leader__TipXMm, l.Leader__AnchorXMm ], [ l.Leader__TipYMm, l.Leader__AnchorYMm ]),
        Na__LeMarkup__DimensionBounds : (s, d) => box([ d.Dimension__StartXMm, d.Dimension__EndXMm ], [ d.Dimension__StartYMm, d.Dimension__EndYMm ])
    });
    Object.defineProperty(ctx, 'Na__LeModel__SelectionItems', { get : () => state.selection });
    for (const [ kind, [ list, prefix ] ] of Object.entries(ROWS)) {
        if (kind === 'group') continue;                                      // <-- The real group getters, below
        ctx['Na__LeModel__Get' + prefix + 'ById'] = (s, id) => s['Sheet__' + list].find((r) => r[prefix + '__Id'] === id) || null;
        ctx['Na__LeModel__Update' + prefix] = (s, id, patch, silent) => {
            const record = s['Sheet__' + list].find((r) => r[prefix + '__Id'] === id);
            if (!record) return false;
            if (kind === 'viewport' && patch.rect) { record.Viewport__FrameMm.X = patch.rect.X; record.Viewport__FrameMm.Y = patch.rect.Y; }
            Object.entries(PATCH[kind] || {}).forEach(([ key, field ]) => { if (key in patch) record[field] = plain(patch[key]); });
            if (!silent) state.touches.push(list.toLowerCase());
            return true;
        };
    }
    // THE REAL THING, bar the stubs above: shape geometry, the turned frame, the
    // group record and its prune and delete, groups, the selection set, the scope.
    loadFunctions(ctx, '15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js', [ 'Na__LeShapeGeo__Points', 'Na__LeShapeGeo__Holes', 'Na__LeShapeGeo__Segments', 'Na__LeShapeGeo__Bounds',
        'Na__LeShapeGeo__Translated', 'Na__LeShapeGeo__DistanceToSegment', 'Na__LeShapeGeo__DistanceToEdge', 'Na__LeShapeGeo__Contains', 'Na__LeShapeGeo__Hit' ]);
    vm.runInContext(strip(read('20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js')), ctx);
    loadConst(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', 'Na__LeRec__GROUP_KINDS');
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', [ 'Na__LeRec__NormaliseGroup' ]);
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__Groups__.js', [ 'Na__LeModel__GetGroups', 'Na__LeModel__InsertGroup',
        'Na__LeModel__DeleteGroup', 'Na__LeModel__AddGroupMember', 'Na__LeModel__PruneGroups', 'Na__LeModel__DeleteItems' ]);
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__Leaders__.js', [ 'Na__LeModel__DeleteLeader' ]);
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__TextAndDimensions__.js', [ 'Na__LeModel__DeleteDimension' ]);
    loadFunctions(ctx, '07__Core__SheetData/Na__LayoutEditor__SheetModel__Viewports__.js', [ 'Na__LeModel__DeleteViewport' ]);
    vm.runInContext(strip(read('15__Core__Markup/Na__LayoutEditor__Groups__.js')), ctx);
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__SelectionSet__.js')), ctx);
    vm.runInContext(strip(read('30__System__SheetTools/Na__LayoutEditor__EditScope__.js')), ctx);
    const hits = '30__System__SheetTools/Na__LayoutEditor__SheetTools__HitResolution__.js';
    ctx.Na__LeTools__PICK_TOOLS = [ 'select', 'move' ];
    loadFunctions(ctx, hits, [ 'Na__LeTools__SelectionPicksUpMove', 'Na__LeTools__GroupAutoMoves', 'Na__LeTools__Resolve', 'Na__LeTools__RawHit', 'Na__LeTools__IsViewportLocked' ]);
    loadConst(ctx, '30__System__SheetTools/Na__LayoutEditor__SheetTools__ToolState__.js', 'Na__LeTools__PLACE_KINDS');
    loadFunctions(ctx, '30__System__SheetTools/Na__LayoutEditor__SheetTools__ToolState__.js', [ 'Na__LeTools__PlacesIntoGroup' ]);

    const add = (kind, id, data) => {
        const [ list, prefix ] = ROWS[kind];
        sheet['Sheet__' + list].push({ [prefix + '__Id'] : id, ...plain(data || {}) });
        return { kind : kind, id : id };
    };
    const find = (kind, id) => { const [ list, prefix ] = ROWS[kind]; return sheet['Sheet__' + list].find((r) => r[prefix + '__Id'] === id) || null; };
    // What the press does for several selected items, or a group, then a drag
    // to (dx, dy) and its release: Capture on the expanded selection, Apply, Commit.
    const move = (items, dx, dy, options) => {
        const group = ctx.Na__LeSelSet__Capture(sheet, ctx.Na__LeGroup__Expand(sheet, items), options);
        ctx.Na__LeSelSet__Apply(sheet, group, dx, dy);
        ctx.Na__LeSelSet__Commit(sheet, group);
        return group;
    };
    const tip    = (id) => { const l = find('leader', id); return [ l.Leader__TipXMm, l.Leader__TipYMm ]; };
    const anchor = (id) => { const l = find('leader', id); return [ l.Leader__AnchorXMm, l.Leader__AnchorYMm ]; };
    return { sheet, state, ctx, add, find, move, tip, anchor };
}

// A rectangle of points, clockwise from the top left.
const rect = (x, y, w, h) => [ [ x, y ], [ x + w, y ], [ x + w, y + h ], [ x, y + h ] ];

// RB05 T01's lower CGI as a picture: a vector carrying Shape__Image.
function picture(f, id, x, y, w, h, layer) {
    return f.add('shape', id, { Shape__Points : rect(x, y, w, h), Shape__Closed : true, Shape__LayerId : layer || 'images',
                                Shape__Image : { Image__File : 'NW-Fascade.webp' } });
}
function viewport(f, id, x, y, w, h, layer, extra) {
    return f.add('viewport', id, { Viewport__FrameMm : { X : x, Y : y, WidthMm : w, HeightMm : h }, Viewport__LayerId : layer || 'viewports', ...(extra || {}) });
}
function bubble(f, id, tipX, tipY, anchorX, anchorY, layer) {
    return f.add('leader', id, { Leader__TipXMm : tipX, Leader__TipYMm : tipY, Leader__AnchorXMm : anchorX, Leader__AnchorYMm : anchorY,
                                 Leader__Type : 'bubble', Leader__Text : id, Leader__LayerId : layer || 'annotations' });
}
function note(f, id, x, y, tipX, tipY) {
    return f.add('annotation', id, { Annotation__PosXMm : x, Annotation__PosYMm : y, Annotation__LeaderXMm : tipX, Annotation__LeaderYMm : tipY,
                                     Annotation__Text : id, Annotation__LayerId : 'annotations' });
}


// -----------------------------------------------------------------------------
// ADAM'S CASE
// -----------------------------------------------------------------------------

test("a CGI boxed with its bubbles and a note moves as one: every tip goes with the picture (RB05 T01)", () => {
    const f = fixture();
    const cgi = picture(f, 'CGI_NW', 60, 140, 240, 135);
    const fn04 = bubble(f, 'FN04', 78, 184, 36, 150);                        // <-- Tip on the chimney, bubble out to the left
    const en05 = bubble(f, 'EN05', 91, 222, 40, 250);
    const en04 = bubble(f, 'EN04', 166, 205, 105, 110);                      // <-- Tip on the orangery roof, bubble above the picture
    const fn12 = bubble(f, 'FN12', 288, 172, 340, 145);
    const en02 = bubble(f, 'EN02', 279, 208, 340, 185);
    const t1   = note(f, 'Note_1', 310, 260, 230, 240);                        // <-- A note whose leader points into the lawn
    const group = f.move([ cgi, fn04, en05, en04, fn12, en02, t1 ], 40, 0);
    assert.deepEqual(f.find('shape', 'CGI_NW').Shape__Points[0], [ 100, 140 ], 'the picture moved');
    [ [ 'FN04', 78, 184, 36, 150 ], [ 'EN05', 91, 222, 40, 250 ], [ 'EN04', 166, 205, 105, 110 ], [ 'FN12', 288, 172, 340, 145 ], [ 'EN02', 279, 208, 340, 185 ] ]
        .forEach(([ id, tx, ty, ax, ay ]) => {
            assert.deepEqual(f.tip(id), [ tx + 40, ty ], id + ': the tip goes with the picture it points at');
            assert.deepEqual(f.anchor(id), [ ax + 40, ay ], id + ': and the bubble with it');
        });
    const moved = f.find('annotation', 'Note_1');
    assert.deepEqual([ moved.Annotation__PosXMm, moved.Annotation__LeaderXMm ], [ 350, 270 ], "the note's leader goes too");
    assert.ok(group.filter((entry) => entry.kind === 'leader').every((entry) => entry.start.tipFollows === true));
    assert.deepEqual(f.state.touches, [ 'shapes', 'leaders', 'annotations' ], 'one announcement per kind: one undo step');
});


test('the same with a viewport: tips inside the frame go with it, as before', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 50, 50, 200, 120);
    const a = bubble(f, 'A', 120, 90, 20, 60);
    const b = bubble(f, 'B', 249, 169, 280, 190);                            // <-- Just inside the far corner
    f.move([ plan, a, b ], 0, -15);
    assert.deepEqual(f.find('viewport', 'VP_Plan').Viewport__FrameMm.Y, 35);
    assert.deepEqual(f.tip('A'), [ 120, 75 ]);
    assert.deepEqual(f.tip('B'), [ 249, 154 ]);
});


test('the arrow keys nudge a picture and its bubbles by the same rule', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    assert.equal(f.ctx.Na__LeSelSet__Nudge(f.sheet, f.ctx.Na__LeGroup__Expand(f.sheet, [ cgi, a ]), 10, 0), true);
    assert.deepEqual(f.tip('A'), [ 60, 30 ]);
    assert.deepEqual(f.anchor('A'), [ 130, 20 ]);
});


// -----------------------------------------------------------------------------
// THE POINTING RULE
// -----------------------------------------------------------------------------

test('notes and leaders moved on their own keep every tip where it points (tidying a column of notes)', () => {
    const f = fixture();
    picture(f, 'CGI', 0, 0, 100, 60);                                        // <-- Not selected: it stays
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const b = bubble(f, 'B', 400, 400, 420, 380);                            // <-- On bare paper
    const t = note(f, 'T', 130, 50, 40, 40);
    f.move([ a, b, t ], 5, 7);
    assert.deepEqual(f.tip('A'), [ 50, 30 ]);
    assert.deepEqual(f.anchor('A'), [ 125, 27 ]);
    assert.deepEqual(f.tip('B'), [ 400, 400 ], 'no drawing moved, so even a tip on bare paper stays');
    const moved = f.find('annotation', 'T');
    assert.deepEqual([ moved.Annotation__PosXMm, moved.Annotation__LeaderXMm, moved.Annotation__LeaderYMm ], [ 135, 40, 40 ]);
});


test('with drawings moving: a tip on one goes, a tip on a drawing left behind stays on it, a tip on bare paper goes', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    viewport(f, 'VP_Other', 200, 0, 150, 100);                               // <-- Not selected: it stays
    const onCgi   = bubble(f, 'OnCgi', 50, 30, 120, 70);
    const onOther = bubble(f, 'OnOther', 260, 40, 150, 90);                  // <-- Boxed in by a crossing, but it points into the other drawing
    const bare    = bubble(f, 'Bare', 120, 150, 90, 170);
    f.move([ cgi, onCgi, onOther, bare ], 0, 20);
    assert.deepEqual(f.tip('OnCgi'), [ 50, 50 ]);
    assert.deepEqual(f.tip('OnOther'), [ 260, 40 ], 'it keeps pointing at the drawing that stayed');
    assert.deepEqual(f.anchor('OnOther'), [ 150, 110 ], 'while its bubble travels with the set');
    assert.deepEqual(f.tip('Bare'), [ 120, 170 ]);
});


test('a tip over a moving vector detail goes with it, even between its lines and over a drawing that stays', () => {
    const f = fixture();
    viewport(f, 'VP_Under', 0, 0, 300, 200);                                 // <-- The plan the detail was drawn over: it stays
    const left  = f.add('shape', 'Line_L', { Shape__Points : [ [ 50, 50 ], [ 50, 120 ] ], Shape__LayerId : 'vectors' });
    const right = f.add('shape', 'Line_R', { Shape__Points : [ [ 90, 50 ], [ 90, 120 ] ], Shape__LayerId : 'vectors' });
    const top   = f.add('shape', 'Line_T', { Shape__Points : [ [ 50, 50 ], [ 90, 50 ] ], Shape__LayerId : 'vectors' });
    const onLine = bubble(f, 'OnLine', 70, 50.6, 140, 30);                   // <-- On the top line, placed by eye
    const between = bubble(f, 'Between', 71, 80, 140, 60);                   // <-- In the middle of the detail, clear of every line
    const planOnly = bubble(f, 'PlanOnly', 200, 150, 250, 170);              // <-- On the plan, well clear of the detail
    f.move([ left, right, top, onLine, between, planOnly ], -30, 0);
    assert.deepEqual(f.tip('OnLine'), [ 40, 50.6 ]);
    assert.deepEqual(f.tip('Between'), [ 41, 80 ], "the detail's own box carries it: the benefit of the doubt keeps a set in one piece");
    assert.deepEqual(f.tip('PlanOnly'), [ 200, 150 ], 'pointing at the plan alone, it stays on the plan');
});


test('a hidden drawing pins nothing; a locked one pins what is on it, and does not move', () => {
    const f = fixture();
    f.state.hidden.add('hidden');
    f.state.locked.add('locked');
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    viewport(f, 'VP_Hidden', 200, 0, 150, 100, 'hidden');
    const locked = picture(f, 'CGI_Locked', 0, 200, 100, 60, 'locked');
    const overHidden = bubble(f, 'OverHidden', 260, 40, 150, 90);
    const onLocked   = bubble(f, 'OnLocked', 50, 230, 150, 250);
    f.move([ cgi, locked, overHidden, onLocked ], 10, 10);
    assert.deepEqual(f.find('shape', 'CGI_Locked').Shape__Points[0], [ 0, 200 ], 'a locked picture stays put');
    assert.deepEqual(f.tip('OnLocked'), [ 50, 230 ], 'and the tip on it stays with it');
    assert.deepEqual(f.anchor('OnLocked'), [ 160, 260 ]);
    assert.deepEqual(f.tip('OverHidden'), [ 270, 50 ], 'a hidden drawing is bare paper to a tip');
});


test('a turned frame is read as it stands, moving or staying', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 400, 0, 100, 60);
    viewport(f, 'VP_Turned', 0, 0, 200, 100, 'viewports', { Viewport__RotationDeg : 45 });   // <-- Centre (100, 50), turned half a right angle
    const inTurned  = bubble(f, 'InTurned', 100, 110, 300, 130);             // <-- Below the level frame, inside the turned one
    const inCorner  = bubble(f, 'InCorner', 1, 1, 300, 20);                  // <-- In the level frame's corner, outside the turned one
    f.move([ cgi, inTurned, inCorner ], 0, 30);
    assert.deepEqual(f.tip('InTurned'), [ 100, 110 ], 'on the staying turned drawing: it stays');
    assert.deepEqual(f.tip('InCorner'), [ 1, 31 ], 'off it, on bare paper: it goes');
});


// -----------------------------------------------------------------------------
// GROUPS
// -----------------------------------------------------------------------------

test('Ctrl+G takes a viewport, leaders and dimensions with the picture, and the record keeps them', () => {
    const f = fixture();
    const cgi  = picture(f, 'CGI', 0, 0, 100, 60);
    const a    = bubble(f, 'A', 50, 30, 120, 20);
    const dim  = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70, Dimension__LayerId : 'dimensions' });
    const plan = viewport(f, 'VP', 200, 0, 100, 100);
    f.state.selection = [ cgi, a, dim, plan ];
    assert.equal(f.ctx.Na__LeGroup__CanGroup(f.sheet), true);
    assert.equal(f.ctx.Na__LeGroup__Group(f.sheet), true);
    const made = f.sheet.Sheet__Groups[0];
    assert.deepEqual(plain(made.Group__Members), [ cgi, a, dim, plan ], 'every kind is in, the viewport included');
    assert.deepEqual(f.state.selection, [ { kind : 'group', id : made.Group__Id } ]);
    assert.deepEqual(f.state.touches, [ 'groups' ], 'one announcement');
    const normalised = f.ctx.Na__LeRec__NormaliseGroup({ Group__Members : [ a, dim, plan, cgi, a, { kind : 'paper', id : 'x' } ] });
    assert.deepEqual(plain(normalised.Group__Members), [ a, dim, plan, cgi ], 'a saved group keeps every member once; a kind no group holds drops out');
});


test('a click or a box on a grouped bubble or dimension takes the outermost group', () => {
    const f = fixture();
    const a   = bubble(f, 'A', 50, 30, 120, 20);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70 });
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    f.add('group', 'Inner', { Group__Members : [ a, dim ] });
    f.add('group', 'Outer', { Group__Members : [ { kind : 'group', id : 'Inner' }, cgi ] });
    assert.deepEqual(plain(f.ctx.Na__LeGroup__Resolve(f.sheet, { kind : 'leader', id : 'A', hit : null })), { kind : 'group', id : 'Outer', hit : null });
    assert.deepEqual(plain(f.ctx.Na__LeGroup__Resolve(f.sheet, { kind : 'dimension', id : 'Dim_1' })), { kind : 'group', id : 'Outer' });
    assert.deepEqual(plain(f.ctx.Na__LeGroup__ResolveItems(f.sheet, [ a, dim, cgi ])), [ { kind : 'group', id : 'Outer' } ], 'a box takes the group once');
    const bounds = f.ctx.Na__LeGroup__Bounds(f.sheet, 'Outer');
    assert.deepEqual(plain(bounds), { X : 0, Y : 0, WidthMm : 120, HeightMm : 70 }, 'the blue box takes in the bubble and the dimension');
});


test('a group moves as one piece: every tip goes, even one pointing at a drawing left behind', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    viewport(f, 'VP_Other', 200, 0, 150, 100);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const b = bubble(f, 'B', 260, 40, 150, 90);                              // <-- Points into the other drawing
    const t = note(f, 'T', 130, 50, 280, 60);                                // <-- So does this note's leader
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70 });
    f.add('group', 'G', { Group__Members : [ cgi, a, b, t, dim ] });
    f.move([ { kind : 'group', id : 'G' } ], 25, -5);
    assert.deepEqual(f.tip('A'), [ 75, 25 ]);
    assert.deepEqual(f.tip('B'), [ 285, 35 ], 'a group never comes apart');
    const moved = f.find('annotation', 'T');
    assert.deepEqual([ moved.Annotation__LeaderXMm, moved.Annotation__LeaderYMm ], [ 305, 55 ]);
    const d = f.find('dimension', 'Dim_1');
    assert.deepEqual([ d.Dimension__StartXMm, d.Dimension__EndXMm, d.Dimension__StartYMm ], [ 25, 125, 65 ]);
});


test('a group of notes and bubbles alone moves whole too, nested or not', () => {
    const f = fixture();
    picture(f, 'CGI', 0, 0, 100, 60);                                        // <-- Not in the group: it stays
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const b = bubble(f, 'B', 60, 40, 130, 30);
    const t = note(f, 'T', 140, 50, 70, 45);
    f.add('group', 'Inner', { Group__Members : [ a, b ] });
    f.add('group', 'Outer', { Group__Members : [ { kind : 'group', id : 'Inner' }, t ] });
    f.move([ { kind : 'group', id : 'Outer' } ], -10, 0);
    assert.deepEqual(f.tip('A'), [ 40, 30 ]);
    assert.deepEqual(f.tip('B'), [ 50, 40 ]);
    assert.equal(f.find('annotation', 'T').Annotation__LeaderXMm, 60);
});


test('a group moved with loose bubbles: the group is whole, the loose ones take the pointing rule', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    viewport(f, 'VP_Other', 200, 0, 150, 100);
    const inGroup = bubble(f, 'InGroup', 260, 40, 150, 90);
    const loose   = bubble(f, 'Loose', 270, 50, 160, 95);
    f.add('group', 'G', { Group__Members : [ cgi, inGroup ] });
    f.move([ { kind : 'group', id : 'G' }, loose ], 0, 10);
    assert.deepEqual(f.tip('InGroup'), [ 260, 50 ]);
    assert.deepEqual(f.tip('Loose'), [ 270, 50 ], 'loose, it keeps pointing at the drawing that stayed');
});


test('inside an open group, members picked loose take the pointing rule, and the group draws its bubbles', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const b = bubble(f, 'B', 20, 20, 130, 30);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70 });
    f.add('group', 'G', { Group__Members : [ cgi, a, b, dim ] });
    assert.equal(f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' }), true);
    assert.deepEqual(plain(f.ctx.Na__LeScope__Contents(f.sheet)), [ cgi, a, b, dim ], 'the focus layer redraws the bubbles and the dimension, not only vectors and text');
    assert.deepEqual(plain(f.ctx.Na__LeScope__Resolve(f.sheet, { kind : 'leader', id : 'A' })), { kind : 'leader', id : 'A' }, 'inside, a bubble is itself');
    f.move([ a, b ], 30, 0);                                                 // <-- Two bubbles tidied inside the group: no group record among them
    assert.deepEqual(f.tip('A'), [ 50, 30 ], 'the picture stays, so the tips stay on it');
    assert.deepEqual(f.anchor('A'), [ 150, 20 ]);
    f.move([ cgi, a ], 0, 5);
    assert.deepEqual(f.tip('A'), [ 50, 35 ], 'with the picture picked too, the tip goes with it');
    f.ctx.Na__LeScope__Clear();
});


test('a copy carries every tip (options.rigid), even of bubbles copied on their own', () => {
    const f = fixture();
    picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const t = note(f, 'T', 130, 50, 40, 40);
    f.move([ a, t ], 0, 80, { rigid : true });
    assert.deepEqual(f.tip('A'), [ 50, 110 ]);
    assert.equal(f.find('annotation', 'T').Annotation__LeaderYMm, 120);
});


test('the prune keeps a group of bubbles and a dimension, drops a deleted one, and a delete takes the lot', () => {
    const f = fixture();
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const b = bubble(f, 'B', 60, 40, 130, 30);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70 });
    const other = f.add('shape', 'Elsewhere', { Shape__Points : rect(300, 300, 10, 10), Shape__LayerId : 'vectors' });
    f.add('group', 'G', { Group__Members : [ a, b, dim ] });
    assert.equal(f.ctx.Na__LeModel__DeleteItems(f.sheet, [ other ]), 1, 'a delete elsewhere on the sheet');
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ a, b, dim ], 'leaves the group whole');
    f.ctx.Na__LeModel__DeleteItems(f.sheet, [ a ]);
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ b, dim ], 'a deleted bubble leaves the group');
    f.ctx.Na__LeModel__DeleteItems(f.sheet, f.ctx.Na__LeGroup__Expand(f.sheet, [ { kind : 'group', id : 'G' } ]));
    assert.deepEqual([ f.sheet.Sheet__Leaders.length, f.sheet.Sheet__Dimensions.length, f.sheet.Sheet__Groups.length ], [ 0, 0, 0 ], 'deleting the group takes its bubbles and its dimension');
});


test('ungrouping lets the bubbles and the dimension out as items', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 70, Dimension__EndXMm : 100, Dimension__EndYMm : 70 });
    f.add('group', 'G', { Group__Members : [ cgi, a, dim ] });
    f.state.selection = [ { kind : 'group', id : 'G' } ];
    assert.equal(f.ctx.Na__LeGroup__Ungroup(f.sheet), true);
    assert.equal(f.sheet.Sheet__Groups.length, 0);
    assert.deepEqual(f.state.selection, [ cgi, a, dim ]);
});


// -----------------------------------------------------------------------------
// VIEWPORTS IN GROUPS (v2.142.0)
// -----------------------------------------------------------------------------

test('a press on a grouped frame takes its group; a locked frame stays background; inside the group the member answers', () => {
    const f = fixture();
    const plan  = viewport(f, 'VP_Plan', 0, 0, 200, 120);
    viewport(f, 'VP_Other', 300, 0, 100, 100);
    const a = bubble(f, 'A', 50, 50, 250, 20);
    f.add('group', 'G', { Group__Members : [ plan, a ] });
    const at = { x : 100, y : 60 };
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, at)), { kind : 'group', id : 'G', hit : null }, 'at the sheet the frame answers as its group');
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, { x : 350, y : 50 })), { kind : 'viewport', id : 'VP_Other', hit : null }, 'a loose frame answers as itself');
    f.state.locked.add('locked');
    f.find('viewport', 'VP_Plan').Viewport__LayerId = 'locked';
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, at)), { kind : 'viewport', id : 'VP_Plan', hit : null }, 'a locked frame is background at the sheet: a press on it still starts a box');
    f.find('viewport', 'VP_Plan').Viewport__LayerId = 'viewports';
    assert.equal(f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' }), true);
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, at)), { kind : 'viewport', id : 'VP_Plan', hit : null }, 'inside the open group the member frame answers as itself');
    assert.equal(f.ctx.Na__LeTools__Resolve(f.sheet, { x : 350, y : 50 }), null, 'a frame outside the open group is not there: the press steps back out');
    assert.deepEqual(plain(f.ctx.Na__LeScope__Contents(f.sheet)), [ plan, a ], 'the open group lists its viewport among what it holds');
    f.ctx.Na__LeScope__Clear();
});


test('inside an open group a member frame is found behind a frame the group does not hold', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 0, 0, 200, 120);
    viewport(f, 'VP_Over', 50, 20, 100, 60);                                  // <-- Later in the list: in front of the plan
    const a = bubble(f, 'A', 50, 50, 250, 20);
    f.add('group', 'G', { Group__Members : [ plan, a ] });
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, { x : 100, y : 50 })), { kind : 'viewport', id : 'VP_Over', hit : null }, 'at the sheet the front frame answers');
    f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' });
    assert.deepEqual(plain(f.ctx.Na__LeTools__Resolve(f.sheet, { x : 100, y : 50 })), { kind : 'viewport', id : 'VP_Plan', hit : null }, 'inside the group the faded frame in front is looked through');
    f.ctx.Na__LeScope__Clear();
});


test('a click outside an inner group on a frame the outer group holds steps back out to the outer group, not out of everything', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 0, 0, 200, 120);
    const a = bubble(f, 'A', 300, 300, 350, 320);
    const b = bubble(f, 'B', 310, 310, 360, 330);
    f.add('group', 'Inner', { Group__Members : [ a, b ] });
    f.add('group', 'Outer', { Group__Members : [ { kind : 'group', id : 'Inner' }, plan ] });
    assert.equal(f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'Outer' }), true);
    assert.equal(f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'Inner' }), true);
    const raw = f.ctx.Na__LeTools__RawHit(f.sheet, { x : 100, y : 60 });
    assert.deepEqual(plain(raw), { kind : 'viewport', id : 'VP_Plan' }, 'with no markup under the pointer the frame is what is there');
    assert.equal(f.ctx.Na__LeScope__ExitTo(f.sheet, raw), true);
    assert.deepEqual(plain(f.ctx.Na__LeScope__Path()), [ { kind : 'group', id : 'Outer' } ]);
    f.ctx.Na__LeScope__Clear();
});


test('a group holding a viewport moves the frame with its notes, tips and all; a locked frame stays put', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 10, 10, 200, 120);
    const a = bubble(f, 'A', 60, 60, 260, 30);
    const t = note(f, 'T', 230, 100, 120, 90);
    f.add('group', 'G', { Group__Members : [ plan, a, t ] });
    f.move([ { kind : 'group', id : 'G' } ], 30, -5);
    assert.deepEqual([ f.find('viewport', 'VP_Plan').Viewport__FrameMm.X, f.find('viewport', 'VP_Plan').Viewport__FrameMm.Y ], [ 40, 5 ]);
    assert.deepEqual(f.tip('A'), [ 90, 55 ]);
    assert.deepEqual([ f.find('annotation', 'T').Annotation__PosXMm, f.find('annotation', 'T').Annotation__LeaderXMm ], [ 260, 150 ]);
    f.state.locked.add('locked');
    f.find('viewport', 'VP_Plan').Viewport__LayerId = 'locked';
    f.move([ { kind : 'group', id : 'G' } ], 10, 0);
    assert.equal(f.find('viewport', 'VP_Plan').Viewport__FrameMm.X, 40, 'a locked frame is left where it is, grouped or not');
    assert.deepEqual(f.tip('A'), [ 100, 55 ], 'while the rest of the group moves, as it always has for a locked member');
});


test('the blue box takes in a viewport: the upright box round a turned one', () => {
    const f = fixture();
    const turned = viewport(f, 'VP_Turned', 0, 0, 200, 100, 'viewports', { Viewport__RotationDeg : 90 });   // <-- Centre (100, 50): turned, it stands 100 wide and 200 tall
    const a = bubble(f, 'A', 300, 300, 320, 310);
    f.add('group', 'G', { Group__Members : [ turned, a ] });
    const b = f.ctx.Na__LeGroup__Bounds(f.sheet, 'G');
    assert.deepEqual([ b.X, b.Y, b.WidthMm, b.HeightMm ].map((v) => Math.round(v * 1000) / 1000), [ 50, -50, 270, 360 ]);
});


test('a group holding a viewport or a dimension waits for M, as they do alone; a group of pictures and bubbles picks it up', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 0, 0, 200, 120);
    const a = bubble(f, 'A', 50, 50, 250, 20);
    const cgi = picture(f, 'CGI', 300, 0, 100, 60);
    const b = bubble(f, 'B', 320, 30, 420, 20);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 200, Dimension__EndXMm : 100, Dimension__EndYMm : 200 });
    const c = bubble(f, 'C', 20, 220, 60, 240);
    const d = bubble(f, 'D', 30, 230, 70, 250);
    f.add('group', 'WithPlan', { Group__Members : [ plan, a ] });
    f.add('group', 'Plain', { Group__Members : [ cgi, b ] });
    f.add('group', 'Deep', { Group__Members : [ dim, c ] });
    f.add('group', 'Holder', { Group__Members : [ { kind : 'group', id : 'Deep' }, d ] });
    assert.equal(f.ctx.Na__LeTools__SelectionPicksUpMove([ { kind : 'group', id : 'WithPlan' } ]), false);
    assert.equal(f.ctx.Na__LeTools__SelectionPicksUpMove([ { kind : 'group', id : 'Plain' } ]), true);
    assert.equal(f.ctx.Na__LeTools__SelectionPicksUpMove([ { kind : 'group', id : 'Holder' } ]), false, 'a dimension a nested group holds counts');
    assert.equal(f.ctx.Na__LeTools__SelectionPicksUpMove([ { kind : 'group', id : 'Plain' }, { kind : 'group', id : 'WithPlan' } ]), false);
});


test('deleting one grouped leader, dimension or viewport on its own lets the group go of it, and a group left with one member dissolves', () => {
    const f = fixture();
    const plan = viewport(f, 'VP_Plan', 0, 0, 200, 120);
    const a = bubble(f, 'A', 50, 50, 250, 20);
    const b = bubble(f, 'B', 60, 60, 260, 30);
    const dim = f.add('dimension', 'Dim_1', { Dimension__StartXMm : 0, Dimension__StartYMm : 130, Dimension__EndXMm : 200, Dimension__EndYMm : 130, Dimension__ViewportId : 'VP_Plan' });
    f.add('group', 'G', { Group__Members : [ plan, a, b, dim ] });
    assert.equal(f.ctx.Na__LeModel__DeleteLeader(f.sheet, 'A'), true);
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ plan, b, dim ], 'the leader leaves the group');
    assert.equal(f.ctx.Na__LeModel__DeleteDimension(f.sheet, 'Dim_1'), true);
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ plan, b ], 'so does the dimension');
    assert.equal(f.ctx.Na__LeModel__DeleteViewport(f.sheet, 'VP_Plan'), true);
    assert.equal(f.sheet.Sheet__Groups.length, 0, 'and with the viewport gone, a group of one is no group');
    assert.equal(f.find('leader', 'B').Leader__Id, 'B', 'its last member stays on the sheet');
});


// -----------------------------------------------------------------------------
// PLACED INSIDE AN OPEN GROUP (v2.142.0)
// -----------------------------------------------------------------------------

test('with the Leader tool up inside an open group the leader it places joins the group when it lands, and nothing older is taken', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    bubble(f, 'Outside', 400, 400, 420, 380);
    f.add('group', 'G', { Group__Members : [ cgi, a ] });
    assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup('leader'), false, 'with nothing open a placing tool closes nothing and joins nothing');
    f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' });
    assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup('leader'), true);
    assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup('draw'), false, 'the vector tools keep their own rule (Na__LeVec__KeepsContainer)');
    assert.equal(f.ctx.Na__LeScope__BeginAdopting(f.sheet, [ f.ctx.Na__LeTools__PLACE_KINDS.leader ]), true);
    bubble(f, 'New', 20, 20, 60, 10);                                        // <-- Made silently at the press ...
    f.ctx.Na__LeModel__Touch('leader', f.sheet.Sheet__Id, 'New');             // <-- ... announced as the head lands
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ cgi, a, { kind : 'leader', id : 'New' } ], 'it joined, before the announcement the history snapshots');
    f.ctx.Na__LeModel__Touch('leader', f.sheet.Sheet__Id, 'Outside');         // <-- An older leader outside the group, edited (the eyedropper painting it)
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'leader', 'Outside'), null, 'an edit is never a placement');
    note(f, 'T_New', 30, 90, 10, 10);
    f.ctx.Na__LeModel__Touch('annotations', f.sheet.Sheet__Id, 'T_New');
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'annotation', 'T_New'), null, 'the Leader tool\'s window takes leaders only');
    f.ctx.Na__LeScope__EndAdopting();
    bubble(f, 'Later', 25, 25, 65, 15);
    f.ctx.Na__LeModel__Touch('leaders', f.sheet.Sheet__Id, 'Later');
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'leader', 'Later'), null, 'the window closes with the tool');
    f.ctx.Na__LeScope__Clear();
});


test('text and dimensions join the same way; with the switch off, nothing open, or a vector open inside the group, nothing joins', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const line = f.add('shape', 'Line', { Shape__Points : [ [ 0, 70 ], [ 100, 70 ] ], Shape__LayerId : 'vectors' });
    f.add('group', 'G', { Group__Members : [ cgi, line ] });
    f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' });
    [ [ 'text', 'annotation', 'annotations' ], [ 'dimension', 'dimension', 'dimension' ] ].forEach(([ tool, kind, reason ], i) => {
        assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup(tool), true, tool);
        f.ctx.Na__LeScope__BeginAdopting(f.sheet, [ f.ctx.Na__LeTools__PLACE_KINDS[tool] ]);
        const id = 'Placed_' + i;
        if (kind === 'annotation') note(f, id, 10, 10, 0, 0);
        else f.add('dimension', id, { Dimension__StartXMm : 0, Dimension__StartYMm : 80, Dimension__EndXMm : 90, Dimension__EndYMm : 80 });
        f.ctx.Na__LeModel__Touch(reason, f.sheet.Sheet__Id, id);
        assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, kind, id).Group__Id, 'G', tool + ' places into the group');
    });
    f.state.vectorsOn = false;
    assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup('text'), false, 'DrawInsideOpenGroup off: picking the tool closes the group, as before');
    f.state.vectorsOn = true;
    assert.equal(f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'shape', id : 'Line' }), true);
    assert.equal(f.ctx.Na__LeTools__PlacesIntoGroup('text'), false, 'a vector open for its points is not a group');
    assert.equal(f.ctx.Na__LeScope__BeginAdopting(f.sheet, [ 'annotation' ]), false);
    f.ctx.Na__LeScope__Clear();
    assert.equal(f.ctx.Na__LeScope__BeginAdopting(f.sheet, [ 'annotation' ]), false, 'nothing open: no window');
});


test('a picture dropped or a viewport added while a group is open joins it, and the window that was open comes back', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    f.add('group', 'G', { Group__Members : [ cgi, a ] });
    f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' });
    f.ctx.Na__LeScope__BeginAdopting(f.sheet, [ 'leader' ]);                   // <-- The Leader tool is up
    const made = f.ctx.Na__LeScope__WithAdoption(f.sheet, [ 'viewport' ], () => {
        viewport(f, 'VP_New', 200, 0, 100, 80);
        f.ctx.Na__LeModel__Touch('viewports', f.sheet.Sheet__Id, 'VP_New');
        return 'placed';
    });
    assert.equal(made, 'placed');
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'viewport', 'VP_New').Group__Id, 'G');
    f.ctx.Na__LeScope__WithAdoption(f.sheet, [ 'shape' ], () => {
        picture(f, 'Dropped', 0, 100, 50, 30);
        f.ctx.Na__LeModel__Touch('shapes', f.sheet.Sheet__Id, 'Dropped');
    });
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'shape', 'Dropped').Group__Id, 'G');
    assert.equal(f.ctx.Na__LeScope__IsAdopting(), true, 'the Leader tool\'s window is back');
    bubble(f, 'New', 20, 20, 60, 10);
    f.ctx.Na__LeModel__Touch('leader', f.sheet.Sheet__Id, 'New');
    assert.equal(f.ctx.Na__LeGroup__ParentOf(f.sheet, 'leader', 'New').Group__Id, 'G');
    f.ctx.Na__LeScope__EndAdopting();
    f.ctx.Na__LeScope__Clear();
});


test('a paste inside an open group: its roots join, a pasted group nests whole, and a group never goes inside itself', () => {
    const f = fixture();
    const cgi = picture(f, 'CGI', 0, 0, 100, 60);
    const a = bubble(f, 'A', 50, 30, 120, 20);
    f.add('group', 'G', { Group__Members : [ cgi, a ] });
    const p1 = bubble(f, 'P1', 10, 10, 40, 5);
    const p2 = bubble(f, 'P2', 11, 11, 41, 6);
    const p3 = bubble(f, 'P3', 12, 12, 42, 7);
    f.add('group', 'Pasted', { Group__Members : [ p2, p3 ] });
    assert.equal(f.ctx.Na__LeScope__AdoptIntoOpenGroup(f.sheet, [ p1 ]), 0, 'nothing open: nothing joins');
    f.ctx.Na__LeScope__Enter(f.sheet, { kind : 'group', id : 'G' });
    const joined = f.ctx.Na__LeScope__AdoptIntoOpenGroup(f.sheet, [ p1, { kind : 'group', id : 'Pasted' }, { kind : 'group', id : 'G' }, a, { kind : 'leader', id : 'Gone' } ]);
    assert.equal(joined, 2, 'the loose leader and the pasted group - not the open group itself, a member it has, or something gone');
    assert.deepEqual(plain(f.find('group', 'G').Group__Members), [ cgi, a, p1, { kind : 'group', id : 'Pasted' } ]);
    assert.deepEqual(plain(f.find('group', 'Pasted').Group__Members), [ p2, p3 ], 'the pasted group keeps its own members');
    f.ctx.Na__LeScope__Clear();
});
