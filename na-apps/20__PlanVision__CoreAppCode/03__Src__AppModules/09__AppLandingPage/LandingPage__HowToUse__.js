// =============================================================================
// NOBLE ARCHITECTURE - HOW TO USE PLANVISION
// =============================================================================
//
// FILE       : LandingPage__HowToUse__.js
// NAMESPACE  : NaPlanVision.HowToUse
// MODULE     : HowToUse
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Instructions overlay for using PlanVision app
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Displays step-by-step instructions for using PlanVision
// - Shows as a separate overlay accessible via menu button
// - Provides 6 numbered steps with icons and descriptions
// - Sits below the toolbar so the menu remains fully accessible
// - Auto-hides when user navigates to other sections
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Initial implementation
// - Extracted from LandingPage__Main__.js
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | How To Use PlanVision
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

            // FUNCTION | Initialize How To Use
            // Renders instruction steps into the overlay
            // ------------------------------------------------------------
            const Na__HowToUse__Initialize = function () {
                console.log('[HowToUse] Initializing...');

                overlayElement = document.getElementById('how-to-use-overlay');
                if (!overlayElement) {
                    console.error('[HowToUse] #how-to-use-overlay element not found');
                    return;
                }

                // Build the how-to-use content
                var html = '';
                html += renderInstructions();

                overlayElement.innerHTML = html;

                console.log('[HowToUse] Initialized successfully');
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // VISIBILITY | Show and Hide
        // --------------------------------------------------------

            // FUNCTION | Show How To Use
            // ------------------------------------------------------------
            const Na__HowToUse__Show = function () {
                if (overlayElement) {
                    overlayElement.style.display = 'block';
                    isVisible = true;
                    console.log('[HowToUse] Instructions shown');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Hide How To Use
            // ------------------------------------------------------------
            const Na__HowToUse__Hide = function () {
                if (overlayElement) {
                    overlayElement.style.display = 'none';
                    isVisible = false;
                    console.log('[HowToUse] Instructions hidden');
                }
            };
            // ---------------------------------------------------------------

            // FUNCTION | Is How To Use Visible
            // ------------------------------------------------------------
            const Na__HowToUse__IsVisible = function () {
                return isVisible;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // RENDERING | Build Instructions Section
        // --------------------------------------------------------

            // FUNCTION | Render How-To Instructions
            // Concise numbered steps for using the app
            // ------------------------------------------------------------
            function renderInstructions() {
                var html = '';
                html += '<div class="landing-instructions-section">';
                html +=     '<div class="landing-section-title">How to Use PlanVision</div>';
                html +=     '<div class="landing-instructions-grid">';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">1</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Open the Menu</div>';
                html +=                 '<div class="landing-step-desc">Tap the <strong>hamburger menu</strong> button in the top-left corner to open the tools panel.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">2</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Select a Category</div>';
                html +=                 '<div class="landing-step-desc">Choose <strong>Drawings</strong> or <strong>Details &amp; Specifications</strong> to browse documents by type.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">3</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Choose a Document</div>';
                html +=                 '<div class="landing-step-desc">Select any drawing or specification from the list to display it on the canvas.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">4</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Navigate the Drawing</div>';
                html +=                 '<div class="landing-step-desc"><strong>Pan</strong> by clicking and dragging. <strong>Zoom</strong> with the scroll wheel or pinch gesture on touch devices.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">5</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Measure on Drawings</div>';
                html +=                 '<div class="landing-step-desc">Use the <strong>Measuring Tools</strong> to take linear, rectangular, or area measurements directly on any drawing.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=         '<div class="landing-instruction-step">';
                html +=             '<div class="landing-step-number">6</div>';
                html +=             '<div class="landing-step-content">';
                html +=                 '<div class="landing-step-title">Download PDF</div>';
                html +=                 '<div class="landing-step-desc">Use the <strong>Download PDF</strong> button to save any drawing as a PDF document to your device.</div>';
                html +=             '</div>';
                html +=         '</div>';

                html +=     '</div>';
                html += '</div>';

                return html;
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.HowToUse = {
                Na__HowToUse__Initialize    : Na__HowToUse__Initialize,
                Na__HowToUse__Show          : Na__HowToUse__Show,
                Na__HowToUse__Hide          : Na__HowToUse__Hide,
                Na__HowToUse__IsVisible     : Na__HowToUse__IsVisible
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('HowToUse');
            }

            console.log('[HowToUse] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
