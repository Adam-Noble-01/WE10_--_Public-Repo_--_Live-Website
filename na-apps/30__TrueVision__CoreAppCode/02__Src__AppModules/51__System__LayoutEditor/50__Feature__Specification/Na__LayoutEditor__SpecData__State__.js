// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__State__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The specification's constants and live state, the setters the other units change that state through, and the small helpers they all share
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - THE ONE HOME OF THE SHARED STATE. The live document, its index, the load
//   and sync lifecycle, the cloud stamp, the undo history, the id floor, and
//   the editable flag and toast the editor hands in are declared here and
//   nowhere else. The other units import them to read them: an imported
//   binding always shows the current value.
// - SETTERS, BECAUSE AN IMPORT CANNOT BE ASSIGNED. A unit that changes one of
//   these variables calls its setter (Na__LeSpec__SetDoc and the rest): one
//   per variable, each a plain assignment. A setter call where the code used
//   to assign is the only change the split made inside a moved function.
// - TWO VARIABLES STAYED WITH THEIR ONLY USER: the draft timer is in
//   Na__LayoutEditor__SpecData__Draft__ and the initialised flag in
//   Na__LayoutEditor__SpecData__.js.
// - The constants: the three events, the draft key prefix, the file version,
//   the load statuses, and the document keys and description the file is
//   written with.
// - The helpers every unit shares: announce a change, show a toast, clean a
//   prefix, read the number at the end of an id, issue the next id above the
//   floor, and make a code from a prefix and a place.
//
// INTEGRATION:
// - Imports only the config state, so it sits at the bottom of the
//   specification data's imports. Imported by the Document, Editing, Draft and
//   Transport units and by Na__LayoutEditor__SpecData__.js, which exports the
//   events and the statuses.
// - Other modules import from Na__LayoutEditor__SpecData__.js, never from here.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : the setters are new. Against ValeVision's unit, only the
//                   document description (it names TrueVision), the header and
//                   the import path differ.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - LOCATE_EVENT: a request to show a note in the drawing editor's own
//   Specification tab (the left column), scrolled to and pulsing. Raised by
//   a specification bubble's right-click menu on the sheet, answered by
//   Na__LayoutEditor__Panel__ScrapbookSpecification__ - declared here with
//   OPEN_EVENT and GOTO_EVENT so neither has to import the other.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecData__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Events, Storage and Status
    // ------------------------------------------------------------
    const Na__LeSpec__CHANGED_EVENT = 'na-layouteditor-spec-changed';   // <-- detail { reason, codesChanged, live, noteId, groupId }
    const Na__LeSpec__OPEN_EVENT    = 'na-layouteditor-spec-open';      // <-- detail { noteId } : show the Project Specification tab
    const Na__LeSpec__GOTO_EVENT    = 'na-layouteditor-spec-goto';      // <-- detail { sheetId, leaderId } : show a sheet with a bubble selected
    const Na__LeSpec__LOCATE_EVENT  = 'na-layouteditor-spec-locate';    // <-- detail { noteId, leaderId } : show a note in the drawing's own Specification tab, scrolled to and pulsing
    const Na__LeSpec__DRAFT_PREFIX  = 'Na__LayoutEditor__SpecDraft__';
    const Na__LeSpec__VERSION       = 1;
    const Na__LeSpec__STATUS_IDLE    = 'idle';      // <-- Not asked for yet
    const Na__LeSpec__STATUS_LOADING = 'loading';
    const Na__LeSpec__STATUS_READY   = 'ready';     // <-- A copy was read
    const Na__LeSpec__STATUS_NEW     = 'new';       // <-- Confirmed absent: this project has no specification yet
    const Na__LeSpec__STATUS_FAILED  = 'failed';    // <-- Could not be read: edits stay in the browser, Sync refuses
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Document Keys (three-stage, like every project record)
    // ------------------------------------------------------------
    const Na__LeSpec__K_DESCRIPTION = 'ProjectSpecification__Description';
    const Na__LeSpec__K_VERSION     = 'ProjectSpecification__Version';
    const Na__LeSpec__K_PROJECT     = 'ProjectSpecification__ProjectCode';
    const Na__LeSpec__K_UPDATED     = 'ProjectSpecification__UpdatedIso';
    const Na__LeSpec__K_DIGITS      = 'ProjectSpecification__NumberDigits';
    const Na__LeSpec__K_LAST_ID     = 'ProjectSpecification__LastIdNumber';
    const Na__LeSpec__K_GROUPS      = 'ProjectSpecification__Groups';
    const Na__LeSpec__K_REVISION    = 'ProjectSpecification__Revision';           // <-- The issued revision, printed on the document and in the file name
    const Na__LeSpec__K_DOCNUMBER   = 'ProjectSpecification__DocumentNumber';     // <-- The document's own number, the way each sheet carries a Drawing No.
    const Na__LeSpec__DESCRIPTION   = 'Project specification notes for the TrueVision drawings. Groups hold notes in order; a note’s code is its group’s prefix and its place in the group (GN01, EE02), so the order is the truth and Note__Code is written for readers and recomputed on every load. Specification bubbles on the Layout Editor sheets link to notes by Note__Id. General groups are listed on every sheet’s notes margin, after the notes that sheet’s bubbles link to. LastIdNumber only ever goes up, so no id is used twice.';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Live Document and Its Lifecycle
    // ------------------------------------------------------------
    let Na__LeSpec__Doc         = null;     // <-- Normalised live document; null until loaded
    let Na__LeSpec__Index       = null;     // <-- { list, byId, byCode }, rebuilt after any change
    let Na__LeSpec__Status      = Na__LeSpec__STATUS_IDLE;
    let Na__LeSpec__Source      = null;     // <-- 'cloud' | 'repository' | 'cdn' | null
    let Na__LeSpec__Error       = null;
    let Na__LeSpec__ProjectCode = null;
    let Na__LeSpec__LoadPromise = null;
    let Na__LeSpec__BaseStamp   = null;     // <-- UpdatedIso of the cloud copy these edits start from; null when the cloud had none
    let Na__LeSpec__SyncedJson  = null;     // <-- The groups as last read or written, so an undo back to them is not "unsynced"
    let Na__LeSpec__CodeSig     = '';       // <-- Every note's id and code, to tell whether a change moved a code
    let Na__LeSpec__Syncing     = false;
    let Na__LeSpec__LastSyncIso = null;
    let Na__LeSpec__History     = { undo : [], redo : [], current : null };   // <-- current is the JSON of the last committed state
    let Na__LeSpec__IdFloor     = 0;        // <-- The highest id number ever issued or seen for this project, whatever undo puts back
    let Na__LeSpec__Editable    = false;
    let Na__LeSpec__ShowToast   = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State Setters
// -----------------------------------------------------------------------------

    // FUNCTION | Change a Shared Variable (an imported binding cannot be assigned)
    // ------------------------------------------------------------
    // One setter per variable, each a plain assignment. A unit that used to
    // assign a variable calls its setter instead; reading needs no getter,
    // because an import always shows the current value.
    // ------------------------------------------------------------
    function Na__LeSpec__SetDoc(value)         { Na__LeSpec__Doc         = value; }
    function Na__LeSpec__SetIndex(value)       { Na__LeSpec__Index       = value; }
    function Na__LeSpec__SetStatus(value)      { Na__LeSpec__Status      = value; }
    function Na__LeSpec__SetSource(value)      { Na__LeSpec__Source      = value; }
    function Na__LeSpec__SetError(value)       { Na__LeSpec__Error       = value; }
    function Na__LeSpec__SetProjectCode(value) { Na__LeSpec__ProjectCode = value; }
    function Na__LeSpec__SetLoadPromise(value) { Na__LeSpec__LoadPromise = value; }
    function Na__LeSpec__SetBaseStamp(value)   { Na__LeSpec__BaseStamp   = value; }
    function Na__LeSpec__SetSyncedJson(value)  { Na__LeSpec__SyncedJson  = value; }
    function Na__LeSpec__SetCodeSig(value)     { Na__LeSpec__CodeSig     = value; }
    function Na__LeSpec__SetSyncing(value)     { Na__LeSpec__Syncing     = value; }
    function Na__LeSpec__SetLastSyncIso(value) { Na__LeSpec__LastSyncIso = value; }
    function Na__LeSpec__SetHistory(value)     { Na__LeSpec__History     = value; }
    function Na__LeSpec__SetIdFloor(value)     { Na__LeSpec__IdFloor     = value; }
    function Na__LeSpec__SetEditable(value)    { Na__LeSpec__Editable    = value; }
    function Na__LeSpec__SetShowToast(value)   { Na__LeSpec__ShowToast   = value; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change
    // ------------------------------------------------------------
    function Na__LeSpec__Dispatch(reason, detail) {
        window.dispatchEvent(new CustomEvent(Na__LeSpec__CHANGED_EVENT, {
            detail : Object.assign({ reason : reason, codesChanged : false, live : false, noteId : null, groupId : null }, detail || {})
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast When the Editor Has Handed One In
    // ------------------------------------------------------------
    function Na__LeSpec__Toast(message, isError, override) {
        const toast = (typeof override === 'function') ? override : Na__LeSpec__ShowToast;
        if (typeof toast === 'function') toast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Prefix Cleaned to Upper-Case Letters (may come back empty)
    // ------------------------------------------------------------
    function Na__LeSpec__CleanPrefix(value) {
        return String(value === undefined || value === null ? '' : value).toUpperCase().replace(/[^A-Z]/g, '').slice(0, Na__LeCfg__GetSpecificationSetup().prefixMaxLength);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Number at the End of an Id (0 when there is none)
    // ------------------------------------------------------------
    function Na__LeSpec__IdNumber(id) {
        const match = (typeof id === 'string') ? id.match(/(\d+)$/) : null;
        return match ? parseInt(match[1], 10) : 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Next Id: Above Every Id Ever Issued, Here or in the File
    // ------------------------------------------------------------
    // The floor lives outside the document on purpose. An undo puts back a
    // snapshot whose counter is lower than ids issued since; raising the counter
    // inside the restored document would make it differ from its own snapshot,
    // and the next undo would record that difference as a step and never get
    // further back. The document is restored exactly; the floor remembers.
    // ------------------------------------------------------------
    function Na__LeSpec__NextId(doc, prefix) {
        const next = Math.max(Number.isFinite(doc[Na__LeSpec__K_LAST_ID]) ? doc[Na__LeSpec__K_LAST_ID] : 0, Na__LeSpec__IdFloor) + 1;
        doc[Na__LeSpec__K_LAST_ID] = next;
        Na__LeSpec__IdFloor = next;
        return prefix + String(next).padStart(3, '0');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Code From a Prefix and a One-Based Place
    // ------------------------------------------------------------
    function Na__LeSpec__Code(prefix, place, digits) {
        return prefix + String(place).padStart(digits, '0');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data State: Constants, Variables, Setters and Helpers
    // ------------------------------------------------------------
    export {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__OPEN_EVENT,
        Na__LeSpec__GOTO_EVENT,
        Na__LeSpec__LOCATE_EVENT,
        Na__LeSpec__DRAFT_PREFIX,
        Na__LeSpec__VERSION,
        Na__LeSpec__STATUS_IDLE,
        Na__LeSpec__STATUS_LOADING,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__K_DESCRIPTION,
        Na__LeSpec__K_VERSION,
        Na__LeSpec__K_PROJECT,
        Na__LeSpec__K_UPDATED,
        Na__LeSpec__K_DIGITS,
        Na__LeSpec__K_LAST_ID,
        Na__LeSpec__K_GROUPS,
        Na__LeSpec__K_REVISION,
        Na__LeSpec__K_DOCNUMBER,
        Na__LeSpec__DESCRIPTION,
        Na__LeSpec__Doc,
        Na__LeSpec__Index,
        Na__LeSpec__Status,
        Na__LeSpec__Source,
        Na__LeSpec__Error,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__LoadPromise,
        Na__LeSpec__BaseStamp,
        Na__LeSpec__SyncedJson,
        Na__LeSpec__CodeSig,
        Na__LeSpec__Syncing,
        Na__LeSpec__LastSyncIso,
        Na__LeSpec__History,
        Na__LeSpec__IdFloor,
        Na__LeSpec__Editable,
        Na__LeSpec__ShowToast,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetStatus,
        Na__LeSpec__SetSource,
        Na__LeSpec__SetError,
        Na__LeSpec__SetProjectCode,
        Na__LeSpec__SetLoadPromise,
        Na__LeSpec__SetBaseStamp,
        Na__LeSpec__SetSyncedJson,
        Na__LeSpec__SetCodeSig,
        Na__LeSpec__SetSyncing,
        Na__LeSpec__SetLastSyncIso,
        Na__LeSpec__SetHistory,
        Na__LeSpec__SetIdFloor,
        Na__LeSpec__SetEditable,
        Na__LeSpec__SetShowToast,
        Na__LeSpec__Dispatch,
        Na__LeSpec__Toast,
        Na__LeSpec__CleanPrefix,
        Na__LeSpec__IdNumber,
        Na__LeSpec__NextId,
        Na__LeSpec__Code
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
