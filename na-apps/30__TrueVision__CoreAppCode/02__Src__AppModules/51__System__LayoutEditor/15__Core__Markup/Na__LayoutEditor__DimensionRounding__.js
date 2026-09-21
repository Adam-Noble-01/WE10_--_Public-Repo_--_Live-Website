// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DIMENSION ROUNDING
// =============================================================================
//
// FILE       : Na__LayoutEditor__DimensionRounding__.js
// NAMESPACE  : Na__LeDimRound
// MODULE     : Layout Editor - Dimension Rounding
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Round a dimension's figure UP to the next step (5 mm), and say whether that moved it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ROUND UP, NEVER DOWN. A dimension set to round up (Dimension__RoundUp,
//   the Dimensions panel's Round up to 5 mm) shows the next multiple of the
//   step at or above its figure: 6,413 reads 6,415, 6,416 reads 6,420. A
//   size on a drawing is then never smaller than what was measured.
// - IT ROUNDS THE FIGURE THE DIMENSION WOULD PRINT, not the raw number. A
//   dimension reading 2,810 at 0 decimals may really measure 2,810.0000004 -
//   a snapped point carries that much noise through the scale. Rounding the
//   raw number would take it to 2,815 and mark it, over a size that reads
//   exactly 2,810. The figure at the dimension's own decimals is what the
//   drawing claims, so that is what goes up to the step.
// - ROUNDED SAYS WHETHER THE FIGURE MOVED. A figure already on a multiple of
//   the step is exact and is not marked; only a figure the rounding actually
//   raised carries the marker (the asterisk), so a marked size is always one
//   that was rounded.
// - A pure leaf: imports nothing, so it can be tested on its own.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ FormatDimension, the one place a sheet
//   dimension's text is made: the sheet, the PDF, the selection box, the
//   inline editor and the Dimensions panel all read it from there.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026).
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: round a dimension up to the nearest 5 mm.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Precision Limits and the Floating Point Allowance
    // ------------------------------------------------------------
    const Na__LeDimRound__MAX_DECIMALS = 3;       // <-- As FormatDimension clamps a record's Dimension__Precision
    const Na__LeDimRound__EPSILON      = 1e-9;    // <-- 6415 / 5 must count as 1283, not a hair over it
    const Na__LeDimRound__CLEAN        = 1e6;     // <-- A step of 2.5 or 0.5 times a whole number, tidied back to what it is
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rounding
// -----------------------------------------------------------------------------

    // FUNCTION | A Figure Rounded Up to the Next Step
    // ------------------------------------------------------------
    // valueMm   : what the dimension measures (its sign is dropped, as the
    //             figure's is)
    // precision : the decimals the dimension prints at
    // stepMm    : the step to round up to (5)
    // Returns { valueMm, rounded }: the figure to print, and whether rounding
    // raised it. A step that is not a number above zero rounds nothing.
    // ------------------------------------------------------------
    function Na__LeDimRound__Up(valueMm, precision, stepMm) {
        const decimals = Math.max(0, Math.min(Na__LeDimRound__MAX_DECIMALS, Math.round(Number.isFinite(precision) ? precision : 0)));
        const shown    = Number(Math.abs(Number.isFinite(valueMm) ? valueMm : 0).toFixed(decimals));   // <-- The figure the dimension would print
        if (!(typeof stepMm === 'number' && Number.isFinite(stepMm) && stepMm > 0)) return { valueMm : shown, rounded : false };
        const steps    = Math.ceil((shown / stepMm) - Na__LeDimRound__EPSILON);
        const up       = Math.round(steps * stepMm * Na__LeDimRound__CLEAN) / Na__LeDimRound__CLEAN;
        return up > shown + Na__LeDimRound__EPSILON
            ? { valueMm : up,    rounded : true  }
            : { valueMm : shown, rounded : false };                                                 // <-- Already on the step: exact, and not marked
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dimension Rounding API
    // ------------------------------------------------------------
    export {
        Na__LeDimRound__Up
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
