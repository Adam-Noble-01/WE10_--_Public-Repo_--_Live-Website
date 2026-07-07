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
// - Binds click handlers to toolbar tool buttons ([data-tool] attributes).
// - Calls appState.setTool() to change active tool.
// - Listens to "tool:changed" EventBus events to update .active CSS class.
// - Handles the zoom-fit action by emitting "view:fit" on the EventBus.
// - Delete button state is managed by Main bootstrap responding to "selection:changed".
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Click Handlers to Tool Buttons
        // ------------------------------------------------------------
        _bindToolButtons() {
            this._toolbarEl.querySelectorAll('[data-tool]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const tool = btn.dataset.tool;

                    if (tool === 'zoom-fit') {
                        this._eventBus.emit('view:fit');                 // <-- Fit action is not a "tool"
                        return;
                    }

                    this._appState.setTool(tool);                        // <-- Set new active tool via AppState
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
            this._eventBus.on('hotkey:tool:pan',          () => this._appState.setTool('pan'));
            this._eventBus.on('hotkey:tool:box-window',   () => this._appState.setTool('box-window'));
            this._eventBus.on('hotkey:tool:box-crossing', () => this._appState.setTool('box-crossing'));
            this._eventBus.on('hotkey:view:fit',          () => this._eventBus.emit('view:fit'));
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
