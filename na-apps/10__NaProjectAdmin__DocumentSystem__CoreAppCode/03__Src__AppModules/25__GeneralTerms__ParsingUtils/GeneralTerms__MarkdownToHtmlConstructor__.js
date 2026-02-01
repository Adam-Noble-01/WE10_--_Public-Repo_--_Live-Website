// =============================================================================
// NOBLE ARCHITECTURE - PDF GENERATOR
// =============================================================================
//
// FILE       : DocumentSystem__GeneratePdf__.js
// NAMESPACE  : NaProjectAdmin.PdfGenerator
// MODULE     : PdfGenerator
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Generates pageless PDFs from displayed documents
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Captures currently displayed document and converts to PDF
// - Uses html2pdf.js for client-side PDF generation
// - Produces A4-width, pageless (endless scrolling) PDFs
// - Automatically names files based on document type and project
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.3
// - Bug Fixes
//   - Added timeout protection to prevent infinite freeze
//   - Added DOM settling delay before capture
//   - Improved image handling for cross-origin assets
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Pageless PDF generation
//   - A4 width formatting
//   - Dynamic filename generation
//
// =============================================================================

// #region -----
// MODULE | PDF Generator
// -----

    (function() {
        'use strict';

        // CONSTANTS | PDF Configuration
        // ------------------------------------------------------------
        const A4_WIDTH_MM            = 210;                             // <-- A4 width in millimetres
        const PDF_MARGIN_MM          = 10;                              // <-- Margin in millimetres
        const IMAGE_QUALITY          = 0.95;                            // <-- JPEG quality (0-1)
        const CANVAS_SCALE           = 2;                               // <-- Rendering scale factor
        const GENERATION_TIMEOUT_MS  = 30000;                           // <-- 30 second timeout
        const DOM_SETTLE_DELAY_MS    = 100;                             // <-- Delay for DOM to settle

        // FUNCTION | Generate PDF
        // ------------------------------------------------------------
        function generatePdf() {
            console.log('[PdfGenerator] Starting PDF generation...');

            // Check if html2pdf is available
            if (typeof html2pdf === 'undefined') {
                console.error('[PdfGenerator] html2pdf.js library not loaded');
                showError('PDF generation library not available. Please refresh the page.');
                return Promise.resolve();
            }

            console.log('[PdfGenerator] html2pdf library found');

            // Get the document container
            const documentContainer = document.getElementById('document-container');
            if (!documentContainer) {
                console.error('[PdfGenerator] Document container not found');
                showError('No document to export.');
                return Promise.resolve();
            }

            // Get the actual document element within the container
            const documentElement = documentContainer.querySelector('.document');
            if (!documentElement) {
                console.error('[PdfGenerator] No document element found');
                showError('No document content to export.');
                return Promise.resolve();
            }

            console.log('[PdfGenerator] Document element found');

            // Get document info for filename
            const docInfo = getDocumentInfo();
            const filename = buildFilename(docInfo);

            console.log(`[PdfGenerator] Generating PDF: ${filename}`);

            // Show loading state
            showLoadingOverlay('Generating PDF...');

            // Return promise for proper async handling
            return new Promise((resolve) => {
                // Small delay to let DOM settle after any menu animations
                setTimeout(() => {
                    performPdfGeneration(documentElement, filename, resolve);
                }, DOM_SETTLE_DELAY_MS);
            });
        }
        // ---------------------------------------------------------------

        // FUNCTION | Perform PDF Generation
        // ------------------------------------------------------------
        function performPdfGeneration(documentElement, filename, resolve) {
            // Get content dimensions
            const contentHeightPx = documentElement.scrollHeight || documentElement.offsetHeight;
            const contentWidthPx = documentElement.scrollWidth || documentElement.offsetWidth;
            
            // Convert px to mm (1px ≈ 0.264583mm at 96 DPI)
            const pxToMm = 0.264583;
            const contentHeightMm = contentHeightPx * pxToMm;
            
            // Total page height = content height + margins
            const totalHeightMm = Math.max(Math.ceil(contentHeightMm + (PDF_MARGIN_MM * 2)), 297);
            
            console.log(`[PdfGenerator] Content: ${contentWidthPx}x${contentHeightPx}px`);
            console.log(`[PdfGenerator] PDF page: ${A4_WIDTH_MM}x${totalHeightMm}mm`);

            // Configure html2pdf options
            const options = {
                margin                   : PDF_MARGIN_MM,
                filename                 : filename,
                image                    : { 
                    type                 : 'jpeg', 
                    quality              : IMAGE_QUALITY 
                },
                html2canvas              : { 
                    scale                : CANVAS_SCALE,
                    useCORS              : true,
                    allowTaint           : true,
                    logging              : false,
                    backgroundColor      : '#ffffff',
                    imageTimeout         : 15000,                   // <-- 15s timeout for images
                    removeContainer      : true
                },
                jsPDF                    : { 
                    unit                 : 'mm', 
                    format               : [A4_WIDTH_MM, totalHeightMm],
                    orientation          : 'portrait',
                    compress             : true
                },
                pagebreak                : { 
                    mode                 : ['avoid-all', 'css', 'legacy']
                }
            };

            console.log('[PdfGenerator] Starting html2pdf conversion...');

            // Set up timeout protection
            let timeoutId = setTimeout(() => {
                console.error('[PdfGenerator] PDF generation timed out');
                hideLoadingOverlay();
                showError('PDF generation timed out. The document may be too large or complex.');
                resolve();
            }, GENERATION_TIMEOUT_MS);

            // Perform the PDF generation
            try {
                html2pdf()
                    .set(options)
                    .from(documentElement)
                    .save()
                    .then(() => {
                        clearTimeout(timeoutId);
                        console.log('[PdfGenerator] PDF generated successfully');
                        hideLoadingOverlay();
                        resolve();
                    })
                    .catch((error) => {
                        clearTimeout(timeoutId);
                        console.error('[PdfGenerator] PDF generation failed:', error);
                        hideLoadingOverlay();
                        showError('Failed to generate PDF: ' + (error.message || 'Unknown error'));
                        resolve();
                    });
            } catch (error) {
                clearTimeout(timeoutId);
                console.error('[PdfGenerator] PDF setup error:', error);
                hideLoadingOverlay();
                showError('Failed to initialise PDF generation: ' + (error.message || 'Unknown error'));
                resolve();
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Get Document Info
        // ------------------------------------------------------------
        function getDocumentInfo() {
            const currentView = window.NaProjectAdmin.UserInterfaceMain?.getCurrentView();
            const projectCode = window.NaProjectAdmin.App?.getCurrentProject();
            const projectConfig = window.NaProjectAdmin.App?.getProjectConfig();

            let documentType = 'Document';

            switch (currentView) {
                case 'quotation':
                    documentType = 'Quotation';
                    break;
                case 'terms':
                    documentType = 'Terms';
                    break;
                case 'signatures':
                    documentType = 'SignatureStatus';
                    break;
                default:
                    documentType = 'Document';
            }

            return {
                type                     : documentType,
                projectCode              : projectCode || 'NA',
                projectName              : projectConfig?.projectName || projectCode || 'Project'
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Build Filename
        // ------------------------------------------------------------
        function buildFilename(docInfo) {
            const dateFormatter = window.NaProjectAdmin.DateFormatter;
            const dateStr = dateFormatter?.formatUK(new Date()) || formatDateFallback(new Date());
            
            // Format: NA_Quotation_JH03_31-Jan-2026.pdf
            const filename = `NA_${docInfo.type}_${docInfo.projectCode}_${dateStr}.pdf`;
            
            // Sanitise filename (remove invalid characters)
            return filename.replace(/[<>:"/\\|?*]/g, '_');
        }
        // ---------------------------------------------------------------

        // FUNCTION | Format Date Fallback
        // ------------------------------------------------------------
        function formatDateFallback(date) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = date.getDate().toString().padStart(2, '0');
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Loading Overlay
        // ------------------------------------------------------------
        function showLoadingOverlay(message) {
            // Check if overlay already exists
            let overlay = document.getElementById('pdf-loading-overlay');
            
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'pdf-loading-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                `;
                
                overlay.innerHTML = `
                    <div style="
                        background: white;
                        padding: 2rem 3rem;
                        border-radius: 8px;
                        text-align: center;
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            border: 4px solid #e0ddd8;
                            border-top-color: #555041;
                            border-radius: 50%;
                            animation: pdfSpinner 1s linear infinite;
                            margin: 0 auto 1rem;
                        "></div>
                        <p id="pdf-loading-message" style="
                            color: #333;
                            font-size: 1rem;
                            margin: 0;
                        ">${message}</p>
                    </div>
                    <style>
                        @keyframes pdfSpinner {
                            to { transform: rotate(360deg); }
                        }
                    </style>
                `;
                
                document.body.appendChild(overlay);
            } else {
                const messageEl = overlay.querySelector('#pdf-loading-message');
                if (messageEl) {
                    messageEl.textContent = message;
                }
                overlay.style.display = 'flex';
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Hide Loading Overlay
        // ------------------------------------------------------------
        function hideLoadingOverlay() {
            const overlay = document.getElementById('pdf-loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Show Error
        // ------------------------------------------------------------
        function showError(message) {
            hideLoadingOverlay();
            
            // Use modal manager if available
            if (window.NaProjectAdmin.ModalManager?.show) {
                window.NaProjectAdmin.ModalManager.show({
                    title                    : 'PDF Generation Error',
                    content                  : `<p>${message}</p>`,
                    buttons                  : [
                        {
                            text             : 'OK',
                            primary          : true,
                            action           : 'close'
                        }
                    ]
                });
            } else {
                // Fallback to alert
                alert(message);
            }
        }
        // ---------------------------------------------------------------

        // FUNCTION | Check Library Loaded
        // ------------------------------------------------------------
        function isLibraryLoaded() {
            return typeof html2pdf !== 'undefined';
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.PdfGenerator = {
            generatePdf              : generatePdf,
            isLibraryLoaded          : isLibraryLoaded,
            getDocumentInfo          : getDocumentInfo
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('PdfGenerator');
        }

        console.log('[PdfGenerator] Module loaded');

    })();

// endregion -----
