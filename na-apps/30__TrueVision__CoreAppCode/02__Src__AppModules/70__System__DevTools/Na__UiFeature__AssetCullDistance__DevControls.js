// =============================================================================
// TRUEVISION3D - DEV TOOLS - ASSET CULL DISTANCE DEV CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__AssetCullDistance__DevControls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : AssetCullDistance DevControls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dev Tools panel for the per-project furniture / decor cull distance
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Localhost-only Dev Tools section to view, apply, save and clear a
//   per-project asset cull distance (radial distance from the camera, in mm)
//   for the furniture / interior-decor distance culling system.
// - Lives under a divider inside the Orbit Max Zoom Radius panel, since both
//   settings tune the same thing: how far the model reads before it thins out.
// - Apply Live : retunes the live cull registry instantly (no persistence).
// - Save       : writes RenderEffect__AssetCullDistanceMm to R2
//                (TrueVision__ProjectData__.json), so the distance is stored
//                per model rather than globally in AppConfig.
// - Clear      : deletes the key from R2 and restores the AppConfig default.
//
// - The readout reports the active distance, where it came from (project
//   override vs AppConfig default), and live registered / culled item counts
//   so the effect of a change is visible without hunting the console.
//
// INTEGRATION:
// - Call Na__UiFeature__InitializeAssetCullDistanceDevControls({ camera,
//   defaultCullDistanceMm, showToast }).
// - The loading sequence applies any saved override before the models load, so
//   the registry is built against the project distance from the first frame.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial release. Mirrors the Orbit Max Distance dev panel: same
//   Apply / Save / Clear contract against the same R2 project-data document.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Distance Culling Engine
    // ------------------------------------------------------------
    import {
        Na__DistanceCulling__SetCullDistanceMm,
        Na__DistanceCulling__GetStats,
        Na__DistanceCulling__Update
    } from '../05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Loader Utilities
    // ------------------------------------------------------------
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
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
    const Na__AssetCullDistance__SectionId  = 'naAssetCullDistanceSection';  // <-- Section wrapper (localhost-only)
    const Na__AssetCullDistance__CurrentId  = 'naAssetCullDistanceCurrent';  // <-- Active distance display
    const Na__AssetCullDistance__SourceId   = 'naAssetCullDistanceSource';   // <-- Project override vs AppConfig default
    const Na__AssetCullDistance__StatsId    = 'naAssetCullDistanceStats';    // <-- Registered / culled item counts
    const Na__AssetCullDistance__InputId    = 'naAssetCullDistanceInput';    // <-- Number input (mm)
    const Na__AssetCullDistance__ApplyBtnId = 'naAssetCullDistanceApply';    // <-- Apply Live button
    const Na__AssetCullDistance__SaveBtnId  = 'naAssetCullDistanceSave';     // <-- Save to Project button
    const Na__AssetCullDistance__ClearBtnId = 'naAssetCullDistanceClear';    // <-- Clear from Project button
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Host Panel Toggle (shared with Orbit Max Zoom Radius)
    // ------------------------------------------------------------
    const Na__AssetCullDistance__HostToggleId = 'naOrbitMaxDistanceToggle';  // <-- This section lives inside that panel
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Project JSON Key
    // ------------------------------------------------------------
    const Na__AssetCullDistance__ProjectJsonKey = 'RenderEffect__AssetCullDistanceMm';  // <-- Per-project override key (mm)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Format Mm Value for Display
    // ------------------------------------------------------------
    function Na__AssetCullDistance__FormatMm(mmValue) {
        if (!Number.isFinite(mmValue) || mmValue <= 0) return '-';
        return `${Math.round(mmValue).toLocaleString()} mm`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Saved Project Override (Mm) or Null
    // ------------------------------------------------------------
    // Reads the in-memory merge base, which the API client keeps current after
    // every save and clear, so the source label never goes stale.
    // ------------------------------------------------------------
    function Na__AssetCullDistance__ReadProjectOverrideMm() {
        const projectData = Na__CfApi__GetLoadedProjectData();
        if (!projectData) return null;
        const savedMm = projectData[Na__AssetCullDistance__ProjectJsonKey];
        return Number.isFinite(savedMm) ? savedMm : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Refresh the Readout Rows From Live Engine State
    // ------------------------------------------------------------
    function Na__AssetCullDistance__RefreshDisplay(elements) {
        const { currentEl, sourceEl, statsEl } = elements;
        const stats = Na__DistanceCulling__GetStats();

        if (currentEl) {
            currentEl.textContent = stats.enabled
                ? Na__AssetCullDistance__FormatMm(stats.cullDistanceMm)
                : 'Disabled';                                                // <-- Culling switched off in AppConfig
        }

        if (sourceEl) {
            const overrideMm = Na__AssetCullDistance__ReadProjectOverrideMm();
            sourceEl.textContent = Number.isFinite(overrideMm)
                ? 'Project override'                                         // <-- Saved on this model in R2
                : 'AppConfig default';                                       // <-- Falling back to the global default
        }

        if (statsEl) {
            statsEl.textContent = stats.registeredCount > 0
                ? `${stats.registeredCount.toLocaleString()} items - ${stats.culledCount.toLocaleString()} culled`
                : 'No cullable items registered';                            // <-- Model not loaded, or no matching categories
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Sync the Input Field to the Live Cull Distance
    // ------------------------------------------------------------
    // Stands down permanently once the field has been typed in, so an in-flight
    // edit is never overwritten by a late-arriving project override.
    // ------------------------------------------------------------
    function Na__AssetCullDistance__SyncInputFromEngine(inputEl) {
        if (!inputEl || inputEl.dataset.naUserEdited === 'true') return;
        const stats = Na__DistanceCulling__GetStats();
        if (!Number.isFinite(stats.cullDistanceMm) || stats.cullDistanceMm <= 0) return;
        inputEl.value = Math.round(stats.cullDistanceMm);                    // <-- Mirror the live distance (mm)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push a Distance Into the Engine and Redraw
    // ------------------------------------------------------------
    // Retunes the registry, settles visibility against the current camera so
    // the change is correct even while the camera is stationary, then asks the
    // invalidation render loop for a frame.
    // ------------------------------------------------------------
    function Na__AssetCullDistance__ApplyToEngine(mmValue, camera) {
        if (!Na__DistanceCulling__SetCullDistanceMm(mmValue)) return false;

        if (camera && camera.position) {
            Na__DistanceCulling__Update(camera.position);                    // <-- Re-evaluate now; camera may not move again
        }
        Na__RenderLoop__RequestRender();                                     // <-- Draw the result

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Apply / Save / Clear Actions
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Cull Distance Live (No Persistence)
    // ------------------------------------------------------------
    function Na__AssetCullDistance__ApplyLive(mmValue, camera, elements, showToast) {
        if (!Number.isFinite(mmValue) || mmValue <= 0) {
            if (showToast) showToast('Enter a positive cull distance in mm.', true);
            return;
        }

        if (!Na__AssetCullDistance__ApplyToEngine(mmValue, camera)) {
            if (showToast) showToast('Cull distance rejected by the culling engine.', true);
            return;
        }

        Na__AssetCullDistance__RefreshDisplay(elements);
        if (showToast) showToast(`Asset cull distance set to ${Math.round(mmValue).toLocaleString()} mm (live).`);
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Cull Distance to R2 Project Data (Localhost Only)
    // ------------------------------------------------------------
    async function Na__AssetCullDistance__SaveToProject(mmValue, camera, elements, showToast) {
        if (!Number.isFinite(mmValue) || mmValue <= 0) {
            if (showToast) showToast('Enter a positive cull distance in mm before saving.', true);
            return;
        }

        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - cannot save cull distance.', true);
            return;
        }

        const confirmed = window.confirm(`Save asset cull distance ${Math.round(mmValue).toLocaleString()} mm to R2? This overwrites any existing override.`);
        if (!confirmed) return;

        const result = await Na__CfApi__MergeAndSaveKeys({
            [Na__AssetCullDistance__ProjectJsonKey] : mmValue                // <-- Merge override key at root
        });

        if (result.ok) {
            Na__AssetCullDistance__ApplyToEngine(mmValue, camera);           // <-- Reflect saved value live
            Na__AssetCullDistance__RefreshDisplay(elements);
            if (showToast) showToast(`Asset cull distance ${Math.round(mmValue).toLocaleString()} mm saved to R2.`);
        } else {
            if (showToast) showToast(`Save failed: ${result.error}`, true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear Cull Distance From R2 Project Data (Restore Default)
    // ------------------------------------------------------------
    async function Na__AssetCullDistance__ClearFromProject(camera, elements, inputEl, defaultCullDistanceMm, showToast) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            if (showToast) showToast('No project loaded - nothing to clear.', true);
            return;
        }

        const result = await Na__CfApi__DeleteProjectKeys([Na__AssetCullDistance__ProjectJsonKey]);
        if (!result.ok) {
            if (showToast) showToast(`Clear failed: ${result.error}`, true);
            return;
        }

        if (Number.isFinite(defaultCullDistanceMm) && defaultCullDistanceMm > 0) {
            Na__AssetCullDistance__ApplyToEngine(defaultCullDistanceMm, camera);  // <-- Restore AppConfig default
            if (inputEl) inputEl.value = Math.round(defaultCullDistanceMm);
        }
        Na__AssetCullDistance__RefreshDisplay(elements);
        if (showToast) showToast('Asset cull distance override cleared from R2.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Localhost-Only Asset Cull Distance Dev Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeAssetCullDistanceDevControls(params) {
        const {
            camera,                                                          // <-- Active main camera (for immediate re-cull)
            defaultCullDistanceMm,                                           // <-- AppConfig cull distance (mm)
            showToast                                                        // <-- Toast callback
        } = params || {};

        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Hide on production

        const section    = document.getElementById(Na__AssetCullDistance__SectionId);
        const currentEl  = document.getElementById(Na__AssetCullDistance__CurrentId);
        const sourceEl   = document.getElementById(Na__AssetCullDistance__SourceId);
        const statsEl    = document.getElementById(Na__AssetCullDistance__StatsId);
        const inputEl    = document.getElementById(Na__AssetCullDistance__InputId);
        const applyBtn   = document.getElementById(Na__AssetCullDistance__ApplyBtnId);
        const saveBtn    = document.getElementById(Na__AssetCullDistance__SaveBtnId);
        const clearBtn   = document.getElementById(Na__AssetCullDistance__ClearBtnId);
        const hostToggle = document.getElementById(Na__AssetCullDistance__HostToggleId);

        if (!inputEl || !applyBtn || !saveBtn || !clearBtn) return;          // <-- Required inline controls absent

        const elements = { currentEl, sourceEl, statsEl };

        if (section) section.style.display = '';                             // <-- Reveal the localhost-only section

        // The host panel's own toggle handler is owned by the Orbit Max
        // Distance module. Refreshing on every click of it - open or close -
        // keeps this section current without depending on listener order.
        if (hostToggle) {
            hostToggle.addEventListener('click', () => {
                Na__AssetCullDistance__SyncInputFromEngine(inputEl);
                Na__AssetCullDistance__RefreshDisplay(elements);
            });
        }

        inputEl.addEventListener('input', () => {
            inputEl.dataset.naUserEdited = 'true';                           // <-- Typed value now wins over auto-sync
        });

        // This module initialises during boot, before the models load and
        // before the cull registry exists, so the counts only become real once
        // the scene is up. The scene-ready broadcast is the first point at
        // which both the project override and the registry are in place.
        window.addEventListener('na-app-scene-ready', () => {
            Na__AssetCullDistance__SyncInputFromEngine(inputEl);
            Na__AssetCullDistance__RefreshDisplay(elements);
        });

        Na__AssetCullDistance__SyncInputFromEngine(inputEl);
        Na__AssetCullDistance__RefreshDisplay(elements);

        applyBtn.addEventListener('click', () => {
            const mmValue = parseFloat(inputEl.value);
            Na__AssetCullDistance__ApplyLive(mmValue, camera, elements, showToast);
        });

        saveBtn.addEventListener('click', () => {
            const mmValue = parseFloat(inputEl.value);
            Na__AssetCullDistance__SaveToProject(mmValue, camera, elements, showToast);
        });

        clearBtn.addEventListener('click', () => {
            Na__AssetCullDistance__ClearFromProject(camera, elements, inputEl, defaultCullDistanceMm, showToast);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Asset Cull Distance Dev Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeAssetCullDistanceDevControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
