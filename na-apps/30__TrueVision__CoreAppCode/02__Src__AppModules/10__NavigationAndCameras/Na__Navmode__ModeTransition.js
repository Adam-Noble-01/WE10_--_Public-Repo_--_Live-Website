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

    // MODULE IMPORTS | Fly Mode System Logic
    // ------------------------------------------------------------
    import {
        Na__FlyMode__Activate,
        Na__FlyMode__Deactivate,
        Na__FlyMode__GetSavedOrbitState
    } from './Na__Navmode__FlyMode__SystemLogic.js';
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
// REGION | Orbit to Fly Transition
// -----------------------------------------------------------------------------

    // FUNCTION | Transition from Orbit Mode to Fly Mode
    // ------------------------------------------------------------
    // Fly mode does not need a pitch clamp or forward nudge because there is
    // no ground snap to recover from - the camera simply keeps its current
    // orientation and starts free-flying.  The activation flow is therefore
    // a straight pass-through to the SystemLogic.
    // ------------------------------------------------------------
    function Na__ModeTransition__OrbitToFly(orbitControls) {
        return Na__FlyMode__Activate(orbitControls);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fly to Orbit Transition
// -----------------------------------------------------------------------------

    // FUNCTION | Transition from Fly Mode to Orbit Mode
    // ------------------------------------------------------------
    // Uses the same "reposition orbit camera on the side of the helper cube
    // closest to where the user ended up" logic as walk-to-orbit so the
    // returning orbit view never snaps to a wildly different vantage point.
    // ------------------------------------------------------------
    function Na__ModeTransition__FlyToOrbit(camera, orbitControls) {
        const savedState = Na__FlyMode__GetSavedOrbitState();
        if (!savedState) {
            return Na__FlyMode__Deactivate(orbitControls);
        }

        const savedTarget    = savedState.orbitTarget;
        const savedCamPos    = savedState.cameraPosition;
        const savedDistance  = savedCamPos.distanceTo(savedTarget);
        const savedElevation = savedCamPos.y - savedTarget.y;

        const flyPos = camera.position.clone();

        const dirToFly = new THREE.Vector3(
            flyPos.x - savedTarget.x,
            0,
            flyPos.z - savedTarget.z
        );

        if (dirToFly.lengthSq() > 0.001) {
            dirToFly.normalize();
        } else {
            dirToFly.set(
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
            savedTarget.x + dirToFly.x * horizontalDist,
            savedTarget.y + savedElevation,
            savedTarget.z + dirToFly.z * horizontalDist
        );

        return Na__FlyMode__Deactivate(orbitControls, overridePosition);
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
        Na__ModeTransition__WalkToOrbit,
        Na__ModeTransition__OrbitToFly,
        Na__ModeTransition__FlyToOrbit
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
