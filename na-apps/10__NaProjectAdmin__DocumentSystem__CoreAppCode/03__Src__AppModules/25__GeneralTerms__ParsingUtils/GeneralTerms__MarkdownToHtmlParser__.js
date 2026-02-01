// =============================================================================
// NOBLE ARCHITECTURE - MARKDOWN TO HTML PARSER
// =============================================================================
//
// FILE       : GeneralTerms__MarkdownToHtmlParser__.js
// NAMESPACE  : NaProjectAdmin.MarkdownParser
// MODULE     : MarkdownParser
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Parses structured markdown files into numbered HTML terms
// CREATED    : 01-Feb-2026
//
// DESCRIPTION:
// - Converts markdown terms files to rendered HTML
// - Auto-generates section and sub-section numbering
// - Ignores header content before first horizontal rule
// - Understands section (---) and topic (___) dividers
//
// -----
//
// DEVELOPMENT LOG:
// 01-Feb-2026 - Version 1.1.2
// - Critical Bug Fix
//   - Fixed tables not rendering when followed by empty lines
//   - Empty line handler now properly closes and renders open tables
//
// 01-Feb-2026 - Version 1.1.1
// - Bug Fixes
//   - Fixed section dividers (---) after tables being treated as content
//   - Tables now properly recognize and skip trailing dividers
//
// 01-Feb-2026 - Version 1.1.0
// - Enhanced Inline Formatting
//   - Fixed bold/italic rendering in list items
//   - List items now process **bold**, *italic*, and `code` correctly
// - Added Table Support
//   - Markdown table parsing (pipe-delimited format)
//   - Auto-detects header, separator, and data rows
//   - Inline formatting support within table cells
//
// 01-Feb-2026 - Version 1.0.0
// - Initial Release
//   - Section numbering (## headings)
//   - Sub-section numbering (#### headings)
//   - Divider-based structure parsing
//   - Legacy placeholder removal
//
// =============================================================================

// #region -----
// MODULE | Markdown Parser
// -----

    (function() {
        'use strict';

        // #region -----
        // CONSTANTS | Parser Configuration
        // -----

            const SECTION_DIVIDER        = '---';                          // <-- Section break
            const TOPIC_DIVIDER          = '___';                          // <-- Topic break within section
            const LEGACY_SECTION_MARKER  = '{{#}}';                        // <-- Legacy placeholder
            const LEGACY_SUB_MARKER      = '{{#.##}}';                     // <-- Legacy sub placeholder

        // endregion -----

        // #region -----
        // FUNCTION | Parse Markdown to HTML
        // -----

            /**
             * Parse structured markdown into numbered HTML
             * @param {string} markdownContent - Raw markdown content
             * @returns {string} Rendered HTML
             */
            function parse(markdownContent) {
                if (!markdownContent || typeof markdownContent !== 'string') {
                    console.warn('[MarkdownParser] No content provided');
                    return '<p>Terms content not available.</p>';
                }

                // Split into lines for processing
                const lines = markdownContent.split('\n');
                
                // Find first section divider (skip header)
                const startIndex = findFirstSectionDivider(lines);
                
                if (startIndex === -1) {
                    console.warn('[MarkdownParser] No section divider found');
                    return '<p>Terms content could not be parsed.</p>';
                }

                // Process content after header
                const contentLines = lines.slice(startIndex + 1);
                
                return processContent(contentLines);
            }
            // ---------------------------------------------------------------

            /**
             * Find the index of the first section divider
             * @param {string[]} lines - Array of markdown lines
             * @returns {number} Index of first divider, or -1 if not found
             */
            function findFirstSectionDivider(lines) {
                for (let i = 0; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (trimmed === SECTION_DIVIDER) {
                        return i;
                    }
                }
                return -1;
            }
            // ---------------------------------------------------------------

            /**
             * Process markdown content into HTML
             * @param {string[]} lines - Content lines (after header)
             * @returns {string} Rendered HTML
             */
            function processContent(lines) {
                let html = '<div class="terms-content">';
                let sectionNumber = 0;
                let subSectionNumber = 0;
                let currentParagraph = [];
                let inSection = false;
                let inTable = false;
                let tableRows = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const trimmed = line.trim();

                    // Skip empty lines but flush paragraph and close table if needed
                    if (trimmed === '') {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        
                        // If we're in a table, close it
                        if (inTable && tableRows.length > 0) {
                            html += renderTable(tableRows);
                            inTable = false;
                            tableRows = [];
                        }
                        
                        continue;
                    }

                    // Skip end of terms marker
                    if (trimmed.startsWith('###### END OF TERMS')) {
                        continue;
                    }

                    // Section divider (---) - IGNORE, just markdown formatting
                    if (trimmed === SECTION_DIVIDER) {
                        // Skip completely - these are cosmetic in markdown
                        continue;
                    }

                    // Topic divider (___)
                    if (trimmed === TOPIC_DIVIDER) {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        continue;
                    }

                    // Section heading (##)
                    if (trimmed.startsWith('## ')) {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        
                        const title = cleanHeading(trimmed.substring(3));
                        
                        // Skip placeholder sections
                        if (title.includes('PLACEHOLDER')) {
                            continue;
                        }
                        
                        // Close previous section if exists
                        if (inSection) {
                            html += '</div></div>';
                            
                            // Add horizontal divider BEFORE new section (except first)
                            html += '<hr class="terms-section-divider">';
                        }
                        
                        // Increment section number and reset subsection
                        sectionNumber++;
                        subSectionNumber = 0;
                        inSection = true;
                        
                        html += `<div class="terms-item">`;
                        html += `<div class="terms-item__title">${sectionNumber}. ${title}</div>`;
                        html += `<div class="terms-item__content">`;
                        continue;
                    }

                    // Sub-section heading (####)
                    if (trimmed.startsWith('#### ')) {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        
                        subSectionNumber++;
                        const title = cleanHeading(trimmed.substring(5));
                        
                        html += `<h4 class="terms-subheading">${sectionNumber}.${subSectionNumber} ${title}</h4>`;
                        continue;
                    }

                    // H3 heading (###) - treat as subtitle without number
                    if (trimmed.startsWith('### ')) {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        
                        const title = cleanHeading(trimmed.substring(4));
                        html += `<h3 class="terms-subtitle">${title}</h3>`;
                        continue;
                    }

                    // H1 heading (#) - document title, skip if after first divider
                    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
                        continue;
                    }

                    // List items
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        html += flushParagraph(currentParagraph);
                        currentParagraph = [];
                        
                        const listItem = trimmed.substring(2);
                        html += `<ul><li>${processInlineFormatting(listItem)}</li></ul>`;
                        continue;
                    }

                    // Table rows
                    if (isTableRow(trimmed)) {
                        // Flush paragraph before starting table
                        if (!inTable) {
                            html += flushParagraph(currentParagraph);
                            currentParagraph = [];
                            inTable = true;
                            tableRows = [];
                        }
                        
                        tableRows.push(trimmed);
                        continue;
                    } else if (inTable) {
                        // End of table - render it
                        html += renderTable(tableRows);
                        inTable = false;
                        tableRows = [];
                        
                        // Check if current line is a divider (skip it)
                        if (trimmed === SECTION_DIVIDER || trimmed === TOPIC_DIVIDER) {
                            continue;
                        }
                        
                        // Process current line normally (fall through)
                    }

                    // Bold text processing for inline **text**
                    // Regular paragraph content
                    currentParagraph.push(trimmed);
                }

                // Flush any remaining paragraph
                html += flushParagraph(currentParagraph);

                // Flush any remaining table
                if (inTable && tableRows.length > 0) {
                    html += renderTable(tableRows);
                }

                // Close final section if open
                if (inSection) {
                    html += '</div></div>';
                }

                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

            /**
             * Clean heading text - remove legacy placeholders
             * @param {string} heading - Raw heading text
             * @returns {string} Cleaned heading
             */
            function cleanHeading(heading) {
                return heading
                    .replace(/\{\{#\}\}\s*-?\s*/g, '')                    // <-- Remove {{#}} -
                    .replace(/\{\{#\.##\}\}\s*-?\s*/g, '')                // <-- Remove {{#.##}} -
                    .replace(/^\*+\s*/, '')                               // <-- Remove leading asterisks
                    .replace(/\s*\*+$/, '')                               // <-- Remove trailing asterisks
                    .trim();
            }
            // ---------------------------------------------------------------

            /**
             * Flush accumulated paragraph lines to HTML
             * @param {string[]} lines - Paragraph lines
             * @returns {string} HTML paragraph
             */
            function flushParagraph(lines) {
                if (lines.length === 0) {
                    return '';
                }

                const text = lines.join(' ');
                const processedText = processInlineFormatting(text);
                
                return `<p>${processedText}</p>`;
            }
            // ---------------------------------------------------------------

            /**
             * Process inline markdown formatting
             * @param {string} text - Raw text
             * @returns {string} Formatted HTML
             */
            function processInlineFormatting(text) {
                // Escape HTML first
                let processed = escapeHtml(text);
                
                // Bold: **text** or __text__
                processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
                
                // Italic: *text* or _text_
                processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
                processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');
                
                // Inline code: `code`
                processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
                
                return processed;
            }
            // ---------------------------------------------------------------

            /**
             * Escape HTML special characters
             * @param {string} text - Raw text
             * @returns {string} Escaped text
             */
            function escapeHtml(text) {
                if (!text) return '';
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }
            // ---------------------------------------------------------------

            /**
             * Check if line is a table row
             * @param {string} line - Line to check
             * @returns {boolean} True if line is a table row
             */
            function isTableRow(line) {
                const trimmed = line.trim();
                return trimmed.startsWith('|') && trimmed.endsWith('|');
            }
            // ---------------------------------------------------------------

            /**
             * Render accumulated table rows as HTML
             * @param {string[]} rows - Table rows (header, separator, data)
             * @returns {string} HTML table
             */
            function renderTable(rows) {
                if (rows.length < 2) {
                    return '';                                       // <-- Need at least header + separator
                }

                let html = '<table class="terms-table">';
                
                // Parse header row
                const headerCells = rows[0]
                    .split('|')
                    .slice(1, -1)                                    // <-- Remove empty first/last
                    .map(cell => cell.trim());
                
                // Check if second row is separator (contains dashes)
                const isSeparatorRow = rows[1].includes('---') || rows[1].includes('---');
                const dataStartIndex = isSeparatorRow ? 2 : 1;
                
                // Render header
                html += '<thead><tr>';
                for (const cell of headerCells) {
                    html += `<th>${processInlineFormatting(cell)}</th>`;
                }
                html += '</tr></thead>';
                
                // Render body rows
                html += '<tbody>';
                for (let i = dataStartIndex; i < rows.length; i++) {
                    const cells = rows[i]
                        .split('|')
                        .slice(1, -1)                                // <-- Remove empty first/last
                        .map(cell => cell.trim());
                    
                    html += '<tr>';
                    for (const cell of cells) {
                        html += `<td>${processInlineFormatting(cell)}</td>`;
                    }
                    html += '</tr>';
                }
                html += '</tbody>';
                
                html += '</table>';
                
                return html;
            }
            // ---------------------------------------------------------------

        // endregion -----

        // #region -----
        // API EXPORT | Public Interface
        // -----

            window.NaProjectAdmin = window.NaProjectAdmin || {};
            
            window.NaProjectAdmin.MarkdownParser = {
                parse                    : parse,
                cleanHeading             : cleanHeading,
                escapeHtml               : escapeHtml
            };

            // Mark module as loaded
            if (window.NaProjectAdmin.ModuleDependencyManager) {
                window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('MarkdownParser');
            }

            console.log('[MarkdownParser] Module loaded');

        // endregion -----

    })();

// endregion -----

