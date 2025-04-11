/*
================================================================================
JAVASCRIPT |  UI NAVIGATION
- Introduced in v2.0.0
DESCRIPTION
- Handles UI navigation, toolbar toggling, and menu interactions
- Manages responsive behavior and tutorial overlays
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  UI STATE
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
--------------------------------------------
*/

// UI State variables
let isToolbarOpen = true;            // Whether the toolbar is currently open
let menuTutorialShown = false;       // Whether the menu tutorial has been shown

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners and initializes UI controls
--------------------------------------------
*/

/**
 * Initialize UI navigation
 */
function initUINavigation() {
    // Get DOM references
    const toggleToolbarBtn = document.getElementById("NAVB__Toggle-Button");
    const toolbar = document.getElementById("TOOL__Container");
    const menuTutorialOverlay = document.getElementById("MENU__Tutorial-Overlay");
    
    // Set up event listeners
    if (toggleToolbarBtn) {
        toggleToolbarBtn.addEventListener("click", toggleToolbar);
    }
    
    // Add class to toolbar if it should start collapsed on mobile
    if (isMobileOrTabletPortrait()) {
        toolbar.classList.add("TOOL__Container--collapsed");
        isToolbarOpen = false;
    }
    
    // Set up initial tutorial flow
    if (isMobileOrTabletPortrait() && !menuTutorialShown) {
        handleInitialTutorialFlow();
    }
    
    console.log("UI Navigation initialized");
}

/*
--------------------------------------------
JAVASCRIPT |  TOOLBAR FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for toggling and controlling the toolbar
--------------------------------------------
*/

/**
 * Toggle the toolbar's visibility
 */
function toggleToolbar() {
    const toolbar = document.getElementById("TOOL__Container");
    if (!toolbar) return;
    
    if (isToolbarOpen) {
        // Close the toolbar
        toolbar.classList.add("TOOL__Container--collapsed");
    } else {
        // Open the toolbar
        toolbar.classList.remove("TOOL__Container--collapsed");
    }
    
    // Toggle the state
    isToolbarOpen = !isToolbarOpen;
}

/*
--------------------------------------------
JAVASCRIPT |  TUTORIAL FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Functions for displaying tutorial overlays and guidance
--------------------------------------------
*/

/**
 * Handle the initial tutorial flow for new users
 */
function handleInitialTutorialFlow() {
    const toolbar = document.getElementById("TOOL__Container");
    const menuTutorialOverlay = document.getElementById("MENU__Tutorial-Overlay");
    
    if (isMobileOrTabletPortrait()) {
        // STEP 1: Show menu open immediately
        toolbar.classList.remove("TOOL__Container--collapsed");
        isToolbarOpen = true;
        
        // STEP 2: After 1 second, retract the menu
        setTimeout(() => {
            toolbar.classList.add("TOOL__Container--collapsed");
            isToolbarOpen = false;
            
            // STEP 3: Show the tooltip after a small delay
            setTimeout(() => {
                if (menuTutorialOverlay) {
                    menuTutorialOverlay.style.display = "block";
                    menuTutorialShown = true;
                }
            }, 300);
        }, 1000);
    }
}

/*
--------------------------------------------
JAVASCRIPT |  DEVICE DETECTION
- Introduced in v2.0.0
DESCRIPTION
- Functions for detecting device types and orientations
--------------------------------------------
*/

/**
 * Check if the user is on a mobile or tablet device in portrait orientation
 * @returns {boolean} - True if mobile/tablet in portrait mode
 */
function isMobileOrTabletPortrait() {
    const maxTabletWidth = 1024;
    return (window.innerWidth <= maxTabletWidth) && isPortrait();
}

/**
 * Check if the device is in portrait orientation
 * @returns {boolean} - True if in portrait orientation
 */
function isPortrait() {
    if (window.screen.orientation && window.screen.orientation.type) {
        return window.screen.orientation.type.startsWith("portrait");
    }
    return window.innerHeight > window.innerWidth;
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
window.uiNavigation = {
    // Initialization
    init: initUINavigation,
    
    // Toolbar functions
    toggleToolbar: toggleToolbar,
    
    // State
    isToolbarOpen: () => isToolbarOpen
};

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for DOM content loading
--------------------------------------------
*/

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing UI navigation...');
    initUINavigation();
});

// Optional: Auto-initialize if the document is already loaded
if (document.readyState === 'complete') {
    console.log('Document already loaded, initializing UI navigation...');
    initUINavigation();
} 