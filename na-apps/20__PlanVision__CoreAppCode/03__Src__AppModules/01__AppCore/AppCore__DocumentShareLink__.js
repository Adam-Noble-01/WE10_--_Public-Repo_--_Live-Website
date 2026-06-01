// =============================================================================
// NOBLE ARCHITECTURE - DOCUMENT SHARE LINK
// =============================================================================
//
// FILE       : AppCore__DocumentShareLink__.js
// NAMESPACE  : NaPlanVision.DocumentShareLink
// MODULE     : DocumentShareLink
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build and copy per-document share URLs; resolve deep-link on load
// CREATED    : 01-Jun-2026
//
// DESCRIPTION:
// - Extracts a short document code from a drawing file-name (e.g. BH03_T02_D01)
// - Builds a shareable absolute URL with &doc=<code> appended to current location
// - Copies the URL to the clipboard and shows a toast notification
// - On page load, reads the ?doc= param and auto-opens the matching document
// - Resolves drawings across Drawing, Specification, and Statement types
// - Feature-gated by AppConfiguration.Features.DocumentShareLink.enabled
//
// -----
//
// DEVELOPMENT LOG:
// 01-Jun-2026 - Version 1.0.0
// - Initial Stable Release
// - URL building, clipboard copy, deep-link resolution
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Document Share Link
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Query Parameter Key
        // --------------------------------------------------------

            const NaDocQueryKey__Default = 'doc';                             // <-- URL param key for drawing code

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Feature Flag
        // --------------------------------------------------------

            let featureEnabled = false;                                       // <-- Gated by app config

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Document Share Link Module
            // Reads feature flag from app config; safe to call before config loads
            // (openDeepLinkedDocument must be called after data is loaded)
            // ------------------------------------------------------------
            const Na__Share__Initialize = function (appConfig) {
                const featureConfig = appConfig?.AppConfig?.Features?.DocumentShareLink;
                featureEnabled      = featureConfig?.enabled === true;

                console.log('[DocumentShareLink] Initialized. Feature enabled:', featureEnabled);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPER FUNCTIONS | Code Extraction and URL Building
        // --------------------------------------------------------

            // FUNCTION | Extract Document Code from File-Name String
            // Mirrors the codePrefix logic in Loader__DrawingsDataManager__.js
            // Input:  "BH03_T02_D01__ProjectIntroduction__IsoA2__RevA__"
            // Output: "BH03_T02_D01"
            // ------------------------------------------------------------
            const Na__Share__ExtractDocCodeFromFilename = function (fileName) {
                if (!fileName || typeof fileName !== 'string') return '';

                const cleaned = fileName.replace(/_+$/, '');

                if (cleaned.indexOf('_-_') !== -1) {
                    return cleaned.split('_-_')[0] || '';
                }

                return cleaned.split('__')[0] || '';
            };
            // ---------------------------------------------------------------

            // FUNCTION | Build Share URL for a Given Document Code
            // Preserves all existing query parameters; replaces or adds &doc=
            // ------------------------------------------------------------
            const Na__Share__BuildShareUrlForCode = function (docCode) {
                const url    = new URL(window.location.href);
                url.searchParams.set(NaDocQueryKey__Default, docCode);
                return url.toString();
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // CLIPBOARD | Copy URL to Clipboard
        // --------------------------------------------------------

            // FUNCTION | Copy Text to Clipboard with Fallback
            // Primary: navigator.clipboard.writeText (modern browsers / HTTPS)
            // Fallback: textarea + document.execCommand (file:// / older browsers)
            // ------------------------------------------------------------
            function Na__Share__CopyTextToClipboard(text) {
                return new Promise(function (resolve, reject) {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(resolve).catch(function () {
                            fallbackCopy(text, resolve, reject);
                        });
                    } else {
                        fallbackCopy(text, resolve, reject);
                    }
                });
            }
            // ---------------------------------------------------------------

            // FUNCTION | Fallback Clipboard Copy Using Textarea
            // ------------------------------------------------------------
            function fallbackCopy(text, resolve, reject) {
                try {
                    const textarea        = document.createElement('textarea');
                    textarea.value        = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity  = '0';
                    textarea.style.top      = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);

                    if (success) {
                        resolve();
                    } else {
                        reject(new Error('execCommand copy returned false'));
                    }
                } catch (err) {
                    reject(err);
                }
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Share Current Document Link
        // --------------------------------------------------------

            // FUNCTION | Copy Share URL for Currently Displayed Drawing
            // Guards when no drawing is loaded or feature is disabled
            // ------------------------------------------------------------
            const Na__Share__CopyCurrentDocumentLink = function () {
                if (!featureEnabled) return;

                const drawingLoader = window.NaPlanVision
                    && window.NaPlanVision.DrawingsCanvas
                    && window.NaPlanVision.DrawingsCanvas.DrawingLoader;

                const toast = window.NaPlanVision && window.NaPlanVision.ToastNotification;

                if (!drawingLoader) {
                    console.warn('[DocumentShareLink] DrawingLoader not available');
                    return;
                }

                const drawing = drawingLoader.Na__Canvas__GetCurrentDrawing();

                if (!drawing) {
                    if (toast) {
                        toast.Na__Toast__Show(
                            'No drawing is currently open. Select a drawing first.',
                            'warning',
                            4000
                        );
                    }
                    return;
                }

                const docCode  = Na__Share__ExtractDocCodeFromFilename(drawing['file-name'] || '');

                if (!docCode) {
                    console.warn('[DocumentShareLink] Could not extract doc code from:', drawing['file-name']);
                    if (toast) {
                        toast.Na__Toast__Show('Could not generate a link for this document.', 'warning', 4000);
                    }
                    return;
                }

                const shareUrl = Na__Share__BuildShareUrlForCode(docCode);

                Na__Share__CopyTextToClipboard(shareUrl)
                    .then(function () {
                        console.log('[DocumentShareLink] Link copied:', shareUrl);
                        if (toast) {
                            toast.Na__Toast__Show(
                                'Document link copied to clipboard.',
                                'success',
                                3500
                            );
                        }
                    })
                    .catch(function (err) {
                        console.error('[DocumentShareLink] Clipboard copy failed:', err);
                        if (toast) {
                            toast.Na__Toast__Show(
                                'Could not copy to clipboard \u2014 please copy the URL manually.',
                                'warning',
                                5000
                            );
                        }
                    });
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // RESOLUTION | Find Drawing by Doc Code
        // --------------------------------------------------------

            // FUNCTION | Resolve a Drawing Object from a Doc Code String
            // Searches Drawing, Specification, and Statement flat lists
            // Returns { drawing, type } or null
            // ------------------------------------------------------------
            const Na__Share__ResolveDrawingByDocCode = function (docCode) {
                if (!docCode) return null;

                const dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                if (!dataManager) return null;

                const normalised = docCode.trim().toUpperCase();

                const types = ['Drawing', 'Specification'];

                for (var t = 0; t < types.length; t++) {
                    var list = dataManager.Na__Data__GetFlatDrawingsList(types[t]) || [];

                    for (var i = 0; i < list.length; i++) {
                        var code = Na__Share__ExtractDocCodeFromFilename(list[i]['file-name'] || '');
                        if (code.toUpperCase() === normalised) {
                            return { drawing: list[i], type: types[t] };
                        }
                    }
                }

                // Check statement documents (not in flat drawing/spec lists)
                var statementDocs = dataManager.Na__Data__GetDesignAccessStatementDocuments
                    ? dataManager.Na__Data__GetDesignAccessStatementDocuments()
                    : [];

                for (var s = 0; s < statementDocs.length; s++) {
                    var stmtCode = Na__Share__ExtractDocCodeFromFilename(statementDocs[s]['file-name'] || '');
                    if (stmtCode.toUpperCase() === normalised) {
                        return { drawing: statementDocs[s], type: 'DesignAccessStatement' };
                    }
                }

                return null;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // DEEP LINK | Auto-Open Document on Page Load
        // --------------------------------------------------------

            // FUNCTION | Open the Deep-Linked Document if Present in URL
            // Reads ?doc= from query params, resolves the drawing, opens the
            // correct submenu and loads the drawing. Falls back to register
            // and shows a warning toast when the code cannot be resolved.
            // Must be called AFTER data has been loaded and menus initialised.
            // ------------------------------------------------------------
            const Na__Share__OpenDeepLinkedDocumentIfPresent = function () {
                if (!featureEnabled) return;

                const urlSystem = window.NaPlanVision && window.NaPlanVision.UrlQuerySystem;
                if (!urlSystem) return;

                const queryParams = urlSystem.getProjectContext({}).queryParams || {};
                const docCode     = queryParams[NaDocQueryKey__Default];

                if (!docCode || typeof docCode !== 'string' || !docCode.trim()) return;

                console.log('[DocumentShareLink] Deep-link doc param found:', docCode);

                const resolved = Na__Share__ResolveDrawingByDocCode(docCode.trim());
                const toast    = window.NaPlanVision && window.NaPlanVision.ToastNotification;

                if (!resolved) {
                    console.warn('[DocumentShareLink] Could not resolve drawing for doc code:', docCode);
                    if (toast) {
                        toast.Na__Toast__Show(
                            'The shared document \u201C' + docCode + '\u201D could not be found.',
                            'warning',
                            6000
                        );
                    }
                    return;
                }

                console.log('[DocumentShareLink] Resolved drawing:', resolved.drawing['file-name'], '(type:', resolved.type + ')');

                const menuSystem = window.NaPlanVision
                    && window.NaPlanVision.UserInterface
                    && window.NaPlanVision.UserInterface.MenuSystem;

                if (resolved.type === 'DesignAccessStatement') {
                    if (menuSystem && menuSystem.Na__Menu__ShowDesignAccessStatement) {
                        menuSystem.Na__Menu__ShowDesignAccessStatement();
                    }
                    return;
                }

                if (menuSystem) {
                    if (resolved.type === 'Drawing') {
                        menuSystem.Na__Menu__ShowDrawingsMenu(resolved.drawing['file-name']);
                    } else if (resolved.type === 'Specification') {
                        menuSystem.Na__Menu__ShowSpecificationsMenu(resolved.drawing['file-name']);
                    }
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DocumentShareLink = {
                Na__Share__Initialize                       : Na__Share__Initialize,
                Na__Share__ExtractDocCodeFromFilename       : Na__Share__ExtractDocCodeFromFilename,
                Na__Share__BuildShareUrlForCode             : Na__Share__BuildShareUrlForCode,
                Na__Share__CopyCurrentDocumentLink          : Na__Share__CopyCurrentDocumentLink,
                Na__Share__ResolveDrawingByDocCode          : Na__Share__ResolveDrawingByDocCode,
                Na__Share__OpenDeepLinkedDocumentIfPresent  : Na__Share__OpenDeepLinkedDocumentIfPresent
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DocumentShareLink');
            }

            console.log('[DocumentShareLink] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
