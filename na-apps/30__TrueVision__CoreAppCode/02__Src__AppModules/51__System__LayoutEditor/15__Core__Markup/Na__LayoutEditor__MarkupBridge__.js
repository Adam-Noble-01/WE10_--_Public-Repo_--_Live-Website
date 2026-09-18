// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MARKUP BRIDGE
// =============================================================================
//
// FILE       : Na__LayoutEditor__MarkupBridge__.js
// NAMESPACE  : Na__LeMarkup
// MODULE     : Layout Editor - Markup Bridge
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Scene markup shown at scale inside a viewport, sheet markup on the paper, and the copy between them
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Scene mode (D34): a viewport shows the plan's or elevation's own
//   annotations and dimensions, converted from drawing millimetres to paper
//   millimetres at the viewport scale and drawn as primitives. Editing them
//   is done in the drawing itself (Edit In Drawing), so the same record is
//   never edited from two surfaces at once.
// - Sheet mode: the sheet's own annotations (paper millimetres, paper text
//   sizes, optional leader and rotation) and dimensions (paper endpoints; the value is
//   the paper length times the scale of the viewport they belong to, or of
//   the sheet off every viewport, so a sheet dimension measures the model -
//   unless it is set to read the paper; Na__LayoutEditor__DrawingScale__).
//   Import From Scene copies a
//   viewport's scene markup into a sheet layer.
// - Hit testing for the sheet tools, and the selection highlight.
//
// INTEGRATION:
// - Viewport2d (scene primitives), SheetSurface (sheet primitives),
//   SheetTools (hit test), Panel__ViewportSettings (import).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__MarkupBridge__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.13.0
// - BuildSheetPrimitives takes an optional options object, passed straight
//   through to each leader's Push. The interactive sheet surface is the only
//   caller that sets showBrokenHalos, so the red halo round a bubble whose
//   note was deleted (Na__LayoutEditor__LeaderGeometry__) never reaches a PDF
//   or an SVG export - neither passes options at all.
//
// 17-Sep-2026 - Version 1.12.0
// - BuildItemPrimitives: the same drawing BuildSheetPrimitives makes of a whole
//   sheet, for a named handful of items and without the selection highlights.
//   The sheet surface draws the contents of an open container with it, over the
//   faded sheet (Na__LayoutEditor__EditScope__).
// - PushDimension: one dimension's primitives, lifted out of
//   BuildSheetPrimitives so one can be drawn on its own. The sheet build calls
//   it for every dimension, so there is one description of what a dimension
//   looks like and the two cannot drift apart.
//
//
// 14-Sep-2026 - Version 1.12.0
// - Rotated sheet text. Annotation__RotationDeg turns a text item clockwise
//   about its anchor, the first line's baseline at its alignment point.
//   Each line sits its line height further along the turned block and is
//   drawn turned; the leader meets the turned box; the selection outline
//   turns with the text; hit testing reads the point in the text's own
//   frame. AnnotationBox is the box before turning and AnnotationBounds the
//   extent of the turned box; AnnotationCorners, AnnotationCentre,
//   AnnotationToLocal, AnnotationFromLocal, AnnotationHit and
//   AnnotationRotateGrip read the rest. A record without the key draws,
//   hits and bounds exactly as before.
//
// 14-Sep-2026 - Version 1.11.0
// - A sheet annotation draws every line of Annotation__Text, one primitive
//   per newline, at Text LineSpacing. Bounds, hit testing and the selection
//   box follow the block. A single-line record is unchanged.
//
// 14-Sep-2026 - Version 1.10.0
// - A sheet dimension's value can sit off the line: Dimension__TextDXMm and
//   Dimension__TextDYMm shift it, and Push draws a circular arc from the
//   text's edge back to the centre of the dimension line. Hit testing and
//   the selection highlight follow the moved value and the arc.
//   DimensionTextShift and DimensionTextLayout read that layout from a
//   record. A record from before it has no keys and draws exactly as it did.
//
// 14-Sep-2026 - Version 1.9.0
// - A sheet dimension draws its ticks, arrows or dots at Dimension__TickLengthMm
//   (DimensionTickMm), falling back to the config TickLengthMm when the record
//   has no key - every dimension from before Size mm.
//
// 14-Sep-2026 - Version 1.8.0
// - Fixed length extension lines: a sheet dimension's skeleton - and so its
//   drawing, its hit test and the selection box - takes the record's
//   Dimension__StartExtensionMm and Dimension__EndExtensionMm
//   (DimensionExtension), so the part of a shortened line that is not drawn
//   cannot be clicked or boxed either. While a shortened dimension is
//   selected, a thin dashed ghost in the selection colour shows that part,
//   down to the point it measures; the PDF draws no selection, so never has it.
//
// 14-Sep-2026 - Version 1.7.0
// - A sheet dimension's value goes through Na__LayoutEditor__DrawingScale__:
//   one that measures at scale reads its viewport's scale, or the sheet's
//   scale off every viewport; one set to read the paper reads the paper. A
//   record from before Measure at scale reads exactly as it did.
//
// 14-Sep-2026 - Version 1.6.0
// - The notes margin is pushed first in the sheet's markup
//   (Na__LayoutEditor__SpecMargin__): under the vectors, the text, the
//   dimensions and the leaders, and over the viewports. The PDF, which draws
//   these same primitives, prints it with no code of its own.
//
// 14-Sep-2026 - Version 1.5.0
// - BuildSheetPrimitives takes a selection of several items - an array of
//   { kind, id }, as well as one or null - and draws a highlight round each.
//
// 14-Sep-2026 - Version 1.4.0
// - Leaders & Annotation Bubbles: sheet leaders are drawn last, over the
//   vectors, the text and the dimensions, so a filled bubble or note masks
//   what it sits on - and hit tested first, for the same reason. LeaderBounds
//   is the box one occupies. Na__LayoutEditor__LeaderGeometry__ lays them out.
//
// 13-Sep-2026 - Version 1.3.0
// - Sheet dimensions carry their orientation into the skeleton, the drawing and
//   the value: a horizontal or vertical dimension measures the x or the y alone
//   (Na__LayoutEditor__DimensionGeometry__ SpanMm). Hit testing and the
//   selection box follow the skeleton, so they needed nothing of their own.
//
// 13-Sep-2026 - Version 1.2.0
// - HitTest takes includeLocked, so the eyedropper can read an item on a locked
//   layer. Every other caller leaves it off and still skips locked items.
//
// 10-Sep-2026 - Version 1.1.0
// - Vector shapes drawn under the markup and hit tested after text. Hit order is dimensions (lines and value text), text, shapes. Dimension weight from the sheet's lineweights.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Chrome, Geometry and the Sheet Model
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__PtToMm
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeChrome__MeasureTextMm,
        Na__LeChrome__PushRect,
        Na__LeChrome__PushLine,
        Na__LeChrome__PushPolyline,
        Na__LeChrome__PushText
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__LeDimGeo__Skeleton,
        Na__LeDimGeo__DistanceToSegment,
        Na__LeDimGeo__DistanceToPolyline,
        Na__LeDimGeo__Push,
        Na__LeDimGeo__TextLayout,
        Na__LeDimGeo__HitText,
        Na__LeDimGeo__SpanMm
    } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShapeGeo__Push, Na__LeShapeGeo__Bounds, Na__LeShapeGeo__Hit } from './Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeLeadGeo__Push, Na__LeLeadGeo__Bounds, Na__LeLeadGeo__Hit } from './Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeMargin__Push } from '../50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js';
    import { Na__LeDrawScale__DimensionDenominator } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import {
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__CreateDimension
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Markup Records (plans and elevations share the engines)
    // ------------------------------------------------------------
    import { Na__FpData__GetAnnotations } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetAnnotations, Na__ElevData__GetDimensions } from '../../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PlanAnno__ReadAll, Na__PlanAnno__Read, Na__PlanAnno__GetTextSetup } from '../../43__System__PlanAnnotations/Na__PlanAnnotations__Data__.js';
    import {
        Na__PlanDim__F_START_X, Na__PlanDim__F_START_Z, Na__PlanDim__F_END_X, Na__PlanDim__F_END_Z,
        Na__PlanDim__F_OFFSET, Na__PlanDim__F_SIZE, Na__PlanDim__F_WEIGHT, Na__PlanDim__F_COLOR, Na__PlanDim__F_TERM,
        Na__PlanDim__GetPlanDimensions, Na__PlanDim__ReadAll, Na__PlanDim__MeasureLengthMm, Na__PlanDim__FormatLength
    } from '../../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import { Na__PlanDim__GetLineSetup, Na__PlanDim__GetTextSetup } from '../../44__System__PlanDimensions/Na__PlanDimensions__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typography
    // ------------------------------------------------------------
    const Na__LeMarkup__CAP_HEIGHT     = 0.72;
    const Na__LeMarkup__DESCENT        = 0.25;
    const Na__LeMarkup__SELECT_PAD_MM  = 1.0;
    const Na__LeMarkup__LEADER_DOT_MM  = 0.5;
    const Na__LeMarkup__MIN_SCENE_STROKE_MM = 0.15;
    const Na__LeMarkup__MAX_SCENE_STROKE_MM = 1.0;
    const Na__LeMarkup__GHOST_STROKE_MM     = 0.2;    // <-- The undrawn part of a selected dimension's shortened extension line
    const Na__LeMarkup__GHOST_DASH_MM       = 0.8;
    const Na__LeMarkup__GHOST_MIN_MM        = 0.01;   // <-- A hidden part shorter than this is no hidden part
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Markup at Scale
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Scene Records Behind a Viewport
    // ------------------------------------------------------------
    function Na__LeMarkup__SceneRecords(described) {
        const source = described ? described.source : null;
        if (!source) return { annotations : [], dimensions : [] };
        if (source.plan)      return { annotations : Na__FpData__GetAnnotations(source.plan), dimensions : Na__PlanDim__GetPlanDimensions(source.plan) };
        if (source.elevation) return { annotations : Na__ElevData__GetAnnotations(source.elevation), dimensions : Na__ElevData__GetDimensions(source.elevation) };
        return { annotations : [], dimensions : [] };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Viewport's Scene Markup as Frame-Local Paper Primitives
    // ------------------------------------------------------------
    // described : { source, definition, window } from Na__LeVp2d__Describe
    // Drawing space is x right, y down; the record's second axis is flipped
    // by the definition's Axis2Sign (height on an elevation).
    // ------------------------------------------------------------
    function Na__LeMarkup__BuildScenePrimitives(described) {
        const list = [];
        if (!described || !described.definition || !described.window) return list;
        const win      = described.window;
        const sign     = described.definition.Axis2Sign;
        const D        = win.Denominator;
        const records  = Na__LeMarkup__SceneRecords(described);
        const annoText = Na__PlanAnno__GetTextSetup();
        const lineSet  = Na__PlanDim__GetLineSetup();
        const textSet  = Na__PlanDim__GetTextSetup();
        const local    = (ax1, ax2) => win.ToLocal(ax1, sign * ax2);

        Na__PlanAnno__ReadAll(records.annotations).forEach((record) => {
            const f = Na__PlanAnno__Read(record);
            if (!f || !f.text) return;
            const p      = local(f.posXMm, f.posZMm);
            const fontMm = f.sizeMm / D;
            Na__LeChrome__PushText(list, {
                X : p.x, BaselineY : p.y + (fontMm * Na__LeMarkup__CAP_HEIGHT / 2), Text : f.text, FontMm : fontMm,
                Weight : f.fontWeight, Colour : f.color, Align : 'center', FontFamily : annoText.fontFamily
            });
        });

        Na__PlanDim__ReadAll(records.dimensions).forEach((record) => {
            const start = local(record[Na__PlanDim__F_START_X], record[Na__PlanDim__F_START_Z]);
            const end   = local(record[Na__PlanDim__F_END_X],   record[Na__PlanDim__F_END_Z]);
            const stroke = Math.min(Na__LeMarkup__MAX_SCENE_STROKE_MM, Math.max(Na__LeMarkup__MIN_SCENE_STROKE_MM, lineSet.strokeWidthMm / D));
            Na__LeDimGeo__Push(list, {
                start : start, end : end,
                offsetMm    : (record[Na__PlanDim__F_OFFSET] / D) * sign,       // <-- A mirrored axis mirrors the side
                gapMm       : lineSet.extGapMm / D,
                overshootMm : lineSet.overshootMm / D,
                tickMm      : lineSet.tickLengthMm / D,
                strokeMm    : stroke,
                colour      : record[Na__PlanDim__F_COLOR],
                terminator  : record[Na__PlanDim__F_TERM],
                text        : Na__PlanDim__FormatLength(Na__PlanDim__MeasureLengthMm(record), record),
                fontMm      : record[Na__PlanDim__F_SIZE] / D,
                weight      : record[Na__PlanDim__F_WEIGHT],
                liftMm      : textSet.textGapMm / D,
                fontFamily  : textSet.fontFamily
            });
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy a Viewport's Scene Markup Into a Sheet Layer
    // ------------------------------------------------------------
    // Returns the number of items created.
    // ------------------------------------------------------------
    function Na__LeMarkup__ImportFromScene(sheet, viewport, layerId, described) {
        if (!sheet || !viewport || !described || !described.definition || !described.window) return 0;
        const win     = described.window;
        const sign    = described.definition.Axis2Sign;
        const D       = win.Denominator;
        const records = Na__LeMarkup__SceneRecords(described);
        let count = 0;

        Na__PlanAnno__ReadAll(records.annotations).forEach((record) => {
            const f = Na__PlanAnno__Read(record);
            if (!f || !f.text) return;
            const p      = win.ToPaper(f.posXMm, sign * f.posZMm);
            const fontMm = f.sizeMm / D;
            if (Na__LeModel__CreateAnnotation(sheet, p.x, p.y + (fontMm * Na__LeMarkup__CAP_HEIGHT / 2), {
                text : f.text, sizeMm : fontMm, fontWeight : f.fontWeight, colour : f.color, align : 'center', layerId : layerId
            })) count++;
        });

        Na__PlanDim__ReadAll(records.dimensions).forEach((record) => {
            const start = win.ToPaper(record[Na__PlanDim__F_START_X], sign * record[Na__PlanDim__F_START_Z]);
            const end   = win.ToPaper(record[Na__PlanDim__F_END_X],   sign * record[Na__PlanDim__F_END_Z]);
            if (Na__LeModel__CreateDimension(sheet, start, end, {
                viewportId : viewport.Viewport__Id,
                offsetMm   : (record[Na__PlanDim__F_OFFSET] / D) * sign,
                textSizeMm : record[Na__PlanDim__F_SIZE] / D,
                colour     : record[Na__PlanDim__F_COLOR],
                terminator : record[Na__PlanDim__F_TERM],
                layerId    : layerId
            })) count++;
        });
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet Markup
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Lines a Sheet Annotation Shows
    // ------------------------------------------------------------
    // Every line, blank ones included, because a blank line is spacing someone
    // typed. A record with no newline is one line, as it always was.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationLines(text) {
        return String(text === undefined || text === null ? '' : text).split(/\r?\n/);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Line Height of a Sheet Annotation, in Paper Millimetres
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationLineMm(fontMm) {
        return fontMm * Na__LeCfg__GetTextSetup().lineSpacing;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Sheet Annotation Is Turned, in Degrees Clockwise
    // ------------------------------------------------------------
    // About its anchor: the first line's baseline at its alignment point, the
    // point Annotation__PosXMm and Annotation__PosYMm name. A record without
    // the key - every text item from before rotation - is not turned.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationRotationDeg(item) {
        const deg = item ? item.Annotation__RotationDeg : null;
        return (typeof deg === 'number' && Number.isFinite(deg)) ? deg : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Sheet Annotation's Text Occupies Before It Is Turned
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationBox(item) {
        const fontMm = item.Annotation__SizeMm;
        const lines  = Na__LeMarkup__AnnotationLines(item.Annotation__Text);
        let width = fontMm;
        lines.forEach((line) => { width = Math.max(width, Na__LeChrome__MeasureTextMm(line, fontMm, item.Annotation__FontWeight)); });
        const count  = Math.max(1, lines.length);
        const height = (fontMm * Na__LeMarkup__CAP_HEIGHT) + ((count - 1) * Na__LeMarkup__AnnotationLineMm(fontMm)) + (fontMm * Na__LeMarkup__DESCENT);
        const x = item.Annotation__PosXMm - (item.Annotation__Align === 'center' ? width / 2 : (item.Annotation__Align === 'right' ? width : 0));
        return { X : x, Y : item.Annotation__PosYMm - (fontMm * Na__LeMarkup__CAP_HEIGHT), WidthMm : width, HeightMm : height };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Point of the Unturned Text, Turned With It Onto the Paper
    // ------------------------------------------------------------
    // Returns { x, y }. Text that is not turned hands the point straight back,
    // to the last digit, so nothing about an unturned item moves.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationFromLocal(item, x, y) {
        const deg = Na__LeMarkup__AnnotationRotationDeg(item);
        if (!deg) return { x : x, y : y };
        const a  = deg * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        const ox = item.Annotation__PosXMm, oy = item.Annotation__PosYMm;
        const dx = x - ox, dy = y - oy;
        return { x : ox + (dx * cos) - (dy * sin), y : oy + (dx * sin) + (dy * cos) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Paper Point in the Text's Own Unturned Frame
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationToLocal(item, point) {
        const deg = Na__LeMarkup__AnnotationRotationDeg(item);
        if (!deg) return { x : point.x, y : point.y };
        const a  = deg * (Math.PI / 180), cos = Math.cos(a), sin = Math.sin(a);
        const ox = item.Annotation__PosXMm, oy = item.Annotation__PosYMm;
        const dx = point.x - ox, dy = point.y - oy;
        return { x : ox + (dx * cos) + (dy * sin), y : oy - (dx * sin) + (dy * cos) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Four Corners of a Sheet Annotation's Box on the Paper
    // ------------------------------------------------------------
    // [x, y] pairs: the unturned box's top-left, top-right, bottom-right and
    // bottom-left, turned with the text. padMm grows the box on every side
    // before it is turned (the selection outline's clearance).
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationCorners(item, padMm) {
        const b   = Na__LeMarkup__AnnotationBox(item);
        const pad = Number.isFinite(padMm) ? padMm : 0;
        const x0  = b.X - pad, y0 = b.Y - pad, x1 = b.X + b.WidthMm + pad, y1 = b.Y + b.HeightMm + pad;
        return [ [ x0, y0 ], [ x1, y0 ], [ x1, y1 ], [ x0, y1 ] ].map((p) => {
            const q = Na__LeMarkup__AnnotationFromLocal(item, p[0], p[1]);
            return [ q.x, q.y ];
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Middle of a Sheet Annotation's Box on the Paper
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationCentre(item) {
        const b = Na__LeMarkup__AnnotationBox(item);
        return Na__LeMarkup__AnnotationFromLocal(item, b.X + (b.WidthMm / 2), b.Y + (b.HeightMm / 2));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Sheet Annotation Occupies
    // ------------------------------------------------------------
    // Square to the sheet. A turned item's is the extent of its turned box, so
    // a group, the eyedropper's outline and anything else that frames an item
    // takes all of it. An unturned item's is its box, exactly as it always was.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationBounds(item) {
        if (!Na__LeMarkup__AnnotationRotationDeg(item)) return Na__LeMarkup__AnnotationBox(item);
        const pts  = Na__LeMarkup__AnnotationCorners(item, 0);
        const xs   = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
        return { X : minX, Y : minY, WidthMm : Math.max.apply(null, xs) - minX, HeightMm : Math.max.apply(null, ys) - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Paper Point Lands on a Sheet Annotation (tolerance all round its box)
    // ------------------------------------------------------------
    // Read in the text's own frame, so a turned item is found on its turned box
    // and not in the empty corners of the square round it.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationHit(item, pointMm, toleranceMm) {
        const tol = Number.isFinite(toleranceMm) ? toleranceMm : 0;
        const b   = Na__LeMarkup__AnnotationBox(item);
        const p   = Na__LeMarkup__AnnotationToLocal(item, pointMm);
        return p.x >= b.X - tol && p.x <= b.X + b.WidthMm + tol && p.y >= b.Y - tol && p.y <= b.Y + b.HeightMm + tol;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Selected Text Item's Rotate Grip Sits
    // ------------------------------------------------------------
    // Off the middle of the top of its selection outline, reachMm further out,
    // turned with the text: { base, grip }, both { x, y }. base is where the
    // stem leaves the outline. Upside-down text has its grip below, where the
    // top of the text now is.
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationRotateGrip(item, reachMm) {
        const b    = Na__LeMarkup__AnnotationBox(item);
        const midX = b.X + (b.WidthMm / 2);
        const topY = b.Y - Na__LeMarkup__SELECT_PAD_MM;
        const out  = Number.isFinite(reachMm) ? Math.max(0, reachMm) : 0;
        return { base : Na__LeMarkup__AnnotationFromLocal(item, midX, topY), grip : Na__LeMarkup__AnnotationFromLocal(item, midX, topY - out) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Sheet Leader Occupies (its curve, its endpoint and its head)
    // ------------------------------------------------------------
    function Na__LeMarkup__LeaderBounds(leader) {
        return Na__LeLeadGeo__Bounds(leader);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Sheet Dimension Measures, in Model Millimetres
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionValueMm(sheet, dim) {
        const paperMm = Na__LeDimGeo__SpanMm(                                   // <-- The x or the y alone for an ortho dimension
            { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
            { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
            dim.Dimension__Orientation
        );
        return paperMm * Na__LeDrawScale__DimensionDenominator(sheet, dim);   // <-- Its viewport's scale, the sheet's off every viewport, or 1 for the paper
    }
    // ------------------------------------------------------------


    // FUNCTION | The Text a Sheet Dimension Shows
    // ------------------------------------------------------------
    function Na__LeMarkup__FormatDimension(dim, valueMm) {
        if (typeof dim.Dimension__OverrideText === 'string' && dim.Dimension__OverrideText.trim()) return dim.Dimension__OverrideText.trim();
        const setup     = Na__LeCfg__GetDimensionSetup();
        const precision = Math.max(0, Math.min(3, Math.round(dim.Dimension__Precision)));
        const fixed     = Math.abs(valueMm).toFixed(precision);
        const parts     = fixed.split('.');
        if (setup.thousandsSep) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, setup.thousandsSep);
        return parts.join('.') + (dim.Dimension__UnitsSuffix || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Dimension Line Weight: the Sheet's Points, Else the Config Millimetres
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionStrokeMm(sheet, dimSetup) {
        const pt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.DimensionPt : null;
        return Number.isFinite(pt) ? Na__LeCfg__PtToMm(pt) : dimSetup.strokeMm;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Skeleton of a Sheet Dimension (paper millimetres)
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionSkeleton(dim) {
        const setup = Na__LeCfg__GetDimensionSetup();
        return Na__LeDimGeo__Skeleton(
            { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
            { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
            dim.Dimension__OffsetMm, setup.extGapMm, setup.overshootMm, dim.Dimension__Orientation, Na__LeMarkup__DimensionExtension(dim)
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far a Sheet Dimension's Extension Lines Run Back From Its Line
    // ------------------------------------------------------------
    // { startMm, endMm } for the geometry. A length the record does not hold
    // is the full line.
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionExtension(dim) {
        return { startMm : dim.Dimension__StartExtensionMm, endMm : dim.Dimension__EndExtensionMm };
    }
    // ------------------------------------------------------------


    // FUNCTION | How Large a Sheet Dimension's Ticks, Arrows or Dots Are
    // ------------------------------------------------------------
    // Paper millimetres. A record without Dimension__TickLengthMm draws at
    // the config TickLengthMm, as every dimension from before Size mm did.
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionTickMm(dim) {
        const setup = Na__LeCfg__GetDimensionSetup();
        const mm    = dim ? dim.Dimension__TickLengthMm : null;
        if (!(typeof mm === 'number' && Number.isFinite(mm) && mm > 0)) return setup.tickLengthMm;
        return Math.min(setup.maxTickLengthMm, Math.max(setup.minTickLengthMm, mm));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Value's Paper Offset From Its Un-Dragged Place
    // ------------------------------------------------------------
    // { dx, dy } in paper millimetres. A record without the keys - every
    // dimension from before the text leader - is no offset.
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionTextShift(dim) {
        const dx = dim ? dim.Dimension__TextDXMm : null;
        const dy = dim ? dim.Dimension__TextDYMm : null;
        return {
            dx : (typeof dx === 'number' && Number.isFinite(dx)) ? dx : 0,
            dy : (typeof dy === 'number' && Number.isFinite(dy)) ? dy : 0
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Value's Place, Box and Leader Arc on the Paper
    // ------------------------------------------------------------
    // skeleton is optional: the record's own is used when it is left out.
    // Returns { place, box, leader } or null for a degenerate span.
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionTextLayout(sheet, dim, skeleton) {
        const sk = skeleton || Na__LeMarkup__DimensionSkeleton(dim);
        if (!sk || !dim) return null;
        const setup = Na__LeCfg__GetDimensionSetup();
        const shift = Na__LeMarkup__DimensionTextShift(dim);
        const text  = sheet ? Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim)) : (dim.Dimension__OverrideText || '');
        return Na__LeDimGeo__TextLayout(sk, {
            liftMm : setup.textGapMm, text : text, fontMm : dim.Dimension__TextSizeMm, weight : 400,
            dx : shift.dx, dy : shift.dy, minMm : setup.textLeaderMinMm, gapMm : setup.textLeaderGapMm
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Sheet Annotation With Its Leader
    // ------------------------------------------------------------
    // A turned item is laid out in its own frame and turned onto the paper:
    // the leader's end is found against the unturned box from the tip read in
    // that frame, and each line sits its line height further along the turned
    // block, drawn at the text's angle.
    // ------------------------------------------------------------
    function Na__LeMarkup__PushAnnotation(list, item, textSetup) {
        const fontMm = item.Annotation__SizeMm;
        const deg    = Na__LeMarkup__AnnotationRotationDeg(item);
        if (Number.isFinite(item.Annotation__LeaderXMm) && Number.isFinite(item.Annotation__LeaderYMm)) {
            const bounds = Na__LeMarkup__AnnotationBox(item);
            const midY   = bounds.Y + (bounds.HeightMm / 2);
            const tipX   = item.Annotation__LeaderXMm, tipY = item.Annotation__LeaderYMm;
            const tip    = Na__LeMarkup__AnnotationToLocal(item, { x : tipX, y : tipY });   // <-- The tip itself for unturned text
            const endX   = tip.x < bounds.X ? bounds.X - 0.8 : (tip.x > bounds.X + bounds.WidthMm ? bounds.X + bounds.WidthMm + 0.8 : tip.x);
            const endY   = (tip.x >= bounds.X && tip.x <= bounds.X + bounds.WidthMm) ? (tip.y < midY ? bounds.Y - 0.6 : bounds.Y + bounds.HeightMm + 0.6) : midY;
            const end    = Na__LeMarkup__AnnotationFromLocal(item, endX, endY);
            Na__LeChrome__PushLine(list, tipX, tipY, end.x, end.y, item.Annotation__Colour, textSetup.leaderStrokeMm);
            const r = Na__LeMarkup__LEADER_DOT_MM;
            const dot = [];
            for (let i = 0; i < 8; i++) dot.push([ tipX + (Math.cos(i * Math.PI / 4) * r), tipY + (Math.sin(i * Math.PI / 4) * r) ]);
            Na__LeChrome__PushPolyline(list, dot, null, 0, item.Annotation__Colour, true);
        }
        const lineMm = Na__LeMarkup__AnnotationLineMm(fontMm);
        Na__LeMarkup__AnnotationLines(item.Annotation__Text).forEach((line, i) => {
            const at = Na__LeMarkup__AnnotationFromLocal(item, item.Annotation__PosXMm, item.Annotation__PosYMm + (i * lineMm));
            Na__LeChrome__PushText(list, {
                X : at.x, BaselineY : at.y, Text : line, FontMm : fontMm,
                Weight : item.Annotation__FontWeight, Colour : item.Annotation__Colour, Align : item.Annotation__Align, RotateDeg : deg, FontFamily : textSetup.fontFamily
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push One Dimension's Primitives (returns its skeleton)
    // ------------------------------------------------------------
    // Lifted out of BuildSheetPrimitives so one dimension can be drawn on its
    // own - the focus layer draws exactly the dimension that is open for
    // editing, over the faded sheet (Na__LayoutEditor__EditScope__). The sheet
    // build calls it for every dimension, so there is one description of what a
    // dimension looks like and the two can never drift apart.
    // ------------------------------------------------------------
    function Na__LeMarkup__PushDimension(list, sheet, dim, dimSetup, textSetup, style) {
        const shift = Na__LeMarkup__DimensionTextShift(dim);
        return Na__LeDimGeo__Push(list, {
            start : { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
            end   : { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
            orientation : dim.Dimension__Orientation,
            offsetMm : dim.Dimension__OffsetMm, gapMm : dimSetup.extGapMm, overshootMm : dimSetup.overshootMm,
            tickMm : Na__LeMarkup__DimensionTickMm(dim), strokeMm : Na__LeMarkup__DimensionStrokeMm(sheet, dimSetup), colour : dim.Dimension__Colour,
            terminator : dim.Dimension__Terminator,
            text : Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim)),
            fontMm : dim.Dimension__TextSizeMm, weight : 400, liftMm : dimSetup.textGapMm, fontFamily : textSetup.fontFamily,
            extension : Na__LeMarkup__DimensionExtension(dim),
            textDXMm : shift.dx, textDYMm : shift.dy,
            textLeaderMinMm : dimSetup.textLeaderMinMm, textLeaderGapMm : dimSetup.textLeaderGapMm,
            textFillColour : style.paperColour
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Sheet's Own Markup as Paper Primitives
    // ------------------------------------------------------------
    // selection: { kind, id }, an array of them, or null; the highlights are
    // drawn last, a box round each selected item.
    // options: passed straight through to a leader's Push - the interactive
    // surface opts into { showBrokenHalos : true } and nothing else does, so
    // a PDF or an SVG export draws exactly what it always drew.
    // ------------------------------------------------------------
    function Na__LeMarkup__BuildSheetPrimitives(sheet, layout, selection, options) {
        const list = [];
        if (!sheet) return list;
        const textSetup = Na__LeCfg__GetTextSetup();
        const dimSetup  = Na__LeCfg__GetDimensionSetup();
        const style     = Na__LeCfg__GetStyleSetup();
        const chosen    = new Set((Array.isArray(selection) ? selection : [ selection ]).filter(Boolean).map((item) => item.kind + ':' + item.id));
        const isChosen  = (kind, id) => chosen.has(kind + ':' + id);
        const highlights = [];

        // NOTES MARGIN | First: its paper masks a viewport pushed beneath it,
        // and everything the sheet carries can still be drawn over it
        if (layout) Na__LeMargin__Push(list, sheet, layout);

        // SHAPES | Under the text and the dimensions
        sheet.Sheet__Shapes.forEach((shape) => {
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId)) return;
            Na__LeShapeGeo__Push(list, shape);
            if (isChosen('shape', shape.Shape__Id)) highlights.push(Na__LeShapeGeo__Bounds(shape));
        });

        sheet.Sheet__Annotations.forEach((item) => {
            if (!Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId)) return;
            Na__LeMarkup__PushAnnotation(list, item, textSetup);
            if (!isChosen('annotation', item.Annotation__Id)) return;
            if (Na__LeMarkup__AnnotationRotationDeg(item)) highlights.push({ Points : Na__LeMarkup__AnnotationCorners(item, Na__LeMarkup__SELECT_PAD_MM) });   // <-- The outline turns with the text
            else highlights.push(Na__LeMarkup__AnnotationBounds(item));
        });

        sheet.Sheet__Dimensions.forEach((dim) => {
            if (!Na__LeModel__IsLayerVisible(sheet, dim.Dimension__LayerId)) return;
            const sk = Na__LeMarkup__PushDimension(list, sheet, dim, dimSetup, textSetup, style);
            if (sk && isChosen('dimension', dim.Dimension__Id)) {
                // THE PART NOT DRAWN | A shortened extension line still measures
                // from its point, so the selection shows the rest of it, dashed.
                [ [ sk.G1, sk.X1 ], [ sk.G2, sk.X2 ] ].forEach((run) => {
                    if (Math.hypot(run[1].x - run[0].x, run[1].y - run[0].y) <= Na__LeMarkup__GHOST_MIN_MM) return;
                    Na__LeChrome__PushLine(list, run[0].x, run[0].y, run[1].x, run[1].y, style.selectionColour, Na__LeMarkup__GHOST_STROKE_MM, Na__LeMarkup__GHOST_DASH_MM);
                });
                const xs = [ sk.S.x, sk.E.x, sk.T1.x, sk.T2.x ], ys = [ sk.S.y, sk.E.y, sk.T1.y, sk.T2.y ];
                const layout = Na__LeMarkup__DimensionTextLayout(sheet, dim, sk);
                if (layout && layout.box) layout.box.points.forEach((p) => { xs.push(p[0]); ys.push(p[1]); });
                if (layout && layout.leader) layout.leader.points.forEach((p) => { xs.push(p[0]); ys.push(p[1]); });
                const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
                const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
                highlights.push({ X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY });
            }
        });

        // LEADERS | Last, over everything else, so a filled bubble or note
        // masks the drawing it is laid on
        (sheet.Sheet__Leaders || []).forEach((leader) => {
            if (!Na__LeModel__IsLayerVisible(sheet, leader.Leader__LayerId)) return;
            const layout = Na__LeLeadGeo__Push(list, leader, options);
            if (isChosen('leader', leader.Leader__Id)) highlights.push(Na__LeLeadGeo__Bounds(leader, layout));
        });

        const pad = Na__LeMarkup__SELECT_PAD_MM;
        highlights.forEach((box) => {
            if (box.Points) { Na__LeChrome__PushPolyline(list, box.Points, style.selectionColour, 0.3, null, true, null, { dashMm : 1.2 }); return; }   // <-- A turned outline, padded already
            Na__LeChrome__PushRect(list, box.X - pad, box.Y - pad, box.WidthMm + (pad * 2), box.HeightMm + (pad * 2), style.selectionColour, 0.3, null, 1.2);
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Named Handful of Items, and Nothing Else
    // ------------------------------------------------------------
    // The same drawing BuildSheetPrimitives makes of a whole sheet, for a list
    // of { kind, id } - vectors and text only, which is what a group can hold.
    // The sheet surface uses it for the focus layer: while a container is open
    // the whole sheet is faded, and its contents are drawn again over the top
    // at full strength (Na__LayoutEditor__EditScope__). Selection highlights
    // are left out on purpose; the grips and the highlight box come from the
    // layers above, as they always did.
    // ------------------------------------------------------------
    function Na__LeMarkup__BuildItemPrimitives(sheet, items) {
        const list = [];
        if (!sheet || !Array.isArray(items) || !items.length) return list;
        const textSetup = Na__LeCfg__GetTextSetup();
        const dimSetup  = Na__LeCfg__GetDimensionSetup();
        const style     = Na__LeCfg__GetStyleSetup();
        const wanted    = new Set(items.filter(Boolean).map((item) => item.kind + ':' + item.id));
        sheet.Sheet__Shapes.forEach((shape) => {
            if (!wanted.has('shape:' + shape.Shape__Id)) return;
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId)) return;
            Na__LeShapeGeo__Push(list, shape);
        });
        sheet.Sheet__Annotations.forEach((item) => {
            if (!wanted.has('annotation:' + item.Annotation__Id)) return;
            if (!Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId)) return;
            Na__LeMarkup__PushAnnotation(list, item, textSetup);
        });
        sheet.Sheet__Dimensions.forEach((dim) => {
            if (!wanted.has('dimension:' + dim.Dimension__Id)) return;
            if (!Na__LeModel__IsLayerVisible(sheet, dim.Dimension__LayerId)) return;
            Na__LeMarkup__PushDimension(list, sheet, dim, dimSetup, textSetup, style);
        });
        (sheet.Sheet__Leaders || []).forEach((leader) => {
            if (!wanted.has('leader:' + leader.Leader__Id)) return;
            if (!Na__LeModel__IsLayerVisible(sheet, leader.Leader__LayerId)) return;
            Na__LeLeadGeo__Push(list, leader);
        });
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Sheet Markup Item Is Under a Paper Point
    // ------------------------------------------------------------
    // Returns { kind : 'leader' | 'dimension' | 'annotation' | 'shape', id } or
    // null, in that order of priority. Locked and hidden layers are skipped;
    // later items of a kind win, as they draw on top.
    // ------------------------------------------------------------
    function Na__LeMarkup__HitTest(sheet, pointMm, toleranceMm, includeLocked) {
        if (!sheet) return null;
        const tol = Number.isFinite(toleranceMm) ? toleranceMm : 1.5;
        const editable = (layerId) => Na__LeModel__IsLayerVisible(sheet, layerId) && (includeLocked === true || !Na__LeModel__IsLayerLocked(sheet, layerId));   // <-- includeLocked: the eyedropper may READ a locked item

        // LEADERS FIRST | They draw over everything else on the sheet, and a
        // leader's tip sits on the very thing it points at.
        const leaders = sheet.Sheet__Leaders || [];
        for (let i = leaders.length - 1; i >= 0; i--) {
            const leader = leaders[i];
            if (!editable(leader.Leader__LayerId)) continue;
            if (Na__LeLeadGeo__Hit(leader, pointMm, tol)) return { kind : 'leader', id : leader.Leader__Id };
        }

        // DIMENSIONS NEXT | Thin lines are hard to hit, so the lines take a
        // wider tolerance and the value text counts as part of the dimension.
        const lineTol  = tol * 1.5;
        for (let i = sheet.Sheet__Dimensions.length - 1; i >= 0; i--) {
            const dim = sheet.Sheet__Dimensions[i];
            if (!editable(dim.Dimension__LayerId)) continue;
            const sk = Na__LeMarkup__DimensionSkeleton(dim);
            if (!sk) continue;
            const layout = Na__LeMarkup__DimensionTextLayout(sheet, dim, sk);
            if (layout && Na__LeDimGeo__HitText(layout.box, pointMm, tol)) return { kind : 'dimension', id : dim.Dimension__Id };
            if (layout && layout.leader && Na__LeDimGeo__DistanceToPolyline(pointMm, layout.leader.points) <= lineTol) {
                return { kind : 'dimension', id : dim.Dimension__Id };
            }
            if (Na__LeDimGeo__DistanceToSegment(pointMm, sk.DS, sk.DE) <= lineTol ||
                Na__LeDimGeo__DistanceToSegment(pointMm, sk.X1, sk.T1) <= lineTol ||
                Na__LeDimGeo__DistanceToSegment(pointMm, sk.X2, sk.T2) <= lineTol) return { kind : 'dimension', id : dim.Dimension__Id };
        }
        for (let i = sheet.Sheet__Annotations.length - 1; i >= 0; i--) {
            const item = sheet.Sheet__Annotations[i];
            if (!editable(item.Annotation__LayerId)) continue;
            if (Na__LeMarkup__AnnotationHit(item, pointMm, tol)) return { kind : 'annotation', id : item.Annotation__Id };   // <-- On its turned box, for turned text
        }
        for (let i = sheet.Sheet__Shapes.length - 1; i >= 0; i--) {
            const shape = sheet.Sheet__Shapes[i];
            if (!editable(shape.Shape__LayerId)) continue;
            if (Na__LeShapeGeo__Hit(shape, pointMm, tol)) return { kind : 'shape', id : shape.Shape__Id };
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Markup Bridge API
    // ------------------------------------------------------------
    export {
        Na__LeMarkup__BuildScenePrimitives,
        Na__LeMarkup__ImportFromScene,
        Na__LeMarkup__AnnotationBounds,
        Na__LeMarkup__AnnotationBox,
        Na__LeMarkup__AnnotationRotationDeg,
        Na__LeMarkup__AnnotationCorners,
        Na__LeMarkup__AnnotationCentre,
        Na__LeMarkup__AnnotationToLocal,
        Na__LeMarkup__AnnotationFromLocal,
        Na__LeMarkup__AnnotationHit,
        Na__LeMarkup__AnnotationRotateGrip,
        Na__LeMarkup__LeaderBounds,
        Na__LeMarkup__DimensionValueMm,
        Na__LeMarkup__FormatDimension,
        Na__LeMarkup__DimensionSkeleton,
        Na__LeMarkup__DimensionTickMm,
        Na__LeMarkup__DimensionTextShift,
        Na__LeMarkup__DimensionTextLayout,
        Na__LeMarkup__BuildSheetPrimitives,
        Na__LeMarkup__BuildItemPrimitives,
        Na__LeMarkup__HitTest
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
