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
    function Na__ExportSerializer__BuildOutputFilename(sourceFilename) {
        if (!sourceFilename) return 'drawing__audited.dxf';

        const baseName = sourceFilename.replace(/\.[^/.]+$/, '');        // <-- Strip extension
        return `${baseName}__audited.dxf`;                               // <-- Append audit suffix
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
