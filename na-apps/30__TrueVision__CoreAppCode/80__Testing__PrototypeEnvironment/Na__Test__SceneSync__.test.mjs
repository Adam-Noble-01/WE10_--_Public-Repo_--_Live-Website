// =============================================================================
// TRUEVISION3D - TEST - SCENE SYNC
// =============================================================================
//
// FILE       : Na__Test__SceneSync__.test.mjs
// PURPOSE    : Prove the SketchUp scenes TrueVision Sync keeps in step become
//              correct TrueVision drawings and scenes, are found by the app,
//              and never reach a saved document
// CREATED    : 19-Oct-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__SceneSync__.test.mjs
//
// HOW IT WORKS:
// - The Hide Swings test's loader: each SHIPPED module is read, its imports are
//   removed and replaced with this test's stubs (or the real modules this test
//   loaded first), and the rest runs byte for byte as it ships.
// - The fixture, Na__Test__SceneSync__Fixture__, is the manifest a real sync
//   wrote: the GLB Builder 2.12.0 Scene Sync modules, run in SketchUp's own
//   Ruby against API doubles (scratch project ZZ98, 19-Oct-2026). It holds a
//   plan cut by a section plane, a tilted plan with no cut, a section, an
//   elevation deleted in SketchUp, the same page detached and synced again,
//   two perspective views (one switched off), an axonometric, and another
//   model's row with no camera. fetch is stubbed: nothing touches a network.
//
// WHAT IT GUARDS:
// - THE GEOMETRY, AGAINST TRUEVISION'S OWN FUNCTIONS. A synced elevation's
//   plane distance and the run of its frame centre, worked out in Ruby, are
//   what Na__ElevData__GetPlaneDistanceMm and WorldToRunMm give for the record
//   built here; a synced plan's cut is what Na__FpData__GetCutHeightMm gives.
// - THE CAMERA. TrueVision's scene format (integer mm, Euler XYZ, vertical
//   fov) looks along SketchUp's view line from SketchUp's eye, upright, with
//   the orbit target inside the orbit's reach; a parallel view keeps its
//   framing height.
// - NEVER SAVED. A drawings save, the R2 write and the local copy all go out
//   without a synced record, and never edit what the app holds. A detached
//   one goes out, as TrueVision's own.
// - THE VIEWER IS UNCHANGED. Synced scenes are layout editor only: not in the
//   carousel's scenes, never the opening scene.
// - THE CAROUSEL SHOWS AT LOAD (1.0.1, JW02). The placeholder block made for a
//   project with synced scenes and no presentation scenes is switched off;
//   the first authored scene must turn it into an ordinary, enabled block, and
//   a block already saved switched off is switched back on at load.
// - THE TITLES ARE WRITTEN FROM THE FACTS (1.0.2, JW02). A synced elevation's
//   drawing title is the compass word from its bearing against the project's
//   north, never the SketchUp scene name. Proved on JW02's own manifest
//   (Na__Test__SceneSync__Fixture__/...Manifest__JW02__.json, the sync of
//   19-Oct-2026 16:25) and its north, 187.8 degrees, through the real
//   viewport identity, title text, compass and Drawing Title modules.
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
    const FIXTURE    = resolve(SCRIPT_DIR, 'Na__Test__SceneSync__Fixture__');
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
        const key = '__SceneSyncStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const body = src.replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(resolve(SRC, relative)).href));
        const tmp = join(tmpdir(), 'Na__Test__SceneSync__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + body, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks and the Browser Stubs
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

    const events = [];
    let onDispatch = null;
    globalThis.window = {
        location : { origin : 'http://127.0.0.1:8523' },
        dispatchEvent (event) { events.push(event.type + ':' + ((event.detail && event.detail.reason) || '')); if (onDispatch) onDispatch(event); },
        addEventListener () {}
    };
    globalThis.CustomEvent = class { constructor (type, init) { this.type = type; Object.assign(this, init); } };
    const settle = () => new Promise((done) => setTimeout(done, 0));

    const RAW = JSON.parse(readFileSync(join(FIXTURE, 'TrueVision__SceneSyncData__Manifest__.json'), 'utf8'));
    const rowNamed = (name, state) => RAW.SceneSyncData__Scenes.find((row) => row.Scene__Name === name && (!state || row.Scene__State === state));
    const PLANS = 'LayoutEditor__DrawingsData__FloorPlans', ELEVS = 'LayoutEditor__DrawingsData__Elevations', SCENES = 'PresentationMode__SavedCameraScenes__Scenes';
    const clone = (value) => JSON.parse(JSON.stringify(value));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Manifest
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - Scene Sync\n\n  Reading the manifest');
    const Rec = await load('23__System__SceneSync/Na__SceneSync__Records__.js', {});
    const manifest = Rec.Na__SceneSync__ReadManifest(RAW);
    check('the manifest a real sync wrote reads (schema 1, GLB Builder 2.12.0)', [ manifest !== null, manifest && manifest.exporterVersion ], [ true, '2.12.0' ]);
    check('every row with a camera is read; another model\'s row with none is left out', [ RAW.SceneSyncData__Scenes.length, manifest.rows.length ], [ 9, 8 ]);
    check('a newer schema is not read rather than misread', Rec.Na__SceneSync__ReadManifest(Object.assign({}, RAW, { SceneSyncData__SchemaVersion : 2 })), null);
    check('a file that is not a Scene Sync manifest is not read', Rec.Na__SceneSync__ReadManifest({ PointCloudData__Schema : 'x' }), null);
    const doubled = clone(RAW);
    doubled.SceneSyncData__Scenes.push(Object.assign(clone(rowNamed('Garden View')), { Scene__Name : 'Impostor' }));
    doubled.SceneSyncData__Scenes.push(Object.assign(clone(rowNamed('Garden View')), { Scene__Id : 'Scene_001' }));
    const read2 = Rec.Na__SceneSync__ReadManifest(doubled);
    check('the first row of an id wins, and an id not of the GLB Builder\'s shape is left out',
        [ read2.rows.length, read2.rows.filter((row) => row.Scene__Name === 'Impostor').length ], [ 8, 0 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Records Built
// -----------------------------------------------------------------------------

    console.log('\n  The records built');
    const OPTIONS = { orbitMinMm : 200, orbitMaxMm : 45000, defaultExcludeTokens : [ 'Planting', 'Trees' ] };
    const built = Rec.Na__SceneSync__Build(manifest, OPTIONS);
    check('two plans, three elevations and sections, eight scenes, eight entries',
        [ built.plans.length, built.elevations.length, built.scenes.length, built.entries.length ], [ 2, 3, 8, 8 ]);
    const plan    = built.plans.find((p) => p.FloorPlan__Name === 'Ground Floor Plan');
    const planRow = rowNamed('Ground Floor Plan');
    check('a plan\'s drawing, its scene and the manifest row share ONE id, linked both ways',
        [ plan.FloorPlan__Id, plan.FloorPlan__SceneId, built.scenes.find((s) => s.PresentationMode__Scene__FloorPlanId === plan.FloorPlan__Id).PresentationMode__Scene__Id ],
        [ planRow.Scene__Id, planRow.Scene__Id, planRow.Scene__Id ]);
    check('it is marked synced, never saved', [ Rec.Na__SceneSync__IsSynced(plan), plan.Sync__Source, plan.Sync__State ], [ true, 'sketchup', 'synced' ]);
    check('the plan hides what the SketchUp scene hides, EXACTLY, after the default exclusions',
        plan.FloorPlan__ExcludeCategoryTokens, [ 'Planting', 'Trees', '=TrueVision__SiteBoundaries' ]);
    check('it names its point cloud scene and where SketchUp\'s camera looks', [ plan.Sync__PointCloudSceneId, plan.Sync__FrameCentreMm ], [ 'pcs_plan0001', { X : 2540, Y : -5080 } ]);

    // TrueVision's OWN floor plan functions read the record
    const Fp = await load('42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js', {
        Na__DrawData__GetFloorPlansArray : () => built.plans.map(clone),
        Na__FpCfg__GetCutOffsetMm        : () => ({ defaultMm : 1200, minMm : 100, maxMm : 3000 }),
        Na__FpCfg__GetDatumRangeMm       : () => ({ defaultMm : 0 })
    });
    check('TrueVision reads both synced plans as valid floor plans', Fp.Na__FpData__GetFloorPlans(null).map((p) => p.FloorPlan__Name).sort(), [ 'Ground Floor Plan', 'Tilted Plan' ]);
    near('the plan cuts where the SketchUp section plane does (Na__FpData__GetCutHeightMm)', Fp.Na__FpData__GetCutHeightMm(plan), planRow.Drawing.CutHeightMm, 1e-6);
    const tilted = built.plans.find((p) => p.FloorPlan__Name === 'Tilted Plan');
    near('a plan with no horizontal section plane cuts above everything (100 m, above SketchUp\'s eye)', Fp.Na__FpData__GetCutHeightMm(tilted), 100000, 1e-6);
    check('and carries SketchUp\'s warning', built.entries.find((e) => e.name === 'Tilted Plan').warnings.some((w) => w.indexOf('should look straight down') >= 0), true);

    // TrueVision's OWN elevation functions read the record
    const Ev = await load('45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js', {
        Na__ElevCfg__GetPlaneOriginRangeMm : () => ({ defaultXMm : 0, defaultZMm : 0, minMm : -1e9, maxMm : 1e9 }),
        Na__DrawData__GetElevationsArray   : () => built.elevations.map(clone)
    });
    const sectionRow = rowNamed('Side Section', 'synced');
    const section    = built.elevations.find((e) => e.Elevation__Id === sectionRow.Scene__Id);
    check('a SketchUp section is a TrueVision section, on the same bearing', [ section.Elevation__Mode, section.Elevation__AzimuthDeg, Ev.Na__ElevData__IsSection(section) ], [ 'section', 270, true ]);
    near('its cut sits where SketchUp\'s section plane does (Na__ElevData__GetPlaneDistanceMm)', Ev.Na__ElevData__GetPlaneDistanceMm(section), sectionRow.Drawing.PlaneDistanceMm, 1e-6);
    const targetMm = sectionRow.Camera.ThreeJs.Target.map((v) => v * 1000);
    near('SketchUp\'s camera target lands on the frame centre\'s run (Na__ElevData__WorldToRunMm)', Ev.Na__ElevData__WorldToRunMm(section, targetMm[0], targetMm[2]), sectionRow.Drawing.FrameCentreMm.X, 1e-3);
    const front = built.elevations.find((e) => e.Elevation__Name === 'Front Elevation');
    check('an elevation deleted in SketchUp is kept, marked missing, its hidden layers exact',
        [ front.Elevation__Mode, front.Elevation__AzimuthDeg, front.Sync__State, front.Elevation__ExcludeCategoryTokens.filter((t) => t.charAt(0) === '=') ],
        [ 'elevation', 180, 'missing', [ '=TrueVision__LandscapeEnvironment', '=TrueVision__MainBuildingModel__Existing', '=TrueVision__SiteBoundaries' ] ]);
    check('the page detached in SketchUp and synced again: both are here, each its own id',
        built.elevations.filter((e) => e.Elevation__Name === 'Side Section').map((e) => e.Sync__State).sort(), [ 'detached', 'synced' ]);
    check('TrueVision reads all three as valid elevations', Ev.Na__ElevData__GetElevations(null).length, 3);
    check('SketchUp\'s name is no title: a synced elevation carries no Elevation__NameIsAuto (1.0.2)',
        built.elevations.every((e) => !Object.prototype.hasOwnProperty.call(e, 'Elevation__NameIsAuto')), true);

    // Scenes
    check('every synced scene is for the Layout Editor only, in no real group',
        built.scenes.every((s) => s.PresentationMode__Scene__LayoutEditorOnly === true && s.PresentationMode__Scene__GroupId === 'Sync__SketchUpScenes'), true);
    check('a 3D view links no drawing', built.scenes.filter((s) => !s.PresentationMode__Scene__FloorPlanId && !s.PresentationMode__Scene__ElevationId).map((s) => s.PresentationMode__Scene__Name).sort(),
        [ 'Axo', 'Garden View', 'Wide View' ]);
    check('a scene hides, in the 3D view, the categories the SketchUp scene hides',
        built.scenes.find((s) => s.PresentationMode__Scene__Name === 'Garden View').PresentationMode__Scene__Visibility,
        { PresentationMode__Scene__Visibility__Categories : { TrueVision__LandscapeEnvironment : false } });
    check('the same manifest builds byte for byte the same records (the 3D viewport fingerprint relies on it)',
        JSON.stringify(Rec.Na__SceneSync__Build(Rec.Na__SceneSync__ReadManifest(clone(RAW)), OPTIONS)) === JSON.stringify(built), true);
    const odd = Rec.Na__SceneSync__Build(manifest, { orbitMaxMm : Infinity, orbitMinMm : undefined, parallelFovDeg : NaN });
    const finiteCamera = (scene) => {
        const c = scene.PresentationMode__Scene__CameraPosition, o = scene.PresentationMode__Scene__OrbitHelperCubePosition;
        return Object.values(c.Camera__DefaultPos).concat(Object.values(c.Camera__DefaultRotation), [ c.Camera__DefaultMisc.Camera__DefaultMisc__Fov,
            o.OrbitHelperCube__Position__PosX, o.OrbitHelperCube__Position__PosY, o.OrbitHelperCube__Position__PosZ ]).every(Number.isFinite);
    };
    check('an orbit with no maximum, or an option left out, falls back to the defaults (every camera number finite)',
        [ odd.scenes.length, odd.scenes.every(finiteCamera), JSON.stringify(odd.scenes) === JSON.stringify(built.scenes) ], [ 8, true, true ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Titles: Written From the Facts, Never the Scene Name (JW02)
// -----------------------------------------------------------------------------

    console.log('\n  Drawing titles (JW02)');

    // JW02's OWN SYNC and its north (TrueVision__ProjectData__.json,
    // LayoutEditor__DrawingsData__North, set 19-Oct-2026), and the four
    // elevation viewports of its D01 Existing Conditions | Elevations, unnamed
    // as they are on the sheet.
    const JW02       = JSON.parse(readFileSync(join(FIXTURE, 'TrueVision__SceneSyncData__Manifest__JW02__.json'), 'utf8'));
    const jwBuilt    = Rec.Na__SceneSync__Build(Rec.Na__SceneSync__ReadManifest(JW02), OPTIONS);
    const NORTH      = { North__BearingDeg : 187.8, North__OriginMm : { PosX : 35721, PosY : -1026, PosZ : -6626 }, North__SetIso : '2026-10-19T13:13:36.963Z' };
    const JW_GROUP   = { groupId : 'DesignPhase01__ConceptDesign__Scheme-01', label : 'Concept Design - Scheme-01' };   // <-- JW02's only model group
    const JW_SHEET   = { North : 'sus_7e30d233', East : 'sus_8f65c52a', South : 'sus_cf090d06', West : 'sus_33262186' };   // <-- Elevation__North__Front, __East__Left, __South__Rear, __West__Right
    const jwViewport = (drawingId, name) => ({ Viewport__Id : 'Viewport_' + drawingId, Viewport__Kind : '2d', Viewport__SceneId : drawingId, Viewport__DrawingId : drawingId, Viewport__ModelSourceId : null, Viewport__Name : name || '' });
    const jwElev     = (drawingId) => jwBuilt.elevations.find((e) => e.Elevation__Id === drawingId);

    // The real north: the compass maths, the project data module over a
    // drawings block holding JW02's north (or none), and the shipped config's
    // compass words.
    const northCfg = JSON.parse(readFileSync(resolve(SRC, '46__System__NorthDirection', 'Na__North__AppConfig__.json'), 'utf8')).NorthDirection__Compass__Config;
    const Compass  = await load('46__System__NorthDirection/Na__North__Compass__.js', {});
    const drawings = { LayoutEditor__DrawingsData__North : NORTH };
    const North    = await load('46__System__NorthDirection/Na__North__ProjectJson__Data__.js', Object.assign({}, Compass, {
        Na__DrawData__GetBlock        : () => drawings,
        Na__NorthCfg__GetCompassSetup : () => ({ halfWidthDeg : northCfg.NorthDirection__Compass__IntercardinalHalfWidthDeg, decimals : northCfg.NorthDirection__Compass__BearingDecimals, words : northCfg.NorthDirection__Compass__Words })
    }));

    // The real viewport identity and title text. A viewport resolves to its
    // drawing by id, as the sheet model resolves it, over whichever elevations
    // a check puts in elevs; its Model Source is JW02's one group.
    const Text  = await load('51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__ViewportTitleText__.js', {});
    let   elevs = jwBuilt.elevations;
    const Ident = await load('51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js', Object.assign({}, Text, {
        Na__LeModel__KIND_3D                : '3d',
        Na__LeModel__IsSitePlanViewport     : () => false,
        Na__LeModel__ResolveViewportSource  : (viewport) => ({ plan : null, elevation : elevs.find((e) => e.Elevation__Id === viewport.Viewport__DrawingId) || null, scene : null }),
        Na__LeModel__RegisterViewportNamer  : () => {},
        Na__LeCfg__GetLabel                 : (key, fallback) => fallback,
        Na__LeSource__Resolve               : () => JW_GROUP,
        Na__LeClip__IsCopyName              : () => false,
        Na__ElevData__IsSection             : Ev.Na__ElevData__IsSection,
        Na__FpData__GetStoreyLevel          : () => null,
        Na__NorthCfg__Load                  : async () => null,
        Na__NorthData__IsSet                : North.Na__NorthData__IsSet,
        Na__NorthData__FacingWordForAzimuth : North.Na__NorthData__FacingWordForAzimuth
    }));
    const titled = (viewport, phaseMode) => Ident.Na__LeViewId__TitleFor(viewport, { phaseMode : phaseMode || 'existing', uppercase : true }).text;

    check('JW02\'s four synced elevations, read against its north (187.8), face North, East, South and West',
        Object.keys(JW_SHEET).map((word) => North.Na__NorthData__FacingWordForAzimuth(jwElev(JW_SHEET[word]).Elevation__AzimuthDeg)), [ 'North', 'East', 'South', 'West' ]);
    check('their titles are written from the facts, Existing chosen: EXISTING NORTH ELEVATION and the rest, never the scene name',
        Object.keys(JW_SHEET).map((word) => titled(jwViewport(JW_SHEET[word]))),
        [ 'EXISTING NORTH ELEVATION', 'EXISTING EAST ELEVATION', 'EXISTING SOUTH ELEVATION', 'EXISTING WEST ELEVATION' ]);
    check('on Auto the word is the model\'s: JW02\'s only model group is a scheme (Concept Design - Scheme-01), so Proposed',
        titled(jwViewport(JW_SHEET.North), 'auto'), 'PROPOSED NORTH ELEVATION');
    check('the scene name is still the drawing\'s own name, for the panels', Ident.Na__LeViewId__Describe(jwViewport(JW_SHEET.North)).drawing, 'Elevation__North__Front');
    check('an unnamed viewport is named the same way in the panels and its frame caption',
        Ident.Na__LeViewId__NameFor(jwViewport(JW_SHEET.North), { elevation : jwElev(JW_SHEET.North) }), 'Proposed North Elevation');

    // Through the Drawing Title element itself, given the facts the link
    // module lays into its parameters (Na__LeParamLink__FactsOf).
    const Bar        = await load('51__System__LayoutEditor/57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js', {});
    const Title      = await load('51__System__LayoutEditor/57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js', Object.assign({}, Bar, Text));
    const parametric = JSON.parse(readFileSync(resolve(SRC, '51__System__LayoutEditor', '57__Feature__ScrapbookParametric', 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const titleType  = Title.Na__LeParamTitle__CreateType(() => parametric.LayoutEditor__ScrapbookParametric__DrawingTitle, () => parametric.LayoutEditor__ScrapbookParametric__ScaleBar, () => Ident.Na__LeViewId__Words());
    const factsOf    = (viewport) => { const f = Ident.Na__LeViewId__Describe(viewport); return { ViewKind : f.kind, ViewPhase : f.phase, ViewFacing : f.facing, ViewLevel : f.level || '', ViewName : f.name, ViewDrawing : f.drawing }; };
    check('the Drawing Title element under D01\'s north elevation letters EXISTING NORTH ELEVATION',
        titleType.titleText(Object.assign({ ScaleDenominator : 100, PhaseMode : 'existing' }, factsOf(jwViewport(JW_SHEET.North)))).text, 'EXISTING NORTH ELEVATION');

    // What put the scene name there, and what must still win over the compass
    elevs = jwBuilt.elevations.map((e) => Object.assign(clone(e), { Elevation__NameIsAuto : false }));   // <-- As 1.0.1 built them
    check('the cause: built as 1.0.1 built it (Elevation__NameIsAuto false), the same title read EXISTING ELEVATION__NORTH__FRONT',
        titled(jwViewport(JW_SHEET.North)), 'EXISTING ELEVATION__NORTH__FRONT');
    elevs = jwBuilt.elevations.concat([ { Elevation__Id : 'Elevation_001', Elevation__Name : 'Coach House North Elevation', Elevation__NameIsAuto : false, Elevation__AzimuthDeg : 180, Elevation__Mode : 'elevation' } ]);
    check('a name typed in Dev Tools for TrueVision\'s own elevation still titles it', titled(jwViewport('Elevation_001')), 'EXISTING COACH HOUSE NORTH ELEVATION');
    check('a name typed on the viewport still titles it', titled(jwViewport(JW_SHEET.North, 'Front Elevation')), 'EXISTING FRONT ELEVATION');
    elevs = [ Rec.Na__SceneSync__DetachedCopy(jwElev(JW_SHEET.North), '2026-10-19T17:00:00.000Z') ];
    check('detached in TrueVision, it is titled the same way until a name is typed for it', titled(jwViewport(JW_SHEET.North)), 'EXISTING NORTH ELEVATION');
    elevs = jwBuilt.elevations;
    delete drawings.LayoutEditor__DrawingsData__North;
    check('with north not set the title waits for it, and still never prints the scene name', titled(jwViewport(JW_SHEET.North)), 'EXISTING {{DIRECTION}} ELEVATION');
    drawings.LayoutEditor__DrawingsData__North = NORTH;

    // The auto namer renames only what it is told is automatic
    const AutoText = await load('45__System__ElevationViews/Na__Elevation__AutoNameText__.js', {});
    const AutoName = await load('45__System__ElevationViews/Na__Elevation__AutoName__.js', Object.assign({}, AutoText, {
        Na__NorthData__FacingWordForAzimuth  : North.Na__NorthData__FacingWordForAzimuth,
        Na__NorthData__TrueBearingForAzimuth : North.Na__NorthData__TrueBearingForAzimuth,
        Na__ElevData__GetElevations          : () => jwBuilt.elevations,
        Na__ElevData__IsSection              : Ev.Na__ElevData__IsSection,
        Na__ElevCfg__GetLabel                : (key, fallback) => fallback
    }));
    const sketchUpNamed = clone(jwElev(JW_SHEET.North));
    check('and the auto namer still leaves SketchUp\'s name alone: nothing to sync, nothing to adopt',
        [ AutoName.Na__ElevName__Sync(sketchUpNamed), AutoName.Na__ElevName__Adopt(sketchUpNamed), sketchUpNamed.Elevation__Name, 'Elevation__NameIsAuto' in sketchUpNamed ],
        [ false, false, 'Elevation__North__Front', false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Camera
// -----------------------------------------------------------------------------

    console.log('\n  The camera');
    // Euler XYZ (three.js order: R = Rx Ry Rz) applied to a vector
    function rotate(e, v) {
        const [ x, y, z ] = e;
        let [ a, b, c ] = v;
        [ a, b ] = [ a * Math.cos(z) - b * Math.sin(z), a * Math.sin(z) + b * Math.cos(z) ];
        [ a, c ] = [ a * Math.cos(y) + c * Math.sin(y), -a * Math.sin(y) + c * Math.cos(y) ];
        [ b, c ] = [ b * Math.cos(x) - c * Math.sin(x), b * Math.sin(x) + c * Math.cos(x) ];
        return [ a, b, c ];
    }
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return v.map((n) => n / l); };
    const cam  = (scene) => {
        const c = scene.PresentationMode__Scene__CameraPosition, o = scene.PresentationMode__Scene__OrbitHelperCubePosition;
        return {
            eye   : [ c.Camera__DefaultPos.Camera__DefaultPos__PosX, c.Camera__DefaultPos.Camera__DefaultPos__PosY, c.Camera__DefaultPos.Camera__DefaultPos__PosZ ],
            euler : [ c.Camera__DefaultRotation.Camera__DefaultRotation__RotX, c.Camera__DefaultRotation.Camera__DefaultRotation__RotY, c.Camera__DefaultRotation.Camera__DefaultRotation__RotZ ],
            fov   : c.Camera__DefaultMisc.Camera__DefaultMisc__Fov,
            orbit : [ o.OrbitHelperCube__Position__PosX, o.OrbitHelperCube__Position__PosY, o.OrbitHelperCube__Position__PosZ ]
        };
    };
    const garden    = cam(built.scenes.find((s) => s.PresentationMode__Scene__Name === 'Garden View'));
    const gardenRow = rowNamed('Garden View');
    check('a perspective view keeps SketchUp\'s eye (integer mm, Y up) and vertical fov',
        [ garden.eye, garden.fov ], [ gardenRow.Camera.ThreeJs.Position.map((v) => Math.round(v * 1000)), 35 ]);
    const gardenDir = norm(gardenRow.Camera.ThreeJs.Target.map((v, i) => v - gardenRow.Camera.ThreeJs.Position[i]));
    const looks = rotate(garden.euler, [ 0, 0, -1 ]);
    near('the stored rotation looks along SketchUp\'s view line (angle off, degrees)', Math.acos(Math.min(1, looks[0] * gardenDir[0] + looks[1] * gardenDir[1] + looks[2] * gardenDir[2])) * 180 / Math.PI, 0, 0.02);
    check('and stands upright', rotate(garden.euler, [ 0, 1, 0 ])[1] > 0, true);
    const pivot = norm(garden.orbit.map((v, i) => v - garden.eye[i]));
    near('the orbit target is on the view line (so the orbit re-aims nothing)', Math.acos(Math.min(1, pivot[0] * gardenDir[0] + pivot[1] * gardenDir[1] + pivot[2] * gardenDir[2])) * 180 / Math.PI, 0, 0.01);
    const reach = Math.hypot(...garden.orbit.map((v, i) => v - garden.eye[i]));
    check('and within the orbit\'s reach (200 mm to 45 m)', reach >= 200 && reach <= 45000, true);

    const axo    = cam(built.scenes.find((s) => s.PresentationMode__Scene__Name === 'Axo'));
    const axoRow = rowNamed('Axo');
    const axoD   = Math.hypot(...axo.orbit.map((v, i) => v - axo.eye[i]));
    near('a parallel view keeps its framing: the height seen at SketchUp\'s target is SketchUp\'s height (mm)',
        2 * axoD * Math.tan(axo.fov * Math.PI / 360), axoRow.Camera.ThreeJs.OrthoHeightM * 1000, axoRow.Camera.ThreeJs.OrthoHeightM * 1000 * 0.001);
    const axoDir  = norm(axoRow.Camera.ThreeJs.Target.map((v, i) => v - axoRow.Camera.ThreeJs.Position[i]));
    const axoView = rotate(axo.euler, [ 0, 0, -1 ]);
    near('looking along SketchUp\'s direction (degrees)', Math.acos(Math.min(1, axoView[0] * axoDir[0] + axoView[1] * axoDir[1] + axoView[2] * axoDir[2])) * 180 / Math.PI, 0, 0.02);
    check('and it says it is drawn in perspective', built.entries.find((e) => e.name === 'Axo').warnings.some((w) => w.indexOf('in perspective') >= 0), true);
    const down = Rec.Na__SceneSync__LookAtEuler([ 0, 5000, 0 ], [ 0, 0, 0 ]);
    near('straight down (a plan scene) is the nudge three.js itself makes: rotation X near -90 degrees', down[0] * 180 / Math.PI, -90, 0.01);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Never Saved
// -----------------------------------------------------------------------------

    console.log('\n  Never saved');
    const realPlan  = { FloorPlan__Id : 'FloorPlan_001', FloorPlan__Name : 'GF', FloorPlan__FloorDatumMm : 0 };
    const realScene = { PresentationMode__Scene__Id : 'Scene_001', PresentationMode__Scene__Name : 'Front', PresentationMode__Scene__CameraPosition : { Camera__DefaultPos : { Camera__DefaultPos__PosX : 0, Camera__DefaultPos__PosY : 0, Camera__DefaultPos__PosZ : 0 } } };
    const doc = {
        projectCode : 'ZZ98',
        LayoutEditor__DrawingsData : { [PLANS] : [ realPlan ].concat(built.plans), [ELEVS] : built.elevations.slice(), LayoutEditor__DrawingsData__Sheets : [] },
        PresentationMode__SavedCameraScenes : { [SCENES] : [ realScene ].concat(built.scenes), PresentationMode__SavedCameraScenes__DefaultSceneId : built.scenes[0].PresentationMode__Scene__Id }
    };
    const before = JSON.stringify(doc);
    const out = Rec.Na__SceneSync__StrippedCopy(doc);
    check('a stripped copy holds only the authored records', [ out.LayoutEditor__DrawingsData[PLANS].map((p) => p.FloorPlan__Id), out.LayoutEditor__DrawingsData[ELEVS].length, out.PresentationMode__SavedCameraScenes[SCENES].map((s) => s.PresentationMode__Scene__Id) ],
        [ [ 'FloorPlan_001' ], 0, [ 'Scene_001' ] ]);
    check('a default scene id naming a synced scene is dropped', 'PresentationMode__SavedCameraScenes__DefaultSceneId' in out.PresentationMode__SavedCameraScenes, false);
    check('and what the app holds is not touched', JSON.stringify(doc) === before, true);
    const container = { projectCode : 'ZZ98', PresentationMode__SavedCameraScenes : Object.assign(Rec.Na__SceneSync__ContainerConfig(), { [SCENES] : built.scenes.slice() }) };
    check('a presentation block made only to hold synced scenes is never written', 'PresentationMode__SavedCameraScenes' in Rec.Na__SceneSync__StrippedCopy(container), false);
    container.PresentationMode__SavedCameraScenes[SCENES].push(realScene);
    const kept = Rec.Na__SceneSync__StrippedCopy(container).PresentationMode__SavedCameraScenes;
    check('once it holds a real scene it is an ordinary block, written without the mark and SWITCHED ON (JW02)',
        [ kept[SCENES].length, 'Sync__Container' in kept, kept.PresentationMode__SavedCameraScenes__Enabled ], [ 1, false, true ]);
    const legacy = { PresentationMode__SavedCameraScenes : { PresentationMode__SavedCameraScenes__FloorPlans : [ realPlan, built.plans[0] ] } };
    check('the legacy drawing arrays are stripped too', Rec.Na__SceneSync__StrippedCopy(legacy).PresentationMode__SavedCameraScenes.PresentationMode__SavedCameraScenes__FloorPlans.length, 1);

    const list = [ realPlan ];
    const same = list;
    Rec.Na__SceneSync__ApplyToList(list, built.plans, 'FloorPlan__Id');
    const once = JSON.stringify(list);
    Rec.Na__SceneSync__ApplyToList(list, built.plans, 'FloorPlan__Id');
    check('putting synced records in a live array: in place, and the same however often', [ list === same, list.length, JSON.stringify(list) === once ], [ true, 3, true ]);
    const detached = Rec.Na__SceneSync__DetachedCopy(plan, '2026-10-19T15:00:00.000Z');
    const withReal = [ detached ];
    Rec.Na__SceneSync__ApplyToList(withReal, built.plans, 'FloorPlan__Id');
    check('a record detached in TrueVision wins over the synced one of its id', [ withReal.length, Rec.Na__SceneSync__IsSynced(withReal[0]), Rec.Na__SceneSync__IsDetached(withReal[0]) ], [ 2, false, true ]);
    check('a detached copy keeps its id and geometry, and drops the synced marks',
        [ detached.FloorPlan__Id === plan.FloorPlan__Id, detached.FloorPlan__FloorDatumMm === plan.FloorPlan__FloorDatumMm, 'Sync__Source' in detached, 'Sync__FrameCentreMm' in detached, detached.Sync__DetachedIso ],
        [ true, true, false, false, '2026-10-19T15:00:00.000Z' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | In the App: the Real Drawings, Scene and Save Modules
// -----------------------------------------------------------------------------

    console.log('\n  In the app');
    const saves = { cloud : [], local : [] };
    const SceneData = await load('21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js', {
        Na__PresentationMode__SceneGroups__SortScenesForPlayback : (scenes) => scenes.slice().sort((a, b) => (a.PresentationMode__Scene__Order || 0) - (b.PresentationMode__Scene__Order || 0))
    });
    const DrawData = await load('40__System__DrawingViewCore/Na__DrawView__ProjectData__.js', Object.assign({}, Rec, {
        Na__PresentationMode__ProjectJson__GetActiveConfig : SceneData.Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__AppUtils__GetProjectCodeFromUrl  : () => 'ZZ98',
        Na__AppUtils__IsRunningOnLocalhost   : () => false,
        Na__CfApi__IsConfigured              : () => true,
        Na__CfApi__MergeAndSaveKeys          : async (keys) => { saves.cloud.push(clone(keys)); return { ok : true }; },
        Na__LocalMirror__MergeKeys           : async (keys) => { saves.local.push(clone(keys)); return { ok : false, skipped : true, error : null }; },
        Na__LocalMirror__DrawingsFingerprint : async () => ({ ok : false, skipped : true })
    }));
    const DEFAULT_GROUPS = [ { PresentationMode__Group__Id : 'Group_001', PresentationMode__Group__Name : 'Exterior 3D Views', PresentationMode__Group__Order : 1, PresentationMode__Group__Enabled : true } ];
    const Live = await load('23__System__SceneSync/Na__SceneSync__Live__.js', Object.assign({}, Rec, DrawData, SceneData, {
        Na__PresentationMode__SceneGroups__GetDefaultGroups : () => clone(DEFAULT_GROUPS)
    }));
    check('the live module hooks in as it is imported, before any project arrives', events.length, 0);

    Live.Na__SsLive__Use(manifest, OPTIONS, { url : 'http://127.0.0.1:8523/x.json' });
    const block = { [PLANS] : [ realPlan ], [ELEVS] : [], LayoutEditor__DrawingsData__Sheets : [] };
    let seenAtLoad = null;
    onDispatch = (event) => { if (event.detail && event.detail.reason === 'loaded') seenAtLoad = DrawData.Na__DrawData__GetBlock()[PLANS].length; };
    DrawData.Na__DrawData__Load(block, 'ZZ98', null);
    onDispatch = null;
    check('the drawings block a project supplies gets the synced plans and elevations BEFORE the load is announced',
        [ seenAtLoad, block[PLANS].length, block[ELEVS].length ], [ 3, 3, 3 ]);

    const config = { PresentationMode__SavedCameraScenes__Enabled : true, [SCENES] : [ realScene ] };
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(config, 'ZZ98__SceneSyncTest', '26');
    check('the scene config adopted gets the synced scenes', config[SCENES].length, 9);
    check('the viewer\'s scenes are the authored ones alone: the carousel and its counts do not change',
        SceneData.Na__PresentationMode__ProjectJson__GetSortedScenes().map((s) => s.PresentationMode__Scene__Id), [ 'Scene_001' ]);
    check('a synced scene is never the opening view', SceneData.Na__PresentationMode__ProjectJson__GetDefaultScene(config).PresentationMode__Scene__Id, 'Scene_001');
    check('whether the project has viewer scenes is decided by the authored ones alone',
        [ SceneData.Na__PresentationMode__ProjectJson__HasValidSavedScenes({ PresentationMode__SavedCameraScenes : config }),
          SceneData.Na__PresentationMode__ProjectJson__HasValidSavedScenes({ PresentationMode__SavedCameraScenes : { PresentationMode__SavedCameraScenes__Enabled : true, [SCENES] : built.scenes } }) ], [ true, false ]);
    const committed = { PresentationMode__SavedCameraScenes__Enabled : true, [SCENES] : [ realScene ] };   // <-- What the Presentation Scenes editor commits: its own copy, no synced scenes
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(committed, 'ZZ98__SceneSyncTest', '26');
    check('a config the scenes editor commits gets them back', committed[SCENES].length, 9);
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(committed, 'ZZ98__SceneSyncTest', '26');
    check('and adopting it again changes nothing', committed[SCENES].length, 9);

    const saved = await DrawData.Na__DrawData__Save(() => {}, {});
    const cloud = saves.cloud[0], local = saves.local[0];
    check('a drawings save writes no synced record to R2', [ saved, cloud.LayoutEditor__DrawingsData[PLANS].map((p) => p.FloorPlan__Id), cloud.LayoutEditor__DrawingsData[ELEVS].length, cloud.PresentationMode__SavedCameraScenes[SCENES].map((s) => s.PresentationMode__Scene__Id) ],
        [ true, [ 'FloorPlan_001' ], 0, [ 'Scene_001' ] ]);
    check('nor to the local copy', [ local.LayoutEditor__DrawingsData[PLANS].length, local.PresentationMode__SavedCameraScenes[SCENES].length ], [ 1, 1 ]);
    check('and the app still holds them', [ DrawData.Na__DrawData__GetBlock()[PLANS].length, SceneData.Na__PresentationMode__ProjectJson__GetActiveConfig()[SCENES].length ], [ 3, 9 ]);

    const planId = planRow.Scene__Id;
    check('before Detach: listed as synced', [ Live.Na__SsLive__IsLiveSynced(planId), Live.Na__SsLive__Entry(planId).detachedHere ], [ true, false ]);
    const result = Live.Na__SsLive__Detach(planId);
    check('Detach in TrueVision answers the scene\'s name', [ result.ok, result.name ], [ true, 'Ground Floor Plan' ]);
    const livePlan = DrawData.Na__DrawData__GetBlock()[PLANS].find((p) => p.FloorPlan__Id === planId);
    check('its plan and scene are TrueVision\'s own now, same id, same place', [ Rec.Na__SceneSync__IsDetached(livePlan), Rec.Na__SceneSync__IsDetached(Live.Na__SsLive__SceneRecord(planId)),
        Live.Na__SsLive__IsLiveSynced(planId), Live.Na__SsLive__Entry(planId).detachedHere, Rec.Na__SceneSync__IsSyntheticId(planId) ], [ true, true, false, true, false ]);
    await DrawData.Na__DrawData__Save(() => {}, {});
    const after = saves.cloud[1];
    check('the next save writes the detached plan and its scene, and still no synced record',
        [ after.LayoutEditor__DrawingsData[PLANS].map((p) => p.FloorPlan__Id), after.PresentationMode__SavedCameraScenes[SCENES].map((s) => s.PresentationMode__Scene__Id) ],
        [ [ 'FloorPlan_001', planId ], [ 'Scene_001', planId ] ]);
    check('Detach again is refused, plainly', Live.Na__SsLive__Detach(planId).message, 'Already detached.');
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(committed, 'ZZ98__SceneSyncTest', '26');
    check('and a later adoption keeps the detached scene, never adding the synced one beside it',
        committed[SCENES].filter((s) => s.PresentationMode__Scene__Id === planId).map((s) => Rec.Na__SceneSync__IsDetached(s)), [ true ]);

    // JW02 (19-Oct-2026): synced scenes, no presentation scenes, then the first scene authored in the Dev menu
    const placeholder = Live.Na__SsLive__NewContainerConfig();
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(placeholder, 'JW02__JugglesJoint', '26');
    check('a project with synced scenes and no presentation scenes: the placeholder holds them, switched off, so the carousel ignores it',
        [ placeholder.Sync__Container, placeholder.PresentationMode__SavedCameraScenes__Enabled, SceneData.Na__PresentationMode__ProjectJson__HasValidSavedScenes({ PresentationMode__SavedCameraScenes : placeholder }) ],
        [ true, false, false ]);
    const authored = { PresentationMode__Scene__Id : 'Scene_001', PresentationMode__Scene__Name : '3D | North West', PresentationMode__Scene__GroupId : 'Group_001',
        PresentationMode__Scene__CameraPosition : { Camera__DefaultPos : { Camera__DefaultPos__PosX : 1, Camera__DefaultPos__PosY : 2, Camera__DefaultPos__PosZ : 3 } } };
    placeholder[SCENES] = [ authored ];                                                     // <-- What the Dev menu's Add Scene commits: its working copy, no synced scenes
    SceneData.Na__PresentationMode__ProjectJson__SetActiveConfig(placeholder, 'JW02__JugglesJoint', '26');
    check('the first authored scene makes it an ordinary block at once: no mark, switched on, the default groups, a default scene and the schema note',
        [ 'Sync__Container' in placeholder, placeholder.PresentationMode__SavedCameraScenes__Enabled, placeholder.PresentationMode__SavedCameraScenes__Groups.length,
          placeholder.PresentationMode__SavedCameraScenes__DefaultSceneId, typeof placeholder.PresentationMode__SavedCameraScenes__Description ],
        [ false, true, 1, 'Scene_001', 'string' ]);
    check('so the next load shows the carousel (and the synced scenes are back beside the authored one)',
        [ SceneData.Na__PresentationMode__ProjectJson__HasValidSavedScenes({ PresentationMode__SavedCameraScenes : placeholder }), placeholder[SCENES].length ], [ true, 9 ]);
    const savedOff = { PresentationMode__SavedCameraScenes : { PresentationMode__SavedCameraScenes__Enabled : false, [SCENES] : [ clone(authored) ] } };
    check('a block already saved switched off with authored scenes (JW02 today) is switched back on at load',
        [ Live.Na__SsLive__RepairPresentationBlock(savedOff), savedOff.PresentationMode__SavedCameraScenes.PresentationMode__SavedCameraScenes__Enabled ], [ true, true ]);
    check('a block that is on, or holds no viewer scene, is left as it is',
        [ Live.Na__SsLive__RepairPresentationBlock(savedOff),
          Live.Na__SsLive__RepairPresentationBlock({ PresentationMode__SavedCameraScenes : { PresentationMode__SavedCameraScenes__Enabled : false, [SCENES] : [ Object.assign(clone(authored), { PresentationMode__Scene__LayoutEditorOnly : true }) ] } }),
          Live.Na__SsLive__RepairPresentationBlock({ projectCode : 'XX00' }) ], [ false, false, false ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Two Writers Everything Passes Through
// -----------------------------------------------------------------------------

    console.log('\n  The R2 write and the local copy');
    const posts = [];
    globalThis.fetch = async (url, init) => {
        if (init && init.method === 'POST') { posts.push({ url : String(url), body : JSON.parse(init.body) }); return { ok : true, status : 200, json : async () => ({}) }; }
        return { ok : true, status : 200, json : async () => ({ projectCode : 'ZZ98', Existing__Key : 1 }) };   // <-- The local file on disk
    };
    const urlStubs = {
        Na__AppUtils__IsRunningOnLocalhost : () => true,
        Na__AppUtils__GetProjectFolderFromUrl : () => 'ZZ98__SceneSyncTest',
        Na__AppUtils__GetYearFromUrl : () => '26',
        Na__AppUtils__GetProjectCodeFromUrl : () => 'ZZ98'
    };
    const CfApi = await load('80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js', Object.assign({}, Rec, urlStubs));
    CfApi.Na__CfApi__Initialize('https://worker.invalid');
    const base = clone(doc);
    CfApi.Na__CfApi__SetLoadedProjectData(base);
    const baseBefore = JSON.stringify(base);
    await CfApi.Na__CfApi__MergeAndSaveKeys({ Navmode__OrbitMaxDistanceMm : 50000 });   // <-- A save of an unrelated key writes the whole document
    const written = posts[0].body.data;
    check('a save of any key writes the whole document to R2 without a synced record',
        [ written.Navmode__OrbitMaxDistanceMm, written.LayoutEditor__DrawingsData[PLANS].length, written.PresentationMode__SavedCameraScenes[SCENES].length ], [ 50000, 1, 1 ]);
    check('and the merge base the app loaded is not edited by it', JSON.stringify(base) === baseBefore, true);
    const Mirror = await load('03__AppUtils/Na__AppUtils__LocalProjectMirror__.js', Object.assign({}, Rec, urlStubs));
    await Mirror.Na__LocalMirror__MergeKeys({ LayoutEditor__DrawingsData : doc.LayoutEditor__DrawingsData, PresentationMode__SavedCameraScenes : doc.PresentationMode__SavedCameraScenes });
    const file = posts[1].body;
    check('the local copy merges the keys over the file on disk without a synced record',
        [ file.Existing__Key, file.LayoutEditor__DrawingsData[PLANS].length, file.PresentationMode__SavedCameraScenes[SCENES].length ], [ 1, 1, 1 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the File
// -----------------------------------------------------------------------------

    console.log('\n  Where the file is read from');
    const asked = [];
    const answer = (url) => {
        asked.push(String(url));
        if (String(url).indexOf('cdn.noble-architecture.com') >= 0) return { ok : true, status : 200, json : async () => clone(RAW) };
        return { ok : false, status : 404, json : async () => null };
    };
    globalThis.fetch = async (url, init) => { if (!init || init.cache !== 'no-store') asked.push('CACHED ' + url); return answer(url); };
    const registered = { SceneSync__DataStore : { SceneSync__ManifestUrl : 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/ZZ98__SceneSyncTest/30__TrueVision__AppContent/SceneSync__SketchUpSceneData/TrueVision__SceneSyncData__Manifest__.json' } };
    const Store = await load('23__System__SceneSync/Na__SceneSync__Store__.js', Object.assign({}, Rec, urlStubs));
    const got = await Store.Na__SsStore__Load(registered);
    check('on the authoring machine: the repository copy first, then the CDN, each asked of the network',
        asked.map((u) => u.replace('http://127.0.0.1:8523', 'LOCAL').replace('https://cdn.noble-architecture.com', 'CDN').split('/30__TrueVision__AppContent/')[0]),
        [ 'LOCAL/na-project-portal/26-Projects/ZZ98__SceneSyncTest', 'CDN/NaProjectPortal/26-Projects/ZZ98__SceneSyncTest' ]);
    check('and the manifest it answered is read', [ got && got.rows.length, Store.Na__SsStore__GetStatus() ], [ 8, 'ready' ]);
    asked.length = 0;
    const Web = await load('23__System__SceneSync/Na__SceneSync__Store__.js', Object.assign({}, Rec, urlStubs, { Na__AppUtils__IsRunningOnLocalhost : () => false }));
    await Web.Na__SsStore__Load({ projectCode : 'ZZ98' });
    check('anywhere else, a project the build registered no store for asks nothing at all', [ asked.length, Web.Na__SsStore__GetStatus() ], [ 0, 'none' ]);
    const Foreign = await load('23__System__SceneSync/Na__SceneSync__Store__.js', Object.assign({}, Rec, urlStubs, { Na__AppUtils__IsRunningOnLocalhost : () => false }));
    await Foreign.Na__SsStore__Load({ SceneSync__DataStore : { SceneSync__ManifestUrl : 'https://elsewhere.example/TrueVision__SceneSyncData__Manifest__.json' } });
    check('a registered URL that is not the practice\'s CDN is never fetched', [ asked.length, Foreign.Na__SsStore__GetStatus() ], [ 0, 'none' ]);
    const Slow = await load('23__System__SceneSync/Na__SceneSync__Store__.js', Object.assign({}, Rec, urlStubs));
    globalThis.fetch = () => new Promise(() => {});                                            // <-- Never answers
    Slow.Na__SsStore__Load(registered);
    const late = await Slow.Na__SsStore__Settle(20);
    check('a read that does not answer in time lets the project open without it, and says so', [ late, /Reload the page/.test(Slow.Na__SsStore__GetNote() || '') ], [ null, true ]);
    await settle();

// endregion -------------------------------------------------------------------


    console.log('\n' + passes + ' passed, ' + failures + ' failed');
    process.exit(failures ? 1 : 0);
