// =============================================================================
// NOBLE ARCHITECTURE - MARKUP TOOLS SKETCHY RENDERERS
// =============================================================================
//
// FILE       : MarkupToolsSystem__SketchyRenderers__.js
// NAMESPACE  : NaPlanVision.MarkupToolsSystem.Renderers
// MODULE     : SketchyRenderers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Canvas rendering functions for all sketchy/hand-drawn markup elements
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Provides deterministic sketchy rendering for pencil, rectangle, circle,
//   line, arrow, polygon, arc, and text markup elements
// - Uses a seeded pseudo-random number generator for consistent rendering
// - Shared geometry helpers (Bezier sampling, distance calculations)
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Markup Tools Sketchy Renderers
// --------------------------------------------------------

    (function() {
        'use strict';

        const Renderers = {};

    // #region ------------------------------------------------
    // UTILITY | Deterministic Pseudo-Random Generator
    // ----------------------------------------------------

        /**
         * Returns a deterministic value between 0 and 1 for a given seed.
         * Ensures sketchy rendering is consistent across redraws.
         */
        Renderers.pseudoRandom = function(seed) {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // UTILITY | Bezier Curve Helpers
    // ----------------------------------------------------

        /**
         * Samples a single point on a cubic Bezier curve at parameter t.
         */
        Renderers.sampleBezierPoint = function(p0, p1, p2, p3, t) {
            const oneMinusT = 1 - t;
            const oneMinusTSq = oneMinusT * oneMinusT;
            const oneMinusTCu = oneMinusTSq * oneMinusT;
            const tSq = t * t;
            const tCu = tSq * t;

            return {
                x: oneMinusTCu * p0.x + 3 * oneMinusTSq * t * p1.x + 3 * oneMinusT * tSq * p2.x + tCu * p3.x,
                y: oneMinusTCu * p0.y + 3 * oneMinusTSq * t * p1.y + 3 * oneMinusT * tSq * p2.y + tCu * p3.y
            };
        };

        /**
         * Samples multiple points along a cubic Bezier curve.
         */
        Renderers.sampleBezierCurve = function(p0, p1, p2, p3, samples) {
            const points = [];
            for (let i = 0; i <= samples; i++) {
                const t = i / samples;
                points.push(Renderers.sampleBezierPoint(p0, p1, p2, p3, t));
            }
            return points;
        };

        /**
         * Calculates the tangent direction at the end of a curve segment.
         */
        Renderers.calculateCurveEndDirection = function(controlPoint, endPoint) {
            return {
                x: endPoint.x - controlPoint.x,
                y: endPoint.y - controlPoint.y
            };
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // UTILITY | Distance Calculations
    // ----------------------------------------------------

        /**
         * Shortest distance from a point (px, py) to a line segment (x1,y1)-(x2,y2).
         */
        Renderers.distanceToLineSegment = function(x1, y1, x2, y2, px, py) {
            const lengthSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
            if (lengthSq === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

            const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lengthSq;
            if (t < 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
            if (t > 1) return Math.sqrt((px - x2) * (px - x2) + (py - y2) * (py - y2));

            const closestX = x1 + t * (x2 - x1);
            const closestY = y1 + t * (y2 - y1);
            return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
        };

        /**
         * Shortest distance from a point to a line segment (object-based).
         */
        Renderers.distToSegment = function(point, p1, p2) {
            return Renderers.distanceToLineSegment(p1.x, p1.y, p2.x, p2.y, point.x, point.y);
        };

        /**
         * Approximate shortest distance from a point to a quadratic Bezier curve.
         */
        Renderers.distanceToQuadraticCurve = function(x1, y1, cx, cy, x2, y2, px, py) {
            let minDist = Infinity;
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const oneMinusT = 1 - t;
                const qx = oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * cx + t * t * x2;
                const qy = oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * cy + t * t * y2;
                const dx = px - qx;
                const dy = py - qy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) minDist = dist;
            }
            return minDist;
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Segment (shared by rectangle, line, polygon)
    // ----------------------------------------------------

        /**
         * Draws a single sketchy line segment between two points with
         * deterministic hand-drawn imperfections.
         */
        Renderers.drawSketchySegment = function(context, x1, y1, x2, y2, lineWidth, color, seed) {
            const pr = Renderers.pseudoRandom;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / length;
            const unitY = dy / length;

            const segmentCount = Math.max(3, Math.min(12, Math.ceil(length / (lineWidth * 4))));

            // Normal vector for perpendicular deviations
            const perpX = -unitY;
            const perpY = unitX;

            // Main stroke
            context.beginPath();
            context.strokeStyle = color;
            context.lineWidth = lineWidth;

            let currentX = x1 + lineWidth * 0.1 * (pr(seed) - 0.5);
            let currentY = y1 + lineWidth * 0.1 * (pr(seed + 1) - 0.5);
            context.moveTo(currentX, currentY);

            for (let i = 1; i <= segmentCount; i++) {
                const t = i / segmentCount;
                let targetX = x1 + dx * t;
                let targetY = y1 + dy * t;

                const jitterScale = lineWidth * 0.8;
                const perpOffset = jitterScale * (pr(seed + i * 10) - 0.5);
                targetX += perpX * perpOffset;
                targetY += perpY * perpOffset;

                if (segmentCount > 3) {
                    const controlT = (i - 0.5) / segmentCount;
                    const controlX = x1 + dx * controlT + perpX * jitterScale * (pr(seed + i * 20) - 0.5);
                    const controlY = y1 + dy * controlT + perpY * jitterScale * (pr(seed + i * 30) - 0.5);
                    context.quadraticCurveTo(controlX, controlY, targetX, targetY);
                } else {
                    context.lineTo(targetX, targetY);
                }

                currentX = targetX;
                currentY = targetY;
            }
            context.stroke();

            // Reinforcement stroke for technical pen effect
            if (length > lineWidth * 8) {
                context.beginPath();
                context.globalAlpha = 0.5;
                context.lineWidth = lineWidth * 0.6;

                const startPct = pr(seed + 100) * 0.3;
                const endPct = 0.7 + pr(seed + 200) * 0.3;

                const sX = x1 + dx * startPct + perpX * lineWidth * 0.1 * (pr(seed + 300) - 0.5);
                const sY = y1 + dy * startPct + perpY * lineWidth * 0.1 * (pr(seed + 400) - 0.5);
                const eX = x1 + dx * endPct + perpX * lineWidth * 0.1 * (pr(seed + 500) - 0.5);
                const eY = y1 + dy * endPct + perpY * lineWidth * 0.1 * (pr(seed + 600) - 0.5);

                context.moveTo(sX, sY);
                context.lineTo(eX, eY);
                context.stroke();
            }
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Arrowhead Line Helper
    // ----------------------------------------------------

        /**
         * Draws a single arrowhead line with deterministic sketchy style.
         */
        Renderers.drawSketchyArrowLine = function(context, x1, y1, x2, y2, lineWidth, color, seed) {
            const pr = Renderers.pseudoRandom;

            context.globalAlpha = 1.0;
            context.beginPath();
            context.strokeStyle = color;
            context.lineWidth = lineWidth;

            const jitter = lineWidth * 0.2;
            const startX = x1 + jitter * (pr(seed) - 0.5);
            const startY = y1 + jitter * (pr(seed + 1) - 0.5);
            const endX = x2 + jitter * (pr(seed + 2) - 0.5);
            const endY = y2 + jitter * (pr(seed + 3) - 0.5);

            context.moveTo(startX, startY);

            // Control point for slight curve
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const ctrlJitter = lineWidth * 0.7;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;

            const ctrlX = midX + nx * ctrlJitter * (pr(seed + 4) - 0.4);
            const ctrlY = midY + ny * ctrlJitter * (pr(seed + 5) - 0.4);

            context.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
            context.stroke();

            // Reinforcement stroke
            context.beginPath();
            context.lineWidth = lineWidth * 0.6;

            const oX = jitter * 0.5 * (pr(seed + 7) - 0.5);
            const oY = jitter * 0.5 * (pr(seed + 8) - 0.5);

            context.moveTo(startX + oX, startY + oY);

            const wobblePts = 8;
            for (let i = 1; i <= wobblePts; i++) {
                const t = i / (wobblePts + 1);
                const wobbleX = startX + dx * t + oX + jitter * (pr(seed + 10 + i) - 0.5);
                const wobbleY = startY + dy * t + oY + jitter * (pr(seed + 20 + i) - 0.5);
                context.lineTo(wobbleX, wobbleY);
            }

            context.lineTo(endX + oX, endY + oY);
            context.stroke();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Path (freehand pencil)
    // ----------------------------------------------------

        Renderers.drawSketchyPath = function(context, path, offsetX, offsetY, zoomFactor) {
            const pr = Renderers.pseudoRandom;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.lineWidth = path.lineWidth;
            context.strokeStyle = path.color;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            if (!path.seed) {
                path.seed = Math.floor(Math.random() * 10000);
            }

            // Main stroke
            context.beginPath();
            context.moveTo(path.points[0].x, path.points[0].y);

            let prevX = path.points[0].x;
            let prevY = path.points[0].y;

            for (let i = 1; i < path.points.length; i++) {
                const point = path.points[i];
                const jitterAmount = path.lineWidth * 0.1;
                const jitterX = jitterAmount * (pr(path.seed + i * 7) - 0.5);
                const jitterY = jitterAmount * (pr(path.seed + i * 13) - 0.5);

                if (i < path.points.length - 1) {
                    const mid1X = (prevX + point.x) / 2 + jitterX;
                    const mid1Y = (prevY + point.y) / 2 + jitterY;

                    if (i % 5 === 0) {
                        const pressureFactor = 1 + 0.2 * (pr(path.seed + i * 19) - 0.5);
                        context.lineWidth = path.lineWidth * pressureFactor;
                    }

                    context.quadraticCurveTo(mid1X, mid1Y, point.x, point.y);
                } else {
                    context.lineTo(point.x + jitterX, point.y + jitterY);
                }

                prevX = point.x;
                prevY = point.y;
            }
            context.stroke();

            // Reinforcement stroke
            if (path.points.length > 5) {
                context.globalAlpha = 0.3;
                context.lineWidth = path.lineWidth * 0.6;

                const startIndex = Math.floor(pr(path.seed + 100) * (path.points.length / 3));
                const endIndex = Math.min(
                    startIndex + Math.floor(pr(path.seed + 200) * (path.points.length / 2)),
                    path.points.length - 1
                );

                context.beginPath();
                context.moveTo(
                    path.points[startIndex].x + path.lineWidth * 0.1 * (pr(path.seed + 300) - 0.5),
                    path.points[startIndex].y + path.lineWidth * 0.1 * (pr(path.seed + 400) - 0.5)
                );

                for (let i = startIndex + 1; i <= endIndex; i++) {
                    const point = path.points[i];
                    const jX = path.lineWidth * 0.15 * (pr(path.seed + i * 23) - 0.5);
                    const jY = path.lineWidth * 0.15 * (pr(path.seed + i * 29) - 0.5);
                    context.lineTo(point.x + jX, point.y + jY);
                }
                context.stroke();
            }

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Text
    // ----------------------------------------------------

        Renderers.drawSketchyText = function(context, textObj, offsetX, offsetY, zoomFactor, fallbackColor) {
            if (!textObj.text || !textObj.position) return;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);

            context.fillStyle = textObj.color || fallbackColor || '#960000';
            const fontSize = textObj.fontSize || 24;

            context.font = `${fontSize}px 'Caveat', 'Comic Sans MS', cursive, sans-serif`;
            context.textBaseline = 'top';
            context.fillText(textObj.text, textObj.position.x, textObj.position.y);

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Rectangle
    // ----------------------------------------------------

        Renderers.drawSketchyRectangle = function(context, rect, offsetX, offsetY, zoomFactor) {
            const pr = Renderers.pseudoRandom;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = rect.color;
            context.lineWidth = rect.lineWidth;

            const x = rect.startPoint.x;
            const y = rect.startPoint.y;
            const width = rect.endPoint.x - rect.startPoint.x;
            const height = rect.endPoint.y - rect.startPoint.y;

            // Fill if requested
            if (rect.filled) {
                context.fillStyle = rect.color + '33';
                context.fillRect(x, y, width, height);
            }

            if (!rect.seed) {
                rect.seed = {
                    top: Math.floor(Math.random() * 10000),
                    right: Math.floor(Math.random() * 10000),
                    bottom: Math.floor(Math.random() * 10000),
                    left: Math.floor(Math.random() * 10000)
                };
            }

            const overshootAmount = rect.lineWidth * 1.2;

            // Draw each edge
            Renderers.drawSketchySegment(context,
                x - overshootAmount * 0.2, y,
                x + width + overshootAmount * 0.2, y,
                rect.lineWidth, rect.color, rect.seed.top);

            Renderers.drawSketchySegment(context,
                x + width, y - overshootAmount * 0.2,
                x + width, y + height + overshootAmount * 0.2,
                rect.lineWidth, rect.color, rect.seed.right);

            Renderers.drawSketchySegment(context,
                x + width + overshootAmount * 0.2, y + height,
                x - overshootAmount * 0.2, y + height,
                rect.lineWidth, rect.color, rect.seed.bottom);

            Renderers.drawSketchySegment(context,
                x, y + height + overshootAmount * 0.2,
                x, y - overshootAmount * 0.2,
                rect.lineWidth, rect.color, rect.seed.left);

            // Corner reinforcements
            context.globalAlpha = 0.9;
            const cornerLength = rect.lineWidth * 2.5;

            context.beginPath();
            context.lineWidth = rect.lineWidth * 0.7;
            context.moveTo(x, y);
            context.lineTo(x + cornerLength * pr(rect.seed.top + 1), y);
            context.stroke();

            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x, y + cornerLength * pr(rect.seed.left + 1));
            context.stroke();

            context.beginPath();
            context.moveTo(x + width, y);
            context.lineTo(x + width - cornerLength * pr(rect.seed.top + 2), y);
            context.stroke();

            context.beginPath();
            context.moveTo(x + width, y);
            context.lineTo(x + width, y + cornerLength * pr(rect.seed.right + 2));
            context.stroke();

            context.beginPath();
            context.moveTo(x + width, y + height);
            context.lineTo(x + width - cornerLength * pr(rect.seed.bottom + 3), y + height);
            context.stroke();

            context.beginPath();
            context.moveTo(x + width, y + height);
            context.lineTo(x + width, y + height - cornerLength * pr(rect.seed.right + 3));
            context.stroke();

            context.beginPath();
            context.moveTo(x, y + height);
            context.lineTo(x + cornerLength * pr(rect.seed.bottom + 4), y + height);
            context.stroke();

            context.beginPath();
            context.moveTo(x, y + height);
            context.lineTo(x, y + height - cornerLength * pr(rect.seed.left + 4));
            context.stroke();

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Circle
    // ----------------------------------------------------

        Renderers.drawSketchyCircle = function(context, circle, offsetX, offsetY, zoomFactor) {
            const pr = Renderers.pseudoRandom;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = circle.color;
            context.lineWidth = circle.lineWidth;

            // Handle both old and new circle format
            let centerX, centerY, radius;

            if (circle.centerPoint && circle.radius !== undefined) {
                centerX = circle.centerPoint.x;
                centerY = circle.centerPoint.y;
                radius = circle.radius;
            } else {
                centerX = (circle.startPoint.x + circle.endPoint.x) / 2;
                centerY = (circle.startPoint.y + circle.endPoint.y) / 2;
                const dx = circle.endPoint.x - circle.startPoint.x;
                const dy = circle.endPoint.y - circle.startPoint.y;
                radius = Math.sqrt(dx * dx + dy * dy) / 2;
            }

            if (!circle.seed) {
                circle.seed = Math.floor(Math.random() * 10000);
            }

            const segments = Math.max(24, Math.min(48, Math.floor(radius * 2)));

            // Main outline
            context.beginPath();
            for (let i = 0; i <= segments; i++) {
                const angle = (Math.PI * 2 * i) / segments;
                const noise = pr(circle.seed + i) * 0.3 - 0.15;
                const radiusNoise = 1 + (noise * 0.08);

                const x = centerX + radius * radiusNoise * Math.cos(angle);
                const y = centerY + radius * radiusNoise * Math.sin(angle);

                if (i === 0) {
                    context.moveTo(x, y);
                } else {
                    const prevAngle = (Math.PI * 2 * (i - 1)) / segments;
                    const midAngle = (prevAngle + angle) / 2;
                    const controlNoise = pr(circle.seed + i + 100) * 0.15 - 0.075;

                    const ctrlX = centerX + (radius + circle.lineWidth * (controlNoise + 0.2)) * Math.cos(midAngle);
                    const ctrlY = centerY + (radius + circle.lineWidth * (controlNoise + 0.2)) * Math.sin(midAngle);

                    context.quadraticCurveTo(ctrlX, ctrlY, x, y);
                }
            }
            context.stroke();

            // Reinforcement arcs
            context.globalAlpha = 0.8;
            context.lineWidth = circle.lineWidth * 0.6;

            for (let i = 0; i < 3; i++) {
                const startSegment = Math.floor(pr(circle.seed + i * 50) * segments);
                const arcLength = Math.floor(segments * (0.25 + pr(circle.seed + i * 100) * 0.25));

                context.beginPath();
                for (let j = 0; j <= arcLength; j++) {
                    const segmentIndex = (startSegment + j) % segments;
                    const angle = (Math.PI * 2 * segmentIndex) / segments;
                    const noise = pr(circle.seed + segmentIndex + i * 200) * 0.2 - 0.1;
                    const reinforceRadius = 0.98 + (noise * 0.04);

                    const x = centerX + radius * reinforceRadius * Math.cos(angle);
                    const y = centerY + radius * reinforceRadius * Math.sin(angle);

                    if (j === 0) {
                        context.moveTo(x, y);
                    } else {
                        context.lineTo(x, y);
                    }
                }
                context.stroke();
            }

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Arrow
    // ----------------------------------------------------

        Renderers.drawArrow = function(context, arrow, offsetX, offsetY, zoomFactor) {
            const pr = Renderers.pseudoRandom;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = arrow.color;
            context.lineWidth = arrow.lineWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            if (!arrow.seed) {
                arrow.seed = {
                    shaft: Math.floor(Math.random() * 10000),
                    head1: Math.floor(Math.random() * 10000),
                    head2: Math.floor(Math.random() * 10000)
                };
            }

            // Sample points along the Bezier curve
            const steps = 30;
            const points = [];
            for (let t = 0; t <= 1; t += 1 / steps) {
                const point = Renderers.sampleBezierPoint(
                    arrow.startPoint, arrow.control1, arrow.control2, arrow.endPoint, t
                );

                const jitter = arrow.lineWidth * 0.15 * (pr(arrow.seed.shaft + Math.floor(t * 100)) - 0.5);
                point.x += jitter;
                point.y += jitter;
                points.push(point);
            }

            // Main shaft stroke
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                context.lineTo(points[i].x, points[i].y);
            }
            context.stroke();

            // Reinforcement stroke
            context.globalAlpha = 0.7;
            context.lineWidth = arrow.lineWidth * 0.7;
            context.beginPath();
            context.moveTo(points[0].x + arrow.lineWidth * 0.1, points[0].y + arrow.lineWidth * 0.1);

            for (let i = 1; i < points.length; i++) {
                const offset = arrow.lineWidth * 0.1 * (pr(arrow.seed.shaft + i) - 0.3);
                context.lineTo(points[i].x + offset, points[i].y + offset);
            }
            context.stroke();

            // Arrowhead
            context.globalAlpha = 1.0;
            context.lineWidth = arrow.lineWidth;

            const endDir = Renderers.calculateCurveEndDirection(arrow.control2, arrow.endPoint);
            const endX = arrow.endPoint.x;
            const endY = arrow.endPoint.y;
            const angle = Math.atan2(endDir.y, endDir.x);
            const arrowSize = arrow.lineWidth * 8;

            const angleVar1 = (pr(arrow.seed.head1) * 0.2) - 0.1;
            const angleVar2 = (pr(arrow.seed.head2) * 0.2) - 0.1;

            Renderers.drawSketchyArrowLine(context,
                endX, endY,
                endX - arrowSize * Math.cos(angle - Math.PI / 6 + angleVar1),
                endY - arrowSize * Math.sin(angle - Math.PI / 6 + angleVar1),
                arrow.lineWidth, arrow.color, arrow.seed.head1
            );

            Renderers.drawSketchyArrowLine(context,
                endX, endY,
                endX - arrowSize * Math.cos(angle + Math.PI / 6 + angleVar2),
                endY - arrowSize * Math.sin(angle + Math.PI / 6 + angleVar2),
                arrow.lineWidth, arrow.color, arrow.seed.head2
            );

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Straight Line
    // ----------------------------------------------------

        Renderers.drawSketchyLine = function(context, line, offsetX, offsetY, zoomFactor) {
            if (!line.startPoint || !line.endPoint) return;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = line.color;
            context.lineWidth = line.lineWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            if (!line.seed) {
                line.seed = Math.floor(Math.random() * 10000);
            }

            Renderers.drawSketchySegment(context,
                line.startPoint.x, line.startPoint.y,
                line.endPoint.x, line.endPoint.y,
                line.lineWidth, line.color, line.seed
            );

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Sketchy Polygon
    // ----------------------------------------------------

        Renderers.drawSketchyPolygon = function(context, polygon, offsetX, offsetY, zoomFactor) {
            if (polygon.points.length < 2) return;

            const pr = Renderers.pseudoRandom;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = polygon.color;
            context.lineWidth = polygon.lineWidth;

            if (!polygon.seed) {
                polygon.seed = Math.floor(Math.random() * 10000);
            }

            // Draw each edge
            for (let i = 0; i < polygon.points.length; i++) {
                const p1 = polygon.points[i];
                const p2 = polygon.points[(i + 1) % polygon.points.length];

                Renderers.drawSketchySegment(context, p1.x, p1.y, p2.x, p2.y,
                    polygon.lineWidth, polygon.color, polygon.seed + i * 100);
            }

            // Vertex reinforcement marks
            context.globalAlpha = 0.3;
            for (let i = 0; i < polygon.points.length; i++) {
                const p = polygon.points[i];
                const jitter = polygon.lineWidth * 0.2;

                context.beginPath();
                context.lineWidth = polygon.lineWidth * 0.7;

                const jitterX = jitter * (pr(polygon.seed + i * 200) - 0.5);
                const jitterY = jitter * (pr(polygon.seed + i * 200 + 10) - 0.5);
                context.moveTo(p.x + jitterX, p.y + jitterY);

                const angle = pr(polygon.seed + i * 300) * Math.PI * 2;
                const length = polygon.lineWidth * (1 + pr(polygon.seed + i * 400));
                context.lineTo(p.x + Math.cos(angle) * length, p.y + Math.sin(angle) * length);
                context.stroke();
            }

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // RENDERER | Arc (quadratic Bezier curve)
    // ----------------------------------------------------

        Renderers.drawArc = function(context, arc, offsetX, offsetY, zoomFactor) {
            if (!arc.startPoint || !arc.controlPoint || !arc.endPoint) return;

            context.save();
            context.translate(offsetX, offsetY);
            context.scale(zoomFactor, zoomFactor);
            context.strokeStyle = arc.color;
            context.lineWidth = arc.lineWidth;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            context.beginPath();
            context.moveTo(arc.startPoint.x, arc.startPoint.y);
            context.quadraticCurveTo(
                arc.controlPoint.x, arc.controlPoint.y,
                arc.endPoint.x, arc.endPoint.y
            );
            context.stroke();

            context.restore();
        };

    // endregion ----------------------------------------------

    // #region ------------------------------------------------
    // EXPORTS | Module API
    // ----------------------------------------------------

        window.NaPlanVision = window.NaPlanVision || {};
        window.NaPlanVision.MarkupToolsSystem = window.NaPlanVision.MarkupToolsSystem || {};
        window.NaPlanVision.MarkupToolsSystem.Renderers = Renderers;

    // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
