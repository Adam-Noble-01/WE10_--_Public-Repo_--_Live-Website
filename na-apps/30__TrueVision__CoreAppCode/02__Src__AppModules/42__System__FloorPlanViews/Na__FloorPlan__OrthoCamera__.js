// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - ORTHOGRAPHIC PLAN CAMERA
// =============================================================================
//
// FILE       : Na__FloorPlan__OrthoCamera__.js
// NAMESPACE  : Na__FpCam
// MODULE     : Floor Plan Views - Orthographic Plan Camera
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the top-down parallel projection camera used by plan mode
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - TrueVision had no orthographic camera before this module. Plan mode needs
//   a true parallel projection: a perspective camera pointed downward still
//   splays the walls outward from the centre, so rooms read at different
//   scales across one drawing and the plan is not measurable.
// - The camera sits a short distance above the cut plane looking straight
//   down. Under an orthographic projection that distance does not affect
//   scale - only the near plane - so it stays deliberately small, matching
//   the "camera just above the cut" model in the brief.
// - Up is world -Z, so world north reads as up-screen. Screen X maps to world
//   +X and screen Y maps to world -Z, which is the mapping the annotation
//   overlay and the pan controls both assume.
// - Framing fits the model's X/Z footprint plus a margin, honouring the
//   viewport aspect so nothing is cropped in either orientation.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ creates it once, then calls
//   PositionForCut / FrameToBounds when entering a plan.
// - Na__FloorPlan__PlanNavigation__ drives Pan and Zoom.
// - Na__PlanAnnotations__Overlay__ uses ProjectWorldToScreen to keep text
//   pinned to its world position while the plan is panned.
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

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities and Floor Plan Config
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__Math__ConvertMmToUnits,
        Na__Math__ConvertUnitsToMm
    } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__FpCfg__GetCameraSetup } from './Na__FloorPlan__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fixed Plan Orientation
    // ------------------------------------------------------------
    // Looking straight down means the up vector cannot be world +Y or the
    // view matrix degenerates. World -Z as up puts north at the top of the
    // screen, which is the convention every drawing in the practice uses.
    // ------------------------------------------------------------
    const Na__FpCam__LOOK_DIRECTION = Object.freeze({ x: 0, y: -1, z: 0 });
    const Na__FpCam__UP_VECTOR      = Object.freeze({ x: 0, y: 0, z: -1 });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Plan Camera and Its Current Framing
    // ------------------------------------------------------------
    let Na__FpCam__Camera     = null;   // <-- THREE.OrthographicCamera (created lazily)
    let Na__FpCam__HalfHeight = 1;      // <-- Frustum half-height in scene units, before zoom
    let Na__FpCam__Aspect     = 1;      // <-- Viewport aspect the frustum was built for
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects (Allocation-Free Projection)
    // ------------------------------------------------------------
    const Na__FpCam__ScratchVec = new THREE.Vector3();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Camera Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Plan Camera, or Return the Existing One
    // ------------------------------------------------------------
    function Na__FpCam__EnsureCamera(viewportWidth, viewportHeight) {
        const setup = Na__FpCfg__GetCameraSetup();

        if (!Na__FpCam__Camera) {
            Na__FpCam__Camera = new THREE.OrthographicCamera(-1, 1, 1, -1, setup.nearUnits, setup.farUnits);
            Na__FpCam__Camera.name = 'Na__FloorPlan__OrthoCamera';
            Na__FpCam__Camera.up.set(Na__FpCam__UP_VECTOR.x, Na__FpCam__UP_VECTOR.y, Na__FpCam__UP_VECTOR.z);
            Na__FpCam__Camera.zoom = setup.defaultZoom;
        }

        Na__FpCam__Camera.near = setup.nearUnits;
        Na__FpCam__Camera.far  = setup.farUnits;

        if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportHeight > 0) {
            Na__FpCam__Aspect = viewportWidth / viewportHeight;
            Na__FpCam__ApplyFrustum();
        }

        return Na__FpCam__Camera;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Frustum Bounds From Half-Height and Aspect
    // ------------------------------------------------------------
    function Na__FpCam__ApplyFrustum() {
        if (!Na__FpCam__Camera) return;

        const halfWidth = Na__FpCam__HalfHeight * Na__FpCam__Aspect;
        Na__FpCam__Camera.left   = -halfWidth;
        Na__FpCam__Camera.right  =  halfWidth;
        Na__FpCam__Camera.top    =  Na__FpCam__HalfHeight;
        Na__FpCam__Camera.bottom = -Na__FpCam__HalfHeight;
        Na__FpCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Camera Without Creating One
    // ------------------------------------------------------------
    function Na__FpCam__GetCamera() {
        return Na__FpCam__Camera;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Positioning and Framing
// -----------------------------------------------------------------------------

    // FUNCTION | Place the Camera Directly Above a Cut Height
    // ------------------------------------------------------------
    // cutHeightMm is the absolute world height of the section cut. The camera
    // is lifted the configured distance above it and aimed straight down, so
    // everything the cut kept is in front of the near plane.
    // ------------------------------------------------------------
    function Na__FpCam__PositionForCut(cutHeightMm, centreXMm, centreZMm) {
        if (!Na__FpCam__Camera) return false;

        const setup      = Na__FpCfg__GetCameraSetup();
        const cutUnits   = Na__Math__ConvertMmToUnits(cutHeightMm);
        const eyeY       = cutUnits + setup.heightAboveCutUnits;
        const eyeX       = Na__Math__ConvertMmToUnits(Number.isFinite(centreXMm) ? centreXMm : 0);
        const eyeZ       = Na__Math__ConvertMmToUnits(Number.isFinite(centreZMm) ? centreZMm : 0);

        Na__FpCam__Camera.position.set(eyeX, eyeY, eyeZ);
        Na__FpCam__Camera.up.set(Na__FpCam__UP_VECTOR.x, Na__FpCam__UP_VECTOR.y, Na__FpCam__UP_VECTOR.z);
        Na__FpCam__Camera.lookAt(
            eyeX + Na__FpCam__LOOK_DIRECTION.x,
            eyeY + Na__FpCam__LOOK_DIRECTION.y,
            eyeZ + Na__FpCam__LOOK_DIRECTION.z
        );
        Na__FpCam__Camera.updateMatrixWorld(true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Frustum to a Model's X/Z Footprint
    // ------------------------------------------------------------
    // Takes the larger of the two fits so neither the width nor the depth of
    // the building is cropped, whatever the window shape.
    // ------------------------------------------------------------
    function Na__FpCam__FrameToBounds(boundingBox, viewportWidth, viewportHeight) {
        if (!Na__FpCam__Camera || !boundingBox || boundingBox.isEmpty()) return false;

        const setup = Na__FpCfg__GetCameraSetup();
        const size  = boundingBox.getSize(new THREE.Vector3());

        if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportHeight > 0) {
            Na__FpCam__Aspect = viewportWidth / viewportHeight;
        }

        const worldHalfWidth = (size.x / 2) + setup.marginUnits;                 // <-- Screen X spans world X
        const worldHalfDepth = (size.z / 2) + setup.marginUnits;                 // <-- Screen Y spans world Z

        Na__FpCam__HalfHeight = Math.max(
            worldHalfDepth,                                                      // <-- Depth must fit vertically
            worldHalfWidth / Math.max(Na__FpCam__Aspect, 0.0001)                 // <-- Width must fit horizontally
        );

        Na__FpCam__Camera.zoom = setup.defaultZoom;
        Na__FpCam__ApplyFrustum();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Frustum After a Viewport Resize
    // ------------------------------------------------------------
    function Na__FpCam__HandleResize(viewportWidth, viewportHeight) {
        if (!Na__FpCam__Camera || !viewportHeight) return;
        Na__FpCam__Aspect = viewportWidth / viewportHeight;
        Na__FpCam__ApplyFrustum();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pan and Zoom
// -----------------------------------------------------------------------------

    // FUNCTION | Move the Camera Across the World X/Z Ground Plane
    // ------------------------------------------------------------
    // Height is never touched, so panning can never drift the camera off its
    // cut plane and change what the plan shows.
    // ------------------------------------------------------------
    function Na__FpCam__PanByUnits(deltaX, deltaZ) {
        if (!Na__FpCam__Camera) return;
        Na__FpCam__Camera.position.x += deltaX;
        Na__FpCam__Camera.position.z += deltaZ;
        Na__FpCam__Camera.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Camera's World X/Z Position in Millimetres
    // ------------------------------------------------------------
    function Na__FpCam__SetPanTargetMm(targetXMm, targetZMm) {
        if (!Na__FpCam__Camera) return;
        if (Number.isFinite(targetXMm)) Na__FpCam__Camera.position.x = Na__Math__ConvertMmToUnits(targetXMm);
        if (Number.isFinite(targetZMm)) Na__FpCam__Camera.position.z = Na__Math__ConvertMmToUnits(targetZMm);
        Na__FpCam__Camera.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Camera's World X/Z Position in Millimetres
    // ------------------------------------------------------------
    function Na__FpCam__GetPanTargetMm() {
        if (!Na__FpCam__Camera) return { targetXMm: 0, targetZMm: 0 };
        return {
            targetXMm : Na__Math__ConvertUnitsToMm(Na__FpCam__Camera.position.x),
            targetZMm : Na__Math__ConvertUnitsToMm(Na__FpCam__Camera.position.z)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Multiply the Zoom, Clamped to the Configured Range
    // ------------------------------------------------------------
    function Na__FpCam__ZoomByFactor(factor) {
        if (!Na__FpCam__Camera || !Number.isFinite(factor) || factor <= 0) return;
        const setup = Na__FpCfg__GetCameraSetup();
        Na__FpCam__Camera.zoom = Math.min(setup.maxZoom, Math.max(setup.minZoom, Na__FpCam__Camera.zoom * factor));
        Na__FpCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Zoom Directly, Clamped to the Configured Range
    // ------------------------------------------------------------
    function Na__FpCam__SetZoom(zoom) {
        if (!Na__FpCam__Camera || !Number.isFinite(zoom) || zoom <= 0) return;
        const setup = Na__FpCfg__GetCameraSetup();
        Na__FpCam__Camera.zoom = Math.min(setup.maxZoom, Math.max(setup.minZoom, zoom));
        Na__FpCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Current Zoom
    // ------------------------------------------------------------
    function Na__FpCam__GetZoom() {
        return Na__FpCam__Camera ? Na__FpCam__Camera.zoom : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Scene Units One Screen Pixel Covers
    // ------------------------------------------------------------
    // Under a parallel projection this is constant across the whole viewport,
    // which is what lets pan track the cursor exactly and lets the annotation
    // layer size text in real millimetres.
    // ------------------------------------------------------------
    function Na__FpCam__GetUnitsPerPixel(viewportHeight) {
        if (!Na__FpCam__Camera || !viewportHeight) return 0;
        const visibleHeight = (Na__FpCam__Camera.top - Na__FpCam__Camera.bottom) / Na__FpCam__Camera.zoom;
        return visibleHeight / viewportHeight;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Projection Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | Project a World Point to Screen Pixels
    // ------------------------------------------------------------
    // Returns { x, y } in CSS pixels relative to the viewport's top-left, so
    // the annotation overlay can position a DOM node straight onto it.
    // ------------------------------------------------------------
    function Na__FpCam__ProjectWorldToScreen(worldX, worldY, worldZ, viewportWidth, viewportHeight) {
        if (!Na__FpCam__Camera) return null;

        Na__FpCam__ScratchVec.set(worldX, worldY, worldZ).project(Na__FpCam__Camera);

        return {
            x : (Na__FpCam__ScratchVec.x + 1) * 0.5 * viewportWidth,
            y : (1 - Na__FpCam__ScratchVec.y) * 0.5 * viewportHeight
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Dispose the Camera So a Reload Starts Clean
    // ------------------------------------------------------------
    function Na__FpCam__Dispose() {
        Na__FpCam__Camera     = null;
        Na__FpCam__HalfHeight = 1;
        Na__FpCam__Aspect     = 1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Orthographic Plan Camera API
    // ------------------------------------------------------------
    export {
        Na__FpCam__EnsureCamera,
        Na__FpCam__GetCamera,
        Na__FpCam__PositionForCut,
        Na__FpCam__FrameToBounds,
        Na__FpCam__HandleResize,
        Na__FpCam__PanByUnits,
        Na__FpCam__SetPanTargetMm,
        Na__FpCam__GetPanTargetMm,
        Na__FpCam__ZoomByFactor,
        Na__FpCam__SetZoom,
        Na__FpCam__GetZoom,
        Na__FpCam__GetUnitsPerPixel,
        Na__FpCam__ProjectWorldToScreen,
        Na__FpCam__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
