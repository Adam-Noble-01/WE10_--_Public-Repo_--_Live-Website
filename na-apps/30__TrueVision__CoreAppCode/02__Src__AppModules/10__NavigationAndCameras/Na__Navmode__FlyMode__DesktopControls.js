// =============================================================================
// TRUEVISION3D - FLY MODE DESKTOP CONTROLS
// =============================================================================
//
// FILE       : Na__Navmode__FlyMode__DesktopControls.js
// NAMESPACE  : TrueVision3D
// MODULE     : Fly Mode Navigation - Desktop Controls (Mouse + Keyboard)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-person keyboard and mouse input for fly mode on desktop
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Maps a standard architectural/FPS keyboard layout onto fly mode:
//     W / ArrowUp        -> Forward
//     S / ArrowDown      -> Backward
//     A / ArrowLeft      -> Strafe Left
//     D / ArrowRight     -> Strafe Right
//     Q / PageDown / C   -> Descend (move down on world Y)
//     E / PageUp / Space -> Ascend  (move up on world Y)
//     Shift              -> Boost speed multiplier
//     Alt                -> Slow / precision multiplier
//     Mouse (pointer lock)-> Yaw + pitch look (FPS-style)
// - Pointer lock is requested automatically on activate and on canvas click.
//   If the browser denies pointer lock, no mouse look will be applied, but
//   keyboard movement still works (so the user is never stranded).
// - All inputs are pushed into the SystemLogic module via setters - this module
//   holds no THREE.js or physics state.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Initial implementation of desktop fly mode controls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Fly Mode System Logic Setters
    // ------------------------------------------------------------
    import {
        Na__FlyMode__SetMovementInput,
        Na__FlyMode__SetSpeedModifiers,
        Na__FlyMode__AccumulateLookInput
    } from './Na__Navmode__FlyMode__SystemLogic.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Configuration
    // ------------------------------------------------------------
    let Na__FlyModeDesktop__MouseSensitivity                 = 0.0018;     // <-- Mouse look sensitivity (radians/pixel)
    let Na__FlyModeDesktop__Active                           = false;      // <-- Desktop controls active flag
    let Na__FlyModeDesktop__DomElement                       = null;       // <-- Canvas DOM element for pointer lock
    // ------------------------------------------------------------


    // MODULE VARIABLES | Keyboard State
    // ------------------------------------------------------------
    // Note: keys are stored in lowercase form so the key map below matches
    // the result of event.key.toLowerCase().  Browser key names that contain
    // mixed case (ArrowUp, PageDown, Space, Shift, Control, Alt) all
    // lowercase cleanly except 'Control' which is stored as 'control'.
    // ------------------------------------------------------------
    const Na__FlyModeDesktop__KeyState = {
        w          : false,                                              // <-- Forward
        a          : false,                                              // <-- Strafe left
        s          : false,                                              // <-- Backward
        d          : false,                                              // <-- Strafe right
        q          : false,                                              // <-- Descend
        e          : false,                                              // <-- Ascend
        c          : false,                                              // <-- Descend (alt)
        arrowup    : false,                                              // <-- Forward (alt)
        arrowdown  : false,                                              // <-- Backward (alt)
        arrowleft  : false,                                              // <-- Strafe left (alt)
        arrowright : false,                                              // <-- Strafe right (alt)
        pageup     : false,                                              // <-- Ascend (alt)
        pagedown   : false,                                              // <-- Descend (alt)
        ' '        : false,                                              // <-- Ascend (Space)
        shift      : false,                                              // <-- Boost modifier
        alt        : false                                               // <-- Slow / precision modifier
    };
    // ------------------------------------------------------------


    // MODULE VARIABLES | Pointer Lock State
    // ------------------------------------------------------------
    let Na__FlyModeDesktop__PointerLocked                    = false;      // <-- Pointer lock active
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keyboard Input Handlers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Should This Key Trigger Browser Default Suppression?
    // ------------------------------------------------------------
    // Arrow keys and Space cause page scroll/control-activation by default.
    // While fly mode owns the keyboard we suppress that browser behaviour.
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__ShouldPreventDefault(key) {
        return key === 'arrowup'
            || key === 'arrowdown'
            || key === 'arrowleft'
            || key === 'arrowright'
            || key === 'pageup'
            || key === 'pagedown'
            || key === ' ';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Key Down Event
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnKeyDown(event) {
        const key = event.key.toLowerCase();

        if (Na__FlyModeDesktop__KeyState.hasOwnProperty(key)) {
            Na__FlyModeDesktop__KeyState[key] = true;
            if (Na__FlyModeDesktop__ShouldPreventDefault(key)) {
                event.preventDefault();
            }
        }

        Na__FlyModeDesktop__UpdateMovementInput();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Key Up Event
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnKeyUp(event) {
        const key = event.key.toLowerCase();

        if (Na__FlyModeDesktop__KeyState.hasOwnProperty(key)) {
            Na__FlyModeDesktop__KeyState[key] = false;
        }

        Na__FlyModeDesktop__UpdateMovementInput();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute and Push Movement / Modifier Input to System Logic
    // ------------------------------------------------------------
    // Translates the raw key state into three normalised axes (forward,
    // strafe, vertical) plus the boost/slow modifier flags.  Diagonal motion
    // is intentionally left as a sum (max magnitude sqrt(2)); the SystemLogic
    // damping smooths it and the user experience matches every other FPS-style
    // viewer.  Keeping the input strictly per-axis (not normalised) preserves
    // the "lean diagonally for faster motion" feel power users expect.
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__UpdateMovementInput() {
        const ks = Na__FlyModeDesktop__KeyState;

        let forward  = 0;
        let strafe   = 0;
        let vertical = 0;

        if (ks.w || ks.arrowup)    forward  += 1;
        if (ks.s || ks.arrowdown)  forward  -= 1;
        if (ks.d || ks.arrowright) strafe   += 1;
        if (ks.a || ks.arrowleft)  strafe   -= 1;
        if (ks.e || ks.pageup || ks[' ']) vertical += 1;
        if (ks.q || ks.pagedown || ks.c)  vertical -= 1;

        Na__FlyMode__SetMovementInput(forward, strafe, vertical);
        Na__FlyMode__SetSpeedModifiers(ks.shift, ks.alt);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mouse Look via Pointer Lock
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Handle Mouse Movement While Pointer Lock Is Active
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnMouseMove(event) {
        if (!Na__FlyModeDesktop__PointerLocked) return;

        const yawDelta   = event.movementX * Na__FlyModeDesktop__MouseSensitivity;
        const pitchDelta = event.movementY * Na__FlyModeDesktop__MouseSensitivity;

        Na__FlyMode__AccumulateLookInput(yawDelta, pitchDelta);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Pointer Lock Change Event
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnPointerLockChange() {
        Na__FlyModeDesktop__PointerLocked = (document.pointerLockElement === Na__FlyModeDesktop__DomElement);

        if (!Na__FlyModeDesktop__PointerLocked && Na__FlyModeDesktop__Active) {
            console.log('[FlyMode Desktop] Pointer lock released');
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Request Pointer Lock on Canvas Click
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnCanvasClick() {
        if (!Na__FlyModeDesktop__Active) return;
        if (Na__FlyModeDesktop__PointerLocked) return;

        if (Na__FlyModeDesktop__DomElement && Na__FlyModeDesktop__DomElement.requestPointerLock) {
            Na__FlyModeDesktop__DomElement.requestPointerLock();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Activate / Deactivate
// -----------------------------------------------------------------------------

    // FUNCTION | Activate Desktop Controls (Bind Listeners + Request Pointer Lock)
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__Activate(domElement, config) {
        if (Na__FlyModeDesktop__Active) return;

        Na__FlyModeDesktop__DomElement = domElement;

        if (config && Number.isFinite(config.mouseSensitivity)) {
            Na__FlyModeDesktop__MouseSensitivity = config.mouseSensitivity;
        }

        Object.keys(Na__FlyModeDesktop__KeyState).forEach((key) => {
            Na__FlyModeDesktop__KeyState[key] = false;
        });

        window.addEventListener('keydown', Na__FlyModeDesktop__OnKeyDown);
        window.addEventListener('keyup', Na__FlyModeDesktop__OnKeyUp);
        document.addEventListener('mousemove', Na__FlyModeDesktop__OnMouseMove);
        document.addEventListener('pointerlockchange', Na__FlyModeDesktop__OnPointerLockChange);
        domElement.addEventListener('click', Na__FlyModeDesktop__OnCanvasClick);

        if (domElement.requestPointerLock) {
            domElement.requestPointerLock();
        }

        Na__FlyModeDesktop__Active = true;
        console.log('[FlyMode Desktop] Desktop controls activated');
    }
    // ------------------------------------------------------------


    // FUNCTION | Deactivate Desktop Controls (Release Listeners + Pointer Lock)
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__Deactivate() {
        if (!Na__FlyModeDesktop__Active) return;

        window.removeEventListener('keydown', Na__FlyModeDesktop__OnKeyDown);
        window.removeEventListener('keyup', Na__FlyModeDesktop__OnKeyUp);
        document.removeEventListener('mousemove', Na__FlyModeDesktop__OnMouseMove);
        document.removeEventListener('pointerlockchange', Na__FlyModeDesktop__OnPointerLockChange);

        if (Na__FlyModeDesktop__DomElement) {
            Na__FlyModeDesktop__DomElement.removeEventListener('click', Na__FlyModeDesktop__OnCanvasClick);
        }

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        Object.keys(Na__FlyModeDesktop__KeyState).forEach((key) => {
            Na__FlyModeDesktop__KeyState[key] = false;
        });
        Na__FlyMode__SetMovementInput(0, 0, 0);
        Na__FlyMode__SetSpeedModifiers(false, false);

        Na__FlyModeDesktop__PointerLocked = false;
        Na__FlyModeDesktop__Active = false;
        console.log('[FlyMode Desktop] Desktop controls deactivated');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Desktop Controls Public API
    // ------------------------------------------------------------
    export {
        Na__FlyModeDesktop__Activate,
        Na__FlyModeDesktop__Deactivate
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
