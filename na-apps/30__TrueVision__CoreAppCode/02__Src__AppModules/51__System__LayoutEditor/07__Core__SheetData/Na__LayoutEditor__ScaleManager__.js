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
// - Divergences   : Console prefix, header and folder numbers; the site plan scale list (TrueVision first, 14-Sep-2026).
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    function Na__LeScale__ListDenominators(sitePlan) {
        return (sitePlan === true ? Na__LeScale__SitePlanSetup().denominators : Na__LeCfg__GetScaleSetup().denominators).slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Coerce a Stored Denominator Onto the List
    // ------------------------------------------------------------
    // sitePlan: true reads the site plan list. A site plan viewport's scale used
    // to land on 1:50 here without a word; now it keeps 1:500 or 1:1250, and an
    // architectural viewport never takes a site plan scale.
    // ------------------------------------------------------------
    function Na__LeScale__Coerce(denominator, sitePlan) {
        const setup  = sitePlan === true ? Na__LeScale__SitePlanSetup() : Na__LeCfg__GetScaleSetup();
        const parsed = parseFloat(denominator);
        if (Number.isFinite(parsed) && setup.denominators.indexOf(parsed) !== -1) return parsed;
        return setup.defaultDenominator;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Denominator on Either List (captions and the title block quote it as it is)
    // ------------------------------------------------------------
    function Na__LeScale__IsListed(denominator) {
        const parsed = parseFloat(denominator);
        return Number.isFinite(parsed)
            && (Na__LeCfg__GetScaleSetup().denominators.indexOf(parsed) !== -1 || Na__LeScale__SitePlanSetup().denominators.indexOf(parsed) !== -1);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Denominator Round the Toggle (wraps)
    // ------------------------------------------------------------
    function Na__LeScale__Next(denominator) {
        const list  = Na__LeCfg__GetScaleSetup().denominators;
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
