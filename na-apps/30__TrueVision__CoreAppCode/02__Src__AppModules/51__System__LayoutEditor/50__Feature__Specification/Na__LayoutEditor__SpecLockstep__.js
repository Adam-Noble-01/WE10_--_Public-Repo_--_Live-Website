// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION LOCKSTEP QUESTION
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecLockstep__.js
// NAMESPACE  : Na__LeSpecLock
// MODULE     : Layout Editor - Specification - The Lockstep Question
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Ask which copy of the specification to keep when the app's copy and its local file are out of step, saying when each changed and which notes differ
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE STATEMENT WRITER'S QUESTION, FOR THE SPECIFICATION. The same card over
//   the page with two large answers and no way out but an answer - nothing is
//   saved while it stands, so closing it would only leave the specification
//   stuck. "Keep the app's copy" writes it to the file; "Load the
//   specification file" replaces the app's copy. The newer copy wears the
//   blue of an open row, a Newer badge and the focus, so the eye and the
//   Enter key land on the latest.
// - IT SAYS WHAT CHANGED, not only that something did: the codes of the notes
//   only one copy holds, the notes worded or numbered differently, and a
//   revision, document number or group that differs - enough to tell an
//   agent's new note from a whole group rewritten.
// - ONE QUESTION FOR THE WHOLE DRAWING EDITOR. The specification is read on
//   every sheet (its bubbles and notes margins), not only on its own tab, so
//   the question sits over the editor host whichever view is showing -
//   above the specification page, the register, the statements and the
//   first-open veil.
// - The data is Na__LayoutEditor__SpecData__'s: it decides when to ask
//   (CHANGED_EVENT 'conflict'), what to say (GetConflict) and what an answer
//   does (ResolveConflict). This file only shows and takes the answer.
//
// INTEGRATION:
// - Mounted once into the editor host by Na__LayoutEditor__ModeController__,
//   only where this session may author (a reader has no copy of its own to
//   fall out of step). Its stylesheet is Na__LayoutEditor__Styles__
//   Specification__.css (the region "The Lockstep Question"), which the CSS
//   index loads with the app.
// - Imports the Statement Writer's pure lockstep rules for the time put into
//   words, so both questions say a time the same way.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the Statement Writer's question (Na__LayoutEditor__
//                   Statement__Page__, TrueVision3D v2.157.0), made a module
//                   of its own because the specification has no single page
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config Labels, the Specification and the Statement Writer's Time Words
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSpec__CHANGED_EVENT, Na__LeSpec__GetConflict, Na__LeSpec__ResolveConflict } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeStmtLock__When } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Lockstep__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Many Codes a List Names Before "and N more"
    // ------------------------------------------------------------
    const Na__LeSpecLock__MAX_CODES = 6;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Host and the Question, Built on First Need
    // ------------------------------------------------------------
    let Na__LeSpecLock__Host    = null;
    let Na__LeSpecLock__Root    = null;
    let Na__LeSpecLock__Busy    = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Some Text
    // ------------------------------------------------------------
    function Na__LeSpecLock__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Count Put Into Words ("1 note", "3 notes")
    // ------------------------------------------------------------
    function Na__LeSpecLock__Notes(count) {
        return count + (count === 1 ? ' note' : ' notes');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A List of Codes, Cut Short When Long ("EW03, EW04 and 2 more")
    // ------------------------------------------------------------
    function Na__LeSpecLock__Codes(codes) {
        const list  = (codes || []).filter(Boolean);
        const shown = list.slice(0, Na__LeSpecLock__MAX_CODES).join(', ');
        const rest  = list.length - Na__LeSpecLock__MAX_CODES;
        return rest > 0 ? shown + ' and ' + rest + ' more' : shown;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What an Answer Keeps, or Drops ("Drops the note only in the file.")
    // ------------------------------------------------------------
    function Na__LeSpecLock__Holds(dropped, where, kept) {
        const count = (dropped || []).length;
        if (count === 1) return 'Drops the note only in the ' + where + '.';
        if (count > 1)   return 'Drops the ' + count + ' notes only in the ' + where + '.';
        return 'Holds ' + Na__LeSpecLock__Notes(kept || 0) + '.';
    }
    // ------------------------------------------------------------


    // FUNCTION | What Differs, as One Line
    // ------------------------------------------------------------
    // Built from the question's summary (Na__LeSpec__LockSummary). A note
    // renumbered between the two copies is named by both its codes.
    // ------------------------------------------------------------
    function Na__LeSpecLock__Differs(summary) {
        const parts = [];
        const s = summary || {};
        if (s.onlyInFile && s.onlyInFile.length) parts.push(Na__LeSpecLock__Notes(s.onlyInFile.length) + ' only in the file (' + Na__LeSpecLock__Codes(s.onlyInFile) + ')');
        if (s.onlyInApp && s.onlyInApp.length)   parts.push(Na__LeSpecLock__Notes(s.onlyInApp.length) + ' only in the app (' + Na__LeSpecLock__Codes(s.onlyInApp) + ')');
        if (s.changed && s.changed.length) {
            const codes = s.changed.map((pair) => (pair.app === pair.file ? pair.app : pair.app + ' (' + pair.file + ' in the file)'));
            parts.push(Na__LeSpecLock__Notes(s.changed.length) + ' worded or numbered differently (' + Na__LeSpecLock__Codes(codes) + ')');
        }
        if (s.revision) parts.push('the revision (' + (s.revision.app || 'none') + ' in the app, ' + (s.revision.file || 'none') + ' in the file)');
        if (s.number)   parts.push('the document number');
        if (s.groups)   parts.push('a group\'s prefix, title or General setting');
        return parts.length
            ? Na__LeCfg__GetLabel('SpecLockDiffersLead', 'What differs: ') + parts.join(' · ') + '.'
            : Na__LeCfg__GetLabel('SpecLockDiffersNothing', 'The notes read the same in both; the file only needs the ids this app gave them.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Question
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One of the Two Answers, as a Large Button
    // ------------------------------------------------------------
    function Na__LeSpecLock__Choice(choice) {
        const button = Na__LeSpecLock__El('button', 'na-le-spec-lock__choice');
        button.type = 'button';
        button.dataset.choice = choice;
        const head = Na__LeSpecLock__El('span', 'na-le-spec-lock__head');
        head.appendChild(Na__LeSpecLock__El('span', 'na-le-spec-lock__name', ''));
        head.appendChild(Na__LeSpecLock__El('span', 'na-le-spec-lock__badge', Na__LeCfg__GetLabel('SpecLockNewer', 'Newer')));
        button.appendChild(head);
        button.appendChild(Na__LeSpecLock__El('span', 'na-le-spec-lock__kind', ''));
        button.appendChild(Na__LeSpecLock__El('span', 'na-le-spec-lock__when', ''));
        button.appendChild(Na__LeSpecLock__El('span', 'na-le-spec-lock__what', ''));
        button.addEventListener('click', () => { void Na__LeSpecLock__Answer(choice); });
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Question Once
    // ------------------------------------------------------------
    function Na__LeSpecLock__Build() {
        if (Na__LeSpecLock__Root) return Na__LeSpecLock__Root;
        const root = Na__LeSpecLock__El('div', 'na-le-spec-lock');
        root.hidden = true;
        root.setAttribute('role', 'alertdialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'na-le-spec-lock-title');

        const card  = Na__LeSpecLock__El('div', 'na-le-spec-lock__card');
        const title = Na__LeSpecLock__El('h3', 'na-le-spec-lock__title', Na__LeCfg__GetLabel('SpecLockTitle', 'The specification and its file on disk are out of step'));
        title.id = 'na-le-spec-lock-title';
        card.appendChild(title);
        card.appendChild(Na__LeSpecLock__El('p', 'na-le-spec-lock__lead', ''));
        card.appendChild(Na__LeSpecLock__El('p', 'na-le-spec-lock__differs', ''));

        const choices = Na__LeSpecLock__El('div', 'na-le-spec-lock__choices');
        choices.appendChild(Na__LeSpecLock__Choice('app'));
        choices.appendChild(Na__LeSpecLock__Choice('file'));
        card.appendChild(choices);

        card.appendChild(Na__LeSpecLock__El('p', 'na-le-spec-lock__foot', Na__LeCfg__GetLabel('SpecLockFoot',
            'Nothing is saved until you choose. The newer copy is marked, and is usually the one to keep. Whichever you do not choose is kept in this browser, so choosing loses nothing.')));
        root.appendChild(card);

        // THE KEYBOARD STAYS ON THE QUESTION. Tab moves between the two answers
        // and nowhere else; Escape does nothing, because there is nothing to go
        // back to; and no key reaches the sheet's tools underneath.
        root.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); return; }
            if (event.key !== 'Tab') return;
            const buttons = Array.from(root.querySelectorAll('.na-le-spec-lock__choice'));
            const at = buttons.indexOf(document.activeElement);
            event.preventDefault();
            const next = buttons[(at + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length];
            if (next) next.focus();
        });

        Na__LeSpecLock__Host.appendChild(root);
        Na__LeSpecLock__Root = root;
        return root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask
    // ------------------------------------------------------------
    // The words come from the question itself: which copy moved, when each
    // last changed, and which notes differ. The Newer badge appears only where
    // the two times are far enough apart to say so honestly.
    // ------------------------------------------------------------
    function Na__LeSpecLock__Show() {
        const conflict = Na__LeSpec__GetConflict();
        if (!conflict || !Na__LeSpecLock__Host) { Na__LeSpecLock__Hide(); return false; }
        const root = Na__LeSpecLock__Build();

        const appWhen  = Na__LeStmtLock__When(conflict.appIso);
        const fileWhen = Na__LeStmtLock__When(conflict.fileIso);
        const lead = (conflict.kind === 'open')
            ? Na__LeCfg__FormatLabel('SpecLockLeadOpen', 'This browser is holding unsaved changes to the specification made {app}, and the specification file on disk is not the same - it was last changed {file}. Choose which to carry on with.', { app : appWhen, file : fileWhen })
            : (conflict.kind === 'file')
                ? Na__LeCfg__FormatLabel('SpecLockLeadFile', 'The specification file was changed outside the app {file} - by an agent, or by hand. Nothing in the app is unsaved. Choose which to carry on with.', { file : fileWhen })
                : Na__LeCfg__FormatLabel('SpecLockLeadBoth', 'The specification file was changed outside the app {file}, while the app had changes of its own, made {app}. Choose which to keep.', { app : appWhen, file : fileWhen });
        root.querySelector('.na-le-spec-lock__lead').textContent    = lead;
        root.querySelector('.na-le-spec-lock__differs').textContent = Na__LeSpecLock__Differs(conflict.summary);

        const app  = root.querySelector('.na-le-spec-lock__choice[data-choice="app"]');
        const file = root.querySelector('.na-le-spec-lock__choice[data-choice="file"]');
        const sum  = conflict.summary || {};

        app.querySelector('.na-le-spec-lock__name').textContent = Na__LeCfg__GetLabel('SpecLockKeepApp', 'Keep the app\'s copy');
        app.querySelector('.na-le-spec-lock__kind').textContent = (conflict.appFrom === 'draft')
            ? Na__LeCfg__GetLabel('SpecLockKindDraft', 'JSON  ·  this browser\'s unsaved draft')
            : Na__LeCfg__GetLabel('SpecLockKindApp', 'JSON  ·  what is in the app');
        app.querySelector('.na-le-spec-lock__when').textContent = ((conflict.kind === 'file') ? 'As last loaded or saved ' : 'Last changed ') + appWhen;
        app.querySelector('.na-le-spec-lock__what').textContent = 'Writes it to the specification file. '
            + Na__LeSpecLock__Holds(sum.onlyInFile, 'file', sum.appNotes);

        file.querySelector('.na-le-spec-lock__name').textContent = Na__LeCfg__GetLabel('SpecLockLoadFile', 'Load the specification file');
        file.querySelector('.na-le-spec-lock__kind').textContent = (conflict.fileName || 'The file') + '  ·  on disk';
        file.querySelector('.na-le-spec-lock__when').textContent = 'Changed on disk ' + fileWhen;
        file.querySelector('.na-le-spec-lock__what').textContent = 'Replaces what is in the app; Save Sheets sends it to the cloud. '
            + Na__LeSpecLock__Holds(sum.onlyInApp, 'app', sum.fileNotes);

        app.classList.toggle('is-newer',  conflict.newer === 'app');
        file.classList.toggle('is-newer', conflict.newer === 'file');
        for (const button of [ app, file ]) { button.disabled = false; button.classList.remove('is-busy'); }

        const wasHidden = root.hidden;
        root.hidden = false;
        if (wasHidden) (conflict.newer === 'app' ? app : file).focus();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Asking
    // ------------------------------------------------------------
    function Na__LeSpecLock__Hide() {
        if (Na__LeSpecLock__Root) Na__LeSpecLock__Root.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Answer
    // ------------------------------------------------------------
    async function Na__LeSpecLock__Answer(choice) {
        const root = Na__LeSpecLock__Root;
        if (!root || root.hidden || Na__LeSpecLock__Busy) return;
        Na__LeSpecLock__Busy = true;
        const buttons = Array.from(root.querySelectorAll('.na-le-spec-lock__choice'));
        for (const button of buttons) button.disabled = true;
        const picked = buttons.find((button) => button.dataset.choice === choice);
        if (picked) picked.classList.add('is-busy');
        try {
            await Na__LeSpec__ResolveConflict(choice);                         // <-- Says for itself, in a toast, how it went
        } finally {
            Na__LeSpecLock__Busy = false;
        }
        if (Na__LeSpec__GetConflict()) Na__LeSpecLock__Show();                 // <-- Still (or newly) out of step: ask again
        else                           Na__LeSpecLock__Hide();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mounting
// -----------------------------------------------------------------------------

    // FUNCTION | Mount Once Onto the Editor Host
    // ------------------------------------------------------------
    // Nothing is built until there is something to ask. Every change to the
    // specification is a chance the question was answered some other way (a
    // reload, another project), so each one puts the card in step with it.
    // ------------------------------------------------------------
    function Na__LeSpecLock__Mount(host) {
        if (Na__LeSpecLock__Host || !host) return false;
        Na__LeSpecLock__Host = host;
        window.addEventListener(Na__LeSpec__CHANGED_EVENT, (event) => {
            const reason = (event && event.detail) ? event.detail.reason : '';
            if (Na__LeSpecLock__Busy) return;                                  // <-- The answer puts the card right itself when it lands
            if (Na__LeSpec__GetConflict()) { if (reason === 'conflict' || reason === 'loaded' || !Na__LeSpecLock__Root || Na__LeSpecLock__Root.hidden) Na__LeSpecLock__Show(); }
            else Na__LeSpecLock__Hide();
        });
        if (Na__LeSpec__GetConflict()) Na__LeSpecLock__Show();                 // <-- Asked before the editor was built
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Question Up
    // ------------------------------------------------------------
    function Na__LeSpecLock__IsShown() {
        return !!Na__LeSpecLock__Root && !Na__LeSpecLock__Root.hidden;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Lockstep Question API
    // ------------------------------------------------------------
    export {
        Na__LeSpecLock__Mount,
        Na__LeSpecLock__Show,
        Na__LeSpecLock__Hide,
        Na__LeSpecLock__IsShown,
        Na__LeSpecLock__Differs
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
