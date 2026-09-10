// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET LAYOUT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetLayout__.js
// NAMESPACE  : Na__LeLayout
// MODULE     : Layout Editor - Sheet Layout
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Solve the paper millimetre rectangles of a sheet
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Pure paper-space arithmetic: the page, the content area inside the
//   margin, the title block band, the drawing area above it. Every number
//   is a real paper millimetre. No DOM, no jsPDF.
// - Viewports are NOT solved here. They are free rectangles the author
//   places (D29); this module only says where the paper ends and where the
//   title block starts, so a viewport can be kept on the sheet.
// - Owns the paper size table reader, so an A3 sheet has exactly one
//   definition in the application.
//
// INTEGRATION:
// - SheetSurface lays the screen sheet out from this and PdfExporter draws
//   the page from it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetLayout__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - The drawing area stops Sheet.BlockGapMm short of the title block, as a
//   Lantern Designer sheet does. Only where a NEW viewport lands is affected;
//   placed viewports keep their own rectangles and are clamped to the page.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__GetTitleBlockSetup
    } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Resolve the Paper Size of a Sheet
    // ------------------------------------------------------------
    // Sizes are listed landscape; portrait swaps them here so a size is only
    // described once. Unknown keys fall back to the default paper.
    // ------------------------------------------------------------
    function Na__LeLayout__PaperSizeMm(paperSizeKey, orientation) {
        const setup = Na__LeCfg__GetSheetSetup();
        const key   = (paperSizeKey && setup.paperSizes[paperSizeKey]) ? paperSizeKey : setup.defaultPaperSize;
        const entry = setup.paperSizes[key] || { Label : key, WidthMm : 420, HeightMm : 297 };
        const isPortrait = (orientation || setup.defaultOrientation) === 'portrait';
        return {
            Key         : key,
            Label       : entry.Label || key,
            Orientation : isPortrait ? 'portrait' : 'landscape',
            WidthMm     : isPortrait ? entry.HeightMm : entry.WidthMm,
            HeightMm    : isPortrait ? entry.WidthMm  : entry.HeightMm
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | List the Paper Sizes for a Select
    // ------------------------------------------------------------
    function Na__LeLayout__ListPaperSizes() {
        const sizes = Na__LeCfg__GetSheetSetup().paperSizes;
        return Object.keys(sizes).map((key) => ({ Key : key, Label : sizes[key].Label || key }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Solve the Full Paper Layout for a Sheet Record
    // ------------------------------------------------------------
    // Returns:
    //   Page        { WidthMm, HeightMm, Orientation, SizeKey, Label }
    //   Content     { X, Y, WidthMm, HeightMm }     inside the margin
    //   TitleBlock  { X, Y, WidthMm, HeightMm }     foot of the content area
    //   Drawing     { X, Y, WidthMm, HeightMm }     everything above it
    //   MarginMm, ScreenPixelsPerMm, TitleBlockStyle
    // The classic title block is a scan of the whole sheet, so its band is
    // still reserved (the scan's own strip lives there) but nothing is
    // drawn into it by the chrome.
    // ------------------------------------------------------------
    function Na__LeLayout__Solve(sheet) {
        const sheetSetup = Na__LeCfg__GetSheetSetup();
        const titleSetup = Na__LeCfg__GetTitleBlockSetup();
        const page       = Na__LeLayout__PaperSizeMm(sheet ? sheet.Sheet__PaperSize : null, sheet ? sheet.Sheet__Orientation : null);
        const marginMm   = sheetSetup.marginMm;
        const titleMm    = titleSetup.heightMm;
        const style      = (sheet && sheet.Sheet__TitleBlockStyle === 'classic') ? 'classic' : 'modern';

        const content = {
            X        : marginMm,
            Y        : marginMm,
            WidthMm  : page.WidthMm  - (marginMm * 2),
            HeightMm : page.HeightMm - (marginMm * 2)
        };

        const titleBlock = {
            X        : content.X,
            Y        : content.Y + content.HeightMm - titleMm,
            WidthMm  : content.WidthMm,
            HeightMm : titleMm
        };

        // The drawing area stops a clear gap short of the title block. Without it the
        // strip reads as the bottom row of the drawing rather than as the sheet's own
        // footer, which is how a Lantern Designer sheet has always been set out.
        const drawing = {
            X        : content.X,
            Y        : content.Y,
            WidthMm  : content.WidthMm,
            HeightMm : Math.max(1, titleBlock.Y - sheetSetup.blockGapMm - content.Y)
        };

        return {
            Page              : { WidthMm : page.WidthMm, HeightMm : page.HeightMm, Orientation : page.Orientation, SizeKey : page.Key, Label : page.Label },
            Content           : content,
            TitleBlock        : titleBlock,
            Drawing           : drawing,
            MarginMm          : marginMm,
            TitleBlockStyle   : style,
            ScreenPixelsPerMm : sheetSetup.screenPixelsPerMm
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Rectangle on the Sheet (clamped, never resized)
    // ------------------------------------------------------------
    function Na__LeLayout__ClampToPage(layout, rect) {
        const page = layout.Page;
        const w = Math.min(rect.WidthMm,  page.WidthMm);
        const h = Math.min(rect.HeightMm, page.HeightMm);
        return {
            X        : Math.max(0, Math.min(rect.X, page.WidthMm  - w)),
            Y        : Math.max(0, Math.min(rect.Y, page.HeightMm - h)),
            WidthMm  : w,
            HeightMm : h
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a New Viewport Lands (centred in the drawing area)
    // ------------------------------------------------------------
    function Na__LeLayout__DefaultViewportRect(layout, widthMm, heightMm) {
        const area = layout.Drawing;
        const w = Math.min(widthMm,  area.WidthMm);
        const h = Math.min(heightMm, area.HeightMm);
        return {
            X        : area.X + ((area.WidthMm  - w) / 2),
            Y        : area.Y + ((area.HeightMm - h) / 2),
            WidthMm  : w,
            HeightMm : h
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Layout API
    // ------------------------------------------------------------
    export {
        Na__LeLayout__PaperSizeMm,
        Na__LeLayout__ListPaperSizes,
        Na__LeLayout__Solve,
        Na__LeLayout__ClampToPage,
        Na__LeLayout__DefaultViewportRect
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
