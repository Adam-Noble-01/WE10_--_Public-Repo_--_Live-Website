// =============================================================================
// TRUEVISION3D - FULL SCREEN MODE STARTUP PROMPT
// =============================================================================
//
// FILE       : Na__UiFeature__FullscreenMode__Prompt.js
// NAMESPACE  : Na__UiFeature
// MODULE     : FullscreenMode - Startup Prompt
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One-time invitation card recommending full screen on app open
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Builds and manages the "Better in Full Screen" card shown once the model
//   has finished loading and the viewer is ready to explore.
// - The Fullscreen API can only be entered from a real user gesture, so the
//   app can never switch itself over - the card exists to make the offer and
//   carry the click that the browser requires.
// - Every dismissal route is available: the primary button, the "Not Now"
//   button, the backdrop, and the Escape key.
// - The card states plainly, before the user commits, that full screen can be
//   left at any time with Escape or from Tools & Settings > Full Screen, which
//   is the route touch-screen users need since they have no Escape key.
// - Suppressed for the rest of the browser session once dismissed, so a
//   refresh mid-review does not nag. A fresh visit offers it again.
// - Never shown where element full screen is unsupported (Safari on iPhone)
//   or where the viewer is already running full screen.
//
// INTEGRATION:
// - Call Na__UiFeature__FullscreenMode__Prompt__Initialize(enterFn) once after
//   the DOM is ready, passing Na__UiFeature__FullscreenMode__Enter.
// - Call Na__UiFeature__FullscreenMode__Prompt__Show() when the scene is ready
//   (Index.html listens for the 'na-app-scene-ready' event).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial Release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Full Screen State Helpers
    // ------------------------------------------------------------
    import {
        Na__UiFeature__FullscreenMode__IsActive,
        Na__UiFeature__FullscreenMode__IsSupported
    } from './Na__UiFeature__FullscreenMode__SystemLogic.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Storage Key and Timings
    // ------------------------------------------------------------
    const Na__FsPrompt__SessionKey    = 'naTrueVision__FullscreenPrompt__Dismissed'; // <-- Session suppression flag
    const Na__FsPrompt__RevealDelayMs = 700;                                         // <-- Let the canvas fade in first
    // ------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__FsPrompt__OverlayId     = 'naFullscreenPromptOverlay';   // <-- Backdrop container
    const Na__FsPrompt__ConfirmBtnId  = 'naFullscreenPromptConfirm';   // <-- "Go Full Screen" action
    const Na__FsPrompt__DismissBtnId  = 'naFullscreenPromptDismiss';   // <-- "Not Now" action
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Runtime References
    // ------------------------------------------------------------
    let Na__FsPrompt__Overlay        = null;    // <-- Overlay backdrop element
    let Na__FsPrompt__EnterFn        = null;    // <-- Injected full screen enter function
    let Na__FsPrompt__EscapeListener = null;    // <-- Stored Escape keydown handler
    let Na__FsPrompt__IsInitialized  = false;   // <-- Guard against double init
    let Na__FsPrompt__HasBeenShown   = false;   // <-- Guard against re-showing within one page load
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Session Suppression
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read the Session Dismissal Flag
    // ------------------------------------------------------------
    function Na__FsPrompt__WasDismissedThisSession() {
        try {
            return sessionStorage.getItem(Na__FsPrompt__SessionKey) === 'true';
        } catch {
            return false;                                                    // <-- Storage blocked (private mode); offer anyway
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Session Dismissal Flag
    // ------------------------------------------------------------
    function Na__FsPrompt__MarkDismissedThisSession() {
        try {
            sessionStorage.setItem(Na__FsPrompt__SessionKey, 'true');
        } catch {
            /* Storage blocked - the in-page guard still prevents a re-show */
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DOM Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Invitation Card DOM Structure
    // ------------------------------------------------------------
    function Na__FsPrompt__BuildDom() {
        const overlay = document.createElement('div');                       // <-- Overlay backdrop
        overlay.className = 'na-fullscreen-prompt';
        overlay.id        = Na__FsPrompt__OverlayId;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'naFullscreenPromptTitle');

        overlay.innerHTML = `
            <div class="na-fullscreen-prompt__card">

                <div class="na-fullscreen-prompt__header">
                    <svg class="na-fullscreen-prompt__header-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <polyline points="7.5,2.5 2.5,2.5 2.5,7.5"    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="12.5,2.5 17.5,2.5 17.5,7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="17.5,12.5 17.5,17.5 12.5,17.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="7.5,17.5 2.5,17.5 2.5,12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <h2 class="na-fullscreen-prompt__title" id="naFullscreenPromptTitle">Better in Full Screen</h2>
                </div>

                <div class="na-fullscreen-prompt__body">
                    <p class="na-fullscreen-prompt__lead">Your model looks its best with the whole screen to fill.</p>
                    <p class="na-fullscreen-prompt__text">
                        Full screen hides the browser toolbars and address bar, so there is
                        noticeably more of the building to look at and nothing around the edges
                        competing for attention. It is the way we would recommend viewing your
                        design.
                    </p>

                    <div class="na-fullscreen-prompt__hint">
                        <p class="na-fullscreen-prompt__hint-title">Leaving full screen at any time</p>
                        <div class="na-fullscreen-prompt__hint-row">
                            <span class="na-fullscreen-prompt__key">Esc</span>
                            <span>Press the Escape key whenever you want the browser back.</span>
                        </div>
                        <div class="na-fullscreen-prompt__hint-row">
                            <span class="na-fullscreen-prompt__key">Menu</span>
                            <span>On a tablet or phone, switch <strong>Full Screen</strong> off again in the <strong>Tools &amp; Settings</strong> menu.</span>
                        </div>
                    </div>
                </div>

                <div class="na-fullscreen-prompt__actions">
                    <button type="button" class="na-fullscreen-prompt__btn na-fullscreen-prompt__btn--secondary" id="${Na__FsPrompt__DismissBtnId}">
                        Not Now
                    </button>
                    <button type="button" class="na-fullscreen-prompt__btn na-fullscreen-prompt__btn--primary" id="${Na__FsPrompt__ConfirmBtnId}">
                        Go Full Screen
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Close Handling
// -----------------------------------------------------------------------------

    // FUNCTION | Close the Invitation Card
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Prompt__Close() {
        if (!Na__FsPrompt__Overlay) return;

        Na__FsPrompt__Overlay.classList.remove('is-open');                   // <-- Fade out
        Na__FsPrompt__MarkDismissedThisSession();                            // <-- Do not offer again this session

        if (Na__FsPrompt__EscapeListener) {
            document.removeEventListener('keydown', Na__FsPrompt__EscapeListener);
            Na__FsPrompt__EscapeListener = null;
        }
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Confirm - Enter Full Screen From This User Gesture
    // ------------------------------------------------------------
    function Na__FsPrompt__HandleConfirmClick() {
        if (typeof Na__FsPrompt__EnterFn === 'function') {
            Na__FsPrompt__EnterFn();                                         // <-- Must run inside the click to satisfy the browser
        }
        Na__UiFeature__FullscreenMode__Prompt__Close();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Open Handling
// -----------------------------------------------------------------------------

    // FUNCTION | Show the Invitation Card If It Is Still Wanted
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Prompt__Show() {
        if (!Na__FsPrompt__Overlay)                        return;           // <-- Not initialized
        if (Na__FsPrompt__HasBeenShown)                    return;           // <-- Already offered on this page load
        if (!Na__UiFeature__FullscreenMode__IsSupported()) return;           // <-- Browser cannot do element full screen
        if (Na__UiFeature__FullscreenMode__IsActive())     return;           // <-- Already full screen; nothing to offer
        if (Na__FsPrompt__WasDismissedThisSession())       return;           // <-- User already said no this session

        Na__FsPrompt__HasBeenShown = true;

        setTimeout(() => {
            if (Na__UiFeature__FullscreenMode__IsActive()) return;           // <-- User beat us to it during the delay

            const toolsMenu = document.getElementById('naToolsMenu');        // <-- Collapse the Tools menu startup peek
            if (toolsMenu) toolsMenu.removeAttribute('open');

            Na__FsPrompt__Overlay.classList.add('is-open');                  // <-- Fade in

            const confirmBtn = document.getElementById(Na__FsPrompt__ConfirmBtnId);
            if (confirmBtn) confirmBtn.focus();                              // <-- Keyboard users land on the primary action

            // ESCAPE KEY | Dismiss the card without entering full screen
            // ------------------------------------------------------------
            Na__FsPrompt__EscapeListener = (event) => {
                if (event.key === 'Escape') {
                    Na__UiFeature__FullscreenMode__Prompt__Close();
                }
            };
            document.addEventListener('keydown', Na__FsPrompt__EscapeListener);

        }, Na__FsPrompt__RevealDelayMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Full Screen Startup Prompt
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Prompt__Initialize(enterFn) {
        if (Na__FsPrompt__IsInitialized) return;                             // <-- Guard: already initialized
        if (!Na__UiFeature__FullscreenMode__IsSupported()) return;           // <-- Build nothing on unsupported browsers
        Na__FsPrompt__IsInitialized = true;

        Na__FsPrompt__EnterFn = enterFn;
        Na__FsPrompt__Overlay = Na__FsPrompt__BuildDom();

        const confirmBtn = document.getElementById(Na__FsPrompt__ConfirmBtnId);
        const dismissBtn = document.getElementById(Na__FsPrompt__DismissBtnId);

        if (confirmBtn) confirmBtn.addEventListener('click', Na__FsPrompt__HandleConfirmClick);
        if (dismissBtn) dismissBtn.addEventListener('click', Na__UiFeature__FullscreenMode__Prompt__Close);

        // BACKDROP CLICK | Click outside the card dismisses it
        // ------------------------------------------------------------
        Na__FsPrompt__Overlay.addEventListener('click', (event) => {
            if (event.target === Na__FsPrompt__Overlay) {                    // <-- Only the backdrop, not the card
                Na__UiFeature__FullscreenMode__Prompt__Close();
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Full Screen Startup Prompt API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__FullscreenMode__Prompt__Initialize,
        Na__UiFeature__FullscreenMode__Prompt__Show,
        Na__UiFeature__FullscreenMode__Prompt__Close
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
