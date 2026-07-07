// =============================================================================
// NOBLE CAD AUDIT TOOLS - HOTKEY MANAGER
// =============================================================================
//
// FILE      : Na__AppCore__HotkeyManager__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : HotkeyManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Global keyboard shortcut dispatcher — maps keys to EventBus events
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Listens to document-level keydown events.
// - Uses a keybindings map (from Na__AppCore__Keybindings__) to resolve
//   the action for each key combination.
// - Emits the resolved action event on the EventBus for modules to respond to.
// - Respects input focus: hotkeys are suppressed when typing in text inputs.
// - Modifier key support: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+A (select all).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================

import { Na__AppCore__DefaultKeybindings } from './Na__AppCore__Keybindings__.js';


// -----------------------------------------------------------------------------
// REGION | HotkeyManager Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__HotkeyManager {

        // SUB FUNCTION | Constructor — Bind Document Keydown Listener
        // ------------------------------------------------------------
        constructor(eventBus, keybindings = null) {
            this._eventBus   = eventBus;
            this._bindings   = keybindings || Na__AppCore__DefaultKeybindings; // <-- Use defaults if none provided
            this._enabled    = true;                                            // <-- Allow runtime enable/disable

            this._handleKeyDown = this._handleKeyDown.bind(this);
            document.addEventListener('keydown', this._handleKeyDown);
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Global Keydown Event
        // ------------------------------------------------------------
        _handleKeyDown(event) {
            if (!this._enabled) return;                                         // <-- Hotkeys disabled (e.g. modal open)
            if (Na__HotkeyManager__IsInputFocused()) return;                    // <-- Suppress when typing in inputs

            const key = Na__HotkeyManager__BuildKeyString(event);              // <-- Build "ctrl+z", "delete" etc
            const action = this._bindings[key];

            if (!action) return;                                                // <-- No binding for this key

            event.preventDefault();                                             // <-- Prevent default browser actions
            this._eventBus.emit(`hotkey:${action}`);                           // <-- Emit action event e.g. "hotkey:undo"
        }
        // ------------------------------------------------------------


        // FUNCTION | Enable or Disable Hotkey Processing
        // ------------------------------------------------------------
        setEnabled(enabled) {
            this._enabled = enabled;                                            // <-- Toggle hotkey active state
        }
        // ------------------------------------------------------------


        // FUNCTION | Update the Keybindings Map at Runtime
        // ------------------------------------------------------------
        setBindings(bindings) {
            this._bindings = bindings;                                          // <-- Replace bindings with custom map
        }
        // ------------------------------------------------------------


        // FUNCTION | Dispose — Remove Event Listener
        // ------------------------------------------------------------
        dispose() {
            document.removeEventListener('keydown', this._handleKeyDown);      // <-- Clean up listener
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Check if an Input Element Has Focus
    // ------------------------------------------------------------
    function Na__HotkeyManager__IsInputFocused() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable; // <-- Suppress hotkeys when typing
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Normalised Key String from a KeyboardEvent
    // ------------------------------------------------------------
    function Na__HotkeyManager__BuildKeyString(event) {
        const parts = [];
        if (event.ctrlKey  || event.metaKey) parts.push('ctrl');  // <-- Treat Cmd (Mac) same as Ctrl
        if (event.altKey)                    parts.push('alt');
        if (event.shiftKey)                  parts.push('shift');
        parts.push(event.key.toLowerCase());                       // <-- Normalise to lowercase
        return parts.join('+');                                    // <-- e.g. "ctrl+z" or "delete"
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
