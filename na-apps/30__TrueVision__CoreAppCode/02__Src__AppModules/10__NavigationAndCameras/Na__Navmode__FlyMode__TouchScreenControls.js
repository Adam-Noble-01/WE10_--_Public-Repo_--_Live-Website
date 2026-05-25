// =============================================================================
// TRUEVISION3D - FLY MODE TOUCH SCREEN CONTROLS
// =============================================================================
//
// FILE       : Na__Navmode__FlyMode__TouchScreenControls.js
// NAMESPACE  : TrueVision3D
// MODULE     : Fly Mode Navigation - Touch Screen Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Free-flight touch input for fly mode on mobile/tablet devices
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Single-finger drag controls horizontal motion (forward/back + strafe), mirroring
//   the walk-mode UX so users have one mental model across both modes.
// - Two-finger drag controls camera rotation (yaw + pitch).
// - Pinch gesture is repurposed for vertical movement - spreading fingers lifts the
//   camera, pinching descends.  This matches the "drone altitude pinch" idiom used by
//   many architectural viewers on tablet.
// - All inputs feed the SystemLogic module via setters; this module holds no THREE.js
//   or physics state.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Initial implementation of touch screen fly mode controls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode System Logic Setters
    // ------------------------------------------------------------
    import {
        Na__FlyMode__SetMovementInput,
        Na__FlyMode__AccumulateLookInput
    } from './Na__Navmode__FlyMode__SystemLogic.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Touch Gesture Thresholds and Sensitivities
    // ------------------------------------------------------------
    const Na__FlyModeTouch__DEAD_ZONE_PX                   = 8;          // <-- Minimum drag before registering input
    let   Na__FlyModeTouch__MOVEMENT_SCALE                 = 0.004;      // <-- Pixel-to-normalised horizontal scale
    let   Na__FlyModeTouch__LOOK_SENSITIVITY               = 0.003;      // <-- Two-finger look sensitivity
    const Na__FlyModeTouch__PINCH_VERTICAL_SCALE           = 0.02;       // <-- Pinch distance to vertical input scaling
    const Na__FlyModeTouch__ACCELERATION_EXPONENT          = 1.5;        // <-- Acceleration curve exponent for horizontal motion
    const Na__FlyModeTouch__MAX_MOVEMENT_INPUT             = 1.0;        // <-- Maximum normalised input magnitude
    const Na__FlyModeTouch__SMOOTHING_FACTOR               = 0.15;       // <-- Input smoothing (0 = instant, 1 = no change)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Control State
    // ------------------------------------------------------------
    let Na__FlyModeTouch__Active                           = false;      // <-- Touch controls active flag
    let Na__FlyModeTouch__DomElement                       = null;       // <-- Canvas DOM element
    // ------------------------------------------------------------


    // MODULE VARIABLES | Touch Tracking
    // ------------------------------------------------------------
    const Na__FlyModeTouch__ActiveTouches                  = new Map();  // <-- Map<touchId, {startX, startY, lastX, lastY}>
    let   Na__FlyModeTouch__PinchStartDistance             = 0;          // <-- Distance between two fingers when pinch began
    let   Na__FlyModeTouch__PinchActive                    = false;      // <-- Two-finger pinch in progress
    // ------------------------------------------------------------


    // MODULE VARIABLES | Smoothed Input Values
    // ------------------------------------------------------------
    let Na__FlyModeTouch__SmoothedForward                  = 0;          // <-- Smoothed forward/backward input
    let Na__FlyModeTouch__SmoothedStrafe                   = 0;          // <-- Smoothed strafe input
    let Na__FlyModeTouch__SmoothedVertical                 = 0;          // <-- Smoothed vertical input
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touch Gesture Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Calculate Distance Between Two Touch Points
    // ------------------------------------------------------------
    function Na__FlyModeTouch__GetTouchDistance(touchA, touchB) {
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Acceleration Curve to Raw Input
    // ------------------------------------------------------------
    function Na__FlyModeTouch__ApplyAcceleration(rawValue) {
        const sign      = rawValue < 0 ? -1 : 1;
        const magnitude = Math.abs(rawValue);
        const curved    = Math.pow(magnitude, Na__FlyModeTouch__ACCELERATION_EXPONENT);
        return sign * Math.min(curved, Na__FlyModeTouch__MAX_MOVEMENT_INPUT);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Smooth Input Value Toward Target
    // ------------------------------------------------------------
    function Na__FlyModeTouch__SmoothValue(current, target) {
        return current + (target - current) * Na__FlyModeTouch__SMOOTHING_FACTOR;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find Touch by Identifier in TouchList
    // ------------------------------------------------------------
    function Na__FlyModeTouch__GetTouchById(touchList, touchId) {
        for (let i = 0; i < touchList.length; i++) {
            if (touchList[i].identifier === touchId) {
                return touchList[i];
            }
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push Currently Smoothed Movement Inputs to SystemLogic
    // ------------------------------------------------------------
    function Na__FlyModeTouch__PushMovementInputs() {
        Na__FlyMode__SetMovementInput(
            Na__FlyModeTouch__SmoothedForward,
            Na__FlyModeTouch__SmoothedStrafe,
            Na__FlyModeTouch__SmoothedVertical
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touch Event Handlers
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Handle Touch Start
    // ------------------------------------------------------------
    function Na__FlyModeTouch__OnTouchStart(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            Na__FlyModeTouch__ActiveTouches.set(touch.identifier, {
                startX : touch.clientX,
                startY : touch.clientY,
                lastX  : touch.clientX,
                lastY  : touch.clientY
            });
        }

        if (Na__FlyModeTouch__ActiveTouches.size === 2) {
            const touchIds = Array.from(Na__FlyModeTouch__ActiveTouches.keys());
            const touchA   = Na__FlyModeTouch__GetTouchById(event.touches, touchIds[0]);
            const touchB   = Na__FlyModeTouch__GetTouchById(event.touches, touchIds[1]);

            if (touchA && touchB) {
                Na__FlyModeTouch__PinchStartDistance = Na__FlyModeTouch__GetTouchDistance(touchA, touchB);
                Na__FlyModeTouch__PinchActive = true;
            }
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Touch Move
    // ------------------------------------------------------------
    function Na__FlyModeTouch__OnTouchMove(event) {
        event.preventDefault();

        const touchCount = Na__FlyModeTouch__ActiveTouches.size;

        if (touchCount === 1) {
            Na__FlyModeTouch__HandleSingleFingerMove(event);
        } else if (touchCount === 2) {
            Na__FlyModeTouch__HandleTwoFingerMove(event);
        }

        for (const touch of event.changedTouches) {
            const tracked = Na__FlyModeTouch__ActiveTouches.get(touch.identifier);
            if (tracked) {
                tracked.lastX = touch.clientX;
                tracked.lastY = touch.clientY;
            }
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Touch End
    // ------------------------------------------------------------
    function Na__FlyModeTouch__OnTouchEnd(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            Na__FlyModeTouch__ActiveTouches.delete(touch.identifier);
        }

        if (Na__FlyModeTouch__ActiveTouches.size < 2) {
            Na__FlyModeTouch__PinchActive = false;
            Na__FlyModeTouch__PinchStartDistance = 0;
            Na__FlyModeTouch__SmoothedVertical = 0;
        }

        if (Na__FlyModeTouch__ActiveTouches.size === 0) {
            Na__FlyModeTouch__SmoothedForward = 0;
            Na__FlyModeTouch__SmoothedStrafe  = 0;
            Na__FlyModeTouch__SmoothedVertical = 0;
            Na__FlyMode__SetMovementInput(0, 0, 0);
        } else {
            Na__FlyModeTouch__PushMovementInputs();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Processing
// -----------------------------------------------------------------------------

    // FUNCTION | Process Single Finger Drag (Horizontal Movement)
    // ------------------------------------------------------------
    function Na__FlyModeTouch__HandleSingleFingerMove(event) {
        const touch   = event.changedTouches[0];
        const tracked = Na__FlyModeTouch__ActiveTouches.get(touch.identifier);
        if (!tracked) return;

        const deltaX = touch.clientX - tracked.startX;
        const deltaY = touch.clientY - tracked.startY;

        if (Math.abs(deltaX) < Na__FlyModeTouch__DEAD_ZONE_PX &&
            Math.abs(deltaY) < Na__FlyModeTouch__DEAD_ZONE_PX) {
            return;
        }

        const rawForward = -deltaY * Na__FlyModeTouch__MOVEMENT_SCALE;
        const rawStrafe  =  deltaX * Na__FlyModeTouch__MOVEMENT_SCALE;

        const targetForward = Na__FlyModeTouch__ApplyAcceleration(rawForward);
        const targetStrafe  = Na__FlyModeTouch__ApplyAcceleration(rawStrafe);

        Na__FlyModeTouch__SmoothedForward = Na__FlyModeTouch__SmoothValue(Na__FlyModeTouch__SmoothedForward, targetForward);
        Na__FlyModeTouch__SmoothedStrafe  = Na__FlyModeTouch__SmoothValue(Na__FlyModeTouch__SmoothedStrafe, targetStrafe);

        Na__FlyModeTouch__PushMovementInputs();
    }
    // ------------------------------------------------------------


    // FUNCTION | Process Two Finger Drag (Rotation) + Pinch (Vertical Motion)
    // ------------------------------------------------------------
    function Na__FlyModeTouch__HandleTwoFingerMove(event) {
        const touchIds = Array.from(Na__FlyModeTouch__ActiveTouches.keys());
        if (touchIds.length < 2) return;

        const touchA = Na__FlyModeTouch__GetTouchById(event.touches, touchIds[0]);
        const touchB = Na__FlyModeTouch__GetTouchById(event.touches, touchIds[1]);
        if (!touchA || !touchB) return;

        const trackedA = Na__FlyModeTouch__ActiveTouches.get(touchIds[0]);
        const trackedB = Na__FlyModeTouch__ActiveTouches.get(touchIds[1]);
        if (!trackedA || !trackedB) return;

        const avgDeltaX = ((touchA.clientX - trackedA.lastX) + (touchB.clientX - trackedB.lastX)) * 0.5;
        const avgDeltaY = ((touchA.clientY - trackedA.lastY) + (touchB.clientY - trackedB.lastY)) * 0.5;

        const yawDelta   = avgDeltaX * Na__FlyModeTouch__LOOK_SENSITIVITY;
        const pitchDelta = avgDeltaY * Na__FlyModeTouch__LOOK_SENSITIVITY;

        Na__FlyMode__AccumulateLookInput(yawDelta, pitchDelta);

        if (Na__FlyModeTouch__PinchActive) {
            const currentDistance = Na__FlyModeTouch__GetTouchDistance(touchA, touchB);
            const pinchDeltaPx    = currentDistance - Na__FlyModeTouch__PinchStartDistance;

            const rawVertical = pinchDeltaPx * Na__FlyModeTouch__PINCH_VERTICAL_SCALE * Na__FlyModeTouch__MOVEMENT_SCALE;
            const targetVertical = Na__FlyModeTouch__ApplyAcceleration(rawVertical);

            Na__FlyModeTouch__SmoothedVertical = Na__FlyModeTouch__SmoothValue(
                Na__FlyModeTouch__SmoothedVertical,
                targetVertical
            );

            Na__FlyModeTouch__PushMovementInputs();
            Na__FlyModeTouch__PinchStartDistance = currentDistance;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate
// -----------------------------------------------------------------------------

    // FUNCTION | Activate Touch Screen Controls
    // ------------------------------------------------------------
    function Na__FlyModeTouch__Activate(domElement, config) {
        if (Na__FlyModeTouch__Active) return;

        Na__FlyModeTouch__DomElement = domElement;

        if (config && Number.isFinite(config.touchMovementScale)) {
            Na__FlyModeTouch__MOVEMENT_SCALE = config.touchMovementScale;
        }
        if (config && Number.isFinite(config.touchLookSensitivity)) {
            Na__FlyModeTouch__LOOK_SENSITIVITY = config.touchLookSensitivity;
        }

        Na__FlyModeTouch__ActiveTouches.clear();
        Na__FlyModeTouch__SmoothedForward     = 0;
        Na__FlyModeTouch__SmoothedStrafe      = 0;
        Na__FlyModeTouch__SmoothedVertical    = 0;
        Na__FlyModeTouch__PinchActive         = false;
        Na__FlyModeTouch__PinchStartDistance  = 0;

        domElement.addEventListener('touchstart', Na__FlyModeTouch__OnTouchStart,  { passive: false });
        domElement.addEventListener('touchmove',  Na__FlyModeTouch__OnTouchMove,   { passive: false });
        domElement.addEventListener('touchend',   Na__FlyModeTouch__OnTouchEnd,    { passive: false });
        domElement.addEventListener('touchcancel', Na__FlyModeTouch__OnTouchEnd,   { passive: false });

        Na__FlyModeTouch__Active = true;
        console.log('[FlyMode Touch] Touch screen controls activated');
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Touch Screen Controls
    // ------------------------------------------------------------
    function Na__FlyModeTouch__Deactivate() {
        if (!Na__FlyModeTouch__Active) return;

        if (Na__FlyModeTouch__DomElement) {
            Na__FlyModeTouch__DomElement.removeEventListener('touchstart', Na__FlyModeTouch__OnTouchStart);
            Na__FlyModeTouch__DomElement.removeEventListener('touchmove',  Na__FlyModeTouch__OnTouchMove);
            Na__FlyModeTouch__DomElement.removeEventListener('touchend',   Na__FlyModeTouch__OnTouchEnd);
            Na__FlyModeTouch__DomElement.removeEventListener('touchcancel', Na__FlyModeTouch__OnTouchEnd);
        }

        Na__FlyModeTouch__ActiveTouches.clear();
        Na__FlyModeTouch__SmoothedForward  = 0;
        Na__FlyModeTouch__SmoothedStrafe   = 0;
        Na__FlyModeTouch__SmoothedVertical = 0;
        Na__FlyMode__SetMovementInput(0, 0, 0);

        Na__FlyModeTouch__Active = false;
        console.log('[FlyMode Touch] Touch screen controls deactivated');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Touch Screen Controls Public API
    // ------------------------------------------------------------
    export {
        Na__FlyModeTouch__Activate,
        Na__FlyModeTouch__Deactivate
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
