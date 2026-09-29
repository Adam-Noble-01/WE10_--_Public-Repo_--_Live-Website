// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION EDITOR - BAR AND ALERTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecEditor__Bar__.js
// NAMESPACE  : Na__LeSpecEd
// MODULE     : Layout Editor - Specification Editor - Bar and Alerts
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Project Specification page's bar (views, filter, tools, pages, sync state) and the alerts above its groups
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Builds the bar once: the title and summary, the Edit and Read tabs, the
//   filter, Headings only, the editing tools, Read's page count and Print,
//   the sync state, Retry and Sync. Each control says which view it is in.
// - Brings the bar up to date without a rebuild: the summary, the sync state,
//   which buttons are enabled or hidden, the tab on show and the page count.
// - The alerts above the groups: a read-only session, a cloud copy that could
//   not be read, bubbles linked to deleted notes, and codes no note has.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecEditor__ builds the bar when it mounts, and brings
//   it up to date when a change needs no rebuild (typing, or a new sync
//   state, which redraws the alerts too). Na__LayoutEditor__SpecEditor__Render__
//   brings the bar and the alerts up to date as it rebuilds.
// - Keeps the filter field through Na__LayoutEditor__SpecEditor__State__'s
//   accessor.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : the project code's import path (TrueVision3D's drawing core is 40__System__DrawingViewCore); the go-to chips read Na__LeModel__GetTabLabel (short tab names, TrueVision first on 19-Sep-2026)
// - Back-port     : n/a (ValeVision3D's copy is already split into the same units)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.4.0
// - SHARE after Print, in Read only (and so in the web viewer, which is
//   always on Read): a link that opens this specification's Read view on
//   any device (66__Feature__DocumentSharing, TrueVision3D v2.166.0).
//
// 29-Sep-2026 - Version 1.3.0
// - The status says how the specification stands against its LOCAL FILE
//   first and the cloud second, as the Statement Writer's does (the lockstep,
//   Na__LayoutEditor__SpecData__Lockstep__): "Out of step with the file"
//   while the question is up, "Unsaved changes" until the autosave has
//   written the file, then "Saved to file, not synced" until Save Sheets or
//   Sync. Its hover says when the file on disk last changed. Where the
//   lockstep is off the wording is as it was.
// - An alert above the groups while the question stands.
//
// 19-Sep-2026 - Version 1.2.0
// - A go-to chip names its sheet as the tab does (Na__LeModel__GetTabLabel,
//   "D03 - 3D Images"). The sheet's name alone no longer carries a number.
//
// 18-Sep-2026 - Version 1.1.0
// - Added the Reload R2 and Reload Local buttons beside Retry and Sync: a
//   fast, explicit re-read of either copy, for when a file changed outside
//   this browser (another session, or an LLM editing the file on disk) and a
//   hard refresh was previously the only way to catch up. Reload Local is
//   built only when CanReloadLocal (localhost) says the local copy exists.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecEditor__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Specification and Project Code
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__GetState,
        Na__LeSpec__GetGroups,
        Na__LeSpec__ListNotes,
        Na__LeSpec__CanUndo,
        Na__LeSpec__CanRedo,
        Na__LeSpec__GetRevision,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__CanReloadCloud,
        Na__LeSpec__CanReloadLocal
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeModel__GetTabLabel } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';   // <-- A chip names a sheet as its tab does ("D03 - 3D Images")
    import { Na__LeStmtLock__When } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Lockstep__.js';   // <-- A time said as the statement's status says it
    import { Na__LeShareUi__Open } from '../66__Feature__DocumentSharing/Na__LayoutEditor__Share__Button__.js';   // <-- Share: the link to this specification's Read view
    // ------------------------------------------------------------

    // MODULE IMPORTS | Specification Editor Units: State and Small Builders
    // ------------------------------------------------------------
    import {
        Na__LeSpecEd__VIEW_EDIT,
        Na__LeSpecEd__VIEW_READ,
        Na__LeSpecEd__Bar,
        Na__LeSpecEd__Alerts,
        Na__LeSpecEd__Editable,
        Na__LeSpecEd__Usage,
        Na__LeSpecEd__View,
        Na__LeSpecEd__Pages,
        Na__LeSpecEd__AssignFilter
    } from './Na__LayoutEditor__SpecEditor__State__.js';
    import {
        Na__LeSpecEd__El,
        Na__LeSpecEd__Button,
        Na__LeSpecEd__Field,
        Na__LeSpecEd__IsCompact,
        Na__LeSpecEd__Count,
        Na__LeSpecEd__GotoChip
    } from './Na__LayoutEditor__SpecEditor__Builders__.js';
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
        Na__LeSpecEd__AssignFilter(filter);

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
        // THE ISSUE | The document's own number and revision, in BOTH views:
        // they belong to the specification, not to how it is being looked at, and
        // they are what the download is named after.
        const issue = Na__LeSpecEd__El('div', 'na-le-spec__issue');
        const number = Na__LeSpecEd__Field('input', 'na-le-spec__issue-field na-le-spec__issue-field--number', 'spec-number', null);
        number.type  = 'text';
        number.setAttribute('aria-label', L('SpecDocNumberLabel', 'Document number'));
        number.title = L('SpecDocNumberTitle', 'The specification’s own number, the way each sheet carries a Drawing No. Left blank it follows the project code.');
        number.disabled = !Na__LeSpecEd__Editable;
        issue.appendChild(Na__LeSpecEd__El('span', 'na-le-spec__issue-label', L('SpecDocRevisionShort', 'Rev')));
        const revision = Na__LeSpecEd__Field('input', 'na-le-spec__issue-field na-le-spec__issue-field--rev', 'spec-revision', null);
        revision.type = 'text';
        revision.setAttribute('aria-label', L('SpecDocRevisionLabel', 'Specification revision'));
        revision.title = L('SpecDocRevisionTitle', 'The revision this specification is issued at. It prints on the document and names the downloaded file.');
        revision.disabled = !Na__LeSpecEd__Editable;
        issue.insertBefore(number, issue.firstChild);
        issue.appendChild(revision);
        bar.appendChild(issue);

        const pages = Na__LeSpecEd__El('span', 'na-le-spec__pages');
        pages.setAttribute('data-na-spec-bar', 'pages');
        pages.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_READ);
        bar.appendChild(pages);
        const download = Na__LeSpecEd__Button(L('SpecDownload', 'Download'), 'download', L('SpecDownloadTitle', 'Download the specification as a PDF, named after its number, revision and today’s date'));
        bar.appendChild(download);
        const print = Na__LeSpecEd__Button(L('SpecPrint', 'Print'), 'print', L('SpecPrintTitle', 'Print the specification on A4 paper, or choose Save as PDF in the print dialog'));
        print.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_READ);
        bar.appendChild(print);
        // SHARE | Read only: a link that opens this specification's Read view on
        // any device (66__Feature__DocumentSharing). Its own click, so the bar's
        // delegated handler passes 'share' by as an action it does not know.
        const share = Na__LeSpecEd__Button(L('SpecShare', 'Share'), 'share', L('SpecShareTitle', 'A link that opens this specification, read-only, on any device'));
        share.setAttribute('data-na-spec-only', Na__LeSpecEd__VIEW_READ);
        share.addEventListener('click', () => { Na__LeShareUi__Open(share, { kind : 'specification' }); });
        bar.appendChild(share);
        const status = Na__LeSpecEd__El('span', 'na-le-spec__status');
        status.setAttribute('data-na-spec-bar', 'status');
        bar.appendChild(status);
        if (Na__LeSpecEd__Editable) {
            bar.appendChild(Na__LeSpecEd__Button(L('SpecReloadCloud', 'Reload R2'), 'reload-cloud', L('SpecReloadCloudBtnTitle', 'Force-reload the specification from the cloud copy on R2, in case it changed since this browser last read it. Asks first if this browser has unsynced changes.')));
            if (Na__LeSpec__CanReloadLocal()) {
                bar.appendChild(Na__LeSpecEd__Button(L('SpecReloadLocal', 'Reload Local'), 'reload-local', L('SpecReloadLocalBtnTitle', 'Force-reload the specification from the local file on disk, in case it changed since this browser last read it - for example an edit made outside the browser. Asks first if this browser has unsynced changes.')));
            }
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

        // THE STATUS | The file on disk first, the cloud second: they are
        // different questions, and the file is the one an agent writes.
        const onDisk = state.lockstep && state.fileKnown;
        let text, flag;
        if (state.conflict)                                 { text = L('SpecStatusOutOfStep', 'Out of step with the file'); flag = 'failed'; }
        else if (state.syncing)                             { text = L('SpecStatusSyncing', 'Syncing...'); flag = 'syncing'; }
        else if (!state.loaded)                             { text = L('SpecStatusLoading', 'Loading...'); flag = 'loading'; }
        else if (state.savingLocal)                         { text = L('SpecStatusSavingLocal', 'Saving...'); flag = 'syncing'; }
        else if (state.status === Na__LeSpec__STATUS_FAILED) { text = L('SpecStatusFailed', 'Cloud copy could not be read'); flag = 'failed'; }
        else if (onDisk && !state.inStepWithFile)           { text = L('SpecStatusUnsavedLocal', 'Unsaved changes'); flag = 'dirty'; }
        else if (state.dirty)                               { text = onDisk ? L('SpecStatusSavedNotSynced', 'Saved to file, not synced') : L('SpecStatusDirty', 'Unsynced - kept in this browser'); flag = 'dirty'; }
        else if (state.status === Na__LeSpec__STATUS_NEW)   { text = L('SpecStatusNew', 'Not in the cloud yet'); flag = 'new'; }
        else if (state.lastSyncIso)                         { text = Na__LeCfg__FormatLabel('SpecStatusSynced', 'Synced {time}', { time : new Date(state.lastSyncIso).toLocaleTimeString() }); flag = 'synced'; }
        else                                                { text = state.editable ? L('SpecStatusClean', 'Up to date with the cloud') : L('SpecStatusReadOnly', 'Read-only'); flag = 'clean'; }
        const status = Na__LeSpecEd__Bar.querySelector('[data-na-spec-bar="status"]');
        status.textContent = text;
        status.setAttribute('data-state', flag);
        status.title = onDisk
            ? Na__LeCfg__FormatLabel('SpecStatusFileTitle', 'The specification file on disk was last changed {when}. It is watched while the drawing editor is open: a change made outside the app is asked about, never written over.', { when : Na__LeStmtLock__When(state.fileIso) })
            : '';

        const each = (action, fn) => { const button = Na__LeSpecEd__Bar.querySelector('[data-na-spec="' + action + '"]'); if (button) fn(button); };
        const matching = Na__LeSpecEd__Usage ? Array.from(Na__LeSpecEd__Usage.matching.values()).reduce((sum, list) => sum + list.length, 0) : 0;
        each('undo',      (b) => { b.disabled = !Na__LeSpec__CanUndo(); });
        each('redo',      (b) => { b.disabled = !Na__LeSpec__CanRedo(); });
        each('add-group', (b) => { b.disabled = !state.loaded; });
        each('reload-cloud', (b) => { b.disabled = state.syncing || !Na__LeSpec__CanReloadCloud(); });
        each('reload-local', (b) => { b.disabled = state.syncing; });
        each('retry',     (b) => { b.hidden = state.status !== Na__LeSpec__STATUS_FAILED || state.syncing; });
        each('sync',      (b) => { b.disabled = !state.canSync || !state.dirty; b.classList.toggle('na-le-btn--primary', state.dirty && state.canSync); });
        each('link-all',  (b) => { b.hidden = matching === 0; b.textContent = Na__LeCfg__FormatLabel('SpecLinkAll', 'Link matching bubbles ({count})', { count : matching }); });
        each('compact',   (b) => { const on = Na__LeSpecEd__IsCompact(); b.classList.toggle('na-le-btn--active', on); b.setAttribute('aria-pressed', String(on)); });
        each('print',     (b) => { b.disabled = !state.loaded; });
        each('download',  (b) => { b.disabled = !state.loaded || notes === 0; });

        // The issue fields are not rewritten under the cursor: a field being typed
        // into keeps what is in it, the way every other field on this bar does.
        const field = (name, value) => {
            const el = Na__LeSpecEd__Bar.querySelector('[data-na-spec-field="' + name + '"]');
            if (el && document.activeElement !== el) el.value = value;
            if (el) el.disabled = !Na__LeSpecEd__Editable || !state.loaded;
        };
        field('spec-number', state.loaded ? Na__LeSpec__GetDocumentNumber(code) : '');
        field('spec-revision', state.loaded ? Na__LeSpec__GetRevision() : '');
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
        if (state.conflict) {
            add('warn', L('SpecOutOfStepAlert', 'The specification and its file on disk are out of step. Nothing is saved or synced until you choose which copy to keep.'));
        }
        if (state.status === Na__LeSpec__STATUS_FAILED) {
            add('warn', Na__LeCfg__FormatLabel('SpecFailedAlert', 'The cloud copy could not be read ({error}). Changes are kept in this browser, and Sync stays off until the cloud copy can be read.', { error : state.error || 'unknown' }),
                Na__LeSpecEd__Editable ? [ Na__LeSpecEd__Button(L('SpecRetry', 'Retry'), 'retry', null, 'na-le-btn--small') ] : null);
        }
        if (usage.broken.length) {
            add('warn', Na__LeSpecEd__Count(usage.broken.length, 'SpecBrokenOne', '{count} bubble links to a note that was deleted. It keeps its last code.', 'SpecBrokenMany', '{count} bubbles link to notes that were deleted. They keep their last codes.'),
                usage.broken.map((item) => Na__LeSpecEd__GotoChip(Na__LeModel__GetTabLabel(item.sheet) + ' · ' + (item.leader.Leader__Text || '?'), item.sheet.Sheet__Id, item.leader.Leader__Id, true)));
        }
        if (usage.unknown.size) {
            const chips = [];
            usage.unknown.forEach((list, code) => list.forEach((item) => chips.push(Na__LeSpecEd__GotoChip(Na__LeModel__GetTabLabel(item.sheet) + ' · ' + code, item.sheet.Sheet__Id, item.leader.Leader__Id, false))));
            add('info', Na__LeCfg__FormatLabel('SpecUnknownAlert', 'Bubbles read codes no note has yet: {codes}.', { codes : Array.from(usage.unknown.keys()).join(', ') }), chips);
        }
        alerts.hidden = alerts.childElementCount === 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Editor Bar and Alerts
    // ------------------------------------------------------------
    export {
        Na__LeSpecEd__BuildBar,
        Na__LeSpecEd__UpdateBar,
        Na__LeSpecEd__RenderAlerts
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
