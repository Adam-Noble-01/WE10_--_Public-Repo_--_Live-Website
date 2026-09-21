// =============================================================================
// TRUEVISION3D - TEST - SHEET IMAGES
// =============================================================================
//
// FILE       : Na__Test__SheetImages__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Sheet Images Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a picture keeps its proportions, crops without moving, paints as it should, and follows its drawing's number to R2
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - GEOMETRY and the PAINTER are leaves and are imported as they ship.
// - THE RECORD. Na__LayoutEditor__SheetRecords__ is loaded with its imports
//   stubbed (the geometry leaf is the real one) and a picture that has been
//   stretched, hatched and given a QR block is normalised.
// - THE SAVE STEP. Na__LayoutEditor__SheetImages__Publish__ is loaded with R2,
//   the local server and the source replaced by in-memory stores that behave
//   as the Worker and the Flask routes do, and driven through the three
//   phases of a save the way Na__DrawData__Save drives it: a first save, a
//   renumber, a swap of two numbers, an upload that fails, a picture on two
//   sheets, and a deletion.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SheetImages__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Print-size storage (TrueVision3D v2.121.0): StoreSize and NeedsRecut, and
//   a ninth save-step scenario - a render dropped this session is cut to 300
//   dpi at its placed size by the save, only the cut is filed, it is cut again
//   when enlarged, a picture from an earlier session is never re-encoded, and
//   a cut that fails files the drop. The encoder is stubbed by one that names
//   a cut by its size.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with Sheet Images (TrueVision3D v2.116.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | Loading
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const FEATURE    = '51__System__LayoutEditor/54__Feature__SheetImages/';

    // A LEAF AS AN .mjs COPY: the app's .js files are ES modules only to a
    // browser, and Node reads a .js file as CommonJS.
    function leafUrl(relative, tag) {
        const tmp = join(tmpdir(), 'Na__Test__SheetImages__' + tag + '__.mjs');
        writeFileSync(tmp, readFileSync(resolve(SRC, relative), 'utf8'), 'utf8');
        return pathToFileURL(tmp).href;
    }
    const GEO_URL = leafUrl(FEATURE + 'Na__LayoutEditor__SheetImages__Geometry__.js', 'Geometry');

    async function load(relative, stubs, tag) {
        let src = readFileSync(resolve(SRC, relative), 'utf8');
        const had = /^\s*import\s/m.test(src);
        src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const tmp = join(tmpdir(), 'Na__Test__SheetImages__' + tag + '__.mjs');
        writeFileSync(tmp, stubs + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

    const G = await import(GEO_URL);
    const P = await import(leafUrl(FEATURE + 'Na__LayoutEditor__SheetImages__Painter__.js', 'Painter'));

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
    const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);
    const r3   = (n) => Math.round(n * 1000) / 1000;

    console.log('TrueVision3D - sheet images');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    console.log('\n  Geometry');
    {
        const box = G.Na__LeImgGeo__Rect([ [ 10, 20 ], [ 110, 20 ], [ 110, 76.25 ], [ 10, 76.25 ] ]);
        check('the box of four corners', [ box.x0, box.y0, box.w, box.h ], [ 10, 20, 100, 56.25 ]);

        check('a crop of the whole picture is no crop', G.Na__LeImgGeo__NormaliseCrop({ L : 0, T : 0, R : 1, B : 1 }, 0.04), null);
        check('a crop is held inside the picture', G.Na__LeImgGeo__NormaliseCrop({ L : -0.2, T : 0.1, R : 1.4, B : 0.9 }, 0.04), { L : 0, T : 0.1, R : 1, B : 0.9 });
        check('a crop turned inside out is put the right way round', G.Na__LeImgGeo__NormaliseCrop({ L : 0.8, T : 0.1, R : 0.2, B : 0.9 }, 0.04), { L : 0.2, T : 0.1, R : 0.8, B : 0.9 });
        const thin = G.Na__LeImgGeo__NormaliseCrop({ L : 0.5, T : 0, R : 0.5, B : 1 }, 0.04);
        check('a crop thinner than the smallest span is widened about its middle', [ r3(thin.L), r3(thin.R) ], [ 0.48, 0.52 ]);

        check('the kept part of a 3840 x 2160 picture, cropped to its middle half across', r3(G.Na__LeImgGeo__KeptAspect(3840, 2160, { L : 0.25, T : 0, R : 0.75, B : 1 })), r3((0.5 * 3840) / 2160));

        // CROPPING NEVER MOVES THE PICTURE: crop, then crop back to the whole.
        const placed = { x0 : 40, y0 : 30, x1 : 200, y1 : 120, w : 160, h : 90 };
        const crop   = { L : 0.1, T : 0.2, R : 0.7, B : 0.9 };
        const kept   = G.Na__LeImgGeo__ApplyCrop(placed, null, crop);
        check('a crop cuts the kept part out of the same place', [ r3(kept.x0), r3(kept.y0), r3(kept.w), r3(kept.h) ], [ 56, 48, 96, 63 ]);
        const back = G.Na__LeImgGeo__ApplyCrop(kept, crop, null);
        check('and taking it off puts the whole picture back where it was', [ r3(back.x0), r3(back.y0), r3(back.w), r3(back.h) ], [ 40, 30, 160, 90 ]);
        const whole = G.Na__LeImgGeo__WholeRect(kept, crop);
        check('the whole picture behind a crop', [ r3(whole.x0), r3(whole.y0), r3(whole.w), r3(whole.h) ], [ 40, 30, 160, 90 ]);

        // CORNER SCALE: the opposite corner stays, the proportions stay.
        const start = { x0 : 10, y0 : 10, x1 : 170, y1 : 100, w : 160, h : 90 };
        const outBR = G.Na__LeImgGeo__CornerScale(start, 2, { x : 330, y : 190 }, 5, null);
        check('bottom right dragged out: top left stays', [ outBR.x0, outBR.y0 ], [ 10, 10 ]);
        check('and the picture doubles on its diagonal, unstretched', [ r3(outBR.w), r3(outBR.h) ], [ 320, 180 ]);
        const offDiag = G.Na__LeImgGeo__CornerScale(start, 2, { x : 330, y : 100 }, 5, null);
        check('a pointer off the diagonal still keeps the proportions', r3(offDiag.w / offDiag.h), r3(160 / 90));
        const inTL = G.Na__LeImgGeo__CornerScale(start, 0, { x : 90, y : 55 }, 5, null);
        check('top left dragged in: bottom right stays', [ r3(inTL.x1), r3(inTL.y1) ], [ 170, 100 ]);
        check('and it halves', [ r3(inTL.w), r3(inTL.h) ], [ 80, 45 ]);
        const crossed = G.Na__LeImgGeo__CornerScale(start, 2, { x : -500, y : -500 }, 5, null);
        check('dragged past the fixed corner, it stops at the smallest size, never turns over', [ crossed.x0, crossed.y0, r3(crossed.h) ], [ 10, 10, 5 ]);
        const snapX = G.Na__LeImgGeo__CornerScale(start, 2, { x : 250, y : 150 }, 5, { x : 253, y : 145 });
        check('a snap point lines up the edge that leaves the corner nearest the pointer (the side here)', [ snapX.snappedAxis, r3(snapX.x1) ], [ 'x', 253 ]);
        const snapY = G.Na__LeImgGeo__CornerScale(start, 2, { x : 250, y : 150 }, 5, { x : 260, y : 142 });
        check('or the bottom edge, when that one does', [ snapY.snappedAxis, r3(snapY.y1) ], [ 'y', 142 ]);
        check('a snapped corner still keeps the proportions', r3(snapY.w / snapY.h), r3(160 / 90));

        // ENFORCE: a sound picture writes nothing; a stretched one is put right.
        const sound = G.Na__LeImgGeo__RectPoints(0, 0, 160, 90);
        check('a sound picture is left exactly as it is', G.Na__LeImgGeo__Enforce(sound, 3840, 2160, null, 1) === sound, true);
        const fixed = G.Na__LeImgGeo__Enforce([ [ 0, 0 ], [ 160, 0 ], [ 160, 200 ], [ 0, 200 ] ], 3840, 2160, null, 1);
        check('a stretched picture keeps its top left and width and gets its height back', fixed.map((p) => p.map(r3)), [ [ 0, 0 ], [ 160, 0 ], [ 160, 90 ], [ 0, 90 ] ]);

        check('a composed document id is the folder', G.Na__LeImgGeo__FolderFor('RB05_T01_D01', 'Sheet_005', '00__Archive'), 'RB05_T01_D01');
        check('a typed id is made safe', G.Na__LeImgGeo__FolderFor(' RB05 / T01 : D01 ', 'Sheet_005', '00__Archive'), 'RB05-T01-D01');
        check('the archive name is never handed out', G.Na__LeImgGeo__FolderFor('00__Archive', 'Sheet_005', '00__Archive'), 'Sheet_005');
        check('nothing left takes the sheet id', G.Na__LeImgGeo__FolderFor('///', 'Sheet_005', '00__Archive'), 'Sheet_005');

        const name = G.Na__LeImgGeo__FileName('RB03_T01_V10__FrontFascade__SouthElevation__28-Aug-2026__.png', '3F9A2C1D0B7E', 'webp');
        check('a stored name: the dropped name, then the hash', name, 'RB03_T01_V10__FrontFascade__SouthElevation__28-Aug-2026__3f9a2c1d0b.webp');
        check('and it is recognised as ours', G.Na__LeImgGeo__IsManagedName(name), true);
        check('somebody\'s own file is not', G.Na__LeImgGeo__IsManagedName('RB03_T01_V10__FrontFascade__SouthElevation__28-Aug-2026__.png'), false);
        check('a name with nothing readable is still a name', G.Na__LeImgGeo__FileName('???.jpeg', 'abc', 'jpeg'), 'Image__abc0000000.jpg');

        const pdf = G.Na__LeImgGeo__PdfPixels({ w : 100 }, 3840, 2160, null, 300);
        check('100 mm wide at 300 dpi', [ pdf.w, pdf.h ], [ 1181, 664 ]);
        const small = G.Na__LeImgGeo__PdfPixels({ w : 400 }, 1200, 800, null, 300);
        check('never above the pixels it has', [ small.w, small.h ], [ 1200, 800 ]);
        check('3840 px across 162.56 mm prints at 600 dpi', Math.round(G.Na__LeImgGeo__PrintDpi({ w : 162.56 }, 3840, 2160, null)), 600);

        // THE SIZE A PICTURE IS STORED AT
        const use = (w, crop) => ({ rect : { w : w, h : w * 9 / 16 }, crop : crop || null });
        check('196.4 mm at 300 dpi: 2320 x 1305, whole steps of 16:9', G.Na__LeImgGeo__StoreSize(3840, 2160, [ use(196.4) ], 300, 4096), { w : 2320, h : 1305 });
        check('the larger of two places decides', G.Na__LeImgGeo__StoreSize(3840, 2160, [ use(100), use(196.4) ], 300, 4096), { w : 2320, h : 1305 });
        check('never above the original', G.Na__LeImgGeo__StoreSize(3840, 2160, [ use(400) ], 300, 4096), { w : 3840, h : 2160 });
        check('never above the storage edge, capped as the drop caps it', G.Na__LeImgGeo__StoreSize(7680, 4320, [ use(841) ], 300, 4096), { w : 4096, h : 2304 });
        check('a crop keeps the whole picture, at the density the kept half needs', G.Na__LeImgGeo__StoreSize(3840, 2160, [ { rect : { w : 100, h : 112.5 }, crop : { L : 0.25, T : 0, R : 0.75, B : 1 } } ], 300, 4096), { w : 2368, h : 1332 });
        check('a thumbnail is not stored below 256 px', G.Na__LeImgGeo__StoreSize(3840, 2160, [ use(5) ], 300, 4096), { w : 256, h : 144 });
        check('awkward proportions round to the nearest pixel', G.Na__LeImgGeo__StoreSize(3001, 2003, [ { rect : { w : 100, h : 66.74 } } ], 300, 4096), { w : 1181, h : 788 });
        check('no drawing shows it: nothing to size', G.Na__LeImgGeo__StoreSize(3840, 2160, [], 300, 4096), null);
        check('headroom 1.25: a quarter more', G.Na__LeImgGeo__StoreSize(3840, 2160, [ use(196.4) ], 375, 4096), { w : 2912, h : 1638 });
        check('within 5% of the stored size: not cut again', G.Na__LeImgGeo__NeedsRecut({ w : 2320, h : 1305 }, { w : 2400, h : 1350 }, 0.05), false);
        check('further than 5% either way: cut again', [ G.Na__LeImgGeo__NeedsRecut({ w : 2320, h : 1305 }, { w : 3312, h : 1863 }, 0.05), G.Na__LeImgGeo__NeedsRecut({ w : 3840, h : 2160 }, { w : 2320, h : 1305 }, 0.05) ], [ true, true ]);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painter
// -----------------------------------------------------------------------------

    console.log('\n  Painter');
    {
        const shadow = { Colour : '#1f1d18', Opacity : 0.3, BlurMm : 1.6, OffsetXMm : 0, OffsetYMm : 0.9, MarginMm : 5.7, RegionPct : 10, FilterId : 'naLeImgShadow_abc_10', PdfKey : 'shadow|abc|160.0x90.0' };
        const base = { Kind : 'picture', X : 10, Y : 20, WidthMm : 160, HeightMm : 90, PixelW : 3840, PixelH : 2160,
                       Crop : { L : 0.25, T : 0, R : 0.75, B : 1 }, Href : 'blob:x', State : 'ready',
                       Frame : { Colour : '#555041', WidthMm : 0.529 }, Shadow : shadow };
        const svg = P.Na__LeImgPaint__Svg(base);
        check('the kept part is the viewBox, in the stored file\'s pixels', /viewBox="960 0 1920 2160"/.test(svg), true);
        check('a soft shadow: a Gaussian drop shadow of the picture\'s box', /<feDropShadow dx="0" dy="0.9" stdDeviation="1.6" flood-color="#1f1d18" flood-opacity="0.3"\/>/.test(svg), true);
        check('cast by a box that carries the filter', /<rect x="10" y="20" width="160" height="90" fill="#ffffff" stroke="none" filter="url\(#naLeImgShadow_abc_10\)"\/>/.test(svg), true);
        check('shadow first, then the picture, then the frame over its edge', [ svg.indexOf('feDropShadow') < svg.indexOf('<image'), svg.indexOf('<image') < svg.indexOf('stroke="#555041"') ], [ true, true ]);
        check('the lighter frame rule is centred on the picture\'s own box', /<rect x="10" y="20" width="160" height="90" fill="none" stroke="#555041" stroke-width="0.529"\/>/.test(svg), true);
        const bare = P.Na__LeImgPaint__Svg(Object.assign({}, base, { Frame : null, Shadow : null }));
        check('frame off: no rule and no shadow', [ /stroke="#555041"/.test(bare), /feDropShadow/.test(bare) ], [ false, false ]);
        check('frame off: an empty box is left for Draft mode to outline', /<rect x="10" y="20" width="160" height="90" fill="none" stroke="none"\/>/.test(bare), true);
        const waiting = P.Na__LeImgPaint__Svg(Object.assign({}, base, { State : 'missing', Href : null, Caption : 'Picture not found: <b>&"x"' }));
        check('a missing picture is a placeholder with its name, escaped', [ /<image/.test(waiting), /&lt;b&gt;&amp;&quot;x&quot;/.test(waiting) ], [ false, true ]);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    console.log('\n  The record');
    {
        const R = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', `
            import { Na__LeImgGeo__NormaliseCrop, Na__LeImgGeo__Enforce } from '${GEO_URL}';
            const Na__LeCfg__GetShapeSetup = () => ({ defaultStrokeColour : '#000000', defaultStrokePt : 0.35 });
            const Na__LeGrad__Normalise = (g) => (g && typeof g === 'object') ? Object.assign({}, g) : null;
            const Na__LeDash__Normalise = (d) => (d && typeof d === 'object') ? Object.assign({}, d) : null;
        `, 'Records');
        const shape = R.Na__LeRec__NormaliseShape({
            Shape__Id : 'Shape_001', Shape__Points : [ [ 0, 0 ], [ 160, 0 ], [ 160, 300 ], [ 0, 300 ] ],
            Shape__Hatch : { Hatch__PatternKey : 'brick' }, Shape__Qr : { Qr__MarginMm : 2 }, Shape__FillColour : '#ff0000',
            Shape__Image : { Image__File : 'Cgi__0123456789.webp', Image__Folder : 'RB05_T01_D01', Image__PixelW : 3840, Image__PixelH : 2160,
                             Image__Crop : { L : 0, T : 0, R : 1, B : 1 }, Image__Name : 'Cgi.png', Image__Frame : false }
        }, 'Layer_009');
        check('a stretched picture is held to its proportions', shape.Shape__Points.map((p) => p.map(r3)), [ [ 0, 0 ], [ 160, 0 ], [ 160, 90 ], [ 0, 90 ] ]);
        check('and is a picture and nothing else', [ shape.Shape__Hatch, shape.Shape__Qr, shape.Shape__FillColour, shape.Shape__Stroked, shape.Shape__Closed ], [ undefined, undefined, null, false, true ]);
        check('a whole-picture crop is not stored; the frame switch is kept', [ shape.Shape__Image.Image__Crop, shape.Shape__Image.Image__Frame ], [ undefined, false ]);
        const plain = R.Na__LeRec__NormaliseShape({ Shape__Id : 'Shape_002', Shape__Points : [ [ 0, 0 ], [ 10, 0 ] ], Shape__Image : { Image__File : '' } }, 'Layer_003');
        check('a block that names no file is dropped, and the shape is a plain vector', [ plain.Shape__Image, plain.Shape__Stroked ], [ undefined, true ]);
        check('the Images layer is a layer type', R.Na__LeRec__LAYER_TYPES.indexOf('image') !== -1, true);
        const sheet = { Sheet__Layers : [ { Layer__Id : 'L1', Layer__Type : 'annotation' }, { Layer__Id : 'L4', Layer__Type : 'vector' } ] };
        check('with no Images layer a picture lands on Vectors, never on the top layer', R.Na__LeRec__DefaultLayerId(sheet, 'image'), 'L4');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Save Step
// -----------------------------------------------------------------------------

    console.log('\n  The save step');
    {
        // IN-MEMORY R2 AND DISK | Keys are 'folder/file'; the disk has an archive.
        const world = { r2 : new Map(), disk : new Map(), archive : new Map(), sheets : [], failUpload : false, copies : 0, uploads : 0, recuts : 0, failRecut : false, adopted : [] };
        globalThis.__naTestWorld = world;
        const Pub = await load(FEATURE + 'Na__LayoutEditor__SheetImages__Publish__.js', `
            import { Na__LeImgGeo__FolderFor, Na__LeImgGeo__IsManagedName, Na__LeImgGeo__Rect, Na__LeImgGeo__StoreSize, Na__LeImgGeo__NeedsRecut } from '${GEO_URL}';
            const Na__LeImgSrc__Adopt   = (file) => { globalThis.__naTestWorld.adopted.push(file); return 'blob:' + file; };
            const Na__LeImgCfg__Storage = () => ({ printDpi : 300, printHeadroom : 1, maxEdgePx : 4096 });
            // A CUT AS THE ENCODER MAKES IT: named by its bytes, which here are
            // its size; the drop's own size gives back the drop's own file.
            const Na__LeImgEnc__Recut = async (source, w, h) => {
                const Wd = globalThis.__naTestWorld;
                Wd.recuts++;
                if (Wd.failRecut) throw new Error('decode failed');
                const full = w === source.pixelW && h === source.pixelH;
                const name = full ? source.dropName : 'Cgi__' + (w * 65536 + h).toString(16).padStart(10, '0') + '.webp';
                return { blob : new Blob([ 'x'.repeat(Math.round(w * h / 10000)) ]), fileName : name, type : 'image/webp', pixelW : w, pixelH : h, reencoded : !full };
            };
            const W = globalThis.__naTestWorld;
            let Na__Test__Step = null;
            const Na__DrawData__RegisterSaveStep = (step) => { Na__Test__Step = step; globalThis.__naTestStep = step; return true; };
            const Na__DrawData__GetSheetsArray   = () => W.sheets;
            const Na__DrawData__SHEETS_KEY       = 'LayoutEditor__DrawingsData__Sheets';
            const Na__LeRec__DocumentId = (sheet) => 'RB05_' + sheet.Sheet__Fields.Sheet__Fields__Phase + '_' + sheet.Sheet__Fields.Sheet__Fields__DrawingNumber;
            const Na__CfApi__IsConfigured = () => true;
            const Na__CfApi__SHEET_IMAGES_ARCHIVE = '00__Archive';
            const Na__CfApi__ListSheetImages = async () => ({ ok : true, objects : Array.from(W.r2.keys()).map((k) => ({ key : 'P/' + k, folder : k.split('/')[0], file : k.split('/')[1] })) });
            const Na__CfApi__UploadSheetImage = async (folder, file, blob) => { if (W.failUpload) return { ok : false, error : 'offline' }; W.uploads++; W.r2.set(folder + '/' + file, blob); return { ok : true }; };
            const Na__CfApi__CopySheetImage = async (from, to, file) => { const b = W.r2.get(from + '/' + file); if (!b) return { ok : false, error : 'Not on R2' }; if (W.failUpload) return { ok : false, error : 'offline' }; W.copies++; W.r2.set(to + '/' + file, b); return { ok : true }; };
            const Na__CfApi__DeleteSheetImage = async (folder, file) => { W.r2.delete(folder + '/' + file); return { ok : true }; };
            const Na__LeImgStore__IsLocal = () => true;
            const Na__LeImgStore__Upload = async (folder, file, blob) => { W.disk.set(folder + '/' + file, blob); return { ok : true }; };
            const Na__LeImgStore__Reconcile = async (keep, options) => {
                const results = [];
                const wanted  = new Set();
                keep.forEach((item) => {
                    const key = item.folder + '/' + item.file;
                    wanted.add(key);
                    if (W.disk.has(key)) { results.push({ folder : item.folder, file : item.file, state : 'present' }); return; }
                    const found = Array.from(W.disk.keys()).find((k) => k.split('/')[1] === item.file) || Array.from(W.archive.keys()).find((k) => k.split('/')[1] === item.file);
                    if (!found) { results.push({ folder : item.folder, file : item.file, state : 'missing' }); return; }
                    W.disk.set(key, W.disk.get(found) || W.archive.get(found));
                    results.push({ folder : item.folder, file : item.file, state : 'copied', source : found.split('/')[0] });
                });
                const archived = [];
                if (options && options.archive) {
                    Array.from(W.disk.keys()).forEach((key) => {
                        if (wanted.has(key) || !Na__LeImgGeo__IsManagedName(key.split('/')[1])) return;
                        W.archive.set(key, W.disk.get(key)); W.disk.delete(key); archived.push(key);
                    });
                }
                return { ok : true, results, archived };
            };
            const Na__LeImgSrc__Blob  = async (folder, file) => W.disk.get(folder + '/' + file) || null;
            const Na__LeImgSrc__Retry = () => false;
            const Na__LeImgCfg__Label = (key, fallback, tokens) => { let t = fallback; Object.keys(tokens || {}).forEach((n) => { t = t.split('{' + n + '}').join(String(tokens[n])); }); return t; };
        `, 'Publish');
        Pub.Na__LeImgPub__Register();
        const step = globalThis.__naTestStep;

        const FILE_A = 'FrontCgi__aaaaaaaaaa.webp', FILE_B = 'RearCgi__bbbbbbbbbb.webp';
        const sheetOf = (id, number, images) => ({ Sheet__Id : id, Sheet__Fields : { Sheet__Fields__Phase : 'T01', Sheet__Fields__DrawingNumber : number },
            Sheet__Shapes : images.map((img, i) => ({ Shape__Id : 'Shape_00' + (i + 1), Shape__Image : { Image__File : img.file, Image__Folder : img.folder } })) });

        // THE SAVE, DRIVEN AS Na__DrawData__Save DRIVES IT. writeOk false is an
        // R2 write that failed: the after phase never runs.
        async function save(writeOk) {
            const notes = [];
            const ctx = { report : null, state : {}, block : null, local : null, note : (m, e) => notes.push({ m, e : !!e }) };
            await step.before(ctx);
            ctx.block = { LayoutEditor__DrawingsData__Sheets : JSON.parse(JSON.stringify(world.sheets)) };
            await step.payload(ctx);
            const written = ctx.block.LayoutEditor__DrawingsData__Sheets.flatMap((s) => s.Sheet__Shapes.map((sh) => sh.Shape__Image.Image__Folder + '/' + sh.Shape__Image.Image__File));
            if (writeOk !== false) { ctx.local = { ok : true }; await step.after(ctx); }
            return { notes, written };
        }
        const live = () => world.sheets.flatMap((s) => s.Sheet__Shapes.map((sh) => sh.Shape__Image.Image__Folder + '/' + sh.Shape__Image.Image__File));
        const keys = (map) => Array.from(map.keys()).sort();

        // 1. A picture just dropped on D01: on disk, not yet on R2.
        world.disk.set('RB05_T01_D01/' + FILE_A, new Blob([ 'A' ]));
        world.sheets = [ sheetOf('Sheet_005', 'D01', [ { file : FILE_A, folder : 'RB05_T01_D01' } ]) ];
        let out = await save();
        check('first save: the picture goes up to R2 under its drawing\'s id', keys(world.r2), [ 'RB05_T01_D01/' + FILE_A ]);
        check('and the toast says so', out.notes.map((n) => n.m), [ '1 picture(s) pushed to R2.' ]);

        // 2. A renumber: D01 becomes D03.
        world.sheets[0].Sheet__Fields.Sheet__Fields__DrawingNumber = 'D03';
        out = await save();
        check('renumber: the drawings written point at the new folder', out.written, [ 'RB05_T01_D03/' + FILE_A ]);
        check('renumber: R2 has it in the new folder, copied inside the bucket, and not in the old', [ keys(world.r2), world.copies ], [ [ 'RB05_T01_D03/' + FILE_A ], 1 ]);
        check('renumber: the disk has it in the new folder, the old copy archived', [ keys(world.disk), keys(world.archive) ], [ [ 'RB05_T01_D03/' + FILE_A ], [ 'RB05_T01_D01/' + FILE_A ] ]);
        check('renumber: the live record follows', live(), [ 'RB05_T01_D03/' + FILE_A ]);

        // 3. A swap: a second sheet takes D03, the first becomes D04.
        world.disk.set('RB05_T01_D07/' + FILE_B, new Blob([ 'B' ]));
        world.sheets.push(sheetOf('Sheet_006', 'D07', [ { file : FILE_B, folder : 'RB05_T01_D07' } ]));
        await save();
        world.sheets[0].Sheet__Fields.Sheet__Fields__DrawingNumber = 'D07';
        world.sheets[1].Sheet__Fields.Sheet__Fields__DrawingNumber = 'D03';
        out = await save();
        check('swap: each picture is filed under its own drawing\'s new id', out.written.sort(), [ 'RB05_T01_D03/' + FILE_B, 'RB05_T01_D07/' + FILE_A ].sort());
        check('swap: R2 holds exactly those two', keys(world.r2), [ 'RB05_T01_D03/' + FILE_B, 'RB05_T01_D07/' + FILE_A ].sort());
        check('swap: so does the disk', keys(world.disk), [ 'RB05_T01_D03/' + FILE_B, 'RB05_T01_D07/' + FILE_A ].sort());

        // 4. R2 goes away mid-renumber: the drawings keep pointing at a folder R2 has.
        world.failUpload = true;
        world.sheets[0].Sheet__Fields.Sheet__Fields__DrawingNumber = 'D09';
        out = await save();
        check('a failed push leaves the written pointer where R2 still has the picture', out.written.filter((k) => k.endsWith(FILE_A)), [ 'RB05_T01_D07/' + FILE_A ]);
        check('and that copy is not taken off R2', world.r2.has('RB05_T01_D07/' + FILE_A), true);
        check('and the toast says it failed', out.notes.some((n) => n.e && /could not be pushed/.test(n.m)), true);
        world.failUpload = false;
        out = await save();
        check('the next save finishes the job', [ out.written.filter((k) => k.endsWith(FILE_A)), world.r2.has('RB05_T01_D07/' + FILE_A) ], [ [ 'RB05_T01_D09/' + FILE_A ], false ]);

        // 5. A save whose drawings never reached R2 changes no live record.
        world.sheets[1].Sheet__Fields.Sheet__Fields__DrawingNumber = 'D11';
        const before = live();
        await save(false);
        check('a failed drawings write leaves every live record as it was', live(), before);
        await save();

        // 6. The same picture on two sheets: filed in both, pruned from neither.
        world.sheets[1].Sheet__Shapes.push({ Shape__Id : 'Shape_009', Shape__Image : { Image__File : FILE_A, Image__Folder : 'RB05_T01_D09' } });
        out = await save();
        check('one picture on two drawings is filed under both', [ world.r2.has('RB05_T01_D09/' + FILE_A), world.r2.has('RB05_T01_D11/' + FILE_A) ], [ true, true ]);

        // 7. Everything deleted: R2 is emptied, the disk archives, nothing is lost.
        world.sheets.forEach((s) => { s.Sheet__Shapes = []; });
        await save();
        check('every picture deleted: R2 holds none of them', keys(world.r2), []);
        check('and the disk has archived them rather than deleting them', [ world.disk.size, world.archive.has('RB05_T01_D11/' + FILE_B) ], [ 0, true ]);

        // 8. An undo brings one back: the next save restores it from the archive.
        world.sheets[1].Sheet__Shapes.push({ Shape__Id : 'Shape_010', Shape__Image : { Image__File : FILE_B, Image__Folder : 'RB05_T01_D11' } });
        const uploadsBefore = world.uploads;
        out = await save();
        check('an undone delete comes back out of the archive and up to R2', [ world.disk.has('RB05_T01_D11/' + FILE_B), world.r2.has('RB05_T01_D11/' + FILE_B), world.uploads - uploadsBefore ], [ true, true, 1 ]);

        // 9. PRINT SIZE. A 3840 x 2160 render dropped this session onto D20,
        // drawn 196.4 mm wide: held in memory with its original, nothing
        // written - and the save stores 300 dpi's worth, never the drop.
        const DROP = 'Cgi__1111111111.webp';
        const source = { blob : new Blob([ 'p'.repeat(13755) ]), name : 'Cgi.png', type : 'image/png', alpha : false, pixelW : 3840, pixelH : 2160, dropName : DROP };
        const picture = (id, x, w) => ({ Shape__Id : id, Shape__Points : G.Na__LeImgGeo__RectPoints(x, 10, w, w * 9 / 16),
            Shape__Image : { Image__File : DROP, Image__Folder : 'RB05_T01_D20', Image__PixelW : 3840, Image__PixelH : 2160, Image__SourceW : 3840, Image__SourceH : 2160 } });
        world.sheets.push({ Sheet__Id : 'Sheet_020', Sheet__Fields : { Sheet__Fields__Phase : 'T01', Sheet__Fields__DrawingNumber : 'D20' }, Sheet__Shapes : [ picture('Shape_020', 20, 196.4) ] });
        Pub.Na__LeImgPub__Hold(DROP, new Blob([ 'w'.repeat(2034) ]), source);
        const d20 = () => world.sheets.find((s) => s.Sheet__Id === 'Sheet_020');
        const img = (i) => d20().Sheet__Shapes[i || 0].Shape__Image;
        check('a picture dropped this session will be cut by the save', Pub.Na__LeImgPub__HasSource(DROP), true);
        out = await save();
        check('the save cuts it to 300 dpi at 196.4 mm: 2320 x 1305, the render\'s own 16:9', [ img().Image__PixelW, img().Image__PixelH ], [ 2320, 1305 ]);
        const CUT1 = img().Image__File;
        check('the drawings point at the cut, not the drop', [ CUT1 !== DROP, out.written.includes('RB05_T01_D20/' + CUT1) ], [ true, true ]);
        check('only the cut reaches R2 and the disk; the drop never does', [ world.r2.has('RB05_T01_D20/' + CUT1), world.r2.has('RB05_T01_D20/' + DROP), world.disk.has('RB05_T01_D20/' + DROP) ], [ true, false, false ]);
        check('the sheet draws the cut from memory at once', world.adopted.includes(CUT1), true);
        check('the toast says what was stored', out.notes.some((n) => !n.e && /^1 picture\(s\) stored at 300 dpi for their size on the sheet: \d+\.\d+ MB, from 0\.01 MB dropped\.$/.test(n.m)), true);
        check('the original still stands behind the cut this session', Pub.Na__LeImgPub__HasSource(CUT1), true);

        const cutsBefore = world.recuts;
        out = await save();
        check('saved again unchanged: no new cut, nothing to say', [ world.recuts - cutsBefore, out.notes.some((n) => /stored at/.test(n.m)) ], [ 0, false ]);
        d20().Sheet__Shapes[0].Shape__Points = G.Na__LeImgGeo__RectPoints(20, 10, 200, 112.5);
        await save();
        check('nudged 2%: still no new cut', [ world.recuts - cutsBefore, img().Image__File ], [ 0, CUT1 ]);

        // Enlarged this session: cut again, from the same original.
        d20().Sheet__Shapes[0].Shape__Points = G.Na__LeImgGeo__RectPoints(20, 10, 280, 157.5);
        out = await save();
        const CUT2 = img().Image__File;
        check('enlarged to 280 mm: cut again from the original, 3312 x 1863', [ img().Image__PixelW, img().Image__PixelH, CUT2 !== CUT1 ], [ 3312, 1863, true ]);
        check('the smaller cut comes off R2 and goes to the archive', [ world.r2.has('RB05_T01_D20/' + CUT1), world.archive.has('RB05_T01_D20/' + CUT1) ], [ false, true ]);

        // Enlarged past what the render has: back to the drop's own file.
        d20().Sheet__Shapes[0].Shape__Points = G.Na__LeImgGeo__RectPoints(20, 10, 400, 225);
        await save();
        check('wanted larger than the render: the drop\'s own file, never enlarged', [ img().Image__File, img().Image__PixelW ], [ DROP, 3840 ]);

        // The same picture twice: the larger place decides.
        d20().Sheet__Shapes[0].Shape__Points = G.Na__LeImgGeo__RectPoints(20, 10, 100, 56.25);
        d20().Sheet__Shapes.push(picture('Shape_021', 150, 150));
        d20().Sheet__Shapes[1].Shape__Image.Image__File = DROP;
        await save();
        check('one file shown twice is cut for the larger: 150 mm, 1776 x 999', [ img(0).Image__PixelW, img(1).Image__PixelW, img(0).Image__File === img(1).Image__File ], [ 1776, 1776, true ]);
        d20().Sheet__Shapes.pop();
        d20().Sheet__Shapes[0].Shape__Points = G.Na__LeImgGeo__RectPoints(20, 10, 150, 84.375);   // <-- Left at the size its file was cut for

        // A picture saved in an earlier session has no original here: left as it is.
        const OLD = 'Front__2222222222.webp';
        world.disk.set('RB05_T01_D20/' + OLD, new Blob([ 'o' ]));
        d20().Sheet__Shapes.push({ Shape__Id : 'Shape_022', Shape__Points : G.Na__LeImgGeo__RectPoints(20, 150, 196.4, 110.475),
            Shape__Image : { Image__File : OLD, Image__Folder : 'RB05_T01_D20', Image__PixelW : 3840, Image__PixelH : 2160 } });
        const cutsOld = world.recuts;
        await save();
        check('a picture from an earlier session is never re-encoded, whatever it prints at', [ img(1).Image__File, img(1).Image__PixelW, world.recuts - cutsOld, Pub.Na__LeImgPub__HasSource(OLD) ], [ OLD, 3840, 0, false ]);

        // A cut that fails files the picture as it is, rather than losing it.
        const FAIL = 'Rear__3333333333.webp';
        Pub.Na__LeImgPub__Hold(FAIL, new Blob([ 'r' ]), Object.assign({}, source, { dropName : FAIL }));
        d20().Sheet__Shapes.push({ Shape__Id : 'Shape_023', Shape__Points : G.Na__LeImgGeo__RectPoints(250, 150, 120, 67.5),
            Shape__Image : { Image__File : FAIL, Image__Folder : 'RB05_T01_D20', Image__PixelW : 3840, Image__PixelH : 2160 } });
        world.failRecut = true;
        out = await save();
        world.failRecut = false;
        check('a cut that fails: the drop is filed instead, and nothing is lost', [ img(2).Image__File, world.r2.has('RB05_T01_D20/' + FAIL) ], [ FAIL, true ]);

        // A new project forgets every original.
        Pub.Na__LeImgPub__Reset();
        check('a new project forgets the originals', Pub.Na__LeImgPub__HasSource(DROP), false);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'Every check passed'));
    process.exit(failures ? 1 : 0);

// endregion -------------------------------------------------------------------
