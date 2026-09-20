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

    // THE UNDERLINE | At least its set length, and grows to fit what it underlines
    const measure = (mm) => ({ measureTextMm : () => mm });
    check('no way to measure text: the underline is its set length', shapes(build(EAST))[0].Shape__Points[1][0] === 60);
    check('a title shorter than the underline leaves it alone', shapes(build(EAST, measure(48.2)))[0].Shape__Points[1][0] === 60);
    check('a longer title is underlined to its end, plus the fit extra, rounded up to a tenth', shapes(build(EAST, measure(75)))[0].Shape__Points[1][0] === 75.4, shapes(build(EAST, measure(75)))[0].Shape__Points[1][0]);
    check('a measure that throws, or answers nonsense, costs nothing', shapes(build(EAST, { measureTextMm : () => { throw new Error('no canvas'); } }))[0].Shape__Points[1][0] === 60 && shapes(build(EAST, measure(NaN)))[0].Shape__Points[1][0] === 60);
    check('the measure is asked about the title as it is written, at its size and weight', (() => { let asked = null; build(EAST, { measureTextMm : (text, size, weight) => { asked = [ text, size, weight ]; return 10; } }); return JSON.stringify(asked) === JSON.stringify([ 'EXISTING EAST ELEVATION', 3.5, 600 ]); })());
    check('a set length is held inside its limits', title.Na__LeParamTitle__Normalise(config, barCfg, { UnderlineMm : 2 }).UnderlineMm === 10 && title.Na__LeParamTitle__Normalise(config, barCfg, { UnderlineMm : 9000 }).UnderlineMm === 400);

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

    // PARAMETERS MADE WHOLE
    const junk = title.Na__LeParamTitle__Normalise(config, barCfg, { ShowScaleBar : 'yes', PhaseMode : 'sideways', TitleText : 42, Uppercase : null, UnderlineMm : 'long', ViewKind : 'spaceship', ViewPhase : 3, ScaleDenominator : -5 });
    check('junk parameters fall back to the config\'s standard', junk.ShowScaleBar === true && junk.PhaseMode === 'auto' && junk.TitleText === '' && junk.Uppercase === true && junk.UnderlineMm === 60 && junk.ViewKind === '' && junk.ViewPhase === '' && junk.ScaleDenominator === 50, junk);
    const hundred = title.Na__LeParamTitle__Standard(config, barCfg, 100);
    check('the standard at 1:100 is the bar\'s standard at 1:100 with the title\'s settings', hundred.ScaleDenominator === 100 && hundred.DivisionMm === 2000 && hundred.Divisions === 5 && hundred.UnderlineMm === 60 && hundred.ViewFacing === '');

    // THE TYPE | What the engine, the link module and the panel are told
    const type = title.Na__LeParamTitle__CreateType(() => config, () => barCfg, () => null);
    check('the type names the facts the link module fills', type.type === 'DrawingTitle' && type.facts.join() === 'ViewKind,ViewPhase,ViewFacing,ViewLevel,ViewName,ViewDrawing');
    check('the standard title starts with no storey, and a stretch keeps the one it has', hundred.ViewLevel === '' && title.Na__LeParamTitle__StretchTo(config, barCfg, Object.assign({ ScaleDenominator : 50, ShowScaleBar : true }, D21), 139).ViewLevel === 'Ground Floor Plan');
    check('a change of scale keeps every fact and every choice', type.facts.concat([ 'ShowScaleBar', 'PhaseMode', 'TitleText', 'Uppercase', 'UnderlineMm' ]).every((key) => type.keep.indexOf(key) !== -1));
    check('the type says whether an element has a bar', type.hasBar({ ShowScaleBar : true }) === true && type.hasBar({ ShowScaleBar : false }) === false);
    check('the type says what a title reads, for the panel', type.titleText(EAST).text === 'EXISTING EAST ELEVATION' && type.titleText({ ViewKind : 'elevation' }).missing.join() === 'direction');
    check('the type builds with no tools at all, as it must under the tile', type.build(EAST).records.length > 2 && type.handles(EAST).link !== null);
    check('a missing config still draws the house title', title.Na__LeParamTitle__Build(null, null, EAST, null, null).records.length > 2 && title.Na__LeParamTitle__Build({}, {}, Object.assign({ ShowScaleBar : false }, EAST), null, null).records[1].record.Annotation__SizeMm === 3.5);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
