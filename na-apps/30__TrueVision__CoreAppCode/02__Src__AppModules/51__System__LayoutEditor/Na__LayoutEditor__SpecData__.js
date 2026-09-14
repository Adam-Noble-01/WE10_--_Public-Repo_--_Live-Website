// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the project specification: its groups and notes, the codes their order gives them, its undo, the browser draft and its file on R2
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
//   TrueVision__ProjectData__.json, and EnsureLoaded is first called on entry
//   to the editor, so a long specification costs nothing to a visitor who only
//   orbits the model. Where it is read from:
//     localhost, or authoring unlocked   R2 through the Worker (fresh), and the
//                                        repository copy only when R2 has none
//     the web build                      the public CDN copy
//   A copy that could not be READ is not a copy that is not there. The first
//   leaves the specification 'failed': edits are kept in this browser but Sync
//   refuses until the cloud copy can be read, so an unreachable Worker can
//   never let an empty specification overwrite a real one.
// - KEPT LOCALLY AT ONCE, SYNCED ON REQUEST. Every change writes a browser
//   draft a moment after the typing pauses, and when the tab is hidden or
//   closed. A load that finds a draft different from the file puts the draft
//   back and says so. Sync writes the whole file to R2 and clears the draft,
//   and asks first when the cloud copy changed after this browser read it.
// - UNDO. The tab keeps its own history of whole-document snapshots, one step
//   per committed change. Typing into a title or a body is live - no step -
//   and the field's commit is the one step for everything typed into it.
// - One event announces every change, with its reason and whether any note's
//   code moved, so the sheets only re-stamp their bubbles when a code did.
//
// INTEGRATION:
// - Initialised by the mode controller; loaded on the first entry into the
//   editor. Read by Na__LayoutEditor__SpecLinks__, __SpecMargin__,
//   __SpecEditor__, __Panel__Leaders__ and __Panel__MarginNotes__.
// - OPEN_EVENT and GOTO_EVENT are requests the mode controller answers (show
//   the tab; show a sheet with a bubble selected), declared here so the
//   modules that raise them need not import the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. The Transport region is the one part to
//                   adapt: ValeVision writes to its own bucket by its own path.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code, Environment, R2 Client and the Confirm Dialog
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__CHANGED_EVENT, Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__ProjectFileLocation,
        Na__CfApi__ReadProjectFile,
        Na__CfApi__WriteProjectFile
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
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
    let Na__LeSpec__DraftTimer  = null;
    let Na__LeSpec__IdFloor     = 0;        // <-- The highest id number ever issued or seen for this project, whatever undo puts back
    let Na__LeSpec__Editable    = false;
    let Na__LeSpec__ShowToast   = null;
    let Na__LeSpec__Initialised = false;
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


    // HELPER FUNCTION | Resolve After a Time Limit, Whatever the Promise Does
    // ------------------------------------------------------------
    function Na__LeSpec__WithTimeout(promise, ms) {
        return Promise.race([
            Promise.resolve(promise).catch((error) => ({ ok : false, error : (error && error.message) || 'error' })),
            new Promise((resolve) => { window.setTimeout(() => resolve({ ok : false, error : 'timed out' }), ms); })
        ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch a JSON File: { ok, data, missing, error }
    // ------------------------------------------------------------
    async function Na__LeSpec__FetchJson(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            if (response.status === 404 || response.status === 403) return { ok : true, data : null, missing : true };   // <-- The CDN answers a missing object with either
            if (!response.ok) return { ok : false, data : null, missing : false, error : 'HTTP ' + response.status };
            const data = await response.json();
            return { ok : true, data : (data && typeof data === 'object') ? data : null, missing : false };
        } catch (error) {
            return { ok : false, data : null, missing : false, error : (error && error.message) || 'unreachable' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Normalisation, Codes and the Index
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Empty Document
    // ------------------------------------------------------------
    function Na__LeSpec__Skeleton() {
        const doc = {};
        doc[Na__LeSpec__K_DESCRIPTION] = Na__LeSpec__DESCRIPTION;
        doc[Na__LeSpec__K_VERSION]     = Na__LeSpec__VERSION;
        doc[Na__LeSpec__K_PROJECT]     = null;
        doc[Na__LeSpec__K_UPDATED]     = null;
        doc[Na__LeSpec__K_DIGITS]      = Na__LeCfg__GetSpecificationSetup().numberDigits;
        doc[Na__LeSpec__K_LAST_ID]     = 0;
        doc[Na__LeSpec__K_GROUPS]      = [];
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Every Note's Code From Its Group and Its Place
    // ------------------------------------------------------------
    function Na__LeSpec__Renumber(doc) {
        const digits = doc[Na__LeSpec__K_DIGITS];
        doc[Na__LeSpec__K_GROUPS].forEach((group) => {
            group.Group__Notes.forEach((note, i) => { note.Note__Code = Na__LeSpec__Code(group.Group__Prefix, i + 1, digits); });
        });
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Any Document Whole: a Fresh Copy, Every Field Present, Codes Recomputed
    // ------------------------------------------------------------
    // A hand-edited or partial file still reads: unknown keys are carried so a
    // field some later tool writes survives a round trip, a missing or repeated
    // id is replaced from the counter, a prefix is cleaned to letters, and the
    // counter is raised past every id actually present.
    // ------------------------------------------------------------
    function Na__LeSpec__Normalise(raw) {
        const setup  = Na__LeCfg__GetSpecificationSetup();
        const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? JSON.parse(JSON.stringify(raw)) : {};
        const doc    = Na__LeSpec__Skeleton();
        Object.keys(source).forEach((key) => { if (!(key in doc)) doc[key] = source[key]; });

        const digits = source[Na__LeSpec__K_DIGITS];
        doc[Na__LeSpec__K_DIGITS]  = (Number.isFinite(digits) && digits >= 1 && digits <= 4) ? Math.round(digits) : setup.numberDigits;
        doc[Na__LeSpec__K_UPDATED] = typeof source[Na__LeSpec__K_UPDATED] === 'string' ? source[Na__LeSpec__K_UPDATED] : null;
        doc[Na__LeSpec__K_PROJECT] = typeof source[Na__LeSpec__K_PROJECT] === 'string' ? source[Na__LeSpec__K_PROJECT] : null;

        const groups = Array.isArray(source[Na__LeSpec__K_GROUPS]) ? source[Na__LeSpec__K_GROUPS].filter((g) => g && typeof g === 'object') : [];
        let highest = Number.isFinite(source[Na__LeSpec__K_LAST_ID]) ? Math.max(0, Math.round(source[Na__LeSpec__K_LAST_ID])) : 0;
        groups.forEach((g) => {
            highest = Math.max(highest, Na__LeSpec__IdNumber(g.Group__Id));
            (Array.isArray(g.Group__Notes) ? g.Group__Notes : []).forEach((n) => { if (n && typeof n === 'object') highest = Math.max(highest, Na__LeSpec__IdNumber(n.Note__Id)); });
        });
        doc[Na__LeSpec__K_LAST_ID] = highest;

        const seen = new Set();
        const idOr = (value, prefix) => {
            const ok = typeof value === 'string' && value.trim() !== '' && !seen.has(value.trim());
            const id = ok ? value.trim() : Na__LeSpec__NextId(doc, prefix);
            seen.add(id);
            return id;
        };
        doc[Na__LeSpec__K_GROUPS] = groups.map((g) => {
            const group = {
                Group__Id        : idOr(g.Group__Id, 'SpecGroup_'),
                Group__Prefix    : Na__LeSpec__CleanPrefix(g.Group__Prefix) || 'X',
                Group__Title     : typeof g.Group__Title === 'string' ? g.Group__Title : '',
                Group__IsGeneral : g.Group__IsGeneral === true,
                Group__Notes     : []
            };
            Object.keys(g).forEach((key) => { if (!(key in group)) group[key] = g[key]; });
            group.Group__Notes = (Array.isArray(g.Group__Notes) ? g.Group__Notes : []).filter((n) => n && typeof n === 'object').map((n) => {
                const note = {
                    Note__Id         : idOr(n.Note__Id, 'SpecNote_'),
                    Note__Code       : '',
                    Note__Title      : typeof n.Note__Title === 'string' ? n.Note__Title : '',
                    Note__Body       : typeof n.Note__Body === 'string' ? n.Note__Body : '',
                    Note__UpdatedIso : typeof n.Note__UpdatedIso === 'string' ? n.Note__UpdatedIso : null
                };
                Object.keys(n).forEach((key) => { if (!(key in note)) note[key] = n[key]; });
                return note;
            });
            return group;
        });
        return Na__LeSpec__Renumber(doc);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Part of a Document That Counts as Its Content
    // ------------------------------------------------------------
    function Na__LeSpec__ContentJson(doc) {
        return doc ? JSON.stringify([ doc[Na__LeSpec__K_DIGITS], doc[Na__LeSpec__K_GROUPS] ]) : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Lookups (a flat list in order, by id and by code)
    // ------------------------------------------------------------
    // Several groups may share a prefix in a hand-edited file; the first in
    // order owns the code, and PrefixClashes reports the rest.
    // ------------------------------------------------------------
    function Na__LeSpec__BuildIndex() {
        const list = [], byId = new Map(), byCode = new Map();
        (Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_GROUPS] : []).forEach((group, groupIndex) => {
            group.Group__Notes.forEach((note, index) => {
                const entry = { note : note, group : group, groupIndex : groupIndex, index : index, order : list.length, code : note.Note__Code };
                list.push(entry);
                byId.set(note.Note__Id, entry);
                if (!byCode.has(entry.code)) byCode.set(entry.code, entry);
            });
        });
        Na__LeSpec__Index = { list : list, byId : byId, byCode : byCode };
        return Na__LeSpec__Index;
    }
    function Na__LeSpec__Lookups() { return Na__LeSpec__Index || Na__LeSpec__BuildIndex(); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Note's Id and Code as One String
    // ------------------------------------------------------------
    function Na__LeSpec__CodeSignature() {
        return Na__LeSpec__Lookups().list.map((entry) => entry.note.Note__Id + '=' + entry.code).join('|');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // FUNCTION | The Groups in Order (the live array: read, never write)
    // ------------------------------------------------------------
    function Na__LeSpec__GetGroups() { return Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_GROUPS] : []; }
    // ------------------------------------------------------------


    // FUNCTION | One Group by Id
    // ------------------------------------------------------------
    function Na__LeSpec__GetGroupById(groupId) {
        return Na__LeSpec__GetGroups().find((group) => group.Group__Id === groupId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Note in Order: [{ note, group, groupIndex, index, order, code }]
    // ------------------------------------------------------------
    function Na__LeSpec__ListNotes() { return Na__LeSpec__Lookups().list; }
    // ------------------------------------------------------------


    // FUNCTION | One Note by Id, With Its Group, Place and Code (null when absent)
    // ------------------------------------------------------------
    function Na__LeSpec__GetNoteEntry(noteId) {
        return (typeof noteId === 'string' && Na__LeSpec__Doc) ? (Na__LeSpec__Lookups().byId.get(noteId) || null) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Note's Current Code (null when the note is not in the specification)
    // ------------------------------------------------------------
    function Na__LeSpec__CodeFor(noteId) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        return entry ? entry.code : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read Typed Text as a Code: { prefix, number } or Null
    // ------------------------------------------------------------
    // Forgiving about case, spaces, a hyphen or a dot and zero padding, so
    // "ee2", "EE-02" and "EE 002" all read as EE and 2. Places start at 1.
    // ------------------------------------------------------------
    function Na__LeSpec__ParseCode(text) {
        const compact = String(text === undefined || text === null ? '' : text).toUpperCase().replace(/\s+/g, '');
        const match   = compact.match(/^([A-Z]{1,6})[-.]?(\d{1,4})$/);
        if (!match) return null;
        const number = parseInt(match[2], 10);
        return number >= 1 ? { prefix : match[1], number : number } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Note a Typed Code Names (null when none does)
    // ------------------------------------------------------------
    function Na__LeSpec__FindByCode(text) {
        const parsed = Na__LeSpec__ParseCode(text);
        if (!parsed || !Na__LeSpec__Doc) return null;
        return Na__LeSpec__Lookups().byCode.get(Na__LeSpec__Code(parsed.prefix, parsed.number, Na__LeSpec__Doc[Na__LeSpec__K_DIGITS])) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Canonical Form of a Typed Code, Whether or Not a Note Has It
    // ------------------------------------------------------------
    function Na__LeSpec__NormaliseCode(text) {
        const parsed = Na__LeSpec__ParseCode(text);
        const digits = Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_DIGITS] : Na__LeCfg__GetSpecificationSetup().numberDigits;
        return parsed ? Na__LeSpec__Code(parsed.prefix, parsed.number, digits) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Prefixes More Than One Group Uses (a hand-edited file's clash)
    // ------------------------------------------------------------
    function Na__LeSpec__PrefixClashes() {
        const counts = new Map();
        Na__LeSpec__GetGroups().forEach((group) => counts.set(group.Group__Prefix, (counts.get(group.Group__Prefix) || 0) + 1));
        return new Set(Array.from(counts.keys()).filter((prefix) => counts.get(prefix) > 1));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Prefix Acceptable for a Group: { ok, value, reason, message }
    // ------------------------------------------------------------
    // Letters only, at most PrefixMaxLength of them, and not another group's.
    // Nothing clashing is ever created: codes are unique by construction once
    // prefixes are.
    // ------------------------------------------------------------
    function Na__LeSpec__ValidatePrefix(value, groupId) {
        const max = Na__LeCfg__GetSpecificationSetup().prefixMaxLength;
        const raw = String(value === undefined || value === null ? '' : value).trim().toUpperCase();
        if (!raw) return { ok : false, value : raw, reason : 'empty', message : Na__LeCfg__GetLabel('SpecPrefixEmpty', 'A prefix needs at least one letter.') };
        if (!/^[A-Z]+$/.test(raw)) return { ok : false, value : raw, reason : 'letters', message : Na__LeCfg__GetLabel('SpecPrefixLetters', 'A prefix is letters only, A to Z.') };
        if (raw.length > max) return { ok : false, value : raw, reason : 'length', message : Na__LeCfg__FormatLabel('SpecPrefixLength', 'A prefix is at most {max} letters.', { max : max }) };
        const other = Na__LeSpec__GetGroups().find((group) => group.Group__Prefix === raw && group.Group__Id !== groupId);
        if (other) return { ok : false, value : raw, reason : 'clash', message : Na__LeCfg__FormatLabel('SpecPrefixClash', '{prefix} is already the prefix of {title}.', { prefix : raw, title : other.Group__Title || raw }) };
        return { ok : true, value : raw, reason : null, message : '' };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Code Width in Digits
    // ------------------------------------------------------------
    function Na__LeSpec__NumberDigits() {
        return Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_DIGITS] : Na__LeCfg__GetSpecificationSetup().numberDigits;
    }
    // ------------------------------------------------------------


    // FUNCTION | Lifecycle State for the Tab and the Panels
    // ------------------------------------------------------------
    // { status, source, error, dirty, syncing, lastSyncIso, cloudStamp, loaded,
    //   editable, canSync }
    // ------------------------------------------------------------
    function Na__LeSpec__GetState() {
        const loaded = !!Na__LeSpec__Doc && Na__LeSpec__Status !== Na__LeSpec__STATUS_IDLE && Na__LeSpec__Status !== Na__LeSpec__STATUS_LOADING;
        return {
            status      : Na__LeSpec__Status,
            source      : Na__LeSpec__Source,
            error       : Na__LeSpec__Error,
            dirty       : Na__LeSpec__IsDirty(),
            syncing     : Na__LeSpec__Syncing,
            lastSyncIso : Na__LeSpec__LastSyncIso,
            cloudStamp  : Na__LeSpec__BaseStamp,
            loaded      : loaded,
            editable    : Na__LeSpec__Editable,
            canSync     : loaded && Na__LeSpec__Editable && !Na__LeSpec__Syncing && Na__CfApi__IsConfigured()
        };
    }
    function Na__LeSpec__IsLoaded()   { return Na__LeSpec__GetState().loaded; }
    function Na__LeSpec__IsDirty()    { return !!Na__LeSpec__Doc && Na__LeSpec__ContentJson(Na__LeSpec__Doc) !== Na__LeSpec__SyncedJson; }
    function Na__LeSpec__IsEditable() { return Na__LeSpec__Editable; }
    function Na__LeSpec__GetDocument() { return Na__LeSpec__Doc; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Changing the Document
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | May the Document Be Changed Now
    // ------------------------------------------------------------
    function Na__LeSpec__CanEdit() {
        return Na__LeSpec__Editable && Na__LeSpec__IsLoaded();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | After Any Change: Renumber, Record, Draft and Announce
    // ------------------------------------------------------------
    // live: typing into a field - announced so the sheets follow, but no history
    // step; the field's commit takes the one step for all of it.
    // ------------------------------------------------------------
    function Na__LeSpec__Changed(reason, detail, live) {
        Na__LeSpec__Renumber(Na__LeSpec__Doc);
        Na__LeSpec__Index = null;
        const signature    = Na__LeSpec__CodeSignature();
        const codesChanged = signature !== Na__LeSpec__CodeSig;
        Na__LeSpec__CodeSig = signature;
        if (!live) Na__LeSpec__Record();
        Na__LeSpec__ScheduleDraft();
        Na__LeSpec__Dispatch(reason, Object.assign({ codesChanged : codesChanged, live : live === true }, detail || {}));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Free Placeholder Prefix for a New Group (XA, XB ... YA ...)
    // ------------------------------------------------------------
    function Na__LeSpec__FreePrefix(wanted) {
        const taken = new Set(Na__LeSpec__GetGroups().map((group) => group.Group__Prefix));
        const clean = Na__LeSpec__CleanPrefix(wanted);
        if (clean && !taken.has(clean)) return clean;
        for (let a = 23; a < 49; a++) {                                             // <-- X, Y, Z first, then round to W: an unlikely real prefix
            for (let b = 0; b < 26; b++) {
                const candidate = String.fromCharCode(65 + (a % 26)) + String.fromCharCode(65 + b);
                if (!taken.has(candidate)) return candidate;
            }
        }
        return 'X' + Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Group Record (not yet placed)
    // ------------------------------------------------------------
    function Na__LeSpec__MakeGroup(options) {
        const opts = options || {};
        return {
            Group__Id        : Na__LeSpec__NextId(Na__LeSpec__Doc, 'SpecGroup_'),
            Group__Prefix    : Na__LeSpec__FreePrefix(opts.prefix),
            Group__Title     : typeof opts.title === 'string' ? opts.title : '',
            Group__IsGeneral : opts.isGeneral === true,
            Group__Notes     : []
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Group: { prefix, title, isGeneral, index }
    // ------------------------------------------------------------
    // A prefix that is taken or unusable becomes a free placeholder, to be
    // typed over; nothing ever lands with a clashing prefix.
    // ------------------------------------------------------------
    function Na__LeSpec__AddGroup(options) {
        if (!Na__LeSpec__CanEdit()) return null;
        const opts   = options || {};
        const groups = Na__LeSpec__GetGroups();
        const group  = Na__LeSpec__MakeGroup(opts);
        const at     = Number.isFinite(opts.index) ? Math.max(0, Math.min(groups.length, Math.round(opts.index))) : groups.length;
        groups.splice(at, 0, group);
        Na__LeSpec__Changed('groups', { groupId : group.Group__Id });
        return group;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add the Configured Starter Groups to an Empty Specification (one undo step)
    // ------------------------------------------------------------
    function Na__LeSpec__AddStarterGroups() {
        if (!Na__LeSpec__CanEdit() || Na__LeSpec__GetGroups().length > 0) return 0;
        const groups = Na__LeSpec__GetGroups();
        Na__LeCfg__GetSpecificationSetup().starterGroups.forEach((spec) => {
            if (!spec || typeof spec !== 'object') return;
            groups.push(Na__LeSpec__MakeGroup({ prefix : spec.Prefix, title : spec.Title, isGeneral : spec.IsGeneral === true }));
        });
        if (groups.length) Na__LeSpec__Changed('groups', null);
        return groups.length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Group: { prefix, title, isGeneral }, live for typing
    // ------------------------------------------------------------
    // Returns { ok, reason, message }. A prefix is refused, and nothing else in
    // the patch applied, when ValidatePrefix refuses it.
    // ------------------------------------------------------------
    function Na__LeSpec__UpdateGroup(groupId, patch, live) {
        const group = Na__LeSpec__GetGroupById(groupId);
        if (!group || !patch || !Na__LeSpec__CanEdit()) return { ok : false, reason : 'missing', message : '' };
        if (patch.prefix !== undefined) {
            const check = Na__LeSpec__ValidatePrefix(patch.prefix, groupId);
            if (!check.ok) return check;
            group.Group__Prefix = check.value;
        }
        if (typeof patch.title === 'string') group.Group__Title = patch.title;
        if (typeof patch.isGeneral === 'boolean') group.Group__IsGeneral = patch.isGeneral;
        Na__LeSpec__Changed(patch.prefix !== undefined ? 'groups' : 'group', { groupId : groupId }, live === true);
        return { ok : true, reason : null, message : '' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Group and Its Notes
    // ------------------------------------------------------------
    function Na__LeSpec__DeleteGroup(groupId) {
        const groups = Na__LeSpec__GetGroups();
        const index  = groups.findIndex((group) => group.Group__Id === groupId);
        if (index === -1 || !Na__LeSpec__CanEdit()) return false;
        groups.splice(index, 1);
        Na__LeSpec__Changed('groups', { groupId : groupId });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Group to a New Place in the List
    // ------------------------------------------------------------
    function Na__LeSpec__MoveGroup(groupId, newIndex) {
        const groups = Na__LeSpec__GetGroups();
        const from   = groups.findIndex((group) => group.Group__Id === groupId);
        if (from === -1 || !Na__LeSpec__CanEdit()) return false;
        const to = Math.max(0, Math.min(groups.length - 1, Math.round(newIndex)));
        if (to === from) return false;
        const moved = groups.splice(from, 1)[0];
        groups.splice(to, 0, moved);
        Na__LeSpec__Changed('groups', { groupId : groupId });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Note to a Group: { title, body, index }
    // ------------------------------------------------------------
    function Na__LeSpec__AddNote(groupId, options) {
        const group = Na__LeSpec__GetGroupById(groupId);
        if (!group || !Na__LeSpec__CanEdit()) return null;
        const opts = options || {};
        const note = {
            Note__Id         : Na__LeSpec__NextId(Na__LeSpec__Doc, 'SpecNote_'),
            Note__Code       : '',
            Note__Title      : typeof opts.title === 'string' ? opts.title : '',
            Note__Body       : typeof opts.body === 'string' ? opts.body : '',
            Note__UpdatedIso : new Date().toISOString()
        };
        const at = Number.isFinite(opts.index) ? Math.max(0, Math.min(group.Group__Notes.length, Math.round(opts.index))) : group.Group__Notes.length;
        group.Group__Notes.splice(at, 0, note);
        Na__LeSpec__Changed('notes', { noteId : note.Note__Id, groupId : groupId });
        return note;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Note's Title or Body, live for typing
    // ------------------------------------------------------------
    function Na__LeSpec__UpdateNote(noteId, patch, live) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        if (!entry || !patch || !Na__LeSpec__CanEdit()) return false;
        const note = entry.note;
        let changed = false;
        if (typeof patch.title === 'string' && patch.title !== note.Note__Title) { note.Note__Title = patch.title; changed = true; }
        if (typeof patch.body  === 'string' && patch.body  !== note.Note__Body)  { note.Note__Body  = patch.body;  changed = true; }
        if (changed) note.Note__UpdatedIso = new Date().toISOString();
        if (!changed && live) return false;                                         // <-- A keystroke that changed nothing announces nothing; a commit still takes its step
        Na__LeSpec__Changed('note', { noteId : noteId, groupId : entry.group.Group__Id }, live === true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Note
    // ------------------------------------------------------------
    // A bubble still linked to it keeps its id and its last code, and the
    // panels say the link is broken; the id is never given to another note.
    // ------------------------------------------------------------
    function Na__LeSpec__DeleteNote(noteId) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        if (!entry || !Na__LeSpec__CanEdit()) return false;
        entry.group.Group__Notes.splice(entry.index, 1);
        Na__LeSpec__Changed('notes', { noteId : noteId, groupId : entry.group.Group__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move a Note Within Its Group or Into Another (renumbers both)
    // ------------------------------------------------------------
    // newIndex is the place in the target group AFTER the note has left its
    // own; past the end puts it last.
    // ------------------------------------------------------------
    function Na__LeSpec__MoveNote(noteId, groupId, newIndex) {
        const entry  = Na__LeSpec__GetNoteEntry(noteId);
        const target = Na__LeSpec__GetGroupById(groupId || (entry && entry.group.Group__Id));
        if (!entry || !target || !Na__LeSpec__CanEdit()) return false;
        const sameGroup = target === entry.group;
        const limit     = sameGroup ? entry.group.Group__Notes.length - 1 : target.Group__Notes.length;
        const to        = Number.isFinite(newIndex) ? Math.max(0, Math.min(limit, Math.round(newIndex))) : limit;
        if (sameGroup && to === entry.index) return false;
        entry.group.Group__Notes.splice(entry.index, 1);
        target.Group__Notes.splice(to, 0, entry.note);
        Na__LeSpec__Changed('notes', { noteId : noteId, groupId : target.Group__Id });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Undo and Redo
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Record the Document as a Step When It Differs From the Last One
    // ------------------------------------------------------------
    function Na__LeSpec__Record() {
        if (!Na__LeSpec__Doc) return;
        const history = Na__LeSpec__History;
        const next    = JSON.stringify(Na__LeSpec__Doc);
        if (history.current === null) { history.current = next; return; }
        if (next === history.current) return;
        history.undo.push(history.current);
        const max = Na__LeCfg__GetSpecificationSetup().historySteps;
        while (history.undo.length > max) history.undo.shift();
        history.redo.length = 0;
        history.current = next;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Snapshot Back
    // ------------------------------------------------------------
    // Exactly as it was recorded, so the document and the history agree and the
    // next undo steps further back. A note undone away still cannot hand its id
    // to the next one created: the id floor is kept outside the document.
    // ------------------------------------------------------------
    function Na__LeSpec__ApplySnapshot(json, direction) {
        Na__LeSpec__Doc = Na__LeSpec__Normalise(JSON.parse(json));
        Na__LeSpec__Index = null;
        const signature = Na__LeSpec__CodeSignature();
        const codesChanged = signature !== Na__LeSpec__CodeSig;
        Na__LeSpec__CodeSig = signature;
        Na__LeSpec__ScheduleDraft();
        Na__LeSpec__Dispatch('restore', { codesChanged : codesChanged, direction : direction });
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Back and Forward
    // ------------------------------------------------------------
    function Na__LeSpec__CanUndo() { return Na__LeSpec__CanEdit() && (Na__LeSpec__History.undo.length > 0 || (Na__LeSpec__History.current !== null && JSON.stringify(Na__LeSpec__Doc) !== Na__LeSpec__History.current)); }
    function Na__LeSpec__CanRedo() { return Na__LeSpec__CanEdit() && Na__LeSpec__History.redo.length > 0; }
    function Na__LeSpec__Undo() {
        if (!Na__LeSpec__CanEdit()) return false;
        Na__LeSpec__Record();                                                       // <-- Typing never committed is a step of its own, so the undo takes it back rather than losing it
        const history = Na__LeSpec__History;
        if (!history.undo.length) return false;
        history.redo.push(history.current);
        history.current = history.undo.pop();
        Na__LeSpec__ApplySnapshot(history.current, 'undo');
        return true;
    }
    function Na__LeSpec__Redo() {
        const history = Na__LeSpec__History;
        if (!Na__LeSpec__CanEdit() || !history.redo.length) return false;
        history.undo.push(history.current);
        history.current = history.redo.pop();
        Na__LeSpec__ApplySnapshot(history.current, 'redo');
        return true;
    }
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
        Na__LeSpec__IdFloor   = Math.max(Na__LeSpec__IdFloor, drafted[Na__LeSpec__K_LAST_ID], Na__LeSpec__Doc[Na__LeSpec__K_LAST_ID]);
        Na__LeSpec__Doc       = drafted;
        Na__LeSpec__Index     = null;
        Na__LeSpec__BaseStamp = draftBase;
        Na__LeSpec__History   = { undo : [], redo : [], current : JSON.stringify(drafted) };
        Na__LeSpec__Toast(stale
            ? Na__LeCfg__GetLabel('SpecDraftRestoredStale', 'Unsynced specification changes from this browser were restored, but the cloud copy has changed since they were made. Sync asks before replacing it.')
            : Na__LeCfg__GetLabel('SpecDraftRestored', 'Unsynced specification changes from this browser were restored. Sync keeps them.'), false);
        console.log('[TrueVision3D] Layout Editor: unsynced specification draft restored from this browser.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Transport (the TrueVision-specific part: R2 through the Worker, the CDN, the repository)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | May This Session Read the Cloud Copy Directly
    // ------------------------------------------------------------
    function Na__LeSpec__UsesWorker() {
        return Na__CfApi__IsConfigured() && (Na__AppUtils__IsRunningOnLocalhost() || Na__DevGate__IsAuthoringEnabled());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find the Specification: { status, data, source, error }
    // ------------------------------------------------------------
    async function Na__LeSpec__Fetch() {
        const setup    = Na__LeCfg__GetSpecificationSetup();
        const location = Na__CfApi__ProjectFileLocation(setup.fileName);
        if (!location) return { status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : 'no project folder in the URL' };
        const local = Na__AppUtils__IsRunningOnLocalhost();

        if (Na__LeSpec__UsesWorker()) {
            const read = await Na__LeSpec__WithTimeout(Na__CfApi__ReadProjectFile(setup.fileName), setup.loadTimeoutMs);
            if (read && read.ok && !read.missing && read.data && typeof read.data === 'object') return { status : Na__LeSpec__STATUS_READY, data : read.data, source : 'cloud' };
            if (read && read.ok) {
                // NOTHING ON R2 YET. A repository copy, if one was ever committed,
                // is the starting point and the first Sync seeds R2 with it.
                if (local) {
                    const repo = await Na__LeSpec__FetchJson(location.repoUrl);
                    if (repo.ok && repo.data) return { status : Na__LeSpec__STATUS_READY, data : repo.data, source : 'repository', cloudMissing : true };
                }
                return { status : Na__LeSpec__STATUS_NEW, data : null, source : 'cloud' };
            }
            // THE WORKER COULD NOT ANSWER. Never read as "no specification": show
            // what a fallback copy holds, but leave Sync closed until R2 answers.
            const fallback = await Na__LeSpec__FetchJson(local ? location.repoUrl : location.cdnUrl);
            return { status : Na__LeSpec__STATUS_FAILED, data : (fallback.ok && fallback.data) ? fallback.data : null, source : (fallback.ok && fallback.data) ? (local ? 'repository' : 'cdn') : null, error : (read && read.error) || 'Worker unreachable' };
        }

        const cdn = await Na__LeSpec__FetchJson(location.cdnUrl);
        if (cdn.ok && cdn.data) return { status : Na__LeSpec__STATUS_READY, data : cdn.data, source : 'cdn' };
        if (cdn.ok && cdn.missing) return { status : Na__LeSpec__STATUS_NEW, data : null, source : 'cdn' };
        return { status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : cdn.error || 'CDN unreachable' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take a Fetched Copy as the Live Document
    // ------------------------------------------------------------
    function Na__LeSpec__Adopt(result) {
        const doc = Na__LeSpec__Normalise(result.data);
        Na__LeSpec__IdFloor   = Math.max(Na__LeSpec__IdFloor, doc[Na__LeSpec__K_LAST_ID]);
        Na__LeSpec__Doc       = doc;
        Na__LeSpec__Index     = null;
        Na__LeSpec__Status    = result.status;
        Na__LeSpec__Source    = result.source;
        Na__LeSpec__Error     = result.error || null;
        Na__LeSpec__BaseStamp = (result.data && !result.cloudMissing) ? doc[Na__LeSpec__K_UPDATED] : null;
        Na__LeSpec__SyncedJson = result.cloudMissing ? Na__LeSpec__ContentJson(Na__LeSpec__Skeleton()) : Na__LeSpec__ContentJson(doc);   // <-- A repository copy R2 has never held is unsynced
        Na__LeSpec__History   = { undo : [], redo : [], current : JSON.stringify(doc) };
        Na__LeSpec__CodeSig   = Na__LeSpec__CodeSignature();
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Specification Once per Project (the first entry into the editor)
    // ------------------------------------------------------------
    // Resolves to the live document. Never rejects: a failure leaves the status
    // 'failed' and an empty (or fallback) document to work in.
    // ------------------------------------------------------------
    function Na__LeSpec__EnsureLoaded() {
        const code = Na__DrawData__GetProjectCode();
        if (Na__LeSpec__LoadPromise && Na__LeSpec__ProjectCode === code) return Na__LeSpec__LoadPromise;
        Na__LeSpec__ProjectCode = code;
        Na__LeSpec__Status      = Na__LeSpec__STATUS_LOADING;
        Na__LeSpec__Dispatch('status');
        Na__LeSpec__LoadPromise = Na__LeSpec__Fetch().then((result) => {
            if (Na__LeSpec__ProjectCode !== code) return Na__LeSpec__Doc;           // <-- Another project arrived meanwhile
            Na__LeSpec__Adopt(result);
            Na__LeSpec__RestoreDraft();
            Na__LeSpec__CodeSig = Na__LeSpec__CodeSignature();
            if (result.status === Na__LeSpec__STATUS_FAILED) console.warn('[TrueVision3D] Layout Editor: the project specification could not be read (' + (result.error || 'unknown') + '). Edits stay in this browser; Sync is closed until it can be read.');
            else console.log('[TrueVision3D] Layout Editor: project specification ' + (result.status === Na__LeSpec__STATUS_NEW ? 'not created yet' : 'loaded from the ' + result.source) + ' (' + Na__LeSpec__ListNotes().length + ' note(s)).');
            Na__LeSpec__Dispatch('loaded', { codesChanged : true });
            return Na__LeSpec__Doc;
        }).catch((error) => {
            console.error('[TrueVision3D] Layout Editor: specification load error:', error);
            Na__LeSpec__Adopt({ status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : (error && error.message) || 'error' });
            Na__LeSpec__Dispatch('loaded', { codesChanged : true });
            return Na__LeSpec__Doc;
        });
        return Na__LeSpec__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Try the Cloud Copy Again After a Failed Read
    // ------------------------------------------------------------
    // With no edits made meanwhile, the cloud copy simply becomes the document.
    // Edits made while it could not be read are kept - they are this person's
    // work - but they were NOT made on the cloud copy, so the stamp they started
    // from stays their base: Sync then asks before they replace what the cloud
    // holds, rather than quietly writing an edited empty specification over a
    // real one.
    // ------------------------------------------------------------
    async function Na__LeSpec__Retry() {
        if (Na__LeSpec__Status !== Na__LeSpec__STATUS_FAILED || Na__LeSpec__Syncing) return false;
        const hadEdits = Na__LeSpec__IsDirty();
        const kept     = Na__LeSpec__Doc;
        const keptBase = Na__LeSpec__BaseStamp;
        Na__LeSpec__Status = Na__LeSpec__STATUS_LOADING;
        Na__LeSpec__Dispatch('status');
        const result = await Na__LeSpec__Fetch();
        if (result.status === Na__LeSpec__STATUS_FAILED) {
            Na__LeSpec__Status = Na__LeSpec__STATUS_FAILED;
            Na__LeSpec__Error  = result.error || null;
            Na__LeSpec__Dispatch('status');
            return false;
        }
        Na__LeSpec__Adopt(result);
        if (hadEdits && kept) {
            Na__LeSpec__Doc       = kept;                                       // <-- The cloud copy's counter is already in the id floor
            Na__LeSpec__Index     = null;
            Na__LeSpec__BaseStamp = keptBase;                                   // <-- The edits' own base, so Sync asks before replacing the cloud copy
            Na__LeSpec__History   = { undo : [], redo : [], current : JSON.stringify(kept) };
            Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecRetryKeptEdits', 'The cloud copy can be read again. The changes made while it could not be read are kept; Sync asks before they replace it.'), false);
        }
        Na__LeSpec__CodeSig = Na__LeSpec__CodeSignature();
        Na__LeSpec__Dispatch('loaded', { codesChanged : true });
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Cloud Stamp as Words for the Overwrite Question
    // ------------------------------------------------------------
    function Na__LeSpec__When(iso) {
        const date = iso ? new Date(iso) : null;
        return (date && !isNaN(date.getTime())) ? date.toLocaleString() : Na__LeCfg__GetLabel('SpecWhenUnknown', 'at an unknown time');
    }
    // ------------------------------------------------------------


    // FUNCTION | Sync: Write the Whole Specification to R2
    // ------------------------------------------------------------
    // options: { showToast, quiet }. Reads the cloud copy first; when it is not
    // the copy these edits started from, asks before replacing it. Resolves true
    // when the file was written.
    // ------------------------------------------------------------
    async function Na__LeSpec__Sync(options) {
        const opts  = options || {};
        const setup = Na__LeCfg__GetSpecificationSetup();
        const toast = (message, isError) => Na__LeSpec__Toast(message, isError, opts.showToast);
        if (Na__LeSpec__Syncing) return false;
        if (!Na__LeSpec__Editable) { toast(Na__LeCfg__GetLabel('SpecSyncReadOnly', 'The specification is read-only here.'), true); return false; }
        if (!Na__LeSpec__IsLoaded()) { toast(Na__LeCfg__GetLabel('SpecSyncNotLoaded', 'The specification has not finished loading.'), true); return false; }
        if (!Na__CfApi__IsConfigured()) { toast(Na__LeCfg__GetLabel('SpecSyncNoWorker', 'Cloudflare Worker not configured. The specification cannot be synced.'), true); return false; }

        Na__LeSpec__Syncing = true;
        Na__LeSpec__Dispatch('status');
        try {
            const read = await Na__LeSpec__WithTimeout(Na__CfApi__ReadProjectFile(setup.fileName), setup.loadTimeoutMs);
            if (!read || !read.ok) {
                toast(Na__LeCfg__FormatLabel('SpecSyncUnreachable', 'The cloud copy could not be read ({error}). Your changes are kept in this browser.', { error : (read && read.error) || 'unknown' }), true);
                return false;
            }
            const cloudStamp = (read.missing || !read.data) ? null : (typeof read.data[Na__LeSpec__K_UPDATED] === 'string' ? read.data[Na__LeSpec__K_UPDATED] : 'unstamped');
            if (setup.confirmOverwrite && cloudStamp !== Na__LeSpec__BaseStamp) {
                const ok = await Na__AppUtils__ConfirmDialog__Show({
                    title        : Na__LeCfg__GetLabel('SpecOverwriteTitle', 'Replace the cloud specification?'),
                    message      : Na__LeSpec__BaseStamp === null
                        ? Na__LeCfg__GetLabel('SpecOverwriteUnreadPrompt', 'The cloud already holds a specification that this browser has not read. Syncing replaces it with the copy in this browser.')
                        : Na__LeCfg__FormatLabel('SpecOverwritePrompt', 'The specification in the cloud has changed since this browser read it (saved {when}). Syncing replaces it with the copy in this browser.', { when : Na__LeSpec__When(cloudStamp) }),
                    confirmLabel : Na__LeCfg__GetLabel('SpecOverwriteConfirm', 'Replace'),
                    isDestructive : true
                });
                if (!ok) { toast(Na__LeCfg__GetLabel('SpecSyncCancelled', 'Sync cancelled. Your changes are kept in this browser.'), false); return false; }
            }

            const out = Na__LeSpec__Normalise(Na__LeSpec__Doc);
            out[Na__LeSpec__K_DESCRIPTION] = Na__LeSpec__DESCRIPTION;
            out[Na__LeSpec__K_VERSION]     = Na__LeSpec__VERSION;
            out[Na__LeSpec__K_PROJECT]     = Na__LeSpec__ProjectCode || Na__DrawData__GetProjectCode() || null;
            out[Na__LeSpec__K_UPDATED]     = new Date().toISOString();
            out[Na__LeSpec__K_LAST_ID]     = Math.max(out[Na__LeSpec__K_LAST_ID], Na__LeSpec__IdFloor);   // <-- Ids undone away stay spent in the file too
            const write = await Na__CfApi__WriteProjectFile(setup.fileName, out);
            if (!write || !write.ok) {
                toast(Na__LeCfg__FormatLabel('SpecSyncFailed', 'Specification sync failed: {error}. Your changes are kept in this browser.', { error : (write && write.error) || 'unknown' }), true);
                return false;
            }

            // THE LIVE DOCUMENT IS NOT STAMPED. The stamp belongs to the copy in the
            // cloud and is remembered as the base; writing it into the document
            // would make it differ from the undo history, and the first undo after
            // a sync would quietly undo the stamp instead of the last edit.
            Na__LeSpec__BaseStamp   = out[Na__LeSpec__K_UPDATED];
            Na__LeSpec__SyncedJson  = Na__LeSpec__ContentJson(out);                // <-- What was written; typing that landed during the write stays unsynced
            Na__LeSpec__Status      = Na__LeSpec__STATUS_READY;
            Na__LeSpec__Source      = 'cloud';
            Na__LeSpec__Error       = null;
            Na__LeSpec__LastSyncIso = out[Na__LeSpec__K_UPDATED];
            if (Na__LeSpec__IsDirty()) Na__LeSpec__ScheduleDraft(); else Na__LeSpec__ClearDraft();
            if (!opts.quiet) toast(Na__LeCfg__GetLabel('SpecSynced', 'Project specification synced.'), false);
            return true;
        } catch (error) {
            console.error('[TrueVision3D] Layout Editor: specification sync error:', error);
            toast(Na__LeCfg__FormatLabel('SpecSyncFailed', 'Specification sync failed: {error}. Your changes are kept in this browser.', { error : (error && error.message) || 'unknown' }), true);
            return false;
        } finally {
            Na__LeSpec__Syncing = false;
            Na__LeSpec__Dispatch('synced');
        }
    }
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
        Na__LeSpec__Editable  = !!(options && options.editable);
        Na__LeSpec__ShowToast = (options && options.showToast) || null;
        if (Na__LeSpec__Initialised) return true;
        Na__LeSpec__Initialised = true;
        window.addEventListener('pagehide', () => Na__LeSpec__FlushDraft());               // <-- Closing the tab keeps the last edit
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Na__LeSpec__FlushDraft(); });
        window.addEventListener(Na__DrawData__CHANGED_EVENT, (event) => {
            const detail = event.detail || {};
            if (detail.reason !== 'loaded' || !Na__LeSpec__LoadPromise || detail.projectCode === Na__LeSpec__ProjectCode) return;
            Na__LeSpec__FlushDraft();                                                     // <-- A different project: the next entry loads its own
            Na__LeSpec__Doc = null; Na__LeSpec__Index = null; Na__LeSpec__LoadPromise = null; Na__LeSpec__IdFloor = 0;
            Na__LeSpec__Status = Na__LeSpec__STATUS_IDLE;
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
        Na__LeSpec__FlushDraft,
        Na__LeSpec__GetState,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty,
        Na__LeSpec__IsEditable,
        Na__LeSpec__GetDocument,
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
