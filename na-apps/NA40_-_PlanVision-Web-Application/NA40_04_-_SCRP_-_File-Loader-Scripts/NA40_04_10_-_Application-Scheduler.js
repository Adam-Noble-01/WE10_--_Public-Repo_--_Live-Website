/*
================================================================================
JAVASCRIPT |  APPLICATION SCHEDULER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Main application scheduler that coordinates initialization and loading sequence
- Handles application startup, module loading, and scheduling of components
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
let isDevMode = false;             // Set to true to enable Dev-Mode logging
let modulesInitialized = {           // Tracking which modules have been initialized
    appAssetsLoader: false,
    projectAssetsLoader: false,
    measurementScaling: false,
    measurementTools: false,
    canvasController: false,
    uiNavigation: false
};

// Detailed load attempt tracking for debugging
let moduleLoadAttempts = {};         // Tracks load attempts for each module
let moduleErrors = {};               // Tracks errors during module initialization

/*
------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
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
        
        // First load the assets and configuration
        const result = await initAssetLoading();
        if (!result) {
            throw new Error("Failed to initialize asset loading");
        }
        
        // Store the app config in a global variable for other modules to access
        window.appConfig = result.appConfig;
        
        // Check if Dev-Mode is enabled in the configuration
        if (window.appConfig && window.appConfig.Core_App_Config && window.appConfig.Core_App_Config["app-dev-mode"] === true) {
            isDevMode = true;
            console.log("Dev-Mode enabled in application scheduler");
        }
        
        // Initialize UI components
        initializeUI();
        
        // Load project assets
        await loadProjectAssets();
        
        // Initialize canvas when assets are loaded
        initializeCanvas();
        
        // Hide loading overlay when everything is ready
        hideLoadingOverlay();
        
        console.log("Application initialization complete");
    } catch (error) {
        console.error("Error initializing application:", error);
        showErrorMessage("Failed to initialize application. Please refresh the page.");
    }
}

// FUNCTION | Initialize the application
// --------------------------------------------------------- //
async function initApplication() {
    console.log("Initializing PlanVision application...");
    
    try {
        // First load the configuration to set Dev Mode before anything else
        const result = await initAssetLoading();
        if (!result) {
            throw new Error("Failed to initialize asset loading");
        }
        
        // Store the app config and set Dev Mode
        window.appConfig = result.appConfig;
        isDevMode = window.appConfig?.Core_App_Config?.["app-dev-mode"] === true;
        console.log("Dev Mode status:", isDevMode);
        
        // Continue with rest of initialization
        // Register event listeners for module initialization events
        document.addEventListener('assetsLoaded', onAssetsLoaded);
        document.addEventListener('projectAssetsReady', onProjectAssetsReady);
        document.addEventListener('drawingLoaded', onDrawingLoaded);
        
        // Set up error handling
        window.addEventListener('error', onApplicationError);
        
        // Mark the UI Navigation as initialized when it's loaded
        if (window.uiNavigation) {
            modulesInitialized.uiNavigation = true;
        }
        
        checkAllModulesInitialized();
        
    } catch (error) {
        console.error("Error during initialization:", error);
        showErrorMessage("Failed to initialize application. Please refresh the page.");
    }
}

// FUNCTION | Log module initialization status to Dev-Mode panel
// --------------------------------------------------------- //
function logModuleStatusToDevModePanel() {
    // Check if Dev-Mode panel is available
    if (!window.debugPanel) {
        console.warn("Dev-Mode panel not available for module status logging");
        return;
    }
    
    // Log current module state
    console.info("Module initialization status:", JSON.stringify(modulesInitialized, null, 2));
    
    // Set up periodic status updates
    setInterval(() => {
        // Check each module for its current state
        for (const [moduleName, isInitialized] of Object.entries(modulesInitialized)) {
            const attempts = moduleLoadAttempts[moduleName] || 0;
            const errors = moduleErrors[moduleName] || [];
            
            if (!isInitialized && attempts > 0) {
                console.warn(`Module '${moduleName}' not initialized after ${attempts} attempts.`);
                if (errors.length > 0) {
                    console.error(`Latest error in '${moduleName}':`, errors[errors.length - 1]);
                }
            }
        }
    }, 5000); // Check every 5 seconds
}

// FUNCTION | Track module initialization attempt
// --------------------------------------------------------- //
function trackModuleInitAttempt(moduleName) {
    if (!moduleLoadAttempts[moduleName]) {
        moduleLoadAttempts[moduleName] = 0;
    }
    moduleLoadAttempts[moduleName]++;
    
    if (isDevMode) {
        console.info(`Initialization attempt for module '${moduleName}': #${moduleLoadAttempts[moduleName]}`);
    }
}

// FUNCTION | Record module initialization error
// --------------------------------------------------------- //
function recordModuleError(moduleName, error) {
    if (!moduleErrors[moduleName]) {
        moduleErrors[moduleName] = [];
    }
    moduleErrors[moduleName].push({
        message: error.message,
        stack: error.stack,
        time: new Date()
    });
    
    if (isDevMode) {
        console.error(`Error initializing '${moduleName}':`, error);
    }
}

// FUNCTION | Handler for when app assets are loaded
// --------------------------------------------------------- //
function onAssetsLoaded(event) {
    console.log("App assets loaded");
    modulesInitialized.appAssetsLoader = true;
    
    // Project Assets will be loaded automatically after this event
}

// FUNCTION | Handler for when project assets are ready
// --------------------------------------------------------- //
function onProjectAssetsReady(event) {
    console.log("Project assets ready");
    modulesInitialized.projectAssetsLoader = true;
    
    // Initialize measurement scaling now that project assets are loaded
    try {
        trackModuleInitAttempt('measurementScaling');
        if (window.measurementScaling && typeof window.measurementScaling.init === "function") {
            window.measurementScaling.init();
            modulesInitialized.measurementScaling = true;
        }
    } catch (error) {
        recordModuleError('measurementScaling', error);
    }
    
    checkAllModulesInitialized();
}

// FUNCTION | Handler for when a drawing is loaded
// --------------------------------------------------------- //
function onDrawingLoaded(event) {
    console.log("Drawing loaded");
    
    // Initialize Canvas Controller
    try {
        trackModuleInitAttempt('canvasController');
        if (window.canvasController && typeof window.canvasController.init === "function") {
            window.canvasController.init();
            modulesInitialized.canvasController = true;
        }
    } catch (error) {
        recordModuleError('canvasController', error);
    }
    
    // Initialize Measurement Tools
    try {
        trackModuleInitAttempt('measurementTools');
        if (window.measurementTools && typeof window.measurementTools.init === "function") {
            window.measurementTools.init();
            modulesInitialized.measurementTools = true;
        }
    } catch (error) {
        recordModuleError('measurementTools', error);
    }
    
    checkAllModulesInitialized();
}

// FUNCTION | Check if all modules have been initialized
// --------------------------------------------------------- //
function checkAllModulesInitialized() {
    if (appInitialized) return;
    
    // Check if all required modules are initialized
    const allInitialized = 
        modulesInitialized.appAssetsLoader && 
        modulesInitialized.projectAssetsLoader;
    
    // Optional modules - nice to have but not strictly required
    const optionalModulesInitialized =
        modulesInitialized.measurementScaling && 
        modulesInitialized.canvasController && 
        modulesInitialized.measurementTools && 
        modulesInitialized.uiNavigation;
    
    if (allInitialized) {
        // For development, if the required modules are ready, we can proceed
        // even if optional modules aren't ready yet
        completeApplicationInitialization();
        
        // If not all optional modules are ready, log a warning
        if (!optionalModulesInitialized) {
            console.warn("Application initialized with some modules not ready:", 
                Object.entries(modulesInitialized)
                    .filter(([_, initialized]) => !initialized)
                    .map(([name]) => name)
                    .join(", ")
            );
        }
    } else {
        console.log("Waiting for essential modules to initialize...", modulesInitialized);
    }
}

// FUNCTION | Complete the application initialization
// --------------------------------------------------------- //
function completeApplicationInitialization() {
    if (appInitialized) return;
    
    console.log("All modules initialized, completing application startup");
    
    // Hide loading overlay now that everything is ready
    hideLoadingOverlay();
    
    // Mark app as initialized
    appInitialized = true;
    
    // Dispatch an event that the application is fully initialized
    document.dispatchEvent(new CustomEvent('applicationReady'));
}

/*
------------------------------------------------------------
JAVASCRIPT |  UTILITY FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Helper functions for the application scheduler
------------------------------------------------------------
*/

// FUNCTION | Hide the loading overlay
// --------------------------------------------------------- //
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("LOAD__Overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.add("LOAD__Overlay--hidden");
    }
}

// FUNCTION | Handle application errors
// --------------------------------------------------------- //
function onApplicationError(error) {
    console.error("Application error:", error);
    
    // Determine which module caused the error
    const moduleName = extractModuleFromError(error);
    recordModuleError(moduleName, error);
    
    // Display error message to user
    const errorElement = document.getElementById("NOTE__Error");
    if (errorElement) {
        errorElement.textContent = "An error occurred: " + (error.message || "Unknown error");
        errorElement.style.display = "block";
    }
    
    // Hide loading overlay in case of error
    hideLoadingOverlay();
}

// FUNCTION | Extract module name from error
// --------------------------------------------------------- //
function extractModuleFromError(error) {
    if (!error || !error.stack) return 'Unknown';
    
    const stack = error.stack.split('\n');
    
    // Look for our module pattern in the stack trace
    const modulePattern = /NA_Plan-Vision-App_-_2\.0\.0_-_([A-Za-z-]+)\.js/;
    
    for (const line of stack) {
        const match = line.match(modulePattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return 'Unknown';
}

/*
------------------------------------------------------------
JAVASCRIPT |  PUBLIC API
- Introduced in v2.0.0
DESCRIPTION
- Export functions for use by other modules
------------------------------------------------------------
*/

// Export the module's public API
window.applicationScheduler = {
    // Initialization
    init: initApplication,
    
    // State
    isInitialized: () => appInitialized
};

/*
------------------------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for DOM content loading
------------------------------------------------------------
*/

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application scheduler...');
    initApplication();
});

// Optional: Auto-initialize if the document is already loaded
if (document.readyState === 'complete') {
    console.log('Document already loaded, initializing application scheduler...');
    initApplication();
}

// Debug utility - creates debug panel when in Dev-Mode
if (isDevMode) {
    window.addEventListener('DOMContentLoaded', () => {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.style.position = 'fixed';
        debugPanel.style.bottom = '40px';
        debugPanel.style.right = '10px';
        debugPanel.style.backgroundColor = 'rgba(0,0,0,0.7)';
        debugPanel.style.color = 'white';
        debugPanel.style.padding = '10px';
        debugPanel.style.borderRadius = '5px';
        debugPanel.style.maxWidth = '400px';
        debugPanel.style.maxHeight = '200px';
        debugPanel.style.overflow = 'auto';
        debugPanel.style.fontSize = '12px';
        debugPanel.style.fontFamily = 'monospace';
        debugPanel.style.zIndex = '99999';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '5px';
        closeBtn.style.right = '5px';
        closeBtn.style.background = 'red';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.borderRadius = '3px';
        closeBtn.addEventListener('click', () => {
            debugPanel.style.display = 'none';
        });
        debugPanel.appendChild(closeBtn);
        
        // Add title
        const title = document.createElement('div');
        title.textContent = 'Debug Panel';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        debugPanel.appendChild(title);
        
        // Add status display
        const status = document.createElement('div');
        status.id = 'debug-status';
        debugPanel.appendChild(status);
        
        // Add to body
        document.body.appendChild(debugPanel);
        
        // Override console.log to capture logs
        const oldLog = console.log;
        console.log = function() {
            oldLog.apply(console, arguments);
            
            // Add to debug panel
            const status = document.getElementById('debug-status');
            if (status) {
                const message = Array.from(arguments).join(' ');
                const logEntry = document.createElement('div');
                logEntry.textContent = '> ' + message;
                status.appendChild(logEntry);
                
                // Scroll to bottom
                status.scrollTop = status.scrollHeight;
                
                // Keep only last 20 messages
                while (status.children.length > 20) {
                    status.removeChild(status.children[0]);
                }
            }
        };
    });
}

// FUNCTION | Load and display a drawing
// --------------------------------------------------------- //
function loadDrawing(drawing) {
    console.log(`Loading drawing: ${JSON.stringify(drawing)}`);
    
    // Extract URLs from drawing object
    const urls = urlParser.extractUrls(drawing);
    console.log(`URLs extracted by URL Parser:`);
}

// Create namespace for this module
window.applicationScheduler = {};

// METHOD | Initialize the application scheduler
// --------------------------------------------------------- //
window.applicationScheduler.init = async function() {
    console.log("APPLICATION_SCHEDULER: Initializing application");
    
    try {
        // Wait for DOM to fully load
        if (document.readyState === "loading") {
            await new Promise(resolve => {
                document.addEventListener("DOMContentLoaded", resolve);
            });
        }
        
        console.log("APPLICATION_SCHEDULER: DOM loaded");
        
        // Initialize modules in the correct order
        if (window.uiNavigation) {
            window.uiNavigation.init();
            console.log("APPLICATION_SCHEDULER: UI Navigation initialized");
        }
        
        if (window.canvasRenderer) {
            window.canvasRenderer.init();
            console.log("APPLICATION_SCHEDULER: Canvas Renderer initialized");
        }
        
        if (window.measurementTools) {
            window.measurementTools.init();
            console.log("APPLICATION_SCHEDULER: Measurement Tools initialized");
        }
        
        // Fetch drawings data
        if (window.configLoader) {
            const drawings = await window.configLoader.fetchDrawings();
            console.log("APPLICATION_SCHEDULER: Drawings data fetched");
            
            if (drawings) {
                // Create drawing buttons
                if (window.uiNavigation) {
                    window.uiNavigation.createDrawingButtons(drawings);
                    console.log("APPLICATION_SCHEDULER: Drawing buttons created");
                }
                
                // Load the first drawing automatically
                const firstDrawingKey = Object.keys(drawings).find(
                    key => key.startsWith("drawing-") && 
                    drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
                );
                
                if (firstDrawingKey && window.projectAssets) {
                    console.log("APPLICATION_SCHEDULER: Loading first drawing");
                    await window.projectAssets.loadDrawing(drawings[firstDrawingKey]);
                }
            }
        }
        
        console.log("APPLICATION_SCHEDULER: Initialization complete");
        
    } catch (error) {
        console.error("APPLICATION_SCHEDULER: Error initializing application:", error);
        if (window.uiNavigation) {
            window.uiNavigation.displayError("Error initializing application: " + error.message);
        }
    }
};

// METHOD | Get the version of the application
// --------------------------------------------------------- //
window.applicationScheduler.getVersion = function() {
    return "3.0.0";
};

// METHOD | Log modules status to the console
// --------------------------------------------------------- //
window.applicationScheduler.logModulesStatus = function() {
    console.log("-------- MODULES STATUS --------");
    console.log("Application Scheduler: " + (typeof window.applicationScheduler !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("Config Loader: " + (typeof window.configLoader !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("Project Assets: " + (typeof window.projectAssets !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("Canvas Renderer: " + (typeof window.canvasRenderer !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("UI Navigation: " + (typeof window.uiNavigation !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("Measurement Tools: " + (typeof window.measurementTools !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("Measurement Scaling: " + (typeof window.measurementScaling !== 'undefined' ? "Loaded" : "Not Loaded"));
    console.log("--------------------------------");
};

// Set up the check status button
document.addEventListener('DOMContentLoaded', function() {
    const checkStatusBtn = document.getElementById("BTTN__Debug-Check-Status");
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener("click", window.applicationScheduler.logModulesStatus);
    }
});

// Initialize the application when the script is loaded
window.applicationScheduler.init();

// Log that this module has loaded
console.log("APPLICATION_SCHEDULER: Module loaded");

// Register this module with the module integration system
if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
    window.moduleIntegration.registerModuleReady("applicationScheduler");
}

// Backwards compatibility with direct module approach
window.appController = window.applicationScheduler;