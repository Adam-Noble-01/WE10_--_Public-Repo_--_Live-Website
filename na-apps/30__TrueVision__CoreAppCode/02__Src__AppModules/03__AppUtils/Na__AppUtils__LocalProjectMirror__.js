// =============================================================================
// TRUEVISION3D - APP UTILS - LOCAL PROJECT DATA MIRROR
// =============================================================================
//
// FILE       : Na__AppUtils__LocalProjectMirror__.js
// NAMESPACE  : Na__LocalMirror
// MODULE     : Local Project Data Mirror
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Copy saved project JSON onto the repository copies under 30__TrueVision__AppContent
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - R2 is the project's source of truth. The repository copy of
//   TrueVision__ProjectData__.json is its local mirror: the ProjectVision build
//   sync pulls the dev-owned keys down into it, and this module does the same at
//   the moment of a save, so what the app has just written to R2 is on disk too.
// - READ, MERGE, WRITE - THE LOCAL HALF OF THE WORKER'S JOB. The file is read
//   fresh from disk, the saved top-level keys replace their old values, and the
//   whole document goes back through the ProjectVision local server's
//   POST /api/projects/<code>. Every other key stays exactly as the file has it,
//   so model groups a build regenerated while the app was open are never put
//   back to the copy the app loaded.
// - SIBLING FILES. TrueVision__DrawingNotes__.json sits beside the project data
//   and is written WHOLE (WriteSiblingFile), never merged. That is the copy an
//   agent can edit on disk. POST /api/projects/<code>/files/<fileName>.
// - LOCALHOST ONLY. The web build has no local copy; there the result reports
//   skipped, and the caller says the save went to R2.
// - NEVER THROWS. R2 already holds the save when this runs, so a failure here
//   is reported and can never undo or hide that save.
// - THE DRAWINGS SAVE GUARD. The local server fingerprints the drawings block
//   on disk (DrawingsFingerprint: { savedIso, digest }). A merge that says
//   which fingerprint it was built on (options.drawingsBase) is refused with
//   a conflict when the block on disk has since become something else - a
//   save from another window, an agent's edit on the file, a git checkout -
//   so one window can no longer put another's sheets back unseen. The server
//   also keeps a copy of every file it overwrites (its /backups route).
//
// INTEGRATION:
// - Na__DrawView__ProjectData__ calls Na__LocalMirror__MergeKeys after every
//   drawings save that reached R2: Save Sheets, the structural auto save, renames -
//   and DrawingsFingerprint as a project loads and before each save.
// - Na__LayoutEditor__SpecData__ calls Na__LocalMirror__WriteSiblingFile after
//   a specification Sync, and to seed the local drawing-notes file on load.
// - Needs the ProjectVision local server (na-apps/ProjectVision__LocalServer__Main__.py),
//   which serves the app and owns the write route. A plain static server answers
//   the POST with 501, reported as no local save server. The ProjectVision
//   server answers 405 instead when a route is newer than the running server:
//   started without --debug it never reloads, so that is reported as a restart.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - DrawingsFingerprint: what the drawings block on disk is, from the local
//   server's drawings-fingerprint route; unsupported on a server running from
//   before the route. MergeKeys takes options.drawingsBase and sends it as
//   X-TrueVision-Drawings-Base; a 409 comes back as conflict true with the
//   fingerprint on disk, and a merge that landed carries the fingerprint
//   written and the backup the server kept. Every other result is as before.
//
// 14-Sep-2026 - Version 1.1.1
// - A 405 from the ProjectVision local server itself (its /api/health answers)
//   now says to restart it. A server started before the drawing-notes route
//   existed refused the notes save with 405, and the warning said to serve the
//   app with that same server.
//
// 14-Sep-2026 - Version 1.1.0
// - WriteSiblingFile: whole-file write of TrueVision__DrawingNotes__.json
//   through POST /api/projects/<code>/files/<fileName>.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: Save Sheets saves to R2 and locally.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project URL Utilities
    // ------------------------------------------------------------
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectCodeFromUrl,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from './Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Repository Path Components (mirror Na__AppUtils__ProjectLoader)
    // ------------------------------------------------------------
    const Na__LocalMirror__PortalDir    = 'na-project-portal';                  // <-- Repository folder the project data lives under
    const Na__LocalMirror__TvContentDir = '30__TrueVision__AppContent';         // <-- Per-project TrueVision content folder
    const Na__LocalMirror__TvDataFile     = 'TrueVision__ProjectData__.json';     // <-- The project data file
    const Na__LocalMirror__SiblingFiles   = [                                      // <-- Whole documents beside the project data
        'TrueVision__DrawingNotes__.json',
        'TrueVision__StatementDocs__.json'                                         // <-- The Statement Writer's index of the project's written documents
    ];
    const Na__LocalMirror__ServerService  = 'na-projectvision-local-dev';          // <-- The name the ProjectVision local server gives in /api/health
    const Na__LocalMirror__DrawingsBaseHeader = 'X-TrueVision-Drawings-Base';      // <-- The drawings fingerprint a save was built on (the server's DRAWINGS_BASE_HEADER)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Result: { ok, skipped, error }
    // ------------------------------------------------------------
    function Na__LocalMirror__Result(ok, skipped, error) {
        return { ok : ok === true, skipped : skipped === true, error : error || null };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Repository Copy Is Read From and Written To
    // ------------------------------------------------------------
    // Null when the URL names no project. The folder and year go on the write
    // as query parameters, which is how the local server finds the file.
    // ------------------------------------------------------------
    function Na__LocalMirror__Locate() {
        const projectCode   = Na__AppUtils__GetProjectCodeFromUrl();
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        const yearCode      = Na__AppUtils__GetYearFromUrl();
        if (!projectCode || !projectFolder) return null;

        const origin = window.location.origin;
        const query  = new URLSearchParams({ 'project-folder' : projectFolder, year : yearCode });
        const folder = `${origin}/${Na__LocalMirror__PortalDir}/${yearCode}-Projects/${projectFolder}`
                     + `/${Na__LocalMirror__TvContentDir}`;
        return {
            origin   : origin,
            folder   : folder,
            fileUrl  : `${folder}/${Na__LocalMirror__TvDataFile}`,
            writeUrl : `${origin}/api/projects/${encodeURIComponent(projectCode)}?${query.toString()}`,
            query    : query.toString(),
            code     : projectCode
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the ProjectVision Local Server the One Answering
    // ------------------------------------------------------------
    // Asked only after a refused write, to tell a server that needs a restart
    // from a static server that cannot save at all. Never throws.
    // ------------------------------------------------------------
    async function Na__LocalMirror__IsProjectVisionServer(origin) {
        try {
            const response = await fetch(`${origin}/api/health`, { cache : 'no-store' });
            const health   = response.ok ? await response.json().catch(() => null) : null;
            return !!(health && health.service === Na__LocalMirror__ServerService);
        } catch (error) {
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | POST JSON to the Local Server; Never Throws
    // ------------------------------------------------------------
    // headers (optional): extra request headers. A save the server refused as
    // a conflict (409: the drawings on disk are not the ones the window
    // loaded) comes back with conflict true and the fingerprint on disk in
    // drawings; a save that landed carries the fingerprint written and the
    // backup the server kept, so the caller can take the file's new identity
    // without asking for it again.
    // ------------------------------------------------------------
    async function Na__LocalMirror__PostJson(url, origin, payload, headers) {
        try {
            const response = await fetch(url, {
                method  : 'POST',
                headers : Object.assign({ 'Content-Type' : 'application/json' }, headers || {}),
                body    : JSON.stringify(payload)
            });
            const answer = await response.json().catch(() => null);                                  // <-- The local server answers in JSON; a static server does not
            if (response.ok) {
                const result = Na__LocalMirror__Result(true, false, null);
                if (answer && answer.drawings) result.drawings = answer.drawings;
                if (answer && typeof answer.backup === 'string') result.backup = answer.backup;
                return result;
            }
            if (response.status === 409 && answer && answer.conflict) {
                const result = Na__LocalMirror__Result(false, false, answer.error || 'the drawings on disk are not the ones this window loaded');
                result.conflict = true;
                result.drawings = answer.drawings || null;
                return result;
            }
            if (answer && answer.error) return Na__LocalMirror__Result(false, false, answer.error);
            if (response.status === 405 && await Na__LocalMirror__IsProjectVisionServer(origin)) {    // <-- The right server, running from before this route: it never reloads its routes
                return Na__LocalMirror__Result(false, false, `the ProjectVision local server at ${origin} refused this write (405): it is running without this route - restart it to load its current routes`);
            }
            return Na__LocalMirror__Result(false, false, `no local save server at ${origin} (${response.status}) - serve the app with the ProjectVision local server`);
        } catch (error) {
            return Na__LocalMirror__Result(false, false, `the local server did not answer (${(error && error.message) || 'no answer'})`);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Merge Top-Level Keys Into the Repository Copy of the Project Data
    // ------------------------------------------------------------
    // partialObject: { KeyName: value, ... } - the keys the save wrote to R2.
    // options (optional): { drawingsBase } - the drawings fingerprint this
    // window loaded (DrawingsFingerprint), or null for a project that had no
    // drawings block. Given, it rides as X-TrueVision-Drawings-Base and the
    // server refuses the write when the block on disk is no longer that one:
    // the result then has conflict true. Left out, the write is not judged -
    // a save of other keys leaves the block as it found it on disk.
    // Resolves to { ok, skipped, error, conflict?, drawings?, backup? };
    // never rejects.
    // ------------------------------------------------------------
    let Na__LocalMirror__MergeQueue = Promise.resolve();
    function Na__LocalMirror__MergeKeys(partialObject, options) {
        const snapshot = JSON.parse(JSON.stringify(partialObject || null));
        const opts     = Object.assign({}, options || {});
        const job = Na__LocalMirror__MergeQueue.then(() => Na__LocalMirror__MergeKeysNow(snapshot, opts));
        Na__LocalMirror__MergeQueue = job.catch(() => {});
        return job;
    }
    async function Na__LocalMirror__MergeKeysNow(partialObject, options) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Na__LocalMirror__Result(false, true, null);   // <-- The web build has no local copy
        if (!partialObject || typeof partialObject !== 'object') return Na__LocalMirror__Result(false, false, 'nothing to write');

        const place = Na__LocalMirror__Locate();
        if (!place) return Na__LocalMirror__Result(false, false, 'no project in the URL');

        // READ | The file as it is on disk now, never the copy the app loaded
        let onDisk = null;
        try {
            const response = await fetch(place.fileUrl, { cache : 'no-store' });
            if (!response.ok) return Na__LocalMirror__Result(false, false, `the local project data file could not be read (${response.status})`);
            onDisk = await response.json();
        } catch (error) {
            return Na__LocalMirror__Result(false, false, `the local project data file could not be read (${(error && error.message) || 'no answer'})`);
        }
        if (!onDisk || typeof onDisk !== 'object' || Array.isArray(onDisk)) {
            return Na__LocalMirror__Result(false, false, 'the local project data file is not a JSON object');
        }

        // WRITE | The saved keys over the file's own, through the local server
        const merged  = Object.assign({}, onDisk, partialObject);
        const headers = {};
        if (options && options.drawingsBase !== undefined) headers[Na__LocalMirror__DrawingsBaseHeader] = options.drawingsBase || 'none';   // <-- null: the project had no drawings block when it was loaded
        return Na__LocalMirror__PostJson(place.writeUrl, place.origin, merged, headers);
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Drawings Block on Disk Is Right Now
    // ------------------------------------------------------------
    // Resolves to { ok, skipped, unsupported, error, drawings }, where
    // drawings is { savedIso, digest } as the local server computes it:
    // digest 'sha1:...' of the block's canonical JSON, null when the file has
    // no block. Asked as a project loads, so a save can say what it was built
    // on, and again just before a save, so a block changed since - by another
    // window, an agent on the file, a git checkout - is found before R2 is
    // written. unsupported is a ProjectVision server running from before this
    // route (it never reloads its routes): the caller saves unjudged, as it
    // always did, rather than refusing to save at all. Never rejects.
    // ------------------------------------------------------------
    async function Na__LocalMirror__DrawingsFingerprint() {
        const none = { ok : false, skipped : false, unsupported : false, error : null, drawings : null };
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Object.assign(none, { skipped : true });
        const place = Na__LocalMirror__Locate();
        if (!place) return Object.assign(none, { error : 'no project in the URL' });
        try {
            const response = await fetch(`${place.origin}/api/projects/${encodeURIComponent(place.code)}/drawings-fingerprint?${place.query}`, { cache : 'no-store' });
            const answer   = await response.json().catch(() => null);
            if (response.ok && answer && answer.drawings && typeof answer.drawings === 'object') {
                return Object.assign(none, { ok : true, drawings : { savedIso : answer.drawings.savedIso || null, digest : answer.drawings.digest || null } });
            }
            if (response.status === 404 || response.status === 405) {
                if (!(answer && answer.error)) return Object.assign(none, { unsupported : true, error : `the server at ${place.origin} has no drawings-fingerprint route - restart the ProjectVision local server` });
                return Object.assign(none, { error : answer.error });                                 // <-- The route exists: the project itself was not found
            }
            return Object.assign(none, { error : (answer && answer.error) || `the fingerprint could not be read (${response.status})` });
        } catch (error) {
            return Object.assign(none, { error : `the local server did not answer (${(error && error.message) || 'no answer'})` });
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Whole Sibling File Into the Repository Copy
    // ------------------------------------------------------------
    // fileName: an allowed sibling (TrueVision__DrawingNotes__.json).
    // dataObject: the complete document. Resolves to { ok, skipped, error };
    // never rejects. Creates the file when the folder has none yet.
    // ------------------------------------------------------------
    async function Na__LocalMirror__WriteSiblingFile(fileName, dataObject) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Na__LocalMirror__Result(false, true, null);
        if (Na__LocalMirror__SiblingFiles.indexOf(fileName) === -1) return Na__LocalMirror__Result(false, false, `refused local file "${fileName}"`);
        if (!dataObject || typeof dataObject !== 'object' || Array.isArray(dataObject)) {
            return Na__LocalMirror__Result(false, false, 'nothing to write');
        }

        const place = Na__LocalMirror__Locate();
        if (!place) return Na__LocalMirror__Result(false, false, 'no project in the URL');

        const writeUrl = `${place.origin}/api/projects/${encodeURIComponent(place.code)}/files/${encodeURIComponent(fileName)}?${place.query}`;
        return Na__LocalMirror__PostJson(writeUrl, place.origin, dataObject);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Statement Files (a folder of markdown and pictures, not one document)
// -----------------------------------------------------------------------------

    // FUNCTION | List Everything Under the Project's Statements Folder
    // ------------------------------------------------------------
    // A static server cannot list a folder, so the ProjectVision local server
    // answers this one. Resolves to { ok, entries, exists, error }; never
    // rejects. Off localhost it reports skipped, and the caller falls back to
    // what the statement index already knows.
    // ------------------------------------------------------------
    async function Na__LocalMirror__StatementTree() {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return { ok : false, skipped : true, entries : [], error : null };
        const place = Na__LocalMirror__Locate();
        if (!place) return { ok : false, skipped : false, entries : [], error : 'no project in the URL' };

        try {
            const response = await fetch(`${place.origin}/api/truevision/statements/tree?${place.query}`, { cache : 'no-store' });
            if (!response.ok) {
                const answer = await response.json().catch(() => null);

                // A SERVER THAT NEVER LOADED THESE ROUTES LOOKS EXACTLY LIKE A
                // PROJECT WITH NO STATEMENTS, and that is the worst answer the
                // tab can give: it reads "no statements yet" over a folder that
                // holds one, and offers to make a second 01__ folder beside it.
                // The listing route is a GET, so a server without it does not
                // even answer 405 - the static file route takes the URL and
                // answers 404. So the server is asked who it is instead.
                const needsRestart = await Na__LocalMirror__IsProjectVisionServer(place.origin);
                return {
                    ok            : false,
                    skipped       : false,
                    entries       : [],
                    needsRestart  : needsRestart,
                    error         : needsRestart
                        ? `the ProjectVision local server at ${place.origin} is running without the statement routes - restart it to load its current routes`
                        : ((answer && answer.error) || `no statement routes at ${place.origin} (HTTP ${response.status}) - serve the app with the ProjectVision local server`)
                };
            }
            const data = await response.json();
            return { ok : true, skipped : false, exists : data.exists !== false, entries : Array.isArray(data.entries) ? data.entries : [], error : null };
        } catch (error) {
            return { ok : false, skipped : false, entries : [], error : (error && error.message) || 'no answer' };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | POST to One of the Statement Routes
    // ------------------------------------------------------------
    async function Na__LocalMirror__StatementPost(route, payload) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return Na__LocalMirror__Result(false, true, null);
        const place = Na__LocalMirror__Locate();
        if (!place) return Na__LocalMirror__Result(false, false, 'no project in the URL');
        return Na__LocalMirror__PostJson(
            `${place.origin}/api/truevision/statements/${route}?${place.query}`,
            place.origin,
            payload
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Write One Statement Text File Into the Project Folder
    // ------------------------------------------------------------
    // path is relative to 10__StatementDocs, e.g.
    // "01__PreApp__Statement/RB05_T01_S01__WestFarm__PreApplicationStatement__.md".
    // ------------------------------------------------------------
    async function Na__LocalMirror__WriteStatementFile(path, text) {
        if (typeof text !== 'string') return Na__LocalMirror__Result(false, false, 'nothing to write');
        return Na__LocalMirror__StatementPost('file', { path : path, text : text });
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Folder Under the Project's Statements Folder
    // ------------------------------------------------------------
    async function Na__LocalMirror__MakeStatementFolder(path) {
        return Na__LocalMirror__StatementPost('folder', { path : path });
    }
    // ------------------------------------------------------------


    // FUNCTION | Move or Rename Something Inside the Statements Folder
    // ------------------------------------------------------------
    async function Na__LocalMirror__MoveStatement(fromPath, toPath) {
        return Na__LocalMirror__StatementPost('move', { from : fromPath, to : toPath });
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Statement File or Folder
    // ------------------------------------------------------------
    // The server asks for the path twice - once as the instruction and once as
    // the confirmation - because this one takes a folder of writing with it.
    // ------------------------------------------------------------
    async function Na__LocalMirror__DeleteStatement(path) {
        return Na__LocalMirror__StatementPost('delete', { path : path, confirm : path });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local Project Data Mirror API
    // ------------------------------------------------------------
    export {
        Na__LocalMirror__MergeKeys,
        Na__LocalMirror__DrawingsFingerprint,
        Na__LocalMirror__WriteSiblingFile,
        Na__LocalMirror__StatementTree,
        Na__LocalMirror__WriteStatementFile,
        Na__LocalMirror__MakeStatementFolder,
        Na__LocalMirror__MoveStatement,
        Na__LocalMirror__DeleteStatement
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
