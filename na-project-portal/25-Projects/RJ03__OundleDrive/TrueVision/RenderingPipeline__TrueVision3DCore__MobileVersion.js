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

console.log("🚀 Mobile Rendering Pipeline script loading...");

(function() {
'use strict';

try {  // Wrap entire module in try-catch for error detection

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
            failIfMajorPerformanceCaveat: false,                            // <-- Allow mobile to work with performance caveats
            doNotHandleContextLost: false,                                   // <-- Handle context lost
            audioEngine: false,                                              // <-- Disable audio to save resources
            disableWebGL2Support: false                                      // <-- Try to use WebGL2 if available
            // REMOVED: deterministicLockstep and timeStep - these can cause issues
        };
        
        // MOBILE ENGINE CREATION WITH ERROR HANDLING
        try {
            engine = new BABYLON.Engine(canvas, true, engineOptions);       // <-- Create engine with mobile options
            console.log("✅ Mobile Babylon.js engine created successfully");
        } catch (error) {
            console.error("❌ Failed to create mobile engine:", error);
            
            // FALLBACK TO MINIMAL ENGINE OPTIONS
            const fallbackOptions = {
                preserveDrawingBuffer: false,
                stencil: false,
                powerPreference: "default",
                antialias: false,
                alpha: false,
                depth: true,
                premultipliedAlpha: false,
                failIfMajorPerformanceCaveat: false,
                doNotHandleContextLost: false,
                audioEngine: false,
                disableWebGL2Support: true                                   // <-- Force WebGL1 as fallback
            };
            
            try {
                engine = new BABYLON.Engine(canvas, true, fallbackOptions);
                console.log("✅ Mobile engine created with fallback options (WebGL1)");
            } catch (fallbackError) {
                console.error("❌ Mobile engine creation failed completely:", fallbackError);
                throw new Error("Mobile WebGL initialization failed - device may not support required features");
            }
        }
        
        // MOBILE DEVICE DETECTION AND CONFIGURATION
        if (isIOSDevice) {
            engine.disableUniformBuffers = true;                            // <-- Disable uniform buffers on iOS
            engine.disableVertexArrayObjects = false;                       // <-- Keep VAO enabled
            engine.forcePOTTextures = true;                                 // <-- Force power-of-two textures
            console.log("iOS detected - applied iOS-specific optimizations");
        } else if (isAndroidDevice) {
            engine.disableUniformBuffers = false;                           // <-- Try uniform buffers on Android
            engine.disableVertexArrayObjects = false;                       // <-- Keep VAO enabled
            engine.forcePOTTextures = false;                                // <-- Allow NPOT textures on Android
            console.log("Android detected - applied Android-specific optimizations");
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
        
        // ADD WEBGL CONTEXT LOST HANDLING FOR MOBILE
        canvas.addEventListener("webglcontextlost", function(event) {
            event.preventDefault();
            console.warn("WebGL context lost - attempting recovery");
        }, false);
        
        canvas.addEventListener("webglcontextrestored", function() {
            console.log("WebGL context restored");
            engine.initializeContextObjects();
            engine.resize();
        }, false);
        
        console.log("Babylon.js mobile engine initialized with battery-safe mode");
        
        // INITIALIZE ADVANCED MOBILE POWER MANAGEMENT
        setupMobilePowerManagement();
        
        return engine;                                                       // <-- Return engine reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Setup Advanced Mobile Power Management
    // ---------------------------------------------------------------
    function setupMobilePowerManagement() {
        // DETECT BATTERY STATUS (if available)
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                // MONITOR BATTERY LEVEL
                function updateBatteryStatus() {
                    const batteryLevel = battery.level * 100;                // <-- Percentage
                    const isCharging = battery.charging;
                    
                    if (batteryLevel < 20 && !isCharging) {
                        // CRITICAL BATTERY MODE
                        enableCriticalPowerSaving();
                    } else if (batteryLevel < 40 && !isCharging) {
                        // LOW BATTERY MODE
                        enableLowPowerMode();
                    } else {
                        // NORMAL MODE
                        disablePowerSaving();
                    }
                }
                
                // LISTEN FOR BATTERY CHANGES
                battery.addEventListener('levelchange', updateBatteryStatus);
                battery.addEventListener('chargingchange', updateBatteryStatus);
                updateBatteryStatus();                                        // <-- Initial check
            }).catch(err => {
                console.log("Battery API not available:", err);
            });
        }
        
        // VISIBILITY-BASED OPTIMIZATIONS
        document.addEventListener('visibilitychange', () => {
            if (!engine || !scene) return;
            
            if (document.hidden) {
                // PAGE IS HIDDEN - AGGRESSIVE POWER SAVING
                engine.stopRenderLoop();                                      // <-- Stop rendering
                scene.audioEnabled = false;                                  // <-- Disable audio
                
                // PAUSE ANIMATIONS
                scene.animationPropertiesOverride = scene.animationPropertiesOverride || new BABYLON.AnimationPropertiesOverride();
                scene.animationPropertiesOverride.enableBlending = false;
                scene.stopAllAnimations();
            } else {
                // PAGE IS VISIBLE - RESUME
                engine.runRenderLoop(() => {
                    if (scene && scene.activeCamera) {
                        scene.render();
                    }
                });
                
                // RESUME ANIMATIONS IF ENABLED
                if (scene.animationPropertiesOverride) {
                    scene.animationPropertiesOverride.enableBlending = true;
                }
            }
        });
        
        // MONITOR FOCUS STATE
        window.addEventListener('focus', () => {
            if (engine && scene) {
                // WINDOW HAS FOCUS - NORMAL RENDERING
                engine.setHardwareScalingLevel(1.0);                         // <-- Full resolution
            }
        });
        
        window.addEventListener('blur', () => {
            if (engine && scene) {
                // WINDOW LOST FOCUS - REDUCE QUALITY
                engine.setHardwareScalingLevel(1.5);                         // <-- Lower resolution
            }
        });
        
        // MONITOR THERMAL STATE (if available)
        if ('thermalState' in navigator) {
            // Future API for thermal monitoring
            console.log("Thermal state monitoring available");
        }
        
        // WAKE LOCK API - Prevent screen dimming during active 3D viewing
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
            navigator.wakeLock.request('screen').then(wakeLock => {
                console.log("Wake lock acquired - screen won't dim");
                
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && !wakeLock.released) {
                        // Re-acquire wake lock when page becomes visible
                        navigator.wakeLock.request('screen');
                    }
                });
            }).catch(err => {
                console.log("Wake lock not available:", err);
            });
        }
        
        // NETWORK INFORMATION API - Adjust quality based on connection
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            function adjustForNetworkQuality() {
                const effectiveType = connection.effectiveType;
                console.log("Network quality:", effectiveType);
                
                if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                    // Very poor connection - minimize texture loading
                    console.log("Poor network detected - reducing texture quality");
                    MAX_TEXTURE_SIZE = 512;
                } else if (effectiveType === '3g') {
                    // Moderate connection
                    MAX_TEXTURE_SIZE = 1024;
                }
            }
            
            connection.addEventListener('change', adjustForNetworkQuality);
            adjustForNetworkQuality();
        }
        
        // MEMORY PRESSURE HANDLING
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
                
                if (usageRatio > 0.9) {
                    console.warn("High memory usage detected:", (usageRatio * 100).toFixed(1) + "%");
                    // Trigger texture cleanup
                    if (scene) {
                        scene.cleanCachedTextureBuffer();
                    }
                }
            }, 30000); // Check every 30 seconds
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Critical Power Saving Mode
    // ---------------------------------------------------------------
    function enableCriticalPowerSaving() {
        if (!engine || !scene) return;
        
        console.log("🔋 CRITICAL BATTERY: Enabling aggressive power saving");
        
        // REDUCE RENDER RESOLUTION
        engine.setHardwareScalingLevel(2.0);                                 // <-- 50% resolution
        
        // REDUCE FPS TARGET (Babylon.js doesn't have direct FPS control, but we can throttle)
        if (engine._fps) {
            engine._fps = 30;                                                // <-- Internal FPS target
        }
        
        // DISABLE EXPENSIVE EFFECTS
        if (scene.postProcessManager) {
            scene.postProcessManager.dispose();                              // <-- Remove post-processing
        }
        
        // DISABLE SSAO IF ACTIVE
        if (ssaoEnabled && window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect) {
            window.TrueVision3D.RenderEffects.SsaoAmbientOcclusionEffect.disable();
            ssaoEnabled = false;
        }
        
        // REDUCE TEXTURE QUALITY
        scene.textures.forEach(texture => {
            if (texture.updateSamplingMode) {
                texture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);
            }
        });
        
        // DISABLE SHADOWS
        if (shadowGenerator) {
            shadowGenerator.dispose();
            shadowGenerator = null;
        }
        
        // REDUCE MESH CULLING DISTANCE
        MAX_MESHES_PER_FRAME = 10;                                          // <-- Show fewer meshes
        
        // SET GLOBAL FLAG
        window.TrueVision3D._powerMode = 'critical';
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Low Power Mode
    // ---------------------------------------------------------------
    function enableLowPowerMode() {
        if (!engine || !scene) return;
        
        console.log("🔋 LOW BATTERY: Enabling power saving mode");
        
        // MODERATE RESOLUTION REDUCTION
        engine.setHardwareScalingLevel(1.5);                                 // <-- 75% resolution
        
        // REDUCE SHADOW QUALITY
        if (shadowGenerator) {
            shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
            shadowGenerator.useBlurExponentialShadowMap = false;
        }
        
        // REDUCE MESH CULLING DISTANCE
        MAX_MESHES_PER_FRAME = 20;                                          // <-- Show fewer meshes
        
        // SET GLOBAL FLAG
        window.TrueVision3D._powerMode = 'low';
    }
    // ---------------------------------------------------------------

    // FUNCTION | Disable Power Saving Mode
    // ---------------------------------------------------------------
    function disablePowerSaving() {
        if (!engine || !scene) return;
        
        console.log("🔋 NORMAL BATTERY: Disabling power saving");
        
        // RESTORE FULL QUALITY
        engine.setHardwareScalingLevel(1.0);                                 // <-- Full resolution
        
        // RESTORE SHADOW QUALITY IF AVAILABLE
        if (shadowGenerator) {
            shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW; // Still low on mobile
        }
        
        // RESTORE MESH CULLING
        MAX_MESHES_PER_FRAME = 50;                                          // <-- Normal mobile limit
        
        // SET GLOBAL FLAG
        window.TrueVision3D._powerMode = 'normal';
    }
    // ---------------------------------------------------------------

    // FUNCTION | Create Mobile-Optimized Scene
    // ---------------------------------------------------------------
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
        
        // FIX: Check if ScenePerformancePriority exists before using it
        if (BABYLON.ScenePerformancePriority) {
            scene.performancePriority = BABYLON.ScenePerformancePriority.BackwardCompatible;
        } else {
            console.warn("ScenePerformancePriority not available in this Babylon.js version");
            // Set equivalent optimizations manually
            scene.skipFrustumClipping = false;
            scene.skipPointerMovePicking = false;
            scene.autoClearDepthAndStencil = false;
        }
        
        // MOBILE MESH CULLING OPTIMIZATION
        scene.onBeforeRenderObservable.add(() => {
            if (scene.activeCamera && MAX_MESHES_PER_FRAME > 0) {
                const cameraPosition = scene.activeCamera.position;
                let activeMeshCount = 0;
                
                // Simple distance-based culling for mobile performance
                scene.meshes.forEach(mesh => {
                    if (mesh === sceneEnvironment?.ground || mesh.name?.includes("Camera_Agent")) {
                        return; // Skip ground and camera agents
                    }
                    
                    if (activeMeshCount < MAX_MESHES_PER_FRAME) {
                        const distance = BABYLON.Vector3.Distance(mesh.position, cameraPosition);
                        mesh.isVisible = distance < 100; // Only show meshes within 100 units
                        if (mesh.isVisible) activeMeshCount++;
                    } else {
                        mesh.isVisible = false; // Hide excess meshes
                    }
                });
            }
        });
        
        // DISABLE EXPENSIVE FEATURES ON MOBILE
        scene.fogMode = BABYLON.Scene.FOGMODE_NONE;                         // <-- No fog for performance
        scene.audioEnabled = false;                                          // <-- Disable audio
        
        createSceneLighting();                                               // <-- Configure mobile lighting
        createSceneEnvironment();                                            // <-- Generate mobile environment
        
        console.log("Mobile-optimized 3D scene created");                    // <-- Log scene creation
        
        // SIMPLIFIED MATERIAL LOGIC INITIALIZATION
        if (window.TrueVision3D?.MaterialLogic?.initialize) {
            try {
                window.TrueVision3D.MaterialLogic.initialize(scene, { 
                    isMobile: true,
                    maxTextureSize: MAX_TEXTURE_SIZE,
                    optimizeTextures: TEXTURE_OPTIMIZATION
                });
                console.log("✅ Material Logic module initialized with mobile settings");
            } catch (error) {
                console.warn("⚠️ Material Logic initialization failed:", error);
            }
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

    // SUB FUNCTION | Create Mobile Environment with Configuration-Driven Settings
    // ---------------------------------------------------------------
    function createSceneEnvironment() {
        // DEBUG: Check configuration availability
        console.log("🔍 DEBUG: Checking mobile configuration...");
        console.log("window.TrueVision3D?.AppConfig:", window.TrueVision3D?.AppConfig);
        
        // GET ENVIRONMENT SETTINGS FROM CONFIG
        const envConfig = window.TrueVision3D?.AppConfig?.SceneConfig?.EnvironmentSettings;
        
        console.log("🔍 DEBUG: Mobile environment config:", envConfig);
        
        // GET INDIVIDUAL SECTIONS (with fallbacks for missing sections)
        const groundConfig = envConfig?.GroundPlane || {};
        const skyboxConfig = envConfig?.Skybox || {};              // <-- Empty object if missing
        const shadowConfig = envConfig?.Shadows || {};             // <-- Empty object if missing
        
        console.log("🔍 DEBUG: Mobile ground config:", groundConfig);
        console.log("🔍 DEBUG: Mobile ground Y offset:", groundConfig?.GroundPlane_YOffset);
        
        // CALCULATE FINAL VALUES WITH PROPER FALLBACKS
        const finalGroundOffset = groundConfig?.GroundPlane_YOffset !== undefined ? 
            groundConfig.GroundPlane_YOffset : GROUND_OFFSET;
            
        const finalGroundSize = envConfig?.GroundPlane_SizeMobile || 
                               envConfig?.GroundPlane_Size || GROUND_SIZE;
        const finalSkyboxSize = envConfig?.Skybox_SizeMobile || 
                               envConfig?.Skybox_Size || SKYBOX_SIZE;
        
        // CONFIGURE MOBILE ENVIRONMENT OPTIONS
        let envOptions = {
            createSkybox: skyboxConfig?.Skybox_Enabled !== false,               // <-- Default to true
            skyboxSize: finalSkyboxSize,
            skyboxColor: skyboxConfig?.Skybox_Color ? 
                BABYLON.Color3.FromHexString(skyboxConfig.Skybox_Color) : 
                new BABYLON.Color3(0.75, 0.85, 0.95),
            createGround: groundConfig?.GroundPlane_Enabled !== false,          // <-- Default to true
            groundSize: finalGroundSize,
            groundColor: groundConfig?.GroundPlane_Color ? 
                BABYLON.Color3.FromHexString(groundConfig.GroundPlane_Color) : 
                new BABYLON.Color3(0.85, 0.87, 0.85),
            enableGroundMirror: false,                                          // <-- Always false on mobile
            groundYBias: finalGroundOffset                                      // <-- YOUR -10.0 VALUE
        };
        
        console.log("🔍 Final mobile environment options:", envOptions);
        console.log("🔍 Mobile ground Y bias being applied:", envOptions.groundYBias);
        
        sceneEnvironment = scene.createDefaultEnvironment(envOptions);
        
        // VERIFY GROUND PLANE CREATION AND APPLY OFFSET
        if (sceneEnvironment.ground) {
            console.log("✅ Mobile ground plane created successfully");
            console.log("🔍 Mobile ground plane position BEFORE:", sceneEnvironment.ground.position);
            
            // MANUALLY APPLY THE GROUND OFFSET
            // groundYBias doesn't always work as expected, so set position directly
            sceneEnvironment.ground.position.y = finalGroundOffset;
            
            console.log("🔍 Mobile ground plane position AFTER manual adjustment:", sceneEnvironment.ground.position);
            console.log(`✅ Manually set mobile ground Y position to: ${finalGroundOffset}m`);
            
            // CONFIGURE GROUND PLANE PROPERTIES
            sceneEnvironment.ground.receiveShadows = groundConfig?.GroundPlane_ReceiveShadows !== false;
            sceneEnvironment.ground.material.specularColor = new BABYLON.Color3(0, 0, 0);
            sceneEnvironment.ground.material.roughness = 1;
        } else {
            console.error("❌ Mobile ground plane creation failed");
        }
        
        // SETUP MOBILE SHADOW GENERATION (with fallback values)
        if (shadowConfig?.Shadows_Enabled !== false) {                         // <-- Default to enabled
            const shadowMapSize = envConfig?.Shadows_MapSizeMobile || 
                                 envConfig?.Shadows_MapSize || SHADOW_MAP_SIZE;
            shadowGenerator = new BABYLON.ShadowGenerator(shadowMapSize, sunLight);
            shadowGenerator.useExponentialShadowMap = true;
            shadowGenerator.useBlurExponentialShadowMap = shadowConfig?.Shadows_BlurEnabledMobile === true;
            shadowGenerator.setDarkness(shadowConfig?.Shadows_DarknessMobile || 
                                       shadowConfig?.Shadows_Darkness || 0.3);
            shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
            shadowGenerator.frustumEdgeFalloff = 0;
        }
        
        // STORE REFERENCES
        scene.shadowGenerator = shadowGenerator;
        scene.environment = sceneEnvironment;
        
        // INITIALIZE HDRI LIGHTING IF AVAILABLE (WITH MOBILE SETTINGS)
        if (window.TrueVision3D.SceneConfig && window.TrueVision3D.SceneConfig.HdriLightingLogic) {
            const hdriLogic = window.TrueVision3D.SceneConfig.HdriLightingLogic;
            const fullAppConfig = window.TrueVision3D.AppConfig;
            if (fullAppConfig) {
                const mobileHdriConfig = {
                    ...fullAppConfig,
                    SceneConfig: {
                        ...fullAppConfig.SceneConfig,
                        LightingConfig: {
                            ...fullAppConfig.SceneConfig.LightingConfig,
                            LightingCfg_HdrirBrightnessFactor: 0.3,
                            LightingCfg_HdriLighting: false
                        }
                    }
                };
                hdriLogic.initialize(scene, mobileHdriConfig, sceneEnvironment);
            }
        }
        
        console.log("✅ Mobile scene environment configured");
        console.log(`Mobile ground Y offset applied: ${finalGroundOffset}m`);
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
        
        // REFRESH DEV TOOLS DETECTION AFTER MODELS LOADED
        if (window.TrueVision3D?.DevTools?.DebugMarkersManager) {
            window.TrueVision3D.DevTools.DebugMarkersManager.refreshCameraAgentDetection();
        }
        
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
        
        // WAIT FOR CONFIGURATION TO BE LOADED
        if (!window.TrueVision3D?.AppConfig) {
            console.log("Waiting for app configuration before initializing CDN loader...");
            await window.TrueVision3D.configLoadPromise;
        }
        
        // INITIALIZE CDN LOADER - it will use the pre-loaded config
        const cdnInitialized = await window.TrueVisionCdnLoader.initialize();
        
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
            console.log(`🔍 ModelIdType from JSON: ${event.model.ModelIdType}`);
            
            // ONLY CHECK ModelIdType FIELD FROM JSON CONFIG
            if (event.model.ModelIdType === "Furnishings") {
                console.log(`🪑 FURNITURE MODEL DETECTED: ${event.model.ModelType}`);
                
                // GET MESHES FROM THE LOADED MODEL
                let meshesToAdd = [];
                
                // Try different ways to access meshes
                if (event.meshes && Array.isArray(event.meshes)) {
                    meshesToAdd = event.meshes;
                } else if (event.loadedMeshData && event.loadedMeshData.meshes) {
                    meshesToAdd = event.loadedMeshData.meshes;
                } else {
                    // Fallback: Find meshes added to scene
                    console.warn(`⚠️ No meshes in event, searching scene...`);
                    return; // Can't proceed without meshes
                }
                
                console.log(`🪑 Found ${meshesToAdd.length} meshes from furniture model`);
                
                // ADD ALL MESHES FROM FURNITURE MODELS - THE JSON ALREADY TOLD US IT'S FURNITURE!
                meshesToAdd.forEach((mesh) => {
                    if (mesh && mesh.name) {
                        // MARK MESH WITH SOURCE INFORMATION
                        mesh._furnitureModel = event.model.ModelType;
                        mesh._furnitureModelIdType = event.model.ModelIdType;
                        
                        furnitureMeshes.push(mesh);
                        mesh.isVisible = furnishingsVisible; // Apply current state
                        console.log(`🪑 Added: "${mesh.name}" from furniture model`);
                    }
                });
                
                console.log(`🪑 Total furniture meshes tracked: ${furnitureMeshes.length}`);
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
        console.log(`🔄 Mobile Pipeline: Toggle furniture called (current state: ${furnishingsVisible})`);
        console.log(`🔍 Mobile Pipeline: Furniture meshes available: ${furnitureMeshes.length}`);
        
        furnishingsVisible = !furnishingsVisible;
        
        let toggledCount = 0;
        let disposedCount = 0;
        
        furnitureMeshes.forEach((mesh, index) => {
            if (mesh && !mesh.isDisposed()) {
                mesh.isVisible = furnishingsVisible;
                toggledCount++;
                
                // LOG FIRST FEW MESH DETAILS
                if (index < 3) {
                    console.log(`🪑 ${furnishingsVisible ? 'Showing' : 'Hiding'} mesh: "${mesh.name}"`);
                }
            } else {
                disposedCount++;
            }
        });
        
        console.log(`✅ Mobile Pipeline: Furnishings ${furnishingsVisible ? 'shown' : 'hidden'}`);
        console.log(`   - Total meshes in array: ${furnitureMeshes.length}`);
        console.log(`   - Successfully toggled: ${toggledCount}`);
        console.log(`   - Disposed/invalid: ${disposedCount}`);
        
        if (furnitureMeshes.length === 0) {
            console.warn(`⚠️  Mobile Pipeline: No furniture meshes to toggle!`);
            console.warn(`⚠️  This means either:`);
            console.warn(`⚠️  1. Furniture models haven't loaded yet`);
            console.warn(`⚠️  2. Furniture models failed to load`);
            console.warn(`⚠️  3. Furniture tracking logic failed`);
        }
        
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
        getFurnitureStatus: function() {
            console.log(`🪑 Furniture tracking status:`);
            console.log(`   - Furniture visible: ${furnishingsVisible}`);
            console.log(`   - Total meshes tracked: ${furnitureMeshes.length}`);
            console.log(`   - Mesh names:`);
            furnitureMeshes.forEach((mesh, i) => {
                console.log(`     ${i + 1}. "${mesh.name}" (visible: ${mesh.isVisible})`);
            });
            return {
                visible: furnishingsVisible,
                count: furnitureMeshes.length,
                meshes: furnitureMeshes.map(m => ({ name: m.name, visible: m.isVisible }))
            };
        },
        dispose: dispose,
        // POWER MANAGEMENT API
        setPowerMode: function(mode) {
            if (mode === 'critical') {
                enableCriticalPowerSaving();
            } else if (mode === 'low') {
                enableLowPowerMode();
            } else if (mode === 'normal') {
                disablePowerSaving();
            }
        },
        getPowerMode: function() {
            return window.TrueVision3D._powerMode || 'normal';
        }
    };

    // MARK MODULE AS LOADED
    if (window.TrueVision3D.ModuleDependencyManager) {
        window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('RenderingPipeline');
    }

    // DISPATCH EVENT TO NOTIFY THAT RENDERING PIPELINE IS LOADED
    window.dispatchEvent(new CustomEvent('renderingPipelineLoaded'));        // <-- Critical event dispatch!
    console.log("🔔 Mobile Rendering pipeline loaded event dispatched");
    console.log("✅ Mobile Rendering Pipeline module fully loaded and initialized");
    console.log("Available methods:", Object.keys(window.TrueVision3D.RenderingPipeline));

// endregion -------------------------------------------------------------------

} catch (error) {
    console.error("❌ CRITICAL ERROR in Mobile Rendering Pipeline module:", error);
    console.error("Stack trace:", error.stack);
    // Still dispatch the event so ApplicationCore doesn't hang waiting
    window.dispatchEvent(new CustomEvent('renderingPipelineLoaded'));
}

})(); 