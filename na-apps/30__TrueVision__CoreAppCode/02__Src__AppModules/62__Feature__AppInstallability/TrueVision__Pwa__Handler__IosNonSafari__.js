// =============================================================================
// TRUEVISION3D - PWA HANDLER (IOS NON-SAFARI BROWSERS)
// =============================================================================
//
// FILE       : TrueVision__Pwa__Handler__IosNonSafari__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__Handler__IosNonSafari
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Send iOS Chrome / Edge / Firefox clients to Safari to install
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Every browser on iOS and iPadOS is required to use WebKit, but only Safari
//   exposes the Add to Home Screen entry. A client who opened the project link
//   from an email inside Chrome therefore cannot install without switching.
// - iOS offers no reliable deep link that a third-party browser is guaranteed
//   to honour, so the card offers a Copy Link action instead and explains the
//   two-step switch.
// - The link copied is the canonical project launch URL, so pasting it into
//   Safari lands on exactly the right project.
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
    let TrueVision__Pwa__Handler__IosNonSafari__PlatformIdContext    = '';                                                          // <-- Active platform identifier
    let TrueVision__Pwa__Handler__IosNonSafari__SuppressShow         = false;                                                       // <-- Suppress flag set by the controller
    let TrueVision__Pwa__Handler__IosNonSafari__LinkWasCopied        = false;                                                       // <-- Drives the confirmation re-render
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve the Canonical Project Link to Copy
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__GetLinkToCopy() {
        const contextModule = window.TrueVision__Pwa__ProjectContext || null;                                                       // <-- Project context helper
        if (contextModule && contextModule.getLaunchUrl) return contextModule.getLaunchUrl();                                       // <-- Canonical project URL
        return window.location.href;                                                                                                // <-- Degrade to the current URL
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Build the Prompt Configuration
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__BuildPromptConfig() {
        const urlHelper     = window.TrueVision__Pwa__Url || null;                                                                  // <-- Absolute URL helper
        const contextData   = window.TrueVision__Pwa__ProjectContext.get();                                                         // <-- Project descriptor
        const iconUrl       = urlHelper ? urlHelper.getIconUrls().icon192 : null;                                                   // <-- 192px app icon
        const wasCopied     = TrueVision__Pwa__Handler__IosNonSafari__LinkWasCopied;                                                // <-- Confirmation state

        const leadText      = wasCopied
            ? 'Link copied. Now open Safari and paste it into the address bar.'                                                     // <-- Post-copy confirmation
            : 'Installing on iPhone and iPad only works in Safari.';                                                                // <-- Opening explanation

        const projectPhrase = contextData.displayName ? contextData.displayName : 'TrueVision 3D';                                  // <-- Named project where known

        return {
            variant                 : 'card',                                                                                       // <-- Centred instruction card
            iconUrl                 : iconUrl,
            iconAltText             : contextData.appName,
            title                   : 'Open in Safari to Install',
            lead                    : leadText,
            body                    : `Apple only lets Safari add apps to the Home Screen. Copy the link to ${projectPhrase}, `
                                    + 'open it in Safari, and you can install from there.',
            stepsTitle              : 'Three steps',
            steps                   : [
                'Tap "Copy Link" below.',
                'Open Safari, paste the link into the address bar and load the page.',
                'In Safari, tap Share and choose "Add to Home Screen".'
            ],
            primaryActionLabel      : wasCopied ? 'Link Copied' : 'Copy Link',
            secondaryActionLabel    : 'Got It',
            onPrimary               : TrueVision__Pwa__Handler__IosNonSafari__CopyProjectLink,
            onDismiss               : TrueVision__Pwa__Handler__IosNonSafari__OnDismiss
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Copy the Project Link to the Clipboard
    // ------------------------------------------------------------
    async function TrueVision__Pwa__Handler__IosNonSafari__CopyProjectLink() {
        const linkValue     = TrueVision__Pwa__Handler__IosNonSafari__GetLinkToCopy();                                              // <-- Canonical project URL

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(linkValue);                                                                     // <-- Modern Clipboard API
            } else {
                TrueVision__Pwa__Handler__IosNonSafari__CopyLinkLegacyFallback(linkValue);                                          // <-- Legacy textarea fallback
            }
        } catch (error) {
            TrueVision__Pwa__Handler__IosNonSafari__CopyLinkLegacyFallback(linkValue);                                              // <-- Fallback when permission is denied
        }

        TrueVision__Pwa__Handler__IosNonSafari__LinkWasCopied = true;                                                               // <-- Flip into the confirmation state

        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__IosNonSafari__BuildPromptConfig());                     // <-- Re-render with the confirmation copy
        }
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Legacy Copy Link Fallback (execCommand)
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__CopyLinkLegacyFallback(linkValue) {
        try {
            const tempInput             = document.createElement('textarea');                                                       // <-- Create an offscreen textarea
            tempInput.value             = linkValue;                                                                                // <-- Seed the value
            tempInput.setAttribute('readonly', '');                                                                                 // <-- Prevent the virtual keyboard
            tempInput.style.position    = 'fixed';                                                                                  // <-- Keep it offscreen
            tempInput.style.opacity     = '0';
            tempInput.style.pointerEvents = 'none';
            document.body.appendChild(tempInput);                                                                                   // <-- Mount
            tempInput.select();                                                                                                     // <-- Select the content
            tempInput.setSelectionRange(0, linkValue.length);                                                                       // <-- iOS-specific selection
            document.execCommand('copy');                                                                                           // <-- Legacy copy command
            document.body.removeChild(tempInput);                                                                                   // <-- Clean up
        } catch (error) {
            console.warn('[TrueVision3D PWA] Clipboard fallback failed:', error);                                                   // <-- Log, never throw
        }
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Handle the User Dismissing the Card
    // ---------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__OnDismiss() {
        TrueVision__Pwa__Handler__IosNonSafari__LinkWasCopied = false;                                                              // <-- Reset for the next showing
        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.recordDismissal(TrueVision__Pwa__Handler__IosNonSafari__PlatformIdContext);        // <-- Advance the snooze ladder
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Activate the Handler for a Platform Descriptor
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__Activate(platformDescriptor) {
        TrueVision__Pwa__Handler__IosNonSafari__PlatformIdContext = (platformDescriptor && platformDescriptor.platformId) || 'ios-non-safari';
    }
    // ---------------------------------------------------------------


    // FUNCTION | Request the Card Be Displayed
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__RequestShow() {
        if (TrueVision__Pwa__Handler__IosNonSafari__SuppressShow) return;                                                           // <-- Suppressed by the controller
        if (!window.TrueVision__Pwa__PromptUi) return;                                                                              // <-- Prompt UI not loaded yet

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(TrueVision__Pwa__Handler__IosNonSafari__PlatformIdContext)) {
            return;                                                                                                                 // <-- Snooze still running for this project
        }

        TrueVision__Pwa__Handler__IosNonSafari__LinkWasCopied = false;                                                              // <-- Always open in the pre-copy state
        window.TrueVision__Pwa__PromptUi.show(TrueVision__Pwa__Handler__IosNonSafari__BuildPromptConfig());                         // <-- Render the redirect card
    }
    // ---------------------------------------------------------------


    // FUNCTION | Set the Suppress Flag (e.g. already running standalone)
    // ------------------------------------------------------------
    function TrueVision__Pwa__Handler__IosNonSafari__SetSuppressed(shouldSuppress) {
        TrueVision__Pwa__Handler__IosNonSafari__SuppressShow = Boolean(shouldSuppress);                                             // <-- Update the suppress flag
        if (TrueVision__Pwa__Handler__IosNonSafari__SuppressShow && window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Hide if currently showing
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Global Exposure
// -----------------------------------------------------------------------------

    if (typeof window !== 'undefined') {
        window.TrueVision__Pwa__Handler__IosNonSafari = {                                                                           // <-- Expose the handler API
            activate        : TrueVision__Pwa__Handler__IosNonSafari__Activate,
            requestShow     : TrueVision__Pwa__Handler__IosNonSafari__RequestShow,
            setSuppressed   : TrueVision__Pwa__Handler__IosNonSafari__SetSuppressed
        };
    }

// endregion -------------------------------------------------------------------

})();
