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
// - The read preview and the download use this same paginated document.
// - Long names and notes wrap; warning boxes stay attached to their revision
//   entries. Page furniture is the office name, the project code and the
//   page count.
//
// INTEGRATION:
// - The register editor's Read view and Export register PDF both call
//   Na__LeRegPdf__BuildDocument. Rows and the project name are also read
//   by the editable table so Edit and Read share one source.
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
    import { Na__LeCfg__GetDrawingRegisterSetup, Na__LeCfg__GetPdfSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheets, Na__LeModel__GetFields } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLayout__PaperSizeMm } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LePdf__EnsureJsPdf } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import { Na__LePdfFonts__Install, Na__LePdfFonts__SetFont } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFonts__.js';
    import { Na__LeFileName__Build } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFilename__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LeReg__GetDocument, Na__LeReg__GetRevisions, Na__LeReg__Clone } from './Na__LayoutEditor__Register__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document Data
// -----------------------------------------------------------------------------

    // FUNCTION | One Register Row per Sheet, in Tab Order
    // ------------------------------------------------------------
    function Na__LeRegPdf__Rows() {
        return Na__LeModel__GetSheets().map((sheet) => {
            const fields = Na__LeModel__GetFields(sheet);
            const paper  = Na__LeLayout__PaperSizeMm(sheet.Sheet__PaperSize, sheet.Sheet__Orientation);
            return {
                id       : sheet.Sheet__Id,
                code     : fields.DrawingNumber,
                name     : sheet.Sheet__Name,
                type     : 'Drawing',
                scale    : fields.Scale,
                size     : 'ISO ' + paper.Label,
                revision : fields.Revision,
                notes    : Na__LeReg__Clone(Na__LeReg__GetRevisions(sheet.Sheet__Id))
            };
        });
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Paginated Register and Revision Pages
// -----------------------------------------------------------------------------

    // FUNCTION | Produce the Same PDF Used for Preview and Download
    // ------------------------------------------------------------
    async function Na__LeRegPdf__BuildDocument(detailed) {
        const rows     = Na__LeRegPdf__Rows();
        const register = Na__LeReg__Clone(Na__LeReg__GetDocument());
        const project  = Na__LeRegPdf__ProjectName();
        const cfg      = Na__LeCfg__GetDrawingRegisterSetup();
        const JsPdf    = await Na__LePdf__EnsureJsPdf();
        const doc = new JsPdf({
            orientation     : 'portrait',
            unit            : 'mm',
            format          : 'a4',
            compress        : true,
            putOnlyUsedFonts : true
        });
        Na__LePdfFonts__Install(doc);
        const margin  = cfg.pdfMarginMm;
        const width   = 210 - margin * 2;
        const bottom  = 297 - margin - 10;
        const columns = [0.13, 0.43, 0.11, 0.12, 0.11, 0.10].map((part) => part * width);
        const headings = ['CODE', 'DOCUMENT NAME', 'TYPE', 'SCALE', 'SIZE', 'REVISION'];
        let y = margin;

        const font = (size, bold) => {
            if (!Na__LePdfFonts__SetFont(doc, bold ? 600 : 400)) {
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
            }
            doc.setFontSize(size);
            doc.setTextColor(cfg.ink);
        };

        const header = (title) => {
            font(18, true);
            doc.text(project, margin, margin + 7, { maxWidth : width });
            font(9, false);
            doc.setTextColor(cfg.muted);
            const stamp = register.DrawingRegister__Document__Updated;
            doc.text('Last updated: ' + (stamp ? new Date(stamp).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')), margin, margin + 15);
            doc.setDrawColor(cfg.rule);
            doc.line(margin, margin + 22, 210 - margin, margin + 22);
            font(13, true);
            doc.text(title, margin, margin + 33);
            y = margin + 41;
        };

        const page = (title) => {
            doc.addPage();
            header(title);
        };

        const tableHeader = () => {
            doc.setFillColor(cfg.header);
            doc.rect(margin, y, width, 10, 'F');
            font(8, true);
            doc.setTextColor(cfg.muted);
            let x = margin;
            headings.forEach((title, i) => {
                doc.text(title, x + 2, y + 6.5);
                x += columns[i];
            });
            y += 10;
        };

        header('DRAWING REGISTER');
        tableHeader();
        rows.forEach((row, index) => {
            const values = [row.code, row.name, row.type, row.scale, row.size, 'Rev ' + row.revision];
            font(cfg.pdfFontPt, false);
            const lines  = values.map((value, i) => doc.splitTextToSize(String(value || ''), columns[i] - 4));
            let offset   = 0;
            const count  = Math.max(...lines.map((cell) => cell.length));
            while (offset < count) {
                if (y + 9 > bottom) {
                    page('DRAWING REGISTER — CONTINUED');
                    tableHeader();
                    font(cfg.pdfFontPt, false);
                }
                const take   = Math.min(count - offset, Math.max(1, Math.floor((bottom - y - 4) / 4.5)));
                const height = Math.max(9, take * 4.5 + 4);
                if (index % 2) {
                    doc.setFillColor(cfg.stripe);
                    doc.rect(margin, y, width, height, 'F');
                }
                let x = margin;
                lines.forEach((cell, i) => {
                    doc.text(cell.slice(offset, offset + take), x + 2, y + 5.5, { lineHeightFactor : 1.35 });
                    x += columns[i];
                });
                doc.setDrawColor(cfg.rule);
                doc.line(margin, y + height, 210 - margin, y + height);
                y      += height;
                offset += take;
            }
        });
        if (!rows.length) {
            font(10, false);
            doc.text('No drawing sheets have been created.', margin + 2, y + 8);
        }

        if (detailed) rows.forEach((row) => {
            page('DRAWING REVISION HISTORY');
            font(12, true);
            const titleLines = doc.splitTextToSize(row.code + ' — ' + row.name, width);
            doc.text(titleLines, margin, y);
            y += titleLines.length * 5.5 + 8;
            if (!row.notes.length) {
                font(10, false);
                doc.text('No revision notes recorded.', margin, y);
            }
            row.notes.forEach((note) => {
                if (y + 24 > bottom) page('REVISION HISTORY — CONTINUED');
                font(11, true);
                doc.text('Rev ' + String(note.DrawingRegister__Revision__Code || row.revision) + '  |  ' + String(note.DrawingRegister__Revision__Date || ''), margin, y);
                y += 8;
                const sections = [
                    { text : note.DrawingRegister__Revision__Notes || 'No description recorded.', level : 'none' },
                    { text : note.DrawingRegister__Revision__WarningText || '', level : note.DrawingRegister__Revision__Warning || 'none' }
                ];
                sections.forEach((section) => {
                    if (!section.text) return;
                    font(10, false);
                    const lines = doc.splitTextToSize(String(section.text), width - 8);
                    let offset  = 0;
                    while (offset < lines.length) {
                        if (y + 14 > bottom) {
                            page('REVISION HISTORY — CONTINUED');
                            font(10, false);
                        }
                        const take   = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - 8) / 5)));
                        const height = take * 5 + 7;
                        if (section.level !== 'none') {
                            doc.setFillColor(section.level === 'red' ? '#fde9e7' : '#fff4d3');
                            doc.rect(margin, y - 3, width, height, 'F');
                            doc.setTextColor(section.level === 'red' ? '#a32e29' : '#795900');
                        }
                        doc.text(lines.slice(offset, offset + take), margin + 4, y + 2, { lineHeightFactor : 1.4 });
                        y      += height + 3;
                        offset += take;
                    }
                });
                y += 6;
            });
        });

        const pages = doc.getNumberOfPages();
        for (let index = 1; index <= pages; index++) {
            doc.setPage(index);
            font(8, false);
            doc.setTextColor(cfg.muted);
            doc.text('NOBLE ARCHITECTURE  |  ' + Na__DrawData__GetProjectCode(), margin, 297 - margin);
            doc.text(index + ' / ' + pages, 210 - margin, 297 - margin, { align : 'right' });
        }
        const pdf = Na__LeCfg__GetPdfSetup();
        doc.setProperties({
            title   : project + ' — Drawing Register',
            author  : pdf.author,
            creator : pdf.creator
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
