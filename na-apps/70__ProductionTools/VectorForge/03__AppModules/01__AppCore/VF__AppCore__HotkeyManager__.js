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
// - Implements chord-safe Ctrl-alone tap detection: tapping and releasing
//   Control without pressing any other key emits hotkey:togglePointEdit. If
//   the user forms a chord (Ctrl+Z, Ctrl+Y, etc.) the tap is cancelled and the
//   chord shortcut fires normally.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.2.0
// - Escape (tool_select) now fires even when focus is inside an input or textarea.
//
// 26-Jun-2026 - Version 1.1.0
// - Added chord-safe Ctrl-alone tap to emit hotkey:togglePointEdit on keyup.
//
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

        // FUNCTION | Constructor — Attach Global Keydown and Keyup Listeners
        // ------------------------------------------------------------
        constructor(eventBus) {
            this.eventBus         = eventBus;               // <-- Event bus for emitting hotkey events
            this.bindings         = VF__DefaultKeybindings; // <-- Keybinding map from Keybindings module
            this._ctrlTapPending  = false;                  // <-- True between Control keydown and keyup (no chord)

            window.addEventListener('keydown', (e) => this._onKeyDown(e));
            window.addEventListener('keyup',   (e) => this._onKeyUp(e));
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnKeyDown — Resolve Keydown Against Bindings and Emit
        // ------------------------------------------------------------
        _onKeyDown(e) {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'; // <-- Detect text input focus

            // -- Ctrl-alone tap detection ------------------------------------------
            if (e.key === 'Control' && !e.repeat) {
                this._ctrlTapPending = true;  // <-- Mark potential Ctrl tap start
                return;                       // <-- Don't process Control alone as a binding
            }
            if (this._ctrlTapPending && e.key !== 'Control') {
                this._ctrlTapPending = false; // <-- User is forming a chord (e.g. Ctrl+Z) — cancel tap
            }
            // -----------------------------------------------------------------------

            let matchedAction = null;

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

            if (isInput && !this._allowHotkeyInInput(matchedAction, e)) return; // <-- Suppress most shortcuts inside text fields

            e.preventDefault();
            this.eventBus.emit(`hotkey:${matchedAction}`); // <-- Dispatch to all bus subscribers
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | AllowHotkeyInInput — Permit Safe Shortcuts While Typing
        // ------------------------------------------------------------
        _allowHotkeyInInput(action, e) {
            if (action.includes('syncCode')) return true;              // <-- Ctrl+Shift+Enter in code panel
            if (action === 'tool_select' && e.key === 'Escape') return true; // <-- Esc always returns to select tool
            return false;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnKeyUp — Fire Ctrl-Alone Tap Toggle on Clean Control Release
        // ------------------------------------------------------------
        _onKeyUp(e) {
            if (e.key !== 'Control') return;

            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'; // <-- Suppress in text inputs

            if (this._ctrlTapPending && !isInput) {
                e.preventDefault();
                this.eventBus.emit('hotkey:togglePointEdit'); // <-- Clean Ctrl tap — toggle vertex edit mode
            }

            this._ctrlTapPending = false; // <-- Always reset on Control keyup
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
