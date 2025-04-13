// ===================================================================================
// ASSET LIBRARY MANAGEMENT MODULE
// ===================================================================================
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
// None for this module - all functions are stateless



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Fetch Asset Library
// ----------------------------------------------------------------------------------
// - Fetches the asset library from the centralised JSON file

async function fetchAssetLibrary() {
    const ASSET_LIBRARY_URL = "https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json";

    try {
        const response = await fetch(ASSET_LIBRARY_URL);
        if (!response.ok) {
            // Don't log file-name here if response failed
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        // Safely access file-name for logging using optional chaining
        console.log("Asset library loaded successfully:", data?.file_metadata?.["file-name"] || "Unknown File");
        return data;
    } catch (error) {
        console.error("Error fetching asset library:", error.message);
        // Continue with app initialization even if asset library fails to load
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
    if (!fontStylesElement) {
        console.error("Element with ID 'dynamic-font-styles' not found. Cannot load fonts.");
        return;
    }
    let fontDeclarations = "";

    // Load Open Sans fonts
    const openSansFonts = assetLibrary?.na_assets?.na_fonts?.["fonts-open-sans"] || {};
    if (openSansFonts && openSansFonts["open-sans-regular"]) { // Check specific font exists
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
        // Add fallback directly
         fontDeclarations += `
            /* Fallback for Open Sans Regular */
            @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400&display=swap');
         `;
    }


    // Load Caveat fonts
    const caveatFonts = assetLibrary?.na_assets?.na_fonts?.["fonts-caveat"] || {};
    let hasCaveatRegular = false;
    let hasCaveatSemiBold = false;

    if (caveatFonts && caveatFonts["caveat-regular"]) {
        hasCaveatRegular = true;
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

    if (caveatFonts && caveatFonts["caveat-semi-bold"]) {
        hasCaveatSemiBold = true;
        fontDeclarations += `
            @font-face {
                font-family: 'Caveat';
                font-style: normal;
                font-weight: 600; /* Correct weight for semi-bold */
                src: url('${caveatFonts["caveat-semi-bold"]}') format('truetype');
                font-display: swap;
            }
        `;
    }

    // Add Google Fonts fallback for Caveat if *either* weight is missing
    if (!hasCaveatRegular || !hasCaveatSemiBold) {
        console.warn("Caveat fonts not fully found in asset library, using Google Fonts fallback.");
         fontDeclarations += `
            /* Fallback for Caveat 400 & 600 */
             @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap');
         `;
        // Note: Using @import might be slightly less performant than individual @font-face fallbacks,
        // but it's simpler to ensure both weights are available.
    }

    // Update the style element with font declarations
    fontStylesElement.innerHTML = fontDeclarations;
    console.log("Font declarations processed (check network/console for details).");

    // Check if Caveat font loaded successfully after a short delay
    setTimeout(checkFontAvailability, 500);
}

// END OF FUNCTION |  Load Fonts From Asset Library


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Update Images From Asset Library
// ----------------------------------------------------------------------------------
// - Updates image sources from the asset library

function updateImagesFromAssetLibrary(assetLibrary) {
    // Add extra checks for robustness
    if (!assetLibrary?.na_assets?.images_png) {
        console.warn("Asset library missing image definitions or structure invalid, using existing sources.");
        return;
    }

    const images = assetLibrary.na_assets.images_png;

    // Update Noble Architecture logo
    if (images["na-brand-logo"]) {
        const logoElements = document.querySelectorAll('img[alt="Noble Architecture Logo"]');
        if (logoElements.length > 0) {
            logoElements.forEach(img => {
                img.src = images["na-brand-logo"];
            });
            console.log("Logo image source updated from asset library.");
        } else {
            console.warn("No elements found with alt='Noble Architecture Logo' to update.");
        }
    } else {
         console.warn("Logo image 'na-brand-logo' not found in asset library images_png.");
    }

    // Example: Update another image if needed
    // if (images["some-other-image-key"]) {
    //     const otherImg = document.getElementById("some-image-id");
    //     if (otherImg) {
    //         otherImg.src = images["some-other-image-key"];
    //     }
    // }

}

// END OF FUNCTION |  Update Images From Asset Library


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Preload Fonts
// ----------------------------------------------------------------------------------
// - Preloads fonts to ensure they're available before drawing - Primarily as a fallback mechanism

async function preloadFonts() {
    // Preload Caveat Regular (400)
    try {
        const caveatRegular = new FontFace('Caveat', 'url(https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIupYS9AoA.woff2)', {
            style: 'normal', weight: '400', display: 'swap'
        });
        const loadedRegular = await caveatRegular.load();
        document.fonts.add(loadedRegular);
        console.log("Caveat Regular (400) font preloaded successfully as fallback.");
    } catch (error) {
        console.error("Failed to preload Caveat Regular (400) font:", error);
        return false; // Indicate failure
    }

     // Preload Caveat Semi-Bold (600)
     try {
        const caveatSemiBold = new FontFace('Caveat', 'url(https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjSx6eIupYS9AoA.woff2)', { // Correct URL for 600 weight
            style: 'normal', weight: '600', display: 'swap'
        });
        const loadedSemiBold = await caveatSemiBold.load();
        document.fonts.add(loadedSemiBold);
        console.log("Caveat Semi-Bold (600) font preloaded successfully as fallback.");
     } catch (error) {
         console.error("Failed to preload Caveat Semi-Bold (600) font:", error);
         return false; // Indicate failure
     }

    return true; // Indicate success only if both succeeded (or adjust logic as needed)
}

// END OF FUNCTION |  Preload Fonts


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .


// FUNCTION |  Check Font Availability
// ----------------------------------------------------------------------------------
// - Checks if the Caveat font (both weights) is available and loads fallbacks if needed

async function checkFontAvailability() {
    const isRegularAvailable = document.fonts.check("16px 'Caveat'", undefined, { weight: '400' });
    const isSemiBoldAvailable = document.fonts.check("16px 'Caveat'", undefined, { weight: '600' });

    if (!isRegularAvailable || !isSemiBoldAvailable) {
        console.warn(`Caveat font not fully available after initialization (Regular: ${isRegularAvailable}, SemiBold: ${isSemiBoldAvailable}). Attempting fallback...`);

        // Try to preload the font(s) as a last resort using the dedicated function
        const preloaded = await preloadFonts(); // preloadFonts now tries both weights

        // If preloading still fails, use link method as absolute fallback
        if (!preloaded || !document.fonts.check("16px 'Caveat'", undefined, { weight: '400' }) || !document.fonts.check("16px 'Caveat'", undefined, { weight: '600' })) {
             // Check if link already exists to avoid duplicates
             if (!document.querySelector('link[href*="family=Caveat"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap';
                document.head.appendChild(link);
                console.log("Using Google Fonts stylesheet as absolute fallback for Caveat font.");
             } else {
                 console.log("Google Fonts stylesheet for Caveat already present.");
             }
        }

        // Display warning to user if in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.error("DEVELOPER WARNING: Sketchy Text Style (Caveat font) failed to load initially or completely.");
        }
    } else {
        console.log("Caveat font (Regular & Semi-Bold) loaded successfully. Sketchy text style is available.");
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
    preloadFonts, // Keep export if needed elsewhere, otherwise could be internal
    checkFontAvailability
};