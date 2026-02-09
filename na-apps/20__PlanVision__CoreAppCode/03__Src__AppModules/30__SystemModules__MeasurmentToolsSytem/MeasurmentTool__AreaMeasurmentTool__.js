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

            AreaTool.onMouseDown = function(context, pos) {
                const { state } = context;
                state.measuringPoints.push(pos);
                return true;
            };

            AreaTool.onMouseUp = function(context, event) {
                const { state, requestRender } = context;
                if (event && event.detail === 2) {
                    state.isAreaComplete = true;
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
                    helpers.drawOpenPolygon(getRenderContext(), state.measuringPoints, "red");
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
                const { state, helpers, getRenderContext, hideFinishButton, hideCancelTool, setCursor } = context;
                if (state.measuringPoints.length <= 2) return null;

                const renderContext = getRenderContext();
                const areaPx2 = helpers.polygonArea(state.measuringPoints);
                const areaM2 = (areaPx2 * renderContext.scaleMetresPerPixel * renderContext.scaleMetresPerPixel).toFixed(2);

                const measurement = {
                    type: "area",
                    points: JSON.parse(JSON.stringify(state.measuringPoints)),
                    areaM2: areaM2
                };

                state.measuringPoints = [];
                state.isAreaComplete = false;
                hideCancelTool();
                setCursor("default");
                hideFinishButton();
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
