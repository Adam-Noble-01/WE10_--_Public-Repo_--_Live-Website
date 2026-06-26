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
// - Shows element type and stroke-width for all selectable elements.
// - Shows a width field for rect elements.
// - Property input changes are applied directly to the element's SVG attributes.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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

            const el  = elements[0];
            let   html = `
                <div class="props-group">
                    <label>Type: ${el.tagName}</label>
                </div>
                <div class="props-group">
                    <label>Stroke Width</label>
                    <input type="number" id="vf-prop-stroke-width" value="${el.getAttribute('stroke-width') || 1}">
                </div>`;

            if (el.tagName === 'rect') {
                html += `
                <div class="props-group">
                    <label>Width</label>
                    <input type="number" id="vf-prop-width" value="${Math.round(el.getAttribute('width'))}">
                </div>`;
            }

            this.panelEl.innerHTML = html;

            const strokeInput = document.getElementById('vf-prop-stroke-width');
            if (strokeInput) {
                strokeInput.addEventListener('change', (e) => {
                    el.setAttribute('stroke-width', e.target.value); // <-- Apply stroke width change
                });
            }

            const widthInput = document.getElementById('vf-prop-width');
            if (widthInput) {
                widthInput.addEventListener('change', (e) => {
                    el.setAttribute('width', e.target.value); // <-- Apply width change to rect
                });
            }
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
