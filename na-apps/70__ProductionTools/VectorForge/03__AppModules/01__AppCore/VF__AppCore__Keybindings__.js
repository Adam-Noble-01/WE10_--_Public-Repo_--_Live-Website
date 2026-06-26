// =============================================================================
// VECTORFORGE - KEYBINDINGS
// =============================================================================
//
// FILE      : VF__AppCore__Keybindings__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : Keybindings
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Default keyboard shortcut definitions for all editor actions
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Defines the default keybinding map consumed by VF__AppCore__HotkeyManager__.js.
// - Each action maps to an array of key combos, allowing multiple shortcuts
//   per action (e.g. Ctrl+Y and Ctrl+Shift+Z both trigger redo).
// - Combo properties: key (string), ctrl (bool), shift (bool), alt (bool).
//   Omitting a modifier means it must NOT be held.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.2.0
// - Added Escape key shortcut for tool_select (return to select from any tool).
//
// 26-Jun-2026 - Version 1.1.0
// - Added E key shortcut for togglePointEdit action.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Default Keybinding Definitions
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default Keybinding Map
    // ------------------------------------------------------------
    export const VF__DefaultKeybindings = {
        'undo'        : [{ key: 'z', ctrl: true }],                                  // <-- Ctrl+Z
        'redo'        : [{ key: 'z', ctrl: true, shift: true }, { key: 'y', ctrl: true }], // <-- Ctrl+Shift+Z or Ctrl+Y
        'delete'      : [{ key: 'Backspace' }, { key: 'Delete' }],                   // <-- Backspace or Delete
        'syncCode'    : [{ key: 'Enter', ctrl: true, shift: true }],                 // <-- Ctrl+Shift+Enter
        'tool_select'     : [{ key: 'v' }, { key: 'Escape' }],                     // <-- V or Esc
        'tool_line'       : [{ key: 'l' }],                                          // <-- L
        'tool_rect'       : [{ key: 'r' }],                                          // <-- R
        'tool_path'       : [{ key: 'p' }],                                          // <-- P
        'togglePointEdit' : [{ key: 'e' }],                                          // <-- E
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
