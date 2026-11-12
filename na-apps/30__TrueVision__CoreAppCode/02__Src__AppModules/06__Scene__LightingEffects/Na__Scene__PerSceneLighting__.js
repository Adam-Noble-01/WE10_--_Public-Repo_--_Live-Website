// =============================================================================
// TRUEVISION3D - SCENE LIGHTING EFFECTS - PER-SCENE LIGHTING
// =============================================================================
//
// FILE       : Na__Scene__PerSceneLighting__.js
// NAMESPACE  : Na__SceneLighting
// MODULE     : Scene Lighting Effects - Per-Scene Lighting
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the live sun and fill light, their defaults, the lighting a
//              project can give its 3D view, and the override a Presentation
//              Mode scene can carry
// CREATED    : 28-Sep-2026
//
// DESCRIPTION:
// - The app has two lights, both built by Na__Scene__SetupDefaultSceneLighting:
//   an ambient fill and one directional light, the sun, which is the only light
//   that casts shadows. That module hands both to this one, and from then on
//   nothing else moves them.
// - THE APP DEFAULT IS THE APP CONFIG, NOT THIS FILE. Scene__Default__
//   LightingConfig holds both strengths, whether the sun casts shadows, and
//   where the sun sits in integer millimetres (moved out of the setup module
//   with the same values, so the default look is exactly what it was).
// - THREE LAYERS, EACH STORING ONLY WHAT IT CHANGES (v2.98.0):
//     the app default        the app config, above
//     the project's lighting its 3D view's own sun and fill, laid over the app
//                            default (SceneLighting__ProjectOverrides in the
//                            project record, read and saved by
//                            Na__Scene__ProjectLighting__, held here as values)
//     a scene's lighting     laid over the project's
//   THE BASE is what the 3D view is lit by when nothing else asks: the
//   project's lighting, or the app default when the project has none. Every
//   scene resolves over the base, so a scene that only lowers the sun keeps
//   following the project's direction.
// - DRAWINGS KEEP THE APP DEFAULT (Adam, 12-Nov-2026, asked whether a
//   project's lighting should shade its plans, elevations and sheets: "3D view
//   only"). The synthetic approach pose a drawing flight uses resolves to the
//   app default, and so does ApplyDefaults, which the Layout Editor's drawing
//   pictures call; leaving a drawing with no scene to fly to puts the base
//   back (ApplyBase, from the floor plan and elevation exits).
// - A SCENE STORES ONLY WHAT IT CHANGES. PresentationMode__Scene__Lighting on a
//   scene record holds the settings that differ from the base and nothing
//   else, so every setting a scene leaves alone keeps following the base when
//   the base is changed. No block at all is the base lighting.
//     Scene__Lighting__RotationDeg           the sun turned about the vertical
//                                            axis, clockwise seen from above; 0
//                                            is the app's default direction
//                                            (0 to 359), whatever the base
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
//   shadowIntensity }. FIELDS are what a stored block says, in the same words,
//   anything absent following the layer below (shadows as shadowsEnabled).
//   LayOver lays fields over values and Diff finds the fields that differ at
//   the precision they are stored at, so a scene block and the project's
//   record object are read and written by the same sums. Resolve turns a scene
//   block into values, BuildBlock turns values back into the smallest block
//   that reproduces them, Blend eases between two values for a camera flight
//   (the rotation takes the short way round), and Apply sets the lights.
// - Anything without a block resolves to the base: an unlit scene, a batch
//   restore point taken while the base was showing. That is what stops one
//   scene's lighting leaking into the next scene; the approach pose resolving
//   to the app default stops it leaking into a plan or elevation.
// - This module never imports the Presentation Mode system, nor the project
//   record. It knows the one key a scene record keeps its block under and the
//   flag an approach pose carries; the scene transition, the Dev menu, the
//   batch walk, the Layout Editor, the drawing thumbnail bake and the project
//   lighting module call in to it.
//
// INTEGRATION:
// - Na__Scene__SetupDefaultSceneLighting registers the lights and the three
//   config blocks (Scene__Default__LightingConfig, Scene__PerSceneLighting,
//   Scene__ProjectLighting).
// - Na__Scene__ProjectLighting__ sets the project's layer as the project loads
//   and while its Dev menu section previews a change.
// - Na__PresentationMode__Camera__SceneTransition applies a scene's lighting on
//   the instant snap and eases it over an animated flight.
// - Na__PresentationMode__DevMenu__SceneLightingRows__ previews and edits it.
// - Na__FloorPlan__ModeController__ and Na__Elevation__ModeController__ call
//   ApplyBase when a drawing hands the viewport back with no scene to fly to.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 06__Scene__LightingEffects/Na__Scene__PerSceneLighting__.js 1.1.0 (v2.98.0),
//                   first 1.0.0 (v2.71.0)
// - Ported on     : 12-Nov-2026 for TrueVision3D v2.184.0; first 28-Sep-2026 for TrueVision3D v2.161.0
// - Parity        : verbatim
// - Divergences   : Header, console prefix and the version the fallbacks name.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Nov-2026 - Version 1.1.0 (TrueVision3D v2.184.0, Project Lighting)
// - Ported whole from ValeVision3D 1.1.0 (v2.98.0), where it was written the
//   same day; its notes follow.
// - The project's own lighting as a layer between the app default and the
//   scenes: SetProjectValues, GetProjectValues, GetAppDefaults, ApplyBase,
//   ResolveOverApp, DiffFromApp, SunBearingDeg, IsProjectEnabled. GetDefaults
//   and every scene sum now mean the base; ApplyDefaults stays the app
//   default, which lights the drawings, and so does an approach pose.
// - BuildBlock compared a scene's rotation with 0, the app's default
//   direction, which is only right while the base is the app default: it now
//   compares with the base's, as every other setting always did.
// - SceneToken adds the project's lighting to a 3D picture's key, only when
//   the project has some, so every stored picture keeps its key.
//
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
    const Na__SceneLighting__APPROACH_FLAG     = 'PresentationMode__Scene__IsDrawingApproach';   // <-- The synthetic pose a plan or elevation flight uses: lit by the app default
    const Na__SceneLighting__KEY__DESCRIPTION  = 'Scene__Lighting__Description';
    const Na__SceneLighting__KEY__ROTATION     = 'Scene__Lighting__RotationDeg';
    const Na__SceneLighting__KEY__HEIGHT       = 'Scene__Lighting__HeightDeg';
    const Na__SceneLighting__KEY__DIRECTIONAL  = 'Scene__Lighting__DirectionalIntensity';
    const Na__SceneLighting__KEY__AMBIENT      = 'Scene__Lighting__AmbientIntensity';
    const Na__SceneLighting__KEY__SHADOWS      = 'Scene__Lighting__ShadowsEnabled';
    const Na__SceneLighting__BLOCK_DESCRIPTION =
        'This scene\'s own lighting. Only the settings that differ from the lighting the rest of the 3D view uses '
        + '(the project\'s own, SceneLighting__ProjectOverrides, else the app\'s default, Scene__Default__LightingConfig) '
        + 'are stored; anything absent follows it. RotationDeg turns the sun clockwise seen from above from the app\'s '
        + 'default direction; HeightDeg is its angle above the horizon.';
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
    let Na__SceneLighting__Defaults        = null;    // <-- Values the app config resolves to: the app default, which also lights every drawing
    let Na__SceneLighting__ProjectValues   = null;    // <-- The project's own lighting, complete values, or null: the base of the 3D view when set
    let Na__SceneLighting__Limits          = null;    // <-- Slider ranges: { heightMinDeg, heightMaxDeg, ambientMax, directionalMax }
    let Na__SceneLighting__SunDistance     = 0;       // <-- Default sun distance from the origin, three.js units (kept for every direction)
    let Na__SceneLighting__BaseBearingRad  = 0;       // <-- Default sun bearing, clockwise from -Z seen from above
    let Na__SceneLighting__OverridesOn     = true;    // <-- Scene__PerSceneLighting__Enabled
    let Na__SceneLighting__ProjectOn       = true;    // <-- Scene__ProjectLighting__Enabled
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
    // context: { ambientLight, directionalLight, lightingConfig, perSceneConfig,
    //            projectConfig }
    //
    // The sun is placed here, from Scene__Default__LightingConfig, and the
    // default values are set on both lights before the first frame is drawn.
    // Its distance from the origin is kept for every direction a scene turns it
    // to, because that distance is what keeps the shadow camera clear of the
    // model; only its direction shades anything. The project's own lighting
    // arrives later, with the project record (SetProjectValues).
    // ------------------------------------------------------------
    function Na__SceneLighting__Register(context) {
        const ambientLight     = context && context.ambientLight;
        const directionalLight = context && context.directionalLight;
        if (!ambientLight || !directionalLight) return false;

        const lighting = (context.lightingConfig && typeof context.lightingConfig === 'object') ? context.lightingConfig : {};
        const perScene = (context.perSceneConfig && typeof context.perSceneConfig === 'object') ? context.perSceneConfig : {};
        const project  = (context.projectConfig  && typeof context.projectConfig  === 'object') ? context.projectConfig  : {};


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
        Na__SceneLighting__ProjectOn     = project.Scene__ProjectLighting__Enabled !== false;
        Na__SceneLighting__BlendInFlight = perScene.Scene__PerSceneLighting__BlendDuringFlight !== false;


        // TAKE THE LIGHTS AND SHOW THE DEFAULT
        // ------------------------------------
        Na__SceneLighting__AmbientLight  = ambientLight;
        Na__SceneLighting__SunLight      = directionalLight;
        Na__SceneLighting__ProjectValues = null;                              // <-- No project yet: the base is the app default
        Na__SceneLighting__Live          = null;                              // <-- Forces the first Apply to set every light property
        Na__SceneLighting__Apply(Na__SceneLighting__Defaults, { requestRender : false });

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Values - Resolve, Build, Compare, Blend
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Base: What the 3D View Is Lit By When Nothing Else Asks
    // ------------------------------------------------------------
    // The project's own lighting while it has some and the app config has not
    // switched project lighting off, else the app default. Null only before
    // the lights are registered. Not a copy: callers copy before changing it.
    // ------------------------------------------------------------
    function Na__SceneLighting__Base() {
        if (Na__SceneLighting__ProjectOn && Na__SceneLighting__ProjectValues) return Na__SceneLighting__ProjectValues;
        return Na__SceneLighting__Defaults;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay Stored Fields Over Complete Values
    // ------------------------------------------------------------
    // fields: { rotationDeg, heightDeg, directionalIntensity, ambientIntensity,
    // shadowsEnabled }, any of them absent or null to follow the values below.
    // Out-of-range numbers are clamped to the slider ranges rather than
    // refused, so a hand-edited project still loads lit. Returns a new object.
    // ------------------------------------------------------------
    function Na__SceneLighting__LayOver(below, fields) {
        const values = { ...below };
        if (!fields || typeof fields !== 'object') return values;

        const limits = Na__SceneLighting__Limits;
        const rotation    = Na__SceneLighting__Num(fields.rotationDeg, null);
        const height      = Na__SceneLighting__Num(fields.heightDeg, null);
        const directional = Na__SceneLighting__Num(fields.directionalIntensity, null);
        const ambient     = Na__SceneLighting__Num(fields.ambientIntensity, null);
        const shadows     = fields.shadowsEnabled;

        if (rotation    !== null) values.rotationDeg          = Na__SceneLighting__WrapDeg(rotation);
        if (height      !== null) values.heightDeg            = Na__SceneLighting__Clamp(height, limits.heightMinDeg, limits.heightMaxDeg);
        if (directional !== null) values.directionalIntensity = Na__SceneLighting__Clamp(directional, 0, limits.directionalMax);
        if (ambient     !== null) values.ambientIntensity     = Na__SceneLighting__Clamp(ambient, 0, limits.ambientMax);
        if (typeof shadows === 'boolean') values.shadowIntensity = shadows ? 1 : 0;

        return values;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fields in Which Values Differ From the Values Below
    // ------------------------------------------------------------
    // A setting counts only when it differs at the precision it is stored at -
    // whole degrees, strengths to two places, the shadows as on or off - and
    // is given at that precision. The rotation is compared with the one below
    // too, not with 0: below may be the project's lighting, turned already.
    // Returns null when nothing differs.
    // ------------------------------------------------------------
    function Na__SceneLighting__Diff(values, below) {
        if (!values || !below) return null;

        const fields = {};

        const rotation = Math.round(Na__SceneLighting__WrapDeg(Na__SceneLighting__Num(values.rotationDeg, below.rotationDeg))) % 360;
        if (rotation !== Math.round(Na__SceneLighting__WrapDeg(below.rotationDeg)) % 360) fields.rotationDeg = rotation;

        const height = Math.round(Na__SceneLighting__Num(values.heightDeg, below.heightDeg));
        if (height !== Math.round(below.heightDeg)) fields.heightDeg = height;

        const directional = Na__SceneLighting__Round2(Na__SceneLighting__Num(values.directionalIntensity, below.directionalIntensity));
        if (directional !== Na__SceneLighting__Round2(below.directionalIntensity)) fields.directionalIntensity = directional;

        const ambient = Na__SceneLighting__Round2(Na__SceneLighting__Num(values.ambientIntensity, below.ambientIntensity));
        if (ambient !== Na__SceneLighting__Round2(below.ambientIntensity)) fields.ambientIntensity = ambient;

        const shadowsOn = Na__SceneLighting__Num(values.shadowIntensity, below.shadowIntensity) >= 0.5;
        if (shadowsOn !== (below.shadowIntensity >= 0.5)) fields.shadowsEnabled = shadowsOn;

        return Object.keys(fields).length > 0 ? fields : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve a Stored Scene Block Into Complete Values
    // ------------------------------------------------------------
    // The base, with whatever the block holds laid over it. A missing block, a
    // block that is not an object, or per-scene lighting switched off in the
    // app config, all give the plain base. Returns null only before the
    // lights are registered.
    // ------------------------------------------------------------
    function Na__SceneLighting__Resolve(block) {
        const base = Na__SceneLighting__Base();
        if (!base) return null;
        if (!Na__SceneLighting__OverridesOn || !block || typeof block !== 'object') return { ...base };

        return Na__SceneLighting__LayOver(base, {
            rotationDeg          : block[Na__SceneLighting__KEY__ROTATION],
            heightDeg            : block[Na__SceneLighting__KEY__HEIGHT],
            directionalIntensity : block[Na__SceneLighting__KEY__DIRECTIONAL],
            ambientIntensity     : block[Na__SceneLighting__KEY__AMBIENT],
            shadowsEnabled       : block[Na__SceneLighting__KEY__SHADOWS]
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Lighting a Scene Record Asks For
    // ------------------------------------------------------------
    // The synthetic approach pose a floor plan or elevation flight uses is lit
    // by the app default, whatever the project's lighting: a drawing keeps the
    // app's look on every project (Adam, 12-Nov-2026: "3D view only"), and the
    // flight eases the lights there as the camera rises to it.
    // ------------------------------------------------------------
    function Na__SceneLighting__ResolveScene(scene) {
        if (scene && scene[Na__SceneLighting__APPROACH_FLAG] === true) {
            return Na__SceneLighting__Defaults ? { ...Na__SceneLighting__Defaults } : null;
        }
        return Na__SceneLighting__Resolve(scene ? scene[Na__SceneLighting__SCENE_KEY] : null);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Smallest Scene Block That Reproduces These Values
    // ------------------------------------------------------------
    // A setting is written only when it differs from the base at the precision
    // it is stored at (Diff). Returns null when nothing differs, which callers
    // treat as "delete the key": a scene at the base carries no block, so it
    // keeps following the base when the base is changed. The keys are written
    // in one fixed order, so two blocks compare fairly as JSON.
    // ------------------------------------------------------------
    function Na__SceneLighting__BuildBlock(values) {
        const fields = Na__SceneLighting__Diff(values, Na__SceneLighting__Base());
        if (!fields) return null;

        const block = { [Na__SceneLighting__KEY__DESCRIPTION] : Na__SceneLighting__BLOCK_DESCRIPTION };
        if (fields.rotationDeg          !== undefined) block[Na__SceneLighting__KEY__ROTATION]    = fields.rotationDeg;
        if (fields.heightDeg            !== undefined) block[Na__SceneLighting__KEY__HEIGHT]      = fields.heightDeg;
        if (fields.directionalIntensity !== undefined) block[Na__SceneLighting__KEY__DIRECTIONAL] = fields.directionalIntensity;
        if (fields.ambientIntensity     !== undefined) block[Na__SceneLighting__KEY__AMBIENT]     = fields.ambientIntensity;
        if (fields.shadowsEnabled       !== undefined) block[Na__SceneLighting__KEY__SHADOWS]     = fields.shadowsEnabled;
        return block;
    }
    // ------------------------------------------------------------


    // FUNCTION | The App Default With Fields Laid Over It (the Project's Sums)
    // ------------------------------------------------------------
    // What the project lighting module turns its record object into. Returns
    // null only before the lights are registered.
    // ------------------------------------------------------------
    function Na__SceneLighting__ResolveOverApp(fields) {
        if (!Na__SceneLighting__Defaults) return null;
        return Na__SceneLighting__LayOver(Na__SceneLighting__Defaults, fields);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Fields in Which Values Differ From the App Default, or Null
    // ------------------------------------------------------------
    // What the project lighting module builds its record object from: the
    // same precision a scene block is stored at.
    // ------------------------------------------------------------
    function Na__SceneLighting__DiffFromApp(values) {
        return Na__SceneLighting__Diff(values, Na__SceneLighting__Defaults);
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


    // FUNCTION | Light the Model With the App Default (How Every Drawing Is Lit)
    // ------------------------------------------------------------
    // The app config's lighting, never the project's: the Layout Editor calls
    // this before every plan and elevation picture, so a drawing looks the
    // same on every project (Adam, 12-Nov-2026: "3D view only").
    // ------------------------------------------------------------
    function Na__SceneLighting__ApplyDefaults(options) {
        return Na__SceneLighting__Apply(Na__SceneLighting__Defaults, options);
    }
    // ------------------------------------------------------------


    // FUNCTION | Light the Model With the Base (How the 3D View Is Lit)
    // ------------------------------------------------------------
    // The project's own lighting, or the app default when it has none. Called
    // as the project loads, while its Dev menu section previews a change, and
    // when a drawing hands the viewport back with no scene to fly to.
    // ------------------------------------------------------------
    function Na__SceneLighting__ApplyBase(options) {
        return Na__SceneLighting__Apply(Na__SceneLighting__Base(), options);
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
    // and the key is removed when the viewport shows the base (the project's
    // lighting, else the app default). Leaves the record alone while per-scene
    // lighting is switched off in the app config, so switching it off never
    // strips a project of its saved lighting.
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


    // HELPER FUNCTION | A Short Token for the Project's Own Lighting, or Null
    // ------------------------------------------------------------
    // The fields it differs from the app default by, at stored precision. Null
    // with no project lighting, or with project lighting switched off.
    // ------------------------------------------------------------
    function Na__SceneLighting__ProjectToken() {
        if (!Na__SceneLighting__ProjectOn || !Na__SceneLighting__ProjectValues) return null;
        const fields = Na__SceneLighting__Diff(Na__SceneLighting__ProjectValues, Na__SceneLighting__Defaults);
        if (!fields) return null;
        return 'project:' + Object.keys(fields).map((key) => key + '=' + String(fields[key])).join(',');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Short Token for a Scene's Stored Lighting, or Null
    // ------------------------------------------------------------
    // For fingerprints of pictures taken of a scene (the Layout Editor's 3D
    // viewports). A scene's picture is lit by its own block over the base, so
    // the token carries the project's lighting too, once the project has
    // some: a relit project re-renders its 3D pictures. Null for a scene at
    // the app default on a project without its own lighting, and the token a
    // lit scene always had there, so every stored picture keeps its key.
    // ------------------------------------------------------------
    function Na__SceneLighting__SceneToken(scene) {
        if (!scene) return null;

        let own = null;
        const block = scene[Na__SceneLighting__SCENE_KEY];
        if (Na__SceneLighting__OverridesOn && block && typeof block === 'object') {
            const parts = [
                Na__SceneLighting__KEY__ROTATION,
                Na__SceneLighting__KEY__HEIGHT,
                Na__SceneLighting__KEY__DIRECTIONAL,
                Na__SceneLighting__KEY__AMBIENT,
                Na__SceneLighting__KEY__SHADOWS
            ]
                .filter((key) => block[key] !== undefined && block[key] !== null)
                .map((key) => key.split('__').pop() + '=' + String(block[key]));
            if (parts.length > 0) own = 'light:' + parts.join(',');
        }

        const project = Na__SceneLighting__ProjectToken();
        if (!project) return own;                                             // <-- Exactly the key it had before projects could be lit
        return (own ? own + ';' : 'light:') + project;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Values the Lights Stand At Now (a copy), or Null
    // ------------------------------------------------------------
    function Na__SceneLighting__GetLive() {
        return Na__SceneLighting__Live ? { ...Na__SceneLighting__Live } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Default a Scene Follows (a copy), or Null
    // ------------------------------------------------------------
    // The base: the project's own lighting, or the app default when it has
    // none. What a scene's Use Default and a double-clicked slider go back to.
    // ------------------------------------------------------------
    function Na__SceneLighting__GetDefaults() {
        const base = Na__SceneLighting__Base();
        return base ? { ...base } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The App Default (a copy), or Null
    // ------------------------------------------------------------
    function Na__SceneLighting__GetAppDefaults() {
        return Na__SceneLighting__Defaults ? { ...Na__SceneLighting__Defaults } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project's Own Lighting (a copy), or Null When It Has None
    // ------------------------------------------------------------
    function Na__SceneLighting__GetProjectValues() {
        if (!Na__SceneLighting__ProjectOn || !Na__SceneLighting__ProjectValues) return null;
        return { ...Na__SceneLighting__ProjectValues };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Sun Is for These Values, Clockwise From -Z (Degrees)
    // ------------------------------------------------------------
    // The model bearing, as the North Direction system measures one: 0 is
    // SketchUp's green axis. Null before the lights are registered.
    // ------------------------------------------------------------
    function Na__SceneLighting__SunBearingDeg(values) {
        if (!Na__SceneLighting__Defaults || !values) return null;
        const rotation = Na__SceneLighting__Num(values.rotationDeg, 0);
        return Na__SceneLighting__WrapDeg(Na__SceneLighting__BaseBearingRad * Na__SceneLighting__RAD_TO_DEG + rotation);
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


    // FUNCTION | Can a Project Light Its Own 3D View Here?
    // ------------------------------------------------------------
    // True once the lights are registered and the app config has not switched
    // project lighting off (Scene__ProjectLighting__Enabled). The Dev menu
    // hides its Project Lighting section when not.
    // ------------------------------------------------------------
    function Na__SceneLighting__IsProjectEnabled() {
        return Na__SceneLighting__ProjectOn && Boolean(Na__SceneLighting__SunLight);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Project's Layer
// -----------------------------------------------------------------------------

    // FUNCTION | Set the Project's Own Lighting (Null for None)
    // ------------------------------------------------------------
    // values: complete values (Na__SceneLighting__ResolveOverApp makes them
    // from the record object), or null. Values that do not differ from the app
    // default at stored precision count as none, so a project put back to the
    // default carries no layer and its 3D pictures keep their old keys.
    // Changes the base and nothing else: the lights stand where they are
    // until somebody applies something (ApplyBase, a scene, a flight).
    // Returns false before the lights are registered, or while the app config
    // has project lighting switched off.
    // ------------------------------------------------------------
    function Na__SceneLighting__SetProjectValues(values) {
        if (!Na__SceneLighting__Defaults || !Na__SceneLighting__ProjectOn) return false;
        const differs = values && typeof values === 'object' && Na__SceneLighting__Diff(values, Na__SceneLighting__Defaults) !== null;
        Na__SceneLighting__ProjectValues = differs ? Na__SceneLighting__Sanitise(values) : null;
        return true;
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
        Na__SceneLighting__ResolveOverApp,
        Na__SceneLighting__DiffFromApp,
        Na__SceneLighting__IsSame,
        Na__SceneLighting__Blend,
        Na__SceneLighting__Apply,
        Na__SceneLighting__ApplyScene,
        Na__SceneLighting__ApplyDefaults,
        Na__SceneLighting__ApplyBase,
        Na__SceneLighting__CaptureIntoScene,
        Na__SceneLighting__SceneToken,
        Na__SceneLighting__GetLive,
        Na__SceneLighting__GetDefaults,
        Na__SceneLighting__GetAppDefaults,
        Na__SceneLighting__GetProjectValues,
        Na__SceneLighting__SetProjectValues,
        Na__SceneLighting__SunBearingDeg,
        Na__SceneLighting__GetLimits,
        Na__SceneLighting__IsEnabled,
        Na__SceneLighting__IsProjectEnabled,
        Na__SceneLighting__IsBlendDuringFlight
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
