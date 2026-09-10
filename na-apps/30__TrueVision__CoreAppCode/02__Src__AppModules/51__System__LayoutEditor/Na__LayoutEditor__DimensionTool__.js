// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DIMENSION TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__DimensionTool__.js
// NAMESPACE  : Na__LeDim
// MODULE     : Layout Editor - Dimension Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place a sheet dimension in three clicks, slide its line with inference to other dimensions, and edit the value it shows
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - THREE CLICKS, as in CAD. The first picks the start, the second the
//   end (both snap to the linework; Shift holds the span to the nearer
//   axis and an arrow key locks it to one outright), and the dimension
//   appears at once with its line following the cursor. The third click
//   fixes how far the line sits from what it measures.
// - INFERENCE. While the line moves, a parallel dimension nearby pulls it
//   onto its own line, so a run of dimensions lines up. The same happens
//   when the round grip of an existing dimension is dragged.
// - The value can be overridden inline: double-click the dimension and
//   type. Typing the measured value back clears the override.
// - The dimension joins the frontmost 2D viewport under its midpoint, so
//   it measures the model at that viewport's scale.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and delegates here.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__DimensionTool__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Arrow key axis lock on the span (Na__LayoutEditor__AxisLock__), which
//   beats a snap by taking the snapped point's free coordinate, and
//   releases as soon as the point lands.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Snapping, Text Field
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDimensionSetup, Na__LeCfg__GetSelectionSetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__CreateDimension,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension,
        Na__LeModel__SetSelection
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeHandles__Contains, Na__LeHandles__FrontToBack } from './Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeMarkup__DimensionSkeleton, Na__LeMarkup__DimensionValueMm, Na__LeMarkup__FormatDimension } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeDimGeo__TextPlacement } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeChrome__MeasureTextMm } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeAxis__Get, Na__LeAxis__Clear, Na__LeAxis__Apply, Na__LeAxis__Constrain } from './Na__LayoutEditor__AxisLock__.js';
    import { Na__LeText__OpenField } from './Na__LayoutEditor__TextTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Inference
    // ------------------------------------------------------------
    const Na__LeDim__PARALLEL_DOT = 0.9995;        // <-- Two dimensions are parallel when their directions agree this closely
    const Na__LeDim__INFER_KIND   = 'infer';       // <-- Marker style for an inferred line
    // ------------------------------------------------------------

    // MODULE VARIABLES | Placement in Progress
    // ------------------------------------------------------------
    let Na__LeDim__Placement = null;   // <-- { phase : 1 | 2, startMm, endMm, id }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where the Span Ends: a Lock, Then a Snap, Then Shift
    // ------------------------------------------------------------
    // An arrow key lock wins outright, but takes the free coordinate from
    // whatever the cursor snapped to, so a span locked across the paper
    // still measures to the vertex under the cursor. With no lock a snap
    // beats Shift, as in AutoCAD.
    // ------------------------------------------------------------
    function Na__LeDim__SnapOrConstrain(sheet, start, point, shift) {
        const snap = Na__LeOsnap__Snap(sheet, point);
        const at   = snap.snapped ? { x : snap.x, y : snap.y } : point;
        if (Na__LeAxis__Get()) return Na__LeAxis__Apply(start, at);
        if (snap.snapped) return at;
        return Na__LeAxis__Constrain(start, point, shift);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Offset a Cursor Position Asks For, Pulled Onto a Parallel Dimension's Line When Near It
    // ------------------------------------------------------------
    // Returns { offsetMm, inferred (the other line's offset or null), foot (where the marker sits) }.
    // ------------------------------------------------------------
    function Na__LeDim__OffsetFor(sheet, dim, pointMm) {
        const sx = dim.Dimension__StartXMm, sy = dim.Dimension__StartYMm;
        const dx = dim.Dimension__EndXMm - sx, dy = dim.Dimension__EndYMm - sy;
        const len = Math.hypot(dx, dy);
        if (!(len > 0)) return { offsetMm : dim.Dimension__OffsetMm, inferred : null, foot : { x : pointMm.x, y : pointMm.y } };
        const dirX = dx / len, dirY = dy / len, perpX = -dirY, perpY = dirX;
        let offset = ((pointMm.x - sx) * perpX) + ((pointMm.y - sy) * perpY);

        // INFERENCE | A parallel dimension whose line is within the radius wins
        const radiusMm = Na__LeCfg__GetDimensionSetup().inferenceRadiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        let inferred = null, bestGap = radiusMm;
        sheet.Sheet__Dimensions.forEach((other) => {
            if (other.Dimension__Id === dim.Dimension__Id || !Na__LeModel__IsLayerVisible(sheet, other.Dimension__LayerId)) return;
            const sk = Na__LeMarkup__DimensionSkeleton(other);
            if (!sk || Math.abs((sk.dirX * dirX) + (sk.dirY * dirY)) < Na__LeDim__PARALLEL_DOT) return;
            const d   = ((sk.DS.x - sx) * perpX) + ((sk.DS.y - sy) * perpY);   // <-- Where its line sits, measured from our span
            const gap = Math.abs(d - offset);
            if (gap <= bestGap) { bestGap = gap; inferred = d; }
        });
        if (inferred !== null) offset = inferred;
        const along = ((pointMm.x - sx) * dirX) + ((pointMm.y - sy) * dirY);
        return {
            offsetMm : offset, inferred : inferred,
            foot     : { x : sx + (dirX * along) + (perpX * offset), y : sy + (dirY * along) + (perpY * offset) }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Inference Marker, or Hide It
    // ------------------------------------------------------------
    function Na__LeDim__ShowInference(result) {
        if (result && result.inferred !== null) Na__LeOsnap__ShowMarker({ x : result.foot.x, y : result.foot.y, kind : Na__LeDim__INFER_KIND });
        else Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // FUNCTION | A Click With the Dimension Tool
    // ------------------------------------------------------------
    // defaults: { offsetMm, textSizeMm, colour, terminator, precision, unitsSuffix }
    // ------------------------------------------------------------
    function Na__LeDim__Click(sheet, pointMm, shift, defaults) {
        const p = Na__LeDim__Placement;
        if (!p) {
            const first = Na__LeOsnap__Snap(sheet, pointMm);
            Na__LeDim__Placement = { phase : 1, startMm : { x : first.x, y : first.y }, endMm : null, id : null };
            Na__LeAxis__Clear();                                              // <-- The point landed: the lock is spent
            Na__LeGrips__ShowBand(Na__LeDim__Placement.startMm, Na__LeDim__Placement.startMm, null);
            return true;
        }
        if (p.phase === 1) {
            const end = Na__LeDim__SnapOrConstrain(sheet, p.startMm, pointMm, shift);
            if (Math.hypot(end.x - p.startMm.x, end.y - p.startMm.y) < Na__LeCfg__GetSelectionSetup().dragThresholdMm) return false;   // <-- Not a span yet
            const mid  = { x : (p.startMm.x + end.x) / 2, y : (p.startMm.y + end.y) / 2 };
            const host = Na__LeHandles__FrontToBack(sheet).find((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && Na__LeHandles__Contains(v, mid)) || null;
            const d    = defaults || {};
            const item = Na__LeModel__CreateDimension(sheet, p.startMm, end, {
                viewportId : host ? host.Viewport__Id : null, offsetMm : d.offsetMm, textSizeMm : d.textSizeMm,
                colour : d.colour, terminator : d.terminator, precision : d.precision, unitsSuffix : d.unitsSuffix, silent : true
            });
            Na__LeAxis__Clear();
            Na__LeGrips__HideBand();
            Na__LeOsnap__HideMarker();
            if (!item) { Na__LeDim__Placement = null; return false; }
            p.phase = 2; p.endMm = end; p.id = item.Dimension__Id;
            Na__LeSurface__Refresh('markup');
            return true;
        }
        // THIRD CLICK | The line stays where the cursor put it
        const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id);
        Na__LeDim__Placement = null;
        Na__LeAxis__Clear();
        Na__LeOsnap__HideMarker();
        if (!dim) return false;
        const result = Na__LeDim__OffsetFor(sheet, dim, pointMm);
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { offsetMm : result.offsetMm }, false);   // <-- One announcement: one history step
        Na__LeModel__SetSelection({ kind : 'dimension', id : dim.Dimension__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Dimension Tool
    // ------------------------------------------------------------
    function Na__LeDim__Move(sheet, pointMm, shift) {
        const p = Na__LeDim__Placement;
        if (!p) { Na__LeOsnap__Snap(sheet, pointMm); return false; }        // <-- Marker before the first click
        if (p.phase === 1) { Na__LeGrips__ShowBand(p.startMm, Na__LeDim__SnapOrConstrain(sheet, p.startMm, pointMm, shift), Na__LeAxis__Get()); return true; }
        const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id);
        if (!dim) { Na__LeDim__Placement = null; return false; }
        const result = Na__LeDim__OffsetFor(sheet, dim, pointMm);
        Na__LeDim__ShowInference(result);
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { offsetMm : result.offsetMm }, true);
        Na__LeSurface__Refresh('markup');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon a Half-Placed Dimension
    // ------------------------------------------------------------
    function Na__LeDim__Cancel(sheet) {
        const p = Na__LeDim__Placement;
        Na__LeDim__Placement = null;
        Na__LeAxis__Clear();
        Na__LeGrips__HideBand();
        Na__LeOsnap__HideMarker();
        if (p && p.phase === 2 && sheet) Na__LeModel__DeleteDimension(sheet, p.id);   // <-- Never announced as created, so nothing to undo
        return !!p;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Placement in Progress
    // ------------------------------------------------------------
    function Na__LeDim__IsPlacing() { return !!Na__LeDim__Placement; }
    // ------------------------------------------------------------


    // FUNCTION | Is the Span Being Picked (the phase an axis lock applies to)
    // ------------------------------------------------------------
    function Na__LeDim__IsSpanning() { return !!Na__LeDim__Placement && Na__LeDim__Placement.phase === 1; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Inline Value
// -----------------------------------------------------------------------------

    // FUNCTION | Open a Field Over the Dimension's Value
    // ------------------------------------------------------------
    function Na__LeDim__BeginTextEdit(dimId) {
        const sheet = Na__LeModel__GetActiveSheet();
        const dim   = sheet ? sheet.Sheet__Dimensions.find((d) => d.Dimension__Id === dimId) : null;
        const sk    = dim ? Na__LeMarkup__DimensionSkeleton(dim) : null;
        if (!dim || !sk) return false;
        const valueMm  = Na__LeMarkup__DimensionValueMm(sheet, dim);
        const measured = Na__LeMarkup__FormatDimension(Object.assign({}, dim, { Dimension__OverrideText : null }), valueMm);
        const shown    = Na__LeMarkup__FormatDimension(dim, valueMm);
        const fontMm   = dim.Dimension__TextSizeMm;
        const widthMm  = Math.max(fontMm * 4, Na__LeChrome__MeasureTextMm(shown, fontMm, 400));
        const place    = Na__LeDimGeo__TextPlacement(sk, Na__LeCfg__GetDimensionSetup().textGapMm);
        return Na__LeText__OpenField({
            xMm : place.x - (widthMm / 2), yMm : place.y - fontMm, widthMm : widthMm, fontMm : fontMm, weight : 400,
            colour : dim.Dimension__Colour, align : 'center', value : shown,
            onCommit : (text) => {
                const live = Na__LeModel__GetActiveSheet();
                if (!live) return;
                const override = (text === '' || text === measured) ? '' : text;   // <-- The measured value typed back clears the override
                Na__LeModel__UpdateDimension(live, dimId, { overrideText : override }, false);
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Dimension Tool API
    // ------------------------------------------------------------
    export {
        Na__LeDim__Click,
        Na__LeDim__Move,
        Na__LeDim__Cancel,
        Na__LeDim__IsPlacing,
        Na__LeDim__IsSpanning,
        Na__LeDim__OffsetFor,
        Na__LeDim__ShowInference,
        Na__LeDim__BeginTextEdit
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
