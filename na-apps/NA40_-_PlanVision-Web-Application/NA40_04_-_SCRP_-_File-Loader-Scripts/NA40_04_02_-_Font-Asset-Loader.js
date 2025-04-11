/**
 * ================================================================================================
 * FONT ASSET LOADER FOR PLANVISION APPLICATION
 * FILE NAME   |  NA_Plan-Vision-App_-_2.0.0_-_Font-Asset-Loader.js
 * FILE TYPE   |  JavaScript
 * ================================================================================================
 *
 * FILE DESCRIPTION
 * - Loads font assets from the centralized web asset library
 * - Extracts font URLs from asset JSON data
 * - Makes font data available for the application to use
 *
 * VERSION HISTORY
 * v1.0.0 - Initial implementation of font asset loader
 * v1.1.0 - Refactored to separate font loading from CSS styling
 */

/**
 * FontAssetLoader Class
 * Handles loading font data from the centralized asset library
 */
class FontAssetLoader {
    constructor() {
        // Use relative path to the asset library
        this.assetLibraryUrl = '/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json';
        this.fontData = null;
    }

    /**
     * Initialize the font loader
     * Fetches the asset library and extracts font data
     * @returns {Promise<Object|null>} - Font data object or null if failed
     */
    async initialize() {
        try {
            console.log("Font Asset Loader: Initializing...");
            
            // Make sure we have root-relative path for assets
            let assetLibraryUrl = this.assetLibraryUrl;
            if (!assetLibraryUrl.startsWith('http') && !assetLibraryUrl.startsWith('/')) {
                assetLibraryUrl = '/' + assetLibraryUrl;
            }
            
            // Add origin for root-relative URLs
            if (assetLibraryUrl.startsWith('/')) {
                assetLibraryUrl = window.location.origin + assetLibraryUrl;
            }
            
            console.log("Font Asset Loader: Fetching asset library from", assetLibraryUrl);
            
            // Fetch the asset library
            const response = await fetch(assetLibraryUrl);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch asset library: ${response.status}`);
            }
            
            const assetLibrary = await response.json();
            console.log("Font Asset Loader: Asset library fetched successfully");
            
            // Extract font data from the asset library
            this.fontData = this.extractFontData(assetLibrary);
            
            if (!this.fontData) {
                throw new Error("Font data could not be extracted from asset library");
            }
            
            console.log('Font Asset Loader: Font data extracted successfully');
            
            // Make font data globally available
            window.fontAssetData = this.fontData;
            
            // Dispatch event when font data is loaded
            document.dispatchEvent(new CustomEvent('fontDataLoaded', { 
                detail: { fontData: this.fontData } 
            }));
            
            return this.fontData;
        } catch (error) {
            console.error('Font Asset Loader Error:', error);
            
            // Use fallback data if available
            this.fontData = this.getFallbackFontData();
            
            // Make fallback font data globally available
            if (this.fontData) {
                window.fontAssetData = this.fontData;
                document.dispatchEvent(new CustomEvent('fontDataLoaded', { 
                    detail: { fontData: this.fontData, isFallback: true } 
                }));
                return this.fontData;
            }
            
            return null;
        }
    }

    /**
     * Extract font data from the asset library
     * @param {Object} assetLibrary - The complete asset library object
     * @returns {Object} - Extracted font data
     */
    extractFontData(assetLibrary) {
        console.log("Font Asset Loader: Extracting font data from asset library");
        
        // Explicitly look for the font data in the Common_Web_Assets_Libraries section first - this is the correct structure
        if (assetLibrary.Common_Web_Assets_Libraries && 
            assetLibrary.Common_Web_Assets_Libraries['AD04_-_LIBR_-_Common_-_Front-Files']) {
            
            console.log("Font Asset Loader: Found font data in Common_Web_Assets_Libraries structure");
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
            console.log("Font Asset Loader: Found font data in na_assets.na_fonts structure");
            return assetLibrary.na_assets.na_fonts;
        }
        
        // Fallback to placeholder data if available via URL Parser
        if (window.urlParser && typeof window.urlParser.generatePlaceholderAssets === 'function') {
            console.log("Font Asset Loader: Using placeholder font data from URL Parser");
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
        console.error("Font Asset Loader: Could not find any font data - will use fallback data");
        return null;
    }

    /**
     * Get fallback font data if the asset library loading fails
     * @returns {Object} - Fallback font data with CDN URLs
     */
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

    /**
     * Get the loaded font data
     * @returns {Object|null} - The loaded font data or null if not loaded
     */
    getFontData() {
        return this.fontData;
    }
}

// Initialize the font loader when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const fontLoader = new FontAssetLoader();
    fontLoader.initialize();
}); 