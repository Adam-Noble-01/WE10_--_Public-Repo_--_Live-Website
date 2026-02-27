// =============================================================================
// TRUEVISION3D - CAMERA UTILS - SAVE CAMERA SETTINGS
// =============================================================================
//
// FILE       : Na__UiFeature__SaveCameraSettings.js
// NAMESPACE  : Na__UiFeature
// MODULE     : SaveCameraSettings
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only camera position save feature for project.json
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Provides a save button (localhost only) that writes the current camera
//   position and orbit target back into the active project's project.json
//   via the local Flask API.
// - Fetches the existing project.json, merges Camera__DefaultPosition and
//   OrbitHelperCube__Position, then POSTs the updated document back.
// - Button is hidden on production (non-localhost) environments.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 24-Feb-2026 - Version 1.0.0
// - Extracted from index.html inline script block (lines 888-949).
// - Refactored closures: camera, controls, and showToast are now explicit
//   parameters rather than captured from the parent script scope.
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
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectCodeFromUrl,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Save Camera Settings
// -----------------------------------------------------------------------------

    // FUNCTION | Build Request Context from URL Query
    // ------------------------------------------------------------
    function Na__UiFeature__BuildSaveContext() {
        return {
            projectCode   : Na__AppUtils__GetProjectCodeFromUrl(),
            projectFolder : Na__AppUtils__GetProjectFolderFromUrl(),
            yearCode      : Na__AppUtils__GetYearFromUrl()
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Query String for Save APIs
    // ------------------------------------------------------------
    function Na__UiFeature__BuildSaveQueryString(context) {
        const queryParams = new URLSearchParams();
        if (context.projectFolder) queryParams.set('project-folder', context.projectFolder);
        if (context.yearCode) queryParams.set('year', context.yearCode);
        const queryText = queryParams.toString();
        return queryText ? `?${queryText}` : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Project API URLs
    // ------------------------------------------------------------
    function Na__UiFeature__BuildSaveApiUrls(context) {
        const queryString = Na__UiFeature__BuildSaveQueryString(context);
        const encodedProjectCode = encodeURIComponent(context.projectCode);
        const projectApiUrl = `${window.location.origin}/api/projects/${encodedProjectCode}${queryString}`;
        const projectSyncApiUrl = `${window.location.origin}/api/projects/${encodedProjectCode}/sync-cdn${queryString}`;

        return {
            projectApiUrl,
            projectSyncApiUrl
        };
    }
    // ------------------------------------------------------------


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


    // FUNCTION | Merge Camera Data Into Project JSON (Pure)
    // ------------------------------------------------------------
    function Na__UiFeature__MergeCameraIntoProjectData(projectData, cameraData) {
        const mergedData = JSON.parse(JSON.stringify(projectData));

        if (mergedData.trueVision_Camera__DefaultPosition) {
            delete mergedData.trueVision_Camera__DefaultPosition;            // <-- Remove migrated legacy camera payload variant
        }
        if (mergedData.valeVision_Camera__DefaultPosition) {
            delete mergedData.valeVision_Camera__DefaultPosition;            // <-- Remove legacy camera payload to avoid target precedence conflicts
        }
        if (mergedData.Camera__DefaultPosition && mergedData.Camera__DefaultPosition.Camera__DefaultTarget) {
            delete mergedData.Camera__DefaultPosition.Camera__DefaultTarget; // <-- Remove deprecated target key from modern camera block
        }

        mergedData.Camera__DefaultPosition  = cameraData.Camera__DefaultPosition;   // <-- Merge camera position
        mergedData.OrbitHelperCube__Position = cameraData.OrbitHelperCube__Position; // <-- Merge orbit target

        return mergedData;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read Project Data JSON from Local API
    // ------------------------------------------------------------
    async function Na__UiFeature__FetchProjectData(projectApiUrl) {
        const projectResponse = await fetch(projectApiUrl);
        if (!projectResponse.ok) {
            return { ok: false, error: 'Project not found' };
        }

        const projectData = await projectResponse.json();
        return { ok: true, data: projectData };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Project Data JSON to Local API
    // ------------------------------------------------------------
    async function Na__UiFeature__SaveProjectData(projectApiUrl, projectData) {
        const saveResponse = await fetch(projectApiUrl, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify(projectData)
        });

        if (!saveResponse.ok) {
            const errorData = await saveResponse.json().catch(() => ({}));
            return { ok: false, error: errorData.error || 'Unknown error' };
        }

        return { ok: true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Push Project JSON to CDN Via Local API
    // ------------------------------------------------------------
    async function Na__UiFeature__SyncProjectDataToCdn(projectSyncApiUrl, context) {
        const syncResponse = await fetch(projectSyncApiUrl, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify({
                projectFolder : context.projectFolder,
                year          : context.yearCode
            })
        });

        if (!syncResponse.ok) {
            const syncErrorData = await syncResponse.json().catch(() => ({}));
            return { ok: false, error: syncErrorData.error || 'Unknown error' };
        }

        return { ok: true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Confirm Upload Prompt
    // ------------------------------------------------------------
    function Na__UiFeature__ConfirmCdnUpload() {
        return window.confirm(
            'Camera settings were saved locally. Upload this project JSON to CDN now?'
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Save Camera Settings to Project JSON (Localhost Only)
    // ------------------------------------------------------------
    async function Na__UiFeature__SaveCameraSettings(camera, controls, showToast) {
        const context = Na__UiFeature__BuildSaveContext();
        if (!context.projectCode) {
            showToast('No project loaded - cannot save camera settings.', true);
            return;
        }

        try {
            const cameraData = Na__UiFeature__BuildCameraPayload(camera, controls);
            const apiUrls = Na__UiFeature__BuildSaveApiUrls(context);

            const projectFetchResult = await Na__UiFeature__FetchProjectData(apiUrls.projectApiUrl);
            if (!projectFetchResult.ok) {
                showToast(`Project not found: ${context.projectCode}`, true);
                return;
            }

            const mergedProjectData = Na__UiFeature__MergeCameraIntoProjectData(projectFetchResult.data, cameraData);
            const saveResult = await Na__UiFeature__SaveProjectData(apiUrls.projectApiUrl, mergedProjectData);
            if (!saveResult.ok) {
                showToast(`Save failed: ${saveResult.error}`, true);
                return;
            }

            showToast(`Camera settings saved locally for ${context.projectCode}`);

            const shouldUploadToCdn = Na__UiFeature__ConfirmCdnUpload();
            if (!shouldUploadToCdn) {
                showToast('Local save complete. CDN upload skipped.');
                return;
            }

            const syncResult = await Na__UiFeature__SyncProjectDataToCdn(apiUrls.projectSyncApiUrl, context);
            if (syncResult.ok) {
                showToast(`Camera settings saved and uploaded for ${context.projectCode}`);
            } else {
                showToast(`Saved locally. CDN upload failed: ${syncResult.error}`, true);
            }
        } catch (error) {
            console.error('[TrueVision3D] Save camera settings error:', error);
            showToast('Save failed - server unreachable.', true);
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

