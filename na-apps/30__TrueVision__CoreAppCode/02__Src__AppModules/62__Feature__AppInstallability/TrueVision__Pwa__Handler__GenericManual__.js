// =============================================================================
// TRUEVISION3D - PWA HANDLER (GENERIC MANUAL INSTALL)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__GenericManual__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__GenericManual
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Catch-all install instructions where no native route exists
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Covers the gaps the platform-specific handlers leave behind:
//     * Firefox on Android, which installs from its own menu
//     * Chromium where beforeinstallprompt never arrived (already installed,
//       criteria not yet met, or the client clicked Install App from the
//       Tools menu before the browser was ready)
//     * Anything the platform detector could not classify
// - Without this, a client on one of those browsers who taps "Install App"
//   would get silence, which reads as a broken button. Explaining the route
//   is far better than nothing.
// - Firefox on desktop cannot install web apps at all, so it is told so
//   plainly and pointed at Chrome or Edge rather than being sent on a hunt
//   through a menu that has no such entry.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Active Platform Context
    // ------------------------------------------------------------
    let TrueVision__Pwa__Handler__GenericManual__PlatformIdContext   = '';                                                          // <-- Active platform identifier
    let TrueVision__Pwa__Handler__GenericManual__Descriptor          = null;                                                        // <-- Cached platform descriptor
    let TrueVision__Pwa__Handler__GenericManual__SuppressShow        = false;                                                       // <-- Suppress flag set by the controller
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Choose the Right Instructions for This Browser
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__BuildInstructions() {
        const descriptor    = TrueVision__Pwa__Handler__GenericManual__Descriptor || {};                                            // <-- Cached descriptor
        const platformIds   = (window.TrueVision__Pwa__PlatformDetector || {}).PlatformIds || {};                                   // <-- Token map
        const platformId    = TrueVision__Pwa__Handler__GenericManual__PlatformIdContext;                                           // <-- Active platform

        if (platformId === platformIds.FirefoxAndroid) {
            return {
                stepsTitle  : 'From the Firefox menu',
                steps       : [
                    'Tap the menu button (three dots) in the Firefox toolbar.',
                    'Choose "Add to Home screen" or "Install".',
                    'Confirm. The icon appears on your Home Screen.'
                ],
                closing     : null
            };
        }

        if (platformId === platformIds.FirefoxDesktop) {
            return {
                stepsTitle  : 'A note on Firefox',
                steps       : [
                    'Firefox on desktop cannot install web apps.',
                    'Open this same link in Chrome, Edge or Safari.',
                    'The install offer will appear there instead.'
                ],
                closing     : 'Everything still works normally in Firefox - you just cannot pin it as an app.'
            };
        }

        if (platformId === platformIds.ChromiumAndroid) {
            return {
                stepsTitle  : 'From the browser menu',
                steps       : [
                    'Tap the menu button (three dots) in the browser toolbar.',
                    'Choose "Add to Home screen" or "Install app".',
                    'Confirm. The icon appears on your Home Screen.'
                ],
                closing     : null
            };
        }

        if (descriptor.isAnyIosDevice) {
            return {
                stepsTitle  : 'From Safari',
                steps       : [
                    'Open this page in Safari.',
                    'Tap the Share button, then "Add to Home Screen".',
                    'Tap "Add". The icon appears on your Home Screen.'
                ],
                closing     : null
            };
        }

        return {                                                                                                                    // <-- Chromium desktop and anything unclassified
            stepsTitle      : 'From the browser menu',
            steps           : [
                'Look for the install icon at the right-hand end of the address bar.',
                'If it is not there, open the browser menu (three dots) and look for "Install" or "Apps".',
                'Confirm. The app opens in its own window from then on.'
            ],
            closing         : null
        };
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Prompt Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__BuildPromptConfig() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextData   = window.TrueVision__Pwa__ProjectContext.get();                                                         // <-- Project descriptor
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon
        const instructions  = TrueVision__Pwa__Handler__GenericManual__BuildInstructions();                                          // <-- Browser specific steps

        const leadText      = contextData.displayName
            ? `Keep ${contextData.displayName} one tap away.`                                                                        // <-- Project specific lead
            : 'Keep TrueVision 3D one tap away.';                                                                                    // <-- Generic lead

        const bodyText      = instructions.closing
            || 'Installing gives you an icon that opens straight into your model, with no browser bars in the way, '
             + 'and it loads faster every time after the first.';

        return {
            variant                 : 'card',                                                                                       // <-- Centred instruction card
            iconUrl                 : iconUrl,
            iconAltText             : contextData.appName,
            title                   : 'Install This App',
            lead                    : leadText,
            body                    : bodyText,
            stepsTitle              : instructions.stepsTitle,
            steps                   : instructions.steps,
            primaryActionLabel      : null,                                                                                         // <-- No programmatic trigger available
            secondaryActionLabel    : 'Got It',
            onPrimary               : null,
            onDismiss               : TrueVision__Pwa__Handler__GenericManual__OnDismiss
        };
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Handle the User Dismissing the Card
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__OnDismiss() {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.recordDismissal(TrueVision__Pwa__Handler__GenericManual__PlatformIdContext);       // <-- Advance the snooze ladder
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler for a Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__Activate(platformDescriptor) {
        TrueVision__Pwa__Handler__GenericManual__Descriptor        = platformDescriptor || null;                                    // <-- Cache the descriptor
        TrueVision__Pwa__Handler__GenericManual__PlatformIdContext = (platformDescriptor && platformDescriptor.platformId) || 'generic-manual';
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request the Card Be Displayed
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__RequestShow() {
        if (TrueVision__Pwa__Handler__GenericManual__SuppressShow) return;                                                          // <-- Suppressed by the controller
        if (!window.TrueVision__Pwa__PromptUi) return;                                                                              // <-- Prompt UI not loaded yet

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(TrueVision__Pwa__Handler__GenericManual__PlatformIdContext)) {
            return;                                                                                                                 // <-- Snooze still running for this project
        }

        window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__GenericManual__BuildPromptConfig());                        // <-- Render the instruction card
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (e.g. already running standalone)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__GenericManual__SetSuppressed(shouldSuppress) {
        TrueVision__Pwa__Handler__GenericManual__SuppressShow = Boolean(shouldSuppress);                                            // <-- Update the suppress flag
        if (TrueVision__Pwa__Handler__GenericManual__SuppressShow && window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide if currently showing
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__GenericManual = {                                                                          // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__GenericManual__Activate,
            requestShow     : TrueVision__Pwa__Handler__GenericManual__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__GenericManual__SetSuppressed
        };
    }

// endregion -------------------------------------------------------------------

})();
