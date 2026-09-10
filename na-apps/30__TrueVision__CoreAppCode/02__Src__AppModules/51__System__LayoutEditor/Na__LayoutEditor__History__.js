// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - HISTORY
// =============================================================================
//
// FILE       : Na__LayoutEditor__History__.js
// NAMESPACE  : Na__LeHist
// MODULE     : Layout Editor - History
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Undo and redo for a sheet: the last fifty announced changes, as whole-sheet snapshots
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Every announced change to a sheet (a move, a resize, a crop, a new
//   viewport, a text edit, a layer change, a field) is one step. A drag
//   updates the model silently and announces once on release, so a drag
//   is one step, however long it lasted.
// - Steps are snapshots of the sheet record, kept per sheet, capped at the
//   configured depth. Undo puts the previous snapshot back into the same
//   record object (the surface and panels hold that object), then announces
//   a sheet update so everything redraws. Selection is dropped when the
//   item it pointed at no longer exists.
// - Sheet creation, deletion and reordering are not steps: they change the
//   sheet list, not a sheet.
//
// INTEGRATION:
// - Initialised by the mode controller; the sheet tools call Undo and Redo
//   from the key bindings; the toolbar shows the buttons.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__History__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.1
// - Shape changes are steps.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Sheet Model
    // ------------------------------------------------------------
    import { Na__LeCfg__GetHistorySetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__GetSelection,
        Na__LeModel__SetSelection
    } from './Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event and the Reasons That Count as a Step
    // ------------------------------------------------------------
    const Na__LeHist__CHANGED_EVENT = 'na-layouteditor-history-changed';
    const Na__LeHist__STEP_REASONS  = [ 'sheet-updated', 'fields', 'layers', 'viewports', 'viewport', 'annotations', 'annotation', 'dimensions', 'dimension', 'shapes', 'shape' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per-Sheet Stacks
    // ------------------------------------------------------------
    const Na__LeHist__Entries   = new Map();   // <-- sheetId -> { undo : [], redo : [], current : json|null }
    let   Na__LeHist__Restoring = false;
    let   Na__LeHist__Ready     = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Stacks for a Sheet, Created on First Use
    // ------------------------------------------------------------
    function Na__LeHist__Entry(sheetId) {
        let entry = Na__LeHist__Entries.get(sheetId);
        if (!entry) { entry = { undo : [], redo : [], current : null }; Na__LeHist__Entries.set(sheetId, entry); }
        return entry;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce Depth Changes to the Toolbar
    // ------------------------------------------------------------
    function Na__LeHist__Dispatch(sheetId) {
        const entry = sheetId ? Na__LeHist__Entries.get(sheetId) : null;
        window.dispatchEvent(new CustomEvent(Na__LeHist__CHANGED_EVENT, {
            detail : { sheetId : sheetId || null, undoDepth : entry ? entry.undo.length : 0, redoDepth : entry ? entry.redo.length : 0 }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does the Current Selection Still Exist on the Sheet
    // ------------------------------------------------------------
    function Na__LeHist__SelectionExists(sheet, selection) {
        if (!selection) return true;
        if (selection.kind === 'viewport')   return sheet.Sheet__Viewports.some((v) => v.Viewport__Id === selection.id);
        if (selection.kind === 'annotation') return sheet.Sheet__Annotations.some((a) => a.Annotation__Id === selection.id);
        if (selection.kind === 'dimension')  return sheet.Sheet__Dimensions.some((d) => d.Dimension__Id === selection.id);
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Snapshot Back Into the Live Record and Redraw
    // ------------------------------------------------------------
    function Na__LeHist__Apply(sheet, json) {
        const clone = JSON.parse(json);
        Na__LeHist__Restoring = true;
        try {
            Object.keys(sheet).forEach((key) => { if (!(key in clone)) delete sheet[key]; });
            Object.assign(sheet, clone);
            if (!Na__LeHist__SelectionExists(sheet, Na__LeModel__GetSelection())) Na__LeModel__SetSelection(null);
            Na__LeModel__UpdateSheet(sheet, {});                                   // <-- Normalises, marks dirty, announces a sheet update
        } finally {
            Na__LeHist__Restoring = false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Recording
// -----------------------------------------------------------------------------

    // FUNCTION | Take the Baseline for a Sheet (on entry, before any change)
    // ------------------------------------------------------------
    function Na__LeHist__Track(sheet) {
        if (!sheet) return;
        const entry = Na__LeHist__Entry(sheet.Sheet__Id);
        if (entry.current === null) entry.current = JSON.stringify(sheet);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives
    // ------------------------------------------------------------
    function Na__LeHist__OnChanged(event) {
        if (Na__LeHist__Restoring) return;
        const detail = event.detail || {};
        const reason = detail.reason || '';
        if (reason === 'loaded') { Na__LeHist__Entries.clear(); Na__LeHist__Track(Na__LeModel__GetActiveSheet()); Na__LeHist__Dispatch(null); return; }
        if (reason === 'sheet-deleted') { Na__LeHist__Entries.delete(detail.sheetId); Na__LeHist__Dispatch(null); return; }
        if (reason === 'active') { Na__LeHist__Track(Na__LeModel__GetSheetById(detail.sheetId)); Na__LeHist__Dispatch(detail.sheetId); return; }
        if (Na__LeHist__STEP_REASONS.indexOf(reason) === -1) return;
        const sheet = Na__LeModel__GetSheetById(detail.sheetId);
        if (!sheet) return;
        const entry = Na__LeHist__Entry(sheet.Sheet__Id);
        const next  = JSON.stringify(sheet);
        if (entry.current === null) { entry.current = next; return; }          // <-- First sighting: a baseline, not a step
        if (next === entry.current) return;                                     // <-- An announce that changed nothing
        entry.undo.push(entry.current);
        const max = Na__LeCfg__GetHistorySetup().maxSteps;
        while (entry.undo.length > max) entry.undo.shift();
        entry.redo.length = 0;
        entry.current = next;
        Na__LeHist__Dispatch(sheet.Sheet__Id);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Listen to the Model (once)
    // ------------------------------------------------------------
    function Na__LeHist__Initialize() {
        if (Na__LeHist__Ready) return true;
        Na__LeHist__Ready = true;
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeHist__OnChanged);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Depths for the Active Sheet
    // ------------------------------------------------------------
    function Na__LeHist__CanUndo() { const s = Na__LeModel__GetActiveSheet(); const e = s ? Na__LeHist__Entries.get(s.Sheet__Id) : null; return !!(e && e.undo.length); }
    function Na__LeHist__CanRedo() { const s = Na__LeModel__GetActiveSheet(); const e = s ? Na__LeHist__Entries.get(s.Sheet__Id) : null; return !!(e && e.redo.length); }
    // ------------------------------------------------------------


    // FUNCTION | Step Back
    // ------------------------------------------------------------
    function Na__LeHist__Undo() {
        const sheet = Na__LeModel__GetActiveSheet();
        const entry = sheet ? Na__LeHist__Entries.get(sheet.Sheet__Id) : null;
        if (!entry || !entry.undo.length) return false;
        const snapshot = entry.undo.pop();
        entry.redo.push(entry.current);
        entry.current = snapshot;
        Na__LeHist__Apply(sheet, snapshot);
        Na__LeHist__Dispatch(sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Forward Again
    // ------------------------------------------------------------
    function Na__LeHist__Redo() {
        const sheet = Na__LeModel__GetActiveSheet();
        const entry = sheet ? Na__LeHist__Entries.get(sheet.Sheet__Id) : null;
        if (!entry || !entry.redo.length) return false;
        const snapshot = entry.redo.pop();
        entry.undo.push(entry.current);
        entry.current = snapshot;
        Na__LeHist__Apply(sheet, snapshot);
        Na__LeHist__Dispatch(sheet.Sheet__Id);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor History API
    // ------------------------------------------------------------
    export {
        Na__LeHist__CHANGED_EVENT,
        Na__LeHist__Initialize,
        Na__LeHist__Track,
        Na__LeHist__CanUndo,
        Na__LeHist__CanRedo,
        Na__LeHist__Undo,
        Na__LeHist__Redo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
