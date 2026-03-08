// =============================================================================
// NOBLE ARCHITECTURE - MEASUREMENT TOOLS SYSTEM
// =============================================================================
//
// FILE       : MeasurmentToolsSystem__Main__.js
// NAMESPACE  : NaPlanVision.MeasurmentToolsSystem
// MODULE     : MeasurmentToolsSystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared API for measurement tools, UI injection, and routing
// CREATED    : 09-Feb-2026
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Measurement Tools System
// ----------------------------------------------------------------

    (function() {
        'use strict';

        const MeasurmentToolsSystem = {};

        // #region --------------------------------------------------------
        // CONST | Default Configuration and State
        // ------------------------------------------------------------

            const DEFAULT_CONFIG = {
                enabled: true,
                roundingEnabled: true,
                roundingInterval: 5,
                confirmButtonOffsets: {
                    pc: { x: 10, y: -10 },
                    touch: { x: 10, y: -25 }
                },
                tools: {
                    linear: { enabled: true },
                    area: { enabled: true },
                    rectangle: { enabled: true }
                }
            };

            const state = {
                currentTool: null,
                measuringPoints: [],
                measurements: [],
                isLinearMeasuring: false,
                linearMeasurementLocked: false,
                isRectMeasuring: false,
                isRectDragging: false,
                isRectLocked: false,
                isAreaComplete: false,
                hasShownLinearInstructions: false,
                hasShownAreaInstructions: false,
                hasShownRectInstructions: false
            };

            let config = DEFAULT_CONFIG;
            let appContext = null;
            let helpers = null;
            let tools = null;

            let onToolChangeCallback        = null;
            let onMeasurementChangeCallback  = null;

            let ui = {
                finishHost: null,
                finishBtn: null,
                cancelMeasureBtn: null,
                actionBtnsContainer: null
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // HELPERS | Utility Functions
        // ------------------------------------------------------------

            function deepMerge(base, override) {
                const out = Array.isArray(base) ? [] : {};
                Object.keys(base || {}).forEach(key => {
                    out[key] = base[key];
                });
                Object.keys(override || {}).forEach(key => {
                    const val = override[key];
                    if (val === undefined) {
                        return;
                    }
                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                        out[key] = deepMerge(out[key], val);
                    } else {
                        out[key] = val;
                    }
                });
                return out;
            }

            function getRenderContext() {
                const appState = appContext.getState();
                return {
                    ctx: appContext.ctx,
                    offsetX: appState.offsetX,
                    offsetY: appState.offsetY,
                    zoomFactor: appState.zoomFactor,
                    baseLineWidth: appContext.baseLineWidth,
                    markerRadius: appContext.markerRadius,
                    scaleMetresPerPixel: appContext.getScaleMetresPerPixel(),
                    roundingEnabled: config.roundingEnabled,
                    roundingInterval: config.roundingInterval
                };
            }

            function createToolContext() {
                return {
                    state: state,
                    helpers: helpers,
                    getRenderContext: getRenderContext,
                    setCursor: (cursor) => { appContext.planCanvas.style.cursor = cursor; },
                    showCancelTool: function () {},
                    hideCancelTool: function () {},
                    showFinishButton: showFinishButton,
                    hideFinishButton: hideFinishButton,
                    adjustConfirmButtonPosition: adjustConfirmButtonPosition,
                    showToolInstructions: showToolInstructions,
                    updateMeasureInfo: updateMeasureInfo,
                    requestRender: () => {
                        if (appContext.renderLoop) {
                            appContext.renderLoop();
                        }
                    }
                };
            }

            function notifyToolChange(toolName) {
                if (typeof onToolChangeCallback === 'function') {
                    onToolChangeCallback(toolName);
                }
            }

            function notifyMeasurementChange() {
                if (typeof onMeasurementChangeCallback === 'function') {
                    onMeasurementChangeCallback(state.measurements.slice());
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // UI | Floating Accept/Cancel Button Injection
        // ------------------------------------------------------------
        // Tool buttons and measurement info are now handled by
        // @delegate: ../../10__UserInterface/UserInterface__MeasurementToolsPanel__.js

            function injectFloatingButtons() {
                if (!ui.finishHost) return;

                ui.finishHost.innerHTML = `
                    <div class="measurement-action-buttons" id="measurementActionBtns">
                        <button id="finishMeasurementBtn">Accept</button>
                        <button id="cancelMeasurementBtn">Cancel</button>
                    </div>
                `;

                ui.finishBtn = document.getElementById("finishMeasurementBtn");
                ui.cancelMeasureBtn = document.getElementById("cancelMeasurementBtn");
                ui.actionBtnsContainer = document.getElementById("measurementActionBtns");

                if (ui.actionBtnsContainer) {
                    ui.actionBtnsContainer.style.display = "none";
                }

                if (ui.finishBtn) {
                    ui.finishBtn.addEventListener("click", finalizeActiveTool);
                }
                if (ui.cancelMeasureBtn) {
                    ui.cancelMeasureBtn.addEventListener("click", cancelActiveMeasurement);
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // TOOLS | Tool Activation and Management
        // ------------------------------------------------------------

            function setActiveTool(toolName) {
                if (!config.enabled) return;
                if (!config.tools[toolName] || !config.tools[toolName].enabled) return;

                state.currentTool = toolName;
                state.measuringPoints = [];
                appContext.setState({ currentTool: toolName });

                const tool = tools[toolName];
                if (tool && tool.onActivate) {
                    tool.onActivate(createToolContext());
                }

                notifyToolChange(toolName);

                if (window.NaPlanVision?.UserInterface?.ToolbarManager) {
                    window.NaPlanVision.UserInterface.ToolbarManager.Na__Toolbar__Close();
                }
            }

            function cancelTool() {
                state.currentTool = null;
                state.measuringPoints = [];
                state.isLinearMeasuring = false;
                state.linearMeasurementLocked = false;
                state.isRectMeasuring = false;
                state.isRectDragging = false;
                state.isRectLocked = false;
                state.isAreaComplete = false;
                hideFinishButton();
                appContext.planCanvas.style.cursor = "default";
                appContext.setState({ currentTool: null });
                notifyToolChange(null);
            }

            function clearMeasurements() {
                state.measurements = [];
                state.measuringPoints = [];
                notifyMeasurementChange();
                cancelTool();
            }

            function finalizeActiveTool() {
                if (!state.currentTool || !tools[state.currentTool]) return;
                const measurement = tools[state.currentTool].finalize(createToolContext());
                if (measurement) {
                    state.measurements.push(measurement);
                    notifyMeasurementChange();
                }
                cancelTool();
            }

            function cancelActiveMeasurement() {
                // Discard in-progress measurement and deactivate tool
                cancelTool();
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // UI STATE | Display and Button Visibility Management
        // ------------------------------------------------------------

            function updateMeasureInfo() {
                notifyMeasurementChange();
            }

            function showFinishButton() {
                if (ui.actionBtnsContainer) {
                    ui.actionBtnsContainer.style.display = "flex";
                }
            }

            function hideFinishButton() {
                if (ui.actionBtnsContainer) {
                    ui.actionBtnsContainer.style.display = "none";
                }
            }

            function adjustConfirmButtonPosition() {
                if (!ui.actionBtnsContainer || !state.currentTool) {
                    hideFinishButton();
                    return;
                }
                // Area tool: only show Accept/Cancel after shape is closed (double-click)
                if (state.currentTool === "area" && !state.isAreaComplete) {
                    hideFinishButton();
                    return;
                }
                if (state.measuringPoints.length > 0) {
                    showFinishButton();
                    const appState = appContext.getState();
                    const lastPt = state.measuringPoints[state.measuringPoints.length - 1];
                    const sx = (lastPt.x * appState.zoomFactor) + appState.offsetX;
                    const sy = (lastPt.y * appState.zoomFactor) + appState.offsetY;

                    if (appContext.isTouchDevice) {
                        ui.actionBtnsContainer.style.left = (sx + config.confirmButtonOffsets.touch.x) + "px";
                        ui.actionBtnsContainer.style.top = (sy + config.confirmButtonOffsets.touch.y) + "px";
                    } else {
                        ui.actionBtnsContainer.style.left = (sx + config.confirmButtonOffsets.pc.x) + "px";
                        ui.actionBtnsContainer.style.top = (sy + config.confirmButtonOffsets.pc.y) + "px";
                    }
                } else {
                    hideFinishButton();
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // INSTRUCTIONS | Tool Instructions Overlay System
        // ------------------------------------------------------------

            function showToolInstructions(tool) {
                const overlay = appContext.toolInstructionsOverlay;
                const text = appContext.toolInstructionsText;
                if (!overlay || !text) return;

                if (tool === "linear" && !state.hasShownLinearInstructions) {
                    state.hasShownLinearInstructions = true;
                    text.innerText =
                        "LINEAR TOOL:\n\n" +
                        "This Tool Functions As A Tape Measure\n\n" +
                        "1. Click to set the starting point.\n" +
                        "2. Click again to set the end point (or drag).\n" +
                        "3. Press 'Accept' to commit or 'Cancel' to discard.";
                    displayInstructionsOverlay();
                }
                if (tool === "area" && !state.hasShownAreaInstructions) {
                    state.hasShownAreaInstructions = true;
                    text.innerText =
                        "AREA TOOL:\n\n" +
                        "1. Click each corner in turn.\n" +
                        "2. Double-click to close the shape.\n" +
                        "3. Accept or Cancel to commit/discard. Click on the plan to add more points and edit before accepting.";
                    displayInstructionsOverlay();
                }
                if (tool === "rectangle" && !state.hasShownRectInstructions) {
                    state.hasShownRectInstructions = true;
                    text.innerText =
                        "RECTANGLE TOOL:\n\n" +
                        "1. Click to set the first corner.\n" +
                        "2. Click again to set the opposite corner (or drag).\n" +
                        "3. Press 'Accept' to commit or 'Cancel' to discard.";
                    displayInstructionsOverlay();
                }
            }

            function displayInstructionsOverlay() {
                const overlay = appContext.toolInstructionsOverlay;
                if (!overlay) return;

                overlay.style.display = "flex";
                function dismissOverlay() {
                    clearTimeout(timeoutId);
                    overlay.classList.add("fade-out");
                    setTimeout(() => {
                        overlay.style.display = "none";
                        overlay.classList.remove("fade-out");
                        overlay.removeEventListener("click", dismissOverlay);
                    }, 1000);
                }
                overlay.addEventListener("click", dismissOverlay);
                const timeoutId = setTimeout(dismissOverlay, 3000);
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // RENDERING | Canvas Rendering Methods
        // ------------------------------------------------------------

            function renderMeasurements() {
                state.measurements.forEach(m => {
                    const tool = tools[m.type];
                    if (tool && tool.renderMeasurement) {
                        tool.renderMeasurement(createToolContext(), m);
                    }
                });
            }

            function renderPreview() {
                if (!state.currentTool) return;
                const tool = tools[state.currentTool];
                if (tool && tool.renderPreview) {
                    tool.renderPreview(createToolContext());
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // API | Public Interface Methods
        // ------------------------------------------------------------

            MeasurmentToolsSystem.Na__Measure__Initialise = function(context, configOverrides = {}) {
                appContext = context || null;
                if (!appContext || !appContext.planCanvas) {
                    console.warn("[MeasurmentToolsSystem] Missing app context");
                    return;
                }

                helpers = window.NaPlanVision?.MeasurmentToolsSystem?.Helpers;
                const registeredTools = window.NaPlanVision?.MeasurmentToolsSystem?.Tools;
                tools = {
                    linear: registeredTools?.Linear,
                    area: registeredTools?.Area,
                    rectangle: registeredTools?.Rectangle
                };
                if (!helpers || !tools.linear || !tools.area || !tools.rectangle) {
                    console.warn("[MeasurmentToolsSystem] Required modules not available");
                    return;
                }

                config = deepMerge(DEFAULT_CONFIG, configOverrides || {});

                ui.finishHost = document.getElementById("measurement-finish-host");

                if (config.enabled === true) {
                    injectFloatingButtons();
                } else {
                    if (ui.finishHost) ui.finishHost.innerHTML = "";
                }
            };

            MeasurmentToolsSystem.Na__Measure__Render = function() {
                if (!config.enabled) return;
                renderMeasurements();
                renderPreview();
                adjustConfirmButtonPosition();
            };

            MeasurmentToolsSystem.Na__Measure__HandleMouseDown = function(e) {
                if (!config.enabled || !state.currentTool) return false;
                const pos = appContext.toPlanCoords(e.offsetX, e.offsetY);
                const tool = tools[state.currentTool];
                if (tool && tool.onMouseDown) {
                    return tool.onMouseDown(createToolContext(), pos, e);
                }
                return false;
            };

            MeasurmentToolsSystem.Na__Measure__HandleMouseMove = function(e) {
                if (!config.enabled || !state.currentTool) return false;
                const pos = appContext.toPlanCoords(e.offsetX, e.offsetY);
                const tool = tools[state.currentTool];
                if (tool && tool.onMouseMove) {
                    return tool.onMouseMove(createToolContext(), pos, e);
                }
                return false;
            };

            MeasurmentToolsSystem.Na__Measure__HandleMouseUp = function(e) {
                if (!config.enabled || !state.currentTool) return false;
                const pos = appContext.toPlanCoords(e.offsetX, e.offsetY);
                const tool = tools[state.currentTool];
                if (tool && tool.onMouseUp) {
                    return tool.onMouseUp(createToolContext(), pos, e);
                }
                return false;
            };

            MeasurmentToolsSystem.Na__Measure__ClearMeasurements = function() {
                clearMeasurements();
            };

            MeasurmentToolsSystem.Na__Measure__CancelTool = function() {
                cancelTool();
            };

            MeasurmentToolsSystem.Na__Measure__HasActiveTool = function() {
                return !!state.currentTool;
            };

            MeasurmentToolsSystem.Na__Measure__HasMeasurements = function() {
                return state.measurements.length > 0 || (state.currentTool && state.measuringPoints.length > 0);
            };

            MeasurmentToolsSystem.Na__Measure__GetMeasurements = function() {
                return state.measurements.slice();
            };

            MeasurmentToolsSystem.Na__Measure__ActivateToolByName = function(toolName) {
                setActiveTool(toolName);
            };

            MeasurmentToolsSystem.Na__Measure__SetOnToolChange = function(callback) {
                onToolChangeCallback = typeof callback === 'function' ? callback : null;
            };

            MeasurmentToolsSystem.Na__Measure__SetOnMeasurementChange = function(callback) {
                onMeasurementChangeCallback = typeof callback === 'function' ? callback : null;
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module Namespace Export
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.MeasurmentToolsSystem = window.NaPlanVision.MeasurmentToolsSystem || {};
            window.NaPlanVision.MeasurmentToolsSystem.Main = MeasurmentToolsSystem;

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
