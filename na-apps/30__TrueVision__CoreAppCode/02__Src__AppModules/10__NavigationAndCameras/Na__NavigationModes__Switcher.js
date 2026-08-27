// =============================================================================
// TRUEVISION3D - NAVIGATION MODES - PROGRAMMATIC MODE SWITCHER
// =============================================================================
//
// FILE       : Na__NavigationModes__Switcher.js
// NAMESPACE  : Na__NavigationModes
// MODULE     : Navigation Modes - Programmatic Mode Switcher
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Single shared entry point for switching navigation mode from
//              anywhere in the app without importing the toolbar internals
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Index.html owns the walk/fly mutual-exclusivity toggle wrappers because
//   only it holds the live camera, controls and toolbar references.
// - Those wrappers were previously reachable only by the Hotkeys Manager.
//   Presentation Mode now needs the same capability so a saved scene can
//   declare the navigation mode it should be viewed in.
// - Index.html registers its wrappers here once during boot; any module can
//   then call Na__NavigationModes__SwitchToMode with orbit, walk or fly.
// - Requests for a mode the current model does not enable are ignored, as
//   are requests for the mode already active - matching hotkey behaviour.
//
// INTEGRATION:
// - Registered from Index.html after the toggle wrappers are defined.
// - Consumed by Na__PresentationMode__Camera__SceneTransition.js.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial implementation to support per-scene navigation modes in
//   Presentation Mode.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Enabled Mode Availability Checks
    // ------------------------------------------------------------
    import {
        Na__NavigationModes__IsWalkEnabled,
        Na__NavigationModes__IsFlyEnabled
    } from './Na__NavigationModes__State.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Recognised Navigation Mode Names
    // ------------------------------------------------------------
    const Na__NavModeSwitch__VALID_MODES = ['orbit', 'walk', 'fly'];  // <-- Anything else is rejected
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Registered Switch Handlers
    // ------------------------------------------------------------
    let Na__NavModeSwitch__Handlers = null;   // <-- Handler set supplied by Index.html during boot
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Host Application's Mode Switch Handlers
    // ------------------------------------------------------------
    function Na__NavigationModes__RegisterModeSwitcher(handlers) {
        if (!handlers
            || typeof handlers.getActiveMode !== 'function'
            || typeof handlers.toOrbit       !== 'function'
            || typeof handlers.toWalk        !== 'function'
            || typeof handlers.toFly         !== 'function') {
            console.warn('[TrueVision3D] Mode switcher registration ignored - incomplete handler set.');
            return;
        }
        Na__NavModeSwitch__Handlers = handlers;                              // <-- Store for later programmatic use
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mode Queries
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Currently Active Navigation Mode
    // ------------------------------------------------------------
    function Na__NavigationModes__GetActiveMode() {
        if (!Na__NavModeSwitch__Handlers) return null;                       // <-- Not registered yet
        return Na__NavModeSwitch__Handlers.getActiveMode();
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Whether a Mode Name Is Valid and Available on This Model
    // ------------------------------------------------------------
    function Na__NavigationModes__IsModeAvailable(mode) {
        if (!Na__NavModeSwitch__VALID_MODES.includes(mode)) return false;    // <-- Unknown name
        if (mode === 'walk') return Na__NavigationModes__IsWalkEnabled();    // <-- Gated by project config
        if (mode === 'fly')  return Na__NavigationModes__IsFlyEnabled();     // <-- Gated by project config
        return true;                                                         // <-- Orbit is always available
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mode Switching
// -----------------------------------------------------------------------------

    // FUNCTION | Switch the Application to a Named Navigation Mode
    // ------------------------------------------------------------
    // Returns true only when a mode change was actually performed, so callers
    // can tell "already there" and "not permitted" apart from a real switch.
    // ------------------------------------------------------------
    function Na__NavigationModes__SwitchToMode(mode) {
        if (!Na__NavModeSwitch__Handlers) return false;                         // <-- Boot not finished / never registered
        if (!Na__NavigationModes__IsModeAvailable(mode)) return false;          // <-- Unknown or disabled for this model
        if (Na__NavModeSwitch__Handlers.getActiveMode() === mode) return false; // <-- Already active, no-op

        if (mode === 'orbit') {
            Na__NavModeSwitch__Handlers.toOrbit();                           // <-- Exits whichever of walk/fly is active
        } else if (mode === 'walk') {
            Na__NavModeSwitch__Handlers.toWalk();                            // <-- Silently exits fly, then activates walk
        } else {
            Na__NavModeSwitch__Handlers.toFly();                             // <-- Silently exits walk, then activates fly
        }

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Programmatic Mode Switcher API
    // ------------------------------------------------------------
    export {
        Na__NavigationModes__RegisterModeSwitcher,
        Na__NavigationModes__GetActiveMode,
        Na__NavigationModes__IsModeAvailable,
        Na__NavigationModes__SwitchToMode
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
