// =============================================================================
// NOBLE ARCHITECTURE - APP ASSETS LOADER
// =============================================================================
//
// FILE       : Loader__AppAssetsLoader__.js
// NAMESPACE  : NaPlanVision.AppAssetsLoader
// MODULE     : AppAssetsLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Centralised app asset URL calculation for GitHub Pages deployment
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - Resolves visual asset paths to absolute GitHub Pages URLs
// - Eliminates CORS issues from relative paths
// - Dynamically loads fonts and updates image/icon sources
// - Handles both local development and production deployment
// - HTML uses data-asset-src/href attributes, AppAssetsLoader injects real URLs
//
// -----
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.1.0
// - Refactored to use data-asset-src and data-asset-href attributes
// - AppAssetsLoader now injects URLs from data attributes
// - Prevents browser from trying to load before URLs are generated
//
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Absolute URL resolution for assets
//   - Dynamic font loading
//   - Image source updating
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | App Assets Loader
// --------------------------------------------------------

    (function() {
        'use strict';

        // #Region ------------------------------------------------
        // STATE | Application Variables
        // --------------------------------------------------------

            const AppAssetsLoader      = {};                       // <-- Module API
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

            // FUNCTION | Initialise App Assets Loader
            // ------------------------------------------------------------
            AppAssetsLoader.initialise = async function(appConfig) {
                if (isInitialised) {
                    console.log('[AppAssetsLoader] Already initialised');
                    return;
                }

                config = appConfig;                            // <-- Store config
                
                console.log('[AppAssetsLoader] Initialising...');
                console.log('[AppAssetsLoader] Domain:', config?.appDomain);
                
                // Inject font CSS with absolute URLs
                await injectFontCSS();                         // <-- Load fonts
                
                // Inject URLs into elements with data-asset-src attributes
                injectAssetUrls();                             // <-- Inject image URLs
                
                // Inject URLs into link elements with data-asset-href attributes
                injectLinkUrls();                              // <-- Inject favicon URLs
                
                isInitialised = true;                          // <-- Mark ready
                console.log('[AppAssetsLoader] Initialised successfully');
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Asset URL
            // ------------------------------------------------------------
            AppAssetsLoader.getAssetUrl = function(category, filename) {
                if (!config) {
                    console.error('[AppAssetsLoader] Not initialised - call initialise() first');
                    return '';
                }

                const domain           = config.appDomain || 'https://www.noble-architecture.com/';
                const assetsBase       = config.AppConfig?.Paths?.commonAssetsBase || '/na-apps/01__Assets__NaApps__CommonAssets/';
                const categoryFolder   = ASSET_CATEGORIES[category] || '';

                // Build absolute URL with domain
                const url = `${domain.replace(/\/$/, '')}${assetsBase}${categoryFolder}/${filename}`;
                
                return url;                                    // <-- Return full URL
            };
            // ---------------------------------------------------------------

            // FUNCTION | Get Project Asset URL
            // ------------------------------------------------------------
            AppAssetsLoader.getProjectAssetUrl = function(projectCode, year, relativePath) {
                if (!config) {
                    console.error('[AppAssetsLoader] Not initialised');
                    return '';
                }

                const domain           = config.appDomain || 'https://www.noble-architecture.com/';
                const portalBase       = config.AppConfig?.Paths?.projectPortalBase || '/na-project-portal/';
                
                // Build project path with full domain
                const url = `${domain.replace(/\/$/, '')}${portalBase}${year}-Projects/${projectCode}/${relativePath}`;
                
                return url;                                    // <-- Return full URL
            };
            // ---------------------------------------------------------------

            // FUNCTION | Parse Asset Path
            // Extracts category and filename from a relative path
            // ------------------------------------------------------------
            AppAssetsLoader.parseAssetPath = function(path) {
                if (!path) return null;
                
                const filename = path.split('/').pop();        // <-- Get filename
                let category = null;
                
                if (path.includes('CommonGraphics') || path.includes('NaApps__CommonGraphics')) {
                    category = 'GRAPHICS';
                } else if (path.includes('CommonIcons') || path.includes('NaApps__CommonIcons')) {
                    category = 'ICONS';
                } else if (path.includes('CommonFonts') || path.includes('NaApps__CommonFonts')) {
                    category = 'FONTS';
                }
                
                return { category, filename };
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
                    { family: 'Open Sans', file: 'CommonFont-01__OpenSans__Light__.ttf',     weight: 300 },
                    { family: 'Open Sans', file: 'CommonFont-01__OpenSans__Regular__.ttf',   weight: 400 },
                    { family: 'Open Sans', file: 'CommonFont-01__OpenSans__Medium__.ttf',    weight: 500 },
                    { family: 'Open Sans', file: 'CommonFont-01__OpenSans__SemiBold__.ttf',  weight: 600 },
                    { family: 'Open Sans', file: 'CommonFont-01__OpenSans__Bold__.ttf',      weight: 700 },
                    { family: 'Caveat',    file: 'CommonHandwrittenFont-01__Caveat__Regular.ttf',  weight: 400 },
                    { family: 'Caveat',    file: 'CommonHandwrittenFont-01__Caveat__Medium.ttf',   weight: 500 },
                    { family: 'Caveat',    file: 'CommonHandwrittenFont-01__Caveat__SemiBold.ttf', weight: 600 },
                    { family: 'Caveat',    file: 'CommonHandwrittenFont-01__Caveat__Bold.ttf',     weight: 700 }
                ];

                let cssRules = '';                             // <-- Build CSS string

                fonts.forEach(font => {
                    const url = AppAssetsLoader.getAssetUrl('FONTS', font.file);
                    cssRules += `
                        @font-face {
                            font-family: '${font.family}';
                            font-weight: ${font.weight};
                            font-style: normal;
                            src: url('${url}') format('truetype');
                            font-display: swap;
                        }
                    `;
                });

                // Inject into page
                const style = document.createElement('style');
                style.id = 'app-assets-loader-fonts';         // <-- Unique ID
                style.textContent = cssRules;
                document.head.appendChild(style);              // <-- Add to DOM

                console.log('[AppAssetsLoader] Fonts injected');
            }
            // ---------------------------------------------------------------

            // FUNCTION | Inject Asset URLs into Images
            // Reads data-asset-src, generates URL, sets src
            // ------------------------------------------------------------
            function injectAssetUrls() {
                // Find all elements with data-asset-src attribute
                const elements = document.querySelectorAll('[data-asset-src]');
                let count = 0;
                
                elements.forEach(el => {
                    const assetPath = el.getAttribute('data-asset-src');
                    const parsed = AppAssetsLoader.parseAssetPath(assetPath);
                    
                    if (parsed && parsed.category && parsed.filename) {
                        const url = AppAssetsLoader.getAssetUrl(parsed.category, parsed.filename);
                        el.src = url;                          // <-- Set actual src
                        count++;
                        console.log(`[AppAssetsLoader] Injected: ${parsed.filename} -> ${url}`);
                    } else {
                        console.warn(`[AppAssetsLoader] Could not parse asset path: ${assetPath}`);
                    }
                });

                console.log(`[AppAssetsLoader] Injected ${count} image URLs`);
            }
            // ---------------------------------------------------------------

            // FUNCTION | Inject Link URLs
            // Reads data-asset-href, generates URL, sets href
            // ------------------------------------------------------------
            function injectLinkUrls() {
                // Find all link elements with data-asset-href attribute
                const links = document.querySelectorAll('link[data-asset-href]');
                let count = 0;
                
                links.forEach(link => {
                    const assetPath = link.getAttribute('data-asset-href');
                    const parsed = AppAssetsLoader.parseAssetPath(assetPath);
                    
                    if (parsed && parsed.category && parsed.filename) {
                        const url = AppAssetsLoader.getAssetUrl(parsed.category, parsed.filename);
                        link.href = url;                       // <-- Set actual href
                        count++;
                    } else {
                        console.warn(`[AppAssetsLoader] Could not parse link path: ${assetPath}`);
                    }
                });

                console.log(`[AppAssetsLoader] Injected ${count} link URLs`);
            }
            // ---------------------------------------------------------------

        // endregion ----------------------------------------------

        // #Region ------------------------------------------------
        // EXPORTS | Module API
        // --------------------------------------------------------

            // Attach to global namespace
            window.NaPlanVision = window.NaPlanVision || {};
            window.NaPlanVision.AppAssetsLoader = AppAssetsLoader;

            // Mark module as loaded
            if (window.NaPlanVision.ModuleDependencyManager) {
                window.NaPlanVision.ModuleDependencyManager.markModuleLoaded('AppAssetsLoader');
            }

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
