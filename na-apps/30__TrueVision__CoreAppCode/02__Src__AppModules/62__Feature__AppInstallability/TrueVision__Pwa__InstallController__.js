// =============================================================================
// TRUEVISION3D - PWA INSTALL CONTROLLER (ORCHESTRATOR)
// =============================================================================
//
// FILE       : TrueVision__Pwa__InstallController__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__InstallController
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pick the right platform handler and govern when to offer install
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Reads the platform descriptor from TrueVision__Pwa__PlatformDetector and
//   activates the matching handler, falling back to the generic manual handler
//   wherever no native install route exists.
// - Honours the per-project snooze ladder and the installed flag, and reacts
//   live to the display mode changing to standalone.
// - TIMING IS DELIBERATE. TrueVision already shows a "Better in Full Screen"
//   invitation once the model is on screen. Two cards stacked on top of each
//   other would be awful, so the install offer:
//       1. waits for the scene-ready event (or a hard timeout if the model
//          never loads),
//       2. waits a further settle delay,
//       3. refuses to render while the full screen card is still open, and
//          retries until it closes.
// - Exposes requestShow() so the Tools and Settings menu can offer install on
//   demand. A deliberate click always shows the prompt, whatever the snooze
//   state says.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack
//   with TrueVision-specific sequencing around the full screen invitation.
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Display Timing
    // ------------------------------------------------------------
    const CONTROLLER_SCENE_READY_EVENT      = 'na-app-scene-ready';                                                                 // <-- Fired once the model is on screen
    const CONTROLLER_SCENE_READY_TIMEOUT_MS = 45000;                                                                                // <-- Offer anyway if the model never loads
    const CONTROLLER_SETTLE_DELAY_MS        = 6000;                                                                                 // <-- Breathing room after the full screen card
    const CONTROLLER_RETRY_INTERVAL_MS      = 2000;                                                                                 // <-- Retry cadence
    const CONTROLLER_MAX_RETRY_ATTEMPTS     = 15;                                                                                   // <-- Real attempts, i.e. 30 s of warm-up grace
    const CONTROLLER_MAX_BLOCKED_POLLS      = 90;                                                                                   // <-- Extra polls while another modal is open (3 min)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Blocking Selectors
    // ------------------------------------------------------------
    const CONTROLLER_FULLSCREEN_CARD_OPEN   = '.na-fullscreen-prompt.is-open';                                                      // <-- The full screen invitation, mid-flight
    const CONTROLLER_USER_GUIDE_OPEN        = '.na-user-instructions-overlay.is-open';                                              // <-- The user guide modal, mid-flight
    // ------------------------------------------------------------


    // MODULE VARIABLES | Internal State
    // ------------------------------------------------------------
    let TrueVision__Pwa__InstallController__ActiveDescriptor = null;                                                                // <-- Current platform descriptor
    let TrueVision__Pwa__InstallController__ActiveHandler    = null;                                                                // <-- Selected handler reference
    let TrueVision__Pwa__InstallController__StandaloneUnsub  = null;                                                                // <-- Disposer for the standalone listener
    let TrueVision__Pwa__InstallController__InitDone         = false;                                                               // <-- Idempotent init flag
    let TrueVision__Pwa__InstallController__AutoShowArmed    = false;                                                               // <-- Guard against double scheduling
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Handler Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve the Handler for a Platform Identifier
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__ResolveHandler(platformId) {
        const platformIds   = (window.TrueVision__Pwa__PlatformDetector || {}).PlatformIds || {};                                   // <-- Token map

        if (platformId === platformIds.InstalledStandalone) {
            return window.TrueVision__Pwa__Handler__InstalledStandalone || null;                                                    // <-- Already installed
        }

        if (platformId === platformIds.IosSafariIphone || platformId === platformIds.IosSafariIpad) {
            return window.TrueVision__Pwa__Handler__IosSafari || null;                                                              // <-- iPhone / iPad Safari
        }

        if (platformId === platformIds.IosNonSafari) {
            return window.TrueVision__Pwa__Handler__IosNonSafari || null;                                                           // <-- iOS Chrome / Edge / Firefox
        }

        if (platformId === platformIds.MacSafari) {
            return window.TrueVision__Pwa__Handler__MacSafari || null;                                                              // <-- macOS Safari
        }

        if (platformId === platformIds.ChromiumDesktopWindows
            || platformId === platformIds.ChromiumDesktopMac
            || platformId === platformIds.ChromiumDesktopLinux
            || platformId === platformIds.ChromiumAndroid) {
            return window.TrueVision__Pwa__Handler__Chromium || null;                                                               // <-- Chromium family
        }

        return window.TrueVision__Pwa__Handler__GenericManual || null;                                                              // <-- Firefox and anything unclassified
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Decide Whether to Offer Install Without Being Asked
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__ShouldAutoOffer(platformId) {
        const platformIds   = (window.TrueVision__Pwa__PlatformDetector || {}).PlatformIds || {};                                   // <-- Token map

        if (platformId === platformIds.InstalledStandalone) return false;                                                           // <-- Nothing to offer
        if (platformId === platformIds.FirefoxDesktop)      return false;                                                           // <-- Firefox desktop cannot install at all
        if (platformId === platformIds.Unknown)             return false;                                                           // <-- Do not guess at unknown browsers

        return true;                                                                                                                // <-- Everything else gets the offer
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Probe the Related Installed Apps API
    // ---------------------------------------------------------------
    async function TrueVision__Pwa__InstallController__IsRelatedAppInstalled() {
        try {
            if (!navigator.getInstalledRelatedApps) return false;                                                                   // <-- API unavailable
            const relatedAppList = await navigator.getInstalledRelatedApps();                                                       // <-- Fetch the list
            return Array.isArray(relatedAppList) && relatedAppList.length > 0;                                                      // <-- Any entry implies installed
        } catch (error) {
            return false;                                                                                                           // <-- Treat errors as "not installed"
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Show Scheduling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is Another Modal Currently Holding the Screen
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__IsBlockedByOtherUi() {
        if (typeof document === 'undefined') return false;                                                                          // <-- Guard non-DOM contexts
        if (document.querySelector(CONTROLLER_FULLSCREEN_CARD_OPEN)) return true;                                                   // <-- Full screen invitation is open
        if (document.querySelector(CONTROLLER_USER_GUIDE_OPEN)) return true;                                                        // <-- User guide is open
        return false;                                                                                                               // <-- Screen is free
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Attempt to Trigger the Handler, Retrying if Blocked
    // ---------------------------------------------------------------
    // Two separate budgets, because the two reasons for retrying are not the
    // same thing:
    //   remainingAttempts - real tries. Chromium may not have fired
    //                       beforeinstallprompt yet, so a few goes are needed.
    //   remainingBlocked  - polls burned purely waiting for another modal to
    //                       close. A client reading the full screen card must
    //                       not lose the install offer just because they took
    //                       their time over it, so these do not eat the real
    //                       attempts. Still capped, so this can never poll on
    //                       forever.
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__AttemptShow(remainingAttempts, remainingBlockedPolls) {
        const activeHandler = TrueVision__Pwa__InstallController__ActiveHandler;                                                    // <-- Snapshot the active handler
        if (!activeHandler) return;                                                                                                 // <-- No handler, nothing to do

        const platformId    = (TrueVision__Pwa__InstallController__ActiveDescriptor || {}).platformId || '';                        // <-- Descriptor platform id

        if (window.TrueVision__Pwa__SessionState
            && window.TrueVision__Pwa__SessionState.isSuppressed(platformId)) {
            return;                                                                                                                 // <-- Snoozed or installed, stay quiet
        }

        if (TrueVision__Pwa__InstallController__IsBlockedByOtherUi()) {                                                             // <-- Another modal holds the screen
            if (remainingBlockedPolls <= 0) return;                                                                                 // <-- Waited long enough, give up quietly
            setTimeout(
                () => TrueVision__Pwa__InstallController__AttemptShow(remainingAttempts, remainingBlockedPolls - 1),                 // <-- Poll again, real budget untouched
                CONTROLLER_RETRY_INTERVAL_MS
            );
            return;
        }

        if (typeof activeHandler.requestShow === 'function') {
            activeHandler.requestShow();                                                                                            // <-- Ask the handler to render
        }

        const promptVisible = window.TrueVision__Pwa__PromptUi && window.TrueVision__Pwa__PromptUi.isVisible();                     // <-- Did anything actually appear
        if (promptVisible || remainingAttempts <= 0) return;                                                                        // <-- Done, or out of real attempts

        setTimeout(                                                                                                                 // <-- Retry: the browser may still be warming
            () => TrueVision__Pwa__InstallController__AttemptShow(remainingAttempts - 1, remainingBlockedPolls),                     //     up towards beforeinstallprompt
            CONTROLLER_RETRY_INTERVAL_MS
        );
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Schedule the First Automatic Offer
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__ScheduleAutoShow() {
        if (TrueVision__Pwa__InstallController__AutoShowArmed) return;                                                              // <-- Only ever schedule once
        TrueVision__Pwa__InstallController__AutoShowArmed = true;

        let hasFired        = false;                                                                                                // <-- Guard: scene-ready OR timeout, not both

        const startCountdown = () => {
            if (hasFired) return;                                                                                                   // <-- Already started
            hasFired = true;
            setTimeout(
                () => TrueVision__Pwa__InstallController__AttemptShow(CONTROLLER_MAX_RETRY_ATTEMPTS, CONTROLLER_MAX_BLOCKED_POLLS),  // <-- Begin attempting after the settle delay
                CONTROLLER_SETTLE_DELAY_MS
            );
        };

        window.addEventListener(CONTROLLER_SCENE_READY_EVENT, startCountdown, { once: true });                                       // <-- Normal path: model is on screen
        setTimeout(startCountdown, CONTROLLER_SCENE_READY_TIMEOUT_MS);                                                               // <-- Safety net: model never loaded
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | React to the Display Mode Becoming Standalone
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__OnStandaloneChange(isStandaloneNow) {
        if (!isStandaloneNow) return;                                                                                               // <-- Only act when entering standalone

        if (window.TrueVision__Pwa__SessionState) {
            window.TrueVision__Pwa__SessionState.markInstalled();                                                                   // <-- Persist install state for this project
        }

        if (TrueVision__Pwa__InstallController__ActiveHandler
            && typeof TrueVision__Pwa__InstallController__ActiveHandler.setSuppressed === 'function') {
            TrueVision__Pwa__InstallController__ActiveHandler.setSuppressed(true);                                                  // <-- Suppress the active handler
        }

        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Tear down any prompt
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Controller and Activate the Platform Handler
    // ------------------------------------------------------------
    async function TrueVision__Pwa__InstallController__Initialize() {
        if (TrueVision__Pwa__InstallController__InitDone) return;                                                                   // <-- Idempotent guard
        TrueVision__Pwa__InstallController__InitDone = true;

        const platformDetector  = window.TrueVision__Pwa__PlatformDetector;                                                         // <-- Resolve the detector
        if (!platformDetector || !platformDetector.getPlatformDescriptor) return;                                                   // <-- No detector, bail safely

        const descriptor        = platformDetector.getPlatformDescriptor();                                                         // <-- Build the descriptor snapshot
        TrueVision__Pwa__InstallController__ActiveDescriptor = descriptor;                                                          // <-- Persist the descriptor

        const handlerInstance   = TrueVision__Pwa__InstallController__ResolveHandler(descriptor.platformId);                        // <-- Pick the handler
        TrueVision__Pwa__InstallController__ActiveHandler = handlerInstance;                                                        // <-- Persist the handler reference

        if (handlerInstance && typeof handlerInstance.activate === 'function') {
            handlerInstance.activate(descriptor);                                                                                   // <-- Wire the handler to the descriptor
        }

        TrueVision__Pwa__InstallController__StandaloneUnsub = platformDetector.subscribeStandaloneChanges                            // <-- Watch live display mode changes
            ? platformDetector.subscribeStandaloneChanges(TrueVision__Pwa__InstallController__OnStandaloneChange)
            : null;

        if (!TrueVision__Pwa__InstallController__ShouldAutoOffer(descriptor.platformId)) {
            return;                                                                                                                 // <-- Manual route only for this platform
        }

        const isRelatedAppInstalled = await TrueVision__Pwa__InstallController__IsRelatedAppInstalled();                             // <-- Check the related apps API
        if (isRelatedAppInstalled) {
            if (handlerInstance && typeof handlerInstance.setSuppressed === 'function') {
                handlerInstance.setSuppressed(true);                                                                                // <-- Suppress when a related app is installed
            }
            return;
        }

        TrueVision__Pwa__InstallController__ScheduleAutoShow();                                                                     // <-- Arm the first automatic offer
    }
    // ---------------------------------------------------------------


    // FUNCTION | Show the Prompt on Demand (Tools and Settings menu)
    // ------------------------------------------------------------
    // A deliberate click always gets a prompt. Snooze state is bypassed, and
    // where Chromium has no captured install event to hand, the generic
    // instruction card is shown rather than nothing at all.
    // ------------------------------------------------------------
    function TrueVision__Pwa__InstallController__RequestShow() {
        const sessionState  = window.TrueVision__Pwa__SessionState || null;                                                         // <-- Session state module
        const chromiumHandler = window.TrueVision__Pwa__Handler__Chromium || null;                                                  // <-- Chromium handler, when present

        let handlerToUse    = TrueVision__Pwa__InstallController__ActiveHandler;                                                    // <-- Start with the active handler

        const chromiumHasNoEvent = handlerToUse === chromiumHandler                                                                 // <-- Chromium selected...
                                && chromiumHandler
                                && typeof chromiumHandler.canInstallNow === 'function'
                                && !chromiumHandler.canInstallNow();                                                                 // <-- ...but no install event captured

        if (chromiumHasNoEvent && window.TrueVision__Pwa__Handler__GenericManual) {
            handlerToUse    = window.TrueVision__Pwa__Handler__GenericManual;                                                       // <-- Explain the manual route instead
            handlerToUse.activate(TrueVision__Pwa__InstallController__ActiveDescriptor);                                            // <-- Give it the descriptor
        }

        if (!handlerToUse || typeof handlerToUse.requestShow !== 'function') return;                                                // <-- Nothing available

        if (sessionState) sessionState.setManualOverride(true);                                                                     // <-- Bypass the snooze for this call
        try {
            handlerToUse.requestShow();                                                                                             // <-- Render synchronously
        } finally {
            if (sessionState) sessionState.setManualOverride(false);                                                                // <-- Always lower the flag again
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Dismiss Any Active Prompt
    // ------------------------------------------------------------
    function TrueVision__Pwa__InstallController__DismissNow() {
        if (window.TrueVision__Pwa__PromptUi) {
            window.TrueVision__Pwa__PromptUi.hide();                                                                                // <-- Tear down the DOM
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Report Whether the Install Offer Is Relevant Here
    // ------------------------------------------------------------
    // Used by the Tools menu to hide the Install App row inside an already
    // installed app, where the offer would be meaningless.
    // ------------------------------------------------------------
    function TrueVision__Pwa__InstallController__IsInstallOfferRelevant() {
        const platformDetector  = window.TrueVision__Pwa__PlatformDetector;                                                         // <-- Resolve the detector
        if (!platformDetector) return false;                                                                                        // <-- No detector, hide the row
        return !platformDetector.isStandaloneDisplay();                                                                             // <-- Irrelevant once running installed
    }
    // ---------------------------------------------------------------


    // FUNCTION | Get the Active Platform Descriptor (Diagnostic)
    // ------------------------------------------------------------
    function TrueVision__Pwa__InstallController__GetActiveDescriptor() {
        return TrueVision__Pwa__InstallController__ActiveDescriptor;                                                                // <-- Expose for console inspection
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Bootstrap Controller Initialization
    // ---------------------------------------------------------------
    function TrueVision__Pwa__InstallController__Bootstrap() {
        if (typeof window === 'undefined') return;                                                                                  // <-- Guard non-window contexts

        window.TrueVision__Pwa__InstallController = {                                                                               // <-- Public API surface
            initialize              : TrueVision__Pwa__InstallController__Initialize,
            requestShow             : TrueVision__Pwa__InstallController__RequestShow,
            dismissNow              : TrueVision__Pwa__InstallController__DismissNow,
            isInstallOfferRelevant  : TrueVision__Pwa__InstallController__IsInstallOfferRelevant,
            getActiveDescriptor     : TrueVision__Pwa__InstallController__GetActiveDescriptor
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => TrueVision__Pwa__InstallController__Initialize(), { once: true });   // <-- Defer until the DOM is ready
            return;
        }

        TrueVision__Pwa__InstallController__Initialize();                                                                           // <-- DOM already ready, init immediately
    }
    // ---------------------------------------------------------------


    TrueVision__Pwa__InstallController__Bootstrap();                                                                                // <-- Kick off bootstrap

// endregion -------------------------------------------------------------------

})();
