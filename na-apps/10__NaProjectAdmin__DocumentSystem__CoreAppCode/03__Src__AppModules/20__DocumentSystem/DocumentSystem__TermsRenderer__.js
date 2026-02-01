// =============================================================================
// NOBLE ARCHITECTURE - TERMS & CONDITIONS RENDERER
// =============================================================================
//
// FILE       : DocumentSystem__TermsRenderer__.js
// NAMESPACE  : NaProjectAdmin.TermsRenderer
// MODULE     : TermsRenderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Renders Terms & Conditions with special and general sections
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Renders contract-specific terms (multi-contract system)
// - Renders special job-specific terms (dynamic, per project)
// - Renders standard terms from parsed markdown
// - Shows special terms first as per configuration
// - Includes sign-off functionality per contract
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 2.0.0
// - Multi-Contract System
//   - Added renderContract() for contract-specific rendering
//   - Integration with ContractLoader for markdown terms
//   - Per-contract signature tracking
//   - Dynamic contract title rendering
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Terms rendering
//   - Special terms at top
//   - Signature integration
//
// =============================================================================

// #region -----
// MODULE | Terms Renderer
// -----

    (function() {
        'use strict';

        // #region -----
        // FUNCTION | Render Contract (Multi-Contract System)
        // -----

            /**
             * Render a specific contract document
             * @param {string} contractId - Contract identifier
             * @param {Object} [options] - Rendering options
             * @returns {Promise<string>} Rendered HTML
             */
            async function renderContract(contractId, options = {}) {
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const termsConfig = config?.AppConfig?.Features?.TermsSystem;
                const companyDetails = config?.CompanyDetails;
                const projectCode = window.NaProjectAdmin.App?.getCurrentProject();
                const projectConfig = window.NaProjectAdmin.App?.getProjectConfig();

                // Get contract definition
                const contractLoader = window.NaProjectAdmin.ContractLoader;
                if (!contractLoader) {
                    console.error('[TermsRenderer] ContractLoader not available');
                    return renderError('Contract system not available');
                }

                const contractDef = contractLoader.getContractDefinition(contractId);
                if (!contractDef) {
                    console.error(`[TermsRenderer] Unknown contract: ${contractId}`);
                    return renderError(`Contract "${contractId}" not found`);
                }

                // Load contract HTML (standard terms from markdown)
                const standardTermsHtml = await contractLoader.loadContractHtml(contractId);
                if (!standardTermsHtml) {
                    console.warn(`[TermsRenderer] Could not load standard terms for: ${contractId}`);
                }

                // Check signature status for this contract
                const signatureKey = `naProjectAdmin_sig_contract_${projectCode}_${contractId}`;
                const signatureRecord = sessionStorage.getItem(signatureKey);
                const isSigned = signatureRecord !== null || 
                                 contractLoader.isContractSigned(projectConfig, contractId);

                // Determine order
                const showSpecialFirst = termsConfig?.showSpecialTermsFirst === true;

                // Load special terms for this contract (if any)
                const specialTermsData = await loadContractSpecialTerms(contractId, projectConfig);

                // Build HTML
                let html = `
                    <div class="document terms-document" data-contract-id="${contractId}">
                        ${renderContractHeader(companyDetails, contractDef)}
                `;

                if (showSpecialFirst && specialTermsData) {
                    html += renderSpecialTerms(specialTermsData);
                    html += renderStandardTerms(standardTermsHtml, contractDef);
                } else {
                    html += renderStandardTerms(standardTermsHtml, contractDef);
                    if (specialTermsData) {
                        html += renderSpecialTerms(specialTermsData);
                    }
                }

                html += isSigned
                    ? renderContractSignatureRecord(signatureRecord, contractId, projectConfig)
                    : renderContractSignButton(contractId, contractDef.name);

                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

            /**
             * Load special terms for a specific contract
             * @param {string} contractId - Contract identifier
             * @param {Object} projectConfig - Project configuration
             * @returns {Promise<Object|null>} Special terms data or null
             */
            async function loadContractSpecialTerms(contractId, projectConfig) {
                // Check if project has special terms enabled for this contract
                const contractConfig = projectConfig?.contracts?.[contractId];
                
                if (!contractConfig?.specialTermsEnabled) {
                    return null;
                }

                // Construct special terms filename
                const filename = `SpecialTerms__${contractId}__.json`;
                const projectPath = window.NaProjectAdmin.currentProjectPath;

                if (!projectPath) {
                    console.warn('[TermsRenderer] No project path available for special terms');
                    return null;
                }

                try {
                    const response = await fetch(`${projectPath}${filename}`);
                    if (!response.ok) {
                        console.warn(`[TermsRenderer] Special terms file not found: ${filename}`);
                        return null;
                    }

                    const data = await response.json();
                    console.log(`[TermsRenderer] Loaded special terms for ${contractId}`);
                    return data;

                } catch (error) {
                    console.error(`[TermsRenderer] Error loading special terms for ${contractId}:`, error);
                    return null;
                }
            }
            // ---------------------------------------------------------------

            /**
             * Render contract header with contract-specific title
             * @param {Object} companyDetails - Company details from config
             * @param {Object} contractDef - Contract definition
             * @returns {string} Header HTML
             */
            function renderContractHeader(companyDetails, contractDef) {
                const dateFormatter = window.NaProjectAdmin.DateFormatter;
                const assetLoader = window.NaProjectAdmin.AssetLoader;
                const currentDate = dateFormatter?.formatLongWithOrdinal(new Date()) || new Date().toLocaleDateString();

                // Get logo URL from AssetLoader
                const logoUrl = assetLoader?.getAssetUrl('GRAPHICS', 'NaBrandGraphic__CompanyLogo__w2048xh500px__.png') || '';

                return `
                    <div class="document__header">
                        <div>
                            <img src="${logoUrl}" 
                                 alt="${companyDetails?.companyName || 'Noble Architecture'}" 
                                 class="document__logo">
                        </div>
                        <div class="document__meta">
                            <h1 class="document__title">${contractDef.name}</h1>
                            <p class="document__subtitle">Terms &amp; Conditions</p>
                            <p class="document__ref">Effective: ${currentDate}</p>
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render standard terms section (from parsed markdown)
             * @param {string} standardTermsHtml - Parsed HTML from markdown
             * @param {Object} contractDef - Contract definition
             * @returns {string} Section HTML
             */
            function renderStandardTerms(standardTermsHtml, contractDef) {
                if (!standardTermsHtml) {
                    return `
                        <div class="terms-section">
                            <h2 class="terms-section__title">Standard Terms</h2>
                            <div class="terms-content">
                                <p>Standard terms for ${contractDef.name} are not available.</p>
                            </div>
                        </div>
                    `;
                }

                // Get quotation reference from project data
                const quotationData = window.NaProjectAdmin.UserInterfaceMain?.getLoadedQuotation();
                const quotationRef = quotationData?.quotationRef || 'N/A';

                return `
                    <div class="terms-section terms-section--standard">
                        <h2 class="terms-section__title">Standard Terms</h2>
                        <div class="terms-content">
                            ${standardTermsHtml}
                            <div class="terms-footer">
                                <p>End Of Contract Associated With ${quotationRef}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render contract sign button
             * @param {string} contractId - Contract identifier
             * @param {string} contractName - Contract display name
             * @returns {string} Sign button HTML
             */
            function renderContractSignButton(contractId, contractName) {
                return `
                    <div class="sign-document-section">
                        <h3 class="sign-document-section__title">Accept ${contractName}</h3>
                        <p class="sign-document-section__text">
                            Please read the terms and conditions above carefully. 
                            By signing below, you confirm that you have read, understood, 
                            and agree to be bound by these terms.
                        </p>
                        <button class="btn btn--primary btn--large" 
                                onclick="window.NaProjectAdmin.App.showSignatureScreen('contract_${contractId}', '${contractName}')">
                            Sign &amp; Accept
                        </button>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render contract signature record
             * @param {string|null} signatureRecordJson - Signature record from session
             * @param {string} contractId - Contract identifier
             * @param {Object} projectConfig - Project configuration
             * @returns {string} Signature record HTML
             */
            function renderContractSignatureRecord(signatureRecordJson, contractId, projectConfig) {
                // Try to get from session storage first
                let record = null;

                if (signatureRecordJson) {
                    try {
                        record = JSON.parse(signatureRecordJson);
                    } catch (e) {
                        console.warn('[TermsRenderer] Could not parse signature record from session');
                    }
                }

                // Fall back to project config
                if (!record && projectConfig?.contracts?.[contractId]) {
                    const contractConfig = projectConfig.contracts[contractId];
                    if (contractConfig.signed) {
                        record = {
                            signerName           : 'Recorded',
                            signedDate           : contractConfig.signedDate || 'Unknown',
                            signatureRef         : contractConfig.signatureRef || 'N/A'
                        };
                    }
                }

                if (!record) {
                    return '<p>Signature record not available.</p>';
                }

                return `
                    <div class="signature-record">
                        <div class="signature-record__header">
                            <span style="color: var(--App_StatusSuccess);">&#10004;</span>
                            Terms Accepted
                        </div>
                        <div class="signature-record__details">
                            <span class="signature-record__label">Accepted by:</span>
                            <span class="signature-record__value">${record.signerName || 'N/A'}</span>
                            <span class="signature-record__label">Date:</span>
                            <span class="signature-record__value">${record.signedDate || 'N/A'}</span>
                            <span class="signature-record__label">Reference:</span>
                            <span class="signature-record__value">${record.signatureRef || 'N/A'}</span>
                        </div>
                        ${record.signatureImage ? `
                            <div class="signature-record__image">
                                <img src="${record.signatureImage}" alt="Signature">
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render error message
             * @param {string} message - Error message
             * @returns {string} Error HTML
             */
            function renderError(message) {
                return `
                    <div class="document terms-document terms-document--error">
                        <div class="error-message">
                            <h2>Unable to Load Contract</h2>
                            <p>${message}</p>
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // FUNCTION | Legacy Render (Backwards Compatibility)
        // -----

            /**
             * Render Terms Document (Legacy - for backwards compatibility)
             * @param {Object} specialTermsData - Special terms data
             * @param {string} generalTermsHtml - General terms HTML
             * @returns {string} Rendered HTML
             */
            function render(specialTermsData, generalTermsHtml) {
                const config = window.NaProjectAdmin.ConfigManager?.getConfig();
                const termsConfig = config?.AppConfig?.Features?.TermsSystem;
                const companyDetails = config?.CompanyDetails;
                const projectCode = window.NaProjectAdmin.App?.getCurrentProject();

                // Check if already signed
                const signatureRecord = sessionStorage.getItem(`naProjectAdmin_sig_terms_${projectCode}`);
                const isSigned = signatureRecord !== null;

                // Determine order
                const showSpecialFirst = termsConfig?.showSpecialTermsFirst === true;

                let html = `
                    <div class="document terms-document">
                        ${renderHeader(companyDetails)}
                `;

                if (showSpecialFirst) {
                    html += renderSpecialTerms(specialTermsData);
                    html += renderGeneralTerms(generalTermsHtml);
                } else {
                    html += renderGeneralTerms(generalTermsHtml);
                    html += renderSpecialTerms(specialTermsData);
                }

                html += isSigned 
                    ? renderSignatureRecord(signatureRecord) 
                    : renderSignButton('terms', 'Terms & Conditions');

                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

            /**
             * Render Header (Legacy)
             * @param {Object} companyDetails - Company details
             * @returns {string} Header HTML
             */
            function renderHeader(companyDetails) {
                const dateFormatter = window.NaProjectAdmin.DateFormatter;
                const assetLoader = window.NaProjectAdmin.AssetLoader;
                const currentDate = dateFormatter?.formatLongWithOrdinal(new Date()) || new Date().toLocaleDateString();
                
                // Get logo URL from AssetLoader (generates full URL from config)
                const logoUrl = assetLoader?.getAssetUrl('GRAPHICS', 'NaBrandGraphic__CompanyLogo__w2048xh500px__.png') || '';

                return `
                    <div class="document__header">
                        <div>
                            <img src="${logoUrl}" 
                                 alt="${companyDetails?.companyName || 'Noble Architecture'}" 
                                 class="document__logo">
                        </div>
                        <div class="document__meta">
                            <h1 class="document__title">Terms &amp; Conditions</h1>
                            <p class="document__ref">Effective: ${currentDate}</p>
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render Special Terms
             * @param {Object} data - Special terms data
             * @returns {string} Special terms HTML
             */
            function renderSpecialTerms(data) {
                // Handle null/undefined data
                if (!data) {
                    return '';
                }

                // Check if terms exist and have content
                const hasValidTerms = data.terms && data.terms.length > 0 && 
                                      data.terms.some(t => t.title || t.content);

                if (!hasValidTerms && !data.introduction) {
                    return '';
                }

                let html = `
                    <div class="terms-section terms-section--special">
                        <h2 class="terms-section__title">
                            ${escapeHtml(data.sectionTitle || 'Special Terms for This Contract')}
                        </h2>
                        ${data.introduction ? `<p class="terms-section__intro">${escapeHtml(data.introduction)}</p>` : ''}
                `;

                if (data.terms && data.terms.length > 0) {
                    data.terms.forEach((term, index) => {
                        if (term.title || term.content) {
                            html += `
                                <div class="terms-item">
                                    ${term.title ? `<div class="terms-item__title">${index + 1}. ${escapeHtml(term.title)}</div>` : ''}
                                    <div class="terms-item__content">${escapeHtml(term.content || '')}</div>
                                </div>
                            `;
                        }
                    });
                }

                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

            /**
             * Escape HTML special characters
             * @param {string} text - Text to escape
             * @returns {string} Escaped text
             */
            function escapeHtml(text) {
                if (!text) return '';
                return String(text)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
            // ---------------------------------------------------------------

            /**
             * Render General Terms (Legacy)
             * @param {string} generalTermsHtml - General terms HTML
             * @returns {string} Section HTML
             */
            function renderGeneralTerms(generalTermsHtml) {
                // Get quotation reference from project data
                const quotationData = window.NaProjectAdmin.UserInterfaceMain?.getLoadedQuotation();
                const quotationRef = quotationData?.quotationRef || 'N/A';

                return `
                    <div class="terms-section">
                        <h2 class="terms-section__title">General Terms &amp; Conditions</h2>
                        <div class="terms-content">
                            ${generalTermsHtml || '<p>General terms and conditions not available.</p>'}
                            <div class="terms-footer">
                                <p>End Of Contract Associated With ${quotationRef}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render Sign Button (Legacy)
             * @param {string} documentType - Document type identifier
             * @param {string} documentTitle - Document title
             * @returns {string} Sign button HTML
             */
            function renderSignButton(documentType, documentTitle) {
                return `
                    <div class="sign-document-section">
                        <h3 class="sign-document-section__title">Accept Terms &amp; Conditions</h3>
                        <p class="sign-document-section__text">
                            Please read the terms and conditions above carefully. 
                            By signing below, you confirm that you have read, understood, 
                            and agree to be bound by these terms.
                        </p>
                        <button class="btn btn--primary btn--large" 
                                onclick="window.NaProjectAdmin.App.showSignatureScreen('${documentType}', '${documentTitle}')">
                            Sign &amp; Accept Terms
                        </button>
                    </div>
                `;
            }
            // ---------------------------------------------------------------

            /**
             * Render Signature Record (Legacy)
             * @param {string} signatureRecordJson - Signature record JSON
             * @returns {string} Signature record HTML
             */
        function renderSignatureRecord(signatureRecordJson) {
            try {
                const record = JSON.parse(signatureRecordJson);

                return `
                    <div class="signature-record">
                        <div class="signature-record__header">
                            <span style="color: var(--App_StatusSuccess);">&#10004;</span>
                            Terms &amp; Conditions Accepted
                        </div>
                        <div class="signature-record__details">
                            <span class="signature-record__label">Accepted by:</span>
                            <span class="signature-record__value">${record.signerName || 'N/A'}</span>
                            <span class="signature-record__label">Date:</span>
                            <span class="signature-record__value">${record.signedDate || 'N/A'}</span>
                            ${record.quotationRef ? `
                                <span class="signature-record__label">Quotation Ref:</span>
                                <span class="signature-record__value">${record.quotationRef}</span>
                            ` : ''}
                            <span class="signature-record__label">Reference:</span>
                            <span class="signature-record__value">${record.signatureRef || 'N/A'}</span>
                        </div>
                        ${record.signatureImage ? `
                            <div class="signature-record__image">
                                <img src="${record.signatureImage}" alt="Signature">
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (error) {
                return '<p>Signature record available but could not be displayed.</p>';
            }
        }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // API EXPORT | Public Interface
        // -----

            window.NaProjectAdmin = window.NaProjectAdmin || {};
            
            window.NaProjectAdmin.TermsRenderer = {
                // Multi-contract system
                renderContract           : renderContract,
                
                // Legacy API
                render                   : render,
                renderSpecialTerms       : renderSpecialTerms,
                renderGeneralTerms       : renderGeneralTerms,
                renderStandardTerms      : renderStandardTerms
            };

            // Mark module as loaded
            if (window.NaProjectAdmin.ModuleDependencyManager) {
                window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('TermsRenderer');
            }

            console.log('[TermsRenderer] Module loaded');

        // endregion -----

    })();

// endregion -----
