/* ================================================================================================
   VERSION INJECTOR FOR THERMAL CALC TOOL
   ================================================================================================
   
   FILENAME  |  NA23_01_07-WebApp_-_ThermalCalcTool_-_VersionInjector.js
   DIRECTORY |  na-apps/NA23_01_WebApp_-_ThermalCalcTool/
   
   AUTHOR    |  Noble Architecture
   DATE      |  2025-05-12
   
   DESCRIPTION
   - Automatically updates the version display in the UI based on meta tag
   - Keeps the UI in sync with the actual application version
   - Similar to implementation in other Noble Architecture utilities
   
   ================================================================================================ */

/**
 * Version Injector for ThermalCalcTool
 * - Reads the version from meta tag and updates the header version display
 * - Automatically runs when the page loads
 */
(function() {
    // Function to run when the DOM is fully loaded
    function injectVersion() {
        try {
            // Get version from meta tag
            const versionMeta = document.querySelector('meta[name="application-version"]');
            if (!versionMeta) {
                console.warn('Version Injector: No application-version meta tag found');
                return;
            }
            
            const version = versionMeta.getAttribute('content');
            if (!version) {
                console.warn('Version Injector: Empty version in meta tag');
                return;
            }
            
            // Find version display element
            const versionElement = document.querySelector('.HEAD__version-note');
            if (!versionElement) {
                console.warn('Version Injector: No version display element found with class HEAD__version-note');
                return;
            }
            
            // Update version display
            versionElement.textContent = `v${version}`;
            console.info(`Version Injector: Successfully updated version display to v${version}`);
        } catch (error) {
            console.error('Version Injector Error:', error);
        }
    }
    
    // Run when DOM is loaded or immediately if it's already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectVersion);
    } else {
        injectVersion();
    }
})(); 