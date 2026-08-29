// =============================================================================
// TRUEVISION3D - HOTKEYS MANAGER
// =============================================================================
//
// FILE       : Na__Hotkeys__Manager.js
// NAMESPACE  : Na__Hotkeys
// MODULE     : HotkeysManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Central hotkey manager — reads config, dispatches actions, and
//              propagates key labels to toolbar tooltips and help panels
// CREATED    : 22-Jun-2026
//
// DESCRIPTION:
// - Registers a single window keydown listener for all global view-mode
//   hotkeys. Keys and actions are both driven entirely from the config JSON
//   (Na__AppConfig__Hotkeys.json) — no key values are hardcoded here.
// - Supersedes the individual Na__UiFeature__InitializeWalkModeHotkey and
//   Na__UiFeature__InitializeFlyModeHotkey functions which are now no-ops.
// - Guards against misfires in input fields and when Ctrl/Meta/Alt are held.
// - Na__Hotkeys__ApplyUiLabels reads the same config and propagates key labels
//   to all user-facing surfaces: toolbar button title attributes, navigation
//   help panel hotkey rows, and the user instructions overlay list.
// - Call Na__Hotkeys__Initialize(actionMap, config) once after scene init.
// - Call Na__Hotkeys__ApplyUiLabels(config) once after scene init to update
//   static DOM, then again via callback after user instructions content loads.
//
// @delegate: ./02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Jun-2026 - Version 1.0.0
// - Initial Release. Supersedes individual hotkey listeners in
//   Na__UiFeature__WalkModeEventListeners and Na__UiFeature__FlyModeEventListeners.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Key Path Helpers
    // ------------------------------------------------------------
    const Na__Hotkeys__ACTION_IDS = [                                          // <-- All action identifiers managed by this module
        'switchToOrbit',
        'switchToWalk',
        'switchToFly',
        'resetView'
    ];

    const Na__Hotkeys__CONFIG_KEY_MAP = {                                      // <-- Action ID → config JSON path within Na__Hotkeys__ViewModes
        switchToOrbit          : 'Na__Hotkeys__ViewMode__OrbitMode',
        switchToWalk           : 'Na__Hotkeys__ViewMode__WalkMode',
        switchToFly            : 'Na__Hotkeys__ViewMode__FlyMode',
        resetView              : 'Na__Hotkeys__Action__ResetView'
    };

    const Na__Hotkeys__TOOLBAR_BUTTON_MAP = {                                  // <-- Action ID → toolbar button DOM element ID
        switchToOrbit          : 'naNavToolbarOrbitBtn',
        switchToWalk           : 'naNavToolbarWalkBtn',
        switchToFly            : 'naNavToolbarFlyBtn',
        resetView              : 'naNavToolbarResetBtn'
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Key Lookup Helper
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get Key String for an Action from Config
    // ------------------------------------------------------------
    function Na__Hotkeys__GetKeyLabel(actionId, config) {
        const modes = (config && config.Na__Hotkeys__ViewModes) || {};         // <-- Read from config SSOT
        const configKey = Na__Hotkeys__CONFIG_KEY_MAP[actionId];
        return (configKey && modes[configKey]) ? String(modes[configKey]) : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hotkey Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Hotkey Listener
    // ------------------------------------------------------------
    function Na__Hotkeys__Initialize(actionMap, config) {
        const modes = (config && config.Na__Hotkeys__ViewModes) || {};

        const keyToAction = {};                                                // <-- Reverse-lookup: key string → action ID
        Na__Hotkeys__ACTION_IDS.forEach((actionId) => {
            const configKey = Na__Hotkeys__CONFIG_KEY_MAP[actionId];
            const keyValue  = configKey ? modes[configKey] : null;
            if (keyValue) keyToAction[String(keyValue)] = actionId;
        });

        window.addEventListener('keydown', (event) => {
            const tag = (event.target && event.target.tagName)
                ? event.target.tagName.toUpperCase()
                : '';

            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return; // <-- Skip when typing in a field
            if (event.ctrlKey || event.metaKey || event.altKey) return;            // <-- Skip when modifier keys are held

            const actionId = keyToAction[event.key];
            if (!actionId) return;

            const handler = actionMap[actionId];
            if (typeof handler === 'function') {
                event.preventDefault();                                        // <-- Prevent default browser digit key actions
                handler();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI Label Application
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Append Hotkey Suffix to an Element Title Attribute
    // ------------------------------------------------------------
    function Na__Hotkeys__SetToolbarButtonTitle(buttonId, keyLabel) {
        const btn = document.getElementById(buttonId);
        if (!btn || !keyLabel) return;

        const baseTitle = btn.getAttribute('data-na-base-title') || btn.getAttribute('title') || '';

        if (!btn.hasAttribute('data-na-base-title')) {
            btn.setAttribute('data-na-base-title', baseTitle);                // <-- Stash base title before modifying
        }

        btn.setAttribute('title', baseTitle ? `${baseTitle} (${keyLabel})` : keyLabel);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Populate a data-na-hotkey-row Element's Key Span
    // ------------------------------------------------------------
    function Na__Hotkeys__PopulateHotkeyRow(rowEl, keyLabel) {
        if (!rowEl || !keyLabel) return;
        const keySpan = rowEl.querySelector('.na-nav-help__key, .na-instructions-item__key');
        if (keySpan) keySpan.textContent = keyLabel;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Key Labels to All User-Facing UI Surfaces
    // ------------------------------------------------------------
    function Na__Hotkeys__ApplyUiLabels(config) {

        // TOOLBAR BUTTON TOOLTIPS
        // ------------------------------------------------------------
        Na__Hotkeys__ACTION_IDS.forEach((actionId) => {
            const keyLabel  = Na__Hotkeys__GetKeyLabel(actionId, config);
            const buttonId  = Na__Hotkeys__TOOLBAR_BUTTON_MAP[actionId];
            if (buttonId) Na__Hotkeys__SetToolbarButtonTitle(buttonId, keyLabel);
        });
        // ------------------------------------------------------------

        // NAV HELP PANEL ROWS (data-na-hotkey-row attribute, static DOM)
        // ------------------------------------------------------------
        const helpRows = document.querySelectorAll('[data-na-hotkey-row]');
        helpRows.forEach((row) => {
            const actionId = row.getAttribute('data-na-hotkey-row');
            const keyLabel = Na__Hotkeys__GetKeyLabel(actionId, config);
            Na__Hotkeys__PopulateHotkeyRow(row, keyLabel);
        });
        // ------------------------------------------------------------

        // USER INSTRUCTIONS OVERLAY (data-na-hotkey-item, dynamically injected)
        // ------------------------------------------------------------
        const instrItems = document.querySelectorAll('[data-na-hotkey-item]');
        instrItems.forEach((item) => {
            const actionId    = item.getAttribute('data-na-hotkey-item');
            const keyLabel    = Na__Hotkeys__GetKeyLabel(actionId, config);
            const labels      = (config && config.Na__Hotkeys__Display__Labels) || {};
            const description = labels[actionId] || actionId;
            const keySpan     = item.querySelector('.na-instructions-item__key');
            const descSpan    = item.querySelector('.na-instructions-item__desc');
            if (keySpan)  keySpan.textContent  = keyLabel;
            if (descSpan) descSpan.textContent = description;
        });
        // ------------------------------------------------------------
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Hotkeys Manager API
    // ------------------------------------------------------------
    export {
        Na__Hotkeys__Initialize,
        Na__Hotkeys__ApplyUiLabels,
        Na__Hotkeys__GetKeyLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
