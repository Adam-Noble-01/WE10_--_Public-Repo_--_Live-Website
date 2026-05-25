// =============================================================================
// TRUEVISION3D - FLY MODE EVENT LISTENERS
// =============================================================================
//
// FILE       : Na__UiFeature__FlyModeEventListeners.js
// NAMESPACE  : Na__UiFeature
// MODULE     : FlyModeEventListeners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fly mode keyboard hotkey and UI button event binding
// CREATED    : 25-May-2026
//
// DESCRIPTION:
// - Pure event-binding module with no Three.js dependencies and no state.
// - Registers the Alt+Shift+F keyboard hotkey that toggles fly mode.
// - Wires a DOM button to the same toggle function when provided.
// - Both functions accept the toggle function as a parameter, keeping this
//   module completely decoupled from the fly mode logic itself.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeFlyModeHotkey(toggleFn) after scene init.
// - Call Na__UiFeature__InitializeFlyModeToggleButton(buttonId, toggleFn)
//   when the menu DOM button is present.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 25-May-2026 - Version 1.0.0
// - Initial implementation mirroring the Walk Mode event listeners module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Fly Mode Hotkey Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Fly Mode Hotkey Listener (Alt+Shift+F)
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeFlyModeHotkey(toggleFn) {
        window.addEventListener('keydown', (event) => {
            if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'f') {
                event.preventDefault();                                          // <-- Block default browser Alt+Shift+F action
                toggleFn();                                                      // <-- Invoke the supplied toggle function
            }
        });
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
