/*
================================================================================
JAVASCRIPT |  APP ASSETS LOADER
- Introduced in v2.0.0
DESCRIPTION
- Loads core application assets from the centralized JSON repository
- Initializes font loading and other common resources
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  ASSET LIBRARY CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for asset loading
IMPORTANT NOTES
- Update these paths if the asset structure changes
--------------------------------------------
*/

// Asset library path - Updated to use local file
const ASSET_LIBRARY_PATH = "NA20_01_01_-_DATA_-_Asset-Link-Library.json";

// Font loading configuration
const FONT_FAMILIES = {
    openSans: {
        name: "Open Sans",
        weights: ["regular", "light", "semi-bold"]
    },
    caveat: {
        name: "Caveat",
        weights: ["regular", "semi-bold"]
    }
};

/*
--------------------------------------------
JAVASCRIPT |  ASSET LOADING FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Core functions for loading application assets
--------------------------------------------
*/

/**
 * Initializes the asset loading process
 */
async function initAssetLoading() {
    try {
        console.log("Initializing asset loading...");
        
        // Fetch asset library data
        const assetLibrary = await fetchAssetLibrary();
        
        // Load fonts
        if (assetLibrary && assetLibrary.fonts) {
            loadFonts(assetLibrary.fonts);
        } else {
            console.error("Font data not found in asset library");
        }
        
        // Initialize logo and other assets
        initLogoAndBranding(assetLibrary);
        
        console.log("Asset loading complete");
        return assetLibrary;
    } catch (error) {
        console.error("Error loading assets:", error);
        showErrorMessage("Failed to load application assets. Please refresh and try again.");
        return null;
    }
}

/**
 * Fetches the asset library JSON data
 */
async function fetchAssetLibrary() {
    try {
        console.log("Attempting to fetch asset library from:", ASSET_LIBRARY_PATH);
        
        const response = await fetch(ASSET_LIBRARY_PATH);
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

/**
 * Loads fonts from the asset library
 */
function loadFonts(fontData) {
    // Get the style element where font declarations will be inserted
    const fontStylesElement = document.getElementById('FONT__Styles-Dynamic');
    if (!fontStylesElement) {
        console.error("Font styles element not found");
        return;
    }
    
    let fontFaceDeclarations = '';
    
    // Process Open Sans fonts with URL Parser if available
    if (fontData.openSans) {
        fontData.openSans.forEach(font => {
            // Try to use URL Parser for font URLs
            let fontUrl = font.url;
            if (window.urlParser && typeof window.urlParser.fixURLEncoding === 'function') {
                fontUrl = window.urlParser.fixURLEncoding(fontUrl);
            }
            
            fontFaceDeclarations += `
            @font-face {
                font-family: 'Open Sans';
                src: url('${fontUrl}') format('${font.format}');
                font-weight: ${font.weight};
                font-style: normal;
                font-display: swap;
            }`;
        });
    }
    
    // Process Caveat fonts with URL Parser if available
    if (fontData.caveat) {
        fontData.caveat.forEach(font => {
            // Try to use URL Parser for font URLs
            let fontUrl = font.url;
            if (window.urlParser && typeof window.urlParser.fixURLEncoding === 'function') {
                fontUrl = window.urlParser.fixURLEncoding(fontUrl);
            }
            
            fontFaceDeclarations += `
            @font-face {
                font-family: 'Caveat';
                src: url('${fontUrl}') format('${font.format}');
                font-weight: ${font.weight};
                font-style: normal;
                font-display: swap;
            }`;
        });
    }
    
    // Insert the font declarations into the style element
    fontStylesElement.textContent = fontFaceDeclarations;
    console.log("Font declarations loaded");
}

/**
 * Initialize logo and branding assets
 */
function initLogoAndBranding(assetLibrary) {
    if (!assetLibrary || !assetLibrary.na_assets) {
        console.error("Branding assets not found");
        return;
    }
    
    // Set logo image if available
    const logoImg = document.getElementById('HEAD__Logo');
    if (logoImg) {
        // Use URL Parser to get the logo URL
        let logoUrl = null;
        
        if (window.urlParser && typeof window.urlParser.getLogoURL === 'function') {
            logoUrl = window.urlParser.getLogoURL(assetLibrary);
        } else if (assetLibrary.na_assets.images_png && assetLibrary.na_assets.images_png["na-brand-logo"]) {
            // Fallback if URL Parser isn't available
            logoUrl = assetLibrary.na_assets.images_png["na-brand-logo"];
        }
        
        if (logoUrl) {
            logoImg.src = logoUrl;
            console.log("Logo image set:", logoUrl);
        } else {
            console.warn("No logo URL found in asset library");
        }
    }
}

/**
 * Shows an error message to the user
 */
function showErrorMessage(message) {
    const errorElement = document.getElementById('NOTE__Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Main initialization function that kicks off the asset loading process
--------------------------------------------
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