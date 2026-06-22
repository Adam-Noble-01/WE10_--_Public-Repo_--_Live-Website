// =============================================================================
// TRUEVISION3D - WALK MODE EVENT LISTENERS
// =============================================================================
//
// FILE       : Na__UiFeature__WalkModeEventListeners.js
// NAMESPACE  : Na__UiFeature
// MODULE     : WalkModeEventListeners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Walk mode UI button event binding
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Pure event-binding module with no Three.js dependencies and no state.
// - Na__UiFeature__InitializeWalkModeToggleButton wires a DOM button to the
//   walk mode toggle function (used in test environments).
// - Na__UiFeature__InitializeWalkModeHotkey is retained as a no-op for
//   backwards compatibility. Walk mode hotkeys are now managed centrally by
//   Na__Hotkeys__Manager.js, driven from Na__AppConfig__Hotkeys.json.
//
// @delegate: ./Na__Hotkeys__Manager.js
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeWalkModeToggleButton(buttonId, toggleFn)
//   if a UI toggle button exists in the DOM (e.g. in the test environment).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Jun-2026 - Version 1.1.0
// - Na__UiFeature__InitializeWalkModeHotkey deprecated (no-op). Walk hotkeys
//   superseded by Na__Hotkeys__Manager.js + Na__AppConfig__Hotkeys.json.
//
// 24-Feb-2026 - Version 1.0.0
// - Extracted walk mode hotkey listener from index.html (lines 521-529) and
//   walk mode UI button listener from TestEnv__PrototypeTestingSandbox__Main__.js
//   (lines 405-411) into a shared module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Walk Mode Hotkey Registration (Deprecated)
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Walk Mode Hotkey Listener — DEPRECATED NO-OP
    // Walk hotkeys are now managed by Na__Hotkeys__Manager.js.
    // @delegate: ./Na__Hotkeys__Manager.js
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeWalkModeHotkey(_toggleFn) {
        // Deprecated: superseded by Na__Hotkeys__Initialize in Na__Hotkeys__Manager.js
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Walk Mode UI Button Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Walk Mode Toggle Button
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeWalkModeToggleButton(buttonId, toggleFn) {
        const button = document.getElementById(buttonId);
        if (!button) return;                                                   // <-- Guard: button may not exist in all environments
        button.addEventListener('click', toggleFn);                            // <-- Wire button click to toggle function
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Walk Mode Event Listeners API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeWalkModeHotkey,
        Na__UiFeature__InitializeWalkModeToggleButton
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

