// =============================================================================
// TRUEVISION3D - TEST - PROJECT LIGHTING
// =============================================================================
//
// FILE       : Na__Test__ProjectLighting__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Project Lighting Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that a project's own lighting lays over the app default
//              and under every scene, that a drawing keeps the app default,
//              that the record object holds only what differs in a section
//              per light, and that a save sends one key to R2, or takes it out
// CREATED    : 12-Nov-2026
//
// DESCRIPTION:
// - Runs 06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js and
//   Na__Scene__ProjectLighting__.js exactly as the app runs them, against the
//   app config's own lighting blocks, in a temporary folder that keeps their
//   relative paths (a package.json marks the .js files as ES modules), as
//   Na__Test__PerSceneLighting__.test.mjs does.
// - THE R2 CLIENT IS A STAND-IN. Na__CloudflareIntegration__ApiClient__.js is
//   replaced in the copy by a module that records what MergeAndSaveKeys and
//   DeleteProjectKeys were asked to write and answers ok, so nothing here ever
//   reaches the Worker or R2.
// - The lights are the same stand-ins as the per-scene test's.
// - Three wiring facts outside the two modules are read from the source:
//   both approach poses carry PresentationMode__Scene__IsDrawingApproach, the
//   loading sequence lays the key over the local copy from R2 on localhost
//   (Na__DevSavedKeys) and reads it after the merge base is registered.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ProjectLighting__.test.mjs
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none (ValeVision 3D v2.98.0 proved the same modules with a
//                   scratch harness; this is that harness kept, for this app)
// - Ported on     : 12-Nov-2026 for TrueVision3D v2.184.0
// - Parity        : new
// - Divergences   : n/a
// - Back-port     : candidate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Nov-2026 - Version 1.0.1 (TrueVision3D v2.184.2)
// - The app default's shadows are off: the picture key names a project's
//   shadows only when they differ from the default, and Sun casts shadows set
//   against the default is proved to be written as the flag alone.
//
// 12-Nov-2026 - Version 1.0.0
// - Initial implementation, with Project Lighting (v2.184.0).
//
// =============================================================================

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test, Their Dependencies and the App Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const MODULES    = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-projlight-'));

    const COPIES = [
        '06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js',
        '06__Scene__LightingEffects/Na__Scene__ProjectLighting__.js',
        '04__MathUtils/Na__Math__Units.js',
        '05__RenderPipeline/Na__RenderLoop__Invalidation.js'
    ];
    COPIES.forEach((relative) => {
        mkdirSync(dirname(join(SCRATCH, relative)), { recursive : true });
        copyFileSync(join(MODULES, relative), join(SCRATCH, relative));
    });

    // THE R2 CLIENT STAND-IN | Records the writes, answers ok, reaches nothing
    const CFAPI = '80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    mkdirSync(dirname(join(SCRATCH, CFAPI)), { recursive : true });
    writeFileSync(join(SCRATCH, CFAPI), [
        'export const Na__Test__Writes = [];',
        'export async function Na__CfApi__MergeAndSaveKeys(partial) { Na__Test__Writes.push({ merge : JSON.parse(JSON.stringify(partial)) }); return { ok : true }; }',
        'export async function Na__CfApi__DeleteProjectKeys(keys) { Na__Test__Writes.push({ delete : keys.slice() }); return { ok : true }; }',
        ''
    ].join('\n'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type": "module" }');

    // THE PAGE | Render requests counted, project lighting announcements kept
    let renderRequests = 0;
    const announcements = [];
    globalThis.window = { dispatchEvent : (event) => {
        if (!event) return;
        if (event.type === 'na-request-render') renderRequests++;
        if (event.type === 'na-project-lighting-changed') announcements.push(event.detail);
    } };
    if (typeof globalThis.CustomEvent !== 'function') {
        globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    }

    const lighting  = await import(pathToFileURL(join(SCRATCH, COPIES[0])).href);
    const project   = await import(pathToFileURL(join(SCRATCH, COPIES[1])).href);
    const cfapi     = await import(pathToFileURL(join(SCRATCH, CFAPI)).href);
    const appConfig = JSON.parse(readFileSync(join(MODULES, '02__AppData', 'Na__AppConfig__Main.json'), 'utf8'));
    const source    = (relative) => readFileSync(join(MODULES, relative), 'utf8');

    const KEY = 'SceneLighting__ProjectOverrides';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Stand-In Lights and Checks
// -----------------------------------------------------------------------------

    function makeLights() {
        const position = { x : 0, y : 0, z : 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
        return {
            ambient : { intensity : 0 },
            sun     : { intensity : 0, position : position, shadow : { intensity : 1 } }
        };
    }

    function register(lights, projectConfig) {
        return lighting.Na__SceneLighting__Register({
            ambientLight     : lights.ambient,
            directionalLight : lights.sun,
            lightingConfig   : appConfig.Scene__Default__LightingConfig,
            perSceneConfig   : appConfig.Scene__PerSceneLighting,
            projectConfig    : projectConfig
        });
    }

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const near    = (a, b, tolerance) => Math.abs(a - b) < (tolerance === undefined ? 1e-9 : tolerance);
    const bearing = (p) => ((Math.atan2(p.x, -p.z) * 180 / Math.PI) + 360) % 360;
    const record  = (sun, ambient) => {
        const block = {
            SceneLighting__ProjectOverrides__Description   : 'test',
            SceneLighting__ProjectOverrides__SchemaVersion : 1
        };
        if (sun)     block.SceneLighting__ProjectOverrides__Sun     = sun;
        if (ambient) block.SceneLighting__ProjectOverrides__Ambient = ambient;
        return { projectName : 'Test', [KEY] : block };
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    console.log('TrueVision3D - project lighting');

    // THE APP CONFIG AND A PROJECT WITHOUT ITS OWN LIGHTING
    // ------------------------------------------------------------
    const lights = makeLights();
    check('the app config carries Scene__ProjectLighting, switched on',
        !!appConfig.Scene__ProjectLighting && appConfig.Scene__ProjectLighting.Scene__ProjectLighting__Enabled === true);
    check('register takes both lights', register(lights, appConfig.Scene__ProjectLighting) === true);
    check('project lighting is available', lighting.Na__SceneLighting__IsProjectEnabled() === true);
    const app = lighting.Na__SceneLighting__GetAppDefaults();
    const sunBearingDefault = bearing(lights.sun.position);
    check('a record without the key loads no lighting and leaves the default sun alone',
        project.Na__ProjLight__LoadFromRecord({ projectName : 'Test' }) === null
        && lighting.Na__SceneLighting__GetProjectValues() === null
        && near(bearing(lights.sun.position), sunBearingDefault, 1e-6));
    check('without project lighting, an unlit scene keeps the picture key it always had (none)',
        lighting.Na__SceneLighting__SceneToken({}) === null);
    check('the load is announced', announcements.length === 1 && announcements[0].reason === 'loaded', announcements);

    // A PROJECT WITH ITS OWN LIGHTING
    // ------------------------------------------------------------
    const loaded = project.Na__ProjLight__LoadFromRecord(record(
        { SceneLighting__Sun__RotationDeg : 135, SceneLighting__Sun__HeightDeg : 40, SceneLighting__Sun__ShadowsEnabled : false },
        { SceneLighting__Ambient__Intensity : 2.5 }
    ));
    check('the sections load: rotation 135, height 40, shadows off, ambient 2.5, sun strength the default',
        loaded && loaded.rotationDeg === 135 && loaded.heightDeg === 40 && loaded.shadowIntensity === 0
        && loaded.ambientIntensity === 2.5 && loaded.directionalIntensity === app.directionalIntensity, loaded);
    check('the lights follow at once: the sun turned 135 degrees clockwise, its shadows off, the fill at 2.5',
        near(bearing(lights.sun.position), (sunBearingDefault + 135) % 360, 1e-6)
        && lights.sun.shadow.intensity === 0 && lights.ambient.intensity === 2.5);
    check('the project has saved lighting and nothing is pending',
        project.Na__ProjLight__HasSaved() && !project.Na__ProjLight__IsPending());

    // SCENES RESOLVE OVER THE PROJECT; DRAWINGS KEEP THE APP DEFAULT
    // ------------------------------------------------------------
    const base = lighting.Na__SceneLighting__GetProjectValues();
    check('a scene without lighting of its own follows the project',
        JSON.stringify(lighting.Na__SceneLighting__ResolveScene({})) === JSON.stringify(base));
    const lowered = lighting.Na__SceneLighting__ResolveScene({ PresentationMode__Scene__Lighting : { Scene__Lighting__HeightDeg : 25 } });
    check('a scene that only lowers the sun keeps the project\'s direction',
        lowered.rotationDeg === 135 && lowered.heightDeg === 25 && lowered.ambientIntensity === 2.5, lowered);
    check('a drawing\'s approach pose is lit by the app default',
        JSON.stringify(lighting.Na__SceneLighting__ResolveScene({ PresentationMode__Scene__IsDrawingApproach : true })) === JSON.stringify(app));
    check('a scene at the project\'s lighting stores nothing', lighting.Na__SceneLighting__BuildBlock(base) === null);
    const backToZero = lighting.Na__SceneLighting__BuildBlock({ ...base, rotationDeg : 0 });
    check('a scene turned back to the app\'s direction on a turned project stores RotationDeg 0',
        backToZero && backToZero.Scene__Lighting__RotationDeg === 0, backToZero);
    check('Use Default in a scene\'s fold means the project\'s lighting',
        JSON.stringify(lighting.Na__SceneLighting__GetDefaults()) === JSON.stringify(base));
    const shadowsPart = (app.shadowIntensity >= 0.5) ? ',shadowsEnabled=false' : '';   // <-- Off is only a difference while the app default has shadows on (off since v2.184.2)
    check('a 3D picture of an unlit scene is keyed by the project\'s lighting',
        lighting.Na__SceneLighting__SceneToken({}) === 'light:project:rotationDeg=135,heightDeg=40,ambientIntensity=2.5' + shadowsPart,
        lighting.Na__SceneLighting__SceneToken({}));

    lighting.Na__SceneLighting__ApplyDefaults({ requestRender : false });
    check('ApplyDefaults (a Layout Editor drawing picture) lights with the app default',
        near(bearing(lights.sun.position), sunBearingDefault, 1e-6) && lights.sun.shadow.intensity === app.shadowIntensity);
    lighting.Na__SceneLighting__ApplyBase({ requestRender : false });
    check('ApplyBase (a drawing left with no scene to fly to) lights the 3D view the project\'s way',
        near(bearing(lights.sun.position), (sunBearingDefault + 135) % 360, 1e-6) && lights.sun.shadow.intensity === 0);

    // THE RECORD OBJECT
    // ------------------------------------------------------------
    const built = project.Na__ProjLight__BuildBlock({ ...app, rotationDeg : 90.4 });
    check('only what differs is written, rotation in whole degrees, an empty section left out',
        JSON.stringify(Object.keys(built)) === JSON.stringify(['SceneLighting__ProjectOverrides__Description', 'SceneLighting__ProjectOverrides__SchemaVersion', 'SceneLighting__ProjectOverrides__Sun'])
        && JSON.stringify(built.SceneLighting__ProjectOverrides__Sun) === JSON.stringify({ SceneLighting__Sun__RotationDeg : 90 }), built);
    check('the app default builds no object at all', project.Na__ProjLight__BuildBlock(app) === null);
    const flippedShadows = project.Na__ProjLight__BuildBlock({ ...app, shadowIntensity : app.shadowIntensity >= 0.5 ? 0 : 1 });
    check('Sun casts shadows set against the app default is written as the flag alone',
        !!flippedShadows && JSON.stringify(flippedShadows.SceneLighting__ProjectOverrides__Sun)
            === JSON.stringify({ SceneLighting__Sun__ShadowsEnabled : !(app.shadowIntensity >= 0.5) }), flippedShadows);
    const clamped = project.Na__ProjLight__ResolveBlock({ SceneLighting__ProjectOverrides__Sun : { SceneLighting__Sun__HeightDeg : 2, SceneLighting__Sun__Intensity : 9 } });
    check('a hand-edited object is clamped to the slider ranges, not refused',
        clamped.heightDeg === 10 && clamped.directionalIntensity === 3, clamped);
    check('junk is no lighting',
        project.Na__ProjLight__ResolveBlock('junk') === null && project.Na__ProjLight__ResolveBlock([1]) === null
        && project.Na__ProjLight__ResolveBlock({ SceneLighting__ProjectOverrides__Sun : {} }) === null);

    // SAVING TO R2 (THE STAND-IN)
    // ------------------------------------------------------------
    const held = project.Na__ProjLight__SetWorking({ ...base, rotationDeg : 200.6 });
    check('a working change is held at stored precision and is pending',
        held.rotationDeg === 201 && project.Na__ProjLight__IsPending(), held);
    let result = await project.Na__ProjLight__Save();
    const merged = cfapi.Na__Test__Writes[cfapi.Na__Test__Writes.length - 1];
    check('Save merges the one key into the project data on R2',
        result.ok && !result.cleared && merged.merge && Object.keys(merged.merge).length === 1
        && merged.merge[KEY].SceneLighting__ProjectOverrides__Sun.SceneLighting__Sun__RotationDeg === 201, merged);
    check('after the save nothing is pending', !project.Na__ProjLight__IsPending() && project.Na__ProjLight__HasSaved());
    project.Na__ProjLight__SetWorking(app);
    result = await project.Na__ProjLight__Save();
    const removed = cfapi.Na__Test__Writes[cfapi.Na__Test__Writes.length - 1];
    check('back at the app default, Save takes the key out of the project data',
        result.ok && result.cleared && removed.delete && removed.delete.length === 1 && removed.delete[0] === KEY, removed);
    check('and the project then has no lighting of its own',
        !project.Na__ProjLight__HasSaved() && lighting.Na__SceneLighting__GetProjectValues() === null);

    // SWITCHED OFF IN THE APP CONFIG
    // ------------------------------------------------------------
    register(makeLights(), { Scene__ProjectLighting__Enabled : false });
    check('switched off, a saved object is not read and the section is told to hide',
        project.Na__ProjLight__LoadFromRecord(record({ SceneLighting__Sun__RotationDeg : 90 })) === null
        && lighting.Na__SceneLighting__GetProjectValues() === null && lighting.Na__SceneLighting__IsProjectEnabled() === false);
    register(makeLights(), appConfig.Scene__ProjectLighting);

    // THE WIRING ROUND THE TWO MODULES
    // ------------------------------------------------------------
    check('the plan approach pose carries IsDrawingApproach',
        /PresentationMode__Scene__IsDrawingApproach\s*:\s*true/.test(source('42__System__FloorPlanViews/Na__FloorPlan__Framing__.js')));
    check('the elevation approach pose carries IsDrawingApproach',
        /PresentationMode__Scene__IsDrawingApproach\s*:\s*true/.test(source('45__System__ElevationViews/Na__Elevation__Framing__.js')));
    const sequence = source('01__AppCore/Na__AppFlow__LoadingSequence.js');
    const devSaved = sequence.slice(sequence.indexOf('const Na__DevSavedKeys'), sequence.indexOf('];', sequence.indexOf('const Na__DevSavedKeys')));
    check('on localhost the key is laid over the local copy from R2 (Na__DevSavedKeys)', devSaved.includes(`'${KEY}'`));
    check('the loading sequence reads it after registering the save merge base, before the scenes go out',
        sequence.indexOf('Na__ProjLight__LoadFromRecord(Na__ProjectData__Full)') > sequence.indexOf('Na__CfApi__SetLoadedProjectData(Na__ProjectData__Full)')
        && sequence.indexOf('Na__ProjLight__LoadFromRecord(Na__ProjectData__Full)') < sequence.indexOf("'na-presentation-mode-scenes-loaded'"));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
