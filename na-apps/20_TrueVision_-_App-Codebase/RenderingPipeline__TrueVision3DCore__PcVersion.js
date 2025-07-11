// =============================================================================
// TRUEVISION 3D RENDERING PIPELINE - PC VERSION
// =============================================================================
//
// FILE       : RenderingPipeline__TrueVision3DCore__PcVersion.js
// NAMESPACE  : TrueVision3D.RenderingPipeline
// MODULE     : 3D Scene Creation and Rendering Management - PC Optimized
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : PC-optimized rendering pipeline with full quality features
// CREATED    : 2025
//
// DESCRIPTION:
// - PC-specific version with high-performance GPU mode
// - Full quality shadows, materials, and post-processing effects
// - No mobile-specific optimizations or battery considerations
// - Supports all advanced rendering features without restrictions
// - WebGL2 features fully utilized for maximum visual quality
// - High resolution textures and complex shader support
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Split from unified pipeline for device-specific optimization
// - Full quality rendering features for desktop systems
// - High-performance GPU mode enabled by default
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.RenderingPipeline = window.TrueVision3D.RenderingPipeline || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | PC-SPECIFIC CONFIGURATION CONSTANTS
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | PC Quality Settings
    // ------------------------------------------------------------
    const SHADOW_MAP_SIZE              = 4096;                               // <-- High resolution shadows for PC
    const SCENE_EXPOSURE               = 1.5;                                // <-- Full exposure for PC
    const SCENE_CONTRAST               = 1.2;                                // <-- Full contrast for PC
    const SUN_LIGHT_INTENSITY          = 2.5;                                // <-- Full intensity lighting
    const AMBIENT_LIGHT_INTENSITY      = 0.8;                                // <-- Full ambient lighting
    const ENABLE_SSAO_DEFAULT          = true;                               // <-- SSAO enabled by default on PC
    const SSAO_QUALITY_DEFAULT         = "HIGH";                             // <-- High quality SSAO for PC
    const SKYBOX_SIZE                  = 1000;                               // <-- Large skybox for PC
    const GROUND_SIZE                  = 1000;                               // <-- Large ground plane
    const GROUND_OFFSET                = -0.5;                               // <-- Ground offset in meters
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | PC Performance Settings
    // ------------------------------------------------------------
    const VALIDATE_BUILDING_MODEL      = true;                               // <-- Building model validation
    const FURNITURE_MODELS_OPTIONAL    = true;                               // <-- Furniture models optional
    const TEXTURE_OPTIMIZATION         = false;                              // <-- No texture optimization on PC
    const MAX_TEXTURE_SIZE             = 4096;                               // <-- Full texture resolution
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Core Babylon.js Engine and Scene Objects
    // ------------------------------------------------------------
    let canvas                         = null;                               // <-- HTML5 canvas element reference
    let engine                         = null;                               // <-- Babylon.js engine instance
    let scene                          = null;                               // <-- Babylon.js scene instance
    let sunLight                       = null;                               // <-- Primary directional light
    let shadowGenerator                = null;                               // <-- Shadow generation system
    let sceneEnvironment               = null;                               // <-- Scene environment reference
    // ---------------------------------------------------------------

    // MODULE VARIABLES | User Interface Element References
    // ------------------------------------------------------------
    let loadingOverlay                 = null;                               // <-- Loading overlay element
    let errorMessage                   = null;                               // <-- Error message display element
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Render Effects State Management
    // ------------------------------------------------------------
    let ssaoEnabled                    = ENABLE_SSAO_DEFAULT;                // <-- SSAO enabled state
    let activeCamera                   = null;                               // <-- Currently active camera reference
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Model Loading State
    // ------------------------------------------------------------
    let modelsLoaded                   = {                                   // <-- Track loaded models
        building                       : false,
        groundFloorFurniture          : false,
        firstFloorFurniture           : false
    };
    let totalModelsToLoad              = 0;                                 // <-- Total number of models to load
    let modelsLoadedCount              = 0;                                 // <-- Current number of loaded models
    let furnitureMeshes                = [];                                // <-- Array to store furniture mesh references
    let furnishingsVisible             = true;                              // <-- Default furnishings visibility state
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Material Integration - Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Update Materials for HDRI Lighting Environment
    // ---------------------------------------------------------------
    function updateMaterialsForHdri() {
        if (window.TrueVision3D?.MaterialLogic?.updateMaterialsForHdri) {
            const success = window.TrueVision3D.MaterialLogic.updateMaterialsForHdri();
            console.log("Materials updated for HDRI environment:", success ? "Success" : "Failed");
            return success;
        }
        console.warn("MaterialLogic.updateMaterialsForHdri not available");
        return false;
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Restore Materials from HDRI to Standard Lighting
    // ---------------------------------------------------------------
    function restoreMaterialsFromHdri() {
        if (window.TrueVision3D?.MaterialLogic?.restoreMaterialsFromHdri) {
            const success = window.TrueVision3D.MaterialLogic.restoreMaterialsFromHdri();
            console.log("Materials restored from HDRI environment:", success ? "Success" : "Failed");
            return success;
        }
        console.warn("MaterialLogic.restoreMaterialsFromHdri not available");
        return false;
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | PC-SPECIFIC ENGINE INITIALIZATION
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Babylon.js Engine with PC-Optimized Settings
    // ------------------------------------------------------------
    function initializeBabylonEngine(canvasElement) {
        canvas = canvasElement;                                              // <-- Store canvas reference
        
        // PC-SPECIFIC ENGINE OPTIONS
        const engineOptions = {
            preserveDrawingBuffer: true,
            stencil: true,
            powerPreference: "high-performance",                             // <-- High performance for PC
            antialias: true,                                                 // <-- Enable antialiasing
            alpha: false,                                                    // <-- No alpha for better performance
            depth: true,                                                     // <-- Enable depth buffer
            premultipliedAlpha: false,                                       // <-- Better color accuracy
            failIfMajorPerformanceCaveat: false,                           // <-- Don't fail on performance issues
            doNotHandleContextLost: false,                                   // <-- Handle context lost
            audioEngine: true,                                               // <-- Enable audio engine
            disableWebGL2Support: false                                      // <-- Enable WebGL2 features
        };
        
        engine = new BABYLON.Engine(canvas, true, engineOptions);           // <-- Create engine with PC options
        
        // PC-SPECIFIC ENGINE SETTINGS
        engine.enableOfflineSupport = false;                                 // <-- Disable offline support
        engine.doNotHandleContextLost = false;                              // <-- Handle WebGL context loss
        engine.disableVertexArrayObjects = false;                            // <-- Enable VAO for performance
        engine.forcePOTTextures = false;                                     // <-- Allow non-power-of-two textures
        
        // ENABLE PC PERFORMANCE FEATURES
        engine.enableUniformBuffers = true;                                  // <-- Enable uniform buffers
        engine.disableUniformBuffers = false;                                // <-- Ensure not disabled
        
        // DISABLE BABYLON.JS DEFAULT LOADING SCREEN
        engine.loadingScreen = {
            displayLoadingUI: function () { },                               // <-- Empty display function
            hideLoadingUI: function () { }                                   // <-- Empty hide function
        };
        
        // HANDLE WINDOW RESIZE EVENTS
        window.addEventListener("resize", function () {
            engine.resize();                                                 // <-- Resize engine to match window
        });
        
        console.log("Babylon.js PC engine initialized with high-performance mode");
        return engine;                                                       // <-- Return engine reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Create and Configure PC-Optimized Scene
    // ---------------------------------------------------------------
    function createScene() {
        scene = new BABYLON.Scene(engine);                                   // <-- Initialize new Babylon.js scene
        
        // PC-OPTIMIZED SCENE SETTINGS
        scene.imageProcessingConfiguration.exposure = SCENE_EXPOSURE;        // <-- Full exposure
        scene.imageProcessingConfiguration.contrast = SCENE_CONTRAST;        // <-- Full contrast
        scene.imageProcessingConfiguration.toneMappingEnabled = true;        // <-- Enable tone mapping
        scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.94, 1);         // <-- Light grey background
        
        // ENABLE PC PERFORMANCE FEATURES
        scene.autoClear = true;                                              // <-- Auto clear for clarity
        scene.blockMaterialDirtyMechanism = false;                           // <-- Allow material updates
        scene.preventCacheWipeBetweenFrames = false;                         // <-- Normal cache behavior
        scene.performancePriority = BABYLON.ScenePerformancePriority.Aggressive; // <-- Aggressive optimization
        
        createSceneLighting();                                               // <-- Configure sun and ambient lighting
        createSceneEnvironment();                                            // <-- Generate skybox and ground plane
        
        console.log("PC-optimized 3D scene created successfully");           // <-- Log scene creation success
        
        // INITIALIZE MATERIAL LOGIC MODULE
        if (window.TrueVision3D?.MaterialLogic?.initialize) {
            window.TrueVision3D.MaterialLogic.initialize(scene)
                .then(initialized => {
                    if (initialized) {
                        console.log("✅ Material Logic module initialized successfully");
                    } else {
                        console.error("❌ Material Logic module failed to initialize");
                    }
                })
                .catch(error => {
                    console.error("❌ Material Logic initialization error:", error);
                });
        } else {
            console.error("❌ Material Logic module not available");
        }

        return scene;                                                        // <-- Return configured scene
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Configure PC Scene Lighting System
    // ---------------------------------------------------------------
    function createSceneLighting() {
        // CREATE DIRECTIONAL LIGHT FOR SUN SIMULATION
        sunLight = new BABYLON.DirectionalLight("sunLight", 
            new BABYLON.Vector3(0, -1, 0), scene);                          // <-- Directional light pointing down
        sunLight.position = new BABYLON.Vector3(20, 40, 20);                // <-- Position in 3D space
        sunLight.intensity = SUN_LIGHT_INTENSITY;                            // <-- Full light intensity
        
        // ENABLE PC LIGHTING FEATURES
        sunLight.shadowEnabled = true;                                       // <-- Enable shadows
        sunLight.shadowMinZ = 1;                                             // <-- Shadow near plane
        sunLight.shadowMaxZ = 100;                                           // <-- Shadow far plane
        
        // CREATE AMBIENT HEMISPHERIC LIGHT FOR FILL LIGHTING
        let hemiLight = new BABYLON.HemisphericLight("hemiLight", 
            new BABYLON.Vector3(0, 1, 0), scene);                           // <-- Hemispheric light pointing up
        hemiLight.intensity = AMBIENT_LIGHT_INTENSITY;                       // <-- Ambient light intensity
        
        console.log("PC scene lighting system configured");                  // <-- Log lighting setup
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create PC Environment with Configuration-Driven Settings
    // ---------------------------------------------------------------
    function createSceneEnvironment() {
        // GET ENVIRONMENT SETTINGS FROM CONFIG
        const appConfig = window.TrueVision3D?.AppConfig?.SceneConfig?.EnvironmentSettings;
        if (!appConfig) {
            console.error("❌ Environment settings not found in configuration");
            return;
        }
        
        const groundConfig = appConfig.GroundPlane;
        const skyboxConfig = appConfig.Skybox;
        const shadowConfig = appConfig.Shadows;
        
        // CONFIGURE PC ENVIRONMENT OPTIONS FROM CONFIG
        let envOptions = {
            createSkybox: skyboxConfig?.Skybox_Enabled === true,
            skyboxSize: skyboxConfig?.Skybox_Size || 1000,
            skyboxColor: skyboxConfig?.Skybox_Color ? 
                BABYLON.Color3.FromHexString(skyboxConfig.Skybox_Color) : 
                new BABYLON.Color3(0.75, 0.85, 0.95),
            createGround: groundConfig?.GroundPlane_Enabled === true,
            groundSize: groundConfig?.GroundPlane_Size || 1000,
            groundColor: groundConfig?.GroundPlane_Color ? 
                BABYLON.Color3.FromHexString(groundConfig.GroundPlane_Color) : 
                new BABYLON.Color3(0.85, 0.87, 0.85),
            enableGroundMirror: groundConfig?.GroundPlane_EnableMirror === true,
            groundYBias: groundConfig?.GroundPlane_YOffset || 0.0              // <-- CONFIG-DRIVEN GROUND HEIGHT
        };
        
        sceneEnvironment = scene.createDefaultEnvironment(envOptions);
        
        // CONFIGURE GROUND PLANE PROPERTIES FROM CONFIG
        if (sceneEnvironment.ground && groundConfig) {
            sceneEnvironment.ground.receiveShadows = groundConfig.GroundPlane_ReceiveShadows !== false;
            sceneEnvironment.ground.material.specularColor = new BABYLON.Color3(0, 0, 0);
        }
        
        // SETUP SHADOW GENERATION WITH CONFIG VALUES
        if (shadowConfig?.Shadows_Enabled === true) {
            const shadowMapSize = shadowConfig.Shadows_MapSize || 4096;
            shadowGenerator = new BABYLON.ShadowGenerator(shadowMapSize, sunLight);
            shadowGenerator.useExponentialShadowMap = true;
            shadowGenerator.useBlurExponentialShadowMap = shadowConfig.Shadows_BlurEnabled === true;
            shadowGenerator.blurScale = 2;
            shadowGenerator.blurBoxOffset = 1;
            shadowGenerator.setDarkness(shadowConfig.Shadows_Darkness || 0.2);
            shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
            shadowGenerator.contactHardeningLightSizeUVRatio = 0.05;
        }
        
        // STORE REFERENCES FOR MODEL LOADING
        scene.shadowGenerator = shadowGenerator;                             // <-- Store reference for later use
        scene.environment = sceneEnvironment;                                // <-- Store environment reference
        
        // INITIALIZE HDRI LIGHTING IF AVAILABLE
        if (window.TrueVision3D.SceneConfig && window.TrueVision3D.SceneConfig.HdriLightingLogic) {
            const hdriLogic = window.TrueVision3D.SceneConfig.HdriLightingLogic;
            const appConfig = window.TrueVision3D.AppConfig;                // <-- Get app configuration
            if (appConfig) {
                hdriLogic.initialize(scene, appConfig, sceneEnvironment);   // <-- Initialize with environment reference
            }
        }
        
        console.log("PC scene environment configured from JSON settings");
        console.log(`Ground Y offset: ${groundConfig?.GroundPlane_YOffset || 0.0}m`);
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | 3D Model Loading and Processing System
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Process Loaded Model Meshes
    // ------------------------------------------------------------
    function processLoadedMeshes() {
        // ADD ALL MESHES TO SHADOW CASTING SYSTEM
        scene.meshes.forEach(function (mesh) {
            if (mesh !== sceneEnvironment.ground) {                          // <-- Exclude ground from shadows
                shadowGenerator.addShadowCaster(mesh, true);                 // <-- Add mesh to shadow system
            }
        });
        
        // APPLY AUTO MATERIALS FIRST
        applyAutoMaterials();                                                // <-- Process and enhance materials
        
        // HANDLE CAMERA AGENT MARKERS BASED ON CONFIGURATION
        handleCameraAgentMarkers();                                          // <-- Manage camera agent visibility
        
        // REFRESH DEV TOOLS DETECTION AFTER MODELS LOADED
        if (window.TrueVision3D?.DevTools?.DebugMarkersManager) {
            window.TrueVision3D.DevTools.DebugMarkersManager.refreshCameraAgentDetection();
        }
        
        // THEN check if HDRI is active and update materials accordingly
        const hdriLogic = window.TrueVision3D?.SceneConfig?.HdriLightingLogic;
        if (hdriLogic && hdriLogic.getHdriState && hdriLogic.getHdriState().enabled) {
            setTimeout(() => {                                               // <-- Small delay to ensure materials are applied
                updateMaterialsForHdri();                                    // <-- Update materials for HDRI environment
            }, 100);
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Handle Camera Agent Markers Based on Configuration
    // ---------------------------------------------------------------
    function handleCameraAgentMarkers() {
        const appConfig = window.TrueVision3D?.AppConfig?.AppConfig;         // <-- Get app configuration
        if (!appConfig) return;                                              // <-- Exit if no config
        
        const showAgents = appConfig.devMode_CameraAgentMarkers !== false;   // <-- Get visibility setting
        const searchPattern = appConfig.devMode_CameraAgentMarkersPattern || "Camera_Agent_CAM"; // <-- Get search pattern
        
        let agentCount = 0;
        scene.meshes.forEach(mesh => {
            if (mesh.name && mesh.name.includes(searchPattern)) {
                mesh.isVisible = showAgents;                                 // <-- Set visibility based on config
                agentCount++;
                console.log(`Camera agent ${showAgents ? 'shown' : 'hidden'}:`, mesh.name);
            }
        });
        
        console.log(`Processed ${agentCount} camera agent markers`);
    }
    // ---------------------------------------------------------------

    // FUNCTION | Initialize CDN-Based Progressive Model Loading
    // ---------------------------------------------------------------
    async function initializeCdnModelLoading() {
        if (!window.TrueVisionCdnLoader) {
            console.error("❌ CRITICAL ERROR: CDN Model Loader not available - APPLICATION CANNOT CONTINUE");
            console.error("CDN loading is REQUIRED. Models must be loaded from CDN URLs defined in config JSON.");
            throw new Error("CDN Model Loader is required but not available");
        }
        
        // INITIALIZE CDN LOADER
        const cdnInitialized = await window.TrueVisionCdnLoader.initialize();
        if (!cdnInitialized) {
            console.error("❌ CRITICAL ERROR: CDN Loader initialization failed - APPLICATION CANNOT CONTINUE");
            console.error("CDN URLs from Data_-_MainAppConfig.json must be accessible.");
            throw new Error("CDN Loader initialization failed - check network/CORS configuration");
        }
        
        console.log("✅ CDN Model Loader initialized successfully - loading from config JSON URLs");
        
        // REGISTER MODEL LOADING CALLBACKS
        registerCdnModelCallbacks();                                         // <-- Setup event handlers
        
        // START PROGRESSIVE MODEL LOADING
        window.TrueVisionCdnLoader.startLoading(scene, null);                // <-- Begin CDN loading process
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Register CDN Model Loading Event Callbacks
    // ---------------------------------------------------------------
    function registerCdnModelCallbacks() {
        // HANDLE INDIVIDUAL MODEL LOADED EVENTS
        window.TrueVisionCdnLoader.onLoadEvent('model_loaded', (event) => {
            console.log(`CDN Model loaded: ${event.model.ModelType}`);
            
            // TRACK FURNITURE MESHES FOR VISIBILITY MANAGEMENT
            if (event.model.ModelType.includes("Furnishings")) {
                const meshCountBefore = furnitureMeshes.length;             // <-- Count before processing
                
                // FIND NEW MESHES ADDED BY THIS MODEL
                scene.meshes.forEach(mesh => {
                    if (!furnitureMeshes.includes(mesh) && 
                        mesh !== sceneEnvironment?.ground &&
                        !mesh.name?.includes("Camera_Agent")) {
                        furnitureMeshes.push(mesh);                          // <-- Add to furniture array
                        mesh.isVisible = furnishingsVisible;                 // <-- Apply visibility setting
                    }
                });
                
                const newMeshCount = furnitureMeshes.length - meshCountBefore;
                console.log(`Added ${newMeshCount} furniture meshes from ${event.model.ModelType}`);
            }
        });
        
        // HANDLE CRITICAL MODELS LOADED EVENT
        window.TrueVisionCdnLoader.onLoadEvent('critical_complete', (event) => {
            console.log("✅ Critical models loaded - preparing for user interaction");
            
            // PROCESS MESHES FIRST
            processLoadedMeshes();                                           // <-- Process all loaded meshes
            
            // SMALL DELAY TO ENSURE PROCESSING COMPLETES
            setTimeout(() => {
                // HIDE LOADING OVERLAY
                if (loadingOverlay) {
                    loadingOverlay.classList.add("hidden");                  // <-- Hide loading screen
                }
                
                // NOTIFY APPLICATION THAT INTERACTION CAN BE ENABLED
                window.dispatchEvent(new CustomEvent('modelsReadyForInteraction'));
                console.log("🔔 Models ready for interaction event dispatched");
            }, 100);                                                         // <-- 100ms delay
        });
        
        // HANDLE ALL MODELS LOADED EVENT
        window.TrueVisionCdnLoader.onLoadEvent('all_complete', (event) => {
            console.log("✅ All models loaded successfully");
            console.log(`Total loading time: ${event.loadingTime}ms`);
            
            // FINAL PROCESSING PASS
            processLoadedMeshes();                                           // <-- Ensure all meshes processed
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Material Processing and Enhancement System
// -----------------------------------------------------------------------------

    // FUNCTION | Automatically Detect and Enhance Material Properties
    // ------------------------------------------------------------
    function applyAutoMaterials() {
        if (window.TrueVision3D?.MaterialLogic?.applyAutoMaterials) {
            const success = window.TrueVision3D.MaterialLogic.applyAutoMaterials();
            console.log("Auto materials applied:", success ? "Success" : "Failed");
            return success;
        } else {
            console.error("❌ MaterialLogic.applyAutoMaterials not available");
            return false;
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | PC Render Effects Initialization and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize PC Post-Processing Render Effects
    // ------------------------------------------------------------
    function initializeRenderEffects(camera) {
        activeCamera = camera;                                               // <-- Store active camera reference
        
        // INITIALIZE SSAO AMBIENT OCCLUSION EFFECT WITH PC QUALITY
        if (ssaoEnabled && window.TrueVision3D && window.TrueVision3D.RenderEffects) {
            const ssaoEffect = window.TrueVision3D.RenderEffects.SsaoAmbientOcclusionEffect;
            if (ssaoEffect) {
                const initialized = ssaoEffect.initialize(scene, activeCamera, SSAO_QUALITY_DEFAULT);
                if (initialized) {
                    console.log("SSAO effect initialized successfully with PC quality");
                } else {
                    console.warn("SSAO effect failed to initialize");
                    ssaoEnabled = false;
                }
            }
        }
        
        return ssaoEnabled;
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Toggle SSAO Effect On/Off
    // ---------------------------------------------------------------
    function toggleSSAO() {
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (!ssaoEffect) return false;
        
        ssaoEnabled = !ssaoEnabled;
        ssaoEffect.setEnabled(ssaoEnabled);
        
        console.log("SSAO " + (ssaoEnabled ? "enabled" : "disabled"));
        return ssaoEnabled;
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Camera Switch for SSAO Update
    // ---------------------------------------------------------------
    function updateSSAOCamera(newCamera) {
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (!ssaoEffect || !ssaoEnabled) return;
        
        activeCamera = newCamera;
        
        if (ssaoEffect.updateCamera) {
            ssaoEffect.updateCamera(activeCamera);
            console.log("SSAO camera updated for new navigation mode");
        } else {
            console.warn("SSAO updateCamera method not available");
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Render Loop and Engine Management
// -----------------------------------------------------------------------------

    // FUNCTION | Start Continuous Render Loop
    // ------------------------------------------------------------
    function startRenderLoop() {
        engine.runRenderLoop(function () {
            if (scene && scene.activeCamera) {
                scene.render();
            }
        });
        
        console.log("PC render loop started");
    }
    // ---------------------------------------------------------------

    // FUNCTION | Stop Render Loop and Clean Up Resources
    // ---------------------------------------------------------------
    function stopRenderLoop() {
        if (engine) {
            engine.stopRenderLoop();
            console.log("Render loop stopped");
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Furnishings Visibility Management
// -----------------------------------------------------------------------------

    // FUNCTION | Toggle Furnishings Visibility
    // ------------------------------------------------------------
    function toggleFurnishings() {
        furnishingsVisible = !furnishingsVisible;
        
        furnitureMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {
                mesh.isVisible = furnishingsVisible;
            }
        });
        
        console.log(`Furnishings ${furnishingsVisible ? 'shown' : 'hidden'} (${furnitureMeshes.length} meshes)`);
        return furnishingsVisible;
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Furnishings Visibility State
    // ---------------------------------------------------------------
    function getFurnishingsVisibility() {
        return furnishingsVisible;
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Furnishings Visibility
    // ---------------------------------------------------------------
    function setFurnishingsVisibility(visible) {
        furnishingsVisible = visible;
        
        furnitureMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {
                mesh.isVisible = furnishingsVisible;
            }
        });
        
        console.log(`Furnishings set to ${furnishingsVisible ? 'visible' : 'hidden'}`);
        return furnishingsVisible;
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Interface for PC Rendering Pipeline
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Complete PC Rendering Pipeline
    // ------------------------------------------------------------
    function initialize(canvasElement, loadingElement, errorElement) {
        loadingOverlay = loadingElement;
        errorMessage = errorElement;
        
        initializeBabylonEngine(canvasElement);
        createScene();
        initializeCdnModelLoading();
        
        console.log("PC rendering pipeline initialized successfully");
        return { engine: engine, scene: scene, sunLight: sunLight };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Core Rendering System References
    // ---------------------------------------------------------------
    function getCoreReferences() {
        return {
            engine: engine,
            scene: scene,
            sunLight: sunLight,
            shadowGenerator: shadowGenerator,
            canvas: canvas
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Start Rendering and Initialize Effects
    // ---------------------------------------------------------------
    function startRendering(camera) {
        initializeRenderEffects(camera);
        startRenderLoop();
        
        return ssaoEnabled;
    }
    // ---------------------------------------------------------------

    // FUNCTION | Cleanup PC Rendering Pipeline Resources
    // ---------------------------------------------------------------
    function dispose() {
        stopRenderLoop();
        
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (ssaoEffect) {
            ssaoEffect.dispose();
        }
        
        const hdriLogic = window.TrueVision3D?.SceneConfig?.HdriLightingLogic;
        if (hdriLogic) {
            hdriLogic.dispose();
        }
        
        if (engine) {
            engine.dispose();
        }
        
        canvas = null;
        engine = null;
        scene = null;
        sunLight = null;
        shadowGenerator = null;
        sceneEnvironment = null;
        
        console.log("PC rendering pipeline disposed");
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export and Public Interface
// -----------------------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.RenderingPipeline = {
        initialize: initialize,
        getCoreReferences: getCoreReferences,
        startRendering: startRendering,
        toggleSSAO: toggleSSAO,
        updateSSAOCamera: updateSSAOCamera,
        updateMaterialsForHdri: updateMaterialsForHdri,
        restoreMaterialsFromHdri: restoreMaterialsFromHdri,
        toggleFurnishings: toggleFurnishings,
        getFurnishingsVisibility: getFurnishingsVisibility,
        setFurnishingsVisibility: setFurnishingsVisibility,
        dispose: dispose
    };

    // MARK MODULE AS LOADED
    if (window.TrueVision3D.ModuleDependencyManager) {
        window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('RenderingPipeline');
    }

    // DISPATCH EVENT TO NOTIFY THAT RENDERING PIPELINE IS LOADED
    window.dispatchEvent(new CustomEvent('renderingPipelineLoaded'));        // <-- Critical missing event!
    console.log("🔔 PC Rendering pipeline loaded event dispatched");

// endregion -------------------------------------------------------------------

})(); 