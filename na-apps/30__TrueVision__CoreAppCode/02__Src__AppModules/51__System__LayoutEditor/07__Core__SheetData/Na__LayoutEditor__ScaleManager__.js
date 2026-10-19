// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SCALE MANAGER
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScaleManager__.js
// NAMESPACE  : Na__LeScale
// MODULE     : Layout Editor - Scale Manager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Convert between paper millimetres and model millimetres at a locked scale
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - A 2D viewport quotes one denominator from the configured list (D27:
//   1:20, 1:50, 1:100, 1:200). Everything about how much model a frame shows
//   comes from that one number: a frame of W paper mm at 1:N shows W x N
//   model mm.
// - Joinery staff read drawings with a scale rule, so a free factor is never
//   offered; the Viewport panel's toggle buttons step through the list.
// - A site plan viewport has a list of its own, 1:500 and 1:1250 (Scales
//   SitePlanScaleDenominators), and is never coerced onto the architectural one.
// - CUSTOM SCALES (TrueVision v2.177.0). A pack can add scales of its own,
//   1:500 and the like, with the Viewport panel's Add custom scale. They are
//   kept on the drawings block (Na__DrawData__GetCustomScales) and join BOTH
//   lists, in order, so a button for each appears wherever scales are offered.
//   Whole numbers only, 1 to CUSTOM_MAX: still a scale a rule can read.
// - A SCALE IS NEVER QUIETLY THROWN AWAY. A stored scale off the viewport's
//   own list used to be coerced to the default on load, and the next save
//   wrote the default over it. Now any whole scale from 1:1 to CUSTOM_MAX is
//   kept as it is, whichever list it is on or off, so a viewport keeps 1:500
//   before the pack's custom list is known (a browser draft put back, a
//   viewport pasted from another project), or after its button is taken off
//   the list. Only what is not a whole scale takes the default.
//
// INTEGRATION:
// - Viewport2d, the Viewport Settings panel and the PDF exporter read it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ScaleManager__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; the site plan scale list (TrueVision first, 14-Sep-2026); custom scales and the keep-a-whole-scale rule (TrueVision first, 19-Oct-2026).
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.3.0 (TrueVision v2.177.0)
// - Custom scales. ListCustom reads the pack's own scales off the drawings
//   block; ListDenominators merges them into either list, finest first;
//   IsListed counts them; SetCustom writes the list back (the sheet model
//   announces it). CustomValue says whether something typed is a scale:
//   "500" or "1:500", a whole number from 1 to CUSTOM_MAX.
// - Coerce keeps any whole scale from 1:1 to CUSTOM_MAX instead of resetting
//   it to the default, so no stored scale is lost to a list that has not
//   loaded or has changed. (A first cut kept only scales on NO list, and the
//   new test caught it resetting an architectural 1:500, which is on the site
//   plan list, whenever the pack's own list was not yet known.) A side
//   effect, and a fix: PaperToModelMm and ModelToPaperMm, which coerce
//   without a kind, no longer turn a site plan 1:500 into 1:50.
//
// 21-Sep-2026 - Version 1.2.1 (TrueVision)
// - 1:200 joins the architectural list (Scales AvailableScaleDenominators and
//   its fallback). No code here changes: every function reads the list.
//
// 17-Sep-2026 - Version 1.2.0
// - SheetLabel names the paper the scale is true at, and lists a mix rather than
//   hiding it. "1:50 @ ISO A2"; "1:50 & 1:100 @ ISO A2" where the viewports on a
//   sheet disagree, finest first. "As shown" is kept only past SheetLabelMaxScales,
//   where the list would be longer than the title block cell.
// - paperLabel is optional and last, so the PDF metadata caller, which names the
//   paper in a field of its own, is unchanged by passing nothing.
//
// 14-Sep-2026 - Version 1.1.0
// - Site plan scales. ListDenominators and Coerce take a sitePlan flag that reads
//   the site plan list (Scales SitePlanScaleDenominators, else 1:500 and 1:1250).
//   FormatLabel and SheetLabel quote any scale on either list as it is, so a 1:500
//   caption no longer reads 1:50. IsListed says whether a scale is on either list.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetScaleSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetCustomScales, Na__DrawData__SetCustomScales } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';   // <-- The pack's own scales, kept on the drawings block
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What a Custom Scale May Be
    // ------------------------------------------------------------
    // Whole numbers: 1:500 or 1:75, never 1:37.5, which no scale rule carries.
    // The top is far beyond any drawing (1:100,000 is a road atlas); it is
    // there so a typing slip cannot make a viewport show a whole county.
    // ------------------------------------------------------------
    const Na__LeScale__CUSTOM_MIN = 1;
    const Na__LeScale__CUSTOM_MAX = 100000;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Custom Scales
// -----------------------------------------------------------------------------

    // FUNCTION | Is Something a Custom Scale ("500", "1:500" or 500), and Which
    // ------------------------------------------------------------
    // Answers the whole denominator, or null. A leading "1:" is allowed, so
    // a scale can be typed the way it is written on a drawing.
    // ------------------------------------------------------------
    function Na__LeScale__CustomValue(raw) {
        const text = (typeof raw === 'string') ? raw.trim().replace(/^1\s*:\s*/, '') : raw;
        if (text === '' || text === null || text === undefined) return null;
        const n = Number(text);
        return (Number.isInteger(n) && n >= Na__LeScale__CUSTOM_MIN && n <= Na__LeScale__CUSTOM_MAX) ? n : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Pack's Own Scales, Finest First (none until one is added)
    // ------------------------------------------------------------
    // Read off the drawings block every time, so a load, an undo of a load or
    // another project needs no cache to be told about.
    // ------------------------------------------------------------
    function Na__LeScale__ListCustom() {
        const stored = Na__DrawData__GetCustomScales();
        const clean  = [];
        (Array.isArray(stored) ? stored : []).forEach((value) => {
            const d = Na__LeScale__CustomValue(value);
            if (d !== null && clean.indexOf(d) === -1) clean.push(d);
        });
        return clean.sort((a, b) => a - b);
    }
    // ------------------------------------------------------------


    // FUNCTION | Replace the Pack's Own Scales (true when the stored list changed)
    // ------------------------------------------------------------
    // Writes the block only. The sheet model's Add and Remove call this and
    // announce the change, so the panels rebuild and the next save keeps it.
    // ------------------------------------------------------------
    function Na__LeScale__SetCustom(denominators) {
        const clean = (Array.isArray(denominators) ? denominators : []).map(Na__LeScale__CustomValue).filter((d) => d !== null);
        return Na__DrawData__SetCustomScales(clean) === true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A List With the Pack's Own Scales Merged In, Finest First
    // ------------------------------------------------------------
    function Na__LeScale__WithCustom(list) {
        const merged = (Array.isArray(list) ? list : []).slice();
        Na__LeScale__ListCustom().forEach((d) => { if (merged.indexOf(d) === -1) merged.push(d); });
        return merged.sort((a, b) => a - b);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Site Plan Scales and Their Default (config, else 1:500 and 1:1250)
    // ------------------------------------------------------------
    function Na__LeScale__SitePlanSetup() {
        const setup = Na__LeCfg__GetScaleSetup();
        const list  = (Array.isArray(setup.sitePlanDenominators) && setup.sitePlanDenominators.length) ? setup.sitePlanDenominators : [ 500, 1250 ];
        const def   = list.indexOf(setup.sitePlanDefaultDenominator) !== -1 ? setup.sitePlanDefaultDenominator : list[0];
        return { denominators : list, defaultDenominator : def };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Selectable Denominators, Finest First (a site plan viewport has its own list)
    // ------------------------------------------------------------
    // The pack's custom scales join either list, in order.
    // ------------------------------------------------------------
    function Na__LeScale__ListDenominators(sitePlan) {
        return Na__LeScale__WithCustom(sitePlan === true ? Na__LeScale__SitePlanSetup().denominators : Na__LeCfg__GetScaleSetup().denominators);
    }
    // ------------------------------------------------------------


    // FUNCTION | Coerce a Stored Denominator Onto the List
    // ------------------------------------------------------------
    // sitePlan: true reads the site plan list, and says which default a value
    // that is not a scale takes (1:500 for a site plan, else 1:50). A site plan
    // viewport's scale used to land on 1:50 here without a word.
    //
    // ANY WHOLE SCALE IS KEPT (v1.3.0). It may be one the pack added whose list
    // is not known here yet - a browser draft put back over the saved list, a
    // viewport pasted from another project - or one since taken off the list;
    // resetting it would move the drawing on the paper and let the next save
    // write the default over it. So whatever is on this kind's list is kept,
    // and so is any whole scale from 1:1 to CUSTOM_MAX; only what is not a
    // scale at all takes the default.
    // ------------------------------------------------------------
    function Na__LeScale__Coerce(denominator, sitePlan) {
        const setup  = sitePlan === true ? Na__LeScale__SitePlanSetup() : Na__LeCfg__GetScaleSetup();
        const parsed = parseFloat(denominator);
        if (!Number.isFinite(parsed)) return setup.defaultDenominator;
        if (Na__LeScale__ListDenominators(sitePlan).indexOf(parsed) !== -1) return parsed;          // <-- On this kind's list, the pack's custom scales included
        if (Na__LeScale__CustomValue(parsed) !== null) return parsed;                                 // <-- Any whole scale: kept as it is, never reset
        return setup.defaultDenominator;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Denominator on Either List (captions and the title block quote it as it is)
    // ------------------------------------------------------------
    function Na__LeScale__IsListed(denominator) {
        const parsed = parseFloat(denominator);
        return Number.isFinite(parsed)
            && (Na__LeScale__ListDenominators(false).indexOf(parsed) !== -1 || Na__LeScale__ListDenominators(true).indexOf(parsed) !== -1);   // <-- Custom scales count: a 1:500 caption reads 1:500
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Denominator Round the Toggle (wraps)
    // ------------------------------------------------------------
    function Na__LeScale__Next(denominator) {
        const list  = Na__LeScale__ListDenominators(false);
        const index = list.indexOf(Na__LeScale__Coerce(denominator));
        return list[(index + 1) % list.length];
    }
    // ------------------------------------------------------------


    // FUNCTION | Paper Millimetres to Model Millimetres
    // ------------------------------------------------------------
    function Na__LeScale__PaperToModelMm(paperMm, denominator) {
        return paperMm * Na__LeScale__Coerce(denominator);
    }
    // ------------------------------------------------------------


    // FUNCTION | Model Millimetres to Paper Millimetres
    // ------------------------------------------------------------
    function Na__LeScale__ModelToPaperMm(modelMm, denominator) {
        return modelMm / Na__LeScale__Coerce(denominator);
    }
    // ------------------------------------------------------------


    // FUNCTION | Format a Scale for a Caption or the Title Block
    // ------------------------------------------------------------
    function Na__LeScale__FormatLabel(denominator) {
        const setup = Na__LeCfg__GetScaleSetup();
        if (!Number.isFinite(parseFloat(denominator))) return setup.notToScaleLabel;
        return setup.labelPrefix + String(Na__LeScale__IsListed(denominator) ? parseFloat(denominator) : Na__LeScale__Coerce(denominator));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Paper Suffix a Sheet Label Carries ("@ ISO A2")
    // ------------------------------------------------------------
    // A scale only means anything at the paper it was drawn for - 1:50 on A2 and
    // 1:50 on A4 are different drawings - so the cell names both. A Label that
    // already opens with the prefix is left alone, so configuring a paper size as
    // "ISO A2" cannot print "ISO ISO A2".
    // ------------------------------------------------------------
    function Na__LeScale__PaperSuffix(paperLabel, setup) {
        if (setup.sheetShowPaperSize === false) return '';
        const label = String(paperLabel === undefined || paperLabel === null ? '' : paperLabel).trim();
        if (label === '') return '';
        const prefix = String(setup.sheetPaperPrefix || '');
        const named  = (prefix !== '' && label.toUpperCase().indexOf(prefix.trim().toUpperCase()) !== 0) ? prefix + label : label;
        return String(setup.sheetPaperJoiner || ' @ ') + named;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Label a Sheet Quotes, at the Paper It Is Drawn On
    // ------------------------------------------------------------
    // One denominator across every 2D viewport reads as that scale; several list
    // themselves finest first, "1:50 & 1:100", so a reader is told which scales
    // are on the sheet rather than only that it is mixed. Past sheetMaxScales the
    // list is longer than the cell, so the old "As shown" is quoted instead.
    //
    // paperLabel is optional and last: pass it and the label carries the paper
    // size ("1:50 @ ISO A2"); leave it off and this is the scales alone, which is
    // what the PDF metadata wants, since that names the paper in its own field.
    // ------------------------------------------------------------
    function Na__LeScale__SheetLabel(denominators, paperLabel) {
        const setup  = Na__LeCfg__GetScaleSetup();
        const unique = [];
        (denominators || []).forEach((d) => { const c = Na__LeScale__IsListed(d) ? parseFloat(d) : Na__LeScale__Coerce(d); if (unique.indexOf(c) === -1) unique.push(c); });
        const paper  = Na__LeScale__PaperSuffix(paperLabel, setup);

        if (unique.length === 0)                  return setup.notToScaleLabel + paper;       // <-- A 3D-only sheet still says what paper it is
        if (unique.length === 1)                  return Na__LeScale__FormatLabel(unique[0]) + paper;
        if (unique.length > setup.sheetMaxScales) return setup.sheetMixedLabel + paper;

        unique.sort((a, b) => a - b);                                                          // <-- Finest first, the order the scale list itself is held in
        return unique.map((d) => Na__LeScale__FormatLabel(d)).join(setup.sheetScaleSeparator) + paper;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Scale Manager API
    // ------------------------------------------------------------
    export {
        Na__LeScale__CUSTOM_MIN,
        Na__LeScale__CUSTOM_MAX,
        Na__LeScale__CustomValue,
        Na__LeScale__ListCustom,
        Na__LeScale__SetCustom,
        Na__LeScale__ListDenominators,
        Na__LeScale__Coerce,
        Na__LeScale__IsListed,
        Na__LeScale__Next,
        Na__LeScale__PaperToModelMm,
        Na__LeScale__ModelToPaperMm,
        Na__LeScale__FormatLabel,
        Na__LeScale__SheetLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
