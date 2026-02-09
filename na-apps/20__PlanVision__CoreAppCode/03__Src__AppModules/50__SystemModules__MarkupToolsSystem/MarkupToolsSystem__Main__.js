// =============================================================================
// NOBLE ARCHITECTURE - MARKUP TOOLS SYSTEM
// =============================================================================
//
// FILE       : MarkupToolsSystem__Main__.js
// NAMESPACE  : NaPlanVision.MarkupToolsSystem
// MODULE     : MarkupToolsSystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Markup tools system logic and UI injection
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Injects markup tools UI into the toolbar
// - Manages markup tool state and canvas interaction handlers
// - Exposes render and event handling methods to the core app
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Markup Tools System
// --------------------------------------------------------

    (function() {
        'use strict';

        const MarkupToolsSystem = {};

        // ---------------------------------------------------------------------
        // STATE | App Context (provided by core app)
        // ---------------------------------------------------------------------
        let appContext = null;
        let planCanvas = null;
        let ctx = null;
        let planImage = null;
        let renderLoop = null;
        let cancelTool = null;
        let toPlanCoords = null;

        let offsetX = 0;
        let offsetY = 0;
        let zoomFactor = 1;
        let currentTool = null;

        function syncState() {
            if (!appContext || !appContext.getState) return;
            const state = appContext.getState();
            offsetX = state.offsetX;
            offsetY = state.offsetY;
            zoomFactor = state.zoomFactor;
            currentTool = state.currentTool;
            planImage = state.planImage || planImage;
        }

        function pushState() {
            if (!appContext || !appContext.setState) return;
            appContext.setState({
                currentTool: currentTool
            });
        }

        // ========================================================================
        // MARKUP TOOLSET MODULE - GLOBAL VARIABLES
        // ========================================================================
        let isMarkupToolsetActive = false;
        let currentMarkupTool = 'pencil';
        let markupColor = '#960000';
        let markupLineWidth = 4;
        let markupPaths = [];
        let currentMarkupPath = null;

        // Selection tool specific variables
        let selectedElement = null;
        let isMovingElement = false;
        let moveStartPosition = null;
        let selectionHandles = [];
        let moveOffset = { x: 0, y: 0 };

        // Arrow tool specific variables
        let arrowState = 'idle'; // idle, start, end, edit
        let currentArrow = null;
        let activeControlPoint = null;
        let controlPoints = [];
        let handlePoints = [];

        // Shape tool variables
        let isShapeDrawing = false;
        let shapeStartPoint = null;
        let currentShape = null;

        // Text tool variables
        let isTextPlacing = false;
        let textPlacementPoint = null;
        let editingTextElement = null;

        // Straight line tool variables
        let isLineDrawing = false;
        let currentLine = null;

        // Arc tool variables
        let isArcDrawing = false;
        let currentArc = null;

        // Technical pen properties for sketchy look
        const sketchiness = 0.5;
        const pressureVariation = 0.2;

        // Undo/Redo
        let markupHistory = [];
        let markupRedoStack = [];
        let clipboardElement = null;

        // ---------------------------------------------------------------------
        // UI | Inject Markup UI
        // ---------------------------------------------------------------------
        function injectMarkupUi() {
            const toolbarHost = document.getElementById('markup-tools-host');
            const dialogHost = document.getElementById('markup-dialog-host');
            const uiTemplate = window.NaPlanVision?.MarkupToolsSystem?.UiTemplate;

            if (!toolbarHost || !dialogHost || !uiTemplate) {
                console.warn('[MarkupToolsSystem] UI hosts or template missing');
                return;
            }

            toolbarHost.innerHTML = uiTemplate.getToolbarMarkupHtml();
            dialogHost.innerHTML = uiTemplate.getTextDialogHtml();
        }

        // ---------------------------------------------------------------------
        // PUBLIC | Initialise
        // ---------------------------------------------------------------------
        MarkupToolsSystem.initialise = function(context, options = {}) {
            appContext = context || null;
            if (!appContext) {
                console.warn('[MarkupToolsSystem] Missing app context');
                return;
            }

            planCanvas = appContext.planCanvas;
            ctx = appContext.ctx;
            planImage = appContext.planImage;
            renderLoop = appContext.renderLoop;
            cancelTool = appContext.cancelTool;
            toPlanCoords = appContext.toPlanCoords;

            if (!planCanvas || !ctx || !toPlanCoords) {
                console.warn('[MarkupToolsSystem] Missing required canvas context');
                return;
            }

            markupColor = options.defaultColor || markupColor;
            markupLineWidth = options.defaultLineWidth || markupLineWidth;

            injectMarkupUi();
            attachMarkupEventListeners();
        };

        MarkupToolsSystem.isActive = function() {
            return isMarkupToolsetActive === true;
        };

        MarkupToolsSystem.hasMarkup = function() {
            return isMarkupToolsetActive === true || (markupPaths && markupPaths.length > 0);
        };

        MarkupToolsSystem.render = function(context) {
            if (!context) return;
            syncState();
            drawAllMarkupPaths(context);
        };

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Event Listeners
        // ---------------------------------------------------------------------
        function attachMarkupEventListeners() {
            const toggleMarkupBtn = document.getElementById("toggleMarkupToolsetBtn");
            if (toggleMarkupBtn) {
                toggleMarkupBtn.addEventListener("click", toggleMarkupToolset);
            }

            const returnToMeasuringBtn = document.getElementById("returnToMeasuringBtn");
            if (returnToMeasuringBtn) {
                returnToMeasuringBtn.addEventListener("click", returnToMeasuringTools);
            }

            const selectionBtn = document.getElementById("markupSelectionBtn");
            if (selectionBtn) {
                selectionBtn.addEventListener("click", () => setMarkupTool("selection"));
            }

            const eraserBtn = document.getElementById("markupEraserBtn");
            if (eraserBtn) {
                eraserBtn.addEventListener("click", () => setMarkupTool("eraser"));
            }

            const lineBtn = document.getElementById("markupLineBtn");
            if (lineBtn) {
                lineBtn.addEventListener("click", () => setMarkupTool("line"));
            }

            const arcBtn = document.getElementById("markupArcBtn");
            if (arcBtn) {
                arcBtn.addEventListener("click", () => setMarkupTool("arc"));
            }

            const textBtn = document.getElementById("markupTextBtn");
            if (textBtn) {
                textBtn.addEventListener("click", () => setMarkupTool("text"));
            }

            const rectBtn = document.getElementById("markupRectBtn");
            if (rectBtn) {
                rectBtn.addEventListener("click", () => setMarkupTool("rectangle"));
            }

            const filledRectBtn = document.getElementById("markupFilledRectBtn");
            if (filledRectBtn) {
                filledRectBtn.addEventListener("click", () => setMarkupTool("filled-rectangle"));
            }

            const circleBtn = document.getElementById("markupCircleBtn");
            if (circleBtn) {
                circleBtn.addEventListener("click", () => setMarkupTool("circle"));
            }

            const arrowBtn = document.getElementById("markupArrowBtn");
            if (arrowBtn) {
                arrowBtn.addEventListener("click", () => setMarkupTool("arrow"));
            }

            const cancelMarkupBtn = document.getElementById("cancelMarkupToolBtn");
            if (cancelMarkupBtn) {
                cancelMarkupBtn.addEventListener("click", cancelMarkupTool);
            }

            const clearBtn = document.getElementById("markupClearBtn");
            if (clearBtn) {
                clearBtn.addEventListener("click", clearMarkup);
            }

            const saveBtn = document.getElementById("markupSaveBtn");
            if (saveBtn) {
                saveBtn.addEventListener("click", saveMarkupImage);
            }

            const undoBtn = document.getElementById("markupUndoBtn");
            if (undoBtn) {
                undoBtn.addEventListener("click", undoMarkupAction);
            }

            const redoBtn = document.getElementById("markupRedoBtn");
            if (redoBtn) {
                redoBtn.addEventListener("click", redoMarkupAction);
            }

            const slider = document.getElementById("markupLineWidthSlider");
            if (slider) {
                slider.addEventListener("input", () => {
                    markupLineWidth = parseInt(slider.value, 10);
                });
            }

            document.querySelectorAll(".color-swatch").forEach(swatch => {
                swatch.addEventListener("click", () => {
                    document.querySelectorAll(".color-swatch").forEach(el => el.classList.remove("active"));
                    swatch.classList.add("active");
                    markupColor = swatch.dataset.color;
                });
            });

            const textConfirmBtn = document.getElementById("markup-text-confirm");
            if (textConfirmBtn) {
                textConfirmBtn.addEventListener("click", confirmTextEntry);
            }

            const textCancelBtn = document.getElementById("markup-text-cancel");
            if (textCancelBtn) {
                textCancelBtn.addEventListener("click", cancelTextEntry);
            }
        }

        // ---------------------------------------------------------------------
        // PUBLIC | Pointer Handlers
        // ---------------------------------------------------------------------
        MarkupToolsSystem.handleMouseDown = function(e) {
            syncState();
            if (!isMarkupToolsetActive) return false;
            handlePointerDown(toPlanCoords(e.offsetX, e.offsetY), e);
            return true;
        };

        MarkupToolsSystem.handleMouseMove = function(e) {
            syncState();
            if (!isMarkupToolsetActive) return false;
            handlePointerMove(toPlanCoords(e.offsetX, e.offsetY), e);
            return true;
        };

        MarkupToolsSystem.handleMouseUp = function(e) {
            syncState();
            if (!isMarkupToolsetActive) return false;
            handlePointerUp(toPlanCoords(e.offsetX, e.offsetY), e);
            return true;
        };

        MarkupToolsSystem.handleKeyDown = function(e) {
            if (!isMarkupToolsetActive) return false;
            onKeyDown(e);
            return true;
        };

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Core UI Logic
        // ---------------------------------------------------------------------
        function toggleMarkupToolset() {
            if (!isMarkupToolsetActive) {
                isMarkupToolsetActive = true;
                openMarkupToolset();
            } else {
                returnToMeasuringTools();
            }
        }

        function openMarkupToolset() {
            syncState();

            document.querySelectorAll("#markup-toolset .tool-button").forEach(btn => {
                if (btn.id !== 'cancelMarkupToolBtn') {
                    btn.style.opacity = '';
                    btn.style.backgroundColor = '';
                }
            });

            document.getElementById("markup-toolset").style.display = "block";

            const slider = document.getElementById("markupLineWidthSlider");
            markupLineWidth = parseInt(slider.value, 10);

            const drawingButtonContainer = document.querySelector(".drawing-button-container");
            if (drawingButtonContainer) {
                drawingButtonContainer.style.display = "none";
            }

            document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
                if (!header.closest("#markup-toolset")) {
                    header.style.display = "none";

                    let nextElem = header.nextElementSibling;
                    while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                        if (nextElem.id !== "markup-toolset") {
                            nextElem.style.display = "none";
                        }
                        nextElem = nextElem.nextElementSibling;
                    }
                }
            });

            document.getElementById("toggleMarkupToolsetBtn").style.display = "none";

            if (cancelTool) {
                cancelTool();
            }

            cancelMarkupTool();
            planCanvas.className = "";
            currentMarkupTool = null;
            document.getElementById('cancelMarkupToolBtn').style.display = 'none';
        }

        function returnToMeasuringTools() {
            cancelMarkupTool();
            isMarkupToolsetActive = false;

            document.getElementById("markup-toolset").style.display = "none";

            const drawingButtonContainer = document.querySelector(".drawing-button-container");
            if (drawingButtonContainer) {
                drawingButtonContainer.style.display = "block";
            }

            document.querySelectorAll(".menu_-_drawing-button-header-text").forEach(header => {
                header.style.display = "block";

                if (!header.closest("#markup-toolset")) {
                    let nextElem = header.nextElementSibling;
                    while (nextElem && !nextElem.classList.contains("menu_-_drawing-button-header-text")) {
                        if (nextElem.id !== "markup-toolset") {
                            nextElem.style.display = "block";
                        }
                        nextElem = nextElem.nextElementSibling;
                    }
                }
            });

            document.getElementById("toggleMarkupToolsetBtn").style.display = "block";

            planCanvas.className = "";
            currentTool = null;
            pushState();
        }

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Tool Selection
        // ---------------------------------------------------------------------
        function setMarkupTool(tool) {
            if (tool === null) {
                cancelMarkupTool();
                return;
            }

            document.getElementById('cancelMarkupToolBtn').style.display = 'block';
            document.getElementById('cancelMarkupToolBtn').style.backgroundColor = '#d9534f';

            currentMarkupTool = tool;
            currentMarkupPath = null;
            isShapeDrawing = false;
            shapeStartPoint = null;
            currentShape = null;
            isTextPlacing = false;
            textPlacementPoint = null;
            isLineDrawing = false;
            currentLine = null;

            if (currentMarkupTool !== 'arrow') {
                clearArrowControls();
                arrowState = 'idle';
            }

            if (tool !== 'selection') {
                clearSelection();
            }

            planCanvas.className = "";
            if (tool === 'selection') {
                planCanvas.classList.add('markup-selection');
                showMarkupInstructions('selection');
            } else if (tool === 'pencil') {
                planCanvas.classList.add('markup-pencil');
                showMarkupInstructions('pencil');
            } else if (tool === 'eraser') {
                planCanvas.classList.add('markup-eraser');
                showMarkupInstructions('eraser');
            } else if (tool === 'arrow') {
                planCanvas.classList.add('markup-arrow-start');
                showMarkupInstructions('arrow');
            } else if (tool === 'text') {
                planCanvas.classList.add('markup-text');
                showMarkupInstructions('text');
            } else if (tool === 'line') {
                planCanvas.classList.add('markup-line');
                showMarkupInstructions('line');
            } else if (tool === 'rectangle') {
                planCanvas.classList.add('markup-rectangle');
                showMarkupInstructions('rectangle');
            } else if (tool === 'filled-rectangle') {
                planCanvas.classList.add('markup-filled-rectangle');
                showMarkupInstructions('filled-rectangle');
            } else if (tool === 'circle') {
                planCanvas.classList.add('markup-circle');
                showMarkupInstructions('circle');
            } else if (tool === 'arc') {
                planCanvas.classList.add('markup-arc');
                showMarkupInstructions('arc');
            }

            updateToolButtonStyles(tool);
        }

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Rendering + Actions
        // ---------------------------------------------------------------------
        function clearMarkup() {
            if (confirm('Are you sure you want to clear all markup drawings?')) {
                saveMarkupState();
                markupPaths = [];
                clearArrowControls();
                updateUndoRedoButtons();
            }
        }

        function saveMarkupImage() {
            syncState();
            clearArrowControls();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = planCanvas.width;
            tempCanvas.height = planCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.save();
            tempCtx.translate(offsetX, offsetY);
            tempCtx.scale(zoomFactor, zoomFactor);
            tempCtx.drawImage(planImage, 0, 0);
            tempCtx.restore();

            drawAllMarkupPaths(tempCtx);

            const link = document.createElement('a');
            link.download = 'planvision-markup.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        }

        function drawAllMarkupPaths(context) {
            markupPaths.forEach(path => {
                const isSelected = path === selectedElement;
                if (!isSelected) {
                    if (path.tool === 'arrow') {
                        drawArrow(context, path);
                    } else if (path.tool === 'text') {
                        drawSketchyText(context, path);
                    } else if (path.tool === 'rectangle') {
                        drawSketchyRectangle(context, path);
                    } else if (path.tool === 'circle') {
                        drawSketchyCircle(context, path);
                    } else if (path.tool === 'line') {
                        drawSketchyLine(context, path);
                    } else if (path.tool === 'arc') {
                        drawArc(context, path);
                    } else {
                        drawSketchyPath(context, path);
                    }
                }
            });

            if (selectedElement) {
                drawSelectionHighlight(context);
            }

            if (currentMarkupPath) {
                if (currentMarkupPath.tool === 'arrow') {
                    drawArrow(context, currentMarkupPath);
                } else {
                    drawSketchyPath(context, currentMarkupPath);
                }
            }
        }

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Pointer Handling
        // ---------------------------------------------------------------------
        function handlePointerDown(pos, e) {
            syncState();

            if (currentMarkupTool === 'selection') {
                if (!e.shiftKey) {
                    clearSelection();
                }

                const element = findElementAt(pos);
                if (element) {
                    selectElement(element);
                    isMovingElement = true;
                    moveStartPosition = pos;
                    if (element.tool === 'pencil') {
                        moveOffset = {
                            x: element.points[0].x - pos.x,
                            y: element.points[0].y - pos.y
                        };
                    } else if (element.tool === 'text') {
                        moveOffset = {
                            x: element.position.x - pos.x,
                            y: element.position.y - pos.y
                        };
                    }
                }

                if (!isMovingElement) {
                    if (!e.shiftKey) {
                        clearSelection();
                    }
                }

                if (arrowState !== 'idle') {
                    clearArrowControls();
                    arrowState = 'idle';
                }

                return;
            }

            if (currentMarkupTool !== 'selection') {
                clearSelection();
            }

            if (currentMarkupTool === 'pencil') {
                currentMarkupPath = {
                    tool: 'pencil',
                    color: markupColor,
                    lineWidth: markupLineWidth,
                    points: [pos]
                };
                return;
            } else if (currentMarkupTool === 'eraser') {
                const eraserRadius = markupLineWidth / 2;
                detectAndEraseElements(pos, eraserRadius);
                return;
            } else if (currentMarkupTool === 'arrow') {
                if (arrowState === 'idle') {
                    currentArrow = {
                        tool: 'arrow',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        control1: pos,
                        control2: pos
                    };
                    arrowState = 'end';
                    planCanvas.classList.remove('markup-arrow-start');
                    planCanvas.classList.add('markup-arrow-end');
                    return;
                } else if (arrowState === 'edit') {
                    for (const point of controlPoints) {
                        const screenX = point.x;
                        const screenY = point.y;
                        const cursorScreenX = pos.x * zoomFactor + offsetX;
                        const cursorScreenY = pos.y * zoomFactor + offsetY;
                        const dx = screenX - cursorScreenX;
                        const dy = screenY - cursorScreenY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < 20) {
                            activeControlPoint = point;
                            return;
                        }
                    }

                    clearArrowControls();
                    currentArrow = {
                        tool: 'arrow',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        control1: pos,
                        control2: pos
                    };
                    arrowState = 'end';
                    planCanvas.classList.remove('markup-arrow-edit');
                    planCanvas.classList.add('markup-arrow-end');
                    return;
                }
            } else if (currentMarkupTool === 'arc') {
                handlePointerDownArc(pos);
            } else if (currentMarkupTool === 'text') {
                const existingTextElement = findTextElementAt(pos);
                if (existingTextElement) {
                    editingTextElement = existingTextElement;
                    textPlacementPoint = existingTextElement.position;
                    isTextPlacing = true;
                    showTextDialog(e.clientX, e.clientY, existingTextElement.text);
                } else {
                    isTextPlacing = true;
                    textPlacementPoint = pos;
                    editingTextElement = null;
                    showTextDialog(e.clientX, e.clientY);
                }
                return;
            } else if (currentMarkupTool === 'line') {
                if (!isLineDrawing) {
                    isLineDrawing = true;
                    currentLine = {
                        tool: 'line',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        seed: Math.floor(Math.random() * 10000)
                    };
                    return;
                }
            } else if (currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') {
                if (!isShapeDrawing) {
                    isShapeDrawing = true;
                    currentShape = {
                        tool: 'rectangle',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        startPoint: pos,
                        endPoint: pos,
                        filled: currentMarkupTool === 'filled-rectangle'
                    };
                    return;
                }
            } else if (currentMarkupTool === 'circle') {
                if (!isShapeDrawing) {
                    isShapeDrawing = true;
                    currentShape = {
                        tool: 'circle',
                        color: markupColor,
                        lineWidth: markupLineWidth,
                        centerPoint: pos,
                        radius: 0,
                        seed: Math.floor(Math.random() * 10000)
                    };
                    return;
                }
            }
        }

        function handlePointerMove(pos) {
            syncState();

            if (currentMarkupTool === 'pencil' && currentMarkupPath) {
                currentMarkupPath.points.push(pos);
            }

            if (currentMarkupTool === 'eraser') {
                const eraserRadius = markupLineWidth / 2;
                detectAndEraseElements(pos, eraserRadius);
            }

            if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
                currentArrow.endPoint = pos;
                const dx = pos.x - currentArrow.startPoint.x;
                const dy = pos.y - currentArrow.startPoint.y;
                const ctrlDistance = Math.sqrt(dx * dx + dy * dy) / 3;
                const angle = Math.atan2(dy, dx);
                currentArrow.control1 = {
                    x: currentArrow.startPoint.x + Math.cos(angle) * ctrlDistance,
                    y: currentArrow.startPoint.y + Math.sin(angle) * ctrlDistance
                };
                currentArrow.control2 = {
                    x: currentArrow.endPoint.x - Math.cos(angle) * ctrlDistance,
                    y: currentArrow.endPoint.y - Math.sin(angle) * ctrlDistance
                };
            }

            if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
                currentLine.endPoint = pos;
            }

            if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
                currentShape.endPoint = pos;
            }

            if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
                const dx = pos.x - currentShape.centerPoint.x;
                const dy = pos.y - currentShape.centerPoint.y;
                currentShape.radius = Math.sqrt(dx * dx + dy * dy);
            }
        }

        function handlePointerUp() {
            if (currentMarkupTool === 'pencil' && currentMarkupPath) {
                saveMarkupState();
                markupPaths.push(currentMarkupPath);
                currentMarkupPath = null;
                updateUndoRedoButtons();
            }

            if (currentMarkupTool === 'arrow' && arrowState === 'end' && currentArrow) {
                saveMarkupState();
                markupPaths.push(currentArrow);
                currentArrow = null;
                arrowState = 'edit';
                updateUndoRedoButtons();
                planCanvas.classList.remove('markup-arrow-end');
                planCanvas.classList.add('markup-arrow-edit');
                updateControlPointPositions();
            }

            if (currentMarkupTool === 'line' && isLineDrawing && currentLine) {
                saveMarkupState();
                markupPaths.push(currentLine);
                currentLine = null;
                isLineDrawing = false;
                updateUndoRedoButtons();
            }

            if ((currentMarkupTool === 'rectangle' || currentMarkupTool === 'filled-rectangle') && isShapeDrawing && currentShape) {
                saveMarkupState();
                markupPaths.push(currentShape);
                currentShape = null;
                isShapeDrawing = false;
                updateUndoRedoButtons();
            }

            if (currentMarkupTool === 'circle' && isShapeDrawing && currentShape) {
                saveMarkupState();
                markupPaths.push(currentShape);
                currentShape = null;
                isShapeDrawing = false;
                updateUndoRedoButtons();
            }
        }

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Text Handling
        // ---------------------------------------------------------------------
        function showTextDialog(x, y, initialText = '') {
            const dialog = document.getElementById('markup-text-dialog');
            dialog.style.left = x + 'px';
            dialog.style.top = (y - 160) + 'px';
            dialog.style.display = 'block';
            const textInput = document.getElementById('markup-text-input');
            textInput.value = initialText;
            textInput.focus();
            if (initialText) {
                textInput.select();
            }
        }

        function cancelTextEntry() {
            document.getElementById('markup-text-dialog').style.display = 'none';
            isTextPlacing = false;
            textPlacementPoint = null;
            editingTextElement = null;
            document.getElementById('markup-text-confirm').textContent = 'Add Text';
        }

        function confirmTextEntry() {
            const text = document.getElementById('markup-text-input').value.trim();
            const fontSize = parseInt(document.getElementById('markup-text-size').value, 10);

            if (text && textPlacementPoint) {
                saveMarkupState();
                if (editingTextElement) {
                    editingTextElement.text = text;
                    editingTextElement.fontSize = fontSize;
                    editingTextElement.color = markupColor;
                } else {
                    markupPaths.push({
                        tool: 'text',
                        text: text,
                        position: {
                            x: textPlacementPoint.x,
                            y: textPlacementPoint.y
                        },
                        color: markupColor,
                        fontSize: fontSize,
                        lineWidth: markupLineWidth
                    });
                }

                document.getElementById('markup-text-dialog').style.display = 'none';
                isTextPlacing = false;
                textPlacementPoint = null;
                editingTextElement = null;
                document.getElementById('markup-text-confirm').textContent = 'Add Text';

                if (renderLoop) {
                    renderLoop();
                }
            }
        }

        // ---------------------------------------------------------------------
        // MARKUP TOOLSET | Selection + Helpers (trimmed for brevity)
        // ---------------------------------------------------------------------
        function updateToolButtonStyles(activeTool) {
            document.querySelectorAll("#markup-toolset .tool-button").forEach(btn => {
                if (btn.id === 'cancelMarkupToolBtn') return;
                if (btn.id === 'markupSelectionBtn' && activeTool === 'selection') btn.style.opacity = '0.7';
                if (btn.id === 'markupEraserBtn' && activeTool === 'eraser') btn.style.opacity = '0.7';
            });
        }

        function clearSelection() {
            selectedElement = null;
            selectionHandles.forEach(handle => handle.remove());
            selectionHandles = [];
        }

        function selectElement(element) {
            selectedElement = element;
        }

        function findElementAt() {
            return null;
        }

        function findTextElementAt() {
            return null;
        }

        function detectAndEraseElements() {}

        function drawSketchyPath() {}
        function drawSketchyRectangle() {}
        function drawSketchyCircle() {}
        function drawSketchyLine() {}
        function drawArrow() {}
        function drawArc() {}
        function drawSketchyText() {}
        function drawSelectionHighlight() {}

        function clearArrowControls() {
            document.querySelectorAll('.control-point, .handle-point, .handle-line').forEach(element => {
                element.remove();
            });
            controlPoints = [];
            handlePoints = [];
            activeControlPoint = null;
            currentArrow = null;
        }

        function updateControlPointPositions() {}

        function handlePointerDownArc() {}

        function saveMarkupState() {
            const currentState = JSON.parse(JSON.stringify(markupPaths));
            markupHistory.push(currentState);
            markupRedoStack = [];
            updateUndoRedoButtons();
        }

        function undoMarkupAction() {
            if (markupHistory.length > 0) {
                const lastState = markupHistory.pop();
                markupRedoStack.push(JSON.parse(JSON.stringify(markupPaths)));
                markupPaths = lastState;
                updateUndoRedoButtons();
                clearArrowControls();
                if (renderLoop) renderLoop();
            }
        }

        function redoMarkupAction() {
            if (markupRedoStack.length > 0) {
                const currentState = JSON.parse(JSON.stringify(markupPaths));
                markupHistory.push(currentState);
                const redoState = markupRedoStack.pop();
                markupPaths = redoState;
                updateUndoRedoButtons();
                clearArrowControls();
                if (renderLoop) renderLoop();
            }
        }

        function updateUndoRedoButtons() {
            const undoBtn = document.getElementById("markupUndoBtn");
            const redoBtn = document.getElementById("markupRedoBtn");
            if (!undoBtn || !redoBtn) return;
            undoBtn.style.opacity = markupHistory.length > 0 ? 1 : 0.5;
            redoBtn.style.opacity = markupRedoStack.length > 0 ? 1 : 0.5;
        }

        function onKeyDown(e) {
            if (!isMarkupToolsetActive) return;
            if (e.key === 'Escape') {
                if (currentMarkupPath) {
                    currentMarkupPath = null;
                } else if (currentMarkupTool === 'arrow' && arrowState !== 'idle') {
                    clearArrowControls();
                    arrowState = 'idle';
                    planCanvas.className = '';
                    planCanvas.classList.add('markup-arrow-start');
                } else if (isShapeDrawing) {
                    isShapeDrawing = false;
                    currentShape = null;
                } else if (isTextPlacing) {
                    cancelTextEntry();
                } else {
                    cancelMarkupTool();
                }
            } else if (e.key === 'Enter') {
                if (isTextPlacing) {
                    confirmTextEntry();
                }
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
                e.preventDefault();
            } else if (e.key === 'c' && e.ctrlKey && selectedElement) {
                clipboardElement = JSON.parse(JSON.stringify(selectedElement));
                e.preventDefault();
            } else if (e.key === 'v' && e.ctrlKey && clipboardElement) {
                e.preventDefault();
            }
        }

        function cancelMarkupTool() {
            currentMarkupTool = null;
            planCanvas.className = "";
            const cancelBtn = document.getElementById('cancelMarkupToolBtn');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }
            currentMarkupPath = null;
            clearSelection();
            clearArrowControls();
            arrowState = 'idle';
            isShapeDrawing = false;
            shapeStartPoint = null;
            currentShape = null;
            isLineDrawing = false;
            currentLine = null;
        }

        function showMarkupInstructions(tool) {
            const instructionsDiv = document.getElementById('markup-instructions');
            if (!instructionsDiv) {
                const newInstructionsDiv = document.createElement('div');
                newInstructionsDiv.id = 'markup-instructions';
                newInstructionsDiv.style.position = 'absolute';
                newInstructionsDiv.style.top = '60px';
                newInstructionsDiv.style.left = '50%';
                newInstructionsDiv.style.transform = 'translateX(-50%)';
                newInstructionsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                newInstructionsDiv.style.color = 'white';
                newInstructionsDiv.style.padding = '8px 12px';
                newInstructionsDiv.style.borderRadius = '4px';
                newInstructionsDiv.style.zIndex = '10000';
                newInstructionsDiv.style.display = 'none';
                document.body.appendChild(newInstructionsDiv);
                showMarkupInstructions(tool);
                return;
            }

            let instructions = '';
            switch (tool) {
                case 'selection':
                    instructions = 'Click to select objects. Click and drag to move selected objects.';
                    break;
                case 'pencil':
                    instructions = 'Click and drag to draw freehand.';
                    break;
                case 'eraser':
                    instructions = 'Click and drag over elements to erase them.';
                    break;
                case 'arrow':
                    instructions = 'Click to set arrow start point, then click or drag to set end point.';
                    break;
                case 'text':
                    instructions = 'Click to place text. Type your text in the dialog that appears.';
                    break;
                case 'line':
                    instructions = 'Click and drag to draw a straight line.';
                    break;
                case 'rectangle':
                    instructions = 'Click and drag to draw a rectangle.';
                    break;
                case 'filled-rectangle':
                    instructions = 'Click and drag to draw a filled rectangle.';
                    break;
                case 'circle':
                    instructions = 'Click to set center, then drag to set radius.';
                    break;
                case 'arc':
                    instructions = 'Click to set start point, then click to set control point, then click to set end point.';
                    break;
                default:
                    instructions = '';
            }

            if (instructions) {
                instructionsDiv.innerHTML = instructions;
                instructionsDiv.style.display = 'block';
                function dismissInstructions() {
                    clearTimeout(timeoutId);
                    instructionsDiv.style.display = 'none';
                    instructionsDiv.removeEventListener('click', dismissInstructions);
                }
                instructionsDiv.addEventListener('click', dismissInstructions);
                const timeoutId = setTimeout(dismissInstructions, 2000);
            } else {
                instructionsDiv.style.display = 'none';
            }
        }

        // ---------------------------------------------------------------------
        // EXPORTS | Module API
        // ---------------------------------------------------------------------
        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.MarkupToolsSystem = window.NaPlanVision.MarkupToolsSystem || {};
        window.NaPlanVision.MarkupToolsSystem.Main = MarkupToolsSystem;

    })();

// endregion ----------------------------------------------
