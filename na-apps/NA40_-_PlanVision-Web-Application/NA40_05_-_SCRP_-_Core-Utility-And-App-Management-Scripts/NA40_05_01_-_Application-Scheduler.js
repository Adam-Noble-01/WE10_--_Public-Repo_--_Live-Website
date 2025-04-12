/*
================================================================================
JAVASCRIPT |  APPLICATION SCHEDULER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Main application scheduler that coordinates initialization and loading sequence
- Handles application startup, module loading, and scheduling of components
- As of version 2.0.1, also handles dynamic loading of all required scripts
================================================================================
*/

/*
------------------------------------------------------------
JAVASCRIPT |  APPLICATION STATE
- Introduced in v2.0.0
DESCRIPTION
- Module-level state variables
------------------------------------------------------------
*/

// Application state
let appInitialized = false;         // Whether the application has been fully initialized
let isDevMode = false;              // Set to true to enable Dev-Mode logging
let modulesInitialized = {           // Tracking which modules have been initialized
    masterAssetLoader: false,       // Using the new masterAssetLoader naming
    measurementScaling: false,
    measurementTools: false,
    canvasController: false,
    uiNavigation: false
};

// Detailed load attempt tracking for debugging
let moduleLoadAttempts = {};         // Tracks load attempts for each module
let moduleErrors = {};               // Tracks errors during module initialization

// Script loading state
let scriptsLoaded = {};              // Tracks which scripts have been loaded
let scriptLoadErrors = {};           // Tracks errors during script loading

/*
------------------------------------------------------------
JAVASCRIPT |  SCRIPT LOADING CONFIGURATION
- Introduced in v2.0.1
DESCRIPTION
- Configuration for dynamic script loading
------------------------------------------------------------
*/

// Define all scripts that need to be loaded in the correct sequence
const scriptsToLoad = [
    // Module Integration is loaded first 
    {
        name: 'moduleIntegration',
        path: './NA40_05_-_SCRP_-_Core-Utility-And-App-Management-Scripts/NA40_05_02_-_Module-Integration.js',
        critical: true
    }, 
    // Measurement scaling (needed before canvas rendering)
    {
        name: 'measurementScaling',
        path: './NA40_07_-_SCRP_-_Measurement-And-Math-Scripts/NA40_07_01_-_Measurement-Scaling.js',
        critical: true
    },
    // Canvas renderer
    {
        name: 'canvasRenderer',
        path: './NA40_06_-_SCRP_-_Canvas-And-Main-Rendering-Scripts/NA40_06_04_-_Canvas-Renderer.js',
        critical: true
    },
    // Measurement tools
    {
        name: 'measurementTools',
        path: './NA40_07_-_SCRP_-_Measurement-And-Math-Scripts/NA40_07_02_-_Measurement-Tools.js',
        critical: true
    },
    // Core UI and navigation
    {
        name: 'coreUINavigation',
        path: './NA40_08_-_SCRP_-_User-Interface-And-Navigation/NA40_08_01_-_Core-App-UI-And-Navigation.js',
        critical: true
    },
    // Measurement tool button handlers
    {
        name: 'measurementToolButtonHandlers',
        path: './NA40_08_-_SCRP_-_User-Interface-And-Navigation/NA40_08_02_-_Measurement-Tool-Button-Handlers.js',
        critical: true
    },
    // Font style generator
    {
        name: 'fontStyleGenerator',
        path: './NA40_08_-_SCRP_-_User-Interface-And-Navigation/NA40_08_10_-_Font-Style-Generator.js',
        critical: false
    },
    // Backward compatibility scripts
    {
        name: 'backwardCompatibility',
        path: './NA40_10_-_SCRP_-_Backward-Compatibility-Scripts/NA40_10_01_-_Backward-Compatibility.js',
        critical: false
    },
    // Dev mode scripts (only loaded in dev mode)
    {
        name: 'devMode',
        path: './NA40_20_-_SCRP_-_Dev-Mode-Scripts/NA40_20_01_-_Dev-Mode.js',
        critical: false,
        condition: () => isDevMode
    }
];

/*
------------------------------------------------------------
JAVASCRIPT |  SCRIPT LOADING FUNCTIONS
- Introduced in v2.0.1
DESCRIPTION
- Functions for dynamically loading scripts
------------------------------------------------------------
*/

// FUNCTION | Load a single script
// --------------------------------------------------------- //
function loadScript(scriptConfig) {
    return new Promise((resolve, reject) => {
        console.log(`Loading script: ${scriptConfig.name} (${scriptConfig.path})`);
        
        // Create script element
        const script = document.createElement('script');
        script.src = scriptConfig.path;
        script.async = false; // Keep scripts in order
        
        // Handle success
        script.onload = () => {
            console.log(`Successfully loaded script: ${scriptConfig.name}`);
            scriptsLoaded[scriptConfig.name] = true;
            resolve(scriptConfig);
        };
        
        // Handle error
        script.onerror = (error) => {
            console.error(`Error loading script: ${scriptConfig.name}`, error);
            scriptLoadErrors[scriptConfig.name] = {
                error: error,
                time: new Date()
            };
            
            // If it's a critical script, reject the promise
            if (scriptConfig.critical) {
                reject(new Error(`Failed to load critical script: ${scriptConfig.name}`));
            } else {
                // For non-critical scripts, we resolve anyway but log the issue
                console.warn(`Non-critical script failed to load: ${scriptConfig.name} - continuing`);
                resolve(scriptConfig);
            }
        };
        
        // Add to document
        document.head.appendChild(script);
    });
}

// FUNCTION | Load all scripts in sequence
// --------------------------------------------------------- //
async function loadAllScripts() {
    console.log("Starting dynamic script loading sequence...");
    
    try {
        for (const scriptConfig of scriptsToLoad) {
            await loadScript(scriptConfig);
            
            // Special case for Module-Integration - wait for it to initialize
            if (scriptConfig.name === 'moduleIntegration' && window.moduleIntegration) {
                console.log("Module Integration loaded, registering with it");
                // Register the scheduler with the Module Integration
                if (typeof window.moduleIntegration.registerModuleReady === 'function') {
                    window.moduleIntegration.registerModuleReady('applicationScheduler');
                }
            }
        }
        
        console.log("All scripts loaded successfully");
        return true;
    } catch (error) {
        console.error("Error in script loading sequence:", error);
        showErrorMessage("Failed to load required scripts. Please refresh the page.");
        return false;
    }
}

/*
------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
- Updated in v2.0.1 for dynamic script loading
DESCRIPTION
- Coordinates initialization of all application modules
------------------------------------------------------------
*/

// FUNCTION | Main initialization function
// --------------------------------------------------------- //
async function initializeApplication() {
    try {
        console.log("Initializing application...");
        
        showLoadingOverlay();
        
        // First ensure that project assets loader is available
        if (!window.projectAssets) {
            throw new Error("Project Assets Loader is not available");
        }
        
        // Check if Dev-Mode should be enabled
        setDevModeFromConfig();
        
        // Dynamically load all other scripts
        const scriptsLoaded = await loadAllScripts();
        if (!scriptsLoaded) {
            throw new Error("Failed to load required scripts");
        }
        
        // Initialize UI components
        initializeUI();
        
        // Initialize the project assets loader
        if (typeof window.projectAssets.init === "function") {
            window.projectAssets.init();
            modulesInitialized.projectAssets = true;
        }
        
        // Initialize canvas when assets are loaded
        initializeCanvas();
        
        // Hide loading overlay when everything is ready
        hideLoadingOverlay();
        
        console.log("Application initialization complete");
    } catch (error) {
        console.error("Application initialization failed:", error);
        showErrorMessage("Failed to initialize application. Please refresh the page.");
        hideLoadingOverlay();
    }
}

// FUNCTION | Set development mode from config if available
// --------------------------------------------------------- //
function setDevModeFromConfig() {
    // Check URL parameters first for dev mode flag
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dev-mode')) {
        isDevMode = true;
        console.log("Dev-Mode enabled via URL parameter");
        return;
    }
    
    // Otherwise check local storage for persistent dev mode setting
    if (localStorage.getItem('planVisionDevMode') === 'true') {
        isDevMode = true;
        console.log("Dev-Mode enabled via local storage setting");
    }
}

// FUNCTION | Start the application initialization process
// --------------------------------------------------------- //
async function initApplication() {
    try {
        console.log("Application startup initiated");
        
        // Register for asset loading events from projectAssets
        document.addEventListener('imageLoaded', onImageLoaded);
        document.addEventListener('drawingLoaded', onDrawingLoaded);
        
        // Begin application initialization
        await initializeApplication();
        
        // Mark initialization as complete
        appInitialized = true;
        console.log("Application initialization complete");
        
        // Register this module as ready
        if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
            window.moduleIntegration.registerModuleReady("applicationScheduler");
        }
    } catch (error) {
        console.error("Error during application initialization:", error);
        showErrorMessage("Failed to initialize the application.");
    }
}

// FUNCTION | Log module status to Dev Mode Panel if available
// --------------------------------------------------------- //
function logModuleStatusToDevModePanel() {
    if (!isDevMode) return;
    
    // Only proceed if we have the Dev Mode Panel available
    if (window.devModePanel && typeof window.devModePanel.logModuleStatus === 'function') {
        // Create a status report
        const statusReport = {
            appInitialized: appInitialized,
            modulesInitialized: { ...modulesInitialized },
            scriptsLoaded: { ...scriptsLoaded },
            errors: {
                moduleErrors: { ...moduleErrors },
                scriptLoadErrors: { ...scriptLoadErrors }
            }
        };
        
        // Log the status report
        window.devModePanel.logModuleStatus("Application Scheduler", statusReport);
        console.log("Module status logged to Dev Mode Panel:", statusReport);
    }
}

// FUNCTION | Track module initialization attempts
// --------------------------------------------------------- //
function trackModuleInitAttempt(moduleName) {
    if (!moduleLoadAttempts[moduleName]) {
        moduleLoadAttempts[moduleName] = [];
    }
    
    moduleLoadAttempts[moduleName].push({
        time: new Date(),
        success: false
    });
}

// FUNCTION | Record module initialization errors
// --------------------------------------------------------- //
function recordModuleError(moduleName, error) {
    if (!moduleErrors[moduleName]) {
        moduleErrors[moduleName] = [];
    }
    
    moduleErrors[moduleName].push({
        time: new Date(),
        error: error.message || String(error),
        stack: error.stack || 'No stack trace available'
    });
    
    console.error(`Error initializing module ${moduleName}:`, error);
}

/*
------------------------------------------------------------
JAVASCRIPT |  EVENT HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Event handlers for various application events
------------------------------------------------------------
*/

// EVENT HANDLER | When an image is loaded
// --------------------------------------------------------- //
function onImageLoaded(event) {
    console.log("Image loaded event received");
    
    // Initialize canvas now that we have an image
    initializeCanvas();
}

// EVENT HANDLER | When a project's assets are ready
// --------------------------------------------------------- //
function onProjectAssetsReady(event) {
    console.log("APP_SCHEDULER: Project assets loaded");
    
    // Mark the masterAssetLoader as initialized
    modulesInitialized.masterAssetLoader = true;
    
    // Check if all modules are initialized
    checkAllModulesInitialized();
}

// EVENT HANDLER | When a drawing is loaded
// --------------------------------------------------------- //
function onDrawingLoaded(event) {
    console.log("Drawing loaded event received", event.detail);
    
    // Extract drawing details
    const drawingDetails = event.detail || {};
    
    // Update the page title if we have a drawing name
    if (drawingDetails.name) {
        document.title = "PlanVision | " + drawingDetails.name;
    }
    
    // Initialize measurement scaling if available
    if (window.measurementScaling && typeof window.measurementScaling.setDrawingScale === 'function') {
        if (drawingDetails.scale) {
            window.measurementScaling.setDrawingScale(drawingDetails.scale);
        }
    }
    
    // Configure the canvas with the new drawing
    if (window.canvasRenderer) {
        // Reset the view to fit the new drawing
        if (typeof window.canvasRenderer.resetView === 'function') {
            window.canvasRenderer.resetView();
        }
        
        // Update measurements if any were created
        if (typeof window.canvasRenderer.updateMeasurements === 'function') {
            window.canvasRenderer.updateMeasurements();
        }
    }
    
    // Hide loading overlay
    hideLoadingOverlay();
    
    // Log the status to the Dev Mode Panel
    logModuleStatusToDevModePanel();
}

// FUNCTION | Check if all required modules are initialized
// --------------------------------------------------------- //
function checkAllModulesInitialized() {
    const requiredModules = [
        'projectAssets',
        'measurementScaling',
        'canvasController',
        'uiNavigation'
    ];
    
    // Check if all required modules are initialized
    const allInitialized = requiredModules.every(module => 
        modulesInitialized[module] === true
    );
    
    if (allInitialized) {
        console.log("All required modules initialized successfully");
        
        // Complete the application initialization
        completeApplicationInitialization();
    } else {
        // Log which modules are not initialized yet
        const pendingModules = requiredModules.filter(module => 
            !modulesInitialized[module]
        );
        
        console.log("Waiting for modules to initialize:", pendingModules);
    }
    
    // Log module status to Dev Mode Panel
    logModuleStatusToDevModePanel();
    
    return allInitialized;
}

// FUNCTION | Complete application initialization
// --------------------------------------------------------- //
function completeApplicationInitialization() {
    // Only proceed if not already initialized
    if (appInitialized) {
        console.log("Application already initialized, skipping");
        return;
    }
    
    console.log("Completing application initialization");
    
    // Mark the application as initialized
    appInitialized = true;
    
    // Hide the loading overlay
    hideLoadingOverlay();
    
    // Update canvas if needed
    if (window.canvasRenderer && typeof window.canvasRenderer.resetView === 'function') {
        window.canvasRenderer.resetView();
    }
    
    // Show any tool instructions if needed
    if (window.uiNavigation && typeof window.uiNavigation.showToolInstructions === 'function') {
        window.uiNavigation.showToolInstructions("Click a tool in the menu to get started.");
    }
    
    // Dispatch an event that the application is ready
    document.dispatchEvent(new CustomEvent('applicationReady', { 
        detail: { version: "2.0.1" }
    }));
    
    console.log("Application initialization completed successfully");
}

/*
------------------------------------------------------------
JAVASCRIPT |  UI HELPERS
- Introduced in v2.0.0
DESCRIPTION
- Helper functions for manipulating the UI
------------------------------------------------------------
*/

// FUNCTION | Show loading overlay
// --------------------------------------------------------- //
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('LOAD__Overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

// FUNCTION | Hide loading overlay
// --------------------------------------------------------- //
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('LOAD__Overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// FUNCTION | Show error message
// --------------------------------------------------------- //
function showErrorMessage(message) {
    const errorElement = document.getElementById('NOTE__Error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 8000);
    }
}

// FUNCTION | Handle application errors
// --------------------------------------------------------- //
function onApplicationError(error) {
    console.error("Application error:", error);
    
    // Try to extract the module that caused the error
    const moduleName = extractModuleFromError(error);
    
    // Record the error in the appropriate module
    if (moduleName) {
        recordModuleError(moduleName, error);
    } else {
        // If we couldn't determine the module, record it as a general error
        if (!moduleErrors['general']) {
            moduleErrors['general'] = [];
        }
        
        moduleErrors['general'].push({
            time: new Date(),
            error: error.message || String(error),
            stack: error.stack || 'No stack trace available'
        });
    }
    
    // Show an error message to the user
    showErrorMessage("An error occurred. Please try refreshing the page.");
}

// FUNCTION | Extract module name from error
// --------------------------------------------------------- //
function extractModuleFromError(error) {
    // If the error has a custom property with the module name, use that
    if (error.moduleName) {
        return error.moduleName;
    }
    
    // Otherwise try to extract it from the error message or stack trace
    const errorString = error.message || String(error);
    const errorStack = error.stack || '';
    
    // Define patterns to match module names in error strings
    const modulePatterns = [
        { pattern: /projectAssets|Project-Assets-Loader/i, name: 'projectAssets' },
        { pattern: /measurementScaling|Measurement-Scaling/i, name: 'measurementScaling' },
        { pattern: /canvasRenderer|Canvas-Renderer/i, name: 'canvasController' },
        { pattern: /measurementTools|Measurement-Tools/i, name: 'measurementTools' },
        { pattern: /uiNavigation|UI-And-Navigation/i, name: 'uiNavigation' },
        { pattern: /moduleIntegration|Module-Integration/i, name: 'moduleIntegration' },
        { pattern: /fontStyleGenerator|Font-Style-Generator/i, name: 'fontStyleGenerator' },
        { pattern: /backwardCompatibility|Backward-Compatibility/i, name: 'backwardCompatibility' },
        { pattern: /devMode|Dev-Mode/i, name: 'devMode' }
    ];
    
    // Try to match the module name in the error message
    for (const { pattern, name } of modulePatterns) {
        if (pattern.test(errorString) || pattern.test(errorStack)) {
            return name;
        }
    }
    
    // Return null if we couldn't determine the module
    return null;
}

/*
------------------------------------------------------------
JAVASCRIPT |  UI AND MODULE INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Functions for initializing UI components and modules
------------------------------------------------------------
*/

// FUNCTION | Initialize UI components
// --------------------------------------------------------- //
function initializeUI() {
    console.log("Initializing UI components");
    
    // Set up event listeners for UI elements
    // Only if we have the UI Navigation module available
    if (window.uiNavigation && typeof window.uiNavigation.init === 'function') {
        window.uiNavigation.init();
        modulesInitialized.uiNavigation = true;
    } else {
        console.warn("UI Navigation module not available, deferring initialization");
    }
}

// FUNCTION | Load project assets
// --------------------------------------------------------- //
async function loadProjectAssets() {
    console.log("APP_SCHEDULER: Loading project assets");
    
    try {
        // The masterAssetLoader is already loaded in the HTML, so we just need to wait for it to initialize
        if (window.masterAssetLoader && typeof window.masterAssetLoader.init === 'function') {
            // Wait for the assets to be loaded
            document.addEventListener('assetsLoaded', onProjectAssetsReady);
            
            // Initialize the master asset loader
            await window.masterAssetLoader.init();
        } else {
            throw new Error("Master Asset Loader not found");
        }
    } catch (error) {
        console.error("APP_SCHEDULER: Error loading project assets:", error);
        onApplicationError(error);
    }
}

// FUNCTION | Initialize canvas
// --------------------------------------------------------- //
function initializeCanvas() {
    console.log("Initializing canvas");
    
    if (window.canvasRenderer && typeof window.canvasRenderer.init === 'function') {
        try {
            // Check if we have an image loaded first
            if (window.projectAssets && window.projectAssets.isImageLoaded && window.projectAssets.isImageLoaded()) {
                // Initialize the canvas with the loaded image
                window.canvasRenderer.init();
                modulesInitialized.canvasController = true;
                
                // Mark as initialized
                if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
                    window.moduleIntegration.registerModuleReady("canvasController");
                }
            } else {
                console.log("Deferring canvas initialization until image is loaded");
            }
        } catch (error) {
            console.error("Error initializing canvas:", error);
            recordModuleError('canvasController', error);
        }
    } else {
        console.warn("Canvas Renderer module not available");
    }
}

// FUNCTION | Load a specific drawing
// --------------------------------------------------------- //
function loadDrawing(drawing) {
    console.log("Loading drawing:", drawing);
    
    if (window.projectAssets && typeof window.projectAssets.loadDrawing === 'function') {
        try {
            // Show loading overlay
            showLoadingOverlay();
            
            // Load the drawing
            window.projectAssets.loadDrawing(drawing);
            return true;
        } catch (error) {
            console.error("Error loading drawing:", error);
            hideLoadingOverlay();
            showErrorMessage("Failed to load drawing. Please try again.");
            recordModuleError('projectAssets', error);
            return false;
        }
    } else {
        console.warn("Project Assets module not available for loading drawing");
        return false;
    }
}

/*
------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Start the app when DOM is loaded
------------------------------------------------------------
*/

// When the DOM is fully loaded, start the application
document.addEventListener('DOMContentLoaded', initApplication);

// Register error handler
window.addEventListener('error', (event) => {
    onApplicationError(event.error || new Error('Unknown error occurred'));
});

// Expose the API for other modules to use
window.applicationScheduler = {
    loadDrawing,
    reloadApplication: initApplication,
    checkModuleStatus: logModuleStatusToDevModePanel
};

// Log that the scheduler has loaded
console.log("APPLICATION_SCHEDULER: Module loaded");