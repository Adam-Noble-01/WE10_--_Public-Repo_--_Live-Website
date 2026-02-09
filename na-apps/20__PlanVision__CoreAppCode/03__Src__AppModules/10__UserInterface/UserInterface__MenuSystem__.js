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
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Implements two-tier menu system (Main Menu / Category Sub-Menus)
// - Supports Drawings, Specifications, and Videos categories
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
            let allDocumentsData               = null;                        // <-- Store all documents for filtering
            let currentDesignPhase             = null;                        // <-- Active design phase

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
            const Na__Initialize = function (context) {
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

            // FUNCTION | Set Documents Data
            // ------------------------------------------------------------
            const Na__SetDocumentsData = function (documents, designPhase) {
                allDocumentsData    = documents;
                currentDesignPhase  = designPhase;
                console.log('[MenuSystem] Documents data updated');
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
            const Na__ShowMainMenu = function () {
                currentMenuView             = 'main';
                currentDocumentTypeFilter   = null;

                // Reset video gallery state if available
                if (window.NaPlanVision && window.NaPlanVision.VideoPlayerGalleryManager) {
                    window.NaPlanVision.VideoPlayerGalleryManager.Na__ResetVideoGalleryState();
                }

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
                const markupToolset = document.getElementById('markup-toolset');
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
            const Na__ShowDrawingsMenu = function () {
                currentMenuView             = 'drawings';
                currentDocumentTypeFilter   = 'Drawing';

                console.log('[MenuSystem] Showing drawings menu...');

                // Hide main menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.add('hidden');
                }

                // Show sub-menu section
                if (subMenuSection) {
                    subMenuSection.classList.add('visible');
                }

                // Populate document buttons filtered by Drawing type
                if (allDocumentsData) {
                    const drawingButtons = window.NaPlanVision?.UserInterface?.DrawingButtons;
                    if (drawingButtons) {
                        drawingButtons.Na__CreateFilteredDocumentButtons(
                            allDocumentsData,
                            'Drawing',
                            false,
                            currentDesignPhase
                        );
                    }
                }

                console.log('[MenuSystem] Drawings menu displayed');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Specifications Menu - Filtered Document List
            // Displays documents where document-type === "Specification"
            // Shows measuring tools and markup tools
            // ------------------------------------------------------------
            const Na__ShowSpecificationsMenu = function () {
                currentMenuView             = 'specifications';
                currentDocumentTypeFilter   = 'Specification';

                console.log('[MenuSystem] Showing specifications menu...');

                // Hide main menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.add('hidden');
                }

                // Show sub-menu section
                if (subMenuSection) {
                    subMenuSection.classList.add('visible');
                }

                // Populate document buttons filtered by Specification type
                if (allDocumentsData) {
                    const drawingButtons = window.NaPlanVision?.UserInterface?.DrawingButtons;
                    if (drawingButtons) {
                        drawingButtons.Na__CreateFilteredDocumentButtons(
                            allDocumentsData,
                            'Specification',
                            false,
                            currentDesignPhase
                        );
                    }
                }

                console.log('[MenuSystem] Specifications menu displayed');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EVENT HANDLERS | Menu Navigation
        // --------------------------------------------------------

            // FUNCTION | Initialize Menu Navigation Event Listeners
            // Attaches click handlers to category buttons
            // ------------------------------------------------------------
            function initMenuNavigation() {
                // Drawings category button
                const drawingsBtn = document.getElementById('showDrawingsMenuBtn');
                if (drawingsBtn) {
                    drawingsBtn.addEventListener('click', Na__ShowDrawingsMenu);
                }

                // Specifications category button
                const specificationsBtn = document.getElementById('showSpecificationsMenuBtn');
                if (specificationsBtn) {
                    specificationsBtn.addEventListener('click', Na__ShowSpecificationsMenu);
                }

                // Back to main menu button
                const backBtn = document.getElementById('backToMainMenuBtn');
                if (backBtn) {
                    backBtn.addEventListener('click', Na__ShowMainMenu);
                }

                // Main menu historic archive button
                const mainHistoricBtn = document.getElementById('mainMenuHistoricBtn');
                if (mainHistoricBtn) {
                    mainHistoricBtn.addEventListener('click', () => {
                        const historicArchive = window.NaPlanVision?.UserInterface?.HistoricArchive;
                        if (historicArchive) {
                            historicArchive.Na__ShowHistoricWarningModal();
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
            const Na__GetCurrentMenuView = function () {
                return currentMenuView;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Current Document Type Filter
            // ------------------------------------------------------------
            const Na__GetCurrentDocumentTypeFilter = function () {
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
                Na__Initialize                       : Na__Initialize,
                Na__SetDocumentsData                 : Na__SetDocumentsData,
                Na__ShowMainMenu                     : Na__ShowMainMenu,
                Na__ShowDrawingsMenu                 : Na__ShowDrawingsMenu,
                Na__ShowSpecificationsMenu           : Na__ShowSpecificationsMenu,
                Na__GetCurrentMenuView               : Na__GetCurrentMenuView,
                Na__GetCurrentDocumentTypeFilter     : Na__GetCurrentDocumentTypeFilter
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('MenuSystem');
            }

            console.log('[MenuSystem] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
