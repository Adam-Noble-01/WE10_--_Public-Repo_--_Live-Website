// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Geometry__.js
// NAMESPACE  : Na__LeVecGeo
// MODULE     : Layout Editor - Vector Tools - Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths of editing one vector against others: where they cross, and what Trim, Extend, Split and Join leave behind
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A PATH is { points : [[x, y], ...], closed } in paper millimetres, y down:
//   exactly what a Sheet__Shapes record holds in Shape__Points and
//   Shape__Closed, so a result goes straight back into a record.
// - A STATION is a place along a path: the index of the edge it is on plus how
//   far along that edge, so 2.25 is a quarter of the way along the third edge.
//   A closed path has one more edge than an open one - the closing edge, from
//   the last point back to the first - and its stations wrap.
// - A CUTTER is one straight edge, [ax, ay, bx, by], that a path may be cut
//   against: an edge of another vector, of the path itself, or of the drawing
//   underneath. Nothing here knows where a cutter came from.
// - Crossings finds every station at which the cutters cross a path. Trim
//   takes a path, the station that was clicked and those crossings, and
//   answers with what is LEFT: the clicked span is removed back to the nearest
//   crossing on either side, as AutoCAD's quick trim and LayOut's Trim both
//   do. An open path leaves one or two pieces; a closed one opens up into one.
// - Extend runs the end edge of an open path on, straight, to the first
//   cutter it meets. SplitAt cuts a path in two at a station (a closed path
//   becomes one open path that starts and ends there). Join makes one path of
//   two open ones whose ends meet, closes a path whose own ends meet, and
//   takes out the joint when the two edges run on in a straight line.
// - NOTHING HERE TOUCHES THE MODEL, THE DOM OR THE CONFIG. Every function is
//   given what it needs and returns plain arrays, so the whole module runs
//   under Node (Na__Test__VectorTools__.test.mjs) exactly as it runs in the
//   editor.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__TrimTool__, __JoinTool__, __SplitTool__ and
//   __Targets__ (which gathers the cutters) call in; __Offset__ and __Curves__
//   are this module's siblings for the maths of offsets, corners and arcs.
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
// - Initial implementation: stations, crossings (other edges and the path's
//   own), Trim, Extend, SplitAt, Join, JoinMany and the nearest station.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Close Is the Same (paper millimetres)
    // ------------------------------------------------------------
    const Na__LeVecGeo__SAME_MM  = 1e-6;    // <-- Two points this close are one point: far below anything that prints, far above floating-point noise
    const Na__LeVecGeo__TOUCH_MM = 1e-5;    // <-- An edge that stops this close to another edge touches it: a line snapped onto a line is a crossing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Paths and Stations
// -----------------------------------------------------------------------------

    // FUNCTION | A Clean Path From Points and a Closed Flag
    // ------------------------------------------------------------
    // Points that are not two finite numbers drop out, as the shape geometry
    // drops them, and a path of fewer than three points is never closed.
    // ------------------------------------------------------------
    function Na__LeVecGeo__Path(points, closed) {
        const pts = (Array.isArray(points) ? points : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [ p[0], p[1] ]);
        return { points : pts, closed : closed === true && pts.length > 2 };
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Edges a Path Has (the closing edge of a closed one included)
    // ------------------------------------------------------------
    function Na__LeVecGeo__EdgeCount(path) {
        const n = path.points.length;
        if (n < 2) return 0;
        return path.closed ? n : n - 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Two Ends of One Edge
    // ------------------------------------------------------------
    function Na__LeVecGeo__Edge(path, index) {
        const n = path.points.length;
        return [ path.points[index % n], path.points[(index + 1) % n] ];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Point at a Station
    // ------------------------------------------------------------
    function Na__LeVecGeo__PointAt(path, station) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        if (!edges) return path.points.length ? [ path.points[0][0], path.points[0][1] ] : null;
        let s = station;
        if (path.closed) { s = s % edges; if (s < 0) s += edges; }
        else s = Math.max(0, Math.min(edges, s));
        let index = Math.floor(s);
        let t     = s - index;
        if (index >= edges) { index = edges - 1; t = 1; }                    // <-- The far end of an open path is the end of its last edge
        const edge = Na__LeVecGeo__Edge(path, index);
        return [ edge[0][0] + ((edge[1][0] - edge[0][0]) * t), edge[0][1] + ((edge[1][1] - edge[0][1]) * t) ];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Length of a Path, and of Each Edge
    // ------------------------------------------------------------
    function Na__LeVecGeo__EdgeLengths(path) {
        const out = [];
        const edges = Na__LeVecGeo__EdgeCount(path);
        for (let i = 0; i < edges; i++) {
            const e = Na__LeVecGeo__Edge(path, i);
            out.push(Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]));
        }
        return out;
    }
    function Na__LeVecGeo__Length(path) {
        return Na__LeVecGeo__EdgeLengths(path).reduce((sum, len) => sum + len, 0);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Station Nearest a Point, and How Far Off It Is
    // ------------------------------------------------------------
    // Returns { station, x, y, distance, index, t } or null for a path with no
    // edge. The tools use it to turn "where was clicked" into "where along".
    // ------------------------------------------------------------
    function Na__LeVecGeo__NearestStation(path, point) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        if (!edges || !point) return null;
        const px = Array.isArray(point) ? point[0] : point.x;
        const py = Array.isArray(point) ? point[1] : point.y;
        let best = null;
        for (let i = 0; i < edges; i++) {
            const e   = Na__LeVecGeo__Edge(path, i);
            const abx = e[1][0] - e[0][0], aby = e[1][1] - e[0][1];
            const len2 = (abx * abx) + (aby * aby);
            let t = len2 > 0 ? (((px - e[0][0]) * abx) + ((py - e[0][1]) * aby)) / len2 : 0;
            t = Math.max(0, Math.min(1, t));
            const x = e[0][0] + (abx * t), y = e[0][1] + (aby * t);
            const distance = Math.hypot(px - x, py - y);
            if (!best || distance < best.distance) best = { station : i + t, x : x, y : y, distance : distance, index : i, t : t };
        }
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Points With Any Run of Coincident Neighbours Reduced to One
    // ------------------------------------------------------------
    function Na__LeVecGeo__Dedupe(points, closed) {
        const out = [];
        points.forEach((p) => {
            const last = out[out.length - 1];
            if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > Na__LeVecGeo__SAME_MM) out.push([ p[0], p[1] ]);
        });
        if (closed && out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= Na__LeVecGeo__SAME_MM) out.pop();
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Part of a Path Between Two Stations, as an Open Path
    // ------------------------------------------------------------
    // Runs FORWARD from `from` to `to`. On a closed path a `to` that is not
    // ahead of `from` is reached by going on round past the first point, so
    // (from, from) is the whole loop, opened at that place. Returns null when
    // what is left has no length.
    // ------------------------------------------------------------
    function Na__LeVecGeo__SubPath(path, from, to) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        if (!edges) return null;
        const n = path.points.length;
        let end = to;
        if (path.closed) { if (end <= from + 1e-12) end += edges; }
        else if (end <= from) return null;
        const points = [ Na__LeVecGeo__PointAt(path, from) ];
        for (let k = Math.floor(from) + 1; k < end; k++) {
            if (k <= from + 1e-12) continue;                                     // <-- The start is a corner: it is already in
            points.push([ path.points[k % n][0], path.points[k % n][1] ]);
        }
        points.push(Na__LeVecGeo__PointAt(path, path.closed ? end % edges : end));
        const clean = Na__LeVecGeo__Dedupe(points, false);
        return clean.length > 1 ? { points : clean, closed : false } : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Crossings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where Two Edges Cross, as Fractions Along Each (null when they do not)
    // ------------------------------------------------------------
    // An edge that stops ON the other counts - within TOUCH_MM, so a line
    // snapped onto a line cuts it, which is how nearly every real trim is set
    // up. Parallel edges never cross, overlapping ones included: there is no
    // single place to cut.
    // ------------------------------------------------------------
    function Na__LeVecGeo__EdgeCross(ax, ay, bx, by, cx, cy, dx, dy) {
        const rx = bx - ax, ry = by - ay;
        const sx = dx - cx, sy = dy - cy;
        const rLen = Math.hypot(rx, ry), sLen = Math.hypot(sx, sy);
        if (rLen < Na__LeVecGeo__SAME_MM || sLen < Na__LeVecGeo__SAME_MM) return null;
        const denom = (rx * sy) - (ry * sx);
        if (Math.abs(denom) < 1e-12 * rLen * sLen) return null;                  // <-- Parallel
        const qx = cx - ax, qy = cy - ay;
        const t = ((qx * sy) - (qy * sx)) / denom;
        const u = ((qx * ry) - (qy * rx)) / denom;
        const tolT = Na__LeVecGeo__TOUCH_MM / rLen, tolU = Na__LeVecGeo__TOUCH_MM / sLen;
        if (t < -tolT || t > 1 + tolT || u < -tolU || u > 1 + tolU) return null;
        const tc = Math.max(0, Math.min(1, t));
        return { t : tc, u : Math.max(0, Math.min(1, u)), x : ax + (rx * tc), y : ay + (ry * tc) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge of a Path as a Cutter ([ax, ay, bx, by])
    // ------------------------------------------------------------
    function Na__LeVecGeo__Cutters(path) {
        const out = [];
        const edges = Na__LeVecGeo__EdgeCount(path);
        for (let i = 0; i < edges; i++) {
            const e = Na__LeVecGeo__Edge(path, i);
            out.push([ e[0][0], e[0][1], e[1][0], e[1][1] ]);
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stations Sorted, With Any That Are the Same Place ALONG THE PATH Reduced to One
    // ------------------------------------------------------------
    // "The same place" is judged along the path, not across the paper: where a
    // line loops over itself the one paper point is two stations, a loop's
    // length apart, and both are wanted. What is reduced is two cutters going
    // through one spot, or one cutter going through a corner and so found on
    // both of its edges.
    // ------------------------------------------------------------
    function Na__LeVecGeo__TidyStations(path, found) {
        const lengths = Na__LeVecGeo__EdgeLengths(path);
        const total   = lengths.reduce((sum, len) => sum + len, 0);
        const runTo   = (station) => {
            const index = Math.max(0, Math.min(lengths.length - 1, Math.floor(station)));
            let run = 0;
            for (let i = 0; i < index; i++) run += lengths[i];
            return run + ((station - index) * lengths[index]);
        };
        const sorted = found.map((hit) => Object.assign({ run : runTo(hit.station) }, hit)).sort((a, b) => a.run - b.run);
        const out = [];
        sorted.forEach((hit) => {
            const last = out[out.length - 1];
            if (last && Math.abs(hit.run - last.run) <= Na__LeVecGeo__TOUCH_MM * 2) return;
            out.push(hit);
        });
        // ON A CLOSED PATH the first and the last may be the one place, met from
        // either side of the first point.
        if (path.closed && out.length > 1 && (out[0].run + (total - out[out.length - 1].run)) <= Na__LeVecGeo__TOUCH_MM * 2) out.pop();
        return out.map((hit) => ({ station : hit.station, x : hit.x, y : hit.y }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Station at Which the Cutters Cross a Path
    // ------------------------------------------------------------
    // cutters: [[ax, ay, bx, by], ...]. options.self true adds the path's own
    // edges, each against every edge that is not its neighbour, so a line that
    // loops over itself can be trimmed at the loop. Returns
    // [{ station, x, y }], sorted along the path.
    // ------------------------------------------------------------
    function Na__LeVecGeo__Crossings(path, cutters, options) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        const found = [];
        if (!edges) return found;
        const list = Array.isArray(cutters) ? cutters : [];
        for (let i = 0; i < edges; i++) {
            const e = Na__LeVecGeo__Edge(path, i);
            const ax = e[0][0], ay = e[0][1], bx = e[1][0], by = e[1][1];
            const minX = Math.min(ax, bx) - Na__LeVecGeo__TOUCH_MM, maxX = Math.max(ax, bx) + Na__LeVecGeo__TOUCH_MM;
            const minY = Math.min(ay, by) - Na__LeVecGeo__TOUCH_MM, maxY = Math.max(ay, by) + Na__LeVecGeo__TOUCH_MM;
            for (let k = 0; k < list.length; k++) {
                const c = list[k];
                if ((c[0] < minX && c[2] < minX) || (c[0] > maxX && c[2] > maxX) || (c[1] < minY && c[3] < minY) || (c[1] > maxY && c[3] > maxY)) continue;   // <-- The boxes do not meet: neither do the edges
                const hit = Na__LeVecGeo__EdgeCross(ax, ay, bx, by, c[0], c[1], c[2], c[3]);
                if (hit) found.push({ station : i + hit.t, x : hit.x, y : hit.y });
            }
            if (options && options.self === true) {
                for (let j = i + 2; j < edges; j++) {
                    if (path.closed && i === 0 && j === edges - 1) continue;     // <-- The closing edge is the first edge's neighbour
                    const o   = Na__LeVecGeo__Edge(path, j);
                    const hit = Na__LeVecGeo__EdgeCross(ax, ay, bx, by, o[0][0], o[0][1], o[1][0], o[1][1]);
                    if (!hit) continue;
                    found.push({ station : i + hit.t, x : hit.x, y : hit.y });
                    found.push({ station : j + hit.u, x : hit.x, y : hit.y });
                }
            }
        }
        return Na__LeVecGeo__TidyStations(path, found);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Trim
// -----------------------------------------------------------------------------

    // FUNCTION | The Span a Click Would Trim Away, and What Would Be Left
    // ------------------------------------------------------------
    // crossings: what Crossings returned for this path. Returns
    //   { removed : path, kept : [path, ...], from, to }
    // or null when there is nothing to trim back to - no crossing at all on an
    // open path, fewer than two on a closed one - or the click sits on a
    // crossing, where neither side is the one meant.
    //
    // AN OPEN PATH loses the span from the crossing before the click to the
    // crossing after it; with none before, it loses its start, and with none
    // after, its end. What is left is one piece or two. A CLOSED PATH loses
    // the span between the two crossings either side of the click and opens
    // into ONE piece, running round the other way from one crossing to the
    // other.
    // ------------------------------------------------------------
    function Na__LeVecGeo__Trim(path, pickStation, crossings) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        const list  = Array.isArray(crossings) ? crossings : [];
        if (!edges || !Number.isFinite(pickStation) || !list.length) return null;
        const lengths = Na__LeVecGeo__EdgeLengths(path);
        const apart   = (a, b) => {                                              // <-- Millimetres along the path between two stations on one edge, near enough
            const i = Math.min(edges - 1, Math.max(0, Math.floor(Math.min(a, b))));
            return Math.abs(a - b) * (lengths[i] || 0);
        };
        if (list.some((hit) => Math.abs(hit.station - pickStation) < 1e-9 || apart(hit.station, pickStation) <= Na__LeVecGeo__TOUCH_MM)) return null;

        if (!path.closed) {
            let before = null, after = null;
            list.forEach((hit) => {
                if (hit.station < pickStation && (before === null || hit.station > before)) before = hit.station;
                if (hit.station > pickStation && (after === null || hit.station < after))  after  = hit.station;
            });
            if (before === null && after === null) return null;
            const kept = [];
            const head = before === null ? null : Na__LeVecGeo__SubPath(path, 0, before);
            const tail = after  === null ? null : Na__LeVecGeo__SubPath(path, after, edges);
            if (head) kept.push(head);
            if (tail) kept.push(tail);
            const removed = Na__LeVecGeo__SubPath(path, before === null ? 0 : before, after === null ? edges : after);
            if (!removed) return null;
            return { removed : removed, kept : kept, from : before === null ? 0 : before, to : after === null ? edges : after };
        }

        if (list.length < 2) return null;                                        // <-- One cut opens a loop but removes nothing: that is Split's job
        let before = null, after = null;
        list.forEach((hit) => {
            if (hit.station < pickStation && (before === null || hit.station > before)) before = hit.station;
            if (hit.station > pickStation && (after === null || hit.station < after))  after  = hit.station;
        });
        if (before === null) before = list[list.length - 1].station;            // <-- Round past the first point, backwards
        if (after  === null) after  = list[0].station;                           // <-- ...and forwards
        if (Math.abs(before - after) < 1e-12) return null;
        const removed = Na__LeVecGeo__SubPath(path, before, after);
        const left    = Na__LeVecGeo__SubPath(path, after, before);
        if (!removed || !left) return null;
        return { removed : removed, kept : [ left ], from : before, to : after };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Extend
// -----------------------------------------------------------------------------

    // FUNCTION | Run the End of an Open Path On to the First Cutter It Meets
    // ------------------------------------------------------------
    // end: 'start' or 'end'. The end edge is carried on in a straight line -
    // its direction never changes, so a line stays a line - to the nearest
    // cutter ahead of it. options.self true lets it stop on the path's own
    // other edges; options.maxMm caps how far it may run. Returns
    //   { points, added : [[x, y], [x, y]], distance }
    // (added is the new length, for the preview) or null when nothing is ahead.
    // ------------------------------------------------------------
    function Na__LeVecGeo__Extend(path, end, cutters, options) {
        const n = path.points.length;
        if (path.closed || n < 2) return null;
        const atStart = end === 'start';
        const tip     = atStart ? path.points[0] : path.points[n - 1];
        const back    = atStart ? path.points[1] : path.points[n - 2];
        const len     = Math.hypot(tip[0] - back[0], tip[1] - back[1]);
        if (len < Na__LeVecGeo__SAME_MM) return null;
        const ux = (tip[0] - back[0]) / len, uy = (tip[1] - back[1]) / len;
        const maxMm = (options && Number.isFinite(options.maxMm) && options.maxMm > 0) ? options.maxMm : Infinity;
        let best = Infinity;

        const tryEdge = (cx, cy, dx, dy) => {
            const sx = dx - cx, sy = dy - cy;
            const sLen = Math.hypot(sx, sy);
            if (sLen < Na__LeVecGeo__SAME_MM) return;
            const denom = (ux * sy) - (uy * sx);
            if (Math.abs(denom) < 1e-12 * sLen) return;                          // <-- Running alongside it: it is never met
            const qx = cx - tip[0], qy = cy - tip[1];
            const t  = ((qx * sy) - (qy * sx)) / denom;                          // <-- Millimetres ahead of the tip
            const u  = ((qx * uy) - (qy * ux)) / denom;
            const tolU = Na__LeVecGeo__TOUCH_MM / sLen;
            if (t <= Na__LeVecGeo__TOUCH_MM || t > maxMm || u < -tolU || u > 1 + tolU) return;   // <-- Already touching it is not "ahead"
            if (t < best) best = t;
        };

        (Array.isArray(cutters) ? cutters : []).forEach((c) => tryEdge(c[0], c[1], c[2], c[3]));
        if (options && options.self === true) {
            const edges = Na__LeVecGeo__EdgeCount(path);
            const own   = atStart ? 0 : edges - 1;                               // <-- The end edge cannot stop on itself
            for (let i = 0; i < edges; i++) {
                if (i === own) continue;
                const e = Na__LeVecGeo__Edge(path, i);
                tryEdge(e[0][0], e[0][1], e[1][0], e[1][1]);
            }
        }
        if (!Number.isFinite(best)) return null;
        const landed = [ tip[0] + (ux * best), tip[1] + (uy * best) ];
        const points = path.points.map((p) => [ p[0], p[1] ]);
        if (atStart) points[0] = landed; else points[n - 1] = landed;
        return { points : points, added : [ [ tip[0], tip[1] ], landed ], distance : best };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which End of an Open Path a Station Is Nearer ('start' or 'end')
    // ------------------------------------------------------------
    // Measured along the path, so a click anywhere on the first half of a long
    // polyline means its start, as it does in AutoCAD.
    // ------------------------------------------------------------
    function Na__LeVecGeo__NearerEnd(path, station) {
        const lengths = Na__LeVecGeo__EdgeLengths(path);
        const total   = lengths.reduce((sum, len) => sum + len, 0);
        if (!(total > 0)) return 'end';
        let run = 0;
        const index = Math.max(0, Math.min(lengths.length - 1, Math.floor(station)));
        for (let i = 0; i < index; i++) run += lengths[i];
        run += (station - index) * lengths[index];
        return run <= total / 2 ? 'start' : 'end';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Split
// -----------------------------------------------------------------------------

    // FUNCTION | Cut a Path at One Station
    // ------------------------------------------------------------
    // An open path becomes two; a closed one becomes ONE open path that starts
    // and ends at the cut, which is what cutting a loop of string does.
    // Returns [path, ...] or null when the cut is at the very end of an open
    // path, where there is nothing to part.
    // ------------------------------------------------------------
    function Na__LeVecGeo__SplitAt(path, station) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        if (!edges || !Number.isFinite(station)) return null;
        if (path.closed) {
            const opened = Na__LeVecGeo__SubPath(path, station, station);
            return opened ? [ opened ] : null;
        }
        const head = Na__LeVecGeo__SubPath(path, 0, station);
        const tail = Na__LeVecGeo__SubPath(path, station, edges);
        return (head && tail) ? [ head, tail ] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cut a Path at Every One of a List of Stations
    // ------------------------------------------------------------
    // stations: numbers, in any order. An open path comes back as its pieces
    // in order; a closed one as the pieces between consecutive cuts, the last
    // running round past the first point. One cut on a closed path opens it.
    // ------------------------------------------------------------
    function Na__LeVecGeo__SplitAll(path, stations) {
        const edges = Na__LeVecGeo__EdgeCount(path);
        if (!edges) return null;
        const cuts = Array.from(new Set((Array.isArray(stations) ? stations : []).filter((s) => Number.isFinite(s)))).sort((a, b) => a - b);
        if (!cuts.length) return null;
        const out = [];
        if (path.closed) {
            for (let i = 0; i < cuts.length; i++) {
                const piece = Na__LeVecGeo__SubPath(path, cuts[i], cuts[(i + 1) % cuts.length]);
                if (piece) out.push(piece);
            }
            return out.length ? out : null;
        }
        const marks = [ 0 ].concat(cuts.filter((s) => s > 0 && s < edges), [ edges ]);
        for (let i = 0; i + 1 < marks.length; i++) {
            const piece = Na__LeVecGeo__SubPath(path, marks[i], marks[i + 1]);
            if (piece) out.push(piece);
        }
        return out.length > 1 ? out : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Join
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Take Out a Joint Whose Two Edges Run On in One Straight Line
    // ------------------------------------------------------------
    // A line split and joined again should be the line it was, not a line with
    // a point left in the middle of it. Only the joint is ever looked at: a
    // point the user put on a straight run on purpose is theirs to keep.
    // ------------------------------------------------------------
    function Na__LeVecGeo__DropStraightJoint(points, index, closed) {
        const n = points.length;
        if (n < 3) return points;
        if (!closed && (index <= 0 || index >= n - 1)) return points;
        const a = points[(index - 1 + n) % n], b = points[index % n], c = points[(index + 1) % n];
        const abx = b[0] - a[0], aby = b[1] - a[1], bcx = c[0] - b[0], bcy = c[1] - b[1];
        const ab = Math.hypot(abx, aby), bc = Math.hypot(bcx, bcy);
        if (ab < Na__LeVecGeo__SAME_MM || bc < Na__LeVecGeo__SAME_MM) return points;
        const off  = Math.abs((abx * bcy) - (aby * bcx)) / (ab + bc);             // <-- How far the joint stands off the straight line through its neighbours, near enough
        const onwards = ((abx * bcx) + (aby * bcy)) > 0;                        // <-- Not doubling back on itself
        if (!onwards || off > Na__LeVecGeo__TOUCH_MM) return points;
        const out = points.slice();
        out.splice(index % n, 1);
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make One Path of Two Open Paths Whose Ends Meet
    // ------------------------------------------------------------
    // toleranceMm is how close two ends must be to count as meeting. Whichever
    // pair of ends is closest within it is joined, either path turned round as
    // it needs to be, A's direction kept where there is a choice. When the far
    // ends meet as well the result is CLOSED. options.bridge true joins the
    // nearest pair of ends however far apart they are, with a straight edge
    // between them (Illustrator's Join) - the ends are then both kept.
    // Returns { points, closed, bridged } or null.
    // ------------------------------------------------------------
    function Na__LeVecGeo__Join(a, b, toleranceMm, options) {
        if (!a || !b || a.closed || b.closed || a.points.length < 2 || b.points.length < 2) return null;
        const tol = Number.isFinite(toleranceMm) && toleranceMm >= 0 ? toleranceMm : Na__LeVecGeo__TOUCH_MM;
        const A0 = a.points[0], A1 = a.points[a.points.length - 1];
        const B0 = b.points[0], B1 = b.points[b.points.length - 1];
        const gap = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        const pairs = [
            { d : gap(A1, B0), a : false, b : false },                          // <-- A then B
            { d : gap(A1, B1), a : false, b : true  },                          // <-- A then B turned round
            { d : gap(A0, B1), a : true,  b : true  },                          // <-- B then A, which is A turned, B turned, then the lot turned back below
            { d : gap(A0, B0), a : true,  b : false }
        ].sort((p, q) => p.d - q.d);
        const pick   = pairs[0];
        const bridge = !!(options && options.bridge === true);
        if (pick.d > tol && !bridge) return null;
        const bridged = pick.d > tol;
        const first  = pick.a ? a.points.slice().reverse() : a.points.slice();
        const second = pick.b ? b.points.slice().reverse() : b.points.slice();
        let points = first.map((p) => [ p[0], p[1] ]);
        const jointIndex = points.length - 1;
        second.forEach((p, i) => { if (i === 0 && !bridged) return; points.push([ p[0], p[1] ]); });   // <-- Meeting ends are one point; bridged ends are both kept
        let closed = false;
        const head = points[0], tail = points[points.length - 1];
        if (points.length > 3 && gap(head, tail) <= tol) { points.pop(); closed = true; }
        if (!bridged) points = Na__LeVecGeo__DropStraightJoint(points, jointIndex, closed);
        if (closed) points = Na__LeVecGeo__DropStraightJoint(points, 0, true);   // <-- And the joint the closing made
        if (pick.a && !closed) points.reverse();                                 // <-- Back the way A ran
        points = Na__LeVecGeo__Dedupe(points, closed);
        if (points.length < 2) return null;
        return { points : points, closed : closed && points.length > 2, bridged : bridged };
    }
    // ------------------------------------------------------------


    // FUNCTION | Close an Open Path Whose Own Ends Meet
    // ------------------------------------------------------------
    // Returns { points, closed : true } or null. With options.bridge true the
    // ends need not meet: the closing edge bridges them.
    // ------------------------------------------------------------
    function Na__LeVecGeo__CloseEnds(path, toleranceMm, options) {
        if (!path || path.closed || path.points.length < 3) return null;
        const tol  = Number.isFinite(toleranceMm) && toleranceMm >= 0 ? toleranceMm : Na__LeVecGeo__TOUCH_MM;
        const head = path.points[0], tail = path.points[path.points.length - 1];
        const gap  = Math.hypot(head[0] - tail[0], head[1] - tail[1]);
        const bridge = !!(options && options.bridge === true);
        if (gap > tol && !bridge) return null;
        let points = path.points.map((p) => [ p[0], p[1] ]);
        if (gap <= tol) { points.pop(); points = Na__LeVecGeo__DropStraightJoint(points, 0, true); }
        if (points.length < 3) return null;
        return { points : points, closed : true, bridged : gap > tol };
    }
    // ------------------------------------------------------------


    // FUNCTION | Join Every Path in a List That Can Be Joined to Another
    // ------------------------------------------------------------
    // paths: [{ key, points, closed }]. Works through the list joining any two
    // open paths whose ends meet until no two do. Returns
    //   [{ keys : [key, ...], points, closed }]
    // - one entry per path that is left, keys naming what went into it, the
    // first key being the path whose style the result should keep.
    // ------------------------------------------------------------
    function Na__LeVecGeo__JoinMany(paths, toleranceMm) {
        const pool = (Array.isArray(paths) ? paths : []).map((p) => ({ keys : [ p.key ], points : p.points.map((q) => [ q[0], q[1] ]), closed : p.closed === true }));
        let joined = true;
        while (joined) {
            joined = false;
            for (let i = 0; i < pool.length && !joined; i++) {
                if (pool[i].closed) continue;
                for (let j = i + 1; j < pool.length && !joined; j++) {
                    if (pool[j].closed) continue;
                    const made = Na__LeVecGeo__Join(pool[i], pool[j], toleranceMm);
                    if (!made) continue;
                    pool[i] = { keys : pool[i].keys.concat(pool[j].keys), points : made.points, closed : made.closed };
                    pool.splice(j, 1);
                    joined = true;
                }
            }
        }
        pool.forEach((entry, index) => {                                         // <-- A chain whose own two ends now meet is a loop
            if (entry.closed) return;
            const shut = Na__LeVecGeo__CloseEnds(entry, toleranceMm);
            if (shut) pool[index] = { keys : entry.keys, points : shut.points, closed : true };
        });
        return pool;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeVecGeo__SAME_MM,
        Na__LeVecGeo__TOUCH_MM,
        Na__LeVecGeo__Path,
        Na__LeVecGeo__EdgeCount,
        Na__LeVecGeo__Edge,
        Na__LeVecGeo__PointAt,
        Na__LeVecGeo__EdgeLengths,
        Na__LeVecGeo__Length,
        Na__LeVecGeo__NearestStation,
        Na__LeVecGeo__SubPath,
        Na__LeVecGeo__Cutters,
        Na__LeVecGeo__Crossings,
        Na__LeVecGeo__Trim,
        Na__LeVecGeo__Extend,
        Na__LeVecGeo__NearerEnd,
        Na__LeVecGeo__SplitAt,
        Na__LeVecGeo__SplitAll,
        Na__LeVecGeo__Join,
        Na__LeVecGeo__CloseEnds,
        Na__LeVecGeo__JoinMany
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
