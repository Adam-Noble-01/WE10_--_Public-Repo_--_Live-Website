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
// - TWO KEYS, HELD BY THIS FILE because they belong to the tab rather than to
//   the surface: Ctrl + / shows the raw markdown, Ctrl + . puts the page into
//   Lucida Console. Both are remembered in this browser, so the way somebody
//   likes to write is the way it opens next time.
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
        Na__LeStmt__List
    } from '../01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeStmtEd__Build, Na__LeStmtEd__SetMarkdown, Na__LeStmtEd__SetSourceView, Na__LeStmtEd__SetMono, Na__LeStmtEd__IsSourceView, Na__LeStmtEd__IsMono } from '../04__Ui__Editor/Na__LayoutEditor__Statement__Editor__.js';
    import { Na__LeStmtRead__Build, Na__LeStmtRead__SetMarkdown, Na__LeStmtRead__Fit, Na__LeStmtRead__Paper__Element } from '../05__Ui__Reader/Na__LayoutEditor__Statement__Reader__.js';
    import { Na__LeStmtMgr__Build, Na__LeStmtMgr__Show, Na__LeStmtMgr__Hide, Na__LeStmtMgr__IsShowing } from './Na__LayoutEditor__Statement__Manager__.js';
    import { Na__LeStmtPdf__Build } from '../06__Export__Pdf/Na__LayoutEditor__Statement__Pdf__.js';
    import { Na__LeStmtPublish__Run, Na__LeStmtPublish__Title } from '../07__Export__Publish/Na__LayoutEditor__Statement__Publish__.js';
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

    // MODULE VARIABLES | The Page and Its Parts
    // ------------------------------------------------------------
    let Na__LeStmtPage__Root      = null;
    let Na__LeStmtPage__Bar       = null;
    let Na__LeStmtPage__Desk      = null;
    let Na__LeStmtPage__Picker    = null;
    let Na__LeStmtPage__Status    = null;
    let Na__LeStmtPage__Summary   = null;
    let Na__LeStmtPage__Views     = null;
    let Na__LeStmtPage__Progress  = null;
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
            bar.appendChild(Na__LeStmtPage__Button('Save', 'na-le-btn--small', async () => {
                await Na__LeStmt__SaveLocal({});
            }));
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
        else if (state.saving)                          { text = 'Saving…';          mark = 'syncing'; }
        else if (Na__LeStmtPage__Busy)                  { text = 'Working…';         mark = 'publishing'; }
        else if (!state.open)                           { text = '';                 mark = ''; }
        else if (state.dirty)                           { text = 'Unsaved changes';  mark = 'dirty'; }
        else if (state.published)                       { text = 'Published';        mark = 'synced'; }
        else                                            { text = 'Saved, not published'; mark = 'dirty'; }
        Na__LeStmtPage__Status.textContent = text;
        Na__LeStmtPage__Status.setAttribute('data-state', mark);

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

        window.addEventListener(Na__LeStmt__CHANGED_EVENT, () => Na__LeStmtPage__Refresh());
        window.addEventListener('resize', () => { if (Na__LeStmtPage__Shown) Na__LeStmtPage__Fit(); });
        window.addEventListener('keydown', Na__LeStmtPage__Keys, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Tab's Own Keys
    // ------------------------------------------------------------
    // Ctrl + /   the raw markdown, or back to the page
    // Ctrl + .   the page in Lucida Console, or back
    // Both are ignored unless this tab is showing and it can be edited, so
    // they never take a key away from the drawing editor underneath.
    // ------------------------------------------------------------
    function Na__LeStmtPage__Keys(event) {
        if (!Na__LeStmtPage__Shown || !Na__LeStmtPage__Editable) return;
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

        if (event.key === '/' || event.key === '?') {
            event.preventDefault();
            event.stopPropagation();
            if (Na__LeStmtPage__View !== 'edit') Na__LeStmtPage__SetView('edit');
            Na__LeStmtEd__SetSourceView(!Na__LeStmtEd__IsSourceView());
            return;
        }
        if (event.key === '.' || event.key === '>') {
            event.preventDefault();
            event.stopPropagation();
            Na__LeStmtEd__SetMono(!Na__LeStmtEd__IsMono());
            Na__LeStmtPage__Remember(Na__LeStmtPage__MONO_KEY, Na__LeStmtEd__IsMono());
        }
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
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Statements Tab
    // ------------------------------------------------------------
    // Whatever was typed is written to disk on the way out: leaving a tab is
    // not a reason to lose a paragraph.
    // ------------------------------------------------------------
    function Na__LeStmtPage__Hide() {
        if (!Na__LeStmtPage__Root) return;
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
