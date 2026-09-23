// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT PAGE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Page__.js
// NAMESPACE  : Na__LeStmtPage
// MODULE     : Layout Editor - Statement Writer - The Tab
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Statements tab: which statement is open, how it is being looked at, and what can be done with it
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A PAGE OVER THE DRAWING EDITOR, the way the Project Specification and the
//   Drawing Register are, so the sheet underneath keeps its zoom and its
//   scroll for the return trip.
// - EDIT AND READ, and who gets which. Read is the statement as a client, a
//   planning officer or this app's own PDF sees it. Edit is the writing
//   surface, and it is NOT BUILT AT ALL where this session may not author -
//   not disabled, not hidden: not built. A visitor gets a reader, which is
//   what they came for.
// - WHAT THE BAR SAYS, and why each thing is on it. Which statement is open
//   and how many there are. Whether what is on screen has reached the disk
//   and whether it has reached the cloud, because those are different
//   questions. Save, which writes the file. Publish, which is the moment a
//   statement becomes something a client can open. And the PDF, in two
//   qualities.
// - THREE KEYS, ANSWERED BY THIS FILE because they belong to the tab rather
//   than to the surface: Ctrl + S saves the statement, Ctrl + / shows the raw
//   markdown, Ctrl + . puts the page into Lucida Console. The last two are
//   remembered in this browser, so the way somebody likes to write is the way
//   it opens next time. They are bound in the documents' own key map and
//   reach this file through the documents' keyboard
//   (Na__LayoutEditor__DocumentKeys__), which hears a key before anything
//   else in the app - so a letter typed here is a letter, never a tool.
// - A LONG JOB SAYS WHERE IT IS. Publishing sends dozens of megabytes and the
//   PDF rasterises several metres of page; both take long enough that silence
//   would read as a hang, so both report into a small progress bar.
//
// INTEGRATION:
// - Mounted into the editor host by the mode controller, and shown and hidden
//   as the Statements tab is entered and left.
// - Owns the editor, the reader and the manager; talks to the data module for
//   everything that touches a file.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026). The bar, the pills
//                   and the desk follow the Project Specification's, so the
//                   two tabs read as one application.
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.2.0
// - THE LOCKSTEP QUESTION. When the data module finds the statement on screen
//   and its markdown file out of step, this page puts the choice over the
//   desk: "Keep the app's copy" (the JSON - on screen, or this browser's
//   draft) or "Load the markdown file", each with when it last changed, how
//   many lines only it holds, and a Newer badge where the times allow. There
//   is no close button: nothing is saved until one is chosen. Adam,
//   23-Sep-2026: "force you to say, I want the JSON if it's newer, or I want
//   the Markdown, so you can make that choice in the app."
// - The watch runs while the tab is showing: StartWatch on Show, StopWatch on
//   Hide. A 'reloaded' change redraws whichever surface is showing, and the
//   bar says "Out of step with the file" while the question stands.
//
// 21-Sep-2026 - Version 1.1.0
// - The tab's keys go through the documents' keyboard
//   (Na__LayoutEditor__DocumentKeys__) instead of a window listener of their
//   own: Save, the raw markdown and the Lucida Console page are registered
//   with it as Doc__Save, Doc__ToggleSource and Doc__ToggleMono.
// - CTRL + S SAVES THE STATEMENT. It reached the editor's own save, which
//   saved the sheets and synced the specification and left the statement
//   being written marked Unsaved. It now does what the Save button does, and
//   the button's hover text names the key.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, the Data, the Two Surfaces, the Manager and the Exports
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeStmt__CHANGED_EVENT,
        Na__LeStmt__STATUS_FAILED,
        Na__LeStmt__EnsureLoaded,
        Na__LeStmt__Open,
        Na__LeStmt__SetText,
        Na__LeStmt__SaveLocal,
        Na__LeStmt__GetState,
        Na__LeStmt__GetText,
        Na__LeStmt__List,
        Na__LeStmt__StartWatch,
        Na__LeStmt__StopWatch,
        Na__LeStmt__ResolveConflict,
        Na__LeStmt__GetConflict
    } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtLock__When, Na__LeStmtLock__LinesText } from '../01__Core__Data/Na__LayoutEditor__Statement__Lockstep__.js';
    import { Na__LeStmtEd__Build, Na__LeStmtEd__SetMarkdown, Na__LeStmtEd__SetSourceView, Na__LeStmtEd__SetMono, Na__LeStmtEd__IsSourceView, Na__LeStmtEd__IsMono } from '../04__Ui__Editor/Na__LayoutEditor__Statement__Editor__.js';
    import { Na__LeStmtRead__Build, Na__LeStmtRead__SetMarkdown, Na__LeStmtRead__Fit, Na__LeStmtRead__Paper__Element } from '../05__Ui__Reader/Na__LayoutEditor__Statement__Reader__.js';
    import { Na__LeStmtMgr__Build, Na__LeStmtMgr__Show, Na__LeStmtMgr__Hide, Na__LeStmtMgr__IsShowing } from './Na__LayoutEditor__Statement__Manager__.js';
    import { Na__LeStmtPdf__Build } from '../06__Export__Pdf/Na__LayoutEditor__Statement__Pdf__.js';
    import { Na__LeStmtPublish__Run, Na__LeStmtPublish__Title } from '../07__Export__Publish/Na__LayoutEditor__Statement__Publish__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Documents' Own Keyboard
    // ------------------------------------------------------------
    // @delegate: ../../31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__.js
    // ------------------------------------------------------------
    import { Na__LeDocKeys__Register, Na__LeDocKeys__KeyLabel } from '../../31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What This Browser Remembers
    // ------------------------------------------------------------
    const Na__LeStmtPage__VIEW_KEY = 'Na__TrueVision__StatementView__';
    const Na__LeStmtPage__MONO_KEY = 'Na__TrueVision__StatementMono__';
    const Na__LeStmtPage__LAST_KEY = 'Na__TrueVision__StatementLast__';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | This Tab's Name to the Documents' Keyboard
    // ------------------------------------------------------------
    const Na__LeStmtPage__DOC_KEYS_ID = 'statements';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Page and Its Parts
    // ------------------------------------------------------------
    let Na__LeStmtPage__Root      = null;
    let Na__LeStmtPage__Bar       = null;
    let Na__LeStmtPage__Desk      = null;
    let Na__LeStmtPage__Picker    = null;
    let Na__LeStmtPage__Status    = null;
    let Na__LeStmtPage__Alerts    = null;
    let Na__LeStmtPage__Summary   = null;
    let Na__LeStmtPage__Views     = null;
    let Na__LeStmtPage__Progress  = null;
    let Na__LeStmtPage__Lock      = null;                                       // <-- The lockstep question, built on first need
    let Na__LeStmtPage__Editable  = false;
    let Na__LeStmtPage__Options   = {};
    let Na__LeStmtPage__View      = 'read';
    let Na__LeStmtPage__Shown     = false;
    let Na__LeStmtPage__Busy      = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Element With a Class and Some Text
    // ------------------------------------------------------------
    function Na__LeStmtPage__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Bar Button That Locks While Its Job Runs
    // ------------------------------------------------------------
    function Na__LeStmtPage__Button(label, className, action) {
        const button = Na__LeStmtPage__El('button', 'na-le-btn ' + (className || ''), label);
        button.type = 'button';
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            if (button.disabled) return;
            button.disabled = true;
            try { await action(); } finally { button.disabled = false; Na__LeStmtPage__Refresh(); }
        });
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read and Write What This Browser Remembers
    // ------------------------------------------------------------
    function Na__LeStmtPage__Remember(key, value) {
        try { window.localStorage.setItem(key, String(value)); } catch (error) { /* a private window; nothing to do */ }
    }
    function Na__LeStmtPage__Recall(key, fallback) {
        try {
            const value = window.localStorage.getItem(key);
            return (value === null) ? fallback : value;
        } catch (error) { return fallback; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say What a Long Job Is Doing
    // ------------------------------------------------------------
    function Na__LeStmtPage__Say(message, fraction) {
        if (!Na__LeStmtPage__Progress) return;
        if (message === null) { Na__LeStmtPage__Progress.hidden = true; return; }
        Na__LeStmtPage__Progress.hidden = false;
        Na__LeStmtPage__Progress.querySelector('.na-le-stmt__progress-text').textContent = message;
        Na__LeStmtPage__Progress.querySelector('.na-le-stmt__progress-fill').style.width =
            Math.round(Math.max(0, Math.min(1, fraction || 0)) * 100) + '%';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Bar
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Bar
    // ------------------------------------------------------------
    function Na__LeStmtPage__BuildBar() {
        const bar = Na__LeStmtPage__El('div', 'na-le-stmt__bar');

        const heading = Na__LeStmtPage__El('div', 'na-le-stmt__heading');
        heading.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt__title', 'Statements'));
        Na__LeStmtPage__Summary = Na__LeStmtPage__El('span', 'na-le-stmt__summary', '');
        heading.appendChild(Na__LeStmtPage__Summary);
        bar.appendChild(heading);

        // WHICH STATEMENT | A box rather than another row of tabs
        Na__LeStmtPage__Picker = Na__LeStmtPage__El('select', 'na-le-stmt__picker');
        Na__LeStmtPage__Picker.setAttribute('aria-label', 'Which statement');
        Na__LeStmtPage__Picker.addEventListener('change', () => {
            void Na__LeStmtPage__OpenStatement(Number(Na__LeStmtPage__Picker.value));
        });
        bar.appendChild(Na__LeStmtPage__Picker);

        bar.appendChild(Na__LeStmtPage__Button('Manage', 'na-le-btn--small', () => {
            if (Na__LeStmtMgr__IsShowing()) Na__LeStmtMgr__Hide(); else Na__LeStmtMgr__Show();
        }));

        // EDIT AND READ | Only where this session may author
        if (Na__LeStmtPage__Editable) {
            Na__LeStmtPage__Views = Na__LeStmtPage__El('div', 'na-le-stmt__views');
            for (const view of [ { key : 'edit', label : 'Edit' }, { key : 'read', label : 'Read' } ]) {
                const pill = Na__LeStmtPage__El('button', 'na-le-stmt__view', view.label);
                pill.type = 'button';
                pill.dataset.view = view.key;
                pill.addEventListener('click', () => Na__LeStmtPage__SetView(view.key));
                Na__LeStmtPage__Views.appendChild(pill);
            }
            bar.appendChild(Na__LeStmtPage__Views);
        }

        bar.appendChild(Na__LeStmtPage__El('div', 'na-le-stmt__spacer'));

        Na__LeStmtPage__Status = Na__LeStmtPage__El('span', 'na-le-stmt__status', '');
        bar.appendChild(Na__LeStmtPage__Status);

        if (Na__LeStmtPage__Editable) {
            const save = Na__LeStmtPage__Button('Save', 'na-le-btn--small', async () => {
                await Na__LeStmt__SaveLocal({});
            });
            const saveKey = Na__LeDocKeys__KeyLabel('Doc__Save');
            save.title = 'Write the statement to its file in the project folder' + (saveKey ? ' (' + saveKey + ')' : '');
            bar.appendChild(save);
            bar.appendChild(Na__LeStmtPage__Button('Publish', 'na-le-btn--small na-le-btn--primary', () => Na__LeStmtPage__Publish()));
        }

        for (const preset of Na__LeCfg__GetStatementSetup().pdfPresets || []) {
            bar.appendChild(Na__LeStmtPage__Button(preset.Label || 'PDF', 'na-le-btn--small',
                () => Na__LeStmtPage__DownloadPdf(preset.Key)));
        }

        return bar;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Bar in Step With How Things Stand
    // ------------------------------------------------------------
    function Na__LeStmtPage__Refresh() {
        if (!Na__LeStmtPage__Root) return;
        const state = Na__LeStmt__GetState();

        // THE LIST | Rebuilt only when it has actually changed, so the box does
        // not close itself under the pointer every time a key is pressed.
        const rows      = Na__LeStmt__List();
        const signature = rows.map((record) => record.Doc__Id + ':' + record.Doc__Title).join('|') + '#' + state.openId;
        if (Na__LeStmtPage__Picker.dataset.signature !== signature) {
            Na__LeStmtPage__Picker.dataset.signature = signature;
            Na__LeStmtPage__Picker.textContent = '';
            if (!rows.length) {
                const empty = Na__LeStmtPage__El('option', '', 'No statements yet');
                empty.value = '0';
                Na__LeStmtPage__Picker.appendChild(empty);
            }
            for (const record of rows) {
                const option = Na__LeStmtPage__El('option', '', record.Doc__Title);
                option.value = String(record.Doc__Id);
                if (record.Doc__Id === state.openId) option.selected = true;
                Na__LeStmtPage__Picker.appendChild(option);
            }
        }

        Na__LeStmtPage__Summary.textContent = state.count
            ? state.count + (state.count === 1 ? ' statement' : ' statements')
            : '';

        // THE STATUS | Disk first, cloud second: they are different questions
        let text  = '';
        let mark  = '';
        if (state.status === Na__LeStmt__STATUS_FAILED) { text = 'Could not be read'; mark = 'failed'; }
        else if (state.conflict)                        { text = 'Out of step with the file'; mark = 'failed'; }
        else if (state.saving)                          { text = 'Saving…';          mark = 'syncing'; }
        else if (Na__LeStmtPage__Busy)                  { text = 'Working…';         mark = 'publishing'; }
        else if (!state.open)                           { text = '';                 mark = ''; }
        else if (state.dirty)                           { text = 'Unsaved changes';  mark = 'dirty'; }
        else if (state.published)                       { text = 'Published';        mark = 'synced'; }
        else                                            { text = 'Saved, not published'; mark = 'dirty'; }
        Na__LeStmtPage__Status.textContent = text;
        Na__LeStmtPage__Status.setAttribute('data-state', mark);

        Na__LeStmtPage__ShowAlerts(state);

        if (Na__LeStmtPage__Views) {
            for (const pill of Array.from(Na__LeStmtPage__Views.children)) {
                pill.classList.toggle('is-active', pill.dataset.view === Na__LeStmtPage__View);
            }
        }
        Na__LeStmtPage__Root.classList.toggle('is-reading', Na__LeStmtPage__View === 'read');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Views
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Reported Reason, Made Into a Sentence
    // ------------------------------------------------------------
    // The reasons come from the transport layer and are written to be read
    // mid-sentence in a console warning. Put after a full stop on screen they
    // need a capital and a stop of their own.
    // ------------------------------------------------------------
    function Na__LeStmtPage__Sentence(text) {
        const clean = String(text || '').trim();
        if (!clean) return '';
        return clean.charAt(0).toUpperCase() + clean.slice(1) + (/[.!?]$/.test(clean) ? '' : '.');
    }
    // ------------------------------------------------------------


    // FUNCTION | Say What Is Wrong, Before Anything Is Typed
    // ------------------------------------------------------------
    // ONE ALERT MATTERS MORE THAN THE REST. When the local server is running
    // without the statement routes, the listing fails and the tab looks like a
    // project that has no statements - over a folder that holds one. Somebody
    // then types a title, presses Create, and only THEN finds out, having lost
    // nothing but their place and their patience.
    //
    // So it is said at the top of the tab the moment it opens, and Create is
    // closed while it stands: an action that is known to fail should not be
    // offered.
    // ------------------------------------------------------------
    function Na__LeStmtPage__ShowAlerts(state) {
        if (!Na__LeStmtPage__Alerts) return;
        const notes = [];

        if (state.serverNote) {
            notes.push({
                kind : 'stop',
                text : 'The statements folder for this project could not be read, so nothing on disk is listed here. '
                     + Na__LeStmtPage__Sentence(state.serverNote)
            });
        }
        if (state.status === Na__LeStmt__STATUS_FAILED) {
            notes.push({ kind : 'warn', text : 'The statement index could not be read' + (state.error ? ' (' + state.error + ')' : '') + '. Nothing is published until it can be.' });
        }
        if (state.textStatus === Na__LeStmt__STATUS_FAILED) {
            notes.push({ kind : 'warn', text : 'This statement could not be read' + (state.textError ? ' (' + state.textError + ')' : '') + '.' });
        }

        Na__LeStmtPage__Alerts.textContent = '';
        Na__LeStmtPage__Alerts.hidden = notes.length === 0;
        for (const note of notes) {
            const row = Na__LeStmtPage__El('div', 'na-le-stmt__alert na-le-stmt__alert--' + note.kind);
            row.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt__alert-text', note.text));
            Na__LeStmtPage__Alerts.appendChild(row);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Edit or Read
    // ------------------------------------------------------------
    // Crossing into Read takes the editor's current document with it, so what
    // is read is always what has just been written - never the copy that was
    // last saved.
    // ------------------------------------------------------------
    function Na__LeStmtPage__SetView(view) {
        const want = (view === 'edit' && Na__LeStmtPage__Editable) ? 'edit' : 'read';
        Na__LeStmtPage__View = want;
        Na__LeStmtPage__Remember(Na__LeStmtPage__VIEW_KEY, want);

        const text = Na__LeStmt__GetText();
        if (want === 'read') Na__LeStmtRead__SetMarkdown(text);
        else                 Na__LeStmtEd__SetMarkdown(text);

        Na__LeStmtPage__Fit();
        Na__LeStmtPage__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Paper to the Desk
    // ------------------------------------------------------------
    function Na__LeStmtPage__Fit() {
        Na__LeStmtRead__Fit(Na__LeStmtPage__Desk);
    }
    // ------------------------------------------------------------


    // FUNCTION | Open One Statement
    // ------------------------------------------------------------
    async function Na__LeStmtPage__OpenStatement(id) {
        if (!id) return;
        const text = await Na__LeStmt__Open(id);
        Na__LeStmtPage__Remember(Na__LeStmtPage__LAST_KEY, id);
        if (Na__LeStmtPage__View === 'read') Na__LeStmtRead__SetMarkdown(text);
        else                                 Na__LeStmtEd__SetMarkdown(text);
        Na__LeStmtPage__Fit();
        Na__LeStmtPage__Refresh();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Long Jobs
// -----------------------------------------------------------------------------

    // FUNCTION | Publish the Open Statement
    // ------------------------------------------------------------
    async function Na__LeStmtPage__Publish() {
        if (Na__LeStmtPage__Busy) return;
        Na__LeStmtPage__Busy = true;
        Na__LeStmtPage__Refresh();
        try {
            const result = await Na__LeStmtPublish__Run({ onProgress : Na__LeStmtPage__Say });
            Na__LeStmtPage__Say(null);
            if (!result.ok) {
                Na__LeStmtPage__Toast('Publish failed: ' + (result.error || 'unknown') + '.', true);
                return;
            }
            const missed = (result.failed || []).length;
            Na__LeStmtPage__Toast(
                'Published' + (result.images ? ' with ' + result.images + ' picture(s)' : '')
                + (missed ? ' - ' + missed + ' picture(s) could not be sent' : '') + '.', missed > 0);
            if (missed) {
                for (const failure of result.failed) {
                    console.warn('[TrueVision3D] Statement Writer: "' + failure.src + '" was not published - ' + failure.why);
                }
            }
        } finally {
            Na__LeStmtPage__Busy = false;
            Na__LeStmtPage__Say(null);
            Na__LeStmtPage__Refresh();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Download the Statement as a PDF
    // ------------------------------------------------------------
    // The READER'S page is rasterised, whichever view is showing, so the PDF
    // never carries an editing handle and never depends on which tab happened
    // to be open when the button was pressed.
    // ------------------------------------------------------------
    async function Na__LeStmtPage__DownloadPdf(presetKey) {
        if (Na__LeStmtPage__Busy) return;
        const state = Na__LeStmt__GetState();
        if (!state.open) { Na__LeStmtPage__Toast('There is no statement open to export.', true); return; }

        Na__LeStmtPage__Busy = true;
        Na__LeStmtPage__Refresh();
        try {
            Na__LeStmtRead__SetMarkdown(Na__LeStmt__GetText());                 // <-- The reader is the thing that gets photographed
            const title  = Na__LeStmtPublish__Title(Na__LeStmt__GetText(), state.open);
            const result = await Na__LeStmtPdf__Build(Na__LeStmtRead__Paper__Element(), {
                presetKey  : presetKey,
                fileName   : (state.open.Doc__File || title).replace(/\.md$/i, ''),
                onProgress : Na__LeStmtPage__Say,
                download   : true
            });
            Na__LeStmtPage__Say(null);
            if (!result.ok) Na__LeStmtPage__Toast('The PDF could not be made: ' + (result.error || 'unknown') + '.', true);
            else Na__LeStmtPage__Toast('PDF downloaded (' + result.pages + ' page' + (result.pages === 1 ? '' : 's') + ').', false);
        } finally {
            Na__LeStmtPage__Busy = false;
            Na__LeStmtPage__Say(null);
            Na__LeStmtPage__Refresh();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something to the Person
    // ------------------------------------------------------------
    function Na__LeStmtPage__Toast(message, isError) {
        if (typeof Na__LeStmtPage__Options.showToast === 'function') Na__LeStmtPage__Options.showToast(message, isError);
        else console.log('[TrueVision3D] Statement Writer: ' + message);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Lockstep Question
// -----------------------------------------------------------------------------

    // FUNCTION | Put Text on Whichever Surface Is Showing
    // ------------------------------------------------------------
    // After an answer the text on screen is no longer the text the surface
    // was built from. The other surface picks it up when it is next shown.
    // ------------------------------------------------------------
    function Na__LeStmtPage__ShowText(text) {
        if (Na__LeStmtPage__View === 'read') Na__LeStmtRead__SetMarkdown(text);
        else                                 Na__LeStmtEd__SetMarkdown(text);
        Na__LeStmtPage__Fit();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One of the Two Answers, as a Large Button
    // ------------------------------------------------------------
    function Na__LeStmtPage__LockChoice(choice) {
        const button = Na__LeStmtPage__El('button', 'na-le-stmt-lock__choice');
        button.type = 'button';
        button.dataset.choice = choice;
        const head = Na__LeStmtPage__El('span', 'na-le-stmt-lock__head');
        head.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt-lock__name', ''));
        head.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt-lock__badge', 'Newer'));
        button.appendChild(head);
        button.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt-lock__kind', ''));
        button.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt-lock__when', ''));
        button.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt-lock__what', ''));
        button.addEventListener('click', () => { void Na__LeStmtPage__AnswerLock(choice); });
        return button;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Question Once
    // ------------------------------------------------------------
    // A sheet over the desk like the manager's, above it, with NO way out but
    // an answer: nothing is saved while the question stands, so closing it
    // would only leave the statement stuck.
    // ------------------------------------------------------------
    function Na__LeStmtPage__BuildLock() {
        if (Na__LeStmtPage__Lock) return Na__LeStmtPage__Lock;
        const lock = Na__LeStmtPage__El('div', 'na-le-stmt-lock');
        lock.hidden = true;
        lock.setAttribute('role', 'alertdialog');
        lock.setAttribute('aria-modal', 'true');
        lock.setAttribute('aria-labelledby', 'na-le-stmt-lock-title');

        const card = Na__LeStmtPage__El('div', 'na-le-stmt-lock__card');
        const title = Na__LeStmtPage__El('h3', 'na-le-stmt-lock__title', 'This statement and its markdown file are out of step');
        title.id = 'na-le-stmt-lock-title';
        card.appendChild(title);
        card.appendChild(Na__LeStmtPage__El('p', 'na-le-stmt-lock__lead', ''));

        const choices = Na__LeStmtPage__El('div', 'na-le-stmt-lock__choices');
        choices.appendChild(Na__LeStmtPage__LockChoice('app'));
        choices.appendChild(Na__LeStmtPage__LockChoice('file'));
        card.appendChild(choices);

        card.appendChild(Na__LeStmtPage__El('p', 'na-le-stmt-lock__foot',
            'Nothing is saved until you choose. Whichever you do not choose is kept in this browser, so choosing loses nothing.'));
        lock.appendChild(card);

        // THE FOCUS STAYS ON THE QUESTION. Tab moves between the two answers
        // and nowhere else; Escape does nothing, because there is nothing to
        // go back to.
        lock.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
            if (event.key !== 'Tab') return;
            const buttons = Array.from(lock.querySelectorAll('.na-le-stmt-lock__choice'));
            const at = buttons.indexOf(document.activeElement);
            event.preventDefault();
            const next = buttons[(at + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length];
            if (next) next.focus();
        });

        Na__LeStmtPage__Root.appendChild(lock);
        Na__LeStmtPage__Lock = lock;
        return lock;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask
    // ------------------------------------------------------------
    // The words come from the question itself: which copy moved, when each
    // last changed, and how many lines only it holds. The Newer badge appears
    // only where the two times are far enough apart to say so honestly.
    // ------------------------------------------------------------
    function Na__LeStmtPage__ShowLock() {
        const conflict = Na__LeStmt__GetConflict();
        if (!conflict || !Na__LeStmtPage__Root) { Na__LeStmtPage__HideLock(); return; }
        const lock = Na__LeStmtPage__BuildLock();

        const appWhen  = Na__LeStmtLock__When(conflict.appIso);
        const fileWhen = Na__LeStmtLock__When(conflict.fileIso);
        const lead = (conflict.kind === 'open')
            ? 'This browser is holding unsaved changes to the statement from ' + appWhen + ', and the markdown file on disk is not the same - it was last changed ' + fileWhen + '. Choose which to carry on with.'
            : (conflict.kind === 'file')
                ? 'The markdown file was changed outside the app ' + fileWhen + ' - in Typora, or by an agent. Nothing in the app is unsaved. Choose which to carry on with.'
                : 'The markdown file was changed outside the app ' + fileWhen + ', while this browser had unsaved changes from ' + appWhen + '. Choose which to keep.';
        lock.querySelector('.na-le-stmt-lock__lead').textContent = lead;

        const summary = conflict.summary || {};
        const app  = lock.querySelector('.na-le-stmt-lock__choice[data-choice="app"]');
        const file = lock.querySelector('.na-le-stmt-lock__choice[data-choice="file"]');

        app.querySelector('.na-le-stmt-lock__name').textContent  = 'Keep the app\'s copy';
        app.querySelector('.na-le-stmt-lock__kind').textContent  = (conflict.appFrom === 'draft') ? 'JSON  ·  this browser\'s unsaved draft' : 'JSON  ·  what is on screen';
        app.querySelector('.na-le-stmt-lock__when').textContent  = ((conflict.kind === 'file') ? 'As last loaded or saved ' : 'Last changed ') + appWhen;
        app.querySelector('.na-le-stmt-lock__what').textContent  = 'Writes it to the markdown file. '
            + (summary.onlyInApp ? Na__LeStmtLock__LinesText(summary.onlyInApp) + ' only in this copy.' : 'It holds nothing the file does not.');

        file.querySelector('.na-le-stmt-lock__name').textContent = 'Load the markdown file';
        file.querySelector('.na-le-stmt-lock__kind').textContent = 'Markdown  ·  the file on disk';
        file.querySelector('.na-le-stmt-lock__when').textContent = 'Changed on disk ' + fileWhen;
        file.querySelector('.na-le-stmt-lock__what').textContent = 'Replaces what is in the app. '
            + (summary.onlyInFile ? Na__LeStmtLock__LinesText(summary.onlyInFile) + ' only in the file.' : 'It holds nothing the app\'s copy does not.');

        app.classList.toggle('is-newer',  conflict.newer === 'app');
        file.classList.toggle('is-newer', conflict.newer === 'file');
        for (const button of [ app, file ]) { button.disabled = false; button.classList.remove('is-busy'); }

        const wasHidden = lock.hidden;
        lock.hidden = false;
        if (wasHidden) (conflict.newer === 'app' ? app : file).focus();
        Na__LeStmtPage__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Asking
    // ------------------------------------------------------------
    function Na__LeStmtPage__HideLock() {
        if (Na__LeStmtPage__Lock) Na__LeStmtPage__Lock.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Answer
    // ------------------------------------------------------------
    async function Na__LeStmtPage__AnswerLock(choice) {
        const lock = Na__LeStmtPage__Lock;
        if (!lock || lock.hidden) return;
        const buttons = Array.from(lock.querySelectorAll('.na-le-stmt-lock__choice'));
        for (const button of buttons) button.disabled = true;
        const picked = buttons.find((button) => button.dataset.choice === choice);
        if (picked) picked.classList.add('is-busy');

        await Na__LeStmt__ResolveConflict(choice);                              // <-- Says for itself, in a toast, how it went
        if (Na__LeStmt__GetConflict()) Na__LeStmtPage__ShowLock();             // <-- Still (or newly) out of step: ask again
        else                           Na__LeStmtPage__HideLock();
        Na__LeStmtPage__Refresh();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mounting
// -----------------------------------------------------------------------------

    // FUNCTION | Mount the Statements Tab Once Onto the Layout Host
    // ------------------------------------------------------------
    // options: { editable, showToast }
    // ------------------------------------------------------------
    function Na__LeStmtPage__Mount(host, options) {
        if (Na__LeStmtPage__Root) return;
        Na__LeStmtPage__Options  = options || {};
        Na__LeStmtPage__Editable = Na__LeStmtPage__Options.editable === true;

        // THE FEATURE'S OWN STYLESHEETS, loaded the first time the tab is
        // mounted rather than by the index, so a visitor who never opens a
        // statement never downloads them.
        for (const sheet of [ '../08__Style__Stylesheets/Na__LayoutEditor__Styles__Statement__.css',
                              '../08__Style__Stylesheets/Na__LayoutEditor__Styles__Statement__Document__.css' ]) {
            const href = new URL(sheet, import.meta.url).href;
            if (document.querySelector('link[href="' + href + '"]')) continue;
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }

        Na__LeStmtPage__Root = Na__LeStmtPage__El('section', 'na-le-stmt');
        Na__LeStmtPage__Root.hidden = true;
        Na__LeStmtPage__Root.setAttribute('aria-label', 'Statements');

        Na__LeStmtPage__Bar = Na__LeStmtPage__BuildBar();
        Na__LeStmtPage__Root.appendChild(Na__LeStmtPage__Bar);

        // THE ALERTS SIT UNDER THE BAR, above everything else, because the one
        // that matters most is about the folder this tab could not read - and
        // it has to be seen BEFORE a title is typed, not after Create fails.
        Na__LeStmtPage__Alerts = Na__LeStmtPage__El('div', 'na-le-stmt__alerts');
        Na__LeStmtPage__Alerts.hidden = true;
        Na__LeStmtPage__Root.appendChild(Na__LeStmtPage__Alerts);

        Na__LeStmtPage__Desk = Na__LeStmtPage__El('div', 'na-le-stmt__desk');
        Na__LeStmtPage__Desk.tabIndex = 0;
        Na__LeStmtPage__Root.appendChild(Na__LeStmtPage__Desk);

        // THE TWO SURFACES. Edit is built only where authoring is allowed:
        // not disabled, not hidden - not built.
        const readSheet = Na__LeStmtRead__Build(Na__LeStmtPage__Desk);
        readSheet.setAttribute('data-na-stmt-only', 'read');
        if (Na__LeStmtPage__Editable) {
            const editSheet = Na__LeStmtEd__Build(Na__LeStmtPage__Desk, {
                onChange : (markdown) => { Na__LeStmt__SetText(markdown); Na__LeStmtPage__Refresh(); }
            });
            editSheet.setAttribute('data-na-stmt-only', 'edit');
        }

        // THE PROGRESS BAR for publishing and for the PDF
        Na__LeStmtPage__Progress = Na__LeStmtPage__El('div', 'na-le-stmt__progress');
        Na__LeStmtPage__Progress.hidden = true;
        Na__LeStmtPage__Progress.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt__progress-text', ''));
        const track = Na__LeStmtPage__El('span', 'na-le-stmt__progress-track');
        track.appendChild(Na__LeStmtPage__El('span', 'na-le-stmt__progress-fill'));
        Na__LeStmtPage__Progress.appendChild(track);
        Na__LeStmtPage__Root.appendChild(Na__LeStmtPage__Progress);

        Na__LeStmtMgr__Build(Na__LeStmtPage__Root, {
            onOpen    : (id) => Na__LeStmtPage__OpenStatement(id),
            onChanged : () => Na__LeStmtPage__Refresh()
        });

        host.appendChild(Na__LeStmtPage__Root);

        Na__LeStmtPage__View = Na__LeStmtPage__Editable
            ? Na__LeStmtPage__Recall(Na__LeStmtPage__VIEW_KEY, 'edit')
            : 'read';
        Na__LeStmtEd__SetMono(Na__LeStmtPage__Recall(Na__LeStmtPage__MONO_KEY, 'false') === 'true');

        window.addEventListener(Na__LeStmt__CHANGED_EVENT, (event) => {
            const reason = (event && event.detail) ? event.detail.reason : '';
            if (reason === 'reloaded') Na__LeStmtPage__ShowText(Na__LeStmt__GetText());
            if (reason === 'conflict' || reason === 'opened') {
                if (Na__LeStmt__GetConflict()) Na__LeStmtPage__ShowLock(); else Na__LeStmtPage__HideLock();
            }
            Na__LeStmtPage__Refresh();
        });
        window.addEventListener('resize', () => { if (Na__LeStmtPage__Shown) Na__LeStmtPage__Fit(); });

        // THE TAB'S OWN KEYS, through the documents' keyboard. Registered only
        // where this session may author: a reader has nothing to save and no
        // surface to switch, so the keys stay the browser's.
        if (Na__LeStmtPage__Editable) {
            Na__LeDocKeys__Register(Na__LeStmtPage__DOC_KEYS_ID, {
                isShowing : () => Na__LeStmtPage__Shown,
                actions   : {
                    Doc__Save         : () => Na__LeStmtPage__SaveKey(),
                    Doc__ToggleSource : () => Na__LeStmtPage__SourceKey(),
                    Doc__ToggleMono   : () => Na__LeStmtPage__MonoKey()
                }
            });
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Ctrl + S: Save the Statement, as the Button Does
    // ------------------------------------------------------------
    // A click on Save moves the focus onto the button, and that blur is what
    // commits a field still being typed into - a raw HTML block open for
    // editing, a statement's new title. A key moves nothing, so the same
    // commit is made here first. The page and the raw markdown view are left
    // alone: every keystroke in them has already reached the data, and the
    // caret stays exactly where the writer left it.
    // ------------------------------------------------------------
    function Na__LeStmtPage__SaveKey() {
        const focused = document.activeElement;
        const commits = !!focused && Na__LeStmtPage__Root.contains(focused)
            && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')
            && !focused.classList.contains('na-le-stmt__source');
        if (commits) focused.blur();
        void Na__LeStmt__SaveLocal({});
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ctrl + /: the Raw Markdown, or Back to the Page
    // ------------------------------------------------------------
    // From Read it opens Edit first: the markdown is the page being written.
    // ------------------------------------------------------------
    function Na__LeStmtPage__SourceKey() {
        if (Na__LeStmtPage__View !== 'edit') Na__LeStmtPage__SetView('edit');
        Na__LeStmtEd__SetSourceView(!Na__LeStmtEd__IsSourceView());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ctrl + .: the Page in Lucida Console, or Back
    // ------------------------------------------------------------
    function Na__LeStmtPage__MonoKey() {
        Na__LeStmtEd__SetMono(!Na__LeStmtEd__IsMono());
        Na__LeStmtPage__Remember(Na__LeStmtPage__MONO_KEY, Na__LeStmtEd__IsMono());
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Statements Tab
    // ------------------------------------------------------------
    async function Na__LeStmtPage__Show() {
        if (!Na__LeStmtPage__Root) return;
        Na__LeStmtPage__Root.hidden = false;
        Na__LeStmtPage__Shown = true;
        if (Na__LeStmtPage__Root.parentElement) Na__LeStmtPage__Root.parentElement.classList.add('is-stmt-shown');

        await Na__LeStmt__EnsureLoaded();

        const state = Na__LeStmt__GetState();
        if (!state.openId) {
            const wanted = Number(Na__LeStmtPage__Recall(Na__LeStmtPage__LAST_KEY, '0'));
            const rows   = Na__LeStmt__List();
            const first  = rows.find((record) => record.Doc__Id === wanted) || rows[0];
            if (first) await Na__LeStmtPage__OpenStatement(first.Doc__Id);
            else if (state.editable) Na__LeStmtMgr__Show();
        }

        Na__LeStmtPage__SetView(Na__LeStmtPage__View);

        // THE WATCH runs while the tab is showing, so an edit made in Typora or
        // by an agent is asked about within seconds rather than overwritten by
        // the next autosave. A question already open is put back up.
        if (Na__LeStmtPage__Editable) Na__LeStmt__StartWatch();
        if (Na__LeStmt__GetConflict()) Na__LeStmtPage__ShowLock();
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Statements Tab
    // ------------------------------------------------------------
    // Whatever was typed is written to disk on the way out: leaving a tab is
    // not a reason to lose a paragraph.
    // ------------------------------------------------------------
    function Na__LeStmtPage__Hide() {
        if (!Na__LeStmtPage__Root) return;
        Na__LeStmt__StopWatch();
        if (Na__LeStmtPage__Editable) void Na__LeStmt__SaveLocal({ quiet : true });
        Na__LeStmtMgr__Hide();
        Na__LeStmtPage__Root.hidden = true;
        Na__LeStmtPage__Shown = false;
        if (Na__LeStmtPage__Root.parentElement) Na__LeStmtPage__Root.parentElement.classList.remove('is-stmt-shown');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Page API
    // ------------------------------------------------------------
    export {
        Na__LeStmtPage__Mount,
        Na__LeStmtPage__Show,
        Na__LeStmtPage__Hide,
        Na__LeStmtPage__Refresh,
        Na__LeStmtPage__SetView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
