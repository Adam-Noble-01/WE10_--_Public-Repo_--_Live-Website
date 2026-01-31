// =============================================================================
// NOBLE ARCHITECTURE - ASSET LOADER
// =============================================================================
//
// FILE       : CommonUtils__AssetLoader__.js
// NAMESPACE  : NaProjectAdmin.AssetLoader
// MODULE     : AssetLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Centralised asset URL calculation for GitHub Pages deployment
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Resolves asset paths to absolute GitHub Pages URLs
// - Eliminates CORS issues from relative paths
// - Dynamically loads fonts and updates image sources
// - Handles both local development and production deployment
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Absolute URL resolution for assets
//   - Dynamic font loading
//   - Image source updating
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Asset Loader
// --------------------------------------------------------

    (function() {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Application Variables
        // --------------------------------------------------------

            const AssetLoader          = {};                       // <-- Module API
            let config                 = null;                     // <-- App configuration
            let isInitialised          = false;                    // <-- Init state

            const ASSET_CATEGORIES = {
                FONTS                  : 'NaApps__CommonFonts',    // <-- Font files
                GRAPHICS               : 'NaApps__CommonGraphics', // <-- Brand graphics
                ICONS                  : 'NaApps__CommonIcons'     // <-- Favicon icons
            };

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // INITIALIZATION | Public API Methods
        // --------------------------------------------------------

            // FUNCTION | Initialise Asset Loader
            // ------------------------------------------------------------
            AssetLoader.initialise = async function(appConfig) {
                if (isInitialised) {
                    console.log('[AssetLoader] Already initialised');
                    return;
                }

                config = appConfig;                            // <-- Store config
                
                console.log('[AssetLoader] Initialising...');
                
                // Inject font CSS with absolute URLs
                await injectFontCSS();                         // <-- Load fonts
                
                // Update all image sources
                updateImageSources();                          // <-- Fix images
                
                // Update favicon links
                updateFaviconLinks();                          // <-- Fix favicons
                
                isInitialised = true;                          // <-- Mark ready
                console.log('[AssetLoader] Initialised successfully');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Asset URL
            // ------------------------------------------------------------
            AssetLoader.getAssetUrl = function(category, filename) {
                if (!config) {
                    console.error('[AssetLoader] Not initialised - call initialise() first');
                    return '';
                }

                const domain           = config.appDomain || 'https://www.noble-architecture.com/';
                const assetsBase       = config.AppConfig?.Paths?.commonAssetsBase || '/na-apps/01__Assets__NaApps__CommonAssets/';
                const categoryFolder   = ASSET_CATEGORIES[category] || '';

                // Build absolute URL
                const url = `${domain}${assetsBase.replace(/^\//, '')}${categoryFolder}/${filename}`;
                
                return url;                                    // <-- Return absolute URL
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Project Asset URL
            // ------------------------------------------------------------
            AssetLoader.getProjectAssetUrl = function(projectCode, year, relativePath) {
                if (!config) {
                    console.error('[AssetLoader] Not initialised');
                    return '';
                }

                const domain           = config.appDomain || 'https://www.noble-architecture.com/';
                const portalBase       = config.AppConfig?.Paths?.projectPortalBase || '/na-project-portal/';
                
                // Build project path: /na-project-portal/26-Projects/JS01__JohnSmith/...
                const url = `${domain}${portalBase.replace(/^\//, '')}${year}-Projects/${projectCode}/${relativePath}`;
                
                return url;                                    // <-- Return absolute URL
            };
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // HELPER FUNCTIONS | Internal Methods
        // --------------------------------------------------------

            // FUNCTION | Inject Font CSS
            // ------------------------------------------------------------
            async function injectFontCSS() {
                const fonts = [
                    { file: 'CommonFont-01__OpenSans__Light__.ttf',     weight: 300 },
                    { file: 'CommonFont-01__OpenSans__Regular__.ttf',   weight: 400 },
                    { file: 'CommonFont-01__OpenSans__Medium__.ttf',    weight: 500 },
                    { file: 'CommonFont-01__OpenSans__SemiBold__.ttf',  weight: 600 },
                    { file: 'CommonFont-01__OpenSans__Bold__.ttf',      weight: 700 }
                ];

                let cssRules = '';                             // <-- Build CSS string

                fonts.forEach(font => {
                    const url = AssetLoader.getAssetUrl('FONTS', font.file);
                    cssRules += `
                        @font-face {
                            font-family: 'Open Sans';
                            font-weight: ${font.weight};
                            font-style: normal;
                            src: url('${url}') format('truetype');
                        }
                    `;
                });

                // Inject into page
                const style = document.createElement('style');
                style.id = 'asset-loader-fonts';              // <-- Unique ID
                style.textContent = cssRules;
                document.head.appendChild(style);              // <-- Add to DOM

                console.log('[AssetLoader] Fonts loaded');
            }
            // ---------------------------------------------------------------

            // FUNCTION | Update Image Sources
            // ------------------------------------------------------------
            function updateImageSources() {
                const images = document.querySelectorAll('img[src*="01__Assets__NaApps__CommonAssets"]');
                
                images.forEach(img => {
                    const src = img.getAttribute('src');       // <-- Get relative path
                    
                    // Extract filename and category
                    if (src.includes('CommonGraphics')) {
                        const filename = src.split('/').pop();
                        img.src = AssetLoader.getAssetUrl('GRAPHICS', filename);
                    } else if (src.includes('CommonIcons')) {
                        const filename = src.split('/').pop();
                        img.src = AssetLoader.getAssetUrl('ICONS', filename);
                    }
                });

                console.log(`[AssetLoader] Updated ${images.length} image sources`);
            }
            // ---------------------------------------------------------------

            // FUNCTION | Update Favicon Links
            // ------------------------------------------------------------
            function updateFaviconLinks() {
                const links = document.querySelectorAll('link[rel*="icon"]');
                
                links.forEach(link => {
                    const href = link.getAttribute('href');    // <-- Get relative path
                    
                    if (href && href.includes('01__Assets__NaApps__CommonAssets')) {
                        const filename = href.split('/').pop();
                        link.href = AssetLoader.getAssetUrl('ICONS', filename);
                    }
                });

                console.log(`[AssetLoader] Updated ${links.length} favicon links`);
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            // Attach to global namespace
            window.NaProjectAdmin = window.NaProjectAdmin || {};
            window.NaProjectAdmin.AssetLoader = AssetLoader;

            // Mark module as loaded
            if (window.NaProjectAdmin.ModuleDependencyManager) {
                window.NaProjectAdmin.ModuleDependencyManager.markModuleLoaded('AssetLoader');
            }

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------

