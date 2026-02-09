// =============================================================================
// NOBLE ARCHITECTURE - POLYFILL CONDITIONAL LOADER
// =============================================================================
//
// FILE       : CommonUtils__PolyfillConditionalLoader__.js
// NAMESPACE  : NaPlanVision.PolyfillConditionalLoader
// MODULE     : PolyfillConditionalLoader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load core-js polyfill only when required by the browser
// CREATED    : 09-Feb-2026
//
// DESCRIPTION:
// - Detects missing Promise support
// - Loads core-js-bundle polyfill only when necessary
// - Avoids unnecessary downloads on modern browsers
//
// -----
//
// DEVELOPMENT LOG:
// 09-Feb-2026 - Version 1.0.0
// - Initial release
//
// =============================================================================

// #Region ------------------------------------------------
// MODULE | Polyfill Conditional Loader
// --------------------------------------------------------

    (function () {
        'use strict';

        // #Region ------------------------------------------------
        // INIT | Polyfill Check and Load
        // --------------------------------------------------------

            // Feature detection: Check if 'Promise' is supported by the browser
            if (typeof Promise === 'undefined') {
                // If not supported, dynamically load the core-js polyfill
                const Na__PolyfillScript = document.createElement('script');
                Na__PolyfillScript.src = 'https://cdn.jsdelivr.net/npm/core-js-bundle/minified.js';
                Na__PolyfillScript.onload = function () {
                    console.log('Polyfill loaded successfully.');
                };
                document.head.appendChild(Na__PolyfillScript);
            } else {
                console.log('Native support detected; polyfill not needed.');
            }

        // endregion ----------------------------------------------

    })();

// endregion ----------------------------------------------
