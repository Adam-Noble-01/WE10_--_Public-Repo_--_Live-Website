// =============================================================================
// TRUEVISION3D - TEST - POINT CLOUD VIEWPORTS
// =============================================================================
//
// FILE       : Na__Test__PointCloudViewports__.test.mjs
// PURPOSE    : Prove a SketchUp point cloud scene lands on a TrueVision drawing
//              where the linework puts the same points, and that the record,
//              the store and the layer refuse what they should
// CREATED    : 19-Oct-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__PointCloudViewports__.test.mjs
//
// HOW IT WORKS:
// - The Hide Swings test's loader: each SHIPPED module is read, its imports are
//   removed and replaced with this test's stubs (or the real modules this test
//   loaded first), and the rest runs byte for byte as it ships.
// - The fixture, Na__Test__PointCloud__Fixture__, is the JSON a real export
//   wrote (GLB Builder 2.11 and Point Cloud Viewer 0.9, scratch project ZZ99,
//   19-Oct-2026): the store manifest and six revision manifests. No pictures:
//   nothing here draws. fetch is stubbed to read it, so nothing touches the
//   network.
//
// WHAT IT GUARDS:
// - THE ALIGNMENT, END TO END. Each revision records where the survey datum
//   fell in its own picture (Datum__ImagePixel, worked out in Ruby from the
//   SketchUp camera). Mapped through the placement built from the DRAWING's
//   basis, that pixel must land on the datum's drawing position as the
//   linework projection computes it. A wrong axis, sign, origin or pixel
//   convention anywhere moves it by metres.
// - The record keeps the block only where it means something, and the merge
//   patch changes one setting at a time.
// - The store reads scene ids (never names), current and pinned exports, and
//   the Site Plan scene type.
// - The layer refuses a 3D View on a drawing, a scene looking the wrong way, a
//   plan scene on an elevation, and says how far a near miss drifts.
// - PERSPECTIVE (TrueVision3D v2.178.0). A 3D View export lays on a 3D
//   viewport whose scene is seen from its camera: the store keeps the camera,
//   Scene Sync's scene of the same SketchUp scene matches it to a millimetre,
//   PerspectiveRect places it, and Fill3d draws it over the picture.
// - TWO KINDS OF OFF (19-Oct-2026). The working view (Point Cloud Tools'
//   checkboxes) switches point clouds off on screen only: Fill draws and
//   fetches nothing for one, while the export path still finds it ready. The
//   drawing's own off (PointCloud__Hidden) is the Render Composites panel's
//   Point Cloud row, read from the shipped config.
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
    const LE         = '51__System__LayoutEditor/';
    const FIXTURE    = resolve(SCRIPT_DIR, 'Na__Test__PointCloud__Fixture__');
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

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
        const key = '__PointCloudStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        // import.meta.url must still point beside the shipped file (the config module finds its JSON by it)
        const body = src.replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(resolve(SRC, relative)).href));
        const tmp = join(tmpdir(), 'Na__Test__PointCloud__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + body, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks, the Browser Stubs and the Fixture's fetch
// -----------------------------------------------------------------------------

    let failures = 0, passes = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    function near(name, got, want, tolerance) {
        const passed = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + (passed ? '' : '  (got ' + got + ', want ' + want + ' within ' + tolerance + ')'));
    }

    const CDN   = 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/ZZ99__PointCloudTest/30__TrueVision__AppContent/PointCloud__ViewportData';
    const LOCAL = 'http://127.0.0.1:8523/na-project-portal/26-Projects/ZZ99__PointCloudTest/30__TrueVision__AppContent/PointCloud__ViewportData';
    const asked = [];
    let localServes = false;
    globalThis.fetch = async (url) => {
        asked.push(String(url));
        const fromCdn   = String(url).indexOf(CDN + '/') === 0;
        const fromLocal = String(url).indexOf(LOCAL + '/') === 0;
        if (!fromCdn && !(fromLocal && localServes)) return { ok : false, status : 404, json : async () => null };
        const rel = String(url).slice((fromCdn ? CDN : LOCAL).length + 1).split('?')[0];
        try {
            const text = readFileSync(join(FIXTURE, rel), 'utf8');
            return { ok : true, status : 200, json : async () => JSON.parse(text) };
        } catch (error) {
            return { ok : false, status : 404, json : async () => null };
        }
    };
    const events = [];
    globalThis.window = {
        location : { origin : 'http://127.0.0.1:8523' }, devicePixelRatio : 1,
        dispatchEvent (event) { events.push(event.detail && event.detail.reason); }, addEventListener () {},
        requestAnimationFrame (fn) { setTimeout(fn, 0); return 1; }                // <-- After the caller has booked it, as a browser does
    };
    globalThis.CustomEvent = class { constructor (type, init) { this.type = type; Object.assign(this, init); } };
    const settle = () => new Promise((done) => setTimeout(done, 0));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record (the shipped SheetRecords normaliser and UpdateViewport)
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - Point cloud viewports\n\n  The record');
    const CONFIG = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const Val = (block, key, fallback) => {
        const b = CONFIG['LayoutEditor__' + block + '__Config'];
        const v = b ? b['LayoutEditor__' + block + '__' + key] : undefined;
        return (v === undefined || v === null) ? fallback : v;
    };
    const Num   = (block, key, fallback) => { const v = Val(block, key, undefined); return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback; };
    const Setup = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__SheetSetup__.js', { Na__LeCfg__Val : Val, Na__LeCfg__Num : Num });
    const Scale = await load(LE + '07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js', { Na__LeCfg__GetScaleSetup : Setup.Na__LeCfg__GetScaleSetup });
    const Rot   = await load(LE + '20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js', {});
    const FIELDS = {
        Na__LeEdge__FIELD : 'Viewport__ProjectedEdges', Na__LeEdge__CAT_FIELD : 'Edges__Categories', Na__LeComposite__FIELD : 'Viewport__CompositeWeights',
        Na__LeHatch__FIELD : 'Viewport__SitePlanHatches', Na__LeHatch__CAT_FIELD : 'Hatches__Categories',
        Na__LeSpComp__DECK_FIELD : 'SitePlan__Composites', Na__LeSpComp__TYPE_FIELD : 'SitePlan__PlanType',
        Na__LeVpRot__FIELD : Rot.Na__LeVpRot__FIELD, Na__LeVpRot__WrapDeg : Rot.Na__LeVpRot__WrapDeg
    };
    const Records = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', Object.assign({
        Na__LeCfg__GetViewportSetup : Setup.Na__LeCfg__GetViewportSetup, Na__LeScale__Coerce : Scale.Na__LeScale__Coerce
    }, FIELDS));
    const norm = (record) => Records.Na__LeRec__NormaliseViewport(JSON.parse(JSON.stringify(record)), 'Layer_001');
    const base = { Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__DrawingId : 'E01' };

    check('a viewport without a point cloud carries no key (every record from before is unchanged)', 'Viewport__PointCloud' in norm(base), false);
    check('a scene id alone is the whole block (every other setting is its default)',
        norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : ' pcs_7d342e28 ' } })).Viewport__PointCloud, { PointCloud__SceneId : 'pcs_7d342e28' });
    check('defaults leave no trace: false, null and junk are dropped; true, numbers and a real revision stay',
        norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Opacity : 0.456, PointCloud__LineworkOnTop : false,
            PointCloud__PinnedRevision : 'Rev__3b12b99254', PointCloud__ShowDatum : true, PointCloud__Hidden : 'yes', Junk : 1 } })).Viewport__PointCloud,
        { PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Opacity : 0.46, PointCloud__PinnedRevision : 'Rev__3b12b99254', PointCloud__ShowDatum : true });
    check('opacity is held to 0..1',
        [ norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a', PointCloud__Opacity : 7 } })).Viewport__PointCloud.PointCloud__Opacity,
          norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a', PointCloud__Opacity : -1 } })).Viewport__PointCloud.PointCloud__Opacity ], [ 1, 0 ]);
    check('a revision that is not one (a path, a name) is never kept',
        'PointCloud__PinnedRevision' in norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a', PointCloud__PinnedRevision : '../Rev__x' } })).Viewport__PointCloud, false);
    check('a scene id that could be a path is refused outright',
        'Viewport__PointCloud' in norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : '../../etc' } })), false);
    check('a 3D viewport keeps the block (a 3D View scene is laid over its picture, TrueVision3D v2.178.0)',
        norm(Object.assign({}, base, { Viewport__Kind : '3d', Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a' } })).Viewport__PointCloud, { PointCloud__SceneId : 'pcs_a' });
    check('a viewport of no kind it knows becomes 2D, as every viewport always has', norm(Object.assign({}, base, { Viewport__Kind : 'odd', Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a' } })).Viewport__Kind, '2d');
    check('a SITE PLAN viewport keeps it (a Site Plan scene lays on it as on a plan)',
        norm({ Viewport__Id : 'Viewport_002', Viewport__Kind : '2d', Viewport__SitePlan : {}, Viewport__PointCloud : { PointCloud__SceneId : 'pcs_site' } }).Viewport__PointCloud, { PointCloud__SceneId : 'pcs_site' });
    check('IsPointCloudViewport reads it', [ Records.Na__LeRec__IsPointCloudViewport(norm(Object.assign({}, base, { Viewport__PointCloud : { PointCloud__SceneId : 'pcs_a' } }))), Records.Na__LeRec__IsPointCloudViewport(norm(base)) ], [ true, false ]);

    const State = { Na__LeModel__KIND_2D : '2d', Na__LeModel__KIND_3D : '3d', Na__LeModel__SCENES_KEY : 'Scenes', Na__LeModel__STYLE_KEYS : Records.Na__LeRec__STYLE_KEYS,
                    Na__LeModel__Touch () {}, Na__LeModel__Unselect () {}, Na__LeModel__AssignDirty () {} };
    const Viewports = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Viewports__.js', Object.assign({}, FIELDS, State, {
        Na__LeRec__IsSitePlanViewport : Records.Na__LeRec__IsSitePlanViewport, Na__LeRec__IsPointCloudViewport : Records.Na__LeRec__IsPointCloudViewport,
        Na__LeRec__NextId : Records.Na__LeRec__NextId, Na__LeRec__Find : Records.Na__LeRec__Find, Na__LeRec__NormaliseViewport : Records.Na__LeRec__NormaliseViewport,
        Na__LeScale__Coerce : Scale.Na__LeScale__Coerce, Na__LeComposite__Clamp : (k, v) => v, Na__LeCfg__GetLabel : (k, f) => f,
        Na__LeModel__GetLayerById : () => ({}), Na__LeModel__DefaultLayerId : () => 'Layer_001', Na__LeModel__PruneGroups () {}
    }));
    const sheet = { Sheet__Id : 'S1', Sheet__Viewports : [], Sheet__Dimensions : [] };
    const made  = Viewports.Na__LeModel__CreateViewport(sheet, { kind : '2d', drawingId : 'E01', pointCloud : { PointCloud__SceneId : 'pcs_7d342e28' } });
    check('CreateViewport takes the pointCloud option', made.Viewport__PointCloud, { PointCloud__SceneId : 'pcs_7d342e28' });
    Viewports.Na__LeModel__UpdateViewport(sheet, made.Viewport__Id, { pointCloud : { PointCloud__Opacity : 0.4 } });
    Viewports.Na__LeModel__UpdateViewport(sheet, made.Viewport__Id, { pointCloud : { PointCloud__PinnedRevision : 'Rev__3b12b99254' } });
    check('one setting at a time: a pin keeps the opacity set before it', made.Viewport__PointCloud,
        { PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Opacity : 0.4, PointCloud__PinnedRevision : 'Rev__3b12b99254' });
    Viewports.Na__LeModel__UpdateViewport(sheet, made.Viewport__Id, { pointCloud : { PointCloud__PinnedRevision : null } });
    check('a key sent as null goes back to its default (SketchUp Sync on again)', made.Viewport__PointCloud, { PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Opacity : 0.4 });
    const pasted = Viewports.Na__LeModel__InsertViewport(sheet, made, true);
    check('a paste or duplicate keeps the point cloud', pasted.Viewport__PointCloud, made.Viewport__PointCloud);
    Viewports.Na__LeModel__UpdateViewport(sheet, made.Viewport__Id, { pointCloud : null });
    check('pointCloud : null takes the scene off', 'Viewport__PointCloud' in made, false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Placement, End to End Against the Real Frames
// -----------------------------------------------------------------------------

    console.log('\n  The placement (each export\'s own datum pixel must land on the datum)');
    const Place = await load(LE + '22__System__PointCloudData/Na__PointCloud__Placement__.js', {});
    const revisionJson = (scene, rev) => JSON.parse(readFileSync(join(FIXTURE, 'PointCloudScene__' + scene, rev, 'PointCloudScene__RevisionManifest__.json'), 'utf8'));

    // THE DRAWINGS' OWN BASES, written out exactly as the shipped code builds them:
    // Na__ElevData__GetAxes (normal = (sin a, 0, -cos a), right = (normalZ, 0, -normalX))
    // and Na__PlView__ElevationBasis / Na__PlView__PlanBasis.
    const elevationDefinition = (azimuthDeg) => {
        const a = azimuthDeg * Math.PI / 180, normalX = Math.sin(a), normalZ = -Math.cos(a), rightX = normalZ, rightZ = -normalX;
        const snap = (v) => (Math.abs(v) < 1e-9 ? 0 : (Math.abs(v - 1) < 1e-9 ? 1 : (Math.abs(v + 1) < 1e-9 ? -1 : v)));
        return { Kind : 'elevation', Basis : { XAxisTo : [ snap(rightX), snap(normalX), 0 ], YAxisTo : [ 0, 0, -1 ], ZAxisTo : [ snap(rightZ), snap(normalZ), 0 ] } };
    };
    const planDefinition = { Kind : 'plan', Basis : { XAxisTo : [ 1, 0, 0 ], YAxisTo : [ 0, 1, 0 ], ZAxisTo : [ 0, 0, 1 ] } };
    // The linework's own drawing coordinates for a world point, from the same formulas.
    const elevationDrawingMm = (p, azimuthDeg) => {
        const a = azimuthDeg * Math.PI / 180, normalX = Math.sin(a), normalZ = -Math.cos(a);
        return { x : 1000 * ((p[0] * normalZ) + (p[2] * -normalX)), y : -1000 * p[1] };   // <-- Na__ElevData__WorldToRunMm, and drawing y = minus height
    };

    const cases = [
        { name : 'Front Elevation 1:50 on an elevation at 180 degrees', scene : 'pcs_7d342e28', rev : 'Rev__99efbd9a1e', def : elevationDefinition(180), drawing : (p) => elevationDrawingMm(p, 180) },
        { name : 'Front Detail 1:10 (7854 x 4834 px, 12 tiles) on the same elevation', scene : 'pcs_73792e75', rev : 'Rev__8b7c9ab631', def : elevationDefinition(180), drawing : (p) => elevationDrawingMm(p, 180) },
        { name : 'Ground Floor Plan 1:50 on a plan', scene : 'pcs_9f322302', rev : 'Rev__abf7eb2d45', def : planDefinition, drawing : (p) => ({ x : 1000 * p[0], y : 1000 * p[2] }) }
    ];
    cases.forEach((item) => {
        const raw   = revisionJson(item.scene, item.rev);
        const axes  = Place.Na__PcPlace__DrawingAxes(item.def);
        const m     = Place.Na__PcPlace__Matrix(raw.Frame, axes);
        const datum = raw.Datums[0];
        const got   = Place.Na__PcPlace__Apply(m, datum.Datum__ImagePixel[0], datum.Datum__ImagePixel[1]);
        const want  = item.drawing(datum.Datum__PositionM);
        const err   = Math.hypot(got.x - want.x, got.y - want.y);
        near(item.name + ': the datum pixel lands on the datum (' + err.toFixed(4) + ' mm off)', err, 0, raw.Frame.PixelSizeM * 1000 * 0.01);
        near(item.name + ': the scene and the drawing look the same way', Place.Na__PcPlace__AlignmentDeg(raw.Frame, axes), 0, 1e-6);
        near(item.name + ': one image pixel is ' + (raw.Frame.PixelSizeM * 1000).toFixed(4) + ' drawing mm', 1 / Place.Na__PcPlace__PixelsPerMm(m), raw.Frame.PixelSizeM * 1000, 1e-9);
        const inv  = Place.Na__PcPlace__Invert(m);
        const back = Place.Na__PcPlace__Apply(inv, got.x, got.y);
        near(item.name + ': the map undoes', Math.hypot(back.x - datum.Datum__ImagePixel[0], back.y - datum.Datum__ImagePixel[1]), 0, 1e-6);
    });

    const front = revisionJson('pcs_7d342e28', 'Rev__99efbd9a1e');
    near('an elevation 1 degree off reads 1 degree', Place.Na__PcPlace__AlignmentDeg(front.Frame, Place.Na__PcPlace__DrawingAxes(elevationDefinition(181))), 1, 1e-9);
    near('the back of the building (azimuth 0) reads 180 degrees', Place.Na__PcPlace__AlignmentDeg(front.Frame, Place.Na__PcPlace__DrawingAxes(elevationDefinition(0))), 180, 1e-9);
    near('an elevation scene on a plan reads 90 degrees', Place.Na__PcPlace__AlignmentDeg(front.Frame, Place.Na__PcPlace__DrawingAxes(planDefinition)), 90, 1e-9);
    near('a site plan reads exactly as a plan (the plan scene, 0 degrees)', Place.Na__PcPlace__AlignmentDeg(revisionJson('pcs_9f322302', 'Rev__abf7eb2d45').Frame, Place.Na__PcPlace__SitePlanAxes()), 0, 1e-9);
    near('a hundredth of a degree is still seen (atan2, not acos)', Place.Na__PcPlace__AlignmentDeg(front.Frame, Place.Na__PcPlace__DrawingAxes(elevationDefinition(180.01))), 0.01, 1e-9);
    near('drift at 1 degree is 17.5 mm per metre of depth', Place.Na__PcPlace__DriftMmPerM(1), 17.455, 0.001);
    check('a perspective frame is not an orthographic one', Place.Na__PcPlace__IsOrthoFrame(revisionJson('pcs_fb6ee416', 'Rev__146c88cd1d').Frame), false);

    // Tiles through a window: the 1:10 detail, a window over its right half only
    const detail = revisionJson('pcs_73792e75', 'Rev__8b7c9ab631');
    const dm     = Place.Na__PcPlace__Matrix(detail.Frame, Place.Na__PcPlace__DrawingAxes(elevationDefinition(180)));
    const tiles  = detail.Image.Tiles.map((t) => Object.assign({ HasFile : !!t.File }, t));
    const whole  = Place.Na__PcPlace__BoundsMm(dm, detail.Frame.WidthPx, detail.Frame.HeightPx);
    const pixelMm = detail.Frame.PixelSizeM * 1000;
    const right  = { MinX : whole.MinX + (4200 * pixelMm), MinY : whole.MinY, MaxX : whole.MaxX, MaxY : whole.MaxY };   // <-- From pixel 4200: past column 1 (2048 to 4096)
    check('a window over the whole picture asks for every tile that holds something (8 of 12)', Place.Na__PcPlace__VisibleTiles(tiles, dm, whole, 0).length, 8);
    check('a window from pixel 4200 rightwards asks only for columns 2 and 3', Place.Na__PcPlace__VisibleTiles(tiles, dm, right, 0).map((t) => t.Col).filter((c, i, all) => all.indexOf(c) === i).sort(), [ 2, 3 ]);
    check('and a margin of 200 px reaches back into column 1', Place.Na__PcPlace__VisibleTiles(tiles, dm, right, 200).some((t) => t.Col === 1), true);
    const preview = Object.assign({ HasFile : true }, detail.Image.Preview);
    check('the preview (factor 4) is enough for a screen at 0.2 device px per drawing mm, not at 1',
        [ Place.Na__PcPlace__PreviewSuffices(dm, preview, 0.2, 0.85), Place.Na__PcPlace__PreviewSuffices(dm, preview, 1, 0.85) ], [ true, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Store, Reading the Fixture
// -----------------------------------------------------------------------------

    console.log('\n  The store');
    let onLocalhost = false;
    const storeStubs = {
        Na__CfApi__GetLoadedProjectData : () => ({ PointCloud__DataStore : { PointCloud__BaseUrl : CDN, PointCloud__ManifestUrl : CDN + '/TrueVision__PointCloudData__Manifest__.json' } }),
        Na__AppUtils__IsRunningOnLocalhost : () => onLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl : () => 'ZZ99__PointCloudTest',
        Na__AppUtils__GetYearFromUrl : () => '26'
    };
    const Store = await load(LE + '22__System__PointCloudData/Na__PointCloud__Store__.js', storeStubs);
    const descriptor = await Store.Na__PcStore__Resolve();
    check('the store is read from the CDN off localhost', [ Store.Na__PcStore__GetStatus(), descriptor.Store__Source ], [ 'ready', 'cdn' ]);
    check('the manifest is always asked of the network, never a cache', asked.filter((u) => u.endsWith('Manifest__.json')).length >= 1, true);
    check('active scenes, by name; the retired plan is kept for pinned viewports but not offered',
        [ Store.Na__PcStore__GetScenes(false).map((s) => s.Scene__Name), Store.Na__PcStore__GetScenes(true).filter((s) => s.Scene__Status === 'retired').map((s) => s.Scene__Name) ],
        [ [ 'From the proposed model', 'Front Detail', 'Front Elevation', 'Street View' ], [ 'Ground Floor Plan' ] ]);
    const frontScene = Store.Na__PcStore__GetScene('pcs_7d342e28');
    check('a scene: its type, scale, opacity and current export', [ frontScene.Scene__ViewType, frontScene.Scene__ScaleDenominator, frontScene.Scene__DefaultOpacity, frontScene.Scene__CurrentRevision, frontScene.Scene__Revisions.length ],
        [ 'elevation', 50, 0.65, 'Rev__99efbd9a1e', 2 ]);
    check('the Site Plan type is known by its label', Store.Na__PcStore__ViewTypeLabel('siteplan'), 'Site Plan');
    check('Plan and Site Plan look down; Elevation and Section face', [ Store.Na__PcStore__IsTopDown('siteplan'), Store.Na__PcStore__IsTopDown('plan'), Store.Na__PcStore__IsFacing('section'), Store.Na__PcStore__IsTopDown('elevation') ], [ true, true, true, false ]);
    check('a viewport follows the current export, or keeps its pin', [ Store.Na__PcStore__RevisionIdFor({}, frontScene), Store.Na__PcStore__RevisionIdFor({ PointCloud__PinnedRevision : 'Rev__3b12b99254' }, frontScene) ], [ 'Rev__99efbd9a1e', 'Rev__3b12b99254' ]);
    const revision = await Store.Na__PcStore__LoadRevision('pcs_73792e75', 'Rev__8b7c9ab631');
    check('a revision: 12 tiles, 8 with files, each with its CDN URL', [ revision.Image.Tiles.length, revision.Image.Tiles.filter((t) => t.HasFile).length, revision.Image.Tiles[1].Urls ],
        [ 12, 8, [ CDN + '/PointCloudScene__pcs_73792e75/Rev__8b7c9ab631/PointCloud__Tile__R00__C01__.webp' ] ]);
    check('its preview, reduced by 4', [ revision.Image.Preview.Factor, revision.Image.Preview.WidthPx, revision.Image.Preview.HasFile ], [ 4, 1964, true ]);
    const pinnedOld = await Store.Na__PcStore__LoadRevision('pcs_7d342e28', 'Rev__3b12b99254');
    check('an older, pinned export still loads', pinnedOld && pinnedOld.Revision__Id, 'Rev__3b12b99254');
    check('a revision id that is not one loads nothing', await Store.Na__PcStore__LoadRevision('pcs_7d342e28', '../../x'), null);
    const foreign = await Store.Na__PcStore__LoadRevision('pcs_0ther111', 'Rev__abcdef0123').catch(() => 'rejected');
    check('a scene whose export is not there rejects and says so (and can be retried)', [ foreign, typeof Store.Na__PcStore__GetRevisionNote('Rev__abcdef0123') ], [ 'rejected', 'string' ]);

    onLocalhost = true; localServes = true; asked.length = 0;
    await Store.Na__PcStore__Reload();
    check('on localhost the repository copy is read first', [ Store.Na__PcStore__GetDescriptor().Store__Source, asked[0].indexOf(LOCAL) === 0 ], [ 'local', true ]);
    const local = await Store.Na__PcStore__LoadRevision('pcs_7d342e28', 'Rev__99efbd9a1e');
    check('and every file lists the local copy first, the CDN second (tiles are not in git)', local.Image.Tiles[0].Urls.map((u) => u.indexOf(LOCAL) === 0 ? 'local' : 'cdn'), [ 'local', 'cdn' ]);
    onLocalhost = false; localServes = false;
    await Store.Na__PcStore__Reload();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Layer's Verdicts
// -----------------------------------------------------------------------------

    console.log('\n  The layer (what it draws and what it refuses)');
    const Cfg   = await load(LE + '22__System__PointCloudData/Na__PointCloud__Config__.js', {});
    const fixtureFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {                                          // <-- The config file beside the module, then the fixture as before
        if (String(url).startsWith('file:')) { const text = readFileSync(fileURLToPath(String(url)), 'utf8'); return { ok : true, status : 200, json : async () => JSON.parse(text) }; }
        return fixtureFetch(url);
    };
    await Cfg.Na__PcCfg__Ready();
    check('the shipped config: refused past 1 degree, quiet under 0.05', [ Cfg.Na__PcCfg__Alignment().toleranceDeg, Cfg.Na__PcCfg__Alignment().quietDeg ], [ 1, 0.05 ]);
    const Layer = await load(LE + '20__System__Viewports/Na__LayoutEditor__Viewport2d__PointCloud__.js', Object.assign({},
        Store, Place, Cfg, {
            Na__LeModel__IsSitePlanViewport : Records.Na__LeRec__IsSitePlanViewport,
            Na__LeModel__IsPointCloudViewport : Records.Na__LeRec__IsPointCloudViewport,
            Na__LeVp2d__States : new Map()
        }));
    const viewportFor = (block) => norm(Object.assign({}, base, { Viewport__PointCloud : block }));
    const verdict = async (block, definition) => {
        const viewport  = viewportFor(block);
        let resolved = Layer.Na__LeVp2d__PointCloudResolve(viewport, { definition : definition }, true);
        await settle(); await settle();
        resolved = Layer.Na__LeVp2d__PointCloudResolve(viewport, { definition : definition }, true);
        return resolved;
    };
    let r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28' }, elevationDefinition(180));
    check('the 1:50 front elevation on its elevation: drawn, at the scene\'s own opacity', [ r.status, r.opacity, r.lineworkOnTop, r.angleDeg < 1e-9 ], [ 'ready', 0.65, false, true ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28' }, elevationDefinition(180.5));
    check('half a degree off: still drawn, and the drift is worked out (8.7 mm per metre)', [ r.status, Math.round(r.driftMmPerM * 10) / 10 ], [ 'ready', 8.7 ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28' }, elevationDefinition(182));
    check('two degrees off: refused, and the bearing it needs is given', [ r.status, r.message, Math.round(r.neededAzimuthDeg * 100) / 100 ],
        [ 'misaligned', 'This scene looks 2.00° away from this drawing, so it is not drawn.', 180 ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28' }, planDefinition);
    check('an elevation scene on a plan: refused, saying what it lays on', [ r.status, r.message ], [ 'misaligned', 'An elevation or section scene lays on an elevation or section viewport, not a plan.' ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_9f322302', PointCloud__PinnedRevision : 'Rev__abf7eb2d45' }, elevationDefinition(180));
    check('a plan scene on an elevation: refused the same way', [ r.status, r.message ], [ 'misaligned', 'A plan scene lays on a plan or site plan viewport, not this one.' ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_fb6ee416' }, elevationDefinition(180));
    check('a 3D View on a drawing: refused, saying it lays on a 3D viewport', [ r.status, r.message ], [ 'perspective', 'A 3D View scene lays on a 3D viewport, not on a drawing.' ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_nothere1' }, elevationDefinition(180));
    check('a scene not in the exports: says so', r.status, 'missing');
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Hidden : true }, elevationDefinition(180));
    check('hidden: attached, not drawn, nothing to complain about', [ r.status, r.message ], [ 'hidden', '' ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28', PointCloud__PinnedRevision : 'Rev__3b12b99254', PointCloud__Opacity : 0.3, PointCloud__LineworkOnTop : true }, elevationDefinition(180));
    check('pinned to the older export: drawn from it, and a newer one is known about', [ r.status, r.revisionId, r.newerExists, r.opacity, r.lineworkOnTop ], [ 'ready', 'Rev__3b12b99254', true, 0.3, true ]);
    r = await verdict({ PointCloud__SceneId : 'pcs_7d342e28' }, null);
    check('no drawing linked: says so', r.status, 'nodrawing');
    const site = norm({ Viewport__Id : 'Viewport_009', Viewport__Kind : '2d', Viewport__SitePlan : {}, Viewport__PointCloud : { PointCloud__SceneId : 'pcs_9f322302', PointCloud__PinnedRevision : 'Rev__abf7eb2d45' } });
    Layer.Na__LeVp2d__PointCloudResolve(site, null, true); await settle(); await settle();
    r = Layer.Na__LeVp2d__PointCloudResolve(site, null, true);
    check('a plan scene on a SITE PLAN viewport: drawn, in the site plan\'s own axes', [ r.status, r.axes.Kind ], [ 'ready', 'siteplan' ]);

    // THE DATUM, through the layer's own primitives: where the frame draws it
    const pushed = [];
    const Layer2 = await load(LE + '20__System__Viewports/Na__LayoutEditor__Viewport2d__PointCloud__.js', Object.assign({},
        Store, Place, Cfg, {
            Na__LeModel__IsSitePlanViewport : Records.Na__LeRec__IsSitePlanViewport,
            Na__LeModel__IsPointCloudViewport : Records.Na__LeRec__IsPointCloudViewport,
            Na__LeVp2d__States : new Map(),
            Na__LeChrome__PushPolyline : (list, points) => list.push({ kind : 'poly', points : points }),
            Na__LeChrome__PushLine : (list, x1, y1, x2, y2) => list.push({ kind : 'line', x1 : x1, y1 : y1, x2 : x2, y2 : y2 })
        }));
    const withDatum = viewportFor({ PointCloud__SceneId : 'pcs_7d342e28', PointCloud__ShowDatum : true });
    const resolvedDatum = Layer2.Na__LeVp2d__PointCloudResolve(withDatum, { definition : elevationDefinition(180) }, false);
    const datumMm = elevationDrawingMm(front.Datums[0].Datum__PositionM, 180);
    const win = { ToLocal : (x, y) => ({ x : (x - (datumMm.x - 50 * 100)) / 50, y : (y - (datumMm.y - 50 * 100)) / 50 }) };   // <-- A 1:50 window with the datum 100 mm in from its corner
    withDatum.Viewport__FrameMm = { X : 0, Y : 0, WidthMm : 200, HeightMm : 200 };
    const prims = Layer2.Na__LeVp2d__PointCloudDatumPrimitives(withDatum, resolvedDatum, win);
    const cross = prims.filter((p) => p.kind === 'line');
    check('the datum is drawn where the linework puts it: its cross meets at (100, 100) mm in the frame',
        cross.length === 2 ? [ Math.round(((cross[0].x1 + cross[0].x2) / 2) * 1000) / 1000, Math.round(cross[0].y1 * 1000) / 1000, Math.round(cross[1].x1 * 1000) / 1000 ] : cross, [ 100, 100, 100 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Two Kinds of Off: the Working View (on screen only) and the Drawing's
// -----------------------------------------------------------------------------

    console.log('\n  The working view and the Point Cloud composite');
    const listed = [ 'pcs_7d342e28', 'pcs_73792e75', 'pcs_9f322302' ];
    check('every point cloud is drawn while working until someone says otherwise',
        [ Layer.Na__LeVp2d__PointCloudWorkingVisible('pcs_7d342e28'), Layer.Na__LeVp2d__PointCloudWorkingSummary(listed) ], [ true, 'on' ]);
    const announced = [];
    const dispatchBefore = window.dispatchEvent;
    window.dispatchEvent = (event) => { announced.push(event.type); return dispatchBefore.call(window, event); };
    Layer.Na__LeVp2d__PointCloudSetAllWorkingVisible(false);
    await settle();
    check('the title checkbox off: every scene off on screen, one not even listed too, and the change is announced',
        [ listed.map((id) => Layer.Na__LeVp2d__PointCloudWorkingVisible(id)), Layer.Na__LeVp2d__PointCloudWorkingVisible('pcs_unlisted1'),
          Layer.Na__LeVp2d__PointCloudWorkingSummary(listed), announced.includes('na-pointcloud-working-changed') ],
        [ [ false, false, false ], false, 'off', true ]);
    Layer.Na__LeVp2d__PointCloudSetWorkingVisible('pcs_73792e75', true, listed);
    check('one scene ticked back on while all are off: that one alone, and the title reads mixed',
        [ listed.map((id) => Layer.Na__LeVp2d__PointCloudWorkingVisible(id)), Layer.Na__LeVp2d__PointCloudWorkingSummary(listed) ], [ [ false, true, false ], 'mixed' ]);
    const offOnScreen = viewportFor({ PointCloud__SceneId : 'pcs_7d342e28' });
    check('a scene off on screen still resolves ready on the export path: the PDF prints the drawing\'s own state',
        Layer.Na__LeVp2d__PointCloudResolve(offOnScreen, { definition : elevationDefinition(180) }, false).status, 'ready');
    const askedBefore = asked.length;
    const frameState  = {};
    Layer.Na__LeVp2d__PointCloudFill(frameState, null, offOnScreen, { definition : elevationDefinition(180) }, 4);
    await settle();
    check('Fill draws nothing for a scene off on screen and fetches nothing for it', [ frameState.pc || null, asked.length - askedBefore ], [ null, 0 ]);
    Layer.Na__LeVp2d__PointCloudSetAllWorkingVisible(true);
    check('the title checkbox on: every scene drawn again', [ listed.map((id) => Layer.Na__LeVp2d__PointCloudWorkingVisible(id)), Layer.Na__LeVp2d__PointCloudWorkingSummary(listed) ],
        [ [ true, true, true ], 'on' ]);
    window.dispatchEvent = dispatchBefore;

    // THE DRAWING'S OWN OFF: the Render Composites row, from the shipped config
    const Composites = await load(LE + '25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js', {});
    await Composites.Na__LeComposite__Ready();
    const rows = Composites.Na__LeComposite__Rows();
    const pcRow = rows.find((row) => row.key === 'pointCloud');
    check('Render Composites lists Point Cloud first (it is laid over the linework and the fog), a toggle with no weight, on 3D viewports too',
        pcRow ? [ rows[0].key, pcRow.label, pcRow.toggle, pcRow.twoDOnly, pcRow.weight.kind ] : null, [ 'pointCloud', 'Point Cloud', true, false, 'none' ]);
    check('its toggle is bound to the viewport\'s point cloud block, every other row to Viewport__Styles',
        [ pcRow && pcRow.binding, rows.filter((row) => row.key !== 'pointCloud').every((row) => row.binding === 'style') ], [ 'pointCloud', true ]);
    check('a viewport that never touched a weight keys exactly as before: no token from the new row',
        [ Composites.Na__LeComposite__Token(viewportFor({ PointCloud__SceneId : 'pcs_7d342e28', PointCloud__Hidden : true })), Composites.Na__LeComposite__RasterToken(viewportFor({ PointCloud__SceneId : 'pcs_7d342e28' })) ], [ '', '' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Perspective Exports on 3D Viewports (TrueVision3D v2.178.0)
// -----------------------------------------------------------------------------
//
// A 3D View export is laid over a 3D viewport whose scene is seen from the
// export's own camera. The scene here is built by Scene Sync's own record
// builder from the export's camera, exactly as a synced SketchUp scene is, so
// the check is the production path end to end: Scene Sync's Euler angles,
// read back by SceneCamera, against the export's three.js camera.
//
// -----------------------------------------------------------------------------

    console.log('\n  Perspective exports on 3D viewports');
    const streetRev = await Store.Na__PcStore__LoadRevision('pcs_fb6ee416', 'Rev__146c88cd1d');
    check('the store keeps a 3D View export whole: its frame\'s field of view and aspect, and the camera it was rendered from',
        [ streetRev.Frame.Kind, streetRev.Frame.FovVerticalDeg, Math.round(streetRev.Frame.Aspect * 1000), !!streetRev.Camera, streetRev.Camera && streetRev.Camera.FovVerticalDeg ],
        [ 'perspective', 35, 1778, true, 35 ]);
    check('and an elevation export, which has no field of view, keeps none', [ revision.Frame.FovVerticalDeg, revision.Frame.Aspect ], [ null, null ]);

    const SyncRec = await load('23__System__SceneSync/Na__SceneSync__Records__.js', {});
    const streetRaw = JSON.parse(readFileSync(join(FIXTURE, 'PointCloudScene__pcs_fb6ee416/Rev__146c88cd1d/PointCloudScene__RevisionManifest__.json'), 'utf8'));
    const syncRow = (camera) => ({ Scene__Id : 'sus_street01', Scene__PagePid : 7, Scene__Name : 'Street View', Scene__Type : 'view3d', Scene__TypeLabel : '3D View',
        Camera : camera, Section : null, Drawing : null, ModelLayers : { Hidden : [] }, Scene__Revision : 'aaaaaaaaaa', Scene__PointCloudSceneId : 'pcs_fb6ee416', Scene__State : 'synced' });
    const syncedScene = SyncRec.Na__SceneSync__Build({ rows : [ syncRow(streetRaw.Camera) ] }, {}).scenes[0];
    const gap = Place.Na__PcPlace__CameraGap(Place.Na__PcPlace__SceneCamera(syncedScene), streetRev.Camera);
    check('Scene Sync\'s scene of the same SketchUp scene is seen from the export\'s camera (to a millimetre and a hundredth of a degree)',
        [ syncedScene.Sync__PointCloudSceneId, gap.PositionMm < 1, gap.AngleDeg < 0.01, gap.UpDeg < 0.01, gap.FovDeg < 0.001 ], [ 'pcs_fb6ee416', true, true, true, true ]);
    const turned = JSON.parse(JSON.stringify(syncedScene));
    turned.PresentationMode__Scene__CameraPosition.Camera__DefaultRotation.Camera__DefaultRotation__RotY += 0.5 * Math.PI / 180;
    near('SceneCamera reads a turn of the record: half a degree about Y', Place.Na__PcPlace__CameraGap(Place.Na__PcPlace__SceneCamera(turned), streetRev.Camera).AngleDeg, 0.5, 0.02);

    const sameShape = Place.Na__PcPlace__PerspectiveRect({ X : 10, Y : 20, WidthMm : 320, HeightMm : 180 }, 35, streetRev.Frame);
    check('a picture in the export\'s own shape: the export IS the picture',
        [ sameShape.X, sameShape.Y, sameShape.WidthMm, sameShape.HeightMm ].map((v) => Math.round(v * 1000) / 1000), [ 10, 20, 320, 180 ]);
    const wider = Place.Na__PcPlace__PerspectiveRect({ X : 0, Y : 0, WidthMm : 400, HeightMm : 180 }, 35, streetRev.Frame);
    check('a wider picture: the export keeps its height and its shape, centred (the picture shows more scene each side)',
        [ wider.X, wider.Y, wider.WidthMm, wider.HeightMm ].map((v) => Math.round(v * 1000) / 1000), [ 40, 0, 320, 180 ]);
    const wideAngle = Place.Na__PcPlace__PerspectiveRect({ X : 0, Y : 0, WidthMm : 320, HeightMm : 180 }, 40, streetRev.Frame);
    near('a picture drawn with a wider field of view: the export shrinks by the ratio of the half angle tangents',
        wideAngle.HeightMm, 180 * Math.tan(17.5 * Math.PI / 180) / Math.tan(20 * Math.PI / 180), 1e-9);

    const base3d = { Viewport__Id : 'Viewport_003', Viewport__Kind : '3d', Viewport__SceneId : 'sus_street01',
                     Viewport__FrameMm : { X : 10, Y : 20, WidthMm : 320, HeightMm : 180 } };
    const view3d = (block) => norm(Object.assign({}, base3d, { Viewport__PointCloud : block }));
    check('a 3D viewport keeps its point cloud: the scene, the opacity, the pin and Hidden, never Linework On Top or Show Datum',
        view3d({ PointCloud__SceneId : 'pcs_fb6ee416', PointCloud__Opacity : 0.5, PointCloud__LineworkOnTop : true, PointCloud__ShowDatum : true,
                 PointCloud__PinnedRevision : 'Rev__146c88cd1d', PointCloud__Hidden : true }).Viewport__PointCloud,
        { PointCloud__SceneId : 'pcs_fb6ee416', PointCloud__Opacity : 0.5, PointCloud__PinnedRevision : 'Rev__146c88cd1d', PointCloud__Hidden : true });

    const picture3d = { X : 0, Y : 0, WidthMm : 320, HeightMm : 180 };
    const verdict3d = async (block, scene) => {
        const viewport = view3d(block);
        Layer.Na__LeVp2d__PointCloudResolve3d(viewport, scene, picture3d, true);
        await settle(); await settle();
        return Layer.Na__LeVp2d__PointCloudResolve3d(viewport, scene, picture3d, true);
    };
    let v3 = await verdict3d({ PointCloud__SceneId : 'pcs_fb6ee416' }, syncedScene);
    check('the 3D View on a 3D viewport of its synced scene: drawn, over the whole picture, at the scene\'s own opacity',
        [ v3.status, v3.opacity, v3.threeD, [ v3.rectMm.X, v3.rectMm.Y, v3.rectMm.WidthMm, v3.rectMm.HeightMm ].map((v) => Math.round(v * 100) / 100) ],
        [ 'ready', 0.65, true, [ 0, 0, 320, 180 ] ]);
    v3 = await verdict3d({ PointCloud__SceneId : 'pcs_fb6ee416' }, turned);
    check('its scene turned half a degree: refused, saying how far and what to use',
        [ v3.status, /not seen from the point cloud's camera \(0\.\d mm and 0\.(49|50|51)° away\)/.test(v3.message), /synced from the same SketchUp scene/.test(v3.message) ], [ 'misaligned', true, true ]);
    v3 = await verdict3d({ PointCloud__SceneId : 'pcs_fb6ee416' }, null);
    check('no scene linked: says so', [ v3.status, v3.message ], [ 'nodrawing', 'Link a scene to this viewport to place its point cloud.' ]);
    v3 = await verdict3d({ PointCloud__SceneId : 'pcs_7d342e28' }, syncedScene);
    check('an elevation scene on a 3D viewport: refused, saying what it lays on', [ v3.status, v3.message ],
        [ 'misaligned', 'A plan, elevation or section scene lays on a 2D viewport, not on a 3D one.' ]);
    v3 = await verdict3d({ PointCloud__SceneId : 'pcs_fb6ee416', PointCloud__Hidden : true }, syncedScene);
    check('hidden on a 3D viewport: attached, not drawn, nothing to complain about', [ v3.status, v3.message ], [ 'hidden', '' ]);

    // THE FRAME LAYER, on a small stand-in for the DOM
    class FakeEl {
        constructor (tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.style = {}; this.hidden = false; this.textContent = ''; this.className = ''; this.isConnected = true; }
        appendChild (child) { if (child.parentNode) child.parentNode.removeChild(child); child.parentNode = this; this.children.push(child); return child; }
        insertBefore (child, ref) { if (child.parentNode) child.parentNode.removeChild(child); child.parentNode = this; const at = ref ? this.children.indexOf(ref) : -1; if (at < 0) this.children.push(child); else this.children.splice(at, 0, child); return child; }
        removeChild (child) { const at = this.children.indexOf(child); if (at >= 0) this.children.splice(at, 1); child.parentNode = null; return child; }
        get nextSibling () { if (!this.parentNode) return null; const all = this.parentNode.children; return all[all.indexOf(this) + 1] || null; }
        addEventListener () {}
    }
    globalThis.document = { createElement : (tag) => new FakeEl(tag) };
    const body3d = new FakeEl('div');
    const snapshot = body3d.appendChild(new FakeEl('img'));
    const state3d = { body : body3d, img : snapshot };
    const vp3 = view3d({ PointCloud__SceneId : 'pcs_fb6ee416' });
    Layer.Na__LeVp2d__PointCloudFill3d(state3d, vp3, syncedScene, picture3d, 4);
    await settle();
    Layer.Na__LeVp2d__PointCloudFill3d(state3d, vp3, syncedScene, picture3d, 4);
    const layer3d = state3d.pc && state3d.pc.layer;
    const tile3d  = layer3d && layer3d.children[0];
    check('Fill3d lays the layer over the picture, at the opacity, the badge last and quiet',
        [ body3d.children.indexOf(snapshot) < body3d.children.indexOf(layer3d), layer3d.style.opacity, body3d.children[body3d.children.length - 1] === state3d.pc.note, state3d.pc.note.hidden ],
        [ true, '0.65', true, true ]);
    const pic3d = streetRev.Image.Preview;                                        // <-- 4 px a mm across 320 mm wants 1088 px: the preview has them
    const k3d = (320 * 4 / streetRev.Image.WidthPx) * pic3d.Factor;
    check('its picture is placed by its own pixels: 320 mm at 4 px a mm across the export\'s width, from the frame\'s corner',
        tile3d ? [ tile3d.style.transform, tile3d.style.width ] : null, [ 'matrix(' + [ k3d, 0, 0, (180 * 4 / streetRev.Image.HeightPx) * pic3d.Factor, 0, 0 ].join(',') + ')', pic3d.WidthPx + 'px' ]);
    Layer.Na__LeVp2d__PointCloudSetWorkingVisible('pcs_fb6ee416', false, [ 'pcs_fb6ee416' ]);
    await settle();
    check('switched off on screen while working: the 3D layer goes too', [ !!state3d.pc, body3d.children.length ], [ false, 1 ]);
    Layer.Na__LeVp2d__PointCloudSetAllWorkingVisible(true);
    await settle();
    check('and comes back when switched on, without the viewport being asked again (the refresh reaches 3D frames)',
        [ !!state3d.pc, !!state3d.pc && state3d.pc.layer.parentNode === body3d ], [ true, true ]);
    Layer.Na__LeVp2d__PointCloudDrop3d(state3d);
    Layer.Na__LeVp2d__PointCloudSetAllWorkingVisible(true);
    await settle();
    check('a frame let go is forgotten: nothing redraws into it', [ !!state3d.pc, body3d.children.length ], [ false, 1 ]);
    delete globalThis.document;

// endregion -------------------------------------------------------------------


    console.log('\n' + passes + ' passed, ' + failures + ' failed');
    process.exit(failures ? 1 : 0);
