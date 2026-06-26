// =============================================================================
// VECTORFORGE - PANEL RESIZE HANDLE
// =============================================================================
//
// FILE      : VF__UI__PanelResizeHandle__.js
// NAMESPACE : VectorForge.UI
// MODULE    : PanelResizeHandle
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Drag-to-resize the right panel wider or narrower
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Attaches a mousedown listener to the #panel-resize-handle strip.
// - On drag, computes the new right-panel width from the pointer X position.
// - Clamps the width between MIN_WIDTH and MAX_WIDTH.
// - Persists the last-used width to localStorage so it survives page reloads.
// - Applies a .is-dragging class during the drag for CSS highlight feedback.
// - Prevents text selection and cursor flicker on the document during drag.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Panel Resize Handle — Drag-to-Resize Right Panel
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Width Clamp Limits and Storage Key
    // ------------------------------------------------------------
    const MIN_WIDTH     = 180;                          // <-- Minimum panel width in px
    const MAX_WIDTH     = 640;                          // <-- Maximum panel width in px
    const STORAGE_KEY   = 'vf_right_panel_width';      // <-- localStorage key for persisted width
    const DEFAULT_WIDTH = 256;                          // <-- Fallback width if no stored value
    // ------------------------------------------------------------


    // FUNCTION | Initialise Panel Resize Handle
    // ------------------------------------------------------------
    export function VF__PanelResizeHandle__Init() {

        const panel  = document.getElementById('right-panel');        // <-- The resizable aside
        const handle = document.getElementById('panel-resize-handle'); // <-- The draggable strip

        if (!panel || !handle) return; // <-- Guard: exit if elements missing

        Na__PanelResize__RestoreWidth(panel); // <-- Restore last-used width on load
        Na__PanelResize__AttachDragListener(panel, handle); // <-- Wire up drag interaction
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Restore Persisted Width from localStorage
    // ------------------------------------------------------------
    function Na__PanelResize__RestoreWidth(panel) {
        const stored = localStorage.getItem(STORAGE_KEY); // <-- Read stored width
        const width  = stored ? parseInt(stored, 10) : DEFAULT_WIDTH; // <-- Parse or fall back
        panel.style.width = `${Na__PanelResize__Clamp(width)}px`; // <-- Apply clamped width
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clamp a Value Between Min and Max
    // ------------------------------------------------------------
    function Na__PanelResize__Clamp(value) {
        return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)); // <-- Clamp between bounds
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Attach mousedown Drag Listener to Handle
    // ------------------------------------------------------------
    function Na__PanelResize__AttachDragListener(panel, handle) {

        handle.addEventListener('mousedown', (startEvent) => {

            startEvent.preventDefault(); // <-- Prevent text selection on drag start

            const startX      = startEvent.clientX;               // <-- Pointer X at drag start
            const startWidth  = panel.getBoundingClientRect().width; // <-- Panel width at drag start

            handle.classList.add('is-dragging');                  // <-- Highlight handle
            document.body.style.cursor     = 'col-resize';        // <-- Lock cursor globally
            document.body.style.userSelect = 'none';              // <-- Prevent text highlight

            // SUB FUNCTION | Handle mousemove During Drag
            // ---------------------------------------------------------------
            function Na__PanelResize__OnMouseMove(moveEvent) {
                const delta    = startX - moveEvent.clientX;          // <-- Dragging left = positive delta = wider
                const newWidth = Na__PanelResize__Clamp(startWidth + delta); // <-- Clamp new width
                panel.style.width = `${newWidth}px`;                  // <-- Apply live resize
            }
            // ---------------------------------------------------------------

            // SUB FUNCTION | Handle mouseup — End Drag
            // ---------------------------------------------------------------
            function Na__PanelResize__OnMouseUp() {
                document.removeEventListener('mousemove', Na__PanelResize__OnMouseMove); // <-- Detach move listener
                document.removeEventListener('mouseup',   Na__PanelResize__OnMouseUp);   // <-- Detach self

                handle.classList.remove('is-dragging');             // <-- Remove highlight
                document.body.style.cursor     = '';               // <-- Restore global cursor
                document.body.style.userSelect = '';               // <-- Restore text selection

                const finalWidth = parseInt(panel.style.width, 10);
                localStorage.setItem(STORAGE_KEY, finalWidth);     // <-- Persist final width
            }
            // ---------------------------------------------------------------

            document.addEventListener('mousemove', Na__PanelResize__OnMouseMove); // <-- Listen globally during drag
            document.addEventListener('mouseup',   Na__PanelResize__OnMouseUp);   // <-- Listen globally during drag

        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
