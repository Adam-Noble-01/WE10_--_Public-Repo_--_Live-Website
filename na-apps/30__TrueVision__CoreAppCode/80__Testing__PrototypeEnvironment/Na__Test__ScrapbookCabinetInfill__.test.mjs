// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - CABINET INFILL
// =============================================================================
//
// FILE       : Na__Test__ScrapbookCabinetInfill__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Parametric Scrapbook Cabinet Infill Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the cabinet infill draws Adam's house infill - the dashed cross, the hugging box, the words where LayOut puts them - and that its fill, its words, its corner, adopt and refit hold
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The Cabinet Infill type imports NOTHING, so the one file is copied into a
//   scratch folder beside a package.json that tells Node it is an ES module
//   and run against the app's own config file, exactly as the editor runs it.
// - THE CHECK THAT MATTERS MOST IS THE BOX. The house infill was measured from
//   the vector PDF of NP03 D07 Rev C, where every Storage label sits in an
//   8.978 x 3.034 mm box with its baseline 0.856 mm below the box's middle.
//   The measurer handed to the type here is Open Sans Regular's own advance
//   widths (read off the TTF the app embeds in its PDFs, kerning ignored as
//   jsPDF ignores it), so the box the type draws is compared with the box
//   Adam drew, to the thousandth, rather than with a number typed in twice.
// - The second is the ORDER: the origin is the first point of the first
//   vector with the fill on and off, the words are one record, and switching
//   the fill on adds exactly one vector at the front - the engine rebuilds an
//   element slot for slot, so anything else would rewrite the wrong record.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookCabinetInfill__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - The fill's own rule: on by default at Soft Black 0.3 pt, read back and
//   kept when restyled or taken off by hand, same as the box's.
//
// 21-Sep-2026 - Version 1.1.0
// - The base point and the corners, after Adam used it: the bottom left
//   corner is the base, the other three are corner grips each holding the
//   one opposite, and the options arrow stands beside the label's box. The
//   single stretch corner's checks go with it.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with the Cabinet Infill.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test, Its Config and Open Sans
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const FEATURE    = join(APP, '51__System__LayoutEditor', '57__Feature__ScrapbookParametric');
    const MODULE     = 'Na__LayoutEditor__ScrapbookParametric__CabinetInfill__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-cabinetinfill-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');     // <-- So the copy's .js name loads as an ES module
    copyFileSync(join(FEATURE, MODULE), join(SCRATCH, MODULE));
    const infill     = await import(pathToFileURL(join(SCRATCH, MODULE)).href);
    const whole      = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const config     = whole['LayoutEditor__ScrapbookParametric__CabinetInfill'];
    const elements   = whole['LayoutEditor__ScrapbookParametric__Elements'];
    const labels     = whole['LayoutEditor__ScrapbookParametric__Labels'];

    // OPEN SANS REGULAR | Advance widths of the printable ASCII cut, in font
    // units of 2048 to the em, read with fontTools from
    // 01__Assets__NaApps__CommonAssets/NaApps__CommonFonts/CommonFont-01__OpenSans__Regular__.ttf
    const UPM      = 2048;
    const ADVANCES = '32:532,33:541,34:816,35:1323,36:1171,37:1693,38:1492,39:449,40:604,41:604,42:1128,43:1171,44:530,45:659,46:538,47:751,48:1171,49:1171,50:1171,51:1171,52:1171,53:1171,54:1171,55:1171,56:1171,57:1171,58:538,59:538,60:1171,61:1171,62:1171,63:884,64:1836,65:1295,66:1323,67:1290,68:1486,69:1138,70:1057,71:1489,72:1510,73:572,74:550,75:1254,76:1069,77:1842,78:1542,79:1593,80:1232,81:1593,82:1264,83:1123,84:1128,85:1493,86:1221,87:1891,88:1183,89:1145,90:1172,91:670,92:751,93:670,94:1171,95:897,96:568,97:1138,98:1253,99:981,100:1253,101:1150,102:689,103:1112,104:1256,105:517,106:517,107:1076,108:517,109:1896,110:1256,111:1232,112:1253,113:1253,114:837,115:976,116:730,117:1256,118:1023,119:1587,120:1072,121:1026,122:960,123:768,124:1125,125:768,126:1171'
        .split(',').reduce((table, pair) => { const [ code, units ] = pair.split(':'); table[Number(code)] = Number(units); return table; }, {});
    const measureTextMm = (text, sizeMm) => String(text).split('').reduce((sum, ch) => sum + (ADVANCES[ch.charCodeAt(0)] || UPM / 2), 0) / UPM * sizeMm;
    const REAL = { measureTextMm : measureTextMm, lineSpacing : () => 1.2, metricsReady : () => true };

    // NP03 D07 REV C | The Storage labels as the PDF draws them (PyMuPDF, 21-Sep-2026)
    const NP03 = { boxLengthMm : 8.978, boxDepthMm : 3.034, baselineBelowMiddleMm : 0.856, shelvingBoxLengthMm : 9.631, textSizeMm : 6 * 25.4 / 72 };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const near   = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-9 : tolerance);
    const build  = (params, tools) => infill.Na__LeParamInfill__Build(config, params, tools === undefined ? REAL : tools);
    const shapes = (built) => built.records.filter((entry) => entry.kind === 'shape').map((entry) => entry.record);
    const texts  = (built) => built.records.filter((entry) => entry.kind === 'annotation').map((entry) => entry.record);
    const span   = (record, axis) => { const v = record.Shape__Points.map((p) => p[axis]); return Math.max.apply(null, v) - Math.min.apply(null, v); };
    const lo     = (record, axis) => Math.min.apply(null, record.Shape__Points.map((p) => p[axis]));
    const moved  = (built) => ({ shapes : shapes(built).map((r) => JSON.parse(JSON.stringify(r))), texts : texts(built).map((r) => JSON.parse(JSON.stringify(r))) });
    const defined = (patch) => Object.keys(patch).filter((key) => patch[key] !== undefined);

    console.log('TrueVision3D - parametric scrapbook cabinet infill');

    // THE HOUSE NUMBERS | What the NP03 PDF says, and the config holds
    check('the lines are #333333 at 0.15 pt, dashed 0.9 pt on 0.9 pt (0.32 mm, as the record keeps it)',
        config.CabinetInfill__LineColour === '#333333' && config.CabinetInfill__LinePt === 0.15 && config.CabinetInfill__DashMm === 0.32 && config.CabinetInfill__GapMm === 0.32
        && near(0.9 * 25.4 / 72, 0.32, 0.003));
    check('the words are Open Sans Regular 6 pt (2.1167 mm) in #333333, in a #fcfcfc box',
        near(config.CabinetInfill__TextSizeMm, NP03.textSizeMm, 0.0005) && config.CabinetInfill__TextWeight === 400 && config.CabinetInfill__TextColour === '#333333' && config.CabinetInfill__BoxFillColour === '#fcfcfc');
    check('the fill underneath is white, and a dropped infill has it off',
        config.CabinetInfill__FillColour === '#ffffff' && infill.Na__LeParamInfill__Standard(config).Fill === false);
    check('the fill\'s rule is Soft Black at 0.3 pt - Adam\'s Vectors standard',
        config.CabinetInfill__FillLineColour === '#333333' && config.CabinetInfill__FillLinePt === 0.3);
    check('the words offered are Adam\'s five, in his order, then Shelving from his screenshot - and Storage is what a drop says',
        infill.Na__LeParamInfill__Presets(config).join('|') === 'Storage|Services|Full Height Storage|Wardrobes|Pantry Unit|Shelving' && infill.Na__LeParamInfill__Standard(config).Label === 'Storage',
        infill.Na__LeParamInfill__Presets(config));

    // THE ORDER | The origin first, the cross, the box, the words
    const plain = build({});
    const ps    = shapes(plain);
    check('fill off: three vectors and one text - the two lines of the cross, the box, the words',
        ps.length === 3 && texts(plain).length === 1 && plain.records[3].kind === 'annotation', ps.length);
    check('the first vector is the cross\'s first line and its first point is the origin',
        plain.records[0].kind === 'shape' && ps[0].Shape__Points[0][0] === 0 && ps[0].Shape__Points[0][1] === 0 && ps[0].Shape__Closed === false);
    check('the cross runs exactly corner to corner: (0,0)-(36,12) and (36,0)-(0,12)',
        JSON.stringify(ps[0].Shape__Points) === '[[0,0],[36,12]]' && JSON.stringify(ps[1].Shape__Points) === '[[36,0],[0,12]]', [ ps[0].Shape__Points, ps[1].Shape__Points ]);
    check('both lines are drawn in the house line: #333333, 0.15 pt, dashed 0.32 on 0.32, unfilled',
        [ ps[0], ps[1] ].every((r) => r.Shape__StrokeColour === '#333333' && r.Shape__StrokePt === 0.15 && r.Shape__FillColour === null && r.Shape__Stroked === true
            && r.Shape__LineStyle && r.Shape__LineStyle.LineStyle__Kind === 'dashed' && r.Shape__LineStyle.LineStyle__DashMm === 0.32 && r.Shape__LineStyle.LineStyle__GapMm === 0.32));
    check('the box is filled #fcfcfc under the same dashed #333333 0.15 pt rule',
        ps[2].Shape__Closed === true && ps[2].Shape__FillColour === '#fcfcfc' && ps[2].Shape__StrokeColour === '#333333' && ps[2].Shape__StrokePt === 0.15 && ps[2].Shape__LineStyle.LineStyle__DashMm === 0.32);

    const filled = build({ Fill : true });
    const fs     = shapes(filled);
    check('fill on: exactly one vector more, and it is the FIRST - painted under everything',
        fs.length === ps.length + 1 && fs[0].Shape__Closed === true && fs[0].Shape__FillColour === '#ffffff', fs.length);
    check('...ruled round in Soft Black at 0.3 pt, so the white does not read as a hole',
        fs[0].Shape__Stroked === true && fs[0].Shape__StrokeColour === '#333333' && fs[0].Shape__StrokePt === 0.3);
    check('the fill\'s first point is still the origin, and it covers the infill exactly',
        fs[0].Shape__Points[0][0] === 0 && fs[0].Shape__Points[0][1] === 0 && near(span(fs[0], 0), 36) && near(span(fs[0], 1), 12));
    check('behind the fill the order is unchanged: cross, cross, box, words',
        JSON.stringify(fs.slice(1)) === JSON.stringify(ps) && JSON.stringify(texts(filled)) === JSON.stringify(texts(plain)));

    // THE BOX | Adam's, to the thousandth
    const across = texts(plain)[0];
    const box    = ps[2];
    check('across: the box round Storage is 8.978 x 3.034 mm, as on NP03',
        near(span(box, 0), NP03.boxLengthMm, 0.001) && near(span(box, 1), NP03.boxDepthMm, 0.001), [ span(box, 0), span(box, 1) ]);
    check('the box is centred on the cabinet',
        near(lo(box, 0) + (span(box, 0) / 2), 18, 1e-9) && near(lo(box, 1) + (span(box, 1) / 2), 6, 1e-9));
    check('the words are one centred record at the house size, level, their baseline 0.856 mm below the box\'s middle',
        across.Annotation__Text === 'Storage' && across.Annotation__Align === 'center' && near(across.Annotation__SizeMm, 2.1167) && across.Annotation__RotationDeg === undefined
        && near(across.Annotation__PosXMm, 18) && near(across.Annotation__PosYMm - 6, NP03.baselineBelowMiddleMm, 0.001), across);
    const shelving = shapes(build({ Label : 'Shelving' }))[2];
    check('Shelving\'s box is 9.631 mm, as on NP03', near(span(shelving, 0), NP03.shelvingBoxLengthMm, 0.001), span(shelving, 0));

    // UPRIGHT | Taller than wide reads up the sheet, its feet to the right
    const tall  = build({ WidthMm : 12, HeightMm : 36 });
    const up    = texts(tall)[0];
    const upBox = shapes(tall)[2];
    check('an infill taller than it is wide turns its words a quarter turn back: they read UP the sheet',
        up.Annotation__RotationDeg === -90, up.Annotation__RotationDeg);
    check('its box stands upright, 3.034 wide and 8.978 tall, centred on the cabinet',
        near(span(upBox, 0), NP03.boxDepthMm, 0.001) && near(span(upBox, 1), NP03.boxLengthMm, 0.001) && near(lo(upBox, 1) + (span(upBox, 1) / 2), 18, 1e-9), [ span(upBox, 0), span(upBox, 1) ]);
    check('its baseline is 0.856 mm to the RIGHT of the box\'s middle - the words\' feet face right - and level with the middle along it',
        near(up.Annotation__PosXMm - 6, NP03.baselineBelowMiddleMm, 0.001) && near(up.Annotation__PosYMm, 18), [ up.Annotation__PosXMm, up.Annotation__PosYMm ]);
    check('told to, a tall infill keeps its words across, and a wide one turns them up',
        texts(build({ WidthMm : 12, HeightMm : 36, Orientation : 'horizontal' }))[0].Annotation__RotationDeg === undefined
        && texts(build({ Orientation : 'vertical' }))[0].Annotation__RotationDeg === -90);
    check('a square infill reads across', texts(build({ WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }))[0].Annotation__RotationDeg === undefined);

    // THE WORDS FIT | Broken at spaces, evenly, only when they must
    const pantry = texts(build({ WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }))[0];
    check('Pantry Unit in a 600 mm square unit at 1:50 breaks over two lines', pantry.Annotation__Text === 'Pantry\nUnit', pantry.Annotation__Text);
    const full16 = texts(build({ WidthMm : 16, HeightMm : 12, Label : 'Full Height Storage' }))[0];
    check('Full Height Storage breaks "Full Height / Storage", never "Full / Height Storage"', full16.Annotation__Text === 'Full Height\nStorage', full16.Annotation__Text);
    check('Full Height Storage stays on one line where it fits (36 x 12)', texts(build({ Label : 'Full Height Storage' }))[0].Annotation__Text === 'Full Height Storage');
    const twoLineBox = shapes(build({ WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }))[2];
    check('a two-line box is one line height deeper (1.2 x 2.1167 mm) and stays centred',
        near(span(twoLineBox, 1), NP03.boxDepthMm + (1.2 * 2.1167), 0.001) && near(lo(twoLineBox, 1) + (span(twoLineBox, 1) / 2), 6, 1e-9), span(twoLineBox, 1));
    check('its first baseline sits half a line height above where one line\'s would',
        near(pantry.Annotation__PosYMm, 6 + NP03.baselineBelowMiddleMm - ((1.2 * 2.1167) / 2), 0.001), pantry.Annotation__PosYMm);
    check('a single word is never cut, however small the cabinet', texts(build({ WidthMm : 4, HeightMm : 3 }))[0].Annotation__Text === 'Storage');
    check('the break follows the editor\'s own line spacing when it gives one',
        near(span(shapes(build({ WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }, Object.assign({}, REAL, { lineSpacing : () => 1.5 })))[2], 1), NP03.boxDepthMm + (1.5 * 2.1167), 0.001));
    check('with no measurer at all (Node, or before the editor hands one over) it still draws',
        texts(build({}, {}))[0].Annotation__Text === 'Storage' && shapes(build({}, {})).length === 3);

    // OWN WORDS | Typed words win, and clearing them puts the list back
    check('typed words win over the listed word', texts(build({ Label : 'Wardrobes', LabelText : '  Linen   Cupboard ' }))[0].Annotation__Text === 'Linen Cupboard');
    check('clearing them puts the listed word back', texts(build({ Label : 'Wardrobes', LabelText : '' }))[0].Annotation__Text === 'Wardrobes');
    check('labelOf says which it is', JSON.stringify(infill.Na__LeParamInfill__LabelOf(config, { LabelText : 'Linen' })) === JSON.stringify({ text : 'Linen', typed : true }));

    // PARAMETERS | Whole, held, and lean
    const norm = infill.Na__LeParamInfill__Normalise(config, { WidthMm : 36.123456789, TextSizeMm : 2.11749, FillColour : '#FFFFFF', LineColour : '#333333', BoxFill : '#FCFCFC' });
    check('a size keeps four decimals, and so does the text size (6 pt is 2.1167 mm)', norm.WidthMm === 36.1235 && norm.TextSizeMm === 2.1175, norm);
    check('a style that IS the house style is not stored, whatever its case', !('FillColour' in norm) && !('LineColour' in norm) && !('BoxFill' in norm), Object.keys(norm));
    check('normalising twice changes nothing',
        JSON.stringify(infill.Na__LeParamInfill__Normalise(config, norm)) === JSON.stringify(norm));
    const odd = infill.Na__LeParamInfill__Normalise(config, { FillColour : '#e8e0d0', LineDash : null, BoxFill : null, Orientation : 'sideways', WidthMm : -4, Fill : 'yes' });
    check('a real choice is kept - a colour, a solid line (null), no box fill (null) - and nonsense is not',
        odd.FillColour === '#e8e0d0' && odd.LineDash === null && odd.BoxFill === null && odd.Orientation === 'auto' && odd.WidthMm === 2 && odd.Fill === false, odd);
    check('the kept choices are what gets drawn',
        (() => { const b = build(Object.assign({}, odd, { Fill : true, WidthMm : 36 })); const s = shapes(b); return s[0].Shape__FillColour === '#e8e0d0' && s[1].Shape__LineStyle === null && s[3].Shape__FillColour === null; })());

    // THE BASE POINT AND THE CORNERS | Adam, after using it: "make the insertion
    // point ... the bottom left, like a proper XY", and "you should be able to
    // drag all three of the other corners"
    const handles = infill.Na__LeParamInfill__Handles(config, { WidthMm : 20, HeightMm : 30 }, REAL);
    check('the base point is the bottom left corner - (0, height) from the top left origin, paper y running down',
        JSON.stringify(infill.Na__LeParamInfill__Base(config, { WidthMm : 20, HeightMm : 30 })) === '{"x":0,"y":30}' && handles.base.x === 0 && handles.base.y === 30 && handles.base.away.join() === '0,0', handles.base);
    check('the other three corners are grips, named, each ON its corner',
        JSON.stringify(handles.corners.map((c) => [ c.name, c.x, c.y, c.away.join() ])) === '[["tl",0,0,"0,0"],["tr",20,0,"0,0"],["br",20,30,"0,0"]]', handles.corners);
    check('no stretch arrow, no slide, no link socket', handles.stretch === null && handles.slide === null && handles.link === null);
    const gripBox = shapes(build({ WidthMm : 20, HeightMm : 30 }))[2];
    check('the options arrow stands just off the right of the label\'s box, level with its middle - beside the words, not on a corner',
        near(handles.lookup.x, lo(gripBox, 0) + span(gripBox, 0)) && near(handles.lookup.y, lo(gripBox, 1) + (span(gripBox, 1) / 2)) && handles.lookup.away.join() === '1,0', [ handles.lookup, lo(gripBox, 0) + span(gripBox, 0) ]);
    const wide = infill.Na__LeParamInfill__Handles(config, {}, REAL);
    const wideBox = shapes(build({}))[2];
    check('...and beside a label that reads across, too', near(wide.lookup.x, lo(wideBox, 0) + span(wideBox, 0)) && near(wide.lookup.y, 6));

    const corner = (params, name, x, y, exact) => infill.Na__LeParamInfill__CornerTo(config, params, name, x, y, exact);
    const heldAt = (params, result, name) => {                                // <-- Where the corner opposite ends up, from the old origin
        const w = result.params.WidthMm, h = result.params.HeightMm, s = result.shift;
        return { tl : [ s.x + w, s.y + h ], tr : [ s.x, s.y + h ], br : [ s.x, s.y ] }[name];
    };
    const start = { WidthMm : 36, HeightMm : 12 };
    const br = corner(start, 'br', 20.04, 7.06);
    check('bottom right, dragged free: both sides step by 0.1 mm and the top left stays put', br.params.WidthMm === 20 && br.params.HeightMm === 7.1 && br.shift.x === 0 && br.shift.y === 0, br);
    const tr = corner(start, 'tr', 40.03, 2.02);
    check('top right: the bottom left - the base point - stays put, and the origin moves down to the new top',
        tr.params.WidthMm === 40 && tr.params.HeightMm === 10 && JSON.stringify(heldAt(start, tr, 'tr')) === '[0,12]' && near(tr.shift.y, 2), tr);
    const tl = corner(start, 'tl', 5.03, 3.02);
    check('top left: the bottom right stays put, and the origin moves to the new corner',
        tl.params.WidthMm === 31 && tl.params.HeightMm === 9 && JSON.stringify(heldAt(start, tl, 'tl')) === '[36,12]' && near(tl.shift.x, 5) && near(tl.shift.y, 3), tl);
    const exact = corner(start, 'tl', 5.043217, 3.061994, true);
    check('a corner snapped to the drawing is kept where it was snapped, and the one held does not creep',
        near(exact.shift.x, 5.0432, 1e-9) && near(exact.shift.y, 3.062, 1e-9) && near(heldAt(start, exact, 'tl')[0], 36, 1e-9) && near(heldAt(start, exact, 'tl')[1], 12, 1e-9), exact);
    const past = corner(start, 'tl', 50, 30);
    check('a corner dragged past the one held stops at the least size, the held corner still where it was',
        past.params.WidthMm === config.CabinetInfill__SizeMinMm && past.params.HeightMm === config.CabinetInfill__SizeMinMm && JSON.stringify(heldAt(start, past, 'tl')) === '[36,12]', past);
    check('the base point is not a corner to drag: it moves the infill', corner(start, 'bl', 1, 1).shift.x === 0 && corner(start, 'bl', 1, 1).params.WidthMm === 36);
    check('dragging a corner leaves every other choice as it was',
        (() => { const s = corner({ WidthMm : 36, HeightMm : 12, Label : 'Wardrobes', Fill : true, FillColour : '#e8e0d0' }, 'tr', 50, -8).params; return s.Label === 'Wardrobes' && s.Fill === true && s.FillColour === '#e8e0d0'; })());

    // THE MENU | The words, the fill, the way the words run
    const menu = infill.Na__LeParamInfill__Choices(config, { Label : 'Services' }, { fill : 'White fill underneath' });
    check('the triangle lists the six words with the one in use ticked, then the fill, then the three runs',
        menu.filter((item) => item.patch && item.patch.Label).map((item) => item.label).join('|') === 'Storage|Services|Full Height Storage|Wardrobes|Pantry Unit|Shelving'
        && menu.find((item) => item.checked && item.patch && item.patch.Label).label === 'Services'
        && menu.filter((item) => item.patch && 'Orientation' in item.patch).length === 3 && menu.filter((item) => item.separator).length === 2, menu.map((item) => item.label || '---'));
    check('picking a word clears any typed over it; the fill entry toggles',
        JSON.stringify(menu[0].patch) === JSON.stringify({ Label : 'Storage', LabelText : '' }) && menu.find((item) => item.patch && 'Fill' in item.patch).patch.Fill === true);
    check('no word is ticked while typed words are in force', infill.Na__LeParamInfill__Choices(config, { LabelText : 'Linen' }, {}).every((item) => !(item.checked && item.patch && item.patch.Label)));

    // ADOPT | What was restyled by hand is read back; the geometry never is
    const base = { Fill : true };
    const untouched = infill.Na__LeParamInfill__Adopt(config, base, moved(build(base)));
    check('members exactly as built adopt nothing', defined(untouched).length === 0, untouched);
    const hand = moved(build(base));
    hand.shapes[0].Shape__FillColour = '#E8E0D0';                              // <-- The fill given a colour inside the group
    hand.shapes[0].Shape__StrokePt = 0.5;                                     // <-- ...and its own rule made heavier
    hand.shapes[1].Shape__StrokeColour = '#808080';                           // <-- One line of the cross made mid-grey
    hand.shapes[1].Shape__LineStyle = null;                                   // <-- ...and solid
    hand.shapes[3].Shape__Stroked = false;                                    // <-- The box's rule taken off
    hand.texts[0].Annotation__Colour = '#172b3a';
    hand.shapes[2].Shape__Points = [ [ 5, 5 ], [ 9, 9 ] ];                    // <-- The other line bent by hand
    const adopted = infill.Na__LeParamInfill__Adopt(config, base, hand);
    check('the fill\'s colour and rule weight, the cross\'s colour and dash, the box\'s rule and the words\' colour are read back',
        adopted.FillColour === '#e8e0d0' && adopted.FillLinePt === 0.5 && adopted.LineColour === '#808080' && adopted.LineDash === null && adopted.BoxStroked === false && adopted.TextColour === '#172b3a', adopted);
    check('no geometry is read back', !('WidthMm' in adopted) && !('HeightMm' in adopted));
    const rebuilt = build(infill.Na__LeParamInfill__Normalise(config, Object.assign({}, base, adopted)));
    check('the rebuild keeps them, and puts the bent line back corner to corner',
        shapes(rebuilt)[0].Shape__FillColour === '#e8e0d0' && shapes(rebuilt)[0].Shape__StrokePt === 0.5 && shapes(rebuilt)[1].Shape__StrokeColour === '#808080' && shapes(rebuilt)[2].Shape__LineStyle === null
        && JSON.stringify(shapes(rebuilt)[2].Shape__Points) === '[[36,0],[0,12]]' && shapes(rebuilt)[3].Shape__Stroked === false && texts(rebuilt)[0].Annotation__Colour === '#172b3a');

    const bareFill = moved(build(base));
    bareFill.shapes[0].Shape__Stroked = false;                                // <-- The fill's rule taken off by hand, the fill itself kept
    const bareAdopted = infill.Na__LeParamInfill__Adopt(config, base, bareFill);
    check('the fill\'s rule can be taken off by hand and kept, same as the box\'s',
        bareAdopted.FillStroked === false, bareAdopted);
    const bareRebuilt = build(infill.Na__LeParamInfill__Normalise(config, Object.assign({}, base, bareAdopted)));
    check('...and the rebuild draws the fill with no rule, the box\'s still stroked',
        shapes(bareRebuilt)[0].Shape__Stroked === false && shapes(bareRebuilt)[0].Shape__FillColour === '#ffffff' && shapes(bareRebuilt)[3].Shape__Stroked === true);
    const back = moved(rebuilt);
    back.shapes[0].Shape__FillColour = '#ffffff';
    check('a colour set back to the house one takes its key off again',
        (() => { const p = infill.Na__LeParamInfill__Adopt(config, infill.Na__LeParamInfill__Normalise(config, Object.assign({}, base, adopted)), back); return 'FillColour' in p && p.FillColour === undefined; })());
    const typed = moved(build({}));
    typed.texts[0].Annotation__Text = 'Linen\nCupboard';
    check('words typed over the label inside the group become its own words', infill.Na__LeParamInfill__Adopt(config, {}, typed).LabelText === 'Linen Cupboard');
    const broken = moved(build({ WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }));
    check('a label the type broke over lines is not mistaken for typed words', !('LabelText' in infill.Na__LeParamInfill__Adopt(config, { WidthMm : 12, HeightMm : 12, Label : 'Pantry Unit' }, broken)));
    const gone = moved(build(base));
    gone.shapes.splice(3, 1);                                                  // <-- The box deleted by hand
    gone.shapes.splice(1, 1);                                                  // <-- ...and one line
    const survivor = infill.Na__LeParamInfill__Adopt(config, base, gone);
    check('members deleted by hand do not make the others read as something else', defined(survivor).length === 0, survivor);

    // REFIT | Only the box's length, and only when it is wrong
    const estimated = moved(build({}, {}));                                    // <-- Drawn to the chrome's estimate
    check('a box drawn to the estimate is found not to fit the real words', infill.Na__LeParamInfill__Misfits(config, {}, REAL, estimated) === true);
    check('a box drawn to the real words fits', infill.Na__LeParamInfill__Misfits(config, {}, REAL, moved(build({}))) === false);
    check('an upright one is measured along its height', infill.Na__LeParamInfill__Misfits(config, { WidthMm : 12, HeightMm : 36 }, REAL, moved(build({ WidthMm : 12, HeightMm : 36 }))) === false);
    const noBox = moved(build({}));
    noBox.shapes.splice(2, 1);
    check('a box taken away by hand is not a reason to rebuild', infill.Na__LeParamInfill__Misfits(config, {}, REAL, noBox) === false);

    // THE TYPE AND ITS TILE | What the engine and the panel are told
    const type = infill.Na__LeParamInfill__CreateType(() => config, () => ({}));
    check('the type is CabinetInfill, never tied to a drawing, held by a base point and fitted by its corners',
        type.type === 'CabinetInfill' && type.linkable === false && typeof type.base === 'function' && typeof type.cornerTo === 'function' && type.stretchTo === undefined
        && typeof type.adopt === 'function' && typeof type.refit === 'function' && type.hasBar() === false);
    check('its build puts the origin first, as the engine requires', (() => { const b = type.build({}, REAL); return b.records[0].record.Shape__Points[0].join() === '0,0'; })());
    const tile = (elements.Elements__List || []).find((element) => element.Element__Type === 'CabinetInfill');
    check('the library offers it on architectural sheets, sized 1800 x 600 real when dropped on a drawing',
        !!tile && tile.Element__Name === 'Cabinet Infill' && JSON.stringify(tile.Element__DrawingTypes) === '["architectural"]' && JSON.stringify(tile.Element__RealSizeMm) === '[1800,600]', tile);
    check('which at 1:50 is exactly the 36 x 12 mm a tile is drawn at',
        tile.Element__RealSizeMm[0] / 50 === config.CabinetInfill__WidthMm && tile.Element__RealSizeMm[1] / 50 === config.CabinetInfill__HeightMm);
    check('the group tag calls it Cabinet Infill', elements.Elements__TypeNames.CabinetInfill === 'Cabinet Infill');
    check('every word the panel, the menu and the grip ask for is in the config',
        [ 'GripCorner', 'PropsInfillReads', 'PropsInfillLabel', 'PropsInfillText', 'PropsInfillTyped', 'PropsInfillRun', 'PropsInfillRunAuto', 'PropsInfillRunAcross', 'PropsInfillRunUp',
          'PropsInfillFill', 'PropsInfillFillColour', 'PropsInfillWidth', 'PropsInfillHeight', 'PropsInfillTextSize', 'PropsInfillOnDrawing', 'PropsInfillOffDrawing', 'PropsInfillKept',
          'MenuInfillFill', 'MenuInfillAuto', 'MenuInfillAcross', 'MenuInfillUp' ].every((key) => typeof labels['Labels__' + key] === 'string' && labels['Labels__' + key] !== ''));

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
