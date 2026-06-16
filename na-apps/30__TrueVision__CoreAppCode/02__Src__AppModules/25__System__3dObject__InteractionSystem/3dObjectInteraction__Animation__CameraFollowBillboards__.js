// =============================================================================
// TRUEVISION3D - CAMERA FOLLOW BILLBOARD COMPONENTS
// =============================================================================
//
// FILE       : 3dObjectInteraction__Animation__CameraFollowBillboards__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object Interactions - Camera Follow Billboard Animation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Rotate 2D billboard vegetation to always face the camera
// CREATED    : 16-Jun-2026
//
// DESCRIPTION:
// - Scans loaded GLB scene graphs for nodes exported with CameraFollowBillboard extras.
// - Reads pivotLocal from baked glTF node extras (00__OriginPoint capture at export).
// - Applies yaw-only rotation around the pivot each rendered frame.
// - Dual model support: rotates both mesh and linework roots simultaneously.
// - Rebind-aware: re-scans on every Initialize call so design-phase / model-group
//   switches (Na__ReinitializeModelBoundSystems) rebuild the billboard registry.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Jun-2026 - Version 1.0.0
// - Ported from the working ValeVision3D camera-follow billboard module.
// - Made Initialize rebind-aware for TrueVision's model-group switch flow.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import * as THREE from 'three';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__CameraFollow__TYPE_BILLBOARD       = 'CameraFollowBillboard';      // <-- glTF extras.type token
    const Na__CameraFollow__Y_AXIS               = new THREE.Vector3(0, 1, 0);   // <-- Y-up rotation axis

    let Na__CameraFollow__Initialized           = false;                         // <-- Init flag
    let Na__CameraFollow__Enabled               = true;                          // <-- Feature enabled flag
    let Na__CameraFollow__FlatShadingEnabled    = true;                          // <-- Global flat-shading enable
    let Na__CameraFollow__DefaultShadeFlatness  = 0.85;                          // <-- Fallback flatness when not baked in GLB
    let Na__CameraFollow__ModelGroupsMesh       = [];                            // <-- Mesh category roots
    let Na__CameraFollow__ModelGroupsLinework   = [];                            // <-- Linework category roots

    const Na__CameraFollow__Registry            = new Map();                     // <-- Map<uuid, record>

    const Na__CameraFollow__ScratchPivotWorld   = new THREE.Vector3();           // <-- Reusable pivot vector
    const Na__CameraFollow__ScratchRotQuat      = new THREE.Quaternion();        // <-- Reusable rotation quat

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Flat Shading Material Patch
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read Shade Flatness (0..1) from Node Extras
    // ------------------------------------------------------------
    // shadeFlatness is baked into the assembly node extras by the SketchUp
    // exporter (per-component, SSOT-driven). 0 = full directional shading,
    // 1 = fully flat (directional darkening removed). When the GLB predates the
    // exporter field (no baked value) we fall back to the config default so
    // existing models flatten without needing a re-export.
    function Na__CameraFollow__ReadShadeFlatness(object) {
        const userData = object.userData || {};
        const value    = Number(userData.shadeFlatness);

        if (Number.isFinite(value)) {
            return Math.min(1, Math.max(0, value));                              // <-- Baked value (clamped)
        }

        return Math.min(1, Math.max(0, Na__CameraFollow__DefaultShadeFlatness)); // <-- Config fallback (clamped)
    }
    // ------------------------------------------------------------

    // SUB HELPER FUNCTION | Patch a Single Material to Blend Lit -> Flat Albedo
    // ------------------------------------------------------------
    // Injects an onBeforeCompile shader edit (three.js r160 safe) that mixes the
    // final lit colour toward the unlit albedo (diffuseColor) by `flatness`. The
    // material is cloned first so shared material instances on non-billboard
    // meshes are never affected.
    function Na__CameraFollow__PatchMaterialFlatShading(material, flatness) {
        if (!material || !material.isMaterial)        return material;           // <-- Guard non-materials
        if (material.userData && material.userData.naFlatShadePatched) return material; // <-- Idempotent

        const patched = material.clone();                                        // <-- Isolate from shared instances
        patched.userData = Object.assign({}, patched.userData, {
            naFlatShadePatched : true,
            naFlatShadeValue   : flatness
        });

        patched.onBeforeCompile = (shader) => {
            shader.uniforms.naShadeFlatness = { value: flatness };               // <-- Flatness uniform
            shader.fragmentShader = 'uniform float naShadeFlatness;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                '#include <opaque_fragment>\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, diffuseColor.rgb, naShadeFlatness );'
            );
        };
        patched.customProgramCacheKey = () => 'naFlatShade_' + flatness.toFixed(3); // <-- Distinct program per flatness
        patched.needsUpdate = true;

        return patched;
    }
    // ------------------------------------------------------------

    // FUNCTION | Apply Flat Shading to All Meshes Beneath a Billboard Node
    // ------------------------------------------------------------
    function Na__CameraFollow__ApplyFlatShadingToSubtree(rootObject, flatness) {
        if (!Na__CameraFollow__FlatShadingEnabled) return;                       // <-- Global gate
        if (!(flatness > 0))                        return;                       // <-- 0 = leave directional shading intact

        let patchedCount = 0;
        rootObject.traverse((node) => {
            if (!node.isMesh || !node.material) return;                          // <-- Mesh fill only (linework uses LineMaterial)

            if (Array.isArray(node.material)) {
                node.material = node.material.map((mat) => Na__CameraFollow__PatchMaterialFlatShading(mat, flatness));
            } else {
                node.material = Na__CameraFollow__PatchMaterialFlatShading(node.material, flatness);
            }
            patchedCount += 1;
        });

        if (patchedCount > 0) {
            console.log(`[CameraFollow] Flat shading applied (flatness=${flatness}) to ${patchedCount} mesh(es) under "${rootObject.name}"`);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Graph Scanning
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Check if Object is a Camera Follow Billboard Node
    // ------------------------------------------------------------
    function Na__CameraFollow__IsBillboardNode(object) {
        const userData = object.userData || {};
        return userData.type === Na__CameraFollow__TYPE_BILLBOARD
            || userData.cameraFollow === true;
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | Read Pivot Local Position from Node Extras
    // ------------------------------------------------------------
    function Na__CameraFollow__ReadPivotLocal(object) {
        const userData = object.userData || {};
        const pivotArray = userData.pivotLocal;

        if (Array.isArray(pivotArray) && pivotArray.length >= 3) {
            return new THREE.Vector3(pivotArray[0], pivotArray[1], pivotArray[2]);
        }

        return new THREE.Vector3(0, 0, 0);
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | Build a Stable Location Key for Mesh/Linework Pairing
    // ------------------------------------------------------------
    // Multiple billboard instances share an identical node name, so name alone
    // cannot pair a mesh assembly with its linework counterpart. Each instance
    // does, however, occupy a unique world position, so we pair by name + the
    // node's world position (rounded to millimetre precision).
    function Na__CameraFollow__BuildLocationKey(object) {
        object.updateMatrixWorld(true);                                          // <-- Ensure world matrix current
        const worldPos = new THREE.Vector3();
        object.getWorldPosition(worldPos);                                       // <-- Node world position

        const rx = Math.round(worldPos.x * 1000) / 1000;                        // <-- Round X to mm
        const ry = Math.round(worldPos.y * 1000) / 1000;                        // <-- Round Y to mm
        const rz = Math.round(worldPos.z * 1000) / 1000;                        // <-- Round Z to mm

        return `${object.name}|${rx}|${ry}|${rz}`;                              // <-- Composite pairing key
    }
    // ------------------------------------------------------------

    // SUB HELPER FUNCTION | Compute Parent-Space Pivot from Local Pivot
    // ------------------------------------------------------------
    // pivotLocal (from extras) is expressed in the assembly node's own LOCAL
    // space. To rotate the node about that pivot we must express the pivot in
    // the node's PARENT space: pivotParent = position + quaternion * pivotLocal.
    function Na__CameraFollow__ComputePivotParent(object, pivotLocal) {
        const pivotParent = pivotLocal.clone();
        pivotParent.multiply(object.scale);                                      // <-- Apply node scale (component-wise)
        pivotParent.applyQuaternion(object.quaternion);                          // <-- Rotate local offset into parent frame
        pivotParent.add(object.position);                                        // <-- Offset by node translation
        return pivotParent;
    }
    // ------------------------------------------------------------

    // FUNCTION | Scan Scene Graph and Build Billboard Registry
    // ------------------------------------------------------------
    function Na__CameraFollow__ScanForBillboards() {
        Na__CameraFollow__Registry.clear();

        const locationIndex = new Map();                                         // <-- Map<locationKey, record> for pairing

        for (const meshGroup of Na__CameraFollow__ModelGroupsMesh) {
            meshGroup.traverse((object) => {
                if (!Na__CameraFollow__IsBillboardNode(object)) return;

                const pivotLocal = Na__CameraFollow__ReadPivotLocal(object);

                const record = {
                    assemblyName        : object.name,
                    rootObjectMesh      : object,
                    rootObjectLinework  : null,
                    pivotLocalPosition  : pivotLocal,
                    pivotParentPosition : Na__CameraFollow__ComputePivotParent(object, pivotLocal),
                    initialPosition     : object.position.clone(),
                    initialQuaternion   : object.quaternion.clone(),
                    initialReferenceYaw : 0
                };

                Na__CameraFollow__Registry.set(object.uuid, record);            // <-- Key by UUID (always unique)
                locationIndex.set(Na__CameraFollow__BuildLocationKey(object), record);

                const shadeFlatness = Na__CameraFollow__ReadShadeFlatness(object); // <-- SSOT-baked flatness
                Na__CameraFollow__ApplyFlatShadingToSubtree(object, shadeFlatness);

                console.log(`[CameraFollow] Registered billboard (mesh): "${object.name}"`);
            });
        }

        for (const lineworkGroup of Na__CameraFollow__ModelGroupsLinework) {
            lineworkGroup.traverse((object) => {
                if (!Na__CameraFollow__IsBillboardNode(object)) return;

                const locationKey = Na__CameraFollow__BuildLocationKey(object);
                const record      = locationIndex.get(locationKey);

                if (!record) {
                    console.warn(`[CameraFollow] Linework billboard "${object.name}" has no mesh counterpart at its location, skipping`);
                    return;
                }

                record.rootObjectLinework = object;
                console.log(`[CameraFollow] Linked linework for billboard: "${object.name}"`);
            });
        }

        console.log(`[CameraFollow] Scan complete. ${Na__CameraFollow__Registry.size} billboard(s) found.`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pivot Rotation and Per-Frame Update
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply Yaw Rotation Around Pivot to Root Objects
    // ------------------------------------------------------------
    function Na__CameraFollow__ApplyPivotRotation(record, angleRad) {
        const pivot   = record.pivotParentPosition;                             // <-- Pivot in node parent space
        const targets = [record.rootObjectMesh, record.rootObjectLinework].filter(Boolean);

        Na__CameraFollow__ScratchRotQuat.setFromAxisAngle(Na__CameraFollow__Y_AXIS, angleRad);

        for (const rootObject of targets) {
            rootObject.position.copy(record.initialPosition);
            rootObject.quaternion.copy(record.initialQuaternion);

            rootObject.position.sub(pivot);
            rootObject.position.applyQuaternion(Na__CameraFollow__ScratchRotQuat);
            rootObject.position.add(pivot);

            rootObject.quaternion.premultiply(Na__CameraFollow__ScratchRotQuat);
        }
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | Compute Camera Yaw Relative to Initial Reference
    // ------------------------------------------------------------
    function Na__CameraFollow__ComputeCameraYawDelta(record, camera) {
        const rootObject = record.rootObjectMesh;
        if (!rootObject) return 0;

        rootObject.updateMatrixWorld(true);
        Na__CameraFollow__ScratchPivotWorld.copy(record.pivotLocalPosition);
        rootObject.localToWorld(Na__CameraFollow__ScratchPivotWorld);

        const dx = camera.position.x - Na__CameraFollow__ScratchPivotWorld.x;
        const dz = camera.position.z - Na__CameraFollow__ScratchPivotWorld.z;
        const cameraYaw = Math.atan2(dx, dz);

        return cameraYaw - record.initialReferenceYaw;
    }
    // ------------------------------------------------------------

    // FUNCTION | Update All Camera Follow Billboards (called per frame)
    // ------------------------------------------------------------
    function Na__CameraFollow__Update(camera) {
        if (!Na__CameraFollow__Initialized || !Na__CameraFollow__Enabled) return;
        if (!camera || Na__CameraFollow__Registry.size === 0) return;

        Na__CameraFollow__Registry.forEach((record) => {
            const angleRad = Na__CameraFollow__ComputeCameraYawDelta(record, camera);
            Na__CameraFollow__ApplyPivotRotation(record, angleRad);
        });
    }
    // ------------------------------------------------------------

    // FUNCTION | Capture Initial Camera Yaw Reference for All Billboards
    // ------------------------------------------------------------
    function Na__CameraFollow__CaptureInitialReferenceYaw(camera) {
        Na__CameraFollow__Registry.forEach((record) => {
            record.initialReferenceYaw = Na__CameraFollow__ComputeCameraYawDelta(record, camera);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization and Exports
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Camera Follow Billboard System
    // ------------------------------------------------------------
    // Rebind-aware: TrueVision re-runs Na__ReinitializeModelBoundSystems on every
    // model-group / design-phase switch. On any call after the first we adopt the
    // freshly loaded groups, clear the registry, re-scan, re-apply flat shading
    // (the naFlatShadePatched guard prevents double-patching), and re-anchor the
    // initial yaw reference so the new billboards rebuild correctly.
    function Na__CameraFollow__Initialize(meshGroups, lineworkGroups, config, camera) {
        if (Na__CameraFollow__Initialized) {
            Na__CameraFollow__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
            Na__CameraFollow__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups : (lineworkGroups ? [lineworkGroups] : []);

            console.warn('[CameraFollow] Re-scanning after model-group switch');
            Na__CameraFollow__ScanForBillboards();
            if (camera && Na__CameraFollow__Registry.size > 0) {
                Na__CameraFollow__CaptureInitialReferenceYaw(camera);
            }
            return Na__CameraFollow__Registry.size;
        }

        Na__CameraFollow__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
        Na__CameraFollow__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups : (lineworkGroups ? [lineworkGroups] : []);

        if (config) {
            Na__CameraFollow__Enabled            = config['3dObject__Interaction__CameraFollow__Enabled'] !== false;
            Na__CameraFollow__FlatShadingEnabled = config['3dObject__Interaction__CameraFollow__FlatShadingEnabled'] !== false;

            const configDefaultFlatness = Number(config['3dObject__Interaction__CameraFollow__DefaultShadeFlatness']);
            if (Number.isFinite(configDefaultFlatness)) {
                Na__CameraFollow__DefaultShadeFlatness = Math.min(1, Math.max(0, configDefaultFlatness)); // <-- Clamp config default
            }
        }

        Na__CameraFollow__ScanForBillboards();

        if (camera && Na__CameraFollow__Registry.size > 0) {
            Na__CameraFollow__CaptureInitialReferenceYaw(camera);
        }

        Na__CameraFollow__Initialized = true;
        console.log('[CameraFollow] Camera-follow billboard system initialized');
        return Na__CameraFollow__Registry.size;                                  // <-- Number of billboards registered
    }
    // ------------------------------------------------------------

    // FUNCTION | Check if Any Billboards Are Registered
    // ------------------------------------------------------------
    function Na__CameraFollow__HasActive() {
        return Na__CameraFollow__Initialized
            && Na__CameraFollow__Enabled
            && Na__CameraFollow__Registry.size > 0;
    }
    // ------------------------------------------------------------

    export {
        Na__CameraFollow__Initialize,
        Na__CameraFollow__Update,
        Na__CameraFollow__HasActive,
        Na__CameraFollow__ScanForBillboards,
        Na__CameraFollow__Registry
    };

// endregion -------------------------------------------------------------------
