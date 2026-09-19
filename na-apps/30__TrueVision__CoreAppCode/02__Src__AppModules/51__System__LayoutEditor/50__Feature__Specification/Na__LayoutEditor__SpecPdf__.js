// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION PDF DOWNLOAD
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecPdf__.js
// NAMESPACE  : Na__LeSpecPdf
// MODULE     : Layout Editor - Specification PDF Download
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Download the project specification as a real PDF, named the way a sheet is
// CREATED    : 17-Sep-2026
//
// DESCRIPTION:
// - Sets the specification as A4 portrait pages of REAL TEXT and downloads it.
//   The title block on page one, then each group's heading and its notes, each
//   note as its code, its title and its body wrapped to the column.
// - Named through Na__LayoutEditor__PdfFilename__, the same module that names a
//   downloaded sheet, from the specification's own document number and revision:
//       PS01_SPEC__ProjectSpecification__A4__RevB__17-Sep-2026__.pdf
//
// INTEGRATION:
// - The Download button on the Project Specification bar
//   (Na__LayoutEditor__SpecEditor__Actions__) calls Na__LeSpecPdf__Download.
//
// -----------------------------------------------------------------------------
//
// WHY THIS SETS TYPE RATHER THAN PHOTOGRAPHING THE READING VIEW:
// The obvious way to turn the reading view into a PDF is to rasterise its pages,
// which is what jsPDF's html() does - and it needs html2canvas, which is not
// vendored and cannot be fetched under the app's CSP. It would also be the wrong
// answer: a specification is text a reader searches, copies and hands to a
// contractor, and a picture of text is none of those. So the pages are set from
// the same primitives the sheets are drawn with, through the same embedded Open
// Sans, and the words in the file are words.
//
// The cost is that this layout and the reading view's CSS are two descriptions of
// one document, and they can drift. They are kept close by sharing what can be
// shared - the note order, the codes, the wrapping - and the page furniture is
// deliberately plain, so there is little left to disagree about.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 17-Sep-2026)
// - Back-port     : offer to ValeVision3D with the revision fields.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.0.0
// - Initial implementation: Download on the Project Specification bar.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Naming, Fonts and the Chrome Painter
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetStyleSetup, Na__LeCfg__GetPdfSetup, Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeFileName__Build } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFilename__.js';
    import { Na__LePdfFonts__EnsureLoaded, Na__LePdfFonts__Install } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFonts__.js';
    import { Na__LePdf__EnsureJsPdf } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';   // <-- Loads the vendored jsPDF once; the sheets' loader, not a second copy
    import {
        Na__LeChrome__PushText,
        Na__LeChrome__PushLine,
        Na__LeChrome__DrawToPdf
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Specification and the Project Code
    // ------------------------------------------------------------
    import {
        Na__LeSpec__GetGroups,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetRevision,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__IsLoaded
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeMargin__Wrap } from './Na__LayoutEditor__SpecMargin__.js';       // <-- The sheet margin's wrapper: one string per printed line
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Page, in Paper Millimetres
    // ------------------------------------------------------------
    // A4 portrait with the margins a specification is read at. The code column is
    // the gutter the note codes sit in, so every body starts on one left edge and
    // the codes line up down the page the way they do on screen.
    // ------------------------------------------------------------
    const Na__LeSpecPdf__PAGE        = { WidthMm : 210, HeightMm : 297 };
    const Na__LeSpecPdf__MARGIN      = { Top : 22, Right : 18, Bottom : 20, Left : 18 };
    const Na__LeSpecPdf__CODE_COL    = 16;      // <-- Width of the code gutter
    const Na__LeSpecPdf__CODE_GAP    = 4;       // <-- Between the gutter and the text column

    const Na__LeSpecPdf__TITLE_MM    = 7.6;
    const Na__LeSpecPdf__SUBTITLE_MM = 4.2;
    const Na__LeSpecPdf__META_LBL_MM = 2.1;
    const Na__LeSpecPdf__META_VAL_MM = 2.9;
    const Na__LeSpecPdf__GROUP_MM    = 3.6;
    const Na__LeSpecPdf__NOTE_MM     = 3.0;
    const Na__LeSpecPdf__BODY_MM     = 2.8;
    const Na__LeSpecPdf__FURNITURE_MM = 2.2;

    const Na__LeSpecPdf__LINE        = 1.42;    // <-- Line spacing, a multiple of the size
    const Na__LeSpecPdf__NOTE_GAP    = 3.4;
    const Na__LeSpecPdf__GROUP_GAP   = 6.5;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Laying the Pages Out
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Date a Document Is Issued On
    // ------------------------------------------------------------
    function Na__LeSpecPdf__DateText(date) {
        return String(date.getDate()).padStart(2, '0') + ' ' +
            [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][date.getMonth()] + ' ' +
            date.getFullYear();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Document Says About Itself
    // ------------------------------------------------------------
    function Na__LeSpecPdf__Meta() {
        const setup   = Na__LeCfg__GetSpecificationSetup();
        const code    = Na__DrawData__GetProjectCode() || '';
        let   name    = '';
        try {
            const context = window.TrueVision__Pwa__ProjectContext;
            name = (context && typeof context.get === 'function' && context.get().displayName) || '';
        } catch (e) { name = ''; }
        return {
            title    : Na__LeCfg__GetLabel('SpecDocTitle', 'Project Specification'),
            project  : (name && name !== code) ? name : '',
            code     : code,
            number   : Na__LeSpec__GetDocumentNumber(code),
            revision : Na__LeSpec__GetRevision(),
            date     : Na__LeSpecPdf__DateText(new Date()),
            company  : Na__LeCfg__GetPdfSetup().author || '',
            paper    : setup.downloadPaperSize || 'A4',
            docName  : setup.documentName || 'Project Specification'
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Plan Every Page: One Flat List of Blocks per Page
    // ------------------------------------------------------------
    // A block is measured before it is placed, so nothing is written past the
    // foot of a page and a note is never split from its own code. A note longer
    // than a whole column DOES split - it has to - but it splits between its body
    // lines, never between its code and its first line, so a reader always sees
    // what they are reading.
    //
    // A group heading that would be the last thing on a page moves to the next
    // one with its first note, so no page ends on a heading alone.
    // ------------------------------------------------------------
    function Na__LeSpecPdf__Plan(meta, style) {
        const left    = Na__LeSpecPdf__MARGIN.Left;
        const right   = Na__LeSpecPdf__PAGE.WidthMm - Na__LeSpecPdf__MARGIN.Right;
        const textX   = left + Na__LeSpecPdf__CODE_COL + Na__LeSpecPdf__CODE_GAP;
        const textW   = right - textX;
        const foot    = Na__LeSpecPdf__PAGE.HeightMm - Na__LeSpecPdf__MARGIN.Bottom;

        const pages   = [];
        let   page    = { blocks : [] };
        let   y       = 0;
        let   firstPage = true;

        const open = () => { pages.push(page); };
        const newPage = () => {
            open();
            page = { blocks : [] };
            y = Na__LeSpecPdf__MARGIN.Top;
            firstPage = false;
        };

        y = Na__LeSpecPdf__MARGIN.Top;

        // THE TITLE BLOCK | Page one only
        page.blocks.push({ kind : 'title', x : left, y : y, width : right - left, meta : meta });
        y += Na__LeSpecPdf__TITLE_MM * 1.25;
        if (meta.project) y += Na__LeSpecPdf__SUBTITLE_MM * 1.5;
        y += 5;
        page.blocks.push({ kind : 'rule', x : left, y : y, x2 : right });
        y += 5.5;
        page.blocks.push({ kind : 'meta', x : left, y : y, width : right - left, meta : meta });
        y += (Na__LeSpecPdf__META_LBL_MM * 1.5) + (Na__LeSpecPdf__META_VAL_MM * 1.4) + 3;
        page.blocks.push({ kind : 'rule', x : left, y : y, x2 : right });
        y += 8;

        Na__LeSpec__GetGroups().forEach((group) => {
            const notes = (group.Group__Notes || []);
            if (!notes.length) return;

            // THE HEADING, and the first note measured with it, so neither is orphaned.
            const headingH = (Na__LeSpecPdf__GROUP_MM * 1.4) + 3.2;
            const first    = Na__LeSpecPdf__MeasureNote(notes[0], textW, style);
            if (y + headingH + Math.min(first.height, 18) > foot) newPage();

            page.blocks.push({ kind : 'group', x : left, y : y, x2 : right, group : group });
            y += headingH;

            notes.forEach((note) => {
                const measured = Na__LeSpecPdf__MeasureNote(note, textW, style);
                let   lines    = measured.lines;
                let   head     = measured.headHeight;

                // The head (code and title) and at least one body line must sit
                // together, or the note is started on the next page instead.
                const firstChunk = head + (lines.length ? Na__LeSpecPdf__BODY_MM * Na__LeSpecPdf__LINE : 0);
                if (y + firstChunk > foot) newPage();

                page.blocks.push({ kind : 'note-head', x : left, y : y, textX : textX, note : note });
                y += head;

                while (lines.length) {
                    const room  = Math.max(0, foot - y);
                    const fit   = Math.floor(room / (Na__LeSpecPdf__BODY_MM * Na__LeSpecPdf__LINE));
                    if (fit <= 0) { newPage(); continue; }
                    const chunk = lines.slice(0, fit);
                    lines = lines.slice(fit);
                    page.blocks.push({ kind : 'body', x : textX, y : y, lines : chunk });
                    y += chunk.length * (Na__LeSpecPdf__BODY_MM * Na__LeSpecPdf__LINE);
                    if (lines.length) newPage();
                }
                y += Na__LeSpecPdf__NOTE_GAP;
            });
            y += Na__LeSpecPdf__GROUP_GAP - Na__LeSpecPdf__NOTE_GAP;
        });

        open();
        return pages;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Tall One Note Is, and Its Wrapped Body Lines
    // ------------------------------------------------------------
    function Na__LeSpecPdf__MeasureNote(note, textWidthMm, style) {
        const titleLines = Na__LeMargin__Wrap(note.Note__Title || '', Na__LeSpecPdf__NOTE_MM, 'bold', textWidthMm);
        const bodyLines  = Na__LeMargin__Wrap(note.Note__Body  || '', Na__LeSpecPdf__BODY_MM, 'normal', textWidthMm);
        const headHeight = (titleLines.length || 1) * (Na__LeSpecPdf__NOTE_MM * Na__LeSpecPdf__LINE) + 0.8;
        return {
            titleLines : titleLines,
            lines      : bodyLines,
            headHeight : headHeight,
            height     : headHeight + (bodyLines.length * (Na__LeSpecPdf__BODY_MM * Na__LeSpecPdf__LINE))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Turn One Planned Page Into Chrome Primitives
    // ------------------------------------------------------------
    function Na__LeSpecPdf__Paint(page, pageNumber, pageCount, meta, style) {
        const list  = [];
        const left  = Na__LeSpecPdf__MARGIN.Left;
        const right = Na__LeSpecPdf__PAGE.WidthMm - Na__LeSpecPdf__MARGIN.Right;
        const text  = (x, baselineY, value, fontMm, weight, colour, align, tracking) => Na__LeChrome__PushText(list, {
            X : x, BaselineY : baselineY, Text : value, FontMm : fontMm, Weight : weight,
            Colour : colour, Align : align || 'left', TrackingMm : tracking || 0
        });

        page.blocks.forEach((block) => {
            if (block.kind === 'rule') {
                Na__LeChrome__PushLine(list, block.x, block.y, block.x2, block.y, style.frameLineColour, 0.3);
                return;
            }
            if (block.kind === 'title') {
                text(block.x, block.y + Na__LeSpecPdf__TITLE_MM, block.meta.title, Na__LeSpecPdf__TITLE_MM, 'bold', style.inkColour);
                if (block.meta.project) {
                    text(block.x, block.y + (Na__LeSpecPdf__TITLE_MM * 1.25) + Na__LeSpecPdf__SUBTITLE_MM,
                         block.meta.project, Na__LeSpecPdf__SUBTITLE_MM, 'normal', style.mutedTextColour);
                }
                return;
            }
            if (block.kind === 'meta') {
                // Project, Revision, Date, Contents - the same four facts the reading
                // page opens with, laid across the width in even columns.
                const cells = [
                    [ Na__LeCfg__GetLabel('SpecDocProject', 'Project'), block.meta.code ],
                    [ Na__LeCfg__GetLabel('SpecDocNumber', 'Document No.'), block.meta.number ],
                    [ Na__LeCfg__GetLabel('SpecDocRevision', 'Revision'), block.meta.revision ],
                    [ Na__LeCfg__GetLabel('SpecDocDate', 'Date'), block.meta.date ]
                ].filter((cell) => cell[1]);
                const step = block.width / Math.max(1, cells.length);
                cells.forEach((cell, index) => {
                    const x = block.x + (step * index);
                    text(x, block.y + Na__LeSpecPdf__META_LBL_MM, String(cell[0]).toUpperCase(),
                         Na__LeSpecPdf__META_LBL_MM, 'normal', style.mutedTextColour, 'left', 0.05);
                    text(x, block.y + (Na__LeSpecPdf__META_LBL_MM * 1.5) + Na__LeSpecPdf__META_VAL_MM,
                         String(cell[1]), Na__LeSpecPdf__META_VAL_MM, 'normal', style.inkColour);
                });
                return;
            }
            if (block.kind === 'group') {
                const baseline = block.y + Na__LeSpecPdf__GROUP_MM;
                text(block.x, baseline, block.group.Group__Prefix, Na__LeSpecPdf__GROUP_MM, 'bold', style.inkColour, 'left', 0.12);
                text(block.x + Na__LeSpecPdf__CODE_COL + Na__LeSpecPdf__CODE_GAP, baseline,
                     String(block.group.Group__Title || '').trim().toUpperCase(), Na__LeSpecPdf__GROUP_MM, 'bold', style.inkColour, 'left', 0.12);
                Na__LeChrome__PushLine(list, block.x, block.y + Na__LeSpecPdf__GROUP_MM + 1.6, right, block.y + Na__LeSpecPdf__GROUP_MM + 1.6, style.inkColour, 0.35);
                return;
            }
            if (block.kind === 'note-head') {
                const measured = Na__LeSpecPdf__MeasureNote(block.note, right - block.textX, style);
                const baseline = block.y + Na__LeSpecPdf__NOTE_MM;
                text(block.x, baseline, block.note.Note__Code || '', Na__LeSpecPdf__NOTE_MM, 'normal', style.mutedTextColour);
                (measured.titleLines.length ? measured.titleLines : [ '' ]).forEach((line, index) => {
                    text(block.textX, baseline + (index * Na__LeSpecPdf__NOTE_MM * Na__LeSpecPdf__LINE), line, Na__LeSpecPdf__NOTE_MM, 'bold', style.inkColour);
                });
                return;
            }
            if (block.kind === 'body') {
                block.lines.forEach((line, index) => {
                    text(block.x, block.y + Na__LeSpecPdf__BODY_MM + (index * Na__LeSpecPdf__BODY_MM * Na__LeSpecPdf__LINE),
                         line, Na__LeSpecPdf__BODY_MM, 'normal', style.inkColour);
                });
            }
        });

        // PAGE FURNITURE | A running head that names the issue, and a foot that counts
        const headY = Na__LeSpecPdf__MARGIN.Top - 8;
        text(left, headY, [ meta.title, meta.code ].filter(Boolean).join(' · '), Na__LeSpecPdf__FURNITURE_MM, 'normal', style.mutedTextColour, 'left', 0.08);   // <-- Joined, not concatenated: a project with no code leaves no dangling separator
        text(right, headY, [ meta.number, meta.revision ? 'Rev ' + meta.revision : '' ].filter(Boolean).join('  ·  '), Na__LeSpecPdf__FURNITURE_MM, 'normal', style.mutedTextColour, 'right');
        Na__LeChrome__PushLine(list, left, headY + 2.4, right, headY + 2.4, style.frameLineColour, 0.25);

        const footY = Na__LeSpecPdf__PAGE.HeightMm - Na__LeSpecPdf__MARGIN.Bottom + 8;
        if (meta.company) text(left, footY, meta.company, Na__LeSpecPdf__FURNITURE_MM, 'normal', style.mutedTextColour);
        text(right, footY, 'Page ' + pageNumber + ' of ' + pageCount, Na__LeSpecPdf__FURNITURE_MM, 'normal', style.mutedTextColour, 'right');

        return list;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The File Name This Download Would Use
    // ------------------------------------------------------------
    // Public so the Download button can say what it is about to write, and so the
    // name can be checked without building the document.
    // ------------------------------------------------------------
    function Na__LeSpecPdf__Filename() {
        const meta = Na__LeSpecPdf__Meta();
        return Na__LeFileName__Build({
            code        : meta.number,
            name        : meta.docName,
            paper       : meta.paper,
            revision    : meta.revision,
            projectCode : meta.code
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Specification as a jsPDF Document
    // ------------------------------------------------------------
    async function Na__LeSpecPdf__BuildDocument() {
        const JsPdf = await Na__LePdf__EnsureJsPdf();                               // <-- jsPDF injected if it is not there yet, and Open Sans in memory before a line is measured
        await Na__LePdfFonts__EnsureLoaded();

        const style = Na__LeCfg__GetStyleSetup();
        const meta  = Na__LeSpecPdf__Meta();
        const setup = Na__LeCfg__GetPdfSetup();
        const pages = Na__LeSpecPdf__Plan(meta, style);

        const doc = new JsPdf({ orientation : 'portrait', unit : 'mm',
                                format : [ Na__LeSpecPdf__PAGE.WidthMm, Na__LeSpecPdf__PAGE.HeightMm ],
                                compress : true, putOnlyUsedFonts : true });
        Na__LePdfFonts__Install(doc);
        doc.setProperties({
            title   : [ meta.title, meta.code ].filter(Boolean).join(' - '),   // <-- Joined, not concatenated: a project with no code leaves no dangling separator
            subject : meta.number + ' Rev ' + meta.revision + ', ' + Na__LeSpec__ListNotes().length + ' notes',
            author  : setup.author,
            creator : setup.creator
        });

        pages.forEach((page, index) => {
            if (index > 0) doc.addPage([ Na__LeSpecPdf__PAGE.WidthMm, Na__LeSpecPdf__PAGE.HeightMm ], 'portrait');
            Na__LeChrome__DrawToPdf(doc, Na__LeSpecPdf__Paint(page, index + 1, pages.length, meta, style));
        });

        return { doc : doc, filename : Na__LeSpecPdf__Filename(), pages : pages.length };
    }
    // ------------------------------------------------------------


    // FUNCTION | Download the Specification
    // ------------------------------------------------------------
    // showToast is optional and is given the same shape the sheet exporter uses,
    // so the Project Specification tab reports a download the way the Layout
    // Editor's toolbar does.
    // ------------------------------------------------------------
    async function Na__LeSpecPdf__Download(showToast) {
        const say = (message, kind) => { if (typeof showToast === 'function') showToast(message, kind); };
        if (!Na__LeSpec__IsLoaded()) { say(Na__LeCfg__GetLabel('SpecDownloadNotReady', 'The specification has not loaded yet.'), 'warn'); return false; }
        if (!Na__LeSpec__ListNotes().length) { say(Na__LeCfg__GetLabel('SpecDownloadEmpty', 'There are no notes to download yet.'), 'warn'); return false; }
        try {
            const built = await Na__LeSpecPdf__BuildDocument();
            await built.doc.save(built.filename, { returnPromise : true });
            say(built.filename, 'ok');
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] The specification could not be downloaded.', error);
            say(Na__LeCfg__GetLabel('SpecDownloadFailed', 'The specification could not be downloaded.'), 'error');
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification PDF API
    // ------------------------------------------------------------
    export {
        Na__LeSpecPdf__Filename,
        Na__LeSpecPdf__BuildDocument,
        Na__LeSpecPdf__Download
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
