// =============================================================================
// NOBLE ARCHITECTURE - PROJECT VISION INVOICE NOTIFICATION
// =============================================================================
//
// FILE       : ProjectVision__InvoiceNotification__.js
// NAMESPACE  : NaProjectVision.InvoiceNotification
// PURPOSE    : Displays invoice due/overdue notifications on ProjectVision
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Fetches ProjectAdmin__Invoices__.json for the current project
// - Checks for unpaid invoices and calculates due/overdue status
// - Pre-due (0-7 days): dismissible toast overlay covering cards
// - Overdue (past 7 days): non-dismissible red warning blocking cards
// - Links directly to the invoice in the Project Admin tool
//
// =============================================================================

// #region -----
// MODULE | Invoice Notification
// -----

    (function() {
        'use strict';

        const MONTHS = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3,
            'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7,
            'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };

        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // FUNCTION | Initialise Notification System
        // ------------------------------------------------------------
        function initialise(context, projectData) {
            if (!context || !projectData) return;

            fetchInvoiceData(context, projectData)
                .then(invoicesData => {
                    if (invoicesData && invoicesData.invoices) {
                        processUnpaidInvoices(invoicesData.invoices, context, projectData);
                    }
                })
                .catch(err => {
                    console.log('[InvoiceNotification] Could not load invoice data:', err.message);
                });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Fetch Invoice Data
        // ------------------------------------------------------------
        async function fetchInvoiceData(context, projectData) {
            const projectFolder = context.projectFolder || projectData.projectFolder;
            const projectYear   = projectData.projectYear || context.projectYear;

            if (!projectFolder || !projectYear) return null;

            const portalBase  = resolvePortalBase(context);
            const invoicePath = `${portalBase}${projectYear}-Projects/${projectFolder}/10__ProjectAdmin__AppContent/ProjectAdmin__Invoices__.json`;

            try {
                const response = await fetch(invoicePath);
                if (!response.ok) return null;
                return await response.json();
            } catch (err) {
                return null;
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Resolve Portal Base URL
        // The projectPortalBase from UrlQuerySystem is relative to the appsBase
        // directory (e.g. "../na-project-portal" relative to "/na-apps/").
        // We resolve it against appsBase to get a correct absolute path.
        // ------------------------------------------------------------
        function resolvePortalBase(context) {
            const portalBase = context.projectPortalBase || '';

            if (portalBase.startsWith('http://') || portalBase.startsWith('https://')) {
                return portalBase.endsWith('/') ? portalBase : portalBase + '/';
            }

            const appsBase = context.appsBase || '..';
            const origin   = window.location.origin;

            let appsDir = appsBase;
            if (!appsBase.startsWith('http://') && !appsBase.startsWith('https://')) {
                const pathname = window.location.pathname;
                const pageDir  = pathname.substring(0, pathname.lastIndexOf('/') + 1);
                appsDir = new URL(appsBase, origin + pageDir).pathname;
            }

            if (!appsDir.endsWith('/')) appsDir += '/';

            const resolved = new URL(portalBase, origin + appsDir).pathname;
            return resolved.endsWith('/') ? resolved : resolved + '/';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Process Unpaid Invoices
        // ------------------------------------------------------------
        function processUnpaidInvoices(invoices, context, projectData) {
            const unpaid = invoices.filter(inv => inv.status !== 'paid');

            if (unpaid.length === 0) return;

            const mostUrgent = findMostUrgentInvoice(unpaid);
            if (!mostUrgent) return;

            const daysUntilDue = calculateDaysUntilDue(mostUrgent.dueDate);
            const adminUrl     = buildInvoiceAdminUrl(context, projectData, mostUrgent.invoiceRef);

            const cardGrid = document.getElementById('pvCardGrid');
            if (!cardGrid) return;

            cardGrid.style.position = 'relative';

            if (daysUntilDue < 0) {
                renderOverdueNotification(cardGrid, mostUrgent, Math.abs(daysUntilDue), adminUrl);
            } else {
                renderPreDueNotification(cardGrid, mostUrgent, daysUntilDue, adminUrl);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Find Most Urgent Invoice
        // ------------------------------------------------------------
        function findMostUrgentInvoice(unpaidInvoices) {
            let mostUrgent = null;
            let earliestDue = Infinity;

            unpaidInvoices.forEach(inv => {
                const dueDate = parseDateString(inv.dueDate);
                if (dueDate) {
                    const dueTime = dueDate.getTime();
                    if (dueTime < earliestDue) {
                        earliestDue = dueTime;
                        mostUrgent = inv;
                    }
                }
            });

            return mostUrgent;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Pre-Due Notification (Dismissible Toast)
        // ------------------------------------------------------------
        function renderPreDueNotification(container, invoice, daysRemaining, adminUrl) {
            const issuedFormatted = formatDateLong(invoice.invoiceDate);
            const dueFormatted    = formatDateLong(invoice.dueDate);
            const dayWord         = daysRemaining === 1 ? 'day' : 'days';

            const overlay = document.createElement('div');
            overlay.className = 'pv-invoice-toast';
            overlay.id        = 'pvInvoiceToast';

            overlay.innerHTML = `
                <div class="pv-invoice-toast__card">
                    <button class="pv-invoice-toast__close" id="pvInvoiceToastClose" title="Dismiss">&times;</button>
                    <div class="pv-invoice-toast__icon">&#128196;</div>
                    <div class="pv-invoice-toast__title">Invoice Pending Payment</div>
                    <div class="pv-invoice-toast__dates">
                        Issued: ${issuedFormatted}<br>
                        Payment Due: ${dueFormatted}
                    </div>
                    <div class="pv-invoice-toast__countdown">
                        ${daysRemaining} ${dayWord} remaining
                    </div>
                    <a href="${adminUrl}" class="pv-invoice-toast__link">View Invoice</a>
                    <div class="pv-invoice-password-reset">
                        If you have any issues with this invoice, please contact
                        <a href="mailto:Billing@Noble-Architecture.com">Billing@Noble-Architecture.com</a>
                    </div>
                </div>
            `;

            container.appendChild(overlay);

            const closeBtn = document.getElementById('pvInvoiceToastClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    overlay.remove();
                });
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Overdue Notification (Non-Dismissible)
        // ------------------------------------------------------------
        function renderOverdueNotification(container, invoice, daysOverdue, adminUrl) {
            const issuedFormatted = formatDateLong(invoice.invoiceDate);
            const dueFormatted    = formatDateLong(invoice.dueDate);
            const dayWord         = daysOverdue === 1 ? 'day' : 'days';

            const overlay = document.createElement('div');
            overlay.className = 'pv-invoice-overdue';
            overlay.id        = 'pvInvoiceOverdue';

            overlay.innerHTML = `
                <div class="pv-invoice-overdue__card">
                    <div class="pv-invoice-overdue__icon">&#9888;</div>
                    <div class="pv-invoice-overdue__title">Invoice Overdue</div>
                    <div class="pv-invoice-overdue__ref">${invoice.invoiceRef}</div>
                    <div class="pv-invoice-overdue__days">${daysOverdue} ${dayWord} past due</div>
                    <div class="pv-invoice-overdue__dates">
                        Issued: ${issuedFormatted}<br>
                        Was Due: ${dueFormatted}
                    </div>
                    <div class="pv-invoice-overdue__message">
                        Access to project tools is restricted until this invoice is settled.
                        Please arrange payment at your earliest convenience.
                    </div>
                    <a href="${adminUrl}" class="pv-invoice-overdue__link">Pay Invoice Now</a>
                    <div class="pv-invoice-password-reset">
                        If you have any issues with this invoice, please contact
                        <a href="mailto:Billing@Noble-Architecture.com">Billing@Noble-Architecture.com</a>
                    </div>
                </div>
            `;

            container.appendChild(overlay);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Invoice Admin URL
        // ------------------------------------------------------------
        function buildInvoiceAdminUrl(context, projectData, invoiceRef) {
            const appsBase    = context.appsBase;
            const projectCode = projectData.projectCode || context.projectCode;
            const adminPath   = '10__NaProjectAdmin__DocumentSystem__CoreAppCode/';

            const baseUrl = appsBase.endsWith('/')
                ? appsBase + adminPath
                : appsBase + '/' + adminPath;

            const params = new URLSearchParams();
            params.set('project', projectCode);
            params.set('view', 'invoice');
            if (invoiceRef) {
                params.set('invoice', invoiceRef);
            }

            return baseUrl + '?' + params.toString();
        }
        // ---------------------------------------------------------------

        // FUNCTION | Calculate Days Until Due
        // ------------------------------------------------------------
        function calculateDaysUntilDue(dueDateStr) {
            const dueDate = parseDateString(dueDateStr);
            if (!dueDate) return 0;

            const now = new Date();
            now.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            const diffMs = dueDate.getTime() - now.getTime();
            return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse Date String (DD-Mon-YYYY)
        // ------------------------------------------------------------
        function parseDateString(dateStr) {
            if (!dateStr) return null;

            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const day   = parseInt(parts[0], 10);
                const month = MONTHS[parts[1]];
                const year  = parseInt(parts[2], 10);

                if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }

            const fallback = new Date(dateStr);
            return isNaN(fallback.getTime()) ? null : fallback;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Date Long (e.g. "14th March 2026")
        // ------------------------------------------------------------
        function formatDateLong(dateStr) {
            const date = parseDateString(dateStr);
            if (!date) return dateStr || 'N/A';

            const day   = date.getDate();
            const month = MONTH_NAMES[date.getMonth()];
            const year  = date.getFullYear();

            const suffix = getOrdinalSuffix(day);

            return `${day}${suffix} ${month} ${year}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Ordinal Suffix
        // ------------------------------------------------------------
        function getOrdinalSuffix(day) {
            if (day >= 11 && day <= 13) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectVision = window.NaProjectVision || {};

        window.NaProjectVision.InvoiceNotification = {
            initialise               : initialise
        };

    })();

// endregion -----
