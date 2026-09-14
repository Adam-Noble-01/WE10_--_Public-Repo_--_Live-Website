// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Project Specification tab: write, group, order and number the project's drawing notes, and see where each is used
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A page over the drawing editor, shown by the Project Specification tab.
//   The specification is a list of groups; each group is a prefix (GN, SN,
//   EE), a title and a general switch, then its notes in order. Each note has
//   a heading - its code, split into the group it is in and its number, then
//   its title - and its specification text underneath.
// - CODES ARE NEVER TYPED. A note's number is its place in its group. Drag a
//   note by its grip (or Alt+Up and Alt+Down) and it and its neighbours are
//   renumbered; choose another prefix on its code and it moves to the end of
//   that group; change a group's prefix and all its notes take it. Every
//   bubble linked to a note follows on every sheet (Na__LayoutEditor__SpecLinks__).
// - A prefix is refused when it is not letters, is too long, or is another
//   group's, and the refusal says why beside the group, so two groups can
//   never be given clashing codes. A file that arrives with a clash is marked.
// - WHERE A NOTE IS USED. Under each note: the sheets whose bubbles link to it
//   (a click opens the sheet with the bubble selected), and any unlinked
//   bubbles that already read its code, with Link beside them. At the top: the
//   bubbles linked to deleted notes, and the codes bubbles read that no note has.
// - Typing is live - the sheets and their margins follow as it happens - and a
//   field's commit (leaving it, or Enter in a one-line field) is one undo step.
//   Ctrl+Z and Ctrl+Y undo the tab's own steps when no text field has the focus.
// - The bar says whether the specification is synced, kept only in this
//   browser, or could not be read, and holds Sync. Headings only folds every
//   note to its heading, for reordering a long specification. The filter hides
//   the notes whose code, title and text do not contain what is typed.
// - Read-only sessions see the same page with nothing editable.
// - EDIT AND READ. Two tabs inside the tab, beside its title. Edit is the page
//   above. Read lays the specification out as A4 pages - the pages it prints
//   as (Na__LayoutEditor__SpecDocument__) - with Print, and its text is real
//   text a browser can read aloud. The bar keeps the sync state and Sync in
//   both; the filter and the editing tools are Edit's. The view is remembered
//   in this browser, a note asked for from a sheet opens Edit, and a read-only
//   session starts in Read.
// - While the page is up the sheet beneath it is hidden as well as covered,
//   so a Read Aloud or a find on the page never reaches the panels under it.
//
// INTEGRATION:
// - Mounted into the editor host and shown and hidden by the mode controller.
//   Opening a sheet from a usage chip goes out as Na__LeSpec__GOTO_EVENT.
// - Read's pages, and printing them, are Na__LayoutEditor__SpecDocument__'s.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.1.0
// - Edit and Read, two tabs inside the tab. Read shows the specification as
//   A4 pages with Print (Na__LayoutEditor__SpecDocument__). Each view keeps
//   its own scroll, also across a visit to a sheet. Ctrl+Z and Ctrl+Y step
//   the history only in Edit.
// - The host carries is-spec-shown while the page is up, which hides the
//   sheet beneath it.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Specification, Links, Document, Project Code and the Confirm Dialog
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetSpecificationSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__GOTO_EVENT,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__GetState,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__PrefixClashes,
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
        Na__LeSpec__Redo,
        Na__LeSpec__Sync,
        Na__LeSpec__Retry
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__Usage, Na__LeSpecLink__LinkMatching } from './Na__LayoutEditor__SpecLinks__.js';
    import { Na__LeSpecDoc__Initialize, Na__LeSpecDoc__Render, Na__LeSpecDoc__Fit, Na__LeSpecDoc__Print } from './Na__LayoutEditor__SpecDocument__.js';
    import { Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage, the Views, the Grip and the Drag
    // ------------------------------------------------------------
    const Na__LeSpecEd__COMPACT_KEY   = 'na-layouteditor-spec:headings-only';
    const Na__LeSpecEd__VIEW_KEY      = 'na-layouteditor-spec:view';
    const Na__LeSpecEd__VIEW_EDIT     = 'edit';
    const Na__LeSpecEd__VIEW_READ     = 'read';
    const Na__LeSpecEd__DRAG_START_PX = 4;
    const Na__LeSpecEd__AUTOSCROLL_PX = 40;
    const Na__LeSpecEd__GRIP_SVG      = '<svg viewBox="0 0 8 13" aria-hidden="true"><circle cx="2" cy="2" r="1.3"/><circle cx="6" cy="2" r="1.3"/><circle cx="2" cy="6.5" r="1.3"/><circle cx="6" cy="6.5" r="1.3"/><circle cx="2" cy="11" r="1.3"/><circle cx="6" cy="11" r="1.3"/></svg>';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements, Session and What Is Waiting
    // ------------------------------------------------------------
    let Na__LeSpecEd__Root      = null;
    let Na__LeSpecEd__Bar       = null;
    let Na__LeSpecEd__Alerts    = null;
    let Na__LeSpecEd__Scroll    = null;
    let Na__LeSpecEd__Page      = null;
    let Na__LeSpecEd__Filter    = null;
    let Na__LeSpecEd__Editable  = false;
    let Na__LeSpecEd__ShowToast = null;
    let Na__LeSpecEd__Shown     = false;
    let Na__LeSpecEd__Frame     = 0;
    let Na__LeSpecEd__Usage     = null;    // <-- The last usage worked out, for the bar and the delete questions
    let Na__LeSpecEd__Drag      = null;    // <-- { noteId, groupId, list, rows, slots, from, to, startY, pointerId, moved, pending }
    let Na__LeSpecEd__PrefixError = null;  // <-- { groupId, message } shown beside the group whose prefix was refused
    let Na__LeSpecEd__FocusAfter  = null;  // <-- { selector } to focus once the next render lands (a new note's title, a new group's prefix)
    let Na__LeSpecEd__Reader      = null;  // <-- Read's scroller, and the desk its pages lie on
    let Na__LeSpecEd__Desk        = null;
    let Na__LeSpecEd__View        = 'edit';
    let Na__LeSpecEd__Pages       = 0;     // <-- Pages Read last laid out
    let Na__LeSpecEd__ScrollBack  = { edit : null, read : null };   // <-- Where each view was scrolled to when it was last put away
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeSpecEd__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Button Carrying an Action
    // ------------------------------------------------------------
    function Na__LeSpecEd__Button(text, action, title, modifier) {
        const button = Na__LeSpecEd__El('button', 'na-le-btn' + (modifier ? ' ' + modifier : ''), text);
        button.type = 'button';
        button.setAttribute('data-na-spec', action);
        if (title) button.title = title;
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Field Carrying Its Name and Its Record
    // ------------------------------------------------------------
    function Na__LeSpecEd__Field(tag, className, field, ids) {
        const el = document.createElement(tag);
        el.className = className;
        el.setAttribute('data-na-spec-field', field);
        if (ids && ids.noteId)  el.setAttribute('data-note-id', ids.noteId);
        if (ids && ids.groupId) el.setAttribute('data-group-id', ids.groupId);
        if (tag === 'input' || tag === 'textarea') { el.spellcheck = tag === 'textarea'; el.autocomplete = 'off'; }
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Grow a Text Area to Its Text
    // ------------------------------------------------------------
    function Na__LeSpecEd__Grow(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(34, textarea.scrollHeight + 2) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Headings Only: Remembered in This Browser
    // ------------------------------------------------------------
    function Na__LeSpecEd__IsCompact() {
        try { return window.localStorage.getItem(Na__LeSpecEd__COMPACT_KEY) === '1'; } catch (e) { return false; }
    }
    function Na__LeSpecEd__SetCompact(on) {
        try { window.localStorage.setItem(Na__LeSpecEd__COMPACT_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The View, Edit or Read: Remembered in This Browser
    // ------------------------------------------------------------
    function Na__LeSpecEd__StoredView() {
        try {
            const view = window.localStorage.getItem(Na__LeSpecEd__VIEW_KEY);
            return (view === Na__LeSpecEd__VIEW_EDIT || view === Na__LeSpecEd__VIEW_READ) ? view : null;
        } catch (e) { return null; }
    }
    function Na__LeSpecEd__StoreView(view) {
        try { window.localStorage.setItem(Na__LeSpecEd__VIEW_KEY, view); } catch (e) { /* storage unavailable */ }
    }
    function Na__LeSpecEd__IsReading() { return Na__LeSpecEd__View === Na__LeSpecEd__VIEW_READ; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Count in Words: "1 note", "3 notes"
    // ------------------------------------------------------------
    function Na__LeSpecEd__Count(count, oneKey, oneText, manyKey, manyText) {
        return count === 1 ? Na__LeCfg__FormatLabel(oneKey, oneText, { count : count }) : Na__LeCfg__FormatLabel(manyKey, manyText, { count : count });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Chip That Opens a Sheet With a Bubble Selected
    // ------------------------------------------------------------
    function Na__LeSpecEd__GotoChip(text, sheetId, leaderId, warn) {
        const chip = Na__LeSpecEd__Button(text, 'goto', Na__LeCfg__GetLabel('SpecGotoTitle', 'Open this sheet with the bubble selected'), 'na-le-spec-chip' + (warn ? ' na-le-spec-chip--warn' : ''));
        chip.className = 'na-le-spec-chip' + (warn ? ' na-le-spec-chip--warn' : '');
        chip.setAttribute('data-sheet-id', sheetId);
        chip.setAttribute('data-leader-id', leaderId);
        return chip;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Bar and the Alerts
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Bar Once
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildBar() {
        const L   = Na__LeCfg__GetLabel;
        const bar = Na__LeSpecEd__Bar;
        bar.innerHTML = '';
        const heading = Na__LeSpecEd__El('div', 'na-le-spec__heading');
        heading.appendChild(Na__LeSpecEd__El('span', 'na-le-spec__title', L('SpecTitle', 'Project Specification')));
        const summary = Na__LeSpecEd__El('span', 'na-le-spec__summary');
        summary.setAttribute('data-na-spec-bar', 'summary');
        heading.appendChild(summary);
        bar.appendChild(heading);

        // THE VIEWS | Edit and Read, two tabs inside the tab
        const views = Na__LeSpecEd__El('div', 'na-le-spec__views');
        views.setAttribute('role', 'tablist');
        views.setAttribute('aria-label', L('SpecViewsLabel', 'Specification view'));
        [
            [ Na__LeSpecEd__VIEW_EDIT, L('SpecViewEdit', 'Edit'), L('SpecViewEditTitle', 'Write, group, order and link the notes') ],
            [ Na__LeSpecEd__VIEW_READ, L('SpecViewRead', 'Read'), L('SpecViewReadTitle', 'The specification as A4 pages, the way it prints - print it, or have the browser read it aloud') ]
        ].forEach((entry) => {
            const tab = Na__LeSpecEd__Button(entry[1], 'view', entry[2]);
            tab.className = 'na-le-spec__view';
            tab.setAttribute('role', 'tab');
            tab.setAttribute('data-view', entry[0]);
            views.appendChild(tab);
        });
        bar.appendChild(views);

        const filter = Na__LeSpecEd__Field('input', 'na-le-spec__filter', 'filter', null);
        filter.type        = 'search';
        filter.placeholder = L('SpecFilter', 'Filter notes');
        filter.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_EDIT);         // <-- Shown in one view, put away in the other
        bar.appendChild(filter);
        Na__LeSpecEd__Filter = filter;

        bar.appendChild(Na__LeSpecEd__El('span', 'na-le-spec__spacer'));
        bar.appendChild(Na__LeSpecEd__Button(L('SpecHeadingsOnly', 'Headings only'), 'compact', L('SpecHeadingsOnlyTitle', 'Fold every note to its code and title, to reorder a long specification')));
        if (Na__LeSpecEd__Editable) {
            bar.appendChild(Na__LeSpecEd__Button('', 'link-all', L('SpecLinkAllTitle', 'Link every unlinked bubble that already reads a note’s code to that note')));
            bar.appendChild(Na__LeSpecEd__Button(L('SpecAddGroup', 'Add group'), 'add-group', L('SpecAddGroupTitle', 'A new group of notes with a prefix of its own')));
            bar.appendChild(Na__LeSpecEd__Button(L('Undo', 'Undo'), 'undo', L('SpecUndoTitle', 'Undo the last change to the specification (Ctrl+Z outside a text field)')));
            bar.appendChild(Na__LeSpecEd__Button(L('Redo', 'Redo'), 'redo', L('SpecRedoTitle', 'Redo the change just undone (Ctrl+Y outside a text field)')));
        }
        [ 'compact', 'link-all', 'add-group', 'undo', 'redo' ].forEach((action) => {
            const button = bar.querySelector('[data-na-spec="' + action + '"]');
            if (button) button.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_EDIT);
        });
        const pages = Na__LeSpecEd__El('span', 'na-le-spec__pages');
        pages.setAttribute('data-na-spec-bar', 'pages');
        pages.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_READ);
        bar.appendChild(pages);
        const print = Na__LeSpecEd__Button(L('SpecPrint', 'Print'), 'print', L('SpecPrintTitle', 'Print the specification on A4 paper, or choose Save as PDF in the print dialog'));
        print.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_READ);
        bar.appendChild(print);
        const status = Na__LeSpecEd__El('span', 'na-le-spec__status');
        status.setAttribute('data-na-spec-bar', 'status');
        bar.appendChild(status);
        if (Na__LeSpecEd__Editable) {
            bar.appendChild(Na__LeSpecEd__Button(L('SpecRetry', 'Retry'), 'retry', L('SpecRetryTitle', 'Try to read the cloud copy again')));
            bar.appendChild(Na__LeSpecEd__Button(L('SpecSync', 'Sync'), 'sync', L('SpecSyncTitle', 'Write the specification to the cloud. Every change is already kept in this browser until then.')));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Bar Up to Date (cheap: no rebuild)
    // ------------------------------------------------------------
    function Na__LeSpecEd__UpdateBar() {
        if (!Na__LeSpecEd__Bar) return;
        const L     = Na__LeCfg__GetLabel;
        const state = Na__LeSpec__GetState();
        const code  = Na__DrawData__GetProjectCode();
        const notes = Na__LeSpec__ListNotes().length;
        const groups = Na__LeSpec__GetGroups().length;

        const summary = Na__LeSpecEd__Bar.querySelector('[data-na-spec-bar="summary"]');
        summary.textContent = [ code || '', state.loaded ? Na__LeSpecEd__Count(notes, 'SpecNotesOne', '{count} note', 'SpecNotesMany', '{count} notes') + ' ' + Na__LeSpecEd__Count(groups, 'SpecInGroupsOne', 'in {count} group', 'SpecInGroupsMany', 'in {count} groups') : '' ].filter(Boolean).join(' · ');

        let text, flag;
        if (state.syncing)                                  { text = L('SpecStatusSyncing', 'Syncing...'); flag = 'syncing'; }
        else if (!state.loaded)                             { text = L('SpecStatusLoading', 'Loading...'); flag = 'loading'; }
        else if (state.status === Na__LeSpec__STATUS_FAILED) { text = L('SpecStatusFailed', 'Cloud copy could not be read'); flag = 'failed'; }
        else if (state.dirty)                               { text = L('SpecStatusDirty', 'Unsynced - kept in this browser'); flag = 'dirty'; }
        else if (state.status === Na__LeSpec__STATUS_NEW)   { text = L('SpecStatusNew', 'Not in the cloud yet'); flag = 'new'; }
        else if (state.lastSyncIso)                         { text = Na__LeCfg__FormatLabel('SpecStatusSynced', 'Synced {time}', { time : new Date(state.lastSyncIso).toLocaleTimeString() }); flag = 'synced'; }
        else                                                { text = state.editable ? L('SpecStatusClean', 'Up to date with the cloud') : L('SpecStatusReadOnly', 'Read-only'); flag = 'clean'; }
        const status = Na__LeSpecEd__Bar.querySelector('[data-na-spec-bar="status"]');
        status.textContent = text;
        status.setAttribute('data-state', flag);

        const each = (action, fn) => { const button = Na__LeSpecEd__Bar.querySelector('[data-na-spec="' + action + '"]'); if (button) fn(button); };
        const matching = Na__LeSpecEd__Usage ? Array.from(Na__LeSpecEd__Usage.matching.values()).reduce((sum, list) => sum + list.length, 0) : 0;
        each('undo',      (b) => { b.disabled = !Na__LeSpec__CanUndo(); });
        each('redo',      (b) => { b.disabled = !Na__LeSpec__CanRedo(); });
        each('add-group', (b) => { b.disabled = !state.loaded; });
        each('retry',     (b) => { b.hidden = state.status !== Na__LeSpec__STATUS_FAILED || state.syncing; });
        each('sync',      (b) => { b.disabled = !state.canSync || !state.dirty; b.classList.toggle('na-le-btn--primary', state.dirty && state.canSync); });
        each('link-all',  (b) => { b.hidden = matching === 0; b.textContent = Na__LeCfg__FormatLabel('SpecLinkAll', 'Link matching bubbles ({count})', { count : matching }); });
        each('compact',   (b) => { const on = Na__LeSpecEd__IsCompact(); b.classList.toggle('na-le-btn--active', on); b.setAttribute('aria-pressed', String(on)); });
        each('print',     (b) => { b.disabled = !state.loaded; });
        Na__LeSpecEd__Bar.querySelectorAll('[data-na-spec="view"]').forEach((tab) => {
            const on = tab.getAttribute('data-view') === Na__LeSpecEd__View;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', String(on));
        });
        const pages = Na__LeSpecEd__Bar.querySelector('[data-na-spec-bar="pages"]');
        if (pages) pages.textContent = (state.loaded && Na__LeSpecEd__Pages) ? Na__LeSpecEd__Count(Na__LeSpecEd__Pages, 'SpecPagesOne', '{count} page', 'SpecPagesMany', '{count} pages') : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Warnings Above the Groups
    // ------------------------------------------------------------
    function Na__LeSpecEd__RenderAlerts(state, usage) {
        const L      = Na__LeCfg__GetLabel;
        const alerts = Na__LeSpecEd__Alerts;
        alerts.innerHTML = '';
        const add = (kind, text, extras) => {
            const box = Na__LeSpecEd__El('div', 'na-le-spec__alert na-le-spec__alert--' + kind);
            box.appendChild(Na__LeSpecEd__El('span', 'na-le-spec__alert-text', text));
            (extras || []).forEach((node) => box.appendChild(node));
            alerts.appendChild(box);
        };
        if (!Na__LeSpecEd__Editable) add('info', L('SpecReadOnlyAlert', 'Read-only: the specification is written where authoring is enabled.'));
        if (state.status === Na__LeSpec__STATUS_FAILED) {
            add('warn', Na__LeCfg__FormatLabel('SpecFailedAlert', 'The cloud copy could not be read ({error}). Changes are kept in this browser, and Sync stays off until the cloud copy can be read.', { error : state.error || 'unknown' }),
                Na__LeSpecEd__Editable ? [ Na__LeSpecEd__Button(L('SpecRetry', 'Retry'), 'retry', null, 'na-le-btn--small') ] : null);
        }
        if (usage.broken.length) {
            add('warn', Na__LeSpecEd__Count(usage.broken.length, 'SpecBrokenOne', '{count} bubble links to a note that was deleted. It keeps its last code.', 'SpecBrokenMany', '{count} bubbles link to notes that were deleted. They keep their last codes.'),
                usage.broken.map((item) => Na__LeSpecEd__GotoChip(item.sheet.Sheet__Name + ' · ' + (item.leader.Leader__Text || '?'), item.sheet.Sheet__Id, item.leader.Leader__Id, true)));
        }
        if (usage.unknown.size) {
            const chips = [];
            usage.unknown.forEach((list, code) => list.forEach((item) => chips.push(Na__LeSpecEd__GotoChip(item.sheet.Sheet__Name + ' · ' + code, item.sheet.Sheet__Id, item.leader.Leader__Id, false))));
            add('info', Na__LeCfg__FormatLabel('SpecUnknownAlert', 'Bubbles read codes no note has yet: {codes}.', { codes : Array.from(usage.unknown.keys()).join(', ') }), chips);
        }
        alerts.hidden = alerts.childElementCount === 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Groups and Notes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Page for a Project With No Specification Yet
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildEmpty() {
        const L   = Na__LeCfg__GetLabel;
        const box = Na__LeSpecEd__El('div', 'na-le-spec__empty');
        box.appendChild(Na__LeSpecEd__El('h3', 'na-le-spec__empty-title', L('SpecEmptyTitle', 'No specification yet')));
        box.appendChild(Na__LeSpecEd__El('p', 'na-le-spec__empty-text', L('SpecEmptyText', 'Group the drawing notes under prefixes - general notes, structural notes, finishes - and each note is numbered from its group: GN01, SN01, FN01. Specification bubbles on the sheets link to the notes, and each sheet’s notes margin lists the ones it uses.')));
        if (Na__LeSpecEd__Editable) {
            const row = Na__LeSpecEd__El('div', 'na-le-spec__empty-actions');
            const starters = Na__LeCfg__GetSpecificationSetup().starterGroups.map((g) => g && g.Prefix).filter(Boolean).join(', ');
            row.appendChild(Na__LeSpecEd__Button(L('SpecStarterGroups', 'Add standard groups'), 'starter', Na__LeCfg__FormatLabel('SpecStarterGroupsTitle', 'Start with the groups {prefixes}', { prefixes : starters }), 'na-le-btn--primary'));
            row.appendChild(Na__LeSpecEd__Button(L('SpecAddGroup', 'Add group'), 'add-group'));
            box.appendChild(row);
        }
        return box;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Group: Its Heading, Its Notes and Its Add Button
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildGroup(group, index, groups, usage, clashes) {
        const L        = Na__LeCfg__GetLabel;
        const editable = Na__LeSpecEd__Editable;
        const id       = group.Group__Id;
        const section  = Na__LeSpecEd__El('section', 'na-le-spec-group' + (group.Group__IsGeneral ? ' is-general' : '') + (clashes.has(group.Group__Prefix) ? ' has-clash' : ''));
        section.setAttribute('data-group-id', id);

        const head   = Na__LeSpecEd__El('div', 'na-le-spec-group__head');
        const prefix = Na__LeSpecEd__Field('input', 'na-le-spec-group__prefix', 'group-prefix', { groupId : id });
        prefix.type      = 'text';
        prefix.value     = group.Group__Prefix;
        prefix.maxLength = Na__LeCfg__GetSpecificationSetup().prefixMaxLength;
        prefix.title     = L('SpecPrefixTitle', 'This group’s prefix. Its notes are numbered from it - EE01, EE02 - and a new prefix renumbers every bubble linked to them. Letters only.');
        prefix.readOnly  = !editable;
        const title = Na__LeSpecEd__Field('input', 'na-le-spec-group__title', 'group-title', { groupId : id });
        title.type        = 'text';
        title.value       = group.Group__Title;
        title.placeholder = L('SpecGroupTitlePlaceholder', 'Group title, e.g. External Envelope');
        title.readOnly    = !editable;
        const general = Na__LeSpecEd__El('label', 'na-le-spec-group__general');
        const check   = Na__LeSpecEd__Field('input', '', 'group-general', { groupId : id });
        check.type     = 'checkbox';
        check.checked  = group.Group__IsGeneral === true;
        check.disabled = !editable;
        general.appendChild(check);
        general.appendChild(document.createTextNode(L('SpecGeneral', 'General notes')));
        general.title = L('SpecGeneralTitle', 'General notes are listed on every sheet’s notes margin, after the notes its bubbles link to.');
        head.appendChild(prefix);
        head.appendChild(title);
        head.appendChild(general);
        head.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-group__count', Na__LeSpecEd__Count(group.Group__Notes.length, 'SpecNotesOne', '{count} note', 'SpecNotesMany', '{count} notes')));
        if (editable) {
            const tools = Na__LeSpecEd__El('div', 'na-le-spec-group__tools');
            const up    = Na__LeSpecEd__Button('↑', 'group-up', L('SpecGroupUp', 'Move this group up'), 'na-le-btn--small');
            const down  = Na__LeSpecEd__Button('↓', 'group-down', L('SpecGroupDown', 'Move this group down'), 'na-le-btn--small');
            const del   = Na__LeSpecEd__Button(L('DeleteLabel', 'Delete'), 'group-delete', L('SpecGroupDelete', 'Delete this group and its notes'), 'na-le-btn--small');
            up.disabled   = index === 0;
            down.disabled = index === groups.length - 1;
            [ up, down, del ].forEach((b) => { b.setAttribute('data-group-id', id); tools.appendChild(b); });
            head.appendChild(tools);
        }
        section.appendChild(head);

        if (clashes.has(group.Group__Prefix)) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__message na-le-spec-group__message--error', Na__LeCfg__FormatLabel('SpecClashWarning', 'Another group also uses {prefix}, so the two groups’ codes clash. Give one of them a different prefix.', { prefix : group.Group__Prefix })));
        if (Na__LeSpecEd__PrefixError && Na__LeSpecEd__PrefixError.groupId === id) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__message na-le-spec-group__message--error', Na__LeSpecEd__PrefixError.message));

        const list = Na__LeSpecEd__El('ol', 'na-le-spec-notes');
        list.setAttribute('data-group-id', id);
        group.Group__Notes.forEach((note) => list.appendChild(Na__LeSpecEd__BuildNote(group, note, groups, usage)));
        section.appendChild(list);
        if (!group.Group__Notes.length) section.appendChild(Na__LeSpecEd__El('p', 'na-le-spec-group__empty', L('SpecGroupEmpty', 'No notes in this group yet.')));
        if (editable) {
            const foot = Na__LeSpecEd__El('div', 'na-le-spec-group__foot');
            const add  = Na__LeSpecEd__Button(Na__LeCfg__FormatLabel('SpecAddNote', '+ Add {prefix} note', { prefix : group.Group__Prefix }), 'note-add', null, 'na-le-btn--small');
            add.setAttribute('data-group-id', id);
            foot.appendChild(add);
            section.appendChild(foot);
        }
        return section;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Note: Grip, Code (Group and Number), Title, Text and Where It Is Used
    // ------------------------------------------------------------
    function Na__LeSpecEd__BuildNote(group, note, groups, usage) {
        const L        = Na__LeCfg__GetLabel;
        const editable = Na__LeSpecEd__Editable;
        const id       = note.Note__Id;
        const row      = Na__LeSpecEd__El('li', 'na-le-spec-note');
        row.setAttribute('data-note-id', id);

        if (editable) {
            const grip = Na__LeSpecEd__Button('', 'note-grip', L('SpecGripTitle', 'Drag to reorder - the notes are renumbered - or use Alt+Up and Alt+Down'), '');
            grip.className = 'na-le-spec-note__grip';
            grip.innerHTML = Na__LeSpecEd__GRIP_SVG;
            grip.setAttribute('data-note-id', id);
            grip.setAttribute('aria-label', L('SpecGripLabel', 'Reorder note'));
            row.appendChild(grip);
        }

        const main = Na__LeSpecEd__El('div', 'na-le-spec-note__main');
        const head = Na__LeSpecEd__El('div', 'na-le-spec-note__head');

        // CODE | The group it is in, as a choice, and its number, which is its place
        const code   = Na__LeSpecEd__El('span', 'na-le-spec-note__code');
        const choose = Na__LeSpecEd__Field('select', 'na-le-spec-note__prefix', 'note-group', { noteId : id });
        groups.forEach((g) => { const option = document.createElement('option'); option.value = g.Group__Id; option.textContent = g.Group__Prefix; choose.appendChild(option); });
        choose.value    = group.Group__Id;
        choose.title    = L('SpecNoteGroupTitle', 'The note’s group. Choose another prefix to move the note to the end of that group; both groups are renumbered.');
        choose.disabled = !editable;
        code.appendChild(choose);
        code.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-note__number', note.Note__Code.slice(group.Group__Prefix.length)));
        head.appendChild(code);

        const title = Na__LeSpecEd__Field('input', 'na-le-spec-note__title', 'note-title', { noteId : id });
        title.type        = 'text';
        title.value       = note.Note__Title;
        title.placeholder = L('SpecNoteTitlePlaceholder', 'Title');
        title.readOnly    = !editable;
        head.appendChild(title);

        const linked   = usage.byNote.get(id) || [];
        const matching = usage.matching.get(id) || [];
        const used = Na__LeSpecEd__El('span', 'na-le-spec-note__usage' + (linked.length ? ' is-used' : ''),
            linked.length ? Na__LeSpecEd__Count(linked.length, 'SpecUsedOne', '{count} bubble', 'SpecUsedMany', '{count} bubbles') : L('SpecUnused', 'Not on a sheet'));
        head.appendChild(used);
        if (editable) {
            const del = Na__LeSpecEd__Button('×', 'note-delete', L('SpecNoteDelete', 'Delete this note; the notes after it are renumbered'), 'na-le-btn--small na-le-spec-note__delete');
            del.setAttribute('data-note-id', id);
            head.appendChild(del);
        }
        main.appendChild(head);

        const body = Na__LeSpecEd__Field('textarea', 'na-le-spec-note__body', 'note-body', { noteId : id });
        body.value       = note.Note__Body;
        body.rows        = 2;
        body.placeholder = L('SpecNoteBodyPlaceholder', 'Specification text');
        body.readOnly    = !editable;
        main.appendChild(body);

        // WHERE IT IS USED | One chip per sheet, and the unlinked bubbles that already read its code
        if (linked.length || matching.length) {
            const links   = Na__LeSpecEd__El('div', 'na-le-spec-note__links');
            const bySheet = new Map();
            linked.forEach((item) => { if (!bySheet.has(item.sheet.Sheet__Id)) bySheet.set(item.sheet.Sheet__Id, []); bySheet.get(item.sheet.Sheet__Id).push(item); });
            bySheet.forEach((items) => links.appendChild(Na__LeSpecEd__GotoChip(items[0].sheet.Sheet__Name + (items.length > 1 ? ' ×' + items.length : ''), items[0].sheet.Sheet__Id, items[0].leader.Leader__Id, false)));
            if (matching.length) {
                links.appendChild(Na__LeSpecEd__El('span', 'na-le-spec-note__matching', Na__LeSpecEd__Count(matching.length, 'SpecMatchingOne', '{count} unlinked bubble reads this code', 'SpecMatchingMany', '{count} unlinked bubbles read this code')));
                if (editable) {
                    const link = Na__LeSpecEd__Button(L('SpecLink', 'Link'), 'link-note', L('SpecLinkTitle', 'Link them to this note, so they follow it when it is renumbered'), 'na-le-btn--small');
                    link.setAttribute('data-note-id', id);
                    links.appendChild(link);
                }
            }
            main.appendChild(links);
        }
        row.appendChild(main);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Remember Which Field Had the Focus, and Put It Back After a Rebuild
    // ------------------------------------------------------------
    function Na__LeSpecEd__CaptureFocus() {
        const active = document.activeElement;
        if (!Na__LeSpecEd__Page || !active || !Na__LeSpecEd__Page.contains(active)) return null;
        const field  = active.getAttribute('data-na-spec-field');
        const action = active.getAttribute('data-na-spec');
        if (!field && !action) return null;
        return {
            selector : (field ? '[data-na-spec-field="' + field + '"]' : '[data-na-spec="' + action + '"]')
                     + (active.getAttribute('data-note-id')  ? '[data-note-id="'  + CSS.escape(active.getAttribute('data-note-id'))  + '"]' : '')
                     + (active.getAttribute('data-group-id') ? '[data-group-id="' + CSS.escape(active.getAttribute('data-group-id')) + '"]' : ''),
            start : (typeof active.selectionStart === 'number') ? active.selectionStart : null,
            end   : (typeof active.selectionEnd === 'number') ? active.selectionEnd : null
        };
    }
    function Na__LeSpecEd__RestoreFocus(focus) {
        const wanted = Na__LeSpecEd__FocusAfter || focus;
        Na__LeSpecEd__FocusAfter = null;
        if (!wanted || !Na__LeSpecEd__Page) return;
        const el = Na__LeSpecEd__Page.querySelector(wanted.selector);
        if (!el) return;
        el.focus({ preventScroll : !Na__LeSpecEd__FocusAfter && !!focus });
        if (typeof wanted.start === 'number' && typeof el.setSelectionRange === 'function') {
            try { el.setSelectionRange(wanted.start, wanted.end); } catch (e) { /* not a text field */ }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Page From the Specification
    // ------------------------------------------------------------
    function Na__LeSpecEd__Render() {
        Na__LeSpecEd__Frame = 0;
        if (!Na__LeSpecEd__Root || !Na__LeSpecEd__Shown) return;
        if (Na__LeSpecEd__Drag) { Na__LeSpecEd__Drag.pending = true; return; }   // <-- Never rebuild the rows out from under a drag
        const reading = Na__LeSpecEd__IsReading();
        Na__LeSpecEd__Root.classList.toggle('is-reading', reading);
        Na__LeSpecEd__Scroll.hidden = reading;
        Na__LeSpecEd__Reader.hidden = !reading;
        if (reading) { Na__LeSpecEd__RenderReading(); return; }
        const L       = Na__LeCfg__GetLabel;
        const state   = Na__LeSpec__GetState();
        const focus   = Na__LeSpecEd__CaptureFocus();
        const scroll  = Na__LeSpecEd__ScrollBack.edit !== null ? Na__LeSpecEd__ScrollBack.edit : Na__LeSpecEd__Scroll.scrollTop;
        Na__LeSpecEd__ScrollBack.edit = null;
        const usage   = Na__LeSpecLink__Usage();
        Na__LeSpecEd__Usage = usage;
        Na__LeSpecEd__Root.classList.toggle('is-compact', Na__LeSpecEd__IsCompact());
        Na__LeSpecEd__Root.classList.toggle('is-readonly', !Na__LeSpecEd__Editable);
        Na__LeSpecEd__RenderAlerts(state, usage);

        const page = Na__LeSpecEd__Page;
        page.innerHTML = '';
        if (!state.loaded) {
            page.appendChild(Na__LeSpecEd__El('div', 'na-le-spec__empty', L('SpecLoadingPage', 'Loading the project specification...')));
        } else if (!Na__LeSpec__GetGroups().length) {
            page.appendChild(Na__LeSpecEd__BuildEmpty());
        } else {
            const groups  = Na__LeSpec__GetGroups();
            const clashes = Na__LeSpec__PrefixClashes();
            groups.forEach((group, index) => page.appendChild(Na__LeSpecEd__BuildGroup(group, index, groups, usage, clashes)));
        }
        page.querySelectorAll('textarea').forEach(Na__LeSpecEd__Grow);            // <-- Measured now the page is laid out
        Na__LeSpecEd__Scroll.scrollTop = scroll;
        Na__LeSpecEd__ApplyFilter();
        Na__LeSpecEd__UpdateBar();
        Na__LeSpecEd__RestoreFocus(focus);
    }
    // ------------------------------------------------------------


    // FUNCTION | Lay Read's Pages Out Again
    // ------------------------------------------------------------
    // From the first page every time: a note that grows can move every page
    // after it. The reader stays where it was.
    // ------------------------------------------------------------
    function Na__LeSpecEd__RenderReading() {
        const scroll = Na__LeSpecEd__ScrollBack.read !== null ? Na__LeSpecEd__ScrollBack.read : Na__LeSpecEd__Reader.scrollTop;
        Na__LeSpecEd__ScrollBack.read = null;
        Na__LeSpecEd__Root.classList.toggle('is-readonly', !Na__LeSpecEd__Editable);
        Na__LeSpecEd__Pages = Na__LeSpecDoc__Render(Na__LeSpecEd__Desk).pages;
        Na__LeSpecDoc__Fit(Na__LeSpecEd__Reader, Na__LeSpecEd__Desk);
        Na__LeSpecEd__Reader.scrollTop = scroll;
        Na__LeSpecEd__UpdateBar();
    }
    // ------------------------------------------------------------


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
        Na__LeSpecEd__View = next;
        Na__LeSpecEd__Render();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild on the Next Animation Frame (asking twice costs nothing)
    // ------------------------------------------------------------
    function Na__LeSpecEd__Schedule() {
        if (!Na__LeSpecEd__Shown || Na__LeSpecEd__Frame) return;
        Na__LeSpecEd__Frame = window.requestAnimationFrame(Na__LeSpecEd__Render);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide the Notes the Filter Does Not Match
    // ------------------------------------------------------------
    // A group is hidden when none of its notes match and neither its prefix
    // nor its title does. Grips do nothing while a filter is on: the rows on
    // show are not the group's whole order.
    // ------------------------------------------------------------
    function Na__LeSpecEd__ApplyFilter() {
        if (!Na__LeSpecEd__Page) return;
        const query = Na__LeSpecEd__Filter ? Na__LeSpecEd__Filter.value.trim().toLowerCase() : '';
        Na__LeSpecEd__Root.classList.toggle('is-filtered', query !== '');
        Na__LeSpecEd__Page.querySelectorAll('.na-le-spec-group').forEach((section) => {
            const group = Na__LeSpec__GetGroupById(section.getAttribute('data-group-id'));
            if (!group) return;
            const groupHit = !query || (group.Group__Prefix + ' ' + group.Group__Title).toLowerCase().indexOf(query) !== -1;
            let shown = 0;
            section.querySelectorAll('.na-le-spec-note').forEach((row) => {
                const entry = Na__LeSpec__GetNoteEntry(row.getAttribute('data-note-id'));
                const hit   = !query || groupHit || (entry && (entry.code + ' ' + entry.note.Note__Title + ' ' + entry.note.Note__Body).toLowerCase().indexOf(query) !== -1);
                row.hidden = !hit;
                if (hit) shown++;
            });
            section.hidden = !!query && !groupHit && shown === 0;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Scroll a Note Into View and Flash It
    // ------------------------------------------------------------
    function Na__LeSpecEd__Reveal(noteId) {
        if (!Na__LeSpecEd__Page || !noteId) return false;
        const find = () => Na__LeSpecEd__Page.querySelector('.na-le-spec-note[data-note-id="' + CSS.escape(noteId) + '"]');
        let row = find();
        if (row && row.hidden && Na__LeSpecEd__Filter) { Na__LeSpecEd__Filter.value = ''; Na__LeSpecEd__ApplyFilter(); row = find(); }
        if (!row) return false;
        row.scrollIntoView({ block : 'center' });
        row.classList.remove('is-flash');
        void row.offsetWidth;                                                     // <-- Restart the animation when the same note is revealed twice
        row.classList.add('is-flash');
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
        if (action === 'compact') { Na__LeSpecEd__SetCompact(!Na__LeSpecEd__IsCompact()); Na__LeSpecEd__Render(); return; }
        if (!Na__LeSpecEd__Editable) return;

        switch (action) {
            case 'add-group': {
                const group = Na__LeSpec__AddGroup({});
                if (group) Na__LeSpecEd__FocusAfter = { selector : '[data-na-spec-field="group-prefix"][data-group-id="' + CSS.escape(group.Group__Id) + '"]', start : 0, end : group.Group__Prefix.length };
                return;
            }
            case 'starter':      Na__LeSpec__AddStarterGroups(); return;
            case 'undo':         Na__LeSpec__Undo(); return;
            case 'redo':         Na__LeSpec__Redo(); return;
            case 'sync':         void Na__LeSpec__Sync({ showToast : Na__LeSpecEd__ShowToast }); return;
            case 'retry':        void Na__LeSpec__Retry(); return;
            case 'group-up':
            case 'group-down': {
                const index = Na__LeSpec__GetGroups().findIndex((g) => g.Group__Id === groupId);
                if (index !== -1) Na__LeSpec__MoveGroup(groupId, index + (action === 'group-up' ? -1 : 1));
                return;
            }
            case 'group-delete': void Na__LeSpecEd__DeleteGroup(groupId); return;
            case 'note-add': {
                const note = Na__LeSpec__AddNote(groupId, {});
                if (note) Na__LeSpecEd__FocusAfter = { selector : '[data-na-spec-field="note-title"][data-note-id="' + CSS.escape(note.Note__Id) + '"]', start : null, end : null };
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
        if (field === 'group-prefix') {
            const group = Na__LeSpec__GetGroupById(groupId);
            if (!group) return;
            const wanted = target.value.trim().toUpperCase();
            if (wanted === group.Group__Prefix) { if (Na__LeSpecEd__PrefixError && Na__LeSpecEd__PrefixError.groupId === groupId) { Na__LeSpecEd__PrefixError = null; Na__LeSpecEd__Schedule(); } return; }
            const result = Na__LeSpec__UpdateGroup(groupId, { prefix : wanted }, false);
            Na__LeSpecEd__PrefixError = result.ok ? null : { groupId : groupId, message : result.message };
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
// REGION | Dragging a Note by Its Grip
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Press on a Grip: Measure the Group's Rows Once
    // ------------------------------------------------------------
    // The rows and the pointer are both measured from the top of the list, so a
    // page that scrolls during the drag still lines up (the same rule as the
    // Drawing Layers grip). Rows can be any height; a row passed moves by the
    // height of the one being dragged.
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnPointerDown(event) {
        const grip = event.target && event.target.closest ? event.target.closest('[data-na-spec="note-grip"]') : null;
        if (!grip || event.button !== 0 || Na__LeSpecEd__Drag || !Na__LeSpecEd__Editable) return;
        if (Na__LeSpecEd__Filter && Na__LeSpecEd__Filter.value.trim()) return;     // <-- A filtered list is not the group's order
        const row  = grip.closest('.na-le-spec-note');
        const list = row ? row.parentNode : null;
        if (!list) return;
        const rows = Array.from(list.children);
        const from = rows.indexOf(row);
        if (from === -1) return;
        event.preventDefault();
        const top = list.getBoundingClientRect().top;
        Na__LeSpecEd__Drag = {
            noteId    : row.getAttribute('data-note-id'),
            groupId   : list.getAttribute('data-group-id'),
            list      : list,
            rows      : rows,
            slots     : rows.map((r) => { const box = r.getBoundingClientRect(); return { top : box.top - top, height : box.height }; }),
            from      : from,
            to        : from,
            startY    : event.clientY - top,
            pointerId : event.pointerId,
            moved     : false,
            pending   : false
        };
        try { grip.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LeSpecEd__DragMove, true);
        window.addEventListener('pointerup',     Na__LeSpecEd__DragUp, true);
        window.addEventListener('pointercancel', Na__LeSpecEd__DragUp, true);
        window.addEventListener('keydown',       Na__LeSpecEd__DragAbandon, true);
        window.addEventListener('blur',          Na__LeSpecEd__DragAbandon);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: The Row Follows, the Rows It Passes Slide Aside
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragMove(event) {
        const drag = Na__LeSpecEd__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const scroller = Na__LeSpecEd__Scroll.getBoundingClientRect();
        if (event.clientY < scroller.top + Na__LeSpecEd__AUTOSCROLL_PX) Na__LeSpecEd__Scroll.scrollTop -= 12;        // <-- Near the top or foot of the page, the page scrolls
        else if (event.clientY > scroller.bottom - Na__LeSpecEd__AUTOSCROLL_PX) Na__LeSpecEd__Scroll.scrollTop += 12;
        let dy = (event.clientY - drag.list.getBoundingClientRect().top) - drag.startY;
        if (!drag.moved) {
            if (Math.abs(dy) < Na__LeSpecEd__DRAG_START_PX) return;
            drag.moved = true;
            drag.list.classList.add('is-sorting');
            drag.rows[drag.from].classList.add('is-dragging');
            document.body.classList.add('na-le-sorting');
        }
        const own   = drag.slots[drag.from];
        const first = drag.slots[0];
        const last  = drag.slots[drag.slots.length - 1];
        dy = Math.max(first.top - own.top, Math.min((last.top + last.height) - (own.top + own.height), dy));
        const edgeTop    = own.top + dy;
        const edgeBottom = edgeTop + own.height;
        let to = drag.from;
        drag.slots.forEach((slot, i) => {
            const middle = slot.top + (slot.height / 2);
            if (i < drag.from && edgeTop < middle && i < to) to = i;
            if (i > drag.from && edgeBottom > middle) to = i;
        });
        drag.to = to;
        const gap   = drag.slots.length > 1 ? Math.max(0, drag.slots[1].top - (first.top + first.height)) : 0;
        const pitch = own.height + gap;
        drag.rows.forEach((row, i) => {
            const shift = i === drag.from ? dy : ((i > drag.from && i <= to) ? -pitch : ((i < drag.from && i >= to) ? pitch : 0));
            row.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel, Escape or the Window Losing Focus
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragUp(event) {
        const drag = Na__LeSpecEd__Drag;
        if (drag && event.pointerId === drag.pointerId) Na__LeSpecEd__DragEnd(event.type === 'pointerup');
    }
    function Na__LeSpecEd__DragAbandon(event) {
        if (event.type === 'keydown') {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
        }
        Na__LeSpecEd__DragEnd(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Move and a Renumber, or None
    // ------------------------------------------------------------
    // The drag is cleared before the move, whose announcement asks for a
    // rebuild that a drag in flight would put off.
    // ------------------------------------------------------------
    function Na__LeSpecEd__DragEnd(commit) {
        const drag = Na__LeSpecEd__Drag;
        if (!drag) return;
        Na__LeSpecEd__Drag = null;
        window.removeEventListener('pointermove',   Na__LeSpecEd__DragMove, true);
        window.removeEventListener('pointerup',     Na__LeSpecEd__DragUp, true);
        window.removeEventListener('pointercancel', Na__LeSpecEd__DragUp, true);
        window.removeEventListener('keydown',       Na__LeSpecEd__DragAbandon, true);
        window.removeEventListener('blur',          Na__LeSpecEd__DragAbandon);
        document.body.classList.remove('na-le-sorting');
        drag.list.classList.remove('is-sorting');
        drag.rows.forEach((row) => { row.style.transform = ''; row.classList.remove('is-dragging'); });
        const moved = commit && drag.moved && drag.to !== drag.from && Na__LeSpec__MoveNote(drag.noteId, drag.groupId, drag.to);
        if (!moved && drag.pending) Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Listening While Shown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Specification Changed
    // ------------------------------------------------------------
    // Typing into a title or a text only needs the bar: the field already shows
    // it. A group's own settings, a structural change, an undo or a load
    // rebuilds, keeping the focus where it was.
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnSpecChanged(event) {
        const detail  = event.detail || {};
        const barOnly = detail.reason === 'status' || detail.reason === 'synced';
        const typed   = detail.reason === 'note' || (detail.reason === 'group' && detail.live);
        if (barOnly || (typed && !Na__LeSpecEd__IsReading())) {                    // <-- Read has no field showing the typing: its pages are laid out again
            Na__LeSpecEd__UpdateBar();
            if (barOnly) Na__LeSpecEd__RenderAlerts(Na__LeSpec__GetState(), Na__LeSpecEd__Usage || Na__LeSpecLink__Usage());
            return;
        }
        Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet Changed (links made from this page): Where Notes Are Used Moved
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnModelChanged() {
        if (Na__LeSpecEd__IsReading()) return;                                     // <-- The pages do not say where a note is used
        Na__LeSpecEd__Schedule();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Window Resized: Read's Pages Fit Its New Width
    // ------------------------------------------------------------
    function Na__LeSpecEd__OnResize() {
        if (Na__LeSpecEd__Shown && Na__LeSpecEd__IsReading()) Na__LeSpecDoc__Fit(Na__LeSpecEd__Reader, Na__LeSpecEd__Desk);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Page Inside the Editor Host (once)
    // ------------------------------------------------------------
    // options: { editable, showToast }
    // ------------------------------------------------------------
    function Na__LeSpecEd__Mount(container, options) {
        if (!container) return false;
        Na__LeSpecEd__Editable  = !!(options && options.editable);
        Na__LeSpecEd__ShowToast = (options && options.showToast) || null;
        if (Na__LeSpecEd__Root && Na__LeSpecEd__Root.parentNode === container) return true;
        const root = Na__LeSpecEd__El('div', 'na-le-spec');
        root.hidden = true;
        root.setAttribute('role', 'region');
        root.setAttribute('aria-label', Na__LeCfg__GetLabel('SpecTitle', 'Project Specification'));
        root.innerHTML = '<div class="na-le-spec__bar"></div><div class="na-le-spec__alerts" hidden></div><div class="na-le-spec__scroll"><div class="na-le-spec__page"></div></div>'
            + '<div class="na-le-spec__reader" role="region" tabindex="0" hidden><div class="na-le-spec__desk"></div></div>';
        container.appendChild(root);
        Na__LeSpecEd__Root   = root;
        Na__LeSpecEd__Bar    = root.querySelector('.na-le-spec__bar');
        Na__LeSpecEd__Alerts = root.querySelector('.na-le-spec__alerts');
        Na__LeSpecEd__Scroll = root.querySelector('.na-le-spec__scroll');
        Na__LeSpecEd__Page   = root.querySelector('.na-le-spec__page');
        Na__LeSpecEd__Reader = root.querySelector('.na-le-spec__reader');
        Na__LeSpecEd__Desk   = root.querySelector('.na-le-spec__desk');
        Na__LeSpecEd__Reader.setAttribute('aria-label', Na__LeCfg__GetLabel('SpecReaderLabel', 'Project Specification pages'));
        Na__LeSpecEd__View   = Na__LeSpecEd__StoredView() || (Na__LeSpecEd__Editable ? Na__LeSpecEd__VIEW_EDIT : Na__LeSpecEd__VIEW_READ);   // <-- A read-only session starts on the pages
        Na__LeSpecDoc__Initialize({ isPrintable : () => Na__LeSpecEd__Shown });
        Na__LeSpecEd__BuildBar();
        root.addEventListener('click',       Na__LeSpecEd__OnClick);
        root.addEventListener('input',       Na__LeSpecEd__OnInput);
        root.addEventListener('change',      Na__LeSpecEd__OnChange);
        root.addEventListener('keydown',     Na__LeSpecEd__OnKeyDown);
        root.addEventListener('pointerdown', Na__LeSpecEd__OnPointerDown);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Page (options: { noteId } to bring one note into view)
    // ------------------------------------------------------------
    function Na__LeSpecEd__Show(options) {
        if (!Na__LeSpecEd__Root) return false;
        const opts = options || {};
        if (opts.noteId && Na__LeSpecEd__IsReading()) {                            // <-- A note asked for from a sheet is shown where it is edited
            Na__LeSpecEd__View = Na__LeSpecEd__VIEW_EDIT;
            Na__LeSpecEd__StoreView(Na__LeSpecEd__VIEW_EDIT);
        }
        if (!Na__LeSpecEd__Shown) {
            Na__LeSpecEd__Shown = true;
            Na__LeSpecEd__Root.hidden = false;
            Na__LeSpecEd__Root.parentNode.classList.add('is-spec-shown');          // <-- The sheet beneath is covered: hidden too, out of Read Aloud and find
            window.addEventListener(Na__LeSpec__CHANGED_EVENT, Na__LeSpecEd__OnSpecChanged);
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeSpecEd__OnModelChanged);
            window.addEventListener('resize', Na__LeSpecEd__OnResize);
        }
        Na__LeSpecEd__Render();
        if (opts.noteId) Na__LeSpecEd__Reveal(opts.noteId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Page
    // ------------------------------------------------------------
    // A field that still has the focus is committed first, so what was typed
    // into it is an undo step and reaches the draft.
    // ------------------------------------------------------------
    function Na__LeSpecEd__Hide() {
        if (!Na__LeSpecEd__Root || !Na__LeSpecEd__Shown) return false;
        const active = document.activeElement;
        if (active && Na__LeSpecEd__Root.contains(active) && typeof active.blur === 'function') active.blur();
        if (Na__LeSpecEd__Drag) Na__LeSpecEd__DragEnd(false);
        if (Na__LeSpecEd__Frame) { window.cancelAnimationFrame(Na__LeSpecEd__Frame); Na__LeSpecEd__Frame = 0; }
        window.removeEventListener(Na__LeSpec__CHANGED_EVENT, Na__LeSpecEd__OnSpecChanged);
        window.removeEventListener(Na__LeModel__CHANGED_EVENT, Na__LeSpecEd__OnModelChanged);
        window.removeEventListener('resize', Na__LeSpecEd__OnResize);
        Na__LeSpecEd__ScrollBack[Na__LeSpecEd__View] = Na__LeSpecEd__IsReading() ? Na__LeSpecEd__Reader.scrollTop : Na__LeSpecEd__Scroll.scrollTop;   // <-- Back where it was on the next visit
        Na__LeSpecEd__Shown = false;
        Na__LeSpecEd__Root.hidden = true;
        Na__LeSpecEd__Root.parentNode.classList.remove('is-spec-shown');
        Na__LeSpecEd__PrefixError = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Page on Screen, and Which View It Shows
    // ------------------------------------------------------------
    function Na__LeSpecEd__IsShown() { return Na__LeSpecEd__Shown; }
    function Na__LeSpecEd__GetView() { return Na__LeSpecEd__View; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor API
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__Mount,
        Na__LeSpecEd__Show,
        Na__LeSpecEd__Hide,
        Na__LeSpecEd__IsShown,
        Na__LeSpecEd__GetView,
        Na__LeSpecEd__SetView,
        Na__LeSpecEd__Render,
        Na__LeSpecEd__Reveal
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
