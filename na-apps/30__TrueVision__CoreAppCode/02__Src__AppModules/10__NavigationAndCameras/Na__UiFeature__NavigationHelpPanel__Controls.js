// =============================================================================
// TRUEVISION3D - NAVIGATION HELP PANEL CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__NavigationHelpPanel__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : Navigation Help Panel Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Floating help panel explaining how to navigate the 3D model
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Manages the navigation help pop-up panel triggered by the Help button
//   on the floating navigation toolbar.
// - The panel markup lives in Index.html (#naNavHelpPanel) following the
//   established stable-element-ID pattern; this module owns its behaviour.
// - Closes via the close button, clicking the backdrop, or pressing Escape.
// - Walk and Fly instruction sections show only when those modes are enabled
//   for the current model (Navmode__EnabledModes).
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeNavigationHelpPanel() from Index.html.
// - Pass Na__UiFeature__OpenNavigationHelpPanel as the toolbar's openHelp
//   callback.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the navigation toolbar transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__NavHelp__PanelId        = 'naNavHelpPanel';           // <-- Modal overlay container
    const Na__NavHelp__BackdropId     = 'naNavHelpBackdrop';        // <-- Click-outside-to-close backdrop
    const Na__NavHelp__CloseBtnId     = 'naNavHelpCloseBtn';        // <-- Close (X) button
    const Na__NavHelp__WalkSectionId  = 'naNavHelpWalkSection';     // <-- Walk instructions section
    const Na__NavHelp__FlySectionId   = 'naNavHelpFlySection';      // <-- Fly instructions section
    // ------------------------------------------------------------

    // MODULE CONSTANTS | CSS Classes
    // ------------------------------------------------------------
    const Na__NavHelp__OpenClass      = 'na-nav-help--open';        // <-- Visible state class
    const Na__NavHelp__CollapsedClass = 'na-nav-help__section--collapsed';  // <-- Folded section state
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Open and Close Behaviour
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Navigation Help Panel
    // ------------------------------------------------------------
    function Na__UiFeature__OpenNavigationHelpPanel() {
        const panel = document.getElementById(Na__NavHelp__PanelId);
        if (!panel) return;
        panel.classList.add(Na__NavHelp__OpenClass);                         // <-- Reveal modal overlay
        panel.setAttribute('aria-hidden', 'false');
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Navigation Help Panel
    // ------------------------------------------------------------
    function Na__UiFeature__CloseNavigationHelpPanel() {
        const panel = document.getElementById(Na__NavHelp__PanelId);
        if (!panel) return;
        panel.classList.remove(Na__NavHelp__OpenClass);                      // <-- Hide modal overlay
        panel.setAttribute('aria-hidden', 'true');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Help Panel Currently Open?
    // ------------------------------------------------------------
    function Na__NavHelp__IsOpen() {
        const panel = document.getElementById(Na__NavHelp__PanelId);
        return Boolean(panel && panel.classList.contains(Na__NavHelp__OpenClass));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section Fold / Unfold
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Toggle One Section Between Open and Collapsed
    // ------------------------------------------------------------
    function Na__NavHelp__ToggleSection(sectionEl) {
        const isCollapsed = sectionEl.classList.contains(Na__NavHelp__CollapsedClass);
        const headerBtn   = sectionEl.querySelector('[data-nav-help-section]');

        sectionEl.classList.toggle(Na__NavHelp__CollapsedClass, !isCollapsed);         // <-- Flip collapsed state
        if (headerBtn) headerBtn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    }
    // ------------------------------------------------------------


    // FUNCTION | Wire Click Handlers onto All Collapsible Section Headers
    // ------------------------------------------------------------
    function Na__NavHelp__InitializeSectionToggles() {
        const content = document.getElementById(Na__NavHelp__PanelId);
        if (!content) return;

        const headers = content.querySelectorAll('[data-nav-help-section]');
        headers.forEach((header) => {
            header.addEventListener('click', () => {
                const section = header.closest('.na-nav-help__section');    // <-- Get parent section element
                if (section) Na__NavHelp__ToggleSection(section);
            });
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mode Section Visibility
// -----------------------------------------------------------------------------

    // FUNCTION | Show or Hide Walk and Fly Instruction Sections
    // ------------------------------------------------------------
    function Na__NavHelp__RevealModeSections(walkEnabled, flyEnabled) {
        const walkSection = document.getElementById(Na__NavHelp__WalkSectionId);
        const flySection  = document.getElementById(Na__NavHelp__FlySectionId);

        if (walkSection) walkSection.style.display = walkEnabled ? '' : 'none';   // <-- Walk instructions only when relevant
        if (flySection)  flySection.style.display  = flyEnabled  ? '' : 'none';   // <-- Fly instructions only when relevant
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Navigation Help Panel
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeNavigationHelpPanel() {
        const closeBtn = document.getElementById(Na__NavHelp__CloseBtnId);
        const backdrop = document.getElementById(Na__NavHelp__BackdropId);

        if (closeBtn) closeBtn.addEventListener('click', Na__UiFeature__CloseNavigationHelpPanel);   // <-- Close (X) button
        if (backdrop) backdrop.addEventListener('click', Na__UiFeature__CloseNavigationHelpPanel);   // <-- Click outside to close

        Na__NavHelp__InitializeSectionToggles();                                     // <-- Wire fold/unfold on all section headers

        // CLOSE ON ESCAPE KEY (only while open)
        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && Na__NavHelp__IsOpen()) {
                Na__UiFeature__CloseNavigationHelpPanel();
            }
        });

        // SHOW WALK/FLY SECTIONS ONCE PROJECT MODES ARE KNOWN (async load)
        window.addEventListener('na-navigation-modes-loaded', (event) => {
            const modes = event.detail && event.detail.enabledModes;
            if (!modes) return;
            Na__NavHelp__RevealModeSections(
                Boolean(modes.Navmode__EnabledModes__Walk),                  // <-- Walk enabled for this model
                Boolean(modes.Navmode__EnabledModes__Fly)                    // <-- Fly enabled for this model
            );
        }, { once: true });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Navigation Help Panel API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeNavigationHelpPanel,
        Na__UiFeature__OpenNavigationHelpPanel,
        Na__UiFeature__CloseNavigationHelpPanel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
