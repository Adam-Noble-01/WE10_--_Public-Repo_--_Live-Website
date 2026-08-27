// =============================================================================
// TRUEVISION3D - PWA HANDLER (IOS SAFARI - IPHONE AND IPAD)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__IosSafari__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__IosSafari
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Walk iPhone and iPad clients through Add to Home Screen
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Apple does not implement beforeinstallprompt, so installing on iOS is a
//   manual trip through the Safari Share menu. This handler renders the
//   Noble Architecture instruction card that talks the client through it.
// - The Share button sits in a different place on each device, so the copy is
//   device aware:
//       iPhone -> Share button at the BOTTOM of the screen
//       iPad   -> Share button at the TOP of the toolbar
//   Getting this wrong is the single most common reason a client gives up, so
//   it is worth the branch.
// - iOS bookmarks the page the client is standing on, so a client who follows
//   these steps from their own project link gets their own project's icon.
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

    // MODULE VARIABLES | Active Platform Context
    // ------------------------------------------------------------
    let TrueVision__Pwa__Handler__IosSafari__PlatformIdContext   = '';                                                              // <-- Active platform identifier
    let TrueVision__Pwa__Handler__IosSafari__SuppressShow        = false;                                                           // <-- Suppress flag set by the controller
    let TrueVision__Pwa__Handler__IosSafari__IsIpadDevice        = false;                                                           // <-- Cached iPad flag
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Prompt Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosSafari__BuildPromptConfig() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextData   = window.TrueVision__Pwa__ProjectContext.get();                                                         // <-- Project descriptor
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon

        const isIpad        = TrueVision__Pwa__Handler__IosSafari__IsIpadDevice;                                                    // <-- Device branch
        const deviceLabel   = isIpad ? 'iPad' : 'iPhone';                                                                           // <-- Used in the copy
        const shareLocation = isIpad
            ? 'at the top of the Safari toolbar'                                                                                    // <-- iPad share button position
            : 'at the bottom of the screen';                                                                                        // <-- iPhone share button position

        const leadText      = contextData.displayName
            ? `Keep ${contextData.displayName} one tap away.`                                                                        // <-- Project specific lead
            : 'Keep TrueVision 3D one tap away.';                                                                                    // <-- Generic lead

        return {
            variant                 : 'card',                                                                                       // <-- Centred instruction card
            iconUrl                 : iconUrl,
            iconAltText             : contextData.appName,
            title                   : 'Add to Home Screen',
            lead                    : leadText,
            body                    : `Adding this to your ${deviceLabel} Home Screen gives you an icon that opens straight `
                                    + 'into your model, full screen, with no browser bars in the way. It also loads faster '
                                    + 'every time after the first.',
            stepsTitle              : `From Safari on your ${deviceLabel}`,
            steps                   : [
                `Tap the Share button - the square with an arrow pointing up, ${shareLocation}.`,
                'Scroll down the share list and tap "Add to Home Screen".',
                'Tap "Add". The icon appears on your Home Screen straight away.'
            ],
            primaryActionLabel      : null,                                                                                         // <-- Apple exposes no programmatic trigger
            secondaryActionLabel    : 'Got It',
            onPrimary               : null,
            onDismiss               : TrueVision__Pwa__Handler__IosSafari__OnDismiss
        };
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Handle the User Dismissing the Card
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosSafari__OnDismiss() {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.recordDismissal(TrueVision__Pwa__Handler__IosSafari__PlatformIdContext);           // <-- Advance the snooze ladder
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler for a Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosSafari__Activate(platformDescriptor) {
        TrueVision__Pwa__Handler__IosSafari__PlatformIdContext = (platformDescriptor && platformDescriptor.platformId) || 'ios-safari';
        TrueVision__Pwa__Handler__IosSafari__IsIpadDevice      = Boolean(platformDescriptor && platformDescriptor.isIpadDevice);    // <-- Cache the iPad flag
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request the Card Be Displayed
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosSafari__RequestShow() {
        if (TrueVision__Pwa__Handler__IosSafari__SuppressShow) return;                                                              // <-- Suppressed by the controller
        if (!window.TrueVision__Pwa__PromptUi) return;                                                                              // <-- Prompt UI not loaded yet

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(TrueVision__Pwa__Handler__IosSafari__PlatformIdContext)) {
            return;                                                                                                                 // <-- Snooze still running for this project
        }

        window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__IosSafari__BuildPromptConfig());                            // <-- Render the instruction card
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (e.g. already running standalone)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosSafari__SetSuppressed(shouldSuppress) {
        TrueVision__Pwa__Handler__IosSafari__SuppressShow = Boolean(shouldSuppress);                                                // <-- Update the suppress flag
        if (TrueVision__Pwa__Handler__IosSafari__SuppressShow && window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide if currently showing
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__IosSafari = {                                                                              // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__IosSafari__Activate,
            requestShow     : TrueVision__Pwa__Handler__IosSafari__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__IosSafari__SetSuppressed
        };
    }

// endregion -------------------------------------------------------------------

})();
