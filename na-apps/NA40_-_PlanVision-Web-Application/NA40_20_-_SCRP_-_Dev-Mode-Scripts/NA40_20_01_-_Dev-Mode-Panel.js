/*
================================================================================
JAVASCRIPT |  DEV-MODE PANEL UTILITY
- Based on reference implementation v2.0.0
DESCRIPTION
- Controls visibility of Dev Mode tools based on configuration
================================================================================
*/

// FUNCTION | Initialize Dev-Mode functionality
// --------------------------------------------------------- //
async function initDevMode() {
    try {
        const configPath = "NA40_02_-_DATA_-_App-Files-And-App-Config/NA40_01_01_-_DATA_-_PlanVision-App-Config.json";
        const response = await fetch(configPath);
        
        if (!response.ok) {
            hideDevTools();
            return;
        }
        
        const config = await response.json();
        const isDevMode = config?.Core_App_Config?.["app-dev-mode"] === true;
        
        if (!isDevMode) {
            hideDevTools();
        }
    } catch (error) {
        hideDevTools();
    }
}

// FUNCTION | Hide all Dev Mode tools
// --------------------------------------------------------- //
function hideDevTools() {
    const devModeHeader = document.getElementById('TOOL__Debug-Header');
    if (devModeHeader) {
        devModeHeader.style.display = 'none';
        // Hide all dev tool buttons until next header
        let nextElement = devModeHeader.nextElementSibling;
        while (nextElement && !nextElement.classList.contains('MENU__Drawing-Header-Text')) {
            if (nextElement.classList.contains('BTTN__Tool')) {
                nextElement.style.display = 'none';
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
}

// FUNCTION | Show all Dev Mode tools
// --------------------------------------------------------- //
function showDevTools() {
    const devModeHeader = document.getElementById('TOOL__Debug-Header');
    if (devModeHeader) {
        devModeHeader.style.display = '';
        // Show all dev tool buttons until next header
        let nextElement = devModeHeader.nextElementSibling;
        while (nextElement && !nextElement.classList.contains('MENU__Drawing-Header-Text')) {
            if (nextElement.classList.contains('BTTN__Tool')) {
                nextElement.style.display = '';
            }
            nextElement = nextElement.nextElementSibling;
        }
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initDevMode);

window.DEBUG_HELPERS = {
    debugForceLoadDrawing,
    debugCheckModuleStatus,
    testJsonFetch
};

// Initialise on DOM load
document.addEventListener('DOMContentLoaded', function() {
    console.log("[Dev-Mode] Debug script DOM content loaded event fired");
    initDevMode();
});

console.log("Consolidated Debug Panel Script Loaded.");
