// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - SCALE BAR
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js
// NAMESPACE  : Na__LeParamBar
// MODULE     : Layout Editor - Parametric Scrapbook - Scale Bar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Element one: the checker scale bar that sits under a drawing's title, built from a scale and a count of divisions
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE HOUSE BAR, measured on 19-Sep-2026 from the twelve bars Adam drew by
//   hand on PS02 D21 Floor Plans and D22 Elevations (A2, 1:50): five cells of
//   20 mm in two rows of 1 mm, the top row filled on odd cells and the bottom
//   row on even ones, numerals centred under every division, larger at the
//   two ends. Every size is in the config's ScaleBar block, not here.
// - A SCALE HAS A STANDARD. Dropped at 1:50 it is 5 m in metres; change the
//   scale and it goes back to that scale's standard (ScaleBar__Standards),
//   so it is never left as a 5 m bar 50 mm long. Nearly every standard is
//   the same 5 x 20 mm on the paper, so the bar looks the same under every
//   drawing and only its numerals change. A scale with no row in the table
//   is solved towards the same 20 mm and 100 mm.
// - SPLIT FIRST DIVISION cuts the first division into sub-cells in the same
//   checker - 200 mm at 1:50 - for reading something smaller than a metre.
//   The checker runs on through them, so the bar alternates end to end
//   whether the split gives an odd count or an even one.
// - THE STRETCH GRIP adds and removes whole divisions.
// - THIS MODULE IMPORTS NOTHING. CreateType is handed a reader for its config
//   block, and everything else is arithmetic, so the whole element runs in
//   Node as it stands.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookParametric__ registers CreateType's
//   definition with the engine (Na__LayoutEditor__ScrapbookParametric__).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: the standards, the solver, the checker, the
//   split first division, the numerals and the stretch.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, the Fallback Style and the Solver's Steps
    // ------------------------------------------------------------
    // FALLBACK is the house bar again, used for any key the config does not
    // give, so a thin or a broken config still draws Adam's bar.
    // ------------------------------------------------------------
    const Na__LeParamBar__TYPE      = 'ScaleBar';
    const Na__LeParamBar__UNITS     = Object.freeze([ 'm', 'mm' ]);
    const Na__LeParamBar__KEEP      = Object.freeze([ 'SubdivideFirst', 'ShowUnits' ]);   // <-- What a change of scale leaves alone
    const Na__LeParamBar__NICE      = Object.freeze([ 1, 2, 2.5, 5 ]);                    // <-- A division is one of these times a power of ten
    const Na__LeParamBar__SPLITS    = Object.freeze([ 5, 4, 2 ]);                         // <-- How a first division is cut when its standard does not say
    const Na__LeParamBar__STEPS     = Object.freeze([ 1, 2, 5, 10, 20, 50, 100 ]);        // <-- Every how many divisions a crowded bar is numbered
    const Na__LeParamBar__EPSILON   = 1e-6;
    const Na__LeParamBar__FALLBACK  = Object.freeze({
        Rows : 2, RowHeightMm : 1, FillColour : '#666666', StrokeColour : '#172b3a', StrokePt : 0.2,
        TextColour : '#172b3a', TextWeight : 400, EndTextSizeMm : 2.5, MidTextSizeMm : 2, TextBaselineBelowBarMm : 5.314, MinLabelSpacingMm : 7,
        TargetLengthMm : 100, TargetDivisionMm : 20, MinDivisions : 1, MaxDivisions : 40, MinSubdivisionPaperMm : 1.5,
        DefaultScaleDenominator : 50
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One ScaleBar Setting, or the House Bar's
    // ------------------------------------------------------------
    function Na__LeParamBar__Number(config, key) {
        const value = config ? config['ScaleBar__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamBar__FALLBACK[key];
    }
    function Na__LeParamBar__Text(config, key) {
        const value = config ? config['ScaleBar__' + key] : undefined;
        return (typeof value === 'string' && value !== '') ? value : Na__LeParamBar__FALLBACK[key];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Positive Number, or Null
    // ------------------------------------------------------------
    function Na__LeParamBar__Positive(value) {
        const parsed = (typeof value === 'number') ? value : parseFloat(value);
        return (Number.isFinite(parsed) && parsed > 0) ? parsed : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Standards
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Division Nearest a Paper Size, as 1, 2, 2.5 or 5 x 10^n Real Millimetres
    // ------------------------------------------------------------
    function Na__LeParamBar__NiceDivision(denominator, targetPaperMm) {
        const wanted = targetPaperMm * denominator;                             // <-- Real millimetres the target is worth at this scale
        const decade = Math.pow(10, Math.floor(Math.log10(wanted)));
        let best = decade, bestGap = Infinity;
        [ decade / 10, decade, decade * 10 ].forEach((power) => {
            Na__LeParamBar__NICE.forEach((nice) => {
                const candidate = nice * power;
                const gap       = Math.abs(Math.log(candidate / wanted));          // <-- Nearest by ratio: 10 is as far from 20 as 40 is
                if (gap < bestGap - Na__LeParamBar__EPSILON) { best = candidate; bestGap = gap; }
            });
        });
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How a Division Is Cut When Nothing Says How
    // ------------------------------------------------------------
    // The first of five, four or two parts that leaves whole millimetres,
    // else a fifth.
    // ------------------------------------------------------------
    function Na__LeParamBar__DefaultSubdivision(divisionMm) {
        const parts = Na__LeParamBar__SPLITS.find((count) => Math.abs((divisionMm / count) - Math.round(divisionMm / count)) < Na__LeParamBar__EPSILON);
        return divisionMm / (parts || Na__LeParamBar__SPLITS[0]);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Standard Bar at a Scale
    // ------------------------------------------------------------
    // The config's own row for the scale, else one solved towards the target
    // division and the target length. Always whole: a row with a bad number
    // in it is solved instead. Bars of a metre or more are numbered in metres.
    // ------------------------------------------------------------
    function Na__LeParamBar__Standard(config, denominator) {
        const scale = Na__LeParamBar__Positive(denominator) || Na__LeParamBar__Number(config, 'DefaultScaleDenominator');
        const rows  = (config && Array.isArray(config.ScaleBar__Standards)) ? config.ScaleBar__Standards : [];
        const row   = rows.find((entry) => entry && Na__LeParamBar__Positive(entry.Scale) === scale) || null;
        const rowDivision = row ? Na__LeParamBar__Positive(row.DivisionMm) : null;
        const rowCount    = row ? Na__LeParamBar__Positive(row.Divisions) : null;

        const divisionMm = rowDivision || Na__LeParamBar__NiceDivision(scale, Na__LeParamBar__Number(config, 'TargetDivisionMm'));
        const paperMm    = divisionMm / scale;
        const divisions  = rowCount ? Math.round(rowCount) : Math.max(1, Math.round(Na__LeParamBar__Number(config, 'TargetLengthMm') / paperMm));
        const rowSplit   = row ? Na__LeParamBar__Positive(row.SubdivisionMm) : null;
        const rowUnits   = row && Na__LeParamBar__UNITS.indexOf(row.Units) !== -1 ? row.Units : null;
        return {
            ScaleDenominator : scale,
            DivisionMm       : divisionMm,
            Divisions        : divisions,
            SubdivideFirst   : false,
            SubdivisionMm    : rowSplit || Na__LeParamBar__DefaultSubdivision(divisionMm),
            Units            : rowUnits || ((divisionMm * divisions) >= 1000 ? 'm' : 'mm'),
            ShowUnits        : false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    // Anything missing or out of range takes the standard at the bar's scale.
    // A sub-cell size that does not divide the division evenly falls back to
    // the standard's, so the split always ends exactly on the first numeral.
    // ------------------------------------------------------------
    function Na__LeParamBar__Normalise(config, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamBar__Standard(config, given.ScaleDenominator);
        const division = Na__LeParamBar__Positive(given.DivisionMm) || standard.DivisionMm;
        const minCount = Math.max(1, Math.round(Na__LeParamBar__Number(config, 'MinDivisions')));
        const maxCount = Math.max(minCount, Math.round(Na__LeParamBar__Number(config, 'MaxDivisions')));
        const count    = Na__LeParamBar__Positive(given.Divisions);
        let   split    = Na__LeParamBar__Positive(given.SubdivisionMm);
        const parts    = split ? division / split : 0;
        if (!split || parts < 2 - Na__LeParamBar__EPSILON || Math.abs(parts - Math.round(parts)) > Na__LeParamBar__EPSILON) {
            split = (division === standard.DivisionMm) ? standard.SubdivisionMm : Na__LeParamBar__DefaultSubdivision(division);
        }
        return {
            ScaleDenominator : standard.ScaleDenominator,
            DivisionMm       : division,
            Divisions        : Math.min(maxCount, Math.max(minCount, count ? Math.round(count) : standard.Divisions)),
            SubdivideFirst   : given.SubdivideFirst === true,
            SubdivisionMm    : split,
            Units            : Na__LeParamBar__UNITS.indexOf(given.Units) !== -1 ? given.Units : standard.Units,
            ShowUnits        : given.ShowUnits === true
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Sizes a Bar Is Drawn From, on the Paper
    // ------------------------------------------------------------
    function Na__LeParamBar__Metrics(config, params) {
        const rows       = Math.round(Na__LeParamBar__Number(config, 'Rows')) === 1 ? 1 : 2;
        const rowMm      = Na__LeParamBar__Number(config, 'RowHeightMm');
        const divisionMm = params.DivisionMm / params.ScaleDenominator;
        const splitMm    = params.SubdivisionMm / params.ScaleDenominator;
        return {
            rows       : rows,
            rowMm      : rowMm,
            heightMm   : rows * rowMm,
            divisionMm : divisionMm,
            lengthMm   : divisionMm * params.Divisions,
            splitMm    : splitMm,
            splits     : (params.SubdivideFirst && splitMm >= Na__LeParamBar__Number(config, 'MinSubdivisionPaperMm')) ? Math.round(params.DivisionMm / params.SubdivisionMm) : 0   // <-- Sub-cells too small to read are not drawn
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Numeral: a Count of Real Millimetres in the Bar's Units
    // ------------------------------------------------------------
    function Na__LeParamBar__Numeral(realMm, units) {
        const value = (units === 'm') ? realMm / 1000 : realMm;
        return String(Math.round(value * 1000) / 1000);                          // <-- 0.5 and 2.5 stay; 2.0 reads 2
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Divisions Carry a Numeral
    // ------------------------------------------------------------
    // All of them while they are MinLabelSpacingMm apart or more. Closer than
    // that, every second, fifth or tenth, and always both ends - dropping the
    // last numbered one before the end where the two would collide.
    // ------------------------------------------------------------
    function Na__LeParamBar__LabelledDivisions(config, params, metrics) {
        const spacing = Na__LeParamBar__Number(config, 'MinLabelSpacingMm');
        const step    = Na__LeParamBar__STEPS.find((candidate) => (candidate * metrics.divisionMm) >= spacing - Na__LeParamBar__EPSILON) || Na__LeParamBar__STEPS[Na__LeParamBar__STEPS.length - 1];
        const out     = [];
        for (let i = 0; i <= params.Divisions; i += step) out.push(i);
        if (out[out.length - 1] !== params.Divisions) {
            if (out.length > 1 && ((params.Divisions - out[out.length - 1]) * metrics.divisionMm) < spacing - Na__LeParamBar__EPSILON) out.pop();
            out.push(params.Divisions);
        }
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Bar: Parameters In, Records Out
    // ------------------------------------------------------------
    // { records : [{ kind, record }], sizeMm } in paper millimetres, y down,
    // from an origin of (0, 0) at the top left of the first cell. THE FIRST
    // RECORD IS THAT CELL AND ITS FIRST POINT IS THE ORIGIN, which is how the
    // engine finds the bar again after it has been moved.
    //
    // The cells come first, left to right, the top row before the bottom in
    // each; then the numerals, left to right. parity counts every cell drawn,
    // sub-cells included, so the checker never stutters at the first numeral.
    // An empty cell has no fill at all, as Adam's have, so whatever is under
    // the bar shows through it.
    // ------------------------------------------------------------
    function Na__LeParamBar__Build(config, params) {
        const whole   = Na__LeParamBar__Normalise(config, params);
        const metrics = Na__LeParamBar__Metrics(config, whole);
        const fill    = Na__LeParamBar__Text(config, 'FillColour');
        const stroke  = Na__LeParamBar__Text(config, 'StrokeColour');
        const strokePt = Na__LeParamBar__Number(config, 'StrokePt');
        const records = [];
        let   parity  = 0;

        const cell = (x0, x1) => {
            for (let row = 0; row < metrics.rows; row++) {
                const y0     = row * metrics.rowMm;
                const y1     = y0 + metrics.rowMm;
                const filled = (metrics.rows === 1) ? (parity % 2 === 0) : ((row === 0) === (parity % 2 === 1));   // <-- Two rows: the top on odd cells, the bottom on even ones
                records.push({ kind : 'shape', record : {
                    Shape__Points       : [ [ x0, y0 ], [ x1, y0 ], [ x1, y1 ], [ x0, y1 ] ],
                    Shape__Closed       : true,
                    Shape__Stroked      : true,
                    Shape__StrokeColour : stroke,
                    Shape__StrokePt     : strokePt,
                    Shape__FillColour   : filled ? fill : null
                } });
            }
            parity++;
        };

        for (let i = 0; i < whole.Divisions; i++) {
            const start = i * metrics.divisionMm;
            if (i === 0 && metrics.splits >= 2) {
                for (let s = 0; s < metrics.splits; s++) cell(start + (s * metrics.splitMm), (s === metrics.splits - 1) ? metrics.divisionMm : start + ((s + 1) * metrics.splitMm));   // <-- The last sub-cell ends on the division, to the decimal
                continue;
            }
            cell(start, start + metrics.divisionMm);
        }

        const baseline = metrics.heightMm + Na__LeParamBar__Number(config, 'TextBaselineBelowBarMm');
        Na__LeParamBar__LabelledDivisions(config, whole, metrics).forEach((i) => {
            const atEnd = (i === 0 || i === whole.Divisions);
            const last  = (i === whole.Divisions);
            records.push({ kind : 'annotation', record : {
                Annotation__Text       : Na__LeParamBar__Numeral(i * whole.DivisionMm, whole.Units) + ((last && whole.ShowUnits) ? ' ' + whole.Units : ''),
                Annotation__PosXMm     : i * metrics.divisionMm,
                Annotation__PosYMm     : baseline,
                Annotation__SizeMm     : Na__LeParamBar__Number(config, atEnd ? 'EndTextSizeMm' : 'MidTextSizeMm'),
                Annotation__FontWeight : Na__LeParamBar__Number(config, 'TextWeight'),
                Annotation__Colour     : Na__LeParamBar__Text(config, 'TextColour'),
                Annotation__Align      : 'center'
            } });
        });
        return { records : records, sizeMm : { WidthMm : metrics.lengthMm, HeightMm : baseline } };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Bar's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // Both flank the bar, level with its middle: the lookup grip off the zero
    // end and the stretch grip off the far end. Nothing else of the bar is out
    // there - the numerals are all underneath - so neither grip ever covers
    // anything. The link socket, which the noodle to the bar's drawing leaves
    // from, stands off the top of the far end: a drawing's title sits over
    // the bar's near end, and a noodle from there would run through it. away
    // is the way each stands clear of its point; the grips and noodle modules
    // set how far, in screen pixels.
    // ------------------------------------------------------------
    function Na__LeParamBar__Handles(config, params) {
        const metrics = Na__LeParamBar__Metrics(config, Na__LeParamBar__Normalise(config, params));
        return {
            stretch : { x : metrics.lengthMm, y : metrics.heightMm / 2, away : [  1, 0 ] },
            lookup  : { x : 0,                y : metrics.heightMm / 2, away : [ -1, 0 ] },
            link    : { x : metrics.lengthMm, y : 0,                    away : [ Math.SQRT1_2, -Math.SQRT1_2 ] }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Stretch Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    // xMm is from the origin. Whole divisions only, inside the limits.
    // ------------------------------------------------------------
    function Na__LeParamBar__StretchTo(config, params, xMm) {
        const whole   = Na__LeParamBar__Normalise(config, params);
        const metrics = Na__LeParamBar__Metrics(config, whole);
        return Na__LeParamBar__Normalise(config, Object.assign({}, whole, { Divisions : Math.max(1, Math.round(xMm / metrics.divisionMm)) }));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Bar's Length in Words, for the Panel
    // ------------------------------------------------------------
    function Na__LeParamBar__Describe(config, params) {
        const whole   = Na__LeParamBar__Normalise(config, params);
        const metrics = Na__LeParamBar__Metrics(config, whole);
        return {
            real  : Na__LeParamBar__Numeral(whole.DivisionMm * whole.Divisions, whole.Units) + ' ' + whole.Units,
            paper : String(Math.round(metrics.lengthMm * 100) / 100)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sub-Cell Sizes a Division Can Be Split Into, in Real Millimetres
    // ------------------------------------------------------------
    // Halves, quarters, fifths and tenths that come out as whole millimetres
    // and are large enough on the paper to read; the panel's list.
    // ------------------------------------------------------------
    function Na__LeParamBar__SubdivisionChoices(config, params) {
        const whole = Na__LeParamBar__Normalise(config, params);
        const least = Na__LeParamBar__Number(config, 'MinSubdivisionPaperMm');
        return [ 2, 4, 5, 10 ].map((parts) => whole.DivisionMm / parts)
            .filter((sizeMm) => Math.abs(sizeMm - Math.round(sizeMm)) < Na__LeParamBar__EPSILON && (sizeMm / whole.ScaleDenominator) >= least - Na__LeParamBar__EPSILON);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Scale Bar's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's ScaleBar block, read fresh on every
    // call, so a definition made before the config arrived still draws from
    // it afterwards.
    // ------------------------------------------------------------
    function Na__LeParamBar__CreateType(getConfig) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        return {
            type      : Na__LeParamBar__TYPE,
            keep      : Na__LeParamBar__KEEP.slice(),
            defaults  : (denominator)  => Na__LeParamBar__Standard(config(), denominator),
            normalise : (params)       => Na__LeParamBar__Normalise(config(), params),
            build     : (params)       => Na__LeParamBar__Build(config(), params),
            handles   : (params)       => Na__LeParamBar__Handles(config(), params),
            stretchTo : (params, xMm)  => Na__LeParamBar__StretchTo(config(), params, xMm),
            describe  : (params)       => Na__LeParamBar__Describe(config(), params),
            subdivisionChoices : (params) => Na__LeParamBar__SubdivisionChoices(config(), params)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scale Bar API
    // ------------------------------------------------------------
    export {
        Na__LeParamBar__TYPE,
        Na__LeParamBar__Standard,
        Na__LeParamBar__Normalise,
        Na__LeParamBar__Build,
        Na__LeParamBar__Handles,
        Na__LeParamBar__StretchTo,
        Na__LeParamBar__Describe,
        Na__LeParamBar__SubdivisionChoices,
        Na__LeParamBar__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
