// =============================================================================
// NOBLE CAD AUDIT TOOLS - TOOLBAR
// =============================================================================
//
// FILE      : Na__UI__Toolbar__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : Toolbar
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages toolbar button state and active-tool visual feedback
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Binds click handlers to toolbar buttons:
//     [data-tool]   — select | lasso | pan | dim-linear | dim-aligned
//     [data-action] — zoom-fit | zoom-in | zoom-out | undo | redo
// - Calls appState.setTool() for tools; emits view/edit events for actions.
// - Listens to "tool:changed" to sync the active button highlight.
// - Listens to "history:changed" to enable/disable undo/redo buttons.
// - Hotkey tool-switch events (from the data-driven keybindings JSON) are
//   handled here so keyboard and toolbar stay in sync.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Added lasso, dimension tools, zoom steps, undo/redo action buttons.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Toolbar Class
// -----------------------------------------------------------------------------

    export class Na__UI__Toolbar {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._toolbarEl = document.getElementById('Na__App__Toolbar');

            if (!this._toolbarEl) return;

            this._bindToolButtons();
            this._bindActionButtons();
            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Click Handlers to Tool Buttons
        // ------------------------------------------------------------
        _bindToolButtons() {
            this._toolbarEl.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    this._appState.setTool(btn.dataset.tool);            // <-- Set new active tool via AppState
                });
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Click Handlers to One-Shot Action Buttons
        // ------------------------------------------------------------
        _bindActionButtons() {
            this._toolbarEl.querySelectorAll('[data-action]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    if (action === 'zoom-fit') this._eventBus.emit('view:fit');
                    if (action === 'zoom-in')  this._eventBus.emit('hotkey:view:zoom-in');
                    if (action === 'zoom-out') this._eventBus.emit('hotkey:view:zoom-out');
                    if (action === 'undo')     this._eventBus.emit('hotkey:edit:undo');
                    if (action === 'redo')     this._eventBus.emit('hotkey:edit:redo');
                });
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners for Tool Change and Hotkeys
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('tool:changed', ({ tool }) => {
                this.Na__Toolbar__UpdateActiveButton(tool);              // <-- Sync visual state
            });

            // Hotkey tool switching (actions defined in the keybindings JSON)
            this._eventBus.on('hotkey:tool:pan',         () => this._appState.setTool('pan'));
            this._eventBus.on('hotkey:tool:select',      () => this._appState.setTool('select'));
            this._eventBus.on('hotkey:tool:lasso',       () => this._appState.setTool('lasso'));
            this._eventBus.on('hotkey:tool:dim-linear',  () => this._appState.setTool('dim-linear'));
            this._eventBus.on('hotkey:tool:dim-aligned', () => this._appState.setTool('dim-aligned'));

            // Undo/redo availability drives button disabled state
            this._eventBus.on('history:changed', ({ canUndo, canRedo }) => {
                const undoBtn = this._toolbarEl.querySelector('[data-action="undo"]');
                const redoBtn = this._toolbarEl.querySelector('[data-action="redo"]');
                if (undoBtn) undoBtn.disabled = !canUndo;
                if (redoBtn) redoBtn.disabled = !canRedo;
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Which Toolbar Button Has the "active" CSS Class
        // ------------------------------------------------------------
        Na__Toolbar__UpdateActiveButton(activeTool) {
            if (!this._toolbarEl) return;
            this._toolbarEl.querySelectorAll('[data-tool]').forEach((btn) => {
                const isTool = btn.dataset.tool === activeTool;
                btn.classList.toggle('active', isTool);                 // <-- Apply/remove active class
            });
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
