// =============================================================================
// NOBLE ARCHITECTURE - INVOICE EMAIL HTML DOWNLOAD LOGIC
// =============================================================================
//
// FILE       : Distribution__ProjectInvoice__EmailLink__HtmlDownloadLogic__.js
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Generates and downloads a self-contained invoice email HTML file
// CREATED    : 14-Mar-2026
//
// DESCRIPTION:
// - Takes the email template HTML and invoice data
// - Parses the template, injects invoice values into DOM elements
// - Removes conditional rows when data is absent
// - Strips <script> tags and browser-only styles for email purity
// - Downloads the result as a clean, email-ready HTML file
//
// FILENAME FORMAT:
//   {ProjectCode}__Email__Invoice__{InvoiceRef}__{InvoiceDate}__.html
//   e.g. JS01__Email__Invoice__INV-JS01-2026-001__14-Mar-2026__.html
//
// =============================================================================

// #region -----
// MODULE | Invoice Email HTML Download
// -----

    (function () {
        'use strict';

        const DOMAIN   = 'https://www.noble-architecture.com';
        const APP_PATH = '/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/';

        // FUNCTION | Generate And Download Email
        // Receives template HTML string and invoice data object, produces a download.
        // ------------------------------------------------------------
        function generateAndDownload(templateHtml, data) {
            const parser = new DOMParser();
            const doc    = parser.parseFromString(templateHtml, 'text/html');

            injectValues(doc, data);
            removeConditionalRows(doc, data);
            setInvoiceLink(doc, data);
            stripScripts(doc);
            stripBodyStyles(doc);

            const cleanHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
            const filename  = buildFilename(data);

            downloadFile(cleanHtml, filename);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Inject Values
        // ------------------------------------------------------------
        function injectValues(doc, data) {
            setText(doc, 'invoiceRefDisplay',      data.ref       || '');
            setText(doc, 'invoiceDateDisplay',      data.date      || '');
            setText(doc, 'dueDateDisplay',          data.due       || '');
            setText(doc, 'projectAddressDisplay',   data.address   || '');
            setText(doc, 'personalNoteDisplay',     data.note      || '');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Remove Conditional Rows
        // ------------------------------------------------------------
        function removeConditionalRows(doc, data) {
            if (!data.address) {
                removeElement(doc, 'projectAddressRow');
            }
            if (!data.note) {
                removeElement(doc, 'personalNoteRow');
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Set Invoice Link
        // ------------------------------------------------------------
        function setInvoiceLink(doc, data) {
            const linkEl = doc.getElementById('invoiceLink');
            if (!linkEl) return;

            const params = new URLSearchParams();
            if (data.project) params.set('project', data.project);
            params.set('view', 'invoice');
            if (data.ref) params.set('invoice', data.ref);

            linkEl.setAttribute('href', DOMAIN + APP_PATH + '?' + params.toString());
        }
        // ---------------------------------------------------------------

        // FUNCTION | Strip Scripts
        // Removes all <script> tags so the download is pure email HTML.
        // ------------------------------------------------------------
        function stripScripts(doc) {
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(function (s) { s.remove(); });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Strip Body Styles
        // Removes the browser-preview body styles (background, flex centering)
        // and the <style> block in <head> since email clients ignore it anyway.
        // ------------------------------------------------------------
        function stripBodyStyles(doc) {
            var body = doc.body;
            if (body) {
                body.removeAttribute('style');
                body.style.margin  = '0';
                body.style.padding = '0';
            }

            var styles = doc.querySelectorAll('head style');
            styles.forEach(function (s) { s.remove(); });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Filename
        // Format: {ProjectCode}__Email__Invoice__{InvoiceRef}__{InvoiceDate}__.html
        // ------------------------------------------------------------
        function buildFilename(data) {
            var project = data.project || 'XX00';
            var ref     = data.ref     || 'DRAFT';
            var date    = data.date    || 'NoDate';

            return project + '__Email__Invoice__' + ref + '__' + date + '__.html';
        }
        // ---------------------------------------------------------------

        // FUNCTION | Download File
        // Creates a Blob and triggers a browser download via temporary anchor.
        // ------------------------------------------------------------
        function downloadFile(htmlContent, filename) {
            var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            var url  = URL.createObjectURL(blob);

            var anchor      = document.createElement('a');
            anchor.href     = url;
            anchor.download = filename;

            document.body.appendChild(anchor);
            anchor.click();

            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }
        // ---------------------------------------------------------------

        // FUNCTION | Set Text Content
        // ------------------------------------------------------------
        function setText(doc, elementId, text) {
            var el = doc.getElementById(elementId);
            if (el) el.textContent = text;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Remove Element
        // ------------------------------------------------------------
        function removeElement(doc, elementId) {
            var el = doc.getElementById(elementId);
            if (el) el.remove();
        }
        // ---------------------------------------------------------------

        // API EXPORT
        // ------------------------------------------------------------
        window.NaInvoiceEmailDownload = {
            generateAndDownload : generateAndDownload
        };

    })();

// endregion -----
