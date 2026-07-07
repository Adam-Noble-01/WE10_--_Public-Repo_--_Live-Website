// =============================================================================
// NOBLE CAD AUDIT TOOLS - SELECTION MANAGER
// =============================================================================
//
// FILE      : Na__AppCore__SelectionManager__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : SelectionManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages entity selection state and visual feedback on the canvas
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Owns the "selected" state for CAD entities on the SVG canvas.
// - Responds to EventBus events from BoxSelectTool (selection:box-complete) and
//   Toolbar (edit:select-all, edit:deselect).
// - Highlights selected SVG elements by adding the CSS class "is-selected".
// - Tracks the full set of selected entity objects in AppState.selectedEntities.
// - Implements Na__SelectionManager__DeleteSelected(): marks selected entities
//   as deleted by adding "is-deleted" CSS class and recording their handles
//   in AppState.deletedHandles for later server-side DXF pruning.
// - Emits "selection:changed" on every selection update.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | SelectionManager Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__SelectionManager {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState  = appState;              // <-- Shared state reference
            this._eventBus  = eventBus;              // <-- EventBus for publishing selection changes
            this._cadCanvas = cadCanvas;             // <-- Canvas for querying SVG DOM elements

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners for Selection-Altering Actions
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('selection:box-complete', (entities) => {
                this.Na__SelectionManager__SetSelection(entities);       // <-- Apply box-select result
            });
            this._eventBus.on('hotkey:edit:select-all', () => {
                this.Na__SelectionManager__SelectAll();                  // <-- Ctrl+A
            });
            this._eventBus.on('hotkey:edit:deselect', () => {
                this.Na__SelectionManager__ClearSelection();             // <-- Escape
            });
            this._eventBus.on('hotkey:edit:delete', () => {
                this.Na__SelectionManager__DeleteSelected();             // <-- Delete / Backspace
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__SelectionManager__ClearSelection();             // <-- Reset on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Set Selection to a Given Array of Entity Objects
        // ------------------------------------------------------------
        Na__SelectionManager__SetSelection(entities) {
            this.Na__SelectionManager__ClearSelectionHighlights();       // <-- Remove old highlights
            this._appState.selectedEntities = entities.filter(
                (e) => !this._appState.deletedHandles.has(e.handle)      // <-- Exclude already-deleted entities
            );
            Na__SelectionManager__ApplyHighlights(this._appState.selectedEntities); // <-- Highlight new selection
            this._eventBus.emit('selection:changed', this._appState.selectedEntities);
        }
        // ------------------------------------------------------------


        // FUNCTION | Select All Visible Entities on All Visible Layers
        // ------------------------------------------------------------
        Na__SelectionManager__SelectAll() {
            const all = this._appState.entities.filter(
                (e) => !this._appState.deletedHandles.has(e.handle)      // <-- Only non-deleted entities
            );
            this.Na__SelectionManager__SetSelection(all);
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear the Current Selection
        // ------------------------------------------------------------
        Na__SelectionManager__ClearSelection() {
            this.Na__SelectionManager__ClearSelectionHighlights();       // <-- Remove CSS highlight class
            this._appState.selectedEntities = [];
            this._eventBus.emit('selection:changed', []);
        }
        // ------------------------------------------------------------


        // FUNCTION | Remove "is-selected" CSS Class from All Highlighted Elements
        // ------------------------------------------------------------
        Na__SelectionManager__ClearSelectionHighlights() {
            const svgRoot = this._cadCanvas?.Na__CadCanvas__GetSvgRoot?.();
            if (!svgRoot) return;
            svgRoot.querySelectorAll('.na-cad-entity.is-selected').forEach((el) => {
                el.classList.remove('is-selected');                      // <-- Remove highlight class
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Mark All Selected Entities as Deleted
        // ------------------------------------------------------------
        Na__SelectionManager__DeleteSelected() {
            if (this._appState.selectedEntities.length === 0) return;   // <-- Nothing to delete

            const svgRoot = this._cadCanvas?.Na__CadCanvas__GetSvgRoot?.();

            this._appState.selectedEntities.forEach((entity) => {
                this._appState.deletedHandles.add(entity.handle);        // <-- Record handle for server prune

                if (svgRoot) {
                    const el = svgRoot.querySelector(`[data-handle="${entity.handle}"]`);
                    if (el) {
                        el.classList.remove('is-selected');              // <-- Remove selected state
                        el.classList.add('is-deleted');                  // <-- Mark as deleted (faded)
                    }
                }
            });

            const deletedCount = this._appState.selectedEntities.length;
            this._appState.selectedEntities = [];
            this._eventBus.emit('selection:changed', []);
            this._eventBus.emit('entity:deleted', {
                handles : [...this._appState.deletedHandles],
                count   : deletedCount,
            });
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Apply "is-selected" CSS Class to Entity SVG Elements
    // ------------------------------------------------------------
    function Na__SelectionManager__ApplyHighlights(entities) {
        entities.forEach((entity) => {
            const el = document.querySelector(`[data-handle="${entity.handle}"]`);
            if (el) el.classList.add('is-selected');                    // <-- Apply yellow highlight
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
