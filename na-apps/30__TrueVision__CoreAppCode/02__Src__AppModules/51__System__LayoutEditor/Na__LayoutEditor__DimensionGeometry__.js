// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DIMENSION GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__DimensionGeometry__.js
// NAMESPACE  : Na__LeDimGeo
// MODULE     : Layout Editor - Dimension Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The shape of a dimension in any millimetre space, as chrome primitives
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The same drawing rules as the plan dimension overlay (skeleton with an
//   offset side, extension gap and overshoot, tick / arrow / dot
//   terminators, the value along the line and never upside down), but
//   resolved once in paper millimetres and pushed as primitives, so the
//   screen SVG and the PDF share it.
// - Pure arithmetic in a y-down space; the caller converts drawing
//   millimetres to paper millimetres before calling.
//
// INTEGRATION:
// - Used by the markup bridge for scene and sheet dimensions.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__DimensionGeometry__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Primitive Builders
    // ------------------------------------------------------------
    import {
        Na__LeChrome__PushLine,
        Na__LeChrome__PushPolyline,
        Na__LeChrome__PushText
    } from './Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Terminator Proportions (as the plan overlay)
    // ------------------------------------------------------------
    const Na__LeDimGeo__ARROW_WIDTH_RATIO = 0.35;
    const Na__LeDimGeo__DOT_RADIUS_RATIO  = 0.22;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Skeleton
// -----------------------------------------------------------------------------

    // FUNCTION | Resolve Every Point a Dimension Draws
    // ------------------------------------------------------------
    // start, end : { x, y }     offsetMm signed (the side)     gapMm, overshootMm
    // Returns null for a degenerate span.
    //   S,E picked endpoints   DS,DE dimension line   X1,T1 / X2,T2 extension lines   MID text anchor
    // ------------------------------------------------------------
    function Na__LeDimGeo__Skeleton(start, end, offsetMm, gapMm, overshootMm) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt((dx * dx) + (dy * dy));
        if (!(length > 0)) return null;
        const dirX  = dx / length, dirY = dy / length;
        const perpX = -dirY,       perpY = dirX;
        const offset = Number.isFinite(offsetMm) ? offsetMm : 0;
        const sign   = offset >= 0 ? 1 : -1;
        const gap    = gapMm * sign;
        const beyond = offset + (overshootMm * sign);
        const at = (bx, by, along) => ({ x : bx + (perpX * along), y : by + (perpY * along) });
        return {
            length : length, dirX : dirX, dirY : dirY, perpX : perpX, perpY : perpY,
            S   : { x : start.x, y : start.y },
            E   : { x : end.x,   y : end.y },
            DS  : at(start.x, start.y, offset),
            DE  : at(end.x,   end.y,   offset),
            X1  : at(start.x, start.y, gap),
            T1  : at(start.x, start.y, beyond),
            X2  : at(end.x,   end.y,   gap),
            T2  : at(end.x,   end.y,   beyond),
            MID : at((start.x + end.x) / 2, (start.y + end.y) / 2, offset)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Terminator Outline at a Point, Pointing Outward Along (dirX, dirY)
    // ------------------------------------------------------------
    // Returns { points, closed, filled } in the same space as the point.
    // ------------------------------------------------------------
    function Na__LeDimGeo__Terminator(style, point, dirX, dirY, tickMm) {
        const px = point.x, py = point.y;
        if (style === 'dot') {
            const r = Math.max(tickMm * Na__LeDimGeo__DOT_RADIUS_RATIO, 0.05);
            const points = [];
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI / 4) * i;
                points.push([ px + (Math.cos(a) * r), py + (Math.sin(a) * r) ]);
            }
            return { points : points, closed : true, filled : true };
        }
        if (style === 'arrow') {
            const half  = tickMm * Na__LeDimGeo__ARROW_WIDTH_RATIO;
            const baseX = px - (dirX * tickMm), baseY = py - (dirY * tickMm);
            const nX = -dirY, nY = dirX;
            return { points : [ [ px, py ], [ baseX + (nX * half), baseY + (nY * half) ], [ baseX - (nX * half), baseY - (nY * half) ] ], closed : true, filled : true };
        }
        // TICK | A short 45-degree stroke through the point
        const half = tickMm / 2;
        const tx = (dirX - dirY) * half;
        const ty = (dirY + dirX) * half;
        return { points : [ [ px - tx, py - ty ], [ px + tx, py + ty ] ], closed : false, filled : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Value Sits: Along the Line, Lifted, Never Upside Down
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextPlacement(skeleton, liftMm) {
        let angleDeg = Math.atan2(skeleton.DE.y - skeleton.DS.y, skeleton.DE.x - skeleton.DS.x) * (180 / Math.PI);
        if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;
        const a = angleDeg * (Math.PI / 180);
        return {
            x        : skeleton.MID.x + (Math.sin(a) * liftMm),                   // <-- Local "up" of the rotated text
            y        : skeleton.MID.y - (Math.cos(a) * liftMm),
            angleDeg : angleDeg
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Distance From a Point to a Segment
    // ------------------------------------------------------------
    function Na__LeDimGeo__DistanceToSegment(point, a, b) {
        const abx = b.x - a.x, aby = b.y - a.y;
        const len2 = (abx * abx) + (aby * aby);
        let t = len2 > 0 ? (((point.x - a.x) * abx) + ((point.y - a.y) * aby)) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + (abx * t), cy = a.y + (aby * t);
        return Math.hypot(point.x - cx, point.y - cy);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitive Builder
// -----------------------------------------------------------------------------

    // FUNCTION | Push One Complete Dimension
    // ------------------------------------------------------------
    // spec: { start, end, offsetMm, gapMm, overshootMm, tickMm, strokeMm, colour,
    //         terminator, text, fontMm, weight, liftMm, fontFamily }
    // Returns the skeleton (for hit testing and highlights), or null.
    // ------------------------------------------------------------
    function Na__LeDimGeo__Push(list, spec) {
        const sk = Na__LeDimGeo__Skeleton(spec.start, spec.end, spec.offsetMm, spec.gapMm, spec.overshootMm);
        if (!sk) return null;
        const stroke = Math.max(spec.strokeMm, 0.05);
        const colour = spec.colour;

        Na__LeChrome__PushLine(list, sk.X1.x, sk.X1.y, sk.T1.x, sk.T1.y, colour, stroke);
        Na__LeChrome__PushLine(list, sk.X2.x, sk.X2.y, sk.T2.x, sk.T2.y, colour, stroke);
        Na__LeChrome__PushLine(list, sk.DS.x, sk.DS.y, sk.DE.x, sk.DE.y, colour, stroke);

        const t1 = Na__LeDimGeo__Terminator(spec.terminator, sk.DS, -sk.dirX, -sk.dirY, spec.tickMm);
        const t2 = Na__LeDimGeo__Terminator(spec.terminator, sk.DE,  sk.dirX,  sk.dirY, spec.tickMm);
        [ t1, t2 ].forEach((t) => Na__LeChrome__PushPolyline(list, t.points, colour, stroke, t.filled ? colour : null, t.closed));

        if (spec.text) {
            const place = Na__LeDimGeo__TextPlacement(sk, spec.liftMm);
            Na__LeChrome__PushText(list, {
                X : place.x, BaselineY : place.y, Text : spec.text, FontMm : spec.fontMm, Weight : spec.weight,
                Colour : colour, Align : 'center', RotateDeg : place.angleDeg, FontFamily : spec.fontFamily || null
            });
        }
        return sk;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dimension Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeDimGeo__Skeleton,
        Na__LeDimGeo__Terminator,
        Na__LeDimGeo__TextPlacement,
        Na__LeDimGeo__DistanceToSegment,
        Na__LeDimGeo__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
