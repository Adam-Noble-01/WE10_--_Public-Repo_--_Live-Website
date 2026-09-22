// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - TRANSPORT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__Transport__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - Transport
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load, retry and sync the specification file: TrueVision__DrawingNotes__.json on R2 through the Cloudflare Worker or the public CDN, and its local copy beside TrueVision__ProjectData__.json
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - THE APP-SPECIFIC UNIT. Where the specification file lives, and how it is
//   read and written, is decided here and nowhere else, so the other units
//   stay the same in TrueVision and ValeVision.
// - WHERE IT IS READ FROM. With the Cloudflare Worker configured, on localhost
//   or with authoring unlocked, R2 is read fresh through the Worker
//   (Na__LeSpec__UsesWorker, TrueVision only); otherwise the public CDN copy
//   is read. The previous R2 name is read only when
//   TrueVision__DrawingNotes__.json is not there yet. On localhost the
//   repository copy beside TrueVision__ProjectData__.json is read as well, and
//   Reconcile decides between them: a local copy whose UpdatedIso is newer is
//   adopted so an on-disk edit reaches the editor, and a missing local copy is
//   seeded from whatever was loaded.
// - A COPY THAT COULD NOT BE READ is not a copy that is not there: the status
//   is 'failed', edits stay in this browser, and Sync refuses until Retry can
//   read the cloud copy.
// - LOADING. EnsureLoaded fetches once per project, on the first entry into
//   the editor; Adopt takes the fetched copy as the live document and
//   RestoreDraft then puts back any unsynced edits from this browser.
// - SYNC reads the cloud copy first, asks before replacing one that changed
//   since this browser read it, writes the whole file to R2 through the
//   Cloudflare API client, and then writes the local copy (MirrorLocal).
// - Its own helpers: a time limit on a read, a JSON fetch for the CDN and the
//   repository copy (Na__LeSpec__FetchJson, TrueVision only), a document's
//   cloud stamp, and the local mirror.
//
// INTEGRATION:
// - Imports the State, Document and Draft units, the config state, the project
//   code, the environment, the authoring gate, the confirm dialog, the local
//   project mirror and the Cloudflare API client.
// - Imported by Na__LayoutEditor__SpecData__.js, which exports EnsureLoaded,
//   Retry and Sync.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : adapted, as the Transport region already was
// - Divergences   : the TrueVision transport (R2 through the Cloudflare Worker,
//                   the public CDN, the repository copy through the local
//                   project mirror, and the legacy file name), with its own
//                   UsesWorker and FetchJson. Adopt, EnsureLoaded, Retry and
//                   Sync store through the State unit's setters.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - WriteLocalCopy: the live specification written to the local
//   TrueVision__DrawingNotes__.json now, then READ BACK and compared before
//   it reports verified - for a note reworded in the drawing editor's own
//   Specification tab, which Adam wants in the file the moment Enter is
//   pressed. R2 and the cloud bookkeeping are untouched, so Save Sheets still
//   syncs it (see the function for why the newer local stamp is safe).
// - Every write of the local file - the seed on load, Sync's copy and
//   WriteLocalCopy's - waits its turn in one queue (InTurn), so two writes in
//   flight can no longer land out of order.
// - FileCopy: the stamped copy a file holds, which Sync built inline; Sync
//   and WriteLocalCopy now build it the same way. No change to what Sync
//   writes.
//
// 18-Sep-2026 - Version 1.1.0
// - Added ReloadFromCloud and ReloadFromLocal: a fast, explicit re-read of
//   the cloud copy or the local repository copy, each asking first (through
//   the confirm dialog) when this browser holds unsynced edits it would
//   discard. Answers the gap between EnsureLoaded (once per project) and
//   Retry (only after a failed read): a hard refresh was previously the only
//   way to pick up a file another session had moved on, on disk or on R2.
// - Added CanReloadCloud and CanReloadLocal so the Bar and Actions units can
//   show and enable the two buttons without importing the Worker config or
//   localhost check themselves.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecData__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code, Environment, R2 Client, the Confirm Dialog and the Specification Units
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__IsRunningOnLocalhost } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../../03__AppUtils/Na__AppUtils__DevGate__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // @delegate: ../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js
    import { Na__LocalMirror__WriteSiblingFile } from '../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__ProjectFileLocation,
        Na__CfApi__ReadProjectFile,
        Na__CfApi__WriteProjectFile
    } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import {
        Na__LeSpec__VERSION,
        Na__LeSpec__STATUS_LOADING,
        Na__LeSpec__STATUS_READY,
        Na__LeSpec__STATUS_NEW,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__K_DESCRIPTION,
        Na__LeSpec__K_VERSION,
        Na__LeSpec__K_PROJECT,
        Na__LeSpec__K_UPDATED,
        Na__LeSpec__K_LAST_ID,
        Na__LeSpec__DESCRIPTION,
        Na__LeSpec__Doc,
        Na__LeSpec__Status,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__LoadPromise,
        Na__LeSpec__BaseStamp,
        Na__LeSpec__Syncing,
        Na__LeSpec__IdFloor,
        Na__LeSpec__Editable,
        Na__LeSpec__SetDoc,
        Na__LeSpec__SetIndex,
        Na__LeSpec__SetStatus,
        Na__LeSpec__SetSource,
        Na__LeSpec__SetError,
        Na__LeSpec__SetProjectCode,
        Na__LeSpec__SetLoadPromise,
        Na__LeSpec__SetBaseStamp,
        Na__LeSpec__SetSyncedJson,
        Na__LeSpec__SetCodeSig,
        Na__LeSpec__SetSyncing,
        Na__LeSpec__SetLastSyncIso,
        Na__LeSpec__SetHistory,
        Na__LeSpec__SetIdFloor,
        Na__LeSpec__Dispatch,
        Na__LeSpec__Toast
    } from './Na__LayoutEditor__SpecData__State__.js';
    import {
        Na__LeSpec__Skeleton,
        Na__LeSpec__Normalise,
        Na__LeSpec__ContentJson,
        Na__LeSpec__CodeSignature,
        Na__LeSpec__ListNotes,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty
    } from './Na__LayoutEditor__SpecData__Document__.js';
    import { Na__LeSpec__ClearDraft, Na__LeSpec__ScheduleDraft, Na__LeSpec__RestoreDraft } from './Na__LayoutEditor__SpecData__Draft__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve After a Time Limit, Whatever the Promise Does
    // ------------------------------------------------------------
    function Na__LeSpec__WithTimeout(promise, ms) {
        return Promise.race([
            Promise.resolve(promise).catch((error) => ({ ok : false, error : (error && error.message) || 'error' })),
            new Promise((resolve) => { window.setTimeout(() => resolve({ ok : false, error : 'timed out' }), ms); })
        ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch a JSON File: { ok, data, missing, error }
    // ------------------------------------------------------------
    async function Na__LeSpec__FetchJson(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            if (response.status === 404 || response.status === 403) return { ok : true, data : null, missing : true };   // <-- The CDN answers a missing object with either
            if (!response.ok) return { ok : false, data : null, missing : false, error : 'HTTP ' + response.status };
            const data = await response.json();
            return { ok : true, data : (data && typeof data === 'object') ? data : null, missing : false };
        } catch (error) {
            return { ok : false, data : null, missing : false, error : (error && error.message) || 'unreachable' };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Document's Cloud Stamp (empty when it has none)
    // ------------------------------------------------------------
    function Na__LeSpec__Stamp(data) {
        return (data && typeof data === 'object' && typeof data[Na__LeSpec__K_UPDATED] === 'string') ? data[Na__LeSpec__K_UPDATED] : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Document to the Local Drawing-Notes File, in Turn
    // ------------------------------------------------------------
    // EVERY WRITE OF THE LOCAL FILE GOES THROUGH ONE QUEUE - the seed on load,
    // Sync's copy and WriteLocalCopy's - so two writes in flight can never
    // land in the wrong order and leave the older document on disk. The
    // server answers each POST in its own time; the queue does not.
    // ------------------------------------------------------------
    let Na__LeSpec__LocalQueue = Promise.resolve();
    function Na__LeSpec__InTurn(task) {
        const job = Na__LeSpec__LocalQueue.then(task);
        Na__LeSpec__LocalQueue = job.catch(() => {});
        return job;
    }
    async function Na__LeSpec__MirrorLocalNow(doc) {
        if (!Na__AppUtils__IsRunningOnLocalhost() || !doc || typeof doc !== 'object') return { ok : false, skipped : true, error : null };
        const local = await Na__LocalMirror__WriteSiblingFile(Na__LeCfg__GetSpecificationSetup().fileName, doc);
        if (!local.ok && !local.skipped) console.warn('[TrueVision3D] Layout Editor: the local drawing-notes file was not written:', local.error);
        return local;
    }
    function Na__LeSpec__MirrorLocal(doc) {
        return Na__LeSpec__InTurn(() => Na__LeSpec__MirrorLocalNow(doc));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Live Document as a File Holds It: a Fresh, Stamped Copy
    // ------------------------------------------------------------
    // What Sync writes to R2 and to the local file, and what WriteLocalCopy
    // writes to the local file alone: the same keys, the same stamp rule.
    // THE LIVE DOCUMENT IS NEVER STAMPED - see Sync - only this copy is.
    // ------------------------------------------------------------
    function Na__LeSpec__FileCopy() {
        const out = Na__LeSpec__Normalise(Na__LeSpec__Doc);
        out[Na__LeSpec__K_DESCRIPTION] = Na__LeSpec__DESCRIPTION;
        out[Na__LeSpec__K_VERSION]     = Na__LeSpec__VERSION;
        out[Na__LeSpec__K_PROJECT]     = Na__LeSpec__ProjectCode || Na__DrawData__GetProjectCode() || null;
        out[Na__LeSpec__K_UPDATED]     = new Date().toISOString();
        out[Na__LeSpec__K_LAST_ID]     = Math.max(out[Na__LeSpec__K_LAST_ID], Na__LeSpec__IdFloor);   // <-- Ids undone away stay spent in the file too
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Transport (the TrueVision-specific part: R2 through the Worker, the CDN, the repository)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | May This Session Read the Cloud Copy Directly
    // ------------------------------------------------------------
    function Na__LeSpec__UsesWorker() {
        return Na__CfApi__IsConfigured() && (Na__AppUtils__IsRunningOnLocalhost() || Na__DevGate__IsAuthoringEnabled());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find the Specification: { status, data, source, error }
    // ------------------------------------------------------------
    // On localhost the repository TrueVision__DrawingNotes__.json is read as
    // well as R2. A local copy whose UpdatedIso is newer is adopted so an
    // on-disk edit reaches the editor; a missing local copy is seeded from
    // whatever was loaded. The previous R2 name is read only when FileName is
    // not there yet.
    // ------------------------------------------------------------
    function Na__LeSpec__HasDoc(data) {
        return !!(data && typeof data === 'object' && !Array.isArray(data));
    }

    function Na__LeSpec__Reconcile(cloud, localCopy) {
        const cloudHas = Na__LeSpec__HasDoc(cloud.data);
        const localHas = !!(localCopy && localCopy.ok && Na__LeSpec__HasDoc(localCopy.data));
        const result = Object.assign({ seedLocal : false, localAhead : false, cloudContent : null }, cloud);

        if (!cloudHas && !localHas) {
            result.seedLocal = (cloud.status === Na__LeSpec__STATUS_NEW);
            return result;
        }
        if (cloudHas && !localHas) {
            result.seedLocal = true;
            return result;
        }
        if (!cloudHas && localHas) {
            result.data   = localCopy.data;
            result.source = 'repository';
            if (cloud.status !== Na__LeSpec__STATUS_FAILED) {
                result.status       = Na__LeSpec__STATUS_READY;
                result.cloudMissing = true;
                result.error        = null;
            }
            return result;
        }

        const cloudStamp = Na__LeSpec__Stamp(cloud.data);
        const localStamp = Na__LeSpec__Stamp(localCopy.data);
        if (localStamp && cloudStamp && localStamp > cloudStamp) {
            result.status       = Na__LeSpec__STATUS_READY;
            result.data         = localCopy.data;
            result.source       = 'repository';
            result.localAhead   = true;
            result.cloudContent = cloud.data;
            result.error        = null;
            return result;
        }
        if (cloudStamp && localStamp && cloudStamp > localStamp) {
            result.seedLocal = true;
            return result;
        }
        const cloudNorm = Na__LeSpec__ContentJson(Na__LeSpec__Normalise(cloud.data));
        const localNorm = Na__LeSpec__ContentJson(Na__LeSpec__Normalise(localCopy.data));
        if (cloudNorm !== localNorm) {
            result.status       = Na__LeSpec__STATUS_READY;
            result.data         = localCopy.data;
            result.source       = 'repository';
            result.localAhead   = true;
            result.cloudContent = cloud.data;
            result.error        = null;
        }
        return result;
    }

    async function Na__LeSpec__ReadCloudFile(fileName, timeoutMs) {
        return Na__LeSpec__WithTimeout(Na__CfApi__ReadProjectFile(fileName), timeoutMs);
    }

    async function Na__LeSpec__Fetch() {
        const setup    = Na__LeCfg__GetSpecificationSetup();
        const location = Na__CfApi__ProjectFileLocation(setup.fileName);
        if (!location) return { status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : 'no project folder in the URL' };
        const legacyLocation = setup.legacyFileName ? Na__CfApi__ProjectFileLocation(setup.legacyFileName) : null;
        const local          = Na__AppUtils__IsRunningOnLocalhost();
        const localCopy      = local ? await Na__LeSpec__FetchJson(location.repoUrl) : { ok : true, data : null, missing : true };

        if (Na__LeSpec__UsesWorker()) {
            let read = await Na__LeSpec__ReadCloudFile(setup.fileName, setup.loadTimeoutMs);
            if (read && read.ok && (read.missing || !Na__LeSpec__HasDoc(read.data)) && setup.legacyFileName) {
                const legacy = await Na__LeSpec__ReadCloudFile(setup.legacyFileName, setup.loadTimeoutMs);
                if (legacy && legacy.ok && !legacy.missing && Na__LeSpec__HasDoc(legacy.data)) read = legacy;
            }
            if (read && read.ok && !read.missing && Na__LeSpec__HasDoc(read.data)) {
                return Na__LeSpec__Reconcile({ status : Na__LeSpec__STATUS_READY, data : read.data, source : 'cloud' }, localCopy);
            }
            if (read && read.ok) {
                return Na__LeSpec__Reconcile({ status : Na__LeSpec__STATUS_NEW, data : null, source : 'cloud', cloudMissing : true }, localCopy);
            }
            const fallback = (localCopy.ok && Na__LeSpec__HasDoc(localCopy.data))
                ? localCopy
                : (!local ? await Na__LeSpec__FetchJson(location.cdnUrl) : { ok : false, data : null });
            return Na__LeSpec__Reconcile({
                status : Na__LeSpec__STATUS_FAILED,
                data   : (fallback.ok && Na__LeSpec__HasDoc(fallback.data)) ? fallback.data : null,
                source : (fallback.ok && Na__LeSpec__HasDoc(fallback.data)) ? (local ? 'repository' : 'cdn') : null,
                error  : (read && read.error) || 'Worker unreachable'
            }, localCopy);
        }

        let cdn = await Na__LeSpec__FetchJson(location.cdnUrl);
        if (cdn.ok && (cdn.missing || !Na__LeSpec__HasDoc(cdn.data)) && legacyLocation) {
            const legacy = await Na__LeSpec__FetchJson(legacyLocation.cdnUrl);
            if (legacy.ok && Na__LeSpec__HasDoc(legacy.data)) cdn = legacy;
        }
        if (cdn.ok && Na__LeSpec__HasDoc(cdn.data)) return { status : Na__LeSpec__STATUS_READY, data : cdn.data, source : 'cdn' };
        if (cdn.ok && cdn.missing) return { status : Na__LeSpec__STATUS_NEW, data : null, source : 'cdn' };
        return { status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : cdn.error || 'CDN unreachable' };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take a Fetched Copy as the Live Document
    // ------------------------------------------------------------
    function Na__LeSpec__Adopt(result) {
        const doc = Na__LeSpec__Normalise(result.data);
        Na__LeSpec__SetIdFloor(Math.max(Na__LeSpec__IdFloor, doc[Na__LeSpec__K_LAST_ID]));
        Na__LeSpec__SetDoc(doc);
        Na__LeSpec__SetIndex(null);
        Na__LeSpec__SetStatus(result.status);
        Na__LeSpec__SetSource(result.source);
        Na__LeSpec__SetError(result.error || null);
        if (result.localAhead && result.cloudContent) {
            Na__LeSpec__SetBaseStamp(Na__LeSpec__Stamp(result.cloudContent) || null);
            Na__LeSpec__SetSyncedJson(Na__LeSpec__ContentJson(Na__LeSpec__Normalise(result.cloudContent)));
        } else {
            Na__LeSpec__SetBaseStamp((result.data && !result.cloudMissing) ? doc[Na__LeSpec__K_UPDATED] : null);
            Na__LeSpec__SetSyncedJson(result.cloudMissing ? Na__LeSpec__ContentJson(Na__LeSpec__Skeleton()) : Na__LeSpec__ContentJson(doc));
        }
        Na__LeSpec__SetHistory({ undo : [], redo : [], current : JSON.stringify(doc) });
        Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
        if (result.seedLocal) void Na__LeSpec__MirrorLocal(doc);
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Specification Once per Project (the first entry into the editor)
    // ------------------------------------------------------------
    // Resolves to the live document. Never rejects: a failure leaves the status
    // 'failed' and an empty (or fallback) document to work in.
    // ------------------------------------------------------------
    function Na__LeSpec__EnsureLoaded() {
        const code = Na__DrawData__GetProjectCode();
        if (Na__LeSpec__LoadPromise && Na__LeSpec__ProjectCode === code) return Na__LeSpec__LoadPromise;
        Na__LeSpec__SetProjectCode(code);
        Na__LeSpec__SetStatus(Na__LeSpec__STATUS_LOADING);
        Na__LeSpec__Dispatch('status');
        Na__LeSpec__SetLoadPromise(Na__LeSpec__Fetch().then((result) => {
            if (Na__LeSpec__ProjectCode !== code) return Na__LeSpec__Doc;           // <-- Another project arrived meanwhile
            Na__LeSpec__Adopt(result);
            Na__LeSpec__RestoreDraft();
            Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
            if (result.status === Na__LeSpec__STATUS_FAILED) console.warn('[TrueVision3D] Layout Editor: the project specification could not be read (' + (result.error || 'unknown') + '). Edits stay in this browser; Sync is closed until it can be read.');
            else console.log('[TrueVision3D] Layout Editor: project specification ' + (result.status === Na__LeSpec__STATUS_NEW ? 'not created yet' : 'loaded from the ' + result.source) + ' (' + Na__LeSpec__ListNotes().length + ' note(s)).');
            Na__LeSpec__Dispatch('loaded', { codesChanged : true });
            return Na__LeSpec__Doc;
        }).catch((error) => {
            console.error('[TrueVision3D] Layout Editor: specification load error:', error);
            Na__LeSpec__Adopt({ status : Na__LeSpec__STATUS_FAILED, data : null, source : null, error : (error && error.message) || 'error' });
            Na__LeSpec__Dispatch('loaded', { codesChanged : true });
            return Na__LeSpec__Doc;
        }));
        return Na__LeSpec__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Try the Cloud Copy Again After a Failed Read
    // ------------------------------------------------------------
    // With no edits made meanwhile, the cloud copy simply becomes the document.
    // Edits made while it could not be read are kept - they are this person's
    // work - but they were NOT made on the cloud copy, so the stamp they started
    // from stays their base: Sync then asks before they replace what the cloud
    // holds, rather than quietly writing an edited empty specification over a
    // real one.
    // ------------------------------------------------------------
    async function Na__LeSpec__Retry() {
        if (Na__LeSpec__Status !== Na__LeSpec__STATUS_FAILED || Na__LeSpec__Syncing) return false;
        const hadEdits = Na__LeSpec__IsDirty();
        const kept     = Na__LeSpec__Doc;
        const keptBase = Na__LeSpec__BaseStamp;
        Na__LeSpec__SetStatus(Na__LeSpec__STATUS_LOADING);
        Na__LeSpec__Dispatch('status');
        const result = await Na__LeSpec__Fetch();
        if (result.status === Na__LeSpec__STATUS_FAILED) {
            Na__LeSpec__SetStatus(Na__LeSpec__STATUS_FAILED);
            Na__LeSpec__SetError(result.error || null);
            Na__LeSpec__Dispatch('status');
            return false;
        }
        Na__LeSpec__Adopt(result);
        if (hadEdits && kept) {
            Na__LeSpec__SetDoc(kept);                                           // <-- The cloud copy's counter is already in the id floor
            Na__LeSpec__SetIndex(null);
            Na__LeSpec__SetBaseStamp(keptBase);                                 // <-- The edits' own base, so Sync asks before replacing the cloud copy
            Na__LeSpec__SetHistory({ undo : [], redo : [], current : JSON.stringify(kept) });
            Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecRetryKeptEdits', 'The cloud copy can be read again. The changes made while it could not be read are kept; Sync asks before they replace it.'), false);
        }
        Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
        Na__LeSpec__Dispatch('loaded', { codesChanged : true });
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Cloud Stamp as Words for the Overwrite Question
    // ------------------------------------------------------------
    function Na__LeSpec__When(iso) {
        const date = iso ? new Date(iso) : null;
        return (date && !isNaN(date.getTime())) ? date.toLocaleString() : Na__LeCfg__GetLabel('SpecWhenUnknown', 'at an unknown time');
    }
    // ------------------------------------------------------------


    // FUNCTION | May This Session Force-Reload the Cloud / Local Copy
    // ------------------------------------------------------------
    // What the Reload buttons show and enable is asked through these, so the
    // Bar and Actions units need not know a worker or a localhost from a CDN.
    // ------------------------------------------------------------
    function Na__LeSpec__CanReloadCloud() { return Na__CfApi__IsConfigured(); }
    function Na__LeSpec__CanReloadLocal() { return Na__AppUtils__IsRunningOnLocalhost(); }
    // ------------------------------------------------------------


    // FUNCTION | Force-Reload the Specification From the Cloud Copy (R2), Asking First When Edits Would Be Lost
    // ------------------------------------------------------------
    // A fast, explicit re-read for when another session (an LLM editing the
    // file on disk and syncing it, or a colleague) has moved the cloud copy on
    // and a hard refresh is the only way this browser has caught up so far.
    // Unsynced edits in this browser are what a reload can destroy, so it asks
    // before discarding them - the same shape of question Sync already asks
    // in the other direction.
    // ------------------------------------------------------------
    async function Na__LeSpec__ReloadFromCloud() {
        if (Na__LeSpec__Syncing) return false;
        const setup = Na__LeCfg__GetSpecificationSetup();
        if (!Na__LeSpec__CanReloadCloud()) { Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecReloadNoWorker', 'Cloudflare Worker not configured. The cloud copy cannot be read.'), true); return false; }
        if (Na__LeSpec__IsDirty()) {
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title         : Na__LeCfg__GetLabel('SpecReloadCloudTitle', 'Reload from the cloud?'),
                message       : Na__LeCfg__GetLabel('SpecReloadCloudPrompt', 'This browser holds changes that have not been synced. Reloading replaces them with the cloud copy on R2, and the unsynced changes are lost.'),
                confirmLabel  : Na__LeCfg__GetLabel('SpecReloadConfirm', 'Reload'),
                isDestructive : true
            });
            if (!ok) return false;
        }
        const prevStatus = Na__LeSpec__Status;
        Na__LeSpec__SetStatus(Na__LeSpec__STATUS_LOADING);
        Na__LeSpec__Dispatch('status');
        let read = await Na__LeSpec__ReadCloudFile(setup.fileName, setup.loadTimeoutMs);
        if (read && read.ok && (read.missing || !Na__LeSpec__HasDoc(read.data)) && setup.legacyFileName) {
            const legacy = await Na__LeSpec__ReadCloudFile(setup.legacyFileName, setup.loadTimeoutMs);
            if (legacy && legacy.ok && !legacy.missing && Na__LeSpec__HasDoc(legacy.data)) read = legacy;
        }
        if (!read || !read.ok) {
            Na__LeSpec__SetStatus(prevStatus);
            Na__LeSpec__Dispatch('status');
            Na__LeSpec__Toast(Na__LeCfg__FormatLabel('SpecReloadFailed', 'Reload from the cloud failed: {error}.', { error : (read && read.error) || 'unknown' }), true);
            return false;
        }
        Na__LeSpec__ClearDraft();
        Na__LeSpec__Adopt(Na__LeSpec__HasDoc(read.data)
            ? { status : Na__LeSpec__STATUS_READY, data : read.data, source : 'cloud' }
            : { status : Na__LeSpec__STATUS_NEW, data : null, source : 'cloud', cloudMissing : true });
        Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
        Na__LeSpec__Dispatch('loaded', { codesChanged : true });
        Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecReloadedCloud', 'Reloaded from the cloud.'), false);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Force-Reload the Specification From the Local Repository Copy, Asking First When Edits Would Be Lost
    // ------------------------------------------------------------
    // The counterpart to ReloadFromCloud: on localhost only, where the
    // repository file beside TrueVision__ProjectData__.json exists. It reads
    // that file fresh (no browser cache) and adopts it as the live document,
    // asking first when this browser holds unsynced edits it would discard.
    // ------------------------------------------------------------
    async function Na__LeSpec__ReloadFromLocal() {
        if (Na__LeSpec__Syncing) return false;
        if (!Na__LeSpec__CanReloadLocal()) { Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecReloadLocalUnavailable', 'The local copy is only available on localhost.'), true); return false; }
        const setup    = Na__LeCfg__GetSpecificationSetup();
        const location = Na__CfApi__ProjectFileLocation(setup.fileName);
        if (!location) { Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecReloadNoProject', 'No project folder in the URL.'), true); return false; }
        if (Na__LeSpec__IsDirty()) {
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title         : Na__LeCfg__GetLabel('SpecReloadLocalTitle', 'Reload from the local file?'),
                message       : Na__LeCfg__GetLabel('SpecReloadLocalPrompt', 'This browser holds changes that have not been synced. Reloading replaces them with the local file on disk, and the unsynced changes are lost.'),
                confirmLabel  : Na__LeCfg__GetLabel('SpecReloadConfirm', 'Reload'),
                isDestructive : true
            });
            if (!ok) return false;
        }
        const prevStatus = Na__LeSpec__Status;
        Na__LeSpec__SetStatus(Na__LeSpec__STATUS_LOADING);
        Na__LeSpec__Dispatch('status');
        const local = await Na__LeSpec__FetchJson(location.repoUrl);
        if (!local.ok || !Na__LeSpec__HasDoc(local.data)) {
            Na__LeSpec__SetStatus(prevStatus);
            Na__LeSpec__Dispatch('status');
            Na__LeSpec__Toast(!local.ok
                ? Na__LeCfg__FormatLabel('SpecReloadFailed', 'Reload from the local file failed: {error}.', { error : local.error || 'unknown' })
                : Na__LeCfg__GetLabel('SpecReloadLocalMissing', 'No local copy was found for this project.'), true);
            return false;
        }
        Na__LeSpec__ClearDraft();
        Na__LeSpec__Adopt({ status : Na__LeSpec__STATUS_READY, data : local.data, source : 'repository' });
        Na__LeSpec__SetCodeSig(Na__LeSpec__CodeSignature());
        Na__LeSpec__Dispatch('loaded', { codesChanged : true });
        Na__LeSpec__Toast(Na__LeCfg__GetLabel('SpecReloadedLocal', 'Reloaded from the local file.'), false);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Sync: Write the Whole Specification to R2
    // ------------------------------------------------------------
    // options: { showToast, quiet }. Reads the cloud copy first; when it is not
    // the copy these edits started from, asks before replacing it. Resolves true
    // when the file was written.
    // ------------------------------------------------------------
    async function Na__LeSpec__Sync(options) {
        const opts  = options || {};
        const setup = Na__LeCfg__GetSpecificationSetup();
        const toast = (message, isError) => Na__LeSpec__Toast(message, isError, opts.showToast);
        if (Na__LeSpec__Syncing) return false;
        if (!Na__LeSpec__Editable) { toast(Na__LeCfg__GetLabel('SpecSyncReadOnly', 'The specification is read-only here.'), true); return false; }
        if (!Na__LeSpec__IsLoaded()) { toast(Na__LeCfg__GetLabel('SpecSyncNotLoaded', 'The specification has not finished loading.'), true); return false; }
        if (!Na__CfApi__IsConfigured()) { toast(Na__LeCfg__GetLabel('SpecSyncNoWorker', 'Cloudflare Worker not configured. The specification cannot be synced.'), true); return false; }

        Na__LeSpec__SetSyncing(true);
        Na__LeSpec__Dispatch('status');
        try {
            let read = await Na__LeSpec__ReadCloudFile(setup.fileName, setup.loadTimeoutMs);
            if (read && read.ok && (read.missing || !Na__LeSpec__HasDoc(read.data)) && setup.legacyFileName) {
                const legacy = await Na__LeSpec__ReadCloudFile(setup.legacyFileName, setup.loadTimeoutMs);
                if (legacy && legacy.ok && !legacy.missing && Na__LeSpec__HasDoc(legacy.data)) {
                    read = { ok : true, missing : false, data : legacy.data };
                }
            }
            if (!read || !read.ok) {
                toast(Na__LeCfg__FormatLabel('SpecSyncUnreachable', 'The cloud copy could not be read ({error}). Your changes are kept in this browser.', { error : (read && read.error) || 'unknown' }), true);
                return false;
            }
            const cloudStamp = (read.missing || !read.data) ? null : (typeof read.data[Na__LeSpec__K_UPDATED] === 'string' ? read.data[Na__LeSpec__K_UPDATED] : 'unstamped');
            if (setup.confirmOverwrite && cloudStamp !== Na__LeSpec__BaseStamp) {
                const ok = await Na__AppUtils__ConfirmDialog__Show({
                    title        : Na__LeCfg__GetLabel('SpecOverwriteTitle', 'Replace the cloud specification?'),
                    message      : Na__LeSpec__BaseStamp === null
                        ? Na__LeCfg__GetLabel('SpecOverwriteUnreadPrompt', 'The cloud already holds a specification that this browser has not read. Syncing replaces it with the copy in this browser.')
                        : Na__LeCfg__FormatLabel('SpecOverwritePrompt', 'The specification in the cloud has changed since this browser read it (saved {when}). Syncing replaces it with the copy in this browser.', { when : Na__LeSpec__When(cloudStamp) }),
                    confirmLabel : Na__LeCfg__GetLabel('SpecOverwriteConfirm', 'Replace'),
                    isDestructive : true
                });
                if (!ok) { toast(Na__LeCfg__GetLabel('SpecSyncCancelled', 'Sync cancelled. Your changes are kept in this browser.'), false); return false; }
            }

            const out   = Na__LeSpec__FileCopy();                              // <-- Stamped now; ids undone away stay spent in the file too
            const write = await Na__CfApi__WriteProjectFile(setup.fileName, out);
            if (!write || !write.ok) {
                toast(Na__LeCfg__FormatLabel('SpecSyncFailed', 'Specification sync failed: {error}. Your changes are kept in this browser.', { error : (write && write.error) || 'unknown' }), true);
                return false;
            }
            await Na__LeSpec__MirrorLocal(out);

            // THE LIVE DOCUMENT IS NOT STAMPED. The stamp belongs to the copy in the
            // cloud and is remembered as the base; writing it into the document
            // would make it differ from the undo history, and the first undo after
            // a sync would quietly undo the stamp instead of the last edit.
            Na__LeSpec__SetBaseStamp(out[Na__LeSpec__K_UPDATED]);
            Na__LeSpec__SetSyncedJson(Na__LeSpec__ContentJson(out));               // <-- What was written; typing that landed during the write stays unsynced
            Na__LeSpec__SetStatus(Na__LeSpec__STATUS_READY);
            Na__LeSpec__SetSource('cloud');
            Na__LeSpec__SetError(null);
            Na__LeSpec__SetLastSyncIso(out[Na__LeSpec__K_UPDATED]);
            if (Na__LeSpec__IsDirty()) Na__LeSpec__ScheduleDraft(); else Na__LeSpec__ClearDraft();
            if (!opts.quiet) toast(Na__LeCfg__GetLabel('SpecSynced', 'Project specification synced.'), false);
            return true;
        } catch (error) {
            console.error('[TrueVision3D] Layout Editor: specification sync error:', error);
            toast(Na__LeCfg__FormatLabel('SpecSyncFailed', 'Specification sync failed: {error}. Your changes are kept in this browser.', { error : (error && error.message) || 'unknown' }), true);
            return false;
        } finally {
            Na__LeSpec__SetSyncing(false);
            Na__LeSpec__Dispatch('synced');
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write This Computer's Copy of the Specification Now: { ok, skipped, verified, error }
    // ------------------------------------------------------------
    // WHY. A note reworded where it is read - the drawing editor's own
    // Specification tab - is a finished change, made with Enter, and belongs
    // in the specification FILE straight away: the repository's
    // TrueVision__DrawingNotes__.json beside the project data, the copy an
    // agent reads on disk. Until now only Sync wrote that file.
    //
    // WHAT IT DOES NOT DO. It does not touch R2, and it changes none of the
    // cloud bookkeeping - the base stamp and the synced content stay the
    // cloud copy's - so the specification still reads as unsynced, Save
    // Sheets stays lit, and Save Sheets still takes the change to R2 (Sync),
    // asking first as ever if the cloud copy moved on meanwhile.
    //
    // WHY THE NEWER STAMP IS SAFE. The file is stamped now, later than the
    // cloud copy it started from, and a load that finds a local copy newer
    // than R2 adopts it as the live document (Reconcile) - which is what an
    // edit on disk has always done. A cloud copy synced since, by someone
    // else, is newer still and wins; this browser's draft then brings the
    // edit back and Sync asks before replacing the cloud copy.
    //
    // SAFE ON DISK. The document is the live one AS IT STANDS NOW, copied
    // before anything is awaited; the write waits its turn behind any other
    // write of the file; and the file is READ BACK and compared, content for
    // content, before this reports verified. Localhost only: elsewhere there
    // is no local file and the answer is skipped.
    // ------------------------------------------------------------
    function Na__LeSpec__WriteLocalCopy() {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Promise.resolve({ ok : false, skipped : true, verified : false, error : null });
        if (!Na__LeSpec__IsLoaded() || !Na__LeSpec__Doc) return Promise.resolve({ ok : false, skipped : false, verified : false, error : Na__LeCfg__GetLabel('SpecSyncNotLoaded', 'The specification has not finished loading.') });
        const setup    = Na__LeCfg__GetSpecificationSetup();
        const location = Na__CfApi__ProjectFileLocation(setup.fileName);
        const out      = Na__LeSpec__FileCopy();                              // <-- Now, before anything is awaited
        return Na__LeSpec__InTurn(async () => {
            const written = await Na__LeSpec__MirrorLocalNow(out);
            if (!written.ok) return { ok : false, skipped : written.skipped === true, verified : false, error : written.error || null };
            if (!location) return { ok : true, skipped : false, verified : false, error : null };
            const back = await Na__LeSpec__FetchJson(location.repoUrl);       // <-- Inside the turn: no later write can land between the two
            if (!back.ok || !Na__LeSpec__HasDoc(back.data)) {
                return { ok : false, skipped : false, verified : false, error : 'the file could not be read back (' + ((back && back.error) || 'not found') + ')' };
            }
            if (Na__LeSpec__ContentJson(Na__LeSpec__Normalise(back.data)) !== Na__LeSpec__ContentJson(out)) {
                return { ok : false, skipped : false, verified : false, error : 'the file on disk does not hold what was written' };
            }
            return { ok : true, skipped : false, verified : true, error : null };
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data Transport: Load, Retry and Sync
    // ------------------------------------------------------------
    export {
        Na__LeSpec__EnsureLoaded,
        Na__LeSpec__Retry,
        Na__LeSpec__Sync,
        Na__LeSpec__WriteLocalCopy,
        Na__LeSpec__CanReloadCloud,
        Na__LeSpec__CanReloadLocal,
        Na__LeSpec__ReloadFromCloud,
        Na__LeSpec__ReloadFromLocal
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
