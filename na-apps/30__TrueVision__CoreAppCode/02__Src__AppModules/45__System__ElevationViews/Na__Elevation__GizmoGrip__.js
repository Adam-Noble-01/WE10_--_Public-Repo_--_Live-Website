// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - GIZMO GRIP
// =============================================================================
//
// FILE       : Na__Elevation__GizmoGrip__.js
// NAMESPACE  : Na__ElevGrip
// MODULE     : Elevation Views - Gizmo Grip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drag the elevation plane gizmo along its own normal to edit the plane loosely
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The TrueVision gizmo is a readout: the sliders are the input and the plane
//   only reflects them. Here the gizmo also carries a grip (plan decision D16):
//   press on the translucent plane, drag, and the plane origin follows along
//   the elevation's own normal. The sliders remain the precise path and the
//   values they show are what gets saved; the grip is the fast, loose one.
// - THE DRAG IS PROJECTED ONTO THE NORMAL. The pointer ray is solved for its
//   closest point to the axis through the hit point along the plane normal,
//   exactly as the Cross Sections tool moves its own planes, so the plane
//   never slides sideways and the run anchor stays at the world origin. The
//   origin moves by delta * normal; a section is recut at the drag throttle
//   while moving and exactly on release.
// - The raycast tests the gizmo face mesh only, so a press on the building
//   behind it starts an orbit as usual. Orbit controls are disabled for the
//   duration of a grip drag and re-enabled on release.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ arms the grip for the row it is editing
//   (after showing the gizmo) and receives live and commit callbacks.
// - Initialised from index.html with the renderer, camera and controls.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 46__System__ElevationViews/Na__Elevation__GizmoGrip__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 3.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core, Render Loop and Math
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import {
        Na__RenderLoop__RequestRender,
        Na__RenderLoop__RequestActiveRender,
        Na__RenderLoop__StopActiveRender
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Gizmo, Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__PlaneGizmo__.js
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__ElevGizmo__GetFaceMesh, Na__ElevGizmo__IsVisible } from './Na__Elevation__PlaneGizmo__.js';
    import {
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneOriginMm,
        Na__ElevData__SetPlaneOriginMm
    } from './Na__Elevation__ProjectJson__Data__.js';
    import { Na__ElevCfg__GetGripSetup } from './Na__Elevation__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Render Loop Reason and Helper Layer
    // ------------------------------------------------------------
    const Na__ElevGrip__RENDER_REASON = 'elevation-grip';
    const Na__ElevGrip__HELPER_LAYER  = 1;                                       // <-- The gizmo lives on the helper layer
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References
    // ------------------------------------------------------------
    let Na__ElevGrip__Renderer = null;
    let Na__ElevGrip__Camera   = null;
    let Na__ElevGrip__Controls = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Armed Record and Drag State
    // ------------------------------------------------------------
    let Na__ElevGrip__Elevation  = null;   // <-- Record the grip edits while armed
    let Na__ElevGrip__OnLive     = null;
    let Na__ElevGrip__OnCommit   = null;
    let Na__ElevGrip__Attached   = false;
    let Na__ElevGrip__Dragging   = false;
    let Na__ElevGrip__StartParam = 0;      // <-- Axis parameter at pointer down (units)
    let Na__ElevGrip__StartXMm   = 0;      // <-- Plane origin at pointer down
    let Na__ElevGrip__StartZMm   = 0;
    let Na__ElevGrip__LastLiveMs = 0;
    const Na__ElevGrip__AxisOrigin = new THREE.Vector3();
    const Na__ElevGrip__AxisDir    = new THREE.Vector3();
    const Na__ElevGrip__Raycaster  = new THREE.Raycaster();
    const Na__ElevGrip__Ndc        = new THREE.Vector2();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Aim the Raycaster From a Pointer Event
    // ------------------------------------------------------------
    function Na__ElevGrip__AimRay(event) {
        const rect = Na__ElevGrip__Renderer.domElement.getBoundingClientRect();
        Na__ElevGrip__Ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        Na__ElevGrip__Ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        Na__ElevGrip__Raycaster.setFromCamera(Na__ElevGrip__Ndc, Na__ElevGrip__Camera);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Parameter Along the Axis Closest to the Pointer Ray
    // ------------------------------------------------------------
    // Closest points between two lines: the drag axis (origin, dir) and the
    // pointer ray. Returns null when the two are parallel.
    // ------------------------------------------------------------
    function Na__ElevGrip__ClosestParamOnAxis(ray) {
        const w0 = new THREE.Vector3().subVectors(Na__ElevGrip__AxisOrigin, ray.origin);
        const d  = Na__ElevGrip__AxisDir;
        const r  = ray.direction;
        const b  = d.dot(r);
        const dw = d.dot(w0);
        const ew = r.dot(w0);
        const denom = 1 - (b * b);                                               // <-- Both directions are unit length
        if (Math.abs(denom) < 1e-6) return null;
        return ((b * ew) - dw) / denom;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer Handlers
// -----------------------------------------------------------------------------

    // HANDLER | Pointer Down - Begin a Drag If the Press Landed on the Gizmo
    // ------------------------------------------------------------
    function Na__ElevGrip__HandlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (!Na__ElevGrip__Elevation || !Na__ElevGizmo__IsVisible()) return;

        const faceMesh = Na__ElevGizmo__GetFaceMesh();
        if (!faceMesh) return;

        Na__ElevGrip__AimRay(event);
        Na__ElevGrip__Raycaster.layers.set(Na__ElevGrip__HELPER_LAYER);          // <-- The gizmo alone; the model is never tested
        faceMesh.updateMatrixWorld(true);
        const hits = Na__ElevGrip__Raycaster.intersectObject(faceMesh, false);
        if (hits.length === 0) return;

        const axes   = Na__ElevData__GetAxes(Na__ElevGrip__Elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(Na__ElevGrip__Elevation);
        Na__ElevGrip__AxisOrigin.copy(hits[0].point);
        Na__ElevGrip__AxisDir.set(axes.normalX, 0, axes.normalZ).normalize();
        const startParam = Na__ElevGrip__ClosestParamOnAxis(Na__ElevGrip__Raycaster.ray);
        Na__ElevGrip__StartParam = (startParam !== null) ? startParam : 0;
        Na__ElevGrip__StartXMm   = origin.xMm;
        Na__ElevGrip__StartZMm   = origin.zMm;
        Na__ElevGrip__Dragging   = true;

        if (Na__ElevGrip__Controls) Na__ElevGrip__Controls.enabled = false;      // <-- Suppress orbit while dragging
        Na__ElevGrip__Renderer.domElement.style.cursor = 'grabbing';
        Na__RenderLoop__RequestActiveRender(Na__ElevGrip__RENDER_REASON);
        event.preventDefault();
        event.stopPropagation();
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Move - Slide the Plane Along Its Normal
    // ------------------------------------------------------------
    function Na__ElevGrip__HandlePointerMove(event) {
        if (!Na__ElevGrip__Dragging || !Na__ElevGrip__Elevation) return;

        Na__ElevGrip__AimRay(event);
        const param = Na__ElevGrip__ClosestParamOnAxis(Na__ElevGrip__Raycaster.ray);
        if (param === null) return;

        const deltaMm = Na__Math__ConvertUnitsToMm(param - Na__ElevGrip__StartParam);
        Na__ElevData__SetPlaneOriginMm(
            Na__ElevGrip__Elevation,
            Na__ElevGrip__StartXMm + (Na__ElevGrip__AxisDir.x * deltaMm),
            Na__ElevGrip__StartZMm + (Na__ElevGrip__AxisDir.z * deltaMm)
        );

        // THROTTLED LIVE UPDATE | The section recut and the gizmo redraw follow
        // the drag at a steady cadence rather than on every pointer event.
        const now = performance.now();
        if (now - Na__ElevGrip__LastLiveMs >= Na__ElevCfg__GetGripSetup().dragRecomputeMs) {
            Na__ElevGrip__LastLiveMs = now;
            if (typeof Na__ElevGrip__OnLive === 'function') Na__ElevGrip__OnLive(Na__ElevGrip__Elevation);
        }
        Na__RenderLoop__RequestRender();
        event.preventDefault();
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Up - Land Exactly
    // ------------------------------------------------------------
    function Na__ElevGrip__HandlePointerUp() {
        if (!Na__ElevGrip__Dragging) return;
        Na__ElevGrip__Dragging = false;

        if (Na__ElevGrip__Controls) Na__ElevGrip__Controls.enabled = true;
        Na__ElevGrip__Renderer.domElement.style.cursor = '';
        Na__RenderLoop__StopActiveRender(Na__ElevGrip__RENDER_REASON);

        if (typeof Na__ElevGrip__OnCommit === 'function') Na__ElevGrip__OnCommit(Na__ElevGrip__Elevation);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Attach or Detach the Canvas Listeners
    // ------------------------------------------------------------
    function Na__ElevGrip__SetAttached(attached) {
        if (!Na__ElevGrip__Renderer || attached === Na__ElevGrip__Attached) return;
        const canvas = Na__ElevGrip__Renderer.domElement;
        if (attached) {
            canvas.addEventListener('pointerdown', Na__ElevGrip__HandlePointerDown, true); // <-- Capture: beats orbit and the drawing pan
            window.addEventListener('pointermove', Na__ElevGrip__HandlePointerMove);
            window.addEventListener('pointerup',   Na__ElevGrip__HandlePointerUp);
        } else {
            canvas.removeEventListener('pointerdown', Na__ElevGrip__HandlePointerDown, true);
            window.removeEventListener('pointermove', Na__ElevGrip__HandlePointerMove);
            window.removeEventListener('pointerup',   Na__ElevGrip__HandlePointerUp);
        }
        Na__ElevGrip__Attached = attached;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Arm the Grip for One Elevation
    // ------------------------------------------------------------
    // callbacks: { onLive(elevation), onCommit(elevation) }
    // Call after the gizmo has been shown for the same record.
    // ------------------------------------------------------------
    function Na__ElevGrip__Arm(elevation, callbacks) {
        if (!Na__ElevGrip__Renderer || !elevation) return false;
        if (Na__ElevGrip__Dragging) Na__ElevGrip__HandlePointerUp();            // <-- Never re-arm mid-drag

        Na__ElevGrip__Elevation = elevation;
        Na__ElevGrip__OnLive    = (callbacks && typeof callbacks.onLive === 'function')   ? callbacks.onLive   : null;
        Na__ElevGrip__OnCommit  = (callbacks && typeof callbacks.onCommit === 'function') ? callbacks.onCommit : null;
        Na__ElevGrip__SetAttached(true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stand the Grip Down
    // ------------------------------------------------------------
    function Na__ElevGrip__Disarm() {
        if (Na__ElevGrip__Dragging) Na__ElevGrip__HandlePointerUp();
        Na__ElevGrip__SetAttached(false);
        Na__ElevGrip__Elevation = null;
        Na__ElevGrip__OnLive    = null;
        Na__ElevGrip__OnCommit  = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Grip Drag in Progress?
    // ------------------------------------------------------------
    function Na__ElevGrip__IsDragging() {
        return Na__ElevGrip__Dragging;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Grip
    // ------------------------------------------------------------
    // context: { renderer, camera, controls }
    // ------------------------------------------------------------
    function Na__ElevGrip__Initialize(context) {
        if (!context || !context.renderer || !context.camera) {
            console.warn('[TrueVision3D] Elevation gizmo grip init skipped - missing renderer or camera.');
            return false;
        }
        Na__ElevGrip__Renderer = context.renderer;
        Na__ElevGrip__Camera   = context.camera;
        Na__ElevGrip__Controls = context.controls || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Gizmo Grip API
    // ------------------------------------------------------------
    export {
        Na__ElevGrip__Initialize,
        Na__ElevGrip__Arm,
        Na__ElevGrip__Disarm,
        Na__ElevGrip__IsDragging
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
