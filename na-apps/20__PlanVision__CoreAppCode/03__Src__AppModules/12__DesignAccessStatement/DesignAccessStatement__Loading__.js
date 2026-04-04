// =============================================================================
// NOBLE ARCHITECTURE - DESIGN ACCESS STATEMENT LOADING CONTROLLER
// =============================================================================
//
// FILE       : DesignAccessStatement__Loading__.js
// NAMESPACE  : NaPlanVision.DesignAccessStatement.Loading
// MODULE     : DesignAccessStatementLoading
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Reuse existing PlanVision loading overlay for DAS PDF rendering
// CREATED    : 04-Apr-2026
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Design and Access Statement Loading Controller
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Loading Controller State
        // --------------------------------------------------------

            let statusElement                    = null;
            let loadingStatesModule              = null;
            let isLoadingActive                  = false;
            let showStatusMessages               = true;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPERS | Loading Overlay and Status Helpers
        // --------------------------------------------------------

            function Na__DasLoading__GetLoadingStatesModule() {
                if (!loadingStatesModule) {
                    loadingStatesModule = window.NaPlanVision
                        && window.NaPlanVision.DrawingsCanvas
                        && window.NaPlanVision.DrawingsCanvas.LoadingStates;
                }
                return loadingStatesModule;
            }

            function Na__DasLoading__IsLocalDevelopment() {
                return window.location.hostname === 'localhost'
                    || window.location.hostname === '127.0.0.1'
                    || window.location.protocol === 'file:';
            }

            function Na__DasLoading__SetStatusText(message, mode) {
                if (!statusElement) return;
                if (!showStatusMessages) return;
                statusElement.textContent = message || '';
                statusElement.classList.remove('na-das-status--loading', 'na-das-status--error', 'na-das-status--ready');
                if (mode === 'loading') statusElement.classList.add('na-das-status--loading');
                if (mode === 'error')   statusElement.classList.add('na-das-status--error');
                if (mode === 'ready')   statusElement.classList.add('na-das-status--ready');
            }

            function Na__DasLoading__ShowOverlay() {
                const loadingStates = Na__DasLoading__GetLoadingStatesModule();
                if (loadingStates && loadingStates.Na__Canvas__ShowLoading) {
                    loadingStates.Na__Canvas__ShowLoading();
                    return;
                }

                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.classList.remove('hidden');
                }
            }

            function Na__DasLoading__HideOverlay() {
                const loadingStates = Na__DasLoading__GetLoadingStatesModule();
                if (loadingStates && loadingStates.Na__Canvas__HideLoading) {
                    loadingStates.Na__Canvas__HideLoading();
                    return;
                }

                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                }
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Loading Control Methods
        // --------------------------------------------------------

            const Na__DasLoading__Initialize = function (config) {
                statusElement = config && config.statusElement ? config.statusElement : null;
                showStatusMessages = Na__DasLoading__IsLocalDevelopment();

                if (statusElement) {
                    if (showStatusMessages) {
                        statusElement.style.display = '';
                    } else {
                        statusElement.textContent = '';
                        statusElement.style.display = 'none';
                    }
                }

                Na__DasLoading__GetLoadingStatesModule();
            };

            const Na__DasLoading__Begin = function (message) {
                isLoadingActive = true;
                Na__DasLoading__SetStatusText(message || 'Loading Design and Access Statement...', 'loading');
                Na__DasLoading__ShowOverlay();
            };

            const Na__DasLoading__UpdateProgress = function (currentPage, totalPages) {
                if (!isLoadingActive) return;
                if (!currentPage || !totalPages) return;
                Na__DasLoading__SetStatusText(
                    'Loading Design and Access Statement... (' + currentPage + '/' + totalPages + ')',
                    'loading'
                );
            };

            const Na__DasLoading__Complete = function (message) {
                isLoadingActive = false;
                Na__DasLoading__SetStatusText(message || 'Document ready', 'ready');
                Na__DasLoading__HideOverlay();
            };

            const Na__DasLoading__Fail = function (message) {
                isLoadingActive = false;
                Na__DasLoading__SetStatusText(message || 'Failed to render PDF document.', 'error');
                Na__DasLoading__HideOverlay();
            };

            const Na__DasLoading__Reset = function () {
                isLoadingActive = false;
                Na__DasLoading__SetStatusText('', 'ready');
                Na__DasLoading__HideOverlay();
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DesignAccessStatement = window.NaPlanVision.DesignAccessStatement || {};
            window.NaPlanVision.DesignAccessStatement.Loading = {
                Na__DasLoading__Initialize       : Na__DasLoading__Initialize,
                Na__DasLoading__Begin            : Na__DasLoading__Begin,
                Na__DasLoading__UpdateProgress   : Na__DasLoading__UpdateProgress,
                Na__DasLoading__Complete         : Na__DasLoading__Complete,
                Na__DasLoading__Fail             : Na__DasLoading__Fail,
                Na__DasLoading__Reset            : Na__DasLoading__Reset
            };

            console.log('[DesignAccessStatementLoading] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
