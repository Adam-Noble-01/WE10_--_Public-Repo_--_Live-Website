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
// - A band along the foot of the content area: the office logo in a cell on
//   the left, then the configured fields (client, site address, drawing
//   title, document id, revision, scale, date, drawn by, status) as cells
//   across the remaining width, each with a small muted label at the top and
//   the value beneath. Built as chrome primitives, so the screen and the PDF
//   paint the identical strip.
// - A CELL IS A WIDTH IN PAPER MILLIMETRES, NOT A SHARE OF THE STRIP. The
//   small cells are the same size on every paper, the Drawing Title takes
//   what the paper has left, and a value that will not fit its cell takes the
//   room from cells that are not using theirs. This module measures each
//   cell's label and value; Na__LayoutEditor__TitleBlock__Cells__ does the
//   arithmetic.
//   // @delegate: ./Na__LayoutEditor__TitleBlock__Cells__.js
// - THE RIGHT-HAND END IS THE PROJECT'S QR CODE, mirroring the logo at the
//   left: an absolute width off the end of the strip, with the fields solved
//   across what is left between the two. Status is therefore the last FIELD,
//   and the code's cell stands beyond it in the sheet's bottom right corner.
//   // @delegate: ./Na__LayoutEditor__TitleBlock__QrCell__.js
//
// INTEGRATION:
// - Called by Na__LeChrome__Build for sheets in the modern style (D26).
// - EVERY CELL'S LABEL IS A TEXT RUN AT THE CELL'S LEFT PADDING, ON ONE SHARED
//   BASELINE. The parametric scrapbook's link noodle finds the Scale cell by
//   reading exactly that off the chrome (Na__LeParamNoodle__ScaleCell), so a
//   change to where a label sits is a change to that module too.
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
// - Parity        : verbatim until v1.2.0
// - Divergences   : Console prefix, header and folder numbers; from v1.2.0 the
//                   cell widths (paper millimetres solved against the text,
//                   TrueVision first on 19-Sep-2026) and the logo fallback text.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.4.0
// - Each cell's floor - its label with its padding - goes to the solver with
//   its need, for Cells 1.1.0: on a strip too narrow even for the text, the
//   Drawing Title is cut first, down to that floor, before any other value is
//   touched. A cell is never cut past saying what it is.
//
// 19-Sep-2026 - Version 1.3.0
// - The strip ends in a QR cell (Na__LayoutEditor__TitleBlock__QrCell__): the
//   project's code and a note saying what scanning it does. It is solved
//   before the fields and its width taken off the strip they are solved
//   across, so the cell solver is unchanged and simply gets a narrower strip.
//   With no project on the address bar there is no cell and nothing here moves.
//
// 19-Sep-2026 - Version 1.2.0
// - Cell widths are paper millimetres solved by
//   Na__LayoutEditor__TitleBlock__Cells__, not shares of the strip. Adam: the
//   Client and Document ID cells were "needlessly oversized" while the Drawing
//   Title was "completely cut off". Each cell's label and value are measured
//   here and handed to the solver, so a value is only ever cut short when no
//   cell on the strip has room left to give it.
// - A value that fits is printed as it is, without a second trip through
//   FitText: the cell was sized FROM the measured text, and asking FitText about
//   cell - padding * 2 can land femtometres under that same measurement and
//   eat the end off a value the cell was built to hold (the caption bug of
//   SheetChrome v1.8.0, which this would otherwise have repeated).
// - The text drawn while the logo loads, or when it cannot be fetched, read
//   VALE GARDEN HOUSES - left behind by the port. A Noble Architecture drawing
//   exported with the logo missing would have printed another firm's name.
//
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
    import { Na__LeCfg__GetTitleBlockSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeChrome__PushRect,
        Na__LeChrome__PushLine,
        Na__LeChrome__PushText,
        Na__LeChrome__PushImage,
        Na__LeChrome__FitText,
        Na__LeChrome__MeasureTextMm,
        Na__LeChrome__BaselineFromTop,
        Na__LeChrome__BaselineCentred
    } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeTitleCells__Cell, Na__LeTitleCells__Solve } from './Na__LayoutEditor__TitleBlock__Cells__.js';   // <-- A leaf: numbers in, numbers out
    import { Na__LeTitleQr__Solve, Na__LeTitleQr__Build } from './Na__LayoutEditor__TitleBlock__QrCell__.js';      // <-- The right-hand end cell: the project's QR code and its note
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Logo's Stand-In and the Fit Tolerance
    // ------------------------------------------------------------
    const Na__LeTitleModern__LOGO_FALLBACK_TEXT = 'NOBLE ARCHITECTURE';          // <-- Drawn while the logo loads, and printed if it never arrives
    const Na__LeTitleModern__FIT_TOLERANCE_MM   = 0.001;                         // <-- A cell sized from its text must not lose that text to a rounding hair
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


    // HELPER FUNCTION | One Cell's Label and Value, and the Room They Ask For
    // ------------------------------------------------------------
    // needMm is the wider of the two with the cell's padding either side: what
    // the solver must give the cell for neither to be cut short. floorMm is the
    // label alone with its padding: the least the solver may cut a Flex cell to
    // on paper too narrow for the strip, so a cell always says what it is.
    // Measured with the same face, size, weight and tracking the text is then
    // drawn in.
    // ------------------------------------------------------------
    function Na__LeTitleModern__MeasureCell(row, fields, setup, style) {
        const value = fields[row.Key] !== undefined && fields[row.Key] !== null ? String(fields[row.Key]) : '';
        let   label = String(row.Label || row.Key || '');
        if (style.titleLabelUppercase) label = label.toUpperCase();

        const labelMm = Na__LeChrome__MeasureTextMm(label, setup.fontSizeLabelMm, style.titleLabelWeight, style.titleLabelTrackingMm);
        const valueMm = Na__LeChrome__MeasureTextMm(value, setup.fontSizeValueMm, style.titleValueWeight);
        return {
            row     : row,
            label   : label,
            value   : value,
            labelMm : labelMm,
            valueMm : valueMm,
            needMm  : Math.max(labelMm, valueMm) + (setup.fieldPaddingHMm * 2),
            floorMm : labelMm + (setup.fieldPaddingHMm * 2)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Modern Title Block Primitives
    // ------------------------------------------------------------
    // fields: { Client, SiteAddress, Title, DocumentId, Revision, Scale, Date, DrawnBy, Status }
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
                Text : Na__LeTitleModern__LOGO_FALLBACK_TEXT, FontMm : setup.fontSizeValueMm, Weight : style.titleValueWeight, Colour : style.inkColour, Align : 'center'
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

        // FIELD CELLS | Paper millimetres, solved against what each cell has to say
        // Every cell is measured before any is drawn, because a value that
        // overruns its cell is given room out of the others (the Cells module).
        // The QR cell is solved first because it is an absolute width off the
        // right-hand end, as the logo is off the left: the fields are solved
        // across what is left between the two. With no code to draw it is null
        // and the fields keep the whole strip, exactly as before it existed. It
        // is told what the logo takes, because on paper too narrow for both end
        // cells and the fields it gives up its note rather than cut a field.
        const qrCell = Na__LeTitleQr__Solve(band, setup, logo.Cell.WidthMm, style);
        const stripX = logo.Cell.X + logo.Cell.WidthMm;
        const stripW = Math.max(0, band.WidthMm - logo.Cell.WidthMm - (qrCell ? qrCell.Cell.WidthMm : 0));
        const cells  = setup.rows.map((row) => Na__LeTitleModern__MeasureCell(row, fields, setup, style));
        const widths = Na__LeTitleCells__Solve(stripW, cells.map((cell) => Na__LeTitleCells__Cell(cell.row, cell.needMm, cell.floorMm)));

        let cursor = stripX;
        cells.forEach((cell, index) => {
            const cellW = widths[index];
            const room  = Math.max(0, cellW - (pad * 2));
            const fits  = (textMm) => textMm <= room + Na__LeTitleModern__FIT_TOLERANCE_MM;   // <-- A run the cell was sized from is never sent back through FitText

            if (index > 0) Na__LeChrome__PushLine(list, cursor, band.Y, cursor, band.Y + band.HeightMm, style.frameLineColour, style.frameStrokeMm);

            Na__LeChrome__PushText(list, {
                X : cursor + pad, BaselineY : labelBaseY,
                Text : fits(cell.labelMm) ? cell.label : Na__LeChrome__FitText(cell.label, setup.fontSizeLabelMm, style.titleLabelWeight, room, style.titleLabelTrackingMm),
                FontMm : setup.fontSizeLabelMm, Weight : style.titleLabelWeight, Colour : style.mutedTextColour,
                Align : 'left', TrackingMm : style.titleLabelTrackingMm
            });
            Na__LeChrome__PushText(list, {
                X : cursor + pad, BaselineY : valueBaseY,
                Text : fits(cell.valueMm) ? cell.value : Na__LeChrome__FitText(cell.value, setup.fontSizeValueMm, style.titleValueWeight, room),
                FontMm : setup.fontSizeValueMm, Weight : style.titleValueWeight, Colour : style.inkColour, Align : 'left'
            });
            cursor += cellW;
        });

        // QR CELL | Drawn last, so its ink rule lies over the last field's
        Na__LeTitleQr__Build(list, qrCell, setup, style);
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
