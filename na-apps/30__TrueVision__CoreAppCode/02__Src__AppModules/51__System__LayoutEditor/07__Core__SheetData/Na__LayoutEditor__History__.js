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
//   configured depth, each with the reason its change was announced with.
//   Undo puts the previous snapshot back into the same record object (the
//   surface and panels hold that object), then announces a sheet update so
//   everything redraws. Selected items that no longer exist leave the
//   selection; the rest stay selected.
// - THE ANNOUNCEMENT SAYS IT IS A RESTORE, and which step it reverses
//   (Na__LeModel__AnnounceRestore). It used to go out as a plain sheet
//   update, which the auto save reads as a sheet-settings change - so every
//   undo and redo, of anything, wrote the whole project to R2. An undo is
//   now saved the way the step it reverses was saved: undoing a rename or a
//   paper change saves, undoing a vector, a text move or a viewport drag
//   stays with the browser draft and Save Sheets, as the edit itself did.
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
// 21-Sep-2026 - Version 1.7.0
// - 'areas' counts as a step: a floor area's name, the group it is filed
//   under, and the sheet's own list of groups. An unlisted reason is not
//   merely un-undoable - it leaves the baseline stale, so the NEXT step
//   snapshots the change as part of itself and one Ctrl+Z throws both away.
//
// 19-Sep-2026 - Version 1.6.0
// - Status joins the fields a register save writes into every kept step. The
//   Drawing Register saves a drawing's status to R2 there and then, so a step
//   recorded before that save must not carry the older one back on an undo.
//
// 14-Sep-2026 - Version 1.5.0
// - Grouping is a step ('groups'): Ctrl+G, Ctrl+Shift+G, and a paste of a
//   group. A selected group survives an undo that leaves it on the sheet.
//
// 14-Sep-2026 - Version 1.4.0
// - A notes margin change ('margin': switched, widened, restyled) is a step.
//
// 14-Sep-2026 - Version 1.3.0
// - A restore keeps every selected item that still exists and drops the rest,
//   now that the selection can hold several (Na__LeModel__GetSelectionItems).
//
// 19-Sep-2026 - Version 1.3.0
// - Common title block fields. A step now carries the pack's client and site
//   address beside the sheet snapshot, and the "changed nothing" test reads
//   both: those two values live on the drawings block, so retyping the client
//   on a sheet that is on Common changes not one byte of the sheet record.
//   Apply takes the step rather than its json, and puts them back.
//
// 14-Sep-2026 - Version 1.2.0
// - Leader changes are steps ('leaders' and 'leader'), and a selected leader
//   survives an undo that leaves it on the sheet.
//
// 13-Sep-2026 - Version 1.1.0
// - Each step keeps the reason its change was announced with, and Undo and
//   Redo pass { direction, stepReason } to Na__LeModel__AnnounceRestore
//   instead of calling UpdateSheet. Undo no longer writes the project to R2
//   unless the step it reverses was a structural one.
// - Any announcement that carries a restore is ignored, as well as everything
//   during Apply, so the history can never record its own restores.
// - A selected vector survives an undo that leaves it in place: the selection
//   test had no case for shapes, so every undo dropped it.
//
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
    import { Na__LeCfg__GetHistorySetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__AnnounceRestore,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelectionItems
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCommon__Get, Na__LeCommon__Set, Na__LeCommon__KEYS } from './Na__LayoutEditor__SheetModel__Common__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event and the Reasons That Count as a Step
    // ------------------------------------------------------------
    const Na__LeHist__CHANGED_EVENT = 'na-layouteditor-history-changed';
    const Na__LeHist__STEP_REASONS  = [ 'sheet-updated', 'fields', 'layers', 'viewports', 'viewport', 'annotations', 'annotation', 'dimensions', 'dimension', 'shapes', 'shape', 'leaders', 'leader', 'margin', 'groups', 'areas' ];   // <-- 'areas': a floor area's name, its group, and the sheet's group list
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per-Sheet Stacks
    // ------------------------------------------------------------
    const Na__LeHist__Entries   = new Map();   // <-- sheetId -> { undo : [step], redo : [step], current : step|null }, step = { json, reason }
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
        if (selection.kind === 'shape')      return (sheet.Sheet__Shapes || []).some((s) => s.Shape__Id === selection.id);
        if (selection.kind === 'leader')     return (sheet.Sheet__Leaders || []).some((l) => l.Leader__Id === selection.id);
        if (selection.kind === 'group')      return (sheet.Sheet__Groups || []).some((g) => g.Group__Id === selection.id);
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Snapshot Back Into the Live Record and Redraw
    // ------------------------------------------------------------
    // restore: { direction : 'undo' | 'redo', stepReason } - rides on the
    // announcement so the auto save can tell an undo of a rename from an
    // undo of a vector delete. Both redraw alike; only one saves.
    // ------------------------------------------------------------
    function Na__LeHist__Apply(sheet, step, restore) {
        const clone = JSON.parse(step.json);
        Na__LeHist__Restoring = true;
        try {
            Object.keys(sheet).forEach((key) => { if (!(key in clone)) delete sheet[key]; });
            Object.assign(sheet, clone);
            // THE PACK'S CLIENT AND SITE ADDRESS live on the drawings block, not
            // on the sheet, so the sheet snapshot alone cannot put them back.
            // Restored before the announcement, so the one redraw that follows
            // shows the whole step rather than half of it.
            if (step.common) Na__LeCommon__KEYS.forEach((key) => Na__LeCommon__Set(key, step.common[key]));
            const selected = Na__LeModel__GetSelectionItems();
            const kept     = selected.filter((item) => Na__LeHist__SelectionExists(sheet, item));
            if (kept.length !== selected.length) Na__LeModel__SetSelectionItems(kept);
            Na__LeModel__AnnounceRestore(sheet, restore);                          // <-- Normalises, marks dirty, announces a sheet update that says it is a restore
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
        if (entry.current === null) entry.current = { json : JSON.stringify(sheet), common : Na__LeCommon__Get(), reason : null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives
    // ------------------------------------------------------------
    function Na__LeHist__OnChanged(event) {
        if (Na__LeHist__Restoring) return;
        const detail = event.detail || {};
        if (detail.restore) return;                                             // <-- An undo or redo, however it arrived: never a new step
        const reason = detail.reason || '';
        if (reason === 'register-updated') {
            Na__LeHist__Entries.forEach((entry, id) => {
                const sheet = Na__LeModel__GetSheetById(id);
                if (!sheet) return;
                [ ...entry.undo, ...entry.redo, entry.current ].filter(Boolean).forEach((step) => {
                    const snapshot = JSON.parse(step.json);
                    snapshot.Sheet__Name = sheet.Sheet__Name;
                    snapshot.Sheet__Order = sheet.Sheet__Order;
                    snapshot.Sheet__Fields = snapshot.Sheet__Fields || {};
                    [ 'Title', 'DrawingNumber', 'Phase', 'DocumentId', 'Revision', 'Status' ].forEach((key) => {   // <-- Everything the register saves. Status joined it on 19-Sep-2026: left out, an undo of any older step would have put back the status the register had just replaced on R2
                        const field = 'Sheet__Fields__' + key;
                        if (sheet.Sheet__Fields && sheet.Sheet__Fields[field] !== undefined) snapshot.Sheet__Fields[field] = sheet.Sheet__Fields[field];
                        else delete snapshot.Sheet__Fields[field];
                    });
                    step.json = JSON.stringify(snapshot);
                });
            });
            return;
        }
        if (reason === 'loaded') { Na__LeHist__Entries.clear(); Na__LeHist__Track(Na__LeModel__GetActiveSheet()); Na__LeHist__Dispatch(null); return; }
        if (reason === 'sheet-deleted') { Na__LeHist__Entries.delete(detail.sheetId); Na__LeHist__Dispatch(null); return; }
        if (reason === 'active') { Na__LeHist__Track(Na__LeModel__GetSheetById(detail.sheetId)); Na__LeHist__Dispatch(detail.sheetId); return; }
        if (Na__LeHist__STEP_REASONS.indexOf(reason) === -1) return;
        const sheet = Na__LeModel__GetSheetById(detail.sheetId);
        if (!sheet) return;
        const entry = Na__LeHist__Entry(sheet.Sheet__Id);
        const next       = JSON.stringify(sheet);
        const nextCommon = Na__LeCommon__Get();
        if (entry.current === null) { entry.current = { json : next, common : nextCommon, reason : null }; return; }   // <-- First sighting: a baseline, not a step
        // BOTH HALVES, because retyping the client on a sheet that is on Common
        // changes the pack and not one byte of the sheet. Reading the sheet
        // alone called that "an announce that changed nothing", recorded no
        // step, and left Ctrl+Z to reach past it to an older, unrelated one.
        const commonSame = Na__LeCommon__KEYS.every((key) => nextCommon[key] === (entry.current.common || {})[key]);
        if (next === entry.current.json && commonSame) return;                  // <-- An announce that changed nothing
        entry.undo.push(entry.current);
        const max = Na__LeCfg__GetHistorySetup().maxSteps;
        while (entry.undo.length > max) entry.undo.shift();
        entry.redo.length = 0;
        entry.current = { json : next, common : nextCommon, reason : reason };   // <-- The reason goes with the step, so undoing it is saved the way it was
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
        const undone   = entry.current;                                         // <-- The step being reversed is the one that made the current state
        const snapshot = entry.undo.pop();
        entry.redo.push(undone);
        entry.current = snapshot;
        Na__LeHist__Apply(sheet, snapshot, { direction : 'undo', stepReason : undone.reason });
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
        const snapshot = entry.redo.pop();                                      // <-- The step being replayed is the one that made this snapshot
        entry.undo.push(entry.current);
        entry.current = snapshot;
        Na__LeHist__Apply(sheet, snapshot, { direction : 'redo', stepReason : snapshot.reason });
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
