// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET RECORDS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetRecords__.js
// NAMESPACE  : Na__LeRec
// MODULE     : Layout Editor - Sheet Records
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The shape of every sheet record: kinds, ids, defaults, normalisation and the title block fields
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Pure record arithmetic split out of the sheet model so the model keeps
//   to the house line budget: id generation, number coercion, the
//   normalisers that fill a sheet, layer, viewport, annotation or
//   dimension record with its defaults, the default layer of a kind, and
//   the title block fields with the project defaults filled in.
// - Nothing here dispatches, touches session state or knows the DOM.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__SheetModel__.js, which re-exports the
//   kind and type constants under its own names.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetRecords__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.2.0
// - Shape__Gradient on the shape record: null for none, otherwise made whole by
//   Na__LayoutEditor__GradientTool__ as a fresh object on every normalise. A
//   gradient counts as the fill in the guard that keeps a shape visible.
//
// 10-Sep-2026 - Version 1.1.4
// - Shape__Stroked on the shape record, defaulting on, with the guard that
//   a shape with no fill keeps its edges.
//
// 10-Sep-2026 - Version 1.1.3
// - The contextLayer style (the existing building and its surroundings in a viewport's render).
//
// 10-Sep-2026 - Version 1.1.2
// - The baseImage style (the rendered picture behind a viewport).
//
// 10-Sep-2026 - Version 1.1.1
// - The snapshot asset carries Asset__PixelWidth (null when unknown).
//
// 10-Sep-2026 - Version 1.1.0
// - Vector shapes (Sheet__Shapes, layer type 'vector', a Vectors layer on new sheets), Sheet__Lineweights in points, the enhanceWhitecard style.
//
// 10-Sep-2026 - Version 1.0.1
// - New viewport style toggles come from LayoutEditor__Viewport__DefaultStyles (projected linework off until asked for).
//
// 10-Sep-2026 - Version 1.0.0
// - Split from the sheet model (record helpers, normalisers, fields).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Scale, Project Code and Scenes
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__GetTitleBlockSetup,
        Na__LeCfg__GetViewportSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__FormatLabel,
        Na__LeCfg__GetLineweightSetup,
        Na__LeCfg__GetShapeSetup
    } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeScale__Coerce, Na__LeScale__SheetLabel } from './Na__LayoutEditor__ScaleManager__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Edge Styles and Composite Weights
    // ------------------------------------------------------------
    // Both modules are leaves: they read their own config and know nothing about
    // records, so importing them here cannot cycle.
    // ------------------------------------------------------------
    import {
        Na__LeEdge__FIELD,
        Na__LeEdge__CAT_FIELD,
        Na__LeEdge__IsLoaded,
        Na__LeEdge__IsColour,
        Na__LeEdge__IsLineType,
        Na__LeEdge__ClampWeight,
        Na__LeEdge__Default
    } from './Na__LayoutEditor__EdgeStyles__.js';
    import {
        Na__LeComposite__FIELD,
        Na__LeComposite__Row,
        Na__LeComposite__Clamp
    } from './Na__LayoutEditor__RenderComposites__.js';
    import { Na__LeGrad__Normalise } from './Na__LayoutEditor__GradientTool__.js';   // <-- A leaf too: it reaches only the panel host, which reaches only the config
    import { Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Kinds, Layer Types, Style Keys and Id Padding
    // ------------------------------------------------------------
    const Na__LeRec__KIND_2D     = '2d';
    const Na__LeRec__KIND_3D     = '3d';
    const Na__LeRec__LAYER_TYPES = [ 'viewport', 'annotation', 'dimension', 'vector', 'mixed' ];
    const Na__LeRec__STYLE_KEYS  = [ 'baseImage', 'projectedLinework', 'profileLinework', 'glassOpaque', 'whitecard', 'hiddenLines', 'enhanceWhitecard', 'contextLayer' ];
    const Na__LeRec__ID_PAD      = 3;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Next Id With a Prefix, Unique in a List
    // ------------------------------------------------------------
    function Na__LeRec__NextId(list, prefix, idKey) {
        let highest = 0;
        for (let i = 0; i < list.length; i++) {
            const value = list[i] && list[i][idKey];
            const match = (typeof value === 'string') ? value.match(/(\d+)$/) : null;
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        }
        return prefix + String(highest + 1).padStart(Na__LeRec__ID_PAD, '0');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Coerce a Number, or Fall Back
    // ------------------------------------------------------------
    function Na__LeRec__Num(value, fallback) {
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find a Record by Id in a List
    // ------------------------------------------------------------
    function Na__LeRec__Find(list, idKey, id) {
        for (let i = 0; i < list.length; i++) if (list[i] && list[i][idKey] === id) return list[i];
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Normalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fill a Layer Record's Defaults
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseLayer(layer, index) {
        if (typeof layer.Layer__Name !== 'string') layer.Layer__Name = 'Layer ' + (index + 1);
        if (Na__LeRec__LAYER_TYPES.indexOf(layer.Layer__Type) === -1) layer.Layer__Type = 'mixed';
        if (layer.Layer__Visible === undefined) layer.Layer__Visible = true;
        if (layer.Layer__Locked  === undefined) layer.Layer__Locked  = false;
        layer.Layer__Order = Na__LeRec__Num(layer.Layer__Order, index + 1);
        return layer;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep Only the Edge Styles Someone Actually Chose
    // ------------------------------------------------------------
    // A stored entry is written out in full - label and all three values - so a
    // project file can be read without cross-referencing the config. In exchange
    // it is pruned hard: every value is coerced into something the palette
    // actually contains, and an entry that has come back round to the config
    // default is deleted, so the file only ever holds real decisions.
    //
    // THE PRUNE WAITS FOR THE CONFIG. Before the fetch lands the "default" is a
    // built-in black solid line, and deleting against that would throw away a
    // deliberate choice of black solid. Until it lands, entries are cleaned but
    // never dropped.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseProjectedEdges(block) {
        if (!block || typeof block !== 'object') return null;
        const source = block[Na__LeEdge__CAT_FIELD];
        if (!source || typeof source !== 'object') return null;

        const canPrune = Na__LeEdge__IsLoaded();
        const kept     = {};

        Object.keys(source).forEach((key) => {
            const entry = source[key];
            if (!entry || typeof entry !== 'object') return;

            const fallback = Na__LeEdge__Default(key);
            const weight   = Na__LeEdge__ClampWeight(entry['Category__EdgeWeightFactor']);
            const colour   = Na__LeEdge__IsColour(entry['Category__EdgeColour'])     ? entry['Category__EdgeColour']   : fallback.colour;
            const lineType = Na__LeEdge__IsLineType(entry['Category__EdgeLineType']) ? entry['Category__EdgeLineType'] : fallback.lineType;

            if (canPrune && weight === Na__LeEdge__ClampWeight(fallback.weight) && colour === fallback.colour && lineType === fallback.lineType) {
                return;                                                            // <-- Back to the default: the record says nothing
            }

            kept[key] = {
                'Category__Label'            : typeof entry['Category__Label'] === 'string' && entry['Category__Label'] ? entry['Category__Label'] : key,
                'Category__EdgeWeightFactor' : weight,
                'Category__EdgeColour'       : colour,
                'Category__EdgeLineType'     : lineType
            };
        });

        if (Object.keys(kept).length === 0) return null;

        const out = {};
        out['Edges__Description'] = 'Projected linework style for this viewport only, per SketchUp model category. Weight is a multiplier on the sheet master viewport lineweight; the colour and line type are aliases from Na__LayoutEditor__EdgeStyles__Config__.json. A category absent from this list draws at the default in Na__LayoutEditor__ModelLayers__Config__.json. Visibility is NOT here - that is Viewport__ModelLayers.';
        if (typeof block['Edges__UpdatedIso'] === 'string') out['Edges__UpdatedIso'] = block['Edges__UpdatedIso'];
        out[Na__LeEdge__CAT_FIELD] = kept;
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep Only the Composite Weights Someone Actually Set
    // ------------------------------------------------------------
    // A flat map of key to number, because a composite weight is one number with
    // no wording worth repeating. A key the config has never heard of, or one
    // whose composite has no weight at all, is dropped rather than carried.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseCompositeWeights(block) {
        if (!block || typeof block !== 'object') return null;
        const kept = {};
        Object.keys(block).forEach((key) => {
            const row = Na__LeComposite__Row(key);
            if (!row || row.weight.kind === 'none') return;
            const value = Na__LeComposite__Clamp(key, block[key]);
            if (Number.isFinite(value)) kept[key] = value;
        });
        return Object.keys(kept).length > 0 ? kept : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill a Viewport Record's Defaults
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseViewport(viewport, defaultLayerId) {
        const setup = Na__LeCfg__GetViewportSetup();
        if (viewport.Viewport__Kind !== Na__LeRec__KIND_3D) viewport.Viewport__Kind = Na__LeRec__KIND_2D;
        if (typeof viewport.Viewport__Name !== 'string') viewport.Viewport__Name = '';
        if (!viewport.Viewport__LayerId) viewport.Viewport__LayerId = defaultLayerId;
        if (viewport.Viewport__SceneId   === undefined) viewport.Viewport__SceneId   = null;
        if (viewport.Viewport__DrawingId === undefined) viewport.Viewport__DrawingId = null;

        const frame = viewport.Viewport__FrameMm || {};
        viewport.Viewport__FrameMm = {
            X        : Na__LeRec__Num(frame.X, 20),
            Y        : Na__LeRec__Num(frame.Y, 20),
            WidthMm  : Math.max(setup.minSizeMm, Na__LeRec__Num(frame.WidthMm,  setup.defaultWidthMm)),
            HeightMm : Math.max(setup.minSizeMm, Na__LeRec__Num(frame.HeightMm, setup.defaultHeightMm))
        };
        viewport.Viewport__ScaleDenominator = Na__LeScale__Coerce(viewport.Viewport__ScaleDenominator);

        const pan = viewport.Viewport__PanMm || {};
        viewport.Viewport__PanMm = { X : Na__LeRec__Num(pan.X, 0), Y : Na__LeRec__Num(pan.Y, 0) };

        const image = viewport.Viewport__ImageMm || {};
        viewport.Viewport__ImageMm = {
            WidthMm  : Na__LeRec__Num(image.WidthMm,  viewport.Viewport__FrameMm.WidthMm),
            HeightMm : Na__LeRec__Num(image.HeightMm, viewport.Viewport__FrameMm.HeightMm)
        };
        const offset = viewport.Viewport__ImageOffsetMm || {};
        viewport.Viewport__ImageOffsetMm = { X : Na__LeRec__Num(offset.X, 0), Y : Na__LeRec__Num(offset.Y, 0) };

        // MODEL LAYERS | Only the categories switched OFF are kept
        // A viewport records dissent, not consent: an absent key is on. That
        // way a model that gains a category later shows it in every viewport
        // instead of inheriting a silence nobody meant, and a viewport nobody
        // has touched carries no field at all.
        const modelLayers = viewport.Viewport__ModelLayers;
        if (modelLayers && typeof modelLayers === 'object') {
            const kept = {};
            Object.keys(modelLayers).forEach((key) => { if (modelLayers[key] === false) kept[key] = false; });
            viewport.Viewport__ModelLayers = Object.keys(kept).length > 0 ? kept : null;
        } else {
            viewport.Viewport__ModelLayers = null;
        }

        // STYLES | A stored flag stands; anything unset takes the configured default
        const styles   = viewport.Viewport__Styles || {};
        const defaults = setup.defaultStyles;
        const pick     = (key) => (typeof styles[key] === 'boolean' ? styles[key] : defaults[key]);
        viewport.Viewport__Styles = {
            baseImage         : pick('baseImage'),
            projectedLinework : pick('projectedLinework'),
            profileLinework   : pick('profileLinework'),
            glassOpaque       : pick('glassOpaque'),
            whitecard         : pick('whitecard'),
            hiddenLines       : pick('hiddenLines'),
            enhanceWhitecard  : pick('enhanceWhitecard'),
            contextLayer      : pick('contextLayer')
        };
        // PROJECTED EDGE STYLES and COMPOSITE WEIGHTS | Curation, stored only
        // where it happened. Both are null on a viewport nobody has curated,
        // which is the overwhelming majority, so the ordinary project file is
        // exactly the size it was before the feature existed.
        viewport[Na__LeEdge__FIELD]      = Na__LeRec__NormaliseProjectedEdges(viewport[Na__LeEdge__FIELD]);
        viewport[Na__LeComposite__FIELD] = Na__LeRec__NormaliseCompositeWeights(viewport[Na__LeComposite__FIELD]);

        if (viewport.Viewport__MarkupMode !== 'sheet') viewport.Viewport__MarkupMode = 'scene';
        if (viewport.Viewport__ShowScaleLabel === undefined) viewport.Viewport__ShowScaleLabel = setup.showScaleLabel;
        // SNAPSHOT ASSET | { Asset__Path, Asset__Fingerprint, Asset__PixelWidth }.
        // The width says how big the stored picture is, so a stored picture
        // that is too small for the working level is re-rendered instead of
        // being shown blurred. An asset written before this key existed reads
        // as unknown and is treated as too small.
        const slot = viewport.Viewport__SnapshotAsset;
        if (!slot || typeof slot !== 'object' || typeof slot.Asset__Path !== 'string') viewport.Viewport__SnapshotAsset = null;
        else if (!Number.isFinite(slot.Asset__PixelWidth)) slot.Asset__PixelWidth = null;
        if (typeof viewport.Viewport__Locked !== 'boolean') viewport.Viewport__Locked = false;   // <-- A locked viewport cannot be entered, moved or resized
        return viewport;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill an Annotation Record's Defaults
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseAnnotation(item, defaultLayerId) {
        const setup = Na__LeCfg__GetTextSetup();
        if (!item.Annotation__LayerId) item.Annotation__LayerId = defaultLayerId;
        if (typeof item.Annotation__Text !== 'string') item.Annotation__Text = setup.defaultText;
        item.Annotation__PosXMm  = Na__LeRec__Num(item.Annotation__PosXMm, 20);
        item.Annotation__PosYMm  = Na__LeRec__Num(item.Annotation__PosYMm, 20);
        item.Annotation__SizeMm  = Na__LeRec__Num(item.Annotation__SizeMm, setup.defaultSizeMm);
        item.Annotation__FontWeight = Na__LeRec__Num(item.Annotation__FontWeight, setup.defaultWeight);
        if (typeof item.Annotation__Colour !== 'string') item.Annotation__Colour = setup.defaultColour;
        if ([ 'left', 'center', 'right' ].indexOf(item.Annotation__Align) === -1) item.Annotation__Align = 'left';
        if (item.Annotation__LeaderXMm === undefined) item.Annotation__LeaderXMm = null;
        if (item.Annotation__LeaderYMm === undefined) item.Annotation__LeaderYMm = null;
        return item;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill a Dimension Record's Defaults
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseDimension(item, defaultLayerId) {
        const setup = Na__LeCfg__GetDimensionSetup();
        if (!item.Dimension__LayerId) item.Dimension__LayerId = defaultLayerId;
        if (item.Dimension__ViewportId === undefined) item.Dimension__ViewportId = null;
        item.Dimension__StartXMm   = Na__LeRec__Num(item.Dimension__StartXMm, 20);
        item.Dimension__StartYMm   = Na__LeRec__Num(item.Dimension__StartYMm, 20);
        item.Dimension__EndXMm     = Na__LeRec__Num(item.Dimension__EndXMm, 60);
        item.Dimension__EndYMm     = Na__LeRec__Num(item.Dimension__EndYMm, 20);
        item.Dimension__OffsetMm   = Na__LeRec__Num(item.Dimension__OffsetMm, setup.defaultOffsetMm);
        item.Dimension__TextSizeMm = Na__LeRec__Num(item.Dimension__TextSizeMm, setup.defaultTextSizeMm);
        if (typeof item.Dimension__Colour !== 'string') item.Dimension__Colour = setup.defaultColour;
        if (setup.terminators.indexOf(item.Dimension__Terminator) === -1) item.Dimension__Terminator = setup.defaultTerminator;
        item.Dimension__Precision = Na__LeRec__Num(item.Dimension__Precision, setup.defaultPrecision);
        if (typeof item.Dimension__UnitsSuffix !== 'string') item.Dimension__UnitsSuffix = setup.defaultUnits;
        if (item.Dimension__OverrideText === undefined) item.Dimension__OverrideText = null;
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In a Vector Shape (points [[x, y], ...] paper mm, weight in points)
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseShape(item, defaultLayerId) {
        const setup = Na__LeCfg__GetShapeSetup();
        if (!item.Shape__LayerId) item.Shape__LayerId = defaultLayerId;
        const raw = Array.isArray(item.Shape__Points) ? item.Shape__Points : [];
        item.Shape__Points = raw.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [ p[0], p[1] ]);
        item.Shape__Closed = item.Shape__Closed === true;
        if (typeof item.Shape__StrokeColour !== 'string') item.Shape__StrokeColour = setup.defaultStrokeColour;
        item.Shape__StrokePt = Na__LeRec__Num(item.Shape__StrokePt, setup.defaultStrokePt);
        if (typeof item.Shape__FillColour !== 'string') item.Shape__FillColour = null;
        item.Shape__Gradient = Na__LeGrad__Normalise(item.Shape__Gradient);              // <-- A fresh object or null: no two shapes ever hold the same gradient
        item.Shape__Stroked = item.Shape__Stroked !== false;                             // <-- A record written before the flag existed drew its edges
        const filled  = item.Shape__FillColour !== null || item.Shape__Gradient !== null;   // <-- A gradient is a fill as far as visibility goes
        const canFill = filled && item.Shape__Points.length > 2;                            // <-- Two points enclose nothing, so they cannot be a fill
        if (!item.Shape__Stroked && !canFill) item.Shape__Stroked = true;                   // <-- Edges or fill, never neither: an invisible shape is a lost shape
        return item;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill a Sheet Record's Defaults (mutates in place)
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseSheet(sheet, index) {
        const sheetSetup = Na__LeCfg__GetSheetSetup();
        const titleSetup = Na__LeCfg__GetTitleBlockSetup();

        if (typeof sheet.Sheet__Name !== 'string' || !sheet.Sheet__Name) {
            sheet.Sheet__Name = Na__LeCfg__FormatLabel('SheetNameFormat', sheetSetup.defaultNameFormat, { index : index + 1 });
        }
        sheet.Sheet__Order = Na__LeRec__Num(sheet.Sheet__Order, index + 1);
        if (!sheet.Sheet__PaperSize || !sheetSetup.paperSizes[sheet.Sheet__PaperSize]) sheet.Sheet__PaperSize = sheetSetup.defaultPaperSize;
        if (sheet.Sheet__Orientation !== 'portrait') sheet.Sheet__Orientation = 'landscape';
        if (sheet.Sheet__TitleBlockStyle !== 'classic' && sheet.Sheet__TitleBlockStyle !== 'modern') sheet.Sheet__TitleBlockStyle = titleSetup.defaultStyle;
        if (!sheet.Sheet__Fields || typeof sheet.Sheet__Fields !== 'object') sheet.Sheet__Fields = {};

        if (!Array.isArray(sheet.Sheet__Layers) || sheet.Sheet__Layers.length === 0) {
            sheet.Sheet__Layers = [
                { Layer__Id : 'Layer_001', Layer__Name : 'Viewports',  Layer__Type : 'viewport',   Layer__Visible : true, Layer__Locked : false, Layer__Order : 1 },
                { Layer__Id : 'Layer_002', Layer__Name : 'Text',       Layer__Type : 'annotation', Layer__Visible : true, Layer__Locked : false, Layer__Order : 2 },
                { Layer__Id : 'Layer_003', Layer__Name : 'Dimensions', Layer__Type : 'dimension',  Layer__Visible : true, Layer__Locked : false, Layer__Order : 3 },
                { Layer__Id : 'Layer_004', Layer__Name : 'Vectors',    Layer__Type : 'vector',     Layer__Visible : true, Layer__Locked : false, Layer__Order : 4 }
            ];
        }
        sheet.Sheet__Layers.forEach(Na__LeRec__NormaliseLayer);
        sheet.Sheet__Layers.sort((a, b) => a.Layer__Order - b.Layer__Order);

        if (!Array.isArray(sheet.Sheet__Viewports))   sheet.Sheet__Viewports   = [];
        if (!Array.isArray(sheet.Sheet__Annotations)) sheet.Sheet__Annotations = [];
        if (!Array.isArray(sheet.Sheet__Dimensions))  sheet.Sheet__Dimensions  = [];
        if (!Array.isArray(sheet.Sheet__Shapes))      sheet.Sheet__Shapes      = [];

        // LINEWEIGHTS | Printed points per sheet, seeded from the config
        const lwSetup = Na__LeCfg__GetLineweightSetup();
        const lw = (sheet.Sheet__Lineweights && typeof sheet.Sheet__Lineweights === 'object') ? sheet.Sheet__Lineweights : {};
        sheet.Sheet__Lineweights = { ViewportPt : Na__LeRec__Num(lw.ViewportPt, lwSetup.viewportPt), DimensionPt : Na__LeRec__Num(lw.DimensionPt, lwSetup.dimensionPt) };

        sheet.Sheet__Viewports.forEach((v)   => Na__LeRec__NormaliseViewport(v,   Na__LeRec__DefaultLayerId(sheet, 'viewport')));
        sheet.Sheet__Annotations.forEach((a) => Na__LeRec__NormaliseAnnotation(a, Na__LeRec__DefaultLayerId(sheet, 'annotation')));
        sheet.Sheet__Dimensions.forEach((d)  => Na__LeRec__NormaliseDimension(d,  Na__LeRec__DefaultLayerId(sheet, 'dimension')));
        sheet.Sheet__Shapes.forEach((sh)     => Na__LeRec__NormaliseShape(sh,     Na__LeRec__DefaultLayerId(sheet, 'vector')));
        return sheet;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layers and Fields
// -----------------------------------------------------------------------------

    // FUNCTION | The Layer New Items of a Type Land On
    // ------------------------------------------------------------
    function Na__LeRec__DefaultLayerId(sheet, type) {
        const layers = sheet ? sheet.Sheet__Layers : [];
        for (let i = 0; i < layers.length; i++) if (layers[i].Layer__Type === type) return layers[i].Layer__Id;
        for (let i = 0; i < layers.length; i++) if (layers[i].Layer__Type === 'mixed') return layers[i].Layer__Id;
        return layers.length ? layers[0].Layer__Id : 'Layer_001';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title Block Fields With Project Defaults Filled In
    // ------------------------------------------------------------
    function Na__LeRec__BuildFields(sheet) {
        const setup   = Na__LeCfg__GetTitleBlockSetup();
        const stored  = (sheet && sheet.Sheet__Fields) || {};
        const config  = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const project = (config && (config.projectName || config.displayName)) || '';
        const code    = Na__DrawData__GetProjectCode() || '';
        const index   = sheet ? sheet.Sheet__Order : 1;
        const scales  = (sheet ? sheet.Sheet__Viewports : []).filter((v) => v.Viewport__Kind === Na__LeRec__KIND_2D).map((v) => v.Viewport__ScaleDenominator);
        const today   = new Date();
        const dateText = String(today.getDate()).padStart(2, '0') + ' ' +
            [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][today.getMonth()] + ' ' + today.getFullYear();

        const defaults = {
            Client        : project,
            SiteAddress   : '',
            Title         : sheet ? sheet.Sheet__Name : '',
            DrawingNumber : (code ? code + '-' : '') + String(index).padStart(2, '0'),
            Revision      : 'A',
            Scale         : Na__LeScale__SheetLabel(scales),
            Date          : dateText,
            DrawnBy       : setup.drawnByDefault
        };
        const fields = {};
        Object.keys(defaults).forEach((key) => {
            const value = stored['Sheet__Fields__' + key];
            fields[key] = (typeof value === 'string') ? value : defaults[key];
        });
        return fields;
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Records API
    // ------------------------------------------------------------
    export {
        Na__LeRec__KIND_2D,
        Na__LeRec__KIND_3D,
        Na__LeRec__LAYER_TYPES,
        Na__LeRec__STYLE_KEYS,
        Na__LeRec__NormaliseShape,
        Na__LeRec__NextId,
        Na__LeRec__Num,
        Na__LeRec__Find,
        Na__LeRec__NormaliseLayer,
        Na__LeRec__NormaliseViewport,
        Na__LeRec__NormaliseAnnotation,
        Na__LeRec__NormaliseDimension,
        Na__LeRec__NormaliseSheet,
        Na__LeRec__DefaultLayerId,
        Na__LeRec__BuildFields
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
