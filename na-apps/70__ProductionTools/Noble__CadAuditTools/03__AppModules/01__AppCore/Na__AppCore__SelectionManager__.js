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
// - Owns the "selected" state for CAD entities. Selection operates on UNIT
//   handles: a unit is a standalone entity, or a whole INSERT block reference
//   (exploded children resolve to their parentHandle).
// - Responds to EventBus events:
//     selection:box-complete { unitHandles[], additive } — Box/Lasso tools
//     selection:click        { unitHandle|null, additive } — click select
//     hotkey:edit:select-all / hotkey:edit:deselect / hotkey:edit:delete
//     layer:visibility-changed — drops hidden-layer units from the selection
// - Highlights selected SVG elements via the "is-selected" CSS class on the
//   [data-handle] element (group highlight covers INSERT children).
// - Na__SelectionManager__DeleteSelected(): marks units deleted (faded via
//   "is-deleted"), records handles in AppState.deletedHandles, and emits
//   "entity:deleted" with ONLY the newly deleted handles (undo-friendly).
// - Emits "selection:changed" with the selected unit entity records.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Unit-handle selection model (INSERT blocks select as one unit).
// - Additive (Shift) selection, click select/toggle, hidden-layer filtering.
// - entity:deleted now carries only the newly deleted handles.
//
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

            this._selectedHandles = new Set();       // <-- Currently selected unit handle strings

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners for Selection-Altering Actions
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('selection:box-complete', ({ unitHandles, additive }) => {
                if (additive) {
                    this.Na__SelectionManager__AddToSelection(unitHandles);      // <-- Shift extends
                } else {
                    this.Na__SelectionManager__SetSelection(unitHandles);        // <-- Replace selection
                }
            });
            this._eventBus.on('selection:click', ({ unitHandle, additive }) => {
                this.Na__SelectionManager__HandleClick(unitHandle, additive);
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
            this._eventBus.on('layer:visibility-changed', ({ layer, visible }) => {
                if (!visible) this._dropLayerFromSelection(layer);       // <-- Hidden layers deselect
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__SelectionManager__ClearSelection();             // <-- Reset on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Set Selection to a Given Array of Unit Handles
        // ------------------------------------------------------------
        Na__SelectionManager__SetSelection(unitHandles) {
            this._selectedHandles = new Set(
                (unitHandles || []).filter((h) => !this._appState.deletedHandles.has(h))
            );
            this._syncSelectionState();
        }
        // ------------------------------------------------------------


        // FUNCTION | Add Unit Handles to the Existing Selection (Shift Drag)
        // ------------------------------------------------------------
        Na__SelectionManager__AddToSelection(unitHandles) {
            (unitHandles || []).forEach((h) => {
                if (!this._appState.deletedHandles.has(h)) this._selectedHandles.add(h);
            });
            this._syncSelectionState();
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle a Click Select — Set, Toggle, or Clear
        // ------------------------------------------------------------
        Na__SelectionManager__HandleClick(unitHandle, additive) {
            if (!unitHandle) {
                if (!additive) this.Na__SelectionManager__ClearSelection(); // <-- Empty click clears (unless Shift)
                return;
            }

            if (additive) {
                if (this._selectedHandles.has(unitHandle)) {
                    this._selectedHandles.delete(unitHandle);            // <-- Shift-click toggles off
                } else {
                    this._selectedHandles.add(unitHandle);
                }
            } else {
                this._selectedHandles = new Set([unitHandle]);           // <-- Plain click replaces
            }
            this._syncSelectionState();
        }
        // ------------------------------------------------------------


        // FUNCTION | Select All Visible Units on All Visible Layers
        // ------------------------------------------------------------
        Na__SelectionManager__SelectAll() {
            const handles = [];
            this._appState.entities.forEach((entity) => {
                if (entity.parentHandle) return;                         // <-- Children resolve via parent
                if (this._appState.deletedHandles.has(entity.handle)) return;
                const layerData = this._appState.layers.get(entity.layer);
                if (layerData && layerData.visible === false) return;    // <-- Skip hidden layers
                handles.push(entity.handle);
            });
            this.Na__SelectionManager__SetSelection(handles);
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear the Current Selection
        // ------------------------------------------------------------
        Na__SelectionManager__ClearSelection() {
            this._selectedHandles = new Set();
            this._syncSelectionState();
        }
        // ------------------------------------------------------------


        // FUNCTION | Mark All Selected Units as Deleted
        // ------------------------------------------------------------
        Na__SelectionManager__DeleteSelected() {
            if (this._selectedHandles.size === 0) return;                // <-- Nothing to delete

            const deletedNow = [...this._selectedHandles];

            deletedNow.forEach((handle) => {
                this._appState.deletedHandles.add(handle);               // <-- Record handle for server prune
                const el = this._queryHandleElement(handle);
                if (el) {
                    el.classList.remove('is-selected');
                    el.classList.add('is-deleted');                      // <-- Fade the whole unit
                }
            });

            this._selectedHandles = new Set();
            this._eventBus.emit('selection:changed', []);
            this._eventBus.emit('entity:deleted', {
                handles : deletedNow,                                    // <-- ONLY this action's handles (undo unit)
                count   : deletedNow.length,
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Push Selection State to DOM and EventBus
        // ------------------------------------------------------------
        _syncSelectionState() {
            const svgRoot = this._cadCanvas?.Na__CadCanvas__GetSvgRoot?.();

            // Clear old highlights
            if (svgRoot) {
                svgRoot.querySelectorAll('.na-cad-entity.is-selected').forEach((el) => {
                    if (!this._selectedHandles.has(el.getAttribute('data-handle'))) {
                        el.classList.remove('is-selected');
                    }
                });
            }

            // Apply new highlights and resolve entity records
            const selectedEntities = [];
            this._selectedHandles.forEach((handle) => {
                const el = this._queryHandleElement(handle);
                if (el) el.classList.add('is-selected');
                const record = this._appState.entityByHandle?.get(handle);
                if (record) selectedEntities.push(record);
            });

            this._appState.selectedEntities = selectedEntities;
            this._eventBus.emit('selection:changed', selectedEntities);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Drop All Units on a Layer from the Selection
        // ------------------------------------------------------------
        _dropLayerFromSelection(layerName) {
            let changed = false;
            this._selectedHandles.forEach((handle) => {
                const record = this._appState.entityByHandle?.get(handle);
                if (record && record.layer === layerName) {
                    this._selectedHandles.delete(handle);
                    changed = true;
                }
            });
            if (changed) this._syncSelectionState();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Query the SVG Element Carrying a Unit Handle
        // ------------------------------------------------------------
        _queryHandleElement(handle) {
            const svgRoot = this._cadCanvas?.Na__CadCanvas__GetSvgRoot?.();
            if (!svgRoot) return null;
            return svgRoot.querySelector(`[data-handle="${CSS.escape(handle)}"]`);
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
