// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - EXPORT COMPOSITOR
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ExportCompositor__.js
// NAMESPACE  : Na__PlExport
// MODULE     : Projected Linework - Export Compositor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw the projected linework onto an exported image of a drawing
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Export Image while a drawing is on screen renders the composer frame at
//   export resolution through the tiled renderer. The linework lives in an
//   SVG over the canvas, so it is rasterised once at output size here and
//   drawn over the assembled image, keeping the section overlay the tiles
//   already carry underneath it.
//
// - The scale comes from the export camera's visible height, which the
//   composer preset's frustum override keeps while it widens or narrows the
//   width to the export aspect, so the linework lands on the same pixels the
//   render did whether or not the export aspect matches the viewport.
//
// INTEGRATION:
// - Na__UiFeature__ImageExport__Controls.js calls Apply on the finished
//   canvas before post-processing.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ExportCompositor__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Drawing Camera and the Overlay's Markup
    // ------------------------------------------------------------
    import { Na__DrawView__GetCamera } from '../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import {
        Na__PlOverlay__IsPainted,
        Na__PlOverlay__BuildSvgMarkup
    } from './Na__ProjectedLinework__SvgOverlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Compositing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Rasterise SVG Markup Into an Image
    // ------------------------------------------------------------
    function Na__PlExport__LoadSvg(markup) {
        return new Promise((resolve, reject) => {
            const blob  = new Blob([ markup ], { type : 'image/svg+xml;charset=utf-8' });
            const url   = URL.createObjectURL(blob);
            const image = new Image();
            image.onload  = () => { URL.revokeObjectURL(url); resolve(image); };
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG rasterisation failed')); };
            image.src = url;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Painted Linework Onto an Export Canvas
    // ------------------------------------------------------------
    // Returns true when linework was composited, false when there was none
    // or no drawing is on screen. Never throws: an export must not fail for
    // want of an overlay.
    // ------------------------------------------------------------
    async function Na__PlExport__Apply(canvas, cameraOverride) {
        try {
            if (!canvas || !Na__PlOverlay__IsPainted()) return false;
            const camera = cameraOverride || Na__DrawView__GetCamera();
            if (!camera) return false;

            const markup = Na__PlOverlay__BuildSvgMarkup(camera, canvas.width, canvas.height);
            if (!markup) return false;

            const image   = await Na__PlExport__LoadSvg(markup);
            const context = canvas.getContext('2d');
            if (!context) return false;

            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            return true;
        } catch (compositeError) {
            console.warn('[TrueVision3D ProjectedLinework] Export compositing skipped:', compositeError);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Export Compositor API
    // ------------------------------------------------------------
    export {
        Na__PlExport__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
