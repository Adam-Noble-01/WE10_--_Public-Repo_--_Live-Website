// =============================================================================
// TRUEVISION3D - SCENE SYNC - STORE
// =============================================================================
//
// FILE       : Na__SceneSync__Store__.js
// NAMESPACE  : Na__SsStore
// MODULE     : Scene Sync - Store
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the project's synced SketchUp scenes, once, as a project loads
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - ONE FILE: 30__TrueVision__AppContent/SceneSync__SketchUpSceneData/
//   TrueVision__SceneSyncData__Manifest__.json, written whole by every sync
//   in TrueVision Sync (the GLB Builder's Scene Sync tab).
// - WHERE IT IS READ FROM. It changes with every sync, so it is always asked
//   of the network ('no-store').
//   - Localhost, the authoring machine: the repository copy first (a sync
//     writes it there at once, before any build or push), then the CDN.
//   - Anywhere else: the CDN, only at the URL the ProjectVision build
//     registered in the project data (SceneSync__DataStore), so a project
//     that has never synced a scene makes no request at all.
// - ONCE PER LOAD. The loading sequence starts the read as soon as the
//   project data is in, alongside the models, and waits for it (briefly,
//   see Settle) before it hands the drawings and scenes to the app: the
//   synced records are then there from the first moment, like any other.
//   A read that comes back after that wait is kept for the next load only.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (Scene Sync, TrueVision v2.174.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Project URL and the Manifest Reader
    // ------------------------------------------------------------
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__SceneSync__ReadManifest } from './Na__SceneSync__Records__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Paths and the Project Data Key (mirror the GLB Builder and the build)
    // ------------------------------------------------------------
    const Na__SsStore__DATA_KEY    = 'SceneSync__DataStore';
    const Na__SsStore__CDN_BASE    = 'https://cdn.noble-architecture.com/NaProjectPortal';
    const Na__SsStore__PORTAL_DIR  = 'na-project-portal';
    const Na__SsStore__CONTENT_DIR = '30__TrueVision__AppContent';
    const Na__SsStore__FOLDER      = 'SceneSync__SketchUpSceneData';
    const Na__SsStore__MANIFEST    = 'TrueVision__SceneSyncData__Manifest__.json';
    const Na__SsStore__FOLDER_RE   = /^[A-Za-z0-9_-]{1,96}$/;                   // <-- Nothing else is ever put in a URL
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status
    // ------------------------------------------------------------
    const Na__SsStore__STATUS_IDLE       = 'idle';                               // <-- Not asked yet
    const Na__SsStore__STATUS_LOADING    = 'loading';
    const Na__SsStore__STATUS_READY      = 'ready';                              // <-- A manifest was read (it may list no scenes)
    const Na__SsStore__STATUS_NONE       = 'none';                               // <-- This project has no synced scenes
    const Na__SsStore__STATUS_UNREADABLE = 'unreadable';                         // <-- A file was found, but it is not one this app can read
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__SsStore__Status   = Na__SsStore__STATUS_IDLE;
    let Na__SsStore__Manifest = null;
    let Na__SsStore__Url      = null;
    let Na__SsStore__Note     = null;
    let Na__SsStore__Pending  = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The URLs to Try, In Order
    // ------------------------------------------------------------
    function Na__SsStore__Urls(projectData) {
        const urls   = [];
        const folder = Na__AppUtils__GetProjectFolderFromUrl();
        const year   = Na__AppUtils__GetYearFromUrl();
        if (Na__AppUtils__IsRunningOnLocalhost() && folder && Na__SsStore__FOLDER_RE.test(folder) && year && Na__SsStore__FOLDER_RE.test(String(year))) {
            urls.push(`${window.location.origin}/${Na__SsStore__PORTAL_DIR}/${year}-Projects/${folder}/${Na__SsStore__CONTENT_DIR}/${Na__SsStore__FOLDER}/${Na__SsStore__MANIFEST}`);
        }
        const block = projectData && typeof projectData === 'object' ? projectData[Na__SsStore__DATA_KEY] : null;
        const registered = block && typeof block.SceneSync__ManifestUrl === 'string' ? block.SceneSync__ManifestUrl : null;
        if (registered && registered.indexOf(Na__SsStore__CDN_BASE + '/') === 0 && registered.endsWith('/' + Na__SsStore__MANIFEST)) urls.push(registered);
        return urls;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Manifest (once per load; resolves the read manifest or null, never rejects)
    // ------------------------------------------------------------
    function Na__SsStore__Load(projectData) {
        if (Na__SsStore__Pending) return Na__SsStore__Pending;
        Na__SsStore__Pending = (async () => {
            const urls = Na__SsStore__Urls(projectData);
            if (!urls.length) { Na__SsStore__Status = Na__SsStore__STATUS_NONE; return null; }
            Na__SsStore__Status = Na__SsStore__STATUS_LOADING;
            let unreadable = null;
            for (const url of urls) {
                try {
                    const response = await fetch(url, { cache : 'no-store' });
                    if (!response.ok) continue;                                  // <-- Not on this machine (or not published yet): the next place
                    const manifest = Na__SceneSync__ReadManifest(await response.json());
                    if (!manifest) { unreadable = url; continue; }
                    Na__SsStore__Status   = Na__SsStore__STATUS_READY;
                    Na__SsStore__Manifest = manifest;
                    Na__SsStore__Url      = url;
                    return manifest;
                } catch (error) {
                    console.warn('[TrueVision3D SceneSync] Could not read ' + url, error);
                }
            }
            Na__SsStore__Status = unreadable ? Na__SsStore__STATUS_UNREADABLE : Na__SsStore__STATUS_NONE;
            Na__SsStore__Note   = unreadable ? 'The synced SketchUp scenes were written by a newer TrueVision Sync, or the file is damaged.' : null;
            return null;
        })();
        return Na__SsStore__Pending;
    }
    // ------------------------------------------------------------


    // FUNCTION | Wait for the Read, but Never Longer Than ms (resolves the manifest, or null)
    // ------------------------------------------------------------
    // A slow network must not hold the whole app up: past the wait the
    // project opens without its synced scenes, and says so.
    // ------------------------------------------------------------
    async function Na__SsStore__Settle(ms) {
        if (!Na__SsStore__Pending) return Na__SsStore__Manifest;
        let timer = null;
        const late = new Promise((resolve) => { timer = setTimeout(() => resolve('late'), Math.max(0, ms || 0)); });
        const result = await Promise.race([ Na__SsStore__Pending, late ]);
        clearTimeout(timer);
        if (result === 'late') {
            Na__SsStore__Note = 'The synced SketchUp scenes did not arrive in time. Reload the page to use them.';
            console.warn('[TrueVision3D SceneSync] ' + Na__SsStore__Note);
            return null;
        }
        return result;
    }
    // ------------------------------------------------------------


    // FUNCTION | Accessors
    // ------------------------------------------------------------
    function Na__SsStore__GetStatus()   { return Na__SsStore__Status; }
    function Na__SsStore__GetManifest() { return Na__SsStore__Manifest; }
    function Na__SsStore__GetUrl()      { return Na__SsStore__Url; }
    function Na__SsStore__GetNote()     { return Na__SsStore__Note; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Sync Store API
    // ------------------------------------------------------------
    export {
        Na__SsStore__STATUS_IDLE,
        Na__SsStore__STATUS_LOADING,
        Na__SsStore__STATUS_READY,
        Na__SsStore__STATUS_NONE,
        Na__SsStore__STATUS_UNREADABLE,
        Na__SsStore__Load,
        Na__SsStore__Settle,
        Na__SsStore__GetStatus,
        Na__SsStore__GetManifest,
        Na__SsStore__GetUrl,
        Na__SsStore__GetNote
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
