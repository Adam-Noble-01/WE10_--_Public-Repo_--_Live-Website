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
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Implements safety warnings for historic document access
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
            const Na__Initialize = function () {
                console.log('[HistoricArchive] Initializing...');

                // Initialize modal event listeners
                initHistoricWarningModal();

                console.log('[HistoricArchive] Initialized successfully');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Initialize Historic Warning Modal Event Listeners
            // ------------------------------------------------------------
            function initHistoricWarningModal() {
                const dismissBtn = document.getElementById('historic-warning-dismiss');
                const overlay = document.getElementById('historic-warning-overlay');

                if (dismissBtn) {
                    dismissBtn.addEventListener('click', dismissHistoricWarningAndShowArchive);
                }

                // Close modal if clicking outside the content (optional)
                if (overlay) {
                    overlay.addEventListener('click', (e) => {
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
            const Na__ShowHistoricWarningModal = function () {
                const overlay = document.getElementById('historic-warning-overlay');
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
            const Na__ShowHistoricWarningModalForCategory = function (documentType) {
                // Store the document type for after dismissal
                pendingHistoricCategory = documentType;

                const overlay = document.getElementById('historic-warning-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    console.log('[HistoricArchive] Historic warning modal displayed for', documentType);
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide Historic Warning Modal and Switch to Historic View
            // ------------------------------------------------------------
            function dismissHistoricWarningAndShowArchive() {
                const overlay = document.getElementById('historic-warning-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }

                // Get menu system reference
                const menuSystem = window.NaPlanVision?.UserInterface?.MenuSystem;
                const drawingButtons = window.NaPlanVision?.UserInterface?.DrawingButtons;
                const drawingsDataManager = window.NaPlanVision?.DrawingsDataManager;

                if (!menuSystem || !drawingButtons || !drawingsDataManager) {
                    console.error('[HistoricArchive] Required modules not available');
                    return;
                }

                // Check if we're in a category sub-menu or main menu
                const currentView = menuSystem.Na__GetCurrentMenuView();
                const currentFilter = menuSystem.Na__GetCurrentDocumentTypeFilter();

                const documentType = pendingHistoricCategory || currentFilter;
                const allDocuments = drawingsDataManager.Na__GetAllDrawingsData();
                const currentPhase = drawingsDataManager.Na__GetCurrentDesignPhase();

                if (allDocuments && documentType) {
                    isViewingHistoricArchive = true;
                    drawingButtons.Na__CreateFilteredDocumentButtons(
                        allDocuments,
                        documentType,
                        true,
                        currentPhase
                    );
                    console.log('[HistoricArchive] Switched to historic archive for', documentType);
                }

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
            const Na__IsViewingHistoricArchive = function () {
                return isViewingHistoricArchive;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Set Historic Archive Viewing State
            // ------------------------------------------------------------
            const Na__SetHistoricArchiveState = function (state) {
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
                Na__Initialize                           : Na__Initialize,
                Na__ShowHistoricWarningModal             : Na__ShowHistoricWarningModal,
                Na__ShowHistoricWarningModalForCategory  : Na__ShowHistoricWarningModalForCategory,
                Na__IsViewingHistoricArchive             : Na__IsViewingHistoricArchive,
                Na__SetHistoricArchiveState              : Na__SetHistoricArchiveState
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('HistoricArchive');
            }

            console.log('[HistoricArchive] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
