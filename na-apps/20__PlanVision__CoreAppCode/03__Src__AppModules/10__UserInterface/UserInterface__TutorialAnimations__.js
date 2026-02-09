// =============================================================================
// NOBLE ARCHITECTURE - TUTORIAL ANIMATIONS
// =============================================================================
//
// FILE       : UserInterface__TutorialAnimations__.js
// NAMESPACE  : NaPlanVision.UserInterface.TutorialAnimations
// MODULE     : TutorialAnimations
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Enhanced flashing animation and auto-dismiss for tutorial overlay
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages flashing animation lifecycle for tutorial overlay
// - Implements auto-dismiss timer (4500ms) to prevent UI clutter
// - Adds user interaction dismissal handlers
// - Works alongside existing TutorialSystem module
// - Provides attention-grabbing visual effects inspired by DocumentSystem
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Initial creation with DocumentSystem-style flashing animation
// - Auto-dismiss functionality after 4.5 seconds
// - User interaction dismissal on toolbar/menu clicks
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Tutorial Animations
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Animation Configuration
        // --------------------------------------------------------

            const AUTO_DISMISS_DELAY           = 4500;                        // <-- Auto-hide after 4.5 seconds
            const ANIMATION_DURATION           = 4000;                        // <-- CSS animation duration (matches keyframe)

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let menuTutorialOverlay            = null;
            let toolbar                        = null;
            let toolbarToggleButton            = null;
            let dismissTimer                   = null;                        // <-- Auto-dismiss timer ID
            let isInitialized                  = false;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Tutorial Animations
            // Sets up DOM references and prepares for animation
            // ------------------------------------------------------------
            const Na__TutAnim__Initialize = function (context) {
                console.log('[TutorialAnimations] Initializing...');

                if (context) {
                    menuTutorialOverlay = context.menuTutorialOverlay;
                    toolbar = context.toolbar;
                    toolbarToggleButton = context.toolbarToggleButton;
                }

                if (!menuTutorialOverlay) {
                    console.warn('[TutorialAnimations] menuTutorialOverlay element not provided');
                    return;
                }

                if (!toolbar) {
                    console.warn('[TutorialAnimations] toolbar element not provided');
                }

                if (!toolbarToggleButton) {
                    console.warn('[TutorialAnimations] toolbarToggleButton element not provided');
                }

                // Attach dismissal event handlers
                Na__TutAnim__AttachDismissHandlers();

                isInitialized = true;
                console.log('[TutorialAnimations] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ANIMATION CONTROL | Flash and Dismiss
        // --------------------------------------------------------

            // FUNCTION | Start Flash Animation
            // Triggers the flashing animation and auto-dismiss timer
            // Should be called after the overlay becomes visible
            // ------------------------------------------------------------
            const Na__TutAnim__StartFlashAnimation = function () {
                if (!isInitialized || !menuTutorialOverlay) {
                    console.warn('[TutorialAnimations] Cannot start animation - not initialized');
                    return;
                }

                console.log('[TutorialAnimations] Checking overlay visibility...');
                console.log('[TutorialAnimations] Overlay display:', menuTutorialOverlay.style.display);
                console.log('[TutorialAnimations] Overlay computed display:', window.getComputedStyle(menuTutorialOverlay).display);

                // Check if overlay is visible
                if (menuTutorialOverlay.style.display !== 'block') {
                    console.warn('[TutorialAnimations] Overlay not visible (display=' + menuTutorialOverlay.style.display + '), skipping animation');
                    return;
                }

                console.log('[TutorialAnimations] Starting flash animation sequence');
                console.log('[TutorialAnimations] Overlay z-index:', window.getComputedStyle(menuTutorialOverlay).zIndex);
                console.log('[TutorialAnimations] Overlay position:', window.getComputedStyle(menuTutorialOverlay).position);

                // CSS animation will play automatically via animation property
                // The keyframe animation lasts 4 seconds with flashing effects

                // Enable auto-dismiss after animation completes
                Na__TutAnim__EnableAutoDismiss(AUTO_DISMISS_DELAY);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Enable Auto-Dismiss
            // Sets a timer to automatically hide the overlay after specified delay
            // ------------------------------------------------------------
            const Na__TutAnim__EnableAutoDismiss = function (delay) {
                // Clear any existing timer
                if (dismissTimer) {
                    clearTimeout(dismissTimer);
                    dismissTimer = null;
                }

                // Set new auto-dismiss timer
                dismissTimer = setTimeout(() => {
                    Na__TutAnim__DismissOverlay();
                    console.log('[TutorialAnimations] Auto-dismissed overlay after timeout');
                }, delay);

                console.log(`[TutorialAnimations] Auto-dismiss enabled (${delay}ms)`);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Dismiss Overlay
            // Immediately hides the tutorial overlay and clears timers
            // ------------------------------------------------------------
            const Na__TutAnim__DismissOverlay = function () {
                if (!menuTutorialOverlay) {
                    return;
                }

                // Hide the overlay
                menuTutorialOverlay.style.display = 'none';

                // Clear any pending auto-dismiss timer
                if (dismissTimer) {
                    clearTimeout(dismissTimer);
                    dismissTimer = null;
                }

                console.log('[TutorialAnimations] Overlay dismissed');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EVENT HANDLERS | User Interaction Dismissal
        // --------------------------------------------------------

            // FUNCTION | Attach Dismiss Handlers
            // Adds click event listeners to dismiss overlay on user interaction
            // ------------------------------------------------------------
            const Na__TutAnim__AttachDismissHandlers = function () {
                // Dismiss on toolbar toggle button click
                if (toolbarToggleButton) {
                    toolbarToggleButton.addEventListener('click', function() {
                        if (menuTutorialOverlay && menuTutorialOverlay.style.display === 'block') {
                            Na__TutAnim__DismissOverlay();
                            console.log('[TutorialAnimations] Dismissed via toggle button click');
                        }
                    });
                }

                // Dismiss on any click within toolbar (menu interactions)
                if (toolbar) {
                    toolbar.addEventListener('click', function() {
                        if (menuTutorialOverlay && menuTutorialOverlay.style.display === 'block') {
                            Na__TutAnim__DismissOverlay();
                            console.log('[TutorialAnimations] Dismissed via toolbar click');
                        }
                    });
                }

                console.log('[TutorialAnimations] Dismiss handlers attached');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // UTILITY | Helper Functions
        // --------------------------------------------------------

            // FUNCTION | Clear Timers
            // Clears any active dismiss timers (useful for cleanup)
            // ------------------------------------------------------------
            const Na__TutAnim__ClearTimers = function () {
                if (dismissTimer) {
                    clearTimeout(dismissTimer);
                    dismissTimer = null;
                    console.log('[TutorialAnimations] Timers cleared');
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.TutorialAnimations = {
                Na__TutAnim__Initialize           : Na__TutAnim__Initialize,
                Na__TutAnim__StartFlashAnimation  : Na__TutAnim__StartFlashAnimation,
                Na__TutAnim__EnableAutoDismiss    : Na__TutAnim__EnableAutoDismiss,
                Na__TutAnim__DismissOverlay       : Na__TutAnim__DismissOverlay,
                Na__TutAnim__AttachDismissHandlers: Na__TutAnim__AttachDismissHandlers,
                Na__TutAnim__ClearTimers          : Na__TutAnim__ClearTimers
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('TutorialAnimations');
            }

            console.log('[TutorialAnimations] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
