// =============================================================================
// NOBLE CAD AUDIT TOOLS - KEYBINDINGS
// =============================================================================
//
// FILE      : Na__AppCore__Keybindings__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : Keybindings
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Default keyboard shortcut → action name map for the HotkeyManager
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Exported constant Na__AppCore__DefaultKeybindings maps key strings (as
//   produced by HotkeyManager's buildKeyString) to action name strings.
// - Action names are emitted as EventBus events: "hotkey:<action>"
// - All consumers subscribe to "hotkey:undo", "hotkey:tool:pan", etc.
// - To customise bindings, pass a modified copy to HotkeyManager.setBindings().
// - Key strings use "+" separator and lowercase keys: "ctrl+z", "delete", "h".
//
// ACTION NAMES (EventBus event suffix):
//   tool:pan            — Activate pan tool
//   tool:box-window     — Activate window-select tool
//   tool:box-crossing   — Activate crossing-select tool
//   view:fit            — Zoom to fit entire drawing
//   edit:delete         — Delete selected entities
//   edit:undo           — Undo last action
//   edit:redo           — Redo last undone action
//   edit:select-all     — Select all visible entities
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Default Keybindings Map
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default Key → Action Binding Map
    // ------------------------------------------------------------
    export const Na__AppCore__DefaultKeybindings = {

        // Tools
        'h'          : 'tool:pan',            // <-- H key → activate pan tool
        'w'          : 'tool:box-window',     // <-- W key → window select (fully enclosed)
        'c'          : 'tool:box-crossing',   // <-- C key → crossing select (touching)

        // View
        'f'          : 'view:fit',            // <-- F key → fit drawing to viewport

        // Edit — Delete
        'delete'     : 'edit:delete',         // <-- Delete key → remove selected entities
        'backspace'  : 'edit:delete',         // <-- Backspace alternative on some keyboards

        // Edit — Undo / Redo
        'ctrl+z'     : 'edit:undo',           // <-- Ctrl+Z (Windows/Linux) undo
        'ctrl+y'     : 'edit:redo',           // <-- Ctrl+Y redo
        'ctrl+shift+z' : 'edit:redo',         // <-- Ctrl+Shift+Z redo (Mac convention)

        // Edit — Select All
        'ctrl+a'     : 'edit:select-all',     // <-- Ctrl+A select all entities on visible layers

        // Edit — Escape (deselect)
        'escape'     : 'edit:deselect',       // <-- Esc → clear selection

    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
