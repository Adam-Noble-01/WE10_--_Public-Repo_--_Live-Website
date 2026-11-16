// =============================================================================
// TRUEVISION3D - VEGETATION - SURFACE PICK
// =============================================================================
//
// FILE       : Na__Vegetation__SurfacePick__.js
// NAMESPACE  : Na__VegPick
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the real surface of the model under a pointer or under a spot, fast
//              enough for a brush that asks many times a stroke
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - A FILTER THAT TELLS THE TRUTH (note 10, section 7.4). The app's older picks take fat
//   lines (LineSegments2 is isMesh), hit layers switched off, and hit what a section has
//   cut away. This takes only what is really on the screen.
// - A BVH PER GEOMETRY, MADE ON FIRST USE, KEPT TO ITSELF. Vendored three-mesh-bvh, indirect
//   so it never reorders the indices Projected Linework reads, and held in this module
//   rather than on the geometry, so nothing else's raycasts change at all. A brush asks
//   dozens of times a stroke, against models of a million triangles.
// - A GEOMETRY IT CANNOT TAKE falls back to three's own raycast for that mesh.
//
// FRAMES:
// - Everything is world metres, as three.js's world is. The tools convert to integer mm,
//   once, on the way into the record.
//
// INTEGRATION:
// - Used by ./Na__Vegetation__ToolHost__.js's tools, and loaded with them on first use.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__SurfacePick__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 5 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js and the Vendored BVH
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { MeshBVH } from 'three-mesh-bvh';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Section Cuts
    // ------------------------------------------------------------
    import { Na__SectionClipping__GetClipList } from '../../05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Long a List of Surfaces Is Trusted, and the Slices of Preparing
    // ------------------------------------------------------------
    const Na__VegPick__SURFACES_MS   = 400;                                    // <-- A layer switched off is seen within this: a brush asks far more often
    const Na__VegPick__PREP_SLICE_MS = 14;
    const Na__VegPick__DROP_FROM_M   = 1.5;                                    // <-- A spot takes what is under it, looking no further up than this
    // ------------------------------------------------------------

    // MODULE VARIABLES | The BVHs and What Is Reused
    // ------------------------------------------------------------
    const Na__VegPick__Trees      = new WeakMap();                             // <-- geometry -> MeshBVH, or null when it could not take one
    const Na__VegPick__Raycaster  = new THREE.Raycaster();
    const Na__VegPick__Ndc        = new THREE.Vector2();
    const Na__VegPick__LocalRay   = new THREE.Ray();
    const Na__VegPick__Inverse    = new THREE.Matrix4();
    const Na__VegPick__Sphere     = new THREE.Sphere();
    const Na__VegPick__Down       = new THREE.Vector3(0, -1, 0);
    const Na__VegPick__Above      = new THREE.Vector3();
    const Na__VegPick__State      = { context : null, surfaces : [], surfacesAt : -Infinity };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Surfaces
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What Is Really on the Screen
    // ------------------------------------------------------------
    function Na__VegPick__Surfaces() {
        const state = Na__VegPick__State;
        const now = performance.now();
        if (now - state.surfacesAt < Na__VegPick__SURFACES_MS) return state.surfaces;
        state.surfacesAt = now;
        state.surfaces = [];
        const modelRoot = state.context && state.context.modelRoot;
        if (!modelRoot) return state.surfaces;
        modelRoot.traverseVisible((child) => {                                 // <-- Honours a hidden parent group
            if (!child.isMesh || child.isLine2 || child.isLineSegments2) return;   // <-- Fat lines are isMesh
            if (child.material && child.material.visible === false) return;
            state.surfaces.push(child);
        });
        return state.surfaces;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Geometry's BVH, or Null
    // ------------------------------------------------------------
    function Na__VegPick__TreeOf(geometry) {
        if (Na__VegPick__Trees.has(geometry)) return Na__VegPick__Trees.get(geometry);
        let tree = null;
        try {
            tree = new MeshBVH(geometry, { indirect : true });                 // <-- Indirect: the indices stay exactly as they were
        } catch (error) {
            tree = null;
        }
        Na__VegPick__Trees.set(geometry, tree);
        return tree;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has a Section Cut This Point Away?
    // ------------------------------------------------------------
    function Na__VegPick__IsCut(point, clipList) {
        if (!clipList) return false;
        for (let k = 0; k < clipList.length; k++) {
            if (clipList[k].distanceToPoint(point) < 0) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Nearest Real Hit Along a World Ray, or Null
    // ------------------------------------------------------------
    // Returns { point, normal, mesh }, the normal in the world and facing the ray.
    // ------------------------------------------------------------
    function Na__VegPick__Cast(ray, near, far) {
        const surfaces = Na__VegPick__Surfaces();
        const clipList = Na__SectionClipping__GetClipList();
        let best = null, bestDistance = Infinity;

        for (let m = 0; m < surfaces.length; m++) {
            const mesh = surfaces[m];
            const geometry = mesh.geometry;
            if (!geometry || !geometry.attributes.position) continue;
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            Na__VegPick__Sphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
            if (!ray.intersectsSphere(Na__VegPick__Sphere)) continue;

            const tree = mesh.isInstancedMesh ? null : Na__VegPick__TreeOf(geometry);
            const hits = [];
            if (tree) {
                Na__VegPick__Inverse.copy(mesh.matrixWorld).invert();
                Na__VegPick__LocalRay.copy(ray).applyMatrix4(Na__VegPick__Inverse);
                const found = tree.raycast(Na__VegPick__LocalRay, THREE.DoubleSide) || [];
                found.forEach((hit) => {
                    const point = hit.point.clone().applyMatrix4(mesh.matrixWorld);
                    hits.push({ point, distance : point.distanceTo(ray.origin), normal : hit.face ? hit.face.normal : null });
                });
            } else {
                Na__VegPick__Raycaster.ray.copy(ray);
                Na__VegPick__Raycaster.near = 0;
                Na__VegPick__Raycaster.far  = Infinity;
                Na__VegPick__Raycaster.layers.enableAll();
                const found = [];
                mesh.raycast(Na__VegPick__Raycaster, found);
                found.forEach((hit) => hits.push({ point : hit.point, distance : hit.distance, normal : hit.face ? hit.face.normal : null }));
            }

            for (let h = 0; h < hits.length; h++) {
                const hit = hits[h];
                if (hit.distance < near || hit.distance > far || hit.distance >= bestDistance) continue;
                if (Na__VegPick__IsCut(hit.point, clipList)) continue;
                bestDistance = hit.distance;
                best = { point : hit.point, normalLocal : hit.normal, mesh };
            }
        }

        if (!best) return null;
        const normal = best.normalLocal ? best.normalLocal.clone().transformDirection(best.mesh.matrixWorld) : new THREE.Vector3(0, 1, 0);
        if (normal.dot(ray.direction) > 0) normal.negate();                    // <-- Whichever way the face was wound, it faces whoever is looking
        return { point : best.point, normal, mesh : best.mesh };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Say Where the Model Is
    // ------------------------------------------------------------
    function Na__VegPick__Initialize(context) {
        Na__VegPick__State.context    = context;
        Na__VegPick__State.surfacesAt = -Infinity;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Every BVH Now, a Slice at a Time, So the First Click Is Not Slow
    // ------------------------------------------------------------
    async function Na__VegPick__Prepare() {
        Na__VegPick__State.surfacesAt = -Infinity;
        const surfaces = Na__VegPick__Surfaces().slice();
        let sliceStartedAt = performance.now();
        for (let m = 0; m < surfaces.length; m++) {
            const geometry = surfaces[m].geometry;
            if (geometry && !surfaces[m].isInstancedMesh) Na__VegPick__TreeOf(geometry);
            if (performance.now() - sliceStartedAt >= Na__VegPick__PREP_SLICE_MS) {
                await new Promise((resolve) => { setTimeout(resolve, 0); });
                sliceStartedAt = performance.now();
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The World Ray Through a Point on the Screen, or Null
    // ------------------------------------------------------------
    function Na__VegPick__RayAt(clientX, clientY) {
        const { renderer, camera } = Na__VegPick__State.context;
        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        Na__VegPick__Ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        Na__VegPick__Ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        Na__VegPick__Raycaster.setFromCamera(Na__VegPick__Ndc, camera);
        return Na__VegPick__Raycaster.ray.clone();
    }
    // ------------------------------------------------------------


    // FUNCTION | The First Real Surface Under a Pointer, or Null
    // ------------------------------------------------------------
    function Na__VegPick__AtPointer(clientX, clientY) {
        const ray = Na__VegPick__RayAt(clientX, clientY);
        return ray ? Na__VegPick__Cast(ray, 0, Infinity) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Pointer Meets the Level Plane Through a Height, or Null
    // ------------------------------------------------------------
    // A path can run over open ground the model does not reach.
    // ------------------------------------------------------------
    function Na__VegPick__OnLevel(clientX, clientY, heightM) {
        const ray = Na__VegPick__RayAt(clientX, clientY);
        if (!ray || Math.abs(ray.direction.y) < 1e-6) return null;
        const t = (heightM - ray.origin.y) / ray.direction.y;
        return t > 0 ? ray.at(t, new THREE.Vector3()) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Is Under a Spot, Looking Down from a Little Above a Height, or Null
    // ------------------------------------------------------------
    function Na__VegPick__Under(x, heightM, z) {
        Na__VegPick__Above.set(x, heightM + Na__VegPick__DROP_FROM_M, z);
        return Na__VegPick__Cast(new THREE.Ray(Na__VegPick__Above.clone(), Na__VegPick__Down), 0, Infinity);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Surface Pick API
    // ------------------------------------------------------------
    export {
        Na__VegPick__Initialize,
        Na__VegPick__Prepare,
        Na__VegPick__RayAt,
        Na__VegPick__AtPointer,
        Na__VegPick__OnLevel,
        Na__VegPick__Under
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
