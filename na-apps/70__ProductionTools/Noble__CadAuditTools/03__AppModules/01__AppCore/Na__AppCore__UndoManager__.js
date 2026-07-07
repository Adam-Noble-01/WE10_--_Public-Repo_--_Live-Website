// =============================================================================
// NOBLE CAD AUDIT TOOLS - UNDO MANAGER
// =============================================================================
//
// FILE      : Na__AppCore__UndoManager__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : UndoManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Records editor operations and supports Undo / Redo with hot-cache persistence
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Maintains an undo stack and a redo stack of command objects
//   { type, execute(), undo(), describe() }.
// - COMMAND TYPES RECORDED:
//     delete            — entity unit soft-deletions (entity:deleted)
//     dimension-add     — dimension creation         (dimension:created)
//     dimension-remove  — dimension deletion         (dimension:deleted)
//     hard-delete       — physical DXF prune, pushed directly by EntityPruner
//                          via the generic Na__UndoManager__PushCommand() entry
//                          point (see Na__CadEngine__EntityPruner__.js)
// - Responds to "hotkey:edit:undo" and "hotkey:edit:redo" on the EventBus.
// - STACK DEPTH is read from Config__UndoRedo.MaxDepth (default 50) — a single
//   user-adjustable setting in the app config SSOT.
// - HOT CACHE: after every recorded action the full audit state (deleted
//   handles + dimensions) is POSTed fire-and-forget to /api/undo-cache, which
//   writes a JSON snapshot into 04__LocalProjectCache/03__HotCache__UndoRedoStates/
//   (trimmed server-side) — an accidental reload never loses the session.
// - Emits "undo:applied" / "redo:applied" and "history:changed" for the UI.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.3
// - Added Na__UndoManager__PushCommand() — generic public entry point so
//   feature modules (EntityPruner) can register their own command objects
//   without a dedicated Record* wrapper.
//
// 07-Jul-2026 - Version 0.3.0
// - Config-driven depth (Config__UndoRedo.MaxDepth, default 50).
// - Dimension add/remove commands recorded alongside deletions.
// - Hot-cache state persistence after every action.
// - history:changed event for toolbar undo/redo button states.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Stack Configuration Fallback
    // ------------------------------------------------------------
    const Na__UNDO_DEFAULT_DEPTH = 50; // <-- Used when Config__UndoRedo.MaxDepth is absent
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UndoManager Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__UndoManager {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState   = appState;              // <-- Shared state (deletedHandles, dimensions)
            this._eventBus   = eventBus;              // <-- EventBus for undo/redo hotkey events
            this._cadCanvas  = cadCanvas;             // <-- SVG DOM for class manipulation

            this._undoStack  = [];                    // <-- Array of command objects (most recent last)
            this._redoStack  = [];                    // <-- Array of undone commands (most recent last)

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('entity:deleted', ({ handles }) => {
                this.Na__UndoManager__RecordDelete(handles);             // <-- Record new deletion command
            });
            this._eventBus.on('dimension:created', ({ dimension }) => {
                this.Na__UndoManager__RecordDimensionAdd(dimension);     // <-- Record dimension creation
            });
            this._eventBus.on('dimension:deleted', ({ dimension }) => {
                this.Na__UndoManager__RecordDimensionRemove(dimension);  // <-- Record dimension removal
            });
            this._eventBus.on('hotkey:edit:undo', () => {
                this.Na__UndoManager__Undo();
            });
            this._eventBus.on('hotkey:edit:redo', () => {
                this.Na__UndoManager__Redo();
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__UndoManager__Clear();                           // <-- Reset history on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Push a Pre-Built Command onto the Undo Stack (Generic Entry Point)
        // ------------------------------------------------------------
        Na__UndoManager__PushCommand(command) {
            if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
                console.error('[Na__UndoManager] PushCommand requires { type, execute(), undo() }');
                return;
            }
            this._pushCommand(command);                                  // <-- Same depth/redo-reset/hot-cache path as Record*
        }
        // ------------------------------------------------------------


        // FUNCTION | Record an Entity Deletion Command onto the Undo Stack
        // ------------------------------------------------------------
        Na__UndoManager__RecordDelete(handles) {
            if (!handles || handles.length === 0) return;

            const snapshot = [...handles];                               // <-- Only THIS action's handles

            this._pushCommand({
                type    : 'delete',

                execute : () => {
                    snapshot.forEach((handle) => {
                        this._appState.deletedHandles.add(handle);       // <-- Re-apply deletion
                        this._setDeletedClass(handle, true);             // <-- Fade entity
                    });
                },

                undo : () => {
                    snapshot.forEach((handle) => {
                        this._appState.deletedHandles.delete(handle);    // <-- Restore entity
                        this._setDeletedClass(handle, false);            // <-- Remove fade
                    });
                },
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Record a Dimension Creation Command
        // ------------------------------------------------------------
        Na__UndoManager__RecordDimensionAdd(dimension) {
            if (!dimension) return;

            this._pushCommand({
                type    : 'dimension-add',
                execute : () => this._eventBus.emit('dimension:restore', { dimension, silent: true }),
                undo    : () => this._eventBus.emit('dimension:remove',  { id: dimension.id, silent: true }),
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Record a Dimension Removal Command
        // ------------------------------------------------------------
        Na__UndoManager__RecordDimensionRemove(dimension) {
            if (!dimension) return;

            this._pushCommand({
                type    : 'dimension-remove',
                execute : () => this._eventBus.emit('dimension:remove',  { id: dimension.id, silent: true }),
                undo    : () => this._eventBus.emit('dimension:restore', { dimension, silent: true }),
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Undo the Most Recent Command
        // ------------------------------------------------------------
        Na__UndoManager__Undo() {
            const command = this._undoStack.pop();
            if (!command) return;                                        // <-- Nothing to undo
            command.undo();
            this._redoStack.push(command);                               // <-- Push to redo stack
            this._eventBus.emit('undo:applied', { type: command.type });
            this._afterHistoryChange();
        }
        // ------------------------------------------------------------


        // FUNCTION | Redo the Most Recently Undone Command
        // ------------------------------------------------------------
        Na__UndoManager__Redo() {
            const command = this._redoStack.pop();
            if (!command) return;                                        // <-- Nothing to redo
            command.execute();
            this._undoStack.push(command);                               // <-- Push back to undo stack
            this._eventBus.emit('redo:applied', { type: command.type });
            this._afterHistoryChange();
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear All Stacks
        // ------------------------------------------------------------
        Na__UndoManager__Clear() {
            this._undoStack = [];
            this._redoStack = [];
            this._emitHistoryState();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Push a Command, Enforce Depth, Reset Redo
        // ------------------------------------------------------------
        _pushCommand(command) {
            this._undoStack.push(command);
            const maxDepth = this._appState.config?.Config__UndoRedo?.MaxDepth ?? Na__UNDO_DEFAULT_DEPTH;
            while (this._undoStack.length > maxDepth) {
                this._undoStack.shift();                                 // <-- Discard oldest when over limit
            }
            this._redoStack = [];                                        // <-- New action invalidates redo chain
            this._afterHistoryChange();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Emit History State and Persist to the Hot Cache
        // ------------------------------------------------------------
        _afterHistoryChange() {
            this._emitHistoryState();
            this._persistToHotCache();                                   // <-- Fire-and-forget snapshot
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Notify UI of Undo/Redo Availability
        // ------------------------------------------------------------
        _emitHistoryState() {
            this._eventBus.emit('history:changed', {
                canUndo : this._undoStack.length > 0,
                canRedo : this._redoStack.length > 0,
                depth   : this._undoStack.length,
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | POST the Current Audit State to the Hot Cache
        // ------------------------------------------------------------
        _persistToHotCache() {
            const enabled = this._appState.config?.Config__UndoRedo?.HotCache__Enabled !== false;
            if (!enabled || !this._appState.fileLoaded) return;

            const payload = {
                fileName       : this._appState.fileName,
                tempDxfPath    : this._appState.tempDxfPath,
                deletedHandles : [...this._appState.deletedHandles],
                dimensions     : this._appState.dimensions || [],
                undoDepth      : this._undoStack.length,
            };

            fetch('/api/undo-cache', {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(payload),
            }).catch(() => { /* fire-and-forget — hot cache must never block editing */ });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Set or Remove "is-deleted" CSS Class on a Unit Element
        // ------------------------------------------------------------
        _setDeletedClass(handle, isDeleted) {
            const svgRoot = this._cadCanvas?.Na__CadCanvas__GetSvgRoot?.();
            if (!svgRoot) return;
            const el = svgRoot.querySelector(`[data-handle="${CSS.escape(handle)}"]`);
            if (!el) return;
            el.classList.toggle('is-deleted', isDeleted);                // <-- Fade / restore the whole unit
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
