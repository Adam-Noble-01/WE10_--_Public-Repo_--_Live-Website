// =============================================================================
// NOBLE ARCHITECTURE - CANVAS COORDINATE UTILITIES
// =============================================================================
//
// FILE       : DrawingsCanvas__CoordinateUtils__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.CoordinateUtils
// MODULE     : CoordinateUtils
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Canvas coordinate transformations between screen and plan space
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Converts screen coordinates to plan coordinates
// - Converts plan coordinates to screen coordinates
// - Accounts for zoom factor and canvas offset
// - Used by measurement and markup tools
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Added inverse transform (toScreenCoords)
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Canvas Coordinate Utilities
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let getStateCallback               = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Coordinate Utilities
            // ------------------------------------------------------------
            const Na__Canvas__Initialize = function (context) {
                console.log('[CoordinateUtils] Initializing...');

                // Store state callback
                if (context && context.getState) {
                    getStateCallback = context.getState;
                } else {
                    console.error('[CoordinateUtils] getState callback is required');
                }

                console.log('[CoordinateUtils] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // COORDINATE TRANSFORMS | Screen ↔ Plan Conversions
        // --------------------------------------------------------

            // FUNCTION | Convert Screen Coordinates to Plan Coordinates
            // Transforms mouse/touch coordinates to plan image coordinates
            // ------------------------------------------------------------
            const Na__Canvas__ToPlanCoords = function (x, y) {
                if (!getStateCallback) {
                    console.error('[CoordinateUtils] Not initialized - getState callback missing');
                    return { x: 0, y: 0 };
                }

                const state = getStateCallback();
                const offsetX = state.offsetX || 0;
                const offsetY = state.offsetY || 0;
                const zoomFactor = state.zoomFactor || 1;

                return {
                    x: (x - offsetX) / zoomFactor,
                    y: (y - offsetY) / zoomFactor
                };
            };
            // ---------------------------------------------------------------

            // FUNCTION | Convert Plan Coordinates to Screen Coordinates
            // Transforms plan image coordinates to screen coordinates
            // ------------------------------------------------------------
            const Na__Canvas__ToScreenCoords = function (x, y) {
                if (!getStateCallback) {
                    console.error('[CoordinateUtils] Not initialized - getState callback missing');
                    return { x: 0, y: 0 };
                }

                const state = getStateCallback();
                const offsetX = state.offsetX || 0;
                const offsetY = state.offsetY || 0;
                const zoomFactor = state.zoomFactor || 1;

                return {
                    x: (x * zoomFactor) + offsetX,
                    y: (y * zoomFactor) + offsetY
                };
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.CoordinateUtils = {
                Na__Canvas__Initialize       : Na__Canvas__Initialize,
                Na__Canvas__ToPlanCoords     : Na__Canvas__ToPlanCoords,
                Na__Canvas__ToScreenCoords   : Na__Canvas__ToScreenCoords
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('CoordinateUtils');
            }

            console.log('[CoordinateUtils] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
