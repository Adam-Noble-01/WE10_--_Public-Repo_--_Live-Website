// =============================================================================
// NOBLE ARCHITECTURE - INVOICE URL GENERATOR
// =============================================================================
//
// FILE       : InvoiceSystem__UrlGenerator__.js
// NAMESPACE  : NaProjectAdmin.InvoiceUrlGenerator
// MODULE     : InvoiceUrlGenerator
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Generates URLs to open specific invoices in the admin tool
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Builds URLs with correct query arguments for invoice deep-linking
// - Format: ?project=XX00&view=invoice&invoice=INV-XX00-2026-001
// - Used by ProjectVision notifications and editor tools
// - Generates invoice reference numbers (INV-{code}-{year}-{seq})
//
// -----
//
// DEVELOPMENT LOG:
// 14-Mar-2026 - Version 1.0.0
// - Initial Release
//
// =============================================================================

// #region -----
// MODULE | Invoice URL Generator
// -----

    (function() {
        'use strict';

        // FUNCTION | Build Invoice Url
        // ------------------------------------------------------------
        function buildInvoiceUrl(projectCode, invoiceRef, baseUrl) {
            const config  = window.NaProjectAdmin?.ConfigManager?.getConfig();
            const appBase = baseUrl ||
                            config?.AppConfig?.Paths?.coreAppBase ||
                            '/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/';

            const params = new URLSearchParams();
            params.set('project', projectCode);
            params.set('view', 'invoice');

            if (invoiceRef) {
                params.set('invoice', invoiceRef);
            }

            return `${appBase}?${params.toString()}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Full Invoice Url (Absolute)
        // ------------------------------------------------------------
        function buildFullInvoiceUrl(projectCode, invoiceRef) {
            const config  = window.NaProjectAdmin?.ConfigManager?.getConfig();
            const domain  = config?.appDomain || 'https://www.noble-architecture.com/';
            const appBase = config?.AppConfig?.Paths?.coreAppBase ||
                            '/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/';

            const fullBase = domain.replace(/\/$/, '') + appBase;
            return buildInvoiceUrl(projectCode, invoiceRef, fullBase);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Generate Invoice Ref
        // ------------------------------------------------------------
        function generateInvoiceRef(projectCode, year, sequence) {
            const yearStr = String(year || new Date().getFullYear());
            const seqStr  = String(sequence || 1).padStart(3, '0');

            return `INV-${projectCode}-${yearStr}-${seqStr}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Next Invoice Sequence
        // ------------------------------------------------------------
        function getNextSequence(existingInvoices, projectCode, year) {
            if (!existingInvoices || existingInvoices.length === 0) {
                return 1;
            }

            const yearStr = String(year || new Date().getFullYear());
            const prefix  = `INV-${projectCode}-${yearStr}-`;

            let maxSeq = 0;

            existingInvoices.forEach(inv => {
                if (inv.invoiceRef && inv.invoiceRef.startsWith(prefix)) {
                    const seqPart = inv.invoiceRef.substring(prefix.length);
                    const seqNum  = parseInt(seqPart, 10);
                    if (!isNaN(seqNum) && seqNum > maxSeq) {
                        maxSeq = seqNum;
                    }
                }
            });

            return maxSeq + 1;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse Invoice Ref from URL
        // ------------------------------------------------------------
        function getInvoiceRefFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return params.get('invoice') || null;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get View from URL
        // ------------------------------------------------------------
        function getViewFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return params.get('view') || null;
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};

        window.NaProjectAdmin.InvoiceUrlGenerator = {
            buildInvoiceUrl          : buildInvoiceUrl,
            buildFullInvoiceUrl      : buildFullInvoiceUrl,
            generateInvoiceRef       : generateInvoiceRef,
            getNextSequence          : getNextSequence,
            getInvoiceRefFromUrl     : getInvoiceRefFromUrl,
            getViewFromUrl           : getViewFromUrl
        };

        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('InvoiceUrlGenerator');
        }

    })();

// endregion -----
