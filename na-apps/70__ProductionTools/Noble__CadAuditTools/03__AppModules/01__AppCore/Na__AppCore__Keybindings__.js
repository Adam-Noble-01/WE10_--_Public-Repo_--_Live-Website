// =============================================================================
// NOBLE CAD AUDIT TOOLS - KEYBINDINGS
// =============================================================================
//
// FILE      : Na__AppCore__Keybindings__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : Keybindings
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Data-driven controls loader + built-in fallback keybindings map
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - THE CONTROLS ARE DATA-DRIVEN: the SSOT is
//   02__AppData/Na__AppData__KeybindingsAndControls__.json — edit that file
//   to rebind any key or mouse behaviour, no code changes required.
// - Na__Keybindings__LoadControls() fetches the JSON at startup and returns
//   the full controls object; the Controls__Keyboard section feeds the
//   HotkeyManager and the rest (mouse, conventions, tool defaults) is stored
//   on AppState.controls for Canvas / ViewBoxController / tools to read.
// - Na__AppCore__DefaultKeybindings remains as the built-in fallback used
//   when the JSON cannot be fetched (e.g. file opened without the server).
// - Key strings use "+" separator and lowercase keys: "ctrl+z", "delete", "h".
//
// ACTION NAMES (EventBus event suffix — emitted as "hotkey:<action>"):
//   tool:select | tool:lasso | tool:pan | tool:dim-linear | tool:dim-aligned
//   view:fit | view:zoom-in | view:zoom-out
//   edit:delete | edit:hard-delete | edit:undo | edit:redo | edit:select-all | edit:deselect
//   file:save-project | file:export-dxf
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.3
// - Added shift+delete / shift+backspace → edit:hard-delete (physical prune).
//
// 07-Jul-2026 - Version 0.3.0
// - Added Na__Keybindings__LoadControls() JSON loader (data-driven SSOT).
// - Default map extended: select/lasso/dimension tools, zoom steps, save/export.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Default Keybindings Map (Fallback When JSON Unavailable)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default Key → Action Binding Map
    // ------------------------------------------------------------
    export const Na__AppCore__DefaultKeybindings = {

        // Tools
        's'          : 'tool:select',         // <-- S key → unified select tool (click/box)
        'l'          : 'tool:lasso',          // <-- L key → freehand lasso select
        'h'          : 'tool:pan',            // <-- H key → activate pan tool
        'd'          : 'tool:dim-linear',     // <-- D key → ortho linear dimension
        'shift+d'    : 'tool:dim-aligned',    // <-- Shift+D → aligned dimension

        // View
        'f'          : 'view:fit',            // <-- F key → fit drawing to viewport
        '+'          : 'view:zoom-in',        // <-- Zoom in one step
        '='          : 'view:zoom-in',        // <-- Unshifted + on most keyboards
        '-'          : 'view:zoom-out',       // <-- Zoom out one step

        // Edit — Delete
        'delete'     : 'edit:delete',         // <-- Delete key → soft-hide selected entities (undoable, stays in file)
        'backspace'  : 'edit:delete',         // <-- Backspace alternative on some keyboards
        'shift+delete'    : 'edit:hard-delete', // <-- Shift+Delete → physically prune from the working DXF (undoable)
        'shift+backspace' : 'edit:hard-delete', // <-- Shift+Backspace alternative

        // Edit — Undo / Redo
        'ctrl+z'     : 'edit:undo',           // <-- Ctrl+Z (Windows/Linux) undo
        'ctrl+y'     : 'edit:redo',           // <-- Ctrl+Y redo
        'ctrl+shift+z' : 'edit:redo',         // <-- Ctrl+Shift+Z redo (Mac convention)

        // Edit — Select All / Deselect
        'ctrl+a'     : 'edit:select-all',     // <-- Ctrl+A select all entities on visible layers
        'escape'     : 'edit:deselect',       // <-- Esc → clear selection / cancel tool action

        // File
        'ctrl+s'     : 'file:save-project',   // <-- Ctrl+S → versioned project save
        'ctrl+e'     : 'file:export-dxf',     // <-- Ctrl+E → download current DXF

    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Data-Driven Controls Loader
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Controls JSON — Returns Full Controls Object
    // ------------------------------------------------------------
    export async function Na__Keybindings__LoadControls() {
        try {
            const response = await fetch('/02__AppData/Na__AppData__KeybindingsAndControls__.json');
            if (!response.ok) throw new Error(`Controls fetch failed: ${response.status}`);

            const controls = await response.json();
            console.log('[Na__Keybindings] Controls loaded from JSON SSOT');
            return controls;

        } catch (err) {
            console.warn('[Na__Keybindings] Controls JSON unavailable — using built-in defaults:', err.message);
            return {
                Controls__Keyboard           : { ...Na__AppCore__DefaultKeybindings },
                Controls__Mouse              : {},
                Controls__BoxSelectConvention: {},
                Controls__ToolDefaults       : {},
            };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Extract the Keyboard Binding Map from a Controls Object
    // ------------------------------------------------------------
    export function Na__Keybindings__ExtractKeyboardMap(controls) {
        const raw = controls?.Controls__Keyboard || {};
        const map = {};
        Object.entries(raw).forEach(([key, action]) => {
            if (key.startsWith('_')) return;                             // <-- Skip _description convention keys
            map[key.toLowerCase()] = action;
        });
        return Object.keys(map).length > 0 ? map : { ...Na__AppCore__DefaultKeybindings };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
