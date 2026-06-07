// =============================================================================
// TRUEVISION3D - MODEL LOADER - INSTANCE CONSOLIDATION
// =============================================================================
//
// FILE      : Na__ModelLoader__InstanceConsolidation__.js
// NAMESPACE : Na__ModelLoader
// MODULE    : InstanceConsolidation
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Collapse many repeated mesh nodes that share the same geometry
//             and material into a single THREE.InstancedMesh (1 draw call).
// CREATED   : 07-Jun-2026
//
// DESCRIPTION:
// - Three.js GLTFLoader creates one Mesh per glTF instance node; it does NOT
//   GPU-instance repeated mesh references. A component placed thousands of
//   times (e.g. 2,557 plant leaves) therefore becomes thousands of draw calls
//   even though the geometry is shared in memory.
// - This module walks a loaded mesh root, buckets meshes by shared geometry +
//   material, and replaces any bucket above a configurable threshold with one
//   THREE.InstancedMesh carrying the per-instance transforms. N draw calls
//   collapse to 1.
// - Interactive / animated assemblies (doors: ADR / MOD / ROT) are guarded out
//   so their per-node hierarchy is preserved for animation.
// - Runs BEFORE the materials swap so the resulting single InstancedMesh node
//   flows through the normal PBR swap + AO layer assignment.
//
// DEPENDENCIES:
// - Three.js (THREE.InstancedMesh, THREE.Matrix4)
//
// USAGE:
// - import { Na__ModelLoader__ConsolidateInstances } from this module
// - Na__ModelLoader__ConsolidateInstances(meshRoot, consolidationConfig)
//
// -----
//
// DEVELOPMENT LOG:
// 07-Jun-2026 - Version 1.0.0
// - Initial stable release.
// - Generic geometry+material bucketing with door/interactive guard.
//
// =============================================================================


// #Region ---
// REGION | Module Imports
// -----

    import * as THREE from 'three';                                 // <-- InstancedMesh + Matrix4

// endregion ----


// #Region ---
// REGION | Module Constants
// -----

    // CONSTANTS | Interactive / Animated Name Tokens to Never Consolidate
    // ------------------------------------------------------------
    // Door assemblies use the ADR / MOD / ROT naming contract and must keep
    // their individual node hierarchy for click-to-open animation.
    // ------------------------------------------------------------
    const Na__Consolidation__InteractiveTokens = ['ADR', 'MOD', 'ROT', 'Door']; // <-- Skip these subtrees

// endregion ----


// #Region ---
// REGION | Guard Helpers
// -----

    // HELPER FUNCTION | Test Whether a Node Sits Inside an Interactive Subtree
    // ------------------------------------------------------------
    // Walks the ancestor chain looking for any door / interactive name token
    // or an explicit interactive userData flag. Such nodes are never merged.
    // ------------------------------------------------------------
    function Na__Consolidation__IsInteractive(object) {
        let current = object;
        while (current) {
            if (current.userData && (current.userData.na_interactive === true || current.userData.Na__DoorAssembly === true)) {
                return true;                                        // <-- Explicit interactive flag
            }
            const name = current.name || '';
            for (const token of Na__Consolidation__InteractiveTokens) {
                if (name.includes(token)) {
                    return true;                                    // <-- Name token match in ancestor chain
                }
            }
            current = current.parent;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Bucket Key from Geometry + Material
    // ------------------------------------------------------------
    // Same geometry instance (shared by GLTFLoader for repeated mesh refs)
    // plus same material name = a safe consolidation group.
    // ------------------------------------------------------------
    function Na__Consolidation__BuildBucketKey(node) {
        const geometry = node.geometry;
        if (!geometry) return null;                                 // <-- No geometry, not consolidatable

        const material = node.material;
        if (!material || Array.isArray(material)) return null;      // <-- Multi-material nodes left untouched

        const materialName = material.name || material.uuid;        // <-- Prefer stable name, fall back to uuid
        return `${geometry.uuid}|${materialName}`;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Consolidation
// -----

    // FUNCTION | Consolidate Repeated Mesh Nodes Into InstancedMeshes
    // ------------------------------------------------------------
    // Buckets all eligible meshes under meshRoot by shared geometry +
    // material. Any bucket with at least MinInstanceCount members is replaced
    // by a single THREE.InstancedMesh holding the per-instance transforms.
    //
    // @param meshRoot            [THREE.Object3D] Loaded category mesh root
    // @param consolidationConfig [Object]         RenderConfig__InstanceConsolidation block
    // @returns                   [Number]         Count of InstancedMeshes created
    // ------------------------------------------------------------
    function Na__ModelLoader__ConsolidateInstances(meshRoot, consolidationConfig) {
        if (!meshRoot) return 0;                                    // <-- Nothing to process
        if (!consolidationConfig || consolidationConfig.RenderConfig__InstanceConsolidation__Enabled !== true) {
            return 0;                                               // <-- Feature disabled in config
        }

        const minInstanceCount = (typeof consolidationConfig.RenderConfig__InstanceConsolidation__MinInstanceCount === 'number')
            ? consolidationConfig.RenderConfig__InstanceConsolidation__MinInstanceCount
            : 16;                                                   // <-- Threshold below which we leave nodes alone
        const foliageCastShadow = consolidationConfig.RenderConfig__InstanceConsolidation__FoliageCastShadow === true;

        meshRoot.updateMatrixWorld(true);                           // <-- Ensure world matrices are current
        const invRoot = new THREE.Matrix4().copy(meshRoot.matrixWorld).invert(); // <-- World -> meshRoot-local

        // COLLECT | Bucket eligible meshes by shared geometry + material
        const buckets = new Map();                                  // <-- key -> [{ node, localMatrix }]
        meshRoot.traverse((node) => {
            if (!node.isMesh) return;                               // <-- Meshes only
            if (node.isInstancedMesh) return;                       // <-- Already instanced
            if (node.isLine2 || node.isLineSegments2 || node.isLine) return; // <-- Never lines
            if (Na__Consolidation__IsInteractive(node)) return;     // <-- Preserve doors / animated assemblies

            const key = Na__Consolidation__BuildBucketKey(node);
            if (!key) return;                                       // <-- Not consolidatable

            const localMatrix = new THREE.Matrix4().multiplyMatrices(invRoot, node.matrixWorld);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push({ node, localMatrix });
        });

        // BUILD | Replace qualifying buckets with a single InstancedMesh each
        let instancedCreated = 0;
        let nodesRemoved     = 0;

        buckets.forEach((members) => {
            if (members.length < minInstanceCount) return;          // <-- Below threshold, leave as-is

            const representative = members[0].node;
            const sharedGeometry = representative.geometry;
            const sharedMaterial = representative.material;
            const count          = members.length;

            const instancedMesh = new THREE.InstancedMesh(sharedGeometry, sharedMaterial, count);
            instancedMesh.name   = representative.name || 'ConsolidatedInstances';

            for (let i = 0; i < count; i++) {
                instancedMesh.setMatrixAt(i, members[i].localMatrix); // <-- Bake per-instance transform
            }
            instancedMesh.instanceMatrix.needsUpdate = true;

            instancedMesh.castShadow    = foliageCastShadow;        // <-- Foliage shadow-casting is opt-in (perf)
            instancedMesh.receiveShadow = true;
            instancedMesh.frustumCulled = false;                    // <-- Spread instances; avoid wrongful whole-object cull
            instancedMesh.userData.na_consolidated      = true;     // <-- Tag for debugging / identification
            instancedMesh.userData.na_consolidatedCount = count;

            // Carry profile-line colour metadata from the representative (if present)
            if (representative.userData && representative.userData.Na__ProfileLineColor) {
                instancedMesh.userData.Na__ProfileLineColor = representative.userData.Na__ProfileLineColor;
            }

            meshRoot.add(instancedMesh);                            // <-- Attach single consolidated node

            // REMOVE | Detach the original per-instance nodes (geometry is reused, not disposed)
            for (let i = 0; i < count; i++) {
                const node = members[i].node;
                if (node.parent) node.parent.remove(node);
                nodesRemoved++;
            }

            instancedCreated++;
        });

        if (instancedCreated > 0) {
            console.log(
                `[TrueVision3D] InstanceConsolidation: ${instancedCreated} InstancedMesh(es) created from ${nodesRemoved} nodes in "${meshRoot.name}".`
            );
        }

        return instancedCreated;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    export {
        Na__ModelLoader__ConsolidateInstances
    };

// endregion ----
