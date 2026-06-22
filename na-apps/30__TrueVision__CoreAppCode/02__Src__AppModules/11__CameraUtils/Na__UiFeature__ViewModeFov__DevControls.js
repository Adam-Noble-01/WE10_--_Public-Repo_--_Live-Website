// =============================================================================
// TRUEVISION3D - CAMERA UTILS - VIEW MODE FOV DEV CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__ViewModeFov__DevControls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : ViewModeFov DevControls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev Tools panel for per-project default camera FOV overrides
//              across the Orbit, Walk and Fly view modes
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Localhost-only Dev Tools panel to view, apply, save and clear per-project
//   default field-of-view (degrees) values for each navigation mode.
// - Apply Live : Orbit sets the main camera FOV instantly; Walk/Fly stage the
//                override (and live-update if that mode is currently active).
// - Save       : writes Navmode__FovOverrides to R2 (TrueVision__ProjectData__.json),
//                overriding the master FOV defaults from Na__AppConfig__Main.json.
// - Clear      : deletes Navmode__FovOverrides from R2 and restores master FOVs.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeViewModeFovDevControls({ camera, masterFovs,
//   showToast }).
// - masterFovs : { orbitDeg, walkDeg, flyDeg } resolved from app config so the
//   Clear action and initial inputs reflect the master defaults.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Initial release. Sibling to Na__UiFeature__OrbitMaxDistance__DevControls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Walk / Fly FOV Override Setters
    // ------------------------------------------------------------
    import { Na__WalkMode__SetFovOverride } from '../10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js';
    import { Na__FlyMode__SetFovOverride }  from '../10__NavigationAndCameras/Na__Navmode__FlyMode__SystemLogic.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__GetLoadedProjectData,
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
    const Na__ViewModeFov__ItemId      = 'naViewModeFovItem';        // <-- Dev menu list item (localhost-only)
    const Na__ViewModeFov__ToggleId    = 'naViewModeFovToggle';      // <-- Submenu open/close button
    const Na__ViewModeFov__PanelId     = 'naViewModeFovPanel';       // <-- Collapsible panel container
    const Na__ViewModeFov__OrbitInput  = 'naViewModeFovOrbitInput';  // <-- Orbit FOV number input (deg)
    const Na__ViewModeFov__WalkInput   = 'naViewModeFovWalkInput';   // <-- Walk FOV number input (deg)
    const Na__ViewModeFov__FlyInput    = 'naViewModeFovFlyInput';    // <-- Fly FOV number input (deg)
    const Na__ViewModeFov__ApplyBtnId  = 'naViewModeFovApply';       // <-- Apply Live button
    const Na__ViewModeFov__SaveBtnId   = 'naViewModeFovSave';        // <-- Save to Project button
    const Na__ViewModeFov__ClearBtnId  = 'naViewModeFovClear';       // <-- Clear from Project button
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Project JSON Keys
    // ------------------------------------------------------------
    const Na__ViewModeFov__ProjectJsonKey = 'Navmode__FovOverrides';        // <-- Root override container key
    const Na__ViewModeFov__OrbitKey       = 'Navmode__FovOverrides__OrbitDeg';
    const Na__ViewModeFov__WalkKey        = 'Navmode__FovOverrides__WalkDeg';
    const Na__ViewModeFov__FlyKey         = 'Navmode__FovOverrides__FlyDeg';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | FOV Bounds (degrees)
    // ------------------------------------------------------------
    const Na__ViewModeFov__MIN = 5;    // <-- Minimum sensible vertical FOV
    const Na__ViewModeFov__MAX = 120;  // <-- Maximum sensible vertical FOV
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Parse + Validate a FOV Degree Input
    // ------------------------------------------------------------
    function Na__ViewModeFov__ParseFov(rawValue) {
        const fov = parseFloat(rawValue);
        if (!Number.isFinite(fov)) return null;                          // <-- Not a number
        if (fov < Na__ViewModeFov__MIN || fov > Na__ViewModeFov__MAX) return null;  // <-- Out of range
        return fov;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Orbit FOV to the Live Main Camera
    // ------------------------------------------------------------
    function Na__ViewModeFov__SetOrbitFovLive(camera, fovDeg) {
        if (!camera || !Number.isFinite(fovDeg)) return;
        camera.fov = fovDeg;                                             // <-- Set vertical FOV (deg)
        camera.updateProjectionMatrix();                                 // <-- Rebuild projection
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read Saved FOV Overrides from Loaded Project Data
    // ------------------------------------------------------------
    // Returns { orbitDeg, walkDeg, flyDeg } (each possibly undefined) from the
    // in-memory full project data registered by the loading sequence.
    // ------------------------------------------------------------
    function Na__ViewModeFov__ReadSavedOverrides() {
        const data = Na__CfApi__GetLoadedProjectData();
        const block = data && data[Na__ViewModeFov__ProjectJsonKey];
        if (!block || typeof block !== 'object') return null;
        return {
            orbitDeg : block[Na__ViewModeFov__OrbitKey],
            walkDeg  : block[Na__ViewModeFov__WalkKey],
            flyDeg   : block[Na__ViewModeFov__FlyKey]
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Populate the Three Input Fields from a FOV Set
    // ------------------------------------------------------------
    function Na__ViewModeFov__PopulateInputs(inputs, fovSet) {
        if (!fovSet) return;
        if (inputs.orbitEl && Number.isFinite(fovSet.orbitDeg)) inputs.orbitEl.value = Math.round(fovSet.orbitDeg * 100) / 100;
        if (inputs.walkEl  && Number.isFinite(fovSet.walkDeg))  inputs.walkEl.value  = Math.round(fovSet.walkDeg * 100) / 100;
        if (inputs.flyEl   && Number.isFinite(fovSet.flyDeg))   inputs.flyEl.value   = Math.round(fovSet.flyDeg * 100) / 100;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Three Inputs into a Validated FOV Set
    // ------------------------------------------------------------
    // Returns { orbitDeg, walkDeg, flyDeg } where each entry may be null when
    // the corresponding input is blank/invalid. Callers decide how to treat null.
    // ------------------------------------------------------------
    function Na__ViewModeFov__ReadInputs(orbitEl, walkEl, flyEl) {
        return {
            orbitDeg : orbitEl ? Na__ViewModeFov__ParseFov(orbitEl.value) : null,
            walkDeg  : walkEl  ? Na__ViewModeFov__ParseFov(walkEl.value)  : null,
            flyDeg   : flyEl   ? Na__ViewModeFov__ParseFov(flyEl.value)   : null
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply / Save / Clear Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Apply FOV Values Live (No Persistence)
    // ------------------------------------------------------------
    function Na__ViewModeFov__ApplyLive(fovSet, camera, showToast) {
        let applied = 0;

        if (Number.isFinite(fovSet.orbitDeg)) {
            Na__ViewModeFov__SetOrbitFovLive(camera, fovSet.orbitDeg);   // <-- Orbit reflects instantly
            applied++;
        }
        if (Number.isFinite(fovSet.walkDeg)) {
            Na__WalkMode__SetFovOverride(fovSet.walkDeg);                // <-- Staged + live if walking
            applied++;
        }
        if (Number.isFinite(fovSet.flyDeg)) {
            Na__FlyMode__SetFovOverride(fovSet.flyDeg);                  // <-- Staged + live if flying
            applied++;
        }

        if (showToast) {
            applied > 0
                ? showToast('View-mode FOV applied live.')
                : showToast('Enter a FOV between 5 and 120 degrees.', true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save FOV Overrides to R2 Project Data (Localhost Only)
    // ------------------------------------------------------------
    async function Na__ViewModeFov__SaveToProject(fovSet, camera, showToast) {
        if (!Number.isFinite(fovSet.orbitDeg) && !Number.isFinite(fovSet.walkDeg) && !Number.isFinite(fovSet.flyDeg)) {
            if (showToast) showToast('Enter at least one valid FOV (5-120) before saving.', true);
            return;
        }

        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - cannot save FOV overrides.', true);
            return;
        }

        // BUILD OVERRIDE BLOCK | Only include the modes the dev actually set
        const overrideBlock = {
            Navmode__FovOverrides__Description : 'Per-project default camera FOVs (vertical degrees) overriding the master app config defaults.'
        };
        if (Number.isFinite(fovSet.orbitDeg)) overrideBlock[Na__ViewModeFov__OrbitKey] = fovSet.orbitDeg;
        if (Number.isFinite(fovSet.walkDeg))  overrideBlock[Na__ViewModeFov__WalkKey]  = fovSet.walkDeg;
        if (Number.isFinite(fovSet.flyDeg))   overrideBlock[Na__ViewModeFov__FlyKey]   = fovSet.flyDeg;

        const confirmed = window.confirm('Save these view-mode FOV overrides to R2? This overwrites any existing overrides for this project.');
        if (!confirmed) return;

        const result = await Na__CfApi__MergeAndSaveKeys({
            [Na__ViewModeFov__ProjectJsonKey] : overrideBlock                // <-- Merge override container at root
        });

        if (result.ok) {
            Na__ViewModeFov__ApplyLive(fovSet, camera, null);               // <-- Reflect saved values live (silent)
            if (showToast) showToast('View-mode FOV overrides saved to R2.');
        } else {
            if (showToast) showToast(`Save failed: ${result.error}`, true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear FOV Overrides From R2 Project Data (Restore Master Defaults)
    // ------------------------------------------------------------
    async function Na__ViewModeFov__ClearFromProject(camera, masterFovs, inputs, showToast) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - nothing to clear.', true);
            return;
        }

        const result = await Na__CfApi__DeleteProjectKeys([Na__ViewModeFov__ProjectJsonKey]);
        if (!result.ok) {
            if (showToast) showToast(`Clear failed: ${result.error}`, true);
            return;
        }

        // RESTORE MASTER DEFAULTS | Live camera + staged Walk/Fly + input fields
        if (masterFovs) {
            if (Number.isFinite(masterFovs.orbitDeg)) {
                Na__ViewModeFov__SetOrbitFovLive(camera, masterFovs.orbitDeg);
                if (inputs.orbitEl) inputs.orbitEl.value = masterFovs.orbitDeg;
            }
            if (Number.isFinite(masterFovs.walkDeg)) {
                Na__WalkMode__SetFovOverride(masterFovs.walkDeg);
                if (inputs.walkEl) inputs.walkEl.value = masterFovs.walkDeg;
            }
            if (Number.isFinite(masterFovs.flyDeg)) {
                Na__FlyMode__SetFovOverride(masterFovs.flyDeg);
                if (inputs.flyEl) inputs.flyEl.value = masterFovs.flyDeg;
            }
        }

        if (showToast) showToast('View-mode FOV overrides cleared from R2.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Localhost-Only View Mode FOV Dev Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeViewModeFovDevControls(params) {
        const {
            camera,                                                          // <-- Main orbit/perspective camera
            masterFovs,                                                      // <-- { orbitDeg, walkDeg, flyDeg } master defaults
            showToast                                                        // <-- Toast callback
        } = params || {};

        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Hide on production

        const menuItem = document.getElementById(Na__ViewModeFov__ItemId);
        const toggleBtn = document.getElementById(Na__ViewModeFov__ToggleId);
        const panel     = document.getElementById(Na__ViewModeFov__PanelId);
        const orbitEl   = document.getElementById(Na__ViewModeFov__OrbitInput);
        const walkEl    = document.getElementById(Na__ViewModeFov__WalkInput);
        const flyEl     = document.getElementById(Na__ViewModeFov__FlyInput);
        const applyBtn  = document.getElementById(Na__ViewModeFov__ApplyBtnId);
        const saveBtn   = document.getElementById(Na__ViewModeFov__SaveBtnId);
        const clearBtn  = document.getElementById(Na__ViewModeFov__ClearBtnId);

        if (!orbitEl || !walkEl || !flyEl || !applyBtn || !saveBtn || !clearBtn) return;  // <-- Required controls absent

        if (menuItem) menuItem.style.display = '';                           // <-- Reveal the localhost-only menu item

        // Wire collapsible submenu toggle (consistent with other dev panels)
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
                toggleBtn.setAttribute('aria-expanded', String(!isOpen));
            });
        }

        const inputs = { orbitEl, walkEl, flyEl };

        // PRE-POPULATE INPUTS | Master defaults first (project data loads async)
        Na__ViewModeFov__PopulateInputs(inputs, masterFovs);

        // REFRESH FROM SAVED OVERRIDES once project data is registered (async)
        // The loading sequence dispatches 'na-navigation-modes-loaded' right after
        // it registers the full project data as the dev-menu merge base.
        const Na__ViewModeFov__RefreshFromSaved = () => {
            Na__ViewModeFov__PopulateInputs(inputs, Na__ViewModeFov__ReadSavedOverrides());
        };
        Na__ViewModeFov__RefreshFromSaved();                                 // <-- Catch the case where data already loaded
        window.addEventListener('na-navigation-modes-loaded', Na__ViewModeFov__RefreshFromSaved);

        applyBtn.addEventListener('click', () => {
            const fovSet = Na__ViewModeFov__ReadInputs(orbitEl, walkEl, flyEl);
            Na__ViewModeFov__ApplyLive(fovSet, camera, showToast);
        });

        saveBtn.addEventListener('click', () => {
            const fovSet = Na__ViewModeFov__ReadInputs(orbitEl, walkEl, flyEl);
            Na__ViewModeFov__SaveToProject(fovSet, camera, showToast);
        });

        clearBtn.addEventListener('click', () => {
            Na__ViewModeFov__ClearFromProject(camera, masterFovs, { orbitEl, walkEl, flyEl }, showToast);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | View Mode FOV Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeViewModeFovDevControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
