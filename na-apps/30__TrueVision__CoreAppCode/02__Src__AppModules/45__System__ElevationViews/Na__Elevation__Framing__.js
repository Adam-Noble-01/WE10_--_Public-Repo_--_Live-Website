// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - MODEL FRAMING
// =============================================================================
//
// FILE       : Na__Elevation__Framing__.js
// NAMESPACE  : Na__ElevFrame
// MODULE     : Elevation Views - Model Framing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Measure the model once and derive every elevation camera pose from it
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Three separate places need the same two answers - where is the middle of
//   the building as this elevation sees it, and how far back does a
//   perspective camera have to stand to frame it. This module is the single
//   place both are worked out, so an elevation scene's stored pose, the flight
//   into elevation mode and the Dev menu preview can never disagree about
//   where "in front of this facade" is.
// - The span ACROSS an elevation is not simply the bounding box's X or Z size.
//   It is the box projected onto the elevation's right axis, which for an
//   axis-aligned box is |rx| * halfX + |rz| * halfZ. At the four compass
//   presets that collapses to exactly one of the two spans; in between it
//   grows the way the diagonal actually does, so a 45 degree elevation still
//   frames the whole building rather than clipping its corners.
// - The approach distance is solved from the perspective camera's own field of
//   view and aspect, taking whichever of span or height needs the greater
//   distance, so the perspective view roughly matches what the orthographic
//   view will show. That match is what stops the projection swap from jumping.
// - Also builds the scene-shaped pose object the presentation camera
//   transition animates toward, so elevation flights reuse the carousel's
//   easing rather than carrying a second animation implementation.
// - All outputs are millimetres, matching how poses are stored in project JSON.
//
// INTEGRATION:
// - Na__Elevation__ModeController__ for the flight in and out.
// - Na__Elevation__DevMenu__Editor__ and Na__Elevation__SceneLink__ for the
//   camera block written into an elevation's scene.
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

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Config and Derived Geometry
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__ElevCfg__GetCameraSetup } from './Na__Elevation__ConfigState__.js';
    import { Na__ElevData__GetAxes } from './Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks and Conversions
    // ------------------------------------------------------------
    const Na__ElevFrame__MM_PER_UNIT     = 1000;      // <-- Three.js scene units are metres
    const Na__ElevFrame__FALLBACK_FOV    = 30;        // <-- Used when no camera is supplied
    const Na__ElevFrame__FALLBACK_STANDBACK = 25000;  // <-- Approach distance in mm when the model cannot be measured
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scratch Object for Exact Look-At Rotation
    // ------------------------------------------------------------
    // Solving the Euler angles by hand for an arbitrary azimuth is easy to get
    // subtly wrong at the quadrant boundaries. Letting Three.js do the lookAt
    // on a throwaway object and reading the result back is exact by
    // construction, and this runs a handful of times per session.
    // ------------------------------------------------------------
    const Na__ElevFrame__ScratchObject = new THREE.Object3D();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Measurement
// -----------------------------------------------------------------------------

    // FUNCTION | Measure the Model as One Elevation Sees It
    // ------------------------------------------------------------
    // Returns null when nothing is loaded, which every caller treats as
    // "cannot frame yet" rather than guessing at a position.
    // ------------------------------------------------------------
    function Na__ElevFrame__MeasureModel(modelRoot, perspectiveCamera, elevation) {
        if (!modelRoot) return null;

        const box = new THREE.Box3().setFromObject(modelRoot);
        if (box.isEmpty()) return null;

        const centre = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const axes   = Na__ElevData__GetAxes(elevation);

        const fov    = perspectiveCamera ? perspectiveCamera.fov : Na__ElevFrame__FALLBACK_FOV;
        const aspect = (perspectiveCamera && perspectiveCamera.aspect) ? perspectiveCamera.aspect : 1;
        const margin = Na__ElevCfg__GetCameraSetup().marginUnits;

        // Half-span across the facade, and half its height.
        const halfSpan = (Math.abs(axes.rightX) * (size.x / 2))
                       + (Math.abs(axes.rightZ) * (size.z / 2))
                       + margin;
        const halfTall = (size.y / 2) + margin;

        // Distance needed to frame the facade head on. Height is limited by
        // the vertical field of view, span by the horizontal one, so the
        // larger of the two is what actually fits the building.
        const halfFovTan  = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
        const distForTall = halfTall / halfFovTan;
        const distForSpan = halfSpan / (halfFovTan * aspect);

        return {
            centreXMm  : centre.x * Na__ElevFrame__MM_PER_UNIT,
            centreYMm  : centre.y * Na__ElevFrame__MM_PER_UNIT,
            centreZMm  : centre.z * Na__ElevFrame__MM_PER_UNIT,
            centreRunMm : ((centre.x * axes.rightX) + (centre.z * axes.rightZ)) * Na__ElevFrame__MM_PER_UNIT,
            spanMm     : halfSpan * 2 * Na__ElevFrame__MM_PER_UNIT,
            heightMm   : halfTall * 2 * Na__ElevFrame__MM_PER_UNIT,
            approachMm : Math.max(distForTall, distForSpan) * Na__ElevFrame__MM_PER_UNIT,
            bounds     : box,
            fovDegrees : fov
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Model Bounding Box Alone
    // ------------------------------------------------------------
    function Na__ElevFrame__GetBounds(modelRoot) {
        if (!modelRoot) return null;
        const box = new THREE.Box3().setFromObject(modelRoot);
        return box.isEmpty() ? null : box;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Drawing Plane Should Sit to Centre on the Model
    // ------------------------------------------------------------
    // The plane origin that puts the cut through the middle of the building
    // along this elevation's view axis. Used by the Dev menu's Centre button,
    // which is the sane starting point for a section - and, for a plain
    // elevation, a plane that visibly runs through the model rather than one
    // stranded at the world origin.
    // ------------------------------------------------------------
    function Na__ElevFrame__GetCentredPlaneOriginMm(measurement) {
        if (!measurement) return null;
        return {
            xMm : Math.round(measurement.centreXMm),
            zMm : Math.round(measurement.centreZMm)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Pose Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Solve the Camera Rotation That Faces the Model
    // ------------------------------------------------------------
    function Na__ElevFrame__SolveLookRotation(fromXMm, fromYMm, fromZMm, atXMm, atYMm, atZMm) {
        Na__ElevFrame__ScratchObject.position.set(
            fromXMm / Na__ElevFrame__MM_PER_UNIT,
            fromYMm / Na__ElevFrame__MM_PER_UNIT,
            fromZMm / Na__ElevFrame__MM_PER_UNIT
        );
        Na__ElevFrame__ScratchObject.up.set(0, 1, 0);
        Na__ElevFrame__ScratchObject.lookAt(
            atXMm / Na__ElevFrame__MM_PER_UNIT,
            atYMm / Na__ElevFrame__MM_PER_UNIT,
            atZMm / Na__ElevFrame__MM_PER_UNIT
        );

        const rotation = Na__ElevFrame__ScratchObject.rotation;
        return { rotX: rotation.x, rotY: rotation.y, rotZ: rotation.z };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Head-On Camera Block for an Elevation
    // ------------------------------------------------------------
    // Structurally an ordinary scene camera block, in millimetres. An
    // elevation scene MUST carry one: the presentation scene validator rejects
    // a scene without finite camera coordinates, so an elevation without it
    // would be silently filtered out of the carousel and never appear.
    //
    // The camera stands back along the view axis from the MODEL CENTRE rather
    // than from the drawing plane, because where you stand to look at a facade
    // has nothing to do with how deep the section is cut.
    // ------------------------------------------------------------
    function Na__ElevFrame__BuildCameraBlock(elevation, measurement, fovDegrees) {
        const axes = Na__ElevData__GetAxes(elevation);

        const centreXMm = (measurement && Number.isFinite(measurement.centreXMm)) ? measurement.centreXMm : 0;
        const centreYMm = (measurement && Number.isFinite(measurement.centreYMm)) ? measurement.centreYMm : 0;
        const centreZMm = (measurement && Number.isFinite(measurement.centreZMm)) ? measurement.centreZMm : 0;
        const standBack = (measurement && Number.isFinite(measurement.approachMm))
            ? measurement.approachMm
            : Na__ElevFrame__FALLBACK_STANDBACK;

        const fov = Number.isFinite(fovDegrees)
            ? fovDegrees
            : ((measurement && measurement.fovDegrees) || Na__ElevFrame__FALLBACK_FOV);

        const eyeXMm = centreXMm + (axes.normalX * standBack);
        const eyeZMm = centreZMm + (axes.normalZ * standBack);
        const look   = Na__ElevFrame__SolveLookRotation(
            eyeXMm, centreYMm, eyeZMm,
            centreXMm, centreYMm, centreZMm
        );

        return {
            camera : {
                Camera__DefaultPos : {
                    Camera__DefaultPos__PosX : Math.round(eyeXMm),
                    Camera__DefaultPos__PosY : Math.round(centreYMm),
                    Camera__DefaultPos__PosZ : Math.round(eyeZMm)
                },
                Camera__DefaultRotation : {
                    Camera__DefaultRotation__RotX : look.rotX,
                    Camera__DefaultRotation__RotY : look.rotY,
                    Camera__DefaultRotation__RotZ : look.rotZ
                },
                Camera__DefaultMisc : {
                    Camera__DefaultMisc__Fov : fov
                }
            },
            orbit : {
                OrbitHelperCube__Position__Description : 'Elevation view centre. Values are integer millimetres; convert to 3D units in code.',
                OrbitHelperCube__Position__PosX : Math.round(centreXMm),
                OrbitHelperCube__Position__PosY : Math.round(centreYMm),
                OrbitHelperCube__Position__PosZ : Math.round(centreZMm)
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Scene-Shaped Head-On Pose for the Camera Transition
    // ------------------------------------------------------------
    // The presentation camera transition animates toward a scene object, so
    // the flight into and out of elevation mode is expressed as one. Reusing
    // that transition means elevation flights feel identical to scene flights
    // and to floor plan flights.
    // ------------------------------------------------------------
    function Na__ElevFrame__BuildApproachScene(elevation, measurement, fovDegrees, durationMs, easing) {
        const built = Na__ElevFrame__BuildCameraBlock(elevation, measurement, fovDegrees);

        return {
            PresentationMode__Scene__Id   : 'ElevationApproach',
            PresentationMode__Scene__Name : 'Elevation Approach',
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

    // MODULE EXPORTS | Elevation Framing API
    // ------------------------------------------------------------
    export {
        Na__ElevFrame__MeasureModel,
        Na__ElevFrame__GetBounds,
        Na__ElevFrame__GetCentredPlaneOriginMm,
        Na__ElevFrame__BuildCameraBlock,
        Na__ElevFrame__BuildApproachScene
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
