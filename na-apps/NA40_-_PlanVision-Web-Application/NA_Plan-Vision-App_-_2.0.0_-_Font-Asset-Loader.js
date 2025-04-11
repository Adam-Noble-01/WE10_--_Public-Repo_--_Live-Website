/**
 * ================================================================================================
 * FONT ASSET LOADER FOR PLANVISION APPLICATION
 * FILE NAME   |  NA_Plan-Vision-App_-_2.0.0_-_Font-Asset-Loader.js
 * FILE TYPE   |  JavaScript
 * ================================================================================================
 *
 * FILE DESCRIPTION
 * - Loads font assets from the centralized web asset library
 * - Dynamically creates @font-face declarations
 * - Ensures proper font weights are applied across the application
 *
 * VERSION HISTORY
 * v1.0.0 (Current) - Initial implementation of font asset loader
 */

/**
 * FontAssetLoader Class
 * Handles loading and applying fonts from the centralized asset library
 */
class FontAssetLoader {
    constructor() {
        this.assetLibraryUrl = 'https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json';
        this.fontData = null;
        this.fontStylesElement = document.getElementById('FONT__Styles-Dynamic');
    }

    /**
     * Initialize the font loader
     * Fetches the asset library and applies fonts
     */
    async initialize() {
        try {
            // Fetch the asset library
            const response = await fetch(this.assetLibraryUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch asset library: ${response.status}`);
            }
            
            const assetLibrary = await response.json();
            
            // Extract font data from the asset library
            this.fontData = this.extractFontData(assetLibrary);
            
            // Generate and apply font-face declarations
            this.applyFonts();
            
            console.log('Font assets loaded successfully.');
            
            // Dispatch event when fonts are loaded
            document.dispatchEvent(new CustomEvent('fontsLoaded'));
            
            return true;
        } catch (error) {
            console.error('Error loading font assets:', error);
            
            // Apply fallback fonts if there was an error
            this.applyFallbackFonts();
            
            return false;
        }
    }

    /**
     * Extract font data from the asset library
     * @param {Object} assetLibrary - The complete asset library object
     * @returns {Object} - Extracted font data
     */
    extractFontData(assetLibrary) {
        const fontLibrary = assetLibrary.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files'];
        
        // Create an object with just the font-related entries
        const fonts = {
            'openSansRegular': fontLibrary['font-open-sans-regular'],
            'openSansSemiBold': fontLibrary['font-open-sans-semibold'],
            'openSansLight': fontLibrary['font-open-sans-light'],
            'openSansMedium': fontLibrary['font-open-sans-medium'],
            'openSansBold': fontLibrary['font-open-sans-bold'],
            'caveatRegular': fontLibrary['font-caveat-regular'],
            'caveatSemiBold': fontLibrary['font-caveat-semibold'],
        };
        
        return fonts;
    }

    /**
     * Generate @font-face declarations and apply them
     */
    applyFonts() {
        if (!this.fontData || !this.fontStylesElement) {
            console.error('Cannot apply fonts: Missing font data or style element');
            return;
        }
        
        const fontFaceDeclarations = `
            /* Open Sans Font Family */
            @font-face {
                font-family: 'Open Sans';
                src: url('${this.fontData.openSansRegular['asset-web-url']}') format('truetype');
                font-weight: 400;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'Open Sans';
                src: url('${this.fontData.openSansSemiBold['asset-web-url']}') format('truetype');
                font-weight: 600;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'Open Sans';
                src: url('${this.fontData.openSansLight['asset-web-url']}') format('truetype');
                font-weight: 300;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'Open Sans';
                src: url('${this.fontData.openSansMedium['asset-web-url']}') format('truetype');
                font-weight: 500;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'Open Sans';
                src: url('${this.fontData.openSansBold['asset-web-url']}') format('truetype');
                font-weight: 700;
                font-style: normal;
                font-display: swap;
            }
            
            /* Caveat Font Family */
            @font-face {
                font-family: 'Caveat';
                src: url('${this.fontData.caveatRegular['asset-web-url']}') format('truetype');
                font-weight: 400;
                font-style: normal;
                font-display: swap;
            }
            
            @font-face {
                font-family: 'Caveat';
                src: url('${this.fontData.caveatSemiBold['asset-web-url']}') format('truetype');
                font-weight: 600;
                font-style: normal;
                font-display: swap;
            }
            
            /* Apply correct font weights to specific elements */
            .BTTN__Tool, 
            .BTTN__standard,
            .BTTN__Markup-Dialog {
                font-family: 'Open Sans', sans-serif;
                font-weight: 600; /* SemiBold weight */
            }
            
            #DLOG__Markup-Text-Input {
                font-family: 'Caveat', 'Comic Sans MS', cursive, sans-serif;
                font-weight: 400; /* Regular weight */
            }
        `;
        
        // Apply the font-face declarations
        this.fontStylesElement.textContent = fontFaceDeclarations;
    }

    /**
     * Apply fallback fonts if loading from the asset library fails
     */
    applyFallbackFonts() {
        if (!this.fontStylesElement) {
            console.error('Cannot apply fallback fonts: Missing style element');
            return;
        }
        
        const fallbackStyles = `
            /* Fallback system fonts */
            body {
                font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
            }
            
            .BTTN__Tool, 
            .BTTN__standard,
            .BTTN__Markup-Dialog {
                font-weight: 600;
            }
            
            #DLOG__Markup-Text-Input {
                font-family: 'Comic Sans MS', cursive, sans-serif;
            }
        `;
        
        this.fontStylesElement.textContent = fallbackStyles;
    }
}

// Initialize the font loader when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const fontLoader = new FontAssetLoader();
    fontLoader.initialize();
}); 