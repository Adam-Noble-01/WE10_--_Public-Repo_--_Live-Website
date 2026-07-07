// =============================================================================
// NOBLE CAD AUDIT TOOLS - SERVICE WORKER
// =============================================================================
//
// FILE      : Na__ServiceWorker__CadAuditTools.js
// NAMESPACE : CadAuditTools
// MODULE    : ServiceWorker
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : PWA service worker — caches app shell for offline/installed use
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Implements a stale-while-revalidate caching strategy for the app shell.
// - Caches the HTML, CSS, and core JS modules on install.
// - On fetch, serves from cache first (for speed) while refreshing in background.
// - Cache key is versioned — update Na__SW_CACHE_NAME to force a refresh.
// - Only caches same-origin requests; CDN/external assets pass through.
//
// NOTE: This is a localhost PWA tool, so offline support is a secondary concern.
//       The primary benefit is install-to-taskbar / install-to-dock capability.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Cache Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cache Versioning
    // ------------------------------------------------------------
    const Na__SW_CACHE_NAME  = 'na-cad-audit-tools-shell-v2'; // <-- Bump version to force cache refresh
    const Na__SW_APP_SHELL   = [                               // <-- Files to cache on install
        './',
        './Na__App__.html',
        './Na__App__Main__.js',
        './03__AppStyles/Na__StyleSheet__EditorTheme__.css',
        './02__AppData/Na__AppData__AppConfig__.json',
        './03__AppModules/01__AppCore/Na__AppCore__EventBus__.js',
        './03__AppModules/01__AppCore/Na__AppCore__AppState__.js',
        './03__AppModules/01__AppCore/Na__AppCore__HotkeyManager__.js',
        './03__AppModules/01__AppCore/Na__AppCore__Keybindings__.js',
        './03__AppModules/01__AppCore/Na__AppCore__SelectionManager__.js',
        './03__AppModules/01__AppCore/Na__AppCore__UndoManager__.js',
        './03__AppModules/02__UI/Na__UI__Toolbar__.js',
        './03__AppModules/02__UI/Na__UI__LayersPanel__.js',
        './03__AppModules/02__UI/Na__UI__PropertiesPanel__.js',
        './03__AppModules/02__UI/Na__UI__StatusBar__.js',
        './03__AppModules/02__UI/Na__UI__UploadPanel__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__Canvas__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__EntityLoader__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__ExportSerializer__.js',
        './03__AppModules/03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js',
        './03__AppModules/System__SelectionTools/Na__SelectionTools__BoxSelectTool__.js',
        './03__AppModules/System__Navigation/Na__Navigation__ViewBoxController__.js',
        './03__AppModules/62__Feature__AppInstallability/Na__AppInstallability__Manifest.webmanifest',
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Service Worker Lifecycle Event Handlers
// -----------------------------------------------------------------------------

    // FUNCTION | Install — Pre-Cache App Shell Resources
    // ------------------------------------------------------------
    self.addEventListener('install', (event) => {
        console.log('[Na__ServiceWorker] Installing cache:', Na__SW_CACHE_NAME);
        event.waitUntil(
            caches.open(Na__SW_CACHE_NAME)
                .then((cache) => cache.addAll(Na__SW_APP_SHELL))
                .then(() => self.skipWaiting())                   // <-- Activate immediately, don't wait
        );
    });
    // ------------------------------------------------------------


    // FUNCTION | Activate — Remove Stale Cache Versions
    // ------------------------------------------------------------
    self.addEventListener('activate', (event) => {
        console.log('[Na__ServiceWorker] Activating:', Na__SW_CACHE_NAME);
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames
                            .filter((name) => name !== Na__SW_CACHE_NAME) // <-- Any cache that is NOT current version
                            .map((name) => {
                                console.log('[Na__ServiceWorker] Deleting stale cache:', name);
                                return caches.delete(name);
                            })
                    );
                })
                .then(() => self.clients.claim())                 // <-- Take control of all open clients
        );
    });
    // ------------------------------------------------------------


    // FUNCTION | Fetch — Stale-While-Revalidate for App Shell
    // ------------------------------------------------------------
    self.addEventListener('fetch', (event) => {
        // Pass through non-GET requests and cross-origin (CDN) requests uncached
        if (event.request.method !== 'GET') return;
        if (!event.request.url.startsWith(self.location.origin)) return;

        // Pass through API calls to the Flask server uncached
        const url = new URL(event.request.url);
        if (url.pathname.startsWith('/api/')) return;             // <-- Never cache API responses

        event.respondWith(
            caches.match(event.request)
                .then((cached) => {
                    const networkFetch = fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse.ok) {
                                caches.open(Na__SW_CACHE_NAME)
                                    .then((cache) => cache.put(event.request, networkResponse.clone())) // <-- Background refresh
                                    .catch(() => {});            // <-- Ignore cache-write failures (opaque/partial responses)
                            }
                            return networkResponse;
                        })
                        .catch((err) => {
                            if (cached) return cached;           // <-- Network down — serve the stale cached copy
                            throw err;                           // <-- No cache to fall back on — surface the failure
                        });
                    return cached || networkFetch;               // <-- Serve from cache first; fall back to network
                })
        );
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
