// =============================================================================
// TRUEVISION3D - CAMERA UTILS - ORBIT MAX DISTANCE DEV CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__OrbitMaxDistance__DevControls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : OrbitMaxDistance DevControls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev Tools panel for per-project orbit max zoom radius override
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Localhost-only Dev Tools panel to view, apply, save and clear a per-project
//   orbit max zoom distance (radius from helper cube, in millimetres).
// - Apply Live : mutates controls.maxDistance instantly (no persistence).
// - Save       : writes Navmode__OrbitMaxDistanceMm to R2 (TrueVision__ProjectData__.json).
// - Clear      : deletes Navmode__OrbitMaxDistanceMm from R2 and resets the cap
//                to the supplied device default.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeOrbitMaxDistanceDevControls({ controls,
//   defaultMaxDistanceMm, showToast }).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Persistence rewired from Flask to the R2 API
//   client; live apply operates directly on controls.maxDistance.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities (Mm <-> Units)
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__DeleteProjectKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM IDs
    // ------------------------------------------------------------
    const Na__OrbitMaxDistance__ItemId     = 'naOrbitMaxDistanceItem';      // <-- Dev menu list item (localhost-only)
    const Na__OrbitMaxDistance__ToggleId   = 'naOrbitMaxDistanceToggle';    // <-- Submenu open/close button
    const Na__OrbitMaxDistance__PanelId    = 'naOrbitMaxDistancePanel';     // <-- Collapsible panel container
    const Na__OrbitMaxDistance__CurrentId  = 'naOrbitMaxDistanceCurrent';   // <-- Live effective max display
    const Na__OrbitMaxDistance__InputId    = 'naOrbitMaxDistanceInput';     // <-- Number input (mm)
    const Na__OrbitMaxDistance__ApplyBtnId = 'naOrbitMaxDistanceApply';     // <-- Apply Live button
    const Na__OrbitMaxDistance__SaveBtnId  = 'naOrbitMaxDistanceSave';      // <-- Save to Project button
    const Na__OrbitMaxDistance__ClearBtnId = 'naOrbitMaxDistanceClear';     // <-- Clear from Project button
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Project JSON Key
    // ------------------------------------------------------------
    const Na__OrbitMaxDistance__ProjectJsonKey = 'Navmode__OrbitMaxDistanceMm';  // <-- Project data override key (mm)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Format Mm Value for Display
    // ------------------------------------------------------------
    function Na__OrbitMaxDistance__FormatMm(mmValue) {
        if (!Number.isFinite(mmValue)) return '-';
        return `${Math.round(mmValue).toLocaleString()} mm`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read Current Effective Max Distance (Mm)
    // ------------------------------------------------------------
    function Na__OrbitMaxDistance__ReadCurrentMm(controls) {
        if (!controls || !Number.isFinite(controls.maxDistance)) return null;
        return Na__Math__ConvertUnitsToMm(controls.maxDistance);            // <-- Live snapshot of current cap
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Refresh Effective Max Display
    // ------------------------------------------------------------
    function Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl) {
        if (!currentEl) return;
        currentEl.textContent = Na__OrbitMaxDistance__FormatMm(
            Na__OrbitMaxDistance__ReadCurrentMm(controls)
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Max Distance (Mm) to the Controls Live
    // ------------------------------------------------------------
    function Na__OrbitMaxDistance__SetControlsMaxMm(controls, mmValue) {
        if (!controls) return;
        controls.maxDistance = Na__Math__ConvertMmToUnits(mmValue);         // <-- Mutate orbit zoom-out cap
        if (typeof controls.update === 'function') controls.update();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply / Save / Clear Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Override Value Live (No Persistence)
    // ------------------------------------------------------------
    function Na__OrbitMaxDistance__ApplyLive(mmValue, controls, currentEl, showToast) {
        if (!Number.isFinite(mmValue) || mmValue <= 0) {
            if (showToast) showToast('Enter a positive value in mm.', true);
            return;
        }
        Na__OrbitMaxDistance__SetControlsMaxMm(controls, mmValue);
        Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl);
        if (showToast) showToast(`Orbit max set to ${Math.round(mmValue).toLocaleString()} mm (live).`);
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Override Value to R2 Project Data (Localhost Only)
    // ------------------------------------------------------------
    async function Na__OrbitMaxDistance__SaveToProject(mmValue, controls, currentEl, showToast) {
        if (!Number.isFinite(mmValue) || mmValue <= 0) {
            if (showToast) showToast('Enter a positive value in mm before saving.', true);
            return;
        }

        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - cannot save override.', true);
            return;
        }

        const confirmed = window.confirm(`Save orbit max ${Math.round(mmValue).toLocaleString()} mm to R2? This overwrites any existing override.`);
        if (!confirmed) return;

        const result = await Na__CfApi__MergeAndSaveKeys({
            [Na__OrbitMaxDistance__ProjectJsonKey] : mmValue                 // <-- Merge override key at root
        });

        if (result.ok) {
            Na__OrbitMaxDistance__SetControlsMaxMm(controls, mmValue);       // <-- Reflect saved value live
            Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl);
            if (showToast) showToast(`Orbit max ${Math.round(mmValue).toLocaleString()} mm saved to R2.`);
        } else {
            if (showToast) showToast(`Save failed: ${result.error}`, true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear Override From R2 Project Data (Restore Default)
    // ------------------------------------------------------------
    async function Na__OrbitMaxDistance__ClearFromProject(controls, currentEl, inputEl, defaultMaxDistanceMm, showToast) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - nothing to clear.', true);
            return;
        }

        const result = await Na__CfApi__DeleteProjectKeys([Na__OrbitMaxDistance__ProjectJsonKey]);
        if (!result.ok) {
            if (showToast) showToast(`Clear failed: ${result.error}`, true);
            return;
        }

        if (Number.isFinite(defaultMaxDistanceMm)) {
            Na__OrbitMaxDistance__SetControlsMaxMm(controls, defaultMaxDistanceMm); // <-- Restore default cap
            if (inputEl) inputEl.value = Math.round(defaultMaxDistanceMm);
        }
        Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl);
        if (showToast) showToast('Orbit max override cleared from R2.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Localhost-Only Orbit Max Distance Dev Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeOrbitMaxDistanceDevControls(params) {
        const {
            controls,                                                        // <-- Active OrbitControls instance
            defaultMaxDistanceMm,                                            // <-- Per-device default cap (mm)
            showToast                                                        // <-- Toast callback
        } = params || {};

        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Hide on production

        const menuItem   = document.getElementById(Na__OrbitMaxDistance__ItemId);
        const toggleBtn  = document.getElementById(Na__OrbitMaxDistance__ToggleId);
        const panel      = document.getElementById(Na__OrbitMaxDistance__PanelId);
        const currentEl  = document.getElementById(Na__OrbitMaxDistance__CurrentId);
        const inputEl    = document.getElementById(Na__OrbitMaxDistance__InputId);
        const applyBtn   = document.getElementById(Na__OrbitMaxDistance__ApplyBtnId);
        const saveBtn    = document.getElementById(Na__OrbitMaxDistance__SaveBtnId);
        const clearBtn   = document.getElementById(Na__OrbitMaxDistance__ClearBtnId);

        if (!inputEl || !applyBtn || !saveBtn || !clearBtn) return;          // <-- Required inline controls absent

        if (menuItem) menuItem.style.display = '';                           // <-- Reveal the localhost-only menu item

        // Wire collapsible submenu toggle (consistent with other dev panels)
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
                toggleBtn.setAttribute('aria-expanded', String(!isOpen));
            });
        }

        // Pre-populate input with current effective max (mm)
        const initialCurrentMm = Na__OrbitMaxDistance__ReadCurrentMm(controls);
        if (Number.isFinite(initialCurrentMm)) {
            inputEl.value = Math.round(initialCurrentMm);
        }

        Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl);

        if (controls && typeof controls.addEventListener === 'function') {
            controls.addEventListener('change', () => {
                Na__OrbitMaxDistance__RefreshDisplay(controls, currentEl);
            });
        }

        applyBtn.addEventListener('click', () => {
            const mmValue = parseFloat(inputEl.value);
            Na__OrbitMaxDistance__ApplyLive(mmValue, controls, currentEl, showToast);
        });

        saveBtn.addEventListener('click', () => {
            const mmValue = parseFloat(inputEl.value);
            Na__OrbitMaxDistance__SaveToProject(mmValue, controls, currentEl, showToast);
        });

        clearBtn.addEventListener('click', () => {
            Na__OrbitMaxDistance__ClearFromProject(controls, currentEl, inputEl, defaultMaxDistanceMm, showToast);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Orbit Max Distance Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeOrbitMaxDistanceDevControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
