// =============================================================================
// VECTORFORGE - TOOLBAR UI
// =============================================================================
//
// FILE      : VF__UI__Toolbar__.js
// NAMESPACE : VectorForge.UI
// MODULE    : Toolbar
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages toolbar button state and tool activation on click and hotkey
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Queries all .toolbar button elements and wires click handlers to setTool.
// - Listens to the tool:changed event to keep button active-state in sync
//   with programmatic tool changes (e.g. from hotkeys).
// - Subscribes to hotkey:tool_* events to forward hotkey activations to AppState.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Toolbar UI Class
// -----------------------------------------------------------------------------

    // CLASS | ToolbarUI — Tool Button State Controller
    // ------------------------------------------------------------
    export class ToolbarUI {

        // FUNCTION | Constructor — Wire Button Clicks and Bus Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this.appState = appState;                                              // <-- App state reference
            this.buttons  = document.querySelectorAll('.toolbar button');         // <-- All toolbar button elements

            this.buttons.forEach(btn => {
                btn.addEventListener('click', () => this.appState.setTool(btn.dataset.tool)); // <-- Activate tool on click
            });

            eventBus.on('tool:changed',       (toolName) => this._syncActiveState(toolName)); // <-- Keep buttons in sync

            eventBus.on('hotkey:tool_select', () => this.appState.setTool('select')); // <-- V hotkey
            eventBus.on('hotkey:tool_line',   () => this.appState.setTool('line'));   // <-- L hotkey
            eventBus.on('hotkey:tool_rect',   () => this.appState.setTool('rect'));   // <-- R hotkey
            eventBus.on('hotkey:tool_path',   () => this.appState.setTool('path'));   // <-- P hotkey
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | SyncActiveState — Update Button Active Class to Match Active Tool
        // ------------------------------------------------------------
        _syncActiveState(toolName) {
            this.buttons.forEach(btn => {
                if (btn.dataset.tool === toolName) {
                    btn.classList.add('active');    // <-- Highlight the active tool button
                } else {
                    btn.classList.remove('active'); // <-- Clear all other buttons
                }
            });
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
