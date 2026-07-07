// =============================================================================
// NOBLE CAD AUDIT TOOLS - UNDO MANAGER
// =============================================================================
//
// FILE      : Na__AppCore__UndoManager__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : UndoManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Records entity deletion operations and supports Undo / Redo
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Maintains an undo stack (Array of commands) and a redo stack.
// - Each "command" is a plain object: { type, handles, execute(), undo() }.
// - Currently only tracks deletion commands (entity:deleted events).
// - Responds to "hotkey:edit:undo" and "hotkey:edit:redo" on the EventBus.
// - Undo restores deleted entities by removing handles from
//   AppState.deletedHandles and removing the "is-deleted" CSS class.
// - Redo re-applies the deletion.
// - Stack depth is capped at Na__UNDO_MAX_DEPTH to prevent memory growth.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Stack Configuration
    // ------------------------------------------------------------
    const Na__UNDO_MAX_DEPTH = 100; // <-- Maximum history steps to keep in memory
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UndoManager Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__UndoManager {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState   = appState;              // <-- Shared state (deletedHandles)
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


        // FUNCTION | Record a Deletion Command onto the Undo Stack
        // ------------------------------------------------------------
        Na__UndoManager__RecordDelete(handles) {
            if (!handles || handles.length === 0) return;

            const command = {
                type    : 'delete',
                handles : [...handles],                                   // <-- Snapshot the handles array

                execute : () => {
                    handles.forEach((handle) => {
                        this._appState.deletedHandles.add(handle);        // <-- Re-apply deletion
                        Na__UndoManager__SetDeletedClass(handle, true);   // <-- Fade entity
                    });
                },

                undo : () => {
                    handles.forEach((handle) => {
                        this._appState.deletedHandles.delete(handle);     // <-- Restore entity
                        Na__UndoManager__SetDeletedClass(handle, false);  // <-- Remove fade
                    });
                },
            };

            this._undoStack.push(command);                                // <-- Push onto undo stack
            if (this._undoStack.length > Na__UNDO_MAX_DEPTH) {
                this._undoStack.shift();                                  // <-- Discard oldest when at limit
            }
            this._redoStack = [];                                         // <-- Clear redo on new action
        }
        // ------------------------------------------------------------


        // FUNCTION | Undo the Most Recent Command
        // ------------------------------------------------------------
        Na__UndoManager__Undo() {
            const command = this._undoStack.pop();
            if (!command) return;                                         // <-- Nothing to undo
            command.undo();
            this._redoStack.push(command);                                // <-- Push to redo stack
            this._eventBus.emit('undo:applied', { type: command.type }); // <-- Notify status bar
        }
        // ------------------------------------------------------------


        // FUNCTION | Redo the Most Recently Undone Command
        // ------------------------------------------------------------
        Na__UndoManager__Redo() {
            const command = this._redoStack.pop();
            if (!command) return;                                         // <-- Nothing to redo
            command.execute();
            this._undoStack.push(command);                                // <-- Push back to undo stack
            this._eventBus.emit('redo:applied', { type: command.type }); // <-- Notify status bar
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear All Stacks
        // ------------------------------------------------------------
        Na__UndoManager__Clear() {
            this._undoStack = [];
            this._redoStack = [];
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Set or Remove "is-deleted" CSS Class on an SVG Entity
    // ------------------------------------------------------------
    function Na__UndoManager__SetDeletedClass(handle, isDeleted) {
        const el = document.querySelector(`[data-handle="${handle}"]`);
        if (!el) return;
        if (isDeleted) {
            el.classList.add('is-deleted');                               // <-- Fade the entity
        } else {
            el.classList.remove('is-deleted');                            // <-- Restore to full opacity
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
