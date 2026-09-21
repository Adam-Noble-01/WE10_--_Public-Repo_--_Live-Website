// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - PDF
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Pdf__.js
// NAMESPACE  : Na__LeImgPdf
// MODULE     : Layout Editor - Sheet Images - PDF
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Cut every picture on a sheet into its print copy before the PDF page is drawn
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Drawing a PDF page is synchronous; loading and cutting a picture is not.
//   So the exporter waits here first: every picture on the sheet is fetched
//   (from the same cache the screen draws from), its kept part cut out and
//   resampled to the print resolution at its printed size, and handed to the
//   painter under its key. The page then draws them in the Layers list's
//   order like everything else.
// - The same picture with the same crop is cut once, at the largest size it
//   prints on the sheet.
// - A picture that cannot be had in time prints as the placeholder the
//   screen shows, and the export goes on: a missing picture is a reason to
//   look at the sheet, not a reason to lose the PDF.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Geometry, Paint, Painter, Source and Encoder
    // ------------------------------------------------------------
    import { Na__LeImgGeo__Rect } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgDraw__Block, Na__LeImgDraw__PdfKey, Na__LeImgDraw__ShadowOf } from './Na__LayoutEditor__SheetImages__Paint__.js';
    import { Na__LeImgPaint__SetPdfImage, Na__LeImgPaint__ClearPdfImages } from './Na__LayoutEditor__SheetImages__Painter__.js';
    import { Na__LeImgSrc__Blob } from './Na__LayoutEditor__SheetImages__Source__.js';
    import { Na__LeImgEnc__PdfCopy, Na__LeImgEnc__ShadowPng } from './Na__LayoutEditor__SheetImages__Encode__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Prepare Every Picture on a Sheet for the Page
    // ------------------------------------------------------------
    // Resolves to { prepared, missing: [ file, ... ] }; never rejects.
    // ------------------------------------------------------------
    async function Na__LeImgPdf__Prepare(sheet) {
        Na__LeImgPaint__ClearPdfImages();
        const wanted = new Map();                                                 // <-- PdfKey -> { block, rect } at its largest
        (sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes : []).forEach((shape) => {
            const block = Na__LeImgDraw__Block(shape);
            if (!block) return;
            const rect = Na__LeImgGeo__Rect(shape.Shape__Points);
            const key  = Na__LeImgDraw__PdfKey(block);
            const seen = wanted.get(key);
            if (!seen || rect.w > seen.rect.w) wanted.set(key, { block : block, rect : rect });
            // THE SHADOW | Its own PNG, one per size: a PDF has no blur, so the
            // screen's blur is rendered here, once, with the same numbers.
            const shadow = Na__LeImgDraw__ShadowOf(rect, block);
            if (shadow) {
                try {
                    const png = Na__LeImgEnc__ShadowPng(rect.w, rect.h, shadow);
                    if (png) Na__LeImgPaint__SetPdfImage(shadow.PdfKey, { dataUrl : png, format : 'PNG' });
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] A picture\'s shadow could not be rendered for the PDF; it prints without one.', error);
                }
            }
        });
        const missing = [];
        let prepared = 0;
        await Promise.all(Array.from(wanted.entries()).map(async ([ key, item ]) => {
            try {
                const blob = await Na__LeImgSrc__Blob(item.block.Image__Folder, item.block.Image__File);
                const copy = blob ? await Na__LeImgEnc__PdfCopy(blob, item.block.Image__Crop, item.rect, item.block.Image__Alpha === true) : null;
                if (!copy) { missing.push(item.block.Image__File); return; }
                Na__LeImgPaint__SetPdfImage(key, copy);
                prepared++;
            } catch (error) {
                console.warn('[TrueVision3D LayoutEditor] A picture could not be prepared for the PDF: ' + item.block.Image__File, error);
                missing.push(item.block.Image__File);
            }
        }));
        return { prepared : prepared, missing : missing };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images PDF API
    // ------------------------------------------------------------
    export {
        Na__LeImgPdf__Prepare
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
