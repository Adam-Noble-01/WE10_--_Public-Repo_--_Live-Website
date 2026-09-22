// =============================================================================
// TRUEVISION3D - LOCAL FILE PARITY - WATCHER
// =============================================================================
//
// FILE       : Na__FileParity__Watcher__.js
// NAMESPACE  : Na__FileParity
// MODULE     : Local File Parity - Watcher
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Notice when a project file this window is working on changes on disk outside it, say so ("Local File Updates Detected"), stop a save that would bury the change, and load the new version when asked
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE FAULT. The drawings editor had one Save button and no idea whether
//   the files behind it had moved. An agent writes the drawing notes, the
//   project data or a statement on disk; the window still holds the copy it
//   loaded; Save Sheets, Sync, an auto save or a quiet statement save writes
//   that copy back over the agent's work. It happened again and again.
//   ("Too easy to save over the agent's work, as I keep doing" - Adam.)
// - WHAT THIS WINDOW HOLDS. The fetch observer reads the version the local
//   server stamps on every read of a watched file (X-Na-File-Version) as the
//   loaders make them - the loading sequence's project data, the
//   specification's local copy, a statement opened in the Statement Writer -
//   so the baseline is exactly the version each loader took in, and no loader
//   had to change to say so. Writes report through the local mirror.
// - CHECKED EVERY 30 SECONDS, while the window is visible, and straight away
//   when it becomes visible or takes focus again (coming back from the agent's
//   terminal is exactly when a change is most likely), when the server refuses
//   a write, and before every save.
// - THE NOTICE. A change to a file this window holds raises "Local File
//   Updates Detected" once per new version: Reload Changes, or Not Now. Not
//   Now leaves a pill at the foot of the window until the change is dealt
//   with. A file caught mid-write (not valid JSON yet) is looked at again a
//   few seconds later rather than announced half-written.
// - THE SAVE GATE. Before the drawings save and the specification Sync write
//   anything - R2 first, the local copy second - they ask here. A change that
//   the save would write over raises the save question: Reload Changes,
//   Overwrite With My Version, or Cancel. A change the save would not touch
//   (a build sync's model groups, when the drawings save merges only its own
//   keys) is taken as seen and the save goes on. The local server's own 409
//   guard stands behind this for anything that gets past it.
// - RELOAD. A specification change alone is reloaded in place through the
//   specification's own Reload from Local. Anything else - the project data,
//   the statement index, a statement - reloads the app: the close guard is
//   released, the browser draft of a file that changed is discarded (the
//   modal said so), and every other unsaved draft is written first so it
//   comes back after the reload.
// - THE DRAFT QUESTION. The sheet draft and the specification draft ask here
//   before they come back over a file that someone else changed after they
//   were made: Use the File on Disk, or Restore My Unsaved Changes.
// - LOCALHOST ONLY, with a project folder in the URL. A server from before
//   the file-watch route is noticed once, said once ("restart the local
//   server"), and the watcher then stands down: every save goes ahead
//   exactly as it did before this module.
//
// INTEGRATION:
// - Initialised from Index.html BEFORE the loading sequence, so its fetch
//   observer sees the loading sequence's own read of the project data.
// - Registers the drawings save gate with Na__DrawView__ProjectData__ and
//   installs ConfirmSave and AskDraft in Na__FileParity__Registry__, which the
//   specification's Sync and both browser drafts call.
// - Asks the local server: GET /api/truevision/file-watch/state
//   (na-apps/ProjectVision__TrueVisionFileWatch__Api__.py).
// // @delegate: ./Na__FileParity__Registry__.js
// // @delegate: ./Na__FileParity__Logic__.js
// // @delegate: ./Na__FileParity__Modal__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. The reload actions name TrueVision's own
//                   Layout Editor, specification and auto save modules.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Registry, the Logic and the Modal
    // ------------------------------------------------------------
    import {
        Na__FileParity__EVENT,
        Na__FileParity__HEADER_VERSION,
        Na__FileParity__HEADER_MTIME,
        Na__FileParity__HEADER_PEEK,
        Na__FileParity__ClientId,
        Na__FileParity__IsAvailable,
        Na__FileParity__Context,
        Na__FileParity__NormaliseKey,
        Na__FileParity__KeyForUrl,
        Na__FileParity__NoteRead,
        Na__FileParity__NoteOwnWrite,
        Na__FileParity__Acknowledge,
        Na__FileParity__Baseline,
        Na__FileParity__BaseVersion,
        Na__FileParity__Baselines__All,
        Na__FileParity__InstallImpl
    } from './Na__FileParity__Registry__.js';
    import { Na__FileParity__FindChanges, Na__FileParity__IsConflict, Na__FileParity__When } from './Na__FileParity__Logic__.js';
    import {
        Na__FileParityUi__Show,
        Na__FileParityUi__OpenMode,
        Na__FileParityUi__CloseNotice,
        Na__FileParityUi__SetPill
    } from './Na__FileParity__Modal__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | What a Reload Touches: the Drawings Save, the Specification and the Sheet Drafts
    // ------------------------------------------------------------
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js
    // @delegate: ../51__System__LayoutEditor/50__Feature__Specification/Na__LayoutEditor__SpecData__.js
    // @delegate: ../51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__AutoSave__.js
    // ------------------------------------------------------------
    import { Na__DrawData__RegisterSaveGate } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeSpec__ReloadFromLocal, Na__LeSpec__IsDirty, Na__LeSpec__FlushDraft } from '../51__System__LayoutEditor/50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpec__ClearDraft } from '../51__System__LayoutEditor/50__Feature__Specification/Na__LayoutEditor__SpecData__Draft__.js';
    import { Na__LeModel__IsDirty } from '../51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeAuto__DiscardSavedDraft, Na__LeAuto__ReleaseCloseGuard } from '../51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__AutoSave__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Timing
    // ------------------------------------------------------------
    const Na__FileParityWatch__POLL_MS         = 30000;    // <-- Adam's figure: a background check every 30 seconds
    const Na__FileParityWatch__FIRST_CHECK_MS  = 4000;     // <-- The loading sequence reads the files first
    const Na__FileParityWatch__FOCUS_CHECK_MS  = 600;      // <-- Coming back to the window
    const Na__FileParityWatch__SETTLE_CHECK_MS = 1500;     // <-- After a read or a write moves a baseline
    const Na__FileParityWatch__MIDWRITE_MS     = 3000;     // <-- A file caught half written is looked at again
    const Na__FileParityWatch__STATE_TIMEOUT   = 8000;
    const Na__FileParityWatch__STATE_ROUTE     = '/api/truevision/file-watch/state';
    const Na__FileParityWatch__DATA_KEYS       = ['project-data', 'drawing-notes', 'statement-index'];
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Watcher's State
    // ------------------------------------------------------------
    let Na__FileParityWatch__Ready      = false;
    let Na__FileParityWatch__Enabled    = false;
    let Na__FileParityWatch__PollTimer  = null;
    let Na__FileParityWatch__SoonTimer  = null;
    let Na__FileParityWatch__Checking   = null;        // <-- The check in flight: everyone waiting shares it
    let Na__FileParityWatch__Reloading  = false;
    let Na__FileParityWatch__ServerSaid = false;       // <-- "Restart the local server" is said once
    let Na__FileParityWatch__LastCheck  = 0;
    const Na__FileParityWatch__Pending  = new Map();   // <-- key -> change: moved on disk, not yet dealt with
    const Na__FileParityWatch__Notified = new Map();   // <-- key -> the version already announced, so it is announced once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The App's Toast (through the Index.html event bridge)
    // ------------------------------------------------------------
    function Na__FileParityWatch__Toast(message, isError) {
        try { window.dispatchEvent(new CustomEvent('na-show-toast', { detail : { message : message, isError : isError === true } })); }
        catch (error) { /* a toast is a courtesy */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Promise With a Time Limit
    // ------------------------------------------------------------
    function Na__FileParityWatch__WithTimeout(promise, ms) {
        let timer = null;
        const limit = new Promise((resolve, reject) => { timer = window.setTimeout(() => reject(new Error('timed out')), ms); });
        return Promise.race([promise, limit]).finally(() => window.clearTimeout(timer));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which of These Changes This Window Holds Unsaved Work Against
    // ------------------------------------------------------------
    function Na__FileParityWatch__DirtyKeys(changes) {
        const dirty = [];
        (changes || []).forEach((change) => {
            try {
                if (change.key === 'project-data' && Na__LeModel__IsDirty()) dirty.push(change.key);
                if (change.key === 'drawing-notes' && Na__LeSpec__IsDirty()) dirty.push(change.key);
            } catch (error) { /* a unit that never loaded holds nothing unsaved */ }
        });
        return dirty;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does Reloading These Changes Need the Whole App Reloaded
    // ------------------------------------------------------------
    // Only the specification can take a new file in place; everything else is
    // read once, as the project loads.
    // ------------------------------------------------------------
    function Na__FileParityWatch__NeedsAppReload(changes) {
        return (changes || []).some((change) => change.key !== 'drawing-notes');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Reload Changes and Not Now Will Do, in Words
    // ------------------------------------------------------------
    function Na__FileParityWatch__ReloadNotes(changes, mode) {
        const notes = [];
        notes.push(Na__FileParityWatch__NeedsAppReload(changes)
            ? 'Reload Changes reloads TrueVision with the files on disk. Unsaved changes to the files listed are replaced; any other unsaved work is kept in this browser and comes back after the reload.'
            : 'Reload Changes loads the new specification into this window straight away. Nothing else is touched.');
        if (mode === 'notice') notes.push('Not Now keeps working on this window\'s copy. The next save of these files asks first.');
        if (mode === 'save')   notes.push('Overwrite With My Version saves this window\'s copy over the file on disk, and the changes made there are lost.');
        return notes;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fetch Observer (what each loader actually read)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is a Request Marked as a Read That Is Not Taken In
    // ------------------------------------------------------------
    function Na__FileParityWatch__IsPeek(input, init) {
        const wanted  = Na__FileParity__HEADER_PEEK.toLowerCase();
        const headers = init && init.headers;
        if (headers) {
            if (typeof Headers !== 'undefined' && headers instanceof Headers) { if (headers.has(wanted)) return true; }
            else if (Array.isArray(headers)) { if (headers.some((pair) => String(pair && pair[0]).toLowerCase() === wanted)) return true; }
            else if (typeof headers === 'object' && Object.keys(headers).some((name) => name.toLowerCase() === wanted)) return true;
        }
        return (typeof Request !== 'undefined' && input instanceof Request) ? input.headers.has(wanted) : false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Note the Version a Read of a Watched File Took In
    // ------------------------------------------------------------
    function Na__FileParityWatch__WatchRead(input, init, promise) {
        const isRequest = (typeof Request !== 'undefined') && input instanceof Request;
        const method = String((init && init.method) || (isRequest ? input.method : 'GET')).toUpperCase();
        if (method !== 'GET') return;
        if (Na__FileParityWatch__IsPeek(input, init)) return;                     // <-- The mirror's read before its merge: nothing is taken in
        const key = Na__FileParity__KeyForUrl(isRequest ? input.url : input);
        if (!key) return;
        promise.then((response) => {
            if (!response || !(response.ok || response.status === 304)) return;
            const version = response.headers.get(Na__FileParity__HEADER_VERSION);
            if (!version) return;                                                  // <-- A server from before the guard stamps nothing
            const mtime = Number(response.headers.get(Na__FileParity__HEADER_MTIME));
            Na__FileParity__NoteRead(key, version, Number.isFinite(mtime) ? mtime : null);
        }, () => { /* a failed read took nothing in */ });
    }
    // ------------------------------------------------------------


    // FUNCTION | Wrap window.fetch Once, So Every Loader's Read Is Seen
    // ------------------------------------------------------------
    // The request itself is never touched: the observer only reads the answer's
    // headers after the loader's fetch has answered, and anything that goes
    // wrong in it is swallowed rather than costing the request.
    // ------------------------------------------------------------
    function Na__FileParityWatch__ObserveFetch() {
        const original = window.fetch;
        if (typeof original !== 'function' || original.Na__FileParity__Observer === true) return;
        const observer = function (input, init) {
            const promise = original.call(window, input, init);
            try { Na__FileParityWatch__WatchRead(input, init, promise); }
            catch (error) { /* observing must never cost a request */ }
            return promise;
        };
        observer.Na__FileParity__Observer = true;
        window.fetch = observer;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Asking the Server
// -----------------------------------------------------------------------------

    // FUNCTION | The Version of Every Watched File on Disk, or Null
    // ------------------------------------------------------------
    // extraBases: key -> version to describe as the "before" (a draft's own
    // version); otherwise this window's baselines are sent. Null when the
    // server could not be asked - and a server without the route stands the
    // watcher down for the rest of the session, once said.
    // ------------------------------------------------------------
    async function Na__FileParityWatch__FetchState(extraBases) {
        const context = Na__FileParity__Context();
        if (!context) return null;
        const params = new URLSearchParams({ 'project-folder' : context.folder, year : context.year });
        const bases  = [];
        Na__FileParityWatch__DATA_KEYS.forEach((key) => {
            const version = (extraBases && extraBases[key]) || Na__FileParity__BaseVersion(key);
            if (version && /^[0-9a-f]{16}$/.test(version)) bases.push(`${key}:${version}`);
        });
        if (bases.length) params.set('base', bases.join(','));

        let response;
        try {
            response = await Na__FileParityWatch__WithTimeout(fetch(`${window.location.origin}${Na__FileParityWatch__STATE_ROUTE}?${params.toString()}`, { cache : 'no-store' }), Na__FileParityWatch__STATE_TIMEOUT);
        } catch (error) {
            return null;                                                           // <-- Busy or restarting: the next check asks again
        }
        if (!response.ok) {
            const answer = await response.json().catch(() => null);
            if (answer && answer.ok === false) return null;                        // <-- The route is there; this project is not on disk
            Na__FileParityWatch__Enabled = false;
            Na__FileParityWatch__SetPill();
            if (!Na__FileParityWatch__ServerSaid) {
                Na__FileParityWatch__ServerSaid = true;
                console.warn('[TrueVision3D] Local file parity: the local server has no file-watch route (it was started before it existed). Restart the ProjectVision local server to watch this project\'s files on disk.');
                Na__FileParityWatch__Toast('Local file watch is off: restart the ProjectVision local server to turn it on.', true);
            }
            return null;
        }
        const data = await response.json().catch(() => null);
        return (data && data.ok === true && Array.isArray(data.files)) ? data : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checking
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Show, Update or Hide the Pill From What Is Pending
    // ------------------------------------------------------------
    function Na__FileParityWatch__SetPill() {
        const count = Na__FileParityWatch__Enabled ? Na__FileParityWatch__Pending.size : 0;
        Na__FileParityUi__SetPill(count, () => { void Na__FileParityWatch__Notice('pill'); });
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Now: Promise<changes[] | null>
    // ------------------------------------------------------------
    // Every caller waiting at once shares one request. The answer replaces the
    // pending list; this window's own writes it had not heard about are taken
    // as baselines on the way.
    // ------------------------------------------------------------
    function Na__FileParityWatch__Check() {
        if (!Na__FileParityWatch__Enabled) return Promise.resolve(null);
        if (Na__FileParityWatch__Checking) return Na__FileParityWatch__Checking;
        Na__FileParityWatch__Checking = (async () => {
            const state = await Na__FileParityWatch__FetchState(null);
            Na__FileParityWatch__LastCheck = Date.now();
            if (!state) return null;
            const changes = Na__FileParity__FindChanges(state.files, Na__FileParity__Baselines__All(), Na__FileParity__ClientId);
            changes.filter((change) => change.adopt).forEach((change) => Na__FileParity__NoteOwnWrite(change.key, change.version, change.mtimeMs));
            const real = changes.filter((change) => !change.adopt);
            Na__FileParityWatch__Pending.clear();
            real.forEach((change) => Na__FileParityWatch__Pending.set(change.key, change));
            Na__FileParityWatch__SetPill();
            return real;
        })().finally(() => { Na__FileParityWatch__Checking = null; });
        return Na__FileParityWatch__Checking;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Background Check, and the Notice When Something New Has Moved
    // ------------------------------------------------------------
    // reason: 'poll' | 'focus' | 'first' | 'settle' | 'refused' | 'pill'.
    // A version already announced is not announced again; the pill asks for it
    // on purpose, and a refused write always shows it.
    // ------------------------------------------------------------
    async function Na__FileParityWatch__Notice(reason) {
        if (Na__FileParityWatch__Reloading) return;
        const changes = await Na__FileParityWatch__Check();
        if (!changes) return;
        if (!changes.length) { Na__FileParityUi__CloseNotice(); return; }

        const forced = reason === 'pill' || reason === 'refused';
        if (!forced && changes.some((change) => !change.valid)) {                 // <-- Half written: look again in a moment, say nothing yet
            Na__FileParityWatch__Soon('settle', Na__FileParityWatch__MIDWRITE_MS);
            return;
        }
        const fresh = changes.filter((change) => Na__FileParityWatch__Notified.get(change.key) !== change.version);
        if (!forced && !fresh.length) return;
        if (Na__FileParityUi__OpenMode()) return;                                 // <-- Another question is on screen; the pill waits

        changes.forEach((change) => Na__FileParityWatch__Notified.set(change.key, change.version));
        console.log('[TrueVision3D] Local file parity: files changed on disk - ' + changes.map((change) => change.name).join(', ') + '.');
        const answer = await Na__FileParityUi__Show({
            mode      : 'notice',
            changes   : changes,
            dirtyKeys : Na__FileParityWatch__DirtyKeys(changes),
            notes     : Na__FileParityWatch__ReloadNotes(changes, 'notice')
        });
        if (answer === 'reload') await Na__FileParityWatch__Reload(changes);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check a Moment From Now (one timer: a burst of reads is one check)
    // ------------------------------------------------------------
    function Na__FileParityWatch__Soon(reason, ms) {
        if (!Na__FileParityWatch__Enabled) return;
        if (Na__FileParityWatch__SoonTimer) window.clearTimeout(Na__FileParityWatch__SoonTimer);
        Na__FileParityWatch__SoonTimer = window.setTimeout(() => {
            Na__FileParityWatch__SoonTimer = null;
            void Na__FileParityWatch__Notice(reason);
        }, ms);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The 30-Second Poll (skipped while the window is hidden)
    // ------------------------------------------------------------
    function Na__FileParityWatch__SchedulePoll(ms) {
        if (Na__FileParityWatch__PollTimer) window.clearTimeout(Na__FileParityWatch__PollTimer);
        Na__FileParityWatch__PollTimer = window.setTimeout(() => {
            Na__FileParityWatch__PollTimer = null;
            if (!Na__FileParityWatch__Enabled) return;
            if (document.visibilityState !== 'hidden') void Na__FileParityWatch__Notice('poll');
            Na__FileParityWatch__SchedulePoll(Na__FileParityWatch__POLL_MS);
        }, ms);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Coming Back to the Window
    // ------------------------------------------------------------
    function Na__FileParityWatch__OnReturn() {
        if (document.visibilityState === 'hidden') return;
        if (Date.now() - Na__FileParityWatch__LastCheck < 2000) return;           // <-- Focus and visibility often arrive together
        Na__FileParityWatch__Soon('focus', Na__FileParityWatch__FOCUS_CHECK_MS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Baseline Moved, or a Write Was Refused
    // ------------------------------------------------------------
    // A read, a write or a decision about a file settles whatever was pending
    // for it; a check a moment later confirms. A refusal is shown at once.
    // ------------------------------------------------------------
    function Na__FileParityWatch__OnRegistry(event) {
        const detail = (event && event.detail) || {};
        if (detail.reason === 'refused') { Na__FileParityWatch__Soon('refused', 0); return; }
        if (detail.key && Na__FileParityWatch__Pending.delete(Na__FileParity__NormaliseKey(detail.key))) {
            Na__FileParityWatch__SetPill();
            if (!Na__FileParityWatch__Pending.size) Na__FileParityUi__CloseNotice();
        }
        Na__FileParityWatch__Soon('settle', Na__FileParityWatch__SETTLE_CHECK_MS);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reloading
// -----------------------------------------------------------------------------

    // FUNCTION | Load the New Versions of These Files
    // ------------------------------------------------------------
    // The specification alone: in place, through its own Reload from Local
    // (confirmed here already, so it does not ask a second time). Anything
    // else: the app reloads. The draft of every file that changed is thrown
    // away first - the modal said so - and every other draft is written first,
    // so that unsaved work comes back after the reload. The close guard is
    // released so the browser does not ask "leave site?" on top of the modal.
    // ------------------------------------------------------------
    async function Na__FileParityWatch__Reload(changes) {
        if (Na__FileParityWatch__Reloading) return false;
        const all  = Array.from(new Map((changes || []).concat(Array.from(Na__FileParityWatch__Pending.values())).map((change) => [change.key, change])).values());
        const keys = new Set(all.map((change) => change.key));
        if (!keys.size) return false;

        if (!Na__FileParityWatch__NeedsAppReload(all)) {
            const reloaded = await Na__LeSpec__ReloadFromLocal({ confirmed : true });
            if (reloaded) {
                Na__FileParityWatch__Pending.delete('drawing-notes');
                Na__FileParityWatch__SetPill();
            }
            return reloaded;
        }

        Na__FileParityWatch__Reloading = true;
        console.log('[TrueVision3D] Local file parity: reloading the app for files changed on disk - ' + all.map((change) => change.name).join(', ') + '.');
        try { Na__LeAuto__ReleaseCloseGuard(); } catch (error) { /* the Layout Editor may never have started */ }
        try { if (keys.has('project-data')) Na__LeAuto__DiscardSavedDraft(); } catch (error) { /* no sheet draft to drop */ }
        try {
            if (keys.has('drawing-notes')) Na__LeSpec__ClearDraft();
            else Na__LeSpec__FlushDraft();
        } catch (error) { /* the specification may never have loaded */ }
        window.location.reload();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Save Gate and the Draft Question (installed in the registry)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ask Before a Save: 'proceed' | 'cancel' | 'reload'
    // ------------------------------------------------------------
    async function Na__FileParityWatch__SaveAnswer(key, options) {
        if (!Na__FileParityWatch__Enabled || Na__FileParityWatch__Reloading) return Na__FileParityWatch__Reloading ? 'cancel' : 'proceed';
        const changes = await Na__FileParityWatch__Check();
        if (changes === null) return 'proceed';                                   // <-- The server could not be asked: its own guard still stands
        const change = changes.find((entry) => entry.key === key);
        if (!change) return 'proceed';

        const writesKeys = Array.isArray(options && options.writesKeys) ? options.writesKeys : null;
        if (!Na__FileParity__IsConflict(change, writesKeys)) {
            Na__FileParity__Acknowledge(key, change.version, change.mtimeMs);    // <-- Other parts of the file moved; the merge keeps them as the file has them
            console.log('[TrueVision3D] Local file parity: ' + change.name + ' changed on disk in parts this save does not write (' + (change.changedKeys || []).join(', ') + '); saving.');
            return 'proceed';
        }

        const answer = await Na__FileParityUi__Show({
            mode       : 'save',
            changes    : [change],
            writesKeys : writesKeys,
            dirtyKeys  : Na__FileParityWatch__DirtyKeys([change]),
            notes      : Na__FileParityWatch__ReloadNotes([change], 'save')
        });
        Na__FileParityWatch__Notified.set(key, change.version);
        if (answer === 'overwrite') {
            Na__FileParity__Acknowledge(key, change.version, change.mtimeMs);
            console.warn('[TrueVision3D] Local file parity: overwriting ' + change.name + ' - the changes made on disk (' + Na__FileParity__When(change.mtimeMs) + ') were chosen to be replaced.');
            return 'proceed';
        }
        if (answer === 'reload') {
            window.setTimeout(() => { void Na__FileParityWatch__Reload([change]); }, 0);   // <-- After the caller has stepped back (Sync must not be mid-flight)
            return 'reload';
        }
        return 'cancel';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Registry's ConfirmSave: Promise<boolean>
    // ------------------------------------------------------------
    async function Na__FileParityWatch__ConfirmSave(key, options) {
        return (await Na__FileParityWatch__SaveAnswer(key, options)) === 'proceed';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Drawings Save Gate (registered with Na__DrawView__ProjectData__)
    // ------------------------------------------------------------
    // context: { keys, report, registerKeys, projectCode }. Answers true, or
    // { proceed : false, message } for the save's own toast.
    // ------------------------------------------------------------
    async function Na__FileParityWatch__DrawingsGate(context) {
        const answer = await Na__FileParityWatch__SaveAnswer('project-data', { writesKeys : (context && context.keys) || null });
        if (answer === 'proceed') return true;
        return {
            proceed : false,
            message : answer === 'reload'
                ? 'Sheets not saved: loading the project file changed on disk first.'
                : 'Save cancelled: the project file was changed on disk since this window loaded it, and nothing was written. Reload the changes, or save again and choose Overwrite With My Version.'
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Registry's AskDraft: Promise<'restore' | 'discard'>
    // ------------------------------------------------------------
    // info: { draftSavedAt, draftVersion }. The row describes the file as it is
    // on disk now, and - when the server still remembers the version the draft
    // was made against - what has moved since.
    // ------------------------------------------------------------
    async function Na__FileParityWatch__AskDraft(key, info) {
        const base   = Na__FileParity__Baseline(key);
        if (!Na__FileParityWatch__Enabled || !base) return 'restore';
        const extra  = {};
        if (info && info.draftVersion) extra[key] = info.draftVersion;
        const state  = await Na__FileParityWatch__FetchState(extra);
        const file   = state ? state.files.find((entry) => Na__FileParity__NormaliseKey(entry.key) === key) : null;
        const last   = file ? file.lastAppWrite : null;
        const change = {
            key           : key,
            adopt         : false,
            kind          : 'data',
            name          : (file && file.name) || key,
            exists        : true,
            valid         : !file || file.valid !== false,
            mtimeMs       : (file && Number.isFinite(file.mtimeMs)) ? file.mtimeMs : base.mtimeMs,
            summary       : file ? file.summary : null,
            baseSummary   : file ? (file.baseSummary || null) : null,
            size          : file ? file.size : null,
            baseSize      : file ? (file.baseSize || null) : null,
            changedKeys   : (file && file.baseKeys && file.keys) ? Object.keys(Object.assign({}, file.baseKeys, file.keys)).filter((name) => file.baseKeys[name] !== file.keys[name]).sort() : null,
            byOtherWindow : !!(last && file && last.version === file.version && last.clientId && last.clientId !== Na__FileParity__ClientId)
        };
        const kept = info && Number.isFinite(Number(info.draftSavedAt)) ? Na__FileParity__When(Number(info.draftSavedAt)) : 'earlier';
        const answer = await Na__FileParityUi__Show({
            mode    : 'draft',
            changes : [change],
            notes   : [
                `Your unsaved changes were last kept in this browser at ${kept}.`,
                'Use the File on Disk throws those unsaved changes away and keeps the newer file. Restore My Unsaved Changes brings them back, and the next save writes them over the newer file.'
            ]
        });
        if (answer === 'restore') Na__FileParity__Acknowledge(key, base.version, base.mtimeMs);
        console.log('[TrueVision3D] Local file parity: browser draft of ' + change.name + ' - ' + (answer === 'restore' ? 'restored over the newer file on disk.' : 'discarded; the file on disk is kept.'));
        return answer === 'restore' ? 'restore' : 'discard';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Watching (once, before the loading sequence)
    // ------------------------------------------------------------
    function Na__FileParity__Initialize() {
        if (Na__FileParityWatch__Ready) return false;
        Na__FileParityWatch__Ready = true;
        if (!Na__FileParity__IsAvailable()) return false;                         // <-- The web build has no local files; a URL with no project folder has none to watch
        Na__FileParityWatch__Enabled = true;

        Na__FileParityWatch__ObserveFetch();
        Na__FileParity__InstallImpl({ confirmSave : Na__FileParityWatch__ConfirmSave, askDraft : Na__FileParityWatch__AskDraft });
        Na__DrawData__RegisterSaveGate(Na__FileParityWatch__DrawingsGate);

        window.addEventListener(Na__FileParity__EVENT, Na__FileParityWatch__OnRegistry);
        document.addEventListener('visibilitychange', Na__FileParityWatch__OnReturn);
        window.addEventListener('focus', Na__FileParityWatch__OnReturn);
        Na__FileParityWatch__SchedulePoll(Na__FileParityWatch__FIRST_CHECK_MS);
        console.log('[TrueVision3D] Local file parity: watching this project\'s files on disk (every 30 s, and on return to the window).');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Now and Show Anything Pending (the Dev menu and the console)
    // ------------------------------------------------------------
    function Na__FileParity__CheckNow() {
        return Na__FileParityWatch__Notice('pill');
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Watcher Knows, for the Console
    // ------------------------------------------------------------
    function Na__FileParity__Status() {
        return {
            enabled   : Na__FileParityWatch__Enabled,
            clientId  : Na__FileParity__ClientId,
            lastCheck : Na__FileParityWatch__LastCheck ? new Date(Na__FileParityWatch__LastCheck).toISOString() : null,
            baselines : Na__FileParity__Baselines__All(),
            pending   : Array.from(Na__FileParityWatch__Pending.values())
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local File Parity Watcher API
    // ------------------------------------------------------------
    export {
        Na__FileParity__Initialize,
        Na__FileParity__CheckNow,
        Na__FileParity__Status
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
