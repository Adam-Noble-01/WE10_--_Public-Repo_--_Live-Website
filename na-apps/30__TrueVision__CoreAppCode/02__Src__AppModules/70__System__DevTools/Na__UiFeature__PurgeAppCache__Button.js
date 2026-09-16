// =============================================================================
// TRUEVISION3D - PURGE APP CACHE BUTTON
// =============================================================================
//
// FILE       : Na__UiFeature__PurgeAppCache__Button.js
// NAMESPACE  : TrueVision3D
// MODULE     : Na__UiFeature__PurgeAppCache__Button
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Wire the App Settings submenu and its Purge App Cache button
// CREATED    : 16-Sep-2026
//
// DESCRIPTION:
// - Wires the App Settings submenu open/close toggle in the Tools and Settings
//   menu, and the Purge App Cache button inside it.
// - A confirm() dialog guards the button: it throws away every cache the app
//   holds, so a mis-click on a slow connection is expensive.
// - Delegates to window.TrueVision__Pwa__ServiceWorker__Registrar.purgeApp(),
//   the registrar's existing nuclear recovery path: it wipes Cache Storage,
//   unregisters the service worker, clears storage and hard-reloads. That
//   function already existed and was reachable only from the console.
// - Falls back to a plain reload if the registrar has not loaded.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 70__System__DevTools/Na__UiFeature__PurgeAppCache__Button.js 1.0.0
// - Ported on     : 16-Sep-2026 for TrueVision3D v2.56.0
// - Divergences   : the registrar is TrueVision's own and the function it
//                   exposes is purgeApp rather than purgeAppCache.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Sep-2026 - Version 1.0.0
// - Initial release, alongside the new App Settings menu section.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Purge App Cache Button
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize App Settings Submenu and Purge App Cache Button
    // ------------------------------------------------------------
    export function Na__UiFeature__InitializePurgeAppCacheButton() {
        Na__UiFeature__WireAppSettingsSubmenuToggle();                           // <-- Wire App Settings submenu expand/collapse
        Na__UiFeature__WirePurgeCacheAction();                                   // <-- Wire Purge App Cache button click
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Wire App Settings Submenu Toggle
    // ---------------------------------------------------------------
    function Na__UiFeature__WireAppSettingsSubmenuToggle() {
        const toggleButton = document.getElementById('naAppSettingsToggle');
        const panel        = document.getElementById('naAppSettingsPanel');
        if (!toggleButton || !panel) return;                                     // <-- Elements not in DOM, skip silently

        toggleButton.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);                          // <-- Same pattern as all other submenus
            toggleButton.setAttribute('aria-expanded', String(!isOpen));
        });
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Wire Purge App Cache Action Button
    // ---------------------------------------------------------------
    function Na__UiFeature__WirePurgeCacheAction() {
        const button = document.getElementById('naPurgeAppCacheAction');
        if (!button) return;                                                     // <-- Button not in DOM, skip silently

        button.addEventListener('click', Na__UiFeature__HandlePurgeCacheClick);  // <-- Wire click handler
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Handle Purge App Cache Button Click
    // ---------------------------------------------------------------
    function Na__UiFeature__HandlePurgeCacheClick() {
        const confirmed = window.confirm(                                        // <-- Guard against accidental click
            'Purge App Cache?\n\nThis will clear all cached data and reload the app from scratch.'
        );
        if (!confirmed) return;                                                  // <-- Bail if user cancels

        const registrar = window.TrueVision__Pwa__ServiceWorker__Registrar;
        if (registrar && typeof registrar.purgeApp === 'function') {
            registrar.purgeApp();                                                // <-- Full purge, then hard reload
        } else {
            window.location.reload();                                            // <-- Fallback: plain reload if registrar unavailable
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------
