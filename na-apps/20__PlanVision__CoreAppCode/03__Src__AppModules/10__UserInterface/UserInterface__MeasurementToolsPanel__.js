// =============================================================================
// NOBLE ARCHITECTURE - MEASUREMENT TOOLS PANEL
// =============================================================================
//
// FILE       : UserInterface__MeasurementToolsPanel__.js
// NAMESPACE  : NaPlanVision.UserInterface.MeasurementToolsPanel
// MODULE     : MeasurementToolsPanel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Floating measurement tools dropdown panel UI
// CREATED    : 08-Mar-2026
//
// DESCRIPTION:
// - Builds a floating dropdown panel (top-right) for measurement tool selection
// - Provides icon-based tool buttons with active state feedback
// - Includes a collapsible dimensions section with editable names
// - Supports copy-to-clipboard for all measurement data
// - Runs a prompt animation on init to show users the panel exists
//
// DELEGATES TO:
// - MeasurmentToolsSystem__Main__.js for all measurement logic
// - @delegate: ../30__SystemModules__MeasurmentToolsSytem/MeasurmentToolsSystem__Main__.js
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Measurement Tools Panel
// ----------------------------------------------------------------

    (function () {
        'use strict';

        // #region --------------------------------------------------------
        // CONST | Icon Asset Paths and Tool Definitions
        // ------------------------------------------------------------

            const ICON_BASE_PATH = '02__AppAssets__PlanVision/MeasureToolIcons/';

            const TOOL_DEFINITIONS = [
                {
                    id        : 'linear',
                    label     : 'Linear Measurement',
                    icon      : 'Icon__MeasureTools__LinearMeasurment__.png',
                    btnId     : 'naMeasurePanelLinearBtn'
                },
                {
                    id        : 'rectangle',
                    label     : 'Rectangle Measurement',
                    icon      : 'Icon__MeasureTools__RectangularMeasurment__.png',
                    btnId     : 'naMeasurePanelRectBtn'
                },
                {
                    id        : 'area',
                    label     : 'Area Measurement',
                    icon      : 'Icon__MeasureTools__AreaMeasurment__.png',
                    btnId     : 'naMeasurePanelAreaBtn'
                }
            ];

            const CLEAR_DEFINITION = {
                label     : 'Clear Measurements',
                icon      : 'Icon__MeasureTools__ClearMeasurements__.png',
                btnId     : 'naMeasurePanelClearBtn'
            };

            const HEADER_ICON = 'Icon__MeasureTools__TapeMeasure__.png';

            const PROMPT_OPEN_DELAY_MS       = 1000;
            const PROMPT_VISIBLE_DURATION_MS = 3000;
            const CLOSE_ANIMATION_MS         = 240;

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // STATE | Module State Variables
        // ------------------------------------------------------------

            let panelHost              = null;
            let detailsEl              = null;
            let dimsPanel              = null;
            let dimsArrow              = null;
            let dimsListContainer      = null;
            let copyBtn                = null;
            let measurementNames       = {};
            let isPromptAnimating      = false;

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // DOM BUILDER | Construct the floating panel HTML
        // ------------------------------------------------------------

            function buildPanelHtml() {
                const toolButtonsHtml = TOOL_DEFINITIONS.map(function (tool) {
                    return (
                        '<li class="na-measure-panel__item">' +
                            '<button class="na-measure-panel__tool-btn" id="' + tool.btnId + '">' +
                                '<img class="na-measure-panel__tool-icon" ' +
                                    'src="' + ICON_BASE_PATH + tool.icon + '" ' +
                                    'alt="' + tool.label + '">' +
                                '<span class="na-measure-panel__tool-label">' + tool.label + '</span>' +
                            '</button>' +
                        '</li>'
                    );
                }).join('');

                const clearButtonHtml =
                    '<li class="na-measure-panel__item">' +
                        '<button class="na-measure-panel__tool-btn na-measure-panel__tool-btn--danger" ' +
                            'id="' + CLEAR_DEFINITION.btnId + '">' +
                            '<img class="na-measure-panel__tool-icon" ' +
                                'src="' + ICON_BASE_PATH + CLEAR_DEFINITION.icon + '" ' +
                                'alt="' + CLEAR_DEFINITION.label + '">' +
                            '<span class="na-measure-panel__tool-label">' + CLEAR_DEFINITION.label + '</span>' +
                        '</button>' +
                    '</li>';

                return (
                    '<div class="na-measure-panel">' +
                        '<details class="na-measure-panel__details" id="naMeasureToolsDetails">' +
                            '<summary class="na-measure-panel__summary">' +
                                '<img class="na-measure-panel__summary-icon" ' +
                                    'src="' + ICON_BASE_PATH + HEADER_ICON + '" ' +
                                    'alt="Measurement Tools">' +
                                '<span class="na-measure-panel__summary-title">Measurement Tools</span>' +
                                '<span class="na-measure-panel__arrow">&#9662;</span>' +
                            '</summary>' +
                            '<ul class="na-measure-panel__list">' +
                                toolButtonsHtml +
                                '<li class="na-measure-panel__item">' +
                                    '<div class="na-measure-panel__divider"></div>' +
                                '</li>' +
                                clearButtonHtml +
                                '<li class="na-measure-panel__item">' +
                                    '<div class="na-measure-panel__divider"></div>' +
                                '</li>' +
                                '<li class="na-measure-panel__dims-item">' +
                                    '<button class="na-measure-panel__dims-toggle" id="naMeasurePanelDimsToggle">' +
                                        '<span>Dimensions</span>' +
                                        '<span class="na-measure-panel__dims-arrow" id="naMeasurePanelDimsArrow">&#9662;</span>' +
                                    '</button>' +
                                    '<div class="na-measure-panel__dims-panel" id="naMeasurePanelDimsPanel">' +
                                        '<div class="na-measure-panel__dims-list" id="naMeasurePanelDimsList">' +
                                            '<div class="na-measure-panel__dims-empty">No measurements yet.</div>' +
                                        '</div>' +
                                        '<button class="na-measure-panel__copy-btn" id="naMeasurePanelCopyBtn">' +
                                            'Copy All to Clipboard' +
                                        '</button>' +
                                    '</div>' +
                                '</li>' +
                            '</ul>' +
                        '</details>' +
                    '</div>'
                );
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EVENT WIRING | Attach click handlers to panel buttons
        // ------------------------------------------------------------

            function wireToolButtons() {
                var measureSystem = getMeasureSystem();
                if (!measureSystem) return;

                TOOL_DEFINITIONS.forEach(function (tool) {
                    var btn = document.getElementById(tool.btnId);
                    if (btn) {
                        btn.addEventListener('click', function () {
                            measureSystem.Na__Measure__ActivateToolByName(tool.id);
                        });
                    }
                });

                var clearBtn = document.getElementById(CLEAR_DEFINITION.btnId);
                if (clearBtn) {
                    clearBtn.addEventListener('click', function () {
                        measureSystem.Na__Measure__ClearMeasurements();
                    });
                }
            }

            function wireDimensionsToggle() {
                var toggleBtn = document.getElementById('naMeasurePanelDimsToggle');
                dimsPanel    = document.getElementById('naMeasurePanelDimsPanel');
                dimsArrow    = document.getElementById('naMeasurePanelDimsArrow');

                if (toggleBtn && dimsPanel) {
                    toggleBtn.addEventListener('click', function () {
                        var isOpen = dimsPanel.classList.contains('is-open');
                        dimsPanel.classList.toggle('is-open', !isOpen);
                        if (dimsArrow) {
                            dimsArrow.classList.toggle('na-measure-panel__dims-arrow--open', !isOpen);
                        }
                    });
                }

                dimsListContainer = document.getElementById('naMeasurePanelDimsList');
                copyBtn           = document.getElementById('naMeasurePanelCopyBtn');

                if (copyBtn) {
                    copyBtn.addEventListener('click', Na__MeasurePanel__CopyToClipboard);
                }
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // HELPERS | Utility Functions
        // ------------------------------------------------------------

            function getMeasureSystem() {
                return window.NaPlanVision
                    && window.NaPlanVision.MeasurmentToolsSystem
                    && window.NaPlanVision.MeasurmentToolsSystem.Main;
            }

            function formatMeasurementValue(measurement) {
                if (measurement.type === 'linear') {
                    return measurement.distanceMM + ' mm';
                }
                if (measurement.type === 'area') {
                    return measurement.areaM2 + ' m\u00B2';
                }
                if (measurement.type === 'rectangle') {
                    return measurement.widthMm + ' mm \u00D7 ' +
                           measurement.heightMm + ' mm = ' +
                           measurement.areaM2 + ' m\u00B2';
                }
                return '';
            }

            function getMeasurementTypeLabel(type) {
                if (type === 'linear')    return 'Line';
                if (type === 'area')      return 'Area';
                if (type === 'rectangle') return 'Rect';
                return type;
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // ACTIVE TOOL STATE | Visual feedback for active tool
        // ------------------------------------------------------------

            const Na__MeasurePanel__SetActiveTool = function (toolName) {
                TOOL_DEFINITIONS.forEach(function (tool) {
                    var btn = document.getElementById(tool.btnId);
                    if (!btn) return;
                    if (tool.id === toolName) {
                        btn.classList.add('na-measure-panel__tool-btn--active');
                    } else {
                        btn.classList.remove('na-measure-panel__tool-btn--active');
                    }
                });
            };

            const Na__MeasurePanel__ClearActiveTool = function () {
                TOOL_DEFINITIONS.forEach(function (tool) {
                    var btn = document.getElementById(tool.btnId);
                    if (btn) {
                        btn.classList.remove('na-measure-panel__tool-btn--active');
                    }
                });
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // DIMENSIONS LIST | Render and manage measurement entries
        // ------------------------------------------------------------

            const Na__MeasurePanel__UpdateDimensions = function (measurements) {
                if (!dimsListContainer) return;

                if (!measurements || measurements.length === 0) {
                    dimsListContainer.innerHTML =
                        '<div class="na-measure-panel__dims-empty">No measurements yet.</div>';
                    return;
                }

                var html = '';
                measurements.forEach(function (m, i) {
                    var index       = i + 1;
                    var typeLabel   = getMeasurementTypeLabel(m.type);
                    var valueStr    = formatMeasurementValue(m);
                    var storedName  = measurementNames[i] || '';

                    html +=
                        '<div class="na-measure-panel__dim-row" data-dim-index="' + i + '">' +
                            '<span class="na-measure-panel__dim-index">' + index + '.</span>' +
                            '<input class="na-measure-panel__dim-name" ' +
                                'type="text" ' +
                                'placeholder="Name..." ' +
                                'value="' + escapeAttr(storedName) + '" ' +
                                'data-dim-idx="' + i + '">' +
                            '<span class="na-measure-panel__dim-value" title="' + typeLabel + ': ' + valueStr + '">' +
                                valueStr +
                            '</span>' +
                        '</div>';
                });

                dimsListContainer.innerHTML = html;

                var nameInputs = dimsListContainer.querySelectorAll('.na-measure-panel__dim-name');
                nameInputs.forEach(function (input) {
                    input.addEventListener('input', function () {
                        var idx = parseInt(input.getAttribute('data-dim-idx'), 10);
                        measurementNames[idx] = input.value;
                    });
                });
            };

            function escapeAttr(str) {
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            const Na__MeasurePanel__GetMeasurementNames = function () {
                return Object.assign({}, measurementNames);
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // CLIPBOARD | Copy formatted measurements to clipboard
        // ------------------------------------------------------------

            const Na__MeasurePanel__CopyToClipboard = function () {
                var measureSystem = getMeasureSystem();
                if (!measureSystem) return;

                var measurements = measureSystem.Na__Measure__GetMeasurements();
                if (!measurements || measurements.length === 0) {
                    showCopyFeedback('No measurements to copy');
                    return;
                }

                var lines = measurements.map(function (m, i) {
                    var index    = i + 1;
                    var name     = measurementNames[i] || '';
                    var valueStr = formatMeasurementValue(m);
                    var nameStr  = name ? ' (' + name + ')' : '';
                    return 'Measurement ' + index + nameStr + ': ' + valueStr;
                });

                var text = lines.join('\n');

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        showCopyFeedback('Copied!');
                    }).catch(function () {
                        fallbackCopy(text);
                    });
                } else {
                    fallbackCopy(text);
                }
            };

            function fallbackCopy(text) {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showCopyFeedback('Copied!');
                } catch (err) {
                    showCopyFeedback('Copy failed');
                }
                document.body.removeChild(textarea);
            }

            function showCopyFeedback(message) {
                if (!copyBtn) return;
                var originalText = copyBtn.textContent;
                copyBtn.textContent = message;
                copyBtn.classList.add('na-measure-panel__copy-btn--copied');
                setTimeout(function () {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('na-measure-panel__copy-btn--copied');
                }, 1500);
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // PROMPT ANIMATION | Open-then-close on app launch
        // ------------------------------------------------------------

            function runPromptAnimation() {
                if (!detailsEl) return;
                isPromptAnimating = true;

                setTimeout(function () {
                    if (!detailsEl) return;
                    detailsEl.setAttribute('open', 'open');

                    setTimeout(function () {
                        if (!detailsEl) return;
                        detailsEl.classList.add('na-measure-panel__details--closing');

                        setTimeout(function () {
                            if (!detailsEl) return;
                            detailsEl.removeAttribute('open');
                            detailsEl.classList.remove('na-measure-panel__details--closing');
                            isPromptAnimating = false;
                        }, CLOSE_ANIMATION_MS);
                    }, PROMPT_VISIBLE_DURATION_MS);
                }, PROMPT_OPEN_DELAY_MS);
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // CALLBACKS | Handlers for measurement system events
        // ------------------------------------------------------------

            function onToolChange(toolName) {
                if (toolName) {
                    Na__MeasurePanel__SetActiveTool(toolName);
                } else {
                    Na__MeasurePanel__ClearActiveTool();
                }
            }

            function onMeasurementChange(measurements) {
                Na__MeasurePanel__UpdateDimensions(measurements);
            }

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // INITIALIZATION | Module Setup
        // ------------------------------------------------------------

            const Na__MeasurePanel__Initialize = function (context) {
                console.log('[MeasurementToolsPanel] Initializing...');

                panelHost = document.getElementById('measurement-tools-panel-host');
                if (!panelHost) {
                    console.warn('[MeasurementToolsPanel] Host element #measurement-tools-panel-host not found');
                    return;
                }

                panelHost.innerHTML = buildPanelHtml();

                detailsEl = document.getElementById('naMeasureToolsDetails');

                wireToolButtons();
                wireDimensionsToggle();

                var measureSystem = getMeasureSystem();
                if (measureSystem) {
                    measureSystem.Na__Measure__SetOnToolChange(onToolChange);
                    measureSystem.Na__Measure__SetOnMeasurementChange(onMeasurementChange);
                }

                runPromptAnimation();

                console.log('[MeasurementToolsPanel] Initialized successfully');
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module API
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.MeasurementToolsPanel = {
                Na__MeasurePanel__Initialize          : Na__MeasurePanel__Initialize,
                Na__MeasurePanel__UpdateDimensions     : Na__MeasurePanel__UpdateDimensions,
                Na__MeasurePanel__SetActiveTool         : Na__MeasurePanel__SetActiveTool,
                Na__MeasurePanel__ClearActiveTool       : Na__MeasurePanel__ClearActiveTool,
                Na__MeasurePanel__GetMeasurementNames   : Na__MeasurePanel__GetMeasurementNames,
                Na__MeasurePanel__CopyToClipboard       : Na__MeasurePanel__CopyToClipboard
            };

            console.log('[MeasurementToolsPanel] Module loaded and registered');

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
