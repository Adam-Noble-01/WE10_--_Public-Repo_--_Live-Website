/*
================================================================================
JAVASCRIPT |  CORE UI & NAVIGATION
- Based on the reference implementation v1.8.8
DESCRIPTION
- Manages UI interactions and controls
- Handles loading states, error messages, and toolbar interactions
================================================================================
*/

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  UI STATE
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
-------------------------------------------------------------------------------
*/

// Module-level variables
let isToolbarOpen = false;
let hasShownTutorial = false;

// Create namespace for this module
window.uiNavigation = {};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Module initialization and setup
-------------------------------------------------------------------------------
*/

/**
 * Initialize the UI controller
 */
window.uiNavigation.init = function() {
    console.log("UI_NAVIGATION: Initializing");
    
    // Attach event listeners to UI elements
    window.uiNavigation.attachEventListeners();
    
    // Show initial tutorial if needed
    window.uiNavigation.handleInitialTutorialFlow();
};

/**
 * Attach event listeners to UI elements
 */
window.uiNavigation.attachEventListeners = function() {
    // Toggle toolbar button
    const toggleButton = document.getElementById("NAVB__Toggle-Button");
    if (toggleButton) {
        toggleButton.addEventListener("click", window.uiNavigation.toggleToolbar);
    }
    
    // Reset view button
    const resetViewButton = document.getElementById("BTTN__Reset-View");
    if (resetViewButton) {
        resetViewButton.addEventListener("click", () => {
            if (window.canvasRenderer) {
                window.canvasRenderer.resetView();
            }
        });
    }
    
    // Fullscreen toggle button
    const fullscreenButton = document.getElementById("BTTN__Fullscreen-Toggle");
    if (fullscreenButton) {
        fullscreenButton.addEventListener("click", window.uiNavigation.toggleFullscreen);
    }
    
    // Handle tutorial overlay clicks
    const tutorialOverlay = document.getElementById("MENU__Tutorial-Overlay");
    if (tutorialOverlay) {
        tutorialOverlay.addEventListener("click", () => {
            tutorialOverlay.style.display = "none";
            window.uiNavigation.toggleToolbar();
        });
    }
    
    // Clear measurements button
    const clearMeasurementsButton = document.getElementById("BTTN__Clear-Measurements");
    if (clearMeasurementsButton && window.measurementTools) {
        clearMeasurementsButton.addEventListener("click", window.measurementTools.clearMeasurements);
    }
    
    // Measurement tool buttons
    const linearMeasureButton = document.getElementById("BTTN__Linear-Measure");
    if (linearMeasureButton && window.measurementTools) {
        linearMeasureButton.addEventListener("click", () => window.measurementTools.setTool("linear"));
    }
    
    const rectMeasureButton = document.getElementById("BTTN__Rect-Measure");
    if (rectMeasureButton && window.measurementTools) {
        rectMeasureButton.addEventListener("click", () => window.measurementTools.setTool("rectangle"));
    }
    
    const areaMeasureButton = document.getElementById("BTTN__Area-Measure");
    if (areaMeasureButton && window.measurementTools) {
        areaMeasureButton.addEventListener("click", () => window.measurementTools.setTool("area"));
    }
    
    const cancelToolButton = document.getElementById("BTTN__Cancel-Tool");
    if (cancelToolButton && window.measurementTools) {
        cancelToolButton.addEventListener("click", window.measurementTools.cancelTool);
    }
    
    // Debug buttons
    const checkStatusButton = document.getElementById("BTTN__Debug-Check-Status");
    if (checkStatusButton && window.applicationScheduler) {
        checkStatusButton.addEventListener("click", window.applicationScheduler.logModulesStatus);
    } else if (checkStatusButton && window.appController) {
        // Backward compatibility
        checkStatusButton.addEventListener("click", window.appController.logModulesStatus);
    }
    
    const legacyLoadButton = document.getElementById("BTTN__Debug-Legacy-Load");
    if (legacyLoadButton && window.directCanvasTest) {
        legacyLoadButton.addEventListener("click", window.directCanvasTest.fetchJSONDrawings);
    }
    
    console.log("UI_NAVIGATION: Event listeners attached");
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  DRAWING SELECTION
- Introduced in v2.0.0
DESCRIPTION
- Drawing selection UI creation and handling
-------------------------------------------------------------------------------
*/

/**
 * Create drawing buttons in the toolbar
 * @param {Object} drawings - Drawing data from the JSON configuration
 */
window.uiNavigation.createDrawingButtons = function(drawings) {
    console.log("UI_NAVIGATION: Creating drawing buttons");
    
    // Create header element for drawing section
    const header = document.createElement("div");
    header.className = "MENU__Drawing-Header-Text";
    header.textContent = "Select Drawing";
    
    // Create a separate container for the drawing buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "drawing-button-container";
    
    // Get the toolbar element
    const toolbar = document.getElementById("TOOL__Container");
    
    // Insert at the beginning of the toolbar
    if (toolbar.firstChild) {
        toolbar.insertBefore(buttonContainer, toolbar.firstChild);
        toolbar.insertBefore(header, buttonContainer);
    } else {
        toolbar.appendChild(header);
        toolbar.appendChild(buttonContainer);
    }
    
    // Add a spacer after the drawing buttons
    const spacer = document.createElement("div");
    spacer.style.marginBottom = "20px";
    buttonContainer.after(spacer);
    
    // Count the number of buttons created
    let buttonCount = 0;
    
    // Iterate over drawing entries and create buttons
    for (const key in drawings) {
        if (key.startsWith("drawing-") && 
            drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}") {
            
            const button = document.createElement("button");
            button.className = "BTTN__Tool";
            button.textContent = drawings[key]["document-name"] || `Drawing ${++buttonCount}`;
            button.addEventListener("click", () => window.projectAssets.loadDrawing(drawings[key]));
            buttonContainer.appendChild(button);
            buttonCount++;
        }
    }
    
    console.log(`UI_NAVIGATION: Created ${buttonCount} drawing buttons`);
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  TOOLBAR MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Functions for controlling the toolbar display
-------------------------------------------------------------------------------
*/

/**
 * Toggle the toolbar visibility
 */
window.uiNavigation.toggleToolbar = function() {
    const toolbar = document.getElementById('TOOL__Container');
    if (toolbar) {
        // First, ensure the toolbar is not collapsed by removing any transform
        toolbar.style.transform = '';
        
        // Get computed style to check if it's currently visible
        const computedStyle = window.getComputedStyle(toolbar);
        const isVisible = computedStyle.display !== 'none' && 
                          !toolbar.classList.contains('TOOL__Container--collapsed');
        
        // Toggle visibility
        if (isVisible) {
            toolbar.classList.add('TOOL__Container--collapsed');
            console.log("Toolbar hidden");
        } else {
            toolbar.classList.remove('TOOL__Container--collapsed');
            console.log("Toolbar shown");
        }
    }
};

/**
 * Toggle fullscreen mode
 */
window.uiNavigation.toggleFullscreen = function() {
    const appContainer = document.getElementById("PLAN__Container");
    if (!appContainer) return;
    
    if (!document.fullscreenElement) {
        // Enter fullscreen
        if (appContainer.requestFullscreen) {
            appContainer.requestFullscreen();
        } else if (appContainer.webkitRequestFullscreen) {
            appContainer.webkitRequestFullscreen();
        } else if (appContainer.msRequestFullscreen) {
            appContainer.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // Trigger resize after fullscreen change
    setTimeout(() => {
        if (window.canvasRenderer) {
            window.canvasRenderer.resizeCanvas();
        }
    }, 100);
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  TUTORIAL MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Functions for handling the UI tutorial flow
-------------------------------------------------------------------------------
*/

/**
 * Handle the initial tutorial flow
 */
window.uiNavigation.handleInitialTutorialFlow = function() {
    // Skip if we've already shown the tutorial
    if (hasShownTutorial) return;
    hasShownTutorial = true;
    
    // Check if we're on a mobile or tablet in portrait orientation
    if (window.uiNavigation.isMobileOrTabletPortrait()) {
        // STEP 1: Show menu open immediately
        const toolbar = document.getElementById("TOOL__Container");
        if (toolbar) {
            toolbar.classList.remove("collapsed");
            isToolbarOpen = true;
            
            // STEP 2: After 1 second, retract the menu
            setTimeout(() => {
                toolbar.classList.add("collapsed");
                isToolbarOpen = false;
                
                // STEP 3: Show the tooltip after a small delay
                setTimeout(() => {
                    const menuTutorialOverlay = document.getElementById("MENU__Tutorial-Overlay");
                    if (menuTutorialOverlay) {
                        menuTutorialOverlay.style.display = "block";
                    }
                }, 300);
            }, 1000);
        }
    }
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  LOADING & ERROR MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Functions for managing loading states and error messages
-------------------------------------------------------------------------------
*/

/**
 * Show the loading overlay
 */
window.uiNavigation.showLoading = function() {
    const loadingOverlay = document.getElementById("LOAD__Overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.remove("LOAD__Overlay--hidden");
    }
};

/**
 * Hide the loading overlay
 */
window.uiNavigation.hideLoading = function() {
    const loadingOverlay = document.getElementById("LOAD__Overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.add("LOAD__Overlay--hidden");
    }
};

/**
 * Display an error message to the user
 * @param {string} message - Error message to display
 */
window.uiNavigation.displayError = function(message) {
    const errorMessage = document.getElementById("NOTE__Error");
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = "none";
        }, 5000);
    }
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  DEVICE & ORIENTATION DETECTION
- Introduced in v2.0.0
DESCRIPTION
- Functions for detecting device type and orientation
-------------------------------------------------------------------------------
*/

/**
 * Check if the device is a mobile or tablet in portrait orientation
 * @returns {boolean} True if the device is a mobile or tablet in portrait orientation
 */
window.uiNavigation.isMobileOrTabletPortrait = function() {
    const maxTabletWidth = 1024;
    return (window.innerWidth <= maxTabletWidth) && window.uiNavigation.isPortrait();
};

/**
 * Check if the device is in portrait orientation
 * @returns {boolean} True if the device is in portrait orientation
 */
window.uiNavigation.isPortrait = function() {
    if (window.screen.orientation && window.screen.orientation.type) {
        return window.screen.orientation.type.startsWith("portrait");
    }
    return window.innerHeight > window.innerWidth;
};

/*
-------------------------------------------------------------------------------
JAVASCRIPT |  MODULE INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Code that runs when the script is loaded
-------------------------------------------------------------------------------
*/

// Log that this module has loaded
console.log("UI_NAVIGATION: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("uiNavigation");
}

// Backwards compatibility with direct module approach
window.uiController = window.uiNavigation; 