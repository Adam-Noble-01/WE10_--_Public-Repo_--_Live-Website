// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - AREA SCHEDULE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__AreaSchedule__.js
// NAMESPACE  : Na__LeParamArea
// MODULE     : Layout Editor - Parametric Scrapbook - Area Schedule
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The table that reports what the rooms on a sheet add up to - every room under its group, or every group's total
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - TWO FORMS, ONE TYPE. AREAS is a row per room, under its group heading with
//   a subtotal; GROUPS is a row per group and nothing else - the summary a
//   planning statement quotes. They are two presets of one type, because they
//   are the same table with more or less said, and the lookup grip swaps
//   between them.
// - THE NUMBERS ARE A PARAMETER, and that is the whole design. This module is
//   PURE - parameters in, records out - so the sheet's index reaches it as
//   `Data`, filled by 59__Feature__FloorAreas' before-announce hook exactly as
//   the Drawing Title's Existing / Proposed / North are filled by the viewport
//   link. That is what lets the table draw under Node, in a tile preview and in
//   a drag ghost, and what makes the stored block say exactly what the drawing
//   on the paper says.
// - IT IS DRAWN, NOT LAID OUT BY A GRID. Every rule is a vector and every cell
//   a text run, in a fixed order however the table is set, so the engine can
//   update it in place slot for slot: a room renamed rewrites one text record
//   and moves nothing else.
// - THE ORIGIN IS THE LEFT END OF THE TOP RULE, with the title above it and
//   the rows below - the Drawing Title's idiom, and what lets the engine find
//   the block again after it has been dragged anywhere on the sheet.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__Panel__ScrapbookParametric__ with a reader
//   for the config's AreaSchedule block.
// - PURE: no DOM, no editor modules, no imports at all. Whatever it cannot
//   reach arrives in `tools` (the text measurer).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the two forms, the group headings and subtotals,
//   the total, the swatches, the units and the stretch.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, Its Forms and What a Rebuild Keeps
    // ------------------------------------------------------------
    const Na__LeParamArea__TYPE        = 'AreaSchedule';
    const Na__LeParamArea__FORM_AREAS  = 'areas';
    const Na__LeParamArea__FORM_GROUPS = 'groups';
    const Na__LeParamArea__FORMS       = Object.freeze([ Na__LeParamArea__FORM_AREAS, Na__LeParamArea__FORM_GROUPS ]);
    const Na__LeParamArea__UNITS       = Object.freeze([ 'm2', 'ft2', 'both' ]);
    const Na__LeParamArea__KEEP        = Object.freeze([ 'Form', 'Group', 'ShowGroups', 'ShowTotal', 'ShowSwatch', 'Units', 'Decimals', 'TitleText', 'WidthMm', 'TextSizeMm', 'Data' ]);
    const Na__LeParamArea__MAX_ROWS    = 240;                                    // <-- A sheet with more rooms than this has a problem a table cannot fix
    const Na__LeParamArea__SQ_FT       = 10.763910416709722;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Every Value Falls Back To
    // ------------------------------------------------------------
    // Mirrors the shipped config block, so a config that could not be read
    // still draws the shipped table rather than nothing.
    // ------------------------------------------------------------
    const Na__LeParamArea__FALLBACK = Object.freeze({
        WidthMm            : 78,
        WidthMinMm         : 40,
        WidthMaxMm         : 260,
        WidthStepMm        : 2,

        TextSizeMm         : 2.4,
        TextWeight         : 400,
        TextColour         : '#172b3a',
        HeadWeight         : 600,
        HeadColour         : '#172b3a',
        MutedColour        : '#5f6b74',

        TitleSizeMm        : 3.2,
        TitleWeight        : 600,
        TitleColour        : '#172b3a',
        TitleAboveRuleMm   : 1.8,

        RulePt             : 0.4,
        HairlinePt         : 0.2,
        RuleColour         : '#172b3a',
        HairlineColour     : '#858585',

        HeaderBaselineMm   : 3.4,
        HeaderRuleMm       : 4.6,
        RowPitchMm         : 4.2,
        RowBaselineMm      : 2.9,
        GroupGapMm         : 1.6,
        TotalGapMm         : 1.4,

        SwatchSizeMm       : 2.0,
        SwatchGapMm        : 1.6,
        IndentMm           : 3.0,

        HeadingAreas       : 'Floor Areas',
        HeadingGroups      : 'Area Summary',
        ColumnRoom         : 'Room',
        ColumnGroup        : 'Group',
        ColumnArea         : 'Area',
        TotalLabel         : 'Total',
        SubtotalLabel      : '',
        UngroupedLabel     : 'Ungrouped',
        EmptyLabel         : 'No areas measured on this sheet',
        CrossedLabel       : '-',
        Units              : 'm2',
        Decimals           : 2,
        FeetDecimals       : 0,
        Separator          : ',',
        SuffixM2           : ' m²',
        SuffixFt2          : ' ft²'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Value of the AreaSchedule Block, or Its Fallback
    // ------------------------------------------------------------
    function Na__LeParamArea__Number(config, key) {
        const value = config ? config['AreaSchedule__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamArea__FALLBACK[key];
    }
    function Na__LeParamArea__Text(config, key) {
        const value = config ? config['AreaSchedule__' + key] : undefined;
        return (typeof value === 'string') ? value : Na__LeParamArea__FALLBACK[key];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parameters
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Table
    // ------------------------------------------------------------
    // No ScaleDenominator anywhere: a schedule is type on paper, and type on a
    // drawing is house sizes whatever the drawing beside it is drawn at. So a
    // change of scale never touches one.
    // ------------------------------------------------------------
    function Na__LeParamArea__Standard(config) {
        return {
            Form       : Na__LeParamArea__FORM_AREAS,
            Group      : '',
            ShowGroups : true,
            ShowTotal  : true,
            ShowSwatch : true,
            Units      : Na__LeParamArea__Text(config, 'Units'),
            Decimals   : Na__LeParamArea__Number(config, 'Decimals'),
            TitleText  : '',
            WidthMm    : Na__LeParamArea__Number(config, 'WidthMm'),
            TextSizeMm : Na__LeParamArea__Number(config, 'TextSizeMm'),
            Data       : { Areas : [], Groups : [], TotalM2 : 0 }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rows a Table Was Given, Made Safe
    // ------------------------------------------------------------
    // The numbers come from the sheet through the hook, so they are trusted no
    // further than any other stored value: a name is text, an area is a finite
    // number of at least zero, and there are never more rows than a table
    // could sensibly carry.
    // ------------------------------------------------------------
    function Na__LeParamArea__NormaliseData(given) {
        const data   = (given && typeof given === 'object' && !Array.isArray(given)) ? given : {};
        const text   = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : '');
        const number = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0) ? Math.round(value * 1000000) / 1000000 : 0;
        const colour = (value) => (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())) ? value.trim() : null;
        const areas  = (Array.isArray(data.Areas) ? data.Areas : []).slice(0, Na__LeParamArea__MAX_ROWS).map((row) => {
            const kept = { Name : text(row && row.Name), AreaM2 : number(row && row.AreaM2) };
            const set  = text(row && row.Group);
            if (set !== '') kept.Group = set;
            const tint = colour(row && row.Colour);
            if (tint) kept.Colour = tint;
            if (row && row.Crossing === true) kept.Crossing = true;
            return kept;
        });
        const groups = (Array.isArray(data.Groups) ? data.Groups : []).slice(0, Na__LeParamArea__MAX_ROWS).map((row) => {
            const kept = { Name : text(row && row.Name), AreaM2 : number(row && row.AreaM2) };
            const tint = colour(row && row.Colour);
            if (tint) kept.Colour = tint;
            if (typeof row.Count === 'number' && Number.isFinite(row.Count)) kept.Count = Math.max(0, Math.round(row.Count));
            return kept;
        });
        return { Areas : areas, Groups : groups, TotalM2 : number(data.TotalM2) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    function Na__LeParamArea__Normalise(config, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamArea__Standard(config);
        const narrow   = Math.max(10, Na__LeParamArea__Number(config, 'WidthMinMm'));
        const wide     = Math.max(narrow, Na__LeParamArea__Number(config, 'WidthMaxMm'));
        const width    = (typeof given.WidthMm === 'number' && Number.isFinite(given.WidthMm)) ? given.WidthMm : standard.WidthMm;
        const size     = (typeof given.TextSizeMm === 'number' && Number.isFinite(given.TextSizeMm) && given.TextSizeMm > 0) ? given.TextSizeMm : standard.TextSizeMm;
        return {
            Form       : (Na__LeParamArea__FORMS.indexOf(given.Form) !== -1) ? given.Form : standard.Form,
            Group      : (typeof given.Group === 'string') ? given.Group.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
            ShowGroups : given.ShowGroups !== false,
            ShowTotal  : given.ShowTotal  !== false,
            ShowSwatch : given.ShowSwatch !== false,
            Units      : (Na__LeParamArea__UNITS.indexOf(given.Units) !== -1) ? given.Units : standard.Units,
            Decimals   : Math.max(0, Math.min(3, Math.round((typeof given.Decimals === 'number' && Number.isFinite(given.Decimals)) ? given.Decimals : standard.Decimals))),
            TitleText  : (typeof given.TitleText === 'string') ? given.TitleText.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
            WidthMm    : Math.round(Math.min(wide, Math.max(narrow, width)) * 10) / 10,
            TextSizeMm : Math.round(Math.min(12, Math.max(0.8, size)) * 100) / 100,
            Data       : Na__LeParamArea__NormaliseData(given.Data)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing the Numbers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Measured Area as the Table Writes It
    // ------------------------------------------------------------
    // The same reading the panel and the label use, restated here rather than
    // imported because this module imports nothing - and proved against the
    // feature's own formatter by the test, so the two cannot drift.
    // ------------------------------------------------------------
    function Na__LeParamArea__Figure(config, whole, valueM2) {
        const separator = Na__LeParamArea__Text(config, 'Separator');
        // ROUNDED HALF AWAY FROM ZERO, exactly as the floor area system's own
        // formatter does it, and for the same reason: 18.45 is held in binary
        // a hair BELOW itself, so toFixed(1) answers 18.4 and a table would
        // contradict the label written in the middle of the room it reports.
        // The two readings are proved against each other by the tests.
        const write     = (value, places) => {
            const room   = Math.max(0, Math.min(4, places));
            const factor = Math.pow(10, room);
            const lifted = (Number.isFinite(value) ? value : 0) * factor;
            const eased  = lifted >= 0 ? lifted + 1e-9 : lifted - 1e-9;
            const whole  = (eased >= 0 ? 1 : -1) * Math.round(Math.abs(eased));
            const parts  = (whole / factor).toFixed(room).split('.');
            if (separator) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
            return parts.join('.');
        };
        const metres = write(valueM2, whole.Decimals) + Na__LeParamArea__Text(config, 'SuffixM2');
        if (whole.Units === 'm2') return metres;
        const feet = write(valueM2 * Na__LeParamArea__SQ_FT, Na__LeParamArea__Number(config, 'FeetDecimals')) + Na__LeParamArea__Text(config, 'SuffixFt2');
        return whole.Units === 'ft2' ? feet : metres + ' (' + feet + ')';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rows the Table Shows, in the Order It Shows Them
    // ------------------------------------------------------------
    // Returns [{ kind : 'group' | 'area' | 'total' | 'empty', text, value,
    //            colour, indent }]. Everything about WHAT is listed is decided
    // here, and everything about where it is drawn below, so the two can be
    // read - and tested - apart.
    // ------------------------------------------------------------
    function Na__LeParamArea__Rows(config, whole) {
        const rows  = [];
        const data  = whole.Data;
        const key   = (name) => String(name || '').trim().toLowerCase();
        const wanted = key(whole.Group);

        if (whole.Form === Na__LeParamArea__FORM_GROUPS) {
            data.Groups.forEach((group) => {
                if (wanted !== '' && key(group.Name) !== wanted) return;
                rows.push({ kind : 'group', text : group.Name, value : group.AreaM2, colour : group.Colour || null, indent : false });
            });
            if (!rows.length) rows.push({ kind : 'empty', text : Na__LeParamArea__Text(config, 'EmptyLabel'), value : null, colour : null, indent : false });
            return rows;
        }

        // A ROOM PER ROW, under its group heading with that group's subtotal.
        // The order is the group list's, then the rooms in the order they were
        // drawn - which on a floor plan is the order somebody walked round it.
        const listed = data.Groups.filter((group) => wanted === '' || key(group.Name) === wanted);
        listed.forEach((group) => {
            const inside = data.Areas.filter((area) => key(area.Group) === key(group.Name));
            if (!inside.length) return;
            if (whole.ShowGroups) rows.push({ kind : 'group', text : group.Name, value : group.AreaM2, colour : group.Colour || null, indent : false });
            inside.forEach((area) => rows.push({ kind : 'area', text : area.Name, value : area.Crossing ? null : area.AreaM2, colour : area.Colour || null, indent : whole.ShowGroups }));
        });

        // THE UNGROUPED ROOMS come last and unheaded when they are all there
        // is, because a heading called Ungrouped over the only rooms on the
        // sheet says nothing anybody needs.
        if (wanted === '') {
            const loose = data.Areas.filter((area) => !area.Group);
            if (loose.length) {
                const headed = whole.ShowGroups && listed.some((group) => data.Areas.some((area) => key(area.Group) === key(group.Name)));
                if (headed) rows.push({ kind : 'group', text : Na__LeParamArea__Text(config, 'UngroupedLabel'), value : loose.reduce((sum, area) => sum + (area.Crossing ? 0 : area.AreaM2), 0), colour : null, indent : false });
                loose.forEach((area) => rows.push({ kind : 'area', text : area.Name, value : area.Crossing ? null : area.AreaM2, colour : area.Colour || null, indent : headed }));
            }
        }
        if (!rows.length) rows.push({ kind : 'empty', text : Na__LeParamArea__Text(config, 'EmptyLabel'), value : null, colour : null, indent : false });
        return rows;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Table Totals
    // ------------------------------------------------------------
    // The rows it is SHOWING, never the sheet's own total: a table filtered to
    // one floor that footed itself with the whole house would be a quiet lie
    // on a planning drawing.
    // ------------------------------------------------------------
    function Na__LeParamArea__Total(whole, rows) {
        const counted = whole.Form === Na__LeParamArea__FORM_GROUPS ? 'group' : 'area';
        return rows.filter((row) => row.kind === counted && Number.isFinite(row.value)).reduce((sum, row) => sum + row.value, 0);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Table
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Rule, a Filled Chip and a Line of Text as Records
    // ------------------------------------------------------------
    function Na__LeParamArea__Rule(x1, y1, x2, y2, colour, pt) {
        return { kind : 'shape', record : {
            Shape__Points       : [ [ x1, y1 ], [ x2, y2 ] ],
            Shape__Closed       : false,
            Shape__Stroked      : true,
            Shape__StrokeColour : colour,
            Shape__StrokePt     : pt,
            Shape__FillColour   : null
        } };
    }
    function Na__LeParamArea__Chip(x, y, sizeMm, colour) {
        return { kind : 'shape', record : {
            Shape__Points       : [ [ x, y ], [ x + sizeMm, y ], [ x + sizeMm, y + sizeMm ], [ x, y + sizeMm ] ],
            Shape__Closed       : true,
            Shape__Stroked      : false,
            Shape__StrokeColour : colour,
            Shape__StrokePt     : 0.2,
            Shape__FillColour   : colour
        } };
    }
    function Na__LeParamArea__Line(text, x, baselineY, sizeMm, weight, colour, align) {
        return { kind : 'annotation', record : {
            Annotation__Text       : text,
            Annotation__PosXMm     : x,
            Annotation__PosYMm     : baselineY,
            Annotation__SizeMm     : sizeMm,
            Annotation__FontWeight : weight,
            Annotation__Colour     : colour,
            Annotation__Align      : align || 'left'
        } };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Table: Parameters In, Records Out
    // ------------------------------------------------------------
    // { records : [{ kind, record }], sizeMm }, from an origin of (0, 0) at the
    // LEFT END OF THE TOP RULE. The title stands above it and the rows run
    // below, which is the Drawing Title's arrangement and puts the element's
    // anchor on a line that never moves when a room is added.
    //
    // EVERY SHAPE FIRST, THEN EVERY TEXT, each in a fixed order, so a rebuild
    // updates the records that are already there instead of deleting and
    // drawing again.
    // ------------------------------------------------------------
    function Na__LeParamArea__Build(config, params, tools) {
        const whole  = Na__LeParamArea__Normalise(config, params);
        const rows   = Na__LeParamArea__Rows(config, whole);
        const shapes = [];
        const texts  = [];

        const width     = whole.WidthMm;
        const bodyMm    = whole.TextSizeMm;
        const headMm    = bodyMm;
        const titleMm   = bodyMm * (Na__LeParamArea__Number(config, 'TitleSizeMm') / Na__LeParamArea__Number(config, 'TextSizeMm'));
        const rulePt    = Na__LeParamArea__Number(config, 'RulePt');
        const hairPt    = Na__LeParamArea__Number(config, 'HairlinePt');
        const ruleInk   = Na__LeParamArea__Text(config, 'RuleColour');
        const hairInk   = Na__LeParamArea__Text(config, 'HairlineColour');
        const ink       = Na__LeParamArea__Text(config, 'TextColour');
        const headInk   = Na__LeParamArea__Text(config, 'HeadColour');
        const mutedInk  = Na__LeParamArea__Text(config, 'MutedColour');
        const pitch     = Na__LeParamArea__Number(config, 'RowPitchMm') * (bodyMm / Na__LeParamArea__Number(config, 'TextSizeMm'));
        const baseline  = Na__LeParamArea__Number(config, 'RowBaselineMm') * (bodyMm / Na__LeParamArea__Number(config, 'TextSizeMm'));
        const swatchMm  = Na__LeParamArea__Number(config, 'SwatchSizeMm');
        const swatchGap = Na__LeParamArea__Number(config, 'SwatchGapMm');
        const indentMm  = Na__LeParamArea__Number(config, 'IndentMm');

        // THE TOP RULE IS THE FIRST VECTOR AND ITS FIRST POINT IS THE ORIGIN
        shapes.push(Na__LeParamArea__Rule(0, 0, width, 0, ruleInk, rulePt));

        // THE TITLE | Above the rule, as a drawing title sits above its own
        const title = whole.TitleText !== ''
            ? whole.TitleText
            : Na__LeParamArea__Text(config, whole.Form === Na__LeParamArea__FORM_GROUPS ? 'HeadingGroups' : 'HeadingAreas');
        if (title !== '') texts.push(Na__LeParamArea__Line(title, 0, -Na__LeParamArea__Number(config, 'TitleAboveRuleMm'), titleMm, Na__LeParamArea__Number(config, 'TitleWeight'), Na__LeParamArea__Text(config, 'TitleColour'), 'left'));

        // THE COLUMN HEADS | What the two columns are, and the hairline under them
        const headBaseline = Na__LeParamArea__Number(config, 'HeaderBaselineMm') * (bodyMm / Na__LeParamArea__Number(config, 'TextSizeMm'));
        const headRuleY    = Na__LeParamArea__Number(config, 'HeaderRuleMm') * (bodyMm / Na__LeParamArea__Number(config, 'TextSizeMm'));
        texts.push(Na__LeParamArea__Line(Na__LeParamArea__Text(config, whole.Form === Na__LeParamArea__FORM_GROUPS ? 'ColumnGroup' : 'ColumnRoom'), 0, headBaseline, headMm, Na__LeParamArea__Number(config, 'HeadWeight'), headInk, 'left'));
        texts.push(Na__LeParamArea__Line(Na__LeParamArea__Text(config, 'ColumnArea'), width, headBaseline, headMm, Na__LeParamArea__Number(config, 'HeadWeight'), headInk, 'right'));
        shapes.push(Na__LeParamArea__Rule(0, headRuleY, width, headRuleY, hairInk, hairPt));

        // THE ROWS
        // EVERY ROW IS A BAND OF ITS OWN, one pitch deep, with its baseline a
        // fixed distance down from the band's top; a group heading has the
        // group gap added ABOVE its band and nowhere else. Adding that gap to
        // both the band and the baseline - which the first version did - left
        // a heading sitting 1.6 mm low, hard against the first room under it,
        // while every other row was evenly spaced. It reads as a table that
        // cannot count, and only a rendered picture showed it.
        let y = headRuleY;
        rows.forEach((row) => {
            const heading = row.kind === 'group';
            const top     = y + (heading ? Na__LeParamArea__Number(config, 'GroupGapMm') : 0);
            const textY   = top + baseline;
            y = top + pitch;
            let x = row.indent ? indentMm : 0;
            if (whole.ShowSwatch && row.colour && row.kind !== 'empty') {
                shapes.push(Na__LeParamArea__Chip(x, textY - (swatchMm * 0.72), swatchMm, row.colour));
                x += swatchMm + swatchGap;
            }
            const weight = heading ? Na__LeParamArea__Number(config, 'HeadWeight') : Na__LeParamArea__Number(config, 'TextWeight');
            const colour = row.kind === 'empty' ? mutedInk : (heading ? headInk : ink);
            texts.push(Na__LeParamArea__Line(row.text, x, textY, bodyMm, weight, colour, 'left'));
            if (Number.isFinite(row.value)) texts.push(Na__LeParamArea__Line(Na__LeParamArea__Figure(config, whole, row.value), width, textY, bodyMm, weight, colour, 'right'));
            else if (row.kind === 'area') texts.push(Na__LeParamArea__Line(Na__LeParamArea__Text(config, 'CrossedLabel'), width, textY, bodyMm, weight, mutedInk, 'right'));
        });

        // THE TOTAL | A rule, then the figure the table is quoted by
        let heightMm = y;
        if (whole.ShowTotal) {
            const ruleY  = y + Na__LeParamArea__Number(config, 'TotalGapMm');
            const totalY = ruleY + baseline + (pitch - baseline) * 0.25;
            shapes.push(Na__LeParamArea__Rule(0, ruleY, width, ruleY, ruleInk, rulePt));
            texts.push(Na__LeParamArea__Line(Na__LeParamArea__Text(config, 'TotalLabel'), 0, totalY, bodyMm, Na__LeParamArea__Number(config, 'HeadWeight'), headInk, 'left'));
            texts.push(Na__LeParamArea__Line(Na__LeParamArea__Figure(config, whole, Na__LeParamArea__Total(whole, rows)), width, totalY, bodyMm, Na__LeParamArea__Number(config, 'HeadWeight'), headInk, 'right'));
            heightMm = totalY;
        }

        return {
            records : shapes.concat(texts),
            sizeMm  : { WidthMm : width, HeightMm : heightMm },
            rows    : rows.length,                                               // <-- What the panel and the tests read back
            tools   : !!tools                                                    // <-- Named so the signature is honest: this type needs no measuring
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grips and the Menu
// -----------------------------------------------------------------------------

    // FUNCTION | Where the Table's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // The STRETCH arrow at the right end of the top rule sets how wide the
    // table is set - which is what lines its figures up with a title block or
    // a margin. The LOOKUP triangle at the left end carries everything else.
    // There is no link socket: a schedule reads the sheet's rooms, not a
    // drawing, so a cable from it to the nearest elevation would say something
    // untrue about what it is.
    // ------------------------------------------------------------
    function Na__LeParamArea__Handles(config, params) {
        const whole = Na__LeParamArea__Normalise(config, params);
        return {
            stretch : { x : whole.WidthMm, y : 0, away : [ 1, 0 ] },
            lookup  : { x : 0, y : 0, away : [ -Math.SQRT1_2, -Math.SQRT1_2 ] },
            slide   : null,
            link    : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Stretch Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    function Na__LeParamArea__StretchTo(config, params, xMm) {
        const whole = Na__LeParamArea__Normalise(config, params);
        if (!Number.isFinite(xMm)) return whole;
        const step = Math.max(0.1, Na__LeParamArea__Number(config, 'WidthStepMm'));
        return Na__LeParamArea__Normalise(config, Object.assign({}, whole, { WidthMm : Math.round(xMm / step) * step }));
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Lookup Grip's Menu Offers
    // ------------------------------------------------------------
    // The two forms, then the groups it can be filtered to, then the switches.
    // Each entry is a patch the engine merges as one undo step - the same
    // rebuild the panel's controls make, so grip and panel cannot disagree.
    // ------------------------------------------------------------
    function Na__LeParamArea__Choices(config, params, words) {
        const whole = Na__LeParamArea__Normalise(config, params);
        const said  = (words && typeof words === 'object') ? words : {};
        const items = [
            { label : said.formAreas  || 'Every area, by group', checked : whole.Form === Na__LeParamArea__FORM_AREAS,  patch : { Form : Na__LeParamArea__FORM_AREAS } },
            { label : said.formGroups || 'Totals by group',      checked : whole.Form === Na__LeParamArea__FORM_GROUPS, patch : { Form : Na__LeParamArea__FORM_GROUPS } }
        ];

        const groups = whole.Data.Groups.filter((group) => group.Name !== '');
        if (groups.length) {
            items.push({ separator : true });
            items.push({ label : said.allGroups || 'Every group', checked : whole.Group === '', patch : { Group : '' } });
            groups.forEach((group) => {
                items.push({ label : (said.onlyGroup || 'Only {group}').split('{group}').join(group.Name),
                             checked : whole.Group.toLowerCase() === group.Name.toLowerCase(),
                             patch : { Group : group.Name } });
            });
        }

        items.push({ separator : true });
        if (whole.Form === Na__LeParamArea__FORM_AREAS) items.push({ label : said.groupHeadings || 'Group headings and subtotals', checked : whole.ShowGroups, patch : { ShowGroups : !whole.ShowGroups } });
        items.push({ label : said.total   || 'Total row',     checked : whole.ShowTotal,  patch : { ShowTotal  : !whole.ShowTotal } });
        items.push({ label : said.swatch  || 'Colour chips',  checked : whole.ShowSwatch, patch : { ShowSwatch : !whole.ShowSwatch } });
        items.push({ separator : true });
        items.push({ label : said.unitsM2   || 'Square metres',            checked : whole.Units === 'm2',   patch : { Units : 'm2' } });
        items.push({ label : said.unitsFt2  || 'Square feet',              checked : whole.Units === 'ft2',  patch : { Units : 'ft2' } });
        items.push({ label : said.unitsBoth || 'Both, feet in brackets',   checked : whole.Units === 'both', patch : { Units : 'both' } });
        return items;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Area Schedule's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's AreaSchedule block and getMenuWords()
    // the menu's wording, each read fresh on every call. linkable is false:
    // this table reads the sheet's rooms, not a viewport.
    // ------------------------------------------------------------
    function Na__LeParamArea__CreateType(getConfig, getMenuWords) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        const words  = () => ((typeof getMenuWords === 'function' ? getMenuWords() : null) || null);
        return {
            type      : Na__LeParamArea__TYPE,
            keep      : Na__LeParamArea__KEEP.slice(),
            linkable  : false,
            facts     : [ 'Data' ],                                              // <-- What the floor area system fills in, as a viewport fills a drawing title's
            defaults  : ()              => Na__LeParamArea__Standard(config()),
            normalise : (params)        => Na__LeParamArea__Normalise(config(), params),
            build     : (params, tools) => Na__LeParamArea__Build(config(), params, tools),
            handles   : (params)        => Na__LeParamArea__Handles(config(), params),
            stretchTo : (params, xMm)   => Na__LeParamArea__StretchTo(config(), params, xMm),
            choices   : (params)        => Na__LeParamArea__Choices(config(), params, words()),
            hasBar    : ()              => false,
            rowsOf    : (params)        => Na__LeParamArea__Rows(config(), Na__LeParamArea__Normalise(config(), params)),
            figure    : (params, m2)    => Na__LeParamArea__Figure(config(), Na__LeParamArea__Normalise(config(), params), m2)   // <-- So the panel quotes a total in the table's OWN units and decimals, not in a second reading of them
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Area Schedule API
    // ------------------------------------------------------------
    export {
        Na__LeParamArea__TYPE,
        Na__LeParamArea__FORM_AREAS,
        Na__LeParamArea__FORM_GROUPS,
        Na__LeParamArea__FORMS,
        Na__LeParamArea__Standard,
        Na__LeParamArea__Normalise,
        Na__LeParamArea__NormaliseData,
        Na__LeParamArea__Rows,
        Na__LeParamArea__Total,
        Na__LeParamArea__Figure,
        Na__LeParamArea__Build,
        Na__LeParamArea__Handles,
        Na__LeParamArea__StretchTo,
        Na__LeParamArea__Choices,
        Na__LeParamArea__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
