// =============================================================================
// TRUEVISION3D - TEST - THE LAYER STACK
// =============================================================================
//
// FILE       : Na__Test__LayerStack__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Layer Stack Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Layers list is the paint order for everything, and that a sheet from before is restacked once and only once
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE PLAN. Na__LayoutEditor__PaintOrder__ is loaded with its one import
//   (GetLayers) stubbed, and asked for the back-to-front plan of sheets laid
//   out the ways real sheets are: the new default, Adam's RB05 D02 (a Floor
//   Areas layer UNDER the Viewports layer - the report this was written for),
//   a hidden layer, drawings on two layers, a scrapbook preview with no
//   layers at all, and a viewport on a layer that is gone.
// - THE RESTACK. Na__LayoutEditor__SheetRecords__ is loaded with its imports
//   stubbed and driven through NormaliseLayerStack with the layer orders
//   found in the projects mirrored in the repo: PS01's Site Plan and 3D Images
//   (the old seed, Viewports at the top), its Floor Plans (already dragged
//   into order by Adam), and D02 as it now is.
// - Each module is the shipped file with its import lines swapped for stubs
//   and nothing else touched.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__LayerStack__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the layer stack (TrueVision3D v2.106.0).
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
        const tmp = join(tmpdir(), 'Na__Test__LayerStack__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
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

    console.log('TrueVision3D - the layer stack');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheets
// -----------------------------------------------------------------------------

    // A layer, top of the list first: order is its place in the list given.
    const layers = (...specs) => specs.map((spec, index) => ({
        Layer__Id : spec[0], Layer__Name : spec[1], Layer__Type : spec[2],
        Layer__Visible : spec[3] !== false, Layer__Locked : false, Layer__Order : index + 1
    }));
    const vp    = (id, layerId) => ({ Viewport__Id : id, Viewport__LayerId : layerId });
    const text  = (id, layerId) => ({ Annotation__Id : id, Annotation__LayerId : layerId });
    const dim   = (id, layerId) => ({ Dimension__Id : id, Dimension__LayerId : layerId });
    const shape = (id, layerId, area) => Object.assign({ Shape__Id : id, Shape__LayerId : layerId }, area ? { Shape__Area : { Area__Name : 'Kitchen' } } : {});
    const lead  = (id, layerId) => ({ Leader__Id : id, Leader__LayerId : layerId });
    const sheet = (list, items) => Object.assign({
        Sheet__Id : 'Sheet_T', Sheet__Layers : list,
        Sheet__Viewports : [], Sheet__Annotations : [], Sheet__Dimensions : [], Sheet__Shapes : [], Sheet__Leaders : []
    }, items || {});

    // The steps as short words: v:<id>, sheet, L:<layerId> (L:- for the unknown-layer group)
    const words = (steps) => steps.map((step) => step.kind === 'viewport' ? 'v:' + step.viewport.Viewport__Id : (step.kind === 'sheet' ? 'sheet' : 'L:' + (step.layerId === null ? '-' : step.layerId)));
    const stack = (s) => s.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order).map((layer) => layer.Layer__Name);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plan
// -----------------------------------------------------------------------------

    const P = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__PaintOrder__.js',
        'const Na__LeModel__GetLayers = (sheet) => sheet ? sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order) : [];', 'Plan');

    // THE NEW DEFAULT: Text, Dimensions, Vectors, Floor Areas, Viewports.
    const fresh = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ], [ 'L5', 'Floor Areas', 'area' ], [ 'L1', 'Viewports', 'viewport' ]),
        { Sheet__Viewports : [ vp('V1', 'L1'), vp('V2', 'L1') ] });
    check('a new sheet: the drawings first (back), earlier viewport further back, then the sheet\'s paper, then every layer up the list',
        words(P.Na__LePaint__Plan(fresh)), [ 'v:V1', 'v:V2', 'sheet', 'L:L1', 'L:L5', 'L:L4', 'L:L3', 'L:L2', 'L:-' ]);
    check('markup is painted back to front and a click is answered front to back',
        [ P.Na__LePaint__MarkupBackToFront(fresh), P.Na__LePaint__MarkupFrontToBack(fresh) ],
        [ [ 'L1', 'L5', 'L4', 'L3', 'L2', null ], [ null, 'L2', 'L3', 'L4', 'L5', 'L1' ] ]);

    // RB05 D02 AS ADAM HAS IT: Floor Areas at the bottom, under the Viewports layer.
    const d02 = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ], [ 'L1', 'Viewports', 'viewport' ], [ 'L5', 'Floor Areas', 'area' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Shapes : [ shape('S1', 'L5', true) ] });
    const d02Plan = words(P.Na__LePaint__Plan(d02));
    check('D02: the floor areas are painted BEFORE the plan, so the plan\'s lines go over the room',
        d02Plan, [ 'L:L5', 'v:V1', 'sheet', 'L:L1', 'L:L4', 'L:L3', 'L:L2', 'L:-' ]);
    check('D02: the room is under the viewport, which is what the list says',
        d02Plan.indexOf('L:L5') < d02Plan.indexOf('v:V1'), true);

    // A HIDDEN LAYER takes its viewports and its markup out of the plan.
    const hidden = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L1', 'Viewports', 'viewport', false ]), { Sheet__Viewports : [ vp('V1', 'L1') ] });
    check('a hidden Viewports layer: no viewport in the plan, and the sheet\'s paper goes first',
        words(P.Na__LePaint__Plan(hidden)), [ 'sheet', 'L:L2', 'L:-' ]);

    // DRAWINGS ON TWO LAYERS: the paper goes over the FRONTMOST of them.
    const two = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L6', 'Key Plan', 'viewport' ], [ 'L4', 'Vectors', 'vector' ], [ 'L1', 'Viewports', 'viewport' ]),
        { Sheet__Viewports : [ vp('V1', 'L1'), vp('V2', 'L1'), vp('V3', 'L6') ] });
    check('two drawing layers: vectors between them go between them, and the title block goes over the front one',
        words(P.Na__LePaint__Plan(two)), [ 'v:V1', 'v:V2', 'L:L1', 'L:L4', 'v:V3', 'sheet', 'L:L6', 'L:L2', 'L:-' ]);

    // A SCRAPBOOK PREVIEW builds a sheet with no layers at all.
    check('a sheet with no layers (a scrapbook preview): the paper, then everything in the unknown-layer group',
        [ words(P.Na__LePaint__Plan(sheet([]))), P.Na__LePaint__MarkupBackToFront(sheet([])) ], [ [ 'sheet', 'L:-' ], [ null ] ]);

    // A VIEWPORT ON A LAYER THAT IS GONE is drawn in front, as an unknown layer always read as shown.
    const lost = sheet(layers([ 'L2', 'Text', 'annotation' ]), { Sheet__Viewports : [ vp('VX', 'Layer_999') ] });
    check('a viewport whose layer is gone: in the front group, with the paper over it',
        words(P.Na__LePaint__Plan(lost)), [ 'L:L2', 'v:VX', 'sheet', 'L:-' ]);
    check('IsKnownLayer knows the list and nothing else',
        [ P.Na__LePaint__IsKnownLayer(lost, 'L2'), P.Na__LePaint__IsKnownLayer(lost, 'Layer_999') ], [ true, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Restack
// -----------------------------------------------------------------------------

    const R = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', `
        const Na__LeCfg__GetViewportSetup = () => ({ minSizeMm : 10, defaultWidthMm : 100, defaultHeightMm : 80 });
        const Na__LeCfg__GetLabel   = (k, f) => f;
        const Na__LeCfg__GetSheetSetup = () => ({});
        const Na__LeScale__Coerce   = (d) => d || 50;
        const Na__LeGrad__Normalise = (g) => g || null;
        const Na__LeDash__Normalise = (d) => d || null;
        const Na__LeHatch__FIELD    = 'Viewport__SitePlanHatches';
        const Na__LeHatch__CAT_FIELD = 'SitePlanHatches__Categories';
        const Na__LeEdge__FIELD     = 'Viewport__EdgeStyles';
        const Na__LeEdge__CAT_FIELD = 'EdgeStyles__Categories';
        const Na__LeEdge__ClampWeight = (w) => w;
        const Na__LeEdge__IsColour  = () => true;
        const Na__LeEdge__IsLineType = () => true;
        const Na__LeComposite__Row  = () => null;
        const Na__LeComposite__Clamp = (k, v) => v;
        const Na__LeSpComp__DECK_FIELD = 'SitePlan__Composites';
        const Na__LeSpComp__TYPE_FIELD = 'SitePlan__PlanType';
        const Na__LeSpComp__PLAN_BLOCK = 'block';
        const Na__LeSpComp__PLAN_LOCAL = 'location';
        const Na__LeSpComp__DeckKeys   = () => ['fills', 'patterns', 'linework'];
        const Na__LeSpComp__DeckDefault = () => true;
    `, 'Records');
    const restack = (s) => R.Na__LeRec__NormaliseLayerStack(s);

    // PS01 SITE PLAN, AS IT IS IN THE REPO: the old seed, Viewports at the top,
    // with 16 notes, a leader, a dimension and 12 vectors under the pictures.
    const sitePlan = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ]),
        { Sheet__Viewports : [ vp('V1', 'L1'), vp('V2', 'L1') ], Sheet__Annotations : [ text('A1', 'L2') ], Sheet__Leaders : [ lead('R1', 'L2') ],
          Sheet__Dimensions : [ dim('D1', 'L3') ], Sheet__Shapes : [ shape('S1', 'L4') ] });
    const siteMoved = restack(sitePlan);
    check('PS01 Site Plan (old seed): the Viewports layer goes to the bottom and nothing else moves',
        [ siteMoved, stack(sitePlan), sitePlan.Sheet__LayerStack ], [ true, [ 'Text', 'Dimensions', 'Vectors', 'Viewports' ], 2 ]);
    check('the array itself is left in list order, so the first layer of a type is the frontmost',
        sitePlan.Sheet__Layers.map((layer) => layer.Layer__Name), [ 'Text', 'Dimensions', 'Vectors', 'Viewports' ]);

    // PS01 ELEVATIONS-LIKE ORDER UNDER THE OLD SEED: the markup keeps ITS order.
    const elev = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L2', 'Text', 'annotation' ], [ 'L4', 'Vectors', 'vector' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Dimensions : [ dim('D1', 'L3') ], Sheet__Annotations : [ text('A1', 'L2') ] });
    restack(elev);
    check('the layers above keep their own order among themselves',
        stack(elev), [ 'Dimensions', 'Text', 'Vectors', 'Viewports' ]);

    // PS01 FLOOR PLANS: Adam had already dragged the drawings to the bottom.
    const plans = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ], [ 'L1', 'Viewports', 'viewport' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Annotations : [ text('A1', 'L2') ], Sheet__Shapes : [ shape('S1', 'L4') ] });
    check('PS01 Floor Plans (already in order): untouched, and marked',
        [ restack(plans), stack(plans), plans.Sheet__LayerStack ], [ false, [ 'Text', 'Dimensions', 'Vectors', 'Viewports' ], 2 ]);

    // RB05 D02 AS ADAM HAS IT: the area layer he put under the drawing stays under it.
    const d02Records = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ], [ 'L1', 'Viewports', 'viewport' ], [ 'L5', 'Floor Areas', 'area' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Shapes : [ shape('S1', 'L5', true) ] });
    check('RB05 D02: a floor area layer under the Viewports layer is left there - nothing it showed is buried',
        [ restack(d02Records), stack(d02Records) ], [ false, [ 'Text', 'Dimensions', 'Vectors', 'Viewports', 'Floor Areas' ] ]);

    // THE OLD SEED WITH ROOMS ON IT: the rooms were drawn over the plans, and stay over them.
    const seeded = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ], [ 'L5', 'Floor Areas', 'area' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Annotations : [ text('A1', 'L2') ], Sheet__Shapes : [ shape('S1', 'L5', true) ] });
    restack(seeded);
    check('the old seed with rooms on it: the drawings go down and the rooms stay over them, as they were drawn',
        stack(seeded), [ 'Text', 'Dimensions', 'Vectors', 'Floor Areas', 'Viewports' ]);

    // ONCE: a list the user orders afterwards is theirs.
    const chosen = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L2', 'Text', 'annotation' ]),
        { Sheet__LayerStack : 2, Sheet__Viewports : [ vp('V1', 'L1') ], Sheet__Annotations : [ text('A1', 'L2') ] });
    check('a sheet already marked is never restacked, even with text under a picture - that is a choice now',
        [ restack(chosen), stack(chosen) ], [ false, [ 'Viewports', 'Text' ] ]);
    check('and running it again changes nothing',
        [ restack(sitePlan), stack(sitePlan) ], [ false, [ 'Text', 'Dimensions', 'Vectors', 'Viewports' ] ]);

    // RB05 TEMP__PLANS AS STORED: one viewport, and three EMPTY layers under it.
    // Nothing is buried yet - but the first note typed would be.
    const tempPlans = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L2', 'Text', 'annotation' ], [ 'L3', 'Dimensions', 'dimension' ], [ 'L4', 'Vectors', 'vector' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ] });
    check('RB05 TEMP__Plans as stored (empty layers under the drawing): restacked, so the first note typed is not under the picture',
        [ restack(tempPlans), stack(tempPlans) ], [ true, [ 'Text', 'Dimensions', 'Vectors', 'Viewports' ] ]);
    const emptyAreas = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L1', 'Viewports', 'viewport' ], [ 'L5', 'Floor Areas', 'area' ]),
        { Sheet__Viewports : [ vp('V1', 'L1') ] });
    check('but an EMPTY Floor Areas layer under the drawing never calls for a restack',
        [ restack(emptyAreas), stack(emptyAreas) ], [ false, [ 'Text', 'Viewports', 'Floor Areas' ] ]);

    // AN EMPTY VIEWPORT-TYPED LAYER counts by its type; a sheet with no drawing layer is left alone.
    const empty = sheet(layers([ 'L1', 'Viewports', 'viewport' ], [ 'L2', 'Text', 'annotation' ]), { Sheet__Annotations : [ text('A1', 'L2') ] });
    restack(empty);
    check('an empty Viewports layer over some text goes down too, ready for the drawings to come',
        stack(empty), [ 'Text', 'Viewports' ]);
    const none = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L4', 'Vectors', 'vector' ]), { Sheet__Annotations : [ text('A1', 'L2') ] });
    check('a sheet with no drawing layer is left exactly as it is',
        [ restack(none), stack(none) ], [ false, [ 'Text', 'Vectors' ] ]);

    // ITEMS ON A LAYER THAT IS GONE go to the layer their kind lands on.
    const orphans = sheet(layers([ 'L2', 'Text', 'annotation' ], [ 'L4', 'Vectors', 'vector' ], [ 'L5', 'Floor Areas', 'area' ], [ 'L1', 'Viewports', 'viewport' ]),
        { Sheet__LayerStack : 2, Sheet__Shapes : [ shape('S1', 'Layer_999'), shape('S2', 'Layer_999', true) ], Sheet__Annotations : [ text('A1', 'Layer_998') ], Sheet__Viewports : [ vp('V1', 'Layer_997') ] });
    restack(orphans);
    check('a vector, a room, a note and a viewport on layers that are gone each go home',
        [ orphans.Sheet__Shapes[0].Shape__LayerId, orphans.Sheet__Shapes[1].Shape__LayerId, orphans.Sheet__Annotations[0].Annotation__LayerId, orphans.Sheet__Viewports[0].Viewport__LayerId ],
        [ 'L4', 'L5', 'L2', 'L1' ]);
    const noAreaLayer = sheet(layers([ 'L4', 'Vectors', 'vector' ]), { Sheet__LayerStack : 2, Sheet__Shapes : [ shape('S2', 'Layer_999', true) ] });
    restack(noAreaLayer);
    check('a room whose layer is gone, on a sheet with no Floor Areas layer, goes to Vectors rather than just anywhere',
        noAreaLayer.Sheet__Shapes[0].Shape__LayerId, 'L4');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    console.log(failures === 0 ? '  PASS - every check passed.' : '  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
