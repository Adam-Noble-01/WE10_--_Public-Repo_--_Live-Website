// ===================================================================================
// JAVASCRIPT | ARCHITECTURE ELEMENT EXPORT LOGIC
// ===================================================================================
//
// FILE NAME | BEF_-_Export-Logic.js
// FILE PATH | ./src/BEF_-_Export-Logic.js
//
// Description:
// - Contains export functionality for the Detect & Draw Architecture Elements application
// - Implements PNG black and white mask export
// - Implements DXF CAD file export
// - Integrates with existing UI and application structure
//
// VERSIONING HISTORY
// - 25-Apr-2025 - Version 1.0.0 - Initial implementation
// ----------------------------------------------------------------------------------

// DEPENDENCY IMPORTS
// ========================================================================== //
import * as SharedState from './BEF_-_Shared-State.js';

// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------

// EXPORT CONSTANTS
const DXF_HEADER_TEMPLATE = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
9
$DWGCODEPAGE
3
ANSI_1252
0
ENDSECTION
2
ENTITIES
`;

const DXF_FOOTER = `0
ENDSECTION
0
EOF`;

// ----------------------------------------------------------------------------------
// PNG EXPORT FUNCTIONS
// ----------------------------------------------------------------------------------

/**
 * Exports a black and white PNG mask of the current polygons
 * - White: Areas with filled geometry
 * - Black: Areas with no geometry
 * - Matches input image size exactly for mapping consistency
 * @returns {Promise<void>} Promise that resolves when export is complete
 */
export function exportPNGMask() {
    return new Promise((resolve, reject) => {
        try {
            SharedState.showStatus("Generating PNG mask export...");
            
            // Get canvas and check if we have proper data
            const canvas = SharedState.getCanvas();
            if (!canvas) {
                SharedState.showStatus("Error: Canvas not found", true);
                return reject(new Error("Canvas not found"));
            }
            
            if (!SharedState.originalImage) {
                SharedState.showStatus("Error: No image data available", true);
                return reject(new Error("No image data available"));
            }
            
            if (!SharedState.polygons || SharedState.polygons.length === 0) {
                SharedState.showStatus("Error: No polygons to export", true);
                return reject(new Error("No polygons to export"));
            }
            
            // Create a temporary canvas with the same dimensions as the original image
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = SharedState.originalImage.width;
            tempCanvas.height = SharedState.originalImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Clear and fill with black background
            tempCtx.fillStyle = 'black';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw all polygons in white
            tempCtx.fillStyle = 'white';
            for (const polygon of SharedState.polygons) {
                if (polygon.length < 3) continue; // Skip invalid polygons
                
                tempCtx.beginPath();
                tempCtx.moveTo(polygon[0].x, polygon[0].y);
                for (let i = 1; i < polygon.length; i++) {
                    tempCtx.lineTo(polygon[i].x, polygon[i].y);
                }
                tempCtx.closePath();
                tempCtx.fill();
            }
            
            // Convert canvas to PNG data URL
            const dataURL = tempCanvas.toDataURL('image/png');
            
            // Create a link element and trigger download
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `architecture-mask-${timestamp}.png`;
            link.href = dataURL;
            link.click();
            
            SharedState.showStatus("PNG mask exported successfully");
            resolve();
        } catch (error) {
            SharedState.showStatus(`PNG export failed: ${error.message}`, true);
            reject(error);
        }
    });
}

// ----------------------------------------------------------------------------------
// DXF EXPORT FUNCTIONS
// ----------------------------------------------------------------------------------

/**
 * Exports the current polygons as a DXF vector file
 * - Uses the same coordinates and scale defined in the application
 * - Maintains the same polygon structure
 * @returns {Promise<void>} Promise that resolves when export is complete
 */
export function exportDXF() {
    return new Promise((resolve, reject) => {
        try {
            SharedState.showStatus("Generating DXF export...");
            
            // Check if we have polygon data to export
            if (!SharedState.polygons || SharedState.polygons.length === 0) {
                SharedState.showStatus("Error: No polygons to export", true);
                return reject(new Error("No polygons to export"));
            }
            
            // Check if we have scale information
            if (!SharedState.pixelsPerMm) {
                SharedState.showStatus("Error: Scale information missing", true);
                return reject(new Error("Scale information missing"));
            }
            
            // Start building the DXF content
            let dxfContent = DXF_HEADER_TEMPLATE;
            
            // For each polygon, create a POLYLINE entity
            for (let i = 0; i < SharedState.polygons.length; i++) {
                const polygon = SharedState.polygons[i];
                if (polygon.length < 3) continue; // Skip invalid polygons
                
                // Add polyline header
                dxfContent += `0
POLYLINE
8
0
66
1
70
1
0
`;
                
                // Add vertices
                for (let j = 0; j < polygon.length; j++) {
                    const point = polygon[j];
                    // Convert from pixels to mm using the pixelsPerMm scale
                    const x = point.x / SharedState.pixelsPerMm;
                    const y = -point.y / SharedState.pixelsPerMm; // Y is inverted in DXF
                    
                    dxfContent += `VERTEX
8
0
10
${x.toFixed(6)}
20
${y.toFixed(6)}
30
0.0
0
`;
                }
                
                // Close the polyline
                dxfContent += `SEQEND
8
0
0
`;
            }
            
            // Add footer
            dxfContent += DXF_FOOTER;
            
            // Create a Blob with the DXF content
            const blob = new Blob([dxfContent], { type: 'application/dxf' });
            const url = URL.createObjectURL(blob);
            
            // Create a link element and trigger download
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `architecture-elements-${timestamp}.dxf`;
            link.href = url;
            link.click();
            
            // Clean up the URL object
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
            
            SharedState.showStatus("DXF file exported successfully");
            resolve();
        } catch (error) {
            SharedState.showStatus(`DXF export failed: ${error.message}`, true);
            reject(error);
        }
    });
} 