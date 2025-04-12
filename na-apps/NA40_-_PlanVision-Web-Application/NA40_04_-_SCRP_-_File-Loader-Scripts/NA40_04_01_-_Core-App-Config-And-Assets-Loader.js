/*
================================================================================
JAVASCRIPT |  MASTER ASSET LOADER FOR PLANVISION APPLICATION
- Based on the reference implementation v2.0.0
DESCRIPTION
- Master file loader that handles all asset loading for the application
- Loads configuration, fonts, images, and project assets
- Provides a unified interface for asset management
================================================================================
*/

/*
------------------------------------------------------------
JAVASCRIPT |  ASSET LIBRARY CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for asset loading
IMPORTANT NOTES
- Update these paths if the asset structure changes
------------------------------------------------------------
*/

// App configuration file path
const APP_CONFIG_PATH = "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";

/*
------------------------------------------------------------
JAVASCRIPT |  ASSET LOADING FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Core functions for loading application assets
------------------------------------------------------------
*/

// Module-level variables
let planImage = new Image();
planImage.crossOrigin = "anonymous";
let imageLoadedFlag = false;
let naturalImageWidth = 0;
let naturalImageHeight = 0;
let currentDrawingScale = "1:50";    // <-- Default scale
let currentDrawingSize = "A1";       // <-- Default size

// Application state
let appConfig = null;
let assetLibrary = null;
let fontData = null;

// Create namespace for this module
window.masterAssetLoader = {};

// Add the missing areAssetsLoaded function
window.masterAssetLoader.areAssetsLoaded = function() {
    // This function should return true if all assets are loaded
    // Since this function was missing, we'll implement a basic version
    // that checks if appConfig and assetLibrary are set
    return appConfig !== null && assetLibrary !== null;
};

// Add alias for isImageLoaded if it doesn't exist
if (!window.masterAssetLoader.isImageLoaded) {
    window.masterAssetLoader.isImageLoaded = function() {
        return imageLoadedFlag;
    };
}

// CLASS | Font Asset Loader
// --------------------------------------------------------- //
class FontAssetLoader {
    constructor() {
        this.fontData = null;
    }

    // METHOD | Extract font data from the asset library
    // --------------------------------------------------------- //
    extractFontData(assetLibrary) {
        console.log("FONT_LOADER: Extracting font data from asset library");
        
        // Look for font data in the Common_Web_Assets_Libraries section
        if (assetLibrary.Common_Web_Assets_Libraries && 
            assetLibrary.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files']) {
            
            console.log("FONT_LOADER: Found font data in Common_Web_Assets_Libraries structure");
            const fontLibrary = assetLibrary.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files'];
            
            // Create an object with just the font-related entries
            return {
                'openSansRegular': fontLibrary['font-open-sans-regular'],
                'openSansSemiBold': fontLibrary['font-open-sans-semibold'],
                'openSansLight': fontLibrary['font-open-sans-light'],
                'openSansMedium': fontLibrary['font-open-sans-medium'],
                'openSansBold': fontLibrary['font-open-sans-bold'],
                'caveatRegular': fontLibrary['font-caveat-regular'],
                'caveatSemiBold': fontLibrary['font-caveat-semibold'],
            };
        }
        
        // Check legacy structure as fallback
        if (assetLibrary.na_assets && assetLibrary.na_assets.na_fonts) {
            console.log("FONT_LOADER: Found font data in na_assets.na_fonts structure");
            return assetLibrary.na_assets.na_fonts;
        }
        
        // Fallback to placeholder data if available via URL Parser
        if (window.urlParser && typeof window.urlParser.generatePlaceholderAssets === 'function') {
            console.log("FONT_LOADER: Using placeholder font data from URL Parser");
            const placeholderAssets = window.urlParser.generatePlaceholderAssets();
            if (placeholderAssets && placeholderAssets.na_assets && placeholderAssets.na_assets.na_fonts) {
                return placeholderAssets.na_assets.na_fonts;
            }
            
            // Last resort - try to get font data from the placeholder structure
            if (placeholderAssets && placeholderAssets.Common_Web_Assets_Libraries && 
                placeholderAssets.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files']) {
                
                const fontLibrary = placeholderAssets.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files'];
                
                return {
                    'openSansRegular': fontLibrary['font-open-sans-regular'],
                    'openSansSemiBold': fontLibrary['font-open-sans-semibold'],
                    'openSansLight': fontLibrary['font-open-sans-light'],
                    'openSansMedium': fontLibrary['font-open-sans-medium'],
                    'openSansBold': fontLibrary['font-open-sans-bold'],
                    'caveatRegular': fontLibrary['font-caveat-regular'],
                    'caveatSemiBold': fontLibrary['font-caveat-semibold'],
                };
            }
        }
        
        // If all else fails, use fallback data
        console.error("FONT_LOADER: Could not find any font data - will use fallback data");
        return this.getFallbackFontData();
    }

    // METHOD | Get fallback font data if the asset library loading fails
    // --------------------------------------------------------- //
    getFallbackFontData() {
        // Return fallback data with CDN URLs for common fonts
        return {
            'openSansRegular': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap',
                'font-weight': 400
            },
            'openSansSemiBold': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@600&display=swap',
                'font-weight': 600
            },
            'openSansLight': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300&display=swap',
                'font-weight': 300
            },
            'openSansMedium': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@500&display=swap',
                'font-weight': 500
            },
            'openSansBold': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@700&display=swap',
                'font-weight': 700
            },
            'caveatRegular': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Caveat&display=swap',
                'font-weight': 400
            },
            'caveatSemiBold': {
                'asset-web-url': 'https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap',
                'font-weight': 600
            }
        };
    }

    // METHOD | Get the loaded font data
    // --------------------------------------------------------- //
    getFontData() {
        return this.fontData;
    }
}

// METHOD | Initialize the master asset loader
// --------------------------------------------------------- //
window.masterAssetLoader.init = async function() {
    console.log("MASTER_ASSET_LOADER: Initializing...");
    
    try {
        // First load the app configuration
        const configResult = await window.masterAssetLoader.loadAppConfig();
        if (!configResult) {
            throw new Error("Failed to load application configuration");
        }
        
        // Store the config globally
        appConfig = configResult;
        window.appConfig = appConfig;
        
        // Check for dev mode
        if (appConfig && appConfig.Core_App_Config && appConfig.Core_App_Config["app-dev-mode"] === true) {
            console.log("MASTER_ASSET_LOADER: Dev mode enabled");
        }
        
        // Load asset library if a URL is provided in the config
        if (appConfig.Core_App_Config && appConfig.Core_App_Config["app-assets-location"]) {
            const assetLibraryUrl = appConfig.Core_App_Config["app-assets-location"];
            const assetResult = await window.masterAssetLoader.loadAssetLibrary(assetLibraryUrl);
            
            if (assetResult) {
                assetLibrary = assetResult;
                window.assetLibrary = assetLibrary;
                
                // Initialize logo and branding with asset library
                window.masterAssetLoader.initLogoAndBranding(assetLibrary);
                
                // Initialize font data
                const fontLoader = new FontAssetLoader();
                fontData = fontLoader.extractFontData(assetLibrary);
                window.fontAssetData = fontData;
                
                // Dispatch event that font data is loaded
                document.dispatchEvent(new CustomEvent('fontDataLoaded', { 
                    detail: { fontData } 
                }));
            }
        }
        
        // Dispatch event that assets are loaded
        document.dispatchEvent(new CustomEvent('assetsLoaded', { 
            detail: { appConfig, assetLibrary, fontData }
        }));
        
        console.log("MASTER_ASSET_LOADER: Initialized successfully");
        return true;
    } catch (error) {
        console.error("MASTER_ASSET_LOADER: Initialization failed:", error);
        if (window.uiNavigation && typeof window.uiNavigation.displayError === "function") {
            window.uiNavigation.displayError("Failed to initialize application assets. Please refresh the page.");
        } else {
            window.masterAssetLoader.showErrorMessage("Failed to initialize application assets. Please refresh the page.");
        }
        return false;
    }
};

// METHOD | Load application configuration
// --------------------------------------------------------- //
window.masterAssetLoader.loadAppConfig = async function() {
    try {
        console.log("MASTER_ASSET_LOADER: Loading application configuration from:", APP_CONFIG_PATH);
        
        // Determine if we need to use a relative or absolute path
        let configPath = APP_CONFIG_PATH;
        
        // If this is not already an absolute URL, make it relative to the current page
        if (!configPath.startsWith('http://') && !configPath.startsWith('https://')) {
            // Check if we should use root-relative (starting with /) or document-relative path
            if (!configPath.startsWith('/')) {
                // Use document-relative path - prepend with the current directory
                const currentPath = window.location.pathname;
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                configPath = currentDir + configPath;
            }
        }
        
        console.log("MASTER_ASSET_LOADER: Resolved config path:", configPath);
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch application configuration (${response.status})`);
        }
        
        const configData = await response.json();
        console.log("MASTER_ASSET_LOADER: Application configuration loaded successfully");
        return configData;
    } catch (error) {
        console.error("MASTER_ASSET_LOADER: Error fetching application configuration:", error);
        
        // Use fallback configuration for development
        console.warn("MASTER_ASSET_LOADER: Using fallback configuration for development");
        return {
            "Core_App_Config": {
                "app-dev-mode": true,
                "app-assets-location": "/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json",
                "app-style-location": "NA40_03_-_STYL_-_Style-Library/NA02_02_01_-_NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css",
                "app-fallback-style": "/assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_10_-_STYL_-_Core-Default-Stylesheet_-_Noble-Architecture.css"
            }
        };
    }
};

// METHOD | Load asset library
// --------------------------------------------------------- //
window.masterAssetLoader.loadAssetLibrary = async function(assetLibraryUrl) {
    try {
        console.log("MASTER_ASSET_LOADER: Loading asset library from:", assetLibraryUrl);
        
        // Ensure we have a properly formatted URL
        let resolvedUrl = assetLibraryUrl;
        
        // If this is not already an absolute URL, resolve it properly
        if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
            // Check if we should use root-relative (starting with /) path
            if (resolvedUrl.startsWith('/')) {
                // Root-relative path - prefix with origin
                resolvedUrl = window.location.origin + resolvedUrl;
            } else {
                // Document-relative path - prefix with current directory
                const currentPath = window.location.pathname;
                const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                resolvedUrl = window.location.origin + currentDir + resolvedUrl;
            }
        }
        
        console.log("MASTER_ASSET_LOADER: Resolved asset library URL:", resolvedUrl);
        
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch asset library (${response.status})`);
        }
        
        const assetData = await response.json();
        console.log("MASTER_ASSET_LOADER: Asset library data loaded successfully");
        return assetData;
    } catch (error) {
        console.error("MASTER_ASSET_LOADER: Error fetching asset library:", error);
        
        // Use placeholder assets for development
        console.warn("MASTER_ASSET_LOADER: Using placeholder assets for development");
        return {
            na_brand_assets: {
                company_logo: {
                    asset_url: '/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png'
                }
            }
        };
    }
};

// METHOD | Initialize logo and branding assets
// --------------------------------------------------------- //
window.masterAssetLoader.initLogoAndBranding = function(assetLibrary) {
    if (!assetLibrary) {
        console.error("MASTER_ASSET_LOADER: Asset library not found");
        return;
    }
    
    // Set logo image if available
    const logoImg = document.getElementById('HEAD__Logo');
    if (logoImg) {
        // Try to find the company logo in the asset library
        let logoUrl = null;
        
        // Check if we have Core Brand Image Assets
        try {
            // Logo is likely in the NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets section
            if (assetLibrary.na_brand_assets && assetLibrary.na_brand_assets.company_logo) {
                logoUrl = assetLibrary.na_brand_assets.company_logo.asset_url;
            }
            // Fallback to using a default path
            else {
                logoUrl = '/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png';
                console.log("MASTER_ASSET_LOADER: Using fallback logo URL:", logoUrl);
            }
        } catch (error) {
            console.warn("MASTER_ASSET_LOADER: Error finding logo in asset library:", error);
            // Use the fallback
            logoUrl = '/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png';
        }
        
        if (logoUrl) {
            logoImg.src = logoUrl;
            console.log("MASTER_ASSET_LOADER: Logo image set:", logoUrl);
        } else {
            console.warn("MASTER_ASSET_LOADER: No logo URL found in asset library - using current src");
        }
    }
};

// METHOD | Load a specific drawing
// --------------------------------------------------------- //
window.masterAssetLoader.loadDrawing = async function(drawing) {
    if (window.uiNavigation && typeof window.uiNavigation.showLoading === "function") {
        window.uiNavigation.showLoading();
    } else {
        const loadingOverlay = document.getElementById('LOAD__Overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
    }
    
    console.log("MASTER_ASSET_LOADER: Loading drawing:", drawing);
    
    try {
        // Extract URLs and metadata from drawing
        const pngUrl = drawing["document-links"]["png--github-link-url"];
        const pdfUrl = drawing["document-links"]["pdf--github-link-url"];
        const documentName = drawing["document-name"];
        const documentScale = drawing["document-scale"];
        const documentSize = drawing["document-size"];
        
        // Store drawing metadata for scale calculation
        currentDrawingScale = documentScale || "1:50"; // Default to 1:50 if not specified
        currentDrawingSize = documentSize || "A1"; // Default to A1 if not specified
        
        // Load the image
        await window.masterAssetLoader.loadPlanImage(pngUrl);
        imageLoadedFlag = true;
        
        // Update download link
        window.masterAssetLoader.updateDownloadLink(pdfUrl, documentName);
        
        // Update title
        document.title = "PlanVision | " + documentName;
        
        // Notify other modules that drawing is loaded
        document.dispatchEvent(new CustomEvent('drawingLoaded', {
            detail: {
                name: documentName,
                scale: documentScale,
                size: documentSize
            }
        }));
        
        // Reset view to fit the image if canvas renderer is available
        if (window.canvasRenderer && typeof window.canvasRenderer.resetView === "function") {
            window.canvasRenderer.resetView();
        }
        
        return true;
    } catch (error) {
        console.error("MASTER_ASSET_LOADER: Error loading drawing:", error);
        window.masterAssetLoader.showErrorMessage("Failed to load the selected drawing.");
        return false;
    } finally {
        if (window.uiNavigation && typeof window.uiNavigation.hideLoading === "function") {
            window.uiNavigation.hideLoading();
        } else {
            const loadingOverlay = document.getElementById('LOAD__Overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }
};

// METHOD | Load the plan image
// --------------------------------------------------------- //
window.masterAssetLoader.loadPlanImage = function(url) {
    return new Promise((resolve, reject) => {
        console.log("MASTER_ASSET_LOADER: Loading image from URL:", url);
        
        planImage.onload = () => {
            console.log("MASTER_ASSET_LOADER: Image loaded successfully");
            naturalImageWidth = planImage.naturalWidth;
            naturalImageHeight = planImage.naturalHeight;
            imageLoadedFlag = true;
            
            // Notify that image is loaded
            document.dispatchEvent(new CustomEvent('imageLoaded', {
                detail: { image: planImage }
            }));
            
            resolve();
        };
        
        planImage.onerror = (e) => {
            console.error("MASTER_ASSET_LOADER: Error loading image:", e);
            imageLoadedFlag = false;
            reject(new Error("Failed to load plan image: " + url));
        };
        
        // Start loading the image
        planImage.src = url;
    });
};

// METHOD | Update the PDF download link
// --------------------------------------------------------- //
window.masterAssetLoader.updateDownloadLink = function(pdfUrl, documentName) {
    const downloadBtn = document.getElementById("BTTN__Download-PDF");
    if (!downloadBtn) {
        console.warn("MASTER_ASSET_LOADER: Download button not found");
        return;
    }
    
    downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.href = pdfUrl;
        link.download = documentName.replace(/ /g, "-") + ".pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    // Enable the button in case it was disabled
    downloadBtn.disabled = false;
};

// METHOD | Shows an error message to the user
// --------------------------------------------------------- //
window.masterAssetLoader.showErrorMessage = function(message) {
    const errorElement = document.getElementById('NOTE__Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 8000);
    }
};

// METHOD | Get the loaded plan image
// --------------------------------------------------------- //
window.masterAssetLoader.getPlanImage = function() {
    return planImage;
};

// METHOD | Get the natural width of the loaded image
// --------------------------------------------------------- //
window.masterAssetLoader.getNaturalImageWidth = function() {
    return naturalImageWidth;
};

// METHOD | Get the natural height of the loaded image
// --------------------------------------------------------- //
window.masterAssetLoader.getNaturalImageHeight = function() {
    return naturalImageHeight;
};

// METHOD | Get the current drawing scale
// --------------------------------------------------------- //
window.masterAssetLoader.getCurrentDrawingScale = function() {
    return currentDrawingScale;
};

// METHOD | Get the current drawing size
// --------------------------------------------------------- //
window.masterAssetLoader.getCurrentDrawingSize = function() {
    return currentDrawingSize;
};

// METHOD | Get the application configuration
// --------------------------------------------------------- //
window.masterAssetLoader.getAppConfig = function() {
    return appConfig;
};

// METHOD | Get the asset library
// --------------------------------------------------------- //
window.masterAssetLoader.getAssetLibrary = function() {
    return assetLibrary;
};

// METHOD | Get the font data
// --------------------------------------------------------- //
window.masterAssetLoader.getFontData = function() {
    return fontData;
};

// Log that this module has loaded
console.log("MASTER_ASSET_LOADER: Module loaded");

// Register this module with the module integration system
document.addEventListener('DOMContentLoaded', () => {
    if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
        window.moduleIntegration.registerModuleReady("masterAssetLoader");
    }
    
    // Initialize the master asset loader when the DOM is ready
    window.masterAssetLoader.init();
});

// Backwards compatibility with direct module approach
window.projectAssets = window.masterAssetLoader; 