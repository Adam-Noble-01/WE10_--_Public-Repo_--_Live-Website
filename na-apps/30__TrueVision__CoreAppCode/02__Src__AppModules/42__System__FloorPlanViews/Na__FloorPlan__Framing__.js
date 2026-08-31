// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - MODEL FRAMING
// =============================================================================
//
// FILE       : Na__FloorPlan__Framing__.js
// NAMESPACE  : Na__FpFrame
// MODULE     : Floor Plan Views - Model Framing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Measure the model once and derive every top-down camera pose from it
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Three separate places needed the same two answers - where is the middle of
//   the model, and how high does a perspective camera have to sit to frame it
//   from above. This module is the single place both are worked out, so a plan
//   scene's stored pose, the flight into plan mode and the Dev menu preview can
//   never disagree about where "above the building" is.
// - The approach height is solved from the perspective camera's own field of
//   view and aspect, taking whichever of width or depth needs the greater
//   distance, so the perspective view roughly matches what the orthographic
//   view will show. That match is what stops the projection swap from jumping.
// - Also builds the scene-shaped top-down pose object the presentation camera
//   transition animates toward, so plan flights reuse the carousel's easing
//   rather than carrying a second animation implementation.
// - All outputs are millimetres, matching how poses are stored in project JSON.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ for the flight in and out.
// - Na__FloorPlan__DevMenu__Editor__ and Na__FloorPlan__SceneLink__ for the
//   camera block written into a floor plan's scene.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder. Extracted from the mode
//   controller and dev editor, which had each grown their own copy.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Floor Plan Config and Cut Height
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ConfigState__.js
    // @delegate: ./Na__FloorPlan__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__FpCfg__GetCameraSetup } from './Na__FloorPlan__ConfigState__.js';
    import { Na__FpData__GetCutHeightMm } from './Na__FloorPlan__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks and Conversions
    // ------------------------------------------------------------
    const Na__FpFrame__MM_PER_UNIT      = 1000;      // <-- Three.js scene units are metres
    const Na__FpFrame__FALLBACK_FOV     = 30;        // <-- Used when no camera is supplied
    const Na__FpFrame__FALLBACK_HEIGHT  = 20000;     // <-- Approach height in mm when the model cannot be measured
    const Na__FpFrame__LOOK_DOWN_ROT_X  = -Math.PI / 2;  // <-- Camera rotation that looks straight down
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Measurement
// -----------------------------------------------------------------------------

    // FUNCTION | Measure the Model's Centre and Top-Down Approach Height
    // ------------------------------------------------------------
    // Returns null when nothing is loaded, which every caller treats as
    // "cannot frame yet" rather than guessing at a position.
    // ------------------------------------------------------------
    function Na__FpFrame__MeasureModel(modelRoot, perspectiveCamera) {
        if (!modelRoot) return null;

        const box = new THREE.Box3().setFromObject(modelRoot);
        if (box.isEmpty()) return null;

        const centre = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());

        const fov    = perspectiveCamera ? perspectiveCamera.fov : Na__FpFrame__FALLBACK_FOV;
        const aspect = (perspectiveCamera && perspectiveCamera.aspect) ? perspectiveCamera.aspect : 1;
        const margin = Na__FpCfg__GetCameraSetup().marginUnits;

        // Distance needed to frame the footprint from directly overhead. Depth
        // is limited by the vertical field of view, width by the horizontal
        // one, so the larger of the two is what actually fits the building.
        const halfFovTan   = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
        const distForDepth = ((size.z / 2) + margin) / halfFovTan;
        const distForWidth = ((size.x / 2) + margin) / (halfFovTan * aspect);

        return {
            centreXMm  : centre.x * Na__FpFrame__MM_PER_UNIT,
            centreZMm  : centre.z * Na__FpFrame__MM_PER_UNIT,
            approachMm : Math.max(distForDepth, distForWidth) * Na__FpFrame__MM_PER_UNIT,
            bounds     : box,
            fovDegrees : fov
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Model Bounding Box Alone
    // ------------------------------------------------------------
    function Na__FpFrame__GetBounds(modelRoot) {
        if (!modelRoot) return null;
        const box = new THREE.Box3().setFromObject(modelRoot);
        return box.isEmpty() ? null : box;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Pose Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Top-Down Camera Block for a Floor Plan
    // ------------------------------------------------------------
    // Structurally an ordinary scene camera block, in millimetres. A floor plan
    // scene MUST carry one: the presentation scene validator rejects a scene
    // without finite camera coordinates, so a plan without it would be silently
    // filtered out of the carousel and never appear.
    // ------------------------------------------------------------
    function Na__FpFrame__BuildCameraBlock(plan, measurement, fovDegrees) {
        const cutMm = Na__FpData__GetCutHeightMm(plan);

        const centreXMm = (measurement && Number.isFinite(measurement.centreXMm)) ? measurement.centreXMm : 0;
        const centreZMm = (measurement && Number.isFinite(measurement.centreZMm)) ? measurement.centreZMm : 0;
        const approach  = (measurement && Number.isFinite(measurement.approachMm))
            ? measurement.approachMm
            : Na__FpFrame__FALLBACK_HEIGHT;

        const fov = Number.isFinite(fovDegrees)
            ? fovDegrees
            : ((measurement && measurement.fovDegrees) || Na__FpFrame__FALLBACK_FOV);

        return {
            camera : {
                Camera__DefaultPos : {
                    Camera__DefaultPos__PosX : Math.round(centreXMm),
                    Camera__DefaultPos__PosY : Math.round(cutMm + approach),
                    Camera__DefaultPos__PosZ : Math.round(centreZMm)
                },
                Camera__DefaultRotation : {
                    Camera__DefaultRotation__RotX : Na__FpFrame__LOOK_DOWN_ROT_X,
                    Camera__DefaultRotation__RotY : 0,
                    Camera__DefaultRotation__RotZ : 0
                },
                Camera__DefaultMisc : {
                    Camera__DefaultMisc__Fov : fov
                }
            },
            orbit : {
                OrbitHelperCube__Position__Description : 'Floor plan cut centre. Values are integer millimetres; convert to 3D units in code.',
                OrbitHelperCube__Position__PosX : Math.round(centreXMm),
                OrbitHelperCube__Position__PosY : Math.round(cutMm),
                OrbitHelperCube__Position__PosZ : Math.round(centreZMm)
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Scene-Shaped Top-Down Pose for the Camera Transition
    // ------------------------------------------------------------
    // The presentation camera transition animates toward a scene object, so
    // the flight into and out of plan mode is expressed as one. Reusing that
    // transition means plan flights feel identical to scene flights.
    // ------------------------------------------------------------
    function Na__FpFrame__BuildTopDownScene(plan, measurement, fovDegrees, durationMs, easing) {
        const built = Na__FpFrame__BuildCameraBlock(plan, measurement, fovDegrees);

        return {
            PresentationMode__Scene__Id   : 'FloorPlanApproach',
            PresentationMode__Scene__Name : 'Floor Plan Approach',
            PresentationMode__Scene__TransitionTimeToNextSceneMs : durationMs,
            PresentationMode__Scene__TransitionEasing            : easing,
            PresentationMode__Scene__CameraPosition              : built.camera,
            PresentationMode__Scene__OrbitHelperCubePosition     : built.orbit
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Plan Framing API
    // ------------------------------------------------------------
    export {
        Na__FpFrame__MeasureModel,
        Na__FpFrame__GetBounds,
        Na__FpFrame__BuildCameraBlock,
        Na__FpFrame__BuildTopDownScene
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
