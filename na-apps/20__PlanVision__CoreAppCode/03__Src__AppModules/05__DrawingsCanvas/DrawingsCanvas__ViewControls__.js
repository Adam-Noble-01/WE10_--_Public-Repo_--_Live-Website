// =============================================================================
// NOBLE ARCHITECTURE - CANVAS VIEW CONTROLS
// =============================================================================
//
// FILE       : DrawingsCanvas__ViewControls__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.ViewControls
// MODULE     : ViewControls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Zoom, pan, reset, and scale calibration for canvas
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages zoom operations with focus point preservation
// - Handles canvas resizing and view reset
// - Calculates measurement scale from drawing metadata
// - Coordinates with measurement and markup systems
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Centralized view control logic
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Canvas View Controls
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Zoom and Paper Size Definitions
        // --------------------------------------------------------

            const MIN_ZOOM = 0.1;
            const MAX_ZOOM = 2;

            // A-series paper sizes (width in millimetres)
            const PAPER_SIZES = {
                'A0': 1189,
                'A1': 841,
                'A2': 594,
                'A3': 420,
                'A4': 297
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let planCanvas                     = null;
            let planImage                      = null;
            let getStateCallback               = null;
            let setStateCallback               = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize View Controls
            // ------------------------------------------------------------
            const Na__Canvas__Initialize = function (context) {
                console.log('[ViewControls] Initializing...');

                if (context) {
                    planCanvas = context.planCanvas;
                    planImage = context.planImage;
                    getStateCallback = context.getState;
                    setStateCallback = context.setState;
                }

                if (!planCanvas) {
                    console.error('[ViewControls] planCanvas reference is required');
                }

                if (!planImage) {
                    console.error('[ViewControls] planImage reference is required');
                }

                if (!getStateCallback || !setStateCallback) {
                    console.error('[ViewControls] getState and setState callbacks are required');
                }

                console.log('[ViewControls] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ZOOM CONTROLS | Zoom Operations
        // --------------------------------------------------------

            // FUNCTION | Apply Zoom Delta
            // Applies a relative zoom change at a specific point
            // ------------------------------------------------------------
            const Na__Canvas__ApplyZoom = function (delta, cx, cy) {
                if (!getStateCallback || !setStateCallback) {
                    console.error('[ViewControls] State callbacks not available');
                    return;
                }

                const state = getStateCallback();
                let newZoom = state.zoomFactor + delta;
                Na__Canvas__SetZoom(newZoom, cx, cy);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Set Absolute Zoom Level
            // Sets zoom to a specific level while maintaining focus point
            // ------------------------------------------------------------
            const Na__Canvas__SetZoom = function (z, cx, cy) {
                if (!getStateCallback || !setStateCallback) {
                    console.error('[ViewControls] State callbacks not available');
                    return;
                }

                const state = getStateCallback();

                // Clamp zoom within bounds
                if (z < MIN_ZOOM) z = MIN_ZOOM;
                if (z > MAX_ZOOM) z = MAX_ZOOM;

                // Calculate world coordinates of the center point
                const wx = (cx - state.offsetX) / state.zoomFactor;
                const wy = (cy - state.offsetY) / state.zoomFactor;

                // Update zoom and recalculate offsets to maintain focus point
                const newOffsetX = cx - wx * z;
                const newOffsetY = cy - wy * z;

                setStateCallback({
                    zoomFactor: z,
                    offsetX: newOffsetX,
                    offsetY: newOffsetY
                });

                console.log('[ViewControls] Zoom set to:', z.toFixed(2));
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // CANVAS MANAGEMENT | Size and Reset
        // --------------------------------------------------------

            // FUNCTION | Resize Canvas to Window
            // Updates canvas dimensions to match window size
            // ------------------------------------------------------------
            const Na__Canvas__ResizeCanvas = function () {
                if (!planCanvas) {
                    console.error('[ViewControls] planCanvas not available');
                    return;
                }

                planCanvas.width = window.innerWidth;
                planCanvas.height = window.innerHeight + 10;  // Prevent bottom cropping

                console.log('[ViewControls] Canvas resized to:', planCanvas.width, 'x', planCanvas.height);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Reset View to Fit Drawing
            // Centers and scales drawing to fit in viewport
            // ------------------------------------------------------------
            const Na__Canvas__ResetView = function () {
                if (!planCanvas || !planImage || !getStateCallback || !setStateCallback) {
                    console.error('[ViewControls] Required references not available');
                    return;
                }

                const state = getStateCallback();
                const cw = planCanvas.width;
                const ch = planCanvas.height;
                const iw = planImage.width;
                const ih = planImage.height;

                // Calculate zoom to fit drawing with 15% padding
                const newZoomFactor = Math.min(cw / iw, ch / ih) * 0.85;

                // Center the drawing
                const newOffsetX = (cw - iw * newZoomFactor) / 2;
                const newOffsetY = (ch - ih * newZoomFactor) / 2;

                // Update view transform
                setStateCallback({
                    zoomFactor: newZoomFactor,
                    offsetX: newOffsetX,
                    offsetY: newOffsetY
                });

                // Calculate measurement scale
                const scaleMetresPerPixel = calculateScale(state);
                setStateCallback({
                    scaleMetresPerPixel: scaleMetresPerPixel
                });

                console.log('[ViewControls] View reset - zoom:', newZoomFactor.toFixed(3));
                console.log('[ViewControls] Scale:', scaleMetresPerPixel, 'metres/pixel');

                // Clear measurements via measurement system
                const measSystem = window.NaPlanVision?.MeasurmentToolsSystem?.Main;
                if (measSystem && measSystem.Na__Measure__ClearMeasurements) {
                    measSystem.Na__Measure__ClearMeasurements();
                }

                // Update markup handles after transform
                updateAllHandlePositions();
            };
            // ---------------------------------------------------------------

            // FUNCTION | Handle Window Resize
            // Responds to window resize events
            // ------------------------------------------------------------
            const Na__Canvas__OnResize = function () {
                Na__Canvas__ResizeCanvas();

                // Update markup handles after resize
                updateAllHandlePositions();

                console.log('[ViewControls] Window resized');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // SCALE CALCULATION | Measurement Scale
        // --------------------------------------------------------

            // FUNCTION | Calculate Metres Per Pixel Scale
            // Calculates real-world scale from drawing metadata
            // ------------------------------------------------------------
            function calculateScale(state) {
                const currentDrawingScale = state.currentDrawingScale || '1:50';
                const currentDrawingSize = na_NormalizeDrawingSizeKey(state.currentDrawingSize || 'A1');
                const naturalImageWidth = state.naturalImageWidth || planImage.naturalWidth;

                // Get paper size dimensions
                let realWidthMM = PAPER_SIZES[currentDrawingSize];
                if (!realWidthMM) {
                    console.warn('[ViewControls] Unknown paper size:', currentDrawingSize, '- defaulting to A1');
                    realWidthMM = PAPER_SIZES['A1'];
                }

                // Parse scale from format like "1:50"
                let scaleRatio = 50;
                if (currentDrawingScale && currentDrawingScale.includes(':')) {
                    const scaleParts = currentDrawingScale.split(':');
                    if (scaleParts.length === 2 && !isNaN(scaleParts[1])) {
                        scaleRatio = parseInt(scaleParts[1], 10);
                    }
                }

                // Calculate scale metres per pixel
                const drawnWidthPx = naturalImageWidth;
                const mmPerPixel = realWidthMM / drawnWidthPx;
                const scaleMetresPerPixel = (mmPerPixel * scaleRatio) / 1000;

                console.log('[ViewControls] Scale calculation:');
                console.log('[ViewControls] → Drawing:', currentDrawingSize, 'at', currentDrawingScale, '(1:' + scaleRatio + ')');
                console.log('[ViewControls] → Paper width:', realWidthMM, 'mm');
                console.log('[ViewControls] → Image width:', drawnWidthPx, 'px');
                console.log('[ViewControls] → mm/pixel:', mmPerPixel.toFixed(4));
                console.log('[ViewControls] → metres/pixel:', scaleMetresPerPixel.toFixed(6));

                return scaleMetresPerPixel;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Normalize Drawing Size Key
            // Accepts values like "ISO A2" and returns "A2" for PAPER_SIZES lookup
            // ------------------------------------------------------------
            function na_NormalizeDrawingSizeKey(sizeValue) {
                if (!sizeValue) return 'A1';
                const normalized = String(sizeValue).replace(/[^a-z0-9]/gi, '').toUpperCase();

                const isoMatch = normalized.match(/^ISOA(\d{1,2})$/);
                if (isoMatch) return 'A' + isoMatch[1];

                const aSeriesMatch = normalized.match(/^A(\d{1,2})$/);
                if (aSeriesMatch) return 'A' + aSeriesMatch[1];

                return String(sizeValue).toUpperCase();
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPER FUNCTIONS | Markup System Integration
        // --------------------------------------------------------

            // FUNCTION | Update Markup Handle Positions
            // Triggers markup system to update selection handle positions
            // ------------------------------------------------------------
            function updateAllHandlePositions() {
                const markupSystem = window.NaPlanVision?.MarkupToolsSystem?.Main;
                // The markup system handles this internally; no-op if not initialised
                if (markupSystem && markupSystem.updateHandlePositions) {
                    markupSystem.updateHandlePositions();
                }
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.ViewControls = {
                Na__Canvas__Initialize     : Na__Canvas__Initialize,
                Na__Canvas__ApplyZoom      : Na__Canvas__ApplyZoom,
                Na__Canvas__SetZoom        : Na__Canvas__SetZoom,
                Na__Canvas__ResizeCanvas   : Na__Canvas__ResizeCanvas,
                Na__Canvas__ResetView      : Na__Canvas__ResetView,
                Na__Canvas__OnResize       : Na__Canvas__OnResize
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('ViewControls');
            }

            console.log('[ViewControls] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
