// =============================================================================
// NOBLE ARCHITECTURE - DRAWING BUTTONS UI
// =============================================================================
//
// FILE       : UserInterface__DrawingButtons__.js
// NAMESPACE  : NaPlanVision.UserInterface.DrawingButtons
// MODULE     : DrawingButtons
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dynamic button creation for document selection
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Creates dynamic grouped buttons for each drawing/document in the toolbar
// - Renders folder section headers with nested subfolder hierarchy
// - Filters documents by document-type (Drawing vs Specification)
// - Supports historic archive mode within each category
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from main HTML file
// - Supports both legacy (all documents) and filtered (by category) modes
//
// 09-Feb-2026 - Version 2.0.0
// - Rewritten for folder-structure-driven grouped display
// - Renders section headers per folder and sub-headers for subfolders
// - Accepts folder-grouped data from DrawingsDataManager
// - Handles unlimited nesting depth with visual hierarchy
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Drawing Buttons UI
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Component State
        // --------------------------------------------------------

            let loadDrawingCallback            = null;                        // <-- Callback for loading drawings

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Drawing Buttons System
            // ------------------------------------------------------------
            const Na__Buttons__Initialize = function (callbacks) {
                console.log('[DrawingButtons] Initializing...');

                // Store callback for loading drawings
                if (callbacks && callbacks.loadDrawing) {
                    loadDrawingCallback = callbacks.loadDrawing;
                } else {
                    console.error('[DrawingButtons] loadDrawing callback is required');
                }

                console.log('[DrawingButtons] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // BUTTON CREATION | Grouped Document Button Rendering
        // --------------------------------------------------------

            // FUNCTION | Create Grouped Document Buttons
            // Creates buttons organized by folder groups with section headers
            // Supports nested subfolders with visual hierarchy
            // ------------------------------------------------------------
            const Na__Buttons__CreateGroupedDocumentButtons = function (
                folderGroups,
                documentType,
                showHistoric
            ) {
                const documentSelectionArea = document.getElementById('document-selection-area');

                if (!documentSelectionArea) {
                    console.error('[DrawingButtons] Document selection area not found');
                    return;
                }

                // Clear existing content
                documentSelectionArea.innerHTML = '';

                // Create header
                const header = document.createElement('div');
                header.className = 'menu_-_drawing-button-header-text';
                if (showHistoric) {
                    header.textContent = 'Historic Archive';
                } else {
                    header.textContent = documentType === 'Drawing'
                        ? 'Select Drawing'
                        : 'Select Specification';
                }
                documentSelectionArea.appendChild(header);

                // Add historic mode warning banner if viewing historic archive
                if (showHistoric) {
                    var banner = document.createElement('div');
                    banner.className = 'historic-mode-banner';
                    banner.textContent = '\u26A0 HISTORIC DOCUMENTS - DO NOT USE \u26A0';
                    documentSelectionArea.appendChild(banner);
                }

                // Create the main button container
                var buttonContainer = document.createElement('div');
                buttonContainer.className = documentType === 'Drawing'
                    ? 'drawing-button-container'
                    : 'specification-button-container';
                documentSelectionArea.appendChild(buttonContainer);

                // Render folder groups with section headers
                var buttonCount = 0;

                if (folderGroups && folderGroups.length > 0) {
                    for (var g = 0; g < folderGroups.length; g++) {
                        var group = folderGroups[g];
                        var depth = group['depth'] || 0;

                        // Create folder group wrapper
                        var groupWrapper = document.createElement('div');
                        groupWrapper.className = depth > 0
                            ? 'subfolder-group'
                            : 'folder-group';

                        // Create section header
                        var groupHeader = document.createElement('div');
                        groupHeader.className = depth > 0
                            ? 'subfolder-group-header'
                            : 'folder-group-header';
                        groupHeader.textContent = group['label'] || 'Documents';
                        groupWrapper.appendChild(groupHeader);

                        // Create buttons for each drawing in this group
                        var drawings = group['drawings'] || [];
                        for (var d = 0; d < drawings.length; d++) {
                            var drawingObj = drawings[d];

                            var button = document.createElement('button');
                            button.className = 'tool-button';
                            button.textContent = drawingObj['document-name'] || drawingObj['file-name'];

                            // Attach click handler (use closure to capture drawingObj)
                            (function (doc) {
                                button.addEventListener('click', function () {
                                    if (loadDrawingCallback) {
                                        loadDrawingCallback(doc);
                                    }
                                });
                            })(drawingObj);

                            groupWrapper.appendChild(button);
                            buttonCount++;
                        }

                        buttonContainer.appendChild(groupWrapper);
                    }
                }

                // Add no-results message if no buttons were created
                if (buttonCount === 0) {
                    var noResults = document.createElement('div');
                    noResults.className = 'no-documents-message';
                    noResults.textContent = showHistoric
                        ? 'No historic documents available.'
                        : 'No documents available for this category.';
                    buttonContainer.appendChild(noResults);
                }

                // Add Historic Archive / Return to Current button
                var navButton = document.createElement('button');
                if (showHistoric) {
                    navButton.className = 'tool-button return-current-btn';
                    navButton.textContent = 'Return to Current '
                        + (documentType === 'Drawing' ? 'Drawings' : 'Specifications');
                    navButton.addEventListener('click', function () {
                        // Get current-phase folder groups from data manager
                        var dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                        if (dataManager) {
                            var currentGroups = dataManager.Na__Data__GetFolderGroups(documentType);
                            Na__Buttons__CreateGroupedDocumentButtons(
                                currentGroups,
                                documentType,
                                false
                            );
                        }
                    });
                } else {
                    navButton.className = 'tool-button historic-archive-btn';
                    navButton.textContent = 'View Historic Archive';
                    navButton.addEventListener('click', function () {
                        var historicArchive = window.NaPlanVision
                            && window.NaPlanVision.UserInterface
                            && window.NaPlanVision.UserInterface.HistoricArchive;
                        if (historicArchive) {
                            historicArchive.Na__Archive__ShowHistoricWarningModalForCategory(documentType);
                        }
                    });
                }
                buttonContainer.appendChild(navButton);

                console.log('[DrawingButtons] Created', buttonCount, 'buttons in',
                    (folderGroups ? folderGroups.length : 0), 'folder groups for', documentType);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Create Filtered Document Buttons (Legacy Compatibility)
            // Falls back to grouped display using data manager
            // ------------------------------------------------------------
            const Na__Buttons__CreateFilteredDocumentButtons = function (
                documents,
                documentType,
                showHistoric,
                currentDesignPhase
            ) {
                // Redirect to the new grouped display
                var dataManager = window.NaPlanVision && window.NaPlanVision.DrawingsDataManager;
                if (dataManager) {
                    var groups;
                    if (showHistoric) {
                        groups = dataManager.Na__Data__GetHistoricFolderGroups(documentType);
                    } else {
                        groups = dataManager.Na__Data__GetFolderGroups(documentType, currentDesignPhase);
                    }
                    Na__Buttons__CreateGroupedDocumentButtons(groups, documentType, showHistoric);
                } else {
                    console.error('[DrawingButtons] DrawingsDataManager not available for legacy fallback');
                }
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.DrawingButtons = {
                Na__Buttons__Initialize                       : Na__Buttons__Initialize,
                Na__Buttons__CreateGroupedDocumentButtons     : Na__Buttons__CreateGroupedDocumentButtons,
                Na__Buttons__CreateFilteredDocumentButtons    : Na__Buttons__CreateFilteredDocumentButtons
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DrawingButtons');
            }

            console.log('[DrawingButtons] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
