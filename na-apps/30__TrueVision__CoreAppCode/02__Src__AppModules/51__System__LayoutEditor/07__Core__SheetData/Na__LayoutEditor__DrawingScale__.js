// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING SCALE
// =============================================================================
//
// FILE       : Na__LayoutEditor__DrawingScale__.js
// NAMESPACE  : Na__LeDrawScale
// MODULE     : Layout Editor - Drawing Scale
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which scale a point on a sheet is drawn at, so vectors and dimensions can be drawn and read at real sizes
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A POINT ON A 2D VIEWPORT is at that viewport's scale: the frontmost
//   visible 2D viewport under it, the same one the Dimension tool attaches a
//   new dimension to. Anywhere else on the sheet it is at THE SHEET'S SCALE.
// - THE SHEET'S SCALE is the scale its 2D viewports share - the scale the
//   title block quotes. When they differ (the title block reads "As shown")
//   it is the scale of the viewports covering the most paper, the sheet's
//   main drawing; when there are none, it is the configured default (1:50).
// - The two rules together keep a vector and a dimension in agreement. A
//   line typed as 2500 over a 1:20 detail is drawn at 1:20, and a dimension
//   placed over that detail measures it at 1:20, so it reads 2500 back; on a
//   sheet with one scale everything is simply at that scale.
// - A DIMENSION'S SCALE. A dimension carries Dimension__AtScale. true reads
//   the drawing's real size: at its viewport's scale while it belongs to a
//   2D viewport, at the sheet's scale otherwise. false reads the paper.
//   A record from before the switch has no key and reads exactly as it
//   always did: at its viewport's scale while it belongs to a 2D viewport,
//   and the paper otherwise.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ turns a dimension's paper length into
//   the value it shows through DimensionDenominator.
// - Na__LayoutEditor__Measurements__ converts typed and shown lengths.
// - The Vectors and Dimensions panels show the scale beside their toggles.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: the viewport under a point, the sheet's scale,
//   and the scale a dimension reads at.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and Viewport Hit Testing
    // ------------------------------------------------------------
    import { Na__LeCfg__GetScaleSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetViewportById } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeHandles__Contains, Na__LeHandles__FrontToBack } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet and Point
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is a Viewport a 2D One With a Usable Scale
    // ------------------------------------------------------------
    function Na__LeDrawScale__IsScaled(viewport) {
        return !!viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D && Number.isFinite(viewport.Viewport__ScaleDenominator) && viewport.Viewport__ScaleDenominator > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet's Scale Denominator
    // ------------------------------------------------------------
    // Every 2D viewport counts, shown or hidden, exactly as the title block's
    // scale does. Among differing scales the one whose viewports cover the
    // most paper wins, and a tie goes to the finer scale.
    // ------------------------------------------------------------
    function Na__LeDrawScale__SheetDenominator(sheet) {
        const viewports = (sheet && Array.isArray(sheet.Sheet__Viewports) ? sheet.Sheet__Viewports : []).filter(Na__LeDrawScale__IsScaled);
        if (!viewports.length) return Na__LeCfg__GetScaleSetup().defaultDenominator;
        const areas = new Map();
        viewports.forEach((viewport) => {
            const frame = viewport.Viewport__FrameMm || {};
            const area  = Math.max(0, (Number(frame.WidthMm) || 0) * (Number(frame.HeightMm) || 0));
            areas.set(viewport.Viewport__ScaleDenominator, (areas.get(viewport.Viewport__ScaleDenominator) || 0) + area);
        });
        let best = null, bestArea = -1;
        areas.forEach((area, denominator) => {
            if (area > bestArea || (area === bestArea && denominator < best)) { best = denominator; bestArea = area; }
        });
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | The 2D Viewport Under a Paper Point, or Null
    // ------------------------------------------------------------
    // The frontmost visible one, which is the one the Dimension tool attaches
    // a dimension to.
    // ------------------------------------------------------------
    function Na__LeDrawScale__ViewportAt(sheet, pointMm) {
        if (!sheet || !pointMm) return null;
        return Na__LeHandles__FrontToBack(sheet).find((viewport) => Na__LeDrawScale__IsScaled(viewport) && Na__LeHandles__Contains(viewport, pointMm)) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Scale a Point on the Sheet Is Drawn At
    // ------------------------------------------------------------
    function Na__LeDrawScale__DenominatorAt(sheet, pointMm) {
        const viewport = Na__LeDrawScale__ViewportAt(sheet, pointMm);
        return viewport ? viewport.Viewport__ScaleDenominator : Na__LeDrawScale__SheetDenominator(sheet);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Denominator as the Title Block Writes It (1:50)
    // ------------------------------------------------------------
    function Na__LeDrawScale__Label(denominator) {
        return Na__LeCfg__GetScaleSetup().labelPrefix + String(denominator);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dimensions
// -----------------------------------------------------------------------------

    // FUNCTION | The 2D Viewport a Dimension Belongs To, or Null
    // ------------------------------------------------------------
    function Na__LeDrawScale__DimensionHost(sheet, dim) {
        if (!sheet || !dim || !dim.Dimension__ViewportId) return null;
        const viewport = Na__LeModel__GetViewportById(sheet, dim.Dimension__ViewportId);
        return Na__LeDrawScale__IsScaled(viewport) ? viewport : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does a Dimension Read the Drawing's Real Size
    // ------------------------------------------------------------
    // The stored switch when there is one. A record from before the switch
    // read the drawing only while it belonged to a 2D viewport.
    // ------------------------------------------------------------
    function Na__LeDrawScale__DimensionAtScale(sheet, dim) {
        if (!dim) return false;
        if (typeof dim.Dimension__AtScale === 'boolean') return dim.Dimension__AtScale;
        return !!Na__LeDrawScale__DimensionHost(sheet, dim);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Dimension's Paper Length Is Multiplied By
    // ------------------------------------------------------------
    // 1 reads the paper. The order keeps every record from before the switch
    // reading exactly what it read: on a 2D viewport its scale, off one the
    // paper - the sheet's scale is only ever used by a dimension that asks
    // for it.
    // ------------------------------------------------------------
    function Na__LeDrawScale__DimensionDenominator(sheet, dim) {
        if (!dim || dim.Dimension__AtScale === false) return 1;                  // <-- The paper, by choice
        const host = Na__LeDrawScale__DimensionHost(sheet, dim);
        if (host) return host.Viewport__ScaleDenominator;                        // <-- On its drawing: that drawing's scale, as always
        if (dim.Dimension__AtScale === true) return Na__LeDrawScale__SheetDenominator(sheet);   // <-- Off every drawing: the sheet's
        return 1;                                                                // <-- A record from before the switch, off any drawing: the paper, as always
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Scale API
    // ------------------------------------------------------------
    export {
        Na__LeDrawScale__SheetDenominator,
        Na__LeDrawScale__ViewportAt,
        Na__LeDrawScale__DenominatorAt,
        Na__LeDrawScale__Label,
        Na__LeDrawScale__DimensionHost,
        Na__LeDrawScale__DimensionAtScale,
        Na__LeDrawScale__DimensionDenominator
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
