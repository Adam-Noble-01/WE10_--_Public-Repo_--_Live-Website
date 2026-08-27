// =============================================================================
// TRUEVISION3D - PWA SERVICE WORKER REGISTRAR
// =============================================================================
//
// FILE       : TrueVision__Pwa__ServiceWorker__Registrar__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__ServiceWorker__Registrar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Register the TrueVision service worker and manage its updates
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - A service worker with a fetch handler is a hard requirement for Chromium
//   to fire beforeinstallprompt, so without this module there is no install
//   offer on Android or on the desktop at all.
// - Reads the script URL and scope from TrueVision__Pwa__Url so all path
//   resolution stays in one place.
// - Skips registration on non-secure origins (file://, remote http://) to
//   avoid the well-known browser warning.
// - Bridges the controllerchange event to a guarded, idle-aware reload: when a
//   new worker activates and claims the page, the page reloads exactly once
//   (sessionStorage guard) so the module graph stays consistent. The reload is
//   held back while a model load is in flight, because yanking the page out
//   from under a client watching a 200 MB model download would be brutal.
// - Ships two recovery routes for a stale install:
//       window.TrueVision__Pwa__ClearCache()   - wipe caches and workers
//       window.TrueVision__Pwa__PurgeApp()     - the above plus local storage
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module State and Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Reload Guard Timings
    // ------------------------------------------------------------
    const REGISTRAR_RELOAD_SESSION_KEY      = 'naTrueVision__Pwa__SwReloadDone';                                                    // <-- sessionStorage guard key
    const REGISTRAR_RELOAD_POLL_MAX_MS      = 45000;                                                                                // <-- Give up waiting for idle after this
    const REGISTRAR_RELOAD_POLL_INTERVAL_MS = 750;                                                                                  // <-- Idle poll interval
    // ------------------------------------------------------------


    // MODULE VARIABLES | Registration State Cache
    // ------------------------------------------------------------
    let TrueVision__Pwa__ServiceWorker__Registrar__Started      = false;                                                            // <-- Idempotent boot flag
    let TrueVision__Pwa__ServiceWorker__Registrar__Registration = null;                                                             // <-- Active ServiceWorkerRegistration
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Determine Whether Registration Is Allowed Here
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__IsRegistrationAllowed() {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;                                      // <-- API unavailable
        if (typeof window === 'undefined') return false;                                                                            // <-- Non-window context

        const protocol      = window.location.protocol;                                                                             // <-- Page protocol
        const hostname      = window.location.hostname;                                                                             // <-- Page hostname

        if (protocol === 'https:') return true;                                                                                     // <-- HTTPS is always allowed
        if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0')) return true;  // <-- Localhost dev is allowed
        return false;                                                                                                               // <-- Block file:// and remote http://
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Service Worker URL and Scope
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__ResolveTargets() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        if (!urlHelper) return null;                                                                                                // <-- No helper available, bail

        const scriptUrl     = urlHelper.getServiceWorkerUrl();                                                                      // <-- Absolute SW script URL
        const scopeUrl      = urlHelper.getServiceWorkerScope();                                                                    // <-- Scope URL

        if (!scriptUrl || !scopeUrl) return null;                                                                                   // <-- Validate the output
        return { url: scriptUrl, scope: scopeUrl };                                                                                 // <-- Composite descriptor
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Is a Model Load Currently In Flight
    // ---------------------------------------------------------------
    // Two signals, either of which means "do not reload right now":
    //   * an explicit flag any module can raise
    //   * the boot loading overlay still being on screen
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__IsLoadInFlight() {
        if (window.TrueVision__Pwa__IsLoadingActive === true) return true;                                                          // <-- Explicit flag raised by the app

        const loadingOverlay = document.getElementById('loadingOverlay');                                                           // <-- Boot loading overlay
        if (loadingOverlay && !loadingOverlay.classList.contains('hidden')
            && loadingOverlay.style.display !== 'none') {
            return true;                                                                                                            // <-- Still booting
        }

        return false;                                                                                                               // <-- Safe to reload
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Bridge controllerchange to a Guarded Idle Reload
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__BridgeControllerChange() {
        if (!navigator.serviceWorker) return;                                                                                       // <-- Guard: SW not available

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            try {
                if (sessionStorage.getItem(REGISTRAR_RELOAD_SESSION_KEY)) return;                                                   // <-- Already reloaded this session
                sessionStorage.setItem(REGISTRAR_RELOAD_SESSION_KEY, '1');                                                          // <-- Mark before any async work
            } catch (error) {
                // Storage blocked; the in-page flag below still prevents a loop within this page load
            }

            let elapsedMs   = 0;                                                                                                    // <-- Accumulated polling time

            function TrueVision__Pwa__ServiceWorker__Registrar__AttemptReload() {
                if (!TrueVision__Pwa__ServiceWorker__Registrar__IsLoadInFlight()) {
                    console.log('[TrueVision3D PWA] New service worker active - reloading for a consistent module graph.');
                    window.location.reload();                                                                                       // <-- Safe to reload now
                    return;
                }

                elapsedMs += REGISTRAR_RELOAD_POLL_INTERVAL_MS;
                if (elapsedMs >= REGISTRAR_RELOAD_POLL_MAX_MS) {
                    console.warn('[TrueVision3D PWA] Load still in flight after 45s - skipping the update reload.');
                    return;                                                                                                         // <-- Give up rather than interrupt a load
                }

                setTimeout(TrueVision__Pwa__ServiceWorker__Registrar__AttemptReload, REGISTRAR_RELOAD_POLL_INTERVAL_MS);            // <-- Poll again
            }

            TrueVision__Pwa__ServiceWorker__Registrar__AttemptReload();                                                             // <-- Start the poll loop immediately
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Recovery Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | Wipe Every Cache and Service Worker, Then Reload
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Registrar__ClearCacheAndReload() {
        try {
            if (typeof caches !== 'undefined') {
                const cacheNames = await caches.keys();                                                                             // <-- Enumerate every cache bucket
                await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));                                           // <-- Drop them all
            }

            if (navigator.serviceWorker) {
                const registrations = await navigator.serviceWorker.getRegistrations();                                             // <-- Enumerate every worker
                await Promise.all(registrations.map(registration => registration.unregister()));                                    // <-- Unregister them all
            }

            try { sessionStorage.removeItem(REGISTRAR_RELOAD_SESSION_KEY); } catch (error) { /* storage blocked */ }                 // <-- Allow one reload after the reset

            console.log('[TrueVision3D PWA] Caches and service workers cleared - reloading.');
        } catch (error) {
            console.warn('[TrueVision3D PWA] Cache clear failed:', error);                                                          // <-- Log, then reload anyway
        }

        window.location.reload();                                                                                                   // <-- Fresh start
    }
    // ---------------------------------------------------------------


    // FUNCTION | Full App Purge Including Local Storage, Then Reload
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Registrar__PurgeAppAndReload() {
        try {
            if (typeof window.localStorage !== 'undefined') window.localStorage.clear();                                            // <-- Drop saved app state
            if (typeof window.sessionStorage !== 'undefined') window.sessionStorage.clear();                                        // <-- Drop session flags
        } catch (error) {
            console.warn('[TrueVision3D PWA] Storage purge failed:', error);                                                        // <-- Log, continue to the cache wipe
        }

        await TrueVision__Pwa__ServiceWorker__Registrar__ClearCacheAndReload();                                                     // <-- Then wipe caches and reload
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Service Worker
    // ------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__Register() {
        if (TrueVision__Pwa__ServiceWorker__Registrar__Started) return;                                                             // <-- Idempotent guard
        TrueVision__Pwa__ServiceWorker__Registrar__Started = true;

        if (!TrueVision__Pwa__ServiceWorker__Registrar__IsRegistrationAllowed()) {
            console.log('[TrueVision3D PWA] Service worker not registered - insecure origin or unsupported browser.');
            return;
        }

        const targets   = TrueVision__Pwa__ServiceWorker__Registrar__ResolveTargets();                                              // <-- Resolve the script URL and scope
        if (!targets) {
            console.warn('[TrueVision3D PWA] Service worker targets could not be resolved.');
            return;
        }

        TrueVision__Pwa__ServiceWorker__Registrar__BridgeControllerChange();                                                        // <-- Arm the update reload bridge

        navigator.serviceWorker.register(targets.url, { scope: targets.scope })
            .then((registration) => {
                TrueVision__Pwa__ServiceWorker__Registrar__Registration = registration;                                             // <-- Retain the registration
                console.log(`[TrueVision3D PWA] Service worker registered. Scope: ${registration.scope}`);
                registration.update();                                                                                              // <-- Ask for a freshness check on every boot
            })
            .catch((error) => {
                console.warn('[TrueVision3D PWA] Service worker registration failed:', error);                                       // <-- Never break app boot
            });
    }
    // ---------------------------------------------------------------


    // FUNCTION | Get the Active Registration (Diagnostic)
    // ------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__GetRegistration() {
        return TrueVision__Pwa__ServiceWorker__Registrar__Registration;                                                             // <-- Expose for console inspection
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure and Bootstrap
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Bootstrap Registrar Initialization
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Registrar__Bootstrap() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__ServiceWorker__Registrar = {                                                                        // <-- Public API surface
            register        : TrueVision__Pwa__ServiceWorker__Registrar__Register,
            getRegistration : TrueVision__Pwa__ServiceWorker__Registrar__GetRegistration,
            clearCache      : TrueVision__Pwa__ServiceWorker__Registrar__ClearCacheAndReload,
            purgeApp        : TrueVision__Pwa__ServiceWorker__Registrar__PurgeAppAndReload
        };

        window.TrueVision__Pwa__ClearCache = TrueVision__Pwa__ServiceWorker__Registrar__ClearCacheAndReload;                        // <-- One-liner console recovery
        window.TrueVision__Pwa__PurgeApp   = TrueVision__Pwa__ServiceWorker__Registrar__PurgeAppAndReload;                          // <-- Nuclear console recovery

        if (document.readyState === 'complete') {
            TrueVision__Pwa__ServiceWorker__Registrar__Register();                                                                  // <-- Page already loaded, register now
            return;
        }

        window.addEventListener('load', TrueVision__Pwa__ServiceWorker__Registrar__Register, { once: true });                        // <-- Register after first paint
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__ServiceWorker__Registrar__Bootstrap();                                                                          // <-- Kick off bootstrap

// endregion -------------------------------------------------------------------

})();
