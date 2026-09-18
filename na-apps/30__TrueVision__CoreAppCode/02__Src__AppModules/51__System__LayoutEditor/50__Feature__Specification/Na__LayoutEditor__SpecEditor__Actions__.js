// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - ACTIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__Actions__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Actions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Switching between Edit and Read, and the Project Specification page's clicks, typing, commits and keys
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Switching between Edit and Read commits the field with the focus first,
//   and each view keeps its scroll.
// - A click on anything carrying an action: open a sheet, change the view,
//   print, Headings only, then (where the specification can be edited) add
//   groups and notes, undo and redo, sync and retry, move and delete groups,
//   delete notes and link bubbles. Deleting a note asks first when it holds
//   text or bubbles show it, and deleting a group when it holds notes.
// - Typing goes live into the specification with no undo step, and a field's
//   commit is one undo step. A refused prefix is put back, with the reason
//   beside its group.
// - Keys: Enter commits a one-line field, Escape clears the filter, Alt+Up
//   and Alt+Down move a note, and Ctrl+Z and Ctrl+Y outside a text field
//   step the history in Edit. No key on the page reaches the sheet's.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecEditor__ listens with these on the page's root and
//   exports SetView as its own. Ending a drag is
//   Na__LayoutEditor__SpecEditor__NoteDrag__'s; rebuilds are __Render__'s.
// - Assigns module variables through Na__LayoutEditor__SpecEditor__State__'s
//   accessors.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : n/a
// - Back-port     : n/a (ValeVision3D's copy is already split into the same units)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.1.0
// - Wired the Reload R2 and Reload Local buttons to ReloadFromCloud and
//   ReloadFromLocal.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecEditor__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Specification, Links, Document and the Confirm Dialog
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSpec__GOTO_EVENT,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__AddGroup,
        Na__LeSpec__AddStarterGroups,
        Na__LeSpec__UpdateGroup,
        Na__LeSpec__DeleteGroup,
        Na__LeSpec__MoveGroup,
        Na__LeSpec__AddNote,
        Na__LeSpec__UpdateNote,
        Na__LeSpec__DeleteNote,
        Na__LeSpec__MoveNote,
        Na__LeSpec__Undo,
        Na__LeSpec__Redo,
        Na__LeSpec__Sync,
        Na__LeSpec__Retry,
        Na__LeSpec__ReloadFromCloud,
        Na__LeSpec__ReloadFromLocal,
        Na__LeSpec__GetRevision,
        Na__LeSpec__SetRevision,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__SetDocumentNumber
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__LinkMatching } from './Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeSpecDoc__Print } from './Na__LayoutEditor__SpecDocument__.js';
    import { Na__LeSpecPdf__Download } from './Na__LayoutEditor__SpecPdf__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State, Small Builders, Rendering and the Note Drag
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__VIEW_EDIT,
        Na__LeSpecEd__VIEW_READ,
        Na__LeSpecEd__Root,
        Na__LeSpecEd__Scroll,
        Na__LeSpecEd__Page,
        Na__LeSpecEd__Filter,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__ShowToast,
        Na__LeSpecEd__Shown,
        Na__LeSpecEd__Usage,
        Na__LeSpecEd__Drag,
        Na__LeSpecEd__PrefixError,
        Na__LeSpecEd__Reader,
        Na__LeSpecEd__View,
        Na__LeSpecEd__ScrollBack,
        Na__LeSpecEd__AssignPrefixError,
        Na__LeSpecEd__AssignFocusAfter,
        Na__LeSpecEd__AssignView
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    import {
        Na__LeSpecEd__Grow,
        Na__LeSpecEd__IsCompact,
        Na__LeSpecEd__SetCompact,
        Na__LeSpecEd__StoreView,
        Na__LeSpecEd__IsReading,
        Na__LeSpecEd__Count
    } from './Na__LayoutEditor__SpecEditor__Builders__.js';
    import { Na__LeSpecEd__Render, Na__LeSpecEd__Schedule, Na__LeSpecEd__ApplyFilter } from './Na__LayoutEditor__SpecEditor__Render__.js';
    import { Na__LeSpecEd__DragEnd } from './Na__LayoutEditor__SpecEditor__NoteDrag__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching Between Edit and Read
// -----------------------------------------------------------------------------

    // FUNCTION | Switch Between Edit and Read
    // ------------------------------------------------------------
    // Leaving Edit commits the field that has the focus first, so what was
    // typed is an undo step and is on the pages. Each view keeps its scroll.
    // ------------------------------------------------------------
    function Na__LeSpecEd__SetView(view) {
        const next = view === Na__LeSpecEd__VIEW_READ ? Na__LeSpecEd__VIEW_READ : Na__LeSpecEd__VIEW_EDIT;
        Na__LeSpecEd__StoreView(next);
        if (next === Na__LeSpecEd__View) return false;
        if (Na__LeSpecEd__Root) {
            const active = document.activeElement;
            if (active && Na__LeSpecEd__Page.contains(active) && typeof active.blur === 'function') active.blur();
            if (Na__LeSpecEd__Drag) Na__LeSpecEd__DragEnd(false);
            if (Na__LeSpecEd__Shown) Na__LeSpecEd__ScrollBack[Na__LeSpecEd__View] = Na__LeSpecEd__IsReading() ? Na__LeSpecEd__Reader.scrollTop : Na__LeSpecEd__Scroll.scrollTop;
        }
        Na__LeSpecEd__AssignView(next);
        Na__LeSpecEd__Render();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Delete a Note, Asking First When It Holds Text or Bubbles Show It
    // ------------------------------------------------------------
    async function Na__LeSpecEd__DeleteNote(noteId) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        if (!entry) return;
        const linked  = (Na__LeSpecEd__Usage && Na__LeSpecEd__Usage.byNote.get(noteId)) || [];
        const hasText = (entry.note.Note__Title + entry.note.Note__Body).trim() !== '';
        if (linked.length || hasText) {
            const sheets  = new Set(linked.map((item) => item.sheet.Sheet__Id)).size;
            const tokens  = { code : entry.code, title : entry.note.Note__Title || Na__LeCfg__GetLabel('SpecUntitledNote', 'Untitled note'), count : linked.length, sheets : sheets, prefix : entry.group.Group__Prefix };
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title        : Na__LeCfg__FormatLabel('SpecDeleteNoteTitle', 'Delete {code}?', tokens),
                message      : linked.length
                    ? Na__LeCfg__FormatLabel('SpecDeleteNoteLinked', '{code} is shown by {count} bubble(s) on {sheets} sheet(s). They keep {code} but lose their link, and the {prefix} notes after it are renumbered.', tokens)
                    : Na__LeCfg__FormatLabel('SpecDeleteNotePrompt', 'Delete {code}, {title}? The {prefix} notes after it are renumbered.', tokens),
                confirmLabel  : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'),
                isDestructive : true
            });
            if (!ok) return;
        }
        Na__LeSpec__DeleteNote(noteId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Delete a Group, Asking First When It Holds Notes
    // ------------------------------------------------------------
    async function Na__LeSpecEd__DeleteGroup(groupId) {
        const group = Na__LeSpec__GetGroupById(groupId);
        if (!group) return;
        if (group.Group__Notes.length) {
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title        : Na__LeCfg__FormatLabel('SpecDeleteGroupTitle', 'Delete {prefix}?', { prefix : group.Group__Prefix }),
                message      : Na__LeCfg__FormatLabel('SpecDeleteGroupPrompt', 'Delete {prefix} {title} and its {count} note(s)? Bubbles linked to them keep their last codes but lose their links.', { prefix : group.Group__Prefix, title : group.Group__Title, count : group.Group__Notes.length }),
                confirmLabel  : Na__LeCfg__GetLabel('DeleteLabel', 'Delete'),
                isDestructive : true
            });
            if (!ok) return;
        }
        Na__LeSpec__DeleteGroup(groupId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Click on Anything Carrying an Action
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnClick(event) {
        const button = event.target && event.target.closest ? event.target.closest('[data-na-spec]') : null;
        if (!button || !Na__LeSpecEd__Root.contains(button) || button.disabled) return;
        const L       = Na__LeCfg__GetLabel;
        const action  = button.getAttribute('data-na-spec');
        const noteId  = button.getAttribute('data-note-id');
        const groupId = button.getAttribute('data-group-id');
        const toast   = (message, isError) => { if (typeof Na__LeSpecEd__ShowToast === 'function') Na__LeSpecEd__ShowToast(message, isError === true); };

        if (action === 'goto') {
            window.dispatchEvent(new CustomEvent(Na__LeSpec__GOTO_EVENT, { detail : { sheetId : button.getAttribute('data-sheet-id'), leaderId : button.getAttribute('data-leader-id') } }));
            return;
        }
        if (action === 'view')    { Na__LeSpecEd__SetView(button.getAttribute('data-view')); return; }
        if (action === 'print')   { Na__LeSpecDoc__Print(); return; }
        if (action === 'download') {                                               // <-- Reading a document, not changing one: allowed in a read-only session
            void Na__LeSpecPdf__Download((message, kind) => toast(message, kind === 'error' || kind === 'warn'));
            return;
        }
        if (action === 'compact') { Na__LeSpecEd__SetCompact(!Na__LeSpecEd__IsCompact()); Na__LeSpecEd__Render(); return; }
        if (!Na__LeSpecEd__Editable) return;

        switch (action) {
            case 'add-group': {
                const group = Na__LeSpec__AddGroup({});
                if (group) Na__LeSpecEd__AssignFocusAfter({ selector : '[data-na-spec-field="group-prefix"][data-group-id="' + CSS.escape(group.Group__Id) + '"]', start : 0, end : group.Group__Prefix.length });
                return;
            }
            case 'starter':      Na__LeSpec__AddStarterGroups(); return;
            case 'undo':         Na__LeSpec__Undo(); return;
            case 'redo':         Na__LeSpec__Redo(); return;
            case 'sync':         void Na__LeSpec__Sync({ showToast : Na__LeSpecEd__ShowToast }); return;
            case 'retry':        void Na__LeSpec__Retry(); return;
            case 'reload-cloud': void Na__LeSpec__ReloadFromCloud(); return;
            case 'reload-local': void Na__LeSpec__ReloadFromLocal(); return;
            case 'group-up':
            case 'group-down': {
                const index = Na__LeSpec__GetGroups().findIndex((g) => g.Group__Id === groupId);
                if (index !== -1) Na__LeSpec__MoveGroup(groupId, index + (action === 'group-up' ? -1 : 1));
                return;
            }
            case 'group-delete': void Na__LeSpecEd__DeleteGroup(groupId); return;
            case 'note-add': {
                const note = Na__LeSpec__AddNote(groupId, {});
                if (note) Na__LeSpecEd__AssignFocusAfter({ selector : '[data-na-spec-field="note-title"][data-note-id="' + CSS.escape(note.Note__Id) + '"]', start : null, end : null });
                return;
            }
            case 'note-delete':  void Na__LeSpecEd__DeleteNote(noteId); return;
            case 'link-note':
            case 'link-all': {
                const count = Na__LeSpecLink__LinkMatching(action === 'link-note' ? noteId : null);
                toast(Na__LeSpecEd__Count(count, 'SpecLinkedOne', '{count} bubble linked.', 'SpecLinkedMany', '{count} bubbles linked.'), false);
                Na__LeSpecEd__Schedule();
                return;
            }
            default: return;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Typing: Live Into the Specification, No Undo Step Yet
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnInput(event) {
        const target = event.target;
        const field  = target && target.getAttribute ? target.getAttribute('data-na-spec-field') : null;
        if (field === 'filter') { Na__LeSpecEd__ApplyFilter(); return; }
        if (!Na__LeSpecEd__Editable || !field) return;
        const noteId  = target.getAttribute('data-note-id');
        const groupId = target.getAttribute('data-group-id');
        if (field === 'note-title')  Na__LeSpec__UpdateNote(noteId, { title : target.value }, true);
        if (field === 'note-body')   { Na__LeSpecEd__Grow(target); Na__LeSpec__UpdateNote(noteId, { body : target.value }, true); }
        if (field === 'group-title') Na__LeSpec__UpdateGroup(groupId, { title : target.value }, true);
        if (field === 'spec-revision') Na__LeSpec__SetRevision(target.value, true);
        if (field === 'spec-number')   Na__LeSpec__SetDocumentNumber(target.value, true);
        if (field === 'group-prefix') {
            const clean = target.value.toUpperCase().replace(/[^A-Z]/g, '');       // <-- A prefix is letters: show it the way it will be kept
            if (clean !== target.value) {
                const at = Math.max(0, (target.selectionStart || clean.length) - (target.value.length - clean.length));
                target.value = clean;
                try { target.setSelectionRange(at, at); } catch (e) { /* not focused */ }
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Field's Commit: One Undo Step
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnChange(event) {
        const target = event.target;
        const field  = target && target.getAttribute ? target.getAttribute('data-na-spec-field') : null;
        if (!Na__LeSpecEd__Editable || !field || field === 'filter') return;
        const noteId  = target.getAttribute('data-note-id');
        const groupId = target.getAttribute('data-group-id');
        if (field === 'note-title')    Na__LeSpec__UpdateNote(noteId, { title : target.value }, false);
        if (field === 'note-body')     Na__LeSpec__UpdateNote(noteId, { body : target.value }, false);
        if (field === 'group-title')   Na__LeSpec__UpdateGroup(groupId, { title : target.value }, false);
        if (field === 'group-general') Na__LeSpec__UpdateGroup(groupId, { isGeneral : target.checked }, false);
        if (field === 'note-group')    Na__LeSpec__MoveNote(noteId, target.value);
        if (field === 'spec-revision') { Na__LeSpec__SetRevision(target.value, false); target.value = Na__LeSpec__GetRevision(); }           // <-- "Rev B" typed in full comes back as B
        if (field === 'spec-number')   { Na__LeSpec__SetDocumentNumber(target.value, false); target.value = Na__LeSpec__GetDocumentNumber(); }   // <-- Cleared, it shows the project code it now follows
        if (field === 'group-prefix') {
            const group = Na__LeSpec__GetGroupById(groupId);
            if (!group) return;
            const wanted = target.value.trim().toUpperCase();
            if (wanted === group.Group__Prefix) { if (Na__LeSpecEd__PrefixError && Na__LeSpecEd__PrefixError.groupId === groupId) { Na__LeSpecEd__AssignPrefixError(null); Na__LeSpecEd__Schedule(); } return; }
            const result = Na__LeSpec__UpdateGroup(groupId, { prefix : wanted }, false);
            Na__LeSpecEd__AssignPrefixError(result.ok ? null : { groupId : groupId, message : result.message });
            if (!result.ok) { target.value = group.Group__Prefix; Na__LeSpecEd__Schedule(); }   // <-- Refused: the prefix it keeps, and why, beside the group
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keys on the Page
    // ------------------------------------------------------------
    // Enter commits a one-line field (a note's title moves on to its text);
    // Escape clears the filter; Alt+Up and Alt+Down on a note's grip or title
    // move it; Ctrl+Z and Ctrl+Y outside a text field step the tab's history.
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnKeyDown(event) {
        const target = event.target;
        const field  = target && target.getAttribute ? target.getAttribute('data-na-spec-field') : null;
        const action = target && target.getAttribute ? target.getAttribute('data-na-spec') : null;
        event.stopPropagation();                                                  // <-- Nothing on the page reaches the sheet's keys

        if (field === 'filter' && event.key === 'Escape') { target.value = ''; Na__LeSpecEd__ApplyFilter(); event.preventDefault(); return; }
        if (event.key === 'Enter' && target.tagName === 'INPUT' && (field === 'group-prefix' || field === 'group-title' || field === 'note-title')) {
            event.preventDefault();
            if (field === 'note-title') {
                const body = Na__LeSpecEd__Page.querySelector('[data-na-spec-field="note-body"][data-note-id="' + CSS.escape(target.getAttribute('data-note-id')) + '"]');
                if (body) { body.focus(); return; }                               // <-- Leaving the title commits it; the text is next
            }
            target.blur();
            return;
        }
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && (action === 'note-grip' || field === 'note-title') && Na__LeSpecEd__Editable) {
            event.preventDefault();
            if (Na__LeSpecEd__Filter && Na__LeSpecEd__Filter.value.trim()) return;
            if (field === 'note-title') Na__LeSpec__UpdateNote(target.getAttribute('data-note-id'), { title : target.value }, false);   // <-- What was typed is its own step first
            const entry = Na__LeSpec__GetNoteEntry(target.getAttribute('data-note-id'));
            if (entry) Na__LeSpec__MoveNote(entry.note.Note__Id, entry.group.Group__Id, entry.index + (event.key === 'ArrowUp' ? -1 : 1));
            return;
        }
        const typing = target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && [ 'checkbox', 'button' ].indexOf(String(target.type)) === -1);
        if (typing || !(event.ctrlKey || event.metaKey) || !Na__LeSpecEd__Editable || Na__LeSpecEd__IsReading()) return;   // <-- Read changes nothing, from a key or otherwise
        const key = String(event.key).toLowerCase();
        if (key === 'z' && !event.shiftKey) { event.preventDefault(); Na__LeSpec__Undo(); }
        else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); Na__LeSpec__Redo(); }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Actions
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__SetView,
        Na__LeSpecEd__OnClick,
        Na__LeSpecEd__OnInput,
        Na__LeSpecEd__OnChange,
        Na__LeSpecEd__OnKeyDown
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
