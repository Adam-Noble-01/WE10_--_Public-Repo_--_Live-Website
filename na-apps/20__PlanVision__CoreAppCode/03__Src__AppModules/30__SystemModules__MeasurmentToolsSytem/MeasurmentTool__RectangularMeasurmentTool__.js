// =============================================================================
// NOBLE ARCHITECTURE - RECTANGLE MEASUREMENT TOOL
// =============================================================================
//
// FILE       : MeasurmentTool__RectangularMeasurmentTool__.js
// NAMESPACE  : NaPlanVision.MeasurmentToolsSystem.Tools.Rectangle
// MODULE     : RectangularMeasurementTool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles rectangle measurement tool interactions and rendering
// CREATED    : 09-Feb-2026
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Rectangle Measurement Tool
// ----------------------------------------------------------------

    (function() {
        'use strict';

        const RectangleTool = {};

        // #region --------------------------------------------------------
        // LIFECYCLE | Tool Activation and Initialization
        // ------------------------------------------------------------

            RectangleTool.onActivate = function(context) {
                const { state, setCursor, showCancelTool, showToolInstructions } = context;
                state.measuringPoints = [];
                state.isRectMeasuring = false;
                state.isRectDragging = false;
                setCursor("crosshair");
                showCancelTool();
                showToolInstructions("rectangle");
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EVENTS | Mouse Event Handlers
        // Supports both click-click and click-drag-release flows
        // ------------------------------------------------------------

            RectangleTool.onMouseDown = function(context, pos) {
                const { state, hideFinishButton, adjustConfirmButtonPosition, showFinishButton } = context;

                // First click: set start point
                if (!state.isRectMeasuring) {
                    state.measuringPoints = [pos];
                    state.isRectMeasuring = true;
                    state.isRectDragging = false;
                    state.isRectLocked = false;
                    hideFinishButton();
                    return true;
                }

                // Second click: set end point (click-click flow)
                if (state.isRectMeasuring && state.measuringPoints.length >= 1 && !state.isRectLocked) {
                    if (state.measuringPoints.length === 1) {
                        state.measuringPoints.push(pos);
                    } else {
                        state.measuringPoints[1] = pos;
                    }
                    state.isRectLocked = true;
                    state.isRectDragging = false;
                    adjustConfirmButtonPosition();
                    showFinishButton();
                    return true;
                }

                return false;
            };

            RectangleTool.onMouseMove = function(context, pos) {
                const { state, adjustConfirmButtonPosition } = context;

                // Update preview while measuring and not locked
                if (state.isRectMeasuring && !state.isRectLocked) {
                    state.isRectDragging = true;
                    if (state.measuringPoints.length === 1) {
                        state.measuringPoints.push(pos);
                    } else {
                        state.measuringPoints[1] = pos;
                    }
                    adjustConfirmButtonPosition();
                    return true;
                }

                return false;
            };

            RectangleTool.onMouseUp = function(context) {
                const { state, adjustConfirmButtonPosition, showFinishButton } = context;

                // Lock on mouse up after drag (click-drag-release flow)
                if (state.isRectMeasuring && state.isRectDragging && state.measuringPoints.length === 2 && !state.isRectLocked) {
                    state.isRectLocked = true;
                    state.isRectDragging = false;
                    adjustConfirmButtonPosition();
                    showFinishButton();
                    return true;
                }

                return false;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // RENDERING | Canvas Drawing Methods
        // ------------------------------------------------------------

            RectangleTool.renderPreview = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (state.isRectMeasuring && state.measuringPoints.length === 2) {
                    helpers.drawRectangle(getRenderContext(), state.measuringPoints[0], state.measuringPoints[1], "blue");
                    helpers.drawMarkers(getRenderContext(), state.measuringPoints, "blue");
                } else if (state.measuringPoints.length === 1) {
                    helpers.drawMarkers(getRenderContext(), state.measuringPoints, "blue");
                }
            };

            RectangleTool.renderMeasurement = function(context, measurement) {
                const { helpers, getRenderContext } = context;
                helpers.drawRectangle(getRenderContext(), measurement.points[0], measurement.points[1], "blue", "rgba(0,0,255,0.2)");
                helpers.drawMarkers(getRenderContext(), measurement.points, "blue");
                helpers.drawRectLabel(getRenderContext(), measurement.points[0], measurement.points[1]);
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // STATE | Measurement Finalization and Reset
        // ------------------------------------------------------------

            RectangleTool.finalize = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (state.measuringPoints.length !== 2) return null;

                const renderContext = getRenderContext();
                const widthPx = Math.abs(state.measuringPoints[1].x - state.measuringPoints[0].x);
                const heightPx = Math.abs(state.measuringPoints[1].y - state.measuringPoints[0].y);
                const widthMm = renderContext.roundingEnabled
                    ? Math.round((widthPx * renderContext.scaleMetresPerPixel * 1000) / renderContext.roundingInterval) * renderContext.roundingInterval
                    : Math.round(widthPx * renderContext.scaleMetresPerPixel * 1000);
                const heightMm = renderContext.roundingEnabled
                    ? Math.round((heightPx * renderContext.scaleMetresPerPixel * 1000) / renderContext.roundingInterval) * renderContext.roundingInterval
                    : Math.round(heightPx * renderContext.scaleMetresPerPixel * 1000);
                const areaPx2 = widthPx * heightPx;
                const areaM2 = (areaPx2 * renderContext.scaleMetresPerPixel * renderContext.scaleMetresPerPixel).toFixed(2);

                const measurement = {
                    type: "rectangle",
                    points: JSON.parse(JSON.stringify(state.measuringPoints)),
                    widthMm: widthMm,
                    heightMm: heightMm,
                    areaM2: areaM2
                };

                // Reset tool-specific state (main system handles full deactivation)
                state.measuringPoints = [];
                state.isRectMeasuring = false;
                state.isRectDragging = false;
                state.isRectLocked = false;
                return measurement;
            };

            RectangleTool.reset = function(context) {
                const { state } = context;
                state.measuringPoints = [];
                state.isRectMeasuring = false;
                state.isRectDragging = false;
                state.isRectLocked = false;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module Namespace Export
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.MeasurmentToolsSystem = window.NaPlanVision.MeasurmentToolsSystem || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools = window.NaPlanVision.MeasurmentToolsSystem.Tools || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools.Rectangle = RectangleTool;

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
