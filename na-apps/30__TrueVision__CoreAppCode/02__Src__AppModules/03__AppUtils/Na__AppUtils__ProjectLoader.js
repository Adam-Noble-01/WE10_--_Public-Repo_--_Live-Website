// =============================================================================
// TRUEVISION3D - APPLICATION UTILITIES - PROJECT LOADER
// =============================================================================
//
// FILE       : Na__AppUtils__ProjectLoader.js
// NAMESPACE  : Na__AppUtils
// MODULE     : ProjectLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : URL utilities and project.json fetching for Whitecardopedia
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Detects localhost vs production environment for API routing.
// - Extracts and normalises the ?project= query parameter from the URL.
// - Fetches project.json from either the local Flask API or GH Pages CDN.
// - Normalises all four historical project.json model URL formats into a
//   flat array of GLB URLs for the model loader.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 24-Feb-2026 - Version 1.0.0
// - Extracted from index.html inline script block (lines 617-721).
// - No logic changes; pure lift-and-shift into standalone module.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants - Web Project Data Paths
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | GH Pages Base URL and Year Fallback
    // ------------------------------------------------------------
    const Na__AppUtils__WebProjectsBaseUrl = 'https://adam-noble-01.github.io/ValeCodebase/WebApps/Whitecardopedia/Projects'; // <-- GH Pages base
    const Na__AppUtils__DefaultProjectYear = '2026';                                                                          // <-- Legacy fallback
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Environment Detection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Detect Localhost Environment
    // ------------------------------------------------------------
    function Na__AppUtils__IsRunningOnLocalhost() {
        const hostname = window.location.hostname;
        const port = window.location.port;
        return hostname === 'localhost' || hostname === '127.0.0.1' || port === '8000';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | URL Parsing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Project Code from URL
    // ------------------------------------------------------------
    function Na__AppUtils__GetProjectCodeFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Normalize Project Folder ID
    // ------------------------------------------------------------
    function Na__AppUtils__NormalizeProjectFolderId(projectCode) {
        if (!projectCode) return null;

        const trimmed = projectCode.replace(/^\/+|\/+$/g, '');
        const hasYearPrefix = /^\d{4}\//.test(trimmed);

        if (hasYearPrefix) {
            return trimmed;
        }

        return `${Na__AppUtils__DefaultProjectYear}/${trimmed}`;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Project JSON Fetching
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch Whitecardopedia project.json
    // ------------------------------------------------------------
    async function Na__AppUtils__FetchProjectJson(projectCode) {
        let projectJsonUrl;

        if (Na__AppUtils__IsRunningOnLocalhost()) {
            projectJsonUrl = `${window.location.origin}/api/projects/${projectCode}`;  // <-- Flask API endpoint
        } else {
            const projectFolderId = Na__AppUtils__NormalizeProjectFolderId(projectCode);
            projectJsonUrl = `${Na__AppUtils__WebProjectsBaseUrl}/${projectFolderId}/project.json`;  // <-- GH Pages path
        }

        const response = await fetch(projectJsonUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch project.json: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Model URL Extraction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Model URLs from project.json (Multi-Format)
    // ------------------------------------------------------------
    // Supports project.json model URL keys across migrated versions:
    //   v4: trueVision_ModelUrls (array), fallback valeVision_ModelUrls
    //   v3: trueVision_ModelUrl_BaseMesh + _Linework, fallback legacy keys
    //   v2: trueVision_ModelUrl (array of versions), fallback legacy key
    //   v1: trueVision_ModelUrl (string), fallback legacy key
    // ------------------------------------------------------------
    function Na__AppUtils__ExtractModelUrls(projectData) {
        if (!projectData) return [];                                     // <-- Guard against null

        // V4 FORMAT | New multi-model array (preferred)
        const trueVisionModelUrls = projectData.trueVision_ModelUrls;
        const legacyModelUrls = projectData.valeVision_ModelUrls;
        if (Array.isArray(trueVisionModelUrls) && trueVisionModelUrls.length > 0) {
            return trueVisionModelUrls;                                  // <-- Pass through directly
        }
        if (Array.isArray(legacyModelUrls) && legacyModelUrls.length > 0) {
            return legacyModelUrls;                                      // <-- Legacy fallback
        }

        // V3 FORMAT | Layered BaseMesh + Linework pair
        const baseMeshUrl  = projectData.trueVision_ModelUrl_BaseMesh || projectData.valeVision_ModelUrl_BaseMesh || null;
        const lineworkUrl  = projectData.trueVision_ModelUrl_Linework || projectData.valeVision_ModelUrl_Linework || null;
        if (baseMeshUrl || lineworkUrl) {
            const urls = [];
            if (baseMeshUrl) urls.push(baseMeshUrl);                     // <-- Add base mesh URL
            if (lineworkUrl) urls.push(lineworkUrl);                     // <-- Add linework URL
            return urls;
        }

        // V2 FORMAT | Array of versioned URLs (take latest)
        const trueVisionModelUrl = projectData.trueVision_ModelUrl;
        const legacyModelUrl = projectData.valeVision_ModelUrl;
        if (Array.isArray(trueVisionModelUrl) && trueVisionModelUrl.length > 0) {
            const latestUrl = trueVisionModelUrl[trueVisionModelUrl.length - 1];
            return [latestUrl];                                          // <-- Use last (latest) version
        }
        if (Array.isArray(legacyModelUrl) && legacyModelUrl.length > 0) {
            const latestUrl = legacyModelUrl[legacyModelUrl.length - 1];
            return [latestUrl];                                          // <-- Use last (latest) version
        }

        // V1 FORMAT | Single string URL (legacy)
        if (typeof trueVisionModelUrl === 'string' && trueVisionModelUrl) {
            return [trueVisionModelUrl];                                 // <-- Wrap single URL in array
        }
        if (typeof legacyModelUrl === 'string' && legacyModelUrl) {
            return [legacyModelUrl];                                     // <-- Legacy fallback
        }

        return [];                                                       // <-- No model URLs found
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project Loader API
    // ------------------------------------------------------------
    export {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectCodeFromUrl,
        Na__AppUtils__NormalizeProjectFolderId,
        Na__AppUtils__FetchProjectJson,
        Na__AppUtils__ExtractModelUrls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

