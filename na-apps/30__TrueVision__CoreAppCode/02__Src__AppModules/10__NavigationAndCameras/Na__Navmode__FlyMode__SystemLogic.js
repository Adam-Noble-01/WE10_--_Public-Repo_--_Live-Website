// =============================================================================
// TRUEVISION3D - FLY MODE NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__Navmode__FlyMode__SystemLogic.js
// NAMESPACE  : TrueVision3D
// MODULE     : Fly Mode Navigation - System Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Free-flying first-person camera. No gravity, no collision.
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Provides a free-flying navigation mode for fast architectural review.
// - Camera moves directly in 3D space along the look direction (no capsule, no ground).
// - WASD / Arrow keys handle horizontal motion (forward/back/strafe).
// - Q/E (and Space/Ctrl alternatives) handle vertical motion (up/down).
// - Mouse handles yaw + pitch via Pointer Lock; arrow keys may optionally rotate when
//   Pointer Lock is unavailable (handled by the DesktopControls module).
// - Movement values are exponentially smoothed (configurable damping) so motion feels
//   like a stabilised drone rather than a snapping camera, while still allowing instant
//   stops by simply releasing the key.
// - Door proximity opening shares the existing Na__DoorProximity__ system so doors
//   animate naturally as the user flies past them, matching walk mode behaviour.
// - Completely separate from Orbit Mode and Walk Mode with its own state machine.
//
// INTEGRATION:
// - Call Na__FlyMode__Initialize() after scene and camera are ready.
// - Call Na__FlyMode__Update(deltaMs) every frame in the render loop while active.
// - Toggle with Na__FlyMode__Activate() / Na__FlyMode__Deactivate().
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Initial implementation of free-flight navigation system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------


    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants (Defaults - Overridden by AppConfig)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fly Mode Default Configuration (Millimetres + Scalars)
    // ------------------------------------------------------------
    let Na__FlyMode__Config__HorizontalFovDeg                = 60;          // <-- Fly mode camera FOV (degrees)
    let Na__FlyMode__Config__MovementSpeedMmPerSec           = 5000;        // <-- Horizontal fly speed (mm/sec)
    let Na__FlyMode__Config__VerticalSpeedMmPerSec           = 4000;        // <-- Vertical fly speed (mm/sec)
    let Na__FlyMode__Config__BoostMultiplier                 = 3.0;         // <-- Boost (Shift) speed multiplier
    let Na__FlyMode__Config__SlowMultiplier                  = 0.25;        // <-- Slow (Alt) speed multiplier
    let Na__FlyMode__Config__MouseSensitivity                = 0.0018;      // <-- Mouse look sensitivity (radians/pixel)
    let Na__FlyMode__Config__KeyboardRotateRadPerSec         = 1.4;         // <-- Keyboard rotation speed (radians/sec)
    let Na__FlyMode__Config__MovementDampingFactor           = 12.0;        // <-- Higher = snappier; lower = floatier
    let Na__FlyMode__Config__DoorProximityThresholdMm        = 3000;        // <-- Door proximity trigger distance (mm)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Converted Units (Populated on Initialize)
    // ------------------------------------------------------------
    let Na__FlyMode__Units__MovementSpeedPerSec              = 0;           // <-- Horizontal speed in units/sec
    let Na__FlyMode__Units__VerticalSpeedPerSec              = 0;           // <-- Vertical speed in units/sec
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Pitch Clamp (~85deg) and Numeric Epsilon
    // ------------------------------------------------------------
    const Na__FlyMode__PITCH_CLAMP_RAD                       = 1.483;       // <-- ~85 degrees (prevents gimbal flip)
    const Na__FlyMode__VELOCITY_EPSILON                      = 1e-6;        // <-- Threshold to treat smoothed velocity as zero
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core References
    // ------------------------------------------------------------
    let Na__FlyMode__Scene                                   = null;        // <-- Three.js scene reference
    let Na__FlyMode__Camera                                  = null;        // <-- Three.js camera reference
    let Na__FlyMode__RendererDomElement                      = null;        // <-- Canvas DOM element
    let Na__FlyMode__Initialized                             = false;       // <-- Module initialization flag
    let Na__FlyMode__Active                                  = false;       // <-- Fly mode currently active
    // ------------------------------------------------------------


    // MODULE VARIABLES | Camera Rotation State (Source of Truth for Orientation)
    // ------------------------------------------------------------
    let Na__FlyMode__CameraYaw                               = 0;           // <-- Horizontal rotation (radians)
    let Na__FlyMode__CameraPitch                             = 0;           // <-- Vertical rotation (radians)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Smoothed Velocity (For Drone-Like Glide)
    // ------------------------------------------------------------
    let Na__FlyMode__SmoothedForwardInput                    = 0;           // <-- Eased forward input [-1, 1]
    let Na__FlyMode__SmoothedStrafeInput                     = 0;           // <-- Eased strafe input [-1, 1]
    let Na__FlyMode__SmoothedVerticalInput                   = 0;           // <-- Eased vertical input [-1, 1]
    // ------------------------------------------------------------


    // MODULE VARIABLES | Saved Pre-Fly State (Restored on Deactivate)
    // ------------------------------------------------------------
    const Na__FlyMode__SavedOrbitState                       = {
        cameraPosition   : new THREE.Vector3(),                             // <-- Camera position before fly mode
        cameraQuaternion : new THREE.Quaternion(),                          // <-- Camera quaternion before fly mode
        cameraFov        : 45,                                              // <-- Camera FOV before fly mode
        orbitTarget      : new THREE.Vector3()                              // <-- Orbit target before fly mode
    };
    // ------------------------------------------------------------


    // MODULE VARIABLES | Input State (Set by Desktop/Touch Controls)
    // ------------------------------------------------------------
    let Na__FlyMode__InputForward                            = 0;           // <-- Forward/backward input [-1, 1]
    let Na__FlyMode__InputStrafe                             = 0;           // <-- Left/right strafe input [-1, 1]
    let Na__FlyMode__InputVertical                           = 0;           // <-- Up/down input [-1, 1]
    let Na__FlyMode__InputBoost                              = false;       // <-- Boost modifier active (Shift)
    let Na__FlyMode__InputSlow                               = false;       // <-- Slow modifier active (Alt)
    let Na__FlyMode__InputYawDelta                           = 0;           // <-- Mouse/touch yaw delta (per frame)
    let Na__FlyMode__InputPitchDelta                         = 0;           // <-- Mouse/touch pitch delta (per frame)
    let Na__FlyMode__InputKeyboardYawRate                    = 0;           // <-- Keyboard yaw rate (radians/sec, -1..1 sign)
    let Na__FlyMode__InputKeyboardPitchRate                  = 0;           // <-- Keyboard pitch rate (radians/sec, -1..1 sign)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Reusable Scratch Vectors (Avoid Per-Frame Allocation)
    // ------------------------------------------------------------
    const Na__FlyMode__Scratch__Forward                      = new THREE.Vector3();         // <-- Reusable forward vector
    const Na__FlyMode__Scratch__Right                        = new THREE.Vector3();         // <-- Reusable right vector
    const Na__FlyMode__Scratch__UpAxis                       = new THREE.Vector3(0, 1, 0);  // <-- World-up reference axis
    const Na__FlyMode__Scratch__Euler                        = new THREE.Euler();           // <-- Reusable Euler for camera quaternion
    const Na__FlyMode__Scratch__MoveDelta                    = new THREE.Vector3();         // <-- Reusable per-frame move accumulator
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration and Initialization
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply Config Values From AppConfig JSON
    // ------------------------------------------------------------
    function Na__FlyMode__ApplyConfig(flyConfig) {
        if (!flyConfig) return;

        if (Number.isFinite(flyConfig.Navmode__FlyMode__HorizontalFovDeg)) {
            Na__FlyMode__Config__HorizontalFovDeg = flyConfig.Navmode__FlyMode__HorizontalFovDeg;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__MovementSpeedMmPerSec)) {
            Na__FlyMode__Config__MovementSpeedMmPerSec = flyConfig.Navmode__FlyMode__MovementSpeedMmPerSec;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__VerticalSpeedMmPerSec)) {
            Na__FlyMode__Config__VerticalSpeedMmPerSec = flyConfig.Navmode__FlyMode__VerticalSpeedMmPerSec;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__BoostMultiplier)) {
            Na__FlyMode__Config__BoostMultiplier = flyConfig.Navmode__FlyMode__BoostMultiplier;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__SlowMultiplier)) {
            Na__FlyMode__Config__SlowMultiplier = flyConfig.Navmode__FlyMode__SlowMultiplier;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__MouseSensitivity)) {
            Na__FlyMode__Config__MouseSensitivity = flyConfig.Navmode__FlyMode__MouseSensitivity;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__KeyboardRotateRadPerSec)) {
            Na__FlyMode__Config__KeyboardRotateRadPerSec = flyConfig.Navmode__FlyMode__KeyboardRotateRadPerSec;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__MovementDampingFactor)) {
            Na__FlyMode__Config__MovementDampingFactor = flyConfig.Navmode__FlyMode__MovementDampingFactor;
        }
        if (Number.isFinite(flyConfig.Navmode__FlyMode__DoorProximityThresholdMm)) {
            Na__FlyMode__Config__DoorProximityThresholdMm = flyConfig.Navmode__FlyMode__DoorProximityThresholdMm;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Configured MM Values to Three.js Units
    // ------------------------------------------------------------
    function Na__FlyMode__ConvertConfigToUnits() {
        Na__FlyMode__Units__MovementSpeedPerSec = Na__Math__ConvertMmToUnits(Na__FlyMode__Config__MovementSpeedMmPerSec);
        Na__FlyMode__Units__VerticalSpeedPerSec = Na__Math__ConvertMmToUnits(Na__FlyMode__Config__VerticalSpeedMmPerSec);
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Fly Mode System
    // ------------------------------------------------------------
    function Na__FlyMode__Initialize(scene, camera, rendererDomElement, flyConfig) {
        Na__FlyMode__Scene              = scene;
        Na__FlyMode__Camera             = camera;
        Na__FlyMode__RendererDomElement = rendererDomElement;

        Na__FlyMode__ApplyConfig(flyConfig);
        Na__FlyMode__ConvertConfigToUnits();

        Na__FlyMode__Initialized = true;
        console.log('[FlyMode] Fly mode system initialised');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Camera Look (Yaw / Pitch) and Pose Sync
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply Accumulated Look Deltas to Yaw / Pitch
    // ------------------------------------------------------------
    // Pointer-lock + touch deltas accumulate into Na__FlyMode__InputYawDelta
    // and Na__FlyMode__InputPitchDelta. Keyboard rotation feeds a continuous
    // rate that is multiplied by deltaSec here so it scales correctly with
    // frame time.
    // ------------------------------------------------------------
    function Na__FlyMode__ApplyCameraLook(deltaSec) {
        Na__FlyMode__CameraYaw   -= Na__FlyMode__InputYawDelta;
        Na__FlyMode__CameraPitch -= Na__FlyMode__InputPitchDelta;

        if (Na__FlyMode__InputKeyboardYawRate !== 0) {
            Na__FlyMode__CameraYaw   -= Na__FlyMode__InputKeyboardYawRate * Na__FlyMode__Config__KeyboardRotateRadPerSec * deltaSec;
        }
        if (Na__FlyMode__InputKeyboardPitchRate !== 0) {
            Na__FlyMode__CameraPitch -= Na__FlyMode__InputKeyboardPitchRate * Na__FlyMode__Config__KeyboardRotateRadPerSec * deltaSec;
        }

        Na__FlyMode__CameraPitch = Math.max(
            -Na__FlyMode__PITCH_CLAMP_RAD,
            Math.min(Na__FlyMode__PITCH_CLAMP_RAD, Na__FlyMode__CameraPitch)
        );

        Na__FlyMode__InputYawDelta   = 0;
        Na__FlyMode__InputPitchDelta = 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write Yaw / Pitch Back to Camera Quaternion
    // ------------------------------------------------------------
    function Na__FlyMode__UpdateCameraOrientation() {
        if (!Na__FlyMode__Camera) return;
        Na__FlyMode__Scratch__Euler.set(Na__FlyMode__CameraPitch, Na__FlyMode__CameraYaw, 0, 'YXZ');
        Na__FlyMode__Camera.quaternion.setFromEuler(Na__FlyMode__Scratch__Euler);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Movement Processing (Smoothed Velocity Integration)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Exponential Damping Towards a Target Value
    // ------------------------------------------------------------
    // Standard frame-rate-independent ease.  `factor` controls aggressiveness;
    // 0 means instant snap, infinity means never move.  Clamps tiny residuals
    // to zero so we do not drift forever on stale floating-point noise.
    // ------------------------------------------------------------
    function Na__FlyMode__DampTowards(current, target, factor, deltaSec) {
        const t = 1 - Math.exp(-factor * deltaSec);
        const next = current + (target - current) * t;
        if (Math.abs(next) < Na__FlyMode__VELOCITY_EPSILON && target === 0) return 0;
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | Process Movement Input and Translate the Camera
    // ------------------------------------------------------------
    function Na__FlyMode__ProcessMovement(deltaSec) {
        const dampFactor = Na__FlyMode__Config__MovementDampingFactor;
        Na__FlyMode__SmoothedForwardInput  = Na__FlyMode__DampTowards(Na__FlyMode__SmoothedForwardInput,  Na__FlyMode__InputForward,  dampFactor, deltaSec);
        Na__FlyMode__SmoothedStrafeInput   = Na__FlyMode__DampTowards(Na__FlyMode__SmoothedStrafeInput,   Na__FlyMode__InputStrafe,   dampFactor, deltaSec);
        Na__FlyMode__SmoothedVerticalInput = Na__FlyMode__DampTowards(Na__FlyMode__SmoothedVerticalInput, Na__FlyMode__InputVertical, dampFactor, deltaSec);

        const movingForward  = Math.abs(Na__FlyMode__SmoothedForwardInput)  > Na__FlyMode__VELOCITY_EPSILON;
        const movingStrafe   = Math.abs(Na__FlyMode__SmoothedStrafeInput)   > Na__FlyMode__VELOCITY_EPSILON;
        const movingVertical = Math.abs(Na__FlyMode__SmoothedVerticalInput) > Na__FlyMode__VELOCITY_EPSILON;
        if (!movingForward && !movingStrafe && !movingVertical) return;

        let horizontalSpeed = Na__FlyMode__Units__MovementSpeedPerSec;
        let verticalSpeed   = Na__FlyMode__Units__VerticalSpeedPerSec;
        if (Na__FlyMode__InputBoost) {
            horizontalSpeed *= Na__FlyMode__Config__BoostMultiplier;
            verticalSpeed   *= Na__FlyMode__Config__BoostMultiplier;
        } else if (Na__FlyMode__InputSlow) {
            horizontalSpeed *= Na__FlyMode__Config__SlowMultiplier;
            verticalSpeed   *= Na__FlyMode__Config__SlowMultiplier;
        }

        const forward = Na__FlyMode__Scratch__Forward.set(0, 0, -1)
            .applyEuler(Na__FlyMode__Scratch__Euler.set(Na__FlyMode__CameraPitch, Na__FlyMode__CameraYaw, 0, 'YXZ'));   // <-- Look-relative forward (includes pitch)

        const right = Na__FlyMode__Scratch__Right.copy(forward)
            .cross(Na__FlyMode__Scratch__UpAxis)
            .normalize();                                                                                              // <-- Yaw-aligned strafe axis

        const moveDelta = Na__FlyMode__Scratch__MoveDelta.set(0, 0, 0);                                                // <-- Reused scratch (no allocation)
        moveDelta.addScaledVector(forward, Na__FlyMode__SmoothedForwardInput * horizontalSpeed * deltaSec);
        moveDelta.addScaledVector(right,   Na__FlyMode__SmoothedStrafeInput  * horizontalSpeed * deltaSec);
        moveDelta.y += Na__FlyMode__SmoothedVerticalInput * verticalSpeed * deltaSec;

        Na__FlyMode__Camera.position.add(moveDelta);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate Fly Mode
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Snapshot Current Camera + Orbit State for Restore
    // ------------------------------------------------------------
    function Na__FlyMode__CaptureSavedState(orbitControls) {
        Na__FlyMode__SavedOrbitState.cameraPosition.copy(Na__FlyMode__Camera.position);
        Na__FlyMode__SavedOrbitState.cameraQuaternion.copy(Na__FlyMode__Camera.quaternion);
        Na__FlyMode__SavedOrbitState.cameraFov = Na__FlyMode__Camera.fov;
        if (orbitControls && orbitControls.target) {
            Na__FlyMode__SavedOrbitState.orbitTarget.copy(orbitControls.target);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reset All Input Channels to Neutral
    // ------------------------------------------------------------
    function Na__FlyMode__ResetInputs() {
        Na__FlyMode__InputForward            = 0;
        Na__FlyMode__InputStrafe             = 0;
        Na__FlyMode__InputVertical           = 0;
        Na__FlyMode__InputBoost              = false;
        Na__FlyMode__InputSlow               = false;
        Na__FlyMode__InputYawDelta           = 0;
        Na__FlyMode__InputPitchDelta         = 0;
        Na__FlyMode__InputKeyboardYawRate    = 0;
        Na__FlyMode__InputKeyboardPitchRate  = 0;

        Na__FlyMode__SmoothedForwardInput    = 0;
        Na__FlyMode__SmoothedStrafeInput     = 0;
        Na__FlyMode__SmoothedVerticalInput   = 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Activate Fly Mode (Switch From Orbit/Walk to Fly)
    // ------------------------------------------------------------
    function Na__FlyMode__Activate(orbitControls) {
        if (!Na__FlyMode__Initialized) {
            console.warn('[FlyMode] Cannot activate: system not initialised');
            return false;
        }
        if (Na__FlyMode__Active) {
            console.warn('[FlyMode] Already active');
            return false;
        }

        Na__FlyMode__CaptureSavedState(orbitControls);

        if (orbitControls) {
            orbitControls.enabled = false;
        }

        Na__FlyMode__Camera.fov = Na__FlyMode__Config__HorizontalFovDeg;
        Na__FlyMode__Camera.updateProjectionMatrix();

        const euler = new THREE.Euler().setFromQuaternion(Na__FlyMode__Camera.quaternion, 'YXZ');
        Na__FlyMode__CameraYaw   = euler.y;
        Na__FlyMode__CameraPitch = Math.max(
            -Na__FlyMode__PITCH_CLAMP_RAD,
            Math.min(Na__FlyMode__PITCH_CLAMP_RAD, euler.x)
        );

        Na__FlyMode__ResetInputs();
        Na__FlyMode__UpdateCameraOrientation();

        Na__FlyMode__Active = true;
        console.log('[FlyMode] Fly mode activated');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Fly Mode (Switch Back to Orbit)
    // ------------------------------------------------------------
    // overrideCameraPosition (optional Vector3): when provided the orbit
    // camera is placed here instead of at the pre-fly snapshot position.
    // The orbit target and FOV are always restored from the saved state.
    // ------------------------------------------------------------
    function Na__FlyMode__Deactivate(orbitControls, overrideCameraPosition) {
        if (!Na__FlyMode__Active) return false;

        const restorePos = (overrideCameraPosition && overrideCameraPosition.isVector3)
            ? overrideCameraPosition
            : Na__FlyMode__SavedOrbitState.cameraPosition;

        Na__FlyMode__Camera.position.copy(restorePos);
        Na__FlyMode__Camera.fov = Na__FlyMode__SavedOrbitState.cameraFov;
        Na__FlyMode__Camera.updateProjectionMatrix();

        if (orbitControls) {
            if (orbitControls.target) {
                orbitControls.target.copy(Na__FlyMode__SavedOrbitState.orbitTarget);
            }
            orbitControls.enabled = true;
            orbitControls.update();
        }

        Na__FlyMode__ResetInputs();
        Na__FlyMode__Active = false;
        console.log('[FlyMode] Fly mode deactivated, orbit restored');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per-Frame Update
// -----------------------------------------------------------------------------

    // FUNCTION | Update Fly Mode System (Called Every Frame)
    // ------------------------------------------------------------
    function Na__FlyMode__Update(deltaMs) {
        if (!Na__FlyMode__Initialized || !Na__FlyMode__Active) return;

        const deltaSec = Math.min(deltaMs / 1000, 0.1);

        Na__FlyMode__ApplyCameraLook(deltaSec);
        Na__FlyMode__ProcessMovement(deltaSec);
        Na__FlyMode__UpdateCameraOrientation();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Input Setters (Called by Desktop/Touch Control Modules)
// -----------------------------------------------------------------------------

    // FUNCTION | Set Translational Movement Input (Normalised -1..1)
    // ------------------------------------------------------------
    function Na__FlyMode__SetMovementInput(forward, strafe, vertical) {
        Na__FlyMode__InputForward  = forward;
        Na__FlyMode__InputStrafe   = strafe;
        Na__FlyMode__InputVertical = vertical;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Speed Modifier State (Shift / Alt)
    // ------------------------------------------------------------
    function Na__FlyMode__SetSpeedModifiers(boost, slow) {
        Na__FlyMode__InputBoost = !!boost;
        Na__FlyMode__InputSlow  = !!slow;
    }
    // ------------------------------------------------------------


    // FUNCTION | Accumulate Look Input Deltas (Mouse / Touch)
    // ------------------------------------------------------------
    function Na__FlyMode__AccumulateLookInput(yawDelta, pitchDelta) {
        Na__FlyMode__InputYawDelta   += yawDelta;
        Na__FlyMode__InputPitchDelta += pitchDelta;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Keyboard Rotation Rate (For Arrow-Key Look When Pointer Lock Off)
    // ------------------------------------------------------------
    function Na__FlyMode__SetKeyboardRotateRate(yawRate, pitchRate) {
        Na__FlyMode__InputKeyboardYawRate   = yawRate;
        Na__FlyMode__InputKeyboardPitchRate = pitchRate;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Getters
// -----------------------------------------------------------------------------

    // FUNCTION | Check If Fly Mode Is Active
    // ------------------------------------------------------------
    function Na__FlyMode__IsActive() {
        return Na__FlyMode__Active;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Current Camera World Position (For Door Proximity)
    // ------------------------------------------------------------
    // Returns a fresh Vector3 clone so callers may mutate freely without
    // touching internal scratch values.
    // ------------------------------------------------------------
    function Na__FlyMode__GetCameraPosition() {
        if (!Na__FlyMode__Camera) return null;
        return Na__FlyMode__Camera.position.clone();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Saved Pre-Fly Orbit State (Read-Only Copy)
    // ------------------------------------------------------------
    function Na__FlyMode__GetSavedOrbitState() {
        return {
            cameraPosition : Na__FlyMode__SavedOrbitState.cameraPosition.clone(),
            cameraFov      : Na__FlyMode__SavedOrbitState.cameraFov,
            orbitTarget    : Na__FlyMode__SavedOrbitState.orbitTarget.clone()
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Fly Mode Config Values (For Downstream Modules)
    // ------------------------------------------------------------
    function Na__FlyMode__GetConfig() {
        return {
            horizontalFovDeg         : Na__FlyMode__Config__HorizontalFovDeg,
            movementSpeedMmPerSec    : Na__FlyMode__Config__MovementSpeedMmPerSec,
            verticalSpeedMmPerSec    : Na__FlyMode__Config__VerticalSpeedMmPerSec,
            boostMultiplier          : Na__FlyMode__Config__BoostMultiplier,
            slowMultiplier           : Na__FlyMode__Config__SlowMultiplier,
            mouseSensitivity         : Na__FlyMode__Config__MouseSensitivity,
            keyboardRotateRadPerSec  : Na__FlyMode__Config__KeyboardRotateRadPerSec,
            movementDampingFactor    : Na__FlyMode__Config__MovementDampingFactor,
            doorProximityThresholdMm : Na__FlyMode__Config__DoorProximityThresholdMm
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Fly Mode System Public API
    // ------------------------------------------------------------
    export {
        Na__FlyMode__Initialize,
        Na__FlyMode__Activate,
        Na__FlyMode__Deactivate,
        Na__FlyMode__Update,
        Na__FlyMode__IsActive,
        Na__FlyMode__GetCameraPosition,
        Na__FlyMode__GetSavedOrbitState,
        Na__FlyMode__GetConfig,
        Na__FlyMode__SetMovementInput,
        Na__FlyMode__SetSpeedModifiers,
        Na__FlyMode__AccumulateLookInput,
        Na__FlyMode__SetKeyboardRotateRate
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
