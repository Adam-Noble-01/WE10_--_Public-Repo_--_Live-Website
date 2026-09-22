// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION SCRAPBOOK - ROW EDITOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookSpecification__RowEditor__.js
// NAMESPACE  : Na__LeScrapSpecEd
// MODULE     : Layout Editor - Specification Scrapbook Row Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Edit a specification note where the drawing's Specification tab lists it: its title and text in place of its row, saved with Enter
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY IT EXISTS. Adam, 22-Sep: "it takes a long time traversing all of the
//   multiple tabs to edit one small tweak to say the wording of one point".
//   The note is already on screen, in the left column beside the drawing; this
//   lets it be reworded there. Right-click a row, Edit spec item (or F2 on a
//   row), and the row becomes its note's title and text, spell-checked.
// - ENTER SAVES. Shift+Enter is a new line in the text; Escape puts the row
//   back as it was. Clicking away saves too - what was typed is never thrown
//   away by a click - but a window that merely loses the focus (another
//   program brought forward to look up a product name) leaves the edit open.
// - THE SAVE IS THE SPECIFICATION'S OWN. What changed goes through
//   Na__LeSpec__UpdateNote, the same call the Project Specification tab
//   commits with: one undo step on that tab, the browser draft, the change
//   announced so every sheet's notes margin follows. Then, at once:
//     1. the browser draft is written (FlushDraft), not a moment later, and
//     2. the local TrueVision__DrawingNotes__.json is written and READ BACK
//        (Na__LeSpec__WriteLocalCopy) - "it updates the local version".
//   R2 is left to Save Sheets, which already syncs a changed specification
//   and lights up while one is waiting.
// - ONLY WHAT WAS TYPED IS WRITTEN. The title and the text are compared with
//   what the note held when the editor opened, and only a field that was
//   changed is sent. A field left alone is never written back - so a change
//   made to it meanwhile, by a reload or another tab, is not undone.
// - NOTHING TYPED IS LOST TO A REFUSAL. If the specification cannot take the
//   change just then (read-only, not loaded), the editor stays open with the
//   text in it and a toast says why.
// - ONE ROW AT A TIME. Opening another row saves the first. The panel does
//   not rebuild its rows while a row is open (it asks IsEditing), so a
//   bubble placed or a count updated never takes the editor away.
// - THE CARET GOES WHERE THE RIGHT-CLICK WAS. OffsetAtPoint reads which
//   character of the row's title or text was under the pointer, so right-click
//   on the word to change, Edit spec item, and the caret is in that word.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookSpecification__ opens it from a row's
//   right-click menu and from F2, asks IsEditing before rebuilding its rows,
//   and is told when it closes.
// // @delegate: ../../55__Feature__SpellCheck/Na__SpellCheck__.js
// // @delegate: ../50__Feature__Specification/Na__LayoutEditor__SpecData__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific but the
//                   local-file write, which is the Transport unit's.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.144.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Specification, Surface, Panel Host, the Library's Labels and the Spell Check
    // ------------------------------------------------------------
    import {
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsEditable,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__UpdateNote,
        Na__LeSpec__FlushDraft,
        Na__LeSpec__WriteLocalCopy
    } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeSurface__GetElements } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LePanels__IsEditable, Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeScrapSpec__Label } from './Na__LayoutEditor__ScrapbookSpecification__.js';
    import { Na__SpellCheck__Field, Na__SpellCheck__WordBar } from '../../55__Feature__SpellCheck/Na__SpellCheck__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes, and How Far the Caret Search Reads
    // ------------------------------------------------------------
    const Na__LeScrapSpecEd__CLASS          = 'na-le-scrapspec-edit';
    const Na__LeScrapSpecEd__TILE_EDITING   = 'is-editing';                     // <-- On the row's tile while the editor stands in for it
    const Na__LeScrapSpecEd__POINT_MAX_CHARS = 4000;                           // <-- A note longer than this puts the caret at the end instead
    // ------------------------------------------------------------

    // MODULE VARIABLES | The One Row Being Edited
    // ------------------------------------------------------------
    // { noteId, code, row, root, title, body, bar, original : { title, body },
    //   onClosed, closing }
    // ------------------------------------------------------------
    let Na__LeScrapSpecEd__Session = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Toast(message, isError) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | May a Note Be Edited Now: { ok, why }
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__CanEdit() {
        const L = Na__LeScrapSpec__Label;
        if (!Na__LePanels__IsEditable()) return { ok : false, why : L('EditReadOnly', 'Notes can only be edited while the sheets are editable.') };
        if (!Na__LeSpec__IsLoaded())     return { ok : false, why : L('EditNotLoaded', 'The project specification has not finished loading.') };
        if (!Na__LeSpec__IsEditable())   return { ok : false, why : L('EditSpecReadOnly', 'The project specification is read-only here.') };
        return { ok : true, why : '' };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Title as It Is Kept: One Line, Trimmed
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__TidyTitle(text) {
        return String(text === undefined || text === null ? '' : text).replace(/\s*[\r\n]+\s*/g, ' ').trim();
    }
    // ------------------------------------------------------------


    // FUNCTION | A Note's Text as It Is Kept: Its Line Breaks, Trimmed at Either End
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__TidyBody(text) {
        return String(text === undefined || text === null ? '' : text).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
    }
    // ------------------------------------------------------------


    // FUNCTION | What to Send: Only the Fields That Were Typed Into, and Differ From the Note Now
    // ------------------------------------------------------------
    // original: the note's { title, body } when the editor opened. typed: the
    // editor's { title, body } now. current: the note's { title, body } now.
    // A field whose box still reads what it opened with was not touched, and
    // is left out even if the note has changed since - that change is kept.
    // Returns the patch UpdateNote takes, or null for nothing to write.
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Patch(original, typed, current) {
        const patch = {};
        if (typed.title !== original.title) {
            const title = Na__LeScrapSpecEd__TidyTitle(typed.title);
            if (title !== current.title) patch.title = title;
        }
        if (typed.body !== original.body) {
            const body = Na__LeScrapSpecEd__TidyBody(typed.body);
            if (body !== current.body) patch.body = body;
        }
        return Object.keys(patch).length ? patch : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Character of an Element's Text Is Under a Client Point (null: none)
    // ------------------------------------------------------------
    // Asked of the row's title and text, which are drawn with pointer-events
    // off (the tile takes every press), so the browser's own caretRangeFromPoint
    // cannot see into them: each character's boxes are measured instead, and
    // the offset is on whichever side of the character's middle the point is.
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__OffsetAtPoint(element, clientX, clientY) {
        if (!element || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const range  = document.createRange();
        let before = 0, node;
        while ((node = walker.nextNode())) {
            const length = node.data.length;
            for (let i = 0; i < length; i++) {
                if (before + i > Na__LeScrapSpecEd__POINT_MAX_CHARS) return null;
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rects = range.getClientRects();
                for (let r = 0; r < rects.length; r++) {
                    const box = rects[r];
                    if (clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom) {
                        return before + i + (clientX > box.left + (box.width / 2) ? 1 : 0);
                    }
                }
            }
            before += length;
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Give the Keys Back to the Sheet
    // ------------------------------------------------------------
    // After Enter, Escape or a button, as a panel field does after its Enter
    // (EnterLeavesField): the next V, M or Delete is the drawing's.
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__FocusSheet() {
        const stage = Na__LeSurface__GetElements().stage;
        if (stage && stage.isConnected && typeof stage.focus === 'function') {
            try { stage.focus({ preventScroll : true }); } catch (error) { /* focus is a courtesy */ }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Opening and Closing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Editor That Stands In for a Row
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Build(session, thumbMarkup) {
        const L    = Na__LeScrapSpec__Label;
        const root = document.createElement('div');
        root.className = Na__LeScrapSpecEd__CLASS;
        root.setAttribute('role', 'group');
        root.setAttribute('aria-label', L('EditAria', 'Edit {code}', { code : session.code }));
        root.setAttribute('data-na-scrapspec-edit', session.noteId);

        const head = document.createElement('div');
        head.className = Na__LeScrapSpecEd__CLASS + '__head';
        const thumb = document.createElement('span');
        thumb.className = Na__LeScrapSpecEd__CLASS + '__thumb';
        thumb.innerHTML = thumbMarkup || '';                                   // <-- The row's own bubble, as it was drawn
        const caption = document.createElement('span');
        caption.className   = Na__LeScrapSpecEd__CLASS + '__caption';
        caption.textContent = L('EditHeading', 'Editing {code}', { code : session.code });
        head.appendChild(thumb);
        head.appendChild(caption);
        root.appendChild(head);

        const submit = () => Na__LeScrapSpecEd__Commit('enter');
        const cancel = () => Na__LeScrapSpecEd__Cancel();
        session.title = Na__SpellCheck__Field({ text : session.original.title, multiline : false, className : Na__LeScrapSpecEd__CLASS + '__title', label : L('EditTitleLabel', 'Title of {code}', { code : session.code }), placeholder : L('EditTitleHolder', 'Title'), onSubmit : submit, onCancel : cancel });
        session.body  = Na__SpellCheck__Field({ text : session.original.body, multiline : true, className : Na__LeScrapSpecEd__CLASS + '__body', label : L('EditBodyLabel', 'Specification text of {code}', { code : session.code }), placeholder : L('EditBodyHolder', 'Specification text'), onSubmit : submit, onCancel : cancel });
        root.appendChild(session.title.element);
        root.appendChild(session.body.element);

        session.bar = Na__SpellCheck__WordBar({ fields : [ session.title, session.body ], showToast : Na__LeScrapSpecEd__Toast });
        session.bar.element.classList.add(Na__LeScrapSpecEd__CLASS + '__words');
        root.appendChild(session.bar.element);

        const foot = document.createElement('div');
        foot.className = Na__LeScrapSpecEd__CLASS + '__foot';
        const keys = document.createElement('span');
        keys.className   = Na__LeScrapSpecEd__CLASS + '__keys';
        keys.textContent = L('EditKeys', 'Enter saves · Shift+Enter new line · Esc cancels');
        foot.appendChild(keys);
        const button = (text, modifier, onClick) => {
            const el = document.createElement('button');
            el.type        = 'button';
            el.className   = 'na-le-btn na-le-btn--small' + (modifier ? ' ' + modifier : '');
            el.textContent = text;
            el.addEventListener('pointerdown', (event) => event.preventDefault());   // <-- The box keeps the focus: a press here is not a click away
            el.addEventListener('mousedown', (event) => event.preventDefault());
            el.addEventListener('click', onClick);
            return el;
        };
        foot.appendChild(button(L('EditSave', 'Save'), 'na-le-btn--primary', () => Na__LeScrapSpecEd__Commit('button')));
        foot.appendChild(button(L('EditCancel', 'Cancel'), '', () => Na__LeScrapSpecEd__Cancel()));
        root.appendChild(foot);

        // CLICKING AWAY SAVES; LOOKING AWAY DOES NOT. Focus moving between the
        // two boxes and the buttons stays inside; focus leaving for anything
        // else on the page saves, the way leaving a cell does. A window that
        // loses the focus altogether keeps the edit open for when it is back.
        root.addEventListener('focusout', (event) => {
            if (Na__LeScrapSpecEd__Session !== session || session.closing) return;
            const next = event.relatedTarget;
            if (next && root.contains(next)) return;
            if (typeof document.hasFocus === 'function' && !document.hasFocus()) return;
            Na__LeScrapSpecEd__Commit('blur');
        });
        // A PRESS INSIDE THE EDITOR belongs to it: the column's own delegation
        // and the tile drag never see it, and it never starts a drag.
        root.addEventListener('pointerdown', (event) => event.stopPropagation());
        return root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Editor in Place of a Row
    // ------------------------------------------------------------
    // row: the panel's row ({ note, tile, titleEl, bodyEl }). options:
    // { field : 'title' | 'body', at : an offset or 'end', onClosed }.
    // Another row open is saved first. Returns true when the editor opened.
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Open(row, options) {
        const opts = options || {};
        if (!row || !row.note || !row.tile || !row.tile.isConnected) return false;
        const current = Na__LeScrapSpecEd__Session;
        if (current && current.noteId === row.note.noteId) {
            (opts.field === 'title' ? current.title : current.body).focus(Number.isFinite(opts.at) ? opts.at : 'end');
            return true;
        }
        if (current) {
            Na__LeScrapSpecEd__Commit('switch');
            if (Na__LeScrapSpecEd__Session) return false;                      // <-- The first could not be saved; it stays open
            if (!row.tile.isConnected) return false;                           // <-- Its save rebuilt the rows: the caller asks again with the new row
        }

        const can = Na__LeScrapSpecEd__CanEdit();
        if (!can.ok) { Na__LeScrapSpecEd__Toast(can.why, true); return false; }
        const entry = Na__LeSpec__GetNoteEntry(row.note.noteId);
        if (!entry) { Na__LeScrapSpecEd__Toast(Na__LeScrapSpec__Label('EditGone', 'That note is no longer in the specification.'), true); return false; }

        const session = {
            noteId   : row.note.noteId,
            code     : entry.code,
            row      : row,
            root     : null, title : null, body : null, bar : null,
            original : { title : entry.note.Note__Title || '', body : entry.note.Note__Body || '' },
            onClosed : typeof opts.onClosed === 'function' ? opts.onClosed : null,
            closing  : false
        };
        const thumb = row.tile.querySelector('.na-le-scrap__thumb');
        session.root = Na__LeScrapSpecEd__Build(session, thumb ? thumb.innerHTML : '');
        row.tile.classList.add(Na__LeScrapSpecEd__TILE_EDITING);
        row.tile.insertAdjacentElement('afterend', session.root);
        Na__LeScrapSpecEd__Session = session;

        const field = opts.field === 'title' ? session.title : session.body;
        field.focus(Number.isFinite(opts.at) ? opts.at : 'end');
        try { session.root.scrollIntoView({ block : 'nearest' }); } catch (error) { /* older engines */ }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Row Back: the Editor Goes, the Tile Returns
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Close(session, giveKeysBack) {
        if (!session) return;
        session.closing = true;
        if (Na__LeScrapSpecEd__Session === session) Na__LeScrapSpecEd__Session = null;
        [ session.title, session.body, session.bar ].forEach((part) => { if (part) part.destroy(); });
        if (session.row && session.row.tile) session.row.tile.classList.remove(Na__LeScrapSpecEd__TILE_EDITING);
        const hadFocus = session.root && session.root.contains(document.activeElement);
        if (session.root && session.root.parentNode) session.root.parentNode.removeChild(session.root);
        if (giveKeysBack && hadFocus) Na__LeScrapSpecEd__FocusSheet();
        if (session.onClosed) {
            try { session.onClosed(session.noteId); } catch (error) { console.warn('[TrueVision3D LayoutEditor] The Specification tab could not follow the closed editor.', error); }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Open Row: { ok, changed }
    // ------------------------------------------------------------
    // how: 'enter', 'button', 'blur', 'switch'. The editor closes BEFORE the
    // change is announced, so the panel's rebuild on that announcement is the
    // ordinary one. Nothing typed is lost to a refusal: the editor stays open.
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Commit(how) {
        const session = Na__LeScrapSpecEd__Session;
        if (!session || session.closing) return { ok : false, changed : false };
        const L       = Na__LeScrapSpec__Label;
        const keys    = how === 'enter' || how === 'button';
        const entry   = Na__LeSpec__GetNoteEntry(session.noteId);
        if (!entry) { Na__LeScrapSpecEd__Abandon(); return { ok : false, changed : false }; }

        const typed   = { title : session.title.getText(), body : session.body.getText() };
        const current = { title : entry.note.Note__Title || '', body : entry.note.Note__Body || '' };
        const patch   = Na__LeScrapSpecEd__Patch(session.original, typed, current);
        if (!patch) { Na__LeScrapSpecEd__Close(session, keys); return { ok : true, changed : false }; }

        const can = Na__LeScrapSpecEd__CanEdit();
        if (!can.ok) { Na__LeScrapSpecEd__Toast(can.why, true); return { ok : false, changed : false }; }

        const code = entry.code;
        Na__LeScrapSpecEd__Close(session, keys);
        if (!Na__LeSpec__UpdateNote(session.noteId, patch, false)) {             // <-- The Project Specification tab's own commit: one undo step, the draft, the announcement
            Na__LeScrapSpecEd__Toast(L('EditFailed', '{code} could not be saved just now; the specification did not take the change.', { code : code }), true);
            return { ok : false, changed : false };
        }
        Na__LeSpec__FlushDraft();                                              // <-- The browser draft now, not once the typing has paused
        Na__LeSpec__WriteLocalCopy().then((result) => {
            if (result.ok) Na__LeScrapSpecEd__Toast(L('EditSavedLocal', '{code} saved to the local specification file. Save Sheets sends it to the cloud.', { code : code }), false);
            else if (result.skipped) Na__LeScrapSpecEd__Toast(L('EditSavedBrowser', '{code} saved in this browser. Save Sheets sends it to the cloud.', { code : code }), false);
            else Na__LeScrapSpecEd__Toast(L('EditLocalFailed', '{code} is saved in this browser, but the local specification file was not written ({error}). Save Sheets writes it and sends it to the cloud.', { code : code, error : result.error || 'unknown' }), true);
        });
        return { ok : true, changed : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Open Row Back Unchanged
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Cancel() {
        const session = Na__LeScrapSpecEd__Session;
        if (!session || session.closing) return false;
        Na__LeScrapSpecEd__Close(session, true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Note Has Gone From Under the Editor: Close It and Say So
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__Abandon() {
        const session = Na__LeScrapSpecEd__Session;
        if (!session || session.closing) return false;
        Na__LeScrapSpecEd__Close(session, false);
        Na__LeScrapSpecEd__Toast(Na__LeScrapSpec__Label('EditRemoved', '{code} left the specification while it was being edited, so the edit was not saved.', { code : session.code }), true);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | State
    // ------------------------------------------------------------
    function Na__LeScrapSpecEd__IsEditing()     { return !!Na__LeScrapSpecEd__Session; }
    function Na__LeScrapSpecEd__EditedNoteId()  { return Na__LeScrapSpecEd__Session ? Na__LeScrapSpecEd__Session.noteId : null; }
    function Na__LeScrapSpecEd__Element()       { return Na__LeScrapSpecEd__Session ? Na__LeScrapSpecEd__Session.root : null; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Scrapbook Row Editor API
    // ------------------------------------------------------------
    export {
        Na__LeScrapSpecEd__CanEdit,
        Na__LeScrapSpecEd__TidyTitle,
        Na__LeScrapSpecEd__TidyBody,
        Na__LeScrapSpecEd__Patch,
        Na__LeScrapSpecEd__OffsetAtPoint,
        Na__LeScrapSpecEd__Open,
        Na__LeScrapSpecEd__Commit,
        Na__LeScrapSpecEd__Cancel,
        Na__LeScrapSpecEd__Abandon,
        Na__LeScrapSpecEd__IsEditing,
        Na__LeScrapSpecEd__EditedNoteId,
        Na__LeScrapSpecEd__Element
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
