// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TITLE BLOCK (MODERN)
// =============================================================================
//
// FILE       : Na__LayoutEditor__TitleBlock__Modern__.js
// NAMESPACE  : Na__LeTitleModern
// MODULE     : Layout Editor - Title Block Modern
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The vector title block: Vale logo and one strip of fields
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A band along the foot of the content area: the Vale logo in a cell on
//   the left, then the configured fields (client, site address, drawing
//   title, number, revision, scale, date, drawn by) as cells across the
//   remaining width, each with a small muted label at the top and the value
//   beneath. Built as chrome primitives, so the screen and the PDF paint the
//   identical strip.
//
// INTEGRATION:
// - Called by Na__LeChrome__Build for sheets in the modern style (D26).
//
// -----------------------------------------------------------------------------
//
// WHY THE VALUE IS CENTRED RATHER THAN HUNG FROM THE FOOT OF THE STRIP:
// It used to be pinned to the bottom edge of the band and the label to the top,
// which on a 16 mm strip left about 10 mm of blank paper between the two - a cell
// read as two runs of text parked in opposite corners of a box rather than as a
// caption over a value. Every cell now prints on one pair of baselines: the label
// hangs from the top of the strip, the value is optically centred in the band left
// below it, and a short value sits level with a long one all the way across.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__TitleBlock__Modern__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Strip geometry and typesetting brought onto Lantern Designer's: 1.6 mm labels
//   over 2.2 mm values, one pair of baselines, Lantern's field paddings, tracked
//   uppercase labels, and the logo at its own printed size rather than filling
//   the cell.
// - Logo aspect read from config. It was hardcoded at 4.2:1 against an asset that
//   is 4.5:1, so the Vale mark printed 7 percent too tall on every sheet.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Primitive Builders
    // ------------------------------------------------------------
    import { Na__LeCfg__GetTitleBlockSetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeChrome__PushRect,
        Na__LeChrome__PushLine,
        Na__LeChrome__PushText,
        Na__LeChrome__PushImage,
        Na__LeChrome__FitText,
        Na__LeChrome__BaselineFromTop,
        Na__LeChrome__BaselineCentred
    } from './Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Builder
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Solve the Logo Cell and the Image Inside It
    // ------------------------------------------------------------
    // The mark is drawn at its configured printed width, then shrunk only if the
    // padded cell or the height cap will not take it - so it is the same size on
    // every paper rather than growing with the sheet. Both painters stretch an
    // image to the rectangle they are handed and the asset cache carries no pixel
    // dimensions, so the aspect is taken from config; get it wrong and the Vale
    // mark prints squashed, which is how it stood before this was configurable.
    // ------------------------------------------------------------
    function Na__LeTitleModern__SolveLogo(band, setup) {
        const cellW   = Math.min(setup.logoCellWidthMm, band.WidthMm / 3);
        const aspect  = setup.logoAspect > 0 ? setup.logoAspect : 4.5;
        const roomW   = Math.max(0, cellW - (setup.logoPaddingHMm * 2));
        const roomH   = Math.max(0, Math.min(setup.logoMaxHeightMm, band.HeightMm - (setup.logoPaddingVMm * 2)));

        let imageW = setup.logoWidthMm;
        let imageH = imageW / aspect;
        if (roomW > 0 && imageW > roomW) { imageW = roomW; imageH = imageW / aspect; }
        if (roomH > 0 && imageH > roomH) { imageH = roomH; imageW = imageH * aspect; }

        return {
            Cell  : { X : band.X, Y : band.Y, WidthMm : cellW, HeightMm : band.HeightMm },
            Image : { X : band.X + ((cellW - imageW) / 2), Y : band.Y + ((band.HeightMm - imageH) / 2), WidthMm : imageW, HeightMm : imageH }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Modern Title Block Primitives
    // ------------------------------------------------------------
    // fields: { Client, SiteAddress, Title, DrawingNumber, Revision, Scale, Date, DrawnBy }
    // cachedAsset(path) returns a data URL or null while it loads.
    // ------------------------------------------------------------
    function Na__LeTitleModern__Build(list, layout, fields, style, cachedAsset) {
        const setup = Na__LeCfg__GetTitleBlockSetup();
        const band  = layout.TitleBlock;

        Na__LeChrome__PushRect(list, band.X, band.Y, band.WidthMm, band.HeightMm, style.inkColour, style.frameStrokeMm, style.paperColour);

        // LOGO CELL
        const logo    = Na__LeTitleModern__SolveLogo(band, setup);
        const dataUrl = typeof cachedAsset === 'function' ? cachedAsset(setup.logoAssetPath) : null;
        if (dataUrl) {
            Na__LeChrome__PushImage(list, logo.Image.X, logo.Image.Y, logo.Image.WidthMm, logo.Image.HeightMm, dataUrl);
        } else {
            Na__LeChrome__PushText(list, {
                X : logo.Cell.X + (logo.Cell.WidthMm / 2), BaselineY : Na__LeChrome__BaselineCentred(band.Y, band.HeightMm, setup.fontSizeValueMm),
                Text : 'VALE GARDEN HOUSES', FontMm : setup.fontSizeValueMm, Weight : style.titleValueWeight, Colour : style.inkColour, Align : 'center'
            });
        }
        Na__LeChrome__PushLine(list, logo.Cell.X + logo.Cell.WidthMm, band.Y, logo.Cell.X + logo.Cell.WidthMm, band.Y + band.HeightMm, style.inkColour, style.frameStrokeMm);

        // BASELINES | One pair for the whole strip
        // The label hangs from the top of the band; the value is optically centred
        // in what is left below it. Every cell prints on these same two lines, so a
        // short value and a long one sit level across the strip.
        const pad        = setup.fieldPaddingHMm;
        const valueBandY = band.Y + setup.fieldPaddingTopMm;
        const valueBandH = Math.max(0, band.HeightMm - setup.fieldPaddingTopMm - setup.fieldPaddingBottomMm);
        const valueBaseY = Na__LeChrome__BaselineCentred(valueBandY, valueBandH, setup.fontSizeValueMm);
        const labelBaseY = Na__LeChrome__BaselineFromTop(band.Y + setup.labelOffsetTopMm, setup.fontSizeLabelMm);

        // FIELD CELLS | Widths are relative shares of what is left
        const rows   = setup.rows;
        const stripX = logo.Cell.X + logo.Cell.WidthMm;
        const stripW = band.WidthMm - logo.Cell.WidthMm;
        let   total  = 0;
        rows.forEach((row) => { total += (typeof row.WidthMm === 'number' && row.WidthMm > 0) ? row.WidthMm : 1; });

        let cursor = stripX;
        rows.forEach((row, index) => {
            const share = ((typeof row.WidthMm === 'number' && row.WidthMm > 0) ? row.WidthMm : 1) / total;
            const cellW = stripW * share;
            const room  = Math.max(0, cellW - (pad * 2));
            const value = fields[row.Key] !== undefined && fields[row.Key] !== null ? String(fields[row.Key]) : '';

            let label = String(row.Label || row.Key || '');
            if (style.titleLabelUppercase) label = label.toUpperCase();

            if (index > 0) Na__LeChrome__PushLine(list, cursor, band.Y, cursor, band.Y + band.HeightMm, style.frameLineColour, style.frameStrokeMm);

            Na__LeChrome__PushText(list, {
                X : cursor + pad, BaselineY : labelBaseY,
                Text : Na__LeChrome__FitText(label, setup.fontSizeLabelMm, style.titleLabelWeight, room, style.titleLabelTrackingMm),
                FontMm : setup.fontSizeLabelMm, Weight : style.titleLabelWeight, Colour : style.mutedTextColour,
                Align : 'left', TrackingMm : style.titleLabelTrackingMm
            });
            Na__LeChrome__PushText(list, {
                X : cursor + pad, BaselineY : valueBaseY,
                Text : Na__LeChrome__FitText(value, setup.fontSizeValueMm, style.titleValueWeight, room),
                FontMm : setup.fontSizeValueMm, Weight : style.titleValueWeight, Colour : style.inkColour, Align : 'left'
            });
            cursor += cellW;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Modern Title Block API
    // ------------------------------------------------------------
    export {
        Na__LeTitleModern__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
