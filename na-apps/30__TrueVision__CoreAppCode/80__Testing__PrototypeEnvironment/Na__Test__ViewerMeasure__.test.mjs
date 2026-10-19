// =============================================================================
// TRUEVISION3D - TEST - WEB VIEWER MEASURING TOOLS (THE ENGINE)
// =============================================================================
//
// FILE       : Na__Test__ViewerMeasure__.test.mjs
// PURPOSE    : Prove the published reader's measuring engine reads a viewport's
//              linework exactly, snaps where a reader means, and says a length
//              or an area at the drawing's own scale
// CREATED    : 19-Oct-2026
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__ViewerMeasure__.test.mjs
//
// HOW IT WORKS:
// - The Hide Swings test's loader: each SHIPPED module is read, its imports are
//   removed and replaced with this test's stubs (or the real modules this test
//   loaded first), and the rest runs byte for byte as it ships. The modules are
//   written to the temporary folder first (set TEMP to move it).
// - Synthetic linework for every rule, then the REAL published files in the
//   repository: JW02's D01 elevations end to end through the store, and every
//   published linework file in the project folders for size and speed.
//
// WHAT IT GUARDS:
// - Path data: M L H V Z, relative commands, curves cut into pieces whose
//   joints are not ends, arcs. The file: its viewBox, classes and transforms
//   passed down from groups, comments and unstroked paths ignored.
// - The frame: what is outside it is cut away, and a cut end is not an end.
// - The joins: pieces of one straight line become one, a T junction and a
//   change of class stop a join, and a gently curving run is never
//   straightened into its chord.
// - The sheet: frame offset, the viewBox stretched over the frame, a turned
//   viewport turned about the middle of its frame.
// - The snaps: endpoint beats a crossing at a corner, midpoint, crossing,
//   perpendicular, square off the last point and where the square crosses a
//   line, on a line, Ortho, a snap switched off, nothing.
// - The values: lengths, a rectangle square to a turned drawing, areas with a
//   label point inside an L, exact or an estimate, metres on a site plan,
//   hectares on a large area.
// =============================================================================

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const PUB        = '52__System__Layout__PublishedDocuments/';
    const PORTAL     = resolve(SCRIPT_DIR, '..', '..', '..', 'na-project-portal', '26-Projects');
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    let loadCount = 0;
    async function load(relative, stubs) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const names = [];
        let m;
        IMPORT.lastIndex = 0;
        while ((m = IMPORT.exec(src)) !== null) {
            const list = m[1].trim();
            if (list.charAt(0) !== '{') continue;
            list.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
        }
        const had = /^\s*import\s/m.test(src);
        src = src.replace(IMPORT, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const key = '__ViewerMeasureStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__ViewerMeasure__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0, passes = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    function near(name, got, want, tolerance) {
        const passed = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + (passed ? '' : '  (got ' + got + ', want ' + want + ' within ' + tolerance + ')'));
    }
    function truthy(name, value, detail) {
        const passed = !!value;
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + (passed || !detail ? '' : '  (' + detail + ')'));
    }
    const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
    const segs = (layer) => Array.from({ length : layer.Count }, (_, s) => [ round(layer.X1[s]), round(layer.Y1[s]), round(layer.X2[s]), round(layer.Y2[s]), layer.Flags[s] ]);
    const record = (over) => Object.assign({
        Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__ScaleDenominator : 50, Viewport__RotationDeg : 0,
        Viewport__FrameMm : { X : 0, Y : 0, WidthMm : 20, HeightMm : 20 }, Viewport__Vector : { Vector__File : 'x.svg' }
    }, over || {});
    const svg = (box, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box + '">' + body + '</svg>';

// endregion -------------------------------------------------------------------


const Lw   = await load(PUB + 'Na__PubDoc__Measure__Linework__.js');
const Snap = await load(PUB + 'Na__PubDoc__Measure__Snap__.js', Lw);
const Math_ = await load(PUB + 'Na__PubDoc__Measure__Maths__.js');


// -----------------------------------------------------------------------------
// REGION | Path Data
// -----------------------------------------------------------------------------

console.log('\nPath data');
{
    const read = (d, m) => { const out = []; Lw.Na__PubMsLw__ParsePathData(d, m || null, (x1, y1, x2, y2, a, b) => out.push([ round(x1), round(y1), round(x2), round(y2), a, b ])); return out; };
    check('M L pairs, as every published file writes them', read('M0,0L10,0M10,0L10,5'), [ [ 0, 0, 10, 0, true, true ], [ 10, 0, 10, 5, true, true ] ]);
    check('relative moveto, implicit lineto pairs and a closing z', read('m1 1 l2 0 0 2 z'), [ [ 1, 1, 3, 1, true, true ], [ 3, 1, 3, 3, true, true ], [ 3, 3, 1, 1, true, true ] ]);
    check('H and V', read('M0 0 H5 V5 h-1 v-1'), [ [ 0, 0, 5, 0, true, true ], [ 5, 0, 5, 5, true, true ], [ 5, 5, 4, 5, true, true ], [ 4, 5, 4, 4, true, true ] ]);
    const curve = read('M0,0C0,10 10,10 10,0');
    check('a cubic is cut into sixteen pieces: only its own two ends are ends',
        [ curve.length, curve[0][4], curve[0][5], curve[7][4], curve[7][5], curve[15][4], curve[15][5], curve[15][2], curve[15][3] ],
        [ 16, true, false, false, false, false, true, 10, 0 ]);
    const arc = read('M0,0 A5,5 0 0 1 10,0');
    truthy('an arc (sweep 1) is cut into pieces that pass over the top of its circle (y = -5)',
        arc.length > 4 && arc.some((p) => Math.abs(p[3] + 5) < 0.05) && arc[arc.length - 1][2] === 10 && arc[arc.length - 1][3] === 0, JSON.stringify(arc.slice(0, 3)));
    check('a matrix moves every point (translate 10 5)', read('M0,0L1,0', [ 1, 0, 0, 1, 10, 5 ]), [ [ 10, 5, 11, 5, true, true ] ]);
    check('a transform attribute is read in order: translate then rotate 90',
        Lw.Na__PubMsLw__ParseTransform('translate(10 0) rotate(90)').map((v) => round(v)), [ 0, 1, -1, 0, 10, 0 ]);
    check('garbage stops the walk rather than inventing a line', read('M0,0L5,5 X 9 9'), [ [ 0, 0, 5, 5, true, true ] ]);
}

console.log('\nThe file');
{
    const parsed = Lw.Na__PubMsLw__ParseSvg(svg('0 0 100 50',
        '<!-- <path d="M0,0L99,99"/> -->' +
        '<g data-na-class="hidden" transform="translate(10 5)"><path d="M0,0L10,0"/></g>' +
        '<path data-na-class="section" d="M1,1L2,2" stroke="none"/>' +
        '<path data-na-class="visible" d="M3,3L4,4"/>'));
    check('the viewBox, two paths: a comment and an unstroked path are not lines', [ parsed.ViewBox, parsed.Paths.length ], [ [ 0, 0, 100, 50 ], 2 ]);
    check('a group passes its class and its transform down', [ parsed.Paths[0].Class, parsed.Paths[0].Matrix ], [ 'hidden', [ 1, 0, 0, 1, 10, 5 ] ]);
    check('a path keeps its own class', parsed.Paths[1].Class, 'visible');
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Clipping and Joining
// -----------------------------------------------------------------------------

console.log('\nClipping and joining');
{
    check('a line half outside the frame keeps the half inside', Lw.Na__PubMsLw__Clip(-5, 0, 5, 0, 0, -1, 10, 1), [ 0.5, 1 ]);
    check('a line wholly outside is dropped', Lw.Na__PubMsLw__Clip(-5, 3, -1, 3, 0, -1, 10, 1), null);

    const join = (list, cls) => {
        const input = { X1 : [], Y1 : [], X2 : [], Y2 : [], Flags : [], Cls : [] };
        list.forEach((one, i) => { input.X1.push(one[0]); input.Y1.push(one[1]); input.X2.push(one[2]); input.Y2.push(one[3]); input.Flags.push(one[4] === undefined ? 3 : one[4]); input.Cls.push(cls ? cls[i] : 1); });
        const out = Lw.Na__PubMsLw__Join(input);
        return out.X1.map((_, i) => [ round(out.X1[i]), round(out.Y1[i]), round(out.X2[i]), round(out.Y2[i]), out.Flags[i] ]);
    };
    check('three pieces of one straight line become one, its two ends real', join([ [ 0, 0, 1, 0 ], [ 1, 0, 2, 0 ], [ 2, 0, 3, 0 ] ]), [ [ 0, 0, 3, 0, 3 ] ]);
    check('a piece drawn the other way round still joins', join([ [ 0, 0, 1, 0 ], [ 2, 0, 1, 0 ] ]), [ [ 0, 0, 2, 0, 3 ] ]);
    check('a T junction keeps all three', join([ [ 0, 0, 1, 0 ], [ 1, 0, 2, 0 ], [ 1, 0, 1, 1 ] ]).length, 3);
    check('a visible line running into a hidden one stays two lines', join([ [ 0, 0, 1, 0 ], [ 1, 0, 2, 0 ] ], [ 1, 4 ]).length, 2);
    check('an end made by the frame blocks a join there', join([ [ 0, 0, 1, 0, 1 ], [ 1, 0, 2, 0, 3 ] ]).length, 2);
    check('a corner is not a join', join([ [ 0, 0, 1, 0 ], [ 1, 0, 1, 1 ] ]).length, 2);
    // A GENTLE CURVE: forty pieces each turning a tenth of a degree. Held to the
    // run's FIRST direction, no run may turn more than a quarter degree.
    const gentle = [];
    let x = 0, y = 0;
    for (let k = 0; k < 40; k++) {
        const a = (k * 0.1) * Math.PI / 180;
        const nx = x + Math.cos(a), ny = y + Math.sin(a);
        gentle.push([ x, y, nx, ny ]);
        x = nx; y = ny;
    }
    const runs = join(gentle);
    const worst = Math.max(...runs.map((r) => {
        const pieces = gentle.filter((g) => g[0] >= r[0] - 1e-6 && g[2] <= r[2] + 1e-6);
        return Math.max(...pieces.map((g) => Math.abs(Math.atan2(g[3] - g[1], g[2] - g[0]) - Math.atan2(pieces[0][3] - pieces[0][1], pieces[0][2] - pieces[0][0])) * 180 / Math.PI));
    }));
    truthy('a gently curving line is NOT straightened into its chord (' + runs.length + ' runs, none turning more than 0.25 deg)', runs.length >= 12 && worst <= 0.25 + 1e-9, 'runs ' + runs.length + ', worst turn ' + worst);
    truthy('...and its runs still meet end to end, every joint a real end', runs.every((r, i) => i === 0 || (Math.abs(r[0] - runs[i - 1][2]) < 1e-6 && Math.abs(r[1] - runs[i - 1][3]) < 1e-6)) && runs.every((r) => r[4] === 3));
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Viewport's Layer on the Sheet
// -----------------------------------------------------------------------------

console.log('\nOn the sheet');
{
    const frame = { Viewport__FrameMm : { X : 100, Y : 50, WidthMm : 40, HeightMm : 20 } };
    const layer = Lw.Na__PubMsLw__Build(record(frame), svg('0 0 40 20', '<path d="M-5,10L45,10M10,0L10,20"/>'));
    check('cut to the frame and moved onto the sheet: the cut line has no real ends, the whole one has two',
        segs(layer), [ [ 100, 60, 140, 60, 0 ], [ 110, 50, 110, 70, 3 ] ]);
    check('the layer knows its viewport, scale and frame', [ layer.Id, layer.Scale, layer.Frame ], [ 'Viewport_001', 50, { X : 100, Y : 50, W : 40, H : 20 } ]);
    check('Near finds both lines at their crossing, and only the one near its end', [ Lw.Na__PubMsLw__Near(layer, 110, 60, 1, []).sort(), Lw.Na__PubMsLw__Near(layer, 110, 51, 1, []) ], [ [ 0, 1 ], [ 1 ] ]);

    const turned = Lw.Na__PubMsLw__Build(record(Object.assign({ Viewport__RotationDeg : 90 }, frame)), svg('0 0 40 20', '<path d="M10,0L10,20"/>'));
    check('a viewport turned 90 degrees is turned about the middle of its frame', segs(turned), [ [ 130, 50, 110, 50, 3 ] ]);
    truthy('...and a point is found inside its turned frame, not its unturned one',
        Lw.Na__PubMsLw__FrameContains(turned.Frame, 90, 120, 41, 0) && !Lw.Na__PubMsLw__FrameContains(turned.Frame, 90, 102, 60, 0));

    const stretched = Lw.Na__PubMsLw__Build(record(frame), svg('0 0 80 40', '<path d="M20,0L20,40"/>'));
    check('a file whose viewBox is twice the frame is stretched over the frame, as the reader paints it', segs(stretched), [ [ 110, 50, 110, 70, 3 ] ]);
    check('a 3D viewport cannot be measured', Lw.Na__PubMsLw__Build(record({ Viewport__Kind : '3d' }), ''), null);
    check('a viewport with no scale cannot be measured', Lw.Na__PubMsLw__Build(record({ Viewport__ScaleDenominator : 0 }), ''), null);
    const bare = Lw.Na__PubMsLw__Build(record(), '');
    check('a drawing with no linework still has a layer: its frame and scale, nothing to snap to', [ bare.Count, bare.Scale ], [ 0, 50 ]);
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Snapping
// -----------------------------------------------------------------------------

console.log('\nSnapping');
{
    // A room from (2,2) to (12,12), a line down through x = 7, and a diagonal from (14,0) to (20,6).
    const layer = Lw.Na__PubMsLw__Build(record(), svg('0 0 20 20', '<path d="M2,2L12,2L12,12L2,12Z M7,0L7,14 M14,0L20,6"/>'));
    const find = (x, y, o) => { const s = Snap.Na__PubMsSnap__Find([ layer ], x, y, Object.assign({ ApertureMm : 1 }, o || {})); return [ s.Kind, round(s.X, 3), round(s.Y, 3) ]; };
    check('at a corner the endpoint wins over the crossing that is the same point', find(2.3, 2.2), [ 'end', 2, 2 ]);
    check('a crossing', find(7.1, 2.1), [ 'int', 7, 2 ]);
    check('a midpoint', find(12.2, 7.1), [ 'mid', 12, 7 ]);
    check('the foot of a perpendicular from the last point', find(12.3, 5.2, { From : { X : 4, Y : 5 } }), [ 'perp', 12, 5 ]);
    check('square off the last point (horizontal)', find(9, 5.2, { From : { X : 4, Y : 5 } }), [ 'axis', 9, 5 ]);
    check('...and where that square crosses a line near the pointer', find(19.2, 5.3, { From : { X : 4, Y : 5 } }), [ 'axisint', 19, 5 ]);
    check('on a line', find(2.4, 6), [ 'near', 2, 6 ]);
    check('Ortho squares to the nearer axis whatever is near (vertical here)', find(6, 8, { From : { X : 4, Y : 5 }, Ortho : true }), [ 'axis', 4, 8 ]);
    check('with endpoints switched off a corner is found as a crossing', find(2.3, 2.2, { Modes : { end : false } }), [ 'int', 2, 2 ]);
    check('far from everything: the pointer itself', find(16, 16), [ 'none', 16, 16 ]);
    const square = Snap.Na__PubMsSnap__Find([ layer ], 9, 5.2, { ApertureMm : 1, From : { X : 4, Y : 5 } });
    check('a square says which axis and carries its guide from the last point', [ square.Axis, square.Guide ], [ 'h', { X1 : 4, Y1 : 5, X2 : 9, Y2 : 5 } ]);
    const turned = Snap.Na__PubMsSnap__Find([ layer ], 4.2, 9, { ApertureMm : 1, From : { X : 4, Y : 5 }, SpinDeg : 90 });
    check('on a turned drawing the square follows its axes: its horizontal is the sheet\'s vertical', [ turned.Kind, turned.Axis, round(turned.X, 3), round(turned.Y, 3) ], [ 'axis', 'h', 4, 9 ]);
    check('exact snaps are the points of the drawing; on a line, on a square and free are estimates',
        [ 'end', 'int', 'mid', 'perp', 'axisint', 'axis', 'near', 'none' ].map(Snap.Na__PubMsSnap__IsExact), [ true, true, true, true, true, false, false, false ]);
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Values
// -----------------------------------------------------------------------------

console.log('\nValues');
{
    const P = (x, y, snap) => ({ X : x, Y : y, Snap : snap || 'end' });
    const line = Math_.Na__PubMsMath__Values({ Tool : 'linear', Scale : 100, Points : [ P(0, 0), P(30, 40) ] });
    check('a line 50 sheet mm long at 1:100 is 5 m, exact', [ line.Length, line.Exact, Math_.Na__PubMsMath__FormatLength(line.Length, 100, true) ], [ 5000, true, '5,000 mm' ]);
    const loose = Math_.Na__PubMsMath__Values({ Tool : 'linear', Scale : 100, Points : [ P(0, 0), P(34.53, 0, 'near') ] });
    check('...one end slid along a line makes it an estimate, rounded to 5 mm', [ loose.Exact, Math_.Na__PubMsMath__FormatLength(loose.Length, 100, loose.Exact) ], [ false, '≈ 3,455 mm' ]);
    const rect = Math_.Na__PubMsMath__Values({ Tool : 'rect', Scale : 50, SpinDeg : 0, Points : [ P(0, 0), P(30, 20) ] });
    check('a rectangle 30 by 20 sheet mm at 1:50: 1,500 by 1,000 mm, 1.50 m2',
        [ rect.Width, rect.Height, Math_.Na__PubMsMath__FormatArea(rect.Area, rect.Exact) ], [ 1500, 1000, '1.50 m²' ]);
    const spun = Math_.Na__PubMsMath__Rect(P(0, 0), P(30, 20), 90);
    check('on a drawing turned 90 degrees the rectangle is square to the drawing, not the paper',
        [ round(spun.Width), round(spun.Height), spun.Corners.map((c) => [ round(c.X), round(c.Y) ]) ], [ 20, 30, [ [ 0, 0 ], [ 0, 20 ], [ 30, 20 ], [ 30, 0 ] ] ]);
    const ell = [ P(0, 0), P(4, 0), P(4, 1), P(1, 1), P(1, 4), P(0, 4) ];
    const area = Math_.Na__PubMsMath__Values({ Tool : 'area', Scale : 1000, Points : ell });
    check('an L of 7 sheet mm2 at 1:1000 is 7 m2, its perimeter 16 m', [ Math_.Na__PubMsMath__FormatArea(area.Area, true), area.Perimeter, area.Edges.length ], [ '7.00 m²', 16000, 6 ]);
    const at = Math_.Na__PubMsMath__LabelPoint(ell);
    const inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i].Y > pt.Y) !== (poly[j].Y > pt.Y)) && (pt.X < (poly[j].X - poly[i].X) * (pt.Y - poly[i].Y) / (poly[j].Y - poly[i].Y) + poly[i].X)) c = !c; } return c; };
    const centroid = { X : 9.5 / 7, Y : 9.5 / 7 };                              // <-- (4 x (2, 0.5) + 3 x (0.5, 2.5)) / 7: outside the L
    truthy('its label point is inside the L, though its centroid is not', inside(at, ell) && !inside(centroid, ell), JSON.stringify(at));
    check('lengths on a site plan are metres, to the centimetre, or the decimetre as an estimate',
        [ Math_.Na__PubMsMath__FormatLength(34520, 1250, true), Math_.Na__PubMsMath__FormatLength(34520, 1250, false), Math_.Na__PubMsMath__FormatLength(34520, 200, true) ],
        [ '34.52 m', '≈ 34.5 m', '34,520 mm' ]);
    check('a large area says its hectares too',
        [ Math_.Na__PubMsMath__FormatArea(1234.5e6, true), Math_.Na__PubMsMath__FormatArea(1234.5e6, false), Math_.Na__PubMsMath__FormatArea(123456e6, true) ],
        [ '1,235 m² (0.12 ha)', '≈ 1,230 m² (0.12 ha)', '123,456 m² (12.3 ha)' ]);
    check('estimates round to the nearest 5 mm', [ 3452, 3453, 3447 ].map((n) => Math_.Na__PubMsMath__FormatLength(n, 100, false)), [ '≈ 3,450 mm', '≈ 3,455 mm', '≈ 3,445 mm' ]);
    check('a shape is exact only when every point is a point of the drawing',
        [ Math_.Na__PubMsMath__IsExact([ P(0, 0, 'end'), P(1, 1, 'int') ]), Math_.Na__PubMsMath__IsExact([ P(0, 0, 'end'), P(1, 1, 'near') ]), Math_.Na__PubMsMath__IsExact([]) ],
        [ true, false, false ]);
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Real Published Files
// -----------------------------------------------------------------------------

console.log('\nJW02 D01, as published');
const JW02 = join(PORTAL, 'JW02__JugglesJoint', '30__TrueVision__AppContent', '06__Layout__PublishedDocuments');
const D01  = join(JW02, 'JW02_T01_D01');
if (!existsSync(D01)) {
    console.log('  SKIP  JW02_T01_D01 is not in this checkout');
} else {
    const viewports = JSON.parse(readFileSync(join(D01, '01__Elements__Data', 'Elements__Viewports__.json'), 'utf8'))['Elements__Viewports'];
    const one  = viewports.find((v) => v['Viewport__Id'] === 'Viewport_001');
    const text = readFileSync(join(D01, one['Viewport__Vector']['Vector__File']), 'utf8');
    const declared = Number((text.match(/data-na-segments="(\d+)"/) || [])[1]);
    const t0 = performance.now();
    const layer = Lw.Na__PubMsLw__Build(one, text);
    const ms = performance.now() - t0;
    check('every segment the file declares is read', layer.Stats.Read, declared);
    const f = layer.Frame;
    const inFrame = (x, y) => x >= f.X - 1e-9 && x <= f.X + f.W + 1e-9 && y >= f.Y - 1e-9 && y <= f.Y + f.H + 1e-9;
    let outside = 0, cut = 0;
    for (let k = 0; k < layer.Count; k++) {
        if (!inFrame(layer.X1[k], layer.Y1[k]) || !inFrame(layer.X2[k], layer.Y2[k])) outside++;
        if (!Lw.Na__PubMsLw__IsRealEnd(layer, k, 0) || !Lw.Na__PubMsLw__IsRealEnd(layer, k, 1)) cut++;
    }
    check('every segment kept lies inside the frame (the ground line runs 19.9 mm past it in the file)', outside, 0);
    truthy('...and the lines the frame cut have lost their cut ends (' + cut + ' of them)', cut > 0);
    truthy('pieces of straight lines were joined (' + layer.Stats.Pieces + ' pieces inside the frame, ' + layer.Stats.Segments + ' lines)', layer.Stats.Segments < layer.Stats.Pieces);
    let s = 0;
    while (s < layer.Count && !(Lw.Na__PubMsLw__IsRealEnd(layer, s, 0) && Math.hypot(layer.X2[s] - layer.X1[s], layer.Y2[s] - layer.Y1[s]) > 3)) s++;
    const hit = Snap.Na__PubMsSnap__Find([ layer ], layer.X1[s] + 0.03, layer.Y1[s] - 0.02, { ApertureMm : 1 });
    check('a pointer near a real end of a real line snaps to it exactly', [ hit.Kind, hit.X, hit.Y ], [ 'end', layer.X1[s], layer.Y1[s] ]);
    // AND NEVER TO A NEARER POINT THAT IS NOT AN END: every snap the engine
    // gives within the aperture is at least as near as the end it was aimed at.
    const aimed = Snap.Na__PubMsSnap__Find([ layer ], layer.X1[s] + 0.3, layer.Y1[s] - 0.2, { ApertureMm : 1 });
    truthy('aimed 0.36 mm off that end, the snap found is a real end no further away (here ' + aimed.Kind + ' at ' + aimed.Distance.toFixed(3) + ' mm)',
        aimed.Kind === 'end' && aimed.Distance <= Math.hypot(0.3, 0.2) + 1e-9);
    console.log('        built in ' + ms.toFixed(1) + ' ms: ' + JSON.stringify(layer.Stats));

    // THE STORE, END TO END: the shipped module with the reader's loading
    // stubbed to read this folder from disk.
    const loaded = {
        Ok : true,
        Sheet : JSON.parse(readFileSync(join(D01, 'Document__Sheet__.json'), 'utf8')),
        Elements : { viewport : JSON.parse(readFileSync(join(D01, '01__Elements__Data', 'Elements__Viewports__.json'), 'utf8')) }
    };
    const fetched = [];
    const Store = await load(PUB + 'Na__PubDoc__Measure__.js', Object.assign({}, Lw, {
        Na__PubDoc__LoadDocument : async () => loaded,
        Na__PubDoc__Urls__Fetch : async (path, as) => { fetched.push(path); try { return { Ok : true, Value : readFileSync(join(JW02, path), 'utf8') }; } catch (e) { return { Ok : false, Reason : 'missing' }; } },
        Na__PubSchema__Kind : (name) => (name === 'viewport' ? { arrayKey : 'Elements__Viewports' } : null),
        Na__PubSchema__ResolveDocumentRef : (documentId, reference) => documentId + '/' + reference
    }));
    const summary = await Store.Na__PubMs__Summary('JW02_T01_D01');
    check('the sheet can be measured: four drawings at 1:100, all with linework', summary, { Count : 4, WithLinework : 4, Scales : [ 100 ] });
    check('nothing has been fetched yet: a reader who never measures costs nothing', fetched.length, 0);
    const progress = [];
    const prepared = await Store.Na__PubMs__Prepare('JW02_T01_D01', (p) => progress.push(p.Done + '/' + p.Total));
    check('Prepare reads the four files once each and builds four layers', [ prepared.Ok, prepared.Layers.length, fetched.length, progress[progress.length - 1] ], [ true, 4, 4, '4/4' ]);
    await Store.Na__PubMs__Prepare('JW02_T01_D01');
    check('...and asking again fetches nothing more', fetched.length, 4);
    const two = viewports.find((v) => v['Viewport__Id'] === 'Viewport_002')['Viewport__FrameMm'];
    check('the drawing under a point is found from the records', Store.Na__PubMs__ViewportAt('JW02_T01_D01', two.X + two.WidthMm / 2, two.Y + two.HeightMm / 2).Id, 'Viewport_002');
    const kept = Store.Na__PubMs__Add('JW02_T01_D01', { Tool : 'linear', ViewportId : 'Viewport_002', Scale : 100, Points : [ { X : 1, Y : 2, Snap : 'end' }, { X : 3, Y : 4, Snap : 'mid' } ] });
    check('a measurement is kept with an id', [ kept.Id, Store.Na__PubMs__List('JW02_T01_D01').length ], [ 'Measure_001', 1 ]);
    kept.Points[1].X = 9;
    check('the list hands out copies: changing one changes nothing until it is put back', Store.Na__PubMs__List('JW02_T01_D01')[0].Points[1].X, 3);
    Store.Na__PubMs__Replace('JW02_T01_D01', kept);
    check('...and Replace puts it back', Store.Na__PubMs__List('JW02_T01_D01')[0].Points[1].X, 9);
    Store.Na__PubMs__Release('JW02_T01_D01');
    check('leaving the sheet lets its linework go and keeps its measurements', [ Store.Na__PubMs__Layers('JW02_T01_D01').length, Store.Na__PubMs__List('JW02_T01_D01').length, Store.Na__PubMs__Status('JW02_T01_D01').Asked ], [ 0, 1, false ]);
    check('Clear says how many went', [ Store.Na__PubMs__Clear('JW02_T01_D01'), Store.Na__PubMs__List('JW02_T01_D01').length ], [ 1, 0 ]);
    check('Remove of one that is not there is false', Store.Na__PubMs__Remove('JW02_T01_D01', 'Measure_999'), false);
}

console.log('\nEvery published linework file in the project folders');
{
    const files = [];
    const walk = (dir, depth) => {
        if (depth > 6 || !existsSync(dir)) return;
        for (const name of readdirSync(dir)) {
            if (name.startsWith('00__')) continue;                               // <-- Archives are not on the sheet
            const full = join(dir, name);
            let stat; try { stat = statSync(full); } catch (e) { continue; }
            if (stat.isDirectory()) walk(full, depth + 1);
            else if (/__Linework__[0-9a-f]{10}\.svg$/.test(name) && full.indexOf('02__Viewports__Vector') !== -1) files.push(full);
        }
    };
    walk(PORTAL, 0);
    let total = 0, read = 0, kept = 0, slowest = { ms : 0, name : '' }, biggest = null;
    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        const box  = (text.match(/viewBox="([^"]+)"/) || [])[1].split(/\s+/).map(Number);
        const rec  = record({ Viewport__FrameMm : { X : 0, Y : 0, WidthMm : box[2], HeightMm : box[3] } });
        const t0   = performance.now();
        const layer = Lw.Na__PubMsLw__Build(rec, text);
        const ms   = performance.now() - t0;
        total += ms; read += layer.Stats.Read; kept += layer.Count;
        if (ms > slowest.ms) slowest = { ms, name : file.split(/[\\/]/).slice(-3).join('/') };
        if (!biggest || layer.Stats.Read > biggest.Stats.Read) biggest = layer;
    }
    console.log('        ' + files.length + ' files, ' + read + ' segments read, ' + kept + ' lines kept, ' + total.toFixed(0) + ' ms in all, slowest ' + slowest.ms.toFixed(1) + ' ms (' + slowest.name + ')');
    truthy('every file builds, the slowest in under 400 ms', files.length > 0 && slowest.ms < 400, slowest.ms + ' ms');
    if (biggest) {
        const g = biggest.Grid;
        const t0 = performance.now();
        let found = 0;
        for (let i = 0; i < 2000; i++) {
            const x = g.MinX + ((i * 7919) % 1000) / 1000 * g.Cols * g.Cell;
            const y = g.MinY + ((i * 104729) % 1000) / 1000 * g.Rows * g.Cell;
            if (Snap.Na__PubMsSnap__Find([ biggest ], x, y, { ApertureMm : 2, From : { X : x - 10, Y : y } }).Kind !== 'none') found++;
        }
        const each = (performance.now() - t0) / 2000;
        console.log('        2,000 snaps on the biggest (' + biggest.Stats.Read + ' segments): ' + (each * 1000).toFixed(0) + ' us each, ' + found + ' found something');
        truthy('a snap on the biggest drawing takes well under a frame (under 2 ms)', each < 2, each + ' ms');
    }
}

// endregion -------------------------------------------------------------------


console.log('\n' + passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
