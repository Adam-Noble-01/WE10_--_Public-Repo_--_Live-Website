// =============================================================================
// TRUEVISION3D - LOCAL FILE PARITY - REGISTRY
// =============================================================================
//
// FILE       : Na__FileParity__Registry__.js
// NAMESPACE  : Na__FileParity
// MODULE     : Local File Parity - Registry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Remember which version of each project file this window holds, which versions this browser wrote, and put the right headers on every local write
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE ONE QUESTION THE GUARD ASKS: "is the file on disk still the version
//   this window is working from?" This unit holds the answer's other half -
//   the BASELINE of every watched file, the version this window last read or
//   wrote - and nothing else. The watcher asks the server for the disk half.
// - A FILE MATTERS TO THIS WINDOW ONLY ONCE THIS WINDOW HAS READ OR WRITTEN
//   IT. A statement never opened, or a specification never loaded, has no
//   baseline, so a change to it is nobody's business here: there is nothing
//   in this window that could overwrite it.
// - WHERE BASELINES COME FROM. A read: the local server stamps every read of
//   a watched file with X-Na-File-Version, and the watcher's fetch observer
//   hands that here (NoteRead). A write: Na__AppUtils__LocalProjectMirror__
//   hands the version the server says it produced (NoteOwnWrite). A decision:
//   the user chose to overwrite, or to keep a browser draft, over a version
//   they have now seen (Acknowledge).
// - WHAT THIS BROWSER WROTE is kept in localStorage per project folder, the
//   last few versions of each file, so a browser draft opened tomorrow can
//   tell "the file moved because I saved it" from "somebody else moved it".
// - THE HEADERS. Every local write carries this window's id and, once the
//   file has a baseline, the version the write was made from. The local
//   server refuses the write (409) if the disk has moved on since.
// - NO APP IMPORTS BUT THE URL HELPERS, so the local mirror, both browser
//   drafts and the specification's Sync can import it without a cycle. The
//   parts that need the modal - ConfirmSave and AskDraft - are installed by
//   Na__FileParity__Watcher__ at start-up; until then (or on the web, where
//   there are no local files) both answer "go ahead", exactly as before.
//
// INTEGRATION:
// - Imported by Na__FileParity__Watcher__ (everything), by
//   Na__AppUtils__LocalProjectMirror__ (WriteHeaders, NoteOwnWrite,
//   NoteRefused, Forget), by Na__LayoutEditor__AutoSave__ and
//   Na__LayoutEditor__SpecData__Draft__ (BaseVersion, DraftVerdict, AskDraft)
//   and by Na__LayoutEditor__SpecData__Transport__ (ConfirmSave).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Needs a local server that stamps reads
//                   and writes as ProjectVision__TrueVisionFileWatch__Api__ does.
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

    // MODULE IMPORTS | Project URL Utilities (a leaf: imports nothing)
    // ------------------------------------------------------------
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Watched Files and Their Keys (mirror the local server)
    // ------------------------------------------------------------
    const Na__FileParity__DATA_FILES = Object.freeze({
        'TrueVision__ProjectData__.json'   : 'project-data',
        'TrueVision__DrawingNotes__.json'  : 'drawing-notes',
        'TrueVision__StatementDocs__.json' : 'statement-index'
    });
    const Na__FileParity__STATEMENT_PREFIX = 'statement:';                         // <-- statement:<path inside 10__StatementDocs>, lower case
    const Na__FileParity__STATEMENTS_DIR   = '10__StatementDocs/';
    const Na__FileParity__CONTENT_DIR      = '30__TrueVision__AppContent';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Headers (mirror ProjectVision__TrueVisionFileWatch__Api__)
    // ------------------------------------------------------------
    const Na__FileParity__HEADER_VERSION = 'X-Na-File-Version';
    const Na__FileParity__HEADER_MTIME   = 'X-Na-File-Mtime-Ms';
    const Na__FileParity__HEADER_BASE    = 'X-Na-Base-Version';
    const Na__FileParity__HEADER_CLIENT  = 'X-Na-Client-Id';
    const Na__FileParity__HEADER_PEEK    = 'X-Na-Parity-Peek';                     // <-- A read that is NOT taken into the window (the mirror's read before its merge)
    const Na__FileParity__MISSING        = 'missing';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Events, Storage and Limits
    // ------------------------------------------------------------
    const Na__FileParity__EVENT            = 'na-fileparity-changed';              // <-- detail { reason : 'read' | 'write' | 'ack' | 'forget' | 'refused', key }
    const Na__FileParity__OWN_PREFIX       = 'Na__FileParity__OwnWrites__';
    const Na__FileParity__OWN_PER_FILE     = 12;
    const Na__FileParity__OWN_MAX_AGE_MS   = 14 * 24 * 60 * 60 * 1000;             // <-- A fortnight: older own writes are no help to any draft
    const Na__FileParity__CLOCK_SLACK_MS   = 2000;                                 // <-- A draft is "older than the file" only by more than this
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | This Window, Its Baselines and the Installed Decisions
    // ------------------------------------------------------------
    const Na__FileParity__ClientId  = 'tv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const Na__FileParity__Baselines = new Map();       // <-- key -> { version, mtimeMs, source : 'read' | 'write' | 'ack', atMs }
    let   Na__FileParity__Impl      = null;            // <-- { confirmSave(key, options), askDraft(key, info) }, installed by the watcher
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keys
// -----------------------------------------------------------------------------

    // FUNCTION | Is the Guard Meaningful Here (localhost, with a project folder in the URL)
    // ------------------------------------------------------------
    function Na__FileParity__IsAvailable() {
        return Na__AppUtils__IsRunningOnLocalhost() && !!Na__AppUtils__GetProjectFolderFromUrl();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project Folder and Year This Window Is Working On
    // ------------------------------------------------------------
    function Na__FileParity__Context() {
        const folder = Na__AppUtils__GetProjectFolderFromUrl();
        return folder ? { folder : folder, year : Na__AppUtils__GetYearFromUrl() } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Statement File's Key, From Its Path Inside 10__StatementDocs
    // ------------------------------------------------------------
    // Lower case on both sides of every comparison: Windows keeps a name's case
    // loosely, and a statement's index record and the folder can disagree.
    // ------------------------------------------------------------
    function Na__FileParity__StatementKey(path) {
        const text = String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        return text ? Na__FileParity__STATEMENT_PREFIX + text.toLowerCase() : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Key the Server Sent, Made Comparable
    // ------------------------------------------------------------
    function Na__FileParity__NormaliseKey(key) {
        const text = String(key || '');
        return text.startsWith(Na__FileParity__STATEMENT_PREFIX) ? text.toLowerCase() : text;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Data File's Key, From Its File Name (null for any other file)
    // ------------------------------------------------------------
    function Na__FileParity__KeyForFileName(fileName) {
        return Na__FileParity__DATA_FILES[String(fileName || '')] || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Key of the Watched File a URL Reads (null for anything else)
    // ------------------------------------------------------------
    // Same origin only, and this window's project folder only:
    //   /na-project-portal/<yy>-Projects/<folder>/30__TrueVision__AppContent/<data file>
    //   /na-project-portal/<yy>-Projects/<folder>/30__TrueVision__AppContent/10__StatementDocs/<...>.md
    //   /api/projects/<code>/files/<data file>?project-folder=<folder>
    // ------------------------------------------------------------
    function Na__FileParity__KeyForUrl(input) {
        const context = Na__FileParity__Context();
        if (!context) return null;
        let url;
        try { url = new URL(String(input), window.location.href); } catch (error) { return null; }
        if (url.origin !== window.location.origin) return null;
        let path;
        try { path = decodeURIComponent(url.pathname); } catch (error) { return null; }

        const portal = /^\/na-project-portal\/\d{2}-Projects\/([^/]+)\/([^/]+)\/(.+)$/.exec(path);
        if (portal) {
            if (portal[1] !== context.folder || portal[2] !== Na__FileParity__CONTENT_DIR) return null;
            const rest = portal[3];
            if (Na__FileParity__DATA_FILES[rest]) return Na__FileParity__DATA_FILES[rest];
            if (rest.startsWith(Na__FileParity__STATEMENTS_DIR) && /\.md$/i.test(rest)) return Na__FileParity__StatementKey(rest.slice(Na__FileParity__STATEMENTS_DIR.length));
            return null;
        }

        const sibling = /^\/api\/projects\/[A-Za-z]{2}\d{2}\/files\/([^/]+)$/.exec(path);
        if (sibling && Na__FileParity__DATA_FILES[sibling[1]]) {
            const folder = url.searchParams.get('project-folder');
            return (!folder || folder === context.folder) ? Na__FileParity__DATA_FILES[sibling[1]] : null;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Baselines
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell the Watcher Something Moved
    // ------------------------------------------------------------
    function Na__FileParity__Announce(reason, key, extra) {
        try {
            window.dispatchEvent(new CustomEvent(Na__FileParity__EVENT, { detail : Object.assign({ reason : reason, key : key }, extra || {}) }));
        } catch (error) { /* an announcement is a courtesy */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set a Baseline
    // ------------------------------------------------------------
    function Na__FileParity__SetBaseline(key, version, mtimeMs, source) {
        const normalised = Na__FileParity__NormaliseKey(key);
        if (!normalised || typeof version !== 'string' || !version) return false;
        Na__FileParity__Baselines.set(normalised, {
            version : version,
            mtimeMs : Number.isFinite(mtimeMs) ? mtimeMs : null,
            source  : source,
            atMs    : Date.now()
        });
        Na__FileParity__Announce(source, normalised);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | This Window Has Just Read a Watched File
    // ------------------------------------------------------------
    function Na__FileParity__NoteRead(key, version, mtimeMs) {
        return Na__FileParity__SetBaseline(key, version, mtimeMs, 'read');
    }
    // ------------------------------------------------------------


    // FUNCTION | This Window Has Just Written a Watched File
    // ------------------------------------------------------------
    function Na__FileParity__NoteOwnWrite(key, version, mtimeMs) {
        if (!Na__FileParity__SetBaseline(key, version, mtimeMs, 'write')) return false;
        Na__FileParity__RememberOwn(Na__FileParity__NormaliseKey(key), version);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The User Has Seen the Version on Disk and Chosen to Work Over It
    // ------------------------------------------------------------
    // "Overwrite with mine", or "keep my browser draft": the next save is made
    // from the version they saw, so a later change still stops it.
    // ------------------------------------------------------------
    function Na__FileParity__Acknowledge(key, version, mtimeMs) {
        return Na__FileParity__SetBaseline(key, version, mtimeMs, 'ack');
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget Files This Window Moved or Deleted (a key, or every key under a prefix)
    // ------------------------------------------------------------
    function Na__FileParity__Forget(keyOrPrefix) {
        const target = Na__FileParity__NormaliseKey(keyOrPrefix);
        if (!target) return 0;
        let count = 0;
        Array.from(Na__FileParity__Baselines.keys()).forEach((key) => {
            if (key === target || (target.endsWith('/') && key.startsWith(target))) {
                Na__FileParity__Baselines.delete(key);
                count++;
            }
        });
        if (count) Na__FileParity__Announce('forget', target);
        return count;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Baseline of One File, and the Version Alone
    // ------------------------------------------------------------
    function Na__FileParity__Baseline(key) {
        const entry = Na__FileParity__Baselines.get(Na__FileParity__NormaliseKey(key));
        return entry ? Object.assign({}, entry) : null;
    }
    function Na__FileParity__BaseVersion(key) {
        const entry = Na__FileParity__Baselines.get(Na__FileParity__NormaliseKey(key));
        return entry ? entry.version : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Baseline, as a Plain Object (key -> baseline)
    // ------------------------------------------------------------
    function Na__FileParity__Baselines__All() {
        const out = {};
        Na__FileParity__Baselines.forEach((value, key) => { out[key] = Object.assign({}, value); });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What This Browser Wrote (localStorage, per project folder)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Storage Key for the Open Project
    // ------------------------------------------------------------
    function Na__FileParity__OwnKey() {
        const context = Na__FileParity__Context();
        return context ? Na__FileParity__OWN_PREFIX + context.folder : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read and Write the Record; Never Throws
    // ------------------------------------------------------------
    function Na__FileParity__ReadOwn() {
        const storageKey = Na__FileParity__OwnKey();
        if (!storageKey) return {};
        try {
            const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (error) { return {}; }
    }
    function Na__FileParity__RememberOwn(key, version) {
        const storageKey = Na__FileParity__OwnKey();
        if (!storageKey || !key || !version) return;
        const record = Na__FileParity__ReadOwn();
        const cutoff = Date.now() - Na__FileParity__OWN_MAX_AGE_MS;
        const list = (Array.isArray(record[key]) ? record[key] : []).filter((entry) => entry && entry.version !== version && entry.atMs > cutoff);
        list.push({ version : version, atMs : Date.now() });
        record[key] = list.slice(-Na__FileParity__OWN_PER_FILE);
        try { window.localStorage.setItem(storageKey, JSON.stringify(record)); }
        catch (error) { /* private mode or a full store: drafts fall back to the clock */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | Did This Browser Write This Version of This File
    // ------------------------------------------------------------
    function Na__FileParity__IsOwnVersion(key, version) {
        if (!version) return false;
        const list = Na__FileParity__ReadOwn()[Na__FileParity__NormaliseKey(key)];
        return Array.isArray(list) && list.some((entry) => entry && entry.version === version);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Local Writes: Headers, Answers and Refusals
// -----------------------------------------------------------------------------

    // FUNCTION | The Headers a Local Write of This File Carries
    // ------------------------------------------------------------
    // This window's id always; the version the write is made from once the
    // file has a baseline. With no baseline the write names no base and the
    // server lets it through as it always did.
    // ------------------------------------------------------------
    function Na__FileParity__WriteHeaders(key) {
        const headers = {};
        headers[Na__FileParity__HEADER_CLIENT] = Na__FileParity__ClientId;
        const base = key ? Na__FileParity__BaseVersion(key) : null;
        if (base) headers[Na__FileParity__HEADER_BASE] = base;
        return headers;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Version a Successful Write Produced From Its Response
    // ------------------------------------------------------------
    function Na__FileParity__AdoptWriteResponse(key, response) {
        if (!key || !response || !response.headers) return null;
        const version = response.headers.get(Na__FileParity__HEADER_VERSION);
        if (!version) return null;                                                    // <-- A server from before the guard: nothing to adopt
        const mtime = Number(response.headers.get(Na__FileParity__HEADER_MTIME));
        Na__FileParity__NoteOwnWrite(key, version, Number.isFinite(mtime) ? mtime : null);
        return version;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Server Refused a Write Because the File Moved (409)
    // ------------------------------------------------------------
    function Na__FileParity__NoteRefused(key, answer) {
        Na__FileParity__Announce('refused', Na__FileParity__NormaliseKey(key), { answer : answer || null });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Browser Drafts: May This One Simply Come Back?
// -----------------------------------------------------------------------------

    // FUNCTION | 'restore' or 'ask', for a Draft of One File
    // ------------------------------------------------------------
    // draft: { savedAt, fileVersion } - fileVersion is the baseline the draft
    // was written against; drafts from before the guard have none.
    //
    // THE FAULT IT CLOSES. A draft is put back over whatever the load brought
    // in. When an agent changed the file in between, the agent's work vanished
    // from the window, the window's baseline was the agent's version, and the
    // next save wrote the draft over it without a single warning.
    //
    //   no baseline yet (web build, older server)         restore, as before
    //   draft made against the version on disk            restore
    //   disk moved, but this browser wrote what is there  restore (it saved since)
    //   disk moved by someone else                        ask
    //   old draft (no version) older than the file        ask, unless this browser wrote it
    // ------------------------------------------------------------
    function Na__FileParity__DraftVerdict(key, draft) {
        const base = Na__FileParity__Baseline(key);
        if (!base || !base.version || base.version === Na__FileParity__MISSING) return 'restore';
        const drafted = (draft && typeof draft.fileVersion === 'string' && draft.fileVersion) ? draft.fileVersion : null;
        if (drafted) {
            if (drafted === base.version) return 'restore';
            return Na__FileParity__IsOwnVersion(key, base.version) ? 'restore' : 'ask';
        }
        const savedAt = Number(draft && draft.savedAt) || 0;
        if (base.mtimeMs && savedAt && base.mtimeMs > savedAt + Na__FileParity__CLOCK_SLACK_MS) {
            return Na__FileParity__IsOwnVersion(key, base.version) ? 'restore' : 'ask';
        }
        return 'restore';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Decisions Installed by the Watcher
// -----------------------------------------------------------------------------

    // FUNCTION | Install the Watcher's Save Gate and Draft Question
    // ------------------------------------------------------------
    function Na__FileParity__InstallImpl(impl) {
        Na__FileParity__Impl = (impl && typeof impl === 'object') ? impl : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | May a Save of This File Go Ahead: Promise<boolean>
    // ------------------------------------------------------------
    // options: { writesKeys, label }. Resolves true when nothing has moved on
    // disk, or the user chose to overwrite; false when they cancelled or chose
    // to load the new version (the watcher then does that itself once the
    // caller has stepped back). Never rejects: a gate that fails lets the save
    // go, and the server's own guard still stands behind it.
    // ------------------------------------------------------------
    async function Na__FileParity__ConfirmSave(key, options) {
        if (!Na__FileParity__Impl || typeof Na__FileParity__Impl.confirmSave !== 'function') return true;
        try { return (await Na__FileParity__Impl.confirmSave(Na__FileParity__NormaliseKey(key), options || {})) !== false; }
        catch (error) {
            console.warn('[TrueVision3D] Local file parity: the save check failed; saving as before.', error);
            return true;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask Whether a Browser Draft Should Come Back Over a Newer File: Promise<'restore' | 'discard'>
    // ------------------------------------------------------------
    // info: { draftSavedAt, label }. Without the watcher (no modal) the old
    // behaviour stands: the draft comes back.
    // ------------------------------------------------------------
    async function Na__FileParity__AskDraft(key, info) {
        if (!Na__FileParity__Impl || typeof Na__FileParity__Impl.askDraft !== 'function') return 'restore';
        try { return (await Na__FileParity__Impl.askDraft(Na__FileParity__NormaliseKey(key), info || {})) === 'discard' ? 'discard' : 'restore'; }
        catch (error) {
            console.warn('[TrueVision3D] Local file parity: the draft question failed; the draft is restored as before.', error);
            return 'restore';
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local File Parity Registry API
    // ------------------------------------------------------------
    export {
        Na__FileParity__EVENT,
        Na__FileParity__HEADER_VERSION,
        Na__FileParity__HEADER_MTIME,
        Na__FileParity__HEADER_PEEK,
        Na__FileParity__MISSING,
        Na__FileParity__ClientId,
        Na__FileParity__IsAvailable,
        Na__FileParity__Context,
        Na__FileParity__StatementKey,
        Na__FileParity__NormaliseKey,
        Na__FileParity__KeyForFileName,
        Na__FileParity__KeyForUrl,
        Na__FileParity__NoteRead,
        Na__FileParity__NoteOwnWrite,
        Na__FileParity__Acknowledge,
        Na__FileParity__Forget,
        Na__FileParity__Baseline,
        Na__FileParity__BaseVersion,
        Na__FileParity__Baselines__All,
        Na__FileParity__IsOwnVersion,
        Na__FileParity__WriteHeaders,
        Na__FileParity__AdoptWriteResponse,
        Na__FileParity__NoteRefused,
        Na__FileParity__DraftVerdict,
        Na__FileParity__InstallImpl,
        Na__FileParity__ConfirmSave,
        Na__FileParity__AskDraft
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
