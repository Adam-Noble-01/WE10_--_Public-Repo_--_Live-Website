// =============================================================================
// TRUEVISION3D - FULL SCREEN MODE SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__UiFeature__FullscreenMode__SystemLogic.js
// NAMESPACE  : Na__UiFeature
// MODULE     : FullscreenMode - System Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Cross-browser full screen enter/exit, state sync, menu toggle
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Thin, vendor-prefixed wrapper around the browser Fullscreen API.
// - Owns the Tools & Settings "Full Screen" toggle row: click to enter,
//   click again to exit. The ON/OFF badge mirrors the true browser state,
//   so the row stays correct when the user leaves full screen by pressing
//   Escape or by any other route the browser provides.
// - Escape is handled entirely by the browser - it is never intercepted
//   here, so it always works regardless of which overlay has focus.
// - Feature-detects support and hides the menu row entirely on browsers
//   that cannot do element full screen (notably Safari on iPhone, which
//   only supports full screen for video elements).
// - Dispatches 'na-fullscreen-state-changed' so other modules can react,
//   and forces a window resize so the Three.js renderer, composer and
//   post-processing render targets pick up the new viewport dimensions.
//
// INTEGRATION:
// - Call Na__UiFeature__FullscreenMode__Initialize() once after the DOM is
//   ready. It wires the menu row and starts state synchronisation.
// - Na__UiFeature__FullscreenMode__Enter is passed to the startup prompt as
//   its confirm action - it must be called from inside a user gesture or
//   the browser will reject the request.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Aug-2026 - Version 1.0.0
// - Initial Release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__Fullscreen__MenuItemId    = 'naFullscreenItem';        // <-- Tools menu list item wrapper
    const Na__Fullscreen__ToggleBtnId   = 'naFullscreenToggle';      // <-- Tools menu toggle button
    const Na__Fullscreen__StatusElId    = 'naFullscreenStatus';      // <-- ON / OFF status badge
    // ------------------------------------------------------------

    // MODULE CONSTANTS | CSS Classes and Events
    // ------------------------------------------------------------
    const Na__Fullscreen__ActiveClass   = 'na-walk-mode__toggle--active';   // <-- Shared toggle-row active style
    const NA__FULLSCREEN_CHANGED_EVENT  = 'na-fullscreen-state-changed';    // <-- Dispatched on every state change
    const Na__Fullscreen__ResizeDelayMs = 120;                              // <-- Settle delay before forcing a resize
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Runtime References
    // ------------------------------------------------------------
    let Na__Fullscreen__IsInitialized = false;   // <-- Guard against double init
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fullscreen API Wrapper
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Report Whether Element Full Screen Is Available
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__IsSupported() {
        const root = document.documentElement;
        if (!root) return false;

        const hasRequest = Boolean(                                          // <-- Standard or vendor-prefixed request method
            root.requestFullscreen ||
            root.webkitRequestFullscreen ||
            root.msRequestFullscreen
        );

        if (!hasRequest) return false;                                       // <-- No entry point at all (Safari on iPhone)

        if (document.fullscreenEnabled === false) return false;              // <-- Explicitly blocked (permissions policy / iframe)
        if (document.webkitFullscreenEnabled === false) return false;

        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Report Whether Full Screen Is Currently Active
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__IsActive() {
        return Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Enter Full Screen (Must Be Called From a User Gesture)
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Enter() {
        if (!Na__UiFeature__FullscreenMode__IsSupported()) return Promise.resolve(false);
        if (Na__UiFeature__FullscreenMode__IsActive())      return Promise.resolve(true);

        const root    = document.documentElement;
        const request = root.requestFullscreen
                     || root.webkitRequestFullscreen
                     || root.msRequestFullscreen;

        try {
            const result = request.call(root, { navigationUI: 'hide' });     // <-- Options arg is ignored by older engines
            return Promise.resolve(result)
                .then(() => true)
                .catch(() => false);                                         // <-- User denied or gesture expired
        } catch {
            return Promise.resolve(false);                                   // <-- Synchronous throw on legacy engines
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Exit Full Screen
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Exit() {
        if (!Na__UiFeature__FullscreenMode__IsActive()) return Promise.resolve(true);

        const exit = document.exitFullscreen
                  || document.webkitExitFullscreen
                  || document.msExitFullscreen;

        if (!exit) return Promise.resolve(false);

        try {
            return Promise.resolve(exit.call(document))
                .then(() => true)
                .catch(() => false);
        } catch {
            return Promise.resolve(false);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Full Screen On or Off
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Toggle() {
        return Na__UiFeature__FullscreenMode__IsActive()
            ? Na__UiFeature__FullscreenMode__Exit()
            : Na__UiFeature__FullscreenMode__Enter();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Menu Row State Synchronisation
// -----------------------------------------------------------------------------

    // FUNCTION | Repaint the Tools Menu Toggle Row to Match the Browser State
    // ------------------------------------------------------------
    function Na__Fullscreen__UpdateMenuRow() {
        const isActive  = Na__UiFeature__FullscreenMode__IsActive();
        const toggleBtn = document.getElementById(Na__Fullscreen__ToggleBtnId);
        const statusEl  = document.getElementById(Na__Fullscreen__StatusElId);

        if (statusEl)  statusEl.textContent = isActive ? 'ON' : 'OFF';
        if (toggleBtn) {
            toggleBtn.classList.toggle(Na__Fullscreen__ActiveClass, isActive); // <-- Green badge + icon swap
            toggleBtn.setAttribute('aria-pressed', String(isActive));
            toggleBtn.setAttribute(
                'title',
                isActive
                    ? 'Exit full screen (or press Escape)'
                    : 'Fill the whole screen with the model'
            );
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle a Browser Full Screen State Change
    // ------------------------------------------------------------
    function Na__Fullscreen__HandleStateChange() {
        const isActive = Na__UiFeature__FullscreenMode__IsActive();

        Na__Fullscreen__UpdateMenuRow();                                     // <-- Keep the menu row honest

        window.dispatchEvent(new CustomEvent(NA__FULLSCREEN_CHANGED_EVENT, {
            detail: { isFullscreen: isActive }                               // <-- Notify any interested module
        }));

        // FORCE VIEWPORT RESIZE | Renderer, composer and post-process render
        // targets all resize from the window 'resize' event. Browsers usually
        // fire it themselves on a full screen transition, but the timing is
        // inconsistent, so re-fire it once the new viewport has settled.
        // ------------------------------------------------------------
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, Na__Fullscreen__ResizeDelayMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Full Screen Mode System
    // ------------------------------------------------------------
    function Na__UiFeature__FullscreenMode__Initialize() {
        if (Na__Fullscreen__IsInitialized) return;                           // <-- Guard: already initialized
        Na__Fullscreen__IsInitialized = true;

        const menuItem  = document.getElementById(Na__Fullscreen__MenuItemId);
        const toggleBtn = document.getElementById(Na__Fullscreen__ToggleBtnId);

        // UNSUPPORTED BROWSERS | Hide the row rather than offer a dead control
        // ------------------------------------------------------------
        if (!Na__UiFeature__FullscreenMode__IsSupported()) {
            if (menuItem) menuItem.style.display = 'none';                   // <-- Safari on iPhone lands here
            return;
        }

        if (menuItem) menuItem.style.display = '';                           // <-- Reveal the row (hidden by default in markup)

        // MENU ROW CLICK | Toggle full screen from inside the user gesture
        // ------------------------------------------------------------
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                Na__UiFeature__FullscreenMode__Toggle();                     // <-- State sync happens on the change event
            });
        }

        // BROWSER STATE EVENTS | Standard plus vendor-prefixed variants
        // ------------------------------------------------------------
        document.addEventListener('fullscreenchange',       Na__Fullscreen__HandleStateChange);
        document.addEventListener('webkitfullscreenchange', Na__Fullscreen__HandleStateChange);
        document.addEventListener('MSFullscreenChange',     Na__Fullscreen__HandleStateChange);

        Na__Fullscreen__UpdateMenuRow();                                     // <-- Paint initial state
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Full Screen Mode API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__FullscreenMode__Initialize,
        Na__UiFeature__FullscreenMode__Enter,
        Na__UiFeature__FullscreenMode__Exit,
        Na__UiFeature__FullscreenMode__Toggle,
        Na__UiFeature__FullscreenMode__IsActive,
        Na__UiFeature__FullscreenMode__IsSupported,
        NA__FULLSCREEN_CHANGED_EVENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
