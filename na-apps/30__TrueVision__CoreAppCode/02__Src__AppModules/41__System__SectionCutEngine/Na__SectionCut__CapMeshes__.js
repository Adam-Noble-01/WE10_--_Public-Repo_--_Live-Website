// =============================================================================
// TRUEVISION3D - SECTION CUT ENGINE - CAP MESHES AND OVERLAY SCENE
// =============================================================================
//
// FILE       : Na__SectionCut__CapMeshes__.js
// NAMESPACE  : Na__SectMesh
// MODULE     : Section Cut Engine - Cap Meshes and Overlay Scene
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the section overlay scene, cap fill and profile outline meshes
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - This module answers "what gets DRAWN"; the engine answers "what gets CUT".
//   It owns the overlay scene, builds and disposes the per-plane cap fill and
//   profile outline meshes, drives the cap geometry recompute, and paints the
//   overlay onto the frame.
// - The overlay is a SEPARATE THREE.Scene. Caps and outlines drawn there never
//   pass through fog, SSAO or the Sobel profile pass, which is what keeps a
//   plan's poche flat and clean rather than shaded like a 3D surface.
// - Cap and outline are nudged off the cut plane into the REMOVED half-space.
//   Without that offset they z-fight with the geometry they are capping; the
//   outline sits proud of the fill so the profile always reads on top.
// - Holds no clipping state and no plane registry. Every function takes the
//   plane record it should act on, so the engine stays the single owner of
//   what a "plane" is.
//
// INTEGRATION:
// - Na__SectionCut__Engine__ calls Ensure / Build / Recompute / Dispose and
//   forwards the render loop's per-frame RenderOverlay call.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder. Split out of the
//   engine so both files stay inside the house 600-line limit.
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

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cap Geometry Engine
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__CapGeometry__.js
    // ------------------------------------------------------------
    import { Na__SectCap__ComputeSectionGeometry } from './Na__SectionCut__CapGeometry__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Config and Appearance State
    // ------------------------------------------------------------
    // @delegate: ./Na__SectionCut__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__SectCutCfg__CapOffsetUnits,
        Na__SectCutCfg__LineOffsetUnits,
        Na__SectCutCfg__WeldTolUnits,
        Na__SectCutCfg__MinLoopArea,
        Na__SectCutCfg__MaxSegments,
        Na__SectCutCfg__GetAppearance
    } from './Na__SectionCut__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Overlay Scene and Cap Root
    // ------------------------------------------------------------
    let Na__SectMesh__OverlayScene = null;   // <-- Separate scene: caps/outlines skip post-processing
    let Na__SectMesh__CapRoot      = null;   // <-- Group holding every cap + outline mesh
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Overlay Scene Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Ensure the Overlay Scene and Cap Root Exist
    // ------------------------------------------------------------
    function Na__SectMesh__EnsureOverlayScene() {
        if (!Na__SectMesh__OverlayScene) {
            Na__SectMesh__OverlayScene = new THREE.Scene();                      // <-- No background or fog: composited colour survives underneath
            Na__SectMesh__OverlayScene.name = 'Na__SectionCut__OverlayScene';
        }
        if (!Na__SectMesh__CapRoot) {
            Na__SectMesh__CapRoot = new THREE.Group();
            Na__SectMesh__CapRoot.name = 'Na__SectionCut__CapRoot';
            Na__SectMesh__CapRoot.userData.naSectionCutHelper = true;            // <-- Never let the cap engine cut its own output
            Na__SectMesh__OverlayScene.add(Na__SectMesh__CapRoot);
        }
        return Na__SectMesh__OverlayScene;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mesh Construction and Disposal
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Cap Fill and Profile Outline Meshes for a Plane
    // ------------------------------------------------------------
    // Both start hidden and empty; the first recompute fills them.
    // ------------------------------------------------------------
    function Na__SectMesh__BuildMeshes(id) {
        Na__SectMesh__EnsureOverlayScene();
        const appearance = Na__SectCutCfg__GetAppearance();

        const capMaterial = new THREE.MeshBasicMaterial({
            color : new THREE.Color(appearance.fillColor),
            side  : THREE.DoubleSide,
            fog   : false
        });
        const capMesh = new THREE.Mesh(new THREE.BufferGeometry(), capMaterial);
        capMesh.name = 'Na__SectionCut__CapFill__' + id;
        capMesh.userData.naSectionCutHelper = true;
        capMesh.renderOrder = 1;
        capMesh.visible = false;

        const outlineMaterial = new LineMaterial({
            color      : new THREE.Color(appearance.lineColor).getHex(),
            linewidth  : appearance.lineWidthPx,
            worldUnits : false
        });
        outlineMaterial.resolution.set(window.innerWidth, window.innerHeight);
        const outlineMesh = new LineSegments2(new LineSegmentsGeometry(), outlineMaterial);
        outlineMesh.name = 'Na__SectionCut__CapOutline__' + id;
        outlineMesh.userData.naSectionCutHelper = true;
        outlineMesh.renderOrder = 2;
        outlineMesh.visible = false;

        Na__SectMesh__CapRoot.add(capMesh);
        Na__SectMesh__CapRoot.add(outlineMesh);
        return { capMesh, outlineMesh };
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove and Fully Dispose One Plane's Meshes
    // ------------------------------------------------------------
    function Na__SectMesh__DisposeMeshes(record) {
        if (!record || !Na__SectMesh__CapRoot) return;

        Na__SectMesh__CapRoot.remove(record.capMesh);
        Na__SectMesh__CapRoot.remove(record.outlineMesh);

        if (record.capMesh.geometry)     record.capMesh.geometry.dispose();
        if (record.capMesh.material)     record.capMesh.material.dispose();
        if (record.outlineMesh.geometry) record.outlineMesh.geometry.dispose();
        if (record.outlineMesh.material) record.outlineMesh.material.dispose();
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide a Plane's Cap and Outline Without Disposing Them
    // ------------------------------------------------------------
    function Na__SectMesh__HideMeshes(record) {
        if (!record) return;
        record.capMesh.visible     = false;
        record.outlineMesh.visible = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Repaint Every Mesh From the Current Appearance
    // ------------------------------------------------------------
    // Called when the config fetch settles after meshes were already built,
    // and whenever the dev controls override the appearance live.
    // ------------------------------------------------------------
    function Na__SectMesh__RepaintAll(records) {
        const appearance = Na__SectCutCfg__GetAppearance();
        records.forEach((record) => {
            record.capMesh.material.color.set(appearance.fillColor);
            record.outlineMesh.material.color.set(new THREE.Color(appearance.lineColor).getHex());
            record.outlineMesh.material.linewidth = appearance.lineWidthPx;
        });
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Fat-Line Resolution After a Viewport Resize
    // ------------------------------------------------------------
    function Na__SectMesh__HandleResize(records, width, height) {
        records.forEach((record) => {
            const material = record.outlineMesh.material;
            if (material && material.resolution) material.resolution.set(width, height);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cap Geometry Recomputation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Offset Cap and Outline Off the Cut Plane
    // ------------------------------------------------------------
    function Na__SectMesh__UpdateOffsets(record) {
        record.capMesh.position.copy(record.plane.normal)
            .multiplyScalar(-Na__SectCutCfg__CapOffsetUnits());
        record.outlineMesh.position.copy(record.plane.normal)
            .multiplyScalar(-Na__SectCutCfg__LineOffsetUnits());
    }
    // ------------------------------------------------------------


    // FUNCTION | Recompute Cap Fill and Profile Outline for One Plane
    // ------------------------------------------------------------
    // modelRoot is the live scene subtree to slice. Returns true when the
    // plane produced geometry, false when it sits outside the model.
    // ------------------------------------------------------------
    function Na__SectMesh__RecomputeCaps(record, modelRoot) {
        if (!record || !modelRoot) return false;

        const result = Na__SectCap__ComputeSectionGeometry(modelRoot, record.plane, {
            weldToleranceUnits : Na__SectCutCfg__WeldTolUnits(),
            minLoopAreaUnits2  : Na__SectCutCfg__MinLoopArea(),
            maxSegments        : Na__SectCutCfg__MaxSegments()
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

        Na__SectMesh__UpdateOffsets(record);

        if (result.aborted) {
            console.warn('[TrueVision3D] Section cut recompute aborted - model exceeds the live segment budget; the clip plane is still cutting.');
        }
        Na__RenderLoop__RequestRender();
        return record.capMesh.visible;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Overlay Rendering
// -----------------------------------------------------------------------------

    // FUNCTION | Draw the Section Overlay After the Main Render
    // ------------------------------------------------------------
    // autoClear off and no scene background, so the already-composited model
    // image survives underneath. Only depth is cleared, so caps and profiles
    // always sit on top of the geometry they belong to.
    // ------------------------------------------------------------
    function Na__SectMesh__RenderOverlay(renderer, camera) {
        if (!renderer || !camera || !Na__SectMesh__OverlayScene) return;

        const savedAutoClear = renderer.autoClear;

        renderer.autoClear = false;
        renderer.setRenderTarget(null);                                          // <-- Draw straight to the screen
        renderer.clearDepth();                                                   // <-- Fresh depth: fills sit on the composited image
        renderer.render(Na__SectMesh__OverlayScene, camera);

        renderer.autoClear = savedAutoClear;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cap Mesh and Overlay API
    // ------------------------------------------------------------
    export {
        Na__SectMesh__EnsureOverlayScene,
        Na__SectMesh__BuildMeshes,
        Na__SectMesh__DisposeMeshes,
        Na__SectMesh__HideMeshes,
        Na__SectMesh__RepaintAll,
        Na__SectMesh__HandleResize,
        Na__SectMesh__RecomputeCaps,
        Na__SectMesh__RenderOverlay
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
