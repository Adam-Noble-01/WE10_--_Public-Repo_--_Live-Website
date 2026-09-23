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
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (Sheet__DrawingType), TrueVision first on 14-Sep-2026; Shape__Holes (holed vectors), TrueVision first on 22-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.39.0
// - Dimension__LinePt and Dimension__LineStyle: a dimension's own line weight
//   in points and its dashed, dotted or dash-dot lines (the Dimensions
//   panel). NormaliseDimension keeps the weight only as a number of points
//   inside the Lineweights bounds, and the line style only while it is not
//   solid (made whole by Na__LayoutEditor__LineStyleTool__). With neither key a
//   dimension draws at the sheet's Dimension pt, solid, exactly as before.
//
// 22-Sep-2026 - Version 1.38.0
// - HOLES IN A VECTOR (islands), for the vector tools' Boolean section:
//   NormaliseShapeHoles keeps Shape__Holes - where each hole begins in
//   Shape__Points - only while it holds a hole, only on a plain vector, and
//   holds such a shape closed. The starts are cleaned by the new leaf
//   Na__LayoutEditor__ShapeRings__, which is only asked about a shape that
//   has the key, so every record from before (and every test that loads this
//   file with its own stubs) reads exactly as it did.
//
// 22-Sep-2026 - Version 1.37.0
// - LEADERLESS NOTES on the notes margin record: LeaderlessOn (stored only as
//   true) and LeaderlessGroups (stored only when there is one), filled by the
//   new leaf Na__LayoutEditor__SheetRecords__LeaderlessNotes__, called from
//   NormaliseMarginNotes straight after the regions. Its readers are imported
//   from the leaf by name, as the regions' are. A margin record without them
//   is rebuilt exactly as before.
//
// 22-Sep-2026 - Version 1.36.0
// - OVERSPILL NOTE REGIONS on the notes margin record: RegionsOn (stored only
//   as true) and Regions (stored only when there is one), filled by the new
//   leaf Na__LayoutEditor__SheetRecords__NoteRegions__, which this file calls
//   from NormaliseMarginNotes. The leaf's readers are imported from the leaf
//   by name, as the sheet layout is, rather than re-exported from here - so a
//   test that loads this file with its own few stubs meets no new name.
//   NormaliseMarginNotes used to
//   rebuild the record from its six keys alone, which would have thrown a
//   region away on the next load; a margin record without them is rebuilt
//   exactly as before.
//
// 22-Sep-2026 - Version 1.35.0
// - A group may hold leaders, dimensions and viewports
//   (Na__LayoutEditor__Groups__ 1.3.0 and 1.4.0): GROUP_KINDS takes all
//   three, so NormaliseGroup keeps them. A group saved before holds none,
//   and reads exactly as it did.
//
// 21-Sep-2026 - Version 1.34.0
// - Viewport__HideSwings: the Viewport panel's Hide swings on a plan
//   (Na__LayoutEditor__PlanDoors__). NormaliseViewport keeps it only as a
//   boolean - a tick or an untick somebody made - and never adds it, so a
//   viewport saved before it is exactly what it was and follows its plan's
//   storey (a roof plan hides its swings).
//
// 21-Sep-2026 - Version 1.33.0
// - Dimension__RoundUp: the Dimensions panel's Round up to 5 mm
//   (Na__LayoutEditor__DimensionRounding__). NormaliseDimension keeps it only
//   as true, so a dimension that never had it saves exactly as it did.
//
// 21-Sep-2026 - Version 1.32.0
// - Viewport__RotationDeg: a viewport turned on the page, degrees clockwise
//   about the middle of its frame (Na__LayoutEditor__ViewportRotation__).
//   NormaliseViewport wraps it into (-180, 180] and keeps it only while it is
//   not level, so every older viewport saves exactly as it did.
//
// 21-Sep-2026 - Version 1.31.0
// - Shape__Curve: the one-word hint the Circle and Arc tools leave on what they
//   draw (37__System__VectorTools) - { Curve__Kind : circle | arc }, no centre
//   and no radius, which are read back from the points. NormaliseShape keeps it
//   only when it names a kind, so every older shape saves exactly as it did.
//
// 21-Sep-2026 - Version 1.30.0
// - A hatch's own line weight and line colour. NormaliseShapeHatch keeps
//   Hatch__StrokePt (printed points, above 0) beside the Hatch__Colour it
//   already kept, and NormaliseSitePlanHatches keeps both for a site plan
//   layer. Stored only once set: absent means the pattern's standard, so every
//   hatch saved before them is read, and saved again, exactly as it was.
//
// 21-Sep-2026 - Version 1.29.0
// - Sheet Images: NormaliseShapeImage keeps Image__SourceW / Image__SourceH,
//   the dropped original's pixels, both or neither. Absent on every picture
//   placed before them, which is read exactly as before.
//
// 21-Sep-2026 - Version 1.28.0
// - Layer__Selectable on the layer record, stored only as false: a REFERENCE
//   layer, Blender's Selectable switch turned off. It is drawn and printed as
//   it always was, but nothing on it can be clicked, boxed or snapped to
//   (Na__LeModel__IsLayerSelectable). NormaliseLayer removes any other value
//   and never adds the key, so every layer from before it - and a browser
//   draft of one - stays exactly what it was.
//
// 21-Sep-2026 - Version 1.27.0
// - SHEET IMAGES. Additive, as floor areas were:
//   - 'image' joins LAYER_TYPES: the Images layer, made the first time a
//     picture lands on a sheet. DefaultLayerId answers the Vectors layer for
//     'image' on a sheet that has none, and RehomeOrphans sends a picture to
//     Images, or to Vectors without one.
//   - Shape__Image on the shape record, kept only when it names a file
//     (NormaliseShapeImage). A picture is held to a box of the kept part's
//     proportions whatever wrote its points, and carries no edge, fill,
//     hatch, code or room of its own: the frame is the picture's, and
//     anything else would draw over or under it.
//
// 21-Sep-2026 - Version 1.26.0
// - THE LAYERS LIST IS NOW THE PAINT ORDER FOR EVERYTHING (Na__LayoutEditor__
//   PaintOrder__), so the list a sheet carries decides what it looks like.
//   Three consequences here:
//   - A new sheet is seeded top of the list first: Text, Dimensions, Vectors,
//     Floor Areas, Viewports - the drawings at the back. The old seed put
//     Viewports first, which never showed while markup always drew over
//     viewports, and would now bury every note under the pictures. The layer
//     ids are unchanged, so each kind lands on the layer it always did.
//   - Sheet__LayerStack (2) marks a sheet as laid out for the obeyed list. A
//     sheet without it is restacked ONCE on load (RestackLegacyLayers): when a
//     text, dimension or vector layer - holding anything or not yet - sits
//     under a viewport layer, the viewport layers move below the rest and
//     nothing else moves. A sheet whose drawings are already at the bottom is
//     left as it is, and so is a floor area layer put under a drawing.
//   - RehomeOrphans: an item on a layer that no longer exists (DeleteLayer
//     left vectors behind until today) goes to the layer its kind lands on,
//     so it is in the list, in the order, and in reach of the Layers panel.
//
// 21-Sep-2026 - Version 1.25.0
// - FLOOR AREAS. Three additions, all of them additive:
//   - 'area' joins LAYER_TYPES, so a sheet can carry a Floor Areas layer.
//     Without it NormaliseLayer turned one into 'mixed' on the first load.
//   - Shape__Area on the shape record, kept only when it is an object, the
//     rule Shape__Hatch and Shape__Qr follow - so every shape drawn before
//     floor areas existed saves byte-identical. It holds what the room is
//     called, the NAME of the group it is filed under and the few settings
//     that are real decisions; the measurement itself is never stored, but
//     solved from the points and the drawing's scale on every read. A shape
//     carrying it is held closed and counts as something to paint.
//   - Sheet__AreaGroups, the sheet's list of groups (a name and a colour
//     each), kept only when there is one. Names are merged case-insensitively,
//     because a paste from two sheets can bring the same group twice.
// - New sheets are seeded with a fifth layer, Floor Areas. A sheet that
//   already has layers is untouched; the feature gives it one when the first
//   area lands.
//
// 21-Sep-2026 - Version 1.24.0
// - Shape__Qr on the shape record: { Qr__MarginMm }, and nothing else. A shape
//   carrying it is drawn as it always was AND has the project's QR symbol
//   painted inside it, that far in from its box (Na__LayoutEditor__ShapeGeometry__).
//   The block names no project and holds no matrix: the symbol is the one the
//   Project QR Code system answers for whatever project is open, so a shape
//   copied into another project carries that project's code. Kept only when it
//   is an object, so every shape drawn before it stays byte-identical on save -
//   the rule Shape__Hatch follows.
//
// 20-Sep-2026 - Version 1.23.0
// - The depthFog style: whether a viewport shows its drawing's own depth fog.
//   On by default, from LayoutEditor__Viewport__DefaultStyles, so a viewport
//   saved before the key existed follows its drawing - and since every drawing's
//   fog starts switched off, no sheet changes until somebody asks.
//
// 19-Sep-2026 - Version 1.22.0
// - BuildFields answers Status: what the drawing is issued for, the last cell
//   of the title block. Stored per sheet as Sheet__Fields__Status and read like
//   every other field, so a sheet from before it prints the config's
//   StatusDefault - shipped empty, so no drawing claims a status nobody chose.
//
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
    import { Na__LeRec__NormaliseNoteRegions } from './Na__LayoutEditor__SheetRecords__NoteRegions__.js';   // <-- A leaf too (the config alone): the overspill note regions on the margin record
    import { Na__LeRec__NormaliseLeaderlessNotes } from './Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js';   // <-- A leaf with no imports at all: the groups the margin lists without leaders
    import { Na__LeRings__Clean } from '../15__Core__Markup/Na__LayoutEditor__ShapeRings__.js';   // <-- A leaf with no imports: where a holed vector's holes begin, asked only of a shape that has the key
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
    import { Na__LeHatch__FIELD, Na__LeHatch__CAT_FIELD } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';
    import {
        Na__LeSpComp__DECK_FIELD,
        Na__LeSpComp__TYPE_FIELD,
        Na__LeSpComp__PLAN_BLOCK,
        Na__LeSpComp__PLAN_LOCAL,
        Na__LeSpComp__DeckKeys,
        Na__LeSpComp__DeckDefault
    } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
    import { Na__LeGrad__Normalise } from '../35__System__DrawingTools/Na__LayoutEditor__GradientTool__.js';   // <-- A leaf too: it reaches only the panel host, which reaches only the config
    import { Na__LeImgGeo__NormaliseCrop, Na__LeImgGeo__Enforce } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Geometry__.js';   // <-- A leaf: a picture is held to its proportions without reaching the rest of the feature
    import { Na__LeDash__Normalise } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import { Na__LeVpRot__FIELD, Na__LeVpRot__WrapDeg } from '../20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js';   // <-- A leaf: imports nothing, so it cannot cycle back here
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
    const Na__LeRec__LAYER_TYPES = [ 'viewport', 'annotation', 'dimension', 'vector', 'area', 'image', 'mixed' ];   // <-- 'area' is the Floor Areas layer: measured rooms, which are vectors carrying Shape__Area; 'image' the Images layer: pictures, vectors carrying Shape__Image
    const Na__LeRec__STYLE_KEYS  = [ 'baseImage', 'projectedLinework', 'profileLinework', 'glassOpaque', 'whitecard', 'hiddenLines', 'enhanceWhitecard', 'contextLayer', 'depthFog' ];
    const Na__LeRec__ID_PAD      = 3;
    const Na__LeRec__LEADER_TYPES       = [ 'text', 'bubble' ];             // <-- A note with a leader, or a specification bubble
    const Na__LeRec__LEADER_LINE_STYLES = [ 'solid', 'dashed' ];
    const Na__LeRec__GROUP_KINDS        = [ 'viewport', 'shape', 'annotation', 'leader', 'dimension', 'group' ];   // <-- What a group may hold: anything on a sheet, nested groups included (Na__LeGroup__KINDS)
    const Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural';                   // <-- A sheet with no Sheet__DrawingType
    const Na__LeRec__DRAWING_SITEPLAN      = 'siteplan';                        // <-- The only drawing type ever stored
    const Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__';       // <-- Category keys of site plan layers (the export's stems)
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Layer Stack
    // ------------------------------------------------------------
    // Sheet__LayerStack at 2: the sheet's Layers list is its paint order for
    // EVERYTHING, top of the list frontmost (Na__LayoutEditor__PaintOrder__).
    // A sheet without it was laid out when only viewports obeyed the list,
    // and is restacked once, on load (Na__LeRec__RestackLegacyLayers).
    // ------------------------------------------------------------
    const Na__LeRec__LAYER_STACK = 2;
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
        if (layer.Layer__Selectable !== false) delete layer.Layer__Selectable;   // <-- A reference layer: stored only as false, so every layer from before it is byte-identical
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


    // HELPER FUNCTION | Tidy a Site Plan Viewport's Hatch Overrides
    // ---------------------------------------------------------------
    // Keeps only what a viewport has actually changed. A layer whose entry says
    // nothing is dropped, and an empty block is removed entirely, so a viewport
    // that has never had a hatch touched stays byte-identical on save - the same
    // rule as Viewport__ShowFrame and Sheet__DrawingType.
    //
    // An EMPTY pattern key is kept on purpose: '' means "no hatch on this layer",
    // which is a real choice and different from "never set".
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseSitePlanHatches(viewport) {
        const block = viewport[Na__LeHatch__FIELD];
        if (!block || typeof block !== 'object') { delete viewport[Na__LeHatch__FIELD]; return; }

        const source = block[Na__LeHatch__CAT_FIELD];
        const kept   = {};
        if (source && typeof source === 'object') {
            Object.keys(source).forEach((categoryKey) => {
                const entry = source[categoryKey];
                if (!entry || typeof entry !== 'object') return;
                const out = {};
                if (typeof entry.Hatch__PatternKey === 'string') out.Hatch__PatternKey = entry.Hatch__PatternKey;
                if (Number.isFinite(entry.Hatch__Scale))         out.Hatch__Scale       = entry.Hatch__Scale;
                if (Number.isFinite(entry.Hatch__RotationDeg))   out.Hatch__RotationDeg = entry.Hatch__RotationDeg;
                if (entry.Hatch__Filled === false)               out.Hatch__Filled      = false;   // <-- Only the OFF case is stored; on is the default
                if (Number.isFinite(entry.Hatch__StrokePt) && entry.Hatch__StrokePt > 0)       out.Hatch__StrokePt = entry.Hatch__StrokePt;   // <-- This layer's own line weight (pt); absent = the pattern's standard
                if (/^#[0-9a-fA-F]{6}$/.test(String(entry.Hatch__Colour || '')))              out.Hatch__Colour   = entry.Hatch__Colour;     // <-- And its own line colour; absent = the pattern's standard
                if (Object.keys(out).length) kept[categoryKey] = out;
            });
        }

        if (Object.keys(kept).length) viewport[Na__LeHatch__FIELD] = { [Na__LeHatch__CAT_FIELD] : kept };
        else delete viewport[Na__LeHatch__FIELD];
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Site Plan Viewport's Subtype and Deck Switches
    // ---------------------------------------------------------------
    // SitePlan__PlanType is kept only when it is a real choice: 'auto' and
    // anything unrecognised are DELETED, because absent already means "follow
    // the scale" and storing the default twice is two ways to say one thing.
    //
    // SitePlan__Composites keeps only a deck that DISAGREES with its config
    // default, and only a deck the config still lists. So a viewport nobody has
    // touched saves byte-identical, a default moved in the config moves every
    // viewport that never disagreed, and a deck retired from the config does
    // not linger in the project data forever.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseSitePlanComposites(viewport) {
        const block = viewport.Viewport__SitePlan;

        const type = block[Na__LeSpComp__TYPE_FIELD];
        if (type !== Na__LeSpComp__PLAN_BLOCK && type !== Na__LeSpComp__PLAN_LOCAL) delete block[Na__LeSpComp__TYPE_FIELD];

        const stored = block[Na__LeSpComp__DECK_FIELD];
        if (!stored || typeof stored !== 'object') { delete block[Na__LeSpComp__DECK_FIELD]; return; }
        const kept = {};
        Na__LeSpComp__DeckKeys().forEach((key) => {
            if (typeof stored[key] !== 'boolean') return;
            if (stored[key] === Na__LeSpComp__DeckDefault(key)) return;
            kept[key] = stored[key];
        });
        if (Object.keys(kept).length) block[Na__LeSpComp__DECK_FIELD] = kept;
        else delete block[Na__LeSpComp__DECK_FIELD];
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's Hatch
    // ---------------------------------------------------------------
    // Shape__Hatch is { Hatch__PatternKey, Hatch__Scale, Hatch__RotationDeg,
    // Hatch__StrokePt, Hatch__Colour } - the last two only once somebody has set
    // this hatch's own line weight (printed points) or line colour; absent means
    // the pattern's standard, so a hatch saved before they existed is unchanged -
    // and it is kept ONLY when a pattern is actually named. A shape with the
    // hatch switched off has no key at all, so every shape drawn before hatches
    // existed - and every shape whose hatch is off - stays byte-identical on
    // save, the same rule Viewport__SitePlan's hatch block follows.
    //
    // The pattern key is NOT checked against the library here. The record layer
    // loads before the library does, and a key the library has not got yet must
    // survive the round trip or opening a sheet on a slow connection would strip
    // every hatch off it.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeHatch(item) {
        const block = item.Shape__Hatch;
        if (!block || typeof block !== 'object' || typeof block.Hatch__PatternKey !== 'string' || !block.Hatch__PatternKey) {
            delete item.Shape__Hatch;
            return;
        }
        const out = { Hatch__PatternKey : block.Hatch__PatternKey };
        if (Number.isFinite(block.Hatch__Scale)       && block.Hatch__Scale > 0) out.Hatch__Scale       = block.Hatch__Scale;
        if (Number.isFinite(block.Hatch__RotationDeg))                           out.Hatch__RotationDeg = block.Hatch__RotationDeg;
        if (typeof block.Hatch__Colour === 'string' && block.Hatch__Colour)      out.Hatch__Colour      = block.Hatch__Colour;
        if (Number.isFinite(block.Hatch__StrokePt)    && block.Hatch__StrokePt > 0) out.Hatch__StrokePt  = block.Hatch__StrokePt;
        item.Shape__Hatch = out;
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's Floor Area Block
    // ---------------------------------------------------------------
    // Shape__Area is what makes a vector a MEASURED ROOM
    // (59__Feature__FloorAreas). Every key but the name is stored only when it
    // is a real decision, so a room drawn with the standard settings carries
    // four short fields and nothing else:
    //     Area__Name              what the room is called
    //     Area__Group             the NAME of the group it is filed under
    //     Area__ScaleDenominator  only when the scale has been SET by hand;
    //                             absent means "the drawing under it"
    //     Area__Label             only when it is not the standard 'both'
    //     Area__TextSizeMm        only when the label size has been changed
    //     Area__LabelDXMm/DYMm    only while the label has been dragged off centre
    //
    // THE AREA ITSELF IS NEVER STORED. It is solved from the points and the
    // drawing's scale every time it is read, so a room moved onto another
    // drawing reports itself at that drawing's scale with nothing to migrate
    // and nothing that can go stale.
    //
    // Kept ONLY when the block is an object, the rule Shape__Hatch and
    // Shape__Qr follow, so every shape drawn before floor areas existed stays
    // byte-identical on save.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeArea(item) {
        const block = item.Shape__Area;
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
            delete item.Shape__Area;
            return;
        }
        const out = {};
        out.Area__Name  = (typeof block.Area__Name  === 'string') ? block.Area__Name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
        const group     = (typeof block.Area__Group === 'string') ? block.Area__Group.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
        if (group !== '') out.Area__Group = group;
        const denominator = Number(block.Area__ScaleDenominator);
        if (Number.isFinite(denominator) && denominator > 0) out.Area__ScaleDenominator = denominator;
        if ([ 'name', 'value', 'none' ].indexOf(block.Area__Label) !== -1) out.Area__Label = block.Area__Label;   // <-- 'both' is the standard, and the standard is no key
        const sizeMm = Number(block.Area__TextSizeMm);
        if (Number.isFinite(sizeMm) && sizeMm > 0) out.Area__TextSizeMm = Math.min(20, Math.max(0.5, sizeMm));
        const dx = Number(block.Area__LabelDXMm), dy = Number(block.Area__LabelDYMm);
        const hasDx = Number.isFinite(dx), hasDy = Number.isFinite(dy);
        if ((hasDx || hasDy) && Math.hypot(hasDx ? dx : 0, hasDy ? dy : 0) >= 1e-6) {   // <-- A label dragged home takes both keys off again, as a dimension's value does
            out.Area__LabelDXMm = hasDx ? dx : 0;
            out.Area__LabelDYMm = hasDy ? dy : 0;
        }
        item.Shape__Area   = out;
        item.Shape__Closed = true;                                               // <-- An open room is not a room; the tools close one on finishing, and this holds it closed
    }
    // ---------------------------------------------------------------


    // FUNCTION | Tidy a Sheet's Floor Area Groups
    // ---------------------------------------------------------------
    // Sheet__AreaGroups : [ { AreaGroup__Name, AreaGroup__Colour } ], in the
    // order they are shown and reported. Kept only when there is at least one,
    // so a sheet that has never had a group is unchanged by a load.
    //
    // A GROUP IS KNOWN BY ITS NAME, which is why there is no id here. Ids are
    // per sheet and sequential; an area pasted onto another sheet would have
    // been filed under whatever that id happened to mean there, while a name
    // means the same thing on any sheet and in any project. Duplicates - which
    // a paste from two sheets could bring - are merged, case-insensitively,
    // keeping the first spelling.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseAreaGroups(sheet) {
        if (!sheet) return [];
        const raw  = Array.isArray(sheet.Sheet__AreaGroups) ? sheet.Sheet__AreaGroups : [];
        const seen = new Set();
        const kept = [];
        raw.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            const name = (typeof entry.AreaGroup__Name === 'string') ? entry.AreaGroup__Name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
            if (name === '' || seen.has(name.toLowerCase())) return;
            seen.add(name.toLowerCase());
            const group = { AreaGroup__Name : name };
            if (typeof entry.AreaGroup__Colour === 'string' && entry.AreaGroup__Colour.trim() !== '') group.AreaGroup__Colour = entry.AreaGroup__Colour.trim();
            kept.push(group);
        });
        if (kept.length) sheet.Sheet__AreaGroups = kept;
        else delete sheet.Sheet__AreaGroups;
        return kept;
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's Curve Hint
    // ---------------------------------------------------------------
    // Shape__Curve is { Curve__Kind : 'circle' | 'arc' } and NOTHING ELSE: one
    // word the Circle and Arc tools (37__System__VectorTools) leave on what
    // they draw. It changes nothing about how the shape is painted, hit, moved
    // or printed - a circle is a closed run of points like any other - and it
    // holds no centre and no radius, because a move or a paste would leave
    // those behind. It only says the points are worth READING as a curve
    // (Na__LeVecCurve__Describe does that, from the points, and answers null
    // once they no longer lie on one). Kept ONLY when it names a kind, the
    // rule Shape__Hatch and Shape__Qr follow, so every shape drawn before it
    // existed stays byte-identical on save.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeCurve(item) {
        const block = item.Shape__Curve;
        const kind  = (block && typeof block === 'object' && !Array.isArray(block)) ? block.Curve__Kind : null;
        if (kind !== 'circle' && kind !== 'arc') { delete item.Shape__Curve; return; }
        item.Shape__Curve = { Curve__Kind : kind };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's Holes (islands)
    // ---------------------------------------------------------------
    // Shape__Holes lists where each hole begins in Shape__Points: the outline
    // is the run up to the first start, each hole the run from its start to
    // the next (Na__LayoutEditor__ShapeRings__). The Boolean tools make them.
    //
    // KEPT ONLY WHILE IT HOLDS A HOLE, the rule Dimension__RoundUp follows, so
    // every shape drawn before holes existed stays byte-identical on save and
    // nothing has to migrate - and the leaf is never asked about a shape
    // without the key. A start that would leave a ring under three points
    // drops out (that hole's points join the ring before it rather than the
    // shape losing its outline). A hole is only ever round a CLOSED outline,
    // so a shape that has one is held closed; a picture, a QR box and a
    // measured room keep none - each reads its own points as one ring.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeHoles(item) {
        if (!('Shape__Holes' in item)) return;
        if (!Array.isArray(item.Shape__Holes) || item.Shape__Holes.length === 0) { delete item.Shape__Holes; return; }   // <-- None: no key, and no question for the leaf
        const plain  = !item.Shape__Image && !item.Shape__Qr && !item.Shape__Area;
        const starts = plain ? Na__LeRings__Clean(item.Shape__Points.length, item.Shape__Holes, true) : [];
        if (!starts.length) { delete item.Shape__Holes; return; }
        item.Shape__Holes  = starts;
        item.Shape__Closed = true;
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's QR Block
    // ---------------------------------------------------------------
    // Shape__Qr is { Qr__MarginMm } and NOTHING ELSE. It says "paint the
    // project's QR symbol inside this shape's box, this far in from it" and
    // names neither a project nor a matrix: the symbol comes from the Project
    // QR Code system at painting time, so the same shape pasted into another
    // project carries that project's code. The margin is clear paper the
    // symbol is owed and the shape's own rule sits at the edge of, so a
    // margin of nothing is still a margin of nothing and is kept as zero.
    //
    // Kept ONLY when the block is an object, the rule Shape__Hatch follows,
    // so every shape drawn before QR codes existed stays byte-identical on
    // save and nothing has to migrate.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeQr(item) {
        const block = item.Shape__Qr;
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
            delete item.Shape__Qr;
            return;
        }
        const margin = Number(block.Qr__MarginMm);
        item.Shape__Qr = { Qr__MarginMm : (Number.isFinite(margin) && margin > 0) ? margin : 0 };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Tidy a Shape's Picture Block
    // ---------------------------------------------------------------
    // Shape__Image is what makes a vector a PICTURE (54__Feature__SheetImages):
    //     Image__File    the stored file, named by its content hash
    //     Image__Folder  the document folder it was last filed in; the save
    //                    files it again under the sheet's id when they part
    //     Image__PixelW/H  the stored file's size
    //     Image__Crop    { L, T, R, B } the kept part, as fractions of the
    //                    picture; absent when the whole picture shows
    //     Image__Frame   the introduction sheets' frame and shadow, on or off
    //     Image__Alpha   only when the picture has transparency
    //     Image__Name    the file that was dropped, for the panel to show
    //     Image__SourceW/H  that dropped file's own pixels, when known: the
    //                    save stores fewer when the sheet prints it smaller
    // A PICTURE IS A PICTURE AND NOTHING ELSE: its points are held to a box of
    // the kept part's proportions (never stretched, whatever wrote them), and
    // an edge, a fill, a hatch, a code or a room on the same record would all
    // draw over or under it, so they go. Kept ONLY when the block names a
    // file, so every shape drawn before pictures existed stays byte-identical.
    // ---------------------------------------------------------------
    function Na__LeRec__NormaliseShapeImage(item) {
        const block = item.Shape__Image;
        if (!block || typeof block !== 'object' || Array.isArray(block) || typeof block.Image__File !== 'string' || !block.Image__File.trim()) {
            delete item.Shape__Image;
            return;
        }
        const pixelW = Math.max(1, Math.round(Number(block.Image__PixelW) || 1));
        const pixelH = Math.max(1, Math.round(Number(block.Image__PixelH) || 1));
        const crop   = Na__LeImgGeo__NormaliseCrop(block.Image__Crop, 0.005);      // <-- Only sanitised here; the crop screen holds its own, larger, minimum
        const out    = {
            Image__File   : block.Image__File.trim().slice(0, 200),
            Image__Folder : (typeof block.Image__Folder === 'string') ? block.Image__Folder.trim().slice(0, 120) : '',
            Image__PixelW : pixelW,
            Image__PixelH : pixelH,
            Image__Frame  : block.Image__Frame !== false                        // <-- On unless switched off: the introduction sheets frame every picture
        };
        if (crop) out.Image__Crop = crop;
        if (block.Image__Alpha === true) out.Image__Alpha = true;
        if (typeof block.Image__Name === 'string' && block.Image__Name.trim()) out.Image__Name = block.Image__Name.trim().slice(0, 200);
        const sourceW = Math.round(Number(block.Image__SourceW)), sourceH = Math.round(Number(block.Image__SourceH));
        if (sourceW > 0 && sourceH > 0) { out.Image__SourceW = sourceW; out.Image__SourceH = sourceH; }   // <-- Both or neither: the original's pixels, for the panel
        item.Shape__Image      = out;
        item.Shape__Closed     = true;
        item.Shape__Stroked    = false;                                          // <-- The frame is the picture's own; a vector edge would draw over it
        item.Shape__FillColour = null;
        item.Shape__Gradient   = null;
        delete item.Shape__Hatch;
        delete item.Shape__Qr;
        delete item.Shape__Area;
        item.Shape__Points     = Na__LeImgGeo__Enforce(item.Shape__Points, pixelW, pixelH, crop, 1);
    }
    // ---------------------------------------------------------------


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
        // site plan data (21__System__SitePlanData) rather than a plan or an
        // elevation. Kept only on such a viewport, as an object with room for the
        // settings still to come; it is always 2D and never carries a drawing id.
        // SitePlan__StoreId names which store it draws - the Existing site plan
        // or the Proposed one. Stored ONLY when set: absent means the project's
        // default store, so every viewport saved before there were two stores is
        // left byte-identical and paints exactly what it painted before.
        if (Na__LeRec__IsSitePlanViewport(viewport)) {
            viewport.Viewport__SitePlan  = Object.assign({}, viewport.Viewport__SitePlan);
            viewport.Viewport__Kind      = Na__LeRec__KIND_2D;
            viewport.Viewport__DrawingId = null;
            if (typeof viewport.Viewport__SitePlan.SitePlan__StoreId !== 'string'
                || !viewport.Viewport__SitePlan.SitePlan__StoreId) {
                delete viewport.Viewport__SitePlan.SitePlan__StoreId;
            }
            Na__LeRec__NormaliseSitePlanComposites(viewport);
            Na__LeRec__NormaliseSitePlanHatches(viewport);
        } else {
            delete viewport.Viewport__SitePlan;
            delete viewport[Na__LeHatch__FIELD];                                 // <-- A hatch has no meaning off a site plan viewport
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
        // ROTATION | Degrees clockwise about the middle of the frame
        // (Na__LayoutEditor__ViewportRotation__), wrapped into (-180, 180] and
        // kept only while the viewport is turned, so a level viewport - every
        // one saved before viewports could turn - is exactly what it was.
        const turn = Na__LeVpRot__WrapDeg(viewport[Na__LeVpRot__FIELD]);
        if (turn !== 0) viewport[Na__LeVpRot__FIELD] = turn;
        else delete viewport[Na__LeVpRot__FIELD];
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
            contextLayer      : pick('contextLayer'),
            depthFog          : pick('depthFog')                                 // <-- "Show the drawing's own depth fog, if it has one". The fog itself is the DRAWING's (Elevation__DepthFog); this only lets one viewport show it bare
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
        // HIDE SWINGS | A plan viewport's door swings left off (true) or drawn
        // (false), kept only once somebody has ticked or unticked the box.
        // Absent, the plan's storey decides (Na__LayoutEditor__PlanDoors__: a
        // roof plan hides them), so a viewport nobody has touched is unchanged
        // by a load and goes on following its plan.
        if (typeof viewport.Viewport__HideSwings !== 'boolean') delete viewport.Viewport__HideSwings;
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
        if (item.Dimension__RoundUp !== true) delete item.Dimension__RoundUp;   // <-- Round up to 5 mm: kept only while it is on, so a record from before it saves exactly as it did
        // LINE WEIGHT AND STYLE | Points inside the Lineweights bounds, else no
        // key - the sheet's Dimension pt. A line style only while it is not
        // solid, else no key. A record from before either draws as it did.
        if (item.Dimension__LinePt !== undefined) {
            const pt = item.Dimension__LinePt;
            const lw = Na__LeCfg__GetLineweightSetup();
            if (!(typeof pt === 'number' && Number.isFinite(pt) && pt > 0)) delete item.Dimension__LinePt;
            else item.Dimension__LinePt = Math.min(lw.maxPt, Math.max(lw.minPt, pt));
        }
        if (item.Dimension__LineStyle !== undefined) {
            const style = Na__LeDash__Normalise(item.Dimension__LineStyle);
            if (style) item.Dimension__LineStyle = style; else delete item.Dimension__LineStyle;
        }
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
        Na__LeRec__NormaliseShapeHatch(item);                                             // <-- The repeating pattern over its fill, if it has one
        Na__LeRec__NormaliseShapeQr(item);                                                // <-- The project's QR symbol inside its box, if it carries one
        Na__LeRec__NormaliseShapeCurve(item);                                             // <-- The Circle and Arc tools' one-word hint, if it carries one
        Na__LeRec__NormaliseShapeArea(item);                                              // <-- What it is called and what it is filed under, if it is a measured room
        Na__LeRec__NormaliseShapeImage(item);                                             // <-- Which stored picture it shows and how much of it, if it is a picture - after the three above, which it clears
        Na__LeRec__NormaliseShapeHoles(item);                                             // <-- Where each hole begins, if it has any - after the picture, the QR box and the room, none of which keeps one
        item.Shape__StrokeOpacity = Na__LeRec__Unit(item.Shape__StrokeOpacity, 1);
        item.Shape__Gradient = Na__LeGrad__Normalise(item.Shape__Gradient);              // <-- A fresh object or null: no two shapes ever hold the same gradient
        item.Shape__LineStyle = Na__LeDash__Normalise(item.Shape__LineStyle);            // <-- Likewise: null is a solid edge, and a record from before the toggle stays one
        item.Shape__Stroked = item.Shape__Stroked !== false;                             // <-- A record written before the flag existed drew its edges
        const filled  = item.Shape__FillColour !== null || item.Shape__Gradient !== null;   // <-- A gradient is a fill as far as visibility goes
        const canFill = filled && item.Shape__Points.length > 2;                            // <-- Two points enclose nothing, so they cannot be a fill
        const paints  = canFill || !!item.Shape__Qr || !!item.Shape__Area || !!item.Shape__Image;   // <-- A QR block paints the whole box, a floor area writes its name in the middle and a picture is a picture, so none of them is ever invisible
        if (!item.Shape__Stroked && !paints) item.Shape__Stroked = true;                    // <-- Edges, fill or a code, never none of them: an invisible shape is a lost shape
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


    // FUNCTION | Fill In a Group (members are { kind, id } of a viewport, vector, text, leader, dimension or group)
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
    // IncludeGeneral, GroupHeadings }, then - only when the record had them -
    // the overspill note regions (RegionsOn, Regions) and the leaderless notes
    // (LeaderlessOn, LeaderlessGroups). A sheet that never had a margin carries
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
        Na__LeRec__NormaliseNoteRegions(raw, sheet.Sheet__MarginNotes);         // <-- RegionsOn and Regions, only when the record had them
        Na__LeRec__NormaliseLeaderlessNotes(raw, sheet.Sheet__MarginNotes);     // <-- LeaderlessOn and LeaderlessGroups, likewise
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


    // HELPER FUNCTION | Restack a Sheet Laid Out Before the List Was Obeyed
    // ------------------------------------------------------------
    // Until 21-Sep-2026 every viewport was painted under every piece of
    // markup whatever order the Layers list was in, so the list only ever
    // ordered viewports against each other. Every sheet was seeded with the
    // Viewports layer at the TOP of the list, and now that the list is the
    // paint order that would put every picture over the text, the dimensions
    // and the vectors on it. So a sheet from before is restacked ONCE: every
    // layer holding a viewport moves down below the rest, and nothing else
    // moves. A sheet whose drawings already sit below its markup - PS01's plans
    // and elevations, which Adam had dragged into that order - is left exactly
    // as it is, and so is a floor area layer somebody has put under a drawing.
    //
    // A layer is judged by what it HOLDS, since its type is only a tag, and an
    // empty one by what its type says it is for:
    //   a viewport layer  holds a viewport (or is an empty Viewports layer)
    //   an area layer     holds floor areas and nothing else (or is an empty
    //                     Floor Areas layer)
    //   a markup layer    everything else - text, dimensions, leaders, plain
    //                     vectors, or nothing yet
    // Any MARKUP layer under a viewport layer calls for the restack - an EMPTY
    // one too, because the first note typed onto a sheet lands on its Text
    // layer, and under the old seed that would put it under the picture
    // (RB05's TEMP__Plans is exactly that: one viewport and three empty layers
    // beneath it). An area layer never calls for it: floor areas are newer than
    // the list's being ignored, and one under a drawing was put there. When a
    // restack does happen the area layers ride up with the markup, so rooms
    // drawn over a plan stay over it.
    // Returns true when the order changed.
    // ------------------------------------------------------------
    function Na__LeRec__RestackLegacyLayers(sheet) {
        const layers = sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order);   // <-- Top of the list first
        const holds  = new Map(layers.map((layer) => [ layer.Layer__Id, { viewports : 0, markup : 0, areas : 0 } ]));
        const count  = (layerId, key) => { const entry = holds.get(layerId); if (entry) entry[key] += 1; };
        (sheet.Sheet__Viewports   || []).forEach((v) => count(v.Viewport__LayerId, 'viewports'));
        (sheet.Sheet__Annotations || []).forEach((a) => count(a.Annotation__LayerId, 'markup'));
        (sheet.Sheet__Dimensions  || []).forEach((d) => count(d.Dimension__LayerId, 'markup'));
        (sheet.Sheet__Leaders     || []).forEach((l) => count(l.Leader__LayerId, 'markup'));
        (sheet.Sheet__Shapes      || []).forEach((s) => count(s.Shape__LayerId, (s.Shape__Area && typeof s.Shape__Area === 'object') ? 'areas' : 'markup'));
        const empty = (held) => held.viewports === 0 && held.markup === 0 && held.areas === 0;
        const isViewportLayer = (layer) => {
            const held = holds.get(layer.Layer__Id);
            return held.viewports > 0 || (empty(held) && layer.Layer__Type === 'viewport');
        };
        const isAreaLayer = (layer) => {
            const held = holds.get(layer.Layer__Id);
            return !isViewportLayer(layer) && held.markup === 0 && (held.areas > 0 || layer.Layer__Type === 'area');
        };
        const topDrawing = layers.findIndex(isViewportLayer);
        if (topDrawing === -1) return false;
        const buried = layers.some((layer, index) => index > topDrawing && !isViewportLayer(layer) && !isAreaLayer(layer));
        if (!buried) return false;                                               // <-- No markup layer sits under a picture: the list already shows what the sheet showed
        const upper = layers.filter((layer) => !isViewportLayer(layer));
        const lower = layers.filter(isViewportLayer);
        upper.concat(lower).forEach((layer, index) => { layer.Layer__Order = index + 1; });
        sheet.Sheet__Layers.sort((a, b) => a.Layer__Order - b.Layer__Order);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put Items on a Layer That Is Gone Back on One That Is Not
    // ------------------------------------------------------------
    // DeleteLayer did not re-home vectors until 21-Sep-2026, so a sheet can
    // hold vectors whose layer is gone: drawn, because an unknown layer reads
    // as shown, but out of reach of the Layers panel - and, now that the list
    // is the paint order, outside it. Each goes to the layer its kind lands
    // on, a floor area to Floor Areas when the sheet has one.
    // ------------------------------------------------------------
    function Na__LeRec__RehomeOrphans(sheet) {
        const known = new Set(sheet.Sheet__Layers.map((layer) => layer.Layer__Id));
        const home  = (item, key, type) => {
            if (typeof item[key] === 'string' && item[key] && !known.has(item[key])) item[key] = Na__LeRec__DefaultLayerId(sheet, type);
        };
        const hasAreaLayer = sheet.Sheet__Layers.some((layer) => layer.Layer__Type === 'area');
        sheet.Sheet__Viewports.forEach((v)   => home(v, 'Viewport__LayerId', 'viewport'));
        sheet.Sheet__Annotations.forEach((a) => home(a, 'Annotation__LayerId', 'annotation'));
        sheet.Sheet__Dimensions.forEach((d)  => home(d, 'Dimension__LayerId', 'dimension'));
        sheet.Sheet__Leaders.forEach((l)     => home(l, 'Leader__LayerId', 'annotation'));
        sheet.Sheet__Shapes.forEach((s)      => home(s, 'Shape__LayerId', (hasAreaLayer && s.Shape__Area && typeof s.Shape__Area === 'object') ? 'area' : ((s.Shape__Image && typeof s.Shape__Image === 'object') ? 'image' : 'vector')));   // <-- A picture goes to Images, or to Vectors on a sheet that has none (DefaultLayerId)
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

        // A NEW SHEET'S LAYERS, TOP OF THE LIST FIRST - which is frontmost, now
        // that the list is the paint order: text over dimensions over vectors,
        // the measured rooms over the drawings, and the drawings at the back.
        // The ids are the ones every sheet has always had, so the layer a kind
        // lands on is found exactly as before; only the order is new.
        if (!Array.isArray(sheet.Sheet__Layers) || sheet.Sheet__Layers.length === 0) {
            sheet.Sheet__Layers = [
                { Layer__Id : 'Layer_002', Layer__Name : 'Text',        Layer__Type : 'annotation', Layer__Visible : true, Layer__Locked : false, Layer__Order : 1 },
                { Layer__Id : 'Layer_003', Layer__Name : 'Dimensions',  Layer__Type : 'dimension',  Layer__Visible : true, Layer__Locked : false, Layer__Order : 2 },
                { Layer__Id : 'Layer_004', Layer__Name : 'Vectors',     Layer__Type : 'vector',     Layer__Visible : true, Layer__Locked : false, Layer__Order : 3 },
                { Layer__Id : 'Layer_005', Layer__Name : 'Floor Areas', Layer__Type : 'area',       Layer__Visible : true, Layer__Locked : false, Layer__Order : 4 },   // <-- Measured rooms, on a layer of their own so they can be switched off once drawn
                { Layer__Id : 'Layer_001', Layer__Name : 'Viewports',   Layer__Type : 'viewport',   Layer__Visible : true, Layer__Locked : false, Layer__Order : 5 }
            ];
            sheet.Sheet__LayerStack = Na__LeRec__LAYER_STACK;                    // <-- Born in the right order: nothing to restack
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
        Na__LeRec__NormaliseAreaGroups(sheet);                                   // <-- Only a sheet that has floor area groups

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

        Na__LeRec__NormaliseLayerStack(sheet);
        return sheet;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make the Layers List Fit to Be the Paint Order
    // ------------------------------------------------------------
    // Every item on a layer that exists, and a sheet from before the list was
    // obeyed restacked ONCE, so that nothing it showed ends up under a
    // picture. Called by NormaliseSheet with its item lists in place; on its
    // own it is the seam the layer stack test drives. Returns true when the
    // order was changed.
    // ------------------------------------------------------------
    function Na__LeRec__NormaliseLayerStack(sheet) {
        if (!sheet || !Array.isArray(sheet.Sheet__Layers)) return false;
        [ 'Sheet__Viewports', 'Sheet__Annotations', 'Sheet__Dimensions', 'Sheet__Shapes', 'Sheet__Leaders' ].forEach((key) => { if (!Array.isArray(sheet[key])) sheet[key] = []; });
        Na__LeRec__RehomeOrphans(sheet);
        if (sheet.Sheet__LayerStack === Na__LeRec__LAYER_STACK) return false;
        const moved = Na__LeRec__RestackLegacyLayers(sheet);
        sheet.Sheet__LayerStack = Na__LeRec__LAYER_STACK;                        // <-- Once: an order chosen after this is the user's, and is never second-guessed
        return moved;
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
        if (type === 'image') return Na__LeRec__DefaultLayerId(sheet, 'vector');   // <-- A sheet with no Images layer: a picture is a vector, and the top layer of the list (Text) would put it over every note
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
            DrawnBy       : setup.drawnByDefault,
            Status        : setup.statusDefault                                  // <-- Empty as shipped: a drawing claims no status until one is chosen for it
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
        Na__LeRec__NormaliseShapeArea,
        Na__LeRec__NormaliseShapeImage,
        Na__LeRec__NormaliseAreaGroups,
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
        Na__LeRec__NormaliseLayerStack,
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
