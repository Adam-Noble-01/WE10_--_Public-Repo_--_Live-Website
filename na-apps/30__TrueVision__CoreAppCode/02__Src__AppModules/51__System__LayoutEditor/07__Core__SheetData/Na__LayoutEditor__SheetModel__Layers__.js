// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Layers__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's layers: find, add, remove, change and restack them, move items between them, and say whether an item's layer shows, is locked or can be picked
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - A sheet's layers in paint order, one layer by id, and the default layer
//   new items of a type land on.
// - Add a layer on top, remove one (its items move to the default layer of
//   their type), change a name, type, visibility, lock or reach, and move a
//   layer in the stack.
// - IsLayerVisible, IsLayerLocked and IsLayerSelectable answer for any item's
//   layer, and ItemLayerId reads the layer one item sits on.
// - MoveToLayer puts items on another layer - the right-click menu's Layer
//   flyout - in one pass and one undo step.
// - GetLayerByName finds a layer by what the user calls it, and
//   LayerIndexLike says where a layer from another sheet's list goes to sit
//   in the same place in this one: a paste across sheets brings its layers.
//   CreateLayer and UpdateLayer can be silent, for a caller that announces
//   once for everything it did.
//
// INTEGRATION:
// - Imports only Na__LayoutEditor__SheetModel__State__ among the units, so
//   the item units import it without a cycle: DrawOrder asks IsLayerLocked,
//   Viewports and TextAndDimensions use GetLayerById and DefaultLayerId,
//   Shapes adds CreateLayer, and Leaders uses DefaultLayerId.
// - Na__LayoutEditor__SheetModel__ re-exports this unit's API. Every other
//   module imports Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header only; the moved code matches the ValeVision3D unit.
// - Back-port     : n/a (this IS the back-port)
// - Ahead         : 1.3.0 (reference layers, MoveToLayer) and 1.4.0 (layers by
//                   name, silent writes) authored here first, 21-Sep-2026; the
//                   ValeVision port waits for Adam's sign-off
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.4.0
// - For a paste across sheets that brings its layers
//   (Na__LayoutEditor__ItemClipboard__): GetLayerByName, matched on the name
//   as the user reads it - case, and runs of spaces, ignored; LayerIndexLike,
//   the place a layer from another sheet's list takes in this one - directly
//   over the nearest layer that sat under it there, else directly under the
//   nearest that sat over it, else the same place in the list; and silent
//   CreateLayer (opts.silent) and UpdateLayer (silent), so the layer a paste
//   makes or switches back on rides in the paste's one undo step.
// - IsItemPickable: DropUnpickable's test for one item, exported - a paste
//   leaves out of the selection what lands out of reach.
//
// 21-Sep-2026 - Version 1.3.0
// - REFERENCE LAYERS, Blender's Selectable switch. IsLayerSelectable answers
//   false for a layer whose Layer__Selectable is false, and UpdateLayer takes
//   selectable, storing only false. A reference layer is drawn and printed as
//   ever, but no click, box, hover or snap finds anything on it.
// - Switching a layer to reference, or hiding it, takes whatever the pointer
//   can no longer reach out of the selection (DropUnpickable) before the one
//   announcement - as Blender deselects what it hides - so a Delete or an
//   arrow key can never act on something that cannot be seen or clicked.
// - MoveToLayer, for the right-click menu's Layer flyout
//   (Na__LayoutEditor__LayerMenu__): any mix of viewports, text, dimensions,
//   vectors and leaders onto one layer, a locked layer refusing in both
//   directions, announced once as 'layers' - one undo step. ItemLayerId reads
//   the layer one item sits on, from LAYER_KEYS, one row per kind.
//
// 21-Sep-2026 - Version 1.2.1
// - DeleteLayer re-homes a picture (Shape__Image) to another Images layer, or
//   to the Vectors layer when there is none.
//
// 21-Sep-2026 - Version 1.2.0
// - The layer list's order is now the paint order of everything on the sheet,
//   so the comments that had it backwards are put right: GetLayers is the
//   list top first - frontmost first - and index 0 of ReorderLayer is the top.
// - CreateLayer takes opts.index, a place in the list to insert at, and
//   LayerIndexAboveDrawings answers where a layer goes to sit straight over
//   the frontmost drawing: a Floor Areas or Vectors layer the sheet has to
//   make for itself lands there rather than at the bottom, where it would now
//   be behind the drawings. The panel's Add still adds at the bottom.
//
// 21-Sep-2026 - Version 1.1.0
// - DeleteLayer re-homes SHAPES as it re-homes everything else. It never did,
//   so a deleted layer left its vectors pointing at a layer that was gone:
//   still drawn (an unknown layer reads as visible) and unreachable from the
//   Layers panel. Found while giving floor areas a layer of their own, where
//   it would have orphaned a whole set of measured rooms.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers
    // ------------------------------------------------------------
    import {
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseLayer,
        Na__LeRec__DefaultLayerId
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State
    // ------------------------------------------------------------
    import {
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__ActiveSheetId,
        Na__LeModel__SelectionItems,
        Na__LeModel__Touch,
        Na__LeModel__AssignSelectionItems,
        Na__LeModel__AssignDirty
    } from './Na__LayoutEditor__SheetModel__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where Each Kind of Item Keeps Its Layer
    // ------------------------------------------------------------
    // One row per kind that sits on a layer. A group is not here: it has no
    // layer of its own, its members each carrying theirs.
    // ------------------------------------------------------------
    const Na__LeModel__LAYER_KEYS = Object.freeze({
        viewport   : Object.freeze({ list : 'Sheet__Viewports',   idKey : 'Viewport__Id',   layerKey : 'Viewport__LayerId' }),
        annotation : Object.freeze({ list : 'Sheet__Annotations', idKey : 'Annotation__Id', layerKey : 'Annotation__LayerId' }),
        dimension  : Object.freeze({ list : 'Sheet__Dimensions',  idKey : 'Dimension__Id',  layerKey : 'Dimension__LayerId' }),
        shape      : Object.freeze({ list : 'Sheet__Shapes',      idKey : 'Shape__Id',      layerKey : 'Shape__LayerId' }),
        leader     : Object.freeze({ list : 'Sheet__Leaders',     idKey : 'Leader__Id',     layerKey : 'Leader__LayerId' })
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Layers
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Layers, in List Order: the Top of the List First
    // ------------------------------------------------------------
    // Layer__Order 1 is the top of the Layers list, and the top of the list
    // is FRONTMOST - decision D31, and since 21-Sep-2026 the paint order of
    // everything on the sheet (Na__LayoutEditor__PaintOrder__). This read
    // "frontmost last" until then, which was never how anything used it.
    // ------------------------------------------------------------
    function Na__LeModel__GetLayers(sheet) {
        return sheet ? sheet.Sheet__Layers.slice().sort((a, b) => a.Layer__Order - b.Layer__Order) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a New Layer Goes to Sit Just Over the Drawings
    // ------------------------------------------------------------
    // The list index of the frontmost layer carrying a viewport (or tagged as
    // one while it is empty): a layer inserted there sits directly ABOVE it,
    // over the drawings and under everything else. undefined when the sheet
    // has no such layer, which CreateLayer reads as the bottom of the list.
    // ------------------------------------------------------------
    function Na__LeModel__LayerIndexAboveDrawings(sheet) {
        if (!sheet) return undefined;
        const holding = new Set((sheet.Sheet__Viewports || []).map((viewport) => viewport.Viewport__LayerId));
        const index   = Na__LeModel__GetLayers(sheet).findIndex((layer) => holding.has(layer.Layer__Id) || layer.Layer__Type === 'viewport');
        return index === -1 ? undefined : index;
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


    // HELPER FUNCTION | A Layer Name as the Eye Reads It (case and runs of spaces ignored)
    // ------------------------------------------------------------
    function Na__LeModel__LayerNameKey(name) {
        return (typeof name === 'string') ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | One Layer by Name, the Top of the List First (null when the sheet has none)
    // ------------------------------------------------------------
    // Layer ids are per sheet - Layer_006 is Construction Lines on one sheet
    // and Images on the next - so what a layer IS from one sheet to another is
    // its name. "Construction Lines" and "construction  lines" are one layer.
    // ------------------------------------------------------------
    function Na__LeModel__GetLayerByName(sheet, name) {
        const wanted = Na__LeModel__LayerNameKey(name);
        if (!sheet || !wanted) return null;
        return Na__LeModel__GetLayers(sheet).find((layer) => Na__LeModel__LayerNameKey(layer.Layer__Name) === wanted) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Layer From Another Sheet's List Goes to Sit in the Same Place in This One
    // ------------------------------------------------------------
    // names: that sheet's layers by name, top of the list first; at: where the
    // layer sat in them. Answered by NEIGHBOURS, not by counting, because the
    // two lists need not hold the same layers: directly over the nearest layer
    // that sat under it there and this sheet also has; failing that, directly
    // under the nearest one that sat over it; failing both, the same place in
    // the list, as near as this one allows. A list index for CreateLayer.
    // ------------------------------------------------------------
    function Na__LeModel__LayerIndexLike(sheet, names, at) {
        const list  = Na__LeModel__GetLayers(sheet);
        const where = (name) => list.findIndex((layer) => Na__LeModel__LayerNameKey(layer.Layer__Name) === Na__LeModel__LayerNameKey(name));
        const from  = Array.isArray(names) ? names : [];
        for (let i = at + 1; i < from.length; i++) { const k = where(from[i]); if (k !== -1) return k; }        // <-- Over what it sat over
        for (let i = at - 1; i >= 0; i--)          { const k = where(from[i]); if (k !== -1) return k + 1; }    // <-- Else under what it sat under
        return Math.max(0, Math.min(Number.isInteger(at) ? at : list.length, list.length));
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Layer
    // ------------------------------------------------------------
    // At the bottom of the list - the back of the stack - unless opts.index
    // names a place in it (0 is the top, the front): the layer goes there and
    // the ones from there down move one place back. This read "on top" until
    // 21-Sep-2026, which the bottom of the list never was. opts.silent marks
    // the sheet changed and announces nothing: the caller announces once for
    // everything it did (a paste that brings its layer with it).
    // ------------------------------------------------------------
    function Na__LeModel__CreateLayer(sheet, options) {
        if (!sheet) return null;
        const opts  = options || {};
        const list  = Na__LeModel__GetLayers(sheet);
        const layer = Na__LeRec__NormaliseLayer({
            Layer__Id    : Na__LeRec__NextId(sheet.Sheet__Layers, 'Layer_', 'Layer__Id'),
            Layer__Name  : opts.name,
            Layer__Type  : opts.type,
            Layer__Order : sheet.Sheet__Layers.length + 1
        }, sheet.Sheet__Layers.length);
        sheet.Sheet__Layers.push(layer);
        if (Number.isInteger(opts.index) && opts.index >= 0 && opts.index < list.length) {
            list.splice(opts.index, 0, layer);
            list.forEach((l, k) => { l.Layer__Order = k + 1; });
            sheet.Sheet__Layers.sort((a, b) => a.Layer__Order - b.Layer__Order);  // <-- The array in list order too, so the first layer of a type is the frontmost one
        }
        if (opts.silent === true) { Na__LeModel__AssignDirty(true); return layer; }   // <-- The caller announces, once, for everything it did
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
        // VECTORS AND MEASURED ROOMS were the one kind this did not re-home,
        // so deleting a layer that held them left every one pointing at a
        // layer that was gone - drawn, because an unknown layer reads as
        // visible, and unreachable from the Layers panel ever after. A room
        // goes to the Floor Areas layer and a plain vector to the Vectors one.
        (sheet.Sheet__Shapes || []).forEach((s) => {
            if (s.Shape__LayerId !== layerId) return;
            const area  = s.Shape__Area && typeof s.Shape__Area === 'object';
            const image = s.Shape__Image && typeof s.Shape__Image === 'object';
            s.Shape__LayerId = Na__LeModel__DefaultLayerId(sheet, image ? 'image' : (area ? 'area' : 'vector'));   // <-- A picture to another Images layer, or to Vectors
        });
        (sheet.Sheet__Leaders || []).forEach((l) => { if (l.Leader__LayerId === layerId) l.Leader__LayerId = Na__LeModel__DefaultLayerId(sheet, 'annotation'); });
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Layer's Name, Type, Visibility, Lock or Reach
    // ------------------------------------------------------------
    // selectable false makes it a reference layer (Layer__Selectable, stored
    // only as false); true takes the key off again. A layer switched to
    // reference, or hidden, takes what the pointer can no longer reach out of
    // the selection BEFORE the one announcement, so the history's step and
    // every redraw already see the tidied selection. silent marks the sheet
    // changed and announces nothing, for a caller that announces once for
    // everything it did (a paste switching its layer back on).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateLayer(sheet, layerId, patch, silent) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        if (!layer || !patch) return false;
        if (typeof patch.name === 'string' && patch.name.trim()) layer.Layer__Name = patch.name.trim();
        if (Na__LeModel__LAYER_TYPES.indexOf(patch.type) !== -1) layer.Layer__Type = patch.type;
        if (typeof patch.visible === 'boolean') layer.Layer__Visible = patch.visible;
        if (typeof patch.locked  === 'boolean') layer.Layer__Locked  = patch.locked;
        if (typeof patch.selectable === 'boolean') {
            if (patch.selectable) delete layer.Layer__Selectable;                // <-- Selectable is every layer's default: no key
            else layer.Layer__Selectable = false;
        }
        if (patch.visible === false || patch.selectable === false) Na__LeModel__DropUnpickable(sheet);
        if (silent === true) { Na__LeModel__AssignDirty(true); return true; }   // <-- The caller announces, once, for everything it did
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Layer in the Stack (index 0 = the top of the list, the front)
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


    // FUNCTION | Can the Pointer Reach an Item's Layer? (false for a reference layer)
    // ------------------------------------------------------------
    // Blender's Selectable switch, with its snapping option "Exclude
    // Non-Selectable" always on. A REFERENCE layer is drawn and printed as
    // ever, but no click, box, hover, snap or inference finds anything on it:
    // the pointer passes straight through to whatever lies beneath. That is
    // the difference from a lock, which stops an edit and still offers its
    // points to snap to. A layer the sheet does not have reads as selectable,
    // as it reads as shown.
    // ------------------------------------------------------------
    function Na__LeModel__IsLayerSelectable(sheet, layerId) {
        const layer = Na__LeModel__GetLayerById(sheet, layerId);
        return !layer || layer.Layer__Selectable !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Items and Their Layers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Record Behind an Item, With the Row That Says Where Its Layer Is
    // ------------------------------------------------------------
    function Na__LeModel__LayeredRecord(sheet, item) {
        const row    = (sheet && item) ? Na__LeModel__LAYER_KEYS[item.kind] : null;
        const record = (row && Array.isArray(sheet[row.list])) ? Na__LeRec__Find(sheet[row.list], row.idKey, item.id) : null;
        return record ? { row : row, record : record } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layer One Item Sits On (null for a group, which has none, or an item that is gone)
    // ------------------------------------------------------------
    function Na__LeModel__ItemLayerId(sheet, item) {
        const found = Na__LeModel__LayeredRecord(sheet, item);
        return found ? (found.record[found.row.layerKey] || null) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Could the Pointer Pick This Item Out? (its layer shown, and not a reference layer)
    // ------------------------------------------------------------
    // A group can be picked while any member can, as a click on that member
    // still finds it. An item that sits on no layer, or no longer exists,
    // answers true: nothing about a layer holds it back. seen is the walk's
    // own guard against a group that names itself.
    // ------------------------------------------------------------
    function Na__LeModel__IsItemPickable(sheet, item, seen) {
        if (!sheet || !item) return false;
        if (item.kind !== 'group') {
            const layerId = Na__LeModel__ItemLayerId(sheet, item);
            return layerId === null || (Na__LeModel__IsLayerVisible(sheet, layerId) && Na__LeModel__IsLayerSelectable(sheet, layerId));
        }
        const walked = seen || new Set();
        if (walked.has(item.id)) return false;
        walked.add(item.id);
        const group = Na__LeRec__Find(Array.isArray(sheet.Sheet__Groups) ? sheet.Sheet__Groups : [], 'Group__Id', item.id);
        return !!group && (group.Group__Members || []).some((member) => Na__LeModel__IsItemPickable(sheet, member, walked));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Out of the Selection Whatever the Pointer Can No Longer Reach
    // ------------------------------------------------------------
    // An item on a hidden or a reference layer cannot be clicked or boxed, so
    // it must not stay selected either: a Delete or an arrow key would still
    // reach it, out of sight or out of reach. A group stays while any member
    // is within reach (IsItemPickable). Only ever the sheet being worked on:
    // the selection belongs to it, and an id on another sheet names another
    // record. Silent, as DeleteItems' trim of the selection is - the change
    // that caused it announces. Returns true when the selection changed.
    // ------------------------------------------------------------
    function Na__LeModel__DropUnpickable(sheet) {
        if (!sheet || sheet.Sheet__Id !== Na__LeModel__ActiveSheetId || !Na__LeModel__SelectionItems.length) return false;
        const kept = Na__LeModel__SelectionItems.filter((item) => Na__LeModel__IsItemPickable(sheet, item));
        if (kept.length === Na__LeModel__SelectionItems.length) return false;
        Na__LeModel__AssignSelectionItems(kept);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Items on Another Layer (one undo step)
    // ------------------------------------------------------------
    // items: [{ kind, id }] of viewports, text, dimensions, vectors and
    // leaders. A group has no layer of its own, so the caller opens it up to
    // its members first (Na__LeGroup__Expand); a group record in the list is
    // passed over. An item on a LOCKED layer stays where it is, and a locked
    // layer takes nothing: a lock means nothing on that layer changes, the
    // rule a move and a delete already keep.
    //
    // ONE ANNOUNCEMENT, AS 'layers'. An item changing layer changes its place
    // in the paint order, which is the whole sheet's business: the surface
    // restacks everything, as it does for a layer dragged in the list, and the
    // history takes one step however many items moved. Each item keeps its
    // place in its own collection, so items moved together keep their order
    // among themselves.
    //
    // An item landing on a hidden or a reference layer leaves the selection,
    // since it can no longer be picked. Returns how many items moved.
    // ------------------------------------------------------------
    function Na__LeModel__MoveToLayer(sheet, items, layerId) {
        const target = Na__LeModel__GetLayerById(sheet, layerId);
        if (!target || target.Layer__Locked === true || !Array.isArray(items)) return 0;
        let moved = 0;
        items.forEach((item) => {
            const found = Na__LeModel__LayeredRecord(sheet, item);
            if (!found) return;
            const current = found.record[found.row.layerKey];
            if (current === layerId || Na__LeModel__IsLayerLocked(sheet, current)) return;   // <-- Already there, or held where it is by a lock
            found.record[found.row.layerKey] = layerId;
            moved++;
        });
        if (!moved) return 0;
        Na__LeModel__DropUnpickable(sheet);
        Na__LeModel__Touch('layers', sheet.Sheet__Id, layerId);
        return moved;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Layers API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetLayers,
        Na__LeModel__LayerIndexAboveDrawings,
        Na__LeModel__LayerIndexLike,
        Na__LeModel__GetLayerById,
        Na__LeModel__GetLayerByName,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__IsLayerSelectable,
        Na__LeModel__IsItemPickable,
        Na__LeModel__ItemLayerId,
        Na__LeModel__MoveToLayer
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
