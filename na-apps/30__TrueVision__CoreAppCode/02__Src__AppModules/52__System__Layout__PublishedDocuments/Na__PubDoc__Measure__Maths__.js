// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - MEASURE - MATHS
// =============================================================================
//
// FILE       : Na__PubDoc__Measure__Maths__.js
// NAMESPACE  : Na__PubMsMath
// MODULE     : Published Documents - Measure - Maths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a measurement's sheet points into real lengths and areas at its drawing's scale, and say them the way the drawings do
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - ONE MEASUREMENT RECORD, shared by the reader and the viewer's tools:
//     { Id, Tool : 'linear' | 'rect' | 'area', ViewportId, Scale, SpinDeg,
//       Points : [ { X, Y, Snap } ] }
//   Points are sheet millimetres. Scale is the denominator of the viewport the
//   measurement was started on (Viewport__ScaleDenominator), so a real
//   length is the sheet length times Scale.
// - A RECTANGLE IS SQUARE TO ITS DRAWING. Its two corners are opposite
//   corners in the viewport's own axes (Viewport__RotationDeg), so on a
//   turned plan it lies along the walls rather than along the paper.
// - EXACT OR AN ESTIMATE, SAID PLAINLY. A value whose every point was snapped
//   to a point of the drawing (Na__PubMsSnap__IsExact) is the drawing's own
//   and is given to the millimetre. One with any point placed by eye, or slid
//   along a line, starts with "≈" and is rounded to 5 mm, as PlanVision
//   rounded everything.
// - METRES ON A SITE PLAN. At 1:500 and coarser a millimetre is a fraction of
//   a pen width, so lengths are metres to the centimetre (an estimate to the
//   decimetre). Areas are square metres, with hectares beside a large one.
// - PURE. No DOM, no imports.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__PubMsMath__SITE_SCALE      = 500;                                  // <-- 1:500 and coarser: lengths in metres
    const Na__PubMsMath__ROUND_MM        = 5;                                    // <-- An estimate, to the nearest 5 mm (PlanVision's rounding)
    const Na__PubMsMath__HECTARE_FROM_M2 = 1000;                                 // <-- From here a large area also says its hectares
    const Na__PubMsMath__EXACT_KINDS     = Object.freeze({ end : true, int : true, mid : true, perp : true, axisint : true });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry on the Sheet
// -----------------------------------------------------------------------------

    // FUNCTION | The Distance Between Two Sheet Points
    // ------------------------------------------------------------
    function Na__PubMsMath__Distance(a, b) {
        return Math.hypot(b.X - a.X, b.Y - a.Y);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Polygon's Area (any winding; zero for fewer than three points)
    // ------------------------------------------------------------
    function Na__PubMsMath__PolygonArea(points) {
        if (!Array.isArray(points) || points.length < 3) return 0;
        let twice = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            twice += a.X * b.Y - b.X * a.Y;
        }
        return Math.abs(twice) / 2;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Run of Points' Length, Closed or Open
    // ------------------------------------------------------------
    function Na__PubMsMath__PathLength(points, closed) {
        if (!Array.isArray(points) || points.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < points.length; i++) total += Na__PubMsMath__Distance(points[i - 1], points[i]);
        if (closed && points.length > 2) total += Na__PubMsMath__Distance(points[points.length - 1], points[0]);
        return total;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Rectangle From Two Opposite Corners, Square to Its Drawing
    // ------------------------------------------------------------
    // Returns { Corners : [a, b's neighbour on a's row, b, a's neighbour on b's
    // row], Width, Height } in sheet millimetres: Width along the viewport's
    // own x, Height along its own y.
    // ------------------------------------------------------------
    function Na__PubMsMath__Rect(a, b, spinDeg) {
        const t = (Number(spinDeg) || 0) * Math.PI / 180;
        const ux = Math.cos(t), uy = Math.sin(t), vx = -uy, vy = ux;
        const dx = b.X - a.X, dy = b.Y - a.Y;
        const du = dx * ux + dy * uy, dv = dx * vx + dy * vy;
        return {
            Corners : [
                { X : a.X, Y : a.Y },
                { X : a.X + ux * du, Y : a.Y + uy * du },
                { X : b.X, Y : b.Y },
                { X : a.X + vx * dv, Y : a.Y + vy * dv }
            ],
            Width  : Math.abs(du),
            Height : Math.abs(dv)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Point Inside a Polygon to Hang Its Label On
    // ------------------------------------------------------------
    // The centroid of an L-shaped room can lie outside it. A horizontal line
    // through the centroid is cut by the polygon's edges; the widest stretch of
    // it that is inside the polygon gives the point - its middle. Falls back to
    // the average of the corners for a polygon with no area.
    // ------------------------------------------------------------
    function Na__PubMsMath__LabelPoint(points) {
        if (!Array.isArray(points) || points.length === 0) return null;
        const avg = { X : points.reduce((s, p) => s + p.X, 0) / points.length, Y : points.reduce((s, p) => s + p.Y, 0) / points.length };
        if (points.length < 3) return avg;
        let a2 = 0, cx = 0, cy = 0;
        for (let i = 0; i < points.length; i++) {
            const p = points[i], q = points[(i + 1) % points.length];
            const cross = p.X * q.Y - q.X * p.Y;
            a2 += cross; cx += (p.X + q.X) * cross; cy += (p.Y + q.Y) * cross;
        }
        if (Math.abs(a2) < 1e-12) return avg;
        const centroid = { X : cx / (3 * a2), Y : cy / (3 * a2) };
        const y = centroid.Y;
        const xs = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i], q = points[(i + 1) % points.length];
            if ((p.Y <= y && q.Y > y) || (q.Y <= y && p.Y > y)) xs.push(p.X + (y - p.Y) * (q.X - p.X) / (q.Y - p.Y));
        }
        xs.sort((m, n) => m - n);
        let best = null;
        for (let i = 0; i + 1 < xs.length; i += 2) {
            const width = xs[i + 1] - xs[i];
            if (!best || width > best.width) best = { width, x : (xs[i] + xs[i + 1]) / 2 };
        }
        return best ? { X : best.x, Y : y } : centroid;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Real Values
// -----------------------------------------------------------------------------

    // FUNCTION | Is Every Point of a Measurement a Point of the Drawing
    // ------------------------------------------------------------
    function Na__PubMsMath__IsExact(points) {
        return Array.isArray(points) && points.length > 0 && points.every((p) => Na__PubMsMath__EXACT_KINDS[p && p.Snap] === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Measurement's Real Values, in Millimetres and Square Millimetres
    // ------------------------------------------------------------
    // Returns { Exact, Scale, Length (linear), Width, Height, Corners (rect),
    // Area, Perimeter, Edges (each side's length, area and rect) }. Points may
    // be the measurement's own or a draft's, so a shape still being drawn
    // reads as it goes.
    // ------------------------------------------------------------
    function Na__PubMsMath__Values(measure) {
        const scale  = Number(measure && measure.Scale) || 1;
        const points = (measure && Array.isArray(measure.Points)) ? measure.Points : [];
        const out = { Exact : Na__PubMsMath__IsExact(points), Scale : scale };
        if (!measure) return out;
        if (measure.Tool === 'linear') {
            out.Length = points.length >= 2 ? Na__PubMsMath__Distance(points[0], points[1]) * scale : 0;
            return out;
        }
        if (measure.Tool === 'rect') {
            if (points.length < 2) return out;
            const rect = Na__PubMsMath__Rect(points[0], points[1], measure.SpinDeg);
            out.Corners = rect.Corners;
            out.Width   = rect.Width * scale;
            out.Height  = rect.Height * scale;
            out.Area    = out.Width * out.Height;
            out.Perimeter = 2 * (out.Width + out.Height);
            return out;
        }
        if (measure.Tool === 'area') {
            out.Area      = Na__PubMsMath__PolygonArea(points) * scale * scale;
            out.Perimeter = Na__PubMsMath__PathLength(points, true) * scale;
            out.Edges     = points.map((p, i) => (points.length > 1 ? Na__PubMsMath__Distance(p, points[(i + 1) % points.length]) * scale : 0));
            return out;
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saying a Value
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number With Thousands Separators and Fixed Decimals
    // ------------------------------------------------------------
    function Na__PubMsMath__Number(value, decimals) {
        const fixed = Number(value).toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Length as the Drawing Would Say It
    // ------------------------------------------------------------
    // realMm : millimetres on the ground; scale : the drawing's denominator;
    // exact  : false for an estimate ("≈", rounded).
    // ------------------------------------------------------------
    function Na__PubMsMath__FormatLength(realMm, scale, exact) {
        const n = Number(realMm);
        if (!Number.isFinite(n)) return '';
        if (Number(scale) >= Na__PubMsMath__SITE_SCALE) {
            const metres = n / 1000;
            return exact ? (Na__PubMsMath__Number(metres, 2) + ' m') : ('≈ ' + Na__PubMsMath__Number(Math.round(metres * 10) / 10, 1) + ' m');
        }
        if (exact) return Na__PubMsMath__Number(Math.round(n), 0) + ' mm';
        return '≈ ' + Na__PubMsMath__Number(Math.round(n / Na__PubMsMath__ROUND_MM) * Na__PubMsMath__ROUND_MM, 0) + ' mm';
    }
    // ------------------------------------------------------------


    // FUNCTION | An Area as the Drawing Would Say It
    // ------------------------------------------------------------
    function Na__PubMsMath__FormatArea(realMm2, exact) {
        const n = Number(realMm2);
        if (!Number.isFinite(n)) return '';
        const m2 = n / 1e6;
        const lead = exact ? '' : '≈ ';
        if (m2 >= Na__PubMsMath__HECTARE_FROM_M2) {
            const shown = exact ? Math.round(m2) : Math.round(m2 / 10) * 10;
            const ha = m2 / 10000;
            return lead + Na__PubMsMath__Number(shown, 0) + ' m² (' + Na__PubMsMath__Number(ha, ha >= 10 ? 1 : 2) + ' ha)';
        }
        return exact ? (Na__PubMsMath__Number(m2, 2) + ' m²') : (lead + Na__PubMsMath__Number(Math.round(m2 * 10) / 10, 1) + ' m²');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubMsMath__SITE_SCALE,
        Na__PubMsMath__Distance,
        Na__PubMsMath__PolygonArea,
        Na__PubMsMath__PathLength,
        Na__PubMsMath__Rect,
        Na__PubMsMath__LabelPoint,
        Na__PubMsMath__IsExact,
        Na__PubMsMath__Values,
        Na__PubMsMath__FormatLength,
        Na__PubMsMath__FormatArea
    };

// endregion -------------------------------------------------------------------
