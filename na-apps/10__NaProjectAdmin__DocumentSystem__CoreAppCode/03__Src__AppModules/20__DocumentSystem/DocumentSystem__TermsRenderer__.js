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
// - Renders special job-specific terms (dynamic, per project)
// - Renders general terms and conditions (static HTML)
// - Shows special terms first as per configuration
// - Includes sign-off functionality
//
// -----
//
// DEVELOPMENT LOG:
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

        // FUNCTION | Render Terms Document
        // ------------------------------------------------------------
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

        // FUNCTION | Render Header
        // ------------------------------------------------------------
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
                        <p class="document__ref">${companyDetails?.companyName || 'Noble Architecture'}</p>
                        <p class="document__ref">Effective: ${currentDate}</p>
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Special Terms
        // ------------------------------------------------------------
        function renderSpecialTerms(data) {
            if (!data || !data.terms || data.terms.length === 0) {
                return '';
            }

            let html = `
                <div class="terms-section terms-section--special">
                    <h2 class="terms-section__title">
                        ${data.sectionTitle || 'Special Terms for This Project'}
                    </h2>
                    ${data.introduction ? `<p style="margin-bottom: 1rem;">${data.introduction}</p>` : ''}
            `;

            data.terms.forEach((term, index) => {
                html += `
                    <div class="terms-item">
                        ${term.title ? `<div class="terms-item__title">${index + 1}. ${term.title}</div>` : ''}
                        <div class="terms-item__content">${term.content || ''}</div>
                    </div>
                `;
            });

            html += '</div>';

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render General Terms
        // ------------------------------------------------------------
        function renderGeneralTerms(generalTermsHtml) {
            return `
                <div class="terms-section">
                    <h2 class="terms-section__title">General Terms &amp; Conditions</h2>
                    <div class="terms-content">
                        ${generalTermsHtml || '<p>General terms and conditions not available.</p>'}
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Sign Button
        // ------------------------------------------------------------
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

        // FUNCTION | Render Signature Record
        // ------------------------------------------------------------
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

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.TermsRenderer = {
            render                   : render,
            renderSpecialTerms       : renderSpecialTerms,
            renderGeneralTerms       : renderGeneralTerms
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('TermsRenderer');
        }

    })();

// endregion -----

