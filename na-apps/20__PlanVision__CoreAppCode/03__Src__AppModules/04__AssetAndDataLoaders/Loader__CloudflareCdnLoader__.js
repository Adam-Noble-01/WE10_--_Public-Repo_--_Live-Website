// =============================================================================
// NOBLE ARCHITECTURE - CLOUDFLARE CDN LOADER
// =============================================================================
//
// FILE       : Loader__CloudflareCdnLoader__.js
// NAMESPACE  : NaPlanVision.CloudflareCdnLoader
// MODULE     : CloudflareCdnLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : CDN-first asset loading with GitHub Pages fallback
// CREATED    : 08-Mar-2026
//
// DESCRIPTION:
// - Builds CDN URLs for PlanVision project data and drawing assets
// - Fetches from Cloudflare R2 CDN as primary source
// - Falls back to GitHub Pages (legacy) if CDN is unavailable
// - Reports load source so the UI can display fallback warnings
//
// -----
//
// DEVELOPMENT LOG:
// 08-Mar-2026 - Version 1.0.0
// - Initial release
//   - CDN URL builders for project data and assets
//   - Fetch-with-fallback for JSON and binary assets
//   - Load source tracking (cdn / legacy)
//
// =============================================================================

// #region ------------------------------------------------
// MODULE | Cloudflare CDN Loader
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // CONSTANTS | CDN Configuration
        // --------------------------------------------------------

            const NaCdnBaseUrl__Default         = 'https://cdn.noble-architecture.com';
            const NaR2Prefix__Default            = 'NaProjectPortal';
            const NaPlanVisionContentDir__Default = '20__PlanVision__AppContent';

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // STATE | Module State
        // --------------------------------------------------------

            let lastLoadSource = null;

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // URL BUILDERS | CDN Path Construction
        // --------------------------------------------------------

            // FUNCTION | Build CDN URL for the PlanVision Project Data JSON
            // ------------------------------------------------------------
            const Na__Cdn__BuildProjectDataUrl = function (projectFolder, yearCode) {
                if (!projectFolder || !yearCode) return null;

                return `${NaCdnBaseUrl__Default}/${NaR2Prefix__Default}`
                     + `/${yearCode}-Projects/${projectFolder}`
                     + `/${NaPlanVisionContentDir__Default}`
                     + `/PlanVision__ProjectData__.json`;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Build CDN URL for Any PlanVision Asset
            // ------------------------------------------------------------
            const Na__Cdn__BuildAssetUrl = function (projectFolder, yearCode, relativePath) {
                if (!projectFolder || !yearCode || !relativePath) return null;

                return `${NaCdnBaseUrl__Default}/${NaR2Prefix__Default}`
                     + `/${yearCode}-Projects/${projectFolder}`
                     + `/${NaPlanVisionContentDir__Default}`
                     + `/${relativePath}`;
            };
            // ---------------------------------------------------------------

            // FUNCTION | Convert a GitHub Pages URL to CDN URL
            // ------------------------------------------------------------
            const Na__Cdn__ConvertLegacyUrlToCdn = function (legacyUrl, projectFolder, yearCode) {
                if (!legacyUrl || !projectFolder) return null;

                const contentMarker = `${projectFolder}/${NaPlanVisionContentDir__Default}/`;
                const markerIndex   = legacyUrl.indexOf(contentMarker);

                if (markerIndex === -1) return null;

                const relativePath = legacyUrl.substring(
                    markerIndex + contentMarker.length
                );

                return Na__Cdn__BuildAssetUrl(projectFolder, yearCode, relativePath);
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // FETCHING | CDN-First with Legacy Fallback
        // --------------------------------------------------------

            // FUNCTION | Fetch JSON with CDN Priority and Legacy Fallback
            // ------------------------------------------------------------
            const Na__Cdn__FetchJsonWithFallback = async function (cdnUrl, fallbackUrl) {
                if (cdnUrl) {
                    try {
                        const cdnResponse = await fetch(cdnUrl);
                        if (cdnResponse.ok) {
                            const data = await cdnResponse.json();
                            lastLoadSource = 'cdn';
                            console.log('[CloudflareCdnLoader] Loaded from CDN:', cdnUrl);
                            return { data: data, source: 'cdn' };
                        }
                        console.warn('[CloudflareCdnLoader] CDN returned', cdnResponse.status, '- falling back');
                    } catch (cdnError) {
                        console.warn('[CloudflareCdnLoader] CDN fetch failed:', cdnError.message, '- falling back');
                    }
                }

                if (!fallbackUrl) {
                    return { data: null, source: 'none' };
                }

                const fallbackResponse = await fetch(fallbackUrl);
                if (!fallbackResponse.ok) {
                    throw new Error('Fallback fetch failed: HTTP ' + fallbackResponse.status);
                }

                const data = await fallbackResponse.json();
                lastLoadSource = 'legacy';
                console.log('[CloudflareCdnLoader] Loaded from legacy (GitHub Pages):', fallbackUrl);
                return { data: data, source: 'legacy' };
            };
            // ---------------------------------------------------------------

            // FUNCTION | Load an Image with CDN Priority and Legacy Fallback
            // Returns a Promise that resolves with { url, source }
            // ------------------------------------------------------------
            const Na__Cdn__LoadImageWithFallback = function (cdnUrl, fallbackUrl) {
                return new Promise(function (resolve) {
                    if (!cdnUrl) {
                        resolve({ url: fallbackUrl, source: 'legacy' });
                        return;
                    }

                    const testImg = new Image();

                    testImg.onload = function () {
                        resolve({ url: cdnUrl, source: 'cdn' });
                    };

                    testImg.onerror = function () {
                        console.warn('[CloudflareCdnLoader] CDN image failed, using fallback');
                        resolve({ url: fallbackUrl || cdnUrl, source: 'legacy' });
                    };

                    testImg.src = cdnUrl;
                });
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // ACCESSORS | State Getters
        // --------------------------------------------------------

            // FUNCTION | Get the Source of the Last Successful Load
            // ------------------------------------------------------------
            const Na__Cdn__GetLastLoadSource = function () {
                return lastLoadSource;
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.CloudflareCdnLoader = {
                Na__Cdn__BuildProjectDataUrl     : Na__Cdn__BuildProjectDataUrl,
                Na__Cdn__BuildAssetUrl           : Na__Cdn__BuildAssetUrl,
                Na__Cdn__ConvertLegacyUrlToCdn   : Na__Cdn__ConvertLegacyUrlToCdn,
                Na__Cdn__FetchJsonWithFallback    : Na__Cdn__FetchJsonWithFallback,
                Na__Cdn__LoadImageWithFallback    : Na__Cdn__LoadImageWithFallback,
                Na__Cdn__GetLastLoadSource        : Na__Cdn__GetLastLoadSource
            };

            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('CloudflareCdnLoader');
            }

            console.log('[CloudflareCdnLoader] Module loaded and registered');

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
