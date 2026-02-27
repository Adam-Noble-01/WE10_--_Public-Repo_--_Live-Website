// =============================================================================
// TRUEVISION3D - CAMERA MODE TRANSITION LOGIC
// =============================================================================
//
// FILE       : Na__Navmode__ModeTransition.js
// NAMESPACE  : Na__ModeTransition
// MODULE     : Camera Mode Transition
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Smooth camera handoff between orbit and walk modes
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Handles the spatial continuity problem when switching camera modes.
// - Orbit-to-Walk: delegates to WalkMode__Activate then clamps the entry
//   pitch so the user does not stare at the floor after ground-snap.
// - Walk-to-Orbit: repositions the orbit camera on the side of the
//   OrbitHelperCube target closest to where the user walked, preserving
//   the original orbit distance and elevation.  The orbit target itself
//   (OrbitHelperCube) is NEVER modified.
//
// INTEGRATION:
// - Called by Na__UiFeature__WalkModeControls.js instead of calling
//   Na__WalkMode__Activate / Na__WalkMode__Deactivate directly.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Feb-2026 - Version 1.0.0
// - Initial implementation extracted per camera-mode-transition-fix plan.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Walk Mode System Logic
    // ------------------------------------------------------------
    import {
        Na__WalkMode__Activate,
        Na__WalkMode__Deactivate,
        Na__WalkMode__ClampEntryPitch,
        Na__WalkMode__NudgeCapsuleForward,
        Na__WalkMode__GetSavedOrbitState
    } from './Na__Navmode__WalkMode__SystemLogic.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Orbit to Walk Transition
// -----------------------------------------------------------------------------

    // FUNCTION | Transition from Orbit Mode to Walk Mode
    // ------------------------------------------------------------
    function Na__ModeTransition__OrbitToWalk(orbitControls, maxEntryPitchDeg, entryForwardNudgeMm) {
        const activated = Na__WalkMode__Activate(orbitControls);

        if (activated && Number.isFinite(maxEntryPitchDeg)) {
            const maxEntryPitchRad = maxEntryPitchDeg * (Math.PI / 180);
            Na__WalkMode__ClampEntryPitch(maxEntryPitchRad);
        }

        if (activated && Number.isFinite(entryForwardNudgeMm) && entryForwardNudgeMm > 0) {
            Na__WalkMode__NudgeCapsuleForward(Na__Math__ConvertMmToUnits(entryForwardNudgeMm));
        }

        return activated;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Walk to Orbit Transition
// -----------------------------------------------------------------------------

    // FUNCTION | Transition from Walk Mode to Orbit Mode
    // ------------------------------------------------------------
    function Na__ModeTransition__WalkToOrbit(camera, orbitControls) {
        const savedState = Na__WalkMode__GetSavedOrbitState();
        if (!savedState) {
            return Na__WalkMode__Deactivate(orbitControls);
        }

        const savedTarget    = savedState.orbitTarget;
        const savedCamPos    = savedState.cameraPosition;
        const savedDistance  = savedCamPos.distanceTo(savedTarget);
        const savedElevation = savedCamPos.y - savedTarget.y;

        const walkPos = camera.position.clone();

        const dirToWalk = new THREE.Vector3(
            walkPos.x - savedTarget.x,
            0,
            walkPos.z - savedTarget.z
        );

        if (dirToWalk.lengthSq() > 0.001) {
            dirToWalk.normalize();
        } else {
            dirToWalk.set(
                savedCamPos.x - savedTarget.x,
                0,
                savedCamPos.z - savedTarget.z
            ).normalize();
        }

        const elevationSq    = savedElevation * savedElevation;
        const distanceSq     = savedDistance * savedDistance;
        const horizontalDist = distanceSq > elevationSq
            ? Math.sqrt(distanceSq - elevationSq)
            : savedDistance;

        const overridePosition = new THREE.Vector3(
            savedTarget.x + dirToWalk.x * horizontalDist,
            savedTarget.y + savedElevation,
            savedTarget.z + dirToWalk.z * horizontalDist
        );

        return Na__WalkMode__Deactivate(orbitControls, overridePosition);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Mode Transition API
    // ------------------------------------------------------------
    export {
        Na__ModeTransition__OrbitToWalk,
        Na__ModeTransition__WalkToOrbit
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
