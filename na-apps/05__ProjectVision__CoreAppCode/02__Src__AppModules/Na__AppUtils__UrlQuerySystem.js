// =============================================================================
// NOBLE ARCHITECTURE - PROJECT VISION URL QUERY SYSTEM
// =============================================================================
//
// FILE       : Na__AppUtils__UrlQuerySystem.js
// NAMESPACE  : NaProjectVision.UrlQuerySystem
// MODULE     : UrlQuerySystem
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Parse URL query parameters and resolve project context for
//              the Project Vision landing page
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Reads ?project=XX00 and related query values
// - Resolves project paths for local and production environments
// - Fetches the MasterProjectIndex to look up project metadata
// - Builds sub-application URLs (Project Admin, PlanVision, TrueVision)
//
// -----
//
// DEVELOPMENT LOG:
// 27-Feb-2026 - Version 1.0.0
// - Initial Stable Release
//   - Query parsing matching PlanVision conventions
//   - Local vs production path resolution
//   - Master project index loader
//   - Sub-app URL builder
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Project Vision URL Query System
// --------------------------------------------------------

    (function() {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | Defaults
        // --------------------------------------------------------

            const NaProjectQueryKey__Default          = 'project';
            const NaProjectYearQueryKey__Default       = 'year';
            const NaProjectFolderQueryKey__Default     = 'project-folder';

            const NaDefaultProjectYear__Fallback       = '26';

            const NaLocalProjectPortalBase__Fallback   = '../na-project-portal';
            const NaLiveProjectPortalBase__Fallback    = 'https://www.noble-architecture.com/na-project-portal';

            const NaLocalAppsBase__Fallback            = '..';
            const NaLiveAppsBase__Fallback             = 'https://www.noble-architecture.com/na-apps';

            const NaMasterIndexPath__Relative          = '05__AppData/ProjectVision__MasterProjectIndex__Core__.json';

            const NaSubAppPaths = {
                projectAdmin : '10__NaProjectAdmin__DocumentSystem__CoreAppCode/index.html',
                planVision   : '20__PlanVision__CoreAppCode/PlanVision__WebApp__Main__.html',
                trueVision   : '30__TrueVision__CoreAppCode/Index.html'
            };

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
                if (typeof projectCode !== 'string') return null;

                const trimmed = projectCode.trim().toUpperCase();
                return /^[A-Z]{2}[0-9]{2}$/.test(trimmed) ? trimmed : null;
            }

            function Na__GetProjectCode(queryParams, options) {
                const projectParam = queryParams[options.projectQueryKey];
                const normalised = Na__NormaliseProjectCode(projectParam);

                if (normalised) {
                    return normalised;
                }

                if (options.defaultProjectCode !== null && options.defaultProjectCode !== undefined) {
                    return Na__NormaliseProjectCode(options.defaultProjectCode);
                }

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

            function Na__GetProjectFolder(queryParams, options) {
                const folderParam = queryParams[options.projectFolderQueryKey];
                const folder = typeof folderParam === 'string' ? folderParam.trim() : '';

                if (folder) {
                    return folder;
                }

                if (options.defaultProjectFolder !== null && options.defaultProjectFolder !== undefined) {
                    return typeof options.defaultProjectFolder === 'string'
                        ? options.defaultProjectFolder.trim()
                        : null;
                }

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
                    defaultProjectCode     : options.defaultProjectCode !== undefined ? options.defaultProjectCode : null,
                    defaultProjectYear     : options.defaultProjectYear || NaDefaultProjectYear__Fallback,
                    defaultProjectFolder   : options.defaultProjectFolder !== undefined ? options.defaultProjectFolder : null,
                    localProjectPortalBase : options.localProjectPortalBase || NaLocalProjectPortalBase__Fallback,
                    liveProjectPortalBase  : options.liveProjectPortalBase || NaLiveProjectPortalBase__Fallback,
                    localAppsBase          : options.localAppsBase || NaLocalAppsBase__Fallback,
                    liveAppsBase           : options.liveAppsBase || NaLiveAppsBase__Fallback
                };

                const isLocalDev   = Na__DetectLocalDev();
                const queryParams  = Na__GetQueryParams();
                const projectCode  = Na__GetProjectCode(queryParams, resolvedOptions);
                const projectYear  = Na__GetProjectYear(queryParams, resolvedOptions);
                const projectFolder = Na__GetProjectFolder(queryParams, resolvedOptions);

                const appsBase = isLocalDev
                    ? resolvedOptions.localAppsBase
                    : resolvedOptions.liveAppsBase;

                const projectPortalBase = isLocalDev
                    ? resolvedOptions.localProjectPortalBase
                    : resolvedOptions.liveProjectPortalBase;

                const masterIndexUrl = Na__JoinUrlParts(appsBase,
                    '05__ProjectVision__CoreAppCode/' + NaMasterIndexPath__Relative);

                return {
                    isLocalDev           : isLocalDev,
                    projectCode          : projectCode,
                    projectYear          : projectYear,
                    projectFolder        : projectFolder,
                    appsBase             : appsBase,
                    projectPortalBase    : projectPortalBase,
                    masterIndexUrl       : masterIndexUrl,
                    queryParams          : queryParams
                };
            };

            UrlQuerySystem.fetchMasterIndex = async function(masterIndexUrl) {
                const response = await fetch(masterIndexUrl);

                if (!response.ok) {
                    throw new Error(`Failed to load master project index: ${response.status}`);
                }

                return await response.json();
            };

            UrlQuerySystem.resolveProjectFromIndex = function(masterIndex, projectCode) {
                if (!masterIndex || !masterIndex.projects || !projectCode) {
                    return null;
                }

                return masterIndex.projects[projectCode] || null;
            };

            UrlQuerySystem.buildSubAppUrl = function(appsBase, subAppKey, projectCode, projectFolder) {
                const subAppPath = NaSubAppPaths[subAppKey];

                if (!subAppPath || !projectCode) {
                    return null;
                }

                const baseUrl = Na__JoinUrlParts(appsBase, subAppPath);
                const params  = new URLSearchParams();

                params.set('project', projectCode);

                if (projectFolder) {
                    params.set('project-folder', projectFolder);
                }

                return `${baseUrl}?${params.toString()}`;
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaProjectVision = window.NaProjectVision || {};
            window.NaProjectVision.UrlQuerySystem = UrlQuerySystem;

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
