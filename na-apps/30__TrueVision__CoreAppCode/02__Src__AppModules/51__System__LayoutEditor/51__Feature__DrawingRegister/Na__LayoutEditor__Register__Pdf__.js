// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER PDF
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Pdf__.js
// NAMESPACE  : Na__LeRegPdf
// MODULE     : Layout Editor - Drawing Register PDF
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A Noble Architecture register, with optional revision appendices
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The read preview and the download are the same bytes: the preview
//   rasterises this document, it does not re-draw it. What is on screen is
//   what the file contains.
// - Columns are measured from the embedded font rather than split into fixed
//   percentages, so a drawing code or a scale is never broken mid-token and
//   the table's slack is shared out instead of being dumped in one column.
// - Rows are drawn whole. A row that will not fit starts the next page rather
//   than being sliced across the break.
// - Page furniture is the office name, the project code and the page count.
//
// INTEGRATION:
// - The register editor's Read view and Export register PDF both call
//   Na__LeRegPdf__BuildDocument. Rows and the project name are also read
//   by the editable table so Edit and Read share one source.
// - Typography, table rhythm, column order and the palette all come from
//   LayoutEditor__DrawingRegister__Config. Nothing here is hard-coded that
//   the office might want to change.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 19-Sep-2026)
// - Back-port     : offer to ValeVision3D with the register tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.1.0
// - FIXED. Open Sans is now waited for before the document is built. The
//   register asked to install the cuts but never asked for them to be
//   fetched, so Install returned false on every call and the whole document
//   printed in non-embedded Helvetica. Every reader substituted its own face,
//   which is why the Read view and the downloaded file did not look alike.
// - Columns are measured from the real font and the table's spare width is
//   shared in proportion, replacing the fixed 13/43/11/12/11/10 split that
//   wrapped PS01_T02_D01 onto two lines while DOCUMENT NAME sat half empty.
// - Rows are measured and drawn whole, vertically centred, on a configured
//   rhythm. A row no longer splits across a page break.
// - A scale of '1:50 @ ISO A2' prints as '1:50' when the SIZE column already
//   says ISO A2. CollapseScaleSuffix turns that off. The field is unchanged.
// - Revision history flows instead of forcing one page per drawing, and each
//   entry is set against a revision rail rather than a bare run of text.
//
// 19-Sep-2026 - Version 1.0.1
// - Headers, region breakdown, function wrapping and the export block brought
//   in line with the Layout Editor coding conventions. No behaviour change.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Sheets, jsPDF, Fonts and Register Data
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDrawingRegisterSetup, Na__LeCfg__GetPdfSetup, Na__LeCfg__GetTitleBlockSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetSheets,
        Na__LeModel__GetFields,
        Na__LeModel__GetTabLabel,
        Na__LeModel__GetDrawingNumber,
        Na__LeModel__GetPhase,
        Na__LeModel__GetDocumentId
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLayout__PaperSizeMm } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LePdf__EnsureJsPdf } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import { Na__LePdfFonts__EnsureLoaded, Na__LePdfFonts__Install, Na__LePdfFonts__SetFont } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFonts__.js';
    import { Na__LeFileName__Build } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFilename__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LeReg__GetDocument, Na__LeReg__GetRevisions, Na__LeReg__Clone } from './Na__LayoutEditor__Register__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Page Constants
// -----------------------------------------------------------------------------

    // CONSTANTS | A4 Portrait, Type Metrics and the Document's Fixed Rhythm
    // ------------------------------------------------------------
    const Na__LeRegPdf__PAGE_W_MM     = 210;                                     // <-- A4 portrait: a register is read, not drawn on
    const Na__LeRegPdf__PAGE_H_MM     = 297;
    const Na__LeRegPdf__PT_TO_MM      = 25.4 / 72;                               // <-- jsPDF measures in mm, sets type in points
    const Na__LeRegPdf__CAP_RATIO     = 0.70;                                    // <-- Open Sans cap height as a share of point size, for optical centring
    const Na__LeRegPdf__HEAD_TRACK_MM = 0.35;                                    // <-- Letter-spacing on the table headings and the section heading
    const Na__LeRegPdf__FOOTER_MM     = 14;                                      // <-- Reserved under the content for the rule and the page line
    const Na__LeRegPdf__TITLE_MIN_PT  = 12;                                     // <-- Floor for the shrink-to-fit project name in the title band
    const Na__LeRegPdf__LOGO_MM       = 6.2;                                     // <-- The specification's own logo height (.na-le-spec-sheet__logo)
    const Na__LeRegPdf__HEAD_BAND_MM  = 11;                                      // <-- ...and the band it sits in, before the hairline
    const Na__LeRegPdf__RUNNING_PT    = 6.8;                                     // <-- The running head and the issue, both cuts of the same small caps
    const Na__LeRegPdf__RUNNING_TRACK_MM = 0.28;
    const Na__LeRegPdf__RAIL_MM       = 22;                                      // <-- Revision-history rail carrying the Rev code and its date
    const Na__LeRegPdf__WEIGHT_BODY   = 400;
    const Na__LeRegPdf__WEIGHT_BOLD   = 600;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Office Logo, Fetched Once per Session
    // ------------------------------------------------------------
    let Na__LeRegPdf__LogoPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document Data
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Drop a Paper Suffix the SIZE Column Already Prints
    // ------------------------------------------------------------
    // '1:50 @ ISO A2' against a SIZE of 'ISO A2' is the same fact twice, and it
    // was the single biggest cause of the table wrapping. The sheet's Scale
    // field is never altered; only what this document prints changes.
    // ------------------------------------------------------------
    function Na__LeRegPdf__ScaleText(scale, size, collapse) {
        const text = String(scale === undefined || scale === null ? '' : scale).trim();
        if (!collapse || !text) return text;
        const paper = String(size || '').trim().replace(/^ISO\s+/i, '');
        if (!paper) return text;
        const token   = paper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp('\\s*@\\s*(ISO\\s*)?' + token + '\\s*$', 'i');
        const cut     = text.replace(pattern, '').trim();
        return cut || text;                                                      // <-- A scale that is nothing but its paper size keeps printing
    }
    // ------------------------------------------------------------


    // FUNCTION | One Register Row per Sheet, in Tab Order
    // ------------------------------------------------------------
    // name and revision are handed back exactly as the sheet holds them,
    // because the Edit view puts both straight into editable inputs and writes
    // what it reads back. Nothing here may prettify a value that is about to
    // be saved. label is the separate, read-only face of the same sheet: the
    // tab's own "D01 - Floor Plans", which is what the document prints.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Rows() {
        return Na__LeModel__GetSheets().map((sheet) => {
            const fields = Na__LeModel__GetFields(sheet);
            const paper  = Na__LeLayout__PaperSizeMm(sheet.Sheet__PaperSize, sheet.Sheet__Orientation);
            return {
                id           : sheet.Sheet__Id,
                drawingNo    : Na__LeModel__GetDrawingNumber(sheet),             // <-- The sequence the register writes and the tabs read
                phase        : Na__LeModel__GetPhase(sheet),                     // <-- The stage of the job, editable per row
                documentCode : Na__LeModel__GetDocumentId(sheet),                // <-- The two above behind the project code, composed
                code         : Na__LeModel__GetDocumentId(sheet),                // <-- What a drawing is called when one string has to name it
                name         : sheet.Sheet__Name,
                label        : Na__LeModel__GetTabLabel(sheet) || sheet.Sheet__Name,
                type         : 'Drawing',
                scale        : fields.Scale,
                size         : 'ISO ' + paper.Label,
                revision     : fields.Revision,
                status       : fields.Status,                                    // <-- What the drawing is issued for. The Edit table's Status box reads it; it is not a printed column (see the config's StatusColumnNote)
                notes        : Na__LeReg__Clone(Na__LeReg__GetRevisions(sheet.Sheet__Id))
            };
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Printable Face of a Row, for This Document Only
    // ------------------------------------------------------------
    function Na__LeRegPdf__PrintRows(rows, cfg) {
        return rows.map((row) => Object.assign({}, row, {
            name     : row.label || row.name,                                    // <-- The register says what the tab says, so the two cannot drift
            scale    : Na__LeRegPdf__ScaleText(row.scale, row.size, cfg.collapseScale),
            revision : Na__LeRegPdf__RevisionText(row.revision)
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | 'Rev B', or Nothing at All for an Unrevised Sheet
    // ------------------------------------------------------------
    // A sheet that has never been revised leaves the field empty, and a bare
    // 'Rev ' with nothing after it reads as a fault rather than as a fact. The
    // cell is left empty and picks up the table's absent-value mark instead.
    // ------------------------------------------------------------
    function Na__LeRegPdf__RevisionText(revision) {
        const text = String(revision === undefined || revision === null ? '' : revision).replace(/^Rev\s+/i, '').trim();
        return text ? 'Rev ' + text : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project Name the Register Prints
    // ------------------------------------------------------------
    function Na__LeRegPdf__ProjectName() {
        const context = window.TrueVision__Pwa__ProjectContext;
        const active  = context && typeof context.get === 'function' ? context.get() : null;
        const data    = Na__CfApi__GetLoadedProjectData() || {};
        return (active && active.displayName) || data.Project__Name || Na__DrawData__GetProjectCode() || 'Project';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Office Logo as a PNG Data URL, Fetched Once
    // ------------------------------------------------------------
    // A PNG data URL, not pixels: jsPDF's 'RGBA' path drops the alpha and would
    // print the mark on an opaque block. Fetched straight from the configured
    // asset path, because Na__LeAssets__Load resolves against the project
    // folder and this is an app asset, not a project one. A failure is not an
    // error: the letterhead simply carries no mark.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Logo() {
        if (Na__LeRegPdf__LogoPromise) return Na__LeRegPdf__LogoPromise;
        const path = Na__LeCfg__GetTitleBlockSetup().logoAssetPath;
        if (!path) return Promise.resolve(null);
        Na__LeRegPdf__LogoPromise = fetch(path)
            .then((response) => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.blob();
            })
            .then((blob) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            }))
            .catch((logoError) => {
                console.warn('[TrueVision3D LayoutEditor] The register letterhead could not load the office logo.', logoError);
                return null;
            });
        return Na__LeRegPdf__LogoPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Register's Own Last-Updated Stamp, Long Form
    // ------------------------------------------------------------
    function Na__LeRegPdf__Stamp(register) {
        const raw  = register && register.DrawingRegister__Document__Updated;
        const when = raw ? new Date(raw) : new Date();
        const date = Number.isNaN(when.getTime()) ? new Date() : when;
        return date.toLocaleDateString('en-GB', { day : 'numeric', month : 'long', year : 'numeric' });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Primitives
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The One Place That Selects a Face, a Size and an Ink
    // ------------------------------------------------------------
    function Na__LeRegPdf__Font(ctx, pt, weight, colour) {
        if (!Na__LePdfFonts__SetFont(ctx.doc, weight)) {                         // <-- Only reachable if the TTF fetch failed; the document still prints
            ctx.doc.setFont('helvetica', weight >= Na__LeRegPdf__WEIGHT_BOLD ? 'bold' : 'normal');
        }
        ctx.doc.setFontSize(pt);
        ctx.doc.setTextColor(colour || ctx.cfg.ink);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Width of a String at a Face, Tracking Included
    // ------------------------------------------------------------
    function Na__LeRegPdf__TextWidth(ctx, text, pt, weight, trackMm) {
        const value = String(text === undefined || text === null ? '' : text);
        if (!value) return 0;
        Na__LeRegPdf__Font(ctx, pt, weight);
        const track = trackMm || 0;
        return ctx.doc.getTextWidth(value) + track * Math.max(0, value.length - 1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Baseline Offset That Optically Centres a Line Box
    // ------------------------------------------------------------
    function Na__LeRegPdf__Baseline(pt, lineMm) {
        return (lineMm + pt * Na__LeRegPdf__PT_TO_MM * Na__LeRegPdf__CAP_RATIO) / 2;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Horizontal Rule at a Weight and a Colour
    // ------------------------------------------------------------
    function Na__LeRegPdf__Rule(ctx, y, colour, widthMm, fromX, toX) {
        ctx.doc.setDrawColor(colour);
        ctx.doc.setLineWidth(widthMm);
        ctx.doc.line(fromX === undefined ? ctx.margin : fromX, y, toX === undefined ? ctx.margin + ctx.width : toX, y);
        ctx.doc.setLineWidth(0.2);                                               // <-- Back to a neutral weight so no later stroke inherits this one
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw Wrapped Lines Into a Column Box, Aligned and Centred
    // ------------------------------------------------------------
    function Na__LeRegPdf__Cell(ctx, lines, column, x, top, boxMm, pt, trackMm) {
        if (!lines || !lines.length) return;
        const cfg     = ctx.cfg;
        const blockMm = lines.length * cfg.lineMm;
        const first   = top + Math.max(0, (boxMm - blockMm) / 2) + Na__LeRegPdf__Baseline(pt, cfg.lineMm);
        lines.forEach((line, index) => {
            const y = first + index * cfg.lineMm;
            if (column.align === 'centre')     Na__LeRegPdf__Draw(ctx, line, x + column.width / 2, y, trackMm, 'centre');
            else if (column.align === 'right') Na__LeRegPdf__Draw(ctx, line, x + column.width - cfg.cellPadMm, y, trackMm, 'right');
            else                               Na__LeRegPdf__Draw(ctx, line, x + cfg.cellPadMm, y, trackMm, 'left');
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place Text Ourselves Rather Than Trust jsPDF's align
    // ------------------------------------------------------------
    // jsPDF's align does NOT account for setCharSpace: it measures the string
    // untracked, so right-aligned tracked text overhangs its anchor by the whole
    // of the tracking. Measured on the letterhead before this was written, the
    // running head ended 17.5pt past the right margin - which is exactly the
    // overhang Adam pointed at. Anything tracked is therefore positioned from a
    // width this module measured itself, with the tracking counted in, and drawn
    // left-aligned. Untracked text still goes through the same door so there is
    // one way of placing a line, not two.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Draw(ctx, text, anchor, y, trackMm, align) {
        const value = String(text === undefined || text === null ? '' : text);
        if (!value) return;
        const track = trackMm || 0;
        let   x     = anchor;
        if (align === 'right' || align === 'centre') {
            const width = ctx.doc.getTextWidth(value) + track * Math.max(0, value.length - 1);
            x = align === 'right' ? anchor - width : anchor - width / 2;
        }
        if (track) ctx.doc.setCharSpace(track);
        ctx.doc.text(value, x, y, { baseline : 'alphabetic' });
        if (track) ctx.doc.setCharSpace(0);                                      // <-- Never left set: the next draw would inherit it
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Column Measurement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Natural Width of a Column: Its Heading or Its Widest Cell
    // ------------------------------------------------------------
    function Na__LeRegPdf__Natural(ctx, column, rows) {
        const cfg    = ctx.cfg;
        const gutter = cfg.cellPadMm * 2;
        const head   = Na__LeRegPdf__TextWidth(ctx, column.heading, cfg.tableHeadPt, Na__LeRegPdf__WEIGHT_BOLD, Na__LeRegPdf__HEAD_TRACK_MM);
        let   widest = head;
        rows.forEach((row) => {
            const cell = Na__LeRegPdf__TextWidth(ctx, row[column.key], cfg.pdfFontPt, Na__LeRegPdf__WEIGHT_BODY);
            if (cell > widest) widest = cell;
        });
        return {
            floor   : Math.max(column.minMm, head + gutter),                     // <-- A heading is never allowed to wrap
            natural : Math.min(cfg.columnMaxMm, widest + gutter)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Size Every Column From the Content, Then Fill the Text Width
    // ------------------------------------------------------------
    // Surplus is shared in proportion to natural width, so the table breathes
    // evenly instead of parking all of its slack in DOCUMENT NAME. A shortfall
    // is taken off the columns that have room above their own floor, and the
    // flex column is the one left to wrap.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Columns(ctx, rows) {
        const columns = ctx.cfg.columns.map((column) => {
            const measured = Na__LeRegPdf__Natural(ctx, column, rows);
            return Object.assign({}, column, {
                floor : measured.floor,
                width : Math.max(measured.floor, measured.natural)
            });
        });

        const total = columns.reduce((sum, column) => sum + column.width, 0);
        if (Math.abs(total - ctx.width) < 0.01) return columns;

        if (total < ctx.width) {                                                 // <-- Surplus: grow every column by the same ratio
            const ratio = ctx.width / total;
            columns.forEach((column) => { column.width *= ratio; });
            return columns;
        }

        const slack = columns.reduce((sum, column) => sum + Math.max(0, column.width - column.floor), 0);
        if (slack > 0) {                                                         // <-- Shortfall: take it off the roomiest columns first
            const take = Math.min(total - ctx.width, slack);
            columns.forEach((column) => {
                column.width -= Math.max(0, column.width - column.floor) / slack * take;
            });
        }
        const settled = columns.reduce((sum, column) => sum + column.width, 0);
        if (settled > ctx.width) {                                               // <-- Still over: every column is at its floor, so scale the lot
            const ratio = ctx.width / settled;
            columns.forEach((column) => { column.width *= ratio; });
        }
        return columns;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap One Row Into Its Columns and Report Its Height
    // ------------------------------------------------------------
    // A cell with nothing in it prints the absent-value mark in the muted ink,
    // so a never-numbered sheet or an unrevised drawing reads as a stated
    // blank rather than as a hole the document forgot to fill.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Measure(ctx, row, columns) {
        const cfg   = ctx.cfg;
        Na__LeRegPdf__Font(ctx, cfg.pdfFontPt, Na__LeRegPdf__WEIGHT_BODY);
        const empty = [];
        const lines = columns.map((column) => {
            const text = String(row[column.key] === undefined || row[column.key] === null ? '' : row[column.key]).trim();
            empty.push(!text);
            if (!text) return [cfg.emptyCell];
            return ctx.doc.splitTextToSize(text, Math.max(4, column.width - cfg.cellPadMm * 2));
        });
        const deepest = lines.reduce((most, cell) => Math.max(most, cell.length), 1);
        return { lines : lines, empty : empty, height : cfg.rowPadMm * 2 + deepest * cfg.lineMm };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Page Furniture
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Letterhead the Project Specification Wears
    // ------------------------------------------------------------
    // Logo left, running head and issue right, a hairline under. The same band
    // the specification paints at .na-le-spec-sheet__head, drawn in the same
    // proportions, because the two are tabs of one pack: Adam, 19-Sep-2026,
    // "the drawing register just looks like an absolutely completely different
    // document. The whole thing's meant to look like one cohesive pack."
    // Repeated on every page, so a loose sheet still says where it came from.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Letterhead(ctx) {
        const cfg   = ctx.cfg;
        const right = ctx.margin + ctx.width;
        const baseY = ctx.margin + Na__LeRegPdf__LOGO_MM;

        if (ctx.logo) {
            try {
                ctx.doc.addImage(ctx.logo, 'PNG', ctx.margin, ctx.margin, Na__LeRegPdf__LOGO_MM * cfg.logoAspect, Na__LeRegPdf__LOGO_MM);
            } catch (logoError) {
                ctx.logo = null;                                                 // <-- One failure is enough; the band still reads without it
            }
        }

        Na__LeRegPdf__Font(ctx, Na__LeRegPdf__RUNNING_PT, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
        Na__LeRegPdf__Draw(ctx, ctx.running, right, baseY - 2.6, Na__LeRegPdf__RUNNING_TRACK_MM, 'right');
        Na__LeRegPdf__Draw(ctx, ctx.issue,   right, baseY + 0.9, Na__LeRegPdf__RUNNING_TRACK_MM, 'right');

        Na__LeRegPdf__Rule(ctx, ctx.margin + Na__LeRegPdf__HEAD_BAND_MM, cfg.rule, 0.3);
        ctx.y = ctx.margin + Na__LeRegPdf__HEAD_BAND_MM + 8;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Title Block That Opens Page One
    // ------------------------------------------------------------
    // The specification's opening: the document's own name, the project under
    // it, then a ruled strip of the facts that identify this issue.
    // ------------------------------------------------------------
    function Na__LeRegPdf__Title(ctx, title, facts) {
        const cfg = ctx.cfg;
        Na__LeRegPdf__Font(ctx, cfg.titlePt, Na__LeRegPdf__WEIGHT_BOLD, cfg.ink);
        ctx.doc.text(title, ctx.margin, ctx.y + 6.5);
        ctx.y += 11;

        let pt = cfg.headingPt;                                                  // <-- A long project name is set smaller rather than wrapped or cut
        while (pt > Na__LeRegPdf__TITLE_MIN_PT && Na__LeRegPdf__TextWidth(ctx, ctx.project, pt, Na__LeRegPdf__WEIGHT_BODY) > ctx.width) pt -= 0.5;
        Na__LeRegPdf__Font(ctx, pt, Na__LeRegPdf__WEIGHT_BODY, cfg.ink);
        ctx.doc.text(ctx.doc.splitTextToSize(ctx.project, ctx.width)[0], ctx.margin, ctx.y + 4);
        ctx.y += 12;

        const kept = facts.filter((fact) => fact && fact.value);
        if (!kept.length) return;
        Na__LeRegPdf__Rule(ctx, ctx.y, cfg.rule, 0.3);
        const step = ctx.width / kept.length;
        Na__LeRegPdf__Font(ctx, Na__LeRegPdf__RUNNING_PT, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
        kept.forEach((fact, index) => Na__LeRegPdf__Draw(ctx, fact.label.toUpperCase(), ctx.margin + step * index, ctx.y + 4.6, Na__LeRegPdf__RUNNING_TRACK_MM, 'left'));
        Na__LeRegPdf__Font(ctx, cfg.pdfFontPt, Na__LeRegPdf__WEIGHT_BODY, cfg.ink);
        kept.forEach((fact, index) => {
            const room = ctx.doc.splitTextToSize(String(fact.value), step - 3);
            ctx.doc.text(room[0], ctx.margin + step * index, ctx.y + 9.8);
        });
        ctx.y += 13;
        Na__LeRegPdf__Rule(ctx, ctx.y, cfg.rule, 0.3);
        ctx.y += 9;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Section Heading, With Its Continuation Marker
    // ------------------------------------------------------------
    function Na__LeRegPdf__Heading(ctx, heading, continued) {
        const cfg = ctx.cfg;
        Na__LeRegPdf__Font(ctx, cfg.headingPt, Na__LeRegPdf__WEIGHT_BOLD, cfg.ink);
        Na__LeRegPdf__Draw(ctx, heading, ctx.margin, ctx.y + 4, Na__LeRegPdf__HEAD_TRACK_MM, 'left');
        if (continued) {
            Na__LeRegPdf__Font(ctx, cfg.metaPt, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
            Na__LeRegPdf__Draw(ctx, 'continued', ctx.margin + ctx.width, ctx.y + 4, 0, 'right');
        }
        ctx.y += 9;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Letterhead Plus Heading, the Shape Every Page Opens With
    // ------------------------------------------------------------
    function Na__LeRegPdf__Header(ctx, heading, continued) {
        Na__LeRegPdf__Letterhead(ctx);
        Na__LeRegPdf__Heading(ctx, heading, continued);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start a Fresh Page Under the Same Heading
    // ------------------------------------------------------------
    function Na__LeRegPdf__NewPage(ctx, heading) {
        ctx.doc.addPage();
        Na__LeRegPdf__Header(ctx, heading, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Office Name, Project Code and Page Count on Every Page
    // ------------------------------------------------------------
    function Na__LeRegPdf__Footer(ctx, pages) {
        const cfg    = ctx.cfg;
        const right  = ctx.margin + ctx.width;
        const ruleY  = Na__LeRegPdf__PAGE_H_MM - ctx.margin - 7;
        const baseY  = Na__LeRegPdf__PAGE_H_MM - ctx.margin - 2;
        for (let index = 1; index <= pages; index++) {
            ctx.doc.setPage(index);
            Na__LeRegPdf__Rule(ctx, ruleY, cfg.rule, 0.3);
            Na__LeRegPdf__Font(ctx, Na__LeRegPdf__RUNNING_PT, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
            Na__LeRegPdf__Draw(ctx, ctx.company.toUpperCase(), ctx.margin, baseY, Na__LeRegPdf__RUNNING_TRACK_MM, 'left');
            Na__LeRegPdf__Draw(ctx, ('Page ' + index + ' of ' + pages).toUpperCase(), right, baseY, Na__LeRegPdf__RUNNING_TRACK_MM, 'right');
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Register Table
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Table's Head Row, Repeated on Every Page It Runs Onto
    // ------------------------------------------------------------
    function Na__LeRegPdf__TableHead(ctx, columns) {
        const cfg = ctx.cfg;
        ctx.doc.setFillColor(cfg.header);
        ctx.doc.rect(ctx.margin, ctx.y, ctx.width, cfg.headRowMm, 'F');
        Na__LeRegPdf__Font(ctx, cfg.tableHeadPt, Na__LeRegPdf__WEIGHT_BOLD, cfg.muted);
        let x = ctx.margin;
        columns.forEach((column) => {
            Na__LeRegPdf__Cell(ctx, [column.heading], column, x, ctx.y, cfg.headRowMm, cfg.tableHeadPt, Na__LeRegPdf__HEAD_TRACK_MM);
            x += column.width;
        });
        ctx.y += cfg.headRowMm;
        Na__LeRegPdf__Rule(ctx, ctx.y, cfg.accent, 0.4);                         // <-- The accent rule ties the head row to the header band above it
    }
    // ------------------------------------------------------------


    // FUNCTION | Paint the Register Table, Breaking Between Whole Rows
    // ------------------------------------------------------------
    function Na__LeRegPdf__Table(ctx, rows, columns, heading) {
        const cfg = ctx.cfg;
        Na__LeRegPdf__TableHead(ctx, columns);

        if (!rows.length) {
            Na__LeRegPdf__Font(ctx, cfg.pdfFontPt, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
            ctx.doc.text('No drawing sheets have been created.', ctx.margin + cfg.cellPadMm, ctx.y + cfg.rowPadMm + cfg.lineMm);
            ctx.y += cfg.rowPadMm * 2 + cfg.lineMm;
            return;
        }

        let striped = false;
        rows.forEach((row) => {
            const measured = Na__LeRegPdf__Measure(ctx, row, columns);
            if (ctx.y + measured.height > ctx.bottom) {                          // <-- Whole rows only: a register that slices a row across pages is unreadable
                Na__LeRegPdf__NewPage(ctx, heading);
                Na__LeRegPdf__TableHead(ctx, columns);
                striped = false;
            }
            if (striped) {
                ctx.doc.setFillColor(cfg.stripe);
                ctx.doc.rect(ctx.margin, ctx.y, ctx.width, measured.height, 'F');
            }
            let x = ctx.margin;
            columns.forEach((column, index) => {
                Na__LeRegPdf__Font(ctx, cfg.pdfFontPt, Na__LeRegPdf__WEIGHT_BODY, measured.empty[index] ? cfg.muted : cfg.ink);
                Na__LeRegPdf__Cell(ctx, measured.lines[index], column, x, ctx.y, measured.height, cfg.pdfFontPt);
                x += column.width;
            });
            ctx.y += measured.height;
            Na__LeRegPdf__Rule(ctx, ctx.y, cfg.rule, 0.15);
            striped = !striped;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Revision History
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Paragraph, Optionally Inside a Warning Panel
    // ------------------------------------------------------------
    function Na__LeRegPdf__Paragraph(ctx, text, level, heading) {
        const cfg    = ctx.cfg;
        const left   = ctx.margin + Na__LeRegPdf__RAIL_MM;
        const boxed  = level === 'red' || level === 'amber';
        const inset  = boxed ? 3.5 : 0;
        const measure = ctx.margin + ctx.width - left - inset * 2;

        Na__LeRegPdf__Font(ctx, cfg.notePt, Na__LeRegPdf__WEIGHT_BODY, cfg.ink);
        const lines = ctx.doc.splitTextToSize(String(text), Math.max(20, measure));
        let   index = 0;
        while (index < lines.length) {
            const room = Math.floor((ctx.bottom - ctx.y - inset * 2) / cfg.lineMm);
            if (room < 1) {
                Na__LeRegPdf__NewPage(ctx, heading);
                continue;
            }
            const take   = Math.min(lines.length - index, room);
            const height = take * cfg.lineMm + inset * 2;
            if (boxed) {
                ctx.doc.setFillColor(level === 'red' ? cfg.warnRedFill : cfg.warnAmberFill);
                ctx.doc.rect(left, ctx.y, ctx.margin + ctx.width - left, height, 'F');
            }
            Na__LeRegPdf__Font(ctx, cfg.notePt, Na__LeRegPdf__WEIGHT_BODY, boxed ? (level === 'red' ? cfg.warnRedInk : cfg.warnAmberInk) : cfg.ink);
            lines.slice(index, index + take).forEach((line, offset) => {
                ctx.doc.text(line, left + inset, ctx.y + inset + Na__LeRegPdf__Baseline(cfg.notePt, cfg.lineMm) + offset * cfg.lineMm);
            });
            ctx.y += height;
            index  += take;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Revision Entry: a Rail, Its Note and Any Warning
    // ------------------------------------------------------------
    function Na__LeRegPdf__Revision(ctx, note, fallbackRevision, heading) {
        const cfg  = ctx.cfg;
        const code = String(note.DrawingRegister__Revision__Code || fallbackRevision || '').replace(/^Rev\s+/i, '');
        const date = String(note.DrawingRegister__Revision__Date || '');

        if (ctx.y + cfg.lineMm * 3 > ctx.bottom) Na__LeRegPdf__NewPage(ctx, heading);

        const railY = ctx.y;
        Na__LeRegPdf__Font(ctx, cfg.notePt, Na__LeRegPdf__WEIGHT_BOLD, cfg.ink);
        ctx.doc.text('Rev ' + code, ctx.margin, railY + Na__LeRegPdf__Baseline(cfg.notePt, cfg.lineMm));
        if (date) {
            Na__LeRegPdf__Font(ctx, cfg.tableHeadPt, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
            ctx.doc.text(date, ctx.margin, railY + cfg.lineMm + Na__LeRegPdf__Baseline(cfg.tableHeadPt, cfg.lineMm));
        }

        Na__LeRegPdf__Paragraph(ctx, note.DrawingRegister__Revision__Notes || 'No description recorded.', 'none', heading);
        const warning = String(note.DrawingRegister__Revision__WarningText || '');
        const level   = note.DrawingRegister__Revision__Warning || 'none';
        if (warning && level !== 'none') {
            ctx.y += 2;
            Na__LeRegPdf__Paragraph(ctx, warning, level, heading);
        }
        ctx.y = Math.max(ctx.y, railY + cfg.lineMm * 2) + 5;                     // <-- Never let a one-line note ride up over its own rail
    }
    // ------------------------------------------------------------


    // FUNCTION | The Revision History Appendix, Flowed Across Pages
    // ------------------------------------------------------------
    function Na__LeRegPdf__History(ctx, rows) {
        const cfg     = ctx.cfg;
        const heading = 'DRAWING REVISION HISTORY';
        ctx.doc.addPage();
        Na__LeRegPdf__Letterhead(ctx);
        Na__LeRegPdf__Heading(ctx, heading, false);                              // <-- The appendix opens its own section, so this first page is not 'continued'

        rows.forEach((row, index) => {
            if (ctx.y + 26 > ctx.bottom) Na__LeRegPdf__NewPage(ctx, heading);    // <-- Keep a drawing's title with at least the start of its first entry
            else if (index > 0) ctx.y += 4;

            Na__LeRegPdf__Font(ctx, cfg.notePt + 1.5, Na__LeRegPdf__WEIGHT_BOLD, cfg.ink);
            const title = ctx.doc.splitTextToSize(row.code + '   ' + row.name, ctx.width);
            title.forEach((line, offset) => {
                ctx.doc.text(line, ctx.margin, ctx.y + Na__LeRegPdf__Baseline(cfg.notePt + 1.5, cfg.lineMm) + offset * cfg.lineMm);
            });
            ctx.y += title.length * cfg.lineMm + 2;
            Na__LeRegPdf__Rule(ctx, ctx.y, cfg.rule, 0.3);
            ctx.y += 4;

            if (!row.notes.length) {
                Na__LeRegPdf__Font(ctx, cfg.notePt, Na__LeRegPdf__WEIGHT_BODY, cfg.muted);
                ctx.doc.text('No revision notes recorded.', ctx.margin + Na__LeRegPdf__RAIL_MM, ctx.y + Na__LeRegPdf__Baseline(cfg.notePt, cfg.lineMm));
                ctx.y += cfg.lineMm + 5;
                return;
            }
            row.notes.forEach((note) => Na__LeRegPdf__Revision(ctx, note, row.revision, heading));
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document Build
// -----------------------------------------------------------------------------

    // FUNCTION | Produce the Same PDF Used for Preview and Download
    // ------------------------------------------------------------
    async function Na__LeRegPdf__BuildDocument(detailed) {
        const JsPdf = await Na__LePdf__EnsureJsPdf();
        await Na__LePdfFonts__EnsureLoaded();                                    // <-- Open Sans in memory BEFORE anything is measured or drawn; without this Install fails silently and the whole document falls back to non-embedded Helvetica

        const cfg      = Na__LeCfg__GetDrawingRegisterSetup();
        const rows     = Na__LeRegPdf__Rows();
        const register = Na__LeReg__Clone(Na__LeReg__GetDocument());
        const project  = Na__LeRegPdf__ProjectName();

        const doc = new JsPdf({
            orientation      : 'portrait',
            unit             : 'mm',
            format           : 'a4',
            compress         : true,
            putOnlyUsedFonts : true
        });
        Na__LePdfFonts__Install(doc);

        const code   = String(Na__DrawData__GetProjectCode() || '');
        const stamp  = Na__LeRegPdf__Stamp(register);
        const number = [ code, cfg.registerSuffix ].filter(Boolean).join('');    // <-- PS01_REGISTER, sitting beside the specification's PS01_SPEC
        const ctx = {
            doc     : doc,
            cfg     : cfg,
            margin  : cfg.pdfMarginMm,
            width   : Na__LeRegPdf__PAGE_W_MM - cfg.pdfMarginMm * 2,
            bottom  : Na__LeRegPdf__PAGE_H_MM - cfg.pdfMarginMm - Na__LeRegPdf__FOOTER_MM,
            project : project,
            code    : code,
            number  : number,
            stamp   : stamp,
            logo    : await Na__LeRegPdf__Logo(),
            company : Na__LeCfg__GetPdfSetup().author || 'Noble Architecture Ltd',
            running : [ 'Drawing Register', [ code, project ].filter(Boolean).join(' ') ].filter(Boolean).join(' · ').toUpperCase(),
            issue   : [ number, stamp ].filter(Boolean).join('  ·  ').toUpperCase(),
            y       : cfg.pdfMarginMm
        };

        const printable = Na__LeRegPdf__PrintRows(rows, cfg);
        const heading   = 'DRAWING REGISTER';
        Na__LeRegPdf__Letterhead(ctx);
        Na__LeRegPdf__Title(ctx, 'Drawing Register', [                           // <-- The specification's opening strip, saying the same kinds of thing
            { label : 'Project',      value : ctx.code },
            { label : 'Document No.', value : ctx.number },
            { label : 'Date',         value : ctx.stamp },
            { label : 'Contents',     value : printable.length + (printable.length === 1 ? ' drawing' : ' drawings') }
        ]);
        Na__LeRegPdf__Table(ctx, printable, Na__LeRegPdf__Columns(ctx, printable), heading);
        if (detailed && printable.length) Na__LeRegPdf__History(ctx, printable);

        const pages = doc.getNumberOfPages();
        Na__LeRegPdf__Footer(ctx, pages);

        const pdf = Na__LeCfg__GetPdfSetup();
        doc.setProperties({
            title    : project + ' — Drawing Register',
            subject  : rows.length + (rows.length === 1 ? ' drawing' : ' drawings') + ', updated ' + ctx.stamp,
            author   : pdf.author,
            creator  : pdf.creator
        });
        return {
            doc,
            pages,
            filename : Na__LeFileName__Build({
                code        : 'DR',
                name        : detailed ? 'Drawing Register and Revision History' : 'Drawing Register',
                paper       : 'A4',
                revision    : '',
                projectCode : Na__DrawData__GetProjectCode()
            })
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Download the Register PDF
    // ------------------------------------------------------------
    async function Na__LeRegPdf__Download(detailed) {
        const built = await Na__LeRegPdf__BuildDocument(detailed);
        await built.doc.save(built.filename, { returnPromise : true });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register PDF API
    // ------------------------------------------------------------
    export {
        Na__LeRegPdf__Rows,
        Na__LeRegPdf__ProjectName,
        Na__LeRegPdf__BuildDocument,
        Na__LeRegPdf__Download
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
