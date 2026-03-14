// =============================================================================
// NOBLE ARCHITECTURE - INVOICE EMAIL INJECTION LOGIC
// =============================================================================
//
// FILE       : Distribution__ProjectInvoice__EmailLink__InjectionLogic__.js
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Populates the invoice email template from URL query parameters
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Reads invoice data passed as URL query parameters
// - Injects values into the email template DOM elements
// - Hides optional sections when data is not provided
// - Builds the invoice deep-link URL for the CTA button
//
// QUERY PARAMETERS:
//   ref             - Invoice reference (e.g. INV-JS01-2026-001)
//   date            - Invoice date (DD-Mon-YYYY)
//   due             - Due date (DD-Mon-YYYY)
//   project         - Project code (e.g. JS01)
//   address         - Project address
//   note            - Personal note text
//
// =============================================================================

(function () {
    'use strict';

    const DOMAIN   = 'https://www.noble-architecture.com';
    const APP_PATH = '/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/';

    // FUNCTION | Initialise
    // ------------------------------------------------------------
    function initialise() {
        const params = new URLSearchParams(window.location.search);

        const ref          = params.get('ref')          || '';
        const date         = params.get('date')         || '';
        const due          = params.get('due')          || '';
        const projectCode  = params.get('project')      || '';
        const address      = params.get('address')      || '';
        const note         = params.get('note')         || '';

        injectText('invoiceRefDisplay',   ref);
        injectText('invoiceDateDisplay',  date);
        injectText('dueDateDisplay',      due);

        if (address) {
            injectText('projectAddressDisplay', address);
        } else {
            hideElement('projectAddressRow');
        }

        if (note) {
            injectText('personalNoteDisplay', note);
        } else {
            hideElement('personalNoteRow');
        }

        const invoiceUrl = buildInvoiceUrl(projectCode, ref);
        const linkEl = document.getElementById('invoiceLink');
        if (linkEl) {
            linkEl.setAttribute('href', invoiceUrl);
        }

        document.title = 'Invoice ' + ref + ' - Noble Architecture';
    }
    // ---------------------------------------------------------------

    // FUNCTION | Build Invoice URL
    // ------------------------------------------------------------
    function buildInvoiceUrl(projectCode, invoiceRef) {
        const params = new URLSearchParams();
        if (projectCode) params.set('project', projectCode);
        params.set('view', 'invoice');
        if (invoiceRef)  params.set('invoice', invoiceRef);

        return DOMAIN + APP_PATH + '?' + params.toString();
    }
    // ---------------------------------------------------------------

    // FUNCTION | Inject Text Content
    // ------------------------------------------------------------
    function injectText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = text;
    }
    // ---------------------------------------------------------------

    // FUNCTION | Hide Element
    // ------------------------------------------------------------
    function hideElement(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.style.display = 'none';
    }
    // ---------------------------------------------------------------

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise);
    } else {
        initialise();
    }

})();
