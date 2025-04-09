/**
    ===============================================================================================
    SCRIPT      |  Header Version Injector
    FILE NAME   |  header-version-injector.js
    DESCRIPTION |  A utility script to inject version numbers into Noble Architecture app headers
    AUTHOR      |  Adam Noble - Studio NoodlFjord
    VERSION     |  1.0.0
    ===============================================================================================

    - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    SCRIPT DESCRIPTION

    This JavaScript module provides a reusable function for injecting version numbers into
    Noble Architecture application headers. It's designed to:
    - Read version information from a meta tag in the HTML.
    - Find and update the header title element with the version.
    - Apply consistent styling to the version note.
    - Handle various edge cases and provide helpful console feedback.

    - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    USAGE EXAMPLE

    1. Include the script in your HTML:
       <script src="/src/js/header-version-injector.js"></script>

    2. Add a meta tag with your version:
       <meta name="application-version" content="1.0.0">

    3. Call the function (with optional configuration):
       injectVersionNote();
       // or with options
       injectVersionNote({
           metaTagName: 'my-version',
           prefix: ' v',
           style: { fontSize: '14px' }
       });

    - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    DEVELOPMENT NOTES & LESSONS LEARNED

    - Meta Tag Dependency: Relies on presence of meta tag for version info.
    - DOM Structure: Expects specific class names unless overridden via options.
    - Text Node Handling: Carefully preserves existing title text while adding version.
    - Error States: Provides detailed console feedback for troubleshooting.

    ==============================================================================================
 */

// ==============================================================================================
// JAVASCRIPT | CONFIGURATION & TYPE DEFINITIONS
// - Introduced in v1.0.0
// Contains JSDoc type definitions and default configuration values.
// =============================================================================================

/**
 * Configuration options for version note injection
 * @typedef {Object} VersionInjectorOptions
 * @property {string} [metaTagName='application-version'] - Name of the meta tag containing version
 * @property {string} [targetElementClass='HEAD__title'] - Class of the target header element
 * @property {string} [prefix=' - Version '] - Text to prepend to version number
 * @property {string} [suffix=''] - Text to append after version number
 * @property {Object} [style] - Custom styles for version note
 */

// =============================================================================================
// JAVASCRIPT | MAIN INJECTOR FUNCTION
// - Introduced in v1.0.0
// Primary function that handles version note injection into the DOM.
// =============================================================================================

/**
 * Injects a version note into the application header title
 * @param {VersionInjectorOptions} [options={}] - Configuration options
 * @returns {void}
 */
function injectVersionNote(options = {}) {
    // --- Configuration with Defaults ---
    const config = {
        metaTagName: options.metaTagName || 'application-version',
        targetElementClass: options.targetElementClass || 'HEAD__title',
        prefix: options.prefix !== undefined ? options.prefix : ' - Version ',
        suffix: options.suffix !== undefined ? options.suffix : '',
        style: options.style || {
            fontSize: '12px',
            color: '#656565',
            fontWeight: 'normal'
        }
    };

    // --- Find Target Element ---
    const targetElement = document.querySelector(`.${config.targetElementClass}`);
    if (!targetElement) {
        console.error(`Error: Target element .${config.targetElementClass} not found for injecting version note.`);
        return;
    }

    // --- Get Version from Meta Tag ---
    const metaTag = document.querySelector(`meta[name="${config.metaTagName}"]`);
    if (!metaTag) {
        console.warn(`Warning: Meta tag with name="${config.metaTagName}" not found. Cannot inject version note.`);
        return;
    }
    const versionString = metaTag.getAttribute('content');
    if (!versionString) {
        console.warn(`Warning: Meta tag "${config.metaTagName}" found, but has no content attribute. Cannot inject version note.`);
        return;
    }
    console.log(`Injecting version: ${versionString}`);

    // --- Extract Base Title ---
    let baseTitle = '';
    for (let i = 0; i < targetElement.childNodes.length; i++) {
        if (targetElement.childNodes[i].nodeType === Node.TEXT_NODE) {
            baseTitle = targetElement.childNodes[i].textContent.trim();
            break;
        }
    }
    if (!baseTitle) {
        baseTitle = targetElement.textContent.split(config.prefix.trim())[0].trim() || 'App';
        console.warn(`.${config.targetElementClass} base text determined via fallback. Current text: "${targetElement.textContent}"`);
    }

    // --- Create Version Note Element ---
    const versionSpan = document.createElement('span');
    versionSpan.className = 'HEAD__version-note';
    versionSpan.textContent = `${config.prefix}${versionString}${config.suffix}`;

    // --- Apply Custom Styling ---
    for (const property in config.style) {
        if (config.style.hasOwnProperty(property)) {
            versionSpan.style[property] = config.style[property];
        }
    }

    // --- Update DOM Structure ---
    targetElement.innerHTML = ''; // Clear existing content
    targetElement.appendChild(document.createTextNode(baseTitle)); // Add base title text node
    targetElement.appendChild(versionSpan); // Append the new version span
}

// =============================================================================================
// JAVASCRIPT | MODULE EXPORTS
// - Introduced in v1.0.0
// Handles both CommonJS and browser global exports for maximum compatibility.
// =============================================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { injectVersionNote };
} else {
    window.injectVersionNote = injectVersionNote;
} 