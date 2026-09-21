// =============================================================================
// TRUEVISION3D - CLOUDFLARE INTEGRATION - R2 API CLIENT
// =============================================================================
//
// FILE       : Na__CloudflareIntegration__ApiClient__.js
// NAMESPACE  : Na__CfApi
// MODULE     : Cloudflare R2 API Client
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Realtime read/merge/write of project data and presentation scene
//              thumbnails to Cloudflare R2 via the na-truevision-api Worker
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Central client used by every Dev-menu save action (camera, navigation modes,
//   orbit max distance, fog, presentation scenes + thumbnails).
// - Uses the na-truevision-api Worker /r2/read and /r2/write endpoints, which
//   operate on the shared noble-architecture-cdn bucket under the NaProjectPortal/
//   prefix - exactly where TrueVision reads TrueVision__ProjectData__.json from.
// - Saving writes straight to R2 so the live app reads the change back from R2;
//   no GitHub push is required (this is the key difference from ValeVision, which
//   uses a localhost Flask server + GitHub Pages static reads).
// - All object keys are derived from the URL query (?project-folder= and ?year=)
//   so callers do not need to construct R2 keys themselves.
//
// INTEGRATION:
// - Call Na__CfApi__Initialize(workerBaseUrl) from index.html after the app
//   config loads (CloudflareConfig.workerBaseUrl).
// - Dev modules call Na__CfApi__MergeAndSaveKeys / Na__CfApi__DeleteProjectKeys /
//   Na__CfApi__WriteThumbnailWebp.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.5.0
// - Sheet Images: SheetImageLocation, ListSheetImages, UploadSheetImage,
//   CopySheetImage and DeleteSheetImage for the pictures placed on Layout
//   Editor sheets, in 05__Layout__DrawingDocs__Images/<document id>/. Uploads
//   go through the Worker's new /r2/upload (raw bytes, immutable cache
//   header) and copies through /r2/copy; a Worker deployed before them is
//   detected once and every call falls back to /r2/write for the session.
//
// 20-Sep-2026 - Version 1.4.0
// - PlanVision project data: PlansFileLocation points at the project's
//   20__PlanVision__AppContent folder so the Layout Editor has somewhere to
//   read the site address from on a project with no quotation. Read only, and
//   by name, on the same terms as the admin files.
//
// 19-Sep-2026 - Version 1.3.0
// - Project admin files: AdminFileLocation points at the project's
//   10__ProjectAdmin__AppContent folder so the Layout Editor can read the site
//   address and the client's drawing name off the admin record. Read only, and
//   by name - the admin system owns those documents.
//
// 14-Sep-2026 - Version 1.2.0
// - Project sibling files: TrueVision__DrawingNotes__.json is the canonical
//   drawing-notes document. TrueVision__ProjectSpecification__.json stays on
//   the allow-list so an existing R2 copy can still be read until Sync writes
//   the new name.
//
// 14-Sep-2026 - Version 1.1.0
// - Project sibling files: ProjectFileLocation, ReadProjectFile and
//   WriteProjectFile read and write a WHOLE JSON document that sits beside
//   TrueVision__ProjectData__.json rather than inside it - the Layout Editor's
//   project specification first. Allowed by name only.
//
// 21-Jun-2026 - Version 1.0.0
// - Initial implementation for the ValeVision parity transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project URL Utilities
    // ------------------------------------------------------------
    import {
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl,
        Na__AppUtils__GetProjectCodeFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | R2 Key Path Components (mirror Na__AppUtils__ProjectLoader)
    // ------------------------------------------------------------
    const Na__CfApi__R2Prefix       = 'NaProjectPortal';                       // <-- Bucket prefix (matches worker R2_PREFIX guard)
    const Na__CfApi__TvContentDir   = '30__TrueVision__AppContent';            // <-- Per-project TrueVision content folder
    const Na__CfApi__TvDataFilename = 'TrueVision__ProjectData__.json';        // <-- Project data file TrueVision reads
    const Na__CfApi__ThumbsDir      = 'PresentationMode/Thumbnails';           // <-- Presentation scene thumbnail folder (relative)
    const Na__CfApi__CdnBaseUrl     = 'https://cdn.noble-architecture.com';    // <-- Public CDN base for resolved asset URLs
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Worker Base URL (set at init from app config)
    // ------------------------------------------------------------
    let Na__CfApi__WorkerBaseUrl = null;   // <-- e.g. https://na-truevision-api.adam-fb3.workers.dev
    // ------------------------------------------------------------

    // MODULE VARIABLES | In-Memory Full Project Data (merge base for saves)
    // ------------------------------------------------------------
    // The loading sequence registers the full project data object the app
    // actually loaded. Dev-menu saves merge changed keys into THIS object and
    // write the whole document to R2, so model groups / camera / etc. are never
    // dropped - even if R2 has no copy of the file yet (first save).
    let Na__CfApi__LoadedProjectData = null;   // <-- Full project data the app is currently running
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization & Context
// -----------------------------------------------------------------------------

    // FUNCTION | Store the Worker Base URL from App Config
    // ------------------------------------------------------------
    function Na__CfApi__Initialize(workerBaseUrl) {
        Na__CfApi__WorkerBaseUrl = (typeof workerBaseUrl === 'string' && workerBaseUrl.length > 0)
            ? workerBaseUrl.replace(/\/+$/, '')                              // <-- Trim any trailing slash
            : null;
        if (!Na__CfApi__WorkerBaseUrl) {
            console.warn('[TrueVision3D] CfApi initialised without a worker base URL - R2 saves disabled.');
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Client Configured for Saving?
    // ------------------------------------------------------------
    function Na__CfApi__IsConfigured() {
        return Boolean(Na__CfApi__WorkerBaseUrl);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Full Project Data the App Loaded (merge base)
    // ------------------------------------------------------------
    function Na__CfApi__SetLoadedProjectData(projectData) {
        Na__CfApi__LoadedProjectData = (projectData && typeof projectData === 'object') ? projectData : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Registered Full Project Data (or null)
    // ------------------------------------------------------------
    function Na__CfApi__GetLoadedProjectData() {
        return Na__CfApi__LoadedProjectData;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read Project Folder / Year / Code from URL Query
    // ------------------------------------------------------------
    function Na__CfApi__GetProjectContext() {
        return {
            projectFolder : Na__AppUtils__GetProjectFolderFromUrl(),
            yearCode      : Na__AppUtils__GetYearFromUrl(),
            projectCode   : Na__AppUtils__GetProjectCodeFromUrl()
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | R2 Key Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Project Data R2 Object Key
    // ------------------------------------------------------------
    function Na__CfApi__BuildProjectDataKey(projectFolder, yearCode) {
        const yearFolderName = `${yearCode}-Projects`;
        return `${Na__CfApi__R2Prefix}/${yearFolderName}/${projectFolder}`
             + `/${Na__CfApi__TvContentDir}/${Na__CfApi__TvDataFilename}`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Presentation Thumbnail R2 Object Key
    // ------------------------------------------------------------
    function Na__CfApi__BuildThumbnailKey(projectFolder, yearCode, sceneId) {
        const yearFolderName = `${yearCode}-Projects`;
        return `${Na__CfApi__R2Prefix}/${yearFolderName}/${projectFolder}`
             + `/${Na__CfApi__TvContentDir}/${Na__CfApi__ThumbsDir}/${sceneId}.webp`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Public CDN URL for a Project-Relative Asset
    // ------------------------------------------------------------
    // relativePath example: "PresentationMode/Thumbnails/Scene_001.webp"
    // ------------------------------------------------------------
    function Na__CfApi__BuildContentCdnUrl(projectFolder, yearCode, relativePath) {
        const yearFolderName = `${yearCode}-Projects`;
        return `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${yearFolderName}/${projectFolder}`
             + `/${Na__CfApi__TvContentDir}/${relativePath}`;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Low-Level R2 Operations
// -----------------------------------------------------------------------------

    // FUNCTION | Read an Object from R2 by Key (bypasses CDN cache)
    // ------------------------------------------------------------
    async function Na__CfApi__ReadKey(key) {
        if (!Na__CfApi__IsConfigured()) {
            return { ok: false, error: 'Worker not configured' };
        }

        try {
            const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/read`, {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify({ key })
            });

            if (response.status === 404) {
                return { ok: true, data: null, missing: true };             // <-- Key not present yet (first save)
            }
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return { ok: false, error: err.error || `Read failed (${response.status})` };
            }

            const result = await response.json();
            return { ok: true, data: result.data, encoding: result.encoding };
        } catch (error) {
            console.error('[TrueVision3D] CfApi read error:', error);
            return { ok: false, error: 'Worker unreachable' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write an Object to R2 by Key
    // ------------------------------------------------------------
    // payload: { key, data, encoding?, contentType? }
    // - data as object  -> stored as pretty JSON (worker side)
    // - data as base64  -> set encoding:'base64' + contentType
    // ------------------------------------------------------------
    async function Na__CfApi__WriteKey(payload) {
        if (!Na__CfApi__IsConfigured()) {
            return { ok: false, error: 'Worker not configured' };
        }

        try {
            const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/write`, {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return { ok: false, error: err.error || `Write failed (${response.status})` };
            }

            return { ok: true };
        } catch (error) {
            console.error('[TrueVision3D] CfApi write error:', error);
            return { ok: false, error: 'Worker unreachable' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Project Data Read / Merge / Write
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Active Project's TrueVision__ProjectData__.json from R2
    // ------------------------------------------------------------
    async function Na__CfApi__ReadProjectData() {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            return { ok: false, error: 'No project-folder in URL' };
        }

        const key    = Na__CfApi__BuildProjectDataKey(ctx.projectFolder, ctx.yearCode);
        const result = await Na__CfApi__ReadKey(key);
        if (!result.ok) return result;

        return { ok: true, data: result.data || {}, missing: result.missing === true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Full Project Data Object Back to R2
    // ------------------------------------------------------------
    async function Na__CfApi__WriteProjectData(projectDataObject) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            return { ok: false, error: 'No project-folder in URL' };
        }

        const key = Na__CfApi__BuildProjectDataKey(ctx.projectFolder, ctx.yearCode);
        return await Na__CfApi__WriteKey({
            key         : key,
            data        : projectDataObject,
            contentType : 'application/json'
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Full Merge Base (in-memory first, else R2)
    // ------------------------------------------------------------
    // Prefer the full project data the app actually loaded (preserves model
    // groups / camera / everything). Only fall back to reading R2 when the app
    // never registered loaded data (defensive).
    // ------------------------------------------------------------
    async function Na__CfApi__ResolveMergeBase() {
        if (Na__CfApi__LoadedProjectData && typeof Na__CfApi__LoadedProjectData === 'object') {
            return { ok: true, data: JSON.parse(JSON.stringify(Na__CfApi__LoadedProjectData)) }; // <-- Deep clone of loaded data
        }
        const readResult = await Na__CfApi__ReadProjectData();
        if (!readResult.ok) return readResult;
        return { ok: true, data: readResult.data || {} };
    }
    // ------------------------------------------------------------


    // FUNCTION | Merge Top-Level Keys Into Full Data and Write Back (common save path)
    // ------------------------------------------------------------
    // partialObject: { KeyName: value, ... } merged at the document root.
    // ------------------------------------------------------------
    let Na__CfApi__MergeQueue = Promise.resolve();
    function Na__CfApi__MergeAndSaveKeys(partialObject) {
        const snapshot = JSON.parse(JSON.stringify(partialObject));
        const job = Na__CfApi__MergeQueue.then(() => Na__CfApi__MergeAndSaveKeysNow(snapshot));
        Na__CfApi__MergeQueue = job.catch(() => {});
        return job;
    }
    async function Na__CfApi__MergeAndSaveKeysNow(partialObject) {
        const baseResult = await Na__CfApi__ResolveMergeBase();
        if (!baseResult.ok) return baseResult;

        const merged = { ...(baseResult.data || {}), ...partialObject };     // <-- Shallow-merge changed keys at root
        const writeResult = await Na__CfApi__WriteProjectData(merged);
        if (writeResult.ok) Na__CfApi__SetLoadedProjectData(merged);          // <-- Keep in-memory base current for next save
        return writeResult;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete Top-Level Keys From Full Data and Write Back
    // ------------------------------------------------------------
    async function Na__CfApi__DeleteProjectKeys(keyNames) {
        const baseResult = await Na__CfApi__ResolveMergeBase();
        if (!baseResult.ok) return baseResult;

        const merged = { ...(baseResult.data || {}) };
        (keyNames || []).forEach((name) => { delete merged[name]; });        // <-- Remove requested keys
        const writeResult = await Na__CfApi__WriteProjectData(merged);
        if (writeResult.ok) Na__CfApi__SetLoadedProjectData(merged);          // <-- Keep in-memory base current for next save
        return writeResult;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Thumbnail Upload
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert a Blob to a Base64 String (no data: prefix)
    // ------------------------------------------------------------
    function Na__CfApi__BlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result || '';
                const comma  = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : result);     // <-- Strip "data:image/webp;base64," prefix
            };
            reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
            reader.readAsDataURL(blob);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Presentation Scene Thumbnail WebP to R2
    // ------------------------------------------------------------
    // Returns { ok, relUrl } where relUrl is the project-relative path stored
    // in the scene's PresentationMode__Scene__ThumbnailUrl field.
    // ------------------------------------------------------------
    async function Na__CfApi__WriteThumbnailWebp(sceneId, blob) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            return { ok: false, error: 'No project-folder in URL' };
        }

        const base64 = await Na__CfApi__BlobToBase64(blob);
        const key    = Na__CfApi__BuildThumbnailKey(ctx.projectFolder, ctx.yearCode, sceneId);

        const writeResult = await Na__CfApi__WriteKey({
            key         : key,
            data        : base64,
            encoding    : 'base64',
            contentType : 'image/webp'
        });

        if (!writeResult.ok) return writeResult;

        return { ok: true, relUrl: `${Na__CfApi__ThumbsDir}/${sceneId}.webp` };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Any Project-Relative Asset to R2
    // ------------------------------------------------------------
    // The general form of the thumbnail write above, for the drawing systems:
    // baked linework JSON, sheet viewport snapshots, and whatever the Layout
    // Editor needs next.
    //
    // ValeVision needed a whole new Worker route, a path guard, a wrangler
    // deploy and a Flask mirror for this. TrueVision needs none of it: the
    // na-truevision-api Worker already exposes a generic /r2/write over the
    // NaProjectPortal prefix, and the thumbnail path above already proves the
    // base64 binary route works. This is the wrapper and nothing more.
    //
    // relativePath is project-relative, e.g. "LayoutEditor/Linework/x__abc.json".
    // The guard below is not security - the Worker key is the security - it is
    // there to stop a caller writing outside the app's own content folder by
    // accident, which is the mistake that silently corrupts a neighbouring app.
    // ------------------------------------------------------------
    const Na__CfApi__AssetPathPattern = /^(PresentationMode\/Thumbnails|LayoutEditor\/(Linework|Snapshots))\/[A-Za-z0-9_.\-]+\.(webp|png|json)$/;

    async function Na__CfApi__WriteProjectAsset(relativePath, payload, contentType) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            return { ok: false, error: 'No project-folder in URL' };
        }
        if (!Na__CfApi__AssetPathPattern.test(relativePath || '')) {
            return { ok: false, error: `Refused asset path "${relativePath}" - must sit under PresentationMode/Thumbnails, LayoutEditor/Linework or LayoutEditor/Snapshots` };
        }

        // A Blob goes up base64; anything else is treated as JSON.
        let data, encoding, resolvedType;
        if (payload instanceof Blob) {
            data         = await Na__CfApi__BlobToBase64(payload);
            encoding     = 'base64';
            resolvedType = contentType || payload.type || 'application/octet-stream';
        } else {
            data         = payload;
            encoding     = undefined;
            resolvedType = contentType || 'application/json';
        }

        const yearFolderName = `${ctx.yearCode}-Projects`;
        const key = `${Na__CfApi__R2Prefix}/${yearFolderName}/${ctx.projectFolder}`
                  + `/${Na__CfApi__TvContentDir}/${relativePath}`;

        const writeResult = await Na__CfApi__WriteKey({
            key         : key,
            data        : data,
            encoding    : encoding,
            contentType : resolvedType
        });

        if (!writeResult.ok) return writeResult;

        return {
            ok        : true,
            relUrl    : relativePath,
            publicUrl : Na__CfApi__BuildContentCdnUrl(ctx.projectFolder, ctx.yearCode, relativePath)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Project Sibling Files (whole JSON documents beside the project data)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Files Allowed Beside TrueVision__ProjectData__.json
    // ------------------------------------------------------------
    // A document that belongs to the project but is not project data - the
    // Layout Editor's project specification is the first. Each is written WHOLE,
    // never merged: it has one owner module that holds the complete document,
    // which is the point of it being a file of its own rather than another key
    // in the project data. Listed by name, so no caller can write over the
    // project data file, or anything else in the folder, by passing a wrong one.
    // ------------------------------------------------------------
    const Na__CfApi__ProjectFileNames = [
        'TrueVision__DrawingNotes__.json',
        'TrueVision__ProjectSpecification__.json',
        'TrueVision__StatementDocs__.json'
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Statement Writer's Folder, and What May Go Into It
    // ------------------------------------------------------------
    // A statement is not one file but a folder: its markdown, the HTML built
    // from it, and the pictures it uses, in whatever sub-folders the writer
    // keeps them in. That does not fit ProjectFileNames, which is a list of
    // single documents beside the project data, so statements get their own
    // path rule.
    //
    // The rule is not security - the Worker key is the security - it is there
    // so a caller cannot write outside the statements folder by accident,
    // which is the mistake that quietly corrupts a neighbouring app's content.
    // Depth is capped at four folders below the statements root, which is one
    // more than the deepest a real statement uses.
    // ------------------------------------------------------------
    const Na__CfApi__StatementsDir     = '10__StatementDocs';
    const Na__CfApi__StatementSegment  = /^[A-Za-z0-9_\-. &()\[\]]{1,140}$/;
    const Na__CfApi__StatementSuffixes = /\.(md|html|json|txt|jpe?g|png|webp|gif|tiff?|bmp|svg)$/i;
    const Na__CfApi__StatementMaxDepth = 5;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Project Admin Files TrueVision May READ
    // ------------------------------------------------------------
    // The admin system's own documents, in the project's 10__ProjectAdmin__AppContent
    // folder. TrueVision reads two facts out of them - the site address and the
    // client's name as a drawing prints it - and writes NOTHING: the admin
    // system owns these files, and a drawing app that could rewrite a quotation
    // is a drawing app that will one day rewrite a quotation.
    //
    // There is no R2 key here on purpose. The model sync pushes only the
    // TrueVision and PlanVision content folders, so the admin folder has no R2
    // copy at all (the CDN answers 404). It is served by the website itself,
    // beside every other repository file, which is one path that works on the
    // live build and on a local static server alike.
    // ------------------------------------------------------------
    const Na__CfApi__AdminContentDir  = '10__ProjectAdmin__AppContent';
    const Na__CfApi__AdminFileNames   = [
        'ProjectAdmin__ProjectConfig__.json',
        'ProjectAdmin__Quotations__.json',
        'ProjectAdmin__Quotation__.json'      // <-- Both spellings are in use across the portal; the admin system reads either, so this does too
    ];
    // ------------------------------------------------------------


    // FUNCTION | Where an Admin File Lives: the Repository URL, Read Only
    // ------------------------------------------------------------
    // Null when the name is not on the list or the URL names no project folder.
    // ------------------------------------------------------------
    function Na__CfApi__AdminFileLocation(fileName) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder || Na__CfApi__AdminFileNames.indexOf(fileName) === -1) return null;
        const relative = `${ctx.yearCode}-Projects/${ctx.projectFolder}/${Na__CfApi__AdminContentDir}/${fileName}`;
        return {
            repoUrl : `${window.location.origin}/na-project-portal/${relative}`,
            cdnUrl  : `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${relative}`   // <-- Only if the sync is ever widened to carry the admin folder
        };
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The PlanVision Document TrueVision May READ
    // ------------------------------------------------------------
    // PlanVision's project data carries the same site address the admin system
    // holds, written when the project's drawing portal was set up. It is the
    // fallback for a project that has no quotation to read it from - an hourly
    // job, or a site that is not the client's own house - and it is READ ONLY
    // here for the same reason the admin files are: PlanVision owns it.
    //
    // Unlike the admin folder this one IS pushed to R2 by the model sync, so
    // the CDN copy is a real second chance rather than a courtesy.
    // ------------------------------------------------------------
    const Na__CfApi__PlansContentDir  = '20__PlanVision__AppContent';
    const Na__CfApi__PlansFileNames   = [
        'PlanVision__ProjectData__.json'
    ];
    // ------------------------------------------------------------


    // FUNCTION | Where a PlanVision File Lives: Repository and CDN, Read Only
    // ------------------------------------------------------------
    // Null when the name is not on the list or the URL names no project folder.
    // ------------------------------------------------------------
    function Na__CfApi__PlansFileLocation(fileName) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder || Na__CfApi__PlansFileNames.indexOf(fileName) === -1) return null;
        const relative = `${ctx.yearCode}-Projects/${ctx.projectFolder}/${Na__CfApi__PlansContentDir}/${fileName}`;
        return {
            repoUrl : `${window.location.origin}/na-project-portal/${relative}`,
            cdnUrl  : `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${relative}`
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Sibling File Lives: R2 Key, Public CDN URL and Repository URL
    // ------------------------------------------------------------
    // Null when the name is not on the list or the URL names no project folder.
    // ------------------------------------------------------------
    function Na__CfApi__ProjectFileLocation(fileName) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder || Na__CfApi__ProjectFileNames.indexOf(fileName) === -1) return null;
        const relative = `${ctx.yearCode}-Projects/${ctx.projectFolder}/${Na__CfApi__TvContentDir}/${fileName}`;
        return {
            key     : `${Na__CfApi__R2Prefix}/${relative}`,
            cdnUrl  : `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${relative}`,
            repoUrl : `${window.location.origin}/na-project-portal/${relative}`
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Sibling File From R2 (fresh, through the Worker)
    // ------------------------------------------------------------
    // Returns { ok, data, missing }: missing is true when R2 has no such file
    // yet, which is an answer, not a failure.
    // ------------------------------------------------------------
    async function Na__CfApi__ReadProjectFile(fileName) {
        const location = Na__CfApi__ProjectFileLocation(fileName);
        if (!location) return { ok: false, error: `Refused project file "${fileName}"` };
        const result = await Na__CfApi__ReadKey(location.key);
        if (!result.ok) return result;
        return { ok: true, data: result.data || null, missing: result.missing === true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Statement File Lives: R2 Key, CDN URL and Repository URL
    // ------------------------------------------------------------
    // relativePath is relative to the statements folder, e.g.
    // "01__PreApp__Statement/02_StatementDocs__Content__Images/02__Site__Location/Location__Far__.png".
    // Null when the URL names no project folder or the path is not one this
    // app may touch.
    // ------------------------------------------------------------
    function Na__CfApi__StatementFileLocation(relativePath) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) return null;

        const text = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!text) return null;

        const segments = text.split('/').filter((segment) => segment !== '');
        if (!segments.length || segments.length > Na__CfApi__StatementMaxDepth) return null;
        for (const segment of segments) {
            if (segment === '.' || segment === '..') return null;
            if (!Na__CfApi__StatementSegment.test(segment)) return null;
        }
        if (!Na__CfApi__StatementSuffixes.test(segments[segments.length - 1])) return null;

        const inside   = `${Na__CfApi__TvContentDir}/${Na__CfApi__StatementsDir}/${segments.join('/')}`;
        const relative = `${ctx.yearCode}-Projects/${ctx.projectFolder}/${inside}`;
        return {
            key     : `${Na__CfApi__R2Prefix}/${relative}`,
            cdnUrl  : `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${encodeURI(relative)}`,
            repoUrl : `${window.location.origin}/na-project-portal/${encodeURI(relative)}`,
            path    : segments.join('/')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Statement File to R2
    // ------------------------------------------------------------
    // payload: a string for markdown and HTML, a Blob for a picture. Resolves
    // to { ok, publicUrl } so the caller can put the CDN link straight into
    // the generated HTML.
    // ------------------------------------------------------------
    async function Na__CfApi__WriteStatementFile(relativePath, payload, contentType) {
        const location = Na__CfApi__StatementFileLocation(relativePath);
        if (!location) return { ok: false, error: `Refused statement path "${relativePath}"` };

        let data, encoding, resolvedType;
        if (payload instanceof Blob) {
            data         = await Na__CfApi__BlobToBase64(payload);
            encoding     = 'base64';
            resolvedType = contentType || payload.type || 'application/octet-stream';
        } else if (typeof payload === 'string') {
            data         = payload;
            encoding     = undefined;
            resolvedType = contentType || 'text/plain; charset=utf-8';
        } else {
            data         = payload;
            encoding     = undefined;
            resolvedType = contentType || 'application/json';
        }

        const write = await Na__CfApi__WriteKey({
            key         : location.key,
            data        : data,
            encoding    : encoding,
            contentType : resolvedType
        });
        if (!write || !write.ok) return write || { ok: false, error: 'write failed' };

        return { ok: true, publicUrl: location.cdnUrl, key: location.key, path: location.path };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Statement File From R2 (fresh, through the Worker)
    // ------------------------------------------------------------
    // Returns { ok, text, missing }. The Worker hands back text for anything
    // stored with a text/* content type, which is how the markdown and the
    // generated HTML were written, so a statement comes back as a string.
    // ------------------------------------------------------------
    async function Na__CfApi__ReadStatementFile(relativePath) {
        const location = Na__CfApi__StatementFileLocation(relativePath);
        if (!location) return { ok: false, error: `Refused statement path "${relativePath}"` };
        const result = await Na__CfApi__ReadKey(location.key);
        if (!result.ok) return result;
        if (result.missing) return { ok: true, text: null, missing: true };
        return { ok: true, text: (typeof result.data === 'string') ? result.data : null, missing: false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Whole Sibling File to R2
    // ------------------------------------------------------------
    async function Na__CfApi__WriteProjectFile(fileName, dataObject) {
        const location = Na__CfApi__ProjectFileLocation(fileName);
        if (!location) return { ok: false, error: `Refused project file "${fileName}"` };
        if (!dataObject || typeof dataObject !== 'object') return { ok: false, error: 'Nothing to write' };
        return await Na__CfApi__WriteKey({
            key         : location.key,
            data        : dataObject,
            contentType : 'application/json'
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet Images (the Layout Editor's Pictures)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Pictures Folder and the Names That May Go Into It
    // ------------------------------------------------------------
    // Every picture placed on a Layout Editor sheet lives in
    //     <project>/30__TrueVision__AppContent/05__Layout__DrawingDocs__Images/<document id>/<file>
    // on R2 and in the repository alike. The folder name never changes; the
    // document id folder follows the drawing's number (the Sheet Images save
    // step re-files a picture whenever the two part). One level of folders
    // and a flat file name, both checked here so no caller can write outside
    // the pictures folder by passing a wrong one. The archive folder is the
    // save's own, and nothing is ever published from it.
    // @delegate: ../51__System__LayoutEditor/54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Publish__.js
    // ------------------------------------------------------------
    const Na__CfApi__SHEET_IMAGES_DIR     = '05__Layout__DrawingDocs__Images';
    const Na__CfApi__SHEET_IMAGES_ARCHIVE = '00__Archive';
    const Na__CfApi__SheetImageFolder     = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,119}$/;
    const Na__CfApi__SheetImageFile       = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,159}\.(webp|jpg|jpeg|png)$/i;
    const Na__CfApi__SheetImageCache      = 'public, max-age=31536000, immutable';   // <-- A stored name carries its content hash, so a name never means two pictures
    // ------------------------------------------------------------

    // MODULE VARIABLES | Which Worker Routes This Worker Has
    // ------------------------------------------------------------
    // /r2/upload and /r2/copy arrived with Sheet Images. A Worker deployed
    // before them answers "Unknown R2 operation", and every call then falls
    // back to /r2/write for the rest of the session - slower, never broken.
    // ------------------------------------------------------------
    let Na__CfApi__RawUploadMissing = false;
    let Na__CfApi__CopyMissing      = false;
    // ------------------------------------------------------------


    // FUNCTION | Where a Sheet Picture Lives: R2 Key, CDN URL, Repository URL
    // ------------------------------------------------------------
    // Null when the URL names no project or the folder or file is not one
    // this app may touch. `relative` is the path under the portal root, which
    // the Sheet Images source builds its GitHub Pages fallback from.
    // ------------------------------------------------------------
    function Na__CfApi__SheetImageLocation(folder, fileName) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) return null;
        if (!Na__CfApi__SheetImageFolder.test(String(folder || '')) || folder === Na__CfApi__SHEET_IMAGES_ARCHIVE) return null;
        if (!Na__CfApi__SheetImageFile.test(String(fileName || ''))) return null;
        const relative = `${ctx.yearCode}-Projects/${ctx.projectFolder}/${Na__CfApi__TvContentDir}/${Na__CfApi__SHEET_IMAGES_DIR}/${folder}/${fileName}`;
        return {
            key      : `${Na__CfApi__R2Prefix}/${relative}`,
            cdnUrl   : `${Na__CfApi__CdnBaseUrl}/${Na__CfApi__R2Prefix}/${relative}`,
            repoUrl  : `${window.location.origin}/na-project-portal/${relative}`,
            relative : `na-project-portal/${relative}`,
            folder   : folder,
            file     : fileName
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The R2 Key Every Picture of This Project Starts With
    // ------------------------------------------------------------
    function Na__CfApi__SheetImagesPrefix() {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) return null;
        return `${Na__CfApi__R2Prefix}/${ctx.yearCode}-Projects/${ctx.projectFolder}/${Na__CfApi__TvContentDir}/${Na__CfApi__SHEET_IMAGES_DIR}/`;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Picture of This Project on R2
    // ------------------------------------------------------------
    // Resolves to { ok, objects: [{ key, folder, file, size, etag }] }, every
    // page of the listing followed. Only keys one folder deep are reported:
    // nothing else is a picture this feature stored.
    // ------------------------------------------------------------
    async function Na__CfApi__ListSheetImages() {
        if (!Na__CfApi__IsConfigured()) return { ok: false, error: 'Worker not configured', objects: [] };
        const prefix = Na__CfApi__SheetImagesPrefix();
        if (!prefix) return { ok: false, error: 'No project-folder in URL', objects: [] };
        const objects = [];
        let cursor = null;
        try {
            for (let page = 0; page < 50; page++) {
                const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/list`, {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify(cursor ? { prefix, limit: 1000, cursor } : { prefix, limit: 1000 })
                });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    return { ok: false, error: err.error || `List failed (${response.status})`, objects };
                }
                const result = await response.json();
                (Array.isArray(result.objects) ? result.objects : []).forEach((object) => {
                    const rest  = String(object.key || '').slice(prefix.length).split('/');
                    if (rest.length !== 2 || !rest[0] || !rest[1]) return;
                    objects.push({ key: object.key, folder: rest[0], file: rest[1], size: object.size, etag: object.etag });
                });
                if (!result.truncated || !result.cursor) break;
                cursor = result.cursor;
            }
            return { ok: true, objects };
        } catch (error) {
            console.error('[TrueVision3D] CfApi sheet image list error:', error);
            return { ok: false, error: 'Worker unreachable', objects };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Put One Picture on R2
    // ------------------------------------------------------------
    // The bytes go up as they are through /r2/upload, with their type and an
    // immutable cache header; a Worker without that route takes them as
    // base64 through /r2/write instead. Resolves to { ok, key, error }.
    // ------------------------------------------------------------
    async function Na__CfApi__UploadSheetImage(folder, fileName, blob) {
        if (!Na__CfApi__IsConfigured()) return { ok: false, error: 'Worker not configured' };
        const location = Na__CfApi__SheetImageLocation(folder, fileName);
        if (!location) return { ok: false, error: `Refused picture path "${folder}/${fileName}"` };
        if (!(blob instanceof Blob) || !blob.size) return { ok: false, error: 'Nothing to upload' };
        const type = blob.type || (/\.png$/i.test(fileName) ? 'image/png' : (/\.jpe?g$/i.test(fileName) ? 'image/jpeg' : 'image/webp'));

        if (!Na__CfApi__RawUploadMissing) {
            try {
                const query    = new URLSearchParams({ key: location.key, cacheControl: Na__CfApi__SheetImageCache });
                const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/upload?${query.toString()}`, {
                    method  : 'PUT',
                    headers : { 'Content-Type': type },
                    body    : blob
                });
                if (response.ok) return { ok: true, key: location.key };
                const err = await response.json().catch(() => ({}));
                if (!(response.status === 400 && /unknown r2 operation/i.test(err.error || '')) && response.status !== 404 && response.status !== 405) {
                    return { ok: false, error: err.error || `Upload failed (${response.status})` };
                }
                Na__CfApi__RawUploadMissing = true;                              // <-- An older Worker: base64 from here on
                console.info('[TrueVision3D] The Worker has no /r2/upload yet (deploy it with wrangler); pictures go up through /r2/write.');
            } catch (error) {
                console.error('[TrueVision3D] CfApi picture upload error:', error);
                return { ok: false, error: 'Worker unreachable' };
            }
        }
        const write = await Na__CfApi__WriteKey({
            key          : location.key,
            data         : await Na__CfApi__BlobToBase64(blob),
            encoding     : 'base64',
            contentType  : type,
            cacheControl : Na__CfApi__SheetImageCache
        });
        return write.ok ? { ok: true, key: location.key } : write;
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy a Picture From One Document Folder to Another, on R2
    // ------------------------------------------------------------
    // How a renumbered drawing's pictures follow it without going back up
    // the wire: /r2/copy copies inside the bucket. A Worker without it has
    // the picture read from the CDN and written again. Resolves to { ok, key, error }.
    // ------------------------------------------------------------
    async function Na__CfApi__CopySheetImage(fromFolder, toFolder, fileName) {
        if (!Na__CfApi__IsConfigured()) return { ok: false, error: 'Worker not configured' };
        const from = Na__CfApi__SheetImageLocation(fromFolder, fileName);
        const to   = Na__CfApi__SheetImageLocation(toFolder, fileName);
        if (!from || !to) return { ok: false, error: `Refused picture copy "${fromFolder}" -> "${toFolder}"` };

        if (!Na__CfApi__CopyMissing) {
            try {
                const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/copy`, {
                    method  : 'POST',
                    headers : { 'Content-Type': 'application/json' },
                    body    : JSON.stringify({ from: from.key, to: to.key, cacheControl: Na__CfApi__SheetImageCache })
                });
                if (response.ok) return { ok: true, key: to.key };
                const err = await response.json().catch(() => ({}));
                if (response.status === 404 && err.error === 'Not found') return { ok: false, error: 'Not on R2', missing: true };
                if (!(response.status === 400 && /unknown r2 operation/i.test(err.error || '')) && response.status !== 405) {
                    return { ok: false, error: err.error || `Copy failed (${response.status})` };
                }
                Na__CfApi__CopyMissing = true;
                console.info('[TrueVision3D] The Worker has no /r2/copy yet (deploy it with wrangler); pictures are copied through the CDN.');
            } catch (error) {
                console.error('[TrueVision3D] CfApi picture copy error:', error);
                return { ok: false, error: 'Worker unreachable' };
            }
        }
        try {
            const response = await fetch(from.cdnUrl, { mode: 'cors', cache: 'no-store' });
            if (response.status === 404) return { ok: false, error: 'Not on R2', missing: true };
            if (!response.ok) return { ok: false, error: `CDN read failed (${response.status})` };
            return await Na__CfApi__UploadSheetImage(toFolder, fileName, await response.blob());
        } catch (error) {
            return { ok: false, error: 'CDN unreachable' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Picture Off R2
    // ------------------------------------------------------------
    // Called by the save only for a picture no drawing in the file it has
    // just written points at, and only after that file is safely on R2.
    // ------------------------------------------------------------
    async function Na__CfApi__DeleteSheetImage(folder, fileName) {
        if (!Na__CfApi__IsConfigured()) return { ok: false, error: 'Worker not configured' };
        const location = Na__CfApi__SheetImageLocation(folder, fileName);
        if (!location) return { ok: false, error: `Refused picture path "${folder}/${fileName}"` };
        try {
            const response = await fetch(`${Na__CfApi__WorkerBaseUrl}/r2/delete`, {
                method  : 'POST',
                headers : { 'Content-Type': 'application/json' },
                body    : JSON.stringify({ key: location.key })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return { ok: false, error: err.error || `Delete failed (${response.status})` };
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: 'Worker unreachable' };
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cloudflare R2 API Client
    // ------------------------------------------------------------
    export {
        Na__CfApi__Initialize,
        Na__CfApi__IsConfigured,
        Na__CfApi__GetProjectContext,
        Na__CfApi__SetLoadedProjectData,
        Na__CfApi__GetLoadedProjectData,
        Na__CfApi__BuildContentCdnUrl,
        Na__CfApi__ReadProjectData,
        Na__CfApi__WriteProjectData,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__DeleteProjectKeys,
        Na__CfApi__WriteThumbnailWebp,
        Na__CfApi__WriteProjectAsset,
        Na__CfApi__ProjectFileLocation,
        Na__CfApi__ReadProjectFile,
        Na__CfApi__WriteProjectFile,
        Na__CfApi__StatementFileLocation,
        Na__CfApi__ReadStatementFile,
        Na__CfApi__WriteStatementFile,
        Na__CfApi__AdminFileLocation,
        Na__CfApi__PlansFileLocation,
        Na__CfApi__SHEET_IMAGES_DIR,
        Na__CfApi__SHEET_IMAGES_ARCHIVE,
        Na__CfApi__SheetImageLocation,
        Na__CfApi__SheetImagesPrefix,
        Na__CfApi__ListSheetImages,
        Na__CfApi__UploadSheetImage,
        Na__CfApi__CopySheetImage,
        Na__CfApi__DeleteSheetImage
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
