// =============================================================================
// TRUEVISION3D - PWA SERVICE WORKER LOADER STUB
// =============================================================================
//
// FILE       : Na__Pwa__ServiceWorker__.js
// NAMESPACE  : TrueVision3D
// MODULE     : Na__Pwa__ServiceWorker
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Top-level service worker entrypoint, placed here for max scope
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - A service worker's scope can never be broader than the folder its script
//   is served from, unless the server sends a Service-Worker-Allowed header.
//   GitHub Pages cannot send one, so the script's LOCATION is the scope.
// - This file therefore sits at the TrueVision app root, giving the worker
//   scope over the whole of:
//       /na-apps/30__TrueVision__CoreAppCode/
//   which covers Index.html, every stylesheet and every app module.
// - All the real logic lives in the install module folder to keep the codebase
//   tidy; it is pulled in with importScripts() so this loader stays trivial.
// - DO NOT MOVE THIS FILE. Moving it silently narrows or breaks the scope, and
//   with it the install offer on every Chromium browser.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack.
//
// =============================================================================


// REGION | Service Worker Constants
// ------------------------------------------------------------
const NA_PWA_SW_LOGIC_RELATIVE_PATH = '02__Src__AppModules/62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js';   // <-- Logic location, relative to this stub
// ------------------------------------------------------------


// REGION | Bootstrap Logic Import
// ------------------------------------------------------------
try {
    importScripts(NA_PWA_SW_LOGIC_RELATIVE_PATH);                                                                                   // <-- Pull in the real service worker logic
} catch (importError) {
    self.addEventListener('install',  () => self.skipWaiting());                                                                    // <-- Minimal install fallback
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));                                            // <-- Minimal activate fallback
    self.addEventListener('fetch',    () => {});                                                                                    // <-- Pass-through fetch, keeps installability
    console.error('[TrueVision3D PWA SW] Service worker logic failed to load:', importError);                                        // <-- Surface the diagnostic
}
// ------------------------------------------------------------
