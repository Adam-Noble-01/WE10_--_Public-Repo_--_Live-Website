// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - LEADERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Leaders__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Leaders
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's leaders and annotation bubbles: add, change and remove them
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - GetLeaders, CreateLeader from a tip, an anchor and options (a new leader
//   lands on the sheet's text layer), UpdateLeader (including the link to a
//   specification note) and DeleteLeader.
// - The silent paths set the dirty flag through the State unit's
//   AssignDirty (an imported let cannot be assigned).
//
// INTEGRATION:
// - Imports Na__LayoutEditor__SheetModel__State__ and
//   Na__LayoutEditor__SheetModel__Layers__ (DefaultLayerId).
// - Leaders are drawn by Na__LayoutEditor__LeaderGeometry__.
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
// 18-Sep-2026 - Version 1.1.0
// - GetLeaderById and InsertLeader: a paste of a leader, the way InsertShape
//   and InsertAnnotation paste a vector or a text item - a complete record,
//   deep-copied, given a fresh id. Read by Na__LayoutEditor__ItemClipboard__,
//   which now copies, pastes and duplicates a leader the way it already does
//   text.
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
        Na__LeRec__NormaliseLeader
    } from './Na__LayoutEditor__SheetRecords__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State and Layers
    // ------------------------------------------------------------
    import { Na__LeModel__Touch, Na__LeModel__Unselect, Na__LeModel__AssignDirty } from './Na__LayoutEditor__SheetModel__State__.js';
    import { Na__LeModel__DefaultLayerId, Na__LeModel__GetLayerById } from './Na__LayoutEditor__SheetModel__Layers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Leaders
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Leaders
    // ------------------------------------------------------------
    function Na__LeModel__GetLeaders(sheet) { return (sheet && Array.isArray(sheet.Sheet__Leaders)) ? sheet.Sheet__Leaders : []; }
    // ------------------------------------------------------------


    // FUNCTION | One Leader by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetLeaderById(sheet, itemId) {
        return sheet ? Na__LeRec__Find(Na__LeModel__GetLeaders(sheet), 'Leader__Id', itemId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Complete Leader Record Onto a Sheet (fresh id, one announcement)
    // ------------------------------------------------------------
    // A paste of a leader, the way InsertShape and InsertAnnotation paste a
    // vector or a text item. silent skips the announcement so several items
    // can land as one undo step. A layer id the sheet does not have falls
    // back to the default annotation-type layer, the same as a new leader.
    // ------------------------------------------------------------
    function Na__LeModel__InsertLeader(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        if (!Array.isArray(sheet.Sheet__Leaders)) sheet.Sheet__Leaders = [];
        const item = JSON.parse(JSON.stringify(record));
        item.Leader__Id = Na__LeRec__NextId(sheet.Sheet__Leaders, 'Leader_', 'Leader__Id');
        let layerId = item.Leader__LayerId;
        if (!Na__LeModel__GetLayerById(sheet, layerId)) layerId = Na__LeModel__DefaultLayerId(sheet, 'annotation');
        Na__LeRec__NormaliseLeader(item, layerId);
        sheet.Sheet__Leaders.push(item);
        if (silent) { Na__LeModel__AssignDirty(true); return item; }
        Na__LeModel__Touch('leaders', sheet.Sheet__Id, item.Leader__Id);
        return item;
    }
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
        if (opts.silent) Na__LeModel__AssignDirty(true); else Na__LeModel__Touch('leaders', sheet.Sheet__Id, item.Leader__Id);   // <-- The leader tool announces once, when the head lands
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
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Leaders API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetLeaders,
        Na__LeModel__GetLeaderById,
        Na__LeModel__CreateLeader,
        Na__LeModel__InsertLeader,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
