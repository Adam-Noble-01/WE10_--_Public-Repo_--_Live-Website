// =============================================================================
// NOBLE CAD AUDIT TOOLS - PROPERTIES PANEL
// =============================================================================
//
// FILE      : Na__UI__PropertiesPanel__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : PropertiesPanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Displays selected-entity properties in the right panel inspector
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Listens to "selection:changed" on the EventBus.
// - When one entity is selected, renders its properties (type, layer, handle,
//   colour, linetype) as read-only rows in the Properties tab.
// - When multiple entities are selected, renders a summary count per entity type.
// - When no entities are selected, shows the empty state.
// - Handles the Properties / Selection tab switching for the panel-tabs control.
//
// TODO (follow-up): Add geometry dimension display (bounding box, length for lines).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | PropertiesPanel Class
// -----------------------------------------------------------------------------

    export class Na__UI__PropertiesPanel {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, selectionManager) {
            this._appState         = appState;
            this._eventBus         = eventBus;
            this._selectionManager = selectionManager;

            this._propsContentEl     = document.getElementById('Na__Props__Content');
            this._selectionContentEl = document.getElementById('Na__Selection__Content');

            this._bindEventBusListeners();
            this._bindTabButtons();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('selection:changed', (entities) => {
                this.Na__PropertiesPanel__Render(entities);              // <-- Update on every selection change
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__PropertiesPanel__Reset();
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Tab Button Click Handlers
        // ------------------------------------------------------------
        _bindTabButtons() {
            const panel = document.getElementById('Na__App__PropertiesPanel');
            if (!panel) return;

            panel.querySelectorAll('.tab-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    panel.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');                         // <-- Mark clicked tab active

                    const targetId = btn.dataset.target;
                    panel.querySelectorAll('.panel-tab-content').forEach((content) => {
                        content.classList.toggle('is-hidden', content.id !== targetId); // <-- Show target only
                    });
                });
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Render Properties for the Given Entity Selection
        // ------------------------------------------------------------
        Na__PropertiesPanel__Render(entities) {
            if (!this._propsContentEl) return;

            if (entities.length === 0) {
                this._propsContentEl.innerHTML = '<p class="panel__empty-state">No entity selected.</p>';
                return;
            }

            if (entities.length === 1) {
                this._propsContentEl.innerHTML = Na__PropertiesPanel__BuildSingleEntityHtml(entities[0]);
                return;
            }

            // Multiple entities selected — show summary by type
            this._propsContentEl.innerHTML = Na__PropertiesPanel__BuildMultiEntityHtml(entities);
        }
        // ------------------------------------------------------------


        // FUNCTION | Reset to Empty State
        // ------------------------------------------------------------
        Na__PropertiesPanel__Reset() {
            if (this._propsContentEl) {
                this._propsContentEl.innerHTML = '<p class="panel__empty-state">No entity selected.</p>';
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build HTML for a Single Entity's Properties
    // ------------------------------------------------------------
    function Na__PropertiesPanel__BuildSingleEntityHtml(entity) {
        const rows = [
            { label: 'Type',     value: entity.type     || '—' },
            { label: 'Handle',   value: entity.handle   || '—' },
            { label: 'Layer',    value: entity.layer    || '—' },
            { label: 'Colour',   value: entity.color    || 'BYLAYER' },
            { label: 'Linetype', value: entity.linetype || 'BYLAYER' },
        ];
        return rows.map(({ label, value }) =>
            `<div class="props-row">
                <label>${label}</label>
                <span>${Na__PropertiesPanel__Escape(String(value))}</span>
            </div>`
        ).join('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build HTML Summary for Multiple Selected Entities
    // ------------------------------------------------------------
    function Na__PropertiesPanel__BuildMultiEntityHtml(entities) {
        const counts = {};
        entities.forEach(({ type }) => {
            counts[type] = (counts[type] || 0) + 1;                     // <-- Tally each entity type
        });
        const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return `
            <div class="props-row">
                <label>Selected</label>
                <span>${entities.length} entities</span>
            </div>
            ${rows.map(([type, count]) =>
                `<div class="props-row">
                    <label>${Na__PropertiesPanel__Escape(type)}</label>
                    <span>${count}</span>
                </div>`
            ).join('')}
        `;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape HTML Special Characters
    // ------------------------------------------------------------
    function Na__PropertiesPanel__Escape(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
