// =============================================================================
// VECTORFORGE - SELECTION MANAGER
// =============================================================================
//
// FILE      : VF__AppCore__SelectionManager__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : SelectionManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages element selection state and highlight rendering on the SVG canvas
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Listens for click events on the SVG canvas and tracks which elements are
//   selected. Shift-click adds to the selection; clicking background clears it.
// - Applies a temporary blue highlight stroke to selected elements. The original
//   stroke value is cached in a data attribute and restored on deselection.
// - Listens to the hotkey:delete event to remove all selected elements from the DOM.
// - Emits selection:changed on the EventBus after any selection state change.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | SelectionManager Class
// -----------------------------------------------------------------------------

    // CLASS | SelectionManager — SVG Element Selection and Highlight Controller
    // ------------------------------------------------------------
    export class SelectionManager {

        // FUNCTION | Constructor — Attach Canvas Click and Hotkey Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState         = appState;    // <-- Application state reference
            this.eventBus         = eventBus;    // <-- Event bus reference
            this.svgCanvas        = svgCanvas;   // <-- SVG canvas reference
            this.selectedElements = [];          // <-- Currently selected DOM elements

            this.svgCanvas.svg.addEventListener('click', (e) => this._onCanvasClick(e));

            this.eventBus.on('hotkey:delete', () => this.deleteSelected()); // <-- Wire delete hotkey
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnCanvasClick — Resolve Click to Select or Deselect
        // ------------------------------------------------------------
        _onCanvasClick(e) {
            if (this.appState.currentTool !== 'select') return; // <-- Only active in select mode

            const isBackground = (
                e.target === this.svgCanvas.svg ||
                e.target.tagName === 'svg' ||
                (e.target.tagName === 'rect' && e.target.getAttribute('fill') === '#ffffff' && e.target.parentElement === this.svgCanvas.svg) ||
                e.target.tagName === 'g'
            );

            if (isBackground) {
                this.clearSelection(); // <-- Clicked empty canvas — clear selection
            } else {
                this.selectElement(e.target, e.shiftKey); // <-- Select element; shift adds to multi-select
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | SelectElement — Add an Element to the Selection
        // ------------------------------------------------------------
        selectElement(el, multi) {
            if (!multi) this.clearSelection();                          // <-- Clear existing selection unless multi
            if (!this.selectedElements.includes(el)) {
                this.selectedElements.push(el);
                if (!el.dataset.originalStroke) {
                    el.dataset.originalStroke = el.getAttribute('stroke') || ''; // <-- Cache original stroke
                }
                el.setAttribute('stroke', '#2563eb');                   // <-- Apply selection highlight
            }
            this.eventBus.emit('selection:changed', this.selectedElements); // <-- Notify listeners
        }
        // ------------------------------------------------------------


        // FUNCTION | ClearSelection — Deselect All Elements and Restore Strokes
        // ------------------------------------------------------------
        clearSelection() {
            this.selectedElements.forEach(el => {
                if (el.dataset.originalStroke !== undefined) {
                    if (el.dataset.originalStroke) {
                        el.setAttribute('stroke', el.dataset.originalStroke); // <-- Restore cached stroke
                    } else {
                        el.removeAttribute('stroke'); // <-- Element had no stroke originally
                    }
                }
            });
            this.selectedElements = [];
            this.eventBus.emit('selection:changed', this.selectedElements); // <-- Notify empty selection
        }
        // ------------------------------------------------------------


        // FUNCTION | DeleteSelected — Remove All Selected Elements from the DOM
        // ------------------------------------------------------------
        deleteSelected() {
            if (this.selectedElements.length === 0) return;
            this.selectedElements.forEach(el => {
                if (el.parentNode) el.parentNode.removeChild(el); // <-- Remove each selected element
            });
            this.selectedElements = [];
            this.eventBus.emit('selection:changed', this.selectedElements);       // <-- Notify cleared selection
            this.svgCanvas.svg.dispatchEvent(new Event('mouseup'));               // <-- Trigger code panel refresh
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
