// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - CAMERA SCENE TRANSITION
// =============================================================================
//
// FILE       : Na__PresentationMode__Camera__SceneTransition.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Camera Scene Transition
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Capture, build, apply and animate the camera between saved
//              Presentation Mode scenes using the project data camera format
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Reuses the existing unit conversion helpers (mm / 1000) to stay in sync
//   with all other camera systems.
// - CaptureCurrentSceneState reads the live camera/controls into a scene-
//   compatible JSON structure (integer mm positions, 4dp rotation/FOV).
// - ApplySceneCameraState performs an instant snap to the saved values.
// - AnimateToScene interpolates position (lerp), orbit target (lerp), FOV
//   (lerp) and orientation (quaternion slerp) per-frame using requestAnima-
//   tionFrame, driven by Na__RenderLoop__RequestActiveRender so the render
//   loop is active only while transitioning.
// - Easing functions: linear, easeInOutQuad, easeInOutCubic (default).
// - Any new AnimateToScene call cancels an in-flight transition first.
//
// INTEGRATION:
// - Imported by Na__PresentationMode__UI__SceneCarousel.js (clicks).
// - Camera and controls references are passed in at call time.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the Presentation Mode transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion Helpers
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import {
        Na__RenderLoop__RequestActiveRender,
        Na__RenderLoop__StopActiveRender,
        Na__RenderLoop__RequestRender
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Render Active Reason Tag
    // ------------------------------------------------------------
    const Na__PresentationMode__RENDER_REASON    = 'presentation-transition';  // <-- Reason tag for active render loop
    const Na__PresentationMode__DEFAULT_DURATION = 1800;                       // <-- Default transition duration ms
    const Na__PresentationMode__DEFAULT_EASING   = 'easeInOutCubic';          // <-- Default easing function name
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | In-Flight Transition State
    // ------------------------------------------------------------
    let Na__PresentationMode__TransitionId        = 0;      // <-- Incremented per transition; used to cancel stale ones
    let Na__PresentationMode__IsTransitioning     = false;  // <-- Guards against overlapping transitions
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Easing Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Linear Easing
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__EaseLinear(t) {
        return t; // <-- No easing, constant velocity
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ease In-Out Quadratic
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__EaseInOutQuad(t) {
        return t < 0.5
            ? 2 * t * t                                     // <-- Ease in (accelerate)
            : 1 - Math.pow(-2 * t + 2, 2) / 2;             // <-- Ease out (decelerate)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ease In-Out Cubic
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__EaseInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t                                 // <-- Ease in (accelerate)
            : 1 - Math.pow(-2 * t + 2, 3) / 2;             // <-- Ease out (decelerate)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Easing Function by Name String
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__ResolveEasing(easingName) {
        switch (easingName) {
            case 'linear':          return Na__PresentationMode__Camera__EaseLinear;
            case 'easeInOutQuad':   return Na__PresentationMode__Camera__EaseInOutQuad;
            case 'easeInOutCubic':
            default:                return Na__PresentationMode__Camera__EaseInOutCubic; // <-- Default fallback
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene State Capture and Build
// -----------------------------------------------------------------------------

    // FUNCTION | Capture Current Camera State as a Scene-Compatible Object
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__CaptureCurrentSceneState(camera, controls) {
        if (!camera) return null;

        const posX = Math.round(Na__Math__ConvertUnitsToMm(camera.position.x));  // <-- Convert to integer mm
        const posY = Math.round(Na__Math__ConvertUnitsToMm(camera.position.y));
        const posZ = Math.round(Na__Math__ConvertUnitsToMm(camera.position.z));

        const rotX = parseFloat(camera.rotation.x.toFixed(4));                   // <-- 4dp radians
        const rotY = parseFloat(camera.rotation.y.toFixed(4));
        const rotZ = parseFloat(camera.rotation.z.toFixed(4));

        const fov  = parseFloat(camera.fov.toFixed(4));                          // <-- 4dp degrees

        return {
            Camera__DefaultPos      : {
                Camera__DefaultPos__PosX : posX,
                Camera__DefaultPos__PosY : posY,
                Camera__DefaultPos__PosZ : posZ
            },
            Camera__DefaultRotation : {
                Camera__DefaultRotation__RotX : rotX,
                Camera__DefaultRotation__RotY : rotY,
                Camera__DefaultRotation__RotZ : rotZ
            },
            Camera__DefaultMisc     : {
                Camera__DefaultMisc__Fov : fov
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Full Scene Camera JSON Blocks (for project data insertion)
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__BuildSceneCameraJson(camera, controls) {
        const cameraPosition = Na__PresentationMode__Camera__CaptureCurrentSceneState(camera, controls);
        if (!cameraPosition) return null;

        const targetX = controls ? Math.round(Na__Math__ConvertUnitsToMm(controls.target.x)) : 0;
        const targetY = controls ? Math.round(Na__Math__ConvertUnitsToMm(controls.target.y)) : 0;
        const targetZ = controls ? Math.round(Na__Math__ConvertUnitsToMm(controls.target.z)) : 0;

        const orbitHelperCubePosition = {
            OrbitHelperCube__Position__Description : 'Scene orbit target position. Values are integer millimetres; convert to 3D units in code.',
            OrbitHelperCube__Position__PosX        : targetX,
            OrbitHelperCube__Position__PosY        : targetY,
            OrbitHelperCube__Position__PosZ        : targetZ
        };

        return { cameraPosition, orbitHelperCubePosition };  // <-- Two-block return ready for scene JSON
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene State Application (Instant)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Runtime Camera Values from Scene CameraPosition Block
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__ParseSceneToRuntimeValues(scene) {
        const cam    = scene.PresentationMode__Scene__CameraPosition;
        const orbit  = scene.PresentationMode__Scene__OrbitHelperCubePosition;

        if (!cam) return null;

        const pos = cam.Camera__DefaultPos        || {};
        const rot = cam.Camera__DefaultRotation   || {};
        const misc = cam.Camera__DefaultMisc      || {};

        return {
            position : {
                x : Na__Math__ConvertMmToUnits(pos.Camera__DefaultPos__PosX  || 0),
                y : Na__Math__ConvertMmToUnits(pos.Camera__DefaultPos__PosY  || 0),
                z : Na__Math__ConvertMmToUnits(pos.Camera__DefaultPos__PosZ  || 0)
            },
            rotation : {
                x : Number.isFinite(rot.Camera__DefaultRotation__RotX) ? rot.Camera__DefaultRotation__RotX : 0,
                y : Number.isFinite(rot.Camera__DefaultRotation__RotY) ? rot.Camera__DefaultRotation__RotY : 0,
                z : Number.isFinite(rot.Camera__DefaultRotation__RotZ) ? rot.Camera__DefaultRotation__RotZ : 0
            },
            fov : Number.isFinite(misc.Camera__DefaultMisc__Fov) ? misc.Camera__DefaultMisc__Fov : null,
            target : orbit ? {
                x : Na__Math__ConvertMmToUnits(orbit.OrbitHelperCube__Position__PosX || 0),
                y : Na__Math__ConvertMmToUnits(orbit.OrbitHelperCube__Position__PosY || 0),
                z : Na__Math__ConvertMmToUnits(orbit.OrbitHelperCube__Position__PosZ || 0)
            } : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Instantly Apply Scene Camera State (no animation)
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__ApplySceneCameraState(camera, controls, scene) {
        if (!camera || !scene) return;

        const values = Na__PresentationMode__Camera__ParseSceneToRuntimeValues(scene);
        if (!values) return;

        camera.position.set(values.position.x, values.position.y, values.position.z);  // <-- Snap position
        camera.rotation.set(values.rotation.x, values.rotation.y, values.rotation.z);  // <-- Snap rotation

        if (values.fov !== null) {
            camera.fov = values.fov;
            camera.updateProjectionMatrix();                                             // <-- Rebuild projection after FOV change
        }

        if (controls && values.target) {
            controls.target.set(values.target.x, values.target.y, values.target.z);    // <-- Snap orbit target
            controls.update();
        }

        Na__RenderLoop__RequestRender();                                                 // <-- Single frame redraw
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Camera Animation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Cancel Any Currently Running Transition
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__CancelCurrentTransition() {
        Na__PresentationMode__TransitionId++;                                // <-- Invalidates any running rAF loop
        if (Na__PresentationMode__IsTransitioning) {
            Na__RenderLoop__StopActiveRender(Na__PresentationMode__RENDER_REASON);
            Na__PresentationMode__IsTransitioning = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Animate Camera to a Saved Scene
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__AnimateToScene(camera, controls, scene, options) {
        if (!camera || !scene) return;

        const values = Na__PresentationMode__Camera__ParseSceneToRuntimeValues(scene);
        if (!values) {
            Na__PresentationMode__Camera__ApplySceneCameraState(camera, controls, scene); // <-- Instant fallback if parse fails
            return;
        }

        // RESOLVE TRANSITION PARAMETERS
        const opts        = options || {};
        const rawDuration = opts.durationMs
            ?? scene.PresentationMode__Scene__TransitionTimeToNextSceneMs
            ?? Na__PresentationMode__DEFAULT_DURATION;
        const durationMs  = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : Na__PresentationMode__DEFAULT_DURATION;
        const easingName  = opts.easing ?? scene.PresentationMode__Scene__TransitionEasing ?? Na__PresentationMode__DEFAULT_EASING;
        const easeFn      = Na__PresentationMode__Camera__ResolveEasing(easingName);
        const onComplete  = typeof opts.onComplete === 'function' ? opts.onComplete : null;

        // CANCEL ANY IN-FLIGHT TRANSITION FIRST
        Na__PresentationMode__Camera__CancelCurrentTransition();
        const myTransitionId = Na__PresentationMode__TransitionId;            // <-- Snapshot id for this transition

        // CAPTURE START STATE FROM LIVE CAMERA
        const startPos     = camera.position.clone();
        const startTarget  = controls ? controls.target.clone() : new THREE.Vector3();
        const startFov     = camera.fov;

        const startQuat    = new THREE.Quaternion().setFromEuler(camera.rotation);

        const endRotation  = new THREE.Euler(values.rotation.x, values.rotation.y, values.rotation.z, camera.rotation.order);
        const endQuat      = new THREE.Quaternion().setFromEuler(endRotation);

        const endPos       = new THREE.Vector3(values.position.x, values.position.y, values.position.z);
        const endTarget    = values.target ? new THREE.Vector3(values.target.x, values.target.y, values.target.z) : startTarget.clone();
        const endFov       = values.fov !== null ? values.fov : startFov;

        const tempQuat     = new THREE.Quaternion();                          // <-- Reused scratch quaternion

        // BEGIN ACTIVE RENDERING
        Na__PresentationMode__IsTransitioning = true;
        Na__RenderLoop__RequestActiveRender(Na__PresentationMode__RENDER_REASON);

        const startTime    = performance.now();

        // PER-FRAME INTERPOLATION LOOP
        function Na__PresentationMode__Camera__AnimationTick() {
            if (Na__PresentationMode__TransitionId !== myTransitionId) return; // <-- Cancelled - exit silently

            const elapsed  = performance.now() - startTime;
            const rawT     = Math.min(elapsed / durationMs, 1);               // <-- Clamp 0-1
            const t        = easeFn(rawT);                                    // <-- Apply easing

            camera.position.lerpVectors(startPos, endPos, t);

            tempQuat.slerpQuaternions(startQuat, endQuat, t);
            camera.setRotationFromQuaternion(tempQuat);                       // <-- Apply slerped rotation

            const interpFov = startFov + (endFov - startFov) * t;
            camera.fov = interpFov;
            camera.updateProjectionMatrix();                                  // <-- Rebuild projection each frame

            if (controls) {
                controls.target.lerpVectors(startTarget, endTarget, t);
                controls.update();
            }

            if (rawT < 1) {
                requestAnimationFrame(Na__PresentationMode__Camera__AnimationTick); // <-- Continue loop
            } else {
                camera.position.copy(endPos);
                camera.setRotationFromQuaternion(endQuat);
                camera.fov = endFov;
                camera.updateProjectionMatrix();

                if (controls) {
                    controls.target.copy(endTarget);
                    controls.update();
                }

                Na__RenderLoop__StopActiveRender(Na__PresentationMode__RENDER_REASON); // <-- Stop continuous rendering
                Na__PresentationMode__IsTransitioning = false;
                Na__RenderLoop__RequestRender();                              // <-- One final clean frame

                if (onComplete) onComplete();                                 // <-- Notify caller
            }
        }

        requestAnimationFrame(Na__PresentationMode__Camera__AnimationTick);  // <-- Kick off animation
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Whether a Transition Is Currently Running
    // ------------------------------------------------------------
    function Na__PresentationMode__Camera__IsTransitioning() {
        return Na__PresentationMode__IsTransitioning; // <-- Public read-only state check
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Camera Scene Transition API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__Camera__CaptureCurrentSceneState,
        Na__PresentationMode__Camera__BuildSceneCameraJson,
        Na__PresentationMode__Camera__ApplySceneCameraState,
        Na__PresentationMode__Camera__AnimateToScene,
        Na__PresentationMode__Camera__CancelCurrentTransition,
        Na__PresentationMode__Camera__IsTransitioning
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
