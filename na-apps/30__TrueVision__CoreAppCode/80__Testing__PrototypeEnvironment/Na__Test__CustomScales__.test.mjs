// =============================================================================
// TRUEVISION3D - TEST - CUSTOM VIEWPORT SCALES
// =============================================================================
//
// FILE       : Na__Test__CustomScales__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Custom Viewport Scales Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a project's own scales (1:500 and the like) are stored, listed, labelled and kept, and never lost on a load
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - THE STORE (the shipped ProjectData unit): the drawings block keeps the
//   project's scales as whole numbers, once each, finest first; an empty list
//   takes the key off; Set says whether anything changed.
// - THE SCALE (the shipped ScaleManager, over that store and the shipped
//   config): what may be typed as a scale; both lists with the custom scales
//   merged in; Coerce keeps any whole scale, listed or not, and resets only
//   what is not a whole scale - the 1:500 case first, which a first cut lost
//   whenever the project's list was not yet known; captions and the title
//   block quote a custom scale as it is.
// - THE RECORD (the shipped SheetRecords normaliser): a viewport saved at
//   1:500 loads at 1:500, with or without the project's list loaded.
// - THE MODEL (the shipped Viewports unit's AddCustomScale and
//   RemoveCustomScale): what is refused and why, what is announced, and that a
//   scale in use on any sheet stays on the list.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__CustomScales__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Written with custom viewport scales (TrueVision3D v2.177.0).
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
        location            : { href : 'http://localhost/', hostname : 'localhost', search : '' },
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

    // The Hide Swings test's loader: every name a module imports gets the
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
        const key = '__CustomScaleStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__CustomScales__' + loadCount + '__.mjs');
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

    // THE SHIPPED JSON, read the way the config readers read it.
    const CONFIG = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const Val = (block, key, fallback) => {
        const b = CONFIG['LayoutEditor__' + block + '__Config'];
        const v = b ? b['LayoutEditor__' + block + '__' + key] : undefined;
        return (v === undefined || v === null) ? fallback : v;
    };
    const Num = (block, key, fallback) => { const v = Val(block, key, undefined); return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback; };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Store (the shipped ProjectData unit)
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - Custom viewport scales\n\n  The store (the shipped ProjectData unit)');
    const Data  = await load('40__System__DrawingViewCore/Na__DrawView__ProjectData__.js', {});
    const block = Data.Na__DrawData__GetBlock();
    const KEY   = 'LayoutEditor__DrawingsData__CustomScaleDenominators';

    check('a new project has no custom scales, and no key', [ Data.Na__DrawData__GetCustomScales(), Object.prototype.hasOwnProperty.call(block, KEY) ], [ [], false ]);
    check('Set keeps whole positive numbers, once each, finest first, and says it changed',
        [ Data.Na__DrawData__SetCustomScales([ 500, 75, '500', 37.5, -5, 0, 'x', null, 75 ]), block[KEY] ], [ true, [ 75, 500 ] ]);
    check('setting the same list again changes nothing', Data.Na__DrawData__SetCustomScales([ 500, 75 ]), false);
    block[KEY] = [ 1250, 'rubbish', 2.5, 75, 75 ];
    check('a hand-edited block reads clean', Data.Na__DrawData__GetCustomScales(), [ 75, 1250 ]);
    check('an empty list takes the key off', [ Data.Na__DrawData__SetCustomScales([]), Object.prototype.hasOwnProperty.call(block, KEY) ], [ true, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Scale (the shipped ScaleManager over the store and the config)
// -----------------------------------------------------------------------------

    console.log('\n  The scale (the shipped ScaleManager, the shipped config, the real store)');
    const Setup = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__SheetSetup__.js', { Na__LeCfg__Val : Val, Na__LeCfg__Num : Num });
    const Scale = await load(LE + '07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js', {
        Na__LeCfg__GetScaleSetup       : Setup.Na__LeCfg__GetScaleSetup,
        Na__DrawData__GetCustomScales  : Data.Na__DrawData__GetCustomScales,
        Na__DrawData__SetCustomScales  : Data.Na__DrawData__SetCustomScales
    });

    check('a scale is typed as "500", "1:500" or " 1 : 75 ", or given as a number',
        [ '500', '1:500', ' 1 : 75 ', 500, 100000, 1 ].map(Scale.Na__LeScale__CustomValue), [ 500, 500, 75, 500, 100000, 1 ]);
    check('a fraction, nothing, zero, a negative, a word or past 1:100,000 is not a scale',
        [ '37.5', '', '0', '-5', 'abc', '100001', null, undefined, '1:' ].map(Scale.Na__LeScale__CustomValue), [ null, null, null, null, null, null, null, null, null ]);
    check('with none added the lists are exactly the app\'s own',
        [ Scale.Na__LeScale__ListDenominators(), Scale.Na__LeScale__ListDenominators(true) ], [ [ 20, 50, 100, 200 ], [ 100, 200, 500, 1250, 2500, 5000 ] ]);

    check('SetCustom writes the list through the store', [ Scale.Na__LeScale__SetCustom([ '1:500', 75, 'nonsense' ]), Scale.Na__LeScale__ListCustom() ], [ true, [ 75, 500 ] ]);
    check('the custom scales join the architectural list, in order', Scale.Na__LeScale__ListDenominators(), [ 20, 50, 75, 100, 200, 500 ]);
    check('and the site plan list, in order, once each', Scale.Na__LeScale__ListDenominators(true), [ 75, 100, 200, 500, 1250, 2500, 5000 ]);
    check('the Viewport panel names them like any other scale', Scale.Na__LeScale__ListDenominators().map(Scale.Na__LeScale__FormatLabel), [ '1:20', '1:50', '1:75', '1:100', '1:200', '1:500' ]);

    check('an architectural viewport keeps a custom 1:500 and 1:75', [ Scale.Na__LeScale__Coerce(500), Scale.Na__LeScale__Coerce(75) ], [ 500, 75 ]);
    check('a whole scale on no list at all is kept, not reset', [ Scale.Na__LeScale__Coerce(150), Scale.Na__LeScale__Coerce(150, true) ], [ 150, 150 ]);
    check('a scale from the other kind\'s list is kept too (an eyedropper or a paste may carry it across)', [ Scale.Na__LeScale__Coerce(1250), Scale.Na__LeScale__Coerce(20, true) ], [ 1250, 20 ]);
    check('a fraction, a word or nothing still takes the default', [ Scale.Na__LeScale__Coerce(37.5), Scale.Na__LeScale__Coerce('x'), Scale.Na__LeScale__Coerce(undefined), Scale.Na__LeScale__Coerce(0, true) ], [ 50, 50, 50, 500 ]);
    check('a custom scale counts as listed; a stray one does not', [ Scale.Na__LeScale__IsListed(500), Scale.Na__LeScale__IsListed(75), Scale.Na__LeScale__IsListed(150) ], [ true, true, false ]);
    check('a caption and the title block quote it as it is',
        [ Scale.Na__LeScale__FormatLabel(500), Scale.Na__LeScale__SheetLabel([ 500 ], 'A1'), Scale.Na__LeScale__SheetLabel([ 500, 100 ], 'A1'), Scale.Na__LeScale__SheetLabel([ 150 ]) ],
        [ '1:500', '1:500 @ ISO A1', '1:100 & 1:500 @ ISO A1', '1:150' ]);
    check('a frame 100 mm wide at 1:500 shows 50 m of the model', Scale.Na__LeScale__PaperToModelMm(100, 500), 50000);
    check('the toggle runs on through the custom scales and back round', [ Scale.Na__LeScale__Next(200), Scale.Na__LeScale__Next(500) ], [ 500, 20 ]);

    // With the list not loaded (the store answers nothing), a stored 1:500 is still kept
    const Bare = await load(LE + '07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js', { Na__LeCfg__GetScaleSetup : Setup.Na__LeCfg__GetScaleSetup });
    check('before the project\'s list is known, an architectural 1:500 is still 1:500, and so is a stray 1:750',
        [ Bare.Na__LeScale__ListDenominators(), Bare.Na__LeScale__Coerce(500), Bare.Na__LeScale__Coerce(500, true), Bare.Na__LeScale__Coerce(750) ], [ [ 20, 50, 100, 200 ], 500, 500, 750 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record (the shipped SheetRecords normaliser)
// -----------------------------------------------------------------------------

    console.log('\n  The record (the shipped SheetRecords normaliser)');
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
    const elevation = (scale) => ({
        Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__SceneId : 'Scene_012', Viewport__DrawingId : 'Elevation_001',
        Viewport__Name : '', Viewport__LayerId : 'Layer_005', Viewport__ScaleDenominator : scale,
        Viewport__FrameMm : { X : 7.8, Y : 17.6, WidthMm : 594.7, HeightMm : 106.3 }, Viewport__PanMm : { X : 28509, Y : -2727 }
    });
    check('JW02\'s north elevation saved at 1:500 loads at 1:500', Records.Na__LeRec__NormaliseViewport(elevation(500), 'L').Viewport__ScaleDenominator, 500);
    check('and twice over, unchanged', JSON.stringify(Records.Na__LeRec__NormaliseViewport(Records.Na__LeRec__NormaliseViewport(elevation(500), 'L'), 'L')), JSON.stringify(Records.Na__LeRec__NormaliseViewport(elevation(500), 'L')));
    const RecordsBare = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', Object.assign({
        Na__LeCfg__GetViewportSetup : Setup.Na__LeCfg__GetViewportSetup,
        Na__LeScale__Coerce         : Bare.Na__LeScale__Coerce
    }, FIELDS));
    check('a load before the project\'s list is known keeps 1:500 and a stray 1:150 too', [ 500, 150 ].map((d) => RecordsBare.Na__LeRec__NormaliseViewport(elevation(d), 'L').Viewport__ScaleDenominator), [ 500, 150 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Model (the shipped Viewports unit's AddCustomScale and RemoveCustomScale)
// -----------------------------------------------------------------------------

    console.log('\n  The model (the shipped Viewports unit: AddCustomScale, RemoveCustomScale)');
    Scale.Na__LeScale__SetCustom([]);
    const touched = [];
    const sheets  = [ { Sheet__Id : 'Sheet_001', Sheet__Viewports : [ elevation(100) ] }, { Sheet__Id : 'Sheet_002', Sheet__Viewports : [ elevation(200), Object.assign(elevation(500), { Viewport__Kind : '3d' }) ] } ];
    const Views = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Viewports__.js', {
        Na__LeModel__KIND_2D           : '2d',
        Na__LeModel__KIND_3D           : '3d',
        Na__LeModel__Touch             : (reason, sheetId) => touched.push([ reason, sheetId ]),
        Na__LeModel__Array             : () => sheets,
        Na__LeScale__Coerce            : Scale.Na__LeScale__Coerce,
        Na__LeScale__CustomValue       : Scale.Na__LeScale__CustomValue,
        Na__LeScale__ListCustom        : Scale.Na__LeScale__ListCustom,
        Na__LeScale__SetCustom         : Scale.Na__LeScale__SetCustom,
        Na__LeScale__ListDenominators  : Scale.Na__LeScale__ListDenominators
    });

    check('Add custom scale "1:500" adds 1:500 and announces it once, as "scales"', [ Views.Na__LeModel__AddCustomScale('1:500', false), touched ], [ { ok : true, denominator : 500, reason : null }, [ [ 'scales', null ] ] ]);
    check('the project\'s list holds it', Scale.Na__LeScale__ListCustom(), [ 500 ]);
    touched.length = 0;
    check('adding it again is refused as already listed, with nothing announced', [ Views.Na__LeModel__AddCustomScale('500', false), touched.length ], [ { ok : false, denominator : 500, reason : 'listed' }, 0 ]);
    check('so is one of the app\'s own scales', Views.Na__LeModel__AddCustomScale('50', false).reason, 'listed');
    check('1:500 is on the site plan list already, so a site plan viewport refuses it too', Views.Na__LeModel__AddCustomScale('500', true).reason, 'listed');
    check('but an architectural viewport may add a scale only the site plan list had', Views.Na__LeModel__AddCustomScale('1250', false), { ok : true, denominator : 1250, reason : null });
    check('a fraction or a word is refused as not a scale, with nothing written', [ Views.Na__LeModel__AddCustomScale('37.5', false).reason, Views.Na__LeModel__AddCustomScale('abc', false).reason, Scale.Na__LeScale__ListCustom() ], [ 'invalid', 'invalid', [ 500, 1250 ] ]);

    touched.length = 0;
    sheets[0].Sheet__Viewports.push(elevation(500));
    sheets[1].Sheet__Viewports.push(elevation(500));
    check('a custom scale two viewports are drawn at stays on the list, and says how many', [ Views.Na__LeModel__RemoveCustomScale(500), Scale.Na__LeScale__ListCustom(), touched.length ], [ { ok : false, reason : 'in-use', inUse : 2 }, [ 500, 1250 ], 0 ]);
    check('a 3D viewport does not count: it has no scale', sheets[1].Sheet__Viewports.filter((v) => v.Viewport__Kind === '3d').length, 1);
    check('one of the app\'s own scales is not a custom scale to take off', Views.Na__LeModel__RemoveCustomScale(50), { ok : false, reason : 'not-custom', inUse : 0 });
    check('a custom scale nothing uses comes off, announced', [ Views.Na__LeModel__RemoveCustomScale('1:1250'), Scale.Na__LeScale__ListCustom(), touched ], [ { ok : true, reason : null, inUse : 0 }, [ 500 ], [ [ 'scales', null ] ] ]);
    sheets[0].Sheet__Viewports.pop();
    sheets[1].Sheet__Viewports.pop();
    check('and so does 1:500 once no viewport is drawn at it, which leaves the block as it was', [ Views.Na__LeModel__RemoveCustomScale(500).ok, Object.prototype.hasOwnProperty.call(block, KEY) ], [ true, false ]);

// endregion -------------------------------------------------------------------


    console.log(failures === 0 ? '\nPASS - every check passed.' : '\nFAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);
