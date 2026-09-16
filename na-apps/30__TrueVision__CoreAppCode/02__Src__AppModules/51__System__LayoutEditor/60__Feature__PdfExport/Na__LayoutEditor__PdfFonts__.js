// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PDF FONTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__PdfFonts__.js
// NAMESPACE  : Na__LePdfFonts
// MODULE     : Layout Editor - PDF Fonts
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Embed the app's Open Sans cuts in every jsPDF document
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - jsPDF's fourteen standard typefaces do not include Open Sans. Without a
//   file in the document, setFont('helvetica') is the only face that prints,
//   which is why Download PDF used to ignore the sheet's type.
// - This module fetches the three TTF cuts the app already paints with
//   (Light 300, Regular 400, SemiBold 600), keeps them as base64, and
//   registers each one on a jsPDF instance (virtual file system plus addFont
//   at Identity-H). jsPDF then subsets the glyphs the sheet actually uses.
// - Paths come from the Pdf block of Na__LayoutEditor__AppConfig__.json: the
//   local CommonFonts folder first, the same CDN URL the CSS @font-face uses
//   if that fetch fails.
//
// INTEGRATION:
// - PdfExporter waits for EnsureLoaded before it builds a document, and
//   Installs the cuts on that document.
// - SheetChrome measures and paints through SetFont so screen truncation
//   and paper glyphs share the same metrics.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: fetch, cache, install and select Open Sans.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | PDF font paths from the Layout Editor config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetPdfSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Cached Cuts and Documents Already Given Them
    // ------------------------------------------------------------
    let     Na__LePdfFonts__FamilyName = 'OpenSans';
    let     Na__LePdfFonts__Cuts       = [];          // <-- { style, fileName, base64 }
    let     Na__LePdfFonts__LoadPromise = null;
    const   Na__LePdfFonts__Installed  = new WeakSet();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fetching
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Join a Folder Path and a File Name
    // ------------------------------------------------------------
    function Na__LePdfFonts__Join(base, fileName) {
        if (!fileName) return '';
        const folder = String(base || '');
        if (!folder) return String(fileName);
        return folder.endsWith('/') ? folder + fileName : folder + '/' + fileName;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Distinct URLs a Cut Can Be Fetched From
    // ------------------------------------------------------------
    function Na__LePdfFonts__UrlsForCut(setup, cut) {
        const urls  = [];
        const local = Na__LePdfFonts__Join(setup.fontBasePath, cut.fileName);
        const cdn   = Na__LePdfFonts__Join(setup.fontCdnBase, cut.fileName);
        if (local) urls.push(local);
        if (cdn && cdn !== local) urls.push(cdn);
        return urls;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | ArrayBuffer to a Base64 String
    // ------------------------------------------------------------
    function Na__LePdfFonts__Base64FromBytes(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary  = '';
        const step  = 0x8000;
        for (let i = 0; i < bytes.length; i += step) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
        }
        return btoa(binary);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One URL as Base64
    // ------------------------------------------------------------
    async function Na__LePdfFonts__FetchBase64(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + url);
        return Na__LePdfFonts__Base64FromBytes(await response.arrayBuffer());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One Cut, Local Path Then CDN
    // ------------------------------------------------------------
    async function Na__LePdfFonts__FetchCut(setup, cut) {
        const urls = Na__LePdfFonts__UrlsForCut(setup, cut);
        let lastError = null;
        for (let i = 0; i < urls.length; i++) {
            try { return await Na__LePdfFonts__FetchBase64(urls[i]); }
            catch (fetchError) { lastError = fetchError; }
        }
        throw lastError || new Error('No URL for ' + cut.fileName);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch Every Configured Cut Once
    // ------------------------------------------------------------
    async function Na__LePdfFonts__LoadCuts() {
        const setup = Na__LeCfg__GetPdfSetup();
        Na__LePdfFonts__FamilyName = setup.fontFamily || 'OpenSans';
        const loaded = [];
        const results = await Promise.all(setup.fonts.map(async (cut) => {
            try {
                const base64 = await Na__LePdfFonts__FetchCut(setup, cut);
                return { style : cut.style, fileName : cut.fileName, base64 : base64 };
            } catch (cutError) {
                console.warn('[TrueVision3D LayoutEditor] PDF font unavailable: ' + cut.fileName, cutError);
                return null;
            }
        }));
        results.forEach((cut) => { if (cut) loaded.push(cut); });
        Na__LePdfFonts__Cuts = loaded;
        return loaded.length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Make Sure the Open Sans Cuts Are in Memory
    // ------------------------------------------------------------
    function Na__LePdfFonts__EnsureLoaded() {
        if (Na__LePdfFonts__Cuts.length > 0) return Promise.resolve(true);
        if (Na__LePdfFonts__LoadPromise) return Na__LePdfFonts__LoadPromise;
        Na__LePdfFonts__LoadPromise = Na__LePdfFonts__LoadCuts().then((ok) => {
            if (!ok) Na__LePdfFonts__LoadPromise = null;
            return ok;
        }).catch((loadError) => {
            console.warn('[TrueVision3D LayoutEditor] Open Sans could not be loaded for PDF export; Helvetica will be used.', loadError);
            Na__LePdfFonts__LoadPromise = null;
            return false;
        });
        return Na__LePdfFonts__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Cached Cuts on a jsPDF Document
    // ------------------------------------------------------------
    function Na__LePdfFonts__Install(doc) {
        if (!doc || Na__LePdfFonts__Cuts.length === 0) return false;
        if (Na__LePdfFonts__Installed.has(doc)) return true;
        if (typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') return false;
        try {
            Na__LePdfFonts__Cuts.forEach((cut) => {
                doc.addFileToVFS(cut.fileName, cut.base64);
                doc.addFont(cut.fileName, Na__LePdfFonts__FamilyName, cut.style);
            });
            Na__LePdfFonts__Installed.add(doc);
            return true;
        } catch (installError) {
            console.warn('[TrueVision3D LayoutEditor] Open Sans could not be embedded in the PDF.', installError);
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | jsPDF Style Name for a Sheet Weight
    // ------------------------------------------------------------
    function Na__LePdfFonts__StyleForWeight(weight) {
        let wanted = 'normal';
        if (weight === 'bold') wanted = 'bold';
        else if (weight === 'light') wanted = 'light';
        else {
            const n = Number(weight);
            if (Number.isFinite(n)) {
                if (n >= 600) wanted = 'bold';
                else if (n <= 300) wanted = 'light';
            }
        }
        if (Na__LePdfFonts__Cuts.some((cut) => cut.style === wanted)) return wanted;
        if (Na__LePdfFonts__Cuts.some((cut) => cut.style === 'normal')) return 'normal';
        return Na__LePdfFonts__Cuts.length ? Na__LePdfFonts__Cuts[0].style : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Select Open Sans at a Weight on a Document (false = caller falls back)
    // ------------------------------------------------------------
    function Na__LePdfFonts__SetFont(doc, weight) {
        if (!Na__LePdfFonts__Install(doc)) return false;
        const style = Na__LePdfFonts__StyleForWeight(weight);
        if (!style) return false;
        try {
            doc.setFont(Na__LePdfFonts__FamilyName, style);
            return true;
        } catch (fontError) {
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor PDF Fonts API
    // ------------------------------------------------------------
    export {
        Na__LePdfFonts__EnsureLoaded,
        Na__LePdfFonts__Install,
        Na__LePdfFonts__SetFont
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
