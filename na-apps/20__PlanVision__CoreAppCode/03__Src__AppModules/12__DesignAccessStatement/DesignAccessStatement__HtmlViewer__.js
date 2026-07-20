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
            const PDF_MAX_PAGE_PT                = 14399;                         // <-- PDF format cap per page dimension
            const PDF_TILE_CSS_HEIGHT            = 4000;                          // <-- Capture tile height (CSS px); keeps every canvas well under browser limits

            // Export quality presets: 'full' for archive/print quality, 'compact'
            // renders at lower resolution with stronger JPEG compression for a
            // much smaller file suited to emailing and portal upload limits.
            const PDF_EXPORT_PRESETS             = {
                'full'    : { rasterScale: 2.00, jpegQuality: 0.92, fileSuffix: '' },
                'compact' : { rasterScale: 1.25, jpegQuality: 0.75, fileSuffix: '__Compact' }
            };

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
            let downloadCompactBtn               = null;
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

            // HELPER FUNCTION | Build the Off-Screen Capture Stage
            // The live document sits inside a scrollable host, so it is cloned
            // into a fixed-width stage at the page origin. Tiles are captured
            // by cropping the stage with overflow:hidden + a negative margin.
            // ------------------------------------------------------------
            function Na__DasHtml__BuildCaptureStage(documentEl) {
                const docWidthCss = documentEl.offsetWidth;

                const stage                 = document.createElement('div');
                stage.style.position        = 'absolute';
                stage.style.top             = '0';
                stage.style.left            = '-10000px';                          // <-- Off-screen but fully rendered
                stage.style.width           = docWidthCss + 'px';
                stage.style.overflow        = 'hidden';
                stage.style.backgroundColor = '#ffffff';

                const inner = documentEl.cloneNode(true);
                inner.style.margin    = '0';                                       // <-- Content must start at stage origin for tile maths
                inner.style.boxShadow = 'none';                                    // <-- No paper shadow bleed in the print capture
                inner.style.width     = docWidthCss + 'px';
                inner.style.maxWidth  = docWidthCss + 'px';

                stage.appendChild(inner);
                document.body.appendChild(stage);

                return { stage: stage, inner: inner, docWidthCss: docWidthCss };
            }
            // ---------------------------------------------------------------

            // FUNCTION | Generate and Download the Pageless A4 PDF
            // Endless-scroll output at FULL A4 width: the document is captured
            // in canvas-safe tiles and assembled onto sequential very tall PDF
            // pages, each up to the 14399pt PDF format cap (about five metres
            // of continuous scroll per page). Long statements therefore span a
            // handful of tall pages instead of being downscaled to fit one.
            // presetKey selects 'full' (default) or 'compact' export quality.
            // ------------------------------------------------------------
            async function Na__DasHtml__DownloadPdf(presetKey) {
                if (exportInProgress || !currentDasConfig || !htmlHostEl) return;

                const preset     = PDF_EXPORT_PRESETS[presetKey] || PDF_EXPORT_PRESETS['full'];
                const activeBtn  = (presetKey === 'compact') ? downloadCompactBtn : downloadBtn;
                const documentEl = htmlHostEl.querySelector('.na_das_document');
                const toast      = window.NaPlanVision && window.NaPlanVision.ToastNotification;

                if (!documentEl) {
                    if (toast) toast.Na__Toast__Show('No statement is loaded to export.', 'warning', 4000);
                    return;
                }

                exportInProgress = true;
                const activeBtnLabel = activeBtn ? activeBtn.textContent : '';
                if (downloadBtn) downloadBtn.disabled = true;                      // <-- Lock both buttons for the duration
                if (downloadCompactBtn) downloadCompactBtn.disabled = true;
                if (toast) toast.Na__Toast__Show('Preparing PDF download… this can take a minute for long statements.', 'info', 5000);

                let captureStage = null;

                try {
                    await Na__DasHtml__LoadScriptOnce(HTML2CANVAS_LIB_URL);
                    await Na__DasHtml__LoadScriptOnce(JSPDF_LIB_URL);

                    captureStage = Na__DasHtml__BuildCaptureStage(documentEl);
                    const docWidthCss  = captureStage.docWidthCss;
                    const docHeightCss = captureStage.inner.offsetHeight;
                    const ptPerCssPx   = A4_WIDTH_PT / docWidthCss;

                    // Group the document into tall pages capped at the PDF limit
                    const pageMaxCss = Math.floor(PDF_MAX_PAGE_PT / ptPerCssPx);
                    const pageHeightsCss = [];
                    for (let offset = 0; offset < docHeightCss; offset += pageMaxCss) {
                        pageHeightsCss.push(Math.min(pageMaxCss, docHeightCss - offset));
                    }

                    const JsPdfConstructor = window.jspdf.jsPDF;
                    const pdfDocument = new JsPdfConstructor({
                        orientation : 'portrait',
                        unit        : 'pt',
                        format      : [A4_WIDTH_PT, pageHeightsCss[0] * ptPerCssPx],
                        compress    : true
                    });

                    let pageStartCss = 0;
                    const totalTiles = Math.ceil(docHeightCss / PDF_TILE_CSS_HEIGHT);
                    let doneTiles    = 0;

                    for (let pageIndex = 0; pageIndex < pageHeightsCss.length; pageIndex++) {
                        const pageCss = pageHeightsCss[pageIndex];
                        if (pageIndex > 0) {
                            pdfDocument.addPage([A4_WIDTH_PT, pageCss * ptPerCssPx]);
                        }

                        // Capture this page as a run of canvas-safe tiles
                        for (let tileTopCss = 0; tileTopCss < pageCss; tileTopCss += PDF_TILE_CSS_HEIGHT) {
                            const tileCss = Math.min(PDF_TILE_CSS_HEIGHT, pageCss - tileTopCss);

                            captureStage.stage.style.height          = tileCss + 'px';
                            captureStage.inner.style.marginTop       = '-' + (pageStartCss + tileTopCss) + 'px';

                            const tileCanvas = await window.html2canvas(captureStage.stage, {
                                scale           : preset.rasterScale,
                                useCORS         : true,
                                backgroundColor : '#ffffff',
                                logging         : false,
                                windowWidth     : docWidthCss
                            });

                            if (!tileCanvas.width || !tileCanvas.height) {
                                throw new Error('Tile capture produced an empty canvas');
                            }

                            pdfDocument.addImage(
                                tileCanvas.toDataURL('image/jpeg', preset.jpegQuality), 'JPEG',
                                0, tileTopCss * ptPerCssPx,
                                A4_WIDTH_PT, tileCss * ptPerCssPx
                            );

                            doneTiles += 1;
                            if (activeBtn) {
                                activeBtn.textContent = 'Preparing PDF… ' +
                                    Math.round((doneTiles / totalTiles) * 100) + '%';
                            }
                        }

                        pageStartCss += pageCss;
                    }

                    const documentTitle = currentDasConfig['das-document-title'] || 'Design-and-Access-Statement';
                    pdfDocument.save(documentTitle.replace(/[^A-Za-z0-9&_-]+/g, '-') + preset.fileSuffix + '.pdf');

                    if (toast) toast.Na__Toast__Show('PDF downloaded.', 'success', 3000);
                } catch (error) {
                    console.error('[DasHtmlViewer] PDF export failed:', error);
                    if (toast) {
                        toast.Na__Toast__Show('PDF export failed — please try again.', 'warning', 5000);
                    }
                } finally {
                    if (captureStage && captureStage.stage && captureStage.stage.parentNode) {
                        captureStage.stage.parentNode.removeChild(captureStage.stage);
                    }
                    exportInProgress = false;
                    if (downloadBtn) downloadBtn.disabled = false;
                    if (downloadCompactBtn) downloadCompactBtn.disabled = false;
                    if (activeBtn) activeBtn.textContent = activeBtnLabel;
                }
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INTERACTION | Toolbar Controls
        // --------------------------------------------------------

            function Na__DasHtml__WireControls() {
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', function () {
                        Na__DasHtml__DownloadPdf('full');
                    });
                }

                if (downloadCompactBtn) {
                    downloadCompactBtn.addEventListener('click', function () {
                        Na__DasHtml__DownloadPdf('compact');
                    });
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
                viewerRoot         = document.getElementById('design-access-statement-viewer');
                htmlHostEl         = document.getElementById('design-access-statement-html-host');
                htmlToolbarEl      = document.getElementById('design-access-statement-html-toolbar');
                downloadBtn        = document.getElementById('naDasHtmlDownloadBtn');
                downloadCompactBtn = document.getElementById('naDasHtmlDownloadCompactBtn');
                shareBtn           = document.getElementById('naDasHtmlShareBtn');

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
