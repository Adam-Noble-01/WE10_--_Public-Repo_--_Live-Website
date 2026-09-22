// =============================================================================
// TRUEVISION3D - TEST - THE BOOLEAN TOOLS AND VECTORS WITH HOLES (ISLANDS)
// =============================================================================
//
// FILE       : Na__Test__VectorBooleans__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Vector Booleans Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Boolean section (Union, Subtract, Trim, Intersect, Split, Outer Shell) makes what SketchUp's Solid Tools make, and that a vector with holes is stored, cleaned, hit, snapped and painted - screen and PDF - with its holes left bare
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE RINGS LEAF (Na__LayoutEditor__ShapeRings__), as shipped: where each
//   hole begins, the edges each ring closes on itself, a point in a hole is
//   not inside, and inserting or deleting a point moves the holes after it.
// - THE BOOLEAN GEOMETRY (Na__LayoutEditor__VectorTools__Boolean__), as
//   shipped, against the real vendored Clipper2: walls that only share an
//   edge unite into ONE outline (the port's repeated points stopped that once
//   - see the module's Run); a cut in the middle is a hole, a cut across is
//   two pieces; an island in a hole is a piece of its own; Outer Shell fills;
//   Split gives each piece its owners; a corner that went in comes back bit
//   for bit, and a new one lies exactly on the edges it was cut where; a
//   hairline is not kept. Then at random: every union's piece count is its
//   count of touching clusters, and every result is sampled against the
//   answer point by point.
// - THE RECORD: Shape__Holes is kept only while it holds a hole, only on a
//   plain vector, and holds the shape closed.
// - THE SHAPE GEOMETRY AND THE PAINTERS, as shipped with their outside
//   stubbed: a holed shape's edges, inside, nearest edge and the far end of
//   an edge; the patches for inserting and deleting a point; the SVG writes a
//   subpath per ring and fill-rule evenodd; the PDF traces every ring and
//   fills f* / B*; the hatch and the gradient clip even-odd. A plain shape's
//   markup and drawing calls are exactly what they were.
// - THE SIX TOOLS' PLANS (Na__LayoutEditor__VectorTools__BooleanTool__) with
//   the model stubbed: by clicking, SketchUp's order (the first clicked is
//   Subtract's cutter, and Trim's, which stays); on a selection, the paint
//   order (the back shape is the one cut and kept); the refusals.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__VectorBooleans__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the Boolean section and holed vectors.
//
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';


// -----------------------------------------------------------------------------
// REGION | Loading and Checking
// -----------------------------------------------------------------------------

    const HERE    = path.dirname(fileURLToPath(import.meta.url));
    const APP     = path.resolve(HERE, '..');
    const SRC     = path.resolve(APP, '02__Src__AppModules');
    const LE      = '51__System__LayoutEditor/';
    const CLIPPER = pathToFileURL(path.resolve(APP, '04__Lib__ThirdParty__VersionLocked/03__Vendor__Clipper2Js__v0.9.0/fesm2020/clipper2-js.mjs')).href;
    const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-vectorbooleans-'));

    // THE SHIPPED FILE with its imports swapped for stubs - the way the other
    // suites load a module - or, for the Boolean geometry, with only its path
    // to Clipper made absolute, so it runs against the real vendored library.
    // ------------------------------------------------------------
    function load(relative, stubs, tag) {
        let src = fs.readFileSync(path.resolve(SRC, relative), 'utf8');
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (/^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = path.join(SCRATCH, tag + '.mjs');
        fs.writeFileSync(tmp, (stubs || '') + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href);
    }
    function loadBoolean() {
        const src = fs.readFileSync(path.resolve(SRC, LE + '37__System__VectorTools/Na__LayoutEditor__VectorTools__Boolean__.js'), 'utf8')
            .replace("'../../../04__Lib__ThirdParty__VersionLocked/03__Vendor__Clipper2Js__v0.9.0/fesm2020/clipper2-js.mjs'", "'" + CLIPPER + "'");
        if (src.indexOf(CLIPPER) === -1) { console.error('FAIL: the Boolean module no longer imports Clipper by the path this suite expects'); process.exit(1); }
        const tmp = path.join(SCRATCH, 'Boolean.mjs');
        fs.writeFileSync(tmp, src, 'utf8');
        return import(pathToFileURL(tmp).href);
    }

    let passed = 0, failed = 0;
    function check(name, ok, detail) {
        if (ok) { passed++; return; }
        failed++;
        console.error('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const same   = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const near   = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol);
    const square = (x, y, w, h) => [ [ x, y ], [ x + w, y ], [ x + w, y + h ], [ x, y + h ] ];
    const plain  = (ring) => ({ rings : [ ring ], evenOdd : false });

    const R  = await load(LE + '15__Core__Markup/Na__LayoutEditor__ShapeRings__.js', '', 'Rings');
    const B  = await loadBoolean();
    globalThis.__R = R;
    globalThis.__B = B;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Rings Leaf
// -----------------------------------------------------------------------------

    {
        check('no holes, no key: a plain run is one ring', same(R.Na__LeRings__Clean(8, undefined, true), []));
        check('an open run has no holes whatever it says', same(R.Na__LeRings__Clean(8, [ 4 ], false), []));
        check('a start that leaves both rings three points or more is kept', same(R.Na__LeRings__Clean(8, [ 4 ], true), [ 4 ]));
        check('a start that would leave a ring of two drops out; out of order and not whole numbers too',
            same(R.Na__LeRings__Clean(10, [ 2, 4, 3, 7.5, 7 ], true), [ 4, 7 ]), R.Na__LeRings__Clean(10, [ 2, 4, 3, 7.5, 7 ], true));
        check('a start too near the end drops out', same(R.Na__LeRings__Clean(8, [ 6 ], true), []));

        const pts = square(0, 0, 100, 100).concat(square(25, 25, 50, 50));
        const flat = R.Na__LeRings__Flatten([ square(0, 0, 100, 100), square(25, 25, 50, 50), [ [ 1, 1 ], [ 2, 2 ] ] ]);
        check('Flatten: the outline, then each hole, and a ring of two left out', same(flat, { points : pts, holes : [ 4 ] }), flat);
        check('Split gives the rings back', same(R.Na__LeRings__Split(pts, [ 4 ]), [ square(0, 0, 100, 100), square(25, 25, 50, 50) ]));
        check('Spans are [start, end) per ring', same(R.Na__LeRings__Spans(8, [ 4 ]), [ [ 0, 4 ], [ 4, 8 ] ]));

        const edges = R.Na__LeRings__Edges(8, [ 4 ], true);
        check('each ring closes on itself: eight edges, none from the outline to the hole',
            same(edges, [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 0 ], [ 4, 5 ], [ 5, 6 ], [ 6, 7 ], [ 7, 4 ] ]), edges);
        check('a plain closed run: the old n edges, the last back to the first', same(R.Na__LeRings__Edges(4, [], true), [ [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 3, 0 ] ]));
        check('an open run: n - 1 edges', same(R.Na__LeRings__Edges(3, [], false), [ [ 0, 1 ], [ 1, 2 ] ]));
        check('Next wraps inside its own ring', [ R.Na__LeRings__Next(8, [ 4 ], 3, true), R.Na__LeRings__Next(8, [ 4 ], 7, true), R.Na__LeRings__Next(8, [ 4 ], 5, true) ].join() === '0,4,6');
        check('Prev wraps inside its own ring', [ R.Na__LeRings__Prev(8, [ 4 ], 0, true), R.Na__LeRings__Prev(8, [ 4 ], 4, true) ].join() === '3,7');
        check('the end of an open run runs nowhere', R.Na__LeRings__Next(3, [], 2, false) === -1);

        check('a point in the solid part is inside', R.Na__LeRings__Contains(pts, [ 4 ], 10, 10) === true);
        check('a point in the hole is NOT inside', R.Na__LeRings__Contains(pts, [ 4 ], 50, 50) === false);
        check('a point outside is not inside', R.Na__LeRings__Contains(pts, [ 4 ], 150, 50) === false);
        check('the area is the outline\'s less the hole\'s, either way round', near(R.Na__LeRings__Area(pts, [ 4 ]), 7500) && near(R.Na__LeRings__Area(square(0, 0, 100, 100).reverse().concat(square(25, 25, 50, 50)), [ 4 ]), 7500));

        check('a point put in on the outline moves the hole up one', same(R.Na__LeRings__AfterInsert([ 4 ], 1), [ 5 ]));
        check('a point put in on the outline\'s CLOSING edge still moves it (it goes at the end of the outline)', same(R.Na__LeRings__AfterInsert([ 4 ], 3), [ 5 ]));
        check('a point put in on the hole leaves its start where it is', same(R.Na__LeRings__AfterInsert([ 4 ], 5), [ 4 ]));

        const lessOne = R.Na__LeRings__Remove(pts, [ 4 ], [ 1 ], 2);
        check('taking an outline corner out moves the hole down one', same(lessOne.holes, [ 3 ]) && lessOne.points.length === 7, lessOne);
        const holeGone = R.Na__LeRings__Remove(pts, [ 4 ], [ 5, 6 ], 2);
        check('a hole left with fewer than three corners goes whole', same(holeGone, { points : square(0, 0, 100, 100), holes : [] }), holeGone);
        check('the outline is never taken below the floor', R.Na__LeRings__Remove(pts, [ 4 ], [ 0, 1, 2 ], 2) === null);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Boolean Geometry, on the Shapes an Architect Draws
// -----------------------------------------------------------------------------

    const area = (piece) => B.Na__LeVecBool__Area(piece);
    {
        // THREE WALLS SNAPPED TOGETHER - a T and an L - that only share edges
        const walls = B.Na__LeVecBool__Union([ plain(square(0, 0, 10, 100)), plain(square(10, 0, 40, 10)), plain(square(-50, 50, 50, 5)) ]);
        check('walls that only share edges unite into ONE outline, no hole, no straight-through corner',
            walls.length === 1 && walls[0].holes.length === 0 && walls[0].outline.length === 10 && near(area(walls[0]), 1650), walls.map((p) => [ p.outline.length, area(p) ]));

        const frame = B.Na__LeVecBool__Union([ plain(square(0, 0, 100, 10)), plain(square(90, 0, 10, 100)), plain(square(0, 90, 100, 10)), plain(square(0, 0, 10, 100)) ]);
        check('four walls round a room unite into one outline with the room as its hole',
            frame.length === 1 && frame[0].holes.length === 1 && near(area(frame[0]), 3600) && frame[0].outline.length === 4 && frame[0].holes[0].length === 4, frame.map((p) => [ p.outline.length, p.holes.length, area(p) ]));
        const shell = B.Na__LeVecBool__OuterShell([ plain(square(0, 0, 100, 10)), plain(square(90, 0, 10, 100)), plain(square(0, 90, 100, 10)), plain(square(0, 0, 10, 100)) ]);
        check('Outer Shell fills it', shell.length === 1 && shell[0].holes.length === 0 && near(area(shell[0]), 10000));

        const holed = B.Na__LeVecBool__Subtract(plain(square(0, 0, 100, 100)), [ plain(square(25, 25, 50, 50)) ]);
        check('a cut in the middle is a hole', holed.length === 1 && holed[0].holes.length === 1 && near(area(holed[0]), 7500));
        const across = B.Na__LeVecBool__Subtract(plain(square(0, 0, 100, 20)), [ plain(square(40, -5, 20, 30)) ]);
        check('a cut right across leaves two pieces, biggest first', across.length === 2 && near(area(across[0]), 800) && near(area(across[1]), 800));
        const unequal = B.Na__LeVecBool__Subtract(plain(square(0, 0, 100, 20)), [ plain(square(30, -5, 10, 30)) ]);
        check('the bigger piece comes first', unequal.length === 2 && near(area(unequal[0]), 1200) && near(area(unequal[1]), 600));
        const nothing = B.Na__LeVecBool__Subtract(plain(square(10, 10, 5, 5)), [ plain(square(0, 0, 50, 50)) ]);
        check('a shape cut away whole leaves nothing', nothing.length === 0);

        const both = B.Na__LeVecBool__Intersect([ plain(square(0, 0, 10, 10)), plain(square(5, 5, 10, 10)) ]);
        check('Intersect leaves what both cover', both.length === 1 && near(area(both[0]), 25));
        check('Intersect of three is what all three cover', near(area(B.Na__LeVecBool__Intersect([ plain(square(0, 0, 10, 10)), plain(square(5, 0, 10, 10)), plain(square(0, 5, 10, 10)) ])[0]), 25));
        check('shapes that only touch share nothing', B.Na__LeVecBool__Overlaps(plain(square(0, 0, 10, 10)), plain(square(10, 0, 10, 10))) === false
            && B.Na__LeVecBool__Overlaps(plain(square(0, 0, 10, 10)), plain(square(10, 10, 10, 10))) === false
            && B.Na__LeVecBool__Overlaps(plain(square(0, 0, 10, 10)), plain(square(9, 0, 10, 10))) === true);

        const faces = B.Na__LeVecBool__Divide([ plain(square(0, 0, 10, 10)), plain(square(5, 5, 10, 10)) ]);
        const byOwners = {};
        faces.forEach((face) => { byOwners[face.owners.join('+')] = face.pieces.reduce((s, p) => s + area(p), 0); });
        check('Split: each one\'s own part and the part they share, each with its owners', same(Object.keys(byOwners).sort(), [ '0', '0+1', '1' ]) && near(byOwners['0'], 75) && near(byOwners['1'], 75) && near(byOwners['0+1'], 25), byOwners);

        // AN ISLAND IN A HOLE: a slab with a room in it, and a column in the room
        const nest = { rings : [ square(0, 0, 100, 100), square(20, 20, 60, 60), square(40, 40, 20, 20) ], evenOdd : true };
        const nested = B.Na__LeVecBool__Union([ nest ]);
        check('an island in a hole is a piece of its own, one level in', nested.length === 2 && nested[0].holes.length === 1 && nested[1].depth === 1 && near(area(nested[0]), 6400) && near(area(nested[1]), 400),
            nested.map((p) => [ p.holes.length, p.depth, area(p) ]));
        check('Outer Shell of it is the slab, whole: the island goes with the hole it stood in', (() => { const s = B.Na__LeVecBool__OuterShell([ nest ]); return s.length === 1 && near(area(s[0]), 10000); })());

        // A HOLED SHAPE GOES IN AS WHAT IS DRAWN
        const ring = { rings : [ square(0, 0, 100, 100), square(25, 25, 50, 50) ], evenOdd : true };
        check('a holed shape united with a bar across its hole: the bar fills that strip of the hole',
            (() => { const u = B.Na__LeVecBool__Union([ ring, plain(square(20, 45, 60, 10)) ]); return u.length === 1 && u[0].holes.length === 2 && near(area(u[0]), 7500 + 500); })());
        check('a holed shape intersected with a square over its hole keeps only the solid part under the square',
            (() => { const i = B.Na__LeVecBool__Intersect([ ring, plain(square(0, 0, 50, 50)) ]); return i.length === 1 && near(area(i[0]), 2500 - 625); })());

        // DIRECTION DOES NOT MATTER: one square drawn each way round
        const mixed = B.Na__LeVecBool__Union([ plain(square(0, 0, 10, 10).reverse()), plain(square(5, 5, 10, 10)) ]);
        check('a square drawn anticlockwise unites with one drawn clockwise (not an exclusion)', mixed.length === 1 && near(area(mixed[0]), 175), mixed.map(area));

        // A LOOP OVER ITSELF, read as the screen fills it (non-zero)
        const bow = B.Na__LeVecBool__Union([ plain([ [ 0, 0 ], [ 10, 10 ], [ 10, 0 ], [ 0, 10 ] ]) ]);
        check('a bow-tie is its two triangles', bow.length === 2 && near(area(bow[0]) + area(bow[1]), 50));

        // CIRCLES: a ring of brickwork round a column
        const circle = (cx, cy, r, n) => { const out = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; out.push([ cx + (r * Math.cos(a)), cy + (r * Math.sin(a)) ]); } return out; };
        const polyArea = (ring2) => { let a = 0; for (let i = 0, j = ring2.length - 1; i < ring2.length; j = i++) a += (ring2[j][0] * ring2[i][1]) - (ring2[i][0] * ring2[j][1]); return Math.abs(a / 2); };
        const outer = circle(50, 50, 40, 180), inner = circle(50, 50, 20, 120);
        const annulus = B.Na__LeVecBool__Subtract(plain(outer), [ plain(inner) ]);
        check('a circle less a circle is a ring: one piece, one hole, the area of the two polygons', annulus.length === 1 && annulus[0].holes.length === 1 && near(area(annulus[0]), polyArea(outer) - polyArea(inner), 1e-3), annulus.map(area));
        check('...and every one of the outer circle\'s corners came back exactly', annulus[0].outline.every((p) => outer.some((q) => q[0] === p[0] && q[1] === p[1])));

        // EXACTNESS
        const odd = B.Na__LeVecBool__Union([ plain(square(12.3456789, 7.654321, 20.5, 3.3)), plain(square(20, 5, 5, 5)) ]);
        const pts = odd[0].outline;
        check('a corner that went in comes back bit for bit', pts.some((p) => p[0] === 12.3456789 && p[1] === 7.654321) && pts.some((p) => p[0] === 20 && p[1] === 5));
        check('a new corner lies on the edge it was cut where, not on Clipper\'s grid (7.654321, not 7.6543)',
            pts.filter((p) => p[0] === 20 || p[0] === 25).filter((p) => p[1] > 7 && p[1] < 8).every((p) => near(p[1], 7.654321, 1e-12)), pts);
        check('a hairline between two walls placed by eye is not kept as a hole',
            (() => { const u = B.Na__LeVecBool__Union([ plain(square(0, 0, 30, 10)), plain(square(0, 10, 10, 10)), plain(square(20, 10, 10, 10)), plain(square(0, 20, 30, 10)), plain(square(10.0000002, 10.0000002, 9.9999996, 9.9999996)) ]); return u.length === 1 && u[0].holes.length === 0; })());

        const rec = B.Na__LeVecBool__ToRecord(holed[0]);
        check('a piece in the record\'s form: the outline, then the hole, and where the hole begins', rec.points.length === 8 && same(rec.holes, [ 4 ]));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Boolean Geometry, at Random
// -----------------------------------------------------------------------------

    {
        let seed = 20260922;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        const inRing = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ xi, yi ] = ring[i], [ xj, yj ] = ring[j]; if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c; } return c; };
        const inPieces = (pieces, x, y) => pieces.some((p) => inRing(p.outline, x, y) && !p.holes.some((h) => inRing(h, x, y)));
        const inShape = (shape, x, y) => shape.rings.filter((ring) => inRing(ring, x, y)).length % 2 === 1;
        const onAnyEdge = (shapes, x, y) => shapes.some((s) => s.rings.some((ring) => ring.some((a, i) => {
            const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l = (dx * dx) + (dy * dy);
            const t = l ? Math.max(0, Math.min(1, (((x - a[0]) * dx) + ((y - a[1]) * dy)) / l)) : 0;
            return Math.hypot(x - (a[0] + (dx * t)), y - (a[1] + (dy * t))) < 1e-3;
        })));
        const gridRect = (g) => { const x = Math.floor(rnd() * 8) * g, y = Math.floor(rnd() * 8) * g; const w = (1 + Math.floor(rnd() * 4)) * g, h = (1 + Math.floor(rnd() * 4)) * g; return { box : [ x, y, x + w, y + h ], rings : [ square(x, y, w, h) ], evenOdd : false }; };
        const star = () => { const cx = rnd() * 60, cy = rnd() * 60, n = 5 + Math.floor(rnd() * 7), ring = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, r = 8 + (rnd() * 25); ring.push([ cx + (r * Math.cos(a)), cy + (r * Math.sin(a)) ]); } return { rings : [ ring ], evenOdd : false }; };
        const holedRect = () => { const x = rnd() * 40, y = rnd() * 40, w = 20 + rnd() * 30, h = 20 + rnd() * 30; return { rings : [ square(x, y, w, h), square(x + (w * 0.25), y + (h * 0.25), w * 0.5, h * 0.5) ], evenOdd : true }; };

        // UNIONS OF GRID-SNAPPED WALLS: one piece per cluster of walls that overlap or share an edge
        let clusterBad = 0, clusterRuns = 0;
        for (let t = 0; t < 600; t++) {
            const g = 5 + (Math.floor(rnd() * 3) * 0.1234567), n = 2 + Math.floor(rnd() * 6);
            const rects = []; for (let k = 0; k < n; k++) rects.push(gridRect(g));
            const parent = rects.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
            const snap = (v) => (Math.abs(v) < 1e-9 ? 0 : v);
            for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
                const a = rects[i].box, b = rects[j].box;
                const ox = snap(Math.min(a[2], b[2]) - Math.max(a[0], b[0])), oy = snap(Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
                if ((ox > 0 && oy >= 0) || (oy > 0 && ox >= 0)) parent[find(i)] = find(j);
            }
            const clusters = new Set(rects.map((_, i) => find(i))).size;
            clusterRuns++;
            if (B.Na__LeVecBool__Union(rects).length !== clusters) clusterBad++;
        }
        check('600 random unions of grid-snapped walls: one piece per cluster of walls that touch along an edge or overlap', clusterBad === 0, { clusterBad, clusterRuns });

        // EVERY OPERATION, SAMPLED: stars, walls and holed squares
        let sampled = 0, wrong = 0, runs = 0;
        const pick = () => { const r = rnd(); return r < 0.4 ? gridRect(7) : (r < 0.75 ? star() : holedRect()); };
        for (let t = 0; t < 400; t++) {
            const a = pick(), b = pick(), c = pick();
            const cases = [
                [ B.Na__LeVecBool__Union([ a, b, c ]), (x, y) => inShape(a, x, y) || inShape(b, x, y) || inShape(c, x, y) ],
                [ B.Na__LeVecBool__Intersect([ a, b ]), (x, y) => inShape(a, x, y) && inShape(b, x, y) ],
                [ B.Na__LeVecBool__Subtract(a, [ b, c ]), (x, y) => inShape(a, x, y) && !inShape(b, x, y) && !inShape(c, x, y) ]
            ];
            B.Na__LeVecBool__Divide([ a, b ]).forEach((face) => {
                const key = face.owners.join('+');
                cases.push([ face.pieces, (x, y) => (key === '0' ? inShape(a, x, y) && !inShape(b, x, y) : (key === '1' ? inShape(b, x, y) && !inShape(a, x, y) : inShape(a, x, y) && inShape(b, x, y))) ]);
            });
            cases.forEach(([ pieces, want ]) => {
                runs++;
                for (let s = 0; s < 60; s++) {
                    const x = -10 + (rnd() * 110), y = -10 + (rnd() * 110);
                    if (onAnyEdge([ a, b, c ], x, y)) continue;
                    sampled++;
                    if (inPieces(pieces, x, y) !== want(x, y)) wrong++;
                }
            });
        }
        check('every Union, Intersect, Subtract and Split piece of 400 random trios - stars, walls, holed squares - is right at every sampled point', wrong === 0, { wrong, sampled, runs });
        check('...and the random runs really ran (a pass over nothing proves nothing)', clusterRuns === 600 && runs >= 1600 && sampled > 50000, { clusterRuns, runs, sampled });
        console.log('  note  random: ' + clusterRuns + ' unions counted, ' + runs + ' results sampled at ' + sampled + ' points');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    {
        const recSource = fs.readFileSync(path.resolve(SRC, LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js'), 'utf8');
        const at = recSource.indexOf('function Na__LeRec__NormaliseShapeHoles(');
        let depth = 0, end = -1;
        for (let i = recSource.indexOf('{', at); i < recSource.length; i++) {
            if (recSource[i] === '{') depth++;
            else if (recSource[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        const holesOf = new Function('Na__LeRings__Clean', recSource.slice(at, end) + '\nreturn Na__LeRec__NormaliseShapeHoles;')(R.Na__LeRings__Clean);
        const run = (item) => { holesOf(item); return item; };
        const pts = square(0, 0, 100, 100).concat(square(25, 25, 50, 50));
        check('a plain shape gets no key', !('Shape__Holes' in run({ Shape__Points : pts, Shape__Closed : true })));
        check('an empty list is no key', !('Shape__Holes' in run({ Shape__Points : pts, Shape__Closed : true, Shape__Holes : [] })));
        check('a good start is kept', same(run({ Shape__Points : pts, Shape__Closed : true, Shape__Holes : [ 4 ] }).Shape__Holes, [ 4 ]));
        check('a shape with a hole is held closed', run({ Shape__Points : pts, Shape__Closed : false, Shape__Holes : [ 4 ] }).Shape__Closed === true);
        check('a start that holds no hole goes, key and all', !('Shape__Holes' in run({ Shape__Points : pts, Shape__Closed : true, Shape__Holes : [ 7 ] })));
        check('a picture, a QR box and a room keep no holes', [ 'Shape__Image', 'Shape__Qr', 'Shape__Area' ].every((key) => { const item = { Shape__Points : pts, Shape__Closed : true, Shape__Holes : [ 4 ] }; item[key] = {}; return !('Shape__Holes' in run(item)); }));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Shape Geometry and the Painters
// -----------------------------------------------------------------------------

    const RING_STUBS = `
        const { Na__LeRings__Of, Na__LeRings__Edges, Na__LeRings__Next, Na__LeRings__Split, Na__LeRings__Contains, Na__LeRings__AfterInsert, Na__LeRings__Remove, Na__LeRings__Spans } = globalThis.__R;
    `;
    const CHROME_STUBS = RING_STUBS + `
        const Na__LeGrad__SvgPaint      = () => null;
        const Na__LeGrad__DrawPdf       = (...a) => { (globalThis.__gradCalls = globalThis.__gradCalls || []).push(a); return true; };
        const Na__LeHatch__Get          = () => null;
        const Na__LeHatch__SvgPaint     = () => null;
        const Na__LeHatch__DrawPdf      = () => false;
        const Na__QrPaint__SvgGroup     = () => '';
        const Na__QrPaint__DrawPdf      = () => {};
        const Na__LeImgPaint__KIND      = 'picture';
        const Na__LeImgPaint__Svg       = () => '';
        const Na__LeImgPaint__DrawPdf   = () => {};
        const Na__LeScale__FormatLabel  = (d) => '1:' + d;
        const Na__LeModel__ResolveViewportSource = () => null;
        const Na__LeModel__IsLayerVisible = () => true;
        const Na__LeModel__KIND_2D      = '2d';
        const Na__LeTitleModern__Build  = () => {};
        const Na__LeTitleClassic__Build = () => {};
        const Na__LePdfFonts__Install   = () => {};
        const Na__LePdfFonts__SetFont   = () => {};
        const Na__LeCfg__GetStyleSetup  = () => ({ fontFamily : 'Open Sans', inkColour : '#172b3a' });
        const Na__LeCfg__GetSheetSetup  = () => ({});
        const Na__LeVpRot__Deg = () => 0, Na__LeVpRot__Centre = () => ({ x : 0, y : 0 }), Na__LeVpRot__WrapDeg = (d) => d, Na__LeVpRot__PdfTurn = () => {};
        globalThis.window   = globalThis.window   || { addEventListener () {}, dispatchEvent () {} };
        globalThis.document = globalThis.document || { createElement : () => ({ style : {}, setAttribute () {}, appendChild () {} }), head : { appendChild () {} } };
        globalThis.Image    = globalThis.Image    || class {};
    `;
    const SHAPE_STUBS = RING_STUBS + `
        const Na__LeCfg__PtToMm          = (pt) => pt * 25.4 / 72;
        const Na__LeDash__PatternMm      = () => [];
        const Na__LeChrome__PushPolyline = (...a) => globalThis.__CH.Na__LeChrome__PushPolyline(...a);
        const Na__LeChrome__PushQr       = () => {};
        const Na__ProjectQr__GetSymbol   = () => null;
        const Na__ProjectQr__GetSetup    = () => ({ symbol : {} });
        const Na__ProjectQr__CheckPrint  = () => {};
        const Na__LeImgDraw__Push        = () => false;
    `;
    const CH = await load(LE + '10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js', CHROME_STUBS, 'Chrome');
    globalThis.__CH = CH;
    const G = await load(LE + '15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js', SHAPE_STUBS, 'ShapeGeo');
    globalThis.__G = G;

    // A recording stand-in for jsPDF: every call is kept, in order.
    function fakeDoc() {
        const calls = [];
        const doc = new Proxy({}, { get (target, prop) {
            if (prop === 'calls') return calls;
            if (prop === 'GState') return function (o) { return o; };
            return (...args) => { calls.push([ prop ].concat(args)); return doc; };
        } });
        return doc;
    }

    const holedShape = (extra) => Object.assign({ Shape__Id : 'h1', Shape__Points : square(0, 0, 100, 100).concat(square(25, 25, 50, 50)), Shape__Holes : [ 4 ], Shape__Closed : true,
        Shape__Stroked : true, Shape__StrokeColour : '#333333', Shape__StrokePt : 0.5, Shape__FillColour : '#cccccc', Shape__FillOpacity : 1, Shape__StrokeOpacity : 1 }, extra || {});
    const plainShape = () => ({ Shape__Id : 'p1', Shape__Points : square(0, 0, 100, 100), Shape__Closed : true,
        Shape__Stroked : true, Shape__StrokeColour : '#333333', Shape__StrokePt : 0.5, Shape__FillColour : '#cccccc', Shape__FillOpacity : 1, Shape__StrokeOpacity : 1 });

    {
        const h = holedShape();
        check('Segments: eight, each ring closed on itself', G.Na__LeShapeGeo__Segments(h).length === 8 && !G.Na__LeShapeGeo__Segments(h).some((s) => same(s, [ [ 0, 100 ], [ 25, 25 ] ])));
        check('a plain shape\'s Segments are what they were', same(G.Na__LeShapeGeo__Segments(plainShape()), [ [ [ 0, 0 ], [ 100, 0 ] ], [ [ 100, 0 ], [ 100, 100 ] ], [ [ 100, 100 ], [ 0, 100 ] ], [ [ 0, 100 ], [ 0, 0 ] ] ]));
        check('a click in the hole does not hit the fill; a click in the solid part does', G.Na__LeShapeGeo__Hit(h, { x : 50, y : 50 }, 0.5) === false && G.Na__LeShapeGeo__Hit(h, { x : 10, y : 50 }, 0.5) === true);
        check('the hole\'s own edge is an edge you can hit', G.Na__LeShapeGeo__Hit(h, { x : 25.2, y : 50 }, 0.5) === true);
        check('no phantom edge from the outline to the hole: the middle of that gap is not near an edge', G.Na__LeShapeGeo__DistanceToEdge(h, { x : 12.5, y : 62.5 }) > 5);
        const onHole = G.Na__LeShapeGeo__ClosestOnEdge(h, { x : 26, y : 50 });
        check('the nearest edge can be the hole\'s closing edge, named by the vertex it starts at', onHole.index === 7 && near(onHole.x, 25), onHole);
        check('and its far end is the hole\'s first point, not the outline\'s', G.Na__LeShapeGeo__EdgeEnd(h, 7) === 4 && G.Na__LeShapeGeo__EdgeEnd(h, 3) === 0 && G.Na__LeShapeGeo__EdgeEnd(plainShape(), 3) === 0);
        check('EdgePairs name every edge by its two points', same(G.Na__LeShapeGeo__EdgePairs(h).slice(3, 5), [ [ 3, 0 ], [ 4, 5 ] ]));
        check('Rings gives the outline then the hole', G.Na__LeShapeGeo__Rings(h).length === 2 && G.Na__LeShapeGeo__Rings(plainShape()).length === 1);
        check('a point put in on the outline sends the hole one further on; a plain shape sends nothing',
            same(G.Na__LeShapeGeo__HolesAfterInsert(h, 1), [ 5 ]) && G.Na__LeShapeGeo__HolesAfterInsert(plainShape(), 1) === undefined);
        const cut = G.Na__LeShapeGeo__RemoveVertices(h, [ 4, 5 ], 2);
        check('deleting two of the hole\'s corners takes the hole away', same(cut, { points : square(0, 0, 100, 100), holes : [] }), cut);
        check('deleting from a plain shape patches only the points, as before', same(G.Na__LeShapeGeo__RemoveVertices(plainShape(), [ 0 ], 2), { points : square(0, 0, 100, 100).slice(1) }));
        check('and never below the floor', G.Na__LeShapeGeo__RemoveVertices(plainShape(), [ 0, 1, 2 ], 2) === null);
    }

    {
        const listH = []; G.Na__LeShapeGeo__Push(listH, holedShape());
        const listP = []; G.Na__LeShapeGeo__Push(listP, plainShape());
        check('a holed shape\'s primitive carries its holes; a plain one\'s has no such key', same(listH[0].Holes, [ 4 ]) && !('Holes' in listP[0]));
        const svgH = CH.Na__LeChrome__ToSvgMarkup(listH, 120, 120, 'na-test');
        const svgP = CH.Na__LeChrome__ToSvgMarkup(listP, 120, 120, 'na-test');
        check('the SVG draws each ring as its own closed subpath of one path', /d="M0 0L100 0L100 100L0 100ZM25 25L75 25L75 75L25 75Z"/.test(svgH), svgH);
        check('and fills it even-odd, so the hole is bare', /fill-rule="evenodd"/.test(svgH));
        check('a plain shape\'s SVG writes no fill rule, and the one path it always did', !/fill-rule/.test(svgP) && /d="M0 0L100 0L100 100L0 100Z"/.test(svgP), svgP);

        const docH = fakeDoc(); CH.Na__LeChrome__DrawToPdf(docH, listH);
        const linesH = docH.calls.filter((c) => c[0] === 'lines');
        check('the PDF traces both rings into one path, painting once, even-odd, fill and edges (B*)',
            linesH.length === 2 && linesH[0][5] === null && linesH[1][5] === 'B*' && linesH.every((c) => c[6] === true), linesH.map((c) => [ c[2], c[3], c[5], c[6] ]));
        const docP = fakeDoc(); CH.Na__LeChrome__DrawToPdf(docP, listP);
        const linesP = docP.calls.filter((c) => c[0] === 'lines');
        check('a plain shape\'s PDF is the single FD call it always was', linesP.length === 1 && linesP[0][5] === 'FD' && linesP[0][6] === true);
        const fillOnly = []; G.Na__LeShapeGeo__Push(fillOnly, holedShape({ Shape__Stroked : false }));
        const docF = fakeDoc(); CH.Na__LeChrome__DrawToPdf(docF, fillOnly);
        check('a holed fill with its edges off fills f*', docF.calls.filter((c) => c[0] === 'lines').map((c) => c[5]).join() === ',f*');

        globalThis.__gradCalls = [];
        const graded = []; G.Na__LeShapeGeo__Push(graded, holedShape({ Shape__Gradient : { Gradient__AngleDeg : 0 } }));
        const docG = fakeDoc(); CH.Na__LeChrome__DrawToPdf(docG, graded);
        check('a holed gradient is handed its holes for the clip', globalThis.__gradCalls.length === 1 && same(globalThis.__gradCalls[0][3], [ 4 ]));
        check('and its fill and edges still go in passes, each tracing both rings', same(docG.calls.filter((c) => c[0] === 'lines').map((c) => c[5]), [ null, 'f*', null, 'S' ]));
    }

    {
        // THE HATCH'S PDF CLIP, as shipped (a leaf: no stubs), against a pattern of its own
        const H = await load(LE + '36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js', '', 'Hatch');
        const pattern = { Pattern__Key : 'Test__Lines', Pattern__TileWidthMm : 5, Pattern__TileHeightMm : 5, Pattern__StrokeMm : 0.2, Pattern__Opacity : 1, Pattern__MinScale : 0.25, Pattern__MaxScale : 4,
            Pattern__Marks : [ { Mark__XMm : 0, Mark__YMm : 0, Mark__Glyph : { Glyph__Path : 'M0,0 L5,5' } } ] };   // <-- One diagonal a tile, in the library's own form
        const hatchCalls = (holes) => { const doc = fakeDoc(); H.Na__LeHatch__DrawPdf(doc, square(0, 0, 100, 100).concat(square(25, 25, 50, 50)), { pattern : pattern, scale : 1, holes : holes }); return doc.calls; };
        const withHoles = hatchCalls([ 4 ]);
        const clipAt = withHoles.findIndex((c) => c[0] === 'clip');
        const tiles  = typeof H.Na__LeHatch__TilePolylines === 'function' ? H.Na__LeHatch__TilePolylines(pattern) : null;
        if (clipAt === -1 && !(tiles && tiles.lines && tiles.lines.length)) {
            console.log('  note  the hatch module read no lines from the test pattern, so its clip was not reached - the in-app check covers it');
        } else {
            check('a holed hatch clips to both rings, each closed, even-odd',
                clipAt > -1 && withHoles[clipAt][1] === 'evenodd' && withHoles.slice(0, clipAt).filter((c) => c[0] === 'moveTo').length === 2 && withHoles.slice(0, clipAt).filter((c) => c[0] === 'close').length === 2,
                withHoles.slice(0, clipAt + 1).map((c) => c[0]));
            const without = hatchCalls(undefined);
            const plainClip = without.find((c) => c[0] === 'clip');
            check('a plain hatch clips as it always did: one run, the default rule', !!plainClip && plainClip.length === 1 && without.filter((c) => c[0] === 'moveTo').length >= 1 && !without.some((c) => c[0] === 'close'));
        }
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Six Tools' Plans
// -----------------------------------------------------------------------------

    {
        const S = await load(LE + '37__System__VectorTools/Na__LayoutEditor__VectorTools__State__.js', '', 'State');
        globalThis.__S = S;
        const OPS_STUBS = `
            const Na__LeModel__GetSelectionItems  = () => globalThis.__sel || [];
            const Na__LeModel__SetSelection       = () => {};
            const Na__LeModel__SetSelectionItems  = (items) => { globalThis.__selSet = items; };
            const Na__LeModel__IsLayerVisible     = () => true;
            const Na__LeModel__IsLayerSelectable  = () => true;
            const Na__LePaint__MarkupBackToFront  = (sheet) => (sheet.Sheet__Layers || []).slice().reverse().map((l) => l.Layer__Id);
            const Na__LeShapeGeo__Rings           = (...a) => globalThis.__G.Na__LeShapeGeo__Rings(...a);
            const Na__LeShapeGeo__DistanceToEdge  = (...a) => globalThis.__G.Na__LeShapeGeo__DistanceToEdge(...a);
            const Na__LeShapeGeo__Contains        = (...a) => globalThis.__G.Na__LeShapeGeo__Contains(...a);
            const Na__LeOsnap__HideMarker         = () => {};
            const { Na__LeVecBool__Union, Na__LeVecBool__OuterShell, Na__LeVecBool__Intersect, Na__LeVecBool__Subtract, Na__LeVecBool__Divide, Na__LeVecBool__Overlaps, Na__LeVecBool__ToRecord } = globalThis.__B;
            const Na__LeVecAim__ReachMm           = () => 1;
            const Na__LeVecAim__InScope           = () => true;
            const Na__LeVecAim__Refusal           = (sheet, shape) => (shape.Shape__Image || shape.Shape__Qr || shape.Shape__Area) ? 'kind' : (shape.Shape__Locked ? 'locked' : null);
            const Na__LeVecAim__RefusalText       = (refusal) => 'refused: ' + refusal;
            const Na__LeVecAim__IsHoled           = (shape) => Array.isArray(shape.Shape__Holes) && shape.Shape__Holes.length > 0;
            const Na__LeVecAim__Rebuild           = (sheet, plan, gone) => { globalThis.__rebuilt = { plan : plan, gone : gone }; const out = []; plan.forEach((e) => e.pieces.forEach((p, k) => out.push(k === 0 ? e.shape.Shape__Id : e.shape.Shape__Id + '+' + k))); return out; };
            const Na__LeVecAim__Shape             = (sheet, id) => (sheet.Sheet__Shapes || []).find((s) => s.Shape__Id === id) || null;
            const Na__LeVecPrev__TONE_REMOVE = 'remove', Na__LeVecPrev__TONE_ADD = 'add', Na__LeVecPrev__TONE_HELD = 'held';
            const Na__LeVecPrev__Show  = () => true;
            const Na__LeVecPrev__Clear = () => true;
            const Na__LeVecCfg__Label  = (key, fallback) => fallback;
            const Na__LeVecCfg__Format = (key, fallback, tokens) => fallback.replace(/\\{(\\w+)\\}/g, (whole, name) => String(tokens[name]));
            const { Na__LeVec__TOOL_UNION, Na__LeVec__TOOL_SUBTRACT, Na__LeVec__TOOL_BOOL_TRIM, Na__LeVec__TOOL_INTERSECT, Na__LeVec__TOOL_BOOL_SPLIT, Na__LeVec__TOOL_OUTER_SHELL, Na__LeVec__BOOLEAN_TOOLS } = globalThis.__S;
            const Na__LeVec__Say       = (text) => { globalThis.__said = text; return true; };
            const Na__LeVec__SetHint   = () => true;
        `;
        const O = await load(LE + '37__System__VectorTools/Na__LayoutEditor__VectorTools__BooleanTool__.js', OPS_STUBS, 'Ops');

        const shape = (id, ring, extra) => Object.assign({ Shape__Id : id, Shape__LayerId : 'L1', Shape__Points : ring, Shape__Closed : true }, extra || {});
        const sheetOf = (...shapes) => ({ Sheet__Layers : [ { Layer__Id : 'L1' } ], Sheet__Shapes : shapes });
        const wall  = shape('wall', square(0, 0, 100, 20));
        const door  = shape('door', square(40, -5, 20, 30));
        const niche = shape('niche', square(40, 5, 20, 10));
        const sheet = sheetOf(wall, door, niche);
        const sum   = (pieces) => pieces.reduce((s, p) => s + R.Na__LeRings__Area(p.points, p.holes), 0);
        const T     = S;

        // BY CLICKING - SketchUp's order
        let p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_SUBTRACT, sheet, door, wall);
        check('Subtract by clicking: the FIRST shape (the door) is cut out of the second (the wall) and goes', p.ok && p.plan.length === 1 && p.plan[0].shape === wall && p.plan[0].pieces.length === 2 && same(p.gone, [ 'door' ]) && near(sum(p.plan[0].pieces), 1600));
        p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_BOOL_TRIM, sheet, door, wall);
        check('Trim by clicking: the same cut, and the door STAYS', p.ok && p.plan[0].shape === wall && same(p.gone, []) && p.removed.length === 0);
        p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_SUBTRACT, sheet, niche, wall);
        check('a cut in the middle of the wall leaves one piece with a hole', p.ok && p.plan[0].pieces.length === 1 && p.plan[0].pieces[0].holes.length === 1 && near(sum(p.plan[0].pieces), 1800));
        p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_UNION, sheet, door, wall);
        check('Union by clicking keeps the FIRST shape\'s record and style, and takes the second', p.ok && p.plan[0].shape === door && same(p.gone, [ 'wall' ]) && p.plan[0].pieces.length === 1 && near(sum(p.plan[0].pieces), 2000 + 600 - 400));
        p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_INTERSECT, sheet, wall, door);
        check('Intersect by clicking leaves the overlap in the first shape\'s record', p.ok && p.plan[0].shape === wall && near(sum(p.plan[0].pieces), 400));
        p = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_BOOL_SPLIT, sheet, wall, door);
        const donors = {}; p.plan.forEach((e) => { donors[e.shape.Shape__Id] = sum(e.pieces); });
        check('Split: the wall keeps its two parts, and the shared part goes to the door, which is in front', p.ok && near(donors.wall, 1600) && near(donors.door, 200 + 400), donors);

        const apart = shape('apart', square(500, 500, 10, 10));
        check('shapes that do not overlap are refused, and nothing is deleted', [ T.Na__LeVec__TOOL_SUBTRACT, T.Na__LeVec__TOOL_BOOL_TRIM, T.Na__LeVec__TOOL_INTERSECT, T.Na__LeVec__TOOL_BOOL_SPLIT ]
            .every((tool) => { const r = O.Na__LeVecOps__PlanClicks(tool, sheetOf(wall, apart), apart, wall); return r.ok === false && /overlap/.test(r.say); }));
        check('...but a Union of two apart is fine: two pieces, one record each', (() => { const r = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_UNION, sheetOf(wall, apart), wall, apart); return r.ok && r.plan[0].pieces.length === 2; })());
        const big = shape('big', square(-10, -10, 200, 200));
        check('a Subtract that would cut the whole shape away is refused', (() => { const r = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_SUBTRACT, sheetOf(wall, big), big, wall); return r.ok === false && /whole shape/.test(r.say); })());
        check('the same shape twice is nothing to any tool but Outer Shell', O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_UNION, sheet, wall, wall).ok === false);
        const slab = shape('slab', square(0, 0, 100, 100).concat(square(25, 25, 50, 50)), { Shape__Holes : [ 4 ] });
        check('Outer Shell on a holed shape clicked twice fills its holes', (() => { const r = O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_OUTER_SHELL, sheetOf(slab), slab, slab); return r.ok && r.plan[0].pieces[0].holes.length === 0 && near(sum(r.plan[0].pieces), 10000); })());
        check('...and on a plain one says it has none', /no holes/.test(O.Na__LeVecOps__PlanClicks(T.Na__LeVec__TOOL_OUTER_SHELL, sheet, wall, wall).say));

        // REFUSALS
        const line = shape('line', [ [ 0, 0 ], [ 50, 50 ] ], { Shape__Closed : false });
        check('an open line cannot take part: a Boolean is an area', O.Na__LeVecOps__Refusal(sheetOf(line), line) === O.Na__LeVecOps__REFUSE_OPEN);
        check('a measured room cannot either (the targets\' own reason)', O.Na__LeVecOps__Refusal(sheet, shape('room', square(0, 0, 10, 10), { Shape__Area : {} })) === 'kind');
        check('a holed shape can', O.Na__LeVecOps__Refusal(sheet, slab) === null);

        // ON A SELECTION - the paint order decides
        const back  = shape('back',  square(0, 0, 100, 100));
        const mid   = shape('mid',   square(10, 10, 20, 20));
        const front = shape('front', square(60, 60, 20, 20));
        const layered = sheetOf(back, mid, front);
        p = O.Na__LeVecOps__PlanSelection(T.Na__LeVec__TOOL_SUBTRACT, layered, [ back, mid, front ]);
        check('Subtract on a selection: every shape in front is cut out of the one at the back (two holes), and they go', p.ok && p.plan[0].shape === back && p.plan[0].pieces[0].holes.length === 2 && same(p.gone, [ 'mid', 'front' ]));
        p = O.Na__LeVecOps__PlanSelection(T.Na__LeVec__TOOL_BOOL_TRIM, layered, [ back, mid, front ]);
        check('Trim on a selection: the back one loses what is in front of it, and nothing goes', p.ok && p.plan.length === 1 && p.plan[0].shape === back && same(p.gone, []));

        globalThis.__sel = [ { kind : 'shape', id : 'front' }, { kind : 'shape', id : 'back' }, { kind : 'text', id : 'T1' } ];   // <-- Chosen front first: the paint order still decides
        const ok = O.Na__LeVecOps__ApplySelection(T.Na__LeVec__TOOL_SUBTRACT, layered);
        check('picked up over a selection it acts at once, the back shape cut whichever was picked first', ok && globalThis.__rebuilt.plan[0].shape === back && same(globalThis.__rebuilt.gone, [ 'front' ]));
        check('and it says what it did, and what it left out', /Subtract: 2 shapes into 1\./.test(globalThis.__said) && /1 other selected items were left out/.test(globalThis.__said), globalThis.__said);
        globalThis.__sel = [ { kind : 'shape', id : 'back' }, { kind : 'shape', id : 'mid' }, { kind : 'shape', id : 'front' } ];
        O.Na__LeVecOps__ApplySelection(T.Na__LeVec__TOOL_BOOL_TRIM, layered);
        check('Trim says how many it cut back - every shape is still there, so never "3 shapes into 1"', /^Trim: 1 of 3 shapes cut back by the ones in front\.$/.test(globalThis.__said), globalThis.__said);
        globalThis.__sel = [ { kind : 'shape', id : 'back' } ];
        check('one shape selected is not enough to act on', O.Na__LeVecOps__ApplySelection(T.Na__LeVec__TOOL_UNION, layered) === false && /two or more/.test(globalThis.__said));
        check('the several-selected menu offers the Boolean row only for two closed shapes or more', O.Na__LeVecOps__SelectionItems(layered).length === 0);
        globalThis.__sel = [ { kind : 'shape', id : 'back' }, { kind : 'shape', id : 'mid' } ];
        const rows = O.Na__LeVecOps__SelectionItems(layered);
        check('...and then it is one row with the six in its flyout, and its rule', rows.length === 2 && rows[0].submenu.length === 6 && rows[1].separator === true);

        // FINDING A SHAPE BY CLICKING: its edge, else the frontmost one the point is inside
        const inside = O.Na__LeVecOps__At(layered, { x : 20, y : 20 });
        check('a click inside a small shape on a big one finds the small one (it is in front)', inside && inside.shape === mid);
        const overLine = O.Na__LeVecOps__At(sheetOf(back, line), { x : 25, y : 25 });
        check('a line drawn across a shape does not hide the shape from a Boolean', overLine && overLine.shape === back && overLine.refusal === null);
        const onlyLine = O.Na__LeVecOps__At(sheetOf(line), { x : 25, y : 25 });
        check('a line alone is found, refused, so the reason can be said', onlyLine && onlyLine.shape === line && onlyLine.refusal === O.Na__LeVecOps__REFUSE_OPEN);
        globalThis.__sel = [];
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Keys: Shift+U, Shift+S, Shift+T and Shift+O on a Boolean Selection
// -----------------------------------------------------------------------------

    {
        // A LOADER THAT STUBS EVERY IMPORT: any name not handed in reads as a
        // function returning undefined (Na__Test__DrawingTabKeys__'s way), so
        // the real keyboard and adapter run with nothing of the editor behind them.
        const IMPORT = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;
        let stubCount = 0;
        const loadStubbed = async (relative, stubs) => {
            let src = fs.readFileSync(path.resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
            const names = [];
            let m;
            IMPORT.lastIndex = 0;
            while ((m = IMPORT.exec(src)) !== null) {
                const list = m[1].trim();
                if (list.charAt(0) === '{') list.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
            }
            src = src.replace(IMPORT, '');
            const key = '__BoolKeyStubs' + (++stubCount);
            globalThis[key] = stubs || {};
            const head = names.map((n) => 'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };').join('\n');
            const tmp = path.join(SCRATCH, 'Stubbed' + stubCount + '.mjs');
            fs.writeFileSync(tmp, head + '\n' + src, 'utf8');
            return import(pathToFileURL(tmp).href);
        };

        // THE KEY MAP, through the shipped file and the built-in fallback alike
        const KeyMap  = await loadStubbed(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__KeyMap__.js', { Na__LeCfg__PREFIX : 'LayoutEditor__' });
        const shipped = JSON.parse(fs.readFileSync(path.resolve(SRC, LE + '03__Core__Config/Na__Hotkeys__DrawingTabs__.json'), 'utf8'));
        const held    = (names) => ({ Ctrl : names.indexOf('Ctrl') !== -1, Shift : names.indexOf('Shift') !== -1, Alt : false, Meta : false, Space : false });
        const action  = (key, mods, situation) => { const found = KeyMap.Na__LeCfg__MatchKeyBinding(key, held(mods || []), situation); return found ? found.action : null; };
        const ON = { BooleanSelection : true }, OFF = { BooleanSelection : false };
        [ [ 'the shipped key file', shipped ], [ 'the built-in fallback', null ] ].forEach((pair) => {
            KeyMap.Na__LeCfg__SetKeyMap(pair[1]);
            const at = pair[0] + ': ';
            check(at + 'with two or more closed shapes selected, Shift+U is Union, Shift+S Subtract and Shift+T Trim',
                [ action('U', [ 'Shift' ], ON), action('S', [ 'Shift' ], ON), action('T', [ 'Shift' ], ON) ].join() === 'Edit__BooleanUnion,Edit__BooleanSubtract,Edit__BooleanTrim',
                [ action('U', [ 'Shift' ], ON), action('S', [ 'Shift' ], ON), action('T', [ 'Shift' ], ON) ]);
            check(at + '...inside an open group too', action('T', [ 'Shift' ], { InContainer : true, BooleanSelection : true }) === 'Edit__BooleanTrim');
            check(at + 'Shift+T is still Extend with no such selection - told so, told nothing, or in a container',
                [ action('T', [ 'Shift' ], OFF), action('T', [ 'Shift' ]), action('T', [ 'Shift' ], { InContainer : true }) ].every((a) => a === 'Tool__Extend'));
            check(at + 'Shift+U and Shift+S do nothing without it', action('U', [ 'Shift' ], OFF) === null && action('S', [ 'Shift' ], OFF) === null && action('u', [ 'Shift' ]) === null);
            check(at + 'the bare keys are untouched: U Split, T Text (Trim in a container), S nothing', action('u', [], ON) === 'Tool__Split' && action('t', [], ON) === 'Tool__Text' && action('t', [], { InContainer : true, BooleanSelection : true }) === 'Tool__Trim' && action('s', [], ON) === null);
            check(at + 'Ctrl+S is still Save, and Ctrl+Shift+S nothing, with shapes selected', action('s', [ 'Ctrl' ], ON) === 'Edit__Save' && action('S', [ 'Ctrl', 'Shift' ], ON) === null);
            check(at + 'Shift+O is Outer Shell while OuterShellSelection holds - two or more shapes, or one with holes',
                action('O', [ 'Shift' ], { OuterShellSelection : true }) === 'Edit__BooleanOuterShell' && action('O', [ 'Shift' ], { BooleanSelection : true, OuterShellSelection : true }) === 'Edit__BooleanOuterShell' && action('O', [ 'Shift' ], { InContainer : true, OuterShellSelection : true }) === 'Edit__BooleanOuterShell');
            check(at + '...and nothing without it: told false, told nothing, or only BooleanSelection', action('O', [ 'Shift' ], { OuterShellSelection : false }) === null && action('O', [ 'Shift' ]) === null && action('O', [ 'Shift' ], ON) === null);
            check(at + 'O alone, Ctrl+O and Ctrl+Shift+O are not Outer Shell', [ action('o', [], { OuterShellSelection : true }), action('o', [ 'Ctrl' ], { OuterShellSelection : true }), action('O', [ 'Ctrl', 'Shift' ], { OuterShellSelection : true }) ].every((a) => a !== 'Edit__BooleanOuterShell'));
            check(at + 'Shift+U, Shift+S and Shift+T are not Booleans on OuterShellSelection alone (one holed shape): Shift+T stays Extend',
                action('U', [ 'Shift' ], { OuterShellSelection : true }) === null && action('S', [ 'Shift' ], { OuterShellSelection : true }) === null && action('T', [ 'Shift' ], { OuterShellSelection : true }) === 'Tool__Extend');
        });
        KeyMap.Na__LeCfg__SetKeyMap(null);
        const catalogue = shipped.LayoutEditor__Actions__Config.LayoutEditor__Actions__List.map((entry) => entry.Action);
        check('the four are in the key file\'s action catalogue', [ 'Edit__BooleanUnion', 'Edit__BooleanSubtract', 'Edit__BooleanTrim', 'Edit__BooleanOuterShell' ].every((name) => catalogue.indexOf(name) !== -1));
        const ids = shipped.LayoutEditor__KeyboardBindings__Config.LayoutEditor__KeyboardBindings__List.map((row) => row.Id);
        check('the Shift+T row sits above Extend, or Extend would always win', ids.indexOf('Edit__BooleanTrim') !== -1 && ids.indexOf('Edit__BooleanTrim') < ids.indexOf('Tool__Extend'));

        // THE ADAPTER'S COMMANDS
        const S2 = await load(LE + '37__System__VectorTools/Na__LayoutEditor__VectorTools__State__.js', '', 'State2');
        const applied = [];
        const Vec = await loadStubbed(LE + '37__System__VectorTools/Na__LayoutEditor__VectorTools__.js', Object.assign({}, S2, {
            Na__LeVecOps__ApplySelection        : (tool, sheet) => { applied.push(tool); return true; },
            Na__LeVecOps__SelectionTakesBoolean    : (sheet) => sheet && sheet.two === true,
            Na__LeVecOps__SelectionTakesOuterShell : (sheet) => sheet && (sheet.two === true || sheet.holed === true)
        }));
        check('each command names its Boolean, and a tool action is not a command',
            [ Vec.Na__LeVec__CommandForAction('Edit__BooleanUnion'), Vec.Na__LeVec__CommandForAction('Edit__BooleanSubtract'), Vec.Na__LeVec__CommandForAction('Edit__BooleanTrim'), Vec.Na__LeVec__CommandForAction('Edit__BooleanOuterShell'), Vec.Na__LeVec__CommandForAction('Tool__Extend') ].join() === 'boolUnion,boolSubtract,boolTrim,boolOuterShell,');
        check('the command table is not fooled by an inherited name', Vec.Na__LeVec__CommandForAction('toString') === null && Vec.Na__LeVec__CommandForAction('constructor') === null);
        check('RunCommand runs the Boolean on the selection', Vec.Na__LeVec__RunCommand('Edit__BooleanSubtract', {}) === true && applied.pop() === 'boolSubtract');
        check('...and nothing without a sheet or for another action', Vec.Na__LeVec__RunCommand('Edit__BooleanUnion', null) === false && Vec.Na__LeVec__RunCommand('Tool__Join', {}) === false && applied.length === 0);
        check('BooleanSelection asks the Boolean tools', Vec.Na__LeVec__BooleanSelection({ two : true }) === true && Vec.Na__LeVec__BooleanSelection({ two : false }) === false);
        check('OuterShellSelection asks them too, and takes one holed shape', Vec.Na__LeVec__OuterShellSelection({ two : true }) === true && Vec.Na__LeVec__OuterShellSelection({ holed : true }) === true && Vec.Na__LeVec__OuterShellSelection({}) === false);
        check('RunCommand runs Outer Shell on the selection', Vec.Na__LeVec__RunCommand('Edit__BooleanOuterShell', {}) === true && applied.pop() === 'boolOuterShell' && applied.length === 0);

        // THE SHEET'S KEYBOARD, as shipped, the key map real and the rest stubbed
        const kb = { tools : [], ran : [], asked : 0, two : false, askedOuter : 0, outer : false };
        const Tools = await load(LE + '30__System__SheetTools/Na__LayoutEditor__SheetTools__State__.js', 'const Na__LeVec__TOOLS = [];', 'ToolsState');
        globalThis.window = globalThis.window || { addEventListener () {}, dispatchEvent () { return true; } };
        const Keys = await loadStubbed(LE + '30__System__SheetTools/Na__LayoutEditor__SheetTools__Keyboard__.js', {
            Na__LeCfg__GetKeyboardSetup   : KeyMap.Na__LeCfg__GetKeyboardSetup,
            Na__LeCfg__MatchKeyBinding    : KeyMap.Na__LeCfg__MatchKeyBinding,
            Na__LeCfg__GetLabel           : (k, f) => f,
            Na__LeModel__GetActiveSheet   : () => ({ Sheet__Id : 'Sheet_Test' }),
            Na__LeModel__GetSelectionItems: () => [],
            Na__LeScope__IsActive         : () => false,
            Na__LeTools__TOOL_SELECT      : Tools.Na__LeTools__TOOL_SELECT,
            Na__LeTools__SHEET_CHORDS     : Tools.Na__LeTools__SHEET_CHORDS,
            Na__LeTools__NON_TEXT_INPUTS  : Tools.Na__LeTools__NON_TEXT_INPUTS,
            Na__LeTools__Editable         : true,
            Na__LeTools__Tool             : Tools.Na__LeTools__TOOL_SELECT,
            Na__LeTools__SetTool          : (tool) => { kb.tools.push(tool); return tool; },
            Na__LeVec__ToolForAction      : (a) => ({ Tool__Extend : 'extend', Tool__Split : 'split' })[a] || null,
            Na__LeVec__CommandForAction   : (a) => Vec.Na__LeVec__CommandForAction(a),
            Na__LeVec__RunCommand         : (a, sheet) => { kb.ran.push(a); return true; },
            Na__LeVec__BooleanSelection   : () => { kb.asked++; return kb.two; },
            Na__LeVec__OuterShellSelection: () => { kb.askedOuter++; return kb.outer; }
        });
        const pressKey = (key, shift, repeat) => { kb.tools = []; kb.ran = []; const e = { key, code : '', target : { tagName : 'DIV', isContentEditable : false }, ctrlKey : false, shiftKey : !!shift, altKey : false, metaKey : false, repeat : !!repeat, prevented : false, preventDefault () { this.prevented = true; } }; Keys.Na__LeTools__OnKey(e); return { tools : kb.tools.slice(), ran : kb.ran.slice(), prevented : e.prevented }; };
        kb.two = true; kb.outer = true;                                        // <-- Two closed shapes: both situations hold, as they do in the editor
        let r = pressKey('U', true);
        check('pressed with two closed shapes selected, Shift+U runs Union on them and picks no tool up', same(r.ran, [ 'Edit__BooleanUnion' ]) && r.tools.length === 0 && r.prevented, r);
        r = pressKey('T', true);
        check('...Shift+T runs Trim, not Extend', same(r.ran, [ 'Edit__BooleanTrim' ]) && r.tools.length === 0, r);
        r = pressKey('S', true);
        check('...Shift+S runs Subtract', same(r.ran, [ 'Edit__BooleanSubtract' ]), r);
        r = pressKey('O', true);
        check('...Shift+O runs Outer Shell', same(r.ran, [ 'Edit__BooleanOuterShell' ]) && r.tools.length === 0 && r.prevented, r);
        r = pressKey('U', true, true);
        check('...and a held key runs once, not once a repeat', r.ran.length === 0 && r.prevented === true, r);
        r = pressKey('O', true, true);
        check('...Shift+O held too', r.ran.length === 0 && r.prevented === true, r);
        kb.two = false;                                                        // <-- One shape with holes: Outer Shell's alone
        r = pressKey('O', true);
        check('one holed shape selected: Shift+O runs Outer Shell to fill its holes', same(r.ran, [ 'Edit__BooleanOuterShell' ]), r);
        r = pressKey('T', true);
        check('...while Shift+T is still Extend and Shift+U nothing', same(r.tools, [ 'extend' ]) && r.ran.length === 0 && pressKey('U', true).ran.length === 0, r);
        kb.outer = false;
        r = pressKey('T', true);
        check('without such a selection Shift+T picks Extend up, as it always did', same(r.tools, [ 'extend' ]) && r.ran.length === 0, r);
        r = pressKey('U', true);
        check('...and Shift+U does nothing at all, and leaves the key to the browser', r.tools.length === 0 && r.ran.length === 0 && r.prevented === false, r);
        r = pressKey('O', true);
        check('...and Shift+O the same', r.tools.length === 0 && r.ran.length === 0 && r.prevented === false, r);
        kb.asked = 0; kb.askedOuter = 0; pressKey('u', false); pressKey('o', false); pressKey('F3', false);
        check('the selection is not looked at for a key no Boolean row matches (U alone, O alone, F3)', kb.asked === 0 && kb.askedOuter === 0, [ kb.asked, kb.askedOuter ]);
        kb.askedOuter = 0; pressKey('U', true); pressKey('T', true);
        check('...nor asked about Outer Shell for Shift+U or Shift+T', kb.askedOuter === 0, kb.askedOuter);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('Vector booleans: ' + passed + ' passed, ' + failed + ' failed.');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
