// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - DRAWING TITLE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js
// NAMESPACE  : Na__LeParamTitle
// MODULE     : Layout Editor - Parametric Scrapbook - Drawing Title
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The title under a drawing, written by the drawing it is tied to - "EXISTING EAST ELEVATION" - over its underline, with the scale bar beneath when wanted
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE HOUSE TITLE, MEASURED. Adam letters every drawing the same way, and
//   PS02 D22's six elevations were read to the thousandth: capitals, 3.5 mm,
//   weight 600, #172b3a, ranged left; an underline 0.4 pt thick and exactly
//   60 mm long, 1.631 mm under the baseline and 0.171 mm in from the text's
//   left; and the scale bar 6.318 mm under that, sharing the underline's left
//   end. He groups the three as one object. This type draws that object.
// - THE WORDS ARE FACTS, NOT TYPING. Which model the viewport draws gives
//   Existing or Proposed; its elevation's bearing against the project's north
//   gives the compass word; its floor plan's storey gives GROUND FLOOR PLAN.
//   The link module fills them in as parameters - ViewKind, ViewPhase,
//   ViewFacing, ViewLevel, ViewName, ViewDrawing - and this module, which
//   knows nothing of viewports, only reads them. So a title rebuilds from its
//   own parameters alone, and keeps what it says when untied. A title saved
//   before there was a ViewLevel has none, reads exactly as it did, and is
//   given one the next time its sheet is brought into line.
// - A FACT NOT YET KNOWN IS SHOWN IN DOUBLE BRACES. Until north is set in the
//   3D model an elevation's title reads EXISTING {{DIRECTION}} ELEVATION, and
//   fills itself in the moment the compass is drawn. The sentence itself is
//   written by Na__LayoutEditor__ViewportTitleText__, shared with the names
//   the editor gives unnamed elevation viewports.
// - THE ORIGIN IS THE UNDERLINE'S LEFT END, and the underline is the first
//   record, as the engine requires. The text stands above it and the bar
//   hangs below, so the bar's own geometry, grips and standards are the scale
//   bar module's, moved down - nothing about a bar is restated here.
// - OR THE BAR STANDS AWAY TO THE RIGHT. BarPlacement 'right' puts the same
//   bar along the same line instead of under it, its foot on the title's
//   baseline, for a wide elevation whose bar belongs under its far corner
//   rather than tucked beneath its title. Everything that follows from that
//   is a consequence of ONE decision, which is worth stating plainly:
//       THE FAR END OF THAT BAR IS THE END THAT IS HELD.
//   BarOffsetMm is where the bar's zero end stands, measured from THIS
//   element's origin and not from the end of the underline, so a longer
//   title never shoves the bar off the corner it was put under. The slide
//   grip on the far end sets it - in 50 mm steps, or exactly where a snapped
//   vertex says - and the stretch grip moves to the NEAR end and runs
//   BACKWARDS: dragging it towards the title lengthens the bar and pulls
//   BarOffsetMm back by the same amount, so the far end does not move.
//   A bar placed below is untouched by any of it.
// - THE UNDERLINE IS AT LEAST ITS SET LENGTH AND GROWS TO FIT. Sixty
//   millimetres underlines "EXISTING EAST ELEVATION" with room to spare and
//   would stop short of "PROPOSED FIRST FLOOR PLAN"; given a way to measure
//   text (the engine passes one in the browser) it reaches the end of a
//   longer title. With none - under Node - it is its set length.
// - Imports only the two pure modules it is made of, so it runs under Node.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookParametric__ registers CreateType.
// - 80__Testing__PrototypeEnvironment/Na__Test__ScrapbookDrawingTitle__.test.mjs
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js
// // @delegate: ../20__System__Viewports/Na__LayoutEditor__ViewportTitleText__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
// - Ahead of it   : 1.1.0 (ViewLevel) and 1.2.0 (the bar to the right) are
//                   TrueVision only. ValeVision holds 1.0.0, its floor plans
//                   have no storey field, and its bar is always below.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.2.0
// - BarPlacement 'right' and BarOffsetMm: the scale bar stood away along the
//   title's own line, its foot on the title's baseline, held by its FAR end.
//   SlideTo carries it there (stepped, or exact on a snapped vertex) and
//   StretchTo runs backwards for it, lengthening the bar towards the title
//   and pulling the offset back so the far end stays where it was put.
//   Handles grows a third point, slide, for the grip that does the carrying,
//   and the lookup triangle steps above the bar's near end to make room for
//   the stretch arrow that has taken its old place.
//
// 20-Sep-2026 - Version 1.1.0
// - A sixth fact, ViewLevel: the storey of the floor plan a title is tied to,
//   so it letters PROPOSED GROUND FLOOR PLAN where it wrote the plan record's
//   name, or the viewport's typed "Proposed Floor Plan".
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Scale Bar It Carries and the Sentence It Writes
    // ------------------------------------------------------------
    import {
        Na__LeParamBar__Standard,
        Na__LeParamBar__Normalise,
        Na__LeParamBar__PaperMm,
        Na__LeParamBar__Build,
        Na__LeParamBar__Handles,
        Na__LeParamBar__StretchTo,
        Na__LeParamBar__Describe,
        Na__LeParamBar__SubdivisionChoices
    } from './Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js';
    import {
        Na__LeViewText__MODE_AUTO,
        Na__LeViewText__MODES,
        Na__LeViewText__NormaliseFacts,
        Na__LeViewText__Compose
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportTitleText__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, the Facts the Link Module Fills, and What a Change of Scale Leaves Alone
    // ------------------------------------------------------------
    const Na__LeParamTitle__TYPE  = 'DrawingTitle';
    const Na__LeParamTitle__FACTS = Object.freeze([ 'ViewKind', 'ViewPhase', 'ViewFacing', 'ViewLevel', 'ViewName', 'ViewDrawing' ]);
    const Na__LeParamTitle__KEEP  = Object.freeze([ 'ShowScaleBar', 'PhaseMode', 'TitleText', 'Uppercase', 'UnderlineMm', 'BarPlacement', 'BarOffsetMm', 'SubdivideFirst', 'ShowUnits' ].concat(Na__LeParamTitle__FACTS));
    const Na__LeParamTitle__MAX_TEXT = 200;
    const Na__LeParamTitle__FALLBACK = Object.freeze({
        TextSizeMm : 3.5, TextWeight : 600, TextColour : '#172b3a', TextOffsetXMm : -0.171, TextBaselineAboveUnderlineMm : 1.631,
        UnderlineMm : 60, UnderlineMinMm : 10, UnderlineMaxMm : 400, UnderlineStepMm : 5, UnderlineFitExtraMm : 0.342,
        UnderlineColour : '#172b3a', UnderlineStrokePt : 0.4, ScaleBarBelowUnderlineMm : 6.318, SocketAboveUnderlineMm : 4.2,
        ScaleBarAboveUnderlineMm : 3.631, BarOffsetMm : 150, BarOffsetMinMm : 0, BarOffsetMaxMm : 1200, BarOffsetStepMm : 50
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Where the Scale Bar Sits
    // ------------------------------------------------------------
    // BELOW is the house title Adam letters by hand. RIGHT stands the same
    // bar away along the same line - see the header, and Meta__BarRight in
    // the config - and is the only thing BarOffsetMm means anything to.
    // ------------------------------------------------------------
    const Na__LeParamTitle__PLACE_BELOW = 'below';
    const Na__LeParamTitle__PLACE_RIGHT = 'right';
    const Na__LeParamTitle__PLACES      = Object.freeze([ Na__LeParamTitle__PLACE_BELOW, Na__LeParamTitle__PLACE_RIGHT ]);
    const Na__LeParamTitle__OFFSET_DP   = 1000;                              // <-- An offset is kept to a thousandth, so a rebuild writes the same number
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Value of the DrawingTitle Block, or Its Fallback
    // ------------------------------------------------------------
    function Na__LeParamTitle__Number(config, key) {
        const value = config ? config['DrawingTitle__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamTitle__FALLBACK[key];
    }
    function Na__LeParamTitle__Text(config, key) {
        const value = config ? config['DrawingTitle__' + key] : undefined;
        return (typeof value === 'string' && value !== '') ? value : Na__LeParamTitle__FALLBACK[key];
    }
    function Na__LeParamTitle__Flag(config, key, fallback) {
        const value = config ? config['DrawingTitle__' + key] : undefined;
        return (typeof value === 'boolean') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parameters
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Title at a Scale
    // ------------------------------------------------------------
    // The scale bar's standard at that scale, and the title's own settings
    // from the config. The facts start empty: the link module fills them.
    // ------------------------------------------------------------
    function Na__LeParamTitle__Standard(config, barConfig, denominator) {
        const mode  = config ? config.DrawingTitle__PhaseMode : null;
        const place = config ? config.DrawingTitle__BarPlacement : null;
        return Object.assign(Na__LeParamBar__Standard(barConfig, denominator), {
            ShowScaleBar : Na__LeParamTitle__Flag(config, 'ShowScaleBar', true),
            PhaseMode    : (Na__LeViewText__MODES.indexOf(mode) !== -1) ? mode : Na__LeViewText__MODE_AUTO,
            TitleText    : '',
            Uppercase    : Na__LeParamTitle__Flag(config, 'Uppercase', true),
            UnderlineMm  : Na__LeParamTitle__Number(config, 'UnderlineMm'),
            BarPlacement : (Na__LeParamTitle__PLACES.indexOf(place) !== -1) ? place : Na__LeParamTitle__PLACE_BELOW,
            BarOffsetMm  : Na__LeParamTitle__Number(config, 'BarOffsetMm'),
            ViewKind : '', ViewPhase : '', ViewFacing : '', ViewLevel : '', ViewName : '', ViewDrawing : ''
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    function Na__LeParamTitle__Normalise(config, barConfig, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamTitle__Standard(config, barConfig, given.ScaleDenominator);
        const facts    = Na__LeViewText__NormaliseFacts({ kind : given.ViewKind, phase : given.ViewPhase, facing : given.ViewFacing, level : given.ViewLevel, name : given.ViewName, drawing : given.ViewDrawing });
        const least    = Math.max(1, Na__LeParamTitle__Number(config, 'UnderlineMinMm'));
        const most     = Math.max(least, Na__LeParamTitle__Number(config, 'UnderlineMaxMm'));
        const length   = (typeof given.UnderlineMm === 'number' && Number.isFinite(given.UnderlineMm)) ? given.UnderlineMm : standard.UnderlineMm;
        const nearest  = Math.max(0, Na__LeParamTitle__Number(config, 'BarOffsetMinMm'));
        const furthest = Math.max(nearest, Na__LeParamTitle__Number(config, 'BarOffsetMaxMm'));
        const offset   = (typeof given.BarOffsetMm === 'number' && Number.isFinite(given.BarOffsetMm)) ? given.BarOffsetMm : standard.BarOffsetMm;
        return Object.assign(Na__LeParamBar__Normalise(barConfig, given), {
            ShowScaleBar : (typeof given.ShowScaleBar === 'boolean') ? given.ShowScaleBar : standard.ShowScaleBar,
            PhaseMode    : (Na__LeViewText__MODES.indexOf(given.PhaseMode) !== -1) ? given.PhaseMode : standard.PhaseMode,
            TitleText    : (typeof given.TitleText === 'string') ? given.TitleText.replace(/\s+/g, ' ').trim().slice(0, Na__LeParamTitle__MAX_TEXT) : '',
            Uppercase    : (typeof given.Uppercase === 'boolean') ? given.Uppercase : standard.Uppercase,
            UnderlineMm  : Math.min(most, Math.max(least, length)),
            BarPlacement : (Na__LeParamTitle__PLACES.indexOf(given.BarPlacement) !== -1) ? given.BarPlacement : standard.BarPlacement,
            BarOffsetMm  : Math.round(Math.min(furthest, Math.max(nearest, offset)) * Na__LeParamTitle__OFFSET_DP) / Na__LeParamTitle__OFFSET_DP,
            ViewKind     : facts.kind,
            ViewPhase    : facts.phase,
            ViewFacing   : facts.facing,
            ViewLevel    : facts.level,
            ViewName     : facts.name,
            ViewDrawing  : facts.drawing
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sentence
// -----------------------------------------------------------------------------

    // FUNCTION | What a Title Says: { text, resolved, missing }
    // ------------------------------------------------------------
    // words are the viewport identity module's; left out, plain English.
    // ------------------------------------------------------------
    function Na__LeParamTitle__TitleText(config, barConfig, params, words) {
        const whole = Na__LeParamTitle__Normalise(config, barConfig, params);
        return Na__LeViewText__Compose(
            { kind : whole.ViewKind, phase : whole.ViewPhase, facing : whole.ViewFacing, level : whole.ViewLevel, name : whole.ViewName, drawing : whole.ViewDrawing },
            { phaseMode : whole.PhaseMode, uppercase : whole.Uppercase, override : whole.TitleText }, words || null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Long the Underline Is Drawn
    // ------------------------------------------------------------
    // Its set length, or as far as the text reaches when that is further and
    // there is a way to measure it. tools.measureTextMm(text, sizeMm, weight).
    // ------------------------------------------------------------
    function Na__LeParamTitle__UnderlineLength(config, whole, text, tools) {
        const measure = (tools && typeof tools.measureTextMm === 'function' && Na__LeParamTitle__Flag(config, 'UnderlineGrowsToFit', true)) ? tools.measureTextMm : null;
        if (!measure) return whole.UnderlineMm;
        let width = 0;
        try { width = Number(measure(text, Na__LeParamTitle__Number(config, 'TextSizeMm'), Na__LeParamTitle__Number(config, 'TextWeight'))); } catch (error) { width = 0; }
        if (!Number.isFinite(width) || width <= 0) return whole.UnderlineMm;
        const reach = Math.ceil((width + Na__LeParamTitle__Number(config, 'UnderlineFitExtraMm')) * 10) / 10;   // <-- To a tenth, so a rebuild writes the same number
        return Math.max(whole.UnderlineMm, reach);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Scale Bar's Own Origin Stands, From the Title's
    // ------------------------------------------------------------
    // The top left of the bar's first cell. Below: on the underline's left
    // end, ScaleBarBelowUnderlineMm down. To the right: BarOffsetMm along,
    // and ScaleBarAboveUnderlineMm UP - a negative y - which is what puts its
    // foot on the title's baseline. The underline's own length is not in it
    // either way: the offset is measured from the origin, so a title that
    // grows to fit a longer sentence leaves the bar exactly where it was.
    // ------------------------------------------------------------
    function Na__LeParamTitle__BarOrigin(config, whole) {
        if (whole.BarPlacement !== Na__LeParamTitle__PLACE_RIGHT) return { x : 0, y : Na__LeParamTitle__Number(config, 'ScaleBarBelowUnderlineMm') };
        return { x : whole.BarOffsetMm, y : -Na__LeParamTitle__Number(config, 'ScaleBarAboveUnderlineMm') };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Title's Records
    // ------------------------------------------------------------
    // { records : [{ kind : 'shape' | 'annotation', record }], sizeMm }, from
    // an origin of (0, 0) at the underline's left end. THE FIRST RECORD IS THE
    // UNDERLINE AND ITS FIRST POINT IS THE ORIGIN. Then the bar's cells; then
    // the title text, then the bar's numerals - so the engine's slots stay
    // put: the underline is always vector one and the title always text one,
    // however the bar grows, shrinks or goes.
    // ------------------------------------------------------------
    function Na__LeParamTitle__Build(config, barConfig, params, words, tools) {
        const whole  = Na__LeParamTitle__Normalise(config, barConfig, params);
        const told   = Na__LeParamTitle__TitleText(config, barConfig, whole, words);
        const length = Na__LeParamTitle__UnderlineLength(config, whole, told.text, tools);
        const shapes = [ { kind : 'shape', record : {
            Shape__Points       : [ [ 0, 0 ], [ length, 0 ] ],
            Shape__Closed       : false,
            Shape__Stroked      : true,
            Shape__StrokeColour : Na__LeParamTitle__Text(config, 'UnderlineColour'),
            Shape__StrokePt     : Na__LeParamTitle__Number(config, 'UnderlineStrokePt'),
            Shape__FillColour   : null
        } } ];
        const texts  = [ { kind : 'annotation', record : {
            Annotation__Text       : told.text,
            Annotation__PosXMm     : Na__LeParamTitle__Number(config, 'TextOffsetXMm'),
            Annotation__PosYMm     : -Na__LeParamTitle__Number(config, 'TextBaselineAboveUnderlineMm'),
            Annotation__SizeMm     : Na__LeParamTitle__Number(config, 'TextSizeMm'),
            Annotation__FontWeight : Na__LeParamTitle__Number(config, 'TextWeight'),
            Annotation__Colour     : Na__LeParamTitle__Text(config, 'TextColour'),
            Annotation__Align      : 'left'
        } } ];

        let widthMm = length, heightMm = 0;
        if (whole.ShowScaleBar) {
            const at  = Na__LeParamTitle__BarOrigin(config, whole);
            const bar = Na__LeParamBar__Build(barConfig, whole);
            bar.records.forEach((entry) => {
                const record = JSON.parse(JSON.stringify(entry.record));
                if (entry.kind === 'shape') { record.Shape__Points = record.Shape__Points.map((p) => [ p[0] + at.x, p[1] + at.y ]); shapes.push({ kind : entry.kind, record : record }); return; }
                record.Annotation__PosXMm = record.Annotation__PosXMm + at.x;
                record.Annotation__PosYMm = record.Annotation__PosYMm + at.y;
                texts.push({ kind : entry.kind, record : record });
            });
            widthMm  = Math.max(widthMm, at.x + bar.sizeMm.WidthMm);
            heightMm = at.y + bar.sizeMm.HeightMm;                            // <-- Down to the numerals' baseline; a bar to the right starts above the underline, so its y is negative
        }
        return { records : shapes.concat(texts), sizeMm : { WidthMm : widthMm, HeightMm : heightMm }, title : told, underlineMm : length };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Title's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // With its bar BELOW it has the bar's two grips, moved down with it.
    // Without a bar at all, the stretch grip stands off the underline's end
    // and sets its length; there is no scale to look up. The link socket
    // stands off the top of the underline's end either way, above the stretch
    // grip and clear of the text.
    //
    // WITH ITS BAR TO THE RIGHT the two swap ends, because the end that is
    // held is the far one: the STRETCH arrow moves to the bar's near end and
    // points back at the title, and a third grip - SLIDE - takes the far end
    // and carries the whole bar along. The lookup triangle, whose old place
    // the stretch arrow has taken, steps up over the bar's near end, where
    // nothing of the element is: the numerals are all underneath.
    // ------------------------------------------------------------
    function Na__LeParamTitle__Handles(config, barConfig, params, words, tools) {
        const whole  = Na__LeParamTitle__Normalise(config, barConfig, params);
        const length = Na__LeParamTitle__UnderlineLength(config, whole, Na__LeParamTitle__TitleText(config, barConfig, whole, words).text, tools);
        const link   = { x : length, y : -Na__LeParamTitle__Number(config, 'SocketAboveUnderlineMm'), away : [ Math.SQRT1_2, -Math.SQRT1_2 ] };
        if (!whole.ShowScaleBar) return { stretch : { x : length, y : 0, away : [ 1, 0 ] }, lookup : null, slide : null, link : link };
        const at    = Na__LeParamTitle__BarOrigin(config, whole);
        const bar   = Na__LeParamBar__Handles(barConfig, whole);
        const moved = (point, away) => (point ? { x : point.x + at.x, y : point.y + at.y, away : away || point.away } : null);
        if (whole.BarPlacement !== Na__LeParamTitle__PLACE_RIGHT) return { stretch : moved(bar.stretch), lookup : moved(bar.lookup), slide : null, link : link };
        return {
            stretch : moved(bar.lookup,  [ -1, 0 ]),                          // <-- The bar's NEAR end, pointing back at the title: this is the end that lengthens
            lookup  : { x : at.x, y : at.y, away : [ 0, -1 ] },                // <-- Over the near end's top corner, out of the stretch arrow's way
            slide   : moved(bar.stretch, [  1, 0 ]),                           // <-- The FAR end, the one that is put under a corner of the drawing
            link    : link
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Stretch Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    // xMm is from the origin. With its bar below, the grip is the bar's own
    // and xMm is the bar's length: whole divisions. Without a bar it sets the
    // underline's length, in steps.
    //
    // WITH ITS BAR TO THE RIGHT IT RUNS BACKWARDS. The grip is on the bar's
    // NEAR end and the FAR end is held, so what the drag asks for is not the
    // length from the origin but the length from the pointer to that far end
    // - and once the bar has grown to the nearest whole division, the offset
    // is pulled back by however much it grew, which is what keeps the far end
    // where the slide grip put it. A bar that has hit its division limit
    // simply stops; the offset then stops with it.
    // ------------------------------------------------------------
    function Na__LeParamTitle__StretchTo(config, barConfig, params, xMm) {
        const whole = Na__LeParamTitle__Normalise(config, barConfig, params);
        if (!whole.ShowScaleBar) {
            const step = Math.max(0.1, Na__LeParamTitle__Number(config, 'UnderlineStepMm'));
            return Na__LeParamTitle__Normalise(config, barConfig, Object.assign({}, whole, { UnderlineMm : Math.round(xMm / step) * step }));
        }
        if (whole.BarPlacement !== Na__LeParamTitle__PLACE_RIGHT) return Na__LeParamTitle__Normalise(config, barConfig, Object.assign({}, whole, Na__LeParamBar__StretchTo(barConfig, whole, xMm)));
        const farEnd = whole.BarOffsetMm + Na__LeParamBar__PaperMm(barConfig, whole).lengthMm;
        const grown  = Na__LeParamBar__StretchTo(barConfig, whole, farEnd - xMm);
        const wide   = Na__LeParamBar__PaperMm(barConfig, grown).lengthMm;
        return Na__LeParamTitle__Normalise(config, barConfig, Object.assign({}, whole, grown, { BarOffsetMm : farEnd - wide }));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Slide Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    // xMm is where the bar's FAR end is to land, from the origin. The bar
    // keeps its length and its scale and is simply carried there: only
    // BarOffsetMm changes. exact is true when the pointer landed on a snapped
    // vertex of the drawing above, and the far end is then put exactly there;
    // a free drag steps in BarOffsetStepMm instead. Anything without a bar to
    // its right is left alone, so the grips module can call this blind.
    // ------------------------------------------------------------
    function Na__LeParamTitle__SlideTo(config, barConfig, params, xMm, exact) {
        const whole = Na__LeParamTitle__Normalise(config, barConfig, params);
        if (!whole.ShowScaleBar || whole.BarPlacement !== Na__LeParamTitle__PLACE_RIGHT || !Number.isFinite(xMm)) return whole;
        const step  = Math.max(0.1, Na__LeParamTitle__Number(config, 'BarOffsetStepMm'));
        const loose = xMm - Na__LeParamBar__PaperMm(barConfig, whole).lengthMm;
        return Na__LeParamTitle__Normalise(config, barConfig, Object.assign({}, whole, { BarOffsetMm : (exact === true) ? loose : Math.round(loose / step) * step }));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Title's Bar in Words, for the Panel (null with no bar)
    // ------------------------------------------------------------
    function Na__LeParamTitle__Describe(config, barConfig, params) {
        const whole = Na__LeParamTitle__Normalise(config, barConfig, params);
        return whole.ShowScaleBar ? Na__LeParamBar__Describe(barConfig, whole) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Drawing Title's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's DrawingTitle block, getBarConfig() its
    // ScaleBar block and getWords() the viewport identity module's words, each
    // read fresh on every call. facts names the parameters the link module
    // fills from the viewport the title is tied to; hasBar says whether the
    // panel's scale bar settings apply to an element of this type.
    // ------------------------------------------------------------
    function Na__LeParamTitle__CreateType(getConfig, getBarConfig, getWords) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        const bar    = () => ((typeof getBarConfig === 'function' ? getBarConfig() : null) || {});
        const words  = () => ((typeof getWords === 'function' ? getWords() : null) || null);
        return {
            type      : Na__LeParamTitle__TYPE,
            keep      : Na__LeParamTitle__KEEP.slice(),
            facts     : Na__LeParamTitle__FACTS.slice(),
            defaults  : (denominator)        => Na__LeParamTitle__Standard(config(), bar(), denominator),
            normalise : (params)             => Na__LeParamTitle__Normalise(config(), bar(), params),
            build     : (params, tools)      => Na__LeParamTitle__Build(config(), bar(), params, words(), tools),
            handles   : (params, tools)      => Na__LeParamTitle__Handles(config(), bar(), params, words(), tools),
            stretchTo : (params, xMm)        => Na__LeParamTitle__StretchTo(config(), bar(), params, xMm),
            slideTo   : (params, xMm, exact) => Na__LeParamTitle__SlideTo(config(), bar(), params, xMm, exact),
            describe  : (params)             => Na__LeParamTitle__Describe(config(), bar(), params),
            hasBar    : (params)             => Na__LeParamTitle__Normalise(config(), bar(), params).ShowScaleBar === true,
            titleText : (params)             => Na__LeParamTitle__TitleText(config(), bar(), params, words()),
            subdivisionChoices : (params)    => Na__LeParamBar__SubdivisionChoices(bar(), Na__LeParamTitle__Normalise(config(), bar(), params))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Title API
    // ------------------------------------------------------------
    export {
        Na__LeParamTitle__TYPE,
        Na__LeParamTitle__FACTS,
        Na__LeParamTitle__PLACE_BELOW,
        Na__LeParamTitle__PLACE_RIGHT,
        Na__LeParamTitle__PLACES,
        Na__LeParamTitle__Standard,
        Na__LeParamTitle__Normalise,
        Na__LeParamTitle__TitleText,
        Na__LeParamTitle__Build,
        Na__LeParamTitle__Handles,
        Na__LeParamTitle__StretchTo,
        Na__LeParamTitle__SlideTo,
        Na__LeParamTitle__Describe,
        Na__LeParamTitle__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
