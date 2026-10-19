// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - MEASURE - SNAP
// =============================================================================
//
// FILE       : Na__PubDoc__Measure__Snap__.js
// NAMESPACE  : Na__PubMsSnap
// MODULE     : Published Documents - Measure - Snap
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the exact point of a published drawing a reader means: the end, middle or crossing of a line, the foot of a perpendicular, square off the last point, or simply on a line
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - THE SAME SNAPS AS THE EDITOR, READ THE SAME WAY. Endpoint, Midpoint,
//   Intersection, Perpendicular and Nearest are AutoCAD's object snaps, and
//   the authoring side already marks them with AutoCAD's glyphs
//   (51__System__LayoutEditor/28__System__ObjectSnap). A reader who has drawn
//   in CAD reads the viewer's markers without being told.
// - POINT SNAPS FIRST, BY DISTANCE. Every candidate point within the aperture
//   is scored by how far it is from the pointer, plus a small handicap per
//   kind (a fraction of the aperture): at a corner, where an endpoint and a
//   crossing are the same point, the endpoint wins; a midpoint a little
//   nearer than a corner still wins, because a reader aiming at a midpoint is
//   pointing at it.
// - THEN SQUARE OFF THE LAST POINT. A second point within a small distance of
//   the horizontal or the vertical through the first locks to it (in the
//   viewport's own axes, so a turned plan squares to its walls, not to the
//   paper), and where that line crosses a line of the drawing near the
//   pointer, the point lands on the crossing. Ortho (Shift on a keyboard)
//   forces the lock whatever the pointer is near.
// - THEN ON A LINE. A pointer just off a line lands on it.
// - THE APERTURE IS THE CALLER'S, in sheet millimetres: the UI turns a fixed
//   size on screen into millimetres at the zoom of the moment, so the
//   pull feels the same at every zoom and a finger is given more than a mouse.
// - PURE. No DOM: the layers come from Na__PubDoc__Measure__Linework__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__PubMsLw__Near, Na__PubMsLw__Nearest, Na__PubMsLw__IsRealEnd } from './Na__PubDoc__Measure__Linework__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Kinds of Snap, Strongest First
    // ------------------------------------------------------------
    // end, int, mid and perp are points of the drawing itself; axisint is where
    // the square from the last point crosses a line; axis is on that square
    // only; near is on a line; none is wherever the pointer is.
    // ------------------------------------------------------------
    const Na__PubMsSnap__KINDS = Object.freeze([ 'end', 'int', 'mid', 'perp', 'axisint', 'axis', 'near', 'none' ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Which Kinds Fix a Point Exactly
    // ------------------------------------------------------------
    // A point snapped to one of these is a point OF the drawing, so a length
    // read from it is the drawing's own. On a line (near), on the square (axis)
    // and free (none) leave it somewhere along a line, or anywhere: a length
    // from such a point is an estimate, and is labelled as one.
    // ------------------------------------------------------------
    const Na__PubMsSnap__EXACT = Object.freeze({ end : true, int : true, mid : true, perp : true, axisint : true });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Handicap Each Point Snap Carries, as a Fraction of the Aperture
    // ------------------------------------------------------------
    const Na__PubMsSnap__PENALTY = Object.freeze({ end : 0, int : 0.15, mid : 0.35, perp : 0.45 });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Limits
    // ------------------------------------------------------------
    const Na__PubMsSnap__MAX_CANDIDATES = 160;                                   // <-- The nearest this many lines are paired for crossings (12,720 pairs at most)
    const Na__PubMsSnap__EPS            = 1e-9;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // FUNCTION | Where Two Segments Cross (null when they do not, or are parallel)
    // ------------------------------------------------------------
    // firstIsLine: the first is an infinite line through its two points (the
    // square off the last point), the second is still a segment.
    // ------------------------------------------------------------
    function Na__PubMsSnap__Cross(ax, ay, bx, by, cx, cy, dx, dy, firstIsLine) {
        const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
        const den = rx * sy - ry * sx;
        const scale = Math.hypot(rx, ry) * Math.hypot(sx, sy);
        if (scale === 0 || Math.abs(den) <= 1e-12 * scale) return null;
        const qx = cx - ax, qy = cy - ay;
        const t = (qx * sy - qy * sx) / den;
        const u = (qx * ry - qy * rx) / den;
        if (!firstIsLine && (t < -Na__PubMsSnap__EPS || t > 1 + Na__PubMsSnap__EPS)) return null;
        if (u < -Na__PubMsSnap__EPS || u > 1 + Na__PubMsSnap__EPS) return null;
        return [ ax + rx * t, ay + ry * t ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Lines of One Layer Near a Point, Nearest First and No More Than the Cap
    // ------------------------------------------------------------
    function Na__PubMsSnap__Candidates(layer, x, y, r) {
        const list = Na__PubMsLw__Near(layer, x, y, r, []);
        if (list.length <= Na__PubMsSnap__MAX_CANDIDATES) return list;
        return list
            .map((s) => ({ s, d : Na__PubMsLw__Nearest(layer, s, x, y).Distance }))
            .sort((a, b) => a.d - b.d)
            .slice(0, Na__PubMsSnap__MAX_CANDIDATES)
            .map((one) => one.s);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Square Through the Last Point: Its Direction for an Axis
    // ------------------------------------------------------------
    // 'h' runs along the viewport's own x, 'v' along its own y, so a turned
    // viewport squares to its own walls.
    // ------------------------------------------------------------
    function Na__PubMsSnap__AxisDirection(axis, spinDeg) {
        const a = (Number(spinDeg) || 0) * Math.PI / 180;
        const hx = Math.cos(a), hy = Math.sin(a);
        return axis === 'h' ? [ hx, hy ] : [ -hy, hx ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Finding a Snap
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Square Off the Last Point, Where the Pointer Is Near It (null when it is not)
    // ------------------------------------------------------------
    // Returns { Kind 'axis' | 'axisint', X, Y, LayerId, Axis, Guide }. The
    // guide runs from the last point to the snapped point, for the overlay.
    // ------------------------------------------------------------
    function Na__PubMsSnap__Square(layers, x, y, o, force) {
        const from = o.From;
        const rx = x - from.X, ry = y - from.Y;
        const h = Na__PubMsSnap__AxisDirection('h', o.SpinDeg), v = Na__PubMsSnap__AxisDirection('v', o.SpinDeg);
        const offH = Math.abs(rx * h[1] - ry * h[0]);                             // <-- How far the pointer is off the horizontal through the last point
        const offV = Math.abs(rx * v[1] - ry * v[0]);
        let axis = null;
        if (force) axis = (offH <= offV) ? 'h' : 'v';
        else if (Math.min(offH, offV) <= o.AxisToleranceMm) axis = (offH <= offV) ? 'h' : 'v';
        if (!axis) return null;

        const dir = axis === 'h' ? h : v;
        const t   = rx * dir[0] + ry * dir[1];
        const px  = from.X + dir[0] * t, py = from.Y + dir[1] * t;
        if (Math.abs(t) < 1e-9) return null;                                     // <-- On the last point itself: nothing to square

        // WHERE THE SQUARE CROSSES A LINE NEAR THE POINTER: the strongest thing
        // a square can find, because both of its lines are exact.
        let hit = null;
        for (const layer of layers) {
            for (const s of Na__PubMsSnap__Candidates(layer, px, py, o.ApertureMm)) {
                const q = Na__PubMsSnap__Cross(from.X, from.Y, from.X + dir[0], from.Y + dir[1],
                                               layer.X1[s], layer.Y1[s], layer.X2[s], layer.Y2[s], true);
                if (!q) continue;
                const d = Math.hypot(q[0] - px, q[1] - py);
                if (d <= o.ApertureMm && (!hit || d < hit.d)) hit = { d, x : q[0], y : q[1], layer : layer.Id };
            }
        }
        const at = hit ? [ hit.x, hit.y ] : [ px, py ];
        return {
            Kind    : hit ? 'axisint' : 'axis',
            X       : at[0], Y : at[1],
            LayerId : hit ? hit.layer : null,
            Axis    : axis,
            Guide   : { X1 : from.X, Y1 : from.Y, X2 : at[0], Y2 : at[1] }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Snap for a Pointer at Sheet Point (x, y)
    // ------------------------------------------------------------
    // layers  : the measuring layers to search (Na__PubMsLw__Build)
    // options : {
    //   ApertureMm       - how far a point snap reaches
    //   LineApertureMm   - how far "on a line" reaches (default 70% of it)
    //   AxisToleranceMm  - how near the square a pointer must be (default half the aperture)
    //   From             - { X, Y } the measurement's last point, or null
    //   SpinDeg          - the measurement's viewport turn, for the square
    //   Ortho            - true: always square off From (Shift)
    //   Modes            - { end, mid, int, perp, axis, near }: false switches one off
    // }
    // Returns { Kind, X, Y, LayerId, Axis, Guide, Distance }. Kind 'none' is
    // the pointer itself.
    // ------------------------------------------------------------
    function Na__PubMsSnap__Find(layers, x, y, options) {
        const o = Object.assign({}, options || {});
        o.ApertureMm      = Number(o.ApertureMm) > 0 ? Number(o.ApertureMm) : 1;
        o.LineApertureMm  = Number(o.LineApertureMm) > 0 ? Number(o.LineApertureMm) : o.ApertureMm * 0.7;
        o.AxisToleranceMm = Number(o.AxisToleranceMm) > 0 ? Number(o.AxisToleranceMm) : o.ApertureMm * 0.5;
        const modes = Object.assign({ end : true, mid : true, int : true, perp : true, axis : true, near : true }, o.Modes || {});
        const list  = Array.isArray(layers) ? layers.filter(Boolean) : [];
        const from  = (o.From && Number.isFinite(o.From.X) && Number.isFinite(o.From.Y)) ? o.From : null;
        o.From = from;
        const none = { Kind : 'none', X : x, Y : y, LayerId : null, Axis : null, Guide : null, Distance : 0 };

        // ORTHO: the square decides, the point snaps do not.
        if (from && o.Ortho) return Na__PubMsSnap__Square(list, x, y, o, true) || none;

        // 1. POINT SNAPS, scored by distance and kind
        // ------------------------------------------------------------
        const R = o.ApertureMm;
        let best = null;
        const consider = (kind, px, py, layerId) => {
            const d = Math.hypot(px - x, py - y);
            if (d > R) return;
            const score = d + Na__PubMsSnap__PENALTY[kind] * R;
            if (!best || score < best.Score) best = { Kind : kind, X : px, Y : py, LayerId : layerId, Axis : null, Guide : null, Distance : d, Score : score };
        };
        const reach = Math.max(R, o.LineApertureMm);
        const perLayer = [];
        for (const layer of list) {
            const near = Na__PubMsSnap__Candidates(layer, x, y, reach);
            perLayer.push({ layer, near });
            for (const s of near) {
                const ax = layer.X1[s], ay = layer.Y1[s], bx = layer.X2[s], by = layer.Y2[s];
                const realA = Na__PubMsLw__IsRealEnd(layer, s, 0), realB = Na__PubMsLw__IsRealEnd(layer, s, 1);
                if (modes.end) {
                    if (realA) consider('end', ax, ay, layer.Id);
                    if (realB) consider('end', bx, by, layer.Id);
                }
                if (modes.mid && realA && realB) consider('mid', (ax + bx) / 2, (ay + by) / 2, layer.Id);   // <-- The middle of a line cut by the frame is not the line's middle
                if (modes.perp && from) {
                    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
                    if (len2 > 0) {
                        const t = ((from.X - ax) * dx + (from.Y - ay) * dy) / len2;
                        const fx = ax + dx * t, fy = ay + dy * t;
                        const off = Math.hypot(from.X - fx, from.Y - fy);
                        if (t > 1e-6 && t < 1 - 1e-6 && off > 1e-6) consider('perp', fx, fy, layer.Id);
                    }
                }
            }
            if (modes.int) {
                const close = near.filter((s) => Na__PubMsLw__Nearest(layer, s, x, y).Distance <= R);
                for (let i = 0; i < close.length; i++) {
                    const a = close[i];
                    for (let j = i + 1; j < close.length; j++) {
                        const b = close[j];
                        const q = Na__PubMsSnap__Cross(layer.X1[a], layer.Y1[a], layer.X2[a], layer.Y2[a],
                                                       layer.X1[b], layer.Y1[b], layer.X2[b], layer.Y2[b], false);
                        if (q) consider('int', q[0], q[1], layer.Id);
                    }
                }
            }
        }
        if (best) { delete best.Score; return best; }

        // 2. SQUARE OFF THE LAST POINT
        // ------------------------------------------------------------
        if (from && modes.axis) {
            const square = Na__PubMsSnap__Square(list, x, y, o, false);
            if (square) { square.Distance = Math.hypot(square.X - x, square.Y - y); return square; }
        }

        // 3. ON A LINE
        // ------------------------------------------------------------
        if (modes.near) {
            let found = null;
            for (const one of perLayer) {
                for (const s of one.near) {
                    const n = Na__PubMsLw__Nearest(one.layer, s, x, y);
                    if (n.Distance <= o.LineApertureMm && (!found || n.Distance < found.Distance)) {
                        found = { Kind : 'near', X : n.X, Y : n.Y, LayerId : one.layer.Id, Axis : null, Guide : null, Distance : n.Distance };
                    }
                }
            }
            if (found) return found;
        }
        return none;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Snap Kind Fix a Point Exactly
    // ------------------------------------------------------------
    function Na__PubMsSnap__IsExact(kind) {
        return Na__PubMsSnap__EXACT[kind] === true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubMsSnap__KINDS,
        Na__PubMsSnap__Find,
        Na__PubMsSnap__Cross,
        Na__PubMsSnap__IsExact
    };

// endregion -------------------------------------------------------------------
