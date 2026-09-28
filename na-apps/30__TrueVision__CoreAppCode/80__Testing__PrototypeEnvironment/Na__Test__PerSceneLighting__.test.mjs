// =============================================================================
// TRUEVISION3D - TEST - PER-SCENE LIGHTING
// =============================================================================
//
// FILE       : Na__Test__PerSceneLighting__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Per-Scene Lighting Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the shipped config still puts the sun where it always was, that a scene stores only
//              what it changes, that Rotation turns the sun clockwise seen from above, and that a flight
//              eases the light the short way round
// CREATED    : 28-Sep-2026
//
// DESCRIPTION:
// - Runs 06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js exactly as
//   the app runs it, against the app config's own lighting blocks. The module
//   and its two dependencies are copied into a temporary folder that keeps
//   their relative paths, with a package.json marking the .js files as ES
//   modules (Node reads the app's .js files as CommonJS otherwise).
// - The lights are stand-ins with the three properties the module sets:
//   intensity, position.set() and shadow.intensity. window.dispatchEvent is
//   counted, so a check can say whether a render was asked for.
// - THE FIXTURE IS THE PRE-v2.161.0 SUN. Na__Scene__SetupDefaultSceneLighting
//   hardcoded position (50, 100, 40); the config now holds it in millimetres,
//   and the default lighting must put it back there exactly.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__PerSceneLighting__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 80__Testing__PrototypeEnvironment/Na__Test__PerSceneLighting__.test.mjs 1.0.1 (v2.71.0)
// - Ported on     : 28-Sep-2026 for TrueVision3D v2.161.0
// - Parity        : verbatim - every check is ValeVision's, run against this app's own module and config.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 28-Sep-2026 - Version 1.0.1
// - Ported from ValeVision3D with the module it proves. The default strengths
//   are read from the app config, so the same checks hold for this app's 3.3
//   and 0.7.
//
// =============================================================================

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test, Its Dependencies and the App Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const MODULES    = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-scenelight-'));

    const COPIES = [
        '06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js',
        '04__MathUtils/Na__Math__Units.js',
        '05__RenderPipeline/Na__RenderLoop__Invalidation.js'
    ];
    COPIES.forEach((relative) => {
        mkdirSync(dirname(join(SCRATCH, relative)), { recursive : true });
        copyFileSync(join(MODULES, relative), join(SCRATCH, relative));
    });
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type": "module" }');

    // THE RENDER LOOP'S ONLY CONTACT WITH THE PAGE | Counted, not drawn
    let renderRequests = 0;
    globalThis.window = { dispatchEvent : (event) => { if (event && event.type === 'na-request-render') renderRequests++; } };
    if (typeof globalThis.CustomEvent !== 'function') {
        globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    }

    const lighting  = await import(pathToFileURL(join(SCRATCH, COPIES[0])).href);
    const appConfig = JSON.parse(readFileSync(join(MODULES, '02__AppData', 'Na__AppConfig__Main.json'), 'utf8'));

    const KEY = 'PresentationMode__Scene__Lighting';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Stand-In Lights
// -----------------------------------------------------------------------------

    function makeLights() {
        const position = { x : 0, y : 0, z : 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
        return {
            ambient : { intensity : 0 },
            sun     : { intensity : 0, position : position, shadow : { intensity : 1 } }
        };
    }

    function register(lights, lightingConfig, perSceneConfig) {
        return lighting.Na__SceneLighting__Register({
            ambientLight     : lights.ambient,
            directionalLight : lights.sun,
            lightingConfig   : lightingConfig,
            perSceneConfig   : perSceneConfig
        });
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const near   = (a, b, tolerance) => Math.abs(a - b) < (tolerance === undefined ? 1e-9 : tolerance);
    const nearXyz = (p, x, y, z) => near(p.x, x, 1e-6) && near(p.y, y, 1e-6) && near(p.z, z, 1e-6);
    const xyz    = (p) => [p.x, p.y, p.z].map((v) => Math.round(v * 1e6) / 1e6);

    console.log('TrueVision3D - per-scene lighting');

    // THE SHIPPED DEFAULT | Exactly the light the app had before v2.71.0
    // ------------------------------------------------------------
    const lights = makeLights();
    check('the app config carries the lighting blocks',
        !!appConfig.Scene__Default__LightingConfig && !!appConfig.Scene__PerSceneLighting);
    check('register takes both lights',
        register(lights, appConfig.Scene__Default__LightingConfig, appConfig.Scene__PerSceneLighting) === true);
    check('the default sun sits at (50, 100, 40), where the setup module used to put it',
        nearXyz(lights.sun.position, 50, 100, 40), xyz(lights.sun.position));
    const cfgAmbient = appConfig.Scene__Default__LightingConfig.Scene__Default__LightingConfig__AmbientIntensity;
    const cfgSun     = appConfig.Scene__Default__LightingConfig.Scene__Default__LightingConfig__DirectionalIntensity;
    check(`default strengths come from the config: ambient ${cfgAmbient}, sun ${cfgSun}`,
        near(lights.ambient.intensity, cfgAmbient) && near(lights.sun.intensity, cfgSun));
    check('shadows are on by default', lights.sun.shadow.intensity === 1);
    check('registering asks for no frame (the first frame has not been drawn yet)', renderRequests === 0);

    const defaults = lighting.Na__SceneLighting__GetDefaults();
    check('the default rotation is 0 and the default height is asin(100 / |sun|)',
        defaults.rotationDeg === 0 && near(defaults.heightDeg, Math.asin(100 / Math.sqrt(14100)) * 180 / Math.PI));
    const limits = lighting.Na__SceneLighting__GetLimits();
    check('slider ranges come from Scene__PerSceneLighting',
        limits.heightMinDeg === 10 && limits.heightMaxDeg === 90 && limits.ambientMax === 6 && limits.directionalMax === 3, limits);
    check('per-scene lighting is on, and eases over a flight',
        lighting.Na__SceneLighting__IsEnabled() === true && lighting.Na__SceneLighting__IsBlendDuringFlight() === true);


    // ROTATION | Clockwise seen from above (plan: +X right, -Z up the page)
    // ------------------------------------------------------------
    lighting.Na__SceneLighting__Apply({ ...defaults, rotationDeg : 90 });
    check('rotation 90 turns (50, _, 40) clockwise in plan to (-40, _, 50)',
        nearXyz(lights.sun.position, -40, 100, 50), xyz(lights.sun.position));
    check('a change asks the render loop for one frame', renderRequests === 1, renderRequests);

    lighting.Na__SceneLighting__Apply({ ...defaults, rotationDeg : 90 });
    check('the same light again asks for nothing', renderRequests === 1, renderRequests);

    lighting.Na__SceneLighting__Apply({ ...defaults, rotationDeg : 180 }, { requestRender : false });
    check('rotation 180 puts the sun opposite: (-50, 100, -40)', nearXyz(lights.sun.position, -50, 100, -40), xyz(lights.sun.position));
    check('requestRender false asks for nothing', renderRequests === 1, renderRequests);

    lighting.Na__SceneLighting__Apply({ ...defaults, heightDeg : 90 }, { requestRender : false });
    check('height 90 is straight overhead at the same distance',
        near(lights.sun.position.x, 0, 1e-6) && near(lights.sun.position.z, 0, 1e-6) && near(lights.sun.position.y, Math.sqrt(14100), 1e-6),
        xyz(lights.sun.position));

    lighting.Na__SceneLighting__ApplyDefaults({ requestRender : false });
    check('ApplyDefaults puts the sun back at (50, 100, 40)', nearXyz(lights.sun.position, 50, 100, 40), xyz(lights.sun.position));


    // BUILD BLOCK | A scene stores only what it changes
    // ------------------------------------------------------------
    check('the default builds no block', lighting.Na__SceneLighting__BuildBlock(defaults) === null);

    const rotated = lighting.Na__SceneLighting__BuildBlock({ ...defaults, rotationDeg : 135 });
    check('rotation 135 builds a block holding the rotation and nothing else',
        !!rotated && rotated.Scene__Lighting__RotationDeg === 135
        && Object.keys(rotated).filter((k) => k !== 'Scene__Lighting__Description').length === 1, rotated);

    check('a height that rounds to the default height is not stored',
        lighting.Na__SceneLighting__BuildBlock({ ...defaults, heightDeg : 57.4 }) === null);
    check('a strength that rounds to the default is not stored',
        lighting.Na__SceneLighting__BuildBlock({ ...defaults, ambientIntensity : defaults.ambientIntensity + 0.004 }) === null);
    check('rotation 360, and 359.6, are the default direction',
        lighting.Na__SceneLighting__BuildBlock({ ...defaults, rotationDeg : 360 }) === null
        && lighting.Na__SceneLighting__BuildBlock({ ...defaults, rotationDeg : 359.6 }) === null);

    const everything = lighting.Na__SceneLighting__BuildBlock({
        rotationDeg : 45.4, heightDeg : 30.2, directionalIntensity : 0.804, ambientIntensity : 3.2, shadowIntensity : 0
    });
    check('every setting changed is stored at its precision: whole degrees, two places, shadows as a flag',
        !!everything
        && everything.Scene__Lighting__RotationDeg === 45
        && everything.Scene__Lighting__HeightDeg === 30
        && everything.Scene__Lighting__DirectionalIntensity === 0.8
        && everything.Scene__Lighting__AmbientIntensity === 3.2
        && everything.Scene__Lighting__ShadowsEnabled === false, everything);


    // RESOLVE | The default with the block laid over it
    // ------------------------------------------------------------
    const partial = lighting.Na__SceneLighting__Resolve({ Scene__Lighting__RotationDeg : 135 });
    check('a partial block keeps every other setting at the exact default',
        partial.rotationDeg === 135 && partial.heightDeg === defaults.heightDeg
        && partial.ambientIntensity === defaults.ambientIntensity && partial.directionalIntensity === defaults.directionalIntensity
        && partial.shadowIntensity === 1, partial);

    const clamped = lighting.Na__SceneLighting__Resolve({
        Scene__Lighting__RotationDeg : -90, Scene__Lighting__HeightDeg : 5,
        Scene__Lighting__AmbientIntensity : 99, Scene__Lighting__DirectionalIntensity : -1
    });
    check('out-of-range values are wrapped and clamped: -90 is 270, height 5 to 10, ambient 99 to 6, sun -1 to 0',
        clamped.rotationDeg === 270 && clamped.heightDeg === 10 && clamped.ambientIntensity === 6 && clamped.directionalIntensity === 0, clamped);

    const noShadows = lighting.Na__SceneLighting__ResolveScene({ [KEY] : { Scene__Lighting__ShadowsEnabled : false } });
    lighting.Na__SceneLighting__Apply(noShadows, { requestRender : false });
    check('ShadowsEnabled false fades the shadow to 0 without touching castShadow',
        noShadows.shadowIntensity === 0 && lights.sun.shadow.intensity === 0 && lights.sun.castShadow === undefined);

    check('no block, a junk block and no scene all resolve to the default',
        lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__ResolveScene({}), defaults)
        && lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__Resolve('junk'), defaults)
        && lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__ResolveScene(null), defaults));

    const roundTrip = lighting.Na__SceneLighting__Resolve(everything);
    check('a built block resolves back to the values it was built from (at stored precision)',
        lighting.Na__SceneLighting__IsSame(roundTrip, { rotationDeg : 45, heightDeg : 30, directionalIntensity : 0.8, ambientIntensity : 3.2, shadowIntensity : 0 }), roundTrip);


    // BLEND | The flight's ease, the short way round
    // ------------------------------------------------------------
    const from = { ...defaults, rotationDeg : 350, ambientIntensity : 2, shadowIntensity : 1 };
    const to   = { ...defaults, rotationDeg : 10,  ambientIntensity : 4, shadowIntensity : 0 };
    const half = lighting.Na__SceneLighting__Blend(from, to, 0.5);
    check('350 to 10 passes through 0, not 180', near(half.rotationDeg, 0), half.rotationDeg);
    check('10 to 350 passes through 0 too', near(lighting.Na__SceneLighting__Blend(to, from, 0.5).rotationDeg, 0));
    check('strengths and the shadow fade are linear in t', near(half.ambientIntensity, 3) && near(half.shadowIntensity, 0.5));
    check('t 0 is the start and t 1 the end',
        lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__Blend(from, to, 0), from)
        && lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__Blend(from, to, 1), to));


    // CAPTURE | What Update Scene and Add Scene From Camera write
    // ------------------------------------------------------------
    const scene = { PresentationMode__Scene__Id : 'Scene_006', [KEY] : { Scene__Lighting__RotationDeg : 90 } };
    lighting.Na__SceneLighting__ApplyDefaults({ requestRender : false });
    lighting.Na__SceneLighting__CaptureIntoScene(scene);
    check('capturing the default removes the key (the default is never a copy of itself)', !(KEY in scene), scene);

    lighting.Na__SceneLighting__Apply(lighting.Na__SceneLighting__Resolve({ Scene__Lighting__RotationDeg : 200, Scene__Lighting__AmbientIntensity : 3.5 }), { requestRender : false });
    lighting.Na__SceneLighting__CaptureIntoScene(scene);
    check('capturing a custom light writes the smallest block that reproduces it',
        scene[KEY] && scene[KEY].Scene__Lighting__RotationDeg === 200 && scene[KEY].Scene__Lighting__AmbientIntensity === 3.5
        && scene[KEY].Scene__Lighting__HeightDeg === undefined, scene[KEY]);
    check('the captured scene resolves to exactly the live light',
        lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__ResolveScene(scene), lighting.Na__SceneLighting__GetLive()));


    // SCENE TOKEN | The Layout Editor's picture key
    // ------------------------------------------------------------
    check('an unlit scene has no token, so its pictures keep their keys',
        lighting.Na__SceneLighting__SceneToken({ PresentationMode__Scene__Id : 'x' }) === null);
    check('a lit scene has a token naming what it changes',
        lighting.Na__SceneLighting__SceneToken(scene) === 'light:RotationDeg=200,AmbientIntensity=3.5',
        lighting.Na__SceneLighting__SceneToken(scene));


    // SWITCHED OFF | Enabled false ignores every override and deletes nothing
    // ------------------------------------------------------------
    const offLights = makeLights();
    register(offLights, appConfig.Scene__Default__LightingConfig, { ...appConfig.Scene__PerSceneLighting, Scene__PerSceneLighting__Enabled : false });
    check('switched off, a scene block resolves to the default',
        lighting.Na__SceneLighting__IsSame(lighting.Na__SceneLighting__ResolveScene(scene), lighting.Na__SceneLighting__GetDefaults()));
    const keptBlock = JSON.stringify(scene[KEY]);
    check('switched off, capture leaves the record alone',
        lighting.Na__SceneLighting__CaptureIntoScene(scene) === false && JSON.stringify(scene[KEY]) === keptBlock);
    check('switched off, the Dev menu is told to hide and no picture is re-keyed',
        lighting.Na__SceneLighting__IsEnabled() === false && lighting.Na__SceneLighting__SceneToken(scene) === null);


    // AN OLDER CONFIG | Cached on a deployed origin, without the new keys
    // ------------------------------------------------------------
    const oldLights = makeLights();
    register(oldLights, {
        Scene__Default__LightingConfig__AmbientIntensity     : 2.8,
        Scene__Default__LightingConfig__DirectionalIntensity : 0.5
    }, null);
    check('an app config from before v2.161.0 still lights the model exactly as before',
        nearXyz(oldLights.sun.position, 50, 100, 40) && oldLights.sun.shadow.intensity === 1
        && lighting.Na__SceneLighting__IsEnabled() === true, xyz(oldLights.sun.position));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
