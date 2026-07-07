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
// - Each item shows an eye visibility toggle, colour swatch, layer name, and
//   entity count.
// - Clicking the eye toggles the layer's visibility: updates AppState.layers,
//   emits "layer:visibility-changed" (Canvas hides/shows the elements and
//   SelectionManager drops hidden units from the selection).
// - Clicking elsewhere on a layer item sets it as the active layer.
// - Listens for "file:cleared" to reset the list to the empty state.
// - Listens for "layers:refresh" (emitted by EntityPruner after a hard delete
//   or its undo/redo) to re-render up-to-date per-layer entity counts.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.3
// - Added layers:refresh listener so hard-delete/undo keeps counts accurate.
//
// 07-Jul-2026 - Version 0.3.0
// - Eye visibility toggle per layer wired to layer:visibility-changed.
// - Swatch uses server-resolved hexColor.
//
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
            this._eventBus.on('layers:refresh', () => {
                this.Na__LayersPanel__Render();                          // <-- Re-render counts after a hard delete/undo
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

                // EYE TOGGLE — flips layer visibility
                const eyeBtn = item.querySelector('.layer-item__eye');
                if (eyeBtn) {
                    eyeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();                             // <-- Don't also set active layer
                        const nowVisible = !(layerData.visible !== false);
                        layerData.visible = nowVisible;                  // <-- Update shared state record
                        item.classList.toggle('is-hidden-layer', !nowVisible);
                        this._eventBus.emit('layer:visibility-changed', {
                            layer   : layerName,
                            visible : nowVisible,
                        });
                    });
                }

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
        if (layerData.visible === false) item.classList.add('is-hidden-layer');

        const eye = document.createElement('button');
        eye.className       = 'layer-item__eye';
        eye.title           = 'Toggle layer visibility';
        eye.innerHTML       =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/>' +
            '<circle cx="12" cy="12" r="2.5"/></svg>';                   // <-- Eye glyph; CSS dims when hidden

        const swatch = document.createElement('div');
        swatch.className    = 'layer-item__swatch';
        swatch.style.backgroundColor = layerData.hexColor || '#e2e2e8'; // <-- Server-resolved layer colour

        const name = document.createElement('span');
        name.className      = 'layer-item__name';
        name.textContent    = layerName;
        name.title          = layerName;

        const count = document.createElement('span');
        count.className     = 'layer-item__count';
        count.textContent   = layerData.entityCount || 0;                // <-- Entity count badge

        item.appendChild(eye);
        item.appendChild(swatch);
        item.appendChild(name);
        item.appendChild(count);
        return item;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
