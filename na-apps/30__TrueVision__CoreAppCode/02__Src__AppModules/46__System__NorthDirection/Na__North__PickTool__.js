// =============================================================================
// TRUEVISION3D - NORTH DIRECTION - PICK TOOL
// =============================================================================
//
// FILE       : Na__North__PickTool__.js
// NAMESPACE  : Na__NorthPick
// MODULE     : North Direction - Pick Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw the compass with two clicks in the 3D view: where it sits, then which way is north
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - TWO CLICKS. The first sets the compass down; the second is a point
//   towards north, and the bearing is the horizontal direction from the one to
//   the other. Between them the needle follows the pointer, so what will be
//   stored is on screen before it is committed.
// - WHAT A CLICK LANDS ON. The first model face under the pointer, as every
//   other pick in the app reads it - so north can be traced along something
//   that is known to run north, a boundary or a north arrow drawn in the
//   model, by clicking its two ends. A click that misses the model lands on
//   the horizontal plane through the first point (ground level for the first
//   click), so open ground beside the building works as well. Height never
//   enters the bearing: only X and Z are read.
// - A CLICK IS NOT A DRAG. A press that travels further than the threshold was
//   an orbit and is ignored, so the view can be turned between the two clicks
//   - which it usually has to be. These are plain listeners, not capturing
//   ones, for that reason: the orbit controls still get every event.
// - IN A PLAN VIEW TOO. The pick reads the drawing broker's camera when a 2D
//   drawing is on screen and the main camera otherwise. Looking straight down
//   a floor plan is the natural place to point north from.
// - One pick at a time. Escape cancels, at either click, and whatever north
//   was set before stands. Shift snaps the bearing to the config's step.
//
// INTEGRATION:
// - Na__North__DevMenu__Editor__ starts a pick from Draw Compass and receives
//   the result; it owns the gizmo and the data.
// - Initialised from index.html with the renderer, camera and model root.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.67.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation, after Na__Elevation__FacePick__.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Drawing Broker's Camera, Compass Maths and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__North__ConfigState__.js
    // ------------------------------------------------------------
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__NorthMath__BearingOfVector } from './Na__North__Compass__.js';
    import { Na__NorthCfg__GetPickSetup } from './Na__North__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Conversions and the Two Stages
    // ------------------------------------------------------------
    const Na__NorthPick__MM_PER_UNIT  = 1000;      // <-- Three.js scene units are metres
    const Na__NorthPick__STAGE_ORIGIN = 'origin';  // <-- Waiting for where the compass sits
    const Na__NorthPick__STAGE_AIM    = 'aim';     // <-- Waiting for the point towards north
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References
    // ------------------------------------------------------------
    let Na__NorthPick__Renderer  = null;
    let Na__NorthPick__Camera    = null;
    let Na__NorthPick__ModelRoot = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Armed Pick
    // ------------------------------------------------------------
    let Na__NorthPick__Active      = false;
    let Na__NorthPick__Stage       = Na__NorthPick__STAGE_ORIGIN;
    let Na__NorthPick__Callbacks   = null;      // <-- { onOrigin, onAim, onPicked, onCancelled }
    let Na__NorthPick__Origin      = null;      // <-- THREE.Vector3, once the first click has landed
    let Na__NorthPick__FootY       = 0;         // <-- The height a first click that misses the model lands at
    let Na__NorthPick__PointerDown = false;
    let Na__NorthPick__DownX       = 0;
    let Na__NorthPick__DownY       = 0;
    let Na__NorthPick__LastAimAt   = 0;
    let Na__NorthPick__PriorCursor = '';
    const Na__NorthPick__Raycaster = new THREE.Raycaster();
    const Na__NorthPick__Ndc       = new THREE.Vector2();
    const Na__NorthPick__Plane     = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Raycast
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve a Pointer Position to a Point in the Scene
    // ------------------------------------------------------------
    // The first visible model face under it, else the horizontal plane at
    // planeY. Null when the ray meets neither - a pointer aimed at the sky.
    // ------------------------------------------------------------
    function Na__NorthPick__PointAt(clientX, clientY, planeY) {
        if (!Na__NorthPick__Renderer) return null;
        const camera = Na__DrawView__GetCamera() || Na__NorthPick__Camera;       // <-- The drawing on screen, else the 3D view
        if (!camera) return null;

        const rect = Na__NorthPick__Renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        Na__NorthPick__Ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        Na__NorthPick__Ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        Na__NorthPick__Raycaster.setFromCamera(Na__NorthPick__Ndc, camera);

        if (Na__NorthPick__ModelRoot) {
            const meshes = [];
            Na__NorthPick__ModelRoot.traverse((child) => { if (child.isMesh && child.visible) meshes.push(child); });
            const hits = meshes.length ? Na__NorthPick__Raycaster.intersectObjects(meshes, false) : [];
            if (hits.length) return hits[0].point.clone();
        }

        Na__NorthPick__Plane.constant = -planeY;                                 // <-- The plane y = planeY
        const onPlane = Na__NorthPick__Raycaster.ray.intersectPlane(Na__NorthPick__Plane, new THREE.Vector3());
        return onPlane || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Bearing From the Origin to a Point, or Null When Too Close to Tell
    // ------------------------------------------------------------
    function Na__NorthPick__BearingTo(point, snap) {
        if (!Na__NorthPick__Origin || !point) return null;
        const setup = Na__NorthCfg__GetPickSetup();
        const dx = point.x - Na__NorthPick__Origin.x;
        const dz = point.z - Na__NorthPick__Origin.z;
        if (Math.hypot(dx, dz) < setup.minAimDistanceUnits) return null;
        const bearing = Na__NorthMath__BearingOfVector(dx, dz);
        if (bearing === null) return null;
        return (snap && setup.snapStepDeg > 0) ? (Math.round(bearing / setup.snapStepDeg) * setup.snapStepDeg) % 360 : bearing;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer and Key Handlers
// -----------------------------------------------------------------------------

    // HANDLER | Pointer Down - Remember Where the Press Started
    // ------------------------------------------------------------
    function Na__NorthPick__HandlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        Na__NorthPick__PointerDown = true;
        Na__NorthPick__DownX       = event.clientX;
        Na__NorthPick__DownY       = event.clientY;
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Move - the Needle Follows While Aiming
    // ------------------------------------------------------------
    // Not while a button is held: that is an orbit, and the view is moving
    // under the pointer.
    // ------------------------------------------------------------
    function Na__NorthPick__HandlePointerMove(event) {
        if (Na__NorthPick__Stage !== Na__NorthPick__STAGE_AIM || Na__NorthPick__PointerDown) return;
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        if ((now - Na__NorthPick__LastAimAt) < Na__NorthCfg__GetPickSetup().aimRecomputeMs) return;
        Na__NorthPick__LastAimAt = now;
        const bearing = Na__NorthPick__BearingTo(Na__NorthPick__PointAt(event.clientX, event.clientY, Na__NorthPick__Origin.y), event.shiftKey);
        if (bearing !== null && Na__NorthPick__Callbacks && typeof Na__NorthPick__Callbacks.onAim === 'function') Na__NorthPick__Callbacks.onAim(Na__NorthPick__Origin.clone(), bearing);
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Up - A Short Press Is a Click, a Long One Was an Orbit
    // ------------------------------------------------------------
    function Na__NorthPick__HandlePointerUp(event) {
        if (!Na__NorthPick__PointerDown) return;
        Na__NorthPick__PointerDown = false;

        const threshold = Na__NorthCfg__GetPickSetup().clickThresholdPx;
        if (Math.abs(event.clientX - Na__NorthPick__DownX) > threshold || Math.abs(event.clientY - Na__NorthPick__DownY) > threshold) return;   // <-- Too much travel: an orbit drag, not a click

        if (Na__NorthPick__Stage === Na__NorthPick__STAGE_ORIGIN) {
            const point = Na__NorthPick__PointAt(event.clientX, event.clientY, Na__NorthPick__FootY);
            if (!point) return;                                                  // <-- The sky: stay armed
            Na__NorthPick__Origin = point;
            Na__NorthPick__Stage  = Na__NorthPick__STAGE_AIM;
            if (Na__NorthPick__Callbacks && typeof Na__NorthPick__Callbacks.onOrigin === 'function') Na__NorthPick__Callbacks.onOrigin(point.clone());
            return;
        }

        const bearing = Na__NorthPick__BearingTo(Na__NorthPick__PointAt(event.clientX, event.clientY, Na__NorthPick__Origin.y), event.shiftKey);
        if (bearing === null) return;                                            // <-- On top of the compass: no direction to read
        const result = {
            bearingDeg : bearing,
            originMm   : {
                x : Math.round(Na__NorthPick__Origin.x * Na__NorthPick__MM_PER_UNIT),
                y : Math.round(Na__NorthPick__Origin.y * Na__NorthPick__MM_PER_UNIT),
                z : Math.round(Na__NorthPick__Origin.z * Na__NorthPick__MM_PER_UNIT)
            }
        };
        const callback = Na__NorthPick__Callbacks ? Na__NorthPick__Callbacks.onPicked : null;
        Na__NorthPick__Stop();
        if (typeof callback === 'function') callback(result);
    }
    // ------------------------------------------------------------


    // HANDLER | Escape Cancels an Armed Pick
    // ------------------------------------------------------------
    function Na__NorthPick__HandleKeyDown(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        Na__NorthPick__Cancel();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Detach Everything and Restore the Cursor
    // ------------------------------------------------------------
    function Na__NorthPick__Stop() {
        if (!Na__NorthPick__Active) return;
        const canvas = Na__NorthPick__Renderer ? Na__NorthPick__Renderer.domElement : null;
        if (canvas) {
            canvas.removeEventListener('pointerdown', Na__NorthPick__HandlePointerDown);
            canvas.removeEventListener('pointermove', Na__NorthPick__HandlePointerMove);
            canvas.removeEventListener('pointerup',   Na__NorthPick__HandlePointerUp);
            canvas.style.cursor = Na__NorthPick__PriorCursor;
        }
        window.removeEventListener('keydown', Na__NorthPick__HandleKeyDown, true);

        Na__NorthPick__Active      = false;
        Na__NorthPick__Stage       = Na__NorthPick__STAGE_ORIGIN;
        Na__NorthPick__PointerDown = false;
        Na__NorthPick__Callbacks   = null;
        Na__NorthPick__Origin      = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Arm a Compass Pick
    // ------------------------------------------------------------
    // context: { onOrigin(point), onAim(point, bearingDeg), onPicked(result), onCancelled }
    //   point  : THREE.Vector3 in scene units - where the compass sits
    //   result : { bearingDeg, originMm : { x, y, z } }
    // ------------------------------------------------------------
    function Na__NorthPick__Start(context) {
        if (!Na__NorthPick__Renderer || !Na__NorthPick__Camera) return false;
        Na__NorthPick__Cancel();                                                 // <-- One pick at a time

        Na__NorthPick__Active    = true;
        Na__NorthPick__Stage     = Na__NorthPick__STAGE_ORIGIN;
        Na__NorthPick__Callbacks = context || {};
        Na__NorthPick__Origin    = null;

        const box = Na__NorthPick__ModelRoot ? new THREE.Box3().setFromObject(Na__NorthPick__ModelRoot) : null;
        Na__NorthPick__FootY = (box && !box.isEmpty() && (box.min.y > 0 || box.max.y < 0)) ? box.min.y : 0;   // <-- A first click on open ground lands at ground level, or at the foot of a model that does not reach it

        const canvas = Na__NorthPick__Renderer.domElement;
        Na__NorthPick__PriorCursor = canvas.style.cursor;
        canvas.style.cursor = Na__NorthCfg__GetPickSetup().cursor;
        canvas.addEventListener('pointerdown', Na__NorthPick__HandlePointerDown);
        canvas.addEventListener('pointermove', Na__NorthPick__HandlePointerMove);
        canvas.addEventListener('pointerup',   Na__NorthPick__HandlePointerUp);
        window.addEventListener('keydown', Na__NorthPick__HandleKeyDown, true);  // <-- Capture: beats the global hotkeys
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cancel an Armed Pick
    // ------------------------------------------------------------
    function Na__NorthPick__Cancel() {
        if (!Na__NorthPick__Active) return false;
        const callback = Na__NorthPick__Callbacks ? Na__NorthPick__Callbacks.onCancelled : null;
        Na__NorthPick__Stop();
        if (typeof callback === 'function') callback();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Pick Armed, and Which Click Is It Waiting For
    // ------------------------------------------------------------
    function Na__NorthPick__IsActive() {
        return Na__NorthPick__Active;
    }
    function Na__NorthPick__IsAiming() {
        return Na__NorthPick__Active && Na__NorthPick__Stage === Na__NorthPick__STAGE_AIM;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Pick at a Different Model Root
    // ------------------------------------------------------------
    function Na__NorthPick__SetModelRoot(modelRoot) {
        Na__NorthPick__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Pick Tool
    // ------------------------------------------------------------
    // context: { renderer, camera, modelRoot }
    // ------------------------------------------------------------
    function Na__NorthPick__Initialize(context) {
        if (!context || !context.renderer || !context.camera) {
            console.warn('[TrueVision3D] North direction pick init skipped - missing renderer or camera.');
            return false;
        }
        Na__NorthPick__Renderer  = context.renderer;
        Na__NorthPick__Camera    = context.camera;
        Na__NorthPick__ModelRoot = context.modelRoot || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | North Direction Pick Tool API
    // ------------------------------------------------------------
    export {
        Na__NorthPick__Initialize,
        Na__NorthPick__SetModelRoot,
        Na__NorthPick__Start,
        Na__NorthPick__Cancel,
        Na__NorthPick__IsActive,
        Na__NorthPick__IsAiming
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
