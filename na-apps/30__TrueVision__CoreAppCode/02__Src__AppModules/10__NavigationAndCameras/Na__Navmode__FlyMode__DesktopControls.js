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
    // LOOK MODE DEFAULT | Changed 14-Aug-2026 - Adam Noble
    // ------------------------------------------------------------
    // TEMPORARY ROLLOUT. On trial as the new default rather than settled, and
    // deliberately written so it can be put back in one line.
    //
    // Ported across from ValeVision3D, which shares this navigation system.
    //
    // Fly mode originally held Pointer Lock: the cursor vanished and every
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
    // let Na__FlyModeDesktop__DragLookEnabled               = false;      // <-- ORIGINAL: pointer lock, hidden cursor, free look
    let Na__FlyModeDesktop__DragLookEnabled                  = true;       // <-- CURRENT : left-click drag to look
    let Na__FlyModeDesktop__IsDragLooking                    = false;      // <-- Left button currently held
    let Na__FlyModeDesktop__DragPointerId                    = null;       // <-- Pointer that owns the look drag
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
        // Which gate applies depends on the look mode. movementX/Y is a plain
        // MouseEvent property and is populated with or without pointer lock, so
        // the delta maths below is identical either way.
        const shouldLook = Na__FlyModeDesktop__DragLookEnabled
            ? Na__FlyModeDesktop__IsDragLooking
            : Na__FlyModeDesktop__PointerLocked;

        if (!shouldLook) return;

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
        if (Na__FlyModeDesktop__DragLookEnabled) return;                  // <-- Drag look never grabs the pointer
        if (Na__FlyModeDesktop__PointerLocked) return;

        if (Na__FlyModeDesktop__DomElement && Na__FlyModeDesktop__DomElement.requestPointerLock) {
            Na__FlyModeDesktop__DomElement.requestPointerLock();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Begin a Look Drag
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnDragLookStart(event) {
        if (!Na__FlyModeDesktop__Active)          return;
        if (!Na__FlyModeDesktop__DragLookEnabled) return;
        if (event.button !== 0)                   return;                 // <-- Left button only

        Na__FlyModeDesktop__IsDragLooking = true;
        Na__FlyModeDesktop__DragPointerId = event.pointerId;

        // Capture so a fast drag that leaves the canvas keeps turning the view
        // rather than stopping dead at the edge.
        if (Na__FlyModeDesktop__DomElement && Na__FlyModeDesktop__DomElement.setPointerCapture) {
            try { Na__FlyModeDesktop__DomElement.setPointerCapture(event.pointerId); } catch (captureError) { /* not capturable */ }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End a Look Drag
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__OnDragLookEnd(event) {
        if (!Na__FlyModeDesktop__IsDragLooking) return;
        if (event && Na__FlyModeDesktop__DragPointerId !== null
            && event.pointerId !== Na__FlyModeDesktop__DragPointerId) return;

        Na__FlyModeDesktop__IsDragLooking = false;

        if (event && Na__FlyModeDesktop__DomElement && Na__FlyModeDesktop__DomElement.releasePointerCapture) {
            try { Na__FlyModeDesktop__DomElement.releasePointerCapture(event.pointerId); } catch (releaseError) { /* already released */ }
        }
        Na__FlyModeDesktop__DragPointerId = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch Between Pointer Lock and Drag Look
    // ------------------------------------------------------------
    // Kept so the look mode can be driven at runtime if a panel ever needs it.
    // Safe to call whether or not fly mode is active, and safe to repeat.
    // ------------------------------------------------------------
    function Na__FlyModeDesktop__SetDragLookEnabled(enabled) {
        const next = !!enabled;
        if (next === Na__FlyModeDesktop__DragLookEnabled) return;

        Na__FlyModeDesktop__DragLookEnabled = next;

        if (next) {
            if (document.pointerLockElement) document.exitPointerLock();
            Na__FlyModeDesktop__PointerLocked = false;
        } else {
            // Going back to pointer lock needs a user gesture, so the existing
            // click-to-lock handler re-acquires it on the next canvas click.
            Na__FlyModeDesktop__IsDragLooking = false;
            Na__FlyModeDesktop__DragPointerId = null;
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

        domElement.addEventListener('pointerdown',   Na__FlyModeDesktop__OnDragLookStart);
        window.addEventListener('pointerup',         Na__FlyModeDesktop__OnDragLookEnd);
        window.addEventListener('pointercancel',     Na__FlyModeDesktop__OnDragLookEnd);

        if (!Na__FlyModeDesktop__DragLookEnabled && domElement.requestPointerLock) {
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
            Na__FlyModeDesktop__DomElement.removeEventListener('pointerdown', Na__FlyModeDesktop__OnDragLookStart);
        }
        window.removeEventListener('pointerup',     Na__FlyModeDesktop__OnDragLookEnd);
        window.removeEventListener('pointercancel', Na__FlyModeDesktop__OnDragLookEnd);

        Na__FlyModeDesktop__IsDragLooking = false;
        Na__FlyModeDesktop__DragPointerId = null;

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
        Na__FlyModeDesktop__Deactivate,
        Na__FlyModeDesktop__SetDragLookEnabled
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
