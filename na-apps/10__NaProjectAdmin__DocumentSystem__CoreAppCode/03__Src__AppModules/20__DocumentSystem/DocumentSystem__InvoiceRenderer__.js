// =============================================================================
// NOBLE ARCHITECTURE - INVOICE RENDERER
// =============================================================================
//
// FILE       : DocumentSystem__InvoiceRenderer__.js
// NAMESPACE  : NaProjectAdmin.InvoiceRenderer
// MODULE     : InvoiceRenderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Renders project invoices with line items, totals, and payment details
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Renders invoice data into professional HTML document
// - Reuses shared calculation logic from QuotationRenderer where possible
// - Handles line items with quantities, rates, and amounts
// - Calculates subtotals, VAT, and grand totals
// - Supports grouped/phased line items
// - Renders payment details card with bank transfer information
// - Fetches client PII from Cloudflare R2 (GDPR compliant)
// - Displays invoice status (unpaid/paid/overdue)
// - Shows password reset contact for forgotten credentials
//
// -----
//
// DEVELOPMENT LOG:
// 14-Mar-2026 - Version 1.0.0
// - Initial Release
//   - Invoice HTML rendering with shared na-doc styles
//   - Line item calculations (delegates to QuotationRenderer)
//   - Payment details card rendering
//   - Invoice status badge
//   - Standard note and password reset footer
//   - GDPR-compliant client data fetching from Cloudflare R2
//
// =============================================================================

// #region -----
// MODULE | Invoice Renderer
// -----

    (function() {
        'use strict';

        // FUNCTION | Render Invoice (Synchronous)
        // ------------------------------------------------------------
        function render(invoiceData, clientDataOverride, paymentDetails) {
            if (!invoiceData) {
                return renderEmptyState();
            }

            const config         = window.NaProjectAdmin.ConfigManager?.getConfig();
            const invoiceConfig  = config?.AppConfig?.Features?.InvoiceSystem;
            const companyDetails = config?.CompanyDetails;
            const projectCode   = window.NaProjectAdmin.App?.getCurrentProject();

            const currencySymbol = invoiceConfig?.currencySymbol || '£';
            const showVat        = invoiceData.totals?.vatApplicable === true;
            const vatRate        = invoiceData.totals?.vatRate ?? 0;

            // @delegate: ./DocumentSystem__QuotationRenderer__.js
            const QuotationRenderer = window.NaProjectAdmin.QuotationRenderer;
            const totals            = QuotationRenderer.calculateTotals(invoiceData.lineItems || [], vatRate, showVat);
            const phaseSubtotals    = calculatePhaseSubtotals(invoiceData.lineItems || []);

            const clientDetails = clientDataOverride || invoiceData.clientDetails || {};

            const statusHtml    = renderStatusBadge(invoiceData, invoiceConfig);
            const dueDateInfo   = renderDueDateInfo(invoiceData, invoiceConfig);

            let html = `
                <div class="na-doc">
                    ${renderHeader(invoiceData, companyDetails)}
                    ${statusHtml}
                    ${dueDateInfo}
                    ${renderAddresses(invoiceData, companyDetails, clientDetails)}
                    ${renderProjectDetails(invoiceData)}
                    ${renderLineItems(invoiceData.lineItems || [], currencySymbol)}
                    ${renderTotals(totals, currencySymbol, showVat, phaseSubtotals)}
                    <hr class="invoice-divider">
                    ${renderPaymentDetails(paymentDetails)}
                    ${renderNoteSection(invoiceData, invoiceConfig)}
                    ${renderPasswordResetFooter(invoiceConfig)}
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Invoice Async (GDPR Compliant)
        // ------------------------------------------------------------
        async function renderAsync(invoiceData) {
            if (!invoiceData) {
                return renderEmptyState();
            }

            let clientDetails = invoiceData.clientDetails || {};

            console.log('[InvoiceRenderer] Fetching client data from Cloudflare R2...');

            // @delegate: ./DocumentSystem__QuotationRenderer__.js
            const cloudflareClientData = await window.NaProjectAdmin.QuotationRenderer.fetchClientData();

            if (cloudflareClientData) {
                const formattedData = formatClientDataForDisplay(cloudflareClientData);
                clientDetails = {
                    ...clientDetails,
                    ...formattedData
                };
                console.log('[InvoiceRenderer] Client data loaded from secure storage');
            } else {
                console.warn('[InvoiceRenderer] Could not load client data from Cloudflare');
            }

            let paymentDetails = null;
            const PaymentFetcher = window.NaProjectAdmin.PaymentDetailsFetcher;
            if (PaymentFetcher) {
                console.log('[InvoiceRenderer] Fetching payment details...');
                paymentDetails = await PaymentFetcher.fetchAndDecrypt();
            }

            return render(invoiceData, clientDetails, paymentDetails);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Client Data for Display
        // ------------------------------------------------------------
        function formatClientDataForDisplay(cloudflareData) {
            if (!cloudflareData) return {};

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
            const assetLoader   = window.NaProjectAdmin.AssetLoader;

            const invoiceDate = data.invoiceDate
                ? dateFormatter?.formatLongWithOrdinal(data.invoiceDate) || data.invoiceDate
                : dateFormatter?.formatLongWithOrdinal(new Date()) || new Date().toLocaleDateString();

            const logoUrl = assetLoader?.getAssetUrl('GRAPHICS', 'NaBrandGraphic__CompanyLogo__w2048xh500px__.png') || '';

            return `
                <div class="na-doc__header">
                    <div>
                        <img src="${logoUrl}"
                             alt="${companyDetails?.companyName || 'Noble Architecture'}"
                             class="na-doc__logo">
                    </div>
                    <div class="na-doc__meta">
                        <h1 class="na-doc__title">Invoice</h1>
                        <p class="na-doc__ref">Ref: ${data.invoiceRef || 'N/A'}</p>
                        <p class="na-doc__ref">Date: ${invoiceDate}</p>
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Status Badge
        // ------------------------------------------------------------
        function renderStatusBadge(data, invoiceConfig) {
            const status  = data.status || 'unpaid';
            const dueDays = invoiceConfig?.dueDays || 7;

            let badgeClass = 'invoice-status-badge--unpaid';
            let badgeText  = 'Unpaid';

            if (status === 'paid') {
                badgeClass = 'invoice-status-badge--paid';
                badgeText  = 'Paid';
                if (data.paidDate) {
                    badgeText += ` - ${data.paidDate}`;
                }
            } else if (status === 'unpaid' && data.dueDate) {
                const daysOverdue = calculateDaysOverdue(data.dueDate);
                if (daysOverdue > 0) {
                    badgeClass = 'invoice-status-badge--overdue';
                    badgeText  = `Overdue - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past due`;
                }
            }

            return `
                <div style="margin-bottom: var(--App_SpacingLg); text-align: right;">
                    <span class="invoice-status-badge ${badgeClass}">${badgeText}</span>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Due Date Info
        // ------------------------------------------------------------
        function renderDueDateInfo(data, invoiceConfig) {
            if (data.status === 'paid') return '';

            const dueDays = invoiceConfig?.dueDays || 7;

            if (!data.invoiceDate || !data.dueDate) return '';

            const daysRemaining = calculateDaysUntilDue(data.dueDate);
            const dateFormatter = window.NaProjectAdmin.DateFormatter;

            const issuedFormatted = dateFormatter?.formatLongWithOrdinal(data.invoiceDate) || data.invoiceDate;
            const dueFormatted    = dateFormatter?.formatLongWithOrdinal(data.dueDate) || data.dueDate;

            if (daysRemaining >= 0) {
                return `
                    <div class="na-doc__section" style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: var(--App_SpacingMd) var(--App_SpacingLg);">
                        <p style="margin: 0; color: #856404; font-size: 0.9375rem;">
                            <strong>Payment Due:</strong> Issued ${issuedFormatted} &mdash; Due ${dueFormatted}
                            &mdash; <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining</strong>
                        </p>
                    </div>
                `;
            }

            const daysOverdue = Math.abs(daysRemaining);
            return `
                <div class="na-doc__section" style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 8px; padding: var(--App_SpacingMd) var(--App_SpacingLg);">
                    <p style="margin: 0; color: #721c24; font-size: 0.9375rem;">
                        <strong>OVERDUE:</strong> This invoice was due ${dueFormatted} and is
                        <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past due</strong>.
                        Please arrange payment immediately.
                    </p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Addresses
        // ------------------------------------------------------------
        function renderAddresses(data, companyDetails, clientDetails) {
            const client = clientDetails || data.clientDetails || {};

            return `
                <div class="na-doc__section na-doc__addresses">
                    <div class="address-block">
                        <div class="na-doc-address__title">From</div>
                        <div class="na-doc-address__content">
                            <strong>${companyDetails?.companyName || 'Noble Architecture'}</strong><br>
                            ${companyDetails?.companyAddress || 'Nottingham, UK'}<br>
                            ${companyDetails?.companyEmail || ''}
                        </div>
                    </div>
                    <div class="address-block">
                        <div class="na-doc-address__title">To</div>
                        <div class="na-doc-address__content">
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
                <div class="na-doc__section">
                    <h2 class="na-doc__section-title">Project Details</h2>
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
                    <div class="na-doc__section">
                        <h2 class="na-doc__section-title">Invoice Items</h2>
                        <p style="color: var(--App_TextMuted);">No line items specified.</p>
                    </div>
                `;
            }

            // @delegate: ./DocumentSystem__QuotationRenderer__.js
            const QuotationRenderer = window.NaProjectAdmin.QuotationRenderer;
            const { orderedGroups, groupMap } = groupLineItems(lineItems);

            let html = `
                <div class="na-doc__section">
                    <h2 class="na-doc__section-title">Invoice Items</h2>
                    <table class="na-doc-table">
                        <thead>
                            <tr>
                                <th class="na-doc-table__description">Description</th>
                                <th class="na-doc-table__qty">Qty</th>
                                <th class="na-doc-table__unit">Unit</th>
                                <th class="na-doc-table__rate">Rate</th>
                                <th class="na-doc-table__amount">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            orderedGroups.forEach(groupName => {
                const items = groupMap.get(groupName);

                if (groupName !== '_default') {
                    html += `
                        <tr class="na-doc-table__group-header">
                            <td colspan="5">${groupName}</td>
                        </tr>
                    `;
                }

                let phaseSubtotal = 0;

                items.forEach(item => {
                    const amount = QuotationRenderer.calculateLineAmount(item);
                    phaseSubtotal += amount;

                    const displayQty = item.quantity !== undefined ? item.quantity : 1;
                    const secondaryDescription = typeof item.itemDescription === 'string'
                        ? item.itemDescription.trim()
                        : '';

                    html += `
                        <tr>
                            <td class="na-doc-table__description">
                                <div class="na-doc-table__description-main">${item.description || ''}</div>
                                ${secondaryDescription ? `<div class="na-doc-table__description-secondary">${secondaryDescription}</div>` : ''}
                            </td>
                            <td class="na-doc-table__qty">${displayQty}</td>
                            <td class="na-doc-table__unit">${item.unit || '-'}</td>
                            <td class="na-doc-table__rate">${currencySymbol}${QuotationRenderer.formatNumber(item.rate || 0)}</td>
                            <td class="na-doc-table__amount">${currencySymbol}${QuotationRenderer.formatNumber(amount)}</td>
                        </tr>
                    `;
                });

                if (groupName !== '_default' && items.length > 0) {
                    html += `
                        <tr class="quote-table__phase-subtotal">
                            <td colspan="4"></td>
                            <td class="na-doc-table__amount" style="font-weight: 600; border-top: 1px solid #ddd;">
                                ${currencySymbol}${QuotationRenderer.formatNumber(phaseSubtotal)}
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
        function groupLineItems(lineItems) {
            const orderedGroups = [];
            const groupMap      = new Map();

            lineItems.forEach(item => {
                const groupName = item.group || item.phase || '_default';

                if (!groupMap.has(groupName)) {
                    groupMap.set(groupName, []);
                    orderedGroups.push(groupName);
                }

                groupMap.get(groupName).push(item);
            });

            return { orderedGroups, groupMap };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Phase Subtotals
        // ------------------------------------------------------------
        function calculatePhaseSubtotals(lineItems) {
            const QuotationRenderer = window.NaProjectAdmin.QuotationRenderer;
            const orderedPhases     = [];
            const phaseMap          = new Map();

            lineItems.forEach(item => {
                const groupName = item.group || item.phase || '_default';

                if (!phaseMap.has(groupName)) {
                    phaseMap.set(groupName, 0);
                    orderedPhases.push(groupName);
                }

                phaseMap.set(groupName, phaseMap.get(groupName) + QuotationRenderer.calculateLineAmount(item));
            });

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
        function renderTotals(totals, currencySymbol, showVat, phaseSubtotals) {
            const formatNumber = window.NaProjectAdmin.QuotationRenderer.formatNumber;

            let html = `<div class="na-doc-totals">`;

            if (phaseSubtotals && phaseSubtotals.length > 0) {
                phaseSubtotals.forEach(phase => {
                    html += `
                    <div class="na-doc-totals__row na-doc-totals__row--phase">
                        <span>${phase.name}</span>
                        <span>${currencySymbol}${formatNumber(phase.subtotal)}</span>
                    </div>
                    `;
                });

                html += `<hr style="border: none; border-top: 1px solid #ccc; margin: 0.5rem 0;">`;
            }

            html += `
                    <div class="na-doc-totals__row">
                        <span>Subtotal</span>
                        <span>${currencySymbol}${formatNumber(totals.subtotal)}</span>
                    </div>
            `;

            if (showVat && totals.vatRate > 0) {
                html += `
                    <div class="na-doc-totals__row">
                        <span>VAT (${totals.vatRate}%)</span>
                        <span>${currencySymbol}${formatNumber(totals.vat)}</span>
                    </div>
                `;
            }

            html += `
                    <div class="na-doc-totals__row na-doc-totals__row--grand">
                        <span>Total Due</span>
                        <span>${currencySymbol}${formatNumber(totals.grandTotal)}</span>
                    </div>
                </div>
            `;

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Payment Details
        // ------------------------------------------------------------
        function renderPaymentDetails(paymentDetails) {
            if (!paymentDetails || !paymentDetails.paymentMethods) {
                return `
                    <div class="na-doc__section">
                        <h2 class="na-doc__section-title">Payment Details</h2>
                        <p style="color: var(--App_TextMuted);">Payment details could not be loaded.</p>
                    </div>
                `;
            }

            const enabledMethods = paymentDetails.paymentMethods.filter(m => m.enabled);

            if (enabledMethods.length === 0) {
                return '';
            }

            let html = '';

            enabledMethods.forEach(method => {
                if (method.type === 'bank-transfer') {
                    html += renderBankTransferCard(method);
                }
            });

            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Bank Transfer Card
        // ------------------------------------------------------------
        function renderBankTransferCard(method) {
            const details = method.details || {};

            return `
                <div class="invoice-payment-card">
                    <div class="invoice-payment-card__title">Payment Details</div>
                    <div class="invoice-payment-card__method-label">${method.label || 'Bank Transfer'}</div>
                    ${details.accountName ? `
                        <div class="invoice-payment-card__detail">
                            <span class="invoice-payment-card__label">Account Name</span>
                            <span class="invoice-payment-card__value">${details.accountName}</span>
                        </div>
                    ` : ''}
                    ${details.sortCode ? `
                        <div class="invoice-payment-card__detail">
                            <span class="invoice-payment-card__label">Sort Code</span>
                            <span class="invoice-payment-card__value">${details.sortCode}</span>
                        </div>
                    ` : ''}
                    ${details.accountNumber ? `
                        <div class="invoice-payment-card__detail">
                            <span class="invoice-payment-card__label">Account Number</span>
                            <span class="invoice-payment-card__value">${details.accountNumber}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Note Section
        // ------------------------------------------------------------
        function renderNoteSection(data, invoiceConfig) {
            const personalNote = data.personalNote || '';
            const standardNote = invoiceConfig?.standardNote ||
                'Thank you for your business. We hope you are satisfied with the service received from Noble Architecture.';

            const noteText = personalNote || standardNote;

            return `
                <div class="invoice-note-section">
                    <p class="invoice-note-section__text">${noteText}</p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Password Reset Footer
        // ------------------------------------------------------------
        function renderPasswordResetFooter(invoiceConfig) {
            const email     = invoiceConfig?.passwordResetEmail || 'Billing@Noble-Architecture.com';
            const noteText  = invoiceConfig?.passwordResetNote ||
                'If you have forgotten your password to access this invoice, please contact';

            return `
                <div class="invoice-password-reset">
                    <p>${noteText}
                        <a href="mailto:${email}" class="invoice-password-reset__link">${email}</a>
                    </p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Days Until Due
        // ------------------------------------------------------------
        function calculateDaysUntilDue(dueDateStr) {
            const dueDate = parseDateString(dueDateStr);
            if (!dueDate) return 0;

            const now  = new Date();
            now.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            const diffMs = dueDate.getTime() - now.getTime();
            return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Days Overdue
        // ------------------------------------------------------------
        function calculateDaysOverdue(dueDateStr) {
            const remaining = calculateDaysUntilDue(dueDateStr);
            return remaining < 0 ? Math.abs(remaining) : 0;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse Date String (DD-Mon-YYYY)
        // ------------------------------------------------------------
        function parseDateString(dateStr) {
            if (!dateStr) return null;

            if (dateStr instanceof Date) return dateStr;

            const months = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3,
                'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7,
                'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };

            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const day   = parseInt(parts[0], 10);
                const month = months[parts[1]];
                const year  = parseInt(parts[2], 10);

                if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }

            const fallback = new Date(dateStr);
            return isNaN(fallback.getTime()) ? null : fallback;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Empty State
        // ------------------------------------------------------------
        function renderEmptyState() {
            return `
                <div class="na-doc" style="text-align: center; padding: 3rem;">
                    <h2>No Invoice Data</h2>
                    <p style="color: var(--App_TextSecondary);">
                        Invoice data could not be loaded or has not been created yet.
                    </p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};

        window.NaProjectAdmin.InvoiceRenderer = {
            render                   : render,
            renderAsync              : renderAsync,
            calculateDaysUntilDue    : calculateDaysUntilDue,
            calculateDaysOverdue     : calculateDaysOverdue,
            parseDateString          : parseDateString
        };

        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('InvoiceRenderer');
        }

    })();

// endregion -----
