// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - CONFIG STATE
// =============================================================================
//
// FILE       : Na__Elevation__ConfigState__.js
// NAMESPACE  : Na__ElevCfg
// MODULE     : Elevation Views - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the elevation config fetch and expose every tuned value
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__Elevation__AppConfig__.json exactly once and exposes the
//   direction presets, the drawing plane range, the gizmo appearance, the
//   orthographic camera setup, navigation feel, transition timings, scene
//   group targeting and all Dev menu wording.
// - Distances are integer millimetres in the JSON by house rule. Getters that
//   feed Three.js return scene units; getters that feed number inputs return
//   millimetres. The suffix on each function name says which.
// - Every value has a built-in fallback matching the shipped JSON, so a failed
//   fetch degrades to correct behaviour rather than a broken elevation mode.
// - Pure config. No DOM, no Three.js objects, no project data.
//
// - Deliberately a SIBLING of Na__FloorPlan__ConfigState__ rather than a shared
//   base. The two systems tune independently - an elevation wants a different
//   framing margin and a different stand-off from a plan - and a shared config
//   reader would have to grow a block-name parameter to serve both, which buys
//   nothing and hides which file a value actually came from.
//
// INTEGRATION:
// - Na__Elevation__ModeController__ awaits Na__ElevCfg__Load() during app init;
//   every other elevation module reads through these getters rather than
//   touching the JSON.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
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
    const Na__ElevCfg__ConfigUrl    = new URL('./Na__Elevation__AppConfig__.json', import.meta.url);
    const Na__ElevCfg__DIR_BLOCK    = 'ElevationViews__Direction__Config';
    const Na__ElevCfg__PLANE_BLOCK  = 'ElevationViews__Plane__Config';
    const Na__ElevCfg__GIZMO_BLOCK  = 'ElevationViews__Gizmo__Config';
    const Na__ElevCfg__CAMERA_BLOCK = 'ElevationViews__Camera__Config';
    const Na__ElevCfg__NAV_BLOCK    = 'ElevationViews__Navigation__Config';
    const Na__ElevCfg__TRANS_BLOCK  = 'ElevationViews__Transition__Config';
    const Na__ElevCfg__GROUP_BLOCK  = 'ElevationViews__SceneGroup__Config';
    const Na__ElevCfg__LABELS_BLOCK = 'ElevationViews__Labels__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__ElevCfg__FALLBACKS = Object.freeze({
        azimuthDefault  : 0,
        azimuthStep     : 5,
        presets         : [
            { Preset__Label: 'North', Preset__AzimuthDeg: 0 },
            { Preset__Label: 'East',  Preset__AzimuthDeg: 90 },
            { Preset__Label: 'South', Preset__AzimuthDeg: 180 },
            { Preset__Label: 'West',  Preset__AzimuthDeg: 270 }
        ],
        originXMm       : 0,
        originZMm       : 0,
        originMinMm     : -60000,
        originMaxMm     : 60000,
        originStepMm    : 50,
        viewDepthMm     : null,
        viewDepthMaxMm  : 100000,
        gizmoMarginMm   : 3000,
        gizmoFill       : '#2e7d4f',
        gizmoFillAlpha  : 0.07,
        gizmoEdge       : '#2e7d4f',
        gizmoArrow      : '#2e7d4f',
        gizmoArrowMm    : 2500,
        gizmoCutFace    : '#c0392b',
        gizmoCutAlpha   : 0.14,
        camStandOffMm   : 150000,
        camNearMm       : 10,
        camFarMm        : 500000,
        camMarginMm     : 2000,
        camDefaultZoom  : 1.0,
        camMinZoom      : 0.1,
        camMaxZoom      : 20.0,
        zoomStepFactor  : 1.12,
        intoMs          : 1400,
        outOfMs         : 1400,
        betweenMs       : 0,
        easing          : 'easeInOutCubic',
        targetGroupName : 'Elevations',
        targetGroupId   : 'Group_005'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__ElevCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__ElevCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__ElevCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__ElevCfg__Config) return fallback;
        const block = Na__ElevCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined) ? fallback : value;                         // <-- null is a MEANINGFUL value here (infinite view depth)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Numeric Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__ElevCfg__Num(blockKey, valueKey, fallback) {
        const value = Na__ElevCfg__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__ElevCfg__Fetch() {
        try {
            const response = await fetch(Na__ElevCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Elevation config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__ElevCfg__Config = await response.json();
            return Na__ElevCfg__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] Elevation config unreadable - using built-in defaults.', error);
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
    function Na__ElevCfg__Load() {
        if (!Na__ElevCfg__LoadPromise) Na__ElevCfg__LoadPromise = Na__ElevCfg__Fetch();
        return Na__ElevCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Elevation System Switched On?
    // ------------------------------------------------------------
    function Na__ElevCfg__IsEnabled() {
        if (!Na__ElevCfg__Config) return false;                                  // <-- No config means no elevation authoring UI
        return Na__ElevCfg__Config.ElevationViews__Enabled === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Direction and Drawing Plane (millimetres)
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Azimuth Default and Step
    // ------------------------------------------------------------
    function Na__ElevCfg__GetDirectionSetup() {
        return {
            defaultDeg : Na__ElevCfg__Num(Na__ElevCfg__DIR_BLOCK, 'ElevationViews__Direction__DefaultAzimuthDeg', Na__ElevCfg__FALLBACKS.azimuthDefault),
            stepDeg    : Na__ElevCfg__Num(Na__ElevCfg__DIR_BLOCK, 'ElevationViews__Direction__StepDeg',           Na__ElevCfg__FALLBACKS.azimuthStep)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Compass Presets as { label, azimuthDeg } Pairs
    // ------------------------------------------------------------
    // Flattened out of the config's verbose key names here so no consumer has
    // to know them. A malformed list falls back whole rather than per entry -
    // half a compass would be worse than the shipped one.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetDirectionPresets() {
        const raw = Na__ElevCfg__Val(Na__ElevCfg__DIR_BLOCK, 'ElevationViews__Direction__Presets', null);
        const list = Array.isArray(raw) && raw.length > 0 ? raw : Na__ElevCfg__FALLBACKS.presets;

        return list
            .filter((entry) => entry && Number.isFinite(entry.Preset__AzimuthDeg))
            .map((entry) => ({
                label      : String(entry.Preset__Label || ''),
                azimuthDeg : entry.Preset__AzimuthDeg
            }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Drawing Plane Origin Range and Defaults
    // ------------------------------------------------------------
    // The X and Z the author moves the plane with. Both share one range,
    // because a plane that can travel further in one world axis than the other
    // would behave differently on a north elevation than on an east one.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetPlaneOriginRangeMm() {
        return {
            defaultXMm : Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__DefaultOriginXMm', Na__ElevCfg__FALLBACKS.originXMm),
            defaultZMm : Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__DefaultOriginZMm', Na__ElevCfg__FALLBACKS.originZMm),
            minMm      : Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__OriginMinMm',      Na__ElevCfg__FALLBACKS.originMinMm),
            maxMm      : Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__OriginMaxMm',      Na__ElevCfg__FALLBACKS.originMaxMm),
            stepMm     : Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__OriginStepMm',     Na__ElevCfg__FALLBACKS.originStepMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Default View Depth (null = infinite cut backward)
    // ------------------------------------------------------------
    function Na__ElevCfg__GetDefaultViewDepthMm() {
        const value = Na__ElevCfg__Val(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__ViewDepthDefaultMm', Na__ElevCfg__FALLBACKS.viewDepthMm);
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the View Depth Input Ceiling
    // ------------------------------------------------------------
    function Na__ElevCfg__GetViewDepthMaxMm() {
        return Na__ElevCfg__Num(Na__ElevCfg__PLANE_BLOCK, 'ElevationViews__Plane__ViewDepthMaxMm', Na__ElevCfg__FALLBACKS.viewDepthMaxMm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Gizmo Appearance
// -----------------------------------------------------------------------------

    // FUNCTION | Get the 3D Setup Marker's Appearance
    // ------------------------------------------------------------
    // Distances come back in scene units because the gizmo is real geometry;
    // colours come back as strings for THREE.Color to parse.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetGizmoSetup() {
        return {
            marginUnits      : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__MarginMm',      Na__ElevCfg__FALLBACKS.gizmoMarginMm)),
            arrowLengthUnits : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__ArrowLengthMm', Na__ElevCfg__FALLBACKS.gizmoArrowMm)),
            fillColour       : Na__ElevCfg__Val(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__FillColour',     Na__ElevCfg__FALLBACKS.gizmoFill),
            fillOpacity      : Na__ElevCfg__Num(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__FillOpacity',    Na__ElevCfg__FALLBACKS.gizmoFillAlpha),
            edgeColour       : Na__ElevCfg__Val(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__EdgeColour',     Na__ElevCfg__FALLBACKS.gizmoEdge),
            arrowColour      : Na__ElevCfg__Val(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__ArrowColour',    Na__ElevCfg__FALLBACKS.gizmoArrow),
            cutFaceColour    : Na__ElevCfg__Val(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__CutFaceColour',  Na__ElevCfg__FALLBACKS.gizmoCutFace),
            cutFaceOpacity   : Na__ElevCfg__Num(Na__ElevCfg__GIZMO_BLOCK, 'ElevationViews__Gizmo__CutFaceOpacity', Na__ElevCfg__FALLBACKS.gizmoCutAlpha)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Orthographic Camera and Navigation
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Elevation Camera Setup, Distances Already in Scene Units
    // ------------------------------------------------------------
    function Na__ElevCfg__GetCameraSetup() {
        return {
            standOffUnits : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__StandOffMm',       Na__ElevCfg__FALLBACKS.camStandOffMm)),
            nearUnits     : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__NearMm',           Na__ElevCfg__FALLBACKS.camNearMm)),
            farUnits      : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__FarMm',            Na__ElevCfg__FALLBACKS.camFarMm)),
            marginUnits   : Na__Math__ConvertMmToUnits(Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__FramingMarginMm',  Na__ElevCfg__FALLBACKS.camMarginMm)),
            defaultZoom   : Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__DefaultZoom', Na__ElevCfg__FALLBACKS.camDefaultZoom),
            minZoom       : Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__MinZoom',     Na__ElevCfg__FALLBACKS.camMinZoom),
            maxZoom       : Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__MaxZoom',     Na__ElevCfg__FALLBACKS.camMaxZoom)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Stand-Off Distance in Millimetres
    // ------------------------------------------------------------
    // Wanted in millimetres by the scene camera block, which stores integer
    // millimetre poses like every other saved scene.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetStandOffMm() {
        return Na__ElevCfg__Num(Na__ElevCfg__CAMERA_BLOCK, 'ElevationViews__Camera__StandOffMm', Na__ElevCfg__FALLBACKS.camStandOffMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Pan and Zoom Feel
    // ------------------------------------------------------------
    function Na__ElevCfg__GetNavigationSetup() {
        return {
            zoomStepFactor   : Na__ElevCfg__Num(Na__ElevCfg__NAV_BLOCK, 'ElevationViews__Navigation__ZoomStepFactor', Na__ElevCfg__FALLBACKS.zoomStepFactor),
            invertWheel      : Na__ElevCfg__Val(Na__ElevCfg__NAV_BLOCK, 'ElevationViews__Navigation__InvertWheel', false) === true,
            panButton        : Na__ElevCfg__Num(Na__ElevCfg__NAV_BLOCK, 'ElevationViews__Navigation__PanButton', 0),
            enableTouchPan   : Na__ElevCfg__Val(Na__ElevCfg__NAV_BLOCK, 'ElevationViews__Navigation__EnableTouchPan', true) !== false,
            enableTouchPinch : Na__ElevCfg__Val(Na__ElevCfg__NAV_BLOCK, 'ElevationViews__Navigation__EnableTouchPinchZoom', true) !== false
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Transitions, Scene Group and Labels
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Transition Timings
    // ------------------------------------------------------------
    // betweenElevationsMs of 0 means an instant flip between two elevations,
    // which is the intended behaviour rather than a missing value.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetTransitionSetup() {
        return {
            intoMs    : Na__ElevCfg__Num(Na__ElevCfg__TRANS_BLOCK, 'ElevationViews__Transition__IntoElevationMs',    Na__ElevCfg__FALLBACKS.intoMs),
            outOfMs   : Na__ElevCfg__Num(Na__ElevCfg__TRANS_BLOCK, 'ElevationViews__Transition__OutOfElevationMs',   Na__ElevCfg__FALLBACKS.outOfMs),
            betweenMs : Na__ElevCfg__Num(Na__ElevCfg__TRANS_BLOCK, 'ElevationViews__Transition__BetweenElevationsMs', Na__ElevCfg__FALLBACKS.betweenMs),
            easing    : Na__ElevCfg__Val(Na__ElevCfg__TRANS_BLOCK, 'ElevationViews__Transition__Easing',              Na__ElevCfg__FALLBACKS.easing)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Target Scene Group for New Elevation Scenes
    // ------------------------------------------------------------
    function Na__ElevCfg__GetSceneGroupTarget() {
        return {
            groupName  : Na__ElevCfg__Val(Na__ElevCfg__GROUP_BLOCK, 'ElevationViews__SceneGroup__TargetGroupName', Na__ElevCfg__FALLBACKS.targetGroupName),
            groupId    : Na__ElevCfg__Val(Na__ElevCfg__GROUP_BLOCK, 'ElevationViews__SceneGroup__TargetGroupId',   Na__ElevCfg__FALLBACKS.targetGroupId),
            autoEnable : Na__ElevCfg__Val(Na__ElevCfg__GROUP_BLOCK, 'ElevationViews__SceneGroup__AutoEnableTargetGroup', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Dev Menu Label by Key Suffix
    // ------------------------------------------------------------
    function Na__ElevCfg__GetLabel(keySuffix, fallback) {
        const value = Na__ElevCfg__Val(Na__ElevCfg__LABELS_BLOCK, 'ElevationViews__Labels__' + keySuffix, fallback);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Substitute {token} Placeholders in a Label
    // ------------------------------------------------------------
    function Na__ElevCfg__FormatLabel(keySuffix, fallback, tokens) {
        let text = Na__ElevCfg__GetLabel(keySuffix, fallback);
        if (tokens && typeof tokens === 'object') {
            Object.keys(tokens).forEach((token) => {
                text = text.split('{' + token + '}').join(String(tokens[token]));
            });
        }
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------



    // FUNCTION | Get the Face Pick Setup (D16)
    // ------------------------------------------------------------
    // The click threshold is in PIXELS and matters: picking a wall is a click,
    // not a drag, and without a threshold every tiny mouse tremble during the
    // press reads as an orbit and the pick never fires.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetFacePickSetup() {
        return {
            clickThresholdPx : Na__ElevCfg__Num('ElevationViews__FacePick__Config', 'ElevationViews__FacePick__ClickThresholdPx', 4),
            cursor           : Na__ElevCfg__Val('ElevationViews__FacePick__Config', 'ElevationViews__FacePick__Cursor', 'crosshair')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Gizmo Grip Setup (D16)
    // ------------------------------------------------------------
    // Dragging the plane recomputes the cut, which is the expensive part, so the
    // drag is throttled rather than run per pointer event.
    // ------------------------------------------------------------
    function Na__ElevCfg__GetGripSetup() {
        return {
            dragRecomputeMs : Na__ElevCfg__Num('ElevationViews__Grip__Config', 'ElevationViews__Grip__DragRecomputeMs', 90)
        };
    }
    // ------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Config State API
    // ------------------------------------------------------------
    export {
        Na__ElevCfg__GetFacePickSetup,
        Na__ElevCfg__GetGripSetup,
        Na__ElevCfg__Load,
        Na__ElevCfg__IsEnabled,
        Na__ElevCfg__GetDirectionSetup,
        Na__ElevCfg__GetDirectionPresets,
        Na__ElevCfg__GetPlaneOriginRangeMm,
        Na__ElevCfg__GetDefaultViewDepthMm,
        Na__ElevCfg__GetViewDepthMaxMm,
        Na__ElevCfg__GetGizmoSetup,
        Na__ElevCfg__GetCameraSetup,
        Na__ElevCfg__GetStandOffMm,
        Na__ElevCfg__GetNavigationSetup,
        Na__ElevCfg__GetTransitionSetup,
        Na__ElevCfg__GetSceneGroupTarget,
        Na__ElevCfg__GetLabel,
        Na__ElevCfg__FormatLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
