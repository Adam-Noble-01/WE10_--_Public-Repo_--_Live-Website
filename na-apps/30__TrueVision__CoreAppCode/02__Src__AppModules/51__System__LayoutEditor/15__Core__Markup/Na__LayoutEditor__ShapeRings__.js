// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHAPE RINGS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ShapeRings__.js
// NAMESPACE  : Na__LeRings
// MODULE     : Layout Editor - Shape Rings
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A vector with holes in it (islands): which of its points make the outline and which make each hole, and the edges, the inside and the edits that follow from that
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - ONE RUN OF POINTS HOLDS EVERY RING. Shape__Points is the outline, then
//   each hole straight after it; Shape__Holes lists the index in
//   Shape__Points where each hole begins. [ 4 ] on eight points is a square
//   (points 0 to 3) with a square hole in it (4 to 7). A record without the
//   key - every record from before holes - is one ring, as it always was.
// - WHY ONE RUN AND NOT A SECOND LIST OF POINTS. Every move, nudge, drag,
//   Ctrl-drag copy, paste, snap move, group move, scrapbook drop and
//   parametric rebuild in the editor maps Shape__Points as a whole. With the
//   holes in the same run they all carry the holes with the outline, with
//   nothing to learn, and the grips, the vertex drag and the points box edit a
//   hole's corners exactly as they edit the outline's. What has to know about
//   rings is what walks EDGES - painting, hit testing, snapping, the marquee
//   and the vector tools - and the three edits that add or take away a point,
//   which must move the hole starts along with it. They all ask here.
// - A HOLE IS ONLY EVER ROUND A CLOSED OUTLINE, and every ring has three
//   points at least. Clean keeps the starts that leave every ring that big and
//   drops the rest, so a start a hand-edited file got wrong costs that one hole
//   its own ring rather than the shape its outline.
// - THE INSIDE IS EVEN-ODD. A point is inside when an odd number of the rings
//   go round it, which is what SVG's and PDF's even-odd fill paint, so the
//   hit test, the fill on the screen and the fill in the PDF all agree - and a
//   ring's direction, clockwise or not, never matters.
// - NOTHING HERE TOUCHES THE MODEL, THE DOM OR THE CONFIG: a leaf, so the
//   records, the shape geometry, the painters, the snaps and the vector tools
//   can all import it with no circle, and it runs under Node as it runs here.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetRecords__ (Clean, in the shape normaliser),
//   Na__LayoutEditor__ShapeGeometry__ (edges, inside, the primitive),
//   Na__LayoutEditor__SheetChrome__ (Spans, for the SVG and PDF paths),
//   Na__LayoutEditor__HatchPatterns__ and Na__LayoutEditor__GradientTool__ (the
//   PDF clip), the sheet tools (insert and delete a point), the Object Snap
//   sources, the selection box and the vector tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off. A reader
//                   that does not know Shape__Holes paints a holed vector as one
//                   run: the outline and its holes joined by a stray edge.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.1.0
// - FacesFromRings: the site plan store's rings ({ face, outer, points })
//   grouped into this module's shape - one run of points per face, the
//   outline then its holes, with the hole starts - for the PDF exporter and
//   the document publisher, which paint one polygon at a time and until now
//   painted each face's OUTER ring only. On RB05 the Grassland face has the
//   lake as a hole and the lake has its island as one: the published site
//   plan and the PDF drew grass tufts across the water and ripples across
//   the island, while the screen (one even-odd path per layer) did not.
//
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation, for the vector tools' Boolean section (Union,
//   Subtract, Trim, Intersect, Split, Outer Shell), whose results have holes.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Fewest Points a Ring Can Have
    // ------------------------------------------------------------
    const Na__LeRings__MIN_POINTS = 3;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where Each Ring Is
// -----------------------------------------------------------------------------

    // FUNCTION | The Hole Starts That Hold, for a Run of `count` Points
    // ------------------------------------------------------------
    // Ascending whole numbers, each leaving the ring before it and the ring it
    // starts at least three points. Anything else drops out. An open shape has
    // no holes at all.
    // ------------------------------------------------------------
    function Na__LeRings__Clean(count, holes, closed) {
        if (closed !== true || !Array.isArray(holes) || holes.length === 0) return [];
        const n   = Number.isInteger(count) ? count : 0;
        const out = [];
        let last = 0;
        holes.forEach((raw) => {
            const start = Number(raw);
            if (!Number.isInteger(start)) return;
            if (start - last < Na__LeRings__MIN_POINTS) return;                // <-- The ring before it would be too short (or it is out of order)
            if (n - start < Na__LeRings__MIN_POINTS) return;                   // <-- The ring it starts would be too short
            out.push(start);
            last = start;
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Clean Hole Starts of a Shape Record
    // ------------------------------------------------------------
    function Na__LeRings__Of(shape) {
        if (!shape || !Array.isArray(shape.Shape__Holes) || shape.Shape__Holes.length === 0) return [];
        const count = Array.isArray(shape.Shape__Points) ? shape.Shape__Points.length : 0;
        return Na__LeRings__Clean(count, shape.Shape__Holes, shape.Shape__Closed === true);
    }
    function Na__LeRings__Has(shape) { return Na__LeRings__Of(shape).length > 0; }
    // ------------------------------------------------------------


    // FUNCTION | Each Ring as [ start, end ) Indices Into the Run
    // ------------------------------------------------------------
    // holes must already be clean (Clean or Of). No holes is one span, the
    // whole run.
    // ------------------------------------------------------------
    function Na__LeRings__Spans(count, holes) {
        const starts = [ 0 ].concat(Array.isArray(holes) ? holes : []);
        return starts.map((start, k) => [ start, k + 1 < starts.length ? starts[k + 1] : count ]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Each Ring as Its Own Run of Points
    // ------------------------------------------------------------
    function Na__LeRings__Split(points, holes) {
        const pts = Array.isArray(points) ? points : [];
        return Na__LeRings__Spans(pts.length, holes).map((span) => pts.slice(span[0], span[1]));
    }
    // ------------------------------------------------------------


    // FUNCTION | Site Plan Rings as Faces: Each Outer Ring With Its Holes Behind It
    // ------------------------------------------------------------
    // The site plan store hands a layer's fill over as rings, each
    // { face, outer, points [x, y, x, y, ...] } - a SketchUp face's outer loop
    // and, sharing its face index, every inner loop it has. The screen paints
    // all of a layer's rings as one even-odd path, so a lake in a field is a
    // hole in the field; a consumer that paints one polygon at a time (the
    // PDF, the publisher) needs the same thing in THIS module's shape: one run
    // of points per face, the outline first and each hole after it, with the
    // index where every hole begins - what a holed vector carries, and what
    // the polyline primitive fills even-odd on screen and on paper alike.
    // toPoint maps one (x, y) pair into the consumer's space and returns
    // [x, y]. A ring with fewer than three corners is left out; a face with no
    // outer ring is left out whole; a ring with no face index, or a second
    // outer ring under one index, is a face of its own. Returns
    // [ { points : [[x, y], ...], holes : [index, ...] } ], holes empty on a
    // face without one, in the order the faces were first met.
    // ------------------------------------------------------------
    function Na__LeRings__FacesFromRings(rings, toPoint) {
        const map = (typeof toPoint === 'function') ? toPoint : ((x, y) => [ x, y ]);
        const faces = [];
        const byId  = new Map();
        (Array.isArray(rings) ? rings : []).forEach((ring) => {
            if (!ring || !ring.points || ring.points.length < Na__LeRings__MIN_POINTS * 2) return;
            const points = [];
            for (let i = 0; i + 1 < ring.points.length; i += 2) points.push(map(ring.points[i], ring.points[i + 1]));
            if (points.length < Na__LeRings__MIN_POINTS) return;
            const isOuter = ring.outer !== false;
            const id      = Number.isInteger(ring.face) ? ring.face : null;
            let face = id === null ? null : byId.get(id);
            if (!face || (isOuter && face.outer)) {                                // <-- A face of its own: no index, or a second outline under one
                face = { outer : null, inner : [] };
                faces.push(face);
                if (id !== null && !byId.has(id)) byId.set(id, face);
            }
            if (isOuter) face.outer = points; else face.inner.push(points);
        });
        return faces
            .filter((face) => face.outer)
            .map((face) => {
                const points = face.outer.slice();
                const holes  = [];
                face.inner.forEach((ring) => { holes.push(points.length); ring.forEach((p) => points.push(p)); });
                return { points : points, holes : holes };
            });
    }
    // ------------------------------------------------------------


    // FUNCTION | One Run and Its Hole Starts From a List of Rings (the outline first)
    // ------------------------------------------------------------
    // Rings of fewer than three points drop out, except the first, which is
    // the outline whatever it is.
    // ------------------------------------------------------------
    function Na__LeRings__Flatten(rings) {
        const list   = Array.isArray(rings) ? rings.filter((ring, k) => Array.isArray(ring) && (k === 0 || ring.length >= Na__LeRings__MIN_POINTS)) : [];
        const points = [];
        const holes  = [];
        list.forEach((ring, k) => {
            if (k > 0) holes.push(points.length);
            ring.forEach((p) => points.push([ p[0], p[1] ]));
        });
        return { points : points, holes : holes };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Ring a Point Belongs To: { ring, start, end }
    // ------------------------------------------------------------
    function Na__LeRings__RingAt(count, holes, index) {
        const spans = Na__LeRings__Spans(count, holes);
        for (let k = 0; k < spans.length; k++) {
            if (index >= spans[k][0] && index < spans[k][1]) return { ring : k, start : spans[k][0], end : spans[k][1] };
        }
        return { ring : 0, start : 0, end : count };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Edges
// -----------------------------------------------------------------------------

    // FUNCTION | The Point an Edge Starting at `index` Runs To (-1 at the end of an open run)
    // ------------------------------------------------------------
    // Inside a ring the next point along; the last point of a closed ring runs
    // back to that ring's FIRST point, never on to the next ring's.
    // ------------------------------------------------------------
    function Na__LeRings__Next(count, holes, index, closed) {
        const at = Na__LeRings__RingAt(count, holes, index);
        if (index + 1 < at.end) return index + 1;
        if (closed === true && (at.end - at.start) > 2) return at.start;
        return -1;
    }
    function Na__LeRings__Prev(count, holes, index, closed) {
        const at = Na__LeRings__RingAt(count, holes, index);
        if (index - 1 >= at.start) return index - 1;
        if (closed === true && (at.end - at.start) > 2) return at.end - 1;
        return -1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge as [ from, to ] Indices, the Closing Edge of Each Ring Included
    // ------------------------------------------------------------
    // An open run: n - 1 edges. A closed run without holes: n, the last from
    // the last point back to the first - exactly what every caller walked
    // before holes. With holes: each ring closes on itself.
    // ------------------------------------------------------------
    function Na__LeRings__Edges(count, holes, closed) {
        const out = [];
        if (!(count > 1)) return out;
        const shut = closed === true && count > 2;
        Na__LeRings__Spans(count, shut ? holes : []).forEach((span) => {
            const s = span[0], e = span[1];
            for (let i = s; i + 1 < e; i++) out.push([ i, i + 1 ]);
            if (shut && e - s > 2) out.push([ e - 1, s ]);
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Inside, Area and Direction
// -----------------------------------------------------------------------------

    // FUNCTION | Twice the Signed Area of One Ring (paper mm, y down: positive runs clockwise on the paper)
    // ------------------------------------------------------------
    function Na__LeRings__SignedArea2(ring) {
        let a = 0;
        const n = Array.isArray(ring) ? ring.length : 0;
        for (let i = 0, j = n - 1; i < n; j = i++) a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
        return a;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Area a Holed Shape Covers: the Outline's Less Every Hole's
    // ------------------------------------------------------------
    function Na__LeRings__Area(points, holes) {
        const rings = Na__LeRings__Split(points, holes);
        return rings.reduce((sum, ring, k) => sum + ((k === 0 ? 1 : -1) * Math.abs(Na__LeRings__SignedArea2(ring) / 2)), 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Paper Point Inside (an odd number of rings go round it)
    // ------------------------------------------------------------
    // Ray casting ring by ring, each ring treated as closed - the rule the
    // painters fill by, so a click in a hole goes through to what is under it.
    // ------------------------------------------------------------
    function Na__LeRings__Contains(points, holes, x, y) {
        let inside = false;
        Na__LeRings__Split(points, holes).forEach((ring) => {
            const n = ring.length;
            if (n < 3) return;
            for (let i = 0, j = n - 1; i < n; j = i++) {
                const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
                if (((yi > y) !== (yj > y)) && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12)) + xi)) inside = !inside;
            }
        });
        return inside;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Adding and Taking Away Points
// -----------------------------------------------------------------------------

    // FUNCTION | The Hole Starts After a Point Is Put In After `edgeIndex`
    // ------------------------------------------------------------
    // The point goes in at edgeIndex + 1, inside the ring that edge belongs to
    // - on a ring's closing edge, at the end of that ring - so every hole that
    // starts after edgeIndex moves up one.
    // ------------------------------------------------------------
    function Na__LeRings__AfterInsert(holes, edgeIndex) {
        return (Array.isArray(holes) ? holes : []).map((start) => (start > edgeIndex ? start + 1 : start));
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Picked Points Out: { points, holes }, or Null When the Outline Would Be Too Few
    // ------------------------------------------------------------
    // floor is the fewest points the OUTLINE may keep (two for a line, three
    // for a room). A hole left with fewer than three goes whole: taking out
    // most of a hole's corners takes the hole away.
    // ------------------------------------------------------------
    function Na__LeRings__Remove(points, holes, picked, floor) {
        const pts    = Array.isArray(points) ? points : [];
        const gone   = new Set(Array.isArray(picked) ? picked : []);
        const rings  = Na__LeRings__Spans(pts.length, holes).map((span) => {
            const kept = [];
            for (let i = span[0]; i < span[1]; i++) if (!gone.has(i)) kept.push([ pts[i][0], pts[i][1] ]);
            return kept;
        });
        if (rings[0].length < (Number.isFinite(floor) ? floor : 2)) return null;
        return Na__LeRings__Flatten(rings);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Shape Rings API
    // ------------------------------------------------------------
    export {
        Na__LeRings__MIN_POINTS,
        Na__LeRings__Clean,
        Na__LeRings__Of,
        Na__LeRings__Has,
        Na__LeRings__Spans,
        Na__LeRings__Split,
        Na__LeRings__FacesFromRings,
        Na__LeRings__Flatten,
        Na__LeRings__RingAt,
        Na__LeRings__Next,
        Na__LeRings__Prev,
        Na__LeRings__Edges,
        Na__LeRings__SignedArea2,
        Na__LeRings__Area,
        Na__LeRings__Contains,
        Na__LeRings__AfterInsert,
        Na__LeRings__Remove
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
