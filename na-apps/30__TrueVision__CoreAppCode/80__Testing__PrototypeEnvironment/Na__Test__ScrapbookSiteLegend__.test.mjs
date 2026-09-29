// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - SITE PLAN LEGEND
// =============================================================================
//
// FILE       : Na__Test__ScrapbookSiteLegend__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Site Plan Legend Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the legend lists what it is given in the right order, draws each swatch the way the drawing draws the layer - wash, whole hatch glyphs, edge, round-ended dashes - and keeps its record order through every setting
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - The legend type imports NOTHING, and neither does the hatch library, so
//   both are copied into a scratch folder beside a package.json and run
//   against the app's own config and the REAL site plan hatch patterns - the
//   library's fetch answered from the disk. The tools the panel hands the type
//   are rebuilt here from the library's own TileMarks.
// - THE CHECK THAT MATTERS MOST IS THE SWATCH. Every site plan pattern must
//   put at least one WHOLE glyph inside the standard 12 x 6 mm swatch - and the
//   woodland and the water TWO, or 'mixed' woodland reads as one conifer, well
//   clear of its edge - a grass swatch that lands on the empty part of a 28 x
//   26 mm tile reads as a plain green box, which is the fault that drawing
//   the glyphs (rather than tiling a hatch) exists to prevent.
// - The second is the dash: a dash is a capsule reaching exactly half a line
//   width past each end of its length, which is what the site plan's round
//   caps draw on screen and on paper.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookSiteLegend__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Written with the site plan legend.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test, Their Config and the Real Hatch Library
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const CORE       = resolve(SCRIPT_DIR, '..');
    const EDITOR     = join(CORE, '02__Src__AppModules', '51__System__LayoutEditor');
    const FEATURE    = join(EDITOR, '57__Feature__ScrapbookParametric');
    const LIBRARY    = join(CORE, '52__LayoutEditor__HatchPatternLibrary');
    const MODULE     = 'Na__LayoutEditor__ScrapbookParametric__SiteLegend__.js';
    const HATCHES    = 'Na__LayoutEditor__HatchPatterns__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-sitelegend-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');
    copyFileSync(join(FEATURE, MODULE), join(SCRATCH, MODULE));
    copyFileSync(join(EDITOR, '36__System__HatchPatternTools', HATCHES), join(SCRATCH, HATCHES));

    // THE LIBRARY'S FETCH, ANSWERED FROM THE DISK: everything after the
    // library's folder name is a path inside it.
    globalThis.fetch = async (url) => {
        const text   = decodeURIComponent(String(url));
        const marker = '52__LayoutEditor__HatchPatternLibrary/';
        const at     = text.indexOf(marker);
        try {
            const body = readFileSync(join(LIBRARY, ...text.slice(at + marker.length).split('/')), 'utf8');
            return { ok : true, json : async () => JSON.parse(body) };
        } catch (error) {
            return { ok : false, json : async () => null };
        }
    };
    const legend  = await import(pathToFileURL(join(SCRATCH, MODULE)).href);
    const hatches = await import(pathToFileURL(join(SCRATCH, HATCHES)).href);
    const logged  = console.log;
    console.log = () => {};                                                    // <-- The library announces its pattern count; keep the report clean
    await hatches.Na__LeHatch__Ready();
    console.log = logged;
    const whole    = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const config   = whole['LayoutEditor__ScrapbookParametric__SiteLegend'];
    const elements = whole['LayoutEditor__ScrapbookParametric__Elements'];

    // THE TOOLS THE PANEL HANDS THE TYPE: its hatch marks, and a measurer
    // standing in for the chrome's (a fixed 0.5 of the size a letter).
    const measure = (text, sizeMm) => String(text).length * sizeMm * 0.5;
    const TOOLS   = { measureTextMm : measure, hatchTile : (key) => hatches.Na__LeHatch__TileMarks(key) };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  ->  ' + JSON.stringify(detail) : ''));
    }
    const near   = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-6 : tolerance);
    const build  = (params, tools) => legend.Na__LeParamLegend__Build(config, params, tools === undefined ? TOOLS : tools);
    const shapes = (built) => built.records.filter((entry) => entry.kind === 'shape').map((entry) => entry.record);
    const texts  = (built) => built.records.filter((entry) => entry.kind === 'annotation').map((entry) => entry.record);
    const boxOf  = (points) => ({
        minX : Math.min(...points.map((p) => p[0])), maxX : Math.max(...points.map((p) => p[0])),
        minY : Math.min(...points.map((p) => p[1])), maxY : Math.max(...points.map((p) => p[1]))
    });

    const row = (key, label, kind, extra) => Object.assign({ Key : key, Label : label, Kind : kind }, extra || {});
    const RED    = row('TrueVision__SitePlan__RedLineBoundary', 'Red Line Boundary', 'line', { Line : { Hex : '#E53935', WidthMm : 0.529, DashMm : [] } });
    const NEW    = row('TrueVision__SitePlan__ProposedBuildings', 'Proposed - New Construction', 'area', { Fill : { Hex : '#FF0000', Opacity : 0.1 }, Line : { Hex : '#E53935', WidthMm : 0.706, DashMm : [] } });
    const ALTER  = row('TrueVision__SitePlan__ProposedBuildingsSecondary', 'Proposed - Alterations', 'area', { Fill : { Hex : '#FF0000', Opacity : 0.1 }, Line : { Hex : '#E53935', WidthMm : 0.706, DashMm : [ 1.25, 0.75 ] } });
    const WOOD   = row('TrueVision__SitePlan__TreesMixedWoodland', 'Mixed Woodland', 'area', { Fill : { Hex : '#DCEDCF', Opacity : 1 }, Hatch : { Key : 'SitePlanHatch__MixedWoodland', Scale : 1, RotationDeg : 0, Colour : '#43A047' }, Line : { Hex : '#43A047', WidthMm : 0.265, DashMm : [] } });
    const GRASS  = row('TrueVision__SitePlan__Grassland', 'Grassland', 'area', { Fill : { Hex : '#E5F2D6', Opacity : 1 }, Hatch : { Key : 'SitePlanHatch__Grassland', Scale : 1, RotationDeg : 0, Colour : '#43A047' }, Line : { Hex : '#666666', WidthMm : 0.176, DashMm : [] } });
    const TREES  = row('TrueVision__SitePlan__TreesToRemove', 'Trees To Be Removed', 'line', { Line : { Hex : '#E53935', WidthMm : 0.265, DashMm : [ 2.5, 1.5 ] } });
    const FENCE  = row('TrueVision__SitePlan__WallsAndFencesRemoved', 'Walls and Fences To Be Removed', 'line', { Line : { Hex : '#999999', WidthMm : 0.265, DashMm : [ 0.2, 0.6 ] } });
    const OS     = row('TrueVision__SitePlan__OsMapping', 'OS Mapping', 'line', { Line : { Hex : '#666666', WidthMm : 0.176, DashMm : [] } });
    const DATA   = { Rows : [ RED, NEW, ALTER, WOOD, GRASS, TREES, FENCE, OS ], Sources : 1 };

    console.log('TrueVision3D - parametric scrapbook site plan legend');

    // -- THE PARAMETERS -----------------------------------------------------
    const standard = legend.Na__LeParamLegend__Normalise(config, {});
    check('a new legend reads every site plan, columns automatic, lines on', standard.ViewportId === '' && standard.Columns === 0 && standard.ShowLines === true);
    check('a new legend leaves the OS base map and the contours off', standard.Hidden.indexOf('TrueVision__SitePlan__OsMapping') !== -1 && standard.Hidden.indexOf('TrueVision__SitePlan__Contours') !== -1, standard.Hidden);
    check('an empty hidden list is somebody\'s decision and is kept empty', legend.Na__LeParamLegend__Normalise(config, { Hidden : [] }).Hidden.length === 0);
    const once  = legend.Na__LeParamLegend__Normalise(config, { Data : DATA });
    const twice = legend.Na__LeParamLegend__Normalise(config, once);
    check('normalising twice changes nothing (the link module compares as one string)', JSON.stringify(once) === JSON.stringify(twice));
    const shuffled = { Rows : DATA.Rows.map((one) => Object.fromEntries(Object.entries(one).reverse())), Sources : 1 };
    check('a row\'s keys in any order normalise to the same string', JSON.stringify(legend.Na__LeParamLegend__NormaliseData(shuffled)) === JSON.stringify(once.Data));
    const junk = legend.Na__LeParamLegend__NormaliseData({ Rows : [
        { Key : '', Label : 'no key', Kind : 'line', Line : { Hex : '#000000', WidthMm : 0.2 } },
        { Key : 'a', Label : 'A', Kind : 'area' },
        { Key : 'b', Label : 'B', Kind : 'area', Line : { Hex : '#123456', WidthMm : 0.3, DashMm : [] } },
        { Key : 'b', Label : 'B twice', Kind : 'line', Line : { Hex : '#123456', WidthMm : 0.3 } },
        { Key : 'c', Label : 'C', Kind : 'line', Line : { Hex : 'red', WidthMm : 0.3 } }
    ] });
    check('rows with no key, no look, a repeated key or a colour that is not a hex are dropped',
        junk.Rows.length === 1 && junk.Rows[0].Key === 'b', junk.Rows);
    check('an area with nothing to wash or hatch is listed as its line', junk.Rows[0].Kind === 'line');

    // -- WHAT IS LISTED -----------------------------------------------------
    const listed = legend.Na__LeParamLegend__Rows(config, once);
    check('every row but the hidden OS base map is listed, in the order given',
        listed.map((entry) => entry.row.Label).join(' | ') === 'Red Line Boundary | Proposed - New Construction | Proposed - Alterations | Mixed Woodland | Grassland | Trees To Be Removed | Walls and Fences To Be Removed',
        listed.map((entry) => entry.row.Label));
    const noLines = legend.Na__LeParamLegend__Rows(config, legend.Na__LeParamLegend__Normalise(config, { Data : DATA, ShowLines : false }));
    check('with lines off only the washes and hatches are listed', noLines.every((entry) => entry.kind === 'area') && noLines.length === 4, noLines.map((entry) => entry.row.Label));
    check('a sheet with nothing says so in words', legend.Na__LeParamLegend__Rows(config, standard)[0].kind === 'empty');

    // -- WHAT IS DRAWN ------------------------------------------------------
    const built = build({ Data : DATA });
    check('the FIRST record is a vector and its FIRST point is the origin',
        built.records[0].kind === 'shape' && built.records[0].record.Shape__Points[0][0] === 0 && built.records[0].record.Shape__Points[0][1] === 0);
    const kinds = built.records.map((entry) => entry.kind).join(',');
    check('every shape comes before every text, so the engine\'s slots stay put', kinds.indexOf('annotation,shape') === -1);
    check('one text for the title and one per listed row', texts(built).length === 1 + listed.length, texts(built).map((t) => t.Annotation__Text));
    check('the title reads Legend, above the rule', texts(built)[0].Annotation__Text === 'Legend' && texts(built)[0].Annotation__PosYMm < 0);
    check('EVERY shape writes both opacities out, so a slot never inherits its last occupant\'s',
        shapes(built).every((s) => Number.isFinite(s.Shape__FillOpacity) && Number.isFinite(s.Shape__StrokeOpacity)));
    check('no shape carries a dash pattern of its own (a dash is a shape)', shapes(built).every((s) => !s.Shape__LineStyle));

    // THE SWATCHES, row by row, read back by where the label is.
    const labels  = texts(built).slice(1);
    const swatchW = standard.SwatchWidthMm, swatchH = standard.SwatchHeightMm;
    const within  = (s, box, pad) => s.Shape__Points.every((p) => p[0] >= box.minX + pad - 1e-6 && p[0] <= box.maxX - pad + 1e-6 && p[1] >= box.minY + pad - 1e-6 && p[1] <= box.maxY - pad + 1e-6);
    const swatchOf = (label) => {
        const text = labels.find((t) => t.Annotation__Text === label);
        const x    = text.Annotation__PosXMm - swatchW - (config.SiteLegend__SwatchTextGapMm);
        const mid  = text.Annotation__PosYMm - (0.36 * standard.TextSizeMm);
        return { minX : x, maxX : x + swatchW, minY : mid - (swatchH / 2), maxY : mid + (swatchH / 2) };
    };
    const inBox = (box) => shapes(built).slice(1).filter((s) => s.Shape__Points.every((p) => p[0] >= box.minX - 0.6 && p[0] <= box.maxX + 0.6 && p[1] >= box.minY - 0.6 && p[1] <= box.maxY + 0.6));

    const grass = inBox(swatchOf('Grassland'));
    const grassGlyphs = grass.filter((s) => s.Shape__Stroked && !s.Shape__Closed && s.Shape__StrokeColour === '#43A047');
    check('the grass swatch is washed in its fill, full strength', grass.some((s) => s.Shape__FillColour === '#E5F2D6' && s.Shape__FillOpacity === 1 && !s.Shape__Stroked));
    check('THE GRASS SWATCH CARRIES WHOLE TUFTS (a five-blade tuft is five lines)', grassGlyphs.length >= 5 && grassGlyphs.length % 5 === 0, grassGlyphs.length);
    check('every blade sits inside the swatch, clear of its edge', grassGlyphs.every((s) => within(s, swatchOf('Grassland'), 0.2)));
    check('the tufts are drawn at the pattern\'s own weight (0.18 mm)', grassGlyphs.every((s) => near(s.Shape__StrokePt * 25.4 / 72, 0.18, 1e-3)), grassGlyphs[0] && grassGlyphs[0].Shape__StrokePt);
    check('and edged in the layer\'s grey at its weight, LAST - over the wash and the tufts',
        grass[grass.length - 1].Shape__Closed === true && grass[grass.length - 1].Shape__StrokeColour === '#666666' && near(grass[grass.length - 1].Shape__StrokePt * 25.4 / 72, 0.176, 1e-3));
    const proposal = inBox(swatchOf('Proposed - New Construction'));
    check('the proposal swatch keeps its 10% red wash', proposal.some((s) => s.Shape__FillColour === '#FF0000' && near(s.Shape__FillOpacity, 0.1)));

    // EVERY SITE PLAN PATTERN, at the standard swatch: at least one whole glyph.
    const patterns = [ 'SitePlanHatch__MixedWoodland', 'SitePlanHatch__PondsAndLakes', 'SitePlanHatch__Grassland', 'SitePlanHatch__RoughGrassland', 'SitePlanHatch__Gravel' ];
    patterns.forEach((key) => {
        const tile = hatches.Na__LeHatch__TileMarks(key);
        const pad  = config.SiteLegend__GlyphInsetMm + 0.15;
        const got  = legend.Na__LeParamLegend__PickGlyphs(config, tile, key, 1, 0, swatchW - (2 * pad), swatchH - (2 * pad), tile.strokeMm);
        const ok   = got.length >= 1 && got.every((mark) => mark.every((line) => line.every((p) => p[0] >= -1e-6 && p[0] <= swatchW - (2 * pad) + 1e-6 && p[1] >= -1e-6 && p[1] <= swatchH - (2 * pad) + 1e-6)));
        check('a standard swatch of ' + key.replace('SitePlanHatch__', '') + ' carries ' + got.length + ' whole glyph(s), all inside it', ok, got.length);
    });
    [ 'SitePlanHatch__MixedWoodland', 'SitePlanHatch__PondsAndLakes' ].forEach((key) => {
        const tileOf = hatches.Na__LeHatch__TileMarks(key);
        const pad    = config.SiteLegend__GlyphInsetMm + 0.15;
        const got    = legend.Na__LeParamLegend__PickGlyphs(config, tileOf, key + ':two', 1, 0, swatchW - (2 * pad), swatchH - (2 * pad), tileOf.strokeMm);
        const centres = got.map((mark) => { const xs = mark.flat().map((p) => p[0]); return (Math.min(...xs) + Math.max(...xs)) / 2; });
        check('the standard swatch of ' + key.replace('SitePlanHatch__', '') + ' carries TWO different glyphs, not one drawn twice',
            got.length === 2 && Math.abs(centres[0] - centres[1]) > 2, centres);
    });
    const tile = hatches.Na__LeHatch__TileMarks('SitePlanHatch__Grassland');
    const first  = JSON.stringify(legend.Na__LeParamLegend__PickGlyphs(config, tile, 'x', 1, 0, 9, 4, 0.18));
    const again  = JSON.stringify(legend.Na__LeParamLegend__PickGlyphs(config, tile, 'x', 1, 0, 9, 4, 0.18));
    check('the same swatch picks the same glyphs every time', first === again);
    const turned = legend.Na__LeParamLegend__PickGlyphs(config, hatches.Na__LeHatch__TileMarks('SitePlanHatch__MixedWoodland'), 'w45', 1, 45, 9, 4, 0.18);
    check('a pattern turned 45 degrees still puts whole glyphs in the swatch', turned.length >= 1, turned.length);
    const bare = build({ Data : { Rows : [ GRASS ], Sources : 1 } }, { measureTextMm : measure });
    check('with no way to reach the library the swatch is its wash and its edge alone', shapes(bare).length === 3, shapes(bare).length);

    // -- DASHES AND DOTS ARE CAPSULES ----------------------------------------
    const trees = inBox(swatchOf('Trees To Be Removed'));
    check('a 2.5 on 1.5 dash over a 12 mm swatch is three capsules', trees.length === 3 && trees.every((s) => s.Shape__Closed && !s.Shape__Stroked && s.Shape__FillColour === '#E53935'), trees.length);
    const firstDash = boxOf(trees[0].Shape__Points);
    const treeBox   = swatchOf('Trees To Be Removed');
    check('a dash reaches half a line width past its start, as a round cap does', near(firstDash.minX, treeBox.minX - 0.1325, 1e-3), firstDash.minX - treeBox.minX);
    check('and is 2.5 mm plus one line width long', near(firstDash.maxX - firstDash.minX, 2.5 + 0.265, 1e-3), firstDash.maxX - firstDash.minX);
    check('and one line width deep', near(firstDash.maxY - firstDash.minY, 0.265, 1e-3));
    const dots = inBox(swatchOf('Walls and Fences To Be Removed'));
    check('a 0.2 on 0.6 dot pattern over 12 mm is fifteen dots', dots.length === 15, dots.length);
    const alter = inBox(swatchOf('Proposed - Alterations'));
    check('a dashed edge is capsules round all four sides, the wash under them', alter[0].Shape__FillOpacity === 0.1 && alter.slice(1).every((s) => !s.Shape__Stroked && s.Shape__Closed) && alter.length > 12, alter.length);
    const red = inBox(swatchOf('Red Line Boundary'));
    check('a solid line row is one stroked run across the swatch', red.length === 1 && red[0].Shape__Stroked && near(boxOf(red[0].Shape__Points).maxX - boxOf(red[0].Shape__Points).minX, swatchW), red.length);

    // -- THE LAYOUT -----------------------------------------------------------
    const auto = texts(build({ Data : DATA })).slice(1);
    check('seven rows with columns automatic are one column', auto.every((t) => t.Annotation__PosXMm === auto[0].Annotation__PosXMm));
    const many = { Rows : Array.from({ length : 25 }, (x, i) => row('k' + i, 'Layer ' + i, 'line', { Line : { Hex : '#333333', WidthMm : 0.2, DashMm : [] } })), Sources : 1 };
    const manyText = texts(build({ Data : many, Hidden : [] })).slice(1);
    check('twenty-five rows with columns automatic are three columns of nine, nine and seven',
        new Set(manyText.map((t) => t.Annotation__PosXMm)).size === 3 && manyText.filter((t) => t.Annotation__PosXMm === manyText[0].Annotation__PosXMm).length === 9);
    const two = build({ Data : DATA, Columns : 2 });
    const twoText = texts(two).slice(1);
    check('seven rows in two columns are four and three, running down then across',
        twoText.filter((t) => t.Annotation__PosXMm === twoText[0].Annotation__PosXMm).length === 4
        && twoText[4].Annotation__PosXMm > twoText[0].Annotation__PosXMm && twoText[4].Annotation__PosYMm === twoText[0].Annotation__PosYMm,
        twoText.map((t) => [ t.Annotation__Text, t.Annotation__PosXMm, t.Annotation__PosYMm ]));
    const rule = (b) => b.records[0].record.Shape__Points[1][0];
    const natural = rule(build({ Data : DATA, WidthMm : 0 }));
    check('with no minimum the legend is as wide as its longest label needs', near(natural, swatchW + config.SiteLegend__SwatchTextGapMm + measure('Walls and Fences To Be Removed', standard.TextSizeMm), 1e-3), natural);
    check('a minimum wider than that sets the rule', rule(build({ Data : DATA, WidthMm : 150 })) === 150);
    check('a minimum narrower than the words never crowds them', near(rule(build({ Data : DATA, WidthMm : 20 })), natural, 1e-3));
    check('THE LABELS NEVER OVERRUN THE RULE, in one column or three',
        [ 1, 2, 3 ].every((n) => { const b = build({ Data : DATA, Columns : n }); return texts(b).slice(1).every((t) => t.Annotation__PosXMm + measure(t.Annotation__Text, t.Annotation__SizeMm) <= rule(b) + 1e-6); }));

    // -- REFIT, GRIPS AND THE MENU ------------------------------------------
    const snug    = build({ Data : DATA, WidthMm : 0 });                       // <-- No minimum: the words alone set the width
    const records = { shapes : shapes(snug), texts : texts(snug) };
    check('a legend drawn to the measure it is checked with fits', legend.Na__LeParamLegend__Misfits(config, { Data : DATA, WidthMm : 0 }, TOOLS, records) === false);
    check('drawn to an estimate, it is refit once the real measure differs',
        legend.Na__LeParamLegend__Misfits(config, { Data : DATA, WidthMm : 0 }, { measureTextMm : (t, s) => String(t).length * s * 0.62 }, records) === true);
    check('but a legend held wider by its minimum is not refit for a measure that still fits inside it',
        legend.Na__LeParamLegend__Misfits(config, { Data : DATA }, { measureTextMm : (t, s) => String(t).length * s * 0.52 }, { shapes : shapes(built), texts : texts(built) }) === false);
    const handles = legend.Na__LeParamLegend__Handles(config, { Data : DATA }, TOOLS);
    check('the stretch arrow stands at the end of the rule', near(handles.stretch.x, rule(built)) && handles.stretch.y === 0 && handles.link === null);
    check('a stretch sets the minimum in 2 mm steps', legend.Na__LeParamLegend__StretchTo(config, { Data : DATA }, 101.3).WidthMm === 102);
    const menu = legend.Na__LeParamLegend__Choices(config, { Data : DATA }, null);
    const grassItem = menu.find((item) => item.label === 'Grassland');
    check('the menu lists a row per layer, ticked while it is listed', grassItem && grassItem.checked === true && menu.find((item) => item.label === 'OS Mapping').checked === false);
    check('and unticking one hides it', grassItem.patch.Hidden.indexOf('TrueVision__SitePlan__Grassland') !== -1);
    check('List every row puts back the rows hidden on this sheet', menu.some((item) => item.label === 'List every row' && item.patch.Hidden.indexOf('TrueVision__SitePlan__OsMapping') === -1));

    // -- THE TILE THE LIBRARY OFFERS ----------------------------------------
    const tileElement = elements.Elements__List.find((element) => element.Element__Id === 'SiteLegend');
    check('the library offers the legend on site plan sheets only', !!tileElement && JSON.stringify(tileElement.Element__DrawingTypes) === '["siteplan"]');
    const preview = build(tileElement.Element__PreviewParams);
    check('its tile preview draws six rows with glyphs in its three hatched swatches', preview.rows === 6 && shapes(preview).filter((s) => s.Shape__Stroked && !s.Shape__Closed && s.Shape__StrokeColour !== '#E53935' && s.Shape__StrokeColour !== '#172b3a').length >= 3);

    console.log(failures === 0 ? '\nEVERY CHECK PASSED' : '\n' + failures + ' CHECK(S) FAILED');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
