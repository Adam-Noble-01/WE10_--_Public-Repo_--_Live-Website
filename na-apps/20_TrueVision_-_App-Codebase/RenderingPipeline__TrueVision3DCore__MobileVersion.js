// =============================================================================
// TRUEVISION 3D RENDERING PIPELINE - MOBILE VERSION
// =============================================================================
//
// FILE       : RenderingPipeline__TrueVision3DCore__MobileVersion.js
// NAMESPACE  : TrueVision3D.RenderingPipeline
// MODULE     : 3D Scene Creation and Rendering Management - Mobile Optimized
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Mobile-optimized rendering pipeline with battery and performance considerations
// CREATED    : 2025
//
// DESCRIPTION:
// - Mobile-specific version with battery-safe GPU mode
// - Reduced quality settings for performance on mobile devices
// - iOS Safari compatibility with powerPreference: "default"
// - WebGL2 uniform buffer workarounds for iOS devices
// - Reduced texture sizes and simplified effects
// - Performance optimizations for limited mobile hardware
// - Touch-optimized interaction handling
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Split from unified pipeline for device-specific optimization
// - Mobile-specific optimizations and iOS compatibility fixes
// - Battery-safe power mode implementation
// - Reduced quality settings for mobile performance
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.RenderingPipeline = window.TrueVision3D.RenderingPipeline || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | MOBILE-SPECIFIC CONFIGURATION CONSTANTS
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Mobile Quality Settings
    // ------------------------------------------------------------
    const SHADOW_MAP_SIZE              = 1024;                               // <-- Reduced shadow resolution for mobile
    const SCENE_EXPOSURE               = 1.3;                                // <-- Slightly reduced exposure
    const SCENE_CONTRAST               = 1.1;                                // <-- Slightly reduced contrast
    const SUN_LIGHT_INTENSITY          = 2.0;                                // <-- Reduced lighting intensity
    const AMBIENT_LIGHT_INTENSITY      = 0.9;                                // <-- Increased ambient for visibility
    const ENABLE_SSAO_DEFAULT          = false;                              // <-- SSAO disabled by default on mobile
    const SSAO_QUALITY_DEFAULT         = "MOBILE";                           // <-- Mobile quality if enabled
    const SKYBOX_SIZE                  = 500;                                // <-- Smaller skybox for mobile
    const GROUND_SIZE                  = 500;                                // <-- Smaller ground plane
    const GROUND_OFFSET                = -0.5;                               // <-- Ground offset in meters
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Mobile Performance Settings
    // ------------------------------------------------------------
    const VALIDATE_BUILDING_MODEL      = true;                               // <-- Building model validation
    const FURNITURE_MODELS_OPTIONAL    = true;                               // <-- Furniture models optional
    const TEXTURE_OPTIMIZATION         = true;                               // <-- Enable texture optimization
    const MAX_TEXTURE_SIZE             = 2048;                               // <-- Limited texture resolution
    const TARGET_FPS                   = 30;                                 // <-- Target 30 FPS on mobile
    const MAX_MESHES_PER_FRAME         = 100;                               // <-- Limit active meshes
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Mobile Detection
    // ------------------------------------------------------------
    let isMobileDevice                 = false;                              // <-- Mobile device flag
    let isIOSDevice                    = false;                              // <-- iOS device flag
    let isAndroidDevice                = false;                              // <-- Android device flag
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
// REGION | MOBILE-SPECIFIC ENGINE INITIALIZATION
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Babylon.js Engine with Mobile-Optimized Settings
    // ------------------------------------------------------------
    function initializeBabylonEngine(canvasElement) {
        canvas = canvasElement;                                              // <-- Store canvas reference
        
        // DETECT MOBILE AND IOS DEVICES
        const userAgent = navigator.userAgent.toLowerCase();
        isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        isAndroidDevice = /android/.test(userAgent);
        
        console.log(`Mobile device detected: ${isMobileDevice}, iOS: ${isIOSDevice}, Android: ${isAndroidDevice}`);
        
        // MOBILE-SPECIFIC ENGINE OPTIONS
        const engineOptions = {
            preserveDrawingBuffer: true,
            stencil: true,
            powerPreference: "default",                                      // <-- CRITICAL: Battery-safe mode for mobile
            antialias: false,                                                // <-- Disable antialiasing for performance
            alpha: false,                                                    // <-- No alpha for better performance
            depth: true,                                                     // <-- Enable depth buffer
            premultipliedAlpha: false,                                       // <-- Better color accuracy
            failIfMajorPerformanceCaveat: true,                            // <-- Fail if major performance issues
            doNotHandleContextLost: false,                                   // <-- Handle context lost
            audioEngine: false,                                              // <-- Disable audio to save resources
            disableWebGL2Support: false,                                     // <-- Try to use WebGL2 if available
            deterministicLockstep: true,                                     // <-- Ensure consistent frame timing
            timeStep: 1/TARGET_FPS                                           // <-- Target 30 FPS on mobile
        };
        
        engine = new BABYLON.Engine(canvas, true, engineOptions);           // <-- Create engine with mobile options
        
        // IOS-SPECIFIC WEBGL2 WORKAROUNDS
        if (isIOSDevice) {
            engine.disableUniformBuffers = true;                            // <-- Disable uniform buffers on iOS
            console.log("iOS detected - uniform buffers disabled for compatibility");
            
            // Additional iOS-specific settings
            engine.disableVertexArrayObjects = false;                       // <-- Keep VAO enabled
            engine.forcePOTTextures = true;                                 // <-- Force power-of-two textures
        }
        
        // MOBILE-SPECIFIC ENGINE SETTINGS
        engine.enableOfflineSupport = false;                                 // <-- Disable offline support
        engine.doNotHandleContextLost = false;                              // <-- Handle WebGL context loss
        engine.loadingUIBackgroundColor = "#f0f0f0";                        // <-- Light loading background
        
        // SET HARDWARE SCALING FOR PERFORMANCE
        if (window.devicePixelRatio > 2) {
            engine.setHardwareScalingLevel(2);                              // <-- Limit scaling on high DPI
            console.log("Hardware scaling limited for high DPI mobile display");
        }
        
        // MOBILE PERFORMANCE OPTIMIZATIONS
        engine.enableUniformBuffers = !isIOSDevice;                         // <-- Use uniform buffers except on iOS
        engine.useReverseDepthBuffer = false;                               // <-- Disable for mobile compatibility
        
        // DISABLE BABYLON.JS DEFAULT LOADING SCREEN
        engine.loadingScreen = {
            displayLoadingUI: function () { },                               // <-- Empty display function
            hideLoadingUI: function () { }                                   // <-- Empty hide function
        };
        
        // HANDLE WINDOW RESIZE EVENTS WITH DEBOUNCING
        let resizeTimeout;
        window.addEventListener("resize", function () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                engine.resize();                                             // <-- Resize engine after delay
            }, 250);                                                        // <-- 250ms debounce
        });
        
        // HANDLE ORIENTATION CHANGES
        window.addEventListener("orientationchange", function() {
            setTimeout(() => {
                engine.resize();                                             // <-- Resize after orientation settles
            }, 500);
        });
        
        console.log("Babylon.js mobile engine initialized with battery-safe mode");
        return engine;                                                       // <-- Return engine reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Create Mobile-Optimized Scene
    // ------------------------------------------------------------
    function createScene() {
        scene = new BABYLON.Scene(engine);                                   // <-- Initialize new Babylon.js scene
        
        // MOBILE-OPTIMIZED SCENE SETTINGS
        scene.imageProcessingConfiguration.exposure = SCENE_EXPOSURE;        // <-- Reduced exposure
        scene.imageProcessingConfiguration.contrast = SCENE_CONTRAST;        // <-- Reduced contrast
        scene.imageProcessingConfiguration.toneMappingEnabled = false;       // <-- Disable tone mapping on mobile
        scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.94, 1);         // <-- Light grey background
        
        // MOBILE PERFORMANCE OPTIMIZATIONS
        scene.autoClear = true;                                              // <-- Auto clear for performance
        scene.blockMaterialDirtyMechanism = true;                            // <-- Reduce material updates
        scene.preventCacheWipeBetweenFrames = true;                         // <-- Keep cache between frames
        scene.performancePriority = BABYLON.ScenePerformancePriority.BackwardCompatible; // <-- Compatibility mode
        
        // LIMIT ACTIVE MESHES FOR MOBILE
        scene.setActiveMeshCandidateProvider(function() {
            const cameraPosition = scene.activeCamera ? scene.activeCamera.position : BABYLON.Vector3.Zero();
            return scene.meshes.filter(mesh => {
                if (!mesh.isVisible || !mesh.isEnabled()) return false;
                
                // Calculate distance from camera
                const distance = mesh.getBoundingInfo().boundingSphere.centerWorld.subtract(cameraPosition).length();
                
                // Only include nearby meshes (within 100 units)
                return distance < 100;
            }).slice(0, MAX_MESHES_PER_FRAME);                             // <-- Limit mesh count
        });
        
        // DISABLE EXPENSIVE FEATURES ON MOBILE
        scene.fogMode = BABYLON.Scene.FOGMODE_NONE;                         // <-- No fog for performance
        scene.audioEnabled = false;                                          // <-- Disable audio
        
        createSceneLighting();                                               // <-- Configure mobile lighting
        createSceneEnvironment();                                            // <-- Generate mobile environment
        
        console.log("Mobile-optimized 3D scene created");                    // <-- Log scene creation
        
        // Initialize Material Logic Module with mobile settings
        if (window.TrueVision3D?.MaterialLogic?.initialize) {
            window.TrueVision3D.MaterialLogic.initialize(scene, { 
                isMobile: true,
                maxTextureSize: MAX_TEXTURE_SIZE,
                optimizeTextures: TEXTURE_OPTIMIZATION
            })
            .then(initialized => {
                if (initialized) {
                    console.log("✅ Material Logic module initialized with mobile settings");
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

    // SUB FUNCTION | Configure Mobile Scene Lighting System
    // ---------------------------------------------------------------
    function createSceneLighting() {
        // CREATE DIRECTIONAL LIGHT FOR SUN SIMULATION
        sunLight = new BABYLON.DirectionalLight("sunLight", 
            new BABYLON.Vector3(0, -1, 0), scene);                          // <-- Directional light pointing down
        sunLight.position = new BABYLON.Vector3(20, 40, 20);                // <-- Position in 3D space
        sunLight.intensity = SUN_LIGHT_INTENSITY;                            // <-- Reduced light intensity
        
        // MOBILE LIGHTING OPTIMIZATIONS
        sunLight.shadowEnabled = true;                                       // <-- Enable shadows but reduced quality
        sunLight.shadowMinZ = 1;                                             // <-- Shadow near plane
        sunLight.shadowMaxZ = 50;                                            // <-- Reduced shadow far plane
        
        // CREATE AMBIENT HEMISPHERIC LIGHT FOR FILL LIGHTING
        let hemiLight = new BABYLON.HemisphericLight("hemiLight", 
            new BABYLON.Vector3(0, 1, 0), scene);                           // <-- Hemispheric light pointing up
        hemiLight.intensity = AMBIENT_LIGHT_INTENSITY;                       // <-- Increased ambient for mobile
        
        console.log("Mobile scene lighting system configured");              // <-- Log lighting setup
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Mobile Environment with Reduced Quality
    // ---------------------------------------------------------------
    function createSceneEnvironment() {
        // CONFIGURE MOBILE ENVIRONMENT OPTIONS
        let envOptions = {
            createSkybox: true,                                              // <-- Enable skybox creation
            skyboxSize: SKYBOX_SIZE,                                         // <-- Smaller skybox dimensions
            skyboxColor: new BABYLON.Color3(0.75, 0.85, 0.95),              // <-- Light blue sky color
            createGround: true,                                              // <-- Enable ground plane
            groundSize: GROUND_SIZE,                                         // <-- Smaller ground dimensions
            groundColor: new BABYLON.Color3(0.85, 0.87, 0.85),              // <-- Light grey ground color
            enableGroundMirror: false,                                       // <-- No ground mirror on mobile
            groundYBias: GROUND_OFFSET                                       // <-- Ground offset
        };
        
        sceneEnvironment = scene.createDefaultEnvironment(envOptions);       // <-- Create environment
        
        // CONFIGURE GROUND PLANE PROPERTIES
        if (sceneEnvironment.ground) {
            sceneEnvironment.ground.receiveShadows = true;                   // <-- Enable shadow reception
            sceneEnvironment.ground.material.specularColor = new BABYLON.Color3(0, 0, 0); // <-- No specular
            sceneEnvironment.ground.material.roughness = 1;                  // <-- Full roughness for mobile
        }
        
        // SETUP MOBILE-OPTIMIZED SHADOW GENERATION
        shadowGenerator = new BABYLON.ShadowGenerator(SHADOW_MAP_SIZE, sunLight); // <-- Create shadow generator
        shadowGenerator.useExponentialShadowMap = true;                      // <-- Use exponential shadow mapping
        shadowGenerator.useBlurExponentialShadowMap = false;                 // <-- No blur on mobile
        shadowGenerator.setDarkness(0.3);                                    // <-- Lighter shadows on mobile
        
        // MOBILE SHADOW QUALITY SETTINGS
        shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW; // <-- Low quality filtering
        shadowGenerator.frustumEdgeFalloff = 0;                              // <-- No edge falloff
        
        // STORE REFERENCES FOR MODEL LOADING
        scene.shadowGenerator = shadowGenerator;                             // <-- Store reference for later use
        scene.environment = sceneEnvironment;                                // <-- Store environment reference
        
        // INITIALIZE HDRI LIGHTING IF AVAILABLE (WITH MOBILE SETTINGS)
        if (window.TrueVision3D.SceneConfig && window.TrueVision3D.SceneConfig.HdriLightingLogic) {
            const hdriLogic = window.TrueVision3D.SceneConfig.HdriLightingLogic;
            const appConfig = window.TrueVision3D.AppConfig;                // <-- Get app configuration
            if (appConfig) {
                // Override HDRI settings for mobile
                const mobileHdriConfig = {
                    ...appConfig,
                    SceneConfig: {
                        ...appConfig.SceneConfig,
                        LightingConfig: {
                            ...appConfig.SceneConfig.LightingConfig,
                            LightingCfg_HdrirBrightnessFactor: 0.3,         // <-- Reduced brightness on mobile
                            LightingCfg_HdriLighting: false                  // <-- Consider disabling HDRI on mobile
                        }
                    }
                };
                hdriLogic.initialize(scene, mobileHdriConfig, sceneEnvironment);
            }
        }
        
        console.log("Mobile scene environment and shadow system configured"); // <-- Log environment setup
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | 3D Model Loading and Processing System
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Process Loaded Model Meshes
    // ------------------------------------------------------------
    function processLoadedMeshes() {
        // ADD ALL MESHES TO SHADOW CASTING SYSTEM (LIMITED FOR MOBILE)
        let shadowCasterCount = 0;
        const maxShadowCasters = 20;                                         // <-- Limit shadow casters on mobile
        
        scene.meshes.forEach(function (mesh) {
            if (mesh !== sceneEnvironment.ground && shadowCasterCount < maxShadowCasters) {
                shadowGenerator.addShadowCaster(mesh, false);                // <-- Add mesh without children
                shadowCasterCount++;
            }
        });
        
        console.log(`Added ${shadowCasterCount} shadow casters (mobile limit: ${maxShadowCasters})`);
        
        // APPLY AUTO MATERIALS WITH MOBILE OPTIMIZATION
        applyAutoMaterials();                                                // <-- Process and enhance materials
        
        // HANDLE CAMERA AGENT MARKERS BASED ON CONFIGURATION
        handleCameraAgentMarkers();                                          // <-- Manage camera agent visibility
        
        // CHECK IF HDRI IS ACTIVE (USUALLY DISABLED ON MOBILE)
        const hdriLogic = window.TrueVision3D?.SceneConfig?.HdriLightingLogic;
        if (hdriLogic && hdriLogic.getHdriState && hdriLogic.getHdriState().enabled) {
            setTimeout(() => {
                updateMaterialsForHdri();                                    // <-- Update materials for HDRI
            }, 100);
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Handle Camera Agent Markers Based on Configuration
    // ---------------------------------------------------------------
    function handleCameraAgentMarkers() {
        const appConfig = window.TrueVision3D?.AppConfig?.AppConfig;
        if (!appConfig) return;
        
        const showAgents = appConfig.devMode_CameraAgentMarkers !== false;
        const searchPattern = appConfig.devMode_CameraAgentMarkersPattern || "Camera_Agent_CAM";
        
        let agentCount = 0;
        scene.meshes.forEach(mesh => {
            if (mesh.name && mesh.name.includes(searchPattern)) {
                mesh.isVisible = showAgents;
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
        
        // INITIALIZE CDN LOADER WITH MOBILE SETTINGS
        const cdnInitialized = await window.TrueVisionCdnLoader.initialize({
            isMobile: true,
            maxRetryAttempts: 2,                                             // <-- Fewer retries on mobile
            retryDelayMs: 2000                                               // <-- Longer delay between retries
        });
        
        if (!cdnInitialized) {
            console.error("❌ CRITICAL ERROR: CDN Loader initialization failed - APPLICATION CANNOT CONTINUE");
            console.error("CDN URLs from Data_-_MainAppConfig.json must be accessible.");
            throw new Error("CDN Loader initialization failed - check network/CORS configuration");
        }
        
        console.log("✅ CDN Model Loader initialized successfully for mobile");
        
        // REGISTER MODEL LOADING CALLBACKS
        registerCdnModelCallbacks();
        
        // START PROGRESSIVE MODEL LOADING
        window.TrueVisionCdnLoader.startLoading(scene, null);
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
                const meshCountBefore = furnitureMeshes.length;
                
                scene.meshes.forEach(mesh => {
                    if (!furnitureMeshes.includes(mesh) && 
                        mesh !== sceneEnvironment?.ground &&
                        !mesh.name?.includes("Camera_Agent")) {
                        furnitureMeshes.push(mesh);
                        mesh.isVisible = furnishingsVisible;
                    }
                });
                
                const newMeshCount = furnitureMeshes.length - meshCountBefore;
                console.log(`Added ${newMeshCount} furniture meshes from ${event.model.ModelType}`);
            }
        });
        
        // HANDLE CRITICAL MODELS LOADED EVENT
        window.TrueVisionCdnLoader.onLoadEvent('critical_complete', (event) => {
            console.log("✅ Critical models loaded - enabling user interaction");
            processLoadedMeshes();
            
            // HIDE LOADING OVERLAY
            if (loadingOverlay) {
                loadingOverlay.classList.add("hidden");
            }
            
            // NOTIFY APPLICATION THAT INTERACTION CAN BE ENABLED
            window.dispatchEvent(new CustomEvent('modelsReadyForInteraction'));
        });
        
        // HANDLE ALL MODELS LOADED EVENT
        window.TrueVisionCdnLoader.onLoadEvent('all_complete', (event) => {
            console.log("✅ All models loaded successfully");
            console.log(`Total loading time: ${event.loadingTime}ms`);
            
            processLoadedMeshes();
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
            const success = window.TrueVision3D.MaterialLogic.applyAutoMaterials({
                isMobile: true,
                reduceTextureQuality: true,
                maxTextureSize: MAX_TEXTURE_SIZE
            });
            console.log("Auto materials applied with mobile settings:", success ? "Success" : "Failed");
            return success;
        } else {
            console.error("❌ MaterialLogic.applyAutoMaterials not available");
            return false;
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Mobile Render Effects Initialization and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Mobile Post-Processing Render Effects
    // ------------------------------------------------------------
    function initializeRenderEffects(camera) {
        activeCamera = camera;
        
        // SSAO USUALLY DISABLED ON MOBILE BUT CAN BE ENABLED
        if (ssaoEnabled && window.TrueVision3D && window.TrueVision3D.RenderEffects) {
            const ssaoEffect = window.TrueVision3D.RenderEffects.SsaoAmbientOcclusionEffect;
            if (ssaoEffect) {
                // Force mobile quality for SSAO
                const initialized = ssaoEffect.initialize(scene, activeCamera, "MOBILE");
                if (initialized) {
                    console.log("SSAO effect initialized with mobile quality");
                } else {
                    console.warn("SSAO effect failed to initialize on mobile");
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
        
        // WARN ABOUT PERFORMANCE ON MOBILE
        if (isMobileDevice && !ssaoEnabled) {
            console.warn("Enabling SSAO on mobile may impact performance and battery life");
        }
        
        ssaoEnabled = !ssaoEnabled;
        ssaoEffect.setEnabled(ssaoEnabled);
        
        console.log("SSAO " + (ssaoEnabled ? "enabled" : "disabled") + " on mobile");
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

    // FUNCTION | Start Mobile-Optimized Render Loop
    // ------------------------------------------------------------
    function startRenderLoop() {
        // MOBILE FRAME RATE LIMITING
        let lastRenderTime = 0;
        const targetFrameTime = 1000 / TARGET_FPS;                          // <-- Target 30 FPS
        
        engine.runRenderLoop(function () {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastRenderTime;
            
            // LIMIT FRAME RATE ON MOBILE
            if (deltaTime >= targetFrameTime) {
                if (scene && scene.activeCamera) {
                    scene.render();
                }
                lastRenderTime = currentTime;
            }
        });
        
        console.log("Mobile render loop started with FPS limiting");
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
// REGION | Public API Interface for Mobile Rendering Pipeline
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Complete Mobile Rendering Pipeline
    // ------------------------------------------------------------
    function initialize(canvasElement, loadingElement, errorElement) {
        loadingOverlay = loadingElement;
        errorMessage = errorElement;
        
        initializeBabylonEngine(canvasElement);
        createScene();
        initializeCdnModelLoading();
        
        console.log("Mobile rendering pipeline initialized successfully");
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
            canvas: canvas,
            isMobile: isMobileDevice,
            isIOS: isIOSDevice
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

    // FUNCTION | Cleanup Mobile Rendering Pipeline Resources
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
        
        console.log("Mobile rendering pipeline disposed");
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

// endregion -------------------------------------------------------------------

})(); 