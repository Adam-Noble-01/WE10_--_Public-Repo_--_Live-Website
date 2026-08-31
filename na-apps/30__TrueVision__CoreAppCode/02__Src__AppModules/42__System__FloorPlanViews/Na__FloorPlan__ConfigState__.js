// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - CONFIG STATE
// =============================================================================
//
// FILE       : Na__FloorPlan__ConfigState__.js
// NAMESPACE  : Na__FpCfg
// MODULE     : Floor Plan Views - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the floor plan config fetch and expose every tuned value
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Fetches Na__FloorPlan__AppConfig__.json exactly once and exposes the datum
//   slider range, cut offset, orthographic camera setup, navigation feel,
//   transition timings, scene group targeting and all Dev menu wording.
// - Distances are integer millimetres in the JSON by house rule. Getters that
//   feed Three.js return scene units; getters that feed number inputs return
//   millimetres. The suffix on each function name says which.
// - Every value has a built-in fallback matching the shipped JSON, so a failed
//   fetch degrades to correct behaviour rather than a broken plan mode.
// - Pure config. No DOM, no Three.js objects, no project data.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ awaits Na__FpCfg__Load() during app init;
//   every other floor plan module reads through these getters rather than
//   touching the JSON.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__FpCfg__ConfigUrl      = new URL('./Na__FloorPlan__AppConfig__.json', import.meta.url);
    const Na__FpCfg__DATUM_BLOCK    = 'FloorPlanViews__Datum__Config';
    const Na__FpCfg__CAMERA_BLOCK   = 'FloorPlanViews__Camera__Config';
    const Na__FpCfg__NAV_BLOCK      = 'FloorPlanViews__Navigation__Config';
    const Na__FpCfg__TRANS_BLOCK    = 'FloorPlanViews__Transition__Config';
    const Na__FpCfg__GROUP_BLOCK    = 'FloorPlanViews__SceneGroup__Config';
    const Na__FpCfg__LABELS_BLOCK   = 'FloorPlanViews__Labels__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__FpCfg__FALLBACKS = Object.freeze({
        datumDefaultMm      : 0,
        datumMinMm          : -5000,
        datumMaxMm          : 20000,
        datumStepMm         : 50,
        cutOffsetMm         : 1200,
        cutOffsetMinMm      : 100,
        cutOffsetMaxMm      : 3000,
        viewDepthMm         : null,
        camHeightMm         : 100,
        camNearMm           : 10,
        camFarMm            : 500000,
        camMarginMm         : 2000,
        camDefaultZoom      : 1.0,
        camMinZoom          : 0.1,
        camMaxZoom          : 20.0,
        zoomStepFactor      : 1.12,
        intoPlanMs          : 1400,
        outOfPlanMs         : 1400,
        betweenPlansMs      : 0,
        easing              : 'easeInOutCubic',
        annotationFadeMs    : 220,
        targetGroupName     : 'Floor Plans',
        targetGroupId       : 'Group_004'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__FpCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__FpCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__FpCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__FpCfg__Config) return fallback;
        const block = Na__FpCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined) ? fallback : value;                         // <-- null is a MEANINGFUL value here (infinite view depth)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Numeric Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__FpCfg__Num(blockKey, valueKey, fallback) {
        const value = Na__FpCfg__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__FpCfg__Fetch() {
        try {
            const response = await fetch(Na__FpCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Floor plan config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__FpCfg__Config = await response.json();
            return Na__FpCfg__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] Floor plan config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading and Feature Gate
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Config Exactly Once
    // ------------------------------------------------------------
    function Na__FpCfg__Load() {
        if (!Na__FpCfg__LoadPromise) Na__FpCfg__LoadPromise = Na__FpCfg__Fetch();
        return Na__FpCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Floor Plan System Switched On?
    // ------------------------------------------------------------
    function Na__FpCfg__IsEnabled() {
        if (!Na__FpCfg__Config) return false;                                    // <-- No config means no plan authoring UI
        return Na__FpCfg__Config.FloorPlanViews__Enabled === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Datum and Cut Values (millimetres)
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Datum Slider Range and Default
    // ------------------------------------------------------------
    function Na__FpCfg__GetDatumRangeMm() {
        return {
            defaultMm : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__DefaultMm', Na__FpCfg__FALLBACKS.datumDefaultMm),
            minMm     : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__MinMm',     Na__FpCfg__FALLBACKS.datumMinMm),
            maxMm     : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__MaxMm',     Na__FpCfg__FALLBACKS.datumMaxMm),
            stepMm    : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__StepMm',    Na__FpCfg__FALLBACKS.datumStepMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Cut Offset Above the Floor Datum
    // ------------------------------------------------------------
    // The default is the standard architectural cut height. A plan set at
    // datum 0 with this offset slices the walls, not the slab.
    // ------------------------------------------------------------
    function Na__FpCfg__GetCutOffsetMm() {
        return {
            defaultMm : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__CutOffsetAboveDatumMm', Na__FpCfg__FALLBACKS.cutOffsetMm),
            minMm     : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__CutOffsetMinMm',        Na__FpCfg__FALLBACKS.cutOffsetMinMm),
            maxMm     : Na__FpCfg__Num(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__CutOffsetMaxMm',        Na__FpCfg__FALLBACKS.cutOffsetMaxMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Default View Depth (null = infinite cut downward)
    // ------------------------------------------------------------
    function Na__FpCfg__GetDefaultViewDepthMm() {
        const value = Na__FpCfg__Val(Na__FpCfg__DATUM_BLOCK, 'FloorPlanViews__Datum__ViewDepthDefaultMm', Na__FpCfg__FALLBACKS.viewDepthMm);
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Orthographic Camera
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Plan Camera Setup, Distances Already in Scene Units
    // ------------------------------------------------------------
    function Na__FpCfg__GetCameraSetup() {
        return {
            heightAboveCutUnits : Na__Math__ConvertMmToUnits(Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__HeightAboveCutMm', Na__FpCfg__FALLBACKS.camHeightMm)),
            nearUnits           : Na__Math__ConvertMmToUnits(Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__NearMm',          Na__FpCfg__FALLBACKS.camNearMm)),
            farUnits            : Na__Math__ConvertMmToUnits(Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__FarMm',           Na__FpCfg__FALLBACKS.camFarMm)),
            marginUnits         : Na__Math__ConvertMmToUnits(Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__FramingMarginMm', Na__FpCfg__FALLBACKS.camMarginMm)),
            defaultZoom         : Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__DefaultZoom', Na__FpCfg__FALLBACKS.camDefaultZoom),
            minZoom             : Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__MinZoom',     Na__FpCfg__FALLBACKS.camMinZoom),
            maxZoom             : Na__FpCfg__Num(Na__FpCfg__CAMERA_BLOCK, 'FloorPlanViews__Camera__MaxZoom',     Na__FpCfg__FALLBACKS.camMaxZoom)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Pan and Zoom Feel
    // ------------------------------------------------------------
    function Na__FpCfg__GetNavigationSetup() {
        return {
            zoomStepFactor      : Na__FpCfg__Num(Na__FpCfg__NAV_BLOCK, 'FloorPlanViews__Navigation__ZoomStepFactor', Na__FpCfg__FALLBACKS.zoomStepFactor),
            invertWheel         : Na__FpCfg__Val(Na__FpCfg__NAV_BLOCK, 'FloorPlanViews__Navigation__InvertWheel', false) === true,
            panButton           : Na__FpCfg__Num(Na__FpCfg__NAV_BLOCK, 'FloorPlanViews__Navigation__PanButton', 0),
            enableTouchPan      : Na__FpCfg__Val(Na__FpCfg__NAV_BLOCK, 'FloorPlanViews__Navigation__EnableTouchPan', true) !== false,
            enableTouchPinch    : Na__FpCfg__Val(Na__FpCfg__NAV_BLOCK, 'FloorPlanViews__Navigation__EnableTouchPinchZoom', true) !== false
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Transitions, Scene Group and Labels
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Transition Timings
    // ------------------------------------------------------------
    // betweenPlansMs of 0 means an instant flip between two plans, which is
    // the intended behaviour rather than a missing value.
    // ------------------------------------------------------------
    function Na__FpCfg__GetTransitionSetup() {
        return {
            intoPlanMs       : Na__FpCfg__Num(Na__FpCfg__TRANS_BLOCK, 'FloorPlanViews__Transition__IntoPlanMs',        Na__FpCfg__FALLBACKS.intoPlanMs),
            outOfPlanMs      : Na__FpCfg__Num(Na__FpCfg__TRANS_BLOCK, 'FloorPlanViews__Transition__OutOfPlanMs',       Na__FpCfg__FALLBACKS.outOfPlanMs),
            betweenPlansMs   : Na__FpCfg__Num(Na__FpCfg__TRANS_BLOCK, 'FloorPlanViews__Transition__BetweenPlansMs',    Na__FpCfg__FALLBACKS.betweenPlansMs),
            easing           : Na__FpCfg__Val(Na__FpCfg__TRANS_BLOCK, 'FloorPlanViews__Transition__Easing',            Na__FpCfg__FALLBACKS.easing),
            annotationFadeMs : Na__FpCfg__Num(Na__FpCfg__TRANS_BLOCK, 'FloorPlanViews__Transition__AnnotationFadeMs',  Na__FpCfg__FALLBACKS.annotationFadeMs)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Target Scene Group for New Floor Plan Scenes
    // ------------------------------------------------------------
    function Na__FpCfg__GetSceneGroupTarget() {
        return {
            groupName  : Na__FpCfg__Val(Na__FpCfg__GROUP_BLOCK, 'FloorPlanViews__SceneGroup__TargetGroupName', Na__FpCfg__FALLBACKS.targetGroupName),
            groupId    : Na__FpCfg__Val(Na__FpCfg__GROUP_BLOCK, 'FloorPlanViews__SceneGroup__TargetGroupId',   Na__FpCfg__FALLBACKS.targetGroupId),
            autoEnable : Na__FpCfg__Val(Na__FpCfg__GROUP_BLOCK, 'FloorPlanViews__SceneGroup__AutoEnableTargetGroup', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Dev Menu Label by Key Suffix
    // ------------------------------------------------------------
    function Na__FpCfg__GetLabel(keySuffix, fallback) {
        const value = Na__FpCfg__Val(Na__FpCfg__LABELS_BLOCK, 'FloorPlanViews__Labels__' + keySuffix, fallback);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Substitute {token} Placeholders in a Label
    // ------------------------------------------------------------
    function Na__FpCfg__FormatLabel(keySuffix, fallback, tokens) {
        let text = Na__FpCfg__GetLabel(keySuffix, fallback);
        if (tokens && typeof tokens === 'object') {
            Object.keys(tokens).forEach((token) => {
                text = text.split('{' + token + '}').join(String(tokens[token]));
            });
        }
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Config State API
    // ------------------------------------------------------------
    export {
        Na__FpCfg__Load,
        Na__FpCfg__IsEnabled,
        Na__FpCfg__GetDatumRangeMm,
        Na__FpCfg__GetCutOffsetMm,
        Na__FpCfg__GetDefaultViewDepthMm,
        Na__FpCfg__GetCameraSetup,
        Na__FpCfg__GetNavigationSetup,
        Na__FpCfg__GetTransitionSetup,
        Na__FpCfg__GetSceneGroupTarget,
        Na__FpCfg__GetLabel,
        Na__FpCfg__FormatLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
