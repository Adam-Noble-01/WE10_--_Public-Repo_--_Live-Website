// =============================================================================
// TRUEVISION3D - PWA HANDLER (ALREADY INSTALLED, RUNNING STANDALONE)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__InstalledStandalone__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__InstalledStandalone
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Handler used when the app is already running installed
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Dismisses any in-flight prompt and permanently suppresses the offer for
//   this project when the controller detects standalone mode at boot.
// - Exists so the controller can treat every platform symmetrically rather
//   than special-casing the installed state throughout.
// - ONE JOB BEYOND STAYING QUIET: an installed Safari icon that launches with
//   no project in its URL is an icon made while the static fallback manifest
//   was still in Index.html (27-Aug to 19-Sep-2026). iOS stored that
//   manifest's bare start_url inside the icon and nothing served from here can
//   ever change it. The app cannot guess the project either - a Home Screen
//   icon has storage of its own, which has never seen one. So rather than
//   leave the client looking at an empty app, this handler says what happened
//   and how to put it right.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.1.0
// - Added the lost-project notice described above. Safari family only: no
//   other browser was caught by the fault, and the steps are Apple's.
//
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Lost-Project Notice
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This an Installed Safari Icon With No Project in It
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__HasLostItsProject(platformDescriptor) {
        const contextModule = window.TrueVision__Pwa__ProjectContext || null;                                                       // <-- Project context helper
        if (!contextModule || !platformDescriptor) return false;                                                                    // <-- Cannot tell, stay quiet

        if (contextModule.get().hasProject) return false;                                                                           // <-- Launched into a project: a healthy icon
        return platformDescriptor.browserEngineLabel === 'safari';                                                                  // <-- iPhone, iPad and Mac Safari web apps
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Notice Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__BuildNoticeConfig(platformDescriptor) {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon

        const isAppleMobile = Boolean(platformDescriptor.isAnyIosDevice);                                                           // <-- iPhone / iPad, otherwise a Mac
        const deviceLabel   = !isAppleMobile ? 'Mac' : (platformDescriptor.isIpadDevice ? 'iPad' : 'iPhone');                       // <-- Used in the copy

        const stepEntries   = isAppleMobile
            ? [
                'Go to your Home Screen, press and hold this icon, and remove it.',
                'Open your project link in Safari - the link Noble Architecture sent you.',
                'Tap the Share button, then "Add to Home Screen". The new icon opens straight into your model.'
            ]
            : [
                'Quit this app and remove it from your Dock.',
                'Open your project link in Safari - the link Noble Architecture sent you.',
                'Choose File, then "Add to Dock". The new icon opens straight into your model.'
            ];

        return {
            variant                 : 'card',                                                                                       // <-- Centred instruction card
            allowWhenInstalled      : true,                                                                                         // <-- The stylesheet hides every other card in here
            iconUrl                 : iconUrl,
            iconAltText             : 'TrueVision 3D',
            title                   : 'This Icon Needs Adding Again',
            lead                    : 'This icon opens TrueVision 3D without a project, so there is no model to show.',
            body                    : `It was added to your ${deviceLabel} before a fault in the install step was put right, and it `
                                    + 'never stored the link to your design. Nothing has happened to your project - the icon '
                                    + 'just needs replacing, which takes a minute.',
            stepsTitle              : 'To put it right',
            steps                   : stepEntries,
            primaryActionLabel      : null,                                                                                         // <-- Nothing here can repair the icon itself
            secondaryActionLabel    : 'Got It',
            onPrimary               : null,
            onDismiss               : null                                                                                          // <-- Nothing to remember: it is true every launch
        };
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler (Mark This Project as Installed)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__InstalledStandalone__Activate(platformDescriptor) {
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.markInstalled();                                                                   // <-- Persist install state for this project
        }
        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Tear down any visible prompt
        }

        if (window.TrueVision__Pwa__PromptUi
            && TrueVision__Pwa__Handler__InstalledStandalone__HasLostItsProject(platformDescriptor)) {
            window.TrueVision__Pwa__PromptUi.show(                                                                                  // <-- Explain the empty app rather than leave it
                TrueVision__Pwa__Handler__InstalledStandalone__BuildNoticeConfig(platformDescriptor)
            );
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
