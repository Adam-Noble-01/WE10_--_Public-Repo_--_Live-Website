// ===================================================================================
// FEATURE  DETECT POLYFILL LOADER
// ===================================================================================
// OFFLOADED | 12-Apr-2025
// Tested - Confirmed module is working as expected ✔
//
// Description:
// - This module is responsible for checking if the browser supports modern JavaScript features (e.g. Promise).
// - If native support is missing (common in older iOS devices), 
// - it dynamically loads the core-js-bundle polyfill from a CDN to supply the missing functionality.
// - On newer devices that already support these features, the polyfill is not loaded, ensuring optimal performance.
// ----------------------------------------------------------------------------------



// ----------------------------------------------------------------------------------
// MODULE VARIABLES
// ----------------------------------------------------------------------------------
// None for this module - all functions are stateless


//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



// FUNCTION |  Polyfill Conditional Loader
// ----------------------------------------------------------------------------------
// - This script checks if the browser supports modern JavaScript features (e.g. Promise).
// - If native support is missing (common in older iOS devices), it dynamically loads the
//   - core-js-bundle polyfill from a CDN to supply the missing functionality. On newer devices
// - that already support these features, the polyfill is not loaded, ensuring optimal performance.
// ----------------------------------------------------------------------------------

(function() {
    // Feature detection: Check if 'Promise' is supported by the browser
    if (typeof Promise === "undefined") {
        // If not supported, dynamically load the core-js polyfill
        var polyfillScript = document.createElement("script");
        polyfillScript.src = "https://cdn.jsdelivr.net/npm/core-js-bundle/minified.js";
        polyfillScript.onload = function() {
        console.log("Polyfill loaded successfully.");
        };
        document.head.appendChild(polyfillScript);
    } else {
        console.log("Native support detected; polyfill not needed.");
    }
})();

// End of Polyfill Conditional Loader
// ----------------------------------------------------------------------------------



//   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .  .



