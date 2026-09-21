// =============================================================================
// TRUEVISION3D - HOTKEYS MANAGER
// =============================================================================
//
// FILE       : Na__Hotkeys__Manager.js
// NAMESPACE  : Na__Hotkeys
// MODULE     : HotkeysManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Central hotkey manager — reads the config dictionary, dispatches
//              actions, and propagates key labels to toolbar tooltips and help
//              panels
// CREATED    : 22-Jun-2026
//
// DESCRIPTION:
// - Registers a single window keydown listener for all global hotkeys. Keys
//   and actions are both driven entirely from the config JSON
//   (Na__Hotkeys__3dModelTab__.json) — no key values are hardcoded here.
// - Config schema: an ARRAY of binding objects under
//   Na__TrueVision__HotkeysDictionary, each naming a key, its modifiers, the
//   action string to dispatch, and a description. This is the same schema
//   ValeVision3D's hotkey dictionary uses, so any action (not just the four
//   original view-mode switches) can be added by editing the JSON alone.
// - Supersedes the individual Na__UiFeature__InitializeWalkModeHotkey and
//   Na__UiFeature__InitializeFlyModeHotkey functions which are now no-ops.
// - Guards against misfires in input fields - contenteditable included, since
//   v2.1.0 - and acts only while the 3D Model tab has the keyboard
//   (Na__AppUtils__KeyScope__). A drawing tab and a document tab each have a
//   keyboard of their own.
// - Na__Hotkeys__ApplyUiLabels reads the same config and propagates key labels
//   to all user-facing surfaces: toolbar button title attributes, the static
//   navigation help panel rows ([data-na-hotkey-row], Index.html), and the
//   dynamically-generated user instructions overlay list (naInstructionsViewModeList).
// - Call Na__Hotkeys__Initialize(actionMap, config) once after scene init.
// - Call Na__Hotkeys__ApplyUiLabels(config) once after scene init to update
//   static DOM, then again via callback after user instructions content loads.
//
// @delegate: ./02__Src__AppModules/02__AppData/Na__Hotkeys__3dModelTab__.json
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Jun-2026 - Version 1.0.0
// - Initial Release. Supersedes individual hotkey listeners in
//   Na__UiFeature__WalkModeEventListeners and Na__UiFeature__FlyModeEventListeners.
//
// 16-Sep-2026 - Version 2.0.0
// - Replaced the fixed 4-action switcher (Na__Hotkeys__ACTION_IDS / view-mode-only
//   config path) with a generic array-driven dispatcher ported from ValeVision3D's
//   Na__AppUtils__ValeVision__HotkeyHandler__.js, so any action can be bound from
//   the JSON dictionary alone. Added for Presentation Mode scene-cycle (PageUp /
//   PageDown) and number-key scene-jump (1-9) hotkeys, and the Walk/Fly remap to
//   T (Travel) / Y (Fly) that freed the number keys for scene jumps.
// - Na__Hotkeys__GetKeyLabel is now looked up by full action string rather than
//   the old short actionId, since the config no longer nests view-mode keys under
//   Na__Hotkeys__ViewModes. Toolbar button title propagation and the
//   [data-na-hotkey-row] / [data-na-hotkey-item] surfaces still work exactly as
//   before, just keyed by the new action strings.
//
// 21-Sep-2026 - Version 2.1.0
// - THE 3D MODEL TAB'S KEYS ARE THE 3D MODEL TAB'S. The listener sat on the
//   window for the whole session and never asked which tab was up, so R, B, T,
//   Y, 1-9 and Page Up / Page Down went on answering under the Layout Editor:
//   R typed into a statement reset a camera nobody could see and never reached
//   the page, T on a drawing picked the Text tool AND put the hidden model into
//   Walk mode, and the digits flew it between presentation scenes. It now acts
//   only in the model key scope (Na__AppUtils__KeyScope__), which follows the
//   Layout Editor's mode controller: the 3D Model tab, and nowhere else.
// - The typing guard missed contenteditable, so a key was taken from any
//   editable region: the statement page on the Statements tab, and a plan
//   annotation label being edited on the 3D Model tab itself. It now uses
//   Na__KeyScope__IsTypingTarget, the same test with that case added.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Which Keyboard Is Live, and Whether the Focus Takes Typing
    // ------------------------------------------------------------
    // @delegate: ../03__AppUtils/Na__AppUtils__KeyScope__.js
    // ------------------------------------------------------------
    import { Na__KeyScope__MODEL, Na__KeyScope__Is, Na__KeyScope__IsTypingTarget } from '../03__AppUtils/Na__AppUtils__KeyScope__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Action → Toolbar Button DOM Element ID
    // ------------------------------------------------------------
    const Na__Hotkeys__TOOLBAR_BUTTON_MAP = {                                  // <-- Action string → toolbar button DOM element ID
        'TrueVision__NavMode__SetOrbitMode' : 'naNavToolbarOrbitBtn',
        'TrueVision__NavMode__SetWalkMode'  : 'naNavToolbarWalkBtn',
        'TrueVision__NavMode__SetFlyMode'   : 'naNavToolbarFlyBtn',
        'TrueVision__NavMode__ResetView'    : 'naNavToolbarResetBtn'
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Handler State
    // ------------------------------------------------------------
    let Na__Hotkeys__Bindings        = [];    // <-- Loaded bindings from config dictionary
    let Na__Hotkeys__ActionCallbacks = {};    // <-- Map of action string to callback function
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Matching and Dispatch
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Check if Focus is on an Interactive Input Element
    // ------------------------------------------------------------
    // A text box, a text area, a list - or anything contenteditable, which the
    // old tag test missed, so a key was taken from any editable region.
    // ------------------------------------------------------------
    function Na__Hotkeys__IsInputFocused() {
        return Na__KeyScope__IsTypingTarget(document.activeElement);          // <-- True if typing context is active
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Match Keyboard Event Against a Single Binding
    // ------------------------------------------------------------
    function Na__Hotkeys__MatchesBinding(event, binding) {
        const bindingKey = binding.Na__Hotkey__Key || '';
        const eventKey   = event.key || '';
        const keyMatch   = (bindingKey.length === 1 && eventKey.length === 1)
            ? eventKey.toLowerCase() === bindingKey.toLowerCase()            // <-- Letter/digit keys: match regardless of Shift/Caps
            : eventKey === bindingKey;                                       // <-- Named keys: exact match (PageUp, PageDown, …)
        const altMatch   = !!event.altKey   === !!binding.Na__Hotkey__AltKey;   // <-- Alt modifier match
        const ctrlMatch  = !!event.ctrlKey  === !!binding.Na__Hotkey__CtrlKey;  // <-- Ctrl modifier match
        const shiftMatch = !!event.shiftKey === !!binding.Na__Hotkey__ShiftKey; // <-- Shift modifier match
        return keyMatch && altMatch && ctrlMatch && shiftMatch;              // <-- All four conditions must pass
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Dispatch Action to Registered Callback
    // ------------------------------------------------------------
    function Na__Hotkeys__DispatchAction(action) {
        const callback = Na__Hotkeys__ActionCallbacks[action];               // <-- Look up registered callback
        if (typeof callback === 'function') {
            callback();                                                      // <-- Invoke callback if registered
        } else {
            console.warn(`[TrueVision3D] HotkeysManager: No callback for action "${action}"`); // <-- Warn on unhandled action
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Handle Window Keydown Event
    // ------------------------------------------------------------
    function Na__Hotkeys__HandleKeyDown(event) {
        if (!Na__KeyScope__Is(Na__KeyScope__MODEL)) return;                  // <-- A drawing or a document tab has the keyboard: its keys are its own
        if (Na__Hotkeys__IsInputFocused()) return;                           // <-- Skip when typing in input fields

        for (const binding of Na__Hotkeys__Bindings) {
            if (Na__Hotkeys__MatchesBinding(event, binding)) {
                event.preventDefault();                                      // <-- Prevent default browser behaviour
                Na__Hotkeys__DispatchAction(binding.Na__Hotkey__Action);      // <-- Dispatch to registered callback
                break;                                                       // <-- Stop on first match
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hotkey Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Global Hotkey Listener
    // ------------------------------------------------------------
    function Na__Hotkeys__Initialize(actionMap, config) {
        Na__Hotkeys__ActionCallbacks = actionMap || {};                      // <-- Store provided action callbacks
        Na__Hotkeys__Bindings        = (config && config.Na__TrueVision__HotkeysDictionary) || []; // <-- Read bindings array

        window.addEventListener('keydown', Na__Hotkeys__HandleKeyDown);      // <-- Attach global keydown listener
        console.log(`[TrueVision3D] HotkeysManager: ${Na__Hotkeys__Bindings.length} bindings loaded.`); // <-- Confirm load
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Key Lookup Helper
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Format a Key Binding Object Into a Display Label
    // ------------------------------------------------------------
    function Na__Hotkeys__FormatKeyLabel(binding) {
        const parts = [];
        if (binding.Na__Hotkey__CtrlKey)  parts.push('Ctrl');    // <-- Ctrl modifier
        if (binding.Na__Hotkey__AltKey)   parts.push('Alt');     // <-- Alt modifier
        if (binding.Na__Hotkey__ShiftKey) parts.push('Shift');   // <-- Shift modifier

        const keyName = (binding.Na__Hotkey__Key || '')
            .replace('PageUp',   'Page Up')                      // <-- Pretty-print browser key names
            .replace('PageDown', 'Page Down')
            .replace('ArrowUp',    '↑')
            .replace('ArrowDown',  '↓')
            .replace('ArrowLeft',  '←')
            .replace('ArrowRight', '→');

        parts.push(keyName);
        return parts.join(' + ');                                 // <-- e.g. "Alt + Shift + W" or "Page Up"
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Key Label for an Action from Config
    // ------------------------------------------------------------
    function Na__Hotkeys__GetKeyLabel(action, config) {
        const bindings = (config && config.Na__TrueVision__HotkeysDictionary) || []; // <-- Read from config SSOT
        const binding  = bindings.find(b => b.Na__Hotkey__Action === action);
        return binding ? Na__Hotkeys__FormatKeyLabel(binding) : '';
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


    // FUNCTION | Rebuild the User Instructions Overlay's Global Hotkeys List
    // ------------------------------------------------------------
    // Generic loop over every non-advanced binding in the dictionary, so a
    // future hotkey added to the JSON alone shows up here with no HTML edit -
    // the same pattern ValeVision3D's Navigation Help Panel already uses.
    // Advanced entries (the individual scene 2-9 number keys) are left out of
    // this list; scene 1's own row already tells the viewer 1-9 all work.
    // ------------------------------------------------------------
    function Na__Hotkeys__PopulateInstructionsList(config) {
        const container = document.getElementById('naInstructionsViewModeList');
        if (!container) return;

        const bindings = (config && config.Na__TrueVision__HotkeysDictionary) || [];
        const labels   = (config && config.Na__Hotkeys__Display__Labels) || {};
        const standard = bindings.filter(b => b.Na__Hotkey__Advanced !== true);

        container.innerHTML = '';                                             // <-- Clear the static placeholder rows

        standard.forEach((binding) => {
            const li      = document.createElement('li');
            const keySpan = document.createElement('span');
            const descSpan = document.createElement('span');

            li.className       = 'na-instructions-item';
            keySpan.className  = 'na-instructions-item__key';
            descSpan.className = 'na-instructions-item__desc';

            keySpan.textContent  = Na__Hotkeys__FormatKeyLabel(binding);
            descSpan.textContent = labels[binding.Na__Hotkey__Action] || binding.Na__Hotkey__Description;

            li.appendChild(keySpan);
            li.appendChild(descSpan);
            container.appendChild(li);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Key Labels to All User-Facing UI Surfaces
    // ------------------------------------------------------------
    function Na__Hotkeys__ApplyUiLabels(config) {

        // TOOLBAR BUTTON TOOLTIPS
        // ------------------------------------------------------------
        Object.keys(Na__Hotkeys__TOOLBAR_BUTTON_MAP).forEach((action) => {
            const keyLabel = Na__Hotkeys__GetKeyLabel(action, config);
            const buttonId = Na__Hotkeys__TOOLBAR_BUTTON_MAP[action];
            if (buttonId) Na__Hotkeys__SetToolbarButtonTitle(buttonId, keyLabel);
        });
        // ------------------------------------------------------------

        // NAV HELP PANEL ROWS (data-na-hotkey-row attribute, static DOM)
        // ------------------------------------------------------------
        const helpRows = document.querySelectorAll('[data-na-hotkey-row]');
        helpRows.forEach((row) => {
            const action    = row.getAttribute('data-na-hotkey-row');
            const keyLabel  = Na__Hotkeys__GetKeyLabel(action, config);
            Na__Hotkeys__PopulateHotkeyRow(row, keyLabel);
        });
        // ------------------------------------------------------------

        // USER INSTRUCTIONS OVERLAY (dynamically generated list)
        // ------------------------------------------------------------
        Na__Hotkeys__PopulateInstructionsList(config);
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
