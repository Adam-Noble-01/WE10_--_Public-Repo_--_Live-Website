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
//   1:20, 1:50, 1:100). Everything about how much model a frame shows comes
//   from that one number: a frame of W paper mm at 1:N shows W x N model mm.
// - Joinery staff read drawings with a scale rule, so a free factor is never
//   offered; the three-way toggle steps through the list.
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
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetScaleSetup } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Selectable Denominators, Finest First
    // ------------------------------------------------------------
    function Na__LeScale__ListDenominators() {
        return Na__LeCfg__GetScaleSetup().denominators.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Coerce a Stored Denominator Onto the List
    // ------------------------------------------------------------
    function Na__LeScale__Coerce(denominator) {
        const setup  = Na__LeCfg__GetScaleSetup();
        const parsed = parseFloat(denominator);
        if (Number.isFinite(parsed) && setup.denominators.indexOf(parsed) !== -1) return parsed;
        return setup.defaultDenominator;
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
        return setup.labelPrefix + String(Na__LeScale__Coerce(denominator));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Label a Sheet Quotes When Its Viewports Disagree
    // ------------------------------------------------------------
    // One denominator across every 2D viewport reads as that scale; a mix
    // reads "As shown", which is what the office writes in that case.
    // ------------------------------------------------------------
    function Na__LeScale__SheetLabel(denominators) {
        const setup  = Na__LeCfg__GetScaleSetup();
        const unique = [];
        (denominators || []).forEach((d) => { const c = Na__LeScale__Coerce(d); if (unique.indexOf(c) === -1) unique.push(c); });
        if (unique.length === 0) return setup.notToScaleLabel;
        if (unique.length === 1) return Na__LeScale__FormatLabel(unique[0]);
        return 'As shown';
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
        Na__LeScale__Next,
        Na__LeScale__PaperToModelMm,
        Na__LeScale__ModelToPaperMm,
        Na__LeScale__FormatLabel,
        Na__LeScale__SheetLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
