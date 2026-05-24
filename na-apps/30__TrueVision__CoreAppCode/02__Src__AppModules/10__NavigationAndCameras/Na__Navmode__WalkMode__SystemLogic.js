// =============================================================================
// TRUEVISION3D - WALK MODE NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__Navmode__WalkMode__SystemLogic.js
// NAMESPACE  : TrueVision3D
// MODULE     : Walk Mode Navigation - System Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-person walk mode with capsule collision, gravity, and stair stepping
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - Provides a first-person walking navigation mode for architectural model viewing.
// - Uses an invisible capsule (pill-shaped) constraint for realistic collision.
// - Implements gravity with ground detection via downward raycasting.
// - Supports stair ascending up to a configurable step height threshold.
// - All config values are integer millimeters, converted to Three.js units on init.
// - Completely separate from the orbit mode system with its own state management.
// - Delegates input handling to DesktopControls and TouchScreenControls modules.
//
// INTEGRATION:
// - Call Na__WalkMode__Initialize() after scene and camera are ready.
// - Call Na__WalkMode__SetCollisionMeshes() after GLB models are loaded.
// - Call Na__WalkMode__Update(deltaMs) every frame in the render loop.
// - Toggle with Na__WalkMode__Activate() / Na__WalkMode__Deactivate().
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Feb-2026 - Version 1.0.0
// - Initial implementation of walk mode navigation system.
//
// 23-Feb-2026 - Version 1.0.1
// - Added Na__WalkMode__CollisionExemptNames and Na__WalkMode__IsCollisionExempt.
// - Dev__DefaultCube and OrbitHelperCube are permanently ghostable in walk mode.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Imports
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------


    // MODULE VARIABLES | TrueVision3D Engine Imports
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Configuration (Defaults - Overridden by AppConfig)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Walk Mode Default Configuration (Millimeters)
    // ------------------------------------------------------------
    let Na__WalkMode__Config__EyeHeightMm                  = 1620;       // <-- Eye height above ground (mm)
    let Na__WalkMode__Config__CapsuleHeightMm              = 1800;       // <-- Full capsule height (mm)
    let Na__WalkMode__Config__CapsuleRadiusMm              = 280;        // <-- Capsule radius (mm)
    let Na__WalkMode__Config__HorizontalFovDeg             = 75;         // <-- Walk mode camera FOV (degrees)
    let Na__WalkMode__Config__MovementSpeedMmPerSec        = 3500;       // <-- Walk speed (mm per second)
    let Na__WalkMode__Config__SprintMultiplier              = 1.8;        // <-- Sprint speed multiplier
    let Na__WalkMode__Config__GravityMmPerSecSq            = 9810;       // <-- Gravity acceleration (mm/s^2)
    let Na__WalkMode__Config__MaxStepHeightMm              = 350;        // <-- Max climbable step height (mm)
    let Na__WalkMode__Config__MouseSensitivity             = 0.002;      // <-- Mouse look sensitivity
    let Na__WalkMode__Config__DoorProximityThresholdMm     = 3000;       // <-- Door proximity trigger distance (mm)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Converted Units (Populated on Initialize)
    // ------------------------------------------------------------
    let Na__WalkMode__Units__EyeHeight                     = 0;          // <-- Eye height in Three.js units
    let Na__WalkMode__Units__CapsuleHeight                 = 0;          // <-- Capsule height in Three.js units
    let Na__WalkMode__Units__CapsuleRadius                 = 0;          // <-- Capsule radius in Three.js units
    let Na__WalkMode__Units__MovementSpeedPerSec           = 0;          // <-- Walk speed in units/sec
    let Na__WalkMode__Units__GravityPerSecSq               = 0;          // <-- Gravity in units/s^2
    let Na__WalkMode__Units__MaxStepHeight                 = 0;          // <-- Step height in Three.js units
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Raycaster Configuration
    // ------------------------------------------------------------
    const Na__WalkMode__RAYCAST_DOWN_OFFSET                = 0.05;       // <-- Small offset above capsule bottom for downward ray
    const Na__WalkMode__RAYCAST_HORIZONTAL_COUNT           = 8;          // <-- Number of horizontal collision rays (evenly spaced around capsule)
    const Na__WalkMode__RAYCAST_VERTICAL_LEVELS            = 3;          // <-- Ray heights: ankle, waist, head
    const Na__WalkMode__PITCH_CLAMP_RAD                    = 1.483;      // <-- ~85 degrees pitch clamp (radians)
    const Na__WalkMode__TERMINAL_VELOCITY                  = 50;         // <-- Max fall speed in units/sec
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core References
    // ------------------------------------------------------------
    let Na__WalkMode__Scene                                = null;       // <-- Three.js scene reference
    let Na__WalkMode__Camera                               = null;       // <-- Three.js camera reference
    let Na__WalkMode__RendererDomElement                   = null;       // <-- Canvas DOM element
    let Na__WalkMode__Initialized                          = false;      // <-- Module initialization flag
    let Na__WalkMode__Active                               = false;      // <-- Walk mode currently active
    // ------------------------------------------------------------


    // MODULE VARIABLES | Capsule Physics State
    // ------------------------------------------------------------
    const Na__WalkMode__CapsulePosition                    = new THREE.Vector3(0, 0, 0);  // <-- Capsule base position (feet)
    let Na__WalkMode__VelocityY                            = 0;          // <-- Vertical velocity (units/sec)
    let Na__WalkMode__IsGrounded                           = false;      // <-- Currently touching ground
    let Na__WalkMode__CameraYaw                            = 0;          // <-- Horizontal rotation (radians)
    let Na__WalkMode__CameraPitch                          = 0;          // <-- Vertical rotation (radians)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Saved Orbit State (Restored on Deactivate)
    // ------------------------------------------------------------
    const Na__WalkMode__SavedOrbitState                    = {
        cameraPosition   : new THREE.Vector3(),                          // <-- Camera position before walk mode
        cameraQuaternion : new THREE.Quaternion(),                       // <-- Camera quaternion before walk mode
        cameraFov        : 45,                                           // <-- Camera FOV before walk mode
        orbitTarget      : new THREE.Vector3()                           // <-- Orbit target before walk mode
    };
    // ------------------------------------------------------------


    // MODULE VARIABLES | Collision Data
    // ------------------------------------------------------------
    let Na__WalkMode__CollisionMeshes                      = [];         // <-- Array of meshes for collision raycasting (excludes linework + exempt helpers)
    const Na__WalkMode__Raycaster                          = new THREE.Raycaster();  // <-- Reusable raycaster
    const Na__WalkMode__RayDirection__Down                 = new THREE.Vector3(0, -1, 0);  // <-- Downward ray direction
    // ------------------------------------------------------------


    // MODULE VARIABLES | Reusable Scratch Vectors (Avoid Per-Frame Allocation in Hot Paths)
    // ------------------------------------------------------------
    const Na__WalkMode__Scratch__RayOrigin                 = new THREE.Vector3();         // <-- Reusable raycast origin
    const Na__WalkMode__Scratch__MoveDelta                 = new THREE.Vector3();         // <-- Reusable horizontal move delta
    const Na__WalkMode__Scratch__MoveDirection             = new THREE.Vector3();         // <-- Reusable normalised move direction
    const Na__WalkMode__Scratch__HitNormal                 = new THREE.Vector3();         // <-- Reusable face-normal scratch
    const Na__WalkMode__Scratch__SlideVelocity             = new THREE.Vector3();         // <-- Reusable wall-slide velocity
    const Na__WalkMode__Scratch__ResolvedPosition          = new THREE.Vector3();         // <-- Reusable resolved position return value
    const Na__WalkMode__Scratch__Forward                   = new THREE.Vector3();         // <-- Reusable forward vector
    const Na__WalkMode__Scratch__Right                     = new THREE.Vector3();         // <-- Reusable right vector
    const Na__WalkMode__Scratch__MoveVector                = new THREE.Vector3();         // <-- Reusable per-frame movement accumulator
    const Na__WalkMode__Scratch__PreviousPosition          = new THREE.Vector3();         // <-- Reusable snapshot of capsule position before move
    const Na__WalkMode__Scratch__ProposedPosition          = new THREE.Vector3();         // <-- Reusable proposed (unresolved) position
    const Na__WalkMode__Scratch__UpAxis                    = new THREE.Vector3(0, 1, 0);  // <-- World-up reference axis (immutable)
    const Na__WalkMode__Scratch__Euler                     = new THREE.Euler();           // <-- Reusable Euler for camera quaternion
    // ------------------------------------------------------------


    // MODULE VARIABLES | Input State (Set by Desktop/Touch Controls)
    // ------------------------------------------------------------
    let Na__WalkMode__InputForward                         = 0;          // <-- Forward/backward input [-1, 1]
    let Na__WalkMode__InputStrafe                          = 0;          // <-- Left/right strafe input [-1, 1]
    let Na__WalkMode__InputSprint                          = false;      // <-- Sprint modifier active
    let Na__WalkMode__InputYawDelta                        = 0;          // <-- Mouse/touch yaw delta (accumulated per frame)
    let Na__WalkMode__InputPitchDelta                      = 0;          // <-- Mouse/touch pitch delta (accumulated per frame)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration and Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply Config Values from AppConfig JSON
    // ------------------------------------------------------------
    function Na__WalkMode__ApplyConfig(walkModeConfig) {
        if (!walkModeConfig) return;

        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__EyeHeightMm)) {
            Na__WalkMode__Config__EyeHeightMm = walkModeConfig.Navmode__WalkMode__EyeHeightMm;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__CapsuleHeightMm)) {
            Na__WalkMode__Config__CapsuleHeightMm = walkModeConfig.Navmode__WalkMode__CapsuleHeightMm;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__CapsuleRadiusMm)) {
            Na__WalkMode__Config__CapsuleRadiusMm = walkModeConfig.Navmode__WalkMode__CapsuleRadiusMm;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__HorizontalFovDeg)) {
            Na__WalkMode__Config__HorizontalFovDeg = walkModeConfig.Navmode__WalkMode__HorizontalFovDeg;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__MovementSpeedMmPerSec)) {
            Na__WalkMode__Config__MovementSpeedMmPerSec = walkModeConfig.Navmode__WalkMode__MovementSpeedMmPerSec;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__SprintMultiplier)) {
            Na__WalkMode__Config__SprintMultiplier = walkModeConfig.Navmode__WalkMode__SprintMultiplier;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__GravityMmPerSecSq)) {
            Na__WalkMode__Config__GravityMmPerSecSq = walkModeConfig.Navmode__WalkMode__GravityMmPerSecSq;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__MaxStepHeightMm)) {
            Na__WalkMode__Config__MaxStepHeightMm = walkModeConfig.Navmode__WalkMode__MaxStepHeightMm;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__MouseSensitivity)) {
            Na__WalkMode__Config__MouseSensitivity = walkModeConfig.Navmode__WalkMode__MouseSensitivity;
        }
        if (Number.isFinite(walkModeConfig.Navmode__WalkMode__DoorProximityThresholdMm)) {
            Na__WalkMode__Config__DoorProximityThresholdMm = walkModeConfig.Navmode__WalkMode__DoorProximityThresholdMm;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert All Config MM Values to Three.js Units
    // ------------------------------------------------------------
    function Na__WalkMode__ConvertConfigToUnits() {
        Na__WalkMode__Units__EyeHeight           = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__EyeHeightMm);
        Na__WalkMode__Units__CapsuleHeight       = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__CapsuleHeightMm);
        Na__WalkMode__Units__CapsuleRadius       = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__CapsuleRadiusMm);
        Na__WalkMode__Units__MovementSpeedPerSec = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__MovementSpeedMmPerSec);
        Na__WalkMode__Units__GravityPerSecSq     = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__GravityMmPerSecSq);
        Na__WalkMode__Units__MaxStepHeight       = Na__Math__ConvertMmToUnits(Na__WalkMode__Config__MaxStepHeightMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Walk Mode System
    // ------------------------------------------------------------
    function Na__WalkMode__Initialize(scene, camera, rendererDomElement, walkModeConfig) {
        Na__WalkMode__Scene              = scene;
        Na__WalkMode__Camera             = camera;
        Na__WalkMode__RendererDomElement = rendererDomElement;
        Na__WalkMode__Raycaster.camera   = camera;

        Na__WalkMode__ApplyConfig(walkModeConfig);
        Na__WalkMode__ConvertConfigToUnits();

        Na__WalkMode__Initialized = true;
        console.log('[WalkMode] Walk mode system initialized');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Collision Mesh Management
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Keyword Substrings That Flag an Object as Collision-Exempt
    // ------------------------------------------------------------
    // Exact match is NOT used because GLB files exported with a project prefix
    // produce names like "NP03__01__OrbitHelperCube__MeshModel__" where the
    // keyword sits in the middle.  Substring matching catches all variants.
    //
    // Dev__DefaultCube  : Programmatic reference/pivot cube created from AppConfig.
    // OrbitHelperCube   : GLB orbit-target cube (may be prefixed e.g. NP03__01__OrbitHelperCube__MeshModel__).
    // ------------------------------------------------------------
    const Na__WalkMode__CollisionExemptKeywords = [
        'Dev__DefaultCube',    // <-- Programmatic dev/pivot reference cube
        'OrbitHelperCube'      // <-- GLB orbit helper cube (handles project-prefixed names)
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check Whether a Mesh Is Exempt from Collision
    // ------------------------------------------------------------
    // Walks the object's full ancestor chain testing each node name with a
    // substring check against every exempt keyword.  This covers:
    //   - The mesh itself (e.g. "01__OrbitHelperCubeDefault")
    //   - Its parent group  (e.g. "NP03__01__OrbitHelperCube__MeshModel__")
    //   - Any higher ancestor that carries an exempt keyword in its name
    // ------------------------------------------------------------
    function Na__WalkMode__IsCollisionExempt(object) {
        let current = object;                                                 // <-- Start at the object itself
        while (current) {
            if (typeof current.name === 'string' && current.name.length > 0) {
                for (const keyword of Na__WalkMode__CollisionExemptKeywords) {
                    if (current.name.includes(keyword)) return true;          // <-- Keyword found in name
                }
            }
            current = current.parent;                                         // <-- Walk up scene graph
        }
        return false;                                                         // <-- No exempt ancestor found
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk Parent Chain to Detect Linework Group Membership
    // ------------------------------------------------------------
    // Mirrors the same defensive guard used in Na__RenderEffect__ProfileLines__.js
    // so the collision system never raycasts against any object that belongs to
    // a linework GLB (visual decoration only - has no physical collision meaning).
    // The tag is set in Na__ModelLoader__MultiModel.js when each linework root is
    // attached to its category group (userData.Na__ModelType = 'linework').
    // ------------------------------------------------------------
    function Na__WalkMode__IsInsideLineworkGroup(object) {
        let node = object;
        while (node) {
            if (node.userData && node.userData.Na__ModelType === 'linework') return true; // <-- Tagged linework root
            node = node.parent;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Collision Meshes from Loaded Model Groups
    // ------------------------------------------------------------
    function Na__WalkMode__SetCollisionMeshes(modelGroupRoot) {
        Na__WalkMode__CollisionMeshes = [];

        if (!modelGroupRoot) return;

        let rejectedFatLine     = 0;
        let rejectedLineworkGrp = 0;
        let rejectedExempt      = 0;

        modelGroupRoot.traverse((child) => {
            if (!child.isMesh) return;                                        // <-- Skip non-mesh nodes
            if (child.isLine2 || child.isLineSegments2) { rejectedFatLine++; return; }     // <-- LineSegments2 sets isMesh=true; their template quad has no collision meaning
            if (Na__WalkMode__IsInsideLineworkGroup(child)) { rejectedLineworkGrp++; return; } // <-- Defensive: any mesh nested inside a linework GLB root
            if (Na__WalkMode__IsCollisionExempt(child)) { rejectedExempt++; return; }      // <-- Skip exempted helper objects (Dev cube, OrbitHelperCube)
            Na__WalkMode__CollisionMeshes.push(child);
        });

        console.log(
            `[WalkMode] Collision meshes set: ${Na__WalkMode__CollisionMeshes.length} meshes `
            + `(rejected: ${rejectedFatLine} fat-lines, ${rejectedLineworkGrp} linework-grouped, ${rejectedExempt} exempt)`
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Ground Detection and Gravity
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Raycast Downward to Find Ground Height
    // ------------------------------------------------------------
    function Na__WalkMode__RaycastGround(positionX, positionZ, startHeight) {
        if (Na__WalkMode__CollisionMeshes.length === 0) return null;

        Na__WalkMode__Scratch__RayOrigin.set(positionX, startHeight, positionZ);                         // <-- Reused scratch (no allocation)
        Na__WalkMode__Raycaster.set(Na__WalkMode__Scratch__RayOrigin, Na__WalkMode__RayDirection__Down); // <-- Raycaster internally copies origin/direction
        Na__WalkMode__Raycaster.far = startHeight + Na__WalkMode__Units__CapsuleHeight * 2;

        const intersections = Na__WalkMode__Raycaster.intersectObjects(Na__WalkMode__CollisionMeshes, false);

        if (intersections.length > 0) {
            return intersections[0].point.y;
        }

        return null;
    }
    // ------------------------------------------------------------


    // MODULE VARIABLES | Pre-Computed Ground Probe Offsets (Cross Pattern)
    // ------------------------------------------------------------
    // Lazily populated on first DetectGroundHeight call (after units are known).
    // Flat numeric pairs to avoid per-call object literal allocation.
    // ------------------------------------------------------------
    let Na__WalkMode__GroundProbeOffsetsX = null;
    let Na__WalkMode__GroundProbeOffsetsZ = null;
    // ------------------------------------------------------------


    // HELPER FUNCTION | Multi-Ray Ground Detection (Cross Pattern for Stability)
    // ------------------------------------------------------------
    function Na__WalkMode__DetectGroundHeight(capsuleX, capsuleZ, currentFootY) {
        if (Na__WalkMode__GroundProbeOffsetsX === null) {
            const r = Na__WalkMode__Units__CapsuleRadius * 0.5;
            Na__WalkMode__GroundProbeOffsetsX = [ 0,  r, -r,  0,  0 ];                                   // <-- Cross pattern: center + 4 cardinals
            Na__WalkMode__GroundProbeOffsetsZ = [ 0,  0,  0,  r, -r ];
        }

        const rayStartY = currentFootY + Na__WalkMode__Units__CapsuleHeight + Na__WalkMode__RAYCAST_DOWN_OFFSET;
        const offsetsX  = Na__WalkMode__GroundProbeOffsetsX;
        const offsetsZ  = Na__WalkMode__GroundProbeOffsetsZ;
        let bestGroundY = null;

        for (let i = 0; i < 5; i++) {
            const groundY = Na__WalkMode__RaycastGround(capsuleX + offsetsX[i], capsuleZ + offsetsZ[i], rayStartY);
            if (groundY !== null && (bestGroundY === null || groundY > bestGroundY)) {
                bestGroundY = groundY;
            }
        }

        return bestGroundY;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Gravity and Ground Snapping
    // ------------------------------------------------------------
    function Na__WalkMode__ApplyGravity(deltaSec) {
        if (Na__WalkMode__CollisionMeshes.length === 0) {
            Na__WalkMode__IsGrounded = true;
            return;
        }

        // FAST PATH | Skip the 5-ray ground detection entirely when the player is
        // standing still on solid ground.  Ground state cannot change without
        // either vertical velocity (jumping/falling) or horizontal input (walking
        // off a ledge), so re-raycasting every frame just to confirm the player
        // is still on the floor is pure wasted GPU/CPU cost.  This collapses idle
        // walk-mode ground checks from ~5,500 mesh tests per frame to zero.
        if (Na__WalkMode__IsGrounded
            && Na__WalkMode__VelocityY === 0
            && Na__WalkMode__InputForward === 0
            && Na__WalkMode__InputStrafe === 0) {
            return;
        }

        const groundY = Na__WalkMode__DetectGroundHeight(
            Na__WalkMode__CapsulePosition.x,
            Na__WalkMode__CapsulePosition.z,
            Na__WalkMode__CapsulePosition.y
        );

        if (groundY !== null) {
            const feetAboveGround = Na__WalkMode__CapsulePosition.y - groundY;

            if (feetAboveGround <= Na__WalkMode__RAYCAST_DOWN_OFFSET && Na__WalkMode__VelocityY <= 0) {
                Na__WalkMode__CapsulePosition.y = groundY;
                Na__WalkMode__VelocityY = 0;
                Na__WalkMode__IsGrounded = true;
                return;
            }
        }

        Na__WalkMode__VelocityY -= Na__WalkMode__Units__GravityPerSecSq * deltaSec;
        Na__WalkMode__VelocityY = Math.max(Na__WalkMode__VelocityY, -Na__WalkMode__TERMINAL_VELOCITY);
        Na__WalkMode__CapsulePosition.y += Na__WalkMode__VelocityY * deltaSec;

        if (groundY !== null && Na__WalkMode__CapsulePosition.y < groundY) {
            Na__WalkMode__CapsulePosition.y = groundY;
            Na__WalkMode__VelocityY = 0;
            Na__WalkMode__IsGrounded = true;
        } else {
            Na__WalkMode__IsGrounded = false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Horizontal Collision Detection (Wall + Stair Stepping)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Raycast Horizontal Collision at Given Height
    // ------------------------------------------------------------
    function Na__WalkMode__RaycastHorizontal(origin, direction, maxDistance) {
        if (Na__WalkMode__CollisionMeshes.length === 0) return null;

        Na__WalkMode__Raycaster.set(origin, direction);
        Na__WalkMode__Raycaster.far = maxDistance;

        const intersections = Na__WalkMode__Raycaster.intersectObjects(Na__WalkMode__CollisionMeshes, false);

        if (intersections.length > 0) {
            return intersections[0];
        }

        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Horizontal Collisions with Stair Stepping
    // ------------------------------------------------------------
    function Na__WalkMode__ResolveHorizontalCollisions(proposedPosition, previousPosition) {
        const moveDelta = Na__WalkMode__Scratch__MoveDelta.subVectors(proposedPosition, previousPosition); // <-- Reused scratch (no allocation)
        moveDelta.y = 0;
        const moveDistance = moveDelta.length();

        if (moveDistance < 0.0001) return proposedPosition;

        const moveDirection = Na__WalkMode__Scratch__MoveDirection.copy(moveDelta).normalize();           // <-- Reused scratch (no allocation)
        const capsuleRadius = Na__WalkMode__Units__CapsuleRadius;
        const rayDistance   = moveDistance + capsuleRadius;

        const ankleHeight = Na__WalkMode__CapsulePosition.y + 0.05;
        const waistHeight = Na__WalkMode__CapsulePosition.y + Na__WalkMode__Units__CapsuleHeight * 0.5;
        const headHeight  = Na__WalkMode__CapsulePosition.y + Na__WalkMode__Units__CapsuleHeight * 0.9;

        const rayOrigin = Na__WalkMode__Scratch__RayOrigin;                                              // <-- Single reused origin, mutated per ray
        let blocked         = false;
        let lowestHitHeight = Infinity;
        let hitNormal       = null;

        for (let i = 0; i < 3; i++) {
            const rayHeight = (i === 0) ? ankleHeight : (i === 1) ? waistHeight : headHeight;
            rayOrigin.set(previousPosition.x, rayHeight, previousPosition.z);
            const hit = Na__WalkMode__RaycastHorizontal(rayOrigin, moveDirection, rayDistance);

            if (hit && hit.distance < rayDistance) {
                blocked = true;
                if (rayHeight < lowestHitHeight) {
                    lowestHitHeight = rayHeight;
                    hitNormal       = hit.face ? hit.face.normal : null;                                 // <-- Hold reference; cloned later only if needed
                }
            }
        }

        if (!blocked) return proposedPosition;

        rayOrigin.set(previousPosition.x, ankleHeight, previousPosition.z);
        const ankleHit = Na__WalkMode__RaycastHorizontal(rayOrigin, moveDirection, rayDistance);

        if (ankleHit && ankleHit.distance < rayDistance) {
            const obstacleY  = ankleHit.point.y;
            const stepHeight = obstacleY - Na__WalkMode__CapsulePosition.y;

            if (stepHeight > 0 && stepHeight <= Na__WalkMode__Units__MaxStepHeight) {
                const stepCheckStartY = Na__WalkMode__CapsulePosition.y + Na__WalkMode__Units__MaxStepHeight + Na__WalkMode__Units__CapsuleHeight;
                const stepGroundY = Na__WalkMode__RaycastGround(
                    proposedPosition.x,
                    proposedPosition.z,
                    stepCheckStartY
                );

                if (stepGroundY !== null && (stepGroundY - Na__WalkMode__CapsulePosition.y) <= Na__WalkMode__Units__MaxStepHeight) {
                    rayOrigin.set(proposedPosition.x, stepGroundY + Na__WalkMode__Units__CapsuleHeight * 0.9, proposedPosition.z);
                    const headHit = Na__WalkMode__RaycastHorizontal(rayOrigin, moveDirection, capsuleRadius);

                    if (!headHit) {
                        proposedPosition.y = stepGroundY;
                        Na__WalkMode__CapsulePosition.y = stepGroundY;
                        return proposedPosition;
                    }
                }
            }
        }

        if (hitNormal) {
            const worldNormal = Na__WalkMode__Scratch__HitNormal.copy(hitNormal);                        // <-- Copy into scratch; do not mutate the geometry face normal
            worldNormal.y = 0;
            worldNormal.normalize();

            const slideVelocity = Na__WalkMode__Scratch__SlideVelocity.copy(moveDelta)
                .sub(worldNormal.multiplyScalar(moveDelta.dot(worldNormal)));                            // <-- Reused scratch (no allocation)

            return Na__WalkMode__Scratch__ResolvedPosition.set(
                previousPosition.x + slideVelocity.x,
                proposedPosition.y,
                previousPosition.z + slideVelocity.z
            );
        }

        return Na__WalkMode__Scratch__ResolvedPosition.set(previousPosition.x, proposedPosition.y, previousPosition.z);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Camera Look (Yaw / Pitch)
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Camera Look Rotation from Input Deltas
    // ------------------------------------------------------------
    function Na__WalkMode__ApplyCameraLook() {
        Na__WalkMode__CameraYaw   -= Na__WalkMode__InputYawDelta;
        Na__WalkMode__CameraPitch -= Na__WalkMode__InputPitchDelta;

        Na__WalkMode__CameraPitch = Math.max(
            -Na__WalkMode__PITCH_CLAMP_RAD,
            Math.min(Na__WalkMode__PITCH_CLAMP_RAD, Na__WalkMode__CameraPitch)
        );

        Na__WalkMode__InputYawDelta   = 0;
        Na__WalkMode__InputPitchDelta = 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Camera Position and Rotation from Capsule State
    // ------------------------------------------------------------
    function Na__WalkMode__UpdateCameraFromCapsule() {
        if (!Na__WalkMode__Camera) return;

        Na__WalkMode__Camera.position.set(
            Na__WalkMode__CapsulePosition.x,
            Na__WalkMode__CapsulePosition.y + Na__WalkMode__Units__EyeHeight,
            Na__WalkMode__CapsulePosition.z
        );

        Na__WalkMode__Scratch__Euler.set(Na__WalkMode__CameraPitch, Na__WalkMode__CameraYaw, 0, 'YXZ');  // <-- Reused scratch Euler (no allocation)
        Na__WalkMode__Camera.quaternion.setFromEuler(Na__WalkMode__Scratch__Euler);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Movement Processing
// -----------------------------------------------------------------------------

    // FUNCTION | Process Movement Input and Apply Physics
    // ------------------------------------------------------------
    function Na__WalkMode__ProcessMovement(deltaSec) {
        // FAST PATH | No input -> no movement -> no collision work
        if (Na__WalkMode__InputForward === 0 && Na__WalkMode__InputStrafe === 0) return;

        const forward = Na__WalkMode__Scratch__Forward.set(0, 0, -1)
            .applyAxisAngle(Na__WalkMode__Scratch__UpAxis, Na__WalkMode__CameraYaw);                     // <-- Reused scratch

        const right = Na__WalkMode__Scratch__Right.copy(forward)
            .cross(Na__WalkMode__Scratch__UpAxis)
            .normalize();                                                                                // <-- Reused scratch

        let speed = Na__WalkMode__Units__MovementSpeedPerSec;
        if (Na__WalkMode__InputSprint) {
            speed *= Na__WalkMode__Config__SprintMultiplier;
        }

        const moveVector = Na__WalkMode__Scratch__MoveVector.set(0, 0, 0);                               // <-- Reused scratch (zeroed every frame)
        moveVector.x = forward.x * Na__WalkMode__InputForward * speed * deltaSec
                     + right.x   * Na__WalkMode__InputStrafe  * speed * deltaSec;
        moveVector.z = forward.z * Na__WalkMode__InputForward * speed * deltaSec
                     + right.z   * Na__WalkMode__InputStrafe  * speed * deltaSec;

        if (moveVector.x !== 0 || moveVector.z !== 0) {
            const previousPosition = Na__WalkMode__Scratch__PreviousPosition.copy(Na__WalkMode__CapsulePosition);   // <-- Reused scratch
            const proposedPosition = Na__WalkMode__Scratch__ProposedPosition.set(                                  // <-- Reused scratch
                Na__WalkMode__CapsulePosition.x + moveVector.x,
                Na__WalkMode__CapsulePosition.y,
                Na__WalkMode__CapsulePosition.z + moveVector.z
            );

            const resolvedPosition = Na__WalkMode__ResolveHorizontalCollisions(proposedPosition, previousPosition);

            Na__WalkMode__CapsulePosition.x = resolvedPosition.x;
            Na__WalkMode__CapsulePosition.y = resolvedPosition.y;
            Na__WalkMode__CapsulePosition.z = resolvedPosition.z;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate Walk Mode
// -----------------------------------------------------------------------------

    // FUNCTION | Activate Walk Mode (Switch from Orbit to Walk)
    // ------------------------------------------------------------
    function Na__WalkMode__Activate(orbitControls) {
        if (!Na__WalkMode__Initialized) {
            console.warn('[WalkMode] Cannot activate: system not initialized');
            return false;
        }
        if (Na__WalkMode__Active) {
            console.warn('[WalkMode] Already active');
            return false;
        }

        Na__WalkMode__SavedOrbitState.cameraPosition.copy(Na__WalkMode__Camera.position);
        Na__WalkMode__SavedOrbitState.cameraQuaternion.copy(Na__WalkMode__Camera.quaternion);
        Na__WalkMode__SavedOrbitState.cameraFov = Na__WalkMode__Camera.fov;
        if (orbitControls && orbitControls.target) {
            Na__WalkMode__SavedOrbitState.orbitTarget.copy(orbitControls.target);
        }

        if (orbitControls) {
            orbitControls.enabled = false;
        }

        Na__WalkMode__Camera.fov = Na__WalkMode__Config__HorizontalFovDeg;
        Na__WalkMode__Camera.updateProjectionMatrix();

        Na__WalkMode__CapsulePosition.set(
            Na__WalkMode__Camera.position.x,
            Na__WalkMode__Camera.position.y - Na__WalkMode__Units__EyeHeight,
            Na__WalkMode__Camera.position.z
        );

        const groundY = Na__WalkMode__DetectGroundHeight(
            Na__WalkMode__CapsulePosition.x,
            Na__WalkMode__CapsulePosition.z,
            Na__WalkMode__CapsulePosition.y
        );

        if (groundY !== null) {
            Na__WalkMode__CapsulePosition.y = groundY;
        }

        const euler = new THREE.Euler().setFromQuaternion(Na__WalkMode__Camera.quaternion, 'YXZ');
        Na__WalkMode__CameraYaw   = euler.y;
        Na__WalkMode__CameraPitch = euler.x;

        Na__WalkMode__VelocityY  = 0;
        Na__WalkMode__IsGrounded = false;

        Na__WalkMode__InputForward    = 0;
        Na__WalkMode__InputStrafe     = 0;
        Na__WalkMode__InputSprint     = false;
        Na__WalkMode__InputYawDelta   = 0;
        Na__WalkMode__InputPitchDelta = 0;

        Na__WalkMode__Active = true;
        console.log('[WalkMode] Walk mode activated');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Walk Mode (Switch Back to Orbit)
    // ------------------------------------------------------------
    // overrideCameraPosition (optional Vector3): when provided the orbit
    // camera is placed here instead of at the pre-walk snapshot position.
    // The orbit target and FOV are always restored from the saved state.
    // ------------------------------------------------------------
    function Na__WalkMode__Deactivate(orbitControls, overrideCameraPosition) {
        if (!Na__WalkMode__Active) return false;

        const restorePos = (overrideCameraPosition && overrideCameraPosition.isVector3)
            ? overrideCameraPosition
            : Na__WalkMode__SavedOrbitState.cameraPosition;

        Na__WalkMode__Camera.position.copy(restorePos);
        Na__WalkMode__Camera.fov = Na__WalkMode__SavedOrbitState.cameraFov;
        Na__WalkMode__Camera.updateProjectionMatrix();

        if (orbitControls) {
            if (orbitControls.target) {
                orbitControls.target.copy(Na__WalkMode__SavedOrbitState.orbitTarget);
            }
            orbitControls.enabled = true;
            orbitControls.update();
        }

        Na__WalkMode__Active = false;
        console.log('[WalkMode] Walk mode deactivated, orbit restored');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per-Frame Update
// -----------------------------------------------------------------------------

    // FUNCTION | Update Walk Mode System (Called Every Frame)
    // ------------------------------------------------------------
    function Na__WalkMode__Update(deltaMs) {
        if (!Na__WalkMode__Initialized || !Na__WalkMode__Active) return;

        const deltaSec = Math.min(deltaMs / 1000, 0.1);

        Na__WalkMode__ApplyCameraLook();
        Na__WalkMode__ProcessMovement(deltaSec);
        Na__WalkMode__ApplyGravity(deltaSec);
        Na__WalkMode__UpdateCameraFromCapsule();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Input Setters (Called by Desktop/Touch Control Modules)
// -----------------------------------------------------------------------------

    // FUNCTION | Set Movement Input Values
    // ------------------------------------------------------------
    function Na__WalkMode__SetMovementInput(forward, strafe, sprint) {
        Na__WalkMode__InputForward = forward;
        Na__WalkMode__InputStrafe  = strafe;
        Na__WalkMode__InputSprint  = sprint;
    }
    // ------------------------------------------------------------


    // FUNCTION | Accumulate Look Input Deltas
    // ------------------------------------------------------------
    function Na__WalkMode__AccumulateLookInput(yawDelta, pitchDelta) {
        Na__WalkMode__InputYawDelta   += yawDelta;
        Na__WalkMode__InputPitchDelta += pitchDelta;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Getters
// -----------------------------------------------------------------------------

    // FUNCTION | Clamp Entry Pitch After Activation
    // ------------------------------------------------------------
    // Called by the transition module immediately after Activate to
    // prevent the inherited orbit pitch from pointing the walk camera
    // at the floor or sky.  Clamps to +/- maxRad and updates the
    // camera quaternion so the very first rendered frame is correct.
    // ------------------------------------------------------------
    function Na__WalkMode__ClampEntryPitch(maxRad) {
        if (!Na__WalkMode__Active || !Na__WalkMode__Camera) return;

        Na__WalkMode__CameraPitch = Math.max(-maxRad, Math.min(maxRad, Na__WalkMode__CameraPitch));

        const euler = new THREE.Euler(Na__WalkMode__CameraPitch, Na__WalkMode__CameraYaw, 0, 'YXZ');
        Na__WalkMode__Camera.quaternion.setFromEuler(euler);
    }
    // ------------------------------------------------------------


    // FUNCTION | Nudge Capsule Forward After Activation
    // ------------------------------------------------------------
    // Pushes the capsule forward along the current yaw direction by
    // distanceUnits (Three.js world units).  Re-detects the ground at
    // the new position and updates the camera so the first rendered
    // frame reflects the nudged location.
    // ------------------------------------------------------------
    function Na__WalkMode__NudgeCapsuleForward(distanceUnits) {
        if (!Na__WalkMode__Active || !Na__WalkMode__Camera || distanceUnits <= 0) return;

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), Na__WalkMode__CameraYaw);

        Na__WalkMode__CapsulePosition.x += forward.x * distanceUnits;
        Na__WalkMode__CapsulePosition.z += forward.z * distanceUnits;

        const groundY = Na__WalkMode__DetectGroundHeight(
            Na__WalkMode__CapsulePosition.x,
            Na__WalkMode__CapsulePosition.z,
            Na__WalkMode__CapsulePosition.y
        );

        if (groundY !== null) {
            Na__WalkMode__CapsulePosition.y = groundY;
        }

        Na__WalkMode__UpdateCameraFromCapsule();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Saved Orbit State (Read-Only Copy)
    // ------------------------------------------------------------
    // Returns a snapshot of the orbit state captured at activation time
    // so the transition module can compute a repositioned orbit camera
    // without reaching into private module state.
    // ------------------------------------------------------------
    function Na__WalkMode__GetSavedOrbitState() {
        return {
            cameraPosition : Na__WalkMode__SavedOrbitState.cameraPosition.clone(),
            cameraFov      : Na__WalkMode__SavedOrbitState.cameraFov,
            orbitTarget    : Na__WalkMode__SavedOrbitState.orbitTarget.clone()
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Check If Walk Mode Is Active
    // ------------------------------------------------------------
    function Na__WalkMode__IsActive() {
        return Na__WalkMode__Active;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Current Capsule World Position
    // ------------------------------------------------------------
    function Na__WalkMode__GetCapsulePosition() {
        return Na__WalkMode__CapsulePosition.clone();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Walk Mode Config Values (for downstream modules)
    // ------------------------------------------------------------
    function Na__WalkMode__GetConfig() {
        return {
            eyeHeightMm              : Na__WalkMode__Config__EyeHeightMm,
            capsuleHeightMm          : Na__WalkMode__Config__CapsuleHeightMm,
            capsuleRadiusMm          : Na__WalkMode__Config__CapsuleRadiusMm,
            horizontalFovDeg         : Na__WalkMode__Config__HorizontalFovDeg,
            movementSpeedMmPerSec    : Na__WalkMode__Config__MovementSpeedMmPerSec,
            sprintMultiplier         : Na__WalkMode__Config__SprintMultiplier,
            maxStepHeightMm          : Na__WalkMode__Config__MaxStepHeightMm,
            mouseSensitivity         : Na__WalkMode__Config__MouseSensitivity,
            doorProximityThresholdMm : Na__WalkMode__Config__DoorProximityThresholdMm
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Walk Mode System Public API
    // ------------------------------------------------------------
    export {
        Na__WalkMode__Initialize,
        Na__WalkMode__SetCollisionMeshes,
        Na__WalkMode__Activate,
        Na__WalkMode__Deactivate,
        Na__WalkMode__Update,
        Na__WalkMode__IsActive,
        Na__WalkMode__GetCapsulePosition,
        Na__WalkMode__GetConfig,
        Na__WalkMode__SetMovementInput,
        Na__WalkMode__AccumulateLookInput,
        Na__WalkMode__ClampEntryPitch,
        Na__WalkMode__NudgeCapsuleForward,
        Na__WalkMode__GetSavedOrbitState
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

