// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the project specification: its groups and notes, the codes their order gives them, its undo, the browser draft, the local drawing-notes file and its file on R2
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - THE DOCUMENT. A project's drawing notes, in groups. A group has a prefix
//   (GN, SN, EE), a title and a general flag; a note has a title and its
//   specification text. No code is stored as the truth: a note's code is its
//   group's prefix and its place in the group, zero-padded to NumberDigits
//   (GN01, EE02), worked out from the order every time. Moving a note up or
//   down, moving it to another group or changing a prefix renumbers it, and
//   nobody manages codes by hand. Note__Code is still written into the file
//   for anything that reads it later - a design and access statement, say -
//   but it is recomputed on every load and never read back.
// - STABLE IDS. Specification bubbles on the sheets link to a note by its
//   Note__Id (Na__LayoutEditor__SpecLinks__), so a renumber reaches every one
//   of them. Ids come from a counter kept in the file that only goes up: a
//   note deleted and a new one added can never share an id, which would
//   otherwise quietly hand a bubble still linked to the old note the new one.
// - ITS OWN FILE, READ ONLY WHEN THE DRAWING EDITOR OPENS. It lives beside
//   TrueVision__ProjectData__.json as TrueVision__DrawingNotes__.json, and
//   EnsureLoaded is first called on entry to the editor, so a long specification
//   costs nothing to a visitor who only orbits the model. Where it is read from:
//     localhost, or authoring unlocked   R2 through the Worker (fresh). A local
//                                        repository copy is always kept in sync
//                                        so an agent can edit it on disk. The
//                                        previous R2 name is read only when the
//                                        new file is not there yet.
//     the web build                      the public CDN copy
//   A copy that could not be READ is not a copy that is not there. The first
//   leaves the specification 'failed': edits are kept in this browser but Sync
//   refuses until the cloud copy can be read, so an unreachable Worker can
//   never let an empty specification overwrite a real one.
// - KEPT LOCALLY AT ONCE, SYNCED ON REQUEST. Every change writes a browser
//   draft a moment after the typing pauses, and when the tab is hidden or
//   closed. A load that finds a draft different from the file puts the draft
//   back and says so. Sync writes the whole file to R2 and to the local
//   TrueVision__DrawingNotes__.json, and asks first when the cloud copy changed
//   after this browser read it. A local file whose UpdatedIso is newer than R2
//   is adopted as the live document so an on-disk edit reaches the editor.
// - UNDO. The tab keeps its own history of whole-document snapshots, one step
//   per committed change. Typing into a title or a body is live - no step -
//   and the field's commit is the one step for everything typed into it.
// - One event announces every change, with its reason and whether any note's
//   code moved, so the sheets only re-stamp their bubbles when a code did.
// - THE UNITS. This file is what every other module imports: it hands in the
//   editable flag and the toast, listens for the tab closing and for another
//   project, and exports the whole API. The work itself is split across five
//   units beside it (15-Sep-2026, to stay under the line budget):
//     Na__LayoutEditor__SpecData__State__.js       the constants, the shared
//                                                  state and its setters, and
//                                                  the helpers every unit uses
//     Na__LayoutEditor__SpecData__Document__.js    normalisation, codes, the
//                                                  index and every read
//     Na__LayoutEditor__SpecData__Editing__.js     every change to groups and
//                                                  notes, and undo and redo
//     Na__LayoutEditor__SpecData__Draft__.js       the browser draft
//     Na__LayoutEditor__SpecData__Transport__.js   load, retry and sync, the
//                                                  unit that differs most
//                                                  between the two apps
//   The shared state is declared only in the State unit. The other units read
//   it through their imports, which always show its current value, and change
//   it through the State unit's setters.
//
// INTEGRATION:
// - Initialised by the mode controller; loaded on the first entry into the
//   editor. Read by Na__LayoutEditor__SpecLinks__, __SpecMargin__,
//   __SpecEditor__, __Panel__Leaders__ and __Panel__MarginNotes__.
// - OPEN_EVENT and GOTO_EVENT are requests the mode controller answers (show
//   the tab; show a sheet with a bubble selected), declared in the State unit
//   and exported here so the modules that raise them need not import the mode
//   controller.
// - Import the specification data from this file, never from a unit: its
//   export list is the API, and every module that reads the specification
//   imports this file by name. The units import one way only (State, then
//   Document, then Draft, then Editing and Transport); this file imports all
//   five, and no unit imports it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. The Transport region is the one part to
//                   adapt: ValeVision writes to its own bucket by its own path.
// - Split         : 15-Sep-2026, into the five units above, the same split as
//                   ValeVision3D v2.47.0 (SpecData 1.2.0).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.3.0
// - Re-exports the Transport unit's new ReloadFromCloud, ReloadFromLocal,
//   CanReloadCloud and CanReloadLocal (Transport 1.1.0).
//
// 15-Sep-2026 - Version 1.2.0
// - Split into Na__LayoutEditor__SpecData__State__.js,
//   Na__LayoutEditor__SpecData__Document__.js,
//   Na__LayoutEditor__SpecData__Editing__.js,
//   Na__LayoutEditor__SpecData__Draft__.js and
//   Na__LayoutEditor__SpecData__Transport__.js to stay under the line budget.
//   No behaviour change: the code moved verbatim and every export is
//   unchanged.
// - The shared state moved to the State unit with one setter per variable.
//   Moved code that assigned a shared variable now calls its setter, the only
//   change inside any function. The draft timer went to the Draft unit and the
//   initialised flag stayed here, each with the only code that uses it.
// - The same split as ValeVision3D v2.47.0 (SpecData 1.2.0): each unit holds
//   the same functions as ValeVision's, so a change ports file for file.
//   TrueVision's own UsesWorker and FetchJson went to the Transport unit, and
//   the Document unit imports the Cloudflare API client for GetState.
//
// 14-Sep-2026 - Version 1.1.0
// - Canonical file TrueVision__DrawingNotes__.json, kept locally beside the
//   project data and written to the same R2 key on Sync. The previous R2 name
//   is still read when the new file is absent. A newer local UpdatedIso is
//   adopted so an on-disk edit reaches the editor.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Specification Data Units and the Project Data Event
    // ------------------------------------------------------------
    import {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__OPEN_EVENT,
        Na__LeSpec__GOTO_EVENT,
        Na__LeSpec__STATUS_IDLE,
        Na__LeSpec__STATUS_LOADING,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__LoadPromise,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetStatus,
        Na__LeSpec__SetLoadPromise,
        Na__LeSpec__SetIdFloor,
        Na__LeSpec__SetEditable,
        Na__LeSpec__SetShowToast,
        Na__LeSpec__Dispatch
    } from './Na__LayoutEditor__SpecData__State__.js';
    import {
        Na__LeSpec__Normalise,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__CodeFor,
        Na__LeSpec__ParseCode,
        Na__LeSpec__FindByCode,
        Na__LeSpec__NormaliseCode,
        Na__LeSpec__PrefixClashes,
        Na__LeSpec__ValidatePrefix,
        Na__LeSpec__NumberDigits,
        Na__LeSpec__GetState,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty,
        Na__LeSpec__IsEditable,
        Na__LeSpec__GetDocument,
        Na__LeSpec__GetRevision,
        Na__LeSpec__GetDocumentNumber
    } from './Na__LayoutEditor__SpecData__Document__.js';
    import { Na__LeSpec__FlushDraft } from './Na__LayoutEditor__SpecData__Draft__.js';
    import {
        Na__LeSpec__AddGroup,
        Na__LeSpec__AddStarterGroups,
        Na__LeSpec__SetRevision,
        Na__LeSpec__SetDocumentNumber,
        Na__LeSpec__UpdateGroup,
        Na__LeSpec__DeleteGroup,
        Na__LeSpec__MoveGroup,
        Na__LeSpec__AddNote,
        Na__LeSpec__UpdateNote,
        Na__LeSpec__DeleteNote,
        Na__LeSpec__MoveNote,
        Na__LeSpec__CanUndo,
        Na__LeSpec__CanRedo,
        Na__LeSpec__Undo,
        Na__LeSpec__Redo
    } from './Na__LayoutEditor__SpecData__Editing__.js';
    import {
        Na__LeSpec__EnsureLoaded,
        Na__LeSpec__Retry,
        Na__LeSpec__Sync,
        Na__LeSpec__CanReloadCloud,
        Na__LeSpec__CanReloadLocal,
        Na__LeSpec__ReloadFromCloud,
        Na__LeSpec__ReloadFromLocal
    } from './Na__LayoutEditor__SpecData__Transport__.js';
    import { Na__DrawData__CHANGED_EVENT } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Initialisation
    // ------------------------------------------------------------
    let Na__LeSpec__Initialised = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Hand In the Editable Flag and the Toast; Listen Once
    // ------------------------------------------------------------
    // options: { editable, showToast }
    // ------------------------------------------------------------
    function Na__LeSpec__Initialize(options) {
        Na__LeSpec__SetEditable(!!(options && options.editable));
        Na__LeSpec__SetShowToast((options && options.showToast) || null);
        if (Na__LeSpec__Initialised) return true;
        Na__LeSpec__Initialised = true;
        window.addEventListener('pagehide', () => Na__LeSpec__FlushDraft());               // <-- Closing the tab keeps the last edit
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Na__LeSpec__FlushDraft(); });
        window.addEventListener(Na__DrawData__CHANGED_EVENT, (event) => {
            const detail = event.detail || {};
            if (detail.reason !== 'loaded' || !Na__LeSpec__LoadPromise || detail.projectCode === Na__LeSpec__ProjectCode) return;
            Na__LeSpec__FlushDraft();                                                     // <-- A different project: the next entry loads its own
            Na__LeSpec__SetDoc(null); Na__LeSpec__SetIndex(null); Na__LeSpec__SetLoadPromise(null); Na__LeSpec__SetIdFloor(0);
            Na__LeSpec__SetStatus(Na__LeSpec__STATUS_IDLE);
            Na__LeSpec__Dispatch('loaded', { codesChanged : true });
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Data API
    // ------------------------------------------------------------
    export {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__OPEN_EVENT,
        Na__LeSpec__GOTO_EVENT,
        Na__LeSpec__STATUS_IDLE,
        Na__LeSpec__STATUS_LOADING,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__Initialize,
        Na__LeSpec__EnsureLoaded,
        Na__LeSpec__Retry,
        Na__LeSpec__Sync,
        Na__LeSpec__CanReloadCloud,
        Na__LeSpec__CanReloadLocal,
        Na__LeSpec__ReloadFromCloud,
        Na__LeSpec__ReloadFromLocal,
        Na__LeSpec__FlushDraft,
        Na__LeSpec__GetState,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty,
        Na__LeSpec__IsEditable,
        Na__LeSpec__GetDocument,
        Na__LeSpec__GetRevision,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__CodeFor,
        Na__LeSpec__ParseCode,
        Na__LeSpec__FindByCode,
        Na__LeSpec__NormaliseCode,
        Na__LeSpec__PrefixClashes,
        Na__LeSpec__ValidatePrefix,
        Na__LeSpec__NumberDigits,
        Na__LeSpec__Normalise,
        Na__LeSpec__AddGroup,
        Na__LeSpec__AddStarterGroups,
        Na__LeSpec__SetRevision,
        Na__LeSpec__SetDocumentNumber,
        Na__LeSpec__UpdateGroup,
        Na__LeSpec__DeleteGroup,
        Na__LeSpec__MoveGroup,
        Na__LeSpec__AddNote,
        Na__LeSpec__UpdateNote,
        Na__LeSpec__DeleteNote,
        Na__LeSpec__MoveNote,
        Na__LeSpec__CanUndo,
        Na__LeSpec__CanRedo,
        Na__LeSpec__Undo,
        Na__LeSpec__Redo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
