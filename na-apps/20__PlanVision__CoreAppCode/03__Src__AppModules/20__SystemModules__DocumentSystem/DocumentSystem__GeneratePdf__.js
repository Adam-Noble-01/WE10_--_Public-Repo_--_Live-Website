// =============================================================================
// NOBLE ARCHITECTURE - DOCUMENT SYSTEM - PDF GENERATOR
// =============================================================================
//
// FILE       : DocumentSystem__GeneratePdf__.js
// NAMESPACE  : NaPlanVision.DocumentSystem.PdfGenerator
// MODULE     : PdfGenerator
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : PDF download link management for architectural drawings
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Manages PDF download button functionality
// - Configures download links dynamically based on drawing metadata
// - Handles programmatic PDF downloads
// - Sanitizes filenames for cross-platform compatibility
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Extracted from DrawingsCanvas__DrawingLoader__.js
// - Centralized PDF download logic into dedicated module
// - Applied three-part naming convention (Na__Pdf__FunctionName)
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Document System - PDF Generator
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Module References
        // --------------------------------------------------------

            let downloadButtonId = 'downloadPDFBtn';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize PDF Generator Module
            // ------------------------------------------------------------
            const Na__Pdf__Initialize = function (config) {
                console.log('[PdfGenerator] Initializing...');

                if (config && config.downloadButtonId) {
                    downloadButtonId = config.downloadButtonId;
                }

                console.log('[PdfGenerator] Initialized successfully');
                console.log('[PdfGenerator] Download button ID:', downloadButtonId);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PDF DOWNLOAD | Link Management
        // --------------------------------------------------------

            // FUNCTION | Update PDF Download Button Link
            // ------------------------------------------------------------
            // Configures the download button with PDF URL and document name
            // Creates a temporary anchor element to trigger download
            // ------------------------------------------------------------
            const Na__Pdf__UpdateDownloadLink = function (pdfUrl, documentName) {
                const downloadBtn = document.getElementById(downloadButtonId);
                
                if (!downloadBtn) {
                    console.warn('[PdfGenerator] Download button not found:', downloadButtonId);
                    return;
                }

                downloadBtn.onclick = () => {
                    Na__Pdf__TriggerDownload(pdfUrl, documentName);
                };

                console.log('[PdfGenerator] Download link updated:', pdfUrl);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Trigger PDF Download
            // ------------------------------------------------------------
            // Programmatically triggers PDF download using anchor element
            // Sanitizes filename by replacing spaces with hyphens
            // ------------------------------------------------------------
            const Na__Pdf__TriggerDownload = function (pdfUrl, documentName) {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = Na__Pdf__SanitizeFilename(documentName) + '.pdf';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('[PdfGenerator] PDF download initiated:', documentName);
            };
            // ---------------------------------------------------------------

            // FUNCTION | Sanitize Filename
            // ------------------------------------------------------------
            // Replaces spaces with hyphens for cross-platform compatibility
            // ------------------------------------------------------------
            function Na__Pdf__SanitizeFilename(filename) {
                return filename.replace(/ /g, '-');
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.DocumentSystem = window.NaPlanVision.DocumentSystem || {};
            window.NaPlanVision.DocumentSystem.PdfGenerator = {
                Na__Pdf__Initialize         : Na__Pdf__Initialize,
                Na__Pdf__UpdateDownloadLink : Na__Pdf__UpdateDownloadLink,
                Na__Pdf__TriggerDownload    : Na__Pdf__TriggerDownload
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('PdfGenerator');
            }

            console.log('[PdfGenerator] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
