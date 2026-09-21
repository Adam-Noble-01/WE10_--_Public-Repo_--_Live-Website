// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - CABINET INFILL
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__CabinetInfill__.js
// NAMESPACE  : Na__LeParamInfill
// MODULE     : Layout Editor - Parametric Scrapbook - Cabinet Infill
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The dashed cross and boxed label that say what a cupboard on a plan is - Storage, Services, Wardrobes - drawn to fit the cabinet it is dragged over
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE HOUSE INFILL, MEASURED, NOT DESIGNED. Adam draws it by hand in LayOut
//   on every plan: a cross corner to corner of the cupboard and its name in a
//   small box over the middle. Measured from the vector PDF of NP03 D07 Rev C
//   (First Floor Plans) and the LayOut Core Scrapbook it was drawn from:
//     the cross   two corner-to-corner lines, #333333, 0.15 pt, dashed
//                 0.9 pt on 0.9 pt (0.32 mm on 0.32 mm)
//     the words   Open Sans Regular 6 pt (2.1167 mm), #333333, centred
//     their box   #fcfcfc under the same dashed rule; 2 pt clear of the words
//                 at each end, 1.4334 em deep, the baseline 0.4044 em below
//                 its middle - LayOut's own text box, hugging its words
//     upright     an infill taller than it is wide reads UP the sheet, as
//                 every one of his does
//   The thin dashed dark grey is what reads as a light mid-grey dotted line on
//   the paper and on the screen; a paler colour at that weight disappears.
// - THE FILL UNDERNEATH IS OFF UNTIL IT IS WANTED. Off, the cross and its
//   label are all there is, and whatever the model draws inside the cabinet -
//   doors, shelves, a hanging rail - shows through. On, a white rectangle
//   under everything blanks it out. It is an ordinary vector: open the group
//   and give it any colour, and the element keeps that colour from then on.
// - WHAT IS RESTYLED BY HAND IS KEPT (adopt). The geometry is always this
//   type's - every rebuild puts the cross back corner to corner and the label
//   back in the middle - but a colour, weight or dash given to a member inside
//   the group, and words typed over the label, are read back as parameters
//   whenever the element's parameters are asked for, so fitting the corner
//   afterwards does not undo them. A style that matches the house one is not
//   stored at all, so the block stays a handful of keys long and follows the
//   config for everything nobody has changed.
// - THE WORDS FIT THE CABINET. They run along its longer side, and words too
//   long for it break over two or three lines at their spaces, as evenly as
//   they will - "Pantry / Unit" in a 600 mm square unit at 1:50 - rather than
//   hanging out over the drawing. Measured through the editor's own text
//   measure (tools), and refit once the paper's real metrics have landed.
// - HELD BY ITS BOTTOM LEFT CORNER, FITTED BY ANY OTHER. Like a CAD block,
//   the infill has a base point - its bottom left corner, x along and y up -
//   and that is the point the tile hangs from while it is dragged in, the
//   point that lands where the drop snaps, and a grip that moves it. The
//   other three corners are grips too, and each moves ITS corner while the
//   corner opposite stays where it is, so a cupboard is fitted from whichever
//   side is easiest: drop the base on one corner, drag the far corner onto
//   the other. All of them snap to the drawing's corners (the grips module).
//   Inside, the origin the engine builds from is still the TOP left corner -
//   paper y runs down - and the base point is (0, height) from it.
// - THE OPTIONS ARROW SITS BESIDE THE WORDS, just off the right of the
//   label's box, where the eye already is - not on a corner of the cabinet,
//   where it lay on the drawing's own linework and was hard to find.
// - PAPER MILLIMETRES, AND NEVER TIED TO A DRAWING. An infill is drawn over a
//   drawing the way a dimension or a hand-drawn line is; nothing about it
//   follows a scale, so it is linkable : false and has no ScaleDenominator. A
//   tile dropped on a drawing is SIZED at that drawing's scale by the panel
//   (Element__RealSizeMm), and that is all the scale ever does to it.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__Panel__ScrapbookParametric__ with a reader
//   for the config's CabinetInfill block and one for its menu words.
// - PURE: no DOM, no editor modules, no imports at all. Parameters in, records
//   out, in paper millimetres from an origin of (0, 0) at the infill's top
//   left corner. Whatever it cannot reach arrives in `tools`: measureTextMm
//   and lineSpacing (the Text setup's, so a broken label is spaced exactly as
//   the editor draws its lines).
// - adopt, base and cornerTo are read by Na__LayoutEditor__ScrapbookParametric__
//   and Na__LayoutEditor__ScrapbookParametric__Grips__; base also by the panel,
//   which hands the tile drag the point to hang the ghost from.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported. It needs the engine's adopt hook and the
//                   grips module's corner snap with it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - After Adam used it: the one corner grip, stood where the drop had put
//   the origin's opposite corner, made the block "impossible to use". Now a
//   base point at the bottom left (base) that the drop and a move grip use,
//   and three corner grips (cornerTo: tl, tr, br), each holding the corner
//   opposite it. The options triangle stands beside the label's box. The
//   single stretch corner (stretchTo, stretchCorner) is gone.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the cross, the boxed label with its six words
//   and words of one's own, the fill underneath, the three ways the words can
//   run, the balanced break, the corner grip, the lookup menu, adopt and refit.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, the Ways the Words Run, and the Limits
    // ------------------------------------------------------------
    const Na__LeParamInfill__TYPE            = 'CabinetInfill';
    const Na__LeParamInfill__RUN_AUTO        = 'auto';
    const Na__LeParamInfill__RUN_ACROSS      = 'horizontal';
    const Na__LeParamInfill__RUN_UP          = 'vertical';
    const Na__LeParamInfill__RUNS            = Object.freeze([ Na__LeParamInfill__RUN_AUTO, Na__LeParamInfill__RUN_ACROSS, Na__LeParamInfill__RUN_UP ]);
    const Na__LeParamInfill__UP_DEG          = -90;                           // <-- Annotation__RotationDeg is clockwise: a quarter turn back reads from the foot of the sheet up
    const Na__LeParamInfill__MAX_WORDS       = 80;
    const Na__LeParamInfill__FIT_SLACK_MM    = 0.05;                          // <-- A label box within this of what a build would draw fits
    const Na__LeParamInfill__COVER_SLACK_MM  = 0.01;                          // <-- How close a rectangle must lie to the infill's own edges to be taken for its fill
    const Na__LeParamInfill__DASH_KINDS      = Object.freeze([ 'dashed', 'dotted', 'centre', 'hidden' ]);
    const Na__LeParamInfill__KEEP            = Object.freeze([ 'WidthMm', 'HeightMm', 'Label', 'LabelText', 'Orientation', 'TextSizeMm', 'Fill',
                                                                'FillColour', 'FillOpacity', 'LineColour', 'LinePt', 'LineDash',
                                                                'BoxFill', 'BoxLineColour', 'BoxLinePt', 'BoxDash', 'BoxStroked', 'TextColour', 'TextWeight' ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Every Value Falls Back To
    // ------------------------------------------------------------
    // Mirrors the shipped config block, so a config that could not be read
    // draws the house infill rather than nothing.
    // ------------------------------------------------------------
    const Na__LeParamInfill__FALLBACK = Object.freeze({
        WidthMm                : 36,
        HeightMm               : 12,
        SizeMinMm              : 2,
        SizeMaxMm              : 800,
        SizeStepMm             : 0.1,
        Label                  : 'Storage',
        Labels                 : [ 'Storage', 'Services', 'Full Height Storage', 'Wardrobes', 'Pantry Unit', 'Shelving' ],
        TextSizeMm             : 2.1167,
        TextSizeMinMm          : 0.8,
        TextSizeMaxMm          : 12,
        TextWeight             : 400,
        TextColour             : '#333333',
        LineColour             : '#333333',
        LinePt                 : 0.15,
        DashMm                 : 0.32,
        GapMm                  : 0.32,
        BoxFillColour          : '#fcfcfc',
        BoxLineColour          : '#333333',
        BoxLinePt              : 0.15,
        BoxPadEm               : 0.3333,
        BoxHeightEm            : 1.4334,
        BaselineBelowCentreEm  : 0.4044,
        LabelClearMm           : 1,
        MaxLines               : 3,
        LineSpacing            : 1.2,
        FillColour             : '#ffffff'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Value of the CabinetInfill Block, or Its Fallback
    // ------------------------------------------------------------
    function Na__LeParamInfill__Number(config, key) {
        const value = config ? config['CabinetInfill__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamInfill__FALLBACK[key];
    }
    function Na__LeParamInfill__Text(config, key) {
        const value = config ? config['CabinetInfill__' + key] : undefined;
        return (typeof value === 'string' && value !== '') ? value : Na__LeParamInfill__FALLBACK[key];
    }
    function Na__LeParamInfill__List(config, key) {
        const value = config ? config['CabinetInfill__' + key] : undefined;
        return Array.isArray(value) ? value.slice() : Na__LeParamInfill__FALLBACK[key].slice();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Words Made Tidy: One Space Between Them, None Round Them, Not Too Many
    // ------------------------------------------------------------
    function Na__LeParamInfill__Words(value) {
        return (typeof value === 'string') ? value.replace(/\s+/g, ' ').trim().slice(0, Na__LeParamInfill__MAX_WORDS) : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Words the Lookup Grip and the Panel Offer
    // ------------------------------------------------------------
    // The config's list, in its order, tidied and without repeats. A config
    // that lists nothing usable offers the one standard word.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Presets(config) {
        const seen = [];
        Na__LeParamInfill__List(config, 'Labels').forEach((value) => {
            const words = Na__LeParamInfill__Words(value);
            if (words !== '' && seen.indexOf(words) === -1) seen.push(words);
        });
        return seen.length ? seen : [ Na__LeParamInfill__Words(Na__LeParamInfill__Text(config, 'Label')) || Na__LeParamInfill__FALLBACK.Label ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Styles
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Colour Worth Keeping, Written the One Way (null for anything else)
    // ------------------------------------------------------------
    function Na__LeParamInfill__Colour(value) {
        return (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())) ? value.trim().toLowerCase() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Weight or Size Worth Keeping (null for anything else)
    // ------------------------------------------------------------
    function Na__LeParamInfill__Positive(value) {
        return (typeof value === 'number' && Number.isFinite(value) && value > 0) ? Math.round(value * 10000) / 10000 : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Line Style Made Whole Enough to Draw With (null is a solid line)
    // ------------------------------------------------------------
    // The record's own shape - LineStyle__Kind, Scale, DashMm, GapMm, MarkMm -
    // held to two decimals. The record layer's normaliser has the last word on
    // bounds when the shape is written; this only keeps nonsense out of the
    // parameters. undefined for something that is neither a style nor null.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Dash(value) {
        if (value === null) return null;
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const mm = (raw, fallback) => (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) ? Math.round(raw * 100) / 100 : fallback;
        return {
            LineStyle__Kind   : (Na__LeParamInfill__DASH_KINDS.indexOf(value.LineStyle__Kind) !== -1) ? value.LineStyle__Kind : 'dashed',
            LineStyle__Scale  : (typeof value.LineStyle__Scale === 'number' && Number.isFinite(value.LineStyle__Scale) && value.LineStyle__Scale > 0) ? Math.round(value.LineStyle__Scale * 100) / 100 : 1,
            LineStyle__DashMm : mm(value.LineStyle__DashMm, Na__LeParamInfill__FALLBACK.DashMm),
            LineStyle__GapMm  : mm(value.LineStyle__GapMm,  Na__LeParamInfill__FALLBACK.GapMm),
            LineStyle__MarkMm : mm(value.LineStyle__MarkMm, 0)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Makes Two Line Styles the Same Line
    // ------------------------------------------------------------
    // The kind, the scale and the sections that kind draws. A mark length is
    // only part of a dash-dot, so a dashed line the record layer has filled
    // in with its smallest mark still reads as the house dash.
    // ------------------------------------------------------------
    function Na__LeParamInfill__DashKey(value) {
        const dash = Na__LeParamInfill__Dash(value);
        if (dash === null) return 'solid';
        if (!dash) return '';
        const parts = [ dash.LineStyle__Kind, dash.LineStyle__Scale, dash.LineStyle__DashMm, dash.LineStyle__GapMm ];
        if (dash.LineStyle__Kind === 'centre') parts.push(dash.LineStyle__MarkMm);
        return parts.join('|');
    }
    // ------------------------------------------------------------


    // FUNCTION | The House Style, From the Config
    // ------------------------------------------------------------
    // What every part is drawn in when nobody has said otherwise. The fill's
    // colour is here too, although the fill is off until it is switched on.
    // ------------------------------------------------------------
    function Na__LeParamInfill__House(config) {
        const dash = () => ({
            LineStyle__Kind   : 'dashed',
            LineStyle__Scale  : 1,
            LineStyle__DashMm : Na__LeParamInfill__Number(config, 'DashMm'),
            LineStyle__GapMm  : Na__LeParamInfill__Number(config, 'GapMm'),
            LineStyle__MarkMm : 0
        });
        return {
            fillColour    : Na__LeParamInfill__Colour(Na__LeParamInfill__Text(config, 'FillColour')) || Na__LeParamInfill__FALLBACK.FillColour,
            fillOpacity   : 1,
            lineColour    : Na__LeParamInfill__Colour(Na__LeParamInfill__Text(config, 'LineColour')) || Na__LeParamInfill__FALLBACK.LineColour,
            linePt        : Na__LeParamInfill__Number(config, 'LinePt'),
            lineDash      : dash(),
            boxFill       : Na__LeParamInfill__Colour(Na__LeParamInfill__Text(config, 'BoxFillColour')) || Na__LeParamInfill__FALLBACK.BoxFillColour,
            boxLineColour : Na__LeParamInfill__Colour(Na__LeParamInfill__Text(config, 'BoxLineColour')) || Na__LeParamInfill__FALLBACK.BoxLineColour,
            boxLinePt     : Na__LeParamInfill__Number(config, 'BoxLinePt'),
            boxDash       : dash(),
            boxStroked    : true,
            textColour    : Na__LeParamInfill__Colour(Na__LeParamInfill__Text(config, 'TextColour')) || Na__LeParamInfill__FALLBACK.TextColour,
            textWeight    : Na__LeParamInfill__Number(config, 'TextWeight')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Style Parameters, Each Paired With the House Value It Stands In For
    // ------------------------------------------------------------
    // One table for the three things that must agree about them: Normalise,
    // which drops a value that IS the house one; Style, which lays the rest
    // over the house style; and Adopt, which reads them back off the members.
    // same says when two values are the same choice.
    // ------------------------------------------------------------
    function Na__LeParamInfill__StyleKeys(house) {
        const colour = (a, b) => Na__LeParamInfill__Colour(a) === Na__LeParamInfill__Colour(b);
        const number = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6;
        const dash   = (a, b) => Na__LeParamInfill__DashKey(a) === Na__LeParamInfill__DashKey(b);
        const fill   = (a, b) => (a === null && b === null) || colour(a, b);
        return [
            { key : 'FillColour',    house : house.fillColour,    clean : Na__LeParamInfill__Colour,                                        same : colour },
            { key : 'FillOpacity',   house : house.fillOpacity,   clean : (v) => (typeof v === 'number' && v >= 0 && v <= 1) ? Math.round(v * 1000) / 1000 : null, same : number },
            { key : 'LineColour',    house : house.lineColour,    clean : Na__LeParamInfill__Colour,                                        same : colour },
            { key : 'LinePt',        house : house.linePt,        clean : Na__LeParamInfill__Positive,                                      same : number },
            { key : 'LineDash',      house : house.lineDash,      clean : Na__LeParamInfill__Dash,                                          same : dash,   nullable : true },
            { key : 'BoxFill',       house : house.boxFill,       clean : (v) => (v === null ? null : Na__LeParamInfill__Colour(v)),        same : fill,   nullable : true },
            { key : 'BoxLineColour', house : house.boxLineColour, clean : Na__LeParamInfill__Colour,                                        same : colour },
            { key : 'BoxLinePt',     house : house.boxLinePt,     clean : Na__LeParamInfill__Positive,                                      same : number },
            { key : 'BoxDash',       house : house.boxDash,       clean : Na__LeParamInfill__Dash,                                          same : dash,   nullable : true },
            { key : 'BoxStroked',    house : house.boxStroked,    clean : (v) => (typeof v === 'boolean' ? v : null),                       same : (a, b) => a === b },
            { key : 'TextColour',    house : house.textColour,    clean : Na__LeParamInfill__Colour,                                        same : colour },
            { key : 'TextWeight',    house : house.textWeight,    clean : Na__LeParamInfill__Positive,                                      same : number }
        ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parameters
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Infill
    // ------------------------------------------------------------
    // No scale anywhere in it: an infill is drawn over a drawing in paper
    // millimetres, and a change of scale has nothing to put back.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Standard(config) {
        return {
            WidthMm     : Na__LeParamInfill__Number(config, 'WidthMm'),
            HeightMm    : Na__LeParamInfill__Number(config, 'HeightMm'),
            Label       : Na__LeParamInfill__Words(Na__LeParamInfill__Text(config, 'Label')) || Na__LeParamInfill__Presets(config)[0],
            LabelText   : '',
            Orientation : Na__LeParamInfill__RUN_AUTO,
            TextSizeMm  : Na__LeParamInfill__Number(config, 'TextSizeMm'),
            Fill        : false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    // The size is kept to four decimals - what the engine rounds a built
    // coordinate to - so a corner snapped to a drawing's vertex is kept where
    // it was snapped and a rebuild writes what the last one wrote. The text
    // size keeps four as well: 6 pt is 2.1167 mm, and at three the box round
    // Storage comes out 2 microns long of NP03's. A style
    // parameter is kept only while it differs from the house style: one that
    // is set back to the house value drops out, and the element follows the
    // config again for that part.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Normalise(config, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamInfill__Standard(config);
        const least    = Math.max(0.5, Na__LeParamInfill__Number(config, 'SizeMinMm'));
        const most     = Math.max(least, Na__LeParamInfill__Number(config, 'SizeMaxMm'));
        const small    = Math.max(0.2, Na__LeParamInfill__Number(config, 'TextSizeMinMm'));
        const large    = Math.max(small, Na__LeParamInfill__Number(config, 'TextSizeMaxMm'));
        const size     = (value, fallback, low, high, places) => {
            const raw = (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
            const k   = Math.pow(10, places);
            return Math.round(Math.min(high, Math.max(low, raw)) * k) / k;
        };
        const whole = {
            WidthMm     : size(given.WidthMm,  standard.WidthMm,  least, most, 4),
            HeightMm    : size(given.HeightMm, standard.HeightMm, least, most, 4),
            Label       : Na__LeParamInfill__Words(given.Label) || standard.Label,
            LabelText   : Na__LeParamInfill__Words(given.LabelText),
            Orientation : (Na__LeParamInfill__RUNS.indexOf(given.Orientation) !== -1) ? given.Orientation : standard.Orientation,
            TextSizeMm  : size(given.TextSizeMm, standard.TextSizeMm, small, large, 4),
            Fill        : given.Fill === true
        };
        Na__LeParamInfill__StyleKeys(Na__LeParamInfill__House(config)).forEach((entry) => {
            if (!Object.prototype.hasOwnProperty.call(given, entry.key) || given[entry.key] === undefined) return;
            const value = entry.clean(given[entry.key]);
            if (value === undefined || (value === null && entry.nullable !== true)) return;
            if (entry.same(value, entry.house)) return;                       // <-- The house value is no decision: it is not stored
            whole[entry.key] = value;
        });
        return whole;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Style an Infill Is Drawn In: the House Style With Its Own Choices Laid Over
    // ------------------------------------------------------------
    // { fillColour, fillOpacity, lineColour, linePt, lineDash, boxFill,
    //   boxLineColour, boxLinePt, boxDash, boxStroked, textColour, textWeight }.
    // A null lineDash is a solid line and a null boxFill is a box with no fill:
    // both are real choices somebody made inside the group.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Style(config, params) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        const house = Na__LeParamInfill__House(config);
        const pick  = (key, fallback) => (Object.prototype.hasOwnProperty.call(whole, key) ? whole[key] : fallback);
        return {
            fillColour    : pick('FillColour',    house.fillColour),
            fillOpacity   : pick('FillOpacity',   house.fillOpacity),
            lineColour    : pick('LineColour',    house.lineColour),
            linePt        : pick('LinePt',        house.linePt),
            lineDash      : pick('LineDash',      house.lineDash),
            boxFill       : pick('BoxFill',       house.boxFill),
            boxLineColour : pick('BoxLineColour', house.boxLineColour),
            boxLinePt     : pick('BoxLinePt',     house.boxLinePt),
            boxDash       : pick('BoxDash',       house.boxDash),
            boxStroked    : pick('BoxStroked',    house.boxStroked),
            textColour    : pick('TextColour',    house.textColour),
            textWeight    : pick('TextWeight',    house.textWeight)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Label Says: { text, typed }
    // ------------------------------------------------------------
    // Words typed into the panel - or over the label inside the group - win,
    // and stop the list setting it, the way a drawing title's typed text
    // does; clearing them puts the listed word back.
    // ------------------------------------------------------------
    function Na__LeParamInfill__LabelOf(config, params) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        if (whole.LabelText !== '') return { text : whole.LabelText, typed : true };
        return { text : whole.Label, typed : false };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Setting the Label
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Wide a Run of Words Is on the Paper
    // ------------------------------------------------------------
    // Through the measurer the engine hands over - the editor's own, so the
    // box hugs the words on the screen and on paper alike. With none, an
    // estimate at the same 0.52 of the font size the chrome falls back to,
    // which is what keeps this module drawing under Node.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Measure(text, sizeMm, weight, tools) {
        const value = String(text === undefined || text === null ? '' : text);
        if (value === '') return 0;
        if (tools && typeof tools.measureTextMm === 'function') {
            try {
                const width = Number(tools.measureTextMm(value, sizeMm, weight));
                if (Number.isFinite(width) && width >= 0) return width;
            } catch (error) { /* fall through to the estimate */ }
        }
        return value.length * sizeMm * 0.52;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Line Height of a Broken Label, as a Multiple of Its Size
    // ------------------------------------------------------------
    // The editor's Text setup, through the tools, because the label is one
    // text record and the editor draws its lines that far apart - a box built
    // to any other figure would not fit what is drawn in it.
    // ------------------------------------------------------------
    function Na__LeParamInfill__LineSpacing(config, tools) {
        if (tools && typeof tools.lineSpacing === 'function') {
            try {
                const value = Number(tools.lineSpacing());
                if (Number.isFinite(value) && value >= 1) return value;
            } catch (error) { /* fall through to the config */ }
        }
        return Math.max(1, Na__LeParamInfill__Number(config, 'LineSpacing'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Break Words Over Lines So the Widest Is as Narrow as It Can Be
    // ------------------------------------------------------------
    // One line when it fits. Otherwise the fewest lines, up to maxLines, whose
    // widest line fits; each count is tried every way the words can be split
    // in order, and the split with the narrowest widest line wins - so
    // "Full Height Storage" breaks "Full Height / Storage", never "Full /
    // Height Storage". When nothing fits, the narrowest split there is: it
    // overflows by the least. A single word is never cut.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Break(text, sizeMm, weight, maxWidthMm, maxLines, tools) {
        const measure = (line) => Na__LeParamInfill__Measure(line, sizeMm, weight, tools);
        if (measure(text) <= maxWidthMm) return [ text ];
        const words = text.split(' ').filter((word) => word !== '');
        const most  = Math.min(Math.max(1, Math.floor(maxLines)), words.length);
        let   best  = [ text ];
        let   bestW = measure(text);
        for (let count = 2; count <= most; count++) {
            let found = null, foundW = Infinity;
            const walk = (from, left, lines) => {                              // <-- Every way to put the remaining words on the remaining lines, in order
                if (left === 1) {
                    const all   = lines.concat([ words.slice(from).join(' ') ]);
                    const width = Math.max.apply(null, all.map(measure));
                    if (width < foundW - 1e-9) { found = all; foundW = width; }
                    return;
                }
                for (let end = from + 1; end <= words.length - (left - 1); end++) walk(end, left - 1, lines.concat([ words.slice(from, end).join(' ') ]));
            };
            walk(0, count, []);
            if (found && foundW < bestW - 1e-9) { best = found; bestW = foundW; }
            if (found && foundW <= maxWidthMm) return found;
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Label Goes: Its Lines, Its Box, Its Anchor and Its Turn
    // ------------------------------------------------------------
    // { lines, vertical, box : { x, y, w, h }, lengthMm, anchor : { x, y },
    //   rotationDeg }, from the infill's origin. The words run along the
    // longer side unless told otherwise, with LabelClearMm of the cabinet
    // left at each end before they break.
    //
    // THE BOX IS LAYOUT'S TEXT BOX, HUGGING ITS WORDS: BoxPadEm clear of the
    // widest line at each end, BoxHeightEm deep for one line and one line
    // height deeper for each line after, centred on the cabinet. The anchor is
    // the first line's baseline at its middle - the point a centred text
    // record names - BaselineBelowCentreEm below the middle of a one-line box,
    // measured in the words' own frame, which on an upright infill is to the
    // RIGHT on the paper: the words read up the sheet and their feet face
    // right.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Layout(config, params, tools) {
        const whole    = Na__LeParamInfill__Normalise(config, params);
        const style    = Na__LeParamInfill__Style(config, whole);
        const text     = Na__LeParamInfill__LabelOf(config, whole).text;
        const sizeMm   = whole.TextSizeMm;
        const vertical = whole.Orientation === Na__LeParamInfill__RUN_UP || (whole.Orientation === Na__LeParamInfill__RUN_AUTO && whole.HeightMm > whole.WidthMm);
        const alongMm  = vertical ? whole.HeightMm : whole.WidthMm;
        const padMm    = Math.max(0, Na__LeParamInfill__Number(config, 'BoxPadEm')) * sizeMm;
        const oneMm    = Math.max(0, Na__LeParamInfill__Number(config, 'BoxHeightEm')) * sizeMm;
        const lineMm   = Na__LeParamInfill__LineSpacing(config, tools) * sizeMm;
        const roomMm   = alongMm - (2 * Math.max(0, Na__LeParamInfill__Number(config, 'LabelClearMm'))) - (2 * padMm);
        const lines    = Na__LeParamInfill__Break(text, sizeMm, style.textWeight, roomMm, Na__LeParamInfill__Number(config, 'MaxLines'), tools);
        const widest   = Math.max.apply(null, lines.map((line) => Na__LeParamInfill__Measure(line, sizeMm, style.textWeight, tools)));
        const lengthMm = widest + (2 * padMm);
        const deepMm   = oneMm + ((lines.length - 1) * lineMm);
        const cx       = whole.WidthMm / 2;
        const cy       = whole.HeightMm / 2;
        const firstMm  = -(deepMm / 2) + (oneMm / 2) + (Math.max(0, Na__LeParamInfill__Number(config, 'BaselineBelowCentreEm')) * sizeMm);   // <-- The first baseline, down the words' own frame from the box's middle
        return {
            lines       : lines,
            vertical    : vertical,
            lengthMm    : lengthMm,
            box         : vertical ? { x : cx - (deepMm / 2), y : cy - (lengthMm / 2), w : deepMm, h : lengthMm }
                                   : { x : cx - (lengthMm / 2), y : cy - (deepMm / 2), w : lengthMm, h : deepMm },
            anchor      : vertical ? { x : cx + firstMm, y : cy } : { x : cx, y : cy + firstMm },
            rotationDeg : vertical ? Na__LeParamInfill__UP_DEG : 0
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Infill
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Rectangle as a Closed Run of Four Points, From Its Top Left Corner
    // ------------------------------------------------------------
    function Na__LeParamInfill__Rect(x, y, widthMm, heightMm) {
        return [ [ x, y ], [ x + widthMm, y ], [ x + widthMm, y + heightMm ], [ x, y + heightMm ] ];
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Infill: Parameters In, Records Out
    // ------------------------------------------------------------
    // { records : [{ kind : 'shape' | 'annotation', record }], sizeMm }, from
    // an origin of (0, 0) at the infill's top left corner.
    //
    // THE ORDER IS THE DRAWING ORDER, AND THE ORIGIN IS ALWAYS FIRST. The fill,
    // when it is on, is vector one - painted first, so under the rest - and its
    // first point is (0, 0). With it off, vector one is the cross's first line,
    // which starts at (0, 0) too. Then the other line, then the label's box
    // over the middle of the cross, then the words, which the editor keeps on
    // its text layer, in front of its vectors. Switching the fill on moves
    // every vector up one slot and adds one at the end, and because a slot
    // keeps its record's place in the sheet, the order on the paper is still
    // fill, cross, box.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Build(config, params, tools) {
        const whole  = Na__LeParamInfill__Normalise(config, params);
        const style  = Na__LeParamInfill__Style(config, whole);
        const layout = Na__LeParamInfill__Layout(config, whole, tools);
        const W      = whole.WidthMm;
        const H      = whole.HeightMm;
        const shapes = [];

        // THE FILL UNDERNEATH | Only when it is switched on: off, there is no
        // record at all, and the cabinet under the infill shows through
        if (whole.Fill) {
            shapes.push({ kind : 'shape', record : {
                Shape__Points       : Na__LeParamInfill__Rect(0, 0, W, H),
                Shape__Closed       : true,
                Shape__Stroked      : false,                                  // <-- A blank, not a box: the cabinet's own outline is the drawing's
                Shape__StrokeColour : style.lineColour,
                Shape__StrokePt     : style.linePt,
                Shape__FillColour   : style.fillColour,
                Shape__FillOpacity  : style.fillOpacity,
                Shape__LineStyle    : null
            } });
        }

        // THE CROSS | Corner to corner, the first line from the origin
        const line = (from, to) => ({ kind : 'shape', record : {
            Shape__Points       : [ from, to ],
            Shape__Closed       : false,
            Shape__Stroked      : true,
            Shape__StrokeColour : style.lineColour,
            Shape__StrokePt     : style.linePt,
            Shape__FillColour   : null,
            Shape__LineStyle    : style.lineDash ? Object.assign({}, style.lineDash) : null
        } });
        shapes.push(line([ 0, 0 ], [ W, H ]));
        shapes.push(line([ W, 0 ], [ 0, H ]));

        // THE LABEL'S BOX | Filled, so the cross stops at its edges. A box
        // whose fill and rule have both been taken off by hand keeps its rule:
        // the record layer never lets a shape be invisible.
        shapes.push({ kind : 'shape', record : {
            Shape__Points       : Na__LeParamInfill__Rect(layout.box.x, layout.box.y, layout.box.w, layout.box.h),
            Shape__Closed       : true,
            Shape__Stroked      : style.boxStroked !== false,
            Shape__StrokeColour : style.boxLineColour,
            Shape__StrokePt     : style.boxLinePt,
            Shape__FillColour   : style.boxFill,
            Shape__LineStyle    : style.boxDash ? Object.assign({}, style.boxDash) : null
        } });

        // THE WORDS | One record, its lines broken at spaces
        const words = {
            Annotation__Text       : layout.lines.join('\n'),
            Annotation__PosXMm     : layout.anchor.x,
            Annotation__PosYMm     : layout.anchor.y,
            Annotation__SizeMm     : whole.TextSizeMm,
            Annotation__FontWeight : style.textWeight,
            Annotation__Colour     : style.textColour,
            Annotation__Align      : 'center'
        };
        if (layout.rotationDeg) words.Annotation__RotationDeg = layout.rotationDeg;   // <-- Written only while turned, as the editor writes it

        return { records : shapes.concat([ { kind : 'annotation', record : words } ]), sizeMm : { WidthMm : W, HeightMm : H } };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Members Back
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Record's Points as [x, y] Pairs (only the well-formed ones)
    // ------------------------------------------------------------
    function Na__LeParamInfill__Points(record) {
        const raw = (record && Array.isArray(record.Shape__Points)) ? record.Shape__Points : [];
        return raw.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Member Is Which: { fill, line, box, text }
    // ------------------------------------------------------------
    // Told apart by what they ARE rather than by slot, so a member deleted by
    // hand does not make the next one read as something else: the fill is a
    // closed rectangle lying on the infill's own edges (and only looked for
    // while the fill is on), the cross's lines are open two-point runs, and
    // the box is the last closed rectangle that is not the fill. Any of them
    // may be null.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Classify(whole, records) {
        const shapes = ((records && Array.isArray(records.shapes)) ? records.shapes : []).filter((record) => !!record && typeof record === 'object');
        const texts  = ((records && Array.isArray(records.texts))  ? records.texts  : []).filter((record) => !!record && typeof record === 'object');
        const isRect = (record) => record.Shape__Closed === true && Na__LeParamInfill__Points(record).length === 4;
        const covers = (record) => {
            const pts = Na__LeParamInfill__Points(record);
            const xs  = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            const s   = Na__LeParamInfill__COVER_SLACK_MM;
            return Math.abs(Math.min.apply(null, xs)) <= s && Math.abs(Math.min.apply(null, ys)) <= s
                && Math.abs(Math.max.apply(null, xs) - whole.WidthMm) <= s && Math.abs(Math.max.apply(null, ys) - whole.HeightMm) <= s;
        };
        const fill = whole.Fill ? (shapes.find((record) => isRect(record) && covers(record) && typeof record.Shape__FillColour === 'string') || null) : null;
        const line = shapes.find((record) => record.Shape__Closed !== true && Na__LeParamInfill__Points(record).length === 2) || null;
        const box  = shapes.slice().reverse().find((record) => isRect(record) && record !== fill) || null;
        return { fill : fill, line : line, box : box, text : texts[0] || null };
    }
    // ------------------------------------------------------------


    // FUNCTION | What Was Restyled by Hand, Read Back as Parameters (the engine's adopt)
    // ------------------------------------------------------------
    // records is { shapes, texts }: the members as they stand, moved to the
    // origin. Returns a patch for the stored parameters - every style key a
    // member answers, as the member has it (undefined where it is the house
    // style, which Normalise then drops), and LabelText when the words on the
    // sheet are no longer the ones the parameters would write.
    //
    // THE GEOMETRY IS NEVER ADOPTED. A label dragged off centre or a line bent
    // by hand goes back on the next rebuild: where things are is what the
    // parameters say. How they are drawn is somebody's choice, and is kept.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Adopt(config, params, records) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        const found = Na__LeParamInfill__Classify(whole, records);
        const keys  = {};
        Na__LeParamInfill__StyleKeys(Na__LeParamInfill__House(config)).forEach((entry) => { keys[entry.key] = entry; });
        const patch = {};
        const take  = (key, value) => {
            const entry = keys[key];
            const clean = entry.clean(value);
            if (clean === undefined || (clean === null && entry.nullable !== true)) return;
            patch[key] = entry.same(clean, entry.house) ? undefined : clean;    // <-- The house value again: the key comes off
        };
        if (found.fill) {
            take('FillColour',  found.fill.Shape__FillColour);
            take('FillOpacity', Number.isFinite(found.fill.Shape__FillOpacity) ? found.fill.Shape__FillOpacity : 1);
        }
        if (found.line) {
            take('LineColour', found.line.Shape__StrokeColour);
            take('LinePt',     found.line.Shape__StrokePt);
            take('LineDash',   found.line.Shape__LineStyle === undefined ? null : found.line.Shape__LineStyle);
        }
        if (found.box) {
            take('BoxFill',       typeof found.box.Shape__FillColour === 'string' ? found.box.Shape__FillColour : null);
            take('BoxLineColour', found.box.Shape__StrokeColour);
            take('BoxLinePt',     found.box.Shape__StrokePt);
            take('BoxDash',       found.box.Shape__LineStyle === undefined ? null : found.box.Shape__LineStyle);
            take('BoxStroked',    found.box.Shape__Stroked !== false);
        }
        if (found.text) {
            take('TextColour', found.text.Annotation__Colour);
            take('TextWeight', found.text.Annotation__FontWeight);
            const size = found.text.Annotation__SizeMm;
            if (typeof size === 'number' && Number.isFinite(size) && size > 0 && Math.abs(size - whole.TextSizeMm) > 1e-6) patch.TextSizeMm = size;
            const words = Na__LeParamInfill__Words(found.text.Annotation__Text);   // <-- A broken label's lines, joined again at the spaces they were broken at
            if (words !== '' && words !== Na__LeParamInfill__LabelOf(config, whole).text) patch.LabelText = words;
        }
        return patch;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Label's Box Stopped Fitting Its Words (the engine's refit)
    // ------------------------------------------------------------
    // True when the box, as it stands, is not the length a build would draw
    // now - because it was drawn to the chrome's estimate before the paper's
    // metrics had loaded. Only the box's length along the words is asked
    // about: it is the one thing drawn from a measurement. False whenever the
    // box cannot be found, so a member taken away by hand is not a reason to
    // rebuild.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Misfits(config, params, tools, records) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        const found = Na__LeParamInfill__Classify(whole, records);
        if (!found.box) return false;
        const pts    = Na__LeParamInfill__Points(found.box);
        const xs     = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const layout = Na__LeParamInfill__Layout(config, whole, tools);
        const drawn  = layout.vertical ? (Math.max.apply(null, ys) - Math.min.apply(null, ys)) : (Math.max.apply(null, xs) - Math.min.apply(null, xs));
        if (!Number.isFinite(drawn)) return false;
        return Math.abs(drawn - layout.lengthMm) > Na__LeParamInfill__FIT_SLACK_MM;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grips and the Menu
// -----------------------------------------------------------------------------

    // FUNCTION | The Point the Infill Is Held By: Its Bottom Left Corner, From Its Origin
    // ------------------------------------------------------------
    // The base point a CAD block is inserted by. The origin is the top left
    // corner and paper y runs down, so the bottom left is (0, height).
    // ------------------------------------------------------------
    function Na__LeParamInfill__Base(config, params) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        return { x : 0, y : whole.HeightMm };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Infill's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // BASE on the bottom left corner: it moves the infill. CORNERS on the
    // other three, each ON its corner rather than stood off it - the corner
    // goes where the pointer takes it, and a grip stood off would jump it by
    // the offset. LOOKUP just off the right of the label's box, level with its
    // middle, whichever way the words run: beside the words it offers. No
    // stretch, no slide and no link socket.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Handles(config, params, tools) {
        const whole  = Na__LeParamInfill__Normalise(config, params);
        const W      = whole.WidthMm;
        const H      = whole.HeightMm;
        const box    = Na__LeParamInfill__Layout(config, whole, tools).box;
        const corner = (name, x, y) => ({ name : name, x : x, y : y, away : [ 0, 0 ] });
        return {
            base    : { x : 0, y : H, away : [ 0, 0 ] },
            corners : [ corner('tl', 0, 0), corner('tr', W, 0), corner('br', W, H) ],
            lookup  : { x : box.x + box.w, y : box.y + (box.h / 2), away : [ 1, 0 ] },
            stretch : null,
            slide   : null,
            link    : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Corner Grip Dragged to a Point Gives: { params, shift }
    // ------------------------------------------------------------
    // name is the corner in hand - 'tl', 'tr' or 'br'; the bottom left is the
    // base, which moves the infill instead. params are the infill's as the
    // drag BEGAN, and xMm, yMm the pointer from the origin as it began, so
    // every step is worked out afresh rather than piled on the last one.
    //
    // THE CORNER OPPOSITE STAYS PUT. The corner in hand goes to the pointer and
    // the infill is whatever rectangle the two corners make, so shift - the
    // new origin from the old - is non-zero whenever the top or the left edge
    // moved. A corner the grips module snapped to the drawing (exact) is kept
    // exactly; a free one steps both sides by SizeStepMm from the corner held.
    // A corner dragged past the one held stops at the least size, the held
    // corner still where it was.
    // ------------------------------------------------------------
    function Na__LeParamInfill__CornerTo(config, params, name, xMm, yMm, exact) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        const W     = whole.WidthMm;
        const H     = whole.HeightMm;
        const held  = { tl : [ W, H ], tr : [ 0, H ], br : [ 0, 0 ] }[name];   // <-- The corner opposite, from the origin
        if (!held || !Number.isFinite(xMm) || !Number.isFinite(yMm)) return { params : whole, shift : { x : 0, y : 0 } };
        const alongX = (name === 'tl') ? -1 : 1;                           // <-- Which way the infill runs from the held corner
        const alongY = (name === 'br') ?  1 : -1;
        const step   = Math.max(0.01, Na__LeParamInfill__Number(config, 'SizeStepMm'));
        const size   = (value) => (exact === true ? value : Math.round(value / step) * step);
        const next   = Na__LeParamInfill__Normalise(config, Object.assign({}, whole, {
            WidthMm  : size(alongX * (xMm - held[0])),
            HeightMm : size(alongY * (yMm - held[1]))
        }));                                                                // <-- Held inside the least and the most size by Normalise
        return {
            params : next,
            shift  : {
                x : alongX > 0 ? held[0] : held[0] - next.WidthMm,         // <-- Worked from the size as KEPT, so the held corner does not creep
                y : alongY > 0 ? held[1] : held[1] - next.HeightMm
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Lookup Grip's Menu Offers
    // ------------------------------------------------------------
    // The listed words, then the fill underneath, then which way the words
    // run. Picking a word clears any words typed over it - it is the answer to
    // "what should this say". Each entry is a patch the engine merges over the
    // element's parameters as one undo step: the same rebuild the panel's own
    // controls make.
    // ------------------------------------------------------------
    function Na__LeParamInfill__Choices(config, params, labels) {
        const whole = Na__LeParamInfill__Normalise(config, params);
        const words = (labels && typeof labels === 'object') ? labels : {};
        const items = Na__LeParamInfill__Presets(config).map((label) => ({
            label   : label,
            checked : whole.LabelText === '' && whole.Label === label,
            patch   : { Label : label, LabelText : '' }
        }));
        items.push({ separator : true });
        items.push({ label : words.fill || 'White fill underneath', checked : whole.Fill, patch : { Fill : !whole.Fill } });
        items.push({ separator : true });
        items.push({ label : words.auto   || 'Words along the longer side', checked : whole.Orientation === Na__LeParamInfill__RUN_AUTO,   patch : { Orientation : Na__LeParamInfill__RUN_AUTO } });
        items.push({ label : words.across || 'Words across',                checked : whole.Orientation === Na__LeParamInfill__RUN_ACROSS, patch : { Orientation : Na__LeParamInfill__RUN_ACROSS } });
        items.push({ label : words.up     || 'Words up the sheet',          checked : whole.Orientation === Na__LeParamInfill__RUN_UP,     patch : { Orientation : Na__LeParamInfill__RUN_UP } });
        return items;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Cabinet Infill's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's CabinetInfill block and getMenuWords()
    // the lookup menu's own words as the config words them, each read fresh on
    // every call. linkable is false: an infill is never tied to a viewport.
    // base is the point it is held by and cornerTo what its corner grips do;
    // presets, labelOf and styleOf are the panel's.
    // ------------------------------------------------------------
    function Na__LeParamInfill__CreateType(getConfig, getMenuWords) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        const words  = () => ((typeof getMenuWords === 'function' ? getMenuWords() : null) || null);
        return {
            type          : Na__LeParamInfill__TYPE,
            keep          : Na__LeParamInfill__KEEP.slice(),
            linkable      : false,
            defaults      : ()                              => Na__LeParamInfill__Standard(config()),
            normalise     : (params)                        => Na__LeParamInfill__Normalise(config(), params),
            build         : (params, tools)                 => Na__LeParamInfill__Build(config(), params, tools),
            handles       : (params, tools)                 => Na__LeParamInfill__Handles(config(), params, tools),
            base          : (params)                        => Na__LeParamInfill__Base(config(), params),
            cornerTo      : (params, name, xMm, yMm, exact) => Na__LeParamInfill__CornerTo(config(), params, name, xMm, yMm, exact),
            choices       : (params)                        => Na__LeParamInfill__Choices(config(), params, words()),
            adopt         : (params, records)               => Na__LeParamInfill__Adopt(config(), params, records),
            refit         : (params, tools, records)        => Na__LeParamInfill__Misfits(config(), params, tools, records),
            hasBar        : ()                              => false,
            presets       : ()                              => Na__LeParamInfill__Presets(config()),
            labelOf       : (params)                        => Na__LeParamInfill__LabelOf(config(), params),
            styleOf       : (params)                        => Na__LeParamInfill__Style(config(), params)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cabinet Infill API
    // ------------------------------------------------------------
    export {
        Na__LeParamInfill__TYPE,
        Na__LeParamInfill__RUN_AUTO,
        Na__LeParamInfill__RUN_ACROSS,
        Na__LeParamInfill__RUN_UP,
        Na__LeParamInfill__RUNS,
        Na__LeParamInfill__Presets,
        Na__LeParamInfill__House,
        Na__LeParamInfill__Standard,
        Na__LeParamInfill__Normalise,
        Na__LeParamInfill__Style,
        Na__LeParamInfill__LabelOf,
        Na__LeParamInfill__Layout,
        Na__LeParamInfill__Build,
        Na__LeParamInfill__Adopt,
        Na__LeParamInfill__Misfits,
        Na__LeParamInfill__Base,
        Na__LeParamInfill__Handles,
        Na__LeParamInfill__CornerTo,
        Na__LeParamInfill__Choices,
        Na__LeParamInfill__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
