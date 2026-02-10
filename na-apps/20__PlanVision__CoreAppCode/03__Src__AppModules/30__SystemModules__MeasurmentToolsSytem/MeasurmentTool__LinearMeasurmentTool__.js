// =============================================================================
// NOBLE ARCHITECTURE - LINEAR MEASUREMENT TOOL
// =============================================================================
//
// FILE       : MeasurmentTool__LinearMeasurmentTool__.js
// NAMESPACE  : NaPlanVision.MeasurmentToolsSystem.Tools.Linear
// MODULE     : LinearMeasurementTool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles linear measurement tool interactions and rendering
// CREATED    : 09-Feb-2026
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Linear Measurement Tool
// ----------------------------------------------------------------

    (function() {
        'use strict';

        const LinearTool = {};

        // #region --------------------------------------------------------
        // HELPERS | Snapping and Alignment Functions
        // ------------------------------------------------------------

            function applySnapping(start, pos) {
                const snappedPos = { x: pos.x, y: pos.y };
                const dx = pos.x - start.x;
                const dy = pos.y - start.y;
                const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));

                if (angleDeg < 15 || angleDeg > 165) {
                    snappedPos.y = start.y;
                } else if (Math.abs(angleDeg - 90) < 15) {
                    snappedPos.x = start.x;
                }
                return snappedPos;
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // LIFECYCLE | Tool Activation and Initialization
        // ------------------------------------------------------------

            LinearTool.onActivate = function(context) {
                const { state, setCursor, showCancelTool, showToolInstructions } = context;
                state.measuringPoints = [];
                state.isLinearMeasuring = false;
                state.linearMeasurementLocked = false;
                setCursor("crosshair");
                showCancelTool();
                showToolInstructions("linear");
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EVENTS | Mouse Event Handlers
        // ------------------------------------------------------------

            LinearTool.onMouseDown = function(context, pos) {
                const { state, hideFinishButton, adjustConfirmButtonPosition, showFinishButton } = context;

                if (!state.measuringPoints.length) {
                    state.measuringPoints = [pos];
                    state.isLinearMeasuring = true;
                    state.linearMeasurementLocked = false;
                    hideFinishButton();
                    return true;
                }

                if (state.measuringPoints.length === 1 && !state.linearMeasurementLocked) {
                    const start = state.measuringPoints[0];
                    const secondPoint = applySnapping(start, pos);
                    state.measuringPoints.push(secondPoint);
                    state.linearMeasurementLocked = true;
                    adjustConfirmButtonPosition();
                    showFinishButton();
                    return true;
                }

                return false;
            };

            LinearTool.onMouseMove = function(context, pos) {
                const { state, adjustConfirmButtonPosition } = context;

                if (state.isLinearMeasuring && state.measuringPoints.length > 0 && !state.linearMeasurementLocked) {
                    const start = state.measuringPoints[0];
                    const snappedPos = applySnapping(start, pos);
                    if (state.measuringPoints.length === 1) {
                        state.measuringPoints.push(snappedPos);
                    } else {
                        state.measuringPoints[1] = snappedPos;
                    }
                    adjustConfirmButtonPosition();
                    return true;
                }

                return false;
            };

            LinearTool.onMouseUp = function(context) {
                const { state, adjustConfirmButtonPosition, showFinishButton } = context;

                if (state.isLinearMeasuring && state.measuringPoints.length === 2 && !state.linearMeasurementLocked) {
                    state.linearMeasurementLocked = true;
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

            LinearTool.renderPreview = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (!state.isLinearMeasuring) return;

                if (state.measuringPoints.length === 2) {
                    helpers.drawLine(getRenderContext(), state.measuringPoints, "green");
                    helpers.drawMarkers(getRenderContext(), state.measuringPoints, "green");
                } else if (state.measuringPoints.length === 1) {
                    helpers.drawMarkers(getRenderContext(), state.measuringPoints, "green");
                }
            };

            LinearTool.renderMeasurement = function(context, measurement) {
                const { helpers, getRenderContext } = context;
                helpers.drawLine(getRenderContext(), measurement.points, "blue");
                helpers.drawMarkers(getRenderContext(), measurement.points, "blue");
                helpers.drawLineLabel(getRenderContext(), measurement.points, measurement.distanceMM, "blue");
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // STATE | Measurement Finalization and Reset
        // ------------------------------------------------------------

            LinearTool.finalize = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (state.measuringPoints.length !== 2) return null;

                const renderContext = getRenderContext();
                const [start, end] = state.measuringPoints;
                const pxDist = helpers.dist(start, end);
                const rawMm = pxDist * renderContext.scaleMetresPerPixel * 1000;
                let mmDist = renderContext.roundingEnabled
                    ? Math.round(rawMm / renderContext.roundingInterval) * renderContext.roundingInterval
                    : Math.round(rawMm);

                const measurement = {
                    type: "linear",
                    points: JSON.parse(JSON.stringify(state.measuringPoints)),
                    distanceMM: mmDist
                };

                // Reset tool-specific state (main system handles full deactivation)
                state.measuringPoints = [];
                state.isLinearMeasuring = false;
                state.linearMeasurementLocked = false;
                return measurement;
            };

            LinearTool.reset = function(context) {
                const { state } = context;
                state.measuringPoints = [];
                state.isLinearMeasuring = false;
                state.linearMeasurementLocked = false;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module Namespace Export
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.MeasurmentToolsSystem = window.NaPlanVision.MeasurmentToolsSystem || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools = window.NaPlanVision.MeasurmentToolsSystem.Tools || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools.Linear = LinearTool;

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
