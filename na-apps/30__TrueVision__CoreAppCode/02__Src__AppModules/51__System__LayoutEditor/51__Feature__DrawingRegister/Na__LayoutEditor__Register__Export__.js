// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING PACK EXPORT
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Export__.js
// NAMESPACE  : Na__LeRegExport
// MODULE     : Layout Editor - Drawing Pack Export
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Run existing high-quality exporters sequentially, one PDF per file
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Walks every sheet through the existing sheet PDF exporter, then optionally
//   the register and the specification, restoring the open view afterwards.
// - Stops on the first failure and keeps every PDF already downloaded. A
//   pending local sync blocks the pack so the files match what R2 holds.
//
// INTEGRATION:
// - The register editor bar calls Na__LeRegExport__Run. Navigation.enter and
//   navigation.openRegister come from the mode controller.
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

    // MODULE IMPORTS | Sheets, Existing PDF Exporters and Register Transactions
    // ------------------------------------------------------------
    import { Na__LeModel__GetSheets, Na__LeModel__GetActiveSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LePdf__ExportSheet } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import { Na__LeSpec__EnsureLoaded, Na__LeSpec__IsLoaded, Na__LeSpec__ListNotes } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecPdf__Download } from '../50__Feature__Specification/Na__LayoutEditor__SpecPdf__.js';
    import { Na__LeRegPdf__Download } from './Na__LayoutEditor__Register__Pdf__.js';
    import { Na__LeRegEdit__IsBusy, Na__LeRegEdit__NeedsLocal } from './Na__LayoutEditor__Register__Transactions__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Sequential Export Guard
    // ------------------------------------------------------------
    let Na__LeRegExport__Busy = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sequential Pack Export
// -----------------------------------------------------------------------------

    // FUNCTION | Sequential Export With Progress, Stop-on-Failure and View Restoration
    // ------------------------------------------------------------
    async function Na__LeRegExport__Run(pack, detailed, navigation, toast) {
        if (Na__LeRegExport__Busy || Na__LeRegEdit__IsBusy()) return false;
        if (Na__LeRegEdit__NeedsLocal()) {
            toast('Retry the local drawing sync before exporting the pack.', true);
            return false;
        }
        const sheets = Na__LeModel__GetSheets().map((sheet) => JSON.parse(JSON.stringify(sheet)));
        if (!sheets.length) {
            toast('Create a drawing sheet before exporting.', true);
            return false;
        }
        Na__LeRegExport__Busy = true;
        const active  = Na__LeModel__GetActiveSheet();
        const dialog  = document.createElement('dialog');
        dialog.className = 'na-le-register__saving';
        const progress = document.createElement('p');
        progress.setAttribute('role', 'status');
        const cancel = document.createElement('button');
        cancel.type        = 'button';
        cancel.textContent = 'Stop after this document';
        let cancelled = false;
        cancel.addEventListener('click', () => {
            cancelled      = true;
            cancel.disabled = true;
        });
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            cancelled = true;
        });
        dialog.append(progress, cancel);
        document.body.appendChild(dialog);
        dialog.showModal();
        let completed = 0;
        try {
            progress.textContent = 'Preparing drawing notes…';
            await Na__LeSpec__EnsureLoaded();
            if (!Na__LeSpec__IsLoaded()) {
                throw new Error('The specification could not be loaded. Export stopped before downloading incomplete drawing notes.');
            }
            if (pack && !Na__LeSpec__ListNotes().length) {
                throw new Error('The specification is empty. Add its notes or use Export All Drawings.');
            }
            const total = sheets.length + (pack ? 2 : 0);
            for (const sheet of sheets) {
                if (cancelled) break;
                progress.textContent = 'Rendering ' + (completed + 1) + ' / ' + total + ': ' + sheet.Sheet__Name;
                navigation.enter(sheet.Sheet__Id);
                const ok = await Na__LePdf__ExportSheet(sheet, (text, error) => {
                    if (error) toast(text, true);
                }, { strict : true });
                if (!ok) throw new Error('Stopped at ' + sheet.Sheet__Name + '. Previously downloaded PDFs are kept.');
                completed++;
            }
            if (pack && !cancelled) {
                progress.textContent = 'Exporting drawing register…';
                await Na__LeRegPdf__Download(detailed);
                completed++;
                if (!cancelled) {
                    progress.textContent = 'Exporting specification…';
                    const specOk = await Na__LeSpecPdf__Download((text, kind) => {
                        if (kind === 'error' || kind === 'warn') toast(text, true);
                    });
                    if (!specOk) throw new Error('Specification export failed. Previously downloaded PDFs are kept.');
                    completed++;
                }
            }
            toast((cancelled ? 'Export stopped. ' : 'Export complete. ') + completed + ' separate PDF downloads requested.', false);
            return !cancelled;
        } catch (error) {
            toast(error.message, true);
            return false;
        } finally {
            if (active) navigation.enter(active.Sheet__Id);
            navigation.openRegister();
            dialog.close();
            dialog.remove();
            Na__LeRegExport__Busy = false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Pack Export API
    // ------------------------------------------------------------
    export {
        Na__LeRegExport__Run
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
