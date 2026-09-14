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
// - THREE ORIENTATIONS. An aligned dimension runs parallel to the two points
//   it measures and reports the straight distance between them. A horizontal
//   one runs across the paper and reports only how far apart the points are
//   in x; a vertical one runs down the paper and reports only the y. The two
//   ortho kinds measure between points at different heights - the eaves of
//   one wall to the foot of the next - without a sloping dimension.
// - THE OFFSET is measured from the start point, across the direction the
//   dimension runs, its sign giving the side. On an aligned dimension both
//   points sit on the span, so the line is the same distance from each; on an
//   ortho one each point runs its own extension line to the line, and the two
//   differ in length.
// - FIXED LENGTH EXTENSION LINES. Either extension line can be cut short: its
//   length is measured from the dimension line back towards its point, as a
//   CAD fixed-length extension line is, and the rest of it is not drawn. A
//   run of dimensions set clear of a drawing then reads as short, level lines
//   instead of long ones reaching back across it. The point is still where
//   the dimension measures from; only the ink stops early. The gap at the
//   point is as far as a length can cut back to, so a length longer than the
//   line changes nothing.
// - TEXT LEADER. The value can sit away from the line: an offset in paper
//   millimetres from where it would have read, and a circular arc from the
//   justified side of the value back to the centre of the dimension line.
//   The arc bulges away from the line so the hook bends outwards, then
//   curves back to the centre. The side is the handing of a note: dragged
//   to the right of the centre (along the way the value reads) the text is
//   left-justified and the arc lands on the left of the row, at its middle;
//   dragged to the left, right-justified, the arc on the right. Straight
//   above or below reads as to the right. Dragging the value home clears
//   the offset and the arc goes. A new dimension, and every record from
//   before this, has no offset and draws exactly as it did.
//
// INTEGRATION:
// - The markup bridge draws, measures and hit tests scene and sheet
//   dimensions with it; the dimension tool asks it for the ortho choice and
//   the direction an offset is measured in; the sheet tools ask it for the
//   offset that holds an ortho line still while a grip moves a point.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__DimensionGeometry__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim to 1.0.0
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
// - Ahead         : 1.1.0 (ortho orientations) and 1.2.0 (fixed length
//                   extension lines) were authored here first; the ValeVision
//                   back-port of extension lines waits. 1.3.0 to 1.5.1 (text
//                   leader, justified side, outward hook, softer bow) were
//                   authored here and ported to ValeVision3D v2.37.0.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.5.1
// - The outward hook is a shallower bow (less of the chord) so it reads
//   as a soft arc rather than a tight C.
//
// 14-Sep-2026 - Version 1.5.0
// - The text leader is a circle through the justified side and MID whose
//   bulge sits off the chord, away from the dimension line, so the hook
//   bends outwards. The earlier tangent-at-the-line arc scooped in.
//
// 14-Sep-2026 - Version 1.4.0
// - The text leader lands on the justified side of the row, at its middle,
//   not on whichever box edge faces MID. Dragged to the right of the centre
//   the value is left-justified and the arc meets its left; dragged to the
//   left, right-justified, the arc on the right. Straight above or below
//   reads as to the right, as a note does.
//
// 14-Sep-2026 - Version 1.3.0
// - Text leader: TextPlacement takes an optional paper offset; TextLayout
//   gives the value's box and, when the offset is far enough, a circular arc
//   from the box's edge to MID, tangent to the dimension line. Push draws
//   that arc under the value. HitText and DistanceToPolyline hit-test it.
//   Without an offset a dimension is unchanged to the bit.
//
// 14-Sep-2026 - Version 1.2.0
// - Fixed length extension lines. Skeleton takes an optional { startMm, endMm }
//   and Push passes spec.extension: each length starts its extension line that
//   far back from the dimension line, never nearer its point than the gap. G1
//   and G2 are where the full lines start, for a ghost of the part not drawn.
// - Without a length a skeleton is unchanged to the bit, and so is every scene
//   dimension, which never passes one.
//
// 13-Sep-2026 - Version 1.1.0
// - Horizontal and vertical (ortho) dimensions beside aligned ones. Frame
//   gives the direction an orientation runs in; the skeleton takes the
//   orientation and runs each measured point's own extension line to the
//   dimension line; SpanMm is the x or the y alone for an ortho dimension;
//   OrthoToward picks horizontal or vertical from where the line is dragged;
//   OffsetKeepingLine holds an ortho line still while a grip moves a point.
// - An aligned dimension's skeleton is unchanged to the bit.
// - An ortho value never rotates off square: a horizontal one reads level and
//   a vertical one reads up the sheet, whichever point was picked first.
//
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
        Na__LeChrome__MeasureTextMm,
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

    // MODULE CONSTANTS | Value Box, Arc Sampling
    // ------------------------------------------------------------
    const Na__LeDimGeo__CAP_HEIGHT  = 0.72;     // <-- Helvetica cap height as a fraction of the font size, as the chrome measures it
    const Na__LeDimGeo__DESCENT     = 0.25;
    const Na__LeDimGeo__ARC_STEP_MM = 0.4;
    const Na__LeDimGeo__ARC_MIN     = 8;
    const Na__LeDimGeo__ARC_MAX     = 64;
    const Na__LeDimGeo__ARC_SAG     = 0.16;     // <-- How far the hook bends off the chord, as a fraction of the chord
    const Na__LeDimGeo__EPSILON     = 1e-6;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Orientations (the values Dimension__Orientation holds) and the Axis an Ortho One Runs Along
    // ------------------------------------------------------------
    const Na__LeDimGeo__ALIGNED    = 'aligned';                               // <-- Parallel to the span: the straight distance
    const Na__LeDimGeo__HORIZONTAL = 'horizontal';                            // <-- Across the paper: the x distance
    const Na__LeDimGeo__VERTICAL   = 'vertical';                              // <-- Down the paper: the y distance
    const Na__LeDimGeo__AXIS_X     = 'x';
    const Na__LeDimGeo__AXIS_Y     = 'y';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Skeleton
// -----------------------------------------------------------------------------

    // FUNCTION | The Direction a Dimension Runs, and How Long It Is
    // ------------------------------------------------------------
    // Returns { length, dirX, dirY, perpX, perpY, axis }, or null when there
    // is nothing to measure that way. axis is 'x' for a horizontal dimension,
    // 'y' for a vertical one and null for aligned. An ortho direction still
    // points from the start's side towards the end's, so a positive offset
    // means the same side it does on an aligned dimension.
    // ------------------------------------------------------------
    function Na__LeDimGeo__Frame(start, end, orientation) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (orientation === Na__LeDimGeo__HORIZONTAL) {
            const dirX = dx < 0 ? -1 : 1;
            return Math.abs(dx) > 0 ? { length : Math.abs(dx), dirX : dirX, dirY : 0, perpX : 0, perpY : dirX, axis : Na__LeDimGeo__AXIS_X } : null;
        }
        if (orientation === Na__LeDimGeo__VERTICAL) {
            const dirY = dy < 0 ? -1 : 1;
            return Math.abs(dy) > 0 ? { length : Math.abs(dy), dirX : 0, dirY : dirY, perpX : -dirY, perpY : 0, axis : Na__LeDimGeo__AXIS_Y } : null;
        }
        const length = Math.sqrt((dx * dx) + (dy * dy));
        if (!(length > 0)) return null;
        const dirX = dx / length, dirY = dy / length;
        return { length : length, dirX : dirX, dirY : dirY, perpX : -dirY, perpY : dirX, axis : null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Extension Line's Length, or Null for the Full Line
    // ------------------------------------------------------------
    // extension : { startMm, endMm } or nothing. Anything but a number of
    // zero or more is no length at all.
    // ------------------------------------------------------------
    function Na__LeDimGeo__ExtensionLength(extension, key) {
        const value = extension ? extension[key] : null;
        return (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far From Its Point an Extension Line Starts
    // ------------------------------------------------------------
    // reachMm is how far the point is from the dimension line. The full line
    // starts at the gap; a length starts it that far back from the dimension
    // line instead, but never nearer the point than the gap.
    // ------------------------------------------------------------
    function Na__LeDimGeo__ExtensionFrom(reachMm, gapMm, lengthMm) {
        return lengthMm === null ? gapMm : Math.max(gapMm, reachMm - lengthMm);
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Every Point a Dimension Draws
    // ------------------------------------------------------------
    // start, end : { x, y }     offsetMm signed (the side)     gapMm, overshootMm
    // orientation : 'aligned' (or nothing), 'horizontal' or 'vertical'
    // extension   : { startMm, endMm } or nothing - how far each extension line
    //               runs back from the dimension line; no length is the full line
    // Returns null for a degenerate span.
    //   S,E picked endpoints   DS,DE dimension line   X1,T1 / X2,T2 extension lines   MID text anchor
    //   G1,G2 where the full extension lines start: X1 and X2 themselves unless a length cuts them short
    // ------------------------------------------------------------
    function Na__LeDimGeo__Skeleton(start, end, offsetMm, gapMm, overshootMm, orientation, extension) {
        const frame = Na__LeDimGeo__Frame(start, end, orientation);
        if (!frame) return null;
        const perpX  = frame.perpX, perpY = frame.perpY;
        const offset = Number.isFinite(offsetMm) ? offsetMm : 0;

        // How far the END point's extension line runs. On an aligned dimension
        // both points sit on the span, so it is the offset itself; on an ortho
        // one the end sits wherever it was picked and runs its own distance.
        const reach = frame.axis ? offset - (((end.x - start.x) * perpX) + ((end.y - start.y) * perpY)) : offset;
        const sign  = offset >= 0 ? 1 : -1;
        const signE = reach  >= 0 ? 1 : -1;
        const at = (bx, by, along) => ({ x : bx + (perpX * along), y : by + (perpY * along) });
        const fromS = Na__LeDimGeo__ExtensionFrom(Math.abs(offset), gapMm, Na__LeDimGeo__ExtensionLength(extension, 'startMm'));
        const fromE = Na__LeDimGeo__ExtensionFrom(Math.abs(reach),  gapMm, Na__LeDimGeo__ExtensionLength(extension, 'endMm'));

        const DS = at(start.x, start.y, offset);
        let DE;
        if (frame.axis === Na__LeDimGeo__AXIS_X)      DE = { x : end.x, y : DS.y };   // <-- Exactly level with DS, never a rounding off it
        else if (frame.axis === Na__LeDimGeo__AXIS_Y) DE = { x : DS.x,  y : end.y };
        else                                          DE = at(end.x, end.y, offset);
        const MID = frame.axis
            ? { x : (DS.x + DE.x) / 2, y : (DS.y + DE.y) / 2 }
            : at((start.x + end.x) / 2, (start.y + end.y) / 2, offset);

        return {
            length : frame.length, dirX : frame.dirX, dirY : frame.dirY, perpX : perpX, perpY : perpY, axis : frame.axis,
            S   : { x : start.x, y : start.y },
            E   : { x : end.x,   y : end.y },
            DS  : DS,
            DE  : DE,
            X1  : at(start.x, start.y, fromS * sign),
            T1  : at(start.x, start.y, offset + (overshootMm * sign)),
            X2  : at(end.x,   end.y,   fromE * signE),
            T2  : at(end.x,   end.y,   reach + (overshootMm * signE)),
            G1  : at(start.x, start.y, gapMm * sign),
            G2  : at(end.x,   end.y,   gapMm * signE),
            MID : MID
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
    // A line pointing straight down the paper sits exactly on the turning
    // point, so which way its value read used to follow which point was picked
    // first. An ortho dimension settles it: a vertical one always reads up the
    // sheet, as drawings are dimensioned, and a horizontal one always level.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextPlacement(skeleton, liftMm, shift) {
        let angleDeg = Math.atan2(skeleton.DE.y - skeleton.DS.y, skeleton.DE.x - skeleton.DS.x) * (180 / Math.PI);
        if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;
        if (skeleton.axis === Na__LeDimGeo__AXIS_X) angleDeg = 0;
        if (skeleton.axis === Na__LeDimGeo__AXIS_Y) angleDeg = -90;          // <-- Reads up the sheet, whichever point came first
        const a  = angleDeg * (Math.PI / 180);
        const dx = (shift && Number.isFinite(shift.dx)) ? shift.dx : 0;
        const dy = (shift && Number.isFinite(shift.dy)) ? shift.dy : 0;
        return {
            x        : skeleton.MID.x + (Math.sin(a) * liftMm) + dx,               // <-- Local "up" of the rotated text, then the drag
            y        : skeleton.MID.y - (Math.cos(a) * liftMm) + dy,
            angleDeg : angleDeg
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rotated Box the Value Occupies
    // ------------------------------------------------------------
    // place is TextPlacement's result. points are [x, y] corners, running
    // clockwise in the text's local frame: top-left, top-right, bottom-right,
    // bottom-left. center is the visual middle, not the baseline.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextBox(place, widthMm, fontMm) {
        const half = Math.max(0, widthMm) / 2;
        const up   = fontMm * Na__LeDimGeo__CAP_HEIGHT, down = fontMm * Na__LeDimGeo__DESCENT;
        const a    = place.angleDeg * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        const at   = (lx, ly) => [ place.x + (lx * cos) - (ly * sin), place.y + (lx * sin) + (ly * cos) ];
        const mid  = at(0, (down - up) / 2);
        return {
            points   : [ at(-half, -up), at(half, -up), at(half, down), at(-half, down) ],
            center   : { x : mid[0], y : mid[1] },
            place    : place,
            widthMm  : widthMm,
            fontMm   : fontMm,
            angleDeg : place.angleDeg
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Side of the Centre the Value Sits On, Along the Way It Reads
    // ------------------------------------------------------------
    // +1 to the right of MID (or straight above or below it): left-justified,
    // the arc lands on the left of the row. -1 to the left: right-justified,
    // the arc on the right. The same handing a note uses.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextHand(skeleton, place) {
        const a  = place.angleDeg * (Math.PI / 180);
        const ax = Math.cos(a), ay = Math.sin(a);
        const along = ((place.x - skeleton.MID.x) * ax) + ((place.y - skeleton.MID.y) * ay);
        return along < -Na__LeDimGeo__EPSILON ? -1 : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Arc Meets the Value: the Justified Side, Middle of the Row
    // ------------------------------------------------------------
    // hand +1 is the left of the row (local -x), -1 the right. gapMm steps
    // the point off the letters toward MID so the arc does not sit on them.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextAttach(box, hand, gapMm) {
        const half = box.widthMm / 2;
        const gap  = (Number.isFinite(gapMm) && gapMm > 0) ? gapMm : 0;
        const lx   = hand > 0 ? -(half + gap) : (half + gap);
        const ly   = -(box.fontMm * Na__LeDimGeo__CAP_HEIGHT) / 2;             // <-- Middle of the capitals, the middle of the row
        const a    = box.angleDeg * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        return {
            x : box.place.x + (lx * cos) - (ly * sin),
            y : box.place.y + (lx * sin) + (ly * cos)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Baseline Origin PushText Uses for a Left or Right-Justified Value
    // ------------------------------------------------------------
    // place is still the centre, so a drag does not jump when the handing
    // flips; the origin is that centre shifted to the justified end.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextOrigin(place, widthMm, align) {
        if (align !== 'left' && align !== 'right') return { x : place.x, y : place.y, align : 'center' };
        const lx = (widthMm / 2) * (align === 'left' ? -1 : 1);
        const a  = place.angleDeg * (Math.PI / 180);
        return {
            x     : place.x + (lx * Math.cos(a)),
            y     : place.y + (lx * Math.sin(a)),
            align : align
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Perpendicular That Points From the Dimension Line Toward the Value
    // ------------------------------------------------------------
    // The way "out" of the line. The leader's bulge is on this side of the
    // chord so the hook bends away from the line rather than scooping in.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextOut(skeleton, place) {
        const px = skeleton.perpX, py = skeleton.perpY;
        const d  = ((place.x - skeleton.MID.x) * px) + ((place.y - skeleton.MID.y) * py);
        const s  = d < 0 ? -1 : 1;
        return { x : px * s, y : py * s };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Circle Through Three Points
    // ------------------------------------------------------------
    function Na__LeDimGeo__Circumcircle(a, b, c) {
        const d = 2 * ((a.x * (b.y - c.y)) + (b.x * (c.y - a.y)) + (c.x * (a.y - b.y)));
        if (Math.abs(d) < Na__LeDimGeo__EPSILON) return null;
        const a2 = (a.x * a.x) + (a.y * a.y);
        const b2 = (b.x * b.x) + (b.y * b.y);
        const c2 = (c.x * c.x) + (c.y * c.y);
        const cx = ((a2 * (b.y - c.y)) + (b2 * (c.y - a.y)) + (c2 * (a.y - b.y))) / d;
        const cy = ((a2 * (c.x - b.x)) + (b2 * (a.x - c.x)) + (c2 * (b.x - a.x))) / d;
        const r  = Math.hypot(a.x - cx, a.y - cy);
        if (!(r > Na__LeDimGeo__EPSILON)) return null;
        return { cx : cx, cy : cy, r : r };
    }
    // ------------------------------------------------------------


    // FUNCTION | An Angle Wrapped into (-π, π]
    // ------------------------------------------------------------
    function Na__LeDimGeo__WrapPi(delta) {
        while (delta <= -Math.PI) delta += Math.PI * 2;
        while (delta > Math.PI)   delta -= Math.PI * 2;
        return delta;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Circular Arc From One Point to Another, Bulging Along (outX, outY)
    // ------------------------------------------------------------
    // The unique circle through the ends whose peak sits off the chord on
    // the outward side. That is the hook that bends away from the dimension
    // line. Degenerates to the chord when the three points are collinear.
    // ------------------------------------------------------------
    function Na__LeDimGeo__ArcPoints(from, to, outX, outY) {
        const vx = to.x - from.x, vy = to.y - from.y;
        const chord = Math.hypot(vx, vy);
        if (!(chord > Na__LeDimGeo__EPSILON)) return [ [ from.x, from.y ], [ to.x, to.y ] ];
        let nx = -vy / chord, ny = vx / chord;
        if (((nx * outX) + (ny * outY)) < 0) { nx = -nx; ny = -ny; }
        const sag  = chord * Na__LeDimGeo__ARC_SAG;
        const peak = { x : ((from.x + to.x) / 2) + (nx * sag), y : ((from.y + to.y) / 2) + (ny * sag) };
        const found = Na__LeDimGeo__Circumcircle(from, peak, to);
        if (!found) return [ [ from.x, from.y ], [ peak.x, peak.y ], [ to.x, to.y ] ];
        const a0 = Math.atan2(from.y - found.cy, from.x - found.cx);
        const a1 = Math.atan2(to.y - found.cy, to.x - found.cx);
        const ap = Math.atan2(peak.y - found.cy, peak.x - found.cx);
        let delta = Na__LeDimGeo__WrapPi(a1 - a0);
        const dP  = Na__LeDimGeo__WrapPi(ap - a0);
        if (!delta || ((dP * delta) < 0) || (Math.abs(dP) > (Math.abs(delta) + Na__LeDimGeo__EPSILON))) {
            delta += (delta > 0 ? -Math.PI * 2 : Math.PI * 2);
        }
        const n = Math.max(Na__LeDimGeo__ARC_MIN, Math.min(Na__LeDimGeo__ARC_MAX, Math.ceil(Math.abs(found.r * delta) / Na__LeDimGeo__ARC_STEP_MM)));
        const points = [];
        for (let i = 0; i <= n; i++) {
            const a = a0 + (delta * (i / n));
            points.push([ found.cx + (Math.cos(a) * found.r), found.cy + (Math.sin(a) * found.r) ]);
        }
        return points;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Value's Place, Its Box, and the Leader Arc When There Is One
    // ------------------------------------------------------------
    // spec: { liftMm, text, fontMm, weight, dx, dy, minMm, gapMm }
    // dx, dy are paper millimetres from the un-dragged place; anything not a
    // number is none. minMm is how far the drag has to be before the arc is
    // drawn (and before a drag keeps rather than snapping home). Returns
    // { place, box, align, origin, leader } - leader is { from, to, points }
    // or null. align is 'center' on the line, 'left' or 'right' once dragged.
    // ------------------------------------------------------------
    function Na__LeDimGeo__TextLayout(skeleton, spec) {
        const s     = spec || {};
        const dx    = Number.isFinite(s.dx) ? s.dx : 0;
        const dy    = Number.isFinite(s.dy) ? s.dy : 0;
        const place = Na__LeDimGeo__TextPlacement(skeleton, s.liftMm, { dx : dx, dy : dy });
        const width = s.text ? Na__LeChrome__MeasureTextMm(s.text, s.fontMm, s.weight || 400) : 0;
        const box   = Na__LeDimGeo__TextBox(place, width, s.fontMm || 0);
        const minMm = Number.isFinite(s.minMm) ? s.minMm : 0;
        const reach = Math.hypot(dx, dy);
        const off   = reach > Na__LeDimGeo__EPSILON && reach >= minMm;
        const hand  = off ? Na__LeDimGeo__TextHand(skeleton, place) : 0;
        const align = hand > 0 ? 'left' : (hand < 0 ? 'right' : 'center');
        let leader  = null;
        if (off) {
            const from = Na__LeDimGeo__TextAttach(box, hand, s.gapMm);
            if (Math.hypot(from.x - skeleton.MID.x, from.y - skeleton.MID.y) > Na__LeDimGeo__EPSILON) {
                const out    = Na__LeDimGeo__TextOut(skeleton, place);
                const points = Na__LeDimGeo__ArcPoints(from, skeleton.MID, out.x, out.y);
                if (points.length >= 2) leader = { from : from, to : skeleton.MID, points : points };
            }
        }
        return {
            place : place, box : box, align : align,
            origin : Na__LeDimGeo__TextOrigin(place, width, align),
            leader : leader
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Point Hits the Value's Rotated Box
    // ------------------------------------------------------------
    function Na__LeDimGeo__HitText(box, point, toleranceMm) {
        if (!box || !point) return false;
        const pad  = Number.isFinite(toleranceMm) ? toleranceMm : 0;
        const a    = box.angleDeg * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        const dx   = point.x - box.place.x, dy = point.y - box.place.y;
        const lx   = (dx * cos) + (dy * sin);
        const ly   = (-dx * sin) + (dy * cos);
        const half = box.widthMm / 2;
        const up   = box.fontMm * Na__LeDimGeo__CAP_HEIGHT, down = box.fontMm * Na__LeDimGeo__DESCENT;
        return lx >= -half - pad && lx <= half + pad && ly >= -up - pad && ly <= down + pad;
    }
    // ------------------------------------------------------------


    // FUNCTION | Distance From a Point to a Polyline ([x, y] vertices)
    // ------------------------------------------------------------
    function Na__LeDimGeo__DistanceToPolyline(point, points) {
        if (!points || points.length < 2) return Infinity;
        let best = Infinity;
        for (let i = 1; i < points.length; i++) {
            const gap = Na__LeDimGeo__DistanceToSegment(point, { x : points[i - 1][0], y : points[i - 1][1] }, { x : points[i][0], y : points[i][1] });
            if (gap < best) best = gap;
        }
        return best;
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
// REGION | Orientation
// -----------------------------------------------------------------------------

    // FUNCTION | What a Dimension Measures Between Its Two Points, in Their Millimetres
    // ------------------------------------------------------------
    // The straight distance for an aligned dimension; only the x for a
    // horizontal one and only the y for a vertical one.
    // ------------------------------------------------------------
    function Na__LeDimGeo__SpanMm(start, end, orientation) {
        if (orientation === Na__LeDimGeo__HORIZONTAL) return Math.abs(end.x - start.x);
        if (orientation === Na__LeDimGeo__VERTICAL)   return Math.abs(end.y - start.y);
        return Math.hypot(end.x - start.x, end.y - start.y);
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Ortho Orientation a Line Dragged to a Point Takes
    // ------------------------------------------------------------
    // As a CAD linear dimension decides it: take the box the two points span.
    // A cursor above or below the box gives a horizontal dimension, one to
    // either side a vertical one, and off a corner the side it is further out
    // on wins. Inside the box there is nothing to go on, so the orientation
    // already held stays; with none held, the wider of the span's two extents
    // picks. A span with no width can never be horizontal, nor one with no
    // height vertical - it takes the other. minSpanMm is how small an extent
    // counts as none.
    // ------------------------------------------------------------
    function Na__LeDimGeo__OrthoToward(start, end, pointMm, current, minSpanMm) {
        const spanX = Math.abs(end.x - start.x), spanY = Math.abs(end.y - start.y);
        const floor = Number.isFinite(minSpanMm) ? Math.max(0, minSpanMm) : 0;
        const outX  = Math.max(Math.min(start.x, end.x) - pointMm.x, pointMm.x - Math.max(start.x, end.x), 0);
        const outY  = Math.max(Math.min(start.y, end.y) - pointMm.y, pointMm.y - Math.max(start.y, end.y), 0);
        let wanted;
        if (outY > outX)                                                                     wanted = Na__LeDimGeo__HORIZONTAL;   // <-- Above or below the points: the line runs across
        else if (outX > outY)                                                                wanted = Na__LeDimGeo__VERTICAL;     // <-- Beside them: the line runs down
        else if (current === Na__LeDimGeo__HORIZONTAL || current === Na__LeDimGeo__VERTICAL) wanted = current;
        else                                                                                 wanted = spanX >= spanY ? Na__LeDimGeo__HORIZONTAL : Na__LeDimGeo__VERTICAL;
        if (wanted === Na__LeDimGeo__HORIZONTAL && spanX <= floor && spanY > floor) return Na__LeDimGeo__VERTICAL;
        if (wanted === Na__LeDimGeo__VERTICAL   && spanY <= floor && spanX > floor) return Na__LeDimGeo__HORIZONTAL;
        return wanted;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Offset That Leaves an Ortho Dimension's Line Where It Is After a Point Moves
    // ------------------------------------------------------------
    // Re-picking a measured point with its grip should not drag the line
    // along: it was put where it is on purpose, clear of the drawing. An ortho
    // offset is measured from the start, so moving the start - or moving the
    // end across it, which reverses the direction - would otherwise shift the
    // line. The offset is measured again to hold it still. An aligned
    // dimension keeps its offset: its line belongs to the span and turns with
    // it, as it always has.
    // ------------------------------------------------------------
    function Na__LeDimGeo__OffsetKeepingLine(fromStart, fromEnd, offsetMm, toStart, toEnd, orientation) {
        const before = Na__LeDimGeo__Frame(fromStart, fromEnd, orientation);
        const after  = Na__LeDimGeo__Frame(toStart, toEnd, orientation);
        if (!before || !after || !before.axis || !Number.isFinite(offsetMm)) return offsetMm;
        const lineX = fromStart.x + (before.perpX * offsetMm);                  // <-- DS: a point on the line as it stands
        const lineY = fromStart.y + (before.perpY * offsetMm);
        return ((lineX - toStart.x) * after.perpX) + ((lineY - toStart.y) * after.perpY);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitive Builder
// -----------------------------------------------------------------------------

    // FUNCTION | Push One Complete Dimension
    // ------------------------------------------------------------
    // spec: { start, end, orientation, offsetMm, gapMm, overshootMm, tickMm,
    //         strokeMm, colour, terminator, text, fontMm, weight, liftMm, fontFamily,
    //         extension, textDXMm, textDYMm, textLeaderMinMm, textLeaderGapMm,
    //         textFillColour }
    // orientation may be left out: a scene dimension has none, and is aligned.
    // extension may be left out as well ({ startMm, endMm }): the full lines.
    // textDXMm / textDYMm are the value's paper offset from its un-dragged
    // place; left out, the value sits on the line as it always did.
    // Returns the skeleton (for hit testing and highlights), or null.
    // ------------------------------------------------------------
    function Na__LeDimGeo__Push(list, spec) {
        const sk = Na__LeDimGeo__Skeleton(spec.start, spec.end, spec.offsetMm, spec.gapMm, spec.overshootMm, spec.orientation, spec.extension);
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
            const layout = Na__LeDimGeo__TextLayout(sk, {
                liftMm : spec.liftMm, text : spec.text, fontMm : spec.fontMm, weight : spec.weight,
                dx : spec.textDXMm, dy : spec.textDYMm, minMm : spec.textLeaderMinMm, gapMm : spec.textLeaderGapMm
            });
            if (layout.leader) Na__LeChrome__PushPolyline(list, layout.leader.points, colour, stroke, null, false);
            if (layout.leader && spec.textFillColour) {
                Na__LeChrome__PushPolyline(list, layout.box.points, null, 0, spec.textFillColour, true);
            }
            Na__LeChrome__PushText(list, {
                X : layout.origin.x, BaselineY : layout.origin.y, Text : spec.text, FontMm : spec.fontMm, Weight : spec.weight,
                Colour : colour, Align : layout.origin.align, RotateDeg : layout.place.angleDeg, FontFamily : spec.fontFamily || null
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
        Na__LeDimGeo__ALIGNED,
        Na__LeDimGeo__HORIZONTAL,
        Na__LeDimGeo__VERTICAL,
        Na__LeDimGeo__Frame,
        Na__LeDimGeo__Skeleton,
        Na__LeDimGeo__Terminator,
        Na__LeDimGeo__TextPlacement,
        Na__LeDimGeo__TextBox,
        Na__LeDimGeo__TextLayout,
        Na__LeDimGeo__HitText,
        Na__LeDimGeo__DistanceToPolyline,
        Na__LeDimGeo__DistanceToSegment,
        Na__LeDimGeo__SpanMm,
        Na__LeDimGeo__OrthoToward,
        Na__LeDimGeo__OffsetKeepingLine,
        Na__LeDimGeo__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
