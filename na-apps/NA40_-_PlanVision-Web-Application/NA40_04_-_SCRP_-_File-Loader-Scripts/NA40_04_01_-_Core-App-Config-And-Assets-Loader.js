/*
================================================================================
JAVASCRIPT |  CORE APP CONFIG AND ASSETS LOADER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Loads configuration and drawing data from JSON
- Provides functions for managing drawings and asset loading
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

// FUNCTION | Initializes the asset loading process
// --------------------------------------------------------- //
async function initAssetLoading() {
    try {
        console.log("Initializing asset loading...");
        
        // First fetch the app configuration
        const appConfig = await fetchAppConfig();
        if (!appConfig) {
            throw new Error("Failed to load application configuration");
        }
        
        // Then fetch the global asset library using the URL from the config
        const assetLibraryUrl = appConfig["Core_App_Config"]["app-assets-location"];
        const assetLibrary = await fetchAssetLibrary(assetLibraryUrl);
        
        // Note: Font loading is handled by the dedicated Font-Asset-Loader.js
        // so we don't need to handle it here
        
        // Initialize logo and other assets
        initLogoAndBranding(assetLibrary);
        
        console.log("Asset loading complete");
        return { appConfig, assetLibrary };
    } catch (error) {
        console.error("Error loading assets:", error);
        showErrorMessage("Failed to load application assets. Please refresh and try again.");
        return null;
    }
}

// FUNCTION | Fetches the application configuration JSON data
// --------------------------------------------------------- //
async function fetchAppConfig() {
    try {
        console.log("Attempting to fetch application configuration from:", APP_CONFIG_PATH);
        
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
        
        console.log("Resolved config path:", configPath);
        const response = await fetch(configPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch application configuration (${response.status})`);
        }
        
        const configData = await response.json();
        console.log("Application configuration loaded successfully");
        return configData;
    } catch (error) {
        console.error("Error fetching application configuration:", error);
        
        // Try a fallback approach using URL Parser if available
        if (window.urlParser && typeof window.urlParser.generatePlaceholderAssets === 'function') {
            console.warn("Using placeholder configuration for local development");
            return {
                "Core_App_Config": {
                    "app-dev-mode": true,
                    "app-assets-location": "/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json",
                    "app-style-location": "NA40_03_-_STYL_-_Style-Library/NA02_02_01_-_NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css",
                    "app-fallback-style": "/assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_10_-_STYL_-_Core-Default-Stylesheet_-_Noble-Architecture.css"
                }
            };
        }
        
        return null;
    }
}

// FUNCTION | Fetches the asset library JSON data
// --------------------------------------------------------- //
async function fetchAssetLibrary(assetLibraryUrl) {
    try {
        console.log("Attempting to fetch asset library from:", assetLibraryUrl);
        
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
        
        console.log("Resolved asset library URL:", resolvedUrl);
        
        // Use the URL Parser if available to handle any special encoding
        if (window.urlParser && typeof window.urlParser.fixURLEncoding === 'function') {
            resolvedUrl = window.urlParser.fixURLEncoding(resolvedUrl);
            console.log("URL after encoding fix:", resolvedUrl);
        }
        
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch asset library (${response.status})`);
        }
        
        const assetData = await response.json();
        console.log("Asset library data loaded successfully");
        return assetData;
    } catch (error) {
        console.error("Error fetching asset library:", error);
        
        // Use placeholder assets for local development if URL Parser is available
        if (window.urlParser && typeof window.urlParser.generatePlaceholderAssets === 'function') {
            console.warn("Using placeholder assets for local development");
            return window.urlParser.generatePlaceholderAssets();
        }
        
        return null;
    }
}

// FUNCTION | Initialize logo and branding assets
// --------------------------------------------------------- //
function initLogoAndBranding(assetLibrary) {
    if (!assetLibrary) {
        console.error("Asset library not found");
        return;
    }
    
    // Set logo image if available
    const logoImg = document.getElementById('HEAD__Logo');
    if (logoImg) {
        // Try to find the company logo in the asset library
        let logoUrl = null;
        
        // First check if URL Parser can handle this
        if (window.urlParser && typeof window.urlParser.getLogoURL === 'function') {
            logoUrl = window.urlParser.getLogoURL(assetLibrary);
            console.log("Using URL Parser to get logo URL:", logoUrl);
        } 
        // Otherwise look in the correct location in the asset library
        else {
            // Check if we have Core Brand Image Assets
            try {
                // Logo is likely in the NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets section
                if (assetLibrary.na_brand_assets && assetLibrary.na_brand_assets.company_logo) {
                    logoUrl = assetLibrary.na_brand_assets.company_logo.asset_url;
                }
                // Fallback to using the path we know from earlier fixes
                else {
                    logoUrl = '/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png';
                    console.log("Using fallback logo URL:", logoUrl);
                }
            } catch (error) {
                console.warn("Error finding logo in asset library:", error);
                // Use the fallback
                logoUrl = '/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png';
            }
        }
        
        if (logoUrl) {
            logoImg.src = logoUrl;
            console.log("Logo image set:", logoUrl);
        } else {
            console.warn("No logo URL found in asset library - using current src");
        }
    }
}

// FUNCTION | Shows an error message to the user
// --------------------------------------------------------- //
function showErrorMessage(message) {
    const errorElement = document.getElementById('NOTE__Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/*
------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Main initialization function that kicks off the asset loading process
------------------------------------------------------------
*/

// Start asset loading when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, starting asset initialization");
    initAssetLoading()
        .then(assetLibrary => {
            if (assetLibrary) {
                // Signal that asset loading is complete and we can proceed
                // This will be used by other modules once they're loaded
                window.assetsLoaded = true;
                window.assetLibrary = assetLibrary;
                
                // Dispatch an event that other modules can listen for
                document.dispatchEvent(new CustomEvent('assetsLoaded', { 
                    detail: { assetLibrary }
                }));
            }
        });
});

// Configuration constants
const JSON_URL = "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";
const ASSETS_URL = "https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json";

// Create namespace for this module
window.coreAppConfig = {};

// METHOD | Fetch drawings data from JSON configuration file
// --------------------------------------------------------- //
window.coreAppConfig.fetchDrawings = async function() {
    console.log("CONFIG_LOADER: Fetching drawings from:", JSON_URL);
    
    try {
        const response = await fetch(JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("CONFIG_LOADER: Fetched data:", data);

        // In the new format, drawings are at Project_Documentation.project-drawings
        if (data["Project_Documentation"] && data["Project_Documentation"]["project-drawings"]) {
            const drawings = data["Project_Documentation"]["project-drawings"];
            console.log("CONFIG_LOADER: Found drawings:", drawings);
            return drawings;
        } else {
            throw new Error("Missing project-drawings in JSON");
        }
    } catch (error) {
        console.error("CONFIG_LOADER: Error fetching JSON:", error);
        if (window.uiNavigation) {
            window.uiNavigation.displayError("Failed to load drawing data: " + error.message);
        }
        return null;
    }
};

// METHOD | Fetch the asset library
// --------------------------------------------------------- //
window.coreAppConfig.fetchAssetLibrary = async function() {
    console.log("CONFIG_LOADER: Fetching asset library from:", ASSETS_URL);
    
    try {
        const response = await fetch(ASSETS_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("CONFIG_LOADER: Asset library loaded successfully");
        return data;
    } catch (error) {
        console.error("CONFIG_LOADER: Error fetching asset library:", error);
        return null;
    }
};

// Log that this module has loaded
console.log("CONFIG_LOADER: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("coreAppConfig");
}

// Backwards compatibility with direct module approach
window.configLoader = window.coreAppConfig; 