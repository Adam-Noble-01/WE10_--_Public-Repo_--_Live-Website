// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the sheet records, their layers, viewports, text and dimensions
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The single owner of LayoutEditor__DrawingsData.__Sheets. Every other
//   module in this folder reads and writes sheets through here, and every
//   change is announced on one event so the surface and the panels redraw
//   from the records rather than from each other.
//
// - RECORDS (three-stage keys, plan section 5)
//     Sheet       Sheet__Id, Name, Order, PaperSize, Orientation,
//                 TitleBlockStyle, Fields {...}, Layers [], Viewports [],
//                 Annotations [], Dimensions [], Shapes [], Groups [],
//                 Lineweights {ViewportPt, DimensionPt}
//     Layer       Layer__Id, Name, Type, Visible, Locked, Order
//     Viewport    Viewport__Id, LayerId, Name, Kind ('2d' | '3d'), SceneId,
//                 DrawingId, FrameMm {X, Y, WidthMm, HeightMm},
//                 ScaleDenominator, PanMm {X, Y}, ImageMm {WidthMm, HeightMm},
//                 ImageOffsetMm {X, Y}, Styles {...}, MarkupMode, Locked,
//                 SnapshotAsset {Asset__Path, Asset__Fingerprint, Asset__PixelWidth},
//                 ModelSourceId (a model group's groupId; null draws the Project Default),
//                 ShowScaleLabel, ShowFrame (only ever false: the frame and caption hidden),
//                 ClosedDoors (the door keys a plan draws shut; absent while every door is open)
//     Annotation  Annotation__Id, LayerId, Text, PosXMm, PosYMm, SizeMm,
//                 FontWeight, Colour, Align, LeaderXMm, LeaderYMm
//     Dimension   Dimension__Id, LayerId, ViewportId, StartXMm, StartYMm,
//                 EndXMm, EndYMm, OffsetMm, TextSizeMm, Colour, Terminator,
//                 TickLengthMm (how large the ticks, arrows or dots at each
//                 end are; no key draws at the config TickLengthMm),
//                 Precision, UnitsSuffix, OverrideText,
//                 Orientation ('aligned' | 'horizontal' | 'vertical'),
//                 AtScale (true reads the drawing's scale, false the paper; a
//                 record from before it has no key and reads as it always did),
//                 StartExtensionMm, EndExtensionMm (how far each extension line
//                 runs back from the dimension line; no key is the full line),
//                 ExtensionsLinked (only ever false: the padlock between them open),
//                 TextDXMm, TextDYMm (paper offset of the value from where it
//                 would have sat; no key is on the line, and a drag home
//                 removes both)
//     Shape      Shape__Id, LayerId, Points [[x, y], ...], Closed, Stroked, StrokeColour,
//                 StrokePt, FillColour (null for none), Gradient (null for none;
//                 the shape is Na__LayoutEditor__GradientTool__'s), FillOpacity,
//                 StrokeOpacity (0 to 1)
//     Group       Group__Id, Members [{ kind, id }] of a vector, a text item
//                 or another group. Members stay first-class sheet records;
//                 the group is the selection, the move and the copy unit
//                 (Na__LayoutEditor__Groups__).
//     Leader      Leader__Id, LayerId, Type ('text' | 'bubble'), TipXMm, TipYMm,
//                 AnchorXMm, AnchorYMm, Text, TextSizeMm, FontWeight, TextColour,
//                 LineColour, LinePt, LineStyle ('solid' | 'dashed'), LineOpacity,
//                 EndpointFilled, EndpointPt, EndpointSizeMm, BubbleSizeMm,
//                 BubbleEdgePt, FillColour (null for none), FillOpacity,
//                 SpecNoteId (only on a bubble linked to a specification note)
//                 (drawn by Na__LayoutEditor__LeaderGeometry__)
//     MarginNotes Sheet__MarginNotes {Enabled, WidthMm, Heading, TextSizeMm,
//                 IncludeGeneral, GroupHeadings} - only on a sheet that has had one
//   Paper coordinates are millimetres from the sheet's top-left, y down.
//
// - The active sheet and the selection are session state, held here so the
//   panels and the surface agree on them. The selection is a set of
//   { kind, id } - one item, or several from a selection box or Shift and
//   Ctrl clicks; GetSelection reads it as the one item when there is exactly
//   one, which is all a properties panel can edit.
//
// INTEGRATION:
// - Loads from Na__DrawView__ProjectData__ on its events; Save goes through
//   Na__DrawData__Save (D08).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetModel__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.18.0
// - Groups: GetGroupById, InsertGroup, DeleteGroup, GetGroups. A group is a
//   list of member { kind, id } (vectors, text, nested groups). InsertShape,
//   InsertViewport and InsertAnnotation take silent so a paste of several
//   items announces once. DeleteItems also removes groups and drops deleted
//   members from any group that held them. Announced as 'groups'.
//
// 14-Sep-2026 - Version 1.17.0
// - CreateDimension and UpdateDimension carry textDXMm and textDYMm:
//   Dimension__TextDXMm and Dimension__TextDYMm, the value's paper offset
//   from its un-dragged place. The normaliser keeps them only while they
//   shift the value, so a record that never had them is unchanged and the
//   value sits on the line as it always did.
//
// 14-Sep-2026 - Version 1.16.0
// - InsertShape: a whole vector record goes onto a sheet with a fresh id
//   (Na__LayoutEditor__ViewportClipboard__), so a paste is one announcement
//   and one undo step. GetShapeById reads one by id, the way GetViewportById
//   does. A layer id the sheet does not have, or that is not a vector layer,
//   falls back to the default vector layer, creating one if the sheet has none.
//
// 14-Sep-2026 - Version 1.15.0
// - CreateDimension and UpdateDimension carry tickLengthMm:
//   Dimension__TickLengthMm, how large the ticks, arrows or dots at each end
//   are (the Dimensions panel's Size mm). The normaliser keeps a length only
//   when there is one, so a record that never had it is unchanged and draws
//   at the config TickLengthMm.
//
// 14-Sep-2026 - Version 1.14.0
// - UpdateViewport takes the closedDoors patch key: the door keys a plan
//   viewport draws shut (Viewport__ClosedDoors, Na__LayoutEditor__PlanDoors__).
//   Every other door on a plan is drawn open; an empty list removes the key.
//   A content edit and one undo step.
//
// 14-Sep-2026 - Version 1.13.0
// - CreateDimension and UpdateDimension carry the fixed length extension lines:
//   startExtensionMm and endExtensionMm (a length of zero or more, or null for
//   the full line) and extensionsLinked (the Dimensions panel's padlock). The
//   normaliser keeps a length only when there is one and the padlock only
//   while it is open, so a record that never had them is unchanged.
//
// 14-Sep-2026 - Version 1.12.0
// - CreateDimension takes atScale and UpdateDimension the atScale patch key:
//   Dimension__AtScale, the Dimensions panel's Measure at scale. Left out, a
//   new record carries no key and reads as a record from before it does
//   (Na__LayoutEditor__DrawingScale__).
//
// 14-Sep-2026 - Version 1.11.0
// - Save says where the sheets went, through the toast it is given: saved to R2
//   and locally once the repository copy is written as well, saved to R2 on the
//   web build, and an error naming the cause when the local copy failed. Before
//   this a save that worked showed nothing at all.
//
// 14-Sep-2026 - Version 1.10.0
// - UpdateViewport takes the showFrame patch key: false hides the viewport's
//   frame and caption on the sheet and in the PDF (Viewport__ShowFrame); true
//   shows them again and the key goes. A content edit and one undo step, like
//   the caption switch beside it.
//
// 14-Sep-2026 - Version 1.9.0
// - Project Specification: CreateLeader takes specNoteId and UpdateLeader the
//   specNoteId patch key - a note id links the bubble, null or empty unlinks it
//   (the key goes). Na__LayoutEditor__SpecLinks__ keeps the linked text stamped.
// - UpdateMarginNotes switches, widens and restyles a sheet's notes margin,
//   announced as 'margin': a content edit, one undo step, never an auto save.
//
// 14-Sep-2026 - Version 1.8.0
// - The selection is a set: SetSelectionItems, GetSelectionItems, IsSelected,
//   and Unselect for the deletes. GetSelection still answers { kind, id } for
//   exactly one item and null for none or several, so every single-item reader
//   is unchanged; SetSelection sets a set of one.
// - DeleteItems removes any mix of viewports, text, dimensions, shapes and
//   leaders in one pass, with one announcement per collection touched: one
//   undo step for a multi-selection delete (Na__LayoutEditor__SelectionSet__).
//
// 14-Sep-2026 - Version 1.7.0
// - Leaders & Annotation Bubbles: GetLeaders, CreateLeader, UpdateLeader and
//   DeleteLeader, announced as 'leaders' (the collection) and 'leader' (one
//   item). New sheets carry Sheet__Leaders; deleting a layer moves its leaders
//   to the default text layer.
// - CreateShape and UpdateShape carry Shape__FillOpacity and
//   Shape__StrokeOpacity (the fillOpacity and strokeOpacity keys, 0 to 1).
//
// 13-Sep-2026 - Version 1.6.0
// - CreateViewport takes modelSourceId and UpdateViewport the modelSourceId
//   patch key: the design phase a viewport draws (Viewport__ModelSourceId, see
//   Na__LayoutEditor__ModelSource__). An empty value is the Project Default.
//
// 13-Sep-2026 - Version 1.5.0
// - CreateDimension and UpdateDimension carry Dimension__Orientation (the
//   orientation key: 'aligned', 'horizontal' or 'vertical') for the Dimension
//   tool's Shift ortho. The normaliser makes anything else aligned.
//
// 13-Sep-2026 - Version 1.4.0
// - AnnounceRestore: undo and redo put a snapshot back through here rather than
//   through UpdateSheet. The announcement is still a sheet update, so every
//   listener redraws exactly as before, but it carries restore :
//   { direction, stepReason } - the step being reversed or replayed - so the
//   auto save can save an undo the way that step was saved, instead of reading
//   every undo as a sheet-settings change and writing the whole project to R2.
// - Dispatch and Touch pass an optional restore through to the event detail
//   (null on every other change).
//
// 13-Sep-2026 - Version 1.3.1
// - CreateShape and UpdateShape carry Shape__Gradient (the gradient key: an
//   object, or null to clear it). The normaliser copies it, so no two shapes
//   ever share one.
//
// 13-Sep-2026 - Version 1.3.0
// - InsertViewport: a whole viewport record goes onto a sheet with a fresh id
//   and a single announcement, for the viewport clipboard's paste and duplicate.
//
// 10-Sep-2026 - Version 1.2.1
// - CreateShape and UpdateShape carry Shape__Stroked (the edges toggle).
//
// 10-Sep-2026 - Version 1.2.0
// - Vector shapes: CreateShape, UpdateShape, DeleteShape ('shapes' and 'shape' reasons). CreateDimension takes silent. UpdateSheet takes lineweights.
//
// 10-Sep-2026 - Version 1.1.0
// - Viewport__Locked patch key. A save announces 'saved' instead of 'loaded', so the selection and the undo history survive it.
// - RestoreSheets puts the browser draft back after a load.
//
// 10-Sep-2026 - Version 1.0.1
// - Record helpers, normalisers and the title block fields moved to Na__LayoutEditor__SheetRecords__.js (line budget).
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Drawings Block, Drawing Records and Scenes
    // ------------------------------------------------------------
    import {
        Na__DrawData__SHEETS_KEY,
        Na__DrawData__GetBlock,
        Na__DrawData__Save,
        Na__DrawData__LOADED_EVENT,
        Na__DrawData__CHANGED_EVENT
    } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__FpData__GetPlanById } from '../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetElevationById } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers and Scale
    // ------------------------------------------------------------
    import {
        Na__LeRec__KIND_2D,
        Na__LeRec__KIND_3D,
        Na__LeRec__LAYER_TYPES,
        Na__LeRec__STYLE_KEYS,
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseLayer,
        Na__LeRec__NormaliseViewport,
        Na__LeRec__NormaliseAnnotation,
        Na__LeRec__NormaliseDimension,
        Na__LeRec__NormaliseSheet,
        Na__LeRec__DefaultLayerId,
        Na__LeRec__BuildFields,
        Na__LeRec__NormaliseShape,
        Na__LeRec__NormaliseLeader,
        Na__LeRec__NormaliseGroup,
        Na__LeRec__NormaliseMarginNotes
    } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeScale__Coerce } from './Na__LayoutEditor__ScaleManager__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Labels (the save confirmation)
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from './Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Edge Styles and Composite Weights
    // ------------------------------------------------------------
    import { Na__LeEdge__FIELD, Na__LeEdge__CAT_FIELD } from './Na__LayoutEditor__EdgeStyles__.js';
    import { Na__LeComposite__FIELD, Na__LeComposite__Clamp } from './Na__LayoutEditor__RenderComposites__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Events, Kinds and Id Prefixes
    // ------------------------------------------------------------
    const Na__LeModel__CHANGED_EVENT   = 'na-layouteditor-sheets-changed';
    const Na__LeModel__KIND_2D         = Na__LeRec__KIND_2D;
    const Na__LeModel__KIND_3D         = Na__LeRec__KIND_3D;
    const Na__LeModel__LAYER_TYPES     = Na__LeRec__LAYER_TYPES;
    const Na__LeModel__SCENES_KEY      = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__LeModel__STYLE_KEYS      = Na__LeRec__STYLE_KEYS;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__LeModel__ActiveSheetId  = null;
    let Na__LeModel__SelectionItems = [];      // <-- [{ kind : 'viewport' | 'annotation' | 'dimension' | 'shape' | 'leader', id }], in the order chosen
    let Na__LeModel__Dirty         = false;
    let Na__LeModel__Initialized   = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change
    // ------------------------------------------------------------
    // restore is null except when undo or redo put a snapshot back:
    // { direction : 'undo' | 'redo', stepReason } - see AnnounceRestore.
    // ------------------------------------------------------------
    function Na__LeModel__Dispatch(reason, sheetId, itemId, restore) {
        window.dispatchEvent(new CustomEvent(Na__LeModel__CHANGED_EVENT, {
            detail : { reason : reason || 'change', sheetId : sheetId || Na__LeModel__ActiveSheetId, itemId : itemId || null, restore : restore || null }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Touch: Mark Dirty and Announce
    // ------------------------------------------------------------
    function Na__LeModel__Touch(reason, sheetId, itemId, restore) {
        Na__LeModel__Dirty = true;
        Na__LeModel__Dispatch(reason, sheetId, itemId, restore);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sheets Array in the Drawings Block (created on demand)
    // ------------------------------------------------------------
    function Na__LeModel__Array() {
        const block = Na__DrawData__GetBlock();
        if (!block) return [];
        if (!Array.isArray(block[Na__DrawData__SHEETS_KEY])) block[Na__DrawData__SHEETS_KEY] = [];
        return block[Na__DrawData__SHEETS_KEY];
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheets
// -----------------------------------------------------------------------------

    // FUNCTION | Every Sheet, Normalised and in Order
    // ------------------------------------------------------------
    function Na__LeModel__GetSheets() {
        const list = Na__LeModel__Array().filter((s) => s && typeof s === 'object' && typeof s.Sheet__Id === 'string');
        list.forEach(Na__LeRec__NormaliseSheet);
        return list.sort((a, b) => a.Sheet__Order - b.Sheet__Order);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Sheet by Id (null when absent)
    // ------------------------------------------------------------
    function Na__LeModel__GetSheetById(sheetId) {
        return Na__LeRec__Find(Na__LeModel__GetSheets(), 'Sheet__Id', sheetId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet on Screen (null when in the 3D model tab)
    // ------------------------------------------------------------
    function Na__LeModel__GetActiveSheet() {
        return Na__LeModel__ActiveSheetId ? Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Active Sheet (null = 3D model)
    // ------------------------------------------------------------
    function Na__LeModel__SetActiveSheetId(sheetId) {
        const next = (sheetId && Na__LeModel__GetSheetById(sheetId)) ? sheetId : null;
        if (next === Na__LeModel__ActiveSheetId) return next;
        Na__LeModel__ActiveSheetId  = next;
        Na__LeModel__SelectionItems = [];
        Na__LeModel__Dispatch('active', next);
        return next;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__CreateSheet(options) {
        const opts  = options || {};
        const list  = Na__LeModel__Array();
        const sheet = {
            Sheet__Id              : Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id'),
            Sheet__Name            : (typeof opts.name === 'string' && opts.name.trim()) ? opts.name.trim() : '',
            Sheet__Order           : list.length + 1,
            Sheet__PaperSize       : opts.paperSize || null,
            Sheet__Orientation     : opts.orientation || null,
            Sheet__TitleBlockStyle : opts.titleBlockStyle || null,
            Sheet__Fields          : {},
            Sheet__Layers          : [],
            Sheet__Viewports       : [],
            Sheet__Annotations     : [],
            Sheet__Dimensions      : [],
            Sheet__Shapes          : [],
            Sheet__Leaders         : [],
            Sheet__Groups          : []
        };
        list.push(sheet);
        Na__LeRec__NormaliseSheet(sheet, list.length - 1);
        Na__LeModel__Touch('sheet-created', sheet.Sheet__Id);
        return sheet;
    }
    // ------------------------------------------------------------


    // FUNCTION | Duplicate a Sheet (deep copy, fresh id, assets dropped)
    // ------------------------------------------------------------
    function Na__LeModel__DuplicateSheet(sheetId) {
        const source = Na__LeModel__GetSheetById(sheetId);
        if (!source) return null;
        const list = Na__LeModel__Array();
        const copy = JSON.parse(JSON.stringify(source));
        copy.Sheet__Id    = Na__LeRec__NextId(list, 'Sheet_', 'Sheet__Id');
        copy.Sheet__Name  = source.Sheet__Name + ' copy';
        copy.Sheet__Order = list.length + 1;
        copy.Sheet__Viewports.forEach((v) => { v.Viewport__SnapshotAsset = null; });   // <-- Snapshots are keyed by viewport id
        list.push(copy);
        Na__LeModel__Touch('sheet-created', copy.Sheet__Id);
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__DeleteSheet(sheetId) {
        const list = Na__LeModel__Array();
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].Sheet__Id === sheetId) {
                list.splice(i, 1);
                list.forEach((s, k) => { s.Sheet__Order = k + 1; });
                if (Na__LeModel__ActiveSheetId === sheetId) { Na__LeModel__ActiveSheetId = null; Na__LeModel__SelectionItems = []; }
                Na__LeModel__Touch('sheet-deleted', sheetId);
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename, Re-Paper, Restyle or Reorder a Sheet
    // ------------------------------------------------------------
    function Na__LeModel__UpdateSheet(sheet, patch) {
        if (!sheet || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) sheet.Sheet__Name = patch.name.trim();
        if (typeof patch.paperSize === 'string') sheet.Sheet__PaperSize = patch.paperSize;
        if (typeof patch.orientation === 'string') sheet.Sheet__Orientation = patch.orientation;
        if (typeof patch.titleBlockStyle === 'string') sheet.Sheet__TitleBlockStyle = patch.titleBlockStyle;
        if (patch.lineweights && typeof patch.lineweights === 'object') {
            const lw = sheet.Sheet__Lineweights || (sheet.Sheet__Lineweights = {});
            if (Number.isFinite(patch.lineweights.viewportPt))  lw.ViewportPt  = patch.lineweights.viewportPt;
            if (Number.isFinite(patch.lineweights.dimensionPt)) lw.DimensionPt = patch.lineweights.dimensionPt;
        }
        Na__LeRec__NormaliseSheet(sheet, sheet.Sheet__Order - 1);
        Na__LeModel__Touch('sheet-updated', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Announce a Sheet That Undo or Redo Has Put Back
    // ------------------------------------------------------------
    // restore: { direction : 'undo' | 'redo', stepReason } - the reason the
    // step being reversed or replayed was first announced with.
    //
    // The history module has already written the snapshot into the live
    // record. This normalises it, marks the project dirty and announces it.
    // For drawing purposes a restore IS a sheet update - any part of the sheet
    // may have changed - so it goes out as 'sheet-updated' and every listener
    // redraws exactly as it would for one. What it must not be mistaken for is
    // the EDIT that reason usually means: the auto save reads 'sheet-updated'
    // as a sheet-settings change and writes the whole project, so before the
    // restore detail existed every Ctrl+Z - even of a vector delete - saved to
    // R2 a second and a half later. The detail lets the auto save judge an
    // undo by the step it reverses. A restore with no detail never saves.
    // ------------------------------------------------------------
    function Na__LeModel__AnnounceRestore(sheet, restore) {
        if (!sheet) return false;
        Na__LeRec__NormaliseSheet(sheet, sheet.Sheet__Order - 1);
        Na__LeModel__Touch('sheet-updated', sheet.Sheet__Id, null, restore || { direction : 'undo', stepReason : null });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Sheet to a New Position in the Tab Order
    // ------------------------------------------------------------
    function Na__LeModel__ReorderSheet(sheetId, newIndex) {
        const list = Na__LeModel__GetSheets();
        const from = list.findIndex((s) => s.Sheet__Id === sheetId);
        if (from === -1) return false;
        const [ moved ] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, moved);
        list.forEach((s, k) => { s.Sheet__Order = k + 1; });
        Na__LeModel__Touch('sheet-reordered', sheetId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title Block Fields With Project Defaults Filled In
    // ------------------------------------------------------------
    function Na__LeModel__GetFields(sheet) {
        return Na__LeRec__BuildFields(sheet);
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch, Widen or Restyle a Sheet's Notes Margin
    // ------------------------------------------------------------
    // patch: { enabled, widthMm, heading (null or empty for the configured
    // one), textSizeMm, includeGeneral, groupHeadings }. The first change
    // creates Sheet__MarginNotes. Announced as 'margin': a content edit, kept
    // by the browser draft and Save Sheets, one undo step, never an auto save.
    // silent: true skips the announcement (the edge grip while it is dragged).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateMarginNotes(sheet, patch, silent) {
        if (!sheet || !patch) return false;
        const notes = (sheet.Sheet__MarginNotes && typeof sheet.Sheet__MarginNotes === 'object') ? sheet.Sheet__MarginNotes : (sheet.Sheet__MarginNotes = {});
        if (typeof patch.enabled === 'boolean') notes.Enabled = patch.enabled;
        if (Number.isFinite(patch.widthMm)) notes.WidthMm = patch.widthMm;
        if (patch.heading !== undefined) notes.Heading = (typeof patch.heading === 'string' && patch.heading.trim()) ? patch.heading : null;
        if (Number.isFinite(patch.textSizeMm)) notes.TextSizeMm = patch.textSizeMm;
        if (typeof patch.includeGeneral === 'boolean') notes.IncludeGeneral = patch.includeGeneral;
        if (typeof patch.groupHeadings === 'boolean') notes.GroupHeadings = patch.groupHeadings;
        Na__LeRec__NormaliseMarginNotes(sheet);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('margin', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set One Title Block Field on a Sheet (null restores the default)
    // ------------------------------------------------------------
    function Na__LeModel__SetField(sheet, key, value) {
        if (!sheet) return false;
        if (!sheet.Sheet__Fields) sheet.Sheet__Fields = {};
        if (value === null || value === undefined) delete sheet.Sheet__Fields['Sheet__Fields__' + key];
        else sheet.Sheet__Fields['Sheet__Fields__' + key] = String(value);
        Na__LeModel__Touch('fields', sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Layers
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Layers, Frontmost Last in Paint Order
    // ------------------------------------------------------------
    function Na__LeModel__GetLayers(sheet) {
        return sheet ? sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layer New Items of a Type Land On
    // ------------------------------------------------------------
    function Na__LeModel__DefaultLayerId(sheet, type) {
        return Na__LeRec__DefaultLayerId(sheet, type);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Layer by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetLayerById(sheet, layerId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Layers, 'Layer__Id', layerId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Layer (on top)
    // ------------------------------------------------------------
    function Na__LeModel__CreateLayer(sheet, options) {
        if (!sheet) return null;
        const opts  = options || {};
        const layer = Na__LeRec__NormaliseLayer({
            Layer__Id    : Na__LeRec__NextId(sheet.Sheet__Layers, 'Layer_', 'Layer__Id'),
            Layer__Name  : opts.name,
            Layer__Type  : opts.type,
            Layer__Order : sheet.Sheet__Layers.length + 1
        }, sheet.Sheet__Layers.length);
        sheet.Sheet__Layers.push(layer);
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layer.Layer__Id);
        return layer;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Layer, Moving Its Items to the Default of Their Type
    // ------------------------------------------------------------
    function Na__LeModel__DeleteLayer(sheet, layerId) {
        if (!sheet || sheet.Sheet__Layers.length <= 1) return false;
        const index = sheet.Sheet__Layers.findIndex((l) => l.Layer__Id === layerId);
        if (index === -1) return false;
        sheet.Sheet__Layers.splice(index, 1);
        sheet.Sheet__Layers.forEach((l, k) => { l.Layer__Order = k + 1; });
        sheet.Sheet__Viewports.forEach((v)   => { if (v.Viewport__LayerId   === layerId) v.Viewport__LayerId   = Na__LeModel__DefaultLayerId(sheet, 'viewport'); });
        sheet.Sheet__Annotations.forEach((a) => { if (a.Annotation__LayerId === layerId) a.Annotation__LayerId = Na__LeModel__DefaultLayerId(sheet, 'annotation'); });
        sheet.Sheet__Dimensions.forEach((d)  => { if (d.Dimension__LayerId  === layerId) d.Dimension__LayerId  = Na__LeModel__DefaultLayerId(sheet, 'dimension'); });
        (sheet.Sheet__Leaders || []).forEach((l) => { if (l.Leader__LayerId === layerId) l.Leader__LayerId = Na__LeModel__DefaultLayerId(sheet, 'annotation'); });
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Layer's Name, Type, Visibility or Lock
    // ------------------------------------------------------------
    function Na__LeModel__UpdateLayer(sheet, layerId, patch) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        if (!layer || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) layer.Layer__Name = patch.name.trim();
        if (Na__LeModel__LAYER_TYPES.indexOf(patch.type) !== -1) layer.Layer__Type = patch.type;
        if (typeof patch.visible === 'boolean') layer.Layer__Visible = patch.visible;
        if (typeof patch.locked  === 'boolean') layer.Layer__Locked  = patch.locked;
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Layer in the Stack (index 0 = bottom)
    // ------------------------------------------------------------
    function Na__LeModel__ReorderLayer(sheet, layerId, newIndex) {
        if (!sheet) return false;
        const list = Na__LeModel__GetLayers(sheet);
        const from = list.findIndex((l) => l.Layer__Id === layerId);
        if (from === -1) return false;
        const [ moved ] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(newIndex, list.length)), 0, moved);
        list.forEach((l, k) => { l.Layer__Order = k + 1; });
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is an Item's Layer Visible / Editable?
    // ------------------------------------------------------------
    function Na__LeModel__IsLayerVisible(sheet, layerId) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        return !layer || layer.Layer__Visible !== false;
    }
    function Na__LeModel__IsLayerLocked(sheet, layerId) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        return !!(layer && layer.Layer__Locked === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Viewports
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Viewports
    // ------------------------------------------------------------
    function Na__LeModel__GetViewports(sheet) {
        return sheet ? sheet.Sheet__Viewports : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetViewportById(sheet, viewportId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Viewports, 'Viewport__Id', viewportId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Viewport
    // ------------------------------------------------------------
    // options: { kind, sceneId, drawingId, name, rect, scaleDenominator, modelSourceId }
    // ------------------------------------------------------------
    function Na__LeModel__CreateViewport(sheet, options) {
        if (!sheet) return null;
        const opts = options || {};
        const viewport = Na__LeRec__NormaliseViewport({
            Viewport__Id               : Na__LeRec__NextId(sheet.Sheet__Viewports, 'Viewport_', 'Viewport__Id'),
            Viewport__Kind             : opts.kind,
            Viewport__SceneId          : opts.sceneId || null,
            Viewport__DrawingId        : opts.drawingId || null,
            Viewport__ModelSourceId    : opts.modelSourceId || null,
            Viewport__Name             : opts.name || '',
            Viewport__FrameMm          : opts.rect || null,
            Viewport__ScaleDenominator : opts.scaleDenominator
        }, Na__LeModel__DefaultLayerId(sheet, 'viewport'));
        sheet.Sheet__Viewports.push(viewport);
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewport.Viewport__Id);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Whole Viewport Record (a paste or a duplicate)
    // ------------------------------------------------------------
    // Where CreateViewport builds a viewport from a handful of options, this
    // takes a complete record - scene, scale, crop, window, composites, model
    // layers, edge styles - deep-copies it and gives it a fresh id, so a
    // viewport set up once can be put down again with every setting intact.
    // A layer id the sheet does not have falls back to the default viewport
    // layer. Appended last, so it draws in front on its layer. One
    // announcement, so one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertViewport(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const viewport = JSON.parse(JSON.stringify(record));
        viewport.Viewport__Id = Na__LeRec__NextId(sheet.Sheet__Viewports, 'Viewport_', 'Viewport__Id');
        if (!Na__LeModel__GetLayerById(sheet, viewport.Viewport__LayerId)) viewport.Viewport__LayerId = null;
        Na__LeRec__NormaliseViewport(viewport, Na__LeModel__DefaultLayerId(sheet, 'viewport'));
        sheet.Sheet__Viewports.push(viewport);
        if (silent) { Na__LeModel__Dirty = true; return viewport; }
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewport.Viewport__Id);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Viewport and the Sheet Dimensions Measuring Through It
    // ------------------------------------------------------------
    function Na__LeModel__DeleteViewport(sheet, viewportId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Viewports.findIndex((v) => v.Viewport__Id === viewportId);
        if (index === -1) return false;
        sheet.Sheet__Viewports.splice(index, 1);
        sheet.Sheet__Dimensions.forEach((d) => { if (d.Dimension__ViewportId === viewportId) d.Dimension__ViewportId = null; });
        Na__LeModel__Unselect(viewportId);
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Viewport (any subset of its fields)
    // ------------------------------------------------------------
    // patch: { rect, scaleDenominator, pan, imageMm, imageOffset, styles, modelLayers,
    //          projectedEdges, compositeWeights, markupMode, name, layerId,
    //          sceneId, drawingId, kind, showScaleLabel, showFrame, locked, snapshotAsset, modelSourceId,
    //          closedDoors }
    // silent: true skips the change event (live drags announce on release).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateViewport(sheet, viewportId, patch, silent) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        if (!viewport || !patch) return false;

        if (patch.rect)      viewport.Viewport__FrameMm = Object.assign({}, viewport.Viewport__FrameMm, patch.rect);
        if (patch.pan)       viewport.Viewport__PanMm   = Object.assign({}, viewport.Viewport__PanMm,   patch.pan);
        if (patch.imageMm)   viewport.Viewport__ImageMm = Object.assign({}, viewport.Viewport__ImageMm, patch.imageMm);
        if (patch.imageOffset) viewport.Viewport__ImageOffsetMm = Object.assign({}, viewport.Viewport__ImageOffsetMm, patch.imageOffset);
        if (patch.styles) {
            Na__LeModel__STYLE_KEYS.forEach((key) => { if (typeof patch.styles[key] === 'boolean') viewport.Viewport__Styles[key] = patch.styles[key]; });
        }
        if (patch.modelLayers) {
            // MERGED, NOT REPLACED, so the panel can send one category at a
            // time. The normaliser below drops anything set back to true, so
            // switching a category on again removes the key rather than
            // recording a redundant "yes".
            const merged = Object.assign({}, viewport.Viewport__ModelLayers || {});
            Object.keys(patch.modelLayers).forEach((key) => { if (typeof patch.modelLayers[key] === 'boolean') merged[key] = patch.modelLayers[key]; });
            viewport.Viewport__ModelLayers = merged;
        }
        if (patch.projectedEdges) {
            // MERGED, ONE CATEGORY AT A TIME, and a null value CLEARS that
            // category rather than storing an empty entry - which is how the
            // panel's Reset button leaves no trace that anything was touched.
            const held   = viewport[Na__LeEdge__FIELD] || {};
            const merged = Object.assign({}, held[Na__LeEdge__CAT_FIELD] || {});
            Object.keys(patch.projectedEdges).forEach((key) => {
                const value = patch.projectedEdges[key];
                if (value === null || value === undefined) { delete merged[key]; return; }
                if (typeof value === 'object') merged[key] = value;
            });
            const next = {};
            next[Na__LeEdge__CAT_FIELD] = merged;
            next['Edges__UpdatedIso']   = new Date().toISOString();             // <-- Stamped where a change is known to have happened, not in the normaliser
            viewport[Na__LeEdge__FIELD] = next;
        }
        if (patch.compositeWeights) {
            const merged = Object.assign({}, viewport[Na__LeComposite__FIELD] || {});
            Object.keys(patch.compositeWeights).forEach((key) => {
                const value = patch.compositeWeights[key];
                if (value === null || value === undefined) { delete merged[key]; return; }
                const clamped = Na__LeComposite__Clamp(key, parseFloat(value));
                if (Number.isFinite(clamped)) merged[key] = clamped;
            });
            viewport[Na__LeComposite__FIELD] = merged;
        }
        if (patch.scaleDenominator !== undefined) viewport.Viewport__ScaleDenominator = Na__LeScale__Coerce(patch.scaleDenominator);
        if (patch.markupMode === 'scene' || patch.markupMode === 'sheet') viewport.Viewport__MarkupMode = patch.markupMode;
        if (typeof patch.name === 'string') viewport.Viewport__Name = patch.name;
        if (typeof patch.layerId === 'string') viewport.Viewport__LayerId = patch.layerId;
        if (patch.sceneId !== undefined)   viewport.Viewport__SceneId   = patch.sceneId;
        if (patch.drawingId !== undefined) viewport.Viewport__DrawingId = patch.drawingId;
        if (patch.kind === Na__LeModel__KIND_2D || patch.kind === Na__LeModel__KIND_3D) viewport.Viewport__Kind = patch.kind;
        if (typeof patch.showScaleLabel === 'boolean') viewport.Viewport__ShowScaleLabel = patch.showScaleLabel;
        if (typeof patch.showFrame === 'boolean') viewport.Viewport__ShowFrame = patch.showFrame;   // <-- The normaliser keeps only false
        if (Array.isArray(patch.closedDoors)) viewport.Viewport__ClosedDoors = patch.closedDoors.slice();   // <-- The normaliser sorts it and drops an empty list
        if (typeof patch.locked === 'boolean') viewport.Viewport__Locked = patch.locked;
        if (patch.snapshotAsset !== undefined) viewport.Viewport__SnapshotAsset = patch.snapshotAsset;
        if (patch.modelSourceId !== undefined) viewport.Viewport__ModelSourceId = patch.modelSourceId || null;   // <-- The design phase drawn; empty is the Project Default

        Na__LeRec__NormaliseViewport(viewport, viewport.Viewport__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('viewport', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Shows: the Scene and, for 2D, the Drawing Record
    // ------------------------------------------------------------
    // Returns { kind, scene, plan, elevation, label } with nulls where the
    // link is dangling, so a viewport whose scene was deleted still draws
    // its frame and says so.
    // ------------------------------------------------------------
    function Na__LeModel__ResolveViewportSource(viewport) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = (config && Array.isArray(config[Na__LeModel__SCENES_KEY])) ? config[Na__LeModel__SCENES_KEY] : [];
        const scene  = viewport.Viewport__SceneId ? (scenes.find((s) => s && s.PresentationMode__Scene__Id === viewport.Viewport__SceneId) || null) : null;

        let plan = null, elevation = null;
        if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) {
            plan      = viewport.Viewport__DrawingId ? Na__FpData__GetPlanById(null, viewport.Viewport__DrawingId) : null;
            elevation = (!plan && viewport.Viewport__DrawingId) ? Na__ElevData__GetElevationById(null, viewport.Viewport__DrawingId) : null;
            if (!plan && !elevation && scene) {
                if (scene.PresentationMode__Scene__FloorPlanId)  plan      = Na__FpData__GetPlanById(null, scene.PresentationMode__Scene__FloorPlanId);
                if (scene.PresentationMode__Scene__ElevationId)  elevation = Na__ElevData__GetElevationById(null, scene.PresentationMode__Scene__ElevationId);
            }
        }

        const label = viewport.Viewport__Name
            || (plan && plan.FloorPlan__Name)
            || (elevation && elevation.Elevation__Name)
            || (scene && scene.PresentationMode__Scene__Name)
            || 'Viewport';

        return { kind : viewport.Viewport__Kind, scene : scene, plan : plan, elevation : elevation, label : label };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sheet Text and Dimensions
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Annotations and Dimensions
    // ------------------------------------------------------------
    function Na__LeModel__GetAnnotations(sheet) { return sheet ? sheet.Sheet__Annotations : []; }
    function Na__LeModel__GetDimensions(sheet)  { return sheet ? sheet.Sheet__Dimensions  : []; }
    // ------------------------------------------------------------


    // FUNCTION | Add a Text Item at a Paper Point
    // ------------------------------------------------------------
    function Na__LeModel__CreateAnnotation(sheet, posXMm, posYMm, options) {
        if (!sheet) return null;
        const opts = options || {};
        const item = Na__LeRec__NormaliseAnnotation({
            Annotation__Id         : Na__LeRec__NextId(sheet.Sheet__Annotations, 'Text_', 'Annotation__Id'),
            Annotation__Text       : opts.text,
            Annotation__PosXMm     : posXMm,
            Annotation__PosYMm     : posYMm,
            Annotation__SizeMm     : opts.sizeMm,
            Annotation__FontWeight : opts.fontWeight,
            Annotation__Colour     : opts.colour,
            Annotation__Align      : opts.align,
            Annotation__LeaderXMm  : Number.isFinite(opts.leaderXMm) ? opts.leaderXMm : null,
            Annotation__LeaderYMm  : Number.isFinite(opts.leaderYMm) ? opts.leaderYMm : null,
            Annotation__LayerId    : opts.layerId
        }, Na__LeModel__DefaultLayerId(sheet, 'annotation'));
        sheet.Sheet__Annotations.push(item);
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Complete Text Record Onto a Sheet (fresh id)
    // ------------------------------------------------------------
    // A paste of a text item, the way InsertShape pastes a vector. silent
    // skips the announcement so several items can land as one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertAnnotation(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const item = JSON.parse(JSON.stringify(record));
        item.Annotation__Id = Na__LeRec__NextId(sheet.Sheet__Annotations, 'Text_', 'Annotation__Id');
        let layerId = item.Annotation__LayerId;
        if (!Na__LeModel__GetLayerById(sheet, layerId)) layerId = Na__LeModel__DefaultLayerId(sheet, 'annotation');
        Na__LeRec__NormaliseAnnotation(item, layerId);
        sheet.Sheet__Annotations.push(item);
        if (silent) { Na__LeModel__Dirty = true; return item; }
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, item.Annotation__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Text Item by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetAnnotationById(sheet, itemId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Annotations, 'Annotation__Id', itemId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change or Remove a Text Item
    // ------------------------------------------------------------
    function Na__LeModel__UpdateAnnotation(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Annotations, 'Annotation__Id', itemId) : null;
        if (!item || !patch) return false;
        if (typeof patch.text === 'string') item.Annotation__Text = patch.text;
        if (Number.isFinite(patch.posXMm)) item.Annotation__PosXMm = patch.posXMm;
        if (Number.isFinite(patch.posYMm)) item.Annotation__PosYMm = patch.posYMm;
        if (Number.isFinite(patch.sizeMm)) item.Annotation__SizeMm = patch.sizeMm;
        if (Number.isFinite(patch.fontWeight)) item.Annotation__FontWeight = patch.fontWeight;
        if (typeof patch.colour === 'string') item.Annotation__Colour = patch.colour;
        if (typeof patch.align === 'string') item.Annotation__Align = patch.align;
        if (patch.leaderXMm !== undefined) item.Annotation__LeaderXMm = Number.isFinite(patch.leaderXMm) ? patch.leaderXMm : null;
        if (patch.leaderYMm !== undefined) item.Annotation__LeaderYMm = Number.isFinite(patch.leaderYMm) ? patch.leaderYMm : null;
        if (typeof patch.layerId === 'string') item.Annotation__LayerId = patch.layerId;
        Na__LeRec__NormaliseAnnotation(item, item.Annotation__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('annotation', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteAnnotation(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Annotations.findIndex((a) => a.Annotation__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Annotations.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__PruneGroups(sheet);
        Na__LeModel__Touch('annotations', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Dimension Between Two Paper Points
    // ------------------------------------------------------------
    function Na__LeModel__CreateDimension(sheet, start, end, options) {
        if (!sheet || !start || !end) return null;
        const opts = options || {};
        const record = {
            Dimension__Id           : Na__LeRec__NextId(sheet.Sheet__Dimensions, 'Dim_', 'Dimension__Id'),
            Dimension__ViewportId   : opts.viewportId || null,
            Dimension__StartXMm     : start.x, Dimension__StartYMm : start.y,
            Dimension__EndXMm       : end.x,   Dimension__EndYMm   : end.y,
            Dimension__OffsetMm     : opts.offsetMm,
            Dimension__TextSizeMm   : opts.textSizeMm,
            Dimension__Colour       : opts.colour,
            Dimension__Terminator   : opts.terminator,
            Dimension__TickLengthMm : opts.tickLengthMm,                       // <-- How large the ticks, arrows or dots are; the normaliser drops anything else
            Dimension__Precision    : opts.precision,
            Dimension__UnitsSuffix  : opts.unitsSuffix,
            Dimension__OverrideText : (typeof opts.overrideText === 'string') ? opts.overrideText : null,
            Dimension__Orientation  : opts.orientation,                        // <-- 'aligned', 'horizontal' or 'vertical'; the normaliser makes anything else aligned
            Dimension__StartExtensionMm : opts.startExtensionMm,               // <-- A length cuts the extension line short; the normaliser drops anything else
            Dimension__EndExtensionMm   : opts.endExtensionMm,
            Dimension__ExtensionsLinked : opts.extensionsLinked,               // <-- Kept only as false
            Dimension__LayerId      : opts.layerId
        };
        if (typeof opts.atScale === 'boolean') record.Dimension__AtScale = opts.atScale;   // <-- Measure at scale; left out, no key, and the record reads as one from before it
        const item = Na__LeRec__NormaliseDimension(record, Na__LeModel__DefaultLayerId(sheet, 'dimension'));
        sheet.Sheet__Dimensions.push(item);
        if (opts.silent) Na__LeModel__Dirty = true; else Na__LeModel__Touch('dimensions', sheet.Sheet__Id, item.Dimension__Id);   // <-- The dimension tool announces once, on the third click
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change or Remove a Dimension
    // ------------------------------------------------------------
    function Na__LeModel__UpdateDimension(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Dimensions, 'Dimension__Id', itemId) : null;
        if (!item || !patch) return false;
        [ 'StartXMm', 'StartYMm', 'EndXMm', 'EndYMm', 'OffsetMm', 'TextSizeMm', 'TickLengthMm', 'Precision', 'TextDXMm', 'TextDYMm' ].forEach((key) => {
            const name = key.charAt(0).toLowerCase() + key.slice(1);
            if (Number.isFinite(patch[name])) item['Dimension__' + key] = patch[name];
        });
        if (typeof patch.colour === 'string') item.Dimension__Colour = patch.colour;
        if (typeof patch.terminator === 'string') item.Dimension__Terminator = patch.terminator;
        if (typeof patch.unitsSuffix === 'string') item.Dimension__UnitsSuffix = patch.unitsSuffix;
        if (typeof patch.orientation === 'string') item.Dimension__Orientation = patch.orientation;
        if (typeof patch.atScale === 'boolean') item.Dimension__AtScale = patch.atScale;               // <-- Measure at scale, from the Dimensions panel
        if (patch.startExtensionMm !== undefined) item.Dimension__StartExtensionMm = patch.startExtensionMm;   // <-- null, or anything but a length, is the full line
        if (patch.endExtensionMm !== undefined)   item.Dimension__EndExtensionMm   = patch.endExtensionMm;
        if (typeof patch.extensionsLinked === 'boolean') item.Dimension__ExtensionsLinked = patch.extensionsLinked;   // <-- The normaliser keeps only false
        if (patch.overrideText !== undefined) item.Dimension__OverrideText = (typeof patch.overrideText === 'string' && patch.overrideText.trim()) ? patch.overrideText : null;
        if (patch.viewportId !== undefined) item.Dimension__ViewportId = patch.viewportId;
        if (typeof patch.layerId === 'string') item.Dimension__LayerId = patch.layerId;
        Na__LeRec__NormaliseDimension(item, item.Dimension__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('dimension', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteDimension(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Dimensions.findIndex((d) => d.Dimension__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Dimensions.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__Touch('dimensions', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Vector Shape by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetShapeById(sheet, itemId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Shapes, 'Shape__Id', itemId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Complete Vector Record Onto a Sheet (fresh id, one announcement)
    // ------------------------------------------------------------
    // Where CreateShape builds a shape from points and a handful of options,
    // this takes a complete record - vertices, closed, edges, fill, gradient,
    // opacities - deep-copies it and gives it a fresh id, so a vector copied
    // once can be put down again with every setting intact. A layer id the
    // sheet does not have, or that is not a vector layer, falls back to the
    // default vector layer; a sheet without one gets one. Appended last, so
    // it draws in front on its layer. One announcement, so one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertShape(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const item = JSON.parse(JSON.stringify(record));
        item.Shape__Id = Na__LeRec__NextId(sheet.Sheet__Shapes, 'Shape_', 'Shape__Id');
        let layerId = item.Shape__LayerId;
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        if (!layer || layer.Layer__Type !== 'vector') {
            const found = sheet.Sheet__Layers.find((l) => l.Layer__Type === 'vector') || Na__LeModel__CreateLayer(sheet, { name : 'Vectors', type : 'vector' });
            layerId = found ? found.Layer__Id : Na__LeModel__DefaultLayerId(sheet, 'vector');
        }
        Na__LeRec__NormaliseShape(item, layerId);
        sheet.Sheet__Shapes.push(item);
        if (silent) { Na__LeModel__Dirty = true; return item; }
        Na__LeModel__Touch('shapes', sheet.Sheet__Id, item.Shape__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create, Update and Delete a Vector Shape
    // ------------------------------------------------------------
    // points: [[x, y], ...] paper mm. options: { strokeColour, strokePt,
    // fillColour, fillOpacity, strokeOpacity, closed, stroked, layerId, silent }. A sheet without a
    // vector layer gets one the first time a shape lands. Edges and fill
    // are either-or at the least: the normaliser puts the edges back on a
    // shape that would otherwise have nothing to show.
    // ------------------------------------------------------------
    function Na__LeModel__CreateShape(sheet, points, options) {
        if (!sheet || !Array.isArray(points)) return null;
        const opts = options || {};
        let layerId = opts.layerId || null;
        if (!layerId) {
            const layer = sheet.Sheet__Layers.find((l) => l.Layer__Type === 'vector') || Na__LeModel__CreateLayer(sheet, { name : 'Vectors', type : 'vector' });
            layerId = layer ? layer.Layer__Id : Na__LeModel__DefaultLayerId(sheet, 'vector');
        }
        const item = Na__LeRec__NormaliseShape({
            Shape__Id           : Na__LeRec__NextId(sheet.Sheet__Shapes, 'Shape_', 'Shape__Id'),
            Shape__LayerId      : layerId,
            Shape__Points       : points.map((p) => [ p[0], p[1] ]),
            Shape__Closed       : opts.closed === true,
            Shape__StrokeColour : opts.strokeColour,
            Shape__StrokePt     : opts.strokePt,
            Shape__FillColour   : (typeof opts.fillColour === 'string') ? opts.fillColour : null,
            Shape__Stroked      : opts.stroked !== false,
            Shape__FillOpacity  : opts.fillOpacity,                            // <-- Left out, or not 0 to 1: the normaliser makes it solid
            Shape__StrokeOpacity: opts.strokeOpacity,
            Shape__Gradient     : (opts.gradient && typeof opts.gradient === 'object') ? opts.gradient : null   // <-- The normaliser copies it, so the caller's object is never shared
        }, layerId);
        sheet.Sheet__Shapes.push(item);
        if (opts.silent) Na__LeModel__Dirty = true; else Na__LeModel__Touch('shapes', sheet.Sheet__Id, item.Shape__Id);   // <-- The draw tool announces once, on finishing
        return item;
    }
    function Na__LeModel__UpdateShape(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(sheet.Sheet__Shapes, 'Shape__Id', itemId) : null;
        if (!item || !patch) return false;
        if (Array.isArray(patch.points)) item.Shape__Points = patch.points.map((p) => [ p[0], p[1] ]);
        if (typeof patch.closed === 'boolean') item.Shape__Closed = patch.closed;
        if (typeof patch.strokeColour === 'string') item.Shape__StrokeColour = patch.strokeColour;
        if (Number.isFinite(patch.strokePt)) item.Shape__StrokePt = patch.strokePt;
        if (patch.fillColour !== undefined) item.Shape__FillColour = (typeof patch.fillColour === 'string') ? patch.fillColour : null;
        if (patch.gradient !== undefined) item.Shape__Gradient = (patch.gradient && typeof patch.gradient === 'object') ? patch.gradient : null;   // <-- null clears it; the normaliser below copies it fresh
        if (typeof patch.stroked === 'boolean') item.Shape__Stroked = patch.stroked;
        if (Number.isFinite(patch.fillOpacity))   item.Shape__FillOpacity   = patch.fillOpacity;
        if (Number.isFinite(patch.strokeOpacity)) item.Shape__StrokeOpacity = patch.strokeOpacity;
        if (typeof patch.layerId === 'string') item.Shape__LayerId = patch.layerId;
        Na__LeRec__NormaliseShape(item, item.Shape__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('shape', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteShape(sheet, itemId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Shapes.findIndex((sh) => sh.Shape__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Shapes.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__PruneGroups(sheet);
        Na__LeModel__Touch('shapes', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Leaders
    // ------------------------------------------------------------
    function Na__LeModel__GetLeaders(sheet) { return (sheet && Array.isArray(sheet.Sheet__Leaders)) ? sheet.Sheet__Leaders : []; }
    // ------------------------------------------------------------


    // FUNCTION | Create, Update and Delete a Leader
    // ------------------------------------------------------------
    // tip and anchor: { x, y } paper mm - the point the leader points at, and
    // where it lands on its note or bubble. options: { type, text, textSizeMm,
    // fontWeight, textColour, lineColour, linePt, lineStyle, lineOpacity,
    // endpointFilled, endpointPt, endpointSizeMm, bubbleSizeMm, bubbleEdgePt,
    // fillColour (null for no fill), fillOpacity, layerId, silent }. Anything
    // left out takes the Leader setup's default in the normaliser, and a new
    // leader lands on the sheet's text layer.
    // ------------------------------------------------------------
    function Na__LeModel__CreateLeader(sheet, tip, anchor, options) {
        if (!sheet || !tip || !anchor) return null;
        if (!Array.isArray(sheet.Sheet__Leaders)) sheet.Sheet__Leaders = [];
        const opts = options || {};
        const item = Na__LeRec__NormaliseLeader({
            Leader__Id             : Na__LeRec__NextId(sheet.Sheet__Leaders, 'Leader_', 'Leader__Id'),
            Leader__LayerId        : opts.layerId,
            Leader__Type           : opts.type,
            Leader__TipXMm         : tip.x,    Leader__TipYMm    : tip.y,
            Leader__AnchorXMm      : anchor.x, Leader__AnchorYMm : anchor.y,
            Leader__Text           : opts.text,
            Leader__TextSizeMm     : opts.textSizeMm,
            Leader__FontWeight     : opts.fontWeight,
            Leader__TextColour     : opts.textColour,
            Leader__LineColour     : opts.lineColour,
            Leader__LinePt         : opts.linePt,
            Leader__LineStyle      : opts.lineStyle,
            Leader__LineOpacity    : opts.lineOpacity,
            Leader__EndpointFilled : opts.endpointFilled,
            Leader__EndpointPt     : opts.endpointPt,
            Leader__EndpointSizeMm : opts.endpointSizeMm,
            Leader__BubbleSizeMm   : opts.bubbleSizeMm,
            Leader__BubbleEdgePt   : opts.bubbleEdgePt,
            Leader__FillColour     : opts.fillColour === undefined ? undefined : ((typeof opts.fillColour === 'string') ? opts.fillColour : null),   // <-- Left out: the default fill; null: no fill
            Leader__FillOpacity    : opts.fillOpacity
        }, Na__LeModel__DefaultLayerId(sheet, 'annotation'));
        if (typeof opts.specNoteId === 'string' && opts.specNoteId.trim()) item.Leader__SpecNoteId = opts.specNoteId.trim();   // <-- A bubble placed already linked to a specification note
        sheet.Sheet__Leaders.push(item);
        if (opts.silent) Na__LeModel__Dirty = true; else Na__LeModel__Touch('leaders', sheet.Sheet__Id, item.Leader__Id);   // <-- The leader tool announces once, when the head lands
        return item;
    }
    function Na__LeModel__UpdateLeader(sheet, itemId, patch, silent) {
        const item = sheet ? Na__LeRec__Find(Na__LeModel__GetLeaders(sheet), 'Leader__Id', itemId) : null;
        if (!item || !patch) return false;
        [ 'TipXMm', 'TipYMm', 'AnchorXMm', 'AnchorYMm', 'TextSizeMm', 'FontWeight', 'LinePt', 'LineOpacity',
          'EndpointPt', 'EndpointSizeMm', 'BubbleSizeMm', 'BubbleEdgePt', 'FillOpacity' ].forEach((key) => {
            const name = key.charAt(0).toLowerCase() + key.slice(1);
            if (Number.isFinite(patch[name])) item['Leader__' + key] = patch[name];
        });
        [ 'Type', 'Text', 'TextColour', 'LineColour', 'LineStyle' ].forEach((key) => {
            const name = key.charAt(0).toLowerCase() + key.slice(1);
            if (typeof patch[name] === 'string') item['Leader__' + key] = patch[name];
        });
        if (typeof patch.endpointFilled === 'boolean') item.Leader__EndpointFilled = patch.endpointFilled;
        if (patch.fillColour !== undefined) item.Leader__FillColour = (typeof patch.fillColour === 'string') ? patch.fillColour : null;   // <-- null clears the fill
        if (typeof patch.layerId === 'string') item.Leader__LayerId = patch.layerId;
        if (patch.specNoteId !== undefined) {                                   // <-- A note id links a bubble to the specification; null or empty unlinks it
            if (typeof patch.specNoteId === 'string' && patch.specNoteId.trim()) item.Leader__SpecNoteId = patch.specNoteId.trim();
            else delete item.Leader__SpecNoteId;
        }
        Na__LeRec__NormaliseLeader(item, item.Leader__LayerId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('leader', sheet.Sheet__Id, itemId);
        return true;
    }
    function Na__LeModel__DeleteLeader(sheet, itemId) {
        if (!sheet || !Array.isArray(sheet.Sheet__Leaders)) return false;
        const index = sheet.Sheet__Leaders.findIndex((l) => l.Leader__Id === itemId);
        if (index === -1) return false;
        sheet.Sheet__Leaders.splice(index, 1);
        Na__LeModel__Unselect(itemId);
        Na__LeModel__Touch('leaders', sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Groups
    // ------------------------------------------------------------
    function Na__LeModel__GetGroups(sheet) {
        return (sheet && Array.isArray(sheet.Sheet__Groups)) ? sheet.Sheet__Groups : [];
    }
    function Na__LeModel__GetGroupById(sheet, groupId) {
        return sheet ? Na__LeRec__Find(Na__LeModel__GetGroups(sheet), 'Group__Id', groupId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Group Record Onto a Sheet (fresh id)
    // ------------------------------------------------------------
    // members: [{ kind, id }]. silent skips the announcement so a paste of
    // several groups can land as one undo step with their members.
    // ------------------------------------------------------------
    function Na__LeModel__InsertGroup(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        if (!Array.isArray(sheet.Sheet__Groups)) sheet.Sheet__Groups = [];
        const item = JSON.parse(JSON.stringify(record));
        item.Group__Id = Na__LeRec__NextId(sheet.Sheet__Groups, 'Group_', 'Group__Id');
        Na__LeRec__NormaliseGroup(item);
        sheet.Sheet__Groups.push(item);
        if (silent) { Na__LeModel__Dirty = true; return item; }
        Na__LeModel__Touch('groups', sheet.Sheet__Id, item.Group__Id);
        return item;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Group Record (the members stay on the sheet)
    // ------------------------------------------------------------
    function Na__LeModel__DeleteGroup(sheet, groupId, silent) {
        if (!sheet || !Array.isArray(sheet.Sheet__Groups)) return false;
        const index = sheet.Sheet__Groups.findIndex((g) => g.Group__Id === groupId);
        if (index === -1) return false;
        sheet.Sheet__Groups.splice(index, 1);
        Na__LeModel__Unselect(groupId);
        if (silent) { Na__LeModel__Dirty = true; return true; }
        Na__LeModel__Touch('groups', sheet.Sheet__Id, groupId);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop Members That No Longer Exist, Then Empty Groups
    // ------------------------------------------------------------
    // After a delete, a group may still name a shape or a nested group that
    // went with it. Those names drop out; a group left with fewer than two
    // members is itself removed (its last member, if any, is lifted into any
    // parent that held the group).
    // ------------------------------------------------------------
    function Na__LeModel__PruneGroups(sheet) {
        if (!sheet || !Array.isArray(sheet.Sheet__Groups) || !sheet.Sheet__Groups.length) return false;
        const exists = (kind, id) => {
            if (kind === 'shape')      return !!(sheet.Sheet__Shapes || []).some((s) => s.Shape__Id === id);
            if (kind === 'annotation') return !!(sheet.Sheet__Annotations || []).some((a) => a.Annotation__Id === id);
            if (kind === 'group')      return sheet.Sheet__Groups.some((g) => g.Group__Id === id);
            return false;
        };
        let changed = false;
        sheet.Sheet__Groups.forEach((group) => {
            const next = (group.Group__Members || []).filter((m) => exists(m.kind, m.id));
            if (next.length !== (group.Group__Members || []).length) { group.Group__Members = next; changed = true; }
        });
        for (let guard = 0; guard < 32; guard++) {
            const doomed = sheet.Sheet__Groups.filter((g) => (g.Group__Members || []).length < 2);
            if (!doomed.length) break;
            doomed.forEach((group) => {
                const leftover = (group.Group__Members || []).slice();
                sheet.Sheet__Groups.forEach((parent) => {
                    if (parent.Group__Id === group.Group__Id) return;
                    const idx = (parent.Group__Members || []).findIndex((m) => m.kind === 'group' && m.id === group.Group__Id);
                    if (idx >= 0) parent.Group__Members.splice(idx, 1, ...leftover);
                });
                const index = sheet.Sheet__Groups.indexOf(group);
                if (index >= 0) sheet.Sheet__Groups.splice(index, 1);
                Na__LeModel__Unselect(group.Group__Id);
                changed = true;
            });
        }
        return changed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Several Items at Once (one undo step)
    // ------------------------------------------------------------
    // items: [{ kind, id }] of any mix of kinds. Every listed record goes in one
    // pass; a sheet dimension measuring through a removed viewport lets go of
    // it, as DeleteViewport does; the removed items leave the selection. Then
    // one announcement per collection that lost something - the history takes
    // its step at the first, which already holds every removal, so one Ctrl+Z
    // brings the lot back. Returns how many records went.
    // ------------------------------------------------------------
    function Na__LeModel__DeleteItems(sheet, items) {
        if (!sheet || !Array.isArray(items)) return 0;
        const doomed = new Set(items.filter((item) => item && item.kind && item.id).map((item) => item.kind + ':' + item.id));
        if (!doomed.size) return 0;
        const gone    = new Set();                                               // <-- Viewport ids removed, for the dimensions measuring through them
        const reasons = [];
        let count = 0;
        [ [ 'Sheet__Viewports',   'Viewport__Id',   'viewport',   'viewports'   ],
          [ 'Sheet__Annotations', 'Annotation__Id', 'annotation', 'annotations' ],
          [ 'Sheet__Dimensions',  'Dimension__Id',  'dimension',  'dimensions'  ],
          [ 'Sheet__Shapes',      'Shape__Id',      'shape',      'shapes'      ],
          [ 'Sheet__Leaders',     'Leader__Id',     'leader',     'leaders'     ],
          [ 'Sheet__Groups',      'Group__Id',      'group',      'groups'      ] ].forEach((row) => {
            const list = sheet[row[0]];
            if (!Array.isArray(list)) return;                                    // <-- A sheet that has never held that kind
            let removed = 0;
            for (let i = list.length - 1; i >= 0; i--) {
                if (!list[i] || !doomed.has(row[2] + ':' + list[i][row[1]])) continue;
                if (row[2] === 'viewport') gone.add(list[i].Viewport__Id);
                list.splice(i, 1);
                removed++;
            }
            if (removed) { count += removed; reasons.push(row[3]); }
        });
        if (Na__LeModel__PruneGroups(sheet) && reasons.indexOf('groups') === -1) {
            if (!count) count = 1;
            reasons.push('groups');
        }
        if (!count) return 0;
        if (gone.size) sheet.Sheet__Dimensions.forEach((d) => { if (gone.has(d.Dimension__ViewportId)) d.Dimension__ViewportId = null; });
        Na__LeModel__SelectionItems = Na__LeModel__SelectionItems.filter((item) => !doomed.has(item.kind + ':' + item.id));
        reasons.forEach((reason) => Na__LeModel__Touch(reason, sheet.Sheet__Id, null));
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Selection, Persistence and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Select One Item on the Sheet (null clears)
    // ------------------------------------------------------------
    function Na__LeModel__SetSelection(selection) {
        const items = Na__LeModel__SetSelectionItems((selection && selection.kind && selection.id) ? [ selection ] : []);
        return items.length === 1 ? items[0] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The One Selected Item (null when nothing is selected, or several are)
    // ------------------------------------------------------------
    // A properties panel edits one record, so it asks this. With several items
    // selected it sees none and shows its settings for new objects, rather than
    // quietly editing whichever item happened to be picked last.
    // ------------------------------------------------------------
    function Na__LeModel__GetSelection() {
        return Na__LeModel__SelectionItems.length === 1 ? Na__LeModel__SelectionItems[0] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Select Any Number of Items (an empty list clears)
    // ------------------------------------------------------------
    // items: [{ kind, id }]. Duplicates are dropped and the order is kept. One
    // 'selection' announcement, and none when the set is the same as before.
    // ------------------------------------------------------------
    function Na__LeModel__SetSelectionItems(items) {
        const seen = new Set();
        const next = [];
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (!item || !item.kind || !item.id || seen.has(item.kind + ':' + item.id)) return;
            seen.add(item.kind + ':' + item.id);
            next.push({ kind : item.kind, id : item.id });
        });
        const same = next.length === Na__LeModel__SelectionItems.length && Na__LeModel__SelectionItems.every((item) => seen.has(item.kind + ':' + item.id));
        Na__LeModel__SelectionItems = next;
        if (!same) Na__LeModel__Dispatch('selection', Na__LeModel__ActiveSheetId, next.length === 1 ? next[0].id : null);
        return next.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Selected Item, and Whether an Item Is One of Them
    // ------------------------------------------------------------
    function Na__LeModel__GetSelectionItems() { return Na__LeModel__SelectionItems.slice(); }
    function Na__LeModel__IsSelected(kind, id) { return Na__LeModel__SelectionItems.some((item) => item.kind === kind && item.id === id); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop a Deleted Item From the Selection (silent: its delete announces)
    // ------------------------------------------------------------
    function Na__LeModel__Unselect(itemId) {
        Na__LeModel__SelectionItems = Na__LeModel__SelectionItems.filter((item) => item.id !== itemId);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Selected Viewport Record (null when the selection is something else, or several items)
    // ------------------------------------------------------------
    function Na__LeModel__GetSelectedViewport() {
        const sheet     = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'viewport') return null;
        return Na__LeModel__GetViewportById(sheet, selection.id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Unsaved Changes?
    // ------------------------------------------------------------
    function Na__LeModel__IsDirty() { return Na__LeModel__Dirty; }
    function Na__LeModel__MarkDirty() { Na__LeModel__Dirty = true; }
    // ------------------------------------------------------------


    // FUNCTION | Put a Whole Sheet List Back (the browser draft after a load)
    // ------------------------------------------------------------
    // Replaces the live array's contents in place so the drawings block
    // still owns it, normalises every record, keeps the active sheet when
    // it survives, marks the model dirty and announces a load.
    // ------------------------------------------------------------
    function Na__LeModel__RestoreSheets(records) {
        if (!Array.isArray(records)) return false;
        const live = Na__LeModel__Array();
        live.length = 0;
        records.forEach((record) => { if (record && typeof record === 'object') live.push(JSON.parse(JSON.stringify(record))); });
        Na__LeModel__GetSheets();                                                // <-- Normalises what arrived
        if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__ActiveSheetId = null;
        Na__LeModel__SelectionItems = [];
        Na__LeModel__Dirty = true;
        Na__LeModel__Dispatch('loaded', Na__LeModel__ActiveSheetId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Drawings Block (sheets ride with plans and elevations)
    // ------------------------------------------------------------
    // The toast it is given hears where the sheets went: R2 and the repository
    // copy on localhost, R2 alone on the web build. A local copy that could not
    // be written is an error, so the auto save, which passes errors on and
    // nothing else, still shows it.
    // ------------------------------------------------------------
    async function Na__LeModel__Save(showToast) {
        const report = {};
        const saved  = await Na__DrawData__Save(showToast, report);
        if (saved) Na__LeModel__Dirty = false;
        if (saved && report.local && typeof showToast === 'function') {
            const local = report.local;
            if (local.ok)           showToast(Na__LeCfg__GetLabel('SavedLocalMessage', 'Sheets saved to R2 and locally.'), false);
            else if (local.skipped) showToast(Na__LeCfg__GetLabel('SavedMessage', 'Sheets saved to R2.'), false);
            else                    showToast(Na__LeCfg__FormatLabel('SavedLocalFailedMessage', 'Sheets saved to R2, but the local copy was not written: {error}.', { error : local.error }), true);
        }
        return saved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize: Follow the Drawings Block Across Project Loads
    // ------------------------------------------------------------
    function Na__LeModel__Initialize() {
        if (Na__LeModel__Initialized) return true;
        Na__LeModel__Initialized = true;
        const reload = (event) => {
            const saved = !!(event && event.detail && event.detail.reason === 'saved');
            Na__LeModel__Dirty = false;
            if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__ActiveSheetId = null;
            if (saved) { Na__LeModel__Dispatch('saved', Na__LeModel__ActiveSheetId); return; }   // <-- The same records, now on disk: selection and undo history stay
            Na__LeModel__SelectionItems = [];
            Na__LeModel__Dispatch('loaded', Na__LeModel__ActiveSheetId);
        };
        window.addEventListener(Na__DrawData__LOADED_EVENT,  reload);
        window.addEventListener(Na__DrawData__CHANGED_EVENT, reload);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model API
    // ------------------------------------------------------------
    export {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__Initialize,
        Na__LeModel__GetSheets,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId,
        Na__LeModel__CreateSheet,
        Na__LeModel__DuplicateSheet,
        Na__LeModel__DeleteSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__AnnounceRestore,
        Na__LeModel__ReorderSheet,
        Na__LeModel__GetFields,
        Na__LeModel__SetField,
        Na__LeModel__UpdateMarginNotes,
        Na__LeModel__GetLayers,
        Na__LeModel__GetLayerById,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__GetViewports,
        Na__LeModel__GetViewportById,
        Na__LeModel__CreateViewport,
        Na__LeModel__InsertViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource,
        Na__LeModel__GetAnnotations,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetDimensions,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__CreateDimension,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension,
        Na__LeModel__GetShapeById,
        Na__LeModel__CreateShape,
        Na__LeModel__InsertShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape,
        Na__LeModel__GetLeaders,
        Na__LeModel__CreateLeader,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader,
        Na__LeModel__GetGroups,
        Na__LeModel__GetGroupById,
        Na__LeModel__InsertGroup,
        Na__LeModel__DeleteGroup,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected,
        Na__LeModel__DeleteItems,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__IsDirty,
        Na__LeModel__MarkDirty,
        Na__LeModel__RestoreSheets,
        Na__LeModel__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
