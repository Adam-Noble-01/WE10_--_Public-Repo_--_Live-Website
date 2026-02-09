// =============================================================================
// NOBLE ARCHITECTURE - MEASUREMENT TOOLS SHARED HELPERS
// =============================================================================
//
// FILE       : MeasurmentTools__SharedMathHelpers__.js
// NAMESPACE  : NaPlanVision.MeasurmentToolsSystem.Helpers
// MODULE     : SharedMathHelpers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared geometry + drawing helpers for measurement tools
// CREATED    : 09-Feb-2026
//
// =============================================================================

// #region ------------------------------------------------------------
// MODULE | Measurement Tools Shared Helpers
// ----------------------------------------------------------------

    (function() {
        'use strict';

        const Helpers = {};

        // #region --------------------------------------------------------
        // GEOMETRY | Core Geometry Helper Functions
        // ------------------------------------------------------------

            Helpers.dist = function(a, b) {
                return Math.hypot(b.x - a.x, b.y - a.y);
            };

            Helpers.polygonCentroid = function(pts) {
                let xSum = 0;
                let ySum = 0;
                pts.forEach(p => { xSum += p.x; ySum += p.y; });
                return { x: xSum / pts.length, y: ySum / pts.length };
            };

            Helpers.polygonArea = function(pts) {
                let area = 0;
                for (let i = 0; i < pts.length; i++) {
                    const j = (i + 1) % pts.length;
                    area += (pts[i].x * pts[j].y) - (pts[j].x * pts[i].y);
                }
                return Math.abs(area / 2);
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // DRAWING | Line and Marker Drawing
        // ------------------------------------------------------------

            Helpers.drawLine = function(renderContext, points, strokeStyle) {
                if (!points || points.length < 2) return;

                const { ctx, offsetX, offsetY, zoomFactor, baseLineWidth } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;

                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                ctx.lineTo(points[1].x, points[1].y);
                ctx.stroke();

                const dx = points[1].x - points[0].x;
                const dy = points[1].y - points[0].y;
                if (dy === 0 || dx === 0) {
                    const indicatorSize = 5 / zoomFactor;
                    ctx.fillStyle = strokeStyle;
                    ctx.fillRect(
                        points[0].x - indicatorSize / 2,
                        points[0].y - indicatorSize / 2,
                        indicatorSize,
                        indicatorSize
                    );
                    ctx.fillRect(
                        points[1].x - indicatorSize / 2,
                        points[1].y - indicatorSize / 2,
                        indicatorSize,
                        indicatorSize
                    );
                }

                ctx.restore();
            };

            Helpers.drawMarkers = function(renderContext, points, colour) {
                const { ctx, offsetX, offsetY, zoomFactor, markerRadius } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.strokeStyle = colour;
                ctx.globalAlpha = 0.75;
                ctx.lineWidth = 1 / zoomFactor;
                const doubleRadius = markerRadius * 2;
                points.forEach(pt => {
                    ctx.beginPath();
                    ctx.moveTo(pt.x - doubleRadius, pt.y);
                    ctx.lineTo(pt.x + doubleRadius, pt.y);
                    ctx.moveTo(pt.x, pt.y - doubleRadius);
                    ctx.lineTo(pt.x, pt.y + doubleRadius);
                    ctx.stroke();
                });
                ctx.restore();
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // DRAWING | Shape Drawing (Rectangle and Polygon)
        // ------------------------------------------------------------

            Helpers.drawRectangle = function(renderContext, start, end, strokeStyle, fillStyle = null) {
                const { ctx, offsetX, offsetY, zoomFactor, baseLineWidth } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;

                const width = end.x - start.x;
                const height = end.y - start.y;

                ctx.beginPath();
                ctx.rect(start.x, start.y, width, height);

                if (fillStyle) {
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                }
                ctx.stroke();
                ctx.restore();
            };

            Helpers.drawPolygon = function(renderContext, points, fillStyle, strokeStyle) {
                if (points.length < 3) return;
                const { ctx, offsetX, offsetY, zoomFactor, baseLineWidth } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.fillStyle = fillStyle;
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            };

            Helpers.drawOpenPolygon = function(renderContext, points, strokeStyle) {
                if (points.length < 2) return;
                const { ctx, offsetX, offsetY, zoomFactor, baseLineWidth } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = (baseLineWidth * 0.50) / zoomFactor;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
                ctx.restore();
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // LABELS | Measurement Label Drawing
        // ------------------------------------------------------------

            Helpers.drawRectLabel = function(renderContext, start, end) {
                const { scaleMetresPerPixel, zoomFactor } = renderContext;
                const widthPx = Math.abs(end.x - start.x);
                const heightPx = Math.abs(end.y - start.y);
                const widthMm = Math.round(widthPx * scaleMetresPerPixel * 1000);
                const heightMm = Math.round(heightPx * scaleMetresPerPixel * 1000);
                const areaM2 = (widthPx * heightPx * scaleMetresPerPixel * scaleMetresPerPixel).toFixed(2);
                const mid = {
                    x: (start.x + end.x) / 2,
                    y: (start.y + end.y) / 2
                };
                Helpers.drawTextLabel(renderContext, mid, `${areaM2} m²`, "blue");

                const widthMid = {
                    x: (start.x + end.x) / 2,
                    y: Math.min(start.y, end.y) - 10 / zoomFactor
                };
                Helpers.drawTextLabel(renderContext, widthMid, `${widthMm} mm`, "blue");

                const heightMid = {
                    x: Math.max(start.x, end.x) + 10 / zoomFactor,
                    y: (start.y + end.y) / 2
                };
                Helpers.drawTextLabel(renderContext, heightMid, `${heightMm} mm`, "blue");
            };

            Helpers.drawLineLabel = function(renderContext, points, distMM, colour) {
                if (points.length < 2) return;
                const [A, B] = points;
                const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
                Helpers.drawTextLabel(renderContext, mid, distMM + " mm", colour);
            };

            Helpers.drawAreaLabel = function(renderContext, areaObj) {
                const c = Helpers.polygonCentroid(areaObj.points);
                Helpers.drawTextLabel(renderContext, c, areaObj.areaM2 + " m²", "red");
            };

            Helpers.drawEdgeLabels = function(renderContext, points, colour) {
                if (points.length < 2) return;
                const {
                    ctx,
                    offsetX,
                    offsetY,
                    zoomFactor,
                    scaleMetresPerPixel,
                    roundingEnabled,
                    roundingInterval
                } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.fillStyle = colour;
                ctx.font = (14 / zoomFactor) + "px sans-serif";
                const offsetVal = 10 / zoomFactor;
                for (let i = 0; i < points.length; i++) {
                    const p1 = points[i];
                    const p2 = points[(i + 1) % points.length];
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    let lengthPx = Helpers.dist(p1, p2);
                    let lengthMm = lengthPx * scaleMetresPerPixel * 1000;
                    if (roundingEnabled) {
                        lengthMm = Math.round(lengthMm / roundingInterval) * roundingInterval;
                    } else {
                        lengthMm = Math.round(lengthMm);
                    }
                    ctx.fillText(lengthMm + " mm", mid.x + offsetVal, mid.y - offsetVal);
                }
                ctx.restore();
            };

            Helpers.drawTextLabel = function(renderContext, pos, text, colour) {
                const { ctx, offsetX, offsetY, zoomFactor } = renderContext;
                ctx.save();
                ctx.translate(offsetX, offsetY);
                ctx.scale(zoomFactor, zoomFactor);
                ctx.fillStyle = colour;
                ctx.font = (18 / zoomFactor) + "px sans-serif";
                const offsetVal = 10 / zoomFactor;
                ctx.fillText(text, pos.x + offsetVal, pos.y - offsetVal);
                ctx.restore();
            };

        // endregion --------------------------------------------------

        // #region --------------------------------------------------------
        // EXPORTS | Module Namespace Export
        // ------------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.MeasurmentToolsSystem = window.NaPlanVision.MeasurmentToolsSystem || {};
            window.NaPlanVision.MeasurmentToolsSystem.Helpers = Helpers;

        // endregion --------------------------------------------------

    })();

// endregion ----------------------------------------------------------
