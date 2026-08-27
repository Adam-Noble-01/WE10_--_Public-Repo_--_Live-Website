// =============================================================================
// TRUEVISION3D - DEV MENU CACHE AND STORAGE CONTROLS (LOCALHOST ONLY)
// =============================================================================
//
// FILE       : Na__UiFeature__DevMenu__CacheAndStorage__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : DevMenu - Cache and Storage Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One-click cache bust and full storage reset for local testing
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Adds a "Cache & Storage" panel to the localhost-only Dev Tools menu so a
//   cache bust does not require the DevTools Application tab or a console
//   one-liner.
// - Two actions, deliberately separated by how much they destroy:
//     Bust Caches  - service worker caches + registrations, then reload.
//                    The everyday "am I actually running my latest edit"
//                    button. Leaves cookies and saved app state alone.
//     Full Reset   - the above plus cookies, localStorage, sessionStorage and
//                    IndexedDB. The "test this as a brand new visitor" button.
//                    Two-step confirm, because it throws away real state.
// - A live readout shows what is currently stored, so it is obvious whether a
//   reset actually did anything.
// - Cache and service worker teardown delegates to the PWA registrar
//   (window.TrueVision__Pwa__ServiceWorker__Registrar) so there is one
//   implementation of that logic. Cookies and IndexedDB are handled here
//   because the registrar does not cover them.
// - Every step is independently guarded: one failing storage API must never
//   prevent the rest of the reset from running.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeCacheAndStorageDevControls() from Index.html
//   alongside the other dev control initialisers. It is inert unless the
//   markup is present, and the markup lives inside the Dev Tools menu which
//   Na__UiFeature__DevMenu__LocalhostOnly.js keeps hidden off localhost.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial Release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__CacheDev__ItemId          = 'naCacheStorageDevItem';        // <-- Dev menu list item
    const Na__CacheDev__ToggleId        = 'naCacheStorageDevToggle';      // <-- Submenu toggle button
    const Na__CacheDev__PanelId         = 'naCacheStorageDevPanel';       // <-- Collapsible submenu panel
    const Na__CacheDev__ReadoutId       = 'naCacheStorageDevReadout';     // <-- Live "what is stored" readout
    const Na__CacheDev__RefreshBtnId    = 'naCacheStorageDevRefresh';     // <-- Re-read the readout
    const Na__CacheDev__BustBtnId       = 'naCacheStorageDevBust';        // <-- Caches + workers, then reload
    const Na__CacheDev__ResetBtnId      = 'naCacheStorageDevReset';       // <-- Everything, then reload
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Confirm Window
    // ------------------------------------------------------------
    const Na__CacheDev__ConfirmWindowMs = 4000;    // <-- Full Reset arm window before it disarms itself
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Runtime References
    // ------------------------------------------------------------
    let Na__CacheDev__IsInitialized = false;   // <-- Guard against double init
    let Na__CacheDev__ResetArmed    = false;   // <-- Full Reset is awaiting its second click
    let Na__CacheDev__ResetTimer    = null;    // <-- Disarm timer handle
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storage Inspection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Count What Is Currently Stored For This Origin
    // ------------------------------------------------------------
    async function Na__CacheDev__ReadStorageSummary() {
        const summary = {
            caches      : 0,
            workers     : 0,
            localKeys   : 0,
            sessionKeys : 0,
            cookies     : 0,
            databases   : 0
        };

        try {
            if (typeof caches !== 'undefined') {
                summary.caches = (await caches.keys()).length;                   // <-- Cache Storage buckets
            }
        } catch { /* Cache API blocked */ }

        try {
            if (navigator.serviceWorker) {
                summary.workers = (await navigator.serviceWorker.getRegistrations()).length;
            }
        } catch { /* SW API blocked */ }

        try { summary.localKeys   = window.localStorage.length; }   catch { /* storage blocked */ }
        try { summary.sessionKeys = window.sessionStorage.length; } catch { /* storage blocked */ }

        try {
            summary.cookies = document.cookie
                ? document.cookie.split(';').filter(entry => entry.trim().length > 0).length
                : 0;
        } catch { /* cookies blocked */ }

        try {
            if (indexedDB && typeof indexedDB.databases === 'function') {
                summary.databases = (await indexedDB.databases()).length;         // <-- Not implemented in Firefox
            }
        } catch { /* enumeration unsupported */ }

        return summary;
    }
    // ------------------------------------------------------------


    // FUNCTION | Repaint the Readout Line
    // ------------------------------------------------------------
    async function Na__CacheDev__RefreshReadout() {
        const readout = document.getElementById(Na__CacheDev__ReadoutId);
        if (!readout) return;

        readout.textContent = 'Reading...';

        const s = await Na__CacheDev__ReadStorageSummary();

        readout.textContent =
            `${s.caches} cache${s.caches === 1 ? '' : 's'} · ` +
            `${s.workers} worker${s.workers === 1 ? '' : 's'} · ` +
            `${s.cookies} cookie${s.cookies === 1 ? '' : 's'} · ` +
            `${s.localKeys} local · ${s.sessionKeys} session · ${s.databases} db`;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Storage Teardown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Expire Every Cookie Readable From This Document
    // ------------------------------------------------------------
    // document.cookie only exposes cookies for the current host and path, and
    // a cookie can only be deleted by re-setting it with an EXACTLY matching
    // path and domain. Sweeping every ancestor path (with and without its
    // trailing slash) against the host (with and without a leading dot)
    // covers everything a local dev server realistically sets.
    // HttpOnly cookies are invisible to script and cannot be cleared here.
    // ------------------------------------------------------------
    function Na__CacheDev__ClearCookies() {
        let cleared = 0;

        try {
            const cookieEntries = document.cookie ? document.cookie.split(';') : [];
            if (cookieEntries.length === 0) return 0;

            const hostname   = window.location.hostname;
            const pathParts  = window.location.pathname.split('/');

            // Cookie deletion needs an EXACT path match, so sweep every ancestor
            // path both with and without a trailing slash - a cookie set on
            // "/na-apps/app/" is not cleared by expiring "/na-apps/app".
            const paths = ['/'];
            let builtPath = '';
            for (const part of pathParts) {
                if (!part) continue;
                builtPath += `/${part}`;
                paths.push(builtPath);                                           // <-- e.g. /na-apps/30__TrueVision__CoreAppCode
                paths.push(`${builtPath}/`);                                     // <-- e.g. /na-apps/30__TrueVision__CoreAppCode/
            }

            const domains = [undefined, hostname, `.${hostname}`];               // <-- Host-only, explicit host, and dot-prefixed

            for (const entry of cookieEntries) {
                const name = entry.split('=')[0].trim();
                if (!name) continue;

                for (const path of paths) {
                    for (const domain of domains) {
                        const domainClause = domain ? `; domain=${domain}` : '';
                        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domainClause}`;
                    }
                }
                cleared += 1;
            }
        } catch (error) {
            console.warn('[TrueVision3D Dev] Cookie clear failed:', error);
        }

        return cleared;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Delete Every Enumerable IndexedDB Database
    // ------------------------------------------------------------
    async function Na__CacheDev__ClearIndexedDb() {
        try {
            if (!indexedDB || typeof indexedDB.databases !== 'function') return 0; // <-- Firefox cannot enumerate; nothing safe to do

            const databases = await indexedDB.databases();
            await Promise.all(databases.map(database => new Promise((resolve) => {
                if (!database.name) return resolve();
                const request     = indexedDB.deleteDatabase(database.name);
                request.onsuccess = () => resolve();
                request.onerror   = () => resolve();                             // <-- Never block the rest of the reset
                request.onblocked = () => resolve();                             // <-- An open connection elsewhere; move on
            })));

            return databases.length;
        } catch (error) {
            console.warn('[TrueVision3D Dev] IndexedDB clear failed:', error);
            return 0;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve the PWA Registrar API If It Loaded
    // ------------------------------------------------------------
    function Na__CacheDev__GetPwaRegistrar() {
        return (typeof window !== 'undefined' && window.TrueVision__Pwa__ServiceWorker__Registrar)
            ? window.TrueVision__Pwa__ServiceWorker__Registrar
            : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop Caches and Workers Without Reloading
    // ------------------------------------------------------------
    // The registrar's clearCache() reloads as its final act, which is wrong
    // when more teardown still has to run. This does the same teardown and
    // leaves the reload to the caller.
    // ------------------------------------------------------------
    async function Na__CacheDev__ClearCachesAndWorkers() {
        const result = { caches: 0, workers: 0 };

        try {
            if (typeof caches !== 'undefined') {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
                result.caches = cacheNames.length;
            }
        } catch (error) {
            console.warn('[TrueVision3D Dev] Cache clear failed:', error);
        }

        try {
            if (navigator.serviceWorker) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(registration => registration.unregister()));
                result.workers = registrations.length;
            }
        } catch (error) {
            console.warn('[TrueVision3D Dev] Service worker unregister failed:', error);
        }

        return result;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Bust Caches - Service Worker Caches and Registrations Only
    // ------------------------------------------------------------
    async function Na__CacheDev__HandleBustClick() {
        const button = document.getElementById(Na__CacheDev__BustBtnId);
        if (button) { button.disabled = true; button.textContent = 'Busting...'; }

        const registrar = Na__CacheDev__GetPwaRegistrar();

        if (registrar && typeof registrar.clearCache === 'function') {
            await registrar.clearCache();                                        // <-- Delegates, and reloads on completion
            return;
        }

        const result = await Na__CacheDev__ClearCachesAndWorkers();              // <-- Fallback: registrar script not loaded
        console.log(`[TrueVision3D Dev] Cleared ${result.caches} cache(s), ${result.workers} worker(s) - reloading.`);
        window.location.reload();
    }
    // ------------------------------------------------------------


    // FUNCTION | Full Reset - Cookies, Storage, Databases, Caches, Workers
    // ------------------------------------------------------------
    async function Na__CacheDev__PerformFullReset() {
        const button = document.getElementById(Na__CacheDev__ResetBtnId);
        if (button) { button.disabled = true; button.textContent = 'Resetting...'; }

        const report = { cookies: 0, databases: 0, caches: 0, workers: 0 };

        report.cookies   = Na__CacheDev__ClearCookies();                         // <-- Cookies first, while the page is still intact
        report.databases = await Na__CacheDev__ClearIndexedDb();

        try { window.localStorage.clear(); }   catch { /* storage blocked */ }
        try { window.sessionStorage.clear(); } catch { /* storage blocked */ }

        const cacheResult = await Na__CacheDev__ClearCachesAndWorkers();         // <-- Done here so nothing reloads mid-sequence
        report.caches  = cacheResult.caches;
        report.workers = cacheResult.workers;

        console.log(
            `[TrueVision3D Dev] Full reset: ${report.cookies} cookie(s), ${report.databases} database(s), ` +
            `${report.caches} cache(s), ${report.workers} worker(s), local + session storage cleared - reloading.`
        );

        window.location.reload();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Two-Step Confirm Wrapper for Full Reset
    // ------------------------------------------------------------
    function Na__CacheDev__HandleResetClick() {
        const button = document.getElementById(Na__CacheDev__ResetBtnId);
        if (!button) return;

        if (Na__CacheDev__ResetArmed) {                                          // <-- Second click within the window: go
            window.clearTimeout(Na__CacheDev__ResetTimer);
            Na__CacheDev__ResetArmed = false;
            Na__CacheDev__PerformFullReset();
            return;
        }

        Na__CacheDev__ResetArmed = true;                                         // <-- First click: arm and warn
        button.textContent = 'Click again to confirm';

        Na__CacheDev__ResetTimer = window.setTimeout(() => {
            Na__CacheDev__ResetArmed = false;
            button.textContent = 'Full Reset';                                   // <-- Disarm if the second click never comes
        }, Na__CacheDev__ConfirmWindowMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Cache and Storage Dev Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeCacheAndStorageDevControls() {
        if (Na__CacheDev__IsInitialized) return;                                 // <-- Guard: already initialized

        const item = document.getElementById(Na__CacheDev__ItemId);
        if (!item) return;                                                       // <-- Markup absent; nothing to wire

        Na__CacheDev__IsInitialized = true;
        item.style.display = '';                                                 // <-- Reveal within the (localhost-gated) dev menu

        const wire = (id, handler) => {
            const element = document.getElementById(id);
            if (element) element.addEventListener('click', handler);
        };

        wire(Na__CacheDev__RefreshBtnId, Na__CacheDev__RefreshReadout);
        wire(Na__CacheDev__BustBtnId,    Na__CacheDev__HandleBustClick);
        wire(Na__CacheDev__ResetBtnId,   Na__CacheDev__HandleResetClick);

        // SUBMENU OPEN/CLOSE | Each dev panel wires its own toggle; there is no
        // shared handler, so this panel must do it too or it never opens.
        // ------------------------------------------------------------
        const toggle = document.getElementById(Na__CacheDev__ToggleId);
        const panel  = document.getElementById(Na__CacheDev__PanelId);

        if (toggle && panel) {
            toggle.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
                toggle.setAttribute('aria-expanded', String(!isOpen));

                if (!isOpen) Na__CacheDev__RefreshReadout();                     // <-- Re-read only when opening
            });
        }

        Na__CacheDev__RefreshReadout();                                          // <-- Paint an initial value
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cache and Storage Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeCacheAndStorageDevControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
