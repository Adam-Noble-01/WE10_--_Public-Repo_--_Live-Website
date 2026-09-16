// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - DRAFT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__Draft__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - Browser Draft
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep unsynced specification edits in this browser a moment after the typing pauses, and put them back on the next load
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - ONE DRAFT PER PROJECT, in localStorage, and only while something is
//   unsynced: writing a clean document removes it instead. A store that
//   refuses the write (private mode, a full store) loses only the draft.
// - WRITTEN WHEN THE EDITING PAUSES. ScheduleDraft writes once the editing has
//   paused for the configured time; FlushDraft writes at once, for the tab
//   being hidden or closed.
// - PUT BACK ON A LOAD. RestoreDraft brings unsynced edits back and keeps the
//   cloud stamp they started from, so Sync asks before replacing a cloud copy
//   someone else synced since.
// - The draft timer is this unit's own variable: nothing else uses it.
//
// INTEGRATION:
// - Imports the State and Document units, the config state and the project
//   code. Imported by the Editing unit (ScheduleDraft), the Transport unit
//   (ScheduleDraft, ClearDraft, RestoreDraft) and
//   Na__LayoutEditor__SpecData__.js (FlushDraft).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : RestoreDraft stores through the State unit's setters.
//                   Against ValeVision's unit, only the console prefix, the
//                   header and the import paths differ.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecData__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code and the Specification State and Document
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import {
        Na__LeSpec__DRAFT_PREFIX,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__K_LAST_ID,
        Na__LeSpec__Doc,
        Na__LeSpec__Status,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__BaseStamp,
        Na__LeSpec__IdFloor,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetBaseStamp,
        Na__LeSpec__SetHistory,
        Na__LeSpec__SetIdFloor,
        Na__LeSpec__Toast
    } from './Na__LayoutEditor__SpecData__State__.js';
    import { Na__LeSpec__Normalise, Na__LeSpec__ContentJson, Na__LeSpec__IsDirty } from './Na__LayoutEditor__SpecData__Document__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Draft Timer
    // ------------------------------------------------------------
    let Na__LeSpec__DraftTimer  = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Browser Draft
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Storage Key for the Open Project
    // ------------------------------------------------------------
    function Na__LeSpec__DraftKey() {
        const code = Na__LeSpec__ProjectCode || Na__DrawData__GetProjectCode();
        return code ? Na__LeSpec__DRAFT_PREFIX + code : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write, Read and Clear the Draft
    // ------------------------------------------------------------
    // A draft only exists while something is unsynced: writing a clean document
    // removes it instead.
    // ------------------------------------------------------------
    function Na__LeSpec__WriteDraft() {
        const key = Na__LeSpec__DraftKey();
        if (!key || !Na__LeSpec__Doc || !Na__LeCfg__GetSpecificationSetup().draftEnabled) return false;
        if (!Na__LeSpec__IsDirty()) { Na__LeSpec__ClearDraft(); return false; }
        try { window.localStorage.setItem(key, JSON.stringify({ savedAt : Date.now(), baseStamp : Na__LeSpec__BaseStamp, doc : Na__LeSpec__Doc })); return true; }
        catch (e) { return false; }                                                  // <-- Private mode or a full store: the draft is a courtesy
    }
    function Na__LeSpec__ReadDraft() {
        const key = Na__LeSpec__DraftKey();
        if (!key) return null;
        try {
            const raw   = window.localStorage.getItem(key);
            const draft = raw ? JSON.parse(raw) : null;
            return (draft && draft.doc && typeof draft.doc === 'object') ? draft : null;
        } catch (e) { return null; }
    }
    function Na__LeSpec__ClearDraft() {
        const key = Na__LeSpec__DraftKey();
        if (!key) return;
        try { window.localStorage.removeItem(key); } catch (e) { /* nothing to clear */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Draft Once the Editing Pauses
    // ------------------------------------------------------------
    function Na__LeSpec__ScheduleDraft() {
        if (Na__LeSpec__DraftTimer) window.clearTimeout(Na__LeSpec__DraftTimer);
        Na__LeSpec__DraftTimer = window.setTimeout(() => {
            Na__LeSpec__DraftTimer = null;
            Na__LeSpec__WriteDraft();
        }, Na__LeCfg__GetSpecificationSetup().draftDebounceMs);
    }
    function Na__LeSpec__FlushDraft() {
        if (!Na__LeSpec__DraftTimer) return false;
        window.clearTimeout(Na__LeSpec__DraftTimer);
        Na__LeSpec__DraftTimer = null;
        return Na__LeSpec__WriteDraft();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | On a Load, Put Unsynced Edits From This Browser Back
    // ------------------------------------------------------------
    // The draft remembers which cloud copy its edits started from. When that is
    // no longer the copy in the cloud, the edits still come back - they are
    // this person's work - but the cloud stamp they started from is kept, so
    // Sync asks before replacing what someone else has synced since.
    // ------------------------------------------------------------
    function Na__LeSpec__RestoreDraft() {
        if (!Na__LeCfg__GetSpecificationSetup().draftEnabled) return false;
        const draft = Na__LeSpec__ReadDraft();
        if (!draft) return false;
        const drafted = Na__LeSpec__Normalise(draft.doc);
        if (Na__LeSpec__ContentJson(drafted) === Na__LeSpec__ContentJson(Na__LeSpec__Doc)) { Na__LeSpec__ClearDraft(); return false; }
        const draftBase = (typeof draft.baseStamp === 'string') ? draft.baseStamp : null;
        const stale     = Na__LeSpec__Status === Na__LeSpec__STATUS_READY && draftBase !== Na__LeSpec__BaseStamp;
        Na__LeSpec__SetIdFloor(Math.max(Na__LeSpec__IdFloor, drafted[Na__LeSpec__K_LAST_ID], Na__LeSpec__Doc[Na__LeSpec__K_LAST_ID]));
        Na__LeSpec__SetDoc(drafted);
        Na__LeSpec__SetIndex(null);
        Na__LeSpec__SetBaseStamp(draftBase);
        Na__LeSpec__SetHistory({ undo : [], redo : [], current : JSON.stringify(drafted) });
        Na__LeSpec__Toast(stale
            ? Na__LeCfg__GetLabel('SpecDraftRestoredStale', 'Unsynced specification changes from this browser were restored, but the cloud copy has changed since they were made. Sync asks before replacing it.')
            : Na__LeCfg__GetLabel('SpecDraftRestored', 'Unsynced specification changes from this browser were restored. Sync keeps them.'), false);
        console.log('[TrueVision3D] Layout Editor: unsynced specification draft restored from this browser.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data Browser Draft
    // ------------------------------------------------------------
    export {
        Na__LeSpec__ClearDraft,
        Na__LeSpec__ScheduleDraft,
        Na__LeSpec__FlushDraft,
        Na__LeSpec__RestoreDraft
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
