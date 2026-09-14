// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DIMENSION TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__DimensionTool__.js
// NAMESPACE  : Na__LeDim
// MODULE     : Layout Editor - Dimension Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place a sheet dimension in three clicks, aligned or ortho, slide its line with inference to other dimensions, and edit the value it shows
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - THREE CLICKS, as in CAD. The first picks the start, the second the
//   end (both snap to the linework; an arrow key locks the span to one
//   axis), and the dimension appears at once with its line following the
//   cursor. The third click fixes how far the line sits from what it
//   measures.
// - SHIFT MAKES IT ORTHO. Hold Shift while the line follows the cursor and
//   the dimension runs horizontal or vertical, whatever its two points are:
//   drag the line above or below them for a horizontal dimension, which
//   measures the x distance between them, or beside them for a vertical one,
//   which measures the y. Let go of Shift and it is aligned again; pressing
//   or releasing it redraws at once. Without it, two points at different
//   heights - the eaves of one wall and the foot of the next - could only be
//   given a sloping dimension.
// - INFERENCE. While the line moves, a parallel dimension nearby pulls it
//   onto its own line, so a run of dimensions lines up - an ortho one with
//   any other dimension running the same way. The same happens when the
//   round grip of an existing dimension is dragged.
// - TYPED DISTANCES (Na__LayoutEditor__Measurements__). After the first
//   click, a length typed into the Measurements box picks the end exactly
//   that far along the band, standing in for the second click. While the
//   line follows the cursor, a typed distance puts the line that far from
//   what it measures, on the cursor's side, and finishes as the third click
//   would. Both arrive in paper millimetres; the span asks its caller for the
//   length at the scale of the drawing its midpoint lands on, the drawing the
//   dimension will belong to.
// - AT SCALE. A new dimension takes the Dimensions panel's Measure at scale
//   setting as Dimension__AtScale (Na__LayoutEditor__DrawingScale__).
// - The value can be overridden inline: double-click the dimension and
//   type. Typing the measured value back clears the override.
// - The dimension joins the frontmost 2D viewport under its midpoint, so
//   it measures the model at that viewport's scale.
// - Its snap and inference markers are orange, the dimension tone; the Draw
//   and Rectangle tools snap in blue and a carried viewport in purple.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and the keys and
//   delegates here; it runs Move again when Shift goes down or up.
// - Na__LayoutEditor__DimensionGeometry__ owns the orientation maths.
// - Na__LayoutEditor__Measurements__ reads the placement (Measure) and hands
//   it typed distances (TypeSpan, TypeOffset).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__DimensionTool__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim to 1.1.0
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
// - Ahead         : 1.2.0 (Shift ortho, the dimension snap tone) was authored here
//                   first, 13-Sep-2026; the ValeVision back-port waits for Adam's sign-off
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.4.0
// - A new dimension takes the Dimensions panel's extension line lengths and
//   the padlock between them (startExtensionMm, endExtensionMm,
//   extensionsLinked), so its lines are already short while its line follows
//   the cursor.
//
// 14-Sep-2026 - Version 1.3.0
// - Typed distances: the band's end and the cursor are kept while placing;
//   Measure reports the placement, TypeSpan picks the end a typed length along
//   the band and TypeOffset sets the line's distance and finishes. The second
//   click and TypeSpan create the dimension the same way (Span).
// - A new dimension carries the atScale default (Dimension__AtScale).
//
// 13-Sep-2026 - Version 1.2.0
// - Shift makes the dimension ortho while its line is placed: horizontal or
//   vertical by the side of its points the line is dragged to, kept on the
//   record as Dimension__Orientation. The offset and the inference are
//   measured across the orientation's own direction.
// - Shift no longer bends the span to an axis while the end is picked. The end
//   lands on the point that was picked, because an ortho dimension measures one
//   axis whatever the span; an arrow key still locks the span outright.
// - Snap and inference markers are drawn in the dimension tone (orange).
// - IsPlacingLine: whether the line is following the cursor, for the sheet
//   tools' Shift redraw.
//
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

    // MODULE IMPORTS | Config, Model, Surface, Handles, Markup, Geometry, Snapping, Text Field
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
    import { Na__LeDimGeo__ALIGNED, Na__LeDimGeo__Frame, Na__LeDimGeo__OrthoToward, Na__LeDimGeo__TextPlacement } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeChrome__MeasureTextMm } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeOsnap__TONE_DIMENSION, Na__LeOsnap__Snap, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrips__ShowBand, Na__LeGrips__HideBand } from './Na__LayoutEditor__Grips__.js';
    import { Na__LeAxis__Get, Na__LeAxis__Clear, Na__LeAxis__Apply } from './Na__LayoutEditor__AxisLock__.js';
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

    // MODULE CONSTANTS | Typed Distances
    // ------------------------------------------------------------
    const Na__LeDim__TYPED_MIN_MM = 1e-4;          // <-- A typed span shorter than this (paper mm) is no span, and a band this short no direction
    const Na__LeDim__TYPED_PASSES = 3;             // <-- How often a typed span re-reads the scale where its midpoint lands
    // ------------------------------------------------------------

    // MODULE VARIABLES | Placement in Progress
    // ------------------------------------------------------------
    let Na__LeDim__Placement = null;   // <-- { phase : 1 | 2, startMm, endMm, id, aim : { x, y } the band's end, cursor : { x, y } the line's cursor }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where the Span Ends: a Snap, Then a Lock
    // ------------------------------------------------------------
    // An arrow key lock wins outright, but takes the free coordinate from
    // whatever the cursor snapped to, so a span locked across the paper
    // still measures to the vertex under the cursor. Shift has no say here:
    // it makes the finished dimension ortho instead, and an ortho dimension
    // measures one axis whatever the span, so bending the span to an axis
    // would only move the end off the point that was picked.
    // ------------------------------------------------------------
    function Na__LeDim__SnapOrLock(sheet, start, point) {
        const snap = Na__LeOsnap__Snap(sheet, point, null, Na__LeOsnap__TONE_DIMENSION);
        const at   = snap.snapped ? { x : snap.x, y : snap.y } : { x : point.x, y : point.y };
        return Na__LeAxis__Get() ? Na__LeAxis__Apply(start, at) : at;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Orientation the Line Asks For: Ortho While Shift Is Held, Aligned Otherwise
    // ------------------------------------------------------------
    function Na__LeDim__OrientationFor(dim, pointMm, shift) {
        if (!shift) return Na__LeDimGeo__ALIGNED;
        return Na__LeDimGeo__OrthoToward(
            { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
            { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
            pointMm, dim.Dimension__Orientation, Na__LeCfg__GetSelectionSetup().dragThresholdMm
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | The Offset a Cursor Position Asks For, Pulled Onto a Parallel Dimension's Line When Near It
    // ------------------------------------------------------------
    // Measured from the start across the direction the dimension runs, so an
    // ortho line slides straight up and down, or across, whatever its points.
    // Returns { offsetMm, inferred (the other line's offset or null), foot (where the marker sits) }.
    // ------------------------------------------------------------
    function Na__LeDim__OffsetFor(sheet, dim, pointMm) {
        const sx = dim.Dimension__StartXMm, sy = dim.Dimension__StartYMm;
        const frame = Na__LeDimGeo__Frame({ x : sx, y : sy }, { x : dim.Dimension__EndXMm, y : dim.Dimension__EndYMm }, dim.Dimension__Orientation);
        if (!frame) return { offsetMm : dim.Dimension__OffsetMm, inferred : null, foot : { x : pointMm.x, y : pointMm.y } };
        const dirX = frame.dirX, dirY = frame.dirY, perpX = frame.perpX, perpY = frame.perpY;
        let offset = ((pointMm.x - sx) * perpX) + ((pointMm.y - sy) * perpY);

        // INFERENCE | A parallel dimension whose line is within the radius wins
        const radiusMm = Na__LeCfg__GetDimensionSetup().inferenceRadiusPx / (Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());
        let inferred = null, bestGap = radiusMm;
        sheet.Sheet__Dimensions.forEach((other) => {
            if (other.Dimension__Id === dim.Dimension__Id || !Na__LeModel__IsLayerVisible(sheet, other.Dimension__LayerId)) return;
            const sk = Na__LeMarkup__DimensionSkeleton(other);
            if (!sk || Math.abs((sk.dirX * dirX) + (sk.dirY * dirY)) < Na__LeDim__PARALLEL_DOT) return;
            const d   = ((sk.DS.x - sx) * perpX) + ((sk.DS.y - sy) * perpY);   // <-- Where its line sits, measured from our start
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


    // HELPER FUNCTION | Orientation and Offset Together for a Cursor Position
    // ------------------------------------------------------------
    // The orientation is settled first: it decides which way the offset is
    // measured and which other dimensions count as parallel.
    // Returns { orientation, result } - result as OffsetFor returns it.
    // ------------------------------------------------------------
    function Na__LeDim__Aim(sheet, dim, pointMm, shift) {
        const orientation = Na__LeDim__OrientationFor(dim, pointMm, shift);
        const posed = dim.Dimension__Orientation === orientation ? dim : Object.assign({}, dim, { Dimension__Orientation : orientation });
        return { orientation : orientation, result : Na__LeDim__OffsetFor(sheet, posed, pointMm) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Inference Marker, or Hide It
    // ------------------------------------------------------------
    function Na__LeDim__ShowInference(result) {
        if (result && result.inferred !== null) Na__LeOsnap__ShowMarker({ x : result.foot.x, y : result.foot.y, kind : Na__LeDim__INFER_KIND }, Na__LeOsnap__TONE_DIMENSION);
        else Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Create the Dimension Once Its End Is Known (the second click, or a typed span)
    // ------------------------------------------------------------
    // Returns false, leaving the start waiting, for a span shorter than
    // minSpanMm - the drag threshold for a click, next to nothing for a typed
    // length, which is meant.
    // ------------------------------------------------------------
    function Na__LeDim__Span(sheet, end, shift, defaults, minSpanMm) {
        const p = Na__LeDim__Placement;
        if (Math.hypot(end.x - p.startMm.x, end.y - p.startMm.y) < minSpanMm) return false;   // <-- Not a span yet
        const mid  = { x : (p.startMm.x + end.x) / 2, y : (p.startMm.y + end.y) / 2 };
        const host = Na__LeHandles__FrontToBack(sheet).find((v) => v.Viewport__Kind === Na__LeModel__KIND_2D && Na__LeHandles__Contains(v, mid)) || null;
        const d    = defaults || {};
        const item = Na__LeModel__CreateDimension(sheet, p.startMm, end, {
            viewportId : host ? host.Viewport__Id : null, offsetMm : d.offsetMm, textSizeMm : d.textSizeMm,
            colour : d.colour, terminator : d.terminator, precision : d.precision, unitsSuffix : d.unitsSuffix,
            atScale : d.atScale !== false,                                    // <-- Measure at scale: the drawing's real size, unless the panel says paper
            startExtensionMm : d.startExtensionMm, endExtensionMm : d.endExtensionMm, extensionsLinked : d.extensionsLinked,   // <-- Fixed length extension lines; the model keeps only what differs from the full line
            orientation : shift ? Na__LeDimGeo__OrthoToward(p.startMm, end, end, null, Na__LeCfg__GetSelectionSetup().dragThresholdMm) : Na__LeDimGeo__ALIGNED,   // <-- Shift already down: ortho from the first frame
            silent : true
        });
        Na__LeAxis__Clear();
        Na__LeGrips__HideBand();
        Na__LeOsnap__HideMarker();
        if (!item) { Na__LeDim__Placement = null; return false; }
        p.phase = 2; p.endMm = end; p.id = item.Dimension__Id; p.aim = null; p.cursor = null;
        Na__LeSurface__Refresh('markup');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // FUNCTION | A Click With the Dimension Tool
    // ------------------------------------------------------------
    // defaults: { offsetMm, textSizeMm, colour, terminator, precision, unitsSuffix, atScale,
    //             startExtensionMm, endExtensionMm, extensionsLinked }
    // ------------------------------------------------------------
    function Na__LeDim__Click(sheet, pointMm, shift, defaults) {
        const p = Na__LeDim__Placement;
        if (!p) {
            const first = Na__LeOsnap__Snap(sheet, pointMm, null, Na__LeOsnap__TONE_DIMENSION);
            Na__LeDim__Placement = { phase : 1, startMm : { x : first.x, y : first.y }, endMm : null, id : null, aim : null, cursor : null };
            Na__LeAxis__Clear();                                              // <-- The point landed: the lock is spent
            Na__LeGrips__ShowBand(Na__LeDim__Placement.startMm, Na__LeDim__Placement.startMm, null);
            return true;
        }
        if (p.phase === 1) return Na__LeDim__Span(sheet, Na__LeDim__SnapOrLock(sheet, p.startMm, pointMm), shift, defaults, Na__LeCfg__GetSelectionSetup().dragThresholdMm);
        // THIRD CLICK | The line stays where the cursor put it, ortho if Shift is still held
        const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id);
        Na__LeDim__Placement = null;
        Na__LeAxis__Clear();
        Na__LeOsnap__HideMarker();
        if (!dim) return false;
        const aim = Na__LeDim__Aim(sheet, dim, pointMm, shift);
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { orientation : aim.orientation, offsetMm : aim.result.offsetMm }, false);   // <-- One announcement: one history step
        Na__LeModel__SetSelection({ kind : 'dimension', id : dim.Dimension__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Dimension Tool
    // ------------------------------------------------------------
    function Na__LeDim__Move(sheet, pointMm, shift) {
        const p = Na__LeDim__Placement;
        if (!p) { Na__LeOsnap__Snap(sheet, pointMm, null, Na__LeOsnap__TONE_DIMENSION); return false; }   // <-- Marker before the first click
        if (p.phase === 1) {
            const end = Na__LeDim__SnapOrLock(sheet, p.startMm, pointMm);
            p.aim = { x : end.x, y : end.y };                                 // <-- Where the band ends is the way a typed length runs
            Na__LeGrips__ShowBand(p.startMm, end, Na__LeAxis__Get());
            return true;
        }
        const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id);
        if (!dim) { Na__LeDim__Placement = null; return false; }
        p.cursor = { x : pointMm.x, y : pointMm.y };                          // <-- The side a typed distance puts the line on
        const aim = Na__LeDim__Aim(sheet, dim, pointMm, shift);
        Na__LeDim__ShowInference(aim.result);
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { orientation : aim.orientation, offsetMm : aim.result.offsetMm }, true);
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


    // FUNCTION | Is the Line Following the Cursor (the phase Shift turns ortho)
    // ------------------------------------------------------------
    function Na__LeDim__IsPlacingLine() { return !!Na__LeDim__Placement && Na__LeDim__Placement.phase === 2; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typed Distances
// -----------------------------------------------------------------------------

    // FUNCTION | What the Placement Measures Right Now
    // ------------------------------------------------------------
    // Returns null with nothing placed; { phase : 1, start, end } while the
    // end is being picked (end is null until the cursor has moved); and
    // { phase : 2, dim } while the line follows the cursor. Paper millimetres.
    // ------------------------------------------------------------
    function Na__LeDim__Measure(sheet) {
        const p = Na__LeDim__Placement;
        if (!p) return null;
        if (p.phase === 1) return { phase : 1, start : { x : p.startMm.x, y : p.startMm.y }, end : p.aim ? { x : p.aim.x, y : p.aim.y } : null };
        const dim = sheet ? sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id) : null;
        return dim ? { phase : 2, dim : dim } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Pick the End a Typed Length Along the Band (instead of the second click)
    // ------------------------------------------------------------
    // lengthFor(pointMm) answers the typed length in PAPER millimetres for a
    // dimension whose midpoint sits at that point, so the caller can take off
    // the scale of the drawing there - the drawing it will belong to. The
    // midpoint and the length settle together in a pass or two; a negative
    // length runs the other way. defaults and shift as for Click.
    // Returns { ok : true } or { ok : false, reason } - 'none' unless the end
    // is being picked, 'direction' when the band has no end to aim along,
    // 'length' for no length.
    // ------------------------------------------------------------
    function Na__LeDim__TypeSpan(sheet, lengthFor, shift, defaults) {
        const p = Na__LeDim__Placement;
        if (!p || p.phase !== 1 || !sheet || typeof lengthFor !== 'function') return { ok : false, reason : 'none' };
        const aim = p.aim;
        const run = aim ? Math.hypot(aim.x - p.startMm.x, aim.y - p.startMm.y) : 0;
        if (!(run >= Na__LeDim__TYPED_MIN_MM)) return { ok : false, reason : 'direction' };
        const ux = (aim.x - p.startMm.x) / run, uy = (aim.y - p.startMm.y) / run;
        let length = lengthFor({ x : p.startMm.x, y : p.startMm.y });
        for (let pass = 0; pass < Na__LeDim__TYPED_PASSES && Number.isFinite(length); pass++) {
            const next = lengthFor({ x : p.startMm.x + (ux * length / 2), y : p.startMm.y + (uy * length / 2) });
            if (!Number.isFinite(next) || Math.abs(next - length) <= 1e-9) break;
            length = next;                                                   // <-- The midpoint crossed into a drawing at another scale
        }
        if (!Number.isFinite(length) || Math.abs(length) < Na__LeDim__TYPED_MIN_MM) return { ok : false, reason : 'length' };
        const end = { x : p.startMm.x + (ux * length), y : p.startMm.y + (uy * length) };
        return Na__LeDim__Span(sheet, end, shift, defaults, Na__LeDim__TYPED_MIN_MM) ? { ok : true } : { ok : false, reason : 'length' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Line a Typed Distance From What It Measures, and Finish (instead of the third click)
    // ------------------------------------------------------------
    // offsetMm is PAPER millimetres, measured across the way the dimension
    // runs, on the side of it the cursor is on; a negative one puts the line
    // on the other side. The orientation is what the cursor and Shift ask
    // for, exactly as for the third click; a typed distance is exact, so no
    // parallel dimension pulls it. Returns { ok : true } or
    // { ok : false, reason : 'none' }.
    // ------------------------------------------------------------
    function Na__LeDim__TypeOffset(sheet, offsetMm, shift) {
        const p = Na__LeDim__Placement;
        if (!p || p.phase !== 2 || !sheet || !Number.isFinite(offsetMm)) return { ok : false, reason : 'none' };
        const dim = sheet.Sheet__Dimensions.find((x) => x.Dimension__Id === p.id);
        if (!dim) { Na__LeDim__Placement = null; return { ok : false, reason : 'none' }; }
        const cursor = p.cursor || { x : dim.Dimension__EndXMm, y : dim.Dimension__EndYMm };
        const aim    = Na__LeDim__Aim(sheet, dim, cursor, shift);
        const side   = aim.result.offsetMm < 0 ? -1 : 1;
        Na__LeDim__Placement = null;
        Na__LeAxis__Clear();
        Na__LeOsnap__HideMarker();
        Na__LeModel__UpdateDimension(sheet, dim.Dimension__Id, { orientation : aim.orientation, offsetMm : side * offsetMm }, false);   // <-- One announcement: one history step
        Na__LeModel__SetSelection({ kind : 'dimension', id : dim.Dimension__Id });
        return { ok : true };
    }
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
        Na__LeDim__IsPlacingLine,
        Na__LeDim__OffsetFor,
        Na__LeDim__ShowInference,
        Na__LeDim__BeginTextEdit,
        Na__LeDim__Measure,
        Na__LeDim__TypeSpan,
        Na__LeDim__TypeOffset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
