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
// - Creates dynamic buttons for each drawing/document in the toolbar
// - Filters documents by design phase (current vs historic)
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
            const Na__Initialize = function (callbacks) {
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
        // BUTTON CREATION | Document Button Rendering
        // --------------------------------------------------------

            // FUNCTION | Create Filtered Document Buttons
            // Creates buttons for documents matching the specified type
            // Supports historic archive mode within each category
            // ------------------------------------------------------------
            const Na__CreateFilteredDocumentButtons = function (
                documents,
                documentType,
                showHistoric,
                currentDesignPhase
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
                    header.textContent = documentType === 'Drawing' ? 'Select Drawing' : 'Select Specification';
                }
                documentSelectionArea.appendChild(header);

                // Add historic mode warning banner if viewing historic archive
                if (showHistoric) {
                    const banner = document.createElement('div');
                    banner.className = 'historic-mode-banner';
                    banner.textContent = '⚠ HISTORIC DOCUMENTS - DO NOT USE ⚠';
                    documentSelectionArea.appendChild(banner);
                }

                // Create button container
                const buttonContainer = document.createElement('div');
                buttonContainer.className = documentType === 'Drawing'
                    ? 'drawing-button-container'
                    : 'specification-button-container';
                documentSelectionArea.appendChild(buttonContainer);

                // Filter and create buttons for matching documents
                const targetPhase = showHistoric ? null : currentDesignPhase;
                let buttonCount = 0;

                for (const key in documents) {
                    if (key.startsWith('drawing-') &&
                        documents[key]['file-name'] !== '{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}') {

                        const doc = documents[key];
                        const docType = doc['document-type'] || 'Drawing';
                        const docPhase = doc['design-phase'] || 'DesignPhase02';

                        // Filter by document type
                        if (docType !== documentType) continue;

                        // Filter by design phase (current or historic)
                        const shouldShow = showHistoric
                            ? (docPhase !== currentDesignPhase)
                            : (docPhase === currentDesignPhase);

                        if (shouldShow) {
                            const button = document.createElement('button');
                            button.className = 'tool-button';
                            button.textContent = doc['document-name'];
                            button.addEventListener('click', () => {
                                if (loadDrawingCallback) {
                                    loadDrawingCallback(doc);
                                }
                            });
                            buttonContainer.appendChild(button);
                            buttonCount++;
                        }
                    }
                }

                // Add Historic Archive / Return to Current button
                const navButton = document.createElement('button');
                if (showHistoric) {
                    navButton.className = 'tool-button return-current-btn';
                    navButton.textContent = 'Return to Current ' + (documentType === 'Drawing' ? 'Drawings' : 'Specifications');
                    navButton.addEventListener('click', () => {
                        Na__CreateFilteredDocumentButtons(documents, documentType, false, currentDesignPhase);
                    });
                } else {
                    navButton.className = 'tool-button historic-archive-btn';
                    navButton.textContent = 'View Historic Archive';
                    navButton.addEventListener('click', () => {
                        const historicArchive = window.NaPlanVision?.UserInterface?.HistoricArchive;
                        if (historicArchive) {
                            historicArchive.Na__ShowHistoricWarningModalForCategory(documentType);
                        }
                    });
                }
                buttonContainer.appendChild(navButton);

                console.log('[DrawingButtons] Created', buttonCount, 'buttons for', documentType, 'documents');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UserInterface = window.NaPlanVision.UserInterface || {};
            window.NaPlanVision.UserInterface.DrawingButtons = {
                Na__Initialize                       : Na__Initialize,
                Na__CreateFilteredDocumentButtons    : Na__CreateFilteredDocumentButtons
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('DrawingButtons');
            }

            console.log('[DrawingButtons] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
