// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__Geometry__.js
// NAMESPACE  : Na__LeAreaGeo
// MODULE     : Layout Editor - Floor Areas - Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The arithmetic of a measured room - how much floor it encloses, how far round it is, where its name belongs, and how those numbers are written
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - PURE. It imports nothing, knows nothing of sheets, records or the DOM, and
//   takes paper millimetre points and a drawing scale. That is what lets the
//   measurement be proved in Node against hand-worked figures rather than read
//   off the screen and believed.
// - THE AREA is the shoelace of the run, taken as closed, times the square of
//   the scale: a square metre of floor at 1:50 is 400 square millimetres of
//   paper, and the square is the whole reason a scale set wrongly is not a
//   small error but a factor of four.
// - THE LABEL SITS IN THE MIDDLE OF THE ROOM'S BOX (LabelHome), the standard
//   Adam asked for - unless that point is not inside the room, as with an L
//   or a U, when it takes the VISUAL CENTRE instead. The visual centre is the
//   middle of the largest circle that fits inside the room (the pole of
//   inaccessibility), never the centroid: an L-shaped room's centroid can
//   fall in the garden. A convex outline - every rectangle, which is most
//   rooms - is answered by its centroid directly, because for a convex shape
//   the two agree and the centroid is exact and costs nothing. The visual
//   centre also decides which drawing a room is measured against and how
//   large its label may be set, wherever the label itself sits.
// - A SELF-CROSSING OUTLINE IS REPORTED, NOT SILENTLY MEASURED. A figure of
//   eight has two lobes of opposite winding and the shoelace subtracts one
//   from the other, so it would answer a number that looks plausible and is
//   nonsense. The panel and the label say so instead.
//
// INTEGRATION:
// - Na__LayoutEditor__FloorAreas__ reads every measurement through here, and
//   the label painter and the schedule table read it through that.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - the whole Floor Areas system goes across
//                   together, once Adam has signed this off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - LabelHome: where a label sits before it is dragged - the middle of the
//   room's bounding box ('box', the standard), or the visual centre when that
//   middle falls outside the room, or for every room under 'visual'. Adam
//   asked for the box: a room with a bay or a recess had its label pulled
//   towards its fattest part rather than sitting in the middle.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the shoelace, the perimeter, the crossing test,
//   the visual centre and the two formatters.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Units and the Search for the Visual Centre
    // ------------------------------------------------------------
    const Na__LeAreaGeo__SQ_FT_PER_SQ_M = 10.763910416709722;   // <-- Exactly 1 / 0.3048^2
    const Na__LeAreaGeo__FT_PER_M       = 3.280839895013123;
    const Na__LeAreaGeo__UNIT_M2        = 'm2';
    const Na__LeAreaGeo__UNIT_FT2       = 'ft2';
    const Na__LeAreaGeo__UNIT_BOTH      = 'both';
    const Na__LeAreaGeo__PLACE_BOX      = 'box';                // <-- A label's home: the middle of the room's bounding box (the standard)
    const Na__LeAreaGeo__PLACE_VISUAL   = 'visual';             // <-- ...or the middle of the largest circle that fits inside it
    const Na__LeAreaGeo__CENTRE_STEP_MM = 0.5;                 // <-- The finest the visual centre is ever searched, on the paper: half a millimetre is finer than any label needs
    const Na__LeAreaGeo__CENTRE_RATIO   = 60;                   // <-- ...and on a large room it is coarsened to a sixtieth of its short side, which no eye can see and the search feels
    const Na__LeAreaGeo__CENTRE_CELLS   = 1400;                 // <-- A ceiling on the search, so a pathological outline cannot hang a repaint
    const Na__LeAreaGeo__CACHE_MAX      = 240;                  // <-- Visual centres remembered between repaints; a drag only ever invalidates its own
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Remembered Visual Centres
    // ------------------------------------------------------------
    // The label is worked out on every repaint, and a repaint happens on every
    // step of a vertex drag. The points ARE the key, so the one area being
    // dragged is the only one that ever recomputes.
    // ------------------------------------------------------------
    const Na__LeAreaGeo__CentreCache = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Points
// -----------------------------------------------------------------------------

    // FUNCTION | The Well-Formed Points of a Run, as [x, y] Pairs
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Points(points) {
        return (Array.isArray(points) ? points : [])
            .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
            .map((p) => [ p[0], p[1] ]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Run Enclose Anything at All
    // ------------------------------------------------------------
    // Three points are the fewest that can. Two are a line, and a line has no
    // area however it is drawn.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Encloses(points) {
        return Na__LeAreaGeo__Points(points).length >= 3;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box the Run Occupies
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Bounds(points) {
        const pts = Na__LeAreaGeo__Points(points);
        if (!pts.length) return { X : 0, Y : 0, WidthMm : 0, HeightMm : 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Measurement
// -----------------------------------------------------------------------------

    // FUNCTION | The Signed Shoelace of the Run, in Square Paper Millimetres
    // ------------------------------------------------------------
    // Signed, because the sign is the winding: the callers that want a size
    // take the modulus, and the crossing test wants to know that two lobes
    // wound opposite ways have cancelled.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__SignedPaperMm2(points) {
        const pts = Na__LeAreaGeo__Points(points);
        if (pts.length < 3) return 0;
        let sum = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            sum += (pts[j][0] * pts[i][1]) - (pts[i][0] * pts[j][1]);
        }
        return sum / 2;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Much Paper the Run Encloses, in Square Millimetres
    // ------------------------------------------------------------
    function Na__LeAreaGeo__PaperMm2(points) {
        return Math.abs(Na__LeAreaGeo__SignedPaperMm2(points));
    }
    // ------------------------------------------------------------


    // FUNCTION | How Much Floor the Run Encloses, in Square Metres
    // ------------------------------------------------------------
    // denominator is the drawing's scale: 50 for 1:50. The scale is SQUARED,
    // which is worth saying out loud - a plan read at 1:100 when it was drawn
    // at 1:50 does not report double, it reports four times.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__RealM2(points, denominator) {
        const d = (typeof denominator === 'number' && Number.isFinite(denominator) && denominator > 0) ? denominator : 1;
        return (Na__LeAreaGeo__PaperMm2(points) * d * d) / 1000000;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far It Is Round the Run, in Paper Millimetres and in Metres
    // ------------------------------------------------------------
    // Always round the CLOSED run - an area is a room, and the wall between
    // the last corner and the first is a wall like the others.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__PerimeterPaperMm(points) {
        const pts = Na__LeAreaGeo__Points(points);
        if (pts.length < 2) return 0;
        let run = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) run += Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        return run;
    }
    function Na__LeAreaGeo__PerimeterM(points, denominator) {
        const d = (typeof denominator === 'number' && Number.isFinite(denominator) && denominator > 0) ? denominator : 1;
        return (Na__LeAreaGeo__PerimeterPaperMm(points) * d) / 1000;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Do Two Segments Cross Anywhere but at a Shared End
    // ------------------------------------------------------------
    function Na__LeAreaGeo__SegmentsCross(a1, a2, b1, b2) {
        const side = (p, q, r) => ((q[0] - p[0]) * (r[1] - p[1])) - ((q[1] - p[1]) * (r[0] - p[0]));
        const on   = (p, q, r) => Math.abs(side(p, q, r)) < 1e-9
            && Math.min(p[0], q[0]) - 1e-9 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-9
            && Math.min(p[1], q[1]) - 1e-9 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-9;
        const d1 = side(a1, a2, b1), d2 = side(a1, a2, b2), d3 = side(b1, b2, a1), d4 = side(b1, b2, a2);
        if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
            ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true;
        return on(a1, a2, b1) || on(a1, a2, b2) || on(b1, b2, a1) || on(b1, b2, a2);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Outline Cross Itself
    // ------------------------------------------------------------
    // A crossed outline has no honest area - the shoelace subtracts the lobe
    // wound the other way - so this is asked before a figure is shown, and the
    // answer is said in words rather than quietly absorbed.
    //
    // Neighbouring edges share a corner and are skipped; so are the first and
    // the last, which share the closing corner.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__SelfCrossing(points) {
        const pts = Na__LeAreaGeo__Points(points);
        const n   = pts.length;
        if (n < 4) return false;
        for (let i = 0; i < n; i++) {
            const a1 = pts[i], a2 = pts[(i + 1) % n];
            for (let j = i + 1; j < n; j++) {
                if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;   // <-- Shares a corner with this edge
                if (Na__LeAreaGeo__SegmentsCross(a1, a2, pts[j], pts[(j + 1) % n])) return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where the Name Belongs
// -----------------------------------------------------------------------------

    // FUNCTION | Is a Point Inside the Run (ray casting, the run taken as closed)
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Contains(points, x, y) {
        const pts = Na__LeAreaGeo__Points(points);
        if (pts.length < 3) return false;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
            if (((yi > y) !== (yj > y)) && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12)) + xi)) inside = !inside;
        }
        return inside;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Centroid of the Run
    // ------------------------------------------------------------
    // The area-weighted centroid, not the average of the corners: the average
    // is pulled about by how finely one wall happens to be divided.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Centroid(points) {
        const pts = Na__LeAreaGeo__Points(points);
        if (!pts.length) return { x : 0, y : 0 };
        if (pts.length < 3) return { x : (pts[0][0] + pts[pts.length - 1][0]) / 2, y : (pts[0][1] + pts[pts.length - 1][1]) / 2 };
        let twiceArea = 0, x = 0, y = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const cross = (pts[j][0] * pts[i][1]) - (pts[i][0] * pts[j][1]);
            twiceArea += cross;
            x += (pts[j][0] + pts[i][0]) * cross;
            y += (pts[j][1] + pts[i][1]) * cross;
        }
        if (Math.abs(twiceArea) < 1e-12) {                                       // <-- A run with no area: the middle of its box is the only sensible answer
            const box = Na__LeAreaGeo__Bounds(pts);
            return { x : box.X + (box.WidthMm / 2), y : box.Y + (box.HeightMm / 2) };
        }
        return { x : x / (3 * twiceArea), y : y / (3 * twiceArea) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Outline Convex
    // ------------------------------------------------------------
    // Every turn the same way. A convex room's centroid is inside it and is
    // the middle of it, so the search below is not needed at all - which is
    // the ordinary case, because most rooms are rectangles.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__IsConvex(pts) {
        const n = pts.length;
        if (n < 4) return true;
        let sign = 0;
        for (let i = 0; i < n; i++) {
            const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
            const cross = ((b[0] - a[0]) * (c[1] - b[1])) - ((b[1] - a[1]) * (c[0] - b[0]));
            if (Math.abs(cross) < 1e-9) continue;                                // <-- Three points in a line turn no way at all
            const way = cross > 0 ? 1 : -1;
            if (sign === 0) sign = way;
            else if (way !== sign) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Heap of Cells, Largest Possible First
    // ------------------------------------------------------------
    // The search takes the most promising quarter next, thousands of times.
    // Scanning the open list for it each time is what made a 48 corner outline
    // cost 17 milliseconds a repaint - and a repaint happens on every step of
    // a vertex drag. A binary heap answers the same question in a few
    // comparisons, and the whole search then costs about a millisecond.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Heap() {
        const items = [];
        const up = (at) => {
            while (at > 0) {
                const parent = (at - 1) >> 1;
                if (items[parent].max >= items[at].max) break;
                const swap = items[parent]; items[parent] = items[at]; items[at] = swap;
                at = parent;
            }
        };
        const down = (at) => {
            for (;;) {
                const left = (at * 2) + 1, right = left + 1;
                let best = at;
                if (left  < items.length && items[left].max  > items[best].max) best = left;
                if (right < items.length && items[right].max > items[best].max) best = right;
                if (best === at) break;
                const swap = items[best]; items[best] = items[at]; items[at] = swap;
                at = best;
            }
        };
        return {
            size : () => items.length,
            push : (cell) => { items.push(cell); up(items.length - 1); },
            pop  : () => {
                const top  = items[0];
                const last = items.pop();
                if (items.length) { items[0] = last; down(0); }
                return top;
            }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Point Is Inside the Outline (negative outside)
    // ------------------------------------------------------------
    function Na__LeAreaGeo__SignedDistance(pts, x, y) {
        let best = Infinity;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[j], b = pts[i];
            const abx = b[0] - a[0], aby = b[1] - a[1];
            const len2 = (abx * abx) + (aby * aby);
            let t = len2 > 0 ? (((x - a[0]) * abx) + ((y - a[1]) * aby)) / len2 : 0;
            t = t < 0 ? 0 : (t > 1 ? 1 : t);
            best = Math.min(best, Math.hypot(x - (a[0] + (abx * t)), y - (a[1] + (aby * t))));
        }
        return Na__LeAreaGeo__Contains(pts, x, y) ? best : -best;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Visual Centre: the Middle of the Largest Circle That Fits
    // ------------------------------------------------------------
    // Answers { x, y, clearMm } - the fattest point of the room, and the
    // radius of the circle that fits there, which is how the label knows
    // whether the words will fit inside the room or have to be set smaller.
    // ------------------------------------------------------------
    // The pole of inaccessibility, searched by quartering the box and keeping
    // the quarters that could still hold something better than the best found
    // so far (a cell's best possible is its own distance plus its half
    // diagonal). It is where a person writing the room's name by hand would
    // put it: well inside the room, clear of every wall, and in the fat part
    // of an L rather than across its corner.
    //
    // Remembered against the points themselves, because this is asked on every
    // repaint and a repaint happens on every step of a vertex drag - so only
    // the room actually being dragged is ever worked out again.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__VisualCentre(points) {
        const pts = Na__LeAreaGeo__Points(points);
        if (pts.length < 3) { const at = Na__LeAreaGeo__Centroid(pts); return { x : at.x, y : at.y, clearMm : 0 }; }
        if (Na__LeAreaGeo__IsConvex(pts)) {                                      // <-- A rectangle, and most rooms: exact, and nothing to search
            const at = Na__LeAreaGeo__Centroid(pts);
            return { x : at.x, y : at.y, clearMm : Math.max(0, Na__LeAreaGeo__SignedDistance(pts, at.x, at.y)) };
        }

        const key    = JSON.stringify(pts);
        const cached = Na__LeAreaGeo__CentreCache.get(key);
        if (cached) return { x : cached.x, y : cached.y, clearMm : cached.clearMm };

        const box  = Na__LeAreaGeo__Bounds(pts);
        const size = Math.min(box.WidthMm, box.HeightMm);
        if (!(size > 0)) { const at = Na__LeAreaGeo__Centroid(pts); return { x : at.x, y : at.y, clearMm : 0 }; }
        const fine = Math.max(Na__LeAreaGeo__CENTRE_STEP_MM, size / Na__LeAreaGeo__CENTRE_RATIO);   // <-- Close enough for a label, whatever the room's size

        const cell = (x, y, h) => { const d = Na__LeAreaGeo__SignedDistance(pts, x, y); return { x : x, y : y, h : h, d : d, max : d + (h * Math.SQRT2) }; };
        const open = Na__LeAreaGeo__Heap();
        const step = size;
        for (let x = box.X; x < box.X + box.WidthMm; x += step) {
            for (let y = box.Y; y < box.Y + box.HeightMm; y += step) open.push(cell(x + (step / 2), y + (step / 2), step / 2));
        }
        let best = cell(box.X + (box.WidthMm / 2), box.Y + (box.HeightMm / 2), 0);
        const middle = Na__LeAreaGeo__Centroid(pts);
        const fromCentroid = cell(middle.x, middle.y, 0);
        if (fromCentroid.d > best.d) best = fromCentroid;

        let guard = 0;
        while (open.size() && guard++ < Na__LeAreaGeo__CENTRE_CELLS) {
            const taken = open.pop();                                            // <-- The most promising quarter still open
            if (taken.d > best.d) best = taken;
            if (taken.max - best.d <= fine) continue;                             // <-- Nothing better than that can be hiding in it
            const h = taken.h / 2;
            open.push(cell(taken.x - h, taken.y - h, h));
            open.push(cell(taken.x + h, taken.y - h, h));
            open.push(cell(taken.x - h, taken.y + h, h));
            open.push(cell(taken.x + h, taken.y + h, h));
        }

        const answer = { x : best.x, y : best.y, clearMm : Math.max(0, best.d) };
        if (Na__LeAreaGeo__CentreCache.size >= Na__LeAreaGeo__CACHE_MAX) Na__LeAreaGeo__CentreCache.clear();
        Na__LeAreaGeo__CentreCache.set(key, answer);
        return { x : answer.x, y : answer.y, clearMm : answer.clearMm };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Room's Label Sits Before Anyone Moves It
    // ------------------------------------------------------------
    // Answers { x, y, placement : 'box' | 'visual' }. The label is dragged
    // from here and snaps back to here, and a dragged label's stored offset
    // is measured from here.
    //
    // THE MIDDLE OF THE ROOM'S BOX IS THE STANDARD (Adam, 21-Sep-2026: "by
    // default, centering it on the centre of the bounding box, which should
    // be the standard behaviour"). On a room with a bay, a chimney breast or
    // a door recess it reads as the middle of the room, where the visual
    // centre is pulled towards whichever part of the room happens to be
    // fattest - RB05's Area 2 had its label sitting well above the middle.
    //
    // UNLESS THE MIDDLE OF THE BOX IS NOT IN THE ROOM. An L or a U has the
    // middle of its box in the bite out of it, so a label put there would be
    // written in the garden or across the room next door. Such a room takes
    // its visual centre instead, which is always inside it. 'visual' uses the
    // visual centre for every room.
    //
    // visual, when given, is the visual centre already worked out, so a
    // caller that has one does not pay for it twice.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__LabelHome(points, placement, visual) {
        const pts = Na__LeAreaGeo__Points(points);
        if (placement !== Na__LeAreaGeo__PLACE_VISUAL && pts.length >= 3) {
            const box = Na__LeAreaGeo__Bounds(pts);
            const x   = box.X + (box.WidthMm / 2);
            const y   = box.Y + (box.HeightMm / 2);
            if (Na__LeAreaGeo__Contains(pts, x, y)) return { x : x, y : y, placement : Na__LeAreaGeo__PLACE_BOX };
        }
        const centre = (visual && Number.isFinite(visual.x) && Number.isFinite(visual.y)) ? visual : Na__LeAreaGeo__VisualCentre(pts);
        return { x : centre.x, y : centre.y, placement : Na__LeAreaGeo__PLACE_VISUAL };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing the Numbers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number With Its Decimals and Its Thousands Separator
    // ------------------------------------------------------------
    // ROUNDED HALF AWAY FROM ZERO, WHICH toFixed IS NOT. 18.45 is held in
    // binary as 18.44999999999999928..., so `(18.45).toFixed(1)` is "18.4" -
    // and a schedule that reports a room as 18.45 m² in one column and 18.4 m²
    // in another reads as an arithmetic fault, whatever the IEEE standard says.
    // The value is lifted, nudged past the boundary it is sitting a hair below,
    // and rounded away from zero, so a schedule rounds the way a person does.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__Figure(value, decimals, separator) {
        const places = Math.max(0, Math.min(4, Math.round(Number(decimals) || 0)));
        const factor = Math.pow(10, places);
        const lifted = (Number.isFinite(value) ? value : 0) * factor;
        const eased  = lifted >= 0 ? lifted + 1e-9 : lifted - 1e-9;
        const whole  = (eased >= 0 ? 1 : -1) * Math.round(Math.abs(eased));
        const fixed  = (whole / factor).toFixed(places);
        const parts  = fixed.split('.');
        if (separator) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
        return parts.join('.');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Measured Area as It Is Written on a Drawing
    // ------------------------------------------------------------
    // options: { units : 'm2' | 'ft2' | 'both', decimals, feetDecimals,
    //            separator, suffixM2, suffixFt2 }. The square metre figure
    //            leads in every form: this is a British planning drawing, and
    //            the feet are for the people reading it, not for the council.
    // ------------------------------------------------------------
    function Na__LeAreaGeo__FormatArea(valueM2, options) {
        const setup     = options || {};
        const separator = (typeof setup.separator === 'string') ? setup.separator : '';
        const metres    = Na__LeAreaGeo__Figure(valueM2, setup.decimals === undefined ? 2 : setup.decimals, separator) + (setup.suffixM2 || ' m²');
        if (setup.units === Na__LeAreaGeo__UNIT_FT2 || setup.units === Na__LeAreaGeo__UNIT_BOTH) {
            const feet = Na__LeAreaGeo__Figure(valueM2 * Na__LeAreaGeo__SQ_FT_PER_SQ_M, setup.feetDecimals === undefined ? 0 : setup.feetDecimals, separator) + (setup.suffixFt2 || ' ft²');
            if (setup.units === Na__LeAreaGeo__UNIT_FT2) return feet;
            return metres + ' (' + feet + ')';
        }
        return metres;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Measured Length as It Is Written on a Drawing
    // ------------------------------------------------------------
    function Na__LeAreaGeo__FormatLength(valueM, options) {
        const setup     = options || {};
        const separator = (typeof setup.separator === 'string') ? setup.separator : '';
        const metres    = Na__LeAreaGeo__Figure(valueM, setup.decimals === undefined ? 2 : setup.decimals, separator) + (setup.suffixM || ' m');
        if (setup.units === Na__LeAreaGeo__UNIT_FT2 || setup.units === Na__LeAreaGeo__UNIT_BOTH) {
            const feet = Na__LeAreaGeo__Figure(valueM * Na__LeAreaGeo__FT_PER_M, setup.feetDecimals === undefined ? 1 : setup.feetDecimals, separator) + (setup.suffixFt || ' ft');
            if (setup.units === Na__LeAreaGeo__UNIT_FT2) return feet;
            return metres + ' (' + feet + ')';
        }
        return metres;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeAreaGeo__SQ_FT_PER_SQ_M,
        Na__LeAreaGeo__FT_PER_M,
        Na__LeAreaGeo__UNIT_M2,
        Na__LeAreaGeo__UNIT_FT2,
        Na__LeAreaGeo__UNIT_BOTH,
        Na__LeAreaGeo__PLACE_BOX,
        Na__LeAreaGeo__PLACE_VISUAL,
        Na__LeAreaGeo__Points,
        Na__LeAreaGeo__Encloses,
        Na__LeAreaGeo__Bounds,
        Na__LeAreaGeo__SignedPaperMm2,
        Na__LeAreaGeo__PaperMm2,
        Na__LeAreaGeo__RealM2,
        Na__LeAreaGeo__PerimeterPaperMm,
        Na__LeAreaGeo__PerimeterM,
        Na__LeAreaGeo__SelfCrossing,
        Na__LeAreaGeo__Contains,
        Na__LeAreaGeo__Centroid,
        Na__LeAreaGeo__VisualCentre,
        Na__LeAreaGeo__LabelHome,
        Na__LeAreaGeo__FormatArea,
        Na__LeAreaGeo__FormatLength
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
