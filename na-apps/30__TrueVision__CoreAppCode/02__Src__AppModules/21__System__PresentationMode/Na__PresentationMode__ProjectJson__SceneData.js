// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - PROJECT DATA SCENE DATA
// =============================================================================
//
// FILE       : Na__PresentationMode__ProjectJson__SceneData.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Project Data Scene Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read, validate, normalise and expose saved camera scenes from
//              the per-project PresentationMode__SavedCameraScenes JSON block
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Reads and validates the PresentationMode__SavedCameraScenes block from a
//   loaded TrueVision__ProjectData__.json object.
// - Provides helpers to check whether a project has valid saved scenes, sort
//   scenes by Order, get the default scene, get a scene by id, and resolve
//   thumbnail URLs against the project's R2 CDN content path.
// - Holds module-level state for the active project's scene config, the active
//   project folder + year (used for thumbnail URL resolution) and the
//   currently selected scene id.
// - Pure data layer - no DOM, no camera operations.
//
// INTEGRATION:
// - Called from Na__AppFlow__LoadingSequence.js after projectData is fetched.
// - Consumed by Na__PresentationMode__UI__SceneCarousel.js and the dev editor.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D. Thumbnail URL resolution rewired to the
//   TrueVision R2 CDN content path (folder + year aware).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | CDN Content URL Builder + Localhost Detection
    // ------------------------------------------------------------
    import { Na__CfApi__BuildContentCdnUrl } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | JSON Section and Scene Key Names
    // ------------------------------------------------------------
    const Na__PresentationMode__SECTION_KEY       = 'PresentationMode__SavedCameraScenes';            // <-- Root block key
    const Na__PresentationMode__ENABLED_KEY       = 'PresentationMode__SavedCameraScenes__Enabled';   // <-- Enabled flag key
    const Na__PresentationMode__SCENES_KEY        = 'PresentationMode__SavedCameraScenes__Scenes';    // <-- Scenes array key
    const Na__PresentationMode__DEFAULT_SCENE_KEY = 'PresentationMode__SavedCameraScenes__DefaultSceneId'; // <-- Default scene id key
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Active Project Scene Config and Selection
    // ------------------------------------------------------------
    let Na__PresentationMode__ActiveConfig        = null;   // <-- Full PresentationMode__SavedCameraScenes block
    let Na__PresentationMode__ActiveProjectFolder = null;   // <-- Project folder used to resolve thumbnail URLs
    let Na__PresentationMode__ActiveYearCode      = null;   // <-- Year code used to resolve thumbnail URLs
    let Na__PresentationMode__ActiveSceneId       = null;   // <-- Currently displayed/selected scene id
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Validation Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Validate a Single Scene Object Has Minimum Required Fields
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__IsValidScene(scene) {
        if (!scene || typeof scene !== 'object') return false;

        const id   = scene.PresentationMode__Scene__Id;
        const name = scene.PresentationMode__Scene__Name;
        const cam  = scene.PresentationMode__Scene__CameraPosition;

        if (!id || typeof id !== 'string')   return false;  // <-- Id must exist
        if (!name || typeof name !== 'string') return false; // <-- Name must exist
        if (!cam || typeof cam !== 'object')  return false;  // <-- Camera block must exist

        const pos = cam.Camera__DefaultPos;
        if (!pos) return false;

        const x = pos.Camera__DefaultPos__PosX;
        const y = pos.Camera__DefaultPos__PosY;
        const z = pos.Camera__DefaultPos__PosZ;

        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z); // <-- Position values must be numeric
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Filter Raw Scenes Array to Valid Scenes Only
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__FilterValidScenes(scenes) {
        if (!Array.isArray(scenes)) return [];
        return scenes.filter(Na__PresentationMode__ProjectJson__IsValidScene); // <-- Discard any malformed entries
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Scene Data Accessors
// -----------------------------------------------------------------------------

    // FUNCTION | Get Raw PresentationMode Block from Project Data
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetSavedCameraScenes(projectData) {
        if (!projectData || typeof projectData !== 'object') return null;
        return projectData[Na__PresentationMode__SECTION_KEY] || null; // <-- Return the block or null if absent
    }
    // ------------------------------------------------------------


    // FUNCTION | Check Whether projectData Contains Valid Saved Scenes
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__HasValidSavedScenes(projectData) {
        const config = Na__PresentationMode__ProjectJson__GetSavedCameraScenes(projectData);
        if (!config) return false;                                           // <-- No section at all

        if (config[Na__PresentationMode__ENABLED_KEY] !== true) return false; // <-- Explicitly disabled

        const scenes = Na__PresentationMode__ProjectJson__FilterValidScenes(config[Na__PresentationMode__SCENES_KEY]);
        return scenes.length > 0;                                            // <-- At least one valid scene required
    }
    // ------------------------------------------------------------


    // FUNCTION | Sort Scenes Array by Order Field (ascending)
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__SortScenesByOrder(scenes) {
        if (!Array.isArray(scenes)) return [];
        return [...scenes].sort((a, b) => {
            const orderA = Number.isFinite(a.PresentationMode__Scene__Order) ? a.PresentationMode__Scene__Order : 999;
            const orderB = Number.isFinite(b.PresentationMode__Scene__Order) ? b.PresentationMode__Scene__Order : 999;
            return orderA - orderB;                                          // <-- Ascending order
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Default Scene from the Active Config
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetDefaultScene(config) {
        if (!config) return null;

        const sorted = Na__PresentationMode__ProjectJson__SortScenesByOrder(
            Na__PresentationMode__ProjectJson__FilterValidScenes(config[Na__PresentationMode__SCENES_KEY])
        );
        if (sorted.length === 0) return null;

        const defaultId = config[Na__PresentationMode__DEFAULT_SCENE_KEY];
        if (defaultId) {
            const match = sorted.find(s => s.PresentationMode__Scene__Id === defaultId);
            if (match) return match;                                         // <-- Use configured default
        }

        return sorted[0];                                                    // <-- Fallback to first sorted scene
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Specific Scene by Id
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetSceneById(config, sceneId) {
        if (!config || !sceneId) return null;

        const scenes = Na__PresentationMode__ProjectJson__FilterValidScenes(config[Na__PresentationMode__SCENES_KEY]);
        return scenes.find(s => s.PresentationMode__Scene__Id === sceneId) || null; // <-- Return matching scene or null
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Thumbnail URL for a Scene (TrueVision R2 CDN content path)
    // ------------------------------------------------------------
    // Thumbnail URL from JSON is a relative path like:
    //   "PresentationMode/Thumbnails/Scene_001.webp"
    // Resolved against the project's R2 CDN content directory. A cache-bust
    // query is appended so freshly re-uploaded thumbnails refresh immediately.
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__ResolveThumbnailUrl(scene) {
        const rawUrl = scene && scene.PresentationMode__Scene__ThumbnailUrl;
        if (!rawUrl) return null;

        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('/')) {
            return rawUrl;                                                   // <-- Already absolute, pass through
        }

        const folder = Na__PresentationMode__ActiveProjectFolder;
        const year   = Na__PresentationMode__ActiveYearCode;
        if (!folder) return null;

        const cdnUrl = Na__CfApi__BuildContentCdnUrl(folder, year, rawUrl); // <-- cdn.../<year>-Projects/<folder>/30__TrueVision__AppContent/<rawUrl>

        // Cache-bust on localhost so regenerated thumbnails show without a hard reload.
        return Na__AppUtils__IsRunningOnLocalhost() ? `${cdnUrl}?t=${Date.now()}` : cdnUrl;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Management
// -----------------------------------------------------------------------------

    // FUNCTION | Store Active Project Scene Config (called by carousel on scenes-loaded)
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__SetActiveConfig(config, projectFolder, yearCode) {
        Na__PresentationMode__ActiveConfig        = config || null;        // <-- Persist config for this session
        Na__PresentationMode__ActiveProjectFolder = projectFolder || null; // <-- Persist folder for URL resolution
        Na__PresentationMode__ActiveYearCode      = yearCode || null;      // <-- Persist year for URL resolution
        Na__PresentationMode__ActiveSceneId       = null;                  // <-- Reset selection on new project load
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Stored Active Config
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetActiveConfig() {
        return Na__PresentationMode__ActiveConfig; // <-- Return currently loaded project config block
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Currently Active Scene Id
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__SetActiveSceneId(sceneId) {
        Na__PresentationMode__ActiveSceneId = sceneId || null; // <-- Track which scene is currently showing
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Currently Active Scene Id
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetActiveSceneId() {
        return Na__PresentationMode__ActiveSceneId; // <-- Return current selection
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Sorted Valid Scenes from Active Config
    // ------------------------------------------------------------
    function Na__PresentationMode__ProjectJson__GetSortedScenes() {
        if (!Na__PresentationMode__ActiveConfig) return [];

        const scenes = Na__PresentationMode__ProjectJson__FilterValidScenes(
            Na__PresentationMode__ActiveConfig[Na__PresentationMode__SCENES_KEY]
        );
        return Na__PresentationMode__ProjectJson__SortScenesByOrder(scenes); // <-- Pre-sorted, pre-filtered
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Presentation Mode Scene Data API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__ProjectJson__GetSavedCameraScenes,
        Na__PresentationMode__ProjectJson__HasValidSavedScenes,
        Na__PresentationMode__ProjectJson__SortScenesByOrder,
        Na__PresentationMode__ProjectJson__GetDefaultScene,
        Na__PresentationMode__ProjectJson__GetSceneById,
        Na__PresentationMode__ProjectJson__ResolveThumbnailUrl,
        Na__PresentationMode__ProjectJson__SetActiveConfig,
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__SetActiveSceneId,
        Na__PresentationMode__ProjectJson__GetActiveSceneId,
        Na__PresentationMode__ProjectJson__GetSortedScenes
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
