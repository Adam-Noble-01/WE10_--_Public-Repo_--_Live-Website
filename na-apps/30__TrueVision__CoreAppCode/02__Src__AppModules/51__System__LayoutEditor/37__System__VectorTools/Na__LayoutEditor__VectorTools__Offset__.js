// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - OFFSETS AND CORNERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Offset__.js
// NAMESPACE  : Na__LeVecOff
// MODULE     : Layout Editor - Vector Tools - Offsets and Corners
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths of a parallel copy of a path, and of rounding or cutting off a corner - one path's own, or the one two lines make
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - OFFSET. Every edge is moved sideways by the same distance and the moved
//   edges are joined where their lines meet, so a rectangle offsets to a
//   rectangle and a wall line to a wall line. A corner so sharp that the
//   joint would stand MitreLimit times the distance off it is cut square
//   instead, as a pen plotter's mitre limit does. An edge that the offset
//   swallows - the short side of a notch narrower than twice the distance -
//   drops out, and its neighbours meet across it. What is NOT done is a full
//   clean-up of a path that folds over itself after offsetting; that needs a
//   polygon clipper and is a later job.
// - The side is a sign: positive is to the LEFT of the way the path runs, on
//   a page whose y runs down. SideOf says which side a point is on, which is
//   how the tool turns "where the cursor is" into the sign.
// - CORNERS. Fillet and Chamfer are the same question - how far back from the
//   corner along each edge does the new piece start - answered with an arc or
//   with a straight cut. CornerFillet and CornerChamfer answer it for three
//   points; AtVertex applies either to a corner of one path; BetweenEnds
//   applies either to the corner that the end edges of TWO open paths make,
//   meeting or not, and hands back one joined path. A radius or a distance of
//   nothing is allowed there and gives a plain sharp corner - AutoCAD's
//   "fillet radius 0", the quickest way to make two lines meet.
// - Nothing here touches the model, the DOM or the config. The arc's points
//   come from a function handed in (edgesFor), so this module never decides
//   how smooth a curve is.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__OffsetTool__ and __FilletTool__.
// // @delegate: ./Na__LayoutEditor__VectorTools__Curves__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: Offset with mitred joints, a mitre limit and
//   swallowed edges; SideOf; the fillet and the chamfer of a corner, of a
//   vertex of a path, and of the corner between two open paths.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Arcs
    // ------------------------------------------------------------
    import { Na__LeVecCurve__ArcPoints } from './Na__LayoutEditor__VectorTools__Curves__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances
    // ------------------------------------------------------------
    const Na__LeVecOff__SAME_MM     = 1e-6;
    const Na__LeVecOff__MITRE_LIMIT = 4;        // <-- A joint further than this many distances off its corner is cut square (SVG's and PDF's own default)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Offset
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Edges of a Path as Lines Moved Sideways
    // ------------------------------------------------------------
    // Each is { ax, ay, bx, by, ux, uy }: the moved edge's two ends and the way
    // it runs. Edges of no length are left out - they have no sideways.
    // ------------------------------------------------------------
    function Na__LeVecOff__MovedEdges(points, closed, distanceMm) {
        const n = points.length;
        const count = closed ? n : n - 1;
        const out = [];
        for (let i = 0; i < count; i++) {
            const a = points[i], b = points[(i + 1) % n];
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const len = Math.hypot(dx, dy);
            if (len < Na__LeVecOff__SAME_MM) continue;
            const ux = dx / len, uy = dy / len;
            const nx = uy, ny = -ux;                                             // <-- Left of the way it runs, on a y-down page
            out.push({ ax : a[0] + (nx * distanceMm), ay : a[1] + (ny * distanceMm), bx : b[0] + (nx * distanceMm), by : b[1] + (ny * distanceMm), ux : ux, uy : uy });
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where Two Moved Edges' Lines Meet (null when they run the same way)
    // ------------------------------------------------------------
    function Na__LeVecOff__Meet(first, second) {
        const denom = (first.ux * second.uy) - (first.uy * second.ux);
        if (Math.abs(denom) < 1e-9) return null;
        const qx = second.ax - first.bx, qy = second.ay - first.by;
        const t  = ((qx * second.uy) - (qy * second.ux)) / denom;
        return [ first.bx + (first.ux * t), first.by + (first.uy * t) ];
    }
    // ------------------------------------------------------------


    // FUNCTION | A Parallel Copy of a Path, a Signed Distance to Its Left
    // ------------------------------------------------------------
    // Returns { points, closed } or null when nothing is left (a closed shape
    // offset inwards by more than it is wide). options.mitreLimit overrides
    // the limit.
    // ------------------------------------------------------------
    function Na__LeVecOff__Offset(path, distanceMm, options) {
        if (!path || !Array.isArray(path.points) || path.points.length < 2 || !Number.isFinite(distanceMm)) return null;
        const closed = path.closed === true && path.points.length > 2;
        if (Math.abs(distanceMm) < Na__LeVecOff__SAME_MM) return { points : path.points.map((p) => [ p[0], p[1] ]), closed : closed };
        const limit = (options && Number.isFinite(options.mitreLimit) && options.mitreLimit >= 1) ? options.mitreLimit : Na__LeVecOff__MITRE_LIMIT;
        let edges = Na__LeVecOff__MovedEdges(path.points, closed, distanceMm);
        if (!edges.length) return null;

        // SWALLOWED EDGES | An edge whose two joints have swapped places along
        // it has been offset out of existence. It drops out and its neighbours
        // meet across it; the test runs again, because that can swallow another.
        // ------------------------------------
        for (let guard = 0; guard < 64 && edges.length > (closed ? 2 : 1); guard++) {
            const count = edges.length;
            let dropped = -1;
            for (let i = 0; i < count && dropped === -1; i++) {
                const prev = (closed || i > 0)         ? edges[(i - 1 + count) % count] : null;
                const next = (closed || i < count - 1) ? edges[(i + 1) % count]         : null;
                const edge = edges[i];
                const from = prev ? (Na__LeVecOff__Meet(prev, edge) || [ edge.ax, edge.ay ]) : [ edge.ax, edge.ay ];
                const to   = next ? (Na__LeVecOff__Meet(edge, next) || [ edge.bx, edge.by ]) : [ edge.bx, edge.by ];
                const along = ((to[0] - from[0]) * edge.ux) + ((to[1] - from[1]) * edge.uy);
                if (along < -Na__LeVecOff__SAME_MM) dropped = i;
            }
            if (dropped === -1) break;
            edges.splice(dropped, 1);
            // THE WALLS OF A SLOT GO WITH ITS FLOOR. With the floor gone its two
            // walls are neighbours, running opposite ways. If the offset has
            // carried them THROUGH each other - they now stand on the wrong
            // sides of one another - the slot has closed up and both go too.
            // ------------------------------------
            const left = edges.length;
            if (left >= 2 && (closed || (dropped > 0 && dropped < left))) {
                const wallA = edges[(dropped - 1 + left) % left], wallB = edges[dropped % left];
                const facing = (wallA.ux * wallB.ux) + (wallA.uy * wallB.uy) < -1 + 1e-9;
                if (facing && wallA !== wallB) {
                    const nx = wallA.uy, ny = -wallA.ux;
                    const now    = ((wallB.ax - wallA.ax) * nx) + ((wallB.ay - wallA.ay) * ny);
                    const before = now + (2 * distanceMm);                       // <-- Each wall moved the distance towards the other's side: their gap changed by twice that
                    if (before * now <= 0) {
                        const first = (dropped - 1 + left) % left, second = dropped % left;
                        edges.splice(Math.max(first, second), 1);
                        edges.splice(Math.min(first, second), 1);
                    }
                }
            }
        }
        if (edges.length < (closed ? 3 : 1)) return null;

        const count  = edges.length;
        const points = [];
        const reach  = Math.abs(distanceMm) * limit;
        const joint  = (first, second, corner) => {
            const meet = Na__LeVecOff__Meet(first, second);
            if (!meet) {
                const onwards = ((first.ux * second.ux) + (first.uy * second.uy)) > 0;
                const inLine  = Math.abs(((second.ax - first.bx) * first.uy) - ((second.ay - first.by) * first.ux)) <= Na__LeVecOff__SAME_MM;
                if (onwards && inLine && Math.hypot(first.bx - second.ax, first.by - second.ay) > Na__LeVecOff__SAME_MM) return;   // <-- One straight run carried on across a swallowed slot: no point is wanted in the middle of it
                points.push([ first.bx, first.by ]);
                if (Math.hypot(first.bx - second.ax, first.by - second.ay) > Na__LeVecOff__SAME_MM) points.push([ second.ax, second.ay ]);
                return;
            }
            if (Math.hypot(meet[0] - corner[0], meet[1] - corner[1]) > reach) { points.push([ first.bx, first.by ], [ second.ax, second.ay ]); return; }   // <-- Past the mitre limit: cut square
            points.push(meet);
        };
        const cornerOf = (first) => [ first.bx - (first.uy * distanceMm), first.by + (first.ux * distanceMm) ];   // <-- The un-moved end of an edge: back the way the normal came
        if (!closed) points.push([ edges[0].ax, edges[0].ay ]);
        for (let i = 0; i < count; i++) {
            if (!closed && i === count - 1) break;
            joint(edges[i], edges[(i + 1) % count], cornerOf(edges[i]));
        }
        if (!closed) points.push([ edges[count - 1].bx, edges[count - 1].by ]);
        if (closed && points.length) points.unshift(points.pop());               // <-- The joint made last is the one at the first edge's start: the run begins there, as the source does
        const clean = [];
        points.forEach((p) => { const last = clean[clean.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > Na__LeVecOff__SAME_MM) clean.push(p); });
        if (closed && clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= Na__LeVecOff__SAME_MM) clean.pop();
        if (clean.length < (closed ? 3 : 2)) return null;
        return { points : clean, closed : closed };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Side of a Path a Point Is On, and How Far Off (signed, left positive)
    // ------------------------------------------------------------
    // Measured against the NEAREST edge, so dragging the cursor round a shape
    // gives the side anyone would say it is on. Returns the signed distance,
    // or 0 for a path with no edge.
    // ------------------------------------------------------------
    function Na__LeVecOff__SideOf(path, point) {
        const pts = (path && Array.isArray(path.points)) ? path.points : [];
        const n = pts.length;
        if (n < 2 || !point) return 0;
        const px = Array.isArray(point) ? point[0] : point.x;
        const py = Array.isArray(point) ? point[1] : point.y;
        const count = (path.closed === true && n > 2) ? n : n - 1;
        let best = null;
        for (let i = 0; i < count; i++) {
            const a = pts[i], b = pts[(i + 1) % n];
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const len2 = (dx * dx) + (dy * dy);
            if (len2 < Na__LeVecOff__SAME_MM * Na__LeVecOff__SAME_MM) continue;
            let t = (((px - a[0]) * dx) + ((py - a[1]) * dy)) / len2;
            t = Math.max(0, Math.min(1, t));
            const fx = a[0] + (dx * t), fy = a[1] + (dy * t);
            const d  = Math.hypot(px - fx, py - fy);
            if (!best || d < best.d) best = { d : d, cross : ((px - a[0]) * dy) - ((py - a[1]) * dx) };
        }
        if (!best) return 0;
        return best.cross >= 0 ? best.d : -best.d;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | One Corner
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Two Ways Out of a Corner, and the Angle Between Them
    // ------------------------------------------------------------
    function Na__LeVecOff__Corner(prev, corner, next) {
        const ax = prev[0] - corner[0], ay = prev[1] - corner[1];
        const bx = next[0] - corner[0], by = next[1] - corner[1];
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < Na__LeVecOff__SAME_MM || lb < Na__LeVecOff__SAME_MM) return null;
        const ux = ax / la, uy = ay / la, vx = bx / lb, vy = by / lb;
        const dot   = Math.max(-1, Math.min(1, (ux * vx) + (uy * vy)));
        const angle = Math.acos(dot);                                            // <-- 0 doubles back, pi runs straight on
        return { ux : ux, uy : uy, vx : vx, vy : vy, la : la, lb : lb, angle : angle };
    }
    // ------------------------------------------------------------


    // FUNCTION | Round a Corner: Where the Arc Starts, Ends and Is Centred
    // ------------------------------------------------------------
    // Returns { ok : true, from, to, cx, cy, r, start, sweep, setback } or
    // { ok : false, reason } - 'straight' when there is no corner to round,
    // 'radius' for no radius, 'long' when either edge is too short for it.
    // ------------------------------------------------------------
    function Na__LeVecOff__CornerFillet(prev, corner, next, radiusMm) {
        const c = Na__LeVecOff__Corner(prev, corner, next);
        if (!c || c.angle < 1e-6 || c.angle > Math.PI - 1e-6) return { ok : false, reason : 'straight' };
        if (!(radiusMm > Na__LeVecOff__SAME_MM)) return { ok : false, reason : 'radius' };
        const setback = radiusMm / Math.tan(c.angle / 2);
        if (setback > c.la + Na__LeVecOff__SAME_MM || setback > c.lb + Na__LeVecOff__SAME_MM) return { ok : false, reason : 'long', setback : setback, room : Math.min(c.la, c.lb) };
        const from = [ corner[0] + (c.ux * setback), corner[1] + (c.uy * setback) ];
        const to   = [ corner[0] + (c.vx * setback), corner[1] + (c.vy * setback) ];
        const mx = c.ux + c.vx, my = c.uy + c.vy;
        const ml = Math.hypot(mx, my);
        const reach = radiusMm / Math.sin(c.angle / 2);
        const cx = corner[0] + ((mx / ml) * reach), cy = corner[1] + ((my / ml) * reach);
        const start = Math.atan2(from[1] - cy, from[0] - cx);
        let sweep   = Math.atan2(to[1] - cy, to[0] - cx) - start;
        while (sweep > Math.PI)  sweep -= Math.PI * 2;                           // <-- Always the short way round: a fillet never exceeds a half turn
        while (sweep < -Math.PI) sweep += Math.PI * 2;
        return { ok : true, from : from, to : to, cx : cx, cy : cy, r : radiusMm, start : start, sweep : sweep, setback : setback };
    }
    // ------------------------------------------------------------


    // FUNCTION | Cut a Corner Off Square: the Same Distance Back Along Each Edge
    // ------------------------------------------------------------
    // LayOut's Chamfer: one distance, so an equal cut - 45 degrees across a
    // right angle. Returns { ok : true, from, to } or { ok : false, reason }.
    // ------------------------------------------------------------
    function Na__LeVecOff__CornerChamfer(prev, corner, next, distanceMm) {
        const c = Na__LeVecOff__Corner(prev, corner, next);
        if (!c || c.angle < 1e-6 || c.angle > Math.PI - 1e-6) return { ok : false, reason : 'straight' };
        if (!(distanceMm > Na__LeVecOff__SAME_MM)) return { ok : false, reason : 'radius' };
        if (distanceMm > c.la + Na__LeVecOff__SAME_MM || distanceMm > c.lb + Na__LeVecOff__SAME_MM) return { ok : false, reason : 'long', setback : distanceMm, room : Math.min(c.la, c.lb) };
        return { ok : true, setback : distanceMm,
                 from : [ corner[0] + (c.ux * distanceMm), corner[1] + (c.uy * distanceMm) ],
                 to   : [ corner[0] + (c.vx * distanceMm), corner[1] + (c.vy * distanceMm) ] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Points That Replace a Corner
    // ------------------------------------------------------------
    // kind 'fillet' or 'chamfer'. edgesFor(radiusMm, sweepRad) says how many
    // edges the arc is drawn with. Returns { ok, points } or the refusal.
    // ------------------------------------------------------------
    function Na__LeVecOff__CornerPoints(kind, prev, corner, next, sizeMm, edgesFor) {
        if (kind === 'chamfer') {
            const cut = Na__LeVecOff__CornerChamfer(prev, corner, next, sizeMm);
            return cut.ok ? { ok : true, points : [ cut.from, cut.to ], setback : cut.setback } : cut;
        }
        const arc = Na__LeVecOff__CornerFillet(prev, corner, next, sizeMm);
        if (!arc.ok) return arc;
        const count = Math.max(2, Math.round(typeof edgesFor === 'function' ? edgesFor(arc.r, arc.sweep) : 8));
        return { ok : true, setback : arc.setback, arc : arc,
                 points : Na__LeVecCurve__ArcPoints(arc.cx, arc.cy, arc.r, arc.start, arc.sweep, count, { from : arc.from, to : arc.to }) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Corner of One Path
// -----------------------------------------------------------------------------

    // FUNCTION | Which Corner of a Path Is Nearest a Point (index, or -1)
    // ------------------------------------------------------------
    // Only corners that HAVE two edges: every point of a closed path, and all
    // but the two ends of an open one.
    // ------------------------------------------------------------
    function Na__LeVecOff__NearestCorner(path, point, withinMm) {
        const pts = (path && Array.isArray(path.points)) ? path.points : [];
        const n = pts.length;
        const closed = path && path.closed === true && n > 2;
        if (n < 3 || !point) return -1;
        const px = Array.isArray(point) ? point[0] : point.x;
        const py = Array.isArray(point) ? point[1] : point.y;
        let best = -1, bestD = Number.isFinite(withinMm) ? withinMm : Infinity;
        for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
            const d = Math.hypot(px - pts[i][0], py - pts[i][1]);
            if (d <= bestD) { best = i; bestD = d; }
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Round or Cut One Corner of a Path
    // ------------------------------------------------------------
    // Returns { ok : true, points, closed } or { ok : false, reason } -
    // 'corner' when that point has no two edges to work between.
    // ------------------------------------------------------------
    function Na__LeVecOff__AtVertex(kind, path, index, sizeMm, edgesFor) {
        const pts = (path && Array.isArray(path.points)) ? path.points : [];
        const n = pts.length;
        const closed = path && path.closed === true && n > 2;
        if (n < 3 || !Number.isInteger(index) || index < 0 || index >= n) return { ok : false, reason : 'corner' };
        if (!closed && (index === 0 || index === n - 1)) return { ok : false, reason : 'corner' };
        const made = Na__LeVecOff__CornerPoints(kind, pts[(index - 1 + n) % n], pts[index], pts[(index + 1) % n], sizeMm, edgesFor);
        if (!made.ok) return made;
        const points = [];
        pts.forEach((p, i) => { if (i === index) made.points.forEach((q) => points.push([ q[0], q[1] ])); else points.push([ p[0], p[1] ]); });
        const clean = [];
        points.forEach((p) => { const last = clean[clean.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > Na__LeVecOff__SAME_MM) clean.push(p); });
        if (closed && clean.length > 1 && Math.hypot(clean[0][0] - clean[clean.length - 1][0], clean[0][1] - clean[clean.length - 1][1]) <= Na__LeVecOff__SAME_MM) clean.pop();
        return { ok : true, points : clean, closed : closed, arc : made.arc || null, replaced : made.points };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Corner Two Open Paths Make
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Path Turned So the End That Was Picked Comes Last
    // ------------------------------------------------------------
    // pickStation says which end edge was clicked. A path of one edge is
    // turned by which side of the corner the click was: the clicked side is
    // kept, as in AutoCAD, so the end beyond the corner is the one that moves.
    // Returns the points, LAST point the end that will move, or null when the
    // click was on neither end edge.
    // ------------------------------------------------------------
    function Na__LeVecOff__TowardsCorner(path, pickStation, meet) {
        const pts = path.points;
        const n = pts.length;
        const edges = n - 1;
        if (path.closed === true || n < 2) return null;
        const forwards = pts.map((p) => [ p[0], p[1] ]);
        const backwards = forwards.slice().reverse();
        if (edges === 1) {
            const dx = pts[1][0] - pts[0][0], dy = pts[1][1] - pts[0][1];
            const len2 = (dx * dx) + (dy * dy);
            if (len2 < Na__LeVecOff__SAME_MM * Na__LeVecOff__SAME_MM) return null;
            const tMeet = (((meet[0] - pts[0][0]) * dx) + ((meet[1] - pts[0][1]) * dy)) / len2;
            return tMeet >= pickStation ? forwards : backwards;                  // <-- The corner lies beyond the click towards the far end, or back towards the start
        }
        if (pickStation >= edges - 1) return forwards;                           // <-- The last edge was clicked: the end moves
        if (pickStation <= 1) return backwards;                                  // <-- The first edge: the start moves
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Round, Cut or Simply Make the Corner Between Two Open Paths
    // ------------------------------------------------------------
    // a and b: { points, closed }; pickA and pickB: the stations clicked.
    // The end edges' lines are carried to where they meet, the corner there is
    // rounded (kind 'fillet'), cut (kind 'chamfer') or, with a size of nothing,
    // left sharp, and ONE path comes back: A, the corner piece, then B. a and
    // b may be the same path - its two ends - and the result is then closed.
    // Returns { ok : true, points, closed } or { ok : false, reason }:
    // 'ends' (click an end edge), 'parallel' (the lines never meet), and the
    // corner's own refusals.
    // ------------------------------------------------------------
    function Na__LeVecOff__BetweenEnds(kind, a, pickA, b, pickB, sizeMm, edgesFor, same) {
        if (!a || !b || a.closed === true || b.closed === true || a.points.length < 2 || b.points.length < 2) return { ok : false, reason : 'ends' };
        const edgeOf = (path, station) => {
            const index = Math.max(0, Math.min(path.points.length - 2, Math.floor(station)));
            return [ path.points[index], path.points[index + 1] ];
        };
        const ea = edgeOf(a, pickA), eb = edgeOf(b, pickB);
        const rx = ea[1][0] - ea[0][0], ry = ea[1][1] - ea[0][1];
        const sx = eb[1][0] - eb[0][0], sy = eb[1][1] - eb[0][1];
        const denom = (rx * sy) - (ry * sx);
        if (Math.abs(denom) < 1e-12 * Math.max(1e-12, Math.hypot(rx, ry) * Math.hypot(sx, sy))) return { ok : false, reason : 'parallel' };
        const t = (((eb[0][0] - ea[0][0]) * sy) - ((eb[0][1] - ea[0][1]) * sx)) / denom;
        const meet = [ ea[0][0] + (rx * t), ea[0][1] + (ry * t) ];

        const first  = Na__LeVecOff__TowardsCorner(a, pickA, meet);              // <-- A station on a one-edge path IS how far along that edge it is
        const second = Na__LeVecOff__TowardsCorner(b, pickB, meet);
        if (!first || !second) return { ok : false, reason : 'ends' };
        if (same === true && (a.points.length < 4 || first[0][0] !== second[second.length - 1][0] || first[0][1] !== second[second.length - 1][1])) return { ok : false, reason : 'ends' };   // <-- One path's two ends: it must have been clicked on BOTH end edges, and have a middle to keep
        const lead = same === true ? first.slice(1, -1) : first.slice(0, -1);    // <-- A, without the end that moves (and, closing on itself, without the other end, which moves too)
        const tail = second.slice(0, -1).reverse();                              // <-- B, run the other way so it LEAVES the corner, without its moving end
        if (!lead.length || !tail.length) return { ok : false, reason : 'ends' };
        const prev = lead[lead.length - 1], next = tail[0];
        let middle;
        if (!(sizeMm > Na__LeVecOff__SAME_MM)) middle = [ meet ];                 // <-- No size: the two lines simply meet
        else {
            const made = Na__LeVecOff__CornerPoints(kind, prev, meet, next, sizeMm, edgesFor);
            if (!made.ok) return made;
            middle = made.points;
        }
        let points = lead.concat(middle.map((p) => [ p[0], p[1] ]));
        if (!same) points = points.concat(tail);
        const clean = [];
        points.forEach((p) => { const last = clean[clean.length - 1]; if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > Na__LeVecOff__SAME_MM) clean.push(p); });
        if (clean.length < 2) return { ok : false, reason : 'ends' };
        return { ok : true, points : clean, closed : same === true && clean.length > 2, meet : meet };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Offsets and Corners API
    // ------------------------------------------------------------
    export {
        Na__LeVecOff__Offset,
        Na__LeVecOff__SideOf,
        Na__LeVecOff__CornerFillet,
        Na__LeVecOff__CornerChamfer,
        Na__LeVecOff__NearestCorner,
        Na__LeVecOff__AtVertex,
        Na__LeVecOff__BetweenEnds
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
