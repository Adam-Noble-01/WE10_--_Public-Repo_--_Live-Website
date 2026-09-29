// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - LOCKSTEP WITH THE FILE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__Lockstep__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - Lockstep With the Local File
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep the app's copy of the specification and its local TrueVision__DrawingNotes__.json in step: read and write the file in turn, watch it, save to it as the editing pauses, and ask when the two disagree
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 29-Sep-2026: "I keep accidentally saving over things other
//   agents are doing." Agents (the drawing note writer, tv_notes.py) and hand
//   edits change the local file directly. Until now the app never looked: an
//   open tab carried on with the copy it had loaded, and Save Sheets, Sync or
//   Enter in the drawing's Specification tab wrote that copy straight over
//   the file. On load, a browser draft was put back over a newer file with
//   nothing but a toast.
// - THE SAME SYSTEM AS THE STATEMENT WRITER (v2.157.0), and the same rules.
//   The verdict is Na__LayoutEditor__Statement__Lockstep__'s - imported, not
//   copied, so the two documents can never drift apart:
//     in-step     the file holds what the app last read or wrote, and nothing
//                 is unsaved. Nothing to do.
//     app-ahead   the file is untouched and the app has changes. The autosave
//                 writes them, exactly as before.
//     file-ahead  the file changed outside the app; nothing here is unsaved.
//     diverged    both changed.
//   The last two are put to the person: keep the app's copy, or load the
//   file (Na__LayoutEditor__SpecLockstep__ asks).
// - WHEN THE FILE IS LOOKED AT: on load (a browser draft that differs from
//   the file is the question, asked before anything is edited); every
//   LockstepPollMs while the drawing editor is open and this browser tab is
//   visible; when the window gets the focus back; and IMMEDIATELY BEFORE
//   EVERY WRITE - the autosave, Enter in the drawing's Specification tab,
//   Save Sheets and Sync. A write that finds the file moved writes nothing
//   and asks.
// - THE FILE IS NOW THE WORKING COPY, as a statement's markdown is. What is
//   in the app is written to it AutoSaveLocalMs after the editing pauses, so
//   an agent always starts from what Adam can see, and R2 stays the record
//   that Save Sheets and Sync write. None of this touches the cloud
//   bookkeeping (the base stamp, the synced content): a change saved to the
//   file is still unsynced, and Save Sheets still sends it to R2.
// - CONTENT DECIDES, THE CLOCK ONLY EXPLAINS. Two copies agree when their
//   content does (Na__LeSpec__LockJson: the groups and notes, the revision
//   and the document number - never a stamp). The server's Last-Modified
//   (the file's own UpdatedIso when the server sends none) and the time of
//   the last edit are shown beside each answer; "Newer" is badged only when
//   they are more than a second apart.
// - A FILE WITHOUT IDS STILL COMPARES. A note written by hand may carry no
//   Note__Id, and normalising gives it one from the counter - a counter this
//   session keeps raising. The key a file is compared by is worked out with
//   the id floor held at nought (FileKey), so the same file always gives the
//   same key and the watch never mistakes its own numbering for an edit. A
//   file that lacks an id is marked as such in its key, so the app reads as
//   ahead of it and the next autosave writes the ids in: a bubble linked to
//   that note keeps its link in the next session.
// - NOTE STAMPS DO NOT COUNT. Copies are compared by Na__LeSpec__LockJson,
//   which leaves out each note's Note__UpdatedIso: an agent that writes the
//   very words on screen agrees with the app.
// - NOTHING IS LOST BY ANSWERING. The copy not chosen is kept in this browser
//   under Na__LayoutEditor__SpecDiscarded__<code> - the latest only, a safety
//   net rather than a history.
// - ONE QUEUE FOR THE FILE (InTurn). Every read and write of it - the seed on
//   load, Sync's copy, the autosave, WriteLocalCopy and every look - waits its
//   turn, so a look never lands in the middle of a write and two writes never
//   land out of order. A write that looks first looks INSIDE its own turn, so
//   nothing of this app's can slip in between the look and the write.
//
// INTEGRATION:
// - Imports the State, Document and Draft units, the config, the project
//   code, the localhost check, the local project mirror, the Cloudflare API
//   client (only for the file's location) and the Statement Writer's pure
//   lockstep rules. Imported by the Editing unit (AfterEdit), the Transport
//   unit (the queue, the file's reads and writes, the look before Sync,
//   settling on load) and Na__LayoutEditor__SpecData__.js, which exports the
//   API. Nothing here imports the Editing or Transport units.
// - The drawing editor starts the watch when it opens and stops it when it
//   closes (StartWatch / StopWatch, from Na__LayoutEditor__ModeController__).
//   'conflict' on CHANGED_EVENT raises the question; ResolveConflict answers
//   it; GetConflict is what the question shows.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the Statement Writer's lockstep (TrueVision3D v2.157.0),
//                   shaped to a JSON document with a cloud copy beside it
// - ValeVision    : not yet ported. It would need the Statement Writer's pure
//                   rules file (52__Feature__StatementWriter/01__Core__Data/
//                   Na__LayoutEditor__Statement__Lockstep__.js) with it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation. The file's queue, the stamped copy a file holds
//   and WriteLocalCopy moved here from the Transport unit (1.2.0), which now
//   imports them; the Transport unit's own reads of the file go through
//   ReadLocalFile, which carries the file's date.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code, Environment, the Local Mirror and the File's Location
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__IsRunningOnLocalhost } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // @delegate: ../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js
    import { Na__LocalMirror__WriteSiblingFile } from '../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import { Na__CfApi__ProjectFileLocation } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Statement Writer's Lockstep Rules (pure: the one verdict both documents use)
    // ------------------------------------------------------------
    import {
        Na__LeStmtLock__IN_STEP,
        Na__LeStmtLock__APP_AHEAD,
        Na__LeStmtLock__Compare,
        Na__LeStmtLock__NeedsChoice,
        Na__LeStmtLock__Newer,
        Na__LeStmtLock__FromHttpDate
    } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Lockstep__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Specification's State, Document and Draft Units
    // ------------------------------------------------------------
    import {
        Na__LeSpec__DISCARDED_PREFIX,
        Na__LeSpec__VERSION,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__K_DESCRIPTION,
        Na__LeSpec__K_VERSION,
        Na__LeSpec__K_PROJECT,
        Na__LeSpec__K_UPDATED,
        Na__LeSpec__K_LAST_ID,
        Na__LeSpec__K_GROUPS,
        Na__LeSpec__K_REVISION,
        Na__LeSpec__K_DOCNUMBER,
        Na__LeSpec__DESCRIPTION,
        Na__LeSpec__Doc,
        Na__LeSpec__Status,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__IdFloor,
        Na__LeSpec__Syncing,
        Na__LeSpec__FileJson,
        Na__LeSpec__FileIso,
        Na__LeSpec__LiveIso,
        Na__LeSpec__Conflict,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetStatus,
        Na__LeSpec__SetSource,
        Na__LeSpec__SetBaseStamp,
        Na__LeSpec__SetHistory,
        Na__LeSpec__SetIdFloor,
        Na__LeSpec__SetCodeSig,
        Na__LeSpec__SetFileJson,
        Na__LeSpec__SetFileIso,
        Na__LeSpec__SetLiveIso,
        Na__LeSpec__SetConflict,
        Na__LeSpec__SetLocalSaving,
        Na__LeSpec__Dispatch,
        Na__LeSpec__Toast
    } from './Na__LayoutEditor__SpecData__State__.js';
    import {
        Na__LeSpec__Normalise,
        Na__LeSpec__LockJson,
        Na__LeSpec__CodeSignature,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty,
        Na__LeSpec__LockstepOn
    } from './Na__LayoutEditor__SpecData__Document__.js';
    import { Na__LeSpec__ReadDraft, Na__LeSpec__WriteDraft, Na__LeSpec__ClearDraft, Na__LeSpec__RestoreDraft } from './Na__LayoutEditor__SpecData__Draft__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Queue, the Autosave, the Watch and the Listeners
    // ------------------------------------------------------------
    // The lockstep's SHARED state - what the file held, when, and the open
    // question - is the State unit's, because the Transport unit and the
    // Document unit's GetState read it too. These are this unit's alone.
    // ------------------------------------------------------------
    let Na__LeSpec__LocalQueue  = Promise.resolve();
    let Na__LeSpec__SaveTimer   = 0;
    let Na__LeSpec__WatchTimer  = 0;
    let Na__LeSpec__Checking    = false;
    let Na__LeSpec__Listening   = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Time, As Every Other Document Writes It
    // ------------------------------------------------------------
    function Na__LeSpec__Now() {
        return new Date().toISOString();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This a Specification Document at All
    // ------------------------------------------------------------
    function Na__LeSpec__IsDoc(data) {
        return !!(data && typeof data === 'object' && !Array.isArray(data));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Document's Own Stamp ('' when it has none)
    // ------------------------------------------------------------
    function Na__LeSpec__StampOf(data) {
        return (Na__LeSpec__IsDoc(data) && typeof data[Na__LeSpec__K_UPDATED] === 'string') ? data[Na__LeSpec__K_UPDATED] : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve After a Time Limit, Whatever the Promise Does
    // ------------------------------------------------------------
    function Na__LeSpec__LocalTimeout(promise, ms) {
        return Promise.race([
            Promise.resolve(promise).catch((error) => ({ ok : false, data : null, missing : false, modifiedIso : '', error : (error && error.message) || 'error' })),
            new Promise((resolve) => { window.setTimeout(() => resolve({ ok : false, data : null, missing : false, modifiedIso : '', error : 'timed out' }), ms); })
        ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Document Made Whole Without Raising This Session's Id Floor
    // ------------------------------------------------------------
    // Normalise gives a note or group with no id the next one from the counter,
    // and the counter is the higher of the file's and this session's floor. For
    // a COMPARISON the floor is held at nought, so a file always normalises to
    // the same ids - its own highest plus one, and on - and the floor this
    // session has raised is put back exactly as it was.
    // ------------------------------------------------------------
    function Na__LeSpec__QuietNormalise(raw) {
        const floor = Na__LeSpec__IdFloor;
        Na__LeSpec__SetIdFloor(0);
        try { return Na__LeSpec__Normalise(raw); }
        finally { Na__LeSpec__SetIdFloor(floor); }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a File Lack an Id Somewhere (a group or note with none, or one used twice)
    // ------------------------------------------------------------
    function Na__LeSpec__LacksIds(raw) {
        const seen = new Set();
        const bad  = (id) => {
            if (typeof id !== 'string' || id.trim() === '' || seen.has(id.trim())) return true;
            seen.add(id.trim());
            return false;
        };
        const groups = (Na__LeSpec__IsDoc(raw) && Array.isArray(raw[Na__LeSpec__K_GROUPS])) ? raw[Na__LeSpec__K_GROUPS] : [];
        return groups.some((group) => !group || typeof group !== 'object' || bad(group.Group__Id)
            || (Array.isArray(group.Group__Notes) ? group.Group__Notes : []).some((note) => !!note && typeof note === 'object' && bad(note.Note__Id)));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Key a File's Content Is Compared By
    // ------------------------------------------------------------
    // LockJson of the file made whole with the floor held at nought, and a
    // mark when an id had to be made up: the app, which holds the made-up
    // ids, then reads as ahead of the file, and the autosave writes them in.
    // ------------------------------------------------------------
    function Na__LeSpec__FileKey(raw) {
        return Na__LeSpec__LockJson(Na__LeSpec__QuietNormalise(raw)) + (Na__LeSpec__LacksIds(raw) ? '#ids-missing' : '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Copy an Answer Did Not Choose Aside in This Browser
    // ------------------------------------------------------------
    // One per project, the latest only. Recovered from the console with
    // JSON.parse(localStorage.getItem('Na__LayoutEditor__SpecDiscarded__<code>')).Doc
    // - a safety net, not a history.
    // ------------------------------------------------------------
    function Na__LeSpec__KeepDiscarded(data, why) {
        const code = Na__LeSpec__ProjectCode || Na__DrawData__GetProjectCode();
        if (!code || !Na__LeSpec__IsDoc(data)) return false;
        try {
            window.localStorage.setItem(Na__LeSpec__DISCARDED_PREFIX + code, JSON.stringify({ Doc : data, Iso : Na__LeSpec__Now(), Why : why || '' }));
            return true;
        } catch (error) {
            console.warn('[TrueVision3D] Layout Editor: the specification copy not kept could not be put aside:', (error && error.message) || error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Local File: Where It Is, Reading It, and Writing It in Turn
// -----------------------------------------------------------------------------

    // FUNCTION | Wait Your Turn for the Local File
    // ------------------------------------------------------------
    // EVERY READ AND WRITE OF THE LOCAL FILE GOES THROUGH ONE QUEUE, so two
    // writes in flight can never land in the wrong order and leave the older
    // document on disk, and a look can never read a half-finished write. The
    // server answers each request in its own time; the queue does not.
    // ------------------------------------------------------------
    function Na__LeSpec__InTurn(task) {
        const job = Na__LeSpec__LocalQueue.then(task);
        Na__LeSpec__LocalQueue = job.catch(() => {});
        return job;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Local File: { ok, data, missing, modifiedIso, skipped, error }
    // ------------------------------------------------------------
    // The repository TrueVision__DrawingNotes__.json beside the project data,
    // fresh (no browser cache), with the server's Last-Modified as modifiedIso
    // ('' when it sends none). Off localhost it answers skipped: there is no
    // file there to read. A missing file is an answer, not a failure.
    // ------------------------------------------------------------
    async function Na__LeSpec__FetchLocal(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            if (response.status === 404 || response.status === 403) return { ok : true, data : null, missing : true, modifiedIso : '', skipped : false, error : null };
            if (!response.ok) return { ok : false, data : null, missing : false, modifiedIso : '', skipped : false, error : 'HTTP ' + response.status };
            const header = (response.headers && typeof response.headers.get === 'function') ? response.headers.get('Last-Modified') : null;
            const data   = await response.json();
            return { ok : true, data : Na__LeSpec__IsDoc(data) ? data : null, missing : false, modifiedIso : Na__LeStmtLock__FromHttpDate(header), skipped : false, error : null };
        } catch (error) {
            return { ok : false, data : null, missing : false, modifiedIso : '', skipped : false, error : (error && error.message) || 'unreachable' };
        }
    }

    function Na__LeSpec__ReadLocalFile() {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Promise.resolve({ ok : false, data : null, missing : false, modifiedIso : '', skipped : true, error : null });
        const setup    = Na__LeCfg__GetSpecificationSetup();
        const location = Na__CfApi__ProjectFileLocation(setup.fileName);
        if (!location) return Promise.resolve({ ok : false, data : null, missing : false, modifiedIso : '', skipped : false, error : 'no project folder in the URL' });
        return Na__LeSpec__LocalTimeout(Na__LeSpec__FetchLocal(location.repoUrl), setup.loadTimeoutMs);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Live Document as a File Holds It: a Fresh, Stamped Copy
    // ------------------------------------------------------------
    // What Sync writes to R2 and to the local file, and what the autosave and
    // WriteLocalCopy write to the local file alone: the same keys, the same
    // stamp rule. THE LIVE DOCUMENT IS NEVER STAMPED - see Sync - only this
    // copy is.
    // ------------------------------------------------------------
    function Na__LeSpec__FileCopy() {
        const out = Na__LeSpec__Normalise(Na__LeSpec__Doc);
        out[Na__LeSpec__K_DESCRIPTION] = Na__LeSpec__DESCRIPTION;
        out[Na__LeSpec__K_VERSION]     = Na__LeSpec__VERSION;
        out[Na__LeSpec__K_PROJECT]     = Na__LeSpec__ProjectCode || Na__DrawData__GetProjectCode() || null;
        out[Na__LeSpec__K_UPDATED]     = Na__LeSpec__Now();
        out[Na__LeSpec__K_LAST_ID]     = Math.max(out[Na__LeSpec__K_LAST_ID], Na__LeSpec__IdFloor);   // <-- Ids undone away stay spent in the file too
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Document to the Local File Now (call it inside a turn)
    // ------------------------------------------------------------
    // A successful write is what this app now knows the file holds, so the
    // lockstep's record of the file follows it - every write of the file, the
    // seed on load and Sync's copy included, comes through here.
    // ------------------------------------------------------------
    async function Na__LeSpec__MirrorLocalNow(doc) {
        if (!Na__AppUtils__IsRunningOnLocalhost() || !Na__LeSpec__IsDoc(doc)) return { ok : false, skipped : true, error : null };
        Na__LeSpec__SetLocalSaving(true);
        try {
            const local = await Na__LocalMirror__WriteSiblingFile(Na__LeCfg__GetSpecificationSetup().fileName, doc);
            if (local.ok) {
                Na__LeSpec__SetFileJson(Na__LeSpec__LockJson(doc));
                Na__LeSpec__SetFileIso(Na__LeSpec__StampOf(doc) || Na__LeSpec__Now());    // <-- The next look replaces this with the server's own date
            } else if (!local.skipped) {
                console.warn('[TrueVision3D] Layout Editor: the local drawing-notes file was not written:', local.error);
            }
            return local;
        } finally {
            Na__LeSpec__SetLocalSaving(false);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Document to the Local File, in Turn
    // ------------------------------------------------------------
    // options.look: look at the file first, INSIDE the turn, and write nothing
    // if it moved behind the app's back - the question is asked instead and
    // the answer is { ok : false, held : true }. Sync passes it; the seed on
    // load does not (it has just read the file).
    // ------------------------------------------------------------
    function Na__LeSpec__MirrorLocal(doc, options) {
        const opts = options || {};
        return Na__LeSpec__InTurn(async () => {
            if (opts.look && Na__LeSpec__LockstepOn()) {
                const seen = await Na__LeSpec__Look(Na__LeSpec__LockJson(doc));
                const said = Na__LeSpec__Judge(seen);
                if (said === 'asked') return { ok : false, skipped : false, held : true, error : null };
                if (said === 'taken') return { ok : true, skipped : false, error : null };
            }
            return Na__LeSpec__MirrorLocalNow(doc);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Look and the Verdict
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Look at the File Once (call it inside a turn)
    // ------------------------------------------------------------
    // liveKey is the content the app is about to write, or holds now. Resolves
    // to { verdict, disk, fileKey }, or null when there is nothing to compare
    // - no file, off localhost, or a read that failed this time. A file that
    // could not be read is simply not looked at: the write goes ahead as it
    // always did, and the next look tries again.
    // ------------------------------------------------------------
    async function Na__LeSpec__Look(liveKey) {
        const disk = await Na__LeSpec__ReadLocalFile();
        if (!disk.ok || disk.skipped || disk.missing || !Na__LeSpec__IsDoc(disk.data)) return null;
        const fileKey = Na__LeSpec__FileKey(disk.data);
        const verdict = Na__LeStmtLock__Compare({
            fileText  : fileKey,
            savedText : (typeof Na__LeSpec__FileJson === 'string') ? Na__LeSpec__FileJson : '',   // <-- Never read: any file there counts as moved
            liveText  : liveKey
        });
        return { verdict : verdict, disk : disk, fileKey : fileKey };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Act on a Look: 'write', 'taken' or 'asked'
    // ------------------------------------------------------------
    //   write   in step, or only the app moved: the caller carries on
    //   taken   the file moved and now holds exactly what the app holds: it is
    //           taken as saved, not asked about
    //   asked   the file moved and does not: the question is up
    // ------------------------------------------------------------
    function Na__LeSpec__Judge(seen) {
        if (!seen) return 'write';
        if (seen.verdict.converged) { Na__LeSpec__TakeFileAsSaved(seen); return 'taken'; }
        if (Na__LeStmtLock__NeedsChoice(seen.verdict.state)) { Na__LeSpec__AskAboutFile(seen); return 'asked'; }
        return 'write';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The File Already Holds What the App Holds: Take It as Saved
    // ------------------------------------------------------------
    function Na__LeSpec__TakeFileAsSaved(seen) {
        Na__LeSpec__SetFileJson(seen.fileKey);
        Na__LeSpec__SetFileIso(seen.disk.modifiedIso || Na__LeSpec__StampOf(seen.disk.data) || Na__LeSpec__FileIso);
        Na__LeSpec__Dispatch('status');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Frame the Question
    // ------------------------------------------------------------
    // kind: 'open' (a draft in this browser differs from the file, on load),
    // 'file' (the file moved and nothing in the app is unsaved) or 'both'. The
    // file's document travels with the question, so the answer never reads
    // the file again: what was shown is what is kept.
    // ------------------------------------------------------------
    function Na__LeSpec__MakeConflict(kind, parts) {
        const fileDoc = Na__LeSpec__QuietNormalise(parts.fileData);
        return {
            kind     : kind,
            fileData : JSON.parse(JSON.stringify(parts.fileData)),
            fileKey  : parts.fileKey,
            fileIso  : parts.fileIso || '',
            appDoc   : JSON.parse(JSON.stringify(parts.appDoc)),
            appIso   : parts.appIso || '',
            appFrom  : parts.appFrom || 'app',
            draft    : parts.draft || null,
            newer    : (kind === 'file') ? 'file' : Na__LeStmtLock__Newer(parts.appIso, parts.fileIso),
            summary  : Na__LeSpec__LockSummary(parts.appDoc, fileDoc),
            askedIso : Na__LeSpec__Now()
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The File Moved Behind the App's Back: Stop and Ask
    // ------------------------------------------------------------
    // The pending autosave is dropped (it would only be held), and the app's
    // copy goes to the browser draft first, so the question can be left
    // unanswered - the tab closed, the machine restarted - and still be asked
    // on the next load.
    // ------------------------------------------------------------
    function Na__LeSpec__AskAboutFile(seen) {
        window.clearTimeout(Na__LeSpec__SaveTimer);
        Na__LeSpec__SaveTimer = 0;
        const appMoved = Na__LeSpec__LockJson(Na__LeSpec__Doc) !== ((typeof Na__LeSpec__FileJson === 'string') ? Na__LeSpec__FileJson : '');
        Na__LeSpec__SetConflict(Na__LeSpec__MakeConflict(appMoved ? 'both' : 'file', {
            fileData : seen.disk.data,
            fileKey  : seen.fileKey,
            fileIso  : seen.disk.modifiedIso || Na__LeSpec__StampOf(seen.disk.data),
            appDoc   : Na__LeSpec__Doc,
            appIso   : Na__LeSpec__LiveIso || Na__LeSpec__FileIso,
            appFrom  : 'app'
        }));
        if (Na__LeSpec__IsDirty()) Na__LeSpec__WriteDraft();
        console.log('[TrueVision3D] Layout Editor: the specification file changed outside the app ('
            + (appMoved ? 'and the app has changes of its own' : 'nothing in the app is unsaved') + ') - asking which to keep.');
        Na__LeSpec__Dispatch('conflict');
    }
    // ------------------------------------------------------------


    // FUNCTION | What Differs Between the App's Copy and the File, Note by Note
    // ------------------------------------------------------------
    // Resolves to { appNotes, fileNotes, onlyInApp, onlyInFile, changed,
    // revision, number, groups }: the codes of the notes only one copy holds,
    // the notes both hold but word or place differently ({ app, file } codes),
    // whether the revision or the document number differs ({ app, file }, or
    // null), and whether any group's prefix, title or general switch does.
    // Matched by Note__Id, so a renumbered note reads as moved, not as one
    // note gone and another arrived. Enough to tell a note an agent added from
    // a whole group rewritten, which is what the person needs to choose.
    // ------------------------------------------------------------
    function Na__LeSpec__LockSummary(appDoc, fileDoc) {
        const notes = (doc) => {
            const map = new Map();
            (Na__LeSpec__IsDoc(doc) && Array.isArray(doc[Na__LeSpec__K_GROUPS]) ? doc[Na__LeSpec__K_GROUPS] : []).forEach((group) => {
                (Array.isArray(group.Group__Notes) ? group.Group__Notes : []).forEach((note) => {
                    map.set(note.Note__Id, { code : note.Note__Code || '', text : JSON.stringify([ note.Note__Title || '', note.Note__Body || '' ]) });
                });
            });
            return map;
        };
        const groups = (doc) => JSON.stringify((Na__LeSpec__IsDoc(doc) && Array.isArray(doc[Na__LeSpec__K_GROUPS]) ? doc[Na__LeSpec__K_GROUPS] : [])
            .map((group) => [ group.Group__Id, group.Group__Prefix, group.Group__Title, group.Group__IsGeneral === true ]));
        const field = (key) => {
            const app  = Na__LeSpec__IsDoc(appDoc) ? String(appDoc[key] == null ? '' : appDoc[key]) : '';
            const file = Na__LeSpec__IsDoc(fileDoc) ? String(fileDoc[key] == null ? '' : fileDoc[key]) : '';
            return app === file ? null : { app : app, file : file };
        };

        const app  = notes(appDoc);
        const file = notes(fileDoc);
        const onlyInApp = [], onlyInFile = [], changed = [];
        app.forEach((note, id) => {
            const other = file.get(id);
            if (!other) onlyInApp.push(note.code);
            else if (other.text !== note.text || other.code !== note.code) changed.push({ app : note.code, file : other.code });
        });
        file.forEach((note, id) => { if (!app.has(id)) onlyInFile.push(note.code); });

        return {
            appNotes   : app.size,
            fileNotes  : file.size,
            onlyInApp  : onlyInApp,
            onlyInFile : onlyInFile,
            changed    : changed,
            revision   : field(Na__LeSpec__K_REVISION),
            number     : field(Na__LeSpec__K_DOCNUMBER),
            groups     : groups(appDoc) !== groups(fileDoc)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Taking a File's Copy as the App's Own
// -----------------------------------------------------------------------------

    // FUNCTION | Take the Local File's Document as the Live One
    // ------------------------------------------------------------
    // For Reload Local and for the answer "load the file". THE CLOUD
    // BOOKKEEPING IS LEFT AS IT WAS: the file is not the cloud copy, so the
    // base stamp and the synced content stay the cloud's, and a file that
    // differs from R2 reads as unsynced - Save Sheets lights up and sends it.
    // (Reload Local used to mark the file as the cloud copy, so after an
    // agent's edit Sync stayed off and the edit never reached R2.) What the
    // file holds becomes what the lockstep compares against, by the file's
    // own key: a file whose notes had no ids is given them by the next
    // autosave.
    // ------------------------------------------------------------
    function Na__LeSpec__AdoptFile(raw, fileIso) {
        const doc = Na__LeSpec__Normalise(raw);
        Na__LeSpec__SetIdFloor(Math.max(Na__LeSpec__IdFloor, doc[Na__LeSpec__K_LAST_ID]));
        Na__LeSpec__SetDoc(doc);
        Na__LeSpec__SetIndex(null);
        if (Na__LeSpec__Status === Na__LeSpec__STATUS_NEW) Na__LeSpec__SetStatus(Na__LeSpec__STATUS_READY);   // <-- There is a specification now, if not yet in the cloud
        Na__LeSpec__SetSource('repository');
        Na__LeSpec__SetHistory({ undo : [], redo : [], current : JSON.stringify(doc) });
        Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
        Na__LeSpec__SetFileJson(Na__LeSpec__FileKey(raw));
        Na__LeSpec__SetFileIso(fileIso || Na__LeSpec__StampOf(raw));
        Na__LeSpec__SetLiveIso('');
        if (Na__LeSpec__IsDirty()) Na__LeSpec__WriteDraft(); else Na__LeSpec__ClearDraft();
        if (Na__LeSpec__LockJson(doc) !== Na__LeSpec__FileJson) Na__LeSpec__ScheduleLocalSave();   // <-- Ids given to a note that had none reach the file
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | On Load: Remember What the Local File Holds
    // ------------------------------------------------------------
    // result is what the Transport unit's Fetch found (its .local is the read
    // of the local file); seeded is the seed write's answer when the load
    // wrote the file, else null. Resolves to the raw document the file holds
    // now, or null when that is not known. Only a file that was actually read
    // or written changes what the lockstep compares against.
    //
    // A SEED OVER A DIFFERENT FILE keeps that file. The load writes the cloud
    // copy over a local file only when the cloud's stamp is later; the local
    // content is still put aside in this browser first, because the stamp was
    // all that decided it.
    // ------------------------------------------------------------
    function Na__LeSpec__SettleFile(result, seeded) {
        const local = result ? result.local : null;
        const read  = !!(local && local.ok && Na__LeSpec__IsDoc(local.data));
        if (seeded && seeded.ok) {
            if (read && Na__LeSpec__FileKey(local.data) !== Na__LeSpec__FileJson) {
                Na__LeSpec__KeepDiscarded(local.data, 'the cloud copy, stamped later, was written over the local file on load');
                console.log('[TrueVision3D] Layout Editor: the cloud specification was newer than the local file and replaced it; the local copy is kept in this browser.');
            }
            return JSON.parse(JSON.stringify(Na__LeSpec__Doc));
        }
        if (read) {
            Na__LeSpec__SetFileJson(Na__LeSpec__FileKey(local.data));
            Na__LeSpec__SetFileIso(local.modifiedIso || Na__LeSpec__StampOf(local.data));
            return local.data;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | On Load: Put a Browser Draft Back, or Ask About It
    // ------------------------------------------------------------
    // fileData is what SettleFile says the file holds. Where the lockstep is
    // on and the file is known, a draft that differs from it is the question,
    // asked before anything is edited: the draft is this browser's work, the
    // file may be an agent's, and only the person knows which is wanted. It
    // used to be put back unasked, with a toast. Elsewhere - off localhost, no
    // file - it is put back as it always was (RestoreDraft). Resolves true
    // when the question is up.
    // ------------------------------------------------------------
    function Na__LeSpec__RestoreDraftOrAsk(fileData) {
        const setup = Na__LeCfg__GetSpecificationSetup();
        if (!setup.draftEnabled || !Na__LeSpec__Doc) return false;
        const draft = Na__LeSpec__ReadDraft();
        if (!draft) return false;
        const lockstep = Na__LeSpec__LockstepOn() && typeof Na__LeSpec__FileJson === 'string' && Na__LeSpec__IsDoc(fileData);
        if (!lockstep) { Na__LeSpec__RestoreDraft(); return false; }

        const draftKey = Na__LeSpec__FileKey(draft.doc);
        if (draftKey === Na__LeSpec__LockJson(Na__LeSpec__Doc) || draftKey === Na__LeSpec__FileJson) {
            Na__LeSpec__RestoreDraft();                                         // <-- Nothing to ask: the same content, or the draft's own base
            return false;
        }
        Na__LeSpec__SetConflict(Na__LeSpec__MakeConflict('open', {
            fileData : fileData,
            fileKey  : Na__LeSpec__FileJson,
            fileIso  : Na__LeSpec__FileIso,
            appDoc   : Na__LeSpec__QuietNormalise(draft.doc),
            appIso   : Number.isFinite(draft.savedAt) ? new Date(draft.savedAt).toISOString() : '',
            appFrom  : 'draft',
            draft    : draft
        }));
        console.log('[TrueVision3D] Layout Editor: this browser holds a specification draft that differs from the local file - asking which to keep.');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saving to the File
// -----------------------------------------------------------------------------

    // FUNCTION | Write the App's Copy to the Local File: { ok, skipped, verified, error } (+ held, unchanged)
    // ------------------------------------------------------------
    // The autosave, and WriteLocalCopy, go through here. The document is the
    // live one AS IT STANDS NOW, copied before anything is awaited, so a
    // later change is a later write.
    //
    // LOOK BEFORE WRITING. Where the lockstep is on, the file is read first,
    // inside the write's own turn. If it no longer holds what this app last
    // read or wrote, nothing is written and the question is asked
    // ({ held : true }); if it already holds this very copy, nothing needs
    // writing. options.force skips the look - only the answer "keep the app's
    // copy" passes it.
    //
    // options: { force, quiet, verify }. verify reads the file back and
    // compares it, content for content, before saying verified; with the
    // lockstep on every write does, and the read-back is what the lockstep
    // then compares against. R2 and the cloud bookkeeping are untouched.
    // ------------------------------------------------------------
    function Na__LeSpec__SaveLocal(options) {
        const opts = options || {};
        window.clearTimeout(Na__LeSpec__SaveTimer);
        Na__LeSpec__SaveTimer = 0;
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Promise.resolve({ ok : false, skipped : true, verified : false, error : null });
        if (!Na__LeSpec__IsLoaded() || !Na__LeSpec__Doc) return Promise.resolve({ ok : false, skipped : false, verified : false, error : Na__LeCfg__GetLabel('SpecSyncNotLoaded', 'The specification has not finished loading.') });
        const held = () => ({ ok : false, skipped : false, verified : false, error : Na__LeCfg__GetLabel('SpecLockHeldError', 'the specification file on disk changed outside the app'), held : true });
        if (Na__LeSpec__Conflict && !opts.force) {
            if (!opts.quiet) Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecLockSaveHeld', 'The specification and its file on disk are out of step. Choose which to keep before saving.'), true);
            return Promise.resolve(held());
        }

        const lockstep = Na__LeSpec__LockstepOn();
        const location = Na__CfApi__ProjectFileLocation(Na__LeCfg__GetSpecificationSetup().fileName);
        const out      = Na__LeSpec__FileCopy();                              // <-- Now, before anything is awaited
        const outKey   = Na__LeSpec__LockJson(out);
        const verify   = opts.verify === true || lockstep;

        return Na__LeSpec__InTurn(async () => {
            if (lockstep && !opts.force) {
                if (Na__LeSpec__Conflict) return held();                      // <-- Asked while this write waited its turn
                const seen = await Na__LeSpec__Look(outKey);
                const said = Na__LeSpec__Judge(seen);
                if (said === 'asked') return held();
                if (said === 'taken' || (seen && seen.verdict.state === Na__LeStmtLock__IN_STEP)) {
                    return { ok : true, skipped : false, verified : true, error : null, unchanged : true };
                }
            }

            const written = await Na__LeSpec__MirrorLocalNow(out);
            if (!written.ok) return { ok : false, skipped : written.skipped === true, verified : false, error : written.error || null };
            if (!verify || !location) return { ok : true, skipped : false, verified : false, error : null };

            const back = await Na__LeSpec__ReadLocalFile();                   // <-- Inside the turn: no later write can land between the two
            if (!back.ok || !Na__LeSpec__IsDoc(back.data)) {
                return { ok : false, skipped : false, verified : false, error : 'the file could not be read back (' + ((back && back.error) || 'not found') + ')' };
            }
            const backKey = Na__LeSpec__FileKey(back.data);
            if (lockstep) {                                                   // <-- What the file really holds is what the next look compares against
                Na__LeSpec__SetFileJson(backKey);
                if (back.modifiedIso) Na__LeSpec__SetFileIso(back.modifiedIso);
            }
            if (backKey !== outKey) return { ok : false, skipped : false, verified : false, error : 'the file on disk does not hold what was written' };
            if (lockstep) Na__LeSpec__Dispatch('status');
            return { ok : true, skipped : false, verified : true, error : null };
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Write This Computer's Copy of the Specification Now: { ok, skipped, verified, error }
    // ------------------------------------------------------------
    // WHY. A note reworded where it is read - the drawing editor's own
    // Specification tab - is a finished change, made with Enter, and belongs
    // in the specification FILE straight away, without waiting for the
    // autosave: the copy an agent reads on disk. R2 is not touched and the
    // specification still reads as unsynced, so Save Sheets still takes the
    // change to R2. It looks at the file first, as every write does (held
    // when the file moved), and reads it back before saying verified.
    // Localhost only: elsewhere there is no local file and the answer is
    // skipped.
    // ------------------------------------------------------------
    function Na__LeSpec__WriteLocalCopy() {
        return Na__LeSpec__SaveLocal({ verify : true, quiet : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Save to the File Once the Editing Pauses
    // ------------------------------------------------------------
    // AutoSaveLocalMs after the last change; nothing when the lockstep is off
    // (a write that does not look first is exactly what this unit exists to
    // stop) or the setup gives no time.
    // ------------------------------------------------------------
    function Na__LeSpec__ScheduleLocalSave() {
        const every = Number(Na__LeCfg__GetSpecificationSetup().autoSaveLocalMs);
        if (!Na__LeSpec__LockstepOn() || !(every > 0)) return false;
        window.clearTimeout(Na__LeSpec__SaveTimer);
        Na__LeSpec__SaveTimer = window.setTimeout(() => {
            Na__LeSpec__SaveTimer = 0;
            void Na__LeSpec__SaveLocal({ quiet : true });
        }, every);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The App's Copy Just Changed (called by the Editing unit)
    // ------------------------------------------------------------
    // Every edit, live typing and undo included: when it changed is what the
    // question shows beside the app's copy, and the autosave is put back.
    // ------------------------------------------------------------
    function Na__LeSpec__AfterEdit() {
        Na__LeSpec__SetLiveIso(Na__LeSpec__Now());
        Na__LeSpec__ScheduleLocalSave();
    }
    // ------------------------------------------------------------


    // FUNCTION | Look Before Sync Writes Anything
    // ------------------------------------------------------------
    // Resolves true when Sync must stop: the question was already up, or the
    // file moved behind the app's back and is now asked about. A file that
    // holds exactly what the app holds is taken as saved and Sync goes on.
    // ------------------------------------------------------------
    function Na__LeSpec__LookBeforeWrite() {
        if (!Na__LeSpec__LockstepOn()) return Promise.resolve(false);
        if (Na__LeSpec__Conflict) return Promise.resolve(true);
        return Na__LeSpec__InTurn(async () => {
            if (Na__LeSpec__Conflict) return true;
            const seen = await Na__LeSpec__Look(Na__LeSpec__LockJson(Na__LeSpec__Doc));
            return Na__LeSpec__Judge(seen) === 'asked';
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Watch
// -----------------------------------------------------------------------------

    // FUNCTION | Look at the File Once
    // ------------------------------------------------------------
    // Resolves to the lockstep state, or null when there was nothing to look
    // at or it was not the moment (not loaded, a sync or another look under
    // way, a question already open). Never writes: the autosave does that,
    // and it looks again for itself first. A look that finds only the app
    // ahead and no autosave pending puts one in hand.
    // ------------------------------------------------------------
    async function Na__LeSpec__CheckFile() {
        if (!Na__LeSpec__LockstepOn() || !Na__LeSpec__IsLoaded()) return null;
        if (Na__LeSpec__Conflict || Na__LeSpec__Syncing || Na__LeSpec__Checking) return null;
        Na__LeSpec__Checking = true;
        try {
            return await Na__LeSpec__InTurn(async () => {
                if (Na__LeSpec__Conflict || Na__LeSpec__Syncing || !Na__LeSpec__IsLoaded()) return null;   // <-- Something moved while this waited its turn
                const seen = await Na__LeSpec__Look(Na__LeSpec__LockJson(Na__LeSpec__Doc));
                if (!seen) return null;
                const said = Na__LeSpec__Judge(seen);
                if (said === 'write' && seen.verdict.state === Na__LeStmtLock__IN_STEP) {
                    if (seen.disk.modifiedIso) Na__LeSpec__SetFileIso(seen.disk.modifiedIso);   // <-- In step: keep the server's own date
                } else if (said === 'write' && seen.verdict.state === Na__LeStmtLock__APP_AHEAD && !Na__LeSpec__SaveTimer) {
                    Na__LeSpec__ScheduleLocalSave();
                }
                return seen.verdict.state;
            });
        } finally {
            Na__LeSpec__Checking = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Watch the File While the Drawing Editor Is Open
    // ------------------------------------------------------------
    // Every LockstepPollMs while this browser tab is visible. A tab in the
    // background is looked at the moment it comes back instead.
    // ------------------------------------------------------------
    function Na__LeSpec__StartWatch() {
        Na__LeSpec__StopWatch();
        if (!Na__LeSpec__LockstepOn()) return false;
        const every = Math.max(1000, Number(Na__LeCfg__GetSpecificationSetup().lockstepPollMs) || 3000);
        Na__LeSpec__WatchTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') void Na__LeSpec__CheckFile();
        }, every);
        void Na__LeSpec__CheckFile();
        return true;
    }

    function Na__LeSpec__StopWatch() {
        if (Na__LeSpec__WatchTimer) window.clearInterval(Na__LeSpec__WatchTimer);
        Na__LeSpec__WatchTimer = 0;
    }

    function Na__LeSpec__IsWatching() {
        return Na__LeSpec__WatchTimer !== 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen for the Moments the File Is Most Likely to Have Moved (once)
    // ------------------------------------------------------------
    // COMING BACK FROM AN AGENT'S EDIT, or from an editor on disk, is exactly
    // when the file is most likely to have moved: look the moment the window
    // has the focus again, or the tab is shown, rather than at the next tick.
    // ------------------------------------------------------------
    function Na__LeSpec__ListenForLockstep() {
        if (Na__LeSpec__Listening) return;
        Na__LeSpec__Listening = true;
        window.addEventListener('focus', () => { if (Na__LeSpec__WatchTimer) void Na__LeSpec__CheckFile(); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && Na__LeSpec__WatchTimer) void Na__LeSpec__CheckFile();
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Another Project: Forget This One's File
    // ------------------------------------------------------------
    function Na__LeSpec__ResetLockstep() {
        window.clearTimeout(Na__LeSpec__SaveTimer);
        Na__LeSpec__SaveTimer = 0;
        Na__LeSpec__SetFileJson(null);
        Na__LeSpec__SetFileIso('');
        Na__LeSpec__SetLiveIso('');
        Na__LeSpec__SetConflict(null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Answer
// -----------------------------------------------------------------------------

    // FUNCTION | Answer the Question
    // ------------------------------------------------------------
    // choice: 'app'  - keep the app's copy and write it to the file.
    //         'file' - load the file over the app's copy.
    // Resolves true when the answer took. The copy not chosen is put aside in
    // this browser first, so no answer loses anything. Either way the cloud
    // bookkeeping stays the cloud's: whatever differs from R2 afterwards reads
    // as unsynced, and Save Sheets sends it.
    // ------------------------------------------------------------
    async function Na__LeSpec__ResolveConflict(choice) {
        const conflict = Na__LeSpec__Conflict;
        if (!conflict) return false;

        if (choice === 'file') {
            const appCopy = (conflict.kind === 'open') ? conflict.draft.doc : JSON.parse(JSON.stringify(Na__LeSpec__Doc));
            if (Na__LeSpec__FileKey(appCopy) !== conflict.fileKey) Na__LeSpec__KeepDiscarded(appCopy, 'the specification file was chosen');
            Na__LeSpec__SetConflict(null);
            Na__LeSpec__AdoptFile(conflict.fileData, conflict.fileIso);
            Na__LeSpec__Dispatch('loaded', { codesChanged : true, lockstep : 'file' });
            Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecLockLoadedFile', 'The specification file was loaded. The app\'s copy it replaced is kept in this browser.'), false);
            return true;
        }

        if (choice === 'app') {
            Na__LeSpec__KeepDiscarded(conflict.fileData, 'the app\'s copy was chosen');
            if (conflict.kind === 'open') {                                     // <-- The file was loaded; the draft goes in its place, as RestoreDraft would put it
                const drafted = Na__LeSpec__Normalise(conflict.draft.doc);
                Na__LeSpec__SetIdFloor(Math.max(Na__LeSpec__IdFloor, drafted[Na__LeSpec__K_LAST_ID], Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_LAST_ID] : 0));
                Na__LeSpec__SetDoc(drafted);
                Na__LeSpec__SetIndex(null);
                Na__LeSpec__SetBaseStamp((typeof conflict.draft.baseStamp === 'string') ? conflict.draft.baseStamp : null);   // <-- The draft's own base: Sync asks if the cloud moved since
                Na__LeSpec__SetHistory({ undo : [], redo : [], current : JSON.stringify(drafted) });
                Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
            }
            Na__LeSpec__SetFileJson(conflict.fileKey);                         // <-- What the file holds now
            Na__LeSpec__SetFileIso(conflict.fileIso || Na__LeSpec__FileIso);
            Na__LeSpec__SetLiveIso(Na__LeSpec__Now());
            Na__LeSpec__SetConflict(null);
            if (Na__LeSpec__IsDirty()) Na__LeSpec__WriteDraft(); else Na__LeSpec__ClearDraft();
            if (conflict.kind === 'open') Na__LeSpec__Dispatch('loaded', { codesChanged : true, lockstep : 'app' });
            else Na__LeSpec__Dispatch('status');
            const saved = await Na__LeSpec__SaveLocal({ force : true, quiet : true });
            if (saved.ok) Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecLockKeptApp', 'The app\'s copy was written to the specification file. The file\'s version it replaced is kept in this browser.'), false);
            else          Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecLockKeptAppFailed', 'The app\'s copy could not be written to the specification file. It is kept in this browser - Save Sheets writes it.'), true);
            return saved.ok === true;
        }

        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Open Question, for the Page That Asks It
    // ------------------------------------------------------------
    // Everything the question shows except the two documents themselves; null
    // when the app's copy and the file are in step.
    // ------------------------------------------------------------
    function Na__LeSpec__GetConflict() {
        const conflict = Na__LeSpec__Conflict;
        if (!conflict) return null;
        return {
            kind     : conflict.kind,
            fileIso  : conflict.fileIso,
            appIso   : conflict.appIso,
            appFrom  : conflict.appFrom,
            newer    : conflict.newer,
            summary  : JSON.parse(JSON.stringify(conflict.summary)),
            askedIso : conflict.askedIso,
            fileName : Na__LeCfg__GetSpecificationSetup().fileName
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data Lockstep: the Local File, the Watch and the Question
    // ------------------------------------------------------------
    export {
        Na__LeSpec__InTurn,
        Na__LeSpec__ReadLocalFile,
        Na__LeSpec__FileCopy,
        Na__LeSpec__MirrorLocal,
        Na__LeSpec__FileKey,
        Na__LeSpec__LockSummary,
        Na__LeSpec__KeepDiscarded,
        Na__LeSpec__AdoptFile,
        Na__LeSpec__SettleFile,
        Na__LeSpec__RestoreDraftOrAsk,
        Na__LeSpec__SaveLocal,
        Na__LeSpec__WriteLocalCopy,
        Na__LeSpec__ScheduleLocalSave,
        Na__LeSpec__AfterEdit,
        Na__LeSpec__LookBeforeWrite,
        Na__LeSpec__CheckFile,
        Na__LeSpec__StartWatch,
        Na__LeSpec__StopWatch,
        Na__LeSpec__IsWatching,
        Na__LeSpec__ListenForLockstep,
        Na__LeSpec__ResetLockstep,
        Na__LeSpec__ResolveConflict,
        Na__LeSpec__GetConflict
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
