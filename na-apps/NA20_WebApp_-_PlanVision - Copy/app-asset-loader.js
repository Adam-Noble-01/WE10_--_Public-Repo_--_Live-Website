// ===================================================================================
// ASSET LIBRARY MANAGEMENT MODULE
// ===================================================================================
//
// FILE NAME
// `app-asset-loader.js`
//
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
//
// Description:
// - This module is responsible for fetching the asset library from the centralised JSON file
// - It also loads the fonts from the asset library
// - It also updates the images from the asset library
// - It also preloads the fonts
// - It also checks if the Caveat font is available
// ----------------------------------------------------------------------------------



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------


// ===================================================================================
// CORE LINK |  URL of the asset library JSON file
// ---------------------------------------------------
const   ASSET_LIBRARY_URL = 
"https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json";
// ===================================================================================



// END OF VARIABLES |  End of Module Variables


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Fetch Asset Library
// ----------------------------------------------------------------------------------
// - Fetches the asset library from the centralised JSON file
// - Corrects case mismatch for File_Metadata
// - Logs all asset entries from all nested sections

async function fetchAssetLibrary() {
    
    try {

        // Fetch the asset library from the centralised JSON file
        const response = await fetch(ASSET_LIBRARY_URL);

        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the JSON response
        const data = await response.json();

        // Correct casing mismatch for File_Metadata
        const fileMeta = data["File_Metadata"];
        const fileName = fileMeta?.["file-name"] ?? "Unnamed Asset Library";

        // CONFIRMATION |  Json Found & Loaded Confirmation Statement
        // ---------------------------------------------------------------
        console.log("LOAD SUCCESS |  ✔  Asset library loaded successfully:", fileName);

        // Traverse and log all assets across nested structures
        for (const sectionKey in data) {

            const section = data[sectionKey];

            // Check for top-level asset group
            if (section && typeof section === "object" && section.assets) {

                const sectionTitle = section["library-file-name"] ?? sectionKey;

                // DEBUG TOOL |  Log section title
                // ---------------------------------
                // console.log(`\nSECTION: ${sectionTitle}`);
                

                for (const assetKey in section.assets) {
                    const asset = section.assets[assetKey];
                    const label = asset["asset-name"] ?? assetKey;
                    const filename = asset["asset-file-name"] ?? "Unnamed File";

                    // DEBUG TOOL |  Log asset details
                    // ---------------------------------
                    // console.log(`   - ${label} [ ${filename} ]`);
                }
            }

            // Check for nested asset groups (e.g. within Common_Web_Assets_Libraries)
            else if (section && typeof section === "object") {

                for (const innerKey in section) {
                    const subsection = section[innerKey];

                    // Check if the subsection has an assets property
                    if (subsection?.assets) {

                        const sectionTitle = subsection["library-file-name"] ?? innerKey;
                        console.log(`\nSECTION: ${sectionTitle}`);

                        for (const assetKey in subsection.assets) {
                            const asset = subsection.assets[assetKey];
                            const label = asset["asset-name"] ?? assetKey;
                            const filename = asset["asset-file-name"] ?? "Unnamed File";

                            // DEBUG TOOL |  Log asset details
                            // ---------------------------------
                            // console.log(`   - ${label} [ ${filename} ]`);
                        }
                    }
                }

            }
        }

        // Return the parsed data
        return data;
        
    } catch (error) {
        console.error("Error fetching asset library:", error.message);
        return null;
    }

}

// END OF FUNCTION |  Fetch Asset Library


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Load Fonts From Asset Library
// ----------------------------------------------------------------------------------
// - Loads fonts from the asset library using @font-face

function loadFontsFromAssetLibrary(assetLibrary) {
    const fontStylesElement = document.getElementById("dynamic-font-styles");
    let fontDeclarations = "";
    
    // Load Open Sans fonts
    const openSansFonts = assetLibrary?.na_assets?.na_fonts?.["fonts-open-sans"] || {};
    if (openSansFonts) {
        if (openSansFonts["open-sans-regular"]) {
            fontDeclarations += `
                @font-face {
                    font-family: 'Open Sans';
                    font-style: normal;
                    font-weight: 400;
                    src: url('${openSansFonts["open-sans-regular"]}') format('truetype');
                    font-display: swap;
                }
            `;
        } else {
            console.warn("Open Sans Regular not found in asset library, using Google Fonts fallback.");
            fontDeclarations += `
                @font-face {
                    font-family: 'Open Sans';
                    font-style: normal;
                    font-weight: 400;
                    src: url('https://fonts.gstatic.com/s/opensans/v35/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2') format('woff2');
                    font-display: swap;
                }
            `;
        }
    }
    
    // Load Caveat fonts
    const caveatFonts = assetLibrary?.na_assets?.na_fonts?.["fonts-caveat"] || {};
    let hasCaveatFonts = false;
    
    if (caveatFonts["caveat-regular"]) {
        hasCaveatFonts = true;
        fontDeclarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 400;
                src: url('${caveatFonts["caveat-regular"]}') format('truetype');
                font-display: swap;
            }
        `;
    }
    
    if (caveatFonts["caveat-semi-bold"]) {
        hasCaveatFonts = true;
        fontDeclarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 600;
                src: url('${caveatFonts["caveat-semi-bold"]}') format('truetype');
                font-display: swap;
            }
        `;
    }
    
    // Add Google Fonts fallback for Caveat if not loaded from asset library
    if (!hasCaveatFonts) {
        console.warn("Caveat fonts not found in asset library, using Google Fonts fallback.");
        fontDeclarations += `
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
    
    // Update the style element with font declarations
    fontStylesElement.innerHTML = fontDeclarations;
    console.log("Font declarations loaded from asset library");

    // Check if Caveat font loaded successfully after a short delay
    setTimeout(checkFontAvailability, 500);
}

// END OF FUNCTION |  Load Fonts From Asset Library


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Update Images From Asset Library
// ----------------------------------------------------------------------------------
// - Updates image sources from the asset library

function updateImagesFromAssetLibrary(assetLibrary) {
    if (!assetLibrary || !assetLibrary.na_assets || !assetLibrary.na_assets.images_png) {
        console.warn("Asset library missing image definitions, using existing sources");
        return;
    }
    
    const images = assetLibrary.na_assets.images_png;
    
    // Update Noble Architecture logo
    if (images["na-brand-logo"]) {
        const logoElements = document.querySelectorAll('img[alt="Noble Architecture Logo"]');
        logoElements.forEach(img => {
            img.src = images["na-brand-logo"];
        });
    }
    
    console.log("Image sources updated from asset library");
}

// END OF FUNCTION |  Update Images From Asset Library


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Preload Fonts
// ----------------------------------------------------------------------------------
// - Preloads fonts to ensure they're available before drawing

async function preloadFonts() {
    try {
        // Create a FontFace object for Caveat
        const caveat = new FontFace('Caveat', 'url(https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIupYS9AoA.woff2)', {
            style: 'normal',
            weight: '400',
            display: 'swap'
        });
        
        // Wait for the font to load
        const loadedFace = await caveat.load();
        
        // Add the loaded font to the document fonts
        document.fonts.add(loadedFace);
        console.log("Caveat font preloaded successfully as backup");
        
        return true;
    } catch (error) {
        console.error("Failed to preload Caveat font:", error);
        return false;
    }
}

// END OF FUNCTION |  Preload Fonts


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Check Font Availability
// ----------------------------------------------------------------------------------
// - Checks if the Caveat font is available and loads fallbacks if needed

async function checkFontAvailability() {
    if (!document.fonts.check("16px 'Caveat'")) {
        console.warn("Caveat font not loaded or available after initialization. Using fallback fonts.");
        
        // Try to preload the font as a last resort
        const preloaded = await preloadFonts();
        
        if (!preloaded) {
            // If preloading fails, use link method as absolute fallback
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap';
            document.head.appendChild(link);
            console.log("Using Google Fonts stylesheet as fallback for Caveat font");
        }
        
        // Display warning to user if in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.error("DEVELOPER WARNING: Sketchy Text Style (Caveat font) failed to load initially.");
        }
    } else {
        console.log("Caveat font loaded successfully. Sketchy text style is available.");
    }
}

// END OF FUNCTION |  Check Font Availability


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// MODULE EXPORTS
// ----------------------------------------------------------------------------------
export {
    fetchAssetLibrary,
    loadFontsFromAssetLibrary,
    updateImagesFromAssetLibrary,
    preloadFonts,
    checkFontAvailability
};