// =============================================================================
// NOBLE ARCHITECTURE - DESIGN ACCESS STATEMENT HTML VIEWER
// =============================================================================
//
// FILE       : DesignAccessStatement__HtmlViewer__.js
// NAMESPACE  : NaPlanVision.DesignAccessStatement.HtmlViewer
// MODULE     : DesignAccessStatementHtmlViewer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Crisp HTML rendering of Design & Access Statements (primary route)
// CREATED    : 18-Jul-2026
//
// DESCRIPTION:
// - Fetches the statement HTML built by ProjectVision__DasBuilder__.py
//   (CDN-first with live-site fallback) and injects it into the viewer
// - Resolves statement image URLs from the design-access-statement object
//   in PlanVision__ProjectData__.json (single source of truth for links)
// - Renders as an endless-scroll A4 document with selectable, crisp text
// - Downloads a pageless A4 PDF baked from the rendered HTML (mirrors the
//   Py_PdfUtils__HtmlToPagelessPdfConverter approach in browser JavaScript)
// - The legacy PDF.js canvas route remains the fallback when no HTML exists
//
// -----
//
// DEVELOPMENT LOG:
// 18-Jul-2026 - Version 1.0.0
// - Initial Stable Release
// - HTML fetch + inject, JSON-driven image resolution, JS pageless PDF export
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Design and Access Statement HTML Viewer
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Viewer and PDF Export Configuration
        // --------------------------------------------------------

            const HTML_MODE_CLASS                = 'na-das-mode--html';
            const A4_WIDTH_PT                    = 210 / 25.4 * 72;               // <-- 210mm in points
            const PDF_MAX_PAGE_PT                = 14399;                         // <-- Practical single dimension cap
            const PDF_RASTER_SCALE               = 2;                             // <-- Rasterisation quality multiplier
            const PDF_JPEG_QUALITY               = 0.95;

            // Pinned render/export libraries, lazy-loaded only when Download PDF is pressed
            const HTML2CANVAS_LIB_URL            = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            const JSPDF_LIB_URL                  = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Runtime State
        // --------------------------------------------------------

            let viewerRoot                       = null;
            let htmlHostEl                       = null;
            let htmlToolbarEl                    = null;
            let downloadBtn                      = null;
            let shareBtn                         = null;

            let loadingController                = null;
            let currentDasConfig                 = null;
            let fetchToken                       = 0;
            let exportInProgress                 = false;

            let domDisplayCache                  = {};

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPERS | App Element Visibility (Mirrors PDF Viewer Behaviour)
        // --------------------------------------------------------

            function Na__DasHtml__SetElementDisplayById(elementId, displayValue) {
                const element = document.getElementById(elementId);
                if (!element) return;

                if (domDisplayCache[elementId] === undefined) {
                    domDisplayCache[elementId] = element.style.display || '';
                }
                element.style.display = displayValue;
            }

            function Na__DasHtml__RestoreElementDisplayById(elementId) {
                const element = document.getElementById(elementId);
                if (!element) return;
                if (domDisplayCache[elementId] !== undefined) {
                    element.style.display = domDisplayCache[elementId];
                } else {
                    element.style.display = '';
                }
            }

            function Na__DasHtml__SetViewerVisibility(isVisible) {
                if (!viewerRoot) return;

                if (isVisible) {
                    viewerRoot.classList.add('is-visible');
                    viewerRoot.classList.add(HTML_MODE_CLASS);
                    Na__DasHtml__SetElementDisplayById('canvas-container', 'none');
                    Na__DasHtml__SetElementDisplayById('measurement-tools-panel-host', 'none');
                    Na__DasHtml__SetElementDisplayById('measurement-finish-host', 'none');
                    return;
                }

                viewerRoot.classList.remove(HTML_MODE_CLASS);
                viewerRoot.classList.remove('is-visible');
                Na__DasHtml__RestoreElementDisplayById('canvas-container');
                Na__DasHtml__RestoreElementDisplayById('measurement-tools-panel-host');
                Na__DasHtml__RestoreElementDisplayById('measurement-finish-host');
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // FETCHING | Statement HTML Retrieval (CDN First, Live + Local Fallback)
        // --------------------------------------------------------

            // HELPER FUNCTION | Build the Local-Dev Statement Base URL
            // Mirrors the app-wide local portal fallback so unsynced
            // statements still preview when running on localhost.
            // ------------------------------------------------------------
            function Na__DasHtml__BuildLocalBaseUrl(dasConfig) {
                const urlSystem = window.NaPlanVision && window.NaPlanVision.UrlQuerySystem;
                if (!urlSystem) return null;

                const context = urlSystem.getProjectContext({
                    defaultProjectCode   : null,
                    defaultProjectFolder : null
                });

                if (!context.isLocalDev || !context.projectContentBaseUrl) return null;
                if (!dasConfig['das-phase-folder'] || !dasConfig['das-statement-folder']) return null;

                return context.projectContentBaseUrl
                    + '/' + dasConfig['das-phase-folder']
                    + '/' + dasConfig['das-statement-folder'];
            }
            // ---------------------------------------------------------------

            // FUNCTION | Fetch the Statement HTML Text with CDN Priority
            // Order: CDN, live site, then local portal (local dev only)
            // ------------------------------------------------------------
            async function Na__DasHtml__FetchStatementHtml(dasConfig) {
                const links     = dasConfig['das-document-links'] || {};
                const localBase = Na__DasHtml__BuildLocalBaseUrl(dasConfig);
                const htmlFile  = dasConfig['das-html-file'];

                const candidateUrls = [
                    links['das-html-url--cdn'],
                    links['das-html-url--live'],
                    (localBase && htmlFile) ? localBase + '/' + encodeURIComponent(htmlFile) : null
                ].filter(Boolean);

                if (candidateUrls.length === 0) {
                    throw new Error('No statement HTML URL available');
                }

                let lastError = null;

                for (let i = 0; i < candidateUrls.length; i++) {
                    try {
                        const response = await fetch(candidateUrls[i]);
                        if (response.ok) {
                            console.log('[DasHtmlViewer] Statement HTML loaded from:', candidateUrls[i]);
                            return await response.text();
                        }
                        lastError = new Error('HTTP ' + response.status + ' for ' + candidateUrls[i]);
                        console.warn('[DasHtmlViewer] Fetch returned', response.status, '- trying next source');
                    } catch (fetchError) {
                        lastError = fetchError;
                        console.warn('[DasHtmlViewer] Fetch failed:', fetchError.message, '- trying next source');
                    }
                }

                throw lastError || new Error('Statement HTML could not be fetched');
            }
            // ---------------------------------------------------------------

            // FUNCTION | Extract the Document Article from the Fetched HTML
            // ------------------------------------------------------------
            function Na__DasHtml__ExtractDocumentContent(htmlText) {
                const parsed   = new DOMParser().parseFromString(htmlText, 'text/html');
                const article  = parsed.querySelector('.na_das_document');
                if (article) return article.innerHTML;
                return parsed.body ? parsed.body.innerHTML : htmlText;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // IMAGE RESOLUTION | JSON-Driven Statement Image Links
        // --------------------------------------------------------

            // FUNCTION | Rewrite Statement Image Sources to CDN URLs
            // The generated HTML carries statement-root-relative links; the
            // project JSON DAS object supplies the CDN + live base URLs so
            // images resolve regardless of where the app itself is hosted.
            // ------------------------------------------------------------
            function Na__DasHtml__ResolveImageSources(containerEl, dasConfig) {
                const links       = dasConfig['das-document-links'] || {};
                const imageConfig = dasConfig['das-image-files'] || {};
                const imageFolder = imageConfig['das-image-folder'] || '01__Statement__ImageFiles';
                const localBase   = Na__DasHtml__BuildLocalBaseUrl(dasConfig);

                // CDN first, then live site, then local portal (local dev only)
                const baseUrls = [
                    links['das-base-url--cdn'],
                    links['das-base-url--live'],
                    localBase
                ].filter(Boolean);

                if (baseUrls.length === 0) return;

                const images = containerEl.querySelectorAll('img');

                images.forEach(function (img) {
                    const rawSrc = img.getAttribute('src') || '';
                    if (/^(https?:)?\/\//i.test(rawSrc) || rawSrc.indexOf('data:') === 0) {
                        return;                                                    // <-- Absolute / inline sources untouched
                    }

                    const filename = decodeURIComponent(rawSrc.split('/').pop().split('?')[0] || '');
                    if (!filename) return;

                    const encodedName = encodeURIComponent(filename);
                    let baseIndex    = 0;

                    img.setAttribute('crossorigin', 'anonymous');                  // <-- Required for PDF rasterisation
                    img.onerror = function () {
                        baseIndex += 1;                                            // <-- Walk the fallback chain once each
                        if (baseIndex >= baseUrls.length) {
                            img.onerror = null;
                            return;
                        }
                        img.src = baseUrls[baseIndex] + '/' + imageFolder + '/' + encodedName;
                    };

                    img.src = baseUrls[0] + '/' + imageFolder + '/' + encodedName;
                });
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PDF EXPORT | Pageless A4 PDF Baked from the Rendered HTML
        // --------------------------------------------------------

            // HELPER FUNCTION | Lazy-Load an External Script Once
            // ------------------------------------------------------------
            function Na__DasHtml__LoadScriptOnce(url) {
                return new Promise(function (resolve, reject) {
                    if (document.querySelector('script[src="' + url + '"]')) {
                        resolve();
                        return;
                    }
                    const script   = document.createElement('script');
                    script.src     = url;
                    script.onload  = resolve;
                    script.onerror = function () { reject(new Error('Failed to load ' + url)); };
                    document.head.appendChild(script);
                });
            }
            // ---------------------------------------------------------------

            // FUNCTION | Generate and Download the Pageless A4 PDF
            // Mirrors Py_PdfUtils__HtmlToPagelessPdfConverter: the document is
            // rasterised at full height, then embedded on a single very tall
            // PDF page at A4 width (endless-scroll reading, print-safe cap).
            // ------------------------------------------------------------
            async function Na__DasHtml__DownloadPdf() {
                if (exportInProgress || !currentDasConfig || !htmlHostEl) return;

                const documentEl = htmlHostEl.querySelector('.na_das_document');
                const toast      = window.NaPlanVision && window.NaPlanVision.ToastNotification;

                if (!documentEl) {
                    if (toast) toast.Na__Toast__Show('No statement is loaded to export.', 'warning', 4000);
                    return;
                }

                exportInProgress = true;
                if (downloadBtn) downloadBtn.disabled = true;
                if (toast) toast.Na__Toast__Show('Preparing PDF download… this can take a moment.', 'info', 4000);

                try {
                    await Na__DasHtml__LoadScriptOnce(HTML2CANVAS_LIB_URL);
                    await Na__DasHtml__LoadScriptOnce(JSPDF_LIB_URL);

                    const rasterCanvas = await window.html2canvas(documentEl, {
                        scale           : PDF_RASTER_SCALE,
                        useCORS         : true,
                        backgroundColor : '#ffffff',
                        logging         : false
                    });

                    // Scale the raster onto a single A4-width pageless PDF page
                    let drawWidthPt  = A4_WIDTH_PT;
                    let drawHeightPt = rasterCanvas.height * (drawWidthPt / rasterCanvas.width);

                    if (drawHeightPt > PDF_MAX_PAGE_PT) {
                        const downscale = PDF_MAX_PAGE_PT / drawHeightPt;          // <-- Cap page height at viewer limits
                        drawWidthPt  *= downscale;
                        drawHeightPt  = PDF_MAX_PAGE_PT;
                    }

                    const JsPdfConstructor = window.jspdf.jsPDF;
                    const pdfDocument = new JsPdfConstructor({
                        orientation : 'portrait',
                        unit        : 'pt',
                        format      : [drawWidthPt, drawHeightPt]
                    });

                    const jpegData = rasterCanvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
                    pdfDocument.addImage(jpegData, 'JPEG', 0, 0, drawWidthPt, drawHeightPt);

                    const documentTitle = currentDasConfig['das-document-title'] || 'Design-and-Access-Statement';
                    pdfDocument.save(documentTitle.replace(/[^A-Za-z0-9&_-]+/g, '-') + '.pdf');

                    if (toast) toast.Na__Toast__Show('PDF downloaded.', 'success', 3000);
                } catch (error) {
                    console.error('[DasHtmlViewer] PDF export failed:', error);
                    if (toast) {
                        toast.Na__Toast__Show('PDF export failed — please try again.', 'warning', 5000);
                    }
                } finally {
                    exportInProgress = false;
                    if (downloadBtn) downloadBtn.disabled = false;
                }
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INTERACTION | Toolbar Controls
        // --------------------------------------------------------

            function Na__DasHtml__WireControls() {
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', Na__DasHtml__DownloadPdf);
                }

                if (shareBtn) {
                    shareBtn.addEventListener('click', function () {
                        const shareModule = window.NaPlanVision && window.NaPlanVision.DocumentShareLink;
                        if (shareModule && shareModule.Na__Share__CopyStatementLink) {
                            shareModule.Na__Share__CopyStatementLink();
                        }
                    });
                }
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Viewer Control Methods
        // --------------------------------------------------------

            // FUNCTION | Initialize the HTML Viewer Module
            // ------------------------------------------------------------
            const Na__DasHtml__Initialize = function () {
                viewerRoot    = document.getElementById('design-access-statement-viewer');
                htmlHostEl    = document.getElementById('design-access-statement-html-host');
                htmlToolbarEl = document.getElementById('design-access-statement-html-toolbar');
                downloadBtn   = document.getElementById('naDasHtmlDownloadBtn');
                shareBtn      = document.getElementById('naDasHtmlShareBtn');

                loadingController = window.NaPlanVision
                    && window.NaPlanVision.DesignAccessStatement
                    && window.NaPlanVision.DesignAccessStatement.Loading;

                Na__DasHtml__WireControls();
                console.log('[DasHtmlViewer] Initialized');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Check Whether the HTML Route is Available
            // ------------------------------------------------------------
            const Na__DasHtml__IsAvailable = function (dasConfig) {
                if (!dasConfig || dasConfig['das-enabled'] !== true) return false;
                if (!htmlHostEl) return false;

                const links = dasConfig['das-document-links'] || {};
                return Boolean(links['das-html-url--cdn'] || links['das-html-url--live']);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Fetch, Resolve, and Display the Statement HTML
            // ------------------------------------------------------------
            const Na__DasHtml__ShowStatement = async function (dasConfig) {
                if (!htmlHostEl) return;

                const thisFetchToken = ++fetchToken;
                currentDasConfig     = dasConfig || null;

                Na__DasHtml__SetViewerVisibility(true);
                htmlHostEl.innerHTML = '';

                if (loadingController && loadingController.Na__DasLoading__Begin) {
                    loadingController.Na__DasLoading__Begin('Loading Design and Access Statement...');
                }

                try {
                    const htmlText = await Na__DasHtml__FetchStatementHtml(dasConfig);
                    if (thisFetchToken !== fetchToken) return;                     // <-- Superseded by newer request

                    const article     = document.createElement('article');
                    article.className = 'na_das_document';
                    article.innerHTML = Na__DasHtml__ExtractDocumentContent(htmlText);

                    Na__DasHtml__ResolveImageSources(article, dasConfig);
                    htmlHostEl.appendChild(article);
                    htmlHostEl.scrollTop = 0;

                    if (loadingController && loadingController.Na__DasLoading__Complete) {
                        loadingController.Na__DasLoading__Complete('Document ready');
                    }
                    console.log('[DasHtmlViewer] Statement displayed:', dasConfig['das-html-file']);
                } catch (error) {
                    if (thisFetchToken !== fetchToken) return;
                    console.error('[DasHtmlViewer] Failed to load statement HTML:', error);
                    if (loadingController && loadingController.Na__DasLoading__Fail) {
                        loadingController.Na__DasLoading__Fail('Failed to load the Design and Access Statement.');
                    }
                    throw error;                                                   // <-- Lets the menu fall back to the PDF route
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide the HTML Viewer and Restore the App Canvas
            // ------------------------------------------------------------
            const Na__DasHtml__HideViewer = function () {
                ++fetchToken;
                currentDasConfig = null;
                if (htmlHostEl) htmlHostEl.innerHTML = '';
                Na__DasHtml__SetViewerVisibility(false);
                if (loadingController && loadingController.Na__DasLoading__Reset) {
                    loadingController.Na__DasLoading__Reset();
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Report Whether the HTML Viewer is Currently Active
            // ------------------------------------------------------------
            const Na__DasHtml__IsActive = function () {
                return Boolean(viewerRoot && viewerRoot.classList.contains(HTML_MODE_CLASS));
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DesignAccessStatement = window.NaPlanVision.DesignAccessStatement || {};
            window.NaPlanVision.DesignAccessStatement.HtmlViewer = {
                Na__DasHtml__Initialize             : Na__DasHtml__Initialize,
                Na__DasHtml__IsAvailable            : Na__DasHtml__IsAvailable,
                Na__DasHtml__ShowStatement          : Na__DasHtml__ShowStatement,
                Na__DasHtml__HideViewer             : Na__DasHtml__HideViewer,
                Na__DasHtml__IsActive               : Na__DasHtml__IsActive,
                Na__DasHtml__DownloadPdf            : Na__DasHtml__DownloadPdf
            };

            console.log('[DasHtmlViewer] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
