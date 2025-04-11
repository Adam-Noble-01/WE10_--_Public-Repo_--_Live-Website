/*
================================================================================
JAVASCRIPT |  URL PARSER UTILITY
- Introduced in v2.0.0
DESCRIPTION
- Handles URL parsing, validation, and normalization
- Supports both GitHub and local asset URLs
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for URL handling
--------------------------------------------
*/

// Base URLs for various environments
const BASE_URLS = {
    github: "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/",
    local: window.location.origin + "/"
};

// Allowed file extensions
const ALLOWED_EXTENSIONS = {
    images: ['.png', '.jpg', '.jpeg', '.svg', '.gif'],
    documents: ['.pdf'],
    fonts: ['.ttf', '.woff', '.woff2', '.eot', '.otf']
};

/*
--------------------------------------------
JAVASCRIPT |  URL PARSING FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Core URL parsing and validation functions
--------------------------------------------
*/

/**
 * Extract URL from a drawing object using various possible formats
 * @param {Object} drawingObj - The drawing object from JSON
 * @param {string} resourceType - Type of resource ('png', 'pdf', etc.)
 * @returns {string|null} - The extracted URL or null if not found
 */
function extractURL(drawingObj, resourceType = 'png') {
    if (!drawingObj) return null;
    
    console.log(`Extracting ${resourceType} URL from:`, drawingObj);
    
    let url = null;
    
    // Try various possible formats for URLs
    
    // Format 1: Standard format in our JSON
    if (drawingObj["document-links"] && 
        drawingObj["document-links"][`${resourceType}--github-link-url`]) {
        url = drawingObj["document-links"][`${resourceType}--github-link-url`];
    }
    
    // Format 2: Windows file path in our JSON
    else if (drawingObj["document-links"] && 
             drawingObj["document-links"][`${resourceType}--windows-dir-path`]) {
        const filePath = drawingObj["document-links"][`${resourceType}--windows-dir-path`];
        url = localPathToURL(filePath);
    }
    
    // Format A: Alternative kebab-case format
    else if (drawingObj[`${resourceType}-url`]) {
        url = drawingObj[`${resourceType}-url`];
    }
    
    // Format 3: Alternative snake_case format
    else if (drawingObj[`${resourceType}_url`]) {
        url = drawingObj[`${resourceType}_url`];
    }
    
    // Format 4: Alternative camelCase format
    else if (drawingObj[`${resourceType}Url`]) {
        url = drawingObj[`${resourceType}Url`];
    }
    
    // Format 5: Generic URL with extension check
    else if (drawingObj["url"] && 
        drawingObj["url"].toLowerCase().endsWith(`.${resourceType}`)) {
        url = drawingObj["url"];
    }
    
    // Format 6: Image-specific alternatives for PNG
    else if (resourceType === 'png' && 
        (drawingObj["image-url"] || drawingObj["image_url"] || drawingObj["imageUrl"])) {
        url = drawingObj["image-url"] || drawingObj["image_url"] || drawingObj["imageUrl"];
    }
    
    // Format 7: Look for a file-name and try to construct a URL
    else if (drawingObj["file-name"] && BASE_URLS.github) {
        // This is a fallback that assumes a standard GitHub repository structure
        url = `${BASE_URLS.github}SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/${drawingObj["file-name"]}.${resourceType}`;
    }
    
    // If we found a URL but it's a Windows path, convert it
    if (url && (url.includes('\\') || url.match(/^[A-Za-z]:\//))) {
        url = localPathToURL(url);
    }
    
    if (!url) {
        console.warn(`No ${resourceType} URL found for drawing:`, drawingObj);
    } else {
        console.log(`Found ${resourceType} URL:`, url);
    }
    
    return url;
}

/**
 * Validates a URL for security and format
 * @param {string} url - The URL to validate
 * @param {string} resourceType - Type of resource ('image', 'document', 'font')
 * @returns {boolean} - Whether the URL is valid
 */
function isValidURL(url, resourceType = 'image') {
    if (!url) return false;
    
    try {
        // Try to create a URL object (catches malformed URLs)
        const urlObj = new URL(url);
        
        // Security check: Only allow certain protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            console.warn(`Invalid protocol in URL: ${url}`);
            return false;
        }
        
        // Check for allowed extensions if resourceType is specified
        if (resourceType && ALLOWED_EXTENSIONS[resourceType]) {
            const extension = url.substring(url.lastIndexOf('.')).toLowerCase();
            if (!ALLOWED_EXTENSIONS[resourceType].includes(extension)) {
                console.warn(`URL has invalid extension for ${resourceType}: ${url}`);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error(`Error validating URL ${url}:`, error);
        return false;
    }
}

/**
 * Makes a URL absolute if it's relative
 * @param {string} url - The URL to process
 * @returns {string} - The absolute URL
 */
function ensureAbsoluteURL(url) {
    if (!url) return '';
    
    // Check if URL is already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // Handle different types of relative URLs
    if (url.startsWith('/')) {
        // Root-relative URL
        return window.location.origin + url;
    } else {
        // Relative to current path
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        return window.location.origin + basePath + url;
    }
}

/**
 * Fix encoding issues in URLs
 * @param {string} url - The URL to fix
 * @returns {string} - The fixed URL
 */
function fixURLEncoding(url) {
    if (!url) return '';
    
    // Replace spaces with %20
    let fixedUrl = url.replace(/ /g, '%20');
    
    // Encode any other special characters that might cause issues
    // But don't double-encode already encoded characters
    try {
        // Check if the URL has already been encoded
        const decodedUrl = decodeURIComponent(fixedUrl);
        if (decodedUrl !== fixedUrl) {
            // URL was already encoded
            return fixedUrl;
        } else {
            // Encode the URL components properly
            const urlObj = new URL(fixedUrl);
            // Keep the protocol and hostname as is, encode the path
            return `${urlObj.protocol}//${urlObj.hostname}${encodeURI(urlObj.pathname)}${urlObj.search}${urlObj.hash}`;
        }
    } catch (error) {
        // If there's an error parsing the URL, try a simpler approach
        return encodeURI(fixedUrl);
    }
}

/*
--------------------------------------------
JAVASCRIPT |  LOCAL DEVELOPMENT SUPPORT
- Introduced in v2.0.0
DESCRIPTION
- Support functions for local development when JSON files aren't available
--------------------------------------------
*/

/**
 * Generate placeholder assets for local development
 * @returns {Object} - Placeholder asset library
 */
function generatePlaceholderAssets() {
    console.log("Generating placeholder assets for local development");
    
    return {
        na_assets: {
            images_png: {
                "na-brand-logo": "https://placekitten.com/200/50", // Placeholder logo
                "icon_toolbar": "https://placekitten.com/32/32"
            },
            na_fonts: {
                fonts_open_sans: {
                    "open-sans-regular": "https://fonts.googleapis.com/css2?family=Open+Sans&display=swap",
                    "open-sans-semi-bold": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@600&display=swap",
                    "open-sans-light": "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300&display=swap"
                },
                fonts_caveat: {
                    "caveat-regular": "https://fonts.googleapis.com/css2?family=Caveat&display=swap",
                    "caveat-semi-bold": "https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap"
                }
            }
        }
    };
}

/**
 * Generate placeholder drawing data for local development
 * @returns {Object} - Placeholder drawing library
 */
function generatePlaceholderDrawings() {
    console.log("Generating placeholder drawings for local development");
    
    // Determine if we have the GitHub URLs or need local fallbacks
    const useLocalFallbacks = true; // Set to false to try GitHub URLs first
    
    // Create placeholder drawings with direct links to test images
    return {
        "project-drawings": {
            "drawing-01": {
                "file-name": "Placeholder-Floor-Plan",
                "document-name": "Placeholder Floor Plan",
                "document-scale": "1:100",
                "document-size": "A1",
                "png-url": useLocalFallbacks ? 
                    "assets/placeholder-floor-plan.html" : 
                    "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/JH03_T02_D02_--_Floor-Plans.png",
                "pdf-url": "https://github.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/blob/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/JH03_T02_D02_--_Floor-Plans.pdf"
            },
            "drawing-02": {
                "file-name": "Placeholder-Elevations",
                "document-name": "Placeholder Elevations",
                "document-scale": "1:50",
                "document-size": "A1",
                "png-url": useLocalFallbacks ?
                    "assets/placeholder-elevation.html" :
                    "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/JH03_T02_D03_--_Elevations.png",
                "pdf-url": "https://github.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/blob/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_32_--_PlanVision_-_Placeholder-Testing-Assets/JH03_T02_D03_--_Elevations.pdf"
            }
        }
    };
}

/*
--------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Export functions for use by other modules
--------------------------------------------
*/

// Export the module's public API
window.urlParser = {
    extractURL,
    extractUrls,
    isValidURL,
    ensureAbsoluteURL,
    fixURLEncoding,
    localPathToURL,
    generatePlaceholderAssets,
    generatePlaceholderDrawings
};

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('URL Parser utility initialized');
});

/**
 * Attempt to convert a local file path to a web URL
 * @param {string} filePath - The file path to convert
 * @returns {string|null} - The web URL or null if conversion isn't possible
 */
function localPathToURL(filePath) {
    if (!filePath) return null;
    
    // Clean up the path - handle Windows and Unix paths
    let cleanPath = filePath.replace(/\\/g, '/');
    
    // Remove drive letter if present (e.g., D:/)
    cleanPath = cleanPath.replace(/^[A-Za-z]:\//, '/');
    
    // Check if this path is within our known structure
    if (cleanPath.includes('/na-apps/') || 
        cleanPath.includes('/assets/') || 
        cleanPath.includes('/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/')) {
        
        // For local development, use relative path
        const segments = cleanPath.split('/');
        const fileName = segments[segments.length - 1];
        
        // If it's an image file in the assets folder
        if (fileName.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
            return `assets/${fileName}`;
        }
        
        // If it's in na-apps
        if (cleanPath.includes('/na-apps/')) {
            const naAppsIndex = cleanPath.indexOf('/na-apps/');
            return cleanPath.substring(naAppsIndex + 1); // +1 to remove leading slash
        }
    }
    
    // If it's already a URL, return it
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    
    // Otherwise, try to infer from the file extension
    const segments = cleanPath.split('/');
    const fileName = segments[segments.length - 1];
    
    // For known file types in likely places
    if (fileName.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        return `assets/images/${fileName}`;
    } else if (fileName.match(/\.(pdf|doc|docx)$/i)) {
        return `assets/documents/${fileName}`;
    } else if (fileName.match(/\.(ttf|woff|woff2|otf|eot)$/i)) {
        return `assets/fonts/${fileName}`;
    }
    
    // If all else fails, just return a cleaned up version of the path
    console.warn("Could not properly convert local path to URL:", filePath);
    return fileName;
}

/**
 * Extract all relevant URLs from a drawing object
 * @param {Object} drawingObj - The drawing object from JSON
 * @returns {Object} - Object containing URLs for different resource types
 */
function extractUrls(drawingObj) {
    if (!drawingObj) {
        console.error("Cannot extract URLs from undefined drawing object");
        return {};
    }
    
    console.log("Extracting all URLs from drawing object:", drawingObj);
    
    // Extract URLs for different resource types
    const pngUrl = extractURL(drawingObj, 'png');
    const pdfUrl = extractURL(drawingObj, 'pdf');
    
    // Construct result object
    const result = {
        png: pngUrl,
        pdf: pdfUrl
    };
    
    console.log("Extracted URLs:", result);
    return result;
} 