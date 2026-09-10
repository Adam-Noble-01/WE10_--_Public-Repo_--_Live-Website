// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - GRIPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Grips__.js
// NAMESPACE  : Na__LeGrips
// MODULE     : Layout Editor - Grips
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The visible grips on a selected dimension or shape, which grip a press lands on, and the rubber band the placing tools stretch
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - A selected dimension shows a square grip at each measured point and a
//   round grip on the dimension line: the squares re-pick the points (they
//   snap to the linework), the round one slides the line away from or
//   towards what it measures and infers other dimension lines.
// - A selected shape shows a square grip at every vertex.
// - Grips are counter-scaled so they stay the same size on screen at any
//   zoom, like the viewport handles.
// - The rubber band is one dashed line in the handles layer, shared by the
//   dimension and the shape tools. It takes the locked axis's colour
//   while an arrow key holds the edge to an axis.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetSurface__ renders the grips into the handles
//   layer; Na__LayoutEditor__SheetTools__ asks what a press grabbed; the
//   dimension and shape tools stretch the band.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Grips__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - ShowBand takes the locked axis and colours the band by it.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Markup and Shape Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__IsLayerLocked } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__DimensionSkeleton } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__VertexAt } from './Na__LayoutEditor__ShapeGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Rubber Band
    // ------------------------------------------------------------
    let Na__LeGrips__Band = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Grip Element
    // ------------------------------------------------------------
    function Na__LeGrips__Add(layer, xMm, yMm, ppm, sizePx, zoom, modifier) {
        const grip = document.createElement('div');
        grip.className = 'na-le-grip' + (modifier ? ' na-le-grip--' + modifier : '');
        grip.style.left   = ((xMm * ppm) - (sizePx / 2)) + 'px';
        grip.style.top    = ((yMm * ppm) - (sizePx / 2)) + 'px';
        grip.style.width  = sizePx + 'px';
        grip.style.height = sizePx + 'px';
        grip.style.borderWidth = Math.max(1, 1 / zoom) + 'px';
        layer.appendChild(grip);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Grips for the Selection (nothing for a viewport or a locked layer)
    // ------------------------------------------------------------
    function Na__LeGrips__Render(layer, sheet, selection, ppm, zoom) {
        if (!layer || !sheet || !selection) return false;
        const sizePx = Na__LeCfg__GetSelectionSetup().gripSizePx / zoom;      // <-- Constant on screen at any zoom
        if (selection.kind === 'dimension') {
            const dim = sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === selection.id);
            if (!dim || Na__LeModel__IsLayerLocked(sheet, dim.Dimension__LayerId)) return false;
            const sk = Na__LeMarkup__DimensionSkeleton(dim);
            if (!sk) return false;
            Na__LeGrips__Add(layer, sk.S.x, sk.S.y, ppm, sizePx, zoom, null);
            Na__LeGrips__Add(layer, sk.E.x, sk.E.y, ppm, sizePx, zoom, null);
            Na__LeGrips__Add(layer, sk.MID.x, sk.MID.y, ppm, sizePx, zoom, 'offset');
            return true;
        }
        if (selection.kind === 'shape') {
            const shape = sheet.Sheet__Shapes.find((s) => s.Shape__Id === selection.id);
            if (!shape || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return false;
            Na__LeShapeGeo__Points(shape).forEach((p) => Na__LeGrips__Add(layer, p[0], p[1], ppm, sizePx, zoom, null));
            return true;
        }
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rubber Band
// -----------------------------------------------------------------------------

    // FUNCTION | Stretch the Band Between Two Paper Points ({ x, y } or [x, y])
    // ------------------------------------------------------------
    // axis is the locked axis, if any: the band takes that axis's colour
    // so the lock is visible without reading anything.
    // ------------------------------------------------------------
    function Na__LeGrips__ShowBand(start, end, axis) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer) return false;
        const sx = Array.isArray(start) ? start[0] : start.x, sy = Array.isArray(start) ? start[1] : start.y;
        const ex = Array.isArray(end)   ? end[0]   : end.x,   ey = Array.isArray(end)   ? end[1]   : end.y;
        if (!Na__LeGrips__Band) {
            Na__LeGrips__Band = document.createElement('div');
        }
        Na__LeGrips__Band.className = 'na-le-rubber-band' + (axis ? ' na-le-rubber-band--' + axis : '');
        if (Na__LeGrips__Band.parentNode !== layer) layer.appendChild(Na__LeGrips__Band);
        const ppm = Na__LeSurface__GetPixelsPerMm();
        const len = Math.hypot(ex - sx, ey - sy);
        const ang = Math.atan2(ey - sy, ex - sx) * (180 / Math.PI);
        Na__LeGrips__Band.style.left      = (sx * ppm) + 'px';
        Na__LeGrips__Band.style.top       = (sy * ppm) + 'px';
        Na__LeGrips__Band.style.width     = (len * ppm) + 'px';
        Na__LeGrips__Band.style.transform = 'rotate(' + ang + 'deg)';
        Na__LeGrips__Band.hidden = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Band Away
    // ------------------------------------------------------------
    function Na__LeGrips__HideBand() {
        if (Na__LeGrips__Band && Na__LeGrips__Band.parentNode) Na__LeGrips__Band.parentNode.removeChild(Na__LeGrips__Band);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Testing
// -----------------------------------------------------------------------------

    // FUNCTION | Which Part of a Dimension a Press Grabs
    // ------------------------------------------------------------
    // 'start' and 'end' are the measured points, 'offset' the dimension
    // line (its round grip or anywhere along it), else 'whole'.
    // ------------------------------------------------------------
    function Na__LeGrips__DimensionGrab(dim, pointMm, toleranceMm) {
        const tol = toleranceMm * 2;
        if (Math.hypot(pointMm.x - dim.Dimension__StartXMm, pointMm.y - dim.Dimension__StartYMm) <= tol) return 'start';
        if (Math.hypot(pointMm.x - dim.Dimension__EndXMm,   pointMm.y - dim.Dimension__EndYMm)   <= tol) return 'end';
        const sk = Na__LeMarkup__DimensionSkeleton(dim);
        if (sk) {
            if (Math.hypot(pointMm.x - sk.MID.x, pointMm.y - sk.MID.y) <= tol) return 'offset';
            const abx = sk.DE.x - sk.DS.x, aby = sk.DE.y - sk.DS.y, len2 = (abx * abx) + (aby * aby);
            const t = len2 > 0 ? (((pointMm.x - sk.DS.x) * abx) + ((pointMm.y - sk.DS.y) * aby)) / len2 : 0;
            const cx = sk.DS.x + (abx * Math.max(0, Math.min(1, t))), cy = sk.DS.y + (aby * Math.max(0, Math.min(1, t)));
            if (Math.hypot(pointMm.x - cx, pointMm.y - cy) <= toleranceMm) return 'offset';
        }
        return 'whole';
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Part of a Shape a Press Grabs
    // ------------------------------------------------------------
    // Returns { mode : 'vertex', index } or { mode : 'whole' }.
    // ------------------------------------------------------------
    function Na__LeGrips__ShapeGrab(shape, pointMm, toleranceMm) {
        const index = Na__LeShapeGeo__VertexAt(shape, pointMm, toleranceMm * 2);
        return index >= 0 ? { mode : 'vertex', index : index } : { mode : 'whole', index : -1 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Grips API
    // ------------------------------------------------------------
    export {
        Na__LeGrips__Render,
        Na__LeGrips__ShowBand,
        Na__LeGrips__HideBand,
        Na__LeGrips__DimensionGrab,
        Na__LeGrips__ShapeGrab
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
