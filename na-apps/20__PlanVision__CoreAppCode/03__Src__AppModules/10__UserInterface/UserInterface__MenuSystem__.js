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
// 01-Jun-2026 - Version 2.2.0
// - Na__Menu__ShowDrawingsMenu and Na__Menu__ShowSpecificationsMenu now accept
//   optional preferredFileName argument for deep-link document pre-selection
// - Added Na__Menu__ActivateButtonForFileName helper for button highlighting
//
// 04-Apr-2026 - Version 2.1.0
// - Added phase-aware gating for Details & Specifications category visibility
// - Shows specifications category only for DesignPhase03 with active specification documents
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

            let currentMenuView                = 'main';                      // <-- 'main', 'drawings', 'specifications', 'design-access-statement'
            let currentDocumentTypeFilter      = null;                        // <-- 'Drawing' or 'Specification'
            let activeCategoryButton           = null;                        // <-- Currently active category button

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
                Na__Menu__UpdateSpecificationsCategoryVisibility(designPhase);
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

                // Clear active category button state
                clearActiveCategoryButton();

                // Reset video gallery state if available
                if (window.NaPlanVision && window.NaPlanVision.VideoPlayerGalleryManager) {
                    window.NaPlanVision.VideoPlayerGalleryManager.Na__Video__ResetVideoGalleryState();
                }

                // Hide Drawing Register and How To Use when returning to main menu
                hideDrawingRegister();
                hideHowToUse();
                hideDesignAccessStatementViewer();

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
            // Optional preferredFileName: loads that specific drawing on open
            // ------------------------------------------------------------
            const Na__Menu__ShowDrawingsMenu = function (preferredFileName) {
                currentMenuView             = 'drawings';
                currentDocumentTypeFilter   = 'Drawing';

                // Set active category button
                setActiveCategoryButton('showDrawingsMenuBtn');

                console.log('[MenuSystem] Showing drawings menu...');

                // Hide Drawing Register and How To Use if visible
                hideDrawingRegister();
                hideHowToUse();
                hideDesignAccessStatementViewer();

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

                    var flatDrawings     = dataManager.Na__Data__GetFlatDrawingsList('Drawing');
                    var targetDrawing    = Na__Menu__FindDrawingByFileName(flatDrawings, preferredFileName)
                                          || (flatDrawings && flatDrawings[0]);

                    if (targetDrawing) {
                        var drawingLoader = window.NaPlanVision
                            && window.NaPlanVision.DrawingsCanvas
                            && window.NaPlanVision.DrawingsCanvas.DrawingLoader;

                        if (drawingLoader) {
                            drawingLoader.Na__Canvas__LoadDrawing(targetDrawing);

                            // Highlight the matching button after DOM settles
                            setTimeout(function () {
                                Na__Menu__ActivateButtonForFileName(
                                    documentSelectionArea,
                                    targetDrawing['document-name']
                                );
                            }, 100);

                            console.log('[MenuSystem] Loaded drawing:', targetDrawing['document-name']);
                        }
                    }
                }

                console.log('[MenuSystem] Drawings menu displayed');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Specifications Menu - Filtered Document List
            // Displays documents where document-type === "Specification"
            // Optional preferredFileName: loads that specific specification on open
            // ------------------------------------------------------------
            const Na__Menu__ShowSpecificationsMenu = function (preferredFileName) {
                currentMenuView             = 'specifications';
                currentDocumentTypeFilter   = 'Specification';

                // Set active category button
                setActiveCategoryButton('showSpecificationsMenuBtn');

                console.log('[MenuSystem] Showing specifications menu...');

                // Hide Drawing Register and How To Use if visible
                hideDrawingRegister();
                hideHowToUse();
                hideDesignAccessStatementViewer();

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

                    var flatDrawings     = dataManager.Na__Data__GetFlatDrawingsList('Specification');
                    var targetDrawing    = Na__Menu__FindDrawingByFileName(flatDrawings, preferredFileName)
                                          || (flatDrawings && flatDrawings[0]);

                    if (targetDrawing) {
                        var drawingLoader = window.NaPlanVision
                            && window.NaPlanVision.DrawingsCanvas
                            && window.NaPlanVision.DrawingsCanvas.DrawingLoader;

                        if (drawingLoader) {
                            drawingLoader.Na__Canvas__LoadDrawing(targetDrawing);

                            // Highlight the matching button after DOM settles
                            setTimeout(function () {
                                Na__Menu__ActivateButtonForFileName(
                                    documentSelectionArea,
                                    targetDrawing['document-name']
                                );
                            }, 100);

                            console.log('[MenuSystem] Loaded specification:', targetDrawing['document-name']);
                        }
                    }
                }

                console.log('[MenuSystem] Specifications menu displayed');
            };

            // ---------------------------------------------------------------

            // FUNCTION | Show Design Access Statement Viewer
            // Displays dedicated PDF renderer for Sxx statement documents.
            // ------------------------------------------------------------
            const Na__Menu__ShowDesignAccessStatement = function () {
                currentMenuView             = 'design-access-statement';
                currentDocumentTypeFilter   = null;

                // Set active category button
                setActiveCategoryButton('showDesignAccessStatementBtn');

                // Hide Drawing Register and How To Use if visible
                hideDrawingRegister();
                hideHowToUse();

                // Show main menu section and hide sub-menu section
                if (mainMenuSection) {
                    mainMenuSection.classList.remove('hidden');
                }

                if (subMenuSection) {
                    subMenuSection.classList.remove('visible');
                }

                if (documentSelectionArea) {
                    documentSelectionArea.innerHTML = '';
                }

                // Hide markup toolset if it was open
                var markupToolset = document.getElementById('markup-toolset');
                if (markupToolset) {
                    markupToolset.style.display = 'none';
                }

                var dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                var statementDoc = dataManager
                    ? dataManager.Na__Data__GetPrimaryDesignAccessStatementDocument()
                    : null;

                var statementViewer = window.NaPlanVision
                    && window.NaPlanVision.DesignAccessStatement
                    && window.NaPlanVision.DesignAccessStatement.Viewer;

                if (!statementViewer) {
                    console.warn('[MenuSystem] Design Access Statement viewer module unavailable');
                    return;
                }

                if (statementDoc) {
                    statementViewer.Na__Das__ShowDocument(statementDoc);
                    console.log('[MenuSystem] Design Access Statement opened:', statementDoc['file-name']);
                } else {
                    statementViewer.Na__Das__ShowEmptyState(
                        'No Design and Access Statement is available in the active design phase.'
                    );
                    console.log('[MenuSystem] No Design Access Statement found for active phase');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Drawing Register
            // Shows the Drawing Register panel in the canvas area
            // ------------------------------------------------------------
            const Na__Menu__ShowDrawingRegister = function () {
                // Set active category button
                setActiveCategoryButton('showDrawingRegisterBtn');

                // Hide How To Use if visible
                hideHowToUse();
                hideDesignAccessStatementViewer();

                var landingPage = window.NaPlanVision && window.NaPlanVision.LandingPage;
                if (landingPage) {
                    landingPage.Na__Landing__Show();
                }
                console.log('[MenuSystem] Drawing Register shown');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show How To Use
            // Shows the How To Use instructions panel in the canvas area
            // ------------------------------------------------------------
            const Na__Menu__ShowHowToUse = function () {
                // Set active category button
                setActiveCategoryButton('showHowToUseBtn');

                // Hide Drawing Register if visible
                hideDrawingRegister();
                hideDesignAccessStatementViewer();

                var howToUse = window.NaPlanVision && window.NaPlanVision.HowToUse;
                if (howToUse) {
                    howToUse.Na__HowToUse__Show();
                }
                console.log('[MenuSystem] How To Use shown');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EVENT HANDLERS | Menu Navigation
        // --------------------------------------------------------

            // FUNCTION | Find Drawing in Flat List by File-Name String
            // Returns the first drawing whose file-name matches; null if not found
            // ------------------------------------------------------------
            function Na__Menu__FindDrawingByFileName(flatList, fileName) {
                if (!flatList || !fileName) return null;

                var target = String(fileName).trim().toLowerCase();

                for (var i = 0; i < flatList.length; i++) {
                    var name = String(flatList[i]['file-name'] || '').trim().toLowerCase();
                    if (name === target) {
                        return flatList[i];
                    }
                }

                return null;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Mark the Button Matching a Document Name as Active
            // Scans .tool-button elements in the given container and activates
            // the one whose textContent matches the drawing's document-name
            // ------------------------------------------------------------
            function Na__Menu__ActivateButtonForFileName(container, documentName) {
                if (!container || !documentName) {
                    // Fall back to marking the first button active
                    var first = container && container.querySelector('.tool-button');
                    if (first) first.classList.add('active');
                    return;
                }

                var buttons   = container.querySelectorAll('.tool-button');
                var targetText = String(documentName).trim();
                var matched    = false;

                buttons.forEach(function (btn) {
                    btn.classList.remove('active');
                    if (!matched && btn.textContent.trim() === targetText) {
                        btn.classList.add('active');
                        matched = true;
                    }
                });

                // Fallback: no exact match, activate first button
                if (!matched) {
                    var firstBtn = container.querySelector('.tool-button');
                    if (firstBtn) firstBtn.classList.add('active');
                }
            }
            // ---------------------------------------------------------------

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

            // FUNCTION | Hide How To Use Helper
            // Hides the How To Use panel if it is visible
            // ------------------------------------------------------------
            function hideHowToUse() {
                var howToUse = window.NaPlanVision && window.NaPlanVision.HowToUse;
                if (howToUse && howToUse.Na__HowToUse__IsVisible()) {
                    howToUse.Na__HowToUse__Hide();
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Hide Design Access Statement Viewer Helper
            // Ensures PDF statement renderer is hidden outside statement mode.
            // ------------------------------------------------------------
            function hideDesignAccessStatementViewer() {
                var statementViewer = window.NaPlanVision
                    && window.NaPlanVision.DesignAccessStatement
                    && window.NaPlanVision.DesignAccessStatement.Viewer;
                if (statementViewer && statementViewer.Na__Das__HideViewer) {
                    statementViewer.Na__Das__HideViewer();
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Check if Active Phase has Specification Documents
            // ------------------------------------------------------------
            function Na__Menu__HasSpecificationDocumentsInPhase(designPhase) {
                var dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                if (!dataManager || !dataManager.Na__Data__GetFlatDrawingsList) {
                    return false;
                }

                var specificationDocs = dataManager.Na__Data__GetFlatDrawingsList('Specification', designPhase) || [];
                return specificationDocs.length > 0;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Determine Specifications Button Visibility State
            // ------------------------------------------------------------
            function Na__Menu__ShouldShowSpecificationsCategory(designPhase) {
                var dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                var resolvedDesignPhase = designPhase;

                if (!resolvedDesignPhase && dataManager && dataManager.Na__Data__GetCurrentDesignPhase) {
                    resolvedDesignPhase = dataManager.Na__Data__GetCurrentDesignPhase();
                }

                if (resolvedDesignPhase !== 'DesignPhase03') {
                    return false;
                }

                return Na__Menu__HasSpecificationDocumentsInPhase(resolvedDesignPhase);
            }
            // ---------------------------------------------------------------

            // FUNCTION | Update Specifications Category Button Visibility
            // ------------------------------------------------------------
            function Na__Menu__UpdateSpecificationsCategoryVisibility(designPhase) {
                var specificationsBtn = document.getElementById('showSpecificationsMenuBtn');
                if (!specificationsBtn) {
                    return;
                }

                var shouldShowSpecifications = Na__Menu__ShouldShowSpecificationsCategory(designPhase);
                specificationsBtn.style.display = shouldShowSpecifications ? '' : 'none';
                specificationsBtn.setAttribute('aria-hidden', shouldShowSpecifications ? 'false' : 'true');

                if (!shouldShowSpecifications && currentMenuView === 'specifications') {
                    Na__Menu__ShowMainMenu();
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

                // Design & Access Statement category button
                var designAccessStatementBtn = document.getElementById('showDesignAccessStatementBtn');
                if (designAccessStatementBtn) {
                    designAccessStatementBtn.addEventListener('click', Na__Menu__ShowDesignAccessStatement);
                }

                // How To Use category button
                var howToUseBtn = document.getElementById('showHowToUseBtn');
                if (howToUseBtn) {
                    howToUseBtn.addEventListener('click', Na__Menu__ShowHowToUse);
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

            // FUNCTION | Set Active Category Button
            // Marks the specified category button as active
            // ------------------------------------------------------------
            function setActiveCategoryButton(buttonId) {
                // Remove active from all category buttons
                var categoryButtons = document.querySelectorAll('.category-button');
                categoryButtons.forEach(function(btn) {
                    btn.classList.remove('active');
                });

                // Add active to selected button
                var activeBtn = document.getElementById(buttonId);
                if (activeBtn) {
                    activeBtn.classList.add('active');
                    activeCategoryButton = activeBtn;
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Clear Active Category Button
            // Removes active state from all category buttons
            // ------------------------------------------------------------
            function clearActiveCategoryButton() {
                var categoryButtons = document.querySelectorAll('.category-button');
                categoryButtons.forEach(function(btn) {
                    btn.classList.remove('active');
                });
                activeCategoryButton = null;
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
                Na__Menu__ShowDesignAccessStatement        : Na__Menu__ShowDesignAccessStatement,
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
