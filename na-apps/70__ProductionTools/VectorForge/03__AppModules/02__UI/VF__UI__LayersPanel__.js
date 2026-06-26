// =============================================================================
// VECTORFORGE - LAYERS PANEL UI
// =============================================================================
//
// FILE      : VF__UI__LayersPanel__.js
// NAMESPACE : VectorForge.UI
// MODULE    : LayersPanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Renders the layers list and handles layer add, rename, and delete
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Listens to layers:changed on the EventBus and re-renders the layer list
//   to reflect the current layer stack order and active state.
// - The Add Layer button creates a new numbered layer via AppState.
// - Right-clicking a layer item shows a context menu for rename and delete.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | LayersPanel UI Class
// -----------------------------------------------------------------------------

    // CLASS | LayersPanelUI — Layer List Renderer and Interaction Controller
    // ------------------------------------------------------------
    export class LayersPanelUI {

        // FUNCTION | Constructor — Bind DOM Elements and Register Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this.appState = appState;                                       // <-- App state reference
            this.eventBus = eventBus;                                       // <-- Event bus reference
            this.listEl   = document.getElementById('layer-list');         // <-- Layer list container
            this.addBtn   = document.getElementById('add-layer-btn');      // <-- Add layer button

            this.addBtn.addEventListener('click', () => {
                this.appState.addLayer('Layer ' + (this.appState.layers.length + 1)); // <-- Add numbered layer
            });

            this.eventBus.on('layers:changed', (layers) => this._render(layers)); // <-- Re-render on change

            this._render(this.appState.layers); // <-- Initial render on load
        }
        // ------------------------------------------------------------


        // FUNCTION | Render — Rebuild the Layer List DOM
        // ------------------------------------------------------------
        _render(layers) {
            this.listEl.innerHTML = '';
            layers.forEach(l => {
                const isActive  = l.id === this.appState.activeLayerId;
                const iconColor = isActive ? 'var(--color-blue-600)' : 'var(--color-slate-400)';

                const div = document.createElement('div');
                div.className = 'layer-item' + (isActive ? ' active' : '');
                div.innerHTML = `
                    <div style="width:12px;height:12px;margin-right:8px;flex-shrink:0;color:${iconColor}">
                        <svg fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/></svg>
                    </div>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.name}</span>
                `;

                div.addEventListener('click', () => this.appState.setActiveLayer(l.id));
                div.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this._showContextMenu(e.pageX, e.pageY, l.id); // <-- Show rename/delete context menu
                });

                this.listEl.appendChild(div);
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | ShowContextMenu — Display Layer Action Menu at Cursor Position
        // ------------------------------------------------------------
        _showContextMenu(x, y, layerId) {
            const existing = document.getElementById('vf-layer-context-menu');
            if (existing) existing.remove(); // <-- Remove any previously open context menu

            const menu = document.createElement('div');
            menu.id                  = 'vf-layer-context-menu';
            menu.style.position      = 'fixed';
            menu.style.left          = x + 'px';
            menu.style.top           = y + 'px';
            menu.style.background    = '#2d2d2d';
            menu.style.border        = '1px solid #3d3d3d';
            menu.style.padding       = '4px 0';
            menu.style.zIndex        = '1000';
            menu.style.boxShadow     = '0 4px 6px rgba(0,0,0,0.3)';
            menu.style.borderRadius  = '4px';

            menu.appendChild(this._createMenuItem('Rename', () => {
                const layer   = this.appState.layers.find(l => l.id === layerId);
                const newName = prompt('Enter new name:', layer ? layer.name : '');
                if (newName) this.appState.renameLayer(layerId, newName);
            }));

            menu.appendChild(this._createMenuItem('Delete', () => {
                if (this.appState.layers.length > 1) {
                    this.appState.deleteLayer(layerId);
                } else {
                    alert('Cannot delete the last layer.');
                }
            }));

            document.body.appendChild(menu);

            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('contextmenu', closeMenu);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeMenu);
                document.addEventListener('contextmenu', closeMenu);
            }, 0);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | CreateMenuItem — Build a Styled Context Menu Item
        // ------------------------------------------------------------
        _createMenuItem(text, onClick) {
            const item = document.createElement('div');
            item.innerText       = text;
            item.style.padding   = '6px 16px';
            item.style.cursor    = 'pointer';
            item.style.fontSize  = '12px';
            item.style.color     = '#e2e8f0';
            item.addEventListener('mouseenter', () => { item.style.background = '#444'; });
            item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
            item.addEventListener('click', () => { onClick(); item.closest('#vf-layer-context-menu').remove(); });
            return item;
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
