// =============================================================================
// TRUEVISION3D - FLOATING NAVIGATION TOOLBAR CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__NavigationToolbar__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : Navigation Toolbar Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Bottom-centre floating navigation toolbar (Orbit / Walk / Fly / Reset / Help)
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Manages the always-visible floating navigation toolbar fixed to the
//   bottom centre of the 3D viewer canvas.
// - Navigation is the PRIMARY way users interact with the model, so these
//   controls live in their own pill toolbar rather than being buried in the
//   right-hand Tools & Settings menu (which stays focused on technical and
//   configuration tools).
// - Button order: Orbit | Walk | Fly | Reset View | Help | [Menu].
// - The Menu (hamburger) button is mobile-only (<=768px, CSS-gated): it swaps
//   the toolbar out for the Tools & Settings dropdown; folding that menu back
//   up swaps the toolbar back in. The saved-scene carousel needs no toggle -
//   it always shows whenever a project has valid saved scenes.
// - Idle fade: the toolbar rests at 50% opacity and wakes to full opacity on
//   hover/focus (pure CSS) or via a short JS wake flash for hotkey-driven
//   mode changes CSS cannot see. Recipe ported verbatim from ValeVision3D.
// - Orbit is always available; Walk and Fly buttons reveal only when enabled
//   for the current model (Navmode__EnabledModes), matching the gating
//   previously used by the retired Tools-menu Navigation Mode buttons.
// - Enforces Walk/Fly mutual exclusivity via the same toggle wrappers the
//   old menu used ('silent-off' / 'return-to-orbit' hints).
// - Na__NavToolbar__SetActiveMode is the single UI entry point for active
//   mode highlighting - hotkeys and any other mode-changing code path call
//   it, so the toolbar always reflects the true mode. It also dispatches the
//   'na-navigation-mode-changed' CustomEvent for other interested modules.
// - Reset View exits Walk/Fly (return-to-orbit) then restores the canonical
//   project start state via Na__Camera__ProjectStartState.js.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeNavigationToolbar(options) from Index.html.
// - options: { walkEnabled, flyEnabled, toggleWalk, toggleFly, openHelp }
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Supersedes the Tools-menu Walk/Fly/Orbit buttons.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Camera Project Start State (Reset View)
    // ------------------------------------------------------------
    import { Na__CameraStartState__ResetView } from './Na__Camera__ProjectStartState.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__NavToolbar__ContainerId  = 'naNavToolbar';            // <-- Toolbar pill container
    const Na__NavToolbar__OrbitBtnId   = 'naNavToolbarOrbitBtn';    // <-- Orbit mode button
    const Na__NavToolbar__WalkBtnId    = 'naNavToolbarWalkBtn';     // <-- Walk mode button
    const Na__NavToolbar__FlyBtnId     = 'naNavToolbarFlyBtn';      // <-- Fly mode button
    const Na__NavToolbar__ResetBtnId   = 'naNavToolbarResetBtn';    // <-- Reset view button
    const Na__NavToolbar__HelpBtnId    = 'naNavToolbarHelpBtn';     // <-- Help panel button
    const Na__NavToolbar__MenuBtnId    = 'naNavToolbarMenuBtn';     // <-- Mobile hamburger (swaps in the Tools & Settings menu)
    const Na__NavToolbar__ToolsMenuId  = 'naToolsMenu';             // <-- Tools & Settings <details> element
    // ------------------------------------------------------------

    // MODULE CONSTANTS | CSS Classes and Events
    // ------------------------------------------------------------
    const Na__NavToolbar__ActiveClass  = 'na-nav-toolbar__btn--active';      // <-- Pale blue active highlight
    const Na__NavToolbar__WakeClass    = 'na-nav-toolbar--wake';             // <-- Short-lived opaque flash (hotkey mode changes)
    const Na__NavToolbar__MobileToolsOpenClass = 'na-mobile-tools-open';     // <-- Body class: toolbar swapped out for the Tools menu
    const NA__NAV_MODE_CHANGED_EVENT   = 'na-navigation-mode-changed';       // <-- Dispatched on every mode change
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Wake Flash Tuning
    // ------------------------------------------------------------
    const Na__NavToolbar__WakeFlashMs = 1000;                                // <-- How long a hotkey wake stays opaque before fading back
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Runtime References
    // ------------------------------------------------------------
    let Na__NavToolbar__ToggleWalkFn   = null;     // <-- Walk mode toggle wrapper (mutual exclusivity hints)
    let Na__NavToolbar__ToggleFlyFn    = null;     // <-- Fly mode toggle wrapper (mutual exclusivity hints)
    let Na__NavToolbar__OpenHelpFn     = null;     // <-- Help panel open callback
    let Na__NavToolbar__ActiveMode     = 'orbit';  // <-- Currently active mode ('orbit' | 'walk' | 'fly')
    let Na__NavToolbar__WakeTimerHandle = null;    // <-- Pending wake-flash timeout (or null)
    let Na__NavToolbar__WakeEnabled     = false;   // <-- False during boot so init does not flash the toolbar
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Active Mode Display
// -----------------------------------------------------------------------------

    // FUNCTION | Briefly Wake the Toolbar so a Mode Change is Visible
    // ------------------------------------------------------------
    // Pointer hover and keyboard focus are handled purely by CSS (instant,
    // matching the other menus). This flash exists only for hotkey-driven
    // mode changes, which CSS cannot see: it holds the toolbar opaque for
    // a moment so the moved highlight registers, then lets it fade back.
    // ------------------------------------------------------------
    function Na__NavToolbar__FlashWake() {
        if (!Na__NavToolbar__WakeEnabled) return;                            // <-- Stay faded during boot

        const toolbar = document.getElementById(Na__NavToolbar__ContainerId);
        if (!toolbar) return;

        toolbar.classList.add(Na__NavToolbar__WakeClass);                    // <-- Opaque + shadow via CSS

        if (Na__NavToolbar__WakeTimerHandle !== null) {
            clearTimeout(Na__NavToolbar__WakeTimerHandle);                   // <-- Restart any pending flash
        }

        Na__NavToolbar__WakeTimerHandle = setTimeout(() => {
            Na__NavToolbar__WakeTimerHandle = null;
            toolbar.classList.remove(Na__NavToolbar__WakeClass);             // <-- Fade back to idle (0.3s CSS)
        }, Na__NavToolbar__WakeFlashMs);
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Active Mode Highlight on the Toolbar
    // ------------------------------------------------------------
    function Na__NavToolbar__SetActiveMode(activeMode) {
        Na__NavToolbar__ActiveMode = activeMode;

        const setActive = (btnId, isActive) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.classList.toggle(Na__NavToolbar__ActiveClass, isActive);     // <-- Pale blue highlight on active mode
            btn.setAttribute('aria-pressed', String(isActive));
        };

        setActive(Na__NavToolbar__OrbitBtnId, activeMode === 'orbit');
        setActive(Na__NavToolbar__WalkBtnId,  activeMode === 'walk');
        setActive(Na__NavToolbar__FlyBtnId,   activeMode === 'fly');

        Na__NavToolbar__FlashWake();                                         // <-- Hold the toolbar opaque so the change registers

        window.dispatchEvent(new CustomEvent(NA__NAV_MODE_CHANGED_EVENT, {
            detail: { mode: activeMode }                                     // <-- Notify other modules of the mode change
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Currently Active Navigation Mode
    // ------------------------------------------------------------
    function Na__NavToolbar__GetActiveMode() {
        return Na__NavToolbar__ActiveMode;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Walk and Fly Button Visibility
// -----------------------------------------------------------------------------

    // FUNCTION | Reveal or Hide Walk and Fly Buttons Based on Enabled Flags
    // ------------------------------------------------------------
    function Na__UiFeature__RevealNavigationToolbarModes(walkEnabled, flyEnabled) {
        const walkBtn = document.getElementById(Na__NavToolbar__WalkBtnId);
        const flyBtn  = document.getElementById(Na__NavToolbar__FlyBtnId);

        if (walkBtn) walkBtn.style.display = walkEnabled ? '' : 'none';      // <-- Show Walk button only if enabled
        if (flyBtn)  flyBtn.style.display  = flyEnabled  ? '' : 'none';      // <-- Show Fly button only if enabled
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Button Click Handlers
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Return to Orbit Mode from Any Active Mode
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleOrbitClick() {
        if (Na__NavToolbar__ToggleWalkFn) Na__NavToolbar__ToggleWalkFn('return-to-orbit');  // <-- Exit walk if active
        if (Na__NavToolbar__ToggleFlyFn)  Na__NavToolbar__ToggleFlyFn('return-to-orbit');   // <-- Exit fly if active
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Toggle Walk Mode (Deactivates Fly First)
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleWalkClick() {
        if (Na__NavToolbar__ToggleFlyFn)  Na__NavToolbar__ToggleFlyFn('silent-off');        // <-- Deactivate fly silently if active
        if (Na__NavToolbar__ToggleWalkFn) Na__NavToolbar__ToggleWalkFn();                   // <-- Standard toggle with UI callbacks
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Toggle Fly Mode (Deactivates Walk First)
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleFlyClick() {
        if (Na__NavToolbar__ToggleWalkFn) Na__NavToolbar__ToggleWalkFn('silent-off');       // <-- Deactivate walk silently if active
        if (Na__NavToolbar__ToggleFlyFn)  Na__NavToolbar__ToggleFlyFn();                    // <-- Standard toggle with UI callbacks
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Reset View to the Project Start State
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleResetClick() {
        Na__NavToolbar__HandleOrbitClick();                                  // <-- Safely return to orbit before restoring state
        Na__CameraStartState__ResetView();                                   // <-- Restore project start position/target/FOV
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Open the Navigation Help Panel
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleHelpClick() {
        if (Na__NavToolbar__OpenHelpFn) Na__NavToolbar__OpenHelpFn();        // <-- Delegate to the help panel module
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Swap the Toolbar Out for the Tools & Settings Menu (Mobile)
    // ------------------------------------------------------------
    // Mobile-only (<=768px): CSS hides the standalone Tools & Settings
    // trigger there and reveals this hamburger instead. Adding the body
    // class hides the toolbar and displays the dropdown in the same row;
    // opening the <details> AFTER a forced reflow lets the menu list play
    // its normal drop-down animation from the freshly displayed state.
    // ------------------------------------------------------------
    function Na__NavToolbar__HandleMenuClick() {
        const toolsMenu = document.getElementById(Na__NavToolbar__ToolsMenuId);
        if (!toolsMenu) return;

        document.body.classList.add(Na__NavToolbar__MobileToolsOpenClass);   // <-- Toolbar out, dropdown in (CSS swap)

        const menuBtn = document.getElementById(Na__NavToolbar__MenuBtnId);
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');

        void toolsMenu.offsetWidth;                                          // <-- Commit display change so the open animation runs
        toolsMenu.setAttribute('open', 'open');                              // <-- Drop the regular menu down
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Floating Navigation Toolbar
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeNavigationToolbar({ walkEnabled, flyEnabled, toggleWalk, toggleFly, openHelp } = {}) {
        Na__NavToolbar__ToggleWalkFn = toggleWalk;
        Na__NavToolbar__ToggleFlyFn  = toggleFly;
        Na__NavToolbar__OpenHelpFn   = openHelp;

        // REVEAL/HIDE WALK AND FLY BUTTONS
        Na__UiFeature__RevealNavigationToolbarModes(walkEnabled, flyEnabled);

        // WIRE TOOLBAR BUTTONS
        const wireButton = (btnId, handler) => {
            const btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', handler);
        };

        wireButton(Na__NavToolbar__OrbitBtnId, Na__NavToolbar__HandleOrbitClick);
        wireButton(Na__NavToolbar__WalkBtnId,  Na__NavToolbar__HandleWalkClick);
        wireButton(Na__NavToolbar__FlyBtnId,   Na__NavToolbar__HandleFlyClick);
        wireButton(Na__NavToolbar__ResetBtnId, Na__NavToolbar__HandleResetClick);
        wireButton(Na__NavToolbar__HelpBtnId,  Na__NavToolbar__HandleHelpClick);
        wireButton(Na__NavToolbar__MenuBtnId,  Na__NavToolbar__HandleMenuClick);

        // MOBILE MENU SWAP | Folding the Tools menu back up restores the toolbar
        // ------------------------------------------------------------
        // The <details> toggle event fires however the menu is closed (its
        // summary, the boot teaser, or a menu item closing it), so this one
        // listener is the single point that swaps the toolbar back in.
        // ------------------------------------------------------------
        const toolsMenu = document.getElementById(Na__NavToolbar__ToolsMenuId);
        if (toolsMenu) {
            toolsMenu.addEventListener('toggle', () => {
                if (toolsMenu.open) return;                                  // <-- Only act when the menu folds up
                document.body.classList.remove(Na__NavToolbar__MobileToolsOpenClass); // <-- Toolbar back in its row
                const menuBtn = document.getElementById(Na__NavToolbar__MenuBtnId);
                if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // SET INITIAL ACTIVE STATE (Orbit is the default mode on load)
        Na__NavToolbar__SetActiveMode('orbit');

        // LISTEN FOR PROJECT DATA LOAD EVENT (async - reveals Walk/Fly once modes are known)
        window.addEventListener('na-navigation-modes-loaded', (event) => {
            const modes = event.detail && event.detail.enabledModes;
            if (!modes) return;
            Na__UiFeature__RevealNavigationToolbarModes(
                Boolean(modes.Navmode__EnabledModes__Walk),                  // <-- Walk enabled for this model
                Boolean(modes.Navmode__EnabledModes__Fly)                    // <-- Fly enabled for this model
            );
        }, { once: true });

        // Pointer hover / keyboard focus wake is pure CSS - no listeners needed.
        // WakeEnabled stays false until after this call so boot never flashes.
        Na__NavToolbar__WakeEnabled = true;                                  // <-- Hotkey wake flashes allowed from here on
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Navigation Toolbar API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeNavigationToolbar,
        Na__UiFeature__RevealNavigationToolbarModes,
        Na__NavToolbar__SetActiveMode,
        Na__NavToolbar__GetActiveMode,
        NA__NAV_MODE_CHANGED_EVENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
