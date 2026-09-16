// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - DRAW ORDER
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__DrawOrder__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Draw Order
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Move a vector, text item, dimension or leader forward, backward, to the front or to the back of its layer
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - CanArrange and Arrange step an item among the same-layer peers of its
//   kind. Later in the array draws on top and hit-tests first. A locked
//   layer refuses, and viewports stack by layer, so they are not arranged
//   here.
// - One announcement per move, so one undo step.
//
// INTEGRATION:
// - Imports IsLayerLocked from Na__LayoutEditor__SheetModel__Layers__ and
//   Touch from Na__LayoutEditor__SheetModel__State__.
// - Na__LayoutEditor__SheetModel__ re-exports CanArrange and Arrange. Every
//   other module imports Na__LayoutEditor__SheetModel__.js, never this unit.
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
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State and Layers
    // ------------------------------------------------------------
    import { Na__LeModel__Touch } from './Na__LayoutEditor__SheetModel__State__.js';
    import { Na__LeModel__IsLayerLocked } from './Na__LayoutEditor__SheetModel__Layers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Item Draw Order
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Collection a Kind Arranges In
    // ------------------------------------------------------------
    // Later in the array draws on top (and hit-tests first). Viewports stack
    // by layer, not by array, so they are not arranged here.
    // ------------------------------------------------------------
    function Na__LeModel__ArrangeKind(kind) {
        if (kind === 'shape')      return { list : 'Sheet__Shapes',      idKey : 'Shape__Id',      layerKey : 'Shape__LayerId',      reason : 'shapes' };
        if (kind === 'annotation') return { list : 'Sheet__Annotations', idKey : 'Annotation__Id', layerKey : 'Annotation__LayerId', reason : 'annotations' };
        if (kind === 'dimension')  return { list : 'Sheet__Dimensions',  idKey : 'Dimension__Id',  layerKey : 'Dimension__LayerId',  reason : 'dimensions' };
        if (kind === 'leader')     return { list : 'Sheet__Leaders',     idKey : 'Leader__Id',     layerKey : 'Leader__LayerId',     reason : 'leaders' };
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Item's Place Among Same-Layer Peers of Its Kind
    // ------------------------------------------------------------
    function Na__LeModel__ArrangeSlot(sheet, kind, itemId) {
        const spec = Na__LeModel__ArrangeKind(kind);
        if (!sheet || !spec || typeof itemId !== 'string') return null;
        const list = sheet[spec.list];
        if (!Array.isArray(list)) return null;
        const index = list.findIndex((entry) => entry[spec.idKey] === itemId);
        if (index === -1) return null;
        const layerId = list[index][spec.layerKey];
        const peers = [];
        list.forEach((entry, i) => { if (entry[spec.layerKey] === layerId) peers.push({ index : i }); });
        const peerAt = peers.findIndex((peer) => peer.index === index);
        if (peerAt === -1) return null;
        return { spec : spec, list : list, index : index, layerId : layerId, peers : peers, peerAt : peerAt };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Peer Index a Direction Moves To
    // ------------------------------------------------------------
    function Na__LeModel__ArrangeDestPeer(slot, direction) {
        if (direction === 'forward')  return slot.peerAt + 1;
        if (direction === 'backward') return slot.peerAt - 1;
        if (direction === 'front')    return slot.peers.length - 1;
        if (direction === 'back')     return 0;
        return -1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can This Item Step in Draw Order?
    // ------------------------------------------------------------
    // direction: 'forward' | 'backward' | 'front' | 'back'
    // ------------------------------------------------------------
    function Na__LeModel__CanArrange(sheet, kind, itemId, direction) {
        const slot = Na__LeModel__ArrangeSlot(sheet, kind, itemId);
        if (!slot || Na__LeModel__IsLayerLocked(sheet, slot.layerId)) return false;
        const dest = Na__LeModel__ArrangeDestPeer(slot, direction);
        return dest >= 0 && dest < slot.peers.length && dest !== slot.peerAt;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move an Item Among Same-Layer Peers of Its Kind
    // ------------------------------------------------------------
    // Later in the array draws on top. Forward and front step toward the
    // front of that layer; backward and back toward the back. One announcement,
    // so one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__Arrange(sheet, kind, itemId, direction) {
        const slot = Na__LeModel__ArrangeSlot(sheet, kind, itemId);
        if (!slot || Na__LeModel__IsLayerLocked(sheet, slot.layerId)) return false;
        const destPeer = Na__LeModel__ArrangeDestPeer(slot, direction);
        if (destPeer < 0 || destPeer >= slot.peers.length || destPeer === slot.peerAt) return false;
        const from = slot.index;
        const to   = slot.peers[destPeer].index;
        const [ moved ] = slot.list.splice(from, 1);
        slot.list.splice(to, 0, moved);
        Na__LeModel__Touch(slot.spec.reason, sheet.Sheet__Id, itemId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Draw Order API
    // ------------------------------------------------------------
    export {
        Na__LeModel__CanArrange,
        Na__LeModel__Arrange
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
