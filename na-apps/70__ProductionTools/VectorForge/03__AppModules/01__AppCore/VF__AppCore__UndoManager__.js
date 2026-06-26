// =============================================================================
// VECTORFORGE - UNDO MANAGER
// =============================================================================
//
// FILE      : VF__AppCore__UndoManager__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : UndoManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages undo/redo history for the SVG canvas state
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Saves the SVG innerHTML and layer stack as a snapshot on every mouseup event.
// - Duplicate-state saves are skipped via an innerHTML equality check.
// - Restores a saved snapshot on undo/redo, reconstructing layerGroups from the
//   DOM so SVGCanvas keeps a consistent reference map after history navigation.
// - Listens to hotkey:undo and hotkey:redo from the EventBus.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | UndoManager Class
// -----------------------------------------------------------------------------

    // CLASS | UndoManager — Canvas History Controller
    // ------------------------------------------------------------
    export class UndoManager {

        // FUNCTION | Constructor — Initialise History Stack and Attach Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState    = appState;   // <-- Application state reference
            this.eventBus    = eventBus;   // <-- Event bus reference
            this.svgCanvas   = svgCanvas;  // <-- SVG canvas reference
            this.history     = [];         // <-- Snapshot stack
            this.currentIndex = -1;        // <-- Current position in the history stack
            this.isUndoRedo  = false;      // <-- Guard flag to prevent saving during restore

            this.svgCanvas.svg.addEventListener('mouseup', () => {
                setTimeout(() => this.saveState(), 50); // <-- Debounced save after each canvas interaction
            });

            this.eventBus.on('hotkey:undo', () => this.undo());
            this.eventBus.on('hotkey:redo', () => this.redo());

            setTimeout(() => this.saveState(), 200); // <-- Save initial blank canvas state
        }
        // ------------------------------------------------------------


        // FUNCTION | SaveState — Capture a Canvas Snapshot if State Has Changed
        // ------------------------------------------------------------
        saveState() {
            if (this.isUndoRedo) return; // <-- Skip saves triggered during restore

            const currentCode = this.svgCanvas.svg.innerHTML;
            if (this.currentIndex >= 0 && this.history[this.currentIndex].code === currentCode) {
                return; // <-- No change — skip duplicate save
            }

            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1); // <-- Truncate forward history on new action
            }

            this.history.push({
                code          : currentCode,
                layers        : JSON.parse(JSON.stringify(this.appState.layers)), // <-- Deep copy layer stack
                activeLayerId : this.appState.activeLayerId,
            });
            this.currentIndex++;
        }
        // ------------------------------------------------------------


        // FUNCTION | RestoreState — Apply a Snapshot to the Canvas and App State
        // ------------------------------------------------------------
        restoreState(state) {
            this.isUndoRedo = true;

            this.eventBus.emit('selection:changed', []);      // <-- Clear selection before restore
            this.svgCanvas.svg.innerHTML = state.code;        // <-- Replace canvas DOM content
            this.appState.layers        = state.layers;       // <-- Restore layer array
            this.appState.activeLayerId = state.activeLayerId; // <-- Restore active layer

            this.svgCanvas.layerGroups = {};
            Array.from(this.svgCanvas.svg.children).forEach(child => {
                if (child.tagName.toLowerCase() === 'g' && child.hasAttribute('data-layer-id')) {
                    this.svgCanvas.layerGroups[child.getAttribute('data-layer-id')] = child; // <-- Rebuild group map
                }
            });

            this.eventBus.emit('layers:changed', this.appState.layers);
            this.svgCanvas.svg.dispatchEvent(new Event('mouseup')); // <-- Trigger code panel refresh

            setTimeout(() => { this.isUndoRedo = false; }, 50); // <-- Release guard after DOM settles
        }
        // ------------------------------------------------------------


        // FUNCTION | Undo — Step Back One Position in History
        // ------------------------------------------------------------
        undo() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.restoreState(this.history[this.currentIndex]);
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Redo — Step Forward One Position in History
        // ------------------------------------------------------------
        redo() {
            if (this.currentIndex < this.history.length - 1) {
                this.currentIndex++;
                this.restoreState(this.history[this.currentIndex]);
            }
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
