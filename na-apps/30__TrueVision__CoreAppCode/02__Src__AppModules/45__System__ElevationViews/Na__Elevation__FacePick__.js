// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - FACE PICK
// =============================================================================
//
// FILE       : Na__Elevation__FacePick__.js
// NAMESPACE  : Na__ElevPick
// MODULE     : Elevation Views - Face Pick
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Seed an elevation's bearing and plane origin by clicking a wall in the 3D view
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The precise definition of an elevation is two numbers and a mode (plan
//   decision D16), and the sliders are the precise way to set them. But most
//   elevations start as "that wall": this module lets the author click it and
//   fills the numbers in. The pick SEEDS the record; it is never the stored
//   definition, so the drawing survives a re-export of the model.
// - Reuses the legacy Elevation View's raycast rules so the two tools agree
//   about what a click means: a pointer that travels more than the click
//   threshold is an orbit drag, not a pick; the first mesh hit wins; the face
//   normal is projected onto the ground plane; a horizontal face (a roof, a
//   floor) falls back to facing +Z so a stray click never produces a
//   degenerate bearing.
// - The bearing is the normal turned into the elevation convention
//   (azimuth = atan2(nx, -nz), viewer standing on the normal's side) and the
//   plane origin is the hit point's X and Z, so the plane passes exactly
//   through the wall that was clicked.
// - One pick at a time. Escape cancels; starting a new pick replaces any
//   armed one. The cursor turns to a crosshair over the canvas while armed.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ starts a pick from Pick Face (new
//   record) and Re-pick (existing row) and receives the result.
// - Initialised from index.html with the renderer, camera and model root.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 46__System__ElevationViews/Na__Elevation__FacePick__.js
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

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Config and Derived Geometry
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // ------------------------------------------------------------
    import { Na__ElevCfg__GetFacePickSetup } from './Na__Elevation__ConfigState__.js';
    import { Na__ElevData__AzimuthFromNormal } from './Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Conversions and Fallbacks
    // ------------------------------------------------------------
    const Na__ElevPick__MM_PER_UNIT          = 1000;                       // <-- Three.js scene units are metres
    const Na__ElevPick__FALLBACK_NORMAL      = Object.freeze({ x: 0, z: 1 }); // <-- Horizontal faces face +Z
    const Na__ElevPick__HORIZONTAL_THRESHOLD = 0.001;                      // <-- Squared length below which a normal is "up"
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References
    // ------------------------------------------------------------
    let Na__ElevPick__Renderer  = null;
    let Na__ElevPick__Camera    = null;
    let Na__ElevPick__ModelRoot = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Armed Pick
    // ------------------------------------------------------------
    let Na__ElevPick__Active      = false;
    let Na__ElevPick__OnPicked    = null;
    let Na__ElevPick__OnCancelled = null;
    let Na__ElevPick__PointerDown = false;
    let Na__ElevPick__DownX       = 0;
    let Na__ElevPick__DownY       = 0;
    let Na__ElevPick__PriorCursor = '';
    const Na__ElevPick__Raycaster = new THREE.Raycaster();
    const Na__ElevPick__Ndc       = new THREE.Vector2();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Raycast
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve a Pointer Position to the First Model Face Hit
    // ------------------------------------------------------------
    // Returns { point, normalX, normalZ } in scene units, or null when the
    // click landed on nothing.
    // ------------------------------------------------------------
    function Na__ElevPick__HitAt(clientX, clientY) {
        if (!Na__ElevPick__Renderer || !Na__ElevPick__Camera || !Na__ElevPick__ModelRoot) return null;

        const rect = Na__ElevPick__Renderer.domElement.getBoundingClientRect();
        Na__ElevPick__Ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        Na__ElevPick__Ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        Na__ElevPick__Raycaster.setFromCamera(Na__ElevPick__Ndc, Na__ElevPick__Camera);

        const meshes = [];
        Na__ElevPick__ModelRoot.traverse((child) => {
            if (child.isMesh && child.visible) meshes.push(child);
        });
        if (meshes.length === 0) return null;

        const hits = Na__ElevPick__Raycaster.intersectObjects(meshes, false);
        if (hits.length === 0 || !hits[0].face) return null;

        const hit    = hits[0];
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); // <-- World-space face normal
        const flat   = new THREE.Vector3(normal.x, 0, normal.z);
        if (flat.lengthSq() < Na__ElevPick__HORIZONTAL_THRESHOLD) {
            flat.set(Na__ElevPick__FALLBACK_NORMAL.x, 0, Na__ElevPick__FALLBACK_NORMAL.z); // <-- Roof or floor: face +Z
        }
        flat.normalize();

        return { point : hit.point.clone(), normalX : flat.x, normalZ : flat.z };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer and Key Handlers
// -----------------------------------------------------------------------------

    // HANDLER | Pointer Down - Remember Where the Press Started
    // ------------------------------------------------------------
    function Na__ElevPick__HandlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        Na__ElevPick__PointerDown = true;
        Na__ElevPick__DownX       = event.clientX;
        Na__ElevPick__DownY       = event.clientY;
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Up - A Short Press Is a Pick, a Long One Was an Orbit
    // ------------------------------------------------------------
    function Na__ElevPick__HandlePointerUp(event) {
        if (!Na__ElevPick__PointerDown) return;
        Na__ElevPick__PointerDown = false;

        const threshold = Na__ElevCfg__GetFacePickSetup().clickThresholdPx;
        if (Math.abs(event.clientX - Na__ElevPick__DownX) > threshold
            || Math.abs(event.clientY - Na__ElevPick__DownY) > threshold) {
            return;                                                              // <-- Too much travel: an orbit drag, not a pick
        }

        const hit = Na__ElevPick__HitAt(event.clientX, event.clientY);
        if (!hit) return;                                                        // <-- Empty sky: stay armed

        const result = {
            azimuthDeg : Na__ElevData__AzimuthFromNormal(hit.normalX, hit.normalZ),
            originXMm  : Math.round(hit.point.x * Na__ElevPick__MM_PER_UNIT),
            originZMm  : Math.round(hit.point.z * Na__ElevPick__MM_PER_UNIT),
            hitYMm     : Math.round(hit.point.y * Na__ElevPick__MM_PER_UNIT)
        };

        const callback = Na__ElevPick__OnPicked;
        Na__ElevPick__Stop();
        if (typeof callback === 'function') callback(result);
    }
    // ------------------------------------------------------------


    // HANDLER | Escape Cancels an Armed Pick
    // ------------------------------------------------------------
    function Na__ElevPick__HandleKeyDown(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        Na__ElevPick__Cancel();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Detach Everything and Restore the Cursor
    // ------------------------------------------------------------
    function Na__ElevPick__Stop() {
        if (!Na__ElevPick__Active) return;
        const canvas = Na__ElevPick__Renderer ? Na__ElevPick__Renderer.domElement : null;
        if (canvas) {
            canvas.removeEventListener('pointerdown', Na__ElevPick__HandlePointerDown);
            canvas.removeEventListener('pointerup',   Na__ElevPick__HandlePointerUp);
            canvas.style.cursor = Na__ElevPick__PriorCursor;
        }
        window.removeEventListener('keydown', Na__ElevPick__HandleKeyDown, true);

        Na__ElevPick__Active      = false;
        Na__ElevPick__PointerDown = false;
        Na__ElevPick__OnPicked    = null;
        Na__ElevPick__OnCancelled = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Arm a Face Pick
    // ------------------------------------------------------------
    // context: { onPicked(result), onCancelled }
    //   result: { azimuthDeg, originXMm, originZMm, hitYMm }
    // ------------------------------------------------------------
    function Na__ElevPick__Start(context) {
        if (!Na__ElevPick__Renderer || !Na__ElevPick__Camera) return false;
        Na__ElevPick__Cancel();                                                  // <-- One pick at a time

        Na__ElevPick__Active      = true;
        Na__ElevPick__OnPicked    = (context && typeof context.onPicked === 'function')    ? context.onPicked    : null;
        Na__ElevPick__OnCancelled = (context && typeof context.onCancelled === 'function') ? context.onCancelled : null;

        const canvas = Na__ElevPick__Renderer.domElement;
        Na__ElevPick__PriorCursor = canvas.style.cursor;
        canvas.style.cursor = Na__ElevCfg__GetFacePickSetup().cursor;
        canvas.addEventListener('pointerdown', Na__ElevPick__HandlePointerDown);
        canvas.addEventListener('pointerup',   Na__ElevPick__HandlePointerUp);
        window.addEventListener('keydown', Na__ElevPick__HandleKeyDown, true);   // <-- Capture: beats the global hotkeys
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cancel an Armed Pick
    // ------------------------------------------------------------
    function Na__ElevPick__Cancel() {
        if (!Na__ElevPick__Active) return false;
        const callback = Na__ElevPick__OnCancelled;
        Na__ElevPick__Stop();
        if (typeof callback === 'function') callback();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Pick Armed?
    // ------------------------------------------------------------
    function Na__ElevPick__IsActive() {
        return Na__ElevPick__Active;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Pick at a Different Model Root
    // ------------------------------------------------------------
    function Na__ElevPick__SetModelRoot(modelRoot) {
        Na__ElevPick__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Face Pick
    // ------------------------------------------------------------
    // context: { renderer, camera, modelRoot }
    // ------------------------------------------------------------
    function Na__ElevPick__Initialize(context) {
        if (!context || !context.renderer || !context.camera) {
            console.warn('[TrueVision3D] Elevation face pick init skipped - missing renderer or camera.');
            return false;
        }
        Na__ElevPick__Renderer  = context.renderer;
        Na__ElevPick__Camera    = context.camera;
        Na__ElevPick__ModelRoot = context.modelRoot || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Face Pick API
    // ------------------------------------------------------------
    export {
        Na__ElevPick__Initialize,
        Na__ElevPick__SetModelRoot,
        Na__ElevPick__Start,
        Na__ElevPick__Cancel,
        Na__ElevPick__IsActive
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
