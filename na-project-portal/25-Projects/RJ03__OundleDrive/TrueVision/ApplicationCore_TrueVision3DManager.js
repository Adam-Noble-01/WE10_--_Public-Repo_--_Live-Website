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
            await initializeUIReferences();                                        // <-- Get DOM element references
            
            // INITIALIZE RENDERING PIPELINE
            const renderingRefs = await initializeRenderingSystem();         // <-- Initialize 3D rendering (now async)
            if (!renderingRefs) {
                throw new Error("Failed to initialize rendering system");
            }
            
            // STORE CORE REFERENCES FROM RENDERING SYSTEM
            engine = renderingRefs.engine;                                   // <-- Store engine reference
            scene = renderingRefs.scene;                                     // <-- Store scene reference
            sunLight = renderingRefs.sunLight;                               // <-- Store sun light reference
            
            // INITIALIZE SOLAR ORIENTATION CONTROLS
            initializeSolarSystem(renderingRefs);                            // <-- Initialize solar controls
            
            // INITIALIZE NAVIGATION SYSTEM
            await initializeNavigationSystem();                              // <-- Initialize navigation modes
            
            // REGISTER EVENT LISTENERS FOR CDN MODEL LOADING
            registerModelLoadingEventListeners();                            // <-- Setup model loading callbacks
            
            // REGISTER BASIC EVENT HANDLERS (NOT NAVIGATION YET)
            registerBasicEventHandlers();                                    // <-- Setup basic UI events
            
            applicationInitialized = true;                                   // <-- Mark as initialized
            console.log("TrueVision3D application initialized - waiting for models...");
            
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
    async function initializeUIReferences() {
        // ENSURE DOM IS READY
        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        
        // WAIT FOR DOM TO BE READY AND RETRY CANVAS INITIALIZATION
        const initCanvas = () => {
            canvas = document.getElementById("renderCanvas");
            if (!canvas) {
                console.error("❌ CRITICAL: Canvas element 'renderCanvas' not found in DOM!");
                console.error("❌ Available elements:", [...document.querySelectorAll('*')].map(el => el.id).filter(id => id));
                
                // Try to find any canvas elements
                const allCanvases = document.querySelectorAll('canvas');
                console.error("❌ Available canvas elements:", allCanvases);
                
                if (allCanvases.length > 0) {
                    console.warn("⚠️  Using first available canvas as fallback");
                    canvas = allCanvases[0];
                    canvas.id = "renderCanvas"; // Ensure it has the expected ID
                } else {
                    console.error("❌ No canvas elements found at all!");
                    return false;
                }
            }
            
            console.log("✅ Canvas element initialized:", canvas);
            return true;
        };
        
        // Try to initialize canvas with retries
        let canvasInitialized = initCanvas();
        if (!canvasInitialized) {
            // If failed, wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 100));
            canvasInitialized = initCanvas();
            if (!canvasInitialized) {
                throw new Error("Failed to initialize canvas element after retry");
            }
        }
        
        // Initialize other UI references
        loadingOverlay = document.getElementById("loading-overlay");
        errorMessage = document.getElementById("error-message");
        resetViewBtn = document.getElementById("resetViewBtn");
        waypointModeBtn = document.getElementById("waypointModeBtn");
        walkModeBtn = document.getElementById("walkModeBtn");
        orbitModeBtn = document.getElementById("orbitModeBtn");
        flyModeBtn = document.getElementById("flyModeBtn");
        sunTimeSlider = document.getElementById("sunTimeSlider");
        sunTimeDisplay = document.getElementById("sunTimeDisplay");
        ssaoToggleBtn = document.getElementById("ssaoToggleBtn");
        furnishingsToggleBtn = document.getElementById("furnishingsToggleBtn");
        toggleToolbarBtn = document.getElementById("toggleToolbarBtn");
        toolbar = document.getElementById("toolbar");
        menuTutorialOverlay = document.getElementById("menu-tutorial-overlay");
        
        console.log("UI element references initialized");
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Initialize Rendering Pipeline System
    // ---------------------------------------------------------------
    async function initializeRenderingSystem() {
        // WAIT FOR RENDERING PIPELINE TO BE AVAILABLE
        // Instead of polling, wait for the renderingPipelineLoaded event
        if (!window.TrueVision3D.RenderingPipeline) {
            console.log("Rendering pipeline not immediately available - waiting...");
            
            // Create a promise that resolves when the rendering pipeline loads
            await new Promise((resolve, reject) => {
                // Set a timeout for safety (30 seconds)
                const timeout = setTimeout(() => {
                    console.error("❌ Rendering pipeline loading timeout after 30 seconds");
                    console.error("Available modules:", Object.keys(window.TrueVision3D || {}));
                    reject(new Error("Rendering pipeline module not available after timeout"));
                }, 30000);
                
                // Listen for the rendering pipeline loaded event
                window.addEventListener('renderingPipelineLoaded', function onPipelineLoaded() {
                    clearTimeout(timeout);
                    window.removeEventListener('renderingPipelineLoaded', onPipelineLoaded);
                    console.log("✅ Rendering pipeline loaded event received");
                    resolve();
                }, { once: true });
                
                // Check if it's already loaded (race condition protection)
                if (window.TrueVision3D && window.TrueVision3D.RenderingPipeline) {
                    clearTimeout(timeout);
                    console.log("✅ Rendering pipeline became available during wait");
                    resolve();
                }
            });
        }
        
        // DOUBLE CHECK RENDERING PIPELINE IS AVAILABLE
        if (!window.TrueVision3D || !window.TrueVision3D.RenderingPipeline) {
            console.error("❌ Rendering pipeline module still not available after waiting");
            console.error("TrueVision3D namespace:", window.TrueVision3D);
            console.error("Available modules:", window.TrueVision3D ? Object.keys(window.TrueVision3D) : 'namespace not defined');
            return null;
        }
        
        // CHECK IF INITIALIZE FUNCTION EXISTS
        if (typeof window.TrueVision3D.RenderingPipeline.initialize !== 'function') {
            console.error("❌ RenderingPipeline.initialize is not a function");
            console.error("RenderingPipeline object:", window.TrueVision3D.RenderingPipeline);
            console.error("Available methods:", Object.keys(window.TrueVision3D.RenderingPipeline));
            return null;
        }
        
        renderingPipeline = window.TrueVision3D.RenderingPipeline;           // <-- Get rendering pipeline reference
        
        console.log("✅ About to initialize rendering pipeline with canvas:", canvas);
        
        // INITIALIZE RENDERING PIPELINE (NOW ASYNC)
        const renderingRefs = await renderingPipeline.initialize(canvas, loadingOverlay, errorMessage);
        
        if (!renderingRefs) {
            console.error("❌ Rendering pipeline initialization returned null/undefined");
            return null;
        }
        
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

    // FUNCTION | Register Model Loading Event Listeners
    // ---------------------------------------------------------------
    function registerModelLoadingEventListeners() {
        // LISTEN FOR CRITICAL MODELS LOADED EVENT
        window.addEventListener('modelsReadyForInteraction', function(event) {
            console.log("Critical models loaded - enabling user interaction");
            
            // CREATE WAYPOINT ORBS NOW THAT MODELS ARE LOADED
            if (navigationModes.waypoint && window.TrueVision3D?.DevTools?.DebugMarkersManager?.shouldShowWaypointOrbs()) {
                console.log("Creating waypoint orbs after model load");
                navigationModes.waypoint.createWaypointOrbs();              // <-- Create orbs now
            }
            
            // START APPLICATION SYSTEMS NOW THAT MODELS ARE READY
            startApplicationSystems();                                       // <-- Enable navigation and rendering
            
            // DON'T HIDE LOADING OVERLAY YET - Wait for all models
            console.log("Critical models loaded, waiting for all models to complete...");
        });

        // LISTEN FOR ALL MODELS LOADED EVENT
        if (window.TrueVisionCdnLoader) {
            window.TrueVisionCdnLoader.onLoadEvent('all_complete', function(event) {
                console.log("All models loaded successfully - hiding loading overlay");
                
                // HIDE LOADING OVERLAY AFTER ALL MODELS ARE LOADED
                if (loadingOverlay) {
                    loadingOverlay.classList.add("hidden");                  // <-- Hide loading screen
                }
            });
        }
        
        // LISTEN FOR CDN LOADER STATUS UPDATES (OPTIONAL)
        if (window.TrueVisionCdnLoader) {
            const checkLoadingInterval = setInterval(() => {
                const status = window.TrueVisionCdnLoader.getStatus();
                if (status.criticalModelsLoaded) {
                    clearInterval(checkLoadingInterval);                     // <-- Stop checking
                    console.log("CDN Loader reports critical models ready");
                }
            }, 500);                                                        // <-- Check every 500ms
        }
        
        console.log("Model loading event listeners registered");             // <-- Log registration
    }
    // ---------------------------------------------------------------

    // FUNCTION | Register Basic Event Handlers (Non-Navigation)
    // ---------------------------------------------------------------
    function registerBasicEventHandlers() {
        // HAMBURGER MENU TOGGLE EVENT
        if (toggleToolbarBtn && toolbar) {
            toggleToolbarBtn.addEventListener("click", toggleToolbar);        // <-- Hamburger menu toggle handler
        }
        
        // RENDER EFFECT BUTTON EVENTS
        if (ssaoToggleBtn) {
            ssaoToggleBtn.addEventListener("click", toggleSSAO);             // <-- SSAO toggle button handler
        }
        
        // FURNISHINGS VISIBILITY BUTTON EVENT
        if (furnishingsToggleBtn) {
            console.log("✅ furnishingsToggleBtn found - registering click event listener");
            console.log("🔍 Button element:", furnishingsToggleBtn);
            console.log("🔍 Button current text:", furnishingsToggleBtn.textContent);
            
            furnishingsToggleBtn.addEventListener("click", toggleFurnishings); // <-- Furnishings toggle button handler
            console.log("✅ Furniture toggle event listener registered successfully");
            
            updateFurnishingsButtonState();                                  // <-- Set initial button state
        } else {
            console.error("❌ furnishingsToggleBtn element not found during event registration!");
            console.error("❌ This means the button is missing from the HTML or getElementById failed");
            
            // TRY TO FIND THE BUTTON BY ALTERNATIVE METHODS
            const buttonByQuery = document.querySelector("#furnishingsToggleBtn");
            console.log("🔍 Alternative query result:", buttonByQuery);
            
            const allButtons = document.querySelectorAll("button");
            console.log(`🔍 Total buttons found: ${allButtons.length}`);
            allButtons.forEach((btn, index) => {
                if (index < 5) { // Log first 5 buttons
                    console.log(`   Button ${index + 1}: id="${btn.id}", text="${btn.textContent}"`);
                }
            });
        }
        
        // SHOW MENU TUTORIAL ON FIRST VISIT
        showMenuTutorialIfNeeded();                                          // <-- Check and show tutorial
        
        // REGISTER CLEANUP ON PAGE UNLOAD
        window.addEventListener("beforeunload", cleanupApplicationResources); // <-- Ensure proper cleanup
        
        console.log("Basic event handlers registered");                      // <-- Log event registration
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
        
        // INITIALIZE WAYPOINT NAVIGATION (BUT DON'T CREATE ORBS YET)
        if (navConfig.AppNavMode_Waypoint?.NavMode_WaypointState && 
            window.TrueVision3D?.NavigationModes?.WaypointNavigation) {
            const waypointNav = window.TrueVision3D.NavigationModes.WaypointNavigation;
            
            // Pass a flag to prevent orb creation during initialization
            const initialized = await waypointNav.initialize(scene, canvas, { deferOrbCreation: true });
            
            if (initialized) {
                navigationModes.waypoint = waypointNav;                      // <-- Store navigation mode
                waypointModeBtn.style.display = "inline-block";              // <-- Show button
                console.log("Waypoint navigation initialized (orbs deferred)"); // <-- Log success
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

    // SUB FUNCTION | Register Navigation-Related Event Handlers
    // ---------------------------------------------------------------
    function registerApplicationEventHandlers() {
        // NAVIGATION CONTROL EVENTS
        if (resetViewBtn) {
            resetViewBtn.addEventListener("click", resetView);               // <-- Reset view button handler
        }
        
        console.log("Navigation event handlers registered");                 // <-- Log event registration
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
    // ---------------------------------------------------------------
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
    // ---------------------------------------------------------------
    function resetView() {
        if (activeNavigationMode && navigationModes[activeNavigationMode]) {
            navigationModes[activeNavigationMode].reset();                   // <-- Call mode's reset function
            console.log("View reset for " + activeNavigationMode + " mode"); // <-- Log view reset
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle SSAO Render Effect
    // ---------------------------------------------------------------
    function toggleSSAO() {
        if (renderingPipeline) {
            ssaoEnabled = renderingPipeline.toggleSSAO();                    // <-- Toggle SSAO state
            updateSSAOButtonState();                                         // <-- Update button appearance
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle Furnishings Visibility
    // ---------------------------------------------------------------
    function toggleFurnishings() {
        console.log("🔄 Furniture toggle button clicked!");
        console.log("🔍 renderingPipeline available:", !!renderingPipeline);
        console.log("🔍 renderingPipeline methods:", renderingPipeline ? Object.keys(renderingPipeline) : "None");
        
        if (renderingPipeline && renderingPipeline.toggleFurnishings) {
            try {
                console.log("🔄 Calling renderingPipeline.toggleFurnishings()...");
                const newState = renderingPipeline.toggleFurnishings();       // <-- Toggle furnishings state
                console.log("✅ Toggle successful, new state:", newState);
                updateFurnishingsButtonState();                               // <-- Update button appearance
            } catch (error) {
                console.error("❌ Error during furniture toggle:", error);
                showErrorMessage("Failed to toggle furniture visibility");
            }
        } else if (renderingPipeline && !renderingPipeline.toggleFurnishings) {
            console.error("❌ renderingPipeline.toggleFurnishings method not available");
            console.error("Available methods:", Object.keys(renderingPipeline));
            showErrorMessage("Furniture toggle feature not available");
        } else {
            console.error("❌ Rendering pipeline not available - button clicked too early?");
            console.log("🔍 Application initialized:", applicationInitialized);
            console.log("🔍 Current initialization state:", getApplicationStatus());
            
            // TRY TO ACCESS PIPELINE DIRECTLY FROM NAMESPACE
            if (window.TrueVision3D?.RenderingPipeline?.toggleFurnishings) {
                console.log("🔄 Attempting direct access to RenderingPipeline...");
                try {
                    const newState = window.TrueVision3D.RenderingPipeline.toggleFurnishings();
                    console.log("✅ Direct toggle successful, new state:", newState);
                    updateFurnishingsButtonState();
                    
                    // UPDATE LOCAL REFERENCE FOR FUTURE CALLS
                    renderingPipeline = window.TrueVision3D.RenderingPipeline;
                    console.log("✅ Updated local renderingPipeline reference");
                } catch (error) {
                    console.error("❌ Direct toggle also failed:", error);
                    showErrorMessage("Furniture toggle temporarily unavailable");
                }
            } else {
                console.error("❌ No rendering pipeline available anywhere");
                showErrorMessage("3D system not ready - please wait and try again");
            }
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
        // Get current state from rendering pipeline
        let currentState = true;
        if (window.TrueVision3D?.RenderingPipeline?.getFurnishingsVisibility) {
            currentState = window.TrueVision3D.RenderingPipeline.getFurnishingsVisibility();
        } else if (renderingPipeline?.getFurnishingsVisibility) {
            currentState = renderingPipeline.getFurnishingsVisibility();
        }
        
        console.log(`🔄 Updating furniture button state (furnishingsVisible: ${currentState})`);
        console.log(`🔍 furnishingsToggleBtn available:`, !!furnishingsToggleBtn);
        
        if (furnishingsToggleBtn) {
            const newText = currentState ? "Furnishings: ON" : "Furnishings: OFF";
            const newColor = currentState ? "#4CAF50" : "#666";
            
            console.log(`🔄 Setting button text to: "${newText}"`);
            console.log(`🔄 Setting button color to: ${newColor}`);
            
            furnishingsToggleBtn.textContent = newText;                      // <-- Update button text
            furnishingsToggleBtn.style.backgroundColor = newColor;           // <-- Update button color
            
            console.log(`✅ Button state updated successfully`);
        } else {
            console.error(`❌ furnishingsToggleBtn element not found - button state not updated`);
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Show Error Message to User
    // ---------------------------------------------------------------
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
    // ---------------------------------------------------------------
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

    // MARK MODULE AS LOADED
    if (window.TrueVision3D.ModuleDependencyManager) {
        window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('ApplicationCore');
    }

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Application Startup Execution
// -----------------------------------------------------------------------------

    // INITIALIZE APPLICATION ON SCRIPT LOAD
    // Fix: Wait for both DOM and rendering pipeline to be ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM ready - waiting for rendering pipeline...");
        
        // Check if rendering pipeline is already loaded
        if (window.TrueVision3D && window.TrueVision3D.RenderingPipeline) {
            console.log("Rendering pipeline already available - initializing application");
            initializeApplication();
        } else {
            // Wait for rendering pipeline to load
            console.log("Rendering pipeline not yet available - waiting for load event");
            window.addEventListener('renderingPipelineLoaded', function onPipelineReady() {
                console.log("Rendering pipeline loaded event received - initializing application");
                window.removeEventListener('renderingPipelineLoaded', onPipelineReady);
                
                // Small delay to ensure all module initialization is complete
                setTimeout(() => {
                    initializeApplication();
                }, 100);
            }, { once: true });
        }
    });

// endregion -------------------------------------------------------------------

})(); 