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
// 19-Aug-2026 - Version 0.2.0
// - Status-bar hint when the server excluded a standards-library region from the
//   import (standardsRegions / standardsSkipped on the payload).
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — state population wired, SVG rendering stubbed.
//
// =============================================================================

import { Na__CommonUtils__SpatialIndex } from '../03__CommonUtils/Na__CommonUtils__SpatialIndex__.js';


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

            // BUILD UNIT-HANDLE INDEX — selection/deletion units (INSERT children → parent)
            const byHandle = new Map();
            data.entities.forEach((entity) => {
                if (entity.parentHandle) return;                         // <-- Children resolve via their parent unit
                byHandle.set(entity.handle, entity);
            });
            this._appState.entityByHandle = byHandle;

            // BUILD SPATIAL INDEX — selection and hit-testing query this instead
            // of scanning every entity in the drawing on each interaction
            const spatialIndex = new Na__CommonUtils__SpatialIndex();
            spatialIndex.Na__SpatialIndex__Build(data.entities);
            this._appState.spatialIndex = spatialIndex;

            // POPULATE LAYERS MAP — hexColor is resolved server-side by the DxfEngine
            const layersMap = new Map();
            if (data.layers) {
                Object.entries(data.layers).forEach(([name, layerData]) => {
                    layersMap.set(name, {
                        color       : layerData.color,                   // <-- Raw ACI index (reference)
                        hexColor    : layerData.hexColor || '#e2e2e8',   // <-- Server-resolved display colour
                        entityCount : layerData.entityCount || 0,
                        visible     : layerData.visible !== false,       // <-- Frozen/off layers arrive hidden
                    });
                });
            }
            this._appState.layers = layersMap;                           // <-- Update layers map

            // RENDER ENTITIES ON CANVAS
            this._cadCanvas.Na__CadCanvas__RenderEntities(data.entities);

            // APPLY INITIAL LAYER VISIBILITY (frozen/off layers from the DXF)
            layersMap.forEach((layerData, name) => {
                if (layerData.visible === false) {
                    this._cadCanvas.Na__CadCanvas__SetLayerVisibility(name, false);
                }
            });

            // UPDATE APP STATE — Triggers 'file:loaded' EventBus event
            this._appState.Na__AppState__SetFileLoaded(data.filename, data.tempPath);
            this._eventBus.emit('file:stats', {
                entityCount : data.entityCount ?? data.entities.length,  // <-- Status bar total readout
                unitCount   : byHandle.size,
            });

            // FIT VIEW TO DRAWING
            this._eventBus.emit('view:fit');                             // <-- Fit canvas to loaded drawing bounds

            // STANDARDS REGION HINT — confirms the standards library was skipped
            if (data.standardsSkipped > 0) {
                const regionCount = (data.standardsRegions || []).length;
                const regionLabel = regionCount > 1 ? `${regionCount} standards regions` : 'Standards region';
                this._eventBus.emit('status:hint', {
                    text : `${regionLabel} ignored — ${data.standardsSkipped} entities skipped on import`
                });
            }

            // EMBEDDED-IMAGE OUTCOME HINT — status feedback for purge/keep choice
            if (data.imagesPurged > 0) {
                this._eventBus.emit('status:hint', { text: `${data.imagesPurged} embedded image(s) purged before load` });
            } else if (data.imagesKept > 0) {
                this._eventBus.emit('status:hint', { text: `${data.imagesKept} embedded image(s) kept and rendered` });
            }

            console.log(`[Na__EntityLoader] Load complete — ${data.entities.length} entities, ${layersMap.size} layers`);
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // NOTE | ACI colour resolution now happens SERVER-SIDE in
    //        Na__LocalServer__DxfEngine__ — every entity and layer arrives with
    //        a pre-resolved hexColor field, so no frontend colour map is needed.

// endregion -------------------------------------------------------------------
