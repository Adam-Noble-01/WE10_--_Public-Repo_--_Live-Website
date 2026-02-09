// =============================================================================
// NOBLE ARCHITECTURE - TUTORIAL SYSTEM
// =============================================================================
//
// FILE       : UserInterface__TutorialSystem__.js
// NAMESPACE  : NaPlanVision.UserInterface.TutorialSystem
// MODULE     : TutorialSystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-load tutorial flow for mobile and tablet devices
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages first-load tutorial sequence for mobile/tablet users
// - Detects device type and orientation
// - Shows menu open → collapse → tooltip sequence
// - Helps new users discover the menu toggle button
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Implements three-step tutorial flow for mobile devices
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Tutorial System
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Device Detection
        // --------------------------------------------------------

            const MAX_TABLET_WIDTH             = 1024;                        // <-- Tablet breakpoint
            const MENU_OPEN_DURATION           = 1000;                        // <-- How long menu stays open (ms)
            const TOOLTIP_DELAY                = 300;                         // <-- Delay before showing tooltip (ms)

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let toolbar                        = null;
            let menuTutorialOverlay            = null;
            let getIsToolbarOpen               = null;
            let setIsToolbarOpen               = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Tutorial System
            // ------------------------------------------------------------
            const Na__Tutorial__Initialize = function (context) {
                console.log('[TutorialSystem] Initializing...');

                if (context) {
                    toolbar = context.toolbar;
                    menuTutorialOverlay = context.menuTutorialOverlay;
                    getIsToolbarOpen = context.getIsToolbarOpen;
                    setIsToolbarOpen = context.setIsToolbarOpen;
                }

                if (!toolbar) {
                    console.warn('[TutorialSystem] toolbar element not provided');
                }

                if (!menuTutorialOverlay) {
                    console.warn('[TutorialSystem] menuTutorialOverlay element not provided');
                }

                console.log('[TutorialSystem] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // TUTORIAL FLOW | First-Load Sequence
        // --------------------------------------------------------

            // FUNCTION | Start Tutorial Flow
            // Begins the three-step tutorial sequence for mobile devices
            // ------------------------------------------------------------
            const Na__Tutorial__StartFlow = function () {
                if (!Na__Tutorial__IsMobilePortrait()) {
                    console.log('[TutorialSystem] Not mobile portrait - skipping tutorial');
                    return;
                }

                console.log('[TutorialSystem] Starting tutorial flow for mobile device...');

                // STEP 1: Show menu open immediately
                if (toolbar) {
                    toolbar.classList.remove('collapsed');
                    if (setIsToolbarOpen) {
                        setIsToolbarOpen(true);
                    }
                    console.log('[TutorialSystem] Step 1: Menu opened');
                }

                // STEP 2: After delay, retract the menu
                setTimeout(() => {
                    if (toolbar) {
                        toolbar.classList.add('collapsed');
                        if (setIsToolbarOpen) {
                            setIsToolbarOpen(false);
                        }
                        console.log('[TutorialSystem] Step 2: Menu collapsed');
                    }

                    // STEP 3: Show the tooltip after a small delay
                    setTimeout(() => {
                        if (menuTutorialOverlay) {
                            menuTutorialOverlay.style.display = 'block';
                            console.log('[TutorialSystem] Step 3: Tooltip displayed');
                        }
                    }, TOOLTIP_DELAY);

                }, MENU_OPEN_DURATION);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // DEVICE DETECTION | Orientation and Type
        // --------------------------------------------------------

            // FUNCTION | Check if Mobile or Tablet in Portrait
            // ------------------------------------------------------------
            const Na__Tutorial__IsMobilePortrait = function () {
                return (window.innerWidth <= MAX_TABLET_WIDTH) && Na__Tutorial__IsPortrait();
            };
            // ---------------------------------------------------------------

            // FUNCTION | Check if Device is in Portrait Orientation
            // ------------------------------------------------------------
            const Na__Tutorial__IsPortrait = function () {
                // Try modern screen orientation API first
                if (window.screen.orientation && window.screen.orientation.type) {
                    return window.screen.orientation.type.startsWith('portrait');
                }

                // Fallback to dimension comparison
                return window.innerHeight > window.innerWidth;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.TutorialSystem = {
                Na__Tutorial__Initialize       : Na__Tutorial__Initialize,
                Na__Tutorial__StartFlow        : Na__Tutorial__StartFlow,
                Na__Tutorial__IsMobilePortrait : Na__Tutorial__IsMobilePortrait,
                Na__Tutorial__IsPortrait       : Na__Tutorial__IsPortrait
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('TutorialSystem');
            }

            console.log('[TutorialSystem] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
