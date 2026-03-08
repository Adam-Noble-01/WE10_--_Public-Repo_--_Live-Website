// =============================================================================
// NOBLE ARCHITECTURE - DRAWING SESSION CACHE
// =============================================================================
//
// FILE       : DrawingsCanvas__SessionCache__.js
// NAMESPACE  : NaPlanVision.DrawingsCanvas.SessionCache
// MODULE     : SessionCache
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : In-session blob URL cache for drawing images to avoid redundant
//              CDN downloads when switching between previously-viewed drawings
// CREATED    : 08-Mar-2026
//
// DESCRIPTION:
// - Caches fetched drawing PNGs as blob URLs in memory
// - Eliminates the double-fetch pattern (CDN probe + planImage.src)
// - Returns cached blob URLs instantly on revisit within the same session
// - Enforces a 2-hour staleness guard for long-lived tabs
// - Blob URLs are not persisted across page reloads (fresh on each launch)
// - Revokes blob URLs on clear to prevent memory leaks
//
// -----
//
// DEVELOPMENT LOG:
// 08-Mar-2026 - Version 1.0.0
// - Initial release
//   - Blob URL cache map with fetch-and-store
//   - CDN-first fetch with legacy fallback (single request)
//   - 2-hour staleness guard
//   - JSON fetch caching
//   - Memory cleanup via revokeObjectURL
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Drawing Session Cache
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Cache Configuration
        // --------------------------------------------------------

            const NaCacheStalenessThreshold__Ms = 7_200_000;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Cache Map and Session Timer
        // --------------------------------------------------------

            let sessionStartTime = null;
            let imageCacheMap    = {};
            let jsonCacheMap     = {};

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Session Cache
            // ------------------------------------------------------------
            const Na__Cache__Initialize = function () {
                sessionStartTime = Date.now();
                imageCacheMap    = {};
                jsonCacheMap     = {};
                console.log('[SessionCache] Initialized - session started at',
                    new Date(sessionStartTime).toLocaleTimeString());
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STALENESS | Session Age Check
        // --------------------------------------------------------

            // FUNCTION | Check if Session Has Exceeded the Staleness Threshold
            // ------------------------------------------------------------
            const Na__Cache__IsStale = function () {
                if (!sessionStartTime) return true;
                return (Date.now() - sessionStartTime) >= NaCacheStalenessThreshold__Ms;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // IMAGE CACHING | Fetch, Store, and Retrieve Drawing PNGs
        // --------------------------------------------------------

            // FUNCTION | Fetch an Image as a Blob URL (single network request)
            // ------------------------------------------------------------
            function fetchImageAsBlob(url) {
                return fetch(url).then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.blob();
                }).then(function (blob) {
                    return URL.createObjectURL(blob);
                });
            }
            // ---------------------------------------------------------------

            // FUNCTION | Get or Fetch a Drawing Image
            // Returns { blobUrl, source } from cache or network
            // ------------------------------------------------------------
            const Na__Cache__GetOrFetchImage = async function (cdnUrl, fallbackUrl) {
                const cacheKey = cdnUrl || fallbackUrl;
                if (!cacheKey) {
                    return { blobUrl: fallbackUrl, source: 'direct' };
                }

                if (!Na__Cache__IsStale() && imageCacheMap[cacheKey]) {
                    console.log('[SessionCache] Cache HIT (image):', cacheKey.split('/').pop());
                    return {
                        blobUrl : imageCacheMap[cacheKey].blobUrl,
                        source  : imageCacheMap[cacheKey].source
                    };
                }

                if (Na__Cache__IsStale() && imageCacheMap[cacheKey]) {
                    URL.revokeObjectURL(imageCacheMap[cacheKey].blobUrl);
                    delete imageCacheMap[cacheKey];
                    console.log('[SessionCache] Stale entry evicted:', cacheKey.split('/').pop());
                }

                // CDN-first fetch with fallback (single request, no probe image)
                let blobUrl  = null;
                let source   = 'legacy';

                if (cdnUrl) {
                    try {
                        blobUrl = await fetchImageAsBlob(cdnUrl);
                        source  = 'cdn';
                    } catch (cdnError) {
                        console.warn('[SessionCache] CDN fetch failed:', cdnError.message);
                    }
                }

                if (!blobUrl && fallbackUrl) {
                    try {
                        blobUrl = await fetchImageAsBlob(fallbackUrl);
                        source  = 'legacy';
                    } catch (fallbackError) {
                        console.error('[SessionCache] Fallback fetch also failed:', fallbackError.message);
                        return { blobUrl: fallbackUrl, source: 'direct' };
                    }
                }

                if (!blobUrl) {
                    return { blobUrl: fallbackUrl || cdnUrl, source: 'direct' };
                }

                imageCacheMap[cacheKey] = {
                    blobUrl   : blobUrl,
                    source    : source,
                    timestamp : Date.now()
                };

                console.log('[SessionCache] Cache STORE (image):', cacheKey.split('/').pop(),
                    '| source:', source);

                return { blobUrl: blobUrl, source: source };
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // JSON CACHING | Fetch, Store, and Retrieve Project Data
        // --------------------------------------------------------

            // FUNCTION | Get or Fetch JSON Data
            // Returns { data, source } from cache or network
            // ------------------------------------------------------------
            const Na__Cache__GetOrFetchJson = async function (cdnUrl, fallbackUrl) {
                const cacheKey = cdnUrl || fallbackUrl;
                if (!cacheKey) {
                    return { data: null, source: 'none' };
                }

                if (!Na__Cache__IsStale() && jsonCacheMap[cacheKey]) {
                    console.log('[SessionCache] Cache HIT (json):', cacheKey.split('/').pop());
                    return {
                        data   : jsonCacheMap[cacheKey].data,
                        source : jsonCacheMap[cacheKey].source
                    };
                }

                if (Na__Cache__IsStale() && jsonCacheMap[cacheKey]) {
                    delete jsonCacheMap[cacheKey];
                }

                let data   = null;
                let source = 'legacy';

                if (cdnUrl) {
                    try {
                        const response = await fetch(cdnUrl);
                        if (response.ok) {
                            data   = await response.json();
                            source = 'cdn';
                        }
                    } catch (cdnError) {
                        console.warn('[SessionCache] CDN JSON fetch failed:', cdnError.message);
                    }
                }

                if (!data && fallbackUrl) {
                    const response = await fetch(fallbackUrl);
                    if (!response.ok) {
                        throw new Error('Fallback JSON fetch failed: HTTP ' + response.status);
                    }
                    data   = await response.json();
                    source = 'legacy';
                }

                if (data) {
                    jsonCacheMap[cacheKey] = {
                        data      : data,
                        source    : source,
                        timestamp : Date.now()
                    };
                    console.log('[SessionCache] Cache STORE (json):', cacheKey.split('/').pop(),
                        '| source:', source);
                }

                return { data: data, source: source };
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // CLEANUP | Memory Management
        // --------------------------------------------------------

            // FUNCTION | Clear All Cached Entries and Revoke Blob URLs
            // ------------------------------------------------------------
            const Na__Cache__Clear = function () {
                var keys = Object.keys(imageCacheMap);
                for (var i = 0; i < keys.length; i++) {
                    URL.revokeObjectURL(imageCacheMap[keys[i]].blobUrl);
                }
                imageCacheMap = {};
                jsonCacheMap  = {};
                console.log('[SessionCache] Cache cleared -', keys.length, 'blob URL(s) revoked');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DrawingsCanvas = window.NaPlanVision.DrawingsCanvas || {};
            window.NaPlanVision.DrawingsCanvas.SessionCache = {
                Na__Cache__Initialize        : Na__Cache__Initialize,
                Na__Cache__GetOrFetchImage   : Na__Cache__GetOrFetchImage,
                Na__Cache__GetOrFetchJson    : Na__Cache__GetOrFetchJson,
                Na__Cache__IsStale           : Na__Cache__IsStale,
                Na__Cache__Clear             : Na__Cache__Clear
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('SessionCache');
            }

            console.log('[SessionCache] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
