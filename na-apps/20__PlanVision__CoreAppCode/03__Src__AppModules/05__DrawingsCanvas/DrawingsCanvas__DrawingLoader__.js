// =============================================================================
// NOBLE ARCHITECTURE - CANVAS DRAWING LOADER
// =============================================================================
//
// FILE       : DrawingsCanvas__DrawingLoader__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.DrawingLoader
// MODULE     : DrawingLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Image loading, display, and download management for drawings
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Loads drawing images asynchronously
// - Manages drawing metadata (scale, size, dimensions)
// - Transforms URLs for local development
// - Integrates with loading states and error handling
// - Delegates PDF download management to DocumentSystem.PdfGenerator
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Centralized drawing loading logic
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Canvas Drawing Loader
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let planImage                      = null;
            let showLoadingCallback            = null;
            let hideLoadingCallback            = null;
            let displayErrorCallback           = null;
            let setImageStateCallback          = null;
            let resetViewCallback              = null;
            let isLocalDev                     = false;
            let projectFolderName              = '';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Drawing Loader
            // ------------------------------------------------------------
            const Na__Canvas__Initialize = function (context) {
                console.log('[DrawingLoader] Initializing...');

                // Store references
                if (context) {
                    planImage = context.planImage;
                    showLoadingCallback = context.showLoading;
                    hideLoadingCallback = context.hideLoading;
                    displayErrorCallback = context.displayError;
                    setImageStateCallback = context.setImageState;
                    resetViewCallback = context.resetView;
                }

                // Detect environment
                isLocalDev = window.location.hostname === '127.0.0.1' ||
                             window.location.hostname === 'localhost' ||
                             window.location.protocol === 'file:';

                // Get project folder from URL query system if available
                if (window.NaPlanVision && window.NaPlanVision.UrlQuerySystem) {
                    const context = window.NaPlanVision.UrlQuerySystem.getProjectContext({
                        defaultProjectFolder: 'JH03__RomerCottage'
                    });
                    projectFolderName = context.projectFolder || 'JH03__RomerCottage';
                } else {
                    projectFolderName = 'JH03__RomerCottage';
                }

                if (!planImage) {
                    console.error('[DrawingLoader] planImage reference is required');
                }

                console.log('[DrawingLoader] Initialized successfully');
                console.log('[DrawingLoader] Environment:', isLocalDev ? 'LOCAL' : 'PRODUCTION');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // URL TRANSFORMATION | Local Development Support
        // --------------------------------------------------------

            // FUNCTION | Transform Production URLs to Local Paths
            // ------------------------------------------------------------
            function transformUrl(url) {
                if (!isLocalDev || !url) return url;

                // Extract the path after project folder
                const projectPath = `${projectFolderName}/`;
                const pathIndex = url.indexOf(projectPath);

                if (pathIndex !== -1) {
                    const localPath = url.substring(pathIndex + projectPath.length);
                    const baseUrl = window.NaPlanVision?.UrlQuerySystem
                        ? window.NaPlanVision.UrlQuerySystem.getProjectContext({}).projectBaseUrl
                        : `../na-project-portal/25-Projects/${projectFolderName}`;
                    const fullLocalUrl = `${baseUrl}/${localPath}`;
                    console.log(`[DrawingLoader] URL Transform: ${url} → ${fullLocalUrl}`);
                    return fullLocalUrl;
                }

                return url;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // IMAGE LOADING | Async Drawing Load
        // --------------------------------------------------------

            // FUNCTION | Load Drawing Image and Metadata
            // ------------------------------------------------------------
            const Na__Canvas__LoadDrawing = async function (drawing) {
                if (showLoadingCallback) {
                    showLoadingCallback();
                }

                try {
                    // Get URLs and transform for local development if needed
                    const pngUrl = transformUrl(drawing['document-links']['png--github-link-url']);
                    const pdfUrl = transformUrl(drawing['document-links']['pdf--github-link-url']);
                    const documentName = drawing['document-name'];
                    const documentScale = drawing['document-scale'];
                    const documentSize = drawing['document-size'];

                    // Store drawing metadata via callback
                    if (setImageStateCallback) {
                        setImageStateCallback({
                            currentDrawingScale: documentScale || '1:50',
                            currentDrawingSize: documentSize || 'A1'
                        });
                    }

                    // Hide any previous error message before loading
                    if (window.NaPlanVision.DrawingsCanvas && window.NaPlanVision.DrawingsCanvas.LoadingStates) {
                        window.NaPlanVision.DrawingsCanvas.LoadingStates.Na__Canvas__HideError();
                    }

                    // Hide Drawing Register if visible (user selected a drawing)
                    if (window.NaPlanVision.LandingPage && window.NaPlanVision.LandingPage.Na__Landing__IsVisible()) {
                        window.NaPlanVision.LandingPage.Na__Landing__Hide();
                    }

                    // Load the plan image
                    await loadPlanImage(pngUrl);

                    // Update image loaded state
                    if (setImageStateCallback) {
                        setImageStateCallback({
                            isImageLoaded: true
                        });
                    }

                    // Reset view to fit new drawing
                    if (resetViewCallback) {
                        resetViewCallback();
                    }

                    // Update PDF download link via DocumentSystem module
                    if (window.NaPlanVision.DocumentSystem?.PdfGenerator) {
                        window.NaPlanVision.DocumentSystem.PdfGenerator.Na__Pdf__UpdateDownloadLink(pdfUrl, documentName);
                    }

                    console.log('[DrawingLoader] Drawing loaded successfully:', documentName);

                } catch (error) {
                    console.error('[DrawingLoader] Error loading drawing:', error);
                    if (displayErrorCallback) {
                        displayErrorCallback('Failed to load the selected drawing.');
                    }
                } finally {
                    if (hideLoadingCallback) {
                        hideLoadingCallback();
                    }
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Load Plan Image Asynchronously
            // ------------------------------------------------------------
            function loadPlanImage(url) {
                return new Promise((resolve, reject) => {
                    planImage.onload = () => {
                        // Store natural dimensions via callback
                        if (setImageStateCallback) {
                            setImageStateCallback({
                                naturalImageWidth: planImage.naturalWidth,
                                naturalImageHeight: planImage.naturalHeight
                            });
                        }
                        console.log('[DrawingLoader] Image loaded:', url);
                        console.log('[DrawingLoader] Dimensions:', planImage.naturalWidth, 'x', planImage.naturalHeight);
                        resolve();
                    };
                    planImage.onerror = () => {
                        reject(new Error('Failed to load plan image: ' + url));
                    };
                    planImage.src = url;
                });
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------


        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.DrawingLoader = {
                Na__Canvas__Initialize     : Na__Canvas__Initialize,
                Na__Canvas__LoadDrawing    : Na__Canvas__LoadDrawing
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DrawingLoader');
            }

            console.log('[DrawingLoader] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
