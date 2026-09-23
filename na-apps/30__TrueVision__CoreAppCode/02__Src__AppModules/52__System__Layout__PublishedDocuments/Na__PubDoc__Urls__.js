// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - URLS AND FETCH
// =============================================================================
//
// FILE       : Na__PubDoc__Urls__.js
// NAMESPACE  : Na__PubDoc
// MODULE     : Published Documents - Urls and Fetch
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a project-relative published path into a URL and fetch it, once, with no retry a 404 could trigger
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - ONE URL BUILDER, AND IT IS THE ONE EVERYTHING ELSE ALREADY USES.
//   Na__AppUtils__ResolveAssetUrl turns a project-relative path into an R2 CDN
//   url and a GitHub Pages fallback, and a published document is project content
//   exactly as a sheet picture is. There is no second scheme to keep in step.
// - ORDER DEPENDS ON WHERE WE ARE RUNNING. On the live site R2 is the truth and
//   the Pages copy is a last resort, because published files are pushed to R2
//   and are not committed. On localhost it is the other way round: the file that
//   was just published is the one on this disk, and the one on R2 is whatever
//   was pushed last. Getting this backwards means an author publishes, reloads,
//   and sees yesterday's drawing.
// - A 404 IS AN ANSWER, NOT A FAILURE TO RETRY. This module retries a network
//   error and a 5xx once, and a 404 never. The behaviour this whole system
//   exists to replace was an underlay scheduler that re-attempted an impossible
//   render forever; repeating that shape here would be the same bug in a new
//   folder.
// - EVERY FAILURE COMES BACK AS A VALUE, never as a throw. A caller gets
//   { Ok:false, Status, Reason } and puts the reason on the grey mask, so a
//   client looking at a blank drawing can read why.
//
// INTEGRATION:
// - Na__PubDoc__Index__ and Na__PubDoc__Document__ are the only callers.
// - Imports Na__AppUtils__ProjectLoader (a leaf: no imports of its own) and the
//   published schema. Nothing else, ever - see README__PublishedDocuments__.md.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 2 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__AppUtils__ResolveAssetUrl,
        Na__AppUtils__NormalizeProjectFolderId,
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    const Na__PubDoc__ConfigUrl = new URL('./Na__PubDoc__Config__.json', import.meta.url);

    const Na__PubDoc__FetchF = {                                                  // <-- The built-in floor
        timeoutMs      : 20000,
        retries        : 1,
        retryDelayMs   : 700,
        dataCacheMode  : 'default',
        assetCacheMode : 'default'
    };

    let Na__PubDoc__Fetch__Setup = null;
    let Na__PubDoc__FolderId     = null;                                          // <-- "2026/AA00__ExampleProjectStructure"
    let Na__PubDoc__BaseOverride = null;                                          // <-- A test or a harness may name a base directly

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Reader's Fetch Settings Once (never throws)
    // ------------------------------------------------------------
    async function Na__PubDoc__Urls__Ready() {
        if (Na__PubDoc__Fetch__Setup) return Na__PubDoc__Fetch__Setup;
        let block = null;
        try {
            const response = await fetch(Na__PubDoc__ConfigUrl, { cache : 'no-store' });
            if (response.ok) block = (await response.json())['PubDoc__Fetch__Config'];
        } catch (error) {
            console.warn('[TrueVision3D PubDoc] Reader config unreadable (' + error.message + '); using the built-in settings.');
        }
        Na__PubDoc__Fetch__Setup = {
            timeoutMs      : Number((block || {})['Fetch__TimeoutMs'])    || Na__PubDoc__FetchF.timeoutMs,
            retries        : Number.isInteger((block || {})['Fetch__Retries']) ? block['Fetch__Retries'] : Na__PubDoc__FetchF.retries,
            retryDelayMs   : Number((block || {})['Fetch__RetryDelayMs']) || Na__PubDoc__FetchF.retryDelayMs,
            dataCacheMode  : (block || {})['Fetch__DataCacheMode']  || Na__PubDoc__FetchF.dataCacheMode,
            assetCacheMode : (block || {})['Fetch__AssetCacheMode'] || Na__PubDoc__FetchF.assetCacheMode
        };
        return Na__PubDoc__Fetch__Setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Settings, Synchronously
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__Setup() {
        return Na__PubDoc__Fetch__Setup || Object.assign({}, Na__PubDoc__FetchF);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Project
// -----------------------------------------------------------------------------

    // FUNCTION | Tell This Module Which Project's Documents to Read
    // ------------------------------------------------------------
    // folderIdOrCode is either a ready folder id - "26/RB05__WestFarm", the form
    // the rest of the app builds - or a bare project code. A base, when given,
    // wins over both and is fetched directly - that is how a test harness or a
    // local static server points the reader at a folder on disk.
    //
    // A FOLDER ID IS TAKEN VERBATIM, NEVER NORMALISED. The app's own folder id
    // carries a TWO-digit year ("26/RB05__WestFarm", from ?year= defaulting to
    // "26"), and NormalizeProjectFolderId only recognises a FOUR-digit one: fed
    // "26/RB05__WestFarm" it prepends "2026/" and the reader asks for
    // 26-Projects/26/RB05__WestFarm/... - a 404 on every file, which would have
    // put the grey mask over every published drawing on the live site.
    // Na__AppUtils__ResolveAssetUrl already accepts either year form, so the id
    // goes straight to it exactly as the linework store's does.
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__Use(folderIdOrCode, base) {
        const value = (typeof folderIdOrCode === 'string') ? folderIdOrCode.trim().replace(/^\/+|\/+$/g, '') : '';
        if (value === '')                 Na__PubDoc__FolderId = null;
        else if (value.indexOf('/') !== -1) Na__PubDoc__FolderId = value;                       // <-- A folder id: verbatim
        else                              Na__PubDoc__FolderId = Na__AppUtils__NormalizeProjectFolderId(value);   // <-- A bare code: legacy fallback only
        Na__PubDoc__BaseOverride = (typeof base === 'string' && base !== '') ? base.replace(/\/+$/, '') : null;
        return Na__PubDoc__FolderId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Project the Reader Is Showing
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__Project() {
        return Na__PubDoc__FolderId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Project Off the Page's Own Query String
    // ------------------------------------------------------------
    // BUILT EXACTLY AS Na__PlStore__FolderId BUILDS IT - year from ?year= (which
    // defaults to "26"), a slash, the folder from ?project-folder= - so a
    // published drawing resolves to the same R2 folder as every baked asset the
    // app already reads. ?project-folder= names the folder exactly and wins,
    // because a project code is not a folder name: PS01's content lives in
    // PS01__MustersRoad. ?project= alone is only a legacy fallback.
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__FromPage() {
        if (typeof window === 'undefined' || !window.location) return null;
        const folder = Na__AppUtils__GetProjectFolderFromUrl();
        if (folder) return Na__PubDoc__Urls__Use(Na__AppUtils__GetYearFromUrl() + '/' + folder);
        const code = new URLSearchParams(window.location.search).get('project');
        if (code) return Na__PubDoc__Urls__Use(code);
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Url Building
// -----------------------------------------------------------------------------

    // FUNCTION | Every Url a Published Path Could Be At, in the Order to Try Them
    // ------------------------------------------------------------
    // LOCALHOST PUTS THE REPOSITORY FIRST. An author who has just published
    // wants the file on this disk, not whatever was last pushed to the bucket.
    // The live site puts R2 first, because published files are pushed there and
    // are never committed, so the Pages copy is absent or stale by definition.
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__For(projectRelativePath) {
        if (typeof projectRelativePath !== 'string' || projectRelativePath === '') return [];

        if (Na__PubDoc__BaseOverride) {
            return [ Na__PubDoc__BaseOverride + '/' + projectRelativePath ];
        }
        if (!Na__PubDoc__FolderId) return [];

        const resolved = Na__AppUtils__ResolveAssetUrl(Na__PubDoc__FolderId, projectRelativePath);
        const ordered  = Na__AppUtils__IsRunningOnLocalhost()
            ? [ resolved.fallback, resolved.primary ]
            : [ resolved.primary, resolved.fallback ];
        return ordered.filter((one) => typeof one === 'string' && one !== '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fetch
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Sleep
    // ------------------------------------------------------------
    function Na__PubDoc__Wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Attempt at One Url, With a Timeout
    // ------------------------------------------------------------
    // Returns { Ok, Status, Response, Reason, Retryable }. Never throws.
    // ------------------------------------------------------------
    async function Na__PubDoc__Attempt(url, cacheMode, timeoutMs) {
        const controller = (typeof AbortController === 'function') ? new AbortController() : null;
        const timer      = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const response = await fetch(url, {
                cache  : cacheMode,
                signal : controller ? controller.signal : undefined
            });
            if (timer) clearTimeout(timer);
            if (response.ok) return { Ok : true, Status : response.status, Response : response };
            return {
                Ok        : false,
                Status    : response.status,
                Reason    : response.status + ' ' + (response.statusText || 'error'),
                // A 404 IS AN ANSWER. Only a server fault is worth asking twice.
                Retryable : response.status >= 500
            };
        } catch (error) {
            if (timer) clearTimeout(timer);
            const aborted = error && error.name === 'AbortError';
            return {
                Ok        : false,
                Status    : 0,
                Reason    : aborted ? ('timed out after ' + timeoutMs + 'ms') : ('network error: ' + error.message),
                Retryable : !aborted
            };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch One Published File, Trying Each Url in Order
    // ------------------------------------------------------------
    // as: 'json' | 'text' | 'blob' | 'response'. Returns
    // { Ok, Value, Url, Status, Reason } and NEVER throws, so a caller can put
    // the reason on the grey mask instead of dying in a promise.
    // ------------------------------------------------------------
    async function Na__PubDoc__Urls__Fetch(projectRelativePath, as, isAsset) {
        const setup = Na__PubDoc__Urls__Setup();
        const urls  = Na__PubDoc__Urls__For(projectRelativePath);
        if (urls.length === 0) {
            return { Ok : false, Status : 0, Reason : 'no project is selected, so ' + projectRelativePath + ' cannot be read' };
        }
        const cacheMode = isAsset ? setup.assetCacheMode : setup.dataCacheMode;
        let last = null;

        for (const url of urls) {
            for (let attempt = 0; attempt <= setup.retries; attempt++) {
                if (attempt > 0) await Na__PubDoc__Wait(setup.retryDelayMs);
                const got = await Na__PubDoc__Attempt(url, cacheMode, setup.timeoutMs);
                if (got.Ok) {
                    try {
                        let value = got.Response;
                        if (as === 'json') value = await got.Response.json();
                        else if (as === 'text') value = await got.Response.text();
                        else if (as === 'blob') value = await got.Response.blob();
                        return { Ok : true, Value : value, Url : url, Status : got.Status };
                    } catch (error) {
                        last = { Ok : false, Status : got.Status, Url : url,
                                 Reason : projectRelativePath + ' was downloaded but could not be read as ' + as + ' (' + error.message + ')' };
                        break;                                                    // <-- A corrupt file will not un-corrupt on a retry
                    }
                }
                last = { Ok : false, Status : got.Status, Url : url, Reason : projectRelativePath + ': ' + got.Reason };
                if (!got.Retryable) break;                                        // <-- Next url, not another go at this one
            }
        }
        return last || { Ok : false, Status : 0, Reason : 'could not read ' + projectRelativePath };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Url an <img> or <use> Should Point At (first choice only)
    // ------------------------------------------------------------
    // A raster goes into the document as an image element, so the browser does
    // the fetching. It gets ONE url: an <img> cannot be told to try a second,
    // and its onerror is where a missing tier is handled.
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__Direct(projectRelativePath) {
        const urls = Na__PubDoc__Urls__For(projectRelativePath);
        return urls.length > 0 ? urls[0] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Url for a Path, for a Caller That Wants to Fall Back Itself
    // ------------------------------------------------------------
    function Na__PubDoc__Urls__All(projectRelativePath) {
        return Na__PubDoc__Urls__For(projectRelativePath);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubDoc__Urls__Ready,
        Na__PubDoc__Urls__Use,
        Na__PubDoc__Urls__Project,
        Na__PubDoc__Urls__FromPage,
        Na__PubDoc__Urls__For,
        Na__PubDoc__Urls__Fetch,
        Na__PubDoc__Urls__Direct,
        Na__PubDoc__Urls__All
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
