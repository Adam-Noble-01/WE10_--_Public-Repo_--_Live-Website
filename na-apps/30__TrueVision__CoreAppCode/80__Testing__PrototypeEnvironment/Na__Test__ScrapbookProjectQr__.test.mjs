// =============================================================================
// TRUEVISION3D - TEST - PARAMETRIC SCRAPBOOK - PROJECT PORTAL BLOCK
// =============================================================================
//
// FILE       : Na__Test__ScrapbookProjectQr__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Parametric Scrapbook Project Portal Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Project Portal block draws what it is meant to - one record for the code, the button, the words - and that its two forms, its sizes, its quiet zone and its project name hold
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The Project Portal type imports NOTHING, so the one file is copied into a
//   scratch folder beside a package.json that tells Node it is an ES module -
//   the app folder has none, and a .js there loads as CommonJS - and then run
//   against the app's own config file, exactly as the editor runs it.
// - THE CHECK THAT MATTERS MOST IS THE QUIET ZONE. The code is not encoded
//   here and is not in the record: the box carries a Shape__Qr block and the
//   painter fills it. What this module IS responsible for is the clear paper
//   inside that box, and the arithmetic is proved against the Project QR
//   Code system's own config - the two modules it asks for, at every size the
//   list offers - rather than against a number typed in twice.
// - The second is that the records come out in a fixed order however the
//   block is set, because the engine updates an element in place, slot for
//   slot: the code box has to be vector one every time or a resize would
//   rewrite the wrong record.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookProjectQr__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the Project Portal block.
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
    const MODULE     = 'Na__LayoutEditor__ScrapbookParametric__ProjectQr__.js';
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-projectportal-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type" : "module" }');     // <-- So the copy's .js name loads as an ES module
    copyFileSync(join(FEATURE, MODULE), join(SCRATCH, MODULE));
    const portal     = await import(pathToFileURL(join(SCRATCH, MODULE)).href);
    const whole      = JSON.parse(readFileSync(join(FEATURE, 'Na__LayoutEditor__ScrapbookParametric__Config__.json'), 'utf8'));
    const config     = whole['LayoutEditor__ScrapbookParametric__ProjectQr'];
    const elements   = whole['LayoutEditor__ScrapbookParametric__Elements'];

    // THE QR SYSTEM'S OWN NUMBERS | What the quiet zone has to satisfy, read
    // from the system that owns them rather than restated here
    const qrConfig = JSON.parse(readFileSync(join(APP, '53__System__ProjectQrCode', 'Na__ProjectQr__Config__.json'), 'utf8'));
    const QUIET    = qrConfig['ProjectQr__Symbol__Config']['ProjectQr__Symbol__QuietZoneModules'];
    const FLOOR_MM = qrConfig['ProjectQr__Symbol__Config']['ProjectQr__Symbol__MinModuleMm'];
    const MODULES  = 29;                                                      // <-- A version 3 symbol, which is what the shipped 42 byte address encodes to

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
    const build  = (params, tools) => portal.Na__LeParamQr__Build(config, params, tools);
    const shapes = (built) => built.records.filter((entry) => entry.kind === 'shape').map((entry) => entry.record);
    const texts  = (built) => built.records.filter((entry) => entry.kind === 'annotation').map((entry) => entry.record);
    const words  = (built) => texts(built).map((record) => record.Annotation__Text);
    const NAMED  = { projectName : () => 'PS01 - Musters Road' };

    console.log('TrueVision3D - parametric scrapbook project portal block');

    // THE CODE | One record, first, with its origin at (0, 0)
    const compact = build({}, NAMED);
    const box     = shapes(compact)[0];
    check('the first record is the code\'s box, and its first point is the origin',
        compact.records[0].kind === 'shape' && box.Shape__Points[0][0] === 0 && box.Shape__Points[0][1] === 0 && box.Shape__Closed === true);
    check('the code is ONE record, not one per module: a box carrying a Shape__Qr block',
        !!box.Shape__Qr && typeof box.Shape__Qr === 'object' && Number.isFinite(box.Shape__Qr.Qr__MarginMm), box.Shape__Qr);
    check('nothing else on the sheet carries a code',
        shapes(compact).filter((record) => !!record.Shape__Qr).length === 1);
    check('the block encodes nothing and names no project in the record: the painter asks the QR system',
        JSON.stringify(box.Shape__Qr) === JSON.stringify({ Qr__MarginMm : box.Shape__Qr.Qr__MarginMm }), box.Shape__Qr);
    check('the box is square', near(box.Shape__Points[1][0] - box.Shape__Points[0][0], box.Shape__Points[2][1] - box.Shape__Points[1][1]));

    // THE QUIET ZONE | The whole reason the margin is a fraction and not a size
    const sizes = portal.Na__LeParamQr__SizeChoices(config);
    check('the size list is the config\'s, in order, and 30 mm is the default',
        sizes.join() === '15,20,25,30' && portal.Na__LeParamQr__Standard(config).SizeMm === 30, sizes);
    const zones = sizes.map((sizeMm) => {
        const metrics = portal.Na__LeParamQr__Metrics(config, portal.Na__LeParamQr__Normalise(config, { SizeMm : sizeMm }));
        return { sizeMm : sizeMm, modules : metrics.marginMm / (sizeMm / MODULES), moduleMm : sizeMm / MODULES, boxMm : metrics.boxMm };
    });
    check('every size in the list keeps the ' + QUIET + ' modules of clear paper the QR system asks for',
        zones.every((zone) => zone.modules >= QUIET - 1e-9), zones.map((zone) => [ zone.sizeMm, Math.round(zone.modules * 1000) / 1000 ]));
    check('the clear zone is the SAME number of modules at every size, which is what a fraction buys',
        zones.every((zone) => near(zone.modules, zones[0].modules, 1e-6)), zones.map((zone) => zone.modules));
    check('every size in the list prints a module far above the ' + FLOOR_MM + ' mm floor a phone needs',
        zones.every((zone) => zone.moduleMm > FLOOR_MM), zones.map((zone) => [ zone.sizeMm, Math.round(zone.moduleMm * 1000) / 1000 ]));
    // THE STANDARD SIZE IS FOUND BY ITS VALUE, NEVER BY ITS PLACE IN THE LIST.
    // It used to be zones[2], which was 30 mm only while the list happened to
    // read 20, 25, 30, 40, 50: when the list changed to 15, 20, 25, 30 on
    // 21-Sep-2026 every check below it silently moved to 25 mm and failed.
    const standard = zones.find((zone) => zone.sizeMm === 30);
    check('the standard 30 mm size is one of the sizes offered', !!standard, sizes);
    check('at 30 mm the box is 34.2 mm and the margin 2.1 mm - three and a half times the code the title block prints',
        near(standard.boxMm, 34.2, 1e-6) && near(standard.boxMm - 30, 2.1 * 2, 1e-6), standard);
    check('the list runs to 30 mm and no further: past that the code stops being a detail on the sheet',
        Math.max.apply(null, sizes) === 30 && Math.min.apply(null, sizes) === 15, sizes);

    // THE BLOCK'S PARTS | Everything Adam drew in the mock-up, and nothing else
    check('the compact block is the code, the button, the handset and its island: four vectors',
        shapes(compact).length === 4, shapes(compact).length);
    // THE HANDSET IS A MODERN PHONE (21-Sep-2026). The first glyph was a squat
    // box with a bar across its foot, and Adam found it too ambiguous to read
    // as a phone. A tall slim body with a filled pill across the top of its
    // screen is what every current phone looks like.
    const handset = shapes(compact)[2];
    const island  = shapes(compact)[3];
    const spanOf  = (record, axis) => Math.max.apply(null, record.Shape__Points.map((p) => p[axis])) - Math.min.apply(null, record.Shape__Points.map((p) => p[axis]));
    const topOf   = (record) => Math.min.apply(null, record.Shape__Points.map((p) => p[1]));
    check('the handset is a slim phone, at least half again as tall as it is wide',
        handset.Shape__Closed === true && spanOf(handset, 1) >= spanOf(handset, 0) * 1.5, [ spanOf(handset, 0), spanOf(handset, 1) ]);
    check('the island is a solid pill, filled and unruled, in the top quarter of the handset',
        island.Shape__Closed === true && island.Shape__Stroked === false && island.Shape__FillColour === handset.Shape__StrokeColour &&
        topOf(island) > topOf(handset) && topOf(island) < topOf(handset) + (spanOf(handset, 1) / 4), island);
    check('it letters the button, the caption, the heading, the project and the four bullets',
        words(compact).join('|') === [ 'Scan Me', 'Use your phone or tablet camera', 'View Project Portal', 'PS01 - Musters Road',
            '·   Walk Through the 3D Model', '·   Saved Scenes and Viewpoints', '·   Measuring Tools', '·   Live Drawings Online' ].join('|'), words(compact));
    check('the caption says to use a phone OR A TABLET, and says camera, for somebody who has never scanned anything',
        /phone/i.test(config.ProjectQr__CaptionText) && /tablet/i.test(config.ProjectQr__CaptionText) && /camera/i.test(config.ProjectQr__CaptionText), config.ProjectQr__CaptionText);
    check('every vector comes before every text, so the engine\'s slots never move',
        compact.records.map((entry) => entry.kind[0]).join('') === 'ssssaaaaaaaa', compact.records.map((entry) => entry.kind[0]).join(''));
    check('the button is a stadium the width of the code\'s box at the standard size',
        near(Math.max.apply(null, shapes(compact)[1].Shape__Points.map((p) => p[0])), standard.boxMm, 1e-6) &&
        near(Math.min.apply(null, shapes(compact)[1].Shape__Points.map((p) => p[0])), 0, 1e-6));
    check('the button stands clear below the code, never over it',
        Math.min.apply(null, shapes(compact)[1].Shape__Points.map((p) => p[1])) >= standard.boxMm);

    // THE SMALLEST CODE IS NARROWER THAN THE BUTTON'S OWN LABEL, and the
    // button has to grow rather than wear its words out of both ends. The
    // handset and the wording are house sizes and do not shrink with the code.
    const small     = build({ SizeMm : 15 }, NAMED);
    const smallBox  = zones.find((zone) => zone.sizeMm === 15).boxMm;
    const smallBtn  = shapes(small)[1].Shape__Points.map((p) => p[0]);
    const smallWide = Math.max.apply(null, smallBtn) - Math.min.apply(null, smallBtn);
    const glyphX    = shapes(small)[2].Shape__Points.map((p) => p[0]);
    check('at 15 mm the button grows past the code box rather than cutting its own label',
        smallWide > smallBox && near(Math.min.apply(null, smallBtn), 0, 1e-6), { smallBox : smallBox, buttonMm : Math.round(smallWide * 100) / 100 });
    check('the handset and the words sit INSIDE the button at every size in the list',
        sizes.every((sizeMm) => {
            const made   = build({ SizeMm : sizeMm }, NAMED);
            const pill   = shapes(made)[1].Shape__Points.map((p) => p[0]);
            const inside = shapes(made).slice(2).concat([]).every((shape) => shape.Shape__Points.every((p) => p[0] >= Math.min.apply(null, pill) - 1e-6 && p[0] <= Math.max.apply(null, pill) + 1e-6));
            const label  = texts(made)[0];
            return inside && label.Annotation__PosXMm >= Math.min.apply(null, pill) && label.Annotation__PosXMm <= Math.max.apply(null, pill);
        }), sizes);
    check('the block is at least as wide as its button, so the button is never outside the element',
        small.sizeMm.WidthMm >= smallWide - 1e-6 && glyphX.length > 0, { widthMm : small.sizeMm.WidthMm, buttonMm : smallWide });
    check('nothing is lettered above the origin: the code box is the top of the block',
        texts(compact).every((record) => record.Annotation__PosYMm > 0));
    check('the block is at least as wide as its code, and the box at least as tall',
        compact.sizeMm.WidthMm >= standard.boxMm && compact.sizeMm.HeightMm > standard.boxMm, compact.sizeMm);

    // THE TYPE IS SET, NOT JUST PLACED (21-Sep-2026)
    // ------------------------------------------------------------
    // Adam, on the first build: "Sort out the spacing and alignment. See, they
    // are way off. There needs to be space between the title, the subtitle, the
    // job number." Every gap in this block is a distance from one BASELINE to
    // the next, and the first numbers were chosen as though they were the space
    // between two lines - so each line sat on the descenders of the one above.
    // These two checks are that fault, written down: air between every pair of
    // lines in a column, and one left edge for the whole column.
    const CAP       = 0.72;                                                   // <-- Open Sans cap height, as a fraction of the size
    const DESCENDER = 0.24;                                                   // <-- And how far it hangs below the baseline
    const MIN_AIR   = 1.0;                                                    // <-- The least clear paper between one line's tail and the next line's capitals
    function airBetweenLines(built) {
        const columns = new Map();
        texts(built).forEach((record) => {
            const key = Math.round(record.Annotation__PosXMm * 100) / 100;
            if (!columns.has(key)) columns.set(key, []);
            columns.get(key).push(record);
        });
        const tight = [];
        columns.forEach((lines) => {
            if (lines.length < 2) return;                                     // <-- A line on its own - the button's own label - is in no column
            lines.sort((a, b) => a.Annotation__PosYMm - b.Annotation__PosYMm);
            for (let i = 1; i < lines.length; i++) {
                const above = lines[i - 1], below = lines[i];
                const air   = (below.Annotation__PosYMm - above.Annotation__PosYMm)
                            - (above.Annotation__SizeMm * DESCENDER)
                            - (below.Annotation__SizeMm * CAP);
                if (air < MIN_AIR) tight.push({ above : above.Annotation__Text, below : below.Annotation__Text, airMm : Math.round(air * 100) / 100 });
            }
        });
        return tight;
    }
    check('no line sits on the descenders of the one above it, in the compact form',
        airBetweenLines(compact).length === 0, airBetweenLines(compact));

    check('the whole compact column reads down ONE left edge, the code box\'s own',
        texts(compact).filter((record) => record.Annotation__Text !== config.ProjectQr__ButtonText)
            .every((record) => record.Annotation__PosXMm === 0 && record.Annotation__Align === 'left'),
        texts(compact).map((record) => [ record.Annotation__Text.slice(0, 18), record.Annotation__PosXMm, record.Annotation__Align ]));

    // THE TWO FORMS
    const full = build({ Form : 'full' }, NAMED);
    check('the full form letters the heading and the paragraph beside the column',
        words(full).indexOf('Project Portal') !== -1 && words(full).length > words(compact).length, words(full).length);
    check('the full form is wider than the compact one and starts at the same code',
        full.sizeMm.WidthMm > compact.sizeMm.WidthMm && shapes(full)[0].Shape__Points[0].join() === '0,0');
    check('no line sits on the descenders of the one above it, in the full form either',
        airBetweenLines(full).length === 0, airBetweenLines(full));
    check('the title, the project name and the paragraph share one left edge of their own',
        (() => {
            const atX = standard.boxMm + config.ProjectQr__ColumnGapMm;
            const right = texts(full).filter((record) => record.Annotation__PosXMm > 0.001 && record.Annotation__Text !== config.ProjectQr__ButtonText);
            return right.length >= 3 && right.every((record) => near(record.Annotation__PosXMm, atX, 1e-6));
        })(), texts(full).map((record) => [ record.Annotation__Text.slice(0, 16), record.Annotation__PosXMm ]));
    check('the paragraph is wrapped, not one long line',
        words(full).filter((line) => /^Point your phone/.test(line)).length === 1 && words(full).length - words(compact).length >= 3, words(full));
    check('it wraps to the width it is given: a narrower column takes more lines',
        build({ Form : 'full', BodyWidthMm : 50 }, NAMED).records.length > build({ Form : 'full', BodyWidthMm : 160 }, NAMED).records.length);
    check('the project is lettered ONCE in the full form - under the big heading, not in both columns',
        words(full).filter((line) => line === 'PS01 - Musters Road').length === 1, words(full).filter((line) => line === 'PS01 - Musters Road'));
    check('it is lettered once in the compact form too',
        words(compact).filter((line) => line === 'PS01 - Musters Road').length === 1);
    check('the copy names no other app, because what is offered is the building',
        !/PlanVision|TrueVision/i.test(config.ProjectQr__BodyText + config.ProjectQr__TitleText + config.ProjectQr__HeadingText + config.ProjectQr__Bullets.join(' ')), config.ProjectQr__BodyText);
    check('the copy says 3D, says to point a phone or tablet at it, and answers the objection that stops people',
        /3D/.test(config.ProjectQr__BodyText) && /phone or tablet/i.test(config.ProjectQr__BodyText) && /download|install/i.test(config.ProjectQr__BodyText));

    // THE PROJECT NAME | A fact, live, and overridable
    check('with nothing to ask, it reads the placeholder and says it is unresolved',
        portal.Na__LeParamQr__ProjectText(config, {}, null).text === portal.Na__LeParamQr__NAME_MISSING &&
        portal.Na__LeParamQr__ProjectText(config, {}, null).resolved === false);
    check('with something to ask, it reads the project',
        portal.Na__LeParamQr__ProjectText(config, {}, NAMED).text === 'PS01 - Musters Road');
    check('renaming the project rewrites the block: the name is read on every build, never stored',
        words(build({}, { projectName : () => 'PS02 - Trent Road' })).indexOf('PS02 - Trent Road') !== -1 &&
        JSON.stringify(portal.Na__LeParamQr__Normalise(config, {})).indexOf('Musters') === -1);
    const typed = portal.Na__LeParamQr__ProjectText(config, { ProjectName : '  Musters   Road  ' }, NAMED);
    check('a name typed by hand wins, tidied, and says it was typed', typed.text === 'Musters Road' && typed.typed === true, typed);
    check('clearing the box goes back to following the project',
        portal.Na__LeParamQr__ProjectText(config, { ProjectName : '' }, NAMED).typed === false);
    check('a tools object that throws is no worse than none',
        portal.Na__LeParamQr__ProjectText(config, {}, { projectName : () => { throw new Error('no project'); } }).text === portal.Na__LeParamQr__NAME_MISSING);

    // RESIZING | One parameter, and the block follows it
    const big = build({ SizeMm : 50 }, NAMED);
    check('a bigger code makes a bigger box and a wider button, and changes nothing else about the words',
        shapes(big)[0].Shape__Points[1][0] > shapes(compact)[0].Shape__Points[1][0] &&
        words(big).join('|') === words(compact).join('|'));
    check('the type is set in paper millimetres and does NOT scale with the code',
        texts(big)[2].Annotation__SizeMm === texts(compact)[2].Annotation__SizeMm && texts(big)[2].Annotation__SizeMm === config.ProjectQr__HeadingSizeMm);
    check('a resize keeps the record count exactly, so the engine updates in place rather than deleting and drawing again',
        big.records.length === compact.records.length && big.records.map((entry) => entry.kind).join() === compact.records.map((entry) => entry.kind).join());
    check('the same parameters build the same records, byte for byte',
        JSON.stringify(build({ SizeMm : 40 }, NAMED)) === JSON.stringify(build({ SizeMm : 40 }, NAMED)));

    // PARAMETERS MADE WHOLE
    const junk = portal.Na__LeParamQr__Normalise(config, { SizeMm : 'big', Form : 'sideways', BodyWidthMm : null, ProjectName : 42 });
    check('junk parameters fall back to the config\'s standard',
        junk.SizeMm === 30 && junk.Form === 'compact' && junk.BodyWidthMm === 95 && junk.ProjectName === '', junk);
    check('a size is held inside its limits',
        portal.Na__LeParamQr__Normalise(config, { SizeMm : 2 }).SizeMm === config.ProjectQr__SizeMinMm &&
        portal.Na__LeParamQr__Normalise(config, { SizeMm : 9999 }).SizeMm === config.ProjectQr__SizeMaxMm);
    check('a width is held inside its limits',
        portal.Na__LeParamQr__Normalise(config, { BodyWidthMm : 1 }).BodyWidthMm === config.ProjectQr__BodyWidthMinMm &&
        portal.Na__LeParamQr__Normalise(config, { BodyWidthMm : 9999 }).BodyWidthMm === config.ProjectQr__BodyWidthMaxMm);
    check('a size is kept to a tenth, so a rebuild writes the same number',
        portal.Na__LeParamQr__Normalise(config, { SizeMm : 30.000000000000004 }).SizeMm === 30);

    // THE GRIPS AND THE MENU
    const compactGrips = portal.Na__LeParamQr__Handles(config, {});
    const fullGrips    = portal.Na__LeParamQr__Handles(config, { Form : 'full' });
    check('neither form has a link socket: this block reads the project, not a drawing',
        compactGrips.link === null && fullGrips.link === null);
    check('the lookup triangle stands off the code box\'s top right corner in both forms',
        near(compactGrips.lookup.x, standard.boxMm, 1e-6) && compactGrips.lookup.y === 0 && fullGrips.lookup.x === compactGrips.lookup.x);
    check('the compact form has nothing to stretch; the full form\'s arrow is at the end of its paragraph',
        compactGrips.stretch === null && near(fullGrips.stretch.x, standard.boxMm + config.ProjectQr__ColumnGapMm + 95, 1e-6), fullGrips.stretch);
    const dragged = portal.Na__LeParamQr__StretchTo(config, { Form : 'full' }, standard.boxMm + config.ProjectQr__ColumnGapMm + 122);
    check('a stretch sets the width in 5 mm steps and keeps the form', dragged.BodyWidthMm === 120 && dragged.Form === 'full', dragged);
    check('a stretch on the compact form changes nothing', portal.Na__LeParamQr__StretchTo(config, {}, 400).BodyWidthMm === 95);
    const menu = portal.Na__LeParamQr__Choices(config, { SizeMm : 25 }, null);
    check('the menu offers every size, ticks the one it is, and offers the two forms',
        menu.filter((item) => item.patch && item.patch.SizeMm !== undefined).length === sizes.length &&
        menu.filter((item) => item.checked && item.patch.SizeMm === 25).length === 1 &&
        menu.filter((item) => item.patch && item.patch.Form !== undefined).length === 2, menu);
    check('every menu entry is a patch, which is the same rebuild the panel makes',
        menu.every((item) => item.separator === true || (typeof item.label === 'string' && !!item.patch)));

    // THE TYPE | What the engine and the panel are told
    const type = portal.Na__LeParamQr__CreateType(() => config, () => null);
    check('the type is never tied to a viewport, and has no scale bar',
        type.type === 'ProjectQr' && type.linkable === false && type.hasBar() === false);
    check('the type takes no scale at all, so a change of one leaves it alone',
        type.defaults().ScaleDenominator === undefined && type.normalise({ ScaleDenominator : 50 }).ScaleDenominator === undefined);
    check('the type keeps every choice through a rebuild',
        [ 'SizeMm', 'Form', 'BodyWidthMm', 'ProjectName' ].every((key) => type.keep.indexOf(key) !== -1));
    check('the type builds with no tools at all, as it must under the tile',
        type.build({}).records.length > 2 && type.build({}).records[0].record.Shape__Qr !== undefined);
    check('a missing config still draws the shipped block',
        portal.Na__LeParamQr__Build(null, {}, NAMED).records.length === compact.records.length &&
        portal.Na__LeParamQr__Build({}, {}, NAMED).records[0].record.Shape__Qr.Qr__MarginMm === 2.1);

    // THE TWO TILES | What the scrapbook offers
    const offered = elements.Elements__List.filter((element) => element.Element__Type === 'ProjectQr');
    check('the scrapbook offers both forms as tiles, each preset to one of them',
        offered.length === 2 && offered[0].Element__Params.Form === 'compact' && offered[1].Element__Params.Form === 'full', offered.map((element) => element.Element__Id));
    check('each tile has a name and a description, and neither presets a size: 30 mm is the standard',
        offered.every((element) => !!element.Element__Name && !!element.Element__Description && element.Element__Params.SizeMm === undefined));
    check('the type is named for the sheet\'s group tag and the panel', elements.Elements__TypeNames.ProjectQr === 'Project Portal');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
