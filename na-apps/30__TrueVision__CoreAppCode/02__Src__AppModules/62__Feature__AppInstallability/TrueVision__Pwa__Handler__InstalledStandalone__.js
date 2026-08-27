// =============================================================================
// TRUEVISION3D - PWA HANDLER (ALREADY INSTALLED, RUNNING STANDALONE)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__InstalledStandalone__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__InstalledStandalone
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : No-op handler used when the app is already running installed
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Dismisses any in-flight prompt and permanently suppresses the offer for
//   this project when the controller detects standalone mode at boot.
// - Exists so the controller can treat every platform symmetrically rather
//   than special-casing the installed state throughout.
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
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler (Mark This Project as Installed)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__Activate() {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.markInstalled();                                                                   // <-- Persist install state for this project
        }
        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Tear down any visible prompt
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request Display (No-Op)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__RequestShow() {
        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Always keep the prompt hidden
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (No-Op)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__SetSuppressed() {
        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide unconditionally
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__InstalledStandalone = {                                                                    // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__InstalledStandalone__Activate,
            requestShow     : TrueVision__Pwa__Handler__InstalledStandalone__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__InstalledStandalone__SetSuppressed
        };
    }

// endregion -------------------------------------------------------------------

})();
