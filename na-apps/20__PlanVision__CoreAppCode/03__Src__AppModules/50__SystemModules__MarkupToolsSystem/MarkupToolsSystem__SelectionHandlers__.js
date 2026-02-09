// =============================================================================
// NOBLE ARCHITECTURE - MARKUP TOOLS SELECTION HANDLERS
// =============================================================================
//
// FILE       : MarkupToolsSystem__SelectionHandlers__.js
// NAMESPACE  : NaPlanVision.MarkupToolsSystem.Selection
// MODULE     : SelectionHandlers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Element detection, selection, movement, copy/paste, and deletion
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Hit-detection for all markup element types (pencil, rectangle, circle,
//   arrow, text, line, arc, polygon)
// - Eraser tool detection and element removal
// - Selection handles creation and positioning
// - Element movement, copy/paste, and deletion
// - Arrow control point management
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Markup Tools Selection Handlers
// --------------------------------------------------------

    (function() {
        'use strict';

        const Selection = {};

        // Reference to the Renderers sub-module (loaded before this file)
        function R() {
            return window.NaPlanVision?.MarkupToolsSystem?.Renderers;
        }

    // #region ------------------------------------------------
    // DETECTION | Find Element At Position
    // ----------------------------------------------------

        /**
         * Finds the topmost markup element at a given plan-coordinate position.
         * Returns the element object or null.
         */
        Selection.findElementAt = function(pos, markupPaths, zoomFactor) {
            const r = R();
            const hitRadius = 10 / zoomFactor;

            // Search in reverse order (most recently added first)
            for (let i = markupPaths.length - 1; i >= 0; i--) {
                const path = markupPaths[i];

                if (path.tool === 'pencil') {
                    for (let j = 1; j < path.points.length; j++) {
                        const p1 = path.points[j - 1];
                        const p2 = path.points[j];
                        if (r.distanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                            return path;
                        }
                    }
                } else if (path.tool === 'rectangle') {
                    const x = path.startPoint.x;
                    const y = path.startPoint.y;
                    const w = path.endPoint.x - path.startPoint.x;
                    const h = path.endPoint.y - path.startPoint.y;

                    if (r.distanceToLineSegment(x, y, x + w, y, pos.x, pos.y) < hitRadius ||
                        r.distanceToLineSegment(x + w, y, x + w, y + h, pos.x, pos.y) < hitRadius ||
                        r.distanceToLineSegment(x + w, y + h, x, y + h, pos.x, pos.y) < hitRadius ||
                        r.distanceToLineSegment(x, y + h, x, y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }
                } else if (path.tool === 'circle') {
                    let centerX, centerY, radius;
                    if (path.centerPoint && path.radius !== undefined) {
                        centerX = path.centerPoint.x;
                        centerY = path.centerPoint.y;
                        radius = path.radius;
                    } else {
                        centerX = (path.startPoint.x + path.endPoint.x) / 2;
                        centerY = (path.startPoint.y + path.endPoint.y) / 2;
                        const dx = path.endPoint.x - path.startPoint.x;
                        const dy = path.endPoint.y - path.startPoint.y;
                        radius = Math.sqrt(dx * dx + dy * dy) / 2;
                    }

                    const dx = pos.x - centerX;
                    const dy = pos.y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (Math.abs(distance - radius) < hitRadius) {
                        return path;
                    }
                } else if (path.tool === 'polygon') {
                    for (let j = 0; j < path.points.length; j++) {
                        const p1 = path.points[j];
                        const p2 = path.points[(j + 1) % path.points.length];
                        if (r.distanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                            return path;
                        }
                    }
                } else if (path.tool === 'arrow') {
                    const points = r.sampleBezierCurve(
                        path.startPoint, path.control1, path.control2, path.endPoint, 20
                    );

                    for (let j = 1; j < points.length; j++) {
                        const p1 = points[j - 1];
                        const p2 = points[j];
                        if (r.distanceToLineSegment(p1.x, p1.y, p2.x, p2.y, pos.x, pos.y) < hitRadius) {
                            return path;
                        }
                    }

                    // Check arrowhead lines
                    const endDir = r.calculateCurveEndDirection(path.control2, path.endPoint);
                    const angle = Math.atan2(endDir.y, endDir.x);
                    const arrowSize = path.lineWidth * 8;
                    const endX = path.endPoint.x;
                    const endY = path.endPoint.y;

                    const head1X = endX - arrowSize * Math.cos(angle - Math.PI / 6);
                    const head1Y = endY - arrowSize * Math.sin(angle - Math.PI / 6);
                    if (r.distanceToLineSegment(endX, endY, head1X, head1Y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }

                    const head2X = endX - arrowSize * Math.cos(angle + Math.PI / 6);
                    const head2Y = endY - arrowSize * Math.sin(angle + Math.PI / 6);
                    if (r.distanceToLineSegment(endX, endY, head2X, head2Y, pos.x, pos.y) < hitRadius) {
                        return path;
                    }
                } else if (path.tool === 'text') {
                    const textWidth = path.text.length * (path.lineWidth * 10);
                    const textHeight = path.lineWidth * 20;

                    if (pos.x >= path.position.x - 5 &&
                        pos.x <= path.position.x + textWidth + 5 &&
                        pos.y >= path.position.y - textHeight - 5 &&
                        pos.y <= path.position.y + 5) {
                        return path;
                    }
                } else if (path.tool === 'line') {
                    const distance = r.distanceToLineSegment(
                        path.startPoint.x, path.startPoint.y,
                        path.endPoint.x, path.endPoint.y,
                        pos.x, pos.y
                    );
                    if (distance < hitRadius) {
                        return path;
                    }
                } else if (path.tool === 'arc') {
                    const distance = r.distanceToQuadraticCurve(
                        path.startPoint.x, path.startPoint.y,
                        path.controlPoint.x, path.controlPoint.y,
                        path.endPoint.x, path.endPoint.y,
                        pos.x, pos.y
                    );
                    if (distance < hitRadius) {
                        return path;
                    }
                }
            }

            return null;
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // DETECTION | Find Text Element At Position
    // ----------------------------------------------------

        /**
         * Finds a text element near the given position. Uses a larger hit area.
         */
        Selection.findTextElementAt = function(pos, markupPaths) {
            for (let i = markupPaths.length - 1; i >= 0; i--) {
                const path = markupPaths[i];
                if (path.tool === 'text') {
                    const textWidth = path.text.length * (path.lineWidth * 5);
                    const textHeight = path.lineWidth * 20;

                    if (pos.x >= path.position.x - 5 &&
                        pos.x <= path.position.x + textWidth + 5 &&
                        pos.y >= path.position.y - textHeight - 5 &&
                        pos.y <= path.position.y + 5) {
                        return path;
                    }

                    const dx = path.position.x - pos.x;
                    const dy = path.position.y - pos.y;
                    const hitRadius = Math.max(30, path.lineWidth * 10);
                    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                        return path;
                    }
                }
            }
            return null;
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // DETECTION | Eraser - Detect and Remove Elements
    // ----------------------------------------------------

        /**
         * Filters markupPaths, removing any elements that intersect
         * with the eraser at the given position/radius.
         * Returns { erasedAny, updatedPaths }.
         */
        Selection.detectAndEraseElements = function(position, radius, markupPaths) {
            const r = R();
            const eraserRadiusSq = radius * radius;
            let erasedAny = false;

            const updatedPaths = markupPaths.filter(path => {

                // Pencil
                if (path.tool === 'pencil') {
                    for (let i = 0; i < path.points.length; i++) {
                        const dx = path.points[i].x - position.x;
                        const dy = path.points[i].y - position.y;
                        if (dx * dx + dy * dy <= eraserRadiusSq) {
                            erasedAny = true;
                            return false;
                        }
                    }
                }

                // Arrow
                else if (path.tool === 'arrow') {
                    const pointsToCheck = [path.startPoint, path.endPoint, path.control1, path.control2];
                    for (const point of pointsToCheck) {
                        const dx = point.x - position.x;
                        const dy = point.y - position.y;
                        if (dx * dx + dy * dy <= eraserRadiusSq) {
                            erasedAny = true;
                            return false;
                        }
                    }
                }

                // Rectangle
                else if (path.tool === 'rectangle') {
                    const corners = [
                        { x: path.startPoint.x, y: path.startPoint.y },
                        { x: path.endPoint.x, y: path.startPoint.y },
                        { x: path.startPoint.x, y: path.endPoint.y },
                        { x: path.endPoint.x, y: path.endPoint.y }
                    ];

                    for (const corner of corners) {
                        const dx = corner.x - position.x;
                        const dy = corner.y - position.y;
                        if (dx * dx + dy * dy <= eraserRadiusSq) {
                            erasedAny = true;
                            return false;
                        }
                    }

                    const edges = [
                        { p1: { x: path.startPoint.x, y: path.startPoint.y }, p2: { x: path.endPoint.x, y: path.startPoint.y } },
                        { p1: { x: path.endPoint.x, y: path.startPoint.y }, p2: { x: path.endPoint.x, y: path.endPoint.y } },
                        { p1: { x: path.endPoint.x, y: path.endPoint.y }, p2: { x: path.startPoint.x, y: path.endPoint.y } },
                        { p1: { x: path.startPoint.x, y: path.endPoint.y }, p2: { x: path.startPoint.x, y: path.startPoint.y } }
                    ];

                    for (const edge of edges) {
                        if (r.distToSegment(position, edge.p1, edge.p2) <= radius) {
                            erasedAny = true;
                            return false;
                        }
                    }
                }

                // Circle
                else if (path.tool === 'circle') {
                    let centerX, centerY, avgRadius;
                    if (path.centerPoint && path.radius !== undefined) {
                        centerX = path.centerPoint.x;
                        centerY = path.centerPoint.y;
                        avgRadius = path.radius;
                    } else {
                        centerX = (path.startPoint.x + path.endPoint.x) / 2;
                        centerY = (path.startPoint.y + path.endPoint.y) / 2;
                        const radiusX = Math.abs(path.endPoint.x - path.startPoint.x) / 2;
                        const radiusY = Math.abs(path.endPoint.y - path.startPoint.y) / 2;
                        avgRadius = (radiusX + radiusY) / 2;
                    }

                    const dx = centerX - position.x;
                    const dy = centerY - position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (Math.abs(distance - avgRadius) <= radius || distance <= avgRadius) {
                        erasedAny = true;
                        return false;
                    }
                }

                // Polygon
                else if (path.tool === 'polygon' && path.points) {
                    for (let i = 0; i < path.points.length; i++) {
                        const p1 = path.points[i];
                        const p2 = path.points[(i + 1) % path.points.length];

                        const dx = p1.x - position.x;
                        const dy = p1.y - position.y;
                        if (dx * dx + dy * dy <= eraserRadiusSq) {
                            erasedAny = true;
                            return false;
                        }

                        if (r.distToSegment(position, p1, p2) <= radius) {
                            erasedAny = true;
                            return false;
                        }
                    }
                }

                // Text
                else if (path.tool === 'text') {
                    const dx = path.position.x - position.x;
                    const dy = path.position.y - position.y;
                    if (dx * dx + dy * dy <= eraserRadiusSq * 4) {
                        erasedAny = true;
                        return false;
                    }
                }

                // Line
                else if (path.tool === 'line') {
                    const distance = r.distanceToLineSegment(
                        path.startPoint.x, path.startPoint.y,
                        path.endPoint.x, path.endPoint.y,
                        position.x, position.y
                    );
                    if (distance < radius) {
                        erasedAny = true;
                        return false;
                    }
                }

                // Arc
                else if (path.tool === 'arc') {
                    const distance = r.distanceToQuadraticCurve(
                        path.startPoint.x, path.startPoint.y,
                        path.controlPoint.x, path.controlPoint.y,
                        path.endPoint.x, path.endPoint.y,
                        position.x, position.y
                    );
                    if (distance < radius) {
                        erasedAny = true;
                        return false;
                    }
                }

                return true;
            });

            return { erasedAny, updatedPaths };
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // SELECTION | Selection Highlight Rendering
    // ----------------------------------------------------

        /**
         * Draws a highlight around the selected element, then redraws
         * the element itself on top.
         */
        Selection.drawSelectionHighlight = function(context, selectedElement, offsetX, offsetY, zoomFactor, markupColor) {
            if (!selectedElement) return;

            const r = R();

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);

            // Draw the highlight underlay
            if (selectedElement.tool === 'pencil') {
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';

                context.beginPath();
                context.moveTo(selectedElement.points[0].x, selectedElement.points[0].y);
                for (let i = 1; i < selectedElement.points.length; i++) {
                    context.lineTo(selectedElement.points[i].x, selectedElement.points[i].y);
                }
                context.stroke();

            } else if (selectedElement.tool === 'rectangle') {
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';

                const x = selectedElement.startPoint.x;
                const y = selectedElement.startPoint.y;
                const w = selectedElement.endPoint.x - selectedElement.startPoint.x;
                const h = selectedElement.endPoint.y - selectedElement.startPoint.y;
                context.strokeRect(x, y, w, h);

            } else if (selectedElement.tool === 'circle') {
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';

                let centerX, centerY, radius;
                if (selectedElement.centerPoint && selectedElement.radius !== undefined) {
                    centerX = selectedElement.centerPoint.x;
                    centerY = selectedElement.centerPoint.y;
                    radius = selectedElement.radius;
                } else {
                    centerX = (selectedElement.startPoint.x + selectedElement.endPoint.x) / 2;
                    centerY = (selectedElement.startPoint.y + selectedElement.endPoint.y) / 2;
                    const radiusX = Math.abs(selectedElement.endPoint.x - selectedElement.startPoint.x) / 2;
                    const radiusY = Math.abs(selectedElement.endPoint.y - selectedElement.startPoint.y) / 2;
                    radius = (radiusX + radiusY) / 2;
                }

                context.beginPath();
                context.arc(centerX, centerY, radius, 0, Math.PI * 2);
                context.stroke();

            } else if (selectedElement.tool === 'text') {
                const textWidth = selectedElement.text.length * (selectedElement.lineWidth * 10);
                const textHeight = selectedElement.lineWidth * 20;

                context.fillStyle = 'rgba(255, 255, 100, 0.2)';
                context.fillRect(
                    selectedElement.position.x - 5,
                    selectedElement.position.y - textHeight,
                    textWidth + 10,
                    textHeight + 10
                );

            } else if (selectedElement.tool === 'arrow') {
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';

                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                context.bezierCurveTo(
                    selectedElement.control1.x, selectedElement.control1.y,
                    selectedElement.control2.x, selectedElement.control2.y,
                    selectedElement.endPoint.x, selectedElement.endPoint.y
                );
                context.stroke();

            } else if (selectedElement.tool === 'line') {
                context.lineWidth = selectedElement.lineWidth + 6;
                context.strokeStyle = 'rgba(255, 255, 100, 0.5)';
                context.lineCap = 'round';
                context.lineJoin = 'round';

                context.beginPath();
                context.moveTo(selectedElement.startPoint.x, selectedElement.startPoint.y);
                context.lineTo(selectedElement.endPoint.x, selectedElement.endPoint.y);
                context.stroke();
            }

            context.restore();

            // Draw the actual element on top of the highlight
            if (selectedElement.tool === 'arrow') {
                r.drawArrow(context, selectedElement, offsetX, offsetY, zoomFactor);
            } else if (selectedElement.tool === 'text') {
                r.drawSketchyText(context, selectedElement, offsetX, offsetY, zoomFactor, markupColor);
            } else if (selectedElement.tool === 'rectangle') {
                r.drawSketchyRectangle(context, selectedElement, offsetX, offsetY, zoomFactor);
            } else if (selectedElement.tool === 'circle') {
                r.drawSketchyCircle(context, selectedElement, offsetX, offsetY, zoomFactor);
            } else if (selectedElement.tool === 'line') {
                r.drawSketchyLine(context, selectedElement, offsetX, offsetY, zoomFactor);
            } else if (selectedElement.tool === 'polygon') {
                r.drawSketchyPolygon(context, selectedElement, offsetX, offsetY, zoomFactor);
            } else {
                r.drawSketchyPath(context, selectedElement, offsetX, offsetY, zoomFactor);
            }
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // SELECTION | Selection Handles
    // ----------------------------------------------------

        /**
         * Creates DOM handle elements for the selected element.
         * Returns an array of handle DOM elements.
         */
        Selection.createSelectionHandles = function(element, offsetX, offsetY, zoomFactor, containerElement) {
            if (!element || !containerElement) return [];

            // Remove existing handles container
            const existing = document.getElementById('selection-handles');
            if (existing) existing.remove();

            const container = document.createElement('div');
            container.id = 'selection-handles';
            container.style.position = 'absolute';
            container.style.left = '0';
            container.style.top = '0';
            container.style.pointerEvents = 'none';
            containerElement.appendChild(container);

            function addHandle(position, type) {
                const handle = document.createElement('div');
                handle.className = 'selection-handle';
                handle.dataset.type = type;
                handle.style.position = 'absolute';
                handle.style.width = '10px';
                handle.style.height = '10px';
                handle.style.borderRadius = '50%';
                handle.style.backgroundColor = 'yellow';
                handle.style.border = '1px solid #333';
                handle.style.transform = 'translate(-50%, -50%)';
                handle.style.pointerEvents = 'none';

                const screenX = position.x * zoomFactor + offsetX;
                const screenY = position.y * zoomFactor + offsetY;
                handle.style.left = screenX + 'px';
                handle.style.top = screenY + 'px';

                container.appendChild(handle);
                return handle;
            }

            if (element.tool === 'pencil') {
                for (let i = 0; i < element.points.length; i += Math.max(1, Math.floor(element.points.length / 8))) {
                    addHandle(element.points[i], 'point-' + i);
                }
            } else if (element.tool === 'rectangle') {
                addHandle(element.startPoint, 'start');
                addHandle({ x: element.endPoint.x, y: element.startPoint.y }, 'top-right');
                addHandle(element.endPoint, 'end');
                addHandle({ x: element.startPoint.x, y: element.endPoint.y }, 'bottom-left');
            } else if (element.tool === 'circle') {
                let centerX, centerY, radius;
                if (element.centerPoint && element.radius !== undefined) {
                    centerX = element.centerPoint.x;
                    centerY = element.centerPoint.y;
                    radius = element.radius;
                    addHandle({ x: centerX, y: centerY }, 'center');
                    addHandle({ x: centerX + radius, y: centerY }, 'right');
                    addHandle({ x: centerX, y: centerY - radius }, 'top');
                    addHandle({ x: centerX - radius, y: centerY }, 'left');
                    addHandle({ x: centerX, y: centerY + radius }, 'bottom');
                } else {
                    addHandle(element.startPoint, 'start');
                    addHandle(element.endPoint, 'end');
                    addHandle({ x: element.startPoint.x, y: element.endPoint.y }, 'bottom-left');
                    addHandle({ x: element.endPoint.x, y: element.startPoint.y }, 'top-right');
                    const cx = (element.startPoint.x + element.endPoint.x) / 2;
                    const cy = (element.startPoint.y + element.endPoint.y) / 2;
                    addHandle({ x: cx, y: cy }, 'center');
                }
            } else if (element.tool === 'text') {
                addHandle(element.position, 'start');
            } else if (element.tool === 'arrow') {
                addHandle(element.startPoint, 'start');
                addHandle(element.endPoint, 'end');
                addHandle(element.control1, 'control1');
                addHandle(element.control2, 'control2');
            } else if (element.tool === 'polygon') {
                for (let i = 0; i < element.points.length; i++) {
                    addHandle(element.points[i], 'point-' + i);
                }
            }
        };

        /**
         * Removes all selection handles from the DOM.
         */
        Selection.clearSelectionHandles = function() {
            document.querySelectorAll('.selection-handle').forEach(handle => {
                if (handle && handle.parentNode) {
                    handle.parentNode.removeChild(handle);
                }
            });

            const handleContainer = document.getElementById('selection-handles');
            if (handleContainer) handleContainer.remove();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // MOVEMENT | Element Movement
    // ----------------------------------------------------

        /**
         * Moves the given element to a new position, applying moveOffset.
         */
        Selection.moveElement = function(element, newPosition, moveOffset) {
            if (!element) return;

            const pos = {
                x: newPosition.x + moveOffset.x,
                y: newPosition.y + moveOffset.y
            };

            if (element.tool === 'pencil') {
                const dx = pos.x - element.points[0].x;
                const dy = pos.y - element.points[0].y;
                for (let i = 0; i < element.points.length; i++) {
                    element.points[i].x += dx;
                    element.points[i].y += dy;
                }
            } else if (element.tool === 'text') {
                element.position.x = pos.x;
                element.position.y = pos.y;
            } else if (element.tool === 'arrow') {
                const dx = pos.x - element.startPoint.x;
                const dy = pos.y - element.startPoint.y;
                element.startPoint.x += dx;
                element.startPoint.y += dy;
                element.endPoint.x += dx;
                element.endPoint.y += dy;
                element.control1.x += dx;
                element.control1.y += dy;
                element.control2.x += dx;
                element.control2.y += dy;
            } else if (element.tool === 'rectangle') {
                const dx = pos.x - element.startPoint.x;
                const dy = pos.y - element.startPoint.y;
                element.startPoint.x += dx;
                element.startPoint.y += dy;
                element.endPoint.x += dx;
                element.endPoint.y += dy;
            } else if (element.tool === 'circle') {
                if (element.centerPoint && element.radius !== undefined) {
                    element.centerPoint.x = pos.x;
                    element.centerPoint.y = pos.y;
                } else {
                    const dx = pos.x - ((element.startPoint.x + element.endPoint.x) / 2);
                    const dy = pos.y - ((element.startPoint.y + element.endPoint.y) / 2);
                    element.startPoint.x += dx;
                    element.startPoint.y += dy;
                    element.endPoint.x += dx;
                    element.endPoint.y += dy;
                }
            } else if (element.tool === 'polygon') {
                const dx = pos.x - element.points[0].x;
                const dy = pos.y - element.points[0].y;
                for (let i = 0; i < element.points.length; i++) {
                    element.points[i].x += dx;
                    element.points[i].y += dy;
                }
            }
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // CLIPBOARD | Copy and Paste
    // ----------------------------------------------------

        /**
         * Creates a deep clone of the given element for clipboard storage.
         */
        Selection.copyElement = function(element) {
            if (!element) return null;
            return JSON.parse(JSON.stringify(element));
        };

        /**
         * Creates a positioned clone of a clipboard element for pasting.
         * Returns the new element ready to be pushed into markupPaths.
         */
        Selection.pasteElement = function(clipboardElement, targetPos, pasteCount, zoomFactor) {
            if (!clipboardElement) return null;

            const newElement = JSON.parse(JSON.stringify(clipboardElement));

            const currentOffset = {
                x: 20 + (pasteCount * 10),
                y: 20 + (pasteCount * 10)
            };

            if (newElement.tool === 'pencil' && newElement.points) {
                let minX = Infinity, minY = Infinity;
                for (const point of clipboardElement.points) {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                }
                for (let i = 0; i < newElement.points.length; i++) {
                    newElement.points[i].x = newElement.points[i].x - minX + targetPos.x + currentOffset.x / zoomFactor;
                    newElement.points[i].y = newElement.points[i].y - minY + targetPos.y + currentOffset.y / zoomFactor;
                }
            } else if (newElement.tool === 'text') {
                newElement.position = {
                    x: targetPos.x + currentOffset.x / zoomFactor,
                    y: targetPos.y + currentOffset.y / zoomFactor
                };
            } else if (newElement.tool === 'arrow') {
                const origCenterX = (clipboardElement.startPoint.x + clipboardElement.endPoint.x) / 2;
                const origCenterY = (clipboardElement.startPoint.y + clipboardElement.endPoint.y) / 2;

                const vectors = {
                    startPoint: { x: clipboardElement.startPoint.x - origCenterX, y: clipboardElement.startPoint.y - origCenterY },
                    endPoint: { x: clipboardElement.endPoint.x - origCenterX, y: clipboardElement.endPoint.y - origCenterY },
                    control1: { x: clipboardElement.control1.x - origCenterX, y: clipboardElement.control1.y - origCenterY },
                    control2: { x: clipboardElement.control2.x - origCenterX, y: clipboardElement.control2.y - origCenterY }
                };

                const ox = currentOffset.x / zoomFactor;
                const oy = currentOffset.y / zoomFactor;

                newElement.startPoint = { x: targetPos.x + vectors.startPoint.x + ox, y: targetPos.y + vectors.startPoint.y + oy };
                newElement.endPoint = { x: targetPos.x + vectors.endPoint.x + ox, y: targetPos.y + vectors.endPoint.y + oy };
                newElement.control1 = { x: targetPos.x + vectors.control1.x + ox, y: targetPos.y + vectors.control1.y + oy };
                newElement.control2 = { x: targetPos.x + vectors.control2.x + ox, y: targetPos.y + vectors.control2.y + oy };
            } else if (newElement.tool === 'rectangle' || newElement.tool === 'circle') {
                if (clipboardElement.startPoint && clipboardElement.endPoint) {
                    const w = clipboardElement.endPoint.x - clipboardElement.startPoint.x;
                    const h = clipboardElement.endPoint.y - clipboardElement.startPoint.y;
                    const ox = currentOffset.x / zoomFactor;
                    const oy = currentOffset.y / zoomFactor;

                    newElement.startPoint = { x: targetPos.x + ox, y: targetPos.y + oy };
                    newElement.endPoint = { x: targetPos.x + w + ox, y: targetPos.y + h + oy };
                }
            } else if (newElement.tool === 'polygon' && newElement.points) {
                let minX = Infinity, minY = Infinity;
                for (const point of clipboardElement.points) {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                }
                for (let i = 0; i < newElement.points.length; i++) {
                    newElement.points[i].x = newElement.points[i].x - minX + targetPos.x + currentOffset.x / zoomFactor;
                    newElement.points[i].y = newElement.points[i].y - minY + targetPos.y + currentOffset.y / zoomFactor;
                }
            }

            return newElement;
        };

        /**
         * Shows a temporary visual feedback notification.
         */
        Selection.showCopyFeedback = function() {
            const feedback = document.createElement('div');
            feedback.textContent = 'Element copied';
            feedback.style.position = 'absolute';
            feedback.style.top = '60px';
            feedback.style.left = '50%';
            feedback.style.transform = 'translateX(-50%)';
            feedback.style.background = 'rgba(0, 0, 0, 0.7)';
            feedback.style.color = 'white';
            feedback.style.padding = '10px 20px';
            feedback.style.borderRadius = '5px';
            feedback.style.zIndex = '10000';
            feedback.style.pointerEvents = 'none';

            document.body.appendChild(feedback);

            setTimeout(() => {
                feedback.style.opacity = '0';
                feedback.style.transition = 'opacity 0.5s';
                setTimeout(() => document.body.removeChild(feedback), 500);
            }, 1500);
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // EXPORTS | Module API
    // ----------------------------------------------------

        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.MarkupToolsSystem = window.NaPlanVision.MarkupToolsSystem || {};
        window.NaPlanVision.MarkupToolsSystem.Selection = Selection;

    // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
