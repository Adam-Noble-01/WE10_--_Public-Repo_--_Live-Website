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


    // FUNCTION | Read, Merge Top-Level Keys, and Write Back (the common save path)
    // ------------------------------------------------------------
    // partialObject: { KeyName: value, ... } merged at the document root.
    // ------------------------------------------------------------
    async function Na__CfApi__MergeAndSaveKeys(partialObject) {
        const readResult = await Na__CfApi__ReadProjectData();
        if (!readResult.ok) return readResult;

        const merged = { ...(readResult.data || {}), ...partialObject };     // <-- Shallow-merge changed keys at root
        return await Na__CfApi__WriteProjectData(merged);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read, Delete Top-Level Keys, and Write Back
    // ------------------------------------------------------------
    async function Na__CfApi__DeleteProjectKeys(keyNames) {
        const readResult = await Na__CfApi__ReadProjectData();
        if (!readResult.ok) return readResult;

        const merged = { ...(readResult.data || {}) };
        (keyNames || []).forEach((name) => { delete merged[name]; });        // <-- Remove requested keys
        return await Na__CfApi__WriteProjectData(merged);
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
        Na__CfApi__BuildContentCdnUrl,
        Na__CfApi__ReadProjectData,
        Na__CfApi__WriteProjectData,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__DeleteProjectKeys,
        Na__CfApi__WriteThumbnailWebp
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
