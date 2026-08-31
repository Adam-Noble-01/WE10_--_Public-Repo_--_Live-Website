// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__SectionCut__Engine__.js
// NAMESPACE  : Na__SectionCut
// MODULE     : Section Cut Engine - System Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Live boolean-style section cuts with solid cap fills and clean profiles
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - This module answers "what gets CUT"; Na__SectionCut__CapMeshes__ answers
//   "what gets DRAWN". It owns the plane registry, the live clipping plane
//   array and the public API the floor plan system drives.
// - Exactly ONE plane cuts at a time. A floor plan shows one storey, so the
//   multi-plane cross-clipping the ValeVision cross section tool performs is
//   not needed here and is deliberately absent.
// - The active plane is applied to every model material as a THREE clipping
//   plane (renderer.localClippingEnabled), so the half-space above the cut
//   disappears from the model, its shadows and the profile-line passes.
// - The clip array instance is MUTATED, never replaced. Materials hold a
//   reference to it, so moving a datum only changes plane.constant - no scene
//   re-traversal, which is what keeps slider dragging smooth on a full house.
// - The public API is deliberately plan-shaped: callers give a cut height in
//   millimetres rather than constructing a THREE.Plane themselves.
//
// INTEGRATION:
// - Na__SectionCut__Initialize() is called once from Index.html after the
//   renderer, scene and model root exist.
// - Na__FloorPlan__ModeController__ drives Upsert / SetActive / Remove.
// - The render loop calls Na__SectionCut__RenderOverlay(camera) each frame
//   immediately after the composer (or the flat plan render).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder. The cut/fill maths is
//   the ported ValeVision engine; the driver around it is new and carries
//   none of the face-selection, gizmo, flip or placement-mode UX.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop and Shared Clipping State
    // ------------------------------------------------------------
    // The profile-line pass renders with override materials, which bypass
    // per-mesh clippingPlanes. It reads the live plane array from the shared
    // state module instead - without this the linework keeps drawing the
    // roof that the cut has already removed.
    // @delegate: ../05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import {
        Na__SectionClipping__SetPlanes,
        Na__SectionClipping__SetOverlayRenderer
    } from '../05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cap Meshes, Overlay Scene and Config State
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__CapMeshes__.js
    // @delegate: ./Na__SectionCut__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__SectMesh__EnsureOverlayScene,
        Na__SectMesh__BuildMeshes,
        Na__SectMesh__DisposeMeshes,
        Na__SectMesh__HideMeshes,
        Na__SectMesh__RepaintAll,
        Na__SectMesh__HandleResize,
        Na__SectMesh__RecomputeCaps,
        Na__SectMesh__RenderOverlay
    } from './Na__SectionCut__CapMeshes__.js';
    import {
        Na__SectCutCfg__Load,
        Na__SectCutCfg__DragThrottleMs,
        Na__SectCutCfg__GetAppearance,
        Na__SectCutCfg__SetAppearance
    } from './Na__SectionCut__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Plan Cut Plane Normal
    // ------------------------------------------------------------
    // Points DOWN, so the KEPT half-space is everything below the cut - which
    // is exactly what a floor plan shows. With this normal a plane at world
    // height h has constant h, because distanceToPoint(p) = -p.y + h is
    // positive (kept) whenever p.y sits below h.
    // ------------------------------------------------------------
    const Na__SectCut__PLAN_NORMAL_X = 0;
    const Na__SectCut__PLAN_NORMAL_Y = -1;
    const Na__SectCut__PLAN_NORMAL_Z = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Render Context (set once at init)
    // ------------------------------------------------------------
    let Na__SectCut__Renderer     = null;   // <-- WebGLRenderer (localClippingEnabled is switched on here)
    let Na__SectCut__ModelRoot    = null;   // <-- Object3D holding the loaded model groups
    let Na__SectCut__PipelineRef  = null;   // <-- Mutable ref to post-processing state (profile line cache)
    let Na__SectCut__Initialized  = false;  // <-- Guard so every public call is a safe no-op before init
    // ------------------------------------------------------------

    // MODULE VARIABLES | Plane Registry and Live Clip List
    // ------------------------------------------------------------
    const Na__SectCut__Planes   = new Map();   // <-- id -> plane record
    let   Na__SectCut__ActiveId = null;        // <-- Id of the single cutting plane (null = no cut)
    const Na__SectCut__ClipList = [];          // <-- LIVE array handed to materials; mutated in place, never replaced
    // ------------------------------------------------------------

    // MODULE VARIABLES | Config Load Promise and Drag Throttle
    // ------------------------------------------------------------
    let Na__SectCut__LoadPromise     = null;   // <-- One-time config load, so init can be awaited
    let Na__SectCut__ThrottleTimer   = null;   // <-- Active throttle window while a datum slider moves
    let Na__SectCut__ThrottlePending = null;   // <-- Id awaiting the trailing recompute
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipping Plane Application
// -----------------------------------------------------------------------------

    // FUNCTION | Apply the Live Clip List to Every Model Material
    // ------------------------------------------------------------
    // Re-invoked whenever the model root changes (design phase switch) or a
    // plane is activated, because a material swap replaces the instances that
    // were holding the array reference.
    // ------------------------------------------------------------
    function Na__SectCut__ApplyClippingToModel() {
        if (!Na__SectCut__ModelRoot) return;
        const clipList = Na__SectCut__ClipList.length > 0 ? Na__SectCut__ClipList : null;

        Na__SectCut__ModelRoot.traverse((obj) => {
            if (!obj.material) return;
            if (obj.userData && obj.userData.naSectionCutHelper) return;         // <-- Defensive: never clip our own helpers
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (let i = 0; i < materials.length; i++) {
                materials[i].clippingPlanes = clipList;                          // <-- Live array reference (or null when no cut)
                materials[i].clipShadows    = (clipList !== null);               // <-- Shadows follow the cut
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sync a Plane's Optional Back (View Depth) Plane
    // ------------------------------------------------------------
    // A second parallel plane with the opposite normal, offset into the kept
    // half-space. Only needed when a model has no floor slabs - without it an
    // upper-storey plan shows the storey below bleeding through. null gives
    // the normal infinite half-space cut.
    // ------------------------------------------------------------
    function Na__SectCut__UpdateBackPlane(record) {
        const depth = record.depthUnits;
        if (!Number.isFinite(depth) || depth <= 0) {
            record.backPlane = null;
            return;
        }
        if (!record.backPlane) record.backPlane = new THREE.Plane();
        const planePos = -record.plane.constant;                                 // <-- Position of the primary along its own normal
        record.backPlane.normal.copy(record.plane.normal).negate();              // <-- Kept side faces back toward the primary
        record.backPlane.constant = planePos + depth;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Live Clip List From the Active Plane
    // ------------------------------------------------------------
    function Na__SectCut__SyncClipList() {
        Na__SectCut__ClipList.length = 0;                                        // <-- Mutate: materials keep their reference

        const record = Na__SectCut__ActiveId ? Na__SectCut__Planes.get(Na__SectCut__ActiveId) : null;
        if (record && record.enabled) {
            Na__SectCut__ClipList.push(record.plane);
            if (record.backPlane) Na__SectCut__ClipList.push(record.backPlane);  // <-- Optional view depth below the cut
        }

        Na__SectCut__ApplyClippingToModel();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Invalidate the Profile Lines Scene Cache
    // ------------------------------------------------------------
    function Na__SectCut__InvalidateProfileCache() {
        const pipeline = Na__SectCut__PipelineRef && Na__SectCut__PipelineRef.current;
        if (pipeline && typeof pipeline.invalidateProfileLinesCache === 'function') {
            pipeline.invalidateProfileLinesCache();                              // <-- Cap meshes joined or left the scene
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cap Recomputation Scheduling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Recompute One Plane's Caps If It Is the Active Cut
    // ------------------------------------------------------------
    // A plane that is not the active cut contributes nothing to the view, so
    // it is hidden rather than recomputed and never costs anything.
    // ------------------------------------------------------------
    function Na__SectCut__RecomputeCaps(id) {
        const record = Na__SectCut__Planes.get(id);
        if (!record || !Na__SectCut__ModelRoot) return;

        if (!record.enabled || id !== Na__SectCut__ActiveId) {
            Na__SectMesh__HideMeshes(record);
            return;
        }
        Na__SectMesh__RecomputeCaps(record, Na__SectCut__ModelRoot);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Throttled Recompute for Continuous Slider Movement
    // ------------------------------------------------------------
    // Leading-edge recompute, then a trailing one after the gap, so a dragged
    // slider updates continuously without queueing a rebuild per pixel.
    // ------------------------------------------------------------
    function Na__SectCut__ThrottledRecompute(id) {
        if (Na__SectCut__ThrottleTimer !== null) {
            Na__SectCut__ThrottlePending = id;                                   // <-- Coalesce into the pending trailing pass
            return;
        }

        Na__SectCut__RecomputeCaps(id);

        Na__SectCut__ThrottleTimer = window.setTimeout(() => {
            Na__SectCut__ThrottleTimer = null;
            const pending = Na__SectCut__ThrottlePending;
            Na__SectCut__ThrottlePending = null;
            if (pending !== null) Na__SectCut__RecomputeCaps(pending);            // <-- Land on the final datum
        }, Na__SectCutCfg__DragThrottleMs());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Plane Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create or Update a Horizontal Cut Plane by Id
    // ------------------------------------------------------------
    // cutHeightMm is the absolute world height of the cut in millimetres.
    // The kept half-space is everything BELOW it, which is what a floor plan
    // shows. depthMm is optional (null = infinite cut downward).
    // ------------------------------------------------------------
    function Na__SectionCut__UpsertHorizontalPlane(id, cutHeightMm, depthMm) {
        if (!Na__SectCut__Initialized || !id) return false;
        if (!Number.isFinite(cutHeightMm)) return false;

        Na__SectMesh__EnsureOverlayScene();

        const heightUnits = Na__Math__ConvertMmToUnits(cutHeightMm);
        const depthUnits  = (Number.isFinite(depthMm) && depthMm > 0)
            ? Na__Math__ConvertMmToUnits(depthMm)
            : null;

        let record = Na__SectCut__Planes.get(id);
        if (!record) {
            const meshes = Na__SectMesh__BuildMeshes(id);
            record = {
                id          : id,
                plane       : new THREE.Plane(
                    new THREE.Vector3(Na__SectCut__PLAN_NORMAL_X, Na__SectCut__PLAN_NORMAL_Y, Na__SectCut__PLAN_NORMAL_Z),
                    heightUnits
                ),
                backPlane   : null,
                depthUnits  : depthUnits,
                capMesh     : meshes.capMesh,
                outlineMesh : meshes.outlineMesh,
                enabled     : true
            };
            Na__SectCut__Planes.set(id, record);
        } else {
            record.plane.normal.set(Na__SectCut__PLAN_NORMAL_X, Na__SectCut__PLAN_NORMAL_Y, Na__SectCut__PLAN_NORMAL_Z);
            record.plane.constant = heightUnits;                                 // <-- Mutated in place: materials keep their reference
            record.depthUnits     = depthUnits;
        }

        Na__SectCut__UpdateBackPlane(record);
        Na__SectCut__SyncClipList();
        if (id === Na__SectCut__ActiveId) Na__SectCut__RecomputeCaps(id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move an Existing Plane to a New Cut Height (Slider Fast Path)
    // ------------------------------------------------------------
    // liveDrag true throttles the cap rebuild; call once more with false on
    // release so the final datum always gets an exact, unthrottled pass.
    // ------------------------------------------------------------
    function Na__SectionCut__SetPlaneHeightMm(id, cutHeightMm, liveDrag) {
        const record = Na__SectCut__Planes.get(id);
        if (!record || !Number.isFinite(cutHeightMm)) return false;

        record.plane.constant = Na__Math__ConvertMmToUnits(cutHeightMm);          // <-- In-place mutation, no re-traversal
        Na__SectCut__UpdateBackPlane(record);

        if (id === Na__SectCut__ActiveId) {
            if (liveDrag === true) {
                Na__SectCut__ThrottledRecompute(id);
            } else {
                Na__SectCut__RecomputeCaps(id);
            }
        }
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make One Plane the Single Active Cut (null Clears the Cut)
    // ------------------------------------------------------------
    function Na__SectionCut__SetActivePlane(id) {
        if (!Na__SectCut__Initialized) return false;
        if (id !== null && !Na__SectCut__Planes.has(id)) return false;

        const previousId = Na__SectCut__ActiveId;
        Na__SectCut__ActiveId = id;

        // Hide the outgoing plane's visuals before the new cut is applied.
        if (previousId && previousId !== id) {
            Na__SectMesh__HideMeshes(Na__SectCut__Planes.get(previousId));
        }

        Na__SectCut__SyncClipList();
        if (id) Na__SectCut__RecomputeCaps(id);
        Na__SectCut__InvalidateProfileCache();
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove One Plane and Dispose Its Geometry
    // ------------------------------------------------------------
    function Na__SectionCut__RemovePlane(id) {
        const record = Na__SectCut__Planes.get(id);
        if (!record) return false;

        if (Na__SectCut__ActiveId === id) Na__SectCut__ActiveId = null;

        Na__SectMesh__DisposeMeshes(record);
        Na__SectCut__Planes.delete(id);

        Na__SectCut__SyncClipList();
        Na__SectCut__InvalidateProfileCache();
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove Every Plane and Clear the Cut
    // ------------------------------------------------------------
    function Na__SectionCut__RemoveAllPlanes() {
        const ids = Array.from(Na__SectCut__Planes.keys());
        for (let i = 0; i < ids.length; i++) Na__SectionCut__RemovePlane(ids[i]);
        Na__SectCut__ActiveId = null;
        Na__SectCut__SyncClipList();
    }
    // ------------------------------------------------------------


    // FUNCTION | Force an Immediate Cap Rebuild for the Active Plane
    // ------------------------------------------------------------
    // Called after the model finishes loading or a design phase is switched,
    // because the cut geometry depends on which meshes are in the scene.
    // ------------------------------------------------------------
    function Na__SectionCut__RecomputeActive() {
        if (Na__SectCut__ActiveId) Na__SectCut__RecomputeCaps(Na__SectCut__ActiveId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Render Integration
// -----------------------------------------------------------------------------

    // FUNCTION | Draw the Section Overlay After the Main Render
    // ------------------------------------------------------------
    // No active cut means nothing to draw, so this costs nothing in the
    // ordinary 3D case where no floor plan is showing.
    // ------------------------------------------------------------
    function Na__SectionCut__RenderOverlay(camera) {
        if (!Na__SectCut__ActiveId) return;
        Na__SectMesh__RenderOverlay(Na__SectCut__Renderer, camera);
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Fat-Line Resolution After a Viewport Resize
    // ------------------------------------------------------------
    function Na__SectionCut__HandleResize(width, height) {
        Na__SectMesh__HandleResize(Na__SectCut__Planes, width, height);
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Engine at a Different Model Root
    // ------------------------------------------------------------
    // Design phase switches replace the loaded meshes wholesale, so both the
    // clip assignment and the cap geometry have to be redone.
    // ------------------------------------------------------------
    function Na__SectionCut__SetModelRoot(modelRoot) {
        Na__SectCut__ModelRoot = modelRoot || null;
        Na__SectCut__ApplyClippingToModel();
        Na__SectionCut__RecomputeActive();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - State Queries and Appearance
// -----------------------------------------------------------------------------

    // FUNCTION | Is a Cut Currently Active?
    // ------------------------------------------------------------
    function Na__SectionCut__IsCutting() {
        return Na__SectCut__ActiveId !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Active Plane Id (null When Not Cutting)
    // ------------------------------------------------------------
    function Na__SectionCut__GetActivePlaneId() {
        return Na__SectCut__ActiveId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Current Cut Appearance
    // ------------------------------------------------------------
    function Na__SectionCut__GetAppearance() {
        return Na__SectCutCfg__GetAppearance();
    }
    // ------------------------------------------------------------


    // FUNCTION | Override the Cut Appearance Live
    // ------------------------------------------------------------
    function Na__SectionCut__SetAppearance(appearance) {
        if (Na__SectCutCfg__SetAppearance(appearance)) {
            Na__SectMesh__RepaintAll(Na__SectCut__Planes);                       // <-- Only repaint when something actually changed
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Section Cut Engine
    // ------------------------------------------------------------
    // Safe to call before any model exists; planes can be registered later
    // and SetModelRoot re-applies everything once geometry has loaded.
    // ------------------------------------------------------------
    function Na__SectionCut__Initialize(context) {
        if (!context || !context.renderer) {
            console.warn('[TrueVision3D] Section cut engine init skipped - no renderer supplied.');
            return Promise.resolve(false);
        }

        Na__SectCut__Renderer    = context.renderer;
        Na__SectCut__ModelRoot   = context.modelRoot   || null;
        Na__SectCut__PipelineRef = context.pipelineRef || null;
        Na__SectCut__Initialized = true;

        Na__SectCut__Renderer.localClippingEnabled = true;                       // <-- Zero cost until a plane exists

        Na__SectMesh__EnsureOverlayScene();

        // SHARED STATE | Profile-line override passes follow this same array
        Na__SectionClipping__SetPlanes(Na__SectCut__ClipList);
        Na__SectionClipping__SetOverlayRenderer(Na__SectionCut__RenderOverlay);

        // Meshes built before the fetch settles are repainted by the callback.
        if (!Na__SectCut__LoadPromise) {
            Na__SectCut__LoadPromise = Na__SectCutCfg__Load(
                () => Na__SectMesh__RepaintAll(Na__SectCut__Planes)
            );
        }
        return Na__SectCut__LoadPromise;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Cut Engine API
    // ------------------------------------------------------------
    export {
        Na__SectionCut__Initialize,
        Na__SectionCut__UpsertHorizontalPlane,
        Na__SectionCut__SetPlaneHeightMm,
        Na__SectionCut__SetActivePlane,
        Na__SectionCut__RemovePlane,
        Na__SectionCut__RemoveAllPlanes,
        Na__SectionCut__RecomputeActive,
        Na__SectionCut__RenderOverlay,
        Na__SectionCut__HandleResize,
        Na__SectionCut__SetModelRoot,
        Na__SectionCut__IsCutting,
        Na__SectionCut__GetActivePlaneId,
        Na__SectionCut__GetAppearance,
        Na__SectionCut__SetAppearance
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
