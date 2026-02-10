// =============================================================================
// NOBLE ARCHITECTURE - APP LANDING PAGE / DRAWING REGISTER
// =============================================================================
//
// FILE       : LandingPage__Main__.js
// NAMESPACE  : NaPlanVision.LandingPage
// MODULE     : LandingPage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dynamic drawing register and app instructions panel
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Displays a project information header in the canvas area
// - Renders a dynamic drawing register table from folder-grouped data
// - Provides concise how-to-use instructions for the app
// - Shown as default view on startup, accessible via menu button
// - Sits below the toolbar so the menu remains fully accessible
// - Auto-hides when user navigates to Drawings or Specifications
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Initial implementation
// - Project header, drawing register, instructions
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | App Landing Page
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Module State
        // --------------------------------------------------------

            let overlayElement                 = null;                        // <-- Host DOM element
            let isVisible                      = false;                       // <-- Visibility state

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Module Setup
        // --------------------------------------------------------

            // FUNCTION | Initialize Landing Page
            // Receives project data and renders all sections into the overlay
            // ------------------------------------------------------------
            const Na__Landing__Initialize = function (context) {
                console.log('[LandingPage] Initializing...');

                overlayElement = document.getElementById('landing-page-overlay');
                if (!overlayElement) {
                    console.error('[LandingPage] #landing-page-overlay element not found');
                    return;
                }

                var projectDetails = context.projectDetails || {};
                var phaseConfig    = context.phaseConfig || {};
                var folderGroups   = context.folderGroups || [];

                // Build the landing page content
                var html = '';
                html += renderDrawingRegister(folderGroups, projectDetails, phaseConfig);

                overlayElement.innerHTML = html;

                console.log('[LandingPage] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // VISIBILITY | Show and Hide
        // --------------------------------------------------------

            // FUNCTION | Show Landing Page
            // ------------------------------------------------------------
            const Na__Landing__Show = function () {
                if (overlayElement) {
                    overlayElement.style.display = 'block';
                    isVisible = true;
                    console.log('[LandingPage] Drawing Register shown');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide Landing Page
            // ------------------------------------------------------------
            const Na__Landing__Hide = function () {
                if (overlayElement) {
                    overlayElement.style.display = 'none';
                    isVisible = false;
                    console.log('[LandingPage] Drawing Register hidden');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Is Landing Page Visible
            // ------------------------------------------------------------
            const Na__Landing__IsVisible = function () {
                return isVisible;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // RENDERING | Build Landing Page Sections
        // --------------------------------------------------------

            // FUNCTION | Render Drawing Register Table
            // Builds a grouped table of all documents in the current phase
            // ------------------------------------------------------------
            function renderDrawingRegister(folderGroups, projectDetails, phaseConfig) {
                if (!folderGroups || folderGroups.length === 0) {
                    return '<div class="landing-register-section"><p>No documents available.</p></div>';
                }

                // Project details for header
                projectDetails = projectDetails || {};
                phaseConfig = phaseConfig || {};
                
                var projectName = projectDetails['project-name-nickname'] || 'Project';
                var town        = projectDetails['project-address-town'] || '';
                var county      = projectDetails['project-address-county'] || '';
                var postcode    = projectDetails['project-address-postcode'] || '';

                // Build address string from non-NIL parts
                var addressParts = [];
                if (town && town !== 'NIL')     addressParts.push(town);
                if (county && county !== 'NIL')  addressParts.push(county);
                if (postcode && postcode !== 'NIL') addressParts.push(postcode);
                var addressStr = addressParts.join(', ') || '';

                // Active phase info
                var activePhase    = phaseConfig['active-design-phase'] || '';
                var phaseDesc      = '';
                var lastUpdated    = phaseConfig['phase-last-updated'] || '';

                if (phaseConfig['phase-descriptions'] && activePhase) {
                    phaseDesc = phaseConfig['phase-descriptions'][activePhase] || activePhase;
                }

                var html = '';
                html += '<div class="landing-register-section">';
                html +=     '<div class="landing-register-content">';
                html +=         '<div class="landing-register-card">';
                
                // Document-style header inside card
                html +=             '<div class="landing-document-header">';
                html +=                 '<div class="landing-document-title-row">';
                html +=                     '<div class="landing-project-name">' + escapeHtml(projectName) + '</div>';
                if (phaseDesc) {
                    html +=                 '<span class="landing-phase-badge">' + escapeHtml(phaseDesc) + '</span>';
                }
                html +=                 '</div>';
                html +=                 '<div class="landing-document-info-row">';
                if (addressStr) {
                    html +=                 '<div class="landing-project-address">' + escapeHtml(addressStr) + '</div>';
                }
                if (lastUpdated) {
                    html +=                 '<span class="landing-phase-date">Last Updated: ' + escapeHtml(lastUpdated) + '</span>';
                }
                html +=                 '</div>';
                html +=             '</div>';
                
                // Register title and table
                html +=             '<div class="landing-register-title">Drawing Register</div>';
                html +=             '<div class="landing-register-table-wrapper">';
                html +=             '<table class="landing-register-table">';
                html +=                 '<thead>';
                html +=                     '<tr>';
                html +=                         '<th>Code</th>';
                html +=                         '<th>Document Name</th>';
                html +=                         '<th>Type</th>';
                html +=                         '<th>Scale</th>';
                html +=                         '<th>Size</th>';
                html +=                         '<th>Revision</th>';
                html +=                     '</tr>';
                html +=                 '</thead>';
                html +=                 '<tbody>';

                for (var g = 0; g < folderGroups.length; g++) {
                    var group    = folderGroups[g];
                    var label    = group['label'] || 'Documents';
                    var drawings = group['drawings'] || [];

                    // Group header row
                    html += '<tr class="landing-register-group-row">';
                    html +=     '<td colspan="6">' + escapeHtml(label) + '</td>';
                    html += '</tr>';

                    // Drawing rows
                    for (var d = 0; d < drawings.length; d++) {
                        var drawing  = drawings[d];
                        var parsed   = parseDisplayName(drawing['document-name'] || '');
                        var docType  = drawing['document-type'] || '';
                        var scale    = drawing['document-scale'] || '';
                        var size     = drawing['document-size'] || '';

                        var rowClass = (d % 2 === 0) ? 'landing-row-even' : 'landing-row-odd';

                        html += '<tr class="' + rowClass + '">';
                        html +=     '<td class="landing-cell-code">' + escapeHtml(parsed.code) + '</td>';
                        html +=     '<td>' + escapeHtml(parsed.name) + '</td>';
                        html +=     '<td>' + escapeHtml(docType) + '</td>';
                        html +=     '<td>' + escapeHtml(scale) + '</td>';
                        html +=     '<td>' + escapeHtml(size) + '</td>';
                        html +=     '<td>' + escapeHtml(parsed.revision) + '</td>';
                        html += '</tr>';
                    }
                }

                html +=                 '</tbody>';
                html +=             '</table>';
                html +=             '</div>';
                html +=         '</div>';
                html +=     '</div>';
                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPERS | Utility Functions
        // --------------------------------------------------------

            // FUNCTION | Parse Display Name into Code, Name, Revision
            // Input:  "D21 - Technical Plan (Rev F)"
            // Output: { code: "D21", name: "Technical Plan", revision: "Rev F" }
            // ------------------------------------------------------------
            function parseDisplayName(displayName) {
                var result = { code: '', name: displayName, revision: '' };

                if (!displayName) return result;

                // Extract revision from parentheses at end
                var revMatch = displayName.match(/\(([^)]*Rev[^)]*)\)\s*$/i);
                if (revMatch) {
                    result.revision = revMatch[1];
                    displayName = displayName.substring(0, displayName.lastIndexOf('(')).trim();
                }

                // Extract code from beginning (before first " - ")
                var dashIndex = displayName.indexOf(' - ');
                if (dashIndex !== -1) {
                    result.code = displayName.substring(0, dashIndex).trim();
                    result.name = displayName.substring(dashIndex + 3).trim();
                } else {
                    result.name = displayName;
                }

                return result;
            }
            // ---------------------------------------------------------------

            // FUNCTION | Escape HTML Special Characters
            // Prevents XSS when injecting dynamic content
            // ------------------------------------------------------------
            function escapeHtml(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.LandingPage = {
                Na__Landing__Initialize    : Na__Landing__Initialize,
                Na__Landing__Show          : Na__Landing__Show,
                Na__Landing__Hide          : Na__Landing__Hide,
                Na__Landing__IsVisible     : Na__Landing__IsVisible
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('LandingPage');
            }

            console.log('[LandingPage] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
