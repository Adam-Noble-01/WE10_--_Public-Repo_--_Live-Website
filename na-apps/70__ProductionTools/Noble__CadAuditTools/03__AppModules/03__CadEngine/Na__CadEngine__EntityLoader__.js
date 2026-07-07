// =============================================================================
// NOBLE CAD AUDIT TOOLS - ENTITY LOADER
// =============================================================================
//
// FILE      : Na__CadEngine__EntityLoader__.js
// NAMESPACE : CadAuditTools.CadEngine
// MODULE    : EntityLoader
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Parses the server's DXF entity JSON response and populates the canvas
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Receives the parsed entity JSON from UploadPanel after a successful /api/upload.
// - Populates AppState.entities, AppState.layers, and AppState.fileName.
// - Calls AppState.Na__AppState__SetFileLoaded() to trigger 'file:loaded' event.
// - Delegates SVG rendering to CadCanvas.Na__CadCanvas__RenderEntities().
// - After rendering, fires ViewBoxController to fit the new drawing to viewport.
//
// EXPECTED SERVER RESPONSE SHAPE (from Na__LocalServer__DxfEngine__):
//   {
//     filename   : "drawing.dxf",
//     tempPath   : "/path/to/cache/drawing.dxf",
//     entityCount: 1234,
//     layers     : { "WALLS": { color: "#ffffff", entityCount: 42 }, ... },
//     entities   : [
//       { handle: "A1B2", type: "LINE", layer: "WALLS", color: "BYLAYER",
//         geometry: { x1: 0, y1: 0, x2: 100, y2: 0 } },
//       ...
//     ]
//   }
//
// TODO (follow-up): Implement actual SVG rendering via CadCanvas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — state population wired, SVG rendering stubbed.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | EntityLoader Class
// -----------------------------------------------------------------------------

    export class Na__CadEngine__EntityLoader {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._cadCanvas = cadCanvas;
        }
        // ------------------------------------------------------------


        // FUNCTION | Load Entities from Server Response into State and Canvas
        // ------------------------------------------------------------
        async Na__EntityLoader__LoadFromServerResponse(data) {
            if (!data || !data.entities) {
                console.error('[Na__EntityLoader] Invalid server response — missing entities array');
                return;
            }

            console.log(`[Na__EntityLoader] Loading ${data.entities.length} entities from "${data.filename}"`);

            // CLEAR PREVIOUS STATE
            this._appState.Na__AppState__Clear();                        // <-- Reset state before loading new file

            // POPULATE ENTITIES IN APP STATE
            this._appState.entities = data.entities;                     // <-- Store entity object array

            // POPULATE LAYERS MAP
            const layersMap = new Map();
            if (data.layers) {
                Object.entries(data.layers).forEach(([name, layerData]) => {
                    layersMap.set(name, {
                        color       : Na__EntityLoader__AciColorToHex(layerData.color), // <-- Convert ACI colour index
                        entityCount : layerData.entityCount || 0,
                    });
                });
            }
            this._appState.layers = layersMap;                           // <-- Update layers map

            // RENDER ENTITIES ON CANVAS (STUB — see Na__CadEngine__Canvas__ for TODO)
            this._cadCanvas.Na__CadCanvas__RenderEntities(data.entities);

            // UPDATE APP STATE — Triggers 'file:loaded' EventBus event
            this._appState.Na__AppState__SetFileLoaded(data.filename, data.tempPath);

            // FIT VIEW TO DRAWING
            this._eventBus.emit('view:fit');                             // <-- Fit canvas to loaded drawing bounds

            console.log(`[Na__EntityLoader] Load complete — ${data.entities.length} entities, ${layersMap.size} layers`);
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert DXF ACI Colour Index to a Hex Colour String
    // ------------------------------------------------------------
    function Na__EntityLoader__AciColorToHex(aciIndex) {
        // Subset of the standard AutoCAD Colour Index (ACI) palette for common values.
        // TODO: Expand this lookup table with the full 256-colour ACI palette.
        const Na__ACI_COLOR_MAP = {
            1   : '#ff0000',  // <-- Red
            2   : '#ffff00',  // <-- Yellow
            3   : '#00ff00',  // <-- Green
            4   : '#00ffff',  // <-- Cyan
            5   : '#0000ff',  // <-- Blue
            6   : '#ff00ff',  // <-- Magenta
            7   : '#ffffff',  // <-- White / Black (context-dependent)
            8   : '#808080',  // <-- Dark grey
            9   : '#c0c0c0',  // <-- Light grey
            250 : '#333333',
            251 : '#505050',
            252 : '#696969',
            253 : '#828282',
            254 : '#bebebe',
            255 : '#e1e1e1',
        };
        return Na__ACI_COLOR_MAP[aciIndex] || '#e2e8f0';                // <-- Fallback to light slate
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
