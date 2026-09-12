// =============================================================================
// TRUEVISION3D - PWA SERVICE WORKER LOGIC
// =============================================================================
//
// FILE       : TrueVision__Pwa__ServiceWorker__Logic__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__ServiceWorker__Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The caching brain behind the installed TrueVision app
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Pulled in with importScripts() from the tiny stub that sits at the app
//   root, so the real logic can live alongside the rest of the install module
//   set without giving up the broad scope the stub's location buys.
// - Cache buckets:
//     tv-shell-vN   : HTML, CSS, JS, manifest, icons, fonts, HDRI environments
//     tv-data-vN    : project data and app config JSON (network-first)
//     tv-models-vN  : GLB / GLTF models from the R2 CDN (network-first with a
//                     slow-network grace window, LRU capped)
//     tv-vendor-vN  : version-locked third-party ES modules (three r184,
//                     three-mesh-bvh, clipper2-js, three-edge-projection) served
//                     same-origin from 04__Lib__ThirdParty__VersionLocked/,
//                     cache-first because a locked set never changes in place
// - Deliberately NOT precaching the full module graph. TrueVision has around a
//   hundred modules that move constantly, and a hand-maintained precache list
//   would be wrong within a week. Only the boot-critical handful is precached;
//   everything else populates naturally on the first visit through
//   stale-while-revalidate, which is what makes the second visit fast.
// - Bump PWA_SW_VERSION_TOKEN whenever shell JS or CSS changes in a way that
//   must reach clients immediately. The activate step then evicts every older
//   bucket.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - three.js moved off esm.sh and into the same-origin version-locked vendor
//   folder (v2.20.0). The vendor bucket survives, but it is now selected by a
//   PATH test rather than a remote origin, and that test runs FIRST in the
//   classifier because vendor files are .js and would otherwise be swept into
//   the shell bucket by PWA_SW_PATTERN_SHELL_ASSET. Shell is
//   stale-while-revalidate on the live site, which is the wrong strategy for a
//   renderer: a half-updated three.js is not a thing that can be reasoned about.
// - esm.sh is no longer a trusted remote origin, so PWA_SW_REMOTE_ORIGINS_OWNED
//   holds the R2 CDN alone.
// - NOTE for offline: three.module.js imports ./three.core.js RELATIVELY. Both
//   files must be reachable or the app boots online and dies offline.
//
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack
//   and retuned for TrueVision's asset mix.
//
// 07-Sep-2026 - Version 1.0.2
// - Bumped the version token for the Elevation Drawings build, which RENAMED a
//   cross-module export: the scene carousel's SetSceneNavigationOverride became
//   AddSceneNavigationRouter, and the floor plan navigation module moved into
//   the drawing view core.
// - This is the case the token exists for and it is worth spelling out. Live
//   app modules are stale-while-revalidate, so a warm client serves the OLD
//   carousel alongside the NEW controllers - a module graph that never existed
//   as a set. Nothing throws; the routers simply never register, and clicking a
//   floor plan or elevation thumbnail falls through to the ordinary camera
//   flight with no cut applied. It reads exactly like the feature was never
//   wired up, on a build where it was.
// - RULE OF THUMB: renaming or moving ANY export that crosses a module boundary
//   needs this token bumped in the same commit. Adding a new export does not.
//
// 27-Aug-2026 - Version 1.0.1
// - Fixed regenerated Presentation Mode scene thumbnails appearing stale on the
//   live site. Scene_00N.webp is overwritten in place by "Regen Thumb", but the
//   generic .webp shell-asset pattern routed it to stale-while-revalidate, so
//   the previous image was served and the new one only appeared on a second
//   reload. Scene thumbnails are now classified as data (network-first).
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Cache Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cache Identifiers and Limits
    // ------------------------------------------------------------
    const PWA_SW_VERSION_TOKEN              = '2026-09-12-2';                                                                       // <-- BUMP THIS to force-evict every cache bucket
    const PWA_SW_CACHE_NAME_SHELL           = `tv-shell-${PWA_SW_VERSION_TOKEN}`;                                                    // <-- App shell cache id
    const PWA_SW_CACHE_NAME_DATA            = `tv-data-${PWA_SW_VERSION_TOKEN}`;                                                     // <-- Project / config JSON cache id
    const PWA_SW_CACHE_NAME_MODELS          = `tv-models-${PWA_SW_VERSION_TOKEN}`;                                                   // <-- Model GLB cache id
    const PWA_SW_CACHE_NAME_VENDOR          = `tv-vendor-${PWA_SW_VERSION_TOKEN}`;                                                   // <-- Third-party ES module cache id
    const PWA_SW_CACHE_PREFIXES_OWNED       = ['tv-shell-', 'tv-data-', 'tv-models-', 'tv-vendor-'];                                 // <-- Owned prefixes, used for cleanup
    const PWA_SW_MODELS_MAX_ENTRIES         = 80;                                                                                    // <-- LRU cap on the model bucket
    const PWA_SW_MODELS_NETWORK_TIMEOUT_MS  = 4000;                                                                                  // <-- Slow-network grace before serving cache
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Path Recognition Patterns
    // ------------------------------------------------------------
    const PWA_SW_PATTERN_MODEL_GLB          = /\.(glb|gltf)(\?.*)?$/i;                                                              // <-- 3D model files
    const PWA_SW_PATTERN_HDRI               = /\.hdr(\?.*)?$/i;                                                                     // <-- HDR environment maps (immutable filenames)
    const PWA_SW_PATTERN_DATA_JSON          = /\.json(\?.*)?$/i;                                                                    // <-- Project data and app config
    const PWA_SW_PATTERN_HTML               = /\.html?(\?.*)?$/i;                                                                   // <-- HTML documents
    const PWA_SW_PATTERN_SHELL_ASSET        = /\.(css|js|mjs|webmanifest|ico|png|jpe?g|svg|webp|woff2?)(\?.*)?$/i;                   // <-- App shell assets
    const PWA_SW_PATTERN_SCENE_THUMBNAIL    = /\/PresentationMode\/Thumbnails\/[^/]+\.webp(\?.*)?$/i;                                // <-- Per-project scene thumbnails (mutable, fixed filenames)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Ownership Rules
    // ------------------------------------------------------------
    const PWA_SW_SAME_ORIGIN_FOLDER_TOKENS  = [                                                                                     // <-- Same-origin folders this worker manages
        '/na-apps/30__TrueVision__CoreAppCode/',                                                                                    // <-- The TrueVision app itself
        '/na-apps/01__Assets__NaApps__CommonAssets/'                                                                                // <-- Shared Noble Architecture assets
    ];
    const PWA_SW_REMOTE_ORIGIN_CDN          = 'https://cdn.noble-architecture.com';                                                  // <-- R2 CDN: models and project data
    const PWA_SW_REMOTE_ORIGINS_OWNED       = [PWA_SW_REMOTE_ORIGIN_CDN];                                                            // <-- Trusted CORS-enabled remote hosts

    // The version-locked vendor libraries (three r184, three-mesh-bvh,
    // clipper2-js, three-edge-projection) moved from esm.sh to this same-origin
    // folder on 10-Sep-2026 (v2.20.0). They are immutable for the life of a
    // version-locked set, so they keep the cache-first vendor bucket - but the
    // classifier now recognises them by PATH rather than by remote origin, and
    // that test must run BEFORE the shell-asset pattern, which also matches .js.
    const PWA_SW_VENDOR_PATH_TOKEN          = '/04__Lib__ThirdParty__VersionLocked/';                                                // <-- Same-origin version-locked vendor folder
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Development Environment Detection
    // ------------------------------------------------------------
    // On localhost the shell strategy switches from stale-while-revalidate to
    // network-first. Stale-while-revalidate is exactly right in production -
    // instant load, refresh in the background - but during development it
    // serves the PREVIOUS save of every edited module and only picks the new
    // one up on a second reload. That wastes far more time than the cache
    // saves, and quietly makes you debug code you already fixed.
    // ------------------------------------------------------------
    const PWA_SW_IS_DEV_ENVIRONMENT         = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(self.location.hostname) !== -1;         // <-- True on the local dev server
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Boot-Critical Precache List (relative to scope)
    // ------------------------------------------------------------
    const PWA_SW_SHELL_PRECACHE_RELATIVE    = [                                                                                     // <-- Best-effort; a miss never fails install
        'Index.html',
        '03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css',
        '02__Src__AppModules/02__AppData/Na__AppConfig__Main.json',
        '02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json',
        '02__Src__AppModules/62__Feature__AppInstallability/TrueVision__Pwa__Manifest__Fallback__.webmanifest'
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Boot-Critical Vendor Precache List (relative to scope)
    // ------------------------------------------------------------
    // These go into the VENDOR bucket, not the shell bucket, because that is
    // where the fetch classifier looks for them. Precaching them into shell
    // would look right and do nothing.
    //
    // Only the renderer is listed. Without it, a user who installs the app and
    // goes offline before ever loading a project gets a dead icon: every module
    // on the page imports 'three', and the import map now points at a file that
    // was never fetched. Everything else populates naturally on first use.
    //
    // three.core.js is NOT optional padding - three.module.js imports it with a
    // relative specifier, so caching only the entry point produces an app that
    // boots online and fails offline, which is the worst of both.
    const PWA_SW_VENDOR_PRECACHE_RELATIVE   = [                                                                                     // <-- Best-effort; a miss never fails install
        '04__Lib__ThirdParty__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.module.js',
        '04__Lib__ThirdParty__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.core.js'
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Utilities
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve the Scope Path Prefix
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__GetScopePathPrefix() {
        const scopeUrl      = new URL(self.registration && self.registration.scope ? self.registration.scope : self.location.href); // <-- Parse the scope URL
        return scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;                                       // <-- Ensure a trailing slash
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Determine Whether a Request Belongs to This Worker
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__IsOwnedRequest(requestUrl) {
        try {
            const targetUrl = new URL(requestUrl);                                                                                  // <-- Parse the target URL

            if (PWA_SW_REMOTE_ORIGINS_OWNED.indexOf(targetUrl.origin) !== -1) return true;                                          // <-- Trusted remote hosts
            if (targetUrl.origin !== self.location.origin) return false;                                                            // <-- Skip all other cross-origin

            return PWA_SW_SAME_ORIGIN_FOLDER_TOKENS.some(token => targetUrl.pathname.indexOf(token) !== -1);                        // <-- Same-origin folders we manage
        } catch (error) {
            return false;                                                                                                           // <-- Treat parse failures as not-owned
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Classify a Request for Cache Routing
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__ClassifyRequest(request) {
        const requestUrl    = request.url || '';                                                                                    // <-- Snapshot the URL

        if (requestUrl.indexOf(PWA_SW_VENDOR_PATH_TOKEN) !== -1) return 'vendor';                                                   // <-- Version-locked vendor library (path test, before the .js shell pattern)
        if (PWA_SW_PATTERN_MODEL_GLB.test(requestUrl)) return 'model';                                                              // <-- 3D model GLB / GLTF
        if (PWA_SW_PATTERN_HDRI.test(requestUrl)) return 'hdri';                                                                    // <-- HDR environment map

        // Scene thumbnails must be tested BEFORE the shell-asset pattern, which
        // also matches .webp. They are mutable content under a fixed filename -
        // "Regen Thumb" overwrites Scene_00N.webp in place - so the shell's
        // stale-while-revalidate strategy would serve the previous image and
        // only pick the new one up on a second reload. Treat them as data.
        if (PWA_SW_PATTERN_SCENE_THUMBNAIL.test(requestUrl)) return 'data';                                                         // <-- Regenerated thumbnails must never go stale

        if (PWA_SW_PATTERN_DATA_JSON.test(requestUrl)) return 'data';                                                               // <-- Project data or app config
        if (PWA_SW_PATTERN_HTML.test(requestUrl)) return 'html';                                                                    // <-- HTML document
        if (PWA_SW_PATTERN_SHELL_ASSET.test(requestUrl)) return 'shell';                                                            // <-- App shell asset

        return 'other';                                                                                                             // <-- Fall through, leave to the network
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Trim a Cache Down to a Maximum Entry Count
    // ---------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__TrimCacheLru(cacheName, maxEntries) {
        try {
            const cacheInstance = await caches.open(cacheName);                                                                     // <-- Open the cache
            const allRequests   = await cacheInstance.keys();                                                                       // <-- List the entries
            const overflowCount = allRequests.length - maxEntries;                                                                  // <-- Compute the overflow
            if (overflowCount <= 0) return;                                                                                         // <-- Nothing to trim

            for (let entryIndex = 0; entryIndex < overflowCount; entryIndex += 1) {
                await cacheInstance.delete(allRequests[entryIndex]);                                                                // <-- Drop the oldest entries first
            }
        } catch (error) {
            console.warn('[TrueVision3D PWA SW] LRU trim failed:', error);                                                          // <-- Non-blocking log
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cache Strategies
// -----------------------------------------------------------------------------

    // FUNCTION | Cache First
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Look up the cached entry
        if (cachedResponse) return cachedResponse;                                                                                  // <-- Cache hit, return immediately

        try {
            const networkResponse = await fetch(request);                                                                           // <-- Network fetch
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Persist a clone, best-effort
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        } catch (error) {
            return Response.error();                                                                                                // <-- Fail closed when offline and uncached
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Stale While Revalidate
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__StaleWhileRevalidate(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Cached entry, may be undefined

        const networkPromise    = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Refresh the cache in the background
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        }).catch(() => null);                                                                                                       // <-- Swallow network errors

        return cachedResponse || (await networkPromise) || Response.error();                                                        // <-- Cache, then network, then error
    }
    // ---------------------------------------------------------------


    // FUNCTION | Network First
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache

        try {
            // cache:'no-store' overrides the captured Request's own cache mode so a
            // "network-first" strategy can never be quietly satisfied by the browser's
            // own HTTP disk cache. Without it, a stale TrueVision__ProjectData__.json
            // could sit in the disk cache and keep being written back into tv-data-*
            // as though it were fresh, which no cache-clear action could ever reach.
            const networkResponse = await fetch(request, { cache: 'no-store' });                                                    // <-- Genuinely hit the network
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Refresh the cache
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        } catch (error) {
            const cachedResponse = await cacheInstance.match(request);                                                              // <-- Look up the offline fallback
            if (cachedResponse) return cachedResponse;                                                                              // <-- Serve stale data when offline
            return Response.error();                                                                                                // <-- Fail closed when uncached
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Network First With a Slow-Network Grace Window (models)
    // ------------------------------------------------------------
    // Behaviour contract:
    //   Good connection : the fresh network copy always wins; cache refreshed.
    //   Slow connection : if the network exceeds the grace window AND a cached
    //                     copy exists, the cached model is served immediately.
    //                     The in-flight fetch still completes and refreshes the
    //                     cache, so the NEXT load gets the fresh copy.
    //   Offline         : the cached copy is served; an error only when uncached.
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__NetworkFirstWithGrace(request, cacheName, graceTimeoutMs, maxEntries) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Existing cached copy, may be undefined

        const networkPromise    = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).then(() => {
                    TrueVision__Pwa__ServiceWorker__Logic__TrimCacheLru(cacheName, maxEntries);                                     // <-- Trim only after a successful put
                }).catch(() => {});                                                                                                 // <-- Quota failures must not break the response
            }
            return networkResponse;                                                                                                 // <-- Live response
        });

        if (!cachedResponse) {
            return networkPromise.catch(() => Response.error());                                                                    // <-- No fallback; the network is the only source
        }

        const graceTimer        = new Promise((resolve) => setTimeout(() => resolve('grace-expired'), graceTimeoutMs));             // <-- Slow-network grace window
        const raceWinner        = await Promise.race([networkPromise.catch(() => 'network-failed'), graceTimer]);                   // <-- First settled outcome wins

        if (raceWinner === 'grace-expired' || raceWinner === 'network-failed') {
            return cachedResponse;                                                                                                  // <-- Serve the cache; the fetch still refreshes
        }

        return raceWinner;                                                                                                          // <-- Fresh network response
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lifecycle Event Handlers
// -----------------------------------------------------------------------------

    // EVENT HANDLER | Service Worker Install
    // ------------------------------------------------------------
    self.addEventListener('install', (installEvent) => {
        installEvent.waitUntil((async () => {
            try {
                const shellCache    = await caches.open(PWA_SW_CACHE_NAME_SHELL);                                                   // <-- Open the shell cache
                const vendorCache   = await caches.open(PWA_SW_CACHE_NAME_VENDOR);                                                  // <-- Open the vendor cache
                const scopePrefix   = TrueVision__Pwa__ServiceWorker__Logic__GetScopePathPrefix();                                  // <-- Resolve the scope prefix

                const precacheJobs  = [                                                                                             // <-- Pair each list with its destination bucket
                    ...PWA_SW_SHELL_PRECACHE_RELATIVE.map(relative  => ({ url: `${scopePrefix}${relative}`, cache: shellCache })),
                    ...PWA_SW_VENDOR_PRECACHE_RELATIVE.map(relative => ({ url: `${scopePrefix}${relative}`, cache: vendorCache }))
                ];

                await Promise.all(precacheJobs.map(async (job) => {
                    try {
                        const response = await fetch(job.url, { cache: 'reload' });                                                 // <-- Force a fresh fetch
                        if (response && response.ok) {
                            await job.cache.put(job.url, response.clone());                                                         // <-- Best-effort precache
                        }
                    } catch (resourceError) {
                        // Silent: a missing precache entry must never fail the install
                    }
                }));
            } catch (error) {
                console.warn('[TrueVision3D PWA SW] Install precache failed:', error);                                              // <-- Non-blocking log
            }

            await self.skipWaiting();                                                                                               // <-- Activate immediately
        })());
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Service Worker Activate
    // ------------------------------------------------------------
    self.addEventListener('activate', (activateEvent) => {
        activateEvent.waitUntil((async () => {
            try {
                const keepList      = [                                                                                             // <-- Buckets belonging to this version
                    PWA_SW_CACHE_NAME_SHELL,
                    PWA_SW_CACHE_NAME_DATA,
                    PWA_SW_CACHE_NAME_MODELS,
                    PWA_SW_CACHE_NAME_VENDOR
                ];

                const allCacheNames = await caches.keys();                                                                          // <-- Enumerate every cache

                await Promise.all(allCacheNames.map(async (cacheName) => {
                    const isOwnedCache = PWA_SW_CACHE_PREFIXES_OWNED.some(prefix => cacheName.startsWith(prefix));                  // <-- Only touch our own buckets
                    if (!isOwnedCache) return;                                                                                      // <-- Leave foreign caches alone
                    if (keepList.indexOf(cacheName) !== -1) return;                                                                 // <-- Keep the current version
                    await caches.delete(cacheName);                                                                                 // <-- Delete a superseded version
                }));
            } catch (error) {
                console.warn('[TrueVision3D PWA SW] Activate cleanup failed:', error);                                              // <-- Non-blocking log
            }

            await self.clients.claim();                                                                                             // <-- Take control of open clients
        })());
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Fetch Routing
    // ------------------------------------------------------------
    self.addEventListener('fetch', (fetchEvent) => {
        const request       = fetchEvent.request;                                                                                   // <-- Snapshot the request
        if (request.method !== 'GET') return;                                                                                       // <-- Only handle GET
        if (!TrueVision__Pwa__ServiceWorker__Logic__IsOwnedRequest(request.url)) return;                                            // <-- Skip requests we do not own

        const classification = TrueVision__Pwa__ServiceWorker__Logic__ClassifyRequest(request);                                     // <-- Route by classification

        if (classification === 'model') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirstWithGrace(                                    // <-- Fresh when fast, cached when slow
                request, PWA_SW_CACHE_NAME_MODELS, PWA_SW_MODELS_NETWORK_TIMEOUT_MS, PWA_SW_MODELS_MAX_ENTRIES
            ));
            return;
        }

        if (classification === 'hdri') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, PWA_SW_CACHE_NAME_SHELL));            // <-- Immutable filename, download once
            return;
        }

        if (classification === 'vendor') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, PWA_SW_CACHE_NAME_VENDOR));           // <-- Version-pinned, safe to pin forever
            return;
        }

        if (classification === 'data') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_DATA));           // <-- Always prefer fresh project data
            return;
        }

        if (classification === 'html') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_SHELL));          // <-- Avoid a stale shell / module mismatch
            return;
        }

        if (classification === 'shell') {
            fetchEvent.respondWith(PWA_SW_IS_DEV_ENVIRONMENT
                ? TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_SHELL)                             // <-- Dev: edits show on the first reload
                : TrueVision__Pwa__ServiceWorker__Logic__StaleWhileRevalidate(request, PWA_SW_CACHE_NAME_SHELL));                   // <-- Live: fast, with a background refresh
            return;
        }
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Message-Based Cache Reset (Diagnostic)
    // ------------------------------------------------------------
    self.addEventListener('message', (messageEvent) => {
        if (!messageEvent.data || messageEvent.data.type !== 'truevision-clear-caches') return;                                     // <-- Ignore unrelated messages

        messageEvent.waitUntil((async () => {
            try {
                const ownedCaches = (await caches.keys())
                    .filter(cacheName => PWA_SW_CACHE_PREFIXES_OWNED.some(prefix => cacheName.startsWith(prefix)));                 // <-- Owned caches only

                await Promise.all(ownedCaches.map(cacheName => caches.delete(cacheName)));                                          // <-- Drop them all

                if (messageEvent.source && messageEvent.source.postMessage) {
                    messageEvent.source.postMessage({ type: 'truevision-cleared', success: true });                                 // <-- Acknowledge
                }
            } catch (error) {
                if (messageEvent.source && messageEvent.source.postMessage) {
                    messageEvent.source.postMessage({ type: 'truevision-cleared', success: false, error: String(error) });          // <-- Report the failure
                }
            }
        })());
    });
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

})();
