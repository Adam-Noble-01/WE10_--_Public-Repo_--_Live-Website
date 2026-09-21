// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LAYER MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__LayerMenu__.js
// NAMESPACE  : Na__LeLayerMenu
// MODULE     : Layout Editor - Layer Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The right-click menu's Layer row: which drawing layer the clicked item or the selection is on, and a flyout to move it onto another
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Adam, over a right-clicked construction line on RB05's Rear Elevation:
//   "a drawing layer pops out. When you click on it, it lists the drawing
//   layers, and then you can click to move it onto one of the others, or it
//   will show you which one it's on currently." In a section of its own,
//   between two rules, directly under the Delete row - where his mark-up put
//   it, between "Delete shape" and "Cut selection".
// - MenuItems(sheet, items) answers that section: one row, Layer, with the
//   layer the items sit on written at its far end, opening a flyout of the
//   sheet's layers in the Layers panel's order, top of the list first. The
//   layer holding everything is dotted; with a selection spread over several,
//   every layer holding part of it is ringed.
// - WHAT MOVES. A group is its members (Na__LeGroup__Expand), so a group, a
//   parametric element or a window of several things moves as one, in one
//   undo step (Na__LeModel__MoveToLayer). An item on a locked layer stays
//   where it is, as it does for a move and a delete, and a locked layer takes
//   nothing: it is listed greyed, with Locked beside it.
// - A HIDDEN OR A REFERENCE LAYER IS OFFERED, AND SAYS SO. Moving something
//   there is how it is put away - out of sight, or out of the pointer's and
//   the snaps' reach - and the model takes it out of the selection as it
//   goes, since it can no longer be picked.
// - A toast names the layer. A change of layer is otherwise invisible:
//   nothing on the sheet moves.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ContextMenu__ puts MenuItems under the
//   Delete row of every item's menu, and of a multi-selection's.
// - The flyout is a submenu of Na__LayoutEditor__ContextMenu__.
// - Moves through Na__LeModel__MoveToLayer (Na__LayoutEditor__SheetModel__Layers__).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported; it needs the context menu's flyouts
//                   (Na__LayoutEditor__ContextMenu__ 1.1.0) and the model's
//                   MoveToLayer (Na__LayoutEditor__SheetModel__Layers__ 1.3.0)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Groups and the Panel Host's Toast
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetLayers,
        Na__LeModel__ItemLayerId,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__MoveToLayer
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Records a Layer Change Touches, Groups Opened Up
    // ------------------------------------------------------------
    // A group has no layer of its own - its members each carry one - so it is
    // opened up to them, nested groups too, and the group records drop out.
    // Returns [{ kind, id, layerId }].
    // ------------------------------------------------------------
    function Na__LeLayerMenu__Leaves(sheet, items) {
        if (!sheet || !Array.isArray(items)) return [];
        return Na__LeGroup__Expand(sheet, items.filter(Boolean))
            .map((item) => ({ kind : item.kind, id : item.id, layerId : Na__LeModel__ItemLayerId(sheet, item) }))
            .filter((leaf) => leaf.layerId !== null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Layer in the Flyout Says About Itself
    // ------------------------------------------------------------
    // Why it is greyed out, or where a move there puts the items: out of
    // sight, or out of the pointer's reach. The same fields the Layers panel
    // draws its buttons from, so the two never disagree.
    // ------------------------------------------------------------
    function Na__LeLayerMenu__StateOf(layer) {
        if (layer.Layer__Locked === true)      return Na__LeCfg__GetLabel('MenuLayerLocked', 'Locked');
        if (layer.Layer__Visible === false)    return Na__LeCfg__GetLabel('MenuLayerHidden', 'Hidden');
        if (layer.Layer__Selectable === false) return Na__LeCfg__GetLabel('MenuLayerReference', 'Reference');
        return '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Toast Through the Panel Host
    // ------------------------------------------------------------
    function Na__LeLayerMenu__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move the Items That Can Go, and Say So
    // ------------------------------------------------------------
    // stayed: how many of the items sit on a locked layer and were never
    // going to move. Items already on the chosen layer are not counted as
    // moved, so a toast never claims more than happened.
    // ------------------------------------------------------------
    function Na__LeLayerMenu__Move(sheet, movable, stayed, layer) {
        const moved = Na__LeModel__MoveToLayer(sheet, movable, layer.Layer__Id);
        if (!moved) return 0;
        const said = moved === 1
            ? Na__LeCfg__FormatLabel('MenuLayerMovedOne', 'Moved to {layer}.', { layer : layer.Layer__Name })
            : Na__LeCfg__FormatLabel('MenuLayerMoved', 'Moved {count} items to {layer}.', { count : moved, layer : layer.Layer__Name });
        const held = stayed > 0 ? ' ' + Na__LeCfg__FormatLabel('MenuLayerStayed', '{count} on a locked layer stayed where they were.', { count : stayed }) : '';
        Na__LeLayerMenu__Toast(said + held);
        return moved;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Layer Section of a Right-Click Menu: the Layer Row and Its Rule
    // ------------------------------------------------------------
    // items: [{ kind, id }] - the item right-clicked, or every item of the
    // selection. Returns [] when none of them sits on a layer, so a menu that
    // has nothing to move has no Layer row.
    //
    // The row stays enabled even when everything is held by a lock, so the
    // flyout can still be opened to see which layer that is; its rows are then
    // greyed, the current one still dotted.
    // ------------------------------------------------------------
    function Na__LeLayerMenu__MenuItems(sheet, items) {
        const leaves = Na__LeLayerMenu__Leaves(sheet, items);
        if (!leaves.length) return [];
        const holding = new Set(leaves.map((leaf) => leaf.layerId));
        const movable = leaves.filter((leaf) => !Na__LeModel__IsLayerLocked(sheet, leaf.layerId));
        const stayed  = leaves.length - movable.length;
        const layers  = Na__LeModel__GetLayers(sheet);                         // <-- The Layers panel's order: top of the list, the front, first
        const held    = layers.filter((layer) => holding.has(layer.Layer__Id));
        const flyout  = layers.map((layer) => ({
            label    : layer.Layer__Name,
            hint     : Na__LeLayerMenu__StateOf(layer),
            checked  : holding.has(layer.Layer__Id) ? (held.length === 1 ? true : 'mixed') : false,
            disabled : layer.Layer__Locked === true || movable.length === 0,
            onSelect : () => { Na__LeLayerMenu__Move(sheet, movable, stayed, layer); }
        }));
        const where = held.length === 1 ? held[0].Layer__Name
                    : (held.length > 1 ? Na__LeCfg__FormatLabel('MenuLayerSeveral', '{count} layers', { count : held.length }) : '');
        return [
            { label : Na__LeCfg__GetLabel('MenuLayer', 'Layer'), hint : where, submenu : flyout },
            { separator : true }
        ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Layer Menu API
    // ------------------------------------------------------------
    export {
        Na__LeLayerMenu__MenuItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
