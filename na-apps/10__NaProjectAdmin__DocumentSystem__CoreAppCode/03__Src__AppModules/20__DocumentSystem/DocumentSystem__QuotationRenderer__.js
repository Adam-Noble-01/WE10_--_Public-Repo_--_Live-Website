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
// 01-Feb-2026 - Version 1.2.1
// - Simplified in-table phase subtotals (value only, no label)
// - Added phase breakdown to totals section at bottom
// - Phase names and values displayed before Subtotal/Total
//
// 01-Feb-2026 - Version 1.2.0
// - Fixed zero quantity bug - now respects qty=0 instead of defaulting to 1
// - Fixed group ordering - preserves original array order using Map
// - Added per-phase subtotal rows after each group in rendered quotation
//
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

            // VAT settings are read from the quotation data (set by the editor toggle).
            // Fall back to app config only for legacy quotations that pre-date vatApplicable.
            const showVat = quotationData.totals?.vatApplicable === true;
            const vatRate = quotationData.totals?.vatRate ?? quoteConfig?.vatRate ?? 0;

            // Calculate totals and phase subtotals
            const totals = calculateTotals(quotationData.lineItems || [], vatRate, showVat);
            const phaseSubtotals = calculatePhaseSubtotals(quotationData.lineItems || []);

            // Determine whether this quotation requires a signature
            const signatureRequired = quotationData.signatureRequired !== false;

            // Per-quotation signature lookup with legacy fallback
            let signatureRecord = null;
            if (signatureRequired) {
                const quotationRef = quotationData.quotationRef;
                if (quotationRef) {
                    signatureRecord = sessionStorage.getItem(
                        `naProjectAdmin_sig_quotation_${projectCode}_${quotationRef}`
                    );
                }
                if (!signatureRecord) {
                    const legacyRecord = sessionStorage.getItem(
                        `naProjectAdmin_sig_quotation_${projectCode}`
                    );
                    if (legacyRecord) {
                        try {
                            const parsed = JSON.parse(legacyRecord);
                            if (!parsed.quotationRef || parsed.quotationRef === quotationRef) {
                                signatureRecord = legacyRecord;
                            }
                        } catch (_) { /* ignore parse errors */ }
                    }
                }
            }
            const isSigned = signatureRecord !== null;

            // Use clientDataOverride if provided, otherwise fallback to inline data
            const clientDetails = clientDataOverride || quotationData.clientDetails || {};

            // Build signature section based on signatureRequired flag
            let signatureHtml = '';
            if (signatureRequired) {
                signatureHtml = isSigned
                    ? renderSignatureRecord(signatureRecord)
                    : renderSignButton('quotation', 'Quotation');
            }

            let html = `
                <div class="document">
                    ${renderHeader(quotationData, companyDetails)}
                    ${renderAddresses(quotationData, companyDetails, clientDetails)}
                    ${renderProjectDetails(quotationData)}
                    ${renderLineItems(quotationData.lineItems || [], currencySymbol)}
                    ${renderTotals(totals, currencySymbol, showVat, phaseSubtotals)}
                    ${renderTerms(quotationData)}
                    ${signatureHtml}
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Quotation Async (GDPR Compliant - Fetches from R2)
        // ------------------------------------------------------------
        /**
         * Render quotation with client data fetched from Cloudflare R2
         * Always attempts to fetch full client details from secure storage
         * @param {Object} quotationData - Quotation JSON data
         * @returns {Promise<string>} Rendered HTML
         */
        async function renderAsync(quotationData) {
            if (!quotationData) {
                return renderEmptyState();
            }

            let clientDetails = quotationData.clientDetails || {};

            // Always attempt to fetch client data from Cloudflare R2
            // Client PII (address, email, phone) is stored encrypted in R2 for GDPR compliance
            console.log('[QuotationRenderer] Fetching client data from Cloudflare R2...');
            
            const cloudflareClientData = await fetchClientDataFromCloudflare();
            
            if (cloudflareClientData) {
                // Merge Cloudflare data with any existing client details
                const formattedData = formatClientDataForDisplay(cloudflareClientData);
                clientDetails = {
                    ...clientDetails,                            // <-- Keep any existing data
                    ...formattedData                             // <-- Override with Cloudflare data
                };
                console.log('[QuotationRenderer] Client data loaded from secure storage');
            } else {
                console.warn('[QuotationRenderer] Could not load client data from Cloudflare - using inline data only');
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
                
                if (!projectCode) {
                    console.warn('[QuotationRenderer] No project code available');
                    return null;
                }

                // Get session token from App (generates one if authenticated)
                let sessionToken = App.getSessionToken?.();

                // Fallback: generate token if App.getSessionToken not available
                if (!sessionToken && App.isAuthenticated?.()) {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(2);
                    sessionToken = btoa(`${projectCode}:${timestamp}:${random}`);
                    console.log('[QuotationRenderer] Generated fallback session token');
                }

                if (!sessionToken) {
                    console.warn('[QuotationRenderer] No session token available - user may not be authenticated');
                    return null;
                }

                // ApiClient.retrieveClientData takes (projectCode, sessionToken) - year is auto-detected
                const result = await ApiClient.retrieveClientData(projectCode, sessionToken);

                if (result && result.success === true) {
                    console.log('[QuotationRenderer] Client data retrieved from Cloudflare');
                    return result.data;
                }

                if (result?.error) {
                    console.warn('[QuotationRenderer] Cloudflare returned error:', result.error);
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

            // Group items by phase/group - preserves original order
            const { orderedGroups, groupMap } = groupLineItems(lineItems);

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

            // Render grouped items in original order
            orderedGroups.forEach(groupName => {
                const items = groupMap.get(groupName);

                // Add group header if not default group
                if (groupName !== '_default') {
                    html += `
                        <tr class="quote-table__group-header">
                            <td colspan="5">${groupName}</td>
                        </tr>
                    `;
                }

                // Calculate phase subtotal
                let phaseSubtotal = 0;

                // Render items in group
                items.forEach(item => {
                    const amount = calculateLineAmount(item);
                    phaseSubtotal += amount;
                    
                    // Display quantity - show actual value (including 0)
                    const displayQty = item.quantity !== undefined ? item.quantity : 1;
                    const secondaryDescription = typeof item.itemDescription === 'string'
                        ? item.itemDescription.trim()
                        : '';
                    
                    html += `
                        <tr>
                            <td class="quote-table__description" data-label="Description">
                                <div class="quote-table__description-main">${item.description || ''}</div>
                                ${secondaryDescription ? `<div class="quote-table__description-secondary">${secondaryDescription}</div>` : ''}
                            </td>
                            <td class="quote-table__qty" data-label="Qty">${displayQty}</td>
                            <td class="quote-table__unit" data-label="Unit">${item.unit || '-'}</td>
                            <td class="quote-table__rate" data-label="Rate">${currencySymbol}${formatNumber(item.rate || 0)}</td>
                            <td class="quote-table__amount" data-label="Amount">${currencySymbol}${formatNumber(amount)}</td>
                        </tr>
                    `;
                });

                // Add simple subtotal row after each group (value only, right-aligned)
                if (groupName !== '_default' && items.length > 0) {
                    html += `
                        <tr class="quote-table__phase-subtotal">
                            <td colspan="4"></td>
                            <td class="quote-table__amount" style="font-weight: 600; border-top: 1px solid #ddd;">
                                ${currencySymbol}${formatNumber(phaseSubtotal)}
                            </td>
                        </tr>
                    `;
                }
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Group Line Items (Preserves Original Order)
        // ------------------------------------------------------------
        /**
         * Groups line items by phase/group while preserving the original order
         * @param {Array} lineItems - Array of line items
         * @returns {Object} Object with orderedGroups array and groupMap Map
         */
        function groupLineItems(lineItems) {
            const orderedGroups = [];                                     // <-- Tracks group order
            const groupMap = new Map();                                   // <-- Map preserves insertion order

            lineItems.forEach(item => {
                const groupName = item.group || item.phase || '_default';
                
                if (!groupMap.has(groupName)) {
                    groupMap.set(groupName, []);
                    orderedGroups.push(groupName);                        // <-- Track order of first appearance
                }
                
                groupMap.get(groupName).push(item);
            });

            return { orderedGroups, groupMap };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Line Amount
        // ------------------------------------------------------------
        function calculateLineAmount(item) {
            // Use explicit NaN check to respect zero values
            const parsedQty = parseFloat(item.quantity);
            const quantity = Number.isNaN(parsedQty) ? 1 : parsedQty;      // <-- Respects 0
            const parsedRate = parseFloat(item.rate);
            const rate = Number.isNaN(parsedRate) ? 0 : parsedRate;       // <-- Respects 0
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

        // FUNCTION | Calculate Phase Subtotals
        // ------------------------------------------------------------
        /**
         * Calculate subtotals per phase/group, preserving order
         * @param {Array} lineItems - Array of line items
         * @returns {Array} Array of { name, subtotal } in order
         */
        function calculatePhaseSubtotals(lineItems) {
            const orderedPhases = [];                                     // <-- Track order
            const phaseMap = new Map();                                   // <-- Track amounts

            lineItems.forEach(item => {
                const groupName = item.group || item.phase || '_default';
                
                if (!phaseMap.has(groupName)) {
                    phaseMap.set(groupName, 0);
                    orderedPhases.push(groupName);
                }
                
                phaseMap.set(groupName, phaseMap.get(groupName) + calculateLineAmount(item));
            });

            // Return as array of objects in order (excluding _default)
            return orderedPhases
                .filter(name => name !== '_default')
                .map(name => ({
                    name     : name,
                    subtotal : phaseMap.get(name)
                }));
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Totals
        // ------------------------------------------------------------
        function renderTotals(totals, currencySymbol, showVat, phaseSubtotals = []) {
            let html = `
                <div class="quote-totals">
            `;

            // Render per-phase subtotals first (if any)
            if (phaseSubtotals && phaseSubtotals.length > 0) {
                phaseSubtotals.forEach(phase => {
                    html += `
                    <div class="quote-totals__row quote-totals__row--phase">
                        <span>${phase.name}</span>
                        <span>${currencySymbol}${formatNumber(phase.subtotal)}</span>
                    </div>
                    `;
                });

                // Add separator line before subtotal
                html += `<hr style="border: none; border-top: 1px solid #ccc; margin: 0.5rem 0;">`;
            }

            // Overall subtotal
            html += `
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
                    <ul>
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
                    <button class="btn btn--sign-action btn--large" 
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

