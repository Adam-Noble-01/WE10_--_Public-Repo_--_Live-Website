// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - LAYERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Layers__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Layers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's layers: find, add, remove, change and restack them, and say whether an item's layer shows or is locked
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - A sheet's layers in paint order, one layer by id, and the default layer
//   new items of a type land on.
// - Add a layer on top, remove one (its items move to the default layer of
//   their type), change a name, type, visibility or lock, and move a layer
//   in the stack.
// - IsLayerVisible and IsLayerLocked answer for any item's layer.
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
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import { Na__LeModel__LAYER_TYPES, Na__LeModel__Touch } from './Na__LayoutEditor__SheetModel__State__.js';
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


    // FUNCTION | Add a Layer
    // ------------------------------------------------------------
    // At the bottom of the list - the back of the stack - unless opts.index
    // names a place in it (0 is the top, the front): the layer goes there and
    // the ones from there down move one place back. This read "on top" until
    // 21-Sep-2026, which the bottom of the list never was.
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
            const area = s.Shape__Area && typeof s.Shape__Area === 'object';
            s.Shape__LayerId = Na__LeModel__DefaultLayerId(sheet, area ? 'area' : 'vector');
        });
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Layers API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetLayers,
        Na__LeModel__LayerIndexAboveDrawings,
        Na__LeModel__GetLayerById,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateLayer,
        Na__LeModel__DeleteLayer,
        Na__LeModel__UpdateLayer,
        Na__LeModel__ReorderLayer,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
