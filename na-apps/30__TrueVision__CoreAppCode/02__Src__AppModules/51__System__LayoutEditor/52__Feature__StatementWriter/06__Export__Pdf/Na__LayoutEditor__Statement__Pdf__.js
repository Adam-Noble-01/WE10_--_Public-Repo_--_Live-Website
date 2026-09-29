// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT PDF
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Pdf__.js
// NAMESPACE  : Na__LeStmtPdf
// MODULE     : Layout Editor - Statement Writer - Pageless PDF
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Bake a statement into an endless-scroll A4 PDF that is a picture of the page, not text
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHY THIS EXPORTER IS DIFFERENT FROM EVERY OTHER ONE IN THE APP, and why
//   that is deliberate rather than a shortcut nobody got round to fixing:
//
//     The drawings, the drawing register and the project specification all
//     write REAL TEXT into their PDFs, with Open Sans embedded, because those
//     are documents people need to search, copy from and have read aloud.
//
//     A planning statement is not that kind of document. It is an argument,
//     written for a case officer to read and weigh, and text that lifts
//     cleanly out of a PDF is text that goes straight into a language model
//     to be summarised into three bullet points by somebody who was meant to
//     read it. So this exporter rasterises: the finished page is photographed
//     at print resolution and the photograph is what the PDF holds.
//
//     If a future change makes a statement PDF selectable, that is a change of
//     policy, made on purpose, and not a bug being fixed. The config block
//     carries the same note at LayoutEditor__Statement__PdfNote.
//
// - HOW IT WORKS, and where it came from. The method is
//   Py_PdfUtils__HtmlToPagelessPdfConverter's - render the page to a tall
//   image and put the image in a PDF at A4 width - carried into the browser,
//   the way PlanVision's Design and Access Statement viewer already carries
//   it. The page is captured in tiles well under any canvas limit, and the
//   tiles are laid onto very tall PDF pages up to the format's own 14399 pt
//   ceiling. A statement longer than that continues on a second tall page
//   rather than being shrunk, so the type stays the same size however long
//   the document runs.
// - IT CAPTURES A CLONE, NOT THE LIVE PAGE. The clone is put at the page
//   origin at true A4 width with its shadow off, so the tile arithmetic is
//   simple and the reader's own scroll and zoom are untouched.
// - TWO QUALITIES: full for the archive and for printing, compact for
//   emailing and for a planning portal with an upload limit.
//
// INTEGRATION:
// - Given the rendered statement element by the page; takes the reader's, so
//   what is exported is what was on screen.
// - jsPDF is the app's vendored build, loaded through the sheet exporter's own
//   loader. html2canvas is vendored beside it and loaded the same way.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : PlanVision DesignAccessStatement__HtmlViewer__ (18-Jul-2026),
//                   itself a browser port of Py_PdfUtils__HtmlToPagelessPdfConverter
// - Parity        : the tiling, the page cap and the two presets are the same
// - Divergences   : both libraries are vendored rather than fetched from a CDN,
//                   which is this app's rule; the config supplies the numbers;
//                   the progress is reported to the caller rather than written
//                   into a button's own label.
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.1.0
// - CLICKABLE LINKS. Every http(s) link on the page gets a link annotation
//   over the same spot in the PDF, so the TrueVision 3D Project Hub's button
//   and code (and any other link in a statement) open from a PDF viewer. Still
//   no text in the file.
// - FIGURE FRAMES AT ONE WEIGHT (Unzoom). Every framed picture in the copy is
//   pinned at its box with its zoom taken off, so its rule and shadow print as
//   the stylesheet sets them rather than scaled by its Typora zoom.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and the Vendored jsPDF Loader
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LePdf__LoadLibrary } from '../../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Paper
    // ------------------------------------------------------------
    const Na__LeStmtPdf__A4_WIDTH_PT = 210 / 25.4 * 72;                         // <-- 595.28, A4 across in points
    // ------------------------------------------------------------

    // MODULE VARIABLES | The html2canvas Injection Promise
    // ------------------------------------------------------------
    let Na__LeStmtPdf__LoadPromise = null;
    let Na__LeStmtPdf__Busy        = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Renderer
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Vendored html2canvas Once
    // ------------------------------------------------------------
    function Na__LeStmtPdf__LoadHtml2Canvas() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        if (Na__LeStmtPdf__LoadPromise) return Na__LeStmtPdf__LoadPromise;

        Na__LeStmtPdf__LoadPromise = new Promise((resolve, reject) => {
            const script   = document.createElement('script');
            script.src     = Na__LeCfg__GetStatementSetup().html2CanvasPath;
            script.async   = true;
            script.onload  = () => (window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas did not register')));
            script.onerror = () => reject(new Error('html2canvas failed to load from ' + script.src));
            document.head.appendChild(script);
        }).catch((error) => { Na__LeStmtPdf__LoadPromise = null; throw error; });

        return Na__LeStmtPdf__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wait Until Every Picture on the Page Has Arrived
    // ------------------------------------------------------------
    // A picture still loading rasterises as a blank rectangle, and the first
    // anyone would know of it is a client opening the PDF. So the export waits
    // - with a limit, because a picture that will never load must not stop the
    // rest of the document from being exported.
    // ------------------------------------------------------------
    function Na__LeStmtPdf__AwaitImages(element, limitMs) {
        const images = Array.from(element.querySelectorAll('img')).filter((image) => !image.complete);
        if (!images.length) return Promise.resolve(0);

        return Promise.race([
            Promise.all(images.map((image) => new Promise((resolve) => {
                image.addEventListener('load',  resolve, { once : true });
                image.addEventListener('error', resolve, { once : true });
            }))).then(() => images.length),
            new Promise((resolve) => window.setTimeout(() => resolve(-1), limitMs || 20000))
        ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Copy of the Page at the Origin, at True A4 Width
    // ------------------------------------------------------------
    // The live page sits inside a scrolling desk and may be shrunk to fit it.
    // The capture needs a copy at its true width, at the page origin, with the
    // paper shadow off - a shadow rasterises as a grey band down the edge of
    // every tile, which then prints as a seam.
    // ------------------------------------------------------------
    function Na__LeStmtPdf__BuildStage(element) {
        const stage = document.createElement('div');
        stage.style.position        = 'absolute';
        stage.style.top             = '0';
        stage.style.left            = '-10000px';                               // <-- Off screen, but really laid out
        stage.style.overflow        = 'hidden';
        stage.style.backgroundColor = '#ffffff';
        stage.style.zIndex          = '-1';

        const copy = element.cloneNode(true);
        copy.classList.add('is-capturing');
        copy.removeAttribute('contenteditable');
        for (const chrome of Array.from(copy.querySelectorAll('.na-le-stmt-frozen__tools, .na-le-stmt-figure__grip, .na-le-stmt-figure__readout, .na-le-stmt-frozen__raw'))) {
            chrome.remove();                                                    // <-- The editor's handles are not part of the document
        }
        copy.style.width    = '210mm';
        copy.style.maxWidth = '210mm';
        stage.appendChild(copy);
        document.body.appendChild(stage);

        const width = copy.getBoundingClientRect().width;
        stage.style.width = width + 'px';
        return { stage : stage, copy : copy, widthCss : width };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Zoom Off Every Framed Picture in the Copy
    // ------------------------------------------------------------
    // html2canvas lays a zoomed picture out at its zoomed size but draws its
    // border and shadow from the computed style, which Chrome reports
    // UNZOOMED - and after rounding the zoomed rule to whole device pixels,
    // so a thinner figure printed a heavier frame (measured 29-Sep-2026 at
    // 150% scaling: 0.53mm at zoom 30%, 1.06mm at zoom 15%). Each framed
    // picture is therefore pinned at exactly the box it already occupies and
    // its zoom set to one: nothing moves, and every frame prints the weight
    // the stylesheet gives it. Only the copy is touched, after its pictures
    // have loaded (the box depends on them).
    //
    // A CROPPED FIGURE'S FRAME IS LEFT ZOOMED: its picture is laid out in
    // millimetres inside that zoom, so unzooming the frame would uncrop it.
    // The stylesheet's is-capturing rule covers that one case.
    // ------------------------------------------------------------
    function Na__LeStmtPdf__Unzoom(copy) {
        const framed = Array.from(copy.querySelectorAll('img.na-figure'))
            .map((image) => ({ Image : image, Box : image.getBoundingClientRect(), Zoom : parseFloat(getComputedStyle(image).zoom) || 1 }))
            .filter((one) => Math.abs(one.Zoom - 1) > 0.0001 && one.Box.width > 0);

        for (const one of framed) {                                             // <-- Every box measured before any is changed
            one.Image.style.zoom      = '1';
            one.Image.style.boxSizing = 'border-box';
            one.Image.style.maxWidth  = 'none';
            one.Image.style.width     = one.Box.width  + 'px';
            one.Image.style.height    = one.Box.height + 'px';
            one.Image.style.setProperty('--na-figure-zoom', '1');
        }
        return framed.length;
    }
    // ------------------------------------------------------------

    // HELPER FUNCTION | Where Every Web Link on the Page Is
    // ------------------------------------------------------------
    // The PDF is a picture of the page, so a link in it is only a picture of
    // a link - until an annotation is laid over the same spot. That makes the
    // statement's links work in a PDF viewer without putting a word of text
    // into the file: the no-text rule is about text, and an annotation is a
    // rectangle and an address. Adam, 29-Sep-2026, on the TrueVision 3D
    // Project Hub: "seamlessly easy" to get from the statement to the model -
    // and a planning officer reads the PDF on a screen.
    //
    // Returns [{ x, y, w, h, url }] in CSS pixels from the copy's top left,
    // one per line box of a link that wraps. Only http and https addresses.
    // ------------------------------------------------------------
    function Na__LeStmtPdf__Links(copy) {
        const origin = copy.getBoundingClientRect();
        const found  = [];
        for (const anchor of Array.from(copy.querySelectorAll('a[href]'))) {
            const url = anchor.href;
            if (!/^https?:\/\//i.test(url)) continue;
            for (const box of Array.from(anchor.getClientRects())) {
                if (box.width < 1 || box.height < 1) continue;
                found.push({ x : box.left - origin.left, y : box.top - origin.top, w : box.width, h : box.height, url : url });
            }
        }
        return found;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Export
// -----------------------------------------------------------------------------

    // FUNCTION | Bake a Statement Into a Pageless A4 PDF and Hand It Over
    // ------------------------------------------------------------
    // element   the rendered statement (the reader's own page element)
    // options   { presetKey, fileName, onProgress, download }
    //
    // Resolves to { ok, blob, fileName, pages, error }. With download set it
    // also saves the file; without it the blob is the caller's, which is how
    // Publish puts the same PDF on the CDN.
    // ------------------------------------------------------------
    async function Na__LeStmtPdf__Build(element, options) {
        const opts  = options || {};
        const setup = Na__LeCfg__GetStatementSetup();
        const say   = (typeof opts.onProgress === 'function') ? opts.onProgress : () => {};

        if (Na__LeStmtPdf__Busy) return { ok : false, error : 'a statement is already being exported' };
        if (!element) return { ok : false, error : 'there is no statement on screen to be exported' };   // <-- Worded so no quote follows the word "export": the module graph verifier reads that pair as an import

        const preset = (setup.pdfPresets || []).find((one) => one.Key === (opts.presetKey || 'full'))
                    || (setup.pdfPresets || [])[0]
                    || { Key : 'full', RasterScale : 2, JpegQuality : 0.92, FileSuffix : '' };

        Na__LeStmtPdf__Busy = true;
        let built = null;

        try {
            say('Loading the renderer…', 0);
            const [ JsPdf ] = await Promise.all([ Na__LePdf__LoadLibrary(), Na__LeStmtPdf__LoadHtml2Canvas() ]);

            built = Na__LeStmtPdf__BuildStage(element);
            say('Waiting for the pictures…', 0.02);
            const waited = await Na__LeStmtPdf__AwaitImages(built.copy, setup.loadTimeoutMs);
            if (waited === -1) console.warn('[TrueVision3D] Statement Writer: some pictures had not loaded when the PDF was made.');
            Na__LeStmtPdf__Unzoom(built.copy);                                  // <-- Every frame prints at the stylesheet's weight, whatever its zoom

            const widthCss  = built.widthCss;
            const heightCss = built.copy.getBoundingClientRect().height;
            if (!widthCss || !heightCss) throw new Error('the statement measured as empty');
            const links     = Na__LeStmtPdf__Links(built.copy);                  // <-- Measured before the tiling moves the copy

            const ptPerCss  = Na__LeStmtPdf__A4_WIDTH_PT / widthCss;
            const pageMax   = Math.floor(setup.pdfMaxPagePt / ptPerCss);
            const pages     = [];
            for (let offset = 0; offset < heightCss; offset += pageMax) {
                pages.push(Math.min(pageMax, heightCss - offset));
            }

            const pdf = new JsPdf({
                orientation : 'portrait',
                unit        : 'pt',
                format      : [ Na__LeStmtPdf__A4_WIDTH_PT, pages[0] * ptPerCss ],
                compress    : true
            });

            const tileCss   = setup.pdfTileCssPx;
            const tileCount = Math.max(1, Math.ceil(heightCss / tileCss));
            let   done      = 0;
            let   pageTop   = 0;

            for (let index = 0; index < pages.length; index++) {
                const pageCss = pages[index];
                if (index > 0) pdf.addPage([ Na__LeStmtPdf__A4_WIDTH_PT, pageCss * ptPerCss ]);

                for (let top = 0; top < pageCss; top += tileCss) {
                    const slice = Math.min(tileCss, pageCss - top);

                    // THE TILE IS CUT BY MOVING THE COPY UP INSIDE A STAGE OF
                    // THE TILE'S HEIGHT, rather than by asking html2canvas for
                    // a window into a taller element, which it measures
                    // differently and which puts a half-pixel seam between
                    // every tile.
                    built.stage.style.height    = slice + 'px';
                    built.copy.style.marginTop  = '-' + (pageTop + top) + 'px';

                    const canvas = await window.html2canvas(built.stage, {
                        scale           : preset.RasterScale,
                        useCORS         : true,
                        backgroundColor : '#ffffff',
                        logging         : false,
                        windowWidth     : widthCss
                    });
                    if (!canvas.width || !canvas.height) throw new Error('a tile came back empty');

                    pdf.addImage(
                        canvas.toDataURL('image/jpeg', preset.JpegQuality), 'JPEG',
                        0, top * ptPerCss,
                        Na__LeStmtPdf__A4_WIDTH_PT, slice * ptPerCss
                    );

                    done += 1;
                    say('Baking the PDF…', Math.min(0.99, done / tileCount));
                }

                // THE LINKS ON THIS PAGE, clipped to it (a link across a page
                // break is clickable on both halves).
                if (typeof pdf.link === 'function') {
                    for (const link of links) {
                        const top    = Math.max(link.y, pageTop);
                        const bottom = Math.min(link.y + link.h, pageTop + pageCss);
                        if (bottom <= top) continue;
                        pdf.link(link.x * ptPerCss, (top - pageTop) * ptPerCss, link.w * ptPerCss, (bottom - top) * ptPerCss, { url : link.url });
                    }
                }
                pageTop += pageCss;
            }

            const fileName = (opts.fileName || 'Statement').replace(/[^A-Za-z0-9&_.-]+/g, '-') + (preset.FileSuffix || '') + '.pdf';
            const blob     = pdf.output('blob');
            if (opts.download !== false) pdf.save(fileName);

            say('Done.', 1);
            return { ok : true, blob : blob, fileName : fileName, pages : pages.length };

        } catch (error) {
            console.error('[TrueVision3D] Statement Writer: the PDF could not be made:', error);
            return { ok : false, error : (error && error.message) || 'unknown' };
        } finally {
            if (built && built.stage && built.stage.parentNode) built.stage.parentNode.removeChild(built.stage);
            Na__LeStmtPdf__Busy = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is an Export Already Running
    // ------------------------------------------------------------
    function Na__LeStmtPdf__IsBusy() { return Na__LeStmtPdf__Busy; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement PDF API
    // ------------------------------------------------------------
    export {
        Na__LeStmtPdf__Build,
        Na__LeStmtPdf__IsBusy,
        Na__LeStmtPdf__A4_WIDTH_PT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
