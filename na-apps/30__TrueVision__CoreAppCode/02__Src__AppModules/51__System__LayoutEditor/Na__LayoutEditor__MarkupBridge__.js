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
//   sizes, optional leader) and dimensions (paper endpoints; the value is
//   the paper length times the scale of the viewport they belong to, so a
//   sheet dimension measures the model). Import From Scene copies a
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
    } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeChrome__MeasureTextMm,
        Na__LeChrome__PushRect,
        Na__LeChrome__PushLine,
        Na__LeChrome__PushPolyline,
        Na__LeChrome__PushText
    } from './Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__LeDimGeo__Skeleton,
        Na__LeDimGeo__DistanceToSegment,
        Na__LeDimGeo__Push,
        Na__LeDimGeo__TextPlacement
    } from './Na__LayoutEditor__DimensionGeometry__.js';
    import { Na__LeShapeGeo__Push, Na__LeShapeGeo__Bounds, Na__LeShapeGeo__Hit } from './Na__LayoutEditor__ShapeGeometry__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__CreateDimension
    } from './Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Markup Records (plans and elevations share the engines)
    // ------------------------------------------------------------
    import { Na__FpData__GetAnnotations } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetAnnotations, Na__ElevData__GetDimensions } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PlanAnno__ReadAll, Na__PlanAnno__Read, Na__PlanAnno__GetTextSetup } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Data__.js';
    import {
        Na__PlanDim__F_START_X, Na__PlanDim__F_START_Z, Na__PlanDim__F_END_X, Na__PlanDim__F_END_Z,
        Na__PlanDim__F_OFFSET, Na__PlanDim__F_SIZE, Na__PlanDim__F_WEIGHT, Na__PlanDim__F_COLOR, Na__PlanDim__F_TERM,
        Na__PlanDim__GetPlanDimensions, Na__PlanDim__ReadAll, Na__PlanDim__MeasureLengthMm, Na__PlanDim__FormatLength
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import { Na__PlanDim__GetLineSetup, Na__PlanDim__GetTextSetup } from '../44__System__PlanDimensions/Na__PlanDimensions__ConfigState__.js';
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

    // FUNCTION | The Paper Box a Sheet Annotation Occupies
    // ------------------------------------------------------------
    function Na__LeMarkup__AnnotationBounds(item) {
        const fontMm = item.Annotation__SizeMm;
        const width  = Math.max(fontMm, Na__LeChrome__MeasureTextMm(item.Annotation__Text, fontMm, item.Annotation__FontWeight));
        const x = item.Annotation__PosXMm - (item.Annotation__Align === 'center' ? width / 2 : (item.Annotation__Align === 'right' ? width : 0));
        return { X : x, Y : item.Annotation__PosYMm - (fontMm * Na__LeMarkup__CAP_HEIGHT), WidthMm : width, HeightMm : fontMm * (Na__LeMarkup__CAP_HEIGHT + Na__LeMarkup__DESCENT) };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Sheet Dimension Measures, in Model Millimetres
    // ------------------------------------------------------------
    function Na__LeMarkup__DimensionValueMm(sheet, dim) {
        const paperMm = Math.hypot(dim.Dimension__EndXMm - dim.Dimension__StartXMm, dim.Dimension__EndYMm - dim.Dimension__StartYMm);
        const viewport = dim.Dimension__ViewportId ? Na__LeModel__GetViewportById(sheet, dim.Dimension__ViewportId) : null;
        if (viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D) return paperMm * viewport.Viewport__ScaleDenominator;
        return paperMm;
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
            dim.Dimension__OffsetMm, setup.extGapMm, setup.overshootMm
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Sheet Annotation With Its Leader
    // ------------------------------------------------------------
    function Na__LeMarkup__PushAnnotation(list, item, textSetup) {
        const fontMm = item.Annotation__SizeMm;
        if (Number.isFinite(item.Annotation__LeaderXMm) && Number.isFinite(item.Annotation__LeaderYMm)) {
            const bounds = Na__LeMarkup__AnnotationBounds(item);
            const midY   = bounds.Y + (bounds.HeightMm / 2);
            const tipX   = item.Annotation__LeaderXMm, tipY = item.Annotation__LeaderYMm;
            const endX   = tipX < bounds.X ? bounds.X - 0.8 : (tipX > bounds.X + bounds.WidthMm ? bounds.X + bounds.WidthMm + 0.8 : tipX);
            const endY   = (tipX >= bounds.X && tipX <= bounds.X + bounds.WidthMm) ? (tipY < midY ? bounds.Y - 0.6 : bounds.Y + bounds.HeightMm + 0.6) : midY;
            Na__LeChrome__PushLine(list, tipX, tipY, endX, endY, item.Annotation__Colour, textSetup.leaderStrokeMm);
            const r = Na__LeMarkup__LEADER_DOT_MM;
            const dot = [];
            for (let i = 0; i < 8; i++) dot.push([ tipX + (Math.cos(i * Math.PI / 4) * r), tipY + (Math.sin(i * Math.PI / 4) * r) ]);
            Na__LeChrome__PushPolyline(list, dot, null, 0, item.Annotation__Colour, true);
        }
        Na__LeChrome__PushText(list, {
            X : item.Annotation__PosXMm, BaselineY : item.Annotation__PosYMm, Text : item.Annotation__Text, FontMm : fontMm,
            Weight : item.Annotation__FontWeight, Colour : item.Annotation__Colour, Align : item.Annotation__Align, FontFamily : textSetup.fontFamily
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Sheet's Own Markup as Paper Primitives
    // ------------------------------------------------------------
    // selection: { kind, id } or null; the highlight is drawn last.
    // ------------------------------------------------------------
    function Na__LeMarkup__BuildSheetPrimitives(sheet, layout, selection) {
        const list = [];
        if (!sheet) return list;
        const textSetup = Na__LeCfg__GetTextSetup();
        const dimSetup  = Na__LeCfg__GetDimensionSetup();
        const style     = Na__LeCfg__GetStyleSetup();
        let highlight   = null;

        // SHAPES | Under the text and the dimensions
        sheet.Sheet__Shapes.forEach((shape) => {
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId)) return;
            Na__LeShapeGeo__Push(list, shape);
            if (selection && selection.kind === 'shape' && selection.id === shape.Shape__Id) highlight = Na__LeShapeGeo__Bounds(shape);
        });

        sheet.Sheet__Annotations.forEach((item) => {
            if (!Na__LeModel__IsLayerVisible(sheet, item.Annotation__LayerId)) return;
            Na__LeMarkup__PushAnnotation(list, item, textSetup);
            if (selection && selection.kind === 'annotation' && selection.id === item.Annotation__Id) highlight = Na__LeMarkup__AnnotationBounds(item);
        });

        sheet.Sheet__Dimensions.forEach((dim) => {
            if (!Na__LeModel__IsLayerVisible(sheet, dim.Dimension__LayerId)) return;
            const sk = Na__LeDimGeo__Push(list, {
                start : { x : dim.Dimension__StartXMm, y : dim.Dimension__StartYMm },
                end   : { x : dim.Dimension__EndXMm,   y : dim.Dimension__EndYMm },
                offsetMm : dim.Dimension__OffsetMm, gapMm : dimSetup.extGapMm, overshootMm : dimSetup.overshootMm,
                tickMm : dimSetup.tickLengthMm, strokeMm : Na__LeMarkup__DimensionStrokeMm(sheet, dimSetup), colour : dim.Dimension__Colour,
                terminator : dim.Dimension__Terminator,
                text : Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim)),
                fontMm : dim.Dimension__TextSizeMm, weight : 400, liftMm : dimSetup.textGapMm, fontFamily : textSetup.fontFamily
            });
            if (sk && selection && selection.kind === 'dimension' && selection.id === dim.Dimension__Id) {
                const xs = [ sk.S.x, sk.E.x, sk.T1.x, sk.T2.x ], ys = [ sk.S.y, sk.E.y, sk.T1.y, sk.T2.y ];
                const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
                const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
                highlight = { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
            }
        });

        if (highlight) {
            const pad = Na__LeMarkup__SELECT_PAD_MM;
            Na__LeChrome__PushRect(list, highlight.X - pad, highlight.Y - pad, highlight.WidthMm + (pad * 2), highlight.HeightMm + (pad * 2), style.selectionColour, 0.3, null, 1.2);
        }
        return list;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Sheet Markup Item Is Under a Paper Point
    // ------------------------------------------------------------
    // Returns { kind : 'dimension' | 'annotation' | 'shape', id } or null, in
    // that order of priority. Locked and hidden layers are skipped; later
    // items of a kind win, as they draw on top.
    // ------------------------------------------------------------
    function Na__LeMarkup__HitTest(sheet, pointMm, toleranceMm) {
        if (!sheet) return null;
        const tol = Number.isFinite(toleranceMm) ? toleranceMm : 1.5;
        const editable = (layerId) => Na__LeModel__IsLayerVisible(sheet, layerId) && !Na__LeModel__IsLayerLocked(sheet, layerId);

        // DIMENSIONS FIRST | Thin lines are hard to hit, so the lines take a
        // wider tolerance and the value text counts as part of the dimension.
        const dimSetup = Na__LeCfg__GetDimensionSetup();
        const lineTol  = tol * 1.5;
        for (let i = sheet.Sheet__Dimensions.length - 1; i >= 0; i--) {
            const dim = sheet.Sheet__Dimensions[i];
            if (!editable(dim.Dimension__LayerId)) continue;
            const sk = Na__LeMarkup__DimensionSkeleton(dim);
            if (!sk) continue;
            if (Na__LeDimGeo__DistanceToSegment(pointMm, sk.DS, sk.DE) <= lineTol ||
                Na__LeDimGeo__DistanceToSegment(pointMm, sk.X1, sk.T1) <= lineTol ||
                Na__LeDimGeo__DistanceToSegment(pointMm, sk.X2, sk.T2) <= lineTol) return { kind : 'dimension', id : dim.Dimension__Id };
            const text  = Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim));
            const place = Na__LeDimGeo__TextPlacement(sk, dimSetup.textGapMm);
            const reach = Math.max(dim.Dimension__TextSizeMm, Na__LeChrome__MeasureTextMm(text, dim.Dimension__TextSizeMm, 400) / 2) + tol;
            if (Math.hypot(pointMm.x - place.x, pointMm.y - place.y) <= reach) return { kind : 'dimension', id : dim.Dimension__Id };
        }
        for (let i = sheet.Sheet__Annotations.length - 1; i >= 0; i--) {
            const item = sheet.Sheet__Annotations[i];
            if (!editable(item.Annotation__LayerId)) continue;
            const b = Na__LeMarkup__AnnotationBounds(item);
            if (pointMm.x >= b.X - tol && pointMm.x <= b.X + b.WidthMm + tol && pointMm.y >= b.Y - tol && pointMm.y <= b.Y + b.HeightMm + tol) {
                return { kind : 'annotation', id : item.Annotation__Id };
            }
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
        Na__LeMarkup__DimensionValueMm,
        Na__LeMarkup__FormatDimension,
        Na__LeMarkup__DimensionSkeleton,
        Na__LeMarkup__BuildSheetPrimitives,
        Na__LeMarkup__HitTest
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
