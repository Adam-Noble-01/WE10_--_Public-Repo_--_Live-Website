// =============================================================================
// TRUEVISION3D - TEST - THE LAYER FLYOUT AND REFERENCE LAYERS
// =============================================================================
//
// FILE       : Na__Test__LayerMenu__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Layer Menu and Reference Layer Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the right-click Layer flyout moves what it says it moves, and that a reference layer is seen but never picked, boxed or snapped to
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE RECORD. NormaliseLayer keeps Layer__Selectable only as false, so a
//   layer from before it is byte-identical.
// - THE MODEL (Na__LayoutEditor__SheetModel__Layers__). IsLayerSelectable,
//   UpdateLayer's selectable, the selection trim when a layer goes out of
//   reach, ItemLayerId, and MoveToLayer: every kind at once, locks in both
//   directions, one announcement, nothing announced when nothing moved.
// - THE MENU (Na__LayoutEditor__LayerMenu__). The Layer row and its rule, the
//   flyout in list order, the dot and the rings, what each layer says about
//   itself, a group opened up, and the toast.
// - THE COPIES (Na__LayoutEditor__ItemClipboard__ and InsertShape). A Ctrl-drag
//   copy on its own sheet keeps a user's own General layer; a paste onto
//   ANOTHER sheet still needs a layer of its type; nothing lands on a
//   reference layer; InsertShape keeps a layer the sheet has, and a dead id
//   falls back by kind.
// - THE POINTER. The snapper offers nothing on a reference layer and still
//   offers a locked one's points; the markup hit test and the selection box
//   pass straight through a reference layer.
// - Built on RB05's Rear Elevation as it is stored: Text, Dimensions, Vectors,
//   Floor Areas and Viewports, with a Construction Lines layer (typed General)
//   added the way the Layers panel's Add makes one.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__LayerMenu__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Layer flyout and reference layers.
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

    async function load(relative, stubs, tag) {
        let src = readFileSync(resolve(SRC, relative), 'utf8');
        const had = /^\s*import\s/m.test(src);
        // The trailing `// <-- ...` note some imports carry is part of the line.
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = join(tmpdir(), 'Na__Test__LayerMenu__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    // The same {tokens} filling the config's FormatLabel does, over the fallback
    const FORMAT = 'const Na__LeCfg__FormatLabel = (k, f, t) => { let s = f; Object.keys(t || {}).forEach((key) => { s = s.split("{" + key + "}").join(String(t[key])); }); return s; };';

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

    console.log('TrueVision3D - the Layer flyout and reference layers');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet: RB05 Rear Elevation, With a Construction Lines Layer
// -----------------------------------------------------------------------------

    const layer = (id, name, type, order, extra) => Object.assign({ Layer__Id : id, Layer__Name : name, Layer__Type : type, Layer__Visible : true, Layer__Locked : false, Layer__Order : order }, extra || {});
    const rear = () => ({
        Sheet__Id : 'Sheet_004',
        Sheet__Layers : [
            layer('Layer_002', 'Text', 'annotation', 1),
            layer('Layer_006', 'Construction Lines', 'mixed', 2),                   // <-- Added in the panel with All layers: a General layer
            layer('Layer_003', 'Dimensions', 'dimension', 3),
            layer('Layer_004', 'Vectors', 'vector', 4),
            layer('Layer_005', 'Floor Areas', 'area', 5),
            layer('Layer_001', 'Viewports', 'viewport', 6)
        ],
        Sheet__Viewports   : [ { Viewport__Id : 'Viewport_001', Viewport__LayerId : 'Layer_001', Viewport__Locked : true } ],
        Sheet__Annotations : [ { Annotation__Id : 'Text_001', Annotation__LayerId : 'Layer_002' } ],
        Sheet__Dimensions  : [ { Dimension__Id : 'Dim_001', Dimension__LayerId : 'Layer_003' } ],
        Sheet__Shapes      : [
            { Shape__Id : 'Shape_032', Shape__LayerId : 'Layer_004' },          // <-- Three of the red construction lines
            { Shape__Id : 'Shape_033', Shape__LayerId : 'Layer_004' },
            { Shape__Id : 'Shape_034', Shape__LayerId : 'Layer_004' },
            { Shape__Id : 'Shape_001', Shape__LayerId : 'Layer_004' }           // <-- A line of the drawing itself
        ],
        Sheet__Leaders     : [ { Leader__Id : 'Leader_001', Leader__LayerId : 'Layer_002' } ],
        Sheet__Groups      : [
            { Group__Id : 'Group_001', Group__Members : [ { kind : 'shape', id : 'Shape_001' }, { kind : 'annotation', id : 'Text_001' } ] },
            { Group__Id : 'Group_002', Group__Members : [ { kind : 'shape', id : 'Shape_033' }, { kind : 'shape', id : 'Shape_034' } ] }
        ]
    });
    const find  = (s, id) => s.Sheet__Layers.find((l) => l.Layer__Id === id);
    const shape = (s, id) => s.Sheet__Shapes.find((x) => x.Shape__Id === id);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    const R = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', `
        const Na__LeCfg__GetViewportSetup = () => ({ minSizeMm : 10, defaultWidthMm : 100, defaultHeightMm : 80 });
        const Na__LeCfg__GetLabel = (k, f) => f;
        const Na__LeCfg__GetSheetSetup = () => ({});
    `, 'Records');
    const stored = { Layer__Id : 'Layer_002', Layer__Name : 'Text', Layer__Type : 'annotation', Layer__Visible : true, Layer__Locked : false, Layer__Order : 1 };
    check('a layer from before reference layers comes out of the normaliser byte-identical',
        JSON.stringify(R.Na__LeRec__NormaliseLayer(JSON.parse(JSON.stringify(stored)), 0)), JSON.stringify(stored));
    check('a reference layer keeps Layer__Selectable false',
        R.Na__LeRec__NormaliseLayer(Object.assign({}, stored, { Layer__Selectable : false }), 0).Layer__Selectable, false);
    check('true, or anything else, is not stored: selectable is every layer\'s default',
        [ 'Layer__Selectable' in R.Na__LeRec__NormaliseLayer(Object.assign({}, stored, { Layer__Selectable : true }), 0),
          'Layer__Selectable' in R.Na__LeRec__NormaliseLayer(Object.assign({}, stored, { Layer__Selectable : 'no' }), 0) ], [ false, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Model: Reach, the Selection Trim and MoveToLayer
// -----------------------------------------------------------------------------

    const M = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetModel__Layers__.js', `
        const Na__LeRec__NextId = (list, prefix) => prefix + String(list.length + 1).padStart(3, '0');
        const Na__LeRec__Find = (list, key, id) => (list || []).find((r) => r && r[key] === id) || null;
        const Na__LeRec__NormaliseLayer = (l) => l;
        const Na__LeRec__DefaultLayerId = (sheet, type) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Type === type); return l ? l.Layer__Id : sheet.Sheet__Layers[0].Layer__Id; };
        const Na__LeModel__LAYER_TYPES = [ 'viewport', 'annotation', 'dimension', 'vector', 'area', 'image', 'mixed' ];
        let   Na__LeModel__ActiveSheetId  = 'Sheet_004';
        let   Na__LeModel__SelectionItems = [];
        const Na__Test__Said = [];
        const Na__LeModel__Touch = (reason) => { Na__Test__Said.push(reason); };
        const Na__LeModel__AssignSelectionItems = (items) => { Na__LeModel__SelectionItems = items; };
        export const Na__Test__Hooks = {
            said      : Na__Test__Said,
            select    : (items) => { Na__LeModel__SelectionItems = items; },
            selection : () => Na__LeModel__SelectionItems.map((item) => item.kind + ':' + item.id),
            active    : (id) => { Na__LeModel__ActiveSheetId = id; }
        };
    `, 'Model');
    const H = M.Na__Test__Hooks;
    const heard = () => H.said.splice(0, H.said.length);

    // REACH
    let s = rear();
    check('IsLayerSelectable: a layer with no key, and a layer the sheet does not have, are both selectable',
        [ M.Na__LeModel__IsLayerSelectable(s, 'Layer_006'), M.Na__LeModel__IsLayerSelectable(s, 'Layer_999') ], [ true, true ]);
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : false });
    check('Ref on: the record stores false, it reads unselectable, and it is announced once as layers',
        [ find(s, 'Layer_006').Layer__Selectable, M.Na__LeModel__IsLayerSelectable(s, 'Layer_006'), heard() ], [ false, false, [ 'layers' ] ]);
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : true });
    check('Ref off: the key comes off the record again',
        [ 'Layer__Selectable' in find(s, 'Layer_006'), M.Na__LeModel__IsLayerSelectable(s, 'Layer_006'), heard() ], [ false, true, [ 'layers' ] ]);

    // THE SELECTION TRIM
    s = rear();
    s.Sheet__Shapes.forEach((x) => { if (x.Shape__Id !== 'Shape_001') x.Shape__LayerId = 'Layer_006'; });   // <-- The construction lines on their own layer
    H.select([ { kind : 'shape', id : 'Shape_032' }, { kind : 'shape', id : 'Shape_001' }, { kind : 'group', id : 'Group_001' }, { kind : 'group', id : 'Group_002' } ]);
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : false });
    check('Ref on takes its items out of the selection: the line on it, and the group all of whose members are on it; the rest stay',
        H.selection(), [ 'shape:Shape_001', 'group:Group_001' ]);
    heard();
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : true });
    H.select([ { kind : 'shape', id : 'Shape_032' } ]);
    H.active('Sheet_009');
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : false });
    check('only the sheet being worked on is trimmed: an id on another sheet names another record',
        H.selection(), [ 'shape:Shape_032' ]);
    H.active('Sheet_004');
    M.Na__LeModel__UpdateLayer(s, 'Layer_006', { selectable : true });
    H.select([ { kind : 'shape', id : 'Shape_001' }, { kind : 'group', id : 'Group_001' } ]);
    M.Na__LeModel__UpdateLayer(s, 'Layer_004', { visible : false });
    check('hiding a layer trims the selection too, as Blender deselects what it hides; a group with a member still shown stays',
        H.selection(), [ 'group:Group_001' ]);
    heard();

    // ITEMLAYERID
    s = rear();
    check('ItemLayerId reads every layered kind, and null for a group or an item that is gone',
        [ 'viewport:Viewport_001', 'annotation:Text_001', 'dimension:Dim_001', 'shape:Shape_032', 'leader:Leader_001', 'group:Group_001', 'shape:Shape_999' ]
            .map((key) => M.Na__LeModel__ItemLayerId(s, { kind : key.split(':')[0], id : key.split(':')[1] })),
        [ 'Layer_001', 'Layer_002', 'Layer_003', 'Layer_004', 'Layer_002', null, null ]);

    // MOVETOLAYER
    s = rear();
    H.select([ { kind : 'shape', id : 'Shape_032' }, { kind : 'annotation', id : 'Text_001' } ]);
    const everything = [ 'viewport:Viewport_001', 'annotation:Text_001', 'dimension:Dim_001', 'shape:Shape_032', 'leader:Leader_001', 'group:Group_001' ]
        .map((key) => ({ kind : key.split(':')[0], id : key.split(':')[1] }));
    const moved = M.Na__LeModel__MoveToLayer(s, everything, 'Layer_006');
    check('every kind moves at once - a viewport under its own lock too, as that lock holds its framing, not its layer - and a group record is passed over',
        [ moved, s.Sheet__Viewports[0].Viewport__LayerId, s.Sheet__Annotations[0].Annotation__LayerId, s.Sheet__Dimensions[0].Dimension__LayerId,
          shape(s, 'Shape_032').Shape__LayerId, s.Sheet__Leaders[0].Leader__LayerId, shape(s, 'Shape_033').Shape__LayerId ],
        [ 5, 'Layer_006', 'Layer_006', 'Layer_006', 'Layer_006', 'Layer_006', 'Layer_004' ]);
    check('one announcement for the lot, as layers: one undo step, and the whole sheet restacks',
        heard(), [ 'layers' ]);
    check('moved onto a layer that is shown and selectable, the selection stays as it was',
        H.selection(), [ 'shape:Shape_032', 'annotation:Text_001' ]);
    check('nothing to move - everything already there - announces nothing',
        [ M.Na__LeModel__MoveToLayer(s, everything, 'Layer_006'), heard() ], [ 0, [] ]);

    s = rear();
    find(s, 'Layer_003').Layer__Locked = true;
    check('an item on a locked layer stays where it is',
        [ M.Na__LeModel__MoveToLayer(s, [ { kind : 'dimension', id : 'Dim_001' } ], 'Layer_006'), s.Sheet__Dimensions[0].Dimension__LayerId, heard() ], [ 0, 'Layer_003', [] ]);
    check('and a locked layer takes nothing',
        [ M.Na__LeModel__MoveToLayer(s, [ { kind : 'shape', id : 'Shape_032' } ], 'Layer_003'), shape(s, 'Shape_032').Shape__LayerId ], [ 0, 'Layer_004' ]);
    check('a layer that does not exist takes nothing either',
        M.Na__LeModel__MoveToLayer(s, [ { kind : 'shape', id : 'Shape_032' } ], 'Layer_999'), 0);

    s = rear();
    find(s, 'Layer_006').Layer__Visible = false;
    H.select([ { kind : 'shape', id : 'Shape_032' }, { kind : 'shape', id : 'Shape_001' } ]);
    M.Na__LeModel__MoveToLayer(s, [ { kind : 'shape', id : 'Shape_032' } ], 'Layer_006');
    check('a line put away on a HIDDEN layer leaves the selection - no Delete can reach what cannot be seen',
        H.selection(), [ 'shape:Shape_001' ]);
    s = rear();
    find(s, 'Layer_006').Layer__Selectable = false;
    H.select([ { kind : 'shape', id : 'Shape_032' }, { kind : 'shape', id : 'Shape_001' } ]);
    M.Na__LeModel__MoveToLayer(s, [ { kind : 'shape', id : 'Shape_032' } ], 'Layer_006');
    check('and one put on a REFERENCE layer leaves it too - it can no longer be picked',
        H.selection(), [ 'shape:Shape_001' ]);
    heard();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Menu: the Layer Row and Its Flyout
// -----------------------------------------------------------------------------

    const L = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__LayerMenu__.js', `
        const Na__LeCfg__GetLabel = (k, f) => f;
        ${FORMAT}
        const Na__LeModel__GetLayers = (sheet) => sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order);
        const Na__Test__Keys = { viewport : [ 'Sheet__Viewports', 'Viewport__Id', 'Viewport__LayerId' ], annotation : [ 'Sheet__Annotations', 'Annotation__Id', 'Annotation__LayerId' ],
                                 dimension : [ 'Sheet__Dimensions', 'Dimension__Id', 'Dimension__LayerId' ], shape : [ 'Sheet__Shapes', 'Shape__Id', 'Shape__LayerId' ], leader : [ 'Sheet__Leaders', 'Leader__Id', 'Leader__LayerId' ] };
        const Na__LeModel__ItemLayerId = (sheet, item) => { const k = Na__Test__Keys[item.kind]; const r = k ? sheet[k[0]].find((x) => x[k[1]] === item.id) : null; return r ? r[k[2]] : null; };
        const Na__LeModel__IsLayerLocked = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !!(l && l.Layer__Locked === true); };
        const Na__Test__Moves  = [];
        const Na__Test__Toasts = [];
        const Na__LeModel__MoveToLayer = (sheet, items, layerId) => { Na__Test__Moves.push({ items : items.map((i) => i.kind + ':' + i.id), layerId : layerId }); return items.filter((i) => i.layerId !== layerId).length; };
        const Na__LeGroup__Expand = (sheet, items) => {
            const out = []; const seen = new Set();
            const push = (item) => { const key = item.kind + ':' + item.id; if (seen.has(key)) return; seen.add(key); out.push({ kind : item.kind, id : item.id });
                if (item.kind === 'group') { const g = sheet.Sheet__Groups.find((x) => x.Group__Id === item.id); (g ? g.Group__Members : []).forEach(push); } };
            items.forEach(push);
            return out;
        };
        const Na__LePanels__GetContext = () => ({ showToast : (message) => Na__Test__Toasts.push(message) });
        export const Na__Test__Spy = { moves : Na__Test__Moves, toasts : Na__Test__Toasts };
    `, 'Menu');
    const spy     = L.Na__Test__Spy;
    const flyout  = (section) => section[0].submenu;
    const summary = (section) => flyout(section).map((row) => row.label + (row.checked === true ? ' *' : (row.checked === 'mixed' ? ' o' : '')) + (row.hint ? ' [' + row.hint + ']' : '') + (row.disabled ? ' (x)' : ''));

    s = rear();
    find(s, 'Layer_005').Layer__Visible = false;
    find(s, 'Layer_001').Layer__Locked  = true;
    let section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'shape', id : 'Shape_032' } ]);
    check('one construction line: a Layer row naming the layer it is on, then the rule that closes its section',
        [ section.length, section[0].label, section[0].hint, section[1].separator === true ], [ 2, 'Layer', 'Vectors', true ]);
    check('its flyout: the Layers list top first, Vectors dotted, a hidden layer saying so, a locked one greyed',
        summary(section), [ 'Text', 'Construction Lines', 'Dimensions', 'Vectors *', 'Floor Areas [Hidden]', 'Viewports [Locked] (x)' ]);
    find(s, 'Layer_006').Layer__Selectable = false;
    check('a reference layer says so, and is still offered - that is how a line is put out of reach',
        summary(L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'shape', id : 'Shape_032' } ]))[1], 'Construction Lines [Reference]');

    s = rear();
    section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'shape', id : 'Shape_032' }, { kind : 'annotation', id : 'Text_001' } ]);
    check('a selection over two layers: both ringed, and the row says how many',
        [ section[0].hint, summary(section).filter((row) => / o$/.test(row)) ], [ '2 layers', [ 'Text o', 'Vectors o' ] ]);

    section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'group', id : 'Group_002' }, { kind : 'shape', id : 'Shape_032' } ]);
    flyout(section)[1].onSelect();                                             // <-- Construction Lines
    check('a group is its members: picking a layer moves the members, and the group record never reaches the model',
        spy.moves.pop(), { items : [ 'shape:Shape_033', 'shape:Shape_034', 'shape:Shape_032' ], layerId : 'Layer_006' });
    check('and the toast names the layer, since nothing on the sheet moves',
        spy.toasts.pop(), 'Moved 3 items to Construction Lines.');

    section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'shape', id : 'Shape_032' } ]);
    flyout(section)[1].onSelect();
    check('one item: "Moved to ..."', spy.toasts.pop(), 'Moved to Construction Lines.');

    find(s, 'Layer_002').Layer__Locked = true;
    section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'shape', id : 'Shape_032' }, { kind : 'annotation', id : 'Text_001' }, { kind : 'shape', id : 'Shape_033' } ]);
    flyout(section)[1].onSelect();
    check('an item on a locked layer is left out of the move, and the toast says it stayed',
        [ spy.moves.pop().items, spy.toasts.pop() ], [ [ 'shape:Shape_032', 'shape:Shape_033' ], 'Moved 2 items to Construction Lines. 1 on a locked layer stayed where they were.' ]);

    section = L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'annotation', id : 'Text_001' } ]);
    check('everything held by a lock: every row greyed, the layer it is on still dotted, so it can still be looked up',
        summary(section), [ 'Text * [Locked] (x)', 'Construction Lines (x)', 'Dimensions (x)', 'Vectors (x)', 'Floor Areas (x)', 'Viewports (x)' ]);
    check('nothing that sits on a layer: no Layer row at all',
        L.Na__LeLayerMenu__MenuItems(s, [ { kind : 'group', id : 'Group_999' } ]), []);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Copies: InsertShape and the Clipboard
// -----------------------------------------------------------------------------

    const SH = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetModel__Shapes__.js', `
        const Na__LeRec__NextId = (list, prefix) => prefix + String(900 + list.length);
        const Na__LeRec__Find = (list, key, id) => (list || []).find((r) => r && r[key] === id) || null;
        const Na__LeRec__NormaliseShape = (item, defaultLayerId) => { if (!item.Shape__LayerId) item.Shape__LayerId = defaultLayerId; return item; };   // <-- As shipped: fills a MISSING id only
        const Na__LeModel__Touch = () => {};
        const Na__LeModel__Unselect = () => {};
        const Na__LeModel__AssignDirty = () => {};
        const Na__LeModel__GetLayerById = (sheet, id) => sheet.Sheet__Layers.find((l) => l.Layer__Id === id) || null;
        const Na__LeModel__DefaultLayerId = (sheet, type) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Type === type); return l ? l.Layer__Id : null; };
        const Na__LeModel__CreateLayer = () => null;
        const Na__LeModel__LayerIndexAboveDrawings = () => undefined;
        const Na__LeModel__PruneGroups = () => false;
    `, 'Shapes');
    s = rear();
    check('InsertShape keeps a layer the sheet has, whatever its type: a copy of a construction line stays on Construction Lines',
        SH.Na__LeModel__InsertShape(s, { Shape__LayerId : 'Layer_006' }, true).Shape__LayerId, 'Layer_006');
    check('and a layer id the sheet does not have falls back by kind - and the fallback is written, not thrown away',
        [ SH.Na__LeModel__InsertShape(s, { Shape__LayerId : 'Layer_999' }, true).Shape__LayerId,
          SH.Na__LeModel__InsertShape(s, { Shape__LayerId : 'Layer_999', Shape__Area : { Area__Name : 'Kitchen' } }, true).Shape__LayerId,
          SH.Na__LeModel__InsertShape(s, { Shape__LayerId : null }, true).Shape__LayerId ], [ 'Layer_004', 'Layer_005', 'Layer_004' ]);

    const C = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js', `
        const Na__LeCfg__GetClipboardSetup = () => ({ pasteOffsetMm : 5, copySnapshot : true });
        const Na__LeCfg__GetLabel = (k, f) => f;
        ${FORMAT}
        const Na__Test__Landed = [];
        const Na__LeModel__GetActiveSheet = () => null;
        const Na__LeModel__GetSelectionItems = () => [];
        const Na__LeModel__SetSelection = () => null;
        const Na__LeModel__SetSelectionItems = () => [];
        const Na__LeModel__GetShapeById = (sheet, id) => sheet.Sheet__Shapes.find((x) => x.Shape__Id === id) || null;
        const Na__LeModel__GetAnnotationById = (sheet, id) => sheet.Sheet__Annotations.find((x) => x.Annotation__Id === id) || null;
        const Na__LeModel__GetGroupById = () => null;
        const Na__LeModel__GetLeaderById = () => null;
        const Na__LeModel__GetLayerById = (sheet, id) => sheet.Sheet__Layers.find((l) => l.Layer__Id === id) || null;
        const Na__LeModel__GetViewportById = () => null;
        const Na__LeModel__IsLayerLocked = () => false;
        const Na__LeModel__DeleteItems = () => 0;
        const Na__LeModel__InsertViewport = () => null;
        const Na__LeModel__InsertDimension = () => null;
        const Na__LeModel__UpdateViewport = () => true;
        const Na__LeModel__UpdateDimension = () => true;
        const Na__LeModel__InsertShape = (sheet, record) => { Na__Test__Landed.push(record.Shape__LayerId); return { Shape__Id : 'Shape_9' + Na__Test__Landed.length }; };
        const Na__LeModel__ShapeLayerType = (record) => (record && record.Shape__Area) ? 'area' : 'vector';
        const Na__LeModel__InsertAnnotation = (sheet, record) => { Na__Test__Landed.push(record.Annotation__LayerId); return { Annotation__Id : 'Text_9' + Na__Test__Landed.length }; };
        const Na__LeModel__InsertGroup = () => null;
        const Na__LeModel__InsertLeader = () => null;
        const Na__LeModel__UpdateShape = () => true;
        const Na__LeModel__UpdateAnnotation = () => true;
        const Na__LeModel__UpdateLeader = () => true;
        const Na__LeLayout__Solve = () => ({ Page : { WidthMm : 594, HeightMm : 420 } });
        const Na__LeDrawScale__DimensionAtScale = () => true;
        const Na__LeShapeGeo__Points = (s) => s.Shape__Points || [];
        const Na__LeShapeGeo__Translated = (points) => points;
        const Na__LeGroup__Expand = (sheet, items) => items;
        const Na__LeGroup__ItemsBounds = () => ({ X : 0, Y : 0, WidthMm : 1, HeightMm : 1 });
        const Na__LePanels__GetContext = () => null;
        const Na__LeClip__CopyViewport = () => false, Na__LeClip__PasteViewport = () => false, Na__LeClip__DuplicateViewport = () => false, Na__LeClip__HasViewport = () => false;
        const Na__LeClip__CopyShape = () => false, Na__LeClip__PasteShape = () => false, Na__LeClip__DuplicateShape = () => false, Na__LeClip__HasShape = () => false;
        const Na__LeClip__RunViewportKeyAction = () => false;
        export const Na__Test__Landed__ = Na__Test__Landed;
    `, 'Clipboard');
    const landed = C.Na__Test__Landed__;
    s = rear();
    shape(s, 'Shape_032').Shape__LayerId = 'Layer_006';
    s.Sheet__Annotations[0].Annotation__LayerId = 'Layer_006';
    C.Na__LeClip__CloneInPlace(s, [ { kind : 'shape', id : 'Shape_032' }, { kind : 'annotation', id : 'Text_001' } ]);
    check('a Ctrl-drag copy on its own sheet keeps its original\'s General layer, a line and a note alike - it used to go to Vectors and Text',
        landed.splice(0, landed.length), [ 'Layer_006', 'Layer_006' ]);
    C.Na__LeClip__InsertSet(s, { roots : [ { kind : 'shape', id : 'Shape_032' } ], entries : [ { kind : 'shape', id : 'Shape_032', record : JSON.parse(JSON.stringify(shape(s, 'Shape_032'))) } ],
                                 origin : { x : 0, y : 0 }, size : { WidthMm : 1, HeightMm : 1 }, sourceSheetId : 'Sheet_009' }, null, false);
    check('a paste from ANOTHER sheet still needs a layer of its own type there: the same id may name another layer',
        landed.splice(0, landed.length), [ null ]);
    find(s, 'Layer_006').Layer__Type       = 'vector';                        // <-- Typed like the line, so only the reference rule can turn the copy away
    find(s, 'Layer_006').Layer__Selectable = false;
    C.Na__LeClip__CloneInPlace(s, [ { kind : 'shape', id : 'Shape_032' } ]);
    check('and no copy lands on a reference layer, as none lands on a hidden or a locked one: it would be out of reach',
        landed.splice(0, landed.length), [ null ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Pointer: Snaps, Clicks and Boxes Pass Through a Reference Layer
// -----------------------------------------------------------------------------

    globalThis.window = globalThis.window || { localStorage : { getItem : () => null, setItem : () => {} }, dispatchEvent : () => true };
    const REACH = `
        const Na__LeModel__KIND_2D = '2d';
        const Na__LeModel__GetLayers = (sheet) => sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order);
        const Na__LeModel__IsLayerVisible = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !l || l.Layer__Visible !== false; };
        const Na__LeModel__IsLayerLocked = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !!(l && l.Layer__Locked === true); };
        const Na__LeModel__IsLayerSelectable = (sheet, id) => { const l = sheet.Sheet__Layers.find((x) => x.Layer__Id === id); return !l || l.Layer__Selectable !== false; };
        const Na__LeShapeGeo__Points = (s) => s.Shape__Points || [];
    `;
    const O = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__Snapping__.js', REACH + `
        const Na__LeCfg__GetSnappingSetup = () => ({ enabled : true, radiusPx : 10, endpoints : true, midpoints : true, hiddenLines : false, sheetObjects : true, sheetChrome : false, markerSizePx : 10 });
        const Na__LeSurface__GetElements = () => ({ handles : null });
        const Na__LeSurface__GetPixelsPerMm = () => 1;
        const Na__LeSurface__GetZoom = () => 1;
        const Na__LeSurface__GetSheet = () => null;
        const Na__LeSurface__GetLayout = () => null;
        const Na__LeSurface__GetSheetChrome = () => [];
        const Na__LeLayout__MarginRect = () => null;
        const Na__LeGrid__IsSnapping = () => false;
        const Na__LeGrid__Nearest = (p) => p;
        const Na__Test__Source = { key : 'k', window : { Frame : { X : 300, Y : 0, WidthMm : 200, HeightMm : 200 }, ToPaper : (x, y) => ({ x : x, y : y }) }, classes : { visible : [ 400, 100, 450, 100 ] } };
        const Na__LeVp2d__GetSnapSource = (id) => id === 'Viewport_001' ? Na__Test__Source : null;
    `, 'Snapping');
    const snapSheet = () => {
        const x = rear();
        x.Sheet__Shapes = [ { Shape__Id : 'Shape_032', Shape__LayerId : 'Layer_006', Shape__Points : [ [ 100, 50 ], [ 100, 250 ] ] },
                            { Shape__Id : 'Shape_001', Shape__LayerId : 'Layer_004', Shape__Points : [ [ 200, 50 ], [ 200, 250 ] ] } ];
        x.Sheet__Dimensions = [ { Dimension__Id : 'Dim_001', Dimension__LayerId : 'Layer_006', Dimension__StartXMm : 150, Dimension__StartYMm : 300, Dimension__EndXMm : 180, Dimension__EndYMm : 300 } ];
        x.Sheet__Viewports[0].Viewport__Kind = '2d';
        x.Sheet__Viewports[0].Viewport__FrameMm = { X : 300, Y : 0, WidthMm : 200, HeightMm : 200 };
        return x;
    };
    const at = (sheet, x, y) => { const hit = O.Na__LeOsnap__Find(sheet, { x : x, y : y }); return hit ? [ hit.x, hit.y ] : null; };
    s = snapSheet();
    check('a construction line on an ordinary layer snaps: its end and its midpoint',
        [ at(s, 101, 52), at(s, 101, 149) ], [ [ 100, 50 ], [ 100, 150 ] ]);
    find(s, 'Layer_006').Layer__Selectable = false;
    check('on a REFERENCE layer it offers nothing - not its end, not its midpoint, not a dimension\'s measured point',
        [ at(s, 101, 52), at(s, 101, 149), at(s, 151, 301) ], [ null, null, null ]);
    check('while the drawing\'s own line beside it still snaps',
        at(s, 201, 52), [ 200, 50 ]);
    find(s, 'Layer_006').Layer__Selectable = true;
    find(s, 'Layer_006').Layer__Locked = true;
    check('a LOCKED layer still offers every point: a lock stops an edit, not an alignment',
        at(s, 101, 52), [ 100, 50 ]);
    check('a viewport\'s linework snaps, and a viewport can be carried by it',
        [ at(s, 401, 101), !!O.Na__LeOsnap__FindOnViewport(s, 'Viewport_001', { x : 401, y : 101 }) ], [ [ 400, 100 ], true ]);
    find(s, 'Layer_001').Layer__Selectable = false;
    check('on a reference layer its linework offers nothing, and there is nothing to carry it by',
        [ at(s, 401, 101), O.Na__LeOsnap__FindOnViewport(s, 'Viewport_001', { x : 401, y : 101 }) ], [ null, null ]);

    const B = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js', REACH + `
        const Na__LePaint__MarkupFrontToBack = (sheet) => Na__LeModel__GetLayers(sheet).filter((l) => l.Layer__Visible !== false).map((l) => l.Layer__Id).concat([ null ]);
        const Na__LeShapeGeo__Hit = (shape, p, tol) => shape.Shape__Points.some((q) => Math.hypot(q[0] - p.x, q[1] - p.y) <= tol);
    `, 'Markup');
    const hitSheet = () => {
        const x = rear();
        x.Sheet__Annotations = []; x.Sheet__Dimensions = []; x.Sheet__Leaders = [];
        x.Sheet__Shapes = [ { Shape__Id : 'Shape_001', Shape__LayerId : 'Layer_004', Shape__Points : [ [ 100, 100 ] ] },
                            { Shape__Id : 'Shape_032', Shape__LayerId : 'Layer_006', Shape__Points : [ [ 100, 100 ] ] } ];   // <-- A construction line crossing the drawing's line, on a layer above it
        return x;
    };
    s = hitSheet();
    const clicked = (sheet, eyedropper) => { const hit = B.Na__LeMarkup__HitTest(sheet, { x : 100, y : 100 }, 1, eyedropper === true); return hit ? hit.id : null; };
    check('a click where a construction line crosses the drawing\'s line finds the construction line, which is on top',
        clicked(s), 'Shape_032');
    find(s, 'Layer_006').Layer__Selectable = false;
    check('with its layer a reference layer the click falls through to the drawing\'s line beneath',
        [ clicked(s), clicked(s, true) ], [ 'Shape_001', 'Shape_001' ]);
    find(s, 'Layer_004').Layer__Selectable = false;
    check('and with both out of reach there is nothing there to pick at all',
        clicked(s), null);

    const X = await load('51__System__LayoutEditor/30__System__SheetTools/Na__LayoutEditor__SelectionBox__.js', REACH + `
        const Na__LeCfg__GetSelectionSetup = () => ({});
        const Na__LeScope__BoxCandidates = () => null;
        const Na__LeSurface__GetElements = () => ({ handles : null });
        const Na__LeSurface__GetPixelsPerMm = () => 1;
        const Na__LeSurface__GetZoom = () => 1;
    `, 'Box');
    const boxSheet = () => {
        const x = rear();
        x.Sheet__Viewports = []; x.Sheet__Annotations = []; x.Sheet__Dimensions = []; x.Sheet__Leaders = [];
        x.Sheet__Shapes = [ { Shape__Id : 'Shape_001', Shape__LayerId : 'Layer_004', Shape__Points : [ [ 10, 10 ], [ 20, 10 ] ] },
                            { Shape__Id : 'Shape_032', Shape__LayerId : 'Layer_006', Shape__Points : [ [ 10, 20 ], [ 20, 20 ] ] } ];
        return x;
    };
    s = boxSheet();
    const boxed = (sheet) => X.Na__LeSelBox__ItemsIn(sheet, { x : 0, y : 0 }, { x : 50, y : 50 }).map((item) => item.id);
    check('a window over both lines takes both',
        boxed(s), [ 'Shape_001', 'Shape_032' ]);
    find(s, 'Layer_006').Layer__Selectable = false;
    check('with the construction lines a reference layer it sweeps over them and takes the drawing\'s line alone',
        boxed(s), [ 'Shape_001' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    console.log(failures === 0 ? '  PASS - every check passed.' : '  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
