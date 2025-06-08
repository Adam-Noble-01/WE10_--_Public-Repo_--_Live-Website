// =============================================================================
// VALEDESIGNSUITE - TRUEVISION 3D APPLICATION CORE MANAGER
// =============================================================================
//
// FILE       : ApplicationCore_TrueVision3DManager.js
// NAMESPACE  : TrueVision3D.ApplicationCore
// MODULE     : Application Initialization and Management System
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Orchestrate TrueVision3D application startup, navigation, and UI management
// CREATED    : 2025
//
// DESCRIPTION:
// - Coordinates application initialization and module loading sequence
// - Manages navigation system integration and mode switching
// - Handles user interface event registration and state management
// - Orchestrates communication between rendering pipeline and solar controls
// - Provides centralized application lifecycle management and cleanup
// - Integrates with configuration system for adaptive feature enabling
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Initial Release
// - Application initialization and coordination system
// - Navigation mode management and UI integration
// - Event handling and state management
// - Module integration and lifecycle management
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.ApplicationCore = window.TrueVision3D.ApplicationCore || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | Application Configuration and Global References
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core Application State
    // ------------------------------------------------------------
    let applicationInitialized         = false;                             // <-- Application initialization state
    let renderingPipeline              = null;                               // <-- Rendering pipeline reference
    let solarOrientationControls       = null;                               // <-- Solar controls reference
    let navigationButtonUIManager      = null;                               // <-- Navigation UI manager reference
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Babylon.js Core Objects
    // ------------------------------------------------------------
    let engine                         = null;                               // <-- Babylon.js engine reference
    let scene                          = null;                               // <-- Babylon.js scene reference
    let sunLight                       = null;                               // <-- Sun light reference
    let canvas                         = null;                               // <-- Canvas element reference
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Navigation System Management
    // ------------------------------------------------------------
    let navigationModes                = {};                                 // <-- Available navigation modes
    let activeNavigationMode           = null;                               // <-- Currently active navigation mode
    let activeCamera                   = null;                               // <-- Currently active camera reference
    // ---------------------------------------------------------------

    // MODULE VARIABLES | DOM Element References for User Interface
    // ------------------------------------------------------------
    let loadingOverlay                 = null;                               // <-- Loading overlay element
    let errorMessage                   = null;                               // <-- Error message display element
    let resetViewBtn                   = null;                               // <-- Reset view button reference
    let waypointModeBtn                = null;                               // <-- Waypoint mode button reference
    let walkModeBtn                    = null;                               // <-- Walk mode button reference
    let orbitModeBtn                   = null;                               // <-- Orbit mode button reference
    let flyModeBtn                     = null;                               // <-- Fly mode button reference
    let sunTimeSlider                  = null;                               // <-- Time slider control reference
    let sunTimeDisplay                 = null;                               // <-- Time display text reference
    let ssaoToggleBtn                  = null;                               // <-- SSAO toggle button reference
    let furnishingsToggleBtn           = null;                               // <-- Furnishings toggle button reference
    let toggleToolbarBtn               = null;                               // <-- Hamburger menu toggle button
    let toolbar                        = null;                               // <-- Toolbar container element
    let menuTutorialOverlay            = null;                               // <-- Menu tutorial overlay element
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Application Configuration and Settings
    // ------------------------------------------------------------
    let appConfig                      = null;                               // <-- Application configuration data
    let ssaoEnabled                    = true;                               // <-- SSAO enabled state
    let furnishingsVisible             = true;                               // <-- Furnishings visibility state
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Render Loop State
    // ------------------------------------------------------------
    let renderLoopStarted              = false;                              // <-- Track if render loop is running
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Application Initialization and Startup Sequence
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Complete TrueVision3D Application
    // ------------------------------------------------------------
    async function initializeApplication() {
        try {
            console.log("Starting TrueVision3D application initialization...");
            
            // LOAD APPLICATION CONFIGURATION
            const configLoaded = await loadApplicationConfiguration();       // <-- Load app configuration
            if (!configLoaded) {
                throw new Error("Failed to load application configuration");
            }
            
            // INITIALIZE USER INTERFACE REFERENCES
            initializeUIReferences();                                        // <-- Get DOM element references
            
            // INITIALIZE RENDERING PIPELINE
            const renderingRefs = initializeRenderingSystem();               // <-- Initialize 3D rendering
            if (!renderingRefs) {
                throw new Error("Failed to initialize rendering system");
            }
            
            // INITIALIZE SOLAR ORIENTATION CONTROLS
            initializeSolarSystem(renderingRefs);                            // <-- Initialize solar controls
            
            // INITIALIZE NAVIGATION SYSTEM
            await initializeNavigationSystem();                              // <-- Initialize navigation modes
            
            // START RENDERING AND REGISTER EVENTS
            startApplicationSystems();                                       // <-- Start rendering and events
            
            applicationInitialized = true;                                   // <-- Mark as initialized
            console.log("TrueVision3D application initialized successfully");
            
        } catch (error) {
            console.error("Application initialization failed:", error);      // <-- Log initialization error
            showErrorMessage("Application failed to initialize: " + error.message);
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Load Application Configuration Data
    // ---------------------------------------------------------------
    async function loadApplicationConfiguration() {
        try {
            // WAIT FOR CONFIGURATION TO LOAD
            const configLoaded = await window.TrueVision3D.configLoadPromise; // <-- Wait for config
            if (!configLoaded) {
                console.error("Failed to load application configuration");   // <-- Log error
                return false;
            }
            
            appConfig = window.TrueVision3D?.AppConfig;                      // <-- Get app configuration
            console.log("AppConfig structure:", appConfig);                   // <-- Debug log to check structure
            if (!appConfig) {
                console.error("App configuration not loaded");               // <-- Log error
                return false;
            }
            
            console.log("Application configuration loaded successfully");     // <-- Log success
            return true;
            
        } catch (error) {
            console.error("Error loading application configuration:", error); // <-- Log error
            return false;
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Initialize DOM Element References
    // ---------------------------------------------------------------
    function initializeUIReferences() {
        canvas = document.getElementById("renderCanvas");                     // <-- HTML5 canvas element reference
        loadingOverlay = document.getElementById("loading-overlay");          // <-- Loading overlay element
        errorMessage = document.getElementById("error-message");             // <-- Error message display element
        resetViewBtn = document.getElementById("resetViewBtn");              // <-- Reset view button reference
        waypointModeBtn = document.getElementById("waypointModeBtn");        // <-- Waypoint mode button reference
        walkModeBtn = document.getElementById("walkModeBtn");                // <-- Walk mode button reference
        orbitModeBtn = document.getElementById("orbitModeBtn");              // <-- Orbit mode button reference
        flyModeBtn = document.getElementById("flyModeBtn");                  // <-- Fly mode button reference
        sunTimeSlider = document.getElementById("sunTimeSlider");            // <-- Time slider control reference
        sunTimeDisplay = document.getElementById("sunTimeDisplay");          // <-- Time display text reference
        ssaoToggleBtn = document.getElementById("ssaoToggleBtn");            // <-- SSAO toggle button reference
        furnishingsToggleBtn = document.getElementById("furnishingsToggleBtn"); // <-- Furnishings toggle button reference
        toggleToolbarBtn = document.getElementById("toggleToolbarBtn");       // <-- Hamburger menu toggle button
        toolbar = document.getElementById("toolbar");                         // <-- Toolbar container element
        menuTutorialOverlay = document.getElementById("menu-tutorial-overlay"); // <-- Menu tutorial overlay
        
        console.log("UI element references initialized");                    // <-- Log UI initialization
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Initialize Rendering Pipeline System
    // ---------------------------------------------------------------
    function initializeRenderingSystem() {
        if (!window.TrueVision3D.RenderingPipeline) {
            console.error("Rendering pipeline module not available");        // <-- Log error
            return null;
        }
        
        renderingPipeline = window.TrueVision3D.RenderingPipeline;           // <-- Get rendering pipeline reference
        
        // INITIALIZE RENDERING PIPELINE
        const renderingRefs = renderingPipeline.initialize(canvas, loadingOverlay, errorMessage);
        
        // STORE CORE REFERENCES
        engine = renderingRefs.engine;                                       // <-- Store engine reference
        scene = renderingRefs.scene;                                         // <-- Store scene reference
        sunLight = renderingRefs.sunLight;                                   // <-- Store sun light reference
        
        // INITIALIZE DEV TOOLS MANAGER AFTER SCENE IS CREATED
        if (window.TrueVision3D?.DevTools?.DebugMarkersManager) {
            const devToolsInitialized = window.TrueVision3D.DevTools.DebugMarkersManager.initialize(scene);
            if (devToolsInitialized) {
                console.log("Dev Tools Manager initialized successfully");   // <-- Log success
            } else {
                console.warn("Dev Tools Manager failed to initialize");      // <-- Log warning
            }
        }
        
        console.log("Rendering system initialized");                         // <-- Log rendering initialization
        return renderingRefs;                                                // <-- Return references
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Initialize Solar Orientation Control System
    // ---------------------------------------------------------------
    function initializeSolarSystem(renderingRefs) {
        if (!window.TrueVision3D.SolarOrientationControls) {
            console.error("Solar orientation controls module not available"); // <-- Log error
            return;
        }
        
        solarOrientationControls = window.TrueVision3D.SolarOrientationControls; // <-- Get solar controls reference
        
        // INITIALIZE SOLAR CONTROLS
        solarOrientationControls.initialize(
            renderingRefs.scene, 
            renderingRefs.sunLight, 
            sunTimeSlider, 
            sunTimeDisplay
        );
        
        console.log("Solar orientation system initialized");                  // <-- Log solar initialization
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Navigation System Initialization and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Navigation System and Available Modes
    // ---------------------------------------------------------------
    async function initializeNavigationSystem() {
        const navConfig = appConfig?.AppConfig?.AppConfig_NavMode;          // <-- Get navigation config
        console.log("Navigation config:", navConfig);                        // <-- Debug log
        if (!navConfig) {
            console.error("Navigation configuration not found");             // <-- Log error
            return;
        }
        
        // INITIALIZE WAYPOINT NAVIGATION
        if (navConfig.AppNavMode_Waypoint?.NavMode_WaypointState && 
            window.TrueVision3D?.NavigationModes?.WaypointNavigation) {
            const waypointNav = window.TrueVision3D.NavigationModes.WaypointNavigation;
            const initialized = await waypointNav.initialize(scene, canvas); // <-- AWAIT the async initialization
            if (initialized) {
                navigationModes.waypoint = waypointNav;                      // <-- Store navigation mode
                waypointModeBtn.style.display = "inline-block";              // <-- Show button
                console.log("Waypoint navigation initialized");              // <-- Log success
            }
        }
        
        // INITIALIZE WALK NAVIGATION
        if (navConfig.AppNavMode_Walk?.NavMode_WalkState && 
            window.TrueVision3D?.NavigationModes?.WalkNavigation) {
            const walkNav = window.TrueVision3D.NavigationModes.WalkNavigation;
            const initialized = await walkNav.initialize(scene, canvas);     // <-- AWAIT even if synchronous
            if (initialized) {
                navigationModes.walk = walkNav;                              // <-- Store navigation mode
                walkModeBtn.style.display = "inline-block";                  // <-- Show button
                console.log("Walk navigation initialized");                  // <-- Log success
            }
        }
        
        // INITIALIZE ORBIT NAVIGATION
        if (navConfig.AppNavMode_Orbit?.NavMode_OrbitState && 
            window.TrueVision3D?.NavigationModes?.OrbitNavigation) {
            const orbitNav = window.TrueVision3D.NavigationModes.OrbitNavigation;
            const initialized = await orbitNav.initialize(scene, canvas);    // <-- AWAIT even if synchronous
            if (initialized) {
                navigationModes.orbit = orbitNav;                            // <-- Store navigation mode
                orbitModeBtn.style.display = "inline-block";                 // <-- Show button
                console.log("Orbit navigation initialized");                 // <-- Log success
            }
        }
        
        // INITIALIZE FLY NAVIGATION
        if (navConfig.AppNavMode_Fly?.NavMode_FlyState && 
            window.TrueVision3D?.NavigationModes?.FlyNavigation) {
            const flyNav = window.TrueVision3D.NavigationModes.FlyNavigation;
            const initialized = await flyNav.initialize(scene, canvas);      // <-- AWAIT even if synchronous
            if (initialized) {
                navigationModes.fly = flyNav;                                // <-- Store navigation mode
                flyModeBtn.style.display = "inline-block";                   // <-- Show button
                console.log("Fly navigation initialized");                   // <-- Log success
            }
        }
        
        // INITIALIZE NAVIGATION BUTTON UI MANAGER
        initializeNavigationUI();                                            // <-- Setup navigation UI
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Initialize Navigation UI Management
    // ---------------------------------------------------------------
    function initializeNavigationUI() {
        if (!window.TrueVision3D.UiMenu || !window.TrueVision3D.UiMenu.NavModeButtonManager) {
            console.error("UI Menu Navigation Mode Button Manager not available");
            return;
        }
        
        navigationButtonUIManager = window.TrueVision3D.UiMenu.NavModeButtonManager;
        
        const navButtons = {
            waypoint: waypointModeBtn,
            walk: walkModeBtn,
            orbit: orbitModeBtn,
            fly: flyModeBtn
        };
        
        navigationButtonUIManager.initialize(
            scene, 
            canvas, 
            navigationModes, 
            navButtons
        );
        
        // SET MODE CHANGE HANDLER
        navigationButtonUIManager.onModeChange((modeName, mode) => {
            activeNavigationMode = modeName;                                 // <-- Update active mode
            activeCamera = mode.getCamera();                                 // <-- Update active camera
            
            // UPDATE SSAO CAMERA
            if (renderingPipeline) {
                renderingPipeline.updateSSAOCamera(activeCamera);            // <-- Update SSAO camera
            }
            
            // START RENDER LOOP IF NOT ALREADY RUNNING
            if (!renderLoopStarted && renderingPipeline && activeCamera) {
                ssaoEnabled = renderingPipeline.startRendering(activeCamera); // <-- Start rendering
                renderLoopStarted = true;                                    // <-- Mark as started
                updateSSAOButtonState();                                     // <-- Update SSAO button
                console.log("Render loop started on navigation mode change"); // <-- Log start
            }
        });
        
        // PRIORITIZE WAYPOINT MODE WHEN ENABLED IN CONFIGURATION
        const availableModes = Object.keys(navigationModes);                // <-- Get available modes
        const navConfig = appConfig?.AppConfig?.AppConfig_NavMode;           // <-- Get navigation config
        let startingMode = null;                                             // <-- Starting mode variable
        
        // CHECK IF WAYPOINT MODE IS ENABLED AND AVAILABLE
        if (navConfig?.AppNavMode_Waypoint?.NavMode_WaypointState && 
            navigationModes.waypoint) {
            startingMode = 'waypoint';                                       // <-- Use waypoint mode as priority
            console.log("Starting with waypoint mode (configured priority)"); // <-- Log waypoint priority
        } else if (availableModes.length > 0) {
            startingMode = availableModes[0];                                // <-- Fallback to first available
            console.log("Starting with first available mode:", startingMode); // <-- Log fallback mode
        }
        
        // ACTIVATE STARTING MODE
        if (startingMode) {
            navigationButtonUIManager.switchMode(startingMode);              // <-- Switch to starting mode
        }
        
        console.log("Navigation UI management initialized");                 // <-- Log UI initialization
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Application Systems Startup and Event Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Start Application Systems and Register Event Handlers
    // ------------------------------------------------------------
    function startApplicationSystems() {
        // START RENDERING SYSTEM - Check activeCamera first
        if (!activeCamera && navigationModes.waypoint) {
            // If no active camera but waypoint mode exists, enable it first
            navigationModes.waypoint.enable();                               // <-- Enable waypoint mode
            activeCamera = navigationModes.waypoint.getCamera();             // <-- Get waypoint camera
            activeNavigationMode = 'waypoint';                               // <-- Set active mode
        }
        
        if (renderingPipeline && activeCamera) {
            ssaoEnabled = renderingPipeline.startRendering(activeCamera);    // <-- Start rendering with SSAO
            updateSSAOButtonState();                                         // <-- Update SSAO button
        } else {
            console.error("Cannot start rendering - no active camera available"); // <-- Log error
        }
        
        // REGISTER EVENT HANDLERS
        registerApplicationEventHandlers();                                  // <-- Setup user interface events
        
        // REGISTER CLEANUP ON PAGE UNLOAD
        window.addEventListener("beforeunload", cleanupApplicationResources); // <-- Ensure proper cleanup
        
        console.log("Application systems started and events registered");    // <-- Log systems startup
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Register All User Interface Event Handlers
    // ---------------------------------------------------------------
    function registerApplicationEventHandlers() {
        // HAMBURGER MENU TOGGLE EVENT
        if (toggleToolbarBtn && toolbar) {
            toggleToolbarBtn.addEventListener("click", toggleToolbar);        // <-- Hamburger menu toggle handler
        }
        
        // NAVIGATION CONTROL EVENTS
        if (resetViewBtn) {
            resetViewBtn.addEventListener("click", resetView);               // <-- Reset view button handler
        }
        
        // RENDER EFFECT BUTTON EVENTS
        if (ssaoToggleBtn) {
            ssaoToggleBtn.addEventListener("click", toggleSSAO);             // <-- SSAO toggle button handler
        }
        
        // FURNISHINGS VISIBILITY BUTTON EVENT
        if (furnishingsToggleBtn) {
            furnishingsToggleBtn.addEventListener("click", toggleFurnishings); // <-- Furnishings toggle button handler
            updateFurnishingsButtonState();                                  // <-- Set initial button state
        }
        
        // SHOW MENU TUTORIAL ON FIRST VISIT
        showMenuTutorialIfNeeded();                                          // <-- Check and show tutorial
        
        console.log("Application event handlers registered");                // <-- Log event registration
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | User Interface Control Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Toggle Toolbar Visibility
    // ------------------------------------------------------------
    function toggleToolbar() {
        if (!toolbar) return;                                                // <-- Exit if no toolbar reference
        
        toolbar.classList.toggle("collapsed");                               // <-- Toggle collapsed class
        
        // HIDE TUTORIAL WHEN MENU IS TOGGLED
        if (menuTutorialOverlay) {
            menuTutorialOverlay.style.display = "none";                      // <-- Hide tutorial overlay
        }
        
        // RESIZE BABYLON ENGINE AFTER TRANSITION
        if (engine) {
            setTimeout(() => {
                engine.resize();                                             // <-- Resize engine after transition
            }, 300);                                                         // <-- Wait for CSS transition to complete
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Show Menu Tutorial for First-Time Users
    // ------------------------------------------------------------
    function showMenuTutorialIfNeeded() {
        if (!menuTutorialOverlay) return;                                   // <-- Exit if no tutorial overlay
        
        // CHECK IF USER HAS SEEN TUTORIAL
        const hasSeenTutorial = localStorage.getItem("truevision-menu-tutorial-seen"); // <-- Check local storage
        
        if (!hasSeenTutorial) {
            // SHOW TUTORIAL WITH DELAY
            setTimeout(() => {
                menuTutorialOverlay.style.display = "block";                 // <-- Show tutorial overlay
                
                // AUTO-HIDE AFTER 5 SECONDS
                setTimeout(() => {
                    if (menuTutorialOverlay) {
                        menuTutorialOverlay.style.display = "none";          // <-- Hide tutorial overlay
                    }
                }, 5000);                                                    // <-- Hide after 5 seconds
                
            }, 1000);                                                        // <-- Show after 1 second delay
            
            // MARK AS SEEN
            localStorage.setItem("truevision-menu-tutorial-seen", "true");   // <-- Save to local storage
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reset Current Navigation View
    // ------------------------------------------------------------
    function resetView() {
        if (activeNavigationMode && navigationModes[activeNavigationMode]) {
            navigationModes[activeNavigationMode].reset();                   // <-- Call mode's reset function
            console.log("View reset for " + activeNavigationMode + " mode"); // <-- Log view reset
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle SSAO Render Effect
    // ------------------------------------------------------------
    function toggleSSAO() {
        if (renderingPipeline) {
            ssaoEnabled = renderingPipeline.toggleSSAO();                    // <-- Toggle SSAO state
            updateSSAOButtonState();                                         // <-- Update button appearance
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle Furnishings Visibility
    // ------------------------------------------------------------
    function toggleFurnishings() {
        if (renderingPipeline) {
            furnishingsVisible = renderingPipeline.toggleFurnishings();       // <-- Toggle furnishings state
            updateFurnishingsButtonState();                                   // <-- Update button appearance
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update SSAO Button Visual State
    // ---------------------------------------------------------------
    function updateSSAOButtonState() {
        if (ssaoToggleBtn) {
            ssaoToggleBtn.textContent = ssaoEnabled ? "SSAO: ON" : "SSAO: OFF"; // <-- Update button text
            ssaoToggleBtn.style.backgroundColor = ssaoEnabled ? "#4CAF50" : "#666"; // <-- Update button color
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Furnishings Button Visual State
    // ---------------------------------------------------------------
    function updateFurnishingsButtonState() {
        if (furnishingsToggleBtn) {
            furnishingsToggleBtn.textContent = furnishingsVisible ? "Furnishings: ON" : "Furnishings: OFF"; // <-- Update button text
            furnishingsToggleBtn.style.backgroundColor = furnishingsVisible ? "#4CAF50" : "#666";           // <-- Update button color
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Show Error Message to User
    // ------------------------------------------------------------
    function showErrorMessage(message) {
        if (errorMessage) {
            errorMessage.textContent = message;                              // <-- Set error message text
            errorMessage.style.display = "block";                           // <-- Show error message
        }
        if (loadingOverlay) {
            loadingOverlay.classList.add("hidden");                         // <-- Hide loading overlay
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Application Lifecycle and Resource Management
// -----------------------------------------------------------------------------

    // FUNCTION | Cleanup Application Resources on Shutdown
    // ------------------------------------------------------------
    function cleanupApplicationResources() {
        console.log("Cleaning up TrueVision3D application resources...");
        
        // CLEANUP NAVIGATION MODES
        Object.values(navigationModes).forEach(mode => {
            if (mode && mode.dispose) {
                mode.dispose();                                              // <-- Dispose navigation mode
            }
        });
        
        // CLEANUP SOLAR ORIENTATION CONTROLS
        if (solarOrientationControls && solarOrientationControls.dispose) {
            solarOrientationControls.dispose();                             // <-- Clean up solar controls
        }
        
        // CLEANUP RENDERING PIPELINE
        if (renderingPipeline && renderingPipeline.dispose) {
            renderingPipeline.dispose();                                     // <-- Clean up rendering pipeline
        }
        
        // CLEAR REFERENCES
        applicationInitialized = false;                                      // <-- Mark as not initialized
        renderingPipeline = null;                                            // <-- Clear rendering reference
        solarOrientationControls = null;                                     // <-- Clear solar reference
        navigationButtonUIManager = null;                                    // <-- Clear navigation UI reference
        
        console.log("Application cleanup complete");                         // <-- Log cleanup completion
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Application Status and State
    // ------------------------------------------------------------
    function getApplicationStatus() {
        return {
            initialized: applicationInitialized,                             // <-- Initialization state
            activeNavigationMode: activeNavigationMode,                      // <-- Active navigation mode
            availableNavigationModes: Object.keys(navigationModes),          // <-- Available modes
            ssaoEnabled: ssaoEnabled,                                        // <-- SSAO state
            renderingActive: engine && !engine.isDisposed                    // <-- Rendering state
        };
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Interface for Application Core
// -----------------------------------------------------------------------------

    // FUNCTION | Get Core Application References
    // ------------------------------------------------------------
    function getCoreReferences() {
        return {
            engine: engine,                                                  // <-- Babylon.js engine reference
            scene: scene,                                                    // <-- Babylon.js scene reference
            canvas: canvas,                                                  // <-- Canvas element reference
            activeCamera: activeCamera,                                      // <-- Active camera reference
            navigationModes: navigationModes                                 // <-- Navigation modes
        };
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export and Public Interface
// -----------------------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.ApplicationCore = {
        initialize: initializeApplication,                                   // <-- Initialize application function
        getCoreReferences: getCoreReferences,                               // <-- Get references function
        getApplicationStatus: getApplicationStatus,                          // <-- Get status function
        cleanup: cleanupApplicationResources                                 // <-- Cleanup function
    };

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Application Startup Execution
// -----------------------------------------------------------------------------

    // INITIALIZE APPLICATION ON SCRIPT LOAD
    document.addEventListener('DOMContentLoaded', function() {
        initializeApplication();                                             // <-- Start application when DOM ready
    });

// endregion -------------------------------------------------------------------

})(); 