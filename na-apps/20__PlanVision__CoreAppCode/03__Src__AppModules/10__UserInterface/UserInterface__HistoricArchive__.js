// =============================================================================
// NOBLE ARCHITECTURE - HISTORIC ARCHIVE SYSTEM
// =============================================================================
//
// FILE       : UserInterface__HistoricArchive__.js
// NAMESPACE  : NaPlanVision.UserInterface.HistoricArchive
// MODULE     : HistoricArchive
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Historic archive warning modal and filtering
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Displays warning modal before allowing access to historic documents
// - Manages historic archive filtering within document categories
// - Coordinates with DrawingButtons to show/hide historic documents
// - Remembers which category to show after modal dismissal
// - Uses folder-grouped data from DrawingsDataManager for historic phases
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Implements safety warnings for historic document access
//
// 09-Feb-2026 - Version 2.0.0
// - Updated for folder-structure-driven data flow
// - Uses GetHistoricFolderGroups from DrawingsDataManager
// - Passes grouped data to DrawingButtons.CreateGroupedDocumentButtons
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Historic Archive System
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Archive State Variables
        // --------------------------------------------------------

            let isViewingHistoricArchive       = false;                       // <-- Tracks if viewing historic docs
            let pendingHistoricCategory        = null;                        // <-- Stores category for after dismissal

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Historic Archive System
            // ------------------------------------------------------------
            const Na__Archive__Initialize = function () {
                console.log('[HistoricArchive] Initializing...');

                // Initialize modal event listeners
                initHistoricWarningModal();

                console.log('[HistoricArchive] Initialized successfully');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Initialize Historic Warning Modal Event Listeners
            // ------------------------------------------------------------
            function initHistoricWarningModal() {
                var dismissBtn = document.getElementById('historic-warning-dismiss');
                var overlay    = document.getElementById('historic-warning-overlay');

                if (dismissBtn) {
                    dismissBtn.addEventListener('click', dismissHistoricWarningAndShowArchive);
                }

                // Close modal if clicking outside the content (optional)
                if (overlay) {
                    overlay.addEventListener('click', function (e) {
                        if (e.target === overlay) {
                            overlay.style.display = 'none';
                            console.log('[HistoricArchive] Historic warning modal closed without action');
                        }
                    });
                }

                console.log('[HistoricArchive] Modal event listeners initialized');
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // MODAL MANAGEMENT | Show/Hide Warning
        // --------------------------------------------------------

            // FUNCTION | Show Historic Archive Warning Modal
            // Displays full-screen warning before allowing access to old docs
            // ------------------------------------------------------------
            const Na__Archive__ShowHistoricWarningModal = function () {
                var overlay = document.getElementById('historic-warning-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    console.log('[HistoricArchive] Historic archive warning modal displayed');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Show Historic Warning Modal for Category
            // Shows warning before accessing historic documents
            // Remembers which category to show after dismissal
            // ------------------------------------------------------------
            const Na__Archive__ShowHistoricWarningModalForCategory = function (documentType) {
                // Store the document type for after dismissal
                pendingHistoricCategory = documentType;

                var overlay = document.getElementById('historic-warning-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    console.log('[HistoricArchive] Historic warning modal displayed for', documentType);
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide Historic Warning Modal and Switch to Historic View
            // Uses folder-grouped data from DrawingsDataManager for historic phases
            // ------------------------------------------------------------
            function dismissHistoricWarningAndShowArchive() {
                var overlay = document.getElementById('historic-warning-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }

                // Get module references
                var menuSystem     = window.NaPlanVision
                    && window.NaPlanVision.UserInterface
                    && window.NaPlanVision.UserInterface.MenuSystem;
                var drawingButtons = window.NaPlanVision
                    && window.NaPlanVision.UserInterface
                    && window.NaPlanVision.UserInterface.DrawingButtons;
                var dataManager    = window.NaPlanVision
                    && window.NaPlanVision.DrawingsDataManager;

                if (!menuSystem || !drawingButtons || !dataManager) {
                    console.error('[HistoricArchive] Required modules not available');
                    return;
                }

                // Determine which document type to show
                var currentFilter = menuSystem.Na__Menu__GetCurrentDocumentTypeFilter();
                var documentType  = pendingHistoricCategory || currentFilter || 'Drawing';

                // Get historic folder groups (from all phases except current)
                var historicGroups = dataManager.Na__Data__GetHistoricFolderGroups(documentType);

                // Ensure sub-menu is visible for historic view
                var mainMenuSection = document.getElementById('main-menu-section');
                var subMenuSection  = document.getElementById('sub-menu-section');

                if (mainMenuSection) {
                    mainMenuSection.classList.add('hidden');
                }
                if (subMenuSection) {
                    subMenuSection.classList.add('visible');
                }

                // Create grouped buttons showing historic documents
                isViewingHistoricArchive = true;
                drawingButtons.Na__Buttons__CreateGroupedDocumentButtons(
                    historicGroups,
                    documentType,
                    true
                );

                console.log('[HistoricArchive] Switched to historic archive for', documentType,
                    '(' + historicGroups.length + ' groups)');

                // Reset pending category
                pendingHistoricCategory = null;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ACCESSORS | State Getters
        // --------------------------------------------------------

            // FUNCTION | Is Viewing Historic Archive
            // ------------------------------------------------------------
            const Na__Archive__IsViewingHistoricArchive = function () {
                return isViewingHistoricArchive;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Set Historic Archive Viewing State
            // ------------------------------------------------------------
            const Na__Archive__SetHistoricArchiveState = function (state) {
                isViewingHistoricArchive = state;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.HistoricArchive = {
                Na__Archive__Initialize                           : Na__Archive__Initialize,
                Na__Archive__ShowHistoricWarningModal             : Na__Archive__ShowHistoricWarningModal,
                Na__Archive__ShowHistoricWarningModalForCategory  : Na__Archive__ShowHistoricWarningModalForCategory,
                Na__Archive__IsViewingHistoricArchive             : Na__Archive__IsViewingHistoricArchive,
                Na__Archive__SetHistoricArchiveState              : Na__Archive__SetHistoricArchiveState
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('HistoricArchive');
            }

            console.log('[HistoricArchive] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
