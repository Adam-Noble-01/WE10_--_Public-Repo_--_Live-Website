// =============================================================================
// TRUEVISION3D - CLICK TO OPEN DOORS ANIMATION
// =============================================================================
//
// FILE       : 3dObjectIInteraction__Animation__ClickToOpenDoors__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object Interactions - Door Animation (Click to Open/Close)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Animate doors open/closed on click via scene graph naming convention
// CREATED    : 14-Feb-2026
//
// DESCRIPTION:
// - Scans the loaded GLB scene graph for door assemblies (ADR prefix).
// - Parses MOD modifier objects to extract rotation angle and door panel group.
// - Locates ROT rotation point objects to determine hinge pivot positions.
// - Registers pointer event handlers for click detection (with orbit drag filtering).
// - Smoothly animates door panels open/closed around the hinge pivot on Y axis.
// - Supports mid-animation reversal and independent per-door state management.
// - Dual model support: animates both mesh and linework models simultaneously.
//
// NAMING CONVENTION (Scene Graph):
// - ADR = Door Assembly (e.g. ADR002__InternalDoor__GroundFloor__PorchToLounge)
// - MOD = Modifier with __ROT__ tag (e.g. MOD001__ROT__90-Deg__DoorPanel)
// - ROT = Rotation/Hinge Point (e.g. ROT001__RotationPoint__DoorHingeCentre)
//
// INTEGRATION:
// - Requires door models exported with hierarchy preservation from SketchUp
//   GLB Builder Utility (v1.5.0+) with door handler module.
// - Expects glTF nodes in Y-up coordinate space with conjugated transforms.
// - Call Na__DoorAnimation__Initialize() after GLB models are loaded.
// - Call Na__DoorAnimation__Update(deltaMs) every frame in render loop.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 28-Feb-2026 - Version 1.1.0
// - Added Na__DoorAnimation__RebindModelGroups() for safe model-group switching.
// - Door registry now refreshes against newly loaded model roots without
//   duplicating pointer listeners.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Imports
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Naming Convention Prefixes
    // ------------------------------------------------------------
    const Na__DoorAnim__PREFIX_ADR             = 'ADR';                          // <-- Door assembly prefix
    const Na__DoorAnim__PREFIX_MOD             = 'MOD';                          // <-- Modifier object prefix
    const Na__DoorAnim__PREFIX_ROT             = 'ROT';                          // <-- Rotation point prefix
    const Na__DoorAnim__MOD_ROT_TAG            = '__ROT__';                      // <-- Rotation modifier tag in MOD name
    const Na__DoorAnim__DEG_REGEX              = /(-?\d+)-Deg/i;                  // <-- Regex to extract degrees from MOD name (supports negative)
    const Na__DoorAnim__Y_AXIS                 = new THREE.Vector3(0, 1, 0);     // <-- Vertical rotation axis (Y-up from GLB Builder export)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Door State Enum
    // ------------------------------------------------------------
    const Na__DoorAnim__STATE_CLOSED           = 'CLOSED';                       // <-- Door is fully closed
    const Na__DoorAnim__STATE_OPENING          = 'OPENING';                      // <-- Door is animating open
    const Na__DoorAnim__STATE_OPEN             = 'OPEN';                         // <-- Door is fully open
    const Na__DoorAnim__STATE_CLOSING          = 'CLOSING';                      // <-- Door is animating closed
    // ------------------------------------------------------------


    // MODULE VARIABLES | Configuration Defaults (overridden by config)
    // ------------------------------------------------------------
    let Na__DoorAnim__Config__AnimationDurationMs  = 600;                        // <-- Default animation duration
    let Na__DoorAnim__Config__DefaultRotationDeg   = 90;                         // <-- Default rotation if parse fails
    let Na__DoorAnim__Config__ClickThresholdPx     = 4;                          // <-- Max pointer movement for click
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core References
    // ------------------------------------------------------------
    let Na__DoorAnim__Scene               = null;                                // <-- Three.js scene reference
    let Na__DoorAnim__Camera              = null;                                // <-- Three.js camera reference
    let Na__DoorAnim__RendererDomElement  = null;                                // <-- Renderer canvas DOM element
    let Na__DoorAnim__ModelGroupsMesh     = [];                                  // <-- Array of mesh model groups (solid geometry)
    let Na__DoorAnim__ModelGroupsLinework = [];                                  // <-- Array of linework model groups (edges)
    let Na__DoorAnim__Initialized         = false;                               // <-- Module initialization flag
    // ------------------------------------------------------------


    // MODULE VARIABLES | Raycaster and Pointer State
    // ------------------------------------------------------------
    const Na__DoorAnim__Raycaster        = new THREE.Raycaster();                // <-- Reusable raycaster
    const Na__DoorAnim__PointerNDC       = new THREE.Vector2();                  // <-- Normalized device coordinates
    let Na__DoorAnim__PointerDownX       = 0;                                    // <-- Pointer X at pointerdown
    let Na__DoorAnim__PointerDownY       = 0;                                    // <-- Pointer Y at pointerdown
    let Na__DoorAnim__PointerIsDown      = false;                                // <-- Pointer currently pressed
    // ------------------------------------------------------------


    // MODULE VARIABLES | Door Registry
    // ------------------------------------------------------------
    const Na__DoorAnim__DoorRegistry     = new Map();                            // <-- Map<adrName, doorRecord>
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Graph Scanning and Name Parsing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Parse Rotation Degrees from MOD Object Name
    // ------------------------------------------------------------
    function Na__DoorAnim__ParseDegreesFromName(modName) {
        const match = Na__DoorAnim__DEG_REGEX.exec(modName);                     // <-- Match XX-Deg pattern

        if (match && match[1]) {
            const degrees = parseInt(match[1], 10);                              // <-- Parse integer degrees
            if (Number.isFinite(degrees) && degrees !== 0) {
                return degrees;                                                  // <-- Return parsed value (positive or negative)
            }
        }

        console.warn(`[DoorAnimation] Could not parse degrees from MOD name: "${modName}", using default ${Na__DoorAnim__Config__DefaultRotationDeg}`);
        return Na__DoorAnim__Config__DefaultRotationDeg;                         // <-- Fallback to config default
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check if Object Name Starts with Prefix
    // ------------------------------------------------------------
    function Na__DoorAnim__NameStartsWith(object, prefix) {
        return object.name && object.name.startsWith(prefix);                    // <-- Simple prefix check
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find Child Object by Name Prefix
    // ------------------------------------------------------------
    function Na__DoorAnim__FindChildByPrefix(parentObject, prefix) {
        for (const child of parentObject.children) {
            if (Na__DoorAnim__NameStartsWith(child, prefix)) {
                return child;                                                    // <-- Return first match
            }
        }
        return null;                                                             // <-- No match found
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find MOD Child with ROT Tag in Name
    // ------------------------------------------------------------
    function Na__DoorAnim__FindModRotChild(adrObject) {
        for (const child of adrObject.children) {
            if (Na__DoorAnim__NameStartsWith(child, Na__DoorAnim__PREFIX_MOD)
                && child.name.includes(Na__DoorAnim__MOD_ROT_TAG)) {
                return child;                                                    // <-- Return MOD with __ROT__ tag
            }
        }
        return null;                                                             // <-- No MOD__ROT__ child found
    }
    // ------------------------------------------------------------


    // FUNCTION | Scan Scene Graph and Build Door Registry
    // ------------------------------------------------------------
    function Na__DoorAnimation__ScanForDoors() {
        Na__DoorAnim__DoorRegistry.clear();                                      // <-- Clear previous registry

        if (Na__DoorAnim__ModelGroupsMesh.length === 0 && Na__DoorAnim__ModelGroupsLinework.length === 0) {
            console.warn('[DoorAnimation] No model groups set, cannot scan for doors');
            return;
        }

        // Scan all mesh model groups for ADR assemblies
        for (const meshGroup of Na__DoorAnim__ModelGroupsMesh) {
            meshGroup.traverse((object) => {
                if (!Na__DoorAnim__NameStartsWith(object, Na__DoorAnim__PREFIX_ADR)) {
                    return;                                                      // <-- Skip non-ADR objects
                }

                const adrName = object.name;                                     // <-- Door assembly identifier

                // Find the MOD child (rotation modifier with door panel meshes)
                const modObject = Na__DoorAnim__FindModRotChild(object);
                if (!modObject) {
                    console.warn(`[DoorAnimation] ADR "${adrName}" (mesh) has no MOD__ROT__ child, skipping`);
                    return;
                }

                // Find the ROT child (hinge pivot point)
                const rotObject = Na__DoorAnim__FindChildByPrefix(object, Na__DoorAnim__PREFIX_ROT);
                if (!rotObject) {
                    console.warn(`[DoorAnimation] ADR "${adrName}" (mesh) has no ROT child, skipping`);
                    return;
                }

                // Parse target rotation degrees from MOD name
                const targetAngleDeg = Na__DoorAnim__ParseDegreesFromName(modObject.name);
                const targetAngleRad = THREE.MathUtils.degToRad(targetAngleDeg); // <-- Convert to radians

                // Capture the MOD initial local transform (position + quaternion)
                const initialPosition   = modObject.position.clone();            // <-- Store initial position
                const initialQuaternion = modObject.quaternion.clone();          // <-- Store initial quaternion

                // Get the hinge pivot position in ADR-local space (ROT local position)
                const pivotLocalPosition = rotObject.position.clone();           // <-- Hinge point in parent space

                // Build door record
                const doorRecord = {
                    adrObjectMesh      : object,                                 // <-- Door assembly Object3D (mesh)
                    adrObjectLinework  : null,                                   // <-- Door assembly Object3D (linework) - found later
                    adrName            : adrName,                                // <-- Door assembly name
                    modObjectMesh      : modObject,                              // <-- Modifier (door panel group - mesh)
                    modObjectLinework  : null,                                   // <-- Modifier (door panel group - linework) - found later
                    rotObjectMesh      : rotObject,                              // <-- Rotation point (hinge - mesh)
                    rotObjectLinework  : null,                                   // <-- Rotation point (hinge - linework) - found later
                    targetAngleRad     : targetAngleRad,                         // <-- Target open angle (radians)
                    initialPosition    : initialPosition,                        // <-- MOD initial local position
                    initialQuaternion  : initialQuaternion,                      // <-- MOD initial local quaternion
                    pivotLocalPosition : pivotLocalPosition,                     // <-- Hinge point in ADR-local space
                    state              : Na__DoorAnim__STATE_CLOSED,             // <-- Current door state
                    currentAngleRad    : 0,                                      // <-- Current rotation angle (radians)
                    animStartAngleRad  : 0,                                      // <-- Angle at animation start
                    animEndAngleRad    : 0,                                      // <-- Target angle for current anim
                    animElapsedMs      : 0,                                      // <-- Elapsed animation time
                    animDurationMs     : Na__DoorAnim__Config__AnimationDurationMs // <-- Animation duration
                };

                Na__DoorAnim__DoorRegistry.set(adrName, doorRecord);             // <-- Register door
                console.log(`[DoorAnimation] Registered door (mesh): "${adrName}" (${targetAngleDeg} deg)`);
            });
        }

        // Scan all linework model groups and link to existing door records
        for (const lineworkGroup of Na__DoorAnim__ModelGroupsLinework) {
            lineworkGroup.traverse((object) => {
                if (!Na__DoorAnim__NameStartsWith(object, Na__DoorAnim__PREFIX_ADR)) {
                    return;                                                      // <-- Skip non-ADR objects
                }

                const adrName = object.name;                                     // <-- Door assembly identifier
                const doorRecord = Na__DoorAnim__DoorRegistry.get(adrName);      // <-- Look up existing record

                if (!doorRecord) {
                    console.warn(`[DoorAnimation] Linework door "${adrName}" has no mesh counterpart, skipping`);
                    return;
                }

                // Find the MOD child (linework version)
                const modObjectLinework = Na__DoorAnim__FindModRotChild(object);
                if (!modObjectLinework) {
                    console.warn(`[DoorAnimation] ADR "${adrName}" (linework) has no MOD__ROT__ child`);
                    return;
                }

                // Find the ROT child (linework version)
                const rotObjectLinework = Na__DoorAnim__FindChildByPrefix(object, Na__DoorAnim__PREFIX_ROT);

                // Link linework objects to existing door record
                doorRecord.adrObjectLinework = object;                           // <-- Linework ADR
                doorRecord.modObjectLinework = modObjectLinework;                // <-- Linework MOD
                doorRecord.rotObjectLinework = rotObjectLinework;                // <-- Linework ROT (may be null)

                console.log(`[DoorAnimation] Linked linework for door: "${adrName}"`);
            });
        }

        console.log(`[DoorAnimation] Scan complete. ${Na__DoorAnim__DoorRegistry.size} door(s) found.`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Raycaster Click Detection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Walk Up Scene Graph to Find ADR Ancestor
    // ------------------------------------------------------------
    function Na__DoorAnim__FindAdrAncestor(object) {
        let current = object;                                                    // <-- Start from clicked mesh

        while (current) {
            if (Na__DoorAnim__NameStartsWith(current, Na__DoorAnim__PREFIX_ADR)) {
                return current;                                                  // <-- Found ADR ancestor
            }
            current = current.parent;                                            // <-- Walk up the tree
        }

        return null;                                                             // <-- No ADR ancestor found
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect All Meshes from Both Mesh and Linework Door Models
    // ------------------------------------------------------------
    function Na__DoorAnim__CollectDoorMeshes() {
        const meshes = [];                                                       // <-- Array of intersectable meshes

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            // Collect meshes from mesh version (solid geometry)
            if (doorRecord.modObjectMesh) {
                doorRecord.modObjectMesh.traverse((child) => {
                    if (child.isMesh) {
                        meshes.push(child);                                      // <-- Add mesh to list
                    }
                });
            }

            // Collect meshes from linework version (edge LINES primitives)
            if (doorRecord.modObjectLinework) {
                doorRecord.modObjectLinework.traverse((child) => {
                    if (child.isMesh) {
                        meshes.push(child);                                      // <-- Add linework mesh to list
                    }
                });
            }
        });

        return meshes;                                                           // <-- Return all door meshes
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Pointer Down Event
    // ------------------------------------------------------------
    function Na__DoorAnim__OnPointerDown(event) {
        Na__DoorAnim__PointerDownX = event.clientX;                              // <-- Record pointer X
        Na__DoorAnim__PointerDownY = event.clientY;                              // <-- Record pointer Y
        Na__DoorAnim__PointerIsDown = true;                                      // <-- Mark pointer as pressed
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Pointer Up Event (Click Detection)
    // ------------------------------------------------------------
    function Na__DoorAnim__OnPointerUp(event) {
        if (!Na__DoorAnim__PointerIsDown) return;                                // <-- Ignore if no prior pointerdown
        Na__DoorAnim__PointerIsDown = false;                                     // <-- Reset pointer state

        // Check pointer movement to distinguish click from orbit drag
        const deltaX = Math.abs(event.clientX - Na__DoorAnim__PointerDownX);    // <-- Horizontal movement
        const deltaY = Math.abs(event.clientY - Na__DoorAnim__PointerDownY);    // <-- Vertical movement

        if (deltaX > Na__DoorAnim__Config__ClickThresholdPx ||
            deltaY > Na__DoorAnim__Config__ClickThresholdPx) {
            return;                                                              // <-- Too much movement, not a click
        }

        // Calculate NDC from pointer position
        const rect = Na__DoorAnim__RendererDomElement.getBoundingClientRect();   // <-- Canvas bounds
        Na__DoorAnim__PointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;   // <-- NDC X [-1, 1]
        Na__DoorAnim__PointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;  // <-- NDC Y [-1, 1]

        // Perform raycast against door meshes
        Na__DoorAnim__Raycaster.setFromCamera(Na__DoorAnim__PointerNDC, Na__DoorAnim__Camera);

        const doorMeshes = Na__DoorAnim__CollectDoorMeshes();                    // <-- Get all door meshes
        if (doorMeshes.length === 0) return;                                     // <-- No doors to check

        const intersections = Na__DoorAnim__Raycaster.intersectObjects(doorMeshes, false);

        if (intersections.length === 0) return;                                  // <-- No intersection

        // Walk up from the hit mesh to find the ADR ancestor
        const hitObject = intersections[0].object;                               // <-- First intersection
        const adrObject = Na__DoorAnim__FindAdrAncestor(hitObject);

        if (!adrObject) return;                                                  // <-- Not part of a registered door

        // Look up door record and toggle
        const doorRecord = Na__DoorAnim__DoorRegistry.get(adrObject.name);
        if (!doorRecord) return;                                                 // <-- Not in registry

        Na__DoorAnim__ToggleDoor(doorRecord);                                    // <-- Toggle open/close
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Animation Engine
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ease In-Out Cubic
    // ------------------------------------------------------------
    function Na__DoorAnim__EaseInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t                                                     // <-- Ease in (accelerate)
            : 1 - Math.pow(-2 * t + 2, 3) / 2;                                 // <-- Ease out (decelerate)
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Door Open or Closed
    // ------------------------------------------------------------
    function Na__DoorAnim__ToggleDoor(doorRecord) {
        const isCurrentlyClosed = (doorRecord.state === Na__DoorAnim__STATE_CLOSED);
        const isCurrentlyOpen   = (doorRecord.state === Na__DoorAnim__STATE_OPEN);
        const isAnimating       = (doorRecord.state === Na__DoorAnim__STATE_OPENING
                                || doorRecord.state === Na__DoorAnim__STATE_CLOSING);

        if (isCurrentlyClosed) {
            // Start opening from closed
            doorRecord.animStartAngleRad = 0;                                    // <-- Start from closed
            doorRecord.animEndAngleRad   = doorRecord.targetAngleRad;            // <-- Animate to open
            doorRecord.animElapsedMs     = 0;                                    // <-- Reset timer
            doorRecord.state             = Na__DoorAnim__STATE_OPENING;          // <-- Set state
            console.log(`[DoorAnimation] Opening: "${doorRecord.adrName}"`);

        } else if (isCurrentlyOpen) {
            // Start closing from open
            doorRecord.animStartAngleRad = doorRecord.targetAngleRad;            // <-- Start from open
            doorRecord.animEndAngleRad   = 0;                                    // <-- Animate to closed
            doorRecord.animElapsedMs     = 0;                                    // <-- Reset timer
            doorRecord.state             = Na__DoorAnim__STATE_CLOSING;          // <-- Set state
            console.log(`[DoorAnimation] Closing: "${doorRecord.adrName}"`);

        } else if (isAnimating) {
            // Mid-animation reversal: reverse from current angle
            const currentAngle = doorRecord.currentAngleRad;                     // <-- Capture current position

            if (doorRecord.state === Na__DoorAnim__STATE_OPENING) {
                // Was opening, now close from current position
                doorRecord.animStartAngleRad = currentAngle;                     // <-- Start from current
                doorRecord.animEndAngleRad   = 0;                                // <-- Animate to closed
                doorRecord.state             = Na__DoorAnim__STATE_CLOSING;      // <-- Set state

            } else {
                // Was closing, now open from current position
                doorRecord.animStartAngleRad = currentAngle;                     // <-- Start from current
                doorRecord.animEndAngleRad   = doorRecord.targetAngleRad;        // <-- Animate to open
                doorRecord.state             = Na__DoorAnim__STATE_OPENING;      // <-- Set state
            }

            // Scale duration proportional to remaining travel
            const totalTravel    = Math.abs(doorRecord.targetAngleRad);          // <-- Full rotation range
            const remainingTravel = Math.abs(doorRecord.animEndAngleRad - doorRecord.animStartAngleRad);
            const durationScale  = totalTravel > 0 ? (remainingTravel / totalTravel) : 1;
            doorRecord.animDurationMs = Na__DoorAnim__Config__AnimationDurationMs * durationScale;
            doorRecord.animElapsedMs  = 0;                                       // <-- Reset timer

            console.log(`[DoorAnimation] Reversed mid-animation: "${doorRecord.adrName}"`);

        }

        Na__RenderLoop__RequestRender();                                          // <-- Wake render loop so door animation can begin
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Rotation Around Pivot to MOD Objects (Mesh + Linework)
    // ------------------------------------------------------------
    function Na__DoorAnim__ApplyPivotRotation(doorRecord, angleRad) {
        const pivot = doorRecord.pivotLocalPosition;                             // <-- Hinge point (local)

        // Build rotation quaternion around Y axis (shared by mesh and linework)
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(
            Na__DoorAnim__Y_AXIS, angleRad                                       // <-- Rotation amount
        );

        // Apply to MESH version (if exists)
        if (doorRecord.modObjectMesh) {
            const modMesh = doorRecord.modObjectMesh;                            // <-- Mesh door panel group

            // Reset to initial transform
            modMesh.position.copy(doorRecord.initialPosition);                   // <-- Restore initial position
            modMesh.quaternion.copy(doorRecord.initialQuaternion);               // <-- Restore initial quaternion

            // Translate so pivot is at origin, rotate, translate back
            modMesh.position.sub(pivot);                                         // <-- Move pivot to origin
            modMesh.position.applyQuaternion(rotQuat);                           // <-- Rotate position vector
            modMesh.position.add(pivot);                                         // <-- Move back

            // Apply rotation to orientation
            modMesh.quaternion.premultiply(rotQuat);                             // <-- Combine rotations
        }

        // Apply to LINEWORK version (if exists)
        if (doorRecord.modObjectLinework) {
            const modLinework = doorRecord.modObjectLinework;                    // <-- Linework door panel group

            // Linework uses same initial transform as mesh
            modLinework.position.copy(doorRecord.initialPosition);               // <-- Restore initial position
            modLinework.quaternion.copy(doorRecord.initialQuaternion);           // <-- Restore initial quaternion

            // Translate so pivot is at origin, rotate, translate back
            modLinework.position.sub(pivot);                                     // <-- Move pivot to origin
            modLinework.position.applyQuaternion(rotQuat);                       // <-- Rotate position vector
            modLinework.position.add(pivot);                                     // <-- Move back

            // Apply rotation to orientation
            modLinework.quaternion.premultiply(rotQuat);                         // <-- Combine rotations
        }

        // Store current angle
        doorRecord.currentAngleRad = angleRad;                                   // <-- Track current angle
    }
    // ------------------------------------------------------------


    // FUNCTION | Update All Door Animations (called per frame)
    // ------------------------------------------------------------
    function Na__DoorAnimation__Update(deltaMs) {
        if (!Na__DoorAnim__Initialized) return;                                  // <-- Skip if not initialized
        if (Na__DoorAnim__DoorRegistry.size === 0) return;                       // <-- No doors to animate

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            // Only process doors that are actively animating
            if (doorRecord.state !== Na__DoorAnim__STATE_OPENING
                && doorRecord.state !== Na__DoorAnim__STATE_CLOSING) {
                return;                                                          // <-- Skip idle doors
            }

            // Advance animation timer
            doorRecord.animElapsedMs += deltaMs;                                 // <-- Accumulate elapsed time

            // Calculate normalized progress [0, 1]
            const rawT = Math.min(doorRecord.animElapsedMs / doorRecord.animDurationMs, 1.0);
            const easedT = Na__DoorAnim__EaseInOutCubic(rawT);                   // <-- Apply easing

            // Interpolate angle
            const startAngle = doorRecord.animStartAngleRad;                     // <-- Animation start angle
            const endAngle   = doorRecord.animEndAngleRad;                       // <-- Animation end angle
            const currentAngle = startAngle + (endAngle - startAngle) * easedT;  // <-- Lerp

            // Apply rotation to MOD object
            Na__DoorAnim__ApplyPivotRotation(doorRecord, currentAngle);          // <-- Transform door panel

            // Check if animation is complete
            if (rawT >= 1.0) {
                if (doorRecord.state === Na__DoorAnim__STATE_OPENING) {
                    doorRecord.state = Na__DoorAnim__STATE_OPEN;                 // <-- Fully open
                    doorRecord.animDurationMs = Na__DoorAnim__Config__AnimationDurationMs;
                    console.log(`[DoorAnimation] Opened: "${doorRecord.adrName}"`);

                } else if (doorRecord.state === Na__DoorAnim__STATE_CLOSING) {
                    doorRecord.state = Na__DoorAnim__STATE_CLOSED;               // <-- Fully closed
                    doorRecord.animDurationMs = Na__DoorAnim__Config__AnimationDurationMs;
                    console.log(`[DoorAnimation] Closed: "${doorRecord.adrName}"`);
                }
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Whether Any Door Is Currently Animating
    // ------------------------------------------------------------
    function Na__DoorAnimation__HasActiveAnimations() {
        let hasActiveAnimations = false;

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            if (doorRecord.state === Na__DoorAnim__STATE_OPENING || doorRecord.state === Na__DoorAnim__STATE_CLOSING) {
                hasActiveAnimations = true;
            }
        });

        return hasActiveAnimations;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Door Animation System
    // ------------------------------------------------------------
    // Accepts arrays of model groups for multi-storey support.
    // Backward-compatible: a single Group passed for meshGroups or lineworkGroups
    // is automatically wrapped in an array.
    // ------------------------------------------------------------
    function Na__DoorAnimation__Initialize(scene, camera, rendererDomElement, meshGroups, lineworkGroups, config) {
        if (Na__DoorAnim__Initialized) {
            console.warn('[DoorAnimation] Already initialized, skipping');
            return;
        }

        // Store references
        Na__DoorAnim__Scene               = scene;                               // <-- Scene reference
        Na__DoorAnim__Camera              = camera;                              // <-- Camera reference
        Na__DoorAnim__RendererDomElement  = rendererDomElement;                  // <-- Canvas DOM element

        // Normalize inputs: wrap single groups in arrays for backward compatibility
        Na__DoorAnim__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
        Na__DoorAnim__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups  : (lineworkGroups ? [lineworkGroups] : []);

        // Apply config overrides
        if (config) {
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__AnimationDurationMs'])) {
                Na__DoorAnim__Config__AnimationDurationMs = config['3dObject__Interaction__DoorAnimation__AnimationDurationMs'];
            }
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__DefaultRotationDeg'])) {
                Na__DoorAnim__Config__DefaultRotationDeg = config['3dObject__Interaction__DoorAnimation__DefaultRotationDeg'];
            }
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__ClickThresholdPx'])) {
                Na__DoorAnim__Config__ClickThresholdPx = config['3dObject__Interaction__DoorAnimation__ClickThresholdPx'];
            }
        }

        // Scan scene graph for door assemblies (both mesh and linework)
        Na__DoorAnimation__ScanForDoors();                                       // <-- Build door registry

        // Register pointer event handlers for click detection
        rendererDomElement.addEventListener('pointerdown', Na__DoorAnim__OnPointerDown);  // <-- Pointer down
        rendererDomElement.addEventListener('pointerup',   Na__DoorAnim__OnPointerUp);    // <-- Pointer up

        Na__DoorAnim__Initialized = true;                                        // <-- Mark as initialized
        Na__RenderLoop__RequestRender();                                         // <-- Ensure first door-ready frame is shown
        console.log('[DoorAnimation] Door animation system initialized');
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebind Door Model Groups After Scene Reload
    // ------------------------------------------------------------
    function Na__DoorAnimation__RebindModelGroups(meshGroups, lineworkGroups) {
        if (!Na__DoorAnim__Initialized) {
            console.warn('[DoorAnimation] Cannot rebind before initialization');
            return false;
        }

        Na__DoorAnim__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
        Na__DoorAnim__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups : (lineworkGroups ? [lineworkGroups] : []);

        Na__DoorAnimation__ScanForDoors();
        Na__RenderLoop__RequestRender();                                         // <-- Redraw after swapping model groups
        console.log(`[DoorAnimation] Rebound model groups (${Na__DoorAnim__ModelGroupsMesh.length} mesh, ${Na__DoorAnim__ModelGroupsLinework.length} linework)`);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Door Animation Public API
    // ------------------------------------------------------------
    export {
        Na__DoorAnimation__Initialize,                                           // <-- Initialize system
        Na__DoorAnimation__RebindModelGroups,                                    // <-- Rebind loaded model groups after group switch
        Na__DoorAnimation__Update,                                               // <-- Per-frame update
        Na__DoorAnimation__HasActiveAnimations,                                  // <-- True while any door animation is running
        Na__DoorAnimation__ScanForDoors,                                         // <-- Re-scan scene graph
        Na__DoorAnim__DoorRegistry,                                              // <-- Door registry Map (for proximity system)
        Na__DoorAnim__ToggleDoor                                                 // <-- Toggle door open/close (for proximity system)
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

