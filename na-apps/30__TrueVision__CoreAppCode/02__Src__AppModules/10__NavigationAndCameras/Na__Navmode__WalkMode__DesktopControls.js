// =============================================================================
// TRUEVISION3D - WALK MODE DESKTOP CONTROLS
// =============================================================================
//
// FILE       : Na__Navmode__WalkMode__DesktopControls.js
// NAMESPACE  : TrueVision3D
// MODULE     : Walk Mode Navigation - Desktop Controls (Mouse + Keyboard)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-person keyboard and mouse input for walk mode on desktop
// CREATED    : 23-Feb-2026
//
// DESCRIPTION:
// - Handles WASD + Arrow key directional movement input.
// - Manages Pointer Lock API for mouse look (yaw + pitch).
// - Shift key for sprint modifier.
// - Feeds input values to the WalkMode SystemLogic module via setters.
// - Completely independent from orbit mode mouse/keyboard controls.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Feb-2026 - Version 1.0.0
// - Initial implementation of desktop walk mode controls.
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
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Configuration
    // ------------------------------------------------------------
    let Na__WalkModeDesktop__MouseSensitivity              = 0.002;      // <-- Mouse look sensitivity (overridden by config)
    let Na__WalkModeDesktop__Active                        = false;      // <-- Desktop controls active flag
    let Na__WalkModeDesktop__DomElement                    = null;       // <-- Canvas DOM element for pointer lock
    // ------------------------------------------------------------


    // MODULE VARIABLES | Keyboard State
    // ------------------------------------------------------------
    const Na__WalkModeDesktop__KeyState = {
        w          : false,                                              // <-- Forward
        a          : false,                                              // <-- Strafe left
        s          : false,                                              // <-- Backward
        d          : false,                                              // <-- Strafe right
        arrowup    : false,                                              // <-- Forward (alt)
        arrowdown  : false,                                              // <-- Backward (alt)
        arrowleft  : false,                                              // <-- Strafe left (alt)
        arrowright : false,                                              // <-- Strafe right (alt)
        shift      : false                                               // <-- Sprint modifier
    };
    // ------------------------------------------------------------


    // MODULE VARIABLES | Pointer Lock State
    // ------------------------------------------------------------
    let Na__WalkModeDesktop__PointerLocked                 = false;      // <-- Pointer lock active
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard Input Handlers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Handle Key Down Event
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnKeyDown(event) {
        const key = event.key.toLowerCase();

        if (Na__WalkModeDesktop__KeyState.hasOwnProperty(key)) {
            Na__WalkModeDesktop__KeyState[key] = true;
        }

        Na__WalkModeDesktop__UpdateMovementInput();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Key Up Event
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnKeyUp(event) {
        const key = event.key.toLowerCase();

        if (Na__WalkModeDesktop__KeyState.hasOwnProperty(key)) {
            Na__WalkModeDesktop__KeyState[key] = false;
        }

        Na__WalkModeDesktop__UpdateMovementInput();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute and Push Movement Input to System Logic
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__UpdateMovementInput() {
        let forward = 0;
        let strafe  = 0;

        if (Na__WalkModeDesktop__KeyState.w || Na__WalkModeDesktop__KeyState.arrowup)    forward += 1;
        if (Na__WalkModeDesktop__KeyState.s || Na__WalkModeDesktop__KeyState.arrowdown)  forward -= 1;
        if (Na__WalkModeDesktop__KeyState.d || Na__WalkModeDesktop__KeyState.arrowright) strafe  += 1;
        if (Na__WalkModeDesktop__KeyState.a || Na__WalkModeDesktop__KeyState.arrowleft)  strafe  -= 1;

        const sprint = Na__WalkModeDesktop__KeyState.shift;

        Na__WalkMode__SetMovementInput(forward, strafe, sprint);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mouse Look via Pointer Lock
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Handle Mouse Movement (Pointer Lock Active)
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnMouseMove(event) {
        if (!Na__WalkModeDesktop__PointerLocked) return;

        const yawDelta   = event.movementX * Na__WalkModeDesktop__MouseSensitivity;
        const pitchDelta = event.movementY * Na__WalkModeDesktop__MouseSensitivity;

        Na__WalkMode__AccumulateLookInput(yawDelta, pitchDelta);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Pointer Lock Change
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnPointerLockChange() {
        Na__WalkModeDesktop__PointerLocked = (document.pointerLockElement === Na__WalkModeDesktop__DomElement);

        if (!Na__WalkModeDesktop__PointerLocked && Na__WalkModeDesktop__Active) {
            console.log('[WalkMode Desktop] Pointer lock released');
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Request Pointer Lock on Canvas Click
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnCanvasClick() {
        if (!Na__WalkModeDesktop__Active) return;
        if (Na__WalkModeDesktop__PointerLocked) return;

        if (Na__WalkModeDesktop__DomElement && Na__WalkModeDesktop__DomElement.requestPointerLock) {
            Na__WalkModeDesktop__DomElement.requestPointerLock();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate
// -----------------------------------------------------------------------------

    // FUNCTION | Activate Desktop Controls
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__Activate(domElement, config) {
        if (Na__WalkModeDesktop__Active) return;

        Na__WalkModeDesktop__DomElement = domElement;

        if (config && Number.isFinite(config.mouseSensitivity)) {
            Na__WalkModeDesktop__MouseSensitivity = config.mouseSensitivity;
        }

        Object.keys(Na__WalkModeDesktop__KeyState).forEach((key) => {
            Na__WalkModeDesktop__KeyState[key] = false;
        });

        window.addEventListener('keydown', Na__WalkModeDesktop__OnKeyDown);
        window.addEventListener('keyup', Na__WalkModeDesktop__OnKeyUp);
        document.addEventListener('mousemove', Na__WalkModeDesktop__OnMouseMove);
        document.addEventListener('pointerlockchange', Na__WalkModeDesktop__OnPointerLockChange);
        domElement.addEventListener('click', Na__WalkModeDesktop__OnCanvasClick);

        if (domElement.requestPointerLock) {
            domElement.requestPointerLock();
        }

        Na__WalkModeDesktop__Active = true;
        console.log('[WalkMode Desktop] Desktop controls activated');
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Desktop Controls
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__Deactivate() {
        if (!Na__WalkModeDesktop__Active) return;

        window.removeEventListener('keydown', Na__WalkModeDesktop__OnKeyDown);
        window.removeEventListener('keyup', Na__WalkModeDesktop__OnKeyUp);
        document.removeEventListener('mousemove', Na__WalkModeDesktop__OnMouseMove);
        document.removeEventListener('pointerlockchange', Na__WalkModeDesktop__OnPointerLockChange);

        if (Na__WalkModeDesktop__DomElement) {
            Na__WalkModeDesktop__DomElement.removeEventListener('click', Na__WalkModeDesktop__OnCanvasClick);
        }

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        Object.keys(Na__WalkModeDesktop__KeyState).forEach((key) => {
            Na__WalkModeDesktop__KeyState[key] = false;
        });
        Na__WalkMode__SetMovementInput(0, 0, false);

        Na__WalkModeDesktop__PointerLocked = false;
        Na__WalkModeDesktop__Active = false;
        console.log('[WalkMode Desktop] Desktop controls deactivated');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Desktop Controls Public API
    // ------------------------------------------------------------
    export {
        Na__WalkModeDesktop__Activate,
        Na__WalkModeDesktop__Deactivate
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

