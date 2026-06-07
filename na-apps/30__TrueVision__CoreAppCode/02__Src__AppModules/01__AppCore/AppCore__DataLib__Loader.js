// =============================================================================
// TRUEVISION3D - APP CORE - DATALIB LOADER
// =============================================================================
//
// FILE       : AppCore__DataLib__Loader.js
// NAMESPACE  : Na__DataLib
// MODULE     : DataLibLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Fetch and cache all Na__DataLib index files from GitHub at startup
// CREATED    : 06-Jun-2026
//
// DESCRIPTION:
// - Fetches all four Na__DataLib index files in parallel from their GitHub raw
//   URLs at application startup.
// - Caches every response in module scope so subsequent calls return
//   instantly without a network round-trip.
// - This module is the single gateway between TrueVision and the
//   Na__Common__DataLib__CoreSuEntityStandards repository (SketchUp plugins
//   repo). It eliminates the need for a locally-maintained copy of any DataLib
//   file inside the TrueVision source tree.
// - Na__DataLib__LoadAll() MUST be awaited before any system that reads DataLib
//   data (e.g. the materials swap system) is invoked.
//
// DATALIB REPOSITORY:
//   https://github.com/Adam-Noble-01/Plugins/tree/main/Na__Common__DataLib__CoreSuEntityStandards
//
// ERROR HANDLING:
//   If any URL returns a non-OK HTTP response or throws a network error, a
//   user-facing toast is dispatched (na-show-toast, isError: true) naming the
//   failing file, and the error is rethrown so the loading sequence halts.
//
// ROOT KEYS (in each fetched JSON):
//   Materials    → Na__DataLib__CoreIndex__Materials
//   Tags         → Na__DataLib__CoreIndex__Tags
//   Components   → Na__DataLib__CoreIndex__Components
//   EdgeMaterials → Na__DataLib__CoreIndex__EdgeMaterials
//
// =============================================================================


// #Region ---
// REGION | Module Constants
// -----

    // MODULE CONSTANTS | DataLib GitHub Raw URLs
    // ------------------------------------------------------------
    const Na__DataLib__URLS = Object.freeze({
        Materials    : 'https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json',
        Tags         : 'https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Tags__.json',
        Components   : 'https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Components__.json',
        EdgeMaterials: 'https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__EdgeMaterials__.json'
    });
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module State (Session Cache)
// -----

    // MODULE VARIABLES | Cached DataLib Responses
    // ------------------------------------------------------------
    let Na__DataLib__Cache__Materials     = null;                           // <-- Na__DataLib__CoreIndex__Materials
    let Na__DataLib__Cache__Tags          = null;                           // <-- Na__DataLib__CoreIndex__Tags
    let Na__DataLib__Cache__Components    = null;                           // <-- Na__DataLib__CoreIndex__Components
    let Na__DataLib__Cache__EdgeMaterials = null;                           // <-- Na__DataLib__CoreIndex__EdgeMaterials
    let Na__DataLib__Cache__IsReady       = false;                          // <-- True once LoadAll has completed
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Error Reporting Helper
// -----

    // HELPER FUNCTION | Dispatch User-Facing Toast for DataLib Fetch Failure
    // ------------------------------------------------------------
    function Na__DataLib__DispatchErrorToast(fileName, errorMessage) {
        window.dispatchEvent(new CustomEvent('na-show-toast', {
            detail: {
                message : `DataLib load failed for ${fileName}. The app cannot continue. Check your network connection and try reloading. (${errorMessage})`,
                isError : true
            }
        }));
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Single-File Fetch
// -----

    // HELPER FUNCTION | Fetch a Single DataLib JSON File
    // ------------------------------------------------------------
    // Returns the parsed JSON object. Throws a descriptive Error if the
    // network request fails or the server returns a non-OK status.
    // ------------------------------------------------------------
    async function Na__DataLib__FetchOne(key, url) {
        let response;
        try {
            response = await fetch(url);
        } catch (networkError) {
            const msg = `Network error fetching ${key}: ${networkError.message}`;
            Na__DataLib__DispatchErrorToast(key, networkError.message);
            throw new Error(msg);
        }

        if (!response.ok) {
            const msg = `HTTP ${response.status} ${response.statusText} fetching ${key} from ${url}`;
            Na__DataLib__DispatchErrorToast(key, `HTTP ${response.status}`);
            throw new Error(msg);
        }

        try {
            return await response.json();
        } catch (parseError) {
            const msg = `JSON parse error for ${key}: ${parseError.message}`;
            Na__DataLib__DispatchErrorToast(key, parseError.message);
            throw new Error(msg);
        }
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Load All (Public Entry Point)
// -----

    // FUNCTION | Fetch and Cache All DataLib Index Files
    // ------------------------------------------------------------
    // Call once at app startup before any system that reads DataLib data.
    // Subsequent calls are no-ops (cached data is returned immediately).
    // Pass forceReload = true to bypass the session cache.
    // ------------------------------------------------------------
    async function Na__DataLib__LoadAll(forceReload = false) {
        if (Na__DataLib__Cache__IsReady && !forceReload) {
            console.log('[DataLib] Already loaded — returning from cache.');
            return;
        }

        console.log('[DataLib] Fetching all DataLib index files from GitHub...');

        const [materials, tags, components, edgeMaterials] = await Promise.all([
            Na__DataLib__FetchOne('Na__DataLib__CoreIndex__Materials__',     Na__DataLib__URLS.Materials),
            Na__DataLib__FetchOne('Na__DataLib__CoreIndex__Tags__',          Na__DataLib__URLS.Tags),
            Na__DataLib__FetchOne('Na__DataLib__CoreIndex__Components__',    Na__DataLib__URLS.Components),
            Na__DataLib__FetchOne('Na__DataLib__CoreIndex__EdgeMaterials__', Na__DataLib__URLS.EdgeMaterials)
        ]);

        Na__DataLib__Cache__Materials     = materials;                      // <-- Materials PBR library
        Na__DataLib__Cache__Tags          = tags;                           // <-- SketchUp tags index
        Na__DataLib__Cache__Components    = components;                     // <-- Component naming index
        Na__DataLib__Cache__EdgeMaterials = edgeMaterials;                  // <-- Edge material colours
        Na__DataLib__Cache__IsReady       = true;

        const matCount = Object.values(
            (materials.Na__DataLib__CoreIndex__Materials || {})
        ).reduce((sum, series) => sum + (typeof series === 'object' ? Object.keys(series).length : 0), 0);

        console.log(
            `[DataLib] All files loaded. Materials entries: ~${matCount}, ` +
            `Tags: ${Object.keys(tags.Na__DataLib__CoreIndex__Tags || {}).length}, ` +
            `Components: loaded, EdgeMaterials: loaded.`
        );
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Data Getters
// -----

    // FUNCTION | Get Cached Materials Library Data
    // ------------------------------------------------------------
    // Returns the full parsed JSON object for Na__DataLib__CoreIndex__Materials__.json.
    // The relevant series data is under root key: Na__DataLib__CoreIndex__Materials
    // ------------------------------------------------------------
    function Na__DataLib__GetMaterials() {
        if (!Na__DataLib__Cache__IsReady) {
            console.warn('[DataLib] GetMaterials() called before LoadAll() completed.');
        }
        return Na__DataLib__Cache__Materials;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Cached Tags Index Data
    // ------------------------------------------------------------
    function Na__DataLib__GetTags() {
        if (!Na__DataLib__Cache__IsReady) {
            console.warn('[DataLib] GetTags() called before LoadAll() completed.');
        }
        return Na__DataLib__Cache__Tags;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Cached Components Index Data
    // ------------------------------------------------------------
    function Na__DataLib__GetComponents() {
        if (!Na__DataLib__Cache__IsReady) {
            console.warn('[DataLib] GetComponents() called before LoadAll() completed.');
        }
        return Na__DataLib__Cache__Components;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Render-Pipeline Exclusion Lists (from Components Index)
    // ------------------------------------------------------------
    // Returns the Na__DataLib__PipelineExclusions section (AmbientOcclusion +
    // ProfileLines name token lists) or null when unavailable.
    // ------------------------------------------------------------
    function Na__DataLib__GetPipelineExclusions() {
        if (!Na__DataLib__Cache__IsReady) {
            console.warn('[DataLib] GetPipelineExclusions() called before LoadAll() completed.');
        }
        if (!Na__DataLib__Cache__Components) return null;
        return Na__DataLib__Cache__Components.Na__DataLib__PipelineExclusions || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Cached Edge Materials Index Data
    // ------------------------------------------------------------
    function Na__DataLib__GetEdgeMaterials() {
        if (!Na__DataLib__Cache__IsReady) {
            console.warn('[DataLib] GetEdgeMaterials() called before LoadAll() completed.');
        }
        return Na__DataLib__Cache__EdgeMaterials;
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Whether All DataLib Files Have Been Loaded
    // ------------------------------------------------------------
    function Na__DataLib__IsReady() {
        return Na__DataLib__Cache__IsReady;
    }
    // ------------------------------------------------------------

// endregion ----


// #Region ---
// REGION | Module Exports
// -----

    // MODULE EXPORTS | DataLib Loader API
    // ------------------------------------------------------------
    export {
        Na__DataLib__LoadAll,
        Na__DataLib__GetMaterials,
        Na__DataLib__GetTags,
        Na__DataLib__GetComponents,
        Na__DataLib__GetPipelineExclusions,
        Na__DataLib__GetEdgeMaterials,
        Na__DataLib__IsReady
    };
    // ------------------------------------------------------------

// endregion ----
