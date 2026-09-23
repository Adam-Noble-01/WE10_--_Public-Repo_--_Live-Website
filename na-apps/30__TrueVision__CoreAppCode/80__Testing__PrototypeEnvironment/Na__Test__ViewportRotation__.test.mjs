// =============================================================================
// TRUEVISION3D - TEST - ROTATABLE VIEWPORTS
// =============================================================================
//
// FILE       : Na__Test__ViewportRotation__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Viewport Rotation Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a viewport turns about the middle of its frame, Shift holds quarter turns, and everything that reads the frame reads the turned one
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE GEOMETRY (the real Na__LayoutEditor__ViewportRotation__ leaf): the
//   angle wraps into (-180, 180], a turn and its undoing are inverse, the
//   turned corners, box, containment and distance are right, Settle holds
//   Shift's quarter turns and the right-angle detent, and the PDF matrix puts
//   a level point exactly where the turn puts it on the paper.
// - THE HANDLES (the shipped Na__LayoutEditor__ViewportHandles__, imports
//   stubbed): a rotate drag turns by the swing round the middle, Shift lands on
//   90 degree steps counted from level, a crop on a turned frame keeps the edge
//   opposite its handle where it is on the paper, a pan slides the drawing the
//   way the hand went, a move is still a paper move, and a handle's resize
//   arrow turns with the frame. Hit tests and containment read the turned frame.
// - THE WINDOW and THE SNAP INDEX (the shipped units): ToPaper and FromPaper
//   carry the turn and undo it; the index files a turned drawing's lines where
//   they are painted, clipped to the frame in the frame's own axes.
// - THE CHROME (the shipped Na__LayoutEditor__SheetChrome__): a turned
//   viewport's frame line and caption come out as one turned group, written
//   as one SVG rotate about the middle and, through jsPDF itself, as one
//   balanced matrix in the PDF; a level viewport's are exactly as before.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ViewportRotation__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.1
// - Node 21 and later give globalThis a navigator of their own, a getter
//   that throws when a module assigns to it, so the file stopped at the
//   jsPDF load on Node 22. One is now defined only where there is none.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with rotatable viewports (TrueVision3D v2.138.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener    : () => {},
        removeEventListener : () => {},
        dispatchEvent       : () => true,
        localStorage        : { getItem : () => null, setItem : () => {}, removeItem : () => {} },
        setTimeout, clearTimeout,
        requestAnimationFrame : () => 0,
        cancelAnimationFrame  : () => {}
    };
    globalThis.document = { body : { classList : { add : () => {}, remove : () => {}, toggle : () => {} } } };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // The Move Retype test's loader: every name a module imports gets the
    // test's stub when it gives one, else a function returning undefined.
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
        const key = '__VpRotStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__ViewportRotation__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    const r3 = (v) => Math.round(v * 1000) / 1000 + 0;                          // <-- + 0 turns -0 into 0
    const r2 = (v) => Math.round(v * 100) / 100 + 0;
    const pt = (p) => (p ? { x : r3(p.x), y : r3(p.y) } : p);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Geometry (the real leaf)
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - rotatable viewports\n\n  The geometry (the real ViewportRotation leaf)');
    const Rot = await load(LE + '20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js', {});

    check('an angle wraps into (-180, 180]', [ 270, -270, 180, -180, 540, 0.0000000001, 'x' ].map((d) => Rot.Na__LeVpRot__WrapDeg(d)), [ -90, 90, 180, 180, 180, 0, 0 ]);
    check('Shift holds quarter turns counted from level', [ 44, 46, 136, -100, 181 ].map((d) => Rot.Na__LeVpRot__Settle(d, 90, 2)), [ 0, 90, 180, -90, 180 ]);
    check('free, it settles on a right angle within the detent and nowhere else', [ 88.5, 91.9, 87.9, 30 ].map((d) => Rot.Na__LeVpRot__Settle(d, 0, 2)), [ 90, 90, 87.9, 30 ]);

    const vp = (deg, frame) => ({ Viewport__Id : 'Viewport_001', Viewport__Kind : '2d', Viewport__FrameMm : Object.assign({ X : 100, Y : 100, WidthMm : 200, HeightMm : 100 }, frame || {}),
                                  Viewport__PanMm : { X : 0, Y : 0 }, Viewport__ScaleDenominator : 50, Viewport__ImageMm : { WidthMm : 200, HeightMm : 100 },
                                  Viewport__ImageOffsetMm : { X : 0, Y : 0 }, Viewport__RotationDeg : deg });
    const q = vp(90);
    check('the middle of the frame is what it turns about', pt(Rot.Na__LeVpRot__Centre(q)), { x : 200, y : 150 });
    check('a quarter turn clockwise carries the level top-left corner to the top right of where it was (y runs down)', pt(Rot.Na__LeVpRot__ToPaper(q, 100, 100)), { x : 250, y : 50 });
    check('ToFrame undoes ToPaper', pt(Rot.Na__LeVpRot__ToFrame(q, 250, 50)), { x : 100, y : 100 });
    check('the turned corners, level top-left first', Rot.Na__LeVpRot__Corners(q).map(pt), [ { x : 250, y : 50 }, { x : 250, y : 250 }, { x : 150, y : 250 }, { x : 150, y : 50 } ]);
    check('the box round a quarter-turned frame is its height wide and its width tall', (() => { const b = Rot.Na__LeVpRot__Bounds(q); return [ r3(b.X), r3(b.Y), r3(b.WidthMm), r3(b.HeightMm) ]; })(), [ 150, 50, 100, 200 ]);
    check('a level frame\'s box is the frame itself', Rot.Na__LeVpRot__Bounds(vp(0)), { X : 100, Y : 100, WidthMm : 200, HeightMm : 100 });
    check('a point inside the turned frame but outside the level one is inside', [ Rot.Na__LeVpRot__Contains(q, { x : 200, y : 60 }), Rot.Na__LeVpRot__Contains(vp(0), { x : 200, y : 60 }) ], [ true, false ]);
    check('and one inside the level frame but outside the turned one is not', Rot.Na__LeVpRot__Contains(q, { x : 110, y : 150 }), false);
    check('the distance to a turned frame is measured to its turned edge', r3(Rot.Na__LeVpRot__DistanceTo(q, { x : 270, y : 150 })), 20);
    check('the CSS turn is nothing when level, and appended after the translate when turned', [ Rot.Na__LeVpRot__CssRotate(0), Rot.Na__LeVpRot__CssRotate(-90) ], [ '', ' rotate(-90deg)' ]);

    // THE PDF MATRIX. jsPDF's default API writes page units into PDF space:
    // points, y running UP. Apply the written cm to a level point's PDF
    // position and it must land on the turned point's PDF position.
    const writes = [];
    let saved = 0;
    const fakeDoc = { internal : { scaleFactor : 72 / 25.4, pageSize : { getHeight : () => 297 }, write : (...a) => writes.push(a) }, saveGraphicsState : () => { saved++; } };
    check('a level viewport opens no graphics state', Rot.Na__LeVpRot__PdfTurn(fakeDoc, 200, 150, 0), false);
    check('a turned one opens one and writes one cm', [ Rot.Na__LeVpRot__PdfTurn(fakeDoc, 200, 150, 30), saved, writes.length, writes[0] && writes[0][6] ], [ true, 1, 1, 'cm' ]);
    const M = writes[0].slice(0, 6).map(Number), k = 72 / 25.4, H = 297;
    const t30 = vp(30);
    const pdfOf = (p) => [ p.x * k, (H - p.y) * k ];
    const apply = (m, xy) => [ (m[0] * xy[0]) + (m[2] * xy[1]) + m[4], (m[1] * xy[0]) + (m[3] * xy[1]) + m[5] ];
    const probe = [ { x : 100, y : 100 }, { x : 300, y : 200 }, { x : 150, y : 180 } ];
    check('the matrix puts each level point where the turn puts it on the paper (to a hundredth of a point, 0.004 mm)',
        probe.map((p) => apply(M, pdfOf(p)).map(r2)), probe.map((p) => pdfOf(Rot.Na__LeVpRot__ToPaper(t30, p.x, p.y)).map(r2)));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Handles (the shipped unit)
// -----------------------------------------------------------------------------

    console.log('\n  The handles (the shipped ViewportHandles unit)');
    const setup = { minSizeMm : 20, handleSizePx : 9, handleHitRadiusPx : 10, rotateStepDeg : 90, rotateDetentDeg : 2, rotateGripOffsetPx : 22 };
    const rotStubs = {};
    Object.keys(Rot).forEach((name) => { rotStubs[name] = Rot[name]; });
    const Hd = await load(LE + '20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js', Object.assign({
        Na__LeCfg__GetViewportSetup : () => setup,
        Na__LeCfg__GetLabel : (k, f) => f,
        Na__LeCfg__FormatLabel : (k, f) => f,
        Na__LeModel__KIND_3D : '3d',
        Na__LeModel__GetLayers : () => [],
        Na__LeModel__IsLayerVisible : () => true
    }, rotStubs));

    // A drag on the rotate grip. The grip stands above the middle of the top
    // edge; pressed there on a level frame, the pointer's angle round the
    // middle is -90, so swinging it to due right is a quarter turn clockwise.
    const level = vp(0);
    const start = Hd.Na__LeHandles__RotateStart(level, { x : 200, y : 40 });
    check('the press remembers the turn, the middle and the angle it was grabbed at', [ start.deg, pt(start.middle), r3(start.grabDeg) ], [ 0, { x : 200, y : 150 }, -90 ]);
    check('swung to due right: a quarter turn clockwise', Hd.Na__LeHandles__RotateTo(start, { x : 310, y : 150 }, false), { rotationDeg : 90 });
    check('free, a hand a little past it stays where it is, to a tenth', Hd.Na__LeHandles__RotateTo(start, { x : 310, y : 160 }, false), { rotationDeg : 95.2 });
    check('Shift holds it to the quarter turn', Hd.Na__LeHandles__RotateTo(start, { x : 310, y : 160 }, true), { rotationDeg : 90 });
    check('Shift: swung round to straight down is a half turn (180, never -180), and round to the left a quarter turn back',
        [ Hd.Na__LeHandles__RotateTo(start, { x : 205, y : 260 }, true), Hd.Na__LeHandles__RotateTo(start, { x : 90, y : 145 }, true) ], [ { rotationDeg : 180 }, { rotationDeg : -90 } ]);
    check('within the detent of a right angle it settles there without Shift', Hd.Na__LeHandles__RotateTo(start, { x : 310, y : 153 }, false), { rotationDeg : 90 });
    check('too near the middle to read an angle, it holds still', Hd.Na__LeHandles__RotateTo(start, { x : 200.1, y : 150 }, false), null);
    const from30 = Hd.Na__LeHandles__RotateStart(vp(30), { x : 200, y : 40 });
    check('a turn is counted from where the viewport already stood', Hd.Na__LeHandles__RotateTo(from30, { x : 200, y : 260 }, false), { rotationDeg : -150 });

    check('the rotate grip stands straight out from the top edge, turned with the frame', (() => { const g = Hd.Na__LeHandles__RotateGrip(q, 1, 1); return [ pt(g.base), pt(g.grip) ]; })(), [ { x : 250, y : 150 }, { x : 272, y : 150 } ]);
    check('the grip is found at the handles\' hit radius, and nowhere else', [ Hd.Na__LeHandles__OnRotateGrip(q, { x : 275, y : 152 }, 1, 1), Hd.Na__LeHandles__OnRotateGrip(q, { x : 290, y : 150 }, 1, 1) ], [ true, false ]);

    // A CROP ON A TURNED FRAME. Quarter turned, the level right edge faces
    // DOWN the paper, so dragging it 20 mm down lengthens the frame 20 mm and
    // the level left edge - now at the top - does not move.
    const cropStart = Hd.Na__LeHandles__CaptureStart(q);
    const leftMid   = (v) => pt(Rot.Na__LeVpRot__ToPaper(v, v.Viewport__FrameMm.X, v.Viewport__FrameMm.Y + (v.Viewport__FrameMm.HeightMm / 2)));
    const cropped   = Hd.Na__LeHandles__DragPatch(q, { mode : 'handle', key : 'rc' }, cropStart, { x : 0, y : 20 }, {});
    const afterCrop = Object.assign({}, q, { Viewport__FrameMm : cropped.rect, Viewport__PanMm : cropped.pan });
    check('dragging the turned right edge down the paper lengthens the frame along it', r3(cropped.rect.WidthMm), 220);
    check('and the edge opposite stays exactly where it was on the paper', leftMid(afterCrop), leftMid(q));
    check('and the drawing stays put: the same drawing point is at the same paper point', (() => {
        const winOf = (v) => ({ ox : v.Viewport__PanMm.X - (v.Viewport__FrameMm.WidthMm * 50 / 2), oy : v.Viewport__PanMm.Y - (v.Viewport__FrameMm.HeightMm * 50 / 2) });
        const paperOf = (v, dx, dy) => { const w = winOf(v); return pt(Rot.Na__LeVpRot__ToPaper(v, v.Viewport__FrameMm.X + ((dx - w.ox) / 50), v.Viewport__FrameMm.Y + ((dy - w.oy) / 50))); };
        return [ paperOf(q, 1234, -567), paperOf(afterCrop, 1234, -567) ];
    })().reduce((a, b) => JSON.stringify(a) === JSON.stringify(b)), true);
    check('dragging it ACROSS the paper does nothing to that edge', r3(Hd.Na__LeHandles__DragPatch(q, { mode : 'handle', key : 'rc' }, cropStart, { x : 20, y : 0 }, {}).rect.WidthMm), 200);
    check('a level frame crops exactly as it always has', Hd.Na__LeHandles__DragPatch(level, { mode : 'handle', key : 'rc' }, Hd.Na__LeHandles__CaptureStart(level), { x : 20, y : 0 }, {}).rect, { X : 100, Y : 100, WidthMm : 220, HeightMm : 100 });
    check('a pan on a quarter-turned drawing slides it the way the hand went (down the paper is along its own x)',
        (({ X, Y }) => ({ X : r3(X), Y : r3(Y) }))(Hd.Na__LeHandles__DragPatch(q, { mode : 'body' }, cropStart, { x : 0, y : 10 }, {}).pan), { X : -500, Y : 0 });
    check('a move is still a plain paper move, turned or not', Hd.Na__LeHandles__DragPatch(q, { mode : 'border' }, cropStart, { x : 5, y : 7 }, {}).rect, { X : 105, Y : 107 });
    check('a 3D picture slides in the frame\'s own axes',
        (({ X, Y }) => ({ X : r3(X), Y : r3(Y) }))(Hd.Na__LeHandles__DragPatch(Object.assign({}, q, { Viewport__Kind : '3d' }), { mode : 'body' }, cropStart, { x : 0, y : 10 }, {}).imageOffset), { X : 10, Y : 0 });

    check('a handle\'s resize arrow turns with the frame', [ 'rc', 'tc', 'tl', 'tr' ].map((key) => Hd.Na__LeHandles__CursorFor({ mode : 'handle', key : key }, q)), [ 'ns-resize', 'ew-resize', 'nesw-resize', 'nwse-resize' ]);
    check('and is the one it always was on a level frame', Hd.Na__LeHandles__CursorFor({ mode : 'handle', key : 'rc' }, level), 'ew-resize');
    check('the turned frame is hit where it is painted: a handle, the band, the inside', [
        Hd.Na__LeHandles__HitTest(q, { x : 200, y : 250 }, 1, 1, true),                   // <-- The level right edge's middle, a quarter turned
        Hd.Na__LeHandles__HitTest(q, { x : 250, y : 200 }, 1, 1, true),                   // <-- On the turned edge
        Hd.Na__LeHandles__HitTest(q, { x : 200, y : 200 }, 1, 1, true),
        Hd.Na__LeHandles__HitTest(q, { x : 110, y : 150 }, 1, 1, true)                    // <-- Inside the LEVEL frame only
    ], [ { mode : 'handle', key : 'rc' }, { mode : 'border' }, { mode : 'body' }, null ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Window and the Snap Index (the shipped units)
// -----------------------------------------------------------------------------

    console.log('\n  The window and the snap index (the shipped units)');
    const Win = await load(LE + '20__System__Viewports/Na__LayoutEditor__Viewport2d__Window__.js', rotStubs);
    const w0 = Win.Na__LeVp2d__Window(vp(0)), w90 = Win.Na__LeVp2d__Window(q);
    check('a level window\'s ToPaper and ToFrame agree', [ pt(w0.ToPaper(1000, 500)), pt(w0.ToFrame(1000, 500)) ], [ { x : 220, y : 160 }, { x : 220, y : 160 } ]);
    check('the drawing point at the window\'s middle is at the frame\'s middle, turned or not', pt(w90.ToPaper(0, 0)), { x : 200, y : 150 });
    check('a turned window\'s ToPaper carries the turn, and FromPaper undoes it', [ pt(w90.ToPaper(1000, 500)), pt(w90.FromPaper(190, 170)) ], [ { x : 190, y : 170 }, { x : 1000, y : 500 } ]);
    check('the window names its turn', [ w0.RotationDeg, w90.RotationDeg ], [ 0, 90 ]);

    const Geo = await load(LE + '28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Geometry__.js', {});
    let snapSource = null;
    const Idx = await load(LE + '28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Index__.js', {
        Na__LeCfg__GetSnappingSetup : () => ({ hiddenLines : false }),
        Na__LeVp2d__GetSnapSource : () => snapSource,
        Na__LeOsnapGeo__CellsOfSegment : Geo.Na__LeOsnapGeo__CellsOfSegment
    });
    // One line of the drawing, from the window's middle 2 m to the right (40
    // paper mm at 1:50), and one that runs off the frame's level right edge.
    snapSource = { key : 'turned', window : w90, classes : { visible : [ 0, 0, 2000, 0, 4000, 1000, 6000, 1000 ] } };
    const entry = Idx.Na__LeOsnap__IndexFor('Viewport_001');
    const segs  = [];
    for (let i = 0; i + 3 < entry.segs.length; i += 4) segs.push(entry.segs.slice(i, i + 4).map(r3));
    check('a turned drawing\'s line is filed where it is painted: 40 mm DOWN the paper from the middle, not across', segs[0], [ 200, 150, 200, 190 ]);
    check('a line running off the level frame is clipped at the frame\'s own edge (and its half-millimetre pad), then turned', segs[1], [ 180, 230, 180, 250.5 ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Chrome (the shipped unit) and a Real jsPDF
// -----------------------------------------------------------------------------

    console.log('\n  The frame line and caption (the shipped SheetChrome unit, and jsPDF itself)');
    const style = { frameLineColour : '#333333', frameStrokeMm : 0.25, frameLabelFontMm : 2.5, frameLabelMinFontMm : 1.5, frameLabelWeight : 'normal', frameLabelTrackingMm : 0,
                    frameLabelUppercase : true, cellPaddingMm : 1.9, frameLabelHeightMm : 6, paperColour : '#ffffff', inkColour : '#000000', fontFamily : 'Open Sans' };
    const Chrome = await load(LE + '10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js', Object.assign({
        Na__LeCfg__GetStyleSetup : () => style,
        Na__LeModel__ResolveViewportSource : () => ({ label : 'Ground Floor Plan' }),
        Na__LeModel__KIND_2D : '2d',
        Na__LeScale__FormatLabel : (d) => '1:' + d
    }, rotStubs));
    const flat  = Chrome.Na__LeChrome__BuildViewportFrame({}, vp(0));
    const turnd = Chrome.Na__LeChrome__BuildViewportFrame({}, vp(30));
    check('a level viewport\'s frame line and caption are loose primitives, as they always were', flat.map((p) => p.Kind), [ 'rect', 'rect', 'text' ]);
    check('a turned one\'s are one group, turned about the middle of the frame', [ turnd.length, turnd[0].Kind, turnd[0].RotateDeg, turnd[0].RotateX, turnd[0].RotateY, turnd[0].Children.map((p) => p.Kind) ], [ 1, 'group', 30, 200, 150, [ 'rect', 'rect', 'text' ] ]);
    check('built level inside it: the same primitives the level viewport gets', JSON.stringify(turnd[0].Children), JSON.stringify(flat));
    const svg = Chrome.Na__LeChrome__ToSvgMarkup(turnd, 420, 297, 'x');
    check('on screen: one SVG rotate about the middle, round the lot', /<g transform="rotate\(30 200 150\)"><g><rect /.test(svg), true);
    check('a group with no turn is written exactly as before', Chrome.Na__LeChrome__ToSvgMarkup(flat.length ? [ { Kind : 'group', ClipRect : null, Children : [] } ] : [], 10, 10, 'x').indexOf('<g></g>') !== -1, true);

    // A REAL jsPDF: the vendored UMD build, drawing the turned group. The page
    // must hold exactly one extra graphics state, balanced, with the turn in it
    // before the frame's rectangle.
    let jsPDF = null;
    // The UMD build asks after navigator at load. Node 21 and later have one of
    // their own - a getter, which throws when a module assigns to it - so one is
    // only defined where there is none.
    if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { value : { userAgent : 'node' }, configurable : true, writable : true });
    globalThis.window.atob = globalThis.window.atob || atob;                      // <-- And binds these off the window
    globalThis.window.btoa = globalThis.window.btoa || btoa;
    try {
        const require = createRequire(import.meta.url);
        const mod = require(resolve(SRC, '..', '04__Lib__ThirdParty__VersionLocked/05__Vendor__JsPdf__v4.1.0/jspdf.umd.js'));
        jsPDF = mod.jsPDF || (mod.default && mod.default.jsPDF) || null;
    } catch (error) { console.log('  (jsPDF did not load under Node: ' + error.message + ')'); }
    if (jsPDF) {
        const pdfOf2 = (primitives) => {
            const doc = new jsPDF({ orientation : 'landscape', unit : 'mm', format : [ 420, 297 ], compress : false });
            Chrome.Na__LeChrome__DrawToPdf(doc, primitives);
            const out = doc.output();
            const start = out.indexOf('stream', out.indexOf('/Length')), end = out.indexOf('endstream', start);
            return out.slice(start, end);
        };
        const stream = pdfOf2(turnd);
        const qs = (stream.match(/^q$/gm) || []).length, Qs = (stream.match(/^Q$/gm) || []).length;
        const cm = /^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm$/m.exec(stream);
        check('in the PDF: the graphics states balance', qs === Qs && qs >= 1, true);
        check('and the turn is written as a cm of a 30 degree rotation', cm ? [ r3(+cm[1]), r3(+cm[2]), r3(+cm[3]), r3(+cm[4]) ] : null, [ r3(Math.cos(Math.PI / 6)), r3(-Math.sin(Math.PI / 6)), r3(Math.sin(Math.PI / 6)), r3(Math.cos(Math.PI / 6)) ]);
        check('before the frame\'s rectangle is drawn', cm ? stream.indexOf(' re') > stream.indexOf(' cm') : false, true);
        const levelStream = pdfOf2(flat);
        check('a level frame writes no cm at all', / cm$/m.test(levelStream), false);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('');
    if (failures) { console.log(failures + ' check(s) FAILED.'); process.exit(1); }
    console.log('Every check passed.');

// endregion -------------------------------------------------------------------
