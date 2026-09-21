// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - DRAWING TITLE
// =============================================================================
//
// FILE       : Na__Test__ScrapbookDrawingTitle__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Parametric Scrapbook Drawing Title Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the parametric drawing title draws the title Adam letters by hand - text, underline and scale bar, each where he puts it - and that its words, placeholders, grips and limits hold
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The drawing title module imports two other pure modules by relative path,
//   so the three are copied into a scratch folder laid out like the editor's,
//   beside a package.json that tells Node they are ES modules. It then runs
//   exactly as the app runs it, against the app's own config file.
// - THE FIXTURE IS ADAM'S TITLE. HOUSE_TITLE below is the object he grouped by
//   hand on PS02 D22 Elevations under the existing east elevation (A2, 1:50):
//   the text, the underline and the first cell of the scale bar, read on
//   19-Sep-2026 to the digits the file holds. It is written out here rather
//   than read from the project, so the test does not change when that drawing
//   does. The five other elevation titles on the sheet agree with it.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookDrawingTitle__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.3.0
// - Five millimetres past the words: the rule, on RB05's own front elevation
//   title (103.47 mm of words, underlined 93.2 mm when it was drawn to the
//   chrome's estimate); the same on the paper at every scale; a tenth that
//   stays a tenth; the bar to the right that may shorten the run but never
//   below the words; and Misfits, the refit's question - which asks about
//   the underline's length and nothing else.
//
// 20-Sep-2026 - Version 1.2.0
// - The bar stood away to the right: where it lands (its foot on the title's
//   baseline, its offset measured from the ORIGIN so a longer title cannot
//   shove it), the two grips swapping ends, the slide that steps in 50 mm or
//   lands exactly on a snapped vertex, and the stretch run backwards - which
//   is proved the only way that matters, by adding and taking off divisions
//   and asserting the FAR END HAS NOT MOVED.
//
// 20-Sep-2026 - Version 1.1.0
// - ViewLevel: a title tied to a floor plan letters its storey, a title saved
//   before there was one reads as it did, and a change of scale keeps it.
//
// 20-Sep-2026 - Version 1.0.0
// - Written with the drawing title.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test and Its Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const EDITOR     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor');
    const FEATURE    = '57__Feature__ScrapbookParametric';
    const VIEWPORTS  = '20__System__Viewports';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-drawingtitle-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');     // <-- So the copies' .js names, which their imports spell out, load as ES modules
    mkdirSync(join(SCRATCH, FEATURE));
    mkdirSync(join(SCRATCH, VIEWPORTS));
    [ [ FEATURE, 'Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js' ], [ FEATURE, 'Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js' ], [ VIEWPORTS, 'Na__LayoutEditor__ViewportTitleText__.js' ] ]
        .forEach(([ folder, file ]) => copyFileSync(join(EDITOR, folder, file), join(SCRATCH, folder, file)));
    const title  = await import(pathToFileURL(join(SCRATCH, FEATURE, 'Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js')).href);
    const whole  = JSON.parse(readFileSync(join(EDITOR, FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const config = whole['LayoutEditor__ScrapbookParametric__DrawingTitle'];
    const barCfg = whole['LayoutEditor__ScrapbookParametric__ScaleBar'];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fixture: the Title Adam Lettered by Hand
// -----------------------------------------------------------------------------

    const HOUSE_TITLE = {
        text      : { value : 'EXISTING EAST ELEVATION', x : 16.80579776391191, y : 175.49824197203137, sizeMm : 3.5, weight : 600, colour : '#172b3a', align : 'left' },
        underline : { from : [ 16.97667558129477, 177.12935601557436 ], to : [ 76.97667558129477, 177.12935601557436 ], strokePt : 0.4, colour : '#172b3a' },
        barTopLeft : [ 16.9767, 183.4474 ]                                      // <-- The first cell of the scale bar beneath
    };
    const EAST = { ViewKind : 'elevation', ViewPhase : 'existing', ViewFacing : 'East' };

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
    const build  = (params, tools) => title.Na__LeParamTitle__Build(config, barCfg, params, null, tools);
    const shapes = (built) => built.records.filter((entry) => entry.kind === 'shape').map((entry) => entry.record);
    const texts  = (built) => built.records.filter((entry) => entry.kind === 'annotation').map((entry) => entry.record);

    console.log('TrueVision3D - parametric scrapbook drawing title');

    // THE HOUSE TITLE | Text, underline and bar, each where Adam puts it
    const house = build(Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, EAST));
    const line  = shapes(house)[0];
    const label = texts(house)[0];
    const H     = HOUSE_TITLE;
    check('the first record is the underline, and its first point is the origin', house.records[0].kind === 'shape' && line.Shape__Points[0][0] === 0 && line.Shape__Points[0][1] === 0 && line.Shape__Closed === false);
    check('the underline is Adam\'s: 60 mm, 0.4 pt, #172b3a', near(line.Shape__Points[1][0], H.underline.to[0] - H.underline.from[0], 1e-6) && line.Shape__Points[1][1] === 0 && line.Shape__StrokePt === H.underline.strokePt && line.Shape__StrokeColour === H.underline.colour, line);
    check('the title says what Adam lettered', label.Annotation__Text === H.text.value, label.Annotation__Text);
    check('the title is set as Adam sets it: 3.5 mm, 600, #172b3a, ranged left', label.Annotation__SizeMm === H.text.sizeMm && label.Annotation__FontWeight === H.text.weight && label.Annotation__Colour === H.text.colour && label.Annotation__Align === H.text.align);
    check('the title stands where Adam stands it over the underline, to a thousandth of a millimetre',
        near(label.Annotation__PosXMm, H.text.x - H.underline.from[0], 0.001) && near(label.Annotation__PosYMm, H.text.y - H.underline.from[1], 0.001),
        [ label.Annotation__PosXMm, H.text.x - H.underline.from[0], label.Annotation__PosYMm, H.text.y - H.underline.from[1] ]);
    const firstCell = shapes(house)[1];
    check('the scale bar hangs where Adam hangs it under the underline, to a thousandth, sharing its left end',
        near(firstCell.Shape__Points[0][0], H.barTopLeft[0] - H.underline.from[0], 0.001) && near(firstCell.Shape__Points[0][1], H.barTopLeft[1] - H.underline.from[1], 0.001),
        [ firstCell.Shape__Points[0], H.barTopLeft[1] - H.underline.from[1] ]);
    check('with its bar: the underline, the ten cells of the house 1:50 bar, the title and six numerals', shapes(house).length === 11 && texts(house).length === 7, [ shapes(house).length, texts(house).length ]);
    check('every vector comes before every text, so the engine\'s slots never move', house.records.map((entry) => entry.kind).join().replace(/shape,/g, 's').replace(/annotation,?/g, 'a') === 'sssssssssssaaaaaaa', house.records.map((entry) => entry.kind[0]).join(''));
    check('the title is always the first text, ahead of the bar\'s numerals', texts(house)[0].Annotation__Text === H.text.value && texts(house)[1].Annotation__Text === '0');

    // WITHOUT ITS BAR | A group of two: still a group
    const bare = build(Object.assign({ ShowScaleBar : false }, EAST));
    check('without its bar it is exactly the underline and the title', bare.records.length === 2 && bare.records[0].kind === 'shape' && bare.records[1].kind === 'annotation');
    check('the config\'s default carries the bar', build(EAST).records.length > 2);

    // THE WORDS ARE FACTS
    check('a proposed north elevation', texts(build({ ViewKind : 'elevation', ViewPhase : 'proposed', ViewFacing : 'North' }))[0].Annotation__Text === 'PROPOSED NORTH ELEVATION');
    const waiting = build({ ViewKind : 'elevation', ViewPhase : 'existing', ViewFacing : '' });
    check('north not set: EXISTING {{DIRECTION}} ELEVATION, and the build says it is unresolved', texts(waiting)[0].Annotation__Text === 'EXISTING {{DIRECTION}} ELEVATION' && waiting.title.resolved === false && waiting.title.missing.join() === 'direction', waiting.title);
    check('tied to nothing: {{DRAWING}}', texts(build({}))[0].Annotation__Text === '{{DRAWING}}');
    check('a plan takes its drawing\'s name', texts(build({ ViewKind : 'plan', ViewPhase : 'existing', ViewDrawing : 'Ground Floor Plan' }))[0].Annotation__Text === 'EXISTING GROUND FLOOR PLAN');
    check('a typed viewport name is the subject', texts(build({ ViewKind : 'elevation', ViewPhase : 'proposed', ViewFacing : 'East', ViewName : 'Front Elevation' }))[0].Annotation__Text === 'PROPOSED FRONT ELEVATION');
    const D21 = { ViewKind : 'plan', ViewPhase : 'proposed', ViewLevel : 'Ground Floor Plan', ViewName : 'Proposed Floor Plan', ViewDrawing : 'Floor Plan 1' };
    check('PS02 D21: a plan with a storey letters it, over the viewport\'s typed "Proposed Floor Plan"', texts(build(D21))[0].Annotation__Text === 'PROPOSED GROUND FLOOR PLAN', texts(build(D21))[0].Annotation__Text);
    check('PS02 D21: and says the subject came from the storey', build(D21).title.source === 'level' && build(D21).title.resolved === true, build(D21).title);
    check('a title saved before there was a ViewLevel reads exactly as it did', texts(build({ ViewKind : 'plan', ViewPhase : 'proposed', ViewName : 'Proposed Floor Plan', ViewDrawing : 'Floor Plan 1' }))[0].Annotation__Text === 'PROPOSED FLOOR PLAN');
    check('a roof plan letters ROOF PLAN', texts(build({ ViewKind : 'plan', ViewPhase : 'existing', ViewLevel : 'Roof Plan', ViewDrawing : 'Roof Plan' }))[0].Annotation__Text === 'EXISTING ROOF PLAN');
    check('a storey is made whole like any fact: one line, trimmed, text only', title.Na__LeParamTitle__Normalise(config, barCfg, { ViewLevel : '  First\n Floor  Plan ' }).ViewLevel === 'First Floor Plan' && title.Na__LeParamTitle__Normalise(config, barCfg, { ViewLevel : 7 }).ViewLevel === '');
    check('a typed title replaces it all, as typed', texts(build(Object.assign({ TitleText : '  Street   scene ' }, EAST)))[0].Annotation__Text === 'Street scene');
    check('capitals off, qualifier off', texts(build(Object.assign({ Uppercase : false, PhaseMode : 'none' }, EAST)))[0].Annotation__Text === 'East Elevation');
    check('the same parameters build the same records, byte for byte', JSON.stringify(build(Object.assign({ ScaleDenominator : 100 }, EAST))) === JSON.stringify(build(Object.assign({ ScaleDenominator : 100 }, EAST))));

    // THE UNDERLINE | At least its set length, and always five millimetres past the words
    const measure  = (mm) => ({ measureTextMm : () => mm });
    const lineEnd  = (built) => shapes(built)[0].Shape__Points[1][0];
    const wordsEnd = (width) => config.DrawingTitle__TextOffsetXMm + width;  // <-- Where the words stop, from the origin: the text is set a hair left of it
    check('the config carries the rule: 5 mm past the words, 5 mm clear of a bar to the right', config.DrawingTitle__UnderlinePastTextMm === 5 && config.DrawingTitle__UnderlineBarGapMm === 5);
    check('no way to measure text: the underline is its set length', lineEnd(build(EAST)) === 60);
    check('a title whose words end more than 5 mm short of the set length leaves it alone', lineEnd(build(EAST, measure(48.2))) === 60);
    check('a longer title is underlined FIVE MILLIMETRES past the end of its words, rounded up to a tenth', lineEnd(build(EAST, measure(75))) === 79.9, lineEnd(build(EAST, measure(75))));
    check('the set length alone is not enough when the words end within 5 mm of it', lineEnd(build(EAST, measure(57))) === 61.9, lineEnd(build(EAST, measure(57))));
    const RB05 = { ViewKind : 'elevation', ViewPhase : 'proposed', ViewFacing : 'South East', ViewName : 'South East Elevation - House Front Fascade', BarPlacement : 'right', BarOffsetMm : 216.595, ScaleDenominator : 100 };
    const rb05 = build(RB05, measure(103.47));
    check('RB05\'s front elevation: its 103.47 mm of words end, and its underline runs on 5 mm past them (it was drawn 93.2 mm long)',
        lineEnd(rb05) - wordsEnd(103.47) >= 5 && lineEnd(rb05) - wordsEnd(103.47) < 5.1 && texts(rb05)[0].Annotation__Text === 'PROPOSED SOUTH EAST ELEVATION - HOUSE FRONT FASCADE', [ lineEnd(rb05), texts(rb05)[0].Annotation__Text ]);
    check('the five millimetres are on the PAPER: the same line at 1:100 as at 1:50', lineEnd(build(Object.assign({}, RB05, { ScaleDenominator : 50 }), measure(103.47))) === lineEnd(rb05));
    check('a line that lands exactly on a tenth stays on it, floating point dust and all', lineEnd(build(EAST, measure(100.171))) === 105, lineEnd(build(EAST, measure(100.171))));
    check('a measure that throws, or answers nonsense, costs nothing', lineEnd(build(EAST, { measureTextMm : () => { throw new Error('no canvas'); } })) === 60 && lineEnd(build(EAST, measure(NaN))) === 60);
    check('the measure is asked about the title as it is written, at its size and weight', (() => { let asked = null; build(EAST, { measureTextMm : (text, size, weight) => { asked = [ text, size, weight ]; return 10; } }); return JSON.stringify(asked) === JSON.stringify([ 'EXISTING EAST ELEVATION', 3.5, 600 ]); })());
    check('a set length is held inside its limits', title.Na__LeParamTitle__Normalise(config, barCfg, { UnderlineMm : 2 }).UnderlineMm === 10 && title.Na__LeParamTitle__Normalise(config, barCfg, { UnderlineMm : 9000 }).UnderlineMm === 400);

    // THE ONE THING THAT MAY SHORTEN THE RUN | A bar stood to the right, near the words
    const NEAR = Object.assign({ ScaleDenominator : 50, ShowScaleBar : true, BarPlacement : 'right', BarOffsetMm : 150 }, EAST);
    check('a bar stood far enough to the right leaves the full five millimetres', lineEnd(build(NEAR, measure(140))) === 144.9, lineEnd(build(NEAR, measure(140))));
    check('a bar closer than that: the line stops 5 mm short of the bar\'s zero end', lineEnd(build(NEAR, measure(143))) === 145, lineEnd(build(NEAR, measure(143))));
    check('...but never short of the words themselves: their width plus the old fit extra', lineEnd(build(NEAR, measure(147))) === 147.4, lineEnd(build(NEAR, measure(147))));
    check('a bar below never shortens it, whatever BarOffsetMm says', lineEnd(build(Object.assign({}, NEAR, { BarPlacement : 'below' }), measure(143))) === 147.9);
    check('nor does a title with no bar at all', lineEnd(build(Object.assign({}, NEAR, { ShowScaleBar : false }), measure(143))) === 147.9);
    check('the grips follow the line as drawn: the link socket, and a bare title\'s stretch arrow',
        title.Na__LeParamTitle__Handles(config, barCfg, RB05, null, measure(103.47)).link.x === lineEnd(rb05)
        && title.Na__LeParamTitle__Handles(config, barCfg, Object.assign({ ShowScaleBar : false }, EAST), null, measure(75)).stretch.x === 79.9);

    // THE REFIT | Does a title's underline, as it stands, still end where the rule puts it
    const standing = (points, textAt) => ({ shapes : [ { Shape__Points : points } ], texts : [ { Annotation__PosXMm : textAt === undefined ? -0.171 : textAt, Annotation__PosYMm : -1.631 } ] });
    const misfits  = (records, tools, params) => title.Na__LeParamTitle__Misfits(config, barCfg, params || RB05, null, tools === undefined ? measure(103.47) : tools, records);
    check('drawn to the chrome\'s estimate (RB05, 93.2 mm): it misfits', misfits(standing([ [ 0, 0 ], [ 93.2, 0 ] ])) === true);
    check('drawn flush with its words, by the rule before this one: it misfits', misfits(standing([ [ 0, 0 ], [ 103.9, 0 ] ])) === true);
    check('drawn by the rule: it fits', misfits(standing([ [ 0, 0 ], [ lineEnd(rb05), 0 ] ])) === false);
    check('moved somewhere untidy on the sheet, it fits exactly as well', misfits(standing([ [ 12.3456789, 7.1 ], [ 12.3456789 + lineEnd(rb05) + 0.00004, 7.1 ] ])) === false);
    check('no measure, or one that throws, is never a misfit - a line drawn with one is not shortened without one',
        misfits(standing([ [ 0, 0 ], [ 93.2, 0 ] ]), null) === false && misfits(standing([ [ 0, 0 ], [ 93.2, 0 ] ]), { measureTextMm : () => { throw new Error('no canvas'); } }) === false);
    check('only the underline is asked about: a title text moved by hand does not make it misfit', misfits(standing([ [ 0, 0 ], [ lineEnd(rb05), 0 ] ], 4.2)) === false);
    check('an underline edited by hand into more than one run is left alone', misfits(standing([ [ 0, 0 ], [ 50, 0 ], [ 93.2, 0 ] ])) === false);
    check('records it cannot read are left alone', misfits(null) === false && misfits({ shapes : [ null ] }) === false);

    // GRIPS
    const withBar = title.Na__LeParamTitle__Handles(config, barCfg, Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, EAST), null, null);
    check('with its bar the stretch and lookup grips are the bar\'s, moved down with it', near(withBar.stretch.x, 100) && near(withBar.stretch.y, 6.318 + 1) && near(withBar.lookup.x, 0) && near(withBar.lookup.y, 6.318 + 1), withBar);
    const noBar = title.Na__LeParamTitle__Handles(config, barCfg, Object.assign({ ShowScaleBar : false }, EAST), null, null);
    check('without its bar the stretch grip is the underline\'s end and there is no lookup grip', noBar.stretch.x === 60 && noBar.stretch.y === 0 && noBar.lookup === null, noBar);
    check('the link socket stands off the top of the underline\'s end either way', withBar.link.x === 60 && withBar.link.y < 0 && noBar.link.x === 60 && noBar.link.y === withBar.link.y);
    check('stretching a bare title sets its underline, in 5 mm steps', title.Na__LeParamTitle__StretchTo(config, barCfg, Object.assign({ ShowScaleBar : false }, EAST), 83.4).UnderlineMm === 85);
    const stretched = title.Na__LeParamTitle__StretchTo(config, barCfg, Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, EAST), 139);
    check('stretching a title with a bar lengthens the bar in whole divisions and leaves the underline', stretched.Divisions === 7 && stretched.UnderlineMm === 60, stretched);
    check('a stretch keeps every word the title says', stretched.ViewFacing === 'East' && stretched.ViewPhase === 'existing' && stretched.ViewKind === 'elevation');

    // THE BAR STOOD AWAY TO THE RIGHT | Where it lands, and the two grips that swap ends
    const RIGHT  = Object.assign({ ScaleDenominator : 50, ShowScaleBar : true, BarPlacement : 'right', BarOffsetMm : 150 }, EAST);
    const away   = build(RIGHT);
    const awayBar = shapes(away)[1];
    const baseline = -config.DrawingTitle__TextBaselineAboveUnderlineMm;
    check('to the right, the underline is still the first record and still starts at the origin', away.records[0].kind === 'shape' && shapes(away)[0].Shape__Points[0][0] === 0 && shapes(away)[0].Shape__Points[0][1] === 0);
    check('to the right, the underline itself does not move or change length', JSON.stringify(shapes(away)[0]) === JSON.stringify(shapes(house)[0]));
    check('to the right, the bar starts at BarOffsetMm along, measured from the ORIGIN and not from the end of the underline', near(awayBar.Shape__Points[0][0], 150), awayBar.Shape__Points[0]);
    check('to the right, the bar stands above the underline, its foot exactly on the title\'s baseline',
        near(awayBar.Shape__Points[0][1], -3.631, 1e-6) && near(awayBar.Shape__Points[0][1] + 2, baseline, 1e-6), [ awayBar.Shape__Points[0][1], baseline ]);
    check('to the right, the numerals go with it: the zero sits under the bar\'s own zero end, not under the title', near(texts(away)[1].Annotation__PosXMm, 150) && texts(away)[1].Annotation__Text === '0', texts(away)[1]);
    check('to the right, it is still the same eleven vectors and seven texts, in the same order', shapes(away).length === 11 && texts(away).length === 7 && texts(away)[0].Annotation__Text === H.text.value);
    check('a longer title does not shove the bar along: the offset is from the origin', near(shapes(build(RIGHT, measure(140)))[1].Shape__Points[0][0], 150));
    check('placed below, BarOffsetMm does nothing at all', JSON.stringify(build(Object.assign({}, RIGHT, { BarPlacement : 'below', BarOffsetMm : 320 }))) === JSON.stringify(house));

    const far = title.Na__LeParamTitle__Handles(config, barCfg, RIGHT, null, null);
    check('to the right the stretch arrow moves to the bar\'s NEAR end and points back at the title', near(far.stretch.x, 150) && near(far.stretch.y, -2.631, 1e-6) && far.stretch.away[0] === -1, far.stretch);
    check('to the right the slide arrow takes the FAR end and points away from the title', near(far.slide.x, 250) && near(far.slide.y, -2.631, 1e-6) && far.slide.away[0] === 1, far.slide);
    check('to the right the lookup triangle steps up over the bar\'s near end, out of the stretch arrow\'s way', near(far.lookup.x, 150) && near(far.lookup.y, -3.631, 1e-6) && far.lookup.away.join() === '0,-1', far.lookup);
    check('the link socket is the underline\'s end wherever the bar went', near(far.link.x, 60) && near(far.link.y, withBar.link.y));
    check('a bar below, and a title with no bar, have no slide grip at all', withBar.slide === null && noBar.slide === null);

    // THE SLIDE | The far end is PUT, in 50 mm steps, or exactly on a snapped vertex
    const slid  = title.Na__LeParamTitle__SlideTo(config, barCfg, RIGHT, 337, false);
    const exact = title.Na__LeParamTitle__SlideTo(config, barCfg, RIGHT, 337, true);
    check('a free slide puts the FAR end on the nearest 50 mm, and the bar keeps its length', slid.BarOffsetMm === 250 && slid.Divisions === 5, slid.BarOffsetMm);
    check('a snapped slide puts the far end exactly where the vertex was', near(exact.BarOffsetMm, 237) && exact.Divisions === 5, exact.BarOffsetMm);
    check('a slide holds inside its limits and never goes behind the origin', title.Na__LeParamTitle__SlideTo(config, barCfg, RIGHT, -400, true).BarOffsetMm === 0);
    check('a slide keeps every word the title says, and its scale', slid.ViewFacing === 'East' && slid.ScaleDenominator === 50);
    check('sliding a bar that is below, or a title with no bar, changes nothing', title.Na__LeParamTitle__SlideTo(config, barCfg, house.records ? Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, EAST) : null, 300, false).BarOffsetMm === 150
        && title.Na__LeParamTitle__SlideTo(config, barCfg, Object.assign({ ShowScaleBar : false, BarPlacement : 'right' }, EAST), 300, false).BarOffsetMm === 150);

    // THE REVERSED STRETCH | Drag the near end towards the title and the far end stays put
    const back = title.Na__LeParamTitle__StretchTo(config, barCfg, RIGHT, 110);
    check('dragging the near end towards the title adds divisions', back.Divisions === 7, back.Divisions);
    check('and the FAR end does not move a millimetre', near(back.BarOffsetMm + (back.Divisions * 20), 250), [ back.BarOffsetMm, back.Divisions ]);
    const shorter = title.Na__LeParamTitle__StretchTo(config, barCfg, RIGHT, 205);
    check('dragging it away from the title takes divisions off, far end still held', shorter.Divisions === 2 && near(shorter.BarOffsetMm + (shorter.Divisions * 20), 250), [ shorter.BarOffsetMm, shorter.Divisions ]);
    const jammed = title.Na__LeParamTitle__StretchTo(config, barCfg, RIGHT, -1000);
    check('a bar dragged past its limit stops at the most divisions it may have, and the offset stops with it', jammed.Divisions === 40 && jammed.BarOffsetMm === 0, [ jammed.Divisions, jammed.BarOffsetMm ]);
    check('a reversed stretch keeps the title\'s words and its placement', back.ViewFacing === 'East' && back.BarPlacement === 'right');
    check('a bar placed below still stretches the old way, from the origin', title.Na__LeParamTitle__StretchTo(config, barCfg, Object.assign({}, RIGHT, { BarPlacement : 'below' }), 139).Divisions === 7);

    // PARAMETERS MADE WHOLE
    const junk = title.Na__LeParamTitle__Normalise(config, barCfg, { ShowScaleBar : 'yes', PhaseMode : 'sideways', TitleText : 42, Uppercase : null, UnderlineMm : 'long', ViewKind : 'spaceship', ViewPhase : 3, ScaleDenominator : -5 });
    check('junk parameters fall back to the config\'s standard', junk.ShowScaleBar === true && junk.PhaseMode === 'auto' && junk.TitleText === '' && junk.Uppercase === true && junk.UnderlineMm === 60 && junk.ViewKind === '' && junk.ViewPhase === '' && junk.ScaleDenominator === 50, junk);
    const wonky = title.Na__LeParamTitle__Normalise(config, barCfg, { BarPlacement : 'diagonally', BarOffsetMm : 'over there' });
    check('a placement nobody offers, and an offset that is not a number, fall back to the config\'s', wonky.BarPlacement === 'below' && wonky.BarOffsetMm === 150, wonky);
    check('an offset is held inside its limits', title.Na__LeParamTitle__Normalise(config, barCfg, { BarOffsetMm : -80 }).BarOffsetMm === 0 && title.Na__LeParamTitle__Normalise(config, barCfg, { BarOffsetMm : 99999 }).BarOffsetMm === 1200);
    check('an offset is kept to a thousandth, so a rebuild writes the same number', title.Na__LeParamTitle__Normalise(config, barCfg, { BarOffsetMm : 150.00000000000003 }).BarOffsetMm === 150);
    const hundred = title.Na__LeParamTitle__Standard(config, barCfg, 100);
    check('the standard at 1:100 is the bar\'s standard at 1:100 with the title\'s settings', hundred.ScaleDenominator === 100 && hundred.DivisionMm === 2000 && hundred.Divisions === 5 && hundred.UnderlineMm === 60 && hundred.ViewFacing === '');

    // THE TYPE | What the engine, the link module and the panel are told
    const type = title.Na__LeParamTitle__CreateType(() => config, () => barCfg, () => null);
    check('the type names the facts the link module fills', type.type === 'DrawingTitle' && type.facts.join() === 'ViewKind,ViewPhase,ViewFacing,ViewLevel,ViewName,ViewDrawing');
    check('the standard title starts with no storey, and a stretch keeps the one it has', hundred.ViewLevel === '' && title.Na__LeParamTitle__StretchTo(config, barCfg, Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, D21), 139).ViewLevel === 'Ground Floor Plan');
    check('a change of scale keeps every fact and every choice', type.facts.concat([ 'ShowScaleBar', 'PhaseMode', 'TitleText', 'Uppercase', 'UnderlineMm', 'BarPlacement', 'BarOffsetMm' ]).every((key) => type.keep.indexOf(key) !== -1));
    check('the type offers the grips module a slide', typeof type.slideTo === 'function' && type.slideTo(RIGHT, 337, true).BarOffsetMm === exact.BarOffsetMm);
    check('the type says whether an element has a bar', type.hasBar({ ShowScaleBar : true }) === true && type.hasBar({ ShowScaleBar : false }) === false);
    check('the type says what a title reads, for the panel', type.titleText(EAST).text === 'EXISTING EAST ELEVATION' && type.titleText({ ViewKind : 'elevation' }).missing.join() === 'direction');
    check('the type builds with no tools at all, as it must under the tile', type.build(EAST).records.length > 2 && type.handles(EAST).link !== null);
    check('the type offers the engine its refit, and it is the same question', typeof type.refit === 'function'
        && type.refit(RB05, measure(103.47), standing([ [ 0, 0 ], [ 93.2, 0 ] ])) === true && type.refit(RB05, measure(103.47), standing([ [ 0, 0 ], [ lineEnd(rb05), 0 ] ])) === false);
    check('a missing config still draws the house title', title.Na__LeParamTitle__Build(null, null, EAST, null, null).records.length > 2 && title.Na__LeParamTitle__Build({}, {}, Object.assign({ ShowScaleBar : false }, EAST), null, null).records[1].record.Annotation__SizeMm === 3.5);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
