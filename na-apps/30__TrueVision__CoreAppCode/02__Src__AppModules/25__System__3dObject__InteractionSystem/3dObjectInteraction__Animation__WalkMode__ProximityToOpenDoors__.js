// =============================================================================
// TRUEVISION3D - WALK MODE PROXIMITY DOOR ANIMATION TRIGGER
// =============================================================================
//
// FILE       : 3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object Interactions - Door Animation (Proximity Trigger)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Trigger door open/close animations based on walk mode capsule proximity
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - When walk mode is active, doors automatically open as the player approaches.
// - Uses the same door registry and animation system as the click-to-open doors.
// - Checks distance between the walk mode capsule position and each door assembly.
// - Opens doors when within the configured proximity threshold (default 2000mm).
// - Closes doors when the player moves beyond the proximity threshold.
// - Designed for fluid architectural walkthroughs with naturally opening doors.
//
// INTEGRATION:
// - Requires the click-to-open door system to be initialized first (door registry).
// - Call Na__DoorProximity__Initialize() after walk mode and door systems are ready.
// - Call Na__DoorProximity__Update() every frame in the render loop.
// - Enable/disable with Na__DoorProximity__SetEnabled() tied to walk mode state.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-May-2026 - Version 1.1.0
// - Multi-panel door compatibility verified.
// - Now activates correctly for bifold (BifoldDoor) and sliding (SlidingDoor)
//   ADR assemblies because the underlying door registry exposes the same
//   `rotObjectMesh` (first ROT### marker) and `state` machine for every door
//   type. ToggleDoor cascades the unified 0..1 progress animation across all
//   MOD panels of the assembly automatically - no proximity-side change required.
//
// 23-Feb-2026 - Version 1.0.0
// - Initial implementation of proximity-based door animation trigger.
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
    import {
        Na__DoorAnim__DoorRegistry,
        Na__DoorAnim__ToggleDoor
    } from './3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Door State References (Must Match Click-to-Open Module)
    // ------------------------------------------------------------
    const Na__DoorProximity__STATE_CLOSED                  = 'CLOSED';   // <-- Door is fully closed
    const Na__DoorProximity__STATE_OPEN                    = 'OPEN';     // <-- Door is fully open
    const Na__DoorProximity__STATE_OPENING                 = 'OPENING';  // <-- Door is animating open
    const Na__DoorProximity__STATE_CLOSING                 = 'CLOSING';  // <-- Door is animating closed
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Proximity System State
    // ------------------------------------------------------------
    let Na__DoorProximity__Enabled                         = false;      // <-- Proximity trigger enabled (tied to walk mode)
    let Na__DoorProximity__Initialized                     = false;      // <-- Module initialization flag
    let Na__DoorProximity__ThresholdUnits                  = 2.0;        // <-- Proximity threshold in Three.js units (default 2000mm)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Reusable Vectors (Avoid Per-Frame Allocation)
    // ------------------------------------------------------------
    const Na__DoorProximity__TempDoorWorldPos              = new THREE.Vector3();  // <-- Reusable door world position
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Proximity Door Trigger System
    // ------------------------------------------------------------
    function Na__DoorProximity__Initialize(proximityThresholdMm) {
        if (Number.isFinite(proximityThresholdMm) && proximityThresholdMm > 0) {
            Na__DoorProximity__ThresholdUnits = Na__Math__ConvertMmToUnits(proximityThresholdMm);
        }

        Na__DoorProximity__Initialized = true;
        console.log(`[DoorProximity] Proximity door trigger initialized (threshold: ${proximityThresholdMm}mm / ${Na__DoorProximity__ThresholdUnits.toFixed(3)} units)`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Enable / Disable
// -----------------------------------------------------------------------------

    // FUNCTION | Set Proximity Trigger Enabled State
    // ------------------------------------------------------------
    function Na__DoorProximity__SetEnabled(enabled) {
        Na__DoorProximity__Enabled = enabled;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per-Frame Proximity Check
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get Door Assembly World Position
    // ------------------------------------------------------------
    function Na__DoorProximity__GetDoorWorldPosition(doorRecord) {
        if (doorRecord.rotObjectMesh) {
            doorRecord.rotObjectMesh.getWorldPosition(Na__DoorProximity__TempDoorWorldPos);
            return Na__DoorProximity__TempDoorWorldPos;
        }

        if (doorRecord.adrObjectMesh) {
            doorRecord.adrObjectMesh.getWorldPosition(Na__DoorProximity__TempDoorWorldPos);
            return Na__DoorProximity__TempDoorWorldPos;
        }

        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Proximity Check for All Doors (Called Every Frame)
    // ------------------------------------------------------------
    function Na__DoorProximity__Update(capsulePositionUnits) {
        if (!Na__DoorProximity__Initialized) return;
        if (!Na__DoorProximity__Enabled) return;
        if (!capsulePositionUnits) return;
        if (!Na__DoorAnim__DoorRegistry || Na__DoorAnim__DoorRegistry.size === 0) return;

        const threshold = Na__DoorProximity__ThresholdUnits;

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            const doorWorldPos = Na__DoorProximity__GetDoorWorldPosition(doorRecord);
            if (!doorWorldPos) return;

            const dx       = capsulePositionUnits.x - doorWorldPos.x;
            const dz       = capsulePositionUnits.z - doorWorldPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < threshold) {
                if (doorRecord.state === Na__DoorProximity__STATE_CLOSED) {
                    Na__DoorAnim__ToggleDoor(doorRecord);
                } else if (doorRecord.state === Na__DoorProximity__STATE_CLOSING) {
                    Na__DoorAnim__ToggleDoor(doorRecord);
                }
            } else {
                if (doorRecord.state === Na__DoorProximity__STATE_OPEN) {
                    Na__DoorAnim__ToggleDoor(doorRecord);
                } else if (doorRecord.state === Na__DoorProximity__STATE_OPENING) {
                    Na__DoorAnim__ToggleDoor(doorRecord);
                }
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Proximity Door Trigger Public API
    // ------------------------------------------------------------
    export {
        Na__DoorProximity__Initialize,
        Na__DoorProximity__SetEnabled,
        Na__DoorProximity__Update
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

