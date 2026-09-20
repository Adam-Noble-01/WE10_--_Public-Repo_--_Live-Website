// =============================================================================
// TRUEVISION3D - DRAWING PLANES - GRIP
// =============================================================================
//
// FILE       : Na__DrawingPlanes__Grip__.js
// NAMESPACE  : Na__PlaneGrip
// MODULE     : Drawing Planes - Grip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Grab a drawing plane in the 3D view and move it along its own normal, snapped; or send it to a picked building face
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT CAN BE GRABBED. The three corner grips and the name tab of ANY plane
//   that is up, always - and the whole face of the SELECTED plane, where the
//   building is not in front of it. The face is not a handle on every plane
//   because with all of them switched on the planes cover most of the screen,
//   and a press meant as an orbit would move a drawing instead. Pressing a
//   grip selects its plane, so the second grab can be anywhere on it.
//
// - THE PLANE ONLY TRAVELS ALONG ITS NORMAL. The pointer ray is solved for its
//   closest point on the axis through the grab point along the normal, as the
//   old gizmo grip did, so a plane never slides sideways. The ABSOLUTE position
//   is then snapped (see Na__DrawingPlanes__Maths__) and written through the
//   source's own setter - the same fields the panel's sliders write.
//
// - NUMBERS WHILE DRAGGING. The old ValeVision drag had no numeric feedback. A
//   small readout follows the pointer with the plane's position, how far it
//   has come, and the grid it is landing on.
//
// - A PLANE FACING THE CAMERA CANNOT BE DRAGGED WELL. With the normal pointing
//   down the view, one pixel is metres. Inside the config's angle the plane
//   holds still and the readout asks for a better view.
//
// - MOVE TO FACE AND AIM AT FACE. Arm one from a row, then click a building
//   face. A press that travels was an orbit, so the view can be turned between
//   arming and clicking. What the click MEANS is the source's business: an
//   elevation slides to the face (or turns to face it); a floor plan reads a
//   floor as a floor level. Escape cancels.
//
// - ESCAPE, in order: cancels an armed pick, else abandons a drag and puts the
//   plane back, else deselects. A click on nothing deselects too.
//
// - INERT UNTIL A PLANE IS UP. The canvas listeners are attached when the
//   first plane appears and removed when the last one goes, so the live app,
//   where no plane is ever shown, carries none of this.
//
// - NOTHING HERE READS object.visible. Between frames the overlay is always
//   invisible (Na__InteractiveOverlays); what the pointer is over is worked
//   out from each plane's frame.
//
// INTEGRATION:
// - Initialised from Index.html with the renderer, camera, orbit controls,
//   model root and toast.
// - Na__DrawingPlanes__DevMenu__Controls__ arms and cancels picks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. Supersedes Na__Elevation__GizmoGrip__ and
//                   Na__Elevation__FacePick__ there when it is.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core, Render Loop, Units and the Drawing Broker
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import {
        Na__RenderLoop__RequestRender,
        Na__RenderLoop__RequestActiveRender,
        Na__RenderLoop__StopActiveRender,
        Na__RenderLoop__IsPaused
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes Config, Maths, Mesh Regions and Overlay
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawingPlanes__ConfigState__.js
    // @delegate: ./Na__DrawingPlanes__Maths__.js
    // @delegate: ./Na__DrawingPlanes__Overlay__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneCfg__GetGripSetup,
        Na__PlaneCfg__GetLabel
    } from './Na__DrawingPlanes__ConfigState__.js';
    import {
        Na__PlaneMath__ApplySnap,
        Na__PlaneMath__FormatMm,
        Na__PlaneMath__ClosestParamOnAxis,
        Na__PlaneMath__IsAxisTooSteep,
        Na__PlaneMath__FrameNormal,
        Na__PlaneMath__RayToFrame,
        Na__PlaneMath__RegionAt
    } from './Na__DrawingPlanes__Maths__.js';
    import { Na__PlaneMesh__REGION_FACE } from './Na__DrawingPlanes__PlaneMesh__.js';
    import {
        Na__PlaneOverlay__CHANGED_EVENT,
        Na__PlaneOverlay__GetSource,
        Na__PlaneOverlay__GetPlanes,
        Na__PlaneOverlay__HasPlanes,
        Na__PlaneOverlay__GetSelected,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__SetHover,
        Na__PlaneOverlay__RefreshOne,
        Na__PlaneOverlay__GetSnap,
        Na__PlaneOverlay__Announce
    } from './Na__DrawingPlanes__Overlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Render Loop Reason, Pick Modes and Timings
    // ------------------------------------------------------------
    const Na__PlaneGrip__RENDER_REASON  = 'drawing-plane-grip';
    const Na__PlaneGrip__MODE_MOVE      = 'move';      // <-- Keep the bearing, move to the face
    const Na__PlaneGrip__MODE_AIM       = 'aim';       // <-- Turn to face the wall, then move to it
    const Na__PlaneGrip__MESH_CACHE_MS  = 1000;        // <-- How long a hover reuses the list of visible meshes
    const Na__PlaneGrip__OCCLUSION_MS   = 60;          // <-- How often a hover re-asks whether the building hides the face
    const Na__PlaneGrip__READOUT_ID     = 'naDrawingPlaneReadout';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References
    // ------------------------------------------------------------
    let Na__PlaneGrip__Renderer  = null;
    let Na__PlaneGrip__Camera    = null;
    let Na__PlaneGrip__Controls  = null;
    let Na__PlaneGrip__ModelRoot = null;
    let Na__PlaneGrip__ShowToast = null;
    let Na__PlaneGrip__Attached  = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Drag, Pick and Click Tracking
    // ------------------------------------------------------------
    let Na__PlaneGrip__Drag  = null;   // <-- { key, type, id, record, source, axisOrigin, axisDir, startParam, startMm, lastMm, downX, downY, moved, lastLiveMs, priorControls, steep }
    let Na__PlaneGrip__Pick  = null;   // <-- { type, id, mode, pointerDown, downX, downY, priorCursor }
    let Na__PlaneGrip__Click = null;   // <-- { x, y } of a press this module did not take, for click-on-nothing
    // ------------------------------------------------------------

    // MODULE VARIABLES | Raycasting and the Occlusion Cache
    // ------------------------------------------------------------
    const Na__PlaneGrip__Raycaster = new THREE.Raycaster();
    const Na__PlaneGrip__Ndc       = new THREE.Vector2();
    let   Na__PlaneGrip__Meshes    = null;   // <-- Visible model meshes, reused briefly while hovering
    let   Na__PlaneGrip__MeshesAt  = 0;
    let   Na__PlaneGrip__HiddenAt  = 0;      // <-- When the hover last asked about occlusion
    let   Na__PlaneGrip__HiddenWas = false;  // <-- And what the answer was
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rays, Hits and Occlusion
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Aim the Raycaster From a Pointer Event
    // ------------------------------------------------------------
    function Na__PlaneGrip__AimRay(event) {
        const rect = Na__PlaneGrip__Renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        Na__PlaneGrip__Ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        Na__PlaneGrip__Ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        Na__PlaneGrip__Raycaster.setFromCamera(Na__PlaneGrip__Ndc, Na__PlaneGrip__Camera);
        return Na__PlaneGrip__Raycaster.ray;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | May a Plane Be Touched Right Now?
    // ------------------------------------------------------------
    // Only in the plain 3D view: not over a drawing, not while a sheet or an
    // export holds the render loop, and not while something else - walk, fly -
    // has taken the orbit controls.
    // ------------------------------------------------------------
    function Na__PlaneGrip__CanInteract() {
        if (!Na__PlaneGrip__Renderer || !Na__PlaneGrip__Camera) return false;
        if (!Na__PlaneOverlay__HasPlanes()) return false;
        if (Na__DrawView__GetCamera()) return false;
        if (Na__RenderLoop__IsPaused()) return false;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Model's Visible Meshes
    // ------------------------------------------------------------
    // traverseVisible, not traverse: a category switched off in the layer panel
    // hides its GROUP, and its meshes still say visible.
    // ------------------------------------------------------------
    function Na__PlaneGrip__VisibleMeshes(fresh) {
        const now = performance.now();
        if (!fresh && Na__PlaneGrip__Meshes && (now - Na__PlaneGrip__MeshesAt) < Na__PlaneGrip__MESH_CACHE_MS) return Na__PlaneGrip__Meshes;
        const meshes = [];
        if (Na__PlaneGrip__ModelRoot) {
            Na__PlaneGrip__ModelRoot.traverseVisible((child) => { if (child.isMesh) meshes.push(child); });
        }
        Na__PlaneGrip__Meshes   = meshes;
        Na__PlaneGrip__MeshesAt = now;
        return meshes;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Building in Front of a Point Along the Current Ray?
    // ------------------------------------------------------------
    function Na__PlaneGrip__IsHidden(distance, fresh) {
        const meshes = Na__PlaneGrip__VisibleMeshes(fresh);
        if (meshes.length === 0) return false;
        const priorFar = Na__PlaneGrip__Raycaster.far;
        Na__PlaneGrip__Raycaster.far = Math.max(0, distance - 0.002);            // <-- A wall the plane lies ON does not hide it
        Na__PlaneGrip__Raycaster.layers.set(0);
        const hits = Na__PlaneGrip__Raycaster.intersectObjects(meshes, false);
        Na__PlaneGrip__Raycaster.far = priorFar;
        return hits.length > 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Is the Ray Over?
    // ------------------------------------------------------------
    // Grips and name tabs first, nearest wins - they are drawn over everything,
    // so they are hit through everything. Then the face of the selected plane,
    // unless the building hides it there. occlusion: 'fresh' | 'cached' | 'skip'.
    // Returns { plane, region, distance } or null.
    // ------------------------------------------------------------
    function Na__PlaneGrip__HitTest(ray, occlusion) {
        const planes = Na__PlaneOverlay__GetPlanes();
        let best = null, selected = null;

        for (let i = 0; i < planes.length; i++) {
            const plane = planes[i];
            if (plane.selected) selected = plane;
            const hit = Na__PlaneMath__RayToFrame(plane.frame, ray.origin, ray.direction);
            if (!hit) continue;
            const region = Na__PlaneMath__RegionAt(plane.regions, hit.x, hit.y);
            if (!region) continue;
            if (!best || hit.distance < best.distance) best = { plane : plane, region : region, distance : hit.distance };
        }
        if (best) return best;
        if (!selected) return null;

        const face = Na__PlaneMath__RayToFrame(selected.frame, ray.origin, ray.direction);
        if (!face || !face.inside) return null;

        if (occlusion === 'cached') {
            const now = performance.now();
            if ((now - Na__PlaneGrip__HiddenAt) >= Na__PlaneGrip__OCCLUSION_MS) {
                Na__PlaneGrip__HiddenAt  = now;
                Na__PlaneGrip__HiddenWas = Na__PlaneGrip__IsHidden(face.distance, false);
            }
            if (Na__PlaneGrip__HiddenWas) return null;
        } else if (occlusion === 'fresh') {
            if (Na__PlaneGrip__IsHidden(face.distance, true)) return null;
        }
        return { plane : selected, region : Na__PlaneMesh__REGION_FACE, distance : face.distance };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drag Readout
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Show or Move the Readout Beside the Pointer
    // ------------------------------------------------------------
    function Na__PlaneGrip__ShowReadout(event, lines, colour) {
        let box = document.getElementById(Na__PlaneGrip__READOUT_ID);
        if (!box) {
            box = document.createElement('div');
            box.id        = Na__PlaneGrip__READOUT_ID;
            box.className = 'na-plane-readout';
            document.body.appendChild(box);
        }
        box.style.borderLeftColor = colour || '';
        box.textContent = '';
        for (let i = 0; i < lines.length; i++) {
            const line = document.createElement('div');
            line.className   = (i === 0) ? 'na-plane-readout__name' : 'na-plane-readout__value';
            line.textContent = lines[i];
            box.appendChild(line);
        }
        box.style.left = (event.clientX + 18) + 'px';
        box.style.top  = (event.clientY + 18) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Readout Away
    // ------------------------------------------------------------
    function Na__PlaneGrip__HideReadout() {
        const box = document.getElementById(Na__PlaneGrip__READOUT_ID);
        if (box && box.parentNode) box.parentNode.removeChild(box);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Readout Says About a Drag
    // ------------------------------------------------------------
    function Na__PlaneGrip__DragLines(drag) {
        const source = drag.source;
        const nowMm  = source.getPositionMm(drag.record);
        const snap   = Na__PlaneOverlay__GetSnap();

        const lines = [ String(source.getName(drag.record) || '').toUpperCase() ];
        lines.push((typeof source.describe === 'function') ? source.describe(drag.record) : (Na__PlaneMath__FormatMm(nowMm) + ' mm'));

        const delta = Math.round(nowMm - drag.startMm);
        lines.push((delta >= 0 ? '+' : '-') + Na__PlaneMath__FormatMm(Math.abs(delta)) + ' mm   '
            + (snap.enabled ? ('snap ' + snap.incrementMm + ' mm') : 'free'));
        if (drag.steep) lines.push(Na__PlaneCfg__GetLabel('BetterAngleHint', 'orbit round - this plane is facing you'));
        return lines;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Begin a Drag on a Hit
    // ------------------------------------------------------------
    function Na__PlaneGrip__BeginDrag(event, ray, hit) {
        const plane  = hit.plane;
        const normal = Na__PlaneMath__FrameNormal(plane.frame);
        const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
        const axisDir    = { x : normal.x / length, y : normal.y / length, z : normal.z / length };
        const axisOrigin = {
            x : ray.origin.x + (ray.direction.x * hit.distance),
            y : ray.origin.y + (ray.direction.y * hit.distance),
            z : ray.origin.z + (ray.direction.z * hit.distance)
        };
        const solve = Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, ray.origin, ray.direction);

        Na__PlaneGrip__Drag = {
            key           : plane.key,
            type          : plane.type,
            id            : plane.id,
            record        : plane.record,
            source        : plane.source,
            colour        : plane.colour,
            axisOrigin    : axisOrigin,
            axisDir       : axisDir,
            startParam    : solve ? solve.param : 0,
            startMm       : plane.source.getPositionMm(plane.record),
            lastMm        : null,
            downX         : event.clientX,
            downY         : event.clientY,
            moved         : false,
            lastLiveMs    : 0,
            steep         : false,
            priorControls : Na__PlaneGrip__Controls ? Na__PlaneGrip__Controls.enabled : null
        };

        Na__PlaneOverlay__Select(plane.type, plane.id);                          // <-- Pressing a grip selects its plane
        if (Na__PlaneGrip__Controls) Na__PlaneGrip__Controls.enabled = false;    // <-- Suppress orbit while dragging
        Na__PlaneGrip__Renderer.domElement.style.cursor = Na__PlaneCfg__GetGripSetup().dragCursor;
        Na__RenderLoop__RequestActiveRender(Na__PlaneGrip__RENDER_REASON);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Step of a Drag
    // ------------------------------------------------------------
    function Na__PlaneGrip__StepDrag(event) {
        const drag  = Na__PlaneGrip__Drag;
        const setup = Na__PlaneCfg__GetGripSetup();

        if (!drag.moved) {
            const travelled = Math.max(Math.abs(event.clientX - drag.downX), Math.abs(event.clientY - drag.downY));
            if (travelled <= setup.clickThresholdPx) return;                     // <-- Still a click: a press that only selects must not nudge the plane
            drag.moved = true;
        }

        const ray = Na__PlaneGrip__AimRay(event);
        if (!ray) return;
        const solve = Na__PlaneMath__ClosestParamOnAxis(drag.axisOrigin, drag.axisDir, ray.origin, ray.direction);
        if (!solve) return;

        drag.steep = Na__PlaneMath__IsAxisTooSteep(solve.alignment, setup.minAxisAngleDeg);
        if (!drag.steep) {
            const deltaMm  = Na__Math__ConvertUnitsToMm(solve.param - drag.startParam);
            const targetMm = Na__PlaneMath__ApplySnap(drag.startMm + deltaMm, Na__PlaneOverlay__GetSnap());   // <-- The POSITION is snapped, never the distance dragged

            if (targetMm !== drag.lastMm) {
                drag.lastMm = targetMm;
                drag.source.setPositionMm(drag.record, targetMm);
                Na__PlaneOverlay__RefreshOne(drag.type, drag.id);

                // THROTTLED LIVE UPDATE | A live section recut is the expensive
                // part, so it follows at a steady cadence, not per pointer event.
                const now = performance.now();
                if (typeof drag.source.onLive === 'function' && (now - drag.lastLiveMs) >= setup.dragRecomputeMs) {
                    drag.lastLiveMs = now;
                    drag.source.onLive(drag.record);
                }
            }
        }
        Na__PlaneGrip__ShowReadout(event, Na__PlaneGrip__DragLines(drag), drag.colour);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End a Drag - Land It, or Put the Plane Back
    // ------------------------------------------------------------
    function Na__PlaneGrip__EndDrag(abandon) {
        const drag = Na__PlaneGrip__Drag;
        if (!drag) return;
        Na__PlaneGrip__Drag = null;

        if (Na__PlaneGrip__Controls && drag.priorControls !== null) Na__PlaneGrip__Controls.enabled = drag.priorControls;
        Na__PlaneGrip__Renderer.domElement.style.cursor = '';
        Na__RenderLoop__StopActiveRender(Na__PlaneGrip__RENDER_REASON);
        Na__PlaneGrip__HideReadout();

        if (drag.moved && drag.lastMm !== null) {
            if (abandon === true) drag.source.setPositionMm(drag.record, drag.startMm);
            Na__PlaneOverlay__RefreshOne(drag.type, drag.id);
            if (typeof drag.source.onCommit === 'function') drag.source.onCommit(drag.record);   // <-- Re-derive exactly, moved or put back
        }
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Face Pick
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The First Visible Model Face Under the Current Ray
    // ------------------------------------------------------------
    // Returns { pointMm, normal } - the point in millimetres and the face's
    // world normal turned toward the camera, so a back face seen through a
    // double-sided material still reads as the side that was clicked.
    // ------------------------------------------------------------
    function Na__PlaneGrip__FaceUnderRay() {
        const meshes = Na__PlaneGrip__VisibleMeshes(true);
        if (meshes.length === 0) return null;

        Na__PlaneGrip__Raycaster.layers.set(0);
        const hits = Na__PlaneGrip__Raycaster.intersectObjects(meshes, false);
        let hit = null;
        for (let i = 0; i < hits.length; i++) { if (hits[i].face) { hit = hits[i]; break; } }
        if (!hit) return null;

        const matrix = new THREE.Matrix4().copy(hit.object.matrixWorld);
        if (hit.object.isInstancedMesh && Number.isInteger(hit.instanceId)) {
            const instance = new THREE.Matrix4();
            hit.object.getMatrixAt(hit.instanceId, instance);
            matrix.multiply(instance);                                           // <-- An instance's face normal is in the instance's own space
        }
        const normal = hit.face.normal.clone().transformDirection(matrix);
        if (normal.dot(Na__PlaneGrip__Raycaster.ray.direction) > 0) normal.negate();

        return {
            pointMm : {
                x : Na__Math__ConvertUnitsToMm(hit.point.x),
                y : Na__Math__ConvertUnitsToMm(hit.point.y),
                z : Na__Math__ConvertUnitsToMm(hit.point.z)
            },
            normal  : { x : normal.x, y : normal.y, z : normal.z }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stand a Pick Down and Restore the Cursor
    // ------------------------------------------------------------
    function Na__PlaneGrip__StopPick() {
        const pick = Na__PlaneGrip__Pick;
        if (!pick) return null;
        Na__PlaneGrip__Pick = null;
        if (Na__PlaneGrip__Renderer) Na__PlaneGrip__Renderer.domElement.style.cursor = pick.priorCursor || '';
        Na__PlaneGrip__SyncAttached();
        Na__PlaneOverlay__Announce('pick');                                      // <-- The row's button goes back to its own wording
        return pick;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Click Landed While a Pick Was Armed
    // ------------------------------------------------------------
    function Na__PlaneGrip__CompletePick(event) {
        const pick = Na__PlaneGrip__Pick;
        const ray  = Na__PlaneGrip__AimRay(event);
        if (!ray) return;

        const face = Na__PlaneGrip__FaceUnderRay();
        if (!face) return;                                                       // <-- Empty sky: stay armed

        const source = Na__PlaneOverlay__GetSource(pick.type);
        const record = source ? (source.list() || []).find((entry) => source.getId(entry) === pick.id) : null;
        if (!source || !record || typeof source.applyFacePick !== 'function') { Na__PlaneGrip__StopPick(); return; }

        const message = source.applyFacePick(record, face, Na__PlaneOverlay__GetSnap(), pick.mode);
        if (message === null || message === undefined) return;                   // <-- Refused (a roof, for an aim): the source has said why; stay armed

        Na__PlaneGrip__StopPick();
        Na__PlaneOverlay__Select(pick.type, pick.id);
        Na__PlaneOverlay__RefreshOne(pick.type, pick.id);
        if (typeof source.onCommit === 'function') source.onCommit(record);
        if (message && typeof Na__PlaneGrip__ShowToast === 'function') Na__PlaneGrip__ShowToast(message, false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer and Key Handlers
// -----------------------------------------------------------------------------

    // HANDLER | Pointer Down - Take the Press If It Landed on a Plane
    // ------------------------------------------------------------
    function Na__PlaneGrip__HandlePointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        Na__PlaneGrip__Click = { x : event.clientX, y : event.clientY };

        if (Na__PlaneGrip__Pick) {                                               // <-- Armed: the press may be an orbit, so it is left alone and judged on release
            Na__PlaneGrip__Pick.pointerDown = true;
            Na__PlaneGrip__Pick.downX = event.clientX;
            Na__PlaneGrip__Pick.downY = event.clientY;
            return;
        }
        if (!Na__PlaneGrip__CanInteract()) return;
        if (Na__PlaneGrip__Controls && Na__PlaneGrip__Controls.enabled === false) return;   // <-- Walk or fly owns the pointer

        const ray = Na__PlaneGrip__AimRay(event);
        if (!ray) return;
        const hit = Na__PlaneGrip__HitTest(ray, 'fresh');
        if (!hit) return;

        Na__PlaneGrip__Click = null;                                             // <-- This press is ours, not a click on nothing
        Na__PlaneGrip__BeginDrag(event, ray, hit);
        event.preventDefault();
        event.stopImmediatePropagation();                                        // <-- Orbit, the context pick and the door click never see it
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Move - Drag, or Hover
    // ------------------------------------------------------------
    function Na__PlaneGrip__HandlePointerMove(event) {
        if (Na__PlaneGrip__Drag) {
            Na__PlaneGrip__StepDrag(event);
            event.preventDefault();
            return;
        }

        const canvas = Na__PlaneGrip__Renderer.domElement;
        const setup  = Na__PlaneCfg__GetGripSetup();
        const idle   = (event.buttons === 0) && (event.target === canvas) && !Na__PlaneGrip__Pick && Na__PlaneGrip__CanInteract();
        if (!idle) {
            if (Na__PlaneOverlay__SetHover(null, null) && !Na__PlaneGrip__Pick) canvas.style.cursor = '';
            return;
        }

        const ray = Na__PlaneGrip__AimRay(event);
        const hit = ray ? Na__PlaneGrip__HitTest(ray, 'cached') : null;
        const changed = hit ? Na__PlaneOverlay__SetHover(hit.plane.key, hit.region) : Na__PlaneOverlay__SetHover(null, null);
        if (changed) canvas.style.cursor = hit ? setup.hoverCursor : '';
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Up - Land a Drag, Complete a Pick, or Deselect
    // ------------------------------------------------------------
    function Na__PlaneGrip__HandlePointerUp(event) {
        if (Na__PlaneGrip__Drag) {
            Na__PlaneGrip__EndDrag(false);
            return;
        }

        const threshold = Na__PlaneCfg__GetGripSetup().clickThresholdPx;

        if (Na__PlaneGrip__Pick) {
            const pick = Na__PlaneGrip__Pick;
            if (!pick.pointerDown) return;
            pick.pointerDown = false;
            const travelled = Math.max(Math.abs(event.clientX - pick.downX), Math.abs(event.clientY - pick.downY));
            if (travelled > threshold) return;                                   // <-- Too much travel: an orbit drag, not a pick
            if (event.target !== Na__PlaneGrip__Renderer.domElement) return;
            Na__PlaneGrip__CompletePick(event);
            return;
        }

        // A CLICK ON NOTHING DESELECTS. Only a press this module did not take,
        // that did not travel, on the canvas, over no part of any plane.
        const click = Na__PlaneGrip__Click;
        Na__PlaneGrip__Click = null;
        if (!click || !Na__PlaneOverlay__GetSelected()) return;
        if (event.target !== Na__PlaneGrip__Renderer.domElement) return;
        if (Math.max(Math.abs(event.clientX - click.x), Math.abs(event.clientY - click.y)) > threshold) return;
        if (!Na__PlaneGrip__CanInteract()) return;

        const ray = Na__PlaneGrip__AimRay(event);
        if (ray && !Na__PlaneGrip__HitTest(ray, 'skip')) Na__PlaneOverlay__Select(null, null);
    }
    // ------------------------------------------------------------


    // HANDLER | Escape - Cancel a Pick, Abandon a Drag, or Deselect
    // ------------------------------------------------------------
    function Na__PlaneGrip__HandleKeyDown(event) {
        if (event.key !== 'Escape') return;

        if (Na__PlaneGrip__Pick) {
            event.preventDefault();
            event.stopPropagation();
            Na__PlaneGrip__StopPick();
            return;
        }
        if (Na__PlaneGrip__Drag) {
            event.preventDefault();
            event.stopPropagation();
            Na__PlaneGrip__EndDrag(true);
            return;
        }
        if (Na__PlaneOverlay__GetSelected() && Na__PlaneGrip__CanInteract()) {
            Na__PlaneOverlay__Select(null, null);                                // <-- Not consumed: Escape still closes whatever else it closes
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Attach or Detach the Listeners to Match What Is Up
    // ------------------------------------------------------------
    // Wanted while any plane is up or a pick is armed. A pick can be armed for
    // a plane that is not up yet - its row's eye toggle may be off.
    // ------------------------------------------------------------
    function Na__PlaneGrip__SyncAttached() {
        if (!Na__PlaneGrip__Renderer) return;
        const wanted = Na__PlaneOverlay__HasPlanes() || Na__PlaneGrip__Pick !== null || Na__PlaneGrip__Drag !== null;
        if (wanted === Na__PlaneGrip__Attached) return;

        const canvas = Na__PlaneGrip__Renderer.domElement;
        if (wanted) {
            canvas.addEventListener('pointerdown', Na__PlaneGrip__HandlePointerDown, true);   // <-- Capture: ahead of orbit and the other canvas tools
            window.addEventListener('pointermove', Na__PlaneGrip__HandlePointerMove);
            window.addEventListener('pointerup',   Na__PlaneGrip__HandlePointerUp);
            window.addEventListener('keydown',     Na__PlaneGrip__HandleKeyDown, true);        // <-- Capture: beats the global hotkeys
        } else {
            canvas.removeEventListener('pointerdown', Na__PlaneGrip__HandlePointerDown, true);
            window.removeEventListener('pointermove', Na__PlaneGrip__HandlePointerMove);
            window.removeEventListener('pointerup',   Na__PlaneGrip__HandlePointerUp);
            window.removeEventListener('keydown',     Na__PlaneGrip__HandleKeyDown, true);
            Na__PlaneGrip__Click  = null;
            Na__PlaneGrip__Meshes = null;
            canvas.style.cursor   = '';
        }
        Na__PlaneGrip__Attached = wanted;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Arm a Face Pick for One Plane, or Cancel the One Already Armed
    // ------------------------------------------------------------
    // mode: Na__PlaneGrip__MODE_MOVE or Na__PlaneGrip__MODE_AIM. Pressing the
    // same button again cancels. Returns 'armed', 'cancelled' or 'refused'.
    // ------------------------------------------------------------
    function Na__PlaneGrip__StartFacePick(type, id, mode) {
        const pick = Na__PlaneGrip__Pick;
        if (pick && pick.type === type && pick.id === id && pick.mode === mode) {
            Na__PlaneGrip__StopPick();
            return 'cancelled';
        }
        if (!Na__PlaneGrip__Renderer || !Na__PlaneGrip__Camera) return 'refused';

        if (Na__DrawView__GetCamera() || Na__RenderLoop__IsPaused()) {           // <-- A face is picked in the 3D view
            if (typeof Na__PlaneGrip__ShowToast === 'function') {
                Na__PlaneGrip__ShowToast(Na__PlaneCfg__GetLabel('PickNeeds3dMessage', 'Leave the drawing first - a face is picked in the 3D view.'), true);
            }
            return 'refused';
        }
        if (pick) Na__PlaneGrip__StopPick();                                     // <-- One pick at a time

        const canvas = Na__PlaneGrip__Renderer.domElement;
        Na__PlaneGrip__Pick = {
            type        : type,
            id          : id,
            mode        : (mode === Na__PlaneGrip__MODE_AIM) ? Na__PlaneGrip__MODE_AIM : Na__PlaneGrip__MODE_MOVE,
            pointerDown : false,
            downX       : 0,
            downY       : 0,
            priorCursor : canvas.style.cursor
        };
        canvas.style.cursor = Na__PlaneCfg__GetGripSetup().pickCursor;
        Na__PlaneOverlay__SetHover(null, null);
        Na__PlaneOverlay__Select(type, id);                                      // <-- The plane that is about to move is the one on show
        Na__PlaneGrip__SyncAttached();
        Na__PlaneOverlay__Announce('pick');

        if (typeof Na__PlaneGrip__ShowToast === 'function') {
            Na__PlaneGrip__ShowToast(Na__PlaneCfg__GetLabel('PickingHint', 'Click a building face in the 3D view. Drag to orbit first if you need to. Escape cancels.'), false);
        }
        return 'armed';
    }
    // ------------------------------------------------------------


    // FUNCTION | Cancel Any Armed Pick (of One Type, or of Any)
    // ------------------------------------------------------------
    function Na__PlaneGrip__CancelFacePick(type) {
        if (!Na__PlaneGrip__Pick) return false;
        if (type && Na__PlaneGrip__Pick.type !== type) return false;
        Na__PlaneGrip__StopPick();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Pick Armed for This Plane and Mode?
    // ------------------------------------------------------------
    function Na__PlaneGrip__IsPicking(type, id, mode) {
        const pick = Na__PlaneGrip__Pick;
        return Boolean(pick && pick.type === type && pick.id === id && (!mode || pick.mode === mode));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Drag in Progress?
    // ------------------------------------------------------------
    function Na__PlaneGrip__IsDragging() {
        return Na__PlaneGrip__Drag !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Grip at a Different Model Root
    // ------------------------------------------------------------
    function Na__PlaneGrip__SetModelRoot(modelRoot) {
        Na__PlaneGrip__ModelRoot = modelRoot || null;
        Na__PlaneGrip__Meshes    = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Grip
    // ------------------------------------------------------------
    // context: { renderer, camera, controls, modelRoot, showToast }
    // ------------------------------------------------------------
    function Na__PlaneGrip__Initialize(context) {
        if (!context || !context.renderer || !context.camera) {
            console.warn('[TrueVision3D] Drawing planes grip init skipped - missing renderer or camera.');
            return false;
        }
        Na__PlaneGrip__Renderer  = context.renderer;
        Na__PlaneGrip__Camera    = context.camera;
        Na__PlaneGrip__Controls  = context.controls  || null;
        Na__PlaneGrip__ModelRoot = context.modelRoot || null;
        Na__PlaneGrip__ShowToast = context.showToast || null;

        // Planes going up or coming down is what attaches and detaches the
        // listeners. A drag in progress on a plane that has just gone - its
        // drawing deleted from the panel - is abandoned.
        window.addEventListener(Na__PlaneOverlay__CHANGED_EVENT, () => {
            if (Na__PlaneGrip__Drag && !Na__PlaneOverlay__GetPlanes().some((plane) => plane.key === Na__PlaneGrip__Drag.key)) {
                Na__PlaneGrip__EndDrag(true);
            }
            Na__PlaneGrip__SyncAttached();
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Planes Grip API
    // ------------------------------------------------------------
    export {
        Na__PlaneGrip__MODE_MOVE,
        Na__PlaneGrip__MODE_AIM,
        Na__PlaneGrip__Initialize,
        Na__PlaneGrip__SetModelRoot,
        Na__PlaneGrip__StartFacePick,
        Na__PlaneGrip__CancelFacePick,
        Na__PlaneGrip__IsPicking,
        Na__PlaneGrip__IsDragging
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
