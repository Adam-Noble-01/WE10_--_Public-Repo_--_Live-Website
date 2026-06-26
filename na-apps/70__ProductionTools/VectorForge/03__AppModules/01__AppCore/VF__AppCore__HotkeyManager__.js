// =============================================================================
// VECTORFORGE - HOTKEY MANAGER
// =============================================================================
//
// FILE      : VF__AppCore__HotkeyManager__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : HotkeyManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Global keyboard shortcut listener — maps key combos to bus events
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Attaches a single keydown listener to the window and resolves each event
//   against the VF__DefaultKeybindings map.
// - On a match, emits hotkey:<action> on the EventBus so any module can react
//   without knowing about keyboard input directly.
// - Single-key tool shortcuts are suppressed when focus is inside an input or
//   textarea to prevent conflicts with text editing.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================

import { VF__DefaultKeybindings } from './VF__AppCore__Keybindings__.js';


// -----------------------------------------------------------------------------
// REGION | HotkeyManager Class
// -----------------------------------------------------------------------------

    // CLASS | HotkeyManager — Global Keyboard Shortcut Dispatcher
    // ------------------------------------------------------------
    export class HotkeyManager {

        // FUNCTION | Constructor — Attach Global Keydown Listener
        // ------------------------------------------------------------
        constructor(eventBus) {
            this.eventBus = eventBus;                  // <-- Event bus for emitting hotkey events
            this.bindings = VF__DefaultKeybindings;    // <-- Keybinding map from Keybindings module

            window.addEventListener('keydown', (e) => this._onKeyDown(e));
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnKeyDown — Resolve Keydown Against Bindings and Emit
        // ------------------------------------------------------------
        _onKeyDown(e) {
            const isInput      = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'; // <-- Detect text input focus
            let   matchedAction = null;

            for (const [action, combos] of Object.entries(this.bindings)) {
                for (const combo of combos) {
                    const keyMatch   = e.key.toLowerCase() === combo.key.toLowerCase() || e.code === combo.key; // <-- Match key or code
                    const ctrlMatch  = !!combo.ctrl  === (e.ctrlKey || e.metaKey); // <-- Ctrl/Cmd match
                    const shiftMatch = !!combo.shift === e.shiftKey;               // <-- Shift match
                    const altMatch   = !!combo.alt   === e.altKey;                 // <-- Alt match

                    if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                        matchedAction = action;
                        break;
                    }
                }
                if (matchedAction) break;
            }

            if (!matchedAction) return;

            if (isInput && !matchedAction.includes('syncCode')) return; // <-- Allow syncCode inside inputs, suppress all others

            e.preventDefault();
            this.eventBus.emit(`hotkey:${matchedAction}`); // <-- Dispatch to all bus subscribers
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
