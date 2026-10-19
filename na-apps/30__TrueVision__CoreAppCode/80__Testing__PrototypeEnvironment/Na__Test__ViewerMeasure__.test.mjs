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
//   passed down from groups, comments ignored.
// - Only drawn lines (v2.182.0): a shape counts when it has a visible stroke,
//   its own, its group's or its style="". A fill alone, a shape that says
//   nothing of its stroke, no width, no opacity, display none, hidden, and
//   anything inside defs or a clip path are not lines.
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
// - The store (v2.182.0): the linework is fetched under the tools' own key
//   (?na-measure=1), never by the address the sheet's <image> poisoned; a
//   drawing that could not be read is read again by the next Prepare, alone;
//   Undo and Redo step through keeping, pulling, deleting and clearing, and
//   an id is never given twice.
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
    // A FILE OF DRAWN LINES: the body inside a stroked group, as the example
    // files style theirs. rawSvg leaves the body to say its own strokes.
    const rawSvg = (box, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box + '">' + body + '</svg>';
    const svg    = (box, body) => rawSvg(box, '<g fill="none" stroke="#323232" stroke-width="0.12">' + body + '</g>');

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
    check('the viewBox, two paths: a comment and a path stroked none are not lines', [ parsed.ViewBox, parsed.Paths.length ], [ [ 0, 0, 100, 50 ], 2 ]);
    check('a group passes its class and its transform down', [ parsed.Paths[0].Class, parsed.Paths[0].Matrix ], [ 'hidden', [ 1, 0, 0, 1, 10, 5 ] ]);
    check('a path keeps its own class', parsed.Paths[1].Class, 'visible');
}

console.log('\nOnly drawn lines');
{
    // EACH PATH NAMES ITSELF in its d (its x is its number), so the test can
    // say exactly which were read.
    const read = (body) => Lw.Na__PubMsLw__ParseSvg(rawSvg('0 0 100 100', body)).Paths.map((p) => Number(p.D.match(/^M(\d+)/)[1]));
    check('as published: each line strokes itself (the real files) and counts',
        read('<path data-na-class="visible" fill="none" stroke="#323232" stroke-width="0.12" d="M1,0L1,9"/>'), [ 1 ]);
    check('a solid fill with no line round it is not a line, however solid; a fill WITH a line is',
        read('<path fill="#d9d9d9" d="M1,0L1,9L5,9Z"/><path fill="#d9d9d9" stroke="#000" stroke-width="0.1" d="M2,0L2,9L5,9Z"/>'), [ 2 ]);
    check('a shape that says nothing of its stroke draws none (SVG\'s default), so it is not a line',
        read('<path d="M1,0L1,9"/><rect x="3" y="3" width="4" height="4"/>'), []);
    check('a stroke from style="" counts, and style="" wins over the attribute',
        read('<path style="stroke:#000;stroke-width:0.2" d="M1,0L1,9"/><path stroke="#000" style="stroke: none" d="M2,0L2,9"/>'), [ 1 ]);
    check('a stroke that paints nothing: none, transparent, rgba with no alpha, #RGBA and #RRGGBBAA with none',
        read('<g stroke-width="0.1"><path stroke="none" d="M1,0L1,9"/><path stroke="transparent" d="M2,0L2,9"/><path stroke="rgba(0,0,0,0)" d="M3,0L3,9"/>' +
             '<path stroke="rgb(0 0 0 / 0%)" d="M4,0L4,9"/><path stroke="#0000" d="M5,0L5,9"/><path stroke="#00000000" d="M6,0L6,9"/><path stroke="#000000ff" d="M7,0L7,9"/></g>'), [ 7 ]);
    check('no width, no stroke opacity, no opacity (on the shape or any group above it): not lines',
        read('<g stroke="#000"><path stroke-width="0" d="M1,0L1,9"/><path stroke-opacity="0" d="M2,0L2,9"/><path opacity="0" d="M3,0L3,9"/>' +
             '<g opacity="0"><path d="M4,0L4,9"/></g><g opacity="0.5"><path opacity="0.5" d="M5,0L5,9"/></g></g>'), [ 5 ]);
    check('display none hides everything below it; hidden does too, unless a shape says visible again',
        read('<g stroke="#000"><g display="none"><path d="M1,0L1,9"/><path visibility="visible" d="M2,0L2,9"/></g>' +
             '<g visibility="hidden"><path d="M3,0L3,9"/><path visibility="visible" d="M4,0L4,9"/></g><path style="display:none" d="M5,0L5,9"/></g>'), [ 4 ]);
    check('lines inside defs, a clip path, a mask or a symbol are not drawn where they stand',
        read('<defs><path stroke="#000" d="M1,0L1,9"/></defs><clipPath id="c"><rect stroke="#000" x="2" y="0" width="5" height="5"/></clipPath>' +
             '<mask id="m"><path stroke="#000" d="M3,0L3,9"/></mask><symbol id="s"><path stroke="#000" d="M4,0L4,9"/></symbol><path stroke="#000" d="M5,0L5,9"/>'), [ 5 ]);
    check('a shape written open and closed, and an unknown element, leave the groups around them as they were',
        read('<g stroke="#000"><path d="M1,0L1,9"></path><metadata>x</metadata><foo>y</foo><path d="M2,0L2,9"/></g><path d="M3,0L3,9"/>'), [ 1, 2 ]);
    check('a stroke on the svg element itself is inherited like a group\'s',
        [ read('<g><path d="M1,0L1,9"/></g>').length, Lw.Na__PubMsLw__ParseSvg('<svg viewBox="0 0 9 9" stroke="#000" stroke-width="0.1"><path d="M1,0L1,9"/></svg>').Paths.length ], [ 0, 1 ]);
    const fills = Lw.Na__PubMsLw__Build(record(), rawSvg('0 0 20 20', '<path fill="#000" d="M2,2L12,2L12,12L2,12Z"/>'));
    check('a drawing of fills alone has nothing to snap to', [ fills.Count, Snap.Na__PubMsSnap__Find([ fills ], 2.1, 2.1, { ApertureMm : 1 }).Kind ], [ 0, 'none' ]);
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
    // stubbed to read this folder from disk, and fetch stubbed the way the live
    // site answers: the CDN first, the repository copy (not served there)
    // second, and the CDN's plain address refused, as the sheet's own <image>
    // leaves it in a browser's cache (no CORS header, kept for a year).
    const loaded = {
        Ok : true,
        Sheet : JSON.parse(readFileSync(join(D01, 'Document__Sheet__.json'), 'utf8')),
        Elements : { viewport : JSON.parse(readFileSync(join(D01, '01__Elements__Data', 'Elements__Viewports__.json'), 'utf8')) }
    };
    const CDN = 'https://cdn.test/', SITE = 'https://site.test/', KEY = '?na-measure=1';
    const fetched = [];
    const flaky = new Set();                                                     // <-- Paths whose next keyed fetch fails, once
    globalThis.fetch = async (url, init) => {
        fetched.push({ Url : url, Cache : init && init.cache, Mode : init && init.mode });
        if (url.startsWith(SITE)) return new Response('not here', { status : 404 });
        const keyed = url.endsWith(KEY);
        const path = url.slice(CDN.length).replace(KEY, '');
        if (!keyed) throw new TypeError('Failed to fetch');                     // <-- The poisoned plain address
        if (flaky.has(path)) { flaky.delete(path); throw new TypeError('Failed to fetch'); }
        try { return new Response(readFileSync(join(JW02, path), 'utf8'), { status : 200 }); } catch (e) { return new Response('missing', { status : 404 }); }
    };
    const Store = await load(PUB + 'Na__PubDoc__Measure__.js', Object.assign({}, Lw, {
        Na__PubDoc__LoadDocument : async () => loaded,
        Na__PubDoc__Urls__For : (path) => [ CDN + path, SITE + path ],
        Na__PubSchema__Kind : (name) => (name === 'viewport' ? { arrayKey : 'Elements__Viewports' } : null),
        Na__PubSchema__ResolveDocumentRef : (documentId, reference) => documentId + '/' + reference
    }));
    const D = 'JW02_T01_D01';
    const summary = await Store.Na__PubMs__Summary(D);
    check('the sheet can be measured: four drawings at 1:100, all with linework', summary, { Count : 4, WithLinework : 4, Scales : [ 100 ] });
    check('nothing has been fetched yet: a reader who never measures costs nothing', fetched.length, 0);
    const progress = [];
    const prepared = await Store.Na__PubMs__Prepare(D, (p) => progress.push(p.Done + '/' + p.Total));
    check('Prepare reads the four files once each, from the CDN under the tools\' own key, never the poisoned address, and builds four layers',
        [ prepared.Ok, prepared.Layers.length, fetched.length, fetched.every((f) => f.Url.startsWith(CDN) && f.Url.endsWith(KEY) && f.Mode === 'cors'), progress[progress.length - 1] ],
        [ true, 4, 4, true, '4/4' ]);
    await Store.Na__PubMs__Prepare(D);
    check('...and asking again fetches nothing more', fetched.length, 4);

    // A DRAWING THAT CANNOT BE READ: measured without snapping meanwhile, then
    // read again, alone, by the next Prepare.
    Store.Na__PubMs__Release(D);
    const three = viewports.find((v) => v['Viewport__Id'] === 'Viewport_003');
    flaky.add(D + '/' + three['Viewport__Vector']['Vector__File']);
    fetched.length = 0;
    const first = await Store.Na__PubMs__Prepare(D);
    check('a drawing refused everywhere still gets a layer (its frame and scale, nothing to snap to), and is reported',
        [ first.Ok, first.Failed.map((f) => f.Id), Store.Na__PubMs__Layer(D, 'Viewport_003').Count, Store.Na__PubMs__Status(D).Ready, Store.Na__PubMs__Status(D).Failed ],
        [ false, [ 'Viewport_003' ], 0, true, 1 ]);
    check('...after its keyed addresses, then its plain ones past the cache (four tries for it, one each for the rest)',
        [ fetched.length, fetched.filter((f) => f.Url.indexOf('Viewport_003') !== -1).map((f) => [ f.Url.startsWith(CDN) ? 'cdn' : 'site', f.Url.endsWith(KEY) ? 'keyed' : 'plain', f.Cache ]) ],
        [ 7, [ [ 'cdn', 'keyed', 'default' ], [ 'site', 'keyed', 'default' ], [ 'cdn', 'plain', 'no-store' ], [ 'site', 'plain', 'no-store' ] ] ]);
    fetched.length = 0;
    const again = await Store.Na__PubMs__Prepare(D);
    check('the next Prepare reads that drawing again, and only that one, and now it can be snapped to',
        [ again.Ok, fetched.length, fetched.length > 0 && fetched[0].Url.indexOf('Viewport_003') !== -1, Store.Na__PubMs__Layer(D, 'Viewport_003').Count > 0, Store.Na__PubMs__Status(D).Failed ],
        [ true, 1, true, true, 0 ]);
    await Store.Na__PubMs__Prepare(D);
    check('...and with every drawing read, no more', fetched.length, 1);

    const two = viewports.find((v) => v['Viewport__Id'] === 'Viewport_002')['Viewport__FrameMm'];
    check('the drawing under a point is found from the records', Store.Na__PubMs__ViewportAt(D, two.X + two.WidthMm / 2, two.Y + two.HeightMm / 2).Id, 'Viewport_002');
    const line = (x) => ({ Tool : 'linear', ViewportId : 'Viewport_002', Scale : 100, Points : [ { X : x, Y : 2, Snap : 'end' }, { X : 3, Y : 4, Snap : 'mid' } ] });
    const kept = Store.Na__PubMs__Add(D, line(1));
    check('a measurement is kept with an id', [ kept.Id, Store.Na__PubMs__List(D).length ], [ 'Measure_001', 1 ]);
    kept.Points[1].X = 9;
    check('the list hands out copies: changing one changes nothing until it is put back', Store.Na__PubMs__List(D)[0].Points[1].X, 3);
    Store.Na__PubMs__Replace(D, kept);
    check('...and Replace puts it back', Store.Na__PubMs__List(D)[0].Points[1].X, 9);

    // UNDO AND REDO
    const ids = () => Store.Na__PubMs__List(D).map((m) => m.Id);
    check('a Replace that changes nothing is not a change', [ Store.Na__PubMs__Replace(D, kept), Store.Na__PubMs__History(D) ], [ false, { CanUndo : true, CanRedo : false } ]);
    check('Undo puts back what the pull changed', [ Store.Na__PubMs__Undo(D), Store.Na__PubMs__List(D)[0].Points[1].X ], [ true, 3 ]);
    check('...Undo again takes the measurement away (and then there is nothing left to undo); Redo brings it back under its own id',
        [ Store.Na__PubMs__Undo(D), ids(), Store.Na__PubMs__Undo(D), Store.Na__PubMs__Redo(D), ids() ], [ true, [], false, true, [ 'Measure_001' ] ]);
    check('Redo again repeats the pull, and then there is nothing left to redo',
        [ Store.Na__PubMs__Redo(D), Store.Na__PubMs__List(D)[0].Points[1].X, Store.Na__PubMs__Redo(D) ], [ true, 9, false ]);
    const second = Store.Na__PubMs__Add(D, line(2));
    Store.Na__PubMs__Undo(D);
    const third = Store.Na__PubMs__Add(D, line(3));
    check('an id is never given twice, even after its measurement was undone; a new change ends what Redo could bring back',
        [ second.Id, third.Id, ids(), Store.Na__PubMs__History(D).CanRedo ], [ 'Measure_002', 'Measure_003', [ 'Measure_001', 'Measure_003' ], false ]);
    check('Delete, then Undo, brings it back where it was',
        [ Store.Na__PubMs__Remove(D, 'Measure_001'), ids(), Store.Na__PubMs__Undo(D), ids() ], [ true, [ 'Measure_003' ], true, [ 'Measure_001', 'Measure_003' ] ]);
    Store.Na__PubMs__Release(D);
    check('leaving the sheet lets its linework go and keeps its measurements and their history',
        [ Store.Na__PubMs__Layers(D).length, Store.Na__PubMs__List(D).length, Store.Na__PubMs__Status(D).Asked, Store.Na__PubMs__History(D).CanUndo ], [ 0, 2, false, true ]);
    check('Clear says how many went, and one Undo brings them all back',
        [ Store.Na__PubMs__Clear(D), ids(), Store.Na__PubMs__Undo(D), ids() ], [ 2, [], true, [ 'Measure_001', 'Measure_003' ] ]);
    check('Remove or Clear of nothing is false or none, and not a change',
        [ Store.Na__PubMs__Remove(D, 'Measure_999'), Store.Na__PubMs__Clear('JW02_T01_D99'), Store.Na__PubMs__History(D) ], [ false, 0, { CanUndo : true, CanRedo : true } ]);
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
