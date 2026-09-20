// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TITLE BLOCK QR CELL
// =============================================================================
//
// FILE       : Na__LayoutEditor__TitleBlock__QrCell__.js
// NAMESPACE  : Na__LeTitleQr
// MODULE     : Layout Editor - Title Block QR Cell
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The right-hand cell of the modern title block: the project's QR code and the note beside it
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The bottom right-hand corner of every drawing is given over to one thing:
//   the project's QR code, and a note saying what scanning it does. Anybody
//   holding the sheet can point a phone at it and be standing in the 3D model.
// - IT IS A TITLE BLOCK CELL, NOT A BOX BESIDE ONE. It mirrors the logo cell
//   at the other end of the strip: an absolute width in paper millimetres
//   taken off the right, the same on every paper, divided from the fields by
//   the same rule the logo cell is, with the field cells solved across what is
//   left between the two.
// - THE CODE IS AS TALL AS THE STRIP ALLOWS AND NEEDS NO DIMENSION OF ITS OWN.
//   The square is the strip's height less the quiet zone the symbol is owed,
//   so the clear margin above and below is always exactly that many modules,
//   whatever version the project's address encodes to. Make the title block
//   taller and the code follows it. At the shipped 10 mm strip and 2 modules
//   that is an 8.79 mm code with 0.61 mm round it - Lantern Designer's 8.8 and
//   0.6, arrived at by rule rather than typed in.
// - A bold instruction over lighter supporting copy, the note set as one block
//   centred in the strip's height - Lantern Designer's terms cell, which this
//   is modelled on. It inverts the caption-over-value rhythm of the field
//   cells on purpose: those caption a value the reader is looking for, whereas
//   this one is telling them to do something, so the instruction leads.
// - ON NARROW PAPER THE NOTE GOES BEFORE ANY FIELD IS CUT. Where the whole
//   cell would leave the fields less strip than NoteMinFieldRoomMm - A4, or A3
//   turned portrait - the cell is drawn COMPACT: the code at its full size,
//   with a short caption turned up its left side, about 12 mm wide in place
//   of 56. The code is what the cell is for; the sentence is what can go.
//   The test is the paper's width and nothing on the sheet, so every sheet of
//   one size in a pack is drawn the same way, whatever its title runs to.
// - NO CODE, NO CELL. With no project on the address bar, or the Project QR
//   Code system switched off, Solve answers null and the fields keep the
//   whole strip. A note telling people to scan a code that is not there would
//   be worse than neither.
//
// INTEGRATION:
// - Called by Na__LeTitleModern__Build: Solve before the field cells, so they
//   are solved across the narrower strip, and Build after them.
// - The symbol and the words come from the Project QR Code system, which is
//   the only place that knows the address. This module only knows where they go.
//   // @delegate: ../../53__System__ProjectQrCode/Na__ProjectQr__Symbol__.js
// - THE NOTE'S BASELINES ARE NOT THE FIELD LABELS'. The parametric scrapbook's
//   link noodle finds the Scale cell by reading label runs on the strip's
//   shared label baseline (Na__LeParamNoodle__ScaleCell); this cell's text is
//   centred as a block, or turned on its side, and never lands on that line.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026), after Lantern Designer's
//                   VghLantern__SheetChrome__SolveTermsCell / BuildTermsCell.
// - Divergences   : The square carries a true quiet zone (Lantern's was
//                   declared in config and read by nothing); the text block is
//                   centred as a whole; the body is justified as a whole or
//                   not at all; and there is a compact form for narrow paper.
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Primitive Builders, Text Measurement and the Project's Symbol
    // ------------------------------------------------------------
    import {
        Na__LeChrome__PushLine,
        Na__LeChrome__PushText,
        Na__LeChrome__PushQr,
        Na__LeChrome__FitText,
        Na__LeChrome__MeasureTextMm,
        Na__LeChrome__BaselineFromTop
    } from './Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__ProjectQr__GetSetup,
        Na__ProjectQr__GetSymbol,
        Na__ProjectQr__GetNote,
        Na__ProjectQr__CheckPrint
    } from '../../53__System__ProjectQrCode/Na__ProjectQr__Symbol__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Weights, the Strip Share Cap, the Caption's Turn and the Report Name
    // ------------------------------------------------------------
    const Na__LeTitleQr__HEADING_WEIGHT  = 'bold';
    const Na__LeTitleQr__BODY_WEIGHT     = 'normal';
    const Na__LeTitleQr__MAX_BAND_SHARE  = 1 / 3;                                // <-- The logo cell's own cap: no end cell takes more than a third of the strip
    const Na__LeTitleQr__CAPTION_TURN    = -90;                                  // <-- Reads upward, its capitals' tops to the left, as a spine title does
    const Na__LeTitleQr__WHERE           = 'Drawing title block';                // <-- How this document names itself to the print check
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Last Wrap
    // ------------------------------------------------------------
    // The chrome is rebuilt on every frame of a viewport drag, and wrapping
    // measures every word. The note is the same on every one of those builds,
    // so the last wrap is kept against everything that could change it.
    // ------------------------------------------------------------
    let Na__LeTitleQr__WrapKey   = null;
    let Na__LeTitleQr__WrapLines = [];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Text Setting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Chrome's Own Cap Height for a Font Size
    // ------------------------------------------------------------
    // Asked of the chrome rather than restated, so this cell and the field
    // cells agree on where type sits.
    // ------------------------------------------------------------
    function Na__LeTitleQr__CapOf(fontMm) {
        return Na__LeChrome__BaselineFromTop(0, fontMm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Greedily Fill Lines to a Given Width, With No Cap on How Many
    // ------------------------------------------------------------
    // The plain word-wrap a column of any width reduces to. Used both to find
    // how many lines the full column needs, and again at a narrower width
    // while balancing (below), so the two always agree on where a word breaks.
    // ------------------------------------------------------------
    function Na__LeTitleQr__GreedyLines(words, fontMm, weight, widthMm) {
        const lines = [];
        let current = '';
        for (let i = 0; i < words.length; i++) {
            const candidate = current === '' ? words[i] : current + ' ' + words[i];
            if (Na__LeChrome__MeasureTextMm(candidate, fontMm, weight) <= widthMm) { current = candidate; continue; }
            if (current !== '') lines.push(current);
            current = words[i];
        }
        if (current !== '') lines.push(current);
        return lines;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap Text to a Paper Width, Within a Line Count
    // ------------------------------------------------------------
    // BALANCED, not merely fitted. A plain greedy fill packs every line but
    // the last as full as the column allows, which is exactly what leaves a
    // short paragraph looking torn rather than set: two lines with one word
    // hanging out past where the other stops, not a block. So the column the
    // words are actually filled to is narrowed - the widest it can be while
    // the text still takes the SAME number of lines it takes at the full
    // width - and it is THAT narrower width the words are wrapped to, giving
    // each line roughly its fair share rather than the first all it can hold.
    //
    // Measured through the chrome's own measurer, so the note breaks in the
    // same place on screen as on paper. Copy too long for the cell still
    // fills every line before the last is truncated with an ellipsis, exactly
    // as a plain fit would - balancing only touches text that already fits
    // the line count it is given.
    // ------------------------------------------------------------
    function Na__LeTitleQr__Wrap(text, fontMm, weight, maxWidthMm, maxLines) {
        const words = String(text || '').split(/\s+/).filter((word) => word !== '');
        if (!(maxLines >= 1) || !(maxWidthMm > 0) || words.length === 0) return [];

        const fitted = Na__LeTitleQr__GreedyLines(words, fontMm, weight, maxWidthMm);
        if (fitted.length <= 1 || fitted.length > maxLines) {
            // One line needs no balancing; more lines than the cell holds is
            // overflow the caller has to see, cut short at the last one it
            // can draw - narrowing the column further would only move WHERE
            // the words break, never THAT they overrun it.
            const lines = [];
            let current = '';
            for (let i = 0; i < words.length; i++) {
                const candidate = current === '' ? words[i] : current + ' ' + words[i];
                if (Na__LeChrome__MeasureTextMm(candidate, fontMm, weight) <= maxWidthMm) { current = candidate; continue; }
                if (current !== '') lines.push(current);
                current = words[i];
                if (lines.length === maxLines - 1) { current = words.slice(i).join(' '); break; }
            }
            if (current !== '' && lines.length < maxLines) lines.push(Na__LeChrome__FitText(current, fontMm, weight, maxWidthMm));
            return lines;
        }

        // THE NARROWEST BALANCED WIDTH | Binary search between the widest
        // single word - nothing narrower could hold every word at all - and
        // the full column, for the smallest width that still sets the text
        // in fitted.length lines.
        const targetLines = fitted.length;
        let widestWord = 0;
        words.forEach((word) => { widestWord = Math.max(widestWord, Na__LeChrome__MeasureTextMm(word, fontMm, weight)); });
        let lo = widestWord, hi = maxWidthMm;
        for (let i = 0; i < 20 && hi - lo > 0.01; i++) {
            const mid = (lo + hi) / 2;
            if (Na__LeTitleQr__GreedyLines(words, fontMm, weight, mid).length <= targetLines) hi = mid; else lo = mid;
        }
        return Na__LeTitleQr__GreedyLines(words, fontMm, weight, hi);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Note's Body Lines, Wrapped Once per Change
    // ------------------------------------------------------------
    // The whole body's measured width is part of the key: the measurer answers
    // an estimate until the Open Sans cuts land and the true width after, and a
    // wrap made from the estimate must not outlive it.
    // ------------------------------------------------------------
    function Na__LeTitleQr__BodyLines(body, fontMm, maxWidthMm, maxLines) {
        const probe = Na__LeChrome__MeasureTextMm(body, fontMm, Na__LeTitleQr__BODY_WEIGHT);
        const key   = [ body, fontMm, maxWidthMm.toFixed(3), maxLines, probe.toFixed(3) ].join('|');
        if (key !== Na__LeTitleQr__WrapKey) {
            Na__LeTitleQr__WrapKey   = key;
            Na__LeTitleQr__WrapLines = Na__LeTitleQr__Wrap(body, fontMm, Na__LeTitleQr__BODY_WEIGHT, maxWidthMm, maxLines);
        }
        return Na__LeTitleQr__WrapLines;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Letter Spacing That Justifies Each Line, All of Them or None
    // ------------------------------------------------------------
    // Every line but the last is stretched to the column by letter spacing, so
    // the note reads as a block with a flush right edge beside a square code.
    // A line that would need more than maxTrackingMm after every character
    // cannot be stretched gracefully - and then NO line is, because one flush
    // line over one ragged one reads as a fault where a wholly ragged block
    // reads as a choice.
    // ------------------------------------------------------------
    function Na__LeTitleQr__Justify(lines, fontMm, colW, justify, maxTrackingMm) {
        const none = lines.map(() => 0);
        if (!justify || lines.length < 2) return none;

        const tracking = [];
        for (let i = 0; i < lines.length; i++) {
            if (i === lines.length - 1) { tracking.push(0); break; }             // <-- The last line keeps its natural length, as justified type does
            const each = lines[i].length > 1 ? (colW - Na__LeChrome__MeasureTextMm(lines[i], fontMm, Na__LeTitleQr__BODY_WEIGHT)) / lines[i].length : 0;
            if (each > maxTrackingMm) return none;
            tracking.push(Math.max(0, each));
        }
        return tracking;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Largest Font, Up to the One Asked For, That Fits a Run to a Length
    // ------------------------------------------------------------
    // A run's glyphs scale with the font and its tracking does not, so the size
    // that just fits solves in one step - the frame captions' own arithmetic
    // (Na__LeChrome__FitCaptionFont). Floored to the hundredth, never rounded up.
    // ------------------------------------------------------------
    function Na__LeTitleQr__FitFont(text, fontMm, weight, trackingMm, roomMm) {
        const widthMm = Na__LeChrome__MeasureTextMm(text, fontMm, weight, trackingMm);
        if (!(roomMm > 0) || widthMm <= roomMm) return fontMm;
        const track  = (trackingMm > 0 ? trackingMm : 0) * String(text).length;
        const glyphs = widthMm - track;
        if (!(glyphs > 0) || roomMm <= track) return fontMm;
        return Math.floor(fontMm * ((roomMm - track) / glyphs) * 100) / 100;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Solve the Cell, the Square Inside It and the Room Left for Words
    // ------------------------------------------------------------
    // band is the title block strip; setup is Na__LeCfg__GetTitleBlockSetup();
    // otherEndMm is what the strip's other end cell - the logo - takes; style
    // is Na__LeCfg__GetStyleSetup(), for the labels' uppercasing and tracking.
    // Returns null when there is no code to draw, else
    //   Cell    { X, Y, WidthMm, HeightMm }
    //   Qr      { X, Y, SizeMm, MarginMm }   the symbol edge to edge, and the clear paper round it
    //   Compact whether the note has given way to a turned caption
    //   Text    { X, WidthMm }               the note's column (whole cell only)
    //   Caption { Text, FontMm, TrackingMm, X, Y, BandMm }   the turned caption as it will be set: its
    //                                        baseline's x, its middle's y and the width it takes off
    //                                        the strip. null in a whole cell, and in a compact one
    //                                        whose caption would not fit at a size anyone could read
    //   Symbol  the encoded symbol
    //
    // THE SQUARE. A symbol of N modules is owed q modules of clear margin on
    // every side, so N + 2q modules have to fit the strip's height H:
    //     module = H / (N + 2q),   square = N x module,   margin = q x module
    // The margin is the same to the right, where the strip's own rule and the
    // sheet border stand, and to the left, where the words end.
    // ------------------------------------------------------------
    function Na__LeTitleQr__Solve(band, setup, otherEndMm, style) {
        if (!setup || setup.qrCellEnabled === false || !band || !(band.HeightMm > 0)) return null;
        const symbol = Na__ProjectQr__GetSymbol();
        if (!symbol) return null;                                                // <-- A strip without the cell beats a note pointing at a code that is not there

        const quiet    = Na__ProjectQr__GetSetup().symbol.quietZoneModules;
        const moduleMm = band.HeightMm / (symbol.Size + (quiet * 2));
        const sizeMm   = symbol.Size * moduleMm;
        const marginMm = quiet * moduleMm;
        const qrX      = band.X + band.WidthMm - marginMm - sizeMm;

        Na__ProjectQr__CheckPrint(symbol, sizeMm, marginMm, Na__LeTitleQr__WHERE);

        // THE WHOLE CELL OR THE COMPACT ONE | Decided by the paper alone
        // The cell is never narrower than the square and its margins, however
        // it is configured: the code is what the cell is for.
        const leastW   = sizeMm + (marginMm * 2);
        const wholeW   = Math.max(leastW, Math.min(setup.qrCellWidthMm, band.WidthMm * Na__LeTitleQr__MAX_BAND_SHARE));
        const leftOver = band.WidthMm - (otherEndMm > 0 ? otherEndMm : 0) - wholeW;
        const compact  = leftOver < setup.qrCellNoteMinFieldRoomMm;

        // THE TURNED CAPTION | Set no longer than the code it stands beside
        // Its capitals stand to the LEFT of its baseline, which sits on the quiet
        // zone's edge; nothing of it enters the zone, because capitals have no
        // descenders to hang the other way. A caption that will not fit at its
        // size is set smaller rather than cut - half an instruction is no
        // instruction - and one that would have to go under CompactMinFontMm is
        // left out altogether, with the band it would have stood in: a code
        // with no caption is still a code, and print too small to read is not
        // a caption.
        let caption = null;
        if (compact) {
            const look   = style || {};
            const track  = look.titleLabelTrackingMm > 0 ? look.titleLabelTrackingMm : 0;
            const words  = look.titleLabelUppercase === false ? Na__ProjectQr__GetNote().compact : Na__ProjectQr__GetNote().compact.toUpperCase();
            const fontMm = Na__LeTitleQr__FitFont(words, setup.qrCellCompactFontMm, Na__LeTitleQr__HEADING_WEIGHT, track, sizeMm);
            if (fontMm >= setup.qrCellCompactMinFontMm) {
                caption = { Text : words, FontMm : fontMm, TrackingMm : track, X : qrX - marginMm, Y : band.Y + (band.HeightMm / 2),
                            BandMm : Na__LeTitleQr__CapOf(fontMm) + setup.qrCellCompactPaddingMm };
            }
        }

        const cellW = compact ? leastW + (caption ? caption.BandMm : 0) : wholeW;
        const cellX = band.X + band.WidthMm - cellW;
        const textX = cellX + setup.qrCellPaddingHMm;

        return {
            Cell    : { X : cellX, Y : band.Y, WidthMm : cellW, HeightMm : band.HeightMm },
            Qr      : { X : qrX, Y : band.Y + marginMm, SizeMm : sizeMm, MarginMm : marginMm },
            Compact : compact,
            // The note stops TextGapMm short of the code's quiet zone. The zone
            // alone is 0.6 mm at the shipped size, and a line of type ending that
            // close to the symbol reads as touching it.
            Text    : { X : textX, WidthMm : compact ? 0 : Math.max(0, qrX - marginMm - setup.qrCellTextGapMm - textX) },
            Caption : caption,
            Symbol  : symbol
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Note: Heading and Body as One Block, Centred in the Strip's Height
    // ------------------------------------------------------------
    function Na__LeTitleQr__BuildNote(list, solved, setup, style) {
        const cell     = solved.Cell;
        const note     = Na__ProjectQr__GetNote();
        const colW     = solved.Text.WidthMm;
        const headMm   = setup.qrCellHeadingFontMm;
        const bodyMm   = setup.qrCellBodyFontMm;
        const headLine = headMm * setup.qrCellLineSpacing;
        const bodyLine = bodyMm * setup.qrCellLineSpacing;
        const roomH    = Math.max(0, cell.HeightMm - (setup.qrCellPaddingVMm * 2));
        if (!(colW > 0) || roomH < Na__LeTitleQr__CapOf(headMm)) return;

        // The body starts one heading line and a gap below the heading's
        // capitals, and its last line needs its own capitals' height, not a
        // whole line box: n lines fit while
        //     headLine + gap + (n - 1) x bodyLine + cap(body) <= room
        const underHead = roomH - headLine - setup.qrCellHeadingGapMm - Na__LeTitleQr__CapOf(bodyMm);
        const fitLines  = underHead >= 0 ? Math.floor(underHead / bodyLine) + 1 : 0;
        const lines     = Na__LeTitleQr__BodyLines(note.body, bodyMm, colW, Math.max(0, Math.min(setup.qrCellBodyMaxLines, fitLines)));

        // Justified to the BLOCK'S OWN widest line, not the full column: the
        // balanced wrap above already leaves the lines close in length, so
        // this only closes what small gap remains between them - it does not
        // drag a short line all the way out to the code's margin, which is
        // what turned one ordinary-length line into the flush one and left
        // the other looking like it had come up short beside it.
        const blockWidthMm = lines.reduce((widest, line) => Math.max(widest, Na__LeChrome__MeasureTextMm(line, bodyMm, Na__LeTitleQr__BODY_WEIGHT)), 0);
        const tracking  = Na__LeTitleQr__Justify(lines, bodyMm, blockWidthMm, setup.qrCellBodyJustify, setup.qrCellJustifyMaxTrackingMm);

        // The block's height is type, not line boxes: from the top of the
        // heading's capitals to the last body baseline. Centring that is what
        // makes it sit level with the code beside it.
        const blockH = lines.length
            ? headLine + setup.qrCellHeadingGapMm + ((lines.length - 1) * bodyLine) + Na__LeTitleQr__CapOf(bodyMm)
            : Na__LeTitleQr__CapOf(headMm);
        let   topY   = cell.Y + ((cell.HeightMm - blockH) / 2);

        Na__LeChrome__PushText(list, {
            X : solved.Text.X, BaselineY : Na__LeChrome__BaselineFromTop(topY, headMm),
            Text : Na__LeChrome__FitText(style.titleLabelUppercase ? note.heading.toUpperCase() : note.heading,
                                         headMm, Na__LeTitleQr__HEADING_WEIGHT, colW, style.titleLabelTrackingMm),
            FontMm : headMm, Weight : Na__LeTitleQr__HEADING_WEIGHT, Colour : style.inkColour,
            Align : 'left', TrackingMm : style.titleLabelTrackingMm
        });
        topY += headLine + setup.qrCellHeadingGapMm;

        lines.forEach((line, index) => {
            Na__LeChrome__PushText(list, {
                X : solved.Text.X, BaselineY : Na__LeChrome__BaselineFromTop(topY, bodyMm),
                Text : line, FontMm : bodyMm, Weight : Na__LeTitleQr__BODY_WEIGHT, Colour : style.mutedTextColour,
                Align : 'left', TrackingMm : tracking[index]
            });
            topY += bodyLine;
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Compact Cell's Caption, Turned Up the Code's Left Side
    // ------------------------------------------------------------
    // Centred on the strip's height, at the size and spacing Solve fitted it
    // to the code at. Solve answers no caption at all when it would not fit
    // at a size anyone could read.
    // ------------------------------------------------------------
    function Na__LeTitleQr__BuildCaption(list, solved, style) {
        const caption = solved.Caption;
        if (!caption) return;
        Na__LeChrome__PushText(list, {
            X : caption.X, BaselineY : caption.Y, Text : caption.Text,
            FontMm : caption.FontMm, Weight : Na__LeTitleQr__HEADING_WEIGHT, Colour : style.inkColour,
            Align : 'center', RotateDeg : Na__LeTitleQr__CAPTION_TURN, TrackingMm : caption.TrackingMm
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Cell's Primitives
    // ------------------------------------------------------------
    // solved is what Solve returned. The rule on the cell's left is the logo
    // cell's rule, in ink, so the two end cells read as a pair about the fields.
    // ------------------------------------------------------------
    function Na__LeTitleQr__Build(list, solved, setup, style) {
        if (!solved) return;
        const cell = solved.Cell;
        Na__LeChrome__PushLine(list, cell.X, cell.Y, cell.X, cell.Y + cell.HeightMm, style.inkColour, style.frameStrokeMm);

        if (solved.Compact) Na__LeTitleQr__BuildCaption(list, solved, style);
        else                Na__LeTitleQr__BuildNote(list, solved, setup, style);

        const colours = Na__ProjectQr__GetSetup().symbol;
        Na__LeChrome__PushQr(list, solved.Qr.X, solved.Qr.Y, solved.Qr.SizeMm, solved.Symbol, colours.darkColour, colours.lightColour);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Title Block QR Cell API
    // ------------------------------------------------------------
    export {
        Na__LeTitleQr__Solve,
        Na__LeTitleQr__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
