// =============================================================================
// TRUEVISION3D - CAMERA PROJECT START STATE
// =============================================================================
//
// FILE       : Na__Camera__ProjectStartState.js
// NAMESPACE  : Na__CameraStartState
// MODULE     : Camera Project Start State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Canonical reset state for the Reset View navigation control
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Stores the canonical camera starting state captured by the loading
//   sequence immediately after the project camera config and orbit target
//   have been applied.
// - Holds BOTH the raw project Camera__DefaultPosition block (authoritative
//   source) AND an applied snapshot of the camera/controls (guaranteed-valid
//   fallback when no project config exists).
// - Na__CameraStartState__ResetView restores position, rotation, FOV and
//   orbit target exactly as loaded - never a hard-coded generic location.
// - Reset always lands in Orbit mode; callers must exit Walk/Fly first
//   (the navigation toolbar routes through the 'return-to-orbit' toggles
//   before invoking the reset).
//
// INTEGRATION:
// - Call Na__CameraStartState__CaptureStartState(camera, controls, config)
//   from Na__AppFlow__LoadingSequence.js after the saved camera re-apply.
// - Call Na__CameraStartState__ResetView() from the navigation toolbar.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the navigation toolbar transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Camera Config Application Helper
    // ------------------------------------------------------------
    import { Na__UiFeature__ApplyCameraConfig } from '../11__CameraUtils/Na__UiFeature__CameraPosition__Controls.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Captured Scene References and Start State
    // ------------------------------------------------------------
    let Na__CameraStartState__Camera        = null;   // <-- Camera instance captured at load time
    let Na__CameraStartState__Controls      = null;   // <-- Orbit controls instance captured at load time
    let Na__CameraStartState__ProjectConfig = null;   // <-- Raw project Camera__DefaultPosition block (authoritative)
    let Na__CameraStartState__Snapshot      = null;   // <-- Applied start snapshot (fallback when no project config)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Start State Capture
// -----------------------------------------------------------------------------

    // FUNCTION | Capture Canonical Start State from the Applied Camera
    // ------------------------------------------------------------
    function Na__CameraStartState__CaptureStartState(camera, controls, projectCameraConfig) {
        if (!camera || !controls) return;

        Na__CameraStartState__Camera        = camera;                        // <-- Store live camera reference
        Na__CameraStartState__Controls      = controls;                      // <-- Store live controls reference
        Na__CameraStartState__ProjectConfig = projectCameraConfig || null;   // <-- Raw project block (may be null)

        Na__CameraStartState__Snapshot = {
            position : { x: camera.position.x, y: camera.position.y, z: camera.position.z },       // <-- Start position (units)
            rotation : { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z,
                         order: camera.rotation.order },                                            // <-- Start rotation (radians)
            fov      : camera.fov,                                                                  // <-- Start field of view
            target   : { x: controls.target.x, y: controls.target.y, z: controls.target.z }        // <-- Start orbit target (units)
        };

        console.log('[TrueVision3D] Camera start state captured for Reset View.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has a Start State Been Captured?
    // ------------------------------------------------------------
    function Na__CameraStartState__HasStartState() {
        return Na__CameraStartState__Snapshot !== null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reset View
// -----------------------------------------------------------------------------

    // SUB HELPER FUNCTION | Restore the Applied Start Snapshot
    // ------------------------------------------------------------
    function Na__CameraStartState__ApplySnapshot(camera, controls, snapshot) {
        camera.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);        // <-- Restore position
        camera.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z,
                            snapshot.rotation.order);                                              // <-- Restore rotation
        camera.fov = snapshot.fov;                                                                 // <-- Restore field of view
        camera.updateProjectionMatrix();
        controls.target.set(snapshot.target.x, snapshot.target.y, snapshot.target.z);              // <-- Restore orbit target
    }
    // ------------------------------------------------------------


    // FUNCTION | Reset View to the Project Start State
    // ------------------------------------------------------------
    function Na__CameraStartState__ResetView() {
        const camera   = Na__CameraStartState__Camera;
        const controls = Na__CameraStartState__Controls;
        const snapshot = Na__CameraStartState__Snapshot;

        if (!camera || !controls || !snapshot) {
            console.warn('[TrueVision3D] Reset View skipped - start state not captured yet.');
            return false;
        }

        Na__CameraStartState__ApplySnapshot(camera, controls, snapshot);     // <-- Exact applied start state (incl. orbit target)

        if (Na__CameraStartState__ProjectConfig) {
            const configWithoutLegacyTarget = { ...Na__CameraStartState__ProjectConfig };
            delete configWithoutLegacyTarget.Camera__DefaultTarget;          // <-- Orbit target owned by OrbitHelperCube, not legacy key
            Na__UiFeature__ApplyCameraConfig(camera, controls, configWithoutLegacyTarget);  // <-- Re-apply authoritative project values
        }

        controls.update();                                                   // <-- Finalize controls with restored state
        Na__RenderLoop__RequestRender();                                     // <-- Redraw the restored view
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Camera Project Start State API
    // ------------------------------------------------------------
    export {
        Na__CameraStartState__CaptureStartState,
        Na__CameraStartState__HasStartState,
        Na__CameraStartState__ResetView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
