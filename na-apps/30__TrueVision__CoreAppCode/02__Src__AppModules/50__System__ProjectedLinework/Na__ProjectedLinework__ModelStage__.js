// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - MODEL STAGE
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ModelStage__.js
// NAMESPACE  : Na__PlStage
// MODULE     : Projected Linework - Model Stage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Know when the model has changed, and prime what the intersection pass needs
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The Lantern Designer builds its model into a detached stage group. Here
//   the model already exists: the loaded GLB roots under the model group.
//   What is left of the stage module is the two things a live model needs:
//
//   THE FINGERPRINT   A short stable string for the state of the model as the
//                     projection sees it: the config build token, the project
//                     code, the three edge rules (linework first, seams
//                     occlude, flush joins), and every category group with its
//                     triangle count and
//                     visibility. Stable across reloads of the same GLBs (no
//                     uuids, no object identity), changed by a different
//                     model, a re-exported GLB, a category switched off or
//                     any edge rule switched.
//
//   THE BOUNDS TREES  three-mesh-bvh trees left on each geometry so the
//                     intersection pass finds them ready. Built once per
//                     geometry and never disposed: dropping the reference is
//                     the complete teardown, exactly as the Lantern Designer
//                     reasons at the head of its stage module.
//
// - LEGACY AND WEBGPU STAGE. The vendored backends take a scene and do their
//   own extraction, so BuildStageGroup assembles a detached group of clones
//   sharing the sampled geometries (exclusions applied, no cut) for them.
//   Never rendered, never disposed.
//
// INTEGRATION:
// - Na__ProjectedLinework__Pipeline__ and __Persistence__ take the
//   fingerprint; Na__ProjectedLinework__Projector__ primes and stages.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ModelStage__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim, bar 1.1.0 and 1.2.0
// - Divergences   : Console prefix, header and folder numbers; the edge rules
//                   in the fingerprint (1.1.0) and the content stamp (1.2.0),
//                   both authored here first.
// - Back-port     : 1.1.0 PENDING to ValeVision3D, on Adam's sign-off; 1.2.0 ported 18-Sep-2026 as ValeVision3D v2.57.0 (its 1.1.0).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.2.0
// - THE FINGERPRINT SEES WHAT THE MODEL CONTAINS, not only how much of it there
//   is. It was category names, triangle counts and visibility, so a hopper moved
//   along a wall and re-exported - same names, same counts - kept the old
//   fingerprint, and every cache keyed by it (the results, the collected model,
//   the browser store, the baked asset, the Layout Editor's base image) handed
//   back the drawing of the hopper where it used to be. Each category now adds
//   the content stamps of the GLBs under it (Na__ModelLoader__ContentStamp__),
//   and Categories carries the stamp so the Layout Editor's own model
//   fingerprint can use it too. A category with nothing stamped under it
//   fingerprints exactly as before.
// - One-off cost: every fingerprint changes once, so every stored result and
//   baked asset reads as stale once and is made again.
//
// 14-Sep-2026 - Version 1.1.0
// - Describe folds the three edge rules (linework first, seams occlude, flush
//   joins) into the fingerprint, so linework rendered or baked under one
//   setting is never restored under another, whichever way a switch is moved.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core and Bounds Trees
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { MeshBVH } from 'three-mesh-bvh';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Config, Scheduler, Project Code and View Hashing
    // ------------------------------------------------------------
    import {
        Na__PlCfg__GetPerformanceSetup,
        Na__PlCfg__GetProjectionSetup,
        Na__PlCfg__GetModelSetup
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    import { Na__ProjectedLinework__Scheduler__CreateSlicer } from './Na__ProjectedLinework__Scheduler__.js';
    import { Na__PlView__Hash } from './Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__ModelStamp__Read } from '../15__ModelLoader/Na__ModelLoader__ContentStamp__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fingerprint
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Triangles Under One Object, Visible or Not
    // ------------------------------------------------------------
    // Counts geometry rather than visibility so hiding a category changes the
    // visibility flag in the fingerprint, not the count, and the two stay
    // readable as separate facts in the log.
    // ------------------------------------------------------------
    function Na__PlStage__CountUnder(object3d) {
        let total = 0;
        object3d.traverse((node) => {
            if (node.isMesh !== true || !node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) return;
            const per = Math.floor((node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) / 3);
            total += per * (node.isInstancedMesh === true ? (node.count || 0) : 1);
        });
        return total;
    }
    // ------------------------------------------------------------


    // FUNCTION | Describe the Model State the Projection Sees
    // ------------------------------------------------------------
    // Returns { Fingerprint, Categories, TriangleTotal }. Null model root reads
    // as the fingerprint 'no-model', which no baked asset can match.
    // ------------------------------------------------------------
    function Na__PlStage__Describe(modelRoot) {
        const categories = [];
        let   total      = 0;

        if (modelRoot) {
            for (let i = 0; i < modelRoot.children.length; i++) {
                const category = modelRoot.children[i];
                const tris     = Na__PlStage__CountUnder(category);
                total += tris;
                categories.push({ name : category.name || ('child_' + i), tris : tris, visible : category.visible !== false, stamp : Na__ModelStamp__Read(category) });   // <-- stamp: what its GLBs held when they loaded
            }
        }

        const material = JSON.stringify({
            token   : Na__PlCfg__GetModelSetup().buildToken,
            project : Na__DrawData__GetProjectCode() || null,
            edges   : Na__PlCfg__GetProjectionSetup().lineworkFirst ? 'linework-first' : 'mesh-creases',
            seams   : Na__PlCfg__GetProjectionSetup().seamsOcclude ? 'seams-occlude' : 'seams-open',
            joins   : Na__PlCfg__GetProjectionSetup().hideFlushJoins ? 'flush-joins-hidden' : 'flush-joins-drawn',
            groups  : categories.map((c) => (c.stamp ? [ c.name, c.tris, c.visible ? 1 : 0, c.stamp ] : [ c.name, c.tris, c.visible ? 1 : 0 ]))   // <-- The stamp only where there is one, so an unstamped model keys as it always did
        });

        return {
            Fingerprint   : categories.length === 0 ? 'no-model' : Na__PlView__Hash(material),
            Categories    : categories,
            TriangleTotal : total
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bounds Tree Priming
// -----------------------------------------------------------------------------

    // FUNCTION | Build Each Geometry's BVH Once and Leave It on the Geometry
    // ------------------------------------------------------------
    // The intersection pass checks geometry.boundsTree first, so building it
    // here once serves every drawing that follows. A geometry with draw groups
    // is left alone: MeshBVH reorders the index and a group addresses a range.
    // ------------------------------------------------------------
    async function Na__PlStage__PrimeBoundsTrees(instances, yieldEveryMs) {
        const performance = Na__PlCfg__GetPerformanceSetup();
        if (!performance.cacheBoundsTrees) return 0;

        const geometries = new Set();
        for (let i = 0; i < instances.length; i++) geometries.add(instances[i].geometry);

        const slicer = Na__ProjectedLinework__Scheduler__CreateSlicer(yieldEveryMs);
        let   built  = 0;

        for (const geometry of geometries) {
            if (geometry.boundsTree) continue;                                    // <-- Already primed by an earlier drawing
            if (geometry.groups && geometry.groups.length > 1) continue;          // <-- Multi material: let the library build its own
            await slicer.Tick();
            geometry.boundsTree = new MeshBVH(geometry, { maxLeafSize : performance.bvhMaxLeafSize });
            built++;
        }

        return built;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Detached Stage for the Vendored Backends
// -----------------------------------------------------------------------------

    // FUNCTION | Assemble a Group of Clones Sharing the Sampled Geometries
    // ------------------------------------------------------------
    // For the legacy and WebGPU backends, which take a scene. Materials are
    // shared too (the side code is what the vendored collector reads). The
    // drawing cut and the transparency rule are NOT applied: those backends
    // exist for the Diff harness and a plain elevation is the fair test.
    // ------------------------------------------------------------
    function Na__PlStage__BuildStageGroup(instances) {
        const stage = new THREE.Group();
        stage.name  = 'Na__ProjectedLinework__Stage';

        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            const mesh     = new THREE.Mesh(instance.geometry, Na__PlStage__SideMaterial(instance.side));
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(instance.matrixWorld);
            mesh.matrixWorld.copy(instance.matrixWorld);
            stage.add(mesh);
        }

        stage.matrixAutoUpdate = false;
        stage.updateMatrixWorld(true);
        return stage;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Shared Material Carrying Only the Side the Sampler Recorded
    // ------------------------------------------------------------
    const Na__PlStage__SideMaterials = {};
    function Na__PlStage__SideMaterial(sideCode) {
        if (!Na__PlStage__SideMaterials[sideCode]) {
            const material = new THREE.MeshBasicMaterial();
            material.side  = (sideCode === 2) ? THREE.DoubleSide : (sideCode === 1) ? THREE.BackSide : THREE.FrontSide;
            Na__PlStage__SideMaterials[sideCode] = material;
        }
        return Na__PlStage__SideMaterials[sideCode];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Model Stage API
    // ------------------------------------------------------------
    export {
        Na__PlStage__Describe,
        Na__PlStage__PrimeBoundsTrees,
        Na__PlStage__BuildStageGroup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
