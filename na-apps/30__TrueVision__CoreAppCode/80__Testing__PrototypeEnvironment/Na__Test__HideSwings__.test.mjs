// =============================================================================
// TRUEVISION3D - TEST - HIDE SWINGS AND 1:200
// =============================================================================
//
// FILE       : Na__Test__HideSwings__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Hide Swings and 1:200 Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a plan viewport leaves its door swings off when told, a roof plan does so unasked, and 1:200 is a scale like the others
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE CONFIG (the shipped ConfigState SheetSetup unit reading the shipped
//   AppConfig JSON): 1:200 is on the architectural list; Hide swings names the
//   roof storey and the SketchUp door swing category; with no config at all
//   every fallback answers the same; an empty list stays empty.
// - THE SCALE (the shipped ScaleManager): 1:200 is kept, labelled, converted
//   and named on a sheet like any other scale.
// - THE RECORD (the shipped SheetRecords normaliser and the Viewports unit's
//   UpdateViewport): Viewport__HideSwings is kept only as a boolean and never
//   added; null takes it off again; a viewport saved before it loads
//   byte-identical.
// - HIDE SWINGS (the shipped PlanDoors, on RB05 West Farm's four plans as
//   they loaded on 21-Sep-2026 - names and cut heights - through the real
//   storey level module): only the Roof Plan hides by default; a tick or an
//   untick stands and costs one undo step; the pose, the exclusion tokens and
//   the picture's model layers follow; a plan that draws its swings, an
//   elevation and a 3D viewport are left exactly as they were.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__HideSwings__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with Hide swings and the 1:200 scale (TrueVision3D v2.140.0).
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
        setTimeout, clearTimeout
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // The Viewport Rotation test's loader: every name a module imports gets the
    // test's stub when it gives one, else a function returning undefined.
    let loadCount = 0;
    async function load(relative, stubs) {
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
        const key = '__HideSwingsStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__HideSwings__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks and the Config Readers
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }

    // THE SHIPPED JSON, read the way Na__LayoutEditor__ConfigState__Readers__
    // reads it: LayoutEditor__<Block>__Config, then LayoutEditor__<Block>__<Key>;
    // a missing or null value is the fallback.
    const CONFIG    = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const FP_CONFIG = JSON.parse(readFileSync(resolve(SRC, '42__System__FloorPlanViews/Na__FloorPlan__AppConfig__.json'), 'utf8'));
    let active = CONFIG;
    const Val = (block, key, fallback) => {
        const b = active ? active['LayoutEditor__' + block + '__Config'] : null;
        const v = b ? b['LayoutEditor__' + block + '__' + key] : undefined;
        return (v === undefined || v === null) ? fallback : v;
    };
    const Num = (block, key, fallback) => { const v = Val(block, key, undefined); return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback; };
    const withConfig = (config, fn) => { const was = active; active = config; try { return fn(); } finally { active = was; } };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Config (the shipped SheetSetup unit)
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - Hide swings and 1:200\n\n  The config (the shipped SheetSetup unit, the shipped JSON)');
    const Setup = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__SheetSetup__.js', { Na__LeCfg__Val : Val, Na__LeCfg__Num : Num });

    check('the architectural scales are 1:20, 1:50, 1:100 and 1:200, finest first', Setup.Na__LeCfg__GetScaleSetup().denominators, [ 20, 50, 100, 200 ]);
    check('with no config at all the fallback is the same four', withConfig({}, () => Setup.Na__LeCfg__GetScaleSetup().denominators), [ 20, 50, 100, 200 ]);
    check('a new viewport still starts at 1:50', Setup.Na__LeCfg__GetScaleSetup().defaultDenominator, 50);
    const doorsSetup = Setup.Na__LeCfg__GetPlanDoorsSetup();
    check('a roof plan is the storey that hides its swings unasked', doorsSetup.hideSwingsOnStoreys, [ 'roof' ]);
    check('the SketchUp door swing linework goes with the traced arcs', doorsSetup.swingCategoryKeys, [ 'TrueVision__Linetype__DoorSwings' ]);
    check('with no config at all both fallbacks say the same',
        withConfig({}, () => { const d = Setup.Na__LeCfg__GetPlanDoorsSetup(); return [ d.hideSwingsOnStoreys, d.swingCategoryKeys ]; }),
        [ [ 'roof' ], [ 'TrueVision__Linetype__DoorSwings' ] ]);
    const doorsBlock = (fields) => ({ LayoutEditor__PlanDoors__Config : fields });
    check('an EMPTY list in the config is kept empty - nothing hidden by default - not replaced by the default',
        withConfig(doorsBlock({ LayoutEditor__PlanDoors__HideSwingsOnStoreys : [], LayoutEditor__PlanDoors__SwingCategoryKeys : [] }),
            () => { const d = Setup.Na__LeCfg__GetPlanDoorsSetup(); return [ d.hideSwingsOnStoreys, d.swingCategoryKeys ]; }),
        [ [], [] ]);
    check('storey keys are read trimmed and in lower case, blanks dropped',
        withConfig(doorsBlock({ LayoutEditor__PlanDoors__HideSwingsOnStoreys : [ ' Roof ', 'SECOND', '', null ] }), () => Setup.Na__LeCfg__GetPlanDoorsSetup().hideSwingsOnStoreys),
        [ 'roof', 'second' ]);
    check('the door setup it already had is unchanged', [ doorsSetup.openOnPlans, doorsSetup.drawSwings, doorsSetup.swingStepDegrees, doorsSetup.clickDelayMs ], [ true, true, 5, 300 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Scale (the shipped ScaleManager)
// -----------------------------------------------------------------------------

    console.log('\n  1:200 (the shipped ScaleManager)');
    const Scale = await load(LE + '07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js', { Na__LeCfg__GetScaleSetup : Setup.Na__LeCfg__GetScaleSetup });

    check('the Viewport panel builds four scale buttons', Scale.Na__LeScale__ListDenominators().map((d) => Scale.Na__LeScale__FormatLabel(d)), [ '1:20', '1:50', '1:100', '1:200' ]);
    check('an architectural viewport keeps 1:200 (it used to be coerced to 1:50)', Scale.Na__LeScale__Coerce(200), 200);
    check('a site plan viewport keeps its own 1:200 as before', Scale.Na__LeScale__Coerce(200, true), 200);
    check('a scale on neither list still falls to the default', Scale.Na__LeScale__Coerce(150), 50);
    check('a frame 100 mm wide at 1:200 shows 20 m of the model, and 20 m draws 100 mm', [ Scale.Na__LeScale__PaperToModelMm(100, 200), Scale.Na__LeScale__ModelToPaperMm(20000, 200) ], [ 20000, 100 ]);
    check('the list runs on from 1:100 to 1:200 and back round to 1:20', [ Scale.Na__LeScale__Next(100), Scale.Na__LeScale__Next(200) ], [ 200, 20 ]);
    check('the title block names it with its paper, alone and in a mix', [ Scale.Na__LeScale__SheetLabel([ 200 ], 'A3'), Scale.Na__LeScale__SheetLabel([ 200, 100 ], 'A2') ], [ '1:200 @ ISO A3', '1:100 & 1:200 @ ISO A2' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record (the shipped SheetRecords and Viewports units)
// -----------------------------------------------------------------------------

    console.log('\n  The record (the shipped SheetRecords normaliser and UpdateViewport)');
    const Rot = await load(LE + '20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js', {});
    const FIELDS = {
        Na__LeEdge__FIELD        : 'Viewport__ProjectedEdges',
        Na__LeEdge__CAT_FIELD    : 'Edges__Categories',
        Na__LeComposite__FIELD   : 'Viewport__CompositeWeights',
        Na__LeHatch__FIELD       : 'Viewport__SitePlanHatches',
        Na__LeHatch__CAT_FIELD   : 'Hatches__Categories',
        Na__LeSpComp__DECK_FIELD : 'SitePlan__Composites',
        Na__LeSpComp__TYPE_FIELD : 'SitePlan__PlanType',
        Na__LeVpRot__FIELD       : Rot.Na__LeVpRot__FIELD,
        Na__LeVpRot__WrapDeg     : Rot.Na__LeVpRot__WrapDeg
    };
    const Records = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', Object.assign({
        Na__LeCfg__GetViewportSetup : Setup.Na__LeCfg__GetViewportSetup,
        Na__LeScale__Coerce         : Scale.Na__LeScale__Coerce
    }, FIELDS));

    // RB05 D12's viewport as Adam's screenshot showed it: the Roof Plan scene, 1:100.
    const roofRecord = () => ({
        Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__SceneId : 'Scene_035', Viewport__DrawingId : 'FloorPlan_004',
        Viewport__Name : '', Viewport__LayerId : 'Layer_005', Viewport__ScaleDenominator : 100,
        Viewport__FrameMm : { X : 15.1, Y : -5.2, WidthMm : 482.8, HeightMm : 408.3 }, Viewport__PanMm : { X : 19397, Y : -26861 },
        Viewport__ClosedDoors : [ 'ADR041__ExteriorDoor__RearDoor' ]
    });
    const once  = Records.Na__LeRec__NormaliseViewport(roofRecord(), 'Layer_005');
    const twice = Records.Na__LeRec__NormaliseViewport(JSON.parse(JSON.stringify(once)), 'Layer_005');
    check('a viewport saved before Hide swings gains no key from a load', Object.prototype.hasOwnProperty.call(once, 'Viewport__HideSwings'), false);
    check('and a second load leaves it byte-identical', JSON.stringify(twice), JSON.stringify(once));
    check('a tick and an untick are both kept', [ true, false ].map((v) => Records.Na__LeRec__NormaliseViewport(Object.assign(roofRecord(), { Viewport__HideSwings : v }), 'L').Viewport__HideSwings), [ true, false ]);
    check('anything that is not a boolean is taken off', [ 'true', 1, null, {} ].map((v) => Object.prototype.hasOwnProperty.call(Records.Na__LeRec__NormaliseViewport(Object.assign(roofRecord(), { Viewport__HideSwings : v }), 'L'), 'Viewport__HideSwings')), [ false, false, false, false ]);
    check('1:200 survives a load; 1:150, which is on no list, still does not', [ 200, 150 ].map((d) => Records.Na__LeRec__NormaliseViewport(Object.assign(roofRecord(), { Viewport__ScaleDenominator : d }), 'L').Viewport__ScaleDenominator), [ 200, 50 ]);

    const touched = [];
    const Views = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Viewports__.js', Object.assign({
        Na__LeRec__IsSitePlanViewport : Records.Na__LeRec__IsSitePlanViewport,
        Na__LeRec__NextId             : Records.Na__LeRec__NextId,
        Na__LeRec__Find               : Records.Na__LeRec__Find,
        Na__LeRec__NormaliseViewport  : Records.Na__LeRec__NormaliseViewport,
        Na__LeScale__Coerce           : Scale.Na__LeScale__Coerce,
        Na__LeComposite__Clamp        : (key, value) => value,
        Na__LeModel__KIND_2D          : '2d',
        Na__LeModel__KIND_3D          : '3d',
        Na__LeModel__STYLE_KEYS       : [],
        Na__LeModel__Touch            : (...args) => touched.push(args),
        Na__LeModel__AssignDirty      : () => {}
    }, FIELDS));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hide Swings (the shipped PlanDoors on RB05 West Farm)
// -----------------------------------------------------------------------------

    console.log('\n  Hide swings (the shipped PlanDoors, RB05 West Farm\'s plans)');
    const Level      = await load('42__System__FloorPlanViews/Na__FloorPlan__StoreyLevel__.js', {});
    const levelSetup = Level.Na__FpLevel__Setup(FP_CONFIG.FloorPlanViews__StoreyLevels__Config);

    // THE FIXTURE: RB05's four plans as the app loaded them on 21-Sep-2026,
    // every datum 0, no storey picked - so each storey is the name's guess.
    const PLANS = {
        FloorPlan_001 : { FloorPlan__Id : 'FloorPlan_001', FloorPlan__Name : 'Ground Floor Plan', cutMm : 2000 },
        FloorPlan_002 : { FloorPlan__Id : 'FloorPlan_002', FloorPlan__Name : 'First Floor Plan',  cutMm : 6600 },
        FloorPlan_003 : { FloorPlan__Id : 'FloorPlan_003', FloorPlan__Name : 'Second Floor Plan', cutMm : 9250 },
        FloorPlan_004 : { FloorPlan__Id : 'FloorPlan_004', FloorPlan__Name : 'Roof Plan',         cutMm : 11500 },
        FloorPlan_900 : { FloorPlan__Id : 'FloorPlan_900', FloorPlan__Name : 'Loft Plan',         cutMm : 7000 }   // <-- Not RB05's: a name that says nothing, cut above the second floor band
    };
    const storeyOf = (plan) => Level.Na__FpLevel__Resolve(plan.FloorPlan__StoreyLevel, plan.FloorPlan__Name, plan.cutMm, levelSetup);
    check('the fixture storeys read as the app read them', [ 'FloorPlan_001', 'FloorPlan_002', 'FloorPlan_003', 'FloorPlan_004' ].map((id) => storeyOf(PLANS[id]).key), [ 'ground', 'first', 'second', 'roof' ]);

    const Doors = await load(LE + '20__System__Viewports/Na__LayoutEditor__PlanDoors__.js', {
        Na__LeCfg__GetPlanDoorsSetup       : () => Setup.Na__LeCfg__GetPlanDoorsSetup(),
        Na__LeModel__KIND_2D               : '2d',
        Na__LeModel__GetViewportById       : Views.Na__LeModel__GetViewportById,
        Na__LeModel__UpdateViewport        : Views.Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource : (vp) => ({ plan : (vp.Viewport__Kind === '2d' && PLANS[vp.Viewport__DrawingId]) || null }),
        Na__FpData__GetStoreyLevel         : storeyOf
    });

    const view = (id, drawingId, kind, extra) => Records.Na__LeRec__NormaliseViewport(Object.assign({
        Viewport__Id : id, Viewport__Kind : kind || '2d', Viewport__DrawingId : drawingId, Viewport__ScaleDenominator : 100,
        Viewport__FrameMm : { X : 20, Y : 20, WidthMm : 300, HeightMm : 200 }
    }, extra || {}), 'Layer_005');
    const sheet = { Sheet__Id : 'Sheet_901', Sheet__Dimensions : [], Sheet__Viewports : [
        view('Viewport_001', 'FloorPlan_001'),
        view('Viewport_002', 'FloorPlan_002'),
        view('Viewport_003', 'FloorPlan_003'),
        view('Viewport_004', 'FloorPlan_004', '2d', { Viewport__ModelLayers : { TrueVision__MainBuildingModel__ProposedFurniture : false } }),
        view('Viewport_005', 'Elevation_003', '2d', { Viewport__HideSwings : true }),   // <-- An elevation carrying a stale tick
        view('Viewport_006', null, '3d', { Viewport__HideSwings : true })               // <-- A 3D viewport carrying one
    ] };
    const vp   = (n) => sheet.Sheet__Viewports[n - 1];
    const plans = [ 1, 2, 3, 4 ];

    check('RB05: only the Roof Plan hides its swings by default', plans.map((n) => Doors.Na__LeDoors__SwingsHidden(vp(n))), [ false, false, false, true ]);
    check('and it is the storey that says so, not a tick', plans.map((n) => Doors.Na__LeDoors__SwingsHiddenByDefault(vp(n))), [ false, false, false, true ]);
    check('the Roof Plan\'s pose traces no arc; every other plan\'s does', plans.map((n) => Doors.Na__LeDoors__PoseFor(vp(n)).Swings), [ true, true, true, false ]);
    check('the pose keeps its shut doors and its step', [ Doors.Na__LeDoors__PoseFor(vp(4)).Closed, Doors.Na__LeDoors__PoseFor(vp(4)).SwingStepDegrees ], [ [], 5 ]);
    check('the Roof Plan leaves the SketchUp door swing linework out, by its whole name; the others add no token', plans.map((n) => Doors.Na__LeDoors__SwingExcludeTokens(vp(n))), [ [], [], [], [ '=TrueVision__Linetype__DoorSwings' ] ]);
    check('its picture is drawn with that linework off, on top of what the viewport already hides',
        Doors.Na__LeDoors__RasterLayers(vp(4)), { TrueVision__MainBuildingModel__ProposedFurniture : false, TrueVision__Linetype__DoorSwings : false });
    check('and the viewport\'s own map is not written to', vp(4).Viewport__ModelLayers, { TrueVision__MainBuildingModel__ProposedFurniture : false });
    check('a plan that draws its swings hands over its own map, untouched (null here)', Doors.Na__LeDoors__RasterLayers(vp(1)), null);
    check('a stale tick on an elevation or a 3D viewport does nothing',
        [ Doors.Na__LeDoors__SwingExcludeTokens(vp(5)), Doors.Na__LeDoors__RasterLayers(vp(5)), Doors.Na__LeDoors__SwingExcludeTokens(vp(6)), Doors.Na__LeDoors__RasterLayers(vp(6)) ],
        [ [], null, [], null ]);
    check('and neither is a plan to set it on', [ Doors.Na__LeDoors__SetSwingsHidden(sheet, 'Viewport_005', false), Doors.Na__LeDoors__SetSwingsHidden(sheet, 'Viewport_006', false), touched.length ], [ false, false, 0 ]);

    check('UNTICKED on the Roof Plan: stored as false, one undo step', [ Doors.Na__LeDoors__SetSwingsHidden(sheet, 'Viewport_004', false), vp(4).Viewport__HideSwings, touched.length ], [ true, false, 1 ]);
    check('it draws its swings again, arcs and linework both', [ Doors.Na__LeDoors__SwingsHidden(vp(4)), Doors.Na__LeDoors__PoseFor(vp(4)).Swings, Doors.Na__LeDoors__SwingExcludeTokens(vp(4)), Doors.Na__LeDoors__RasterLayers(vp(4)) ],
        [ false, true, [], { TrueVision__MainBuildingModel__ProposedFurniture : false } ]);
    check('unticking what is already unticked writes nothing and costs no undo step', [ Doors.Na__LeDoors__SetSwingsHidden(sheet, 'Viewport_004', false), touched.length ], [ false, 1 ]);
    check('TICKED again: stored as true (a pick, kept either way)', [ Doors.Na__LeDoors__SetSwingsHidden(sheet, 'Viewport_004', true), vp(4).Viewport__HideSwings, touched.length ], [ true, true, 2 ]);
    check('null hands the choice back to the storey, which hides them', [ Views.Na__LeModel__UpdateViewport(sheet, 'Viewport_004', { hideSwings : null }), Object.prototype.hasOwnProperty.call(vp(4), 'Viewport__HideSwings'), Doors.Na__LeDoors__SwingsHidden(vp(4)) ], [ true, false, true ]);
    check('a patch without hideSwings leaves the choice alone', (() => { Views.Na__LeModel__UpdateViewport(sheet, 'Viewport_001', { hideSwings : true }); Views.Na__LeModel__UpdateViewport(sheet, 'Viewport_001', { name : 'Ground' }); return vp(1).Viewport__HideSwings; })(), true);
    check('TICKED on the ground floor plan: its arcs and linework go', [ Doors.Na__LeDoors__SwingsHidden(vp(1)), Doors.Na__LeDoors__PoseFor(vp(1)).Swings, Doors.Na__LeDoors__SwingExcludeTokens(vp(1)) ], [ true, false, [ '=TrueVision__Linetype__DoorSwings' ] ]);
    check('the scale button reaches the record as 1:200', (() => { Views.Na__LeModel__UpdateViewport(sheet, 'Viewport_002', { scaleDenominator : 200 }); return vp(2).Viewport__ScaleDenominator; })(), 200);

    // THE STOREY DECIDES, SO THE DEFAULT FOLLOWS THE PLAN
    PLANS.FloorPlan_003.FloorPlan__StoreyLevel = 'roof';
    check('a plan PICKED as the roof in Dev Tools hides its swings from then on', Doors.Na__LeDoors__SwingsHidden(vp(3)), true);
    delete PLANS.FloorPlan_003.FloorPlan__StoreyLevel;
    vp(2).Viewport__DrawingId = 'FloorPlan_900';
    check('an unhelpfully named plan cut above 6.8 m is guessed a roof plan by its height, and hides them', [ storeyOf(PLANS.FloorPlan_900).key, Doors.Na__LeDoors__SwingsHidden(vp(2)) ], [ 'roof', true ]);
    PLANS.FloorPlan_004.FloorPlan__StoreyLevel = 'second';
    check('the Roof Plan picked as the second floor draws its swings again (the pick beats the name)', Doors.Na__LeDoors__SwingsHidden(vp(4)), false);
    delete PLANS.FloorPlan_004.FloorPlan__StoreyLevel;

    // THE CONFIG'S OWN SWITCHES
    check('with DrawSwings off no plan traces an arc, ticked or not', withConfig(Object.assign({}, CONFIG, doorsBlock(Object.assign({}, CONFIG.LayoutEditor__PlanDoors__Config, { LayoutEditor__PlanDoors__DrawSwings : false }))),
        () => plans.map((n) => Doors.Na__LeDoors__PoseFor(vp(n)).Swings)), [ false, false, false, false ]);
    check('with no storey listed, the Roof Plan draws its swings unless ticked', withConfig(Object.assign({}, CONFIG, doorsBlock(Object.assign({}, CONFIG.LayoutEditor__PlanDoors__Config, { LayoutEditor__PlanDoors__HideSwingsOnStoreys : [] }))),
        () => Doors.Na__LeDoors__SwingsHidden(vp(4))), false);
    check('with OpenOnPlans off there is no pose, no token and no change to the picture', withConfig(Object.assign({}, CONFIG, doorsBlock(Object.assign({}, CONFIG.LayoutEditor__PlanDoors__Config, { LayoutEditor__PlanDoors__OpenOnPlans : false }))),
        () => [ Doors.Na__LeDoors__PoseFor(vp(4)), Doors.Na__LeDoors__SwingExcludeTokens(vp(4)), Doors.Na__LeDoors__RasterLayers(vp(4)) ]),
        [ null, [], { TrueVision__MainBuildingModel__ProposedFurniture : false } ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('\n' + (failures === 0 ? 'PASS - every check passed.' : 'FAIL - ' + failures + ' check(s) failed.') + '\n');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
