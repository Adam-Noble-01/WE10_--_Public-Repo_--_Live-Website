// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER PDF PREVIEW
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Preview__.js
// NAMESPACE  : Na__LeRegPreview
// MODULE     : Layout Editor - Drawing Register PDF Preview
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Render the actual register PDF on desktop and mobile browsers
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Reuses PlanVision's version-locked PDF.js dependency. Native PDF iframe
//   support is not assumed.
// - Render tasks and PDF memory are released on hide, so leaving the tab
//   does not leave a document pinned in memory.
//
// INTEGRATION:
// - The register editor's Read view paints through Na__LeRegPreview__Render
//   and clears through Na__LeRegPreview__Clear. Script and worker paths
//   come from GetDrawingRegisterSetup.
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

    // MODULE IMPORTS | Drawing Register Setup
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDrawingRegisterSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Loaded Library, Open Document and Active Render Task
    // ------------------------------------------------------------
    let Na__LeRegPreview__Library  = null;
    let Na__LeRegPreview__Document = null;
    let Na__LeRegPreview__Task     = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | PDF.js Load and Page Paint
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Load PDF.js Once, Pointing Its Worker at the Vendored Copy
    // ------------------------------------------------------------
    function Na__LeRegPreview__Ready() {
        if (Na__LeRegPreview__Library) return Na__LeRegPreview__Library;
        const cfg = Na__LeCfg__GetDrawingRegisterSetup();
        Na__LeRegPreview__Library = new Promise((resolve, reject) => {
            const ready = () => {
                if (!window.pdfjsLib) {
                    reject(new Error('PDF preview library did not load.'));
                    return;
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = cfg.pdfJsWorkerPath;
                resolve(window.pdfjsLib);
            };
            if (window.pdfjsLib) {
                ready();
                return;
            }
            const script = document.createElement('script');
            script.src     = cfg.pdfJsScriptPath;
            script.onload  = ready;
            script.onerror = () => {
                script.remove();
                reject(new Error('PDF preview library is unavailable.'));
            };
            document.head.appendChild(script);
        }).catch((error) => {
            Na__LeRegPreview__Library = null;
            throw error;
        });
        return Na__LeRegPreview__Library;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release the Open Document and Cancel an In-Flight Render
    // ------------------------------------------------------------
    function Na__LeRegPreview__Clear() {
        if (Na__LeRegPreview__Task) Na__LeRegPreview__Task.cancel();
        Na__LeRegPreview__Task = null;
        if (Na__LeRegPreview__Document) void Na__LeRegPreview__Document.destroy();
        Na__LeRegPreview__Document = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paint the Same Bytes That the Register Download Sends
    // ------------------------------------------------------------
    async function Na__LeRegPreview__Render(bytes, container, current) {
        Na__LeRegPreview__Clear();
        const library = await Na__LeRegPreview__Ready();
        if (!current()) return;
        const pdf = await library.getDocument({ data : new Uint8Array(bytes) }).promise;
        if (!current()) {
            await pdf.destroy();
            return;
        }
        Na__LeRegPreview__Document = pdf;
        container.replaceChildren();
        for (let index = 1; index <= pdf.numPages; index++) {
            if (!current()) return;
            const page = await pdf.getPage(index);
            if (!current()) return;
            const viewport = page.getViewport({ scale : Na__LeCfg__GetDrawingRegisterSetup().previewScale });
            const canvas   = document.createElement('canvas');
            canvas.className = 'na-le-register__pdf-page';
            canvas.width     = Math.ceil(viewport.width);
            canvas.height    = Math.ceil(viewport.height);
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', 'Drawing register page ' + index + ' of ' + pdf.numPages);
            container.appendChild(canvas);
            Na__LeRegPreview__Task = page.render({
                canvasContext : canvas.getContext('2d'),
                viewport
            });
            await Na__LeRegPreview__Task.promise;
            Na__LeRegPreview__Task = null;
            page.cleanup();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register Preview API
    // ------------------------------------------------------------
    export {
        Na__LeRegPreview__Render,
        Na__LeRegPreview__Clear
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
