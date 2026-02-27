// =============================================================================
// TRUEVISION3D - PAGE LAYOUT SYSTEM - PDF EXPORT (A3)
// =============================================================================
//
// FILE       : Na__PageLayoutSystem__PdfExport__A3__.js
// NAMESPACE  : Na__PageLayout
// MODULE     : PDF Export A3
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Export the A3 layout as PDF using jsPDF (version-locked UMD build)
// CREATED    : 11-Feb-2026
//
// DESCRIPTION:
// - "Export Full Layout": A3 landscape PDF with title block + viewport image.
// - "Export Image Only": A3 landscape PDF with viewport image only (no title block).
// - Both exports use mm units matching the layout canvas coordinate system.
// - jsPDF is loaded as a UMD global via <script> tag in the layout HTML.
// - Accessed via window.jspdf.jsPDF (standard jsPDF UMD pattern).
// - Image positions from state.imageTransform map directly to PDF mm coordinates.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 11-Feb-2026 - Version 1.0.0
// - Initial implementation with full layout and image-only export modes.
// - Uses jsPDF v4.1.0 UMD build (version-locked, CDN independent).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | PDF Document Settings
    // ------------------------------------------------------------
    const Na__PageLayout__PDF_ORIENTATION = 'landscape'; // <-- A3 landscape orientation
    const Na__PageLayout__PDF_UNIT        = 'mm'; // <-- Millimeter units
    const Na__PageLayout__PDF_FORMAT      = 'a3'; // <-- A3 paper format
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Export Filenames
    // ------------------------------------------------------------
    const Na__PageLayout__FILENAME_FULL_LAYOUT = 'TrueVision3D__Layout__A3.pdf'; // <-- Full layout filename
    const Na__PageLayout__FILENAME_IMAGE_ONLY  = 'TrueVision3D__ImageOnly__A3.pdf'; // <-- Image only filename
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get jsPDF Constructor from UMD Global
    // ------------------------------------------------------------
    function Na__PageLayout__GetJsPDF() {
        if (window.jspdf && window.jspdf.jsPDF) {
            return window.jspdf.jsPDF; // <-- Return jsPDF constructor from UMD global
        }
        console.error('[PageLayout] jsPDF not found. Ensure jspdf.umd.js is loaded.'); // <-- Log error
        return null; // <-- Return null if not available
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Image Element to Data URL
    // ------------------------------------------------------------
    function Na__PageLayout__ImageToDataUrl(imageElement) {
        const canvas = document.createElement('canvas'); // <-- Create offscreen canvas
        canvas.width  = imageElement.naturalWidth || imageElement.width; // <-- Set canvas width
        canvas.height = imageElement.naturalHeight || imageElement.height; // <-- Set canvas height
        const ctx     = canvas.getContext('2d'); // <-- Get 2D context
        ctx.drawImage(imageElement, 0, 0); // <-- Draw image onto canvas
        return canvas.toDataURL('image/png'); // <-- Return as PNG data URL
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Create A3 Landscape PDF Document
    // ------------------------------------------------------------
    function Na__PageLayout__CreateA3Document() {
        const JsPDF = Na__PageLayout__GetJsPDF(); // <-- Get constructor
        if (!JsPDF) return null; // <-- Abort if not available

        return new JsPDF({
            orientation : Na__PageLayout__PDF_ORIENTATION, // <-- Landscape
            unit        : Na__PageLayout__PDF_UNIT, // <-- Millimeters
            format      : Na__PageLayout__PDF_FORMAT  // <-- A3
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Export Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Export Full Layout (Title Block + Viewport Image)
    // ------------------------------------------------------------
    function Na__PageLayout__ExportFullLayout(state) {
        if (!state) return; // <-- Guard against missing state

        const doc = Na__PageLayout__CreateA3Document(); // <-- Create PDF document
        if (!doc) return; // <-- Abort if jsPDF unavailable

        // Draw title block as background (full A3 size)
        // ------------------------------------------------------------
        if (state.titleBlockImage) {
            try {
                const titleBlockDataUrl = Na__PageLayout__ImageToDataUrl(state.titleBlockImage); // <-- Convert to data URL
                doc.addImage( // <-- Add title block to PDF
                    titleBlockDataUrl,
                    'PNG',
                    0, // <-- X position: left edge
                    0, // <-- Y position: top edge
                    state.a3.widthMm, // <-- Full A3 width (420mm)
                    state.a3.heightMm  // <-- Full A3 height (297mm)
                );
            } catch (err) {
                console.warn('[PageLayout] Failed to add title block to PDF:', err); // <-- Log warning
            }
        }

        // Draw viewport image at current position/size
        // ------------------------------------------------------------
        if (state.viewportImage) {
            try {
                const viewportDataUrl = Na__PageLayout__ImageToDataUrl(state.viewportImage); // <-- Convert to data URL
                doc.addImage( // <-- Add viewport image to PDF
                    viewportDataUrl,
                    'PNG',
                    state.imageTransform.x, // <-- X position in mm
                    state.imageTransform.y, // <-- Y position in mm
                    state.imageTransform.width, // <-- Width in mm
                    state.imageTransform.height  // <-- Height in mm
                );
            } catch (err) {
                console.error('[PageLayout] Failed to add viewport image to PDF:', err); // <-- Log error
            }
        }

        doc.save(Na__PageLayout__FILENAME_FULL_LAYOUT); // <-- Download PDF
    }
    // ------------------------------------------------------------


    // FUNCTION | Export Image Only (No Title Block)
    // ------------------------------------------------------------
    function Na__PageLayout__ExportImageOnly(state) {
        if (!state) return; // <-- Guard against missing state

        const doc = Na__PageLayout__CreateA3Document(); // <-- Create PDF document
        if (!doc) return; // <-- Abort if jsPDF unavailable

        // Draw viewport image at current position/size (no title block)
        // ------------------------------------------------------------
        if (state.viewportImage) {
            try {
                const viewportDataUrl = Na__PageLayout__ImageToDataUrl(state.viewportImage); // <-- Convert to data URL
                doc.addImage( // <-- Add viewport image to PDF
                    viewportDataUrl,
                    'PNG',
                    state.imageTransform.x, // <-- X position in mm (same as layout)
                    state.imageTransform.y, // <-- Y position in mm (same as layout)
                    state.imageTransform.width, // <-- Width in mm (same as layout)
                    state.imageTransform.height  // <-- Height in mm (same as layout)
                );
            } catch (err) {
                console.error('[PageLayout] Failed to add viewport image to PDF:', err); // <-- Log error
            }
        }

        doc.save(Na__PageLayout__FILENAME_IMAGE_ONLY); // <-- Download PDF
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Button Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize PDF Export Button Handlers
    // ------------------------------------------------------------
    function Na__PageLayout__InitPdfExport(state) {
        if (!state) return; // <-- Guard against missing state

        const exportFullButton      = document.getElementById('naLayoutExportFull'); // <-- Full layout button
        const exportImageOnlyButton = document.getElementById('naLayoutExportImageOnly'); // <-- Image only button

        if (exportFullButton) {
            exportFullButton.addEventListener('click', () => {
                Na__PageLayout__ExportFullLayout(state); // <-- Export full layout PDF
            });
        }

        if (exportImageOnlyButton) {
            exportImageOnlyButton.addEventListener('click', () => {
                Na__PageLayout__ExportImageOnly(state); // <-- Export image only PDF
            });
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | PDF Export API
    // ------------------------------------------------------------
    export {
        Na__PageLayout__InitPdfExport
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

