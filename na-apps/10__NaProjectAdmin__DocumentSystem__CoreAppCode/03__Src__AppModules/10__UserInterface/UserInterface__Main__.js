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
// - Manages view switching between quotation, terms, signatures
// - Handles document loading and display
//
// -----
//
// DEVELOPMENT LOG:
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
        let loadedQuotation          = null;                         // <-- Cached quotation data
        let loadedSpecialTerms       = null;                         // <-- Cached special terms

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
                    // Render quotation
                    if (window.NaProjectAdmin.QuotationRenderer) {
                        const html = window.NaProjectAdmin.QuotationRenderer.render(quotationData);
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

        // FUNCTION | Show Terms
        // ------------------------------------------------------------
        async function showTerms() {
            console.log('[UserInterfaceMain] Showing terms...');

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

        // FUNCTION | Load Special Terms
        // ------------------------------------------------------------
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

        // FUNCTION | Load General Terms
        // ------------------------------------------------------------
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

        // FUNCTION | Render Basic Terms (Fallback)
        // ------------------------------------------------------------
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

        // FUNCTION | Show Signature Status
        // ------------------------------------------------------------
        async function showSignatureStatus() {
            console.log('[UserInterfaceMain] Showing signature status...');

            const documentContainer = document.getElementById('document-container');
            if (!documentContainer) return;

            const projectCode = window.NaProjectAdmin.App?.getCurrentProject();

            // Check signature status
            const quotationSigned = sessionStorage.getItem(`naProjectAdmin_sig_quotation_${projectCode}`);
            const termsSigned = sessionStorage.getItem(`naProjectAdmin_sig_terms_${projectCode}`);

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
            html += `
                <div class="signature-record">
                    <div class="signature-record__header">
                        ${quotationSigned 
                            ? '<span style="color: var(--App_StatusSuccess);">&#10004;</span> Quotation Signed'
                            : '<span style="color: var(--App_StatusError);">&#10060;</span> Quotation Not Signed'
                        }
                    </div>
            `;

            if (quotationSigned) {
                const sigData = JSON.parse(quotationSigned);
                html += `
                    <div class="signature-record__details">
                        <span class="signature-record__label">Signed by:</span>
                        <span class="signature-record__value">${sigData.signerName}</span>
                        <span class="signature-record__label">Date:</span>
                        <span class="signature-record__value">${sigData.signedDate}</span>
                    </div>
                `;
            } else {
                html += `
                    <p style="color: var(--App_TextMuted); margin-top: 0.5rem;">
                        Please review and sign the quotation to proceed.
                    </p>
                `;
            }

            html += '</div>';

            // Terms status
            html += `
                <div class="signature-record">
                    <div class="signature-record__header">
                        ${termsSigned 
                            ? '<span style="color: var(--App_StatusSuccess);">&#10004;</span> Terms & Conditions Signed'
                            : '<span style="color: var(--App_StatusError);">&#10060;</span> Terms & Conditions Not Signed'
                        }
                    </div>
            `;

            if (termsSigned) {
                const sigData = JSON.parse(termsSigned);
                html += `
                    <div class="signature-record__details">
                        <span class="signature-record__label">Signed by:</span>
                        <span class="signature-record__value">${sigData.signerName}</span>
                        <span class="signature-record__label">Date:</span>
                        <span class="signature-record__value">${sigData.signedDate}</span>
                    </div>
                `;
            } else {
                html += `
                    <p style="color: var(--App_TextMuted); margin-top: 0.5rem;">
                        Please review and sign the terms & conditions to proceed.
                    </p>
                `;
            }

            html += `
                        </div>
                    </div>
                </div>
            </div>
            `;

            documentContainer.innerHTML = html;
            currentView = 'signatures';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Current View
        // ------------------------------------------------------------
        function getCurrentView() {
            return currentView;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Loaded Data
        // ------------------------------------------------------------
        function getLoadedQuotation() {
            return loadedQuotation;
        }

        function getLoadedSpecialTerms() {
            return loadedSpecialTerms;
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.UserInterfaceMain = {
            initialise               : initialise,
            initialize               : initialise,
            loadDefaultView          : loadDefaultView,
            showQuotation            : showQuotation,
            showTerms                : showTerms,
            showSignatureStatus      : showSignatureStatus,
            getCurrentView           : getCurrentView,
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

