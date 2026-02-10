// =============================================================================
// NOBLE ARCHITECTURE - TOOLBAR MANAGER
// =============================================================================
//
// FILE       : UserInterface__ToolbarManager__.js
// NAMESPACE  : NaPlanVision.UserInterface.ToolbarManager
// MODULE     : ToolbarManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Toolbar visibility toggle and state management
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages toolbar visibility state
// - Handles toolbar toggle with safety checks
// - Dismisses tutorial overlay when toggling
// - Prevents toggle during active tool operations
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Added expanded API beyond simple toggle
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Toolbar Manager
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Context and References
        // --------------------------------------------------------

            let toolbar                        = null;
            let menuTutorialOverlay            = null;
            let getCurrentTool                 = null;
            let getIsToolbarOpen               = null;
            let setIsToolbarOpen               = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Toolbar Manager
            // ------------------------------------------------------------
            const Na__Toolbar__Initialize = function (context) {
                console.log('[ToolbarManager] Initializing...');

                if (context) {
                    toolbar = context.toolbar;
                    menuTutorialOverlay = context.menuTutorialOverlay;
                    getCurrentTool = context.getCurrentTool;
                    getIsToolbarOpen = context.getIsToolbarOpen;
                    setIsToolbarOpen = context.setIsToolbarOpen;
                }

                if (!toolbar) {
                    console.error('[ToolbarManager] toolbar element is required');
                }

                console.log('[ToolbarManager] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // TOOLBAR CONTROL | Visibility Management
        // --------------------------------------------------------

            // FUNCTION | Toggle Toolbar Visibility
            // Toggles between open and collapsed states
            // When a tool is active, only closing is allowed (not opening)
            // ------------------------------------------------------------
            const Na__Toolbar__Toggle = function () {
                // Dismiss tutorial overlay if visible
                if (menuTutorialOverlay && menuTutorialOverlay.style.display === 'block') {
                    menuTutorialOverlay.style.display = 'none';
                    console.log('[ToolbarManager] Tutorial overlay dismissed');
                }

                // Toggle toolbar state
                if (getIsToolbarOpen && setIsToolbarOpen && toolbar) {
                    const currentState = getIsToolbarOpen();
                    const newState = !currentState;

                    // If trying to open while a tool is active, block it
                    if (newState === true && !Na__Toolbar__CanToggle()) {
                        console.log('[ToolbarManager] Open blocked - tool is active');
                        return;
                    }

                    setIsToolbarOpen(newState);
                    toolbar.classList.toggle('collapsed', !newState);

                    console.log('[ToolbarManager] Toolbar toggled:', newState ? 'OPEN' : 'CLOSED');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Open Toolbar
            // ------------------------------------------------------------
            const Na__Toolbar__Open = function () {
                if (toolbar && setIsToolbarOpen) {
                    toolbar.classList.remove('collapsed');
                    setIsToolbarOpen(true);
                    console.log('[ToolbarManager] Toolbar opened');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Close Toolbar
            // ------------------------------------------------------------
            const Na__Toolbar__Close = function () {
                if (toolbar && setIsToolbarOpen) {
                    toolbar.classList.add('collapsed');
                    setIsToolbarOpen(false);
                    console.log('[ToolbarManager] Toolbar closed');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Toolbar Open State
            // ------------------------------------------------------------
            const Na__Toolbar__IsOpen = function () {
                if (getIsToolbarOpen) {
                    return getIsToolbarOpen();
                }
                return false;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Check if Toggle is Allowed
            // Prevents toggling during active tool operations
            // ------------------------------------------------------------
            const Na__Toolbar__CanToggle = function () {
                // Don't allow toggle if a measurement/markup tool is active
                if (getCurrentTool) {
                    const activeTool = getCurrentTool();
                    if (activeTool) {
                        return false;
                    }
                }
                return true;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // CANVAS INTERACTION | Smart Menu Auto-Hide
        // --------------------------------------------------------

            // FUNCTION | Close On Canvas Use
            // Closes the toolbar when the user interacts with the canvas
            // (panning, zooming, measurement tool use)
            // ------------------------------------------------------------
            const Na__Toolbar__CloseOnCanvasUse = function () {
                if (getIsToolbarOpen && getIsToolbarOpen()) {
                    Na__Toolbar__Close();
                    console.log('[ToolbarManager] Toolbar closed via canvas interaction');
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.ToolbarManager = {
                Na__Toolbar__Initialize        : Na__Toolbar__Initialize,
                Na__Toolbar__Toggle            : Na__Toolbar__Toggle,
                Na__Toolbar__Open              : Na__Toolbar__Open,
                Na__Toolbar__Close             : Na__Toolbar__Close,
                Na__Toolbar__IsOpen            : Na__Toolbar__IsOpen,
                Na__Toolbar__CanToggle         : Na__Toolbar__CanToggle,
                Na__Toolbar__CloseOnCanvasUse  : Na__Toolbar__CloseOnCanvasUse
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('ToolbarManager');
            }

            console.log('[ToolbarManager] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
