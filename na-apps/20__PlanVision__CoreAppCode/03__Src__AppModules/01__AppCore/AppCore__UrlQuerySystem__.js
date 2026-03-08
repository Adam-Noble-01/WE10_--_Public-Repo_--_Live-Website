// =============================================================================
// NOBLE ARCHITECTURE - URL QUERY SYSTEM
// =============================================================================
//
// FILE       : AppCore__UrlQuerySystem__.js
// NAMESPACE  : NaPlanVision.UrlQuerySystem
// MODULE     : UrlQuerySystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Parse URL query parameters to resolve project context
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Reads ?project=XX00 and related query values
// - Resolves project paths for local and production environments
// - Includes 20__PlanVision__AppContent in content path resolution
// - Builds project data file URLs using standard naming conventions
//
// -----
//
// DEVELOPMENT LOG:
// 08-Mar-2026 - Version 1.1.0
// - Fixed project content path to include 20__PlanVision__AppContent
// - Fixed data filename to PlanVision__ProjectData__.json (no project code prefix)
// - Exposed projectContentBaseUrl for drawing file resolution
//
// 09-Feb-2026 - Version 1.0.0
// - Initial Stable Release
//   - Query parsing
//   - Local vs production path resolution
//   - Project data file URL builder
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | URL Query System
// --------------------------------------------------------

    (function() {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Defaults
        // --------------------------------------------------------

            const NaProjectQueryKey__Default = 'project';
            const NaProjectYearQueryKey__Default = 'year';
            const NaProjectFolderQueryKey__Default = 'project-folder';

            const NaDefaultProjectCode__Fallback = 'JH03';
            const NaDefaultProjectYear__Fallback = '26';
            const NaDefaultProjectFolder__Fallback = 'JH03__RomerCottage';

            const NaPlanVisionContentDir__Default = '20__PlanVision__AppContent';
            const NaPlanVisionDataFilename__Default = 'PlanVision__ProjectData__.json';

            const NaLocalProjectPortalBase__Fallback = '../na-project-portal';
            const NaLiveProjectPortalBase__Fallback = 'https://www.noble-architecture.com/na-project-portal';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPER FUNCTIONS | Query and Path Helpers
        // --------------------------------------------------------

            function Na__DetectLocalDev() {
                return window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === 'localhost' ||
                    window.location.protocol === 'file:';
            }

            function Na__GetQueryParams() {
                const params = {};
                const searchParams = new URLSearchParams(window.location.search);

                searchParams.forEach((value, key) => {
                    params[key] = value;
                });

                return params;
            }

            function Na__NormaliseProjectCode(projectCode) {
                const validator = window.NaProjectAdmin?.ProjectCodeValidator;

                if (!validator) {
                    return typeof projectCode === 'string' ? projectCode.trim().toUpperCase() : null;
                }

                return validator.normalise(projectCode);
            }

            function Na__GetProjectCode(queryParams, options) {
                const projectParam = queryParams[options.projectQueryKey];
                const normalised = Na__NormaliseProjectCode(projectParam);

                if (normalised) {
                    return normalised;
                }

                // Only use fallback if explicitly provided, not the hardcoded default
                if (options.defaultProjectCode !== null && options.defaultProjectCode !== undefined) {
                    const fallback = Na__NormaliseProjectCode(options.defaultProjectCode);
                    return fallback;
                }

                // Return null if no project code in URL and no fallback provided
                return null;
            }

            function Na__GetProjectYear(queryParams, options) {
                const yearParam = queryParams[options.projectYearQueryKey];
                const normalised = typeof yearParam === 'string' ? yearParam.trim() : '';

                if (/^[0-9]{2}$/.test(normalised)) {
                    return normalised;
                }

                const fallback = typeof options.defaultProjectYear === 'string'
                    ? options.defaultProjectYear.trim()
                    : NaDefaultProjectYear__Fallback;

                return /^[0-9]{2}$/.test(fallback) ? fallback : NaDefaultProjectYear__Fallback;
            }

            function Na__GetProjectFolder(queryParams, options, projectCode) {
                const folderParam = queryParams[options.projectFolderQueryKey];
                const folder = typeof folderParam === 'string' ? folderParam.trim() : '';

                if (folder) {
                    return folder;
                }

                // Only use fallback if explicitly provided and not null
                if (options.defaultProjectFolder !== null && options.defaultProjectFolder !== undefined) {
                    const fallback = typeof options.defaultProjectFolder === 'string'
                        ? options.defaultProjectFolder.trim()
                        : null;

                    if (fallback && window.NaProjectAdmin?.ProjectCodeValidator &&
                        projectCode &&
                        !window.NaProjectAdmin.ProjectCodeValidator.matchesProjectFolder(fallback, projectCode)) {
                        console.warn('[UrlQuerySystem] Default project folder does not match project code:', fallback, projectCode);
                    }

                    return fallback;
                }

                // Return null if no project folder in URL and no fallback provided
                return null;
            }

            function Na__TrimTrailingSlash(value) {
                if (!value || typeof value !== 'string') return '';
                return value.replace(/\/+$/, '');
            }

            function Na__TrimLeadingSlash(value) {
                if (!value || typeof value !== 'string') return '';
                return value.replace(/^\/+/, '');
            }

            function Na__JoinUrlParts(base, path) {
                const safeBase = Na__TrimTrailingSlash(base);
                const safePath = Na__TrimLeadingSlash(path);
                return `${safeBase}/${safePath}`;
            }

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // PUBLIC API | Url Query System
        // --------------------------------------------------------

            const UrlQuerySystem = {};

            UrlQuerySystem.getProjectContext = function(options = {}) {
                const resolvedOptions = {
                    projectQueryKey        : options.projectQueryKey || NaProjectQueryKey__Default,
                    projectYearQueryKey    : options.projectYearQueryKey || NaProjectYearQueryKey__Default,
                    projectFolderQueryKey  : options.projectFolderQueryKey || NaProjectFolderQueryKey__Default,
                    defaultProjectCode     : options.defaultProjectCode !== undefined ? options.defaultProjectCode : NaDefaultProjectCode__Fallback,
                    defaultProjectYear     : options.defaultProjectYear || NaDefaultProjectYear__Fallback,
                    defaultProjectFolder   : options.defaultProjectFolder !== undefined ? options.defaultProjectFolder : NaDefaultProjectFolder__Fallback,
                    localProjectPortalBase : options.localProjectPortalBase || NaLocalProjectPortalBase__Fallback,
                    liveProjectPortalBase  : options.liveProjectPortalBase || NaLiveProjectPortalBase__Fallback
                };

                const isLocalDev = Na__DetectLocalDev();
                const queryParams = Na__GetQueryParams();
                const projectCode = Na__GetProjectCode(queryParams, resolvedOptions);
                const projectYear = Na__GetProjectYear(queryParams, resolvedOptions);
                const projectFolder = Na__GetProjectFolder(queryParams, resolvedOptions, projectCode);

                let projectPortalBase    = null;
                let projectBasePath      = null;
                let projectBaseUrl       = null;
                let projectContentBaseUrl = null;
                let projectDataFilename  = null;
                let projectDataUrl       = null;

                if (projectCode && projectFolder) {
                    projectPortalBase = isLocalDev
                        ? resolvedOptions.localProjectPortalBase
                        : resolvedOptions.liveProjectPortalBase;

                    projectBasePath      = `${projectYear}-Projects/${projectFolder}`;
                    projectBaseUrl       = Na__JoinUrlParts(projectPortalBase, projectBasePath);
                    projectContentBaseUrl = Na__JoinUrlParts(projectBaseUrl, NaPlanVisionContentDir__Default);

                    projectDataFilename  = NaPlanVisionDataFilename__Default;
                    projectDataUrl       = Na__JoinUrlParts(projectContentBaseUrl, projectDataFilename);
                }

                return {
                    isLocalDev             : isLocalDev,
                    projectCode            : projectCode,
                    projectYear            : projectYear,
                    projectFolder          : projectFolder,
                    projectPortalBase      : projectPortalBase,
                    projectBaseUrl         : projectBaseUrl,
                    projectContentBaseUrl  : projectContentBaseUrl,
                    projectDataFilename    : projectDataFilename,
                    projectDataUrl         : projectDataUrl,
                    queryParams            : queryParams
                };
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.UrlQuerySystem = UrlQuerySystem;

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('UrlQuerySystem');
            }

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
