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
    // LOOK MODE DEFAULT | Changed 14-Aug-2026 - Adam Noble
    // ------------------------------------------------------------
    // TEMPORARY ROLLOUT. On trial as the new default rather than settled, and
    // deliberately written so it can be put back in one line.
    //
    // Ported across from ValeVision3D, which shares this navigation system.
    //
    // Walk mode originally held Pointer Lock: the cursor vanished and every
    // scrap of mouse movement turned the camera. That is the right feel for a
    // game, but it fights this app the moment anything shares the screen with
    // the viewport. Reaching for the Image Export panel, the Tools menu or the
    // Dev menu dragged the view on the way there, so the shot you had framed
    // was gone before the pointer reached the button.
    //
    // Drag look turns the camera only while the left mouse button is held. The
    // cursor stays visible and usable, which is what makes walk and fly based
    // image exports genuinely practical: frame the viewpoint, then reach for
    // the export controls without the framing shifting between composing the
    // shot and clicking Download. That was the deciding reason for making it
    // the default.
    //
    // TO REVERT: swap the two declarations below. Nothing else needs touching.
    // Every pointer-lock path is still present and gated on this one flag.
    // ------------------------------------------------------------
    // let Na__WalkModeDesktop__DragLookEnabled            = false;      // <-- ORIGINAL: pointer lock, hidden cursor, free look
    let Na__WalkModeDesktop__DragLookEnabled               = true;       // <-- CURRENT : left-click drag to look
    let Na__WalkModeDesktop__IsDragLooking                 = false;      // <-- Left button currently held
    let Na__WalkModeDesktop__DragPointerId                 = null;       // <-- Pointer that owns the look drag
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
        // Which gate applies depends on the look mode. movementX/Y is a plain
        // MouseEvent property and is populated with or without pointer lock, so
        // the delta maths below is identical either way.
        const shouldLook = Na__WalkModeDesktop__DragLookEnabled
            ? Na__WalkModeDesktop__IsDragLooking
            : Na__WalkModeDesktop__PointerLocked;

        if (!shouldLook) return;

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
        if (Na__WalkModeDesktop__DragLookEnabled) return;                 // <-- Drag look never grabs the pointer
        if (Na__WalkModeDesktop__PointerLocked) return;

        if (Na__WalkModeDesktop__DomElement && Na__WalkModeDesktop__DomElement.requestPointerLock) {
            Na__WalkModeDesktop__DomElement.requestPointerLock();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Begin a Look Drag
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnDragLookStart(event) {
        if (!Na__WalkModeDesktop__Active)          return;
        if (!Na__WalkModeDesktop__DragLookEnabled) return;
        if (event.button !== 0)                    return;                // <-- Left button only

        Na__WalkModeDesktop__IsDragLooking = true;
        Na__WalkModeDesktop__DragPointerId = event.pointerId;

        // Capture so a fast drag that leaves the canvas keeps turning the view
        // rather than stopping dead at the edge.
        if (Na__WalkModeDesktop__DomElement && Na__WalkModeDesktop__DomElement.setPointerCapture) {
            try { Na__WalkModeDesktop__DomElement.setPointerCapture(event.pointerId); } catch (captureError) { /* not capturable */ }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End a Look Drag
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__OnDragLookEnd(event) {
        if (!Na__WalkModeDesktop__IsDragLooking) return;
        if (event && Na__WalkModeDesktop__DragPointerId !== null
            && event.pointerId !== Na__WalkModeDesktop__DragPointerId) return;

        Na__WalkModeDesktop__IsDragLooking = false;

        if (event && Na__WalkModeDesktop__DomElement && Na__WalkModeDesktop__DomElement.releasePointerCapture) {
            try { Na__WalkModeDesktop__DomElement.releasePointerCapture(event.pointerId); } catch (releaseError) { /* already released */ }
        }
        Na__WalkModeDesktop__DragPointerId = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch Between Pointer Lock and Drag Look
    // ------------------------------------------------------------
    // Kept so the look mode can be driven at runtime if a panel ever needs it.
    // Safe to call whether or not walk mode is active, and safe to repeat.
    // ------------------------------------------------------------
    function Na__WalkModeDesktop__SetDragLookEnabled(enabled) {
        const next = !!enabled;
        if (next === Na__WalkModeDesktop__DragLookEnabled) return;

        Na__WalkModeDesktop__DragLookEnabled = next;

        if (next) {
            if (document.pointerLockElement) document.exitPointerLock();
            Na__WalkModeDesktop__PointerLocked = false;
        } else {
            // Going back to pointer lock needs a user gesture, so the existing
            // click-to-lock handler re-acquires it on the next canvas click.
            Na__WalkModeDesktop__IsDragLooking = false;
            Na__WalkModeDesktop__DragPointerId = null;
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

        domElement.addEventListener('pointerdown',   Na__WalkModeDesktop__OnDragLookStart);
        window.addEventListener('pointerup',         Na__WalkModeDesktop__OnDragLookEnd);
        window.addEventListener('pointercancel',     Na__WalkModeDesktop__OnDragLookEnd);

        if (!Na__WalkModeDesktop__DragLookEnabled && domElement.requestPointerLock) {
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
            Na__WalkModeDesktop__DomElement.removeEventListener('pointerdown', Na__WalkModeDesktop__OnDragLookStart);
        }
        window.removeEventListener('pointerup',     Na__WalkModeDesktop__OnDragLookEnd);
        window.removeEventListener('pointercancel', Na__WalkModeDesktop__OnDragLookEnd);

        Na__WalkModeDesktop__IsDragLooking = false;
        Na__WalkModeDesktop__DragPointerId = null;

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
        Na__WalkModeDesktop__Deactivate,
        Na__WalkModeDesktop__SetDragLookEnabled
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

