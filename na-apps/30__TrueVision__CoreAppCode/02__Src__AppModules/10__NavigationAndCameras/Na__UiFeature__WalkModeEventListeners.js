// =============================================================================
// TRUEVISION3D - WALK MODE EVENT LISTENERS
// =============================================================================
//
// FILE       : Na__UiFeature__WalkModeEventListeners.js
// NAMESPACE  : Na__UiFeature
// MODULE     : WalkModeEventListeners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Walk mode keyboard hotkey and UI button event binding
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Pure event-binding module with no Three.js dependencies and no state.
// - Registers the Alt+Shift+W keyboard hotkey that toggles walk mode.
// - Optionally wires a DOM button to the same toggle function.
// - Both functions accept the toggle function as a parameter, keeping this
//   module completely decoupled from the walk mode logic itself.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeWalkModeHotkey(toggleFn) after scene init.
// - Call Na__UiFeature__InitializeWalkModeToggleButton(buttonId, toggleFn)
//   if a UI toggle button exists in the DOM (e.g. in the test environment).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 24-Feb-2026 - Version 1.0.0
// - Extracted walk mode hotkey listener from index.html (lines 521-529) and
//   walk mode UI button listener from TestEnv__PrototypeTestingSandbox__Main__.js
//   (lines 405-411) into a shared module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Walk Mode Hotkey Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Walk Mode Hotkey Listener (Alt+Shift+W)
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeWalkModeHotkey(toggleFn) {
        window.addEventListener('keydown', (event) => {
            if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'w') {
                event.preventDefault();                                        // <-- Block default browser Alt+Shift+W action
                toggleFn();                                                    // <-- Invoke the supplied toggle function
            }
        });
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

