// =============================================================================
// TRUEVISION3D - NAVIGATION MODES DEV CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__NavigationModes__DevControls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : NavigationModes Dev Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev-menu section for toggling and saving per-model navigation modes
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Localhost-only dev menu section. Enables or disables Walk and Fly modes for
//   the current model.
// - On "Save Navigation Modes", merges the Navmode__EnabledModes block into
//   TrueVision__ProjectData__.json and writes it straight to R2 via the
//   na-truevision-api Worker (no GitHub push required).
// - Orbit mode is always enabled; only Walk and Fly are configurable toggles.
// - After saving, calls onSaved so the caller can update the nav toolbar's
//   Walk/Fly button visibility in real time.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeNavigationModesDevControls(options) after the
//   loading sequence has run (so the project folder is available in the URL).
// - options: { isWalkEnabled, isFlyEnabled, onSaved, showToast }
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Persistence rewired from Flask to the R2 API client.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__NavModesDevMenu__ItemId        = 'naNavModesDevItem';        // <-- Dev menu list item container
    const Na__NavModesDevMenu__ToggleId      = 'naNavModesDevToggle';      // <-- Submenu open/close button
    const Na__NavModesDevMenu__PanelId       = 'naNavModesDevPanel';       // <-- Collapsible submenu panel
    const Na__NavModesDevMenu__WalkCheckId   = 'naNavModesDevWalkCheck';   // <-- Walk mode checkbox
    const Na__NavModesDevMenu__FlyCheckId    = 'naNavModesDevFlyCheck';    // <-- Fly mode checkbox
    const Na__NavModesDevMenu__SaveBtnId     = 'naNavModesDevSave';        // <-- Save Navigation Modes button
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Save Logic
// -----------------------------------------------------------------------------

    // FUNCTION | Save Navigation Mode Flags to R2 Project Data
    // ------------------------------------------------------------
    async function Na__NavModesDevMenu__SaveToProject(walkEnabled, flyEnabled, showToast) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - cannot save.', true);
            return;
        }

        const result = await Na__CfApi__MergeAndSaveKeys({
            Navmode__EnabledModes : {
                "Navmode__EnabledModes__Walk" : walkEnabled,                 // <-- Walk mode enabled for this model
                "Navmode__EnabledModes__Fly"  : flyEnabled                   // <-- Fly mode enabled for this model
            }
        });

        if (result.ok) {
            console.log(`[NavModesDevMenu] Navigation modes saved to R2 - Walk: ${walkEnabled}, Fly: ${flyEnabled}`);
            if (showToast) showToast('Navigation modes saved to R2.');
        } else {
            console.error('[NavModesDevMenu] Save failed:', result.error);
            if (showToast) showToast(`Save failed: ${result.error}`, true);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Navigation Modes Dev Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeNavigationModesDevControls({ isWalkEnabled, isFlyEnabled, onSaved, showToast } = {}) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Dev menu only on localhost

        const menuItem  = document.getElementById(Na__NavModesDevMenu__ItemId);
        const toggleBtn = document.getElementById(Na__NavModesDevMenu__ToggleId);
        const panel     = document.getElementById(Na__NavModesDevMenu__PanelId);
        const walkCheck = document.getElementById(Na__NavModesDevMenu__WalkCheckId);
        const flyCheck  = document.getElementById(Na__NavModesDevMenu__FlyCheckId);
        const saveBtn   = document.getElementById(Na__NavModesDevMenu__SaveBtnId);

        if (!menuItem || !walkCheck || !flyCheck || !saveBtn) return;        // <-- Guard: DOM not ready

        menuItem.style.display = '';                                         // <-- Reveal the dev section

        // SET INITIAL CHECKBOX STATE FROM PROJECT DATA
        walkCheck.checked = Boolean(isWalkEnabled);                          // <-- Reflect current project setting
        flyCheck.checked  = Boolean(isFlyEnabled);                           // <-- Reflect current project setting

        // WIRE SUBMENU OPEN/CLOSE TOGGLE
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
                toggleBtn.setAttribute('aria-expanded', String(!isOpen));
            });
        }

        // WIRE SAVE BUTTON
        saveBtn.addEventListener('click', async () => {
            const confirmed = window.confirm('Save the selected navigation mode settings to R2?');
            if (!confirmed) return;

            const walkEnabled = walkCheck.checked;
            const flyEnabled  = flyCheck.checked;

            await Na__NavModesDevMenu__SaveToProject(walkEnabled, flyEnabled, showToast);

            if (onSaved) onSaved({ walkEnabled, flyEnabled });               // <-- Notify caller (e.g. update nav toolbar)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Navigation Modes Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeNavigationModesDevControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
