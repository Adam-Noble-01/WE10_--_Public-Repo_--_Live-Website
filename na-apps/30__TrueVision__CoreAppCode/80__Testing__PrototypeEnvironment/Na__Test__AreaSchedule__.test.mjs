// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - AREA SCHEDULE
// =============================================================================
//
// FILE       : Na__Test__AreaSchedule__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Area Schedule Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the schedule reports what the sheet holds - the right rows, in the right order, adding up to the right number - and that it keeps its record order through every setting
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The schedule type imports NOTHING, so the one file is copied into a
//   scratch folder beside a package.json and run against the app's own config,
//   exactly as the editor runs it.
// - THE CHECK THAT MATTERS MOST IS THE TOTAL. A table filtered to one floor
//   must foot ITS OWN rows, never the sheet's total - a schedule that quietly
//   footed the whole house under a heading saying Ground Floor would be a lie
//   on a planning drawing, and nobody would catch it by looking.
// - The second is the record ORDER: every shape, then every text, in a fixed
//   order whatever the table is set to, because the engine updates an element
//   in place slot for slot. The top rule has to be vector one every time or a
//   rebuild would rewrite the wrong record.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__AreaSchedule__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Floor Areas system.
//
// =============================================================================

import { readFileSync, copyFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test and Its Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const FEATURE    = join(APP, '51__System__LayoutEditor', '57__Feature__ScrapbookParametric');
    const MODULE     = 'Na__LayoutEditor__ScrapbookParametric__AreaSchedule__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-areaschedule-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');
    copyFileSync(join(FEATURE, MODULE), join(SCRATCH, MODULE));
    const table    = await import(pathToFileURL(join(SCRATCH, MODULE)).href);
    const whole    = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const config   = whole['LayoutEditor__ScrapbookParametric__AreaSchedule'];
    const elements = whole['LayoutEditor__ScrapbookParametric__Elements'];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  ->  ' + JSON.stringify(detail) : ''));
    }
    const near   = (a, b, tolerance) => Math.abs(a - b) <= (tolerance === undefined ? 1e-9 : tolerance);
    const build  = (params) => table.Na__LeParamArea__Build(config, params);
    const rowsOf = (params) => table.Na__LeParamArea__Rows(config, table.Na__LeParamArea__Normalise(config, params));
    const shapes = (built) => built.records.filter((entry) => entry.kind === 'shape').map((entry) => entry.record);
    const texts  = (built) => built.records.filter((entry) => entry.kind === 'annotation').map((entry) => entry.record);
    const words  = (built) => texts(built).map((record) => record.Annotation__Text);

    console.log('TrueVision3D - parametric scrapbook area schedule');

    // A HOUSE, MEASURED. Two floors, five rooms, one room nobody has filed.
    const DATA = {
        Areas : [
            { Name : 'Kitchen',     Group : 'Ground Floor', AreaM2 : 18.45, Colour : '#bcd9ee' },
            { Name : 'Living Room', Group : 'Ground Floor', AreaM2 : 24.10, Colour : '#bcd9ee' },
            { Name : 'Hall',        Group : 'Ground Floor', AreaM2 :  6.20, Colour : '#bcd9ee' },
            { Name : 'Bedroom 1',   Group : 'First Floor',  AreaM2 : 15.20, Colour : '#c6e0c6' },
            { Name : 'Bedroom 2',   Group : 'First Floor',  AreaM2 : 11.80, Colour : '#c6e0c6' },
            { Name : 'Store',                               AreaM2 :  2.50 }
        ],
        Groups : [
            { Name : 'Ground Floor', AreaM2 : 48.75, Count : 3, Colour : '#bcd9ee' },
            { Name : 'First Floor',  AreaM2 : 27.00, Count : 2, Colour : '#c6e0c6' }
        ],
        TotalM2 : 78.25
    };
    const AREAS  = { Form : 'areas',  Data : DATA };
    const GROUPS = { Form : 'groups', Data : DATA };

    // -- WHAT IS LISTED, AND IN WHAT ORDER ----------------------------------
    const listed = rowsOf(AREAS);
    check('every room and every group heading is listed, and the loose room too',
        listed.length === 6 + 2 + 1, listed.map((row) => row.kind + ':' + row.text));
    check('the groups come in the sheet\'s own order, each heading before its rooms',
        listed.map((row) => row.text).join(' | ') === 'Ground Floor | Kitchen | Living Room | Hall | First Floor | Bedroom 1 | Bedroom 2 | Ungrouped | Store',
        listed.map((row) => row.text));
    check('a room under a heading is indented and a heading is not',
        listed[1].indent === true && listed[0].indent === false);
    check('a group heading carries its subtotal', near(listed[0].value, 48.75) && near(listed[4].value, 27));
    check('the Ungrouped heading carries the loose rooms\' own subtotal', near(listed[7].value, 2.5), listed[7]);

    // -- THE TOTAL IS THE TABLE'S OWN ---------------------------------------
    check('the whole schedule totals 78.25 m2', near(table.Na__LeParamArea__Total(table.Na__LeParamArea__Normalise(config, AREAS), listed), 78.25));
    const oneFloor = { Form : 'areas', Group : 'Ground Floor', Data : DATA };
    const floorRows = rowsOf(oneFloor);
    check('filtered to Ground Floor it lists that floor and nothing else',
        floorRows.map((row) => row.text).join(' | ') === 'Ground Floor | Kitchen | Living Room | Hall', floorRows.map((row) => row.text));
    check('THE FILTERED TABLE FOOTS ITS OWN ROOMS, 48.75 - never the sheet\'s 78.25',
        near(table.Na__LeParamArea__Total(table.Na__LeParamArea__Normalise(config, oneFloor), floorRows), 48.75),
        table.Na__LeParamArea__Total(table.Na__LeParamArea__Normalise(config, oneFloor), floorRows));
    const groupRows = rowsOf(GROUPS);
    check('the summary form lists one row per group and no rooms',
        groupRows.length === 2 && groupRows.every((row) => row.kind === 'group'), groupRows.map((row) => row.text));
    check('and totals the groups, 75.75 - the two floors, without the unfiled room',
        near(table.Na__LeParamArea__Total(table.Na__LeParamArea__Normalise(config, GROUPS), groupRows), 75.75));
    check('with group headings switched off the rooms are still all there',
        rowsOf({ Form : 'areas', ShowGroups : false, Data : DATA }).filter((row) => row.kind === 'area').length === 6);
    check('an empty sheet says so in words rather than drawing an empty table',
        rowsOf({ Form : 'areas', Data : { Areas : [], Groups : [], TotalM2 : 0 } })[0].kind === 'empty');

    // -- WHAT IS DRAWN ------------------------------------------------------
    const built = build(AREAS);
    check('the FIRST record is a vector and its FIRST point is the origin',
        built.records[0].kind === 'shape' && built.records[0].record.Shape__Points[0][0] === 0 && built.records[0].record.Shape__Points[0][1] === 0,
        built.records[0].record.Shape__Points);
    check('every shape comes before every text, so the engine\'s slots stay put',
        built.records.findIndex((entry) => entry.kind === 'annotation') > built.records.map((entry) => entry.kind).lastIndexOf('shape') - 1
        && built.records.filter((entry) => entry.kind === 'shape').length === shapes(built).length);
    const kinds = built.records.map((entry) => entry.kind).join('');
    check('...and they are not interleaved at all', /^s+a+$/.test(kinds.replace(/shape/g, 's').replace(/annotation/g, 'a')), kinds);
    check('the title is lettered above the top rule (a negative y), as a drawing title is',
        texts(built)[0].Annotation__PosYMm < 0 && texts(built)[0].Annotation__Text === 'Floor Areas', texts(built)[0]);
    check('the summary form is titled differently', words(build(GROUPS))[0] === 'Area Summary');
    check('a typed title wins over both', words(build({ Form : 'areas', TitleText : 'Proposed GIA', Data : DATA }))[0] === 'Proposed GIA');
    check('the column heads say Room and Area for rooms, Group and Area for groups',
        words(built)[1] === 'Room' && words(built)[2] === 'Area' && words(build(GROUPS))[1] === 'Group');
    check('every figure is ranged right at the table\'s far edge',
        texts(built).filter((record) => record.Annotation__Align === 'right').every((record) => near(record.Annotation__PosXMm, 78)));
    check('every room\'s name and figure is on the paper',
        [ 'Kitchen', 'Living Room', 'Hall', 'Bedroom 1', 'Bedroom 2', 'Store' ].every((name) => words(built).indexOf(name) !== -1));
    check('the figures are written in square metres to two decimals',
        words(built).indexOf('18.45 m²') !== -1 && words(built).indexOf('24.10 m²') !== -1, words(built));
    check('the total row is lettered Total and carries the total',
        words(built)[words(built).length - 2] === 'Total' && words(built)[words(built).length - 1] === '78.25 m²', words(built).slice(-2));
    // EVERY ROW EVENLY SPACED, AND A HEADING CLEAR OF WHAT IS UNDER IT. The
    // first version added the group gap to both the heading's band and its
    // baseline, so a heading sat a millimetre and a half low, hard against
    // its first room, while every other row was even. Nothing but a rendered
    // picture showed it, so it is asserted here for good.
    const baselines = texts(built).filter((record) => record.Annotation__Align === 'left' && record.Annotation__PosYMm > 8).map((record) => record.Annotation__PosYMm);
    const gaps = baselines.slice(1).map((value, index) => Math.round((value - baselines[index]) * 1000) / 1000).filter((gap) => gap > 0);
    const pitch = config['AreaSchedule__RowPitchMm'];
    const groupGap = config['AreaSchedule__GroupGapMm'];
    const bodyGaps = gaps.slice(0, -1);                                       // <-- The last gap is the total's, which has a rule and a gap of its own
    check('every row is one pitch below the last, and a group heading exactly one gap more',
        bodyGaps.every((gap) => Math.abs(gap - pitch) < 0.01 || Math.abs(gap - (pitch + groupGap)) < 0.01), { gaps : bodyGaps, pitch : pitch, groupGap : groupGap });
    check('a group heading really does stand clear of the room under it',
        bodyGaps.some((gap) => Math.abs(gap - (pitch + groupGap)) < 0.01), bodyGaps);
    check('the total stands below the last row with its rule between', gaps[gaps.length - 1] > pitch, gaps[gaps.length - 1]);
    check('no two rows are ever closer together than the pitch', Math.min.apply(null, gaps) >= pitch - 0.01, gaps);

    check('a colour chip is drawn for every coloured row', shapes(built).filter((record) => record.Shape__FillColour === '#bcd9ee').length === 4, shapes(built).length);
    check('chips off, and the chips go', shapes(build({ Form : 'areas', ShowSwatch : false, Data : DATA })).filter((record) => record.Shape__FillColour).length === 0);
    check('the total row off, and the total goes with its rule',
        words(build({ Form : 'areas', ShowTotal : false, Data : DATA })).indexOf('Total') === -1);

    // -- THE UNITS AND THE DECIMALS -----------------------------------------
    check('square feet: 18.45 m2 is 199 ft2', words(build({ Form : 'areas', Units : 'ft2', Data : DATA })).indexOf('199 ft²') !== -1);
    check('both, metres first', words(build({ Form : 'areas', Units : 'both', Data : DATA })).indexOf('18.45 m² (199 ft²)') !== -1);
    check('one decimal place, rounded the way a person rounds: 18.45 -> 18.5, which toFixed alone gets wrong',
        words(build({ Form : 'areas', Decimals : 1, Data : DATA })).indexOf('18.5 m²') !== -1, words(build({ Form : 'areas', Decimals : 1, Data : DATA })));
    check('none at all', words(build({ Form : 'areas', Decimals : 0, Data : DATA })).indexOf('18 m²') !== -1);

    // -- THE TABLE AND THE LABEL MUST NEVER DISAGREE ------------------------
    // Two separate formatters - this one and the floor area system's own,
    // which writes the name in the middle of each room - because this module
    // imports nothing. So they are run side by side here on the awkward
    // numbers, and if one is ever changed without the other this fails.
    const geoPath = join(APP, '51__System__LayoutEditor', '59__Feature__FloorAreas', 'Na__LayoutEditor__FloorAreas__Geometry__.js');
    copyFileSync(geoPath, join(SCRATCH, 'geo.js'));
    const geo = await import(pathToFileURL(join(SCRATCH, 'geo.js')).href);
    const both = [ 18.45, 0.05, 2.675, 1234.565, 0, 99.995, 78.25 ];
    const same = both.every((value) => [ 0, 1, 2, 3 ].every((places) =>
        geo.Na__LeAreaGeo__FormatArea(value, { decimals : places, separator : config['AreaSchedule__Separator'], suffixM2 : config['AreaSchedule__SuffixM2'] })
        === table.Na__LeParamArea__Figure(config, table.Na__LeParamArea__Normalise(config, { Decimals : places, Data : DATA }), value)));
    check('the schedule and the room label write every awkward number identically', same,
        both.map((value) => [ geo.Na__LeAreaGeo__FormatArea(value, { decimals : 1, separator : ',', suffixM2 : ' m²' }), table.Na__LeParamArea__Figure(config, table.Na__LeParamArea__Normalise(config, { Decimals : 1, Data : DATA }), value) ]));

    // -- THE SIZE, THE STRETCH AND THE GRIPS --------------------------------
    check('the table is 78 mm wide as it ships', near(built.sizeMm.WidthMm, 78));
    check('a longer list is a taller table', build(AREAS).sizeMm.HeightMm > build(GROUPS).sizeMm.HeightMm);
    const handles = table.Na__LeParamArea__Handles(config, AREAS);
    check('the stretch arrow stands at the right end of the top rule', near(handles.stretch.x, 78) && near(handles.stretch.y, 0));
    check('the lookup triangle stands at its left end', near(handles.lookup.x, 0) && near(handles.lookup.y, 0));
    check('there is no link socket: a schedule reads the sheet, not a drawing', handles.link === null && handles.slide === null);
    check('a stretch to 96.4 mm lands on the 2 mm step', near(table.Na__LeParamArea__StretchTo(config, AREAS, 96.4).WidthMm, 96));
    check('and is held inside the limits', table.Na__LeParamArea__StretchTo(config, AREAS, 5).WidthMm === config['AreaSchedule__WidthMinMm']);

    // -- THE MENU -----------------------------------------------------------
    const menu = table.Na__LeParamArea__Choices(config, AREAS, null);
    check('the menu offers both forms, with the one in use ticked',
        menu[0].checked === true && menu[1].checked === false && menu[1].patch.Form === 'groups');
    check('it offers every group the table is holding', menu.filter((item) => item.patch && item.patch.Group).length === 2, menu.map((item) => item.label));
    check('every entry is a patch, which is the same rebuild the panel makes',
        menu.every((item) => item.separator === true || (typeof item.label === 'string' && !!item.patch)));

    // -- THE RECORD, KEPT SAFE ----------------------------------------------
    const normalised = table.Na__LeParamArea__Normalise(config, { Form : 'nonsense', Units : 'cubits', Decimals : 9, WidthMm : 5000, Data : { Areas : [ { Name : 42, AreaM2 : -3 } ] } });
    check('nonsense is made whole rather than drawn', normalised.Form === 'areas' && normalised.Units === 'm2' && normalised.Decimals === 3 && normalised.WidthMm === 260);
    check('a row with no name and no area is kept as an empty one, not a NaN',
        normalised.Data.Areas[0].Name === '' && normalised.Data.Areas[0].AreaM2 === 0, normalised.Data.Areas[0]);
    check('a crossed room prints a dash rather than a number',
        words(build({ Form : 'areas', Data : { Areas : [ { Name : 'Odd', AreaM2 : 5, Crossing : true } ], Groups : [], TotalM2 : 0 } })).indexOf('-') !== -1);

    // -- THE TYPE AND ITS TILES ---------------------------------------------
    const type = table.Na__LeParamArea__CreateType(() => config, () => null);
    check('the type is never tied to a viewport and has no scale bar',
        type.type === 'AreaSchedule' && type.linkable === false && type.hasBar() === false);
    check('it takes no scale at all, so a change of one leaves it alone',
        type.defaults().ScaleDenominator === undefined && type.normalise({ ScaleDenominator : 50 }).ScaleDenominator === undefined);
    check('it names Data as the fact the floor area system fills in', Array.isArray(type.facts) && type.facts.indexOf('Data') !== -1);
    check('it keeps every choice through a rebuild',
        [ 'Form', 'Group', 'Units', 'Decimals', 'WidthMm', 'TextSizeMm', 'Data' ].every((key) => type.keep.indexOf(key) !== -1));
    check('it builds with no tools at all, as it must under a tile', type.build({}).records.length > 2);
    check('a missing config still draws the shipped table',
        table.Na__LeParamArea__Build(null, AREAS).records.length === built.records.length);
    const offered = elements.Elements__List.filter((element) => element.Element__Type === 'AreaSchedule');
    check('the scrapbook offers both forms as tiles, each preset to one of them',
        offered.length === 2 && offered[0].Element__Params.Form === 'areas' && offered[1].Element__Params.Form === 'groups', offered.map((element) => element.Element__Id));
    check('each tile previews with rooms in it, so it is not an empty box on the shelf',
        offered.every((element) => !!element.Element__PreviewParams && !!element.Element__PreviewParams.Data));
    check('the type is named for the sheet\'s group tag and the panel', elements.Elements__TypeNames.AreaSchedule === 'Area Schedule');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
