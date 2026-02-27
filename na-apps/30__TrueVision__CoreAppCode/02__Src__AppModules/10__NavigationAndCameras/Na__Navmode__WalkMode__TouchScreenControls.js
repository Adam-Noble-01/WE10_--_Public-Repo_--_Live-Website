// =============================================================================
// TRUEVISION3D - WALK MODE TOUCH SCREEN CONTROLS
// =============================================================================
//
// FILE       : Na__Navmode__WalkMode__TouchScreenControls.js
// NAMESPACE  : TrueVision3D
// MODULE     : Walk Mode Navigation - Touch Screen Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-person touch input for walk mode on mobile/tablet devices
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - Single finger drag controls directional movement (forward/back/strafe).
// - Two finger drag controls head rotation (yaw/pitch).
// - Pinch gesture maps to forward/backward movement speed.
// - Implements acceleration curves so finger movements scale naturally.
// - Feeds input values to the WalkMode SystemLogic module via setters.
// - Completely independent from orbit mode touch/iPad controls.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Feb-2026 - Version 1.0.0
// - Initial implementation of touch screen walk mode controls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Walk Mode System Logic Imports
    // ------------------------------------------------------------
    import {
        Na__WalkMode__SetMovementInput,
        Na__WalkMode__AccumulateLookInput
    } from './Na__Navmode__WalkMode__SystemLogic.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Touch Gesture Thresholds
    // ------------------------------------------------------------
    const Na__WalkModeTouch__DEAD_ZONE_PX                  = 8;          // <-- Minimum drag before registering input
    const Na__WalkModeTouch__MOVEMENT_SCALE                = 0.004;      // <-- Pixel-to-normalized movement scaling
    const Na__WalkModeTouch__LOOK_SENSITIVITY              = 0.003;      // <-- Two-finger look sensitivity
    const Na__WalkModeTouch__PINCH_MOVEMENT_SCALE          = 0.008;      // <-- Pinch distance to movement scaling
    const Na__WalkModeTouch__ACCELERATION_EXPONENT         = 1.5;        // <-- Acceleration curve exponent for movement
    const Na__WalkModeTouch__MAX_MOVEMENT_INPUT            = 1.0;        // <-- Maximum normalized input magnitude
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Control State
    // ------------------------------------------------------------
    let Na__WalkModeTouch__Active                          = false;      // <-- Touch controls active flag
    let Na__WalkModeTouch__DomElement                      = null;       // <-- Canvas DOM element
    // ------------------------------------------------------------


    // MODULE VARIABLES | Touch Tracking
    // ------------------------------------------------------------
    let Na__WalkModeTouch__ActiveTouches                   = new Map();  // <-- Map<touchId, {startX, startY, lastX, lastY}>
    let Na__WalkModeTouch__PinchStartDistance              = 0;          // <-- Initial distance between two fingers
    let Na__WalkModeTouch__PinchActive                     = false;      // <-- Two-finger pinch in progress
    // ------------------------------------------------------------


    // MODULE VARIABLES | Smoothed Input Values
    // ------------------------------------------------------------
    let Na__WalkModeTouch__SmoothedForward                 = 0;          // <-- Smoothed forward/backward input
    let Na__WalkModeTouch__SmoothedStrafe                  = 0;          // <-- Smoothed left/right input
    const Na__WalkModeTouch__SMOOTHING_FACTOR              = 0.15;       // <-- Input smoothing (0 = instant, 1 = no change)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touch Gesture Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Calculate Distance Between Two Touch Points
    // ------------------------------------------------------------
    function Na__WalkModeTouch__GetTouchDistance(touchA, touchB) {
        const dx = touchA.clientX - touchB.clientX;
        const dy = touchA.clientY - touchB.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Acceleration Curve to Raw Input
    // ------------------------------------------------------------
    function Na__WalkModeTouch__ApplyAcceleration(rawValue) {
        const sign      = rawValue < 0 ? -1 : 1;
        const magnitude = Math.abs(rawValue);
        const curved    = Math.pow(magnitude, Na__WalkModeTouch__ACCELERATION_EXPONENT);
        return sign * Math.min(curved, Na__WalkModeTouch__MAX_MOVEMENT_INPUT);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Smooth Input Value Toward Target
    // ------------------------------------------------------------
    function Na__WalkModeTouch__SmoothValue(current, target) {
        return current + (target - current) * Na__WalkModeTouch__SMOOTHING_FACTOR;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touch Event Handlers
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Handle Touch Start
    // ------------------------------------------------------------
    function Na__WalkModeTouch__OnTouchStart(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            Na__WalkModeTouch__ActiveTouches.set(touch.identifier, {
                startX : touch.clientX,
                startY : touch.clientY,
                lastX  : touch.clientX,
                lastY  : touch.clientY
            });
        }

        if (Na__WalkModeTouch__ActiveTouches.size === 2) {
            const touchIds  = Array.from(Na__WalkModeTouch__ActiveTouches.keys());
            const touchA    = Na__WalkModeTouch__GetTouchById(event.touches, touchIds[0]);
            const touchB    = Na__WalkModeTouch__GetTouchById(event.touches, touchIds[1]);

            if (touchA && touchB) {
                Na__WalkModeTouch__PinchStartDistance = Na__WalkModeTouch__GetTouchDistance(touchA, touchB);
                Na__WalkModeTouch__PinchActive = true;
            }
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Touch Move
    // ------------------------------------------------------------
    function Na__WalkModeTouch__OnTouchMove(event) {
        event.preventDefault();

        const touchCount = Na__WalkModeTouch__ActiveTouches.size;

        if (touchCount === 1) {
            Na__WalkModeTouch__HandleSingleFingerMove(event);
        } else if (touchCount === 2) {
            Na__WalkModeTouch__HandleTwoFingerMove(event);
        }

        for (const touch of event.changedTouches) {
            const tracked = Na__WalkModeTouch__ActiveTouches.get(touch.identifier);
            if (tracked) {
                tracked.lastX = touch.clientX;
                tracked.lastY = touch.clientY;
            }
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Touch End
    // ------------------------------------------------------------
    function Na__WalkModeTouch__OnTouchEnd(event) {
        event.preventDefault();

        for (const touch of event.changedTouches) {
            Na__WalkModeTouch__ActiveTouches.delete(touch.identifier);
        }

        if (Na__WalkModeTouch__ActiveTouches.size < 2) {
            Na__WalkModeTouch__PinchActive = false;
            Na__WalkModeTouch__PinchStartDistance = 0;
        }

        if (Na__WalkModeTouch__ActiveTouches.size === 0) {
            Na__WalkModeTouch__SmoothedForward = 0;
            Na__WalkModeTouch__SmoothedStrafe  = 0;
            Na__WalkMode__SetMovementInput(0, 0, false);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Processing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Find Touch by ID in TouchList
    // ------------------------------------------------------------
    function Na__WalkModeTouch__GetTouchById(touchList, touchId) {
        for (let i = 0; i < touchList.length; i++) {
            if (touchList[i].identifier === touchId) {
                return touchList[i];
            }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Process Single Finger Drag (Directional Movement)
    // ------------------------------------------------------------
    function Na__WalkModeTouch__HandleSingleFingerMove(event) {
        const touch   = event.changedTouches[0];
        const tracked = Na__WalkModeTouch__ActiveTouches.get(touch.identifier);
        if (!tracked) return;

        const deltaX = touch.clientX - tracked.startX;
        const deltaY = touch.clientY - tracked.startY;

        if (Math.abs(deltaX) < Na__WalkModeTouch__DEAD_ZONE_PX &&
            Math.abs(deltaY) < Na__WalkModeTouch__DEAD_ZONE_PX) {
            return;
        }

        const rawForward = -deltaY * Na__WalkModeTouch__MOVEMENT_SCALE;
        const rawStrafe  = deltaX * Na__WalkModeTouch__MOVEMENT_SCALE;

        const targetForward = Na__WalkModeTouch__ApplyAcceleration(rawForward);
        const targetStrafe  = Na__WalkModeTouch__ApplyAcceleration(rawStrafe);

        Na__WalkModeTouch__SmoothedForward = Na__WalkModeTouch__SmoothValue(Na__WalkModeTouch__SmoothedForward, targetForward);
        Na__WalkModeTouch__SmoothedStrafe  = Na__WalkModeTouch__SmoothValue(Na__WalkModeTouch__SmoothedStrafe, targetStrafe);

        Na__WalkMode__SetMovementInput(Na__WalkModeTouch__SmoothedForward, Na__WalkModeTouch__SmoothedStrafe, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Process Two Finger Drag (Head Rotation) and Pinch (Movement)
    // ------------------------------------------------------------
    function Na__WalkModeTouch__HandleTwoFingerMove(event) {
        const touchIds = Array.from(Na__WalkModeTouch__ActiveTouches.keys());
        if (touchIds.length < 2) return;

        const touchA = Na__WalkModeTouch__GetTouchById(event.touches, touchIds[0]);
        const touchB = Na__WalkModeTouch__GetTouchById(event.touches, touchIds[1]);
        if (!touchA || !touchB) return;

        const trackedA = Na__WalkModeTouch__ActiveTouches.get(touchIds[0]);
        const trackedB = Na__WalkModeTouch__ActiveTouches.get(touchIds[1]);
        if (!trackedA || !trackedB) return;

        const avgDeltaX = ((touchA.clientX - trackedA.lastX) + (touchB.clientX - trackedB.lastX)) * 0.5;
        const avgDeltaY = ((touchA.clientY - trackedA.lastY) + (touchB.clientY - trackedB.lastY)) * 0.5;

        const yawDelta   = avgDeltaX * Na__WalkModeTouch__LOOK_SENSITIVITY;
        const pitchDelta = avgDeltaY * Na__WalkModeTouch__LOOK_SENSITIVITY;

        Na__WalkMode__AccumulateLookInput(yawDelta, pitchDelta);

        if (Na__WalkModeTouch__PinchActive) {
            const currentDistance = Na__WalkModeTouch__GetTouchDistance(touchA, touchB);
            const pinchDelta      = currentDistance - Na__WalkModeTouch__PinchStartDistance;

            const pinchForward = pinchDelta * Na__WalkModeTouch__PINCH_MOVEMENT_SCALE;

            Na__WalkModeTouch__SmoothedForward = Na__WalkModeTouch__SmoothValue(
                Na__WalkModeTouch__SmoothedForward,
                Na__WalkModeTouch__ApplyAcceleration(pinchForward)
            );

            Na__WalkMode__SetMovementInput(Na__WalkModeTouch__SmoothedForward, Na__WalkModeTouch__SmoothedStrafe, false);

            Na__WalkModeTouch__PinchStartDistance = currentDistance;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate
// -----------------------------------------------------------------------------

    // FUNCTION | Activate Touch Screen Controls
    // ------------------------------------------------------------
    function Na__WalkModeTouch__Activate(domElement, config) {
        if (Na__WalkModeTouch__Active) return;

        Na__WalkModeTouch__DomElement = domElement;

        Na__WalkModeTouch__ActiveTouches.clear();
        Na__WalkModeTouch__SmoothedForward     = 0;
        Na__WalkModeTouch__SmoothedStrafe      = 0;
        Na__WalkModeTouch__PinchActive         = false;
        Na__WalkModeTouch__PinchStartDistance   = 0;

        domElement.addEventListener('touchstart', Na__WalkModeTouch__OnTouchStart, { passive: false });
        domElement.addEventListener('touchmove',  Na__WalkModeTouch__OnTouchMove,  { passive: false });
        domElement.addEventListener('touchend',   Na__WalkModeTouch__OnTouchEnd,   { passive: false });
        domElement.addEventListener('touchcancel', Na__WalkModeTouch__OnTouchEnd,  { passive: false });

        Na__WalkModeTouch__Active = true;
        console.log('[WalkMode Touch] Touch screen controls activated');
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Touch Screen Controls
    // ------------------------------------------------------------
    function Na__WalkModeTouch__Deactivate() {
        if (!Na__WalkModeTouch__Active) return;

        if (Na__WalkModeTouch__DomElement) {
            Na__WalkModeTouch__DomElement.removeEventListener('touchstart', Na__WalkModeTouch__OnTouchStart);
            Na__WalkModeTouch__DomElement.removeEventListener('touchmove',  Na__WalkModeTouch__OnTouchMove);
            Na__WalkModeTouch__DomElement.removeEventListener('touchend',   Na__WalkModeTouch__OnTouchEnd);
            Na__WalkModeTouch__DomElement.removeEventListener('touchcancel', Na__WalkModeTouch__OnTouchEnd);
        }

        Na__WalkModeTouch__ActiveTouches.clear();
        Na__WalkModeTouch__SmoothedForward   = 0;
        Na__WalkModeTouch__SmoothedStrafe    = 0;
        Na__WalkMode__SetMovementInput(0, 0, false);

        Na__WalkModeTouch__Active = false;
        console.log('[WalkMode Touch] Touch screen controls deactivated');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Touch Screen Controls Public API
    // ------------------------------------------------------------
    export {
        Na__WalkModeTouch__Activate,
        Na__WalkModeTouch__Deactivate
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

