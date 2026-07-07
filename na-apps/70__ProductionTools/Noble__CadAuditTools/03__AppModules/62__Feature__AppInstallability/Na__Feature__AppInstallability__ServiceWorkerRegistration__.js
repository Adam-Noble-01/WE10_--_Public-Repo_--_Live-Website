// =============================================================================
// NOBLE CAD AUDIT TOOLS - SERVICE WORKER REGISTRATION
// =============================================================================
//
// FILE      : Na__Feature__AppInstallability__ServiceWorkerRegistration__.js
// NAMESPACE : CadAuditTools.AppInstallability
// MODULE    : ServiceWorkerRegistration
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Registers the PWA service worker at app startup
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Non-module script loaded directly by Na__App__.html (no ES module import).
// - Registers Na__ServiceWorker__CadAuditTools.js at the application root scope.
// - Logs registration status to console for debugging.
// - Handles the browser install prompt via 'beforeinstallprompt' event.
// - Exposes window.Na__PwaInstall__Prompt for the install button (if added later).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================

(function () {

    // FUNCTION | Register the Service Worker
    // ------------------------------------------------------------
    function Na__Pwa__RegisterServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('[Na__Pwa] Service Worker not supported in this browser.');
            return;
        }

        navigator.serviceWorker
            .register('/Na__ServiceWorker__CadAuditTools.js', { scope: '/' })
            .then((registration) => {
                console.log('[Na__Pwa] Service Worker registered. Scope:', registration.scope);
            })
            .catch((err) => {
                console.error('[Na__Pwa] Service Worker registration failed:', err);
            });
    }
    // ------------------------------------------------------------


    // FUNCTION | Capture the Browser Install Prompt for Deferred Use
    // ------------------------------------------------------------
    function Na__Pwa__CaptureDeferredInstallPrompt() {
        window.Na__PwaInstall__Prompt = null;                            // <-- Will be set when browser fires event

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();                                      // <-- Prevent automatic browser banner
            window.Na__PwaInstall__Prompt = event;                      // <-- Store for later manual trigger
            console.log('[Na__Pwa] Install prompt captured — call window.Na__PwaInstall__Prompt.prompt() to trigger.');
        });

        window.addEventListener('appinstalled', () => {
            window.Na__PwaInstall__Prompt = null;                       // <-- Clear prompt after install
            console.log('[Na__Pwa] App installed successfully.');
        });
    }
    // ------------------------------------------------------------


    // INITIALISE — Run on Script Load
    Na__Pwa__RegisterServiceWorker();
    Na__Pwa__CaptureDeferredInstallPrompt();

})();
