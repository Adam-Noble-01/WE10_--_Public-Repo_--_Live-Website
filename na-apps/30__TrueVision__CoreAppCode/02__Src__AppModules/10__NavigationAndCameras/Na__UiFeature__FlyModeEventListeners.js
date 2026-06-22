// =============================================================================
// TRUEVISION3D - FLY MODE EVENT LISTENERS
// =============================================================================
//
// FILE       : Na__UiFeature__FlyModeEventListeners.js
// NAMESPACE  : Na__UiFeature
// MODULE     : FlyModeEventListeners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fly mode UI button event binding
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Pure event-binding module with no Three.js dependencies and no state.
// - Na__UiFeature__InitializeFlyModeToggleButton wires a DOM button to the
//   fly mode toggle function when provided.
// - Na__UiFeature__InitializeFlyModeHotkey is retained as a no-op for
//   backwards compatibility. Fly mode hotkeys are now managed centrally by
//   Na__Hotkeys__Manager.js, driven from Na__AppConfig__Hotkeys.json.
//
// @delegate: ./Na__Hotkeys__Manager.js
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeFlyModeToggleButton(buttonId, toggleFn)
//   when the menu DOM button is present.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Jun-2026 - Version 1.1.0
// - Na__UiFeature__InitializeFlyModeHotkey deprecated (no-op). Fly hotkeys
//   superseded by Na__Hotkeys__Manager.js + Na__AppConfig__Hotkeys.json.
//
// 25-May-2026 - Version 1.0.0
// - Initial implementation mirroring the Walk Mode event listeners module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Fly Mode Hotkey Registration (Deprecated)
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Fly Mode Hotkey Listener — DEPRECATED NO-OP
    // Fly hotkeys are now managed by Na__Hotkeys__Manager.js.
    // @delegate: ./Na__Hotkeys__Manager.js
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeFlyModeHotkey(_toggleFn) {
        // Deprecated: superseded by Na__Hotkeys__Initialize in Na__Hotkeys__Manager.js
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fly Mode UI Button Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Fly Mode Toggle Button
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeFlyModeToggleButton(buttonId, toggleFn) {
        const button = document.getElementById(buttonId);
        if (!button) return;                                                     // <-- Guard: button may not exist in all environments
        button.addEventListener('click', toggleFn);                              // <-- Wire button click to toggle function
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Fly Mode Event Listeners API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeFlyModeHotkey,
        Na__UiFeature__InitializeFlyModeToggleButton
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
