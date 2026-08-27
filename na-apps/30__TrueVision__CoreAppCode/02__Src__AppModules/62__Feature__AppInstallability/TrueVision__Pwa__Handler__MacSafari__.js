// =============================================================================
// TRUEVISION3D - PWA HANDLER (MACOS SAFARI)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__MacSafari__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__MacSafari
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Surface Add to Dock instructions for macOS Safari clients
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Safari 17 and later on macOS installs web apps through File > Add to Dock.
//   There is no programmatic API, so this handler renders the Noble
//   Architecture instruction card with a clear three step explanation.
// - Safari on macOS installs the page the client is standing on, so following
//   these steps from a project link produces a Dock icon for that project.
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
    let TrueVision__Pwa__Handler__MacSafari__PlatformIdContext   = '';                                                              // <-- Active platform identifier
    let TrueVision__Pwa__Handler__MacSafari__SuppressShow        = false;                                                           // <-- Suppress flag set by the controller
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Prompt Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__MacSafari__BuildPromptConfig() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextData   = window.TrueVision__Pwa__ProjectContext.get();                                                         // <-- Project descriptor
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon

        const leadText      = contextData.displayName
            ? `Keep ${contextData.displayName} in your Dock.`                                                                        // <-- Project specific lead
            : 'Keep TrueVision 3D in your Dock.';                                                                                    // <-- Generic lead

        return {
            variant                 : 'card',                                                                                       // <-- Centred instruction card
            iconUrl                 : iconUrl,
            iconAltText             : contextData.appName,
            title                   : 'Add to Your Dock',
            lead                    : leadText,
            body                    : 'Safari can add this to your Dock as a proper app window - no tabs, no address bar, '
                                    + 'just the model. It opens straight into this project every time.',
            stepsTitle              : 'From the Safari menu bar',
            steps                   : [
                'Click "File" in the menu bar at the top of the screen.',
                'Choose "Add to Dock..." from the menu.',
                'Click "Add". The icon appears in your Dock straight away.'
            ],
            primaryActionLabel      : null,                                                                                         // <-- Apple exposes no programmatic trigger
            secondaryActionLabel    : 'Got It',
            onPrimary               : null,
            onDismiss               : TrueVision__Pwa__Handler__MacSafari__OnDismiss
        };
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Handle the User Dismissing the Card
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__MacSafari__OnDismiss() {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.recordDismissal(TrueVision__Pwa__Handler__MacSafari__PlatformIdContext);           // <-- Advance the snooze ladder
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler for a Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__MacSafari__Activate(platformDescriptor) {
        TrueVision__Pwa__Handler__MacSafari__PlatformIdContext = (platformDescriptor && platformDescriptor.platformId) || 'mac-safari';
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request the Card Be Displayed
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__MacSafari__RequestShow() {
        if (TrueVision__Pwa__Handler__MacSafari__SuppressShow) return;                                                              // <-- Suppressed by the controller
        if (!window.TrueVision__Pwa__PromptUi) return;                                                                              // <-- Prompt UI not loaded yet

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(TrueVision__Pwa__Handler__MacSafari__PlatformIdContext)) {
            return;                                                                                                                 // <-- Snooze still running for this project
        }

        window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__MacSafari__BuildPromptConfig());                            // <-- Render the instruction card
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (e.g. already running standalone)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__MacSafari__SetSuppressed(shouldSuppress) {
        TrueVision__Pwa__Handler__MacSafari__SuppressShow = Boolean(shouldSuppress);                                                // <-- Update the suppress flag
        if (TrueVision__Pwa__Handler__MacSafari__SuppressShow && window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide if currently showing
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__MacSafari = {                                                                              // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__MacSafari__Activate,
            requestShow     : TrueVision__Pwa__Handler__MacSafari__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__MacSafari__SetSuppressed
        };
    }

// endregion -------------------------------------------------------------------

})();
