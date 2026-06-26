// =============================================================================
// VECTORFORGE - APP STATE
// =============================================================================
//
// FILE      : VF__AppCore__AppState__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : AppState
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Central application state container — layers, tools, canvas dimensions
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Owns the single authoritative state for the editor: layer stack, active
//   tool name, tool instances, and canvas dimensions.
// - All modules that need to read or mutate shared state must do so through
//   this class — never through direct module-to-module access.
// - State changes are broadcast through the EventBus so dependent modules
//   can react without polling.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | AppState Class
// -----------------------------------------------------------------------------

    // CLASS | AppState — Central Application State Container
    // ------------------------------------------------------------
    export class AppState {

        // FUNCTION | Constructor — Initialise State Properties
        // ------------------------------------------------------------
        constructor(eventBus) {
            this.eventBus      = eventBus;    // <-- Shared event bus reference
            this.currentTool   = 'select';    // <-- Name of the currently active tool
            this.tools         = {};          // <-- Tool instances keyed by tool name
            this.layers        = [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false }]; // <-- Layer stack
            this.activeLayerId = 'layer-1';   // <-- Id of the currently active layer
            this.canvasWidth   = 800;         // <-- Canvas width in pixels
            this.canvasHeight  = 600;         // <-- Canvas height in pixels
            this.dpi           = 96;          // <-- Pixels per inch (standard screen DPI)
            this.pxPerMm       = 96 / 25.4;  // <-- Pixel-to-millimetre conversion factor
            this.snapToGrid    = false;       // <-- Grid snap toggle state
        }
        // ------------------------------------------------------------


        // FUNCTION | SetTools — Register Tool Instances
        // ------------------------------------------------------------
        setTools(tools) {
            this.tools = tools; // <-- Store tool instances map from main initialiser
        }
        // ------------------------------------------------------------


        // FUNCTION | SetTool — Activate a Named Tool
        // ------------------------------------------------------------
        setTool(toolName) {
            if (this.currentTool && this.tools[this.currentTool] && this.tools[this.currentTool].deactivate) {
                this.tools[this.currentTool].deactivate(); // <-- Deactivate the previously active tool
            }
            this.currentTool = toolName;
            if (this.tools[this.currentTool] && this.tools[this.currentTool].activate) {
                this.tools[this.currentTool].activate();   // <-- Activate the new tool
            }
            this.eventBus.emit('tool:changed', toolName);  // <-- Notify UI of tool change
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | ActiveLayer — Get the Currently Active Layer Object
        // ------------------------------------------------------------
        get activeLayer() {
            return this.layers.find(l => l.id === this.activeLayerId); // <-- Find by active layer id
        }
        // ------------------------------------------------------------


        // FUNCTION | AddLayer — Add a New Layer to the Top of the Stack
        // ------------------------------------------------------------
        addLayer(name) {
            const id = 'layer-' + Date.now();                              // <-- Generate unique id from timestamp
            this.layers.unshift({ id, name, visible: true, locked: false }); // <-- Insert at top of stack
            this.activeLayerId = id;                                        // <-- Set as active immediately
            this.eventBus.emit('layers:changed', this.layers);              // <-- Notify listeners
        }
        // ------------------------------------------------------------


        // FUNCTION | SetActiveLayer — Switch the Active Layer by Id
        // ------------------------------------------------------------
        setActiveLayer(id) {
            this.activeLayerId = id;
            this.eventBus.emit('layers:changed', this.layers); // <-- Notify listeners of active change
        }
        // ------------------------------------------------------------


        // FUNCTION | RenameLayer — Update a Layer's Display Name
        // ------------------------------------------------------------
        renameLayer(id, newName) {
            const layer = this.layers.find(l => l.id === id);
            if (layer) {
                layer.name = newName;
                this.eventBus.emit('layers:changed', this.layers); // <-- Notify listeners of rename
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | DeleteLayer — Remove a Layer by Id
        // ------------------------------------------------------------
        deleteLayer(id) {
            if (this.layers.length <= 1) return;                        // <-- Prevent deletion of last layer
            this.layers = this.layers.filter(l => l.id !== id);        // <-- Remove the target layer
            if (this.activeLayerId === id) {
                this.activeLayerId = this.layers[0].id;                 // <-- Fall back to first remaining layer
            }
            this.eventBus.emit('layers:changed', this.layers);         // <-- Notify listeners
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
