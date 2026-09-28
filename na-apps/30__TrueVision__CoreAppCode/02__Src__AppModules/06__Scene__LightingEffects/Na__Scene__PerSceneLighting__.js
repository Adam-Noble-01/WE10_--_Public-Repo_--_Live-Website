// =============================================================================
// TRUEVISION3D - SCENE LIGHTING EFFECTS - PER-SCENE LIGHTING
// =============================================================================
//
// FILE       : Na__Scene__PerSceneLighting__.js
// NAMESPACE  : Na__SceneLighting
// MODULE     : Scene Lighting Effects - Per-Scene Lighting
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the live sun and fill light, their defaults, and the lighting
//              override a Presentation Mode scene can carry
// CREATED    : 28-Sep-2026
//
// DESCRIPTION:
// - The app has two lights, both built by Na__Scene__SetupDefaultSceneLighting:
//   an ambient fill and one directional light, the sun, which is the only light
//   that casts shadows. That module hands both to this one, and from then on
//   nothing else moves them.
// - THE DEFAULT IS THE APP CONFIG, NOT THIS FILE. Scene__Default__LightingConfig
//   holds both strengths, whether the sun casts shadows, and where the sun sits
//   in integer millimetres (moved out of the setup module with the same values,
//   so the default look is exactly what it was).
// - A SCENE STORES ONLY WHAT IT CHANGES. PresentationMode__Scene__Lighting on a
//   scene record holds the settings that differ from the default and nothing
//   else, so every setting a scene leaves alone keeps following the default
//   when the default is changed. No block at all is the default lighting.
//     Scene__Lighting__RotationDeg           the sun turned about the vertical
//                                            axis, clockwise seen from above; 0
//                                            is the default direction (0 to 359)
//     Scene__Lighting__HeightDeg             the sun's angle above the horizon
//     Scene__Lighting__DirectionalIntensity  the sun's strength
//     Scene__Lighting__AmbientIntensity      the fill light's strength
//     Scene__Lighting__ShadowsEnabled        false switches the sun's shadows off
// - SHADOWS SWITCH BY STRENGTH, NEVER BY castShadow. Turning a light's
//   castShadow over changes the shader defines of every lit material, so every
//   one of them recompiles: a visible stall, and one per flight between two
//   scenes that disagree. LightShadow.intensity is a plain uniform (three r184):
//   0 is no shadow, 1 the full shadow, and anything between is a fade a camera
//   flight can ease through.
// - VALUES are the resolved, complete settings the lights are set from:
//   { rotationDeg, heightDeg, directionalIntensity, ambientIntensity,
//   shadowIntensity }. Resolve turns a stored block into values, BuildBlock
//   turns values back into the smallest block that reproduces them, Blend eases
//   between two values for a camera flight (the rotation takes the short way
//   round), and Apply sets the lights.
// - Anything without a block resolves to the default: an unlit scene, the
//   synthetic approach pose a drawing flight uses, a batch restore point taken
//   while the default was showing. That is what stops one scene's lighting
//   leaking into the next scene, or into a plan or elevation.
// - This module never imports the Presentation Mode system. It knows the one
//   key a scene record keeps its block under, and the scene transition, the Dev
//   menu, the batch walk, the Layout Editor and the drawing thumbnail bake call
//   in to it.
//
// INTEGRATION:
// - Na__Scene__SetupDefaultSceneLighting registers the lights and both config
//   blocks (Scene__Default__LightingConfig, Scene__PerSceneLighting).
// - Na__PresentationMode__Camera__SceneTransition applies a scene's lighting on
//   the instant snap and eases it over an animated flight.
// - Na__PresentationMode__DevMenu__SceneLightingRows__ previews and edits it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js 1.0.0 (v2.71.0)
// - Ported on     : 28-Sep-2026 for TrueVision3D v2.161.0
// - Parity        : verbatim
// - Divergences   : Header, console prefix and the version the fallbacks name.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 28-Sep-2026 - Version 1.0.0
// - Ported from ValeVision3D v2.71.0, where it was written the same day.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Units and Render Loop
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Scene Record Key and Block Keys
    // ------------------------------------------------------------
    const Na__SceneLighting__SCENE_KEY         = 'PresentationMode__Scene__Lighting';            // <-- Where a scene record keeps its override
    const Na__SceneLighting__KEY__DESCRIPTION  = 'Scene__Lighting__Description';
    const Na__SceneLighting__KEY__ROTATION     = 'Scene__Lighting__RotationDeg';
    const Na__SceneLighting__KEY__HEIGHT       = 'Scene__Lighting__HeightDeg';
    const Na__SceneLighting__KEY__DIRECTIONAL  = 'Scene__Lighting__DirectionalIntensity';
    const Na__SceneLighting__KEY__AMBIENT      = 'Scene__Lighting__AmbientIntensity';
    const Na__SceneLighting__KEY__SHADOWS      = 'Scene__Lighting__ShadowsEnabled';
    const Na__SceneLighting__BLOCK_DESCRIPTION =
        'This scene\'s own lighting. Only the settings that differ from the app\'s default lighting '
        + '(Scene__Default__LightingConfig) are stored; anything absent follows the default. RotationDeg turns '
        + 'the sun clockwise seen from above from its default direction; HeightDeg is its angle above the horizon.';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks for an App Config Older Than These Keys
    // ------------------------------------------------------------
    // Only ever read when the config in hand predates v2.161.0 (a deployed
    // origin can hold a cached copy for a visit). The sun position is the one
    // Na__Scene__SetupDefaultSceneLighting hardcoded before then, so an old
    // config still lights the model exactly as it always did.
    // ------------------------------------------------------------
    const Na__SceneLighting__FALLBACK__SUN_X_MM         = 50000;
    const Na__SceneLighting__FALLBACK__SUN_Y_MM         = 100000;
    const Na__SceneLighting__FALLBACK__SUN_Z_MM         = 40000;
    const Na__SceneLighting__FALLBACK__HEIGHT_MIN_DEG   = 10;
    const Na__SceneLighting__FALLBACK__HEIGHT_MAX_DEG   = 90;
    const Na__SceneLighting__FALLBACK__AMBIENT_MAX      = 6;
    const Na__SceneLighting__FALLBACK__DIRECTIONAL_MAX  = 3;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Angle Conversion
    // ------------------------------------------------------------
    const Na__SceneLighting__DEG_TO_RAD = Math.PI / 180;
    const Na__SceneLighting__RAD_TO_DEG = 180 / Math.PI;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Two Lights and What They Default To
    // ------------------------------------------------------------
    let Na__SceneLighting__AmbientLight    = null;    // <-- THREE.AmbientLight, the fill
    let Na__SceneLighting__SunLight        = null;    // <-- THREE.DirectionalLight, the sun (the only shadow caster)
    let Na__SceneLighting__Defaults        = null;    // <-- Values the app config resolves to
    let Na__SceneLighting__Limits          = null;    // <-- Slider ranges: { heightMinDeg, heightMaxDeg, ambientMax, directionalMax }
    let Na__SceneLighting__SunDistance     = 0;       // <-- Default sun distance from the origin, three.js units (kept for every direction)
    let Na__SceneLighting__BaseBearingRad  = 0;       // <-- Default sun bearing, clockwise from -Z seen from above
    let Na__SceneLighting__OverridesOn     = true;    // <-- Scene__PerSceneLighting__Enabled
    let Na__SceneLighting__BlendInFlight   = true;    // <-- Scene__PerSceneLighting__BlendDuringFlight
    let Na__SceneLighting__Live            = null;    // <-- The values the lights were last set from
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Number Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Finite Number, or the Fallback
    // ------------------------------------------------------------
    function Na__SceneLighting__Num(value, fallback) {
        const number = Number(value);
        return (value !== null && value !== '' && Number.isFinite(number)) ? number : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp Into a Range
    // ------------------------------------------------------------
    function Na__SceneLighting__Clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Degrees Wrapped Into 0 to 360
    // ------------------------------------------------------------
    function Na__SceneLighting__WrapDeg(degrees) {
        const wrapped = degrees % 360;
        return wrapped < 0 ? wrapped + 360 : wrapped;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Two Decimal Places (how a strength is stored)
    // ------------------------------------------------------------
    function Na__SceneLighting__Round2(value) {
        return Math.round(value * 100) / 100;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration (called once by the lighting setup)
// -----------------------------------------------------------------------------

    // FUNCTION | Take Charge of the Two Lights and Read Their Defaults
    // ------------------------------------------------------------
    // context: { ambientLight, directionalLight, lightingConfig, perSceneConfig }
    //
    // The sun is placed here, from Scene__Default__LightingConfig, and the
    // default values are set on both lights before the first frame is drawn.
    // Its distance from the origin is kept for every direction a scene turns it
    // to, because that distance is what keeps the shadow camera clear of the
    // model; only its direction shades anything.
    // ------------------------------------------------------------
    function Na__SceneLighting__Register(context) {
        const ambientLight     = context && context.ambientLight;
        const directionalLight = context && context.directionalLight;
        if (!ambientLight || !directionalLight) return false;

        const lighting = (context.lightingConfig && typeof context.lightingConfig === 'object') ? context.lightingConfig : {};
        const perScene = (context.perSceneConfig && typeof context.perSceneConfig === 'object') ? context.perSceneConfig : {};


        // THE DEFAULT SUN | Millimetres in the config, three.js units here
        // ------------------------------------
        let sunX = Na__Math__ConvertMmToUnits(Na__SceneLighting__Num(lighting.Scene__Default__LightingConfig__DirectionalPosXMm, Na__SceneLighting__FALLBACK__SUN_X_MM));
        let sunY = Na__Math__ConvertMmToUnits(Na__SceneLighting__Num(lighting.Scene__Default__LightingConfig__DirectionalPosYMm, Na__SceneLighting__FALLBACK__SUN_Y_MM));
        let sunZ = Na__Math__ConvertMmToUnits(Na__SceneLighting__Num(lighting.Scene__Default__LightingConfig__DirectionalPosZMm, Na__SceneLighting__FALLBACK__SUN_Z_MM));

        if ((sunX * sunX + sunY * sunY + sunZ * sunZ) < 1e-9) {
            console.warn('[TrueVision3D] Default sun position is at the origin; using the built-in position instead.');
            sunX = Na__Math__ConvertMmToUnits(Na__SceneLighting__FALLBACK__SUN_X_MM);
            sunY = Na__Math__ConvertMmToUnits(Na__SceneLighting__FALLBACK__SUN_Y_MM);
            sunZ = Na__Math__ConvertMmToUnits(Na__SceneLighting__FALLBACK__SUN_Z_MM);
        }

        Na__SceneLighting__SunDistance    = Math.sqrt(sunX * sunX + sunY * sunY + sunZ * sunZ);
        Na__SceneLighting__BaseBearingRad = Math.atan2(sunX, -sunZ);          // <-- Clockwise from -Z seen from above, the north bearing's sense
        const defaultHeightDeg = Math.asin(Na__SceneLighting__Clamp(sunY / Na__SceneLighting__SunDistance, -1, 1)) * Na__SceneLighting__RAD_TO_DEG;


        // THE DEFAULT VALUES | Strengths fall back to what the lights were built with
        // ------------------------------------
        Na__SceneLighting__Defaults = {
            rotationDeg          : 0,                                         // <-- Rotation is measured FROM the default direction
            heightDeg            : defaultHeightDeg,                          // <-- Kept unrounded, so the default sun sits exactly where it always did
            directionalIntensity : Math.max(0, Na__SceneLighting__Num(lighting.Scene__Default__LightingConfig__DirectionalIntensity, directionalLight.intensity)),
            ambientIntensity     : Math.max(0, Na__SceneLighting__Num(lighting.Scene__Default__LightingConfig__AmbientIntensity, ambientLight.intensity)),
            shadowIntensity      : (lighting.Scene__Default__LightingConfig__ShadowsEnabled === false) ? 0 : 1
        };


        // THE SLIDER RANGES | Always wide enough to show the default itself
        // ------------------------------------
        const heightMin = Na__SceneLighting__Clamp(Na__SceneLighting__Num(perScene.Scene__PerSceneLighting__HeightMinDeg, Na__SceneLighting__FALLBACK__HEIGHT_MIN_DEG), 0, 90);
        const heightMax = Na__SceneLighting__Clamp(Na__SceneLighting__Num(perScene.Scene__PerSceneLighting__HeightMaxDeg, Na__SceneLighting__FALLBACK__HEIGHT_MAX_DEG), heightMin, 90);

        Na__SceneLighting__Limits = {
            heightMinDeg   : Math.min(heightMin, Math.floor(defaultHeightDeg)),
            heightMaxDeg   : Math.max(heightMax, Math.ceil(defaultHeightDeg)),
            ambientMax     : Math.max(Na__SceneLighting__Num(perScene.Scene__PerSceneLighting__AmbientIntensityMax, Na__SceneLighting__FALLBACK__AMBIENT_MAX), Na__SceneLighting__Defaults.ambientIntensity),
            directionalMax : Math.max(Na__SceneLighting__Num(perScene.Scene__PerSceneLighting__DirectionalIntensityMax, Na__SceneLighting__FALLBACK__DIRECTIONAL_MAX), Na__SceneLighting__Defaults.directionalIntensity)
        };

        Na__SceneLighting__OverridesOn   = perScene.Scene__PerSceneLighting__Enabled !== false;
        Na__SceneLighting__BlendInFlight = perScene.Scene__PerSceneLighting__BlendDuringFlight !== false;


        // TAKE THE LIGHTS AND SHOW THE DEFAULT
        // ------------------------------------
        Na__SceneLighting__AmbientLight = ambientLight;
        Na__SceneLighting__SunLight     = directionalLight;
        Na__SceneLighting__Live         = null;                               // <-- Forces the first Apply to set every light property
        Na__SceneLighting__Apply(Na__SceneLighting__Defaults, { requestRender : false });

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Values - Resolve, Build, Compare, Blend
// -----------------------------------------------------------------------------

    // FUNCTION | Resolve a Stored Block Into Complete Values
    // ------------------------------------------------------------
    // The default, with whatever the block holds laid over it. A missing
    // block, a block that is not an object, or per-scene lighting switched off
    // in the app config, all give the plain default. Out-of-range numbers are
    // clamped rather than refused, so a hand-edited project still loads lit.
    // Returns null only before the lights are registered.
    // ------------------------------------------------------------
    function Na__SceneLighting__Resolve(block) {
        if (!Na__SceneLighting__Defaults) return null;

        const values = { ...Na__SceneLighting__Defaults };
        if (!Na__SceneLighting__OverridesOn || !block || typeof block !== 'object') return values;

        const limits = Na__SceneLighting__Limits;
        const rotation    = Na__SceneLighting__Num(block[Na__SceneLighting__KEY__ROTATION], null);
        const height      = Na__SceneLighting__Num(block[Na__SceneLighting__KEY__HEIGHT], null);
        const directional = Na__SceneLighting__Num(block[Na__SceneLighting__KEY__DIRECTIONAL], null);
        const ambient     = Na__SceneLighting__Num(block[Na__SceneLighting__KEY__AMBIENT], null);
        const shadows     = block[Na__SceneLighting__KEY__SHADOWS];

        if (rotation    !== null) values.rotationDeg          = Na__SceneLighting__WrapDeg(rotation);
        if (height      !== null) values.heightDeg            = Na__SceneLighting__Clamp(height, limits.heightMinDeg, limits.heightMaxDeg);
        if (directional !== null) values.directionalIntensity = Na__SceneLighting__Clamp(directional, 0, limits.directionalMax);
        if (ambient     !== null) values.ambientIntensity     = Na__SceneLighting__Clamp(ambient, 0, limits.ambientMax);
        if (typeof shadows === 'boolean') values.shadowIntensity = shadows ? 1 : 0;

        return values;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Lighting a Scene Record Asks For
    // ------------------------------------------------------------
    function Na__SceneLighting__ResolveScene(scene) {
        return Na__SceneLighting__Resolve(scene ? scene[Na__SceneLighting__SCENE_KEY] : null);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Smallest Block That Reproduces These Values
    // ------------------------------------------------------------
    // A setting is written only when it differs from the default at the
    // precision it is stored at - whole degrees, strengths to two places, the
    // shadows as on or off. Returns null when nothing differs, which callers
    // treat as "delete the key": a scene at the default carries no block, so
    // it keeps following the default when the default is changed.
    // ------------------------------------------------------------
    function Na__SceneLighting__BuildBlock(values) {
        const defaults = Na__SceneLighting__Defaults;
        if (!defaults || !values) return null;

        const fields = {};

        const rotation = Math.round(Na__SceneLighting__WrapDeg(Na__SceneLighting__Num(values.rotationDeg, 0))) % 360;
        if (rotation !== 0) fields[Na__SceneLighting__KEY__ROTATION] = rotation;

        const height = Math.round(Na__SceneLighting__Num(values.heightDeg, defaults.heightDeg));
        if (height !== Math.round(defaults.heightDeg)) fields[Na__SceneLighting__KEY__HEIGHT] = height;

        const directional = Na__SceneLighting__Round2(Na__SceneLighting__Num(values.directionalIntensity, defaults.directionalIntensity));
        if (directional !== Na__SceneLighting__Round2(defaults.directionalIntensity)) fields[Na__SceneLighting__KEY__DIRECTIONAL] = directional;

        const ambient = Na__SceneLighting__Round2(Na__SceneLighting__Num(values.ambientIntensity, defaults.ambientIntensity));
        if (ambient !== Na__SceneLighting__Round2(defaults.ambientIntensity)) fields[Na__SceneLighting__KEY__AMBIENT] = ambient;

        const shadowsOn = Na__SceneLighting__Num(values.shadowIntensity, defaults.shadowIntensity) >= 0.5;
        if (shadowsOn !== (defaults.shadowIntensity >= 0.5)) fields[Na__SceneLighting__KEY__SHADOWS] = shadowsOn;

        if (Object.keys(fields).length === 0) return null;
        return { [Na__SceneLighting__KEY__DESCRIPTION] : Na__SceneLighting__BLOCK_DESCRIPTION, ...fields };
    }
    // ------------------------------------------------------------


    // FUNCTION | Do Two Values Light the Model the Same Way?
    // ------------------------------------------------------------
    function Na__SceneLighting__IsSame(a, b) {
        if (!a || !b) return a === b;
        const turn = Math.abs(Na__SceneLighting__WrapDeg(a.rotationDeg - b.rotationDeg));
        return Math.min(turn, 360 - turn) < 1e-6
            && Math.abs(a.heightDeg            - b.heightDeg)            < 1e-6
            && Math.abs(a.directionalIntensity - b.directionalIntensity) < 1e-6
            && Math.abs(a.ambientIntensity     - b.ambientIntensity)     < 1e-6
            && Math.abs(a.shadowIntensity      - b.shadowIntensity)      < 1e-6;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ease From One Lighting to Another (t from 0 to 1)
    // ------------------------------------------------------------
    // The rotation goes the short way round: 350 to 10 degrees turns the sun
    // twenty degrees forward, not three hundred and forty back. Shadows fade
    // through their strength, which is why they are a number here.
    // ------------------------------------------------------------
    function Na__SceneLighting__Blend(from, to, t) {
        if (!from || !to) return to || from || null;
        const k    = Na__SceneLighting__Clamp(Number.isFinite(t) ? t : 1, 0, 1);
        const lerp = (a, b) => a + (b - a) * k;
        const turn = ((((to.rotationDeg - from.rotationDeg) % 360) + 540) % 360) - 180;   // <-- Shortest signed arc

        return {
            rotationDeg          : Na__SceneLighting__WrapDeg(from.rotationDeg + turn * k),
            heightDeg            : lerp(from.heightDeg,            to.heightDeg),
            directionalIntensity : lerp(from.directionalIntensity, to.directionalIntensity),
            ambientIntensity     : lerp(from.ambientIntensity,     to.ambientIntensity),
            shadowIntensity      : lerp(from.shadowIntensity,      to.shadowIntensity)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Applying Values to the Lights
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put the Sun at a Rotation and Height
    // ------------------------------------------------------------
    // Bearing clockwise from -Z seen from above: (sin b, 0, -cos b) is the
    // horizontal direction, so bearing 0 is -Z and bearing 90 is +X. At the
    // default rotation and height this returns the configured position.
    // ------------------------------------------------------------
    function Na__SceneLighting__PlaceSun(rotationDeg, heightDeg, out) {
        const bearing    = Na__SceneLighting__BaseBearingRad + rotationDeg * Na__SceneLighting__DEG_TO_RAD;
        const height     = heightDeg * Na__SceneLighting__DEG_TO_RAD;
        const horizontal = Na__SceneLighting__SunDistance * Math.cos(height);

        out.set(
            horizontal * Math.sin(bearing),
            Na__SceneLighting__SunDistance * Math.sin(height),
            -horizontal * Math.cos(bearing)
        );
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Values Made Safe to Set
    // ------------------------------------------------------------
    // Physical sanity only (the slider ranges are the Resolve step's business):
    // a height within 0 to 90, no negative strength, a shadow strength 0 to 1.
    // ------------------------------------------------------------
    function Na__SceneLighting__Sanitise(values) {
        const defaults = Na__SceneLighting__Defaults;
        return {
            rotationDeg          : Na__SceneLighting__WrapDeg(Na__SceneLighting__Num(values.rotationDeg, 0)),
            heightDeg            : Na__SceneLighting__Clamp(Na__SceneLighting__Num(values.heightDeg, defaults.heightDeg), 0, 90),
            directionalIntensity : Math.max(0, Na__SceneLighting__Num(values.directionalIntensity, defaults.directionalIntensity)),
            ambientIntensity     : Math.max(0, Na__SceneLighting__Num(values.ambientIntensity, defaults.ambientIntensity)),
            shadowIntensity      : Na__SceneLighting__Clamp(Na__SceneLighting__Num(values.shadowIntensity, defaults.shadowIntensity), 0, 1)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Both Lights From Complete Values
    // ------------------------------------------------------------
    // options.requestRender (default true): false for callers that are already
    // drawing frames - the flight's own tick, a render about to be taken - so a
    // light change does not ask the loop for a frame it is drawing anyway.
    // Asks for nothing when the lights already stand as asked. Returns false
    // before the lights are registered.
    // ------------------------------------------------------------
    function Na__SceneLighting__Apply(values, options) {
        if (!Na__SceneLighting__SunLight || !Na__SceneLighting__AmbientLight || !values || !Na__SceneLighting__Defaults) return false;

        const safe    = Na__SceneLighting__Sanitise(values);
        const changed = !Na__SceneLighting__IsSame(safe, Na__SceneLighting__Live);

        Na__SceneLighting__AmbientLight.intensity    = safe.ambientIntensity;
        Na__SceneLighting__SunLight.intensity        = safe.directionalIntensity;
        Na__SceneLighting__SunLight.shadow.intensity = safe.shadowIntensity;  // <-- A uniform: no material recompiles, unlike castShadow
        Na__SceneLighting__PlaceSun(safe.rotationDeg, safe.heightDeg, Na__SceneLighting__SunLight.position);

        Na__SceneLighting__Live = safe;

        const wantsRender = !options || options.requestRender !== false;
        if (changed && wantsRender) Na__RenderLoop__RequestRender();          // <-- Also restarts the idle supersampling on the new light
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Light the Model the Way a Scene Record Asks
    // ------------------------------------------------------------
    function Na__SceneLighting__ApplyScene(scene, options) {
        return Na__SceneLighting__Apply(Na__SceneLighting__ResolveScene(scene), options);
    }
    // ------------------------------------------------------------


    // FUNCTION | Light the Model With the Default
    // ------------------------------------------------------------
    function Na__SceneLighting__ApplyDefaults(options) {
        return Na__SceneLighting__Apply(Na__SceneLighting__Defaults, options);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Capture and Read-Back
// -----------------------------------------------------------------------------

    // FUNCTION | Write the Live Lighting Onto a Scene Record
    // ------------------------------------------------------------
    // What Update Scene and Add Scene From Camera call: the scene is lit the
    // way the viewport is lit right now, as the smallest block that says so,
    // and the key is removed when the viewport shows the default. Leaves the
    // record alone while per-scene lighting is switched off in the app config,
    // so switching it off never strips a project of its saved lighting.
    // ------------------------------------------------------------
    function Na__SceneLighting__CaptureIntoScene(scene) {
        if (!scene || typeof scene !== 'object') return false;
        if (!Na__SceneLighting__OverridesOn || !Na__SceneLighting__Live) return false;

        const block = Na__SceneLighting__BuildBlock(Na__SceneLighting__Live);
        if (block) {
            scene[Na__SceneLighting__SCENE_KEY] = block;
        } else {
            delete scene[Na__SceneLighting__SCENE_KEY];                        // <-- The default is the absent key, never a copy of it
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Short Token for a Scene's Stored Lighting, or Null
    // ------------------------------------------------------------
    // For fingerprints of pictures taken of a scene (the Layout Editor's 3D
    // viewports). Null for a scene at the default, so a picture of an unlit
    // scene keeps the key it always had.
    // ------------------------------------------------------------
    function Na__SceneLighting__SceneToken(scene) {
        if (!Na__SceneLighting__OverridesOn || !scene) return null;
        const block = scene[Na__SceneLighting__SCENE_KEY];
        if (!block || typeof block !== 'object') return null;

        const parts = [
            Na__SceneLighting__KEY__ROTATION,
            Na__SceneLighting__KEY__HEIGHT,
            Na__SceneLighting__KEY__DIRECTIONAL,
            Na__SceneLighting__KEY__AMBIENT,
            Na__SceneLighting__KEY__SHADOWS
        ]
            .filter((key) => block[key] !== undefined && block[key] !== null)
            .map((key) => key.split('__').pop() + '=' + String(block[key]));

        return parts.length > 0 ? 'light:' + parts.join(',') : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Values the Lights Stand At Now (a copy), or Null
    // ------------------------------------------------------------
    function Na__SceneLighting__GetLive() {
        return Na__SceneLighting__Live ? { ...Na__SceneLighting__Live } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Default Values (a copy), or Null
    // ------------------------------------------------------------
    function Na__SceneLighting__GetDefaults() {
        return Na__SceneLighting__Defaults ? { ...Na__SceneLighting__Defaults } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Slider Ranges (a copy), or Null
    // ------------------------------------------------------------
    function Na__SceneLighting__GetLimits() {
        return Na__SceneLighting__Limits ? { ...Na__SceneLighting__Limits } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can Scenes Carry Their Own Lighting Here?
    // ------------------------------------------------------------
    // True once the lights are registered and the app config has not switched
    // per-scene lighting off. The Dev menu hides its Lighting controls when not.
    // ------------------------------------------------------------
    function Na__SceneLighting__IsEnabled() {
        return Na__SceneLighting__OverridesOn && Boolean(Na__SceneLighting__SunLight);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Camera Flight Ease the Lighting, or Cut It at the Start?
    // ------------------------------------------------------------
    function Na__SceneLighting__IsBlendDuringFlight() {
        return Na__SceneLighting__BlendInFlight;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Per-Scene Lighting API
    // ------------------------------------------------------------
    export {
        Na__SceneLighting__SCENE_KEY,
        Na__SceneLighting__Register,
        Na__SceneLighting__Resolve,
        Na__SceneLighting__ResolveScene,
        Na__SceneLighting__BuildBlock,
        Na__SceneLighting__IsSame,
        Na__SceneLighting__Blend,
        Na__SceneLighting__Apply,
        Na__SceneLighting__ApplyScene,
        Na__SceneLighting__ApplyDefaults,
        Na__SceneLighting__CaptureIntoScene,
        Na__SceneLighting__SceneToken,
        Na__SceneLighting__GetLive,
        Na__SceneLighting__GetDefaults,
        Na__SceneLighting__GetLimits,
        Na__SceneLighting__IsEnabled,
        Na__SceneLighting__IsBlendDuringFlight
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
