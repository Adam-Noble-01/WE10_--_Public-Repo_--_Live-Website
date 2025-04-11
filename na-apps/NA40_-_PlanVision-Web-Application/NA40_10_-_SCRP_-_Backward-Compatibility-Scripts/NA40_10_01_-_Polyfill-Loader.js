/**
 * Polyfill Conditional Loader
 * Automatically detects browser capability and loads polyfills as needed
 * for backward compatibility with older browsers.
 * 
 * Part of Plan Vision App 3.0.0
 * Noble Architecture
 */

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