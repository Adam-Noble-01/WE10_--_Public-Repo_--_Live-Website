// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - AUTO SAVE
// =============================================================================
//
// FILE       : Na__LayoutEditor__AutoSave__.js
// NAMESPACE  : Na__LeAuto
// MODULE     : Layout Editor - Auto Save
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep sheets from being lost: a browser draft of every change, and a project save of its own when a sheet is created, renamed, reordered or deleted
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - DRAFT. Every announced change writes the sheet records to localStorage
//   under the project code. On the next project load a draft that differs
//   from what the project supplied is put back, the model is marked dirty
//   and a toast says so. A successful save clears the draft, so a draft only
//   ever exists while something is unsaved.
// - AUTO SAVE. A structural change (a sheet created, renamed, reordered or
//   deleted, or its paper or title block changed) schedules a project save
//   a short debounce later, on localhost only (the web build is read-only).
//   Content edits (viewports, text, dimensions) stay with the Save Sheets
//   button and the draft, so a drag session never writes the project
//   between moves.
// - The save path is the one Save Sheets uses: Na__LeModel__Save through
//   Na__DrawView__ProjectData__. Only a failure shows a toast; a save that
//   worked clears the Save button's attention state through the model.
//
// INTEGRATION:
// - Initialised by the mode controller with the app toast and the editable
//   flag; listens to the sheet model and to the drawings data events.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__AutoSave__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Sheet Model, Drawings Data
    // ------------------------------------------------------------
    import { Na__LeCfg__GetAutoSaveSetup, Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetSheets,
        Na__LeModel__RestoreSheets,
        Na__LeModel__IsDirty,
        Na__LeModel__Save
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__DrawData__CHANGED_EVENT, Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage Key and the Reasons That Matter
    // ------------------------------------------------------------
    const Na__LeAuto__DRAFT_PREFIX = 'Na__LayoutEditor__Draft__';
    const Na__LeAuto__STRUCTURAL   = [ 'sheet-created', 'sheet-deleted', 'sheet-updated', 'sheet-reordered' ];
    const Na__LeAuto__IGNORED      = [ 'loaded', 'saved', 'active', 'selection' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Timer, In-Flight Save and Guards
    // ------------------------------------------------------------
    let Na__LeAuto__ShowToast = null;
    let Na__LeAuto__Editable  = false;
    let Na__LeAuto__Timer     = null;
    let Na__LeAuto__Saving    = false;
    let Na__LeAuto__Again     = false;     // <-- A structural change arrived while a save was in flight
    let Na__LeAuto__Restoring = false;
    let Na__LeAuto__Ready     = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Browser Draft
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Storage Key for the Open Project
    // ------------------------------------------------------------
    function Na__LeAuto__Key() {
        const code = Na__DrawData__GetProjectCode();
        return code ? Na__LeAuto__DRAFT_PREFIX + code : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Two Sheet Lists Hold the Same Records
    // ------------------------------------------------------------
    function Na__LeAuto__Same(a, b) {
        try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write, Read and Clear the Draft
    // ------------------------------------------------------------
    function Na__LeAuto__WriteDraft() {
        const key = Na__LeAuto__Key();
        if (!key || !Na__LeCfg__GetAutoSaveSetup().draftEnabled) return false;
        try { window.localStorage.setItem(key, JSON.stringify({ savedAt : Date.now(), sheets : Na__LeModel__GetSheets() })); return true; }
        catch (e) { return false; }                                              // <-- Private mode or a full store: the draft is a courtesy
    }
    function Na__LeAuto__ReadDraft() {
        const key = Na__LeAuto__Key();
        if (!key) return null;
        try {
            const raw = window.localStorage.getItem(key);
            const draft = raw ? JSON.parse(raw) : null;
            return (draft && Array.isArray(draft.sheets)) ? draft : null;
        } catch (e) { return null; }
    }
    function Na__LeAuto__ClearDraft() {
        const key = Na__LeAuto__Key();
        if (!key) return;
        try { window.localStorage.removeItem(key); } catch (e) { /* nothing to clear */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | On a Project Load, Put an Unsaved Draft Back
    // ------------------------------------------------------------
    function Na__LeAuto__RestoreDraft() {
        if (Na__LeAuto__Restoring || !Na__LeCfg__GetAutoSaveSetup().draftEnabled) return false;
        const draft = Na__LeAuto__ReadDraft();
        if (!draft || Na__LeAuto__Same(draft.sheets, Na__LeModel__GetSheets())) return false;
        Na__LeAuto__Restoring = true;
        try { Na__LeModel__RestoreSheets(draft.sheets); }
        finally { Na__LeAuto__Restoring = false; }
        if (typeof Na__LeAuto__ShowToast === 'function') Na__LeAuto__ShowToast(Na__LeCfg__GetLabel('DraftRestored', 'Unsaved sheet changes from this browser were restored. Save Sheets keeps them.'), false);
        console.log('[TrueVision3D] Layout Editor: unsaved sheet draft restored from this browser.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Automatic Project Save
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Save Now, Once, and Again if Something Arrived Meanwhile
    // ------------------------------------------------------------
    async function Na__LeAuto__Run() {
        Na__LeAuto__Timer = null;
        if (Na__LeAuto__Saving) { Na__LeAuto__Again = true; return; }
        if (!Na__LeModel__IsDirty()) return;
        Na__LeAuto__Saving = true;
        try {
            await Na__LeModel__Save((message, isError) => { if (isError && typeof Na__LeAuto__ShowToast === 'function') Na__LeAuto__ShowToast(message, true); });
        } finally {
            Na__LeAuto__Saving = false;
            if (Na__LeAuto__Again) { Na__LeAuto__Again = false; Na__LeAuto__Schedule(); }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Schedule a Save a Debounce After the Last Structural Change
    // ------------------------------------------------------------
    function Na__LeAuto__Schedule() {
        if (Na__LeAuto__Timer) window.clearTimeout(Na__LeAuto__Timer);
        Na__LeAuto__Timer = window.setTimeout(() => { void Na__LeAuto__Run(); }, Na__LeCfg__GetAutoSaveSetup().debounceMs);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives
    // ------------------------------------------------------------
    function Na__LeAuto__OnModelChanged(event) {
        const reason = (event.detail && event.detail.reason) || '';
        if (reason === 'loaded') { Na__LeAuto__RestoreDraft(); return; }
        if (Na__LeAuto__IGNORED.indexOf(reason) >= 0) return;
        Na__LeAuto__WriteDraft();
        if (Na__LeAuto__Editable && Na__LeCfg__GetAutoSaveSetup().enabled && Na__LeAuto__STRUCTURAL.indexOf(reason) >= 0) Na__LeAuto__Schedule();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Save Landed: the Draft Has Nothing Left to Protect
    // ------------------------------------------------------------
    function Na__LeAuto__OnDrawingsData(event) {
        const reason = (event.detail && event.detail.reason) || '';
        if (reason !== 'saved') return;
        const draft = Na__LeAuto__ReadDraft();
        if (draft && Na__LeAuto__Same(draft.sheets, Na__LeModel__GetSheets())) Na__LeAuto__ClearDraft();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Listen to the Model and the Drawings Data (once)
    // ------------------------------------------------------------
    // options: { showToast, editable }
    // ------------------------------------------------------------
    function Na__LeAuto__Initialize(options) {
        Na__LeAuto__ShowToast = (options && options.showToast) || null;
        Na__LeAuto__Editable  = !!(options && options.editable);
        if (Na__LeAuto__Ready) return true;
        Na__LeAuto__Ready = true;
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeAuto__OnModelChanged);
        window.addEventListener(Na__DrawData__CHANGED_EVENT, Na__LeAuto__OnDrawingsData);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Now if a Save Is Pending
    // ------------------------------------------------------------
    function Na__LeAuto__Flush() {
        if (!Na__LeAuto__Timer) return false;
        window.clearTimeout(Na__LeAuto__Timer);
        Na__LeAuto__Timer = null;
        void Na__LeAuto__Run();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Auto Save API
    // ------------------------------------------------------------
    export {
        Na__LeAuto__Initialize,
        Na__LeAuto__Flush
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
