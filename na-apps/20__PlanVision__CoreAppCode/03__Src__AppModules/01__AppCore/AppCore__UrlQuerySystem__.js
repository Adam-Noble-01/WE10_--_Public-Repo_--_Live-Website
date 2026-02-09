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
// - Builds project data file URLs using standard naming conventions
//
// -----
//
// DEVELOPMENT LOG:
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
            const NaDefaultProjectYear__Fallback = '25';
            const NaDefaultProjectFolder__Fallback = 'JH03__RomerCottage';

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

                const fallback = Na__NormaliseProjectCode(options.defaultProjectCode);
                return fallback || NaDefaultProjectCode__Fallback;
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

                const fallback = typeof options.defaultProjectFolder === 'string'
                    ? options.defaultProjectFolder.trim()
                    : NaDefaultProjectFolder__Fallback;

                if (window.NaProjectAdmin?.ProjectCodeValidator &&
                    projectCode &&
                    !window.NaProjectAdmin.ProjectCodeValidator.matchesProjectFolder(fallback, projectCode)) {
                    console.warn('[UrlQuerySystem] Default project folder does not match project code:', fallback, projectCode);
                }

                return fallback || NaDefaultProjectFolder__Fallback;
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
                    defaultProjectCode     : options.defaultProjectCode || NaDefaultProjectCode__Fallback,
                    defaultProjectYear     : options.defaultProjectYear || NaDefaultProjectYear__Fallback,
                    defaultProjectFolder   : options.defaultProjectFolder || NaDefaultProjectFolder__Fallback,
                    localProjectPortalBase : options.localProjectPortalBase || NaLocalProjectPortalBase__Fallback,
                    liveProjectPortalBase  : options.liveProjectPortalBase || NaLiveProjectPortalBase__Fallback
                };

                const isLocalDev = Na__DetectLocalDev();
                const queryParams = Na__GetQueryParams();
                const projectCode = Na__GetProjectCode(queryParams, resolvedOptions);
                const projectYear = Na__GetProjectYear(queryParams, resolvedOptions);
                const projectFolder = Na__GetProjectFolder(queryParams, resolvedOptions, projectCode);

                const projectPortalBase = isLocalDev
                    ? resolvedOptions.localProjectPortalBase
                    : resolvedOptions.liveProjectPortalBase;

                const projectBasePath = `${projectYear}-Projects/${projectFolder}`;
                const projectBaseUrl = Na__JoinUrlParts(projectPortalBase, projectBasePath);

                const projectDataFilename = `${projectCode}__PlanVision__ProjectData__.json`;
                const projectDataUrl = Na__JoinUrlParts(projectBaseUrl, projectDataFilename);

                return {
                    isLocalDev           : isLocalDev,
                    projectCode          : projectCode,
                    projectYear          : projectYear,
                    projectFolder        : projectFolder,
                    projectPortalBase    : projectPortalBase,
                    projectBaseUrl       : projectBaseUrl,
                    projectDataFilename  : projectDataFilename,
                    projectDataUrl       : projectDataUrl,
                    queryParams          : queryParams
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
