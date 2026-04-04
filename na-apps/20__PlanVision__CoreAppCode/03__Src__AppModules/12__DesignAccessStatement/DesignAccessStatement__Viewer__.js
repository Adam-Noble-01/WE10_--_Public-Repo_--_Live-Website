// =============================================================================
// NOBLE ARCHITECTURE - DESIGN ACCESS STATEMENT VIEWER
// =============================================================================
//
// FILE       : DesignAccessStatement__Viewer__.js
// NAMESPACE  : NaPlanVision.DesignAccessStatement.Viewer
// MODULE     : DesignAccessStatementViewer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dedicated in-app PDF renderer for Design and Access Statements
// CREATED    : 04-Apr-2026
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Design and Access Statement Viewer
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONST | Viewer Configuration
        // --------------------------------------------------------

            const SCALE_STEP                     = 0.15;
            const SCALE_MIN                      = 0.50;
            const SCALE_MAX                      = 3.00;
            const DEFAULT_SCALE                  = 1.20;
            const PAGE_SCROLL_OFFSET_PX          = 12;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Runtime State
        // --------------------------------------------------------

            let viewerRoot                       = null;
            let statusEl                         = null;
            let canvasHostEl                     = null;
            let zoomInBtn                        = null;
            let zoomOutBtn                       = null;
            let fitWidthBtn                      = null;
            let pageJumpInput                    = null;
            let pageCountText                    = null;

            let renderToken                      = 0;
            let pdfDocument                      = null;
            let currentScale                     = DEFAULT_SCALE;
            let currentDocument                  = null;
            let cachedWorkerPath                 = '';
            let loadingController                = null;

            let domDisplayCache                  = {};

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPERS | DOM and Status Utilities
        // --------------------------------------------------------

            function Na__Das__SetStatus(message, mode) {
                if (!statusEl) return;
                statusEl.textContent = message || '';
                statusEl.classList.remove('na-das-status--loading', 'na-das-status--error', 'na-das-status--ready');
                if (mode === 'loading') statusEl.classList.add('na-das-status--loading');
                if (mode === 'error')   statusEl.classList.add('na-das-status--error');
                if (mode === 'ready')   statusEl.classList.add('na-das-status--ready');
            }

            function Na__Das__ClampScale(scaleValue) {
                if (scaleValue < SCALE_MIN) return SCALE_MIN;
                if (scaleValue > SCALE_MAX) return SCALE_MAX;
                return scaleValue;
            }

            function Na__Das__SetElementDisplayById(elementId, displayValue) {
                const element = document.getElementById(elementId);
                if (!element) return;

                if (domDisplayCache[elementId] === undefined) {
                    domDisplayCache[elementId] = element.style.display || '';
                }
                element.style.display = displayValue;
            }

            function Na__Das__RestoreElementDisplayById(elementId) {
                const element = document.getElementById(elementId);
                if (!element) return;
                if (domDisplayCache[elementId] !== undefined) {
                    element.style.display = domDisplayCache[elementId];
                } else {
                    element.style.display = '';
                }
            }

            function Na__Das__SetViewerVisibility(isVisible) {
                if (!viewerRoot) return;

                if (isVisible) {
                    viewerRoot.classList.add('is-visible');
                    Na__Das__SetElementDisplayById('canvas-container', 'none');
                    Na__Das__SetElementDisplayById('measurement-tools-panel-host', 'none');
                    Na__Das__SetElementDisplayById('measurement-finish-host', 'none');
                    return;
                }

                viewerRoot.classList.remove('is-visible');
                Na__Das__RestoreElementDisplayById('canvas-container');
                Na__Das__RestoreElementDisplayById('measurement-tools-panel-host');
                Na__Das__RestoreElementDisplayById('measurement-finish-host');
            }

            function Na__Das__SetCanvasVisibility(isVisible) {
                if (!canvasHostEl) return;
                canvasHostEl.style.visibility = isVisible ? 'visible' : 'hidden';
            }

            function Na__Das__ConfigurePdfWorker(workerPath) {
                if (!window.pdfjsLib || !window.pdfjsLib.GlobalWorkerOptions) return;
                if (!workerPath) return;
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
                cachedWorkerPath = workerPath;
            }

            function Na__Das__ClearCanvasHost() {
                if (!canvasHostEl) return;
                canvasHostEl.innerHTML = '';
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // RENDERING | PDF to Canvas Rendering
        // --------------------------------------------------------

            async function Na__Das__RenderPage(pageNumber, activeToken) {
                if (!pdfDocument || activeToken !== renderToken) return;

                const page = await pdfDocument.getPage(pageNumber);
                if (activeToken !== renderToken) return;

                const viewport = page.getViewport({ scale: currentScale });
                const pageWrapper = document.createElement('div');
                pageWrapper.className = 'na-das-page-wrapper';
                pageWrapper.setAttribute('data-page-number', String(pageNumber));

                const canvas = document.createElement('canvas');
                canvas.className = 'na-das-page-canvas';
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';

                pageWrapper.appendChild(canvas);
                canvasHostEl.appendChild(pageWrapper);

                const context = canvas.getContext('2d', { alpha: false });
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
            }

            async function Na__Das__RenderAllPages(pdfUrl) {
                if (!window.pdfjsLib) {
                    if (loadingController && loadingController.Na__DasLoading__Fail) {
                        loadingController.Na__DasLoading__Fail('PDF rendering library failed to load.');
                    } else {
                        Na__Das__SetStatus('PDF rendering library failed to load.', 'error');
                    }
                    return;
                }

                const thisRenderToken = ++renderToken;
                Na__Das__SetCanvasVisibility(false);
                Na__Das__ClearCanvasHost();
                if (loadingController && loadingController.Na__DasLoading__Begin) {
                    loadingController.Na__DasLoading__Begin('Loading Design and Access Statement...');
                } else {
                    Na__Das__SetStatus('Loading Design and Access Statement...', 'loading');
                }

                try {
                    const loadingTask = window.pdfjsLib.getDocument({ url: pdfUrl });
                    const loadedPdf = await loadingTask.promise;
                    if (thisRenderToken !== renderToken) return;

                    pdfDocument = loadedPdf;
                    if (pageCountText) {
                        pageCountText.textContent = '/ ' + String(pdfDocument.numPages);
                    }

                    for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex++) {
                        await Na__Das__RenderPage(pageIndex, thisRenderToken);
                        if (loadingController && loadingController.Na__DasLoading__UpdateProgress) {
                            loadingController.Na__DasLoading__UpdateProgress(pageIndex, pdfDocument.numPages);
                        }
                    }

                    if (thisRenderToken !== renderToken) return;
                    Na__Das__SetCanvasVisibility(true);
                    if (loadingController && loadingController.Na__DasLoading__Complete) {
                        loadingController.Na__DasLoading__Complete('Document ready');
                    } else {
                        Na__Das__SetStatus('Document ready', 'ready');
                    }

                    if (pageJumpInput) {
                        pageJumpInput.value = '1';
                    }
                } catch (error) {
                    console.error('[DesignAccessStatementViewer] PDF render error:', error);
                    Na__Das__SetCanvasVisibility(false);
                    if (loadingController && loadingController.Na__DasLoading__Fail) {
                        loadingController.Na__DasLoading__Fail('Failed to render PDF document.');
                    } else {
                        Na__Das__SetStatus('Failed to render PDF document.', 'error');
                    }
                }
            }

            function Na__Das__RerenderCurrentDocument() {
                const pdfUrl = currentDocument
                    && currentDocument['document-links']
                    && currentDocument['document-links']['pdf--github-link-url'];
                if (!pdfUrl) return;
                Na__Das__RenderAllPages(pdfUrl);
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INTERACTION | Controls and Navigation
        // --------------------------------------------------------

            function Na__Das__ZoomIn() {
                currentScale = Na__Das__ClampScale(currentScale + SCALE_STEP);
                Na__Das__RerenderCurrentDocument();
            }

            function Na__Das__ZoomOut() {
                currentScale = Na__Das__ClampScale(currentScale - SCALE_STEP);
                Na__Das__RerenderCurrentDocument();
            }

            async function Na__Das__FitWidth() {
                if (!pdfDocument || !canvasHostEl) return;
                try {
                    const firstPage = await pdfDocument.getPage(1);
                    const baseViewport = firstPage.getViewport({ scale: 1 });
                    const availableWidth = Math.max(canvasHostEl.clientWidth - 40, 320);
                    currentScale = Na__Das__ClampScale(availableWidth / baseViewport.width);
                    Na__Das__RerenderCurrentDocument();
                } catch (error) {
                    console.error('[DesignAccessStatementViewer] Fit width failed:', error);
                }
            }

            function Na__Das__JumpToPage(pageNumber) {
                if (!canvasHostEl) return;
                const targetPage = canvasHostEl.querySelector('[data-page-number="' + String(pageNumber) + '"]');
                if (!targetPage) return;

                const targetTop = targetPage.offsetTop - PAGE_SCROLL_OFFSET_PX;
                canvasHostEl.scrollTo({
                    top: Math.max(targetTop, 0),
                    behavior: 'smooth'
                });
            }

            function Na__Das__WireControls() {
                if (zoomInBtn) {
                    zoomInBtn.addEventListener('click', Na__Das__ZoomIn);
                }

                if (zoomOutBtn) {
                    zoomOutBtn.addEventListener('click', Na__Das__ZoomOut);
                }

                if (fitWidthBtn) {
                    fitWidthBtn.addEventListener('click', Na__Das__FitWidth);
                }

                if (pageJumpInput) {
                    pageJumpInput.addEventListener('change', function () {
                        if (!pdfDocument) return;
                        let requestedPage = parseInt(pageJumpInput.value, 10);
                        if (!Number.isFinite(requestedPage)) requestedPage = 1;
                        if (requestedPage < 1) requestedPage = 1;
                        if (requestedPage > pdfDocument.numPages) requestedPage = pdfDocument.numPages;
                        pageJumpInput.value = String(requestedPage);
                        Na__Das__JumpToPage(requestedPage);
                    });
                }
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Viewer Control Methods
        // --------------------------------------------------------

            const Na__Das__Initialize = function (config) {
                viewerRoot = document.getElementById('design-access-statement-viewer');
                statusEl = document.getElementById('design-access-statement-status');
                canvasHostEl = document.getElementById('design-access-statement-canvas-host');
                zoomInBtn = document.getElementById('naDasZoomInBtn');
                zoomOutBtn = document.getElementById('naDasZoomOutBtn');
                fitWidthBtn = document.getElementById('naDasFitWidthBtn');
                pageJumpInput = document.getElementById('naDasPageJumpInput');
                pageCountText = document.getElementById('naDasPageCountText');

                const workerPath = config && config.workerPath ? config.workerPath : '';
                Na__Das__ConfigurePdfWorker(workerPath);
                Na__Das__WireControls();
                Na__Das__SetViewerVisibility(false);
                Na__Das__SetCanvasVisibility(true);

                loadingController = window.NaPlanVision
                    && window.NaPlanVision.DesignAccessStatement
                    && window.NaPlanVision.DesignAccessStatement.Loading;

                if (loadingController && loadingController.Na__DasLoading__Initialize) {
                    loadingController.Na__DasLoading__Initialize({
                        statusElement: statusEl
                    });
                }

                console.log('[DesignAccessStatementViewer] Initialized');
            };

            const Na__Das__ShowDocument = function (statementDocument) {
                const pdfUrl = statementDocument
                    && statementDocument['document-links']
                    && statementDocument['document-links']['pdf--github-link-url'];

                currentDocument = statementDocument || null;
                currentScale = DEFAULT_SCALE;

                Na__Das__SetViewerVisibility(true);

                if (!pdfUrl) {
                    Na__Das__SetCanvasVisibility(false);
                    Na__Das__ClearCanvasHost();
                    if (pageCountText) pageCountText.textContent = '/ 0';
                    if (loadingController && loadingController.Na__DasLoading__Fail) {
                        loadingController.Na__DasLoading__Fail('Design and Access Statement PDF URL is missing.');
                    } else {
                        Na__Das__SetStatus('Design and Access Statement PDF URL is missing.', 'error');
                    }
                    return;
                }

                if (cachedWorkerPath) {
                    Na__Das__ConfigurePdfWorker(cachedWorkerPath);
                }

                Na__Das__RenderAllPages(pdfUrl);
            };

            const Na__Das__ShowEmptyState = function (message) {
                currentDocument = null;
                pdfDocument = null;
                Na__Das__SetViewerVisibility(true);
                Na__Das__SetCanvasVisibility(false);
                Na__Das__ClearCanvasHost();
                if (pageCountText) pageCountText.textContent = '/ 0';
                if (loadingController && loadingController.Na__DasLoading__Fail) {
                    loadingController.Na__DasLoading__Fail(message || 'No document available.');
                } else {
                    Na__Das__SetStatus(message || 'No document available.', 'error');
                }
            };

            const Na__Das__HideViewer = function () {
                ++renderToken;
                Na__Das__SetViewerVisibility(false);
                Na__Das__SetCanvasVisibility(true);
                if (loadingController && loadingController.Na__DasLoading__Reset) {
                    loadingController.Na__DasLoading__Reset();
                } else {
                    Na__Das__SetStatus('', 'ready');
                }
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DesignAccessStatement = window.NaPlanVision.DesignAccessStatement || {};
            window.NaPlanVision.DesignAccessStatement.Viewer = {
                Na__Das__Initialize                 : Na__Das__Initialize,
                Na__Das__ShowDocument               : Na__Das__ShowDocument,
                Na__Das__ShowEmptyState             : Na__Das__ShowEmptyState,
                Na__Das__HideViewer                 : Na__Das__HideViewer
            };

            console.log('[DesignAccessStatementViewer] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
