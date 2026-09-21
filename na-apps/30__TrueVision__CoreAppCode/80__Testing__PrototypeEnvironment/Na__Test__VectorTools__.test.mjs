// =============================================================================
// TRUEVISION3D - TEST - THE VECTOR TOOLS: THE MATHS OF TRIM, EXTEND, SPLIT, JOIN, OFFSET, CORNERS AND CURVES, AND THE KEYS
// =============================================================================
//
// FILE       : Na__Test__VectorTools__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Vector Tools Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the three pure modules behind the Layout Editor's vector tools, on the shapes an architect actually draws, and that every tool's key resolves - T as Trim only inside a container
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - GEOMETRY. Crossings (a cross, a T where one line stops ON the other, a
//   line looped over itself, parallel lines that never cross); Trim of an open
//   line (middle, start, end, the whole of it) and of a closed rectangle (it
//   opens, and keeps the far side); Extend to the nearest line ahead, past one
//   it already touches, and nowhere when nothing is ahead; SplitAt and
//   SplitAll; Join in all four end-to-end arrangements, the straight joint
//   taken out, the loop closed, the bridge, and JoinMany's chain.
// - CURVES. How many edges a circle gets and how far its flats stand off the
//   true curve; the arc through three points, both ways round; the arc on a
//   chord and a bulge; Describe reading a circle and an arc back from their
//   points, surviving a move, refusing a dragged vertex, and reading an arc
//   whose ends a trim has cut short.
// - OFFSETS AND CORNERS. A rectangle offset out and in, a swallowed notch, an
//   open line both sides; a right-angle fillet and chamfer; the corner two
//   separate lines make, rounded, cut and left sharp.
// - THE KEYS. The shipped key file and the built-in fallback both give every
//   vector tool its key - C, Shift+A, Shift+T, J, U, F, Shift+F, Shift+C - and
//   T is the Trim tool only when the caller says a container is open
//   ({ InContainer : true }); told nothing, or told it is not, T is still the
//   Text tool, which is what keeps every older caller of the key map unchanged.
// - The pure modules are imported as shipped: they have no imports of the editor's
//   own, which is the point of them.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__VectorTools__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the vector tools.
//
// =============================================================================

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | Loading and Checking
// -----------------------------------------------------------------------------

    // THE SHIPPED FILES, COPIED AS .mjs. The app has no package.json, so Node
    // reads a .js file as CommonJS and stops at its first export. Each module
    // is copied beside its siblings under a temporary folder with the one
    // change that needs: '.js' to '.mjs', in its name and in its imports of
    // them. Not a word of the code is touched.
    // ------------------------------------------------------------
    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const FOLDER     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor', '37__System__VectorTools');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-vectortools-'));
    const NAMES      = [ 'Na__LayoutEditor__VectorTools__Geometry__', 'Na__LayoutEditor__VectorTools__Curves__', 'Na__LayoutEditor__VectorTools__Offset__' ];
    NAMES.forEach((name) => {
        const source = readFileSync(resolve(FOLDER, name + '.js'), 'utf8').replace(/(from\s+'\.\/Na__LayoutEditor__VectorTools__[A-Za-z]+__)\.js'/g, "$1.mjs'");
        writeFileSync(join(SCRATCH, name + '.mjs'), source, 'utf8');
    });
    const load = (name) => import(pathToFileURL(join(SCRATCH, name + '.mjs')).href);

    const G = await load(NAMES[0]);
    const C = await load(NAMES[1]);
    const O = await load(NAMES[2]);

    let passed = 0, failed = 0;
    function check(name, ok, detail) {
        if (ok) { passed++; return; }
        failed++;
        console.error('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const near    = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
    const nearPt  = (p, q, tol) => !!p && !!q && near(p[0], q[0], tol) && near(p[1], q[1], tol);
    const samePts = (a, b, tol) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((p, i) => nearPt(p, b[i], tol));
    const open    = (...pts) => G.Na__LeVecGeo__Path(pts, false);
    const shut    = (...pts) => G.Na__LeVecGeo__Path(pts, true);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry - Stations and Crossings
// -----------------------------------------------------------------------------

    {
        const line = open([ 0, 0 ], [ 10, 0 ], [ 10, 10 ]);
        check('an open path of three points has two edges', G.Na__LeVecGeo__EdgeCount(line) === 2);
        check('a closed path of three points has three', G.Na__LeVecGeo__EdgeCount(shut([ 0, 0 ], [ 10, 0 ], [ 10, 10 ])) === 3);
        check('a station reads along its edge', nearPt(G.Na__LeVecGeo__PointAt(line, 1.25), [ 10, 2.5 ]));
        check('the far end of an open path is its last point', nearPt(G.Na__LeVecGeo__PointAt(line, 2), [ 10, 10 ]));
        check('a closed path wraps its stations', nearPt(G.Na__LeVecGeo__PointAt(shut([ 0, 0 ], [ 10, 0 ], [ 10, 10 ]), 3.5), [ 5, 0 ]));
        const nearest = G.Na__LeVecGeo__NearestStation(line, { x : 4, y : 1 });
        check('the nearest station is found on the right edge', !!nearest && near(nearest.station, 0.4) && near(nearest.distance, 1));
        check('length adds the edges', near(G.Na__LeVecGeo__Length(line), 20));
    }

    {
        const target = open([ 0, 0 ], [ 100, 0 ]);
        const cross  = G.Na__LeVecGeo__Crossings(target, [ [ 30, -10, 30, 10 ], [ 70, 10, 70, -10 ] ]);
        check('two crossing lines give two stations, in order', cross.length === 2 && near(cross[0].station, 0.3) && near(cross[1].station, 0.7), cross);
        const tee = G.Na__LeVecGeo__Crossings(target, [ [ 50, 0, 50, 40 ] ]);
        check('a line that STOPS on the target still cuts it (a T)', tee.length === 1 && near(tee[0].station, 0.5), tee);
        const shy = G.Na__LeVecGeo__Crossings(target, [ [ 50, 0.5, 50, 40 ] ]);
        check('a line that stops short does not', shy.length === 0, shy);
        const along = G.Na__LeVecGeo__Crossings(target, [ [ 20, 0, 60, 0 ], [ 0, 5, 100, 5 ] ]);
        check('parallel and overlapping lines never cut', along.length === 0, along);
        const twice = G.Na__LeVecGeo__Crossings(target, [ [ 30, -10, 30, 10 ], [ 30, -5, 30, 5 ] ]);
        check('two cutters through one place are one station', twice.length === 1, twice);

        const loop = open([ 0, 0 ], [ 100, 0 ], [ 100, 50 ], [ 50, 50 ], [ 50, -50 ]);
        const own  = G.Na__LeVecGeo__Crossings(loop, [], { self : true });
        check('a line looped over itself crosses itself, once on each edge', own.length === 2 && near(own[0].station, 0.5) && near(own[1].station, 3.5), own);
        check('...and only when asked', G.Na__LeVecGeo__Crossings(loop, []).length === 0);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry - Trim
// -----------------------------------------------------------------------------

    {
        const target = open([ 0, 0 ], [ 100, 0 ]);
        const cuts   = G.Na__LeVecGeo__Crossings(target, [ [ 30, -10, 30, 10 ], [ 70, 10, 70, -10 ] ]);
        const middle = G.Na__LeVecGeo__Trim(target, 0.5, cuts);
        check('trimming the middle leaves two pieces', !!middle && middle.kept.length === 2, middle);
        check('...the first from the start to the first crossing', !!middle && samePts(middle.kept[0].points, [ [ 0, 0 ], [ 30, 0 ] ]));
        check('...the second from the second crossing to the end', !!middle && samePts(middle.kept[1].points, [ [ 70, 0 ], [ 100, 0 ] ]));
        check('...and what goes is the span between', !!middle && samePts(middle.removed.points, [ [ 30, 0 ], [ 70, 0 ] ]));
        const start = G.Na__LeVecGeo__Trim(target, 0.1, cuts);
        check('trimming the start leaves one piece', !!start && start.kept.length === 1 && samePts(start.kept[0].points, [ [ 30, 0 ], [ 100, 0 ] ]), start);
        const end = G.Na__LeVecGeo__Trim(target, 0.9, cuts);
        check('trimming the end leaves one piece', !!end && end.kept.length === 1 && samePts(end.kept[0].points, [ [ 0, 0 ], [ 70, 0 ] ]), end);
        check('no crossing, nothing to trim back to', G.Na__LeVecGeo__Trim(target, 0.5, []) === null);
        check('a click ON a crossing means neither side', G.Na__LeVecGeo__Trim(target, 0.3, cuts) === null);

        const corner = G.Na__LeVecGeo__Crossings(target, [ [ 0, 0, 0, 50 ] ]);
        const whole  = G.Na__LeVecGeo__Trim(target, 0.5, corner);
        check('a line cut only at its own end goes whole', !!whole && whole.kept.length === 0 && samePts(whole.removed.points, [ [ 0, 0 ], [ 100, 0 ] ]), whole);

        const bent  = open([ 0, 0 ], [ 50, 0 ], [ 50, 50 ], [ 100, 50 ]);
        const bcuts = G.Na__LeVecGeo__Crossings(bent, [ [ 25, -5, 25, 5 ], [ 75, 45, 75, 55 ] ]);
        const kink  = G.Na__LeVecGeo__Trim(bent, 1.5, bcuts);
        check('a span across corners takes the corners with it', !!kink && samePts(kink.removed.points, [ [ 25, 0 ], [ 50, 0 ], [ 50, 50 ], [ 75, 50 ] ]), kink);
    }

    {
        const box  = shut([ 0, 0 ], [ 100, 0 ], [ 100, 50 ], [ 0, 50 ]);
        const cuts = G.Na__LeVecGeo__Crossings(box, [ [ 30, -10, 30, 60 ], [ 70, -10, 70, 60 ] ]);
        check('two lines through a rectangle cross it four times', cuts.length === 4, cuts);
        const top = G.Na__LeVecGeo__Trim(box, 0.5, cuts);
        check('trimming a closed shape opens it into ONE piece', !!top && top.kept.length === 1 && top.kept[0].closed === false, top);
        check('...which runs round the far side', !!top && samePts(top.kept[0].points, [ [ 70, 0 ], [ 100, 0 ], [ 100, 50 ], [ 0, 50 ], [ 0, 0 ], [ 30, 0 ] ]), top && top.kept[0].points);
        const side = G.Na__LeVecGeo__Trim(box, 3.5, cuts);
        check('a span that wraps the first point is found', !!side && samePts(side.removed.points, [ [ 30, 50 ], [ 0, 50 ], [ 0, 0 ], [ 30, 0 ] ]), side && side.removed.points);
        check('one crossing cannot trim a loop', G.Na__LeVecGeo__Trim(box, 0.5, [ cuts[0] ]) === null);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry - Extend, Split and Join
// -----------------------------------------------------------------------------

    {
        const line  = open([ 0, 0 ], [ 40, 0 ]);
        const walls = [ [ 60, -20, 60, 20 ], [ 90, -20, 90, 20 ], [ -30, -20, -30, 20 ] ];
        const far = G.Na__LeVecGeo__Extend(line, 'end', walls);
        check('the end runs on to the NEAREST line ahead', !!far && samePts(far.points, [ [ 0, 0 ], [ 60, 0 ] ]) && near(far.distance, 20), far);
        const back = G.Na__LeVecGeo__Extend(line, 'start', walls);
        check('the start runs the other way', !!back && samePts(back.points, [ [ -30, 0 ], [ 40, 0 ] ]), back);
        const touching = G.Na__LeVecGeo__Extend(open([ 0, 0 ], [ 60, 0 ]), 'end', walls);
        check('an end already ON a line runs on to the next', !!touching && samePts(touching.points, [ [ 0, 0 ], [ 90, 0 ] ]), touching);
        check('nothing ahead, nothing happens', G.Na__LeVecGeo__Extend(line, 'end', [ [ 60, 5, 60, 20 ] ]) === null);
        check('a closed shape has no end to extend', G.Na__LeVecGeo__Extend(shut([ 0, 0 ], [ 10, 0 ], [ 10, 10 ]), 'end', walls) === null);
        const capped = G.Na__LeVecGeo__Extend(line, 'end', walls, { maxMm : 10 });
        check('a cap on how far is honoured', capped === null);
        const hook = open([ 0, 0 ], [ 100, 0 ], [ 100, 40 ], [ 60, 40 ], [ 60, 20 ]);
        const self = G.Na__LeVecGeo__Extend(hook, 'end', [], { self : true });
        check('an end can run on to its own path', !!self && nearPt(self.points[4], [ 60, 0 ]), self);
        check('the nearer end is judged along the path', G.Na__LeVecGeo__NearerEnd(open([ 0, 0 ], [ 10, 0 ], [ 10, 100 ]), 1.2) === 'start' && G.Na__LeVecGeo__NearerEnd(open([ 0, 0 ], [ 10, 0 ], [ 10, 100 ]), 1.8) === 'end');
    }

    {
        const line = open([ 0, 0 ], [ 100, 0 ], [ 100, 100 ]);
        const two  = G.Na__LeVecGeo__SplitAt(line, 0.25);
        check('a split makes two', !!two && two.length === 2 && samePts(two[0].points, [ [ 0, 0 ], [ 25, 0 ] ]) && samePts(two[1].points, [ [ 25, 0 ], [ 100, 0 ], [ 100, 100 ] ]), two);
        check('a split at the very end parts nothing', G.Na__LeVecGeo__SplitAt(line, 0) === null && G.Na__LeVecGeo__SplitAt(line, 2) === null);
        const ring = G.Na__LeVecGeo__SplitAt(shut([ 0, 0 ], [ 10, 0 ], [ 10, 10 ], [ 0, 10 ]), 0.5);
        check('a closed shape splits into ONE open path that starts and ends at the cut', !!ring && ring.length === 1 && ring[0].closed === false
            && samePts(ring[0].points, [ [ 5, 0 ], [ 10, 0 ], [ 10, 10 ], [ 0, 10 ], [ 0, 0 ], [ 5, 0 ] ]), ring && ring[0].points);
        const many = G.Na__LeVecGeo__SplitAll(line, [ 1.5, 0.5 ]);
        check('several cuts give the pieces in order', !!many && many.length === 3 && samePts(many[1].points, [ [ 50, 0 ], [ 100, 0 ], [ 100, 50 ] ]), many);
        const quarters = G.Na__LeVecGeo__SplitAll(shut([ 0, 0 ], [ 10, 0 ], [ 10, 10 ], [ 0, 10 ]), [ 0.5, 2.5 ]);
        check('two cuts on a closed shape give two halves', !!quarters && quarters.length === 2 && samePts(quarters[1].points, [ [ 5, 10 ], [ 0, 10 ], [ 0, 0 ], [ 5, 0 ] ]), quarters);
    }

    {
        const a = open([ 0, 0 ], [ 50, 0 ]);
        const endToStart = G.Na__LeVecGeo__Join(a, open([ 50, 0 ], [ 50, 40 ]), 0.01);
        check('end to start joins, the meeting point kept once', !!endToStart && samePts(endToStart.points, [ [ 0, 0 ], [ 50, 0 ], [ 50, 40 ] ]) && endToStart.closed === false, endToStart);
        const endToEnd = G.Na__LeVecGeo__Join(a, open([ 50, 40 ], [ 50, 0 ]), 0.01);
        check('end to end turns the second round', !!endToEnd && samePts(endToEnd.points, [ [ 0, 0 ], [ 50, 0 ], [ 50, 40 ] ]), endToEnd);
        const startToEnd = G.Na__LeVecGeo__Join(a, open([ -30, 20 ], [ 0, 0 ]), 0.01);
        check('start to end puts the second first and keeps A\'s direction', !!startToEnd && samePts(startToEnd.points, [ [ -30, 20 ], [ 0, 0 ], [ 50, 0 ] ]), startToEnd);
        const startToStart = G.Na__LeVecGeo__Join(a, open([ 0, 0 ], [ -30, 20 ]), 0.01);
        check('start to start turns the second round and keeps A\'s direction', !!startToStart && samePts(startToStart.points, [ [ -30, 20 ], [ 0, 0 ], [ 50, 0 ] ]), startToStart);
        const straight = G.Na__LeVecGeo__Join(a, open([ 50, 0 ], [ 120, 0 ]), 0.01);
        check('a joint in a straight run is taken out', !!straight && samePts(straight.points, [ [ 0, 0 ], [ 120, 0 ] ]), straight);
        check('ends that do not meet do not join', G.Na__LeVecGeo__Join(a, open([ 51, 0 ], [ 51, 40 ]), 0.01) === null);
        const bridged = G.Na__LeVecGeo__Join(a, open([ 60, 10 ], [ 60, 40 ]), 0.01, { bridge : true });
        check('...unless bridging is asked for, which keeps both ends', !!bridged && bridged.bridged === true && samePts(bridged.points, [ [ 0, 0 ], [ 50, 0 ], [ 60, 10 ], [ 60, 40 ] ]), bridged);
        const loop = G.Na__LeVecGeo__Join(open([ 0, 0 ], [ 50, 0 ], [ 50, 40 ]), open([ 50, 40 ], [ 0, 40 ], [ 0, 0 ]), 0.01);
        check('two halves that meet at both ends make a CLOSED shape', !!loop && loop.closed === true && loop.points.length === 4, loop);
        check('a closed shape is never joined', G.Na__LeVecGeo__Join(shut([ 0, 0 ], [ 1, 0 ], [ 1, 1 ]), a, 0.01) === null);
        const shutNow = G.Na__LeVecGeo__CloseEnds(open([ 0, 0 ], [ 50, 0 ], [ 50, 40 ], [ 0, 0 ]), 0.01);
        check('a path whose own ends meet closes', !!shutNow && shutNow.closed === true && shutNow.points.length === 3, shutNow);

        const chain = G.Na__LeVecGeo__JoinMany([
            { key : 'c', points : [ [ 50, 40 ], [ 0, 40 ] ], closed : false },
            { key : 'a', points : [ [ 0, 0 ], [ 50, 0 ] ], closed : false },
            { key : 'z', points : [ [ 200, 200 ], [ 210, 200 ] ], closed : false },
            { key : 'b', points : [ [ 50, 0 ], [ 50, 40 ] ], closed : false },
            { key : 'd', points : [ [ 0, 40 ], [ 0, 0 ] ], closed : false }
        ], 0.01);
        const ring = chain.find((entry) => entry.keys.length === 4);
        check('four sides in any order weld into one closed rectangle', !!ring && ring.closed === true && ring.points.length === 4 && ring.keys[0] === 'c', chain);
        check('...and the line that touches nothing is left alone', chain.length === 2 && chain.some((entry) => entry.keys.length === 1 && entry.keys[0] === 'z'), chain);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Curves
// -----------------------------------------------------------------------------

    {
        const counts = [ 1, 5, 15, 50, 200 ].map((r) => C.Na__LeVecCurve__SegmentsFor(r, 0.01, 24, 360));
        check('every circle gets a multiple of four edges', counts.every((n) => n % 4 === 0), counts);
        check('a bigger circle gets more of them', counts.every((n, i) => i === 0 || n >= counts[i - 1]) && counts[4] > counts[0], counts);
        check('never fewer than the floor nor more than the ceiling', counts[0] >= 24 && C.Na__LeVecCurve__SegmentsFor(100000, 0.01, 24, 360) === 360, counts);
        [ 5, 15, 50 ].forEach((r) => {
            const n = C.Na__LeVecCurve__SegmentsFor(r, 0.01, 24, 360);
            check('the flats of a ' + r + ' mm circle stand within a hundredth of a millimetre of the curve', r * (1 - Math.cos(Math.PI / n)) <= 0.01 + 1e-9, n);
        });
        check('an arc gets its share of the whole circle\'s edges', C.Na__LeVecCurve__ArcSegmentsFor(50, Math.PI / 2, 0.01, 24, 360) === Math.ceil(C.Na__LeVecCurve__SegmentsFor(50, 0.01, 24, 360) / 4));

        const ring = C.Na__LeVecCurve__CirclePoints(100, 50, 20, 48, Math.PI / 6);
        check('a circle\'s first point is where the radius was picked', nearPt(ring[0], [ 100 + (20 * Math.cos(Math.PI / 6)), 50 + (20 * Math.sin(Math.PI / 6)) ]));
        const read = C.Na__LeVecCurve__Describe(ring, true);
        check('a circle reads back its centre, radius and count', !!read && read.kind === 'circle' && near(read.cx, 100) && near(read.cy, 50) && near(read.r, 20) && read.segments === 48, read);
        const moved = C.Na__LeVecCurve__Describe(ring.map((p) => [ p[0] + 333.3, p[1] - 12.7 ]), true);
        check('...and still does after a move, from the points alone', !!moved && near(moved.cx, 433.3) && near(moved.cy, 37.3) && near(moved.r, 20), moved);
        const dragged = ring.map((p) => [ p[0], p[1] ]); dragged[7] = [ dragged[7][0] + 0.5, dragged[7][1] ];
        check('a dragged vertex makes it a polygon again', C.Na__LeVecCurve__Describe(dragged, true) === null);
        const hexagon = C.Na__LeVecCurve__Describe(C.Na__LeVecCurve__CirclePoints(0, 0, 10, 6, 0), true);
        check('a hexagon is a circle of six', !!hexagon && hexagon.segments === 6);
    }

    {
        const arc = C.Na__LeVecCurve__ArcThrough([ 10, 0 ], [ 0, 10 ], [ -10, 0 ]);
        check('an arc through three points finds its circle', !!arc && near(arc.cx, 0) && near(arc.cy, 0) && near(arc.r, 10), arc);
        check('...and sweeps the way that passes through the middle one', !!arc && near(arc.sweep, Math.PI), arc);
        const other = C.Na__LeVecCurve__ArcThrough([ 10, 0 ], [ 0, -10 ], [ -10, 0 ]);
        check('...or the other way round', !!other && near(other.sweep, -Math.PI), other);
        check('three points in a line make no arc', C.Na__LeVecCurve__ArcThrough([ 0, 0 ], [ 5, 0 ], [ 10, 0 ]) === null);

        const half = C.Na__LeVecCurve__ArcFromBulge([ 0, 0 ], [ 20, 0 ], 10);
        check('a bulge of half the chord is a half circle', !!half && near(half.r, 10) && near(Math.abs(half.sweep), Math.PI), half);
        const through = C.Na__LeVecCurve__BulgeOf([ 0, 0 ], [ 20, 0 ], [ 10, -4 ]);
        check('a point above the chord (up the page) bulges to the chord\'s left', near(through, 4), through);
        const shallow = C.Na__LeVecCurve__ArcFromBulge([ 0, 0 ], [ 20, 0 ], through);
        const mid = shallow ? C.Na__LeVecCurve__ArcPoints(shallow.cx, shallow.cy, shallow.r, shallow.start, shallow.sweep, 2)[1] : null;
        check('...and the arc passes through it', nearPt(mid, [ 10, -4 ], 1e-6), mid);
        const sag = C.Na__LeVecCurve__BulgeForRadius(20, 12.5, 1);
        check('a typed radius becomes the bulge that gives it', near(sag, 5), sag);
        check('a radius too small to span the chord is refused', C.Na__LeVecCurve__BulgeForRadius(20, 9, 1) === null);

        const pts = C.Na__LeVecCurve__ArcPoints(0, 0, 10, 0, Math.PI / 2, 16, { from : [ 10, 0 ], to : [ 0, 10 ] });
        check('an arc ends EXACTLY on the points it was drawn between', pts[0][0] === 10 && pts[0][1] === 0 && pts[16][0] === 0 && pts[16][1] === 10);
        const read = C.Na__LeVecCurve__Describe(pts, false);
        check('an arc reads back', !!read && read.kind === 'arc' && near(read.r, 10) && near(read.sweep, Math.PI / 2) && read.segments === 16 && read.wholeSegments === 64, read);
        const path    = G.Na__LeVecGeo__Path(pts, false);
        const cuts    = G.Na__LeVecGeo__Crossings(path, [ [ 0, 0, 20, 5 ] ]);
        const trimmed = G.Na__LeVecGeo__Trim(path, 0.2, cuts);
        const stub    = trimmed ? C.Na__LeVecCurve__Describe(trimmed.kept[0].points, false) : null;
        check('an arc a trim has cut short still reads as an arc', !!stub && stub.kind === 'arc' && near(stub.r, 10, 1e-5) && stub.sweep < Math.PI / 2, stub);

        let sweep = C.Na__LeVecCurve__CarrySweep(NaN, 0, 3.0);
        sweep = C.Na__LeVecCurve__CarrySweep(sweep, 0, -3.0);
        check('a sweep carried past the half turn keeps going the same way', near(sweep, (Math.PI * 2) - 3.0), sweep);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Offsets and Corners
// -----------------------------------------------------------------------------

    {
        const box = shut([ 0, 0 ], [ 100, 0 ], [ 100, 50 ], [ 0, 50 ]);
        const out = O.Na__LeVecOff__Offset(box, 10);
        const bounds = (pts) => [ Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])) ];
        check('a rectangle offsets to a rectangle', !!out && out.closed === true && out.points.length === 4, out);
        const grown = out ? bounds(out.points) : [];
        const wide  = grown.length ? grown[2] - grown[0] : 0;
        check('...twenty wider or twenty narrower, by which side', near(wide, 120) || near(wide, 80), grown);
        const other = O.Na__LeVecOff__Offset(box, -10);
        const wide2 = other ? bounds(other.points)[2] - bounds(other.points)[0] : 0;
        check('...and the other sign is the other side', near(wide + wide2, 200), [ wide, wide2 ]);
        const inward = near(wide, 80) ? 1 : -1;
        check('offset in by more than half its width, nothing is left', O.Na__LeVecOff__Offset(box, 30 * inward) === null);
        check('the side a point is on has the offset\'s own sign', Math.sign(O.Na__LeVecOff__SideOf(box, [ 50, 25 ])) === inward && Math.sign(O.Na__LeVecOff__SideOf(box, [ 50, -5 ])) === -inward);
        check('...and its distance', near(Math.abs(O.Na__LeVecOff__SideOf(box, [ 50, -5 ])), 5));

        const line = open([ 0, 0 ], [ 100, 0 ], [ 100, 100 ]);
        const left = O.Na__LeVecOff__Offset(line, 10), right = O.Na__LeVecOff__Offset(line, -10);
        check('an open line offsets to a line of as many points', !!left && !!right && left.points.length === 3 && right.points.length === 3 && left.closed === false);
        check('...mitred at its corner', !!left && !!right && ((nearPt(left.points[1], [ 110, -10 ]) && nearPt(right.points[1], [ 90, 10 ])) || (nearPt(left.points[1], [ 90, 10 ]) && nearPt(right.points[1], [ 110, -10 ]))), [ left, right ]);

        const notch = shut([ 0, 0 ], [ 40, 0 ], [ 40, 20 ], [ 44, 20 ], [ 44, 0 ], [ 100, 0 ], [ 100, 60 ], [ 0, 60 ]);
        const eaten = O.Na__LeVecOff__Offset(notch, 5 * -inward);
        check('a notch narrower than the offset is swallowed whole', !!eaten && eaten.points.length < notch.points.length, eaten);

        const spike = O.Na__LeVecOff__Offset(open([ 0, 0 ], [ 100, 0 ], [ 0, 4 ]), 10);
        const flat  = O.Na__LeVecOff__Offset(open([ 0, 0 ], [ 100, 0 ], [ 0, 4 ]), -10);
        check('a corner too sharp to mitre is cut square on its outside', !!spike && !!flat && Math.max(spike.points.length, flat.points.length) === 4, [ spike, flat ]);
    }

    {
        const fillet = O.Na__LeVecOff__CornerFillet([ 0, 0 ], [ 100, 0 ], [ 100, 100 ], 20);
        check('a right angle rounds with its centre square to both edges', fillet.ok && nearPt(fillet.from, [ 80, 0 ]) && nearPt(fillet.to, [ 100, 20 ]) && near(fillet.cx, 80) && near(fillet.cy, 20), fillet);
        check('...through a quarter turn', fillet.ok && near(Math.abs(fillet.sweep), Math.PI / 2), fillet);
        check('an edge too short for the radius is refused', O.Na__LeVecOff__CornerFillet([ 90, 0 ], [ 100, 0 ], [ 100, 100 ], 20).reason === 'long');
        check('a straight run has no corner to round', O.Na__LeVecOff__CornerFillet([ 0, 0 ], [ 50, 0 ], [ 100, 0 ], 5).reason === 'straight');
        const chamfer = O.Na__LeVecOff__CornerChamfer([ 0, 0 ], [ 100, 0 ], [ 100, 100 ], 15);
        check('a chamfer cuts the same distance back along each edge', chamfer.ok && nearPt(chamfer.from, [ 85, 0 ]) && nearPt(chamfer.to, [ 100, 15 ]), chamfer);

        const box     = shut([ 0, 0 ], [ 100, 0 ], [ 100, 50 ], [ 0, 50 ]);
        const rounded = O.Na__LeVecOff__AtVertex('fillet', box, 1, 10, () => 8);
        check('rounding one corner of a rectangle swaps it for an arc', rounded.ok && rounded.closed === true && rounded.points.length === 3 + 9, rounded);
        check('...that starts and ends ON the edges', rounded.ok && nearPt(rounded.points[1], [ 90, 0 ]) && nearPt(rounded.points[9], [ 100, 10 ]), rounded.ok && [ rounded.points[1], rounded.points[9] ]);
        check('the first corner of a closed shape rounds too', O.Na__LeVecOff__AtVertex('fillet', box, 0, 10, () => 8).ok === true);
        check('the end of an open line is not a corner', O.Na__LeVecOff__AtVertex('fillet', open([ 0, 0 ], [ 10, 0 ], [ 10, 10 ]), 0, 2, () => 8).reason === 'corner');
        const cut = O.Na__LeVecOff__AtVertex('chamfer', box, 2, 10);
        check('cutting a corner adds one point', cut.ok && cut.points.length === 5 && nearPt(cut.points[2], [ 100, 40 ]) && nearPt(cut.points[3], [ 90, 50 ]), cut);
        check('the nearest corner is found within reach', O.Na__LeVecOff__NearestCorner(box, { x : 99, y : 1 }, 3) === 1 && O.Na__LeVecOff__NearestCorner(box, { x : 50, y : 25 }, 3) === -1);
    }

    {
        const a = open([ 0, 0 ], [ 80, 0 ]);                                    // <-- Stops short of the corner
        const b = open([ 100, 30 ], [ 100, 90 ]);                               // <-- Starts past it
        const sharp = O.Na__LeVecOff__BetweenEnds('fillet', a, 0.5, b, 0.5, 0, () => 8, false);
        check('no radius: two lines are simply made to meet', sharp.ok && samePts(sharp.points, [ [ 0, 0 ], [ 100, 0 ], [ 100, 90 ] ]), sharp);
        const round = O.Na__LeVecOff__BetweenEnds('fillet', a, 0.5, b, 0.5, 10, () => 8, false);
        check('a radius: one path, line, arc, line', round.ok && round.closed === false && round.points.length === 1 + 9 + 1 && nearPt(round.points[1], [ 90, 0 ]) && nearPt(round.points[9], [ 100, 10 ]), round);
        const crossing = O.Na__LeVecOff__BetweenEnds('chamfer', open([ 0, 0 ], [ 130, 0 ]), 0.2, open([ 100, -40 ], [ 100, 90 ]), 0.8, 10, null, false);
        check('lines that overshoot are cut back, the clicked sides kept', crossing.ok && samePts(crossing.points, [ [ 0, 0 ], [ 90, 0 ], [ 100, 10 ], [ 100, 90 ] ]), crossing);
        check('parallel lines make no corner', O.Na__LeVecOff__BetweenEnds('fillet', a, 0.5, open([ 0, 10 ], [ 80, 10 ]), 0.5, 5, () => 8, false).reason === 'parallel');
        check('a middle edge is not an end', O.Na__LeVecOff__BetweenEnds('fillet', open([ 0, 0 ], [ 0, 10 ], [ 30, 10 ], [ 30, 20 ]), 1.5, b, 0.5, 2, () => 8, false).reason === 'ends');
        const cee = open([ 0, 10 ], [ 0, 60 ], [ 100, 60 ], [ 100, 0 ], [ 20, 0 ]);
        const closed = O.Na__LeVecOff__BetweenEnds('fillet', cee, 3.5, cee, 0.5, 0, () => 8, true);
        check('one path\'s own two ends close into a shape', closed.ok && closed.closed === true && samePts(closed.points, [ [ 0, 60 ], [ 100, 60 ], [ 100, 0 ], [ 0, 0 ] ]), closed);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Keys
// -----------------------------------------------------------------------------

    {
        // The key map unit as shipped, its one import (the config key prefix)
        // swapped for the constant it names.
        const CONFIG  = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor', '03__Core__Config');
        const keySrc  = readFileSync(resolve(CONFIG, 'Na__LayoutEditor__ConfigState__KeyMap__.js'), 'utf8').replace(/\r\n/g, '\n')
            .replace(/^[ \t]*import\s+\{[^}]*\}\s+from\s+'[^']+';[^\n]*$/gm, '');
        check('the key map unit has only the one import to swap', !/^\s*import\s/m.test(keySrc));
        writeFileSync(join(SCRATCH, 'KeyMap.mjs'), "const Na__LeCfg__PREFIX = 'LayoutEditor__';\n" + keySrc, 'utf8');
        const K       = await import(pathToFileURL(join(SCRATCH, 'KeyMap.mjs')).href);
        const shipped = JSON.parse(readFileSync(resolve(CONFIG, 'Na__Hotkeys__DrawingTabs__.json'), 'utf8'));
        const held    = (names) => ({ Ctrl : names.indexOf('Ctrl') !== -1, Shift : names.indexOf('Shift') !== -1, Alt : false, Meta : false, Space : false });
        const action  = (key, mods, context) => { const match = K.Na__LeCfg__MatchKeyBinding(key, held(mods || []), context); return match ? match.action : null; };
        const WANT = [ [ 'c', [], 'Tool__Circle' ], [ 'A', [ 'Shift' ], 'Tool__Arc' ], [ 'T', [ 'Shift' ], 'Tool__Extend' ], [ 'j', [], 'Tool__Join' ], [ 'u', [], 'Tool__Split' ],
                       [ 'f', [], 'Tool__Offset' ], [ 'F', [ 'Shift' ], 'Tool__Fillet' ], [ 'C', [ 'Shift' ], 'Tool__Chamfer' ],
                       [ 'a', [], 'Tool__FloorArea' ], [ 'c', [ 'Ctrl' ], 'Edit__Copy' ], [ 'l', [], 'Tool__Draw' ] ];
        [ [ 'the shipped key file', shipped ], [ 'the built-in fallback', null ] ].forEach((pair) => {
            K.Na__LeCfg__SetKeyMap(pair[1]);
            WANT.forEach((row) => check(pair[0] + ': ' + (row[1].length ? row[1].join('+') + '+' : '') + row[0] + ' is ' + row[2], action(row[0], row[1]) === row[2], action(row[0], row[1])));
            check(pair[0] + ': T is the Text tool when the caller says nothing of containers', action('t', []) === 'Tool__Text', action('t', []));
            check(pair[0] + ': ...and when it says none is open', action('t', [], { InContainer : false }) === 'Tool__Text');
            check(pair[0] + ': T is the Trim tool while a container is open', action('t', [], { InContainer : true }) === 'Tool__Trim', action('t', [], { InContainer : true }));
            check(pair[0] + ': ...where Shift+T is still Extend', action('T', [ 'Shift' ], { InContainer : true }) === 'Tool__Extend');
        });
        K.Na__LeCfg__SetKeyMap(null);
        const catalogue = shipped.LayoutEditor__Actions__Config.LayoutEditor__Actions__List.map((entry) => entry.Action);
        check('every vector tool is in the key file\'s action catalogue', [ 'Tool__Circle', 'Tool__Arc', 'Tool__Trim', 'Tool__Extend', 'Tool__Join', 'Tool__Split', 'Tool__Offset', 'Tool__Fillet', 'Tool__Chamfer' ].every((name) => catalogue.indexOf(name) !== -1));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('\nVector tools: ' + passed + ' passed, ' + failed + ' failed.');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
