// =============================================================================
// NOBLE CAD AUDIT TOOLS - ENTITY PRUNER
// =============================================================================
//
// FILE      : Na__CadEngine__EntityPruner__.js
// NAMESPACE : CadAuditTools.CadEngine
// MODULE    : EntityPruner
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Undoable HARD delete — physically prunes selected entities from
//             the working DXF on disk (Shift+Delete), shrinking the working
//             file so editing very large drawings stays fast.
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - The existing Delete key (SelectionManager) is a SOFT delete: entities stay
//   in the working file and are only faded client-side until Save/Export.
// - Shift+Delete (this module) is a HARD delete: the selected units are
//   physically removed from the WORKING DXF on the server ("/api/prune-working")
//   so the file itself gets smaller — the whole point being faster load/parse/
//   render/save cycles on files with tens of thousands of entities.
// - Listens for "hotkey:edit:hard-delete" (Shift+Delete / Shift+Backspace).
// - Resolves the current selection to UNIT handles (INSERT children resolve
//   to their parent, same convention as SelectionManager/Canvas hit-testing).
// - Server round-trip ordering (initial action):
//     1. POST /api/prune-working — server backs up the working file, then
//        prunes it in place. Awaited BEFORE any local mutation, so the model
//        is only ever changed once the file write has actually succeeded.
//     2. Remove the records from AppState.entities/entityByHandle, remove the
//        matching elements from the SVG canvas, and decrement per-layer
//        entityCount — all WITHOUT re-parsing or re-rendering the whole file.
//     3. Clear the selection and refresh stats/layers UI.
// - UNDO restores the exact pre-prune working file via "/api/restore-working"
//   (server-side backup token) and re-adds the removed records to the model
//   and canvas. REDO re-prunes and re-removes, taking a fresh backup each time
//   so a further undo always has a correct snapshot to restore.
// - Pushes its own "hard-delete" command directly via the UndoManager's
//   generic Na__UndoManager__PushCommand() — SelectionManager is not involved,
//   keeping soft-delete and hard-delete concerns fully separate.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.3
// - Initial release — undoable physical prune of the working DXF.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | EntityPruner Class
// -----------------------------------------------------------------------------

    export class Na__CadEngine__EntityPruner {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas, selectionManager, undoManager, progressOverlay) {
            this._appState         = appState;
            this._eventBus         = eventBus;
            this._cadCanvas        = cadCanvas;
            this._selectionManager = selectionManager;
            this._undoManager      = undoManager;
            this._progressOverlay  = progressOverlay;

            this._isPruning = false;                                    // <-- Guards against overlapping prune requests

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('hotkey:edit:hard-delete', () => {
                this._onHardDelete();                                   // <-- Shift+Delete / Shift+Backspace
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle the Hard-Delete Hotkey — Prune the Current Selection
        // ------------------------------------------------------------
        async _onHardDelete() {
            if (this._isPruning) return;                                // <-- Ignore repeat presses mid-flight

            const selected = this._appState.selectedEntities || [];
            if (selected.length === 0) return;                          // <-- Nothing selected, nothing to do

            if (!this._appState.tempDxfPath) {
                console.warn('[Na__EntityPruner] No working file path on AppState — cannot hard delete');
                return;
            }

            const unitHandles = selected.map((entity) => entity.handle);
            const countLabel  = unitHandles.length === 1 ? 'entity' : 'entities';

            this._isPruning = true;
            this._progressOverlay.Na__ProgressOverlay__Show(
                this._appState.fileName,
                `Removing ${unitHandles.length} ${countLabel} from file…`,
                { allowCancel: false }                                   // <-- Quick + always undoable, no cancel needed
            );
            this._progressOverlay.Na__ProgressOverlay__Update({
                stage   : 'converting',
                message : 'Physically pruning the working file on disk…',
                percent : null,
            });

            try {
                const backupId = await this._pruneWorkingFile(this._appState.tempDxfPath, unitHandles);

                // ONLY mutate the local model once the server-side prune has actually succeeded
                const removed = this._extractRecordsToRemove(unitHandles);
                this._cadCanvas.Na__CadCanvas__RemoveEntitiesByHandles(unitHandles);
                this._adjustLayerCounts(removed, -1);
                this._selectionManager.Na__SelectionManager__ClearSelection();
                this._emitStatsAndLayersRefresh();

                this._progressOverlay.Na__ProgressOverlay__Hide();
                this._pushHardDeleteCommand(unitHandles, removed, backupId);

            } catch (err) {
                console.error('[Na__EntityPruner] Hard delete failed:', err);
                this._progressOverlay.Na__ProgressOverlay__ShowError(
                    err.message || 'Hard delete failed — the file was not modified.'
                );
            } finally {
                this._isPruning = false;
            }
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Push the Undoable Hard-Delete Command
        // ------------------------------------------------------------
        _pushHardDeleteCommand(unitHandles, initialRemoved, initialBackupId) {
            let removed  = initialRemoved;                              // <-- Reassigned on each redo re-extraction
            let backupId = initialBackupId;                             // <-- Reassigned on each redo's fresh backup

            this._undoManager.Na__UndoManager__PushCommand({
                type : 'hard-delete',

                // UNDO | Restore the working file from backup + re-add the removed records
                undo : () => {
                    this._reinsertRecords(removed);
                    this._cadCanvas.Na__CadCanvas__AddEntities(removed);
                    this._adjustLayerCounts(removed, +1);
                    this._emitStatsAndLayersRefresh();

                    this._restoreWorkingFile(backupId).catch((err) => {
                        console.error('[Na__EntityPruner] Undo restore-working failed:', err);
                        this._progressOverlay.Na__ProgressOverlay__ShowError(
                            `Undo restored the drawing, but the working file on disk could not be reverted: ${err.message}`
                        );
                    });
                },

                // REDO | Re-prune the working file + re-remove the same records
                execute : () => {
                    removed = this._extractRecordsToRemove(unitHandles);
                    this._cadCanvas.Na__CadCanvas__RemoveEntitiesByHandles(unitHandles);
                    this._adjustLayerCounts(removed, -1);
                    this._emitStatsAndLayersRefresh();

                    this._pruneWorkingFile(this._appState.tempDxfPath, unitHandles)
                        .then((newBackupId) => { backupId = newBackupId; })  // <-- Keep undo pointed at the latest backup
                        .catch((err) => {
                            console.error('[Na__EntityPruner] Redo prune-working failed:', err);
                            this._progressOverlay.Na__ProgressOverlay__ShowError(
                                `Redo updated the drawing, but the working file on disk could not be re-pruned: ${err.message}`
                            );
                        });
                },
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | POST /api/prune-working — Backup Then Prune In Place
        // ------------------------------------------------------------
        async _pruneWorkingFile(tempDxfPath, unitHandles) {
            const response = await fetch('/api/prune-working', {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify({ tempDxfPath, handles: unitHandles }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
            return data.backupId;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | POST /api/restore-working — Undo a Prune from Backup
        // ------------------------------------------------------------
        async _restoreWorkingFile(backupId) {
            const response = await fetch('/api/restore-working', {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify({ tempDxfPath: this._appState.tempDxfPath, backupId }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
            return data;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Remove Target Units (+ Children) from the In-Memory Model
        // ------------------------------------------------------------
        _extractRecordsToRemove(unitHandles) {
            const unitSet = new Set(unitHandles);
            const removed = [];
            const kept    = [];

            this._appState.entities.forEach((entity) => {
                const isUnit  = !entity.parentHandle && unitSet.has(entity.handle);
                const isChild = entity.parentHandle && unitSet.has(entity.parentHandle);
                if (isUnit || isChild) {
                    removed.push(entity);                                // <-- Preserves original parent-before-child order
                } else {
                    kept.push(entity);
                }
            });

            this._appState.entities = kept;

            unitHandles.forEach((handle) => {
                this._appState.entityByHandle.delete(handle);
                this._appState.deletedHandles.delete(handle);            // <-- A stale soft-delete flag would be meaningless now
            });

            return removed;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Re-Add Previously Removed Records to the In-Memory Model
        // ------------------------------------------------------------
        _reinsertRecords(records) {
            records.forEach((record) => {
                this._appState.entities.push(record);
                if (!record.parentHandle) {
                    this._appState.entityByHandle.set(record.handle, record); // <-- Only units are indexed by handle
                }
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Adjust Per-Layer Entity Counts for Removed/Restored Units
        // ------------------------------------------------------------
        _adjustLayerCounts(records, delta) {
            records.forEach((record) => {
                if (record.parentHandle) return;                         // <-- Only units are counted (matches server-side DxfEngine)
                const layerData = this._appState.layers.get(record.layer);
                if (layerData) layerData.entityCount = Math.max(0, (layerData.entityCount || 0) + delta);
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Notify Status Bar and Layers Panel of Model Changes
        // ------------------------------------------------------------
        _emitStatsAndLayersRefresh() {
            this._eventBus.emit('file:stats', {
                entityCount : this._appState.entities.length,             // <-- Status bar total readout
                unitCount   : this._appState.entityByHandle.size,
            });
            this._eventBus.emit('layers:refresh');                        // <-- LayersPanel re-renders counts
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
