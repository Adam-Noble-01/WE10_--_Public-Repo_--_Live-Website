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
//
// INTEGRATION:
// - Na__DrawView__ProjectData__ calls Na__LocalMirror__MergeKeys after every
//   drawings save that reached R2: Save Sheets, the structural auto save, renames.
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
    const Na__LocalMirror__SiblingFiles   = [ 'TrueVision__DrawingNotes__.json' ]; // <-- Whole documents beside the project data
    const Na__LocalMirror__ServerService  = 'na-projectvision-local-dev';          // <-- The name the ProjectVision local server gives in /api/health
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
    async function Na__LocalMirror__PostJson(url, origin, payload) {
        try {
            const response = await fetch(url, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(payload)
            });
            if (response.ok) return Na__LocalMirror__Result(true, false, null);

            const answer = await response.json().catch(() => null);                                  // <-- The local server answers in JSON; a static server does not
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
    // Resolves to { ok, skipped, error }; never rejects.
    // ------------------------------------------------------------
    let Na__LocalMirror__MergeQueue = Promise.resolve();
    function Na__LocalMirror__MergeKeys(partialObject) {
        const snapshot = JSON.parse(JSON.stringify(partialObject || null));
        const job = Na__LocalMirror__MergeQueue.then(() => Na__LocalMirror__MergeKeysNow(snapshot));
        Na__LocalMirror__MergeQueue = job.catch(() => {});
        return job;
    }
    async function Na__LocalMirror__MergeKeysNow(partialObject) {
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
        const merged = Object.assign({}, onDisk, partialObject);
        return Na__LocalMirror__PostJson(place.writeUrl, place.origin, merged);
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
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Local Project Data Mirror API
    // ------------------------------------------------------------
    export {
        Na__LocalMirror__MergeKeys,
        Na__LocalMirror__WriteSiblingFile
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
