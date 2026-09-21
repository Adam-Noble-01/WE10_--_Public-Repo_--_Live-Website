// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - PAINTER
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Painter__.js
// NAMESPACE  : Na__LeImgPaint
// MODULE     : Layout Editor - Sheet Images - Painter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Paint a 'picture' primitive as SVG for the screen and into jsPDF for the page
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The sheet chrome hands a 'picture' primitive here from both of its
//   painters, the way it hands a QR symbol to the QR painter: the shadow
//   first, then the kept part of the picture, then the frame's rule over its
//   edge - the order the project introduction sheets are built in.
// - ON SCREEN the kept part is cut out by a nested <svg> whose viewBox is the
//   kept part in the stored file's own pixels. It clips by itself, so a crop
//   needs no clip path and no id, and the markup is the same string every
//   time the sheet is redrawn - the surface only rebuilds a layer whose
//   markup changed.
// - IN THE PDF the picture arrives already cut and resampled
//   (Na__LayoutEditor__SheetImages__Pdf__ prepares it before the page is
//   drawn, because loading a picture is asynchronous and drawing a page is
//   not), under an alias so a picture used twice is embedded once.
// - A picture still loading, or one that cannot be found, is a pale box with
//   its name in it on both surfaces, never a hole in the sheet.
// - A LEAF: it imports nothing, so the sheet chrome can import it without a
//   cycle through the rest of the feature.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Primitive Kind, States and the Placeholder
    // ------------------------------------------------------------
    const Na__LeImgPaint__KIND           = 'picture';
    const Na__LeImgPaint__STATE_READY    = 'ready';
    const Na__LeImgPaint__STATE_LOADING  = 'loading';
    const Na__LeImgPaint__STATE_MISSING  = 'missing';
    const Na__LeImgPaint__PLACE_FILL     = '#eeece6';
    const Na__LeImgPaint__PLACE_EDGE     = '#b3ad9f';
    const Na__LeImgPaint__PLACE_INK      = '#6f6a5c';
    const Na__LeImgPaint__PLACE_EDGE_MM  = 0.25;
    const Na__LeImgPaint__FONT           = "'Open Sans', Arial, sans-serif";
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Pictures Prepared for the PDF Being Built
    // ------------------------------------------------------------
    const Na__LeImgPaint__PdfImages = new Map();   // <-- PdfKey -> { dataUrl, format, alias }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Round for Markup, Escape for Markup
    // ------------------------------------------------------------
    function Na__LeImgPaint__R(value) { return Math.round(value * 1000) / 1000; }
    function Na__LeImgPaint__Escape(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hex Colour to RGB (a sane dark ink when it is not one)
    // ------------------------------------------------------------
    function Na__LeImgPaint__Rgb(hexColour) {
        let value = String(hexColour || '').trim().replace('#', '');
        if (/^[0-9a-fA-F]{3}$/.test(value)) value = value.split('').map((c) => c + c).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(value)) value = '555041';
        return { R : parseInt(value.substring(0, 2), 16), G : parseInt(value.substring(2, 4), 16), B : parseInt(value.substring(4, 6), 16) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Placeholder's Words at a Size That Fits the Box
    // ------------------------------------------------------------
    function Na__LeImgPaint__CaptionFontMm(primitive) {
        return Math.max(0.8, Math.min(3, primitive.HeightMm / 8, primitive.WidthMm / Math.max(8, String(primitive.Caption || '').length * 0.62)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SVG
// -----------------------------------------------------------------------------

    // FUNCTION | One Picture as SVG Markup
    // ------------------------------------------------------------
    function Na__LeImgPaint__Svg(primitive) {
        const R = Na__LeImgPaint__R;
        const p = primitive;
        if (!p || !(p.WidthMm > 0) || !(p.HeightMm > 0)) return '';
        const box = 'x="' + R(p.X) + '" y="' + R(p.Y) + '" width="' + R(p.WidthMm) + '" height="' + R(p.HeightMm) + '"';
        let out = '<g data-na-picture="1">';
        if (p.Shadow) {
            // A SOFT SHADOW: the picture's box, white, casting a blurred drop
            // shadow. The box itself sits under the picture and never shows.
            const s   = p.Shadow;
            const pct = s.RegionPct;
            out += '<defs><filter id="' + Na__LeImgPaint__Escape(s.FilterId) + '" x="-' + pct + '%" y="-' + pct + '%" width="' + (100 + (2 * pct)) + '%" height="' + (100 + (2 * pct)) + '%" color-interpolation-filters="sRGB">' +
                   '<feDropShadow dx="' + R(s.OffsetXMm) + '" dy="' + R(s.OffsetYMm) + '" stdDeviation="' + R(s.BlurMm) + '" flood-color="' + Na__LeImgPaint__Escape(s.Colour) + '" flood-opacity="' + R(s.Opacity) + '"/>' +
                   '</filter></defs>' +
                   '<rect ' + box + ' fill="#ffffff" stroke="none" filter="url(#' + Na__LeImgPaint__Escape(s.FilterId) + ')"/>';
        }
        if (p.State === Na__LeImgPaint__STATE_READY && p.Href) {
            const c  = p.Crop || { L : 0, T : 0, R : 1, B : 1 };
            const vb = R(c.L * p.PixelW) + ' ' + R(c.T * p.PixelH) + ' ' + R((c.R - c.L) * p.PixelW) + ' ' + R((c.B - c.T) * p.PixelH);
            out += '<svg ' + box + ' viewBox="' + vb + '" preserveAspectRatio="none" overflow="hidden">' +
                   '<image x="0" y="0" width="' + p.PixelW + '" height="' + p.PixelH + '" preserveAspectRatio="none" href="' + Na__LeImgPaint__Escape(p.Href) + '"/>' +
                   '</svg>';
        } else {
            const font = Na__LeImgPaint__CaptionFontMm(p);
            out += '<rect ' + box + ' fill="' + Na__LeImgPaint__PLACE_FILL + '" stroke="' + Na__LeImgPaint__PLACE_EDGE + '" stroke-width="' + Na__LeImgPaint__PLACE_EDGE_MM + '" stroke-dasharray="1.2 0.8"/>';
            if (p.Caption) {
                out += '<text x="' + R(p.X + (p.WidthMm / 2)) + '" y="' + R(p.Y + (p.HeightMm / 2) + (font * 0.35)) + '" font-family="' + Na__LeImgPaint__Escape(Na__LeImgPaint__FONT) +
                       '" font-size="' + R(font) + '" fill="' + Na__LeImgPaint__PLACE_INK + '" text-anchor="middle">' + Na__LeImgPaint__Escape(p.Caption) + '</text>';
            }
        }
        if (p.Frame && p.Frame.WidthMm > 0) {
            out += '<rect ' + box + ' fill="none" stroke="' + Na__LeImgPaint__Escape(p.Frame.Colour) + '" stroke-width="' + R(p.Frame.WidthMm) + '"/>';
        } else {
            // AN UNFRAMED PICTURE'S BOX, drawn with nothing: Draft mode hides
            // every raster and outlines a shape that has no line of its own,
            // so this is what shows where the picture is while Draft is on.
            out += '<rect ' + box + ' fill="none" stroke="none"/>';
        }
        return out + '</g>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | PDF
// -----------------------------------------------------------------------------

    // FUNCTION | Hold a Prepared Picture for the Page Being Built
    // ------------------------------------------------------------
    // entry: { dataUrl, format ('JPEG' | 'PNG') }. Cleared before each export
    // so a picture recropped since the last one is never printed stale.
    // ------------------------------------------------------------
    function Na__LeImgPaint__SetPdfImage(key, entry) {
        if (!key || !entry || typeof entry.dataUrl !== 'string') return;
        Na__LeImgPaint__PdfImages.set(key, { dataUrl : entry.dataUrl, format : entry.format || 'JPEG', alias : 'naLeImg_' + Na__LeImgPaint__PdfImages.size });
    }
    function Na__LeImgPaint__ClearPdfImages() {
        Na__LeImgPaint__PdfImages.clear();
    }
    // ------------------------------------------------------------


    // FUNCTION | One Picture Into jsPDF
    // ------------------------------------------------------------
    function Na__LeImgPaint__DrawPdf(doc, primitive) {
        const p = primitive;
        if (!doc || !p || !(p.WidthMm > 0) || !(p.HeightMm > 0)) return;
        try { doc.setLineDashPattern([], 0); } catch (e) { /* older jsPDF */ }
        if (p.Shadow) {
            // THE SAME BLUR, PRE-RENDERED: a PDF has no blur of its own, so the
            // exporter rendered this shadow as a transparent PNG before the
            // page was drawn (a PNG data URL is what keeps its alpha in jsPDF).
            const s      = p.Shadow;
            const shadow = s.PdfKey ? Na__LeImgPaint__PdfImages.get(s.PdfKey) : null;
            if (shadow) doc.addImage(shadow.dataUrl, 'PNG', p.X - s.MarginMm, p.Y - s.MarginMm, p.WidthMm + (2 * s.MarginMm), p.HeightMm + (2 * s.MarginMm), shadow.alias, 'FAST');
        }
        const prepared = p.PdfKey ? Na__LeImgPaint__PdfImages.get(p.PdfKey) : null;
        if (prepared) {
            doc.addImage(prepared.dataUrl, prepared.format, p.X, p.Y, p.WidthMm, p.HeightMm, prepared.alias, prepared.format === 'PNG' ? 'FAST' : undefined);
        } else {
            // NOT PREPARED | Loading failed, or the picture could not be found:
            // the pale box the screen shows, so the page still says where the
            // picture belongs rather than leaving a gap in the layout.
            const fill = Na__LeImgPaint__Rgb(Na__LeImgPaint__PLACE_FILL);
            const edge = Na__LeImgPaint__Rgb(Na__LeImgPaint__PLACE_EDGE);
            doc.setFillColor(fill.R, fill.G, fill.B);
            doc.setDrawColor(edge.R, edge.G, edge.B);
            doc.setLineWidth(Na__LeImgPaint__PLACE_EDGE_MM);
            doc.rect(p.X, p.Y, p.WidthMm, p.HeightMm, 'FD');
            console.warn('[TrueVision3D LayoutEditor] A picture was not ready for the PDF and prints as a placeholder:', p.Caption || p.PdfKey || '(unnamed)');
        }
        if (p.Frame && p.Frame.WidthMm > 0) {
            const ink = Na__LeImgPaint__Rgb(p.Frame.Colour);
            doc.setDrawColor(ink.R, ink.G, ink.B);
            doc.setLineWidth(p.Frame.WidthMm);
            doc.rect(p.X, p.Y, p.WidthMm, p.HeightMm, 'S');
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Painter API
    // ------------------------------------------------------------
    export {
        Na__LeImgPaint__KIND,
        Na__LeImgPaint__STATE_READY,
        Na__LeImgPaint__STATE_LOADING,
        Na__LeImgPaint__STATE_MISSING,
        Na__LeImgPaint__Svg,
        Na__LeImgPaint__SetPdfImage,
        Na__LeImgPaint__ClearPdfImages,
        Na__LeImgPaint__DrawPdf
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
