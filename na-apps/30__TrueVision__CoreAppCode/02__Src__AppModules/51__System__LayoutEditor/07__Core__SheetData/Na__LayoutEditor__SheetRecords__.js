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
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (Sheet__DrawingType), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.21.0
// - Short tab names. DrawingNumber answers a sheet's drawing number without
//   building every title block field; ShortCode cuts it down to what a tab
//   carries ("PS01_T02_D03" gives "D03"); StripSheetCode takes a code of the
//   pack's own series off the front of a name ("D03 - 3D Images" gives
//   "3D Images").
// - NormaliseSheet strips the name, so Sheet__Name holds the words and the
//   Drawing Register holds the number. A stored title that was only ever the
//   name is stripped with it; a title typed separately is never touched.
//
// 17-Sep-2026 - Version 1.20.0
// - BuildFields hands the sheet's resolved paper label to SheetLabel, so the
//   title block's Scale cell reads "1:50 @ ISO A2" and, where the viewports on
//   a sheet disagree, "1:50 & 1:100 @ ISO A2".
//
// 14-Sep-2026 - Version 1.19.0
// - Viewport__ImageZoom on the viewport record: how large a 3D viewport's
//   picture is drawn, as a multiple of Viewport__ImageMm. Held inside the
//   Viewport setup's ImageZoomMin and ImageZoomMax, and stored only when it is
//   not 1, so every record from before it is exactly what it was.
//
// 14-Sep-2026 - Version 1.18.0
// - NormaliseMarginNotes: a margin still on 2.2 mm or the brief 9 pt body
//   size adopts the config size, now 2 mm.
//
// 14-Sep-2026 - Version 1.17.0
// - NormaliseMarginNotes: a margin still on the old 2.2 mm body size (the
//   shipped default) adopts the config size, now 9 pt.
//
// 14-Sep-2026 - Version 1.16.0
// - Viewport__SitePlan on the viewport record: an object, kept only on a viewport
//   that draws the project's site plan data. Such a viewport is always 2D with no
//   drawing id, and its scale is coerced onto the site plan list (1:500, 1:1250)
//   rather than the architectural one. IsSitePlanViewport reads it. Every viewport
//   from before it is unchanged.
// - A site plan category's edge style is never pruned as a default: its default
//   comes from the export and is not known until the data loads.
//
// 14-Sep-2026 - Version 1.15.0
// - Sheet__DrawingType on the sheet record: stored only as 'siteplan' (a Site
//   Plan Drawing). The normaliser removes any other value and never adds the
//   key, so every sheet from before it stays exactly what it was and reads as
//   an architectural drawing. IsSitePlanSheet reads it.
//
// 14-Sep-2026 - Version 1.14.0
// - Shape__LineStyle on the shape record: null for a solid edge, otherwise
//   made whole by Na__LayoutEditor__LineStyleTool__ as a fresh object on every
//   normalise. A record from before the toggle has no key and stays a solid
//   line.
//
// 14-Sep-2026 - Version 1.13.0
// - Sheet__Groups on every sheet, and NormaliseGroup: a group is an id and a
//   list of members ({ kind, id } of a vector, a text item or another group).
//   Members stay first-class sheet records and keep drawing; the group is the
//   selection and the copy unit. A record from before groups carries no key
//   and the normaliser adds an empty list, so every older sheet is unchanged.
//
// 14-Sep-2026 - Version 1.12.0
// - Dimension__TextDXMm and Dimension__TextDYMm on the dimension record: the
//   value's paper offset from where it would have sat on the line. Kept only
//   as a finite pair that actually shifts the value; the normaliser removes
//   both when they are missing, not numbers, or both zero, so a record from
//   before them stays exactly what it was and the value sits on the line.
//
// 14-Sep-2026 - Version 1.11.0
// - Dimension__TickLengthMm on the dimension record: how large the ticks,
//   arrows or dots at each end are, in paper millimetres. Kept only as a
//   number above zero, clamped to the config min and max; the normaliser
//   removes anything else and never adds the key, so a record from before it
//   stays exactly what it was and draws at TickLengthMm from the config.
//
// 14-Sep-2026 - Version 1.10.0
// - Viewport__ClosedDoors on the viewport record: the door keys a plan viewport
//   draws shut (an ADR name, or ADR::MOD for one leaf of an independent pair).
//   Kept only when it lists a door, trimmed, without repeats and sorted, so a
//   viewport with every door open - every record from before - is unchanged.
//
// 14-Sep-2026 - Version 1.9.0
// - Fixed length extension lines on the dimension record:
//   Dimension__StartExtensionMm and Dimension__EndExtensionMm, how far each
//   extension line runs back from the dimension line (a number of zero or
//   more), and Dimension__ExtensionsLinked, stored only as false while the
//   Dimensions panel's padlock is open. The normaliser removes any other value
//   and never adds a key, so every record from before them - and a browser
//   draft of one - stays exactly what it was, with its full lines.
//
// 14-Sep-2026 - Version 1.8.0
// - Dimension__AtScale on the dimension record: true reads the drawing's scale,
//   false the paper (Na__LayoutEditor__DrawingScale__). Stored only as a
//   boolean - the normaliser removes anything else and never adds the key - so
//   every record from before it, and a browser draft of one, stays exactly what
//   it was and reads as it always did.
//
// 14-Sep-2026 - Version 1.7.0
// - Viewport__ShowFrame on the viewport record, stored only as false: the
//   viewport's frame and caption are hidden. Any other value is removed, so a
//   record from before the switch - and a browser draft of one - stays exactly
//   what it was, and draws its frame as it always did.
//
// 14-Sep-2026 - Version 1.6.0
// - Project Specification: a linked bubble carries Leader__SpecNoteId, the id
//   of the specification note whose code it shows. NormaliseLeader only
//   touches the key where it exists, so every other leader record is exactly
//   what it was.
// - NormaliseMarginNotes fills Sheet__MarginNotes - Enabled, WidthMm, Heading,
//   TextSizeMm, IncludeGeneral, GroupHeadings - on a sheet that has one;
//   MarginNotes answers a sheet's margin settings with the defaults for a sheet
//   that never had one, without writing anything to it.
//
// 14-Sep-2026 - Version 1.5.0
// - Leaders & Annotation Bubbles: Sheet__Leaders on every sheet, and
//   NormaliseLeader, which fills a leader with the Leader setup's defaults
//   (Na__LayoutEditor__LeaderGeometry__ draws it). A stored null fill is kept
//   as "no fill"; only a fill that was never written takes the default.
// - Shape__FillOpacity and Shape__StrokeOpacity on the shape record, 0 to 1.
//   Every record from before them is solid.
//
// 13-Sep-2026 - Version 1.4.0
// - Viewport__ModelSourceId on the viewport record: the design phase a viewport
//   draws, as a model group's groupId, or null for the Project Default. Every
//   record from before it is null, which draws what it always drew.
//
// 13-Sep-2026 - Version 1.3.0
// - Dimension__Orientation on the dimension record: 'aligned', 'horizontal' or
//   'vertical' (Na__LayoutEditor__DimensionGeometry__). Anything else - every
//   record from before ortho dimensions - is aligned, which is how it was drawn.
//
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
        Na__LeCfg__GetShapeSetup,
        Na__LeCfg__GetLeaderSetup,
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetDrawingRegisterSetup
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeScale__Coerce, Na__LeScale__SheetLabel } from './Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeLayout__PaperSizeMm } from './Na__LayoutEditor__SheetLayout__.js';               // <-- A leaf: it reads the sheet config and nothing else, so it cannot cycle back here
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
    } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
    import {
        Na__LeComposite__FIELD,
        Na__LeComposite__Row,
        Na__LeComposite__Clamp
    } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    import { Na__LeGrad__Normalise } from '../35__System__DrawingTools/Na__LayoutEditor__GradientTool__.js';   // <-- A leaf too: it reaches only the panel host, which reaches only the config
    import { Na__LeDash__Normalise } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeCommon__Get, Na__LeCommon__Uses, Na__LeCommon__KEYS } from './Na__LayoutEditor__SheetModel__Common__.js';   // <-- A leaf: it reaches the drawings block and the admin record, never back here
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
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
    const Na__LeRec__LEADER_TYPES       = [ 'text', 'bubble' ];             // <-- A note with a leader, or a specification bubble
    const Na__LeRec__LEADER_LINE_STYLES = [ 'solid', 'dashed' ];
    const Na__LeRec__GROUP_KINDS        = [ 'shape', 'annotation', 'group' ];   // <-- What a group may hold: vectors, text, and nested groups
    const Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural';                   // <-- A sheet with no Sheet__DrawingType
    const Na__LeRec__DRAWING_SITEPLAN      = 'siteplan';                        // <-- The only drawing type ever stored
    const Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__';       // <-- Category keys of site plan layers (the export's stems)
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


    // HELPER FUNCTION | Coerce an Opacity (0 clear to 1 solid), or Fall Back
    // ------------------------------------------------------------
    function Na__LeRec__Unit(value, fallback) {
        return (typeof value === 'number' && Number.isFinite(value)) ? Math.max(0, Math.min(1, value)) : fallback;
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

            // A SITE PLAN CATEGORY IS NEVER PRUNED: its default is the style its export
            // carries, which is not known until the site plan data has loaded.
            if (canPrune && key.indexOf(Na__LeRec__SITEPLAN_CATEGORY_PREFIX) !== 0 && weight === Na__LeEdge__ClampWeight(fallback.weight) && colour === fallback.colour && lineType === fallback.lineType) {
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


    // FUNCTION | Is This a Site Plan Viewport (Viewport__SitePlan)
    // ------------------------------------------------------------
    function Na__LeRec__IsSitePlanViewport(viewport) {
        const marker = viewport ? viewport.Viewport__SitePlan : null;
        return !!marker && typeof marker === 'object' && !Array.isArray(marker);
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
        // SITE PLAN | Viewport__SitePlan marks a viewport that draws the project's
        // site plan data (52__System__SitePlanData) rather than a plan or an
        // elevation. Kept only on such a viewport, as an object with room for the
        // settings still to come; it is always 2D and never carries a drawing id.
        if (Na__LeRec__IsSitePlanViewport(viewport)) {
            viewport.Viewport__SitePlan  = Object.assign({}, viewport.Viewport__SitePlan);
            viewport.Viewport__Kind      = Na__LeRec__KIND_2D;
            viewport.Viewport__DrawingId = null;
        } else {
            delete viewport.Viewport__SitePlan;
        }
        // MODEL SOURCE | The design phase drawn: a model group's groupId, or null
        // for the Project Default (Na__LayoutEditor__ModelSource__). An id the
        // project does not have is kept as written, so a phase folder put back
        // later brings its viewports back with it.
        const sourceId = viewport.Viewport__ModelSourceId;
        viewport.Viewport__ModelSourceId = (typeof sourceId === 'string' && sourceId.trim() !== '') ? sourceId.trim() : null;

        const frame = viewport.Viewport__FrameMm || {};
        viewport.Viewport__FrameMm = {
            X        : Na__LeRec__Num(frame.X, 20),
            Y        : Na__LeRec__Num(frame.Y, 20),
            WidthMm  : Math.max(setup.minSizeMm, Na__LeRec__Num(frame.WidthMm,  setup.defaultWidthMm)),
            HeightMm : Math.max(setup.minSizeMm, Na__LeRec__Num(frame.HeightMm, setup.defaultHeightMm))
        };
        viewport.Viewport__ScaleDenominator = Na__LeScale__Coerce(viewport.Viewport__ScaleDenominator, Na__LeRec__IsSitePlanViewport(viewport));   // <-- A site plan viewport keeps 1:500 or 1:1250

        const pan = viewport.Viewport__PanMm || {};
        viewport.Viewport__PanMm = { X : Na__LeRec__Num(pan.X, 0), Y : Na__LeRec__Num(pan.Y, 0) };

        const image = viewport.Viewport__ImageMm || {};
        viewport.Viewport__ImageMm = {
            WidthMm  : Na__LeRec__Num(image.WidthMm,  viewport.Viewport__FrameMm.WidthMm),
            HeightMm : Na__LeRec__Num(image.HeightMm, viewport.Viewport__FrameMm.HeightMm)
        };
        const offset = viewport.Viewport__ImageOffsetMm || {};
        viewport.Viewport__ImageOffsetMm = { X : Na__LeRec__Num(offset.X, 0), Y : Na__LeRec__Num(offset.Y, 0) };
        // IMAGE ZOOM | How large a 3D viewport's picture is drawn, as a multiple
        // of Viewport__ImageMm (Na__LayoutEditor__Viewport3dZoom__). Held inside
        // the configured limits and stored only when it is not 1, so a record
        // from before the zoom - and a browser draft of one - is exactly what it was.
        const imageZoom = viewport.Viewport__ImageZoom;
        const zoomKept  = (typeof imageZoom === 'number' && Number.isFinite(imageZoom) && imageZoom > 0) ? Math.min(setup.imageZoomMax, Math.max(setup.imageZoomMin, imageZoom)) : 1;
        if (zoomKept !== 1) viewport.Viewport__ImageZoom = zoomKept;
        else delete viewport.Viewport__ImageZoom;

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
        // FRAME | Stored only when hidden. A shown frame is the absent key, so a
        // record written before the switch existed is unchanged by a load, and a
        // browser draft of it still matches the sheets it was drafted from.
        if (viewport.Viewport__ShowFrame !== false) delete viewport.Viewport__ShowFrame;
        // CLOSED DOORS | The doors a plan viewport draws shut, by door key; every
        // other door on a plan is drawn open. Stored only when there is one,
        // trimmed, without repeats and sorted, so a viewport nobody has touched
        // is unchanged by a load.
        const closedDoors = Array.isArray(viewport.Viewport__ClosedDoors)
            ? Array.from(new Set(viewport.Viewport__ClosedDoors.filter((key) => typeof key === 'string' && key.trim() !== '').map((key) => key.trim()))).sort()
            : [];
        if (closedDoors.length > 0) viewport.Viewport__ClosedDoors = closedDoors;
        else delete viewport.Viewport__ClosedDoors;
        // SNAPSHOT ASSET | { Asset__Path, Asset__Fingerprint, Asset__PixelWidth,
        // Asset__Samples }. The width says how big the stored picture is, so a
        // stored picture that is too small for the working level is re-rendered
        // instead of being shown blurred. The sample count says how well it was
        // anti-aliased, which width cannot stand in for: a Medium picture on a
        // dense screen is WIDER than the export wants and carries a quarter of
        // the samples, so the PDF must be able to tell the two apart. An asset
        // written before either key existed reads as unknown and is treated as
        // too small and too coarse.
        const slot = viewport.Viewport__SnapshotAsset;
        if (!slot || typeof slot !== 'object' || typeof slot.Asset__Path !== 'string') viewport.Viewport__SnapshotAsset = null;
        else {
            if (!Number.isFinite(slot.Asset__PixelWidth)) slot.Asset__PixelWidth = null;
            if (!Number.isFinite(slot.Asset__Samples))    slot.Asset__Samples    = null;
        }
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
        // TERMINATOR SIZE | A length is a number above zero, clamped; anything
        // else is no key, which draws at the config TickLengthMm, as a record
        // from before this field did.
        if (item.Dimension__TickLengthMm !== undefined) {
            const mm = item.Dimension__TickLengthMm;
            if (!(typeof mm === 'number' && Number.isFinite(mm) && mm > 0)) delete item.Dimension__TickLengthMm;
            else item.Dimension__TickLengthMm = Math.min(setup.maxTickLengthMm, Math.max(setup.minTickLengthMm, mm));
        }
        item.Dimension__Precision = Na__LeRec__Num(item.Dimension__Precision, setup.defaultPrecision);
        if (typeof item.Dimension__UnitsSuffix !== 'string') item.Dimension__UnitsSuffix = setup.defaultUnits;
        if (item.Dimension__OverrideText === undefined) item.Dimension__OverrideText = null;
        if ([ 'aligned', 'horizontal', 'vertical' ].indexOf(item.Dimension__Orientation) === -1) item.Dimension__Orientation = 'aligned';   // <-- A record from before ortho dimensions was aligned
        if (item.Dimension__AtScale !== undefined && typeof item.Dimension__AtScale !== 'boolean') delete item.Dimension__AtScale;   // <-- true, false or no key: a record from before Measure at scale keeps reading as it did
        // FIXED LENGTH EXTENSION LINES | A length is a number of zero or more and
        // anything else is the full line, which is no key at all; the padlock is
        // kept only while it is open. A record from before either reads as it did.
        [ 'Dimension__StartExtensionMm', 'Dimension__EndExtensionMm' ].forEach((key) => {
            const mm = item[key];
            if (!(typeof mm === 'number' && Number.isFinite(mm) && mm >= 0)) delete item[key];
        });
        if (item.Dimension__ExtensionsLinked !== false) delete item.Dimension__ExtensionsLinked;
        // TEXT LEADER | A paper offset from the un-dragged place. Kept only
        // while it actually moves the value; anything else - and both keys
        // at zero - is no key, which sits the value on the line as a record
        // from before this did.
        const textDx = item.Dimension__TextDXMm, textDy = item.Dimension__TextDYMm;
        const hasDx  = typeof textDx === 'number' && Number.isFinite(textDx);
        const hasDy  = typeof textDy === 'number' && Number.isFinite(textDy);
        if (!hasDx && !hasDy) {
            delete item.Dimension__TextDXMm;
            delete item.Dimension__TextDYMm;
        } else {
            const dx = hasDx ? textDx : 0, dy = hasDy ? textDy : 0;
            if (Math.hypot(dx, dy) < 1e-6) {
                delete item.Dimension__TextDXMm;
                delete item.Dimension__TextDYMm;
            } else {
                item.Dimension__TextDXMm = dx;
                item.Dimension__TextDYMm = dy;
            }
        }
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
        item.Shape__FillOpacity   = Na__LeRec__Unit(item.Shape__FillOpacity, 1);         // <-- A record from before opacity was solid
        item.Shape__StrokeOpacity = Na__LeRec__Unit(item.Shape__StrokeOpacity, 1);
        item.Shape__Gradient = Na__LeGrad__Normalise(item.Shape__Gradient);              // <-- A fresh object or null: no two shapes ever hold the same gradient
        item.Shape__LineStyle = Na__LeDash__Normalise(item.Shape__LineStyle);            // <-- Likewise: null is a solid edge, and a record from before the toggle stays one
        item.Shape__Stroked = item.Shape__Stroked !== false;                             // <-- A record written before the flag existed drew its edges
        const filled  = item.Shape__FillColour !== null || item.Shape__Gradient !== null;   // <-- A gradient is a fill as far as visibility goes
        const canFill = filled && item.Shape__Points.length > 2;                            // <-- Two points enclose nothing, so they cannot be a fill
        if (!item.Shape__Stroked && !canFill) item.Shape__Stroked = true;                   // <-- Edges or fill, never neither: an invisible shape is a lost shape
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In a Leader (tip and anchor in paper mm, weights in points, opacities 0 to 1)
    // ------------------------------------------------------------
    // Every style field that is missing takes the Leader setup's default. A
    // null fill is a real choice - no fill - and is kept; only a fill that was
    // never written takes the default. A tip or an anchor that is not a number
    // puts the head a little up and to the right of the tip.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseLeader(item, defaultLayerId) {
        const setup = Na__LeCfg__GetLeaderSetup();
        if (!item.Leader__LayerId) item.Leader__LayerId = defaultLayerId;
        if (Na__LeRec__LEADER_TYPES.indexOf(item.Leader__Type) === -1) item.Leader__Type = setup.defaultType;
        item.Leader__TipXMm    = Na__LeRec__Num(item.Leader__TipXMm, 20);
        item.Leader__TipYMm    = Na__LeRec__Num(item.Leader__TipYMm, 20);
        item.Leader__AnchorXMm = Na__LeRec__Num(item.Leader__AnchorXMm, item.Leader__TipXMm + 15);
        item.Leader__AnchorYMm = Na__LeRec__Num(item.Leader__AnchorYMm, item.Leader__TipYMm - 10);
        if (typeof item.Leader__Text !== 'string') item.Leader__Text = item.Leader__Type === 'bubble' ? setup.defaultBubbleText : setup.defaultText;
        item.Leader__TextSizeMm = Math.max(0.5, Na__LeRec__Num(item.Leader__TextSizeMm, setup.textSizeMm));
        item.Leader__FontWeight = Na__LeRec__Num(item.Leader__FontWeight, setup.fontWeight);
        if (typeof item.Leader__TextColour !== 'string') item.Leader__TextColour = setup.textColour;
        if (typeof item.Leader__LineColour !== 'string') item.Leader__LineColour = setup.lineColour;
        item.Leader__LinePt = Math.max(0, Na__LeRec__Num(item.Leader__LinePt, setup.linePt));
        if (Na__LeRec__LEADER_LINE_STYLES.indexOf(item.Leader__LineStyle) === -1) item.Leader__LineStyle = setup.lineStyle;
        item.Leader__LineOpacity = Na__LeRec__Unit(item.Leader__LineOpacity, setup.lineOpacity);
        if (typeof item.Leader__EndpointFilled !== 'boolean') item.Leader__EndpointFilled = setup.endpointFilled;
        item.Leader__EndpointPt     = Math.max(0, Na__LeRec__Num(item.Leader__EndpointPt, setup.endpointPt));
        item.Leader__EndpointSizeMm = Math.max(0, Na__LeRec__Num(item.Leader__EndpointSizeMm, setup.endpointSizeMm));
        item.Leader__BubbleSizeMm   = Math.max(1, Na__LeRec__Num(item.Leader__BubbleSizeMm, setup.bubbleSizeMm));
        item.Leader__BubbleEdgePt   = Math.max(0, Na__LeRec__Num(item.Leader__BubbleEdgePt, setup.bubbleEdgePt));
        if (item.Leader__FillColour === undefined) item.Leader__FillColour = setup.filled ? setup.fillColour : null;   // <-- Never written: the default
        else if (typeof item.Leader__FillColour !== 'string') item.Leader__FillColour = null;                        // <-- Null is "no fill", and stays
        item.Leader__FillOpacity = Na__LeRec__Unit(item.Leader__FillOpacity, setup.fillOpacity);
        // SPECIFICATION LINK | Only where the key exists: the id of the project
        // specification note a bubble shows the code of (Na__LayoutEditor__SpecLinks__).
        // A leader without it is left without it, so every record from before the
        // specification - and every unlinked leader - stays exactly as it was.
        if ('Leader__SpecNoteId' in item) {
            const noteId = item.Leader__SpecNoteId;
            if (typeof noteId === 'string' && noteId.trim() !== '') item.Leader__SpecNoteId = noteId.trim();
            else delete item.Leader__SpecNoteId;
        }
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In a Group (members are { kind, id } of a vector, text or group)
    // ------------------------------------------------------------
    // Kind and id are the only fields. Duplicates and anything else drop out,
    // so a draft or a record from before a kind existed stays a list of live
    // members. The id of the group itself is the sheet model's to assign.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseGroup(item) {
        if (!item || typeof item !== 'object') return item;
        const raw  = Array.isArray(item.Group__Members) ? item.Group__Members : [];
        const seen = new Set();
        item.Group__Members = raw.filter((member) => {
            if (!member || typeof member !== 'object') return false;
            if (Na__LeRec__GROUP_KINDS.indexOf(member.kind) === -1) return false;
            if (typeof member.id !== 'string' || !member.id) return false;
            const key = member.kind + ':' + member.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map((member) => ({ kind : member.kind, id : member.id }));
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill In a Sheet's Notes Margin (only on a sheet that has one)
    // ------------------------------------------------------------
    // Sheet__MarginNotes : { Enabled, WidthMm, Heading, TextSizeMm,
    // IncludeGeneral, GroupHeadings }. A sheet that never had a margin carries
    // no key and is left without one. Heading null prints the configured
    // heading. The width is only kept above MinWidthMm here; the layout clamps
    // it to the paper when it is solved, so a paper change that narrows the
    // sheet does not throw away the width someone chose.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseMarginNotes(sheet) {
        if (!sheet || !('Sheet__MarginNotes' in sheet)) return null;
        const raw = sheet.Sheet__MarginNotes;
        if (!raw || typeof raw !== 'object') { delete sheet.Sheet__MarginNotes; return null; }
        const setup = Na__LeCfg__GetMarginNotesSetup();
        const storedSize = Na__LeRec__Num(raw.TextSizeMm, setup.textSizeMm);
        const ninePtMm   = 9 * 25.4 / 72;
        const wasDefault = raw.TextSizeMm === 2.2 || (typeof raw.TextSizeMm === 'number' && Math.abs(raw.TextSizeMm - ninePtMm) < 0.05);
        const bodyMm     = wasDefault ? setup.textSizeMm : storedSize;           // <-- 2.2 mm and the brief 9 pt size give way to 2 mm
        sheet.Sheet__MarginNotes = {
            Enabled        : raw.Enabled === true,
            WidthMm        : Math.max(setup.minWidthMm, Na__LeRec__Num(raw.WidthMm, setup.defaultWidthMm)),
            Heading        : (typeof raw.Heading === 'string' && raw.Heading.trim() !== '') ? raw.Heading : null,
            TextSizeMm     : Math.min(setup.maxTextSizeMm, Math.max(setup.minTextSizeMm, bodyMm)),
            IncludeGeneral : typeof raw.IncludeGeneral === 'boolean' ? raw.IncludeGeneral : setup.includeGeneral,
            GroupHeadings  : typeof raw.GroupHeadings === 'boolean' ? raw.GroupHeadings : setup.groupHeadings
        };
        return sheet.Sheet__MarginNotes;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Margin Settings, With the Defaults Where It Has None (never writes)
    // ------------------------------------------------------------
    function Na__LeRec__MarginNotes(sheet) {
        const stored = (sheet && sheet.Sheet__MarginNotes && typeof sheet.Sheet__MarginNotes === 'object') ? sheet.Sheet__MarginNotes : null;
        if (stored) return stored;
        const setup = Na__LeCfg__GetMarginNotesSetup();
        return { Enabled : false, WidthMm : setup.defaultWidthMm, Heading : null, TextSizeMm : setup.textSizeMm, IncludeGeneral : setup.includeGeneral, GroupHeadings : setup.groupHeadings };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a Site Plan Sheet (Sheet__DrawingType)
    // ------------------------------------------------------------
    function Na__LeRec__IsSitePlanSheet(sheet) {
        return !!sheet && sheet.Sheet__DrawingType === Na__LeRec__DRAWING_SITEPLAN;
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

        // A DRAWING CODE TYPED INTO THE NAME COMES OFF | The tab carries the register's own (StripSheetCode)
        const typedFields = (sheet.Sheet__Fields && typeof sheet.Sheet__Fields === 'object') ? sheet.Sheet__Fields : null;
        const bareName    = Na__LeRec__StripSheetCode(sheet.Sheet__Name, typedFields ? typedFields.Sheet__Fields__DrawingNumber : '');
        if (bareName !== sheet.Sheet__Name) {
            if (typedFields && typedFields.Sheet__Fields__Title === sheet.Sheet__Name) typedFields.Sheet__Fields__Title = bareName;   // <-- A title that was only ever the name goes with it; one typed separately stays
            sheet.Sheet__Name = bareName;
        }
        sheet.Sheet__Order = Na__LeRec__Num(sheet.Sheet__Order, index + 1);
        if (!sheet.Sheet__PaperSize || !sheetSetup.paperSizes[sheet.Sheet__PaperSize]) sheet.Sheet__PaperSize = sheetSetup.defaultPaperSize;
        if (sheet.Sheet__Orientation !== 'portrait') sheet.Sheet__Orientation = 'landscape';
        if (sheet.Sheet__TitleBlockStyle !== 'classic' && sheet.Sheet__TitleBlockStyle !== 'modern') sheet.Sheet__TitleBlockStyle = titleSetup.defaultStyle;
        if (sheet.Sheet__DrawingType !== Na__LeRec__DRAWING_SITEPLAN) delete sheet.Sheet__DrawingType;   // <-- Stored only for a site plan; no key is an architectural drawing
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
        if (!Array.isArray(sheet.Sheet__Leaders))     sheet.Sheet__Leaders     = [];
        if (!Array.isArray(sheet.Sheet__Groups))      sheet.Sheet__Groups      = [];   // <-- A record from before groups: empty, and older sheets stay as they were

        // LINEWEIGHTS | Printed points per sheet, seeded from the config
        const lwSetup = Na__LeCfg__GetLineweightSetup();
        const lw = (sheet.Sheet__Lineweights && typeof sheet.Sheet__Lineweights === 'object') ? sheet.Sheet__Lineweights : {};
        sheet.Sheet__Lineweights = { ViewportPt : Na__LeRec__Num(lw.ViewportPt, lwSetup.viewportPt), DimensionPt : Na__LeRec__Num(lw.DimensionPt, lwSetup.dimensionPt) };
        Na__LeRec__NormaliseMarginNotes(sheet);                                  // <-- Only a sheet that has a notes margin

        sheet.Sheet__Viewports.forEach((v)   => Na__LeRec__NormaliseViewport(v,   Na__LeRec__DefaultLayerId(sheet, 'viewport')));
        sheet.Sheet__Annotations.forEach((a) => Na__LeRec__NormaliseAnnotation(a, Na__LeRec__DefaultLayerId(sheet, 'annotation')));
        sheet.Sheet__Dimensions.forEach((d)  => Na__LeRec__NormaliseDimension(d,  Na__LeRec__DefaultLayerId(sheet, 'dimension')));
        sheet.Sheet__Shapes.forEach((sh)     => Na__LeRec__NormaliseShape(sh,     Na__LeRec__DefaultLayerId(sheet, 'vector')));
        sheet.Sheet__Leaders.forEach((l)     => Na__LeRec__NormaliseLeader(l,     Na__LeRec__DefaultLayerId(sheet, 'annotation')));   // <-- Leaders live with the text
        sheet.Sheet__Groups = sheet.Sheet__Groups.filter((g) => g && typeof g === 'object');
        sheet.Sheet__Groups.forEach((g) => {
            if (typeof g.Group__Id !== 'string' || !g.Group__Id) g.Group__Id = Na__LeRec__NextId(sheet.Sheet__Groups, 'Group_', 'Group__Id');
            Na__LeRec__NormaliseGroup(g);
        });
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


    // FUNCTION | A Sheet's Drawing Number: the Register's, or the Project Default
    // ------------------------------------------------------------
    // The one reading of it. BuildFields takes its default from here, so the
    // number a tab is cut from and the number the title block prints cannot
    // come apart - and a tab strip that only wants the number does not have to
    // solve the scale and the date of every sheet to get it.
    // ------------------------------------------------------------
    // THE SEQUENTIAL NUMBER ALONE, NOT THE WHOLE IDENTIFIER. "D01". The
    // register's numbering writes it and nothing else does; the tab cuts its
    // short code from it, and Na__LeRec__DocumentId puts the job and the phase
    // in front of it. Before 19-Sep-2026 this field was expected to hold the
    // whole thing ("PS01_T02_D01"), which is why the first renumber of a pack
    // silently destroyed the job and phase: numbering only ever wrote the
    // sequence. Composing instead of storing is what stops that recurring.
    //
    // AN UNNUMBERED SHEET ANSWERS IN THE REGISTER'S OWN SERIES, "D04", not
    // "PS01-04" as it did before. The old default put the project code inside
    // the number, which composed to PS01_T01_PS01-04, and its bare-digit tail
    // gave the tab no short code at all.
    // ------------------------------------------------------------
    function Na__LeRec__DrawingNumber(sheet) {
        const stored = (sheet && sheet.Sheet__Fields) ? sheet.Sheet__Fields.Sheet__Fields__DrawingNumber : undefined;
        if (typeof stored === 'string') return stored;
        const setup  = Na__LeCfg__GetDrawingRegisterSetup();
        const digits = Math.max(1, Math.min(6, Math.round(Number(setup.digits) || 2)));
        return String(setup.prefix || 'D') + String(sheet ? sheet.Sheet__Order : 1).padStart(digits, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Job Stage a Sheet Belongs To ("T02")
    // ------------------------------------------------------------
    // Held per sheet, because a project runs several stages at once: a planning
    // set stays live and issued while building regulations drawings are being
    // drawn. A sheet that has never been given one is read as the configured
    // default, so a back catalogue drawn before the phase existed still
    // composes a whole code rather than a broken one.
    // ------------------------------------------------------------
    function Na__LeRec__Phase(sheet) {
        const stored = (sheet && sheet.Sheet__Fields) ? sheet.Sheet__Fields.Sheet__Fields__Phase : undefined;
        if (typeof stored === 'string' && stored.trim()) return stored.trim();
        return String(Na__LeCfg__GetDrawingRegisterSetup().defaultPhase || '').trim();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Whole Identifier a Drawing Is Known By ("PS01_T02_D01")
    // ------------------------------------------------------------
    // The job, the stage and the drawing, in that order - read left to right it
    // says which project, which stage of it, and which sheet of that stage.
    // This is what the title block prints and what the exported file is named
    // after.
    //
    // COMPOSED ON EVERY READ, NOT STORED. A renumber or a phase change reaches
    // the title block, the register and the file name together and cannot leave
    // them disagreeing, and nothing can overwrite two thirds of it by writing
    // the third. A sheet may still carry a typed Sheet__Fields__DocumentId,
    // which wins for that sheet alone - for a drawing inherited from another
    // office, or one whose code was fixed before this schema existed.
    //
    // An empty part takes its separator with it, so a project with no code yet
    // reads T01_D01 rather than _T01_D01.
    // ------------------------------------------------------------
    function Na__LeRec__ComposeDocumentId(project, phase, drawing) {
        const format = String(Na__LeCfg__GetDrawingRegisterSetup().documentCodeFmt || '{project}_{phase}_{drawing}');
        const parts  = {
            project : String(project || '').trim(),
            phase   : String(phase   || '').trim(),
            drawing : String(drawing || '').trim()
        };
        const token  = /\{(project|phase|drawing)\}/g;
        const pieces = [];
        let   cursor = 0;
        let   found  = token.exec(format);
        while (found) {
            pieces.push({ separator : format.slice(cursor, found.index), value : parts[found[1]] });
            cursor = token.lastIndex;
            found  = token.exec(format);
        }
        const lead   = pieces.length ? pieces[0].separator : format;             // <-- Anything the format puts in FRONT of the first part is not a separator
        let   composed = '';
        pieces.forEach((piece) => {
            if (!piece.value) return;                                            // <-- An empty part takes its separator with it
            composed += (composed ? piece.separator : '') + piece.value;         // <-- ...and the first part that survives never carries one
        });
        return composed ? lead + composed + format.slice(cursor) : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Document ID, Typed if It Has One
    // ------------------------------------------------------------
    function Na__LeRec__DocumentId(sheet) {
        const stored = (sheet && sheet.Sheet__Fields) ? sheet.Sheet__Fields.Sheet__Fields__DocumentId : undefined;
        if (typeof stored === 'string' && stored.trim()) return stored.trim();
        return Na__LeRec__ComposeDocumentId(Na__DrawData__GetProjectCode(), Na__LeRec__Phase(sheet), Na__LeRec__DrawingNumber(sheet));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Short Code a Tab Carries, Cut From a Drawing Number
    // ------------------------------------------------------------
    // "PS01_T02_D03" gives "D03". The Drawing Register writes the whole number
    // - its series prefix, then the padded count - and a tab needs only the
    // end of it: the last run of letters and the digits after them. The
    // project and the task in front are the same on every tab of a pack, so on
    // a tab they are only width, and on a phone that width is the whole strip.
    //
    // CUT FROM THE NUMBER rather than worked out again from the numbering
    // series, so a number typed by hand before the register existed answers
    // the same way as one the register wrote, and nothing here can disagree
    // with what the title block prints. One separator may sit between the
    // letters and the digits, so a series numbered "A-101" reads "A-101".
    //
    // NO LETTER-LED CODE AT THE END, NO SHORT CODE. The project default for a
    // pack the register has never numbered is "PS01-04", whose tail is bare
    // digits: that is a place in the order, not a drawing code, and a tab
    // reading "04 - D04 - Site Plan" is worse than the name alone. Such a
    // sheet answers '' and its tab shows its name, as every tab did before
    // the register; the first renumber gives it a code.
    // ------------------------------------------------------------
    function Na__LeRec__ShortCode(drawingNumber) {
        const text  = String(drawingNumber === undefined || drawingNumber === null ? '' : drawingNumber).trim();
        const match = /[A-Za-z]+[-_ ]?\d+$/.exec(text);
        return match ? match[0] : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet Name Without a Drawing Code Typed in Front of It
    // ------------------------------------------------------------
    // "D03 - 3D Images" gives "3D Images". Until the tabs carried the
    // register's code the only way to see a number on one was to type it into
    // the name, and then to retype it on every renumber - which is how PS02's
    // "D24 - Site Plan" came to be drawing D10. The number is the register's
    // now, so a name holds the words and nothing else.
    //
    // ONLY A CODE OF THE PACK'S OWN SERIES COMES OFF: the letters of the
    // sheet's own short code, any digits, then a dash, a colon, a middle dot or
    // a bar. "D21 - Floor Plans" loses its D21 whatever the sheet is numbered
    // today; "L2 - Second Floor" on a D series keeps every word; and
    // "3D Images" - no letter in front of its digit, no dash after it - is
    // never touched. A name that is nothing but a code is left alone, because
    // taking it off would leave nothing to show.
    // ------------------------------------------------------------
    function Na__LeRec__StripSheetCode(name, drawingNumber) {
        const text = String(name === undefined || name === null ? '' : name);
        if (!/^\s*[A-Za-z]+[-_ ]?\d/.test(text)) return text;                    // <-- The common case, settled without building a pattern
        const letters = (/^[A-Za-z]+/.exec(Na__LeRec__ShortCode(drawingNumber)) || [ '' ])[0];
        if (!letters) return text;                                              // <-- A pack the register has never numbered has no series to match: nothing comes off
        const bare = text.replace(new RegExp('^\\s*' + letters + '[-_ ]?\\d+\\s*[-\\u2013\\u2014\\u00b7:|]\\s*', 'i'), '').trim();
        return bare ? bare : text;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title Block Fields With Project Defaults Filled In
    // ------------------------------------------------------------
    // Scale is solved from the sheet every time rather than stored, so re-papering
    // a sheet or re-scaling a viewport rewrites the cell on the next chrome build.
    // A value typed into the Sheet panel still wins, the way every other field does.
    //
    // CLIENT AND SITE ADDRESS ARE THE TWO EXCEPTIONS. They belong to the whole
    // pack, not to a sheet, so on a sheet that is on Common the pack's value
    // wins over anything stored on the sheet - a stale copy left by an older
    // build, or by a path that wrote one before the switch was turned back on,
    // can never print over the value every other sheet is showing.
    // ------------------------------------------------------------
    function Na__LeRec__BuildFields(sheet) {
        const setup   = Na__LeCfg__GetTitleBlockSetup();
        const stored  = (sheet && sheet.Sheet__Fields) || {};
        const config  = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const project = (config && (config.projectName || config.displayName)) || '';
        const common  = Na__LeCommon__Get();
        const onCommon = Na__LeCommon__Uses(sheet);
        const scales  = (sheet ? sheet.Sheet__Viewports : []).filter((v) => v.Viewport__Kind === Na__LeRec__KIND_2D).map((v) => v.Viewport__ScaleDenominator);
        const paper   = Na__LeLayout__PaperSizeMm(sheet ? sheet.Sheet__PaperSize : null, sheet ? sheet.Sheet__Orientation : null);   // <-- Resolved, not read raw: an unset or unknown size falls back to the default paper the sheet actually prints on
        const today   = new Date();
        const dateText = String(today.getDate()).padStart(2, '0') + ' ' +
            [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][today.getMonth()] + ' ' + today.getFullYear();

        const defaults = {
            Client        : common.Client || project,                            // <-- The pack's client; the project name only until one is known
            SiteAddress   : common.SiteAddress,
            Title         : sheet ? sheet.Sheet__Name : '',
            DrawingNumber : Na__LeRec__DrawingNumber(sheet),                     // <-- The sequence alone; the same reading a tab's short code is cut from
            Phase         : Na__LeRec__Phase(sheet),
            DocumentId    : Na__LeRec__DocumentId(sheet),                        // <-- What the title block prints and the exported file is named after
            Revision      : 'A',
            Scale         : Na__LeScale__SheetLabel(scales, paper.Label),
            Date          : dateText,
            DrawnBy       : setup.drawnByDefault
        };
        const fields = {};
        Object.keys(defaults).forEach((key) => {
            if (onCommon && Na__LeCommon__KEYS.indexOf(key) !== -1) { fields[key] = defaults[key]; return; }   // <-- The pack's, whatever the sheet happens to store
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
        Na__LeRec__DRAWING_ARCHITECTURAL,
        Na__LeRec__DRAWING_SITEPLAN,
        Na__LeRec__IsSitePlanSheet,
        Na__LeRec__IsSitePlanViewport,
        Na__LeRec__NormaliseShape,
        Na__LeRec__NormaliseLeader,
        Na__LeRec__NormaliseMarginNotes,
        Na__LeRec__MarginNotes,
        Na__LeRec__NextId,
        Na__LeRec__Num,
        Na__LeRec__Find,
        Na__LeRec__NormaliseLayer,
        Na__LeRec__NormaliseViewport,
        Na__LeRec__NormaliseAnnotation,
        Na__LeRec__NormaliseDimension,
        Na__LeRec__NormaliseGroup,
        Na__LeRec__NormaliseSheet,
        Na__LeRec__DefaultLayerId,
        Na__LeRec__DrawingNumber,
        Na__LeRec__Phase,
        Na__LeRec__DocumentId,
        Na__LeRec__ComposeDocumentId,
        Na__LeRec__ShortCode,
        Na__LeRec__StripSheetCode,
        Na__LeRec__BuildFields
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
