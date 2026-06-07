// =============================================================================
// TRUEVISION3D - DISTANCE CULLING
// =============================================================================
//
// FILE      : Na__RenderEffect__DistanceCulling__.js
// NAMESPACE : Na__DistanceCulling
// MODULE    : DistanceCulling
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Hide furniture / interior-decor items beyond a cull distance
// CREATED   : 07-Jun-2026
//
// DESCRIPTION:
// - Per-item distance culling for furniture and interior-decor categories.
// - Reads enable flag, cull distance (mm -> units), and category tokens from
//   AppConfig (RenderEffect__DistanceCulling), passed in at initialise time.
// - Registers individual item nodes from each matching category group's
//   MeshRoot and LineworkRoot, caching each item's world-space centre once.
// - Per frame (camera-move only) toggles each item's .visible based on radial
//   distance from the active camera, using squared-distance comparison.
// - Operates only on individual item nodes, never on category groups, so it
//   composes safely with the model-toggle and storey visibility systems via
//   the THREE.js visibility hierarchy.
//
// -----
//
// DEVELOPMENT LOG:
// 07-Jun-2026 - Version 1.1.0
// - World bounds now computed via Box3.setFromObject (+ explicit fat-line
//   instanceStart/instanceEnd union) so deeply nested components and
//   InstancedMesh foliage are bounded at their true world positions.
//   Fixes leaf items popping in/out due to instance transforms not being
//   captured by a single node matrixWorld.
//
// 07-Jun-2026 - Version 1.0.0
// - Initial stable release.
//
// =============================================================================


// #Region ---
// REGION | Module Imports
// -----

    import * as THREE from 'three';

    // @delegate: ../04__MathUtils/Na__Math__Units.js
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';

// endregion ----


// #Region ---
// REGION | Module State
// -----

    // MODULE STATE | Culling Configuration and Registry
    // ------------------------------------------------------------
    let Na__DistanceCulling__Enabled          = false;                   // <-- Master enable flag (from config)
    let Na__DistanceCulling__CullDistanceUnits = 0;                      // <-- Cull distance in 3D units
    let Na__DistanceCulling__CategoryTokens   = [];                      // <-- Category-key tokens to match
    let Na__DistanceCulling__Registry         = [];                      // <-- [{ node, centre:Vector3, thresholdSq }, ...]
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Scratch Objects (avoid per-frame / per-item allocation)
    // ------------------------------------------------------------
    const Na__DistanceCulling__ScratchItemBox = new THREE.Box3();        // <-- Reused: accumulated item world bounds
    const Na__DistanceCulling__ScratchPoint   = new THREE.Vector3();     // <-- Reused: per-vertex world point
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Default Category Tokens (fallback)
    // ------------------------------------------------------------
    const Na__DistanceCulling__DefaultTokens = ['Furniture', 'InteriorDecor', 'Decor'];  // <-- Used when config omits tokens
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Initialization
// -----

    // FUNCTION | Initialise Distance Culling From AppConfig
    // ------------------------------------------------------------
    function Na__DistanceCulling__Initialize(config) {
        Na__DistanceCulling__Registry = [];                              // <-- Reset registry on (re)init

        if (!config || config.RenderEffect__DistanceCulling__Enabled !== true) {
            Na__DistanceCulling__Enabled = false;                        // <-- Strict equality per AppConfig authority
            console.log('[TrueVision3D] Distance culling disabled (config).');
            return;
        }

        const cullDistanceMm    = Number.isFinite(config.RenderEffect__DistanceCulling__CullDistanceMm)
            ? config.RenderEffect__DistanceCulling__CullDistanceMm
            : 15000;                                                     // <-- Sensible fallback (15 m)
        const cullDistanceUnits = Na__Math__ConvertMmToUnits(cullDistanceMm);

        const configuredTokens  = Array.isArray(config.RenderEffect__DistanceCulling__CategoryNameTokens)
            ? config.RenderEffect__DistanceCulling__CategoryNameTokens
                .filter((token) => typeof token === 'string')
                .map((token) => token.trim())
                .filter((token) => token.length > 0)
            : [];

        Na__DistanceCulling__Enabled           = true;
        Na__DistanceCulling__CullDistanceUnits = cullDistanceUnits;      // <-- Per-item threshold adds the item radius (nearest-point cull)
        Na__DistanceCulling__CategoryTokens    = configuredTokens.length > 0
            ? configuredTokens
            : Na__DistanceCulling__DefaultTokens;

        console.log(
            `[TrueVision3D] Distance culling enabled: ${cullDistanceUnits}u (${cullDistanceMm}mm), ` +
            `tokens=[${Na__DistanceCulling__CategoryTokens.join(', ')}]`
        );
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Registry Building
// -----

    // HELPER FUNCTION | Check Whether a Category Key Matches a Cull Token
    // ------------------------------------------------------------
    function Na__DistanceCulling__CategoryMatches(categoryKey) {
        if (typeof categoryKey !== 'string') return false;
        return Na__DistanceCulling__CategoryTokens.some((token) => categoryKey.includes(token));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Expand a Box by a Position-like Buffer Attribute
    // ------------------------------------------------------------
    // Iterates a (possibly interleaved) attribute via getX/getY/getZ,
    // transforming each point into world space and expanding outBox.
    // Works for standard BufferAttribute AND InterleavedBufferAttribute
    // (used by fat-line instanceStart / instanceEnd).
    // ------------------------------------------------------------
    function Na__DistanceCulling__ExpandBoxByAttribute(attribute, matrixWorld, outBox) {
        if (!attribute || typeof attribute.count !== 'number') return;

        for (let i = 0; i < attribute.count; i++) {
            Na__DistanceCulling__ScratchPoint
                .set(attribute.getX(i), attribute.getY(i), attribute.getZ(i))
                .applyMatrix4(matrixWorld);
            outBox.expandByPoint(Na__DistanceCulling__ScratchPoint);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute World-Space Bounds for an Item Node
    // ------------------------------------------------------------
    // Accumulates a world-space AABB for an item and ALL its descendants.
    // - Box3.setFromObject is used for standard meshes: it correctly walks
    //   arbitrarily deep group/component nesting AND expands InstancedMesh
    //   by each instance's instanceMatrix (foliage is frequently instanced,
    //   so a single matrixWorld does NOT capture where the leaves really are).
    // - Fat-line LineSegments2 store endpoints in interleaved instanceStart /
    //   instanceEnd attributes that setFromObject does NOT bound; those are
    //   added explicitly so LINEWORK items are bounded too.
    // Returns false when no measurable geometry is found. Assumes world
    // matrices are already up to date (caller bakes them per root group).
    // ------------------------------------------------------------
    function Na__DistanceCulling__ComputeWorldBounds(itemNode, outBox) {
        outBox.setFromObject(itemNode);                                  // <-- Robust: deep nesting + InstancedMesh instance matrices

        itemNode.traverse((child) => {
            const geometry = child.geometry;
            if (geometry && geometry.attributes && geometry.attributes.instanceStart) {
                // FAT LINE | Read interleaved segment endpoints directly (setFromObject misses these)
                Na__DistanceCulling__ExpandBoxByAttribute(geometry.attributes.instanceStart, child.matrixWorld, outBox);
                Na__DistanceCulling__ExpandBoxByAttribute(geometry.attributes.instanceEnd, child.matrixWorld, outBox);
            }
        });

        return !outBox.isEmpty();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Register Item Nodes From a Root Group
    // ------------------------------------------------------------
    // Iterates the direct children (individual items) of a MeshRoot or
    // LineworkRoot, caching each item's world-space centre plus a
    // radius-aware squared threshold for nearest-point distance culling.
    // ------------------------------------------------------------
    function Na__DistanceCulling__RegisterRootChildren(rootGroup) {
        if (!rootGroup || !Array.isArray(rootGroup.children)) return 0;

        rootGroup.updateWorldMatrix(true, true);                         // <-- Bake matrices for the whole subtree once
        let registered = 0;

        for (const itemNode of rootGroup.children) {
            if (!itemNode) continue;

            if (!Na__DistanceCulling__ComputeWorldBounds(itemNode, Na__DistanceCulling__ScratchItemBox)) {
                continue;                                                // <-- No measurable geometry; cannot cull safely
            }

            const centre = new THREE.Vector3();
            Na__DistanceCulling__ScratchItemBox.getCenter(centre);       // <-- World-space centre

            // RADIUS | Bounding-sphere radius of the AABB (corner-to-centre).
            // Nearest-point culling: hide only when (distance - radius) > cullDistance,
            // i.e. distanceSq > (cullDistance + radius)^2. Large merged meshes that
            // span the storey therefore stay visible while any part is near the camera.
            const radius      = Na__DistanceCulling__ScratchItemBox.min.distanceTo(Na__DistanceCulling__ScratchItemBox.max) * 0.5;
            const thresholdSq = (Na__DistanceCulling__CullDistanceUnits + radius) * (Na__DistanceCulling__CullDistanceUnits + radius);

            Na__DistanceCulling__Registry.push({ node: itemNode, centre: centre, thresholdSq: thresholdSq });
            registered++;
        }

        return registered;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register Furniture / Decor Items From Loaded Model Groups
    // ------------------------------------------------------------
    // Accepts the loadedGroups Map (category -> THREE.Group) from the
    // multi-model loader. Rebuilds the cull registry from scratch so the
    // system stays correct across model-group switches.
    // ------------------------------------------------------------
    function Na__DistanceCulling__RegisterModelGroups(loadedGroups) {
        Na__DistanceCulling__Registry = [];                              // <-- Always rebuild clean

        if (!Na__DistanceCulling__Enabled) return 0;
        if (!loadedGroups || typeof loadedGroups.forEach !== 'function') return 0;

        let matchedCategories = 0;
        let meshItemCount     = 0;                                        // <-- Diagnostics: mesh items registered
        let lineworkItemCount = 0;                                        // <-- Diagnostics: linework items registered

        loadedGroups.forEach((categoryGroup, categoryKey) => {
            if (!Na__DistanceCulling__CategoryMatches(categoryKey)) return;
            if (!categoryGroup || !Array.isArray(categoryGroup.children)) return;

            matchedCategories++;

            for (const rootChild of categoryGroup.children) {
                const modelType = rootChild && rootChild.userData && rootChild.userData.Na__ModelType;
                if (modelType === 'mesh') {
                    meshItemCount += Na__DistanceCulling__RegisterRootChildren(rootChild);      // <-- Register mesh items
                } else if (modelType === 'linework') {
                    lineworkItemCount += Na__DistanceCulling__RegisterRootChildren(rootChild);  // <-- Register linework items
                }
            }
        });

        console.log(
            `[TrueVision3D] Distance culling registered ${Na__DistanceCulling__Registry.length} item(s) ` +
            `(${meshItemCount} mesh, ${lineworkItemCount} linework) ` +
            `across ${matchedCategories} matched categor${matchedCategories === 1 ? 'y' : 'ies'}.`
        );

        return Na__DistanceCulling__Registry.length;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Per-Frame Update
// -----

    // FUNCTION | Update Item Visibility Against Camera Distance
    // ------------------------------------------------------------
    // Called each rendered frame (camera-move only under the invalidation
    // render loop). Sets each registered item's .visible based on radial
    // distance from the supplied camera world position. Returns true when
    // any visibility flag changed (so the caller can request a redraw).
    // ------------------------------------------------------------
    function Na__DistanceCulling__Update(cameraWorldPos) {
        if (!Na__DistanceCulling__Enabled) return false;
        if (!cameraWorldPos || Na__DistanceCulling__Registry.length === 0) return false;

        let changed = false;

        for (const entry of Na__DistanceCulling__Registry) {
            const distanceSq      = cameraWorldPos.distanceToSquared(entry.centre);
            const shouldBeVisible = distanceSq <= entry.thresholdSq;     // <-- Nearest-point cull (threshold includes item radius)

            if (entry.node.visible !== shouldBeVisible) {
                entry.node.visible = shouldBeVisible;                    // <-- Toggle individual item only
                changed = true;
            }
        }

        return changed;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Runtime Toggle
// -----

    // FUNCTION | Enable or Disable Culling at Runtime
    // ------------------------------------------------------------
    // When disabling, all registered item nodes are restored to visible so
    // nothing stays hidden from a prior cull pass.
    // ------------------------------------------------------------
    function Na__DistanceCulling__SetEnabled(enabled) {
        Na__DistanceCulling__Enabled = enabled === true;

        if (!Na__DistanceCulling__Enabled) {
            for (const entry of Na__DistanceCulling__Registry) {
                entry.node.visible = true;                               // <-- Restore all on disable
            }
        }

        return Na__DistanceCulling__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Report Current Enable State
    // ------------------------------------------------------------
    function Na__DistanceCulling__IsEnabled() {
        return Na__DistanceCulling__Enabled;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    // MODULE EXPORTS | Distance Culling API
    // ------------------------------------------------------------
    export {
        Na__DistanceCulling__Initialize,
        Na__DistanceCulling__RegisterModelGroups,
        Na__DistanceCulling__Update,
        Na__DistanceCulling__SetEnabled,
        Na__DistanceCulling__IsEnabled
    };
    // ------------------------------------------------------------

// endregion ----
