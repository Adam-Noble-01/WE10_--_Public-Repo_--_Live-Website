// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - ORTHOGRAPHIC ELEVATION CAMERA
// =============================================================================
//
// FILE       : Na__Elevation__OrthoCamera__.js
// NAMESPACE  : Na__ElevCam
// MODULE     : Elevation Views - Orthographic Elevation Camera
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the horizontal parallel projection camera used by elevations
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - An elevation needs a true parallel projection for the same reason a plan
//   does: a perspective camera pointed at a facade splays it outward from the
//   centre, so window heads read at different scales across one drawing and
//   nothing on it is measurable.
// - The camera looks HORIZONTALLY along the elevation's view axis with world
//   up as its up vector, so the drawing is always upright whatever the
//   azimuth. It sits a generous stand-off in front of the drawing plane;
//   under a parallel projection that distance affects only the near and far
//   planes, never the scale.
// - THE CAMERA MOVES IN THE DRAWING'S OWN AXES, NOT THE WORLD'S. Panning
//   travels along the elevation's right axis and along world Y, and never
//   along the view axis - so navigation can never drift the camera forward
//   through the building and silently change what the elevation shows. That
//   is the direct counterpart of the plan camera refusing to change height.
// - Framing fits the model's extent ACROSS the elevation - which for an
//   arbitrary azimuth is a blend of the bounding box's X and Z spans - plus
//   its full height, honouring the viewport aspect so nothing is cropped.
//
// INTEGRATION:
// - Na__Elevation__ModeController__ creates it once, then calls
//   PositionForElevation / FrameToBounds when entering an elevation.
// - Na__DrawView__Navigation__ drives Pan and Zoom through the view broker.
// - The markup layers project through the broker, never through here.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build. Structurally the
//   sibling of Na__FloorPlan__OrthoCamera__; what differs is that the plane is
//   vertical and its orientation is per elevation rather than fixed, so the
//   axes are cached on the camera when it is positioned.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities and Elevation Config
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__Math__ConvertMmToUnits,
        Na__Math__ConvertUnitsToMm
    } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__ElevCfg__GetCameraSetup } from './Na__Elevation__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Elevation Camera and Its Current Framing
    // ------------------------------------------------------------
    let Na__ElevCam__Camera     = null;   // <-- THREE.OrthographicCamera (created lazily)
    let Na__ElevCam__HalfHeight = 1;      // <-- Frustum half-height in scene units, before zoom
    let Na__ElevCam__Aspect     = 1;      // <-- Viewport aspect the frustum was built for
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Live Elevation Basis
    // ------------------------------------------------------------
    // Cached when the camera is positioned rather than recomputed per call, so
    // a pan and a projection in the same frame cannot disagree about which way
    // the drawing faces.
    // ------------------------------------------------------------
    let Na__ElevCam__RightX  = 1;   // <-- Screen-right, horizontal
    let Na__ElevCam__RightZ  = 0;
    let Na__ElevCam__NormalX = 0;   // <-- Building toward viewer, horizontal
    let Na__ElevCam__NormalZ = -1;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Camera Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Elevation Camera, or Return the Existing One
    // ------------------------------------------------------------
    function Na__ElevCam__EnsureCamera(viewportWidth, viewportHeight) {
        const setup = Na__ElevCfg__GetCameraSetup();

        if (!Na__ElevCam__Camera) {
            Na__ElevCam__Camera = new THREE.OrthographicCamera(-1, 1, 1, -1, setup.nearUnits, setup.farUnits);
            Na__ElevCam__Camera.name = 'Na__Elevation__OrthoCamera';
            Na__ElevCam__Camera.up.set(0, 1, 0);                                 // <-- Upright at every azimuth
            Na__ElevCam__Camera.zoom = setup.defaultZoom;
        }

        Na__ElevCam__Camera.near = setup.nearUnits;
        Na__ElevCam__Camera.far  = setup.farUnits;

        if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportHeight > 0) {
            Na__ElevCam__Aspect = viewportWidth / viewportHeight;
            Na__ElevCam__ApplyFrustum();
        }

        return Na__ElevCam__Camera;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Frustum Bounds From Half-Height and Aspect
    // ------------------------------------------------------------
    function Na__ElevCam__ApplyFrustum() {
        if (!Na__ElevCam__Camera) return;

        const halfWidth = Na__ElevCam__HalfHeight * Na__ElevCam__Aspect;
        Na__ElevCam__Camera.left   = -halfWidth;
        Na__ElevCam__Camera.right  =  halfWidth;
        Na__ElevCam__Camera.top    =  Na__ElevCam__HalfHeight;
        Na__ElevCam__Camera.bottom = -Na__ElevCam__HalfHeight;
        Na__ElevCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Camera Without Creating One
    // ------------------------------------------------------------
    function Na__ElevCam__GetCamera() {
        return Na__ElevCam__Camera;
    }
    // ------------------------------------------------------------


    // FUNCTION | Adopt an Elevation's Horizontal Basis
    // ------------------------------------------------------------
    // Called before any positioning so pan, projection and framing all share
    // one direction. axes is the object Na__ElevData__GetAxes returns.
    // ------------------------------------------------------------
    function Na__ElevCam__SetAxes(axes) {
        if (!axes) return false;
        Na__ElevCam__RightX  = axes.rightX;
        Na__ElevCam__RightZ  = axes.rightZ;
        Na__ElevCam__NormalX = axes.normalX;
        Na__ElevCam__NormalZ = axes.normalZ;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Positioning and Framing
// -----------------------------------------------------------------------------

    // FUNCTION | Place the Camera in Front of the Drawing Plane
    // ------------------------------------------------------------
    // All three arguments are millimetres in the DRAWING's own axes:
    //   planeDistanceMm - where the plane sits along the view axis
    //   centreRunMm     - horizontal position on the sheet to centre on
    //   centreHeightMm  - world height to centre on
    // The camera is pushed the configured stand-off further along the view
    // axis and aimed back at the plane, so everything the cut kept sits
    // between the near and far planes.
    // ------------------------------------------------------------
    function Na__ElevCam__PositionForPlane(planeDistanceMm, centreRunMm, centreHeightMm) {
        if (!Na__ElevCam__Camera) return false;

        const setup    = Na__ElevCfg__GetCameraSetup();
        const runUnits = Na__Math__ConvertMmToUnits(Number.isFinite(centreRunMm) ? centreRunMm : 0);
        const heightU  = Na__Math__ConvertMmToUnits(Number.isFinite(centreHeightMm) ? centreHeightMm : 0);
        const planeU   = Na__Math__ConvertMmToUnits(Number.isFinite(planeDistanceMm) ? planeDistanceMm : 0);
        const eyeDist  = planeU + setup.standOffUnits;

        const eyeX = (Na__ElevCam__RightX * runUnits) + (Na__ElevCam__NormalX * eyeDist);
        const eyeZ = (Na__ElevCam__RightZ * runUnits) + (Na__ElevCam__NormalZ * eyeDist);

        Na__ElevCam__Camera.position.set(eyeX, heightU, eyeZ);
        Na__ElevCam__Camera.up.set(0, 1, 0);
        Na__ElevCam__Camera.lookAt(
            (Na__ElevCam__RightX * runUnits) + (Na__ElevCam__NormalX * planeU),
            heightU,
            (Na__ElevCam__RightZ * runUnits) + (Na__ElevCam__NormalZ * planeU)
        );
        Na__ElevCam__Camera.updateMatrixWorld(true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Frustum to a Model's Extent Across This Elevation
    // ------------------------------------------------------------
    // The span across an arbitrary azimuth is not simply the box's X or Z
    // size: it is the box projected onto the right axis, which for an
    // axis-aligned box is |rx| * halfX + |rz| * halfZ. At the four compass
    // presets that collapses to exactly one of the two spans, and in between
    // it grows the way the diagonal actually does - so an elevation taken at
    // 45 degrees still frames the whole building.
    // ------------------------------------------------------------
    function Na__ElevCam__FrameToBounds(boundingBox, viewportWidth, viewportHeight) {
        if (!Na__ElevCam__Camera || !boundingBox || boundingBox.isEmpty()) return false;

        const setup = Na__ElevCfg__GetCameraSetup();
        const size  = boundingBox.getSize(new THREE.Vector3());

        if (Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) && viewportHeight > 0) {
            Na__ElevCam__Aspect = viewportWidth / viewportHeight;
        }

        const worldHalfWidth = (Math.abs(Na__ElevCam__RightX) * (size.x / 2))
                             + (Math.abs(Na__ElevCam__RightZ) * (size.z / 2))
                             + setup.marginUnits;
        const worldHalfTall  = (size.y / 2) + setup.marginUnits;

        Na__ElevCam__HalfHeight = Math.max(
            worldHalfTall,                                                       // <-- Full height must fit vertically
            worldHalfWidth / Math.max(Na__ElevCam__Aspect, 0.0001)               // <-- Full span must fit horizontally
        );

        Na__ElevCam__Camera.zoom = setup.defaultZoom;
        Na__ElevCam__ApplyFrustum();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Measure a Model's Centre in This Elevation's Axes
    // ------------------------------------------------------------
    // Returns millimetres, so it feeds PositionForPlane directly. Null when
    // nothing measurable is loaded, which the caller treats as "cannot frame
    // yet" rather than guessing at a position.
    // ------------------------------------------------------------
    function Na__ElevCam__MeasureCentreMm(boundingBox) {
        if (!boundingBox || boundingBox.isEmpty()) return null;

        const centre = boundingBox.getCenter(new THREE.Vector3());

        return {
            runMm    : Na__Math__ConvertUnitsToMm((centre.x * Na__ElevCam__RightX) + (centre.z * Na__ElevCam__RightZ)),
            heightMm : Na__Math__ConvertUnitsToMm(centre.y)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Frustum After a Viewport Resize
    // ------------------------------------------------------------
    function Na__ElevCam__HandleResize(viewportWidth, viewportHeight) {
        if (!Na__ElevCam__Camera || !viewportHeight) return;
        Na__ElevCam__Aspect = viewportWidth / viewportHeight;
        Na__ElevCam__ApplyFrustum();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pan and Zoom
// -----------------------------------------------------------------------------

    // FUNCTION | Move the Camera Across the Elevation Plane
    // ------------------------------------------------------------
    // du and dv are scene units signed the way the SCREEN is: du positive
    // moves right along the elevation, dv positive moves DOWN the sheet, which
    // is why it is subtracted from world Y. The view-axis component is never
    // touched, so the camera cannot drift forward into the building.
    // ------------------------------------------------------------
    function Na__ElevCam__PanByPlaneUnits(du, dv) {
        if (!Na__ElevCam__Camera) return;
        Na__ElevCam__Camera.position.x += Na__ElevCam__RightX * du;
        Na__ElevCam__Camera.position.z += Na__ElevCam__RightZ * du;
        Na__ElevCam__Camera.position.y -= dv;
        Na__ElevCam__Camera.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Camera's Position on the Sheet in Millimetres
    // ------------------------------------------------------------
    // The view-axis component is preserved exactly, so restoring a saved
    // framing cannot move the camera through the drawing plane.
    // ------------------------------------------------------------
    function Na__ElevCam__SetPanTargetMm(runMm, heightMm) {
        if (!Na__ElevCam__Camera) return;

        const position = Na__ElevCam__Camera.position;
        const distance = (position.x * Na__ElevCam__NormalX) + (position.z * Na__ElevCam__NormalZ);
        const runUnits = Number.isFinite(runMm)
            ? Na__Math__ConvertMmToUnits(runMm)
            : (position.x * Na__ElevCam__RightX) + (position.z * Na__ElevCam__RightZ);

        position.x = (Na__ElevCam__RightX * runUnits) + (Na__ElevCam__NormalX * distance);
        position.z = (Na__ElevCam__RightZ * runUnits) + (Na__ElevCam__NormalZ * distance);
        if (Number.isFinite(heightMm)) position.y = Na__Math__ConvertMmToUnits(heightMm);

        Na__ElevCam__Camera.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Camera's Position on the Sheet in Millimetres
    // ------------------------------------------------------------
    function Na__ElevCam__GetPanTargetMm() {
        if (!Na__ElevCam__Camera) return { runMm: 0, heightMm: 0 };

        const position = Na__ElevCam__Camera.position;
        return {
            runMm    : Na__Math__ConvertUnitsToMm((position.x * Na__ElevCam__RightX) + (position.z * Na__ElevCam__RightZ)),
            heightMm : Na__Math__ConvertUnitsToMm(position.y)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Multiply the Zoom, Clamped to the Configured Range
    // ------------------------------------------------------------
    function Na__ElevCam__ZoomByFactor(factor) {
        if (!Na__ElevCam__Camera || !Number.isFinite(factor) || factor <= 0) return;
        const setup = Na__ElevCfg__GetCameraSetup();
        Na__ElevCam__Camera.zoom = Math.min(setup.maxZoom, Math.max(setup.minZoom, Na__ElevCam__Camera.zoom * factor));
        Na__ElevCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Zoom Directly, Clamped to the Configured Range
    // ------------------------------------------------------------
    function Na__ElevCam__SetZoom(zoom) {
        if (!Na__ElevCam__Camera || !Number.isFinite(zoom) || zoom <= 0) return;
        const setup = Na__ElevCfg__GetCameraSetup();
        Na__ElevCam__Camera.zoom = Math.min(setup.maxZoom, Math.max(setup.minZoom, zoom));
        Na__ElevCam__Camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Current Zoom
    // ------------------------------------------------------------
    function Na__ElevCam__GetZoom() {
        return Na__ElevCam__Camera ? Na__ElevCam__Camera.zoom : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Scene Units One Screen Pixel Covers
    // ------------------------------------------------------------
    // Under a parallel projection this is constant across the whole viewport,
    // which is what lets pan track the cursor exactly and lets the markup
    // layers size text in real millimetres.
    // ------------------------------------------------------------
    function Na__ElevCam__GetUnitsPerPixel(viewportHeight) {
        if (!Na__ElevCam__Camera || !viewportHeight) return 0;
        const visibleHeight = (Na__ElevCam__Camera.top - Na__ElevCam__Camera.bottom) / Na__ElevCam__Camera.zoom;
        return visibleHeight / viewportHeight;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Disposal
// -----------------------------------------------------------------------------

    // FUNCTION | Dispose the Camera So a Reload Starts Clean
    // ------------------------------------------------------------
    function Na__ElevCam__Dispose() {
        Na__ElevCam__Camera     = null;
        Na__ElevCam__HalfHeight = 1;
        Na__ElevCam__Aspect     = 1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Orthographic Elevation Camera API
    // ------------------------------------------------------------
    export {
        Na__ElevCam__EnsureCamera,
        Na__ElevCam__GetCamera,
        Na__ElevCam__SetAxes,
        Na__ElevCam__PositionForPlane,
        Na__ElevCam__FrameToBounds,
        Na__ElevCam__MeasureCentreMm,
        Na__ElevCam__HandleResize,
        Na__ElevCam__PanByPlaneUnits,
        Na__ElevCam__SetPanTargetMm,
        Na__ElevCam__GetPanTargetMm,
        Na__ElevCam__ZoomByFactor,
        Na__ElevCam__SetZoom,
        Na__ElevCam__GetZoom,
        Na__ElevCam__GetUnitsPerPixel,
        Na__ElevCam__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
