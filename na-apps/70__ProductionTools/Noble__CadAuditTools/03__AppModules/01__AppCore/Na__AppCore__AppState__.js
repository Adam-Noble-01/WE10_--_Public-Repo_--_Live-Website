// =============================================================================
// NOBLE CAD AUDIT TOOLS - APPLICATION STATE
// =============================================================================
//
// FILE      : Na__AppCore__AppState__.js
// NAMESPACE : CadAuditTools.AppCore
// MODULE    : AppState
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Central shared state store for the CAD Audit Tools editor
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Holds all shared mutable state for the editor session.
// - Passed as a dependency to every module at construction time.
// - Modules READ state from AppState and WRITE via EventBus events.
// - Keeps the canvas state: current tool, loaded file, entity list, layer list,
//   zoom/pan viewBox transform, and selection.
// - Config from Na__AppData__AppConfig__.json is loaded once on startup
//   and stored here for read access by all modules.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | AppState Class
// -----------------------------------------------------------------------------

    export class Na__AppCore__AppState {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(eventBus) {
            this._eventBus = eventBus;               // <-- Reference for emitting state-change events

            // FILE STATE
            this.fileLoaded       = false;           // <-- True once a DXF has been parsed and displayed
            this.fileName         = null;            // <-- Loaded DXF filename (display only)
            this.tempDxfPath      = null;            // <-- Server-side path to the working DXF in temp cache

            // ENTITY DATA
            this.entities         = [];              // <-- All entity objects loaded from DXF (own data, NOT DOM elements)
            this.entityByHandle   = new Map();       // <-- Map<unitHandle, entity record> for selection resolution
            this.deletedHandles   = new Set();       // <-- Set of unit handle strings marked for deletion
            this.spatialIndex     = null;            // <-- Uniform grid over entities (selection/hit-test acceleration)

            // LAYER DATA
            this.layers           = new Map();       // <-- Map<layerName, { color, hexColor, visible, entityCount }>
            this.activeLayer      = null;            // <-- Currently focused layer (string name)

            // ANNOTATIONS
            this.dimensions       = [];              // <-- Dimension records (owned by DimensionRenderer)

            // CANVAS / VIEWPORT
            this.viewTransform    = { scale: 1, x: 0, y: 0 }; // <-- Published by ViewBoxController

            // TOOLS
            this.activeTool       = 'select';        // <-- Currently active tool ID string
            this._tools           = {};              // <-- Registered tool instances (set via setTools())

            // SELECTION
            this.selectedEntities = [];              // <-- Array of currently selected unit entity records

            // CONFIG + CONTROLS
            this.config           = null;            // <-- Loaded from Na__AppData__AppConfig__.json
            this.controls         = null;            // <-- Loaded from Na__AppData__KeybindingsAndControls__.json
        }
        // ------------------------------------------------------------


        // FUNCTION | Load Application Config JSON from Server
        // ------------------------------------------------------------
        async Na__AppState__LoadConfig() {
            try {
                const response = await fetch('/02__AppData/Na__AppData__AppConfig__.json');
                if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);
                this.config = await response.json();
                console.log('[Na__AppState] Config loaded:', this.config.appVersion);
            } catch (err) {
                console.error('[Na__AppState] Failed to load app config:', err);
                this.config = {};                   // <-- Fallback to empty config on failure
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Set Active Tool by ID
        // ------------------------------------------------------------
        setTool(toolId) {
            this.activeTool = toolId;               // <-- Update active tool ID
            this._eventBus.emit('tool:changed', { tool: toolId }); // <-- Notify toolbar and canvas
        }
        // ------------------------------------------------------------


        // FUNCTION | Register Tool Instance Map
        // ------------------------------------------------------------
        setTools(toolsMap) {
            this._tools = toolsMap;                 // <-- Store tool instances keyed by tool ID
        }
        // ------------------------------------------------------------


        // FUNCTION | Get Active Tool Instance
        // ------------------------------------------------------------
        getActiveTool() {
            return this._tools[this.activeTool] || null; // <-- Return tool instance or null for pan
        }
        // ------------------------------------------------------------


        // FUNCTION | Update File Loaded State
        // ------------------------------------------------------------
        Na__AppState__SetFileLoaded(fileName, tempDxfPath) {
            this.fileLoaded   = true;               // <-- Mark file as loaded
            this.fileName     = fileName;           // <-- Store display name
            this.tempDxfPath  = tempDxfPath;        // <-- Store server temp path for save
            this._eventBus.emit('file:loaded', { fileName, tempDxfPath });
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear All File State (Reset to Blank)
        // ------------------------------------------------------------
        Na__AppState__Clear() {
            this.fileLoaded       = false;
            this.fileName         = null;
            this.tempDxfPath      = null;
            this.entities         = [];
            this.entityByHandle   = new Map();
            this.deletedHandles   = new Set();
            this.layers           = new Map();
            this.activeLayer      = null;
            this.dimensions       = [];
            this.selectedEntities = [];
            this.viewTransform    = { scale: 1, x: 0, y: 0 };
            this._eventBus.emit('file:cleared');    // <-- Notify all panels to reset
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
