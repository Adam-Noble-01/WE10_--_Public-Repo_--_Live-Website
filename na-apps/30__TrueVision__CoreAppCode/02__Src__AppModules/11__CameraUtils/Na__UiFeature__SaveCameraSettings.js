// =============================================================================
// TRUEVISION3D - CAMERA UTILS - SAVE CAMERA SETTINGS
// =============================================================================
//
// FILE       : Na__UiFeature__SaveCameraSettings.js
// NAMESPACE  : Na__UiFeature
// MODULE     : SaveCameraSettings
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only camera position save feature (writes to R2)
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Provides a save button (localhost only) that writes the current camera
//   position and orbit target back into the active project's
//   TrueVision__ProjectData__.json on Cloudflare R2 via the na-truevision-api
//   Worker (read-merge-write). The live app reads the change back from R2 - no
//   GitHub push required.
// - Button is hidden on production (non-localhost) environments.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 2.0.0
// - Rewired persistence from the localhost Flask API to the Cloudflare R2 API
//   client as part of the ValeVision parity transplant.
//
// 24-Feb-2026 - Version 1.0.0
// - Extracted from index.html inline script block.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Camera JSON Builder
    // ------------------------------------------------------------
    import { Na__UiFeature__BuildCameraJson } from './Na__UiFeature__CameraPosition__Controls.js';
    // ------------------------------------------------------------

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
// REGION | Save Camera Settings
// -----------------------------------------------------------------------------

    // FUNCTION | Build Camera Payload from Current View
    // ------------------------------------------------------------
    function Na__UiFeature__BuildCameraPayload(camera, controls) {
        const cameraJsonString = Na__UiFeature__BuildCameraJson(
            camera,                                                          // <-- Current camera state
            controls,                                                        // <-- Current orbit controls
            4                                                                // <-- Decimal precision
        );
        return JSON.parse(cameraJsonString);
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Camera Settings to R2 Project Data (Localhost Only)
    // ------------------------------------------------------------
    async function Na__UiFeature__SaveCameraSettings(camera, controls, showToast) {
        const ctx = Na__CfApi__GetProjectContext();
        if (!ctx.projectFolder) {
            showToast('No project loaded - cannot save camera settings.', true);
            return;
        }

        try {
            const cameraData = Na__UiFeature__BuildCameraPayload(camera, controls);

            const result = await Na__CfApi__MergeAndSaveKeys({
                Camera__DefaultPosition  : cameraData.Camera__DefaultPosition,   // <-- Merge camera position/rotation/FOV
                OrbitHelperCube__Position: cameraData.OrbitHelperCube__Position  // <-- Merge orbit target
            });

            if (result.ok) {
                showToast(`Camera settings saved to R2 for ${ctx.projectFolder}.`);
            } else {
                showToast(`Save failed: ${result.error}`, true);
            }
        } catch (error) {
            console.error('[TrueVision3D] Save camera settings error:', error);
            showToast('Save failed - see console.', true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize Localhost-Only Save Button
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeSaveCameraButton(camera, controls, showToast) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return;                   // <-- Only on localhost

        const menuItem = document.getElementById('naSaveCameraSettingsItem');
        const button   = document.getElementById('naSaveCameraSettingsButton');
        if (!menuItem || !button) return;

        menuItem.style.display = '';                                         // <-- Reveal the menu item
        button.addEventListener('click', () => Na__UiFeature__SaveCameraSettings(camera, controls, showToast)); // <-- Wire up save handler
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Save Camera Settings API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeSaveCameraButton
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
