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
// - NETWORK-FIRST for same-origin app code (HTML, CSS, JS modules, JSON): the
//   worker always tries the network first and only falls back to cache when
//   offline. This is the correct strategy for a localhost dev tool — code edits
//   appear on the FIRST reload, never the second (the old stale-while-revalidate
//   strategy served yesterday's cached module while refreshing in the
//   background, so new features needed two reloads to show up).
// - CACHE-FIRST for rarely-changing binary assets (icons, manifest) for speed.
// - Cache key is versioned — bump Na__SW_CACHE_NAME to evict everything.
// - Only handles same-origin GET requests; /api/ and cross-origin pass through.
//
// NOTE: This is a localhost PWA tool, so offline support is a secondary concern.
//       The primary benefit is install-to-taskbar / install-to-dock capability.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 08-Jul-2026 - Version 0.3.5
// - Switched app code to NETWORK-FIRST so edits are picked up on one reload
//   (fixes stale-JS-after-restart during active development). Icons/manifest
//   stay cache-first. Cache bumped to v4; precache list refreshed to include
//   the current module set (progress overlay, project manager, dimension tools,
//   lasso, entity pruner).
//
// 07-Jul-2026 - Version 0.3.4
// - Bumped cache to v3 and pre-cached the PWA icon assets so installed clients
//   pick up the fixed manifest (root-absolute scope/start_url) and icons.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Cache Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cache Versioning
    // ------------------------------------------------------------
    const Na__SW_CACHE_NAME  = 'na-cad-audit-tools-shell-v8'; // <-- Bump version to force cache refresh
    const Na__SW_APP_SHELL   = [                               // <-- Offline fallback set (network-first serves these live)
        './',
        './Na__App__.html',
        './Na__App__Main__.js',
        './03__AppStyles/Na__StyleSheet__EditorTheme__.css',
        './02__AppData/Na__AppData__AppConfig__.json',
        './02__AppData/Na__AppData__KeybindingsAndControls__.json',
        './03__AppModules/01__AppCore/Na__AppCore__EventBus__.js',
        './03__AppModules/01__AppCore/Na__AppCore__AppState__.js',
        './03__AppModules/01__AppCore/Na__AppCore__HotkeyManager__.js',
        './03__AppModules/01__AppCore/Na__AppCore__Keybindings__.js',
        './03__AppModules/01__AppCore/Na__AppCore__SelectionManager__.js',
        './03__AppModules/01__AppCore/Na__AppCore__UndoManager__.js',
        './03__AppModules/01__AppCore/Na__AppCore__ConnectionMonitor__.js',
        './03__AppModules/02__UI/Na__UI__Toolbar__.js',
        './03__AppModules/02__UI/Na__UI__LayersPanel__.js',
        './03__AppModules/02__UI/Na__UI__PropertiesPanel__.js',
        './03__AppModules/02__UI/Na__UI__StatusBar__.js',
        './03__AppModules/02__UI/Na__UI__UploadPanel__.js',
        './03__AppModules/02__UI/Na__UI__ProgressOverlay__.js',
        './03__AppModules/02__UI/Na__UI__ProjectManager__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__Canvas__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__EntityLoader__.js',
        './03__AppModules/03__CadEngine/Na__CadEngine__ExportSerializer__.js',
        './03__AppModules/03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js',
        './03__AppModules/System__SelectionTools/Na__SelectionTools__BoxSelectTool__.js',
        './03__AppModules/System__SelectionTools/Na__SelectionTools__LassoSelectTool__.js',
        './03__AppModules/System__Navigation/Na__Navigation__ViewBoxController__.js',
        './03__AppModules/System__DimensionTools/Na__DimensionTools__SnapEngine__.js',
        './03__AppModules/System__DimensionTools/Na__DimensionTools__DimensionRenderer__.js',
        './03__AppModules/System__DimensionTools/Na__DimensionTools__LinearDimensionTool__.js',
        './03__AppModules/System__DimensionTools/Na__DimensionTools__AlignedDimensionTool__.js',
        './03__AppModules/62__Feature__AppInstallability/Na__AppInstallability__Manifest.webmanifest',
        './01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__192x192.png',
        './01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__512x512.png',
    ];

    // Binary assets served cache-first (rarely change); everything else is network-first.
    const Na__SW_CACHE_FIRST_RE = /\.(png|jpg|jpeg|webp|svg|ico|woff2?|ttf)$|Manifest\.webmanifest$/i;
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


    // FUNCTION | Fetch — Network-First for App Code, Cache-First for Assets
    // ------------------------------------------------------------
    self.addEventListener('fetch', (event) => {
        // Pass through non-GET requests and cross-origin (CDN) requests uncached
        if (event.request.method !== 'GET') return;
        if (!event.request.url.startsWith(self.location.origin)) return;

        // Pass through API calls to the Flask server uncached
        const url = new URL(event.request.url);
        if (url.pathname.startsWith('/api/')) return;             // <-- Never cache API responses

        // CACHE-FIRST — binary assets that rarely change (icons, fonts, manifest)
        if (Na__SW_CACHE_FIRST_RE.test(url.pathname)) {
            event.respondWith(Na__SW_CacheFirst(event.request));
            return;
        }

        // NETWORK-FIRST — app code (HTML/JS/CSS/JSON): always fresh, cache is only the offline fallback
        event.respondWith(Na__SW_NetworkFirst(event.request));
    });
    // ------------------------------------------------------------


    // HELPER FUNCTION | Network-First — Fresh When Online, Cached When Offline
    // ------------------------------------------------------------
    async function Na__SW_NetworkFirst(request) {
        try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.ok) {
                const copy = networkResponse.clone();
                caches.open(Na__SW_CACHE_NAME)
                    .then((cache) => cache.put(request, copy))    // <-- Refresh the offline fallback copy
                    .catch(() => {});
            }
            return networkResponse;
        } catch (err) {
            const cached = await caches.match(request);
            if (cached) return cached;                            // <-- Offline — serve last known good copy
            throw err;                                            // <-- Nothing cached — surface the failure
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Cache-First — Cached When Present, Network Otherwise
    // ------------------------------------------------------------
    async function Na__SW_CacheFirst(request) {
        const cached = await caches.match(request);
        if (cached) return cached;                                // <-- Fast path for stable binary assets

        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(Na__SW_CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
        }
        return networkResponse;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
