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
//                 Lineweights {ViewportPt, DimensionPt},
//                 DrawingType (only ever 'siteplan'; no key is an architectural drawing)
//     Layer       Layer__Id, Name, Type, Visible, Locked, Order
//     Viewport    Viewport__Id, LayerId, Name, Kind ('2d' | '3d'), SceneId,
//                 DrawingId, FrameMm {X, Y, WidthMm, HeightMm},
//                 ScaleDenominator, PanMm {X, Y}, ImageMm {WidthMm, HeightMm},
//                 ImageOffsetMm {X, Y}, Styles {...}, MarkupMode, Locked,
//                 SnapshotAsset {Asset__Path, Asset__Fingerprint, Asset__PixelWidth},
//                 ModelSourceId (a model group's groupId; null draws the Project Default),
//                 ShowScaleLabel, ShowFrame (only ever false: the frame and caption hidden),
//                 ClosedDoors (the door keys a plan draws shut; absent while every door is open),
//                 SitePlan {} (only on a viewport drawing the site plan data: always 2D, no drawing id)
//     Annotation  Annotation__Id, LayerId, Text, PosXMm, PosYMm, SizeMm,
//                 FontWeight, Colour, Align, LeaderXMm, LeaderYMm,
//                 RotationDeg (degrees clockwise about PosXMm, PosYMm, wrapped
//                 into (-180, 180]; no key is level, and a turn back to level
//                 removes it)
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
//                 the shape is Na__LayoutEditor__GradientTool__'s), LineStyle
//                 (null for a solid edge; Na__LayoutEditor__LineStyleTool__), FillOpacity,
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
// - The active sheet and the selection are session state, held in the State
//   unit so the panels and the surface agree on them. The selection is a
//   set of { kind, id } - one item, or several from a selection box or Shift
//   and Ctrl clicks; GetSelection reads it as the one item when there is
//   exactly one, which is all a properties panel can edit.
//
// - THE MODEL IS SPLIT INTO UNITS in this folder (line budget). This file
//   keeps the selection, the dirty flag, the undo and redo restore
//   announcement (AnnounceRestore), the browser draft restore, Save and
//   Initialize, and re-exports the rest from its units:
//   - Na__LayoutEditor__SheetModel__State__: the constants (the drawing types
//     among them), the session state (active sheet, selection, dirty flag),
//     Dispatch, Touch, Array, Unselect and the Assign accessors every other
//     unit writes the state through.
//   - Na__LayoutEditor__SheetModel__Sheets__: sheets and their tab groups
//     (IsSitePlanSheet, TabGroup, NextOrder, RenumberSheets), title block
//     fields and the notes margin.
//   - Na__LayoutEditor__SheetModel__Layers__: layers.
//   - Na__LayoutEditor__SheetModel__DrawOrder__: item draw order (Arrange).
//   - Na__LayoutEditor__SheetModel__Viewports__: viewports and what they show
//     (IsSitePlanViewport).
//   - Na__LayoutEditor__SheetModel__TextAndDimensions__: text items and
//     dimensions.
//   - Na__LayoutEditor__SheetModel__Shapes__: vector shapes.
//   - Na__LayoutEditor__SheetModel__Leaders__: leaders and annotation bubbles.
//   - Na__LayoutEditor__SheetModel__Groups__: groups, the prune after a
//     delete, and DeleteItems (the multi-item delete).
//
// INTEGRATION:
// - Loads from Na__DrawView__ProjectData__ on its events; Save goes through
//   Na__DrawData__Save (D08).
// - Callers keep importing this file, which still exports every name it
//   always has; no other module imports a unit. The units never import this
//   file: they share the State unit and otherwise import downward only
//   (Layers and Groups sit below the item units), so the sheet model adds
//   no cycle to the module graph.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetModel__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (Sheet__DrawingType), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.25.0
// - Split into Na__LayoutEditor__SheetModel__State__.js,
//   Na__LayoutEditor__SheetModel__Sheets__.js,
//   Na__LayoutEditor__SheetModel__Layers__.js,
//   Na__LayoutEditor__SheetModel__DrawOrder__.js,
//   Na__LayoutEditor__SheetModel__Viewports__.js,
//   Na__LayoutEditor__SheetModel__TextAndDimensions__.js,
//   Na__LayoutEditor__SheetModel__Shapes__.js,
//   Na__LayoutEditor__SheetModel__Leaders__.js and
//   Na__LayoutEditor__SheetModel__Groups__.js to stay under the line budget.
//   No behaviour change: the code moved verbatim and every export is
//   unchanged.
// - The same split as ValeVision3D v2.47.0 (SheetModel 1.16.0): every
//   function ValeVision has sits in the same unit. The TrueVision only ones
//   went with their kind: the drawing type constants to State;
//   IsSitePlanSheet, TabGroup, NextOrder and RenumberSheets to Sheets;
//   IsSitePlanViewport to Viewports. AnnounceRestore stays here beside the
//   draft restore: it normalises the sheet it announces, a record helper the
//   State unit does not hold.
// - An imported let cannot be assigned, so a moved line that set the active
//   sheet, the selection or the dirty flag now calls the State unit's
//   AssignActiveSheetId, AssignSelectionItems or AssignDirty instead.
//
// 14-Sep-2026 - Version 1.24.0
// - Rotated text: CreateAnnotation and UpdateAnnotation take rotationDeg,
//   stored as Annotation__RotationDeg - degrees clockwise about the anchor,
//   wrapped into (-180, 180] and kept to a thousandth of a degree. Level text
//   carries no key, so every record from before draws and saves exactly as
//   it did.
//
// 14-Sep-2026 - Version 1.23.0
// - UpdateViewport takes imageZoom: a 3D viewport's picture zoom
//   (Viewport__ImageZoom), which the normaliser clamps.
//
// 14-Sep-2026 - Version 1.22.0
// - Arrange: CanArrange and Arrange move a vector, a text item, a dimension
//   or a leader one step (forward / backward) or to the end of its layer
//   (front / back) in its collection. Later in the array draws on top, so
//   two vectors on one layer can be stacked. A locked layer refuses it.
//
// 14-Sep-2026 - Version 1.21.0
// - Site plan viewports. CreateViewport takes sitePlan (the Viewport__SitePlan
//   record) and modelLayers (the categories a new viewport starts switched off).
//   UpdateViewport coerces a scale onto the viewport's own list, so a site plan
//   viewport keeps 1:500 or 1:1250. ResolveViewportSource answers a site plan
//   viewport with no scene or drawing and its name, or "Site Plan", as the label.
//   IsSitePlanViewport reads the marker.
//
// 14-Sep-2026 - Version 1.20.0
// - Site plan drawings. GetSheets returns the sheets in two tab groups -
//   architectural sheets, then site plan sheets (Sheet__DrawingType) - each
//   by Sheet__Order. It stays the one sort point, so the tab strip, the
//   editor's first sheet and the Dev menu agree. UpdateSheet takes drawingType
//   ('architectural' | 'siteplan'); IsSitePlanSheet reads it.
// - Create, Duplicate, Delete and Reorder number Sheet__Order 1..n down the
//   tab order. Every architectural number then sits below every site plan
//   number, so a change of type moves a sheet across the + tab without
//   renumbering anything: one undo step of that sheet alone.
// - Fix: Delete renumbered by position in the saved array, which put back the
//   order of any tab dragged since the project loaded. A drag also stays
//   inside its own group now.
//
// 14-Sep-2026 - Version 1.19.0
// - CreateShape and UpdateShape carry Shape__LineStyle (the dash key: an
//   object, or null to clear it to a solid edge). The normaliser copies it,
//   so no two shapes ever share one.
//
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

    // MODULE IMPORTS | Drawings Block: Save and the Load Events
    // ------------------------------------------------------------
    import {
        Na__DrawData__Save,
        Na__DrawData__LOADED_EVENT,
        Na__DrawData__CHANGED_EVENT
    } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers (the undo and redo restore)
    // ------------------------------------------------------------
    import { Na__LeRec__NormaliseSheet } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Labels (the save confirmation)
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Constants (re-exported below), Session State and Helpers
    // ------------------------------------------------------------
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
        Na__LeModel__ActiveSheetId,
        Na__LeModel__SelectionItems,
        Na__LeModel__Dirty,
        Na__LeModel__Dispatch,
        Na__LeModel__Touch,
        Na__LeModel__Array,
        Na__LeModel__AssignActiveSheetId,
        Na__LeModel__AssignSelectionItems,
        Na__LeModel__AssignDirty
    } from './Na__LayoutEditor__SheetModel__State__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheets, Layers, Draw Order and Viewports (re-exported below)
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetSheets,
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId,
        Na__LeModel__CreateSheet,
        Na__LeModel__DuplicateSheet,
        Na__LeModel__DeleteSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__ReorderSheet,
        Na__LeModel__GetFields,
        Na__LeModel__UpdateMarginNotes,
        Na__LeModel__SetField
    } from './Na__LayoutEditor__SheetModel__Sheets__.js';
    import {
        Na__LeModel__GetLayers,
        Na__LeModel__GetLayerById,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked
    } from './Na__LayoutEditor__SheetModel__Layers__.js';
    import { Na__LeModel__CanArrange, Na__LeModel__Arrange } from './Na__LayoutEditor__SheetModel__DrawOrder__.js';
    import {
        Na__LeModel__GetViewports,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__CreateViewport,
        Na__LeModel__InsertViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource
    } from './Na__LayoutEditor__SheetModel__Viewports__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Text, Dimensions, Shapes, Leaders and Groups (re-exported below)
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetAnnotations,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetDimensions,
        Na__LeModel__CreateAnnotation,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteAnnotation,
        Na__LeModel__CreateDimension,
        Na__LeModel__UpdateDimension,
        Na__LeModel__DeleteDimension
    } from './Na__LayoutEditor__SheetModel__TextAndDimensions__.js';
    import {
        Na__LeModel__GetShapeById,
        Na__LeModel__CreateShape,
        Na__LeModel__InsertShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteShape
    } from './Na__LayoutEditor__SheetModel__Shapes__.js';
    import {
        Na__LeModel__GetLeaders,
        Na__LeModel__GetLeaderById,
        Na__LeModel__CreateLeader,
        Na__LeModel__InsertLeader,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader
    } from './Na__LayoutEditor__SheetModel__Leaders__.js';
    import {
        Na__LeModel__GetGroups,
        Na__LeModel__GetGroupById,
        Na__LeModel__InsertGroup,
        Na__LeModel__DeleteGroup,
        Na__LeModel__DeleteItems
    } from './Na__LayoutEditor__SheetModel__Groups__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Initialization Guard (the session state is the State unit's)
    // ------------------------------------------------------------
    let Na__LeModel__Initialized   = false;
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
        Na__LeModel__AssignSelectionItems(next);
        if (!same) Na__LeModel__Dispatch('selection', Na__LeModel__ActiveSheetId, next.length === 1 ? next[0].id : null);
        return next.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Selected Item, and Whether an Item Is One of Them
    // ------------------------------------------------------------
    function Na__LeModel__GetSelectionItems() { return Na__LeModel__SelectionItems.slice(); }
    function Na__LeModel__IsSelected(kind, id) { return Na__LeModel__SelectionItems.some((item) => item.kind === kind && item.id === id); }
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
    function Na__LeModel__NotifyRegister() { Na__LeModel__Dispatch('register-updated', Na__LeModel__ActiveSheetId); }

    function Na__LeModel__MarkDirty() { Na__LeModel__AssignDirty(true); }
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
        if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__AssignActiveSheetId(null);
        Na__LeModel__AssignSelectionItems([]);
        Na__LeModel__AssignDirty(true);
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
        if (saved) Na__LeModel__AssignDirty(false);
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
            Na__LeModel__AssignDirty(false);
            if (Na__LeModel__ActiveSheetId && !Na__LeModel__GetSheetById(Na__LeModel__ActiveSheetId)) Na__LeModel__AssignActiveSheetId(null);
            if (saved) { Na__LeModel__Dispatch('saved', Na__LeModel__ActiveSheetId); return; }   // <-- The same records, now on disk: selection and undo history stay
            Na__LeModel__AssignSelectionItems([]);
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
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
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
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__IsSitePlanViewport,
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
        Na__LeModel__CanArrange,
        Na__LeModel__Arrange,
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
        Na__LeModel__GetLeaderById,
        Na__LeModel__CreateLeader,
        Na__LeModel__InsertLeader,
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
        Na__LeModel__NotifyRegister,
        Na__LeModel__RestoreSheets,
        Na__LeModel__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
