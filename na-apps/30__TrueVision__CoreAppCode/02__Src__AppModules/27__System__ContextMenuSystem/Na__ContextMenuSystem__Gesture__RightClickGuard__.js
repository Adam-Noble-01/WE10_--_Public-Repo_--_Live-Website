// =============================================================================
// TRUEVISION3D - CONTEXT MENU SYSTEM - RIGHT CLICK GESTURE GUARD
// =============================================================================
//
// FILE       : Na__ContextMenuSystem__Gesture__RightClickGuard__.js
// NAMESPACE  : Na__ContextMenu
// MODULE     : Context Menu System - Right Click Gesture Guard
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide whether a right mouse press was a menu click or a pan
// CREATED    : 30-Aug-2026
//
// DESCRIPTION:
// - The right mouse button is the Orbit navigation PAN gesture. That gesture is
//   sacred: this module exists so the context menu can never interfere with it.
// - It is a pure observer. It adds no preventDefault of its own on the pointer
//   events, never calls stopPropagation, and never touches OrbitControls. The
//   event stream OrbitControls receives is byte-for-byte what it received
//   before this system existed.
// - The guard is a LATCH, not a comparison. Once pointer travel exceeds the
//   configured threshold the press is disqualified for good; returning the
//   pointer to its origin cannot re-arm it. A pan that happens to end where it
//   started therefore still suppresses the menu.
// - Anything that suggests the user is doing something other than a deliberate
//   stationary click disarms it too: a second mouse button, a wheel tick, the
//   window losing focus, a tab switch, or a key press.
//
// LISTENER ORDERING NOTE:
// - OrbitControls registers its own 'contextmenu' handler (which calls
//   preventDefault) when it is constructed at boot, i.e. BEFORE this module
//   registers. Both handlers run; ours only reads the armed latch and reports.
//   The browser's native menu stays suppressed either way.
//
// INTEGRATION:
// - Initialized by Na__ContextMenuSystem__SystemLogic__.js with the renderer
//   DOM element, the resolved config block, and an onQualifiedRightClick
//   callback plus an isNavModeArmed predicate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.0.0
// - Initial implementation. Travel-latch guard with multi-signal disarm.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Gesture Defaults (Overridden by AppConfig)
    // ------------------------------------------------------------
    const Na__CtxGesture__DEFAULT_MAX_TRAVEL_PX = 3;                             // <-- Total travel tolerated before the latch trips
    const Na__CtxGesture__DEFAULT_MAX_HOLD_MS   = 0;                             // <-- 0 disables the hold-duration check
    const Na__CtxGesture__RIGHT_BUTTON          = 2;                             // <-- PointerEvent.button code for the right button
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State (Private)
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Guard Configuration
    // ------------------------------------------------------------
    let Na__CtxGesture__MaxTravelPx   = Na__CtxGesture__DEFAULT_MAX_TRAVEL_PX;   // <-- Travel latch threshold
    let Na__CtxGesture__MaxHoldMs     = Na__CtxGesture__DEFAULT_MAX_HOLD_MS;     // <-- Optional hold-duration ceiling
    let Na__CtxGesture__MouseOnly     = true;                                    // <-- Reject pen and touch pointer types
    // ------------------------------------------------------------


    // MODULE VARIABLES | Live Press State
    // ------------------------------------------------------------
    let Na__CtxGesture__IsArmed       = false;                                   // <-- True while the current press still qualifies
    let Na__CtxGesture__PressOriginX  = 0;                                       // <-- Pointer X at right-button pointerdown
    let Na__CtxGesture__PressOriginY  = 0;                                       // <-- Pointer Y at right-button pointerdown
    let Na__CtxGesture__PressStartMs  = 0;                                       // <-- performance.now() at pointerdown
    // ------------------------------------------------------------


    // MODULE VARIABLES | Host Wiring
    // ------------------------------------------------------------
    let Na__CtxGesture__DomElement            = null;                            // <-- Renderer canvas
    let Na__CtxGesture__OnQualifiedRightClick = null;                            // <-- Fired only for a qualifying press
    let Na__CtxGesture__IsNavModeArmed        = null;                            // <-- Predicate: is the current nav mode eligible
    let Na__CtxGesture__IsWired               = false;                           // <-- Guard against duplicate listener sets
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Latch Control
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Disarm the Latch for the Remainder of This Press
    // ------------------------------------------------------------
    // Deliberately one-way. Nothing in this module re-arms an existing press;
    // only a fresh right-button pointerdown can arm a new one.
    // ------------------------------------------------------------
    function Na__CtxGesture__Disarm() {
        Na__CtxGesture__IsArmed = false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has the Pointer Travelled Beyond the Threshold?
    // ------------------------------------------------------------
    function Na__CtxGesture__HasExceededTravel(clientX, clientY) {
        const deltaX = Math.abs(clientX - Na__CtxGesture__PressOriginX);         // <-- Horizontal travel since pointerdown
        const deltaY = Math.abs(clientY - Na__CtxGesture__PressOriginY);         // <-- Vertical travel since pointerdown

        return deltaX > Na__CtxGesture__MaxTravelPx
            || deltaY > Na__CtxGesture__MaxTravelPx;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has the Press Been Held Longer Than Permitted?
    // ------------------------------------------------------------
    function Na__CtxGesture__HasExceededHold() {
        if (!Number.isFinite(Na__CtxGesture__MaxHoldMs)) return false;
        if (Na__CtxGesture__MaxHoldMs <= 0)              return false;           // <-- 0 disables the check

        return (performance.now() - Na__CtxGesture__PressStartMs) > Na__CtxGesture__MaxHoldMs;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers (Observers Only - Never Mutate the Event)
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Pointer Down - Arm on a Clean Right Button Press
    // ------------------------------------------------------------
    function Na__CtxGesture__OnPointerDown(event) {
        // A second button joining an armed press means the user is doing
        // something compound; that is never a plain context click.
        if (event.button !== Na__CtxGesture__RIGHT_BUTTON) {
            Na__CtxGesture__Disarm();
            return;
        }

        if (Na__CtxGesture__MouseOnly && event.pointerType !== 'mouse') {
            Na__CtxGesture__Disarm();                                            // <-- Touch and pen are out of scope
            return;
        }

        if (typeof Na__CtxGesture__IsNavModeArmed === 'function'
            && Na__CtxGesture__IsNavModeArmed() !== true) {
            Na__CtxGesture__Disarm();                                            // <-- Wrong navigation mode
            return;
        }

        Na__CtxGesture__PressOriginX = event.clientX;                            // <-- Record the origin to measure travel from
        Na__CtxGesture__PressOriginY = event.clientY;
        Na__CtxGesture__PressStartMs = performance.now();
        Na__CtxGesture__IsArmed      = true;                                     // <-- Provisionally a menu click
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Move - Trip the Travel Latch
    // ------------------------------------------------------------
    // Bound on window rather than the canvas so a pan that drags off the canvas
    // still disarms. Cheap early-out keeps this off the hot path when idle.
    // ------------------------------------------------------------
    function Na__CtxGesture__OnPointerMove(event) {
        if (!Na__CtxGesture__IsArmed) return;                                    // <-- Nothing to protect

        if (Na__CtxGesture__HasExceededTravel(event.clientX, event.clientY)) {
            Na__CtxGesture__Disarm();                                            // <-- Latched off: this press is a pan
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Up - Apply the Optional Hold-Duration Ceiling
    // ------------------------------------------------------------
    function Na__CtxGesture__OnPointerUp(event) {
        if (!Na__CtxGesture__IsArmed) return;
        if (event.button !== Na__CtxGesture__RIGHT_BUTTON) return;               // <-- Not our button releasing

        if (Na__CtxGesture__HasExceededTravel(event.clientX, event.clientY)
            || Na__CtxGesture__HasExceededHold()) {
            Na__CtxGesture__Disarm();                                            // <-- Final travel and hold check
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Context Menu - Report a Qualifying Press
    // ------------------------------------------------------------
    // Fires after pointerup, so by this point the latch reflects the whole
    // press. We never preventDefault here: OrbitControls already suppresses the
    // native menu, and suppressing it ourselves when we are NOT opening would
    // change behaviour the app has today.
    // ------------------------------------------------------------
    function Na__CtxGesture__OnContextMenu(event) {
        const wasArmed = Na__CtxGesture__IsArmed;
        Na__CtxGesture__Disarm();                                                // <-- Always consume the press

        if (!wasArmed) return;                                                   // <-- Panned, wrong mode, or wrong device
        if (typeof Na__CtxGesture__OnQualifiedRightClick !== 'function') return;

        Na__CtxGesture__OnQualifiedRightClick(event);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Ambient Disarm Signals
    // ------------------------------------------------------------
    function Na__CtxGesture__OnAmbientDisarm() {
        Na__CtxGesture__Disarm();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Gesture Configuration from AppConfig
    // ------------------------------------------------------------
    function Na__ContextMenu__Gesture__ApplyConfig(gestureConfig) {
        if (!gestureConfig) return;

        const travelPx = gestureConfig['ContextMenu__Gesture__MaxTravelPx'];
        if (Number.isFinite(travelPx) && travelPx >= 0) {
            Na__CtxGesture__MaxTravelPx = travelPx;
        }

        const holdMs = gestureConfig['ContextMenu__Gesture__MaxHoldMs'];
        if (Number.isFinite(holdMs) && holdMs >= 0) {
            Na__CtxGesture__MaxHoldMs = holdMs;
        }

        if (typeof gestureConfig['ContextMenu__Gesture__MouseOnly'] === 'boolean') {
            Na__CtxGesture__MouseOnly = gestureConfig['ContextMenu__Gesture__MouseOnly'];
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Right Click Gesture Guard
    // ------------------------------------------------------------
    function Na__ContextMenu__Gesture__Initialize(domElement, gestureConfig, callbacks) {
        if (Na__CtxGesture__IsWired) return true;                                // <-- Already listening
        if (!domElement)             return false;

        Na__ContextMenu__Gesture__ApplyConfig(gestureConfig);

        Na__CtxGesture__DomElement            = domElement;
        Na__CtxGesture__OnQualifiedRightClick = callbacks && callbacks.onQualifiedRightClick;
        Na__CtxGesture__IsNavModeArmed        = callbacks && callbacks.isNavModeArmed;

        // POINTER LIFECYCLE | Canvas-scoped down, window-scoped move and up so a
        // drag leaving the canvas still disqualifies the press.
        domElement.addEventListener('pointerdown', Na__CtxGesture__OnPointerDown);
        window.addEventListener('pointermove',     Na__CtxGesture__OnPointerMove);
        window.addEventListener('pointerup',       Na__CtxGesture__OnPointerUp);
        window.addEventListener('pointercancel',   Na__CtxGesture__OnAmbientDisarm);
        domElement.addEventListener('contextmenu', Na__CtxGesture__OnContextMenu);

        // AMBIENT DISARM | Any of these means the press is no longer a plain click
        window.addEventListener('wheel',   Na__CtxGesture__OnAmbientDisarm, { passive: true });
        window.addEventListener('blur',    Na__CtxGesture__OnAmbientDisarm);
        window.addEventListener('keydown', Na__CtxGesture__OnAmbientDisarm);
        document.addEventListener('visibilitychange', Na__CtxGesture__OnAmbientDisarm);

        Na__CtxGesture__IsWired = true;
        console.log(`[ContextMenu] Gesture guard armed (maxTravel ${Na__CtxGesture__MaxTravelPx}px, maxHold ${Na__CtxGesture__MaxHoldMs || 'off'})`);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Force Disarm from Outside (Menu Open, Mode Change, Teardown)
    // ------------------------------------------------------------
    function Na__ContextMenu__Gesture__ForceDisarm() {
        Na__CtxGesture__Disarm();
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Live Travel Threshold (Diagnostics)
    // ------------------------------------------------------------
    function Na__ContextMenu__Gesture__GetMaxTravelPx() {
        return Na__CtxGesture__MaxTravelPx;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Right Click Gesture Guard API
    // ------------------------------------------------------------
    export {
        Na__ContextMenu__Gesture__Initialize,
        Na__ContextMenu__Gesture__ApplyConfig,
        Na__ContextMenu__Gesture__ForceDisarm,
        Na__ContextMenu__Gesture__GetMaxTravelPx
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
