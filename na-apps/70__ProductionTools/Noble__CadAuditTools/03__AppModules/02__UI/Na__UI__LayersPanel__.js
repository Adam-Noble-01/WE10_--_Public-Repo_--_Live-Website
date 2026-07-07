// =============================================================================
// NOBLE CAD AUDIT TOOLS - LAYERS PANEL
// =============================================================================
//
// FILE      : Na__UI__LayersPanel__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : LayersPanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Populates and manages the layer list in the right-side panel
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Listens for the "file:loaded" EventBus event to populate the layer list.
// - Renders a .layer-item element for each layer in AppState.layers.
// - Each item shows a colour swatch, layer name, and entity count.
// - Clicking a layer item sets it as the active layer in AppState.
// - Listens for "file:cleared" to reset the list to the empty state.
//
// TODO (follow-up): Add layer visibility toggle (eye icon button per row).
// TODO (follow-up): Add layer isolation mode (select only this layer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — list population stubbed, ready for EntityLoader data.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | LayersPanel Class
// -----------------------------------------------------------------------------

    export class Na__UI__LayersPanel {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._listEl    = document.getElementById('Na__Layers__List');

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('file:loaded', () => {
                this.Na__LayersPanel__Render();                          // <-- Rebuild layer list when file loads
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__LayersPanel__Reset();                           // <-- Show empty state on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Render Layer List from AppState.layers Map
        // ------------------------------------------------------------
        Na__LayersPanel__Render() {
            if (!this._listEl) return;

            const layers = this._appState.layers;                        // <-- Map<name, { color, entityCount }>

            if (!layers || layers.size === 0) {
                this._listEl.innerHTML = '<p class="panel__empty-state">No layers found in file.</p>';
                return;
            }

            const fragment = document.createDocumentFragment();

            layers.forEach((layerData, layerName) => {
                const item = Na__LayersPanel__BuildLayerItem(layerName, layerData);
                item.addEventListener('click', () => {
                    this._appState.activeLayer = layerName;              // <-- Set active layer
                    this._listEl.querySelectorAll('.layer-item').forEach((el) => {
                        el.classList.toggle('is-active', el.dataset.layer === layerName);
                    });
                });
                fragment.appendChild(item);
            });

            this._listEl.innerHTML = '';
            this._listEl.appendChild(fragment);                          // <-- Replace list content
        }
        // ------------------------------------------------------------


        // FUNCTION | Reset Layer List to Empty State
        // ------------------------------------------------------------
        Na__LayersPanel__Reset() {
            if (!this._listEl) return;
            this._listEl.innerHTML = '<p class="panel__empty-state">Load a file to see layers.</p>';
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Single Layer List Item DOM Element
    // ------------------------------------------------------------
    function Na__LayersPanel__BuildLayerItem(layerName, layerData) {
        const item = document.createElement('div');
        item.className      = 'layer-item';
        item.dataset.layer  = layerName;

        const swatch = document.createElement('div');
        swatch.className    = 'layer-item__swatch';
        swatch.style.backgroundColor = layerData.color || '#e2e8f0';    // <-- Layer colour from DXF

        const name = document.createElement('span');
        name.className      = 'layer-item__name';
        name.textContent    = layerName;
        name.title          = layerName;

        const count = document.createElement('span');
        count.className     = 'layer-item__count';
        count.textContent   = layerData.entityCount || 0;                // <-- Entity count badge

        item.appendChild(swatch);
        item.appendChild(name);
        item.appendChild(count);
        return item;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
