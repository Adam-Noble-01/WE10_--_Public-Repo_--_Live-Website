// =============================================================================
// TRUEVISION3D - APPLICATION UTILITIES - PROJECT LOADER
// =============================================================================
//
// FILE       : Na__AppUtils__ProjectLoader.js
// NAMESPACE  : Na__AppUtils
// MODULE     : ProjectLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : URL utilities and project data fetching for TrueVision 3D
// CREATED    : 24-Feb-2026
//
// DESCRIPTION:
// - Detects localhost vs production environment for API routing.
// - Extracts ?project= and ?project-folder= query parameters from the URL.
// - Fetches TrueVision__ProjectData__.json from Cloudflare R2 CDN or local server.
// - Supports the new modelGroups format with per-group CDN URLs.
// - Maintains backward compatibility with legacy project.json formats.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 27-Feb-2026 - Version 2.0.0
// - Rewritten to fetch TrueVision__ProjectData__.json from Cloudflare R2 CDN.
// - Added Na__AppUtils__GetProjectFolderFromUrl() for ?project-folder= param.
// - Added Na__AppUtils__FetchTrueVisionProjectData() for new CDN fetch path.
// - Added Na__AppUtils__ExtractModelGroup() for modelGroups format.
// - Legacy Na__AppUtils__FetchProjectJson() and Na__AppUtils__ExtractModelUrls()
//   retained for backward compatibility with older project.json format.
//
// 24-Feb-2026 - Version 1.0.0
// - Extracted from index.html inline script block (lines 617-721).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants - CDN and Path Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | CDN Base URL and R2 Prefix
    // ------------------------------------------------------------
    const Na__AppUtils__CdnBaseUrl     = 'https://cdn.noble-architecture.com';
    const Na__AppUtils__R2Prefix       = 'NaProjectPortal';
    const Na__AppUtils__TvContentDir   = '30__TrueVision__AppContent';
    const Na__AppUtils__TvDataFilename = 'TrueVision__ProjectData__.json';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Legacy GH Pages Base URL (backward compat)
    // ------------------------------------------------------------
    const Na__AppUtils__WebProjectsBaseUrl = 'https://adam-noble-01.github.io/ValeCodebase/WebApps/Whitecardopedia/Projects';
    const Na__AppUtils__DefaultProjectYear = '2026';
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
        return hostname === 'localhost' || hostname === '127.0.0.1' || port === '8000' || port === '8090';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | URL Parsing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Project Code from URL (?project=XX00)
    // ------------------------------------------------------------
    function Na__AppUtils__GetProjectCodeFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Extract Project Folder from URL (?project-folder=XX00__Name)
    // ------------------------------------------------------------
    function Na__AppUtils__GetProjectFolderFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project-folder');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Extract Year from URL (?year=NN)
    // ------------------------------------------------------------
    function Na__AppUtils__GetYearFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('year') || '26';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Normalize Project Folder ID (legacy compat)
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
// REGION | TrueVision Project Data Fetching (New CDN Path)
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch TrueVision__ProjectData__.json from CDN or Local Server
    // ------------------------------------------------------------
    async function Na__AppUtils__FetchTrueVisionProjectData(projectFolder, yearCode) {
        if (!projectFolder) {
            throw new Error('Na__AppUtils__FetchTrueVisionProjectData: projectFolder is required');
        }

        const yearFolderName = `${yearCode}-Projects`;
        let dataUrl;

        if (Na__AppUtils__IsRunningOnLocalhost()) {
            dataUrl = `${window.location.origin}/na-project-portal/${yearFolderName}/${projectFolder}`
                    + `/${Na__AppUtils__TvContentDir}/${Na__AppUtils__TvDataFilename}`;
        } else {
            dataUrl = `${Na__AppUtils__CdnBaseUrl}/${Na__AppUtils__R2Prefix}/${yearFolderName}/${projectFolder}`
                    + `/${Na__AppUtils__TvContentDir}/${Na__AppUtils__TvDataFilename}`;
        }

        console.log(`[TrueVision3D] Fetching project data: ${dataUrl}`);

        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch TrueVision project data: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Model Group Extraction (New Format)
// -----------------------------------------------------------------------------

    // FUNCTION | Extract a Specific Model Group's URLs
    // ------------------------------------------------------------
    function Na__AppUtils__ExtractModelGroup(projectData, groupIndex) {
        if (!projectData || !Array.isArray(projectData.modelGroups)) return [];

        const idx = (typeof groupIndex === 'number') ? groupIndex : 0;
        const group = projectData.modelGroups[idx];

        if (!group || !Array.isArray(group.modelUrls)) return [];
        return group.modelUrls;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Active Group Index from Project Data
    // ------------------------------------------------------------
    function Na__AppUtils__GetActiveGroupIndex(projectData) {
        if (!projectData) return 0;
        const idx = projectData.activeGroupIndex;
        return (typeof idx === 'number' && idx >= 0) ? idx : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Check if Project Data Uses modelGroups Format
    // ------------------------------------------------------------
    function Na__AppUtils__HasModelGroups(projectData) {
        return projectData
            && Array.isArray(projectData.modelGroups)
            && projectData.modelGroups.length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Legacy Project JSON Fetching (Backward Compatibility)
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch Legacy Whitecardopedia project.json
    // ------------------------------------------------------------
    async function Na__AppUtils__FetchProjectJson(projectCode) {
        let projectJsonUrl;

        if (Na__AppUtils__IsRunningOnLocalhost()) {
            projectJsonUrl = `${window.location.origin}/api/projects/${projectCode}`;
        } else {
            const projectFolderId = Na__AppUtils__NormalizeProjectFolderId(projectCode);
            projectJsonUrl = `${Na__AppUtils__WebProjectsBaseUrl}/${projectFolderId}/project.json`;
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
// REGION | Legacy Model URL Extraction (Backward Compatibility)
// -----------------------------------------------------------------------------

    // FUNCTION | Extract Model URLs from Legacy project.json (Multi-Format)
    // ------------------------------------------------------------
    function Na__AppUtils__ExtractModelUrls(projectData) {
        if (!projectData) return [];

        const trueVisionModelUrls = projectData.trueVision_ModelUrls;
        const legacyModelUrls = projectData.valeVision_ModelUrls;
        if (Array.isArray(trueVisionModelUrls) && trueVisionModelUrls.length > 0) {
            return trueVisionModelUrls;
        }
        if (Array.isArray(legacyModelUrls) && legacyModelUrls.length > 0) {
            return legacyModelUrls;
        }

        const baseMeshUrl  = projectData.trueVision_ModelUrl_BaseMesh || projectData.valeVision_ModelUrl_BaseMesh || null;
        const lineworkUrl  = projectData.trueVision_ModelUrl_Linework || projectData.valeVision_ModelUrl_Linework || null;
        if (baseMeshUrl || lineworkUrl) {
            const urls = [];
            if (baseMeshUrl) urls.push(baseMeshUrl);
            if (lineworkUrl) urls.push(lineworkUrl);
            return urls;
        }

        const trueVisionModelUrl = projectData.trueVision_ModelUrl;
        const legacyModelUrl = projectData.valeVision_ModelUrl;
        if (Array.isArray(trueVisionModelUrl) && trueVisionModelUrl.length > 0) {
            return [trueVisionModelUrl[trueVisionModelUrl.length - 1]];
        }
        if (Array.isArray(legacyModelUrl) && legacyModelUrl.length > 0) {
            return [legacyModelUrl[legacyModelUrl.length - 1]];
        }

        if (typeof trueVisionModelUrl === 'string' && trueVisionModelUrl) {
            return [trueVisionModelUrl];
        }
        if (typeof legacyModelUrl === 'string' && legacyModelUrl) {
            return [legacyModelUrl];
        }

        return [];
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
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl,
        Na__AppUtils__NormalizeProjectFolderId,
        Na__AppUtils__FetchTrueVisionProjectData,
        Na__AppUtils__ExtractModelGroup,
        Na__AppUtils__GetActiveGroupIndex,
        Na__AppUtils__HasModelGroups,
        Na__AppUtils__FetchProjectJson,
        Na__AppUtils__ExtractModelUrls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
