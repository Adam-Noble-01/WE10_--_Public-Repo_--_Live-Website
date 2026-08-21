// =============================================================================
// NOBLE CAD AUDIT TOOLS - EXPORT SERIALIZER
// =============================================================================
//
// FILE      : Na__CadEngine__ExportSerializer__.js
// NAMESPACE : CadAuditTools.CadEngine
// MODULE    : ExportSerializer
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Builds the payload for the /api/save endpoint from deleted entity handles
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Reads AppState.deletedHandles and AppState.tempDxfPath.
// - Returns a POST body JSON suitable for Flask /api/save.
// - The server uses this payload to call ezdxf, prune the deleted entity handles
//   from the working DXF, and write the pruned file to
//   04__LocalProjectCache/02__SavedProjects__AuditedDxfFiles/.
//
// PAYLOAD SHAPE:
//   {
//     tempDxfPath    : "/abs/path/in/cache/drawing.dxf",
//     deletedHandles : ["A1B2", "C3D4", ...],
//     outputFilename : "drawing__audited.dxf"   (optional, server can derive)
//   }
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Aug-2026 - Version 0.2.0
// - Added Na__ExportSerializer__BuildSketchUpExportPayload — stripAnnotations
//   payload for the Export to SketchUp button (filename suffix __sketchup.dxf).
// - Na__ExportSerializer__BuildOutputFilename takes a variant suffix.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | ExportSerializer Class
// -----------------------------------------------------------------------------

    export class Na__CadEngine__ExportSerializer {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState = appState;
            this._eventBus = eventBus;
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the Deleted-Handle Payload for /api/save
        // ------------------------------------------------------------
        Na__ExportSerializer__BuildDeletedHandlePayload() {
            const handles = [...this._appState.deletedHandles];         // <-- Convert Set to Array for JSON serialisation

            if (handles.length === 0) {
                console.warn('[Na__ExportSerializer] No deleted handles to export — nothing to save');
                return null;
            }

            const outputFilename = Na__ExportSerializer__BuildOutputFilename(this._appState.fileName);

            const payload = {
                tempDxfPath    : this._appState.tempDxfPath,            // <-- Server working DXF path
                deletedHandles : handles,                               // <-- Entity handles to prune
                outputFilename : outputFilename,                        // <-- Suggested save filename
            };

            console.log(`[Na__ExportSerializer] Payload: ${handles.length} deleted handles, saving as "${outputFilename}"`);
            return payload;
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the Versioned Project-Save Payload for /api/project-save
        // ------------------------------------------------------------
        Na__ExportSerializer__BuildProjectSavePayload(projectName) {
            const layers = {};
            this._appState.layers.forEach((layerData, name) => {
                layers[name] = {
                    hexColor    : layerData.hexColor,
                    entityCount : layerData.entityCount,
                    visible     : layerData.visible,
                };
            });

            return {
                tempDxfPath    : this._appState.tempDxfPath,            // <-- Server working DXF path
                deletedHandles : [...this._appState.deletedHandles],    // <-- Unit handles to prune
                projectName    : projectName,                           // <-- Project subfolder name
                sourceFilename : this._appState.fileName,               // <-- Original upload name
                layers         : layers,                                // <-- Layer metadata snapshot
                dimensions     : this._appState.dimensions || [],       // <-- Annotation dimensions snapshot
            };
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the DXF Download Payload for /api/export-dxf
        // ------------------------------------------------------------
        Na__ExportSerializer__BuildExportPayload() {
            const outputFilename = Na__ExportSerializer__BuildOutputFilename(this._appState.fileName);
            return {
                tempDxfPath    : this._appState.tempDxfPath,
                deletedHandles : [...this._appState.deletedHandles],    // <-- Empty array = full file export
                outputFilename : outputFilename,
            };
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the SketchUp Export Payload for /api/export-write
        // ------------------------------------------------------------
        Na__ExportSerializer__BuildSketchUpExportPayload() {
            const outputFilename = Na__ExportSerializer__BuildSketchUpFilename(this._appState.fileName);
            return {
                tempDxfPath      : this._appState.tempDxfPath,
                deletedHandles   : [...this._appState.deletedHandles],
                outputFilename   : outputFilename,
                stripAnnotations : true,                                // <-- Server drops text/dim/leader/hatch etc.
            };
        }
        // ------------------------------------------------------------


        // FUNCTION | Return a Summary of the Current Deletion State (for UI display)
        // ------------------------------------------------------------
        Na__ExportSerializer__GetDeletionSummary() {
            return {
                deletedCount : this._appState.deletedHandles.size,      // <-- Number of entities deleted
                totalCount   : this._appState.entities.length,           // <-- Original entity count
                fileName     : this._appState.fileName,                 // <-- Source file name
            };
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Derive an Output Filename from the Source Filename
    // ------------------------------------------------------------
    function Na__ExportSerializer__BuildOutputFilename(sourceFilename, suffix = 'audited') {
        if (!sourceFilename) return `drawing__${suffix}.dxf`;

        const baseName = sourceFilename.replace(/\.[^/.]+$/, '');        // <-- Strip extension
        return `${baseName}__${suffix}.dxf`;                             // <-- Append variant suffix
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Derive the SketchUp Export Filename (Studio Prefix Convention)
    // ------------------------------------------------------------
    function Na__ExportSerializer__BuildSketchUpFilename(sourceFilename) {
        const baseName = (sourceFilename || 'drawing').replace(/\.[^/.]+$/, '');
        return `Audited__SketchUpExport__${baseName}__.dxf`;             // <-- Prefix + trailing __ per studio naming
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
