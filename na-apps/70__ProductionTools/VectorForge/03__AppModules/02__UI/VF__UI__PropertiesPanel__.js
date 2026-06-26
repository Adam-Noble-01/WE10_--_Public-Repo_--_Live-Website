// =============================================================================
// VECTORFORGE - PROPERTIES PANEL UI
// =============================================================================
//
// FILE      : VF__UI__PropertiesPanel__.js
// NAMESPACE : VectorForge.UI
// MODULE    : PropertiesPanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Renders editable property fields for the currently selected SVG element
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Listens to selection:changed and re-renders the properties panel for the
//   currently selected elements.
// - Shows element type, stroke color, stroke width, and fill color for all
//   selectable elements.
// - Fill color includes a "None" checkbox for linework elements.
// - Shows dimensional width field for rect elements.
// - Property input changes are applied directly to the element's SVG attributes.
// - Stroke color changes update dataset.originalStroke to stay in sync with
//   the SelectionManager's highlight restore mechanism.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.1.0
// - Added stroke color and fill color pickers to the properties panel.
// - Fill panel includes a "None" toggle checkbox for linework elements.
// - Color inputs sync with SelectionManager originalStroke cache.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | PropertiesPanel UI Class
// -----------------------------------------------------------------------------

    // CLASS | PropertiesPanelUI — Selection Property Inspector
    // ------------------------------------------------------------
    export class PropertiesPanelUI {

        // FUNCTION | Constructor — Bind Panel Element and Register Bus Listener
        // ------------------------------------------------------------
        constructor(appState, eventBus, selectionManager) {
            this.appState         = appState;          // <-- App state reference
            this.eventBus         = eventBus;          // <-- Event bus reference
            this.selectionManager = selectionManager;  // <-- Selection manager reference
            this.panelEl          = document.getElementById('props-content'); // <-- Properties panel container

            this.eventBus.on('selection:changed', (selectedElements) => this._render(selectedElements));
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | ToHexColor — Normalise SVG Color Value to Hex String
        // ------------------------------------------------------------
        _toHexColor(val) {
            if (!val || val === 'none') return '#000000';
            if (/^#[0-9a-fA-F]{6}$/.test(val)) return val; // Already 6-digit hex
            if (/^#[0-9a-fA-F]{3}$/.test(val)) {
                const [, r, g, b] = val.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
                return `#${r}${r}${g}${g}${b}${b}`;                             // <-- Expand 3-digit to 6-digit hex
            }
            return '#000000'; // <-- Fallback for named colors or rgb() values
        }
        // ------------------------------------------------------------


        // FUNCTION | Render — Build Property Fields for the Current Selection
        // ------------------------------------------------------------
        _render(elements) {
            if (elements.length === 0) {
                this.panelEl.innerHTML = 'Select an object'; // <-- Empty selection placeholder
                return;
            }

            if (elements.length > 1) {
                this.panelEl.innerHTML = `${elements.length} objects selected`; // <-- Multi-selection summary
                return;
            }

            const el      = elements[0];
            const tagName = el.tagName.toLowerCase();

            // Resolve real stroke — originalStroke holds the pre-highlight value when selected
            const realStroke   = this._toHexColor(el.dataset.originalStroke || el.getAttribute('stroke'));
            const fillAttr     = el.getAttribute('fill') || '';
            const fillIsNone   = (fillAttr === 'none' || fillAttr === '');
            const fillHexColor = fillIsNone ? '#ffffff' : this._toHexColor(fillAttr);
            const showFill     = ['rect', 'path', 'line'].includes(tagName);

            let html = `
                <div class="props-group">
                    <label>Type: ${el.tagName}</label>
                </div>
                <div class="props-group">
                    <label>Stroke Color</label>
                    <input type="color" id="vf-prop-stroke-color" value="${realStroke}">
                </div>
                <div class="props-group">
                    <label>Stroke Width</label>
                    <input type="number" id="vf-prop-stroke-width" min="0" step="0.5" value="${el.getAttribute('stroke-width') || 1}">
                </div>`;

            if (showFill) {
                html += `
                <div class="props-group">
                    <label>Fill Color</label>
                    <div class="props-fill-row">
                        <input type="color" id="vf-prop-fill-color" value="${fillHexColor}" ${fillIsNone ? 'disabled' : ''}>
                        <label class="props-fill-none-label">
                            <input type="checkbox" id="vf-prop-fill-none" ${fillIsNone ? 'checked' : ''}> None
                        </label>
                    </div>
                </div>`;
            }

            if (tagName === 'rect') {
                html += `
                <div class="props-group">
                    <label>Width</label>
                    <input type="number" id="vf-prop-width" value="${Math.round(el.getAttribute('width'))}">
                </div>`;
            }

            this.panelEl.innerHTML = html;

            this._wireStrokeColor(el);
            this._wireStrokeWidth(el);
            if (showFill) this._wireFill(el);
            if (tagName === 'rect') this._wireWidth(el);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | WireStrokeColor — Attach Stroke Color Input Listener
        // ------------------------------------------------------------
        _wireStrokeColor(el) {
            const input = document.getElementById('vf-prop-stroke-color');
            if (!input) return;
            input.addEventListener('input', (e) => {
                el.setAttribute('stroke', e.target.value);           // <-- Apply new stroke color immediately
                el.dataset.originalStroke = e.target.value;          // <-- Keep SelectionManager restore in sync
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | WireStrokeWidth — Attach Stroke Width Input Listener
        // ------------------------------------------------------------
        _wireStrokeWidth(el) {
            const input = document.getElementById('vf-prop-stroke-width');
            if (!input) return;
            input.addEventListener('change', (e) => {
                el.setAttribute('stroke-width', e.target.value); // <-- Apply stroke width change
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | WireFill — Attach Fill Color and None Checkbox Listeners
        // ------------------------------------------------------------
        _wireFill(el) {
            const colorInput    = document.getElementById('vf-prop-fill-color');
            const noneCheckbox  = document.getElementById('vf-prop-fill-none');

            if (noneCheckbox) {
                noneCheckbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        el.setAttribute('fill', 'none');               // <-- Set fill to none when checked
                        if (colorInput) colorInput.disabled = true;    // <-- Disable color picker
                    } else {
                        const color = colorInput ? colorInput.value : '#ffffff';
                        el.setAttribute('fill', color);                // <-- Apply color picker value
                        if (colorInput) colorInput.disabled = false;   // <-- Re-enable color picker
                    }
                });
            }

            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    if (!noneCheckbox || !noneCheckbox.checked) {
                        el.setAttribute('fill', e.target.value); // <-- Apply fill color change
                    }
                });
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | WireWidth — Attach Width Input Listener for Rect Elements
        // ------------------------------------------------------------
        _wireWidth(el) {
            const input = document.getElementById('vf-prop-width');
            if (!input) return;
            input.addEventListener('change', (e) => {
                el.setAttribute('width', e.target.value); // <-- Apply width change to rect
            });
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
