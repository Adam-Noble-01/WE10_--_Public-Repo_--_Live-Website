// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - BOOLEAN GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Boolean__.js
// NAMESPACE  : Na__LeVecBool
// MODULE     : Layout Editor - Vector Tools - Boolean Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths of combining closed shapes as areas - Union, Subtract, Intersect, Outer Shell and the pieces two overlapping shapes split into - with holes (islands) wherever they fall
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - A SHAPE here is an AREA, not a line: { rings, evenOdd } in paper
//   millimetres, y down. rings is the outline and then any holes (a vector's
//   own Na__LeShapeGeo__Rings); evenOdd says how they are read - true for a
//   holed vector, whose rings the painters fill even-odd, false for a plain
//   one, which they fill non-zero (the SVG and PDF default). So what is
//   combined is exactly what is drawn.
// - A PIECE is what one vector holds: { outline, holes }, each a ring. A
//   result is a list of pieces, the biggest first, because the shapes that
//   come apart are separate vectors - a subtract that cuts a wall in two
//   leaves two walls. An island (a piece standing inside another's hole) is a
//   piece of its own.
// - CLIPPER2 DOES THE CUTTING (04__Lib__ThirdParty__VersionLocked, vendor 03,
//   the copy three-edge-projection already loads). Only its flat Clipper64
//   execute is used, never its PolyTree or its offsetting: in this port
//   (clipper2-js 0.9.0) OutRec never sets `bounds` or `path`, so every PolyTree
//   build throws, InflatePaths goes through that same build, and
//   Clipper.InvalidRect64 hands out one shared rectangle that the bounds
//   helpers then write into. Its flat output was checked on 12,000 random
//   unions, intersections, differences and exclusions of grid-snapped
//   rectangles, stars and circles, 3.6 million points sampled against the
//   answer: not one wrong (22-Sep-2026). What the flat output lacks, this
//   module adds: its runs repeat points and keep straight-through corners
//   (the port's collinear clean-up does not take them out), so every ring is
//   cleaned here; and it does not say which hole belongs to which outline, so
//   each hole is put in the smallest outline that goes round it.
// - INTEGERS. Clipper works in whole numbers, so paper millimetres are
//   multiplied by SCALE (10,000: a tenth of a micron) on the way in. That is
//   the finest step a result can hold - a thousandth of a millimetre at 1:100
//   - and it keeps every product inside JavaScript's exact integers. A corner
//   that went in comes back as the very number that went in (Exact), so a
//   shape's untouched corners still meet whatever they were snapped to.
// - SLIVERS GO. Two edges that ALMOST meet leave a hairline between them - a
//   piece or a hole thinner than SliverMm (a micron) - which nobody drew and
//   nobody could see or pick. Such rings are dropped, so a union of two walls
//   placed by eye is one wall rather than one with a hairline hole in it.
// - NOTHING HERE TOUCHES THE MODEL, THE DOM OR THE CONFIG, and Clipper is
//   imported by its own path, not the import map's name, so the module runs
//   under Node (Na__Test__VectorBooleans__.test.mjs) exactly as it does here -
//   in the app the path is the same file the import map names, so it is the
//   same module, loaded once.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__BooleanTool__ calls every operation and
//   writes the pieces back through Na__LayoutEditor__VectorTools__Targets__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation: Union, Intersect, Subtract, Outer Shell, Divide
//   (every piece of an overlay and the shapes that cover it), Overlaps, the
//   area of a piece and the record form of one.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Clipper2, by Its Own Path (the file the import map names)
    // ------------------------------------------------------------
    import { Clipper, Clipper64, ClipType, FillRule, Path64, Paths64, Point64 } from '../../../04__Lib__ThirdParty__VersionLocked/03__Vendor__Clipper2Js__v0.9.0/fesm2020/clipper2-js.mjs';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Paper Millimetres to Clipper's Whole Numbers, and What Is Too Thin to Keep
    // ------------------------------------------------------------
    const Na__LeVecBool__SCALE     = 10000;    // <-- A tenth of a micron: the finest step a result holds, and every product stays an exact integer
    const Na__LeVecBool__SLIVER_MM = 0.001;    // <-- A ring whose area over half its perimeter is thinner than a micron is a hairline nobody drew
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Into Clipper's Numbers and Back
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Key a Point Is Known by in Whole Numbers
    // ------------------------------------------------------------
    function Na__LeVecBool__Key(x, y) { return x + ',' + y; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Ring as a Clipper Path, Remembering Every Corner's Exact Value
    // ------------------------------------------------------------
    // exact maps a corner's whole-number key back to the paper point that
    // went in, so an untouched corner comes out bit for bit as it went in.
    // ------------------------------------------------------------
    function Na__LeVecBool__ToPath(ring, exact) {
        const path = new Path64();
        (Array.isArray(ring) ? ring : []).forEach((p) => {
            if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
            const x = Math.round(p[0] * Na__LeVecBool__SCALE), y = Math.round(p[1] * Na__LeVecBool__SCALE);
            const last = path[path.length - 1];
            if (last && last.x === x && last.y === y) return;
            path.push(new Point64(x, y));
            if (exact && !exact.has(Na__LeVecBool__Key(x, y))) exact.set(Na__LeVecBool__Key(x, y), [ p[0], p[1] ]);
        });
        return path;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Clipper Run: a Boolean of Subject and Clip, Non-Zero, Flat, Tidied
    // ------------------------------------------------------------
    // Every region handed in is already clean (Region), outlines one way round
    // and holes the other, so non-zero is right for every operation. Returns
    // Paths64; a run the port throws on returns none, and the caller refuses.
    //
    // WHAT COMES OUT IS TIDIED BEFORE ANYTHING ELSE SEES IT. The port's runs
    // repeat points (10,0 10,0 50,0 ...), and a run fed back in with its
    // repeats no longer MERGES shapes that only share an edge: two walls
    // snapped side by side came out as two pieces and three empty rings
    // (found 22-Sep-2026; the same squares fed in clean merge into one). So
    // every ring leaves here with no repeat, no straight-through corner and no
    // spike (CleanRing), and a ring of nothing is dropped.
    // ------------------------------------------------------------
    function Na__LeVecBool__Run(type, subject, clip, rule) {
        const out = new Paths64();
        if (!subject || subject.length === 0) return out;
        const c = new Clipper64();
        c.addSubjectPaths(subject);
        if (clip && clip.length) c.addClipPaths(clip);
        let ok = false;
        try { ok = c.execute(type, rule === undefined ? FillRule.NonZero : rule, out); } catch (error) { ok = false; }
        const tidy = new Paths64();
        if (!ok) return tidy;
        out.forEach((path) => {
            const ring = Na__LeVecBool__CleanRing(path);
            if (ring.length < 3 || Na__LeVecBool__Area2(ring) === 0) return;
            const clean = new Path64();
            ring.forEach((p) => clean.push(new Point64(p[0], p[1])));
            tidy.push(clean);
        });
        return tidy;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Shape as One Clean Region (outlines round one way, holes the other)
    // ------------------------------------------------------------
    // Its rings unioned under the rule the painters fill it by - even-odd for
    // a holed vector, non-zero for any other - so a ring drawn either way
    // round, a hole, a loop over itself: all come out as the area on screen.
    // ------------------------------------------------------------
    function Na__LeVecBool__Region(shape, exact) {
        const paths = new Paths64();
        (shape && Array.isArray(shape.rings) ? shape.rings : []).forEach((ring) => {
            const path = Na__LeVecBool__ToPath(ring, exact);
            if (path.length >= 3) paths.push(path);
        });
        if (!paths.length) return new Paths64();
        return Na__LeVecBool__Run(ClipType.Union, paths, null, shape.evenOdd === true ? FillRule.EvenOdd : FillRule.NonZero);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Several Regions Laid Together (one list of paths)
    // ------------------------------------------------------------
    function Na__LeVecBool__Together(regions) {
        const all = new Paths64();
        regions.forEach((paths) => paths.forEach((path) => all.push(path)));
        return all;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cleaning What Clipper Hands Back
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Twice a Ring's Signed Area, in Clipper's Sense (outlines positive)
    // ------------------------------------------------------------
    function Na__LeVecBool__Area2(ring) {
        let a = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][1] + ring[i][1]) * (ring[j][0] - ring[i][0]);
        return a;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Ring With No Repeated Point, No Straight-Through Corner and No Spike
    // ------------------------------------------------------------
    // In whole numbers, so "straight" is exact: a corner whose two edges are
    // collinear goes, whichever way the second runs - on through (a corner
    // that is no corner) or straight back (a spike). Repeated until nothing
    // more goes, because taking one out can straighten its neighbour.
    // ------------------------------------------------------------
    function Na__LeVecBool__CleanRing(path) {
        let ring = [];
        path.forEach((p) => {
            const last = ring[ring.length - 1];
            if (!last || last[0] !== p.x || last[1] !== p.y) ring.push([ p.x, p.y ]);
        });
        while (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
        let changed = true;
        while (changed && ring.length >= 3) {
            changed = false;
            for (let i = 0; i < ring.length && ring.length >= 3; i++) {
                const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
                const cross = ((b[0] - a[0]) * (c[1] - b[1])) - ((b[1] - a[1]) * (c[0] - b[0]));
                const same  = (a[0] === b[0] && a[1] === b[1]) || (b[0] === c[0] && b[1] === c[1]);
                if (cross === 0 || same) { ring.splice(i, 1); changed = true; i--; }
            }
        }
        return ring.length >= 3 ? ring : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Ring a Hairline: Thinner Than a Micron Everywhere
    // ------------------------------------------------------------
    // Area over half the perimeter is the ring's mean thickness - a square's
    // is half its side, a hairline's is its width.
    // ------------------------------------------------------------
    function Na__LeVecBool__IsSliver(ring) {
        let perimeter = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) perimeter += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
        if (!(perimeter > 0)) return true;
        const thickness = Math.abs(Na__LeVecBool__Area2(ring) / 2) / (perimeter / 2);
        return thickness < Na__LeVecBool__SLIVER_MM * Na__LeVecBool__SCALE;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Whole-Number Point Stands to a Ring: 1 Inside, 0 On an Edge, -1 Outside
    // ------------------------------------------------------------
    function Na__LeVecBool__Where(pt, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const a = ring[j], b = ring[i];
            const cross = ((b[0] - a[0]) * (pt[1] - a[1])) - ((b[1] - a[1]) * (pt[0] - a[0]));
            if (cross === 0 && pt[0] >= Math.min(a[0], b[0]) && pt[0] <= Math.max(a[0], b[0]) && pt[1] >= Math.min(a[1], b[1]) && pt[1] <= Math.max(a[1], b[1])) return 0;
            if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < a[0] + (((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1])))) inside = !inside;
        }
        return inside ? 1 : -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is One Ring Inside Another (judged by its first corner that is not on the other's edge)
    // ------------------------------------------------------------
    // Clipper's rings never cross, so one corner clear of the other's edges
    // settles it. A ring every corner of which is ON the other is taken as
    // inside when the midpoint of its first edge is.
    // ------------------------------------------------------------
    function Na__LeVecBool__InsideRing(inner, outer) {
        for (let i = 0; i < inner.length; i++) {
            const where = Na__LeVecBool__Where(inner[i], outer);
            if (where !== 0) return where === 1;
        }
        const mid = [ (inner[0][0] + inner[1][0]) / 2, (inner[0][1] + inner[1][1]) / 2 ];
        return Na__LeVecBool__Where(mid, outer) === 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A New Corner Worked Out Exactly From the Edges It Was Cut Where
    // ------------------------------------------------------------
    // Every corner Clipper makes is where two edges that went in cross, but it
    // comes back on Clipper's grid, up to half a step off both. So the edges
    // within two steps of it are found, and the corner is put where two of
    // them truly cross - or, with only one, dropped square onto it. A wall
    // cut at y = 7.654321 then has its new corners at 7.654321, not 7.6543,
    // and the cut edge is as straight as the edge it was cut from.
    // ------------------------------------------------------------
    function Na__LeVecBool__Refine(ix, iy, edges) {
        const x = ix / Na__LeVecBool__SCALE, y = iy / Na__LeVecBool__SCALE;
        const tol = 2 / Na__LeVecBool__SCALE;
        const near = [];
        (edges || []).forEach((e) => {
            const dx = e[2] - e[0], dy = e[3] - e[1];
            const len2 = (dx * dx) + (dy * dy);
            if (!(len2 > 0)) return;
            const t = Math.max(0, Math.min(1, (((x - e[0]) * dx) + ((y - e[1]) * dy)) / len2));
            const d = Math.hypot(x - (e[0] + (dx * t)), y - (e[1] + (dy * t)));
            if (d <= tol) near.push({ e : e, d : d });
        });
        if (!near.length) return [ x, y ];
        near.sort((a, b) => a.d - b.d);
        let best = null, bestD = Infinity;
        for (let i = 0; i < near.length; i++) {
            for (let j = i + 1; j < near.length; j++) {
                const a = near[i].e, b = near[j].e;
                const rx = a[2] - a[0], ry = a[3] - a[1], sx = b[2] - b[0], sy = b[3] - b[1];
                const denom = (rx * sy) - (ry * sx);
                if (Math.abs(denom) < 1e-12 * Math.hypot(rx, ry) * Math.hypot(sx, sy)) continue;   // <-- Parallel (or the same line): no one crossing
                const t = (((b[0] - a[0]) * sy) - ((b[1] - a[1]) * sx)) / denom;
                const hit = [ a[0] + (rx * t), a[1] + (ry * t) ];
                const d = Math.hypot(hit[0] - x, hit[1] - y);
                if (d <= tol && d < bestD) { best = hit; bestD = d; }
            }
        }
        if (best) return best;
        const e = near[0].e, dx = e[2] - e[0], dy = e[3] - e[1];
        const t = (((x - e[0]) * dx) + ((y - e[1]) * dy)) / ((dx * dx) + (dy * dy));
        return [ e[0] + (dx * t), e[1] + (dy * t) ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Whole-Number Ring Back in Paper Millimetres
    // ------------------------------------------------------------
    // An untouched corner exactly as it went in (exact); a new one worked out
    // from the edges it was cut where (Refine).
    // ------------------------------------------------------------
    function Na__LeVecBool__ToPaper(ring, exact, edges) {
        return ring.map((p) => {
            const kept = exact ? exact.get(Na__LeVecBool__Key(p[0], p[1])) : null;
            return kept ? [ kept[0], kept[1] ] : Na__LeVecBool__Refine(p[0], p[1], edges);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Clipper's Flat Rings as Pieces: Each Outline With the Holes Inside It
    // ------------------------------------------------------------
    // Outlines come back running one way (a positive area) and holes the
    // other. Each hole goes in the SMALLEST outline that goes round it; an
    // outline inside another outline's hole is an island, a piece of its own,
    // and its depth says so (0 for a piece standing on the paper). Biggest
    // first.
    // ------------------------------------------------------------
    function Na__LeVecBool__Pieces(paths, prep) {
        const outlines = [], holes = [];
        (paths || []).forEach((path) => {
            const ring = Na__LeVecBool__CleanRing(path);
            if (!ring.length || Na__LeVecBool__IsSliver(ring)) return;
            const area2 = Na__LeVecBool__Area2(ring);
            if (area2 > 0) outlines.push({ ring : ring, area : area2 / 2, holes : [], depth : 0 });
            else if (area2 < 0) holes.push({ ring : ring, area : -area2 / 2 });
        });
        const smallestRound = (ring, except) => {
            let best = null;
            outlines.forEach((entry) => {
                if (entry === except || entry.area <= 0) return;
                if (!Na__LeVecBool__InsideRing(ring, entry.ring)) return;
                if (!best || entry.area < best.area) best = entry;
            });
            return best;
        };
        holes.forEach((hole) => { const home = smallestRound(hole.ring, null); if (home) home.holes.push(hole); });
        // DEPTH IS HOW MANY OTHER OUTLINES GO ROUND THIS ONE. Outlines never
        // overlap, so one inside another stands in a hole of it: 1 is an
        // island, 2 an island in an island's hole, 0 a piece on the paper.
        outlines.forEach((entry) => { outlines.forEach((other) => { if (other !== entry && other.area > entry.area && Na__LeVecBool__InsideRing(entry.ring, other.ring)) entry.depth++; }); });
        return outlines
            .sort((a, b) => b.area - a.area)
            .map((entry) => ({
                outline : Na__LeVecBool__ToPaper(entry.ring, prep.exact, prep.edges),
                holes   : entry.holes.sort((a, b) => b.area - a.area).map((hole) => Na__LeVecBool__ToPaper(hole.ring, prep.exact, prep.edges)),
                depth   : entry.depth
            }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Operations
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Shapes as Clean Regions, the Exact Corners They Went In With, and Their Edges
    // ------------------------------------------------------------
    function Na__LeVecBool__Prepare(shapes) {
        const exact   = new Map();
        const list    = Array.isArray(shapes) ? shapes : [];
        const regions = list.map((shape) => Na__LeVecBool__Region(shape, exact));
        const edges   = [];                                                     // <-- Every edge that went in, in paper mm: what a new corner is worked out from (Refine)
        list.forEach((shape) => (shape && Array.isArray(shape.rings) ? shape.rings : []).forEach((ring) => {
            const pts = (Array.isArray(ring) ? ring : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                if (a[0] !== b[0] || a[1] !== b[1]) edges.push([ a[0], a[1], b[0], b[1] ]);
            }
        }));
        return { exact : exact, edges : edges, regions : regions };
    }
    // ------------------------------------------------------------


    // FUNCTION | Union: Every Shape as One Area (holes where none of them reaches)
    // ------------------------------------------------------------
    function Na__LeVecBool__Union(shapes) {
        const prep = Na__LeVecBool__Prepare(shapes);
        return Na__LeVecBool__Pieces(Na__LeVecBool__Run(ClipType.Union, Na__LeVecBool__Together(prep.regions), null), prep);
    }
    // ------------------------------------------------------------


    // FUNCTION | Outer Shell: the Union With Every Hole Filled In (SketchUp's Outer Shell)
    // ------------------------------------------------------------
    // One shape alone is its outline with its holes filled. An island inside
    // a hole is inside the filled outline, so it goes with the hole.
    // ------------------------------------------------------------
    function Na__LeVecBool__OuterShell(shapes) {
        return Na__LeVecBool__Union(shapes).filter((piece) => piece.depth === 0).map((piece) => ({ outline : piece.outline, holes : [], depth : 0 }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Intersect: Only What EVERY Shape Covers
    // ------------------------------------------------------------
    function Na__LeVecBool__Intersect(shapes) {
        const prep = Na__LeVecBool__Prepare(shapes);
        if (prep.regions.length < 2) return [];
        let common = prep.regions[0];
        for (let k = 1; k < prep.regions.length && common.length; k++) common = Na__LeVecBool__Run(ClipType.Intersection, common, prep.regions[k]);
        return Na__LeVecBool__Pieces(common, prep);
    }
    // ------------------------------------------------------------


    // FUNCTION | Subtract: One Shape Less Everything the Others Cover
    // ------------------------------------------------------------
    function Na__LeVecBool__Subtract(base, cutters) {
        const prep = Na__LeVecBool__Prepare([ base ].concat(Array.isArray(cutters) ? cutters : []));
        const rest = prep.regions.slice(1);
        return Na__LeVecBool__Pieces(Na__LeVecBool__Run(ClipType.Difference, prep.regions[0], Na__LeVecBool__Together(rest)), prep);
    }
    // ------------------------------------------------------------


    // FUNCTION | Divide: Every Piece the Shapes Make Together, and Which of Them Cover It
    // ------------------------------------------------------------
    // Returns [{ owners : [ index, ... ], pieces }]: two overlapping squares
    // give three - the first's own part ([0]), the overlap ([0, 1]) and the
    // second's own part ([1]). SketchUp's Split for two, Illustrator's Divide
    // for more. Built one shape at a time, so N shapes cost N passes over the
    // pieces so far, not every subset of them.
    // ------------------------------------------------------------
    function Na__LeVecBool__Divide(shapes) {
        const prep  = Na__LeVecBool__Prepare(shapes);
        let   faces = [];
        prep.regions.forEach((region, k) => {
            if (!region.length) return;
            const next = [];
            faces.forEach((face) => {
                const both = Na__LeVecBool__Run(ClipType.Intersection, face.paths, region);
                const left = Na__LeVecBool__Run(ClipType.Difference, face.paths, region);
                if (both.length) next.push({ paths : both, owners : face.owners.concat([ k ]) });
                if (left.length) next.push({ paths : left, owners : face.owners });
            });
            const before = prep.regions.slice(0, k).filter((r) => r.length);
            const own    = before.length ? Na__LeVecBool__Run(ClipType.Difference, region, Na__LeVecBool__Together(before)) : region;
            if (own.length) next.push({ paths : own, owners : [ k ] });
            faces = next;
        });
        return faces
            .map((face) => ({ owners : face.owners.slice().sort((a, b) => a - b), pieces : Na__LeVecBool__Pieces(face.paths, prep) }))
            .filter((face) => face.pieces.length > 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | Do Two Shapes Share Any Area at All (a touch along an edge or at a corner is not a share)
    // ------------------------------------------------------------
    function Na__LeVecBool__Overlaps(a, b) {
        return Na__LeVecBool__Intersect([ a, b ]).length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pieces as Vectors
// -----------------------------------------------------------------------------

    // FUNCTION | The Area a Piece Covers, Paper mm² (its outline's less its holes')
    // ------------------------------------------------------------
    function Na__LeVecBool__Area(piece) {
        const one = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]); return Math.abs(a / 2); };
        if (!piece || !Array.isArray(piece.outline)) return 0;
        return one(piece.outline) - (piece.holes || []).reduce((sum, hole) => sum + one(hole), 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Piece in the Record's Own Form: { points, holes } for Shape__Points and Shape__Holes
    // ------------------------------------------------------------
    // The outline, then each hole, in one run; holes lists where each hole
    // begins (Na__LayoutEditor__ShapeRings__). A piece without holes is a plain
    // closed vector, holes [].
    // ------------------------------------------------------------
    function Na__LeVecBool__ToRecord(piece) {
        const points = [];
        const holes  = [];
        [ piece.outline ].concat(piece.holes || []).forEach((ring, k) => {
            if (k > 0) holes.push(points.length);
            ring.forEach((p) => points.push([ p[0], p[1] ]));
        });
        return { points : points, holes : holes };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Boolean Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeVecBool__SCALE,
        Na__LeVecBool__SLIVER_MM,
        Na__LeVecBool__Union,
        Na__LeVecBool__OuterShell,
        Na__LeVecBool__Intersect,
        Na__LeVecBool__Subtract,
        Na__LeVecBool__Divide,
        Na__LeVecBool__Overlaps,
        Na__LeVecBool__Area,
        Na__LeVecBool__ToRecord
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
