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
// - Cover letter landing page (v0.6.0)
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 2.1.0
// - Cover Letter System (v0.6.0)
//   - Added showCoverLetter() for personalised welcome page
//   - Updated loadDefaultView() to show cover letter first when enabled
//   - Integration with CoverLetterRenderer module
//
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
        let loadedInvoices           = null;                         // <-- Cached invoice data
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
            const config    = window.NaProjectAdmin.ConfigManager?.getConfig();
            const urlParams = window.NaProjectAdmin.App?.getUrlParams();

            // Deep-link: if URL specifies view=invoice, go directly to invoice
            if (urlParams?.view === 'invoice' && config?.AppConfig?.Features?.InvoiceSystem?.enabled === true) {
                await showInvoice(urlParams.invoice || null);
                return;
            }

            // Show cover letter first if enabled (v0.6.0)
            if (config?.AppConfig?.Features?.CoverLetterSystem?.enabled === true &&
                config?.AppConfig?.Features?.CoverLetterSystem?.showAsDefaultView === true) {
                await showCoverLetter();
                return;
            }
            
            // Fallback: Show quotation first if available
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

        // #region -----
        // COVER LETTER SYSTEM | Welcome Landing Page (v0.6.0)
        // -----

            // FUNCTION | Show Cover Letter
            // ------------------------------------------------------------
            /**
             * Display the personalised cover letter landing page
             * Fetches client data from Cloudflare R2 and renders welcome message
             */
            async function showCoverLetter() {
                console.log('[UserInterfaceMain] Showing cover letter...');

                const documentContainer = document.getElementById('document-container');
                if (!documentContainer) return;

                // Show loading state
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading welcome letter...</p>
                    </div>
                `;

                try {
                    const projectConfig = window.NaProjectAdmin.App?.getProjectConfig();

                    // Load quotation data using same method as showQuotation()
                    let quotationData = loadedQuotation;
                    if (!quotationData) {
                        quotationData = await loadQuotationData();
                        if (quotationData) {
                            loadedQuotation = quotationData;  // Cache for later use
                        }
                    }

                    // Render cover letter with quotation data for date sync
                    if (window.NaProjectAdmin.CoverLetterRenderer) {
                        const html = await window.NaProjectAdmin.CoverLetterRenderer.renderAsync(projectConfig, quotationData);
                        documentContainer.innerHTML = html;
                    } else {
                        // Fallback: basic welcome message
                        documentContainer.innerHTML = renderBasicCoverLetter(projectConfig);
                    }

                    currentView = 'coverLetter';
                    currentContractId = null;

                } catch (error) {
                    console.error('[UserInterfaceMain] Failed to load cover letter:', error);
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2 style="color: var(--App_StatusError);">Error Loading Welcome Letter</h2>
                            <p>${error.message}</p>
                        </div>
                    `;
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Render Basic Cover Letter (Fallback)
            // ------------------------------------------------------------
            function renderBasicCoverLetter(projectConfig) {
                const projectName = projectConfig?.projectName || 'Your Project';
                
                return `
                    <div class="document cover-letter">
                        <h1>Welcome</h1>
                        <p>Thank you for enquiring about our architectural design services.</p>
                        <p><strong>Project:</strong> ${projectName}</p>
                        <p>Please use the navigation menu to view your quotation and review the terms and conditions.</p>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // FUNCTION | Show Quotation Picker (card-based selection screen)
        // ------------------------------------------------------------
        async function showQuotationPicker() {
            console.log('[UserInterfaceMain] Showing quotation picker...');

            const documentContainer = document.getElementById('document-container');
            if (!documentContainer) return;

            documentContainer.innerHTML = `
                <div class="document" style="text-align: center; padding: 3rem;">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">Loading quotations...</p>
                </div>
            `;

            try {
                const allQuotations = await loadAllQuotations();

                if (!allQuotations || allQuotations.length === 0) {
                    documentContainer.innerHTML = `
                        <div class="document" style="text-align: center; padding: 3rem;">
                            <h2>No Quotations Available</h2>
                            <p style="color: var(--App_TextSecondary);">
                                No quotations have been created for this project yet.
                            </p>
                        </div>
                    `;
                    return;
                }

                if (allQuotations.length === 1) {
                    await showQuotation(allQuotations[0].quotationRef);
                    return;
                }

                const formatNumber = window.NaProjectAdmin.QuotationRenderer?.formatNumber
                    || function(n) { return Number(n).toFixed(2); };

                const statusLabels = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' };

                const cardsHtml = allQuotations.map(q => {
                    const name    = q.quotationName || q.quotationRef;
                    const ref     = q.quotationRef || '';
                    const date    = q.quotationDate || '';
                    const total   = q.totals?.grandTotal ?? 0;
                    const status  = q.status || 'draft';
                    const label   = statusLabels[status] || status;

                    return `
                        <div class="na-quotation-picker__card" data-ref="${ref}" tabindex="0" role="button">
                            <div class="na-quotation-picker__card-header">
                                <span class="na-quotation-picker__card-name">${escapeHtml(name)}</span>
                                <span class="na-invoice-status__badge na-invoice-status__badge--${status === 'accepted' ? 'paid' : status === 'declined' ? 'overdue' : 'unpaid'}">${escapeHtml(label)}</span>
                            </div>
                            <div class="na-quotation-picker__card-meta">
                                <span>${escapeHtml(ref)}</span>
                                <span>&middot;</span>
                                <span>${escapeHtml(date)}</span>
                            </div>
                            <div class="na-quotation-picker__card-total">
                                &pound;${formatNumber(total)}
                            </div>
                        </div>
                    `;
                }).join('');

                documentContainer.innerHTML = `
                    <div class="na-quotation-picker">
                        <h2 class="na-quotation-picker__title">Select a Quotation</h2>
                        <div class="na-quotation-picker__cards">
                            ${cardsHtml}
                        </div>
                    </div>
                `;

                documentContainer.querySelectorAll('.na-quotation-picker__card').forEach(card => {
                    const handler = async () => {
                        await showQuotation(card.dataset.ref);
                    };
                    card.addEventListener('click', handler);
                    card.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
                    });
                });

                currentView = 'quotation-picker';
                currentContractId = null;

            } catch (error) {
                console.error('[UserInterfaceMain] Failed to load quotation picker:', error);
                documentContainer.innerHTML = `
                    <div class="document" style="text-align: center; padding: 3rem;">
                        <h2 style="color: var(--App_StatusError);">Error Loading Quotations</h2>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Quotation
        // ------------------------------------------------------------
        async function showQuotation(quotationRef) {
            console.log('[UserInterfaceMain] Showing quotation...');

            const documentContainer = document.getElementById('document-container');
            if (!documentContainer) return;

            documentContainer.innerHTML = `
                <div class="document" style="text-align: center; padding: 3rem;">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">Loading quotation...</p>
                </div>
            `;

            try {
                const allQuotations = await loadAllQuotations();

                if (allQuotations && allQuotations.length > 0) {
                    let quotationData = quotationRef
                        ? allQuotations.find(q => q.quotationRef === quotationRef) || allQuotations[0]
                        : allQuotations[0];

                    let backLinkHtml = '';
                    if (allQuotations.length > 1) {
                        backLinkHtml = `
                            <div class="na-quotation-back-link">
                                <a href="#" id="back-to-quotations">&larr; All Quotations</a>
                            </div>
                        `;
                    }

                    let renderedHtml = '';
                    if (window.NaProjectAdmin.QuotationRenderer) {
                        renderedHtml = await window.NaProjectAdmin.QuotationRenderer.renderAsync(quotationData);
                    } else {
                        renderedHtml = renderBasicQuotation(quotationData);
                    }

                    documentContainer.innerHTML = backLinkHtml + renderedHtml;

                    if (allQuotations.length > 1) {
                        const backLink = document.getElementById('back-to-quotations');
                        if (backLink) {
                            backLink.addEventListener('click', async (e) => {
                                e.preventDefault();
                                await showQuotationPicker();
                            });
                        }
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

        // FUNCTION | Load All Quotations (plural format with legacy fallback)
        // ------------------------------------------------------------
        async function loadAllQuotations() {
            const projectPath = window.NaProjectAdmin.currentProjectPath;
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const quotationFile = config?.AppConfig?.ProjectLoading?.quotationFile || 'ProjectAdmin__Quotations__.json';

            if (!projectPath) {
                console.warn('[UserInterfaceMain] No project path available');
                return null;
            }

            try {
                const response = await fetch(`${projectPath}${quotationFile}`);

                if (response.ok) {
                    const data = await response.json();

                    // New plural format: { quotations: [...] }
                    if (data.quotations && Array.isArray(data.quotations)) {
                        return data.quotations;
                    }

                    // Single quotation object (legacy format loaded via new filename)
                    if (data.quotationRef) {
                        return [data];
                    }
                }
            } catch (error) {
                console.warn('[UserInterfaceMain] Could not load quotations file');
            }

            // Fallback: try legacy singular filename
            try {
                const legacyResponse = await fetch(`${projectPath}ProjectAdmin__Quotation__.json`);
                if (legacyResponse.ok) {
                    const legacyData = await legacyResponse.json();
                    if (legacyData.quotationRef) {
                        return [legacyData];
                    }
                }
            } catch (error) {
                console.warn('[UserInterfaceMain] Legacy quotation file not found');
            }

            return null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Load Quotation Data (backward-compatible wrapper)
        // ------------------------------------------------------------
        async function loadQuotationData() {
            const allQuotations = await loadAllQuotations();
            if (allQuotations && allQuotations.length > 0) {
                return allQuotations[0];
            }
            return null;
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

        // #region -------------------------------------------------------
        // INVOICE SYSTEM | Show Invoices
        // ---------------------------------------------------------------

            // FUNCTION | Show Invoice
            // ------------------------------------------------------------
            async function showInvoice(invoiceRef) {
                console.log('[UserInterfaceMain] Showing invoice...');

                const documentContainer = document.getElementById('document-container');
                if (!documentContainer) return;

                documentContainer.innerHTML = `
                    <div class="na-doc" style="text-align: center; padding: 3rem;">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Loading invoice...</p>
                    </div>
                `;

                try {
                    const invoicesData = await loadInvoiceData();

                    if (!invoicesData || !invoicesData.invoices || invoicesData.invoices.length === 0) {
                        documentContainer.innerHTML = `
                            <div class="na-doc" style="text-align: center; padding: 3rem;">
                                <h2>No Invoices Available</h2>
                                <p style="color: var(--App_TextSecondary);">
                                    No invoices have been created for this project yet.
                                </p>
                            </div>
                        `;
                        currentView = 'invoice';
                        return;
                    }

                    const targetRef = invoiceRef ||
                                      window.NaProjectAdmin.App?.getUrlParams()?.invoice;

                    let invoice = null;

                    if (targetRef) {
                        invoice = invoicesData.invoices.find(inv => inv.invoiceRef === targetRef);
                    }

                    if (!invoice) {
                        invoice = invoicesData.invoices[invoicesData.invoices.length - 1];
                    }

                    if (window.NaProjectAdmin.InvoiceRenderer) {
                        const html = await window.NaProjectAdmin.InvoiceRenderer.renderAsync(invoice);
                        documentContainer.innerHTML = html;

                        if (invoicesData.invoices.length > 1) {
                            const selectorHtml = renderInvoiceSelector(invoicesData.invoices, invoice.invoiceRef);
                            documentContainer.insertAdjacentHTML('afterbegin', selectorHtml);
                            setupInvoiceSelectorHandlers(invoicesData.invoices);
                        }
                    } else {
                        documentContainer.innerHTML = renderBasicInvoice(invoice);
                    }

                    loadedInvoices = invoicesData;
                    currentView = 'invoice';
                    currentContractId = null;

                } catch (error) {
                    console.error('[UserInterfaceMain] Failed to load invoice:', error);
                    documentContainer.innerHTML = `
                        <div class="na-doc" style="text-align: center; padding: 3rem;">
                            <h2 style="color: var(--App_StatusError);">Error Loading Invoice</h2>
                            <p>${error.message}</p>
                        </div>
                    `;
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Load Invoice Data
            // ------------------------------------------------------------
            async function loadInvoiceData() {
                const projectPath = window.NaProjectAdmin.currentProjectPath;
                const config      = window.NaProjectAdmin.ConfigManager?.getConfig();
                const invoiceFile = config?.AppConfig?.ProjectLoading?.invoiceFile || 'ProjectAdmin__Invoices__.json';

                if (!projectPath) {
                    console.warn('[UserInterfaceMain] No project path available');
                    return null;
                }

                try {
                    const response = await fetch(`${projectPath}${invoiceFile}`);

                    if (!response.ok) {
                        return null;
                    }

                    return await response.json();

                } catch (error) {
                    console.warn('[UserInterfaceMain] Invoice file not found');
                    return null;
                }
            }
            // ---------------------------------------------------------------

            // FUNCTION | Render Invoice Selector
            // ------------------------------------------------------------
            function renderInvoiceSelector(invoices, activeRef) {
                let options = '';

                invoices.forEach(inv => {
                    const selected = inv.invoiceRef === activeRef ? 'selected' : '';
                    const status   = inv.status === 'paid' ? ' (Paid)' : '';
                    options += `<option value="${inv.invoiceRef}" ${selected}>${inv.invoiceRef}${status}</option>`;
                });

                return `
                    <div style="padding: var(--App_SpacingMd) var(--App_SpacingXl); border-bottom: 1px solid var(--App_BorderLight); background: var(--App_BgTertiary);">
                        <label style="font-size: 0.875rem; font-weight: 600; color: var(--App_TextSecondary); margin-right: 0.5rem;">
                            Select Invoice:
                        </label>
                        <select id="invoice-selector" style="padding: 0.375rem 0.75rem; border: 1px solid var(--App_BorderMedium); border-radius: var(--App_BorderRadius); font-size: 0.875rem;">
                            ${options}
                        </select>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Setup Invoice Selector Handlers
            // ------------------------------------------------------------
            function setupInvoiceSelectorHandlers(invoices) {
                const selector = document.getElementById('invoice-selector');
                if (!selector) return;

                selector.addEventListener('change', async function() {
                    await showInvoice(this.value);
                });
            }
            // ---------------------------------------------------------------

            // FUNCTION | Render Basic Invoice (Fallback)
            // ------------------------------------------------------------
            function renderBasicInvoice(data) {
                return `
                    <div class="na-doc">
                        <div class="na-doc__header">
                            <h1 class="na-doc__title">Invoice</h1>
                            <p class="na-doc__ref">Ref: ${data.invoiceRef || 'N/A'}</p>
                        </div>
                        <pre>${JSON.stringify(data, null, 2)}</pre>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

        // endregion -----

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
            showCoverLetter          : showCoverLetter,
            showQuotation            : showQuotation,
            showQuotationPicker      : showQuotationPicker,
            loadAllQuotations        : loadAllQuotations,
            showInvoice              : showInvoice,
            showTerms                : showTerms,
            showContract             : showContract,
            showSignatureStatus      : showSignatureStatus,
            getCurrentView           : getCurrentView,
            getCurrentContractId     : getCurrentContractId,
            getLoadedQuotation       : getLoadedQuotation,
            getLoadedSpecialTerms    : getLoadedSpecialTerms,
            loadInvoiceData          : loadInvoiceData
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
