// =============================================================================
// NOBLE ARCHITECTURE - USER INTERFACE MAIN
// =============================================================================
//
// FILE       : UserInterface__Main__.js
// NAMESPACE  : NaProjectAdmin.UserInterfaceMain
// MODULE     : UserInterfaceMain
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Main UI coordinator for loading and displaying content
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Coordinates content rendering in the main content area
// - Manages view switching between quotation, contracts, signatures
// - Handles document loading and display
// - Multi-contract system support
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 2.0.0
// - Multi-Contract System
//   - Added showContract() for individual contract display
//   - Contract state tracking per contract ID
//   - Integration with ContractLoader and TermsRenderer
//   - Updated signature status to show per-contract status
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - View switching
//   - Content loading coordination
//
// =============================================================================

// #region -----
// MODULE | User Interface Main
// -----

    (function() {
        'use strict';

        // STATE | UI Variables
        // ------------------------------------------------------------
        let currentView              = null;                         // <-- Currently displayed view
        let currentContractId        = null;                         // <-- Currently displayed contract
        let loadedQuotation          = null;                         // <-- Cached quotation data
        let loadedSpecialTerms       = null;                         // <-- Cached special terms
        let loadedContracts          = new Map();                    // <-- Cached contract data

        // FUNCTION | Initialise UI
        // ------------------------------------------------------------
        function initialise() {
            console.log('[UserInterfaceMain] Initialising...');
            console.log('[UserInterfaceMain] Initialised');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Default View
        // ------------------------------------------------------------
        async function loadDefaultView() {
            // Show quotation first if available
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            
            if (config?.AppConfig?.Features?.QuotationSystem?.enabled === true) {
                await showQuotation();
            } else if (config?.AppConfig?.Features?.TermsSystem?.enabled === true) {
                // Show first enabled contract
                const projectConfig = window.NaProjectAdmin.App?.getProjectConfig();
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                
                if (contractLoader && projectConfig?.contracts) {
                    const enabledContracts = contractLoader.getEnabledContracts(projectConfig);
                    if (enabledContracts.length > 0) {
                        await showContract(enabledContracts[0]);
                        return;
                    }
                }
                
                // Fallback to legacy terms
                await showTerms();
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Quotation
        // ------------------------------------------------------------
        async function showQuotation() {
            console.log('[UserInterfaceMain] Showing quotation...');

            const documentContainer = document.getElementById('document-container');
            if (!documentContainer) return;

            // Show loading state
            documentContainer.innerHTML = `
                <div class="document" style="text-align: center; padding: 3rem;">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">Loading quotation...</p>
                </div>
            `;

            try {
                // Load quotation data
                const quotationData = await loadQuotationData();

                if (quotationData) {
                    // Render quotation (async to fetch client data from Cloudflare)
                    if (window.NaProjectAdmin.QuotationRenderer) {
                        const html = await window.NaProjectAdmin.QuotationRenderer.renderAsync(quotationData);
                        documentContainer.innerHTML = html;
                    } else {
                        documentContainer.innerHTML = renderBasicQuotation(quotationData);
                    }

                    loadedQuotation = quotationData;
                } else {
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2>No Quotation Available</h2>
                            <p style="color: var(--App_TextSecondary);">
                                A quotation has not been created for this project yet.
                            </p>
                        </div>
                    `;
                }

                currentView = 'quotation';
                currentContractId = null;

            } catch (error) {
                console.error('[UserInterfaceMain] Failed to load quotation:', error);
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <h2 style="color: var(--App_StatusError);">Error Loading Quotation</h2>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Quotation Data
        // ------------------------------------------------------------
        async function loadQuotationData() {
            const projectPath = window.NaProjectAdmin.currentProjectPath;
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const quotationFile = config?.AppConfig?.ProjectLoading?.quotationFile || 'ProjectAdmin__Quotation__.json';

            if (!projectPath) {
                console.warn('[UserInterfaceMain] No project path available');
                return null;
            }

            try {
                const response = await fetch(`${projectPath}${quotationFile}`);
                
                if (!response.ok) {
                    return null;
                }

                return await response.json();

            } catch (error) {
                console.warn('[UserInterfaceMain] Quotation file not found');
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Basic Quotation (Fallback)
        // ------------------------------------------------------------
        function renderBasicQuotation(data) {
            return `
                <div class="document">
                    <div class="document__header">
                        <h1 class="document__title">Quotation</h1>
                        <p class="document__ref">Ref: ${data.quotationRef || 'N/A'}</p>
                    </div>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // #region -----
        // MULTI-CONTRACT SYSTEM | Show Individual Contracts
        // -----

            /**
             * Show a specific contract by ID
             * @param {string} contractId - Contract identifier
             */
            async function showContract(contractId) {
                console.log(`[UserInterfaceMain] Showing contract: ${contractId}`);

                const documentContainer = document.getElementById('document-container');
                if (!documentContainer) return;

                // Get contract definition
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                if (!contractLoader) {
                    console.error('[UserInterfaceMain] ContractLoader not available');
                    // Fall back to legacy terms
                    await showTerms();
                    return;
                }

                const contractDef = contractLoader.getContractDefinition(contractId);
                if (!contractDef) {
                    console.error(`[UserInterfaceMain] Unknown contract: ${contractId}`);
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2 style="color: var(--App_StatusError);">Contract Not Found</h2>
                            <p>The requested contract "${contractId}" could not be found.</p>
                        </div>
                    `;
                    return;
                }

                // Show loading state
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading ${contractDef.name}...</p>
                    </div>
                `;

                try {
                    // Render contract using TermsRenderer
                    const termsRenderer = window.NaProjectAdmin.TermsRenderer;
                    if (termsRenderer && termsRenderer.renderContract) {
                        const html = await termsRenderer.renderContract(contractId);
                        documentContainer.innerHTML = html;
                    } else {
                        // Fallback: render basic contract
                        const html = await renderBasicContract(contractId, contractDef);
                        documentContainer.innerHTML = html;
                    }

                    // Cache and update state
                    loadedContracts.set(contractId, { contractDef, timestamp: Date.now() });
                    currentView = 'contract';
                    currentContractId = contractId;

                } catch (error) {
                    console.error(`[UserInterfaceMain] Failed to load contract ${contractId}:`, error);
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2 style="color: var(--App_StatusError);">Error Loading Contract</h2>
                            <p>${error.message}</p>
                        </div>
                    `;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Render basic contract (fallback when TermsRenderer not available)
             * @param {string} contractId - Contract identifier
             * @param {Object} contractDef - Contract definition
             * @returns {Promise<string>} HTML content
             */
            async function renderBasicContract(contractId, contractDef) {
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                const contractHtml = await contractLoader.loadContractHtml(contractId);

                return `
                    <div class="document terms-document">
                        <div class="document__header">
                            <h1 class="document__title">${contractDef.name}</h1>
                            <p class="document__ref">Terms & Conditions</p>
                        </div>
                        <div class="terms-section">
                            ${contractHtml || '<p>Contract content not available.</p>'}
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // LEGACY TERMS | Backwards Compatibility
        // -----

            /**
             * Show Terms (Legacy - for backwards compatibility)
             */
            async function showTerms() {
                console.log('[UserInterfaceMain] Showing terms (legacy)...');

                const documentContainer = document.getElementById('document-container');
                if (!documentContainer) return;

                // Show loading state
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading terms & conditions...</p>
                    </div>
                `;

                try {
                    // Load special terms and general terms
                    const specialTerms = await loadSpecialTerms();
                    const generalTermsHtml = await loadGeneralTerms();

                    // Render terms
                    if (window.NaProjectAdmin.TermsRenderer) {
                        const html = window.NaProjectAdmin.TermsRenderer.render(specialTerms, generalTermsHtml);
                        documentContainer.innerHTML = html;
                    } else {
                        documentContainer.innerHTML = renderBasicTerms(specialTerms, generalTermsHtml);
                    }

                    loadedSpecialTerms = specialTerms;
                    currentView = 'terms';
                    currentContractId = null;

                } catch (error) {
                    console.error('[UserInterfaceMain] Failed to load terms:', error);
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2 style="color: var(--App_StatusError);">Error Loading Terms</h2>
                            <p>${error.message}</p>
                        </div>
                    `;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Load Special Terms (Legacy)
             */
            async function loadSpecialTerms() {
                const projectPath = window.NaProjectAdmin.currentProjectPath;
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const specialTermsFile = config?.AppConfig?.ProjectLoading?.specialTermsFile || 'ProjectAdmin__SpecialTerms__.json';

                if (!projectPath) {
                    return null;
                }

                try {
                    const response = await fetch(`${projectPath}${specialTermsFile}`);
                    
                    if (!response.ok) {
                        return null;
                    }

                    return await response.json();

                } catch (error) {
                    console.warn('[UserInterfaceMain] Special terms file not found');
                    return null;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Load General Terms (Legacy)
             */
            async function loadGeneralTerms() {
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const generalTermsFile = config?.AppConfig?.Features?.TermsSystem?.generalTermsFile || 'DocumentSystem__GeneralTerms__.html';
                const basePath = '03__Src__AppModules/20__DocumentSystem/';

                try {
                    const response = await fetch(`${basePath}${generalTermsFile}`);
                    
                    if (!response.ok) {
                        throw new Error('General terms not found');
                    }

                    return await response.text();

                } catch (error) {
                    console.warn('[UserInterfaceMain] General terms file not found');
                    return '<p>General terms and conditions not available.</p>';
                }
            }
            // ---------------------------------------------------------------

            /**
             * Render Basic Terms (Fallback)
             */
            function renderBasicTerms(specialTerms, generalTermsHtml) {
                let html = '<div class="document terms-document">';

                // Special terms section
                if (specialTerms && specialTerms.terms && specialTerms.terms.length > 0) {
                    html += `
                        <div class="terms-section terms-section--special">
                            <h2 class="terms-section__title">Special Terms for This Project</h2>
                    `;
                    
                    specialTerms.terms.forEach(term => {
                        html += `
                            <div class="terms-item">
                                <div class="terms-item__title">${term.title || ''}</div>
                                <div class="terms-item__content">${term.content || ''}</div>
                            </div>
                        `;
                    });

                    html += '</div>';
                }

                // General terms section
                html += `
                    <div class="terms-section">
                        <h2 class="terms-section__title">General Terms & Conditions</h2>
                        ${generalTermsHtml}
                    </div>
                `;

                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // SIGNATURE STATUS | Multi-Contract Support
        // -----

            /**
             * Show Signature Status (Multi-Contract)
             */
            async function showSignatureStatus() {
                console.log('[UserInterfaceMain] Showing signature status...');

                const documentContainer = document.getElementById('document-container');
                if (!documentContainer) return;

                const projectCode = window.NaProjectAdmin.App?.getCurrentProject();
                const projectConfig = window.NaProjectAdmin.App?.getProjectConfig();
                const contractLoader = window.NaProjectAdmin.ContractLoader;

                // Check quotation signature
                const quotationSigned = sessionStorage.getItem(`naProjectAdmin_sig_quotation_${projectCode}`);

                let html = `
                    <div class="document">
                        <div class="document__header">
                            <h1 class="document__title">Signature Status</h1>
                            <p class="document__ref">Project: ${projectCode}</p>
                        </div>

                        <div class="document__section">
                            <h2 class="document__section-title">Document Signatures</h2>
                            
                            <div style="display: grid; gap: 1rem;">
                `;

                // Quotation status
                html += renderSignatureCard('Quotation', quotationSigned);

                // Contract signatures (multi-contract system)
                if (contractLoader && projectConfig?.contracts) {
                    const enabledContracts = contractLoader.getEnabledContracts(projectConfig);

                    for (const contractId of enabledContracts) {
                        const contractDef = contractLoader.getContractDefinition(contractId);
                        const signatureKey = `naProjectAdmin_sig_contract_${projectCode}_${contractId}`;
                        const signatureRecord = sessionStorage.getItem(signatureKey);
                        const isSigned = signatureRecord !== null || 
                                        contractLoader.isContractSigned(projectConfig, contractId);

                        html += renderSignatureCard(
                            contractDef?.name || contractId,
                            isSigned ? signatureRecord || JSON.stringify({ signed: true }) : null
                        );
                    }
                } else {
                    // Legacy: single terms signature
                    const termsSigned = sessionStorage.getItem(`naProjectAdmin_sig_terms_${projectCode}`);
                    html += renderSignatureCard('Terms & Conditions', termsSigned);
                }

                html += `
                            </div>
                        </div>
                    </div>
                `;

                documentContainer.innerHTML = html;
                currentView = 'signatures';
                currentContractId = null;
            }
            // ---------------------------------------------------------------

            /**
             * Render signature status card
             * @param {string} title - Document title
             * @param {string|null} signatureRecord - Signature record JSON or null
             * @returns {string} HTML for signature card
             */
            function renderSignatureCard(title, signatureRecord) {
                let html = `
                    <div class="signature-record">
                        <div class="signature-record__header">
                            ${signatureRecord 
                                ? `<span style="color: var(--App_StatusSuccess);">&#10004;</span> ${title} Signed`
                                : `<span style="color: var(--App_StatusError);">&#10060;</span> ${title} Not Signed`
                            }
                        </div>
                `;

                if (signatureRecord) {
                    try {
                        const sigData = JSON.parse(signatureRecord);
                        if (sigData.signerName) {
                            html += `
                                <div class="signature-record__details">
                                    <span class="signature-record__label">Signed by:</span>
                                    <span class="signature-record__value">${sigData.signerName}</span>
                                    <span class="signature-record__label">Date:</span>
                                    <span class="signature-record__value">${sigData.signedDate || 'Recorded'}</span>
                                </div>
                            `;
                        }
                    } catch (e) {
                        // Simple signed status without details
                    }
                } else {
                    html += `
                        <p style="color: var(--App_TextMuted); margin-top: 0.5rem;">
                            Please review and sign this document to proceed.
                        </p>
                    `;
                }

                html += '</div>';
                return html;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // API | State Accessors
        // -----

            /**
             * Get Current View
             */
            function getCurrentView() {
                return currentView;
            }

            /**
             * Get Current Contract ID
             */
            function getCurrentContractId() {
                return currentContractId;
            }

            /**
             * Get Loaded Quotation
             */
            function getLoadedQuotation() {
                return loadedQuotation;
            }

            /**
             * Get Loaded Special Terms
             */
            function getLoadedSpecialTerms() {
                return loadedSpecialTerms;
            }

        // endregion -----

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.UserInterfaceMain = {
            initialise               : initialise,
            initialize               : initialise,
            loadDefaultView          : loadDefaultView,
            showQuotation            : showQuotation,
            showTerms                : showTerms,
            showContract             : showContract,
            showSignatureStatus      : showSignatureStatus,
            getCurrentView           : getCurrentView,
            getCurrentContractId     : getCurrentContractId,
            getLoadedQuotation       : getLoadedQuotation,
            getLoadedSpecialTerms    : getLoadedSpecialTerms
        };

        // Auto-initialise when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialise);
        } else {
            initialise();
        }

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('UserInterfaceMain');
        }

    })();

// endregion -----
