// =============================================================================
// NOBLE ARCHITECTURE - AREA MEASUREMENT TOOL
// =============================================================================
//
// FILE       : MeasurmentTool__AreaMeasurmentTool__.js
// NAMESPACE  : NaPlanVision.MeasurmentToolsSystem.Tools.Area
// MODULE     : AreaMeasurementTool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handles area measurement tool interactions and rendering
// CREATED    : 09-Feb-2026
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Area Measurement Tool
// ----------------------------------------------------------------

    (function() {
        'use strict';

        const AreaTool = {};

        // #region --------------------------------------------------------
        // LIFECYCLE | Tool Activation and Initialization
        // ------------------------------------------------------------

            AreaTool.onActivate = function(context) {
                const { state, setCursor, showCancelTool, showToolInstructions } = context;
                state.measuringPoints = [];
                state.isAreaComplete = false;
                setCursor("default");
                showCancelTool();
                showToolInstructions("area");
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EVENTS | Mouse Event Handlers
        // ------------------------------------------------------------

            // Tolerance in plan-space pixels for snapping to the first point
            const CLOSE_TOLERANCE = 30;

            AreaTool.onMouseDown = function(context, pos) {
                const { state, hideFinishButton, showFinishButton, adjustConfirmButtonPosition, helpers } = context;

                // If shape is closed (waiting for Accept/Cancel), a new click reopens for editing
                if (state.isAreaComplete) {
                    state.isAreaComplete = false;
                    hideFinishButton();
                    state.measuringPoints.push(pos);
                    return true;
                }

                // Snap-to-close: if clicking near the first point with 3+ points, close the loop
                if (state.measuringPoints.length >= 3) {
                    var distToFirst = helpers.dist(pos, state.measuringPoints[0]);
                    if (distToFirst <= CLOSE_TOLERANCE) {
                        state.isAreaComplete = true;
                        showFinishButton();
                        adjustConfirmButtonPosition();
                        return true;
                    }
                }

                state.measuringPoints.push(pos);
                return true;
            };

            AreaTool.onMouseUp = function(context, pos, e) {
                const { state, requestRender, showFinishButton, adjustConfirmButtonPosition } = context;
                if (e && e.detail === 2) {
                    // Only close if we have enough points for a polygon
                    if (state.measuringPoints.length >= 3) {
                        state.isAreaComplete = true;
                        showFinishButton();
                        adjustConfirmButtonPosition();
                    }
                    requestRender();
                    return true;
                }
                return false;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // RENDERING | Canvas Drawing Methods
        // ------------------------------------------------------------

            AreaTool.renderPreview = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (state.measuringPoints.length > 0) {
                    if (state.isAreaComplete) {
                        helpers.drawPolygon(getRenderContext(), state.measuringPoints, "rgba(255,0,0,0.2)", "red");
                    } else {
                        helpers.drawOpenPolygon(getRenderContext(), state.measuringPoints, "red");
                    }
                    helpers.drawMarkers(getRenderContext(), state.measuringPoints, "red");
                }
            };

            AreaTool.renderMeasurement = function(context, measurement) {
                const { helpers, getRenderContext } = context;
                helpers.drawPolygon(getRenderContext(), measurement.points, "rgba(255,0,0,0.2)", "red");
                helpers.drawMarkers(getRenderContext(), measurement.points, "red");
                helpers.drawAreaLabel(getRenderContext(), measurement);
                helpers.drawEdgeLabels(getRenderContext(), measurement.points, "red");
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // STATE | Measurement Finalization and Reset
        // ------------------------------------------------------------

            AreaTool.finalize = function(context) {
                const { state, helpers, getRenderContext } = context;
                if (state.measuringPoints.length <= 2) return null;

                const renderContext = getRenderContext();
                const areaPx2 = helpers.polygonArea(state.measuringPoints);
                const areaM2 = (areaPx2 * renderContext.scaleMetresPerPixel * renderContext.scaleMetresPerPixel).toFixed(2);

                const measurement = {
                    type: "area",
                    points: JSON.parse(JSON.stringify(state.measuringPoints)),
                    areaM2: areaM2
                };

                // Reset tool-specific state (main system handles full deactivation)
                state.measuringPoints = [];
                state.isAreaComplete = false;
                return measurement;
            };

            AreaTool.reset = function(context) {
                const { state } = context;
                state.measuringPoints = [];
                state.isAreaComplete = false;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module Namespace Export
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.MeasurmentToolsSystem = window.NaPlanVision.MeasurmentToolsSystem || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools = window.NaPlanVision.MeasurmentToolsSystem.Tools || {};
            window.NaPlanVision.MeasurmentToolsSystem.Tools.Area = AreaTool;

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
