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
// - Owns a registry of named cut planes. Exactly ONE plane cuts at a time: a
//   floor plan shows one storey, so there is never a need for the multi-plane
//   cross-clipping the ValeVision cross section tool performs.
// - The active plane is applied to every model material as a THREE clipping
//   plane (renderer.localClippingEnabled), so the half-space above the cut
//   disappears from the model, its shadows and the profile-line passes.
// - Each plane owns a cap fill mesh (real triangulated geometry from
//   Na__SectionCut__CapGeometry__) and a fat-line profile outline. Together
//   these make a sliced wall read as solid poche rather than a hollow shell,
//   which is the whole reason this engine drives the plans.
// - Caps and outlines live in a SEPARATE overlay scene drawn after the
//   composer finishes, so fog, SSAO and the Sobel profile pass never touch
//   them. In plan mode the composer is bypassed entirely and the overlay is
//   drawn straight after a flat direct render.
// - Orientation-agnostic: it takes any THREE.Plane. The Floor Plan Views
//   system drives it with horizontal planes; nothing here assumes a plan.
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

    // MODULE IMPORTS | Three.js Core and Fat Lines
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
    import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
    import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
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

    // MODULE IMPORTS | Cap Geometry Engine
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__CapGeometry__.js
    // ------------------------------------------------------------
    import { Na__SectCap__ComputeSectionGeometry } from './Na__SectionCut__CapGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Fallback Values
    // ------------------------------------------------------------
    // Fallbacks mirror the shipped config exactly. They only ever apply if
    // the JSON fetch fails, in which case cuts still work and simply use the
    // default grey poche rather than silently doing nothing.
    // ------------------------------------------------------------
    const Na__SectCut__ConfigUrl        = new URL('./Na__SectionCut__Engine__AppConfig__.json', import.meta.url);
    const Na__SectCut__FB_FillColor     = '#f0f0f0';   // <-- Cut fill (poche) colour
    const Na__SectCut__FB_LineColor     = '#323232';   // <-- Profile outline colour
    const Na__SectCut__FB_LineWidthPx   = 2.0;         // <-- Profile outline width in screen pixels
    const Na__SectCut__FB_CapOffsetMm   = 0.6;         // <-- Fill nudge into the removed half-space (kills z-fighting)
    const Na__SectCut__FB_LineOffsetMm  = 1.4;         // <-- Outline sits just proud of the fill
    const Na__SectCut__FB_WeldTolMm     = 0.25;        // <-- Endpoint weld grid
    const Na__SectCut__FB_MinLoopAreaM2 = 0.0004;      // <-- Sliver loop rejection threshold
    const Na__SectCut__FB_MaxSegments   = 250000;      // <-- Hard safety cap per recompute
    const Na__SectCut__FB_ThrottleMs    = 90;          // <-- Cap rebuild throttle while a datum slider moves
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

    // MODULE VARIABLES | Overlay Scene and Plane Registry
    // ------------------------------------------------------------
    let Na__SectCut__OverlayScene = null;                 // <-- Separate scene: caps/outlines skip post-processing
    let Na__SectCut__CapRoot      = null;                 // <-- Group holding every cap + outline mesh
    const Na__SectCut__Planes     = new Map();            // <-- id -> plane record
    let Na__SectCut__ActiveId     = null;                 // <-- Id of the single cutting plane (null = no cut)
    const Na__SectCut__ClipList   = [];                   // <-- LIVE array handed to materials; mutated in place, never replaced
    // ------------------------------------------------------------

    // MODULE VARIABLES | Appearance and Tuning (config-backed)
    // ------------------------------------------------------------
    let Na__SectCut__Config      = null;
    let Na__SectCut__FillColor   = Na__SectCut__FB_FillColor;
    let Na__SectCut__LineColor   = Na__SectCut__FB_LineColor;
    let Na__SectCut__LineWidthPx = Na__SectCut__FB_LineWidthPx;
    let Na__SectCut__LoadPromise = null;                  // <-- In-flight config fetch, so it happens exactly once
    // ------------------------------------------------------------

    // MODULE VARIABLES | Throttled Recompute While a Datum Slider Is Dragged
    // ------------------------------------------------------------
    let Na__SectCut__ThrottleTimer   = null;
    let Na__SectCut__ThrottlePending = null;              // <-- Id awaiting a trailing recompute
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Access
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__SectCut__CfgVal(blockKey, valueKey, fallback) {
        if (!Na__SectCut__Config) return fallback;
        const block = Na__SectCut__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__SectCut__FetchConfig() {
        try {
            const response = await fetch(Na__SectCut__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Section cut config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__SectCut__Config = await response.json();
            Na__SectCut__FillColor   = Na__SectCut__CfgVal('SectionCut__Appearance__Config', 'SectionCut__Appearance__FillColor',   Na__SectCut__FillColor);
            Na__SectCut__LineColor   = Na__SectCut__CfgVal('SectionCut__Appearance__Config', 'SectionCut__Appearance__LineColor',   Na__SectCut__LineColor);
            Na__SectCut__LineWidthPx = Na__SectCut__CfgVal('SectionCut__Appearance__Config', 'SectionCut__Appearance__LineWidthPx', Na__SectCut__LineWidthPx);
            Na__SectCut__ApplyAppearanceToExistingMeshes();                      // <-- Planes created before the fetch settled
            return true;
        } catch (error) {
            console.warn('[TrueVision3D] Section cut config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Tuning Values in Scene Units
    // ------------------------------------------------------------
    function Na__SectCut__CapOffsetUnits() {
        return Na__Math__ConvertMmToUnits(Na__SectCut__CfgVal('SectionCut__Appearance__Config', 'SectionCut__Appearance__CapOffsetMm', Na__SectCut__FB_CapOffsetMm));
    }
    function Na__SectCut__LineOffsetUnits() {
        return Na__Math__ConvertMmToUnits(Na__SectCut__CfgVal('SectionCut__Appearance__Config', 'SectionCut__Appearance__LineOffsetMm', Na__SectCut__FB_LineOffsetMm));
    }
    function Na__SectCut__WeldTolUnits() {
        return Na__Math__ConvertMmToUnits(Na__SectCut__CfgVal('SectionCut__Update__Config', 'SectionCut__Update__WeldToleranceMm', Na__SectCut__FB_WeldTolMm));
    }
    function Na__SectCut__MinLoopArea() {
        return Na__SectCut__CfgVal('SectionCut__Update__Config', 'SectionCut__Update__MinLoopAreaM2', Na__SectCut__FB_MinLoopAreaM2);
    }
    function Na__SectCut__MaxSegments() {
        return Na__SectCut__CfgVal('SectionCut__Update__Config', 'SectionCut__Update__MaxCrossingSegments', Na__SectCut__FB_MaxSegments);
    }
    function Na__SectCut__DragThrottleMs() {
        return Na__SectCut__CfgVal('SectionCut__Update__Config', 'SectionCut__Update__DragRecomputeMs', Na__SectCut__FB_ThrottleMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Overlay Scene and Mesh Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Overlay Scene and Cap Root Exist
    // ------------------------------------------------------------
    function Na__SectCut__EnsureOverlayScene() {
        if (!Na__SectCut__OverlayScene) {
            Na__SectCut__OverlayScene = new THREE.Scene();                       // <-- No background or fog: composited colour survives underneath
            Na__SectCut__OverlayScene.name = 'Na__SectionCut__OverlayScene';
        }
        if (!Na__SectCut__CapRoot) {
            Na__SectCut__CapRoot = new THREE.Group();
            Na__SectCut__CapRoot.name = 'Na__SectionCut__CapRoot';
            Na__SectCut__CapRoot.userData.naSectionCutHelper = true;             // <-- Never let the cap engine cut its own output
            Na__SectCut__OverlayScene.add(Na__SectCut__CapRoot);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Cap Fill and Profile Outline Meshes for a Plane
    // ------------------------------------------------------------
    function Na__SectCut__BuildMeshes(id) {
        const capMaterial = new THREE.MeshBasicMaterial({
            color : new THREE.Color(Na__SectCut__FillColor),
            side  : THREE.DoubleSide,
            fog   : false
        });
        const capMesh = new THREE.Mesh(new THREE.BufferGeometry(), capMaterial);
        capMesh.name    = 'Na__SectionCut__CapFill__' + id;
        capMesh.userData.naSectionCutHelper = true;
        capMesh.renderOrder = 1;
        capMesh.visible = false;

        const outlineMaterial = new LineMaterial({
            color      : new THREE.Color(Na__SectCut__LineColor).getHex(),
            linewidth  : Na__SectCut__LineWidthPx,
            worldUnits : false
        });
        outlineMaterial.resolution.set(window.innerWidth, window.innerHeight);
        const outlineMesh = new LineSegments2(new LineSegmentsGeometry(), outlineMaterial);
        outlineMesh.name    = 'Na__SectionCut__CapOutline__' + id;
        outlineMesh.userData.naSectionCutHelper = true;
        outlineMesh.renderOrder = 2;
        outlineMesh.visible = false;

        Na__SectCut__CapRoot.add(capMesh);
        Na__SectCut__CapRoot.add(outlineMesh);
        return { capMesh, outlineMesh };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push Current Appearance Onto Every Existing Mesh
    // ------------------------------------------------------------
    function Na__SectCut__ApplyAppearanceToExistingMeshes() {
        Na__SectCut__Planes.forEach((record) => {
            record.capMesh.material.color.set(Na__SectCut__FillColor);
            record.outlineMesh.material.color.set(new THREE.Color(Na__SectCut__LineColor).getHex());
            record.outlineMesh.material.linewidth = Na__SectCut__LineWidthPx;
        });
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Offset Cap and Outline Off the Cut Plane
    // ------------------------------------------------------------
    // Both are nudged into the REMOVED half-space so they never z-fight with
    // the geometry they cap, with the outline sitting proud of the fill so
    // the profile always reads on top of the poche.
    // ------------------------------------------------------------
    function Na__SectCut__UpdateMeshOffsets(record) {
        record.capMesh.position.copy(record.plane.normal)
            .multiplyScalar(-Na__SectCut__CapOffsetUnits());
        record.outlineMesh.position.copy(record.plane.normal)
            .multiplyScalar(-Na__SectCut__LineOffsetUnits());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipping Plane Application
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Rebuild the Live Clip List From the Active Plane
    // ------------------------------------------------------------
    // The array instance is MUTATED, never replaced. Every model material
    // already holds a reference to it, so moving a datum only has to change
    // plane.constant - no scene re-traversal, which is what keeps slider
    // dragging smooth on a full house model.
    // ------------------------------------------------------------
    function Na__SectCut__SyncClipList() {
        Na__SectCut__ClipList.length = 0;

        const record = Na__SectCut__ActiveId ? Na__SectCut__Planes.get(Na__SectCut__ActiveId) : null;
        if (record && record.enabled) {
            Na__SectCut__ClipList.push(record.plane);
            if (record.backPlane) Na__SectCut__ClipList.push(record.backPlane);   // <-- Optional view depth below the cut
        }

        Na__SectCut__ApplyClippingToModel();
    }
    // ------------------------------------------------------------


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
    // upper-storey plan shows the storey below bleeding through. null = the
    // normal infinite half-space cut.
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
// REGION | Cap Geometry Recomputation
// -----------------------------------------------------------------------------

    // FUNCTION | Recompute Cap Fill and Profile Outline for One Plane
    // ------------------------------------------------------------
    function Na__SectCut__RecomputeCaps(id) {
        const record = Na__SectCut__Planes.get(id);
        if (!record || !Na__SectCut__ModelRoot) return;

        // A plane that is not the active cut contributes nothing to the view,
        // so it never pays for a recompute.
        if (!record.enabled || id !== Na__SectCut__ActiveId) {
            record.capMesh.visible     = false;
            record.outlineMesh.visible = false;
            return;
        }

        const result = Na__SectCap__ComputeSectionGeometry(Na__SectCut__ModelRoot, record.plane, {
            weldToleranceUnits : Na__SectCut__WeldTolUnits(),
            minLoopAreaUnits2  : Na__SectCut__MinLoopArea(),
            maxSegments        : Na__SectCut__MaxSegments()
        });

        // CAP FILL | Swap in the freshly triangulated geometry
        const oldCapGeometry = record.capMesh.geometry;
        if (result.capPositions) {
            const capGeometry = new THREE.BufferGeometry();
            capGeometry.setAttribute('position', new THREE.BufferAttribute(result.capPositions, 3));
            capGeometry.computeVertexNormals();                                  // <-- Flat normals for the profile-lines normal pass
            record.capMesh.geometry = capGeometry;
            record.capMesh.visible  = true;
        } else {
            record.capMesh.geometry = new THREE.BufferGeometry();
            record.capMesh.visible  = false;                                     // <-- Plane sits outside the model: nothing to fill
        }
        if (oldCapGeometry) oldCapGeometry.dispose();

        // PROFILE OUTLINE | Fat line segments around every cut island
        const oldOutlineGeometry = record.outlineMesh.geometry;
        if (result.outlinePositions) {
            const outlineGeometry = new LineSegmentsGeometry();
            outlineGeometry.setPositions(result.outlinePositions);
            record.outlineMesh.geometry = outlineGeometry;
            record.outlineMesh.visible  = true;
        } else {
            record.outlineMesh.geometry = new LineSegmentsGeometry();
            record.outlineMesh.visible  = false;
        }
        if (oldOutlineGeometry) oldOutlineGeometry.dispose();

        Na__SectCut__UpdateMeshOffsets(record);

        if (result.aborted) {
            console.warn('[TrueVision3D] Section cut recompute aborted - model exceeds the live segment budget; the clip plane is still cutting.');
        }
        Na__RenderLoop__RequestRender();
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
        }, Na__SectCut__DragThrottleMs());
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

        Na__SectCut__EnsureOverlayScene();

        const heightUnits = Na__Math__ConvertMmToUnits(cutHeightMm);
        const depthUnits  = Number.isFinite(depthMm) && depthMm > 0
            ? Na__Math__ConvertMmToUnits(depthMm)
            : null;

        let record = Na__SectCut__Planes.get(id);
        if (!record) {
            const meshes = Na__SectCut__BuildMeshes(id);
            record = {
                id          : id,
                // Normal points DOWN, so the kept half-space is below the cut.
                // distanceToPoint(p) = -p.y + h, positive (kept) when p.y < h.
                plane       : new THREE.Plane(new THREE.Vector3(0, -1, 0), heightUnits),
                backPlane   : null,
                depthUnits  : depthUnits,
                capMesh     : meshes.capMesh,
                outlineMesh : meshes.outlineMesh,
                enabled     : true
            };
            Na__SectCut__Planes.set(id, record);
        } else {
            record.plane.normal.set(0, -1, 0);
            record.plane.constant = heightUnits;                                 // <-- Mutated in place: materials keep their reference
            record.depthUnits     = depthUnits;
        }

        Na__SectCut__UpdateBackPlane(record);
        Na__SectCut__SyncClipList();
        Na__SectCut__UpdateMeshOffsets(record);
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
            const previous = Na__SectCut__Planes.get(previousId);
            if (previous) {
                previous.capMesh.visible     = false;
                previous.outlineMesh.visible = false;
            }
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

        Na__SectCut__CapRoot.remove(record.capMesh);
        Na__SectCut__CapRoot.remove(record.outlineMesh);
        if (record.capMesh.geometry)      record.capMesh.geometry.dispose();
        if (record.capMesh.material)      record.capMesh.material.dispose();
        if (record.outlineMesh.geometry)  record.outlineMesh.geometry.dispose();
        if (record.outlineMesh.material)  record.outlineMesh.material.dispose();

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
    // Renders the overlay scene straight onto the already-composited colour
    // buffer: autoClear off and no background, so the model image survives
    // underneath. Only depth is cleared, so caps and profiles always sit on
    // top of the geometry they belong to.
    // ------------------------------------------------------------
    function Na__SectionCut__RenderOverlay(camera) {
        if (!Na__SectCut__Renderer || !Na__SectCut__OverlayScene || !camera) return;
        if (!Na__SectCut__ActiveId) return;                                      // <-- No cut: nothing to draw, zero cost

        const savedAutoClear = Na__SectCut__Renderer.autoClear;

        Na__SectCut__Renderer.autoClear = false;
        Na__SectCut__Renderer.setRenderTarget(null);                             // <-- Draw straight to the screen
        Na__SectCut__Renderer.clearDepth();                                      // <-- Fresh depth: fills sit on the composited image
        Na__SectCut__Renderer.render(Na__SectCut__OverlayScene, camera);

        Na__SectCut__Renderer.autoClear = savedAutoClear;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Fat-Line Resolution After a Viewport Resize
    // ------------------------------------------------------------
    function Na__SectionCut__HandleResize(width, height) {
        Na__SectCut__Planes.forEach((record) => {
            if (record.outlineMesh.material && record.outlineMesh.material.resolution) {
                record.outlineMesh.material.resolution.set(width, height);
            }
        });
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
// REGION | Public API - State Queries
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


    // FUNCTION | Get the Current Appearance Settings
    // ------------------------------------------------------------
    function Na__SectionCut__GetAppearance() {
        return {
            fillColor   : Na__SectCut__FillColor,
            lineColor   : Na__SectCut__LineColor,
            lineWidthPx : Na__SectCut__LineWidthPx
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Override the Cut Appearance Live
    // ------------------------------------------------------------
    function Na__SectionCut__SetAppearance(appearance) {
        if (!appearance || typeof appearance !== 'object') return;
        if (typeof appearance.fillColor === 'string')   Na__SectCut__FillColor   = appearance.fillColor;
        if (typeof appearance.lineColor === 'string')   Na__SectCut__LineColor   = appearance.lineColor;
        if (Number.isFinite(appearance.lineWidthPx))    Na__SectCut__LineWidthPx = appearance.lineWidthPx;
        Na__SectCut__ApplyAppearanceToExistingMeshes();
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
        Na__SectCut__ModelRoot   = context.modelRoot  || null;
        Na__SectCut__PipelineRef = context.pipelineRef || null;
        Na__SectCut__Initialized = true;

        Na__SectCut__Renderer.localClippingEnabled = true;                       // <-- Zero cost until a plane exists

        Na__SectCut__EnsureOverlayScene();

        // SHARED STATE | Profile-line override passes follow this same array
        Na__SectionClipping__SetPlanes(Na__SectCut__ClipList);
        Na__SectionClipping__SetOverlayRenderer(Na__SectionCut__RenderOverlay);

        if (!Na__SectCut__LoadPromise) Na__SectCut__LoadPromise = Na__SectCut__FetchConfig();
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
