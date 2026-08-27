// =============================================================================
// TRUEVISION3D - PWA HANDLER (CHROMIUM FAMILY)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__Chromium__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__Chromium
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drive the native install flow on Chromium desktop and Android
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Captures the beforeinstallprompt event and defers the browser's own
//   mini-infobar so a Noble Architecture styled bar can be shown instead.
// - Calls prompt() from inside the user's click on the primary action, which
//   is the only place the browser will accept it.
// - Reacts to appinstalled by permanently suppressing the prompt for THIS
//   project. Other projects remain free to offer their own install.
// - Covers Chrome, Edge (Chromium), Opera and Samsung Internet on Windows,
//   macOS, Linux and Android, which is every Android phone and Samsung tablet
//   a client is likely to open a model on.
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
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Cached Prompt Event and Flags
    // ------------------------------------------------------------
    let TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent  = null;                                                            // <-- Cached BeforeInstallPromptEvent
    let TrueVision__Pwa__Handler__Chromium__PendingShowRequested = false;                                                           // <-- Show asked for before the event arrived
    let TrueVision__Pwa__Handler__Chromium__SuppressShow         = false;                                                           // <-- Suppress flag set by the controller
    let TrueVision__Pwa__Handler__Chromium__PlatformIdContext    = '';                                                              // <-- Active platform identifier
    let TrueVision__Pwa__Handler__Chromium__ListenersBound       = false;                                                           // <-- Guard against double binding
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Prompt Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__BuildPromptConfig() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextData   = window.TrueVision__Pwa__ProjectContext.get();                                                         // <-- Project descriptor
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon

        const titleText     = contextData.displayName
            ? `Install ${contextData.displayName}`                                                                                  // <-- "Install West Farm"
            : 'Install TrueVision 3D';                                                                                              // <-- Generic install

        const leadText      = contextData.displayName
            ? 'Adds an icon that opens straight into your model, with no browser bars in the way.'
            : 'Adds an icon that opens TrueVision straight from your home screen or desktop.';

        return {
            variant                 : 'bar',                                                                                        // <-- Compact bottom bar
            iconUrl                 : iconUrl,
            iconAltText             : contextData.appName,
            title                   : titleText,
            lead                    : leadText,
            primaryActionLabel      : 'Install',
            secondaryActionLabel    : 'Not Now',
            onPrimary               : TrueVision__Pwa__Handler__Chromium__TriggerNativePrompt,
            onDismiss               : TrueVision__Pwa__Handler__Chromium__OnDismiss
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Trigger the Native Browser Install Dialog
    // ------------------------------------------------------------
    async function TrueVision__Pwa__Handler__Chromium__TriggerNativePrompt() {
        const promptEvent   = TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent;                                              // <-- Snapshot the stored event
        if (!promptEvent) return;                                                                                                   // <-- Nothing captured, bail

        try {
            promptEvent.prompt();                                                                                                   // <-- Show the native install dialog
            const userChoice    = await promptEvent.userChoice;                                                                     // <-- Wait for the user's decision

            if (userChoice && userChoice.outcome === 'accepted') {
                if (window.TrueVision__Pwa__SessionState) {
                    window.TrueVision__Pwa__SessionState.markInstalled();                                                           // <-- Persist accepted state for this project
                }
            } else {
                TrueVision__Pwa__Handler__Chromium__OnDismiss();                                                                    // <-- Treat a decline as a dismissal
            }
        } catch (error) {
            console.warn('[TrueVision3D PWA] Chromium install prompt failed:', error);                                              // <-- Log, never throw
        } finally {
            TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent = null;                                                         // <-- The event is single-use
            if (window.TrueVision__Pwa__PromptUi) {
                window.TrueVision__Pwa__PromptUi.hide();                                                                            // <-- Tear down the bar
            }
        }
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Handle the User Dismissing the Bar
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__OnDismiss() {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.recordDismissal(TrueVision__Pwa__Handler__Chromium__PlatformIdContext);            // <-- Advance the snooze ladder
        }
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Show the Install Bar When Every Condition Is Met
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__MaybeShowBar() {
        if (TrueVision__Pwa__Handler__Chromium__SuppressShow) return;                                                               // <-- Suppressed by the controller
        if (!TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent) return;                                                       // <-- No captured event yet
        if (!window.TrueVision__Pwa__PromptUi) return;                                                                              // <-- Prompt UI not loaded yet

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(TrueVision__Pwa__Handler__Chromium__PlatformIdContext)) {
            return;                                                                                                                 // <-- Snooze still running for this project
        }

        window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__Chromium__BuildPromptConfig());                             // <-- Render the branded bar
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler for a Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__Activate(platformDescriptor) {
        TrueVision__Pwa__Handler__Chromium__PlatformIdContext = (platformDescriptor && platformDescriptor.platformId) || 'chromium-generic';

        if (TrueVision__Pwa__Handler__Chromium__ListenersBound) return;                                                             // <-- Only bind once
        TrueVision__Pwa__Handler__Chromium__ListenersBound = true;

        window.addEventListener('beforeinstallprompt', (installPromptEvent) => {
            installPromptEvent.preventDefault();                                                                                    // <-- Suppress the browser mini-infobar
            TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent = installPromptEvent;                                           // <-- Cache the event for later

            if (TrueVision__Pwa__Handler__Chromium__PendingShowRequested) {
                TrueVision__Pwa__Handler__Chromium__PendingShowRequested = false;                                                    // <-- Consume the pending request
                TrueVision__Pwa__Handler__Chromium__MaybeShowBar();                                                                 // <-- Render now the event exists
            }
        });

        window.addEventListener('appinstalled', () => {
            TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent = null;                                                         // <-- Clear the cached event
            if (window.TrueVision__Pwa__SessionState) {
                window.TrueVision__Pwa__SessionState.markInstalled();                                                               // <-- Persist install state for this project
            }
            if (window.TrueVision__Pwa__PromptUi) {
                window.TrueVision__Pwa__PromptUi.hide();                                                                            // <-- Hide any visible bar
            }
        });
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request the Bar Be Displayed
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__RequestShow() {
        if (TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent) {
            TrueVision__Pwa__Handler__Chromium__MaybeShowBar();                                                                     // <-- Render right away
            return;
        }
        TrueVision__Pwa__Handler__Chromium__PendingShowRequested = true;                                                            // <-- Defer until the event arrives
    }
    // ---------------------------------------------------------------


    // FUNCTION | Report Whether a Native Install Is Currently Available
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__CanInstallNow() {
        return Boolean(TrueVision__Pwa__Handler__Chromium__DeferredPromptEvent);                                                    // <-- True once the event is captured
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (e.g. already running standalone)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__Chromium__SetSuppressed(shouldSuppress) {
        TrueVision__Pwa__Handler__Chromium__SuppressShow = Boolean(shouldSuppress);                                                 // <-- Update the suppress flag
        if (TrueVision__Pwa__Handler__Chromium__SuppressShow && window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide if currently showing
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__Chromium = {                                                                               // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__Chromium__Activate,
            requestShow     : TrueVision__Pwa__Handler__Chromium__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__Chromium__SetSuppressed,
            canInstallNow   : TrueVision__Pwa__Handler__Chromium__CanInstallNow
        };
    }

// endregion -------------------------------------------------------------------

})();
