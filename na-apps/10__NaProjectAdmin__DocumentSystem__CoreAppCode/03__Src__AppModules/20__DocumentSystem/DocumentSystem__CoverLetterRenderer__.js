// =============================================================================
// NOBLE ARCHITECTURE - COVER LETTER RENDERER
// =============================================================================
//
// FILE       : DocumentSystem__CoverLetterRenderer__.js
// NAMESPACE  : NaProjectAdmin.CoverLetterRenderer
// MODULE     : CoverLetterRenderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Renders personalised cover letter as landing page after auth
// CREATED    : 01-Feb-2026
//
// DESCRIPTION:
// - Renders a personalised cover letter welcoming the client
// - Fetches client PII from Cloudflare R2 (GDPR compliant)
// - Displays project description and navigation instructions
// - Includes email signature graphic
// - Highlights special terms and platform usage guidance
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.0.0
// - Initial Release
//   - Async client data fetching from Cloudflare R2
//   - Dynamic date formatting with ordinals
//   - Navigation guide with special terms highlight
//   - Email signature graphic integration
//
// =============================================================================

// #region -----
// MODULE | Cover Letter Renderer
// -----

    (function() {
        'use strict';

        // FUNCTION | Render Cover Letter Async
        // ------------------------------------------------------------
        /**
         * Render cover letter with client data fetched from Cloudflare R2
         * @param {Object} projectConfig - Project configuration data
         * @param {Object} quotationData - Quotation data (for date sync)
         * @returns {Promise<string>} Rendered HTML
         */
        async function renderAsync(projectConfig, quotationData = null) {
            if (!projectConfig) {
                return renderEmptyState();
            }

            const config = window.NaProjectAdmin.ConfigManager?.getConfig();
            const companyDetails = config?.CompanyDetails;

            // Fetch client data from Cloudflare R2
            let clientDetails = {};
            console.log('[CoverLetterRenderer] Fetching client data from Cloudflare R2...');
            
            const cloudflareClientData = await fetchClientDataFromCloudflare();
            
            if (cloudflareClientData) {
                clientDetails = formatClientDataForDisplay(cloudflareClientData);
                console.log('[CoverLetterRenderer] Client data loaded from secure storage');
            } else {
                console.warn('[CoverLetterRenderer] Could not load client data from Cloudflare');
                // Fallback to project config if available
                clientDetails = {
                    name     : projectConfig.clientName || 'Valued Client',
                    address  : ''
                };
            }

            // Build the cover letter HTML
            let html = `
                <div class="document cover-letter">
                    ${renderHeader(projectConfig, companyDetails, quotationData)}
                    ${renderGreeting(clientDetails)}
                    ${renderBody(projectConfig)}
                    ${renderDetailedBrief(projectConfig)}
                    ${renderNavigationGuide()}
                    ${renderSignature(companyDetails)}
                </div>
            `;

            return html;
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
                    console.warn('[CoverLetterRenderer] App or ApiClient not available');
                    return null;
                }

                const projectCode = App.getCurrentProject();
                
                if (!projectCode) {
                    console.warn('[CoverLetterRenderer] No project code available');
                    return null;
                }

                // Get session token from App
                let sessionToken = App.getSessionToken?.();

                // Fallback: generate token if App.getSessionToken not available
                if (!sessionToken && App.isAuthenticated?.()) {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(2);
                    sessionToken = btoa(`${projectCode}:${timestamp}:${random}`);
                    console.log('[CoverLetterRenderer] Generated fallback session token');
                }

                if (!sessionToken) {
                    console.warn('[CoverLetterRenderer] No session token available');
                    return null;
                }

                // Retrieve client data from Cloudflare R2
                const result = await ApiClient.retrieveClientData(projectCode, sessionToken);

                if (result && result.success === true) {
                    console.log('[CoverLetterRenderer] Client data retrieved from Cloudflare');
                    return result.data;
                }

                if (result?.error) {
                    console.warn('[CoverLetterRenderer] Cloudflare returned error:', result.error);
                }

                return null;

            } catch (error) {
                console.error('[CoverLetterRenderer] Failed to fetch client data:', error);
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

            // Format client address as multi-line string
            const addr = cloudflareData.clientAddress || {};
            const addressLines = [];
            
            if (addr.houseNameNo && addr.street) {
                addressLines.push(`${addr.houseNameNo} ${addr.street}`);
            } else if (addr.houseNameNo) {
                addressLines.push(addr.houseNameNo);
            } else if (addr.street) {
                addressLines.push(addr.street);
            }
            
            if (addr.district) addressLines.push(addr.district);
            if (addr.county) addressLines.push(addr.county);
            if (addr.postcode) addressLines.push(addr.postcode);

            return {
                name             : cloudflareData.clientName || 'Valued Client',
                address          : addressLines.join('<br>'),
                email            : cloudflareData.clientEmail || '',
                phone            : cloudflareData.clientPhone || ''
            };
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Header (Matches Quotation Style)
        // ------------------------------------------------------------
        function renderHeader(projectConfig, companyDetails, quotationData = null) {
            const dateFormatter = window.NaProjectAdmin.DateFormatter;
            const assetLoader = window.NaProjectAdmin.AssetLoader;
            const logoUrl = assetLoader?.getAssetUrl('GRAPHICS', 'NaBrandGraphic__CompanyLogo__w2048xh500px__.png') || '';
            
            // Generate cover letter reference number (similar to quotation ref)
            const projectCode = projectConfig?.projectCode || 'XX00';
            const year = new Date().getFullYear();
            const coverLetterRef = `WEL-${projectCode}-${year}-001`;
            
            // Use quotationDate from quotation data to sync with quote (same logic as QuotationRenderer)
            const quotationDate = quotationData?.quotationDate 
                ? dateFormatter?.formatLongWithOrdinal(quotationData.quotationDate) || quotationData.quotationDate
                : dateFormatter?.formatLongWithOrdinal(new Date()) || new Date().toLocaleDateString();
            
            const projectName = projectConfig?.projectName || 'Your Project';

            return `
                <div class="document__header">
                    <div>
                        <img src="${logoUrl}" 
                             alt="${companyDetails?.companyName || 'Noble Architecture'}" 
                             class="document__logo">
                        <p class="cover-letter__subject" style="margin-top: 1rem;"><strong>RE: ${projectName} &ndash; Design Services Enquiry</strong></p>
                    </div>
                    <div class="document__meta">
                        <h1 class="document__title">Enquiry Letter</h1>
                        <p class="document__ref">Ref: ${coverLetterRef}</p>
                        <p class="document__ref">Date: ${quotationDate}</p>
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Subject Line (RE: line above greeting)
        // ------------------------------------------------------------
        function renderSubjectLine(projectConfig) {
            const projectName = projectConfig?.projectName || 'Your Project';
            
            return `
                <p class="cover-letter__subject"><strong>RE: ${projectName} &ndash; Design Services Enquiry</strong></p>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Greeting (Dear Client - Bold)
        // ------------------------------------------------------------
        function renderGreeting(clientDetails) {
            // Address block then bold salutation
            return `
                <div class="cover-letter__recipient">
                    <address class="cover-letter__address-block">
                        <span class="cover-letter__recipient-name">${clientDetails.name || 'Valued Client'}</span>
                        ${clientDetails.address ? `<span class="cover-letter__recipient-address">${clientDetails.address}</span>` : ''}
                    </address>
                </div>
                <p class="cover-letter__salutation"><strong>Dear ${clientDetails.name || 'Valued Client'},</strong></p>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Body
        // ------------------------------------------------------------
        function renderBody(projectConfig) {
            // Backward compatibility: use projectBriefConcise, fallback to projectDescription
            const projectBrief = projectConfig?.projectBriefConcise || projectConfig?.projectDescription || '';

            return `
                <div class="cover-letter__body">
                    <p>Thank you for your enquiry regarding the design services you require for your project. </p>
                    
                    <p>I am pleased to provide you with a fee proposal for the required design work. Please review the documentation on this platform and approve the terms and conditions for our engagement.</p>

                    <p>This portal contains all the documentation you need to review and approve before we can proceed with your project.</p>
                </div>
                
                <hr class="cover-letter__divider">
                
                <div class="cover-letter__section">
                    <p class="cover-letter__section-heading"><strong>Design Brief</strong></p>
                    
                    ${projectBrief ? `
                        <p class="cover-letter__project-description">${projectBrief}</p>
                    ` : ''}
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Detailed Brief (Markdown)
        // ------------------------------------------------------------
        /**
         * Render detailed project brief from markdown content
         * @param {Object} projectConfig - Project configuration data
         * @returns {string} Rendered HTML or empty string if no full brief
         */
        function renderDetailedBrief(projectConfig) {
            const fullBrief = projectConfig?.projectBriefFull || '';
            
            // Return empty string if no full brief content
            if (!fullBrief || fullBrief.trim() === '') {
                return '';
            }
            
            // Use simple markdown parser for free-form content
            const parsedHtml = parseSimpleMarkdown(fullBrief);
            
            return `
                <hr class="cover-letter__divider">
                <div class="cover-letter__section cover-letter__detailed-brief">
                    <p class="cover-letter__section-heading"><strong>Detailed Project Brief</strong></p>
                    <div class="cover-letter__markdown-content">
                        ${parsedHtml}
                    </div>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Parse Simple Markdown
        // ------------------------------------------------------------
        /**
         * Simple markdown parser for free-form content (not structured terms)
         * @param {string} markdown - Raw markdown content
         * @returns {string} Rendered HTML
         */
        function parseSimpleMarkdown(markdown) {
            if (!markdown) return '';
            
            let html = '';
            const lines = markdown.split('\n');
            let inList = false;
            let currentParagraph = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // Empty line - close paragraph and list
                if (trimmed === '') {
                    if (currentParagraph.length > 0) {
                        html += `<p>${processInlineMarkdown(currentParagraph.join(' '))}</p>`;
                        currentParagraph = [];
                    }
                    if (inList) {
                        html += '</ul>';
                        inList = false;
                    }
                    continue;
                }
                
                // Heading level 2 (##)
                if (trimmed.startsWith('## ')) {
                    if (currentParagraph.length > 0) {
                        html += `<p>${processInlineMarkdown(currentParagraph.join(' '))}</p>`;
                        currentParagraph = [];
                    }
                    if (inList) {
                        html += '</ul>';
                        inList = false;
                    }
                    const headingText = trimmed.substring(3).trim();
                    html += `<h3 class="brief-heading">${processInlineMarkdown(headingText)}</h3>`;
                    continue;
                }
                
                // Heading level 3 (###)
                if (trimmed.startsWith('### ')) {
                    if (currentParagraph.length > 0) {
                        html += `<p>${processInlineMarkdown(currentParagraph.join(' '))}</p>`;
                        currentParagraph = [];
                    }
                    if (inList) {
                        html += '</ul>';
                        inList = false;
                    }
                    const headingText = trimmed.substring(4).trim();
                    html += `<h4 class="brief-subheading">${processInlineMarkdown(headingText)}</h4>`;
                    continue;
                }
                
                // List item
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    if (currentParagraph.length > 0) {
                        html += `<p>${processInlineMarkdown(currentParagraph.join(' '))}</p>`;
                        currentParagraph = [];
                    }
                    if (!inList) {
                        html += '<ul>';
                        inList = true;
                    }
                    const listItemText = trimmed.substring(2).trim();
                    html += `<li>${processInlineMarkdown(listItemText)}</li>`;
                    continue;
                }
                
                // Regular line - add to current paragraph
                currentParagraph.push(trimmed);
            }
            
            // Flush remaining content
            if (currentParagraph.length > 0) {
                html += `<p>${processInlineMarkdown(currentParagraph.join(' '))}</p>`;
            }
            if (inList) {
                html += '</ul>';
            }
            
            return html;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Process Inline Markdown
        // ------------------------------------------------------------
        /**
         * Process inline markdown formatting
         * @param {string} text - Text with inline markdown
         * @returns {string} HTML with inline formatting
         */
        function processInlineMarkdown(text) {
            if (!text) return '';
            
            // Escape HTML first
            let processed = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            
            // Bold: **text**
            processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            // Italic: *text*
            processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            
            // Inline code: `code`
            processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            return processed;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Navigation Guide
        // ------------------------------------------------------------
        function renderNavigationGuide() {
            return `
                <hr class="cover-letter__divider">
                
                <div class="cover-letter__section">
                    <p class="cover-letter__section-heading"><strong>How to Navigate This Portal</strong></p>
                    
                    <p>Use the menu button <span class="cover-letter__menu-icon">&#9776;</span> in the top-left corner of the screen to access the navigation menu. From there you can:</p>
                    
                    <ul class="cover-letter__bullet-list">
                        <li><strong>View Quotation</strong> &ndash; Review the detailed cost breakdown for your project</li>
                        <li><strong>Review Contracts</strong> &ndash; Read and digitally sign the terms and conditions</li>
                        <li><strong>Track Signatures</strong> &ndash; Monitor which documents have been signed and approved</li>
                    </ul>
                    
                    <p class="cover-letter__important-note">
                        <span class="cover-letter__note-marker">&#9888;</span>
                        <strong>Important:</strong> When reviewing contracts, please look out for <em>Special Terms</em> highlighted in <span class="cover-letter__yellow-highlight">yellow boxes</span>. These are specific conditions that apply to your project and require your particular attention.
                    </p>
                </div>
                
                <hr class="cover-letter__divider">
                
                <div class="cover-letter__section">
                    <p class="cover-letter__section-heading"><strong>Moving Forward</strong></p>
                    
                    <p>Once you have reviewed and signed all required documents, we will be in touch to discuss the next steps for your project.</p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Signature
        // ------------------------------------------------------------
        function renderSignature(companyDetails) {
            const assetLoader = window.NaProjectAdmin.AssetLoader;
            const signatureUrl = assetLoader?.getAssetUrl('GRAPHICS', 'NaBrandGraphic__EmailSignature__.png') || '';

            return `
                <div class="cover-letter__closing-section">
                    <p class="cover-letter__closing">Kind Regards,</p>
                    <img src="${signatureUrl}" 
                         alt="Adam Noble - Noble Architecture" 
                         class="cover-letter__signature-image">
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // FUNCTION | Render Empty State
        // ------------------------------------------------------------
        function renderEmptyState() {
            return `
                <div class="document cover-letter" style="text-align: center; padding: 3rem;">
                    <h2>Welcome</h2>
                    <p style="color: var(--App_TextSecondary);">
                        Project information is loading. Please wait...
                    </p>
                </div>
            `;
        }
        // ---------------------------------------------------------------

        // API EXPORT | Public Interface
        // ------------------------------------------------------------
        window.NaProjectAdmin = window.NaProjectAdmin || {};
        
        window.NaProjectAdmin.CoverLetterRenderer = {
            renderAsync              : renderAsync,
            fetchClientData          : fetchClientDataFromCloudflare
        };

        // Mark module as loaded
        if (window.NaProjectAdmin.ModuleDependencyManager) {
            window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('CoverLetterRenderer');
        }

    })();

// endregion -----

