// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - EDITING
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__Editing__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - Editing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Every change to the specification (groups and notes added, changed, moved and deleted) and its undo and redo
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - CHANGES. Add, change, move and delete groups and notes. Each is refused
//   unless the specification is loaded and editable, and each ends in Changed:
//   renumber, record an undo step, schedule the browser draft, and announce
//   whether any note's code moved.
// - NOTHING LANDS WITH A CLASHING PREFIX. A new group whose prefix is taken
//   gets a free placeholder to type over; a changed prefix another group
//   already uses is refused.
// - LIVE TYPING. A change marked live is announced so the sheets follow, but
//   takes no undo step; the field's commit takes the one step for all of it.
// - UNDO AND REDO. Whole-document snapshots, recorded when the document
//   differs from the last one and put back exactly, so the history and the
//   document agree; the id floor in the State unit keeps undone ids spent.
//
// INTEGRATION:
// - Imports the State, Document and Draft units and the config state.
//   Imported by Na__LayoutEditor__SpecData__.js, which exports the changes and
//   CanUndo, CanRedo, Undo and Redo.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : Changed and ApplySnapshot store through the State unit's
//                   setters. Against ValeVision's unit, only the header and the
//                   import paths differ.
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

    // MODULE IMPORTS | Config and the Specification State, Document and Draft
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSpec__Doc,
        Na__LeSpec__K_REVISION,
        Na__LeSpec__K_DOCNUMBER,
        Na__LeSpec__CodeSig,
        Na__LeSpec__History,
        Na__LeSpec__Editable,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetCodeSig,
        Na__LeSpec__Dispatch,
        Na__LeSpec__CleanPrefix,
        Na__LeSpec__NextId
    } from './Na__LayoutEditor__SpecData__State__.js';
    import {
        Na__LeSpec__Renumber,
        Na__LeSpec__Normalise,
        Na__LeSpec__CodeSignature,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__ValidatePrefix,
        Na__LeSpec__IsLoaded
    } from './Na__LayoutEditor__SpecData__Document__.js';
    import { Na__LeSpec__ScheduleDraft } from './Na__LayoutEditor__SpecData__Draft__.js';
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
        Na__LeSpec__SetIndex(null);
        const signature    = Na__LeSpec__CodeSignature();
        const codesChanged = signature !== Na__LeSpec__CodeSig;
        Na__LeSpec__SetCodeSig(signature);
        if (!live) Na__LeSpec__Record();
        Na__LeSpec__ScheduleDraft();
        Na__LeSpec__Dispatch(reason, Object.assign({ codesChanged : codesChanged, live : live === true }, detail || {}));
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Issued Revision, and the Document's Own Number
    // ------------------------------------------------------------
    // These are fields of the document, not of any note, so they take the same
    // route as every other edit: guarded by CanEdit, then Changed, which records
    // an undo step, writes the browser draft and announces the change. Because
    // ContentJson counts them, setting either marks the specification unsynced
    // and lights Sync, exactly as typing into a note does.
    //
    // live is for a field being typed into: announced, but no history step, so a
    // whole revision typed character by character undoes in one.
    // ------------------------------------------------------------
    function Na__LeSpec__SetRevision(revision, live) {
        if (!Na__LeSpec__CanEdit()) return false;
        const setup = Na__LeCfg__GetSpecificationSetup();
        const value = String(revision === undefined || revision === null ? '' : revision)
            .replace(/^\s*rev\.?\s*/i, '').trim().slice(0, setup.revisionMaxLength);   // <-- "Rev B" typed in full still stores B
        if (Na__LeSpec__Doc[Na__LeSpec__K_REVISION] === value) return false;
        Na__LeSpec__Doc[Na__LeSpec__K_REVISION] = value;
        Na__LeSpec__Changed('revision', { revision : value }, live === true);
        return true;
    }

    function Na__LeSpec__SetDocumentNumber(number, live) {
        if (!Na__LeSpec__CanEdit()) return false;
        const value = String(number === undefined || number === null ? '' : number).trim();   // <-- Blank goes back to following the project code
        if (Na__LeSpec__Doc[Na__LeSpec__K_DOCNUMBER] === value) return false;
        Na__LeSpec__Doc[Na__LeSpec__K_DOCNUMBER] = value;
        Na__LeSpec__Changed('document-number', { number : value }, live === true);
        return true;
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
        Na__LeSpec__SetDoc(Na__LeSpec__Normalise(JSON.parse(json)));
        Na__LeSpec__SetIndex(null);
        const signature = Na__LeSpec__CodeSignature();
        const codesChanged = signature !== Na__LeSpec__CodeSig;
        Na__LeSpec__SetCodeSig(signature);
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
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data Editing: Changes, Undo and Redo
    // ------------------------------------------------------------
    export {
        Na__LeSpec__SetRevision,
        Na__LeSpec__SetDocumentNumber,
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
