// =============================================================================
// NOBLE ARCHITECTURE - CANVAS LOADING STATES
// =============================================================================
//
// FILE       : DrawingsCanvas__LoadingStates__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.LoadingStates
// MODULE     : LoadingStates
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Loading overlays and error message display for canvas operations
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages loading overlay visibility during drawing loads
// - Displays error messages to users
// - Controls UI feedback for async canvas operations
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Provides clean API for loading and error states
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Canvas Loading States
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | DOM References
        // --------------------------------------------------------

            let loadingOverlay                 = null;
            let errorMessage                   = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Loading States System
            // ------------------------------------------------------------
            const Na__Canvas__Initialize = function () {
                console.log('[LoadingStates] Initializing...');

                // Get DOM references
                loadingOverlay = document.getElementById('loading-overlay');
                errorMessage = document.getElementById('error-message');

                if (!loadingOverlay) {
                    console.warn('[LoadingStates] loading-overlay element not found');
                }

                if (!errorMessage) {
                    console.warn('[LoadingStates] error-message element not found');
                }

                console.log('[LoadingStates] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // LOADING OVERLAY | Visibility Control
        // --------------------------------------------------------

            // FUNCTION | Show Loading Overlay
            // ------------------------------------------------------------
            const Na__Canvas__ShowLoading = function () {
                if (loadingOverlay) {
                    loadingOverlay.classList.remove('hidden');
                    console.log('[LoadingStates] Loading overlay shown');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide Loading Overlay
            // ------------------------------------------------------------
            const Na__Canvas__HideLoading = function () {
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                    console.log('[LoadingStates] Loading overlay hidden');
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ERROR MESSAGES | Display Control
        // --------------------------------------------------------

            // FUNCTION | Display Error Message
            // ------------------------------------------------------------
            const Na__Canvas__DisplayError = function (message) {
                if (errorMessage) {
                    errorMessage.textContent = message;
                    errorMessage.style.display = 'block';
                    console.error('[LoadingStates] Error displayed:', message);
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide Error Message
            // ------------------------------------------------------------
            const Na__Canvas__HideError = function () {
                if (errorMessage) {
                    errorMessage.textContent = '';
                    errorMessage.style.display = 'none';
                    console.log('[LoadingStates] Error message hidden');
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.LoadingStates = {
                Na__Canvas__Initialize    : Na__Canvas__Initialize,
                Na__Canvas__ShowLoading   : Na__Canvas__ShowLoading,
                Na__Canvas__HideLoading   : Na__Canvas__HideLoading,
                Na__Canvas__DisplayError  : Na__Canvas__DisplayError,
                Na__Canvas__HideError     : Na__Canvas__HideError
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('LoadingStates');
            }

            console.log('[LoadingStates] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
