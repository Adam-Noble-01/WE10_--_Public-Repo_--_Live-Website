// =============================================================================
// NOBLE ARCHITECTURE - MENU SYSTEM
// =============================================================================
//
// FILE       : UserInterface__MenuSystem__.js
// NAMESPACE  : NaPlanVision.UserInterface.MenuSystem
// MODULE     : MenuSystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Two-tier menu navigation system for document categories
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Controls navigation between Main Menu and Sub-Menus
// - Filters documents by document-type (Drawing/Specification)
// - Manages menu state and visibility transitions
// - Coordinates with DrawingButtons and HistoricArchive modules
// - Uses folder-grouped data from DrawingsDataManager
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Implements two-tier menu system (Main Menu / Category Sub-Menus)
// - Supports Drawings, Specifications, and Videos categories
//
// 09-Feb-2026 - Version 2.0.0
// - Updated for folder-structure-driven data flow
// - Uses folder groups from DrawingsDataManager for grouped button display
// - Passes grouped data to DrawingButtons.CreateGroupedDocumentButtons
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Menu System
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Menu State Variables
        // --------------------------------------------------------

            let currentMenuView                = 'main';                      // <-- 'main', 'drawings', 'specifications'
            let currentDocumentTypeFilter      = null;                        // <-- 'Drawing' or 'Specification'

            // DOM References
            let mainMenuSection                = null;
            let subMenuSection                 = null;
            let documentSelectionArea          = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Menu System
            // ------------------------------------------------------------
            const Na__Menu__Initialize = function (context) {
                console.log('[MenuSystem] Initializing...');

                // Store DOM references
                mainMenuSection         = document.getElementById('main-menu-section');
                subMenuSection          = document.getElementById('sub-menu-section');
                documentSelectionArea   = document.getElementById('document-selection-area');

                // Attach event listeners to menu buttons
                initMenuNavigation();

                console.log('[MenuSystem] Initialized successfully');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Set Documents Data (backward compatibility placeholder)
            // Data is now accessed directly from DrawingsDataManager
            // This function is retained for init-flow compatibility
            // ------------------------------------------------------------
            const Na__Menu__SetDocumentsData = function (documents, designPhase) {
                console.log('[MenuSystem] Documents data reference updated');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // MENU NAVIGATION | Show/Hide Menu Views
        // --------------------------------------------------------

            // FUNCTION | Show Main Menu - Category Selection View
            // Displays category buttons (Drawings, Specifications, Videos)
            // Hides sub-menu section with document lists
            // ------------------------------------------------------------
            const Na__Menu__ShowMainMenu = function () {
                currentMenuView             = 'main';
                currentDocumentTypeFilter   = null;

                // Reset video gallery state if available
                if (window.NaPlanVision && window.NaPlanVision.VideoPlayerGalleryManager) {
                    window.NaPlanVision.VideoPlayerGalleryManager.Na__Video__ResetVideoGalleryState();
                }

                // Hide Drawing Register when returning to main menu
                hideDrawingRegister();

                console.log('[MenuSystem] Showing main menu...');

                // Show main menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.remove('hidden');
                }

                // Hide sub-menu section
                if (subMenuSection) {
                    subMenuSection.classList.remove('visible');
                }

                // Clear document selection area
                if (documentSelectionArea) {
                    documentSelectionArea.innerHTML = '';
                }

                // Hide markup toolset if it was open
                var markupToolset = document.getElementById('markup-toolset');
                if (markupToolset) {
                    markupToolset.style.display = 'none';
                }

                console.log('[MenuSystem] Main menu displayed');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Drawings Menu - Filtered Document List
            // Displays documents where document-type === "Drawing"
            // Shows measuring tools and markup tools
            // ------------------------------------------------------------
            const Na__Menu__ShowDrawingsMenu = function () {
                currentMenuView             = 'drawings';
                currentDocumentTypeFilter   = 'Drawing';

                console.log('[MenuSystem] Showing drawings menu...');

                // Hide Drawing Register if visible
                hideDrawingRegister();

                // Hide main menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.add('hidden');
                }

                // Show sub-menu section
                if (subMenuSection) {
                    subMenuSection.classList.add('visible');
                }

                // Get folder groups from DrawingsDataManager and create grouped buttons
                var dataManager    = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                var drawingButtons = window.NaPlanVision
                    && window.NaPlanVision.UserInterface
                    && window.NaPlanVision.UserInterface.DrawingButtons;

                if (dataManager && drawingButtons) {
                    var folderGroups = dataManager.Na__Data__GetFolderGroups('Drawing');
                    drawingButtons.Na__Buttons__CreateGroupedDocumentButtons(
                        folderGroups,
                        'Drawing',
                        false
                    );
                }

                console.log('[MenuSystem] Drawings menu displayed');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Specifications Menu - Filtered Document List
            // Displays documents where document-type === "Specification"
            // Shows measuring tools and markup tools
            // ------------------------------------------------------------
            const Na__Menu__ShowSpecificationsMenu = function () {
                currentMenuView             = 'specifications';
                currentDocumentTypeFilter   = 'Specification';

                console.log('[MenuSystem] Showing specifications menu...');

                // Hide Drawing Register if visible
                hideDrawingRegister();

                // Hide main menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.add('hidden');
                }

                // Show sub-menu section
                if (subMenuSection) {
                    subMenuSection.classList.add('visible');
                }

                // Get folder groups from DrawingsDataManager and create grouped buttons
                var dataManager    = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                var drawingButtons = window.NaPlanVision
                    && window.NaPlanVision.UserInterface
                    && window.NaPlanVision.UserInterface.DrawingButtons;

                if (dataManager && drawingButtons) {
                    var folderGroups = dataManager.Na__Data__GetFolderGroups('Specification');
                    drawingButtons.Na__Buttons__CreateGroupedDocumentButtons(
                        folderGroups,
                        'Specification',
                        false
                    );
                }

                console.log('[MenuSystem] Specifications menu displayed');
            };

            // ---------------------------------------------------------------

            // FUNCTION | Show Drawing Register
            // Shows the Drawing Register panel in the canvas area
            // ------------------------------------------------------------
            const Na__Menu__ShowDrawingRegister = function () {
                var landingPage = window.NaPlanVision && window.NaPlanVision.LandingPage;
                if (landingPage) {
                    landingPage.Na__Landing__Show();
                }
                console.log('[MenuSystem] Drawing Register shown');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EVENT HANDLERS | Menu Navigation
        // --------------------------------------------------------

            // FUNCTION | Hide Drawing Register Helper
            // Hides the Drawing Register panel if it is visible
            // ------------------------------------------------------------
            function hideDrawingRegister() {
                var landingPage = window.NaPlanVision && window.NaPlanVision.LandingPage;
                if (landingPage && landingPage.Na__Landing__IsVisible()) {
                    landingPage.Na__Landing__Hide();
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Initialize Menu Navigation Event Listeners
            // Attaches click handlers to category buttons
            // ------------------------------------------------------------
            function initMenuNavigation() {
                // Drawing Register category button
                var registerBtn = document.getElementById('showDrawingRegisterBtn');
                if (registerBtn) {
                    registerBtn.addEventListener('click', Na__Menu__ShowDrawingRegister);
                }

                // Drawings category button
                var drawingsBtn = document.getElementById('showDrawingsMenuBtn');
                if (drawingsBtn) {
                    drawingsBtn.addEventListener('click', Na__Menu__ShowDrawingsMenu);
                }

                // Specifications category button
                var specificationsBtn = document.getElementById('showSpecificationsMenuBtn');
                if (specificationsBtn) {
                    specificationsBtn.addEventListener('click', Na__Menu__ShowSpecificationsMenu);
                }

                // Back to main menu button
                var backBtn = document.getElementById('backToMainMenuBtn');
                if (backBtn) {
                    backBtn.addEventListener('click', Na__Menu__ShowMainMenu);
                }

                // Main menu historic archive button
                var mainHistoricBtn = document.getElementById('mainMenuHistoricBtn');
                if (mainHistoricBtn) {
                    mainHistoricBtn.addEventListener('click', function () {
                        var historicArchive = window.NaPlanVision
                            && window.NaPlanVision.UserInterface
                            && window.NaPlanVision.UserInterface.HistoricArchive;
                        if (historicArchive) {
                            historicArchive.Na__Archive__ShowHistoricWarningModal();
                        }
                    });
                }

                console.log('[MenuSystem] Menu navigation event listeners initialized');
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ACCESSORS | State Getters
        // --------------------------------------------------------

            // FUNCTION | Get Current Menu View
            // ------------------------------------------------------------
            const Na__Menu__GetCurrentMenuView = function () {
                return currentMenuView;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Current Document Type Filter
            // ------------------------------------------------------------
            const Na__Menu__GetCurrentDocumentTypeFilter = function () {
                return currentDocumentTypeFilter;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.MenuSystem = {
                Na__Menu__Initialize                       : Na__Menu__Initialize,
                Na__Menu__SetDocumentsData                 : Na__Menu__SetDocumentsData,
                Na__Menu__ShowMainMenu                     : Na__Menu__ShowMainMenu,
                Na__Menu__ShowDrawingsMenu                 : Na__Menu__ShowDrawingsMenu,
                Na__Menu__ShowSpecificationsMenu           : Na__Menu__ShowSpecificationsMenu,
                Na__Menu__GetCurrentMenuView               : Na__Menu__GetCurrentMenuView,
                Na__Menu__GetCurrentDocumentTypeFilter     : Na__Menu__GetCurrentDocumentTypeFilter
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('MenuSystem');
            }

            console.log('[MenuSystem] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
