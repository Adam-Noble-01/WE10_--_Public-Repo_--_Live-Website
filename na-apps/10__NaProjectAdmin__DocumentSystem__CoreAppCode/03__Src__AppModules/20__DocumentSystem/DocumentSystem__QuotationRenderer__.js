// =============================================================================
// NOBLE ARCHITECTURE - QUOTATION RENDERER
// =============================================================================
//
// FILE       : DocumentSystem__QuotationRenderer__.js
// NAMESPACE  : NaProjectAdmin.QuotationRenderer
// MODULE     : QuotationRenderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Renders project quotations with line items and totals
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Renders quotation data into professional HTML document
// - Handles line items with quantities, rates, and amounts
// - Calculates subtotals, VAT, and grand totals
// - Supports grouped/phased line items
// - Includes sign-off button when signatures enabled
// - Fetches client PII from Cloudflare R2 (GDPR compliant)
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.1.0
// - Added GDPR-compliant client data fetching from Cloudflare R2
//   - renderAsync() method for async data loading
//   - Fetches client PII from secure encrypted storage
//   - Falls back to legacy inline client data if present
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Quotation HTML rendering
//   - Line item calculations
//   - VAT support
//
// =============================================================================

// #region -----
// MODULE | Quotation Renderer
// -----

    (function() {
        'use strict';

        // FUNCTION | Render Quotation (Synchronous - Legacy Support)
        // ------------------------------------------------------------
        function render(quotationData, clientDataOverride = null) {
            if (!quotationData) {
                return renderEmptyState();
            }

            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const quoteConfig = config?.AppConfig?.Features?.QuotationSystem;
            const companyDetails = config?.CompanyDetails;
            const projectCode = window.NaProjectAdmin.App?.getCurrentProject();

            // Get formatting options
            const currencySymbol = quoteConfig?.currencySymbol || '£';
            const showVat = quoteConfig?.showVat === true;
            const vatRate = quoteConfig?.vatRate || 0;

            // Calculate totals
            const totals = calculateTotals(quotationData.lineItems || [], vatRate, showVat);

            // Check if already signed
            const signatureRecord = sessionStorage.getItem(`naProjectAdmin_sig_quotation_${projectCode}`);
            const isSigned = signatureRecord !== null;

            // Use clientDataOverride if provided, otherwise fallback to inline data
            const clientDetails = clientDataOverride || quotationData.clientDetails || {};

            let html = `
                <div class="document">
                    ${renderHeader(quotationData, companyDetails)}
                    ${renderAddresses(quotationData, companyDetails, clientDetails)}
                    ${renderProjectDetails(quotationData)}
                    ${renderLineItems(quotationData.lineItems || [], currencySymbol)}
                    ${renderTotals(totals, currencySymbol, showVat)}
                    ${renderTerms(quotationData)}
                    ${isSigned ? renderSignatureRecord(signatureRecord) : renderSignButton('quotation', 'Quotation')}
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Quotation Async (GDPR Compliant - Fetches from R2)
        // ------------------------------------------------------------
        /**
         * Render quotation with client data fetched from Cloudflare R2
         * @param {Object} quotationData - Quotation JSON data
         * @returns {Promise<string>} Rendered HTML
         */
        async function renderAsync(quotationData) {
            if (!quotationData) {
                return renderEmptyState();
            }

            let clientDetails = quotationData.clientDetails || {};

            // Check if client data is stored in Cloudflare R2
            if (quotationData.clientDataStorage === 'cloudflare-r2-encrypted') {
                console.log('[QuotationRenderer] Fetching client data from Cloudflare R2...');
                
                const cloudflareClientData = await fetchClientDataFromCloudflare();
                
                if (cloudflareClientData) {
                    clientDetails = formatClientDataForDisplay(cloudflareClientData);
                    console.log('[QuotationRenderer] Client data loaded from secure storage');
                } else {
                    console.warn('[QuotationRenderer] Could not load client data from Cloudflare');
                }
            }

            // Use synchronous render with fetched client data
            return render(quotationData, clientDetails);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Fetch Client Data from Cloudflare
        // ------------------------------------------------------------
        /**
         * Fetch encrypted client data from Cloudflare R2
         * @returns {Object|null} Client data or null if not available
         */
        async function fetchClientDataFromCloudflare() {
            try {
                const App = window.NaProjectAdmin.App;
                const ApiClient = window.NaProjectAdmin.CloudflareApiClient;

                if (!App || !ApiClient) {
                    console.warn('[QuotationRenderer] App or ApiClient not available');
                    return null;
                }

                const projectCode = App.getCurrentProject();
                const year = App.getCurrentYear();
                const sessionToken = App.getSessionToken?.();

                if (!projectCode || !year || !sessionToken) {
                    console.warn('[QuotationRenderer] Missing project context or session token');
                    return null;
                }

                const result = await ApiClient.retrieveClientData(projectCode, year, sessionToken);

                if (result && result.success === true) {
                    return result.data;
                }

                return null;

            } catch (error) {
                console.error('[QuotationRenderer] Failed to fetch client data:', error);
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Client Data for Display
        // ------------------------------------------------------------
        /**
         * Format Cloudflare client data into display format
         * @param {Object} cloudflareData - Raw client data from R2
         * @returns {Object} Formatted client details for rendering
         */
        function formatClientDataForDisplay(cloudflareData) {
            if (!cloudflareData) return {};

            // Format client address as string
            const addr = cloudflareData.clientAddress || {};
            const addressParts = [];
            if (addr.houseNameNo) addressParts.push(addr.houseNameNo);
            if (addr.street) addressParts.push(addr.street);
            if (addr.district) addressParts.push(addr.district);
            if (addr.county) addressParts.push(addr.county);
            if (addr.postcode) addressParts.push(addr.postcode);

            return {
                name             : cloudflareData.clientName || '',
                address          : addressParts.join('<br>'),
                email            : cloudflareData.clientEmail || '',
                phone            : cloudflareData.clientPhone || ''
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Header
        // ------------------------------------------------------------
        function renderHeader(data, companyDetails) {
            const dateFormatter = window.NaProjectAdmin.DateFormatter;
            const assetLoader = window.NaProjectAdmin.AssetLoader;
            const quotationDate = data.quotationDate 
                ? dateFormatter?.formatLongWithOrdinal(data.quotationDate) || data.quotationDate
                : dateFormatter?.formatLongWithOrdinal(new Date()) || new Date().toLocaleDateString();
            
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
                        <h1 class="document__title">Quotation</h1>
                        <p class="document__ref">Ref: ${data.quotationRef || 'N/A'}</p>
                        <p class="document__ref">Date: ${quotationDate}</p>
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Addresses
        // ------------------------------------------------------------
        function renderAddresses(data, companyDetails, clientDetails = null) {
            // Use provided clientDetails, or fallback to data.clientDetails
            const client = clientDetails || data.clientDetails || {};

            return `
                <div class="document__section document__addresses">
                    <div class="address-block">
                        <div class="address-block__title">From</div>
                        <div class="address-block__content">
                            <strong>${companyDetails?.companyName || 'Noble Architecture'}</strong><br>
                            ${companyDetails?.companyAddress || 'Nottingham, UK'}<br>
                            ${companyDetails?.companyEmail || ''}
                        </div>
                    </div>
                    <div class="address-block">
                        <div class="address-block__title">To</div>
                        <div class="address-block__content">
                            <strong>${client.name || 'Client Name'}</strong><br>
                            ${client.address || ''}<br>
                            ${client.email || ''}<br>
                            ${client.phone || ''}
                        </div>
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Project Details
        // ------------------------------------------------------------
        function renderProjectDetails(data) {
            if (!data.projectDescription && !data.projectAddress) {
                return '';
            }

            return `
                <div class="document__section">
                    <h2 class="document__section-title">Project Details</h2>
                    ${data.projectAddress ? `<p><strong>Site Address:</strong> ${data.projectAddress}</p>` : ''}
                    ${data.projectDescription ? `<p>${data.projectDescription}</p>` : ''}
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Line Items
        // ------------------------------------------------------------
        function renderLineItems(lineItems, currencySymbol) {
            if (!lineItems || lineItems.length === 0) {
                return `
                    <div class="document__section">
                        <h2 class="document__section-title">Quotation Items</h2>
                        <p style="color: var(--App_TextMuted);">No line items specified.</p>
                    </div>
                `;
            }

            // Group items by phase/group if specified
            const grouped = groupLineItems(lineItems);

            let html = `
                <div class="document__section">
                    <h2 class="document__section-title">Quotation Items</h2>
                    <table class="quote-table">
                        <thead>
                            <tr>
                                <th class="quote-table__description">Description</th>
                                <th class="quote-table__qty">Qty</th>
                                <th class="quote-table__unit">Unit</th>
                                <th class="quote-table__rate">Rate</th>
                                <th class="quote-table__amount">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Render grouped items
            Object.keys(grouped).forEach(groupName => {
                const items = grouped[groupName];

                // Add group header if not default group
                if (groupName !== '_default') {
                    html += `
                        <tr class="quote-table__group-header">
                            <td colspan="5">${groupName}</td>
                        </tr>
                    `;
                }

                // Render items in group
                items.forEach(item => {
                    const amount = calculateLineAmount(item);
                    html += `
                        <tr>
                            <td class="quote-table__description">${item.description || ''}</td>
                            <td class="quote-table__qty">${item.quantity || 1}</td>
                            <td class="quote-table__unit">${item.unit || '-'}</td>
                            <td class="quote-table__rate">${currencySymbol}${formatNumber(item.rate || 0)}</td>
                            <td class="quote-table__amount">${currencySymbol}${formatNumber(amount)}</td>
                        </tr>
                    `;
                });
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Group Line Items
        // ------------------------------------------------------------
        function groupLineItems(lineItems) {
            const groups = {};

            lineItems.forEach(item => {
                const groupName = item.group || item.phase || '_default';
                
                if (!groups[groupName]) {
                    groups[groupName] = [];
                }
                
                groups[groupName].push(item);
            });

            return groups;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Line Amount
        // ------------------------------------------------------------
        function calculateLineAmount(item) {
            const quantity = parseFloat(item.quantity) || 1;
            const rate = parseFloat(item.rate) || 0;
            return quantity * rate;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Totals
        // ------------------------------------------------------------
        function calculateTotals(lineItems, vatRate, showVat) {
            let subtotal = 0;

            lineItems.forEach(item => {
                subtotal += calculateLineAmount(item);
            });

            const vat = showVat ? subtotal * (vatRate / 100) : 0;
            const grandTotal = subtotal + vat;

            return {
                subtotal             : subtotal,
                vatRate              : vatRate,
                vat                  : vat,
                grandTotal           : grandTotal,
                showVat              : showVat
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Totals
        // ------------------------------------------------------------
        function renderTotals(totals, currencySymbol, showVat) {
            let html = `
                <div class="quote-totals">
                    <div class="quote-totals__row">
                        <span>Subtotal</span>
                        <span>${currencySymbol}${formatNumber(totals.subtotal)}</span>
                    </div>
            `;

            if (showVat && totals.vatRate > 0) {
                html += `
                    <div class="quote-totals__row">
                        <span>VAT (${totals.vatRate}%)</span>
                        <span>${currencySymbol}${formatNumber(totals.vat)}</span>
                    </div>
                `;
            }

            html += `
                    <div class="quote-totals__row quote-totals__row--grand">
                        <span>Total</span>
                        <span>${currencySymbol}${formatNumber(totals.grandTotal)}</span>
                    </div>
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Terms
        // ------------------------------------------------------------
        function renderTerms(data) {
            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const validityDays = config?.AppConfig?.Features?.QuotationSystem?.validityDays || 30;

            const dateFormatter = window.NaProjectAdmin.DateFormatter;
            const validUntil = dateFormatter?.formatLongWithOrdinal(dateFormatter?.daysFromNow(validityDays));

            return `
                <div class="document__section">
                    <h2 class="document__section-title">Quotation Terms</h2>
                    <ul style="color: var(--App_TextSecondary); line-height: 1.8;">
                        <li>This quotation is valid for ${validityDays} days from the date of issue${validUntil ? ` (until ${validUntil})` : ''}.</li>
                        <li>Prices are exclusive of VAT unless otherwise stated.</li>
                        <li>Payment terms: As per our Terms & Conditions.</li>
                        ${data.additionalTerms ? `<li>${data.additionalTerms}</li>` : ''}
                    </ul>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Sign Button
        // ------------------------------------------------------------
        function renderSignButton(documentType, documentTitle) {
            return `
                <div class="sign-document-section">
                    <h3 class="sign-document-section__title">Accept This Quotation</h3>
                    <p class="sign-document-section__text">
                        Please review the quotation above. When you are ready to proceed, 
                        click the button below to sign and accept.
                    </p>
                    <button class="btn btn--primary btn--large" 
                            onclick="window.NaProjectAdmin.App.showSignatureScreen('${documentType}', '${documentTitle}')">
                        Sign &amp; Accept Quotation
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
                            Document Signed and Accepted
                        </div>
                        <div class="signature-record__details">
                            <span class="signature-record__label">Signed by:</span>
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

        // FUNCTION | Render Empty State
        // ------------------------------------------------------------
        function renderEmptyState() {
            return `
                <div class="document" style="text-align: center; padding: 3rem;">
                    <h2>No Quotation Data</h2>
                    <p style="color: var(--App_TextSecondary);">
                        Quotation data could not be loaded or has not been created yet.
                    </p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Number
        // ------------------------------------------------------------
        function formatNumber(num) {
            return parseFloat(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.QuotationRenderer = {
            render                   : render,
            renderAsync              : renderAsync,
            fetchClientData          : fetchClientDataFromCloudflare,
            calculateTotals          : calculateTotals,
            calculateLineAmount      : calculateLineAmount,
            formatNumber             : formatNumber
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('QuotationRenderer');
        }

    })();

// endregion -----

