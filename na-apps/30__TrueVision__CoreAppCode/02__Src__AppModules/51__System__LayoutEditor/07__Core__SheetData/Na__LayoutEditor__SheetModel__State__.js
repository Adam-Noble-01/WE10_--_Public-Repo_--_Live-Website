// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__State__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the sheet model constants, the session state and the change announcement every unit writes through
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Holds the constants (the change event, the viewport kinds, the layer
//   types, the scenes key, the style keys and the drawing types) and the
//   session state: the active sheet id, the selection items and the dirty
//   flag. TrueVision only: DRAWING_ARCHITECTURAL and DRAWING_SITEPLAN, the
//   two drawing types a sheet can be.
// - Holds the helpers every write goes through: Dispatch announces a change,
//   Touch marks the model dirty and announces, Array finds the sheets array in
//   the drawings block, and Unselect drops a deleted item from the selection.
//   Dispatch and Touch pass an optional restore through to the event detail
//   (an undo or redo from AnnounceRestore; null on every other change).
// - The state is exported as live bindings to read. An imported let cannot
//   be assigned, so the units that write it call AssignActiveSheetId,
//   AssignSelectionItems and AssignDirty: each does that one assignment and
//   nothing else (no announcement).
// - Imports no other sheet model unit, so every unit can import it without a
//   cycle.
//
// INTEGRATION:
// - Imported by Na__LayoutEditor__SheetModel__ and by its Sheets, Layers,
//   DrawOrder, Viewports, TextAndDimensions, Shapes, Leaders and Groups
//   units. Every other module imports Na__LayoutEditor__SheetModel__.js,
//   which re-exports the public constants, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header and folder numbers; DRAWING_ARCHITECTURAL and DRAWING_SITEPLAN are TrueVision only, and Dispatch and Touch carry the restore detail (TrueVision's AnnounceRestore).
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

    // MODULE IMPORTS | Drawings Block
    // ------------------------------------------------------------
    import { Na__DrawData__SHEETS_KEY, Na__DrawData__GetBlock } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Record Kinds, Layer Types, Style Keys and Drawing Types
    // ------------------------------------------------------------
    import {
        Na__LeRec__KIND_2D,
        Na__LeRec__KIND_3D,
        Na__LeRec__LAYER_TYPES,
        Na__LeRec__STYLE_KEYS,
        Na__LeRec__DRAWING_ARCHITECTURAL,
        Na__LeRec__DRAWING_SITEPLAN
    } from './Na__LayoutEditor__SheetRecords__.js';
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
    const Na__LeModel__DRAWING_ARCHITECTURAL = Na__LeRec__DRAWING_ARCHITECTURAL;
    const Na__LeModel__DRAWING_SITEPLAN      = Na__LeRec__DRAWING_SITEPLAN;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__LeModel__ActiveSheetId  = null;
    let Na__LeModel__SelectionItems = [];      // <-- [{ kind : 'viewport' | 'annotation' | 'dimension' | 'shape' | 'leader', id }], in the order chosen
    let Na__LeModel__Dirty         = false;
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


    // HELPER FUNCTION | Drop a Deleted Item From the Selection (silent: its delete announces)
    // ------------------------------------------------------------
    function Na__LeModel__Unselect(itemId) {
        Na__LeModel__SelectionItems = Na__LeModel__SelectionItems.filter((item) => item.id !== itemId);
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State Accessors
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Assign the Session State From Another Unit
    // ------------------------------------------------------------
    // An imported let reads live but cannot be assigned. The units that
    // write the active sheet, the selection or the dirty flag call these,
    // and each does that one assignment and nothing more: no announcement.
    // ------------------------------------------------------------
    function Na__LeModel__AssignActiveSheetId(sheetId) { Na__LeModel__ActiveSheetId = sheetId; }
    function Na__LeModel__AssignSelectionItems(items) { Na__LeModel__SelectionItems = items; }
    function Na__LeModel__AssignDirty(dirty) { Na__LeModel__Dirty = dirty; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model State
    // ------------------------------------------------------------
    export {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__LAYER_TYPES,
        Na__LeModel__SCENES_KEY,
        Na__LeModel__STYLE_KEYS,
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
        Na__LeModel__ActiveSheetId,
        Na__LeModel__SelectionItems,
        Na__LeModel__Dirty,
        Na__LeModel__Dispatch,
        Na__LeModel__Touch,
        Na__LeModel__Array,
        Na__LeModel__Unselect,
        Na__LeModel__AssignActiveSheetId,
        Na__LeModel__AssignSelectionItems,
        Na__LeModel__AssignDirty
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
