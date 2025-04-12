/*
================================================================================
JAVASCRIPT |  FONT STYLE GENERATOR
- Created v2.0.0
DESCRIPTION
- Handles the generation of dynamic font styles based on font data loaded
- Creates CSS declarations from font data and adds them to the DOM
- Respects disable-fallback-assets configuration flag
================================================================================
*/

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  MODULE SCOPE VARIABLES
- Introduced in v2.0.0
DESCRIPTION
- Variables available within the module scope 
-------------------------------------------------------------------------------
*/

// Reference to the style element for font declarations
let fontStylesElement = null;

// Initialize the window object for this module
window.fontStyleGenerator = {};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  EVENT HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Functions to handle events related to font loading
-------------------------------------------------------------------------------
*/

/**
 * Initialize the font style generator
 */
window.fontStyleGenerator.init = function() {
    console.log("FONT_STYLE_GENERATOR: Initializing");
    
    // Get reference to the style element
    fontStylesElement = document.getElementById('FONT__Styles-Dynamic');
    
    // Listen for font data loaded event from the master asset loader
    document.addEventListener('fontDataLoaded', window.fontStyleGenerator.handleFontDataLoaded);
    
    // Also listen for the general assets loaded event
    document.addEventListener('assetsLoaded', window.fontStyleGenerator.handleAssetsLoaded);
};

/**
 * Handler for when all assets are loaded
 * @param {CustomEvent} event - The assets loaded event
 */
window.fontStyleGenerator.handleAssetsLoaded = function(event) {
    console.log("FONT_STYLE_GENERATOR: Assets loaded event received");
    
    // Check if we have font data in the event detail
    if (event.detail && event.detail.fontData) {
        window.fontStyleGenerator.handleFontDataLoaded({
            detail: {
                fontData: event.detail.fontData,
                isFallback: false
            }
        });
    }
};

/**
 * Handler for when font data is loaded
 * @param {CustomEvent} event - The font data loaded event
 */
window.fontStyleGenerator.handleFontDataLoaded = function(event) {
    console.log("FONT_STYLE_GENERATOR: Font data loaded event received");
    
    const fontData = event.detail.fontData;
    const isFallback = event.detail.isFallback || false;
    
    // Check if fallback assets are disabled in the app config
    const disableFallbackAssets = window.appConfig?.Core_App_Config?.["disable-fallback-assets"] || false;
    
    // If fallback assets are disabled and this is fallback data, don't use it
    if (disableFallbackAssets && isFallback) {
        console.log("FONT_STYLE_GENERATOR: Fallback assets are disabled. Not using fallback font data.");
        return;
    }
    
    // Generate CSS declarations
    const fontDeclarations = window.fontStyleGenerator.generateFontDeclarations(fontData, disableFallbackAssets);
    
    // Update the style element
    if (fontStylesElement && fontDeclarations) {
        fontStylesElement.innerHTML = fontDeclarations;
        console.log("FONT_STYLE_GENERATOR: Font declarations updated in the DOM");
    } else {
        console.error("FONT_STYLE_GENERATOR: Could not update font declarations");
    }
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  FONT DECLARATION GENERATION
- Introduced in v2.0.0
DESCRIPTION
- Functions to generate CSS font-face declarations
-------------------------------------------------------------------------------
*/

/**
 * Generate CSS font-face declarations
 * @param {Object} fontData - Font data from the asset library
 * @param {boolean} disableFallbackAssets - Whether fallback assets are disabled
 * @returns {string} - CSS declarations
 */
window.fontStyleGenerator.generateFontDeclarations = function(fontData, disableFallbackAssets) {
    console.log("FONT_STYLE_GENERATOR: Generating font declarations");
    
    let declarations = "";
    
    // Process Open Sans fonts
    declarations += generateOpenSansFontDeclarations(fontData, disableFallbackAssets);
    
    // Process Caveat fonts for handwriting
    declarations += generateCaveatFontDeclarations(fontData, disableFallbackAssets);
    
    return declarations;
};

/**
 * Generate Open Sans font declarations
 * @param {Object} fontData - Font data from the asset library
 * @param {boolean} disableFallbackAssets - Whether fallback assets are disabled
 * @returns {string} - CSS declarations for Open Sans fonts
 */
function generateOpenSansFontDeclarations(fontData, disableFallbackAssets) {
    let declarations = "";
    
    // Regular weight (400)
    if (fontData.openSansRegular && fontData.openSansRegular['asset-web-url']) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 400;
                src: url('${fontData.openSansRegular['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    } else if (!disableFallbackAssets) {
        console.warn("FONT_STYLE_GENERATOR: Open Sans Regular not found in asset library, using Google Fonts fallback.");
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 400;
                src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    // Light weight (300)
    if (fontData.openSansLight && fontData.openSansLight['asset-web-url']) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 300;
                src: url('${fontData.openSansLight['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    } else if (!disableFallbackAssets) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 300;
                src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    // Medium weight (500)
    if (fontData.openSansMedium && fontData.openSansMedium['asset-web-url']) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 500;
                src: url('${fontData.openSansMedium['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    } else if (!disableFallbackAssets) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 500;
                src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    // SemiBold weight (600)
    if (fontData.openSansSemiBold && fontData.openSansSemiBold['asset-web-url']) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 600;
                src: url('${fontData.openSansSemiBold['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    } else if (!disableFallbackAssets) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 600;
                src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    // Bold weight (700)
    if (fontData.openSansBold && fontData.openSansBold['asset-web-url']) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 700;
                src: url('${fontData.openSansBold['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    } else if (!disableFallbackAssets) {
        declarations += `
            @font-face {
                font-family: 'Open Sans';
                font-style: normal;
                font-weight: 700;
                src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    return declarations;
}

/**
 * Generate Caveat font declarations
 * @param {Object} fontData - Font data from the asset library
 * @param {boolean} disableFallbackAssets - Whether fallback assets are disabled
 * @returns {string} - CSS declarations for Caveat fonts
 */
function generateCaveatFontDeclarations(fontData, disableFallbackAssets) {
    let declarations = "";
    let hasCaveatFonts = false;
    
    // Regular weight (400)
    if (fontData.caveatRegular && fontData.caveatRegular['asset-web-url']) {
        hasCaveatFonts = true;
        declarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 400;
                src: url('${fontData.caveatRegular['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    }
    
    // SemiBold weight (600)
    if (fontData.caveatSemiBold && fontData.caveatSemiBold['asset-web-url']) {
        hasCaveatFonts = true;
        declarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 600;
                src: url('${fontData.caveatSemiBold['asset-web-url']}') format('truetype');
                font-display: swap;
            }
        `;
    }
    
    // Add Google Fonts fallback for Caveat if needed
    if (!hasCaveatFonts && !disableFallbackAssets) {
        console.warn("FONT_STYLE_GENERATOR: Caveat fonts not found in asset library, using Google Fonts fallback.");
        declarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 400;
                src: url('https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIupYS9AoA.woff2') format('woff2');
                font-display: swap;
            }
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 600;
                src: url('https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjSx6eIupYS9AoA.woff2') format('woff2');
                font-display: swap;
            }
        `;
    }
    
    return declarations;
}

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  MODULE INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Code that runs when the script is loaded
-------------------------------------------------------------------------------
*/

// Initialize the module when the DOM is loaded
document.addEventListener('DOMContentLoaded', window.fontStyleGenerator.init);

// Log that this module has loaded
console.log("FONT_STYLE_GENERATOR: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("fontStyleGenerator");
} 