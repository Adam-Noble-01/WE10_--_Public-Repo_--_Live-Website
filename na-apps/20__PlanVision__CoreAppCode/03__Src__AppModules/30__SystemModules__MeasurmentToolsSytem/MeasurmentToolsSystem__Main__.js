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
                isAreaComplete: false,
                hasShownLinearInstructions: false,
                hasShownAreaInstructions: false
            };

            let config = DEFAULT_CONFIG;
            let appContext = null;
            let helpers = null;
            let tools = null;

            let ui = {
                toolsHost: null,
                infoHost: null,
                finishHost: null,
                measureInfo: null,
                cancelToolBtn: null,
                finishBtn: null
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
                    showCancelTool: showCancelTool,
                    hideCancelTool: hideCancelTool,
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

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // UI | DOM Injection and Button Wiring
        // ------------------------------------------------------------

            function injectUi() {
                if (!ui.toolsHost || !ui.infoHost || !ui.finishHost) return;

                ui.toolsHost.innerHTML = `
                    <div class="menu_-_drawing-button-header-text">Measuring Tools</div>
                    <button class="tool-button" id="linearMeasureBtn">Linear Measurement</button>
                    <button class="tool-button" id="rectMeasureBtn">Rectangle Measurement</button>
                    <button class="tool-button" id="areaMeasureBtn">Area Measurement</button>
                    <button class="tool-button" id="clearMeasurementsBtn">Clear Measurements</button>
                    <button class="tool-button" id="cancelToolBtn">Cancel Tool</button>
                `;

                ui.infoHost.innerHTML = `
                    <div style="margin-top:20px; font-size:12px; color:#555041;">
                        <strong>Measurements:</strong>
                        <div id="measureInfo" style="margin-top:5px;">No measurements yet.</div>
                    </div>
                `;

                ui.finishHost.innerHTML = `<button id="finishMeasurementBtn">Confirm</button>`;

                ui.measureInfo = document.getElementById("measureInfo");
                ui.cancelToolBtn = document.getElementById("cancelToolBtn");
                ui.finishBtn = document.getElementById("finishMeasurementBtn");

                if (ui.cancelToolBtn) {
                    ui.cancelToolBtn.style.display = "none";
                }
                if (ui.finishBtn) {
                    ui.finishBtn.style.display = "none";
                }
            }

            function applyToolVisibility() {
                const linearBtn = document.getElementById("linearMeasureBtn");
                const rectBtn = document.getElementById("rectMeasureBtn");
                const areaBtn = document.getElementById("areaMeasureBtn");

                if (linearBtn) linearBtn.style.display = config.tools.linear.enabled ? "block" : "none";
                if (rectBtn) rectBtn.style.display = config.tools.rectangle.enabled ? "block" : "none";
                if (areaBtn) areaBtn.style.display = config.tools.area.enabled ? "block" : "none";
            }

            function wireButtons() {
                const linearBtn = document.getElementById("linearMeasureBtn");
                const rectBtn = document.getElementById("rectMeasureBtn");
                const areaBtn = document.getElementById("areaMeasureBtn");
                const clearBtn = document.getElementById("clearMeasurementsBtn");

                if (linearBtn) {
                    linearBtn.addEventListener("click", () => setActiveTool("linear"));
                }
                if (rectBtn) {
                    rectBtn.addEventListener("click", () => setActiveTool("rectangle"));
                }
                if (areaBtn) {
                    areaBtn.addEventListener("click", () => setActiveTool("area"));
                }
                if (clearBtn) {
                    clearBtn.addEventListener("click", clearMeasurements);
                }
                if (ui.cancelToolBtn) {
                    ui.cancelToolBtn.addEventListener("click", cancelTool);
                }
                if (ui.finishBtn) {
                    ui.finishBtn.addEventListener("click", finalizeActiveTool);
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
            }

            function cancelTool() {
                state.currentTool = null;
                state.measuringPoints = [];
                state.isLinearMeasuring = false;
                state.linearMeasurementLocked = false;
                state.isRectMeasuring = false;
                state.isRectDragging = false;
                hideCancelTool();
                hideFinishButton();
                appContext.planCanvas.style.cursor = "default";
                appContext.setState({ currentTool: null });
            }

            function clearMeasurements() {
                state.measurements = [];
                state.measuringPoints = [];
                updateMeasureInfo();
                cancelTool();
            }

            function finalizeActiveTool() {
                if (!state.currentTool || !tools[state.currentTool]) return;
                const measurement = tools[state.currentTool].finalize(createToolContext());
                if (measurement) {
                    state.measurements.push(measurement);
                    updateMeasureInfo();
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // UI STATE | Display and Button Visibility Management
        // ------------------------------------------------------------

            function updateMeasureInfo() {
                if (!ui.measureInfo) return;
                if (!state.measurements.length) {
                    ui.measureInfo.innerHTML = "No measurements yet.";
                    return;
                }
                let txt = "";
                state.measurements.forEach((m, i) => {
                    if (m.type === "linear") {
                        txt += `Measurement ${i + 1} (Line): ${m.distanceMM} mm<br/>`;
                    } else if (m.type === "area") {
                        txt += `Measurement ${i + 1} (Area): ${m.areaM2} m²<br/>`;
                    } else if (m.type === "rectangle") {
                        txt += `Measurement ${i + 1} (Rectangle): ${m.widthMm} mm × ${m.heightMm} mm = ${m.areaM2} m²<br/>`;
                    }
                });
                ui.measureInfo.innerHTML = txt;
            }

            function showCancelTool() {
                if (ui.cancelToolBtn) {
                    ui.cancelToolBtn.style.display = "block";
                }
            }

            function hideCancelTool() {
                if (ui.cancelToolBtn) {
                    ui.cancelToolBtn.style.display = "none";
                }
            }

            function showFinishButton() {
                if (ui.finishBtn) {
                    ui.finishBtn.style.display = "block";
                }
            }

            function hideFinishButton() {
                if (ui.finishBtn) {
                    ui.finishBtn.style.display = "none";
                }
            }

            function adjustConfirmButtonPosition() {
                if (!ui.finishBtn || !state.currentTool) {
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
                        ui.finishBtn.style.left = (sx + config.confirmButtonOffsets.touch.x) + "px";
                        ui.finishBtn.style.top = (sy + config.confirmButtonOffsets.touch.y) + "px";
                    } else {
                        ui.finishBtn.style.left = (sx + config.confirmButtonOffsets.pc.x) + "px";
                        ui.finishBtn.style.top = (sy + config.confirmButtonOffsets.pc.y) + "px";
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
                        "LINEAR TOOL:\\n\\n" +
                        "This Tool Functions As A Tape Measure\\n" +
                        " \\n" +
                        "1. Click to set the starting point.\\n" +
                        "2. Click and drag the dimension line\\n" +
                        "3. Press 'Confirm' to finalise or 'Cancel Tool' to exit.";
                    displayInstructionsOverlay();
                }
                if (tool === "area" && !state.hasShownAreaInstructions) {
                    state.hasShownAreaInstructions = true;
                    text.innerText =
                        "AREA TOOL:\\n\\n" +
                        "1. Click each corner in turn.\\n" +
                        "2. Press 'Confirm' to close the shape.\\n" +
                        "3. Use 'Cancel Tool' to exit without finishing.";
                    displayInstructionsOverlay();
                }
                if (tool === "rectangle" && !state.hasShownAreaInstructions) {
                    state.hasShownAreaInstructions = true;
                    text.innerText =
                        "RECTANGLE TOOL:\\n\\n" +
                        "1. Click and drag diagonally to draw a rectangle.\\n" +
                        "2. Release to set the size.\\n" +
                        "3. Press 'Confirm' to finalise or 'Cancel Tool' to exit.";
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

                ui.toolsHost = document.getElementById("measurement-tools-host");
                ui.infoHost = document.getElementById("measurement-info-host");
                ui.finishHost = document.getElementById("measurement-finish-host");

                if (config.enabled === true) {
                    injectUi();
                    applyToolVisibility();
                    wireButtons();
                } else {
                    if (ui.toolsHost) ui.toolsHost.innerHTML = "";
                    if (ui.infoHost) ui.infoHost.innerHTML = "";
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
